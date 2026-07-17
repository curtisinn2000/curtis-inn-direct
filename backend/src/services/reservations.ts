import type { DbClient } from '../db.js';
import { withTransaction } from '../db.js';
import { config } from '../config.js';
import { dateOnlyKey, eachStayDate, hotelTodayKey } from '../date-utils.js';
import { badRequest, conflict } from '../errors.js';
import { audit, reservationFromRow } from '../transformers.js';
import { lockRoomDates, priceAndAvailabilityForRoom, validateStayWindow } from './availability.js';
import { resolveRoom } from './rooms.js';

export type BookingItemInput = {
  roomTypeId?: string;
  roomSlug?: string;
  rooms: number;
};

export type CreateReservationInput = {
  idempotencyKey?: string;
  roomTypeId?: string;
  roomSlug?: string;
  items?: BookingItemInput[];
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

type PricedCartLine = {
  room: {
    id: string;
    slug: string;
    name: string;
    occupancy: number;
    base_price: number;
    base_inventory: number;
  };
  rooms: number;
  subtotalCents: number;
  nightlyRates: { date: string; rateCents: number }[];
};

function normalizeBookingItems(input: CreateReservationInput): BookingItemInput[] {
  const items = input.items?.length
    ? input.items
    : [{ roomTypeId: input.roomTypeId, roomSlug: input.roomSlug, rooms: input.search.rooms }];

  const combined = new Map<string, BookingItemInput>();
  for (const item of items) {
    const key = item.roomTypeId ? `id:${item.roomTypeId}` : `slug:${item.roomSlug}`;
    const current = combined.get(key);
    combined.set(key, {
      roomTypeId: item.roomTypeId,
      roomSlug: item.roomSlug,
      rooms: (current?.rooms ?? 0) + item.rooms,
    });
  }
  return [...combined.values()];
}

async function priceCart(db: DbClient, input: CreateReservationInput) {
  const nights = validateStayWindow(input.search);
  const items = normalizeBookingItems(input);
  const totalRooms = items.reduce((sum, item) => sum + item.rooms, 0);
  if (totalRooms !== input.search.rooms) {
    throw badRequest('room_count_mismatch', 'Selected rooms must match the requested room count.', {
      requestedRooms: input.search.rooms,
      selectedRooms: totalRooms,
    });
  }

  const lines: PricedCartLine[] = [];
  let subtotalCents = 0;
  let totalCapacity = 0;

  for (const item of items) {
    const room = await resolveRoom(db, { roomTypeId: item.roomTypeId, roomSlug: item.roomSlug });
    totalCapacity += Number(room.occupancy) * item.rooms;
    const availability = await priceAndAvailabilityForRoom(db, {
      roomId: room.id,
      basePrice: room.base_price,
      baseInventory: room.base_inventory,
      checkIn: input.search.checkIn,
      checkOut: input.search.checkOut,
      roomsNeeded: item.rooms,
    });

    if (!availability.bookable) {
      throw conflict('sold_out', `${room.name} is no longer available for those dates.`, {
        roomTypeId: room.id,
        roomName: room.name,
        requested: item.rooms,
        remaining: availability.minRemaining,
      });
    }

    subtotalCents += availability.subtotalCents;
    lines.push({
      room,
      rooms: item.rooms,
      subtotalCents: availability.subtotalCents,
      nightlyRates: availability.nightlyRates,
    });
  }

  if (totalCapacity < input.search.guests) {
    throw badRequest('guest_capacity_exceeded', 'Selected rooms do not have enough guest capacity.', {
      guests: input.search.guests,
      capacity: totalCapacity,
    });
  }

  const taxCents = Math.round(subtotalCents * config.TAX_RATE);
  return {
    nights,
    lines,
    totalRooms,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
  };
}

export async function quoteReservation(input: CreateReservationInput) {
  return withTransaction(async client => {
    const quote = await priceCart(client, input);
    return {
      nights: quote.nights,
      totalRooms: quote.totalRooms,
      totalRate: quote.subtotalCents / 100,
      taxes: quote.taxCents / 100,
      grandTotal: quote.totalCents / 100,
      lines: quote.lines.map(line => ({
        roomType: {
          id: String(line.room.id),
          slug: String(line.room.slug),
          name: String(line.room.name),
        },
        rooms: line.rooms,
        subtotalAmount: line.subtotalCents / 100,
      })),
    };
  });
}

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

    const items = normalizeBookingItems(input);
    const stayDates = eachStayDate(input.search.checkIn, input.search.checkOut);
    const roomIdsToLock = new Set<string>();
    for (const item of items) {
      const room = await resolveRoom(client, { roomTypeId: item.roomTypeId, roomSlug: item.roomSlug });
      roomIdsToLock.add(String(room.id));
    }
    for (const roomId of [...roomIdsToLock].sort()) {
      await lockRoomDates(client, roomId, stayDates);
    }

    const quote = await priceCart(client, input);
    const primaryLine = quote.lines[0];
    const roomTypeSummary = quote.lines.map(line => `${line.rooms} x ${line.room.name}`).join(', ');
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
        primaryLine.room.id,
        input.search.checkIn,
        input.search.checkOut,
        input.search.guests,
        quote.totalRooms,
        input.guestInfo.firstName,
        input.guestInfo.lastName,
        input.guestInfo.email,
        input.guestInfo.phone,
        input.arrivalTime,
        input.specialRequests,
        'pending',
        'unpaid',
        input.paymentMethod,
        quote.subtotalCents,
        quote.taxCents,
        depositCents,
        quote.totalCents,
        input.idempotencyKey ?? null,
      ],
    );
    const reservation = reservationResult.rows[0];

    for (const line of quote.lines) {
      await client.query(
        `insert into reservation_room_lines(reservation_id, room_type_id, rooms, subtotal_cents)
         values ($1, $2, $3, $4)`,
        [reservation.id, line.room.id, line.rooms, line.subtotalCents],
      );
      for (const night of line.nightlyRates) {
        await client.query(
          `insert into reservation_nights(reservation_id, room_type_id, stay_date, rooms, rate_cents)
           values ($1, $2, $3, $4, $5)`,
          [reservation.id, line.room.id, night.date, line.rooms, night.rateCents],
        );
      }
    }

    await client.query(
      `insert into payments(reservation_id, kind, amount_cents, provider, status)
       values ($1, 'full', $2, 'stripe', 'unpaid')`,
      [reservation.id, quote.totalCents],
    );

    await audit(client, {
      entity: 'reservation',
      entityId: reservation.id,
      action: 'create',
      after: { confirmationNumber, paymentMethod: input.paymentMethod, roomTypeSummary },
    });

    return reservationFromRow({
      ...reservation,
      room_type_name: primaryLine.room.name,
      room_lines: quote.lines.map(line => ({
        roomTypeId: String(line.room.id),
        roomTypeName: String(line.room.name),
        roomSlug: String(line.room.slug),
        rooms: line.rooms,
        subtotalAmount: line.subtotalCents / 100,
      })),
    });
  });
}

async function issueConfirmationNumber(db: DbClient) {
  const issueDate = hotelTodayKey();
  const compactDate = issueDate.replaceAll('-', '');

  for (let attempt = 0; attempt < 10; attempt++) {
    const result = await db.query(
      `insert into confirmation_sequences(confirmation_date, last_value, updated_at)
       values ($1, 1, now())
       on conflict (confirmation_date)
       do update set
         last_value = confirmation_sequences.last_value + 1,
         updated_at = now()
       returning last_value`,
      [issueDate],
    );
    const sequence = Number(result.rows[0].last_value);
    const confirmation = `CIS-${compactDate}-${String(sequence).padStart(7, '0')}`;
    const exists = await db.query(`select 1 from reservations where confirmation_number = $1`, [confirmation]);
    if (exists.rowCount === 0) return confirmation;
  }

  throw conflict('confirmation_number_exhausted', 'Unable to issue a unique confirmation number. Please try again.');
}

export async function lookupReservation(db: DbClient, confirmationNumber: string, lastName: string) {
  const result = await db.query(
    `select r.*, rt.name as room_type_name,
       coalesce(lines.room_type_summary, r.rooms || ' x ' || rt.name) as room_type_summary,
       coalesce(lines.room_lines, '[]'::json) as room_lines
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     left join lateral (
       select
         string_agg(l.rooms || ' x ' || lrt.name, ', ' order by lrt.sort_order, lrt.name) as room_type_summary,
         json_agg(json_build_object(
           'roomTypeId', l.room_type_id,
           'roomTypeName', lrt.name,
           'roomSlug', lrt.slug,
           'rooms', l.rooms,
           'subtotalAmount', l.subtotal_cents / 100.0
         ) order by lrt.sort_order, lrt.name) as room_lines
       from reservation_room_lines l
       join room_types lrt on lrt.id = l.room_type_id
       where l.reservation_id = r.id
     ) lines on true
     where lower(r.confirmation_number) = lower($1)
       and lower(r.guest_last_name) = lower($2)`,
    [confirmationNumber, lastName],
  );

  if (!result.rowCount) return null;
  const row = result.rows[0];
  return {
    confirmationNumber: row.confirmation_number,
    guestName: `${row.guest_first_name} ${row.guest_last_name}`,
    checkIn: dateOnlyKey(row.check_in),
    checkOut: dateOnlyKey(row.check_out),
    guests: row.guests,
    roomType: row.room_type_summary,
    roomLines: row.room_lines,
    status: row.status,
    paymentStatus: row.payment_status,
    totalAmount: row.total_cents / 100,
    propertyPhone: '(954) 555-0100',
    propertyEmail: 'curtisinn200@gmail.com',
  };
}
