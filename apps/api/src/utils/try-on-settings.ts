import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';

export const TRY_ON_SETTINGS_KEY = 'TRY_ON_SETTINGS_V1';

export type TryOnFieldMode = 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
export type TryOnApplyLocation = {
  customerDashboard: boolean;
  adminDashboard: boolean;
  sellerDashboard: boolean;
  designerDashboard: boolean;
  qaDashboard: boolean;
  designProductPage: boolean;
  readyToWearProductPage: boolean;
};

export type TryOnApiProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  appliesTo: Array<'DESIGN' | 'READY_TO_WEAR' | 'DASHBOARD' | 'ALL'>;
};

export type TryOnSettings = {
  enabled: boolean;
  freeTryOnsPerCustomer: number;
  additionalTryOnBundleSize: number;
  additionalTryOnBundlePriceUsd: number;
  maxProductsPerBatch: number;
  requiredMeasurementFields: string[];
  chargeNoticeText: string;
  applyLocations: TryOnApplyLocation;
  apiProviders: TryOnApiProvider[];
};

export const DEFAULT_TRY_ON_SETTINGS: TryOnSettings = {
  enabled: true,
  freeTryOnsPerCustomer: 5,
  additionalTryOnBundleSize: 5,
  additionalTryOnBundlePriceUsd: 1,
  maxProductsPerBatch: 5,
  requiredMeasurementFields: ['height', 'bust', 'waist', 'hips', 'shoulder'],
  chargeNoticeText:
    'First 5 TryON runs are free. After that, each additional bundle is charged based on admin pricing settings.',
  applyLocations: {
    customerDashboard: true,
    adminDashboard: true,
    sellerDashboard: true,
    designerDashboard: true,
    qaDashboard: true,
    designProductPage: true,
    readyToWearProductPage: true,
  },
  apiProviders: [],
};

const providerSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(2),
  baseUrl: z.string().url(),
  apiKey: z.string().default(''),
  isActive: z.boolean().default(true),
  appliesTo: z.array(z.enum(['DESIGN', 'READY_TO_WEAR', 'DASHBOARD', 'ALL'])).default(['ALL']),
});

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  freeTryOnsPerCustomer: z.number().int().min(0).max(10000).optional(),
  additionalTryOnBundleSize: z.number().int().min(1).max(10000).optional(),
  additionalTryOnBundlePriceUsd: z.number().min(0).max(100000).optional(),
  maxProductsPerBatch: z.number().int().min(1).max(100).optional(),
  requiredMeasurementFields: z.array(z.string().min(1)).optional(),
  chargeNoticeText: z.string().max(2000).optional(),
  applyLocations: z
    .object({
      customerDashboard: z.boolean().optional(),
      adminDashboard: z.boolean().optional(),
      sellerDashboard: z.boolean().optional(),
      designerDashboard: z.boolean().optional(),
      qaDashboard: z.boolean().optional(),
      designProductPage: z.boolean().optional(),
      readyToWearProductPage: z.boolean().optional(),
    })
    .optional(),
  apiProviders: z.array(providerSchema).optional(),
});

let homepageSectionSchemaEnsured = false;
const ensureHomepageSectionSettingTable = async () => {
  if (homepageSectionSchemaEnsured) return;
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
  homepageSectionSchemaEnsured = true;
};

const normalizeMeasurementFields = (input: unknown) =>
  Array.from(
    new Set(
      (Array.isArray(input) ? input : [])
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 64)
    )
  );

const normalizeProviders = (input: unknown): TryOnApiProvider[] =>
  (Array.isArray(input) ? input : [])
    .map((entry: any) => {
      const parsed = providerSchema.safeParse(entry || {});
      if (!parsed.success) return null;
      const value = parsed.data;
      return {
        id: String(value.id || randomUUID()),
        name: String(value.name || '').trim(),
        baseUrl: String(value.baseUrl || '').trim(),
        apiKey: String(value.apiKey || ''),
        isActive: value.isActive !== false,
        appliesTo: Array.from(new Set(value.appliesTo || ['ALL'])),
      } satisfies TryOnApiProvider;
    })
    .filter((entry): entry is TryOnApiProvider => Boolean(entry?.name && entry?.baseUrl));

export const normalizeTryOnSettings = (input: unknown): TryOnSettings => {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  const parsedUpdate = updateSchema.safeParse(raw);
  const update = parsedUpdate.success ? parsedUpdate.data : {};
  return {
    enabled: update.enabled ?? DEFAULT_TRY_ON_SETTINGS.enabled,
    freeTryOnsPerCustomer: Math.max(
      0,
      Math.floor(Number(update.freeTryOnsPerCustomer ?? DEFAULT_TRY_ON_SETTINGS.freeTryOnsPerCustomer))
    ),
    additionalTryOnBundleSize: Math.max(
      1,
      Math.floor(Number(update.additionalTryOnBundleSize ?? DEFAULT_TRY_ON_SETTINGS.additionalTryOnBundleSize))
    ),
    additionalTryOnBundlePriceUsd: Number(
      Number(update.additionalTryOnBundlePriceUsd ?? DEFAULT_TRY_ON_SETTINGS.additionalTryOnBundlePriceUsd).toFixed(2)
    ),
    maxProductsPerBatch: Math.max(
      1,
      Math.min(100, Math.floor(Number(update.maxProductsPerBatch ?? DEFAULT_TRY_ON_SETTINGS.maxProductsPerBatch)))
    ),
    requiredMeasurementFields: normalizeMeasurementFields(
      update.requiredMeasurementFields ?? DEFAULT_TRY_ON_SETTINGS.requiredMeasurementFields
    ),
    chargeNoticeText: String(update.chargeNoticeText ?? DEFAULT_TRY_ON_SETTINGS.chargeNoticeText).trim(),
    applyLocations: {
      customerDashboard:
        update.applyLocations?.customerDashboard ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.customerDashboard,
      adminDashboard: update.applyLocations?.adminDashboard ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.adminDashboard,
      sellerDashboard: update.applyLocations?.sellerDashboard ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.sellerDashboard,
      designerDashboard:
        update.applyLocations?.designerDashboard ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.designerDashboard,
      qaDashboard: update.applyLocations?.qaDashboard ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.qaDashboard,
      designProductPage:
        update.applyLocations?.designProductPage ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.designProductPage,
      readyToWearProductPage:
        update.applyLocations?.readyToWearProductPage ?? DEFAULT_TRY_ON_SETTINGS.applyLocations.readyToWearProductPage,
    },
    apiProviders: normalizeProviders(update.apiProviders ?? DEFAULT_TRY_ON_SETTINGS.apiProviders),
  };
};

export const readTryOnSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date | string }>>(
    `SELECT "id","value","updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    TRY_ON_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      source: 'DEFAULT' as const,
      updatedAt: null as string | null,
      settings: { ...DEFAULT_TRY_ON_SETTINGS },
    };
  }
  try {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: normalizeTryOnSettings(JSON.parse(String(row.value || '{}'))),
    };
  } catch {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: { ...DEFAULT_TRY_ON_SETTINGS },
    };
  }
};

export const saveTryOnSettings = async (input: unknown) => {
  const next = normalizeTryOnSettings(input);
  const existing = await readTryOnSettings();
  const payload = JSON.stringify(next);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      randomUUID(),
      TRY_ON_SETTINGS_KEY,
      payload
    );
  }
  const latest = await readTryOnSettings();
  return latest.settings;
};
