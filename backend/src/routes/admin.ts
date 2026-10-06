import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { pool, withTransaction } from '../db.js';
import { asyncHandler, requireAuth } from '../middleware.js';
import { permissions, requirePermission } from '../access.js';
import { settingsRouter } from './settings.js';
import {
  bulkInventorySchema,
  bulkRatesSchema,
  attractionWriteSchema,
  faqWriteSchema,
  galleryWriteSchema,
  heroContentSchema,
  rateWriteSchema,
  remainingWriteSchema,
  reviewWriteSchema,
  roomOptionWriteSchema,
  roomWriteSchema,
  inventoryStatusWriteSchema,
  defaultRateWriteSchema,
  statusUpdateSchema,
} from '../schemas.js';
import {
  attractionFromRow,
  audit,
  faqFromRow,
  galleryImageFromRow,
  paymentFromRow,
  reservationFromRow,
  reviewFromRow,
  roomOptionFromRow,
  roomFromRow,
} from '../transformers.js';
import { getBookedCount } from '../services/availability.js';
import { slugify } from '../services/rooms.js';
import { badRequest, notFound } from '../errors.js';
import { config } from '../config.js';
import { addDaysKey, hotelTodayKey } from '../date-utils.js';
import { getWebsiteContent } from '../services/content.js';
import { uploadContentImage, validateContentImage } from '../services/uploads.js';
import { getAdminCalendarData, setInventoryStatus } from '../services/adminCalendar.js';
import { assertPublishableRoom, bedSummary, normalizeRoomWrite, publicRoomName, validateBaseInventoryChange } from '../services/roomTypes.js';

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use('/settings', settingsRouter);
adminRouter.use('/dashboard', requirePermission(permissions.dashboardRead));
adminRouter.use('/calendar', requirePermission(permissions.availabilityRead));
adminRouter.use('/inventory', requirePermission(permissions.availabilityManage));
adminRouter.use('/rates', requirePermission(permissions.ratesManage));
adminRouter.use('/payments', requirePermission(permissions.paymentsRead));
adminRouter.use('/audit-log', requirePermission(permissions.auditRead));

const calendarQuerySchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(1).max(31).default(14),
  roomId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
});

const contentImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    try {
      validateContentImage(file as Express.Multer.File);
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
});

adminRouter.get('/dashboard', asyncHandler(async (_req, res) => {
  const stats = await pool.query(
    `with totals as (
       select coalesce(sum(base_inventory), 0)::int as total_rooms from room_types where is_active = true and deleted_at is null
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

adminRouter.get('/content', requirePermission(permissions.contentRead), asyncHandler(async (_req, res) => {
  res.json(await getWebsiteContent(pool, { admin: true }));
}));

adminRouter.get('/content/room-options', requirePermission(permissions.contentRead), asyncHandler(async (_req, res) => {
  const [amenities, policies] = await Promise.all([
    pool.query(`select * from room_amenity_options where is_active = true order by sort_order, label`),
    pool.query(`select * from room_policy_options where is_active = true order by sort_order, label`),
  ]);
  res.json({
    amenities: amenities.rows.map(roomOptionFromRow),
    policies: policies.rows.map(roomOptionFromRow),
  });
}));

adminRouter.put('/content/hero', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = heroContentSchema.parse(req.body);
  await withTransaction(async client => {
    for (const [key, value] of Object.entries(input)) {
      await client.query(
        `insert into website_content_settings(key, value, updated_by, updated_at)
         values ($1, $2, $3, now())
         on conflict (key)
         do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
        [key, value, req.user!.id],
      );
    }
    await audit(client, { actorId: req.user!.id, entity: 'website_content', entityId: 'hero', action: 'update', after: input });
  });
  res.json((await getWebsiteContent(pool, { admin: true })).hero);
}));

adminRouter.post('/content/uploads', requirePermission(permissions.contentManage), contentImageUpload.single('image'), asyncHandler(async (req, res) => {
  validateContentImage(req.file);
  const uploaded = await uploadContentImage(req.file);
  await audit(pool, {
    actorId: req.user!.id,
    entity: 'website_content_upload',
    entityId: uploaded.objectName,
    action: 'upload',
    after: uploaded,
  });
  res.status(201).json(uploaded);
}));

adminRouter.post('/content/faqs', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = faqWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into website_faqs(question, answer, category, sort_order, updated_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [input.question, input.answer, input.category, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'website_faq', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(faqFromRow(result.rows[0]));
}));

adminRouter.delete('/content/faqs/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(`delete from website_faqs where id = $1 returning *`, [id]);
  if (!result.rowCount) throw notFound('faq_not_found', 'FAQ item was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'website_faq', entityId: id, action: 'delete', before: faqFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.post('/content/gallery', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = galleryWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into website_gallery_images(url, alt, category, sort_order, updated_by)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [input.url, input.alt, input.category, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'website_gallery_image', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(galleryImageFromRow(result.rows[0]));
}));

adminRouter.delete('/content/gallery/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(`delete from website_gallery_images where id = $1 returning *`, [id]);
  if (!result.rowCount) throw notFound('gallery_image_not_found', 'Gallery image was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'website_gallery_image', entityId: id, action: 'delete', before: galleryImageFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.post('/content/reviews', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = reviewWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into website_reviews(guest_name, rating, comment, review_date, source, is_featured, sort_order, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning *`,
    [input.guestName, input.rating, input.comment, input.date, input.source, input.isFeatured, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'website_review', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(reviewFromRow(result.rows[0]));
}));

adminRouter.delete('/content/reviews/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(`delete from website_reviews where id = $1 returning *`, [id]);
  if (!result.rowCount) throw notFound('review_not_found', 'Review was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'website_review', entityId: id, action: 'delete', before: reviewFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.post('/content/attractions', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = attractionWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into website_attractions(name, description, distance, image, category, sort_order, updated_by)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning *`,
    [input.name, input.description, input.distance, input.image, input.category, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'website_attraction', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(attractionFromRow(result.rows[0]));
}));

adminRouter.delete('/content/attractions/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(`delete from website_attractions where id = $1 returning *`, [id]);
  if (!result.rowCount) throw notFound('attraction_not_found', 'Attraction was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'website_attraction', entityId: id, action: 'delete', before: attractionFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.post('/content/amenities', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = roomOptionWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into room_amenity_options(label, sort_order, updated_by)
     values ($1, $2, $3)
     on conflict (lower(label))
     do update set is_active = true, sort_order = excluded.sort_order, updated_by = excluded.updated_by, updated_at = now()
     returning *`,
    [input.label, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'room_amenity_option', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(roomOptionFromRow(result.rows[0]));
}));

adminRouter.delete('/content/amenities/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(
    `update room_amenity_options set is_active = false, updated_by = $2, updated_at = now()
     where id = $1 and is_active = true
     returning *`,
    [id, req.user!.id],
  );
  if (!result.rowCount) throw notFound('room_amenity_option_not_found', 'Amenity option was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'room_amenity_option', entityId: id, action: 'delete', before: roomOptionFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.post('/content/policies', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const input = roomOptionWriteSchema.parse(req.body);
  const result = await pool.query(
    `insert into room_policy_options(label, sort_order, updated_by)
     values ($1, $2, $3)
     on conflict (lower(label))
     do update set is_active = true, sort_order = excluded.sort_order, updated_by = excluded.updated_by, updated_at = now()
     returning *`,
    [input.label, input.sortOrder, req.user!.id],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'room_policy_option', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(roomOptionFromRow(result.rows[0]));
}));

adminRouter.delete('/content/policies/:id', requirePermission(permissions.contentManage), asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const result = await pool.query(
    `update room_policy_options set is_active = false, updated_by = $2, updated_at = now()
     where id = $1 and is_active = true
     returning *`,
    [id, req.user!.id],
  );
  if (!result.rowCount) throw notFound('room_policy_option_not_found', 'Policy option was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'room_policy_option', entityId: id, action: 'delete', before: roomOptionFromRow(result.rows[0]) });
  res.json({ ok: true });
}));

adminRouter.get('/rooms', requirePermission(permissions.roomsRead), asyncHandler(async (_req, res) => {
  const result = await pool.query(
    `select *, $1::numeric as tax_rate
     from room_types
     where deleted_at is null
     order by sort_order, name`,
    [config.TAX_RATE],
  );
  res.json(result.rows.map(roomFromRow));
}));

adminRouter.get('/rooms/options', requirePermission(permissions.roomsRead), asyncHandler(async (_req, res) => {
  const [amenities, policies] = await Promise.all([
    pool.query(`select * from room_amenity_options where is_active = true order by sort_order, label`),
    pool.query(`select * from room_policy_options where is_active = true order by sort_order, label`),
  ]);
  res.json({ amenities: amenities.rows.map(roomOptionFromRow), policies: policies.rows.map(roomOptionFromRow) });
}));

adminRouter.post('/rooms/uploads', requirePermission(permissions.roomsManage), contentImageUpload.single('image'), asyncHandler(async (req, res) => {
  if (!req.file) throw badRequest('image_required', 'Choose an image to upload.');
  res.status(201).json(await uploadContentImage(req.file));
}));

adminRouter.get('/calendar', asyncHandler(async (req, res) => {
  const input = calendarQuerySchema.parse(req.query);
  const start = input.start ?? hotelTodayKey();
  const dates = Array.from({ length: input.days }, (_, index) => addDaysKey(start, index));
  const data = await getAdminCalendarData(pool, dates, input.roomId === 'all' ? null : input.roomId, config.TAX_RATE);
  res.json({ start, dates, ...data });
}));

adminRouter.post('/rooms', requirePermission(permissions.roomsManage), asyncHandler(async (req, res) => {
  const input = roomWriteSchema.parse(req.body);
  const data = normalizeRoomWrite(input);
  const name = publicRoomName({
    customName: typeof data.customName === 'string' ? data.customName : null,
    standardName: String(data.standardName),
    name: input.name,
  });
  const summary = bedSummary(data.bedrooms);
  const basePrice = input.basePrice ?? 0;
  assertPublishableRoom({ ...input, isActive: input.isActive, basePrice, baseInventory: input.baseInventory, bedrooms: data.bedrooms });
  const slug = input.slug ?? slugify(name);
  const result = await pool.query(
    `insert into room_types (
      slug, name, short_description, long_description, occupancy, bed_type, base_inventory,
      base_price, is_active, images, amenities, policies, cancellation_terms, sort_order,
      category, standard_name, custom_name, bedrooms, max_adults, max_children,
      extra_beds_allowed, max_extra_beds, extra_bed_types, room_size_sq_ft,
      smoking_designation, bathroom_type, bathroom_features, view_types
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28)
     returning *, $29::numeric as tax_rate`,
    [
      slug, name, input.shortDescription, input.longDescription, data.maxGuests, summary,
      input.baseInventory, basePrice, input.isActive, input.images, input.amenities ?? [],
      input.policies ?? [], input.cancellationTerms ?? null, input.sortOrder,
      data.category, data.standardName, data.customName ?? null, JSON.stringify(data.bedrooms), data.maxAdults, data.maxChildren,
      data.extraBedsAllowed, data.maxExtraBeds, data.extraBedTypes, data.roomSizeSqFt ?? null,
      data.smokingDesignation, data.bathroomType, data.bathroomFeatures, data.viewTypes, config.TAX_RATE,
    ],
  );
  await audit(pool, { actorId: req.user!.id, entity: 'room_type', entityId: result.rows[0].id, action: 'create', after: input });
  res.status(201).json(roomFromRow(result.rows[0]));
}));

adminRouter.put('/rooms/:id', requirePermission(permissions.roomsManage), asyncHandler(async (req, res) => {
  const roomId = z.string().uuid().parse(req.params.id);
  const input = roomWriteSchema.parse(req.body);
  const result = await withTransaction(async client => {
    const current = await client.query(`select * from room_types where id = $1 and deleted_at is null for update`, [roomId]);
    if (!current.rowCount) throw notFound('room_not_found', 'Room type was not found.');
    if (input.baseInventory !== Number(current.rows[0].base_inventory)) await validateBaseInventoryChange(client, roomId, input.baseInventory);
    const data = normalizeRoomWrite(input, current.rows[0]);
    const name = publicRoomName({
      customName: typeof data.customName === 'string' ? data.customName : null,
      standardName: String(data.standardName),
      name: input.name,
    });
    const summary = bedSummary(data.bedrooms);
    const basePrice = input.basePrice ?? Number(current.rows[0].base_price);
    assertPublishableRoom({ ...input, isActive: input.isActive, basePrice, baseInventory: input.baseInventory, bedrooms: data.bedrooms });
    const updated = await client.query(
    `update room_types set
      name=$2, short_description=$3, long_description=$4, occupancy=$5, bed_type=$6,
      base_inventory=$7, is_active=$8, images=$9, amenities=$10, policies=$11,
      cancellation_terms=$12, sort_order=$13, category=$14, standard_name=$15, custom_name=$16,
      bedrooms=$17, max_adults=$18, max_children=$19, extra_beds_allowed=$20,
      max_extra_beds=$21, extra_bed_types=$22, room_size_sq_ft=$23,
      smoking_designation=$24, bathroom_type=$25, bathroom_features=$26, view_types=$27, updated_at=now()
     where id=$1
       and deleted_at is null
     returning *, $28::numeric as tax_rate`,
    [
      roomId, name, input.shortDescription, input.longDescription, data.maxGuests, summary,
      input.baseInventory, input.isActive, input.images, input.amenities ?? [], input.policies ?? [],
      input.cancellationTerms !== undefined ? input.cancellationTerms : current.rows[0].cancellation_terms, input.sortOrder, data.category, data.standardName, data.customName ?? null,
      JSON.stringify(data.bedrooms), data.maxAdults, data.maxChildren, data.extraBedsAllowed,
      data.maxExtraBeds, data.extraBedTypes, data.roomSizeSqFt ?? null,
      data.smokingDesignation, data.bathroomType, data.bathroomFeatures, data.viewTypes, config.TAX_RATE,
      ],
    );
    await audit(client, { actorId: req.user!.id, entity: 'room_type', entityId: roomId, action: 'update', before: roomFromRow({ ...current.rows[0], tax_rate: config.TAX_RATE }), after: input });
    return updated.rows[0];
  });
  res.json(roomFromRow(result));
}));

adminRouter.delete('/rooms/:id', requirePermission(permissions.roomsManage), asyncHandler(async (req, res) => {
  const roomId = z.string().uuid().parse(req.params.id);
  const before = await pool.query(`select * from room_types where id = $1 and deleted_at is null`, [roomId]);
  if (!before.rowCount) throw notFound('room_not_found', 'Room type was not found.');

  const result = await pool.query(
    `update room_types
     set is_active = false, deleted_at = now(), updated_at = now()
     where id = $1
       and deleted_at is null
     returning *, $2::numeric as tax_rate`,
    [roomId, config.TAX_RATE],
  );
  await audit(pool, {
    actorId: req.user!.id,
    entity: 'room_type',
    entityId: roomId,
    action: 'delete',
    before: roomFromRow({ ...before.rows[0], tax_rate: config.TAX_RATE }),
    after: roomFromRow(result.rows[0]),
  });
  res.json({ ok: true });
}));

adminRouter.put('/rates/default', asyncHandler(async (req, res) => {
  const input = defaultRateWriteSchema.parse(req.body);
  const result = await pool.query(
    `update room_types set base_price = $2, updated_at = now()
     where id = $1 and deleted_at is null returning *, $3::numeric as tax_rate`,
    [input.roomId, input.rate, config.TAX_RATE],
  );
  if (!result.rowCount) throw notFound('room_not_found', 'Room type was not found.');
  await audit(pool, { actorId: req.user!.id, entity: 'room_type', entityId: input.roomId, action: 'default_rate_update', after: input });
  res.json(roomFromRow(result.rows[0]));
}));

adminRouter.post('/rates/set', asyncHandler(async (req, res) => {
  const input = rateWriteSchema.parse(req.body);
  const room = await pool.query(`select 1 from room_types where id = $1 and deleted_at is null`, [input.roomId]);
  if (!room.rowCount) throw notFound('room_not_found', 'Room type was not found.');
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
  const room = await pool.query(`select base_inventory from room_types where id = $1 and deleted_at is null`, [input.roomId]);
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

adminRouter.patch('/inventory/status', asyncHandler(async (req, res) => {
  const input = inventoryStatusWriteSchema.parse(req.body);
  const day = await withTransaction(client => setInventoryStatus(client, {
    ...input,
    actorId: req.user!.id,
    taxRate: config.TAX_RATE,
  }));
  res.json(day);
}));

adminRouter.post('/inventory/bulk', asyncHandler(async (req, res) => {
  const input = bulkInventorySchema.parse(req.body);
  await withTransaction(async client => {
    const room = await client.query(`select base_inventory from room_types where id = $1 and deleted_at is null`, [input.roomId]);
    if (!room.rowCount) throw notFound('room_not_found', 'Room type was not found.');
    if (input.patch.inventory != null && input.patch.inventory > Number(room.rows[0].base_inventory)) {
      throw badRequest('inventory_exceeded', 'Inventory cannot exceed the room type base inventory.', {
        maxInventory: Number(room.rows[0].base_inventory),
      });
    }
    for (const date of input.dates) {
      const booked = await getBookedCount(client, input.roomId, date);
      if (input.patch.inventory != null && input.patch.inventory < booked) {
        throw badRequest('inventory_below_booked', `Inventory cannot be lower than ${booked} booked room(s) on ${date}.`, {
          date,
          booked,
          requestedInventory: input.patch.inventory,
        });
      }
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
    const room = await client.query(`select * from room_types where id = $1 and deleted_at is null`, [input.roomId]);
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

adminRouter.get('/reservations', requirePermission(permissions.reservationsRead), asyncHandler(async (_req, res) => {
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

adminRouter.get('/reservations/:id', requirePermission(permissions.reservationsRead), asyncHandler(async (req, res) => {
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

adminRouter.patch('/reservations/:id/status', requirePermission(permissions.reservationsManage), asyncHandler(async (req, res) => {
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
