const SUPER_ADMIN_CONTROL_PLANE_GRANTS = [
  'admin:roles:manage',
  'users:manage',
  'homepage:manage',
  'modules:manage',
];

export function isSuperAdminGrants(input: string[] | undefined | null): boolean {
  const normalized = Array.isArray(input)
    ? input
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    : [];
  if (normalized.length === 0) return false;
  const exact = new Set(normalized);
  const lower = new Set(normalized.map((entry) => entry.toLowerCase()));
  if (exact.has('*') || exact.has('ALL') || lower.has('all')) return true;
  const permissiveControlPlaneMatch =
    exact.has('admin:roles:manage') &&
    exact.has('users:manage') &&
    (exact.has('homepage:manage') || exact.has('modules:manage'));
  if (permissiveControlPlaneMatch) return true;
  return SUPER_ADMIN_CONTROL_PLANE_GRANTS.every((grant) => exact.has(grant));
}

export function isSuperAdminUser(
  input: { isSuperAdmin?: boolean; permissions?: string[]; role?: string | null } | null | undefined
): boolean {
  if (input?.isSuperAdmin === true) return true;
  const grants = Array.isArray(input?.permissions) ? input.permissions : [];
  const exact = new Set(grants.map((entry) => String(entry || '').trim()));
  const isAdminRole = String(input?.role || '').trim().toUpperCase() === 'ADMINISTRATOR';
  if (isAdminRole && exact.has('admin:roles:manage') && exact.has('users:manage')) {
    return true;
  }
  return isSuperAdminGrants(input?.permissions);
}
