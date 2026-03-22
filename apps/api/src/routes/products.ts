import { Router } from 'express';
import { randomUUID } from 'crypto';
import { prisma, ProductStatus } from '../db';
import { authenticate, optionalAuth } from '../middleware/auth';
import { z } from 'zod';
import { readFabricPredominantColorMap } from '../utils/fabric-attributes';
import { readCategoryPageSettings, type CategoryPageType } from '../utils/category-page-settings';
import { readOrderWorkflowSettings } from '../utils/order-workflow';
import { applyActivePricingRules, readActivePricingRules } from '../utils/pricing-rules';
import { ensureProductTaxonomySchema } from '../utils/product-taxonomy-schema';

const router = Router();
router.use(async (_req, _res, next) => {
  try {
    await ensureProductTaxonomySchema();
  } catch (error) {
    console.error('Failed to ensure product taxonomy schema:', error);
  }
  next();
});

const HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY = 'HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE';
const HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY = 'HOMEPAGE_PRODUCT_LABELS';
const DEFAULT_READY_TO_WEAR_SIZE_GUIDE = {
  title: 'Ready-To-Wear Size Guide',
  content:
    'Use your body measurements to select your best standard size.\n\nS: Bust 84-90cm, Waist 66-72cm, Hips 90-96cm\nM: Bust 91-98cm, Waist 73-80cm, Hips 97-104cm\nL: Bust 99-106cm, Waist 81-88cm, Hips 105-112cm\nXL: Bust 107-115cm, Waist 89-98cm, Hips 113-122cm',
};
const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';
const LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS = [' / ', '/', '|'] as const;
const normalizeReadyToWearColor = (value: unknown) =>
  String(value || DEFAULT_READY_TO_WEAR_COLOR)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') || DEFAULT_READY_TO_WEAR_COLOR;
const normalizeReadyToWearSize = (value: unknown) => String(value || '').trim().toUpperCase();
const decodeReadyToWearVariantKey = (variantKey: unknown) => {
  const raw = String(variantKey || '').trim().toUpperCase();
  if (raw.includes(READY_TO_WEAR_VARIANT_SEPARATOR)) {
    const [sizePart, colorPart] = raw.split(READY_TO_WEAR_VARIANT_SEPARATOR);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: `${normalizedSize}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizedColor}`,
    };
  }
  for (const separator of LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS) {
    if (!raw.includes(separator)) continue;
    const [sizePart, colorPart] = raw.split(separator);
    const normalizedSize = normalizeReadyToWearSize(sizePart);
    const normalizedColor = normalizeReadyToWearColor(colorPart);
    return {
      size: normalizedSize,
      color: normalizedColor,
      variantKey: `${normalizedSize}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizedColor}`,
    };
  }
  const normalizedSize = normalizeReadyToWearSize(raw);
  return {
    size: normalizedSize,
    color: DEFAULT_READY_TO_WEAR_COLOR,
    variantKey: `${normalizedSize}${READY_TO_WEAR_VARIANT_SEPARATOR}${DEFAULT_READY_TO_WEAR_COLOR}`,
  };
};
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
type ActiveMarkdownRule = {
  ruleType: string;
  productType: LabelProductType | null;
  country: string | null;
};
const DISCOUNT_ADJUSTMENT_TYPES: Array<'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT'> = ['PERCENTAGE_DISCOUNT', 'FIXED_DISCOUNT'];
const DISCOUNT_ADJUSTMENT_TYPE_SET = new Set<string>(DISCOUNT_ADJUSTMENT_TYPES);
const normalizeCountryCode = (value: unknown) => String(value || '').trim().toUpperCase();

const readActiveMarkdownPricingRules = async (): Promise<ActiveMarkdownRule[]> => {
  const now = new Date();
  const rows = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
      OR: [
        { isSale: true },
        { adjustmentType: { in: DISCOUNT_ADJUSTMENT_TYPES } },
      ],
    },
    select: {
      ruleType: true,
      productType: true,
      country: true,
      adjustmentType: true,
      isSale: true,
    },
  });
  return rows
    .filter((row) => row.isSale === true || DISCOUNT_ADJUSTMENT_TYPE_SET.has(String(row.adjustmentType || '').toUpperCase()))
    .map((row) => ({
      ruleType: String(row.ruleType || '').toUpperCase(),
      productType: row.productType ? (String(row.productType).toUpperCase() as LabelProductType) : null,
      country: row.country ? String(row.country).trim() : null,
    }));
};

const markdownRuleAppliesToProduct = (
  rule: ActiveMarkdownRule,
  context: { productType: LabelProductType; country?: string | null }
) => {
  const country = normalizeCountryCode(context.country);
  const ruleCountry = normalizeCountryCode(rule.country);
  if (rule.productType && rule.productType !== context.productType) return false;
  if (ruleCountry && country && ruleCountry !== country) return false;
  if (ruleCountry && !country) return false;
  if (rule.ruleType === 'GLOBAL_MARKUP') return true;
  if (rule.ruleType === 'CATEGORY_MARKUP') return !rule.productType || rule.productType === context.productType;
  if (rule.ruleType === 'COUNTRY_MARKUP') return !ruleCountry || ruleCountry === country;
  if (rule.ruleType === 'DATE_BASED') return true;
  return true;
};

const hasMarkdownSaleRule = (
  rules: ActiveMarkdownRule[],
  context: { productType: LabelProductType; country?: string | null }
) => rules.some((rule) => markdownRuleAppliesToProduct(rule, context));

type CanonicalProductType = 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';

type DiscoverCandidate = {
  id: string;
  name: string;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  productType: CanonicalProductType;
  sellerToken: string;
  sameTaxonomy: boolean;
  sameCountry: boolean;
};

const PRODUCT_TYPE_BY_TOKEN: Record<string, CanonicalProductType> = {
  DESIGN: 'DESIGN',
  DESIGNS: 'DESIGN',
  FABRIC: 'FABRIC',
  FABRICS: 'FABRIC',
  READY_TO_WEAR: 'READY_TO_WEAR',
  READYTOWEAR: 'READY_TO_WEAR',
  READY_TO_WEAR_PRODUCT: 'READY_TO_WEAR',
  RTW: 'READY_TO_WEAR',
};

function normalizeProductTypeToken(value: unknown): CanonicalProductType | null {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  if (!token) return null;
  return PRODUCT_TYPE_BY_TOKEN[token] || null;
}

const DISCOVER_PAGE_TYPE_BY_PRODUCT_TYPE: Record<CanonicalProductType, CategoryPageType> = {
  DESIGN: 'CUSTOM_TO_WEAR',
  FABRIC: 'FABRIC_TO_BUY',
  READY_TO_WEAR: 'READY_TO_WEAR',
};

const dedupeDiscoverCandidates = (rows: DiscoverCandidate[]) => {
  const seen = new Set<string>();
  const output: DiscoverCandidate[] = [];
  for (const row of rows) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    output.push(row);
  }
  return output;
};

const rankDiscoverCandidates = (
  rows: DiscoverCandidate[],
  input: {
    currentSellerToken: string;
    preferSameCountry: boolean;
    preferDifferentSeller: boolean;
  }
) =>
  [...rows].sort((left, right) => {
    const score = (row: DiscoverCandidate) => {
      const sameSeller = row.sellerToken && row.sellerToken === input.currentSellerToken;
      let total = 0;
      if (row.sameTaxonomy) total += 60;
      if (input.preferSameCountry) {
        total += row.sameCountry ? 28 : -6;
      } else if (row.sameCountry) {
        total += 12;
      }
      if (input.preferDifferentSeller) {
        total += sameSeller ? -10 : 18;
      } else {
        total += sameSeller ? 6 : 8;
      }
      total += Math.random() * 10;
      return total;
    };
    return score(right) - score(left);
  });

const selectDiscoverCandidates = (
  rows: DiscoverCandidate[],
  limit: number,
  input: { preferDifferentSeller: boolean }
) => {
  const target = Math.max(1, Math.min(30, Math.round(Number(limit || 12))));
  if (rows.length <= target) return rows.slice(0, target);
  if (!input.preferDifferentSeller) return rows.slice(0, target);

  const picked: DiscoverCandidate[] = [];
  const usedSellers = new Set<string>();
  for (const row of rows) {
    if (!row.sellerToken || usedSellers.has(row.sellerToken)) continue;
    picked.push(row);
    usedSellers.add(row.sellerToken);
    if (picked.length >= target) return picked;
  }
  for (const row of rows) {
    if (picked.some((entry) => entry.id === row.id)) continue;
    picked.push(row);
    if (picked.length >= target) break;
  }
  return picked.slice(0, target);
};

let ensureProductEngagementSchemaPromise: Promise<void> | null = null;

async function ensureProductEngagementSchema() {
  if (!ensureProductEngagementSchemaPromise) {
    ensureProductEngagementSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "ProductLike" (
          "id" TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          "productId" TEXT NOT NULL,
          "productType" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "ProductLike_userId_productId_productType_key" ON "ProductLike" ("userId", "productId", "productType")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ProductLike_productType_productId_idx" ON "ProductLike" ("productType", "productId")`
      );
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "Review" (
          "id" TEXT PRIMARY KEY,
          "customerId" TEXT NOT NULL,
          "designerId" TEXT,
          "fabricSellerId" TEXT,
          "productId" TEXT,
          "productType" TEXT,
          "orderId" TEXT NOT NULL,
          "rating" INTEGER NOT NULL,
          "title" TEXT,
          "comment" TEXT NOT NULL,
          "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          "isVerified" BOOLEAN NOT NULL DEFAULT false,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "productType" TEXT`);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Review_productType_productId_idx" ON "Review" ("productType", "productId")`
      );
    })();
  }
  return ensureProductEngagementSchemaPromise;
}

async function ensureProductExists(productType: CanonicalProductType, id: string) {
  if (productType === 'DESIGN') {
    return prisma.design.findUnique({ where: { id }, select: { id: true, categoryId: true } });
  }
  if (productType === 'FABRIC') {
    return prisma.fabric.findUnique({ where: { id }, select: { id: true, materialTypeId: true } });
  }
  return prisma.readyToWear.findUnique({ where: { id }, select: { id: true, categoryId: true } });
}

async function readMaxSuitableFabricsPerDesign(): Promise<number> {
  try {
    const settings = await readOrderWorkflowSettings();
    return Math.max(1, Math.min(50, Number(settings.orderLimits?.maxSuitableFabricsPerDesign || 5)));
  } catch {
    return 5;
  }
}

async function resolveDesignSuitableFabricsForCustomer(design: any, maxCount: number) {
  const configuredRows = Array.isArray(design?.suitableFabrics)
    ? design.suitableFabrics.filter((entry: any) => Boolean(entry?.fabric?.id))
    : [];
  if (configuredRows.length > 0) return configuredRows.slice(0, maxCount);

  const designerCountry = String(design?.designer?.country || '').trim();
  if (!designerCountry) return [];

  const fallbackFabrics = await prisma.fabric.findMany({
    where: {
      status: ProductStatus.APPROVED,
      isAvailable: true,
      seller: {
        country: {
          equals: designerCountry,
          mode: 'insensitive',
        },
      },
    },
    include: {
      materialType: true,
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
      seller: {
        select: {
          businessName: true,
          country: true,
          city: true,
        },
      },
    },
    orderBy: [{ totalSold: 'desc' }, { createdAt: 'desc' }],
    take: Math.max(1, maxCount),
  });

  return fallbackFabrics.slice(0, maxCount).map((fabric: any) => {
    const minYards = Math.max(1, Number(fabric?.minYards || 1));
    return {
      id: `fallback-${String(design?.id || '')}-${String(fabric?.id || '')}`,
      designId: String(design?.id || ''),
      fabricId: String(fabric?.id || ''),
      yardsNeeded: minYards,
      minMeters: minYards,
      maxMeters: minYards,
      isAutoFallback: true,
      fabric,
    };
  });
}

function parsePagination(pageValue: unknown, limitValue: unknown, defaultLimit = 20) {
  const page = Math.max(1, Number.parseInt(String(pageValue ?? '1'), 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(String(limitValue ?? defaultLimit), 10) || defaultLimit));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function readReadyToWearSizeGuide() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
      HOMEPAGE_READY_TO_WEAR_SIZE_GUIDE_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) return { ...DEFAULT_READY_TO_WEAR_SIZE_GUIDE };
    const parsed = JSON.parse(String(row.value || '{}')) as Record<string, unknown>;
    const title = String(parsed.title || '').trim();
    const content = String(parsed.content || '').trim();
    return {
      title: title.length >= 3 ? title.slice(0, 120) : DEFAULT_READY_TO_WEAR_SIZE_GUIDE.title,
      content: content.length >= 20 ? content.slice(0, 6000) : DEFAULT_READY_TO_WEAR_SIZE_GUIDE.content,
    };
  } catch {
    return { ...DEFAULT_READY_TO_WEAR_SIZE_GUIDE };
  }
}

function normalizeProductLabelSettings(raw: unknown) {
  const allProductTypes: LabelProductType[] = ['FABRIC', 'DESIGN', 'READY_TO_WEAR'];
  const normalizeProductTypeList = (value: unknown, fallback: LabelProductType[]): LabelProductType[] => {
    const parsed = Array.isArray(value)
      ? Array.from(
          new Set(
            value
              .map((entry) => String(entry || '').trim().toUpperCase())
              .filter(
                (entry): entry is LabelProductType =>
                  entry === 'FABRIC' || entry === 'DESIGN' || entry === 'READY_TO_WEAR'
              )
          )
        )
      : [];
    return parsed.length > 0 ? parsed : [...fallback];
  };
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
    autoNewProductTypes: normalizeProductTypeList(
      autoConditionsRow.autoNewProductTypes,
      fallback.autoConditions.autoNewProductTypes
    ),
    autoSaleProductTypes: normalizeProductTypeList(
      autoConditionsRow.autoSaleProductTypes,
      fallback.autoConditions.autoSaleProductTypes
    ),
    autoSaleUsePriceDrop:
      typeof autoConditionsRow.autoSaleUsePriceDrop === 'boolean'
        ? autoConditionsRow.autoSaleUsePriceDrop
        : fallback.autoConditions.autoSaleUsePriceDrop,
    autoSaleUseMarkdownRules:
      typeof autoConditionsRow.autoSaleUseMarkdownRules === 'boolean'
        ? autoConditionsRow.autoSaleUseMarkdownRules
        : fallback.autoConditions.autoSaleUseMarkdownRules,
  };
  if (autoConditions.autoNewProductTypes.length === 0) {
    autoConditions.autoNewProductTypes = [...allProductTypes];
  }
  if (autoConditions.autoSaleProductTypes.length === 0) {
    autoConditions.autoSaleProductTypes = [...allProductTypes];
  }
  const appearanceRow =
    row.appearance && typeof row.appearance === 'object' && !Array.isArray(row.appearance)
      ? (row.appearance as Record<string, unknown>)
      : {};
  const appearance = {
    sizePercent: Number.isFinite(Number(appearanceRow.sizePercent))
      ? Math.max(60, Math.min(300, Math.round(Number(appearanceRow.sizePercent))))
      : fallback.appearance.sizePercent,
    fontSizePx: Number.isFinite(Number(appearanceRow.fontSizePx))
      ? Math.max(8, Math.min(36, Math.round(Number(appearanceRow.fontSizePx))))
      : fallback.appearance.fontSizePx,
    isBold:
      typeof appearanceRow.isBold === 'boolean'
        ? appearanceRow.isBold
        : fallback.appearance.isBold,
  };
  const labelsRaw = Array.isArray(row.labels) ? row.labels : [];
  const labels = Array.from(
    new Map(
      labelsRaw
        .map((entry) => {
          const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
          const id = String(item.id || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '')
            .slice(0, 64);
          const name = String(item.name || '').trim();
          const mode = String(item.mode || '').trim().toUpperCase();
          if (!id || !name) return null;
          if (mode !== 'AUTO_NEW' && mode !== 'AUTO_SALE' && mode !== 'MANUAL') return null;
          return [
            id,
            {
              id,
              name,
              mode: mode as 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL',
              textColor: String(item.textColor || '#ffffff').trim() || '#ffffff',
              backgroundColor: String(item.backgroundColor || '#111827').trim() || '#111827',
              isActive: item.isActive !== false,
            },
          ] as const;
        })
        .filter(Boolean) as Array<
        readonly [
          string,
          {
            id: string;
            name: string;
            mode: 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';
            textColor: string;
            backgroundColor: string;
            isActive: boolean;
          },
        ]
      >
    ).values()
  );
  const labelsWithDefaults = [...labels];
  if (!labelsWithDefaults.some((entry) => entry.mode === 'AUTO_NEW')) {
    labelsWithDefaults.unshift({ ...DEFAULT_PRODUCT_LABEL_SETTINGS.labels[0] });
  }
  if (!labelsWithDefaults.some((entry) => entry.mode === 'AUTO_SALE')) {
    labelsWithDefaults.push({ ...DEFAULT_PRODUCT_LABEL_SETTINGS.labels[1] });
  }
  const validLabelIds = new Set(labelsWithDefaults.map((entry) => entry.id));
  const assignmentsRaw = Array.isArray(row.assignments) ? row.assignments : [];
  const assignments = assignmentsRaw
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const labelId = String(item.labelId || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '')
        .slice(0, 64);
      const productType = String(item.productType || '').trim().toUpperCase();
      if (!validLabelIds.has(labelId)) return null;
      if (productType !== 'FABRIC' && productType !== 'DESIGN' && productType !== 'READY_TO_WEAR') return null;
      const productIds = Array.from(
        new Set(
          (Array.isArray(item.productIds) ? item.productIds : [])
            .map((value) => String(value || '').trim())
            .filter(Boolean)
        )
      );
      if (productIds.length === 0) return null;
      return { labelId, productType: productType as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', productIds };
    })
    .filter(Boolean) as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>;
  return {
    newTagDays: Number.isFinite(newTagDaysRaw)
      ? Math.max(1, Math.min(120, Math.round(newTagDaysRaw)))
      : fallback.newTagDays,
    autoConditions,
    appearance,
    labels: labelsWithDefaults,
    assignments,
  };
}

async function readProductLabelSettings() {
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
}

function buildProductLabels(params: {
  productType: LabelProductType;
  productId: string;
  createdAt?: string | Date | null;
  isOnSale: boolean;
  saleTriggeredByMarkdownRule?: boolean;
  settings: ReturnType<typeof normalizeProductLabelSettings>;
}): ProductLabelDisplay[] {
  const labels = params.settings.labels.filter((entry) => entry.isActive !== false);
  const labelMap = new Map(labels.map((entry) => [entry.id, entry]));
  const output: ProductLabelDisplay[] = [];
  const add = (labelId: string) => {
    const row = labelMap.get(labelId);
    if (!row) return;
    if (output.some((item) => item.id === row.id)) return;
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
    .filter(
      (entry) =>
        entry.productType === params.productType &&
        Array.isArray(entry.productIds) &&
        entry.productIds.includes(params.productId)
    )
    .map((entry) => entry.labelId);
  for (const labelId of manualLabelIds) add(labelId);
  return output;
}

// Public routes (no auth required)

// Get all categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await prisma.productCategory.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

// Get all material types
router.get('/materials', async (req, res, next) => {
  try {
    const materials = await prisma.materialType.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });

    res.json({
      success: true,
      data: materials,
    });
  } catch (error) {
    next(error);
  }
});

// Get all fabric categories
router.get('/fabric-categories', async (_req, res, next) => {
  try {
    const categories = await prisma.fabricCategory.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/ready-to-wear-size-guide', async (_req, res) => {
  const data = await readReadyToWearSizeGuide();
  res.json({ success: true, data });
});

// Get fabrics with filters
router.get('/fabrics', async (req, res, next) => {
  try {
    const { country, materialTypeId, fabricCategoryId, color, sellerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (country) {
      where.seller = { country: country as string };
    }

    if (materialTypeId) {
      where.materialTypeId = materialTypeId as string;
    }
    if (fabricCategoryId) {
      where.fabricCategoryId = fabricCategoryId as string;
    }
    if (sellerId) {
      where.sellerId = sellerId as string;
    }

    const orConditions: any[] = [];
    if (search) {
      orConditions.push(
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      );
    }
    if (color) {
      orConditions.push(
        { name: { contains: color as string, mode: 'insensitive' } },
        { description: { contains: color as string, mode: 'insensitive' } }
      );
    }
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const pagination = parsePagination(page, limit, 20);

    const [fabrics, total] = await Promise.all([
      prisma.fabric.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          materialType: true,
          fabricCategory: true,
          seller: {
            select: { id: true, country: true, city: true, businessName: true },
          },
          images: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.fabric.count({ where }),
    ]);
    const colorMap = await readFabricPredominantColorMap(fabrics.map((item) => item.id));
    const [labelSettings, markdownRules, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readActivePricingRules(),
    ]);
    const withLabels = fabrics.map((item) => ({
      ...item,
      finalPrice: applyActivePricingRules(Number(item.sellerPrice || item.finalPrice || 0), {
        productType: 'FABRIC',
        country: item.seller?.country || '',
      }, pricingRules),
      predominantColor: colorMap[item.id] || null,
      productLabels: buildProductLabels({
        productType: 'FABRIC',
        productId: item.id,
        createdAt: item.createdAt,
        isOnSale:
          applyActivePricingRules(Number(item.sellerPrice || item.finalPrice || 0), {
            productType: 'FABRIC',
            country: item.seller?.country || '',
          }, pricingRules) < Number(item.sellerPrice || 0),
        saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
          productType: 'FABRIC',
          country: item.seller?.country || '',
        }),
        settings: labelSettings,
      }),
      materialTypeName: item.materialType?.name || 'Material',
      fabricCategoryName: item.fabricCategory?.name || 'Fabric',
    }));

    res.json({
      success: true,
      data: {
        fabrics: withLabels,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single fabric
router.get('/fabrics/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const fabric = await prisma.fabric.findUnique({
      where: { id },
      include: {
        materialType: true,
        fabricCategory: true,
        seller: {
          select: {
            id: true,
            businessName: true,
            country: true,
            city: true,
            rating: true,
          },
        },
        images: true,
        designFabrics: {
          include: {
            design: {
              select: {
                id: true,
                name: true,
                images: { take: 1 },
              },
            },
          },
        },
      },
    });

    if (!fabric) {
      return res.status(404).json({
        success: false,
        message: 'Fabric not found.',
      });
    }
    const [labelSettings, markdownRules, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readActivePricingRules(),
    ]);
    const colorMap = await readFabricPredominantColorMap([fabric.id]);
    const adjustedFinalPrice = applyActivePricingRules(Number(fabric.sellerPrice || fabric.finalPrice || 0), {
      productType: 'FABRIC',
      country: fabric.seller?.country || '',
    }, pricingRules);

    res.json({
      success: true,
      data: {
        ...fabric,
        finalPrice: adjustedFinalPrice,
        predominantColor: colorMap[fabric.id] || null,
        materialTypeName: fabric.materialType?.name || 'Material',
        fabricCategoryName: fabric.fabricCategory?.name || 'Fabric',
        productLabels: buildProductLabels({
          productType: 'FABRIC',
          productId: fabric.id,
          createdAt: fabric.createdAt,
          isOnSale: adjustedFinalPrice < Number(fabric.sellerPrice || 0),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'FABRIC',
            country: fabric.seller?.country || '',
          }),
          settings: labelSettings,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get designs with filters
router.get('/designs', async (req, res, next) => {
  try {
    const { categoryId, country, materialTypeId, size, color, designerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (country) where.designer = { country: country as string };
    if (materialTypeId) where.materialTypeId = materialTypeId as string;
    if (designerId) where.designerId = designerId as string;

    const orConditions: any[] = [];
    if (search) {
      orConditions.push(
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      );
    }
    // Designs do not have explicit size/color columns yet, so we apply token matching on text fields.
    if (size) {
      orConditions.push(
        { name: { contains: size as string, mode: 'insensitive' } },
        { description: { contains: size as string, mode: 'insensitive' } }
      );
    }
    if (color) {
      orConditions.push(
        { name: { contains: color as string, mode: 'insensitive' } },
        { description: { contains: color as string, mode: 'insensitive' } }
      );
    }
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }

    const pagination = parsePagination(page, limit, 20);

    const [designs, total] = await Promise.all([
      prisma.design.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          category: true,
          materialType: true,
          designer: {
            select: {
              id: true,
              businessName: true,
              country: true,
              city: true,
              rating: true,
              user: { select: { avatar: true } },
            },
          },
          images: true,
          suitableFabrics: {
            include: {
              fabric: {
                select: {
                  id: true,
                  name: true,
                  finalPrice: true,
                  images: { take: 1 },
                  seller: { select: { country: true } },
                },
              },
            },
          },
          measurementVariables: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.design.count({ where }),
    ]);
    const [labelSettings, markdownRules, maxSuitableFabricsPerDesign, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readMaxSuitableFabricsPerDesign(),
      readActivePricingRules(),
    ]);
    const withLabels = designs.map((item) => ({
      ...item,
      finalPrice: applyActivePricingRules(Number(item.basePrice || item.finalPrice || 0), {
        productType: 'DESIGN',
        country: item.designer?.country || '',
      }, pricingRules),
      suitableFabrics: Array.isArray(item.suitableFabrics)
        ? item.suitableFabrics.slice(0, maxSuitableFabricsPerDesign).map((entry: any) => ({
            ...entry,
            fabric: entry?.fabric
              ? {
                  ...entry.fabric,
                  finalPrice: applyActivePricingRules(
                    Number(entry.fabric.sellerPrice || entry.fabric.finalPrice || 0),
                    {
                      productType: 'FABRIC',
                      country: entry.fabric?.seller?.country || '',
                    },
                    pricingRules
                  ),
                }
              : entry?.fabric,
          }))
        : [],
      productLabels: buildProductLabels({
        productType: 'DESIGN',
        productId: item.id,
        createdAt: item.createdAt,
        isOnSale:
          applyActivePricingRules(Number(item.basePrice || item.finalPrice || 0), {
            productType: 'DESIGN',
            country: item.designer?.country || '',
          }, pricingRules) < Number(item.basePrice || 0),
        saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
          productType: 'DESIGN',
          country: item.designer?.country || '',
        }),
        settings: labelSettings,
      }),
    }));

    res.json({
      success: true,
      data: {
        designs: withLabels,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single design
router.get('/designs/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const design = await prisma.design.findUnique({
      where: { id },
      include: {
        category: true,
        designer: {
          select: {
            id: true,
            businessName: true,
            bio: true,
            country: true,
            city: true,
            rating: true,
            user: { select: { avatar: true } },
          },
        },
        images: true,
        suitableFabrics: {
          include: {
            fabric: {
              include: {
                materialType: true,
                images: { take: 1 },
                seller: {
                  select: {
                    businessName: true,
                    country: true,
                    city: true,
                  },
                },
              },
            },
          },
        },
        measurementVariables: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!design) {
      return res.status(404).json({
        success: false,
        message: 'Design not found.',
      });
    }
    const [labelSettings, markdownRules, maxSuitableFabricsPerDesign, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readMaxSuitableFabricsPerDesign(),
      readActivePricingRules(),
    ]);
    const suitableFabrics = (await resolveDesignSuitableFabricsForCustomer(design, maxSuitableFabricsPerDesign)).map((entry: any) => ({
      ...entry,
      fabric: entry?.fabric
        ? {
            ...entry.fabric,
            finalPrice: applyActivePricingRules(
              Number(entry.fabric.sellerPrice || entry.fabric.finalPrice || 0),
              {
                productType: 'FABRIC',
                country: entry.fabric?.seller?.country || '',
              },
              pricingRules
            ),
          }
        : entry?.fabric,
    }));
    const adjustedDesignPrice = applyActivePricingRules(Number(design.basePrice || design.finalPrice || 0), {
      productType: 'DESIGN',
      country: design.designer?.country || '',
    }, pricingRules);

    res.json({
      success: true,
      data: {
        ...design,
        finalPrice: adjustedDesignPrice,
        suitableFabrics,
        productLabels: buildProductLabels({
          productType: 'DESIGN',
          productId: design.id,
          createdAt: design.createdAt,
          isOnSale: adjustedDesignPrice < Number(design.basePrice || 0),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'DESIGN',
            country: design.designer?.country || '',
          }),
          settings: labelSettings,
        }),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get ready-to-wear with filters
router.get('/ready-to-wear', async (req, res, next) => {
  try {
    const { categoryId, country, material, materialTypeId, fabricCategoryId, size, color, designerId, search, page, limit } = req.query;

    const where: any = {
      status: ProductStatus.APPROVED,
      isAvailable: true,
    };

    if (categoryId) where.categoryId = categoryId as string;
    if (country) where.designer = { country: country as string };
    if (designerId) where.designerId = designerId as string;
    if (materialTypeId) where.materialTypeId = materialTypeId as string;
    if (fabricCategoryId) where.fabricCategoryId = fabricCategoryId as string;

    const orConditions: any[] = [];
    if (search) {
      orConditions.push(
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } }
      );
    }
    if (material) {
      orConditions.push(
        { name: { contains: material as string, mode: 'insensitive' } },
        { description: { contains: material as string, mode: 'insensitive' } },
        { materialType: { is: { name: { contains: material as string, mode: 'insensitive' } } } },
        { fabricCategory: { is: { name: { contains: material as string, mode: 'insensitive' } } } }
      );
    }
    if (orConditions.length > 0) {
      where.OR = orConditions;
    }
    if (size) {
      const sizeToken = String(size || '').trim().toUpperCase();
      if (sizeToken) {
        where.sizeVariations = {
          some: {
            OR: [
              { size: { equals: sizeToken, mode: 'insensitive' } },
              { size: { startsWith: `${sizeToken}${READY_TO_WEAR_VARIANT_SEPARATOR}`, mode: 'insensitive' } },
            ],
          },
        };
      }
    }
    if (color) {
      const colorToken = String(color || '').trim().toUpperCase();
      if (colorToken) {
        where.sizeVariations = {
          ...(where.sizeVariations || {}),
          some: {
            ...(where.sizeVariations?.some || {}),
            AND: [
              ...(Array.isArray(where.sizeVariations?.some?.AND) ? where.sizeVariations.some.AND : []),
              { size: { contains: `${READY_TO_WEAR_VARIANT_SEPARATOR}${colorToken}`, mode: 'insensitive' } },
            ],
          },
        };
      }
    }

    const pagination = parsePagination(page, limit, 20);

    const [products, total] = await Promise.all([
      prisma.readyToWear.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        include: {
          category: true,
          materialType: true,
          fabricCategory: true,
          designer: {
            select: {
              id: true,
              businessName: true,
              country: true,
              city: true,
              rating: true,
              user: { select: { avatar: true } },
            },
          },
          images: true,
          sizeVariations: {
            where: { stock: { gt: 0 } },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.readyToWear.count({ where }),
    ]);
    const [labelSettings, markdownRules, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readActivePricingRules(),
    ]);
    const withLabels = products.map((item) => ({
      ...item,
      basePrice: applyActivePricingRules(Number(item.basePrice || 0), {
        productType: 'READY_TO_WEAR',
        country: item.designer?.country || '',
      }, pricingRules),
      sizeVariations: Array.isArray(item.sizeVariations)
        ? item.sizeVariations.map((variation: any) => {
            const decoded = decodeReadyToWearVariantKey(variation?.size);
            return {
              ...variation,
              price: applyActivePricingRules(Number(variation?.price || 0), {
                productType: 'READY_TO_WEAR',
                country: item.designer?.country || '',
              }, pricingRules),
              size: decoded.size,
              color: decoded.color,
              variantKey: decoded.variantKey,
            };
          })
        : [],
      colors: Array.from(
        new Set(
          (Array.isArray(item.sizeVariations) ? item.sizeVariations : [])
            .filter((variation: any) => Number(variation?.stock || 0) > 0)
            .map((variation: any) => decodeReadyToWearVariantKey(variation?.size).color)
            .filter(Boolean)
        )
      ),
      productLabels: buildProductLabels({
        productType: 'READY_TO_WEAR',
        productId: item.id,
        createdAt: item.createdAt,
        isOnSale: (item.sizeVariations || []).some((row: any) => {
          const adjustedPrice = applyActivePricingRules(Number(row.price || 0), {
            productType: 'READY_TO_WEAR',
            country: item.designer?.country || '',
          }, pricingRules);
          const adjustedBase = applyActivePricingRules(Number(item.basePrice || 0), {
            productType: 'READY_TO_WEAR',
            country: item.designer?.country || '',
          }, pricingRules);
          return adjustedPrice < adjustedBase;
        }),
        saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
          productType: 'READY_TO_WEAR',
          country: item.designer?.country || '',
        }),
        settings: labelSettings,
      }),
      materialTypeName: item.materialType?.name || 'Material',
      fabricCategoryName: item.fabricCategory?.name || 'Fabric',
    }));

    res.json({
      success: true,
      data: {
        products: withLabels,
        pagination: {
          page: pagination.page,
          limit: pagination.limit,
          total,
          pages: Math.ceil(total / pagination.limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get single ready-to-wear product
router.get('/ready-to-wear/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const product = await prisma.readyToWear.findUnique({
      where: { id },
      include: {
        category: true,
        materialType: true,
        fabricCategory: true,
        designer: {
          select: {
            id: true,
            businessName: true,
            bio: true,
            country: true,
            city: true,
            rating: true,
            user: { select: { avatar: true } },
          },
        },
        images: true,
        sizeVariations: true,
      },
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found.',
      });
    }
    const [labelSettings, markdownRules, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readActivePricingRules(),
    ]);
    const adjustedBasePrice = applyActivePricingRules(Number(product.basePrice || 0), {
      productType: 'READY_TO_WEAR',
      country: product.designer?.country || '',
    }, pricingRules);

    res.json({
      success: true,
      data: {
        ...product,
        basePrice: adjustedBasePrice,
        sizeVariations: Array.isArray(product.sizeVariations)
          ? product.sizeVariations.map((variation: any) => {
              const decoded = decodeReadyToWearVariantKey(variation?.size);
              return {
                ...variation,
                price: applyActivePricingRules(Number(variation?.price || 0), {
                  productType: 'READY_TO_WEAR',
                  country: product.designer?.country || '',
                }, pricingRules),
                size: decoded.size,
                color: decoded.color,
                variantKey: decoded.variantKey,
              };
            })
          : [],
        colors: Array.from(
          new Set(
            (Array.isArray(product.sizeVariations) ? product.sizeVariations : [])
              .filter((variation: any) => Number(variation?.stock || 0) > 0)
              .map((variation: any) => decodeReadyToWearVariantKey(variation?.size).color)
              .filter(Boolean)
          )
        ),
        productLabels: buildProductLabels({
          productType: 'READY_TO_WEAR',
          productId: product.id,
          createdAt: product.createdAt,
          isOnSale: (product.sizeVariations || []).some((row: any) => {
            const adjustedPrice = applyActivePricingRules(Number(row.price || 0), {
              productType: 'READY_TO_WEAR',
              country: product.designer?.country || '',
            }, pricingRules);
            return adjustedPrice < adjustedBasePrice;
          }),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'READY_TO_WEAR',
            country: product.designer?.country || '',
          }),
          settings: labelSettings,
        }),
        materialTypeName: product.materialType?.name || 'Material',
        fabricCategoryName: product.fabricCategory?.name || 'Fabric',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get countries list (for filtering)
router.get('/countries', async (req, res, next) => {
  try {
    const [fabricCountries, designerCountries] = await Promise.all([
      prisma.fabricSellerProfile.groupBy({
        by: ['country'],
      }),
      prisma.designerProfile.groupBy({
        by: ['country'],
      }),
    ]);

    const countries = Array.from(
      new Set(
        [...fabricCountries.map((c) => String(c.country || '').trim()), ...designerCountries.map((c) => String(c.country || '').trim())].filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    next(error);
  }
});

// Get featured products
router.get('/featured', async (req, res, next) => {
  try {
    const [fabrics, designs, readyToWear] = await Promise.all([
      prisma.fabric.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          materialType: true,
          images: { take: 1 },
          seller: { select: { country: true } },
        },
        orderBy: { totalSold: 'desc' },
      }),
      prisma.design.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          category: true,
          images: { take: 1 },
          designer: { select: { businessName: true, country: true } },
        },
        orderBy: { totalOrders: 'desc' },
      }),
      prisma.readyToWear.findMany({
        where: { status: ProductStatus.APPROVED, isAvailable: true },
        take: 4,
        include: {
          category: true,
          images: { take: 1 },
          designer: { select: { businessName: true, country: true } },
          sizeVariations: {
            select: { price: true },
          },
        },
        orderBy: { totalSold: 'desc' },
      }),
    ]);
    const [labelSettings, markdownRules, pricingRules] = await Promise.all([
      readProductLabelSettings(),
      readActiveMarkdownPricingRules(),
      readActivePricingRules(),
    ]);
    const withLabels = {
      fabrics: fabrics.map((item) => ({
        ...item,
        finalPrice: applyActivePricingRules(Number(item.sellerPrice || item.finalPrice || 0), {
          productType: 'FABRIC',
          country: item.seller?.country || '',
        }, pricingRules),
        productLabels: buildProductLabels({
          productType: 'FABRIC',
          productId: item.id,
          createdAt: item.createdAt,
          isOnSale:
            applyActivePricingRules(Number(item.sellerPrice || item.finalPrice || 0), {
              productType: 'FABRIC',
              country: item.seller?.country || '',
            }, pricingRules) < Number(item.sellerPrice || 0),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'FABRIC',
            country: item.seller?.country || '',
          }),
          settings: labelSettings,
        }),
      })),
      designs: designs.map((item) => ({
        ...item,
        finalPrice: applyActivePricingRules(Number(item.basePrice || item.finalPrice || 0), {
          productType: 'DESIGN',
          country: item.designer?.country || '',
        }, pricingRules),
        productLabels: buildProductLabels({
          productType: 'DESIGN',
          productId: item.id,
          createdAt: item.createdAt,
          isOnSale:
            applyActivePricingRules(Number(item.basePrice || item.finalPrice || 0), {
              productType: 'DESIGN',
              country: item.designer?.country || '',
            }, pricingRules) < Number(item.basePrice || 0),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'DESIGN',
            country: item.designer?.country || '',
          }),
          settings: labelSettings,
        }),
      })),
      readyToWear: readyToWear.map((item) => ({
        ...item,
        basePrice: applyActivePricingRules(Number(item.basePrice || 0), {
          productType: 'READY_TO_WEAR',
          country: item.designer?.country || '',
        }, pricingRules),
        sizeVariations: Array.isArray(item.sizeVariations)
          ? item.sizeVariations.map((row: any) => ({
              ...row,
              price: applyActivePricingRules(Number(row.price || 0), {
                productType: 'READY_TO_WEAR',
                country: item.designer?.country || '',
              }, pricingRules),
            }))
          : [],
        productLabels: buildProductLabels({
          productType: 'READY_TO_WEAR',
          productId: item.id,
          createdAt: item.createdAt,
          isOnSale: (item.sizeVariations || []).some((row: any) => {
            const adjustedPrice = applyActivePricingRules(Number(row.price || 0), {
              productType: 'READY_TO_WEAR',
              country: item.designer?.country || '',
            }, pricingRules);
            const adjustedBase = applyActivePricingRules(Number(item.basePrice || 0), {
              productType: 'READY_TO_WEAR',
              country: item.designer?.country || '',
            }, pricingRules);
            return adjustedPrice < adjustedBase;
          }),
          saleTriggeredByMarkdownRule: hasMarkdownSaleRule(markdownRules, {
            productType: 'READY_TO_WEAR',
            country: item.designer?.country || '',
          }),
          settings: labelSettings,
        }),
      })),
    };

    res.json({
      success: true,
      data: {
        fabrics: withLabels.fabrics,
        designs: withLabels.designs,
        readyToWear: withLabels.readyToWear,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:productType/:id/likes', optionalAuth, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const [countRows, likedRows] = await Promise.all([
      prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
        `SELECT COUNT(*)::bigint AS count FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2`,
        productType,
        productId
      ),
      req.user
        ? prisma.$queryRawUnsafe<Array<{ id: string }>>(
            `SELECT "id" FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2 AND "userId" = $3 LIMIT 1`,
            productType,
            productId,
            req.user.id
          )
        : Promise.resolve([]),
    ]);
    const countRaw = countRows[0]?.count ?? 0;
    const count = Number(typeof countRaw === 'bigint' ? countRaw.toString() : countRaw) || 0;
    res.json({
      success: true,
      data: {
        count,
        likedByMe: likedRows.length > 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:productType/:id/likes/toggle', authenticate, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const product = await ensureProductExists(productType, productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2 AND "userId" = $3 LIMIT 1`,
      productType,
      productId,
      req.user!.id
    );
    let likedByMe = false;
    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(`DELETE FROM "ProductLike" WHERE "id" = $1`, existing[0].id);
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ProductLike" ("id", "userId", "productId", "productType") VALUES ($1, $2, $3, $4)`,
        randomUUID(),
        req.user!.id,
        productId,
        productType
      );
      likedByMe = true;
    }
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number | string }>>(
      `SELECT COUNT(*)::bigint AS count FROM "ProductLike" WHERE "productType" = $1 AND "productId" = $2`,
      productType,
      productId
    );
    const countRaw = countRows[0]?.count ?? 0;
    const count = Number(typeof countRaw === 'bigint' ? countRaw.toString() : countRaw) || 0;
    res.json({ success: true, data: { count, likedByMe } });
  } catch (error) {
    next(error);
  }
});

const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(1).max(120).optional(),
  comment: z.string().trim().min(1).max(2000),
  orderId: z.string().trim().min(1).optional(),
  images: z.array(z.string().url()).max(6).optional(),
});

router.get('/:productType/:id/reviews', async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const limitRaw = Number.parseInt(String(req.query.limit ?? '12'), 10) || 12;
    const pricingRules = await readActivePricingRules();
    const limit = Math.min(50, Math.max(1, limitRaw));
    const rows = await prisma.review.findMany({
      where: { productType, productId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const customerIds = Array.from(new Set(rows.map((row) => row.customerId).filter(Boolean)));
    const customers = customerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const customerMap = new Map(customers.map((item) => [item.id, item]));
    const withCustomer = rows.map((row) => {
      const customer = customerMap.get(row.customerId);
      return {
        ...row,
        customer: customer
          ? {
              id: customer.id,
              name: `${String(customer.firstName || '').trim()} ${String(customer.lastName || '').trim()}`.trim() || customer.email,
            }
          : null,
      };
    });
    const aggregate = withCustomer.reduce(
      (acc, row) => {
        acc.count += 1;
        acc.ratingSum += Number(row.rating || 0);
        return acc;
      },
      { count: 0, ratingSum: 0 }
    );
    res.json({
      success: true,
      data: {
        reviews: withCustomer,
        summary: {
          count: aggregate.count,
          averageRating: aggregate.count > 0 ? Number((aggregate.ratingSum / aggregate.count).toFixed(2)) : 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:productType/:id/reviews', authenticate, async (req, res, next) => {
  try {
    await ensureProductEngagementSchema();
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const product = await ensureProductExists(productType, productId);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }
    const data = createReviewSchema.parse(req.body);
    const review = await prisma.review.create({
      data: {
        id: randomUUID(),
        customerId: req.user!.id,
        productId,
        productType,
        orderId: data.orderId || `MANUAL-${Date.now()}`,
        rating: data.rating,
        title: data.title || null,
        comment: data.comment,
        images: data.images || [],
        isVerified: false,
      },
    });
    res.status(201).json({ success: true, data: review });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed.', issues: error.issues });
    }
    next(error);
  }
});

router.get('/:productType/:id/discover', async (req, res, next) => {
  try {
    const productType = normalizeProductTypeToken(req.params.productType);
    if (!productType) {
      return res.status(400).json({ success: false, message: 'Unsupported product type.' });
    }
    const productId = String(req.params.id || '');
    const limitRaw = Number.parseInt(String(req.query.limit ?? '12'), 10) || 12;
    const pricingRules = await readActivePricingRules();
    const pageType = DISCOVER_PAGE_TYPE_BY_PRODUCT_TYPE[productType];
    const pageSettingsSnapshot = await readCategoryPageSettings(pageType);
    const recommendationProductIds = Array.from(
      new Set(
        (pageSettingsSnapshot.settings.recommendationProductIds || [])
          .map((entry) => String(entry || '').trim())
          .filter(Boolean)
      )
    ).slice(0, 120);
    const targetLimit = Math.min(
      30,
      Math.max(
        1,
        Number(pageSettingsSnapshot.settings.recommendationDisplayCount || 0) > 0
          ? Number(pageSettingsSnapshot.settings.recommendationDisplayCount)
          : limitRaw
      )
    );
    const preferSameCountry = pageSettingsSnapshot.settings.recommendationPreferSameCountry !== false;
    const preferDifferentSeller = pageSettingsSnapshot.settings.recommendationPreferDifferentSeller !== false;
    const configuredOnly = pageSettingsSnapshot.settings.recommendationConfiguredOnly === true;

    if (productType === 'DESIGN') {
      const current = await prisma.design.findUnique({
        where: { id: productId },
        select: { id: true, categoryId: true, designerId: true, designer: { select: { country: true } } },
      });
      if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
      const currentCountry = String(current.designer?.country || '').trim();

      const configuredRows =
        recommendationProductIds.length > 0
          ? await prisma.design.findMany({
              where: {
                id: { in: recommendationProductIds, not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                designer: { select: { country: true, businessName: true } },
              },
              take: 180,
            })
          : [];

      const dynamicRows =
        !configuredOnly || configuredRows.length < targetLimit
          ? await prisma.design.findMany({
              where: {
                id: { not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                designer: { select: { country: true, businessName: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 240,
            })
          : [];

      const candidates = dedupeDiscoverCandidates(
        [...configuredRows, ...dynamicRows]
          .map((row) => {
            const country = String(row.designer?.country || '').trim();
            return {
              id: row.id,
              name: row.name,
              image: row.images?.[0]?.url || '',
              priceUsd: applyActivePricingRules(Number(row.basePrice || row.finalPrice || 0), {
                productType: 'DESIGN',
                country,
              }, pricingRules),
              country: country || 'Unknown',
              ownerName: row.designer?.businessName || 'Designer',
              productType: 'DESIGN' as const,
              sellerToken: String(row.designerId || ''),
              sameTaxonomy: Boolean(current.categoryId) && row.categoryId === current.categoryId,
              sameCountry: Boolean(currentCountry) && country === currentCountry,
            } satisfies DiscoverCandidate;
          })
          .filter((entry) => entry.id !== productId)
      );

      const ranked = rankDiscoverCandidates(candidates, {
        currentSellerToken: String(current.designerId || ''),
        preferSameCountry,
        preferDifferentSeller,
      });
      const selected = selectDiscoverCandidates(ranked, targetLimit, { preferDifferentSeller });
      return res.json({
        success: true,
        data: selected.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          priceUsd: item.priceUsd,
          country: item.country,
          ownerName: item.ownerName,
          productType: item.productType,
        })),
      });
    }

    if (productType === 'FABRIC') {
      const current = await prisma.fabric.findUnique({
        where: { id: productId },
        select: { id: true, materialTypeId: true, sellerId: true, seller: { select: { country: true } } },
      });
      if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
      const currentCountry = String(current.seller?.country || '').trim();

      const configuredRows =
        recommendationProductIds.length > 0
          ? await prisma.fabric.findMany({
              where: {
                id: { in: recommendationProductIds, not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                seller: { select: { country: true, businessName: true } },
              },
              take: 180,
            })
          : [];

      const dynamicRows =
        !configuredOnly || configuredRows.length < targetLimit
          ? await prisma.fabric.findMany({
              where: {
                id: { not: productId },
                status: ProductStatus.APPROVED,
                isAvailable: true,
              },
              include: {
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
                seller: { select: { country: true, businessName: true } },
              },
              orderBy: { createdAt: 'desc' },
              take: 240,
            })
          : [];

      const candidates = dedupeDiscoverCandidates(
        [...configuredRows, ...dynamicRows]
          .map((row) => {
            const country = String(row.seller?.country || '').trim();
            return {
              id: row.id,
              name: row.name,
              image: row.images?.[0]?.url || '',
              priceUsd: applyActivePricingRules(Number(row.sellerPrice || row.finalPrice || 0), {
                productType: 'FABRIC',
                country,
              }, pricingRules),
              country: country || 'Unknown',
              ownerName: row.seller?.businessName || 'Seller',
              productType: 'FABRIC' as const,
              sellerToken: String(row.sellerId || ''),
              sameTaxonomy: Boolean(current.materialTypeId) && row.materialTypeId === current.materialTypeId,
              sameCountry: Boolean(currentCountry) && country === currentCountry,
            } satisfies DiscoverCandidate;
          })
          .filter((entry) => entry.id !== productId)
      );

      const ranked = rankDiscoverCandidates(candidates, {
        currentSellerToken: String(current.sellerId || ''),
        preferSameCountry,
        preferDifferentSeller,
      });
      const selected = selectDiscoverCandidates(ranked, targetLimit, { preferDifferentSeller });
      return res.json({
        success: true,
        data: selected.map((item) => ({
          id: item.id,
          name: item.name,
          image: item.image,
          priceUsd: item.priceUsd,
          country: item.country,
          ownerName: item.ownerName,
          productType: item.productType,
        })),
      });
    }

    const current = await prisma.readyToWear.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, designerId: true, designer: { select: { country: true } } },
    });
    if (!current) return res.status(404).json({ success: false, message: 'Product not found.' });
    const currentCountry = String(current.designer?.country || '').trim();

    const configuredRows =
      recommendationProductIds.length > 0
        ? await prisma.readyToWear.findMany({
            where: {
              id: { in: recommendationProductIds, not: productId },
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
            include: {
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
              designer: { select: { country: true, businessName: true } },
              sizeVariations: { where: { stock: { gt: 0 } }, select: { price: true } },
            },
            take: 180,
          })
        : [];

    const dynamicRows =
      !configuredOnly || configuredRows.length < targetLimit
        ? await prisma.readyToWear.findMany({
            where: {
              id: { not: productId },
              status: ProductStatus.APPROVED,
              isAvailable: true,
            },
            include: {
              images: { take: 1, orderBy: { sortOrder: 'asc' } },
              designer: { select: { country: true, businessName: true } },
              sizeVariations: { where: { stock: { gt: 0 } }, select: { price: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 240,
          })
        : [];

    const candidates = dedupeDiscoverCandidates(
      [...configuredRows, ...dynamicRows]
        .map((row) => {
          const country = String(row.designer?.country || '').trim();
          const variationPrices = (row.sizeVariations || [])
            .map((entry) =>
              applyActivePricingRules(Number(entry.price || 0), {
                productType: 'READY_TO_WEAR',
                country,
              }, pricingRules)
            )
            .filter((value) => Number.isFinite(value) && value > 0);
          const priceUsd =
            variationPrices.length > 0
              ? Math.min(...variationPrices)
              : applyActivePricingRules(Number(row.basePrice || 0), {
                  productType: 'READY_TO_WEAR',
                  country,
                }, pricingRules);
          return {
            id: row.id,
            name: row.name,
            image: row.images?.[0]?.url || '',
            priceUsd,
            country: country || 'Unknown',
            ownerName: row.designer?.businessName || 'Designer',
            productType: 'READY_TO_WEAR' as const,
            sellerToken: String(row.designerId || ''),
            sameTaxonomy: Boolean(current.categoryId) && row.categoryId === current.categoryId,
            sameCountry: Boolean(currentCountry) && country === currentCountry,
          } satisfies DiscoverCandidate;
        })
        .filter((entry) => entry.id !== productId)
    );

    const ranked = rankDiscoverCandidates(candidates, {
      currentSellerToken: String(current.designerId || ''),
      preferSameCountry,
      preferDifferentSeller,
    });
    const selected = selectDiscoverCandidates(ranked, targetLimit, { preferDifferentSeller });
    res.json({
      success: true,
      data: selected.map((item) => ({
        id: item.id,
        name: item.name,
        image: item.image,
        priceUsd: item.priceUsd,
        country: item.country,
        ownerName: item.ownerName,
        productType: item.productType,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
