import { describe, expect, it } from 'vitest';
import { bulkInventoryValidationMessage, inventoryValidationMessage } from '@/lib/inventory';

describe('daily inventory validation', () => {
  it('accepts inventory at physical capacity and at booked quantity', () => {
    expect(inventoryValidationMessage('4', 0, 4, 'King Room')).toBeNull();
    expect(inventoryValidationMessage('2', 2, 4, 'King Room')).toBeNull();
  });

  it('rejects values below booked rooms and above physical capacity', () => {
    expect(inventoryValidationMessage('1', 2, 4, 'King Room')).toContain('2 rooms already booked');
    expect(inventoryValidationMessage('5', 0, 4, 'King Room')).toBe(
      'Inventory cannot exceed the 4 physical rooms configured for King Room.',
    );
  });

  it('rejects negative values and non-integers', () => {
    expect(inventoryValidationMessage('-1', 0, 4, 'King Room')).toContain('negative');
    expect(inventoryValidationMessage('2.5', 2, 4, 'King Room')).toContain('whole number');
  });

  it('validates each Room Type with its own capacity in bulk updates', () => {
    expect(bulkInventoryValidationMessage('4', 4, 'King Room')).toBeNull();
    expect(bulkInventoryValidationMessage('17', 4, 'King Room')).toBe('Maximum inventory for King Room is 4.');
    expect(bulkInventoryValidationMessage('4', 2, 'Suite')).toBe('Maximum inventory for Suite is 2.');
  });
});
