import { randomUUID } from 'crypto';
import { prisma, ProductType } from '../db';
import { readOrderWorkflowSettings } from './order-workflow';

export const AUTOMATION_SETTINGS_KEY = 'AUTOMATION_APPROVAL_SETTINGS_V1';

export type AutomationAiProvider = {
  id: string;
  name: string;
  functionTag: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
};

export type AutomationFunctionBinding = {
  id: string;
  functionKey: string;
  functionLabel: string;
  providerId: string;
  isActive: boolean;
};

export type AutomationCriterion = {
  key: string;
  label: string;
  enabled: boolean;
  requiresAi: boolean;
};

export type ProductAutomationCriteria = {
  FABRIC: AutomationCriterion[];
  READY_TO_WEAR: AutomationCriterion[];
  DESIGN: AutomationCriterion[];
};

export type AutomationApprovalSettings = {
  enabled: boolean;
  autoRunOnProductSubmit: boolean;
  autoApproveOnPass: boolean;
  failOnNeedsAi: boolean;
  aiProviders: AutomationAiProvider[];
  functionBindings: AutomationFunctionBinding[];
  criteria: ProductAutomationCriteria;
};

export type AutomationCheckReportRow = {
  key: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'NEEDS_AI' | 'SKIPPED';
  message: string;
};

const parseObject = (value: unknown): Record<string, unknown> => {
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

const normalizeProvider = (value: unknown): AutomationAiProvider | null => {
  const row = parseObject(value);
  const name = String(row.name || '').trim();
  if (!name) return null;
  return {
    id: String(row.id || randomUUID()),
    name,
    functionTag: String(row.functionTag || '').trim(),
    baseUrl: String(row.baseUrl || '').trim(),
    apiKey: String(row.apiKey || ''),
    model: String(row.model || '').trim(),
    isActive: row.isActive !== false,
  };
};

const normalizeBinding = (value: unknown): AutomationFunctionBinding | null => {
  const row = parseObject(value);
  const functionKey = String(row.functionKey || '').trim();
  if (!functionKey) return null;
  return {
    id: String(row.id || randomUUID()),
    functionKey,
    functionLabel: String(row.functionLabel || functionKey).trim(),
    providerId: String(row.providerId || '').trim(),
    isActive: row.isActive !== false,
  };
};

const DEFAULT_CRITERIA: ProductAutomationCriteria = {
  FABRIC: [
    { key: 'name_grammar', label: 'Check fabric name/title grammar and improve wording', enabled: true, requiresAi: true },
    { key: 'description_grammar', label: 'Check fabric description grammar and sales quality', enabled: true, requiresAi: true },
    { key: 'material_match', label: 'Verify material type matches fabric classification', enabled: true, requiresAi: true },
    { key: 'predominant_color_match', label: 'Verify predominant color matches uploaded images', enabled: true, requiresAi: true },
    { key: 'price_outlier', label: 'Flag price when 30%+ below/above peers', enabled: true, requiresAi: false },
    { key: 'currency_sanity', label: 'Check pricing currency/exchange sanity', enabled: true, requiresAi: false },
    { key: 'minimum_yards', label: 'Validate minimum yard policy compliance', enabled: true, requiresAi: false },
    { key: 'stock_vs_minimum', label: 'Validate stock at least 10x minimum order', enabled: true, requiresAi: false },
    { key: 'image_quality', label: 'Enhance/regenerate low quality images', enabled: true, requiresAi: true },
  ],
  READY_TO_WEAR: [
    { key: 'name_grammar', label: 'Check design name/title grammar and improve wording', enabled: true, requiresAi: true },
    { key: 'description_grammar', label: 'Check design description grammar and sales quality', enabled: true, requiresAi: true },
    { key: 'style_match', label: 'Verify style classification matches product intent', enabled: true, requiresAi: true },
    { key: 'predominant_color_match', label: 'Verify predominant color matches uploaded images', enabled: true, requiresAi: true },
    { key: 'price_outlier', label: 'Flag price when 30%+ below/above peers', enabled: true, requiresAi: false },
    { key: 'currency_sanity', label: 'Check pricing currency/exchange sanity', enabled: true, requiresAi: false },
    { key: 'image_quality', label: 'Enhance/regenerate low quality images', enabled: true, requiresAi: true },
    { key: 'variant_validation', label: 'Validate variants size/color/price/stock data', enabled: true, requiresAi: false },
  ],
  DESIGN: [
    { key: 'name_grammar', label: 'Check design name/title grammar and improve wording', enabled: true, requiresAi: true },
    { key: 'description_grammar', label: 'Check design description grammar and sales quality', enabled: true, requiresAi: true },
    { key: 'style_match', label: 'Verify style classification matches product intent', enabled: true, requiresAi: true },
    { key: 'predominant_color_match', label: 'Verify predominant color matches uploaded images', enabled: true, requiresAi: true },
    { key: 'price_outlier', label: 'Flag price when 30%+ below/above peers', enabled: true, requiresAi: false },
    { key: 'currency_sanity', label: 'Check pricing currency/exchange sanity', enabled: true, requiresAi: false },
    { key: 'image_quality', label: 'Enhance/regenerate low quality images', enabled: true, requiresAi: true },
    { key: 'suitable_fabrics_count', label: 'Validate suitable fabrics selected (1-5)', enabled: true, requiresAi: false },
    { key: 'required_measurements', label: 'Validate required measurements selected', enabled: true, requiresAi: false },
  ],
};

const DEFAULT_SETTINGS: AutomationApprovalSettings = {
  enabled: false,
  autoRunOnProductSubmit: false,
  autoApproveOnPass: false,
  failOnNeedsAi: true,
  aiProviders: [],
  functionBindings: [
    {
      id: randomUUID(),
      functionKey: 'text_grammar_enhancement',
      functionLabel: 'Text/Grammatical Correction & Enhancement',
      providerId: '',
      isActive: true,
    },
    {
      id: randomUUID(),
      functionKey: 'image_verification',
      functionLabel: 'Image Verification',
      providerId: '',
      isActive: true,
    },
    {
      id: randomUUID(),
      functionKey: 'image_regeneration',
      functionLabel: 'Image Regeneration',
      providerId: '',
      isActive: true,
    },
    {
      id: randomUUID(),
      functionKey: 'document_ocr_analysis',
      functionLabel: 'Document OCR / Analysis',
      providerId: '',
      isActive: true,
    },
  ],
  criteria: DEFAULT_CRITERIA,
};

const normalizeCriteria = (value: unknown, fallback: AutomationCriterion[]) => {
  if (!Array.isArray(value)) return fallback;
  const rows = value
    .map((entry) => parseObject(entry))
    .map((row) => ({
      key: String(row.key || '').trim(),
      label: String(row.label || '').trim(),
      enabled: row.enabled !== false,
      requiresAi: row.requiresAi === true,
    }))
    .filter((row) => row.key.length > 0);
  return rows.length > 0 ? rows : fallback;
};

export const normalizeAutomationApprovalSettings = (value: unknown): AutomationApprovalSettings => {
  const source = parseObject(value);
  const criteria = parseObject(source.criteria);
  return {
    enabled: source.enabled === true,
    autoRunOnProductSubmit: source.autoRunOnProductSubmit === true,
    autoApproveOnPass: source.autoApproveOnPass === true,
    failOnNeedsAi: source.failOnNeedsAi !== false,
    aiProviders: (Array.isArray(source.aiProviders) ? source.aiProviders : [])
      .map((entry) => normalizeProvider(entry))
      .filter((entry): entry is AutomationAiProvider => Boolean(entry)),
    functionBindings: (Array.isArray(source.functionBindings) ? source.functionBindings : [])
      .map((entry) => normalizeBinding(entry))
      .filter((entry): entry is AutomationFunctionBinding => Boolean(entry)),
    criteria: {
      FABRIC: normalizeCriteria(criteria.FABRIC, DEFAULT_CRITERIA.FABRIC),
      READY_TO_WEAR: normalizeCriteria(criteria.READY_TO_WEAR, DEFAULT_CRITERIA.READY_TO_WEAR),
      DESIGN: normalizeCriteria(criteria.DESIGN, DEFAULT_CRITERIA.DESIGN),
    },
  };
};

let automationSchemaEnsured = false;
export const ensureAutomationSettingsSchema = async () => {
  if (automationSchemaEnsured) return;
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
  automationSchemaEnsured = true;
};

export const readAutomationApprovalSettings = async () => {
  await ensureAutomationSettingsSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: unknown; updatedAt: Date | string }>>(
    `SELECT "id","value","updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    AUTOMATION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...DEFAULT_SETTINGS },
      source: 'DEFAULT' as const,
      updatedAt: null as string | null,
    };
  }
  return {
    rowId: String(row.id),
    settings: normalizeAutomationApprovalSettings(parseObject(row.value)),
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
};

export const saveAutomationApprovalSettings = async (value: unknown) => {
  await ensureAutomationSettingsSchema();
  const existing = await readAutomationApprovalSettings();
  const next = normalizeAutomationApprovalSettings(value);
  const payload = JSON.stringify(next);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1::jsonb, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id","key","value","createdAt","updatedAt")
       VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
      randomUUID(),
      AUTOMATION_SETTINGS_KEY,
      payload
    );
  }
  return (await readAutomationApprovalSettings()).settings;
};

const hasActiveAiProviderBinding = (settings: AutomationApprovalSettings, criterionKey: string) => {
  const binding = settings.functionBindings.find((entry) => entry.isActive && entry.functionKey.includes(criterionKey));
  if (!binding?.providerId) return false;
  const provider = settings.aiProviders.find((entry) => entry.id === binding.providerId && entry.isActive);
  return Boolean(provider && provider.baseUrl && provider.apiKey);
};

const safeRatio = (a: number, b: number) => (b > 0 ? a / b : 0);

export const evaluateProductAutomationChecks = async (input: {
  productType: ProductType;
  productId: string;
  settingsOverride?: AutomationApprovalSettings;
}) => {
  const settings = input.settingsOverride || (await readAutomationApprovalSettings()).settings;
  const criteria = settings.criteria[input.productType];
  const report: AutomationCheckReportRow[] = [];
  if (!settings.enabled) {
    return {
      canAutoApprove: false,
      status: 'AUTOMATION_DISABLED' as const,
      report: [
        {
          key: 'automation_disabled',
          label: 'Automation is disabled',
          status: 'SKIPPED' as const,
          message: 'Enable automation in settings to run product approval checks.',
        },
      ],
    };
  }

  const addResult = (row: AutomationCheckReportRow) => {
    const criterion = criteria.find((entry) => entry.key === row.key);
    if (criterion && !criterion.enabled) {
      report.push({ ...row, status: 'SKIPPED', message: 'Disabled by admin automation settings.' });
      return;
    }
    if (criterion?.requiresAi) {
      const aiReady = hasActiveAiProviderBinding(settings, row.key);
      if (!aiReady) {
        report.push({
          key: row.key,
          label: row.label,
          status: 'NEEDS_AI',
          message: 'AI function is required but no active provider binding is configured.',
        });
        return;
      }
      report.push({ ...row, status: row.status === 'FAIL' ? 'FAIL' : 'PASS' });
      return;
    }
    report.push(row);
  };

  if (input.productType === ProductType.FABRIC) {
    const product = await prisma.fabric.findUnique({
      where: { id: input.productId },
      include: {
        images: true,
        materialType: true,
      },
    });
    if (!product) {
      return {
        canAutoApprove: false,
        status: 'PRODUCT_NOT_FOUND' as const,
        report: [
          {
            key: 'product_exists',
            label: 'Product must exist',
            status: 'FAIL',
            message: 'Fabric product was not found.',
          },
        ],
      };
    }
    const peerAvgRows = await prisma.$queryRawUnsafe<Array<{ avgPrice: number }>>(
      `SELECT AVG("finalPrice")::numeric AS "avgPrice"
       FROM "Fabric"
       WHERE "materialTypeId" = $1
         AND "id" <> $2
         AND "status"::text = 'APPROVED'`,
      product.materialTypeId,
      product.id
    );
    const peerAverage = Number(peerAvgRows?.[0]?.avgPrice || 0);
    const workflow = await readOrderWorkflowSettings();
    const platformMinYards = Math.max(1, Number(workflow.orderLimits?.minFabricYardsPerOrder || 3));
    addResult({
      key: 'name_grammar',
      label: 'Check fabric name/title grammar and improve wording',
      status: String(product.name || '').trim().length >= 3 ? 'PASS' : 'FAIL',
      message: String(product.name || '').trim().length >= 3 ? 'Name is populated.' : 'Name is too short.',
    });
    addResult({
      key: 'description_grammar',
      label: 'Check fabric description grammar and sales quality',
      status: String(product.description || '').trim().length >= 24 ? 'PASS' : 'FAIL',
      message:
        String(product.description || '').trim().length >= 24
          ? 'Description length is acceptable.'
          : 'Description is too short for product storytelling.',
    });
    addResult({
      key: 'material_match',
      label: 'Verify material type matches fabric classification',
      status: product.materialTypeId ? 'PASS' : 'FAIL',
      message: product.materialTypeId ? `Material type: ${product.materialType?.name || 'Assigned'}` : 'No material type assigned.',
    });
    addResult({
      key: 'predominant_color_match',
      label: 'Verify predominant color matches uploaded images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for color verification.' : 'No images uploaded.',
    });
    addResult({
      key: 'price_outlier',
      label: 'Flag price when 30%+ below/above peers',
      status:
        peerAverage <= 0 || safeRatio(Number(product.finalPrice || 0), peerAverage) <= 1.3
          ? 'PASS'
          : 'FAIL',
      message:
        peerAverage <= 0
          ? 'No peer baseline available yet.'
          : `Current $${Number(product.finalPrice || 0).toFixed(2)} vs peer avg $${peerAverage.toFixed(2)}.`,
    });
    addResult({
      key: 'currency_sanity',
      label: 'Check pricing currency/exchange sanity',
      status: Number(product.finalPrice || 0) > 0 ? 'PASS' : 'FAIL',
      message: Number(product.finalPrice || 0) > 0 ? 'Positive final price detected.' : 'Final price must be greater than zero.',
    });
    addResult({
      key: 'minimum_yards',
      label: 'Validate minimum yard policy compliance',
      status: Number(product.minYards || 0) >= platformMinYards ? 'PASS' : 'FAIL',
      message: `Product min yards ${Number(product.minYards || 0)}; platform minimum ${platformMinYards}.`,
    });
    addResult({
      key: 'stock_vs_minimum',
      label: 'Validate stock at least 10x minimum order',
      status: Number(product.stockYards || 0) >= Math.max(1, Number(product.minYards || 1)) * 10 ? 'PASS' : 'FAIL',
      message: `Stock ${Number(product.stockYards || 0)} yards; expected at least ${
        Math.max(1, Number(product.minYards || 1)) * 10
      }.`,
    });
    addResult({
      key: 'image_quality',
      label: 'Enhance/regenerate low quality images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for enhancement pipeline.' : 'No image available to enhance.',
    });
  } else if (input.productType === ProductType.READY_TO_WEAR) {
    const product = await prisma.readyToWear.findUnique({
      where: { id: input.productId },
      include: {
        images: true,
        sizeVariations: true,
        category: true,
      },
    });
    if (!product) {
      return {
        canAutoApprove: false,
        status: 'PRODUCT_NOT_FOUND' as const,
        report: [
          {
            key: 'product_exists',
            label: 'Product must exist',
            status: 'FAIL',
            message: 'Ready-to-wear product was not found.',
          },
        ],
      };
    }
    const peerAvgRows = await prisma.$queryRawUnsafe<Array<{ avgPrice: number }>>(
      `SELECT AVG("basePrice")::numeric AS "avgPrice"
       FROM "ReadyToWear"
       WHERE "categoryId" = $1
         AND "id" <> $2
         AND "status"::text = 'APPROVED'`,
      product.categoryId,
      product.id
    );
    const peerAverage = Number(peerAvgRows?.[0]?.avgPrice || 0);
    addResult({
      key: 'name_grammar',
      label: 'Check design name/title grammar and improve wording',
      status: String(product.name || '').trim().length >= 3 ? 'PASS' : 'FAIL',
      message: String(product.name || '').trim().length >= 3 ? 'Name is populated.' : 'Name is too short.',
    });
    addResult({
      key: 'description_grammar',
      label: 'Check design description grammar and sales quality',
      status: String(product.description || '').trim().length >= 24 ? 'PASS' : 'FAIL',
      message: String(product.description || '').trim().length >= 24 ? 'Description length is acceptable.' : 'Description is too short.',
    });
    addResult({
      key: 'style_match',
      label: 'Verify style classification matches product intent',
      status: Boolean(product.categoryId) ? 'PASS' : 'FAIL',
      message: product.categoryId ? `Category set: ${product.category?.name || 'Assigned'}` : 'No category/style set.',
    });
    addResult({
      key: 'predominant_color_match',
      label: 'Verify predominant color matches uploaded images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for color verification.' : 'No images uploaded.',
    });
    addResult({
      key: 'price_outlier',
      label: 'Flag price when 30%+ below/above peers',
      status: peerAverage <= 0 || safeRatio(Number(product.basePrice || 0), peerAverage) <= 1.3 ? 'PASS' : 'FAIL',
      message:
        peerAverage <= 0
          ? 'No peer baseline available yet.'
          : `Current $${Number(product.basePrice || 0).toFixed(2)} vs peer avg $${peerAverage.toFixed(2)}.`,
    });
    addResult({
      key: 'currency_sanity',
      label: 'Check pricing currency/exchange sanity',
      status: Number(product.basePrice || 0) > 0 ? 'PASS' : 'FAIL',
      message: Number(product.basePrice || 0) > 0 ? 'Positive base price detected.' : 'Price must be greater than zero.',
    });
    addResult({
      key: 'image_quality',
      label: 'Enhance/regenerate low quality images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for enhancement pipeline.' : 'No image available to enhance.',
    });
    const hasVariantFailure = product.sizeVariations.some((row) => Number(row.stock || 0) < 1 || Number(row.price || 0) <= 0);
    addResult({
      key: 'variant_validation',
      label: 'Validate variants size/color/price/stock data',
      status: hasVariantFailure ? 'FAIL' : 'PASS',
      message: hasVariantFailure
        ? 'At least one variant has invalid stock/price (stock must be >= 1 and price > 0).'
        : 'Variant stock and pricing checks passed.',
    });
  } else {
    const product = await prisma.design.findUnique({
      where: { id: input.productId },
      include: {
        images: true,
        suitableFabrics: true,
        measurementVariables: true,
        category: true,
      },
    });
    if (!product) {
      return {
        canAutoApprove: false,
        status: 'PRODUCT_NOT_FOUND' as const,
        report: [
          {
            key: 'product_exists',
            label: 'Product must exist',
            status: 'FAIL',
            message: 'Design product was not found.',
          },
        ],
      };
    }
    const peerAvgRows = await prisma.$queryRawUnsafe<Array<{ avgPrice: number }>>(
      `SELECT AVG("basePrice")::numeric AS "avgPrice"
       FROM "Design"
       WHERE "categoryId" = $1
         AND "id" <> $2
         AND "status"::text = 'APPROVED'`,
      product.categoryId,
      product.id
    );
    const peerAverage = Number(peerAvgRows?.[0]?.avgPrice || 0);
    addResult({
      key: 'name_grammar',
      label: 'Check design name/title grammar and improve wording',
      status: String(product.name || '').trim().length >= 3 ? 'PASS' : 'FAIL',
      message: String(product.name || '').trim().length >= 3 ? 'Name is populated.' : 'Name is too short.',
    });
    addResult({
      key: 'description_grammar',
      label: 'Check design description grammar and sales quality',
      status: String(product.description || '').trim().length >= 24 ? 'PASS' : 'FAIL',
      message: String(product.description || '').trim().length >= 24 ? 'Description length is acceptable.' : 'Description is too short.',
    });
    addResult({
      key: 'style_match',
      label: 'Verify style classification matches product intent',
      status: Boolean(product.categoryId) ? 'PASS' : 'FAIL',
      message: product.categoryId ? `Category set: ${product.category?.name || 'Assigned'}` : 'No category/style set.',
    });
    addResult({
      key: 'predominant_color_match',
      label: 'Verify predominant color matches uploaded images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for color verification.' : 'No images uploaded.',
    });
    addResult({
      key: 'price_outlier',
      label: 'Flag price when 30%+ below/above peers',
      status: peerAverage <= 0 || safeRatio(Number(product.basePrice || 0), peerAverage) <= 1.3 ? 'PASS' : 'FAIL',
      message:
        peerAverage <= 0
          ? 'No peer baseline available yet.'
          : `Current $${Number(product.basePrice || 0).toFixed(2)} vs peer avg $${peerAverage.toFixed(2)}.`,
    });
    addResult({
      key: 'currency_sanity',
      label: 'Check pricing currency/exchange sanity',
      status: Number(product.basePrice || 0) > 0 ? 'PASS' : 'FAIL',
      message: Number(product.basePrice || 0) > 0 ? 'Positive base price detected.' : 'Price must be greater than zero.',
    });
    addResult({
      key: 'image_quality',
      label: 'Enhance/regenerate low quality images',
      status: product.images.length > 0 ? 'PASS' : 'FAIL',
      message: product.images.length > 0 ? 'Images available for enhancement pipeline.' : 'No image available to enhance.',
    });
    addResult({
      key: 'suitable_fabrics_count',
      label: 'Validate suitable fabrics selected (1-5)',
      status: product.suitableFabrics.length >= 1 && product.suitableFabrics.length <= 5 ? 'PASS' : 'FAIL',
      message: `Suitable fabrics selected: ${product.suitableFabrics.length}.`,
    });
    addResult({
      key: 'required_measurements',
      label: 'Validate required measurements selected',
      status: product.measurementVariables.filter((row) => row.isRequired !== false).length > 0 ? 'PASS' : 'FAIL',
      message: `Required measurements selected: ${product.measurementVariables.filter((row) => row.isRequired !== false).length}.`,
    });
  }

  const hasFail = report.some((entry) => entry.status === 'FAIL');
  const hasNeedsAi = report.some((entry) => entry.status === 'NEEDS_AI');
  const canAutoApprove = !hasFail && (!settings.failOnNeedsAi || !hasNeedsAi);
  return {
    canAutoApprove,
    status: canAutoApprove ? ('PASS' as const) : ('REVIEW_REQUIRED' as const),
    report,
  };
};
