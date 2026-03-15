import { randomUUID } from 'crypto';
import { prisma, UserRole } from '../db';

export type EnterpriseCapability =
  | 'dashboard:view'
  | 'products:view'
  | 'products:manage'
  | 'orders:view'
  | 'orders:update'
  | 'featured:manage'
  | 'payments:view'
  | 'payments:manage'
  | 'profile:view'
  | 'profile:manage'
  | 'subaccounts:view'
  | 'subaccounts:manage'
  | 'governance:view'
  | 'governance:submit'
  | 'tryon:view';

export const ENTERPRISE_PERMISSION_CATALOG: Array<{ key: EnterpriseCapability; label: string }> = [
  { key: 'dashboard:view', label: 'View dashboard' },
  { key: 'products:view', label: 'View products' },
  { key: 'products:manage', label: 'Create and edit products' },
  { key: 'orders:view', label: 'View orders' },
  { key: 'orders:update', label: 'Update order status' },
  { key: 'featured:manage', label: 'Manage featured requests' },
  { key: 'payments:view', label: 'View payments and earnings' },
  { key: 'payments:manage', label: 'Manage withdrawals and payment settings' },
  { key: 'profile:view', label: 'View profile and storefront' },
  { key: 'profile:manage', label: 'Edit profile and storefront data' },
  { key: 'subaccounts:view', label: 'View enterprise sub-accounts' },
  { key: 'subaccounts:manage', label: 'Create and manage enterprise sub-accounts' },
  { key: 'governance:view', label: 'View governance profile status' },
  { key: 'governance:submit', label: 'Submit governance profile updates' },
  { key: 'tryon:view', label: 'View TryON insights' },
];

export const ENTERPRISE_STANDARD_ROLE_TEMPLATES: Array<{
  key: string;
  name: string;
  permissions: EnterpriseCapability[];
}> = [
  {
    key: 'SUB_ADMIN',
    name: 'Sub-Admin',
    permissions: ENTERPRISE_PERMISSION_CATALOG.map((entry) => entry.key),
  },
  {
    key: 'ACCOUNTS',
    name: 'Accounts',
    permissions: ['dashboard:view', 'payments:view', 'payments:manage', 'orders:view', 'subaccounts:view'],
  },
  {
    key: 'LOGISTIC',
    name: 'Logistic',
    permissions: ['dashboard:view', 'orders:view', 'orders:update', 'products:view'],
  },
  {
    key: 'OPERATIONS',
    name: 'Operations',
    permissions: ['dashboard:view', 'products:view', 'products:manage', 'orders:view', 'orders:update', 'featured:manage'],
  },
];

let enterpriseSchemaEnsured = false;
let enterpriseSchemaPromise: Promise<void> | null = null;
const executeBestEffort = async (sql: string, ...params: any[]) => {
  try {
    await prisma.$executeRawUnsafe(sql, ...params);
  } catch {
    // Keep compatibility with drifted schemas in long-lived deployments.
  }
};

const parseJsonArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((entry) => String(entry || '').trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeEnterpriseConfigLevels = (value: unknown): Array<{
  key: string;
  name: string;
  seatLimit: number;
  yearlyFeeUsd: number;
}> => {
  const toList = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input;
    if (typeof input === 'string') {
      try {
        return toList(JSON.parse(input));
      } catch {
        return [];
      }
    }
    if (input && typeof input === 'object') {
      const record = input as Record<string, unknown>;
      if (Array.isArray(record.levels)) return record.levels;
      return Object.entries(record).map(([key, row]) => ({
        key,
        ...(row && typeof row === 'object' ? (row as Record<string, unknown>) : {}),
      }));
    }
    return [];
  };

  const rows = toList(value)
    .map((entry) => {
      const item = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
      const key = String(item.key || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_')
        .slice(0, 40);
      const name = String(item.name || '').trim().slice(0, 80);
      const seatLimit = Math.max(1, Math.min(10000, Number(item.seatLimit || 1)));
      const yearlyFeeUsd = Math.max(0, Number(item.yearlyFeeUsd || 0));
      if (!key || !name) return null;
      return { key, name, seatLimit, yearlyFeeUsd };
    })
    .filter(Boolean) as Array<{ key: string; name: string; seatLimit: number; yearlyFeeUsd: number }>;
  return Array.from(new Map(rows.map((row) => [row.key, row])).values());
};

const addYears = (baseDate: Date, years: number) => {
  const next = new Date(baseDate.getTime());
  next.setFullYear(next.getFullYear() + Math.max(1, Number(years) || 1));
  return next;
};

export const isEnterpriseSubscriptionActive = (account: any) => {
  const status = String(account?.subscriptionStatus || '').toUpperCase();
  const enforceSubscription = account?.enforceSubscription !== false;
  if (!enforceSubscription) return String(account?.status || '').toUpperCase() === 'ACTIVE';
  if (String(account?.status || '').toUpperCase() !== 'ACTIVE') return false;
  if (status !== 'ACTIVE') return false;
  if (!account?.subscriptionEndsAt) return false;
  return new Date(account.subscriptionEndsAt).getTime() > Date.now();
};

export async function ensureEnterpriseSchema() {
  if (enterpriseSchemaEnsured) return;
  if (!enterpriseSchemaPromise) {
    enterpriseSchemaPromise = (async () => {
      try {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "EnterpriseAccount" (
          "id" TEXT NOT NULL,
          "ownerUserId" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "isEnterprise" BOOLEAN NOT NULL DEFAULT false,
          "status" TEXT NOT NULL DEFAULT 'INACTIVE',
          "levelKey" TEXT,
          "levelName" TEXT,
          "seatLimit" INTEGER NOT NULL DEFAULT 1,
          "yearlyFeeUsd" DECIMAL(12,2) NOT NULL DEFAULT 0,
          "subscriptionStatus" TEXT NOT NULL DEFAULT 'INACTIVE',
          "subscriptionStartedAt" TIMESTAMP(3),
          "subscriptionEndsAt" TIMESTAMP(3),
          "renewalDueAt" TIMESTAMP(3),
          "enforceSubscription" BOOLEAN NOT NULL DEFAULT true,
          "allowSubAccounts" BOOLEAN NOT NULL DEFAULT false,
          "createdById" TEXT,
          "updatedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EnterpriseAccount_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseAccount_ownerUserId_key" ON "EnterpriseAccount"("ownerUserId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseAccount_status_idx" ON "EnterpriseAccount"("status","subscriptionStatus")`
      );
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "role" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "isEnterprise" BOOLEAN NOT NULL DEFAULT false`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'INACTIVE'`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "levelKey" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "levelName" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "seatLimit" INTEGER NOT NULL DEFAULT 1`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "yearlyFeeUsd" DECIMAL(12,2) NOT NULL DEFAULT 0`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'INACTIVE'`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "subscriptionStartedAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "subscriptionEndsAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "renewalDueAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "enforceSubscription" BOOLEAN NOT NULL DEFAULT true`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "allowSubAccounts" BOOLEAN NOT NULL DEFAULT false`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "createdById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "updatedById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`ALTER TABLE "EnterpriseAccount" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`UPDATE "EnterpriseAccount" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`);

      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "EnterpriseRole" (
          "id" TEXT NOT NULL,
          "enterpriseAccountId" TEXT NOT NULL,
          "key" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "isSystem" BOOLEAN NOT NULL DEFAULT false,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EnterpriseRole_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseRole_account_key_unique" ON "EnterpriseRole"("enterpriseAccountId","key")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseRole_account_idx" ON "EnterpriseRole"("enterpriseAccountId")`
      );
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "enterpriseAccountId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "key" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "name" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`ALTER TABLE "EnterpriseRole" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`UPDATE "EnterpriseRole" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`);

      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "EnterpriseSubAccount" (
          "id" TEXT NOT NULL,
          "enterpriseAccountId" TEXT NOT NULL,
          "ownerUserId" TEXT NOT NULL,
          "subUserId" TEXT NOT NULL,
          "roleId" TEXT,
          "status" TEXT NOT NULL DEFAULT 'ACTIVE',
          "createdById" TEXT,
          "updatedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EnterpriseSubAccount_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "EnterpriseSubAccount_subUserId_key" ON "EnterpriseSubAccount"("subUserId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseSubAccount_owner_idx" ON "EnterpriseSubAccount"("ownerUserId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseSubAccount_account_idx" ON "EnterpriseSubAccount"("enterpriseAccountId","status")`
      );
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "enterpriseAccountId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "subUserId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "roleId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE'`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "createdById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "updatedById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`ALTER TABLE "EnterpriseSubAccount" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`UPDATE "EnterpriseSubAccount" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`);
      await executeBestEffort(
        `UPDATE "EnterpriseSubAccount" sa
         SET "ownerUserId" = ea."ownerUserId"
         FROM "EnterpriseAccount" ea
         WHERE sa."ownerUserId" IS NULL
           AND sa."enterpriseAccountId" = ea."id"`
      );

      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "EnterpriseUpgradeConfig" (
          "id" TEXT NOT NULL,
          "sellerEnabled" BOOLEAN NOT NULL DEFAULT true,
          "designerEnabled" BOOLEAN NOT NULL DEFAULT true,
          "enforceSubscription" BOOLEAN NOT NULL DEFAULT true,
          "defaultSeatLimit" INTEGER NOT NULL DEFAULT 5,
          "defaultYearlyFeeUsd" DECIMAL(12,2) NOT NULL DEFAULT 99,
          "levels" JSONB NOT NULL DEFAULT '[]'::jsonb,
          "updatedById" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EnterpriseUpgradeConfig_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `INSERT INTO "EnterpriseUpgradeConfig"
          ("id","sellerEnabled","designerEnabled","enforceSubscription","defaultSeatLimit","defaultYearlyFeeUsd","levels","createdAt","updatedAt")
         VALUES ('default',true,true,true,5,99,$1::jsonb,NOW(),NOW())
         ON CONFLICT ("id") DO NOTHING`,
        JSON.stringify([
          { key: 'BASIC', name: 'Basic', seatLimit: 5, yearlyFeeUsd: 99 },
          { key: 'GROWTH', name: 'Growth', seatLimit: 15, yearlyFeeUsd: 249 },
          { key: 'PREMIUM', name: 'Premium', seatLimit: 50, yearlyFeeUsd: 699 },
        ])
      );
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "sellerEnabled" BOOLEAN NOT NULL DEFAULT true`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "designerEnabled" BOOLEAN NOT NULL DEFAULT true`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "enforceSubscription" BOOLEAN NOT NULL DEFAULT true`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "defaultSeatLimit" INTEGER NOT NULL DEFAULT 5`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "defaultYearlyFeeUsd" DECIMAL(12,2) NOT NULL DEFAULT 99`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "levels" JSONB NOT NULL DEFAULT '[]'::jsonb`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "updatedById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeConfig" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`UPDATE "EnterpriseUpgradeConfig" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`);

      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "EnterpriseUpgradeRequest" (
          "id" TEXT NOT NULL,
          "ownerUserId" TEXT NOT NULL,
          "role" TEXT NOT NULL,
          "requestedLevelKey" TEXT,
          "requestedSeatLimit" INTEGER NOT NULL DEFAULT 5,
          "requestedYears" INTEGER NOT NULL DEFAULT 1,
          "note" TEXT,
          "status" TEXT NOT NULL DEFAULT 'PENDING',
          "reviewedById" TEXT,
          "reviewedAt" TIMESTAMP(3),
          "reviewNote" TEXT,
          "approvedLevelName" TEXT,
          "approvedSeatLimit" INTEGER,
          "approvedYearlyFeeUsd" DECIMAL(12,2),
          "paymentProviderKey" TEXT,
          "paymentReference" TEXT,
          "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
          "paidAt" TIMESTAMP(3),
          "activatedAt" TIMESTAMP(3),
          "expiresAt" TIMESTAMP(3),
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "EnterpriseUpgradeRequest_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseUpgradeRequest_owner_idx" ON "EnterpriseUpgradeRequest"("ownerUserId","status")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "EnterpriseUpgradeRequest_payment_idx" ON "EnterpriseUpgradeRequest"("paymentStatus","status")`
      );
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "role" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "requestedLevelKey" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "requestedSeatLimit" INTEGER NOT NULL DEFAULT 5`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "requestedYears" INTEGER NOT NULL DEFAULT 1`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "note" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING'`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "reviewedById" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "reviewedAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "reviewNote" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "approvedLevelName" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "approvedSeatLimit" INTEGER`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "approvedYearlyFeeUsd" DECIMAL(12,2)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "paymentProviderKey" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "paymentReference" TEXT`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID'`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3)`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`ALTER TABLE "EnterpriseUpgradeRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
      await executeBestEffort(`UPDATE "EnterpriseUpgradeRequest" SET "updatedAt" = NOW() WHERE "updatedAt" IS NULL`);
      } catch {
        // Ignore schema bootstrap failures in restricted deployments.
      } finally {
        enterpriseSchemaEnsured = true;
      }
    })();
  }
  try {
    await enterpriseSchemaPromise;
  } finally {
    enterpriseSchemaPromise = null;
  }
}

export async function readEnterpriseConfig() {
  await ensureEnterpriseSchema();
  let row: any = null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<any>>(
      `SELECT "id","sellerEnabled","designerEnabled","enforceSubscription","defaultSeatLimit","defaultYearlyFeeUsd","levels"
       FROM "EnterpriseUpgradeConfig"
       WHERE "id" = 'default'
       LIMIT 1`
    );
    row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch {
    row = null;
  }
  const rawLevels = normalizeEnterpriseConfigLevels(row?.levels);
  return {
    sellerEnabled: row?.sellerEnabled !== false,
    designerEnabled: row?.designerEnabled !== false,
    enforceSubscription: row?.enforceSubscription !== false,
    defaultSeatLimit: Math.max(1, Number(row?.defaultSeatLimit || 5)),
    defaultYearlyFeeUsd: Number(row?.defaultYearlyFeeUsd || 99),
    levels: rawLevels,
  };
}

export async function ensureEnterpriseAccountForOwner(ownerUserId: string, role: UserRole, updatedById?: string | null) {
  await ensureEnterpriseSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "EnterpriseAccount"
     WHERE "ownerUserId" = $1
     LIMIT 1`,
    ownerUserId
  );
  const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (existing) return existing;
  const config = await readEnterpriseConfig();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "EnterpriseAccount"
      ("id","ownerUserId","role","isEnterprise","status","seatLimit","yearlyFeeUsd","subscriptionStatus","enforceSubscription","allowSubAccounts","createdById","updatedById","createdAt","updatedAt")
     VALUES ($1,$2,$3,false,'INACTIVE',$4,$5,'INACTIVE',$6,false,$7,$7,NOW(),NOW())`,
    randomUUID(),
    ownerUserId,
    role,
    config.defaultSeatLimit,
    config.defaultYearlyFeeUsd,
    config.enforceSubscription,
    updatedById || null
  );
  const createdRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT * FROM "EnterpriseAccount" WHERE "ownerUserId" = $1 LIMIT 1`,
    ownerUserId
  );
  return Array.isArray(createdRows) && createdRows.length > 0 ? createdRows[0] : null;
}

export async function ensureEnterpriseStandardRoles(enterpriseAccountId: string) {
  await ensureEnterpriseSchema();
  for (const role of ENTERPRISE_STANDARD_ROLE_TEMPLATES) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "EnterpriseRole"
        ("id","enterpriseAccountId","key","name","permissions","isSystem","isActive","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5::jsonb,true,true,NOW(),NOW())
       ON CONFLICT ("enterpriseAccountId","key")
       DO UPDATE SET
        "name" = EXCLUDED."name",
        "permissions" = EXCLUDED."permissions",
        "isSystem" = true,
        "isActive" = true,
        "updatedAt" = NOW()`,
      randomUUID(),
      enterpriseAccountId,
      role.key,
      role.name,
      JSON.stringify(role.permissions)
    );
  }
}

export type EnterpriseActorContext = {
  ownerUserId: string;
  isSubAccount: boolean;
  subAccountId: string | null;
  enterpriseAccount: any | null;
  subAccountRole: any | null;
  permissions: string[];
};

export async function readEnterpriseActorContext(userId: string, role: UserRole): Promise<EnterpriseActorContext | null> {
  await ensureEnterpriseSchema();
  if (role !== UserRole.FABRIC_SELLER && role !== UserRole.FASHION_DESIGNER) return null;

  const ownerRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT ea.*
     FROM "EnterpriseAccount" ea
     WHERE ea."ownerUserId" = $1
       AND ea."role" = $2
     LIMIT 1`,
    userId,
    role
  );
  const ownerAccount = Array.isArray(ownerRows) && ownerRows.length > 0 ? ownerRows[0] : null;
  if (ownerAccount) {
    return {
      ownerUserId: userId,
      isSubAccount: false,
      subAccountId: null,
      enterpriseAccount: ownerAccount,
      subAccountRole: null,
      permissions: ENTERPRISE_STANDARD_ROLE_TEMPLATES[0].permissions,
    };
  }

  const subRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT
      sa."id" AS "subAccountId",
      sa."ownerUserId",
      sa."status" AS "subAccountStatus",
      ea.*,
      er."id" AS "roleId",
      er."name" AS "roleName",
      er."permissions" AS "rolePermissions",
      er."isActive" AS "roleIsActive"
     FROM "EnterpriseSubAccount" sa
     JOIN "EnterpriseAccount" ea ON ea."id" = sa."enterpriseAccountId"
     LEFT JOIN "EnterpriseRole" er ON er."id" = sa."roleId"
     WHERE sa."subUserId" = $1
       AND ea."role" = $2
     LIMIT 1`,
    userId,
    role
  );
  const row = Array.isArray(subRows) && subRows.length > 0 ? subRows[0] : null;
  if (!row) return null;
  const permissions = parseJsonArray(row.rolePermissions);
  return {
    ownerUserId: String(row.ownerUserId || ''),
    isSubAccount: true,
    subAccountId: String(row.subAccountId || ''),
    enterpriseAccount: row,
    subAccountRole: {
      id: row.roleId || null,
      name: row.roleName || null,
      isActive: row.roleIsActive !== false,
    },
    permissions,
  };
}

export function calculateSubscriptionDates(years: number) {
  const startedAt = new Date();
  const endsAt = addYears(startedAt, Math.max(1, Number(years) || 1));
  return { startedAt, endsAt, renewalDueAt: endsAt };
}

