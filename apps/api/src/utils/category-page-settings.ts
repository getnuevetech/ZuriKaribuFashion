import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, ProductStatus } from '../db';

export const CATEGORY_PAGE_TYPES = ['READY_TO_WEAR', 'FABRIC_TO_BUY', 'CUSTOM_TO_WEAR'] as const;
export type CategoryPageType = (typeof CATEGORY_PAGE_TYPES)[number];

export type CategoryPageProductPreview = {
  id: string;
  name: string;
  description: string | undefined;
  image: string;
  priceUsd: number;
  country: string;
  ownerName: string;
  href: string;
};

export type CategoryPageProductOption = {
  id: string;
  name: string;
  description: string | undefined;
  ownerName: string;
  country: string;
  priceUsd: number;
  image: string;
};

const CATEGORY_PAGE_SETTINGS_KEY_PREFIX = 'CATEGORY_PAGE_SETTINGS_V1_';

const featuredSlotSchema = z.object({
  productId: z.string().trim().max(120).default(''),
  isActive: z.boolean().default(true),
});

const categoryPageSettingsSchema = z.object({
  bannerTitle: z.string().trim().max(120),
  bannerSubtitle: z.string().trim().max(320),
  bannerImage: z.string().trim().max(2048),
  bannerHeight: z.number().int().min(220).max(560),
  pageSize: z.number().int().min(8).max(120),
  columns: z.number().int().min(2).max(6),
  showPagination: z.boolean(),
  featuredProductIds: z.array(z.string().trim().min(1)).max(3),
  featuredSlots: z.array(featuredSlotSchema).max(3),
  rotatingProductIds: z.array(z.string().trim().min(1)).max(24),
  rotatingColumns: z.number().int().min(1).max(6),
  rotatingRows: z.number().int().min(1).max(6),
  rotatingTitleSize: z.number().int().min(16).max(64),
});

const categoryPageSettingsPatchSchema = categoryPageSettingsSchema.partial();

export type CategoryPageSettings = z.infer<typeof categoryPageSettingsSchema>;

const DEFAULT_SETTINGS_BY_PAGE: Record<CategoryPageType, CategoryPageSettings> = {
  READY_TO_WEAR: {
    bannerTitle: 'Ready To Wear',
    bannerSubtitle: 'Shop ready styles from designers across Africa.',
    bannerImage: '/images/hero-readytowear.jpg',
    bannerHeight: 320,
    pageSize: 24,
    columns: 4,
    showPagination: true,
    featuredProductIds: [],
    featuredSlots: [
      { productId: '', isActive: false },
      { productId: '', isActive: false },
      { productId: '', isActive: false },
    ],
    rotatingProductIds: [],
    rotatingColumns: 2,
    rotatingRows: 1,
    rotatingTitleSize: 32,
  },
  FABRIC_TO_BUY: {
    bannerTitle: 'Fabrics To Buy',
    bannerSubtitle: 'Choose quality fabrics by material and country.',
    bannerImage: '/images/hero-fabrics.jpg',
    bannerHeight: 320,
    pageSize: 24,
    columns: 4,
    showPagination: true,
    featuredProductIds: [],
    featuredSlots: [
      { productId: '', isActive: false },
      { productId: '', isActive: false },
      { productId: '', isActive: false },
    ],
    rotatingProductIds: [],
    rotatingColumns: 2,
    rotatingRows: 1,
    rotatingTitleSize: 32,
  },
  CUSTOM_TO_WEAR: {
    bannerTitle: 'Custom To Wear',
    bannerSubtitle: 'Discover custom designs made for your measurements.',
    bannerImage: '/images/hero-designs.jpg',
    bannerHeight: 320,
    pageSize: 24,
    columns: 4,
    showPagination: true,
    featuredProductIds: [],
    featuredSlots: [
      { productId: '', isActive: false },
      { productId: '', isActive: false },
      { productId: '', isActive: false },
    ],
    rotatingProductIds: [],
    rotatingColumns: 2,
    rotatingRows: 1,
    rotatingTitleSize: 32,
  },
};

const normalizePageTypeToken = (value: string): CategoryPageType | null => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/-/g, '_');
  if (token === 'READY_TO_WEAR' || token === 'READYTOWEAR') return 'READY_TO_WEAR';
  if (token === 'FABRIC_TO_BUY' || token === 'FABRICS' || token === 'FABRICS_TO_BUY') return 'FABRIC_TO_BUY';
  if (token === 'CUSTOM_TO_WEAR' || token === 'CUSTOMTOWEAR' || token === 'DESIGNS') return 'CUSTOM_TO_WEAR';
  return null;
};

const settingsKeyForPage = (pageType: CategoryPageType) => `${CATEGORY_PAGE_SETTINGS_KEY_PREFIX}${pageType}`;

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const normalizeCategoryPageSettings = (pageType: CategoryPageType, raw: unknown): CategoryPageSettings => {
  const fallback = DEFAULT_SETTINGS_BY_PAGE[pageType];
  const row = asObject(raw);
  const featuredProductIdsFromLegacy = Array.isArray(row.featuredProductIds)
    ? Array.from(
        new Set(
          row.featuredProductIds
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .slice(0, 3)
        )
      )
    : fallback.featuredProductIds;
  const rawFeaturedSlots = Array.isArray(row.featuredSlots)
    ? row.featuredSlots
    : featuredProductIdsFromLegacy.map((productId) => ({ productId, isActive: true }));
  const seenFeaturedProductIds = new Set<string>();
  const featuredSlots = rawFeaturedSlots
    .map((entry) => {
      const slot = asObject(entry);
      const productId = String(slot.productId || '').trim();
      const token = productId.toLowerCase();
      if (productId && seenFeaturedProductIds.has(token)) {
        return { productId: '', isActive: false };
      }
      if (productId) seenFeaturedProductIds.add(token);
      return {
        productId,
        isActive: productId ? slot.isActive !== false : false,
      };
    })
    .slice(0, 3);
  while (featuredSlots.length < 3) {
    featuredSlots.push({ productId: '', isActive: false });
  }
  const featuredProductIds = featuredSlots
    .filter((slot) => slot.isActive && slot.productId)
    .map((slot) => slot.productId)
    .slice(0, 3);
  const rotatingProductIds = Array.isArray(row.rotatingProductIds)
    ? Array.from(
        new Set(
          row.rotatingProductIds
            .map((entry) => String(entry || '').trim())
            .filter(Boolean)
            .slice(0, 24)
        )
      )
    : fallback.rotatingProductIds;
  const parsed = categoryPageSettingsSchema.safeParse({
    bannerTitle: String(row.bannerTitle ?? fallback.bannerTitle).trim().slice(0, 120),
    bannerSubtitle: String(row.bannerSubtitle ?? fallback.bannerSubtitle).trim().slice(0, 320),
    bannerImage: String(row.bannerImage ?? fallback.bannerImage).trim().slice(0, 2048),
    bannerHeight: Number.isFinite(Number(row.bannerHeight))
      ? Math.max(220, Math.min(560, Math.round(Number(row.bannerHeight))))
      : fallback.bannerHeight,
    pageSize: Number.isFinite(Number(row.pageSize))
      ? Math.max(8, Math.min(120, Math.round(Number(row.pageSize))))
      : fallback.pageSize,
    columns: Number.isFinite(Number(row.columns))
      ? Math.max(2, Math.min(6, Math.round(Number(row.columns))))
      : fallback.columns,
    showPagination: typeof row.showPagination === 'boolean' ? row.showPagination : fallback.showPagination,
    featuredProductIds,
    featuredSlots,
    rotatingProductIds,
    rotatingColumns: Number.isFinite(Number(row.rotatingColumns))
      ? Math.max(1, Math.min(6, Math.round(Number(row.rotatingColumns))))
      : fallback.rotatingColumns,
    rotatingRows: Number.isFinite(Number(row.rotatingRows))
      ? Math.max(1, Math.min(6, Math.round(Number(row.rotatingRows))))
      : fallback.rotatingRows,
    rotatingTitleSize: Number.isFinite(Number(row.rotatingTitleSize))
      ? Math.max(16, Math.min(64, Math.round(Number(row.rotatingTitleSize))))
      : fallback.rotatingTitleSize,
  });
  return parsed.success ? parsed.data : { ...fallback };
};

const ensureHomepageSectionSettingTable = async () => {
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

export async function readCategoryPageSettings(pageType: CategoryPageType) {
  await ensureHomepageSectionSettingTable();
  const key = settingsKeyForPage(pageType);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date }>>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    key
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...DEFAULT_SETTINGS_BY_PAGE[pageType] },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeCategoryPageSettings(pageType, JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { ...DEFAULT_SETTINGS_BY_PAGE[pageType] },
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
}

export async function writeCategoryPageSettings(
  pageType: CategoryPageType,
  patch: unknown,
  merge = true
): Promise<CategoryPageSettings> {
  const parsedPatch = categoryPageSettingsPatchSchema.parse(patch || {});
  const existing = await readCategoryPageSettings(pageType);
  const nextPayload = merge ? { ...existing.settings, ...parsedPatch } : { ...DEFAULT_SETTINGS_BY_PAGE[pageType], ...parsedPatch };
  if (Array.isArray((parsedPatch as any).featuredProductIds) && !Array.isArray((parsedPatch as any).featuredSlots)) {
    (nextPayload as any).featuredSlots = (parsedPatch as any).featuredProductIds
      .map((entry: unknown) => String(entry || '').trim())
      .filter(Boolean)
      .slice(0, 3)
      .map((productId: string) => ({ productId, isActive: true }));
  }
  const normalized = normalizeCategoryPageSettings(pageType, nextPayload);
  const payload = JSON.stringify(normalized);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return normalized;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    settingsKeyForPage(pageType),
    payload
  );
  return normalized;
}

const pickFirstImage = (images: Array<{ url: string }> | undefined | null) =>
  Array.isArray(images) && images.length > 0 ? String(images[0]?.url || '') : '';

export async function readCategoryFeaturedProducts(
  pageType: CategoryPageType,
  featuredProductIds: string[]
): Promise<CategoryPageProductPreview[]> {
  const ids = Array.from(new Set((featuredProductIds || []).map((entry) => String(entry || '').trim()).filter(Boolean))).slice(0, 24);
  if (ids.length === 0) return [];

  if (pageType === 'READY_TO_WEAR') {
    const rows = await prisma.readyToWear.findMany({
      where: { id: { in: ids }, status: ProductStatus.APPROVED, isAvailable: true },
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        designer: { select: { businessName: true, country: true } },
        sizeVariations: { where: { stock: { gt: 0 } }, select: { price: true } },
      },
    });
    const mapped = new Map(
      rows.map((row) => {
        const variationPrices = (row.sizeVariations || [])
          .map((entry) => Number(entry.price || 0))
          .filter((value) => Number.isFinite(value) && value > 0);
        const priceUsd = variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row.basePrice || 0);
        return [
          row.id,
          {
            id: row.id,
            name: row.name,
            description: String((row as any).description || '').trim() || undefined,
            image: pickFirstImage(row.images),
            priceUsd,
            country: String(row.designer?.country || ''),
            ownerName: String(row.designer?.businessName || 'Designer'),
            href: `/ready-to-wear/${row.id}`,
          } satisfies CategoryPageProductPreview,
        ];
      })
    );
    return ids.map((id) => mapped.get(id)).filter((entry): entry is CategoryPageProductPreview => Boolean(entry));
  }

  if (pageType === 'FABRIC_TO_BUY') {
    const rows = await prisma.fabric.findMany({
      where: { id: { in: ids }, status: ProductStatus.APPROVED, isAvailable: true },
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        seller: { select: { businessName: true, country: true } },
      },
    });
    const mapped = new Map(
      rows.map((row) => [
        row.id,
        {
          id: row.id,
          name: row.name,
          description: String((row as any).description || '').trim() || undefined,
          image: pickFirstImage(row.images),
          priceUsd: Number((row as any).finalPrice || (row as any).sellerPrice || 0),
          country: String(row.seller?.country || ''),
          ownerName: String(row.seller?.businessName || 'Seller'),
          href: `/fabrics/${row.id}`,
        } satisfies CategoryPageProductPreview,
      ])
    );
    return ids.map((id) => mapped.get(id)).filter((entry): entry is CategoryPageProductPreview => Boolean(entry));
  }

  const rows = await prisma.design.findMany({
    where: { id: { in: ids }, status: ProductStatus.APPROVED, isAvailable: true },
    include: {
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
      designer: { select: { businessName: true, country: true } },
    },
  });
  const mapped = new Map(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        description: String((row as any).description || '').trim() || undefined,
        image: pickFirstImage(row.images),
        priceUsd: Number((row as any).finalPrice || row.basePrice || 0),
        country: String(row.designer?.country || ''),
        ownerName: String(row.designer?.businessName || 'Designer'),
        href: `/designs/${row.id}`,
      } satisfies CategoryPageProductPreview,
    ])
  );
  return ids.map((id) => mapped.get(id)).filter((entry): entry is CategoryPageProductPreview => Boolean(entry));
}

export async function listCategoryPageProductOptions(
  pageType: CategoryPageType,
  input?: { search?: string; limit?: number }
): Promise<CategoryPageProductOption[]> {
  const search = String(input?.search || '').trim();
  const limit = Math.max(10, Math.min(200, Math.round(Number(input?.limit || 80))));

  if (pageType === 'READY_TO_WEAR') {
    const rows = await prisma.readyToWear.findMany({
      where: {
        status: ProductStatus.APPROVED,
        isAvailable: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { designer: { businessName: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        designer: { select: { businessName: true, country: true } },
        sizeVariations: { where: { stock: { gt: 0 } }, select: { price: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => {
      const variationPrices = (row.sizeVariations || [])
        .map((entry) => Number(entry.price || 0))
        .filter((value) => Number.isFinite(value) && value > 0);
      return {
        id: row.id,
        name: row.name,
        description: String((row as any).description || '').trim() || undefined,
        ownerName: String(row.designer?.businessName || 'Designer'),
        country: String(row.designer?.country || ''),
        priceUsd: variationPrices.length > 0 ? Math.min(...variationPrices) : Number(row.basePrice || 0),
        image: pickFirstImage(row.images),
      };
    });
  }

  if (pageType === 'FABRIC_TO_BUY') {
    const rows = await prisma.fabric.findMany({
      where: {
        status: ProductStatus.APPROVED,
        isAvailable: true,
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' } },
                { seller: { businessName: { contains: search, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: {
        images: { take: 1, orderBy: { sortOrder: 'asc' } },
        seller: { select: { businessName: true, country: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: String((row as any).description || '').trim() || undefined,
      ownerName: String(row.seller?.businessName || 'Seller'),
      country: String(row.seller?.country || ''),
      priceUsd: Number((row as any).finalPrice || (row as any).sellerPrice || 0),
      image: pickFirstImage(row.images),
    }));
  }

  const rows = await prisma.design.findMany({
    where: {
      status: ProductStatus.APPROVED,
      isAvailable: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { designer: { businessName: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    },
    include: {
      images: { take: 1, orderBy: { sortOrder: 'asc' } },
      designer: { select: { businessName: true, country: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: String((row as any).description || '').trim() || undefined,
    ownerName: String(row.designer?.businessName || 'Designer'),
    country: String(row.designer?.country || ''),
    priceUsd: Number((row as any).finalPrice || row.basePrice || 0),
    image: pickFirstImage(row.images),
  }));
}

export function resolveCategoryPageType(value: string): CategoryPageType | null {
  return normalizePageTypeToken(value);
}
