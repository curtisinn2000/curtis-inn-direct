import { describe, expect, it } from 'vitest';
import { eachStayDate } from '../date-utils.js';
import { buildReservationNightRows } from './reservations.js';

describe('reservation night generation', () => {
  it('stores every occupied night and excludes the checkout date', () => {
    const dates = eachStayDate('2026-10-06', '2026-10-09');
    const rows = buildReservationNightRows(
      'ba920216-adb6-4d8c-bbc9-5725bcc53bde',
      4,
      dates.map(date => ({ date, rateCents: 10_000 })),
    );

    expect(rows).toEqual([
      expect.objectContaining({ stayDate: '2026-10-06', rooms: 4 }),
      expect.objectContaining({ stayDate: '2026-10-07', rooms: 4 }),
      expect.objectContaining({ stayDate: '2026-10-08', rooms: 4 }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows.some(row => row.stayDate === '2026-10-09')).toBe(false);
  });
});
