import crypto from 'node:crypto';
import type { DbClient } from '../db.js';
import { withTransaction } from '../db.js';
import { config } from '../config.js';
import { eachStayDate } from '../date-utils.js';
import { conflict } from '../errors.js';
import { audit, reservationFromRow } from '../transformers.js';
import { lockRoomDates, priceAndAvailabilityForRoom, validateStayWindow } from './availability.js';
import { resolveRoom } from './rooms.js';

export type CreateReservationInput = {
  idempotencyKey?: string;
  roomTypeId?: string;
  roomSlug?: string;
  search: {
    checkIn: string;
    checkOut: string;
    guests: number;
    rooms: number;
  };
  guestInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  specialRequests: string;
  arrivalTime: string;
  paymentMethod: 'stripe_pay_now';
  promoCode?: string;
};

export async function createReservation(input: CreateReservationInput) {
  return withTransaction(async client => {
    if (input.idempotencyKey) {
      const existing = await client.query(
        `select r.*, rt.name as room_type_name
         from reservations r
         join room_types rt on rt.id = r.room_type_id
         where r.idempotency_key = $1`,
        [input.idempotencyKey],
      );
      if (existing.rowCount) return reservationFromRow(existing.rows[0]);
    }

    validateStayWindow(input.search);
    const room = await resolveRoom(client, { roomTypeId: input.roomTypeId, roomSlug: input.roomSlug });
    const stayDates = eachStayDate(input.search.checkIn, input.search.checkOut);
    await lockRoomDates(client, room.id, stayDates);

    const availability = await priceAndAvailabilityForRoom(client, {
      roomId: room.id,
      basePrice: room.base_price,
      baseInventory: room.base_inventory,
      checkIn: input.search.checkIn,
      checkOut: input.search.checkOut,
      roomsNeeded: input.search.rooms,
    });

    if (!availability.bookable) {
      throw conflict('sold_out', 'The selected room is no longer available for those dates.', {
        remaining: availability.minRemaining,
      });
    }

    const taxCents = Math.round(availability.subtotalCents * config.TAX_RATE);
    const totalCents = availability.subtotalCents + taxCents;
    const depositCents = 0;

    const confirmationNumber = await issueConfirmationNumber(client);
    const reservationResult = await client.query(
      `insert into reservations (
        confirmation_number, room_type_id, check_in, check_out, guests, rooms,
        guest_first_name, guest_last_name, guest_email, guest_phone,
        arrival_time, special_requests, status, payment_status, payment_method,
        subtotal_cents, tax_cents, deposit_cents, total_cents, source, idempotency_key
       ) values (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14, $15,
        $16, $17, $18, $19, 'direct_website', $20
       )
       returning *`,
      [
        confirmationNumber,
        room.id,
        input.search.checkIn,
        input.search.checkOut,
        input.search.guests,
        input.search.rooms,
        input.guestInfo.firstName,
        input.guestInfo.lastName,
        input.guestInfo.email,
        input.guestInfo.phone,
        input.arrivalTime,
        input.specialRequests,
        'pending',
        'unpaid',
        input.paymentMethod,
        availability.subtotalCents,
        taxCents,
        depositCents,
        totalCents,
        input.idempotencyKey ?? null,
      ],
    );
    const reservation = reservationResult.rows[0];

    for (const night of availability.nightlyRates) {
      await client.query(
        `insert into reservation_nights(reservation_id, room_type_id, stay_date, rooms, rate_cents)
         values ($1, $2, $3, $4, $5)`,
        [reservation.id, room.id, night.date, input.search.rooms, night.rateCents],
      );
    }

    await client.query(
      `insert into payments(reservation_id, kind, amount_cents, provider, status)
       values ($1, 'full', $2, 'stripe', 'unpaid')`,
      [reservation.id, totalCents],
    );

    await audit(client, {
      entity: 'reservation',
      entityId: reservation.id,
      action: 'create',
      after: { confirmationNumber, paymentMethod: input.paymentMethod },
    });

    return reservationFromRow({ ...reservation, room_type_name: room.name });
  });
}

async function issueConfirmationNumber(db: DbClient) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const suffix = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const confirmation = `CIS-${suffix}`;
    const exists = await db.query(`select 1 from reservations where confirmation_number = $1`, [confirmation]);
    if (exists.rowCount === 0) return confirmation;
  }
  return `CIS-${Date.now().toString().slice(-8)}`;
}

export async function lookupReservation(db: DbClient, confirmationNumber: string, lastName: string) {
  const result = await db.query(
    `select r.*, rt.name as room_type_name
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     where lower(r.confirmation_number) = lower($1)
       and lower(r.guest_last_name) = lower($2)`,
    [confirmationNumber, lastName],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    confirmationNumber: row.confirmation_number,
    guestName: `${row.guest_first_name} ${row.guest_last_name}`,
    checkIn: row.check_in,
    checkOut: row.check_out,
    guests: row.guests,
    roomType: row.room_type_name,
    status: row.status,
    paymentStatus: row.payment_status,
    totalAmount: row.total_cents / 100,
    propertyPhone: '(954) 555-0100',
    propertyEmail: 'curtisinn200@gmail.com',
  };
}
