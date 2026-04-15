import crypto, { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, UserRole } from '../db';

export const AUTHENTICATOR_METHODS = ['EMAIL_OTP', 'TOTP_AUTHENTICATOR'] as const;
export type AuthenticatorMethod = (typeof AUTHENTICATOR_METHODS)[number];

const SETTINGS_KEY = 'AUTHENTICATOR_SETTINGS_V1';
const SETTINGS_TABLE = 'SecuritySetting';
const CHALLENGE_TABLE = 'UserAuthChallenge';
const UNASSIGNED_ADMIN_ROLE_TOKEN = '__UNASSIGNED__';

const methodSchema = z.enum(AUTHENTICATOR_METHODS);

export const authenticatorSettingsPatchSchema = z.object({
  enabled: z.boolean().optional(),
  allowEmailOtp: z.boolean().optional(),
  allowTotpAuthenticator: z.boolean().optional(),
  otpLength: z.coerce.number().int().min(4).max(8).optional(),
  otpExpiryMinutes: z.coerce.number().int().min(1).max(30).optional(),
  challengeMaxAttempts: z.coerce.number().int().min(1).max(12).optional(),
  totpIssuer: z.string().trim().min(2).max(120).optional(),
  totpPeriodSeconds: z.coerce.number().int().min(15).max(120).optional(),
  totpDigits: z.coerce.number().int().min(6).max(8).optional(),
  requiredUserRoles: z.array(z.nativeEnum(UserRole)).max(12).optional(),
  requiredAdminRoleIds: z.array(z.string().trim().min(1).max(120)).max(200).optional(),
});

export type AuthenticatorSettings = {
  enabled: boolean;
  allowEmailOtp: boolean;
  allowTotpAuthenticator: boolean;
  otpLength: number;
  otpExpiryMinutes: number;
  challengeMaxAttempts: number;
  totpIssuer: string;
  totpPeriodSeconds: number;
  totpDigits: number;
  requiredUserRoles: UserRole[];
  requiredAdminRoleIds: string[];
};

export const DEFAULT_AUTHENTICATOR_SETTINGS: AuthenticatorSettings = {
  enabled: false,
  allowEmailOtp: true,
  allowTotpAuthenticator: true,
  otpLength: 6,
  otpExpiryMinutes: 10,
  challengeMaxAttempts: 5,
  totpIssuer: 'African Fashion',
  totpPeriodSeconds: 30,
  totpDigits: 6,
  requiredUserRoles: [UserRole.ADMINISTRATOR],
  requiredAdminRoleIds: [],
};

type RawSettings = Partial<AuthenticatorSettings> & Record<string, unknown>;

const parseArray = (value: unknown) => {
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

const toMethod = (value: unknown): AuthenticatorMethod | null => {
  const token = String(value || '').trim().toUpperCase();
  if (token === 'EMAIL_OTP') return 'EMAIL_OTP';
  if (token === 'TOTP_AUTHENTICATOR') return 'TOTP_AUTHENTICATOR';
  return null;
};

const normalizeSettings = (input: unknown): AuthenticatorSettings => {
  const row = (input && typeof input === 'object' ? input : {}) as RawSettings;
  const hasRequiredUserRoles = Object.prototype.hasOwnProperty.call(row, 'requiredUserRoles');
  const requiredUserRoles = Array.from(
    new Set(
      parseArray(row.requiredUserRoles)
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => Object.values(UserRole).includes(entry as UserRole))
    )
  ) as UserRole[];
  const requiredAdminRoleIds = Array.from(
    new Set(
      parseArray(row.requiredAdminRoleIds)
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
    )
  );
  return {
    enabled: row.enabled === true,
    allowEmailOtp: row.allowEmailOtp !== false,
    allowTotpAuthenticator: row.allowTotpAuthenticator !== false,
    otpLength: Number.isFinite(Number(row.otpLength))
      ? Math.max(4, Math.min(8, Math.round(Number(row.otpLength))))
      : DEFAULT_AUTHENTICATOR_SETTINGS.otpLength,
    otpExpiryMinutes: Number.isFinite(Number(row.otpExpiryMinutes))
      ? Math.max(1, Math.min(30, Math.round(Number(row.otpExpiryMinutes))))
      : DEFAULT_AUTHENTICATOR_SETTINGS.otpExpiryMinutes,
    challengeMaxAttempts: Number.isFinite(Number(row.challengeMaxAttempts))
      ? Math.max(1, Math.min(12, Math.round(Number(row.challengeMaxAttempts))))
      : DEFAULT_AUTHENTICATOR_SETTINGS.challengeMaxAttempts,
    totpIssuer: String(row.totpIssuer || DEFAULT_AUTHENTICATOR_SETTINGS.totpIssuer).trim().slice(0, 120),
    totpPeriodSeconds: Number.isFinite(Number(row.totpPeriodSeconds))
      ? Math.max(15, Math.min(120, Math.round(Number(row.totpPeriodSeconds))))
      : DEFAULT_AUTHENTICATOR_SETTINGS.totpPeriodSeconds,
    totpDigits: Number.isFinite(Number(row.totpDigits))
      ? Math.max(6, Math.min(8, Math.round(Number(row.totpDigits))))
      : DEFAULT_AUTHENTICATOR_SETTINGS.totpDigits,
    requiredUserRoles: hasRequiredUserRoles ? requiredUserRoles : [...DEFAULT_AUTHENTICATOR_SETTINGS.requiredUserRoles],
    requiredAdminRoleIds,
  };
};

const encryptionKey = crypto
  .createHash('sha256')
  .update(String(process.env.JWT_SECRET || process.env.SMTP_PASS || 'african-fashion-authenticator'))
  .digest();

const base64UrlEncode = (value: Buffer) =>
  value.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const base64UrlDecode = (value: string) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64');
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const BASE32_INDEX = new Map(BASE32_ALPHABET.split('').map((entry, index) => [entry, index]));

export const base32Encode = (buffer: Buffer) => {
  if (!buffer.length) return '';
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
};

export const base32Decode = (input: string) => {
  const normalized = String(input || '').trim().toUpperCase().replace(/=+$/g, '').replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const token of normalized) {
    const index = BASE32_INDEX.get(token);
    if (index === undefined) continue;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

export const encryptTotpSecret = (secret: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(String(secret || ''), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${base64UrlEncode(iv)}:${base64UrlEncode(tag)}:${base64UrlEncode(encrypted)}`;
};

export const decryptTotpSecret = (value: string | null | undefined) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (!raw.startsWith('v1:')) return raw;
  const parts = raw.split(':');
  if (parts.length !== 4) return '';
  try {
    const iv = base64UrlDecode(parts[1]);
    const tag = base64UrlDecode(parts[2]);
    const data = base64UrlDecode(parts[3]);
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return '';
  }
};

const sanitizeCode = (value: string) => String(value || '').replace(/\D+/g, '');

export const verifyTotpCode = (params: {
  secretBase32: string;
  code: string;
  periodSeconds: number;
  digits: number;
  window?: number;
}) => {
  const code = sanitizeCode(params.code);
  const digits = Math.max(6, Math.min(8, Number(params.digits || 6)));
  if (code.length !== digits) return false;
  const period = Math.max(15, Math.min(120, Number(params.periodSeconds || 30)));
  const window = Math.max(0, Math.min(3, Number(params.window || 1)));
  const secret = base32Decode(params.secretBase32);
  if (!secret.length) return false;
  const hotp = (counter: number) => {
    const counterBuf = Buffer.alloc(8);
    counterBuf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuf.writeUInt32BE(counter >>> 0, 4);
    const digest = crypto.createHmac('sha1', secret).update(counterBuf).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const num =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return String(num % 10 ** digits).padStart(digits, '0');
  };
  const nowCounter = Math.floor(Date.now() / 1000 / period);
  for (let offset = -window; offset <= window; offset += 1) {
    const counter = nowCounter + offset;
    if (counter >= 0 && hotp(counter) === code) return true;
  }
  return false;
};

export const generateTotpSecretBase32 = (bytes = 20) => base32Encode(crypto.randomBytes(Math.max(16, Math.min(64, bytes))));

export const buildOtpAuthUri = (params: {
  secretBase32: string;
  accountLabel: string;
  issuer: string;
  periodSeconds: number;
  digits: number;
}) => {
  const issuer = encodeURIComponent(String(params.issuer || 'African Fashion').trim());
  const label = encodeURIComponent(String(params.accountLabel || '').trim() || 'user');
  return `otpauth://totp/${issuer}:${label}?secret=${encodeURIComponent(String(params.secretBase32 || ''))}&issuer=${issuer}&period=${Math.max(15, Math.min(120, Number(params.periodSeconds || 30)))}&digits=${Math.max(6, Math.min(8, Number(params.digits || 6)))}`;
};

export const generateNumericOtp = (length: number) => {
  const size = Math.max(4, Math.min(8, Math.round(Number(length || 6))));
  let output = '';
  while (output.length < size) output += String(crypto.randomInt(0, 10));
  return output;
};

export const hashChallengeCode = (challengeId: string, code: string) =>
  crypto.createHash('sha256').update(`${String(challengeId || '')}:${sanitizeCode(code)}`).digest('hex');

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

export async function ensureAuthenticatorSchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${SETTINGS_TABLE}" ("id" TEXT PRIMARY KEY, "key" TEXT NOT NULL, "value" JSONB NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${SETTINGS_TABLE}_key_key" ON "${SETTINGS_TABLE}"("key")`
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "mfaPreferredMethod" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false`);
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "${CHALLENGE_TABLE}" ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "purpose" TEXT NOT NULL DEFAULT 'LOGIN', "method" TEXT NOT NULL, "codeHash" TEXT, "pendingTotpSecret" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "${CHALLENGE_TABLE}_userId_idx" ON "${CHALLENGE_TABLE}"("userId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "${CHALLENGE_TABLE}_expiresAt_idx" ON "${CHALLENGE_TABLE}"("expiresAt")`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "${CHALLENGE_TABLE}" ADD CONSTRAINT "${CHALLENGE_TABLE}_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE`
      ).catch(() => undefined);
      schemaEnsured = true;
    })();
  }
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

export async function readAuthenticatorSettings(): Promise<AuthenticatorSettings> {
  await ensureAuthenticatorSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "${SETTINGS_TABLE}" WHERE "key" = $1 LIMIT 1`,
    SETTINGS_KEY
  );
  return normalizeSettings(rows[0]?.value || DEFAULT_AUTHENTICATOR_SETTINGS);
}

export async function writeAuthenticatorSettings(patch: unknown): Promise<AuthenticatorSettings> {
  await ensureAuthenticatorSchema();
  const parsed = authenticatorSettingsPatchSchema.parse(patch || {});
  const current = await readAuthenticatorSettings();
  const next = normalizeSettings({ ...current, ...parsed });
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${SETTINGS_TABLE}" ("id","key","value","createdAt","updatedAt") VALUES ($1,$2,$3::jsonb,NOW(),NOW()) ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value","updatedAt" = NOW()`,
    randomUUID(),
    SETTINGS_KEY,
    JSON.stringify(next)
  );
  return next;
}

export async function listAdminRolesForAuthenticatorPolicy() {
  await ensureAuthenticatorSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; name: string; isActive: boolean }>>(
    `SELECT "id","name","isActive" FROM "AdminRole" ORDER BY LOWER("name") ASC`
  );
  return Array.isArray(rows) ? rows.map((row) => ({ id: String(row.id), name: String(row.name), isActive: row.isActive !== false })) : [];
}

export async function readUserMfaProfile(userId: string) {
  await ensureAuthenticatorSchema();
  const rows = await prisma.$queryRawUnsafe<
    Array<{ mfaPreferredMethod: string | null; totpSecret: string | null; totpEnabled: boolean | null }>
  >(
    `SELECT "mfaPreferredMethod","totpSecret","totpEnabled" FROM "User" WHERE "id" = $1 LIMIT 1`,
    userId
  );
  const row = rows[0];
  return {
    preferredMethod: toMethod(row?.mfaPreferredMethod),
    totpSecret: row?.totpSecret ? String(row.totpSecret) : null,
    totpEnabled: row?.totpEnabled === true,
  };
}

export async function updateUserMfaPreferredMethod(userId: string, method: AuthenticatorMethod | null) {
  await ensureAuthenticatorSchema();
  await prisma.$executeRawUnsafe(`UPDATE "User" SET "mfaPreferredMethod" = $1, "updatedAt" = NOW() WHERE "id" = $2`, method, userId);
}

export async function saveUserTotpSecret(userId: string, encryptedSecret: string) {
  await ensureAuthenticatorSchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "User" SET "totpSecret" = $1, "totpEnabled" = true, "updatedAt" = NOW() WHERE "id" = $2`,
    encryptedSecret,
    userId
  );
}

export async function resolveAdminRoleIdForUser(userId: string) {
  await ensureAuthenticatorSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ adminRoleId: string | null }>>(
    `SELECT "adminRoleId" FROM "AdminProfile" WHERE "userId" = $1 LIMIT 1`,
    userId
  );
  return rows[0]?.adminRoleId ? String(rows[0].adminRoleId) : null;
}

export async function isAuthenticatorRequiredForUser(params: { userId: string; role: UserRole; settings?: AuthenticatorSettings }) {
  const settings = params.settings || (await readAuthenticatorSettings());
  if (!settings.enabled) return { required: false, settings };
  const roleSet = new Set((settings.requiredUserRoles || []).map((entry) => String(entry || '').trim().toUpperCase()));
  if (roleSet.has(String(params.role || '').trim().toUpperCase())) return { required: true, settings };
  if (params.role !== UserRole.ADMINISTRATOR || !settings.requiredAdminRoleIds.length) return { required: false, settings };
  const adminRoleId = await resolveAdminRoleIdForUser(params.userId);
  const adminRoleSet = new Set(settings.requiredAdminRoleIds.map((entry) => String(entry || '').trim()));
  if (!adminRoleId && adminRoleSet.has(UNASSIGNED_ADMIN_ROLE_TOKEN)) return { required: true, settings };
  if (adminRoleId && adminRoleSet.has(adminRoleId)) return { required: true, settings };
  return { required: false, settings };
}

export async function createLoginChallenge(params: {
  userId: string;
  method: AuthenticatorMethod;
  expiresAt: Date;
  maxAttempts: number;
  codeHash?: string | null;
  pendingTotpSecret?: string | null;
}) {
  await ensureAuthenticatorSchema();
  const challengeId = randomUUID();
  await prisma.$executeRawUnsafe(`DELETE FROM "${CHALLENGE_TABLE}" WHERE "userId" = $1 AND "purpose" = 'LOGIN'`, params.userId);
  await prisma.$executeRawUnsafe(
    `INSERT INTO "${CHALLENGE_TABLE}" ("id","userId","purpose","method","codeHash","pendingTotpSecret","expiresAt","attemptCount","maxAttempts","createdAt","updatedAt")
     VALUES ($1,$2,'LOGIN',$3,$4,$5,$6,0,$7,NOW(),NOW())`,
    challengeId,
    params.userId,
    params.method,
    params.codeHash || null,
    params.pendingTotpSecret || null,
    params.expiresAt,
    Math.max(1, Number(params.maxAttempts || 5))
  );
  return readLoginChallenge(challengeId);
}

export async function readLoginChallenge(challengeId: string) {
  await ensureAuthenticatorSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "id","userId","purpose","method","codeHash","pendingTotpSecret","expiresAt","attemptCount","maxAttempts"
     FROM "${CHALLENGE_TABLE}" WHERE "id" = $1 AND "purpose" = 'LOGIN' LIMIT 1`,
    challengeId
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.userId || ''),
    purpose: String(row.purpose || 'LOGIN'),
    method: methodSchema.parse(String(row.method || 'EMAIL_OTP').toUpperCase()),
    codeHash: row.codeHash ? String(row.codeHash) : null,
    pendingTotpSecret: row.pendingTotpSecret ? String(row.pendingTotpSecret) : null,
    expiresAt: new Date(row.expiresAt),
    attemptCount: Number(row.attemptCount || 0),
    maxAttempts: Number(row.maxAttempts || 5),
  };
}

export async function updateLoginChallenge(challengeId: string, patch: {
  method?: AuthenticatorMethod;
  codeHash?: string | null;
  pendingTotpSecret?: string | null;
  expiresAt?: Date;
  attemptCount?: number;
}) {
  const current = await readLoginChallenge(challengeId);
  if (!current) return null;
  await prisma.$executeRawUnsafe(
    `UPDATE "${CHALLENGE_TABLE}"
     SET "method" = $2,
         "codeHash" = $3,
         "pendingTotpSecret" = $4,
         "expiresAt" = $5,
         "attemptCount" = $6,
         "updatedAt" = NOW()
     WHERE "id" = $1`,
    challengeId,
    patch.method || current.method,
    patch.codeHash !== undefined ? patch.codeHash : current.codeHash,
    patch.pendingTotpSecret !== undefined ? patch.pendingTotpSecret : current.pendingTotpSecret,
    patch.expiresAt || current.expiresAt,
    Number.isFinite(Number(patch.attemptCount)) ? Number(patch.attemptCount) : current.attemptCount
  );
  return readLoginChallenge(challengeId);
}

export async function deleteLoginChallenge(challengeId: string) {
  await ensureAuthenticatorSchema();
  await prisma.$executeRawUnsafe(`DELETE FROM "${CHALLENGE_TABLE}" WHERE "id" = $1`, challengeId);
}

