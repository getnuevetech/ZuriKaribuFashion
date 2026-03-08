import { prisma, UserRole } from '../db';
import { AFRICAN_CURRENCY_BASELINE, type AfricanCurrencyRow } from '../constants/africanCurrencies';

export type CurrencyScopeType = 'COUNTRY' | 'USER' | 'ROLE';

export interface CurrencyListingRule {
  id: string;
  scopeType: CurrencyScopeType;
  scopeValue: string;
  currencies: string[];
}

export interface CurrencyMatrixState {
  matrix: AfricanCurrencyRow[];
  rules: CurrencyListingRule[];
  meta: {
    lastRefreshedAt: string | null;
    lastSource: string | null;
  };
}

const MATRIX_ACTION = 'CURRENCY_MATRIX_UPDATED';
const RULES_ACTION = 'CURRENCY_OPTIONS_UPDATED';
const OVERRIDES_ACTION = 'CURRENCY_MATRIX_OVERRIDES_UPDATED';
const PRODUCT_CURRENCY_ACTION = 'PRODUCT_CURRENCY_METADATA';

const byCountryCode = new Map(AFRICAN_CURRENCY_BASELINE.map((row) => [row.countryCode.toUpperCase(), row]));
const byCountryName = new Map(AFRICAN_CURRENCY_BASELINE.map((row) => [normalizeCountry(row.country), row]));

const GLOBAL_VISITOR_CURRENCY_FALLBACK: AfricanCurrencyRow[] = [
  {
    countryCode: 'US',
    country: 'United States',
    currencyCode: 'USD',
    currencyName: 'US Dollar',
    usdPerUnit: 1,
  },
  {
    countryCode: 'GB',
    country: 'United Kingdom',
    currencyCode: 'GBP',
    currencyName: 'British Pound Sterling',
    usdPerUnit: 1.27,
  },
  {
    countryCode: 'CA',
    country: 'Canada',
    currencyCode: 'CAD',
    currencyName: 'Canadian Dollar',
    usdPerUnit: 0.74,
  },
  {
    countryCode: 'AU',
    country: 'Australia',
    currencyCode: 'AUD',
    currencyName: 'Australian Dollar',
    usdPerUnit: 0.66,
  },
  {
    countryCode: 'NZ',
    country: 'New Zealand',
    currencyCode: 'NZD',
    currencyName: 'New Zealand Dollar',
    usdPerUnit: 0.61,
  },
  {
    countryCode: 'DE',
    country: 'Germany',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    usdPerUnit: 1.09,
  },
  {
    countryCode: 'FR',
    country: 'France',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    usdPerUnit: 1.09,
  },
  {
    countryCode: 'ES',
    country: 'Spain',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    usdPerUnit: 1.09,
  },
  {
    countryCode: 'IT',
    country: 'Italy',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    usdPerUnit: 1.09,
  },
  {
    countryCode: 'NL',
    country: 'Netherlands',
    currencyCode: 'EUR',
    currencyName: 'Euro',
    usdPerUnit: 1.09,
  },
  {
    countryCode: 'CH',
    country: 'Switzerland',
    currencyCode: 'CHF',
    currencyName: 'Swiss Franc',
    usdPerUnit: 1.13,
  },
  {
    countryCode: 'SE',
    country: 'Sweden',
    currencyCode: 'SEK',
    currencyName: 'Swedish Krona',
    usdPerUnit: 0.095,
  },
  {
    countryCode: 'NO',
    country: 'Norway',
    currencyCode: 'NOK',
    currencyName: 'Norwegian Krone',
    usdPerUnit: 0.094,
  },
  {
    countryCode: 'DK',
    country: 'Denmark',
    currencyCode: 'DKK',
    currencyName: 'Danish Krone',
    usdPerUnit: 0.146,
  },
  {
    countryCode: 'JP',
    country: 'Japan',
    currencyCode: 'JPY',
    currencyName: 'Japanese Yen',
    usdPerUnit: 0.0067,
  },
  {
    countryCode: 'CN',
    country: 'China',
    currencyCode: 'CNY',
    currencyName: 'Chinese Yuan',
    usdPerUnit: 0.14,
  },
  {
    countryCode: 'IN',
    country: 'India',
    currencyCode: 'INR',
    currencyName: 'Indian Rupee',
    usdPerUnit: 0.012,
  },
  {
    countryCode: 'SG',
    country: 'Singapore',
    currencyCode: 'SGD',
    currencyName: 'Singapore Dollar',
    usdPerUnit: 0.74,
  },
  {
    countryCode: 'AE',
    country: 'United Arab Emirates',
    currencyCode: 'AED',
    currencyName: 'UAE Dirham',
    usdPerUnit: 0.272,
  },
  {
    countryCode: 'SA',
    country: 'Saudi Arabia',
    currencyCode: 'SAR',
    currencyName: 'Saudi Riyal',
    usdPerUnit: 0.266,
  },
  {
    countryCode: 'QA',
    country: 'Qatar',
    currencyCode: 'QAR',
    currencyName: 'Qatari Riyal',
    usdPerUnit: 0.275,
  },
  {
    countryCode: 'BR',
    country: 'Brazil',
    currencyCode: 'BRL',
    currencyName: 'Brazilian Real',
    usdPerUnit: 0.20,
  },
  {
    countryCode: 'MX',
    country: 'Mexico',
    currencyCode: 'MXN',
    currencyName: 'Mexican Peso',
    usdPerUnit: 0.059,
  },
];

export function getGlobalFallbackRates() {
  const rates: Record<string, number> = { USD: 1 };
  for (const row of GLOBAL_VISITOR_CURRENCY_FALLBACK) {
    const code = normalizeCurrency(row.currencyCode);
    if (!code || rates[code]) continue;
    rates[code] = Number(row.usdPerUnit || 0);
  }
  return rates;
}

const COUNTRY_CODE_ALIASES: Record<string, string> = {
  UK: 'GB',
  EL: 'GR',
};

for (const row of GLOBAL_VISITOR_CURRENCY_FALLBACK) {
  const code = row.countryCode.toUpperCase();
  if (!byCountryCode.has(code)) {
    byCountryCode.set(code, row);
  }
  const normalizedCountry = normalizeCountry(row.country);
  if (!byCountryName.has(normalizedCountry)) {
    byCountryName.set(normalizedCountry, row);
  }
}

export function normalizeCountry(value: string | null | undefined) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeCurrency(value: string | null | undefined) {
  return String(value || '').trim().toUpperCase();
}

function sanitizeMatrix(rows: unknown): AfricanCurrencyRow[] {
  if (!Array.isArray(rows)) return [...AFRICAN_CURRENCY_BASELINE];
  const mapped = rows
    .map((row: any) => ({
      countryCode: String(row?.countryCode || '').toUpperCase(),
      country: String(row?.country || '').trim(),
      currencyCode: normalizeCurrency(row?.currencyCode),
      currencyName: String(row?.currencyName || '').trim(),
      usdPerUnit: Number(row?.usdPerUnit || 0),
    }))
    .filter(
      (row) =>
        row.countryCode &&
        row.country &&
        row.currencyCode &&
        row.currencyName &&
        Number.isFinite(row.usdPerUnit) &&
        row.usdPerUnit > 0
    );
  return mapped.length > 0 ? mapped : [...AFRICAN_CURRENCY_BASELINE];
}

function sanitizeRules(rows: unknown): CurrencyListingRule[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row: any) => ({
      id: String(row?.id || ''),
      scopeType: String(row?.scopeType || '').toUpperCase() as CurrencyScopeType,
      scopeValue: String(row?.scopeValue || '').trim(),
      currencies: Array.isArray(row?.currencies)
        ? row.currencies.map((item: any) => normalizeCurrency(item)).filter(Boolean)
        : [],
    }))
    .filter(
      (row) =>
        row.id &&
        ['COUNTRY', 'USER', 'ROLE'].includes(row.scopeType) &&
        row.scopeValue &&
        row.currencies.length > 0
    );
}

function sanitizeOverrides(payload: unknown): Record<string, AfricanCurrencyRow> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  const input = payload as Record<string, any>;
  const output: Record<string, AfricanCurrencyRow> = {};
  for (const [key, value] of Object.entries(input)) {
    const row = sanitizeMatrix([value])[0];
    if (row) {
      output[key.toUpperCase()] = row;
    }
  }
  return output;
}

export async function getCurrencyState(): Promise<CurrencyMatrixState> {
  const [matrixLog, rulesLog] = await Promise.all([
    prisma.activityLog.findFirst({
      where: { action: MATRIX_ACTION },
      orderBy: { createdAt: 'desc' },
      select: { details: true, createdAt: true },
    }),
    prisma.activityLog.findFirst({
      where: { action: RULES_ACTION },
      orderBy: { createdAt: 'desc' },
      select: { details: true },
    }),
  ]);

  const details = (matrixLog?.details as any) || {};
  return {
    matrix: sanitizeMatrix((matrixLog?.details as any)?.matrix),
    rules: sanitizeRules((rulesLog?.details as any)?.rules),
    meta: {
      lastRefreshedAt: matrixLog?.createdAt?.toISOString() || null,
      lastSource: String(details?.source || 'manual'),
    },
  };
}

export async function saveCurrencyMatrix(
  userId: string,
  matrix: AfricanCurrencyRow[],
  options?: { source?: 'manual' | 'provider' | 'scheduler' }
) {
  const sanitized = sanitizeMatrix(matrix);
  await prisma.activityLog.create({
    data: {
      userId,
      action: MATRIX_ACTION,
      details: { matrix: sanitized, source: options?.source || 'manual' } as any,
    },
  });
}

export async function saveCurrencyRules(userId: string, rules: CurrencyListingRule[]) {
  const sanitized = sanitizeRules(rules);
  await prisma.activityLog.create({
    data: {
      userId,
      action: RULES_ACTION,
      details: { rules: sanitized } as any,
    },
  });
}

export async function getCurrencyOverrides() {
  const overridesLog = await prisma.activityLog.findFirst({
    where: { action: OVERRIDES_ACTION },
    orderBy: { createdAt: 'desc' },
    select: { details: true },
  });
  return sanitizeOverrides((overridesLog?.details as any)?.overrides);
}

export async function saveCurrencyOverridesMap(
  userId: string,
  overrides: Record<string, AfricanCurrencyRow>
) {
  await prisma.activityLog.create({
    data: {
      userId,
      action: OVERRIDES_ACTION,
      details: { overrides } as any,
    },
  });
}

export async function upsertCurrencyOverride(userId: string, row: AfricanCurrencyRow) {
  const current = await getCurrencyOverrides();
  const next = {
    ...current,
    [row.countryCode.toUpperCase()]: row,
  };
  await saveCurrencyOverridesMap(userId, next);
}

export function applyOverridesToMatrix(
  matrix: AfricanCurrencyRow[],
  overrides: Record<string, AfricanCurrencyRow>
) {
  return matrix.map((row) => overrides[row.countryCode.toUpperCase()] || row);
}

export async function getCurrencyHealth() {
  const matrixLog = await prisma.activityLog.findFirst({
    where: { action: MATRIX_ACTION },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, details: true },
  });
  const staleAfterHours = Math.max(1, Number.parseInt(process.env.CURRENCY_STALE_AFTER_HOURS || '24', 10) || 24);
  const lastRefreshedAt = matrixLog?.createdAt || null;
  const isStale = !lastRefreshedAt || Date.now() - lastRefreshedAt.getTime() > staleAfterHours * 60 * 60 * 1000;
  return {
    lastRefreshedAt: lastRefreshedAt?.toISOString() || null,
    staleAfterHours,
    isStale,
    lastSource: String((matrixLog?.details as any)?.source || 'manual'),
  };
}

export function getDefaultCurrencyForCountry(country: string | null | undefined, matrix: AfricanCurrencyRow[]) {
  const normalized = normalizeCountry(country);
  if (!normalized) return 'USD';
  return matrix.find((row) => normalizeCountry(row.country) === normalized)?.currencyCode || 'USD';
}

export function getUsdPerUnit(currencyCode: string, matrix: AfricanCurrencyRow[]) {
  const code = normalizeCurrency(currencyCode);
  if (!code || code === 'USD') return 1;
  return matrix.find((row) => row.currencyCode === code)?.usdPerUnit || 0;
}

export function convertLocalToUsd(amountLocal: number, currencyCode: string, matrix: AfricanCurrencyRow[]) {
  const code = normalizeCurrency(currencyCode);
  if (!Number.isFinite(amountLocal) || amountLocal < 0) return 0;
  if (code === 'USD') return amountLocal;
  const usdPerUnit = getUsdPerUnit(code, matrix);
  if (usdPerUnit <= 0) return amountLocal;
  return Number((amountLocal * usdPerUnit).toFixed(2));
}

export function convertUsdToLocal(amountUsd: number, currencyCode: string, matrix: AfricanCurrencyRow[]) {
  const code = normalizeCurrency(currencyCode);
  if (!Number.isFinite(amountUsd) || amountUsd < 0) return 0;
  if (code === 'USD') return amountUsd;
  const usdPerUnit = getUsdPerUnit(code, matrix);
  if (usdPerUnit <= 0) return amountUsd;
  return Number((amountUsd / usdPerUnit).toFixed(2));
}

export function getAllowedCurrenciesForVendor(params: {
  role: UserRole;
  userId: string;
  country: string;
  matrix: AfricanCurrencyRow[];
  rules: CurrencyListingRule[];
}) {
  const { role, userId, country, matrix, rules } = params;
  const defaultCurrency = getDefaultCurrencyForCountry(country, matrix);
  const allowed = new Set<string>([defaultCurrency]);

  for (const rule of rules) {
    if (
      (rule.scopeType === 'USER' && rule.scopeValue === userId) ||
      (rule.scopeType === 'ROLE' && rule.scopeValue.toUpperCase() === role) ||
      (rule.scopeType === 'COUNTRY' && normalizeCountry(rule.scopeValue) === normalizeCountry(country))
    ) {
      for (const code of rule.currencies) {
        allowed.add(code);
      }
    }
  }

  allowed.add('USD');
  return {
    defaultCurrency,
    allowedCurrencies: Array.from(allowed).filter((code) => code === 'USD' || getUsdPerUnit(code, matrix) > 0),
  };
}

export function inferCountryFromHeaders(headers: Record<string, string | string[] | undefined>) {
  const readHeader = (value: string | string[] | undefined) => {
    if (Array.isArray(value)) return String(value[0] || '');
    return String(value || '');
  };

  const normalizeCountryCode = (value: string) => {
    const token = String(value || '')
      .split(',')[0]
      .trim()
      .toUpperCase();
    return COUNTRY_CODE_ALIASES[token] || token;
  };

  const headerCandidates = [
    headers['x-vercel-ip-country'],
    headers['cf-ipcountry'],
    headers['x-country-code'],
    headers['x-geo-country'],
  ];

  for (const candidate of headerCandidates) {
    const code = normalizeCountryCode(readHeader(candidate));
    if (!code) continue;
    const row = byCountryCode.get(code);
    if (row) return row;
  }

  // Fallback: infer from browser language when edge geo headers are absent.
  // Example header values: "en-US,en;q=0.9" or "fr-FR,fr;q=0.8,en-US;q=0.6"
  const acceptLanguage = readHeader(headers['accept-language']);
  const languageTags = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean);

  for (const tag of languageTags) {
    const parts = tag.split('-').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const regionCode = normalizeCountryCode(parts[parts.length - 1]);
    if (!regionCode || regionCode.length !== 2) continue;
    const row = byCountryCode.get(regionCode);
    if (row) {
      return row;
    }
  }

  return null;
}

export async function refreshMatrixFromThirdParty(matrix: AfricanCurrencyRow[]) {
  const endpoint = process.env.EXCHANGE_RATE_API_URL || 'https://open.er-api.com/v6/latest/USD';
  const response = await fetch(endpoint);
  if (!response.ok) {
    throw new Error('Failed to fetch exchange rates from provider.');
  }
  const payload = (await response.json()) as any;
  const rates = payload?.rates || payload?.conversion_rates;
  if (!rates || typeof rates !== 'object') {
    throw new Error('Invalid exchange-rate provider response.');
  }

  return matrix.map((row) => {
    const unitsPerUsd = Number(rates[row.currencyCode]);
    if (!Number.isFinite(unitsPerUsd) || unitsPerUsd <= 0) {
      return row;
    }
    const usdPerUnit = Number((1 / unitsPerUsd).toFixed(8));
    return {
      ...row,
      usdPerUnit,
    };
  });
}

export function mapCountryToBaseline(country: string) {
  return byCountryName.get(normalizeCountry(country)) || null;
}

export async function setProductCurrencyMetadata(params: {
  userId: string;
  productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  productId: string;
  currencyCode: string;
  localPrice: number;
  usdPrice: number;
  exchangeRate: number;
}) {
  await prisma.activityLog.create({
    data: {
      userId: params.userId,
      action: PRODUCT_CURRENCY_ACTION,
      details: {
        productType: params.productType,
        productId: params.productId,
        currencyCode: normalizeCurrency(params.currencyCode),
        localPrice: Number(params.localPrice || 0),
        usdPrice: Number(params.usdPrice || 0),
        exchangeRate: Number(params.exchangeRate || 1),
      },
    },
  });
}

export async function getProductCurrencyMetadata(productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', productId: string) {
  const row = await prisma.activityLog.findFirst({
    where: {
      action: PRODUCT_CURRENCY_ACTION,
      details: {
        path: ['productType'],
        equals: productType,
      },
      AND: [
        {
          details: {
            path: ['productId'],
            equals: productId,
          },
        },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: { details: true },
  });
  return (row?.details as any) || null;
}

export async function resolveCurrencySyncUserId() {
  const envUserId = process.env.CURRENCY_SYNC_USER_ID;
  if (envUserId) return envUserId;
  const admin = await prisma.user.findFirst({
    where: { role: UserRole.ADMINISTRATOR },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });
  return admin?.id || null;
}
