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
  const binding = settings.functionBindings.find(
    (entry) => entry.isActive !== false && String(entry.functionKey || '').trim() === functionKey
  );
  if (!binding?.providerId) return null;
  const provider = settings.aiProviders.find(
    (entry) => entry.isActive !== false && String(entry.id || '').trim() === String(binding.providerId || '').trim()
  );
  if (!provider) return null;
  if (!String(provider.baseUrl || '').trim() || !String(provider.apiKey || '').trim()) return null;
  return provider;
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
  const provider = resolveProviderForFunction(params.settings, params.functionKey);
  if (!provider) {
    return {
      status: 'NO_PROVIDER',
      reason: `No active provider binding for ${params.functionKey}.`,
    } as AiExecutionResult;
  }
  if (params.functionKey === 'image_regeneration') {
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
  const functionKey = String(input.functionKey || 'text_grammar_enhancement').trim();
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
      ...(settings.functionBindings || []).filter((entry) => entry.functionKey !== functionKey),
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

  const applyAiExecution = async () => {
    const enhanced: AutomationCheckReportRow[] = [];
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
      if (execution.status === 'NO_PROVIDER') {
        enhanced.push({
          ...row,
          status: 'NEEDS_AI',
          message: `AI provider missing: ${execution.reason}`,
        });
        continue;
      }
      if (execution.status === 'ERROR') {
        if (row.key === 'image_quality') {
          const regenerate = await executeAutomationAiFunction({
            settings,
            functionKey: 'image_regeneration',
            prompt: `Regenerate product images with improved quality and preserve original content. Context: ${aiContextSummary}`,
            systemPrompt:
              'You are an image regeneration assistant for e-commerce catalog quality improvement.',
          });
          if (regenerate.status === 'OK') {
            enhanced.push({
              ...row,
              status: row.status === 'FAIL' ? 'FAIL' : 'PASS',
              message: `${row.message} AI regeneration fallback: ${regenerate.output}`,
            });
            continue;
          }
        }
        enhanced.push({
          ...row,
          status: 'FAIL',
          message: `${row.message} AI execution error: ${execution.reason}`,
        });
        continue;
      }
      if (row.status === 'FAIL') {
        enhanced.push({
          ...row,
          status: 'FAIL',
          message: `${row.message} AI guidance: ${execution.output}`,
        });
        continue;
      }
      enhanced.push({
        ...row,
        status: 'PASS',
        message: `${row.message} AI verification: ${execution.output}`,
      });
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
  const hasFail = enhancedReport.some((entry) => entry.status === 'FAIL');
  const hasNeedsAi = enhancedReport.some((entry) => entry.status === 'NEEDS_AI');
  const canAutoApprove = !hasFail && (!settings.failOnNeedsAi || !hasNeedsAi);
  return {
    canAutoApprove,
    status: canAutoApprove ? ('PASS' as const) : ('REVIEW_REQUIRED' as const),
    report: enhancedReport,
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
