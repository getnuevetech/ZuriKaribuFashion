import { resolveAssetUrl } from '../../services/api';
import type { AfricanCountry, AfricanRegion } from '../../data/africanCountries';

export type ShopByCategoryDTO = {
  id: string;
  title: string;
  description: string;
  image: string;
  images: string[];
  link: string;
  ctaText: string;
  countLabel: string;
};

export type ShopByCountryDTO = {
  name: string;
  flagCode: string;
  region: AfricanRegion;
  fabrics: string;
  productCount: number;
  href: string;
};

type ShopByCategoryMapperArgs = {
  categoriesData: unknown;
  fallbackCategories: Array<{
    id: string;
    title: string;
    description: string;
    image: string;
    link: string;
  }>;
};

type ShopByCountryMapperArgs = {
  countriesData: unknown;
  staticCountries: AfricanCountry[];
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

const safeHref = (...values: unknown[]) => {
  const fallback = asText(values[values.length - 1], '/shop') || '/shop';
  const href = asText(...values)
    .replace(/^\/designs(\/|$)/i, '/custom$1')
    .replace(/^\/custom-to-wear(\/|$)/i, '/custom$1');
  if (!href) return fallback;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return fallback;
  return href;
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

const parseCategoryImages = (...values: unknown[]) => {
  const output: string[] = [];
  const pushValue = (value: unknown) => {
    const text = normalizeImageUrl(value);
    if (text) output.push(text);
  };
  for (const value of values) {
    if (!value) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => pushValue(entry));
      continue;
    }
    if (typeof value === 'string') {
      const raw = value.trim();
      if (!raw) continue;
      if (raw.startsWith('[') && raw.endsWith(']')) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((entry) => pushValue(entry));
            continue;
          }
        } catch {
          // Fall through to plain split logic.
        }
      }
      raw
        .split(/\r?\n|,|\|/g)
        .map((part) => part.trim())
        .filter(Boolean)
        .forEach((entry) => pushValue(entry));
      continue;
    }
    if (typeof value === 'object') {
      const row = value as Record<string, unknown>;
      if (Array.isArray(row.images)) {
        row.images.forEach((entry) => pushValue(entry));
      }
      pushValue(row.image);
    }
  }
  return Array.from(new Set(output)).slice(0, 5);
};

const normalizeCountLabel = (value: unknown) => {
  const explicitText = asText(value);
  if (explicitText) return clampText(explicitText, 32, '');
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${Math.round(numeric).toLocaleString()}+`;
  }
  return '';
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

const resolveCountryCode = (countryName: unknown, explicitFlag: unknown) => {
  const explicit = String(explicitFlag || '').trim();
  if (/^[a-z]{2}$/i.test(explicit)) return explicit.toUpperCase();
  const raw = String(countryName || '').trim();
  if (!raw) return '';
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const normalized = raw.toLowerCase();
  return countryNameToCode[normalized] || countryNameToCode[normalized.split(',')[0]?.trim() || ''] || '';
};

const isSupportedCategory = (title: string) => {
  const normalized = title.toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('accessor')) return false;
  return (
    normalized.includes('ready') ||
    normalized.includes('fabric') ||
    normalized.includes('custom') ||
    normalized.includes('design')
  );
};

export const mapShopByCategories = (args: ShopByCategoryMapperArgs): ShopByCategoryDTO[] => {
  const fallbackRows = Array.isArray(args.fallbackCategories) ? args.fallbackCategories : [];
  const backendRows = Array.isArray(args.categoriesData) ? args.categoriesData : [];
  const sortedBackendRows = [...backendRows].sort((a: any, b: any) => {
    const aOrder = Number(a?.displayOrder ?? Number.MAX_SAFE_INTEGER);
    const bOrder = Number(b?.displayOrder ?? Number.MAX_SAFE_INTEGER);
    return aOrder - bOrder;
  });
  const supportedRows = sortedBackendRows.filter((row: any) => isSupportedCategory(asText(row?.title, row?.name, '')));
  const sourceRows = (supportedRows.length > 0 ? supportedRows : sortedBackendRows).slice(0, 3);
  const baseRows = sourceRows.length > 0 ? sourceRows : fallbackRows.slice(0, 3);

  return baseRows.map((row: any, index: number) => {
    const fallback = fallbackRows[index % Math.max(1, fallbackRows.length)];
    const images = parseCategoryImages(row?.images, row?.image, fallback?.image);
    return {
      id: String(row?.id ?? fallback?.id ?? index),
      title: clampText(row?.title, 40, asText(fallback?.title, 'Category')),
      description: clampText(row?.description, 120, asText(fallback?.description, 'Explore African fashion products.')),
      image: images[0] || normalizeImageUrl(fallback?.image) || '/product1.jpg',
      images,
      link: safeHref(row?.ctaLink, row?.link, fallback?.link, '/shop'),
      ctaText: 'SHOP NOW',
      countLabel: normalizeCountLabel(row?.countText ?? row?.productCount ?? row?.count),
    } as ShopByCategoryDTO;
  });
};

export const mapShopByCountries = (args: ShopByCountryMapperArgs): ShopByCountryDTO[] => {
  const backendRows = Array.isArray(args.countriesData) ? args.countriesData : [];
  const backendByCode = new Map<string, any>();
  const backendByName = new Map<string, any>();

  for (const row of backendRows) {
    const rowName = asText(row?.name, row?.country, '');
    const rowCode = resolveCountryCode(rowName, asText(row?.flag, row?.code, ''));
    if (rowCode) backendByCode.set(rowCode, row);
    if (rowName) backendByName.set(rowName.toLowerCase(), row);
  }

  return args.staticCountries.map((country) => {
    const backend = backendByCode.get(country.code) || backendByName.get(country.name.toLowerCase()) || null;
    const productCountRaw = Number(backend?.productCount ?? backend?.count ?? backend?.products ?? backend?.itemsCount ?? 0);
    const productCount = Number.isFinite(productCountRaw) && productCountRaw > 0 ? Math.round(productCountRaw) : 0;
    return {
      name: country.name,
      flagCode: country.code,
      region: country.region,
      fabrics: clampText(
        asText(
          backend?.fabrics,
          backend?.textiles,
          Array.isArray(country.textiles) ? country.textiles.slice(0, 2).join(', ') : 'African textiles'
        ),
        48,
        'African textiles'
      ),
      productCount,
      href: `/country-products?country=${encodeURIComponent(country.name)}`,
    };
  });
};
