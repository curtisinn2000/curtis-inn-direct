import { describe, expect, it, vi } from 'vitest';
import type { DbClient } from '../db.js';
import { ensureNotFinalOwner, maskedSecret } from './adminSettings.js';

describe('admin account safety', () => {
  it('prevents removing the final active owner', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'owner-id' }] });
    await expect(ensureNotFinalOwner({ query } as unknown as DbClient, 'owner-id'))
      .rejects.toMatchObject({ status: 409, code: 'final_owner_required' });
  });

  it('allows owner changes when another active owner remains', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rowCount: 1, rows: [{}] })
      .mockResolvedValueOnce({ rowCount: 2, rows: [{ id: 'owner-id' }, { id: 'other-owner' }] });
    await expect(ensureNotFinalOwner({ query } as unknown as DbClient, 'owner-id')).resolves.toBeUndefined();
  });

  it('never returns a configured secret value', () => {
    expect(maskedSecret(true)).toBe('••••••••');
    expect(maskedSecret(false)).toBe('');
  });
});
