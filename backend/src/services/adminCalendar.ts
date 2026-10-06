import type { DbClient } from '../db.js';
import { badRequest, conflict, notFound } from '../errors.js';
import { audit, roomFromRow } from '../transformers.js';
import { hotelTodayKey } from '../date-utils.js';

const HOLD_STATUSES = ['pending', 'confirmed', 'checked_in'];

export function hasFieldConflict<T>(expected: T | undefined, current: T, requested: T) {
  return requested !== current && expected !== undefined && expected !== current;
}

export function calendarDayFromRow(row: Record<string, unknown>) {
  const inventory = Number(row.inventory);
  const booked = Number(row.booked);
  const remaining = Math.max(0, inventory - booked);
  const status = String(row.status) as 'open' | 'closed';
  return {
    date: String(row.stay_date).slice(0, 10),
    inventory,
    booked,
    remaining,
    sellableRemaining: status === 'closed' ? 0 : remaining,
    status,
    availabilityState: status === 'closed' ? 'closed' : remaining === 0 ? 'sold_out' : 'open',
    rate: Number(row.rate),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

async function calendarRows(db: DbClient, dates: string[], roomId: string | null, taxRate: number) {
  return db.query(
    `with requested_dates as (select unnest($1::date[]) as stay_date),
     selected_rooms as (
       select * from room_types
       where is_active = true and deleted_at is null and ($2::uuid is null or id = $2::uuid)
     ), booked as (
       select rn.room_type_id, rn.stay_date,
         coalesce(sum(rn.rooms) filter (where r.status = any($3::reservation_status[])), 0)::int as booked
       from reservation_nights rn join reservations r on r.id = rn.reservation_id
       where rn.stay_date = any($1::date[])
       group by rn.room_type_id, rn.stay_date
     )
     select sr.*, $4::numeric as tax_rate, rd.stay_date::text,
       coalesce(io.inventory, sr.base_inventory)::int as inventory,
       coalesce(io.status, 'open')::text as status,
       coalesce(ro.rate, round(sr.base_price::numeric * case when extract(dow from rd.stay_date) in (0,6) then 1.10 else 1.00 end)::int)::int as rate,
       coalesce(b.booked, 0)::int as booked,
       io.updated_at
     from selected_rooms sr cross join requested_dates rd
     left join inventory_overrides io on io.room_type_id = sr.id and io.stay_date = rd.stay_date
     left join rate_overrides ro on ro.room_type_id = sr.id and ro.stay_date = rd.stay_date
     left join booked b on b.room_type_id = sr.id and b.stay_date = rd.stay_date
     order by sr.sort_order, sr.name, rd.stay_date`,
    [dates, roomId, HOLD_STATUSES, taxRate],
  );
}

export async function getAdminCalendarData(db: DbClient, dates: string[], roomId: string | null, taxRate: number) {
  const result = await calendarRows(db, dates, roomId, taxRate);
  const roomMap = new Map<string, { roomType: ReturnType<typeof roomFromRow>; days: ReturnType<typeof calendarDayFromRow>[] }>();
  const occupancy = new Map(dates.map(date => [date, { date, booked: 0, total: 0, pct: 0 }]));
  for (const row of result.rows) {
    const id = String(row.id);
    if (!roomMap.has(id)) roomMap.set(id, { roomType: roomFromRow(row), days: [] });
    const day = calendarDayFromRow(row);
    roomMap.get(id)!.days.push(day);
    const total = occupancy.get(day.date)!;
    total.booked += day.booked;
    total.total += day.inventory;
  }
  for (const day of occupancy.values()) day.pct = day.total ? day.booked / day.total : 0;
  return { rooms: [...roomMap.values()], occupancy: [...occupancy.values()] };
}

export async function setInventoryStatus(db: DbClient, input: {
  roomId: string;
  date: string;
  status: 'open' | 'closed';
  expectedStatus?: 'open' | 'closed';
  expectedUpdatedAt?: string | null;
  actorId: string;
  taxRate: number;
}) {
  if (input.date < hotelTodayKey()) {
    throw badRequest('inventory_date_in_past', 'Availability cannot be changed for a past date.');
  }

  // Reservation creation takes a share lock on the room, so status changes cannot race a booking.
  const room = await db.query(
    `select id from room_types where id = $1 and is_active = true and deleted_at is null for update`,
    [input.roomId],
  );
  if (!room.rowCount) throw notFound('room_not_found', 'Active room type was not found.');
  const existing = await db.query(
    `select status, updated_at from inventory_overrides where room_type_id = $1 and stay_date = $2 for update`,
    [input.roomId, input.date],
  );
  const currentStatus = (existing.rows[0]?.status ?? 'open') as 'open' | 'closed';
  if (input.status === currentStatus) {
    const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
    return calendarDayFromRow(rows.rows[0]);
  }
  if (hasFieldConflict(input.expectedStatus, currentStatus, input.status)) {
    const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
    throw conflict('availability_status_stale', 'Availability status changed since the calendar was loaded.', {
      currentDay: calendarDayFromRow(rows.rows[0]),
    });
  }
  await db.query(
    `insert into inventory_overrides(room_type_id, stay_date, status, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_type_id, stay_date) do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()`,
    [input.roomId, input.date, input.status, input.actorId],
  );
  await audit(db, {
    actorId: input.actorId, entity: 'inventory_override', entityId: `${input.roomId}|${input.date}`,
    action: 'status_update', before: { status: currentStatus }, after: { status: input.status },
  });
  const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
  return calendarDayFromRow(rows.rows[0]);
}

export function validateDailyInventory(
  inventory: number,
  booked: number,
  baseInventory: number,
  roomName: string,
) {
  if (!Number.isInteger(inventory) || inventory < 0 || inventory > 999) {
    throw badRequest('inventory_invalid', 'Inventory must be a whole number from 0 to 999.', {
      requestedInventory: inventory,
    });
  }
  if (inventory < booked) {
    const rooms = `${booked} room${booked === 1 ? '' : 's'} already booked`;
    throw badRequest('inventory_below_booked', `Inventory cannot be lower than ${rooms}.`, {
      booked,
      requestedInventory: inventory,
    });
  }
  if (inventory > baseInventory) {
    throw badRequest(
      'inventory_exceeded',
      `Inventory cannot exceed the ${baseInventory} physical rooms configured for ${roomName}.`,
      { roomName, baseInventory, requestedInventory: inventory },
    );
  }
}

export async function setDailyInventory(db: DbClient, input: {
  roomId: string;
  date: string;
  inventory: number;
  expectedInventory?: number;
  expectedUpdatedAt?: string | null;
  actorId: string;
  taxRate: number;
}) {
  if (input.date < hotelTodayKey()) {
    throw badRequest('inventory_date_in_past', 'Inventory cannot be changed for a past date.');
  }

  // Reservation creation takes a share lock on this row, so this update cannot race a new booking.
  const room = await db.query(
    `select id, name, base_inventory from room_types
     where id = $1 and is_active = true and deleted_at is null
     for update`,
    [input.roomId],
  );
  if (!room.rowCount) throw notFound('room_not_found', 'Active room type was not found.');

  const existing = await db.query(
    `select inventory, status, updated_at from inventory_overrides
     where room_type_id = $1 and stay_date = $2 for update`,
    [input.roomId, input.date],
  );
  const bookedResult = await db.query(
    `select coalesce(sum(rn.rooms) filter (where r.status = any($3::reservation_status[])), 0)::int as booked
     from reservation_nights rn
     join reservations r on r.id = rn.reservation_id
     where rn.room_type_id = $1 and rn.stay_date = $2`,
    [input.roomId, input.date, HOLD_STATUSES],
  );
  const booked = Number(bookedResult.rows[0].booked);
  const baseInventory = Number(room.rows[0].base_inventory);
  const roomName = String(room.rows[0].name);
  const previousInventory = existing.rows[0]?.inventory == null ? baseInventory : Number(existing.rows[0].inventory);
  validateDailyInventory(input.inventory, booked, baseInventory, roomName);
  if (input.inventory === previousInventory) {
    const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
    return calendarDayFromRow(rows.rows[0]);
  }
  if (hasFieldConflict(input.expectedInventory, previousInventory, input.inventory)) {
    const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
    throw conflict('inventory_stale', 'Inventory changed since the calendar was loaded.', {
      currentDay: calendarDayFromRow(rows.rows[0]),
    });
  }

  await db.query(
    `insert into inventory_overrides(room_type_id, stay_date, inventory, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_type_id, stay_date)
     do update set inventory = excluded.inventory, updated_by = excluded.updated_by, updated_at = now()`,
    [input.roomId, input.date, input.inventory, input.actorId],
  );
  await audit(db, {
    actorId: input.actorId,
    entity: 'inventory_override',
    entityId: `${input.roomId}|${input.date}`,
    action: 'inventory_update',
    before: { inventory: previousInventory, booked },
    after: { inventory: input.inventory, booked },
  });

  const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
  return calendarDayFromRow(rows.rows[0]);
}
