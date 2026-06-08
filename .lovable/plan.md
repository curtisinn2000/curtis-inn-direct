# Plan: Apply 7 Frontend Fixes + Deliver Backend Handoff Report

## Part A — Frontend fixes (apply now)

### 1. 2-year upper bound on date pickers
Add `addYears(today, 2)` cap to the `disabled` predicate in both `BulkUpdateDialog` and `BulkPriceUpdatePanel` calendars.

### 2. Editable Start/End dates in `BulkUpdateDialog`
Mirror the pattern already in `BulkPriceUpdatePanel`: swap `<Input readOnly>` for `<Input type="date">` with `min`/`max`, two-way bound to `range.from` / `range.to`, with swap-if-inverted logic.

### 3. `BookingPage` thumbnails
Use `result.roomType.images?.[0] ?? roomImg` instead of always the static import.

### 4. `CheckoutPage` reads from inventory store
Resolve the room by slug from `useInventoryStore.roomTypes` (with `MOCK_ROOMS` as fallback for legacy seeded rooms missing custom images). Keeps admin-added rooms rendering correctly.

### 5. Double-submit protection on checkout
Disable the "Proceed to Payment" / "Complete Reservation" button while `submitting === true` (currently the spinner shows but click still fires).

### 6. "Clear overrides" button in `/admin/rates`
Add a small "Clear future price overrides" action (per-room or all-rooms) wired to existing `clearRateOverrides(roomId, dateKey(today))` store action. Confirm via `AlertDialog`.

### 7. Hide hash-based fake booked counts behind a dev flag
Add `import.meta.env.DEV` (or `VITE_FAKE_BOOKINGS=1`) gate in `getBooked`: when off, return only real `reservationsByDate[k]` (0 if absent). Keeps prototype demo data in dev but ships clean for backend cut-over.

No new dependencies. No design changes. No backend.

## Part B — Issues to fix after backend (carried over for Codex)

These need server-side logic and will be wired during/after the backend build:

- **B1** Create real reservation on checkout submit (`createReservation` → API)
- **B2** Decrement inventory atomically when a reservation is created
- **B3** Re-check availability + recompute price on checkout entry and on submit (server-authoritative)
- **B4** Server-issued, idempotent confirmation number (no client-side `Date.now()`)
- **B5** Clover payment session creation + webhook verification before confirming
- **B6** Server-side price recomputation from `(roomId, checkIn, checkOut)` — never trust URL totals
- **B7** Fees / discounts / promo code application in checkout
- **B9** Min/Max stay, blackout dates, rate parity, deposit calc
- **Admin auth gate** on `/admin/*`
- **Audit log** for bulk updates (no undo today)
- **Confirmation email** via Gmail/Workspace
- **Cancellation flow** that releases inventory
- **Reservation lookup** backed by real data

## Part C — Backend Handoff Report (deliverable)

Write `BACKEND_HANDOFF.md` at repo root, structured for Codex to act on:

1. **App overview** — Curtis Inn direct booking; admin + public site share one data model; Clover-only payments (never store raw CC).
2. **Current state** — frontend complete, all data in a Zustand in-memory store, mock API layer in `src/services/api.ts`.
3. **Database schema (Postgres / Supabase-compatible)** with column definitions, FKs, and indexes:
   - `room_types`, `rate_overrides`, `inventory_overrides`, `reservations`, `reservation_nights`, `payments`, `promo_codes`, `audit_log`, `admin_users`, `profiles`
4. **RLS policies** per table (public read for room_types only; everything else admin-only via `has_role(uid, 'admin')`; `user_roles` table pattern documented).
5. **API endpoints** to implement (path, method, request, response, auth):
   - Public: `searchAvailability`, `getRoomBySlug`, `createReservation`, `getReservation` (lookup by conf+lastName), `validatePromoCode`, `createCloverSession`, Clover webhook
   - Admin: CRUD for room_types, rate/inventory bulk updates, reservations list/detail/status, payments list, reports
6. **Atomic booking transaction** pseudo-SQL — lock rows, assert `remaining ≥ rooms`, insert reservation + nights, return server-issued conf #.
7. **Authentication flow**:
   - Email/password + Google for admin login (Lovable Cloud Auth)
   - Roles in separate `user_roles` table (per security pattern) — `admin`, `staff`
   - No public guest accounts (booking is anonymous; lookup via conf# + last name)
   - Session attached via Supabase client; `AdminLayout` guard calls `getUser()` and redirects to `/admin/login` if not admin
   - Password reset page at `/admin/reset-password`
8. **Security requirements**:
   - Never store raw CC details — Clover hosted checkout only
   - All write endpoints require `has_role(auth.uid(), 'admin')`
   - Server-side price recomputation on every booking
   - Idempotency key on `createReservation`
   - Audit log every admin mutation
   - Enable HIBP password check
   - CORS locked to production domain
9. **Clover integration**:
   - Hosted payment session → user redirected → webhook flips `payments.status` and `reservations.payment_status`
   - Deposit flow: 1-night base price (current rule, configurable later)
   - `pay_at_property` skips Clover, reservation status = `pending` until property confirms
10. **Email integration** — Gmail/Workspace SMTP, branded HTML templates (confirmation, cancellation, deposit receipt, admin notification).
11. **Environment variables** Codex needs to add: `CLOVER_MERCHANT_ID`, `CLOVER_API_KEY`, `CLOVER_WEBHOOK_SECRET`, `GMAIL_*` SMTP creds, `TAX_RATE`, `DEPOSIT_RULE`.
12. **Open product questions** (from earlier QA report §9) listed verbatim so Codex flags them back to you.
13. **Frontend → backend swap map** — for each `services/api.ts` function and each `inventoryStore` action, the SQL/RPC it maps to. This lets Codex replace internals without touching call sites.
14. **Deploy notes** — Vercel + Lovable Cloud (Supabase), env vars location, build commands, preview vs production.

The report is documentation only — no code changes from Part C.

## Files touched

- `src/components/admin/BulkUpdateDialog.tsx` (fixes 1, 2)
- `src/components/admin/BulkPriceUpdatePanel.tsx` (fix 1)
- `src/pages/BookingPage.tsx` (fix 3)
- `src/pages/CheckoutPage.tsx` (fixes 4, 5)
- `src/pages/admin/AdminRatesPage.tsx` (fix 6 — small action bar above the panel)
- `src/store/inventoryStore.ts` (fix 7 — guard in `getBooked`)
- `BACKEND_HANDOFF.md` (new, Part C)
