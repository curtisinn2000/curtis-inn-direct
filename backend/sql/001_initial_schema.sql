create extension if not exists pgcrypto;

do $$ begin
  create type room_status as enum ('open','closed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_status as enum ('pending','confirmed','cancelled','checked_in','checked_out','no_show');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status_t as enum ('unpaid','deposit_paid','paid','refunded','failed','partial_refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_method_t as enum ('clover_pay_now','clover_deposit','pay_at_property','stripe_pay_now');
exception when duplicate_object then null; end $$;

do $$ begin
  create type reservation_source as enum ('direct_website','admin_manual','phone','walk_in','ota');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_kind as enum ('full','deposit','refund');
exception when duplicate_object then null; end $$;

do $$ begin
  create type promo_kind as enum ('percent','amount');
exception when duplicate_object then null; end $$;

do $$ begin
  create type app_role as enum ('admin','staff');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create table if not exists room_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null default '',
  long_description text not null default '',
  occupancy int not null default 2 check (occupancy > 0),
  bed_type text not null default 'Queen',
  base_inventory int not null default 0 check (base_inventory >= 0 and base_inventory <= 999),
  base_price int not null default 0 check (base_price >= 0 and base_price <= 9999),
  is_active boolean not null default true,
  images text[] not null default '{}',
  amenities text[] not null default array['Free Wi-Fi','Air Conditioning','Flat-screen TV','Private Bathroom'],
  policies text[] not null default array['Non-smoking','No pets'],
  cancellation_terms text not null default 'Free cancellation up to 48 hours before check-in.',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists room_types_active_sort_idx on room_types (is_active, sort_order);

create table if not exists rate_overrides (
  room_type_id uuid not null references room_types(id) on delete cascade,
  stay_date date not null,
  rate int not null check (rate >= 0 and rate <= 9999),
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id),
  primary key (room_type_id, stay_date)
);
create index if not exists rate_overrides_date_idx on rate_overrides (stay_date);

create table if not exists inventory_overrides (
  room_type_id uuid not null references room_types(id) on delete cascade,
  stay_date date not null,
  inventory int check (inventory is null or (inventory >= 0 and inventory <= 999)),
  status room_status,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_users(id),
  primary key (room_type_id, stay_date)
);
create index if not exists inventory_overrides_date_idx on inventory_overrides (stay_date);

create table if not exists promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  kind promo_kind not null,
  value int not null check (value > 0),
  valid_from date,
  valid_to date,
  max_uses int,
  uses int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  confirmation_number text not null unique,
  room_type_id uuid not null references room_types(id),
  check_in date not null,
  check_out date not null check (check_out > check_in),
  nights int generated always as ((check_out - check_in)) stored,
  guests int not null check (guests > 0),
  rooms int not null default 1 check (rooms > 0),
  guest_first_name text not null,
  guest_last_name text not null,
  guest_email text not null,
  guest_phone text not null,
  arrival_time text not null default '',
  special_requests text not null default '',
  status reservation_status not null default 'pending',
  payment_status payment_status_t not null default 'unpaid',
  payment_method payment_method_t not null,
  subtotal_cents int not null check (subtotal_cents >= 0),
  tax_cents int not null check (tax_cents >= 0),
  deposit_cents int not null default 0 check (deposit_cents >= 0),
  total_cents int not null check (total_cents >= 0),
  source reservation_source not null default 'direct_website',
  idempotency_key text unique,
  promo_code_id uuid references promo_codes(id),
  notes jsonb not null default '[]'::jsonb,
  added_to_motel_pro boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists reservations_checkin_idx on reservations (check_in);
create index if not exists reservations_lastname_lower_idx on reservations (lower(guest_last_name));
create index if not exists reservations_status_dates_idx on reservations (status, check_in, check_out);

create table if not exists reservation_nights (
  reservation_id uuid not null references reservations(id) on delete cascade,
  room_type_id uuid not null references room_types(id),
  stay_date date not null,
  rooms int not null default 1 check (rooms > 0),
  rate_cents int not null check (rate_cents >= 0),
  primary key (reservation_id, stay_date)
);
create index if not exists reservation_nights_room_date_idx on reservation_nights (room_type_id, stay_date);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references reservations(id) on delete cascade,
  kind payment_kind not null,
  amount_cents int not null check (amount_cents >= 0),
  currency text not null default 'USD',
  provider text not null default 'legacy',
  clover_session_id text,
  clover_payment_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  status payment_status_t not null default 'unpaid',
  raw_webhook jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_reservation_idx on payments (reservation_id);
create index if not exists payments_stripe_checkout_session_idx on payments (stripe_checkout_session_id);
create index if not exists payments_stripe_payment_intent_idx on payments (stripe_payment_intent_id);

create table if not exists audit_log (
  id bigserial primary key,
  actor_id uuid references app_users(id),
  entity text not null,
  entity_id text,
  action text not null,
  before jsonb,
  after jsonb,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_entity_idx on audit_log (entity, created_at desc);

create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
