import { describe, expect, it } from 'vitest';
import { inventoryValidationMessage } from '@/lib/inventory';

describe('daily inventory validation', () => {
  it('accepts a whole number at or above booked rooms', () => {
    expect(inventoryValidationMessage('3', 2)).toBeNull();
    expect(inventoryValidationMessage('5', 2)).toBeNull();
  });

  it('rejects values below booked rooms', () => {
    expect(inventoryValidationMessage('1', 2)).toContain('2 rooms already booked');
  });

  it('rejects out-of-range values and non-integers', () => {
    expect(inventoryValidationMessage('-1', 0)).toContain('negative');
    expect(inventoryValidationMessage('1000', 0)).toContain('999');
    expect(inventoryValidationMessage('2.5', 2)).toContain('whole number');
  });
});
