import { scriptPool } from './scriptDb.js';

const CAPACITY_STATUSES = ['pending', 'confirmed', 'checked_in', 'checked_out'];

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
  console.log(JSON.stringify({
    invalidOverrideCount,
    repairableOverrideCount: repairableCount,
    blockedOverrideCount: invalidOverrideCount - repairableCount,
    bookedOverCapacityCount,
    ...migrationAudit.rows[0],
    invalidOverrides: invalidOverrides.rows,
    manualReview: manualReview.rows,
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
