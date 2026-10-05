import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { hasAdminPermission, useAdminSession } from '@/contexts/AdminSessionContext';

export function RequireAdminPermission({ permission, children }: { permission: string; children: ReactNode }) {
  const { user } = useAdminSession();
  if (hasAdminPermission(user, permission)) return <>{children}</>;
  const fallback = user.permissions.includes('reservations.read') ? '/admin/reservations' : '/admin/settings';
  return <Navigate to={fallback} replace />;
}
