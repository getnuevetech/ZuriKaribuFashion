import { randomUUID } from 'crypto';
import { prisma } from '../db';

const FABRIC_COLOR_KEY_PREFIX = 'fabric_predominant_color:';
const DESIGN_COLOR_KEY_PREFIX = 'design_predominant_color:';
const READY_TO_WEAR_COLOR_KEY_PREFIX = 'ready_to_wear_predominant_color:';

const normalizeColorToken = (value: unknown) => String(value || '').trim().toUpperCase().slice(0, 40);

const parseJsonObject = (value: unknown): Record<string, unknown> => {
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

async function ensureHomepageSettingsSchema() {
  await prisma.$executeRawUnsafe(
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" JSONB NOT NULL DEFAULT '{}'::jsonb,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`
  );
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`
  );
}

const keyForFabricColor = (fabricId: string) => `${FABRIC_COLOR_KEY_PREFIX}${String(fabricId || '').trim()}`;
const keyForDesignColor = (designId: string) => `${DESIGN_COLOR_KEY_PREFIX}${String(designId || '').trim()}`;
const keyForReadyToWearColor = (productId: string) =>
  `${READY_TO_WEAR_COLOR_KEY_PREFIX}${String(productId || '').trim()}`;

async function writePredominantColorByKey(key: string, color: unknown) {
  await ensureHomepageSettingsSchema();
  const normalized = normalizeColorToken(color);
  if (!key || key.includes(':') === false) return;
  if (!normalized) {
    await prisma.$executeRawUnsafe(`DELETE FROM "HomepageSectionSetting" WHERE "key" = $1`, key);
    return;
  }
  const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT "id" FROM "HomepageSectionSetting" WHERE "key" = $1 LIMIT 1`,
    key
  );
  const payload = JSON.stringify({ color: normalized });
  if (existingRows[0]?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting" SET "value" = $1::jsonb, "updatedAt" = NOW() WHERE "id" = $2`,
      payload,
      String(existingRows[0].id)
    );
    return;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id","key","value","createdAt","updatedAt")
     VALUES ($1,$2,$3::jsonb,NOW(),NOW())`,
    randomUUID(),
    key,
    payload
  );
}

async function readPredominantColorMapByKeys(
  ids: string[],
  keyPrefix: string,
  keyResolver: (id: string) => string
) {
  await ensureHomepageSettingsSchema();
  const normalizedIds = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (normalizedIds.length === 0) return {} as Record<string, string>;
  const keys = normalizedIds.map((id) => keyResolver(id));
  const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: unknown }>>(
    `SELECT "key","value"
     FROM "HomepageSectionSetting"
     WHERE "key" = ANY($1::text[])`,
    keys
  );
  const result: Record<string, string> = {};
  for (const row of rows || []) {
    const key = String(row.key || '');
    if (!key.startsWith(keyPrefix)) continue;
    const entityId = key.slice(keyPrefix.length);
    const value = parseJsonObject(row.value);
    const color = normalizeColorToken(value.color);
    if (entityId && color) result[entityId] = color;
  }
  return result;
}

export async function writeFabricPredominantColor(fabricId: string, color: unknown) {
  const key = keyForFabricColor(fabricId);
  if (!key || !String(fabricId || '').trim()) return;
  await writePredominantColorByKey(key, color);
}

export async function readFabricPredominantColorMap(fabricIds: string[]) {
  return readPredominantColorMapByKeys(fabricIds, FABRIC_COLOR_KEY_PREFIX, keyForFabricColor);
}

export async function readFabricPredominantColor(fabricId: string) {
  const map = await readFabricPredominantColorMap([fabricId]);
  return map[String(fabricId || '').trim()] || null;
}

export async function writeDesignPredominantColor(designId: string, color: unknown) {
  const key = keyForDesignColor(designId);
  if (!key || !String(designId || '').trim()) return;
  await writePredominantColorByKey(key, color);
}

export async function readDesignPredominantColorMap(designIds: string[]) {
  return readPredominantColorMapByKeys(designIds, DESIGN_COLOR_KEY_PREFIX, keyForDesignColor);
}

export async function readDesignPredominantColor(designId: string) {
  const map = await readDesignPredominantColorMap([designId]);
  return map[String(designId || '').trim()] || null;
}

export async function writeReadyToWearPredominantColor(productId: string, color: unknown) {
  const key = keyForReadyToWearColor(productId);
  if (!key || !String(productId || '').trim()) return;
  await writePredominantColorByKey(key, color);
}

export async function readReadyToWearPredominantColorMap(productIds: string[]) {
  return readPredominantColorMapByKeys(productIds, READY_TO_WEAR_COLOR_KEY_PREFIX, keyForReadyToWearColor);
}

export async function readReadyToWearPredominantColor(productId: string) {
  const map = await readReadyToWearPredominantColorMap([productId]);
  return map[String(productId || '').trim()] || null;
}

