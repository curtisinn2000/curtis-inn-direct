export const ACTIVE_INVENTORY_HOLD_STATUSES = ['pending', 'confirmed', 'checked_in'] as const;

export type ManualInventoryStatus = 'open' | 'closed';

export function deriveInventoryAvailability(
  inventory: number,
  booked: number,
  status: ManualInventoryStatus,
) {
  const remaining = Math.max(0, inventory - booked);
  return {
    remaining,
    sellableRemaining: status === 'closed' ? 0 : remaining,
    availabilityState: status === 'closed' ? 'closed' : remaining === 0 ? 'sold_out' : 'open',
  } as const;
}
