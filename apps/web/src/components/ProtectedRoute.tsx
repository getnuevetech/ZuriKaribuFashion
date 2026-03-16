import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { UserRole } from '../types';
import { getHomeRouteForRole, normalizeRole } from '../auth/rbac';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user, token } = useAuthStore();
  const location = useLocation();
  const normalizedRole = normalizeRole(user?.role);
  const returnTo = `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;
  const loginPath = `/login?returnTo=${encodeURIComponent(returnTo)}`;

  if (!isAuthenticated || !token) {
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  const requiresPasswordChange = Boolean((user as any)?.requirePasswordChange);
  if (requiresPasswordChange && location.pathname !== '/change-password-required') {
    return <Navigate to="/change-password-required" replace />;
  }

  if (allowedRoles) {
    if (!normalizedRole) {
      return <Navigate to={loginPath} replace state={{ from: location }} />;
    }

    if (!allowedRoles.includes(normalizedRole)) {
      return <Navigate to={getHomeRouteForRole(normalizedRole)} replace />;
    }
  }

  return <Outlet />;
}
