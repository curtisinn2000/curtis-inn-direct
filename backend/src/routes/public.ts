import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db.js';
import { asyncHandler } from '../middleware.js';
import {
  availabilitySearchSchema,
  availabilityQuoteSchema,
  createReservationSchema,
  lookupReservationSchema,
  sendReservationConfirmationEmailSchema,
  validatePromoSchema,
} from '../schemas.js';
import { getActiveRooms, getRoomBySlug } from '../services/rooms.js';
import { searchAvailability } from '../services/availability.js';
import { createReservation, lookupReservation, quoteReservation } from '../services/reservations.js';
import { notFound } from '../errors.js';
import { getWebsiteContent } from '../services/content.js';
import { sendReservationConfirmationCopy } from '../services/notifications.js';
import { loadVerifiedReservationConfirmation } from '../services/notifications.js';
import { createReservationConfirmationPdf } from '../services/confirmationPdf.js';
import { audit } from '../transformers.js';

export const publicRouter = Router();

const publicWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const confirmationEmailLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'confirmation_email_rate_limited',
      message: 'Too many email requests. Please wait and try again.',
    },
  },
});

const confirmationPdfLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'confirmation_pdf_rate_limited',
      message: 'Too many PDF requests. Please wait and try again.',
    },
  },
});

publicRouter.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'curtis-inn-backend' });
});

publicRouter.get('/rooms', asyncHandler(async (_req, res) => {
  res.json(await getActiveRooms(pool));
}));

publicRouter.get('/rooms/:slug', asyncHandler(async (req, res) => {
  const room = await getRoomBySlug(pool, String(req.params.slug));
  if (!room) throw notFound('room_not_found', 'Room type was not found.');
  res.json(room);
}));

publicRouter.get('/content', asyncHandler(async (_req, res) => {
  res.json(await getWebsiteContent(pool));
}));

publicRouter.post('/availability/search', asyncHandler(async (req, res) => {
  const input = availabilitySearchSchema.parse(req.body);
  res.json(await searchAvailability(pool, input));
}));

publicRouter.post('/availability/quote', asyncHandler(async (req, res) => {
  const input = availabilityQuoteSchema.parse(req.body);
  res.json(await quoteReservation({
    search: input.search,
    items: input.items,
    guestInfo: { firstName: 'Quote', lastName: 'Only', email: 'quote@example.com', phone: '0000000' },
    specialRequests: '',
    arrivalTime: '',
    paymentMethod: 'stripe_pay_now',
  }));
}));

publicRouter.post('/reservations', publicWriteLimiter, asyncHandler(async (req, res) => {
  const parsed = createReservationSchema.parse(req.body);
  const roomSlug = parsed.roomSlug ?? parsed.selectedRoom?.roomType.slug;
  const reservation = await createReservation({
    idempotencyKey: parsed.idempotencyKey,
    roomTypeId: parsed.roomTypeId,
    roomSlug,
    items: parsed.items,
    search: parsed.search,
    guestInfo: parsed.guestInfo,
    specialRequests: parsed.specialRequests,
    arrivalTime: parsed.arrivalTime,
    paymentMethod: parsed.paymentMethod,
    promoCode: parsed.promoCode,
  });
  res.status(201).json(reservation);
}));

publicRouter.post('/reservations/lookup', publicWriteLimiter, asyncHandler(async (req, res) => {
  const input = lookupReservationSchema.parse(req.body);
  const result = await lookupReservation(pool, input.confirmationNumber, input.lastName);
  res.json(result);
}));

publicRouter.post('/reservations/confirmation-email', confirmationEmailLimiter, asyncHandler(async (req, res) => {
  const input = sendReservationConfirmationEmailSchema.parse(req.body);
  await sendReservationConfirmationCopy(pool, input);
  res.json({ ok: true, message: 'Reservation confirmation sent.' });
}));

publicRouter.post('/reservations/confirmation-pdf', confirmationPdfLimiter, asyncHandler(async (req, res) => {
  const input = lookupReservationSchema.parse(req.body);
  const reservation = await loadVerifiedReservationConfirmation(pool, input.confirmationNumber, input.lastName);
  const pdf = await createReservationConfirmationPdf(reservation);
  const safeConfirmationNumber = reservation.confirmationNumber.replace(/[^A-Za-z0-9-]/g, '');

  try {
    await audit(pool, {
      entity: 'reservation',
      entityId: reservation.id,
      action: 'guest_confirmation_pdf_downloaded',
      after: { confirmationNumber: reservation.confirmationNumber },
    });
  } catch (error) {
    console.error('guest_confirmation_pdf_audit_failed', error);
  }

  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="Curtis-Inn-Reservation-${safeConfirmationNumber}.pdf"`,
    'Content-Length': String(pdf.length),
    'Cache-Control': 'no-store, max-age=0',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  res.send(pdf);
}));

publicRouter.post('/promo/validate', asyncHandler(async (req, res) => {
  const input = validatePromoSchema.parse(req.body);
  const result = await pool.query(
    `select * from promo_codes
     where lower(code) = lower($1)
       and is_active = true
       and (valid_from is null or valid_from <= current_date)
       and (valid_to is null or valid_to >= current_date)
       and (max_uses is null or uses < max_uses)`,
    [input.code],
  );

  if (!result.rowCount) return res.json(null);
  const row = result.rows[0];
  res.json({
    id: row.id,
    code: row.code,
    description: row.description,
    discountType: row.kind === 'percent' ? 'percentage' : 'fixed',
    discountValue: row.kind === 'percent' ? row.value : row.value / 100,
    validFrom: row.valid_from,
    validTo: row.valid_to,
    maxUses: row.max_uses,
    currentUses: row.uses,
    isActive: row.is_active,
  });
}));
