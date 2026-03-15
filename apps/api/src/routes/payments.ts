import { randomUUID } from 'crypto';
import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma, PaymentStatus, OrderStatus, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

// Compatibility aliases for legacy frontend route variants.
router.use((req, _res, next) => {
  if (req.path === '/create_session') {
    req.url = req.url.replace('/create_session', '/create-session');
  } else if (req.path === '/session/create') {
    req.url = req.url.replace('/session/create', '/create-session');
  } else if (req.path === '/intent/create') {
    req.url = req.url.replace('/intent/create', '/create-intent');
  }
  next();
});

type IntegrationFieldType = 'TEXT' | 'PASSWORD' | 'URL' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'TEXTAREA';
type ProviderMode = 'TEST' | 'LIVE';
type CheckoutType = 'INLINE' | 'REDIRECT';

type IntegrationField = {
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

type IntegrationTemplate = {
  providerKey: string;
  displayName: string;
  checkoutType: CheckoutType;
  mode: ProviderMode;
  configSchema: IntegrationField[];
  configValues: Record<string, unknown>;
};

type PaymentIntegrationRow = {
  id: string;
  providerKey: string;
  displayName: string;
  checkoutType: CheckoutType;
  mode: ProviderMode;
  isActive: boolean;
  configSchema: IntegrationField[];
  configValues: Record<string, unknown>;
  notes: string | null;
  updatedAt: string;
};

const FALLBACK_FRONTEND_URL =
  String(process.env.FRONTEND_URL || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean) || 'http://localhost:5173';

const BUILTIN_PROVIDER_TEMPLATES: IntegrationTemplate[] = [
  {
    providerKey: 'STRIPE',
    displayName: 'Stripe',
    checkoutType: 'INLINE',
    mode: 'TEST',
    configSchema: [
      {
        key: 'publishableKey',
        label: 'Publishable Key',
        type: 'TEXT',
        required: true,
        helpText: 'Public client key used by Stripe.js.',
        exposePublic: true,
        sortOrder: 1,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'PASSWORD',
        required: true,
        helpText: 'Private API key used by backend payment calls.',
        isSecret: true,
        sortOrder: 2,
      },
      {
        key: 'webhookSecret',
        label: 'Webhook Secret',
        type: 'PASSWORD',
        required: false,
        isSecret: true,
        sortOrder: 3,
      },
    ],
    configValues: {},
  },
  {
    providerKey: 'FLUTTERWAVE',
    displayName: 'Flutterwave',
    checkoutType: 'REDIRECT',
    mode: 'TEST',
    configSchema: [
      {
        key: 'publicKey',
        label: 'Public Key',
        type: 'TEXT',
        required: true,
        exposePublic: true,
        sortOrder: 1,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'PASSWORD',
        required: true,
        isSecret: true,
        sortOrder: 2,
      },
      {
        key: 'encryptionKey',
        label: 'Encryption Key',
        type: 'PASSWORD',
        required: false,
        isSecret: true,
        sortOrder: 3,
      },
      {
        key: 'paymentOptions',
        label: 'Payment Options',
        type: 'TEXT',
        required: false,
        placeholder: 'card,banktransfer,ussd',
        sortOrder: 4,
      },
      {
        key: 'redirectUrl',
        label: 'Default Redirect URL',
        type: 'URL',
        required: false,
        exposePublic: true,
        sortOrder: 5,
      },
    ],
    configValues: {},
  },
  {
    providerKey: 'PAYPAL',
    displayName: 'PayPal',
    checkoutType: 'REDIRECT',
    mode: 'TEST',
    configSchema: [
      {
        key: 'clientId',
        label: 'Client ID',
        type: 'TEXT',
        required: true,
        exposePublic: true,
        sortOrder: 1,
      },
      {
        key: 'clientSecret',
        label: 'Client Secret',
        type: 'PASSWORD',
        required: true,
        isSecret: true,
        sortOrder: 2,
      },
      {
        key: 'environment',
        label: 'Environment',
        type: 'SELECT',
        required: true,
        options: ['sandbox', 'live'],
        sortOrder: 3,
      },
      {
        key: 'returnUrl',
        label: 'Default Return URL',
        type: 'URL',
        required: false,
        exposePublic: true,
        sortOrder: 4,
      },
      {
        key: 'cancelUrl',
        label: 'Default Cancel URL',
        type: 'URL',
        required: false,
        exposePublic: true,
        sortOrder: 5,
      },
    ],
    configValues: {
      environment: 'sandbox',
    },
  },
];

const DEFAULT_TEMPLATE_BY_PROVIDER = new Map(
  BUILTIN_PROVIDER_TEMPLATES.map((template) => [template.providerKey, template])
);
const BUILTIN_PROVIDER_KEYS = new Set(BUILTIN_PROVIDER_TEMPLATES.map((template) => template.providerKey));
let paymentIntegrationSchemaEnsured = false;

const normalizeProviderKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

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

const normalizeConfigSchema = (rawFields: unknown): IntegrationField[] =>
  parseArray(rawFields)
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
        options: parseArray(row.options).map((option) => String(option || '')).filter(Boolean),
        isSecret: Boolean(row.isSecret),
        exposePublic: Boolean(row.exposePublic),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : index,
      } as IntegrationField;
    })
    .filter((entry): entry is IntegrationField => Boolean(entry))
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

const normalizeCheckoutType = (value: unknown): CheckoutType =>
  String(value || '').toUpperCase() === 'REDIRECT' ? 'REDIRECT' : 'INLINE';

const normalizeProviderMode = (value: unknown): ProviderMode =>
  String(value || '').toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST';

async function ensurePaymentIntegrationSchema() {
  if (paymentIntegrationSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PaymentIntegration" (
      "id" TEXT NOT NULL,
      "providerKey" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "checkoutType" TEXT NOT NULL DEFAULT 'INLINE',
      "mode" TEXT NOT NULL DEFAULT 'TEST',
      "isActive" BOOLEAN NOT NULL DEFAULT false,
      "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "notes" TEXT,
      "createdById" TEXT,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PaymentIntegration_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PaymentIntegration_providerKey_key" ON "PaymentIntegration"("providerKey")`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PaymentIntegration" ADD COLUMN IF NOT EXISTS "configSchema" JSONB NOT NULL DEFAULT '[]'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PaymentIntegration" ADD COLUMN IF NOT EXISTS "configValues" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "PaymentIntegration" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await prisma.$executeRawUnsafe(
    `UPDATE "PaymentIntegration" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`
  );

  for (const template of BUILTIN_PROVIDER_TEMPLATES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "PaymentIntegration"
        ("id","providerKey","displayName","checkoutType","mode","isActive","configSchema","configValues","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,false,$6::jsonb,$7::jsonb,NOW(),NOW())
       ON CONFLICT ("providerKey") DO NOTHING`,
      randomUUID(),
      template.providerKey,
      template.displayName,
      template.checkoutType,
      template.mode,
      JSON.stringify(template.configSchema),
      JSON.stringify(template.configValues)
    );
  }

  paymentIntegrationSchemaEnsured = true;
}

async function readPaymentIntegrations(params?: { activeOnly?: boolean; providerKey?: string }) {
  await ensurePaymentIntegrationSchema();
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
    `SELECT "id","providerKey","displayName","checkoutType","mode","isActive","configSchema","configValues","notes","updatedAt"
     FROM "PaymentIntegration"
     ${whereClause}
     ORDER BY "displayName" ASC, "providerKey" ASC`,
    ...values
  );

  return rows.map((row) => {
    const configSchema = normalizeConfigSchema(row.configSchema);
    return {
      id: String(row.id),
      providerKey: normalizeProviderKey(row.providerKey),
      displayName: String(row.displayName || row.providerKey || 'Payment Provider'),
      checkoutType: normalizeCheckoutType(row.checkoutType),
      mode: normalizeProviderMode(row.mode),
      isActive: Boolean(row.isActive),
      configSchema,
      configValues: parseObject(row.configValues),
      notes: row.notes ? String(row.notes) : null,
      updatedAt: new Date(row.updatedAt || Date.now()).toISOString(),
    } as PaymentIntegrationRow;
  });
}

async function resolveProviderForUserPayment(providerKeyInput: string) {
  const providerKey = normalizeProviderKey(providerKeyInput);
  if (!providerKey) return null;
  const activeProvider = (await readPaymentIntegrations({ activeOnly: true, providerKey }))[0] || null;
  if (activeProvider) return activeProvider;

  const anyActive = await readPaymentIntegrations({ activeOnly: true });
  if (anyActive.length === 0) {
    const configuredProvider = (await readPaymentIntegrations({ providerKey }))[0] || null;
    if (configuredProvider && providerHasCheckoutCredentials(configuredProvider)) return configuredProvider;
  }

  if (providerKey === 'STRIPE' && String(process.env.STRIPE_SECRET_KEY || '').trim()) {
    return {
      id: 'fallback-stripe',
      providerKey: 'STRIPE',
      displayName: 'Stripe',
      checkoutType: 'INLINE',
      mode: 'TEST',
      isActive: true,
      configSchema: [],
      configValues: {},
      notes: null,
      updatedAt: new Date().toISOString(),
    } as PaymentIntegrationRow;
  }
  return null;
}

const providerHasCheckoutCredentials = (provider: PaymentIntegrationRow) => {
  if (provider.providerKey === 'STRIPE') {
    return Boolean(readIntegrationValue(provider, 'secretKey') || String(process.env.STRIPE_SECRET_KEY || '').trim());
  }
  if (provider.providerKey === 'FLUTTERWAVE') {
    return Boolean(readIntegrationValue(provider, 'secretKey'));
  }
  if (provider.providerKey === 'PAYPAL') {
    return Boolean(readIntegrationValue(provider, 'clientId') && readIntegrationValue(provider, 'clientSecret'));
  }
  return false;
};

async function upsertPaymentIntegration(params: {
  providerKey: string;
  displayName?: string;
  checkoutType?: CheckoutType;
  mode?: ProviderMode;
  isActive?: boolean;
  configSchema?: IntegrationField[];
  configValues?: Record<string, unknown>;
  notes?: string | null;
  userId: string;
}) {
  const providerKey = normalizeProviderKey(params.providerKey);
  if (!providerKey) {
    throw Object.assign(new Error('Provider key is required.'), { status: 400 });
  }
  const existing = (await readPaymentIntegrations({ providerKey }))[0] || null;
  const template = DEFAULT_TEMPLATE_BY_PROVIDER.get(providerKey);
  const displayName =
    String(params.displayName || existing?.displayName || template?.displayName || providerKey).trim() || providerKey;
  const checkoutType = params.checkoutType || existing?.checkoutType || template?.checkoutType || 'INLINE';
  const mode = params.mode || existing?.mode || template?.mode || 'TEST';
  const isActive = typeof params.isActive === 'boolean' ? params.isActive : existing?.isActive || false;
  const schemaSource = params.configSchema || existing?.configSchema || template?.configSchema || [];
  const configSchema = normalizeConfigSchema(schemaSource);
  const configValues = parseObject(params.configValues || existing?.configValues || template?.configValues || {});
  const notes = params.notes === undefined ? existing?.notes || null : params.notes;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "PaymentIntegration"
      ("id","providerKey","displayName","checkoutType","mode","isActive","configSchema","configValues","notes","createdById","updatedById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10,$11,NOW(),NOW())
     ON CONFLICT ("providerKey")
     DO UPDATE SET
       "displayName" = EXCLUDED."displayName",
       "checkoutType" = EXCLUDED."checkoutType",
       "mode" = EXCLUDED."mode",
       "isActive" = EXCLUDED."isActive",
       "configSchema" = EXCLUDED."configSchema",
       "configValues" = EXCLUDED."configValues",
       "notes" = EXCLUDED."notes",
       "updatedById" = EXCLUDED."updatedById",
       "updatedAt" = NOW()`,
    existing?.id || randomUUID(),
    providerKey,
    displayName,
    checkoutType,
    mode,
    isActive,
    JSON.stringify(configSchema),
    JSON.stringify(configValues),
    notes,
    params.userId,
    params.userId
  );

  const row = (await readPaymentIntegrations({ providerKey }))[0];
  if (!row) throw Object.assign(new Error('Failed to save payment integration.'), { status: 500 });
  return row;
}

function readIntegrationValue(integration: PaymentIntegrationRow, ...candidateKeys: string[]) {
  const values = integration.configValues || {};
  for (const key of candidateKeys) {
    const value = values[key];
    if (value !== undefined && value !== null && String(value).trim().length > 0) {
      return String(value).trim();
    }
  }
  return '';
}

function getStripeClient(integration?: PaymentIntegrationRow | null): Stripe | null {
  const secretKey =
    readIntegrationValue(integration || ({} as PaymentIntegrationRow), 'secretKey', 'stripeSecretKey') ||
    String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!secretKey) return null;
  return new Stripe(secretKey);
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

async function getPayPalAccessToken(integration: PaymentIntegrationRow) {
  const clientId = readIntegrationValue(integration, 'clientId');
  const clientSecret = readIntegrationValue(integration, 'clientSecret');
  if (!clientId || !clientSecret) {
    throw Object.assign(new Error('PayPal client credentials are not configured.'), { status: 503 });
  }
  const environment = readIntegrationValue(integration, 'environment').toLowerCase() === 'live' ? 'live' : 'sandbox';
  const baseUrl = environment === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basicAuth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const data = await parseJsonResponse(response);
  if (!response.ok || !data?.access_token) {
    const message = String(data?.error_description || data?.error || 'Failed to authenticate with PayPal.');
    throw Object.assign(new Error(message), { status: 502 });
  }
  return {
    token: String(data.access_token),
    baseUrl,
  };
}

export type PaymentSessionInput = {
  user: { id: string; email: string; firstName?: string | null; lastName?: string | null };
  providerKey: string;
  amount: number;
  currency: string;
  reference?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customer?: { email?: string; name?: string; phone?: string };
};

export async function createPaymentSessionForUser(input: PaymentSessionInput) {
  const providerKey = normalizeProviderKey(input.providerKey);
  const provider = await resolveProviderForUserPayment(providerKey);
  if (!provider) {
    throw Object.assign(new Error(`Payment provider ${providerKey} is unavailable.`), { status: 404 });
  }

  const amountMajor = Number((input.amount / 100).toFixed(2));
  const currency = String(input.currency || 'usd').toUpperCase();
  const reference = input.reference || `AF-${providerKey}-${Date.now()}`;

  if (provider.providerKey === 'STRIPE') {
    const stripe = getStripeClient(provider);
    if (!stripe) {
      throw Object.assign(new Error('Stripe is not configured. Set secretKey in Payment Integrations.'), { status: 503 });
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: input.amount,
      currency: String(input.currency || 'usd').toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: input.user.id,
        reference,
        provider: provider.providerKey,
      },
    });
    return {
      providerKey: provider.providerKey,
      flow: 'INLINE' as const,
      reference,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  }

  if (provider.providerKey === 'FLUTTERWAVE') {
    const secretKey = readIntegrationValue(provider, 'secretKey');
    if (!secretKey) {
      throw Object.assign(new Error('Flutterwave is not configured. Set secretKey in Payment Integrations.'), { status: 503 });
    }
    const apiBase = readIntegrationValue(provider, 'apiBaseUrl') || 'https://api.flutterwave.com/v3';
    const redirectUrl =
      input.returnUrl ||
      readIntegrationValue(provider, 'redirectUrl') ||
      `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=FLUTTERWAVE`;
    const paymentOptions = readIntegrationValue(provider, 'paymentOptions') || 'card,banktransfer,ussd';

    const response = await fetch(`${apiBase.replace(/\/+$/, '')}/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tx_ref: reference,
        amount: amountMajor,
        currency,
        redirect_url: redirectUrl,
        payment_options: paymentOptions,
        customer: {
          email: input.customer?.email || input.user.email,
          name:
            input.customer?.name ||
            `${input.user.firstName || ''} ${input.user.lastName || ''}`.trim() ||
            'Customer',
          phonenumber: input.customer?.phone || undefined,
        },
        customizations: {
          title: 'African Fashion',
          description: 'Order payment',
        },
        meta: {
          userId: input.user.id,
          platformReference: reference,
        },
      }),
    });
    const data = await parseJsonResponse(response);
    const checkoutUrl = String(data?.data?.link || '');
    if (!response.ok || String(data?.status || '').toLowerCase() !== 'success' || !checkoutUrl) {
      throw Object.assign(new Error(String(data?.message || 'Flutterwave payment initialization failed.')), {
        status: 502,
      });
    }
    return {
      providerKey: provider.providerKey,
      flow: 'REDIRECT' as const,
      reference,
      checkoutUrl,
    };
  }

  if (provider.providerKey === 'PAYPAL') {
    const { token, baseUrl } = await getPayPalAccessToken(provider);
    const returnUrl =
      input.returnUrl ||
      readIntegrationValue(provider, 'returnUrl') ||
      `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=PAYPAL`;
    const cancelUrl =
      input.cancelUrl ||
      readIntegrationValue(provider, 'cancelUrl') ||
      `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=PAYPAL&payment_cancelled=true`;
    const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: reference,
            amount: {
              currency_code: currency,
              value: amountMajor.toFixed(2),
            },
          },
        ],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          user_action: 'PAY_NOW',
        },
      }),
    });
    const data = await parseJsonResponse(response);
    const approveLink = Array.isArray(data?.links)
      ? data.links.find((entry: any) => String(entry?.rel || '').toLowerCase() === 'approve')?.href
      : '';
    if (!response.ok || !approveLink) {
      throw Object.assign(new Error(String(data?.message || data?.name || 'PayPal payment initialization failed.')), {
        status: 502,
      });
    }
    return {
      providerKey: provider.providerKey,
      flow: 'REDIRECT' as const,
      reference: String(data?.id || reference),
      checkoutUrl: String(approveLink),
    };
  }

  throw Object.assign(new Error(`${provider.providerKey} initialization is not supported yet.`), { status: 400 });
}

export async function verifyPaymentForUser(input: {
  userId: string;
  providerKey: string;
  reference: string;
  payerId?: string;
}) {
  const providerKey = normalizeProviderKey(input.providerKey);
  const provider = await resolveProviderForUserPayment(providerKey);
  if (!provider) {
    throw Object.assign(new Error(`Payment provider ${providerKey} is unavailable.`), { status: 404 });
  }

  if (provider.providerKey === 'STRIPE') {
    const stripe = getStripeClient(provider);
    if (!stripe) {
      throw Object.assign(new Error('Stripe is not configured.'), { status: 503 });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(input.reference);
    if (paymentIntent.metadata?.userId && String(paymentIntent.metadata.userId) !== String(input.userId)) {
      throw Object.assign(new Error('Payment reference does not belong to this user.'), { status: 403 });
    }
    const isPaid = paymentIntent.status === 'succeeded';
    return {
      providerKey: provider.providerKey,
      isPaid,
      paymentReference: paymentIntent.id,
      status: paymentIntent.status,
    };
  }

  if (provider.providerKey === 'FLUTTERWAVE') {
    const secretKey = readIntegrationValue(provider, 'secretKey');
    const apiBase = readIntegrationValue(provider, 'apiBaseUrl') || 'https://api.flutterwave.com/v3';
    if (!secretKey) {
      throw Object.assign(new Error('Flutterwave is not configured.'), { status: 503 });
    }
    const response = await fetch(
      `${apiBase.replace(/\/+$/, '')}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(input.reference)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = await parseJsonResponse(response);
    if (data?.data?.meta?.userId && String(data.data.meta.userId) !== String(input.userId)) {
      throw Object.assign(new Error('Payment reference does not belong to this user.'), { status: 403 });
    }
    const transactionStatus = String(data?.data?.status || '').toLowerCase();
    const isPaid = response.ok && String(data?.status || '').toLowerCase() === 'success' && transactionStatus === 'successful';
    return {
      providerKey: provider.providerKey,
      isPaid,
      paymentReference: String(data?.data?.id || input.reference),
      status: String(data?.data?.status || data?.status || 'unknown'),
    };
  }

  if (provider.providerKey === 'PAYPAL') {
    const { token, baseUrl } = await getPayPalAccessToken(provider);
    const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(input.reference)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    let data = await parseJsonResponse(captureResponse);
    if (!captureResponse.ok) {
      const detail = String(data?.details?.[0]?.issue || '');
      if (detail === 'ORDER_ALREADY_CAPTURED') {
        const statusResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(input.reference)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        data = await parseJsonResponse(statusResponse);
      }
    }
    const status = String(data?.status || '').toUpperCase();
    const isPaid = status === 'COMPLETED';
    return {
      providerKey: provider.providerKey,
      isPaid,
      paymentReference: String(data?.id || input.reference),
      status: status || 'UNKNOWN',
    };
  }

  throw Object.assign(new Error(`Verification is not supported for provider ${provider.providerKey}.`), { status: 400 });
}

router.get(
  '/admin/integrations',
  authenticate,
  authorizePermissions(Permissions.PAYMENTS_MANAGE),
  async (_req, res, next) => {
    try {
      const providers = await readPaymentIntegrations();
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
  authorizePermissions(Permissions.PAYMENTS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          providerKey: z.string().min(2),
          displayName: z.string().min(2).optional(),
          checkoutType: z.enum(['INLINE', 'REDIRECT']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);

      const provider = await upsertPaymentIntegration({
        providerKey: payload.providerKey,
        displayName: payload.displayName,
        checkoutType: payload.checkoutType,
        mode: payload.mode,
        isActive: payload.isActive,
        configSchema: payload.configSchema as IntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });

      res.status(201).json({
        success: true,
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.PAYMENTS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = z
        .object({
          displayName: z.string().min(2).optional(),
          checkoutType: z.enum(['INLINE', 'REDIRECT']).optional(),
          mode: z.enum(['TEST', 'LIVE']).optional(),
          isActive: z.boolean().optional(),
          configSchema: z.array(z.record(z.any())).optional(),
          configValues: z.record(z.any()).optional(),
          notes: z.string().nullable().optional(),
        })
        .parse(req.body);

      const provider = await upsertPaymentIntegration({
        providerKey: req.params.providerKey,
        displayName: payload.displayName,
        checkoutType: payload.checkoutType,
        mode: payload.mode,
        isActive: payload.isActive,
        configSchema: payload.configSchema as IntegrationField[] | undefined,
        configValues: payload.configValues,
        notes: payload.notes,
        userId: req.user!.id,
      });

      res.json({
        success: true,
        data: provider,
      });
    } catch (error) {
      next(error);
    }
  }
);

router.delete(
  '/admin/integrations/:providerKey',
  authenticate,
  authorizePermissions(Permissions.PAYMENTS_MANAGE),
  async (req, res, next) => {
    try {
      const providerKey = normalizeProviderKey(req.params.providerKey);
      if (!providerKey) {
        return res.status(400).json({ success: false, message: 'Provider key is required.' });
      }
      await ensurePaymentIntegrationSchema();
      if (BUILTIN_PROVIDER_KEYS.has(providerKey)) {
        await prisma.$executeRawUnsafe(
          `UPDATE "PaymentIntegration"
           SET "isActive" = false, "updatedById" = $1, "updatedAt" = NOW()
           WHERE UPPER("providerKey") = $2`,
          req.user!.id,
          providerKey
        );
      } else {
        await prisma.$executeRawUnsafe(`DELETE FROM "PaymentIntegration" WHERE UPPER("providerKey") = $1`, providerKey);
      }
      res.json({ success: true, message: 'Payment integration removed.' });
    } catch (error) {
      next(error);
    }
  }
);

router.get('/options', authenticate, authorizePermissions(Permissions.PAYMENTS_CREATE), async (_req, res, next) => {
  try {
    let providers = await readPaymentIntegrations({ activeOnly: true });
    if (providers.length === 0) {
      const configuredFallback = (await readPaymentIntegrations()).filter((provider) =>
        providerHasCheckoutCredentials(provider)
      );
      if (configuredFallback.length > 0) {
        providers = configuredFallback;
      }
    }
    if (providers.length === 0 && String(process.env.STRIPE_SECRET_KEY || '').trim()) {
      providers = [
        {
          id: 'fallback-stripe',
          providerKey: 'STRIPE',
          displayName: 'Stripe',
          checkoutType: 'INLINE',
          mode: 'TEST',
          isActive: true,
          configSchema: [
            {
              key: 'publishableKey',
              label: 'Publishable Key',
              type: 'TEXT',
              required: false,
              exposePublic: true,
            },
          ],
          configValues: {
            publishableKey: String(process.env.STRIPE_PUBLIC_KEY || ''),
          },
          notes: 'Fallback environment Stripe config',
          updatedAt: new Date().toISOString(),
        },
      ];
    }
    const options = providers.map((provider) => {
      const publicConfig: Record<string, unknown> = {};
      for (const field of provider.configSchema) {
        if (!field.exposePublic) continue;
        publicConfig[field.key] = provider.configValues[field.key];
      }
      return {
        providerKey: provider.providerKey,
        displayName: provider.displayName,
        checkoutType: provider.checkoutType,
        mode: provider.mode,
        publicConfig,
      };
    });
    res.json({
      success: true,
      data: {
        providers: options,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/create-session', authenticate, authorizePermissions(Permissions.PAYMENTS_CREATE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        providerKey: z.string().min(2),
        amount: z.number().int().positive().optional(),
        amountUsd: z.number().positive().optional(),
        currency: z.string().min(3).max(3).default('usd'),
        reference: z.string().min(3).max(120).optional(),
        returnUrl: z.string().url().optional(),
        cancelUrl: z.string().url().optional(),
        customer: z
          .object({
            email: z.string().email().optional(),
            name: z.string().min(1).optional(),
            phone: z.string().min(3).optional(),
          })
          .optional(),
      })
      .parse(req.body);
    const amountMinor =
      Number.isFinite(Number(payload.amount)) && Number(payload.amount) > 0
        ? Math.round(Number(payload.amount))
        : Number.isFinite(Number(payload.amountUsd)) && Number(payload.amountUsd) > 0
          ? Math.round(Number(payload.amountUsd) * 100)
          : 0;
    if (!amountMinor || amountMinor <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amount or amountUsd is required and must be positive.',
      });
    }

    const providerKey = normalizeProviderKey(payload.providerKey);
    const provider =
      (await readPaymentIntegrations({ activeOnly: true, providerKey }))[0] ||
      (providerKey === 'STRIPE' && String(process.env.STRIPE_SECRET_KEY || '').trim()
        ? ({
            id: 'fallback-stripe',
            providerKey: 'STRIPE',
            displayName: 'Stripe',
            checkoutType: 'INLINE',
            mode: 'TEST',
            isActive: true,
            configSchema: [],
            configValues: {},
            notes: null,
            updatedAt: new Date().toISOString(),
          } as PaymentIntegrationRow)
        : null);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Payment provider ${providerKey} is not active.`,
      });
    }

    const amountMajor = Number((amountMinor / 100).toFixed(2));
    const currency = payload.currency.toUpperCase();
    const reference = payload.reference || `AF-${providerKey}-${Date.now()}`;

    if (provider.providerKey === 'STRIPE') {
      const stripe = getStripeClient(provider);
      if (!stripe) {
        return res.status(503).json({
          success: false,
          message: 'Stripe is not configured. Set secretKey in Payment Integrations.',
        });
      }
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountMinor,
        currency: payload.currency.toLowerCase(),
        automatic_payment_methods: { enabled: true },
        metadata: {
          userId: req.user!.id,
          reference,
          provider: provider.providerKey,
        },
      });
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          flow: 'INLINE',
          reference,
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        },
      });
    }

    if (provider.providerKey === 'FLUTTERWAVE') {
      const secretKey = readIntegrationValue(provider, 'secretKey');
      if (!secretKey) {
        return res.status(503).json({
          success: false,
          message: 'Flutterwave is not configured. Set secretKey in Payment Integrations.',
        });
      }
      const apiBase = readIntegrationValue(provider, 'apiBaseUrl') || 'https://api.flutterwave.com/v3';
      const redirectUrl =
        payload.returnUrl ||
        readIntegrationValue(provider, 'redirectUrl') ||
        `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=FLUTTERWAVE`;
      const paymentOptions = readIntegrationValue(provider, 'paymentOptions') || 'card,banktransfer,ussd';

      const response = await fetch(`${apiBase.replace(/\/+$/, '')}/payments`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tx_ref: reference,
          amount: amountMajor,
          currency,
          redirect_url: redirectUrl,
          payment_options: paymentOptions,
          customer: {
            email: payload.customer?.email || req.user!.email,
            name: payload.customer?.name || `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim() || 'Customer',
            phonenumber: payload.customer?.phone || undefined,
          },
          customizations: {
            title: 'African Fashion',
            description: 'Order payment',
          },
          meta: {
            userId: req.user!.id,
            platformReference: reference,
          },
        }),
      });
      const data = await parseJsonResponse(response);
      const checkoutUrl = String(data?.data?.link || '');
      if (!response.ok || String(data?.status || '').toLowerCase() !== 'success' || !checkoutUrl) {
        return res.status(502).json({
          success: false,
          message: String(data?.message || 'Flutterwave payment initialization failed.'),
        });
      }
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          flow: 'REDIRECT',
          reference,
          checkoutUrl,
        },
      });
    }

    if (provider.providerKey === 'PAYPAL') {
      const { token, baseUrl } = await getPayPalAccessToken(provider);
      const returnUrl =
        payload.returnUrl ||
        readIntegrationValue(provider, 'returnUrl') ||
        `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=PAYPAL`;
      const cancelUrl =
        payload.cancelUrl ||
        readIntegrationValue(provider, 'cancelUrl') ||
        `${FALLBACK_FRONTEND_URL}/checkout?payment_provider=PAYPAL&payment_cancelled=true`;
      const response = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              reference_id: reference,
              amount: {
                currency_code: currency,
                value: amountMajor.toFixed(2),
              },
            },
          ],
          application_context: {
            return_url: returnUrl,
            cancel_url: cancelUrl,
            user_action: 'PAY_NOW',
          },
        }),
      });
      const data = await parseJsonResponse(response);
      const approveLink = Array.isArray(data?.links)
        ? data.links.find((entry: any) => String(entry?.rel || '').toLowerCase() === 'approve')?.href
        : '';
      if (!response.ok || !approveLink) {
        return res.status(502).json({
          success: false,
          message: String(data?.message || data?.name || 'PayPal payment initialization failed.'),
        });
      }
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          flow: 'REDIRECT',
          reference: String(data?.id || reference),
          checkoutUrl: String(approveLink),
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: `${provider.providerKey} initialization is not supported yet.`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/verify', authenticate, authorizePermissions(Permissions.PAYMENTS_CREATE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        providerKey: z.string().min(2),
        reference: z.string().min(1),
        payerId: z.string().optional(),
      })
      .parse(req.body);
    const providerKey = normalizeProviderKey(payload.providerKey);
    const provider = (await readPaymentIntegrations({ activeOnly: true, providerKey }))[0];
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: `Payment provider ${providerKey} is not active.`,
      });
    }

    if (provider.providerKey === 'STRIPE') {
      const stripe = getStripeClient(provider);
      if (!stripe) {
        return res.status(503).json({ success: false, message: 'Stripe is not configured.' });
      }
      const paymentIntent = await stripe.paymentIntents.retrieve(payload.reference);
      const isPaid = paymentIntent.status === 'succeeded';
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          isPaid,
          paymentReference: paymentIntent.id,
          status: paymentIntent.status,
        },
      });
    }

    if (provider.providerKey === 'FLUTTERWAVE') {
      const secretKey = readIntegrationValue(provider, 'secretKey');
      const apiBase = readIntegrationValue(provider, 'apiBaseUrl') || 'https://api.flutterwave.com/v3';
      if (!secretKey) {
        return res.status(503).json({ success: false, message: 'Flutterwave is not configured.' });
      }
      const response = await fetch(
        `${apiBase.replace(/\/+$/, '')}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(payload.reference)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await parseJsonResponse(response);
      const transactionStatus = String(data?.data?.status || '').toLowerCase();
      const isPaid = response.ok && String(data?.status || '').toLowerCase() === 'success' && transactionStatus === 'successful';
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          isPaid,
          paymentReference: String(data?.data?.id || payload.reference),
          status: String(data?.data?.status || data?.status || 'unknown'),
        },
      });
    }

    if (provider.providerKey === 'PAYPAL') {
      const { token, baseUrl } = await getPayPalAccessToken(provider);
      const captureResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(payload.reference)}/capture`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      let data = await parseJsonResponse(captureResponse);
      if (!captureResponse.ok) {
        const detail = String(data?.details?.[0]?.issue || '');
        if (detail === 'ORDER_ALREADY_CAPTURED') {
          const statusResponse = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(payload.reference)}`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          data = await parseJsonResponse(statusResponse);
        }
      }
      const status = String(data?.status || '').toUpperCase();
      const isPaid = status === 'COMPLETED';
      return res.json({
        success: true,
        data: {
          providerKey: provider.providerKey,
          isPaid,
          paymentReference: String(data?.id || payload.reference),
          status: status || 'UNKNOWN',
        },
      });
    }

    return res.status(400).json({
      success: false,
      message: `Verification is not supported for provider ${provider.providerKey}.`,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/create-intent', authenticate, authorizePermissions(Permissions.PAYMENTS_CREATE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        amount: z.number().int().positive(),
        currency: z.string().min(3).max(3).default('usd'),
      })
      .parse(req.body);

    const stripeProvider = (await readPaymentIntegrations({ activeOnly: true, providerKey: 'STRIPE' }))[0] || null;
    const stripe = getStripeClient(stripeProvider);
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Stripe payment service is not configured.',
      });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: payload.amount,
      currency: payload.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: req.user!.id,
      },
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/confirm', authenticate, authorizePermissions(Permissions.PAYMENTS_CREATE), async (req, res, next) => {
  try {
    const schema = z.object({
      paymentIntentId: z.string().min(1),
    });
    const { paymentIntentId } = schema.parse(req.body);
    const stripeProvider = (await readPaymentIntegrations({ activeOnly: true, providerKey: 'STRIPE' }))[0] || null;
    const stripe = getStripeClient(stripeProvider);
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: 'Stripe payment service is not configured.',
      });
    }
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.metadata?.userId && paymentIntent.metadata.userId !== req.user!.id) {
      return res.status(403).json({
        success: false,
        message: 'Payment intent does not belong to this user.',
      });
    }
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Payment not completed. Current status: ${paymentIntent.status}`,
      });
    }
    const updated = await prisma.order.updateMany({
      where: {
        customerId: req.user!.id,
        paymentIntentId,
      },
      data: {
        paymentStatus: PaymentStatus.COMPLETED,
        status: OrderStatus.PAYMENT_CONFIRMED,
        paidAt: new Date(),
      },
    });
    res.json({
      success: true,
      data: {
        paymentIntentId,
        updatedOrders: updated.count,
      },
    });
  } catch (error) {
    next(error);
  }
});

type VendorRoleToken = 'FABRIC_SELLER' | 'FASHION_DESIGNER';
type VendorWithdrawalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';

type VendorPaymentConfig = {
  releaseDelayDays: number;
  minimumWithdrawalUsd: number;
  slaHours: number;
  platformFeePercent: number;
  withdrawalOptions: string[];
  payoutIntegrationProviders: string[];
  notes?: string;
};

let vendorPaymentSchemaEnsured = false;

const DEFAULT_VENDOR_PAYMENT_CONFIG: VendorPaymentConfig = {
  releaseDelayDays: 7,
  minimumWithdrawalUsd: 25,
  slaHours: 72,
  platformFeePercent: 0,
  withdrawalOptions: ['BANK_TRANSFER', 'MOBILE_MONEY', 'PAYPAL'],
  payoutIntegrationProviders: ['BANK_TRANSFER'],
  notes: '',
};

const getVendorRoleFromUser = (role: UserRole): VendorRoleToken | null => {
  if (role === UserRole.FABRIC_SELLER) return 'FABRIC_SELLER';
  if (role === UserRole.FASHION_DESIGNER) return 'FASHION_DESIGNER';
  return null;
};

const normalizeVendorRoleToken = (value: unknown): VendorRoleToken | null => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'FABRIC_SELLER' || token === 'SELLER') return 'FABRIC_SELLER';
  if (token === 'FASHION_DESIGNER' || token === 'DESIGNER') return 'FASHION_DESIGNER';
  return null;
};

const normalizeWithdrawalStatus = (value: unknown): VendorWithdrawalStatus | null => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'PENDING') return 'PENDING';
  if (token === 'APPROVED') return 'APPROVED';
  if (token === 'REJECTED') return 'REJECTED';
  if (token === 'PAID') return 'PAID';
  if (token === 'CANCELLED') return 'CANCELLED';
  return null;
};

const parsePositiveNumber = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const normalizeVendorPaymentConfig = (value: unknown): VendorPaymentConfig => {
  const objectValue = parseObject(value);
  return {
    releaseDelayDays: Math.max(0, Math.floor(parsePositiveNumber(objectValue.releaseDelayDays, DEFAULT_VENDOR_PAYMENT_CONFIG.releaseDelayDays))),
    minimumWithdrawalUsd: Number(parsePositiveNumber(objectValue.minimumWithdrawalUsd, DEFAULT_VENDOR_PAYMENT_CONFIG.minimumWithdrawalUsd).toFixed(2)),
    slaHours: Math.max(1, Math.floor(parsePositiveNumber(objectValue.slaHours, DEFAULT_VENDOR_PAYMENT_CONFIG.slaHours))),
    platformFeePercent: Number(parsePositiveNumber(objectValue.platformFeePercent, DEFAULT_VENDOR_PAYMENT_CONFIG.platformFeePercent).toFixed(2)),
    withdrawalOptions: parseArray(objectValue.withdrawalOptions)
      .map((entry) => String(entry || '').trim().toUpperCase())
      .filter(Boolean),
    payoutIntegrationProviders: parseArray(objectValue.payoutIntegrationProviders)
      .map((entry) => String(entry || '').trim().toUpperCase())
      .filter(Boolean),
    notes: objectValue.notes ? String(objectValue.notes) : '',
  };
};

async function ensureVendorPaymentSchema() {
  if (vendorPaymentSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "VendorPaymentConfig" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "updatedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorPaymentConfig_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorPaymentConfig_key_key" ON "VendorPaymentConfig"("key")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "VendorWithdrawalMethod" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "methodType" TEXT NOT NULL,
      "accountName" TEXT,
      "accountNumber" TEXT,
      "bankName" TEXT,
      "routingNumber" TEXT,
      "walletAddress" TEXT,
      "providerName" TEXT,
      "currencyCode" TEXT NOT NULL DEFAULT 'USD',
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorWithdrawalMethod_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VendorWithdrawalMethod_userId_idx" ON "VendorWithdrawalMethod"("userId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "VendorWithdrawalRequest" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "methodId" TEXT NOT NULL,
      "amountUsd" DECIMAL(10,2) NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "notes" TEXT,
      "adminNotes" TEXT,
      "payoutReference" TEXT,
      "processedById" TEXT,
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorWithdrawalRequest_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VendorWithdrawalRequest_userId_idx" ON "VendorWithdrawalRequest"("userId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "VendorWithdrawalRequest_status_idx" ON "VendorWithdrawalRequest"("status")`
  );
  vendorPaymentSchemaEnsured = true;
}

async function readVendorPaymentConfig() {
  await ensureVendorPaymentSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "VendorPaymentConfig" WHERE "key" = $1 LIMIT 1`,
    'vendor_payment_config'
  );
  if (rows.length === 0) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorPaymentConfig" ("id","key","value","createdAt","updatedAt")
       VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
      randomUUID(),
      'vendor_payment_config',
      JSON.stringify(DEFAULT_VENDOR_PAYMENT_CONFIG)
    );
    return { ...DEFAULT_VENDOR_PAYMENT_CONFIG };
  }
  return normalizeVendorPaymentConfig(rows[0]?.value);
}

async function saveVendorPaymentConfig(config: VendorPaymentConfig, updatedById: string) {
  await ensureVendorPaymentSchema();
  const normalized = normalizeVendorPaymentConfig(config);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "VendorPaymentConfig" ("id","key","value","updatedById","createdAt","updatedAt")
     VALUES ($1,$2,$3::jsonb,$4,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedById" = EXCLUDED."updatedById", "updatedAt" = NOW()`,
    randomUUID(),
    'vendor_payment_config',
    JSON.stringify(normalized),
    updatedById
  );
  return normalized;
}

type VendorEarningRow = {
  orderId: string;
  orderNumber: string;
  itemName: string;
  grossAmountUsd: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  paidAt: string | null;
  vendorUserId: string;
  vendorName: string;
  customerName: string;
};

async function readVendorEarnings(role: VendorRoleToken, options?: { userId?: string }) {
  const values: unknown[] = [];
  const addFilter = (sql: string, value: unknown) => {
    values.push(value);
    return sql.replace('?', String(values.length));
  };

  if (role === 'FABRIC_SELLER') {
    const conditions = ['1=1'];
    if (options?.userId) {
      conditions.push(addFilter(`sp."userId" = $?`, options.userId));
    }
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
        o."id" AS "orderId",
        o."orderNumber",
        o."paymentStatus",
        o."status" AS "orderStatus",
        o."createdAt",
        o."paidAt",
        f."name" AS "itemName",
        (fo."totalPrice")::numeric::text AS "grossAmountUsd",
        sellerUser."id" AS "vendorUserId",
        CONCAT(COALESCE(sellerUser."firstName", ''), ' ', COALESCE(sellerUser."lastName", '')) AS "vendorName",
        CONCAT(COALESCE(customer."firstName", ''), ' ', COALESCE(customer."lastName", '')) AS "customerName"
      FROM "FabricOrderItem" fo
      INNER JOIN "Order" o ON o."id" = fo."orderId"
      INNER JOIN "Fabric" f ON f."id" = fo."fabricId"
      INNER JOIN "FabricSellerProfile" sp ON sp."id" = f."sellerId"
      INNER JOIN "User" sellerUser ON sellerUser."id" = sp."userId"
      LEFT JOIN "User" customer ON customer."id" = o."customerId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY o."createdAt" DESC`,
      ...values
    );
    return rows.map((row) => ({
      orderId: String(row.orderId || ''),
      orderNumber: String(row.orderNumber || ''),
      itemName: String(row.itemName || 'Fabric Order'),
      grossAmountUsd: Number(row.grossAmountUsd || 0),
      paymentStatus: String(row.paymentStatus || ''),
      orderStatus: String(row.orderStatus || ''),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      vendorUserId: String(row.vendorUserId || ''),
      vendorName: String(row.vendorName || '').trim() || 'Seller',
      customerName: String(row.customerName || '').trim() || 'Customer',
    })) as VendorEarningRow[];
  }

  const conditions = ['1=1'];
  if (options?.userId) {
    conditions.push(addFilter(`dp."userId" = $?`, options.userId));
  }
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT * FROM (
      SELECT
        o."id" AS "orderId",
        o."orderNumber",
        o."paymentStatus",
        o."status" AS "orderStatus",
        o."createdAt",
        o."paidAt",
        d."name" AS "itemName",
        (doi."price")::numeric::text AS "grossAmountUsd",
        designerUser."id" AS "vendorUserId",
        CONCAT(COALESCE(designerUser."firstName", ''), ' ', COALESCE(designerUser."lastName", '')) AS "vendorName",
        CONCAT(COALESCE(customer."firstName", ''), ' ', COALESCE(customer."lastName", '')) AS "customerName"
      FROM "DesignOrderItem" doi
      INNER JOIN "Order" o ON o."id" = doi."orderId"
      INNER JOIN "Design" d ON d."id" = doi."designId"
      INNER JOIN "DesignerProfile" dp ON dp."id" = d."designerId"
      INNER JOIN "User" designerUser ON designerUser."id" = dp."userId"
      LEFT JOIN "User" customer ON customer."id" = o."customerId"
      WHERE ${conditions.join(' AND ')}
      UNION ALL
      SELECT
        o."id" AS "orderId",
        o."orderNumber",
        o."paymentStatus",
        o."status" AS "orderStatus",
        o."createdAt",
        o."paidAt",
        rt."name" AS "itemName",
        (rti."price" * rti."quantity")::numeric::text AS "grossAmountUsd",
        designerUser."id" AS "vendorUserId",
        CONCAT(COALESCE(designerUser."firstName", ''), ' ', COALESCE(designerUser."lastName", '')) AS "vendorName",
        CONCAT(COALESCE(customer."firstName", ''), ' ', COALESCE(customer."lastName", '')) AS "customerName"
      FROM "ReadyToWearOrderItem" rti
      INNER JOIN "Order" o ON o."id" = rti."orderId"
      INNER JOIN "ReadyToWear" rt ON rt."id" = rti."readyToWearId"
      INNER JOIN "DesignerProfile" dp ON dp."id" = rt."designerId"
      INNER JOIN "User" designerUser ON designerUser."id" = dp."userId"
      LEFT JOIN "User" customer ON customer."id" = o."customerId"
      WHERE ${conditions.join(' AND ')}
    ) earnings
    ORDER BY "createdAt" DESC`,
    ...values
  );
  return rows.map((row) => ({
    orderId: String(row.orderId || ''),
    orderNumber: String(row.orderNumber || ''),
    itemName: String(row.itemName || 'Design Order'),
    grossAmountUsd: Number(row.grossAmountUsd || 0),
    paymentStatus: String(row.paymentStatus || ''),
    orderStatus: String(row.orderStatus || ''),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
    vendorUserId: String(row.vendorUserId || ''),
    vendorName: String(row.vendorName || '').trim() || 'Designer',
    customerName: String(row.customerName || '').trim() || 'Customer',
  })) as VendorEarningRow[];
}

function applyEarningAvailability(rows: VendorEarningRow[], config: VendorPaymentConfig) {
  const now = Date.now();
  const lockedStatuses = new Set(['REFUNDED', 'REFUND_REQUESTED', 'CANCELLED']);
  return rows.map((row) => {
    const paymentCompleted = String(row.paymentStatus || '').toUpperCase() === 'COMPLETED';
    const blocked = lockedStatuses.has(String(row.orderStatus || '').toUpperCase());
    const settledAt = row.paidAt ? new Date(row.paidAt).getTime() : new Date(row.createdAt).getTime();
    const availableAtMs = settledAt + config.releaseDelayDays * 24 * 60 * 60 * 1000;
    const available = paymentCompleted && !blocked && now >= availableAtMs;
    return {
      ...row,
      availableAt: new Date(availableAtMs).toISOString(),
      isAvailableForWithdrawal: available,
    };
  });
}

async function readVendorWithdrawalRequests(options?: { userId?: string; role?: VendorRoleToken; status?: VendorWithdrawalStatus }) {
  await ensureVendorPaymentSchema();
  const filters: string[] = ['1=1'];
  const values: unknown[] = [];
  if (options?.userId) {
    values.push(options.userId);
    filters.push(`wr."userId" = $${values.length}`);
  }
  if (options?.role) {
    values.push(options.role);
    filters.push(`UPPER(wr."role") = $${values.length}`);
  }
  if (options?.status) {
    values.push(options.status);
    filters.push(`UPPER(wr."status") = $${values.length}`);
  }
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT
      wr."id",
      wr."userId",
      wr."role",
      wr."methodId",
      wr."amountUsd"::numeric::text AS "amountUsd",
      wr."status",
      wr."notes",
      wr."adminNotes",
      wr."payoutReference",
      wr."processedById",
      wr."requestedAt",
      wr."processedAt",
      wr."createdAt",
      wr."updatedAt",
      wm."methodType",
      wm."providerName",
      wm."accountName",
      wm."accountNumber",
      u."firstName",
      u."lastName",
      u."email"
     FROM "VendorWithdrawalRequest" wr
     LEFT JOIN "VendorWithdrawalMethod" wm ON wm."id" = wr."methodId"
     LEFT JOIN "User" u ON u."id" = wr."userId"
     WHERE ${filters.join(' AND ')}
     ORDER BY wr."requestedAt" DESC`,
    ...values
  );
  return rows.map((row) => ({
    id: String(row.id || ''),
    userId: String(row.userId || ''),
    role: normalizeVendorRoleToken(row.role) || 'FABRIC_SELLER',
    methodId: String(row.methodId || ''),
    methodType: String(row.methodType || ''),
    providerName: String(row.providerName || ''),
    accountName: String(row.accountName || ''),
    accountNumber: String(row.accountNumber || ''),
    amountUsd: Number(row.amountUsd || 0),
    status: normalizeWithdrawalStatus(row.status) || 'PENDING',
    notes: row.notes ? String(row.notes) : '',
    adminNotes: row.adminNotes ? String(row.adminNotes) : '',
    payoutReference: row.payoutReference ? String(row.payoutReference) : '',
    processedById: row.processedById ? String(row.processedById) : '',
    requestedAt: row.requestedAt ? new Date(row.requestedAt).toISOString() : new Date().toISOString(),
    processedAt: row.processedAt ? new Date(row.processedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    vendorName: `${String(row.firstName || '').trim()} ${String(row.lastName || '').trim()}`.trim() || 'Vendor',
    vendorEmail: String(row.email || ''),
  }));
}

async function computeVendorWallet(userId: string, role: VendorRoleToken, config: VendorPaymentConfig) {
  const earnings = applyEarningAvailability(await readVendorEarnings(role, { userId }), config);
  const requests = await readVendorWithdrawalRequests({ userId, role });
  const totalEarningsUsd = earnings.reduce((sum, row) => sum + Number(row.grossAmountUsd || 0), 0);
  const availableEarningsUsd = earnings
    .filter((row: any) => row.isAvailableForWithdrawal)
    .reduce((sum, row) => sum + Number(row.grossAmountUsd || 0), 0);
  const pendingWithdrawalUsd = requests
    .filter((row) => ['PENDING', 'APPROVED'].includes(String(row.status || '').toUpperCase()))
    .reduce((sum, row) => sum + Number(row.amountUsd || 0), 0);
  const paidOutUsd = requests
    .filter((row) => String(row.status || '').toUpperCase() === 'PAID')
    .reduce((sum, row) => sum + Number(row.amountUsd || 0), 0);
  const withdrawableUsd = Math.max(0, Number((availableEarningsUsd - pendingWithdrawalUsd - paidOutUsd).toFixed(2)));
  return {
    totalEarningsUsd: Number(totalEarningsUsd.toFixed(2)),
    availableEarningsUsd: Number(availableEarningsUsd.toFixed(2)),
    pendingWithdrawalUsd: Number(pendingWithdrawalUsd.toFixed(2)),
    paidOutUsd: Number(paidOutUsd.toFixed(2)),
    withdrawableUsd,
    releaseDelayDays: config.releaseDelayDays,
    minimumWithdrawalUsd: config.minimumWithdrawalUsd,
    slaHours: config.slaHours,
  };
}

router.get('/vendor/config', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    const config = await readVendorPaymentConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor/earnings', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    const config = await readVendorPaymentConfig();
    const rows = applyEarningAvailability(await readVendorEarnings(role, { userId: req.user!.id }), config);
    res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor/wallet', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    const config = await readVendorPaymentConfig();
    const wallet = await computeVendorWallet(req.user!.id, role, config);
    res.json({ success: true, data: wallet });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor/withdrawal-methods', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    await ensureVendorPaymentSchema();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
        "id","userId","role","methodType","accountName","accountNumber","bankName","routingNumber","walletAddress","providerName",
        "currencyCode","metadata","isDefault","isActive","createdAt","updatedAt"
       FROM "VendorWithdrawalMethod"
       WHERE "userId" = $1 AND UPPER("role") = $2
       ORDER BY "isDefault" DESC, "createdAt" ASC`,
      req.user!.id,
      role
    );
    res.json({
      success: true,
      data: rows.map((row) => ({
        id: String(row.id || ''),
        userId: String(row.userId || ''),
        role: normalizeVendorRoleToken(row.role) || role,
        methodType: String(row.methodType || ''),
        accountName: String(row.accountName || ''),
        accountNumber: String(row.accountNumber || ''),
        bankName: String(row.bankName || ''),
        routingNumber: String(row.routingNumber || ''),
        walletAddress: String(row.walletAddress || ''),
        providerName: String(row.providerName || ''),
        currencyCode: String(row.currencyCode || 'USD'),
        metadata: parseObject(row.metadata),
        isDefault: Boolean(row.isDefault),
        isActive: Boolean(row.isActive),
        createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/vendor/withdrawal-methods', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    await ensureVendorPaymentSchema();
    const payload = z
      .object({
        methodType: z.string().min(2),
        accountName: z.string().optional(),
        accountNumber: z.string().optional(),
        bankName: z.string().optional(),
        routingNumber: z.string().optional(),
        walletAddress: z.string().optional(),
        providerName: z.string().optional(),
        currencyCode: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        isDefault: z.boolean().optional(),
      })
      .parse(req.body);

    if (payload.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "VendorWithdrawalMethod" SET "isDefault" = false, "updatedAt" = NOW()
         WHERE "userId" = $1 AND UPPER("role") = $2`,
        req.user!.id,
        role
      );
    }

    const id = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorWithdrawalMethod"
       ("id","userId","role","methodType","accountName","accountNumber","bankName","routingNumber","walletAddress","providerName",
        "currencyCode","metadata","isDefault","isActive","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13,true,NOW(),NOW())`,
      id,
      req.user!.id,
      role,
      String(payload.methodType || '').trim().toUpperCase(),
      payload.accountName ? String(payload.accountName) : null,
      payload.accountNumber ? String(payload.accountNumber) : null,
      payload.bankName ? String(payload.bankName) : null,
      payload.routingNumber ? String(payload.routingNumber) : null,
      payload.walletAddress ? String(payload.walletAddress) : null,
      payload.providerName ? String(payload.providerName) : null,
      String(payload.currencyCode || 'USD').toUpperCase(),
      JSON.stringify(payload.metadata || {}),
      Boolean(payload.isDefault)
    );
    res.status(201).json({ success: true, data: { id }, message: 'Withdrawal method saved.' });
  } catch (error) {
    next(error);
  }
});

router.put('/vendor/withdrawal-methods/:id', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    await ensureVendorPaymentSchema();
    const payload = z
      .object({
        methodType: z.string().min(2).optional(),
        accountName: z.string().optional(),
        accountNumber: z.string().optional(),
        bankName: z.string().optional(),
        routingNumber: z.string().optional(),
        walletAddress: z.string().optional(),
        providerName: z.string().optional(),
        currencyCode: z.string().optional(),
        metadata: z.record(z.any()).optional(),
        isDefault: z.boolean().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(req.body);
    const methodId = String(req.params.id || '').trim();
    if (!methodId) {
      return res.status(400).json({ success: false, message: 'Method id is required.' });
    }
    if (payload.isDefault) {
      await prisma.$executeRawUnsafe(
        `UPDATE "VendorWithdrawalMethod" SET "isDefault" = false, "updatedAt" = NOW()
         WHERE "userId" = $1 AND UPPER("role") = $2`,
        req.user!.id,
        role
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "VendorWithdrawalMethod"
       SET "methodType" = COALESCE($1, "methodType"),
           "accountName" = COALESCE($2, "accountName"),
           "accountNumber" = COALESCE($3, "accountNumber"),
           "bankName" = COALESCE($4, "bankName"),
           "routingNumber" = COALESCE($5, "routingNumber"),
           "walletAddress" = COALESCE($6, "walletAddress"),
           "providerName" = COALESCE($7, "providerName"),
           "currencyCode" = COALESCE($8, "currencyCode"),
           "metadata" = COALESCE($9::jsonb, "metadata"),
           "isDefault" = COALESCE($10, "isDefault"),
           "isActive" = COALESCE($11, "isActive"),
           "updatedAt" = NOW()
       WHERE "id" = $12 AND "userId" = $13 AND UPPER("role") = $14`,
      payload.methodType ? String(payload.methodType).trim().toUpperCase() : null,
      payload.accountName ?? null,
      payload.accountNumber ?? null,
      payload.bankName ?? null,
      payload.routingNumber ?? null,
      payload.walletAddress ?? null,
      payload.providerName ?? null,
      payload.currencyCode ? String(payload.currencyCode).toUpperCase() : null,
      payload.metadata ? JSON.stringify(payload.metadata) : null,
      payload.isDefault ?? null,
      payload.isActive ?? null,
      methodId,
      req.user!.id,
      role
    );
    res.json({ success: true, message: 'Withdrawal method updated.' });
  } catch (error) {
    next(error);
  }
});

router.get('/vendor/withdrawals', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    const rows = await readVendorWithdrawalRequests({ userId: req.user!.id, role });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/vendor/withdrawals', authenticate, async (req, res, next) => {
  try {
    const role = getVendorRoleFromUser(req.user!.role);
    if (!role) {
      return res.status(403).json({ success: false, message: 'Vendor account required.' });
    }
    const payload = z
      .object({
        methodId: z.string().min(1),
        amountUsd: z.number().positive(),
        notes: z.string().optional(),
      })
      .parse(req.body);

    const config = await readVendorPaymentConfig();
    if (payload.amountUsd < config.minimumWithdrawalUsd) {
      return res.status(400).json({
        success: false,
        message: `Minimum withdrawal is $${config.minimumWithdrawalUsd.toFixed(2)}.`,
      });
    }

    const wallet = await computeVendorWallet(req.user!.id, role, config);
    if (payload.amountUsd > wallet.withdrawableUsd) {
      return res.status(400).json({
        success: false,
        message: `Requested amount exceeds withdrawable balance ($${wallet.withdrawableUsd.toFixed(2)}).`,
      });
    }

    const methodRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "VendorWithdrawalMethod"
       WHERE "id" = $1 AND "userId" = $2 AND UPPER("role") = $3 AND "isActive" = true
       LIMIT 1`,
      payload.methodId,
      req.user!.id,
      role
    );
    if (methodRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Withdrawal method not found.' });
    }

    const requestId = randomUUID();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorWithdrawalRequest"
       ("id","userId","role","methodId","amountUsd","status","notes","requestedAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::numeric,'PENDING',$6,NOW(),NOW(),NOW())`,
      requestId,
      req.user!.id,
      role,
      payload.methodId,
      Number(payload.amountUsd.toFixed(2)),
      payload.notes ? String(payload.notes) : null
    );
    res.status(201).json({ success: true, data: { id: requestId }, message: 'Withdrawal request submitted.' });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/vendor-config', authenticate, authorizePermissions(Permissions.PAYMENTS_MANAGE), async (_req, res, next) => {
  try {
    const config = await readVendorPaymentConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    next(error);
  }
});

router.put('/admin/vendor-config', authenticate, authorizePermissions(Permissions.PAYMENTS_MANAGE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        releaseDelayDays: z.number().int().min(0).optional(),
        minimumWithdrawalUsd: z.number().min(0).optional(),
        slaHours: z.number().int().min(1).optional(),
        platformFeePercent: z.number().min(0).optional(),
        withdrawalOptions: z.array(z.string()).optional(),
        payoutIntegrationProviders: z.array(z.string()).optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    const current = await readVendorPaymentConfig();
    const saved = await saveVendorPaymentConfig({ ...current, ...payload }, req.user!.id);
    res.json({ success: true, data: saved, message: 'Vendor payment configuration saved.' });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/vendor-earnings', authenticate, authorizePermissions(Permissions.PAYMENTS_MANAGE), async (req, res, next) => {
  try {
    const role = normalizeVendorRoleToken(req.query.role);
    const config = await readVendorPaymentConfig();
    const sellerRows = role === 'FASHION_DESIGNER' ? [] : applyEarningAvailability(await readVendorEarnings('FABRIC_SELLER'), config);
    const designerRows = role === 'FABRIC_SELLER' ? [] : applyEarningAvailability(await readVendorEarnings('FASHION_DESIGNER'), config);
    res.json({
      success: true,
      data: {
        seller: sellerRows,
        designer: designerRows,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/admin/vendor-withdrawals', authenticate, authorizePermissions(Permissions.PAYMENTS_MANAGE), async (req, res, next) => {
  try {
    const role = normalizeVendorRoleToken(req.query.role);
    const status = normalizeWithdrawalStatus(req.query.status);
    const rows = await readVendorWithdrawalRequests({ role: role || undefined, status: status || undefined });
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.patch('/admin/vendor-withdrawals/:id', authenticate, authorizePermissions(Permissions.PAYMENTS_MANAGE), async (req, res, next) => {
  try {
    const payload = z
      .object({
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED']),
        adminNotes: z.string().optional(),
        payoutReference: z.string().optional(),
      })
      .parse(req.body);
    const requestId = String(req.params.id || '').trim();
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Withdrawal request id is required.' });
    }
    await ensureVendorPaymentSchema();
    await prisma.$executeRawUnsafe(
      `UPDATE "VendorWithdrawalRequest"
       SET "status" = $1,
           "adminNotes" = COALESCE($2, "adminNotes"),
           "payoutReference" = COALESCE($3, "payoutReference"),
           "processedById" = $4,
           "processedAt" = CASE WHEN $1 IN ('APPROVED','REJECTED','PAID','CANCELLED') THEN NOW() ELSE "processedAt" END,
           "updatedAt" = NOW()
       WHERE "id" = $5`,
      payload.status,
      payload.adminNotes ?? null,
      payload.payoutReference ?? null,
      req.user!.id,
      requestId
    );
    res.json({ success: true, message: 'Withdrawal request updated.' });
  } catch (error) {
    next(error);
  }
});

export default router;
