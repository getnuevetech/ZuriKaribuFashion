import { Router } from 'express';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();
const HOMEPAGE_TOP_STRIP_SETTINGS_KEY = 'HOMEPAGE_TOP_STRIP';
const HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY = 'HOMEPAGE_HOW_IT_WORKS_STYLE';
const HOMEPAGE_PRODUCT_LABEL_SETTINGS_KEY = 'HOMEPAGE_PRODUCT_LABELS';

const DEFAULT_PRODUCT_LABEL_SETTINGS = {
  newTagDays: 14,
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

type TopStripSettings = {
  messages: string[];
  separator: string;
  repeatCount: number;
  animationSeconds: number;
  fontSize: number;
  isBold: boolean;
  pauseOnHover: boolean;
  textColor: string;
  backgroundColor: string;
};

type HowItWorksStyleSettings = {
  enabled: boolean;
  iconColor: string;
  iconHoverColor: string;
};

const TOP_STRIP_DEFAULTS: TopStripSettings = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  fontSize: 12,
  isBold: false,
  pauseOnHover: true,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};

const HOW_IT_WORKS_STYLE_DEFAULTS: HowItWorksStyleSettings = {
  enabled: false,
  iconColor: '#111827',
  iconHoverColor: '#ffffff',
};

type FeaturedProductRow = {
  id: string;
  productId: string;
  productType: string;
  section: string;
  displayOrder: number;
  isActive: boolean;
  customTitle?: string | null;
  customDescription?: string | null;
};

const isSchemaDriftError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2022');

const readFeaturedRowsWithFallback = async (section: string | null, take: number) => {
  try {
    const rows = await prisma.featuredProduct.findMany({
      where: {
        ...(section ? { section: section as any } : {}),
        isActive: true,
      },
      orderBy: { displayOrder: 'asc' },
      take,
    });
    return rows.map((row) => ({
      id: String(row.id),
      productId: String(row.productId),
      productType: String(row.productType || '').toUpperCase(),
      section: String(row.section || ''),
      displayOrder: Number(row.displayOrder || 0),
      isActive: Boolean(row.isActive),
      customTitle: row.customTitle ?? null,
      customDescription: row.customDescription ?? null,
    })) as FeaturedProductRow[];
  } catch (error) {
    if (!isSchemaDriftError(error)) {
      console.warn('[homepage/featured] Prisma featured query failed, trying SQL fallback:', error);
    }
    try {
      const rows = section
        ? await prisma.$queryRawUnsafe<any[]>(
            `SELECT "id", "productId", "productType", "section", "displayOrder", "isActive"
             FROM "FeaturedProduct"
             WHERE "isActive" = TRUE
               AND "section" = $1
             ORDER BY "displayOrder" ASC
             LIMIT $2`,
            section,
            take
          )
        : await prisma.$queryRawUnsafe<any[]>(
            `SELECT "id", "productId", "productType", "section", "displayOrder", "isActive"
             FROM "FeaturedProduct"
             WHERE "isActive" = TRUE
             ORDER BY "displayOrder" ASC
             LIMIT $1`,
            take
          );
      return (Array.isArray(rows) ? rows : []).map((row) => ({
        id: String(row?.id || ''),
        productId: String(row?.productId || ''),
        productType: String(row?.productType || '').toUpperCase(),
        section: String(row?.section || ''),
        displayOrder: Number(row?.displayOrder || 0),
        isActive: Boolean(row?.isActive),
        customTitle: null,
        customDescription: null,
      }));
    } catch (fallbackError) {
      console.error('[homepage/featured] SQL featured fallback failed:', fallbackError);
      return [] as FeaturedProductRow[];
    }
  }
};

function normalizeProductLabelSettings(raw: unknown) {
  const fallback = {
    ...DEFAULT_PRODUCT_LABEL_SETTINGS,
    labels: DEFAULT_PRODUCT_LABEL_SETTINGS.labels.map((entry) => ({ ...entry })),
    assignments: [] as Array<{ labelId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productIds: string[] }>,
  };
  if (!raw || typeof raw !== 'object') return fallback;
  const row = raw as Record<string, unknown>;
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
  const newTagDaysRaw = Number(row.newTagDays);
  return {
    newTagDays: Number.isFinite(newTagDaysRaw)
      ? Math.max(1, Math.min(120, Math.round(newTagDaysRaw)))
      : fallback.newTagDays,
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
  productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  productId: string;
  createdAt?: string | Date | null;
  isOnSale: boolean;
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
  const isNew = createdAt > 0 && now - createdAt <= params.settings.newTagDays * 24 * 60 * 60 * 1000;
  if (isNew) {
    const autoNew = labels.find((entry) => entry.mode === 'AUTO_NEW');
    if (autoNew) add(autoNew.id);
  }
  if (params.isOnSale) {
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

const hydrateFeaturedProduct = async (
  fp: FeaturedProductRow,
  labelSettings: ReturnType<typeof normalizeProductLabelSettings>
) => {
  if (fp.productType === 'DESIGN') {
    const product = await prisma.design.findUnique({
      where: { id: fp.productId },
      include: {
        designer: {
          select: {
            businessName: true,
            country: true,
          },
        },
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) return null;
    return {
      id: product.id,
      name: fp.customTitle || product.name,
      description: fp.customDescription || product.description,
      price: Number(product.finalPrice ?? product.basePrice ?? 0),
      image: Array.isArray(product.images) ? product.images[0]?.url || '/images/placeholder.jpg' : '/images/placeholder.jpg',
      designer: product.designer?.businessName || 'Designer',
      country: product.designer?.country || '',
      productType: fp.productType,
      productLabels: buildProductLabels({
        productType: 'DESIGN',
        productId: product.id,
        createdAt: product.createdAt,
        isOnSale: Number(product.finalPrice ?? 0) < Number(product.basePrice ?? 0),
        settings: labelSettings,
      }),
    };
  }

  if (fp.productType === 'FABRIC') {
    const product = await prisma.fabric.findUnique({
      where: { id: fp.productId },
      include: {
        seller: {
          select: {
            businessName: true,
            country: true,
          },
        },
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) return null;
    return {
      id: product.id,
      name: fp.customTitle || product.name,
      description: fp.customDescription || product.description,
      price: Number(product.finalPrice ?? product.sellerPrice ?? 0),
      image: Array.isArray(product.images) ? product.images[0]?.url || '/images/placeholder.jpg' : '/images/placeholder.jpg',
      designer: product.seller?.businessName || 'Fabric Seller',
      country: product.seller?.country || '',
      productType: fp.productType,
      productLabels: buildProductLabels({
        productType: 'FABRIC',
        productId: product.id,
        createdAt: product.createdAt,
        isOnSale: Number(product.finalPrice ?? 0) < Number(product.sellerPrice ?? 0),
        settings: labelSettings,
      }),
    };
  }

  if (fp.productType === 'READY_TO_WEAR') {
    const product = await prisma.readyToWear.findUnique({
      where: { id: fp.productId },
      include: {
        designer: {
          select: {
            businessName: true,
            country: true,
          },
        },
        images: {
          take: 1,
          orderBy: { sortOrder: 'asc' },
        },
        sizeVariations: {
          select: { price: true },
        },
      },
    });

    if (!product) return null;
    return {
      id: product.id,
      name: fp.customTitle || product.name,
      description: fp.customDescription || product.description,
      price: Number(product.basePrice || 0),
      image: Array.isArray(product.images) ? product.images[0]?.url || '/images/placeholder.jpg' : '/images/placeholder.jpg',
      designer: product.designer?.businessName || 'Designer',
      country: product.designer?.country || '',
      productType: fp.productType,
      productLabels: buildProductLabels({
        productType: 'READY_TO_WEAR',
        productId: product.id,
        createdAt: product.createdAt,
        isOnSale: (product.sizeVariations || []).some((row) => Number(row.price || 0) < Number(product.basePrice || 0)),
        settings: labelSettings,
      }),
    };
  }

  return null;
};

let homepageSettingsSchemaEnsured = false;
let homepageSettingsSchemaPromise: Promise<void> | null = null;
const ensureHomepageSettingsSchema = async () => {
  if (homepageSettingsSchemaEnsured) return;
  if (homepageSettingsSchemaPromise) {
    await homepageSettingsSchemaPromise;
    return;
  }
  homepageSettingsSchemaPromise = (async () => {
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
    homepageSettingsSchemaEnsured = true;
  })();
  try {
    await homepageSettingsSchemaPromise;
  } finally {
    homepageSettingsSchemaPromise = null;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureHomepageSettingsSchema();
  } catch (error) {
    console.error('Failed to ensure homepage settings schema:', error);
  }
  next();
});

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

const normalizeTopStripSettings = (raw: unknown): TopStripSettings => {
  if (!raw || typeof raw !== 'object') return { ...TOP_STRIP_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages)
    ? row.messages
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    : [];
  const separator =
    typeof row.separator === 'string' && row.separator.trim()
      ? row.separator.trim().slice(0, 8)
      : TOP_STRIP_DEFAULTS.separator;
  const repeatCountRaw = Number(row.repeatCount);
  const animationSecondsRaw = Number(row.animationSeconds);
  const fontSizeRaw = Number(row.fontSize);
  const pauseOnHover = typeof row.pauseOnHover === 'boolean' ? row.pauseOnHover : TOP_STRIP_DEFAULTS.pauseOnHover;
  return {
    messages: messages.length > 0 ? messages : [...TOP_STRIP_DEFAULTS.messages],
    separator,
    repeatCount: Number.isFinite(repeatCountRaw) ? Math.max(2, Math.min(12, Math.round(repeatCountRaw))) : TOP_STRIP_DEFAULTS.repeatCount,
    animationSeconds: Number.isFinite(animationSecondsRaw)
      ? Math.max(8, Math.min(120, Math.round(animationSecondsRaw)))
      : TOP_STRIP_DEFAULTS.animationSeconds,
    fontSize: Number.isFinite(fontSizeRaw) ? Math.max(10, Math.min(40, Math.round(fontSizeRaw))) : TOP_STRIP_DEFAULTS.fontSize,
    isBold: typeof row.isBold === 'boolean' ? row.isBold : TOP_STRIP_DEFAULTS.isBold,
    pauseOnHover,
    textColor: normalizeHexColor(row.textColor, TOP_STRIP_DEFAULTS.textColor),
    backgroundColor: normalizeHexColor(row.backgroundColor, TOP_STRIP_DEFAULTS.backgroundColor),
  };
};

const normalizeHowItWorksStyleSettings = (raw: unknown): HowItWorksStyleSettings => {
  if (!raw || typeof raw !== 'object') return { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : HOW_IT_WORKS_STYLE_DEFAULTS.enabled,
    iconColor: normalizeHexColor(row.iconColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconColor),
    iconHoverColor: normalizeHexColor(row.iconHoverColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconHoverColor),
  };
};

const readTopStripSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...TOP_STRIP_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeTopStripSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...TOP_STRIP_DEFAULTS } };
  }
};

const saveTopStripSettings = async (rawInput: unknown) => {
  const existing = await readTopStripSettings();
  const merged = normalizeTopStripSettings({
    ...existing.settings,
    ...(rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {}),
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readHowItWorksStyleSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return { rowId: null as string | null, settings: { ...HOW_IT_WORKS_STYLE_DEFAULTS } };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeHowItWorksStyleSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return { rowId: String(row.id), settings: { ...HOW_IT_WORKS_STYLE_DEFAULTS } };
  }
};

const saveHowItWorksStyleSettings = async (rawInput: unknown) => {
  const existing = await readHowItWorksStyleSettings();
  const merged = normalizeHowItWorksStyleSettings({
    ...existing.settings,
    ...(rawInput && typeof rawInput === 'object' ? (rawInput as Record<string, unknown>) : {}),
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY,
    payload
  );
  return merged;
};

// ==================== PUBLIC ENDPOINTS (for frontend) ====================

router.get('/top-strip', async (_req, res) => {
  try {
    const { settings } = await readTopStripSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching top strip settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top strip settings',
    });
  }
});

router.get('/how-it-works-style', async (_req, res) => {
  try {
    const { settings } = await readHowItWorksStyleSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching how it works style settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch how it works style settings',
    });
  }
});

router.get('/categories', async (_req, res) => {
  try {
    const categories = await prisma.shopCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching homepage categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
});

// Get active hero slides
router.get('/hero-slides', async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: slides,
    });
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slides',
    });
  }
});

// Get featured products by section
router.get('/featured/:section', async (req, res) => {
  try {
    const { section } = req.params;
    const featuredProducts = await readFeaturedRowsWithFallback(String(section || '').trim(), 12);
    const labelSettings = await readProductLabelSettings();
    const productsWithDetails = await Promise.all(
      featuredProducts.map((fp) => hydrateFeaturedProduct(fp, labelSettings))
    );

    // Filter out nulls (products that no longer exist)
    const validProducts = productsWithDetails.filter((p) => p !== null);

    res.json({
      success: true,
      data: validProducts,
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
    });
  }
});

// Get all featured sections (for homepage)
router.get('/featured', async (req, res) => {
  try {
    const sections = ['FEATURED_DESIGNS', 'FEATURED_FABRICS', 'FEATURED_READY_TO_WEAR', 'TRENDING_NOW'];
    const result: Record<string, any[]> = {};
    const labelSettings = await readProductLabelSettings();

    for (const section of sections) {
      const featuredProducts = await readFeaturedRowsWithFallback(section, 6);
      const productsWithDetails = await Promise.all(
        featuredProducts.map((fp) => hydrateFeaturedProduct(fp, labelSettings))
      );

      result[section] = productsWithDetails.filter((p) => p !== null);
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching all featured sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured sections',
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

router.get('/admin/top-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readTopStripSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching admin top strip settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch top strip settings',
    });
  }
});

router.put('/admin/top-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveTopStripSettings(req.body);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating top strip settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update top strip settings',
    });
  }
});

router.patch('/admin/top-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveTopStripSettings(req.body);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating top strip settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update top strip settings',
    });
  }
});

router.get('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings } = await readHowItWorksStyleSettings();
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching admin how it works style settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch how it works style settings',
    });
  }
});

router.put('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveHowItWorksStyleSettings(req.body);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating admin how it works style settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update how it works style settings',
    });
  }
});

router.patch('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const settings = await saveHowItWorksStyleSettings(req.body);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating admin how it works style settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update how it works style settings',
    });
  }
});

// Get all hero slides (admin)
router.get('/admin/hero-slides', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const slides = await prisma.heroSlide.findMany({
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: slides,
    });
  } catch (error) {
    console.error('Error fetching hero slides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hero slides',
    });
  }
});

// Create hero slide (admin)
router.post('/admin/hero-slides', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { title, subtitle, image, ctaText, ctaLink, displayOrder } = req.body;

    if (!title || !subtitle || !image) {
      return res.status(400).json({
        success: false,
        message: 'Title, subtitle, and image are required',
      });
    }

    const slide = await prisma.heroSlide.create({
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder: displayOrder || 0,
      },
    });

    res.status(201).json({
      success: true,
      data: slide,
      message: 'Hero slide created successfully',
    });
  } catch (error) {
    console.error('Error creating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create hero slide',
    });
  }
});

// Update hero slide (admin)
router.put('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image, ctaText, ctaLink, displayOrder, isActive } = req.body;

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder,
        isActive,
      },
    });

    res.json({
      success: true,
      data: slide,
      message: 'Hero slide updated successfully',
    });
  } catch (error) {
    console.error('Error updating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hero slide',
    });
  }
});

// Update hero slide (admin) - PATCH alias for backward compatibility
router.patch('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, subtitle, image, ctaText, ctaLink, displayOrder, isActive } = req.body;

    const slide = await prisma.heroSlide.update({
      where: { id },
      data: {
        title,
        subtitle,
        image,
        ctaText,
        ctaLink,
        displayOrder,
        isActive,
      },
    });

    res.json({
      success: true,
      data: slide,
      message: 'Hero slide updated successfully',
    });
  } catch (error) {
    console.error('Error updating hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update hero slide',
    });
  }
});

// Delete hero slide (admin)
router.delete('/admin/hero-slides/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.heroSlide.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Hero slide deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting hero slide:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete hero slide',
    });
  }
});

// Get all featured products (admin)
router.get('/admin/featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const featured = await prisma.featuredProduct.findMany({
      orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }],
    });

    res.json({
      success: true,
      data: featured,
    });
  } catch (error) {
    console.error('Error fetching featured products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch featured products',
    });
  }
});

// Add product to featured section (admin)
router.post('/admin/featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { productId, productType, section, displayOrder, customTitle, customDescription } = req.body;

    if (!productId || !productType || !section) {
      return res.status(400).json({
        success: false,
        message: 'Product ID, product type, and section are required',
      });
    }

    // Verify product exists
    let product = null;
    if (productType === 'DESIGN') {
      product = await prisma.design.findUnique({ where: { id: productId } });
    } else if (productType === 'FABRIC') {
      product = await prisma.fabric.findUnique({ where: { id: productId } });
    } else if (productType === 'READY_TO_WEAR') {
      product = await prisma.readyToWear.findUnique({ where: { id: productId } });
    }

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found',
      });
    }

    const featured = await prisma.featuredProduct.create({
      data: {
        productId,
        productType,
        section,
        displayOrder: displayOrder || 0,
        customTitle,
        customDescription,
      },
    });

    res.status(201).json({
      success: true,
      data: featured,
      message: 'Product added to featured section',
    });
  } catch (error) {
    console.error('Error adding featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add featured product',
    });
  }
});

// Update featured product (admin)
router.put('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder, customTitle, customDescription, isActive } = req.body;

    const featured = await prisma.featuredProduct.update({
      where: { id },
      data: {
        displayOrder,
        customTitle,
        customDescription,
        isActive,
      },
    });

    res.json({
      success: true,
      data: featured,
      message: 'Featured product updated successfully',
    });
  } catch (error) {
    console.error('Error updating featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured product',
    });
  }
});

// Update featured product (admin) - PATCH alias for backward compatibility
router.patch('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;
    const { displayOrder, customTitle, customDescription, isActive } = req.body;

    const featured = await prisma.featuredProduct.update({
      where: { id },
      data: {
        displayOrder,
        customTitle,
        customDescription,
        isActive,
      },
    });

    res.json({
      success: true,
      data: featured,
      message: 'Featured product updated successfully',
    });
  } catch (error) {
    console.error('Error updating featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update featured product',
    });
  }
});

// Remove product from featured section (admin)
router.delete('/admin/featured/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.featuredProduct.delete({
      where: { id },
    });

    res.json({
      success: true,
      message: 'Product removed from featured section',
    });
  } catch (error) {
    console.error('Error removing featured product:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove featured product',
    });
  }
});

// Get available products for featuring (admin)
router.get('/admin/products-for-featured', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const { type } = req.query;

    let products: any[] = [];

    if (type === 'DESIGN' || !type) {
      const designs = await prisma.design.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...designs.map((d) => ({ ...d, type: 'DESIGN' }))];
    }

    if (type === 'FABRIC' || !type) {
      const fabrics = await prisma.fabric.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          seller: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...fabrics.map((f) => ({ ...f, type: 'FABRIC' }))];
    }

    if (type === 'READY_TO_WEAR' || !type) {
      const rtw = await prisma.readyToWear.findMany({
        where: { status: 'APPROVED', isAvailable: true },
        select: {
          id: true,
          name: true,
          designer: {
            select: {
              businessName: true,
            },
          },
        },
        take: 50,
      });
      products = [...products, ...rtw.map((r) => ({ ...r, type: 'READY_TO_WEAR' }))];
    }

    res.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error('Error fetching products for featuring:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch products',
    });
  }
});

export default router;
