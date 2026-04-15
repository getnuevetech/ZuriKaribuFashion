import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { parseStoredJsonValue } from './parse-stored-json-value';

const DESIGNER_FABRIC_COUNTRY_ACCESS_SETTINGS_KEY = 'DESIGNER_FABRIC_COUNTRY_ACCESS_V1';
const DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_SETTINGS_KEY = 'DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_V1';
const REJECTED_REQUEST_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

const designerCountryAccessSettingsSchema = z.object({
  entries: z
    .array(
      z.object({
        designerUserId: z.string().uuid(),
        extraCountries: z.array(z.string()).default([]),
      })
    )
    .default([]),
});

export type DesignerFabricCountryAccessEntry = {
  designerUserId: string;
  extraCountries: string[];
};

export type DesignerFabricCountryAccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type DesignerFabricCountryAccessRequest = {
  id: string;
  designerUserId: string;
  requestedCountries: string[];
  reason: string;
  status: DesignerFabricCountryAccessRequestStatus;
  reviewNotes?: string;
  reviewedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
};

const designerCountryAccessRequestSchema = z.object({
  id: z.string().min(6),
  designerUserId: z.string().uuid(),
  requestedCountries: z.array(z.string()).default([]),
  reason: z.string().default(''),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  reviewNotes: z.string().optional(),
  reviewedByUserId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  resolvedAt: z.string().optional(),
});

const designerCountryAccessRequestsSettingsSchema = z.object({
  requests: z.array(designerCountryAccessRequestSchema).default([]),
});

const normalizeCountryToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeCountryName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');

const normalizeCountryList = (list: unknown, excludedCountry?: string) => {
  const rows = Array.isArray(list) ? list : [];
  const excludedToken = normalizeCountryToken(excludedCountry);
  const deduped = new Map<string, string>();
  for (const entry of rows) {
    const normalized = normalizeCountryName(entry);
    const token = normalizeCountryToken(normalized);
    if (!normalized || !token) continue;
    if (excludedToken && token === excludedToken) continue;
    if (!deduped.has(token)) deduped.set(token, normalized);
  }
  return Array.from(deduped.values());
};

const ensureHomepageSectionSettingTable = async () => {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
};

const normalizeSettingsPayload = (
  payload: unknown
): { entries: DesignerFabricCountryAccessEntry[] } => {
  const parsed = designerCountryAccessSettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return { entries: [] };
  }
  const entries = parsed.data.entries
    .map((entry) => ({
      designerUserId: String(entry.designerUserId),
      extraCountries: normalizeCountryList(entry.extraCountries),
    }))
    .filter((entry) => entry.extraCountries.length > 0);
  entries.sort((a, b) => a.designerUserId.localeCompare(b.designerUserId));
  return { entries };
};

export async function readDesignerFabricCountryAccessSettings() {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string }>>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    DESIGNER_FABRIC_COUNTRY_ACCESS_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { entries: [] as DesignerFabricCountryAccessEntry[] },
    };
  }
  try {
    const parsed = parseStoredJsonValue(row.value);
    return {
      rowId: String(row.id),
      settings: normalizeSettingsPayload(parsed),
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { entries: [] as DesignerFabricCountryAccessEntry[] },
    };
  }
}

const normalizeRequestPayload = (
  payload: unknown
): { requests: DesignerFabricCountryAccessRequest[] } => {
  const parsed = designerCountryAccessRequestsSettingsSchema.safeParse(payload);
  if (!parsed.success) return { requests: [] };
  const requests = parsed.data.requests
    .map((entry) => ({
      id: String(entry.id),
      designerUserId: String(entry.designerUserId),
      requestedCountries: normalizeCountryList(entry.requestedCountries),
      reason: String(entry.reason || '').trim(),
      status: entry.status,
      reviewNotes: entry.reviewNotes ? String(entry.reviewNotes).trim() : undefined,
      reviewedByUserId: entry.reviewedByUserId ? String(entry.reviewedByUserId).trim() : undefined,
      createdAt: String(entry.createdAt),
      updatedAt: String(entry.updatedAt),
      resolvedAt: entry.resolvedAt ? String(entry.resolvedAt) : undefined,
    }))
    .filter((entry) => entry.requestedCountries.length > 0 && entry.designerUserId.length > 0);
  requests.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return { requests };
};

async function readDesignerFabricCountryAccessRequestsSettings() {
  await ensureHomepageSectionSettingTable();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string }>>(
    `SELECT "id", "value"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { requests: [] as DesignerFabricCountryAccessRequest[] },
    };
  }
  try {
    const parsed = parseStoredJsonValue(row.value);
    return {
      rowId: String(row.id),
      settings: normalizeRequestPayload(parsed),
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { requests: [] as DesignerFabricCountryAccessRequest[] },
    };
  }
}

async function writeDesignerFabricCountryAccessRequestsSettings(
  requests: DesignerFabricCountryAccessRequest[]
) {
  const existing = await readDesignerFabricCountryAccessRequestsSettings();
  const next = normalizeRequestPayload({ requests });
  const payload = JSON.stringify(next);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      randomUUID(),
      DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_SETTINGS_KEY,
      payload
    );
  }
  return next.requests;
}

function isRejectedRequestExpired(request: DesignerFabricCountryAccessRequest) {
  if (request.status !== 'REJECTED') return false;
  const baseTime = new Date(request.resolvedAt || request.updatedAt || request.createdAt).getTime();
  if (!Number.isFinite(baseTime)) return false;
  return Date.now() - baseTime > REJECTED_REQUEST_RETENTION_MS;
}

async function readActiveDesignerFabricCountryAccessRequests() {
  const settings = await readDesignerFabricCountryAccessRequestsSettings();
  const activeRequests = settings.settings.requests.filter((request) => !isRejectedRequestExpired(request));
  if (activeRequests.length !== settings.settings.requests.length) {
    await writeDesignerFabricCountryAccessRequestsSettings(activeRequests);
  }
  return activeRequests;
}

export async function listDesignerFabricCountryAccessRequests(input?: {
  designerUserId?: string;
  status?: DesignerFabricCountryAccessRequestStatus;
}) {
  const requests = await readActiveDesignerFabricCountryAccessRequests();
  const designerUserId = String(input?.designerUserId || '').trim();
  const status = String(input?.status || '').trim().toUpperCase();
  return requests.filter((request) => {
    if (designerUserId && request.designerUserId !== designerUserId) return false;
    if (status && request.status !== status) return false;
    return true;
  });
}

export async function createDesignerFabricCountryAccessRequest(input: {
  designerUserId: string;
  requestedCountries: string[];
  reason?: string;
}) {
  const designerUserId = String(input.designerUserId || '').trim();
  if (!designerUserId) {
    throw new Error('Designer user ID is required.');
  }
  const requestedCountries = normalizeCountryList(input.requestedCountries);
  if (requestedCountries.length === 0) {
    throw new Error('At least one country is required.');
  }
  const nowIso = new Date().toISOString();
  const existingRequests = await readActiveDesignerFabricCountryAccessRequests();
  const request: DesignerFabricCountryAccessRequest = {
    id: randomUUID(),
    designerUserId,
    requestedCountries,
    reason: String(input.reason || '').trim(),
    status: 'PENDING',
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  await writeDesignerFabricCountryAccessRequestsSettings([request, ...existingRequests]);
  return request;
}

export async function reviewDesignerFabricCountryAccessRequest(input: {
  requestId: string;
  status: Exclude<DesignerFabricCountryAccessRequestStatus, 'PENDING'>;
  reviewedByUserId: string;
  reviewNotes?: string;
  grantedCountries?: string[];
}) {
  const requestId = String(input.requestId || '').trim();
  if (!requestId) throw new Error('Request ID is required.');
  const existingRequests = await readActiveDesignerFabricCountryAccessRequests();
  const index = existingRequests.findIndex((request) => request.id === requestId);
  if (index < 0) {
    throw new Error('Request not found.');
  }
  const nowIso = new Date().toISOString();
  const current = existingRequests[index];
  const next: DesignerFabricCountryAccessRequest = {
    ...current,
    status: input.status,
    reviewNotes: String(input.reviewNotes || '').trim() || undefined,
    reviewedByUserId: String(input.reviewedByUserId || '').trim() || undefined,
    updatedAt: nowIso,
    resolvedAt: nowIso,
  };
  const requests = [...existingRequests];
  requests[index] = next;
  await writeDesignerFabricCountryAccessRequestsSettings(requests);

  if (input.status === 'APPROVED') {
    const currentEntries = await listDesignerFabricCountryAccessMap();
    const existingExtras = currentEntries.get(next.designerUserId) || [];
    const grants =
      normalizeCountryList(input.grantedCountries).length > 0
        ? normalizeCountryList(input.grantedCountries)
        : next.requestedCountries;
    await writeDesignerFabricCountryAccessForDesigner(next.designerUserId, [...existingExtras, ...grants]);
  }

  return next;
}

export async function listDesignerFabricCountryAccessEntries() {
  const { settings } = await readDesignerFabricCountryAccessSettings();
  return settings.entries;
}

export async function listDesignerFabricCountryAccessMap() {
  const entries = await listDesignerFabricCountryAccessEntries();
  return new Map(entries.map((entry) => [entry.designerUserId, entry.extraCountries] as const));
}

export async function writeDesignerFabricCountryAccessForDesigner(
  designerUserId: string,
  extraCountries: string[]
) {
  const normalizedUserId = String(designerUserId || '').trim();
  if (!normalizedUserId) {
    throw new Error('Designer user ID is required.');
  }
  const existing = await readDesignerFabricCountryAccessSettings();
  const normalizedExtras = normalizeCountryList(extraCountries);
  const entryMap = new Map(existing.settings.entries.map((entry) => [entry.designerUserId, entry.extraCountries] as const));
  if (normalizedExtras.length > 0) {
    entryMap.set(normalizedUserId, normalizedExtras);
  } else {
    entryMap.delete(normalizedUserId);
  }
  const nextSettings = normalizeSettingsPayload({
    entries: Array.from(entryMap.entries()).map(([userId, countries]) => ({
      designerUserId: userId,
      extraCountries: countries,
    })),
  });
  const payload = JSON.stringify(nextSettings);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, NOW(), NOW())`,
      randomUUID(),
      DESIGNER_FABRIC_COUNTRY_ACCESS_SETTINGS_KEY,
      payload
    );
  }
  return {
    designerUserId: normalizedUserId,
    extraCountries: normalizedExtras,
  };
}

export async function getAllowedFabricCountriesForDesigner(input: {
  designerUserId: string;
  homeCountry: string;
}) {
  const homeCountry = normalizeCountryName(input.homeCountry);
  const accessMap = await listDesignerFabricCountryAccessMap();
  const extras = accessMap.get(String(input.designerUserId || '').trim()) || [];
  const deduped = new Map<string, string>();
  for (const value of [homeCountry, ...extras]) {
    const normalized = normalizeCountryName(value);
    const token = normalizeCountryToken(normalized);
    if (!normalized || !token) continue;
    if (!deduped.has(token)) deduped.set(token, normalized);
  }
  return Array.from(deduped.values());
}

export function isCountryAllowed(allowedCountries: string[], country: string) {
  const allowedTokens = new Set((allowedCountries || []).map((entry) => normalizeCountryToken(entry)));
  return allowedTokens.has(normalizeCountryToken(country));
}

