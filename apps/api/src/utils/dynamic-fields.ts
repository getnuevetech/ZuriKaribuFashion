import { randomUUID } from 'crypto';
import { prisma } from '../db';

export const DYNAMIC_FIELD_DATA_TYPES = [
  'TEXT',
  'LONG_TEXT',
  'NUMBER',
  'DECIMAL',
  'BOOLEAN',
  'DATE',
  'DATETIME',
  'ENUM',
  'MULTI_ENUM',
  'URL',
  'EMAIL',
  'PHONE',
  'JSON',
] as const;

export type DynamicFieldDataType = (typeof DYNAMIC_FIELD_DATA_TYPES)[number];

export type DynamicFieldDefinition = {
  id: string;
  key: string;
  label: string;
  module: string;
  scope: string;
  dataType: DynamicFieldDataType;
  placeholder: string;
  helpText: string;
  defaultValue: string;
  options: string[];
  validation: Record<string, unknown>;
  functionKeys: string[];
  isRequired: boolean;
  isActive: boolean;
  isSystem: boolean;
  createdById: string;
  createdAt: string | null;
  updatedAt: string | null;
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

const parseStringList = (value: unknown) => {
  if (Array.isArray(value)) return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    const raw = String(value || '').trim();
    if (!raw) return [];
    if (raw.startsWith('[') && raw.endsWith(']')) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
      } catch {
        return [];
      }
    }
    return raw
      .split(/[,\n;]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeDataType = (value: unknown): DynamicFieldDataType => {
  const token = String(value || '')
    .trim()
    .toUpperCase();
  if ((DYNAMIC_FIELD_DATA_TYPES as readonly string[]).includes(token)) {
    return token as DynamicFieldDataType;
  }
  return 'TEXT';
};

const normalizeFieldKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.[\]-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeModule = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeScope = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

export const mapDynamicFieldRow = (row: any): DynamicFieldDefinition => ({
  id: String(row?.id || ''),
  key: String(row?.key || ''),
  label: String(row?.label || ''),
  module: String(row?.module || ''),
  scope: String(row?.scope || ''),
  dataType: normalizeDataType(row?.dataType),
  placeholder: String(row?.placeholder || ''),
  helpText: String(row?.helpText || ''),
  defaultValue: String(row?.defaultValue || ''),
  options: parseStringList(row?.options),
  validation: parseObject(row?.validation),
  functionKeys: parseStringList(row?.functionKeys),
  isRequired: Boolean(row?.isRequired),
  isActive: row?.isActive !== false,
  isSystem: row?.isSystem === true,
  createdById: String(row?.createdById || ''),
  createdAt: row?.createdAt ? new Date(row.createdAt).toISOString() : null,
  updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

let dynamicFieldSchemaEnsured = false;
export const ensureDynamicFieldDefinitionSchema = async () => {
  if (dynamicFieldSchemaEnsured) return;
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "DynamicFieldDefinition" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "module" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "dataType" TEXT NOT NULL DEFAULT 'TEXT',
      "placeholder" TEXT NOT NULL DEFAULT '',
      "helpText" TEXT NOT NULL DEFAULT '',
      "defaultValue" TEXT NOT NULL DEFAULT '',
      "options" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "validation" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "functionKeys" JSONB NOT NULL DEFAULT '[]'::jsonb,
      "isRequired" BOOLEAN NOT NULL DEFAULT false,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "isSystem" BOOLEAN NOT NULL DEFAULT false,
      "createdById" TEXT NOT NULL DEFAULT '',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DynamicFieldDefinition_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "DynamicFieldDefinition_key_module_scope_key"
     ON "DynamicFieldDefinition"("key","module","scope")`
  );
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "DynamicFieldDefinition_module_scope_idx"
     ON "DynamicFieldDefinition"("module","scope","isActive")`
  );
  dynamicFieldSchemaEnsured = true;
};

export const listDynamicFieldDefinitions = async (filters?: {
  module?: string;
  scope?: string;
  isActive?: boolean;
}) => {
  await ensureDynamicFieldDefinitionSchema();
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (filters?.module) {
    values.push(normalizeModule(filters.module));
    clauses.push(`"module" = $${values.length}`);
  }
  if (filters?.scope) {
    values.push(normalizeScope(filters.scope));
    clauses.push(`"scope" = $${values.length}`);
  }
  if (typeof filters?.isActive === 'boolean') {
    values.push(Boolean(filters.isActive));
    clauses.push(`"isActive" = $${values.length}`);
  }
  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "DynamicFieldDefinition"
     ${whereSql}
     ORDER BY "module" ASC, "scope" ASC, "label" ASC, "createdAt" DESC`,
    ...values
  );
  return rows.map((row) => mapDynamicFieldRow(row));
};

export const createDynamicFieldDefinition = async (input: {
  key: string;
  label: string;
  module: string;
  scope: string;
  dataType?: string;
  placeholder?: string;
  helpText?: string;
  defaultValue?: string;
  options?: unknown;
  validation?: unknown;
  functionKeys?: unknown;
  isRequired?: boolean;
  isActive?: boolean;
  createdById?: string;
}) => {
  await ensureDynamicFieldDefinitionSchema();
  const key = normalizeFieldKey(input.key);
  const label = String(input.label || '').trim();
  const module = normalizeModule(input.module);
  const scope = normalizeScope(input.scope);
  if (!key || !label || !module || !scope) {
    throw new Error('key, label, module, and scope are required.');
  }
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DynamicFieldDefinition"
      ("id","key","label","module","scope","dataType","placeholder","helpText","defaultValue","options","validation","functionKeys","isRequired","isActive","isSystem","createdById","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
     ON CONFLICT ("key","module","scope")
     DO UPDATE SET
      "label" = EXCLUDED."label",
      "dataType" = EXCLUDED."dataType",
      "placeholder" = EXCLUDED."placeholder",
      "helpText" = EXCLUDED."helpText",
      "defaultValue" = EXCLUDED."defaultValue",
      "options" = EXCLUDED."options",
      "validation" = EXCLUDED."validation",
      "functionKeys" = EXCLUDED."functionKeys",
      "isRequired" = EXCLUDED."isRequired",
      "isActive" = EXCLUDED."isActive",
      "updatedAt" = CURRENT_TIMESTAMP`,
    id,
    key,
    label,
    module,
    scope,
    normalizeDataType(input.dataType),
    String(input.placeholder || '').trim(),
    String(input.helpText || '').trim(),
    String(input.defaultValue || ''),
    JSON.stringify(parseStringList(input.options)),
    JSON.stringify(parseObject(input.validation)),
    JSON.stringify(parseStringList(input.functionKeys)),
    Boolean(input.isRequired),
    input.isActive !== false,
    false,
    String(input.createdById || '')
  );
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT *
     FROM "DynamicFieldDefinition"
     WHERE "key" = $1 AND "module" = $2 AND "scope" = $3
     LIMIT 1`,
    key,
    module,
    scope
  );
  if (!Array.isArray(rows) || rows.length < 1) throw new Error('Failed to save dynamic field.');
  return mapDynamicFieldRow(rows[0]);
};

export const updateDynamicFieldDefinition = async (
  id: string,
  patch: {
    label?: string;
    dataType?: string;
    placeholder?: string;
    helpText?: string;
    defaultValue?: string;
    options?: unknown;
    validation?: unknown;
    functionKeys?: unknown;
    isRequired?: boolean;
    isActive?: boolean;
    module?: string;
    scope?: string;
    key?: string;
  }
) => {
  await ensureDynamicFieldDefinitionSchema();
  const rows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT * FROM "DynamicFieldDefinition" WHERE "id" = $1 LIMIT 1`,
    String(id || '')
  );
  if (!Array.isArray(rows) || rows.length < 1) throw new Error('Dynamic field not found.');
  const current = mapDynamicFieldRow(rows[0]);
  const next = {
    key: patch.key !== undefined ? normalizeFieldKey(patch.key) : current.key,
    label: patch.label !== undefined ? String(patch.label || '').trim() : current.label,
    module: patch.module !== undefined ? normalizeModule(patch.module) : current.module,
    scope: patch.scope !== undefined ? normalizeScope(patch.scope) : current.scope,
    dataType: patch.dataType !== undefined ? normalizeDataType(patch.dataType) : current.dataType,
    placeholder: patch.placeholder !== undefined ? String(patch.placeholder || '').trim() : current.placeholder,
    helpText: patch.helpText !== undefined ? String(patch.helpText || '').trim() : current.helpText,
    defaultValue: patch.defaultValue !== undefined ? String(patch.defaultValue || '') : current.defaultValue,
    options: patch.options !== undefined ? parseStringList(patch.options) : current.options,
    validation: patch.validation !== undefined ? parseObject(patch.validation) : current.validation,
    functionKeys: patch.functionKeys !== undefined ? parseStringList(patch.functionKeys) : current.functionKeys,
    isRequired: typeof patch.isRequired === 'boolean' ? patch.isRequired : current.isRequired,
    isActive: typeof patch.isActive === 'boolean' ? patch.isActive : current.isActive,
  };
  if (!next.key || !next.label || !next.module || !next.scope) {
    throw new Error('key, label, module, and scope are required.');
  }
  await prisma.$executeRawUnsafe(
    `UPDATE "DynamicFieldDefinition"
     SET
      "key" = $2,
      "label" = $3,
      "module" = $4,
      "scope" = $5,
      "dataType" = $6,
      "placeholder" = $7,
      "helpText" = $8,
      "defaultValue" = $9,
      "options" = $10::jsonb,
      "validation" = $11::jsonb,
      "functionKeys" = $12::jsonb,
      "isRequired" = $13,
      "isActive" = $14,
      "updatedAt" = CURRENT_TIMESTAMP
     WHERE "id" = $1`,
    String(id || ''),
    next.key,
    next.label,
    next.module,
    next.scope,
    next.dataType,
    next.placeholder,
    next.helpText,
    next.defaultValue,
    JSON.stringify(next.options || []),
    JSON.stringify(next.validation || {}),
    JSON.stringify(next.functionKeys || []),
    next.isRequired,
    next.isActive
  );
  const updatedRows = await prisma.$queryRawUnsafe<Array<any>>(
    `SELECT * FROM "DynamicFieldDefinition" WHERE "id" = $1 LIMIT 1`,
    String(id || '')
  );
  if (!Array.isArray(updatedRows) || updatedRows.length < 1) throw new Error('Failed to update dynamic field.');
  return mapDynamicFieldRow(updatedRows[0]);
};

export const deleteDynamicFieldDefinition = async (id: string) => {
  await ensureDynamicFieldDefinitionSchema();
  await prisma.$executeRawUnsafe(
    `DELETE FROM "DynamicFieldDefinition" WHERE "id" = $1`,
    String(id || '')
  );
};

