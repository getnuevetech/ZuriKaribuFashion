import { randomUUID } from 'crypto';
import { prisma } from '../db';

type PasswordPolicyRow = {
  userId: string;
  requiresPasswordChange: boolean;
  temporaryPassword: boolean;
  updatedAt: Date | string;
};

let passwordPolicySchemaEnsured = false;

const executeBestEffort = async (sql: string) => {
  try {
    await prisma.$executeRawUnsafe(sql);
  } catch {
    // best-effort for restricted db users
  }
};

export const ensurePasswordPolicySchema = async () => {
  if (passwordPolicySchemaEnsured) return;
  await executeBestEffort(
    `CREATE TABLE IF NOT EXISTS "UserPasswordPolicy" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "requiresPasswordChange" BOOLEAN NOT NULL DEFAULT FALSE,
      "temporaryPassword" BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "UserPasswordPolicy_pkey" PRIMARY KEY ("id")
    )`
  );
  await executeBestEffort(
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserPasswordPolicy_userId_key" ON "UserPasswordPolicy"("userId")`
  );
  await executeBestEffort(
    `CREATE INDEX IF NOT EXISTS "UserPasswordPolicy_requiresPasswordChange_idx" ON "UserPasswordPolicy"("requiresPasswordChange")`
  );
  passwordPolicySchemaEnsured = true;
};

export const markTemporaryPasswordRequired = async (userId: string) => {
  await ensurePasswordPolicySchema();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "UserPasswordPolicy"
      ("id","userId","requiresPasswordChange","temporaryPassword","createdAt","updatedAt")
     VALUES
      ($1,$2,TRUE,TRUE,NOW(),NOW())
     ON CONFLICT ("userId")
     DO UPDATE SET
      "requiresPasswordChange" = TRUE,
      "temporaryPassword" = TRUE,
      "updatedAt" = NOW()`,
    randomUUID(),
    userId
  );
};

export const clearTemporaryPasswordRequirement = async (userId: string) => {
  await ensurePasswordPolicySchema();
  await prisma.$executeRawUnsafe(
    `UPDATE "UserPasswordPolicy"
     SET "requiresPasswordChange" = FALSE,
         "temporaryPassword" = FALSE,
         "updatedAt" = NOW()
     WHERE "userId" = $1`,
    userId
  );
};

export const readPasswordPolicyForUser = async (userId: string) => {
  await ensurePasswordPolicySchema();
  try {
    const rows = await prisma.$queryRawUnsafe<Array<PasswordPolicyRow>>(
      `SELECT "userId","requiresPasswordChange","temporaryPassword","updatedAt"
       FROM "UserPasswordPolicy"
       WHERE "userId" = $1
       LIMIT 1`,
      userId
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    return {
      requiresPasswordChange: row?.requiresPasswordChange === true,
      temporaryPassword: row?.temporaryPassword === true,
      updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    };
  } catch {
    // Restricted DB roles may block bootstrap DDL and table queries.
    // Do not break login flow if password-policy table is unavailable.
    return {
      requiresPasswordChange: false,
      temporaryPassword: false,
      updatedAt: null,
    };
  }
};
