import { randomUUID } from 'crypto';
import { prisma } from '../db';

const DEFAULT_FABRIC_CATEGORY_NAME = 'General';
const DEFAULT_FABRIC_CATEGORY_SLUG = 'general';
const DEFAULT_MATERIAL_TYPE_NAME = 'General Material';
const DEFAULT_MATERIAL_TYPE_SLUG = 'general-material';

let productTaxonomySchemaEnsured = false;
let productTaxonomySchemaPromise: Promise<void> | null = null;

export async function ensureProductTaxonomySchema() {
  if (productTaxonomySchemaEnsured) return;
  if (!productTaxonomySchemaPromise) {
    productTaxonomySchemaPromise = (async () => {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "FabricCategory" (
          "id" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "slug" TEXT NOT NULL,
          "description" TEXT,
          "isActive" BOOLEAN NOT NULL DEFAULT true,
          "sortOrder" INTEGER NOT NULL DEFAULT 0,
          "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "FabricCategory_pkey" PRIMARY KEY ("id")
        )`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "FabricCategory_name_key" ON "FabricCategory"("name")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX IF NOT EXISTS "FabricCategory_slug_key" ON "FabricCategory"("slug")`
      );
      await prisma.$executeRawUnsafe(`ALTER TABLE "Fabric" ADD COLUMN IF NOT EXISTS "fabricCategoryId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ReadyToWear" ADD COLUMN IF NOT EXISTS "materialTypeId" TEXT`);
      await prisma.$executeRawUnsafe(`ALTER TABLE "ReadyToWear" ADD COLUMN IF NOT EXISTS "fabricCategoryId" TEXT`);
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "Fabric_fabricCategoryId_idx" ON "Fabric"("fabricCategoryId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ReadyToWear_materialTypeId_idx" ON "ReadyToWear"("materialTypeId")`
      );
      await prisma.$executeRawUnsafe(
        `CREATE INDEX IF NOT EXISTS "ReadyToWear_fabricCategoryId_idx" ON "ReadyToWear"("fabricCategoryId")`
      );

      const materialType =
        (await prisma.materialType.findFirst({
          where: { slug: DEFAULT_MATERIAL_TYPE_SLUG },
          select: { id: true },
        })) ||
        (await prisma.materialType.create({
          data: {
            id: randomUUID(),
            name: DEFAULT_MATERIAL_TYPE_NAME,
            slug: DEFAULT_MATERIAL_TYPE_SLUG,
            description: 'Default material type for backfilled ready-to-wear products.',
            isActive: true,
          },
          select: { id: true },
        }));

      const fabricCategory =
        (await prisma.fabricCategory.findFirst({
          where: { slug: DEFAULT_FABRIC_CATEGORY_SLUG },
          select: { id: true },
        })) ||
        (await prisma.fabricCategory.create({
          data: {
            id: randomUUID(),
            name: DEFAULT_FABRIC_CATEGORY_NAME,
            slug: DEFAULT_FABRIC_CATEGORY_SLUG,
            description: 'Default fabric category for backfilled catalog products.',
            isActive: true,
            sortOrder: 0,
          },
          select: { id: true },
        }));

      await prisma.$executeRawUnsafe(
        `UPDATE "Fabric"
         SET "fabricCategoryId" = $1
         WHERE "fabricCategoryId" IS NULL OR BTRIM("fabricCategoryId") = ''`,
        fabricCategory.id
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "ReadyToWear"
         SET "materialTypeId" = $1
         WHERE "materialTypeId" IS NULL OR BTRIM("materialTypeId") = ''`,
        materialType.id
      );
      await prisma.$executeRawUnsafe(
        `UPDATE "ReadyToWear"
         SET "fabricCategoryId" = $1
         WHERE "fabricCategoryId" IS NULL OR BTRIM("fabricCategoryId") = ''`,
        fabricCategory.id
      );

      productTaxonomySchemaEnsured = true;
    })();
  }
  try {
    await productTaxonomySchemaPromise;
  } finally {
    productTaxonomySchemaPromise = null;
  }
}
