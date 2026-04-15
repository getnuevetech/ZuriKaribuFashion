import { prisma, type PricingRule } from '../db';

export type PricingProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
export type PricingScope = 'CATALOG' | 'CHECKOUT';

export type ActivePricingRule = Pick<
  PricingRule,
  'id' | 'name' | 'description' | 'ruleType' | 'productType' | 'country' | 'adjustmentType' | 'value' | 'priority' | 'isSale'
>;

const CHECKOUT_PRICING_SCOPE_TAG = '[CHECKOUT_PRICING]';
const CATALOG_PRICING_SCOPE_TAG = '[CATALOG_PRICING]';
const PRICING_SCOPE_TAG_PATTERN = /\[(CHECKOUT_PRICING|CATALOG_PRICING)\]/gi;

const normalizeScopeToken = (value: unknown): PricingScope => {
  const token = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  return token === 'CHECKOUT' || token === 'CHECKOUT_PRICING' ? 'CHECKOUT' : 'CATALOG';
};

const containsScopeTag = (description: unknown, scope: PricingScope) => {
  const normalized = String(description || '').toUpperCase();
  return scope === 'CHECKOUT'
    ? normalized.includes(CHECKOUT_PRICING_SCOPE_TAG)
    : normalized.includes(CATALOG_PRICING_SCOPE_TAG);
};

const resolveRuleScope = (description: unknown): PricingScope =>
  containsScopeTag(description, 'CHECKOUT') ? 'CHECKOUT' : 'CATALOG';

export const stripPricingScopeTag = (description: unknown) =>
  String(description || '')
    .replace(PRICING_SCOPE_TAG_PATTERN, '')
    .trim();

export const normalizePricingRuleDescriptionForScope = (description: unknown, scopeInput?: unknown) => {
  const scope = normalizeScopeToken(scopeInput);
  const base = stripPricingScopeTag(description);
  if (scope === 'CHECKOUT') {
    return `${CHECKOUT_PRICING_SCOPE_TAG} ${base}`.trim();
  }
  return base;
};

export const readPricingScopeFromDescription = (description: unknown): PricingScope => resolveRuleScope(description);

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  algeria: 'DZ',
  angola: 'AO',
  benin: 'BJ',
  botswana: 'BW',
  'burkina faso': 'BF',
  burundi: 'BI',
  'cabo verde': 'CV',
  cameroon: 'CM',
  'central african republic': 'CF',
  chad: 'TD',
  comoros: 'KM',
  congo: 'CG',
  'democratic republic of the congo': 'CD',
  'dr congo': 'CD',
  "cote d'ivoire": 'CI',
  "côte d'ivoire": 'CI',
  djibouti: 'DJ',
  egypt: 'EG',
  'equatorial guinea': 'GQ',
  eritrea: 'ER',
  eswatini: 'SZ',
  ethiopia: 'ET',
  gabon: 'GA',
  gambia: 'GM',
  ghana: 'GH',
  guinea: 'GN',
  'guinea-bissau': 'GW',
  kenya: 'KE',
  lesotho: 'LS',
  liberia: 'LR',
  libya: 'LY',
  madagascar: 'MG',
  malawi: 'MW',
  mali: 'ML',
  mauritania: 'MR',
  mauritius: 'MU',
  morocco: 'MA',
  mozambique: 'MZ',
  namibia: 'NA',
  niger: 'NE',
  nigeria: 'NG',
  rwanda: 'RW',
  senegal: 'SN',
  seychelles: 'SC',
  'sierra leone': 'SL',
  somalia: 'SO',
  'south africa': 'ZA',
  'south sudan': 'SS',
  sudan: 'SD',
  tanzania: 'TZ',
  togo: 'TG',
  tunisia: 'TN',
  uganda: 'UG',
  zambia: 'ZM',
  zimbabwe: 'ZW',
  'united states': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  uk: 'GB',
};

const normalizeProductTypeToken = (value: unknown): PricingProductType | '' => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!token) return '';
  if (token === 'FABRIC' || token === 'FTB' || token === 'FABRIC_TO_BUY') return 'FABRIC';
  if (
    token === 'DESIGN' ||
    token === 'CTW' ||
    token === 'CUSTOM_TO_WEAR' ||
    token === 'CUSTOMTOWEAR' ||
    token === 'CUSTOM_TO_WEAR_DESIGN'
  ) {
    return 'DESIGN';
  }
  if (
    token === 'READY_TO_WEAR' ||
    token === 'READYTOWEAR' ||
    token === 'RTW' ||
    token === 'READY_TO_BUY' ||
    token === 'READYTOBUY'
  ) {
    return 'READY_TO_WEAR';
  }
  return '';
};

const normalizeRuleTypeToken = (
  value: unknown
): 'GLOBAL_MARKUP' | 'CATEGORY_MARKUP' | 'COUNTRY_MARKUP' | 'DATE_BASED' | '' => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!token) return '';
  if (token === 'GLOBAL' || token === 'GLOBAL_MARKUP') return 'GLOBAL_MARKUP';
  if (token === 'CATEGORY' || token === 'PRODUCT' || token === 'CATEGORY_MARKUP') return 'CATEGORY_MARKUP';
  if (token === 'COUNTRY' || token === 'COUNTRY_MARKUP') return 'COUNTRY_MARKUP';
  if (token === 'DATE' || token === 'DATE_BASED' || token === 'DATE_RANGE') return 'DATE_BASED';
  return '';
};

const normalizeAdjustmentToken = (
  value: unknown
): 'PERCENTAGE_MARKUP' | 'PERCENTAGE_DISCOUNT' | 'FIXED_MARKUP' | 'FIXED_DISCOUNT' | '' => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (!token) return '';
  if (token === 'PERCENTAGE_MARKUP' || token === 'PERCENT_MARKUP') return 'PERCENTAGE_MARKUP';
  if (token === 'PERCENTAGE_DISCOUNT' || token === 'PERCENT_DISCOUNT' || token === 'PERCENTAGE_MARKDOWN') {
    return 'PERCENTAGE_DISCOUNT';
  }
  if (token === 'FIXED_MARKUP') return 'FIXED_MARKUP';
  if (token === 'FIXED_DISCOUNT' || token === 'FIXED_MARKDOWN') return 'FIXED_DISCOUNT';
  return '';
};

const normalizeCountryToken = (value: unknown) => {
  const raw = String(value || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const collapsed = raw.replace(/\s+/g, ' ');
  const mappedCode = COUNTRY_NAME_TO_CODE[collapsed];
  if (mappedCode) return mappedCode;
  return collapsed.toUpperCase().replace(/[^A-Z0-9]+/g, '');
};

const parseCountryTokenList = (value: unknown) =>
  String(value || '')
    .split(/[,\n;|/]+/g)
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

const countryMatches = (
  ruleCountry: unknown,
  contextCountry: unknown,
  options?: { allowEmptyRuleCountry?: boolean }
) => {
  const allowEmptyRuleCountry = options?.allowEmptyRuleCountry !== false;
  const ruleTokens = parseCountryTokenList(ruleCountry);
  if (ruleTokens.length === 0) return allowEmptyRuleCountry;
  const contextRaw = String(contextCountry || '').trim();
  if (!contextRaw) return false;
  const normalizedContext = normalizeCountryToken(contextRaw);
  if (!normalizedContext) return false;
  return ruleTokens.some((ruleRaw) => {
    if (ruleRaw.localeCompare(contextRaw, undefined, { sensitivity: 'accent' }) === 0) return true;
    const normalizedRule = normalizeCountryToken(ruleRaw);
    return Boolean(normalizedRule) && normalizedRule === normalizedContext;
  });
};

export async function readActivePricingRules(now = new Date(), scopeInput: PricingScope | string = 'CATALOG'): Promise<ActivePricingRule[]> {
  const scope = normalizeScopeToken(scopeInput);
  const rows = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      AND: [{ OR: [{ startDate: null }, { startDate: { lte: now } }] }, { OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      description: true,
      ruleType: true,
      productType: true,
      country: true,
      adjustmentType: true,
      value: true,
      priority: true,
      isSale: true,
    },
  });
  return rows
    .filter((row) => resolveRuleScope(row.description) === scope)
    .map((row) => ({
      ...row,
      description: stripPricingScopeTag(row.description),
    }));
}

const ruleApplies = (
  rule: ActivePricingRule,
  context: { productType: PricingProductType; country?: string | null }
) => {
  const ruleType = normalizeRuleTypeToken(rule.ruleType);
  const ruleProductType = normalizeProductTypeToken(rule.productType);
  const contextProductType = normalizeProductTypeToken(context.productType);
  if (!ruleType || !contextProductType) return false;
  if (ruleProductType && ruleProductType !== contextProductType) return false;

  if (ruleType === 'GLOBAL_MARKUP') {
    return countryMatches(rule.country, context.country || '', { allowEmptyRuleCountry: true });
  }
  if (ruleType === 'CATEGORY_MARKUP') {
    // Legacy compatibility: treat missing productType category-rules as broad rules.
    return countryMatches(rule.country, context.country || '', { allowEmptyRuleCountry: true });
  }
  if (ruleType === 'COUNTRY_MARKUP') {
    return countryMatches(rule.country, context.country || '', { allowEmptyRuleCountry: false });
  }
  if (ruleType === 'DATE_BASED') {
    return countryMatches(rule.country, context.country || '', { allowEmptyRuleCountry: true });
  }
  return false;
};

const applyRuleAdjustment = (amount: number, rule: ActivePricingRule) => {
  const value = Number(rule.value || 0);
  if (!Number.isFinite(value) || value <= 0) return amount;
  const adjustment = normalizeAdjustmentToken(rule.adjustmentType);
  if (adjustment === 'PERCENTAGE_MARKUP') return amount * (1 + value / 100);
  if (adjustment === 'FIXED_MARKUP') return amount + value;
  if (adjustment === 'PERCENTAGE_DISCOUNT') return amount * (1 - value / 100);
  if (adjustment === 'FIXED_DISCOUNT') return amount - value;
  return amount;
};

export function applyActivePricingRules(
  basePriceUsd: number,
  context: { productType: PricingProductType; country?: string | null },
  rules: ActivePricingRule[]
) {
  const base = Number(basePriceUsd || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  const scoped = rules.filter((rule) => ruleApplies(rule, context));
  const adjusted = scoped.reduce((running, rule) => applyRuleAdjustment(running, rule), base);
  return Number(Math.max(0, adjusted).toFixed(2));
}

export function hasActiveMarkdownPricingRule(
  rules: ActivePricingRule[],
  context: { productType: PricingProductType; country?: string | null }
) {
  return rules.some((rule) => {
    if (!ruleApplies(rule, context)) return false;
    const adjustment = normalizeAdjustmentToken(rule.adjustmentType);
    return Boolean(rule.isSale) || adjustment === 'PERCENTAGE_DISCOUNT' || adjustment === 'FIXED_DISCOUNT';
  });
}

export function applyActivePricingRulesWithBreakdown(
  basePriceUsd: number,
  context: { productType: PricingProductType; country?: string | null },
  rules: ActivePricingRule[]
) {
  const base = Number(basePriceUsd || 0);
  if (!Number.isFinite(base) || base <= 0) {
    return {
      finalPriceUsd: 0,
      appliedRules: [] as Array<{
        ruleId: string;
        ruleName: string;
        adjustmentType: string;
        value: number;
        beforeUsd: number;
        afterUsd: number;
        amountUsd: number;
      }>,
    };
  }
  const scoped = rules.filter((rule) => ruleApplies(rule, context));
  let running = Number(base.toFixed(2));
  const appliedRules: Array<{
    ruleId: string;
    ruleName: string;
    adjustmentType: string;
    value: number;
    beforeUsd: number;
    afterUsd: number;
    amountUsd: number;
  }> = [];
  for (const rule of scoped) {
    const before = running;
    const adjusted = applyRuleAdjustment(before, rule);
    const after = Number(Math.max(0, adjusted).toFixed(2));
    const amount = Number((after - before).toFixed(2));
    if (Math.abs(amount) <= 0) {
      running = after;
      continue;
    }
    appliedRules.push({
      ruleId: String(rule.id),
      ruleName: String(rule.name || 'Pricing rule'),
      adjustmentType: String(rule.adjustmentType || ''),
      value: Number(rule.value || 0),
      beforeUsd: before,
      afterUsd: after,
      amountUsd: amount,
    });
    running = after;
  }
  return {
    finalPriceUsd: Number(Math.max(0, running).toFixed(2)),
    appliedRules,
  };
}
