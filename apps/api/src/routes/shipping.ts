import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus, prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

type IntegrationFieldType = 'TEXT' | 'PASSWORD' | 'URL' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'TEXTAREA';
type IntegrationMode = 'TEST' | 'LIVE';
type ProviderType = 'GLOBAL' | 'LOCAL';

type ShippingIntegrationField = {
  key: string;
  label: string;
  type: IntegrationFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  isSecret?: boolean;
  exposePublic?: boolean;
  sortOrder?: number;
};

type ShippingIntegrationRow = {
  id: string;
  providerKey: string;
  displayName: string;
  providerType: ProviderType;
  mode: IntegrationMode;
  isActive: boolean;
  supportsCountries: string[];
  configSchema: ShippingIntegrationField[];
  configValues: Record<string, unknown>;
  notes: string | null;
  updatedAt: string;
};

type ShippingLocalOptionRow = {
  id: string;
  countryCode: string;
  countryName: string;
  city: string | null;
  providerKey: string;
  providerName: string;
  serviceName: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceUsd: number;
  isActive: boolean;
  metadata: Record<string, unknown>;
  updatedAt: string;
};

type ShippingStageTemplateRow = {
  id: string;
  providerKey: string;
  stageKey: string;
  stageLabel: string;
  description: string | null;
  sortOrder: number;
  isFinal: boolean;
  isActive: boolean;
  updatedAt: string;
};

type OrderShippingStageEventRow = {
  id: string;
  orderId: string;
  providerKey: string;
  stageKey: string;
  stageLabel: string;
  notes: string | null;
  trackingNumber: string | null;
  currentLocation: string | null;
  updatedById: string | null;
  createdAt: string;
};

const REALTIME_CONFIG_FIELDS: ShippingIntegrationField[] = [
  {
    key: 'enableRealtimeRates',
    label: 'Enable Realtime Rates',
    type: 'BOOLEAN',
    required: false,
    helpText: 'Turn on live carrier API quote calls.',
    sortOrder: 100,
  },
  {
    key: 'enableRealtimeTracking',
    label: 'Enable Realtime Tracking',
    type: 'BOOLEAN',
    required: false,
    helpText: 'Turn on live carrier API tracking calls.',
    sortOrder: 101,
  },
  {
    key: 'tokenUrl',
    label: 'OAuth Token URL',
    type: 'URL',
    required: false,
    sortOrder: 102,
  },
  {
    key: 'tokenAuthType',
    label: 'Token Auth Type',
    type: 'SELECT',
    required: false,
    options: ['BASIC', 'BODY'],
    sortOrder: 103,
  },
  {
    key: 'clientId',
    label: 'Client ID',
    type: 'TEXT',
    required: false,
    sortOrder: 104,
  },
  {
    key: 'clientSecret',
    label: 'Client Secret',
    type: 'PASSWORD',
    required: false,
    isSecret: true,
    sortOrder: 105,
  },
  {
    key: 'rateApiUrl',
    label: 'Rate API URL',
    type: 'URL',
    required: false,
    sortOrder: 106,
  },
  {
    key: 'rateMethod',
    label: 'Rate API Method',
    type: 'SELECT',
    required: false,
    options: ['POST', 'GET'],
    sortOrder: 107,
  },
  {
    key: 'trackingApiUrl',
    label: 'Tracking API URL',
    type: 'URL',
    required: false,
    sortOrder: 108,
  },
  {
    key: 'trackingMethod',
    label: 'Tracking API Method',
    type: 'SELECT',
    required: false,
    options: ['GET', 'POST'],
    sortOrder: 109,
  },
  {
    key: 'headersJson',
    label: 'Custom Headers (JSON)',
    type: 'TEXTAREA',
    required: false,
    helpText: '{"x-account-id":"...","x-region":"..."}',
    sortOrder: 110,
  },
];

const DEFAULT_LOCAL_STAGE_TEMPLATES = [
  {
    stageKey: 'ORDER_RECEIVED',
    stageLabel: 'Order Received',
    description: 'Local carrier has received shipment request.',
    sortOrder: 0,
    isFinal: false,
  },
  {
    stageKey: 'PICKED_UP',
    stageLabel: 'Picked Up',
    description: 'Shipment has been picked up from origin.',
    sortOrder: 1,
    isFinal: false,
  },
  {
    stageKey: 'IN_TRANSIT',
    stageLabel: 'In Transit',
    description: 'Shipment is currently moving to destination.',
    sortOrder: 2,
    isFinal: false,
  },
  {
    stageKey: 'OUT_FOR_DELIVERY',
    stageLabel: 'Out For Delivery',
    description: 'Shipment is out for final delivery.',
    sortOrder: 3,
    isFinal: false,
  },
  {
    stageKey: 'DELIVERED',
    stageLabel: 'Delivered',
    description: 'Shipment has been delivered.',
    sortOrder: 4,
    isFinal: true,
  },
];

const BUILTIN_SHIPPING_TEMPLATES = [
  {
    providerKey: 'UPS',
    displayName: 'UPS',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
      ...REALTIME_CONFIG_FIELDS,
    ],
    configValues: {
      baseRateUsd: 30,
      percentRate: 2.5,
      markupUsd: 0,
      etaMinDays: 4,
      etaMaxDays: 10,
      enableRealtimeRates: false,
      enableRealtimeTracking: false,
      rateMethod: 'POST',
      trackingMethod: 'GET',
    },
  },
  {
    providerKey: 'USPS',
    displayName: 'USPS',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
      ...REALTIME_CONFIG_FIELDS,
    ],
    configValues: {
      baseRateUsd: 25,
      percentRate: 2.2,
      markupUsd: 0,
      etaMinDays: 5,
      etaMaxDays: 11,
      enableRealtimeRates: false,
      enableRealtimeTracking: false,
      rateMethod: 'POST',
      trackingMethod: 'GET',
    },
  },
  {
    providerKey: 'FEDEX',
    displayName: 'FedEx',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
      ...REALTIME_CONFIG_FIELDS,
    ],
    configValues: {
      baseRateUsd: 32,
      percentRate: 2.9,
      markupUsd: 0,
      etaMinDays: 3,
      etaMaxDays: 8,
      enableRealtimeRates: false,
      enableRealtimeTracking: false,
      rateMethod: 'POST',
      trackingMethod: 'GET',
    },
  },
  {
    providerKey: 'DHL',
    displayName: 'DHL',
    providerType: 'GLOBAL' as const,
    mode: 'TEST' as const,
    configSchema: [
      { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 1 },
      { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true, sortOrder: 2 },
      { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false, sortOrder: 3 },
      { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true, sortOrder: 4 },
      { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false, sortOrder: 5 },
      { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false, sortOrder: 6 },
      { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false, sortOrder: 7 },
      { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false, sortOrder: 8 },
      ...REALTIME_CONFIG_FIELDS,
    ],
    configValues: {
      baseRateUsd: 35,
      percentRate: 3.1,
      markupUsd: 0,
      etaMinDays: 3,
      etaMaxDays: 7,
      enableRealtimeRates: false,
      enableRealtimeTracking: false,
      rateMethod: 'POST',
      trackingMethod: 'GET',
    },
  },
];

const BUILTIN_PROVIDER_KEYS = new Set(BUILTIN_SHIPPING_TEMPLATES.map((row) => row.providerKey));
let shippingSchemaEnsured = false;

const normalizeProviderKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

const normalizeCountryCode = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
};

const parseArray = (value: unknown): unknown[] => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeFieldType = (value: unknown): IntegrationFieldType => {
  const token = String(value || '').toUpperCase();
  if (token === 'PASSWORD') return 'PASSWORD';
  if (token === 'URL') return 'URL';
  if (token === 'NUMBER') return 'NUMBER';
  if (token === 'BOOLEAN') return 'BOOLEAN';
  if (token === 'SELECT') return 'SELECT';
  if (token === 'TEXTAREA') return 'TEXTAREA';
  return 'TEXT';
};

const normalizeProviderType = (value: unknown): ProviderType =>
  String(value || '').toUpperCase() === 'LOCAL' ? 'LOCAL' : 'GLOBAL';

const normalizeMode = (value: unknown): IntegrationMode =>
  String(value || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST';

const normalizeConfigSchema = (raw: unknown): ShippingIntegrationField[] =>
  parseArray(raw)
    .map((field, index) => {
      const row = parseObject(field);
      const key = String(row.key || '')
        .trim()
        .replace(/[^a-zA-Z0-9_]/g, '')
        .slice(0, 80);
      if (!key) return null;
      return {
        key,
        label: String(row.label || key),
        type: normalizeFieldType(row.type),
        required: Boolean(row.required),
        placeholder: row.placeholder ? String(row.placeholder) : undefined,
        helpText: row.helpText ? String(row.helpText) : undefined,
        options: parseArray(row.options).map((entry) => String(entry || '')).filter(Boolean),
        isSecret: Boolean(row.isSecret),
        exposePublic: Boolean(row.exposePublic),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
      } as ShippingIntegrationField;
    })
    .filter((entry): entry is ShippingIntegrationField => Boolean(entry))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

const toFiniteNumber = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeStageKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

function readConfigText(values: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = values[key];
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text.length > 0) return text;
  }
  return '';
}

function readConfigBool(values: Record<string, unknown>, key: string, fallback = false) {
  const raw = values[key];
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const normalized = raw.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof raw === 'number') return raw > 0;
  return fallback;
}

function parseHeadersJson(values: Record<string, unknown>) {
  const raw = readConfigText(values, 'headersJson');
  if (!raw) return {} as Record<string, string>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key) continue;
      headers[key] = String(value ?? '').trim();
    }
    return headers;
  } catch {
    return {};
  }
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function normalizeRealtimeQuotes(raw: unknown, provider: ShippingIntegrationRow) {
  const root = parseObject(raw);
  const candidates: unknown[] = [];
  if (Array.isArray((root as any).quotes)) candidates.push(...(root as any).quotes);
  if (Array.isArray((root as any).rates)) candidates.push(...(root as any).rates);
  if (Array.isArray((root as any).services)) candidates.push(...(root as any).services);
  if (Array.isArray((root as any).data?.quotes)) candidates.push(...(root as any).data.quotes);
  if (Array.isArray((root as any).data?.rates)) candidates.push(...(root as any).data.rates);
  const rows = candidates
    .map((entry) => parseObject(entry))
    .map((entry, index) => {
      const amount = toFiniteNumber(
        entry.amount ?? entry.total ?? entry.price ?? entry.rate ?? entry.cost ?? entry.value,
        Number.NaN
      );
      if (!Number.isFinite(amount)) return null;
      const serviceName = readConfigText(
        entry,
        'serviceName',
        'service',
        'name',
        'label',
        'productName'
      ) || `${provider.displayName} Service ${index + 1}`;
      const etaMinDays = Math.max(
        0,
        Math.floor(
          toFiniteNumber(entry.etaMinDays ?? entry.minDays ?? entry.deliveryDaysMin ?? entry.transitDays, 3)
        )
      );
      const etaMaxDays = Math.max(
        etaMinDays,
        Math.floor(
          toFiniteNumber(entry.etaMaxDays ?? entry.maxDays ?? entry.deliveryDaysMax ?? entry.transitDays, etaMinDays + 3)
        )
      );
      return {
        id: `global-${provider.providerKey.toLowerCase()}-${index + 1}`,
        source: 'GLOBAL' as const,
        providerKey: provider.providerKey,
        providerName: provider.displayName,
        serviceName,
        etaMinDays,
        etaMaxDays,
        priceUsd: Number(amount.toFixed(2)),
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  return rows;
}

function normalizeTrackingResult(raw: unknown) {
  const root = parseObject(raw);
  const status =
    readConfigText(root, 'status', 'shipmentStatus', 'state') ||
    readConfigText(parseObject((root as any).data), 'status', 'shipmentStatus', 'state') ||
    'UNKNOWN';
  const trackingNumber =
    readConfigText(root, 'trackingNumber', 'tracking', 'awb') ||
    readConfigText(parseObject((root as any).data), 'trackingNumber', 'tracking', 'awb') ||
    '';
  const eventsSource =
    (Array.isArray((root as any).events) && (root as any).events) ||
    (Array.isArray((root as any).history) && (root as any).history) ||
    (Array.isArray((root as any).trackingEvents) && (root as any).trackingEvents) ||
    (Array.isArray((root as any).data?.events) && (root as any).data.events) ||
    [];
  const events = eventsSource
    .map((entry: unknown) => parseObject(entry))
    .map((entry: Record<string, unknown>) => ({
      status: readConfigText(entry, 'status', 'state', 'description') || 'UPDATE',
      location: readConfigText(entry, 'location', 'city', 'hub') || '',
      timestamp: readConfigText(entry, 'timestamp', 'date', 'createdAt') || new Date().toISOString(),
      notes: readConfigText(entry, 'notes', 'description', 'message') || '',
    }));
  return {
    status,
    trackingNumber,
    events,
    raw: root,
  };
}

function buildFormulaQuote(provider: ShippingIntegrationRow, subtotalUsd: number, weightKg: number) {
  const values = provider.configValues || {};
  const baseRate = toFiniteNumber(values.baseRateUsd, 25);
  const percentRate = toFiniteNumber(values.percentRate, 2.5);
  const markupUsd = toFiniteNumber(values.markupUsd, 0);
  const etaMinDays = Math.max(0, Math.floor(toFiniteNumber(values.etaMinDays, 4)));
  const etaMaxDays = Math.max(etaMinDays, Math.floor(toFiniteNumber(values.etaMaxDays, 10)));
  const weightRate = toFiniteNumber(values.weightRateUsdPerKg, 0);
  const priceUsd = Number((baseRate + subtotalUsd * (percentRate / 100) + markupUsd + weightKg * weightRate).toFixed(2));
  return {
    id: `global-${provider.providerKey.toLowerCase()}`,
    source: 'GLOBAL' as const,
    providerKey: provider.providerKey,
    providerName: provider.displayName,
    serviceName: readConfigText(values, 'serviceName') || `${provider.displayName} Standard`,
    etaMinDays,
    etaMaxDays,
    priceUsd,
  };
}

async function requestProviderToken(values: Record<string, unknown>) {
  const tokenUrl = readConfigText(values, 'tokenUrl');
  if (!tokenUrl) return '';
  const clientId = readConfigText(values, 'clientId');
  const clientSecret = readConfigText(values, 'clientSecret');
  if (!clientId || !clientSecret) return '';
  const authType = readConfigText(values, 'tokenAuthType').toUpperCase() || 'BASIC';
  const grantType = readConfigText(values, 'tokenGrantType') || 'client_credentials';
  const scope = readConfigText(values, 'tokenScope');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const params = new URLSearchParams();
  params.set('grant_type', grantType);
  if (scope) params.set('scope', scope);
  if (authType === 'BODY') {
    params.set('client_id', clientId);
    params.set('client_secret', clientSecret);
  } else {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
  }
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: params.toString(),
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      readConfigText(parseObject(body), 'error_description', 'message', 'error') || 'Failed to acquire shipping token.'
    );
  }
  return readConfigText(parseObject(body), 'access_token', 'token', 'bearerToken');
}

async function fetchRealtimeQuotes(params: {
  provider: ShippingIntegrationRow;
  countryCode: string;
  city: string;
  subtotalUsd: number;
  weightKg: number;
}) {
  const values = params.provider.configValues || {};
  const enabled = readConfigBool(values, 'enableRealtimeRates', false);
  const rateApiUrl = readConfigText(values, 'rateApiUrl');
  if (!enabled || !rateApiUrl) return [];
  const method = readConfigText(values, 'rateMethod').toUpperCase() === 'GET' ? 'GET' : 'POST';
  const token = await requestProviderToken(values).catch(() => '');
  const apiKey = readConfigText(values, 'apiKey');
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...parseHeadersJson(values),
  };
  if (apiKey && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (method !== 'GET') headers['Content-Type'] = 'application/json';

  const payload = {
    providerKey: params.provider.providerKey,
    destination: {
      countryCode: params.countryCode,
      city: params.city,
    },
    parcel: {
      weightKg: params.weightKg,
      declaredValueUsd: params.subtotalUsd,
      currency: 'USD',
    },
    order: {
      subtotalUsd: params.subtotalUsd,
    },
  };

  const requestUrl =
    method === 'GET'
      ? `${rateApiUrl}${rateApiUrl.includes('?') ? '&' : '?'}countryCode=${encodeURIComponent(
          params.countryCode
        )}&city=${encodeURIComponent(params.city)}&weightKg=${encodeURIComponent(
          String(params.weightKg)
        )}&subtotalUsd=${encodeURIComponent(String(params.subtotalUsd))}`
      : rateApiUrl;
  const response = await fetch(requestUrl, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      readConfigText(parseObject(body), 'message', 'error_description', 'error') ||
        `Realtime quote failed for ${params.provider.providerKey}.`
    );
  }
  return normalizeRealtimeQuotes(body, params.provider);
}

async function ensureShippingSchema() {
  if (shippingSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ShippingIntegration" (
      "id" TEXT NOT NULL,
      "providerKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "providerType" TEXT NOT NULL DEFAULT 'GLOBAL',
      "mode" TEXT NOT NULL DEFAULT 'TEST',
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "supportsCountries" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "notes" TEXT,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShippingIntegration_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ShippingIntegration_providerKey_key" ON "ShippingIntegration"("providerKey")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "supportsCountries" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingIntegration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ShippingIntegration" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ShippingLocalOption" (
      "id" TEXT NOT NULL,
      "countryCode" TEXT NOT NULL,
      "countryName" TEXT NOT NULL,
      "city" TEXT,
      "providerKey" TEXT NOT NULL,
      "providerName" TEXT NOT NULL,
      "serviceName" TEXT NOT NULL,
      "etaMinDays" INTEGER NOT NULL DEFAULT 1,
      "etaMaxDays" INTEGER NOT NULL DEFAULT 3,
      "priceUsd" DECIMAL(10,2) NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShippingLocalOption_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ShippingLocalOption_countryCode_idx" ON "ShippingLocalOption"("countryCode")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ShippingLocalOption_isActive_idx" ON "ShippingLocalOption"("isActive")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingLocalOption" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "ShippingLocalOption" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "ShippingLocalOption" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "ShippingStageTemplate" (
      "id" TEXT NOT NULL,
      "providerKey" TEXT NOT NULL,
      "stageKey" TEXT NOT NULL,
      "stageLabel" TEXT NOT NULL,
      "description" TEXT,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isFinal" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ShippingStageTemplate_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ShippingStageTemplate_provider_stage_key"
     ON "ShippingStageTemplate"("providerKey","stageKey")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ShippingStageTemplate_provider_idx" ON "ShippingStageTemplate"("providerKey")`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "OrderShippingStageEvent" (
      "id" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "providerKey" TEXT NOT NULL,
      "stageKey" TEXT NOT NULL,
      "stageLabel" TEXT NOT NULL,
      "notes" TEXT,
      "trackingNumber" TEXT,
      "currentLocation" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "OrderShippingStageEvent_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "OrderShippingStageEvent_order_idx" ON "OrderShippingStageEvent"("orderId","createdAt")`
  );

  for (const template of BUILTIN_SHIPPING_TEMPLATES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ShippingIntegration"
        ("id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,'[]'::jsonb,$6::jsonb,$7::jsonb,NOW(),NOW())
       ON CONFLICT ("providerKey") DO NOTHING`,
      randomUUID(),
      template.providerKey,
      template.displayName,
      template.providerType,
      template.mode,
      JSON.stringify(template.configSchema),
      JSON.stringify(template.configValues)
    );
  }

  for (const stage of DEFAULT_LOCAL_STAGE_TEMPLATES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ShippingStageTemplate"
        ("id","providerKey","stageKey","stageLabel","description","sortOrder","isFinal","isActive","createdAt","updatedAt")
       VALUES ($1,'LOCAL_DEFAULT',$2,$3,$4,$5,$6,true,NOW(),NOW())
       ON CONFLICT ("providerKey","stageKey") DO NOTHING`,
      randomUUID(),
      stage.stageKey,
      stage.stageLabel,
      stage.description,
      stage.sortOrder,
      stage.isFinal
    );
  }
  shippingSchemaEnsured = true;
}

async function readShippingIntegrations(params?: { activeOnly?: boolean; providerKey?: string }) {
  await ensureShippingSchema();
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.activeOnly) {
    values.push(true);
    filters.push(`"isActive" = $${values.length}`);
  }
  if (params?.providerKey) {
    values.push(normalizeProviderKey(params.providerKey));
    filters.push(`UPPER("providerKey") = $${values.length}`);
  }
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","notes","updatedAt"
     FROM "ShippingIntegration"
     ${whereClause}
     ORDER BY "displayName" ASC, "providerKey" ASC`,
    ...values
  );
  return rows.map((row) => {
    const providerKey = normalizeProviderKey(row.providerKey);
    const template = BUILTIN_SHIPPING_TEMPLATES.find((entry) => entry.providerKey === providerKey) || null;
    const templateSchema = normalizeConfigSchema(template?.configSchema || []);
    const rowSchema = normalizeConfigSchema(row.configSchema);
    const mergedSchema = [
      ...templateSchema,
      ...rowSchema.filter(
        (entry) => !templateSchema.some((templateField) => String(templateField.key) === String(entry.key))
      ),
    ].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
    const mergedConfigValues = {
      ...(template?.configValues || {}),
      ...parseObject(row.configValues),
    };
    return {
      id: String(row.id),
      providerKey,
      displayName: String(row.displayName || row.providerKey || 'Shipping Provider'),
      providerType: normalizeProviderType(row.providerType),
      mode: normalizeMode(row.mode),
      isActive: Boolean(row.isActive),
      supportsCountries: parseArray(row.supportsCountries).map((entry) => normalizeCountryCode(entry)).filter(Boolean),
      configSchema: mergedSchema,
      configValues: mergedConfigValues,
      notes: row.notes ? String(row.notes) : null,
      updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
    } as ShippingIntegrationRow;
  });
}

async function upsertShippingIntegration(params: {
  providerKey: string;
  displayName?: string;
  providerType?: ProviderType;
  mode?: IntegrationMode;
  isActive?: boolean;
  supportsCountries?: string[];
  configSchema?: ShippingIntegrationField[];
  configValues?: Record<string, unknown>;
  notes?: string | null;
  userId: string;
}) {
  const providerKey = normalizeProviderKey(params.providerKey);
  if (!providerKey) throw Object.assign(new Error('Provider key is required.'), { status: 400 });
  const existing = (await readShippingIntegrations({ providerKey }))[0] || null;
  const template = BUILTIN_SHIPPING_TEMPLATES.find((row) => row.providerKey === providerKey) || null;
  const displayName =
    String(params.displayName || existing?.displayName || template?.displayName || providerKey).trim() || providerKey;
  const providerType = params.providerType || existing?.providerType || template?.providerType || 'GLOBAL';
  const mode = params.mode || existing?.mode || template?.mode || 'TEST';
  const isActive = typeof params.isActive === 'boolean' ? params.isActive : existing?.isActive || false;
  const supportsCountries = Array.isArray(params.supportsCountries)
    ? params.supportsCountries.map((entry) => normalizeCountryCode(entry)).filter(Boolean)
    : existing?.supportsCountries || [];
  const configSchema = normalizeConfigSchema(params.configSchema || existing?.configSchema || template?.configSchema || []);
  const configValues = parseObject(params.configValues || existing?.configValues || template?.configValues || {});
  const notes = params.notes === undefined ? existing?.notes || null : params.notes;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ShippingIntegration"
      ("id","providerKey","displayName","providerType","mode","isActive","supportsCountries","configSchema","configValues","notes","createdById","updatedById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,NOW(),NOW())
     ON CONFLICT ("providerKey")
     DO UPDATE SET
       "displayName" = EXCLUDED."displayName",
       "providerType" = EXCLUDED."providerType",
       "mode" = EXCLUDED."mode",
       "isActive" = EXCLUDED."isActive",
       "supportsCountries" = EXCLUDED."supportsCountries",
       "configSchema" = EXCLUDED."configSchema",
       "configValues" = EXCLUDED."configValues",
       "notes" = EXCLUDED."notes",
       "updatedById" = EXCLUDED."updatedById",
       "updatedAt" = NOW()`,
    existing?.id || randomUUID(),
    providerKey,
    displayName,
    providerType,
    mode,
    isActive,
    JSON.stringify(supportsCountries),
    JSON.stringify(configSchema),
    JSON.stringify(configValues),
    notes,
    params.userId,
    params.userId
  );
  return (await readShippingIntegrations({ providerKey }))[0] || null;
}

async function readShippingLocalOptions(params?: {
  activeOnly?: boolean;
  countryCode?: string;
  city?: string;
  providerKey?: string;
}) {
  await ensureShippingSchema();
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.activeOnly) {
    values.push(true);
    filters.push(`"isActive" = $${values.length}`);
  }
  if (params?.countryCode) {
    values.push(normalizeCountryCode(params.countryCode));
    filters.push(`UPPER("countryCode") = $${values.length}`);
  }
  if (params?.providerKey) {
    values.push(normalizeProviderKey(params.providerKey));
    filters.push(`UPPER("providerKey") = $${values.length}`);
  }
  if (params?.city) {
    values.push(String(params.city).trim().toLowerCase());
    filters.push(`(LOWER(COALESCE("city", '')) = '' OR LOWER("city") = $${values.length})`);
  }
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata","updatedAt"
     FROM "ShippingLocalOption"
     ${whereClause}
     ORDER BY "countryName" ASC, "providerName" ASC, "serviceName" ASC`,
    ...values
  );
  return rows.map((row) => ({
    id: String(row.id),
    countryCode: normalizeCountryCode(row.countryCode),
    countryName: String(row.countryName || '').trim(),
    city: row.city ? String(row.city).trim() : null,
    providerKey: normalizeProviderKey(row.providerKey),
    providerName: String(row.providerName || row.providerKey || 'Local Carrier'),
    serviceName: String(row.serviceName || 'Standard'),
    etaMinDays: Math.max(0, Math.floor(toFiniteNumber(row.etaMinDays, 1))),
    etaMaxDays: Math.max(0, Math.floor(toFiniteNumber(row.etaMaxDays, 3))),
    priceUsd: Number(toFiniteNumber(row.priceUsd, 0).toFixed(2)),
    isActive: Boolean(row.isActive),
    metadata: parseObject(row.metadata),
    updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
  })) as ShippingLocalOptionRow[];
}

async function readShippingStageTemplates(params?: {
  providerKey?: string;
  activeOnly?: boolean;
}) {
  await ensureShippingSchema();
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params?.providerKey) {
    values.push(normalizeProviderKey(params.providerKey));
    filters.push(`UPPER("providerKey") = $${values.length}`);
  }
  if (params?.activeOnly) {
    values.push(true);
    filters.push(`"isActive" = $${values.length}`);
  }
  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","providerKey","stageKey","stageLabel","description","sortOrder","isFinal","isActive","updatedAt"
     FROM "ShippingStageTemplate"
     ${whereClause}
     ORDER BY "providerKey" ASC, "sortOrder" ASC, "stageLabel" ASC`,
    ...values
  );
  return rows.map((row) => ({
    id: String(row.id),
    providerKey: normalizeProviderKey(row.providerKey),
    stageKey: normalizeStageKey(row.stageKey),
    stageLabel: String(row.stageLabel || '').trim(),
    description: row.description ? String(row.description).trim() : null,
    sortOrder: Math.max(0, Math.floor(toFiniteNumber(row.sortOrder, 0))),
    isFinal: Boolean(row.isFinal),
    isActive: Boolean(row.isActive),
    updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
  })) as ShippingStageTemplateRow[];
}

async function readOrderShippingStageEvents(orderId: string) {
  await ensureShippingSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","orderId","providerKey","stageKey","stageLabel","notes","trackingNumber","currentLocation","updatedById","createdAt"
     FROM "OrderShippingStageEvent"
     WHERE "orderId" = $1
     ORDER BY "createdAt" ASC`,
    orderId
  );
  return rows.map((row) => ({
    id: String(row.id),
    orderId: String(row.orderId),
    providerKey: normalizeProviderKey(row.providerKey),
    stageKey: normalizeStageKey(row.stageKey),
    stageLabel: String(row.stageLabel || ''),
    notes: row.notes ? String(row.notes) : null,
    trackingNumber: row.trackingNumber ? String(row.trackingNumber) : null,
    currentLocation: row.currentLocation ? String(row.currentLocation) : null,
    updatedById: row.updatedById ? String(row.updatedById) : null,
    createdAt: new Date(row.createdAt || Date.now()).toISOString(),
  })) as OrderShippingStageEventRow[];
}

router.get(
  '/admin/integrations',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (_req, res, next) => {
    try {
      const providers = await readShippingIntegrations();
      res.json({
        success: true,
        data: {
          providers,
          builtinProviderKeys: Array.from(BUILTIN_PROVIDER_KEYS.values()),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/integrations',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          providerKey: z.string().min(2),
          displayName: z.string().min(2).optional(),
          providerType: z.enum(['GLOBAL', 'LOCAL']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          supportsCountries: z.array(z.string()).optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);
      const provider = await upsertShippingIntegration({
        providerKey: payload.providerKey,
        displayName: payload.displayName,
        providerType: payload.providerType,
        mode: payload.mode,
        isActive: payload.isActive,
        supportsCountries: payload.supportsCountries,
        configSchema: payload.configSchema as ShippingIntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });
      res.status(201).json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          displayName: z.string().min(2).optional(),
          providerType: z.enum(['GLOBAL', 'LOCAL']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          supportsCountries: z.array(z.string()).optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);
      const provider = await upsertShippingIntegration({
        providerKey: req.params.providerKey,
        displayName: payload.displayName,
        providerType: payload.providerType,
        mode: payload.mode,
        isActive: payload.isActive,
        supportsCountries: payload.supportsCountries,
        configSchema: payload.configSchema as ShippingIntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });
      res.json({ success: true, data: provider });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const providerKey = normalizeProviderKey(req.params.providerKey);
      if (!providerKey) {
        return res.status(400).json({ success: false, message: 'Provider key is required.' });
      }
      if (BUILTIN_PROVIDER_KEYS.has(providerKey)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "ShippingIntegration"
           SET "isActive" = false, "updatedById" = $1, "updatedAt" = NOW()
           WHERE UPPER("providerKey") = $2`,
          req.user!.id,
          providerKey
        );
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "ShippingIntegration" WHERE UPPER("providerKey") = $1`, providerKey);
      }
      res.json({ success: true, message: 'Shipping integration removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/admin/local-options',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const countryCode = String(req.query.countryCode || '').trim();
      const city = String(req.query.city || '').trim();
      const providerKey = String(req.query.providerKey || '').trim();
      const options = await readShippingLocalOptions({
        countryCode: countryCode || undefined,
        city: city || undefined,
        providerKey: providerKey || undefined,
      });
      res.json({
        success: true,
        data: options,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/local-options',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          countryCode: z.string().min(2).max(2),
          countryName: z.string().min(2),
          city: z.string().optional(),
          providerKey: z.string().min(2),
          providerName: z.string().min(2),
          serviceName: z.string().min(2),
          etaMinDays: z.number().min(0),
          etaMaxDays: z.number().min(0),
          priceUsd: z.number().min(0),
          isActive: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
        })
        .parse(req.body);
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ShippingLocalOption"
          ("id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata","createdById","updatedById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,$14,NOW(),NOW())`,
        id,
        normalizeCountryCode(payload.countryCode),
        String(payload.countryName).trim(),
        payload.city ? String(payload.city).trim() : null,
        normalizeProviderKey(payload.providerKey),
        String(payload.providerName).trim(),
        String(payload.serviceName).trim(),
        Math.max(0, Math.floor(Number(payload.etaMinDays || 0))),
        Math.max(0, Math.floor(Number(payload.etaMaxDays || 0))),
        Number(Number(payload.priceUsd || 0).toFixed(2)),
        payload.isActive !== false,
        JSON.stringify(payload.metadata || {}),
        req.user!.id,
        req.user!.id
      );
      const option = (await readShippingLocalOptions()).find((row) => row.id === id) || null;
      res.status(201).json({ success: true, data: option });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/local-options/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          countryCode: z.string().min(2).max(2).optional(),
          countryName: z.string().min(2).optional(),
          city: z.string().nullable().optional(),
          providerKey: z.string().min(2).optional(),
          providerName: z.string().min(2).optional(),
          serviceName: z.string().min(2).optional(),
          etaMinDays: z.number().min(0).optional(),
          etaMaxDays: z.number().min(0).optional(),
          priceUsd: z.number().min(0).optional(),
          isActive: z.boolean().optional(),
          metadata: z.record(z.any()).optional(),
        })
        .parse(req.body);

      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","countryCode","countryName","city","providerKey","providerName","serviceName","etaMinDays","etaMaxDays","priceUsd","isActive","metadata"
         FROM "ShippingLocalOption"
         WHERE "id" = $1
         LIMIT 1`,
        req.params.id
      );
      const existing = rows[0];
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Shipping local option not found.' });
      }

      await prisma.$executeRawUnsafe(
        `UPDATE "ShippingLocalOption"
         SET
           "countryCode" = $2,
           "countryName" = $3,
           "city" = $4,
           "providerKey" = $5,
           "providerName" = $6,
           "serviceName" = $7,
           "etaMinDays" = $8,
           "etaMaxDays" = $9,
           "priceUsd" = $10,
           "isActive" = $11,
           "metadata" = $12::jsonb,
           "updatedById" = $13,
           "updatedAt" = NOW()
         WHERE "id" = $1`,
        req.params.id,
        normalizeCountryCode(payload.countryCode ?? existing.countryCode),
        String(payload.countryName ?? existing.countryName).trim(),
        payload.city === null ? null : payload.city !== undefined ? String(payload.city).trim() : existing.city,
        normalizeProviderKey(payload.providerKey ?? existing.providerKey),
        String(payload.providerName ?? existing.providerName).trim(),
        String(payload.serviceName ?? existing.serviceName).trim(),
        Math.max(0, Math.floor(Number(payload.etaMinDays ?? existing.etaMinDays ?? 0))),
        Math.max(0, Math.floor(Number(payload.etaMaxDays ?? existing.etaMaxDays ?? 0))),
        Number(Number(payload.priceUsd ?? existing.priceUsd ?? 0).toFixed(2)),
        payload.isActive ?? Boolean(existing.isActive),
        JSON.stringify(payload.metadata ?? parseObject(existing.metadata)),
        req.user!.id
      );
      const option = (await readShippingLocalOptions()).find((row) => row.id === req.params.id) || null;
      res.json({ success: true, data: option });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/local-options/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      await prisma.$executeRawUnsafe(`DELETE FROM "ShippingLocalOption" WHERE "id" = $1`, req.params.id);
      res.json({ success: true, message: 'Shipping local option removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/admin/stage-templates',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const providerKey = String(req.query.providerKey || '').trim();
      const templates = await readShippingStageTemplates({ providerKey: providerKey || undefined });
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/stage-templates',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          providerKey: z.string().min(2),
          stageKey: z.string().min(2),
          stageLabel: z.string().min(2),
          description: z.string().nullable().optional(),
          sortOrder: z.number().min(0).optional(),
          isFinal: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);
      const providerKey = normalizeProviderKey(payload.providerKey);
      const stageKey = normalizeStageKey(payload.stageKey);
      const id = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ShippingStageTemplate"
          ("id","providerKey","stageKey","stageLabel","description","sortOrder","isFinal","isActive","createdById","updatedById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
         ON CONFLICT ("providerKey","stageKey")
         DO UPDATE SET
           "stageLabel" = EXCLUDED."stageLabel",
           "description" = EXCLUDED."description",
           "sortOrder" = EXCLUDED."sortOrder",
           "isFinal" = EXCLUDED."isFinal",
           "isActive" = EXCLUDED."isActive",
           "updatedById" = EXCLUDED."updatedById",
           "updatedAt" = NOW()`,
        id,
        providerKey,
        stageKey,
        String(payload.stageLabel || '').trim(),
        payload.description ? String(payload.description).trim() : null,
        Math.max(0, Math.floor(Number(payload.sortOrder || 0))),
        payload.isFinal === true,
        payload.isActive !== false,
        req.user!.id,
        req.user!.id
      );
      const row = (await readShippingStageTemplates({ providerKey })).find((entry) => entry.stageKey === stageKey) || null;
      res.status(201).json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/stage-templates/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          providerKey: z.string().min(2).optional(),
          stageKey: z.string().min(2).optional(),
          stageLabel: z.string().min(2).optional(),
          description: z.string().nullable().optional(),
          sortOrder: z.number().min(0).optional(),
          isFinal: z.boolean().optional(),
          isActive: z.boolean().optional(),
        })
        .parse(req.body);
      const rows = await prisma.$queryRawUnsafe<Array<any>>(
        `SELECT "id","providerKey","stageKey","stageLabel","description","sortOrder","isFinal","isActive"
         FROM "ShippingStageTemplate"
         WHERE "id" = $1
         LIMIT 1`,
        req.params.id
      );
      const existing = rows[0];
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Shipping stage template not found.' });
      }
      const providerKey = normalizeProviderKey(payload.providerKey ?? existing.providerKey);
      const stageKey = normalizeStageKey(payload.stageKey ?? existing.stageKey);
      await prisma.$executeRawUnsafe(
        `UPDATE "ShippingStageTemplate"
         SET
           "providerKey" = $2,
           "stageKey" = $3,
           "stageLabel" = $4,
           "description" = $5,
           "sortOrder" = $6,
           "isFinal" = $7,
           "isActive" = $8,
           "updatedById" = $9,
           "updatedAt" = NOW()
         WHERE "id" = $1`,
        req.params.id,
        providerKey,
        stageKey,
        String(payload.stageLabel ?? existing.stageLabel).trim(),
        payload.description !== undefined
          ? payload.description
            ? String(payload.description).trim()
            : null
          : existing.description
            ? String(existing.description).trim()
            : null,
        Math.max(0, Math.floor(Number(payload.sortOrder ?? existing.sortOrder ?? 0))),
        payload.isFinal ?? Boolean(existing.isFinal),
        payload.isActive ?? Boolean(existing.isActive),
        req.user!.id
      );
      const row = (await readShippingStageTemplates({ providerKey })).find((entry) => entry.id === req.params.id) || null;
      res.json({ success: true, data: row });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/stage-templates/:id',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      await prisma.$executeRawUnsafe(`DELETE FROM "ShippingStageTemplate" WHERE "id" = $1`, req.params.id);
      res.json({ success: true, message: 'Shipping stage template removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  '/admin/orders/:orderId/local-stages',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      const stages = await readOrderShippingStageEvents(req.params.orderId);
      res.json({ success: true, data: stages });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/admin/orders/:orderId/local-stage',
  authenticate,
  authorizePermissions(Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
    try {
      await ensureShippingSchema();
      const payload = z
        .object({
          providerKey: z.string().min(2).optional(),
          stageKey: z.string().min(2),
          notes: z.string().optional(),
          trackingNumber: z.string().optional(),
          currentLocation: z.string().optional(),
        })
        .parse(req.body);

      const order = await prisma.order.findUnique({
        where: { id: req.params.orderId },
        select: { id: true, status: true, shippingAddress: true },
      });
      if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found.' });
      }
      const shippingMeta = parseObject(order.shippingAddress);
      const providerKey = normalizeProviderKey(payload.providerKey || shippingMeta.shippingProviderKey || 'LOCAL_DEFAULT');
      const templates = await readShippingStageTemplates({
        providerKey,
        activeOnly: true,
      });
      const fallbackTemplates =
        templates.length > 0
          ? templates
          : await readShippingStageTemplates({
              providerKey: 'LOCAL_DEFAULT',
              activeOnly: true,
            });
      const stageKey = normalizeStageKey(payload.stageKey);
      const template = fallbackTemplates.find((entry) => entry.stageKey === stageKey);
      if (!template) {
        return res.status(400).json({
          success: false,
          message: `Stage ${stageKey} is not configured for provider ${providerKey}.`,
        });
      }

      const eventId = randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "OrderShippingStageEvent"
          ("id","orderId","providerKey","stageKey","stageLabel","notes","trackingNumber","currentLocation","updatedById","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        eventId,
        order.id,
        providerKey,
        template.stageKey,
        template.stageLabel,
        payload.notes ? String(payload.notes).trim() : null,
        payload.trackingNumber ? String(payload.trackingNumber).trim() : null,
        payload.currentLocation ? String(payload.currentLocation).trim() : null,
        req.user!.id
      );

      const previousTracking = parseObject((shippingMeta as any).shippingTracking);
      const shippingTracking = {
        providerKey,
        stageKey: template.stageKey,
        stageLabel: template.stageLabel,
        notes: payload.notes ? String(payload.notes).trim() : '',
        trackingNumber:
          payload.trackingNumber !== undefined
            ? String(payload.trackingNumber || '').trim()
            : String(previousTracking.trackingNumber || ''),
        currentLocation:
          payload.currentLocation !== undefined
            ? String(payload.currentLocation || '').trim()
            : String(previousTracking.currentLocation || ''),
        updatedAt: new Date().toISOString(),
      };

      await prisma.order.update({
        where: { id: order.id },
        data: {
          ...(template.isFinal ? { status: OrderStatus.DELIVERED } : {}),
          shippingAddress: {
            ...(shippingMeta || {}),
            shippingTracking,
          } as any,
          timeline: {
            create: {
              status: template.isFinal ? OrderStatus.DELIVERED : order.status,
              notes: `Shipping stage updated (${providerKey}): ${template.stageLabel}${
                payload.notes ? ` - ${String(payload.notes).trim()}` : ''
              }`,
              updatedById: req.user!.id,
              updatedByRole: req.user!.role as any,
            },
          },
        },
      });

      const updatedStages = await readOrderShippingStageEvents(order.id);
      res.json({
        success: true,
        data: {
          orderId: order.id,
          shippingTracking,
          stages: updatedStages,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/options',
  authenticate,
  authorizePermissions(Permissions.ORDERS_CREATE, Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
  try {
    const payload = z
      .object({
        countryCode: z.string().min(2).max(2),
        city: z.string().optional(),
        subtotalUsd: z.number().min(0).default(0),
        weightKg: z.number().min(0).optional(),
      })
      .parse(req.body);

    const countryCode = normalizeCountryCode(payload.countryCode);
    const normalizedCity = String(payload.city || '').trim().toLowerCase();
    const subtotalUsd = Number(payload.subtotalUsd || 0);
    const weightKg = Number(payload.weightKg || 0);

    const [globalIntegrations, localOptions] = await Promise.all([
      readShippingIntegrations({ activeOnly: true }),
      readShippingLocalOptions({ activeOnly: true, countryCode, city: normalizedCity || undefined }),
    ]);

    const eligibleGlobalProviders = globalIntegrations.filter((provider) => {
      if (provider.providerType !== 'GLOBAL') return false;
      if (!Array.isArray(provider.supportsCountries) || provider.supportsCountries.length === 0) return true;
      return provider.supportsCountries.includes(countryCode);
    });

    const globalQuoteRows = await Promise.all(
      eligibleGlobalProviders.map(async (provider) => {
        try {
          const realtime = await fetchRealtimeQuotes({
            provider,
            countryCode,
            city: payload.city || '',
            subtotalUsd,
            weightKg,
          });
          if (realtime.length > 0) return realtime;
          return [buildFormulaQuote(provider, subtotalUsd, weightKg)];
        } catch {
          return [buildFormulaQuote(provider, subtotalUsd, weightKg)];
        }
      })
    );
    const globalQuotes = globalQuoteRows.flat();

    const localQuotes = localOptions.map((option) => ({
      id: option.id,
      source: 'LOCAL',
      providerKey: option.providerKey,
      providerName: option.providerName,
      serviceName: option.serviceName,
      etaMinDays: option.etaMinDays,
      etaMaxDays: option.etaMaxDays,
      priceUsd: Number(Number(option.priceUsd || 0).toFixed(2)),
      countryCode: option.countryCode,
      city: option.city,
    }));

    const quotes = [...globalQuotes, ...localQuotes].sort((a, b) => a.priceUsd - b.priceUsd);
    const recommended = quotes[0] || null;

    res.json({
      success: true,
      data: {
        countryCode,
        city: payload.city || '',
        quotes,
        recommendedQuoteId: recommended?.id || null,
      },
    });
  } catch (error) {
    next(error);
  }
  }
);

router.post(
  '/track',
  authenticate,
  authorizePermissions(Permissions.ORDERS_CREATE, Permissions.SHIPPING_MANAGE),
  async (req, res, next) => {
  try {
    const payload = z
      .object({
        providerKey: z.string().min(2),
        trackingNumber: z.string().min(2),
      })
      .parse(req.body);
    const providerKey = normalizeProviderKey(payload.providerKey);
    const provider = (await readShippingIntegrations({ activeOnly: true, providerKey }))[0];
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Shipping provider ${providerKey} is not active.`,
      });
    }
    const values = provider.configValues || {};
    const enabled = readConfigBool(values, 'enableRealtimeTracking', false);
    const trackingApiUrl = readConfigText(values, 'trackingApiUrl');
    if (!enabled || !trackingApiUrl) {
      return res.status(400).json({
        success: false,
        message: `${provider.displayName} tracking endpoint is not configured yet.`,
      });
    }
    const token = await requestProviderToken(values).catch(() => '');
    const apiKey = readConfigText(values, 'apiKey');
    const method = readConfigText(values, 'trackingMethod').toUpperCase() === 'POST' ? 'POST' : 'GET';
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...parseHeadersJson(values),
    };
    if (apiKey && !headers.Authorization) headers.Authorization = `Bearer ${apiKey}`;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (method === 'POST') headers['Content-Type'] = 'application/json';
    const requestUrl =
      method === 'GET'
        ? `${trackingApiUrl}${trackingApiUrl.includes('?') ? '&' : '?'}trackingNumber=${encodeURIComponent(
            payload.trackingNumber
          )}`
        : trackingApiUrl;
    const response = await fetch(requestUrl, {
      method,
      headers,
      body:
        method === 'POST'
          ? JSON.stringify({
              trackingNumber: payload.trackingNumber,
              providerKey: provider.providerKey,
            })
          : undefined,
    });
    const data = await parseJsonResponse(response);
    if (!response.ok) {
      return res.status(502).json({
        success: false,
        message:
          readConfigText(parseObject(data), 'message', 'error_description', 'error') ||
          'Failed to query carrier tracking endpoint.',
      });
    }
    const normalized = normalizeTrackingResult(data);
    res.json({
      success: true,
      data: {
        providerKey: provider.providerKey,
        providerName: provider.displayName,
        trackingNumber: normalized.trackingNumber || payload.trackingNumber,
        status: normalized.status,
        events: normalized.events,
      },
    });
  } catch (error) {
    next(error);
  }
  }
);

export default router;
