import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from './db.js';
import { loadActiveAdminUser } from './middleware.js';

describe('active admin sessions', () => {
  it('rejects inactive or missing users returned by the active-user query', async () => {
    const db = { query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }) } as unknown as DbClient;
    await expect(loadActiveAdminUser(db, 'inactive-user')).resolves.toBeNull();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('u.is_active = true'), ['inactive-user']);
  });
});
