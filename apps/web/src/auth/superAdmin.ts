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
  return SUPER_ADMIN_CONTROL_PLANE_GRANTS.every((grant) => exact.has(grant));
}
