import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import { calendarDayFromRow, hasFieldConflict, setDailyInventory, setInventoryStatus, validateDailyInventory } from './adminCalendar.js';

const canonicalRow = (overrides: Record<string, unknown> = {}) => ({
  stay_date: '2099-10-10',
  inventory: 5,
  booked: 2,
  status: 'open',
  rate: 109,
  updated_at: '2099-01-01T00:00:00.000Z',
  ...overrides,
});

describe('availability state derivation', () => {
  const row = { stay_date: '2026-10-05', rate: 109, updated_at: null };

  it('derives open when sellable inventory remains', () => {
    expect(calendarDayFromRow({ ...row, inventory: 2, booked: 1, status: 'open' })).toMatchObject({ availabilityState: 'open', remaining: 1, sellableRemaining: 1 });
  });

  it('derives sold out from an open date with zero remaining', () => {
    expect(calendarDayFromRow({ ...row, inventory: 2, booked: 2, status: 'open' })).toMatchObject({ availabilityState: 'sold_out', remaining: 0, sellableRemaining: 0 });
  });

  it('keeps physical remaining while a date is manually closed', () => {
    expect(calendarDayFromRow({ ...row, inventory: 2, booked: 1, status: 'closed' })).toMatchObject({ availabilityState: 'closed', remaining: 1, sellableRemaining: 0 });
  });
});

describe('daily inventory validation', () => {
  it('accepts inventory at physical capacity and at booked quantity', () => {
    expect(() => validateDailyInventory(4, 0, 4, 'King Room')).not.toThrow();
    expect(() => validateDailyInventory(2, 2, 4, 'King Room')).not.toThrow();
  });

  it('rejects inventory below booked rooms and above physical capacity', () => {
    expect(() => validateDailyInventory(1, 2, 4, 'King Room')).toThrow(/lower than 2 rooms already booked/);
    expect(() => validateDailyInventory(5, 0, 4, 'King Room')).toThrow(/cannot exceed the 4 physical rooms configured for King Room/);
  });

  it('rejects values outside the database range', () => {
    expect(() => validateDailyInventory(-1, 0, 4, 'King Room')).toThrow(/0 to 999/);
    expect(() => validateDailyInventory(1000, 0, 4, 'King Room')).toThrow(/0 to 999/);
  });
});

describe('field-specific optimistic concurrency', () => {
  it('does not conflict when the edited field is unchanged', () => {
    expect(hasFieldConflict('open', 'open', 'closed')).toBe(false);
    expect(hasFieldConflict(3, 3, 5)).toBe(false);
  });

  it('conflicts when the same field changed concurrently', () => {
    expect(hasFieldConflict('open', 'closed', 'open')).toBe(true);
    expect(hasFieldConflict(3, 4, 5)).toBe(true);
  });

  it('treats an already-persisted request as idempotent success', () => {
    expect(hasFieldConflict('open', 'closed', 'closed')).toBe(false);
    expect(hasFieldConflict(3, 5, 5)).toBe(false);
  });
});

describe('authoritative availability writes', () => {
  it('updates only status and returns the canonical recalculated day', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('select id from room_types')) return { rowCount: 1, rows: [{ id: 'room-1' }] };
      if (sql.includes('select status, updated_at')) return { rowCount: 1, rows: [{ status: 'open' }] };
      if (sql.includes('with requested_dates')) return { rowCount: 1, rows: [canonicalRow({ status: 'closed' })] };
      return { rowCount: 1, rows: [] };
    });

    const day = await setInventoryStatus({ query } as unknown as DbClient, {
      roomId: '00000000-0000-4000-8000-000000000001',
      date: '2099-10-10',
      status: 'closed',
      expectedStatus: 'open',
      actorId: '00000000-0000-4000-8000-000000000002',
      taxRate: 0.13,
    });

    expect(day).toMatchObject({ status: 'closed', inventory: 5, remaining: 3, availabilityState: 'closed' });
    const upsert = query.mock.calls.find(([sql]) => String(sql).includes('insert into inventory_overrides'));
    expect(String(upsert?.[0])).not.toContain('inventory, status');
    expect(upsert?.[1]).toEqual([
      '00000000-0000-4000-8000-000000000001', '2099-10-10', 'closed',
      '00000000-0000-4000-8000-000000000002',
    ]);
  });

  it('updates only inventory up to physical capacity and preserves closed status', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('select id, name, base_inventory')) return { rowCount: 1, rows: [{ id: 'room-1', name: 'King Room', base_inventory: 5 }] };
      if (sql.includes('select inventory, status')) return { rowCount: 1, rows: [{ inventory: 3, status: 'closed' }] };
      if (sql.includes('with requested_dates')) return { rowCount: 1, rows: [canonicalRow({ status: 'closed' })] };
      if (sql.includes('coalesce(sum(rn.rooms)')) return { rowCount: 1, rows: [{ booked: 2 }] };
      return { rowCount: 1, rows: [] };
    });

    const day = await setDailyInventory({ query } as unknown as DbClient, {
      roomId: '00000000-0000-4000-8000-000000000001',
      date: '2099-10-10',
      inventory: 5,
      expectedInventory: 3,
      actorId: '00000000-0000-4000-8000-000000000002',
      taxRate: 0.13,
    });

    expect(day).toMatchObject({ inventory: 5, status: 'closed', remaining: 3, availabilityState: 'closed' });
    const upsert = query.mock.calls.find(([sql]) => String(sql).includes('insert into inventory_overrides'));
    expect(String(upsert?.[0])).not.toContain('inventory, status');
  });

  it('rejects a direct inventory write above physical capacity without persisting it', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('select id, name, base_inventory')) return { rowCount: 1, rows: [{ id: 'room-1', name: 'King Room', base_inventory: 4 }] };
      if (sql.includes('select inventory, status')) return { rowCount: 1, rows: [{ inventory: 4, status: 'open' }] };
      if (sql.includes('coalesce(sum(rn.rooms)')) return { rowCount: 1, rows: [{ booked: 0 }] };
      return { rowCount: 1, rows: [] };
    });

    await expect(setDailyInventory({ query } as unknown as DbClient, {
      roomId: '00000000-0000-4000-8000-000000000001',
      date: '2099-10-10',
      inventory: 17,
      expectedInventory: 4,
      actorId: '00000000-0000-4000-8000-000000000002',
      taxRate: 0.13,
    })).rejects.toMatchObject({
      status: 400,
      code: 'inventory_exceeded',
      message: 'Inventory cannot exceed the 4 physical rooms configured for King Room.',
    });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into inventory_overrides'))).toBe(false);
  });

  it('returns the canonical day with a same-field status conflict', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('select id from room_types')) return { rowCount: 1, rows: [{ id: 'room-1' }] };
      if (sql.includes('select status, updated_at')) return { rowCount: 1, rows: [{ status: 'closed' }] };
      if (sql.includes('with requested_dates')) return { rowCount: 1, rows: [canonicalRow({ status: 'closed' })] };
      return { rowCount: 1, rows: [] };
    });

    await expect(setInventoryStatus({ query } as unknown as DbClient, {
      roomId: '00000000-0000-4000-8000-000000000001',
      date: '2099-10-10',
      status: 'open',
      expectedStatus: 'open',
      actorId: '00000000-0000-4000-8000-000000000002',
      taxRate: 0.13,
    })).rejects.toMatchObject({
      status: 409,
      code: 'availability_status_stale',
      details: { currentDay: expect.objectContaining({ status: 'closed', inventory: 5 }) },
    });
  });

  it('returns the canonical day with a same-field inventory conflict', async () => {
    const query = vi.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('select id, name, base_inventory')) return { rowCount: 1, rows: [{ id: 'room-1', name: 'King Room', base_inventory: 5 }] };
      if (sql.includes('select inventory, status')) return { rowCount: 1, rows: [{ inventory: 4, status: 'open' }] };
      if (sql.includes('with requested_dates')) return { rowCount: 1, rows: [canonicalRow({ inventory: 4 })] };
      if (sql.includes('coalesce(sum(rn.rooms)')) return { rowCount: 1, rows: [{ booked: 2 }] };
      return { rowCount: 1, rows: [] };
    });

    await expect(setDailyInventory({ query } as unknown as DbClient, {
      roomId: '00000000-0000-4000-8000-000000000001',
      date: '2099-10-10',
      inventory: 5,
      expectedInventory: 3,
      actorId: '00000000-0000-4000-8000-000000000002',
      taxRate: 0.13,
    })).rejects.toMatchObject({
      status: 409,
      code: 'inventory_stale',
      details: { currentDay: expect.objectContaining({ status: 'open', inventory: 4 }) },
    });
  });
});
