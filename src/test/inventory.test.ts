import { describe, expect, it } from 'vitest';
import { inventoryValidationMessage } from '@/lib/inventory';

describe('daily inventory validation', () => {
  it('accepts a whole number within the booked and base range', () => {
    expect(inventoryValidationMessage('3', 2, 4)).toBeNull();
  });

  it('rejects values below booked rooms', () => {
    expect(inventoryValidationMessage('1', 2, 4)).toContain('2 booked rooms');
  });

  it('rejects values above base inventory and non-integers', () => {
    expect(inventoryValidationMessage('5', 2, 4)).toContain('maximum of 4');
    expect(inventoryValidationMessage('2.5', 2, 4)).toContain('whole number');
  });
});
