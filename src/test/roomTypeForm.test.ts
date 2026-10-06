import { describe, expect, it } from 'vitest';
import { emptyRoomTypeForm, roomFormErrors } from '@/components/admin/roomTypeFormSchema';

describe('room type publish validation', () => {
  it('permits draft data while exposing every publish blocker', () => {
    const errors = roomFormErrors(emptyRoomTypeForm(), 0);
    expect(errors).toContain('Set a positive default rate in Rates Center.');
    expect(errors).toContain('Add a cover photo.');
  });

  it('accepts a complete room definition', () => {
    const value = { ...emptyRoomTypeForm(), shortDescription: 'Short', longDescription: 'Long', baseInventory: 2, images: ['https://example.com/room.webp'] };
    expect(roomFormErrors(value, 109)).toEqual([]);
  });
});
