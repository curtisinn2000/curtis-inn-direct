create table if not exists room_amenity_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create unique index if not exists room_amenity_options_label_key
  on room_amenity_options (lower(label));
create index if not exists room_amenity_options_active_sort_idx
  on room_amenity_options (is_active, sort_order, label);

create table if not exists room_policy_options (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id)
);
create unique index if not exists room_policy_options_label_key
  on room_policy_options (lower(label));
create index if not exists room_policy_options_active_sort_idx
  on room_policy_options (is_active, sort_order, label);

insert into room_amenity_options(label, sort_order)
select label, row_number() over (order by label)::int
from (
  select min(trim(label)) as label
  from (
    select unnest(array['Free Wi-Fi','Air Conditioning','Flat-screen TV','Private Bathroom']) as label
    union all
    select value as label
    from room_types, unnest(amenities) as value
  ) raw_seed
  where trim(label) <> ''
  group by lower(trim(label))
) seed
on conflict (lower(label)) do update
set is_active = true, updated_at = now();

insert into room_policy_options(label, sort_order)
select label, row_number() over (order by label)::int
from (
  select min(trim(label)) as label
  from (
    select unnest(array['Non-smoking','No pets']) as label
    union all
    select value as label
    from room_types, unnest(policies) as value
  ) raw_seed
  where trim(label) <> ''
  group by lower(trim(label))
) seed
on conflict (lower(label)) do update
set is_active = true, updated_at = now();
