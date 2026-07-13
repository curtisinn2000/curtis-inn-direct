import Stripe from 'stripe';
import type { DbClient } from '../db.js';
import { config, stripeConfigured } from '../config.js';
import { configurationError, notFound } from '../errors.js';
import { audit } from '../transformers.js';

let stripeClient: Stripe | null = null;

export function getStripeClient() {
  if (!stripeConfigured) {
    throw configurationError('Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(config.STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

export async function createStripeCheckoutSession(db: DbClient, reservationId: string) {
  const result = await db.query(
    `select
       p.id as payment_id,
       p.amount_cents,
       p.status as payment_row_status,
       r.id as reservation_id,
       r.confirmation_number,
       r.guest_email,
       r.guest_first_name,
       r.guest_last_name,
       r.check_in,
       r.check_out,
       coalesce(lines.room_type_summary, rt.name) as room_type_name
     from payments p
     join reservations r on r.id = p.reservation_id
     join room_types rt on rt.id = r.room_type_id
     left join lateral (
       select string_agg(l.rooms || ' x ' || lrt.name, ', ' order by lrt.sort_order, lrt.name) as room_type_summary
       from reservation_room_lines l
       join room_types lrt on lrt.id = l.room_type_id
       where l.reservation_id = r.id
     ) lines on true
     where p.reservation_id = $1
       and p.provider = 'stripe'
       and p.status = 'unpaid'
     order by p.created_at desc
     limit 1`,
    [reservationId],
  );

  if (!result.rowCount) {
    throw notFound('payment_not_found', 'No unpaid Stripe payment was found for this reservation.');
  }

  const row = result.rows[0];
  const stripe = getStripeClient();
  const redirectParams = new URLSearchParams({
    conf: row.confirmation_number,
    room: row.room_type_name,
    checkIn: row.check_in instanceof Date ? row.check_in.toISOString().slice(0, 10) : String(row.check_in),
    checkOut: row.check_out instanceof Date ? row.check_out.toISOString().slice(0, 10) : String(row.check_out),
    total: (Number(row.amount_cents) / 100).toFixed(2),
  });
  const successUrl = `${config.PUBLIC_SITE_URL}/booking/confirmation?${redirectParams.toString()}&session_id={CHECKOUT_SESSION_ID}&status=success`;
  const cancelUrl = `${config.PUBLIC_SITE_URL}/booking/confirmation?${redirectParams.toString()}&status=payment_cancelled`;
  const description = `${row.check_in} to ${row.check_out}`;
  const guestName = `${row.guest_first_name} ${row.guest_last_name}`.trim();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: row.guest_email,
    client_reference_id: row.reservation_id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Number(row.amount_cents),
          product_data: {
            name: `Curtis Inn reservation ${row.confirmation_number}`,
            description: `${row.room_type_name} - ${description}`,
          },
        },
      },
    ],
    metadata: {
      reservationId: row.reservation_id,
      paymentId: row.payment_id,
      confirmationNumber: row.confirmation_number,
      guestName,
    },
    payment_intent_data: {
      receipt_email: row.guest_email,
      description: `Curtis Inn reservation ${row.confirmation_number}`,
      metadata: {
        reservationId: row.reservation_id,
        paymentId: row.payment_id,
        confirmationNumber: row.confirmation_number,
      },
    },
  });

  await db.query(
    `update payments
     set stripe_checkout_session_id = $1, updated_at = now()
     where id = $2`,
    [session.id, row.payment_id],
  );

  return {
    sessionId: session.id,
    sessionUrl: session.url,
  };
}

export async function fulfillStripeCheckoutSession(db: DbClient, session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId ?? session.client_reference_id;
  const paymentId = session.metadata?.paymentId;

  if (!reservationId || !paymentId) {
    throw new Error(`Stripe session ${session.id} is missing reservation metadata.`);
  }

  const paymentStatus = session.payment_status === 'paid' ? 'paid' : 'unpaid';
  const reservationStatus = paymentStatus === 'paid' ? 'confirmed' : 'pending';
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  const payment = await db.query(
    `update payments
     set status = $1,
         stripe_checkout_session_id = $2,
         stripe_payment_intent_id = coalesce($3, stripe_payment_intent_id),
         updated_at = now()
     where id = $4
       and reservation_id = $5
       and provider = 'stripe'
     returning id, reservation_id, status`,
    [paymentStatus, session.id, paymentIntentId, paymentId, reservationId],
  );

  if (!payment.rowCount) {
    throw notFound('payment_not_found', 'Stripe payment record was not found.');
  }

  const reservation = await db.query(
    `update reservations
     set status = $1,
         payment_status = $2,
         updated_at = now()
     where id = $3
     returning confirmation_number`,
    [reservationStatus, paymentStatus, reservationId],
  );

  if (!reservation.rowCount) {
    throw notFound('reservation_not_found', 'Reservation was not found for Stripe session.');
  }

  await audit(db, {
    entity: 'payment',
    entityId: paymentId,
    action: paymentStatus === 'paid' ? 'stripe_paid' : 'stripe_session_completed_unpaid',
    after: {
      reservationId,
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      paymentStatus,
      reservationStatus,
    },
  });

  return {
    reservationId,
    paymentId,
    paymentStatus,
  };
}

export async function storeStripeReceiptDetails(db: DbClient, session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId ?? session.client_reference_id;
  const paymentId = session.metadata?.paymentId;
  const paymentIntentId = typeof session.payment_intent === 'string'
    ? session.payment_intent
    : session.payment_intent?.id ?? null;

  if (!reservationId || !paymentId || !paymentIntentId) {
    return { receiptUrl: null };
  }

  const stripe = getStripeClient();
  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
  const latestCharge = paymentIntent.latest_charge;
  const charge = typeof latestCharge === 'string' ? null : latestCharge;
  const chargeId = typeof latestCharge === 'string' ? latestCharge : charge?.id ?? null;
  const receiptUrl = charge?.receipt_url ?? null;

  await db.query(
    `update payments
     set stripe_payment_intent_id = $1,
         stripe_charge_id = coalesce($2, stripe_charge_id),
         stripe_receipt_url = coalesce($3, stripe_receipt_url),
         updated_at = now()
     where id = $4
       and reservation_id = $5
       and provider = 'stripe'`,
    [paymentIntentId, chargeId, receiptUrl, paymentId, reservationId],
  );

  return { receiptUrl };
}

export async function markStripeSessionFailed(db: DbClient, session: Stripe.Checkout.Session, action: string) {
  const reservationId = session.metadata?.reservationId ?? session.client_reference_id;
  const paymentId = session.metadata?.paymentId;
  if (!reservationId || !paymentId) return;

  await db.query(
    `update payments
     set status = 'failed',
         stripe_checkout_session_id = $1,
         updated_at = now()
     where id = $2
       and reservation_id = $3
       and provider = 'stripe'
       and status = 'unpaid'`,
    [session.id, paymentId, reservationId],
  );

  await audit(db, {
    entity: 'payment',
    entityId: paymentId,
    action,
    after: { reservationId, stripeCheckoutSessionId: session.id },
  });
}
