import { Router } from 'express';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, requireAdmin, requireAuth } from '../middleware.js';
import {
  bulkInventorySchema,
  bulkRatesSchema,
  rateWriteSchema,
  remainingWriteSchema,
  roomWriteSchema,
  statusUpdateSchema,
} from '../schemas.js';
import { audit, paymentFromRow, reservationFromRow, roomFromRow } from '../transformers.js';
import { getBookedCount } from '../services/availability.js';
import { slugify } from '../services/rooms.js';
import { badRequest, notFound } from '../errors.js';
import { config } from '../config.js';
import { addDaysKey, hotelTodayKey } from '../date-utils.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

const calendarQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
  roomId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
});

const ACTIVE_HOLD_STATUSES = ['pending', 'confirmed', 'checked_in'];

adminRouter.get('/dashboard', asyncHandler(async (_req, res) => {
  const stats = await pool.query(
    `with totals as (
       select coalesce(sum(base_inventory), 0)::int as total_rooms from room_types where is_active = true
     ), today_booked as (
       select coalesce(sum(rn.rooms), 0)::int as booked
       from reservation_nights rn
       join reservations r on r.id = rn.reservation_id
       where rn.stay_date = current_date and r.status in ('pending','confirmed','checked_in')
     )
     select
       (select count(*)::int from reservations where check_in = current_date and status in ('pending','confirmed')) as arrivals_today,
       (select count(*)::int from reservations where check_out = current_date and status in ('checked_in','confirmed')) as departures_today,
       (select count(*)::int from reservations where check_in <= current_date and check_out > current_date and status = 'checked_in') as active_stays,
       (select count(*)::int from reservations where status = 'pending') as pending_requests,
       (select count(*)::int from reservations where status = 'confirmed') as confirmed_bookings,
       coalesce(round((today_booked.booked::numeric / nullif(totals.total_rooms, 0)) * 100), 0)::int as occupancy_percent,
       greatest(totals.total_rooms - today_booked.booked, 0)::int as available_rooms,
       totals.total_rooms,
       coalesce((select sum(total_cents) from reservations where check_in = current_date and payment_status in ('paid','deposit_paid')), 0)::int as revenue_today_cents,
       coalesce((select sum(total_cents) from reservations where date_trunc('month', created_at) = date_trunc('month', now()) and payment_status in ('paid','deposit_paid')), 0)::int as revenue_month_cents
     from totals, today_booked`,
  );
  const row = stats.rows[0];
  res.json({
    arrivalsToday: row.arrivals_today,
    departuresToday: row.departures_today,
    activeStays: row.active_stays,
    pendingRequests: row.pending_requests,
    confirmedBookings: row.confirmed_bookings,
    occupancyPercent: row.occupancy_percent,
    availableRooms: row.available_rooms,
    totalRooms: row.total_rooms,
    revenueToday: row.revenue_today_cents / 100,
    revenueThisMonth: row.revenue_month_cents / 100,
  });
}));

adminRouter.get('/rooms', asyncHandler(async (_req, res) => {
  const result = await pool.query(`select *, $1::numeric as tax_rate from room_types order by sort_order, name`, [config.TAX_RATE]);
  res.json(result.rows.map(roomFromRow));
}));

adminRouter.get('/calendar', asyncHandler(async (req, res) => {
  const input = calendarQuerySchema.parse(req.query);
  const start = input.start ?? hotelTodayKey();
  const dates = Array.from({ length: input.days }, (_, index) => addDaysKey(start, index));
  const roomParams = input.roomId === 'all' ? [] : [input.roomId];
  const roomsResult = await pool.query(
    `select *, $1::numeric as tax_rate
     from room_types
     where is_active = true
       and ($2::uuid is null or id = $2::uuid)
     order by sort_order, name`,
    [config.TAX_RATE, roomParams[0] ?? null],
  );

  const rooms = [];
  const occupancy = dates.map(date => ({ date, booked: 0, total: 0, pct: 0 }));

  for (const row of roomsResult.rows) {
    const days = [];
    for (const date of dates) {
      const dayResult = await pool.query(
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
        [row.id, row.base_inventory, row.base_price, date, ACTIVE_HOLD_STATUSES],
      );
      const day = dayResult.rows[0];
      const inventory = Number(day.inventory);
      const booked = Number(day.booked);
      const status = String(day.status) as 'open' | 'closed';
      const remaining = status === 'closed' ? 0 : Math.max(0, inventory - booked);
      const occupancyDay = occupancy.find(item => item.date === date)!;
      occupancyDay.booked += booked;
      occupancyDay.total += status === 'closed' ? 0 : inventory;
      days.push({
        date,
        inventory,
        booked,
        remaining,
        status,
        rate: Number(day.rate),
      });
    }
    rooms.push({
      roomType: roomFromRow(row),
      days,
    });
  }

  for (const day of occupancy) {
    day.pct = day.total ? day.booked / day.total : 0;
  }

  res.json({ start, dates, rooms, occupancy });
}));

adminRouter.post('/rooms', asyncHandler(async (req, res) => {
  const input = roomWriteSchema.parse(req.body);
  const slug = input.slug ?? slugify(input.name);
  const result = await pool.query(
    `insert into room_types (
      slug, name, short_description, long_description, occupancy, bed_type, base_inventory,
      base_price, is_active, images, amenities, policies, cancellation_terms, sort_order
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     returning *, $15::numeric as tax_rate`,
    [
      slug, input.name, input.shortDescription, input.longDescription, input.occupancy, input.bedType,
      input.baseInventory, input.basePrice, input.isActive, input.images, input.amenities ?? null,
      input.policies ?? null, input.cancellationTerms ?? null, input.sortOrder, config.TAX_RATE,
    ],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'room_type', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(roomFromRow(result.rows[0]));
}));

adminRouter.put('/rooms/:id', asyncHandler(async (req, res) => {
  const roomId = z.string().uuid().parse(req.params.id);
  const input = roomWriteSchema.parse(req.body);
  const result = await pool.query(
    `update room_types set
      name=$2, short_description=$3, long_description=$4, occupancy=$5, bed_type=$6,
      base_inventory=$7, base_price=$8, is_active=$9, images=$10,
      amenities=coalesce($11, amenities), policies=coalesce($12, policies),
      cancellation_terms=coalesce($13, cancellation_terms), sort_order=$14, updated_at=now()
     where id=$1
     returning *, $15::numeric as tax_rate`,
    [
      roomId, input.name, input.shortDescription, input.longDescription, input.occupancy, input.bedType,
      input.baseInventory, input.basePrice, input.isActive, input.images, input.amenities ?? null,
      input.policies ?? null, input.cancellationTerms ?? null, input.sortOrder, config.TAX_RATE,
    ],
  );
  if (!result.rowCount) throw notFound('room_not_found', 'Room type was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'room_type', entityId: roomId, action: 'update', after: input });
  res.json(roomFromRow(result.rows[0]));
}));

adminRouter.delete('/rooms/:id', asyncHandler(async (req, res) => {
  const roomId = z.string().uuid().parse(req.params.id);
  const before = await pool.query(`select * from room_types where id = $1`, [roomId]);
  if (!before.rowCount) throw notFound('room_not_found', 'Room type was not found.');

  const result = await pool.query(
    `update room_types
     set is_active = false, updated_at = now()
     where id = $1
     returning *, $2::numeric as tax_rate`,
    [roomId, config.TAX_RATE],
  );
  await audit(pool, {
    actorId: req.user!.id,
    entity: 'room_type',
    entityId: roomId,
    action: 'deactivate',
    before: roomFromRow({ ...before.rows[0], tax_rate: config.TAX_RATE }),
    after: roomFromRow(result.rows[0]),
  });
  res.json(roomFromRow(result.rows[0]));
}));

adminRouter.post('/rates/set', asyncHandler(async (req, res) => {
  const input = rateWriteSchema.parse(req.body);
  await pool.query(
    `insert into rate_overrides(room_type_id, stay_date, rate, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_type_id, stay_date)
     do update set rate = excluded.rate, updated_by = excluded.updated_by, updated_at = now()`,
    [input.roomId, input.date, input.rate, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'rate_override', entityId: `${input.roomId}|${input.date}`, action: 'set', after: input });
  res.json({ ok: true });
}));

adminRouter.post('/inventory/remaining', asyncHandler(async (req, res) => {
  const input = remainingWriteSchema.parse(req.body);
  const room = await pool.query(`select base_inventory from room_types where id = $1`, [input.roomId]);
  if (!room.rowCount) throw notFound('room_not_found', 'Room type was not found.');
  const booked = await getBookedCount(pool, input.roomId, input.date);
  if (input.remaining + booked > Number(room.rows[0].base_inventory)) {
    throw badRequest('inventory_exceeded', 'Remaining availability cannot exceed room inventory.', {
      booked,
      maxRemaining: Math.max(0, Number(room.rows[0].base_inventory) - booked),
    });
  }
  const inventory = booked + input.remaining;
  await pool.query(
    `insert into inventory_overrides(room_type_id, stay_date, inventory, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_type_id, stay_date)
     do update set inventory = excluded.inventory, updated_by = excluded.updated_by, updated_at = now()`,
    [input.roomId, input.date, inventory, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'inventory_override', entityId: `${input.roomId}|${input.date}`, action: 'set_remaining', after: { ...input, inventory, booked } });
  res.json({ ok: true, inventory, booked });
}));

adminRouter.post('/inventory/bulk', asyncHandler(async (req, res) => {
  const input = bulkInventorySchema.parse(req.body);
  await withTransaction(async client => {
    const room = await client.query(`select base_inventory from room_types where id = $1`, [input.roomId]);
    if (!room.rowCount) throw notFound('room_not_found', 'Room type was not found.');
    if (input.patch.inventory != null && input.patch.inventory > Number(room.rows[0].base_inventory)) {
      throw badRequest('inventory_exceeded', 'Inventory cannot exceed the room type base inventory.', {
        maxInventory: Number(room.rows[0].base_inventory),
      });
    }
    for (const date of input.dates) {
      await client.query(
        `insert into inventory_overrides(room_type_id, stay_date, inventory, status, updated_by, updated_at)
         values ($1, $2, $3, $4, $5, now())
         on conflict (room_type_id, stay_date)
         do update set
           inventory = coalesce(excluded.inventory, inventory_overrides.inventory),
           status = coalesce(excluded.status, inventory_overrides.status),
           updated_by = excluded.updated_by,
           updated_at = now()`,
        [input.roomId, date, input.patch.inventory ?? null, input.patch.status ?? null, req.user!.id],
      );
    }
    await audit(client, { actorId: req.user!.id, entity: 'inventory_override', entityId: input.roomId, action: 'bulk_update', after: input });
  });
  res.json({ ok: true });
}));

adminRouter.post('/rates/bulk', asyncHandler(async (req, res) => {
  const input = bulkRatesSchema.parse(req.body);
  await withTransaction(async client => {
    const room = await client.query(`select * from room_types where id = $1`, [input.roomId]);
    if (!room.rowCount) throw notFound('room_not_found', 'Room type was not found.');
    for (const date of input.dates) {
      const current = await client.query(
        `select coalesce(ro.rate, round($2::numeric * case when extract(dow from $3::date) in (0,6) then 1.10 else 1.00 end)::int)::int as rate
         from (select 1) s
         left join rate_overrides ro on ro.room_type_id = $1 and ro.stay_date = $3`,
        [input.roomId, room.rows[0].base_price, date],
      );
      const currentRate = Number(current.rows[0].rate);
      let nextRate = currentRate;
      if (input.rule.kind === 'set') nextRate = input.rule.amount;
      if (input.rule.kind === 'pct') nextRate = currentRate * (1 + input.rule.delta / 100);
      if (input.rule.kind === 'amt') nextRate = currentRate + input.rule.delta;
      const clamped = Math.max(0, Math.min(9999, Math.round(nextRate)));
      await client.query(
        `insert into rate_overrides(room_type_id, stay_date, rate, updated_by, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (room_type_id, stay_date)
         do update set rate = excluded.rate, updated_by = excluded.updated_by, updated_at = now()`,
        [input.roomId, date, clamped, req.user!.id],
      );
    }
    await audit(client, { actorId: req.user!.id, entity: 'rate_override', entityId: input.roomId, action: 'bulk_update', after: input });
  });
  res.json({ ok: true });
}));

adminRouter.delete('/rates/:roomId', asyncHandler(async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : undefined;
  await pool.query(
    `delete from rate_overrides where room_type_id = $1 and ($2::date is null or stay_date >= $2::date)`,
    [req.params.roomId, from ?? null],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'rate_override', entityId: String(req.params.roomId), action: 'clear_future', meta: { from } });
  res.json({ ok: true });
}));

adminRouter.get('/reservations', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select r.*, rt.name as room_type_name,
       coalesce(lines.room_lines, '[]'::json) as room_lines
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     left join lateral (
       select json_agg(json_build_object(
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
     order by r.created_at desc`,
  );
  res.json(result.rows.map(reservationFromRow));
}));

adminRouter.get('/reservations/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `select r.*, rt.name as room_type_name,
       coalesce(lines.room_lines, '[]'::json) as room_lines
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     left join lateral (
       select json_agg(json_build_object(
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
     where r.id = $1`,
    [req.params.id],
  );
  if (!result.rowCount) throw notFound('reservation_not_found', 'Reservation was not found.');
  res.json(reservationFromRow(result.rows[0]));
}));

adminRouter.patch('/reservations/:id/status', asyncHandler(async (req, res) => {
  const input = statusUpdateSchema.parse(req.body);
  const result = await pool.query(
    `with updated as (
       update reservations set status = $2, updated_at = now()
       where id = $1
       returning *
     )
     select updated.*, rt.name as room_type_name,
       coalesce(lines.room_lines, '[]'::json) as room_lines
     from updated
     join room_types rt on rt.id = updated.room_type_id
     left join lateral (
       select json_agg(json_build_object(
         'roomTypeId', l.room_type_id,
         'roomTypeName', lrt.name,
         'roomSlug', lrt.slug,
         'rooms', l.rooms,
         'subtotalAmount', l.subtotal_cents / 100.0
       ) order by lrt.sort_order, lrt.name) as room_lines
       from reservation_room_lines l
       join room_types lrt on lrt.id = l.room_type_id
       where l.reservation_id = updated.id
     ) lines on true`,
    [req.params.id, input.status],
  );
  if (!result.rowCount) throw notFound('reservation_not_found', 'Reservation was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'reservation', entityId: String(req.params.id), action: 'status_update', after: input });
  res.json(reservationFromRow(result.rows[0]));
}));

adminRouter.get('/payments', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select p.*, r.confirmation_number, r.guest_first_name, r.guest_last_name, r.payment_method,
       coalesce(lines.room_type_summary, rt.name) as room_type_summary
     from payments p
     join reservations r on r.id = p.reservation_id
     join room_types rt on rt.id = r.room_type_id
     left join lateral (
       select string_agg(l.rooms || ' x ' || lrt.name, ', ' order by lrt.sort_order, lrt.name) as room_type_summary
       from reservation_room_lines l
       join room_types lrt on lrt.id = l.room_type_id
       where l.reservation_id = r.id
     ) lines on true
     order by p.created_at desc`,
  );
  res.json(result.rows.map(paymentFromRow));
}));

adminRouter.get('/audit-log', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select al.*, coalesce(u.display_name, u.email, 'System') as admin_name
     from audit_log al
     left join app_users u on u.id = al.actor_id
     order by al.created_at desc
     limit 200`,
  );
  res.json(result.rows.map(row => ({
    id: String(row.id),
    adminId: row.actor_id,
    adminName: row.admin_name,
    action: row.action,
    details: `${row.entity}${row.entity_id ? ` ${row.entity_id}` : ''}`,
    entityType: row.entity,
    entityId: row.entity_id,
    createdAt: row.created_at,
  })));
}));
