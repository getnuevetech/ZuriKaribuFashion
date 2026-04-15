import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { prisma, OrderStatus, OrderType, ProductStatus, UserRole } from '../db';

const PARTNER_SCOPE_VALUES = ['catalog:read', 'orders:read', 'orders:write', 'events:order'] as const;
export type PartnerScope = (typeof PARTNER_SCOPE_VALUES)[number];

type PartnerAppStatus = 'ACTIVE' | 'INACTIVE';

type PartnerAppRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  scopes: unknown;
  rateLimitPerMinute: number | null;
  allowedIps: unknown;
  webhookUrl: string | null;
  webhookSecretEncrypted: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PartnerCredentialRow = {
  id: string;
  partnerAppId: string;
  keyId: string;
  keyPrefix: string;
  secretHash: string;
  isActive: boolean;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type PartnerAuthContext = {
  appId: string;
  appName: string;
  appStatus: PartnerAppStatus;
  scopes: PartnerScope[];
  rateLimitPerMinute: number;
  keyId: string;
  credentialId: string;
  requestIp: string | null;
};

const DEFAULT_PARTNER_SCOPES: PartnerScope[] = ['catalog:read', 'orders:read'];
const DEFAULT_RATE_LIMIT_PER_MINUTE = 120;
const IDEMPOTENCY_TTL_HOURS = 24;

const rateLimitWindow = new Map<string, { windowStart: number; count: number }>();

declare global {
  namespace Express {
    interface Request {
      partner?: PartnerAuthContext;
    }
  }
}

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeScopes = (value: unknown): PartnerScope[] => {
  const allowed = new Set<string>(PARTNER_SCOPE_VALUES);
  const input = Array.isArray(value) ? value : [];
  const normalized = Array.from(
    new Set(
      input
        .map((entry) => String(entry || '').trim().toLowerCase())
        .filter((entry) => allowed.has(entry))
    )
  ) as PartnerScope[];
  return normalized.length > 0 ? normalized : [...DEFAULT_PARTNER_SCOPES];
};

const normalizeAllowedIps = (value: unknown): string[] =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .slice(0, 200)
    )
  );

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const toRateLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 10) return DEFAULT_RATE_LIMIT_PER_MINUTE;
  return Math.min(5000, Math.max(10, Math.floor(parsed)));
};

const partnerApiSalt = process.env.PARTNER_API_KEY_SALT || 'change-this-partner-key-salt';

function hashPartnerSecret(keyId: string, secret: string) {
  return createHash('sha256').update(`${keyId}:${secret}:${partnerApiSalt}`).digest('hex');
}

function safeCompareHex(left: string, right: string) {
  const a = Buffer.from(left, 'hex');
  const b = Buffer.from(right, 'hex');
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

const cipherKey = (() => {
  const raw = String(process.env.PARTNER_WEBHOOK_CIPHER_KEY || '').trim();
  if (!raw) return null;
  if (/^[a-fA-F0-9]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  try {
    const decoded = Buffer.from(raw, 'base64');
    return decoded.length === 32 ? decoded : null;
  } catch {
    return null;
  }
})();

function encryptWebhookSecret(secret: string) {
  if (!cipherKey) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', cipherKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decryptWebhookSecret(payload: string | null | undefined) {
  if (!cipherKey || !payload) return null;
  const [ivB64, tagB64, encryptedB64] = String(payload || '').split('.');
  if (!ivB64 || !tagB64 || !encryptedB64) return null;
  try {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const encrypted = Buffer.from(encryptedB64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', cipherKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export async function ensurePartnerTables() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PartnerApp" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "scopes" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "rateLimitPerMinute" INTEGER NOT NULL DEFAULT 120,
      "allowedIps" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "webhookUrl" TEXT,
      "webhookSecretEncrypted" TEXT,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartnerApp_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "PartnerApp_slug_key" ON "PartnerApp"("slug")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PartnerApp_status_idx" ON "PartnerApp"("status")`);

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PartnerCredential" (
      "id" TEXT NOT NULL,
      "partnerAppId" TEXT NOT NULL,
      "keyId" TEXT NOT NULL,
      "keyPrefix" TEXT NOT NULL,
      "secretHash" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "expiresAt" TIMESTAMP(3),
      "lastUsedAt" TIMESTAMP(3),
      "revokedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartnerCredential_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PartnerCredential_keyId_key" ON "PartnerCredential"("keyId")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PartnerCredential_partnerAppId_idx" ON "PartnerCredential"("partnerAppId")`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PartnerApiAudit" (
      "id" TEXT NOT NULL,
      "partnerAppId" TEXT NOT NULL,
      "credentialId" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      "statusCode" INTEGER NOT NULL,
      "ipAddress" TEXT,
      "durationMs" INTEGER NOT NULL DEFAULT 0,
      "requestId" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartnerApiAudit_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PartnerApiAudit_partnerAppId_createdAt_idx" ON "PartnerApiAudit"("partnerAppId", "createdAt")`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PartnerIdempotency" (
      "id" TEXT NOT NULL,
      "partnerAppId" TEXT NOT NULL,
      "idempotencyKey" TEXT NOT NULL,
      "method" TEXT NOT NULL,
      "path" TEXT NOT NULL,
      "requestHash" TEXT NOT NULL,
      "responseStatus" INTEGER NOT NULL,
      "responseBody" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "PartnerIdempotency_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "PartnerIdempotency_unique_req_idx" ON "PartnerIdempotency"("partnerAppId", "idempotencyKey", "method", "path")`
  );

  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "PartnerWebhookDelivery" (
      "id" TEXT NOT NULL,
      "partnerAppId" TEXT NOT NULL,
      "eventType" TEXT NOT NULL,
      "payload" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "targetUrl" TEXT,
      "signature" TEXT,
      "responseStatus" INTEGER,
      "responseBody" TEXT,
      "success" BOOLEAN NOT NULL DEFAULT false,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "PartnerWebhookDelivery_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "PartnerWebhookDelivery_partnerAppId_createdAt_idx" ON "PartnerWebhookDelivery"("partnerAppId", "createdAt")`
  );
}

function serializePartnerApp(row: PartnerAppRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: String(row.status || 'ACTIVE').toUpperCase() === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    scopes: normalizeScopes(row.scopes),
    rateLimitPerMinute: toRateLimit(row.rateLimitPerMinute),
    allowedIps: normalizeAllowedIps(row.allowedIps),
    webhookUrl: row.webhookUrl || null,
    createdById: row.createdById || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as const;
}

async function readPartnerAppById(partnerAppId: string) {
  await ensurePartnerTables();
  const rows = await prisma.$queryRawUnsafe<PartnerAppRow[]>(
    `SELECT * FROM "PartnerApp" WHERE "id" = $1 LIMIT 1`,
    partnerAppId
  );
  return rows[0] ? serializePartnerApp(rows[0]) : null;
}

export async function listPartnerApps() {
  await ensurePartnerTables();
  const rows = await prisma.$queryRawUnsafe<Array<PartnerAppRow & { credentialCount: number; activeCredentialCount: number }>>(
    `SELECT a.*,
            COALESCE((SELECT COUNT(*)::int FROM "PartnerCredential" c WHERE c."partnerAppId" = a."id"), 0) AS "credentialCount",
            COALESCE((SELECT COUNT(*)::int FROM "PartnerCredential" c WHERE c."partnerAppId" = a."id" AND c."isActive" = true), 0) AS "activeCredentialCount"
     FROM "PartnerApp" a
     ORDER BY a."createdAt" DESC`
  );
  return rows.map((row) => ({
    ...serializePartnerApp(row),
    credentialCount: Number(row.credentialCount || 0),
    activeCredentialCount: Number(row.activeCredentialCount || 0),
  }));
}

async function resolveUniqueSlug(inputName: string) {
  const base = slugify(inputName) || 'partner-app';
  let candidate = base;
  let suffix = 1;
  for (;;) {
    const exists = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id" FROM "PartnerApp" WHERE "slug" = $1 LIMIT 1`,
      candidate
    );
    if (!exists[0]) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

function buildCredentialToken() {
  const keyId = `pk_${randomBytes(8).toString('hex')}`;
  const secret = `ps_${randomBytes(20).toString('hex')}`;
  return {
    keyId,
    secret,
    token: `${keyId}.${secret}`,
    keyPrefix: `${keyId.slice(0, 6)}...${keyId.slice(-4)}`,
    secretHash: hashPartnerSecret(keyId, secret),
  };
}

export async function createPartnerApp(input: {
  name: string;
  description?: string;
  scopes?: PartnerScope[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  webhookUrl?: string;
  createdById?: string;
}) {
  await ensurePartnerTables();
  const name = String(input.name || '').trim();
  if (!name) {
    throw new Error('Partner app name is required.');
  }
  const slug = await resolveUniqueSlug(name);
  const scopes = normalizeScopes(input.scopes);
  const allowedIps = normalizeAllowedIps(input.allowedIps);
  const rateLimitPerMinute = toRateLimit(input.rateLimitPerMinute);
  const webhookUrl = String(input.webhookUrl || '').trim() || null;
  const generatedWebhookSecret = webhookUrl ? `whsec_${randomBytes(24).toString('hex')}` : null;
  const webhookSecretEncrypted = generatedWebhookSecret ? encryptWebhookSecret(generatedWebhookSecret) : null;

  const appId = randomUUID();
  const credential = buildCredentialToken();

  await prisma.$transaction([
    prisma.$executeRawUnsafe(
      `INSERT INTO "PartnerApp"
       ("id", "name", "slug", "description", "status", "scopes", "rateLimitPerMinute", "allowedIps", "webhookUrl", "webhookSecretEncrypted", "createdById", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5::jsonb, $6, $7::jsonb, $8, $9, $10, NOW(), NOW())`,
      appId,
      name,
      slug,
      input.description ? String(input.description) : null,
      JSON.stringify(scopes),
      rateLimitPerMinute,
      JSON.stringify(allowedIps),
      webhookUrl,
      webhookSecretEncrypted,
      input.createdById || null
    ),
    prisma.$executeRawUnsafe(
      `INSERT INTO "PartnerCredential"
       ("id", "partnerAppId", "keyId", "keyPrefix", "secretHash", "isActive", "createdAt")
       VALUES ($1, $2, $3, $4, $5, true, NOW())`,
      randomUUID(),
      appId,
      credential.keyId,
      credential.keyPrefix,
      credential.secretHash
    ),
  ]);

  const app = await readPartnerAppById(appId);
  return {
    app,
    generatedCredential: {
      keyId: credential.keyId,
      token: credential.token,
      webhookSecret: generatedWebhookSecret,
      note: 'Store this token securely. It will not be shown again.',
    },
  };
}

export async function updatePartnerApp(
  partnerAppId: string,
  patch: Partial<{
    name: string;
    description: string | null;
    status: PartnerAppStatus;
    scopes: PartnerScope[];
    rateLimitPerMinute: number;
    allowedIps: string[];
    webhookUrl: string | null;
  }>
) {
  await ensurePartnerTables();
  const existing = await readPartnerAppById(partnerAppId);
  if (!existing) throw new Error('Partner app not found.');

  const next = {
    name: patch.name !== undefined ? String(patch.name || '').trim() || existing.name : existing.name,
    description: patch.description !== undefined ? (patch.description ? String(patch.description) : null) : existing.description,
    status:
      patch.status && String(patch.status).toUpperCase() === 'INACTIVE'
        ? 'INACTIVE'
        : patch.status
          ? 'ACTIVE'
          : existing.status,
    scopes: patch.scopes ? normalizeScopes(patch.scopes) : existing.scopes,
    rateLimitPerMinute:
      patch.rateLimitPerMinute !== undefined ? toRateLimit(patch.rateLimitPerMinute) : existing.rateLimitPerMinute,
    allowedIps: patch.allowedIps ? normalizeAllowedIps(patch.allowedIps) : existing.allowedIps,
    webhookUrl:
      patch.webhookUrl !== undefined
        ? (String(patch.webhookUrl || '').trim() || null)
        : existing.webhookUrl,
  };

  await prisma.$executeRawUnsafe(
    `UPDATE "PartnerApp"
     SET "name" = $1,
         "description" = $2,
         "status" = $3,
         "scopes" = $4::jsonb,
         "rateLimitPerMinute" = $5,
         "allowedIps" = $6::jsonb,
         "webhookUrl" = $7,
         "updatedAt" = NOW()
     WHERE "id" = $8`,
    next.name,
    next.description,
    next.status,
    JSON.stringify(next.scopes),
    next.rateLimitPerMinute,
    JSON.stringify(next.allowedIps),
    next.webhookUrl,
    partnerAppId
  );
  return readPartnerAppById(partnerAppId);
}

export async function rotatePartnerCredential(partnerAppId: string, expiresAt?: Date | null) {
  await ensurePartnerTables();
  const app = await readPartnerAppById(partnerAppId);
  if (!app) throw new Error('Partner app not found.');

  const credential = buildCredentialToken();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PartnerCredential"
     ("id", "partnerAppId", "keyId", "keyPrefix", "secretHash", "isActive", "expiresAt", "createdAt")
     VALUES ($1, $2, $3, $4, $5, true, $6, NOW())`,
    randomUUID(),
    partnerAppId,
    credential.keyId,
    credential.keyPrefix,
    credential.secretHash,
    expiresAt || null
  );

  return {
    keyId: credential.keyId,
    token: credential.token,
    note: 'Store this token securely. It will not be shown again.',
  };
}

export async function rotatePartnerWebhookSecret(partnerAppId: string) {
  await ensurePartnerTables();
  const app = await readPartnerAppById(partnerAppId);
  if (!app) throw new Error('Partner app not found.');
  if (!app.webhookUrl) throw new Error('Set a webhook URL before rotating webhook secret.');
  const secret = `whsec_${randomBytes(24).toString('hex')}`;
  const encrypted = encryptWebhookSecret(secret);
  if (!encrypted) {
    throw new Error('PARTNER_WEBHOOK_CIPHER_KEY is not configured. Cannot securely rotate webhook secret.');
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "PartnerApp"
     SET "webhookSecretEncrypted" = $1, "updatedAt" = NOW()
     WHERE "id" = $2`,
    encrypted,
    partnerAppId
  );
  return {
    webhookSecret: secret,
    note: 'Store this webhook secret securely. It will not be shown again.',
  };
}

export async function listPartnerAudit(partnerAppId: string, page = 1, limit = 50) {
  await ensurePartnerTables();
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;
  const [rows, totalRows] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT *
       FROM "PartnerApiAudit"
       WHERE "partnerAppId" = $1
       ORDER BY "createdAt" DESC
       OFFSET $2
       LIMIT $3`,
      partnerAppId,
      skip,
      safeLimit
    ),
    prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count
       FROM "PartnerApiAudit"
       WHERE "partnerAppId" = $1`,
      partnerAppId
    ),
  ]);
  const total = Number(totalRows[0]?.count || 0);
  return {
    rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export async function listPartnerWebhookDeliveries(partnerAppId: string, page = 1, limit = 50) {
  await ensurePartnerTables();
  const safePage = Math.max(1, Math.floor(page));
  const safeLimit = Math.min(200, Math.max(1, Math.floor(limit)));
  const skip = (safePage - 1) * safeLimit;
  const [rows, totalRows] = await Promise.all([
    prisma.$queryRawUnsafe<any[]>(
      `SELECT *
       FROM "PartnerWebhookDelivery"
       WHERE "partnerAppId" = $1
       ORDER BY "createdAt" DESC
       OFFSET $2
       LIMIT $3`,
      partnerAppId,
      skip,
      safeLimit
    ),
    prisma.$queryRawUnsafe<Array<{ count: number }>>(
      `SELECT COUNT(*)::int AS count
       FROM "PartnerWebhookDelivery"
       WHERE "partnerAppId" = $1`,
      partnerAppId
    ),
  ]);
  const total = Number(totalRows[0]?.count || 0);
  return {
    rows,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      pages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

function readRequestIp(req: Request) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)[0];
  return forwarded || req.ip || null;
}

function rateLimitCheck(appId: string, limitPerMinute: number) {
  const now = Date.now();
  const windowStart = Math.floor(now / 60_000) * 60_000;
  const key = `${appId}:${windowStart}`;
  const existing = rateLimitWindow.get(key);
  const nextCount = (existing?.count || 0) + 1;
  rateLimitWindow.set(key, { windowStart, count: nextCount });
  if (rateLimitWindow.size > 5000) {
    for (const [entryKey, entry] of rateLimitWindow.entries()) {
      if (entry.windowStart < windowStart - 2 * 60_000) rateLimitWindow.delete(entryKey);
    }
  }
  const remaining = Math.max(0, limitPerMinute - nextCount);
  return {
    allowed: nextCount <= limitPerMinute,
    remaining,
    resetAt: windowStart + 60_000,
  };
}

async function readPartnerCredentialByKeyId(keyId: string) {
  await ensurePartnerTables();
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      credentialId: string;
      partnerAppId: string;
      keyId: string;
      keyPrefix: string;
      secretHash: string;
      isActive: boolean;
      expiresAt: Date | null;
      lastUsedAt: Date | null;
      revokedAt: Date | null;
      credentialCreatedAt: Date;
      appId: string;
      appName: string;
      appSlug: string;
      appDescription: string | null;
      appStatus: string;
      appScopes: unknown;
      appRateLimitPerMinute: number | null;
      appAllowedIps: unknown;
      appWebhookUrl: string | null;
      appWebhookSecretEncrypted: string | null;
      appCreatedById: string | null;
      appCreatedAt: Date;
      appUpdatedAt: Date;
    }>
  >(
    `SELECT c."id" AS "credentialId",
            c."partnerAppId" AS "partnerAppId",
            c."keyId" AS "keyId",
            c."keyPrefix" AS "keyPrefix",
            c."secretHash" AS "secretHash",
            c."isActive" AS "isActive",
            c."expiresAt" AS "expiresAt",
            c."lastUsedAt" AS "lastUsedAt",
            c."revokedAt" AS "revokedAt",
            c."createdAt" AS "credentialCreatedAt",
            a."id" AS "appId",
            a."name" AS "appName",
            a."slug" AS "appSlug",
            a."description" AS "appDescription",
            a."status" AS "appStatus",
            a."scopes" AS "appScopes",
            a."rateLimitPerMinute" AS "appRateLimitPerMinute",
            a."allowedIps" AS "appAllowedIps",
            a."webhookUrl" AS "appWebhookUrl",
            a."webhookSecretEncrypted" AS "appWebhookSecretEncrypted",
            a."createdById" AS "appCreatedById",
            a."createdAt" AS "appCreatedAt",
            a."updatedAt" AS "appUpdatedAt"
     FROM "PartnerCredential" c
     JOIN "PartnerApp" a ON a."id" = c."partnerAppId"
     WHERE c."keyId" = $1
     LIMIT 1`,
    keyId
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    credential: {
      id: row.credentialId,
      partnerAppId: row.partnerAppId,
      keyId: row.keyId,
      keyPrefix: row.keyPrefix,
      secretHash: row.secretHash,
      isActive: row.isActive,
      expiresAt: row.expiresAt,
      lastUsedAt: row.lastUsedAt,
      revokedAt: row.revokedAt,
      createdAt: row.credentialCreatedAt,
    },
    app: serializePartnerApp({
      id: row.appId,
      name: row.appName,
      slug: row.appSlug,
      description: row.appDescription,
      status: row.appStatus,
      scopes: row.appScopes,
      rateLimitPerMinute: row.appRateLimitPerMinute,
      allowedIps: row.appAllowedIps,
      webhookUrl: row.appWebhookUrl,
      webhookSecretEncrypted: row.appWebhookSecretEncrypted,
      createdById: row.appCreatedById,
      createdAt: row.appCreatedAt,
      updatedAt: row.appUpdatedAt,
    }),
  };
}

export async function authenticatePartnerRequest(req: Request, res: Response, next: NextFunction) {
  try {
    await ensurePartnerTables();
    const authHeader = String(req.headers.authorization || '').trim();
    const directToken = String(req.headers['x-partner-token'] || '').trim();
    const token = directToken || (authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '');
    if (!token || !token.includes('.')) {
      return res.status(401).json({
        success: false,
        message: 'Partner token is required. Use Authorization: Bearer <keyId.secret>.',
      });
    }
    const [keyId, secret] = token.split('.');
    if (!keyId || !secret) {
      return res.status(401).json({ success: false, message: 'Invalid partner token format.' });
    }

    const record = await readPartnerCredentialByKeyId(keyId);
    if (!record) {
      return res.status(401).json({ success: false, message: 'Partner credential not found.' });
    }
    if (!record.credential.isActive || record.credential.revokedAt) {
      return res.status(401).json({ success: false, message: 'Partner credential is inactive.' });
    }
    if (record.credential.expiresAt && new Date(record.credential.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ success: false, message: 'Partner credential has expired.' });
    }
    if (record.app.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Partner app is inactive.' });
    }
    const candidateHash = hashPartnerSecret(keyId, secret);
    if (!safeCompareHex(candidateHash, record.credential.secretHash)) {
      return res.status(401).json({ success: false, message: 'Invalid partner token secret.' });
    }

    const requestIp = readRequestIp(req);
    if (record.app.allowedIps.length > 0) {
      if (!requestIp || !record.app.allowedIps.includes(requestIp)) {
        return res.status(403).json({
          success: false,
          message: 'Request IP is not allowed for this partner app.',
        });
      }
    }

    const rateLimitState = rateLimitCheck(record.app.id, record.app.rateLimitPerMinute);
    res.setHeader('X-RateLimit-Limit', String(record.app.rateLimitPerMinute));
    res.setHeader('X-RateLimit-Remaining', String(rateLimitState.remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.floor(rateLimitState.resetAt / 1000)));
    if (!rateLimitState.allowed) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded for this partner credential.',
      });
    }

    req.partner = {
      appId: record.app.id,
      appName: record.app.name,
      appStatus: record.app.status,
      scopes: record.app.scopes,
      rateLimitPerMinute: record.app.rateLimitPerMinute,
      keyId: record.credential.keyId,
      credentialId: record.credential.id,
      requestIp,
    };

    void prisma.$executeRawUnsafe(
      `UPDATE "PartnerCredential" SET "lastUsedAt" = NOW() WHERE "id" = $1`,
      record.credential.id
    );

    const start = Date.now();
    res.on('finish', () => {
      void recordPartnerAudit({
        partnerAppId: req.partner!.appId,
        credentialId: req.partner!.credentialId,
        method: req.method,
        path: req.originalUrl || req.path,
        statusCode: res.statusCode,
        ipAddress: req.partner!.requestIp,
        durationMs: Date.now() - start,
      });
    });

    next();
  } catch (error) {
    next(error);
  }
}

export function requirePartnerScope(...requiredScopes: PartnerScope[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.partner) {
      return res.status(401).json({ success: false, message: 'Partner authentication required.' });
    }
    if (requiredScopes.length === 0) return next();
    const granted = new Set(req.partner.scopes || []);
    const missing = requiredScopes.filter((scope) => !granted.has(scope));
    if (missing.length > 0) {
      return res.status(403).json({
        success: false,
        message: `Missing required scope(s): ${missing.join(', ')}`,
      });
    }
    next();
  };
}

export async function recordPartnerAudit(input: {
  partnerAppId: string;
  credentialId: string;
  method: string;
  path: string;
  statusCode: number;
  ipAddress?: string | null;
  durationMs?: number;
  requestId?: string;
  metadata?: Record<string, unknown>;
}) {
  await ensurePartnerTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PartnerApiAudit"
     ("id", "partnerAppId", "credentialId", "method", "path", "statusCode", "ipAddress", "durationMs", "requestId", "metadata", "createdAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, NOW())`,
    randomUUID(),
    input.partnerAppId,
    input.credentialId,
    String(input.method || 'GET').toUpperCase(),
    String(input.path || ''),
    Number(input.statusCode || 0),
    input.ipAddress || null,
    Math.max(0, Number(input.durationMs || 0)),
    input.requestId || null,
    JSON.stringify(input.metadata || {})
  );
}

function hashIdempotencyPayload(payload: unknown) {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

export async function readIdempotencyReplay(params: {
  partnerAppId: string;
  idempotencyKey: string;
  method: string;
  path: string;
  requestPayload: unknown;
}) {
  await ensurePartnerTables();
  const requestHash = hashIdempotencyPayload(params.requestPayload);
  const rows = await prisma.$queryRawUnsafe<
    Array<{ requestHash: string; responseStatus: number; responseBody: unknown; expiresAt: Date }>
  >(
    `SELECT "requestHash", "responseStatus", "responseBody", "expiresAt"
     FROM "PartnerIdempotency"
     WHERE "partnerAppId" = $1 AND "idempotencyKey" = $2 AND "method" = $3 AND "path" = $4
     LIMIT 1`,
    params.partnerAppId,
    params.idempotencyKey,
    params.method.toUpperCase(),
    params.path
  );
  const row = rows[0];
  if (!row) return { requestHash, replay: null as null | { status: number; body: unknown } };
  if (new Date(row.expiresAt).getTime() < Date.now()) {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "PartnerIdempotency"
       WHERE "partnerAppId" = $1 AND "idempotencyKey" = $2 AND "method" = $3 AND "path" = $4`,
      params.partnerAppId,
      params.idempotencyKey,
      params.method.toUpperCase(),
      params.path
    );
    return { requestHash, replay: null };
  }
  if (String(row.requestHash || '') !== requestHash) {
    throw new Error('Idempotency key reused with a different payload.');
  }
  return {
    requestHash,
    replay: {
      status: Number(row.responseStatus || 200),
      body: row.responseBody,
    },
  };
}

export async function saveIdempotencyReplay(params: {
  partnerAppId: string;
  idempotencyKey: string;
  method: string;
  path: string;
  requestHash: string;
  responseStatus: number;
  responseBody: unknown;
}) {
  await ensurePartnerTables();
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PartnerIdempotency"
     ("id", "partnerAppId", "idempotencyKey", "method", "path", "requestHash", "responseStatus", "responseBody", "createdAt", "expiresAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), $9)
     ON CONFLICT ("partnerAppId", "idempotencyKey", "method", "path")
     DO UPDATE SET
       "requestHash" = EXCLUDED."requestHash",
       "responseStatus" = EXCLUDED."responseStatus",
       "responseBody" = EXCLUDED."responseBody",
       "expiresAt" = EXCLUDED."expiresAt"`,
    randomUUID(),
    params.partnerAppId,
    params.idempotencyKey,
    params.method.toUpperCase(),
    params.path,
    params.requestHash,
    Number(params.responseStatus || 200),
    JSON.stringify(params.responseBody ?? {}),
    expiresAt
  );
}

async function readWebhookTargets(partnerAppId?: string) {
  await ensurePartnerTables();
  const whereClause = partnerAppId ? `WHERE "id" = $1` : `WHERE "status" = 'ACTIVE'`;
  const rows = partnerAppId
    ? await prisma.$queryRawUnsafe<PartnerAppRow[]>(
        `SELECT * FROM "PartnerApp" ${whereClause} LIMIT 1`,
        partnerAppId
      )
    : await prisma.$queryRawUnsafe<PartnerAppRow[]>(`SELECT * FROM "PartnerApp" ${whereClause}`);
  return rows.map((row) => serializePartnerApp(row));
}

async function dispatchWebhookToPartnerApp(params: {
  app: ReturnType<typeof serializePartnerApp>;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  const appRow = await readPartnerAppById(params.app.id);
  if (!appRow?.webhookUrl) {
    return { success: false, statusCode: null, body: 'Webhook URL not configured', signature: null };
  }
  const encryptedRows = await prisma.$queryRawUnsafe<Array<{ webhookSecretEncrypted: string | null }>>(
    `SELECT "webhookSecretEncrypted" FROM "PartnerApp" WHERE "id" = $1 LIMIT 1`,
    params.app.id
  );
  const webhookSecret = decryptWebhookSecret(encryptedRows[0]?.webhookSecretEncrypted);
  if (!webhookSecret) {
    return {
      success: false,
      statusCode: null,
      body: 'Webhook secret unavailable. Configure PARTNER_WEBHOOK_CIPHER_KEY and rotate webhook secret.',
      signature: null,
    };
  }
  const timestamp = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({
    eventType: params.eventType,
    timestamp: new Date().toISOString(),
    data: params.payload,
  });
  const signature = createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(appRow.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Partner-Event': params.eventType,
        'X-Partner-Timestamp': timestamp,
        'X-Partner-Signature': signature,
      },
      body,
      signal: controller.signal,
    });
    const responseText = await response.text();
    return {
      success: response.ok,
      statusCode: response.status,
      body: responseText.slice(0, 2000),
      signature,
    };
  } catch (error: any) {
    return {
      success: false,
      statusCode: null,
      body: String(error?.message || 'Webhook dispatch failed'),
      signature,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function logWebhookDelivery(params: {
  partnerAppId: string;
  eventType: string;
  payload: Record<string, unknown>;
  targetUrl: string | null;
  signature: string | null;
  success: boolean;
  statusCode: number | null;
  responseBody: string;
  error?: string | null;
}) {
  await ensurePartnerTables();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "PartnerWebhookDelivery"
     ("id", "partnerAppId", "eventType", "payload", "targetUrl", "signature", "responseStatus", "responseBody", "success", "error", "createdAt")
     VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, NOW())`,
    randomUUID(),
    params.partnerAppId,
    params.eventType,
    JSON.stringify(params.payload),
    params.targetUrl,
    params.signature,
    params.statusCode,
    params.responseBody,
    params.success,
    params.error || null
  );
}

export async function emitPartnerOrderEvent(eventType: string, payload: Record<string, unknown>) {
  const targets = await readWebhookTargets();
  for (const app of targets) {
    if (!app.scopes.includes('events:order')) continue;
    if (!app.webhookUrl) continue;
    const delivery = await dispatchWebhookToPartnerApp({ app, eventType, payload });
    await logWebhookDelivery({
      partnerAppId: app.id,
      eventType,
      payload,
      targetUrl: app.webhookUrl,
      signature: delivery.signature,
      success: delivery.success,
      statusCode: delivery.statusCode,
      responseBody: delivery.body,
      error: delivery.success ? null : delivery.body,
    });
  }
}

export async function sendPartnerTestWebhook(partnerAppId: string) {
  const targets = await readWebhookTargets(partnerAppId);
  const app = targets[0];
  if (!app) throw new Error('Partner app not found.');
  if (!app.webhookUrl) throw new Error('Webhook URL is not configured for this app.');
  const payload = {
    test: true,
    partnerAppId: app.id,
    partnerName: app.name,
    issuedAt: new Date().toISOString(),
  };
  const delivery = await dispatchWebhookToPartnerApp({
    app,
    eventType: 'partner.test',
    payload,
  });
  await logWebhookDelivery({
    partnerAppId: app.id,
    eventType: 'partner.test',
    payload,
    targetUrl: app.webhookUrl,
    signature: delivery.signature,
    success: delivery.success,
    statusCode: delivery.statusCode,
    responseBody: delivery.body,
    error: delivery.success ? null : delivery.body,
  });
  return delivery;
}

export const partnerSupportedScopes = [...PARTNER_SCOPE_VALUES];

export async function listPartnerCatalogFabrics(input: {
  country?: string;
  materialTypeId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
  const skip = (page - 1) * limit;
  const where: any = {
    status: ProductStatus.APPROVED,
    isAvailable: true,
  };
  if (input.country) where.seller = { country: String(input.country) };
  if (input.materialTypeId) where.materialTypeId = String(input.materialTypeId);

  const [rows, total] = await Promise.all([
    prisma.fabric.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        finalPrice: true,
        stockYards: true,
        minYards: true,
        createdAt: true,
        updatedAt: true,
        materialType: { select: { id: true, name: true } },
        seller: { select: { id: true, businessName: true, country: true, city: true } },
        images: { select: { url: true }, orderBy: { sortOrder: 'asc' }, take: 3 },
      },
    }),
    prisma.fabric.count({ where }),
  ]);

  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listPartnerCatalogDesigns(input: {
  categoryId?: string;
  country?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
  const skip = (page - 1) * limit;
  const where: any = {
    status: ProductStatus.APPROVED,
    isAvailable: true,
  };
  if (input.country) where.designer = { country: String(input.country) };
  if (input.categoryId) where.categoryId = String(input.categoryId);

  const [rows, total] = await Promise.all([
    prisma.design.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        finalPrice: true,
        createdAt: true,
        updatedAt: true,
        category: { select: { id: true, name: true } },
        designer: { select: { id: true, businessName: true, country: true, city: true } },
        images: { select: { url: true }, orderBy: { sortOrder: 'asc' }, take: 3 },
      },
    }),
    prisma.design.count({ where }),
  ]);
  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function listPartnerOrders(input: {
  status?: OrderStatus;
  updatedSince?: Date | null;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.min(200, Math.max(1, Number(input.limit || 50)));
  const skip = (page - 1) * limit;
  const where: any = {};
  if (input.status) where.status = input.status;
  if (input.updatedSince) where.updatedAt = { gte: input.updatedSince };

  const [rows, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        type: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        shippingCost: true,
        tax: true,
        total: true,
        trackingNumber: true,
        createdAt: true,
        updatedAt: true,
        shippedAt: true,
        deliveredAt: true,
      },
    }),
    prisma.order.count({ where }),
  ]);
  return {
    rows,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export async function updatePartnerOrderStatus(input: {
  orderId: string;
  nextStatus: OrderStatus;
  notes?: string;
  actorAppId: string;
}) {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    select: { id: true, orderNumber: true, status: true, type: true },
  });
  if (!order) {
    throw new Error('Order not found.');
  }
  const allowedStatuses: OrderStatus[] = [OrderStatus.SHIPPED, OrderStatus.DELIVERED];
  if (!allowedStatuses.includes(input.nextStatus)) {
    throw new Error(`Partner API can only set status to: ${allowedStatuses.join(', ')}`);
  }
  const updateData: Record<string, unknown> = {
    status: input.nextStatus,
  };
  if (input.nextStatus === OrderStatus.SHIPPED) {
    updateData.shippedAt = new Date();
  }
  if (input.nextStatus === OrderStatus.DELIVERED) {
    updateData.deliveredAt = new Date();
  }
  const [updatedOrder] = await prisma.$transaction([
    prisma.order.update({
      where: { id: input.orderId },
      data: updateData as any,
    }),
    prisma.orderTimeline.create({
      data: {
        orderId: input.orderId,
        status: input.nextStatus,
        notes: input.notes || `Status updated by partner app ${input.actorAppId}`,
        updatedById: `partner:${input.actorAppId}`,
        updatedByRole: UserRole.ADMINISTRATOR,
      },
    }),
  ]);

  await emitPartnerOrderEvent('order.status.changed', {
    orderId: updatedOrder.id,
    orderNumber: order.orderNumber,
    type: order.type,
    previousStatus: order.status,
    status: input.nextStatus,
    updatedAt: new Date().toISOString(),
    source: 'partner-api',
  });

  return updatedOrder;
}

export const partnerVariableCatalog = {
  orderStatuses: Object.values(OrderStatus),
  orderTypes: Object.values(OrderType),
  supportedScopes: partnerSupportedScopes,
};
