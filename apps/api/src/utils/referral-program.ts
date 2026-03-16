import { randomUUID } from 'crypto';
import { prisma, UserRole, UserStatus } from '../db';

export const REFERRAL_PROGRAM_SETTINGS_KEY = 'REFERRAL_PROGRAM_SETTINGS_V1';

export type ReferralProgramSettings = {
  enabled: boolean;
  registrationReferralEnabled: boolean;
  defaultReferralCode: string;
  codePrefix: string;
  codeDigits: number;
  sellerCommissionPercent: number;
  designerCommissionPercent: number;
  customerCommissionPercent: number;
  earnFromCustomerOrders: boolean;
  holdDays: number;
  minimumPayoutUsd: number;
  referralBaseUrl: string;
  profileEditableFields: string[];
};

export type ReferralVendorSaleEntry = {
  vendorUserId: string;
  vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
  baseAmountUsd: number;
};

export type ReferralCustomerSaleEntry = {
  customerUserId: string;
  baseAmountUsd: number;
};

const DEFAULT_REFERRAL_PROGRAM_SETTINGS: ReferralProgramSettings = {
  enabled: true,
  registrationReferralEnabled: true,
  defaultReferralCode: 'PLATFORM-DEFAULT',
  codePrefix: 'ZKR-',
  codeDigits: 6,
  sellerCommissionPercent: 5,
  designerCommissionPercent: 5,
  customerCommissionPercent: 0,
  earnFromCustomerOrders: false,
  holdDays: 7,
  minimumPayoutUsd: 10,
  referralBaseUrl: String(
    process.env.APP_BASE_URL ||
      process.env.FRONTEND_URL ||
      process.env.WEB_BASE_URL ||
      'https://african-fashion-zurikaribu.vercel.app'
  )
    .trim()
    .replace(/\/+$/, ''),
  profileEditableFields: ['firstName', 'lastName', 'phone', 'avatar', 'displayName'],
};

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
};

const toMoney = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const toPercent = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Number(Math.max(0, Math.min(100, parsed)).toFixed(4));
};

const toIntegerInRange = (value: unknown, min: number, max: number, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeCodePrefix = (value: unknown) => {
  const compact = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '');
  const withDash = compact.endsWith('-') ? compact : `${compact}-`;
  const cleaned = withDash.replace(/^-+/, '');
  if (!cleaned || cleaned === '-') return DEFAULT_REFERRAL_PROGRAM_SETTINGS.codePrefix;
  return cleaned.slice(0, 12);
};

const normalizeProfileEditableFields = (value: unknown) => {
  const allowed = new Set(['firstName', 'lastName', 'phone', 'avatar', 'displayName']);
  const input = Array.isArray(value) ? value : DEFAULT_REFERRAL_PROGRAM_SETTINGS.profileEditableFields;
  const normalized = Array.from(
    new Set(
      input
        .map((entry) => String(entry || '').trim())
        .filter((entry) => allowed.has(entry))
    )
  );
  return normalized.length > 0 ? normalized : [...DEFAULT_REFERRAL_PROGRAM_SETTINGS.profileEditableFields];
};
const normalizeReferralCodeToken = (value: unknown, fallback = DEFAULT_REFERRAL_PROGRAM_SETTINGS.defaultReferralCode) => {
  const token = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '-')
    .slice(0, 80);
  return token || fallback;
};

const normalizeRole = (value: unknown): UserRole | null => {
  const token = String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (token === 'CUSTOMER') return UserRole.CUSTOMER;
  if (token === 'FABRIC_SELLER' || token === 'SELLER') return UserRole.FABRIC_SELLER;
  if (token === 'FASHION_DESIGNER' || token === 'DESIGNER') return UserRole.FASHION_DESIGNER;
  if (token === 'RESELLER_INFLUENCER' || token === 'RESELLER' || token === 'INFLUENCER') {
    return UserRole.RESELLER_INFLUENCER;
  }
  if (token === 'QA_TEAM' || token === 'QA') return UserRole.QA_TEAM;
  if (token === 'ADMINISTRATOR' || token === 'ADMIN') return UserRole.ADMINISTRATOR;
  return null;
};

const executeBestEffort = async (sql: string) => {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // Keep compatibility with restricted production users.
  }
};

let referralSchemaEnsured = false;
export const ensureReferralProgramSchema = async () => {
  if (referralSchemaEnsured) return;
  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
  try {
    await prisma.$executeRawUnsafe(
      `DO $$
       BEGIN
         IF NOT EXISTS (
           SELECT 1
           FROM pg_enum e
           JOIN pg_type t ON t.oid = e.enumtypid
           WHERE t.typname = 'UserRole'
             AND e.enumlabel = 'RESELLER_INFLUENCER'
         ) THEN
           ALTER TYPE "UserRole" ADD VALUE 'RESELLER_INFLUENCER';
         END IF;
       END
       $$;`
    );
  } catch {
    throw new Error(
      'Referral system setup failed: database role enum does not include RESELLER_INFLUENCER and could not be auto-updated.'
    );
  }
  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "ResellerInfluencerProfile" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "numericRefId" BIGINT NOT NULL,
      "referralCode" TEXT NOT NULL,
      "displayName" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "commissionOverridePercent" DECIMAL(6,4),
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ResellerInfluencerProfile_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(`ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "userId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "numericRefId" BIGINT`);
  await executeBestEffort(`ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "referralCode" TEXT`);
  await executeBestEffort(`ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "displayName" TEXT`);
  await executeBestEffort(
    `ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE`
  );
  await executeBestEffort(
    `ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "commissionOverridePercent" DECIMAL(6,4)`
  );
  await executeBestEffort(`ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "createdById" TEXT`);
  await executeBestEffort(
    `ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "ResellerInfluencerProfile" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `UPDATE "ResellerInfluencerProfile"
     SET "numericRefId" = ABS(('x' || SUBSTRING(MD5("id"), 1, 15))::bit(60)::bigint)
     WHERE "numericRefId" IS NULL`
  );
  await executeBestEffort(
    `UPDATE "ResellerInfluencerProfile"
     SET "referralCode" = CONCAT('ZKR-', LPAD(COALESCE("numericRefId", 0)::text, 6, '0'))
     WHERE COALESCE(TRIM("referralCode"), '') = ''`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ResellerInfluencerProfile_userId_key" ON "ResellerInfluencerProfile"("userId")`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ResellerInfluencerProfile_numericRefId_key" ON "ResellerInfluencerProfile"("numericRefId")`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ResellerInfluencerProfile_referralCode_key" ON "ResellerInfluencerProfile"("referralCode")`
  );

  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
      "id" TEXT NOT NULL,
      "resellerUserId" TEXT NOT NULL,
      "referredUserId" TEXT NOT NULL,
      "referredRole" TEXT NOT NULL,
      "source" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(`ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "resellerUserId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "referredUserId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "referredRole" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "source" TEXT`);
  await executeBestEffort(
    `ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralAttribution" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_referredUserId_key" ON "ReferralAttribution"("referredUserId")`
  );
  await executeBestEffort(
    `CREATE INDEX IF NOT EXISTS "ReferralAttribution_resellerUserId_idx" ON "ReferralAttribution"("resellerUserId")`
  );

  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "ReferralCommissionLedger" (
      "id" TEXT NOT NULL,
      "resellerUserId" TEXT NOT NULL,
      "orderId" TEXT NOT NULL,
      "orderNumber" TEXT,
      "vendorUserId" TEXT NOT NULL,
      "vendorRole" TEXT NOT NULL,
      "baseAmountUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "commissionPercent" DECIMAL(6,4) NOT NULL DEFAULT 0,
      "commissionAmountUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "availableAt" TIMESTAMP(3),
      "paidAt" TIMESTAMP(3),
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReferralCommissionLedger_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "resellerUserId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "orderId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "orderNumber" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "vendorUserId" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "vendorRole" TEXT`);
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "baseAmountUsd" DECIMAL(12,2) NOT NULL DEFAULT 0`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "commissionPercent" DECIMAL(6,4) NOT NULL DEFAULT 0`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "commissionAmountUsd" DECIMAL(12,2) NOT NULL DEFAULT 0`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING'`
  );
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "availableAt" TIMESTAMP(3)`);
  await executeBestEffort(`ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`);
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralCommissionLedger" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommissionLedger_unique_row" ON "ReferralCommissionLedger"("resellerUserId","orderId","vendorUserId")`
  );
  await executeBestEffort(
    `CREATE INDEX IF NOT EXISTS "ReferralCommissionLedger_resellerUserId_idx" ON "ReferralCommissionLedger"("resellerUserId")`
  );
  await executeBestEffort(
    `CREATE INDEX IF NOT EXISTS "ReferralCommissionLedger_status_idx" ON "ReferralCommissionLedger"("status")`
  );
  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "ReferralMaterial" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "imageUrl" TEXT,
      "targetUrl" TEXT,
      "widthPx" INTEGER,
      "heightPx" INTEGER,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
      "createdById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ReferralMaterial_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "title" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "description" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "targetUrl" TEXT`);
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "widthPx" INTEGER`);
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "heightPx" INTEGER`);
  await executeBestEffort(
    `ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT TRUE`
  );
  await executeBestEffort(`ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "createdById" TEXT`);
  await executeBestEffort(
    `ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(
    `ALTER TABLE "ReferralMaterial" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`
  );
  await executeBestEffort(`CREATE INDEX IF NOT EXISTS "ReferralMaterial_sortOrder_idx" ON "ReferralMaterial"("sortOrder")`);
  referralSchemaEnsured = true;
};

export const normalizeReferralProgramSettings = (value: unknown): ReferralProgramSettings => {
  const source = parseObject(value);
  const baseUrl = String(source.referralBaseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl)
    .trim()
    .replace(/\/+$/, '');
  const codePrefix = normalizeCodePrefix(source.codePrefix || DEFAULT_REFERRAL_PROGRAM_SETTINGS.codePrefix);
  const codeDigits = toIntegerInRange(source.codeDigits, 4, 12, DEFAULT_REFERRAL_PROGRAM_SETTINGS.codeDigits);
  return {
    enabled: source.enabled !== false,
    registrationReferralEnabled: source.registrationReferralEnabled !== false,
    defaultReferralCode: normalizeReferralCodeToken(
      source.defaultReferralCode,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.defaultReferralCode
    ),
    codePrefix,
    codeDigits,
    sellerCommissionPercent: toPercent(
      source.sellerCommissionPercent,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.sellerCommissionPercent
    ),
    designerCommissionPercent: toPercent(
      source.designerCommissionPercent,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.designerCommissionPercent
    ),
    customerCommissionPercent: toPercent(
      source.customerCommissionPercent,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.customerCommissionPercent
    ),
    earnFromCustomerOrders: source.earnFromCustomerOrders === true,
    holdDays: Math.max(0, Math.min(365, Number(source.holdDays || DEFAULT_REFERRAL_PROGRAM_SETTINGS.holdDays))),
    minimumPayoutUsd: toMoney(source.minimumPayoutUsd ?? DEFAULT_REFERRAL_PROGRAM_SETTINGS.minimumPayoutUsd),
    referralBaseUrl: baseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl,
    profileEditableFields: normalizeProfileEditableFields(source.profileEditableFields),
  };
};

export const readReferralProgramSettings = async () => {
  await ensureReferralProgramSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: unknown; updatedAt: Date | string }>>(
    `SELECT "id","value","updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    REFERRAL_PROGRAM_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...DEFAULT_REFERRAL_PROGRAM_SETTINGS },
      updatedAt: null as string | null,
      source: 'DEFAULT' as const,
    };
  }
  return {
    rowId: String(row.id),
    settings: normalizeReferralProgramSettings(parseObject(row.value)),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    source: 'DATABASE' as const,
  };
};

export const saveReferralProgramSettings = async (value: unknown) => {
  await ensureReferralProgramSchema();
  const existing = await readReferralProgramSettings();
  const next = normalizeReferralProgramSettings({
    ...existing.settings,
    ...parseObject(value),
  });
  const payload = JSON.stringify(next);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1::jsonb, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id","key","value","createdAt","updatedAt")
       VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
      randomUUID(),
      REFERRAL_PROGRAM_SETTINGS_KEY,
      payload
    );
  }
  // Keep referral codes synchronized with current prefix/digit format.
  const nextPrefix = normalizeCodePrefix(next.codePrefix);
  const nextDigits = toIntegerInRange(next.codeDigits, 4, 12, DEFAULT_REFERRAL_PROGRAM_SETTINGS.codeDigits);
  await prisma.$executeRawUnsafe(
    `UPDATE "ResellerInfluencerProfile"
     SET "referralCode" = CONCAT($1, LPAD(COALESCE("numericRefId", 0)::text, $2, '0')),
         "updatedAt" = NOW()`,
    nextPrefix,
    nextDigits
  );
  return (await readReferralProgramSettings()).settings;
};

const normalizeReferralCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const buildReferralCode = (numericRefId: number, settings?: ReferralProgramSettings) => {
  const config = settings || DEFAULT_REFERRAL_PROGRAM_SETTINGS;
  const prefix = normalizeCodePrefix(config.codePrefix || DEFAULT_REFERRAL_PROGRAM_SETTINGS.codePrefix);
  const digits = toIntegerInRange(config.codeDigits, 4, 12, DEFAULT_REFERRAL_PROGRAM_SETTINGS.codeDigits);
  return `${prefix}${String(Math.max(1, Math.trunc(Number(numericRefId) || 1))).padStart(digits, '0')}`;
};

export const buildReferralLink = (referralCode: string, settings?: ReferralProgramSettings) => {
  const config = settings || DEFAULT_REFERRAL_PROGRAM_SETTINGS;
  return `${String(config.referralBaseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl).replace(/\/+$/, '')}/${encodeURIComponent(
    referralCode
  )}`;
};

export const ensureResellerProfileForUser = async (input: {
  userId: string;
  createdById?: string | null;
  displayName?: string | null;
}) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "ResellerInfluencerProfile"
     WHERE "userId" = $1
     LIMIT 1`,
    input.userId
  );
  const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
  if (existing) {
    const numericRefId = Number(existing.numericRefId || 0);
    const currentCode = String(existing.referralCode || '').trim().toUpperCase();
    const preferredCode = buildReferralCode(numericRefId, settings);
    const shouldRefreshCode = !currentCode || currentCode.startsWith('RI-');
    if (shouldRefreshCode && numericRefId > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "ResellerInfluencerProfile"
         SET "referralCode" = $1, "updatedAt" = NOW()
         WHERE "id" = $2`,
        preferredCode,
        String(existing.id || '')
      );
    }
    return {
      id: String(existing.id || ''),
      userId: String(existing.userId || ''),
      numericRefId,
      referralCode: shouldRefreshCode ? preferredCode : currentCode,
      displayName: String(existing.displayName || '').trim(),
      isActive: existing.isActive !== false,
      commissionOverridePercent:
        existing.commissionOverridePercent == null ? null : Number(existing.commissionOverridePercent),
      referralLink: buildReferralLink(shouldRefreshCode ? preferredCode : currentCode, settings),
    };
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ maxId: number | null }>>(
    `SELECT MAX("numericRefId")::bigint AS "maxId" FROM "ResellerInfluencerProfile"`
  );
  const nextNumeric = Math.max(1, Number(rows?.[0]?.maxId || 0) + 1);
  const referralCode = buildReferralCode(nextNumeric, settings);
  const createdRows = await prisma.$queryRawUnsafe<Array<any>>(
    `INSERT INTO "ResellerInfluencerProfile"
      ("id","userId","numericRefId","referralCode","displayName","isActive","createdById","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,TRUE,$6,NOW(),NOW())
     RETURNING *`,
    randomUUID(),
    input.userId,
    nextNumeric,
    referralCode,
    String(input.displayName || '').trim() || null,
    input.createdById || null
  );
  const created = createdRows[0];
  return {
    id: String(created.id || ''),
    userId: String(created.userId || ''),
    numericRefId: Number(created.numericRefId || nextNumeric),
    referralCode: String(created.referralCode || referralCode),
    displayName: String(created.displayName || '').trim(),
    isActive: created.isActive !== false,
    commissionOverridePercent:
      created.commissionOverridePercent == null ? null : Number(created.commissionOverridePercent),
    referralLink: buildReferralLink(String(created.referralCode || referralCode), settings),
  };
};

export const readResellerByReferralCode = async (referralCodeInput: unknown) => {
  await ensureReferralProgramSchema();
  const referralCode = normalizeReferralCode(referralCodeInput);
  if (!referralCode) return null;
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT p.*, u."status" AS "userStatus", u."role" AS "userRole"
     FROM "ResellerInfluencerProfile" p
     JOIN "User" u ON u."id" = p."userId"
     WHERE UPPER(p."referralCode") = $1
     LIMIT 1`,
    referralCode
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) return null;
  if (row.isActive === false) return null;
  if (normalizeRole(row.userRole) !== UserRole.RESELLER_INFLUENCER) return null;
  if (String(row.userStatus || '').toUpperCase() !== String(UserStatus.ACTIVE)) return null;
  return {
    id: String(row.id || ''),
    userId: String(row.userId || ''),
    numericRefId: Number(row.numericRefId || 0),
    referralCode: String(row.referralCode || ''),
    displayName: String(row.displayName || '').trim(),
    commissionOverridePercent: row.commissionOverridePercent == null ? null : Number(row.commissionOverridePercent),
  };
};

export const attributeReferredUser = async (input: {
  referralCode?: string | null;
  referredUserId: string;
  referredRole: UserRole | string;
  source?: string | null;
  metadata?: Record<string, unknown>;
}) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  if (!settings.enabled || !settings.registrationReferralEnabled) return { attributed: false as const };
  const referralCode = normalizeReferralCode(input.referralCode || '');
  if (!referralCode || referralCode === normalizeReferralCode(settings.defaultReferralCode)) {
    return { attributed: false as const };
  }
  const referredRole = normalizeRole(input.referredRole);
  if (!referredRole) return { attributed: false as const };
  if (
    referredRole !== UserRole.CUSTOMER &&
    referredRole !== UserRole.FABRIC_SELLER &&
    referredRole !== UserRole.FASHION_DESIGNER
  ) {
    return { attributed: false as const };
  }
  const profile = await readResellerByReferralCode(referralCode);
  if (!profile) return { attributed: false as const };
  if (String(profile.userId) === String(input.referredUserId)) return { attributed: false as const };
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ReferralAttribution"
      ("id","resellerUserId","referredUserId","referredRole","source","metadata","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6::jsonb,NOW(),NOW())
     ON CONFLICT ("referredUserId")
     DO NOTHING`,
    randomUUID(),
    profile.userId,
    input.referredUserId,
    referredRole,
    input.source || null,
    JSON.stringify({
      referralCode: profile.referralCode,
      ...(input.metadata || {}),
    })
  );
  return {
    attributed: true as const,
    resellerUserId: profile.userId,
    referralCode: profile.referralCode,
  };
};

export const recordReferralCommissionsForOrder = async (input: {
  orderId: string;
  orderNumber?: string | null;
  vendorSales: ReferralVendorSaleEntry[];
  customerSale?: ReferralCustomerSaleEntry | null;
  metadata?: Record<string, unknown>;
}) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  if (!settings.enabled) return { created: 0 };
  const aggregatedByVendor = new Map<
    string,
    { vendorUserId: string; vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'CUSTOMER'; baseAmountUsd: number }
  >();
  (Array.isArray(input.vendorSales) ? input.vendorSales : [])
    .filter((entry) => entry && entry.vendorUserId && Number(entry.baseAmountUsd || 0) > 0)
    .forEach((entry) => {
      const key = String(entry.vendorUserId);
      const existing = aggregatedByVendor.get(key);
      if (!existing) {
        aggregatedByVendor.set(key, {
          vendorUserId: String(entry.vendorUserId),
          vendorRole: entry.vendorRole,
          baseAmountUsd: toMoney(entry.baseAmountUsd),
        });
        return;
      }
      existing.baseAmountUsd = toMoney(existing.baseAmountUsd + Number(entry.baseAmountUsd || 0));
      if (entry.vendorRole === 'FASHION_DESIGNER') {
        existing.vendorRole = 'FASHION_DESIGNER';
      }
    });
  if (settings.earnFromCustomerOrders && settings.customerCommissionPercent > 0 && input.customerSale?.customerUserId) {
    const customerAmount = toMoney(input.customerSale.baseAmountUsd);
    if (customerAmount > 0) {
      aggregatedByVendor.set(String(input.customerSale.customerUserId), {
        vendorUserId: String(input.customerSale.customerUserId),
        vendorRole: 'CUSTOMER',
        baseAmountUsd: customerAmount,
      });
    }
  }
  let created = 0;
  for (const sale of aggregatedByVendor.values()) {
    const attributionRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "resellerUserId","referredRole"
       FROM "ReferralAttribution"
       WHERE "referredUserId" = $1
       LIMIT 1`,
      sale.vendorUserId
    );
    const attribution = Array.isArray(attributionRows) && attributionRows.length > 0 ? attributionRows[0] : null;
    if (!attribution?.resellerUserId) continue;
    const roleToken = normalizeRole(attribution.referredRole);
    const basePercent =
      roleToken === UserRole.FASHION_DESIGNER
        ? settings.designerCommissionPercent
        : roleToken === UserRole.FABRIC_SELLER
          ? settings.sellerCommissionPercent
          : roleToken === UserRole.CUSTOMER
            ? settings.customerCommissionPercent
          : 0;
    if (basePercent <= 0) continue;
    const profileRows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "commissionOverridePercent","isActive"
       FROM "ResellerInfluencerProfile"
       WHERE "userId" = $1
       LIMIT 1`,
      String(attribution.resellerUserId)
    );
    const profile = profileRows[0] || null;
    if (!profile || profile.isActive === false) continue;
    const commissionPercent = toPercent(
      profile.commissionOverridePercent != null ? profile.commissionOverridePercent : basePercent,
      basePercent
    );
    if (commissionPercent <= 0) continue;
    const baseAmountUsd = toMoney(sale.baseAmountUsd);
    const commissionAmountUsd = toMoney((baseAmountUsd * commissionPercent) / 100);
    const availableAt =
      settings.holdDays > 0
        ? new Date(Date.now() + settings.holdDays * 24 * 60 * 60 * 1000).toISOString()
        : new Date().toISOString();
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ReferralCommissionLedger"
        ("id","resellerUserId","orderId","orderNumber","vendorUserId","vendorRole","baseAmountUsd","commissionPercent","commissionAmountUsd","status","availableAt","metadata","createdAt","updatedAt")
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING',$10,$11::jsonb,NOW(),NOW())
       ON CONFLICT ("resellerUserId","orderId","vendorUserId")
       DO UPDATE SET
        "baseAmountUsd" = "ReferralCommissionLedger"."baseAmountUsd" + EXCLUDED."baseAmountUsd",
        "commissionAmountUsd" = "ReferralCommissionLedger"."commissionAmountUsd" + EXCLUDED."commissionAmountUsd",
        "commissionPercent" = EXCLUDED."commissionPercent",
        "orderNumber" = COALESCE(EXCLUDED."orderNumber", "ReferralCommissionLedger"."orderNumber"),
        "vendorRole" = EXCLUDED."vendorRole",
        "availableAt" = EXCLUDED."availableAt",
        "metadata" = COALESCE("ReferralCommissionLedger"."metadata",'{}'::jsonb) || EXCLUDED."metadata",
        "updatedAt" = NOW()`,
      randomUUID(),
      String(attribution.resellerUserId),
      String(input.orderId),
      input.orderNumber ? String(input.orderNumber) : null,
      sale.vendorUserId,
      sale.vendorRole,
      baseAmountUsd,
      commissionPercent,
      commissionAmountUsd,
      availableAt,
      JSON.stringify(input.metadata || {})
    );
    created += 1;
  }
  return { created };
};

export const readResellerDashboard = async (resellerUserId: string, params?: { page?: number; limit?: number }) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  const profileRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT p.*, u."email", u."firstName", u."lastName", u."phone", u."avatar", u."status" as "userStatus"
     FROM "ResellerInfluencerProfile" p
     JOIN "User" u ON u."id" = p."userId"
     WHERE p."userId" = $1
     LIMIT 1`,
    resellerUserId
  );
  const profile = profileRows[0] || null;
  if (!profile) return null;
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(params?.limit || 20)));
  const offset = (page - 1) * limit;
  const [referralRows, referralCountRows, totalsRows, commissionRows, commissionCountRows] = await Promise.all([
    prisma.$queryRawUnsafe<Array<any>>(
      `SELECT a."id", a."referredUserId", a."referredRole", a."source", a."createdAt",
              u."email", u."firstName", u."lastName", u."status"
       FROM "ReferralAttribution" a
       LEFT JOIN "User" u ON u."id" = a."referredUserId"
       WHERE a."resellerUserId" = $1
       ORDER BY a."createdAt" DESC
       OFFSET $2 LIMIT $3`,
      resellerUserId,
      offset,
      limit
    ),
    prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM "ReferralAttribution" WHERE "resellerUserId" = $1`,
      resellerUserId
    ),
    prisma.$queryRawUnsafe<Array<any>>(
      `SELECT
          COALESCE(SUM("commissionAmountUsd"),0)::numeric AS "totalCommissionUsd",
          COALESCE(SUM(CASE WHEN "status" = 'PAID' THEN "commissionAmountUsd" ELSE 0 END),0)::numeric AS "paidCommissionUsd",
          COALESCE(SUM(CASE WHEN "status" IN ('PENDING','APPROVED') THEN "commissionAmountUsd" ELSE 0 END),0)::numeric AS "pendingCommissionUsd",
          COALESCE(SUM(CASE WHEN "status" = 'PENDING' AND ("availableAt" IS NULL OR "availableAt" <= NOW()) THEN "commissionAmountUsd" ELSE 0 END),0)::numeric AS "availableCommissionUsd"
       FROM "ReferralCommissionLedger"
       WHERE "resellerUserId" = $1`,
      resellerUserId
    ),
    prisma.$queryRawUnsafe<Array<any>>(
      `SELECT *
       FROM "ReferralCommissionLedger"
       WHERE "resellerUserId" = $1
       ORDER BY "createdAt" DESC
       OFFSET $2 LIMIT $3`,
      resellerUserId,
      offset,
      limit
    ),
    prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(*)::int AS total FROM "ReferralCommissionLedger" WHERE "resellerUserId" = $1`,
      resellerUserId
    ),
  ]);
  const referralTotalsByRole = referralRows.reduce(
    (acc, row) => {
      const role = normalizeRole(row.referredRole);
      if (role === UserRole.FABRIC_SELLER) acc.sellers += 1;
      else if (role === UserRole.FASHION_DESIGNER) acc.designers += 1;
      else if (role === UserRole.CUSTOMER) acc.customers += 1;
      return acc;
    },
    { sellers: 0, designers: 0, customers: 0 }
  );
  return {
    settings,
    profile: {
      id: String(profile.id || ''),
      userId: String(profile.userId || ''),
      email: String(profile.email || ''),
      firstName: String(profile.firstName || ''),
      lastName: String(profile.lastName || ''),
      phone: profile.phone == null ? null : String(profile.phone),
      avatar: profile.avatar == null ? null : String(profile.avatar),
      userStatus: String(profile.userStatus || ''),
      numericRefId: Number(profile.numericRefId || 0),
      referralCode: String(profile.referralCode || ''),
      displayName: String(profile.displayName || '').trim(),
      isActive: profile.isActive !== false,
      commissionOverridePercent:
        profile.commissionOverridePercent == null ? null : Number(profile.commissionOverridePercent),
      referralLink: buildReferralLink(String(profile.referralCode || ''), settings),
    },
    totals: {
      totalReferrals: Number(referralCountRows?.[0]?.total || 0),
      ...referralTotalsByRole,
      totalCommissionUsd: toMoney(totalsRows?.[0]?.totalCommissionUsd || 0),
      paidCommissionUsd: toMoney(totalsRows?.[0]?.paidCommissionUsd || 0),
      pendingCommissionUsd: toMoney(totalsRows?.[0]?.pendingCommissionUsd || 0),
      availableCommissionUsd: toMoney(totalsRows?.[0]?.availableCommissionUsd || 0),
    },
    referrals: (Array.isArray(referralRows) ? referralRows : []).map((row) => ({
      id: String(row.id || ''),
      referredUserId: String(row.referredUserId || ''),
      referredRole: normalizeRole(row.referredRole) || UserRole.CUSTOMER,
      source: row.source ? String(row.source) : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      user: {
        email: String(row.email || ''),
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        status: String(row.status || ''),
      },
    })),
    commissions: (Array.isArray(commissionRows) ? commissionRows : []).map((row) => ({
      id: String(row.id || ''),
      orderId: String(row.orderId || ''),
      orderNumber: row.orderNumber ? String(row.orderNumber) : null,
      vendorUserId: String(row.vendorUserId || ''),
      vendorRole: normalizeRole(row.vendorRole) || UserRole.FABRIC_SELLER,
      baseAmountUsd: toMoney(row.baseAmountUsd || 0),
      commissionPercent: Number(row.commissionPercent || 0),
      commissionAmountUsd: toMoney(row.commissionAmountUsd || 0),
      status: String(row.status || 'PENDING').toUpperCase(),
      availableAt: row.availableAt ? new Date(row.availableAt).toISOString() : null,
      paidAt: row.paidAt ? new Date(row.paidAt).toISOString() : null,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      metadata: parseObject(row.metadata),
    })),
    pagination: {
      page,
      limit,
      referralsTotal: Number(referralCountRows?.[0]?.total || 0),
      commissionsTotal: Number(commissionCountRows?.[0]?.total || 0),
    },
  };
};

export const listResellerInfluencersWithMetrics = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  await ensureReferralProgramSchema();
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.min(100, Math.max(1, Number(params?.limit || 20)));
  const offset = (page - 1) * limit;
  const search = String(params?.search || '').trim();
  const whereSql = search
    ? `WHERE (
         LOWER(u."email") LIKE LOWER($1)
         OR LOWER(COALESCE(u."firstName",'') || ' ' || COALESCE(u."lastName",'')) LIKE LOWER($1)
         OR LOWER(COALESCE(r."displayName",'')) LIKE LOWER($1)
         OR LOWER(COALESCE(r."referralCode",'')) LIKE LOWER($1)
       )`
    : '';
  const values: unknown[] = [];
  if (search) values.push(`%${search}%`);
  values.push(offset, limit);
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT
        r.*,
        u."email", u."firstName", u."lastName", u."phone", u."avatar", u."status" AS "userStatus",
        COALESCE(ref.total_referrals,0)::int AS "totalReferrals",
        COALESCE(comm.total_commission,0)::numeric AS "totalCommissionUsd",
        COALESCE(comm.pending_commission,0)::numeric AS "pendingCommissionUsd",
        COALESCE(comm.paid_commission,0)::numeric AS "paidCommissionUsd"
     FROM "ResellerInfluencerProfile" r
     JOIN "User" u ON u."id" = r."userId"
     LEFT JOIN (
       SELECT "resellerUserId", COUNT(*)::int AS total_referrals
       FROM "ReferralAttribution"
       GROUP BY "resellerUserId"
     ) ref ON ref."resellerUserId" = r."userId"
     LEFT JOIN (
       SELECT
         "resellerUserId",
         SUM("commissionAmountUsd")::numeric AS total_commission,
         SUM(CASE WHEN "status" IN ('PENDING','APPROVED') THEN "commissionAmountUsd" ELSE 0 END)::numeric AS pending_commission,
         SUM(CASE WHEN "status" = 'PAID' THEN "commissionAmountUsd" ELSE 0 END)::numeric AS paid_commission
       FROM "ReferralCommissionLedger"
       GROUP BY "resellerUserId"
     ) comm ON comm."resellerUserId" = r."userId"
     ${whereSql}
     ORDER BY r."createdAt" DESC
     OFFSET $${search ? 2 : 1}
     LIMIT $${search ? 3 : 2}`,
    ...values
  );
  const countRows = await prisma.$queryRawUnsafe<Array<{ total: number }>>(
    `SELECT COUNT(*)::int AS total
     FROM "ResellerInfluencerProfile" r
     JOIN "User" u ON u."id" = r."userId"
     ${whereSql}`,
    ...(search ? [`%${search}%`] : [])
  );
  const settings = (await readReferralProgramSettings()).settings;
  return {
    rows: (Array.isArray(rows) ? rows : []).map((row) => ({
      id: String(row.id || ''),
      userId: String(row.userId || ''),
      numericRefId: Number(row.numericRefId || 0),
      referralCode: String(row.referralCode || ''),
      referralLink: buildReferralLink(String(row.referralCode || ''), settings),
      displayName: String(row.displayName || '').trim(),
      isActive: row.isActive !== false,
      commissionOverridePercent:
        row.commissionOverridePercent == null ? null : Number(row.commissionOverridePercent),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      user: {
        email: String(row.email || ''),
        firstName: String(row.firstName || ''),
        lastName: String(row.lastName || ''),
        phone: row.phone == null ? null : String(row.phone),
        avatar: row.avatar == null ? null : String(row.avatar),
        status: String(row.userStatus || ''),
      },
      metrics: {
        totalReferrals: Number(row.totalReferrals || 0),
        totalCommissionUsd: toMoney(row.totalCommissionUsd || 0),
        pendingCommissionUsd: toMoney(row.pendingCommissionUsd || 0),
        paidCommissionUsd: toMoney(row.paidCommissionUsd || 0),
      },
    })),
    pagination: {
      page,
      limit,
      total: Number(countRows?.[0]?.total || 0),
      pages: Math.max(1, Math.ceil(Number(countRows?.[0]?.total || 0) / limit)),
    },
  };
};

export type ReferralMaterialInput = {
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  targetUrl?: string | null;
  widthPx?: number | null;
  heightPx?: number | null;
  sortOrder?: number | null;
  isActive?: boolean;
};

type ReferralMaterialUpdateInput = Partial<ReferralMaterialInput>;

export const listReferralMaterials = async (options?: { includeInactive?: boolean }) => {
  await ensureReferralProgramSchema();
  const includeInactive = options?.includeInactive === true;
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "ReferralMaterial"
     ${includeInactive ? '' : 'WHERE "isActive" = TRUE'}
     ORDER BY "sortOrder" ASC, "createdAt" DESC`
  );
  return (Array.isArray(rows) ? rows : []).map((row) => ({
    id: String(row.id || ''),
    title: String(row.title || ''),
    description: row.description == null ? null : String(row.description),
    imageUrl: row.imageUrl == null ? null : String(row.imageUrl),
    targetUrl: row.targetUrl == null ? null : String(row.targetUrl),
    widthPx: row.widthPx == null ? null : Number(row.widthPx),
    heightPx: row.heightPx == null ? null : Number(row.heightPx),
    sortOrder: Number(row.sortOrder || 0),
    isActive: row.isActive !== false,
    createdById: row.createdById == null ? null : String(row.createdById),
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
};

export const createReferralMaterial = async (input: ReferralMaterialInput & { createdById?: string | null }) => {
  await ensureReferralProgramSchema();
  const createdRows = await prisma.$queryRawUnsafe<Array<any>>(
    `INSERT INTO "ReferralMaterial"
      ("id","title","description","imageUrl","targetUrl","widthPx","heightPx","sortOrder","isActive","createdById","createdAt","updatedAt")
     VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW(),NOW())
     RETURNING *`,
    randomUUID(),
    String(input.title || '').trim(),
    input.description ? String(input.description).trim() : null,
    input.imageUrl ? String(input.imageUrl).trim() : null,
    input.targetUrl ? String(input.targetUrl).trim() : null,
    input.widthPx == null ? null : Number(input.widthPx),
    input.heightPx == null ? null : Number(input.heightPx),
    input.sortOrder == null ? 0 : Number(input.sortOrder),
    input.isActive !== false,
    input.createdById || null
  );
  return createdRows?.[0] || null;
};

export const updateReferralMaterial = async (id: string, input: ReferralMaterialUpdateInput) => {
  await ensureReferralProgramSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `UPDATE "ReferralMaterial"
     SET "title" = COALESCE($2, "title"),
         "description" = COALESCE($3, "description"),
         "imageUrl" = COALESCE($4, "imageUrl"),
         "targetUrl" = COALESCE($5, "targetUrl"),
         "widthPx" = COALESCE($6, "widthPx"),
         "heightPx" = COALESCE($7, "heightPx"),
         "sortOrder" = COALESCE($8, "sortOrder"),
         "isActive" = COALESCE($9, "isActive"),
         "updatedAt" = NOW()
     WHERE "id" = $1
     RETURNING *`,
    id,
    input.title == null ? null : String(input.title).trim(),
    input.description == null ? null : String(input.description).trim(),
    input.imageUrl == null ? null : String(input.imageUrl).trim(),
    input.targetUrl == null ? null : String(input.targetUrl).trim(),
    input.widthPx == null ? null : Number(input.widthPx),
    input.heightPx == null ? null : Number(input.heightPx),
    input.sortOrder == null ? null : Number(input.sortOrder),
    input.isActive == null ? null : Boolean(input.isActive)
  );
  return rows?.[0] || null;
};

export const deleteReferralMaterial = async (id: string) => {
  await ensureReferralProgramSchema();
  await prisma.$executeRawUnsafe(`DELETE FROM "ReferralMaterial" WHERE "id" = $1`, id);
};

export const updateResellerProfileFromSelfService = async (
  userId: string,
  payload: { firstName?: string; lastName?: string; phone?: string | null; avatar?: string | null; displayName?: string }
) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  const allowed = new Set(settings.profileEditableFields);
  const userUpdates: Record<string, unknown> = {};
  if (payload.firstName != null && allowed.has('firstName')) userUpdates.firstName = String(payload.firstName).trim();
  if (payload.lastName != null && allowed.has('lastName')) userUpdates.lastName = String(payload.lastName).trim();
  if (payload.phone !== undefined && allowed.has('phone')) userUpdates.phone = payload.phone == null ? null : String(payload.phone).trim();
  if (payload.avatar !== undefined && allowed.has('avatar')) userUpdates.avatar = payload.avatar == null ? null : String(payload.avatar).trim();
  if (Object.keys(userUpdates).length > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: userUpdates,
    });
  }
  if (payload.displayName != null && allowed.has('displayName')) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ResellerInfluencerProfile"
       SET "displayName" = $1, "updatedAt" = NOW()
       WHERE "userId" = $2`,
      String(payload.displayName).trim() || null,
      userId
    );
  }
};
