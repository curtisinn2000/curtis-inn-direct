# Curtis Inn & Suites — Backend Handoff Report

**Audience:** Codex (backend implementation) + deployer (Vercel + Lovable Cloud / Supabase).
**Source of truth for the frontend:** this repo, current `main`. Everything below assumes the frontend stays as-is; backend swaps the data layer underneath without changing call sites.

---

## 1. App overview

- **Product:** Curtis Inn & Suites direct booking site (Hollywood, FL). Affordable, no luxury features, no pets, no breakfast.
- **Audiences:** anonymous public guests (booking + lookup) and a small admin/ops team (inventory, rates, reservations, content).
- **Policies:** Check-in 3:00 PM, Check-out 11:00 AM.
- **Payments:** **Clover only**. Never store raw CC details. Use Clover's hosted payment session; webhook confirms.
- **Tech:** React 18 + Vite + TS frontend, Zustand store, mock service layer in `src/services/api.ts`. Deploy: Vercel + Lovable Cloud (Supabase Postgres + Auth + Edge Functions).

---

## 2. Current state of the frontend

- All admin and public pages are implemented.
- A single in-memory Zustand store (`src/store/inventoryStore.ts`) is the data layer shared by admin (`/admin/calendar`, `/admin/rates`) and public (`/booking`, search, checkout).
- A mock API layer (`src/services/api.ts`) wraps the store with `delay()`-simulated network calls. Replace these implementations with real fetch/RPC calls — do **not** change their signatures or call sites.
- No persistence today. A refresh wipes overrides and any in-session reservations.
- No authentication. `/admin/*` is wide open; only `/admin/login` exists as a stub.

---

## 3. Database schema (Postgres / Supabase)

All tables live in `public`. Every public-schema table MUST get GRANTs + RLS enabled in the same migration (see §4).

### 3.1 `room_types`
```sql
create table public.room_types (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  name          text not null,
  short_description text not null default '',
  long_description  text not null default '',
  occupancy     int  not null default 2 check (occupancy > 0),
  bed_type      text not null default 'Queen',
  base_inventory int not null default 0 check (base_inventory >= 0),
  base_price    int  not null default 0 check (base_price >= 0 and base_price <= 9999),
  is_active     boolean not null default true,
  images        text[] not null default '{}',  -- ordered, [0] = cover
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index room_types_active_sort_idx on public.room_types (is_active, sort_order);
```

### 3.2 `rate_overrides` (per-date price overrides)
```sql
create table public.rate_overrides (
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  stay_date    date not null,
  rate         int  not null check (rate >= 0 and rate <= 9999),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  primary key (room_type_id, stay_date)
);
create index rate_overrides_date_idx on public.rate_overrides (stay_date);
```

### 3.3 `inventory_overrides` (per-date inventory + open/closed)
```sql
create type public.room_status as enum ('open','closed');
create table public.inventory_overrides (
  room_type_id uuid not null references public.room_types(id) on delete cascade,
  stay_date    date not null,
  inventory    int  check (inventory is null or (inventory >= 0 and inventory <= 999)),
  status       public.room_status,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id),
  primary key (room_type_id, stay_date)
);
create index inventory_overrides_date_idx on public.inventory_overrides (stay_date);
```

### 3.4 `reservations`
```sql
create type public.reservation_status   as enum ('pending','confirmed','cancelled','checked_in','checked_out','no_show');
create type public.payment_status_t     as enum ('unpaid','deposit_paid','paid','refunded','failed');
create type public.payment_method_t     as enum ('clover_pay_now','clover_deposit','pay_at_property');
create type public.reservation_source   as enum ('direct_website','phone','walk_in','ota');

create table public.reservations (
  id                   uuid primary key default gen_random_uuid(),
  confirmation_number  text not null unique,             -- server-issued, e.g. CIS-XXXXXX
  room_type_id         uuid not null references public.room_types(id),
  check_in             date not null,
  check_out            date not null check (check_out > check_in),
  nights               int  generated always as ((check_out - check_in)) stored,
  guests               int  not null check (guests > 0),
  rooms                int  not null default 1 check (rooms > 0),
  guest_first_name     text not null,
  guest_last_name      text not null,
  guest_email          text not null,
  guest_phone          text not null,
  arrival_time         text,
  special_requests     text,
  status               public.reservation_status not null default 'pending',
  payment_status       public.payment_status_t  not null default 'unpaid',
  payment_method       public.payment_method_t  not null,
  subtotal_cents       int not null,
  tax_cents            int not null,
  deposit_cents        int not null default 0,
  total_cents          int not null,
  source               public.reservation_source not null default 'direct_website',
  idempotency_key      text unique,                      -- supplied by client to dedupe
  promo_code_id        uuid references public.promo_codes(id),
  notes                jsonb not null default '[]'::jsonb,
  added_to_motel_pro   boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index reservations_checkin_idx on public.reservations (check_in);
create index reservations_lastname_lower_idx on public.reservations (lower(guest_last_name));
```

### 3.5 `reservation_nights` (one row per occupied night — drives "remaining")
```sql
create table public.reservation_nights (
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  room_type_id   uuid not null references public.room_types(id),
  stay_date      date not null,
  rooms          int  not null default 1 check (rooms > 0),
  rate_cents     int  not null,
  primary key (reservation_id, stay_date)
);
create index reservation_nights_room_date_idx on public.reservation_nights (room_type_id, stay_date);
```

> **Why a separate nights table:** lets us compute booked counts per (room, date) via a single `SUM(rooms)` and lock those rows during a booking transaction (§6).

### 3.6 `payments`
```sql
create type public.payment_kind as enum ('full','deposit','refund');
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  reservation_id  uuid not null references public.reservations(id) on delete cascade,
  kind            public.payment_kind not null,
  amount_cents    int not null,
  currency        text not null default 'USD',
  clover_session_id text,
  clover_payment_id text,
  status          public.payment_status_t not null default 'unpaid',
  raw_webhook     jsonb,                  -- last webhook payload, for audit
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index payments_reservation_idx on public.payments (reservation_id);
```

### 3.7 `promo_codes`
```sql
create type public.promo_kind as enum ('percent','amount');
create table public.promo_codes (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  kind        public.promo_kind not null,
  value       int  not null check (value > 0),     -- percent (1-100) or cents
  valid_from  date,
  valid_to    date,
  max_uses    int,
  uses        int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
```

### 3.8 `user_roles` (per Lovable security pattern — roles NEVER on profile)
```sql
create type public.app_role as enum ('admin','staff');
create table public.user_roles (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  unique (user_id, role)
);
```

```sql
-- SECURITY DEFINER helper used by all admin RLS policies
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
```

### 3.9 `profiles` (only if you want to store admin display names/avatars)
```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- trigger: create profile row on signup (Lovable auth pattern)
```

### 3.10 `audit_log`
```sql
create table public.audit_log (
  id          bigserial primary key,
  actor_id    uuid references auth.users(id),
  entity      text not null,        -- 'rate_override' | 'inventory_override' | 'reservation' | 'room_type' | ...
  entity_id   text,
  action      text not null,        -- 'bulk_update' | 'set' | 'cancel' | ...
  before      jsonb,
  after       jsonb,
  meta        jsonb,
  created_at  timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, created_at desc);
```

---

## 4. GRANTs + RLS (mandatory)

Every table above MUST follow the four-step pattern: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`. Highlights:

### Public-readable
- `room_types` (only `is_active = true` rows):
  ```sql
  grant select on public.room_types to anon, authenticated;
  grant all on public.room_types to service_role;
  alter table public.room_types enable row level security;
  create policy "public reads active rooms" on public.room_types
    for select to anon, authenticated using (is_active = true);
  create policy "admins manage rooms" on public.room_types
    for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
  ```

### Public read of pricing/availability for active rooms
- `rate_overrides`, `inventory_overrides`:
  - Public SELECT only via a **security-definer RPC** (`search_availability`, `get_rate_range`) — do NOT grant `anon` direct table access. Admin gets full CRUD via `has_role(...,'admin')`.

### Auth-only / admin-only
- `reservations`, `reservation_nights`, `payments`, `promo_codes`, `audit_log`, `user_roles`:
  - `grant ... to authenticated` only; `grant all on ... to service_role`.
  - All admin endpoints check `has_role(auth.uid(),'admin')`.
  - Public guests do NOT directly select reservations. The lookup tool calls a security-definer RPC `lookup_reservation(conf_number, last_name)` that returns a redacted row.

### `user_roles`
- See snippet in §3.8 — `select` granted to `authenticated` so `has_role` works, no `anon` access. Inserts/updates restricted to admins (or done by service_role during seeding).

---

## 5. API endpoints to implement

All endpoints are Supabase Edge Functions (TypeScript) or PostgREST RPCs. Frontend already calls these signatures from `src/services/api.ts`; reimplement the bodies, do not rename.

### 5.1 Public
| Function | Verb / RPC | Auth | Notes |
|---|---|---|---|
| `searchAvailability(search)` | RPC `search_availability(check_in, check_out, guests, rooms)` | anon | Returns one row per active room with `nightly`, `total`, `taxes`, `grand_total`, `available`. Reads `room_types` + `rate_overrides` + `inventory_overrides` + `reservation_nights`. |
| `getRoomTypes()` | `GET /room_types?is_active=eq.true&order=sort_order` | anon | |
| `getRoomBySlug(slug)` | `GET /room_types?slug=eq.{slug}` | anon | |
| `createReservation(data)` | Edge fn `POST /reservations` | anon | Body includes `idempotency_key`. See §6 for the atomic transaction. |
| `lookupReservation({conf, lastName})` | RPC `lookup_reservation(conf, last_name_lower)` | anon | SECURITY DEFINER. Returns a redacted row (no email/phone). |
| `validatePromoCode(code)` | RPC `validate_promo(code, total_cents)` | anon | |
| `createCloverSession({reservationId})` | Edge fn `POST /clover/session` | anon | Calls Clover API, stores `clover_session_id` on `payments`, returns hosted URL. |
| Clover webhook | Edge fn `POST /clover/webhook` | webhook secret | Verify signature; flip `payments.status` and `reservations.payment_status`/`status`. |

### 5.2 Admin (all require `has_role(auth.uid(),'admin')`)
| Function | Verb / RPC | Notes |
|---|---|---|
| Room type CRUD | PostgREST `/room_types` | Plus image upload via Supabase Storage. |
| `setRate(roomId, date, rate)` | RPC `set_rate(...)` | Upserts `rate_overrides`. Writes `audit_log`. |
| `setRemaining(roomId, date, remaining)` | RPC `set_remaining(...)` | Upserts `inventory_overrides.inventory = booked + remaining`. |
| `bulkUpdate(roomId, dates[], {inventory,status})` | RPC `bulk_update_inventory(...)` | One transaction; audit per-date diff. |
| `bulkUpdateRates(roomId, dates[], rule)` | RPC `bulk_update_rates(...)` | `rule = {set|pct|amt, value}`. Reads current rate per date for relative modes. Clamp 0..9999. |
| `clearRateOverrides(roomId, fromDate?)` | RPC `clear_rate_overrides(...)` | Used by Rates Center "Clear future" button. |
| `getReservations()` / `getReservationById()` | PostgREST | Joined with room name + payment status. |
| `updateReservationStatus(id, status)` | RPC | Cancel releases the night rows (§9). |
| `getPayments()` | PostgREST | |
| `getDashboardStats()` | RPC `dashboard_stats()` | Today's check-ins, occupancy, revenue, upcoming. |

---

## 6. Atomic booking transaction (the critical piece)

The booking endpoint must guarantee no oversell. Suggested SQL/PLpgSQL outline:

```sql
create or replace function public.create_reservation(payload jsonb)
returns public.reservations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room    public.room_types;
  v_date    date;
  v_booked  int;
  v_inv     int;
  v_rate    int;
  v_rooms   int := (payload->>'rooms')::int;
  v_total   int := 0;
  v_conf    text;
  v_idemp   text := payload->>'idempotency_key';
  v_existing public.reservations;
  v_res     public.reservations;
begin
  -- 1. Idempotency
  if v_idemp is not null then
    select * into v_existing from public.reservations where idempotency_key = v_idemp;
    if found then return v_existing; end if;
  end if;

  -- 2. Lock room + assert active
  select * into v_room from public.room_types
   where id = (payload->>'room_type_id')::uuid and is_active for update;
  if not found then raise exception 'room_not_found'; end if;

  -- 3. Walk each night, lock rows, assert availability, recompute price server-side
  for v_date in
    select generate_series((payload->>'check_in')::date,
                           (payload->>'check_out')::date - 1, '1 day')::date
  loop
    -- inventory + status (locked)
    select coalesce(io.inventory, v_room.base_inventory),
           coalesce(io.status, 'open')
      into v_inv, v_inv  -- (status check inline)
      from public.inventory_overrides io
     where io.room_type_id = v_room.id and io.stay_date = v_date
       for update;

    -- booked so far
    select coalesce(sum(rooms),0) into v_booked
      from public.reservation_nights
     where room_type_id = v_room.id and stay_date = v_date
       for update;

    if v_booked + v_rooms > v_inv then
      raise exception 'sold_out' using detail = v_date::text;
    end if;

    -- nightly rate (override or base + weekend uplift)
    select coalesce(ro.rate,
                    round(v_room.base_price *
                          case when extract(dow from v_date) in (0,6) then 1.10 else 1.00 end))
      into v_rate
      from (select 1) s
      left join public.rate_overrides ro
        on ro.room_type_id = v_room.id and ro.stay_date = v_date;

    v_total := v_total + v_rate;

    insert into public.reservation_nights(reservation_id, room_type_id, stay_date, rooms, rate_cents)
    values (gen_random_uuid(), v_room.id, v_date, v_rooms, v_rate * 100)
    on conflict do nothing;  -- placeholder; real insert happens after we have v_res.id
  end loop;

  -- 4. Create reservation row, then re-link the nights (or insert them after this row)
  v_conf := 'CIS-' || lpad((floor(random()*1000000))::int::text, 6, '0');
  -- ... insert reservations + reservation_nights with v_res.id ...

  return v_res;
end $$;
```

(The snippet above is sketch-level. Codex should implement the night insert correctly — easiest is two-pass: collect dates+rates into a temp table, insert reservation, then bulk-insert nights with the new id.)

**Booked count** for any cell is `coalesce(sum(reservation_nights.rooms),0)` joined to a `reservations.status in ('pending','confirmed','checked_in')` filter. Cancelled/no_show do NOT count.

---

## 7. Authentication flow

- **Provider:** Lovable Cloud Auth (Supabase).
- **Methods:** Email/password + Google for admin users only. No public guest accounts.
- **Profiles table:** create only if you want display name/avatar — current UI doesn't use it. **Decision needed (see §13).**
- **Roles:** stored in `user_roles` (never on profile). `app_role` enum: `admin`, `staff`.
- **Frontend wiring:**
  1. Register `supabase.auth.onAuthStateChange` in `src/App.tsx` (or a top-level provider) — set listener BEFORE calling `getSession()`.
  2. `AdminLayout` checks session on mount + via the listener; if no session, redirect to `/admin/login`. After session resolves, call a small RPC `current_user_role()` (or `has_role`) to confirm admin; if not admin, sign out + redirect with an error toast.
  3. `/admin/login` page — email/password form + "Continue with Google" button (`signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/admin' } })`).
  4. `/admin/forgot-password` — calls `resetPasswordForEmail(email, { redirectTo: origin + '/admin/reset-password' })`.
  5. `/admin/reset-password` (PUBLIC route, no guard) — detects `type=recovery` in URL hash, then `supabase.auth.updateUser({ password })`.
- **Session validation rule:** anywhere the backend trusts the user, call `auth.getUser()` (server-validated) — `getSession()` is only for client-side token attachment.
- **HIBP password check:** enable in Cloud → Users → Auth Settings → Password HIBP Check.
- **Admin seeding:** insert the first admin row manually via SQL after the user signs up:
  ```sql
  insert into public.user_roles(user_id, role)
  values ('<auth.users.id from console>', 'admin');
  ```

---

## 8. Security requirements (non-negotiable)

1. **Never store raw CC details.** All card capture happens in Clover's hosted page. Our DB stores only `clover_session_id`, `clover_payment_id`, amounts, and status.
2. **Server-side price recompute on every booking** — never trust totals/rates from the client. The URL params in `/booking/checkout` are display only.
3. **Idempotency** — every `createReservation` call carries an `idempotency_key` (UUID generated in `CheckoutPage` before submit). DB has a unique constraint on it.
4. **Admin auth gate** — `AdminLayout` must redirect unauthenticated users to `/admin/login`. All admin RPCs must call `has_role(auth.uid(),'admin')`.
5. **Audit every admin mutation** — bulk price/inventory updates currently have no UI undo, so audit log is the recovery mechanism.
6. **Clover webhook signature verification** — reject any webhook with a bad/missing signature.
7. **CORS** — lock edge functions to the production domain and the Lovable preview domain.
8. **PII** — `lookup_reservation` returns a redacted row (no email, phone, total). Full detail requires admin.
9. **Rate limit** the public `createReservation` endpoint and `lookup_reservation` (e.g. 10/min/IP) to slow enumeration attacks.
10. **HTTPS only** for the Vercel deployment and any custom domain.

---

## 9. Clover integration

- Use Clover **Hosted Checkout** so cards never touch our origin.
- Flow:
  1. Client creates reservation in `pending` state (or status driven by payment method).
  2. Client requests `createCloverSession({reservationId})` → backend creates Clover session → returns hosted URL.
  3. Client redirects guest to hosted URL.
  4. Clover redirects back to `/booking/confirmation?conf=...&status=...`.
  5. Webhook (independent of redirect) arrives at `/clover/webhook`. Verify signature. Update `payments.status` and `reservations.payment_status` (+ `status = 'confirmed'` on success).
- **Deposit flow:** `deposit_cents = base_price * 100` for one night (current rule). Promotable to per-room-type setting later.
- **`pay_at_property`:** never touches Clover. Creates a `pending` reservation that holds inventory (or doesn't — see §13 Q1).

---

## 10. Email integration

- **Backend:** Gmail / Google Workspace SMTP (per project memory).
- **Templates** (HTML, branded, Curtis Inn header/footer):
  - Guest confirmation (per payment method)
  - Cancellation
  - Deposit receipt
  - Admin "new reservation" notification
  - Password reset (Supabase built-in template can be customized)
- **Send triggers:** edge function called from `create_reservation` (success path) and from Clover webhook (paid → send confirmation), and from `updateReservationStatus` (cancel → send cancellation).

---

## 11. Environment variables

Add to Vercel + Supabase (and `.env.local` for dev):

- `SUPABASE_URL`, `SUPABASE_ANON_KEY` (public — already wired by Lovable Cloud)
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `CLOVER_MERCHANT_ID`
- `CLOVER_API_KEY` (secret)
- `CLOVER_WEBHOOK_SECRET`
- `CLOVER_ENV` = `sandbox` | `production`
- `GMAIL_SMTP_HOST`, `GMAIL_SMTP_PORT`, `GMAIL_SMTP_USER`, `GMAIL_SMTP_PASS` (App Password) **or** Google Workspace OAuth refresh token
- `MAIL_FROM` (e.g. `reservations@curtisinn.com`)
- `TAX_RATE` (decimal, e.g. `0.07`)
- `DEPOSIT_RULE` = `one_night` (placeholder for future expansion)
- `PUBLIC_SITE_URL` (used in email links and Clover redirects)

Frontend should never read Clover or Gmail secrets — they're server-only.

---

## 12. Frontend → backend swap map

When you implement the backend, replace these implementations (do not rename or change signatures):

| Frontend call | Replace with |
|---|---|
| `src/services/api.ts → searchAvailability` | RPC `search_availability` |
| `src/services/api.ts → getRoomTypes / getRoomBySlug` | PostgREST select on `room_types` |
| `src/services/api.ts → createReservation` | Edge fn `POST /reservations` (atomic, idempotent) |
| `src/services/api.ts → validatePromoCode` | RPC `validate_promo` |
| `src/services/api.ts → createCloverPaymentSession` | Edge fn `POST /clover/session` |
| `src/services/api.ts → getCloverPaymentStatus` | RPC reading `payments.status` |
| `src/services/api.ts → getDashboardStats` | RPC `dashboard_stats` |
| `src/services/api.ts → getReservations / getReservationById` | PostgREST on `reservations` |
| `src/services/api.ts → updateReservationStatus` | RPC `update_reservation_status` |
| `src/services/api.ts → getPayments` | PostgREST on `payments` |
| `src/services/api.ts → getRateRules` | Delete — UI no longer uses static rate rules |
| `src/store/inventoryStore.ts → setRate / setRemaining / bulkUpdate / bulkUpdateRates / clearRateOverrides` | Either (a) wrap each action to call the equivalent RPC and then update local state from the response, or (b) replace the whole store with a React Query layer keyed on `(roomId, dateRange)`. Option (b) is cleaner for production. |
| `src/store/inventoryStore.ts → upsertRoomType / addRoomType / deleteRoomType / setRoomImages / setRoomActive` | PostgREST / RPC + Supabase Storage for images |
| `src/store/inventoryStore.ts → getRate / getInventory / getStatus / getRemaining / getBooked` selectors | Replace with server-side computation in `search_availability`; expose a thin RPC `get_calendar(room_ids, from, to)` for the admin Availability Center grid |
| `src/services/reservationLookup.ts` (public guest lookup) | RPC `lookup_reservation(conf, last_name)` |

Keep `dateKey()`, formatting helpers, and pure selectors that don't touch the store.

---

## 13. Open product questions (please answer before/while implementing)

1. **`pay_at_property` inventory hold:** does a `pay_at_property` reservation hold inventory immediately on submit, or only after the property manually confirms (allowing online double-booking until confirmation)?
2. **Cancellation:** auto-release inventory on cancel? Is "free cancellation up to 48h" a hard rule or per-rate-plan configurable?
3. **Deposit amount:** keep "one night's base price", switch to a configurable % (e.g. 20%), or per-room-type setting?
4. **Min/max stay & blackout dates** in v1, or are per-day inventory overrides enough?
5. **Multi-room semantics:** `rooms: 3` currently means "3 units of the same type for every night". Confirm you don't need mixed-room-type carts.
6. **Promo codes** in v1? Data model is included; checkout UI does not currently apply them.
7. **Admin auth model:** email/password + Google as default, or only one of those? Per-user accounts with roles, or a single shared admin login?
8. **Profile data for admins** (display name, avatar): needed, or skip the `profiles` table?

---

## 14. Deploy notes (Vercel + Lovable Cloud)

- **Frontend:** Vercel auto-deploy from this repo. Build = `vite build`. Output = `dist/`. Set `PUBLIC_SITE_URL` env var per environment.
- **Backend:** Lovable Cloud (Supabase) — migrations in `supabase/migrations`, edge functions in `supabase/functions`. Deploy via Lovable Cloud or `supabase deploy`.
- **Secrets:** server secrets only in Supabase (Edge Function env). Anon key in Vercel as `VITE_SUPABASE_PUBLISHABLE_KEY` (or whatever the Lovable Cloud client already uses). Never put Clover or Gmail secrets in Vercel client env.
- **Preview vs production:** use separate Supabase projects (or at least separate `CLOVER_ENV=sandbox` / `live`), and separate `PUBLIC_SITE_URL`.
- **Clover webhook URL** registered with Clover must point at the deployed edge function endpoint (one per environment).
- **CORS:** restrict edge functions to your custom domain + Lovable preview wildcard.

---

## Appendix A — Reservation status state machine

```
pending ──(payment success / pay_at_property confirmed)──▶ confirmed
pending ──(cancel)──▶ cancelled
confirmed ──(check_in)──▶ checked_in ──(check_out)──▶ checked_out
confirmed ──(cancel)──▶ cancelled
confirmed ──(no_show)──▶ no_show
```

Inventory is held while status ∈ {`pending`, `confirmed`, `checked_in`} and released on `cancelled` / `no_show` (configurable for no_show).

---

## Appendix B — What the frontend already enforces (and what backend must duplicate)

| Rule | Frontend | Backend MUST also enforce |
|---|---|---|
| Past dates blocked | ✅ | ✅ |
| 2-year forward cap | ✅ (just added) | ✅ |
| Rate clamp 0..9999 | ✅ | ✅ (DB CHECK) |
| Inventory cap = `baseInventory` | ✅ | ✅ |
| Weekend × 1.10 uplift | ✅ | ✅ (in `search_availability` + booking txn) |
| Closed → hidden from public | ✅ | ✅ |
| Tax = `TAX_RATE × subtotal` | ✅ | ✅ |

Anything the frontend "enforces" is for UX only — every rule has to be re-checked server-side.
