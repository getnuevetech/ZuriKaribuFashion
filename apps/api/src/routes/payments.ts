import { randomUUID } from 'crypto';
import { Router } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { prisma, PaymentStatus, OrderStatus } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

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
    throw Object.assign(new Error(`Payment provider ${providerKey} is not active.`), { status: 404 });
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
  const provider = (await readPaymentIntegrations({ activeOnly: true, providerKey }))[0];
  if (!provider) {
    throw Object.assign(new Error(`Payment provider ${providerKey} is not active.`), { status: 404 });
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
        amount: z.number().int().positive(),
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

    const amountMajor = Number((payload.amount / 100).toFixed(2));
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
        amount: payload.amount,
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

export default router;
