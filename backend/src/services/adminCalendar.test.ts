import { describe, expect, it } from 'vitest';
import { calendarDayFromRow, validateDailyInventory } from './adminCalendar.js';

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
  it('accepts inventory between booked rooms and physical inventory', () => {
    expect(() => validateDailyInventory(3, 2, 4)).not.toThrow();
  });

  it('rejects inventory below booked rooms', () => {
    expect(() => validateDailyInventory(1, 2, 4)).toThrow(/lower than 2 booked room/);
  });

  it('rejects inventory above physical inventory', () => {
    expect(() => validateDailyInventory(5, 2, 4)).toThrow(/cannot exceed.*4/i);
  });
});
