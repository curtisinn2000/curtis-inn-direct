import type { DbClient } from '../db.js';
import { badRequest, conflict } from '../errors.js';
import { ACTIVE_INVENTORY_HOLD_STATUSES } from './inventoryAvailability.js';

export type Bed = {
  type: 'twin' | 'double' | 'queen' | 'king' | 'bunk' | 'sofa' | 'futon' | 'trundle' | 'murphy' | 'other';
  quantity: number;
  customLabel?: string;
};

export type Bedroom = { name: string; beds: Bed[] };

type Row = Record<string, unknown>;

type RoomWriteInput = Record<string, unknown> & {
  occupancy?: number;
  bedrooms?: Bedroom[];
  bedType?: string;
  category?: string;
  standardName?: string;
  customName?: string | null;
  name?: string;
  maxGuests?: number;
  maxAdults?: number;
  maxChildren?: number;
  extraBedsAllowed?: boolean;
  maxExtraBeds?: number;
  extraBedTypes?: string[];
  roomSizeSqFt?: number | null;
  smokingDesignation?: string;
  bathroomType?: string;
  bathroomFeatures?: string[];
  viewTypes?: string[];
};

export function normalizeRoomWrite(input: RoomWriteInput, current?: Row) {
  const legacyGuests = Number(input.occupancy ?? current?.occupancy ?? 2);
  const bedrooms = (input.bedrooms ?? current?.bedrooms ?? [{
    name: 'Bedroom 1',
    beds: [{ type: 'other', quantity: 1, customLabel: input.bedType ?? current?.bed_type ?? 'Bed' }],
  }]) as Bedroom[];
  const category = input.category ?? current?.category ?? 'room';
  const standardName = input.standardName ?? current?.standard_name ?? 'Other';
  const customName = input.customName !== undefined ? input.customName : current?.custom_name ?? input.name ?? null;
  const maxGuests = Number(input.maxGuests ?? input.occupancy ?? current?.occupancy ?? 2);
  return {
    ...input,
    category,
    standardName,
    customName,
    bedrooms,
    maxGuests,
    maxAdults: Number(input.maxAdults ?? current?.max_adults ?? legacyGuests),
    maxChildren: Number(input.maxChildren ?? current?.max_children ?? legacyGuests),
    extraBedsAllowed: Boolean(input.extraBedsAllowed ?? current?.extra_beds_allowed ?? false),
    maxExtraBeds: Number(input.maxExtraBeds ?? current?.max_extra_beds ?? 0),
    extraBedTypes: input.extraBedTypes ?? current?.extra_bed_types ?? [],
    roomSizeSqFt: input.roomSizeSqFt !== undefined ? input.roomSizeSqFt : current?.room_size_sq_ft ?? null,
    smokingDesignation: input.smokingDesignation ?? current?.smoking_designation ?? 'unspecified',
    bathroomType: input.bathroomType ?? current?.bathroom_type ?? 'unspecified',
    bathroomFeatures: input.bathroomFeatures ?? current?.bathroom_features ?? [],
    viewTypes: input.viewTypes ?? current?.view_types ?? [],
  };
}

const BED_LABELS: Record<Bed['type'], string> = {
  twin: 'Twin Bed', double: 'Double Bed', queen: 'Queen Bed', king: 'King Bed',
  bunk: 'Bunk Bed', sofa: 'Sofa Bed', futon: 'Futon', trundle: 'Trundle Bed',
  murphy: 'Murphy Bed', other: 'Bed',
};

export function bedSummary(bedrooms: Bedroom[]) {
  const totals = new Map<string, number>();
  for (const bedroom of bedrooms) {
    for (const bed of bedroom.beds) {
      const label = bed.type === 'other' ? bed.customLabel || BED_LABELS.other : BED_LABELS[bed.type];
      totals.set(label, (totals.get(label) ?? 0) + bed.quantity);
    }
  }
  return [...totals.entries()].map(([label, quantity]) => `${quantity} ${label}${quantity === 1 || label.endsWith('s') ? '' : 's'}`).join(', ');
}

export function publicRoomName(input: { customName?: string | null; standardName: string; name?: string }) {
  return input.customName?.trim() || input.standardName.trim() || input.name?.trim() || 'Room';
}

export function assertPublishableRoom(input: {
  isActive: boolean;
  shortDescription: string;
  longDescription: string;
  baseInventory: number;
  images: string[];
  bedrooms: Bedroom[];
  basePrice: number;
}) {
  if (!input.isActive) return;
  const missing: string[] = [];
  if (!input.shortDescription.trim()) missing.push('short description');
  if (!input.longDescription.trim()) missing.push('full description');
  if (input.baseInventory < 1) missing.push('physical inventory');
  if (!input.images.length) missing.push('cover photo');
  if (!input.bedrooms.length) missing.push('bed configuration');
  if (input.basePrice < 1) missing.push('default rate');
  if (missing.length) throw badRequest('room_not_publishable', `Complete these fields before publishing: ${missing.join(', ')}.`, { missing });
}

export function baseInventoryConflictMessage(roomName: string, nextInventory: number, rows: Record<string, unknown>[]) {
  const dates = [...new Set(rows.map(row => String(row.stay_date)))].slice(0, 5);
  const suffix = dates.length ? ` on ${dates.join(', ')}` : '';
  return `Cannot reduce ${roomName} to ${nextInventory} physical rooms. Future bookings or inventory overrides exceed this capacity${suffix}.`;
}

export async function validateBaseInventoryChange(
  db: DbClient,
  roomId: string,
  roomName: string,
  nextInventory: number,
) {
  const conflicts = await db.query(
    `with future_dates as (
       select stay_date, coalesce(sum(rn.rooms) filter (where r.status = any($3::reservation_status[])), 0)::int as booked
       from reservation_nights rn
       join reservations r on r.id = rn.reservation_id
       where rn.room_type_id = $1 and rn.stay_date >= current_date
       group by stay_date
     ), override_conflicts as (
       select stay_date::text, inventory, 0::int as booked, 'override'::text as reason
       from inventory_overrides where room_type_id = $1 and stay_date >= current_date and inventory > $2
     ), booking_conflicts as (
       select stay_date::text, null::int as inventory, booked, 'booked'::text as reason
       from future_dates where booked > $2
     )
     select * from override_conflicts union all select * from booking_conflicts order by stay_date limit 20`,
    [roomId, nextInventory, [...ACTIVE_INVENTORY_HOLD_STATUSES]],
  );
  if (conflicts.rowCount) {
    throw conflict(
      'base_inventory_conflict',
      baseInventoryConflictMessage(roomName, nextInventory, conflicts.rows),
      { dates: conflicts.rows, roomName, requestedInventory: nextInventory },
    );
  }
}
