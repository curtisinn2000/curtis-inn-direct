import type { RequestHandler } from 'express';
import { forbidden, unauthorized } from './errors.js';
import type { AdminUser } from './middleware.js';

export const permissions = {
  dashboardRead: 'dashboard.read',
  reservationsRead: 'reservations.read',
  reservationsManage: 'reservations.manage',
  availabilityRead: 'availability.read',
  availabilityManage: 'availability.manage',
  roomsRead: 'rooms.read',
  roomsManage: 'rooms.manage',
  ratesRead: 'rates.read',
  ratesManage: 'rates.manage',
  paymentsRead: 'payments.read',
  contentRead: 'content.read',
  contentManage: 'content.manage',
  reportsRead: 'reports.read',
  profileManage: 'profile.manage',
  usersManage: 'users.manage',
  policiesRead: 'policies.read',
  policiesManage: 'policies.manage',
  integrationsRead: 'integrations.read',
  integrationsManage: 'integrations.manage',
  auditRead: 'audit.read',
} as const;

export type PermissionKey = typeof permissions[keyof typeof permissions];

export function hasPermission(user: AdminUser | undefined, permission: PermissionKey) {
  return Boolean(user?.permissions.includes(permission));
}

export function requirePermission(permission: PermissionKey): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!hasPermission(req.user, permission)) {
      return next(forbidden(`Permission required: ${permission}`));
    }
    return next();
  };
}
