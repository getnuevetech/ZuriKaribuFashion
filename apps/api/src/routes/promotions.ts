import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

// Compatibility aliases for legacy preview route variants.
router.use((req, _res, next) => {
  if (req.path === '/check') {
    req.url = req.url.replace('/check', '/preview');
  } else if (req.path === '/validate') {
    req.url = req.url.replace('/validate', '/preview');
  } else if (req.path === '/preview-checkout') {
    req.url = req.url.replace('/preview-checkout', '/preview');
  }
  next();
});

const promoCriteriaSchema = z.object({
  productTypes: z.array(z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR'])).optional(),
  productIds: z.array(z.string().trim().min(1)).optional(),
  countries: z.array(z.string().trim().min(1)).optional(),
  cities: z.array(z.string().trim().min(1)).optional(),
  materialTypeIds: z.array(z.string().trim().min(1)).optional(),
  designerIds: z.array(z.string().trim().min(1)).optional(),
  sellerIds: z.array(z.string().trim().min(1)).optional(),
  paymentProviders: z.array(z.string().trim().min(1)).optional(),
  shippingProviders: z.array(z.string().trim().min(1)).optional(),
  cardPatterns: z.array(z.string().trim().min(1).max(12)).optional(),
  shippingQuoteIds: z.array(z.string().trim().min(1)).optional(),
});

const promoCreateSchema = z.object({
  code: z.string().trim().min(3).max(30),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(['PERCENTAGE', 'FIXED']),
  discountValue: z.coerce.number().positive(),
  maxDiscountUsd: z.coerce.number().positive().optional(),
  minOrderUsd: z.coerce.number().min(0).optional(),
  criteria: promoCriteriaSchema.optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

const promoPreviewSchema = z.object({
  code: z.string().trim().min(3).max(30),
  items: z
    .array(
      z.object({
        productType: z.enum(['FABRIC', 'DESIGN', 'READY_TO_WEAR']),
        productId: z.string().trim().min(1),
        unitPrice: z.coerce.number().min(0),
        quantity: z.coerce.number().int().min(1),
      })
    )
    .min(1),
  paymentProvider: z.string().trim().optional(),
  shippingProvider: z.string().trim().optional(),
  shippingQuoteId: z.string().trim().optional(),
  cardFingerprint: z.string().trim().optional(),
  country: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

async function ensurePromotionCodeTable() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PromotionCode" (
      "id" TEXT NOT NULL,
      "code" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "discountType" TEXT NOT NULL,
      "discountValue" DOUBLE PRECISION NOT NULL,
      "maxDiscountUsd" DOUBLE PRECISION,
      "minOrderUsd" DOUBLE PRECISION,
      "criteria" JSONB,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "startsAt" TIMESTAMP(3),
      "endsAt" TIMESTAMP(3),
      "usageCount" INTEGER NOT NULL DEFAULT 0,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PromotionCode_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PromotionCode_code_key" ON "PromotionCode"("code")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PromotionCode_isActive_idx" ON "PromotionCode"("isActive")`);
}

const normalizeCriteria = (input: unknown) => {
  const parsed = promoCriteriaSchema.safeParse(input);
  if (!parsed.success) return {};
  const data = parsed.data;
  const dedupe = (list: unknown[] | undefined, upperCase = false) =>
    Array.from(
      new Set(
        (list || [])
          .map((entry) => (upperCase ? String(entry || '').trim().toUpperCase() : String(entry || '').trim()))
          .filter(Boolean)
      )
    );
  return {
    productTypes: dedupe(data.productTypes as any, true),
    productIds: dedupe(data.productIds as any, false),
    countries: dedupe(data.countries as any, false),
    cities: dedupe(data.cities as any, false),
    materialTypeIds: dedupe(data.materialTypeIds as any, false),
    designerIds: dedupe(data.designerIds as any, false),
    sellerIds: dedupe(data.sellerIds as any, false),
    paymentProviders: dedupe(data.paymentProviders as any, true),
    shippingProviders: dedupe(data.shippingProviders as any, true),
    cardPatterns: dedupe(data.cardPatterns as any, false),
    shippingQuoteIds: dedupe(data.shippingQuoteIds as any, false),
  };
};

type PromoItemMeta = {
  productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  productId: string;
  unitPrice: number;
  quantity: number;
  country?: string;
  city?: string;
  materialTypeId?: string;
  designerId?: string;
  sellerId?: string;
};

async function loadPromoProductMeta(
  items: Array<{ productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productId: string; unitPrice: number; quantity: number }>
) {
  const fabricIds = items.filter((entry) => entry.productType === 'FABRIC').map((entry) => entry.productId);
  const designIds = items.filter((entry) => entry.productType === 'DESIGN').map((entry) => entry.productId);
  const readyIds = items.filter((entry) => entry.productType === 'READY_TO_WEAR').map((entry) => entry.productId);

  const [fabrics, designs, ready] = await Promise.all([
    fabricIds.length
      ? prisma.fabric.findMany({
          where: { id: { in: fabricIds } },
          select: {
            id: true,
            materialTypeId: true,
            sellerId: true,
            seller: { select: { country: true, city: true } },
          },
        })
      : Promise.resolve([]),
    designIds.length
      ? prisma.design.findMany({
          where: { id: { in: designIds } },
          select: {
            id: true,
            categoryId: true,
            designerId: true,
            designer: { select: { country: true, city: true } },
          },
        })
      : Promise.resolve([]),
    readyIds.length
      ? prisma.readyToWear.findMany({
          where: { id: { in: readyIds } },
          select: {
            id: true,
            categoryId: true,
            designerId: true,
            designer: { select: { country: true, city: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const fabricMap = new Map(fabrics.map((entry) => [entry.id, entry]));
  const designMap = new Map(designs.map((entry) => [entry.id, entry]));
  const readyMap = new Map(ready.map((entry) => [entry.id, entry]));

  return items.map((entry) => {
    if (entry.productType === 'FABRIC') {
      const meta = fabricMap.get(entry.productId);
      return {
        ...entry,
        country: meta?.seller?.country || '',
        city: meta?.seller?.city || '',
        materialTypeId: meta?.materialTypeId || '',
        sellerId: meta?.sellerId || '',
      } as PromoItemMeta;
    }
    if (entry.productType === 'DESIGN') {
      const meta = designMap.get(entry.productId);
      return {
        ...entry,
        country: meta?.designer?.country || '',
        city: meta?.designer?.city || '',
        designerId: meta?.designerId || '',
      } as PromoItemMeta;
    }
    const meta = readyMap.get(entry.productId);
    return {
      ...entry,
      country: meta?.designer?.country || '',
      city: meta?.designer?.city || '',
      designerId: meta?.designerId || '',
    } as PromoItemMeta;
  });
}

function matchesPromotionCriteria(
  item: PromoItemMeta,
  criteria: Record<string, any>,
  context: {
    paymentProvider?: string;
    shippingProvider?: string;
    shippingQuoteId?: string;
    cardFingerprint?: string;
    country?: string;
    city?: string;
  }
) {
  const inList = (list: string[] | undefined, value: string, normalizeUpper = false) => {
    if (!Array.isArray(list) || list.length === 0) return true;
    const normalizedValue = normalizeUpper ? String(value || '').toUpperCase() : String(value || '');
    const normalizedList = normalizeUpper ? list.map((entry) => String(entry || '').toUpperCase()) : list;
    return normalizedList.includes(normalizedValue);
  };

  if (!inList(criteria.productTypes, item.productType, true)) return false;
  if (!inList(criteria.productIds, item.productId)) return false;
  if (!inList(criteria.countries, item.country || '')) return false;
  if (!inList(criteria.cities, item.city || '')) return false;
  if (!inList(criteria.materialTypeIds, item.materialTypeId || '')) return false;
  if (!inList(criteria.designerIds, item.designerId || '')) return false;
  if (!inList(criteria.sellerIds, item.sellerId || '')) return false;
  if (!inList(criteria.paymentProviders, context.paymentProvider || '', true)) return false;
  if (!inList(criteria.shippingProviders, context.shippingProvider || '', true)) return false;
  if (!inList(criteria.shippingQuoteIds, context.shippingQuoteId || '')) return false;
  if (Array.isArray(criteria.cardPatterns) && criteria.cardPatterns.length > 0) {
    const card = String(context.cardFingerprint || '');
    if (!criteria.cardPatterns.some((pattern: string) => card.startsWith(String(pattern || '')))) {
      return false;
    }
  }
  if (Array.isArray(criteria.countries) && criteria.countries.length > 0 && context.country) {
    if (!criteria.countries.includes(String(context.country))) return false;
  }
  if (Array.isArray(criteria.cities) && criteria.cities.length > 0 && context.city) {
    if (!criteria.cities.includes(String(context.city))) return false;
  }
  return true;
}

router.use(authenticate);

router.get('/admin', authorizePermissions(Permissions.PRICING_MANAGE), async (_req, res, next) => {
  try {
    await ensurePromotionCodeTable();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "PromotionCode" ORDER BY "updatedAt" DESC, "createdAt" DESC LIMIT 500`
    );
    res.json({
      success: true,
      data: rows.map((entry) => ({
        ...entry,
        criteria: normalizeCriteria(entry.criteria),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/admin', authorizePermissions(Permissions.PRICING_MANAGE), async (req, res, next) => {
  try {
    await ensurePromotionCodeTable();
    const payload = promoCreateSchema.parse(req.body);
    const code = String(payload.code || '').trim().toUpperCase();
    const criteria = normalizeCriteria(payload.criteria);
    const record = await prisma.$queryRawUnsafe<any[]>(
      `INSERT INTO "PromotionCode" (
        "id","code","name","description","discountType","discountValue","maxDiscountUsd","minOrderUsd","criteria",
        "isActive","startsAt","endsAt","createdById","updatedById","createdAt","updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$13,NOW(),NOW()
      )
      RETURNING *`,
      randomUUID(),
      code,
      payload.name,
      payload.description || null,
      payload.discountType,
      Number(payload.discountValue),
      payload.maxDiscountUsd ?? null,
      payload.minOrderUsd ?? null,
      JSON.stringify(criteria),
      payload.isActive !== false,
      payload.startsAt ? new Date(payload.startsAt) : null,
      payload.endsAt ? new Date(payload.endsAt) : null,
      req.user!.id
    );
    res.status(201).json({ success: true, data: record[0] || null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    next(error);
  }
});

router.patch('/admin/:id', authorizePermissions(Permissions.PRICING_MANAGE), async (req, res, next) => {
  try {
    await ensurePromotionCodeTable();
    const payload = promoCreateSchema.partial().parse(req.body || {});
    const id = String(req.params.id || '').trim();
    const existingRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "PromotionCode" WHERE "id" = $1 LIMIT 1`, id);
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ success: false, message: 'Promo code not found.' });
    const nextCode = payload.code ? String(payload.code).trim().toUpperCase() : String(existing.code || '').toUpperCase();
    const nextCriteria = payload.criteria ? normalizeCriteria(payload.criteria) : normalizeCriteria(existing.criteria);
    const updatedRows = await prisma.$queryRawUnsafe<any[]>(
      `UPDATE "PromotionCode"
       SET "code" = $1,
           "name" = $2,
           "description" = $3,
           "discountType" = $4,
           "discountValue" = $5,
           "maxDiscountUsd" = $6,
           "minOrderUsd" = $7,
           "criteria" = $8::jsonb,
           "isActive" = $9,
           "startsAt" = $10,
           "endsAt" = $11,
           "updatedById" = $12,
           "updatedAt" = NOW()
       WHERE "id" = $13
       RETURNING *`,
      nextCode,
      payload.name ?? existing.name,
      payload.description ?? existing.description,
      payload.discountType ?? existing.discountType,
      payload.discountValue !== undefined ? Number(payload.discountValue) : Number(existing.discountValue || 0),
      payload.maxDiscountUsd !== undefined ? payload.maxDiscountUsd : existing.maxDiscountUsd,
      payload.minOrderUsd !== undefined ? payload.minOrderUsd : existing.minOrderUsd,
      JSON.stringify(nextCriteria),
      payload.isActive !== undefined ? payload.isActive : Boolean(existing.isActive),
      payload.startsAt ? new Date(payload.startsAt) : existing.startsAt ? new Date(existing.startsAt) : null,
      payload.endsAt ? new Date(payload.endsAt) : existing.endsAt ? new Date(existing.endsAt) : null,
      req.user!.id,
      id
    );
    res.json({ success: true, data: updatedRows[0] || null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    next(error);
  }
});

router.delete('/admin/:id', authorizePermissions(Permissions.PRICING_MANAGE), async (req, res, next) => {
  try {
    await ensurePromotionCodeTable();
    await prisma.$executeRawUnsafe(`DELETE FROM "PromotionCode" WHERE "id" = $1`, String(req.params.id || ''));
    res.json({ success: true, message: 'Promo code deleted.' });
  } catch (error) {
    next(error);
  }
});

router.post('/preview', authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    await ensurePromotionCodeTable();
    const payload = promoPreviewSchema.parse(req.body);
    const code = String(payload.code || '').trim().toUpperCase();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM "PromotionCode" WHERE "code" = $1 AND "isActive" = true LIMIT 1`,
      code
    );
    const promo = rows[0];
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo code not found or inactive.' });
    }
    const now = Date.now();
    if (promo.startsAt && now < new Date(promo.startsAt).getTime()) {
      return res.status(400).json({ success: false, message: 'Promo code is not active yet.' });
    }
    if (promo.endsAt && now > new Date(promo.endsAt).getTime()) {
      return res.status(400).json({ success: false, message: 'Promo code has expired.' });
    }

    const itemMeta = await loadPromoProductMeta(payload.items);
    const criteria = normalizeCriteria(promo.criteria);
    const eligibleItems = itemMeta.filter((entry) =>
      matchesPromotionCriteria(entry, criteria, {
        paymentProvider: payload.paymentProvider,
        shippingProvider: payload.shippingProvider,
        shippingQuoteId: payload.shippingQuoteId,
        cardFingerprint: payload.cardFingerprint,
        country: payload.country,
        city: payload.city,
      })
    );
    const subtotal = itemMeta.reduce((sum, entry) => sum + Number(entry.unitPrice || 0) * Number(entry.quantity || 0), 0);
    const eligibleSubtotal = eligibleItems.reduce(
      (sum, entry) => sum + Number(entry.unitPrice || 0) * Number(entry.quantity || 0),
      0
    );
    if (Number(promo.minOrderUsd || 0) > subtotal) {
      return res.status(400).json({
        success: false,
        message: `Promo requires minimum order value of $${Number(promo.minOrderUsd).toFixed(2)}.`,
      });
    }
    if (eligibleSubtotal <= 0) {
      return res.status(400).json({ success: false, message: 'Promo code does not match selected products/criteria.' });
    }
    const rawDiscount =
      String(promo.discountType || '').toUpperCase() === 'PERCENTAGE'
        ? (eligibleSubtotal * Number(promo.discountValue || 0)) / 100
        : Number(promo.discountValue || 0);
    const cappedDiscount = Number.isFinite(Number(promo.maxDiscountUsd))
      ? Math.min(rawDiscount, Number(promo.maxDiscountUsd || 0))
      : rawDiscount;
    const discountUsd = Math.max(0, Math.min(eligibleSubtotal, Number(cappedDiscount || 0)));
    res.json({
      success: true,
      data: {
        code,
        name: promo.name,
        discountType: promo.discountType,
        discountValue: Number(promo.discountValue || 0),
        discountUsd: Number(discountUsd.toFixed(2)),
        subtotalUsd: Number(subtotal.toFixed(2)),
        eligibleSubtotalUsd: Number(eligibleSubtotal.toFixed(2)),
        matchedItems: eligibleItems.map((entry) => ({
          productType: entry.productType,
          productId: entry.productId,
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    next(error);
  }
});

export default router;
