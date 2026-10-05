import { describe, expect, it, vi } from 'vitest';
import { hasPermission, permissions, requirePermission } from './access.js';
import type { AdminUser } from './middleware.js';

const owner: AdminUser = {
  id: 'owner-id', email: 'owner@example.com', displayName: 'Owner',
  roleKeys: ['owner'], roleNames: ['Owner'], permissions: Object.values(permissions),
};

describe('admin permissions', () => {
  it('allows only explicitly assigned permissions', () => {
    expect(hasPermission(owner, permissions.usersManage)).toBe(true);
    expect(hasPermission({ ...owner, permissions: [permissions.reservationsRead] }, permissions.usersManage)).toBe(false);
  });

  it('rejects authenticated users without the required role permission', () => {
    const next = vi.fn();
    const middleware = requirePermission(permissions.integrationsManage);
    middleware({ user: { ...owner, roleKeys: ['manager'], roleNames: ['Manager'], permissions: [permissions.policiesManage] } } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: 'forbidden' }));
  });

  it('rejects unauthenticated requests', () => {
    const next = vi.fn();
    requirePermission(permissions.reservationsRead)({} as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401, code: 'unauthorized' }));
  });
});
