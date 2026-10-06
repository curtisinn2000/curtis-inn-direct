export function inventoryValidationMessage(
  value: string,
  booked: number,
  baseInventory: number,
  roomName: string,
): string | null {
  if (value.trim() === '') return 'Enter an inventory value.';
  const inventory = Number(value);
  if (!Number.isFinite(inventory) || !Number.isInteger(inventory)) return 'Inventory must be a whole number.';
  if (inventory < 0) return 'Inventory cannot be negative.';
  if (inventory < booked) return `Inventory cannot be lower than ${booked} room${booked === 1 ? '' : 's'} already booked.`;
  if (inventory > baseInventory) return `Inventory cannot exceed the ${baseInventory} physical rooms configured for ${roomName}.`;
  return null;
}

export function bulkInventoryValidationMessage(value: string, baseInventory: number, roomName: string): string | null {
  if (value === '') return null;
  const inventory = Number(value);
  if (!Number.isFinite(inventory) || !Number.isInteger(inventory) || inventory < 0) return 'Inventory must be a non-negative whole number.';
  if (inventory > baseInventory) return `Maximum inventory for ${roomName} is ${baseInventory}.`;
  return null;
}
