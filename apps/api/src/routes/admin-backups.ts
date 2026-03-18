import { Router } from 'express';
import { randomUUID } from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const execFileAsync = promisify(execFile);
const router = Router();

const BACKUP_SETTINGS_KEY = 'admin_backup_center_settings_v1';
const DEFAULT_BACKUP_DIRECTORY = path.resolve(process.cwd(), 'secure-backups');
const PUBLIC_UPLOADS_DIRECTORY = path.resolve(process.cwd(), 'uploads');
const TMP_BACKUP_DIRECTORY = path.resolve('/tmp', 'african-fashion-secure-backups');
let resolvedBackupDirectoryCache: string | null = null;
const DIRECTORY_PERMISSION_ERROR_CODES = new Set(['EACCES', 'EPERM', 'EROFS']);
const BACKUP_TYPES = ['DATABASE_FULL', 'SYSTEM_FULL', 'CUSTOMER_FULL', 'SELLER_FULL', 'DESIGNER_FULL'] as const;
type BackupType = (typeof BACKUP_TYPES)[number];

type BackupSettings = {
  storage: {
    uploadToS3: boolean;
    bucket: string;
    region: string;
    prefix: string;
  };
  daily: {
    enabled: boolean;
    runAtUtc: string;
    retainDays: number;
    backupDatabase: boolean;
    backupCustomerData: boolean;
    backupSellerData: boolean;
    backupDesignerData: boolean;
    backupSystemFiles: boolean;
  };
};

const DEFAULT_BACKUP_SETTINGS: BackupSettings = {
  storage: {
    uploadToS3: false,
    bucket: '',
    region: '',
    prefix: 'secure-backups',
  },
  daily: {
    enabled: false,
    runAtUtc: '02:00',
    retainDays: 14,
    backupDatabase: true,
    backupCustomerData: true,
    backupSellerData: true,
    backupDesignerData: true,
    backupSystemFiles: true,
  },
};

const backupSettingsPatchSchema = z
  .object({
    storage: z
      .object({
        uploadToS3: z.boolean().optional(),
        bucket: z.string().trim().max(120).optional(),
        region: z.string().trim().max(80).optional(),
        prefix: z.string().trim().max(200).optional(),
      })
      .optional(),
    daily: z
      .object({
        enabled: z.boolean().optional(),
        runAtUtc: z
          .string()
          .trim()
          .regex(/^\d{2}:\d{2}$/)
          .optional(),
        retainDays: z.number().int().min(1).max(365).optional(),
        backupDatabase: z.boolean().optional(),
        backupCustomerData: z.boolean().optional(),
        backupSellerData: z.boolean().optional(),
        backupDesignerData: z.boolean().optional(),
        backupSystemFiles: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

const runBackupSchema = z
  .object({
    types: z.array(z.enum(BACKUP_TYPES)).min(1).max(10),
    uploadToS3: z.boolean().optional(),
    reason: z.string().trim().max(240).optional(),
  })
  .strict();

const runRestoreSchema = z
  .object({
    artifactId: z.string().trim().min(1).max(120),
    mode: z.enum(['MERGE']).optional(),
    reason: z.string().trim().max(240).optional(),
  })
  .strict();

const parseObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
      return {};
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

const isPathInside = (candidatePath: string, parentPath: string) => {
  const relative = path.relative(path.resolve(parentPath), path.resolve(candidatePath));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

const resolveConfiguredBackupDirectory = (input: unknown) => {
  const raw = String(input || '').trim();
  if (!raw) return '';
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(process.cwd(), raw);
};

const canUseBackupDirectory = async (dirPath: string) => {
  try {
    const resolved = path.resolve(dirPath);
    if (isPathInside(resolved, PUBLIC_UPLOADS_DIRECTORY)) return false;
    await fsp.mkdir(resolved, { recursive: true, mode: 0o700 });
    await fsp.access(resolved, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const isDirectoryPermissionError = (error: unknown) => {
  const code = String((error as any)?.code || '').trim().toUpperCase();
  if (DIRECTORY_PERMISSION_ERROR_CODES.has(code)) return true;
  const message = String((error as any)?.message || '').toLowerCase();
  return message.includes('permission denied') || message.includes('read-only file system');
};

async function resolveBackupDirectory(forceRefresh = false) {
  if (!forceRefresh && resolvedBackupDirectoryCache) {
    if (await canUseBackupDirectory(resolvedBackupDirectoryCache)) return resolvedBackupDirectoryCache;
    resolvedBackupDirectoryCache = null;
  }
  const configured = resolveConfiguredBackupDirectory(
    process.env.BACKUP_DIRECTORY || process.env.BACKUP_STORAGE_DIR || process.env.SECURE_BACKUP_DIRECTORY
  );
  const candidates = [configured, DEFAULT_BACKUP_DIRECTORY, path.resolve(process.cwd(), 'var', 'secure-backups'), TMP_BACKUP_DIRECTORY]
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
  for (const candidate of candidates) {
    if (await canUseBackupDirectory(candidate)) {
      resolvedBackupDirectoryCache = path.resolve(candidate);
      return resolvedBackupDirectoryCache;
    }
  }
  throw new Error(
    'No writable secure backup directory found. Set BACKUP_DIRECTORY to a writable path outside /uploads.'
  );
}

const jsonWithBigIntReplacer = (_key: string, value: unknown) =>
  typeof value === 'bigint' ? value.toString() : value;

const stringifyJsonSafely = (value: unknown) => JSON.stringify(value, jsonWithBigIntReplacer);

const normalizeBackupSettings = (value: unknown): BackupSettings => {
  const source = parseObject(value);
  const storage = parseObject(source.storage);
  const daily = parseObject(source.daily);
  const runAtUtc = String(daily.runAtUtc || DEFAULT_BACKUP_SETTINGS.daily.runAtUtc).trim();
  const safeRunAtUtc = /^\d{2}:\d{2}$/.test(runAtUtc) ? runAtUtc : DEFAULT_BACKUP_SETTINGS.daily.runAtUtc;
  return {
    storage: {
      uploadToS3: storage.uploadToS3 === true,
      bucket: String(storage.bucket || '').trim().slice(0, 120),
      region: String(storage.region || '').trim().slice(0, 80),
      prefix:
        String(storage.prefix || DEFAULT_BACKUP_SETTINGS.storage.prefix)
          .trim()
          .replace(/^\/+|\/+$/g, '')
          .slice(0, 200) || DEFAULT_BACKUP_SETTINGS.storage.prefix,
    },
    daily: {
      enabled: daily.enabled === true,
      runAtUtc: safeRunAtUtc,
      retainDays: Math.max(1, Math.min(365, Number(daily.retainDays || DEFAULT_BACKUP_SETTINGS.daily.retainDays))),
      backupDatabase: daily.backupDatabase !== false,
      backupCustomerData: daily.backupCustomerData !== false,
      backupSellerData: daily.backupSellerData !== false,
      backupDesignerData: daily.backupDesignerData !== false,
      backupSystemFiles: daily.backupSystemFiles !== false,
    },
  };
};

const resolveEffectiveStorageConfig = (settings: BackupSettings) => ({
  uploadToS3: settings.storage.uploadToS3,
  bucket: String(settings.storage.bucket || process.env.BACKUP_S3_BUCKET || '').trim(),
  region: String(settings.storage.region || process.env.BACKUP_S3_REGION || process.env.AWS_REGION || '').trim(),
  prefix: String(settings.storage.prefix || 'secure-backups').trim().replace(/^\/+|\/+$/g, ''),
});

const s3ClientFromSettings = (settings: BackupSettings) => {
  const storage = resolveEffectiveStorageConfig(settings);
  if (!storage.uploadToS3 || !storage.bucket || !storage.region) return null;
  return new S3Client({
    region: storage.region,
    credentials:
      process.env.BACKUP_S3_ACCESS_KEY_ID && process.env.BACKUP_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.BACKUP_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.BACKUP_S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
};

async function ensureBackupSchema() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "AdminBackupSetting" (
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "AdminBackupSetting_pkey" PRIMARY KEY ("key")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BackupArtifact" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "format" TEXT,
      "fileName" TEXT,
      "localPath" TEXT,
      "fileSizeBytes" BIGINT,
      "s3Bucket" TEXT,
      "s3Key" TEXT,
      "s3Uri" TEXT,
      "reason" TEXT,
      "errorMessage" TEXT,
      "createdById" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BackupArtifact_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BackupArtifact_type_idx" ON "BackupArtifact"("type","createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "BackupArtifact_status_idx" ON "BackupArtifact"("status","createdAt")`);
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "BackupRestoreJob" (
      "id" TEXT NOT NULL,
      "artifactId" TEXT NOT NULL,
      "artifactType" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "summary" TEXT,
      "errorMessage" TEXT,
      "createdById" TEXT,
      "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BackupRestoreJob_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "BackupRestoreJob_artifact_idx" ON "BackupRestoreJob"("artifactId","createdAt")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "BackupRestoreJob_status_idx" ON "BackupRestoreJob"("status","createdAt")`
  );
}

async function readBackupSettings(): Promise<BackupSettings> {
  await ensureBackupSchema();
  const rows = await prisma.$queryRawUnsafe<Array<{ value: unknown }>>(
    `SELECT "value" FROM "AdminBackupSetting" WHERE "key" = $1 LIMIT 1`,
    BACKUP_SETTINGS_KEY
  );
  if (!rows[0]) return normalizeBackupSettings(DEFAULT_BACKUP_SETTINGS);
  return normalizeBackupSettings(rows[0].value);
}

async function writeBackupSettings(payload: unknown, merge = true): Promise<BackupSettings> {
  await ensureBackupSchema();
  const parsed = backupSettingsPatchSchema.parse(payload || {});
  const current = await readBackupSettings();
  const next = normalizeBackupSettings(
    merge
      ? {
          ...current,
          ...parsed,
          storage: { ...current.storage, ...(parsed.storage || {}) },
          daily: { ...current.daily, ...(parsed.daily || {}) },
        }
      : parsed
  );
  await prisma.$executeRawUnsafe(
    `INSERT INTO "AdminBackupSetting" ("key","value","createdAt","updatedAt")
     VALUES ($1, $2::jsonb, NOW(), NOW())
     ON CONFLICT ("key")
     DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()`,
    BACKUP_SETTINGS_KEY,
    stringifyJsonSafely(next)
  );
  return next;
}

async function ensureBackupDirectory(forceRefresh = false) {
  const backupDirectory = await resolveBackupDirectory(forceRefresh);
  await fsp.mkdir(backupDirectory, { recursive: true, mode: 0o700 });
  return backupDirectory;
}

function buildTimestampLabel(date = new Date()) {
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hour}${minute}${second}`;
}

function resolveSystemRootDir() {
  const candidates = [
    process.env.BACKUP_SYSTEM_ROOT,
    path.resolve(process.cwd(), '..', '..'),
    path.resolve(process.cwd(), '..'),
    process.cwd(),
  ].filter(Boolean) as string[];
  for (const candidate of candidates) {
    const packageJsonPath = path.join(candidate, 'package.json');
    if (fs.existsSync(packageJsonPath)) return candidate;
  }
  return process.cwd();
}

async function createBackupJob(type: BackupType, createdById: string | null, reason?: string) {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "BackupArtifact"
      ("id","type","status","reason","createdById","startedAt","createdAt","updatedAt")
     VALUES ($1, $2, 'RUNNING', $3, $4, NOW(), NOW(), NOW())`,
    id,
    type,
    reason ? String(reason).slice(0, 240) : null,
    createdById
  );
  return id;
}

async function markBackupJobCompleted(
  id: string,
  input: {
    format: string;
    fileName: string;
    localPath: string;
    fileSizeBytes: number;
    s3Bucket?: string | null;
    s3Key?: string | null;
    s3Uri?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "BackupArtifact"
     SET "status" = 'COMPLETED',
         "format" = $2,
         "fileName" = $3,
         "localPath" = $4,
         "fileSizeBytes" = $5::bigint,
         "s3Bucket" = $6,
         "s3Key" = $7,
         "s3Uri" = $8,
         "metadata" = $9::jsonb,
         "completedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "id" = $1`,
    id,
    input.format,
    input.fileName,
    input.localPath,
    Math.max(0, Math.round(Number(input.fileSizeBytes || 0))),
    input.s3Bucket || null,
    input.s3Key || null,
    input.s3Uri || null,
    stringifyJsonSafely(input.metadata || {})
  );
}

async function markBackupJobFailed(id: string, errorMessage: string) {
  await prisma.$executeRawUnsafe(
    `UPDATE "BackupArtifact"
     SET "status" = 'FAILED',
         "errorMessage" = $2,
         "completedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "id" = $1`,
    id,
    String(errorMessage || 'Backup failed').slice(0, 2000)
  );
}

async function tableExists(tableName: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS "exists"`,
    tableName
  );
  return Boolean(rows[0]?.exists);
}

async function readRowsFromTable(tableName: string, whereSql = '', params: unknown[] = []) {
  if (!/^[A-Za-z0-9_]+$/.test(tableName)) return [];
  if (!(await tableExists(tableName))) return [];
  const query = `SELECT * FROM "${tableName}"${whereSql ? ` ${whereSql}` : ''}`;
  return prisma.$queryRawUnsafe<any[]>(query, ...params);
}

async function dumpAllTablesAsJson(targetFilePath: string) {
  const rows = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name ASC`
  );
  const payload: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    tables: {},
  };
  for (const row of rows) {
    const tableName = String(row.table_name || '');
    if (!/^[A-Za-z0-9_]+$/.test(tableName)) continue;
    const tableRows = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "${tableName}"`);
    (payload.tables as Record<string, unknown>)[tableName] = tableRows;
  }
  await fsp.writeFile(targetFilePath, stringifyJsonSafely(payload), 'utf8');
}

async function buildCustomerSnapshot(targetFilePath: string) {
  const users = await prisma.user.findMany({
    where: { role: UserRole.CUSTOMER },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const userIds = users.map((row) => row.id);
  const profiles = userIds.length
    ? await prisma.customerProfile.findMany({
        where: { userId: { in: userIds } },
        include: {
          addresses: true,
          measurements: true,
        },
      })
    : [];
  const profileIds = profiles.map((row) => row.id);
  const orders = userIds.length
    ? await prisma.order.findMany({
        where: { customerId: { in: userIds } },
        include: {
          designOrder: true,
          fabricOrder: true,
          readyToWearItems: true,
          timeline: true,
        },
      })
    : [];
  const orderIds = orders.map((row) => row.id);
  const tickets = orderIds.length
    ? await readRowsFromTable('OrderTicket', `WHERE "orderId" = ANY($1::text[])`, [orderIds])
    : [];
  const ticketIds = tickets.map((row: any) => String(row.id || '')).filter(Boolean);
  const ticketMessages = ticketIds.length
    ? await readRowsFromTable('OrderTicketMessage', `WHERE "ticketId" = ANY($1::text[])`, [ticketIds])
    : [];
  const notifications = userIds.length
    ? await prisma.notification.findMany({
        where: { userId: { in: userIds } },
        orderBy: { createdAt: 'desc' },
        take: 20000,
      })
    : [];
  const payload = {
    generatedAt: new Date().toISOString(),
    users,
    customerProfiles: profiles,
    addressesByProfileId: profileIds,
    orders,
    tickets,
    ticketMessages,
    notifications,
  };
  await fsp.writeFile(targetFilePath, stringifyJsonSafely(payload), 'utf8');
}

async function buildSellerSnapshot(targetFilePath: string) {
  const users = await prisma.user.findMany({
    where: { role: UserRole.FABRIC_SELLER },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const userIds = users.map((row) => row.id);
  const profiles = userIds.length
    ? await prisma.fabricSellerProfile.findMany({
        where: { userId: { in: userIds } },
      })
    : [];
  const profileIds = profiles.map((row) => row.id);
  const fabrics = profileIds.length ? await prisma.fabric.findMany({ where: { sellerId: { in: profileIds } } }) : [];
  const fabricOrderItems = profileIds.length
    ? await prisma.fabricOrderItem.findMany({
        where: { sellerId: { in: profileIds } },
      })
    : [];
  const orderIds = fabricOrderItems.map((row) => row.orderId);
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          designOrder: true,
          fabricOrder: true,
          readyToWearItems: true,
          timeline: true,
        },
      })
    : [];
  const tickets = orderIds.length
    ? await readRowsFromTable('OrderTicket', `WHERE "orderId" = ANY($1::text[])`, [orderIds])
    : [];
  const vendorWithdrawalMethods = userIds.length
    ? await readRowsFromTable('VendorWithdrawalMethod', `WHERE "userId" = ANY($1::text[])`, [userIds])
    : [];
  const vendorWithdrawalRequests = userIds.length
    ? await readRowsFromTable('VendorWithdrawalRequest', `WHERE "userId" = ANY($1::text[])`, [userIds])
    : [];
  const payload = {
    generatedAt: new Date().toISOString(),
    users,
    sellerProfiles: profiles,
    fabrics,
    fabricOrderItems,
    orders,
    tickets,
    vendorWithdrawalMethods,
    vendorWithdrawalRequests,
  };
  await fsp.writeFile(targetFilePath, stringifyJsonSafely(payload), 'utf8');
}

async function buildDesignerSnapshot(targetFilePath: string) {
  const users = await prisma.user.findMany({
    where: { role: UserRole.FASHION_DESIGNER },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const userIds = users.map((row) => row.id);
  const profiles = userIds.length
    ? await prisma.designerProfile.findMany({
        where: { userId: { in: userIds } },
      })
    : [];
  const profileIds = profiles.map((row) => row.id);
  const designs = profileIds.length ? await prisma.design.findMany({ where: { designerId: { in: profileIds } } }) : [];
  const readyToWear = profileIds.length ? await prisma.readyToWear.findMany({ where: { designerId: { in: profileIds } } }) : [];
  const designOrderItems = profileIds.length
    ? await prisma.designOrderItem.findMany({
        where: { designerId: { in: profileIds } },
      })
    : [];
  const orderIds = designOrderItems.map((row) => row.orderId);
  const orders = orderIds.length
    ? await prisma.order.findMany({
        where: { id: { in: orderIds } },
        include: {
          designOrder: true,
          fabricOrder: true,
          readyToWearItems: true,
          timeline: true,
        },
      })
    : [];
  const tickets = orderIds.length
    ? await readRowsFromTable('OrderTicket', `WHERE "orderId" = ANY($1::text[])`, [orderIds])
    : [];
  const vendorWithdrawalMethods = userIds.length
    ? await readRowsFromTable('VendorWithdrawalMethod', `WHERE "userId" = ANY($1::text[])`, [userIds])
    : [];
  const vendorWithdrawalRequests = userIds.length
    ? await readRowsFromTable('VendorWithdrawalRequest', `WHERE "userId" = ANY($1::text[])`, [userIds])
    : [];
  const payload = {
    generatedAt: new Date().toISOString(),
    users,
    designerProfiles: profiles,
    designs,
    readyToWear,
    designOrderItems,
    orders,
    tickets,
    vendorWithdrawalMethods,
    vendorWithdrawalRequests,
  };
  await fsp.writeFile(targetFilePath, stringifyJsonSafely(payload), 'utf8');
}

async function runDatabaseBackupFile(targetFilePath: string) {
  const databaseUrl = String(process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not configured. Cannot generate database dump.');
  }
  try {
    await execFileAsync('pg_dump', [
      '--no-owner',
      '--no-privileges',
      '--format=plain',
      '--file',
      targetFilePath,
      databaseUrl,
    ]);
  } catch (error) {
    // Fallback to JSON table dump when pg_dump is unavailable.
    await dumpAllTablesAsJson(targetFilePath.replace(/\.sql$/i, '.json'));
  }
}

async function runSystemBackupFile(targetFilePath: string, backupDirectory: string) {
  const sourceRoot = resolveSystemRootDir();
  const excludeArgs = ['--exclude=node_modules', '--exclude=.git', '--exclude=dist'];
  const relativeBackupPath = path.relative(sourceRoot, backupDirectory);
  if (relativeBackupPath && !relativeBackupPath.startsWith('..') && !path.isAbsolute(relativeBackupPath)) {
    excludeArgs.unshift(`--exclude=${relativeBackupPath}`);
  } else {
    excludeArgs.unshift('--exclude=secure-backups');
  }
  await execFileAsync('tar', [
    '-czf',
    targetFilePath,
    ...excludeArgs,
    '-C',
    sourceRoot,
    '.',
  ]);
}

async function uploadArtifactToS3(params: {
  client: S3Client;
  settings: BackupSettings;
  localPath: string;
  fileName: string;
  type: BackupType;
}) {
  const storage = resolveEffectiveStorageConfig(params.settings);
  if (!storage.bucket || !storage.region) return null;
  const key = `${storage.prefix}/${new Date().toISOString().slice(0, 10)}/${params.type.toLowerCase()}/${params.fileName}`.replace(
    /\/+/g,
    '/'
  );
  const stream = fs.createReadStream(params.localPath);
  await params.client.send(
    new PutObjectCommand({
      Bucket: storage.bucket,
      Key: key,
      Body: stream,
      ServerSideEncryption: 'AES256',
      ContentType: 'application/octet-stream',
    })
  );
  return {
    bucket: storage.bucket,
    key,
    uri: `s3://${storage.bucket}/${key}`,
  };
}

async function cleanupExpiredArtifacts(retainDays: number) {
  const backupDirectory = await resolveBackupDirectory();
  const cutoff = new Date(Date.now() - Math.max(1, retainDays) * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; localPath: string | null }>>(
    `SELECT "id","localPath"
     FROM "BackupArtifact"
     WHERE "createdAt" < $1`,
    cutoff
  );
  for (const row of rows) {
    const localPath = String(row.localPath || '').trim();
    if (localPath) {
      const resolved = path.resolve(localPath);
      if (isPathInside(resolved, backupDirectory)) {
        await fsp.unlink(resolved).catch(() => undefined);
      }
    }
  }
}

async function runSingleBackup(params: {
  type: BackupType;
  settings: BackupSettings;
  createdById: string | null;
  reason?: string;
  forceS3Upload?: boolean;
}) {
  let backupDirectory = await ensureBackupDirectory();
  const timestamp = buildTimestampLabel();
  const outputBaseName = `${params.type.toLowerCase()}-${timestamp}`;
  const extension =
    params.type === 'SYSTEM_FULL' ? 'tar.gz' : params.type === 'DATABASE_FULL' ? 'sql' : 'json';
  const fileName = `${outputBaseName}.${extension}`;
  const artifactId = await createBackupJob(params.type, params.createdById, params.reason);
  const executeBackupAtPath = async (targetPath: string, targetDirectory: string) => {
    if (params.type === 'DATABASE_FULL') {
      await runDatabaseBackupFile(targetPath);
    } else if (params.type === 'SYSTEM_FULL') {
      await runSystemBackupFile(targetPath, targetDirectory);
    } else if (params.type === 'CUSTOMER_FULL') {
      await buildCustomerSnapshot(targetPath);
    } else if (params.type === 'SELLER_FULL') {
      await buildSellerSnapshot(targetPath);
    } else if (params.type === 'DESIGNER_FULL') {
      await buildDesignerSnapshot(targetPath);
    }
  };
  try {
    let localPath = path.join(backupDirectory, fileName);
    try {
      await executeBackupAtPath(localPath, backupDirectory);
    } catch (error) {
      // If configured dir becomes unwritable at runtime, re-resolve and retry once.
      if (!isDirectoryPermissionError(error)) throw error;
      const previousDirectory = backupDirectory;
      backupDirectory = await ensureBackupDirectory(true);
      if (path.resolve(previousDirectory) === path.resolve(backupDirectory)) throw error;
      localPath = path.join(backupDirectory, fileName);
      await executeBackupAtPath(localPath, backupDirectory);
    }

    let effectivePath = localPath;
    if (params.type === 'DATABASE_FULL' && !fs.existsSync(localPath)) {
      const fallbackJsonPath = localPath.replace(/\.sql$/i, '.json');
      if (fs.existsSync(fallbackJsonPath)) {
        effectivePath = fallbackJsonPath;
      }
    }
    const stats = await fsp.stat(effectivePath);
    const s3Client = s3ClientFromSettings(params.settings);
    const shouldUpload = params.forceS3Upload === true || params.settings.storage.uploadToS3 === true;
    let uploaded: { bucket: string; key: string; uri: string } | null = null;
    if (shouldUpload && s3Client) {
      uploaded = await uploadArtifactToS3({
        client: s3Client,
        settings: params.settings,
        localPath: effectivePath,
        fileName: path.basename(effectivePath),
        type: params.type,
      });
    }
    await markBackupJobCompleted(artifactId, {
      format: path.extname(effectivePath).replace(/^\./, '') || extension,
      fileName: path.basename(effectivePath),
      localPath: effectivePath,
      fileSizeBytes: Number(stats.size || 0),
      s3Bucket: uploaded?.bucket || null,
      s3Key: uploaded?.key || null,
      s3Uri: uploaded?.uri || null,
      metadata: {
        generatedAt: new Date().toISOString(),
      },
    });
    return { id: artifactId };
  } catch (error: any) {
    await markBackupJobFailed(artifactId, String(error?.message || 'Backup failed'));
    throw error;
  }
}

async function listBackupArtifacts(limit = 30) {
  await ensureBackupSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","type","status","format","fileName","localPath","fileSizeBytes","s3Bucket","s3Key","s3Uri","reason","errorMessage","createdById","metadata","startedAt","completedAt","createdAt","updatedAt"
     FROM "BackupArtifact"
     ORDER BY "createdAt" DESC
     LIMIT ${Math.max(1, Math.min(200, Number(limit || 30)))}`
  );
  return rows.map((row) => ({
    id: String(row.id || ''),
    type: String(row.type || ''),
    status: String(row.status || ''),
    format: String(row.format || ''),
    fileName: String(row.fileName || ''),
    localPath: String(row.localPath || ''),
    fileSizeBytes: Number(row.fileSizeBytes || 0),
    s3Bucket: String(row.s3Bucket || ''),
    s3Key: String(row.s3Key || ''),
    s3Uri: String(row.s3Uri || ''),
    reason: String(row.reason || ''),
    errorMessage: String(row.errorMessage || ''),
    createdById: String(row.createdById || ''),
    metadata: parseObject(row.metadata),
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
}

async function listRestoreJobs(limit = 40) {
  await ensureBackupSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","artifactId","artifactType","status","summary","errorMessage","createdById","metadata","startedAt","completedAt","createdAt","updatedAt"
     FROM "BackupRestoreJob"
     ORDER BY "createdAt" DESC
     LIMIT ${Math.max(1, Math.min(200, Number(limit || 40)))}`
  );
  return rows.map((row) => ({
    id: String(row.id || ''),
    artifactId: String(row.artifactId || ''),
    artifactType: String(row.artifactType || ''),
    status: String(row.status || ''),
    summary: String(row.summary || ''),
    errorMessage: String(row.errorMessage || ''),
    createdById: String(row.createdById || ''),
    metadata: parseObject(row.metadata),
    startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  }));
}

async function createRestoreJob(artifactId: string, artifactType: string, createdById: string | null, reason?: string) {
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "BackupRestoreJob"
      ("id","artifactId","artifactType","status","summary","createdById","metadata","startedAt","createdAt","updatedAt")
     VALUES ($1,$2,$3,'RUNNING',$4,$5,$6::jsonb,NOW(),NOW(),NOW())`,
    id,
    artifactId,
    artifactType,
    reason ? String(reason).slice(0, 240) : null,
    createdById,
    stringifyJsonSafely({ reason: reason || null })
  );
  return id;
}

async function markRestoreJobDone(
  id: string,
  input: { status: 'COMPLETED' | 'FAILED' | 'MANUAL_REQUIRED'; summary?: string; errorMessage?: string; metadata?: unknown }
) {
  await prisma.$executeRawUnsafe(
    `UPDATE "BackupRestoreJob"
     SET "status" = $2,
         "summary" = $3,
         "errorMessage" = $4,
         "metadata" = $5::jsonb,
         "completedAt" = NOW(),
         "updatedAt" = NOW()
     WHERE "id" = $1`,
    id,
    input.status,
    input.summary ? String(input.summary).slice(0, 400) : null,
    input.errorMessage ? String(input.errorMessage).slice(0, 1000) : null,
    stringifyJsonSafely(input.metadata || {})
  );
}

async function readArtifactById(artifactId: string) {
  await ensureBackupSchema();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","type","status","localPath","fileName","s3Uri","metadata"
     FROM "BackupArtifact"
     WHERE "id" = $1
     LIMIT 1`,
    artifactId
  );
  return rows[0] || null;
}

async function restoreUsersFromSnapshot(rawRows: unknown[], expectedRole: UserRole) {
  const users = Array.isArray(rawRows) ? rawRows : [];
  let updated = 0;
  let skipped = 0;
  for (const candidate of users) {
    const row = parseObject(candidate);
    const role = String(row.role || '').trim().toUpperCase();
    if (role && role !== expectedRole) {
      skipped += 1;
      continue;
    }
    const id = String(row.id || '').trim();
    const email = String(row.email || '').trim().toLowerCase();
    if (!id && !email) {
      skipped += 1;
      continue;
    }
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          ...(id ? [{ id }] : []),
          ...(email ? [{ email }] : []),
        ],
      },
      select: { id: true },
    });
    if (!existing?.id) {
      skipped += 1;
      continue;
    }
    const firstName = String(row.firstName || '').trim();
    const lastName = String(row.lastName || '').trim();
    const phone = row.phone === null || row.phone === undefined ? null : String(row.phone || '').trim();
    const status = String(row.status || '').trim().toUpperCase();
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        phone: phone || null,
        ...(status ? { status: status as any } : {}),
      },
    });
    updated += 1;
  }
  return { updated, skipped };
}

async function runRestoreJob(params: {
  artifactId: string;
  createdById: string | null;
  reason?: string;
}) {
  const artifact = await readArtifactById(params.artifactId);
  if (!artifact) throw new Error('Backup artifact not found.');
  const restoreJobId = await createRestoreJob(params.artifactId, String(artifact.type || ''), params.createdById, params.reason);
  try {
    if (String(artifact.status || '').toUpperCase() !== 'COMPLETED') {
      throw new Error('Backup artifact is not completed yet.');
    }
    const type = String(artifact.type || '').trim().toUpperCase();
    const localPath = String(artifact.localPath || '').trim();
    if (!localPath) {
      await markRestoreJobDone(restoreJobId, {
        status: 'MANUAL_REQUIRED',
        summary: 'Artifact has no local file path. Download from S3 and restore manually.',
      });
      return { id: restoreJobId };
    }
    const resolvedPath = path.resolve(localPath);
    if (!fs.existsSync(resolvedPath)) {
      await markRestoreJobDone(restoreJobId, {
        status: 'MANUAL_REQUIRED',
        summary: 'Local backup file is missing. Retrieve from S3 and run manual restore.',
      });
      return { id: restoreJobId };
    }
    if (type === 'DATABASE_FULL' || type === 'SYSTEM_FULL') {
      await markRestoreJobDone(restoreJobId, {
        status: 'MANUAL_REQUIRED',
        summary: `${type} restore requires controlled maintenance procedure and is intentionally manual.`,
      });
      return { id: restoreJobId };
    }
    const rawText = await fsp.readFile(resolvedPath, 'utf8');
    const parsed = parseObject(rawText);
    let summary = 'No supported records were restored.';
    let metadata: Record<string, unknown> = {};
    if (type === 'CUSTOMER_FULL') {
      const result = await restoreUsersFromSnapshot(parseArray(parsed.users), UserRole.CUSTOMER);
      summary = `Customer restore completed. Updated ${result.updated} user record(s), skipped ${result.skipped}.`;
      metadata = { ...result, type };
    } else if (type === 'SELLER_FULL') {
      const result = await restoreUsersFromSnapshot(parseArray(parsed.users), UserRole.FABRIC_SELLER);
      summary = `Seller restore completed. Updated ${result.updated} user record(s), skipped ${result.skipped}.`;
      metadata = { ...result, type };
    } else if (type === 'DESIGNER_FULL') {
      const result = await restoreUsersFromSnapshot(parseArray(parsed.users), UserRole.FASHION_DESIGNER);
      summary = `Designer restore completed. Updated ${result.updated} user record(s), skipped ${result.skipped}.`;
      metadata = { ...result, type };
    }
    await markRestoreJobDone(restoreJobId, {
      status: 'COMPLETED',
      summary,
      metadata,
    });
    return { id: restoreJobId };
  } catch (error: any) {
    await markRestoreJobDone(restoreJobId, {
      status: 'FAILED',
      summary: 'Restore failed.',
      errorMessage: String(error?.message || 'Restore failed'),
    });
    throw error;
  }
}

async function runDailyProfile(createdById: string | null, reason = 'Daily backup profile execution') {
  const settings = await readBackupSettings();
  const types: BackupType[] = [];
  if (settings.daily.backupDatabase) types.push('DATABASE_FULL');
  if (settings.daily.backupCustomerData) types.push('CUSTOMER_FULL');
  if (settings.daily.backupSellerData) types.push('SELLER_FULL');
  if (settings.daily.backupDesignerData) types.push('DESIGNER_FULL');
  if (settings.daily.backupSystemFiles) types.push('SYSTEM_FULL');
  const jobs: Array<{ id: string }> = [];
  for (const type of types) {
    const job = await runSingleBackup({
      type,
      settings,
      createdById,
      reason,
    });
    jobs.push(job);
  }
  await cleanupExpiredArtifacts(settings.daily.retainDays);
  return jobs;
}

router.post('/run-daily-cron', async (req, res, next) => {
  try {
    const token = String(req.headers['x-backup-cron-token'] || req.query.token || '').trim();
    const expected = String(process.env.BACKUP_CRON_TOKEN || '').trim();
    if (!expected || token !== expected) {
      return res.status(401).json({ success: false, message: 'Invalid backup cron token.' });
    }
    const jobs = await runDailyProfile(null, 'Scheduled daily backup run');
    res.json({ success: true, data: { jobs } });
  } catch (error) {
    next(error);
  }
});

router.use(authenticate);
router.use(authorizePermissions(Permissions.BACKUPS_MANAGE, Permissions.BACKUPS_RESTORE));

router.get('/settings', authorizePermissions(Permissions.BACKUPS_MANAGE), async (_req, res, next) => {
  try {
    const settings = await readBackupSettings();
    const storage = resolveEffectiveStorageConfig(settings);
    const backupDirectory = await resolveBackupDirectory();
    res.json({
      success: true,
      data: {
        ...settings,
        storage: {
          ...settings.storage,
          bucket: storage.bucket,
          region: storage.region,
          prefix: storage.prefix,
          credentialsConfigured: Boolean(
            process.env.BACKUP_S3_ACCESS_KEY_ID ||
              process.env.AWS_ACCESS_KEY_ID ||
              process.env.BACKUP_S3_SECRET_ACCESS_KEY ||
              process.env.AWS_SECRET_ACCESS_KEY
          ),
          directory: backupDirectory,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/settings', authorizePermissions(Permissions.BACKUPS_MANAGE), async (req, res, next) => {
  try {
    const settings = await writeBackupSettings(req.body || {}, true);
    res.json({ success: true, data: settings, message: 'Backup settings saved.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed.', issues: error.issues });
    }
    next(error);
  }
});

router.post('/run', authorizePermissions(Permissions.BACKUPS_MANAGE), async (req, res, next) => {
  try {
    const payload = runBackupSchema.parse(req.body || {});
    const settings = await readBackupSettings();
    const jobs: Array<{ id: string }> = [];
    for (const type of payload.types) {
      const result = await runSingleBackup({
        type,
        settings,
        createdById: req.user?.id || null,
        reason: payload.reason || 'Manual backup run',
        forceS3Upload: payload.uploadToS3,
      });
      jobs.push(result);
    }
    await cleanupExpiredArtifacts(settings.daily.retainDays);
    res.json({ success: true, data: { jobs }, message: 'Backup job(s) completed.' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed.', issues: error.issues });
    }
    next(error);
  }
});

router.post('/run-daily-now', authorizePermissions(Permissions.BACKUPS_MANAGE), async (req, res, next) => {
  try {
    const jobs = await runDailyProfile(req.user?.id || null, 'Manual daily-profile backup run');
    res.json({
      success: true,
      data: { jobs },
      message: jobs.length > 0 ? `Executed ${jobs.length} daily backup job(s).` : 'No daily backup profiles are enabled.',
    });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs', authorizePermissions(Permissions.BACKUPS_MANAGE), async (req, res, next) => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '40'), 10);
    const rows = await listBackupArtifacts(limit);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/jobs/:id/download', authorizePermissions(Permissions.BACKUPS_MANAGE), async (req, res, next) => {
  try {
    const backupDirectory = await resolveBackupDirectory();
    const id = String(req.params.id || '').trim();
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id","fileName","localPath","status"
       FROM "BackupArtifact"
       WHERE "id" = $1
       LIMIT 1`,
      id
    );
    const row = rows[0];
    if (!row) {
      return res.status(404).json({ success: false, message: 'Backup artifact not found.' });
    }
    if (String(row.status || '').toUpperCase() !== 'COMPLETED') {
      return res.status(400).json({ success: false, message: 'Backup artifact is not ready for download.' });
    }
    const filePath = path.resolve(String(row.localPath || ''));
    if (isPathInside(filePath, PUBLIC_UPLOADS_DIRECTORY) || !isPathInside(filePath, backupDirectory)) {
      return res.status(403).json({ success: false, message: 'Invalid backup file path.' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Backup file not found on local storage. Please restore from S3 if available.',
      });
    }
    return res.download(filePath, String(row.fileName || path.basename(filePath)));
  } catch (error) {
    next(error);
  }
});

router.get('/restore/jobs', authorizePermissions(Permissions.BACKUPS_RESTORE), async (req, res, next) => {
  try {
    const limit = Number.parseInt(String(req.query.limit || '40'), 10);
    const rows = await listRestoreJobs(limit);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

router.post('/restore/run', authorizePermissions(Permissions.BACKUPS_RESTORE), async (req, res, next) => {
  try {
    const payload = runRestoreSchema.parse(req.body || {});
    const result = await runRestoreJob({
      artifactId: payload.artifactId,
      createdById: req.user?.id || null,
      reason: payload.reason || 'Manual restore run',
    });
    const rows = await listRestoreJobs(1);
    res.json({
      success: true,
      data: { job: rows.find((row) => row.id === result.id) || { id: result.id } },
      message: 'Restore job executed.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed.', issues: error.issues });
    }
    next(error);
  }
});

export default router;
