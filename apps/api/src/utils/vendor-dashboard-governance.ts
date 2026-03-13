import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';

export const VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY = 'VENDOR_DASHBOARD_GOVERNANCE';

const sellerTabKeys = ['overview', 'fabrics', 'featured', 'orders', 'tryon'] as const;
const sellerSectionKeys = [
  'profileGovernance',
  'stats',
  'overviewLowStockAlert',
  'overviewCharts',
  'overviewRecentOrders',
  'overviewActivity',
  'overviewTryOnInsights',
  'tryOnInsightsSummary',
  'tryOnInsightsRecent',
  'fabricsTable',
  'featuredTable',
  'ordersTable',
] as const;
const sellerActionKeys = [
  'submitProfile',
  'addProduct',
  'editProduct',
  'updateStock',
  'updateOrderStatus',
] as const;
const sellerFieldKeys = [
  'productName',
  'productDescription',
  'materialType',
  'sellerPrice',
  'listingCurrency',
  'minYards',
  'stockYards',
  'productImages',
] as const;

const designerTabKeys = ['overview', 'designs', 'featured', 'orders', 'tryon'] as const;
const designerSectionKeys = [
  'profileGovernance',
  'stats',
  'overviewOrderStatus',
  'overviewRevenueChart',
  'overviewTopDesigns',
  'overviewActivity',
  'overviewPendingOrdersAlert',
  'overviewTryOnInsights',
  'tryOnInsightsSummary',
  'tryOnInsightsRecent',
  'productsTable',
  'featuredTable',
  'ordersTable',
  'fabricCountryAccess',
  'readyStockModal',
] as const;
const designerActionKeys = [
  'submitProfile',
  'addDesignProduct',
  'addReadyToWearProduct',
  'editDesignProduct',
  'editReadyToWearProduct',
  'manageReadyStock',
  'requestFabricCountryAccess',
  'updateOrderStatus',
] as const;
const designerFieldKeys = [
  'designName',
  'designDescription',
  'designStyle',
  'designBasePrice',
  'designListingCurrency',
  'designImages',
  'designSuitableFabrics',
  'designMeasurementVariables',
  'readyName',
  'readyDescription',
  'readyStyle',
  'readyBasePrice',
  'readyListingCurrency',
  'readyImages',
  'readyVariants',
] as const;

type ToggleRecord<T extends readonly string[]> = Record<T[number], boolean>;
export type DashboardFieldMode = 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
type FieldModeRecord<T extends readonly string[]> = Record<T[number], DashboardFieldMode>;

export type SellerDashboardGovernance = {
  tabs: ToggleRecord<typeof sellerTabKeys>;
  sections: ToggleRecord<typeof sellerSectionKeys>;
  actions: ToggleRecord<typeof sellerActionKeys>;
  fields: FieldModeRecord<typeof sellerFieldKeys>;
};

export type DesignerDashboardGovernance = {
  tabs: ToggleRecord<typeof designerTabKeys>;
  sections: ToggleRecord<typeof designerSectionKeys>;
  actions: ToggleRecord<typeof designerActionKeys>;
  fields: FieldModeRecord<typeof designerFieldKeys>;
};

export type VendorDashboardGovernanceSettings = {
  seller: SellerDashboardGovernance;
  designer: DesignerDashboardGovernance;
};

const buildAllEnabled = <T extends readonly string[]>(keys: T): ToggleRecord<T> =>
  keys.reduce((acc, key) => {
    (acc as Record<string, boolean>)[String(key)] = true;
    return acc;
  }, {} as ToggleRecord<T>);

const buildAllFieldModesEnabled = <T extends readonly string[]>(keys: T): FieldModeRecord<T> =>
  keys.reduce((acc, key) => {
    (acc as Record<string, DashboardFieldMode>)[String(key)] = 'ENABLED';
    return acc;
  }, {} as FieldModeRecord<T>);

export const VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS: VendorDashboardGovernanceSettings = {
  seller: {
    tabs: buildAllEnabled(sellerTabKeys),
    sections: buildAllEnabled(sellerSectionKeys),
    actions: buildAllEnabled(sellerActionKeys),
    fields: buildAllFieldModesEnabled(sellerFieldKeys),
  },
  designer: {
    tabs: buildAllEnabled(designerTabKeys),
    sections: buildAllEnabled(designerSectionKeys),
    actions: buildAllEnabled(designerActionKeys),
    fields: buildAllFieldModesEnabled(designerFieldKeys),
  },
};

const booleanRecordSchema = (keys: readonly string[]) =>
  z
    .record(z.boolean())
    .refine(
      (value) => keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
      'Missing required governance toggle key(s).'
    );

const fieldModeSchema = z.enum(['ENABLED', 'READ_ONLY', 'HIDDEN']);
const fieldModeRecordSchema = (keys: readonly string[]) =>
  z
    .record(fieldModeSchema)
    .refine(
      (value) => keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
      'Missing required governance field mode key(s).'
    );

const sellerGovernanceSchema = z.object({
  tabs: booleanRecordSchema(sellerTabKeys),
  sections: booleanRecordSchema(sellerSectionKeys),
  actions: booleanRecordSchema(sellerActionKeys),
  fields: fieldModeRecordSchema(sellerFieldKeys),
});

const designerGovernanceSchema = z.object({
  tabs: booleanRecordSchema(designerTabKeys),
  sections: booleanRecordSchema(designerSectionKeys),
  actions: booleanRecordSchema(designerActionKeys),
  fields: fieldModeRecordSchema(designerFieldKeys),
});

export const vendorDashboardGovernanceSchema = z.object({
  seller: sellerGovernanceSchema,
  designer: designerGovernanceSchema,
});

let homepageSectionSchemaEnsured = false;
const ensureHomepageSectionSettingTable = async () => {
  if (homepageSectionSchemaEnsured) return;
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
  homepageSectionSchemaEnsured = true;
};

const mergeToggleMap = <T extends Record<string, boolean>>(defaults: T, input: unknown): T => {
  const next = { ...defaults };
  if (!input || typeof input !== 'object') return next;
  for (const key of Object.keys(defaults)) {
    if (typeof (input as any)[key] === 'boolean') {
      next[key as keyof T] = (input as any)[key];
    }
  }
  return next;
};

const normalizeFieldMode = (value: unknown): DashboardFieldMode => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'READ_ONLY') return 'READ_ONLY';
  if (normalized === 'HIDDEN') return 'HIDDEN';
  if (normalized === 'ENABLED') return 'ENABLED';
  if (typeof value === 'boolean') return value ? 'ENABLED' : 'HIDDEN';
  return 'ENABLED';
};

const mergeFieldModeMap = <T extends Record<string, DashboardFieldMode>>(defaults: T, input: unknown): T => {
  const next = { ...defaults };
  if (!input || typeof input !== 'object') return next;
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    next[key as keyof T] = normalizeFieldMode((input as any)[key]) as T[keyof T];
  }
  return next;
};

export const normalizeVendorDashboardGovernanceSettings = (input: unknown): VendorDashboardGovernanceSettings => {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  return {
    seller: {
      tabs: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.tabs, raw?.seller?.tabs),
      sections: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.sections, raw?.seller?.sections),
      actions: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.actions, raw?.seller?.actions),
      fields: mergeFieldModeMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.fields, raw?.seller?.fields),
    },
    designer: {
      tabs: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.tabs, raw?.designer?.tabs),
      sections: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.sections, raw?.designer?.sections),
      actions: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.actions, raw?.designer?.actions),
      fields: mergeFieldModeMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.fields, raw?.designer?.fields),
    },
  };
};

export const readVendorDashboardGovernanceSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: unknown; updatedAt: Date | string }>>(
    `SELECT "id","value","updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      source: 'DEFAULT' as const,
      updatedAt: null as string | null,
      settings: { ...VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS },
    };
  }
  try {
    const rawValue =
      typeof row.value === 'string'
        ? JSON.parse(String(row.value || '{}'))
        : row.value && typeof row.value === 'object'
          ? row.value
          : {};
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: normalizeVendorDashboardGovernanceSettings(rawValue),
    };
  } catch {
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: { ...VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS },
    };
  }
};

export const saveVendorDashboardGovernanceSettings = async (input: unknown) => {
  const normalized = normalizeVendorDashboardGovernanceSettings(input);
  const parsed = vendorDashboardGovernanceSchema.parse(normalized);
  const payload = JSON.stringify(parsed);
  const existing = await readVendorDashboardGovernanceSettings();
  if (existing.rowId) {
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "HomepageSectionSetting"
         SET "value" = $1::jsonb, "updatedAt" = NOW()
         WHERE "id" = $2`,
        payload,
        existing.rowId
      );
    } catch {
      await prisma.$executeRawUnsafe(
        `UPDATE "HomepageSectionSetting"
         SET "value" = $1, "updatedAt" = NOW()
         WHERE "id" = $2`,
        payload,
        existing.rowId
      );
    }
  } else {
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
         VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
        randomUUID(),
        VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY,
        payload
      );
    } catch {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, NOW(), NOW())`,
        randomUUID(),
        VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY,
        payload
      );
    }
  }
  const latest = await readVendorDashboardGovernanceSettings();
  return latest.settings;
};
