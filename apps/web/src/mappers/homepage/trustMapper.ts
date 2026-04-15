import type { HomepageTrustBadgeIcon } from '../../design/homepageExperience';

export type TrustBadgeDTO = {
  id: string;
  title: string;
  subtitle: string;
  icon: HomepageTrustBadgeIcon;
  enabled: boolean;
};

const TRUST_ICONS: HomepageTrustBadgeIcon[] = [
  'SHIELD_CHECK',
  'TRUCK',
  'REFRESH_CW',
  'HEADPHONES',
  'GLOBE',
  'SHOPPING_BAG',
];

const asText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const clampText = (value: unknown, maxLength: number, fallback = '') => {
  const source = asText(value, fallback);
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const toId = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const mapTrustBadges = (rawTrustBadges: unknown, fallbackBadges: TrustBadgeDTO[]): TrustBadgeDTO[] => {
  const sourceRows = Array.isArray(rawTrustBadges) ? rawTrustBadges : [];
  const mapped = sourceRows
    .map((row: any, index: number) => {
      const fallback = fallbackBadges[index % fallbackBadges.length];
      const title = clampText(row?.title, 48, fallback?.title || '');
      const subtitle = clampText(row?.subtitle, 90, fallback?.subtitle || '');
      if (!title || !subtitle) return null;
      const iconCandidate = String(row?.icon || '').trim().toUpperCase() as HomepageTrustBadgeIcon;
      const icon = TRUST_ICONS.includes(iconCandidate) ? iconCandidate : fallback?.icon || TRUST_ICONS[0];
      return {
        id: asText(row?.id, toId(title), `trust-${index + 1}`),
        title,
        subtitle,
        icon,
        enabled: row?.enabled !== false,
      } as TrustBadgeDTO;
    })
    .filter((row): row is TrustBadgeDTO => Boolean(row))
    .slice(0, 6);

  const fallbackEnabled = (Array.isArray(fallbackBadges) ? fallbackBadges : [])
    .map((row, index) => ({
      ...row,
      id: asText(row.id, `trust-fallback-${index + 1}`),
      enabled: row.enabled !== false,
    }))
    .slice(0, 6);

  const resolved = mapped.length > 0 ? mapped : fallbackEnabled;
  return resolved.filter((row) => row.enabled !== false);
};
