/**
 * Inventory & rates store — single source of truth shared across
 * Admin (Rooms, Availability Center, Bulk Update) and the public booking site.
 *
 * In-memory only (per session). Swap selectors to backend later without
 * changing call sites.
 */
import { create } from 'zustand';
import { format } from 'date-fns';
import { MOCK_ROOMS } from '@/data/mock-rooms';

export type RoomStatus = 'open' | 'closed';

export interface RoomTypeRecord {
  id: string;          // canonical room type id
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  occupancy: number;
  bedType: string;
  baseInventory: number;
  basePrice: number;
  isActive: boolean;
  images: string[];    // data URLs or remote URLs; [0] = cover
  sortOrder: number;
}

export interface DailyOverride {
  rate?: number;
  inventory?: number;
  status?: RoomStatus;
}

const key = (roomId: string, date: Date | string) =>
  `${roomId}|${typeof date === 'string' ? date : format(date, 'yyyy-MM-dd')}`;

// Deterministic seed for booked counts (stable across renders for same date)
const hash = (s: string) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

const slugify = (name: string) =>
  name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'room';

export type RateRule =
  | { kind: 'set'; amount: number }
  | { kind: 'pct'; delta: number }
  | { kind: 'amt'; delta: number };

interface InventoryState {
  roomTypes: Record<string, RoomTypeRecord>;
  overrides: Record<string, DailyOverride>;          // key: roomId|date
  reservationsByDate: Record<string, number>;        // key: roomId|date -> booked
  // actions
  setRate: (roomId: string, date: Date | string, rate: number) => void;
  setRemaining: (roomId: string, date: Date | string, remaining: number) => void;
  bulkUpdate: (
    roomId: string,
    dates: string[],
    patch: { inventory?: number; status?: RoomStatus }
  ) => void;
  bulkUpdateRates: (roomId: string, dates: string[], rule: RateRule) => void;
  clearRateOverrides: (roomId: string, fromDateKey?: string) => void;
  upsertRoomType: (room: Partial<RoomTypeRecord> & { id?: string; name: string }) => string;
  addRoomType: (room: Omit<Partial<RoomTypeRecord>, 'id' | 'slug' | 'sortOrder'> & { name: string }) => string;
  deleteRoomType: (roomId: string) => void;
  setRoomImages: (roomId: string, images: string[]) => void;
  setRoomActive: (roomId: string, active: boolean) => void;
}


const seedRoomTypes = (): Record<string, RoomTypeRecord> =>
  Object.fromEntries(MOCK_ROOMS.map(r => [r.id, {
    id: r.id,
    slug: r.slug,
    name: r.name,
    shortDescription: r.shortDescription,
    longDescription: r.longDescription,
    occupancy: r.occupancy,
    bedType: r.bedType,
    baseInventory: r.inventoryCount,
    basePrice: r.basePrice,
    isActive: r.isActive,
    images: [],
    sortOrder: r.sortOrder,
  }]));

const uniqueSlug = (base: string, existing: Record<string, RoomTypeRecord>, ignoreId?: string) => {
  const used = new Set(Object.values(existing).filter(r => r.id !== ignoreId).map(r => r.slug));
  let s = base, i = 2;
  while (used.has(s)) { s = `${base}-${i++}`; }
  return s;
};

export const useInventoryStore = create<InventoryState>((set) => ({
  roomTypes: seedRoomTypes(),
  overrides: {},
  reservationsByDate: {},

  setRate: (roomId, date, rate) => set(state => ({
    overrides: { ...state.overrides, [key(roomId, date)]: { ...state.overrides[key(roomId, date)], rate } }
  })),

  setRemaining: (roomId, date, remaining) => set(state => {
    const k = key(roomId, date);
    const booked = getBooked(state, roomId, date);
    const inventory = Math.max(0, booked + Math.max(0, Math.floor(remaining)));
    return { overrides: { ...state.overrides, [k]: { ...state.overrides[k], inventory } } };
  }),

  bulkUpdate: (roomId, dates, patch) => set(state => {
    const next = { ...state.overrides };
    for (const d of dates) {
      const k = key(roomId, d);
      next[k] = { ...next[k], ...patch };
    }
    return { overrides: next };
  }),

  bulkUpdateRates: (roomId, dates, rule) => set(state => {
    const next = { ...state.overrides };
    for (const d of dates) {
      const k = `${roomId}|${d}`;
      const current = next[k]?.rate ?? getRate(state, roomId, d);
      let value = current;
      if (rule.kind === 'set') value = rule.amount;
      else if (rule.kind === 'pct') value = current * (1 + rule.delta / 100);
      else if (rule.kind === 'amt') value = current + rule.delta;
      const clamped = Math.max(0, Math.min(9999, Math.round(value)));
      next[k] = { ...next[k], rate: clamped };
    }
    return { overrides: next };
  }),

  clearRateOverrides: (roomId, fromDateKey) => set(state => {
    const prefix = `${roomId}|`;
    const next: Record<string, DailyOverride> = {};
    for (const [k, v] of Object.entries(state.overrides)) {
      if (!k.startsWith(prefix)) { next[k] = v; continue; }
      const d = k.slice(prefix.length);
      if (fromDateKey && d < fromDateKey) { next[k] = v; continue; }
      const { rate, ...rest } = v;
      if (Object.keys(rest).length > 0) next[k] = rest;
    }
    return { overrides: next };
  }),



  upsertRoomType: (room) => {
    const id = room.id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? `rt-${crypto.randomUUID()}` : `rt-${Date.now()}`);
    set(state => {
      const existing = state.roomTypes[id];
      const slug = room.slug ?? existing?.slug ?? uniqueSlug(slugify(room.name), state.roomTypes, id);
      return {
        roomTypes: {
          ...state.roomTypes,
          [id]: {
            id,
            slug,
            name: room.name,
            shortDescription: room.shortDescription ?? existing?.shortDescription ?? '',
            longDescription: room.longDescription ?? existing?.longDescription ?? '',
            occupancy: room.occupancy ?? existing?.occupancy ?? 2,
            bedType: room.bedType ?? existing?.bedType ?? 'Queen',
            baseInventory: room.baseInventory ?? existing?.baseInventory ?? 0,
            basePrice: room.basePrice ?? existing?.basePrice ?? 0,
            isActive: room.isActive ?? existing?.isActive ?? true,
            images: room.images ?? existing?.images ?? [],
            sortOrder: room.sortOrder ?? existing?.sortOrder ?? (Object.keys(state.roomTypes).length + 1),
          }
        }
      };
    });
    return id;
  },

  addRoomType: (room) => {
    const id = (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? `rt-${crypto.randomUUID()}` : `rt-${Date.now()}`;
    set(state => {
      const slug = uniqueSlug(slugify(room.name), state.roomTypes);
      const nextSort = Math.max(0, ...Object.values(state.roomTypes).map(r => r.sortOrder)) + 1;
      return {
        roomTypes: {
          ...state.roomTypes,
          [id]: {
            id,
            slug,
            name: room.name,
            shortDescription: room.shortDescription ?? '',
            longDescription: room.longDescription ?? '',
            occupancy: room.occupancy ?? 2,
            bedType: room.bedType ?? 'Queen',
            baseInventory: room.baseInventory ?? 0,
            basePrice: room.basePrice ?? 0,
            isActive: room.isActive ?? true,
            images: room.images ?? [],
            sortOrder: nextSort,
          }
        }
      };
    });
    return id;
  },

  deleteRoomType: (roomId) => set(state => {
    const { [roomId]: _r, ...rest } = state.roomTypes;
    const prefix = `${roomId}|`;
    const overrides: Record<string, DailyOverride> = {};
    for (const [k, v] of Object.entries(state.overrides)) if (!k.startsWith(prefix)) overrides[k] = v;
    const reservationsByDate: Record<string, number> = {};
    for (const [k, v] of Object.entries(state.reservationsByDate)) if (!k.startsWith(prefix)) reservationsByDate[k] = v;
    return { roomTypes: rest, overrides, reservationsByDate };
  }),

  setRoomImages: (roomId, images) => set(state => ({
    roomTypes: state.roomTypes[roomId]
      ? { ...state.roomTypes, [roomId]: { ...state.roomTypes[roomId], images } }
      : state.roomTypes
  })),

  setRoomActive: (roomId, active) => set(state => ({
    roomTypes: { ...state.roomTypes, [roomId]: { ...state.roomTypes[roomId], isActive: active } }
  })),
}));

// ─── Pure selectors ───

export const dateKey = (d: Date | string) =>
  typeof d === 'string' ? d : format(d, 'yyyy-MM-dd');

export const listRoomTypes = (state: InventoryState): RoomTypeRecord[] =>
  Object.values(state.roomTypes).sort((a, b) => a.sortOrder - b.sortOrder);

export const getRoomBySlug = (state: InventoryState, slug: string): RoomTypeRecord | undefined =>
  Object.values(state.roomTypes).find(r => r.slug === slug);

export const hasFutureReservations = (state: InventoryState, roomId: string): boolean => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const prefix = `${roomId}|`;
  for (const [k, v] of Object.entries(state.reservationsByDate)) {
    if (k.startsWith(prefix) && v > 0 && k.slice(prefix.length) >= today) return true;
  }
  return false;
};

export const getBooked = (state: InventoryState, roomId: string, date: Date | string): number => {
  const k = key(roomId, date);
  if (state.reservationsByDate[k] != null) return state.reservationsByDate[k];
  // Fake demo booked counts only in dev (or when explicitly enabled).
  // Set VITE_FAKE_BOOKINGS=0 to disable in dev; backend will populate reservationsByDate in prod.
  const fakeOn = import.meta.env.DEV && import.meta.env.VITE_FAKE_BOOKINGS !== '0';
  if (!fakeOn) return 0;
  const room = state.roomTypes[roomId];
  if (!room || room.baseInventory === 0) return 0;
  return hash(k) % (room.baseInventory + 1);
};

export const getInventory = (state: InventoryState, roomId: string, date: Date | string): number => {
  const ov = state.overrides[key(roomId, date)];
  if (ov?.inventory != null) return ov.inventory;
  return state.roomTypes[roomId]?.baseInventory ?? 0;
};

export const getStatus = (state: InventoryState, roomId: string, date: Date | string): RoomStatus => {
  return state.overrides[key(roomId, date)]?.status ?? 'open';
};

export const getRate = (state: InventoryState, roomId: string, date: Date | string): number => {
  const ov = state.overrides[key(roomId, date)];
  if (ov?.rate != null) return ov.rate;
  const room = state.roomTypes[roomId];
  if (!room) return 0;
  const d = typeof date === 'string' ? new Date(date) : date;
  const weekend = d.getDay() === 0 || d.getDay() === 6;
  return Math.round(room.basePrice * (weekend ? 1.1 : 1));
};

export const getRemaining = (state: InventoryState, roomId: string, date: Date | string): number => {
  if (getStatus(state, roomId, date) === 'closed') return 0;
  return Math.max(0, getInventory(state, roomId, date) - getBooked(state, roomId, date));
};

export const getOccupancyForDate = (state: InventoryState, roomIds: string[], date: Date | string) => {
  let booked = 0, total = 0;
  for (const id of roomIds) {
    booked += getBooked(state, id, date);
    total += getInventory(state, id, date);
  }
  return { booked, total, pct: total ? booked / total : 0 };
};

export const occupancyTone = (pct: number) =>
  pct >= 0.85 ? 'destructive' : pct >= 0.6 ? 'warning' : 'success';

export const isRangeBookable = (
  state: InventoryState,
  roomId: string,
  checkIn: string,
  checkOut: string,
  roomsNeeded = 1,
): boolean => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    if (getRemaining(state, roomId, d) < roomsNeeded) return false;
  }
  return true;
};

export const totalRateForRange = (
  state: InventoryState,
  roomId: string,
  checkIn: string,
  checkOut: string,
): { nights: number; total: number; nightly: number } => {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  let nights = 0, total = 0;
  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    total += getRate(state, roomId, d);
    nights++;
  }
  return { nights, total, nightly: nights ? Math.round(total / nights) : 0 };
};
