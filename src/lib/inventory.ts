export function inventoryValidationMessage(value: string, booked: number): string | null {
  if (value.trim() === '') return 'Enter an inventory value.';
  const inventory = Number(value);
  if (!Number.isFinite(inventory) || !Number.isInteger(inventory)) return 'Inventory must be a whole number.';
  if (inventory < 0) return 'Inventory cannot be negative.';
  if (inventory > 999) return 'Inventory cannot exceed 999.';
  if (inventory < booked) return `Inventory cannot be lower than ${booked} room${booked === 1 ? '' : 's'} already booked.`;
  return null;
}
