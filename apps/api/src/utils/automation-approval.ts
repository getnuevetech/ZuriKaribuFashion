import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
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
  allowAiEdits?: boolean;
};

export type ProductAutomationCriteria = {
  FABRIC: AutomationCriterion[];
  READY_TO_WEAR: AutomationCriterion[];
  DESIGN: AutomationCriterion[];
  ACCOUNT_APPROVAL: AutomationCriterion[];
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

export type AutomationFailureSeverity = 'NONE' | 'MID' | 'MAJOR';

export type ProductAutomationOutcome = {
  productType: ProductType;
  productId: string;
  evaluationStatus: string;
  action: string;
  failureSeverity: AutomationFailureSeverity;
  needsCorrection: boolean;
  summaryMessage: string;
  report: AutomationCheckReportRow[];
  updatedAt: string | null;
};

export type AutomationAppliedChange = {
  key: string;
  label: string;
  field: string;
  beforeValue: string;
  afterValue: string;
  status: 'APPLIED' | 'SKIPPED';
  reason: string;
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

const parseReportRows = (value: unknown): AutomationCheckReportRow[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => parseObject(entry))
      .map((entry) => {
        const status = String(entry.status || '').toUpperCase();
        return {
          key: String(entry.key || '').trim(),
          label: String(entry.label || entry.key || '').trim(),
          status:
            status === 'PASS' || status === 'FAIL' || status === 'NEEDS_AI' || status === 'SKIPPED'
              ? (status as AutomationCheckReportRow['status'])
              : 'SKIPPED',
          message: String(entry.message || '').trim(),
        } satisfies AutomationCheckReportRow;
      })
      .filter((entry) => entry.key.length > 0);
  }
  if (typeof value === 'string') {
    try {
      return parseReportRows(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
};

const parseChangeReportRows = (value: unknown): AutomationAppliedChange[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => parseObject(entry))
      .map((entry) => {
        const status = String(entry.status || '').toUpperCase();
        return {
          key: String(entry.key || '').trim(),
          label: String(entry.label || entry.key || '').trim(),
          field: String(entry.field || '').trim(),
          beforeValue: String(entry.beforeValue || ''),
          afterValue: String(entry.afterValue || ''),
          status: status === 'APPLIED' || status === 'SKIPPED' ? (status as 'APPLIED' | 'SKIPPED') : 'SKIPPED',
          reason: String(entry.reason || '').trim(),
        } satisfies AutomationAppliedChange;
      })
      .filter((entry) => entry.key.length > 0);
  }
  if (typeof value === 'string') {
    try {
      return parseChangeReportRows(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return [];
};

const truncateText = (value: string, max = 280) => {
  const normalized = String(value || '').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
};

const parseFirstJsonObject = (value: string): Record<string, unknown> | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const tryParse = (input: string): Record<string, unknown> | null => {
    try {
      const parsed = JSON.parse(input);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(raw);
  if (direct) return direct;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return tryParse(raw.slice(start, end + 1));
  }
  return null;
};

const correctionRowsFromReport = (report: AutomationCheckReportRow[]) =>
  report.filter((entry) => entry.status === 'FAIL' || entry.status === 'NEEDS_AI' || entry.status === 'SKIPPED');

export const resolveProductAutomationFailureSeverity = (
  report: AutomationCheckReportRow[]
): AutomationFailureSeverity => {
  const rows = correctionRowsFromReport(report);
  if (rows.some((entry) => entry.status === 'FAIL')) return 'MAJOR';
  if (rows.some((entry) => entry.status === 'NEEDS_AI' || entry.status === 'SKIPPED')) return 'MID';
  return 'NONE';
};

const buildAutomationSummaryMessage = (report: AutomationCheckReportRow[], fallback = '') => {
  const rows = correctionRowsFromReport(report).slice(0, 3);
  if (rows.length === 0) return truncateText(fallback || 'Automation checks passed.', 400);
  const parts = rows.map((entry) => truncateText(entry.message || entry.label || entry.key, 100)).filter(Boolean);
  const suffix = correctionRowsFromReport(report).length > rows.length ? ' (+more)' : '';
  return truncateText(`Needs correction: ${parts.join(' | ')}${suffix}`, 400);
};

const buildVendorAiRecommendations = (input: {
  report: AutomationCheckReportRow[];
  changeReport: AutomationAppliedChange[];
}) => {
  const recommendations: string[] = [];
  const seen = new Set<string>();
  const add = (text: string) => {
    const normalized = truncateText(String(text || '').replace(/\s+/g, ' ').trim(), 220);
    if (!normalized) return;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    recommendations.push(normalized);
  };

  for (const entry of input.changeReport) {
    if (entry.status !== 'SKIPPED') continue;
    const field = String(entry.field || '').trim();
    const label = String(entry.label || entry.key || '').trim();
    const reason = String(entry.reason || '').trim();
    if (field === 'images[0]') {
      add(
        `Upload a clearer image of the exact same product/angle (enhancement only). AI note: ${reason || 'Regeneration must preserve original product identity.'}`
      );
    } else if (field === 'name') {
      add(`Revise product title for grammar and clarity. AI note: ${reason || 'Title edit was required but not applied.'}`);
    } else if (field === 'description') {
      add(
        `Revise product description for grammar, readability, and sales clarity. AI note: ${reason || 'Description edit was required but not applied.'}`
      );
    } else if (field) {
      add(`Update ${field}. AI note: ${reason || `${label} requires correction.`}`);
    }
  }

  for (const row of input.report) {
    if (row.status !== 'FAIL' && row.status !== 'NEEDS_AI') continue;
    const guidanceMatch = String(row.message || '').match(/AI guidance:\s*([\s\S]+)/i);
    if (guidanceMatch?.[1]) {
      add(`${row.label || row.key}: ${guidanceMatch[1]}`);
    }
    if (/strict ai edit required/i.test(String(row.message || ''))) {
      if (row.key === 'image_quality' || row.key === 'predominant_color_match') {
        add('Keep original product subject unchanged; only improve sharpness, color balance, and lighting.');
      } else if (row.key === 'name_grammar') {
        add('Update title while preserving original product meaning and style intent.');
      } else if (row.key === 'description_grammar') {
        add('Update description while preserving factual claims from the original listing.');
      }
    }
  }

  return recommendations.slice(0, 8);
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
  const functionKey = normalizeAutomationFunctionKey(row.functionKey);
  if (!functionKey) return null;
  return {
    id: String(row.id || randomUUID()),
    functionKey,
    functionLabel: String(row.functionLabel || functionKey).trim(),
    providerId: String(row.providerId || '').trim(),
    isActive: row.isActive !== false,
  };
};

const normalizeAutomationFunctionKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

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
  ACCOUNT_APPROVAL: [
    { key: 'identity_fields_complete', label: 'Validate required account identity fields', enabled: true, requiresAi: false },
    { key: 'contact_fields_complete', label: 'Validate required contact fields', enabled: true, requiresAi: false },
    { key: 'vendor_profile_minimum', label: 'Validate vendor profile minimum requirements', enabled: true, requiresAi: false },
    { key: 'account_notes_grammar', label: 'AI grammar check for account notes/description', enabled: false, requiresAi: true },
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

const STRICT_AUTO_EDIT_DEFAULT_KEYS = new Set([
  'name_grammar',
  'description_grammar',
  'image_quality',
  'predominant_color_match',
]);

const normalizeCriteria = (value: unknown, fallback: AutomationCriterion[]) => {
  const fallbackRows = fallback.map((entry) => ({
    ...entry,
    allowAiEdits:
      typeof entry.allowAiEdits === 'boolean'
        ? entry.allowAiEdits
        : entry.requiresAi === true && STRICT_AUTO_EDIT_DEFAULT_KEYS.has(String(entry.key || '').trim()),
  }));
  if (!Array.isArray(value)) return fallbackRows;
  const rows = value
    .map((entry) => parseObject(entry))
    .map((row) => {
      const key = String(row.key || '').trim();
      const requiresAi = row.requiresAi === true;
      const allowAiEditsRaw = row.allowAiEdits;
      const allowAiEdits =
        typeof allowAiEditsRaw === 'boolean'
          ? allowAiEditsRaw
          : requiresAi && STRICT_AUTO_EDIT_DEFAULT_KEYS.has(key);
      return {
        key,
        label: String(row.label || '').trim(),
        enabled: row.enabled !== false,
        requiresAi,
        allowAiEdits,
      };
    })
    .filter((row) => row.key.length > 0);
  return rows.length > 0 ? rows : fallbackRows;
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
      ACCOUNT_APPROVAL: normalizeCriteria(criteria.ACCOUNT_APPROVAL, DEFAULT_CRITERIA.ACCOUNT_APPROVAL),
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

let productAutomationOutcomeSchemaEnsured = false;
export const ensureProductAutomationOutcomeSchema = async () => {
  if (productAutomationOutcomeSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ProductAutomationOutcome" (
      "id" TEXT NOT NULL,
      "productType" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "evaluationStatus" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
      "action" TEXT NOT NULL DEFAULT 'NONE',
      "failureSeverity" TEXT NOT NULL DEFAULT 'NONE',
      "needsCorrection" BOOLEAN NOT NULL DEFAULT false,
      "summaryMessage" TEXT NOT NULL DEFAULT '',
      "report" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "notifiedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ProductAutomationOutcome_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ProductAutomationOutcome_productType_productId_key"
     ON "ProductAutomationOutcome"("productType","productId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductAutomationOutcome_productType_productId_idx"
     ON "ProductAutomationOutcome"("productType","productId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ProductAutomationOutcome_failureSeverity_idx"
     ON "ProductAutomationOutcome"("failureSeverity","needsCorrection")`
  );
  productAutomationOutcomeSchemaEnsured = true;
};

let cachedTransporter: nodemailer.Transporter | null | undefined;
const getMailer = (): nodemailer.Transporter | null => {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return cachedTransporter;
};

const sendAutomationEmail = async (input: { to: string; subject: string; text: string; html: string }) => {
  const transporter = getMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !input.to) return;
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
};

const mapProductAutomationOutcomeRow = (row: any): ProductAutomationOutcome => ({
  productType: String(row?.productType || ProductType.FABRIC) as ProductType,
  productId: String(row?.productId || ''),
  evaluationStatus: String(row?.evaluationStatus || 'REVIEW_REQUIRED'),
  action: String(row?.action || 'NONE'),
  failureSeverity: String(row?.failureSeverity || 'NONE').toUpperCase() === 'MAJOR'
    ? 'MAJOR'
    : String(row?.failureSeverity || 'NONE').toUpperCase() === 'MID'
      ? 'MID'
      : 'NONE',
  needsCorrection: Boolean(row?.needsCorrection),
  summaryMessage: String(row?.summaryMessage || ''),
  report: parseReportRows(row?.report),
  updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

export const saveProductAutomationOutcome = async (input: {
  productType: ProductType;
  productId: string;
  evaluationStatus: string;
  action?: string;
  report?: unknown;
  summaryMessage?: string;
  failureSeverity?: AutomationFailureSeverity;
  needsCorrection?: boolean;
  notifiedAt?: Date | null;
}) => {
  await ensureProductAutomationOutcomeSchema();
  const report = parseReportRows(input.report);
  const derivedSeverity = input.failureSeverity || resolveProductAutomationFailureSeverity(report);
  const needsCorrection = input.needsCorrection ?? derivedSeverity !== 'NONE';
  const summaryMessage =
    String(input.summaryMessage || '').trim() || buildAutomationSummaryMessage(report, needsCorrection ? 'Needs correction.' : 'Passed');
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProductAutomationOutcome"
      ("id","productType","productId","evaluationStatus","action","failureSeverity","needsCorrection","summaryMessage","report","notifiedAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,NOW(),NOW())
     ON CONFLICT ("productType","productId")
     DO UPDATE SET
       "evaluationStatus" = EXCLUDED."evaluationStatus",
       "action" = EXCLUDED."action",
       "failureSeverity" = EXCLUDED."failureSeverity",
       "needsCorrection" = EXCLUDED."needsCorrection",
       "summaryMessage" = EXCLUDED."summaryMessage",
       "report" = EXCLUDED."report",
       "notifiedAt" = COALESCE(EXCLUDED."notifiedAt","ProductAutomationOutcome"."notifiedAt"),
       "updatedAt" = NOW()`,
    randomUUID(),
    input.productType,
    input.productId,
    String(input.evaluationStatus || 'REVIEW_REQUIRED'),
    String(input.action || 'NONE'),
    derivedSeverity,
    Boolean(needsCorrection),
    summaryMessage,
    JSON.stringify(report),
    input.notifiedAt || null
  );
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "productType","productId","evaluationStatus","action","failureSeverity","needsCorrection","summaryMessage","report","updatedAt"
     FROM "ProductAutomationOutcome"
     WHERE "productType" = $1 AND "productId" = $2
     LIMIT 1`,
    input.productType,
    input.productId
  );
  return rows.length > 0 ? mapProductAutomationOutcomeRow(rows[0]) : null;
};

export const clearProductAutomationOutcome = async (input: { productType: ProductType; productId: string }) => {
  await saveProductAutomationOutcome({
    productType: input.productType,
    productId: input.productId,
    evaluationStatus: 'RESET',
    action: 'RESET',
    report: [],
    failureSeverity: 'NONE',
    needsCorrection: false,
    summaryMessage: 'Automation result reset after product update.',
  });
};

export const readProductAutomationOutcomesForProducts = async (input: {
  productType: ProductType;
  productIds: string[];
}) => {
  await ensureProductAutomationOutcomeSchema();
  const ids = Array.from(new Set((input.productIds || []).map((entry) => String(entry || '').trim()).filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, ProductAutomationOutcome>;
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "productType","productId","evaluationStatus","action","failureSeverity","needsCorrection","summaryMessage","report","updatedAt"
     FROM "ProductAutomationOutcome"
     WHERE "productType" = $1
       AND "productId" = ANY($2::text[])`,
    input.productType,
    ids
  );
  return (Array.isArray(rows) ? rows : []).reduce<Record<string, ProductAutomationOutcome>>((acc, row) => {
    const mapped = mapProductAutomationOutcomeRow(row);
    if (mapped.productId) acc[mapped.productId] = mapped;
    return acc;
  }, {});
};

const resolveAutomationRecipient = async (input: { productType: ProductType; productId: string }) => {
  if (input.productType === ProductType.FABRIC) {
    const row = await prisma.fabric.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        seller: {
          select: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    return row
      ? {
          productName: String(row.name || 'Fabric product'),
          userId: String(row.seller.user.id),
          email: String(row.seller.user.email || ''),
          firstName: String(row.seller.user.firstName || ''),
          lastName: String(row.seller.user.lastName || ''),
        }
      : null;
  }
  if (input.productType === ProductType.READY_TO_WEAR) {
    const row = await prisma.readyToWear.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        designer: {
          select: {
            user: { select: { id: true, email: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    return row
      ? {
          productName: String(row.name || 'Ready-to-wear product'),
          userId: String(row.designer.user.id),
          email: String(row.designer.user.email || ''),
          firstName: String(row.designer.user.firstName || ''),
          lastName: String(row.designer.user.lastName || ''),
        }
      : null;
  }
  const row = await prisma.design.findUnique({
    where: { id: input.productId },
    select: {
      id: true,
      name: true,
      designer: {
        select: {
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
    },
  });
  return row
    ? {
        productName: String(row.name || 'Design product'),
        userId: String(row.designer.user.id),
        email: String(row.designer.user.email || ''),
        firstName: String(row.designer.user.firstName || ''),
        lastName: String(row.designer.user.lastName || ''),
      }
    : null;
};

export const notifyVendorAboutProductAutomationFailure = async (input: {
  productType: ProductType;
  productId: string;
  report?: unknown;
  changeReport?: unknown;
  outcome?: ProductAutomationOutcome | null;
  errorMessage?: string;
}) => {
  try {
    const recipient = await resolveAutomationRecipient({
      productType: input.productType,
      productId: input.productId,
    });
    if (!recipient) return;
    const report = parseReportRows(input.report);
    const changeReport = parseChangeReportRows(input.changeReport);
    const severity = input.outcome?.failureSeverity || resolveProductAutomationFailureSeverity(report);
    const summary = truncateText(
      String(input.outcome?.summaryMessage || '').trim() ||
        buildAutomationSummaryMessage(report, input.errorMessage || 'Automation checks require updates.'),
      400
    );
    const aiRecommendations = buildVendorAiRecommendations({ report, changeReport });
    const vendorName = `${recipient.firstName} ${recipient.lastName}`.trim() || 'Vendor';
    const title =
      severity === 'MAJOR'
        ? 'Product requires major corrections'
        : severity === 'MID'
          ? 'Product requires additional corrections'
          : 'Product automation update';
    await prisma.notification.create({
      data: {
        userId: recipient.userId,
        type: 'PRODUCT_REJECTED' as any,
        title,
        message: `${recipient.productName}: ${summary}${aiRecommendations.length ? ` | AI recommendations: ${truncateText(aiRecommendations[0], 140)}` : ''}`,
        relatedType: 'PRODUCT',
        relatedId: input.productId,
      },
    });
    if (recipient.email) {
      const topRows = correctionRowsFromReport(report).slice(0, 6);
      const bulletText = topRows.length
        ? topRows.map((entry) => `- ${entry.label || entry.key}: ${truncateText(entry.message || 'Requires review', 140)}`).join('\n')
        : `- ${summary}`;
      const bulletHtml = topRows.length
        ? topRows
            .map(
              (entry) =>
                `<li><strong>${entry.label || entry.key}:</strong> ${truncateText(entry.message || 'Requires review', 180)}</li>`
            )
            .join('')
        : `<li>${summary}</li>`;
      const recommendationText = aiRecommendations.length
        ? aiRecommendations.map((entry) => `- ${entry}`).join('\n')
        : '- Review the failed checks and apply corrections before resubmitting.';
      const recommendationHtml = aiRecommendations.length
        ? aiRecommendations.map((entry) => `<li>${entry}</li>`).join('')
        : '<li>Review the failed checks and apply corrections before resubmitting.</li>';
      await sendAutomationEmail({
        to: recipient.email,
        subject: `[Action Required] ${recipient.productName} needs correction`,
        text: `Hello ${vendorName},\n\nYour product "${recipient.productName}" did not pass automation checks.\n\n${summary}\n\nItems to correct:\n${bulletText}\n\nAI recommendations:\n${recommendationText}\n\nPlease update the product and resubmit.\n`,
        html: `<p>Hello ${vendorName},</p><p>Your product <strong>${recipient.productName}</strong> did not pass automation checks.</p><p>${summary}</p><p><strong>Items to correct:</strong></p><ul>${bulletHtml}</ul><p><strong>AI recommendations:</strong></p><ul>${recommendationHtml}</ul><p>Please update the product and resubmit.</p>`,
      });
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "ProductAutomationOutcome"
       SET "notifiedAt" = NOW(), "updatedAt" = NOW()
       WHERE "productType" = $1 AND "productId" = $2`,
      input.productType,
      input.productId
    );
  } catch (error) {
    console.error('[automation] Failed to notify vendor about automation failure:', error);
  }
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
  const next = normalizeAutomationApprovalSettings({
    ...existing.settings,
    ...parseObject(value),
    criteria: {
      ...(existing.settings.criteria || {}),
      ...parseObject(parseObject(value).criteria),
    },
  });
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

const CRITERION_AI_FUNCTION_MAP: Record<string, string> = {
  name_grammar: 'text_grammar_enhancement',
  description_grammar: 'text_grammar_enhancement',
  material_match: 'image_verification',
  style_match: 'image_verification',
  predominant_color_match: 'image_verification',
  image_quality: 'image_verification',
};

type AiExecutionResult =
  | { status: 'OK'; output: string }
  | { status: 'NO_PROVIDER'; reason: string }
  | { status: 'ERROR'; reason: string };

const normalizeEndpoint = (baseUrl: string, suffix: string) => {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (trimmed.toLowerCase().endsWith(suffix.toLowerCase())) return trimmed;
  return `${trimmed}${suffix.startsWith('/') ? '' : '/'}${suffix}`;
};

const readNestedString = (payload: any, path: string[]): string => {
  let node = payload;
  for (const key of path) {
    if (!node || typeof node !== 'object') return '';
    node = node[key];
  }
  return typeof node === 'string' ? node : '';
};

const resolveProviderForFunction = (settings: AutomationApprovalSettings, functionKey: string) => {
  const targetKey = normalizeAutomationFunctionKey(functionKey);
  if (!targetKey) return null;
  const activeProviders = new Map(
    (settings.aiProviders || [])
      .filter(
        (entry) =>
          entry.isActive !== false &&
          String(entry.id || '').trim().length > 0 &&
          String(entry.baseUrl || '').trim().length > 0 &&
          String(entry.apiKey || '').trim().length > 0
      )
      .map((entry) => [String(entry.id || '').trim(), entry] as const)
  );
  for (const binding of settings.functionBindings || []) {
    if (binding.isActive === false) continue;
    if (normalizeAutomationFunctionKey(binding.functionKey) !== targetKey) continue;
    const providerId = String(binding.providerId || '').trim();
    if (!providerId) continue;
    const provider = activeProviders.get(providerId);
    if (provider) return provider;
  }
  return null;
};

const callTextExecutor = async (
  provider: AutomationAiProvider,
  prompt: string,
  system: string
): Promise<AiExecutionResult> => {
  const endpoint = normalizeEndpoint(provider.baseUrl, '/chat/completions');
  if (!endpoint) {
    return { status: 'ERROR', reason: 'Missing provider endpoint.' } as AiExecutionResult;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(provider.apiKey || '').trim()}`,
      },
      body: JSON.stringify({
        model: String(provider.model || '').trim() || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        status: 'ERROR',
        reason: `Provider returned ${response.status}: ${String(text || '').slice(0, 200)}`,
      };
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      parsed = {};
    }
    const output =
      readNestedString(parsed, ['choices', '0', 'message', 'content']) ||
      readNestedString(parsed, ['output_text']) ||
      String(text || '').trim();
    if (!output) {
      return { status: 'ERROR', reason: 'Provider returned an empty completion.' };
    }
    return { status: 'OK', output: String(output).trim().slice(0, 1000) };
  } catch (error: any) {
    return { status: 'ERROR', reason: String(error?.message || 'Network error while calling provider.') };
  } finally {
    clearTimeout(timeout);
  }
};

const callImageRegenerationExecutor = async (
  provider: AutomationAiProvider,
  prompt: string
): Promise<AiExecutionResult> => {
  const endpoint = normalizeEndpoint(provider.baseUrl, '/images/generations');
  if (!endpoint) {
    return { status: 'ERROR', reason: 'Missing provider endpoint.' } as AiExecutionResult;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${String(provider.apiKey || '').trim()}`,
      },
      body: JSON.stringify({
        model: String(provider.model || '').trim() || 'gpt-image-1',
        prompt,
        size: '1024x1024',
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      return {
        status: 'ERROR',
        reason: `Image generation returned ${response.status}: ${String(text || '').slice(0, 200)}`,
      };
    }
    let parsed: any = {};
    try {
      parsed = JSON.parse(text || '{}');
    } catch {
      parsed = {};
    }
    const imageUrl = readNestedString(parsed, ['data', '0', 'url']);
    if (imageUrl) return { status: 'OK', output: `Regenerated image URL: ${imageUrl}` };
    const hasB64 = readNestedString(parsed, ['data', '0', 'b64_json']);
    if (hasB64) return { status: 'OK', output: 'Regenerated image payload received (base64).' };
    return { status: 'ERROR', reason: 'No regenerated image output returned.' };
  } catch (error: any) {
    return { status: 'ERROR', reason: String(error?.message || 'Network error while regenerating image.') };
  } finally {
    clearTimeout(timeout);
  }
};

const executeAutomationAiFunction = async (params: {
  settings: AutomationApprovalSettings;
  functionKey: string;
  prompt: string;
  systemPrompt: string;
}): Promise<AiExecutionResult> => {
  const normalizedFunctionKey = normalizeAutomationFunctionKey(params.functionKey);
  const provider = resolveProviderForFunction(params.settings, normalizedFunctionKey);
  if (!provider) {
    return {
      status: 'NO_PROVIDER',
      reason: `No active provider binding for ${normalizedFunctionKey || params.functionKey}.`,
    } as AiExecutionResult;
  }
  if (normalizedFunctionKey === 'image_regeneration') {
    return callImageRegenerationExecutor(provider, params.prompt);
  }
  return callTextExecutor(provider, params.prompt, params.systemPrompt);
};

export const testAutomationProviderBinding = async (input: {
  providerId: string;
  functionKey?: string;
  prompt?: string;
}) => {
  const settings = (await readAutomationApprovalSettings()).settings;
  const providerId = String(input.providerId || '').trim();
  const functionKey = normalizeAutomationFunctionKey(input.functionKey || 'text_grammar_enhancement');
  if (!providerId) {
    return {
      ok: false,
      status: 'INVALID_INPUT' as const,
      message: 'Provider ID is required.',
    };
  }
  const provider = settings.aiProviders.find(
    (entry) => entry.isActive !== false && String(entry.id || '').trim() === providerId
  );
  if (!provider) {
    return {
      ok: false,
      status: 'NO_PROVIDER' as const,
      message: 'Provider not found or inactive.',
    };
  }
  const clonedSettings: AutomationApprovalSettings = {
    ...settings,
    functionBindings: [
      ...(settings.functionBindings || []).filter(
        (entry) => normalizeAutomationFunctionKey(entry.functionKey) !== functionKey
      ),
      {
        id: randomUUID(),
        functionKey,
        functionLabel: functionKey,
        providerId: provider.id,
        isActive: true,
      },
    ],
  };
  const prompt =
    String(input.prompt || '').trim() ||
    `Provider connectivity test for ${provider.name}. Return a concise success acknowledgment.`;
  const result = await executeAutomationAiFunction({
    settings: clonedSettings,
    functionKey,
    prompt,
    systemPrompt:
      'You are running a provider connectivity test for an e-commerce automation control panel.',
  });
  if (result.status === 'OK') {
    return {
      ok: true,
      status: 'OK' as const,
      message: result.output,
      provider: {
        id: provider.id,
        name: provider.name,
        functionTag: provider.functionTag,
      },
      functionKey,
    };
  }
  return {
    ok: false,
    status: result.status,
    message: result.reason,
    provider: {
      id: provider.id,
      name: provider.name,
      functionTag: provider.functionTag,
    },
    functionKey,
  };
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
  let aiContextSummary = '';
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
      changeReport: [] as AutomationAppliedChange[],
    };
  }

  const addResult = (row: AutomationCheckReportRow) => {
    const criterion = criteria.find((entry) => entry.key === row.key);
    if (criterion && !criterion.enabled) {
      report.push({ ...row, status: 'SKIPPED', message: 'Disabled by admin automation settings.' });
      return;
    }
    report.push(row);
  };

  const changeReport: AutomationAppliedChange[] = [];
  const stagedProductFields: Record<string, string> = {};
  let stagedImageUrls: string[] = [];
  let persistStagedProductEdits: null | ((updates: Record<string, string>) => Promise<void>) = null;
  let persistStagedImageEdits: null | ((urls: string[]) => Promise<void>) = null;
  const readStagedProductField = (field: string) => String(stagedProductFields[field] || '');
  const readStagedImageUrls = () => [...stagedImageUrls];
  type EditableFieldKey =
    | 'name'
    | 'description'
    | 'finalPrice'
    | 'basePrice'
    | 'minYards'
    | 'stockYards';
  type CriterionFieldEditRule =
    | { field: EditableFieldKey; kind: 'text'; minLength: number; maxLength: number }
    | { field: EditableFieldKey; kind: 'number'; minNumber: number; maxNumber: number };
  const resolveCriterionEditRule = (criterionKey: string): CriterionFieldEditRule | null => {
    switch (criterionKey) {
      case 'name_grammar':
        return { field: 'name', kind: 'text', minLength: 3, maxLength: 160 };
      case 'description_grammar':
        return { field: 'description', kind: 'text', minLength: 24, maxLength: 4000 };
      case 'price_outlier':
      case 'currency_sanity':
        return {
          field: input.productType === ProductType.FABRIC ? 'finalPrice' : 'basePrice',
          kind: 'number',
          minNumber: 1,
          maxNumber: 1000000,
        };
      case 'minimum_yards':
        return input.productType === ProductType.FABRIC
          ? { field: 'minYards', kind: 'number', minNumber: 1, maxNumber: 100000 }
          : null;
      case 'stock_vs_minimum':
        return input.productType === ProductType.FABRIC
          ? { field: 'stockYards', kind: 'number', minNumber: 1, maxNumber: 1000000 }
          : null;
      default:
        return null;
    }
  };

  const requestAiFieldEdit = async (params: { row: AutomationCheckReportRow }) => {
    const rule = resolveCriterionEditRule(params.row.key);
    if (!rule) {
      return null as {
        applied: boolean;
        before: string;
        after: string;
        reason: string;
      } | null;
    }
    const before = readStagedProductField(rule.field);
    if (!before.trim()) {
      return { applied: false, before, after: before, reason: 'No existing value available for AI edit.' };
    }
    const execution = await executeAutomationAiFunction({
      settings,
      functionKey: 'text_grammar_enhancement',
      prompt:
        rule.kind === 'text'
          ? `You are correcting a product ${rule.field} field.

Criterion: ${params.row.label}
Current value:
"""${before}"""

Return STRICT JSON only:
{"updatedValue":"<corrected value>","reason":"<short reason>"}
Rules:
- Keep original meaning and product intent.
- Avoid adding claims not present in the original text.
- Keep concise, sales-friendly wording.
- Do not exceed ${rule.maxLength} characters.`
          : `You are correcting a product numeric field.

Criterion: ${params.row.label}
Field: ${rule.field}
Current numeric value: ${before}
Validation message: ${params.row.message}

Return STRICT JSON only:
{"updatedValue":123.45,"reason":"<short reason>"}
Rules:
- Output a number between ${rule.minNumber} and ${rule.maxNumber}.
- Keep value realistic and compliant with validation message.
- Do not include currency symbols.`,
      systemPrompt: 'You are a product content correction assistant. Return strict JSON only.',
    });
    if (execution.status !== 'OK') {
      return {
        applied: false,
        before,
        after: before,
        reason:
          execution.status === 'NO_PROVIDER'
            ? execution.reason
            : `AI edit execution failed: ${execution.reason}`,
      };
    }
    const parseLabeledValue = (raw: string) => {
      const source = String(raw || '').trim();
      if (!source) return '';
      const sanitized = source.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const lineMatch =
        sanitized.match(/(?:updated\s*value|updated\s*text|new\s*value)\s*[:=-]\s*["“]?([\s\S]+)/i) ||
        sanitized.match(/(?:title|description)\s*[:=-]\s*["“]?([\s\S]+)/i);
      const extracted = lineMatch?.[1] ? String(lineMatch[1]) : sanitized;
      return extracted
        .replace(/["”]\s*$/g, '')
        .replace(/\n+(reason|notes?)\s*[:=-][\s\S]*$/i, '')
        .trim();
    };
    const parsed = parseFirstJsonObject(execution.output);
    if (rule.kind === 'text') {
      const getNormalizedTextCandidate = (raw: string, parsedPayload: Record<string, unknown> | null) =>
        (
          String(parsedPayload?.updatedValue || parsedPayload?.value || parsedPayload?.updated || '').trim() ||
          parseLabeledValue(raw)
        )
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, rule.maxLength);
      let normalized = getNormalizedTextCandidate(String(execution.output || ''), parsed);
      if ((normalized.length < rule.minLength || normalized === before) && params.row.status === 'FAIL') {
        const retry = await executeAutomationAiFunction({
          settings,
          functionKey: 'text_grammar_enhancement',
          prompt: `Rewrite ONLY the ${rule.field} value for this failed criterion.

Criterion: ${params.row.label}
Current value:
"""${before}"""

Return ONLY the improved ${rule.field} text.
No explanations, no labels, no JSON, no markdown.`,
          systemPrompt: 'You rewrite product fields. Return only the updated value.',
        });
        if (retry.status === 'OK') {
          normalized = getNormalizedTextCandidate(String(retry.output || ''), parseFirstJsonObject(String(retry.output || '')));
        }
      }
      if (normalized.length < rule.minLength) {
        return {
          applied: false,
          before,
          after: before,
          reason: `AI suggestion too short for ${rule.field}.`,
        };
      }
      if (normalized === before) {
        return {
          applied: false,
          before,
          after: before,
          reason: 'AI suggestion is identical to current value.',
        };
      }
      const reason = String(parsed?.reason || '').trim() || `AI updated ${rule.field}.`;
      return {
        applied: true,
        before,
        after: normalized,
        reason,
      };
    }
    const parsedNumeric = Number(parsed?.updatedValue ?? parsed?.value ?? parsed?.updated ?? Number.NaN);
    const fallbackNumeric = Number(String(execution.output || '').match(/-?\d+(\.\d+)?/)?.[0] || Number.NaN);
    const numericCandidate = Number.isFinite(parsedNumeric) ? parsedNumeric : fallbackNumeric;
    if (!Number.isFinite(numericCandidate)) {
      return {
        applied: false,
        before,
        after: before,
        reason: `AI did not return a valid numeric value for ${rule.field}.`,
      };
    }
    const normalizedNumber = Math.min(rule.maxNumber, Math.max(rule.minNumber, numericCandidate));
    const after = String(Number(normalizedNumber.toFixed(2)));
    if (after === before) {
      return {
        applied: false,
        before,
        after: before,
        reason: 'AI suggestion is identical to current numeric value.',
      };
    }
    const reason = String(parsed?.reason || '').trim() || `AI updated ${rule.field}.`;
    return {
      applied: true,
      before,
      after,
      reason,
    };
  };

  const requestAiImageEdit = async (params: { row: AutomationCheckReportRow }) => {
    const existingImages = readStagedImageUrls();
    if (existingImages.length === 0) {
      return {
        applied: false,
        before: '',
        after: '',
        reason: 'No existing images available for AI replacement.',
      };
    }
    const sourceUrl = existingImages[0] || '';
    const execution = await executeAutomationAiFunction({
      settings,
      functionKey: 'image_regeneration',
      prompt: `Enhance the uploaded product image for criterion "${params.row.label}".

Product context:
${aiContextSummary || 'No extra product context provided.'}

Source image URL:
${sourceUrl}

STRICT requirements:
- Keep the exact same product identity, shape, pattern, and styling.
- Keep composition and viewpoint as close as possible.
- Do NOT replace with a different product, model, or scene.
- Only improve quality (sharpness, exposure, color balance, cleanup) or regenerate the same image faithfully.

Return STRICT JSON only:
{"imageUrl":"https://...","changeType":"ENHANCEMENT_OR_EXACT_REGEN","reason":"short reason"}`,
      systemPrompt: 'You are an e-commerce image regeneration assistant.',
    });
    if (execution.status !== 'OK') {
      return {
        applied: false,
        before: sourceUrl,
        after: sourceUrl,
        reason:
          execution.status === 'NO_PROVIDER'
            ? execution.reason
            : `AI image regeneration failed: ${execution.reason}`,
      };
    }
    const output = String(execution.output || '').trim();
    const parsed = parseFirstJsonObject(output);
    const urlCandidate =
      String(parsed?.url || parsed?.imageUrl || '').trim() ||
      (() => {
        const match = output.match(/https?:\/\/[^\s"'<>]+/i);
        return match ? String(match[0]).trim() : '';
      })();
    if (!urlCandidate || !/^https?:\/\//i.test(urlCandidate)) {
      return {
        applied: false,
        before: sourceUrl,
        after: sourceUrl,
        reason: 'AI did not return a valid regenerated image URL.',
      };
    }
    const candidateIsSameUrl = urlCandidate === sourceUrl;
    const parseBool = (value: unknown) => {
      if (typeof value === 'boolean') return value;
      const text = String(value || '').trim().toLowerCase();
      if (text === 'true' || text === 'yes' || text === '1') return true;
      if (text === 'false' || text === 'no' || text === '0') return false;
      return null;
    };
    const verification = await executeAutomationAiFunction({
      settings,
      functionKey: 'image_verification',
      prompt: `Verify if candidate image is an enhancement or exact regeneration of the source product image.

Source image URL:
${sourceUrl}

Candidate image URL:
${urlCandidate}

Product context:
${aiContextSummary || 'No extra product context provided.'}

Return STRICT JSON only:
{
  "sameProduct": true,
  "sameSubject": true,
  "sameDesignPattern": true,
  "isOnlyEnhancement": true,
  "confidence": 0.0,
  "reason": "short reason"
}
Rules:
- Mark false if candidate appears to be a different product/model/scene.
- Mark false if major visual identity changed.`,
      systemPrompt: 'You are a strict e-commerce image consistency verifier. Return strict JSON only.',
    });
    if (verification.status !== 'OK') {
      return {
        applied: false,
        before: sourceUrl,
        after: sourceUrl,
        reason:
          verification.status === 'NO_PROVIDER'
            ? `Image consistency verification unavailable: ${verification.reason}`
            : `Image consistency verification failed: ${verification.reason}`,
      };
    }
    const verificationOutput = String(verification.output || '').trim();
    const verificationParsed = parseFirstJsonObject(verificationOutput);
    let sameProduct = parseBool(verificationParsed?.sameProduct);
    let sameSubject = parseBool(verificationParsed?.sameSubject);
    let sameDesignPattern = parseBool(verificationParsed?.sameDesignPattern);
    let onlyEnhancement = parseBool(verificationParsed?.isOnlyEnhancement);
    const confidence = Number(verificationParsed?.confidence ?? Number.NaN);
    if (
      sameProduct === null &&
      sameSubject === null &&
      sameDesignPattern === null &&
      onlyEnhancement === null &&
      verificationOutput
    ) {
      const text = verificationOutput.toLowerCase();
      const reject =
        /different product|not same|different scene|different model|identity changed|replacement/i.test(text);
      const accept =
        /same product|same subject|preserved|enhancement|exact regeneration|faithful|consistent/i.test(text);
      if (!reject && accept) {
        sameProduct = true;
        sameSubject = true;
        sameDesignPattern = true;
        onlyEnhancement = true;
      }
    }
    const isSafe =
      sameProduct === true &&
      sameSubject === true &&
      sameDesignPattern !== false &&
      onlyEnhancement === true &&
      (Number.isFinite(confidence) ? confidence >= 0.7 : true);
    if (!isSafe) {
      const verifyReason =
        String(verificationParsed?.reason || '').trim() ||
        'Candidate image was not verified as enhancement/exact regeneration of the source image.';
      return {
        applied: false,
        before: sourceUrl,
        after: sourceUrl,
        reason: `Rejected image replacement: ${verifyReason}`,
      };
    }
    if (!candidateIsSameUrl) {
      const nextImages = [...existingImages];
      nextImages[0] = urlCandidate;
      stagedImageUrls = nextImages;
    }
    return {
      applied: true,
      before: sourceUrl,
      after: urlCandidate,
      reason: candidateIsSameUrl
        ? 'AI enhancement verified on the same source image URL (in-place enhancement).'
        : 'AI applied enhancement/exact regeneration and passed strict image consistency verification.',
    };
  };

  const applyAiExecution = async () => {
    const enhanced: AutomationCheckReportRow[] = [];
    const pendingUpdates: Record<string, string> = {};
    let hasPendingImageUpdate = false;
    const strictEditKeys = new Set([
      'name_grammar',
      'description_grammar',
      'image_quality',
      'predominant_color_match',
    ]);
    const imageEditKeys = new Set(['image_quality', 'predominant_color_match']);
    for (const row of report) {
      const criterion = criteria.find((entry) => entry.key === row.key);
      if (!criterion || !criterion.requiresAi || row.status === 'SKIPPED') {
        enhanced.push(row);
        continue;
      }
      const functionKey = CRITERION_AI_FUNCTION_MAP[row.key] || 'text_grammar_enhancement';
      const prompt = `Automation criterion: ${row.label}

Current check status: ${row.status}
Current check message: ${row.message}

Product context:
${aiContextSummary || 'No extra product context provided.'}

Return concise analysis and correction guidance in plain text.`;
      const execution = await executeAutomationAiFunction({
        settings,
        functionKey,
        prompt,
        systemPrompt:
          'You are an e-commerce quality automation evaluator. Return concise actionable analysis only.',
      });
      let nextRow: AutomationCheckReportRow;
      if (execution.status === 'NO_PROVIDER') {
        nextRow = {
          ...row,
          status: 'NEEDS_AI',
          message: `AI provider missing: ${execution.reason}`,
        };
      } else if (execution.status === 'ERROR') {
        if (row.key === 'image_quality') {
          const regenerate = await executeAutomationAiFunction({
            settings,
            functionKey: 'image_regeneration',
            prompt: `Enhance product image quality while preserving exact original product identity, composition, and styling. Do not replace with a different product. Context: ${aiContextSummary}`,
            systemPrompt:
              'You are an image regeneration assistant for e-commerce catalog quality improvement.',
          });
          if (regenerate.status === 'OK') {
            nextRow = {
              ...row,
              status: row.status === 'FAIL' ? 'FAIL' : 'PASS',
              message: `${row.message} AI regeneration fallback: ${regenerate.output}`,
            };
          } else {
            nextRow = {
              ...row,
              status: 'FAIL',
              message: `${row.message} AI execution error: ${execution.reason}`,
            };
          }
        } else {
          nextRow = {
            ...row,
            status: 'FAIL',
            message: `${row.message} AI execution error: ${execution.reason}`,
          };
        }
      } else if (row.status === 'FAIL') {
        nextRow = {
          ...row,
          status: 'FAIL',
          message: `${row.message} AI guidance: ${execution.output}`,
        };
      } else {
        nextRow = {
          ...row,
          status: 'PASS',
          message: `${row.message} AI verification: ${execution.output}`,
        };
      }
      const canApplyAiEdits = criterion.allowAiEdits === true && criterion.requiresAi === true;
      if (!canApplyAiEdits && nextRow.status === 'FAIL') {
        const mappedRule = resolveCriterionEditRule(row.key);
        const isImageMapped = imageEditKeys.has(row.key);
        if (mappedRule || isImageMapped) {
          nextRow = {
            ...nextRow,
            message: `${nextRow.message} Auto-edit not applied because "Allow AI edits" is disabled for this criterion.`,
          };
        }
      }
      if (canApplyAiEdits) {
        const textRule = resolveCriterionEditRule(row.key);
        const shouldAttemptTextEdit =
          Boolean(textRule) &&
          Boolean(persistStagedProductEdits) &&
          nextRow.status === 'FAIL';
        if (shouldAttemptTextEdit) {
          const editResult = await requestAiFieldEdit({ row: nextRow });
          if (editResult && textRule) {
            if (editResult.applied) {
              pendingUpdates[textRule.field] = editResult.after;
              stagedProductFields[textRule.field] = editResult.after;
              nextRow = {
                ...nextRow,
                status: 'PASS',
                message: `${nextRow.message} AI auto-edit applied to ${textRule.field}.`,
              };
              changeReport.push({
                key: row.key,
                label: row.label,
                field: textRule.field,
                beforeValue: editResult.before,
                afterValue: editResult.after,
                status: 'APPLIED',
                reason: editResult.reason,
              });
            } else {
              const strictFailed = strictEditKeys.has(row.key);
              if (strictFailed) {
                nextRow = {
                  ...nextRow,
                  status: 'FAIL',
                  message: `${nextRow.message} Strict AI edit required for ${textRule.field}: ${editResult.reason}`,
                };
              }
              changeReport.push({
                key: row.key,
                label: row.label,
                field: textRule.field,
                beforeValue: editResult.before,
                afterValue: editResult.after,
                status: 'SKIPPED',
                reason: editResult.reason,
              });
            }
          }
        }

        const shouldAttemptImageEdit =
          imageEditKeys.has(row.key) &&
          Boolean(persistStagedImageEdits) &&
          nextRow.status === 'FAIL';
        if (shouldAttemptImageEdit) {
          const imageResult = await requestAiImageEdit({ row: nextRow });
          if (imageResult.applied) {
            hasPendingImageUpdate = true;
            nextRow = {
              ...nextRow,
              status: 'PASS',
              message: `${nextRow.message} AI auto-edit applied to primary image.`,
            };
            changeReport.push({
              key: row.key,
              label: row.label,
              field: 'images[0]',
              beforeValue: imageResult.before,
              afterValue: imageResult.after,
              status: 'APPLIED',
              reason: imageResult.reason,
            });
          } else {
            if (strictEditKeys.has(row.key)) {
              nextRow = {
                ...nextRow,
                status: 'FAIL',
                message: `${nextRow.message} Strict AI edit required for images: ${imageResult.reason}`,
              };
            }
            changeReport.push({
              key: row.key,
              label: row.label,
              field: 'images[0]',
              beforeValue: imageResult.before,
              afterValue: imageResult.after,
              status: 'SKIPPED',
              reason: imageResult.reason,
            });
          }
        }
      }
      enhanced.push(nextRow);
    }
    if (persistStagedProductEdits && Object.keys(pendingUpdates).length > 0) {
      await persistStagedProductEdits(pendingUpdates);
    }
    if (persistStagedImageEdits && hasPendingImageUpdate) {
      await persistStagedImageEdits(readStagedImageUrls());
    }
    return enhanced;
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
        changeReport: [] as AutomationAppliedChange[],
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
    stagedProductFields.name = String(product.name || '').trim();
    stagedProductFields.description = String(product.description || '').trim();
    stagedProductFields.finalPrice = String(Number(product.finalPrice || 0));
    stagedProductFields.minYards = String(Number(product.minYards || 0));
    stagedProductFields.stockYards = String(Number(product.stockYards || 0));
    const existingFabricImages = [...product.images].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    stagedImageUrls = existingFabricImages.map((entry) => String(entry.url || '').trim()).filter(Boolean);
    persistStagedProductEdits = async (updates) => {
      const payload: Record<string, unknown> = {};
      if (typeof updates.name === 'string') payload.name = updates.name;
      if (typeof updates.description === 'string') payload.description = updates.description;
      if (typeof updates.finalPrice === 'string' && Number.isFinite(Number(updates.finalPrice))) {
        payload.finalPrice = Number(updates.finalPrice);
      }
      if (typeof updates.minYards === 'string' && Number.isFinite(Number(updates.minYards))) {
        payload.minYards = Number(updates.minYards);
      }
      if (typeof updates.stockYards === 'string' && Number.isFinite(Number(updates.stockYards))) {
        payload.stockYards = Number(updates.stockYards);
      }
      if (Object.keys(payload).length === 0) return;
      await prisma.fabric.update({
        where: { id: product.id },
        data: payload as any,
      });
    };
    persistStagedImageEdits = async (urls) => {
      const cleanUrls = urls.map((entry) => String(entry || '').trim()).filter(Boolean);
      if (cleanUrls.length === 0) return;
      await prisma.$transaction([
        prisma.fabricImage.deleteMany({ where: { fabricId: product.id } }),
        prisma.fabricImage.createMany({
          data: cleanUrls.map((url, idx) => ({
            fabricId: product.id,
            url,
            alt: existingFabricImages[idx]?.alt || null,
            sortOrder: idx,
          })),
        }),
      ]);
    };
    aiContextSummary = JSON.stringify({
      productType: 'FABRIC',
      id: product.id,
      name: product.name,
      materialType: product.materialType?.name || null,
      finalPrice: Number(product.finalPrice || 0),
      minYards: Number(product.minYards || 0),
      stockYards: Number(product.stockYards || 0),
      imageCount: product.images.length,
    });
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
        changeReport: [] as AutomationAppliedChange[],
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
    stagedProductFields.name = String(product.name || '').trim();
    stagedProductFields.description = String(product.description || '').trim();
    stagedProductFields.basePrice = String(Number(product.basePrice || 0));
    const existingReadyToWearImages = [...product.images].sort(
      (a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)
    );
    stagedImageUrls = existingReadyToWearImages.map((entry) => String(entry.url || '').trim()).filter(Boolean);
    persistStagedProductEdits = async (updates) => {
      const payload: Record<string, unknown> = {};
      if (typeof updates.name === 'string') payload.name = updates.name;
      if (typeof updates.description === 'string') payload.description = updates.description;
      if (typeof updates.basePrice === 'string' && Number.isFinite(Number(updates.basePrice))) {
        payload.basePrice = Number(updates.basePrice);
      }
      if (Object.keys(payload).length === 0) return;
      await prisma.readyToWear.update({
        where: { id: product.id },
        data: payload as any,
      });
    };
    persistStagedImageEdits = async (urls) => {
      const cleanUrls = urls.map((entry) => String(entry || '').trim()).filter(Boolean);
      if (cleanUrls.length === 0) return;
      await prisma.$transaction([
        prisma.readyToWearImage.deleteMany({ where: { readyToWearId: product.id } }),
        prisma.readyToWearImage.createMany({
          data: cleanUrls.map((url, idx) => ({
            readyToWearId: product.id,
            url,
            alt: existingReadyToWearImages[idx]?.alt || null,
            sortOrder: idx,
          })),
        }),
      ]);
    };
    aiContextSummary = JSON.stringify({
      productType: 'READY_TO_WEAR',
      id: product.id,
      name: product.name,
      category: product.category?.name || null,
      basePrice: Number(product.basePrice || 0),
      variants: product.sizeVariations.length,
      imageCount: product.images.length,
    });
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
        changeReport: [] as AutomationAppliedChange[],
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
    stagedProductFields.name = String(product.name || '').trim();
    stagedProductFields.description = String(product.description || '').trim();
    stagedProductFields.basePrice = String(Number(product.basePrice || 0));
    const existingDesignImages = [...product.images].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    stagedImageUrls = existingDesignImages.map((entry) => String(entry.url || '').trim()).filter(Boolean);
    persistStagedProductEdits = async (updates) => {
      const payload: Record<string, unknown> = {};
      if (typeof updates.name === 'string') payload.name = updates.name;
      if (typeof updates.description === 'string') payload.description = updates.description;
      if (typeof updates.basePrice === 'string' && Number.isFinite(Number(updates.basePrice))) {
        payload.basePrice = Number(updates.basePrice);
      }
      if (Object.keys(payload).length === 0) return;
      await prisma.design.update({
        where: { id: product.id },
        data: payload as any,
      });
    };
    persistStagedImageEdits = async (urls) => {
      const cleanUrls = urls.map((entry) => String(entry || '').trim()).filter(Boolean);
      if (cleanUrls.length === 0) return;
      await prisma.$transaction([
        prisma.designImage.deleteMany({ where: { designId: product.id } }),
        prisma.designImage.createMany({
          data: cleanUrls.map((url, idx) => ({
            designId: product.id,
            url,
            alt: existingDesignImages[idx]?.alt || null,
            sortOrder: idx,
          })),
        }),
      ]);
    };
    aiContextSummary = JSON.stringify({
      productType: 'DESIGN',
      id: product.id,
      name: product.name,
      category: product.category?.name || null,
      basePrice: Number(product.basePrice || 0),
      suitableFabrics: product.suitableFabrics.length,
      requiredMeasurements: product.measurementVariables.filter((row) => row.isRequired !== false).length,
      imageCount: product.images.length,
    });
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

  const seenKeys = new Set(report.map((entry) => entry.key));
  for (const criterion of criteria) {
    if (seenKeys.has(criterion.key)) continue;
    report.push({
      key: criterion.key,
      label: criterion.label || criterion.key,
      status: 'SKIPPED',
      message: 'Custom criterion configured; add executor logic to enforce automatically.',
    });
  }

  const enhancedReport = await applyAiExecution();
  const requiredRows = enhancedReport.filter((entry) => {
    const criterion = criteria.find((item) => item.key === entry.key);
    return criterion ? criterion.enabled !== false : true;
  });
  const canAutoApprove = requiredRows.length > 0 && requiredRows.every((entry) => entry.status === 'PASS');
  return {
    canAutoApprove,
    status: canAutoApprove ? ('PASS' as const) : ('REVIEW_REQUIRED' as const),
    report: enhancedReport,
    changeReport,
  };
};

export const evaluateAccountAutomationChecks = async (input: {
  userId: string;
  role?: string | null;
  settingsOverride?: AutomationApprovalSettings;
}) => {
  const settings = input.settingsOverride || (await readAutomationApprovalSettings()).settings;
  const criteria = settings.criteria.ACCOUNT_APPROVAL || [];
  if (!settings.enabled) {
    return {
      canAutoApprove: false,
      status: 'AUTOMATION_DISABLED' as const,
      report: [
        {
          key: 'automation_disabled',
          label: 'Automation is disabled',
          status: 'SKIPPED' as const,
          message: 'Enable automation in settings to run account approval checks.',
        },
      ] as AutomationCheckReportRow[],
    };
  }
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    include: {
      fabricSellerProfile: true,
      designerProfile: true,
    },
  });
  if (!user) {
    return {
      canAutoApprove: false,
      status: 'ACCOUNT_NOT_FOUND' as const,
      report: [
        {
          key: 'account_exists',
          label: 'Account must exist',
          status: 'FAIL' as const,
          message: 'User account was not found.',
        },
      ],
    };
  }
  const report: AutomationCheckReportRow[] = [];
  const addResult = (row: AutomationCheckReportRow) => {
    const criterion = criteria.find((entry) => entry.key === row.key);
    if (criterion && !criterion.enabled) {
      report.push({ ...row, status: 'SKIPPED', message: 'Disabled by admin automation settings.' });
      return;
    }
    report.push(row);
  };
  const identityComplete =
    String(user.firstName || '').trim().length > 1 &&
    String(user.lastName || '').trim().length > 1 &&
    String(user.email || '').trim().length > 3;
  addResult({
    key: 'identity_fields_complete',
    label: 'Validate required account identity fields',
    status: identityComplete ? 'PASS' : 'FAIL',
    message: identityComplete ? 'Identity fields are complete.' : 'Missing first name, last name, or email.',
  });
  const contactComplete = String(user.phone || '').trim().length >= 5;
  addResult({
    key: 'contact_fields_complete',
    label: 'Validate required contact fields',
    status: contactComplete ? 'PASS' : 'FAIL',
    message: contactComplete ? 'Contact fields are complete.' : 'Phone number is missing or too short.',
  });
  const normalizedRole = String(input.role || user.role || '').toUpperCase();
  const vendorMinimumOk =
    normalizedRole === 'FABRIC_SELLER'
      ? Boolean(user.fabricSellerProfile?.businessName && user.fabricSellerProfile?.country && user.fabricSellerProfile?.city)
      : normalizedRole === 'FASHION_DESIGNER'
        ? Boolean(user.designerProfile?.businessName && user.designerProfile?.country && user.designerProfile?.city)
        : true;
  addResult({
    key: 'vendor_profile_minimum',
    label: 'Validate vendor profile minimum requirements',
    status: vendorMinimumOk ? 'PASS' : 'FAIL',
    message: vendorMinimumOk ? 'Vendor minimum fields check passed.' : 'Vendor profile is missing minimum fields.',
  });
  const aiCriterion = criteria.find((entry) => entry.key === 'account_notes_grammar' && entry.enabled && entry.requiresAi);
  if (aiCriterion) {
    const execution = await executeAutomationAiFunction({
      settings,
      functionKey: 'text_grammar_enhancement',
      prompt: `Validate and improve this account summary grammar:\nRole: ${normalizedRole}\nName: ${user.firstName} ${user.lastName}\nEmail: ${user.email}\nPhone: ${user.phone || 'N/A'}`,
      systemPrompt: 'You are reviewing account-approval summary grammar for an e-commerce admin.',
    });
    if (execution.status === 'OK') {
      addResult({
        key: 'account_notes_grammar',
        label: 'AI grammar check for account notes/description',
        status: 'PASS',
        message: execution.output,
      });
    } else if (execution.status === 'NO_PROVIDER') {
      addResult({
        key: 'account_notes_grammar',
        label: 'AI grammar check for account notes/description',
        status: 'NEEDS_AI',
        message: execution.reason,
      });
    } else {
      addResult({
        key: 'account_notes_grammar',
        label: 'AI grammar check for account notes/description',
        status: 'FAIL',
        message: execution.reason,
      });
    }
  }
  const seenKeys = new Set(report.map((entry) => entry.key));
  for (const criterion of criteria) {
    if (seenKeys.has(criterion.key)) continue;
    report.push({
      key: criterion.key,
      label: criterion.label || criterion.key,
      status: 'SKIPPED',
      message: 'Custom criterion configured; add executor logic to enforce automatically.',
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
