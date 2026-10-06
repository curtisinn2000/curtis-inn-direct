import { z } from 'zod';

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

export const availabilitySearchSchema = z.object({
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  guests: z.coerce.number().int().min(1).max(20).optional(),
  adults: z.coerce.number().int().min(1).max(20).optional(),
  children: z.coerce.number().int().min(0).max(20).default(0),
  rooms: z.coerce.number().int().min(1).max(10),
}).superRefine((value, context) => {
  if (value.adults == null && value.guests == null) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['adults'], message: 'Adult count is required' });
  }
}).transform(value => {
  const adults = value.adults ?? value.guests!;
  const children = value.children ?? 0;
  return { ...value, adults, children, guests: adults + children };
});

export const bookingItemSchema = z.object({
  roomSlug: z.string().trim().min(1).max(160).optional(),
  roomTypeId: z.string().uuid().optional(),
  rooms: z.coerce.number().int().min(1).max(10),
}).refine(item => Boolean(item.roomSlug || item.roomTypeId), 'Room type is required');

export const guestInfoSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
});

export const paymentMethodSchema = z.enum(['stripe_pay_now']);

export const createReservationSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  search: availabilitySearchSchema,
  items: z.array(bookingItemSchema).min(1).max(10).optional(),
  selectedRoom: z
    .object({
      roomType: z.object({
        id: z.string().min(1),
        slug: z.string().min(1),
      }),
    })
    .nullable()
    .optional(),
  roomTypeId: z.string().uuid().optional(),
  roomSlug: z.string().min(1).optional(),
  guestInfo: guestInfoSchema,
  specialRequests: z.string().max(2000).default(''),
  arrivalTime: z.string().max(80).default(''),
  paymentMethod: paymentMethodSchema,
  agreedToPolicies: z.boolean().refine(Boolean, 'Policies must be accepted'),
  promoCode: z.string().trim().max(40).optional(),
});

export const availabilityQuoteSchema = z.object({
  search: availabilitySearchSchema,
  items: z.array(bookingItemSchema).min(1).max(10),
});

export const lookupReservationSchema = z.object({
  confirmationNumber: z.string().trim().min(3).max(40),
  lastName: z.string().trim().min(1).max(80),
});

export const sendReservationConfirmationEmailSchema = lookupReservationSchema.extend({
  email: z.string().trim().email().max(200),
});

export const validatePromoSchema = z.object({
  code: z.string().trim().min(1).max(40),
  totalCents: z.coerce.number().int().min(0).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

const bedSchema = z.object({
  type: z.enum(['twin', 'double', 'queen', 'king', 'bunk', 'sofa', 'futon', 'trundle', 'murphy', 'other']),
  quantity: z.coerce.number().int().min(1).max(10),
  customLabel: z.string().trim().min(1).max(80).optional(),
}).refine(value => value.type !== 'other' || Boolean(value.customLabel), {
  message: 'A custom bed label is required for Other.',
  path: ['customLabel'],
});

const bedroomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  beds: z.array(bedSchema).min(1).max(8),
});

export const roomWriteSchema = z.object({
  category: z.enum(['room', 'suite', 'studio', 'apartment']).optional(),
  standardName: z.string().trim().min(1).max(120).optional(),
  customName: z.string().trim().max(160).nullable().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  slug: z.string().trim().min(1).max(160).optional(),
  shortDescription: z.string().max(500).default(''),
  longDescription: z.string().max(3000).default(''),
  maxGuests: z.coerce.number().int().min(1).max(20).optional(),
  maxAdults: z.coerce.number().int().min(1).max(20).optional(),
  maxChildren: z.coerce.number().int().min(0).max(20).optional(),
  occupancy: z.coerce.number().int().min(1).max(20).optional(),
  bedrooms: z.array(bedroomSchema).min(1).max(10).optional(),
  bedType: z.string().trim().min(1).max(120).optional(),
  baseInventory: z.coerce.number().int().min(0).max(999).default(0),
  basePrice: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().default(false),
  extraBedsAllowed: z.boolean().optional(),
  maxExtraBeds: z.coerce.number().int().min(0).max(10).optional(),
  extraBedTypes: z.array(z.string().trim().min(1).max(80)).max(10).optional(),
  roomSizeSqFt: z.coerce.number().int().min(1).max(10000).nullable().optional(),
  smokingDesignation: z.enum(['non_smoking', 'smoking', 'unspecified']).optional(),
  bathroomType: z.enum(['private', 'shared', 'unspecified']).optional(),
  bathroomFeatures: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  viewTypes: z.array(z.enum(['pool', 'city', 'courtyard', 'garden', 'none'])).max(5).optional(),
  images: z.array(z.string().max(2000)).max(20).default([]),
  amenities: z.array(z.string().max(120)).max(50).optional(),
  policies: z.array(z.string().max(200)).max(50).optional(),
  cancellationTerms: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).default(0),
}).superRefine((value, context) => {
  const maxGuests = value.maxGuests ?? value.occupancy ?? 2;
  if (value.maxAdults != null && value.maxAdults > maxGuests) context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxAdults'], message: 'Maximum adults cannot exceed total guests.' });
  if (value.maxChildren != null && value.maxChildren > maxGuests) context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxChildren'], message: 'Maximum children cannot exceed total guests.' });
  if (value.extraBedsAllowed === false && (value.maxExtraBeds ?? 0) !== 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['maxExtraBeds'], message: 'Maximum extra beds must be zero when extra beds are disabled.' });
});

export const inventoryStatusWriteSchema = z.object({
  roomId: z.string().uuid(),
  date: isoDateSchema,
  status: z.enum(['open', 'closed']),
  expectedUpdatedAt: z.string().datetime().nullable().optional(),
});

export const defaultRateWriteSchema = z.object({
  roomId: z.string().uuid(),
  rate: z.coerce.number().int().min(0).max(9999),
});

export const rateWriteSchema = z.object({
  roomId: z.string().uuid(),
  date: isoDateSchema,
  rate: z.coerce.number().int().min(0).max(9999),
});

export const remainingWriteSchema = z.object({
  roomId: z.string().uuid(),
  date: isoDateSchema,
  remaining: z.coerce.number().int().min(0).max(999),
});

export const bulkInventorySchema = z.object({
  roomId: z.string().uuid(),
  dates: z.array(isoDateSchema).min(1).max(800),
  patch: z.object({
    inventory: z.coerce.number().int().min(0).max(999).optional(),
    status: z.enum(['open', 'closed']).optional(),
  }),
});

export const bulkRatesSchema = z.object({
  roomId: z.string().uuid(),
  dates: z.array(isoDateSchema).min(1).max(800),
  rule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('set'), amount: z.coerce.number().min(0).max(9999) }),
    z.object({ kind: z.literal('pct'), delta: z.coerce.number().min(-100).max(1000) }),
    z.object({ kind: z.literal('amt'), delta: z.coerce.number().min(-9999).max(9999) }),
  ]),
});

export const statusUpdateSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
});

export const heroContentSchema = z.object({
  heroTitle: z.string().trim().min(1).max(160),
  heroSubtitle: z.string().trim().max(200).default(''),
  heroDescription: z.string().trim().max(1000).default(''),
});

export const faqWriteSchema = z.object({
  question: z.string().trim().min(1).max(300),
  answer: z.string().trim().min(1).max(2000),
  category: z.string().trim().min(1).max(80).default('General'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const galleryWriteSchema = z.object({
  url: z.string().trim().min(1).max(2000),
  alt: z.string().trim().min(1).max(300),
  category: z.string().trim().min(1).max(80).default('exterior'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const roomOptionWriteSchema = z.object({
  label: z.string().trim().min(1).max(160),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const reviewWriteSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000),
  date: isoDateSchema,
  source: z.string().trim().min(1).max(80).default('Direct'),
  isFeatured: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export const attractionWriteSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().min(1).max(2000),
  distance: z.string().trim().min(1).max(80),
  image: z.string().trim().max(2000).default(''),
  category: z.string().trim().min(1).max(80).default('Area'),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});
