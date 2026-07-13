import type { DbClient } from './db.js';

type DbRow = Record<string, unknown>;

const asString = (value: unknown) => String(value ?? '');
const asNumber = (value: unknown) => Number(value ?? 0);
const asBoolean = (value: unknown) => Boolean(value);
const asArray = <T>(value: unknown, fallback: T[] = []) => Array.isArray(value) ? value as T[] : fallback;

export function roomFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    slug: asString(row.slug),
    name: asString(row.name),
    shortDescription: asString(row.short_description),
    longDescription: asString(row.long_description),
    occupancy: asNumber(row.occupancy),
    bedType: asString(row.bed_type),
    images: asArray<string>(row.images),
    amenities: asArray<string>(row.amenities),
    policies: asArray<string>(row.policies),
    basePrice: asNumber(row.base_price),
    taxRate: asNumber(row.tax_rate ?? 0.13),
    isActive: asBoolean(row.is_active),
    inventoryCount: asNumber(row.base_inventory),
    cancellationTerms: asString(row.cancellation_terms),
    sortOrder: asNumber(row.sort_order),
  };
}

export function reservationFromRow(row: DbRow) {
  const roomLines = asArray<{
    roomTypeId: string;
    roomTypeName: string;
    roomSlug: string;
    rooms: number;
    subtotalAmount: number;
  }>(row.room_lines).map(line => ({
    roomTypeId: asString(line.roomTypeId),
    roomTypeName: asString(line.roomTypeName),
    roomSlug: asString(line.roomSlug),
    rooms: asNumber(line.rooms),
    subtotalAmount: asNumber(line.subtotalAmount),
  }));
  const roomTypeName = asString(row.room_type_name ?? row.name);
  const roomTypeSummary = roomLines.length
    ? roomLines.map(line => `${line.rooms} x ${line.roomTypeName}`).join(', ')
    : `${asNumber(row.rooms)} x ${roomTypeName}`;

  return {
    id: asString(row.id),
    confirmationNumber: asString(row.confirmation_number),
    roomTypeId: asString(row.room_type_id),
    roomTypeName,
    roomTypeSummary,
    roomLines,
    checkIn: row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : asString(row.check_in),
    checkOut: row.check_out instanceof Date ? row.check_out.toISOString().slice(0, 10) : asString(row.check_out),
    nights: asNumber(row.nights),
    guests: asNumber(row.guests),
    rooms: asNumber(row.rooms),
    guest: {
      firstName: asString(row.guest_first_name),
      lastName: asString(row.guest_last_name),
      email: asString(row.guest_email),
      phone: asString(row.guest_phone),
    },
    specialRequests: asString(row.special_requests),
    arrivalTime: asString(row.arrival_time),
    status: asString(row.status),
    paymentStatus: asString(row.payment_status),
    paymentMethod: asString(row.payment_method),
    totalAmount: centsToDollars(asNumber(row.total_cents)),
    taxAmount: centsToDollars(asNumber(row.tax_cents)),
    depositAmount: centsToDollars(asNumber(row.deposit_cents)),
    source: asString(row.source),
    notes: asArray<string>(row.notes),
    addedToMotelPro: asBoolean(row.added_to_motel_pro),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function paymentFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    reservationId: asString(row.reservation_id),
    confirmationNumber: asString(row.confirmation_number),
    guestName: `${asString(row.guest_first_name)} ${asString(row.guest_last_name)}`.trim(),
    roomTypeSummary: asString(row.room_type_summary),
    amount: centsToDollars(asNumber(row.amount_cents)),
    method: asString(row.payment_method),
    status: asString(row.status),
    stripeCheckoutSessionId: asString(row.stripe_checkout_session_id),
    stripePaymentIntentId: asString(row.stripe_payment_intent_id),
    cloverTransactionRef: asString(row.clover_payment_id),
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export function faqFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    question: asString(row.question),
    answer: asString(row.answer),
    category: asString(row.category),
    sortOrder: asNumber(row.sort_order),
  };
}

export function galleryImageFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    url: asString(row.url),
    alt: asString(row.alt),
    category: asString(row.category),
    sortOrder: asNumber(row.sort_order),
  };
}

export function reviewFromRow(row: DbRow) {
  const date = row.review_date instanceof Date ? row.review_date.toISOString().slice(0, 10) : asString(row.review_date);
  return {
    id: asString(row.id),
    guestName: asString(row.guest_name),
    rating: asNumber(row.rating),
    comment: asString(row.comment),
    date,
    source: asString(row.source),
    isFeatured: asBoolean(row.is_featured),
    sortOrder: asNumber(row.sort_order),
  };
}

export function attractionFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    name: asString(row.name),
    description: asString(row.description),
    distance: asString(row.distance),
    image: asString(row.image),
    category: asString(row.category),
    sortOrder: asNumber(row.sort_order),
  };
}

export function roomOptionFromRow(row: DbRow) {
  return {
    id: asString(row.id),
    label: asString(row.label),
    sortOrder: asNumber(row.sort_order),
  };
}

export function centsToDollars(cents: number): number {
  return Math.round(Number(cents)) / 100;
}

export async function audit(
  db: DbClient,
  input: {
    actorId?: string;
    entity: string;
    entityId?: string;
    action: string;
    before?: unknown;
    after?: unknown;
    meta?: unknown;
  },
) {
  await db.query(
    `insert into audit_log(actor_id, entity, entity_id, action, before, after, meta)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.actorId ?? null,
      input.entity,
      input.entityId ?? null,
      input.action,
      input.before ? JSON.stringify(input.before) : null,
      input.after ? JSON.stringify(input.after) : null,
      input.meta ? JSON.stringify(input.meta) : null,
    ],
  );
}
