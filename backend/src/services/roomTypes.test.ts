import { describe, expect, it } from 'vitest';
import { AppError } from '../errors.js';
import { assertPublishableRoom, baseInventoryConflictMessage, bedSummary, publicRoomName } from './roomTypes.js';

describe('room type model', () => {
  it('creates a readable summary across bedrooms and bed types', () => {
    expect(bedSummary([
      { name: 'Bedroom 1', beds: [{ type: 'queen', quantity: 2 }] },
      { name: 'Living room', beds: [{ type: 'sofa', quantity: 1 }] },
    ])).toBe('2 Queen Beds, 1 Sofa Bed');
  });

  it('uses the custom public name without losing the standard fallback', () => {
    expect(publicRoomName({ customName: 'Poolside King', standardName: 'King Room' })).toBe('Poolside King');
    expect(publicRoomName({ customName: '', standardName: 'King Room' })).toBe('King Room');
  });

  it('allows incomplete drafts but blocks incomplete publishing', () => {
    const input = { shortDescription: '', longDescription: '', baseInventory: 0, images: [], bedrooms: [], basePrice: 0 };
    expect(() => assertPublishableRoom({ ...input, isActive: false })).not.toThrow();
    expect(() => assertPublishableRoom({ ...input, isActive: true })).toThrow(AppError);
  });

  it('identifies dates that block a physical room capacity reduction', () => {
    expect(baseInventoryConflictMessage('King Room', 4, [
      { stay_date: '2026-10-10', reason: 'override' },
      { stay_date: '2026-10-11', reason: 'booked' },
    ])).toBe(
      'Cannot reduce King Room to 4 physical rooms. Future bookings or inventory overrides exceed this capacity on 2026-10-10, 2026-10-11.',
    );
  });
});
