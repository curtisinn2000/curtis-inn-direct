import { Router } from 'express';
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
import { notFound } from '../errors.js';
import { config } from '../config.js';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

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
      req.params.id, input.name, input.shortDescription, input.longDescription, input.occupancy, input.bedType,
      input.baseInventory, input.basePrice, input.isActive, input.images, input.amenities ?? null,
      input.policies ?? null, input.cancellationTerms ?? null, input.sortOrder, config.TAX_RATE,
    ],
  );
  if (!result.rowCount) throw notFound('room_not_found', 'Room type was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'room_type', entityId: String(req.params.id), action: 'update', after: input });
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
  const booked = await getBookedCount(pool, input.roomId, input.date);
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
    `select r.*, rt.name as room_type_name
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     order by r.created_at desc`,
  );
  res.json(result.rows.map(reservationFromRow));
}));

adminRouter.get('/reservations/:id', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `select r.*, rt.name as room_type_name
     from reservations r
     join room_types rt on rt.id = r.room_type_id
     where r.id = $1`,
    [req.params.id],
  );
  if (!result.rowCount) throw notFound('reservation_not_found', 'Reservation was not found.');
  res.json(reservationFromRow(result.rows[0]));
}));

adminRouter.patch('/reservations/:id/status', asyncHandler(async (req, res) => {
  const input = statusUpdateSchema.parse(req.body);
  const result = await pool.query(
    `update reservations set status = $2, updated_at = now()
     where id = $1
     returning *`,
    [req.params.id, input.status],
  );
  if (!result.rowCount) throw notFound('reservation_not_found', 'Reservation was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'reservation', entityId: String(req.params.id), action: 'status_update', after: input });
  res.json(reservationFromRow(result.rows[0]));
}));

adminRouter.get('/payments', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select p.*, r.confirmation_number, r.guest_first_name, r.guest_last_name, r.payment_method
     from payments p
     join reservations r on r.id = p.reservation_id
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
