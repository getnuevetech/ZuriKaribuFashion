import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, ProductStatus } from '../db';
import { applyActivePricingRules, readActivePricingRules, type ActivePricingRule } from './pricing-rules';
import { generateProductSku, readProductSkuSettings } from './product-sku';

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
  'DESIGNER_NAME',
  'PRODUCT_NAME',
  'SHORT_DESCRIPTION',
  'PRICE',
] as const;
export type CategoryPageV2ProductCardFieldKey = (typeof CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS)[number];

export const CATEGORY_PAGE_V2_DETAIL_TABS = ['DETAILS', 'SPECS', 'REVIEWS'] as const;
export type CategoryPageV2DetailTabKey = (typeof CATEGORY_PAGE_V2_DETAIL_TABS)[number];

type CategoryPageV2ProductCardSettings = {
  imageEnabled: boolean;
  fieldOrder: CategoryPageV2ProductCardFieldKey[];
  imageAspectRatio: '3:4' | '1:1';
  textGap: number;
  contentPaddingX: number;
  contentPaddingY: number;
  designerNameEnabled: boolean;
  designerNameFontSize: number;
  designerNameColor: string;
  productNameEnabled: boolean;
  productNameFontSize: number;
  productNameColor: string;
  shortDescriptionEnabled: boolean;
  shortDescriptionFontSize: number;
  shortDescriptionColor: string;
  shortDescriptionWordLimit: number;
  priceEnabled: boolean;
  priceFontSize: number;
  priceColor: string;
  priceFontWeight: number;
  labelEnabled: boolean;
  labelFontSize: number;
  labelTextColor: string;
  labelBackgroundColor: string;
  labelPosition: 'TOP_LEFT';
  likesEnabled: boolean;
  likesSize: number;
  likesColor: string;
  likesActiveColor: string;
  likesPosition: 'TOP_RIGHT';
  countryIconEnabled: boolean;
  countryIconSize: number;
  countryIconPosition: 'BOTTOM_RIGHT';
};

type CategoryPageV2DetailViewSettings = {
  titleFontSize: number;
  titleColor: string;
  ownerFontSize: number;
  ownerColor: string;
  priceLabelColor: string;
  priceValueFontSize: number;
  priceValueColor: string;
  descriptionFontSize: number;
  descriptionColor: string;
  specLabelColor: string;
  specValueColor: string;
  tabOrder: CategoryPageV2DetailTabKey[];
  defaultTab: CategoryPageV2DetailTabKey;
  reviewsEnabled: boolean;
  discoverEnabled: boolean;
  likesEnabled: boolean;
};

export type CategoryPageV2Product = {
  id: string;
  sourceType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
  sku?: string;
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
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
  }>;
};

type ProductLabelDisplay = {
  id: string;
  name: string;
  textColor: string;
  backgroundColor: string;
  sizePercent: number;
  fontSizePx: number;
  isBold: boolean;
};

type LabelProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';

const HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY = 'HOMEPAGE_PRODUCT_LABELS';
const DISCOUNT_ADJUSTMENT_TYPE_SET = new Set<string>(['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT']);
const DEFAULT_PRODUCT_LABEL_SETTINGS = {
  newTagDays: 14,
  autoConditions: {
    newTagDaysForSaleProducts: 14,
    autoNewProductTypes: ['FABRIC', 'DESIGN', 'READY_TO_WEAR'] as Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>,
    autoSaleProductTypes: ['FABRIC', 'DESIGN', 'READY_TO_WEAR'] as Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>,
    autoSaleUsePriceDrop: true,
    autoSaleUseMarkdownRules: true,
  },
  appearance: {
    sizePercent: 120,
    fontSizePx: 12,
    isBold: true,
  },
  labels: [
    {
      id: 'new',
      name: 'NEW',
      mode: 'AUTO_NEW' as const,
      textColor: '#ffffff',
      backgroundColor: '#111827',
      isActive: true,
    },
    {
      id: 'sale',
      name: 'SALE',
      mode: 'AUTO_SALE' as const,
      textColor: '#ffffff',
      backgroundColor: '#dc2626',
      isActive: true,
    },
  ],
  assignments: [] as Array<{
    labelId: string;
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    productIds: string[];
  }>,
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
    imageEnabled: z.boolean(),
    fieldOrder: z.array(z.enum(CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS)).max(CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.length),
    imageAspectRatio: z.enum(['3:4', '1:1']),
    textGap: z.number().int().min(0).max(24),
    contentPaddingX: z.number().int().min(0).max(40),
    contentPaddingY: z.number().int().min(0).max(40),
    designerNameEnabled: z.boolean(),
    designerNameFontSize: z.number().int().min(8).max(72),
    designerNameColor: z.string().trim().max(40),
    productNameEnabled: z.boolean(),
    productNameFontSize: z.number().int().min(8).max(72),
    productNameColor: z.string().trim().max(40),
    shortDescriptionEnabled: z.boolean(),
    shortDescriptionFontSize: z.number().int().min(8).max(72),
    shortDescriptionColor: z.string().trim().max(40),
    shortDescriptionWordLimit: z.number().int().min(4).max(24),
    priceEnabled: z.boolean(),
    priceFontSize: z.number().int().min(8).max(72),
    priceColor: z.string().trim().max(40),
  priceFontWeight: z.number().int().min(100).max(900),
    labelEnabled: z.boolean(),
    labelFontSize: z.number().int().min(8).max(72),
    labelTextColor: z.string().trim().max(40),
    labelBackgroundColor: z.string().trim().max(40),
    labelPosition: z.literal('TOP_LEFT'),
    likesEnabled: z.boolean(),
    likesSize: z.number().int().min(8).max(72),
    likesColor: z.string().trim().max(40),
    likesActiveColor: z.string().trim().max(40),
    likesPosition: z.literal('TOP_RIGHT'),
    countryIconEnabled: z.boolean(),
    countryIconSize: z.number().int().min(8).max(96),
    countryIconPosition: z.literal('BOTTOM_RIGHT'),
  }),
  detailView: z.object({
    titleFontSize: z.number().int().min(18).max(96),
    titleColor: z.string().trim().max(40),
    ownerFontSize: z.number().int().min(10).max(42),
    ownerColor: z.string().trim().max(40),
    priceLabelColor: z.string().trim().max(40),
    priceValueFontSize: z.number().int().min(18).max(96),
    priceValueColor: z.string().trim().max(40),
    descriptionFontSize: z.number().int().min(12).max(36),
    descriptionColor: z.string().trim().max(40),
    specLabelColor: z.string().trim().max(40),
    specValueColor: z.string().trim().max(40),
    tabOrder: z.array(z.enum(CATEGORY_PAGE_V2_DETAIL_TABS)).max(CATEGORY_PAGE_V2_DETAIL_TABS.length),
    defaultTab: z.enum(CATEGORY_PAGE_V2_DETAIL_TABS),
    reviewsEnabled: z.boolean(),
    discoverEnabled: z.boolean(),
    likesEnabled: z.boolean(),
  }),
});

const settingsPatchSchema = settingsSchema
  .partial()
  .extend({
    productCard: settingsSchema.shape.productCard.partial().optional(),
    detailView: settingsSchema.shape.detailView.partial().optional(),
  });

export type CategoryPageV2Settings = z.infer<typeof settingsSchema>;
type CategoryPageV2FilterRow = z.infer<typeof settingsFilterRowSchema>;

const SETTINGS_KEY_PREFIX = 'CATEGORY_PAGES_V2_';

const DEFAULT_PRODUCT_CARD_FIELD_ORDER: CategoryPageV2ProductCardFieldKey[] = [
  'DESIGNER_NAME',
  'PRODUCT_NAME',
  'SHORT_DESCRIPTION',
  'PRICE',
];

const createDefaultProductCard = (): CategoryPageV2ProductCardSettings => ({
  imageEnabled: true,
  fieldOrder: [...DEFAULT_PRODUCT_CARD_FIELD_ORDER],
  imageAspectRatio: '3:4',
  textGap: 6,
  contentPaddingX: 16,
  contentPaddingY: 16,
  designerNameEnabled: true,
  designerNameFontSize: 14,
  designerNameColor: '#6b7280',
  productNameEnabled: true,
  productNameFontSize: 16,
  productNameColor: '#111827',
  shortDescriptionEnabled: true,
  shortDescriptionFontSize: 13,
  shortDescriptionColor: '#4b5563',
  shortDescriptionWordLimit: 10,
  priceEnabled: true,
  priceFontSize: 14,
  priceColor: '#e66045',
  priceFontWeight: 600,
  labelEnabled: true,
  labelFontSize: 11,
  labelTextColor: '#ffffff',
  labelBackgroundColor: 'rgba(17, 17, 17, 0.75)',
  labelPosition: 'TOP_LEFT',
  likesEnabled: true,
  likesSize: 18,
  likesColor: '#ffffff',
  likesActiveColor: '#ef4444',
  likesPosition: 'TOP_RIGHT',
  countryIconEnabled: true,
  countryIconSize: 20,
  countryIconPosition: 'BOTTOM_RIGHT',
});

const createDefaultDetailView = (): CategoryPageV2DetailViewSettings => ({
  titleFontSize: 64,
  titleColor: '#1A1A1A',
  ownerFontSize: 16,
  ownerColor: '#6B6B6B',
  priceLabelColor: '#6B6B6B',
  priceValueFontSize: 36,
  priceValueColor: '#E85A3C',
  descriptionFontSize: 14,
  descriptionColor: '#2f2d29',
  specLabelColor: '#6B6B6B',
  specValueColor: '#1A1A1A',
  tabOrder: ['DETAILS', 'SPECS', 'REVIEWS'],
  defaultTab: 'DETAILS',
  reviewsEnabled: true,
  discoverEnabled: true,
  likesEnabled: true,
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
  fallbackRows: CategoryPageV2ProductCardFieldKey[]
): CategoryPageV2ProductCardFieldKey[] => {
  const rows = Array.isArray(value) ? value : fallbackRows;
  const collected: CategoryPageV2ProductCardFieldKey[] = [];
  rows.forEach((entry, index) => {
    const row = asObject(entry as unknown);
    const keyToken = normalizeText(typeof entry === 'string' ? entry : row.key || fallbackRows[index]).toUpperCase();
    if (!CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.includes(keyToken as CategoryPageV2ProductCardFieldKey)) return;
    const key = keyToken as CategoryPageV2ProductCardFieldKey;
    if (!collected.includes(key)) collected.push(key);
  });
  CATEGORY_PAGE_V2_PRODUCT_CARD_FIELDS.forEach((key) => {
    if (!collected.includes(key)) collected.push(key);
  });
  return collected;
};

const normalizeProductCardStyle = (
  value: unknown,
  fallback: CategoryPageV2ProductCardSettings
): CategoryPageV2ProductCardSettings => {
  const row = asObject(value);
  return {
    imageEnabled: typeof row.imageEnabled === 'boolean' ? row.imageEnabled : fallback.imageEnabled,
    fieldOrder: normalizeProductCardFieldOrder(row.fieldOrder, fallback.fieldOrder),
    imageAspectRatio: normalizeText(row.imageAspectRatio) === '1:1' ? '1:1' : fallback.imageAspectRatio,
    textGap: clampNumber(row.textGap, fallback.textGap, 0, 24),
    contentPaddingX: clampNumber(row.contentPaddingX, fallback.contentPaddingX, 0, 40),
    contentPaddingY: clampNumber(row.contentPaddingY, fallback.contentPaddingY, 0, 40),
    designerNameEnabled: typeof row.designerNameEnabled === 'boolean' ? row.designerNameEnabled : fallback.designerNameEnabled,
    designerNameFontSize: clampNumber(row.designerNameFontSize, fallback.designerNameFontSize, 8, 72),
    designerNameColor: normalizeColor(row.designerNameColor, fallback.designerNameColor),
    productNameEnabled: typeof row.productNameEnabled === 'boolean' ? row.productNameEnabled : fallback.productNameEnabled,
    productNameFontSize: clampNumber(row.productNameFontSize, fallback.productNameFontSize, 8, 72),
    productNameColor: normalizeColor(row.productNameColor, fallback.productNameColor),
    shortDescriptionEnabled:
      typeof row.shortDescriptionEnabled === 'boolean' ? row.shortDescriptionEnabled : fallback.shortDescriptionEnabled,
    shortDescriptionFontSize: clampNumber(row.shortDescriptionFontSize, fallback.shortDescriptionFontSize, 8, 72),
    shortDescriptionColor: normalizeColor(row.shortDescriptionColor, fallback.shortDescriptionColor),
    shortDescriptionWordLimit: clampNumber(row.shortDescriptionWordLimit, fallback.shortDescriptionWordLimit, 4, 24),
    priceEnabled: typeof row.priceEnabled === 'boolean' ? row.priceEnabled : fallback.priceEnabled,
    priceFontSize: clampNumber(row.priceFontSize, fallback.priceFontSize, 8, 72),
    priceColor: normalizeColor(row.priceColor, fallback.priceColor),
    priceFontWeight: clampNumber(row.priceFontWeight, fallback.priceFontWeight, 100, 900),
    labelEnabled: typeof row.labelEnabled === 'boolean' ? row.labelEnabled : fallback.labelEnabled,
    labelFontSize: clampNumber(row.labelFontSize, fallback.labelFontSize, 8, 72),
    labelTextColor: normalizeColor(row.labelTextColor, fallback.labelTextColor),
    labelBackgroundColor: normalizeColor(row.labelBackgroundColor, fallback.labelBackgroundColor),
    labelPosition: 'TOP_LEFT',
    likesEnabled: typeof row.likesEnabled === 'boolean' ? row.likesEnabled : fallback.likesEnabled,
    likesSize: clampNumber(row.likesSize, fallback.likesSize, 8, 72),
    likesColor: normalizeColor(row.likesColor, fallback.likesColor),
    likesActiveColor: normalizeColor(row.likesActiveColor, fallback.likesActiveColor),
    likesPosition: 'TOP_RIGHT',
    countryIconEnabled: typeof row.countryIconEnabled === 'boolean' ? row.countryIconEnabled : fallback.countryIconEnabled,
    countryIconSize: clampNumber(row.countryIconSize, fallback.countryIconSize, 8, 96),
    countryIconPosition: 'BOTTOM_RIGHT',
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

const normalizeDetailTabs = (value: unknown, fallbackRows: CategoryPageV2DetailTabKey[]): CategoryPageV2DetailTabKey[] => {
  const rows = Array.isArray(value) ? value : fallbackRows;
  const collected: CategoryPageV2DetailTabKey[] = [];
  rows.forEach((entry, index) => {
    const token = normalizeText(entry || fallbackRows[index]).toUpperCase();
    if (!CATEGORY_PAGE_V2_DETAIL_TABS.includes(token as CategoryPageV2DetailTabKey)) return;
    const tab = token as CategoryPageV2DetailTabKey;
    if (!collected.includes(tab)) collected.push(tab);
  });
  CATEGORY_PAGE_V2_DETAIL_TABS.forEach((tab) => {
    if (!collected.includes(tab)) collected.push(tab);
  });
  return collected;
};

const normalizeDetailViewStyle = (
  value: unknown,
  fallback: CategoryPageV2DetailViewSettings
): CategoryPageV2DetailViewSettings => {
  const row = asObject(value);
  const tabOrder = normalizeDetailTabs(row.tabOrder, fallback.tabOrder);
  const defaultTabToken = normalizeText(row.defaultTab).toUpperCase();
  const defaultTab = CATEGORY_PAGE_V2_DETAIL_TABS.includes(defaultTabToken as CategoryPageV2DetailTabKey)
    ? (defaultTabToken as CategoryPageV2DetailTabKey)
    : fallback.defaultTab;
  return {
    titleFontSize: clampNumber(row.titleFontSize, fallback.titleFontSize, 18, 96),
    titleColor: normalizeColor(row.titleColor, fallback.titleColor),
    ownerFontSize: clampNumber(row.ownerFontSize, fallback.ownerFontSize, 10, 42),
    ownerColor: normalizeColor(row.ownerColor, fallback.ownerColor),
    priceLabelColor: normalizeColor(row.priceLabelColor, fallback.priceLabelColor),
    priceValueFontSize: clampNumber(row.priceValueFontSize, fallback.priceValueFontSize, 18, 96),
    priceValueColor: normalizeColor(row.priceValueColor, fallback.priceValueColor),
    descriptionFontSize: clampNumber(row.descriptionFontSize, fallback.descriptionFontSize, 12, 36),
    descriptionColor: normalizeColor(row.descriptionColor, fallback.descriptionColor),
    specLabelColor: normalizeColor(row.specLabelColor, fallback.specLabelColor),
    specValueColor: normalizeColor(row.specValueColor, fallback.specValueColor),
    tabOrder,
    defaultTab: tabOrder.includes(defaultTab) ? defaultTab : tabOrder[0],
    reviewsEnabled: typeof row.reviewsEnabled === 'boolean' ? row.reviewsEnabled : fallback.reviewsEnabled,
    discoverEnabled: typeof row.discoverEnabled === 'boolean' ? row.discoverEnabled : fallback.discoverEnabled,
    likesEnabled: typeof row.likesEnabled === 'boolean' ? row.likesEnabled : fallback.likesEnabled,
  };
};

const mergeDetailViewPatch = (base: CategoryPageV2DetailViewSettings, patch: unknown): CategoryPageV2DetailViewSettings => {
  const source = asObject(patch);
  return normalizeDetailViewStyle(
    {
      ...base,
      ...source,
      tabOrder: source.tabOrder ?? base.tabOrder,
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
    detailView: createDefaultDetailView(),
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
    detailView: createDefaultDetailView(),
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
    detailView: createDefaultDetailView(),
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
    detailView: createDefaultDetailView(),
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
    detailView: createDefaultDetailView(),
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
  const normalized = value
    .toLowerCase()
    .replace(/usd/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const compact = normalized.replace(/\s+/g, '').replace(/_/g, '-');
  if (normalized === 'under $100' || normalized === 'under 100' || normalized === '$0 - $100' || normalized === '0-100') {
    return { max: 100 };
  }
  if (compact === 'under-100' || compact === 'under$100') return { max: 100 };
  if (normalized === '$100 - $249' || normalized === '$100-$249' || normalized === '$100 - $300' || normalized === '$100-$300') {
    return { min: 100, max: normalized.includes('300') ? 301 : 250 };
  }
  if (compact === '100-300' || compact === '$100-$300') return { min: 100, max: 301 };
  if (compact === '250-500' || compact === '$250-$500' || compact === '300-500' || compact === '$300-$500') {
    return { min: compact.startsWith('300') || compact.startsWith('$300') ? 300 : 250, max: 500 };
  }
  if (normalized === '$250 - $499' || normalized === '$250-$499' || normalized === '$300 - $500' || normalized === '$300-$500') {
    return { min: normalized.includes('$300') ? 300 : 250, max: 500 };
  }
  if (normalized === '$500 - $999' || normalized === '$500-$999' || normalized === '$500+' || normalized === '$500 +' || normalized === '500+') {
    if (normalized.includes('999')) return { min: 500, max: 1000 };
    return { min: 500 };
  }
  if (compact === 'above-300' || compact === 'over-300' || compact === '300+' || compact === '$300+' || compact === 'from-300') {
    return { min: 300 };
  }
  if (compact === 'above-500' || compact === 'over-500' || compact === '500+' || compact === '$500+' || compact === 'from-500') {
    return { min: 500 };
  }
  if (normalized === '$1000+' || normalized === '$1000 +' || normalized === '1000+') return { min: 1000 };
  const underCompactMatch = compact.match(/^under-?\$?(\d+(?:\.\d+)?)$/);
  if (underCompactMatch) return { max: Number(underCompactMatch[1]) };
  const aboveCompactMatch = compact.match(/^(above|over|from)-?\$?(\d+(?:\.\d+)?)$/);
  if (aboveCompactMatch) return { min: Number(aboveCompactMatch[2]) };
  const underMatch = normalized.match(/^under\s*\$?\s*(\d+(?:\.\d+)?)$/i);
  if (underMatch) return { max: Number(underMatch[1]) };
  const plusMatch = normalized.match(/^\$?\s*(\d+(?:\.\d+)?)\s*\+$/);
  if (plusMatch) return { min: Number(plusMatch[1]) };
  const rangeMatch = normalized.match(/^\$?\s*(\d+(?:\.\d+)?)\s*[-–]\s*\$?\s*(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const min = Number(rangeMatch[1]);
    const max = Number(rangeMatch[2]);
    if (Number.isFinite(min) && Number.isFinite(max) && max > min) {
      // Make upper-bound inclusive for shopper-facing labels.
      return { min, max: max + 1 };
    }
  }
  return {};
};

const normalizeText = (value: unknown) => String(value || '').trim();
const normalizeToken = (value: unknown) => normalizeText(value).toLowerCase();
const normalizeCountryCode = (value: unknown) => normalizeText(value).toUpperCase();

const normalizeLabelProductType = (value: unknown): LabelProductType | '' => {
  const token = normalizeText(value).toUpperCase().replace(/[\s-]+/g, '_');
  if (token === 'FABRIC' || token === 'FTB' || token === 'FABRIC_TO_BUY') return 'FABRIC';
  if (token === 'DESIGN' || token === 'CTW' || token === 'CUSTOM_TO_WEAR' || token === 'CUSTOMTOWEAR') return 'DESIGN';
  if (token === 'READY_TO_WEAR' || token === 'RTW' || token === 'READYTOWEAR') return 'READY_TO_WEAR';
  return '';
};

const normalizeProductTypeList = (
  value: unknown,
  fallback: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>
): Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'> => {
  const list = Array.isArray(value) ? value : fallback;
  const parsed = list
    .map((entry) => normalizeLabelProductType(entry))
    .filter((entry): entry is 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' => Boolean(entry));
  return parsed.length > 0 ? Array.from(new Set(parsed)) : [...fallback];
};

const normalizeProductLabelSettings = (raw: unknown) => {
  const allProductTypes: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'> = ['FABRIC', 'DESIGN', 'READY_TO_WEAR'];
  const fallback = {
    ...DEFAULT_PRODUCT_LABEL_SETTINGS,
    autoConditions: {
      ...DEFAULT_PRODUCT_LABEL_SETTINGS.autoConditions,
      autoNewProductTypes: [...DEFAULT_PRODUCT_LABEL_SETTINGS.autoConditions.autoNewProductTypes],
      autoSaleProductTypes: [...DEFAULT_PRODUCT_LABEL_SETTINGS.autoConditions.autoSaleProductTypes],
    },
    labels: DEFAULT_PRODUCT_LABEL_SETTINGS.labels.map((entry) => ({ ...entry })),
    assignments: [] as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>,
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const row = raw as Record<string, unknown>;
  const newTagDaysRaw = Number(row.newTagDays);
  const autoConditionsRow =
    row.autoConditions && typeof row.autoConditions === 'object' && !Array.isArray(row.autoConditions)
      ? (row.autoConditions as Record<string, unknown>)
      : {};
  const autoConditions = {
    newTagDaysForSaleProducts: Number.isFinite(Number(autoConditionsRow.newTagDaysForSaleProducts))
      ? Math.max(1, Math.min(120, Math.round(Number(autoConditionsRow.newTagDaysForSaleProducts))))
      : Number.isFinite(newTagDaysRaw)
        ? Math.max(1, Math.min(120, Math.round(newTagDaysRaw)))
        : fallback.autoConditions.newTagDaysForSaleProducts,
    autoNewProductTypes: normalizeProductTypeList(autoConditionsRow.autoNewProductTypes, fallback.autoConditions.autoNewProductTypes),
    autoSaleProductTypes: normalizeProductTypeList(autoConditionsRow.autoSaleProductTypes, fallback.autoConditions.autoSaleProductTypes),
    autoSaleUsePriceDrop:
      typeof autoConditionsRow.autoSaleUsePriceDrop === 'boolean'
        ? autoConditionsRow.autoSaleUsePriceDrop
        : fallback.autoConditions.autoSaleUsePriceDrop,
    autoSaleUseMarkdownRules:
      typeof autoConditionsRow.autoSaleUseMarkdownRules === 'boolean'
        ? autoConditionsRow.autoSaleUseMarkdownRules
        : fallback.autoConditions.autoSaleUseMarkdownRules,
  };
  if (autoConditions.autoNewProductTypes.length === 0) autoConditions.autoNewProductTypes = [...allProductTypes];
  if (autoConditions.autoSaleProductTypes.length === 0) autoConditions.autoSaleProductTypes = [...allProductTypes];
  const labelsRaw = Array.isArray(row.labels) ? row.labels : [];
  const labelEntries = labelsRaw
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const id = normalizeText(item.id).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
      const name = normalizeText(item.name);
      const mode = normalizeText(item.mode).toUpperCase();
      if (!id || !name) return null;
      if (mode !== 'AUTO_NEW' && mode !== 'AUTO_SALE' && mode !== 'MANUAL') return null;
      return [
        id,
        {
          id,
          name,
          mode: mode as 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL',
          textColor: normalizeText(item.textColor) || '#ffffff',
          backgroundColor: normalizeText(item.backgroundColor) || '#111827',
          isActive: item.isActive !== false,
        },
      ] as const;
    })
    .filter(
      (
        entry
      ): entry is readonly [
        string,
        {
          id: string;
          name: string;
          mode: 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';
          textColor: string;
          backgroundColor: string;
          isActive: boolean;
        },
      ] => entry !== null
    );
  const labels = Array.from(new Map(labelEntries).values());
  const labelsWithDefaults = [...labels];
  if (!labelsWithDefaults.some((entry) => entry.mode === 'AUTO_NEW')) labelsWithDefaults.unshift({ ...DEFAULT_PRODUCT_LABEL_SETTINGS.labels[0] });
  if (!labelsWithDefaults.some((entry) => entry.mode === 'AUTO_SALE')) labelsWithDefaults.push({ ...DEFAULT_PRODUCT_LABEL_SETTINGS.labels[1] });
  const validLabelIds = new Set(labelsWithDefaults.map((entry) => entry.id));
  const assignmentsRaw = Array.isArray(row.assignments) ? row.assignments : [];
  const assignments = assignmentsRaw
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const labelId = normalizeText(item.labelId).toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 64);
      const productType = normalizeLabelProductType(item.productType);
      if (!labelId || !validLabelIds.has(labelId) || !productType) return null;
      const productIds = Array.from(new Set((Array.isArray(item.productIds) ? item.productIds : []).map((value) => normalizeText(value)).filter(Boolean)));
      if (productIds.length === 0) return null;
      return { labelId, productType, productIds };
    })
    .filter(Boolean) as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>;
  return {
    newTagDays: Number.isFinite(newTagDaysRaw) ? Math.max(1, Math.min(120, Math.round(newTagDaysRaw))) : fallback.newTagDays,
    autoConditions,
    appearance: fallback.appearance,
    labels: labelsWithDefaults,
    assignments,
  };
};

const readProductLabelSettings = async () => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
      HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return normalizeProductLabelSettings(DEFAULT_PRODUCT_LABEL_SETTINGS);
    return normalizeProductLabelSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    return normalizeProductLabelSettings(DEFAULT_PRODUCT_LABEL_SETTINGS);
  }
};

const extractMarkdownRules = (rules: ActivePricingRule[]) =>
  rules
    .filter(
      (rule) =>
        rule.isSale === true ||
        DISCOUNT_ADJUSTMENT_TYPE_SET.has(String(rule.adjustmentType || '').trim().toUpperCase())
    )
    .map((rule) => ({
      productType: normalizeLabelProductType(rule.productType) || null,
      country: normalizeCountryCode(rule.country) || null,
    }));

const hasMarkdownSaleRule = (
  rules: Array<{ productType: LabelProductType | null; country: string | null }>,
  context: { productType: LabelProductType; country?: string | null }
) => {
  const country = normalizeCountryCode(context.country);
  return rules.some((rule) => {
    if (rule.productType && rule.productType !== context.productType) return false;
    const ruleCountry = normalizeCountryCode(rule.country);
    if (ruleCountry && country && ruleCountry !== country) return false;
    if (ruleCountry && !country) return false;
    return true;
  });
};

const buildProductLabels = (params: {
  productType: LabelProductType;
  productId: string;
  createdAt?: string | Date | null;
  isOnSale: boolean;
  saleTriggeredByMarkdownRule?: boolean;
  settings: ReturnType<typeof normalizeProductLabelSettings>;
}): ProductLabelDisplay[] => {
  const labels = params.settings.labels.filter((entry) => entry.isActive !== false);
  const labelMap = new Map(labels.map((entry) => [entry.id, entry]));
  const output: ProductLabelDisplay[] = [];
  const add = (labelId: string) => {
    const row = labelMap.get(labelId);
    if (!row || output.some((item) => item.id === row.id)) return;
    output.push({
      id: row.id,
      name: row.name,
      textColor: row.textColor,
      backgroundColor: row.backgroundColor,
      sizePercent: params.settings.appearance.sizePercent,
      fontSizePx: params.settings.appearance.fontSizePx,
      isBold: params.settings.appearance.isBold,
    });
  };
  const now = Date.now();
  const createdAt = params.createdAt ? new Date(params.createdAt).getTime() : 0;
  const autoNewEnabledForType = params.settings.autoConditions.autoNewProductTypes.includes(params.productType);
  const autoSaleEnabledForType = params.settings.autoConditions.autoSaleProductTypes.includes(params.productType);
  const qualifiesAsSale =
    autoSaleEnabledForType &&
    ((params.settings.autoConditions.autoSaleUsePriceDrop && params.isOnSale) ||
      (params.settings.autoConditions.autoSaleUseMarkdownRules && params.saleTriggeredByMarkdownRule === true));
  const effectiveNewTagDays =
    qualifiesAsSale && autoNewEnabledForType
      ? params.settings.autoConditions.newTagDaysForSaleProducts
      : params.settings.newTagDays;
  const isNew = createdAt > 0 && now - createdAt <= effectiveNewTagDays * 24 * 60 * 60 * 1000;
  if (isNew && autoNewEnabledForType) {
    const autoNew = labels.find((entry) => entry.mode === 'AUTO_NEW');
    if (autoNew) add(autoNew.id);
  }
  if (qualifiesAsSale) {
    const autoSale = labels.find((entry) => entry.mode === 'AUTO_SALE');
    if (autoSale) add(autoSale.id);
  }
  const manualLabelIds = params.settings.assignments
    .filter((entry) => entry.productType === params.productType && Array.isArray(entry.productIds) && entry.productIds.includes(params.productId))
    .map((entry) => entry.labelId);
  for (const labelId of manualLabelIds) add(labelId);
  return output;
};

const toCardLabelPayload = (labels: ProductLabelDisplay[] | undefined) =>
  Array.isArray(labels)
    ? labels.map((entry) => ({
        id: entry.id,
        name: entry.name,
        textColor: entry.textColor,
        backgroundColor: entry.backgroundColor,
      }))
    : [];

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
  const priceRequired = (pageType === 'SHOP' || pageType === 'READY_TO_WEAR') as boolean;
  const nextByKey = new Map<CategoryPageV2FilterKey, CategoryPageV2FilterRow>();
  for (const [index, raw] of rawRows.entries()) {
    const row = asObject(raw);
    const keyToken = normalizeText(row.key).toUpperCase();
    if (!CATEGORY_PAGE_V2_FILTER_KEYS.includes(keyToken as CategoryPageV2FilterKey)) continue;
    const key = keyToken as CategoryPageV2FilterKey;
    const fallbackRow = fallback.find((entry) => entry.key === key) || fallback[index] || fallback[0];
    const enabled = typeof row.enabled === 'boolean' ? row.enabled : fallbackRow.enabled;
    nextByKey.set(key, {
      id: normalizeText(row.id || fallbackRow.id || randomUUID()).slice(0, 120),
      key,
      label: normalizeText(row.label || fallbackRow.label || key).slice(0, 80),
      inputType:
        normalizeText(row.inputType || fallbackRow.inputType).toUpperCase() === 'SUGGESTIVE_SEARCH'
          ? 'SUGGESTIVE_SEARCH'
          : 'DROPDOWN',
      enabled: priceRequired && key === 'PRICE' ? true : enabled,
      options: Array.isArray(row.options)
        ? row.options.map((entry) => normalizeText(entry)).filter(Boolean).slice(0, 100)
        : fallbackRow.options,
      displayOrder: Number.isFinite(Number(row.displayOrder))
        ? Math.max(0, Math.min(999, Math.round(Number(row.displayOrder))))
        : fallbackRow.displayOrder,
    });
  }
  for (const fallbackRow of fallback) {
    if (!nextByKey.has(fallbackRow.key)) {
      nextByKey.set(fallbackRow.key, {
        ...fallbackRow,
        enabled: priceRequired && fallbackRow.key === 'PRICE' ? true : fallbackRow.enabled,
      });
    }
  }
  if (priceRequired) {
    const existingPrice = nextByKey.get('PRICE');
    const fallbackPrice = fallback.find((entry) => entry.key === 'PRICE');
    if (existingPrice) {
      nextByKey.set('PRICE', { ...existingPrice, enabled: true, inputType: 'DROPDOWN' });
    } else if (fallbackPrice) {
      nextByKey.set('PRICE', { ...fallbackPrice, enabled: true, inputType: 'DROPDOWN' });
    }
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
    detailView: normalizeDetailViewStyle(row.detailView, fallback.detailView),
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
  const includeReady = pageType === 'READY_TO_WEAR' || pageType === 'SHOP' || pageType === 'COUNTRY';
  const includeFabric = pageType === 'FABRIC_TO_BUY' || pageType === 'SHOP' || pageType === 'COUNTRY';
  const includeDesign = pageType === 'CUSTOM_TO_WEAR' || pageType === 'SHOP' || pageType === 'COUNTRY';
  const readyPromise =
    !includeReady
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
    !includeFabric
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
    !includeDesign
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

  const [readyRows, fabricRows, designRows, pricingRules, labelSettings, skuSettingsBundle] = await Promise.all([
    readyPromise,
    fabricPromise,
    designPromise,
    readActivePricingRules(),
    readProductLabelSettings(),
    readProductSkuSettings(),
  ]);
  const skuSettings = skuSettingsBundle.settings;
  const markdownRules = extractMarkdownRules(pricingRules);

  const readyProducts = (readyRows as any[]).map((row) => {
    const base = mapReadyToWear(row);
    const country = normalizeText(row?.designer?.country);
    const adjustedBasePrice = applyActivePricingRules(
      Number(row?.basePrice || base.priceUsd || 0),
      { productType: 'READY_TO_WEAR', country },
      pricingRules
    );
    const adjustedVariationPrices: number[] = (Array.isArray(row?.sizeVariations) ? row.sizeVariations : [])
      .map((entry: any) =>
        applyActivePricingRules(
          Number(entry?.price || 0),
          { productType: 'READY_TO_WEAR', country },
          pricingRules
        )
      )
      .filter((value: number) => Number.isFinite(value) && value > 0);
    const adjustedPrice =
      adjustedVariationPrices.length > 0 ? Math.min(...adjustedVariationPrices) : adjustedBasePrice;
    const isOnSale = adjustedVariationPrices.some((price: number) => price < adjustedBasePrice);
    const productLabels = buildProductLabels({
      productType: 'READY_TO_WEAR',
      productId: base.id,
      createdAt: row?.createdAt,
      isOnSale,
      saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
        productType: 'READY_TO_WEAR',
        country,
      }),
      settings: labelSettings,
    });
    return {
      ...base,
      sku: generateProductSku({ productType: 'READY_TO_WEAR', productId: base.id, settings: skuSettings }),
      priceUsd: Math.max(0, adjustedPrice),
      productLabels: toCardLabelPayload(productLabels),
    };
  });

  const fabricProducts = (fabricRows as any[]).map((row) => {
    const base = mapFabric(row);
    const country = normalizeText(row?.seller?.country);
    const sellerPrice = Number(row?.sellerPrice || 0);
    const adjustedPrice = applyActivePricingRules(
      Number(row?.sellerPrice || row?.finalPrice || base.priceUsd || 0),
      { productType: 'FABRIC', country },
      pricingRules
    );
    const productLabels = buildProductLabels({
      productType: 'FABRIC',
      productId: base.id,
      createdAt: row?.createdAt,
      isOnSale: adjustedPrice < sellerPrice,
      saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
        productType: 'FABRIC',
        country,
      }),
      settings: labelSettings,
    });
    return {
      ...base,
      sku: generateProductSku({ productType: 'FABRIC', productId: base.id, settings: skuSettings }),
      priceUsd: Math.max(0, adjustedPrice),
      productLabels: toCardLabelPayload(productLabels),
    };
  });

  const designProducts = (designRows as any[]).map((row) => {
    const base = mapDesign(row);
    const country = normalizeText(row?.designer?.country);
    const basePrice = Number(row?.basePrice || 0);
    const adjustedPrice = applyActivePricingRules(
      Number(row?.basePrice || row?.finalPrice || base.priceUsd || 0),
      { productType: 'DESIGN', country },
      pricingRules
    );
    const productLabels = buildProductLabels({
      productType: 'DESIGN',
      productId: base.id,
      createdAt: row?.createdAt,
      isOnSale: adjustedPrice < basePrice,
      saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
        productType: 'DESIGN',
        country,
      }),
      settings: labelSettings,
    });
    return {
      ...base,
      sku: generateProductSku({ productType: 'DESIGN', productId: base.id, settings: skuSettings }),
      priceUsd: Math.max(0, adjustedPrice),
      productLabels: toCardLabelPayload(productLabels),
    };
  });

  const products: CategoryPageV2Product[] = [...readyProducts, ...fabricProducts, ...designProducts];
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
        detailView: mergeDetailViewPatch(existing.settings.detailView, parsedPatch.detailView),
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

