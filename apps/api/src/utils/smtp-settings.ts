import { randomUUID } from 'crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { prisma } from '../db';

const SETTINGS_TABLE = 'SecuritySetting';
const SETTINGS_KEY = 'SMTP_SETTINGS_V1';

const smtpSettingsPatchSchemaInternal = z.object({
  enabled: z.boolean().optional(),
  host: z.string().trim().max(255).optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  secure: z.boolean().optional(),
  user: z.string().trim().max(320).optional(),
  password: z.string().max(1024).optional(),
  from: z.string().trim().max(320).optional(),
});

export const smtpSettingsPatchSchema = smtpSettingsPatchSchemaInternal;

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
};

export type PublicSmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  from: string;
  hasPassword: boolean;
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const token = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(token)) return true;
    if (['0', 'false', 'no', 'off'].includes(token)) return false;
  }
  return fallback;
};

const readEnvDefaults = (): SmtpSettings => {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const password = String(process.env.SMTP_PASS || '').trim();
  const from = String(process.env.SMTP_FROM || user).trim();
  const configured = Boolean(host && user && password && from);
  return {
    enabled: toBoolean(process.env.SMTP_ENABLED, configured),
    host,
    port: Math.max(1, Math.min(65535, Number(process.env.SMTP_PORT || 587) || 587)),
    secure: toBoolean(process.env.SMTP_SECURE, false),
    user,
    password,
    from,
  };
};

const normalizeSettings = (input: unknown, fallback?: SmtpSettings): SmtpSettings => {
  const defaults = fallback || readEnvDefaults();
  const row = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const host = String(row.host ?? defaults.host ?? '').trim().slice(0, 255);
  const user = String(row.user ?? defaults.user ?? '').trim().slice(0, 320);
  const password = String(row.password ?? defaults.password ?? '').trim().slice(0, 1024);
  const from = String(row.from ?? defaults.from ?? user).trim().slice(0, 320);
  const portRaw = Number(row.port ?? defaults.port ?? 587);
  const port = Number.isFinite(portRaw) ? Math.max(1, Math.min(65535, Math.round(portRaw))) : 587;
  return {
    enabled: toBoolean(row.enabled, defaults.enabled),
    host,
    port,
    secure: toBoolean(row.secure, defaults.secure),
    user,
    password,
    from,
  };
};

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;
let cacheValue: SmtpSettings | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 30_000;

const invalidateCache = () => {
  cacheValue = null;
  cacheAt = 0;
};

export async function ensureSmtpSettingsSchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${SETTINGS_TABLE}" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL, "value" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${SETTINGS_TABLE}_key_key" ON "${SETTINGS_TABLE}"("key")`
      );
      schemaEnsured = true;
    })();
  }
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

export async function readSmtpSettings(): Promise<SmtpSettings> {
  const now = Date.now();
  if (cacheValue && now - cacheAt <= CACHE_TTL_MS) return { ...cacheValue };
  await ensureSmtpSettingsSchema();
  const envDefaults = readEnvDefaults();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "${SETTINGS_TABLE}" WHERE "key" = $1 LIMIT 1`,
    SETTINGS_KEY
  );
  const merged = normalizeSettings(rows[0]?.value || {}, envDefaults);
  cacheValue = merged;
  cacheAt = now;
  return { ...merged };
}

export async function writeSmtpSettings(patch: unknown): Promise<SmtpSettings> {
  await ensureSmtpSettingsSchema();
  const parsed = smtpSettingsPatchSchemaInternal.parse(patch || {});
  const current = await readSmtpSettings();
  const next = normalizeSettings(
    {
      ...current,
      ...parsed,
      password: parsed.password !== undefined ? String(parsed.password).trim() : current.password,
    },
    current
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${SETTINGS_TABLE}" ("id","key","value","createdAt","updatedAt")
     VALUES ($1,$2,$3::jsonb,NOW(),NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    randomUUID(),
    SETTINGS_KEY,
    JSON.stringify(next)
  );
  invalidateCache();
  return readSmtpSettings();
}

export const isSmtpConfigured = (settings: SmtpSettings) =>
  settings.enabled &&
  Boolean(String(settings.host || '').trim()) &&
  Boolean(String(settings.user || '').trim()) &&
  Boolean(String(settings.password || '').trim()) &&
  Boolean(String(settings.from || '').trim());

export const toPublicSmtpSettings = (settings: SmtpSettings): PublicSmtpSettings => ({
  enabled: settings.enabled,
  host: settings.host,
  port: settings.port,
  secure: settings.secure,
  user: settings.user,
  from: settings.from,
  hasPassword: Boolean(String(settings.password || '').trim()),
});

export async function sendEmailWithRuntimeSmtp(
  input: { to: string; subject: string; text: string; html: string },
  options?: { requireConfigured?: boolean; missingConfigMessage?: string }
) {
  const to = String(input.to || '').trim();
  if (!to) {
    throw new Error('Missing email recipient.');
  }
  const requireConfigured = options?.requireConfigured !== false;
  const missingConfigMessage = options?.missingConfigMessage || 'SMTP is not configured for outbound email.';
  const settings = await readSmtpSettings();
  if (!isSmtpConfigured(settings)) {
    if (!requireConfigured) return false;
    const error = new Error(missingConfigMessage) as Error & { code?: string };
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }
  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
  });
  await transporter.sendMail({
    from: settings.from || settings.user,
    to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
  return true;
}
