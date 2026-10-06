import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import { priceAndAvailabilityForRoom } from './availability.js';
import { ACTIVE_INVENTORY_HOLD_STATUSES } from './inventoryAvailability.js';
import { priceCart, type CreateReservationInput } from './reservations.js';

function availabilityDb(bookedByDate: Record<string, number>, status: 'open' | 'closed' = 'open') {
  return {
    query: vi.fn(async (_sql: string, params?: unknown[]) => ({
      rowCount: 1,
      rows: [{ inventory: 4, booked: bookedByDate[String(params?.[3])] ?? 0, status, rate: 100 }],
    })),
  };
}

afterEach(() => vi.useRealTimers());

describe('public reservation availability', () => {
  it('sells out all occupied nights and excludes checkout', async () => {
    const db = availabilityDb({
      '2026-10-06': 4,
      '2026-10-07': 4,
      '2026-10-08': 4,
    });

    const result = await priceAndAvailabilityForRoom(db as unknown as DbClient, {
      roomId: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde',
      basePrice: 100,
      baseInventory: 4,
      checkIn: '2026-10-06',
      checkOut: '2026-10-09',
      roomsNeeded: 1,
    });

    expect(result).toMatchObject({ bookable: false, minRemaining: 0 });
    expect(result.nightlyRates.map(night => night.date)).toEqual(['2026-10-06', '2026-10-07', '2026-10-08']);
    expect(db.query).toHaveBeenCalledTimes(3);
    for (const [, params] of db.query.mock.calls) expect(params?.[4]).toEqual([...ACTIVE_INVENTORY_HOLD_STATUSES]);
  });

  it('keeps partial inventory open and adds multiple reservations through the summed booked value', async () => {
    const partial = await priceAndAvailabilityForRoom(availabilityDb({ '2026-10-06': 2 }) as unknown as DbClient, {
      roomId: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde', basePrice: 100, baseInventory: 4,
      checkIn: '2026-10-06', checkOut: '2026-10-07', roomsNeeded: 2,
    });
    const full = await priceAndAvailabilityForRoom(availabilityDb({ '2026-10-06': 4 }) as unknown as DbClient, {
      roomId: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde', basePrice: 100, baseInventory: 4,
      checkIn: '2026-10-06', checkOut: '2026-10-07', roomsNeeded: 1,
    });

    expect(partial).toMatchObject({ bookable: true, minRemaining: 2 });
    expect(full).toMatchObject({ bookable: false, minRemaining: 0 });
  });

  it('keeps manual closure independent from physical remaining inventory', async () => {
    const result = await priceAndAvailabilityForRoom(availabilityDb({ '2026-10-06': 3 }, 'closed') as unknown as DbClient, {
      roomId: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde', basePrice: 100, baseInventory: 4,
      checkIn: '2026-10-06', checkOut: '2026-10-07', roomsNeeded: 1,
    });
    expect(result).toMatchObject({ bookable: false, minRemaining: 0 });
  });

  it('rejects a second reservation before any reservation or payment insert', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-06T12:00:00-04:00'));
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select * from room_types')) {
        return {
          rowCount: 1,
          rows: [{
            id: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde', slug: 'king-room', name: 'King Room',
            occupancy: 2, max_adults: 2, max_children: 2, base_price: 100, base_inventory: 4,
          }],
        };
      }
      if (sql.includes('coalesce(io.inventory')) {
        return { rowCount: 1, rows: [{ inventory: 4, booked: 4, status: 'open', rate: 100 }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    });
    const input: CreateReservationInput = {
      roomTypeId: 'ba920216-adb6-4d8c-bbc9-5725bcc53bde',
      search: { checkIn: '2026-10-06', checkOut: '2026-10-09', guests: 2, adults: 2, children: 0, rooms: 1 },
      guestInfo: { firstName: 'Test', lastName: 'Guest', email: 'test@example.com', phone: '5550100' },
      specialRequests: '', arrivalTime: '', paymentMethod: 'stripe_pay_now',
    };

    await expect(priceCart({ query } as unknown as DbClient, input)).rejects.toMatchObject({
      status: 409,
      code: 'sold_out',
    });
    expect(query.mock.calls.some(([sql]) => /^\s*insert into (reservations|payments)/i.test(String(sql)))).toBe(false);
  });
});
