import type { UserRole } from '../types';

export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  CUSTOMER: '/dashboard',
  FABRIC_SELLER: '/seller',
  FASHION_DESIGNER: '/designer',
  QA_TEAM: '/qa',
  ADMINISTRATOR: '/admin',
};

const ADMIN_PERMISSION_ROUTE_PRIORITY: Array<{ route: string; required: string[] }> = [
  { route: '/admin', required: [] },
  { route: '/admin/users', required: ['users:read'] },
  { route: '/admin/orders', required: ['orders:manage'] },
  { route: '/admin/products', required: ['products:manage'] },
  { route: '/admin/pricing', required: ['pricing:manage'] },
  { route: '/admin/payments', required: ['payments:manage'] },
  { route: '/admin/homepage', required: ['homepage:manage'] },
  { route: '/admin/homepage-visibility', required: ['homepage:manage'] },
  { route: '/admin/banners', required: ['banners:manage'] },
  { route: '/admin/roles', required: ['admin:roles:manage', 'users:read'] },
];

const hasAllPermissions = (grants: string[], required: string[]) =>
  required.every((permission) => grants.includes(permission));

export function normalizeRole(role: string | undefined | null): UserRole | null {
  if (!role) {
    return null;
  }
  if (role === 'DESIGNER') {
    return 'FASHION_DESIGNER';
  }
  if (
    role === 'CUSTOMER' ||
    role === 'FABRIC_SELLER' ||
    role === 'FASHION_DESIGNER' ||
    role === 'QA_TEAM' ||
    role === 'ADMINISTRATOR'
  ) {
    return role;
  }
  return null;
}

export function getHomeRouteForRole(role: string | undefined | null): string {
  const normalized = normalizeRole(role);
  if (!normalized) {
    return '/';
  }
  return ROLE_HOME_ROUTE[normalized];
}

export function getAdminHomeRouteForPermissions(permissions: string[] | undefined | null): string {
  const grants = Array.isArray(permissions) ? permissions : [];
  if (grants.length === 0 || grants.includes('*')) {
    return '/admin';
  }
  const match = ADMIN_PERMISSION_ROUTE_PRIORITY.find((item) => hasAllPermissions(grants, item.required));
  return match?.route || '/admin';
}

export function getHomeRouteForUser(user: { role?: string | null; permissions?: string[] } | null | undefined): string {
  const role = normalizeRole(user?.role);
  if (!role) return '/';
  if (role === 'ADMINISTRATOR') {
    return getAdminHomeRouteForPermissions(user?.permissions);
  }
  return ROLE_HOME_ROUTE[role];
}
