import { createHash, randomUUID } from 'crypto';
import { prisma } from '../db';

export const PRODUCT_SKU_SETTINGS_KEY = 'PRODUCT_SKU_SETTINGS';

export type ProductSkuProductType = 'READY_TO_WEAR' | 'FABRIC' | 'DESIGN';

export type ProductSkuSettings = {
  enabled: boolean;
  serialLength: number;
  prefixes: Record<ProductSkuProductType, string>;
};

export const DEFAULT_PRODUCT_SKU_SETTINGS: ProductSkuSettings = {
  enabled: true,
  serialLength: 6,
  prefixes: {
    READY_TO_WEAR: 'R',
    FABRIC: 'F',
    DESIGN: 'C',
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const normalizePrefix = (value: unknown, fallback: string) => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 3);
  return token || fallback;
};

const asObject = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

export const normalizeProductSkuSettings = (raw: unknown): ProductSkuSettings => {
  const row = asObject(raw);
  const prefixesRow = asObject(row.prefixes);
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : DEFAULT_PRODUCT_SKU_SETTINGS.enabled,
    serialLength: clamp(Math.round(Number(row.serialLength || DEFAULT_PRODUCT_SKU_SETTINGS.serialLength)), 4, 12),
    prefixes: {
      READY_TO_WEAR: normalizePrefix(prefixesRow.READY_TO_WEAR, DEFAULT_PRODUCT_SKU_SETTINGS.prefixes.READY_TO_WEAR),
      FABRIC: normalizePrefix(prefixesRow.FABRIC, DEFAULT_PRODUCT_SKU_SETTINGS.prefixes.FABRIC),
      DESIGN: normalizePrefix(prefixesRow.DESIGN, DEFAULT_PRODUCT_SKU_SETTINGS.prefixes.DESIGN),
    },
  };
};

export const normalizeSkuSettings = normalizeProductSkuSettings;

const ensureHomepageSectionSettingTable = async () => {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )
  `);
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
};

export async function readProductSkuSettings() {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date }>>(
    `SELECT "id", "value", "updatedAt" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    PRODUCT_SKU_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
      settings: { ...DEFAULT_PRODUCT_SKU_SETTINGS, prefixes: { ...DEFAULT_PRODUCT_SKU_SETTINGS.prefixes } },
      rowId: null as string | null,
    };
  }
  try {
    const parsed = JSON.parse(String(row.value || '{}'));
    return {
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt,
      settings: normalizeProductSkuSettings(parsed),
      rowId: String(row.id),
    };
  } catch {
    return {
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt,
      settings: { ...DEFAULT_PRODUCT_SKU_SETTINGS, prefixes: { ...DEFAULT_PRODUCT_SKU_SETTINGS.prefixes } },
      rowId: String(row.id),
    };
  }
}

export async function saveProductSkuSettings(input: unknown) {
  const current = await readProductSkuSettings();
  const inputRow = asObject(input);
  const mergedInput = {
    ...current.settings,
    ...inputRow,
    prefixes: {
      ...current.settings.prefixes,
      ...asObject(inputRow.prefixes),
    },
  };
  const normalized = normalizeProductSkuSettings(mergedInput);
  const serialized = JSON.stringify(normalized);
  if (current.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting" SET "value" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      serialized,
      current.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
      randomUUID(),
      PRODUCT_SKU_SETTINGS_KEY,
      serialized
    );
  }
  return normalized;
}

const buildNumericSerial = (seed: string, length: number) => {
  const hash = createHash('sha256').update(seed).digest('hex');
  if (!hash) return ''.padEnd(length, '0');
  let output = '';
  for (let index = 0; index < length; index += 1) {
    const offset = (index * 2) % hash.length;
    const pair = `${hash[offset] || '0'}${hash[(offset + 1) % hash.length] || '0'}`;
    const numeric = Number.parseInt(pair, 16);
    output += Number.isFinite(numeric) ? String(Math.abs(numeric) % 10) : '0';
  }
  return output;
};

export const resolveProductSkuProductType = (value: unknown): ProductSkuProductType => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');
  if (token === 'FABRIC' || token === 'FABRIC_TO_BUY' || token === 'FTB') return 'FABRIC';
  if (token === 'DESIGN' || token === 'CUSTOM_TO_WEAR' || token === 'CUSTOMTOWEAR' || token === 'CTW') return 'DESIGN';
  return 'READY_TO_WEAR';
};

export const generateProductSku = (params: {
  productType: ProductSkuProductType | string;
  productId?: string;
  ownerId?: string;
  productName?: string;
  categoryId?: string;
  existingSku?: unknown;
  settings?: ProductSkuSettings;
}) => {
  const existing = String(params.existingSku || '').trim().toUpperCase();
  if (existing) return existing;
  const settings = params.settings ? normalizeProductSkuSettings(params.settings) : DEFAULT_PRODUCT_SKU_SETTINGS;
  if (!settings.enabled) return '';
  const productId = String(params.productId || '').trim();
  const fallbackSeed = `${String(params.ownerId || '').trim()}:${String(params.productName || '').trim()}:${String(
    params.categoryId || ''
  ).trim()}`;
  const seed = productId || fallbackSeed;
  if (!seed || seed === '::') return '';
  const productType = resolveProductSkuProductType(params.productType);
  const prefix = normalizePrefix(settings.prefixes[productType], DEFAULT_PRODUCT_SKU_SETTINGS.prefixes[productType]);
  const serial = buildNumericSerial(`${productType}:${seed}`, settings.serialLength);
  return `${prefix}${serial}`;
};
