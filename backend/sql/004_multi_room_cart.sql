create table if not exists reservation_room_lines (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  room_type_id uuid not null references room_types(id),
  rooms int not null check (rooms > 0),
  subtotal_cents int not null check (subtotal_cents >= 0),
  created_at timestamptz not null default now(),
  unique (reservation_id, room_type_id)
);

create index if not exists reservation_room_lines_reservation_idx on reservation_room_lines (reservation_id);
create index if not exists reservation_room_lines_room_type_idx on reservation_room_lines (room_type_id);

insert into reservation_room_lines(reservation_id, room_type_id, rooms, subtotal_cents)
select id, room_type_id, rooms, subtotal_cents
from reservations r
where not exists (
  select 1 from reservation_room_lines line where line.reservation_id = r.id
);

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'reservation_nights_pkey'
      and conrelid = 'reservation_nights'::regclass
  ) then
    alter table reservation_nights drop constraint reservation_nights_pkey;
  end if;
exception when undefined_object then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reservation_nights_reservation_room_date_pkey'
      and conrelid = 'reservation_nights'::regclass
  ) then
    alter table reservation_nights
      add constraint reservation_nights_reservation_room_date_pkey
      primary key (reservation_id, room_type_id, stay_date);
  end if;
end $$;
