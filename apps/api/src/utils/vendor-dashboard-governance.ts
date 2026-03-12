import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';

export const VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY = 'VENDOR_DASHBOARD_GOVERNANCE';

const sellerTabKeys = ['overview', 'fabrics', 'featured', 'orders'] as const;
const sellerSectionKeys = [
  'profileGovernance',
  'stats',
  'overviewLowStockAlert',
  'overviewCharts',
  'overviewRecentOrders',
  'overviewActivity',
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

const designerTabKeys = ['overview', 'designs', 'featured', 'orders'] as const;
const designerSectionKeys = [
  'profileGovernance',
  'stats',
  'overviewOrderStatus',
  'overviewRevenueChart',
  'overviewTopDesigns',
  'overviewActivity',
  'overviewPendingOrdersAlert',
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

export type SellerDashboardGovernance = {
  tabs: ToggleRecord<typeof sellerTabKeys>;
  sections: ToggleRecord<typeof sellerSectionKeys>;
  actions: ToggleRecord<typeof sellerActionKeys>;
  fields: ToggleRecord<typeof sellerFieldKeys>;
};

export type DesignerDashboardGovernance = {
  tabs: ToggleRecord<typeof designerTabKeys>;
  sections: ToggleRecord<typeof designerSectionKeys>;
  actions: ToggleRecord<typeof designerActionKeys>;
  fields: ToggleRecord<typeof designerFieldKeys>;
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

export const VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS: VendorDashboardGovernanceSettings = {
  seller: {
    tabs: buildAllEnabled(sellerTabKeys),
    sections: buildAllEnabled(sellerSectionKeys),
    actions: buildAllEnabled(sellerActionKeys),
    fields: buildAllEnabled(sellerFieldKeys),
  },
  designer: {
    tabs: buildAllEnabled(designerTabKeys),
    sections: buildAllEnabled(designerSectionKeys),
    actions: buildAllEnabled(designerActionKeys),
    fields: buildAllEnabled(designerFieldKeys),
  },
};

const booleanRecordSchema = (keys: readonly string[]) =>
  z
    .record(z.boolean())
    .refine(
      (value) => keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)),
      'Missing required governance toggle key(s).'
    );

const sellerGovernanceSchema = z.object({
  tabs: booleanRecordSchema(sellerTabKeys),
  sections: booleanRecordSchema(sellerSectionKeys),
  actions: booleanRecordSchema(sellerActionKeys),
  fields: booleanRecordSchema(sellerFieldKeys),
});

const designerGovernanceSchema = z.object({
  tabs: booleanRecordSchema(designerTabKeys),
  sections: booleanRecordSchema(designerSectionKeys),
  actions: booleanRecordSchema(designerActionKeys),
  fields: booleanRecordSchema(designerFieldKeys),
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

export const normalizeVendorDashboardGovernanceSettings = (input: unknown): VendorDashboardGovernanceSettings => {
  const raw = input && typeof input === 'object' ? (input as any) : {};
  return {
    seller: {
      tabs: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.tabs, raw?.seller?.tabs),
      sections: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.sections, raw?.seller?.sections),
      actions: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.actions, raw?.seller?.actions),
      fields: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.seller.fields, raw?.seller?.fields),
    },
    designer: {
      tabs: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.tabs, raw?.designer?.tabs),
      sections: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.sections, raw?.designer?.sections),
      actions: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.actions, raw?.designer?.actions),
      fields: mergeToggleMap(VENDOR_DASHBOARD_GOVERNANCE_DEFAULTS.designer.fields, raw?.designer?.fields),
    },
  };
};

export const readVendorDashboardGovernanceSettings = async () => {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date | string }>>(
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
    return {
      rowId: String(row.id),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      settings: normalizeVendorDashboardGovernanceSettings(JSON.parse(String(row.value || '{}'))),
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
      VENDOR_DASHBOARD_GOVERNANCE_SETTINGS_KEY,
      payload
    );
  }
  const latest = await readVendorDashboardGovernanceSettings();
  return latest.settings;
};
