import { createContext, useContext } from 'react';
import type { AdminSessionUser } from '@/types';

type AdminSessionContextValue = {
  user: AdminSessionUser;
  refresh: () => Promise<void>;
};

const AdminSessionContext = createContext<AdminSessionContextValue | null>(null);

export const AdminSessionProvider = AdminSessionContext.Provider;

export function useAdminSession() {
  const context = useContext(AdminSessionContext);
  if (!context) throw new Error('useAdminSession must be used inside AdminLayout.');
  return context;
}

export function hasAdminPermission(user: AdminSessionUser, permission: string) {
  return user.permissions.includes(permission);
}
