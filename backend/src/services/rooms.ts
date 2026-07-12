import type { DbClient } from '../db.js';
import { config } from '../config.js';
import { roomFromRow } from '../transformers.js';
import { notFound } from '../errors.js';

export async function getActiveRooms(db: DbClient) {
  const result = await db.query(
    `select *, $1::numeric as tax_rate
     from room_types
     where is_active = true
       and deleted_at is null
     order by sort_order, name`,
    [config.TAX_RATE],
  );
  return result.rows.map(roomFromRow);
}

export async function getRoomBySlug(db: DbClient, slug: string) {
  const result = await db.query(
    `select *, $1::numeric as tax_rate
     from room_types
     where slug = $2
       and is_active = true
       and deleted_at is null`,
    [config.TAX_RATE, slug],
  );
  return result.rows[0] ? roomFromRow(result.rows[0]) : null;
}

export async function resolveRoom(db: DbClient, input: { roomTypeId?: string; roomSlug?: string }) {
  const result = input.roomTypeId
    ? await db.query(`select * from room_types where id = $1 and is_active = true and deleted_at is null`, [input.roomTypeId])
    : await db.query(`select * from room_types where slug = $1 and is_active = true and deleted_at is null`, [input.roomSlug]);

  if (result.rowCount === 0) throw notFound('room_not_found', 'Room type was not found.');
  return result.rows[0];
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'room';
}
