import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, ProductType, ProductStatus, UserRole } from '../db';
import { authenticate } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const FEATURED_REQUEST_SETTINGS_KEY = 'featured_product_request_settings_v1';
const FEATURED_REQUEST_STATUSES = [
  'PENDING',
  'APPROVED_AWAITING_PAYMENT',
  'REJECTED',
  'ACTIVE',
  'EXPIRED',
  'CANCELLED',
] as const;
const DURATION_UNITS = ['DAYS', 'WEEKS', 'MONTHS'] as const;
const ALLOWED_FEATURED_SECTIONS = new Set([
  'FEATURED_DESIGNS',
  'FEATURED_FABRICS',
  'FEATURED_READY_TO_WEAR',
  'TRENDING_NOW',
  'NEW_ARRIVALS',
]);

type FeaturedRequestStatus = (typeof FEATURED_REQUEST_STATUSES)[number];
type DurationUnit = (typeof DURATION_UNITS)[number];

type FeaturedRequestSettings = {
  enabled: boolean;
  defaultDurationValue: number;
  defaultDurationUnit: DurationUnit;
  basePriceUsdByType: Record<ProductType, number>;
  allowVendorRequestedDuration: boolean;
  maxDurationValue: number;
};

type RequestedProductEntry = {
  productId: string;
  productType: ProductType;
  section: string | null;
};

const DEFAULT_FEATURED_REQUEST_SETTINGS: FeaturedRequestSettings = {
  enabled: true,
  defaultDurationValue: 2,
  defaultDurationUnit: 'WEEKS',
  basePriceUsdByType: {
    [ProductType.FABRIC]: 15,
    [ProductType.DESIGN]: 25,
    [ProductType.READY_TO_WEAR]: 20,
  },
  allowVendorRequestedDuration: true,
  maxDurationValue: 12,
};

const normalizeDurationUnit = (value: unknown): DurationUnit => {
  const token = String(value || '').trim().toUpperCase();
  return DURATION_UNITS.includes(token as DurationUnit) ? (token as DurationUnit) : 'WEEKS';
};

const normalizeSectionForType = (type: ProductType, section?: unknown) => {
  const requested = String(section || '').trim().toUpperCase();
  if (requested && ALLOWED_FEATURED_SECTIONS.has(requested)) return requested;
  if (type === ProductType.FABRIC) return 'FEATURED_FABRICS';
  if (type === ProductType.DESIGN) return 'FEATURED_DESIGNS';
  return 'FEATURED_READY_TO_WEAR';
};

const addDuration = (startDate: Date, value: number, unit: DurationUnit) => {
  const next = new Date(startDate.getTime());
  if (unit === 'DAYS') next.setDate(next.getDate() + value);
  if (unit === 'WEEKS') next.setDate(next.getDate() + value * 7);
  if (unit === 'MONTHS') next.setMonth(next.getMonth() + value);
  return next;
};

const parseJsonObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

const parseProductEntries = (value: unknown): RequestedProductEntry[] => {
  const rows = Array.isArray(value) ? value : [];
  const normalized: RequestedProductEntry[] = [];
  for (const entry of rows as any[]) {
      const productId = String(entry?.productId || '').trim();
      const productType = String(entry?.productType || '').trim().toUpperCase() as ProductType;
      if (!productId) continue;
      if (!Object.values(ProductType).includes(productType)) continue;
      const section = String(entry?.section || '').trim().toUpperCase() || null;
      normalized.push({ productId, productType, section });
  }
  return normalized;
};

const normalizeSettings = (value: unknown): FeaturedRequestSettings => {
  const source = parseJsonObject(value);
  const baseSource = parseJsonObject(source.basePriceUsdByType);
  return {
    enabled: source.enabled !== false,
    defaultDurationValue: Math.max(1, Math.min(24, Number(source.defaultDurationValue || 2))),
    defaultDurationUnit: normalizeDurationUnit(source.defaultDurationUnit),
    basePriceUsdByType: {
      [ProductType.FABRIC]: Math.max(0, Number(baseSource[ProductType.FABRIC] ?? 15)),
      [ProductType.DESIGN]: Math.max(0, Number(baseSource[ProductType.DESIGN] ?? 25)),
      [ProductType.READY_TO_WEAR]: Math.max(0, Number(baseSource[ProductType.READY_TO_WEAR] ?? 20)),
    },
    allowVendorRequestedDuration: source.allowVendorRequestedDuration !== false,
    maxDurationValue: Math.max(1, Math.min(36, Number(source.maxDurationValue || 12))),
  };
};

async function ensureFeaturedRequestSchema() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "FeaturedProductRequest" (
      "id" TEXT NOT NULL,
      "requesterUserId" TEXT NOT NULL,
      "requesterRole" TEXT NOT NULL,
      "requestStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "productEntries" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "requestedDurationValue" INT,
      "requestedDurationUnit" TEXT,
      "requestNotes" TEXT,
      "reviewNotes" TEXT,
      "approvedDurationValue" INT,
      "approvedDurationUnit" TEXT,
      "approvedPriceUsd" DECIMAL(10,2),
      "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
      "paymentProviderKey" TEXT,
      "paymentReference" TEXT,
      "approvedByUserId" TEXT,
      "approvedAt" TIMESTAMP(3),
      "paidAt" TIMESTAMP(3),
      "activationStartedAt" TIMESTAMP(3),
      "activationEndsAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "FeaturedProductRequest_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FeaturedProductRequest_requester_idx" ON "FeaturedProductRequest"("requesterUserId","createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "FeaturedProductRequest_status_idx" ON "FeaturedProductRequest"("requestStatus","paymentStatus","updatedAt")`
  );
}

async function readFeaturedRequestSettings(): Promise<FeaturedRequestSettings> {
  await ensureFeaturedRequestSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    FEATURED_REQUEST_SETTINGS_KEY
  );
  return rows[0] ? normalizeSettings(rows[0].value) : DEFAULT_FEATURED_REQUEST_SETTINGS;
}

async function writeFeaturedRequestSettings(payload: Partial<FeaturedRequestSettings>) {
  await ensureFeaturedRequestSchema();
  const current = await readFeaturedRequestSettings();
  const next = normalizeSettings({ ...current, ...(payload || {}) });
  const existing = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    FEATURED_REQUEST_SETTINGS_KEY
  );
  if (existing[0]?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting" SET "value" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      JSON.stringify(next),
      String(existing[0].id)
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id","key","value","createdAt","updatedAt")
       VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
      randomUUID(),
      FEATURED_REQUEST_SETTINGS_KEY,
      JSON.stringify(next)
    );
  }
  return next;
}

const formatRequestRow = (row: any) => ({
  id: String(row.id),
  requesterUserId: String(row.requesterUserId),
  requesterRole: String(row.requesterRole || '').toUpperCase(),
  requestStatus: String(row.requestStatus || 'PENDING').toUpperCase() as FeaturedRequestStatus,
  paymentStatus: String(row.paymentStatus || 'UNPAID').toUpperCase(),
  productEntries: parseProductEntries(row.productEntries),
  requestedDurationValue: row.requestedDurationValue !== null ? Number(row.requestedDurationValue) : null,
  requestedDurationUnit: row.requestedDurationUnit ? normalizeDurationUnit(row.requestedDurationUnit) : null,
  requestNotes: row.requestNotes ? String(row.requestNotes) : null,
  reviewNotes: row.reviewNotes ? String(row.reviewNotes) : null,
  approvedDurationValue: row.approvedDurationValue !== null ? Number(row.approvedDurationValue) : null,
  approvedDurationUnit: row.approvedDurationUnit ? normalizeDurationUnit(row.approvedDurationUnit) : null,
  approvedPriceUsd: row.approvedPriceUsd !== null ? Number(row.approvedPriceUsd) : null,
  paymentProviderKey: row.paymentProviderKey ? String(row.paymentProviderKey) : null,
  paymentReference: row.paymentReference ? String(row.paymentReference) : null,
  approvedByUserId: row.approvedByUserId ? String(row.approvedByUserId) : null,
  approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
  paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
  activationStartedAt: row.activationStartedAt ? new Date(row.activationStartedAt).toISOString() : null,
  activationEndsAt: row.activationEndsAt ? new Date(row.activationEndsAt).toISOString() : null,
  createdAt: new Date(row.createdAt || Date.now()).toISOString(),
  updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
});

const requireAdmin = (role: UserRole) => {
  if (role !== UserRole.ADMINISTRATOR) {
    throw Object.assign(new Error('Only admin can perform this action.'), { status: 403 });
  }
};

const requireVendor = (role: UserRole) => {
  if (role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER) {
    throw Object.assign(new Error('Only Seller or Designer can perform this action.'), { status: 403 });
  }
};

async function assertVendorOwnsProducts(userId: string, role: UserRole, entries: RequestedProductEntry[]) {
  if (entries.length === 0) {
    throw Object.assign(new Error('Select at least one product for feature request.'), { status: 400 });
  }
  if (role === UserRole.FABRIC_SELLER) {
    if (entries.some((entry) => entry.productType !== ProductType.FABRIC)) {
      throw Object.assign(new Error('Seller can only request FABRIC products.'), { status: 400 });
    }
    const profile = await prisma.fabricSellerProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!profile?.id) {
      throw Object.assign(new Error('Seller profile not found.'), { status: 404 });
    }
    const ids = Array.from(new Set(entries.map((entry) => entry.productId)));
    const count = await prisma.fabric.count({
      where: {
        id: { in: ids },
        sellerId: String(profile.id),
        status: ProductStatus.APPROVED,
      },
    });
    if (count !== ids.length) {
      throw Object.assign(new Error('One or more selected fabrics are invalid or not owned by seller.'), { status: 400 });
    }
    return;
  }
  if (role === UserRole.FASHION_DESIGNER) {
    const profile = await prisma.designerProfile.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!profile?.id) {
      throw Object.assign(new Error('Designer profile not found.'), { status: 404 });
    }
    const designIds = Array.from(
      new Set(entries.filter((entry) => entry.productType === ProductType.DESIGN).map((entry) => entry.productId))
    );
    const readyIds = entries
      .filter((entry) => entry.productType === ProductType.READY_TO_WEAR)
      .map((entry) => entry.productId);
    const uniqueReadyIds = Array.from(new Set(readyIds));
    if (entries.some((entry) => entry.productType === ProductType.FABRIC)) {
      throw Object.assign(new Error('Designer can only request DESIGN or READY_TO_WEAR products.'), { status: 400 });
    }
    if (designIds.length > 0) {
      const designCount = await prisma.design.count({
        where: { id: { in: designIds }, designerId: String(profile.id), status: ProductStatus.APPROVED },
      });
      if (designCount !== designIds.length) {
        throw Object.assign(new Error('One or more design products are invalid or not owned by designer.'), { status: 400 });
      }
    }
    if (readyIds.length > 0) {
      const readyCount = await prisma.readyToWear.count({
        where: { id: { in: uniqueReadyIds }, designerId: String(profile.id), status: ProductStatus.APPROVED },
      });
      if (readyCount !== uniqueReadyIds.length) {
        throw Object.assign(new Error('One or more ready-to-wear products are invalid or not owned by designer.'), { status: 400 });
      }
    }
  }
}

async function upsertFeaturedProducts(entries: RequestedProductEntry[]) {
  for (const entry of entries) {
    const section = normalizeSectionForType(entry.productType, entry.section);
    const existing = await prisma.featuredProduct.findFirst({
      where: {
        productId: entry.productId,
        productType: entry.productType,
        section: section as any,
      },
      select: { id: true },
    });
    if (existing?.id) {
      await prisma.featuredProduct
        .update({
          where: { id: existing.id },
          data: { isActive: true },
        })
        .catch(() => undefined);
    } else {
      await prisma.featuredProduct
        .create({
          data: {
            productId: entry.productId,
            productType: entry.productType,
            section: section as any,
            isActive: true,
            displayOrder: 0,
          },
        })
        .catch(() => undefined);
    }
  }
}

async function deactivateFeaturedProducts(entries: RequestedProductEntry[]) {
  await Promise.all(
    entries.map((entry) =>
      prisma.featuredProduct
        .updateMany({
          where: {
            productId: entry.productId,
            productType: entry.productType,
            section: normalizeSectionForType(entry.productType, entry.section) as any,
          },
          data: { isActive: false },
        })
        .catch(() => undefined)
    )
  );
}

async function expireOverdueRequests() {
  await ensureFeaturedRequestSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; productEntries: unknown }>>(
    `SELECT "id","productEntries"
     FROM "FeaturedProductRequest"
     WHERE "requestStatus" = 'ACTIVE'
       AND "activationEndsAt" IS NOT NULL
       AND "activationEndsAt" < NOW()`
  );
  for (const row of rows) {
    const entries = parseProductEntries(row.productEntries);
    await deactivateFeaturedProducts(entries);
    await prisma.$executeRawUnsafe(
      `UPDATE "FeaturedProductRequest"
       SET "requestStatus" = 'EXPIRED', "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(row.id)
    );
  }
}

const createRequestSchema = z
  .object({
    products: z
      .array(
        z.object({
          productId: z.string().uuid(),
          productType: z.nativeEnum(ProductType),
          section: z.string().trim().max(64).optional(),
        })
      )
      .min(1)
      .max(24),
    requestedDurationValue: z.number().int().min(1).max(36).optional(),
    requestedDurationUnit: z.enum(DURATION_UNITS).optional(),
    requestNotes: z.string().trim().max(500).optional(),
  })
  .strict();

router.get('/settings', async (_req, res, next) => {
  try {
    const settings = await readFeaturedRequestSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', async (req, res, next) => {
  try {
    requireAdmin(req.user!.role);
    const payload = z
      .object({
        enabled: z.boolean().optional(),
        defaultDurationValue: z.number().int().min(1).max(24).optional(),
        defaultDurationUnit: z.enum(DURATION_UNITS).optional(),
        basePriceUsdByType: z
          .object({
            FABRIC: z.number().min(0).optional(),
            DESIGN: z.number().min(0).optional(),
            READY_TO_WEAR: z.number().min(0).optional(),
          })
          .partial()
          .optional(),
        allowVendorRequestedDuration: z.boolean().optional(),
        maxDurationValue: z.number().int().min(1).max(36).optional(),
      })
      .strict()
      .parse(req.body || {});
    const settings = await writeFeaturedRequestSettings(payload as any);
    res.json({ success: true, data: settings, message: 'Featured request settings saved.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.post('/requests', async (req, res, next) => {
  try {
    const user = req.user!;
    requireVendor(user.role);
    const settings = await readFeaturedRequestSettings();
    if (!settings.enabled) {
      return res.status(403).json({ success: false, message: 'Featured requests are disabled by admin.' });
    }
    const payload = createRequestSchema.parse(req.body || {});
    const entries = payload.products.map((entry) => ({
      productId: String(entry.productId),
      productType: entry.productType,
      section: normalizeSectionForType(entry.productType, entry.section),
    }));
    await assertVendorOwnsProducts(user.id, user.role, entries);
    const requestedDurationValue = settings.allowVendorRequestedDuration
      ? Math.max(1, Math.min(settings.maxDurationValue, Number(payload.requestedDurationValue || settings.defaultDurationValue)))
      : settings.defaultDurationValue;
    const requestedDurationUnit = settings.allowVendorRequestedDuration
      ? normalizeDurationUnit(payload.requestedDurationUnit || settings.defaultDurationUnit)
      : settings.defaultDurationUnit;

    await ensureFeaturedRequestSchema();
    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "FeaturedProductRequest"
        ("id","requesterUserId","requesterRole","requestStatus","productEntries","requestedDurationValue","requestedDurationUnit","requestNotes","createdAt","updatedAt")
       VALUES ($1,$2,$3,'PENDING',$4::jsonb,$5,$6,$7,NOW(),NOW())`,
      id,
      String(user.id),
      String(user.role),
      JSON.stringify(entries),
      requestedDurationValue,
      requestedDurationUnit,
      payload.requestNotes ? String(payload.requestNotes).trim() : null
    );
    res.status(201).json({
      success: true,
      message: 'Featured request submitted. Admin will review and approve payment details.',
      data: {
        id,
        requestStatus: 'PENDING',
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.get('/requests/my', async (req, res, next) => {
  try {
    const user = req.user!;
    requireVendor(user.role);
    await expireOverdueRequests();
    await ensureFeaturedRequestSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "FeaturedProductRequest"
       WHERE "requesterUserId" = $1
       ORDER BY "createdAt" DESC`,
      String(user.id)
    );
    res.json({ success: true, data: rows.map((row) => formatRequestRow(row)) });
  } catch (error: any) {
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.get('/admin/requests', async (req, res, next) => {
  try {
    requireAdmin(req.user!.role);
    await expireOverdueRequests();
    await ensureFeaturedRequestSchema();
    const query = z
      .object({
        status: z.string().trim().max(40).optional(),
        paymentStatus: z.string().trim().max(40).optional(),
        search: z.string().trim().max(120).optional(),
        page: z.coerce.number().int().min(1).max(500).optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      })
      .parse(req.query || {});
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
    const offset = (page - 1) * limit;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (query.status) {
      values.push(String(query.status).toUpperCase());
      clauses.push(`UPPER("requestStatus") = $${values.length}`);
    }
    if (query.paymentStatus) {
      values.push(String(query.paymentStatus).toUpperCase());
      clauses.push(`UPPER("paymentStatus") = $${values.length}`);
    }
    if (query.search) {
      values.push(`%${String(query.search).toLowerCase()}%`);
      clauses.push(
        `(LOWER(COALESCE("requestNotes", '')) LIKE $${values.length}
          OR LOWER(COALESCE("reviewNotes", '')) LIKE $${values.length}
          OR LOWER(COALESCE("requesterRole", '')) LIKE $${values.length}
          OR LOWER(COALESCE("requesterUserId", '')) LIKE $${values.length})`
      );
    }
    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "FeaturedProductRequest"
       ${whereSql}
       ORDER BY "createdAt" DESC
       LIMIT ${limit} OFFSET ${offset}`,
      ...values
    );
    const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(1)::int AS "count"
       FROM "FeaturedProductRequest"
       ${whereSql}`,
      ...values
    );
    const requesterIds = Array.from(new Set(rows.map((row) => String(row.requesterUserId || '')).filter(Boolean)));
    const users = requesterIds.length
      ? await prisma.user.findMany({
          where: { id: { in: requesterIds } },
          select: { id: true, firstName: true, lastName: true, email: true },
        })
      : [];
    const userMap = new Map(
      users.map((row) => [
        String(row.id),
        {
          name: [String(row.firstName || '').trim(), String(row.lastName || '').trim()].filter(Boolean).join(' ').trim(),
          email: String(row.email || ''),
        },
      ])
    );
    const total = Number(countRows[0]?.count || 0);
    res.json({
      success: true,
      data: rows.map((row) => {
        const formatted = formatRequestRow(row);
        const requester = userMap.get(formatted.requesterUserId);
        return {
          ...formatted,
          requesterName: requester?.name || '',
          requesterEmail: requester?.email || '',
        };
      }),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.patch('/admin/requests/:id/review', async (req, res, next) => {
  try {
    requireAdmin(req.user!.role);
    const payload = z
      .object({
        decision: z.enum(['APPROVE', 'REJECT']),
        reviewNotes: z.string().trim().max(500).optional(),
        approvedDurationValue: z.number().int().min(1).max(36).optional(),
        approvedDurationUnit: z.enum(DURATION_UNITS).optional(),
        approvedPriceUsd: z.number().min(0).optional(),
      })
      .strict()
      .parse(req.body || {});
    await ensureFeaturedRequestSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "FeaturedProductRequest" WHERE "id" = $1 LIMIT 1`,
      String(req.params.id || '')
    );
    const current = rows[0];
    if (!current) return res.status(404).json({ success: false, message: 'Featured request not found.' });
    const currentStatus = String(current.requestStatus || 'PENDING').toUpperCase();
    if (currentStatus !== 'PENDING' && currentStatus !== 'APPROVED_AWAITING_PAYMENT') {
      return res.status(400).json({ success: false, message: `Request cannot be reviewed from status ${currentStatus}.` });
    }
    const settings = await readFeaturedRequestSettings();
    const entries = parseProductEntries(current.productEntries);
    const defaultPrice = entries.reduce((sum, entry) => sum + Number(settings.basePriceUsdByType[entry.productType] || 0), 0);
    const approvedDurationValue = Math.max(
      1,
      Math.min(settings.maxDurationValue, Number(payload.approvedDurationValue || current.approvedDurationValue || settings.defaultDurationValue))
    );
    const approvedDurationUnit = normalizeDurationUnit(
      payload.approvedDurationUnit || current.approvedDurationUnit || settings.defaultDurationUnit
    );
    const approvedPriceUsd = Math.max(0, Number(payload.approvedPriceUsd ?? current.approvedPriceUsd ?? defaultPrice));

    if (payload.decision === 'REJECT') {
      await prisma.$executeRawUnsafe(
        `UPDATE "FeaturedProductRequest"
         SET "requestStatus" = 'REJECTED',
             "reviewNotes" = $2,
             "approvedByUserId" = $3,
             "approvedAt" = NOW(),
             "updatedAt" = NOW()
         WHERE "id" = $1`,
        String(current.id),
        payload.reviewNotes ? String(payload.reviewNotes).trim() : null,
        String(req.user!.id)
      );
      return res.json({ success: true, message: 'Featured request rejected.' });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "FeaturedProductRequest"
       SET "requestStatus" = 'APPROVED_AWAITING_PAYMENT',
           "reviewNotes" = $2,
           "approvedDurationValue" = $3,
           "approvedDurationUnit" = $4,
           "approvedPriceUsd" = $5,
           "approvedByUserId" = $6,
           "approvedAt" = NOW(),
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(current.id),
      payload.reviewNotes ? String(payload.reviewNotes).trim() : null,
      approvedDurationValue,
      approvedDurationUnit,
      approvedPriceUsd,
      String(req.user!.id)
    );
    res.json({ success: true, message: 'Featured request approved. Waiting for vendor payment.' });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

router.post('/requests/:id/pay', async (req, res, next) => {
  try {
    const user = req.user!;
    requireVendor(user.role);
    const payload = z
      .object({
        providerKey: z.string().trim().min(2).max(32).optional(),
        paymentReference: z.string().trim().min(3).max(120),
      })
      .strict()
      .parse(req.body || {});
    await ensureFeaturedRequestSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT * FROM "FeaturedProductRequest" WHERE "id" = $1 LIMIT 1`,
      String(req.params.id || '')
    );
    const current = rows[0];
    if (!current) return res.status(404).json({ success: false, message: 'Featured request not found.' });
    if (String(current.requesterUserId) !== String(user.id)) {
      return res.status(403).json({ success: false, message: 'You can only pay your own featured request.' });
    }
    if (String(current.requestStatus || '').toUpperCase() !== 'APPROVED_AWAITING_PAYMENT') {
      return res.status(400).json({ success: false, message: 'Featured request is not awaiting payment.' });
    }
    const durationValue = Math.max(1, Number(current.approvedDurationValue || 1));
    const durationUnit = normalizeDurationUnit(current.approvedDurationUnit || 'WEEKS');
    const now = new Date();
    const endsAt = addDuration(now, durationValue, durationUnit);
    const entries = parseProductEntries(current.productEntries);
    await upsertFeaturedProducts(entries);
    await prisma.$executeRawUnsafe(
      `UPDATE "FeaturedProductRequest"
       SET "paymentStatus" = 'PAID',
           "paymentProviderKey" = $2,
           "paymentReference" = $3,
           "paidAt" = NOW(),
           "requestStatus" = 'ACTIVE',
           "activationStartedAt" = NOW(),
           "activationEndsAt" = $4::timestamp,
           "updatedAt" = NOW()
       WHERE "id" = $1`,
      String(current.id),
      String(payload.providerKey || 'MANUAL').toUpperCase(),
      String(payload.paymentReference).trim(),
      endsAt.toISOString()
    );
    res.json({
      success: true,
      message: 'Featured request payment confirmed and products activated.',
      data: {
        requestId: String(current.id),
        activationEndsAt: endsAt.toISOString(),
      },
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    if (error?.status) {
      return res.status(error.status).json({ success: false, message: error.message || 'Request failed.' });
    }
    next(error);
  }
});

export default router;

