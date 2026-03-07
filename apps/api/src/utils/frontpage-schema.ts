import { prisma } from '../db';

type SchemaKey = 'banners' | 'homepage' | 'homepageSections';

const ensuredSchemas = new Set<SchemaKey>();
const inFlightSchemas = new Map<SchemaKey, Promise<void>>();
const disabledSchemas = new Set<SchemaKey>();

function isPermissionDeniedError(error: any) {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  return code === '42501' || message.includes('permission denied');
}

async function runStatements(statements: string[]) {
  for (const statement of statements) {
    await prisma.$executeRawUnsafe(statement);
  }
}

async function ensureSchema(key: SchemaKey, statements: string[]) {
  if (ensuredSchemas.has(key) || disabledSchemas.has(key)) {
    return;
  }

  const existingTask = inFlightSchemas.get(key);
  if (existingTask) {
    await existingTask;
    return;
  }

  const task = (async () => {
    try {
      await runStatements(statements);
      ensuredSchemas.add(key);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        // In restricted production databases, app users may not have CREATE privileges.
        // Treat schema initialization as best-effort and continue using existing tables.
        disabledSchemas.add(key);
        return;
      }
      throw error;
    }
  })();

  inFlightSchemas.set(key, task);
  try {
    await task;
  } finally {
    inFlightSchemas.delete(key);
  }
}

export async function ensureBannerSchema() {
  await ensureSchema('banners', [
    `CREATE TABLE IF NOT EXISTS "Banner" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "section" TEXT NOT NULL,
      "title" TEXT,
      "subtitle" TEXT,
      "ctaText" TEXT,
      "ctaLink" TEXT,
      "images" TEXT[] NOT NULL DEFAULT '{}',
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE INDEX IF NOT EXISTS "Banner_section_idx" ON "Banner"("section")`,
    `CREATE INDEX IF NOT EXISTS "Banner_isActive_idx" ON "Banner"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "Banner_displayOrder_idx" ON "Banner"("displayOrder")`,
  ]);
}

export async function ensureHomepageSchema() {
  await ensureSchema('homepage', [
    `DO $$ BEGIN
      CREATE TYPE "FeaturedSection" AS ENUM (
        'FEATURED_DESIGNS',
        'FEATURED_FABRICS',
        'FEATURED_READY_TO_WEAR',
        'TRENDING_NOW',
        'NEW_ARRIVALS'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "HeroSlide" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subtitle" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "ctaText" TEXT,
      "ctaLink" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "FeaturedProduct" (
      "id" TEXT NOT NULL,
      "productId" TEXT NOT NULL,
      "productType" TEXT NOT NULL,
      "section" TEXT NOT NULL DEFAULT 'FEATURED_DESIGNS',
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "customTitle" TEXT,
      "customDescription" TEXT,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "FeaturedProduct_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'FeaturedProduct'
          AND column_name = 'productType'
          AND udt_name = 'text'
      ) THEN
        ALTER TABLE "FeaturedProduct"
        ALTER COLUMN "productType" TYPE "ProductType"
        USING ("productType"::"ProductType");
      END IF;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN invalid_text_representation THEN NULL;
      WHEN datatype_mismatch THEN NULL;
    END $$;`,
    `DO $$ BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'FeaturedProduct'
          AND column_name = 'section'
          AND udt_name = 'text'
      ) THEN
        ALTER TABLE "FeaturedProduct"
        ALTER COLUMN "section" TYPE "FeaturedSection"
        USING ("section"::"FeaturedSection");
      END IF;
    EXCEPTION
      WHEN undefined_table THEN NULL;
      WHEN undefined_object THEN NULL;
      WHEN invalid_text_representation THEN NULL;
      WHEN datatype_mismatch THEN NULL;
    END $$;`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "FeaturedProduct_productId_productType_section_key" ON "FeaturedProduct"("productId", "productType", "section")`,
    `CREATE INDEX IF NOT EXISTS "HeroSlide_isActive_idx" ON "HeroSlide"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "HeroSlide_displayOrder_idx" ON "HeroSlide"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "FeaturedProduct_section_idx" ON "FeaturedProduct"("section")`,
    `CREATE INDEX IF NOT EXISTS "FeaturedProduct_isActive_idx" ON "FeaturedProduct"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "FeaturedProduct_displayOrder_idx" ON "FeaturedProduct"("displayOrder")`,
  ]);
}

export async function ensureHomepageSectionsSchema() {
  await ensureSchema('homepageSections', [
    `CREATE TABLE IF NOT EXISTS "CountryMarquee" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "countryCode" TEXT,
      "flag" TEXT NOT NULL,
      "fabrics" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "keywords" TEXT,
      "linkType" TEXT NOT NULL DEFAULT 'DEFAULT',
      "storyId" TEXT,
      "externalUrl" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "CountryMarquee_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "HomepageSectionSetting" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "value" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageSectionSetting_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CountryMarquee'
          AND column_name = 'countryCode'
      ) THEN
        ALTER TABLE "CountryMarquee" ADD COLUMN "countryCode" TEXT;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CountryMarquee'
          AND column_name = 'keywords'
      ) THEN
        ALTER TABLE "CountryMarquee" ADD COLUMN "keywords" TEXT;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CountryMarquee'
          AND column_name = 'linkType'
      ) THEN
        ALTER TABLE "CountryMarquee" ADD COLUMN "linkType" TEXT NOT NULL DEFAULT 'DEFAULT';
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CountryMarquee'
          AND column_name = 'storyId'
      ) THEN
        ALTER TABLE "CountryMarquee" ADD COLUMN "storyId" TEXT;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'CountryMarquee'
          AND column_name = 'externalUrl'
      ) THEN
        ALTER TABLE "CountryMarquee" ADD COLUMN "externalUrl" TEXT;
      END IF;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "HowItWorksStep" (
      "id" TEXT NOT NULL,
      "stepNumber" INTEGER NOT NULL,
      "title" TEXT NOT NULL,
      "subtitle" TEXT NOT NULL,
      "icon" TEXT NOT NULL,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HowItWorksStep_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "ShopCategory" (
      "id" TEXT NOT NULL,
      "key" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "ctaText" TEXT NOT NULL,
      "ctaLink" TEXT NOT NULL,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "DesignerSpotlight" (
      "id" TEXT NOT NULL,
      "designerId" TEXT NOT NULL,
      "quote" TEXT NOT NULL,
      "bio" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "linkType" TEXT NOT NULL DEFAULT 'DEFAULT',
      "storyId" TEXT,
      "externalUrl" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "DesignerSpotlight_pkey" PRIMARY KEY ("id")
    )`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'DesignerSpotlight'
          AND column_name = 'linkType'
      ) THEN
        ALTER TABLE "DesignerSpotlight" ADD COLUMN "linkType" TEXT NOT NULL DEFAULT 'DEFAULT';
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'DesignerSpotlight'
          AND column_name = 'storyId'
      ) THEN
        ALTER TABLE "DesignerSpotlight" ADD COLUMN "storyId" TEXT;
      END IF;
    END $$;`,
    `DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'DesignerSpotlight'
          AND column_name = 'externalUrl'
      ) THEN
        ALTER TABLE "DesignerSpotlight" ADD COLUMN "externalUrl" TEXT;
      END IF;
    END $$;`,
    `CREATE TABLE IF NOT EXISTS "HomepageStory" (
      "id" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subtitle" TEXT,
      "countryCode" TEXT,
      "designerId" TEXT,
      "coverImage" TEXT,
      "contentHtml" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HomepageStory_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "HeritageSection" (
      "id" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "subtitle" TEXT NOT NULL,
      "image" TEXT NOT NULL,
      "ctaText" TEXT,
      "ctaLink" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "HeritageSection_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "Testimonial" (
      "id" TEXT NOT NULL,
      "name" TEXT NOT NULL,
      "initials" TEXT NOT NULL,
      "location" TEXT NOT NULL,
      "quote" TEXT NOT NULL,
      "avatar" TEXT,
      "displayOrder" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE TABLE IF NOT EXISTS "FooterContent" (
      "id" TEXT NOT NULL,
      "companyName" TEXT NOT NULL DEFAULT 'ZuriKaribu',
      "tagline" TEXT NOT NULL DEFAULT 'Wear the story of Africa.',
      "email" TEXT NOT NULL DEFAULT 'hello@zurikaribu.com',
      "phone" TEXT NOT NULL DEFAULT '+1 (555) 123-4567',
      "address" TEXT NOT NULL DEFAULT 'Lagos, Nigeria',
      "socialLinks" TEXT,
      "copyright" TEXT NOT NULL DEFAULT '© 2026 ZuriKaribu. All rights reserved.',
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "FooterContent_pkey" PRIMARY KEY ("id")
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HowItWorksStep_stepNumber_key" ON "HowItWorksStep"("stepNumber")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ShopCategory_key_key" ON "ShopCategory"("key")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageStory_slug_key" ON "HomepageStory"("slug")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "HomepageSectionSetting_key_key" ON "HomepageSectionSetting"("key")`,
    `CREATE INDEX IF NOT EXISTS "CountryMarquee_isActive_idx" ON "CountryMarquee"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "CountryMarquee_displayOrder_idx" ON "CountryMarquee"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "HowItWorksStep_isActive_idx" ON "HowItWorksStep"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "HowItWorksStep_displayOrder_idx" ON "HowItWorksStep"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "ShopCategory_isActive_idx" ON "ShopCategory"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "ShopCategory_displayOrder_idx" ON "ShopCategory"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "DesignerSpotlight_isActive_idx" ON "DesignerSpotlight"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "DesignerSpotlight_displayOrder_idx" ON "DesignerSpotlight"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "HomepageStory_type_isActive_idx" ON "HomepageStory"("type", "isActive")`,
    `CREATE INDEX IF NOT EXISTS "HomepageStory_displayOrder_idx" ON "HomepageStory"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "HeritageSection_isActive_idx" ON "HeritageSection"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "HeritageSection_displayOrder_idx" ON "HeritageSection"("displayOrder")`,
    `CREATE INDEX IF NOT EXISTS "Testimonial_isActive_idx" ON "Testimonial"("isActive")`,
    `CREATE INDEX IF NOT EXISTS "Testimonial_displayOrder_idx" ON "Testimonial"("displayOrder")`,
  ]);
}
