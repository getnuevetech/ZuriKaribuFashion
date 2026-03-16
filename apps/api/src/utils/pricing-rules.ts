import { prisma, type PricingRule } from '../db';

export type PricingProductType = 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';

type ActivePricingRule = Pick<
  PricingRule,
  'id' | 'ruleType' | 'productType' | 'country' | 'adjustmentType' | 'value' | 'priority' | 'isSale'
>;

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

const countryMatches = (ruleCountry: unknown, contextCountry: unknown) => {
  const ruleRaw = String(ruleCountry || '').trim();
  if (!ruleRaw) return true;
  const contextRaw = String(contextCountry || '').trim();
  if (!contextRaw) return false;
  if (ruleRaw.localeCompare(contextRaw, undefined, { sensitivity: 'accent' }) === 0) return true;
  const normalizedRule = normalizeCountryToken(ruleRaw);
  const normalizedContext = normalizeCountryToken(contextRaw);
  if (!normalizedRule || !normalizedContext) return false;
  return normalizedRule === normalizedContext;
};

export async function readActivePricingRules(now = new Date()): Promise<ActivePricingRule[]> {
  const rows = await prisma.pricingRule.findMany({
    where: {
      isActive: true,
      AND: [{ OR: [{ startDate: null }, { startDate: { lte: now } }] }, { OR: [{ endDate: null }, { endDate: { gte: now } }] }],
    },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      ruleType: true,
      productType: true,
      country: true,
      adjustmentType: true,
      value: true,
      priority: true,
      isSale: true,
    },
  });
  return rows;
}

const ruleApplies = (
  rule: ActivePricingRule,
  context: { productType: PricingProductType; country?: string | null }
) => {
  const ruleType = String(rule.ruleType || '').toUpperCase();
  const ruleProductType = String(rule.productType || '').toUpperCase();
  if (ruleProductType && ruleProductType !== context.productType) return false;
  if (rule.country && !countryMatches(rule.country, context.country || '')) return false;
  if (ruleType === 'GLOBAL_MARKUP') return true;
  if (ruleType === 'CATEGORY_MARKUP') return true;
  if (ruleType === 'COUNTRY_MARKUP') return countryMatches(rule.country, context.country || '');
  if (ruleType === 'DATE_BASED') return true;
  return true;
};

const applyRuleAdjustment = (amount: number, rule: ActivePricingRule) => {
  const value = Number(rule.value || 0);
  if (!Number.isFinite(value) || value <= 0) return amount;
  const adjustment = String(rule.adjustmentType || '').toUpperCase();
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
    const adjustment = String(rule.adjustmentType || '').toUpperCase();
    return Boolean(rule.isSale) || adjustment === 'PERCENTAGE_DISCOUNT' || adjustment === 'FIXED_DISCOUNT';
  });
}
