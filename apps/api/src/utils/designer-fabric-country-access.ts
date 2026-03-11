import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';

const DESIGNER_FABRIC_COUNTRY_ACCESS_SETTINGS_KEY = 'DESIGNER_FABRIC_COUNTRY_ACCESS_V1';

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
    const parsed = JSON.parse(String(row.value || '{}'));
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

