import type { UserRole } from '../types';

export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  CUSTOMER: '/dashboard',
  FABRIC_SELLER: '/seller',
  FASHION_DESIGNER: '/designer',
  RESELLER_INFLUENCER: '/reseller',
  QA_TEAM: '/qa',
  ADMINISTRATOR: '/admin',
};

const ADMIN_PERMISSION_ROUTE_PRIORITY: Array<{ route: string; required: string[] }> = [
  { route: '/admin', required: [] },
  { route: '/admin/users', required: ['users:read'] },
  { route: '/admin/orders', required: ['orders:manage'] },
  { route: '/admin/products', required: ['products:manage'] },
  { route: '/admin/products/configuration', required: ['products:manage'] },
  { route: '/admin/pricing', required: ['pricing:manage'] },
  { route: '/admin/payments', required: ['payments:manage'] },
  { route: '/admin/backups', required: ['backups:manage'] },
  { route: '/admin/shipping', required: ['shipping:manage'] },
  { route: '/admin/notifications', required: ['notifications:manage'] },
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
  const normalized = String(role || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!normalized) return null;

  if (normalized === 'DESIGNER' || normalized === 'FASHION_DESIGNER' || normalized === 'FASHIONDESIGNER') {
    return 'FASHION_DESIGNER';
  }
  if (normalized === 'SELLER' || normalized === 'FABRIC_SELLER' || normalized === 'FABRICSELLER') {
    return 'FABRIC_SELLER';
  }
  if (normalized === 'CUSTOMER') {
    return 'CUSTOMER';
  }
  if (normalized === 'QA' || normalized === 'QA_TEAM' || normalized === 'QATEAM') {
    return 'QA_TEAM';
  }
  if (
    normalized === 'RESELLER' ||
    normalized === 'INFLUENCER' ||
    normalized === 'RESELLER_INFLUENCER' ||
    normalized === 'RESELLERINFLUENCER'
  ) {
    return 'RESELLER_INFLUENCER';
  }
  if (normalized === 'ADMIN' || normalized === 'ADMINISTRATOR') {
    return 'ADMINISTRATOR';
  }
  if (
    normalized === 'CUSTOMER' ||
    normalized === 'FABRIC_SELLER' ||
    normalized === 'FASHION_DESIGNER' ||
    normalized === 'RESELLER_INFLUENCER' ||
    normalized === 'QA_TEAM' ||
    normalized === 'ADMINISTRATOR'
  ) {
    return normalized;
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
