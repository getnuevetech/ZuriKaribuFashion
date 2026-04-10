import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, ProductStatus } from '../db';

export const CATEGORY_PAGE_V2_TYPES = [
  'READY_TO_WEAR',
  'FABRIC_TO_BUY',
  'CUSTOM_TO_WEAR',
  'COUNTRY',
  'SHOP',
] as const;
export type CategoryPageV2Type = (typeof CATEGORY_PAGE_V2_TYPES)[number];

export const CATEGORY_PAGE_V2_FILTER_KEYS = [
  'STYLE',
  'FABRIC_TYPE',
  'MATERIAL',
  'COUNTRY',
  'PRICE',
  'COLOR',
  'CATEGORY',
] as const;
export type CategoryPageV2FilterKey = (typeof CATEGORY_PAGE_V2_FILTER_KEYS)[number];

export const CATEGORY_PAGE_V2_FILTER_INPUT_TYPES = ['DROPDOWN', 'SUGGESTIVE_SEARCH'] as const;
export type CategoryPageV2FilterInputType = (typeof CATEGORY_PAGE_V2_FILTER_INPUT_TYPES)[number];

export const CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS = [
  'IMAGE',
  'LABEL',
  'LIKES_ICON',
  'COUNTRY_ICON',
  'DESIGNER_NAME',
  'PRODUCT_NAME',
  'SHORT_DESCRIPTION',
  'PRICE',
] as const;
export type CategoryPageV2ProductCardFieldKey = (typeof CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS)[number];

type CategoryPageV2ProductCardFieldOrder = {
  key: CategoryPageV2ProductCardFieldKey;
  enabled: boolean;
  order: number;
};

type CategoryPageV2ProductCardSettings = {
  fieldOrder: CategoryPageV2ProductCardFieldOrder[];
  designerNameFontSize: number;
  designerNameColor: string;
  productNameFontSize: number;
  productNameColor: string;
  shortDescriptionFontSize: number;
  shortDescriptionColor: string;
  priceFontSize: number;
  priceColor: string;
  labelFontSize: number;
  labelColor: string;
  labelBackgroundColor: string;
  likesIconSize: number;
  likesIconColor: string;
  countryIconSize: number;
};

export type CategoryPageV2Product = {
  id: string;
  sourceType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
  name: string;
  description?: string;
  image: string;
  ownerName: string;
  country: string;
  priceUsd: number;
  href: string;
  style: string;
  fabricType: string;
  material: string;
  color: string;
  category: string;
};

const settingsFilterRowSchema = z.object({
  id: z.string().trim().max(120),
  key: z.enum(CATEGORY_PAGE_V2_FILTER_KEYS),
  label: z.string().trim().max(80),
  inputType: z.enum(CATEGORY_PAGE_V2_FILTER_INPUT_TYPES),
  enabled: z.boolean(),
  options: z.array(z.string().trim().max(80)).max(100),
  displayOrder: z.number().int().min(0).max(999),
});

const settingsSchema = z.object({
  title: z.string().trim().max(120),
  subtitle: z.string().trim().max(500),
  bannerImage: z.string().trim().max(2048),
  bannerHeight: z.number().int().min(320).max(1200),
  searchPlaceholder: z.string().trim().max(120),
  pageSize: z.number().int().min(8).max(120),
  columns: z.number().int().min(1).max(6),
  showPagination: z.boolean(),
  primaryGridRows: z.number().int().min(1).max(2),
  primaryGridColumns: z.number().int().min(1).max(6),
  primaryGridProductIds: z.array(z.string().trim().min(1)).max(60),
  countryRowCount: z.number().int().min(4).max(30),
  filterDefinitions: z.array(settingsFilterRowSchema).max(20),
  productCard: z.object({
    fieldOrder: z
      .array(
        z.object({
          key: z.enum(CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS),
          enabled: z.boolean(),
          order: z.number().int().min(1).max(99),
        })
      )
      .max(CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.length),
    designerNameFontSize: z.number().int().min(8).max(72),
    designerNameColor: z.string().trim().max(40),
    productNameFontSize: z.number().int().min(8).max(72),
    productNameColor: z.string().trim().max(40),
    shortDescriptionFontSize: z.number().int().min(8).max(72),
    shortDescriptionColor: z.string().trim().max(40),
    priceFontSize: z.number().int().min(8).max(72),
    priceColor: z.string().trim().max(40),
    labelFontSize: z.number().int().min(8).max(72),
    labelColor: z.string().trim().max(40),
    labelBackgroundColor: z.string().trim().max(40),
    likesIconSize: z.number().int().min(8).max(72),
    likesIconColor: z.string().trim().max(40),
    countryIconSize: z.number().int().min(8).max(96),
  }),
});

const settingsPatchSchema = settingsSchema
  .partial()
  .extend({
    productCard: settingsSchema.shape.productCard.partial().optional(),
  });

export type CategoryPageV2Settings = z.infer<typeof settingsSchema>;
type CategoryPageV2FilterRow = z.infer<typeof settingsFilterRowSchema>;

const SETTINGS_KEY_PREFIX = 'CATEGORY_PAGES_V2_';

const DEFAULT_PRODUCT_CARD_FIELD_ORDER: CategoryPageV2ProductCardFieldOrder[] = [
  { key: 'IMAGE', enabled: true, order: 1 },
  { key: 'LABEL', enabled: true, order: 2 },
  { key: 'LIKES_ICON', enabled: true, order: 3 },
  { key: 'COUNTRY_ICON', enabled: true, order: 4 },
  { key: 'DESIGNER_NAME', enabled: true, order: 5 },
  { key: 'PRODUCT_NAME', enabled: true, order: 6 },
  { key: 'SHORT_DESCRIPTION', enabled: true, order: 7 },
  { key: 'PRICE', enabled: true, order: 8 },
];

const createDefaultProductCard = (): CategoryPageV2ProductCardSettings => ({
  fieldOrder: DEFAULT_PRODUCT_CARD_FIELD_ORDER.map((entry) => ({ ...entry })),
  designerNameFontSize: 13,
  designerNameColor: '#6b7280',
  productNameFontSize: 16,
  productNameColor: '#111827',
  shortDescriptionFontSize: 12,
  shortDescriptionColor: '#4b5563',
  priceFontSize: 13,
  priceColor: '#e66045',
  labelFontSize: 11,
  labelColor: '#ffffff',
  labelBackgroundColor: 'rgba(0,0,0,0.7)',
  likesIconSize: 17,
  likesIconColor: '#ffffff',
  countryIconSize: 20,
});

const clampNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, Math.round(numeric)));
};

const normalizeColor = (value: unknown, fallback: string) => {
  const token = normalizeText(value).slice(0, 40);
  return token || fallback;
};

const normalizeProductCardFieldOrder = (
  value: unknown,
  fallbackRows: CategoryPageV2ProductCardFieldOrder[]
): CategoryPageV2ProductCardFieldOrder[] => {
  const fallbackByKey = new Map<CategoryPageV2ProductCardFieldKey, CategoryPageV2ProductCardFieldOrder>(
    fallbackRows.map((entry) => [entry.key, entry])
  );
  const rows = Array.isArray(value) ? value : fallbackRows;
  const collected = new Map<CategoryPageV2ProductCardFieldKey, CategoryPageV2ProductCardFieldOrder>();
  rows.forEach((entry, index) => {
    const row = asObject(entry);
    const keyToken = normalizeText(row.key).toUpperCase();
    if (!CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.includes(keyToken as CategoryPageV2ProductCardFieldKey)) return;
    const key = keyToken as CategoryPageV2ProductCardFieldKey;
    const fallback = fallbackByKey.get(key) || fallbackRows[index] || fallbackRows[0];
    collected.set(key, {
      key,
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallback.enabled,
      order: clampNumber(row.order, fallback.order, 1, 99),
    });
  });
  CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.forEach((key, index) => {
    if (collected.has(key)) return;
    const fallback = fallbackByKey.get(key) || fallbackRows[index] || fallbackRows[0];
    collected.set(key, { ...fallback });
  });
  return Array.from(collected.values()).sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
};

const normalizeProductCardStyle = (
  value: unknown,
  fallback: CategoryPageV2ProductCardSettings
): CategoryPageV2ProductCardSettings => {
  const row = asObject(value);
  return {
    fieldOrder: normalizeProductCardFieldOrder(row.fieldOrder, fallback.fieldOrder),
    designerNameFontSize: clampNumber(row.designerNameFontSize, fallback.designerNameFontSize, 8, 72),
    designerNameColor: normalizeColor(row.designerNameColor, fallback.designerNameColor),
    productNameFontSize: clampNumber(row.productNameFontSize, fallback.productNameFontSize, 8, 72),
    productNameColor: normalizeColor(row.productNameColor, fallback.productNameColor),
    shortDescriptionFontSize: clampNumber(row.shortDescriptionFontSize, fallback.shortDescriptionFontSize, 8, 72),
    shortDescriptionColor: normalizeColor(row.shortDescriptionColor, fallback.shortDescriptionColor),
    priceFontSize: clampNumber(row.priceFontSize, fallback.priceFontSize, 8, 72),
    priceColor: normalizeColor(row.priceColor, fallback.priceColor),
    labelFontSize: clampNumber(row.labelFontSize, fallback.labelFontSize, 8, 72),
    labelColor: normalizeColor(row.labelColor, fallback.labelColor),
    labelBackgroundColor: normalizeColor(row.labelBackgroundColor, fallback.labelBackgroundColor),
    likesIconSize: clampNumber(row.likesIconSize, fallback.likesIconSize, 8, 72),
    likesIconColor: normalizeColor(row.likesIconColor, fallback.likesIconColor),
    countryIconSize: clampNumber(row.countryIconSize, fallback.countryIconSize, 8, 96),
  };
};

const mergeProductCardPatch = (
  base: CategoryPageV2ProductCardSettings,
  patch: unknown
): CategoryPageV2ProductCardSettings => {
  const source = asObject(patch);
  return normalizeProductCardStyle(
    {
      ...base,
      ...source,
      fieldOrder: source.fieldOrder ?? base.fieldOrder,
    },
    base
  );
};

const DEFAULT_FILTERS: Record<CategoryPageV2Type, CategoryPageV2FilterRow[]> = {
  READY_TO_WEAR: [
    { id: randomUUID(), key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    {
      id: randomUUID(),
      key: 'FABRIC_TYPE',
      label: 'Fabric Type',
      inputType: 'SUGGESTIVE_SEARCH',
      enabled: true,
      options: [],
      displayOrder: 2,
    },
    { id: randomUUID(), key: 'MATERIAL', label: 'Material', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 3 },
    { id: randomUUID(), key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
    { id: randomUUID(), key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
  ],
  CUSTOM_TO_WEAR: [
    { id: randomUUID(), key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: randomUUID(), key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: randomUUID(), key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
  ],
  FABRIC_TO_BUY: [
    { id: randomUUID(), key: 'COLOR', label: 'Color', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 1 },
    { id: randomUUID(), key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: randomUUID(), key: 'MATERIAL', label: 'Material', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
    { id: randomUUID(), key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 4 },
    { id: randomUUID(), key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 5 },
  ],
  COUNTRY: [
    { id: randomUUID(), key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: randomUUID(), key: 'CATEGORY', label: 'Category', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: randomUUID(), key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 3 },
  ],
  SHOP: [
    { id: randomUUID(), key: 'CATEGORY', label: 'Category', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 1 },
    { id: randomUUID(), key: 'STYLE', label: 'Style', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 2 },
    { id: randomUUID(), key: 'FABRIC_TYPE', label: 'Fabric Type', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 3 },
    { id: randomUUID(), key: 'MATERIAL', label: 'Material', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 4 },
    { id: randomUUID(), key: 'COLOR', label: 'Color', inputType: 'SUGGESTIVE_SEARCH', enabled: true, options: [], displayOrder: 5 },
    { id: randomUUID(), key: 'COUNTRY', label: 'Country', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 6 },
    { id: randomUUID(), key: 'PRICE', label: 'Price', inputType: 'DROPDOWN', enabled: true, options: [], displayOrder: 7 },
  ],
};

const DEFAULT_SETTINGS: Record<CategoryPageV2Type, CategoryPageV2Settings> = {
  READY_TO_WEAR: {
    title: 'Ready To Wear',
    subtitle: 'Curated fits built for real life.',
    bannerImage: '/rw_hero.jpg',
    bannerHeight: 720,
    searchPlaceholder: 'Search collection...',
    pageSize: 24,
    columns: 4,
    showPagination: true,
    primaryGridRows: 2,
    primaryGridColumns: 3,
    primaryGridProductIds: [],
    countryRowCount: 12,
    filterDefinitions: DEFAULT_FILTERS.READY_TO_WEAR,
    productCard: createDefaultProductCard(),
  },
  FABRIC_TO_BUY: {
    title: 'Fabrics',
    subtitle: 'Source premium materials and textiles.',
    bannerImage: '/fabrics_hero.jpg',
    bannerHeight: 720,
    searchPlaceholder: 'Search fabrics...',
    pageSize: 24,
    columns: 4,
    showPagination: true,
    primaryGridRows: 2,
    primaryGridColumns: 3,
    primaryGridProductIds: [],
    countryRowCount: 12,
    filterDefinitions: DEFAULT_FILTERS.FABRIC_TO_BUY,
    productCard: createDefaultProductCard(),
  },
  CUSTOM_TO_WEAR: {
    title: 'Custom To Wear',
    subtitle: 'Bespoke pieces tailored by African designers.',
    bannerImage: '/custom_hero.jpg',
    bannerHeight: 720,
    searchPlaceholder: 'Search designers...',
    pageSize: 24,
    columns: 4,
    showPagination: true,
    primaryGridRows: 2,
    primaryGridColumns: 3,
    primaryGridProductIds: [],
    countryRowCount: 12,
    filterDefinitions: DEFAULT_FILTERS.CUSTOM_TO_WEAR,
    productCard: createDefaultProductCard(),
  },
  COUNTRY: {
    title: 'Country Products',
    subtitle: 'Curated products by country and category.',
    bannerImage: '/rw_hero.jpg',
    bannerHeight: 680,
    searchPlaceholder: 'Search country products...',
    pageSize: 24,
    columns: 4,
    showPagination: true,
    primaryGridRows: 2,
    primaryGridColumns: 3,
    primaryGridProductIds: [],
    countryRowCount: 12,
    filterDefinitions: DEFAULT_FILTERS.COUNTRY,
    productCard: createDefaultProductCard(),
  },
  SHOP: {
    title: 'Shop',
    subtitle: 'All RTW, FTB, and CTW products in one place.',
    bannerImage: '/rw_hero.jpg',
    bannerHeight: 680,
    searchPlaceholder: 'Search all products...',
    pageSize: 24,
    columns: 4,
    showPagination: true,
    primaryGridRows: 2,
    primaryGridColumns: 3,
    primaryGridProductIds: [],
    countryRowCount: 12,
    filterDefinitions: DEFAULT_FILTERS.SHOP,
    productCard: createDefaultProductCard(),
  },
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toPriceBucket = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) return 'Unknown';
  if (value < 100) return 'Under $100';
  if (value < 250) return '$100 - $249';
  if (value < 500) return '$250 - $499';
  if (value < 1000) return '$500 - $999';
  return '$1000+';
};

const parsePriceBucket = (token: string): { min?: number; max?: number } => {
  const value = String(token || '').trim();
  if (!value) return {};
  if (value === 'Under $100') return { max: 100 };
  if (value === '$100 - $249') return { min: 100, max: 250 };
  if (value === '$250 - $499') return { min: 250, max: 500 };
  if (value === '$500 - $999') return { min: 500, max: 1000 };
  if (value === '$1000+') return { min: 1000 };
  return {};
};

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeToken = (value: unknown) => normalizeText(value).toLowerCase();

const getSettingsKey = (pageType: CategoryPageV2Type) => `${SETTINGS_KEY_PREFIX}${pageType}`;

const ensureSettingsTable = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
};

const normalizeFilters = (pageType: CategoryPageV2Type, rows: unknown): CategoryPageV2FilterRow[] => {
  const fallback = DEFAULT_FILTERS[pageType];
  const rawRows = Array.isArray(rows) ? rows : fallback;
  const nextByKey = new Map<CategoryPageV2FilterKey, CategoryPageV2FilterRow>();
  for (const [index, raw] of rawRows.entries()) {
    const row = asObject(raw);
    const keyToken = normalizeText(row.key).toUpperCase();
    if (!CATEGORY_PAGE_V2_FILTER_KEYS.includes(keyToken as CategoryPageV2FilterKey)) continue;
    const key = keyToken as CategoryPageV2FilterKey;
    const fallbackRow = fallback.find((entry) => entry.key === key) || fallback[index] || fallback[0];
    nextByKey.set(key, {
      id: normalizeText(row.id || fallbackRow.id || randomUUID()).slice(0, 120),
      key,
      label: normalizeText(row.label || fallbackRow.label || key).slice(0, 80),
      inputType:
        normalizeText(row.inputType || fallbackRow.inputType).toUpperCase() === 'SUGGESTIVE_SEARCH'
          ? 'SUGGESTIVE_SEARCH'
          : 'DROPDOWN',
      enabled: typeof row.enabled === 'boolean' ? row.enabled : fallbackRow.enabled,
      options: Array.isArray(row.options)
        ? row.options.map((entry) => normalizeText(entry)).filter(Boolean).slice(0, 100)
        : fallbackRow.options,
      displayOrder: Number.isFinite(Number(row.displayOrder))
        ? Math.max(0, Math.min(999, Math.round(Number(row.displayOrder))))
        : fallbackRow.displayOrder,
    });
  }
  for (const fallbackRow of fallback) {
    if (!nextByKey.has(fallbackRow.key)) nextByKey.set(fallbackRow.key, fallbackRow);
  }
  return Array.from(nextByKey.values()).sort((a, b) => a.displayOrder - b.displayOrder);
};

const normalizeSettings = (pageType: CategoryPageV2Type, payload: unknown): CategoryPageV2Settings => {
  const fallback = DEFAULT_SETTINGS[pageType];
  const row = asObject(payload);
  const parsed = settingsSchema.safeParse({
    title: normalizeText(row.title || fallback.title).slice(0, 120),
    subtitle: normalizeText(row.subtitle || fallback.subtitle).slice(0, 500),
    bannerImage: normalizeText(row.bannerImage || fallback.bannerImage).slice(0, 2048),
    bannerHeight: Number.isFinite(Number(row.bannerHeight))
      ? Math.max(320, Math.min(1200, Math.round(Number(row.bannerHeight))))
      : fallback.bannerHeight,
    searchPlaceholder: normalizeText(row.searchPlaceholder || fallback.searchPlaceholder).slice(0, 120),
    pageSize: Number.isFinite(Number(row.pageSize)) ? Math.max(8, Math.min(120, Math.round(Number(row.pageSize)))) : fallback.pageSize,
    columns: Number.isFinite(Number(row.columns)) ? Math.max(1, Math.min(6, Math.round(Number(row.columns)))) : fallback.columns,
    showPagination: typeof row.showPagination === 'boolean' ? row.showPagination : fallback.showPagination,
    primaryGridRows: Number.isFinite(Number(row.primaryGridRows))
      ? Math.max(1, Math.min(2, Math.round(Number(row.primaryGridRows))))
      : fallback.primaryGridRows,
    primaryGridColumns: Number.isFinite(Number(row.primaryGridColumns))
      ? Math.max(1, Math.min(6, Math.round(Number(row.primaryGridColumns))))
      : fallback.primaryGridColumns,
    primaryGridProductIds: Array.isArray(row.primaryGridProductIds)
      ? Array.from(new Set(row.primaryGridProductIds.map((entry) => normalizeText(entry)).filter(Boolean))).slice(0, 60)
      : fallback.primaryGridProductIds,
    countryRowCount: Number.isFinite(Number(row.countryRowCount))
      ? Math.max(4, Math.min(30, Math.round(Number(row.countryRowCount))))
      : fallback.countryRowCount,
    filterDefinitions: normalizeFilters(pageType, row.filterDefinitions),
    productCard: normalizeProductCardStyle(row.productCard, fallback.productCard),
  });
  if (parsed.success) return parsed.data;
  return { ...fallback };
};

const resolvePageTypeToken = (value: string): CategoryPageV2Type | null => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  if (token === 'READY_TO_WEAR' || token === 'READYTOWEAR' || token === 'RTW') return 'READY_TO_WEAR';
  if (token === 'FABRIC_TO_BUY' || token === 'FABRICS_TO_BUY' || token === 'FABRICS' || token === 'FTB') return 'FABRIC_TO_BUY';
  if (token === 'CUSTOM_TO_WEAR' || token === 'CUSTOMTOWEAR' || token === 'DESIGNS' || token === 'CTW') return 'CUSTOM_TO_WEAR';
  if (token === 'COUNTRY' || token === 'COUNTRY_PAGE' || token === 'COUNTRY_PRODUCTS') return 'COUNTRY';
  if (token === 'SHOP' || token === 'SHOP_PAGE') return 'SHOP';
  return null;
};

export function resolveCategoryPageV2Type(value: string): CategoryPageV2Type | null {
  return resolvePageTypeToken(value);
}

const pickFirstImage = (images: Array<{ url: string }> | undefined | null) =>
  Array.isArray(images) && images.length > 0 ? String(images[0]?.url || '') : '';

const mapReadyToWear = (row: any): CategoryPageV2Product => {
  const variationPrices = (Array.isArray(row?.sizeVariations) ? row.sizeVariations : [])
    .map((entry: any) => Number(entry?.price || 0))
    .filter((value: number) => Number.isFinite(value) && value > 0);
  const priceUsd = variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row?.basePrice || 0);
  return {
    id: String(row?.id || ''),
    sourceType: 'READY_TO_WEAR',
    name: normalizeText(row?.name) || 'Ready To Wear',
    description: normalizeText(row?.description) || undefined,
    image: pickFirstImage(row?.images),
    ownerName: normalizeText(row?.designer?.businessName) || 'Designer',
    country: normalizeText(row?.designer?.country),
    priceUsd,
    href: `/readytowear/${String(row?.id || '')}`,
    style: normalizeText(row?.category?.name) || 'Ready To Wear',
    fabricType: normalizeText(row?.fabricCategory?.name) || normalizeText(row?.materialType?.name) || 'Fabric',
    material: normalizeText(row?.materialType?.name) || 'Material',
    color: normalizeText(row?.colors?.[0]) || 'N/A',
    category: 'Ready To Wear',
  };
};

const mapFabric = (row: any): CategoryPageV2Product => ({
  id: String(row?.id || ''),
  sourceType: 'FABRIC_TO_BUY',
  name: normalizeText(row?.name) || 'Fabric',
  description: normalizeText(row?.description) || undefined,
  image: pickFirstImage(row?.images),
  ownerName: normalizeText(row?.seller?.businessName) || 'Seller',
  country: normalizeText(row?.seller?.country),
  priceUsd: Number(row?.finalPrice || row?.sellerPrice || 0),
  href: `/fabricstobuy/${String(row?.id || '')}`,
  style: normalizeText(row?.fabricCategory?.name) || 'Fabric',
  fabricType: normalizeText(row?.fabricCategory?.name) || 'Fabric',
  material: normalizeText(row?.materialType?.name) || 'Material',
  color: normalizeText(row?.predominantColor) || normalizeText(row?.name).split(' ')[0] || 'N/A',
  category: 'Fabrics To Buy',
});

const mapDesign = (row: any): CategoryPageV2Product => ({
  id: String(row?.id || ''),
  sourceType: 'CUSTOM_TO_WEAR',
  name: normalizeText(row?.name) || 'Design',
  description: normalizeText(row?.description) || undefined,
  image: pickFirstImage(row?.images),
  ownerName: normalizeText(row?.designer?.businessName) || 'Designer',
  country: normalizeText(row?.designer?.country),
  priceUsd: Number(row?.finalPrice || row?.basePrice || 0),
  href: `/customtowear/${String(row?.id || '')}`,
  style: normalizeText(row?.category?.name) || 'Custom',
  fabricType: normalizeText(row?.materialType?.name) || 'Fabric',
  material: normalizeText(row?.materialType?.name) || 'Material',
  color: normalizeText(row?.name).split(' ')[0] || 'N/A',
  category: 'Custom To Wear',
});

const loadRawProducts = async (pageType: CategoryPageV2Type, search = ''): Promise<CategoryPageV2Product[]> => {
  const readyPromise =
    pageType === 'FABRIC_TO_BUY'
      ? Promise.resolve([])
      : prisma.readyToWear.findMany({
          where: {
            status: ProductStatus.APPROVED,
            isAvailable: true,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { designer: { businessName: { contains: search, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            category: { select: { name: true } },
            materialType: { select: { name: true } },
            fabricCategory: { select: { name: true } },
            designer: { select: { businessName: true, country: true } },
            sizeVariations: { where: { stock: { gt: 0 } }, select: { price: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 400,
        });
  const fabricPromise =
    pageType === 'READY_TO_WEAR' || pageType === 'CUSTOM_TO_WEAR'
      ? Promise.resolve([])
      : prisma.fabric.findMany({
          where: {
            status: ProductStatus.APPROVED,
            isAvailable: true,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { seller: { businessName: { contains: search, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            materialType: { select: { name: true } },
            fabricCategory: { select: { name: true } },
            seller: { select: { businessName: true, country: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 400,
        });
  const designPromise =
    pageType === 'READY_TO_WEAR' || pageType === 'FABRIC_TO_BUY'
      ? Promise.resolve([])
      : prisma.design.findMany({
          where: {
            status: ProductStatus.APPROVED,
            isAvailable: true,
            ...(search
              ? {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                    { designer: { businessName: { contains: search, mode: 'insensitive' } } },
                  ],
                }
              : {}),
          },
          include: {
            images: { take: 1, orderBy: { sortOrder: 'asc' } },
            category: { select: { name: true } },
            materialType: { select: { name: true } },
            designer: { select: { businessName: true, country: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 400,
        });

  const [readyRows, fabricRows, designRows] = await Promise.all([readyPromise, fabricPromise, designPromise]);
  const products: CategoryPageV2Product[] = [
    ...(readyRows as any[]).map((row) => mapReadyToWear(row)),
    ...(fabricRows as any[]).map((row) => mapFabric(row)),
    ...(designRows as any[]).map((row) => mapDesign(row)),
  ];
  return products.filter((entry) => Boolean(entry.id));
};

type FilterInput = {
  search?: string;
  page?: number;
  limit?: number;
  style?: string[];
  fabricType?: string[];
  material?: string[];
  country?: string[];
  price?: string[];
  color?: string[];
  category?: string[];
};

const listContains = (filterValues: string[] | undefined, value: string) => {
  if (!Array.isArray(filterValues) || filterValues.length === 0) return true;
  const valueToken = normalizeToken(value);
  if (!valueToken) return false;
  return filterValues.some((entry) => {
    const needle = normalizeToken(entry);
    if (!needle) return false;
    return valueToken === needle || valueToken.includes(needle);
  });
};

const filterProducts = (rows: CategoryPageV2Product[], filters: FilterInput): CategoryPageV2Product[] => {
  const style = Array.isArray(filters.style) ? filters.style.filter(Boolean) : [];
  const fabricType = Array.isArray(filters.fabricType) ? filters.fabricType.filter(Boolean) : [];
  const material = Array.isArray(filters.material) ? filters.material.filter(Boolean) : [];
  const country = Array.isArray(filters.country) ? filters.country.filter(Boolean) : [];
  const color = Array.isArray(filters.color) ? filters.color.filter(Boolean) : [];
  const category = Array.isArray(filters.category) ? filters.category.filter(Boolean) : [];
  const prices = Array.isArray(filters.price) ? filters.price.filter(Boolean) : [];

  return rows.filter((row) => {
    if (!listContains(style, row.style)) return false;
    if (!listContains(fabricType, row.fabricType)) return false;
    if (!listContains(material, row.material)) return false;
    if (!listContains(country, row.country)) return false;
    if (!listContains(color, row.color)) return false;
    if (!listContains(category, row.category)) return false;
    if (prices.length > 0) {
      const inPrice = prices.some((bucket) => {
        const range = parsePriceBucket(bucket);
        if (range.min !== undefined && row.priceUsd < range.min) return false;
        if (range.max !== undefined && row.priceUsd >= range.max) return false;
        return true;
      });
      if (!inPrice) return false;
    }
    return true;
  });
};

const hydrateFilterOptions = (
  settings: CategoryPageV2Settings,
  products: CategoryPageV2Product[]
): CategoryPageV2Settings => {
  const unique = <T extends string>(rows: T[]) => Array.from(new Set(rows.map((entry) => normalizeText(entry)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const styleOptions = unique(products.map((row) => row.style));
  const fabricTypeOptions = unique(products.map((row) => row.fabricType));
  const materialOptions = unique(products.map((row) => row.material));
  const countryOptions = unique(products.map((row) => row.country));
  const colorOptions = unique(products.map((row) => row.color));
  const categoryOptions = unique(products.map((row) => row.category));
  const priceOptions = unique(products.map((row) => toPriceBucket(row.priceUsd)));
  return {
    ...settings,
    filterDefinitions: settings.filterDefinitions.map((row) => {
      const fallbackOptions =
        row.key === 'STYLE'
          ? styleOptions
          : row.key === 'FABRIC_TYPE'
            ? fabricTypeOptions
            : row.key === 'MATERIAL'
              ? materialOptions
              : row.key === 'COUNTRY'
                ? countryOptions
                : row.key === 'COLOR'
                  ? colorOptions
                  : row.key === 'CATEGORY'
                    ? categoryOptions
                    : priceOptions;
      const merged = unique([...(row.options || []), ...fallbackOptions]);
      return {
        ...row,
        options: merged.slice(0, 100),
      };
    }),
  };
};

export async function readCategoryPageV2Settings(pageType: CategoryPageV2Type) {
  await ensureSettingsTable();
  const key = getSettingsKey(pageType);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date }>>(
    `SELECT "id", "value", "updatedAt" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    key
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
      settings: { ...DEFAULT_SETTINGS[pageType] },
    };
  }
  try {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      settings: normalizeSettings(pageType, JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return {
      rowId: String(row.id),
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
      settings: { ...DEFAULT_SETTINGS[pageType] },
    };
  }
}

export async function writeCategoryPageV2Settings(pageType: CategoryPageV2Type, patch: unknown, merge = true) {
  const parsedPatch = settingsPatchSchema.parse(patch || {});
  const existing = await readCategoryPageV2Settings(pageType);
  const nextPayload = merge
    ? {
        ...existing.settings,
        ...parsedPatch,
        filterDefinitions: parsedPatch.filterDefinitions || existing.settings.filterDefinitions,
        productCard: mergeProductCardPatch(existing.settings.productCard, parsedPatch.productCard),
      }
    : { ...DEFAULT_SETTINGS[pageType], ...parsedPatch };
  const normalized = normalizeSettings(pageType, nextPayload);
  const serialized = JSON.stringify(normalized);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting" SET "value" = $1, "updatedAt" = NOW() WHERE "id" = $2`,
      serialized,
      existing.rowId
    );
    return normalized;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt") VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    getSettingsKey(pageType),
    serialized
  );
  return normalized;
}

export async function listCategoryPageV2ProductOptions(
  pageType: CategoryPageV2Type,
  input?: { search?: string; limit?: number }
) {
  const search = normalizeText(input?.search);
  const limit = Math.max(20, Math.min(250, Math.round(Number(input?.limit || 120))));
  const rows = await loadRawProducts(pageType, search);
  return rows.slice(0, limit).map((row) => ({
    id: row.id,
    sourceType: row.sourceType,
    name: row.name,
    description: row.description,
    ownerName: row.ownerName,
    country: row.country,
    priceUsd: row.priceUsd,
    image: row.image,
    href: row.href,
  }));
}

export async function readCategoryPageV2Runtime(pageType: CategoryPageV2Type) {
  const [snapshot, products] = await Promise.all([readCategoryPageV2Settings(pageType), loadRawProducts(pageType)]);
  const settings = hydrateFilterOptions(snapshot.settings, products);
  const productById = new Map(products.map((row) => [row.id, row]));
  const primaryGridProducts = (settings.primaryGridProductIds || [])
    .map((id) => productById.get(String(id || '').trim()))
    .filter((row): row is CategoryPageV2Product => Boolean(row));
  const countryCounts = new Map<string, number>();
  for (const row of products) {
    const country = normalizeText(row.country);
    if (!country) continue;
    countryCounts.set(country, Number(countryCounts.get(country) || 0) + 1);
  }
  const countryIcons = Array.from(countryCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(4, Math.min(30, settings.countryRowCount)))
    .map(([country]) => country);
  return {
    ...snapshot,
    settings,
    countryIcons,
    primaryGridProducts,
  };
}

export async function listCategoryPageV2Products(pageType: CategoryPageV2Type, filters: FilterInput) {
  const search = normalizeText(filters.search);
  const page = Math.max(1, Math.round(Number(filters.page || 1)));
  const limit = Math.max(8, Math.min(120, Math.round(Number(filters.limit || 24))));
  const all = await loadRawProducts(pageType, search);
  const filtered = filterProducts(all, filters);
  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const normalizedPage = Math.min(page, pages);
  const start = (normalizedPage - 1) * limit;
  return {
    products: filtered.slice(start, start + limit),
    pagination: {
      page: normalizedPage,
      limit,
      total,
      pages,
    },
  };
}

