import { resolveAssetUrl } from '../../services/api';

export type DesignerSpotlightDTO = {
  id: string;
  profileId: string;
  vendorType: string;
  name: string;
  country: string;
  flagCode: string;
  quote: string;
  image: string;
  linkMode: string;
  externalUrl: string;
  blog: any;
};

type SpotlightMapperArgs = {
  designerSpotlightsData: unknown;
  fallbackDesigners: Array<{
    id: string;
    name: string;
    country: string;
    flag?: string;
    quote: string;
    image: string;
  }>;
};

const countryNameToCode: Record<string, string> = {
  algeria: 'DZ',
  angola: 'AO',
  benin: 'BJ',
  botswana: 'BW',
  'burkina faso': 'BF',
  burundi: 'BI',
  'cabo verde': 'CV',
  cameroon: 'CM',
  'central african republic': 'CF',
  chad: 'TD',
  comoros: 'KM',
  congo: 'CG',
  'democratic republic of the congo': 'CD',
  'dr congo': 'CD',
  "cote d'ivoire": 'CI',
  'cote d’ivoire': 'CI',
  djibouti: 'DJ',
  egypt: 'EG',
  'equatorial guinea': 'GQ',
  eritrea: 'ER',
  eswatini: 'SZ',
  ethiopia: 'ET',
  gabon: 'GA',
  gambia: 'GM',
  ghana: 'GH',
  guinea: 'GN',
  'guinea-bissau': 'GW',
  kenya: 'KE',
  lesotho: 'LS',
  liberia: 'LR',
  libya: 'LY',
  madagascar: 'MG',
  malawi: 'MW',
  mali: 'ML',
  mauritania: 'MR',
  mauritius: 'MU',
  morocco: 'MA',
  mozambique: 'MZ',
  namibia: 'NA',
  niger: 'NE',
  nigeria: 'NG',
  rwanda: 'RW',
  senegal: 'SN',
  seychelles: 'SC',
  'sierra leone': 'SL',
  somalia: 'SO',
  'south africa': 'ZA',
  'south sudan': 'SS',
  sudan: 'SD',
  tanzania: 'TZ',
  togo: 'TG',
  tunisia: 'TN',
  uganda: 'UG',
  zambia: 'ZM',
  zimbabwe: 'ZW',
};

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

const PUBLIC_BASE = (() => {
  const base = String(import.meta.env.BASE_URL || '/').trim();
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
})();

const normalizeImageUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('/')) return `${PUBLIC_BASE}${raw.slice(1)}`;
  return resolveAssetUrl(raw) || raw;
};

const resolveCountryCode = (country: unknown, explicitFlag: unknown) => {
  const explicit = String(explicitFlag || '').trim();
  if (/^[a-z]{2}$/i.test(explicit)) return explicit.toUpperCase();
  const raw = String(country || '').trim();
  if (!raw) return '';
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const normalized = raw.toLowerCase();
  return countryNameToCode[normalized] || countryNameToCode[normalized.split(',')[0]?.trim() || ''] || '';
};

export const mapDesignerSpotlights = (args: SpotlightMapperArgs): DesignerSpotlightDTO[] => {
  const sourceRows = Array.isArray(args.designerSpotlightsData) ? args.designerSpotlightsData : [];
  if (sourceRows.length > 0) {
    return sourceRows.slice(0, 3).map((row: any, index: number) => {
      const fallback = args.fallbackDesigners[index % Math.max(1, args.fallbackDesigners.length)];
      const country = clampText(row?.country ?? row?.designer?.country, 80, fallback?.country || 'Africa');
      const flagCode = resolveCountryCode(country, asText(row?.flag, row?.countryCode, fallback?.flag || ''));
      return {
        id: String(row?.id ?? index),
        profileId: String(row?.designerId || ''),
        vendorType: asText(row?.vendorType, 'DESIGNER').toUpperCase(),
        name: clampText(row?.name ?? row?.designer?.businessName, 80, fallback?.name || 'Designer'),
        country,
        flagCode,
        quote: clampText(row?.quote, 180, fallback?.quote || 'African fashion stories through craftsmanship.'),
        image: normalizeImageUrl(row?.image) || normalizeImageUrl(fallback?.image) || '/designer_spotlight.jpg',
        linkMode: asText(row?.linkMode, 'DEFAULT_STORE').toUpperCase(),
        externalUrl: asText(row?.externalUrl, ''),
        blog: row?.blog || null,
      };
    });
  }

  return args.fallbackDesigners.map((row) => ({
    id: String(row.id),
    profileId: '',
    vendorType: 'DESIGNER',
    name: clampText(row.name, 80, 'Designer'),
    country: clampText(row.country, 80, 'Africa'),
    flagCode: resolveCountryCode(row.country, row.flag),
    quote: clampText(row.quote, 180, 'African fashion stories through craftsmanship.'),
    image: normalizeImageUrl(row.image) || '/designer_spotlight.jpg',
    linkMode: 'DEFAULT_STORE',
    externalUrl: '',
    blog: null,
  }));
};

export const mapDesignerSpotlightTitle = (rawJenksCopy: unknown): string => {
  const jenksCopy = rawJenksCopy && typeof rawJenksCopy === 'object' ? (rawJenksCopy as Record<string, unknown>) : {};
  return clampText(jenksCopy.designerSpotlightTitle, 60, 'Meet Designers Across Africa');
};
