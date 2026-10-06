import { describe, expect, it } from 'vitest';
import { ACTIVE_INVENTORY_HOLD_STATUSES, deriveInventoryAvailability } from './inventoryAvailability.js';

describe('inventory availability rules', () => {
  it('uses only active reservation holds', () => {
    expect(ACTIVE_INVENTORY_HOLD_STATUSES).toEqual(['pending', 'confirmed', 'checked_in']);
    expect(ACTIVE_INVENTORY_HOLD_STATUSES).not.toContain('cancelled');
    expect(ACTIVE_INVENTORY_HOLD_STATUSES).not.toContain('no_show');
    expect(ACTIVE_INVENTORY_HOLD_STATUSES).not.toContain('checked_out');
  });

  it('derives open, sold-out, and manually closed states independently', () => {
    expect(deriveInventoryAvailability(4, 2, 'open')).toEqual({
      remaining: 2,
      sellableRemaining: 2,
      availabilityState: 'open',
    });
    expect(deriveInventoryAvailability(4, 4, 'open')).toEqual({
      remaining: 0,
      sellableRemaining: 0,
      availabilityState: 'sold_out',
    });
    expect(deriveInventoryAvailability(4, 3, 'closed')).toEqual({
      remaining: 1,
      sellableRemaining: 0,
      availabilityState: 'closed',
    });
  });
});
