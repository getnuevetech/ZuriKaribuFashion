import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

type IntegrationFieldType = 'TEXT' | 'PASSWORD' | 'URL' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'TEXTAREA';
type IntegrationMode = 'TEST' | 'LIVE';
type ProviderType = 'GLOBAL' | 'LOCAL';

type ShippingIntegrationField = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  isSecret?: boolean;
  exposePublic?: boolean;
  sortOrder?: number;
};

type ShippingIntegrationRow = {
  id: string;
  providerKey: string;
  displayName: string;
  providerType: ProviderType;
  mode: IntegrationMode;
  isActive: boolean;
  supportsCountries: string[];
  configSchema: ShippingIntegrationField[];
  configValues: Record<string, unknown>;
  notes: string | null;
  updatedAt: string;
};

type ShippingLocalOptionRow = {
  id: string;
  countryCode: string;
  countryName: string;
  city: string | null;
  providerKey: string;
  providerName: string;
  serviceName: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceUsd: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

const BUILTIN_SHIPPING_TEMPLATES = [
  {
    providerKey: 'UPS',
    displayName: 'UPS',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
    ],
    configValues: {
      baseRateUsd: 30,
      percentRate: 2.5,
      markupUsd: 0,
      etaMinDays: 4,
      etaMaxDays: 10,
    },
  },
  {
    providerKey: 'USPS',
    displayName: 'USPS',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
    ],
    configValues: {
      baseRateUsd: 25,
      percentRate: 2.2,
      markupUsd: 0,
      etaMinDays: 5,
      etaMaxDays: 11,
    },
  },
  {
    providerKey: 'FEDEX',
    displayName: 'FedEx',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
    ],
    configValues: {
      baseRateUsd: 32,
      percentRate: 2.9,
      markupUsd: 0,
      etaMinDays: 3,
      etaMaxDays: 8,
    },
  },
  {
    providerKey: 'DHL',
    displayName: 'DHL',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
    ],
    configValues: {
      baseRateUsd: 35,
      percentRate: 3.1,
      markupUsd: 0,
      etaMinDays: 3,
      etaMaxDays: 7,
    },
  },
];

const BUILTIN_PROVIDER_KEYS = new Set(BUILTIN_SHIPPING_TEMPLATES.map((row) => row.providerKey));
let shippingSchemaEnsured = false;

const normalizeProviderKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

const normalizeCountryCode = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const parseArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeFieldType = (value: unknown): IntegrationFieldType => {
  const token = String(value || '').toUpperCase();
  if (token === 'PASSWORD') return 'PASSWORD';
  if (token === 'URL') return 'URL';
  if (token === 'NUMBER') return 'NUMBER';
  if (token === 'BOOLEAN') return 'BOOLEAN';
  if (token === 'SELECT') return 'SELECT';
  if (token === 'TEXTAREA') return 'TEXTAREA';
  return 'TEXT';
};

const normalizeProviderType = (value: unknown): ProviderType =>
  String(value || '').toUpperCase() === 'LOCAL' ? 'LOCAL' : 'GLOBAL';

const normalizeMode = (value: unknown): IntegrationMode =>
  String(value || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST';

const normalizeConfigSchema = (raw: unknown): ShippingIntegrationField[] =>
  parseArray(raw)
    .map((field, index) => {
      const row = parseObject(field);
      const key = String(row.key || '')
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 80);
      if (!key) return null;
      return {
        key,
        label: String(row.label || key),
        type: normalizeFieldType(row.type),
        required: Boolean(row.required),
        placeholder: row.placeholder ? String(row.placeholder) : undefined,
        helpText: row.helpText ? String(row.helpText) : undefined,
        options: parseArray(row.options).map((entry) => String(entry || '')).filter(Boolean),
        isSecret: Boolean(row.isSecret),
        exposePublic: Boolean(row.exposePublic),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
      } as ShippingIntegrationField;
    })
    .filter((entry): entry is ShippingIntegrationField => Boolean(entry))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

const toFiniteNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

async function ensureShippingSchema() {
  if (shippingSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ShippingIntegration" (
      "id" TEXT NOT NULL,
      "providerKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "providerType" TEXT NOT NULL DEFAULT 'GLOBAL',
      "mode" TEXT NOT NULL DEFAULT 'TEST',
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "supportsCountries" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "notes" TEXT,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShippingIntegration_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ShippingIntegration_providerKey_key" ON "ShippingIntegration"("providerKey")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "supportsCountries" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ShippingIntegration" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ShippingLocalOption" (
      "id" TEXT NOT NULL,
      "countryCode" TEXT NOT NULL,
      "countryName" TEXT NOT NULL,
      "city" TEXT,
      "providerKey" TEXT NOT NULL,
      "providerName" TEXT NOT NULL,
      "serviceName" TEXT NOT NULL,
      "etaMinDays" INTEGER NOT NULL DEFAULT 1,
      "etaMaxDays" INTEGER NOT NULL DEFAULT 3,
      "priceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShippingLocalOption_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ShippingLocalOption_countryCode_idx" ON "ShippingLocalOption"("countryCode")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ShippingLocalOption_isActive_idx" ON "ShippingLocalOption"("isActive")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingLocalOption" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingLocalOption" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ShippingLocalOption" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );

  for (const template of BUILTIN_SHIPPING_TEMPLATES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ShippingIntegration"
        ("id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,'[]'::jsonb,$6::jsonb,$7::jsonb,NOW(),NOW())
       ON CONFLICT ("providerKey") DO NOTHING`,
      randomUUID(),
      template.providerKey,
      template.displayName,
      template.providerType,
      template.mode,
      JSON.stringify(template.configSchema),
      JSON.stringify(template.configValues)
    );
  }
  shippingSchemaEnsured = true;
}

async function readShippingIntegrations(params?: { activeOnly?: boolean; providerKey?: string }) {
  await ensureShippingSchema();
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.activeOnly) {
    values.push(true);
    filters.push(`"isActive" = $${values.length}`);
  }
  if (params?.providerKey) {
    values.push(normalizeProviderKey(params.providerKey));
    filters.push(`UPPER("providerKey") = $${values.length}`);
  }
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","notes","updatedAt"
     FROM "ShippingIntegration"
     ${whereClause}
     ORDER BY "displayName" ASC, "providerKey" ASC`,
    ...values
  );
  return rows.map((row) => ({
    id: String(row.id),
    providerKey: normalizeProviderKey(row.providerKey),
    displayName: String(row.displayName || row.providerKey || 'Shipping Provider'),
    providerType: normalizeProviderType(row.providerType),
    mode: normalizeMode(row.mode),
    isActive: Boolean(row.isActive),
    supportsCountries: parseArray(row.supportsCountries).map((entry) => normalizeCountryCode(entry)).filter(Boolean),
    configSchema: normalizeConfigSchema(row.configSchema),
    configValues: parseObject(row.configValues),
    notes: row.notes ? String(row.notes) : null,
    updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
  })) as ShippingIntegrationRow[];
}

async function upsertShippingIntegration(params: {
  providerKey: string;
  displayName?: string;
  providerType?: ProviderType;
  mode?: IntegrationMode;
  isActive?: boolean;
  supportsCountries?: string[];
  configSchema?: ShippingIntegrationField[];
  configValues?: Record<string, unknown>;
  notes?: string | null;
  userId: string;
}) {
  const providerKey = normalizeProviderKey(params.providerKey);
  if (!providerKey) throw Object.assign(new Error('Provider key is required.'), { status: 400 });
  const existing = (await readShippingIntegrations({ providerKey }))[0] || null;
  const template = BUILTIN_SHIPPING_TEMPLATES.find((row) => row.providerKey === providerKey) || null;
  const displayName =
    String(params.displayName || existing?.displayName || template?.displayName || providerKey).trim() || providerKey;
  const providerType = params.providerType || existing?.providerType || template?.providerType || 'GLOBAL';
  const mode = params.mode || existing?.mode || template?.mode || 'TEST';
  const isActive = typeof params.isActive === 'boolean' ? params.isActive : existing?.isActive || false;
  const supportsCountries = Array.isArray(params.supportsCountries)
    ? params.supportsCountries.map((entry) => normalizeCountryCode(entry)).filter(Boolean)
    : existing?.supportsCountries || [];
  const configSchema = normalizeConfigSchema(params.configSchema || existing?.configSchema || template?.configSchema || []);
  const configValues = parseObject(params.configValues || existing?.configValues || template?.configValues || {});
  const notes = params.notes === undefined ? existing?.notes || null : params.notes;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShippingIntegration"
      ("id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","notes","createdById","updatedById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,NOW(),NOW())
     ON CONFLICT ("providerKey")
     DO UPDATE SET
       "displayName" = EXCLUDED."displayName",
       "providerType" = EXCLUDED."providerType",
       "mode" = EXCLUDED."mode",
       "isActive" = EXCLUDED."isActive",
       "supportsCountries" = EXCLUDED."supportsCountries",
       "configSchema" = EXCLUDED."configSchema",
       "configValues" = EXCLUDED."configValues",
       "notes" = EXCLUDED."notes",
       "updatedById" = EXCLUDED."updatedById",
       "updatedAt" = NOW()`,
    existing?.id || randomUUID(),
    providerKey,
    displayName,
    providerType,
    mode,
    isActive,
    JSON.stringify(supportsCountries),
    JSON.stringify(configSchema),
    JSON.stringify(configValues),
    notes,
    params.userId,
    params.userId
  );
  return (await readShippingIntegrations({ providerKey }))[0] || null;
}

async function readShippingLocalOptions(params?: {
  activeOnly?: boolean;
  countryCode?: string;
  city?: string;
  providerKey?: string;
}) {
  await ensureShippingSchema();
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.activeOnly) {
    values.push(true);
    filters.push(`"isActive" = $${values.length}`);
  }
  if (params?.countryCode) {
    values.push(normalizeCountryCode(params.countryCode));
    filters.push(`UPPER("countryCode") = $${values.length}`);
  }
  if (params?.providerKey) {
    values.push(normalizeProviderKey(params.providerKey));
    filters.push(`UPPER("providerKey") = $${values.length}`);
  }
  if (params?.city) {
    values.push(String(params.city).trim().toLowerCase());
    filters.push(`(LOWER(COALESCE("city", '')) = '' OR LOWER("city") = $${values.length})`);
  }
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata","updatedAt"
     FROM "ShippingLocalOption"
     ${whereClause}
     ORDER BY "countryName" ASC, "providerName" ASC, "serviceName" ASC`,
    ...values
  );
  return rows.map((row) => ({
    id: String(row.id),
    countryCode: normalizeCountryCode(row.countryCode),
    countryName: String(row.countryName || '').trim(),
    city: row.city ? String(row.city).trim() : null,
    providerKey: normalizeProviderKey(row.providerKey),
    providerName: String(row.providerName || row.providerKey || 'Local Carrier'),
    serviceName: String(row.serviceName || 'Standard'),
    etaMinDays: Math.max(0, Math.floor(toFiniteNumber(row.etaMinDays, 1))),
    etaMaxDays: Math.max(0, Math.floor(toFiniteNumber(row.etaMaxDays, 3))),
    priceUsd: Number(toFiniteNumber(row.priceUsd, 0).toFixed(2)),
    isActive: Boolean(row.isActive),
    metadata: parseObject(row.metadata),
    updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
  })) as ShippingLocalOptionRow[];
}

router.get(
  '/admin/integrations',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (_req, res, next) => {
    try {
      const providers = await readShippingIntegrations();
      res.json({
        success: true,
        data: {
          providers,
          builtinProviderKeys: Array.from(BUILTIN_PROVIDER_KEYS.values()),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/integrations',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          providerKey: z.string().min(2),
          displayName: z.string().min(2).optional(),
          providerType: z.enum(['GLOBAL', 'LOCAL']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          supportsCountries: z.array(z.string()).optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);
      const provider = await upsertShippingIntegration({
        providerKey: payload.providerKey,
        displayName: payload.displayName,
        providerType: payload.providerType,
        mode: payload.mode,
        isActive: payload.isActive,
        supportsCountries: payload.supportsCountries,
        configSchema: payload.configSchema as ShippingIntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          displayName: z.string().min(2).optional(),
          providerType: z.enum(['GLOBAL', 'LOCAL']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          supportsCountries: z.array(z.string()).optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);
      const provider = await upsertShippingIntegration({
        providerKey: req.params.providerKey,
        displayName: payload.displayName,
        providerType: payload.providerType,
        mode: payload.mode,
        isActive: payload.isActive,
        supportsCountries: payload.supportsCountries,
        configSchema: payload.configSchema as ShippingIntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });
      res.json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const providerKey = normalizeProviderKey(req.params.providerKey);
      if (!providerKey) {
        return res.status(400).json({ success: false, message: 'Provider key is required.' });
      }
      if (BUILTIN_PROVIDER_KEYS.has(providerKey)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "ShippingIntegration"
           SET "isActive" = false, "updatedById" = $1, "updatedAt" = NOW()
           WHERE UPPER("providerKey") = $2`,
          req.user!.id,
          providerKey
        );
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "ShippingIntegration" WHERE UPPER("providerKey") = $1`, providerKey);
      }
      res.json({ success: true, message: 'Shipping integration removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/admin/local-options',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const countryCode = String(req.query.countryCode || '').trim();
      const city = String(req.query.city || '').trim();
      const providerKey = String(req.query.providerKey || '').trim();
      const options = await readShippingLocalOptions({
        countryCode: countryCode || undefined,
        city: city || undefined,
        providerKey: providerKey || undefined,
      });
      res.json({
        success: true,
        data: options,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/local-options',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          countryCode: z.string().min(2).max(2),
          countryName: z.string().min(2),
          city: z.string().optional(),
          providerKey: z.string().min(2),
          providerName: z.string().min(2),
          serviceName: z.string().min(2),
          etaMinDays: z.number().min(0),
          etaMaxDays: z.number().min(0),
          priceUsd: z.number().min(0),
          isActive: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
        })
        .parse(req.body);
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ShippingLocalOption"
          ("id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata","createdById","updatedById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW(),NOW())`,
        id,
        normalizeCountryCode(payload.countryCode),
        String(payload.countryName).trim(),
        payload.city ? String(payload.city).trim() : null,
        normalizeProviderKey(payload.providerKey),
        String(payload.providerName).trim(),
        String(payload.serviceName).trim(),
        Math.max(0, Math.floor(Number(payload.etaMinDays || 0))),
        Math.max(0, Math.floor(Number(payload.etaMaxDays || 0))),
        Number(Number(payload.priceUsd || 0).toFixed(2)),
        payload.isActive !== false,
        JSON.stringify(payload.metadata || {}),
        req.user!.id,
        req.user!.id
      );
      const option = (await readShippingLocalOptions()).find((row) => row.id === id) || null;
      res.status(201).json({ success: true, data: option });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/local-options/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          countryCode: z.string().min(2).max(2).optional(),
          countryName: z.string().min(2).optional(),
          city: z.string().nullable().optional(),
          providerKey: z.string().min(2).optional(),
          providerName: z.string().min(2).optional(),
          serviceName: z.string().min(2).optional(),
          etaMinDays: z.number().min(0).optional(),
          etaMaxDays: z.number().min(0).optional(),
          priceUsd: z.number().min(0).optional(),
          isActive: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
        })
        .parse(req.body);

      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata"
         FROM "ShippingLocalOption"
         WHERE "id" = $1
         LIMIT 1`,
        req.params.id
      );
      const existing = rows[0];
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Shipping local option not found.' });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "ShippingLocalOption"
         SET
           "countryCode" = $2,
           "countryName" = $3,
           "city" = $4,
           "providerKey" = $5,
           "providerName" = $6,
           "serviceName" = $7,
           "etaMinDays" = $8,
           "etaMaxDays" = $9,
           "priceUsd" = $10,
           "isActive" = $11,
           "metadata" = $12::jsonb,
           "updatedById" = $13,
           "updatedAt" = NOW()
         WHERE "id" = $1`,
        req.params.id,
        normalizeCountryCode(payload.countryCode ?? existing.countryCode),
        String(payload.countryName ?? existing.countryName).trim(),
        payload.city === null ? null : payload.city !== undefined ? String(payload.city).trim() : existing.city,
        normalizeProviderKey(payload.providerKey ?? existing.providerKey),
        String(payload.providerName ?? existing.providerName).trim(),
        String(payload.serviceName ?? existing.serviceName).trim(),
        Math.max(0, Math.floor(Number(payload.etaMinDays ?? existing.etaMinDays ?? 0))),
        Math.max(0, Math.floor(Number(payload.etaMaxDays ?? existing.etaMaxDays ?? 0))),
        Number(Number(payload.priceUsd ?? existing.priceUsd ?? 0).toFixed(2)),
        payload.isActive ?? Boolean(existing.isActive),
        JSON.stringify(payload.metadata ?? parseObject(existing.metadata)),
        req.user!.id
      );
      const option = (await readShippingLocalOptions()).find((row) => row.id === req.params.id) || null;
      res.json({ success: true, data: option });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/local-options/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      await prisma.$executeRawUnsafe(`DELETE FROM "ShippingLocalOption" WHERE "id" = $1`, req.params.id);
      res.json({ success: true, message: 'Shipping local option removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.post('/options', authenticate, authorizePermissions(Permissions.ORDERS_CREATE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        countryCode: z.string().min(2).max(2),
        city: z.string().optional(),
        subtotalUsd: z.number().min(0).default(0),
        weightKg: z.number().min(0).optional(),
      })
      .parse(req.body);

    const countryCode = normalizeCountryCode(payload.countryCode);
    const normalizedCity = String(payload.city || '').trim().toLowerCase();
    const subtotalUsd = Number(payload.subtotalUsd || 0);
    const weightKg = Number(payload.weightKg || 0);

    const [globalIntegrations, localOptions] = await Promise.all([
      readShippingIntegrations({ activeOnly: true }),
      readShippingLocalOptions({ activeOnly: true, countryCode, city: normalizedCity || undefined }),
    ]);

    const globalQuotes = globalIntegrations
      .filter((provider) => {
        if (provider.providerType !== 'GLOBAL') return false;
        if (!Array.isArray(provider.supportsCountries) || provider.supportsCountries.length === 0) return true;
        return provider.supportsCountries.includes(countryCode);
      })
      .map((provider) => {
        const values = provider.configValues || {};
        const baseRate = toFiniteNumber(values.baseRateUsd, 25);
        const percentRate = toFiniteNumber(values.percentRate, 2.5);
        const markupUsd = toFiniteNumber(values.markupUsd, 0);
        const etaMinDays = Math.max(0, Math.floor(toFiniteNumber(values.etaMinDays, 4)));
        const etaMaxDays = Math.max(etaMinDays, Math.floor(toFiniteNumber(values.etaMaxDays, 10)));
        const weightRate = toFiniteNumber(values.weightRateUsdPerKg, 0);
        const priceUsd = Number((baseRate + subtotalUsd * (percentRate / 100) + markupUsd + weightKg * weightRate).toFixed(2));
        return {
          id: `global-${provider.providerKey.toLowerCase()}`,
          source: 'GLOBAL',
          providerKey: provider.providerKey,
          providerName: provider.displayName,
          serviceName: String(values.serviceName || `${provider.displayName} Standard`),
          etaMinDays,
          etaMaxDays,
          priceUsd,
        };
      });

    const localQuotes = localOptions.map((option) => ({
      id: option.id,
      source: 'LOCAL',
      providerKey: option.providerKey,
      providerName: option.providerName,
      serviceName: option.serviceName,
      etaMinDays: option.etaMinDays,
      etaMaxDays: option.etaMaxDays,
      priceUsd: Number(Number(option.priceUsd || 0).toFixed(2)),
      countryCode: option.countryCode,
      city: option.city,
    }));

    const quotes = [...globalQuotes, ...localQuotes].sort((a, b) => a.priceUsd - b.priceUsd);
    const recommended = quotes[0] || null;

    res.json({
      success: true,
      data: {
        countryCode,
        city: payload.city || '',
        quotes,
        recommendedQuoteId: recommended?.id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
