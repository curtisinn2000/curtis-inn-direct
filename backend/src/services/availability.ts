import type { DbClient } from '../db.js';
import { addYearsKey, diffDays, eachStayDate, isWeekend, todayKey } from '../date-utils.js';
import { badRequest } from '../errors.js';
import { config } from '../config.js';
import { roomFromRow } from '../transformers.js';

const ACTIVE_HOLD_STATUSES = ['pending', 'confirmed', 'checked_in'];

export type AvailabilityInput = {
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: number;
};

export function validateStayWindow(input: Pick<AvailabilityInput, 'checkIn' | 'checkOut'>) {
  const nights = diffDays(input.checkIn, input.checkOut);
  if (input.checkIn < todayKey()) throw badRequest('past_date', 'Check-in date cannot be in the past.');
  if (input.checkOut > addYearsKey(2)) throw badRequest('date_too_far', 'Bookings are limited to two years from today.');
  if (nights < 1) throw badRequest('invalid_dates', 'Check-out must be after check-in.');
  if (nights > 30) throw badRequest('stay_too_long', 'Stays longer than 30 nights require direct contact.');
  return nights;
}

export async function searchAvailability(db: DbClient, input: AvailabilityInput) {
  const nights = validateStayWindow(input);
  const stayDates = eachStayDate(input.checkIn, input.checkOut);

  const roomsResult = await db.query(
    `select *, $1::numeric as tax_rate
     from room_types
     where is_active = true and occupancy >= $2
     order by sort_order, name`,
    [config.TAX_RATE, input.guests],
  );

  const results = [];
  for (const row of roomsResult.rows) {
    const pricing = await priceAndAvailabilityForRoom(db, {
      roomId: row.id,
      basePrice: row.base_price,
      baseInventory: row.base_inventory,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      roomsNeeded: input.rooms,
    });

    const taxes = Math.round(pricing.subtotalCents * config.TAX_RATE);
    const grandTotalCents = pricing.subtotalCents + taxes;

    results.push({
      roomType: roomFromRow(row),
      available: pricing.bookable ? pricing.minRemaining : 0,
      nightlyRate: Math.round(pricing.subtotalCents / 100 / nights),
      totalRate: pricing.subtotalCents / 100,
      taxes: taxes / 100,
      grandTotal: grandTotalCents / 100,
      nights,
      _stayDates: stayDates,
    });
  }

  return results.map(({ _stayDates, ...result }) => result);
}

export async function priceAndAvailabilityForRoom(
  db: DbClient,
  input: {
    roomId: string;
    basePrice: number;
    baseInventory: number;
    checkIn: string;
    checkOut: string;
    roomsNeeded: number;
  },
) {
  const stayDates = eachStayDate(input.checkIn, input.checkOut);
  let subtotalCents = 0;
  let minRemaining = Number.MAX_SAFE_INTEGER;
  const nightlyRates: { date: string; rateCents: number }[] = [];

  for (const stayDate of stayDates) {
    const result = await db.query(
      `select
        coalesce(io.inventory, $2)::int as inventory,
        coalesce(io.status, 'open')::text as status,
        coalesce(ro.rate, round($3::numeric * case when extract(dow from $4::date) in (0,6) then 1.10 else 1.00 end)::int)::int as rate,
        coalesce(sum(rn.rooms) filter (where r.status = any($5::reservation_status[])), 0)::int as booked
       from (select $1::uuid as room_type_id, $4::date as stay_date) d
       left join inventory_overrides io on io.room_type_id = d.room_type_id and io.stay_date = d.stay_date
       left join rate_overrides ro on ro.room_type_id = d.room_type_id and ro.stay_date = d.stay_date
       left join reservation_nights rn on rn.room_type_id = d.room_type_id and rn.stay_date = d.stay_date
       left join reservations r on r.id = rn.reservation_id
       group by io.inventory, io.status, ro.rate`,
      [input.roomId, input.baseInventory, input.basePrice, stayDate, ACTIVE_HOLD_STATUSES],
    );

    const day = result.rows[0];
    const remaining = day.status === 'closed' ? 0 : Math.max(0, Number(day.inventory) - Number(day.booked));
    minRemaining = Math.min(minRemaining, remaining);
    const rateCents = Number(day.rate) * 100;
    subtotalCents += rateCents * input.roomsNeeded;
    nightlyRates.push({ date: stayDate, rateCents });
  }

  return {
    bookable: minRemaining >= input.roomsNeeded,
    minRemaining: minRemaining === Number.MAX_SAFE_INTEGER ? 0 : minRemaining,
    subtotalCents,
    nightlyRates,
  };
}

export async function getBookedCount(db: DbClient, roomId: string, date: string) {
  const result = await db.query(
    `select coalesce(sum(rn.rooms), 0)::int as booked
     from reservation_nights rn
     join reservations r on r.id = rn.reservation_id
     where rn.room_type_id = $1
       and rn.stay_date = $2
       and r.status = any($3::reservation_status[])`,
    [roomId, date, ACTIVE_HOLD_STATUSES],
  );
  return Number(result.rows[0]?.booked ?? 0);
}

export function lockKey(roomId: string, date: string) {
  return `${roomId}:${date}`;
}

export async function lockRoomDates(db: DbClient, roomId: string, stayDates: string[]) {
  for (const stayDate of stayDates) {
    await db.query(`select pg_advisory_xact_lock(hashtext($1))`, [lockKey(roomId, stayDate)]);
  }
}
