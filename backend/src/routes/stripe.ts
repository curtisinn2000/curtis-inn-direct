import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type Stripe from 'stripe';
import { pool, withTransaction } from '../db.js';
import { asyncHandler } from '../middleware.js';
import { badRequest, configurationError } from '../errors.js';
import {
  createStripeCheckoutSession,
  fulfillStripeCheckoutSession,
  getStripeClient,
  markStripeSessionFailed,
} from '../services/stripe.js';
import { config, stripeConfigured } from '../config.js';

export const stripeRouter = Router();
export const stripeWebhookRouter = Router();

const stripeWriteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

stripeRouter.post('/session', stripeWriteLimiter, asyncHandler(async (req, res) => {
  const reservationId = String(req.body.reservationId ?? '');
  if (!reservationId) throw badRequest('reservation_required', 'Reservation ID is required.');

  const session = await createStripeCheckoutSession(pool, reservationId);
  res.json(session);
}));

stripeWebhookRouter.post('/', asyncHandler(async (req, res) => {
  if (!stripeConfigured) throw configurationError('Stripe webhook secret is not configured.');

  const signature = req.header('stripe-signature');
  if (!signature) throw badRequest('missing_signature', 'Stripe signature is required.');
  if (!Buffer.isBuffer(req.body)) throw badRequest('invalid_webhook_body', 'Stripe webhook requires a raw request body.');

  const stripe = getStripeClient();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw badRequest('invalid_signature', 'Stripe webhook signature verification failed.');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await withTransaction(async client => {
        await fulfillStripeCheckoutSession(client, session);
      });
      break;
    }
    case 'checkout.session.expired':
    case 'checkout.session.async_payment_failed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await withTransaction(async client => {
        await markStripeSessionFailed(client, session, event.type.replace(/\./g, '_'));
      });
      break;
    }
    default:
      break;
  }

  res.json({ received: true });
}));
