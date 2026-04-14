import { randomUUID } from 'crypto';
import { prisma } from '../db';
import { parseStoredJsonValue } from './parse-stored-json-value';

export const CHECKOUT_PRICING_SETTINGS_KEY = 'CHECKOUT_PRICING_SETTINGS_V1';

export type CheckoutPricingSettings = {
  label: string;
};

export const DEFAULT_CHECKOUT_PRICING_SETTINGS: CheckoutPricingSettings = {
  label: 'Checkout Pricing',
};

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

const normalizeLabel = (value: unknown) => {
  const label = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!label) return DEFAULT_CHECKOUT_PRICING_SETTINGS.label;
  return label.slice(0, 80);
};

export const normalizeCheckoutPricingSettings = (input: unknown): CheckoutPricingSettings => {
  const raw = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  return {
    label: normalizeLabel(raw.label),
  };
};

export const readCheckoutPricingSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date | string }>>(
    `SELECT "id","value","updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    CHECKOUT_PRICING_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      source: 'DEFAULT' as const,
      updatedAt: null as string | null,
      settings: { ...DEFAULT_CHECKOUT_PRICING_SETTINGS },
    };
  }
  try {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: normalizeCheckoutPricingSettings(parseStoredJsonValue(row.value)),
    };
  } catch {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: { ...DEFAULT_CHECKOUT_PRICING_SETTINGS },
    };
  }
};

export const saveCheckoutPricingSettings = async (input: unknown) => {
  const next = normalizeCheckoutPricingSettings(input);
  const existing = await readCheckoutPricingSettings();
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
      CHECKOUT_PRICING_SETTINGS_KEY,
      payload
    );
  }
  const latest = await readCheckoutPricingSettings();
  return latest.settings;
};
