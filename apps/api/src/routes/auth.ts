import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
import { prisma, UserRole, UserStatus } from '../db';
import { generateToken, authenticate } from '../middleware/auth';
import { getRolePermissions, ROLE_HOME_ROUTE, sanitizePermissionGrants } from '../rbac';
import { bootstrapAdminConfig } from '../bootstrap';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email('Invalid email address').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  fullName: z.string().min(2).optional(),
  phone: z.string().optional(),
  role: z.enum(['CUSTOMER', 'FABRIC_SELLER', 'FASHION_DESIGNER']),
  // Role-specific fields
  businessName: z.string().optional(),
  businessEmail: z.string().email().optional(),
  businessPhone: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  bio: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address').transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1, 'Password is required'),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});
const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address').transform((value) => value.toLowerCase().trim()),
});
const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const AFRICAN_COUNTRY_CODE_TO_NAME = new Map<string, string>([
  ['DZ', 'Algeria'],
  ['AO', 'Angola'],
  ['BJ', 'Benin'],
  ['BW', 'Botswana'],
  ['BF', 'Burkina Faso'],
  ['BI', 'Burundi'],
  ['CM', 'Cameroon'],
  ['CV', 'Cape Verde'],
  ['CF', 'Central African Republic'],
  ['TD', 'Chad'],
  ['KM', 'Comoros'],
  ['CG', 'Republic of the Congo'],
  ['CD', 'Democratic Republic of the Congo'],
  ['CI', "Cote d'Ivoire"],
  ['DJ', 'Djibouti'],
  ['EG', 'Egypt'],
  ['GQ', 'Equatorial Guinea'],
  ['ER', 'Eritrea'],
  ['SZ', 'Eswatini'],
  ['ET', 'Ethiopia'],
  ['GA', 'Gabon'],
  ['GM', 'Gambia'],
  ['GH', 'Ghana'],
  ['GN', 'Guinea'],
  ['GW', 'Guinea-Bissau'],
  ['KE', 'Kenya'],
  ['LS', 'Lesotho'],
  ['LR', 'Liberia'],
  ['LY', 'Libya'],
  ['MG', 'Madagascar'],
  ['MW', 'Malawi'],
  ['ML', 'Mali'],
  ['MR', 'Mauritania'],
  ['MU', 'Mauritius'],
  ['MA', 'Morocco'],
  ['MZ', 'Mozambique'],
  ['NA', 'Namibia'],
  ['NE', 'Niger'],
  ['NG', 'Nigeria'],
  ['RW', 'Rwanda'],
  ['ST', 'Sao Tome and Principe'],
  ['SN', 'Senegal'],
  ['SC', 'Seychelles'],
  ['SL', 'Sierra Leone'],
  ['SO', 'Somalia'],
  ['ZA', 'South Africa'],
  ['SS', 'South Sudan'],
  ['SD', 'Sudan'],
  ['TZ', 'Tanzania'],
  ['TG', 'Togo'],
  ['TN', 'Tunisia'],
  ['UG', 'Uganda'],
  ['ZM', 'Zambia'],
  ['ZW', 'Zimbabwe'],
]);
const AFRICAN_COUNTRY_NAME_SET = new Set(
  Array.from(AFRICAN_COUNTRY_CODE_TO_NAME.values()).map((value) => value.toLowerCase())
);

const normalizeVendorRegistrationCountry = (countryInput: string | undefined | null) => {
  const raw = String(countryInput || '').trim();
  if (!raw) return null;
  const code = raw.toUpperCase();
  if (AFRICAN_COUNTRY_CODE_TO_NAME.has(code)) {
    return AFRICAN_COUNTRY_CODE_TO_NAME.get(code) || null;
  }
  if (AFRICAN_COUNTRY_NAME_SET.has(raw.toLowerCase())) {
    return raw;
  }
  return null;
};

const ensureVendorProfileSubmissionSchema = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "VendorProfileSubmission" (
      "id" TEXT NOT NULL,
      "role" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "businessName" TEXT,
      "profileStatus" TEXT NOT NULL DEFAULT 'SUBMITTED',
      "profileData" JSONB,
      "profileSubmittedAt" TIMESTAMP(3),
      "profileReviewedAt" TIMESTAMP(3),
      "profileReviewNotes" TEXT,
      "profileReviewMessage" TEXT,
      "rejectionType" TEXT,
      "rejectionReasonCode" TEXT,
      "rejectionReasonLabel" TEXT,
      "permanentRejectionAt" TIMESTAMP(3),
      "permanentDisableAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "VendorProfileSubmission_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "VendorProfileSubmission_role_userId_key" ON "VendorProfileSubmission"("role","userId")`
  );
};

const upsertVendorOnboardingSubmission = async (input: {
  role: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
  userId: string;
  businessName: string;
  profileData: Record<string, unknown>;
}) => {
  try {
    await ensureVendorProfileSubmissionSchema();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VendorProfileSubmission"
        ("id","role","userId","businessName","profileStatus","profileData","profileSubmittedAt","profileReviewedAt","profileReviewNotes","profileReviewMessage","rejectionType","rejectionReasonCode","rejectionReasonLabel","permanentRejectionAt","permanentDisableAt","updatedAt")
       VALUES ($1,$2,$3,$4,'INCOMPLETE',$5::jsonb,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NOW())
       ON CONFLICT ("role","userId")
       DO UPDATE SET
         "businessName" = EXCLUDED."businessName",
         "profileStatus" = CASE
           WHEN "VendorProfileSubmission"."profileStatus" = 'APPROVED' THEN "VendorProfileSubmission"."profileStatus"
           ELSE EXCLUDED."profileStatus"
         END,
         "profileData" = COALESCE("VendorProfileSubmission"."profileData", '{}'::jsonb) || EXCLUDED."profileData",
         "updatedAt" = NOW()`,
      crypto.randomUUID(),
      input.role,
      input.userId,
      input.businessName,
      JSON.stringify(input.profileData || {})
    );
  } catch {
    // Best-effort bootstrap for governance visibility.
  }
};

const BCRYPT_PATTERN = /^\$2[aby]\$\d{2}\$/;
const isSchemaDriftError = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  (error.code === 'P2021' || error.code === 'P2022');

const normalizeStoredPassword = (storedPassword: string) => {
  let normalized = storedPassword.trim();
  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1);
  }
  if (normalized.startsWith('$2y$')) {
    normalized = `$2b$${normalized.slice(4)}`;
  }
  if (normalized.startsWith('$2x$')) {
    normalized = `$2b$${normalized.slice(4)}`;
  }
  if (normalized.startsWith('\\$2')) {
    normalized = normalized.replace(/\\\$/g, '$');
  }
  if (normalized.startsWith('bcrypt_sha256$')) {
    normalized = normalized.slice('bcrypt_sha256$'.length);
  }
  if (normalized.startsWith('bcrypt$')) {
    normalized = normalized.slice('bcrypt$'.length);
  }
  return normalized;
};

const timingSafeEqualUtf8 = (a: string, b: string) => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const hasLegacyDigestMatch = (plainPassword: string, storedPassword: string) => {
  const normalized = storedPassword.trim().toLowerCase();
  const md5 = crypto.createHash('md5').update(plainPassword).digest('hex');
  const sha1 = crypto.createHash('sha1').update(plainPassword).digest('hex');
  const sha256 = crypto.createHash('sha256').update(plainPassword).digest('hex');
  const ldapSha = `{sha}${crypto.createHash('sha1').update(plainPassword).digest('base64')}`.toLowerCase();

  return (
    normalized === md5 ||
    normalized === sha1 ||
    normalized === sha256 ||
    normalized === `md5:${md5}` ||
    normalized === `sha1:${sha1}` ||
    normalized === `sha256:${sha256}` ||
    normalized === ldapSha
  );
};

const verifyLegacyPbkdf2 = (plainPassword: string, storedPassword: string) => {
  const normalized = storedPassword.trim();

  // Django format: pbkdf2_sha256$260000$salt$base64hash
  const djangoParts = normalized.split('$');
  if (djangoParts.length === 4 && (djangoParts[0] === 'pbkdf2_sha256' || djangoParts[0] === 'pbkdf2_sha1')) {
    const iterations = Number.parseInt(djangoParts[1], 10);
    const salt = djangoParts[2];
    const expected = djangoParts[3];
    if (Number.isFinite(iterations) && iterations > 0 && salt && expected) {
      const digest = djangoParts[0] === 'pbkdf2_sha1' ? 'sha1' : 'sha256';
      const keyLength = digest === 'sha1' ? 20 : 32;
      const computed = crypto.pbkdf2Sync(plainPassword, salt, iterations, keyLength, digest).toString('base64');
      return timingSafeEqualUtf8(computed, expected);
    }
  }

  // Werkzeug/Flask format: pbkdf2:sha256:260000$salt$hexhash
  const werkzeugParts = normalized.split('$');
  if (werkzeugParts.length === 3 && werkzeugParts[0].startsWith('pbkdf2:')) {
    const methodParts = werkzeugParts[0].split(':');
    if (methodParts.length === 3) {
      const digest = methodParts[1];
      const iterations = Number.parseInt(methodParts[2], 10);
      const salt = werkzeugParts[1];
      const expectedHex = werkzeugParts[2];
      if ((digest === 'sha256' || digest === 'sha1') && Number.isFinite(iterations) && iterations > 0 && salt && expectedHex) {
        const keyLength = digest === 'sha1' ? 20 : 32;
        const computedHex = crypto.pbkdf2Sync(plainPassword, salt, iterations, keyLength, digest).toString('hex');
        return timingSafeEqualUtf8(computedHex, expectedHex);
      }
    }
  }

  return false;
};

async function verifyPasswordCompat(plainPassword: string, storedPassword: string) {
  const normalized = normalizeStoredPassword(storedPassword);
  const candidates = Array.from(new Set([storedPassword, normalized])).filter(Boolean);

  for (const candidate of candidates) {
    if (!BCRYPT_PATTERN.test(candidate)) continue;
    try {
      const matches = await bcrypt.compare(plainPassword, candidate);
      if (matches) {
        return {
          isValid: true,
          shouldUpgradeHash: candidate !== storedPassword,
        };
      }
    } catch {
      // Ignore malformed bcrypt values and continue legacy checks.
    }
  }

  if (!BCRYPT_PATTERN.test(normalized) && plainPassword === normalized) {
    return { isValid: true, shouldUpgradeHash: true };
  }

  if (hasLegacyDigestMatch(plainPassword, normalized)) {
    return { isValid: true, shouldUpgradeHash: true };
  }

  if (verifyLegacyPbkdf2(plainPassword, normalized)) {
    return { isValid: true, shouldUpgradeHash: true };
  }

  return { isValid: false, shouldUpgradeHash: false };
}

async function resolveEffectivePermissions(userId: string, role: UserRole) {
  const rolePermissions = getRolePermissions(role);
  if (role !== UserRole.ADMINISTRATOR) {
    return rolePermissions;
  }
  try {
    const profile = await prisma.adminProfile.findUnique({
      where: { userId },
      select: { permissions: true },
    });
    const adminPermissions = sanitizePermissionGrants(profile?.permissions);
    return adminPermissions.length > 0 ? adminPermissions : rolePermissions;
  } catch {
    return rolePermissions;
  }
}

type VendorRejectionSnapshot = {
  profileStatus: string;
  rejectionType: string | null;
  permanentDisableAt: Date | null;
};
const normalizeVendorRejectionType = (value: unknown): 'TEMPORARY' | 'PERMANENT' | null => {
  const normalized = String(value || '').toUpperCase();
  if (normalized === 'TEMPORARY' || normalized === 'PERMANENT') return normalized;
  return null;
};
async function readVendorRejectionSnapshot(
  userId: string,
  role: 'FABRIC_SELLER' | 'FASHION_DESIGNER'
): Promise<VendorRejectionSnapshot | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "profileStatus","rejectionType","permanentDisableAt"
       FROM "VendorProfileSubmission"
       WHERE "role"::text = $1 AND "userId" = $2
       ORDER BY COALESCE("updatedAt","profileReviewedAt","profileSubmittedAt") DESC NULLS LAST
       LIMIT 1`,
      role,
      userId
    );
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const row = rows[0];
    return {
      profileStatus: String(row?.profileStatus || ''),
      rejectionType: row?.rejectionType ? String(row.rejectionType) : null,
      permanentDisableAt: row?.permanentDisableAt ? new Date(row.permanentDisableAt) : null,
    };
  } catch {
    return null;
  }
}

async function applyVendorRejectionPolicy(user: {
  id: string;
  role: UserRole;
  status: UserStatus;
}) {
  const isVendor =
    user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER;
  if (!isVendor) return { user, blockedMessage: null as string | null };
  const snapshot = await readVendorRejectionSnapshot(
    user.id,
    user.role as 'FABRIC_SELLER' | 'FASHION_DESIGNER'
  );
  const rejectionType = normalizeVendorRejectionType(snapshot?.rejectionType);
  const statusToken = String(snapshot?.profileStatus || '').toUpperCase();
  const now = Date.now();

  if (statusToken === 'REJECTED' && rejectionType === 'PERMANENT') {
    const disableAt = snapshot?.permanentDisableAt ? Number(snapshot.permanentDisableAt.getTime()) : NaN;
    if (Number.isFinite(disableAt) && disableAt <= now) {
      if (user.status !== UserStatus.SUSPENDED) {
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: { status: UserStatus.SUSPENDED },
        });
        return {
          user: { ...user, status: updated.status as UserStatus },
          blockedMessage:
            'Your vendor account has been permanently disabled after rejection. Please contact support.',
        };
      }
      return {
        user,
        blockedMessage:
          'Your vendor account has been permanently disabled after rejection. Please contact support.',
      };
    }
  }

  if (user.status === UserStatus.REJECTED) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });
    return { user: { ...user, status: updated.status as UserStatus }, blockedMessage: null as string | null };
  }

  return { user, blockedMessage: null as string | null };
}

const AUTH_PAGE_SETTINGS_KEY = 'AUTH_PAGE_SETTINGS';
const GOOGLE_CLIENT_IDS_FROM_ENV = Array.from(
  new Set(
    [
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_OAUTH_CLIENT_ID,
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.VITE_GOOGLE_CLIENT_ID,
    ]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  )
);
const GOOGLE_CLIENT_ID_CACHE_TTL_MS = 60_000;
let cachedGoogleClientIdsFromSettings: string[] = [];
let cachedGoogleClientIdsFromSettingsAt = 0;

const parseGoogleClientIdTokens = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }
  const text = String(value || '').trim();
  if (!text) return [];
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => String(entry || '').trim())
          .filter(Boolean);
      }
    } catch {
      // fall through
    }
  }
  return text
    .split(/[,\n]/g)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const parseJsonRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  const text = String(value || '').trim();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
};

const readGoogleClientIdsFromAuthSettings = async (): Promise<string[]> => {
  const now = Date.now();
  if (
    cachedGoogleClientIdsFromSettingsAt > 0 &&
    now - cachedGoogleClientIdsFromSettingsAt < GOOGLE_CLIENT_ID_CACHE_TTL_MS
  ) {
    return [...cachedGoogleClientIdsFromSettings];
  }
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
      `SELECT "value" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
      AUTH_PAGE_SETTINGS_KEY
    );
    const payload = rows[0] ? parseJsonRecord(rows[0].value) : {};
    const ids = Array.from(
      new Set([
        ...parseGoogleClientIdTokens(payload.googleClientIds),
        ...parseGoogleClientIdTokens(payload.googleClientId),
      ])
    );
    cachedGoogleClientIdsFromSettings = ids;
    cachedGoogleClientIdsFromSettingsAt = now;
    return [...ids];
  } catch {
    return [...cachedGoogleClientIdsFromSettings];
  }
};

const resolveGoogleClientIds = async () => {
  const settingsIds = await readGoogleClientIdsFromAuthSettings();
  return Array.from(new Set([...GOOGLE_CLIENT_IDS_FROM_ENV, ...settingsIds]));
};

const googleClient = new OAuth2Client();
let googleAuthSchemaEnsured = false;
let googleAuthSchemaPromise: Promise<void> | null = null;
let passwordResetSchemaEnsured = false;
let passwordResetSchemaPromise: Promise<void> | null = null;
let cachedTransporter: nodemailer.Transporter | null | undefined;

function getMailer(): nodemailer.Transporter | null {
  if (cachedTransporter !== undefined) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransporter = null;
    return null;
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass },
  });
  return cachedTransporter;
}

async function sendEmail(input: { to: string; subject: string; text: string; html: string }) {
  const transporter = getMailer();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!transporter || !from || !input.to) return;
  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

const appPublicBaseUrl = () =>
  String(
    process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      process.env.WEB_BASE_URL ||
      process.env.VITE_APP_URL ||
      'https://african-fashion-zurikaribu.vercel.app'
  )
    .trim()
    .replace(/\/+$/, '');
const hashResetToken = (token: string) => crypto.createHash('sha256').update(String(token)).digest('hex');

const parseNameFromGoogle = (payload: Record<string, unknown>) => {
  const givenName = String(payload.given_name || '').trim();
  const familyName = String(payload.family_name || '').trim();
  if (givenName && familyName) {
    return { firstName: givenName, lastName: familyName };
  }
  const fullName = String(payload.name || '').trim();
  if (fullName) {
    const [firstName = '', ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ') || firstName || 'User';
    return { firstName: firstName || 'User', lastName };
  }
  return { firstName: 'Google', lastName: 'User' };
};

const ensureGoogleAuthSchema = async () => {
  if (googleAuthSchemaEnsured) return;
  if (!googleAuthSchemaPromise) {
    googleAuthSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "GoogleAuthLink" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "googleSub" TEXT NOT NULL,
          "email" TEXT NOT NULL,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "GoogleAuthLink_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "GoogleAuthLink_userId_key" ON "GoogleAuthLink"("userId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "GoogleAuthLink_googleSub_key" ON "GoogleAuthLink"("googleSub")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "GoogleAuthLink_email_idx" ON "GoogleAuthLink"("email")`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "GoogleAuthLink"
         ADD CONSTRAINT "GoogleAuthLink_userId_fkey"
         FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE`
      ).catch(() => undefined);
      googleAuthSchemaEnsured = true;
    })();
  }
  try {
    await googleAuthSchemaPromise;
  } finally {
    googleAuthSchemaPromise = null;
  }
};

const ensurePasswordResetSchema = async () => {
  if (passwordResetSchemaEnsured) return;
  if (!passwordResetSchemaPromise) {
    passwordResetSchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
          "id" TEXT NOT NULL,
          "userId" TEXT NOT NULL,
          "tokenHash" TEXT NOT NULL,
          "expiresAt" TIMESTAMP(3) NOT NULL,
          "usedAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt")`
      );
      await prisma
        .$executeRawUnsafe(
          `ALTER TABLE "PasswordResetToken"
           ADD CONSTRAINT "PasswordResetToken_userId_fkey"
           FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE`
        )
        .catch(() => undefined);
      passwordResetSchemaEnsured = true;
    })();
  }
  try {
    await passwordResetSchemaPromise;
  } finally {
    passwordResetSchemaPromise = null;
  }
};

type GoogleAuthLinkRow = {
  userId: string;
  googleSub: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
};

const getGoogleAuthLinkBySub = async (googleSub: string) => {
  await ensureGoogleAuthSchema();
  const rows = await prisma.$queryRawUnsafe<Array<GoogleAuthLinkRow>>(
    `SELECT "userId","googleSub","email","createdAt","updatedAt"
     FROM "GoogleAuthLink"
     WHERE "googleSub" = $1
     LIMIT 1`,
    googleSub
  );
  return rows[0] || null;
};

const getGoogleAuthLinkByUserId = async (userId: string) => {
  await ensureGoogleAuthSchema();
  const rows = await prisma.$queryRawUnsafe<Array<GoogleAuthLinkRow>>(
    `SELECT "userId","googleSub","email","createdAt","updatedAt"
     FROM "GoogleAuthLink"
     WHERE "userId" = $1
     LIMIT 1`,
    userId
  );
  return rows[0] || null;
};

const upsertGoogleAuthLink = async (params: { userId: string; googleSub: string; email: string }) => {
  await ensureGoogleAuthSchema();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "GoogleAuthLink" ("id","userId","googleSub","email","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,NOW(),NOW())
     ON CONFLICT ("userId")
     DO UPDATE SET "googleSub" = EXCLUDED."googleSub", "email" = EXCLUDED."email", "updatedAt" = NOW()`,
    crypto.randomUUID(),
    params.userId,
    params.googleSub,
    params.email
  );
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);
    const namesFromFullName = data.fullName ? data.fullName.trim().split(/\s+/) : [];
    const firstName = (data.firstName || namesFromFullName[0] || '').trim();
    const lastName = (data.lastName || namesFromFullName.slice(1).join(' ') || firstName).trim();

    if (firstName.length < 2 || lastName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'First name and last name are required.',
      });
    }

    // Check if email already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        email: { equals: data.email, mode: 'insensitive' },
      },
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered. Please login or use a different email.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user with role-specific profile
    const userData: any = {
      email: data.email,
      password: hashedPassword,
      firstName,
      lastName,
      phone: data.phone,
      role: data.role as UserRole,
      // Vendors can log in immediately to complete full profile submission.
      status: UserStatus.ACTIVE,
    };

    const normalizedVendorCountry =
      data.role === 'FABRIC_SELLER' || data.role === 'FASHION_DESIGNER'
        ? normalizeVendorRegistrationCountry(data.country)
        : null;
    if ((data.role === 'FABRIC_SELLER' || data.role === 'FASHION_DESIGNER') && !normalizedVendorCountry) {
      return res.status(400).json({
        success: false,
        message: 'Seller/Designer registration is restricted to African countries only.',
      });
    }

    // Add role-specific profile
    if (data.role === 'CUSTOMER') {
      userData.customerProfile = {
        create: {},
      };
    } else if (data.role === 'FABRIC_SELLER') {
      if (!data.businessName || !data.country || !data.city) {
        return res.status(400).json({
          success: false,
          message: 'Business name, country, and city are required for fabric sellers.',
        });
      }
      userData.fabricSellerProfile = {
        create: {
          businessName: data.businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          country: normalizedVendorCountry || data.country,
          city: data.city,
          address: data.address || '',
          isVerified: false,
        },
      };
    } else if (data.role === 'FASHION_DESIGNER') {
      if (!data.businessName || !data.country || !data.city) {
        return res.status(400).json({
          success: false,
          message: 'Business name, country, and city are required for designers.',
        });
      }
      userData.designerProfile = {
        create: {
          businessName: data.businessName,
          businessEmail: data.businessEmail || data.email,
          businessPhone: data.businessPhone || data.phone,
          bio: data.bio,
          country: normalizedVendorCountry || data.country,
          city: data.city,
          address: data.address || '',
          isVerified: false,
        },
      };
    }

    const user = await prisma.user.create({
      data: userData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    if (data.role === 'FABRIC_SELLER' || data.role === 'FASHION_DESIGNER') {
      await upsertVendorOnboardingSubmission({
        role: data.role,
        userId: user.id,
        businessName: String(data.businessName || `${firstName} ${lastName}`).trim(),
        profileData: {
          businessName: String(data.businessName || '').trim(),
          businessEmail: String(data.businessEmail || data.email || '').trim(),
          businessPhone: String(data.businessPhone || data.phone || '').trim(),
          country: String(normalizedVendorCountry || data.country || '').trim(),
          city: String(data.city || '').trim(),
          address: String(data.address || '').trim(),
          ...(data.role === 'FASHION_DESIGNER' ? { bio: String(data.bio || '').trim() } : {}),
        },
      });
    }

    // Only ACTIVE users should receive an authentication token immediately.
    const token = user.status === UserStatus.ACTIVE
      ? generateToken({
          id: user.id,
          email: user.email,
          role: user.role as UserRole,
        })
      : null;

    res.status(201).json({
      success: true,
      message: data.role === 'CUSTOMER' 
        ? 'Registration successful! Welcome to African Fashion.'
        : 'Registration successful! Please complete your full vendor profile for admin approval before uploading products.',
      data: {
        user,
        token,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role as UserRole],
          permissions: getRolePermissions(user.role as UserRole),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const data = loginSchema.parse(req.body);

    const isBootstrapAdminAttempt =
      data.email === bootstrapAdminConfig.email &&
      data.password === bootstrapAdminConfig.password;

    // Find user
    let user = await prisma.user.findFirst({
      where: {
        email: { equals: data.email, mode: 'insensitive' },
      },
    });

    // Fallback for legacy/imported rows where email contains accidental whitespace.
    if (!user) {
      const matchedUsers = await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT id FROM "User" WHERE LOWER(TRIM(email)) = LOWER(TRIM(${data.email})) LIMIT 1`,
      );
      if (matchedUsers.length > 0) {
        user = await prisma.user.findUnique({
          where: { id: matchedUsers[0].id },
        });
      }
    }

    // Last-resort self-heal: create bootstrap admin on-demand if missing.
    if (!user && isBootstrapAdminAttempt) {
      const bootstrapPasswordHash = await bcrypt.hash(bootstrapAdminConfig.password, 10);
      try {
        user = await prisma.user.create({
          data: {
            email: bootstrapAdminConfig.email,
            password: bootstrapPasswordHash,
            firstName: 'System',
            lastName: 'Administrator',
            role: UserRole.ADMINISTRATOR,
            status: UserStatus.ACTIVE,
            adminProfile: { create: {} },
          },
        });
      } catch (error) {
        if (!isSchemaDriftError(error)) throw error;
        user = await prisma.user.create({
          data: {
            email: bootstrapAdminConfig.email,
            password: bootstrapPasswordHash,
            firstName: 'System',
            lastName: 'Administrator',
            role: UserRole.ADMINISTRATOR,
            status: UserStatus.ACTIVE,
          },
        });
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Verify password with legacy compatibility and auto-upgrade hash format on success.
    let passwordCheck = await verifyPasswordCompat(data.password, user.password);
    let isValidPassword = passwordCheck.isValid;
    if (isValidPassword && passwordCheck.shouldUpgradeHash) {
      const upgradedPassword = await bcrypt.hash(data.password, 10);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: upgradedPassword },
      });
    }

    if (!isValidPassword && isBootstrapAdminAttempt) {
      const repairedPassword = await bcrypt.hash(bootstrapAdminConfig.password, 10);
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: repairedPassword,
          role: UserRole.ADMINISTRATOR,
          status: UserStatus.ACTIVE,
        },
      });
      isValidPassword = true;
    }

    if (!isValidPassword) {
      // Re-run after potential bootstrap repair mutation.
      passwordCheck = await verifyPasswordCompat(data.password, user.password);
      isValidPassword = passwordCheck.isValid;
      if (isValidPassword && passwordCheck.shouldUpgradeHash) {
        const upgradedPassword = await bcrypt.hash(data.password, 10);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: upgradedPassword },
        });
      }
    }

    if (
      isBootstrapAdminAttempt &&
      (user.role !== UserRole.ADMINISTRATOR || user.status !== UserStatus.ACTIVE)
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          role: UserRole.ADMINISTRATOR,
          status: UserStatus.ACTIVE,
        },
      });
    }

    if (isBootstrapAdminAttempt) {
      try {
        const adminProfile = await prisma.adminProfile.findUnique({
          where: { userId: user.id },
          select: { id: true },
        });
        if (!adminProfile) {
          await prisma.adminProfile.create({
            data: { userId: user.id },
          });
        }
      } catch (error) {
        if (!isSchemaDriftError(error)) throw error;
      }
    }

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isVendor =
      user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER;

    const rejectionPolicy = await applyVendorRejectionPolicy({
      id: user.id,
      role: user.role,
      status: user.status as UserStatus,
    });
    if (rejectionPolicy.blockedMessage) {
      return res.status(403).json({
        success: false,
        message: rejectionPolicy.blockedMessage,
      });
    }
    if (rejectionPolicy.user.status !== user.status) {
      user = {
        ...user,
        status: rejectionPolicy.user.status,
      } as typeof user;
    }

    // Backfill legacy vendor accounts that were previously created as PENDING.
    if (user.status === UserStatus.PENDING && isVendor) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      });
    } else if (user.status === UserStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin verification.',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    if (user.status === UserStatus.REJECTED) {
      return res.status(403).json({
        success: false,
        message: 'Your registration was not approved. Please contact support for more information.',
      });
    }

    const previousLastLoginAt = user.lastLogin;
    const sessionIssuedAt = Date.now();

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date(sessionIssuedAt) },
    });

    if (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const rawIp = Array.isArray(forwardedFor) ? String(forwardedFor[0] || '') : String(forwardedFor || req.ip || '');
      const ipAddress = rawIp.split(',')[0].trim() || null;
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: previousLastLoginAt ? 'VENDOR_SESSION_REPLACED' : 'VENDOR_SESSION_STARTED',
          details: {
            role: user.role,
            sessionIssuedAt,
            previousSessionAt: previousLastLoginAt ? previousLastLoginAt.toISOString() : null,
            deviceType: String(req.headers['sec-ch-ua-platform'] || req.headers['user-agent'] || '').slice(0, 120),
          },
          ipAddress,
          userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        },
      });
    }

    // Generate token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionIssuedAt,
    });

    const effectivePermissions = await resolveEffectivePermissions(user.id, user.role);

    res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          permissions: effectivePermissions,
        },
        token,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role],
          permissions: effectivePermissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const payload = forgotPasswordSchema.parse(req.body || {});
    await ensurePasswordResetSchema();

    const user = await prisma.user.findFirst({
      where: {
        email: { equals: payload.email, mode: 'insensitive' },
      },
      select: { id: true, email: true, firstName: true },
    });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = hashResetToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.$executeRawUnsafe(
        `UPDATE "PasswordResetToken"
         SET "usedAt" = NOW()
         WHERE "userId" = $1 AND "usedAt" IS NULL`,
        user.id
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "PasswordResetToken" ("id","userId","tokenHash","expiresAt")
         VALUES ($1,$2,$3,$4)`,
        crypto.randomUUID(),
        user.id,
        tokenHash,
        expiresAt
      );

      const resetUrl = `${appPublicBaseUrl()}/reset-password?token=${encodeURIComponent(resetToken)}`;
      const firstName = String(user.firstName || '').trim() || 'there';
      void sendEmail({
        to: user.email,
        subject: 'Reset your African Fashion password',
        text: `Hello ${firstName},\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 60 minutes.\n\nIf you did not request this, you can ignore this email.`,
        html: `<p>Hello ${firstName},</p><p>Use the link below to reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>This link expires in <strong>60 minutes</strong>.</p><p>If you did not request this, you can ignore this email.</p>`,
      }).catch((error) => {
        console.error('Failed to send forgot-password email:', error);
      });
    }

    return res.json({
      success: true,
      message: 'If your email exists in our system, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const payload = resetPasswordSchema.parse(req.body || {});
    await ensurePasswordResetSchema();
    const tokenHash = hashResetToken(payload.token);
    const now = new Date();
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","userId","expiresAt","usedAt"
       FROM "PasswordResetToken"
       WHERE "tokenHash" = $1
       LIMIT 1`,
      tokenHash
    );
    const tokenRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!tokenRow) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired.',
      });
    }
    if (tokenRow.usedAt || (tokenRow.expiresAt && new Date(tokenRow.expiresAt).getTime() <= now.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Reset link is invalid or has expired.',
      });
    }
    const userId = String(tokenRow.userId || '');
    const hashedPassword = await bcrypt.hash(payload.newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword },
      }),
      prisma.$executeRawUnsafe(
        `UPDATE "PasswordResetToken"
         SET "usedAt" = NOW()
         WHERE "id" = $1`,
        String(tokenRow.id || '')
      ),
      prisma.$executeRawUnsafe(
        `UPDATE "PasswordResetToken"
         SET "usedAt" = NOW()
         WHERE "userId" = $1 AND "usedAt" IS NULL`,
        userId
      ),
    ]);

    return res.json({
      success: true,
      message: 'Password reset successful. You can now sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

const handleGoogleLogin = async (req: any, res: any, next: any) => {
  try {
    const googleClientIds = await resolveGoogleClientIds();
    if (googleClientIds.length === 0) {
      return res.status(503).json({
        success: false,
        message:
          'Google login is not configured on this server. Add Google Client ID in server env or Admin Homepage Sections > Authentication Page Design Settings.',
      });
    }

    const data = googleLoginSchema.parse(req.body);
    const ticket = await googleClient.verifyIdToken({
      idToken: data.idToken,
      audience: googleClientIds,
    });
    const payload = ticket.getPayload();

    if (!payload?.email || payload.email_verified === false) {
      return res.status(401).json({
        success: false,
        message: 'Unable to verify Google account email.',
      });
    }

    const email = String(payload.email).toLowerCase().trim();
    const googleSub = String(payload.sub || '').trim();
    let user = null as Awaited<ReturnType<typeof prisma.user.findFirst>>;

    if (googleSub) {
      const linked = await getGoogleAuthLinkBySub(googleSub);
      if (linked?.userId) {
        user = await prisma.user.findUnique({ where: { id: linked.userId } });
      }
    }

    if (!user) {
      user = await prisma.user.findFirst({
        where: {
          email: { equals: email, mode: 'insensitive' },
        },
      });
    }

    if (!user) {
      const names = parseNameFromGoogle(payload as unknown as Record<string, unknown>);
      const randomPassword = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          firstName: names.firstName,
          lastName: names.lastName,
          avatar: String(payload.picture || '').trim() || null,
          role: UserRole.CUSTOMER,
          status: UserStatus.ACTIVE,
          customerProfile: {
            create: {},
          },
        },
      });
    }

    if (googleSub) {
      const subLinkedToOther = await getGoogleAuthLinkBySub(googleSub);
      if (subLinkedToOther && subLinkedToOther.userId !== user.id) {
        return res.status(409).json({
          success: false,
          message: 'This Google account is already linked to another user.',
        });
      }
      await upsertGoogleAuthLink({ userId: user.id, googleSub, email });
    }

    const isVendor =
      user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER;

    const rejectionPolicy = await applyVendorRejectionPolicy({
      id: user.id,
      role: user.role,
      status: user.status as UserStatus,
    });
    if (rejectionPolicy.blockedMessage) {
      return res.status(403).json({
        success: false,
        message: rejectionPolicy.blockedMessage,
      });
    }
    if (rejectionPolicy.user.status !== user.status) {
      user = {
        ...user,
        status: rejectionPolicy.user.status,
      } as typeof user;
    }

    if (user.status === UserStatus.PENDING && isVendor) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.ACTIVE },
      });
    } else if (user.status === UserStatus.PENDING) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval. Please wait for admin verification.',
      });
    }

    if (user.status === UserStatus.SUSPENDED) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been suspended. Please contact support.',
      });
    }

    if (user.status === UserStatus.REJECTED) {
      return res.status(403).json({
        success: false,
        message: 'Your registration was not approved. Please contact support for more information.',
      });
    }

    const previousLastLoginAt = user.lastLogin;
    const sessionIssuedAt = Date.now();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLogin: new Date(sessionIssuedAt),
        avatar: user.avatar || String(payload.picture || '').trim() || null,
      },
    });

    if (user.role === UserRole.FABRIC_SELLER || user.role === UserRole.FASHION_DESIGNER) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const rawIp = Array.isArray(forwardedFor) ? String(forwardedFor[0] || '') : String(forwardedFor || req.ip || '');
      const ipAddress = rawIp.split(',')[0].trim() || null;
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          action: previousLastLoginAt ? 'VENDOR_SESSION_REPLACED' : 'VENDOR_SESSION_STARTED',
          details: {
            role: user.role,
            sessionIssuedAt,
            previousSessionAt: previousLastLoginAt ? previousLastLoginAt.toISOString() : null,
            deviceType: String(req.headers['sec-ch-ua-platform'] || req.headers['user-agent'] || '').slice(0, 120),
            authProvider: 'google',
          },
          ipAddress,
          userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        },
      });
    }

    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      sessionIssuedAt,
    });
    const effectivePermissions = await resolveEffectivePermissions(user.id, user.role);

    return res.json({
      success: true,
      message: 'Login successful!',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          status: user.status,
          permissions: effectivePermissions,
        },
        token,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role],
          permissions: effectivePermissions,
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Google Sign-In (ID token flow)
router.post('/google', handleGoogleLogin);
router.post('/google-login', handleGoogleLogin);
router.post('/login/google', handleGoogleLogin);

const handleGoogleLinkStatus = async (req: any, res: any, next: any) => {
  try {
    const link = await getGoogleAuthLinkByUserId(req.user!.id);
    return res.json({
      success: true,
      data: {
        linked: Boolean(link),
        email: link?.email || null,
        linkedAt: link?.createdAt || null,
      },
    });
  } catch (error) {
    return next(error);
  }
};

router.get('/google/link-status', authenticate, handleGoogleLinkStatus);
router.get('/google-link-status', authenticate, handleGoogleLinkStatus);

const handleGoogleLink = async (req: any, res: any, next: any) => {
  try {
    const googleClientIds = await resolveGoogleClientIds();
    if (googleClientIds.length === 0) {
      return res.status(503).json({
        success: false,
        message:
          'Google login is not configured on this server. Add Google Client ID in server env or Admin Homepage Sections > Authentication Page Design Settings.',
      });
    }
    const data = googleLoginSchema.parse(req.body);
    const ticket = await googleClient.verifyIdToken({
      idToken: data.idToken,
      audience: googleClientIds,
    });
    const payload = ticket.getPayload();
    if (!payload?.email || payload.email_verified === false || !payload.sub) {
      return res.status(401).json({
        success: false,
        message: 'Unable to verify Google account.',
      });
    }

    const googleEmail = String(payload.email).toLowerCase().trim();
    const googleSub = String(payload.sub).trim();
    const accountEmail = String(req.user!.email || '').toLowerCase().trim();
    if (googleEmail !== accountEmail) {
      return res.status(400).json({
        success: false,
        message: 'Google account email must match your current account email.',
      });
    }

    const linkedToOther = await getGoogleAuthLinkBySub(googleSub);
    if (linkedToOther && linkedToOther.userId !== req.user!.id) {
      return res.status(409).json({
        success: false,
        message: 'This Google account is already linked to another user.',
      });
    }

    await upsertGoogleAuthLink({
      userId: req.user!.id,
      googleSub,
      email: googleEmail,
    });

    return res.json({
      success: true,
      message: 'Google account linked successfully.',
      data: {
        linked: true,
        email: googleEmail,
      },
    });
  } catch (error) {
    return next(error);
  }
};

router.post('/google/link', authenticate, handleGoogleLink);
router.post('/google-link', authenticate, handleGoogleLink);

const handleGoogleUnlink = async (req: any, res: any, next: any) => {
  try {
    await ensureGoogleAuthSchema();
    await prisma.$executeRawUnsafe(
      `DELETE FROM "GoogleAuthLink" WHERE "userId" = $1`,
      req.user!.id
    );
    return res.json({
      success: true,
      message: 'Google account unlinked successfully.',
      data: { linked: false },
    });
  } catch (error) {
    return next(error);
  }
};

router.delete('/google/link', authenticate, handleGoogleUnlink);
router.delete('/google-link', authenticate, handleGoogleUnlink);

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: {
        customerProfile: {
          include: {
            addresses: true,
          },
        },
        fabricSellerProfile: true,
        designerProfile: true,
        qaProfile: true,
        adminProfile: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const effectivePermissions = await resolveEffectivePermissions(user.id, user.role);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        status: user.status,
        profile: user.customerProfile || user.fabricSellerProfile || user.designerProfile || user.qaProfile || user.adminProfile,
        access: {
          homeRoute: ROLE_HOME_ROUTE[user.role],
          permissions: effectivePermissions,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update profile
router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        firstName,
        lastName,
        phone,
        avatar,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatar: true,
        role: true,
      },
    });

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

// Change password
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Verify current password with legacy compatibility.
    const passwordCheck = await verifyPasswordCompat(currentPassword, user.password);
    const isValidPassword = passwordCheck.isValid;

    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.user!.id },
      data: { password: hashedPassword },
    });

    res.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side token removal, but we can track it if needed)
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    if (req.user?.role === UserRole.FABRIC_SELLER || req.user?.role === UserRole.FASHION_DESIGNER) {
      const forwardedFor = req.headers['x-forwarded-for'];
      const rawIp = Array.isArray(forwardedFor) ? String(forwardedFor[0] || '') : String(forwardedFor || req.ip || '');
      const ipAddress = rawIp.split(',')[0].trim() || null;
      await prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: 'VENDOR_SESSION_LOGOUT',
          details: {
            role: req.user.role,
            sessionEndedAt: Date.now(),
            deviceType: String(req.headers['sec-ch-ua-platform'] || req.headers['user-agent'] || '').slice(0, 120),
          },
          ipAddress,
          userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
        },
      });
    }

    res.json({
      success: true,
      message: 'Logout successful.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
