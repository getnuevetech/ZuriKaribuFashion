import { randomUUID } from 'crypto';
import { prisma } from '../db';

const FABRIC_COLOR_KEY_PREFIX = 'fabric_predominant_color:';

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

export async function writeFabricPredominantColor(fabricId: string, color: unknown) {
  await ensureHomepageSettingsSchema();
  const normalized = normalizeColorToken(color);
  const key = keyForFabricColor(fabricId);
  if (!key || !String(fabricId || '').trim()) return;
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

export async function readFabricPredominantColorMap(fabricIds: string[]) {
  await ensureHomepageSettingsSchema();
  const ids = Array.from(new Set((Array.isArray(fabricIds) ? fabricIds : []).map((id) => String(id || '').trim()).filter(Boolean)));
  if (ids.length === 0) return {} as Record<string, string>;
  const keys = ids.map((id) => keyForFabricColor(id));
  const rows = await prisma.$queryRawUnsafe<Array<{ key: string; value: unknown }>>(
    `SELECT "key","value"
     FROM "HomepageSectionSetting"
     WHERE "key" = ANY($1::text[])`,
    keys
  );
  const result: Record<string, string> = {};
  for (const row of rows || []) {
    const key = String(row.key || '');
    if (!key.startsWith(FABRIC_COLOR_KEY_PREFIX)) continue;
    const fabricId = key.slice(FABRIC_COLOR_KEY_PREFIX.length);
    const value = parseJsonObject(row.value);
    const color = normalizeColorToken(value.color);
    if (fabricId && color) result[fabricId] = color;
  }
  return result;
}

export async function readFabricPredominantColor(fabricId: string) {
  const map = await readFabricPredominantColorMap([fabricId]);
  return map[String(fabricId || '').trim()] || null;
}

