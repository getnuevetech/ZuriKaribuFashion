import { resolveAssetUrl } from '../../services/api';

export type FeaturedProductLabelDTO = {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  sizePercent?: number;
  fontSizePx?: number;
  isBold?: boolean;
};

export type FeaturedProductDTO = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  designer: string;
  country: string;
  flag?: string;
  productType: string;
  productLabels?: FeaturedProductLabelDTO[];
};

export type FeaturedCollectionsDTO = {
  customToWear: FeaturedProductDTO[];
  readyToWear: FeaturedProductDTO[];
  fabricsToBuy: FeaturedProductDTO[];
};

export type FeaturedSectionTitlesDTO = {
  customToWear: string;
  readyToWear: string;
  fabricsToBuy: string;
};

type FeaturedMapperArgs = {
  featuredData: unknown;
  fallbackCustomToWear: FeaturedProductDTO[];
  fallbackReadyToWear: FeaturedProductDTO[];
  fallbackFabricsToBuy: FeaturedProductDTO[];
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

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const normalizeProductType = (value: unknown, fallback: string) => {
  const normalized = String(value || '').trim().toUpperCase();
  if (!normalized) return fallback;
  if (normalized === 'DESIGN' || normalized === 'CUSTOM_TO_WEAR' || normalized === 'CTW') return 'DESIGN';
  if (normalized === 'FABRIC' || normalized === 'FTB') return 'FABRIC';
  if (normalized === 'READY_TO_WEAR' || normalized === 'RTW') return 'READY_TO_WEAR';
  return fallback;
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

const mapProductLabels = (value: unknown): FeaturedProductLabelDTO[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((row: any, index: number) => {
      const name = clampText(row?.name, 40, '');
      if (!name) return null;
      return {
        id: asText(row?.id, `label-${index + 1}`),
        name,
        textColor: asText(row?.textColor, '#ffffff'),
        backgroundColor: asText(row?.backgroundColor, '#111827'),
        sizePercent: Number.isFinite(Number(row?.sizePercent)) ? Number(row.sizePercent) : undefined,
        fontSizePx: Number.isFinite(Number(row?.fontSizePx)) ? Number(row.fontSizePx) : undefined,
        isBold: typeof row?.isBold === 'boolean' ? row.isBold : undefined,
      } as FeaturedProductLabelDTO;
    })
    .filter((row): row is FeaturedProductLabelDTO => Boolean(row));
};

const toEntryList = (rawSection: unknown): any[] => (Array.isArray(rawSection) ? rawSection : []);

const mapFeaturedEntry = (row: any, fallback: FeaturedProductDTO, fallbackProductType: string): FeaturedProductDTO => {
  const imageCandidates = Array.isArray(row?.images)
    ? row.images
    : Array.isArray(row?.productImages)
      ? row.productImages
      : [];
  const imageFromList = imageCandidates
    .map((entry: any) => normalizeImageUrl(entry?.url || entry?.image || entry))
    .find(Boolean);

  return {
    id: String(row?.id ?? fallback.id),
    name: clampText(row?.name, 80, fallback.name),
    description: clampText(row?.description ?? row?.summary, 240, fallback.description || ''),
    price: toNumber(row?.price ?? row?.sellingPrice ?? row?.basePrice, fallback.price || 0),
    image: imageFromList || normalizeImageUrl(row?.image) || normalizeImageUrl(fallback.image) || '/product1.jpg',
    designer: clampText(
      row?.designer ?? row?.designerName ?? row?.sellerName ?? row?.vendorName ?? row?.designer?.businessName,
      80,
      fallback.designer || 'African Designer'
    ),
    country: clampText(row?.country ?? row?.designer?.country ?? row?.seller?.country, 80, fallback.country || 'Africa'),
    flag: asText(row?.flag, row?.countryCode, fallback.flag || ''),
    productType: normalizeProductType(row?.productType, fallbackProductType),
    productLabels: mapProductLabels(row?.productLabels),
  };
};

const mapSectionRows = (
  rows: any[],
  fallbackRows: FeaturedProductDTO[],
  fallbackProductType: string
): FeaturedProductDTO[] => {
  if (!Array.isArray(rows) || rows.length === 0) {
    return Array.isArray(fallbackRows) ? fallbackRows : [];
  }
  return rows.map((row, index) => {
    const fallback = fallbackRows[index % Math.max(1, fallbackRows.length)] || {
      id: `fallback-${fallbackProductType}-${index + 1}`,
      name: 'Featured Product',
      price: 0,
      image: '/product1.jpg',
      designer: 'African Designer',
      country: 'Africa',
      productType: fallbackProductType,
    };
    return mapFeaturedEntry(row, fallback, fallbackProductType);
  });
};

export const mapFeaturedCollections = (args: FeaturedMapperArgs): FeaturedCollectionsDTO => {
  const raw = args.featuredData && typeof args.featuredData === 'object' ? (args.featuredData as Record<string, any>) : {};

  const directDesigns = toEntryList(raw.FEATURED_DESIGNS);
  const directRtw = toEntryList(raw.FEATURED_READY_TO_WEAR);
  const directFabrics = toEntryList(raw.FEATURED_FABRICS);

  let groupedDesigns: any[] = [];
  let groupedRtw: any[] = [];
  let groupedFabrics: any[] = [];
  const pooledRows = toEntryList(raw.featuredProducts);
  if (pooledRows.length > 0) {
    groupedDesigns = pooledRows.filter((row) => normalizeProductType(row?.productType, '') === 'DESIGN');
    groupedRtw = pooledRows.filter((row) => normalizeProductType(row?.productType, '') === 'READY_TO_WEAR');
    groupedFabrics = pooledRows.filter((row) => normalizeProductType(row?.productType, '') === 'FABRIC');
  }

  return {
    customToWear: mapSectionRows(
      directDesigns.length > 0 ? directDesigns : groupedDesigns,
      args.fallbackCustomToWear,
      'DESIGN'
    ),
    readyToWear: mapSectionRows(
      directRtw.length > 0 ? directRtw : groupedRtw,
      args.fallbackReadyToWear,
      'READY_TO_WEAR'
    ),
    fabricsToBuy: mapSectionRows(
      directFabrics.length > 0 ? directFabrics : groupedFabrics,
      args.fallbackFabricsToBuy,
      'FABRIC'
    ),
  };
};

export const mapFeaturedSectionTitles = (rawJenksCopy: unknown): FeaturedSectionTitlesDTO => {
  const jenksCopy = rawJenksCopy && typeof rawJenksCopy === 'object' ? (rawJenksCopy as Record<string, unknown>) : {};
  return {
    customToWear: clampText(jenksCopy.featuredDesignsTitle, 60, 'Custom To Wear'),
    readyToWear: clampText(jenksCopy.featuredRtwTitle, 60, 'Ready To Wear'),
    fabricsToBuy: clampText(jenksCopy.featuredFabricsTitle, 60, 'Fabrics To Buy'),
  };
};
