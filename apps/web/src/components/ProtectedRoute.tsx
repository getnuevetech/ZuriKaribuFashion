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

  if (!isAuthenticated || !token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles) {
    if (!normalizedRole) {
      return <Navigate to="/login" replace state={{ from: location }} />;
    }

    if (!allowedRoles.includes(normalizedRole)) {
      return <Navigate to={getHomeRouteForRole(normalizedRole)} replace />;
    }
  }

  return <Outlet />;
}
