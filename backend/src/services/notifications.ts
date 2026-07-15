import nodemailer from 'nodemailer';
import twilio from 'twilio';
import type { DbClient } from '../db.js';
import { config, mailConfigured, twilioConfigured } from '../config.js';
import { audit } from '../transformers.js';
import { AppError, badRequest, configurationError, conflict } from '../errors.js';

type NotificationChannel = 'email' | 'sms';
type NotificationStatus = 'sent' | 'failed' | 'skipped';

type RoomLine = {
  roomTypeName: string;
  rooms: number;
  subtotalCents: number;
};

type NightlyRate = {
  date: string;
  roomTypeName: string;
  rooms: number;
  rateCents: number;
};

type ReservationNotification = {
  id: string;
  confirmationNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  rooms: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  arrivalTime: string;
  specialRequests: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  createdAt: string;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string;
  stripeChargeId: string;
  stripeReceiptUrl: string;
  roomLines: RoomLine[];
  nightlyRates: NightlyRate[];
};

let mailTransport: nodemailer.Transporter | null = null;
let twilioClient: ReturnType<typeof twilio> | null = null;

export async function sendReservationConfirmationNotifications(db: DbClient, reservationId: string, receiptUrl?: string | null) {
  const reservation = await loadReservationNotification(db, reservationId, receiptUrl);
  if (!reservation) return;

  await sendStaffBookingEmail(db, reservation);
  await sendGuestBookingEmail(db, reservation);
  await sendGuestBookingSms(db, reservation);

  await audit(db, {
    entity: 'reservation',
    entityId: reservation.id,
    action: 'confirmation_notifications_processed',
    after: {
      confirmationNumber: reservation.confirmationNumber,
      guestEmail: reservation.guestEmail,
      guestPhone: reservation.guestPhone,
    },
  });
}

export async function resendReservationConfirmationNotifications(
  db: DbClient,
  confirmationNumber: string,
  templates: string[] = ['guest_booking_confirmed', 'guest_booking_confirmed_sms'],
) {
  const result = await db.query(
    `select id
     from reservations
     where lower(confirmation_number) = lower($1)
       and status = 'confirmed'
       and payment_status = 'paid'`,
    [confirmationNumber],
  );
  if (!result.rowCount) {
    throw new Error(`Confirmed and paid reservation was not found for ${confirmationNumber}.`);
  }

  const reservationId = String(result.rows[0].id);
  await db.query(
    `delete from notification_deliveries
     where reservation_id = $1
       and template_type = any($2::text[])
       and status <> 'sent'`,
    [reservationId, templates],
  );
  await sendReservationConfirmationNotifications(db, reservationId);
}

export async function sendReservationConfirmationCopy(
  db: DbClient,
  input: { confirmationNumber: string; lastName: string; email: string },
) {
  const result = await db.query(
    `select id, guest_email, status, payment_status
     from reservations
     where lower(confirmation_number) = lower($1)
       and lower(guest_last_name) = lower($2)`,
    [input.confirmationNumber, input.lastName],
  );

  if (!result.rowCount || String(result.rows[0].guest_email).toLowerCase() !== input.email.toLowerCase()) {
    throw badRequest('reservation_email_mismatch', 'The email does not match this reservation.');
  }
  if (result.rows[0].status !== 'confirmed' || result.rows[0].payment_status !== 'paid') {
    throw conflict('reservation_not_confirmed', 'Email confirmation is available after the reservation is confirmed and paid.');
  }
  if (!mailConfigured) {
    throw configurationError('Reservation email is temporarily unavailable. Please contact the hotel.');
  }

  const reservation = await loadReservationNotification(db, String(result.rows[0].id));
  if (!reservation) {
    throw new AppError(404, 'reservation_not_found', 'Reservation was not found.');
  }

  const subject = `Your Curtis Inn & Suites Reservation Confirmation - ${reservation.confirmationNumber}`;
  const text = guestEmailText(reservation);
  const html = guestEmailHtml(reservation);
  const delivery = await db.query(
    `insert into notification_deliveries(
       reservation_id, channel, template_type, recipient, subject, body_preview, status
     ) values ($1, 'email', 'guest_lookup_confirmation', $2, $3, $4, 'pending')
     on conflict (reservation_id, channel, template_type)
     do update set
       recipient = excluded.recipient,
       subject = excluded.subject,
       body_preview = excluded.body_preview,
       status = 'pending',
       provider_message_id = null,
       error_text = null,
       updated_at = now()
     where notification_deliveries.updated_at <= now() - interval '60 seconds'
     returning id`,
    [reservation.id, input.email, subject, text.slice(0, 500)],
  );

  if (!delivery.rowCount) {
    throw conflict('confirmation_email_cooldown', 'Confirmation was recently sent. Please wait one minute before trying again.');
  }

  const deliveryId = String(delivery.rows[0].id);
  let messageId: string;
  try {
    const sent = await getMailTransport().sendMail({
      from: config.MAIL_FROM,
      to: input.email,
      subject,
      text,
      html,
    });
    messageId = sent.messageId;
  } catch (error) {
    await finishDelivery(db, deliveryId, 'failed', undefined, errorMessage(error));
    throw new AppError(502, 'confirmation_email_failed', 'The confirmation email could not be sent. Please try again.');
  }

  await finishDelivery(db, deliveryId, 'sent', messageId);
  try {
    await audit(db, {
      entity: 'reservation',
      entityId: reservation.id,
      action: 'guest_confirmation_copy_sent',
      after: { recipient: input.email, confirmationNumber: reservation.confirmationNumber },
    });
  } catch (error) {
    console.error('guest_confirmation_copy_audit_failed', error);
  }
}

async function loadReservationNotification(db: DbClient, reservationId: string, receiptUrl?: string | null): Promise<ReservationNotification | null> {
  const result = await db.query(
    `select
       r.id,
       r.confirmation_number,
       r.check_in,
       r.check_out,
       r.nights,
       r.guests,
       r.rooms,
       r.guest_first_name,
       r.guest_last_name,
       r.guest_email,
       r.guest_phone,
       r.arrival_time,
       r.special_requests,
       r.subtotal_cents,
       r.tax_cents,
       r.total_cents,
       r.created_at,
       p.stripe_checkout_session_id,
       p.stripe_payment_intent_id,
       p.stripe_charge_id,
       coalesce($2, p.stripe_receipt_url, '') as stripe_receipt_url,
       coalesce(lines.room_lines, '[]'::json) as room_lines,
       coalesce(nights.nightly_rates, '[]'::json) as nightly_rates
     from reservations r
     left join lateral (
       select *
       from payments p
       where p.reservation_id = r.id and p.provider = 'stripe'
       order by p.created_at desc
       limit 1
     ) p on true
     left join lateral (
       select json_agg(json_build_object(
         'roomTypeName', rt.name,
         'rooms', l.rooms,
         'subtotalCents', l.subtotal_cents
       ) order by rt.sort_order, rt.name) as room_lines
       from reservation_room_lines l
       join room_types rt on rt.id = l.room_type_id
       where l.reservation_id = r.id
     ) lines on true
     left join lateral (
       select json_agg(json_build_object(
         'date', rn.stay_date,
         'roomTypeName', rt.name,
         'rooms', rn.rooms,
         'rateCents', rn.rate_cents
       ) order by rn.stay_date, rt.sort_order, rt.name) as nightly_rates
       from reservation_nights rn
       join room_types rt on rt.id = rn.room_type_id
       where rn.reservation_id = r.id
     ) nights on true
     where r.id = $1
       and r.status = 'confirmed'
       and r.payment_status = 'paid'`,
    [reservationId, receiptUrl ?? null],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    confirmationNumber: String(row.confirmation_number),
    checkIn: dateKey(row.check_in),
    checkOut: dateKey(row.check_out),
    nights: Number(row.nights),
    guests: Number(row.guests),
    rooms: Number(row.rooms),
    guestFirstName: String(row.guest_first_name),
    guestLastName: String(row.guest_last_name),
    guestEmail: String(row.guest_email),
    guestPhone: String(row.guest_phone),
    arrivalTime: String(row.arrival_time ?? ''),
    specialRequests: String(row.special_requests ?? ''),
    subtotalCents: Number(row.subtotal_cents),
    taxCents: Number(row.tax_cents),
    totalCents: Number(row.total_cents),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ''),
    stripeCheckoutSessionId: String(row.stripe_checkout_session_id ?? ''),
    stripePaymentIntentId: String(row.stripe_payment_intent_id ?? ''),
    stripeChargeId: String(row.stripe_charge_id ?? ''),
    stripeReceiptUrl: String(row.stripe_receipt_url ?? ''),
    roomLines: parseJsonArray<RoomLine>(row.room_lines),
    nightlyRates: parseJsonArray<NightlyRate>(row.nightly_rates).map(rate => ({
      ...rate,
      date: dateKey(rate.date),
      rooms: Number(rate.rooms),
      rateCents: Number(rate.rateCents),
    })),
  };
}

async function sendStaffBookingEmail(db: DbClient, reservation: ReservationNotification) {
  const subject = `Curtis Inn - New Booking - Arriving on ${formatDate(reservation.checkIn)}`;
  const text = staffEmailText(reservation);
  const html = staffEmailHtml(reservation);
  await sendEmailDelivery(db, {
    reservation,
    templateType: 'staff_booking_confirmed',
    to: config.HOTEL_NOTIFICATIONS_EMAIL,
    subject,
    text,
    html,
  });
}

async function sendGuestBookingEmail(db: DbClient, reservation: ReservationNotification) {
  const subject = `Your Curtis Inn & Suites Reservation Is Confirmed - ${reservation.confirmationNumber}`;
  const text = guestEmailText(reservation);
  const html = guestEmailHtml(reservation);
  await sendEmailDelivery(db, {
    reservation,
    templateType: 'guest_booking_confirmed',
    to: reservation.guestEmail,
    subject,
    text,
    html,
  });
}

async function sendGuestBookingSms(db: DbClient, reservation: ReservationNotification) {
  const body = `Curtis Inn confirmed ${reservation.confirmationNumber}: ${formatDate(reservation.checkIn)}-${formatDate(reservation.checkOut)}. Look up your booking at ${config.PUBLIC_SITE_URL} with confirmation number and last name. Help: (954) 555-0100. Reply STOP to opt out.`;
  const deliveryId = await claimDelivery(db, {
    reservation,
    channel: 'sms',
    templateType: 'guest_booking_confirmed_sms',
    recipient: reservation.guestPhone,
    subject: null,
    bodyPreview: body,
  });
  if (!deliveryId) return;

  if (!twilioConfigured) {
    await finishDelivery(db, deliveryId, 'skipped', undefined, 'Twilio is not configured.');
    return;
  }

  try {
    const client = getTwilioClient();
    const message = await client.messages.create({
      body,
      to: reservation.guestPhone,
      ...(config.TWILIO_MESSAGING_SERVICE_SID
        ? { messagingServiceSid: config.TWILIO_MESSAGING_SERVICE_SID }
        : { from: config.TWILIO_FROM_NUMBER }),
    });
    await finishDelivery(db, deliveryId, 'sent', message.sid);
  } catch (error) {
    await finishDelivery(db, deliveryId, 'failed', undefined, errorMessage(error));
  }
}

async function sendEmailDelivery(
  db: DbClient,
  input: {
    reservation: ReservationNotification;
    templateType: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  },
) {
  const deliveryId = await claimDelivery(db, {
    reservation: input.reservation,
    channel: 'email',
    templateType: input.templateType,
    recipient: input.to,
    subject: input.subject,
    bodyPreview: input.text.slice(0, 500),
  });
  if (!deliveryId) return;

  if (!mailConfigured) {
    await finishDelivery(db, deliveryId, 'skipped', undefined, 'SMTP email is not configured.');
    return;
  }

  try {
    const result = await getMailTransport().sendMail({
      from: config.MAIL_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    await finishDelivery(db, deliveryId, 'sent', result.messageId);
  } catch (error) {
    await finishDelivery(db, deliveryId, 'failed', undefined, errorMessage(error));
  }
}

async function claimDelivery(
  db: DbClient,
  input: {
    reservation: ReservationNotification;
    channel: NotificationChannel;
    templateType: string;
    recipient: string;
    subject: string | null;
    bodyPreview: string;
  },
) {
  const result = await db.query(
    `insert into notification_deliveries(
       reservation_id, channel, template_type, recipient, subject, body_preview, status
     ) values ($1, $2, $3, $4, $5, $6, 'pending')
     on conflict (reservation_id, channel, template_type) do nothing
     returning id`,
    [
      input.reservation.id,
      input.channel,
      input.templateType,
      input.recipient,
      input.subject,
      input.bodyPreview,
    ],
  );
  return result.rowCount ? String(result.rows[0].id) : null;
}

async function finishDelivery(db: DbClient, id: string, status: NotificationStatus, providerMessageId?: string, errorText?: string) {
  await db.query(
    `update notification_deliveries
     set status = $2::notification_status,
         provider_message_id = coalesce($3, provider_message_id),
         error_text = $4,
         sent_at = case when $2::notification_status = 'sent' then now() else sent_at end,
         updated_at = now()
     where id = $1`,
    [id, status, providerMessageId ?? null, errorText ?? null],
  );
  console.log(`notification_delivery ${id} ${status}${providerMessageId ? ` provider=${providerMessageId}` : ''}${errorText ? ` error=${errorText}` : ''}`);
}

function getMailTransport() {
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: config.GMAIL_SMTP_HOST,
      port: config.GMAIL_SMTP_PORT,
      secure: config.GMAIL_SMTP_PORT === 465,
      auth: {
        user: config.GMAIL_SMTP_USER,
        pass: config.GMAIL_SMTP_PASS,
      },
    });
  }
  return mailTransport;
}

function getTwilioClient() {
  if (!twilioClient) {
    twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

function staffEmailText(reservation: ReservationNotification) {
  return [
    'NOTICE: New Curtis Inn direct website reservation.',
    '',
    'New Reservation',
    'Guest has PRE-PAID',
    '',
    `Confirmation Number: ${reservation.confirmationNumber}`,
    `Guest: ${guestName(reservation)}`,
    `Guest Email: ${reservation.guestEmail}`,
    `Guest Phone: ${reservation.guestPhone}`,
    `Booked on: ${formatDateTime(reservation.createdAt)}`,
    `Room Type(s): ${roomSummary(reservation)}`,
    `Check-In: ${formatDate(reservation.checkIn)}`,
    `Check-Out: ${formatDate(reservation.checkOut)}`,
    `Guests: ${reservation.guests}`,
    `Rooms: ${reservation.rooms}`,
    `Room Nights: ${reservation.nights * reservation.rooms}`,
    `Arrival Time: ${reservation.arrivalTime || 'Not provided'}`,
    '',
    'Daily Rates:',
    ...reservation.nightlyRates.map(rate => `${formatDate(rate.date)} - ${rate.rooms} x ${rate.roomTypeName}: ${money(rate.rateCents)} per room`),
    '',
    `Subtotal: ${money(reservation.subtotalCents)}`,
    `Taxes: ${money(reservation.taxCents)}`,
    `Total Paid: ${money(reservation.totalCents)}`,
    '',
    'Billing Details:',
    `Stripe Checkout Session: ${reservation.stripeCheckoutSessionId || '-'}`,
    `Stripe Payment Intent: ${reservation.stripePaymentIntentId || '-'}`,
    `Stripe Charge: ${reservation.stripeChargeId || '-'}`,
    reservation.stripeReceiptUrl ? `Stripe Receipt: ${reservation.stripeReceiptUrl}` : 'Stripe Receipt: Stripe will email the guest receipt.',
    '',
    'Special Requests:',
    reservation.specialRequests || 'None',
    '',
    'Notes & Instructions:',
    'Payment was collected through Stripe. Please print and file this reservation notice.',
  ].join('\n');
}

function staffEmailHtml(reservation: ReservationNotification) {
  const rows: [string, string][] = [
    ['Confirmation Number', reservation.confirmationNumber],
    ['Guest', guestName(reservation)],
    ['Guest Email', reservation.guestEmail],
    ['Guest Phone', reservation.guestPhone],
    ['Booked on', formatDateTime(reservation.createdAt)],
    ['Room Type(s)', roomSummary(reservation)],
    ['Check-In', formatDate(reservation.checkIn)],
    ['Check-Out', formatDate(reservation.checkOut)],
    ['Guests', String(reservation.guests)],
    ['Rooms', String(reservation.rooms)],
    ['Room Nights', String(reservation.nights * reservation.rooms)],
    ['Arrival Time', reservation.arrivalTime || 'Not provided'],
    ['Subtotal', money(reservation.subtotalCents)],
    ['Taxes', money(reservation.taxCents)],
    ['Total Paid', money(reservation.totalCents)],
    ['Stripe Checkout Session', reservation.stripeCheckoutSessionId || '-'],
    ['Stripe Payment Intent', reservation.stripePaymentIntentId || '-'],
    ['Stripe Charge', reservation.stripeChargeId || '-'],
  ];
  return baseHtml(`
    <p style="font-size:12px;color:#444;">NOTICE: New Curtis Inn direct website reservation.</p>
    <h2 style="color:#e79f2f;margin-bottom:8px;">New Reservation</h2>
    <div style="background:#004b7a;color:#fff;padding:10px 16px;border-radius:22px;text-align:center;font-weight:bold;">Guest has PRE-PAID</div>
    ${tableHtml(rows)}
    <h3>Daily Rates</h3>
    ${tableHtml(reservation.nightlyRates.map(rate => [formatDate(rate.date), `${rate.rooms} x ${rate.roomTypeName} at ${money(rate.rateCents)} per room`] as [string, string]))}
    <h3>Special Requests</h3>
    <p>${escapeHtml(reservation.specialRequests || 'None')}</p>
    <h3>Notes & Instructions</h3>
    <p>Payment was collected through Stripe. Please print and file this reservation notice.</p>
    ${reservation.stripeReceiptUrl ? `<p><a href="${escapeHtml(reservation.stripeReceiptUrl)}">View Stripe receipt</a></p>` : ''}
  `);
}

function guestEmailText(reservation: ReservationNotification) {
  return [
    `Hi ${reservation.guestFirstName},`,
    '',
    'Your Curtis Inn & Suites reservation is confirmed and paid.',
    '',
    `Confirmation Number: ${reservation.confirmationNumber}`,
    `Last Name for lookup: ${reservation.guestLastName}`,
    `Dates: ${formatDate(reservation.checkIn)} to ${formatDate(reservation.checkOut)}`,
    `Room Type(s): ${roomSummary(reservation)}`,
    `Guests: ${reservation.guests}`,
    `Total Paid: ${money(reservation.totalCents)}`,
    reservation.stripeReceiptUrl ? `Stripe Receipt: ${reservation.stripeReceiptUrl}` : 'Stripe will send your payment receipt by email.',
    '',
    `You can check your reservation at ${config.PUBLIC_SITE_URL} using your confirmation number and last name.`,
    '',
    'Hotel details:',
    'Curtis Inn & Suites',
    '1501 S Federal Hwy, Hollywood, FL',
    'Phone: (954) 555-0100',
    'Email: curtisinn200@gmail.com',
    'Check-in: 3:00 PM',
    'Check-out: 11:00 AM',
    '',
    'Thank you for booking directly with Curtis Inn & Suites.',
  ].join('\n');
}

function guestEmailHtml(reservation: ReservationNotification) {
  return baseHtml(`
    <h2>Your reservation is confirmed</h2>
    <p>Hi ${escapeHtml(reservation.guestFirstName)}, your Curtis Inn & Suites reservation is confirmed and paid.</p>
    ${tableHtml([
      ['Confirmation Number', reservation.confirmationNumber],
      ['Last Name for Lookup', reservation.guestLastName],
      ['Dates', `${formatDate(reservation.checkIn)} to ${formatDate(reservation.checkOut)}`],
      ['Room Type(s)', roomSummary(reservation)],
      ['Guests', String(reservation.guests)],
      ['Total Paid', money(reservation.totalCents)],
    ])}
    <p>You can check your reservation at <a href="${escapeHtml(config.PUBLIC_SITE_URL)}">${escapeHtml(config.PUBLIC_SITE_URL)}</a> using your confirmation number and last name.</p>
    ${reservation.stripeReceiptUrl ? `<p><a href="${escapeHtml(reservation.stripeReceiptUrl)}">View Stripe receipt</a></p>` : '<p>Stripe will send your payment receipt by email.</p>'}
    <h3>Hotel details</h3>
    <p>Curtis Inn & Suites<br>1501 S Federal Hwy, Hollywood, FL<br>Phone: (954) 555-0100<br>Email: curtisinn200@gmail.com</p>
    <p>Check-in: 3:00 PM<br>Check-out: 11:00 AM</p>
  `);
}

function baseHtml(body: string) {
  return `<!doctype html>
    <html>
      <body style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.45;">
        <div style="max-width:720px;margin:0 auto;padding:20px;">
          <h1 style="margin:0 0 6px;">Curtis Inn & Suites</h1>
          <p style="margin:0 0 18px;color:#64748b;">Hollywood, FL, USA</p>
          ${body}
        </div>
      </body>
    </html>`;
}

function tableHtml(rows: [string, string][]) {
  return `<table style="border-collapse:collapse;width:100%;margin:16px 0;">${rows.map(([label, value]) => `
    <tr>
      <td style="border:1px solid #d9e2ec;padding:8px;font-weight:bold;width:34%;">${escapeHtml(label)}</td>
      <td style="border:1px solid #d9e2ec;padding:8px;">${escapeHtml(value)}</td>
    </tr>`).join('')}</table>`;
}

function roomSummary(reservation: ReservationNotification) {
  return reservation.roomLines.length
    ? reservation.roomLines.map(line => `${line.rooms} x ${line.roomTypeName}`).join(', ')
    : `${reservation.rooms} room${reservation.rooms === 1 ? '' : 's'}`;
}

function guestName(reservation: ReservationNotification) {
  return `${reservation.guestFirstName} ${reservation.guestLastName}`.trim();
}

function dateKey(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
    timeZoneName: 'short',
  }).format(date);
}

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(cents) / 100);
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseJsonArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed as T[] : [];
    } catch {
      return [];
    }
  }
  return [];
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown notification error.';
}
