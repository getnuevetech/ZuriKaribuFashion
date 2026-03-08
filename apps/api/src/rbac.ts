import { UserRole } from './db';

export const Permissions = {
  ADMIN_ACCESS: 'admin:access',
  ADMIN_DASHBOARD_READ: 'admin:dashboard:read',
  ADMIN_ROLE_MANAGE: 'admin:roles:manage',
  CUSTOMER_ACCESS: 'customer:access',
  SELLER_ACCESS: 'seller:access',
  DESIGNER_ACCESS: 'designer:access',
  QA_ACCESS: 'qa:access',
  USERS_READ: 'users:read',
  USERS_MANAGE: 'users:manage',
  VENDOR_PROFILES_READ: 'vendor_profiles:read',
  VENDOR_PROFILES_REVIEW: 'vendor_profiles:review',
  SESSION_AUDIT_READ: 'session_audit:read',
  PRODUCTS_MANAGE: 'products:manage',
  ORDERS_MANAGE: 'orders:manage',
  PRICING_MANAGE: 'pricing:manage',
  CURRENCY_MANAGE: 'currency:manage',
  TRAFFIC_READ: 'traffic:read',
  MEASUREMENT_TEMPLATES_MANAGE: 'measurement_templates:manage',
  ORDERS_CREATE: 'orders:create',
  ORDERS_READ_SELF: 'orders:read:self',
  ORDERS_READ_ASSIGNED: 'orders:read:assigned',
  ORDERS_READ_ALL: 'orders:read:all',
  ORDERS_UPDATE_SELF: 'orders:update:self',
  ORDERS_UPDATE_ASSIGNED: 'orders:update:assigned',
  ORDERS_UPDATE_ALL: 'orders:update:all',
  PAYMENTS_CREATE: 'payments:create',
  UPLOADS_CREATE: 'uploads:create',
  HOMEPAGE_MANAGE: 'homepage:manage',
  BANNERS_MANAGE: 'banners:manage',
} as const;

export type Permission = (typeof Permissions)[keyof typeof Permissions];
type PermissionGrant = Permission | '*';
type PermissionCatalogEntry = {
  key: Permission;
  label: string;
  group: 'CORE' | 'USERS' | 'VENDORS' | 'CATALOG' | 'OPERATIONS' | 'MARKETING' | 'SYSTEM';
  description: string;
};

export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  {
    key: Permissions.ADMIN_ACCESS,
    label: 'Admin panel access',
    group: 'CORE',
    description: 'Allows entering the admin dashboard.',
  },
  {
    key: Permissions.ADMIN_DASHBOARD_READ,
    label: 'View admin dashboard',
    group: 'CORE',
    description: 'View platform summary metrics and dashboard widgets.',
  },
  {
    key: Permissions.ADMIN_ROLE_MANAGE,
    label: 'Manage admin roles',
    group: 'SYSTEM',
    description: 'Create, edit, assign, and remove admin permission roles.',
  },
  {
    key: Permissions.USERS_READ,
    label: 'View users',
    group: 'USERS',
    description: 'View user records and filters.',
  },
  {
    key: Permissions.USERS_MANAGE,
    label: 'Manage users',
    group: 'USERS',
    description: 'Create, edit, activate, suspend, and reject users.',
  },
  {
    key: Permissions.VENDOR_PROFILES_READ,
    label: 'View vendor profiles',
    group: 'VENDORS',
    description: 'View vendor profile submissions and details.',
  },
  {
    key: Permissions.VENDOR_PROFILES_REVIEW,
    label: 'Review vendor profiles',
    group: 'VENDORS',
    description: 'Approve or reject vendor profile submissions.',
  },
  {
    key: Permissions.SESSION_AUDIT_READ,
    label: 'View session audit',
    group: 'SYSTEM',
    description: 'View vendor session audit trail.',
  },
  {
    key: Permissions.PRODUCTS_MANAGE,
    label: 'Manage products and catalog',
    group: 'CATALOG',
    description: 'Manage categories, materials, products, and product status.',
  },
  {
    key: Permissions.ORDERS_MANAGE,
    label: 'Manage orders',
    group: 'OPERATIONS',
    description: 'View and update order lifecycle across the platform.',
  },
  {
    key: Permissions.PRICING_MANAGE,
    label: 'Manage pricing rules',
    group: 'OPERATIONS',
    description: 'Create and update platform pricing and markup rules.',
  },
  {
    key: Permissions.CURRENCY_MANAGE,
    label: 'Manage currency matrix',
    group: 'OPERATIONS',
    description: 'Manage exchange rates, currency rules, and overrides.',
  },
  {
    key: Permissions.TRAFFIC_READ,
    label: 'View traffic reports',
    group: 'MARKETING',
    description: 'View order and revenue traffic analytics.',
  },
  {
    key: Permissions.BANNERS_MANAGE,
    label: 'Manage banners',
    group: 'MARKETING',
    description: 'Create and edit homepage banners.',
  },
  {
    key: Permissions.HOMEPAGE_MANAGE,
    label: 'Manage homepage content',
    group: 'MARKETING',
    description: 'Manage homepage sections, cards, stories, and visibility.',
  },
  {
    key: Permissions.MEASUREMENT_TEMPLATES_MANAGE,
    label: 'Manage measurement templates',
    group: 'CATALOG',
    description: 'Create and update customer measurement templates.',
  },
  {
    key: Permissions.UPLOADS_CREATE,
    label: 'Upload assets',
    group: 'CORE',
    description: 'Upload images and media assets.',
  },
];

export const ROLE_HOME_ROUTE: Record<UserRole, string> = {
  [UserRole.CUSTOMER]: '/dashboard',
  [UserRole.FABRIC_SELLER]: '/seller',
  [UserRole.FASHION_DESIGNER]: '/designer',
  [UserRole.QA_TEAM]: '/qa',
  [UserRole.ADMINISTRATOR]: '/admin',
};

export const ROLE_PERMISSIONS: Record<UserRole, PermissionGrant[]> = {
  [UserRole.ADMINISTRATOR]: Object.values(Permissions),
  [UserRole.CUSTOMER]: [
    Permissions.CUSTOMER_ACCESS,
    Permissions.ORDERS_CREATE,
    Permissions.ORDERS_READ_SELF,
    Permissions.PAYMENTS_CREATE,
    Permissions.UPLOADS_CREATE,
  ],
  [UserRole.FABRIC_SELLER]: [
    Permissions.SELLER_ACCESS,
    Permissions.ORDERS_READ_ASSIGNED,
    Permissions.ORDERS_UPDATE_SELF,
    Permissions.UPLOADS_CREATE,
  ],
  [UserRole.FASHION_DESIGNER]: [
    Permissions.DESIGNER_ACCESS,
    Permissions.ORDERS_READ_ASSIGNED,
    Permissions.ORDERS_UPDATE_SELF,
    Permissions.UPLOADS_CREATE,
  ],
  [UserRole.QA_TEAM]: [
    Permissions.QA_ACCESS,
    Permissions.ORDERS_READ_ASSIGNED,
    Permissions.ORDERS_UPDATE_ASSIGNED,
    Permissions.UPLOADS_CREATE,
  ],
};

export function getRolePermissions(role: UserRole): PermissionGrant[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermissionFromGrants(grants: readonly string[], permission: Permission): boolean {
  if (!Array.isArray(grants) || grants.length === 0) {
    return false;
  }
  return grants.includes('*') || grants.includes(permission);
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const grants = getRolePermissions(role) as string[];
  return hasPermissionFromGrants(grants, permission);
}

export function hasAnyPermissionFromGrants(grants: readonly string[], permissions: Permission[]): boolean {
  if (permissions.length === 0) {
    return true;
  }
  return permissions.some((permission) => hasPermissionFromGrants(grants, permission));
}

export function sanitizePermissionGrants(input: unknown): PermissionGrant[] {
  if (!Array.isArray(input)) {
    return [];
  }
  const valid = new Set<string>([...Object.values(Permissions), '*']);
  const deduped = new Set<PermissionGrant>();
  for (const item of input) {
    const grant = String(item || '').trim() as PermissionGrant;
    if (!grant || !valid.has(grant)) continue;
    deduped.add(grant);
  }
  return Array.from(deduped.values());
}

export function getPermissionCatalog() {
  return PERMISSION_CATALOG.slice();
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  const grants = getRolePermissions(role) as string[];
  return hasAnyPermissionFromGrants(grants, permissions);
}
