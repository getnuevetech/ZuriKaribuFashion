import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { getAdminHomeRouteForPermissions, getHomeRouteForRole } from '../auth/rbac';

interface AdminPermissionGuardProps {
  required?: string[];
  children: ReactNode;
}

export default function AdminPermissionGuard({ required = [], children }: AdminPermissionGuardProps) {
  const { user } = useAuthStore();
  const location = useLocation();
  const role = String(user?.role || '');
  if (role !== 'ADMINISTRATOR') {
    return <Navigate to={getHomeRouteForRole(role)} replace />;
  }

  if (required.length === 0) {
    return <>{children}</>;
  }

  const grants = Array.isArray(user?.permissions) ? user.permissions : [];
  if (grants.length === 0 || grants.includes('*')) {
    return <>{children}</>;
  }

  const allowed = required.every((permission) => grants.includes(permission));
  if (!allowed) {
    const fallbackRoute = getAdminHomeRouteForPermissions(grants);
    if (fallbackRoute === location.pathname) {
      return (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Your admin role does not currently allow access to this page.
        </div>
      );
    }
    return <Navigate to={fallbackRoute} replace />;
  }

  return <>{children}</>;
}
