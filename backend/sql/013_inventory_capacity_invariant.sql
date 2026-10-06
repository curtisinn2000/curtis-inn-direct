-- Record every date where reservations exceed the configured physical capacity.
with booked as (
  select rn.room_type_id, rn.stay_date,
    sum(rn.rooms) filter (where r.status in ('pending', 'confirmed', 'checked_in', 'checked_out'))::int as booked
  from reservation_nights rn
  join reservations r on r.id = rn.reservation_id
  where r.status in ('pending', 'confirmed', 'checked_in', 'checked_out')
  group by rn.room_type_id, rn.stay_date
)
insert into audit_log(actor_id, entity, entity_id, action, before, meta)
select null, 'room_type', rt.id::text || '|' || booked.stay_date::text, 'capacity_manual_review',
  jsonb_build_object(
    'roomName', rt.name,
    'date', booked.stay_date::text,
    'baseInventory', rt.base_inventory,
    'booked', booked.booked,
    'inventoryOverride', io.inventory
  ),
  jsonb_build_object('migration', '013_inventory_capacity_invariant.sql')
from booked
join room_types rt on rt.id = booked.room_type_id
left join inventory_overrides io on io.room_type_id = booked.room_type_id and io.stay_date = booked.stay_date
where booked.booked > rt.base_inventory;

-- Audit safely repairable overrides before changing them.
with booked as (
  select rn.room_type_id, rn.stay_date,
    coalesce(sum(rn.rooms) filter (where r.status in ('pending', 'confirmed', 'checked_in', 'checked_out')), 0)::int as booked
  from reservation_nights rn
  join reservations r on r.id = rn.reservation_id
  group by rn.room_type_id, rn.stay_date
), repairable as (
  select io.room_type_id, io.stay_date, io.inventory, rt.name, rt.base_inventory,
    coalesce(booked.booked, 0)::int as booked
  from inventory_overrides io
  join room_types rt on rt.id = io.room_type_id
  left join booked on booked.room_type_id = io.room_type_id and booked.stay_date = io.stay_date
  where io.inventory > rt.base_inventory
    and coalesce(booked.booked, 0) <= rt.base_inventory
)
insert into audit_log(actor_id, entity, entity_id, action, before, after, meta)
select null, 'inventory_override', repairable.room_type_id::text || '|' || repairable.stay_date::text,
  'capacity_repair',
  jsonb_build_object(
    'roomName', repairable.name,
    'date', repairable.stay_date::text,
    'inventory', repairable.inventory,
    'baseInventory', repairable.base_inventory,
    'booked', repairable.booked
  ),
  jsonb_build_object('inventory', greatest(repairable.booked, repairable.base_inventory)),
  jsonb_build_object('migration', '013_inventory_capacity_invariant.sql')
from repairable;

-- Clamp only safe invalid overrides. Booked-over-capacity rows remain untouched for manual review.
with booked as (
  select rn.room_type_id, rn.stay_date,
    coalesce(sum(rn.rooms) filter (where r.status in ('pending', 'confirmed', 'checked_in', 'checked_out')), 0)::int as booked
  from reservation_nights rn
  join reservations r on r.id = rn.reservation_id
  group by rn.room_type_id, rn.stay_date
), repairable as (
  select io.room_type_id, io.stay_date, rt.base_inventory,
    coalesce(booked.booked, 0)::int as booked
  from inventory_overrides io
  join room_types rt on rt.id = io.room_type_id
  left join booked on booked.room_type_id = io.room_type_id and booked.stay_date = io.stay_date
  where io.inventory > rt.base_inventory
    and coalesce(booked.booked, 0) <= rt.base_inventory
)
update inventory_overrides io
set inventory = greatest(repairable.booked, repairable.base_inventory), updated_at = now()
from repairable
where io.room_type_id = repairable.room_type_id and io.stay_date = repairable.stay_date;

create or replace function enforce_inventory_override_capacity()
returns trigger
language plpgsql
as $$
declare
  physical_rooms int;
  room_name text;
begin
  if new.inventory is null then
    return new;
  end if;

  select base_inventory, name into physical_rooms, room_name
  from room_types
  where id = new.room_type_id;

  if new.inventory > physical_rooms then
    raise exception 'Inventory cannot exceed the % physical rooms configured for %.', physical_rooms, room_name
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists inventory_override_capacity_guard on inventory_overrides;
create trigger inventory_override_capacity_guard
before insert or update of inventory on inventory_overrides
for each row execute function enforce_inventory_override_capacity();

create or replace function enforce_room_type_capacity_reduction()
returns trigger
language plpgsql
as $$
declare
  conflict_dates text;
begin
  if new.base_inventory >= old.base_inventory then
    return new;
  end if;

  select string_agg(conflict_date, ', ' order by conflict_date) into conflict_dates
  from (
    select conflict_date
    from (
      select io.stay_date::text as conflict_date
      from inventory_overrides io
      where io.room_type_id = new.id
        and io.stay_date >= current_date
        and io.inventory > new.base_inventory
      union
      select rn.stay_date::text as conflict_date
      from reservation_nights rn
      join reservations r on r.id = rn.reservation_id
      where rn.room_type_id = new.id
        and rn.stay_date >= current_date
        and r.status in ('pending', 'confirmed', 'checked_in', 'checked_out')
      group by rn.stay_date
      having sum(rn.rooms) > new.base_inventory
    ) conflicts
    order by conflict_date
    limit 20
  ) limited_conflicts;

  if conflict_dates is not null then
    raise exception 'Physical room capacity cannot be reduced because future inventory or bookings exceed the new value on %.', conflict_dates
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists room_type_capacity_reduction_guard on room_types;
create trigger room_type_capacity_reduction_guard
before update of base_inventory on room_types
for each row execute function enforce_room_type_capacity_reduction();
