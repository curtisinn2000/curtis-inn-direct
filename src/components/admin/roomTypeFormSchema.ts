import type { RoomBedroom, RoomCategory, RoomType } from '@/types';

export type RoomTypeFormValues = {
  category: RoomCategory;
  standardName: string;
  customName: string;
  shortDescription: string;
  longDescription: string;
  baseInventory: number;
  bedrooms: RoomBedroom[];
  maxGuests: number;
  maxAdults: number;
  maxChildren: number;
  extraBedsAllowed: boolean;
  maxExtraBeds: number;
  extraBedTypes: string[];
  roomSizeSqFt: number | null;
  smokingDesignation: RoomType['smokingDesignation'];
  bathroomType: RoomType['bathroomType'];
  bathroomFeatures: string[];
  viewTypes: string[];
  amenities: string[];
  policies: string[];
  cancellationTerms: string;
  images: string[];
  isActive: boolean;
  sortOrder: number;
};

export const STANDARD_NAMES: Record<RoomCategory, string[]> = {
  room: ['Standard Room', 'King Room', 'Queen Room', 'Double Room', 'Twin Room', 'Accessible Room', 'Other'],
  suite: ['One-Bedroom Suite', 'Two-Bedroom Suite', 'King Suite', 'Queen Suite', 'Accessible Suite', 'Other'],
  studio: ['Standard Studio', 'King Studio', 'Queen Studio', 'Accessible Studio', 'Other'],
  apartment: ['Studio Apartment', 'One-Bedroom Apartment', 'Two-Bedroom Apartment', 'Accessible Apartment', 'Other'],
};

export const BED_TYPES = ['twin', 'double', 'queen', 'king', 'bunk', 'sofa', 'futon', 'trundle', 'murphy', 'other'] as const;
export const BATHROOM_FEATURES = ['Bathtub', 'Shower', 'Grab bars', 'Accessible shower', 'Hair dryer', 'Toiletries'];
export const VIEW_TYPES = ['pool', 'city', 'courtyard', 'garden', 'none'];

export function emptyRoomTypeForm(): RoomTypeFormValues {
  return {
    category: 'room', standardName: 'Standard Room', customName: '', shortDescription: '', longDescription: '',
    baseInventory: 0, bedrooms: [{ name: 'Bedroom 1', beds: [{ type: 'queen', quantity: 1 }] }],
    maxGuests: 2, maxAdults: 2, maxChildren: 2, extraBedsAllowed: false, maxExtraBeds: 0, extraBedTypes: [],
    roomSizeSqFt: null, smokingDesignation: 'non_smoking', bathroomType: 'private', bathroomFeatures: [], viewTypes: [],
    amenities: [], policies: [], cancellationTerms: '', images: [], isActive: false, sortOrder: 0,
  };
}

export function roomToForm(room: RoomType): RoomTypeFormValues {
  return {
    category: room.category, standardName: room.standardName, customName: room.customName ?? '',
    shortDescription: room.shortDescription, longDescription: room.longDescription, baseInventory: room.inventoryCount,
    bedrooms: room.bedrooms, maxGuests: room.maxGuests, maxAdults: room.maxAdults, maxChildren: room.maxChildren,
    extraBedsAllowed: room.extraBedsAllowed, maxExtraBeds: room.maxExtraBeds, extraBedTypes: room.extraBedTypes,
    roomSizeSqFt: room.roomSizeSqFt, smokingDesignation: room.smokingDesignation, bathroomType: room.bathroomType,
    bathroomFeatures: room.bathroomFeatures, viewTypes: room.viewTypes, amenities: room.amenities, policies: room.policies,
    cancellationTerms: room.cancellationTerms ?? '', images: room.images, isActive: room.isActive, sortOrder: room.sortOrder,
  };
}

export function roomFormErrors(value: RoomTypeFormValues, basePrice: number) {
  const errors: string[] = [];
  if (!value.standardName.trim()) errors.push('Choose a standard room type.');
  if (!value.shortDescription.trim()) errors.push('Add a short description.');
  if (!value.longDescription.trim()) errors.push('Add a full description.');
  if (value.baseInventory < 1) errors.push('Physical inventory must be at least 1.');
  if (!value.bedrooms.length || value.bedrooms.some(room => !room.beds.length)) errors.push('Add at least one bed.');
  if (value.maxAdults > value.maxGuests || value.maxChildren > value.maxGuests) errors.push('Adult and child limits cannot exceed total occupancy.');
  if (!value.images.length) errors.push('Add a cover photo.');
  if (basePrice < 1) errors.push('Set a positive default rate in Rates Center.');
  return errors;
}
