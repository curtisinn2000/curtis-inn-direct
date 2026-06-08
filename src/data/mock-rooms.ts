import type { RoomType, RoomCategorySlug } from '@/types';

const createRoom = (
  slug: RoomCategorySlug,
  name: string,
  shortDesc: string,
  longDesc: string,
  occupancy: number,
  bedType: string,
  basePrice: number,
  inventoryCount: number,
  sortOrder: number,
): RoomType => ({
  id: slug,
  slug,
  name,
  shortDescription: shortDesc,
  longDescription: longDesc,
  occupancy,
  bedType,
  images: [`/placeholder.svg`],
  amenities: ['Free Wi-Fi', 'Air Conditioning', 'Flat-screen TV', 'Private Bathroom'],
  policies: ['Non-smoking', 'No pets'],
  basePrice,
  taxRate: 0.13,
  isActive: true,
  inventoryCount,
  cancellationTerms: 'Free cancellation up to 48 hours before check-in.',
  sortOrder,
});

export const MOCK_ROOMS: RoomType[] = [
  createRoom(
    'king-room', 'King Room',
    'Spacious room with a king-size bed, perfect for couples or solo travelers seeking extra comfort.',
    'Enjoy a restful stay in our King Room, featuring a plush king-size bed, modern furnishings, and all the amenities you need for a comfortable visit to Hollywood, Florida. The room includes a flat-screen TV, free Wi-Fi, individually controlled air conditioning, and a clean private bathroom.',
    2, 'King', 109, 4, 1,
  ),
  createRoom(
    'standard-room', 'Standard Room',
    'Comfortable and affordable room ideal for short stays and budget-conscious travelers.',
    'Our Standard Room offers everything you need for a pleasant stay at an affordable price. Featuring a comfortable bed, clean linens, and modern amenities including free Wi-Fi, air conditioning, and a flat-screen TV.',
    2, 'Queen', 79, 6, 2,
  ),
  createRoom(
    'traditional-room', 'Traditional Room',
    'Classic room with warm décor and reliable comfort for a relaxing stay.',
    'The Traditional Room at Curtis Inn & Suites provides a cozy and inviting atmosphere with classic furnishings. Enjoy a comfortable bed, well-appointed bathroom, and convenient in-room amenities during your Hollywood, Florida getaway.',
    2, 'Queen', 85, 5, 3,
  ),
  createRoom(
    'deluxe-studio-suite', 'Deluxe Studio Suite',
    'Open-plan suite with separate living area, kitchenette, and premium furnishings.',
    'Our Deluxe Studio Suite offers an elevated experience with a spacious open-plan layout, comfortable king bed, separate living area with sofa, and a convenient kitchenette. Perfect for extended stays or guests who appreciate extra space and flexibility.',
    3, 'King + Sofa Bed', 149, 3, 4,
  ),
  createRoom(
    'one-bedroom-suite', 'One-Bedroom Suite',
    'Separate bedroom and living room with kitchenette — ideal for families or longer stays.',
    'The One-Bedroom Suite features a private bedroom with a comfortable bed, a separate living room with sofa, and a kitchenette equipped with essentials. This suite provides the perfect balance of space and comfort for families or extended-stay guests.',
    4, 'King + Sofa Bed', 169, 2, 5,
  ),
  createRoom(
    'two-bedroom-suite', 'Two-Bedroom Suite',
    'Spacious two-bedroom layout perfect for families or groups needing separate sleeping areas.',
    'Our Two-Bedroom Suite is our most spacious accommodation, featuring two private bedrooms, a shared living area, and a kitchenette. Ideal for families or groups traveling together who need separate sleeping spaces with shared common areas.',
    6, '1 King + 2 Double Beds', 219, 2, 6,
  ),
  createRoom(
    'superior-two-double', 'Superior Room with Two Double Beds',
    'Generous room with two double beds — great for families or friends sharing.',
    'The Superior Room with Two Double Beds provides ample space and sleeping capacity for up to four guests. Featuring two comfortable double beds, modern amenities, and a clean, well-appointed bathroom, this room is perfect for families or friends traveling together.',
    4, '2 Double Beds', 99, 5, 7,
  ),
  createRoom(
    'superior-two-double-ada', 'Superior Room with Two Double Beds - Disability Access',
    'Accessible room with two double beds, ADA-compliant features, and barrier-free design.',
    'Our ADA-accessible Superior Room features two double beds, a roll-in shower, grab bars, lowered fixtures, and wider doorways. All the comfort and amenities of our superior rooms with thoughtful accessibility features throughout.',
    4, '2 Double Beds', 99, 2, 8,
  ),
  createRoom(
    'economy-single', 'Economy Single Room',
    'Compact and affordable single room for solo travelers on a budget.',
    'The Economy Single Room is a compact, well-maintained room designed for solo travelers seeking an affordable and comfortable base in Hollywood, Florida. Clean, simple, and equipped with all the essentials.',
    1, 'Twin', 59, 4, 9,
  ),
];
