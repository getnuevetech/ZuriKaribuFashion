import { randomUUID } from 'crypto';
import { prisma, UserRole, UserStatus } from '../db';

export const REFERRAL_PROGRAM_SETTINGS_KEY = 'REFERRAL_PROGRAM_SETTINGS_V1';

export type ReferralProgramSettings = {
  enabled: boolean;
  registrationReferralEnabled: boolean;
  defaultReferralCode: string;
  sellerCommissionPercent: number;
  designerCommissionPercent: number;
  holdDays: number;
  minimumPayoutUsd: number;
  referralBaseUrl: string;
};

export type ReferralVendorSaleEntry = {
  vendorUserId: string;
  vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
  baseAmountUsd: number;
};

const DEFAULT_REFERRAL_PROGRAM_SETTINGS: ReferralProgramSettings = {
  enabled: true,
  registrationReferralEnabled: true,
  defaultReferralCode: 'PLATFORM-DEFAULT',
  sellerCommissionPercent: 5,
  designerCommissionPercent: 5,
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
     SET "referralCode" = CONCAT('RI-', "numericRefId"::text)
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
  referralSchemaEnsured = true;
};

export const normalizeReferralProgramSettings = (value: unknown): ReferralProgramSettings => {
  const source = parseObject(value);
  const baseUrl = String(source.referralBaseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl)
    .trim()
    .replace(/\/+$/, '');
  return {
    enabled: source.enabled !== false,
    registrationReferralEnabled: source.registrationReferralEnabled !== false,
    defaultReferralCode: normalizeReferralCodeToken(
      source.defaultReferralCode,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.defaultReferralCode
    ),
    sellerCommissionPercent: toPercent(
      source.sellerCommissionPercent,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.sellerCommissionPercent
    ),
    designerCommissionPercent: toPercent(
      source.designerCommissionPercent,
      DEFAULT_REFERRAL_PROGRAM_SETTINGS.designerCommissionPercent
    ),
    holdDays: Math.max(0, Math.min(365, Number(source.holdDays || DEFAULT_REFERRAL_PROGRAM_SETTINGS.holdDays))),
    minimumPayoutUsd: toMoney(source.minimumPayoutUsd ?? DEFAULT_REFERRAL_PROGRAM_SETTINGS.minimumPayoutUsd),
    referralBaseUrl: baseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl,
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
  const next = normalizeReferralProgramSettings(value);
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
  return (await readReferralProgramSettings()).settings;
};

const normalizeReferralCode = (value: unknown) => String(value || '').trim().toUpperCase();

export const buildReferralLink = (referralCode: string, settings?: ReferralProgramSettings) => {
  const config = settings || DEFAULT_REFERRAL_PROGRAM_SETTINGS;
  return `${String(config.referralBaseUrl || DEFAULT_REFERRAL_PROGRAM_SETTINGS.referralBaseUrl).replace(/\/+$/, '')}/register?ref=${encodeURIComponent(
    referralCode
  )}`;
};

export const ensureResellerProfileForUser = async (input: {
  userId: string;
  createdById?: string | null;
  displayName?: string | null;
}) => {
  await ensureReferralProgramSchema();
  const existingRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "ResellerInfluencerProfile"
     WHERE "userId" = $1
     LIMIT 1`,
    input.userId
  );
  const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
  if (existing) {
    const settings = (await readReferralProgramSettings()).settings;
    return {
      id: String(existing.id || ''),
      userId: String(existing.userId || ''),
      numericRefId: Number(existing.numericRefId || 0),
      referralCode: String(existing.referralCode || '').trim(),
      displayName: String(existing.displayName || '').trim(),
      isActive: existing.isActive !== false,
      commissionOverridePercent:
        existing.commissionOverridePercent == null ? null : Number(existing.commissionOverridePercent),
      referralLink: buildReferralLink(String(existing.referralCode || '').trim(), settings),
    };
  }
  const rows = await prisma.$queryRawUnsafe<Array<{ maxId: number | null }>>(
    `SELECT MAX("numericRefId")::bigint AS "maxId" FROM "ResellerInfluencerProfile"`
  );
  const nextNumeric = Math.max(1, Number(rows?.[0]?.maxId || 0) + 1);
  const referralCode = `RI-${nextNumeric}`;
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
  const settings = (await readReferralProgramSettings()).settings;
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
  metadata?: Record<string, unknown>;
}) => {
  await ensureReferralProgramSchema();
  const settings = (await readReferralProgramSettings()).settings;
  if (!settings.enabled) return { created: 0 };
  const aggregatedByVendor = new Map<
    string,
    { vendorUserId: string; vendorRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER'; baseAmountUsd: number }
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
    `SELECT *
     FROM "ResellerInfluencerProfile"
     WHERE "userId" = $1
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
        u."email", u."firstName", u."lastName", u."status" AS "userStatus",
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
