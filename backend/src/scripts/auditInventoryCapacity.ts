import { scriptPool } from './scriptDb.js';
import { dateOnlyKey, eachStayDate } from '../date-utils.js';
import { ACTIVE_INVENTORY_HOLD_STATUSES, deriveInventoryAvailability } from '../services/inventoryAvailability.js';

const CAPACITY_STATUSES = [...ACTIVE_INVENTORY_HOLD_STATUSES];

async function verifyReservation(confirmationNumber: string) {
  const reservationResult = await scriptPool.query(
    `select id, confirmation_number, check_in, check_out, status
     from reservations
     where lower(confirmation_number) = lower($1)`,
    [confirmationNumber],
  );
  if (!reservationResult.rowCount) return { found: false, confirmationNumber };

  const reservation = reservationResult.rows[0];
  const nightsResult = await scriptPool.query(
    `with target_nights as (
       select room_type_id, stay_date, rooms
       from reservation_nights
       where reservation_id = $1
     )
     select rt.name as "roomName", target_nights.stay_date::text as date,
       target_nights.rooms as "reservationRooms",
       coalesce(io.inventory, rt.base_inventory)::int as inventory,
       coalesce(io.status, 'open')::text as status,
       coalesce(sum(all_nights.rooms) filter (where all_reservations.status = any($2::reservation_status[])), 0)::int as booked
     from target_nights
     join room_types rt on rt.id = target_nights.room_type_id
     left join inventory_overrides io on io.room_type_id = target_nights.room_type_id and io.stay_date = target_nights.stay_date
     left join reservation_nights all_nights on all_nights.room_type_id = target_nights.room_type_id and all_nights.stay_date = target_nights.stay_date
     left join reservations all_reservations on all_reservations.id = all_nights.reservation_id
     group by rt.name, rt.base_inventory, target_nights.stay_date, target_nights.rooms, io.inventory, io.status
     order by target_nights.stay_date, rt.name`,
    [reservation.id, CAPACITY_STATUSES],
  );

  const checkIn = dateOnlyKey(reservation.check_in);
  const checkOut = dateOnlyKey(reservation.check_out);
  const nights = nightsResult.rows.map(row => ({
    roomName: String(row.roomName),
    date: dateOnlyKey(row.date),
    reservationRooms: Number(row.reservationRooms),
    inventory: Number(row.inventory),
    booked: Number(row.booked),
    status: String(row.status),
    ...deriveInventoryAvailability(
      Number(row.inventory),
      Number(row.booked),
      String(row.status) as 'open' | 'closed',
    ),
  }));

  return {
    found: true,
    confirmationNumber: String(reservation.confirmation_number),
    reservationStatus: String(reservation.status),
    checkIn,
    checkOut,
    expectedStayDates: eachStayDate(checkIn, checkOut),
    checkoutConsumed: nights.some(night => night.date === checkOut),
    nights,
  };
}

async function main() {
  const invalidOverrides = await scriptPool.query(
    `with booked as (
       select rn.room_type_id, rn.stay_date,
         coalesce(sum(rn.rooms) filter (where r.status = any($1::reservation_status[])), 0)::int as booked
       from reservation_nights rn
       join reservations r on r.id = rn.reservation_id
       group by rn.room_type_id, rn.stay_date
     )
     select rt.id as "roomId", rt.name as "roomName", rt.base_inventory as "baseInventory",
       io.stay_date::text as date, io.inventory,
       coalesce(booked.booked, 0)::int as booked,
       coalesce(booked.booked, 0) <= rt.base_inventory as repairable
     from inventory_overrides io
     join room_types rt on rt.id = io.room_type_id
     left join booked on booked.room_type_id = io.room_type_id and booked.stay_date = io.stay_date
     where io.inventory > rt.base_inventory
     order by io.stay_date, rt.name`,
    [CAPACITY_STATUSES],
  );

  const manualReview = await scriptPool.query(
    `select rt.id as "roomId", rt.name as "roomName", rt.base_inventory as "baseInventory",
       rn.stay_date::text as date,
       sum(rn.rooms) filter (where r.status = any($1::reservation_status[]))::int as booked,
       io.inventory
     from reservation_nights rn
     join reservations r on r.id = rn.reservation_id
     join room_types rt on rt.id = rn.room_type_id
     left join inventory_overrides io on io.room_type_id = rn.room_type_id and io.stay_date = rn.stay_date
     where r.status = any($1::reservation_status[])
     group by rt.id, rt.name, rt.base_inventory, rn.stay_date, io.inventory
     having sum(rn.rooms) filter (where r.status = any($1::reservation_status[])) > rt.base_inventory
     order by rn.stay_date, rt.name`,
    [CAPACITY_STATUSES],
  );

  const migrationAudit = await scriptPool.query(
    `select
       count(*) filter (where action = 'capacity_repair')::int as "repairAuditCount",
       count(*) filter (where action = 'capacity_manual_review')::int as "manualReviewAuditCount"
     from audit_log
     where meta ->> 'migration' = '013_inventory_capacity_invariant.sql'`,
  );

  const invalidOverrideCount = invalidOverrides.rowCount ?? invalidOverrides.rows.length;
  const bookedOverCapacityCount = manualReview.rowCount ?? manualReview.rows.length;
  const repairableCount = invalidOverrides.rows.filter(row => row.repairable).length;
  const confirmationNumber = process.env.CONFIRMATION_NUMBER?.trim();
  const reservationVerification = confirmationNumber ? await verifyReservation(confirmationNumber) : undefined;
  console.log(JSON.stringify({
    invalidOverrideCount,
    repairableOverrideCount: repairableCount,
    blockedOverrideCount: invalidOverrideCount - repairableCount,
    bookedOverCapacityCount,
    ...migrationAudit.rows[0],
    invalidOverrides: invalidOverrides.rows,
    manualReview: manualReview.rows,
    ...(reservationVerification ? { reservationVerification } : {}),
  }));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await scriptPool.end();
  });
