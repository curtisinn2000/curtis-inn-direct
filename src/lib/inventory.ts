export function inventoryValidationMessage(value: string, booked: number, baseInventory: number): string | null {
  if (value.trim() === '') return 'Enter an inventory value.';
  const inventory = Number(value);
  if (!Number.isFinite(inventory) || !Number.isInteger(inventory)) return 'Inventory must be a whole number.';
  if (inventory < booked) return `Inventory cannot be lower than ${booked} booked room${booked === 1 ? '' : 's'}.`;
  if (inventory > baseInventory) return `Inventory cannot exceed the Room Type maximum of ${baseInventory}.`;
  return null;
}
