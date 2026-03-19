import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';

export const MODULE_KEYS = [
  'platform_core',
  'commerce',
  'ticketing',
  'chat',
  'communications',
  'help_center',
  'automation_ai',
  'ops',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export const MODULE_MODES = ['active', 'degraded', 'maintenance'] as const;
export type ModuleMode = (typeof MODULE_MODES)[number];
export const ROLLOUT_SCOPE_TYPES = ['GLOBAL', 'ROLE', 'PERCENT'] as const;
export type RolloutScopeType = (typeof ROLLOUT_SCOPE_TYPES)[number];

export type ModuleRolloutScope = {
  type: RolloutScopeType;
  value: string;
};

export type ModuleRuntimeSetting = {
  moduleKey: ModuleKey;
  enabled: boolean;
  mode: ModuleMode;
  provider: string;
  rolloutScope: ModuleRolloutScope;
  config: Record<string, unknown>;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ModuleAccessReason =
  | null
  | 'MODULE_DISABLED'
  | 'MODULE_MAINTENANCE'
  | 'MODULE_SCOPE_BLOCKED';

export type ModuleAccessDecision = {
  moduleKey: ModuleKey;
  enabled: boolean;
  mode: ModuleMode;
  provider: string;
  rolloutScope: ModuleRolloutScope;
  allowed: boolean;
  reason: ModuleAccessReason;
};

const DEFAULT_SCOPE: ModuleRolloutScope = { type: 'GLOBAL', value: '*' };
const CACHE_TTL_MS = 15_000;
const moduleKeySchema = z.enum(MODULE_KEYS);

const defaultModuleRows: Array<{
  moduleKey: ModuleKey;
  enabled: boolean;
  mode: ModuleMode;
  provider: string;
  rolloutScope: ModuleRolloutScope;
  config: Record<string, unknown>;
}> = MODULE_KEYS.map((moduleKey) => ({
  moduleKey,
  enabled: true,
  mode: 'active',
  provider: 'internal',
  rolloutScope: { ...DEFAULT_SCOPE },
  config: {},
}));

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

const normalizeMode = (value: unknown): ModuleMode => {
  const token = String(value || '').trim().toLowerCase();
  if (token === 'active' || token === 'degraded' || token === 'maintenance') return token;
  return 'active';
};

const normalizeRolloutScope = (value: unknown): ModuleRolloutScope => {
  const row = parseObject(value);
  const typeToken = String(row.type || DEFAULT_SCOPE.type).trim().toUpperCase();
  const type: RolloutScopeType =
    typeToken === 'ROLE' || typeToken === 'PERCENT' ? typeToken : 'GLOBAL';
  const normalizedValue = String(row.value ?? DEFAULT_SCOPE.value).trim();
  if (type === 'GLOBAL') return { type, value: normalizedValue || '*' };
  if (type === 'ROLE') return { type, value: normalizedValue };
  const percent = Number(normalizedValue);
  const safePercent = Number.isFinite(percent) ? Math.max(0, Math.min(100, Math.round(percent))) : 0;
  return { type, value: String(safePercent) };
};

const normalizeProvider = (value: unknown) => String(value || 'internal').trim().slice(0, 120) || 'internal';

const normalizeModuleRow = (row: any): ModuleRuntimeSetting => ({
  moduleKey: moduleKeySchema.parse(String(row?.moduleKey || '').trim()),
  enabled: row?.enabled !== false,
  mode: normalizeMode(row?.mode),
  provider: normalizeProvider(row?.provider),
  rolloutScope: normalizeRolloutScope(row?.rolloutScope),
  config: parseObject(row?.config),
  updatedByUserId: row?.updatedByUserId ? String(row.updatedByUserId) : null,
  createdAt: new Date(row?.createdAt || Date.now()).toISOString(),
  updatedAt: new Date(row?.updatedAt || Date.now()).toISOString(),
});

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;
let cacheMap: Map<ModuleKey, ModuleRuntimeSetting> | null = null;
let cacheExpiresAt = 0;

const invalidateModuleRuntimeCache = () => {
  cacheMap = null;
  cacheExpiresAt = 0;
};

export async function ensureModuleRuntimeSchema() {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "ModuleRuntimeSetting" (
          "moduleKey" TEXT PRIMARY KEY,
          "enabled" BOOLEAN NOT NULL DEFAULT true,
          "mode" TEXT NOT NULL DEFAULT 'active',
          "provider" TEXT NOT NULL DEFAULT 'internal',
          "rolloutScope" JSONB NOT NULL DEFAULT '{"type":"GLOBAL","value":"*"}'::jsonb,
          "config" JSONB NOT NULL DEFAULT '{}'::jsonb,
          "updatedByUserId" TEXT,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
      await Promise.all(
        defaultModuleRows.map((entry) =>
          prisma.$executeRawUnsafe(
            `INSERT INTO "ModuleRuntimeSetting"
              ("moduleKey","enabled","mode","provider","rolloutScope","config","createdAt","updatedAt")
             VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,NOW(),NOW())
             ON CONFLICT ("moduleKey") DO NOTHING`,
            entry.moduleKey,
            entry.enabled,
            entry.mode,
            entry.provider,
            JSON.stringify(entry.rolloutScope),
            JSON.stringify(entry.config)
          )
        )
      );
      schemaEnsured = true;
      invalidateModuleRuntimeCache();
    })();
  }
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
}

const readAllSettings = async (force = false): Promise<Map<ModuleKey, ModuleRuntimeSetting>> => {
  await ensureModuleRuntimeSchema();
  const now = Date.now();
  if (!force && cacheMap && now < cacheExpiresAt) {
    return cacheMap;
  }
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT "moduleKey","enabled","mode","provider","rolloutScope","config","updatedByUserId","createdAt","updatedAt"
     FROM "ModuleRuntimeSetting"
     ORDER BY "moduleKey" ASC`
  );
  const next = new Map<ModuleKey, ModuleRuntimeSetting>();
  for (const row of rows) {
    const normalized = normalizeModuleRow(row);
    next.set(normalized.moduleKey, normalized);
  }
  for (const fallback of defaultModuleRows) {
    if (!next.has(fallback.moduleKey)) {
      next.set(fallback.moduleKey, {
        moduleKey: fallback.moduleKey,
        enabled: fallback.enabled,
        mode: fallback.mode,
        provider: fallback.provider,
        rolloutScope: fallback.rolloutScope,
        config: fallback.config,
        updatedByUserId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }
  cacheMap = next;
  cacheExpiresAt = now + CACHE_TTL_MS;
  return next;
};

export async function listModuleRuntimeSettings(): Promise<ModuleRuntimeSetting[]> {
  const map = await readAllSettings();
  return MODULE_KEYS.map((key) => map.get(key)).filter(Boolean) as ModuleRuntimeSetting[];
}

export async function getModuleRuntimeSetting(moduleKey: ModuleKey): Promise<ModuleRuntimeSetting> {
  const map = await readAllSettings();
  const row = map.get(moduleKey);
  if (row) return row;
  const fallback = defaultModuleRows.find((entry) => entry.moduleKey === moduleKey)!;
  return {
    moduleKey,
    enabled: fallback.enabled,
    mode: fallback.mode,
    provider: fallback.provider,
    rolloutScope: fallback.rolloutScope,
    config: fallback.config,
    updatedByUserId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export const moduleRuntimePatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    mode: z.enum(MODULE_MODES).optional(),
    provider: z.string().trim().min(1).max(120).optional(),
    rolloutScope: z
      .object({
        type: z.enum(ROLLOUT_SCOPE_TYPES),
        value: z.string().trim().max(500),
      })
      .optional(),
    config: z.record(z.any()).optional(),
  })
  .strict();

export async function updateModuleRuntimeSetting(params: {
  moduleKey: ModuleKey;
  patch: unknown;
  actorUserId?: string | null;
}) {
  await ensureModuleRuntimeSchema();
  const parsed = moduleRuntimePatchSchema.parse(params.patch || {});
  const current = await getModuleRuntimeSetting(params.moduleKey);
  const next: ModuleRuntimeSetting = {
    ...current,
    ...(parsed.enabled !== undefined ? { enabled: parsed.enabled } : {}),
    ...(parsed.mode !== undefined ? { mode: parsed.mode } : {}),
    ...(parsed.provider !== undefined ? { provider: normalizeProvider(parsed.provider) } : {}),
    ...(parsed.rolloutScope !== undefined ? { rolloutScope: normalizeRolloutScope(parsed.rolloutScope) } : {}),
    ...(parsed.config !== undefined ? { config: parseObject(parsed.config) } : {}),
    updatedByUserId: params.actorUserId ? String(params.actorUserId) : current.updatedByUserId,
    updatedAt: new Date().toISOString(),
  };
  await prisma.$executeRawUnsafe(
    `UPDATE "ModuleRuntimeSetting"
     SET "enabled" = $2,
         "mode" = $3,
         "provider" = $4,
         "rolloutScope" = $5::jsonb,
         "config" = $6::jsonb,
         "updatedByUserId" = $7,
         "updatedAt" = NOW()
     WHERE "moduleKey" = $1`,
    params.moduleKey,
    next.enabled,
    next.mode,
    next.provider,
    JSON.stringify(next.rolloutScope),
    JSON.stringify(next.config),
    next.updatedByUserId
  );
  invalidateModuleRuntimeCache();
  return getModuleRuntimeSetting(params.moduleKey);
}

const roleMatchesScope = (scopeValue: string, actorRole?: string | null) => {
  const normalizedRole = String(actorRole || '').trim().toUpperCase();
  if (!normalizedRole) return false;
  const allowedRoles = String(scopeValue || '')
    .split(',')
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter(Boolean);
  if (allowedRoles.length === 0) return false;
  return allowedRoles.includes(normalizedRole);
};

const percentMatchesScope = (scopeValue: string, actorUserId?: string | null, moduleKey?: string) => {
  const percentRaw = Number(scopeValue);
  const percent = Number.isFinite(percentRaw) ? Math.max(0, Math.min(100, Math.round(percentRaw))) : 0;
  if (percent >= 100) return true;
  if (percent <= 0 || !actorUserId) return false;
  const digest = crypto
    .createHash('sha256')
    .update(`${String(moduleKey || '')}:${String(actorUserId)}`)
    .digest();
  const bucket = digest.readUInt32BE(0) % 100;
  return bucket < percent;
};

export async function resolveModuleAccessDecision(params: {
  moduleKey: ModuleKey;
  actorRole?: string | null;
  actorUserId?: string | null;
}): Promise<ModuleAccessDecision> {
  const row = await getModuleRuntimeSetting(params.moduleKey);
  if (!row.enabled) {
    return {
      moduleKey: row.moduleKey,
      enabled: row.enabled,
      mode: row.mode,
      provider: row.provider,
      rolloutScope: row.rolloutScope,
      allowed: false,
      reason: 'MODULE_DISABLED',
    };
  }
  if (row.mode === 'maintenance') {
    return {
      moduleKey: row.moduleKey,
      enabled: row.enabled,
      mode: row.mode,
      provider: row.provider,
      rolloutScope: row.rolloutScope,
      allowed: false,
      reason: 'MODULE_MAINTENANCE',
    };
  }
  let scopeAllowed = true;
  if (row.rolloutScope.type === 'ROLE') {
    scopeAllowed = roleMatchesScope(row.rolloutScope.value, params.actorRole);
  } else if (row.rolloutScope.type === 'PERCENT') {
    scopeAllowed = percentMatchesScope(row.rolloutScope.value, params.actorUserId, row.moduleKey);
  }
  return {
    moduleKey: row.moduleKey,
    enabled: row.enabled,
    mode: row.mode,
    provider: row.provider,
    rolloutScope: row.rolloutScope,
    allowed: scopeAllowed,
    reason: scopeAllowed ? null : 'MODULE_SCOPE_BLOCKED',
  };
}

export async function resolveModuleAccessDecisions(params: {
  moduleKeys: ModuleKey[];
  actorRole?: string | null;
  actorUserId?: string | null;
}) {
  const keys = Array.from(new Set(params.moduleKeys));
  const rows = await Promise.all(
    keys.map((moduleKey) =>
      resolveModuleAccessDecision({
        moduleKey,
        actorRole: params.actorRole,
        actorUserId: params.actorUserId,
      })
    )
  );
  const map: Record<ModuleKey, ModuleAccessDecision> = {} as Record<ModuleKey, ModuleAccessDecision>;
  for (const entry of rows) {
    map[entry.moduleKey] = entry;
  }
  return map;
}

