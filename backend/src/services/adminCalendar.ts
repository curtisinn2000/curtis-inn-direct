import type { DbClient } from '../db.js';
import { conflict, notFound } from '../errors.js';
import { audit, roomFromRow } from '../transformers.js';

const HOLD_STATUSES = ['pending', 'confirmed', 'checked_in'];

export function calendarDayFromRow(row: Record<string, unknown>) {
  const inventory = Number(row.inventory);
  const booked = Number(row.booked);
  const remaining = Math.max(0, inventory - booked);
  const status = String(row.status) as 'open' | 'closed';
  return {
    date: String(row.stay_date).slice(0, 10),
    inventory,
    booked,
    remaining,
    sellableRemaining: status === 'closed' ? 0 : remaining,
    status,
    availabilityState: status === 'closed' ? 'closed' : remaining === 0 ? 'sold_out' : 'open',
    rate: Number(row.rate),
    updatedAt: row.updated_at ? new Date(String(row.updated_at)).toISOString() : null,
  };
}

async function calendarRows(db: DbClient, dates: string[], roomId: string | null, taxRate: number) {
  return db.query(
    `with requested_dates as (select unnest($1::date[]) as stay_date),
     selected_rooms as (
       select * from room_types
       where is_active = true and deleted_at is null and ($2::uuid is null or id = $2::uuid)
     ), booked as (
       select rn.room_type_id, rn.stay_date,
         coalesce(sum(rn.rooms) filter (where r.status = any($3::reservation_status[])), 0)::int as booked
       from reservation_nights rn join reservations r on r.id = rn.reservation_id
       where rn.stay_date = any($1::date[])
       group by rn.room_type_id, rn.stay_date
     )
     select sr.*, $4::numeric as tax_rate, rd.stay_date::text,
       coalesce(io.inventory, sr.base_inventory)::int as inventory,
       coalesce(io.status, 'open')::text as status,
       coalesce(ro.rate, round(sr.base_price::numeric * case when extract(dow from rd.stay_date) in (0,6) then 1.10 else 1.00 end)::int)::int as rate,
       coalesce(b.booked, 0)::int as booked,
       io.updated_at
     from selected_rooms sr cross join requested_dates rd
     left join inventory_overrides io on io.room_type_id = sr.id and io.stay_date = rd.stay_date
     left join rate_overrides ro on ro.room_type_id = sr.id and ro.stay_date = rd.stay_date
     left join booked b on b.room_type_id = sr.id and b.stay_date = rd.stay_date
     order by sr.sort_order, sr.name, rd.stay_date`,
    [dates, roomId, HOLD_STATUSES, taxRate],
  );
}

export async function getAdminCalendarData(db: DbClient, dates: string[], roomId: string | null, taxRate: number) {
  const result = await calendarRows(db, dates, roomId, taxRate);
  const roomMap = new Map<string, { roomType: ReturnType<typeof roomFromRow>; days: ReturnType<typeof calendarDayFromRow>[] }>();
  const occupancy = new Map(dates.map(date => [date, { date, booked: 0, total: 0, pct: 0 }]));
  for (const row of result.rows) {
    const id = String(row.id);
    if (!roomMap.has(id)) roomMap.set(id, { roomType: roomFromRow(row), days: [] });
    const day = calendarDayFromRow(row);
    roomMap.get(id)!.days.push(day);
    const total = occupancy.get(day.date)!;
    total.booked += day.booked;
    total.total += day.inventory;
  }
  for (const day of occupancy.values()) day.pct = day.total ? day.booked / day.total : 0;
  return { rooms: [...roomMap.values()], occupancy: [...occupancy.values()] };
}

export async function setInventoryStatus(db: DbClient, input: {
  roomId: string;
  date: string;
  status: 'open' | 'closed';
  expectedUpdatedAt?: string | null;
  actorId: string;
  taxRate: number;
}) {
  const room = await db.query(`select id from room_types where id = $1 and is_active = true and deleted_at is null`, [input.roomId]);
  if (!room.rowCount) throw notFound('room_not_found', 'Active room type was not found.');
  const existing = await db.query(
    `select status, updated_at from inventory_overrides where room_type_id = $1 and stay_date = $2 for update`,
    [input.roomId, input.date],
  );
  const currentUpdatedAt = existing.rows[0]?.updated_at ? new Date(existing.rows[0].updated_at).toISOString() : null;
  if (input.expectedUpdatedAt !== undefined && input.expectedUpdatedAt !== currentUpdatedAt) {
    throw conflict('availability_stale', 'Availability changed since the calendar was loaded. Refresh and try again.', { currentUpdatedAt });
  }
  await db.query(
    `insert into inventory_overrides(room_type_id, stay_date, status, updated_by, updated_at)
     values ($1, $2, $3, $4, now())
     on conflict (room_type_id, stay_date) do update set status = excluded.status, updated_by = excluded.updated_by, updated_at = now()`,
    [input.roomId, input.date, input.status, input.actorId],
  );
  await audit(db, {
    actorId: input.actorId, entity: 'inventory_override', entityId: `${input.roomId}|${input.date}`,
    action: 'status_update', before: { status: existing.rows[0]?.status ?? 'open' }, after: { status: input.status },
  });
  const rows = await calendarRows(db, [input.date], input.roomId, input.taxRate);
  return calendarDayFromRow(rows.rows[0]);
}
