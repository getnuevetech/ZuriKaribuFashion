import { Router } from 'express';
import { createHash, randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, UserRole } from '../db';
import { authenticate, authorizePermissions, authorizeSuperAdmin } from '../middleware/auth';
import { Permissions } from '../rbac';
import { AFRICAN_CURRENCY_BASELINE } from '../constants/africanCurrencies';

const router = Router();

const HOMEPAGE_VISIBILITY_SETTINGS_KEY = 'HOMEPAGE_SECTION_VISIBILITY';
const HOMEPAGE_TOP_STRIP_SETTINGS_KEY = 'HOMEPAGE_TOP_STRIP';
const HOMEPAGE_STATS_STRIP_SETTINGS_KEY = 'HOMEPAGE_STATS_STRIP';
const HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY = 'HOMEPAGE_COUNTRY_IMAGE_GENERATION';
const HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY = 'HOMEPAGE_HOW_IT_WORKS_STYLE';
const HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY = 'HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION';
const HOMEPAGE_EXPERIENCE_SETTINGS_KEY = 'HOMEPAGE_EXPERIENCE_SETTINGS';
const AUTH_PAGE_SETTINGS_KEY = 'AUTH_PAGE_SETTINGS';
const DASHBOARD_CLOCK_WEATHER_SETTINGS_KEY = 'DASHBOARD_CLOCK_WEATHER_SETTINGS';
const HOMEPAGE_PROMO_BADGE_SETTINGS_KEY = 'HOMEPAGE_PROMO_BADGE';
const HOMEPAGE_SHOP_BY_BLOCKS_SETTINGS_KEY = 'HOMEPAGE_SHOP_BY_BLOCKS';
const HOMEPAGE_FRESH_DROPS_SETTINGS_KEY = 'HOMEPAGE_FRESH_DROPS';
const HOMEPAGE_NEWSLETTER_SETTINGS_KEY = 'HOMEPAGE_NEWSLETTER';
const HOMEPAGE_NAVIGATION_SETTINGS_KEY = 'HOMEPAGE_NAVIGATION_SETTINGS';
const HOMEPAGE_HERO_SETTINGS_KEY = 'HOMEPAGE_HERO_SETTINGS';
const PROMO_BADGE_DEFAULTS = {
  valueText: '50+',
  labelText: 'New Arrivals',
};
const HOMEPAGE_RUNTIME_AUDIT_ACTIONS = ['RUNTIME_SWITCH', 'RUNTIME_ROLLBACK'] as const;
const SPOTLIGHT_LINK_MODES = ['DEFAULT_STORE', 'CUSTOM_URL', 'BLOG'] as const;
type SpotlightLinkMode = (typeof SPOTLIGHT_LINK_MODES)[number];
const HOMEPAGE_EXPERIENCE_MODES = ['LITE_COMMERCE', 'STANDARD_PREMIUM', 'EDITORIAL_IMMERSIVE'] as const;
const HOMEPAGE_THEME_MODES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
const HOMEPAGE_TOKEN_SETS = ['GLOBAL_PREMIUM_DARK', 'GLOBAL_PREMIUM_LIGHT', 'AFRO_EDITORIAL'] as const;
const HOMEPAGE_HERO_VARIANTS = ['SPLIT_EDITORIAL', 'CLEAN_COMMERCE', 'VIDEO_STORY'] as const;
const HOMEPAGE_CATEGORY_ENTRY_VARIANTS = ['THREE_COLUMN_CORE', 'MEGA_GRID'] as const;
const HOMEPAGE_SPOTLIGHT_VARIANTS = ['CAROUSEL', 'SINGLE_FEATURE', 'MOSAIC'] as const;
const HOMEPAGE_TEMPLATES = ['LEGACY', 'JENKS'] as const;
const HOMEPAGE_ROLLOUT_MODES = ['LIVE', 'PREVIEW_SAFE'] as const;
const HOMEPAGE_TRUST_BADGE_ICONS = [
  'SHIELD_CHECK',
  'TRUCK',
  'REFRESH_CW',
  'HEADPHONES',
  'GLOBE',
  'SHOPPING_BAG',
] as const;
type HomepageRuntimeAuditAction = (typeof HOMEPAGE_RUNTIME_AUDIT_ACTIONS)[number];
const HOMEPAGE_SECTION_VISIBILITY_META = [
  { key: 'topStrip', label: 'Top Announcement Strip', description: 'Scrolling announcement bar above the hero banner.' },
  { key: 'hero', label: 'Hero Banner', description: 'Top hero carousel section.' },
  { key: 'statsStrip', label: 'Statistics Strip', description: 'Trust stats bar below the hero section.' },
  { key: 'countries', label: 'Country Strip', description: 'Country marquee cards below hero.' },
  { key: 'categories', label: 'Shop by Category', description: 'Category card grid section.' },
  { key: 'howItWorks', label: 'How It Works', description: 'Step-by-step process section.' },
  { key: 'featuredCustomToWear', label: 'Custom To Wear', description: 'Featured custom designs carousel.' },
  { key: 'featuredReadyToWear', label: 'Ready To Wear', description: 'Featured ready-to-wear carousel.' },
  { key: 'featuredFabrics', label: 'Fabrics To Buy', description: 'Featured fabrics carousel.' },
  { key: 'promoBanner', label: 'Fresh Drops Banner', description: 'Promo banner before designer spotlight.' },
  { key: 'designerSpotlight', label: 'Designer Spotlight', description: 'Designer spotlight cards section.' },
  { key: 'heritage', label: 'Heritage Story', description: 'Culture and heritage story section.' },
  { key: 'testimonials', label: 'Testimonials', description: 'Customer testimonials section.' },
  { key: 'cta', label: 'CTA + Newsletter', description: 'Final call-to-action and newsletter blocks.' },
] as const;
type HomepageVisibilityKey = (typeof HOMEPAGE_SECTION_VISIBILITY_META)[number]['key'];
type HomepageSectionVisibility = Record<HomepageVisibilityKey, boolean>;
const HOMEPAGE_SECTION_VISIBILITY_DEFAULTS = HOMEPAGE_SECTION_VISIBILITY_META.reduce(
  (acc, item) => ({ ...acc, [item.key]: true }),
  {} as HomepageSectionVisibility
);

let homepageSettingsSchemaEnsured = false;
let homepageSettingsSchemaPromise: Promise<void> | null = null;
const ensureHomepageSettingsSchema = async () => {
  if (homepageSettingsSchemaEnsured) return;
  if (homepageSettingsSchemaPromise) {
    await homepageSettingsSchemaPromise;
    return;
  }
  homepageSettingsSchemaPromise = (async () => {
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
    homepageSettingsSchemaEnsured = true;
  })();
  try {
    await homepageSettingsSchemaPromise;
  } finally {
    homepageSettingsSchemaPromise = null;
  }
};

let homepageRuntimeAuditSchemaEnsured = false;
let homepageRuntimeAuditSchemaPromise: Promise<void> | null = null;
const ensureHomepageRuntimeAuditSchema = async () => {
  if (homepageRuntimeAuditSchemaEnsured) return;
  if (homepageRuntimeAuditSchemaPromise) {
    await homepageRuntimeAuditSchemaPromise;
    return;
  }
  homepageRuntimeAuditSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "HomepageRuntimeAudit" (
        "id" TEXT NOT NULL,
        "action" TEXT NOT NULL,
        "reason" TEXT NOT NULL DEFAULT '',
        "previousValue" TEXT NOT NULL,
        "nextValue" TEXT NOT NULL,
        "healthSummary" TEXT,
        "metadata" TEXT,
        "performedByUserId" TEXT,
        "performedByEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HomepageRuntimeAudit_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "HomepageRuntimeAudit_createdAt_idx" ON "HomepageRuntimeAudit"("createdAt")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "HomepageRuntimeAudit_action_idx" ON "HomepageRuntimeAudit"("action")`
    );
    homepageRuntimeAuditSchemaEnsured = true;
  })();
  try {
    await homepageRuntimeAuditSchemaPromise;
  } finally {
    homepageRuntimeAuditSchemaPromise = null;
  }
};

let spotlightLinkSchemaEnsured = false;
let spotlightLinkSchemaPromise: Promise<void> | null = null;
const ensureSpotlightLinkSchema = async () => {
  if (spotlightLinkSchemaEnsured) return;
  if (spotlightLinkSchemaPromise) {
    await spotlightLinkSchemaPromise;
    return;
  }
  spotlightLinkSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "DesignerSpotlightLink" (
        "id" TEXT NOT NULL,
        "spotlightId" TEXT NOT NULL,
        "linkMode" TEXT NOT NULL DEFAULT 'DEFAULT_STORE',
        "externalUrl" TEXT,
        "blogPostId" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "DesignerSpotlightLink_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "DesignerSpotlightLink_spotlightId_key" ON "DesignerSpotlightLink"("spotlightId")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "DesignerSpotlightLink_blogPostId_idx" ON "DesignerSpotlightLink"("blogPostId")`
    );
    spotlightLinkSchemaEnsured = true;
  })();
  try {
    await spotlightLinkSchemaPromise;
  } finally {
    spotlightLinkSchemaPromise = null;
  }
};

let blogSchemaEnsured = false;
let blogSchemaPromise: Promise<void> | null = null;
const ensureBlogSchema = async () => {
  if (blogSchemaEnsured) return;
  if (blogSchemaPromise) {
    await blogSchemaPromise;
    return;
  }
  blogSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "BlogPost" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "slug" TEXT NOT NULL,
        "excerpt" TEXT,
        "content" TEXT NOT NULL,
        "audienceType" TEXT NOT NULL,
        "targetName" TEXT,
        "targetEntityId" TEXT,
        "coverImage" TEXT,
        "isPublished" BOOLEAN NOT NULL DEFAULT false,
        "publishedAt" TIMESTAMP(3),
        "createdBy" TEXT,
        "updatedBy" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        CONSTRAINT "BlogPost_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "BlogPost_slug_key" ON "BlogPost"("slug")`);
    blogSchemaEnsured = true;
  })();
  try {
    await blogSchemaPromise;
  } finally {
    blogSchemaPromise = null;
  }
};

let homepageSectionContentSchemaEnsured = false;
let homepageSectionContentSchemaPromise: Promise<void> | null = null;
const ensureHomepageSectionContentSchema = async () => {
  if (homepageSectionContentSchemaEnsured) return;
  if (homepageSectionContentSchemaPromise) {
    await homepageSectionContentSchemaPromise;
    return;
  }
  homepageSectionContentSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "CountryMarquee" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL DEFAULT '',
        "flag" TEXT NOT NULL DEFAULT '',
        "fabrics" TEXT NOT NULL DEFAULT '',
        "image" TEXT NOT NULL DEFAULT '',
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "CountryMarquee_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "name" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "flag" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "fabrics" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "image" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`UPDATE "CountryMarquee" SET "name" = COALESCE(NULLIF(TRIM("name"), ''), 'Unknown')`);
    await prisma.$executeRawUnsafe(`UPDATE "CountryMarquee" SET "flag" = COALESCE(NULLIF(TRIM("flag"), ''), '🌍')`);
    await prisma.$executeRawUnsafe(`UPDATE "CountryMarquee" SET "fabrics" = COALESCE(NULLIF(TRIM("fabrics"), ''), 'African textiles')`);
    await prisma.$executeRawUnsafe(`UPDATE "CountryMarquee" SET "image" = COALESCE(NULLIF(TRIM("image"), ''), '/placeholder.jpg')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ALTER COLUMN "name" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ALTER COLUMN "flag" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ALTER COLUMN "fabrics" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "CountryMarquee" ALTER COLUMN "image" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CountryMarquee_isActive_idx" ON "CountryMarquee"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CountryMarquee_displayOrder_idx" ON "CountryMarquee"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "HowItWorksStep" (
        "id" TEXT NOT NULL,
        "stepNumber" INTEGER NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "subtitle" TEXT NOT NULL DEFAULT '',
        "icon" TEXT NOT NULL DEFAULT 'Sparkles',
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HowItWorksStep_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "stepNumber" INTEGER`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "title" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "subtitle" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "icon" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`UPDATE "HowItWorksStep" SET "stepNumber" = COALESCE("stepNumber", 1)`);
    await prisma.$executeRawUnsafe(`UPDATE "HowItWorksStep" SET "title" = COALESCE(NULLIF(TRIM("title"), ''), 'Step')`);
    await prisma.$executeRawUnsafe(`UPDATE "HowItWorksStep" SET "subtitle" = COALESCE(NULLIF(TRIM("subtitle"), ''), 'Describe this step')`);
    await prisma.$executeRawUnsafe(`UPDATE "HowItWorksStep" SET "icon" = COALESCE(NULLIF(TRIM("icon"), ''), 'Sparkles')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ALTER COLUMN "stepNumber" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ALTER COLUMN "title" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ALTER COLUMN "subtitle" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HowItWorksStep" ALTER COLUMN "icon" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HowItWorksStep_stepNumber_idx" ON "HowItWorksStep"("stepNumber")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HowItWorksStep_isActive_idx" ON "HowItWorksStep"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HowItWorksStep_displayOrder_idx" ON "HowItWorksStep"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "ShopCategory" (
        "id" TEXT NOT NULL,
        "key" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "description" TEXT NOT NULL DEFAULT '',
        "image" TEXT NOT NULL DEFAULT '',
        "ctaText" TEXT NOT NULL DEFAULT 'Shop Now',
        "ctaLink" TEXT NOT NULL DEFAULT '#',
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ShopCategory_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "key" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "title" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "description" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "image" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "ctaText" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "ctaLink" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "key" = COALESCE(NULLIF(TRIM("key"), ''), CONCAT('category-', LEFT("id", 8)))`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "title" = COALESCE(NULLIF(TRIM("title"), ''), 'Category')`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "description" = COALESCE(NULLIF(TRIM("description"), ''), 'Category description')`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "image" = COALESCE(NULLIF(TRIM("image"), ''), '/placeholder.jpg')`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "ctaText" = COALESCE(NULLIF(TRIM("ctaText"), ''), 'Shop Now')`);
    await prisma.$executeRawUnsafe(`UPDATE "ShopCategory" SET "ctaLink" = COALESCE(NULLIF(TRIM("ctaLink"), ''), '#')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "key" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "title" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "description" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "image" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "ctaText" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "ShopCategory" ALTER COLUMN "ctaLink" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopCategory_key_idx" ON "ShopCategory"("key")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopCategory_isActive_idx" ON "ShopCategory"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ShopCategory_displayOrder_idx" ON "ShopCategory"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "DesignerSpotlight" (
        "id" TEXT NOT NULL,
        "designerId" TEXT NOT NULL DEFAULT '',
        "quote" TEXT NOT NULL DEFAULT '',
        "bio" TEXT NOT NULL DEFAULT '',
        "image" TEXT NOT NULL DEFAULT '',
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "DesignerSpotlight_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "designerId" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "quote" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "bio" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "image" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(
      `UPDATE "DesignerSpotlight"
       SET "designerId" = COALESCE(NULLIF(TRIM("designerId"), ''), '00000000-0000-0000-0000-000000000000')`
    );
    await prisma.$executeRawUnsafe(`UPDATE "DesignerSpotlight" SET "quote" = COALESCE(NULLIF(TRIM("quote"), ''), 'Designer quote')`);
    await prisma.$executeRawUnsafe(`UPDATE "DesignerSpotlight" SET "bio" = COALESCE(NULLIF(TRIM("bio"), ''), 'Designer biography')`);
    await prisma.$executeRawUnsafe(`UPDATE "DesignerSpotlight" SET "image" = COALESCE(NULLIF(TRIM("image"), ''), '/placeholder.jpg')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ALTER COLUMN "designerId" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ALTER COLUMN "quote" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ALTER COLUMN "bio" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "DesignerSpotlight" ALTER COLUMN "image" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DesignerSpotlight_isActive_idx" ON "DesignerSpotlight"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "DesignerSpotlight_displayOrder_idx" ON "DesignerSpotlight"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "HeritageSection" (
        "id" TEXT NOT NULL,
        "title" TEXT NOT NULL DEFAULT '',
        "subtitle" TEXT NOT NULL DEFAULT '',
        "image" TEXT NOT NULL DEFAULT '',
        "ctaText" TEXT,
        "ctaLink" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "HeritageSection_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "title" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "subtitle" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "image" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "ctaText" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "ctaLink" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`UPDATE "HeritageSection" SET "title" = COALESCE(NULLIF(TRIM("title"), ''), 'Heritage')`);
    await prisma.$executeRawUnsafe(`UPDATE "HeritageSection" SET "subtitle" = COALESCE(NULLIF(TRIM("subtitle"), ''), 'Our story')`);
    await prisma.$executeRawUnsafe(`UPDATE "HeritageSection" SET "image" = COALESCE(NULLIF(TRIM("image"), ''), '/placeholder.jpg')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ALTER COLUMN "title" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ALTER COLUMN "subtitle" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "HeritageSection" ALTER COLUMN "image" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HeritageSection_isActive_idx" ON "HeritageSection"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "HeritageSection_displayOrder_idx" ON "HeritageSection"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "Testimonial" (
        "id" TEXT NOT NULL,
        "name" TEXT NOT NULL DEFAULT '',
        "initials" TEXT NOT NULL DEFAULT '',
        "location" TEXT NOT NULL DEFAULT '',
        "quote" TEXT NOT NULL DEFAULT '',
        "avatar" TEXT,
        "displayOrder" INTEGER NOT NULL DEFAULT 0,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "name" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "initials" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "location" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "quote" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "avatar" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    await prisma.$executeRawUnsafe(`UPDATE "Testimonial" SET "name" = COALESCE(NULLIF(TRIM("name"), ''), 'Customer')`);
    await prisma.$executeRawUnsafe(`UPDATE "Testimonial" SET "initials" = COALESCE(NULLIF(TRIM("initials"), ''), 'CU')`);
    await prisma.$executeRawUnsafe(`UPDATE "Testimonial" SET "location" = COALESCE(NULLIF(TRIM("location"), ''), 'Africa')`);
    await prisma.$executeRawUnsafe(`UPDATE "Testimonial" SET "quote" = COALESCE(NULLIF(TRIM("quote"), ''), 'Great experience.')`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ALTER COLUMN "name" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ALTER COLUMN "initials" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ALTER COLUMN "location" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Testimonial" ALTER COLUMN "quote" SET NOT NULL`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Testimonial_isActive_idx" ON "Testimonial"("isActive")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Testimonial_displayOrder_idx" ON "Testimonial"("displayOrder")`);

    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "FooterContent" (
        "id" TEXT NOT NULL,
        "companyName" TEXT NOT NULL DEFAULT 'AfriFashion',
        "tagline" TEXT NOT NULL DEFAULT 'Wear the story of Africa.',
        "email" TEXT NOT NULL DEFAULT 'hello@afrifashion.com',
        "phone" TEXT NOT NULL DEFAULT '+1 (555) 123-4567',
        "address" TEXT NOT NULL DEFAULT 'Lagos, Nigeria',
        "socialLinks" TEXT,
        "copyright" TEXT NOT NULL DEFAULT '© 2026 AfriFashion. All rights reserved.',
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "FooterContent_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "companyName" TEXT NOT NULL DEFAULT 'AfriFashion'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "tagline" TEXT NOT NULL DEFAULT 'Wear the story of Africa.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL DEFAULT 'hello@afrifashion.com'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "phone" TEXT NOT NULL DEFAULT '+1 (555) 123-4567'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT 'Lagos, Nigeria'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "socialLinks" TEXT`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "copyright" TEXT NOT NULL DEFAULT '© 2026 AfriFashion. All rights reserved.'`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "FooterContent" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`);

    homepageSectionContentSchemaEnsured = true;
  })();
  try {
    await homepageSectionContentSchemaPromise;
  } finally {
    homepageSectionContentSchemaPromise = null;
  }
};

let newsletterSubscriptionSchemaEnsured = false;
let newsletterSubscriptionSchemaPromise: Promise<void> | null = null;
const ensureNewsletterSubscriptionSchema = async () => {
  if (newsletterSubscriptionSchemaEnsured) return;
  if (newsletterSubscriptionSchemaPromise) {
    await newsletterSubscriptionSchemaPromise;
    return;
  }
  newsletterSubscriptionSchemaPromise = (async () => {
    await prisma.$executeRawUnsafe(
      `CREATE TABLE IF NOT EXISTS "NewsletterSubscription" (
        "id" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "source" TEXT NOT NULL DEFAULT 'HOMEPAGE',
        "metadata" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "NewsletterSubscription_pkey" PRIMARY KEY ("id")
      )`
    );
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "NewsletterSubscription_email_key" ON "NewsletterSubscription"("email")`
    );
    await prisma.$executeRawUnsafe(
      `CREATE INDEX IF NOT EXISTS "NewsletterSubscription_createdAt_idx" ON "NewsletterSubscription"("createdAt")`
    );
    newsletterSubscriptionSchemaEnsured = true;
  })();
  try {
    await newsletterSubscriptionSchemaPromise;
  } finally {
    newsletterSubscriptionSchemaPromise = null;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureHomepageSettingsSchema();
    await ensureHomepageRuntimeAuditSchema();
    await ensureSpotlightLinkSchema();
    await ensureBlogSchema();
    await ensureHomepageSectionContentSchema();
    await ensureNewsletterSubscriptionSchema();
  } catch (error) {
    console.error('Failed to ensure homepage settings schema:', error);
  }
  next();
});

const getString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  return undefined;
};

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const countryCodeToFlag = (countryCode: string) =>
  String(countryCode || '')
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

const AFRICAN_COUNTRY_REFERENCE: Array<{ code: string; name: string }> = [
  { code: 'DZ', name: 'Algeria' },
  { code: 'AO', name: 'Angola' },
  { code: 'BJ', name: 'Benin' },
  { code: 'BW', name: 'Botswana' },
  { code: 'BF', name: 'Burkina Faso' },
  { code: 'BI', name: 'Burundi' },
  { code: 'CV', name: 'Cabo Verde' },
  { code: 'CM', name: 'Cameroon' },
  { code: 'CF', name: 'Central African Republic' },
  { code: 'TD', name: 'Chad' },
  { code: 'KM', name: 'Comoros' },
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'Democratic Republic of the Congo' },
  { code: 'CI', name: "Cote d'Ivoire" },
  { code: 'DJ', name: 'Djibouti' },
  { code: 'EG', name: 'Egypt' },
  { code: 'GQ', name: 'Equatorial Guinea' },
  { code: 'ER', name: 'Eritrea' },
  { code: 'SZ', name: 'Eswatini' },
  { code: 'ET', name: 'Ethiopia' },
  { code: 'GA', name: 'Gabon' },
  { code: 'GM', name: 'Gambia' },
  { code: 'GH', name: 'Ghana' },
  { code: 'GN', name: 'Guinea' },
  { code: 'GW', name: 'Guinea-Bissau' },
  { code: 'KE', name: 'Kenya' },
  { code: 'LS', name: 'Lesotho' },
  { code: 'LR', name: 'Liberia' },
  { code: 'LY', name: 'Libya' },
  { code: 'MG', name: 'Madagascar' },
  { code: 'MW', name: 'Malawi' },
  { code: 'ML', name: 'Mali' },
  { code: 'MR', name: 'Mauritania' },
  { code: 'MU', name: 'Mauritius' },
  { code: 'MA', name: 'Morocco' },
  { code: 'MZ', name: 'Mozambique' },
  { code: 'NA', name: 'Namibia' },
  { code: 'NE', name: 'Niger' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'RW', name: 'Rwanda' },
  { code: 'ST', name: 'Sao Tome and Principe' },
  { code: 'SN', name: 'Senegal' },
  { code: 'SC', name: 'Seychelles' },
  { code: 'SL', name: 'Sierra Leone' },
  { code: 'SO', name: 'Somalia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'SS', name: 'South Sudan' },
  { code: 'SD', name: 'Sudan' },
  { code: 'TZ', name: 'Tanzania' },
  { code: 'TG', name: 'Togo' },
  { code: 'TN', name: 'Tunisia' },
  { code: 'UG', name: 'Uganda' },
  { code: 'EH', name: 'Western Sahara' },
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
];

const baselineCountryNameByCode = new Map(
  AFRICAN_CURRENCY_BASELINE.map((row) => [row.countryCode.toUpperCase(), row.country])
);

const AFRICAN_COUNTRY_OPTIONS = Array.from(
  new Map(
    [...AFRICAN_COUNTRY_REFERENCE, ...AFRICAN_CURRENCY_BASELINE.map((row) => ({ code: row.countryCode, name: row.country }))].map(
      (row) => {
        const code = String(row.code || '').toUpperCase();
        const name = baselineCountryNameByCode.get(code) || row.name;
        return [
          code,
          {
            code,
            name,
            flag: countryCodeToFlag(code),
          },
        ];
      }
    )
  ).values()
).sort((a, b) => a.name.localeCompare(b.name));

const AFRICAN_COUNTRY_OPTION_BY_CODE = new Map(
  AFRICAN_COUNTRY_OPTIONS.map((option) => [option.code.toUpperCase(), option])
);

const countryCreateSchema = z.object({
  countryCode: z.string().trim().min(2).max(3).optional(),
  name: z.string().trim().min(1),
  flag: z.string().trim().min(1).optional(),
  fabrics: z.string().trim().optional(),
  image: z.string().trim().optional(),
  imageKeyword: z.string().trim().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const countryUpdateSchema = countryCreateSchema.partial();
const countryImageGenerateSchema = z
  .object({
    countryCode: z.string().trim().min(2).max(3).optional(),
    country: z.string().trim().optional(),
    fabrics: z.string().trim().optional(),
    imageKeyword: z.string().trim().optional(),
  })
  .refine((data) => Boolean(getString(data.countryCode) || getString(data.country)), {
    message: 'Country code or country name is required.',
    path: ['countryCode'],
  });

const normalizeCountryInput = (input: any) => {
  const countryCode = String(input?.countryCode || '').trim().toUpperCase();
  const selectedByCode = countryCode ? AFRICAN_COUNTRY_OPTION_BY_CODE.get(countryCode) : undefined;
  const selectedByName = AFRICAN_COUNTRY_OPTIONS.find(
    (option) => option.name.toLowerCase() === String(input?.name || '').trim().toLowerCase()
  );
  const selected = selectedByCode || selectedByName;
  return {
    ...input,
    countryCode: selected?.code || countryCode || undefined,
    name: selected?.name || getString(input?.name) || input?.name,
    flag: selected?.flag || getString(input?.flag) || undefined,
    fabrics: getString(input?.fabrics) || undefined,
    image: getString(input?.image) || undefined,
    imageKeyword: getString(input?.imageKeyword) || undefined,
    displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
    isActive: getBoolean(input?.isActive) ?? input?.isActive,
  };
};

const howItWorksCreateSchema = z.object({
  stepNumber: z.number().int().positive(),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  icon: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const normalizeHowItWorksInput = (input: any) => ({
  ...input,
  stepNumber: getNumber(input?.stepNumber) ?? input?.stepNumber,
  title: getString(input?.title) ?? input?.title,
  subtitle: getString(input?.subtitle) ?? getString(input?.description) ?? input?.subtitle,
  icon: getString(input?.icon) ?? 'Sparkles',
  displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
  isActive: getBoolean(input?.isActive) ?? input?.isActive,
});
const howItWorksUpdateSchema = howItWorksCreateSchema.partial();

const shopCategoryCreateSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  image: z.string().min(1),
  ctaText: z.string().min(1),
  ctaLink: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const normalizeCategoryInput = (input: any) => {
  const title = getString(input?.title) ?? '';
  const key = getString(input?.key) ?? (title ? slugify(title) : undefined);
  return {
    ...input,
    key: key ?? input?.key,
    title: title || input?.title,
    description: getString(input?.description) ?? getString(input?.subtitle) ?? input?.description,
    image: getString(input?.image) ?? input?.image,
    ctaText: getString(input?.ctaText) ?? 'Shop Now',
    ctaLink: getString(input?.ctaLink) ?? getString(input?.link) ?? input?.ctaLink,
    displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
    isActive: getBoolean(input?.isActive) ?? input?.isActive,
  };
};
const shopCategoryUpdateSchema = shopCategoryCreateSchema.partial();

const designerSpotlightBaseSchema = z.object({
  designerId: z.string().uuid(),
  quote: z.string().min(1),
  bio: z.string().min(1),
  image: z.string().min(1),
  linkMode: z.enum(SPOTLIGHT_LINK_MODES).optional(),
  externalUrl: z.preprocess((value) => getString(value), z.string().url().optional()),
  blogPostId: z.preprocess((value) => getString(value), z.string().uuid().optional()),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

const validateDesignerSpotlightLinkInputs = (value: any, ctx: z.RefinementCtx) => {
  const linkMode = value.linkMode || 'DEFAULT_STORE';
  if (linkMode === 'CUSTOM_URL' && !value.externalUrl) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'externalUrl is required when linkMode is CUSTOM_URL.',
      path: ['externalUrl'],
    });
  }
  if (linkMode === 'BLOG' && !value.blogPostId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'blogPostId is required when linkMode is BLOG.',
      path: ['blogPostId'],
    });
  }
};

const designerSpotlightCreateSchema = designerSpotlightBaseSchema.superRefine(validateDesignerSpotlightLinkInputs);
const normalizeDesignerSpotlightInput = (input: any) => ({
  ...input,
  designerId: getString(input?.designerId) ?? input?.designerId,
  quote: getString(input?.quote) ?? getString(input?.headline) ?? input?.quote,
  bio: getString(input?.bio) ?? getString(input?.description) ?? input?.bio,
  image: getString(input?.image) ?? input?.image,
  linkMode: getString(input?.linkMode)?.toUpperCase() ?? input?.linkMode,
  externalUrl: getString(input?.externalUrl) ?? getString(input?.ctaLink) ?? input?.externalUrl,
  blogPostId: getString(input?.blogPostId) ?? input?.blogPostId,
  displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
  isActive: getBoolean(input?.isActive) ?? input?.isActive,
});
const designerSpotlightUpdateSchema = designerSpotlightBaseSchema.partial().superRefine(validateDesignerSpotlightLinkInputs);

const heritageCreateSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  image: z.string().min(1),
  ctaText: z.string().optional(),
  ctaLink: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const normalizeHeritageInput = (input: any) => ({
  ...input,
  title: getString(input?.title) ?? input?.title,
  subtitle: getString(input?.subtitle) ?? getString(input?.description) ?? input?.subtitle,
  image: getString(input?.image) ?? input?.image,
  ctaText: getString(input?.ctaText) ?? input?.ctaText,
  ctaLink: getString(input?.ctaLink) ?? input?.ctaLink,
  displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
  isActive: getBoolean(input?.isActive) ?? input?.isActive,
});
const heritageUpdateSchema = heritageCreateSchema.partial();

const testimonialCreateSchema = z.object({
  name: z.string().min(1),
  initials: z.string().min(1),
  location: z.string().min(1),
  quote: z.string().min(1),
  avatar: z.string().optional(),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const deriveInitials = (name?: string) =>
  (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'NA';

const normalizeTestimonialInput = (input: any) => {
  const name = getString(input?.name) ?? input?.name;
  return {
    ...input,
    name,
    initials: getString(input?.initials) ?? deriveInitials(name),
    location: getString(input?.location) ?? input?.location,
    quote: getString(input?.quote) ?? getString(input?.text) ?? input?.quote,
    avatar: getString(input?.avatar) ?? input?.avatar,
    displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
    isActive: getBoolean(input?.isActive) ?? input?.isActive,
  };
};
const testimonialUpdateSchema = testimonialCreateSchema.partial();

const footerCreateSchema = z.object({
  companyName: z.string().optional(),
  tagline: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  socialLinks: z.string().optional(),
  copyright: z.string().optional(),
});
const normalizeFooterInput = (input: any) => {
  const rawSocialLinks = input?.socialLinks;
  let socialLinks: string | undefined;
  if (typeof rawSocialLinks === 'string') {
    socialLinks = rawSocialLinks;
  } else if (rawSocialLinks && typeof rawSocialLinks === 'object') {
    socialLinks = JSON.stringify(rawSocialLinks);
  }
  return {
    companyName: getString(input?.companyName),
    tagline: getString(input?.tagline),
    email: getString(input?.email),
    phone: getString(input?.phone),
    address: getString(input?.address),
    socialLinks,
    copyright: getString(input?.copyright),
  };
};
const footerUpdateSchema = footerCreateSchema;
const homepageVisibilityUpdateSchema = z.object({
  visibility: z.record(z.boolean()),
});
const topStripUpdateSchema = z.object({
  messages: z.array(z.string().min(1)).min(1),
  separator: z.string().trim().min(1).max(8).optional(),
  repeatCount: z.number().int().min(2).max(12).optional(),
  animationSeconds: z.number().int().min(8).max(120).optional(),
  fontSize: z.number().int().min(10).max(40).optional(),
  isBold: z.boolean().optional(),
  pauseOnHover: z.boolean().optional(),
  textColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const statsStripItemUpdateSchema = z.object({
  value: z.string().trim().min(1).max(20),
  suffix: z.string().trim().max(8).optional(),
  label: z.string().trim().min(1).max(40),
  displayOrder: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});
const statsStripUpdateSchema = z.object({
  items: z.array(statsStripItemUpdateSchema).min(1).max(8),
  backgroundImage: z.string().trim().optional(),
  backgroundColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  overlayColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  overlayOpacity: z.number().int().min(0).max(100).optional(),
  valueColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  suffixColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  labelColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const featuredProductDescriptionUpdateSchema = z.object({
  wordLimit: z.number().int().min(5).max(60),
});

const howItWorksStyleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  iconColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  iconHoverColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
});
const shopByOptionUpdateSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(260),
});
const shopByBlocksUpdateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  subtitle: z.string().trim().min(1).max(240).optional(),
  styleOptions: z.array(shopByOptionUpdateSchema).max(8).optional(),
  priceOptions: z.array(shopByOptionUpdateSchema).max(8).optional(),
  enabledTabs: z
    .array(z.enum(['CATEGORY', 'COUNTRY', 'OCCASION_STYLE', 'PRICE']))
    .min(1)
    .max(4)
    .optional(),
  defaultTab: z.enum(['CATEGORY', 'COUNTRY', 'OCCASION_STYLE', 'PRICE']).optional(),
});
const freshDropsSettingsUpdateSchema = z.object({
  eyebrow: z.string().trim().min(1).max(40).optional(),
  title: z.string().trim().min(1).max(180).optional(),
  subtitle: z.string().trim().min(1).max(260).optional(),
  ctaText: z.string().trim().min(1).max(60).optional(),
  ctaLink: z.string().trim().min(1).max(260).optional(),
  badgeValueText: z.string().trim().min(1).max(20).optional(),
  badgeLabelText: z.string().trim().min(1).max(80).optional(),
  showBadge: z.boolean().optional(),
});
const newsletterSettingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().trim().min(1).max(120).optional(),
  subtitle: z.string().trim().min(1).max(260).optional(),
  emailPlaceholder: z.string().trim().min(1).max(120).optional(),
  submitLabel: z.string().trim().min(1).max(60).optional(),
  successMessage: z.string().trim().min(1).max(200).optional(),
  duplicateMessage: z.string().trim().min(1).max(200).optional(),
});
const navigationMenuLinkUpdateSchema = z.object({
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(260),
  enabled: z.boolean().default(true),
});
const navigationSettingsUpdateSchema = z.object({
  logoMode: z.enum(['TEXT', 'IMAGE']).optional(),
  logoText: z.string().trim().min(1).max(80).optional(),
  logoImageUrl: z.string().trim().max(2000).optional(),
  logoAltText: z.string().trim().max(120).optional(),
  logoWidth: z.number().int().min(40).max(600).optional(),
  logoHeight: z.number().int().min(20).max(300).optional(),
  leftMenuLinks: z.array(navigationMenuLinkUpdateSchema).max(10).optional(),
  rightMenuLinks: z.array(navigationMenuLinkUpdateSchema).max(10).optional(),
  hamburgerMenuLinks: z.array(navigationMenuLinkUpdateSchema).max(20).optional(),
  showHamburger: z.boolean().optional(),
  showSearchIcon: z.boolean().optional(),
  showCartIcon: z.boolean().optional(),
  showProfileIcon: z.boolean().optional(),
  showCurrencySelector: z.boolean().optional(),
  showExperienceModeSelector: z.boolean().optional(),
  showThemeModeSelector: z.boolean().optional(),
});
const heroQuickLinkUpdateSchema = z.object({
  label: z.string().trim().min(1).max(32),
  href: z.string().trim().min(1).max(260),
});
const heroSettingsUpdateSchema = z.object({
  rotationSeconds: z.number().int().min(3).max(20).optional(),
  forceUppercaseCtas: z.boolean().optional(),
  ctaTarget: z.enum(['SAME_TAB', 'NEW_TAB']).optional(),
  showQuickLinks: z.boolean().optional(),
  quickLinks: z.array(heroQuickLinkUpdateSchema).max(8).optional(),
});
const newsletterSubscribeSchema = z.object({
  email: z.string().trim().email().max(200),
  source: z.string().trim().min(1).max(80).optional(),
  metadata: z.record(z.any()).optional(),
});
const authPageSettingsUpdateSchema = z.object({
  brandName: z.string().trim().min(1).max(80).optional(),
  loginHeroImage: z.string().trim().max(2000).optional(),
  registerHeroImage: z.string().trim().max(2000).optional(),
  forgotPasswordHeroImage: z.string().trim().max(2000).optional(),
  loginHeroCaption: z.string().trim().max(200).optional(),
  registerHeroCaption: z.string().trim().max(200).optional(),
  forgotPasswordHeroCaption: z.string().trim().max(200).optional(),
  loginTitle: z.string().trim().max(120).optional(),
  loginSubtitle: z.string().trim().max(240).optional(),
  registerTitle: z.string().trim().max(120).optional(),
  registerSubtitle: z.string().trim().max(240).optional(),
  forgotPasswordTitle: z.string().trim().max(120).optional(),
  forgotPasswordSubtitle: z.string().trim().max(240).optional(),
  loginSubmitLabel: z.string().trim().max(60).optional(),
  registerSubmitLabel: z.string().trim().max(60).optional(),
  forgotPasswordSubmitLabel: z.string().trim().max(80).optional(),
  googleClientIds: z.string().trim().max(2000).optional(),
  googleClientId: z.string().trim().max(300).optional(),
  showGoogleOnLogin: z.boolean().optional(),
  showGoogleOnRegister: z.boolean().optional(),
});
const dashboardClockWeatherSettingsUpdateSchema = z.object({
  showClock: z.boolean().optional(),
  showDate: z.boolean().optional(),
  showAmPm: z.boolean().optional(),
  showGmt: z.boolean().optional(),
  showSeconds: z.boolean().optional(),
  showTimeZoneName: z.boolean().optional(),
  showWeather: z.boolean().optional(),
  weatherLocationMode: z.enum(['AUTO_USER_COUNTRY', 'CUSTOM_LOCATION']).optional(),
  customWeatherLocation: z.string().trim().max(120).optional(),
  weatherUnit: z.enum(['C', 'F']).optional(),
  weatherRefreshSeconds: z.number().int().min(60).max(3600).optional(),
});
const homepageExperienceSettingsUpdateSchema = z.object({
  enabledModes: z.array(z.enum(HOMEPAGE_EXPERIENCE_MODES)).min(1).max(3).optional(),
  defaultMode: z.enum(HOMEPAGE_EXPERIENCE_MODES).optional(),
  allowUserModeOverride: z.boolean().optional(),
  adaptiveByDevice: z.boolean().optional(),
  adaptiveByConnection: z.boolean().optional(),
  respectReducedMotion: z.boolean().optional(),
  themeModes: z.array(z.enum(HOMEPAGE_THEME_MODES)).min(1).max(3).optional(),
  defaultThemeMode: z.enum(HOMEPAGE_THEME_MODES).optional(),
  tokenSet: z.enum(HOMEPAGE_TOKEN_SETS).optional(),
  heroVariant: z.enum(HOMEPAGE_HERO_VARIANTS).optional(),
  categoryEntryVariant: z.enum(HOMEPAGE_CATEGORY_ENTRY_VARIANTS).optional(),
  spotlightVariant: z.enum(HOMEPAGE_SPOTLIGHT_VARIANTS).optional(),
  homepageTemplate: z.enum(HOMEPAGE_TEMPLATES).optional(),
  rolloutMode: z.enum(HOMEPAGE_ROLLOUT_MODES).optional(),
  allowPreviewQuery: z.boolean().optional(),
  previewQueryParam: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9_-]+$/).optional(),
  legacyHomepageEnabled: z.boolean().optional(),
  requireReasonForRuntimeActions: z.boolean().optional(),
  trustBadges: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(48),
        subtitle: z.string().trim().min(1).max(90),
        icon: z.enum(HOMEPAGE_TRUST_BADGE_ICONS).optional(),
        enabled: z.boolean().optional(),
      })
    )
    .min(1)
    .max(6)
    .optional(),
  kimiCopy: z
    .object({
      heroEyebrow: z.string().trim().min(1).max(40).optional(),
      shopByEyebrow: z.string().trim().min(1).max(40).optional(),
      shopByTitle: z.string().trim().min(1).max(60).optional(),
      featuredRtwTitle: z.string().trim().min(1).max(60).optional(),
      featuredFabricsTitle: z.string().trim().min(1).max(60).optional(),
      featuredDesignsTitle: z.string().trim().min(1).max(60).optional(),
      designerSpotlightTitle: z.string().trim().min(1).max(60).optional(),
      quickPathRtwLabel: z.string().trim().min(1).max(32).optional(),
      quickPathCustomLabel: z.string().trim().min(1).max(32).optional(),
      quickPathFabricsLabel: z.string().trim().min(1).max(32).optional(),
    })
    .optional(),
});

type TopStripSettings = {
  messages: string[];
  separator: string;
  repeatCount: number;
  animationSeconds: number;
  fontSize: number;
  isBold: boolean;
  pauseOnHover: boolean;
  textColor: string;
  backgroundColor: string;
};
type StatsStripItem = {
  value: string;
  suffix: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
};
type StatsStripSettings = {
  items: StatsStripItem[];
  backgroundImage: string;
  backgroundColor: string;
  overlayColor: string;
  overlayOpacity: number;
  valueColor: string;
  suffixColor: string;
  labelColor: string;
};
type FeaturedProductDescriptionSettings = {
  wordLimit: number;
};

type HowItWorksStyleSettings = {
  enabled: boolean;
  iconColor: string;
  iconHoverColor: string;
};
type ShopByOption = {
  label: string;
  href: string;
};
type ShopByTab = 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
type ShopByBlocksSettings = {
  title: string;
  subtitle: string;
  styleOptions: ShopByOption[];
  priceOptions: ShopByOption[];
  enabledTabs: ShopByTab[];
  defaultTab: ShopByTab;
};
type FreshDropsSettings = {
  eyebrow: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  badgeValueText: string;
  badgeLabelText: string;
  showBadge: boolean;
};
type NewsletterSettings = {
  enabled: boolean;
  title: string;
  subtitle: string;
  emailPlaceholder: string;
  submitLabel: string;
  successMessage: string;
  duplicateMessage: string;
};
type HomepageNavigationMenuLink = {
  label: string;
  href: string;
  enabled: boolean;
};
type HomepageNavigationSettings = {
  logoMode: 'TEXT' | 'IMAGE';
  logoText: string;
  logoImageUrl: string;
  logoAltText: string;
  logoWidth: number;
  logoHeight: number;
  leftMenuLinks: HomepageNavigationMenuLink[];
  rightMenuLinks: HomepageNavigationMenuLink[];
  hamburgerMenuLinks: HomepageNavigationMenuLink[];
  showHamburger: boolean;
  showSearchIcon: boolean;
  showCartIcon: boolean;
  showProfileIcon: boolean;
  showCurrencySelector: boolean;
  showExperienceModeSelector: boolean;
  showThemeModeSelector: boolean;
};
type HeroQuickLink = {
  label: string;
  href: string;
};
type HomepageHeroSettings = {
  rotationSeconds: number;
  forceUppercaseCtas: boolean;
  ctaTarget: 'SAME_TAB' | 'NEW_TAB';
  showQuickLinks: boolean;
  quickLinks: HeroQuickLink[];
};
type AuthPageSettings = {
  brandName: string;
  loginHeroImage: string;
  registerHeroImage: string;
  forgotPasswordHeroImage: string;
  loginHeroCaption: string;
  registerHeroCaption: string;
  forgotPasswordHeroCaption: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  forgotPasswordTitle: string;
  forgotPasswordSubtitle: string;
  loginSubmitLabel: string;
  registerSubmitLabel: string;
  forgotPasswordSubmitLabel: string;
  googleClientIds: string;
  showGoogleOnLogin: boolean;
  showGoogleOnRegister: boolean;
};
type DashboardWeatherLocationMode = 'AUTO_USER_COUNTRY' | 'CUSTOM_LOCATION';
type DashboardTemperatureUnit = 'C' | 'F';
type DashboardClockWeatherSettings = {
  showClock: boolean;
  showDate: boolean;
  showAmPm: boolean;
  showGmt: boolean;
  showSeconds: boolean;
  showTimeZoneName: boolean;
  showWeather: boolean;
  weatherLocationMode: DashboardWeatherLocationMode;
  customWeatherLocation: string;
  weatherUnit: DashboardTemperatureUnit;
  weatherRefreshSeconds: number;
};
type HomepageExperienceMode = (typeof HOMEPAGE_EXPERIENCE_MODES)[number];
type HomepageThemeMode = (typeof HOMEPAGE_THEME_MODES)[number];
type HomepageTokenSet = (typeof HOMEPAGE_TOKEN_SETS)[number];
type HomepageHeroVariant = (typeof HOMEPAGE_HERO_VARIANTS)[number];
type HomepageCategoryEntryVariant = (typeof HOMEPAGE_CATEGORY_ENTRY_VARIANTS)[number];
type HomepageSpotlightVariant = (typeof HOMEPAGE_SPOTLIGHT_VARIANTS)[number];
type HomepageTemplate = (typeof HOMEPAGE_TEMPLATES)[number];
type HomepageRolloutMode = (typeof HOMEPAGE_ROLLOUT_MODES)[number];
type HomepageTrustBadgeIcon = (typeof HOMEPAGE_TRUST_BADGE_ICONS)[number];
type HomepageTrustBadge = {
  title: string;
  subtitle: string;
  icon: HomepageTrustBadgeIcon;
  enabled: boolean;
};
type HomepageKimiCopy = {
  heroEyebrow: string;
  shopByEyebrow: string;
  shopByTitle: string;
  featuredRtwTitle: string;
  featuredFabricsTitle: string;
  featuredDesignsTitle: string;
  designerSpotlightTitle: string;
  quickPathRtwLabel: string;
  quickPathCustomLabel: string;
  quickPathFabricsLabel: string;
};
type HomepageExperienceSettings = {
  enabledModes: HomepageExperienceMode[];
  defaultMode: HomepageExperienceMode;
  allowUserModeOverride: boolean;
  adaptiveByDevice: boolean;
  adaptiveByConnection: boolean;
  respectReducedMotion: boolean;
  themeModes: HomepageThemeMode[];
  defaultThemeMode: HomepageThemeMode;
  tokenSet: HomepageTokenSet;
  heroVariant: HomepageHeroVariant;
  categoryEntryVariant: HomepageCategoryEntryVariant;
  spotlightVariant: HomepageSpotlightVariant;
  homepageTemplate: HomepageTemplate;
  rolloutMode: HomepageRolloutMode;
  allowPreviewQuery: boolean;
  previewQueryParam: string;
  legacyHomepageEnabled: boolean;
  requireReasonForRuntimeActions: boolean;
  trustBadges: HomepageTrustBadge[];
  kimiCopy: HomepageKimiCopy;
};
type HomepageExperienceSettingsPatch = Omit<Partial<HomepageExperienceSettings>, 'trustBadges' | 'kimiCopy'> & {
  trustBadges?: Array<Partial<HomepageTrustBadge>>;
  kimiCopy?: Partial<HomepageKimiCopy>;
};
type HomepageRuntimeSnapshot = Pick<
  HomepageExperienceSettings,
  'homepageTemplate' | 'rolloutMode' | 'allowPreviewQuery' | 'previewQueryParam' | 'legacyHomepageEnabled'
>;
type HomepageRuntimeHealthStatus = 'PASS' | 'WARN' | 'FAIL';
type HomepageRuntimeHealthCheck = {
  key: string;
  label: string;
  status: HomepageRuntimeHealthStatus;
  detail: string;
};
type HomepageRuntimeHealthResult = {
  ok: boolean;
  checkedAt: string;
  checks: HomepageRuntimeHealthCheck[];
};
type HomepageRuntimeAuditEntry = {
  id: string;
  action: HomepageRuntimeAuditAction;
  reason: string;
  previous: HomepageRuntimeSnapshot;
  next: HomepageRuntimeSnapshot;
  healthSummary: HomepageRuntimeHealthResult | null;
  metadata: Record<string, unknown>;
  performedByUserId: string | null;
  performedByEmail: string | null;
  createdAt: Date | null;
};
type HomepageRuntimeAuditFilters = {
  action?: HomepageRuntimeAuditAction;
  performedByEmail?: string;
  from?: Date;
  to?: Date;
};

const runtimeRollbackSchema = z.object({
  auditId: z.string().trim().min(1).max(128).optional(),
  reason: z.string().trim().max(280).optional(),
});

const TOP_STRIP_DEFAULTS: TopStripSettings = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  fontSize: 12,
  isBold: false,
  pauseOnHover: true,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};
const STATS_STRIP_DEFAULTS: StatsStripSettings = {
  items: [
    { value: '120', suffix: '+', label: 'COUNTRIES', displayOrder: 0, isActive: true },
    { value: '50', suffix: 'K+', label: 'DESIGNERS', displayOrder: 1, isActive: true },
    { value: '1', suffix: 'M+', label: 'FABRICS', displayOrder: 2, isActive: true },
    { value: '100', suffix: 'K+', label: 'PRODUCTS', displayOrder: 3, isActive: true },
  ],
  backgroundImage: '',
  backgroundColor: '#111827',
  overlayColor: '#000000',
  overlayOpacity: 45,
  valueColor: '#ffffff',
  suffixColor: '#facc15',
  labelColor: '#d1d5db',
};
const FEATURED_PRODUCT_DESCRIPTION_DEFAULTS: FeaturedProductDescriptionSettings = {
  wordLimit: 12,
};

const HOW_IT_WORKS_STYLE_DEFAULTS: HowItWorksStyleSettings = {
  enabled: false,
  iconColor: '#111827',
  iconHoverColor: '#ffffff',
};
const SHOP_BY_BLOCKS_DEFAULTS: ShopByBlocksSettings = {
  title: 'Shop by',
  subtitle: 'Browse by category, country, style, or budget.',
  styleOptions: [
    { label: 'Wedding', href: '/ready-to-wear?occasion=wedding' },
    { label: 'Casual', href: '/ready-to-wear?occasion=casual' },
    { label: 'Festival', href: '/ready-to-wear?occasion=festival' },
  ],
  priceOptions: [
    { label: 'Under $100', href: '/shop?price=under-100' },
    { label: '$100 - $300', href: '/shop?price=100-300' },
    { label: 'Above $300', href: '/shop?price=above-300' },
  ],
  enabledTabs: ['CATEGORY', 'COUNTRY', 'OCCASION_STYLE', 'PRICE'],
  defaultTab: 'CATEGORY',
};
const FRESH_DROPS_SETTINGS_DEFAULTS: FreshDropsSettings = {
  eyebrow: 'FRESH DROPS',
  title: 'New arrivals from the most talented designers across the continent.',
  subtitle: 'Curated highlights from ready-to-wear, custom, and fabrics.',
  ctaText: 'SHOP NEW ARRIVALS',
  ctaLink: '/ready-to-wear',
  badgeValueText: PROMO_BADGE_DEFAULTS.valueText,
  badgeLabelText: PROMO_BADGE_DEFAULTS.labelText,
  showBadge: true,
};
const NEWSLETTER_SETTINGS_DEFAULTS: NewsletterSettings = {
  enabled: true,
  title: 'Join the Movement',
  subtitle: 'Subscribe to our newsletter for exclusive offers, new arrivals, and stories from the continent.',
  emailPlaceholder: 'Enter your email',
  submitLabel: 'SUBSCRIBE',
  successMessage: 'You are subscribed. We will keep you updated.',
  duplicateMessage: 'You are already subscribed to our newsletter.',
};
const NAVIGATION_SETTINGS_DEFAULTS: HomepageNavigationSettings = {
  logoMode: 'TEXT',
  logoText: 'ZURIKARIBU',
  logoImageUrl: '',
  logoAltText: 'ZuriKaribu',
  logoWidth: 180,
  logoHeight: 48,
  leftMenuLinks: [
    { label: 'Home', href: '/', enabled: true },
    { label: 'Ready To Wear', href: '/ready-to-wear', enabled: true },
    { label: 'Fabric To Buy', href: '/fabrics', enabled: true },
    { label: 'Custom To Wear', href: '/custom', enabled: true },
  ],
  rightMenuLinks: [
    { label: 'Shop', href: '/shop', enabled: true },
    { label: 'About Us', href: '/#about', enabled: true },
    { label: 'Contact Us', href: '/contact', enabled: true },
  ],
  hamburgerMenuLinks: [
    { label: 'Home', href: '/', enabled: true },
    { label: 'Shop', href: '/shop', enabled: true },
    { label: 'Ready To Wear', href: '/ready-to-wear', enabled: true },
    { label: 'Fabric To Buy', href: '/fabrics', enabled: true },
    { label: 'Custom To Wear', href: '/custom', enabled: true },
    { label: 'About Us', href: '/#about', enabled: true },
    { label: 'Contact Us', href: '/contact', enabled: true },
  ],
  showHamburger: true,
  showSearchIcon: true,
  showCartIcon: true,
  showProfileIcon: true,
  showCurrencySelector: true,
  showExperienceModeSelector: true,
  showThemeModeSelector: true,
};
const HERO_SETTINGS_DEFAULTS: HomepageHeroSettings = {
  rotationSeconds: 6,
  forceUppercaseCtas: true,
  ctaTarget: 'SAME_TAB',
  showQuickLinks: true,
  quickLinks: [
    { label: 'Ready to Wear', href: '/ready-to-wear' },
    { label: 'Custom', href: '/custom' },
    { label: 'Fabrics', href: '/fabrics' },
  ],
};
const AUTH_PAGE_SETTINGS_DEFAULTS: AuthPageSettings = {
  brandName: 'ZuriKaribu',
  loginHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  registerHeroImage:
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=80',
  forgotPasswordHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  loginHeroCaption: 'Wear the Story of Africa',
  registerHeroCaption: 'Wear the Story of Africa',
  forgotPasswordHeroCaption: 'Secure your African fashion account',
  loginTitle: 'Welcome Back',
  loginSubtitle: 'Sign in to continue your African fashion journey',
  registerTitle: 'Create Account',
  registerSubtitle: 'Join African fashion marketplace',
  forgotPasswordTitle: 'Forgot Password',
  forgotPasswordSubtitle: 'Enter your email to receive a secure reset link.',
  loginSubmitLabel: 'Sign In',
  registerSubmitLabel: 'Create Account',
  forgotPasswordSubmitLabel: 'Send Reset Link',
  googleClientIds: '',
  showGoogleOnLogin: true,
  showGoogleOnRegister: true,
};
const DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS: DashboardClockWeatherSettings = {
  showClock: true,
  showDate: true,
  showAmPm: true,
  showGmt: true,
  showSeconds: true,
  showTimeZoneName: true,
  showWeather: true,
  weatherLocationMode: 'AUTO_USER_COUNTRY',
  customWeatherLocation: '',
  weatherUnit: 'C',
  weatherRefreshSeconds: 600,
};
const HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS: HomepageExperienceSettings = {
  enabledModes: [...HOMEPAGE_EXPERIENCE_MODES],
  defaultMode: 'EDITORIAL_IMMERSIVE',
  allowUserModeOverride: true,
  adaptiveByDevice: false,
  adaptiveByConnection: false,
  respectReducedMotion: true,
  themeModes: [...HOMEPAGE_THEME_MODES],
  defaultThemeMode: 'SYSTEM',
  tokenSet: 'GLOBAL_PREMIUM_DARK',
  heroVariant: 'SPLIT_EDITORIAL',
  categoryEntryVariant: 'THREE_COLUMN_CORE',
  spotlightVariant: 'CAROUSEL',
  homepageTemplate: 'JENKS',
  rolloutMode: 'PREVIEW_SAFE',
  allowPreviewQuery: true,
  previewQueryParam: 'zkHomePreview',
  legacyHomepageEnabled: false,
  requireReasonForRuntimeActions: false,
  trustBadges: [
    { icon: 'SHIELD_CHECK', title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers', enabled: true },
    { icon: 'TRUCK', title: 'Global Shipping', subtitle: 'Reliable delivery worldwide', enabled: true },
    { icon: 'REFRESH_CW', title: 'Easy Returns', subtitle: 'Simple returns on eligible orders', enabled: true },
    { icon: 'HEADPHONES', title: '24/7 Support', subtitle: 'Chat and ticket support anytime', enabled: true },
  ],
  kimiCopy: {
    heroEyebrow: 'Editorial premium',
    shopByEyebrow: 'Discover',
    shopByTitle: 'Shop by',
    featuredRtwTitle: 'Featured Ready to Wear',
    featuredFabricsTitle: 'Featured Fabrics',
    featuredDesignsTitle: 'Featured Custom Designs',
    designerSpotlightTitle: 'Designer Spotlight',
    quickPathRtwLabel: 'Ready to Wear',
    quickPathCustomLabel: 'Custom',
    quickPathFabricsLabel: 'Fabrics',
  },
};

const normalizeHexColor = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

const normalizeTopStripSettings = (raw: unknown): TopStripSettings => {
  if (!raw || typeof raw !== 'object') return { ...TOP_STRIP_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages)
    ? row.messages
        .map((entry) => getString(entry))
        .filter((entry): entry is string => Boolean(entry))
    : [];
  const separator = getString(row.separator) ?? TOP_STRIP_DEFAULTS.separator;
  const repeatCount = getNumber(row.repeatCount) ?? TOP_STRIP_DEFAULTS.repeatCount;
  const animationSeconds = getNumber(row.animationSeconds) ?? TOP_STRIP_DEFAULTS.animationSeconds;
  const fontSize = getNumber(row.fontSize) ?? TOP_STRIP_DEFAULTS.fontSize;
  const isBold = getBoolean(row.isBold) ?? TOP_STRIP_DEFAULTS.isBold;
  const pauseOnHover = getBoolean(row.pauseOnHover) ?? TOP_STRIP_DEFAULTS.pauseOnHover;
  const textColor = normalizeHexColor(row.textColor, TOP_STRIP_DEFAULTS.textColor);
  const backgroundColor = normalizeHexColor(row.backgroundColor, TOP_STRIP_DEFAULTS.backgroundColor);
  return {
    messages: messages.length > 0 ? messages : [...TOP_STRIP_DEFAULTS.messages],
    separator,
    repeatCount: Math.max(2, Math.min(12, Math.round(repeatCount))),
    animationSeconds: Math.max(8, Math.min(120, Math.round(animationSeconds))),
    fontSize: Math.max(10, Math.min(40, Math.round(fontSize))),
    isBold: Boolean(isBold),
    pauseOnHover: Boolean(pauseOnHover),
    textColor,
    backgroundColor,
  };
};
const normalizeStatsStripSettings = (raw: unknown): StatsStripSettings => {
  if (!raw || typeof raw !== 'object') return { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] };
  const row = raw as Record<string, unknown>;
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const normalizedItems = rawItems
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const value = getString(item.value) || '';
      const label = getString(item.label) || '';
      if (!value || !label) return null;
      const suffix = getString(item.suffix) || '';
      const displayOrder = getNumber(item.displayOrder);
      const isActive = getBoolean(item.isActive);
      return {
        value: value.slice(0, 20),
        suffix: suffix.slice(0, 8),
        label: label.slice(0, 40).toUpperCase(),
        displayOrder: Number.isFinite(displayOrder as number) ? Math.max(0, Math.min(100, Math.round(displayOrder as number))) : index,
        isActive: typeof isActive === 'boolean' ? isActive : true,
      } as StatsStripItem;
    })
    .filter((entry): entry is StatsStripItem => Boolean(entry))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  return {
    items: normalizedItems.length > 0 ? normalizedItems : [...STATS_STRIP_DEFAULTS.items],
    backgroundImage: getString(row.backgroundImage) || '',
    backgroundColor: normalizeHexColor(row.backgroundColor, STATS_STRIP_DEFAULTS.backgroundColor),
    overlayColor: normalizeHexColor(row.overlayColor, STATS_STRIP_DEFAULTS.overlayColor),
    overlayOpacity: Math.max(
      0,
      Math.min(100, Math.round(getNumber(row.overlayOpacity) ?? STATS_STRIP_DEFAULTS.overlayOpacity))
    ),
    valueColor: normalizeHexColor(row.valueColor, STATS_STRIP_DEFAULTS.valueColor),
    suffixColor: normalizeHexColor(row.suffixColor, STATS_STRIP_DEFAULTS.suffixColor),
    labelColor: normalizeHexColor(row.labelColor, STATS_STRIP_DEFAULTS.labelColor),
  };
};
const normalizeFeaturedProductDescriptionSettings = (raw: unknown): FeaturedProductDescriptionSettings => {
  if (!raw || typeof raw !== 'object') return { ...FEATURED_PRODUCT_DESCRIPTION_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const wordLimit = getNumber(row.wordLimit) ?? FEATURED_PRODUCT_DESCRIPTION_DEFAULTS.wordLimit;
  return {
    wordLimit: Math.max(5, Math.min(60, Math.round(wordLimit))),
  };
};

const normalizeHowItWorksStyleSettings = (raw: unknown): HowItWorksStyleSettings => {
  if (!raw || typeof raw !== 'object') return { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: getBoolean(row.enabled) ?? HOW_IT_WORKS_STYLE_DEFAULTS.enabled,
    iconColor: normalizeHexColor(row.iconColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconColor),
    iconHoverColor: normalizeHexColor(row.iconHoverColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconHoverColor),
  };
};
const normalizeHref = (value: unknown, fallback: string) => {
  const raw = getString(value);
  if (!raw) return fallback;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return fallback;
  return raw;
};
const normalizeShopByOption = (value: unknown): ShopByOption | null => {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const label = getString(row.label);
  const href = getString(row.href);
  if (!label || !href) return null;
  return {
    label: label.slice(0, 60),
    href: normalizeHref(href, '/shop'),
  };
};
const normalizeShopByBlocksSettings = (raw: unknown): ShopByBlocksSettings => {
  if (!raw || typeof raw !== 'object') {
    return {
      ...SHOP_BY_BLOCKS_DEFAULTS,
      styleOptions: [...SHOP_BY_BLOCKS_DEFAULTS.styleOptions],
      priceOptions: [...SHOP_BY_BLOCKS_DEFAULTS.priceOptions],
      enabledTabs: [...SHOP_BY_BLOCKS_DEFAULTS.enabledTabs],
    };
  }
  const row = raw as Record<string, unknown>;
  const styleOptions = Array.isArray(row.styleOptions)
    ? row.styleOptions
        .map((entry) => normalizeShopByOption(entry))
        .filter((entry): entry is ShopByOption => Boolean(entry))
        .slice(0, 8)
    : [];
  const priceOptions = Array.isArray(row.priceOptions)
    ? row.priceOptions
        .map((entry) => normalizeShopByOption(entry))
        .filter((entry): entry is ShopByOption => Boolean(entry))
        .slice(0, 8)
    : [];
  const allowedTabs: ShopByTab[] = ['CATEGORY', 'COUNTRY', 'OCCASION_STYLE', 'PRICE'];
  const enabledTabs = Array.isArray(row.enabledTabs)
    ? row.enabledTabs
        .map((entry) => String(entry || '').trim().toUpperCase() as ShopByTab)
        .filter((entry) => allowedTabs.includes(entry))
    : [];
  const defaultTabCandidate = String(row.defaultTab || '').trim().toUpperCase() as ShopByTab;
  const resolvedEnabledTabs = enabledTabs.length > 0 ? Array.from(new Set(enabledTabs)) : [...SHOP_BY_BLOCKS_DEFAULTS.enabledTabs];
  const defaultTab = resolvedEnabledTabs.includes(defaultTabCandidate)
    ? defaultTabCandidate
    : resolvedEnabledTabs[0] || SHOP_BY_BLOCKS_DEFAULTS.defaultTab;
  return {
    title: (getString(row.title) || SHOP_BY_BLOCKS_DEFAULTS.title).slice(0, 80),
    subtitle: (getString(row.subtitle) || SHOP_BY_BLOCKS_DEFAULTS.subtitle).slice(0, 240),
    styleOptions: styleOptions.length > 0 ? styleOptions : [...SHOP_BY_BLOCKS_DEFAULTS.styleOptions],
    priceOptions: priceOptions.length > 0 ? priceOptions : [...SHOP_BY_BLOCKS_DEFAULTS.priceOptions],
    enabledTabs: resolvedEnabledTabs,
    defaultTab,
  };
};
const normalizeFreshDropsSettings = (raw: unknown): FreshDropsSettings => {
  if (!raw || typeof raw !== 'object') return { ...FRESH_DROPS_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    eyebrow: (getString(row.eyebrow) || FRESH_DROPS_SETTINGS_DEFAULTS.eyebrow).slice(0, 40),
    title: (getString(row.title) || FRESH_DROPS_SETTINGS_DEFAULTS.title).slice(0, 180),
    subtitle: (getString(row.subtitle) || FRESH_DROPS_SETTINGS_DEFAULTS.subtitle).slice(0, 260),
    ctaText: (getString(row.ctaText) || FRESH_DROPS_SETTINGS_DEFAULTS.ctaText).slice(0, 60),
    ctaLink: normalizeHref(row.ctaLink, FRESH_DROPS_SETTINGS_DEFAULTS.ctaLink),
    badgeValueText: (getString(row.badgeValueText) || FRESH_DROPS_SETTINGS_DEFAULTS.badgeValueText).slice(0, 20),
    badgeLabelText: (getString(row.badgeLabelText) || FRESH_DROPS_SETTINGS_DEFAULTS.badgeLabelText).slice(0, 80),
    showBadge: getBoolean(row.showBadge) ?? FRESH_DROPS_SETTINGS_DEFAULTS.showBadge,
  };
};
const normalizeNewsletterSettings = (raw: unknown): NewsletterSettings => {
  if (!raw || typeof raw !== 'object') return { ...NEWSLETTER_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: getBoolean(row.enabled) ?? NEWSLETTER_SETTINGS_DEFAULTS.enabled,
    title: (getString(row.title) || NEWSLETTER_SETTINGS_DEFAULTS.title).slice(0, 120),
    subtitle: (getString(row.subtitle) || NEWSLETTER_SETTINGS_DEFAULTS.subtitle).slice(0, 260),
    emailPlaceholder: (getString(row.emailPlaceholder) || NEWSLETTER_SETTINGS_DEFAULTS.emailPlaceholder).slice(0, 120),
    submitLabel: (getString(row.submitLabel) || NEWSLETTER_SETTINGS_DEFAULTS.submitLabel).slice(0, 60),
    successMessage: (getString(row.successMessage) || NEWSLETTER_SETTINGS_DEFAULTS.successMessage).slice(0, 200),
    duplicateMessage: (getString(row.duplicateMessage) || NEWSLETTER_SETTINGS_DEFAULTS.duplicateMessage).slice(0, 200),
  };
};
const normalizeNavigationMenuLinks = (
  value: unknown,
  fallback: HomepageNavigationMenuLink[]
): HomepageNavigationMenuLink[] => {
  const rows = Array.isArray(value) ? value : [];
  const mapped = rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const label = getString(row.label);
      const href = getString(row.href);
      if (!label || !href) return null;
      return {
        label: label.slice(0, 40),
        href: normalizeHref(href, '/'),
        enabled: getBoolean(row.enabled) ?? true,
      } as HomepageNavigationMenuLink;
    })
    .filter((entry): entry is HomepageNavigationMenuLink => Boolean(entry))
    .slice(0, 20);
  return mapped.length > 0 ? mapped : fallback.map((entry) => ({ ...entry }));
};
const normalizeNavigationSettings = (raw: unknown): HomepageNavigationSettings => {
  if (!raw || typeof raw !== 'object') {
    return {
      ...NAVIGATION_SETTINGS_DEFAULTS,
      leftMenuLinks: NAVIGATION_SETTINGS_DEFAULTS.leftMenuLinks.map((entry) => ({ ...entry })),
      rightMenuLinks: NAVIGATION_SETTINGS_DEFAULTS.rightMenuLinks.map((entry) => ({ ...entry })),
      hamburgerMenuLinks: NAVIGATION_SETTINGS_DEFAULTS.hamburgerMenuLinks.map((entry) => ({ ...entry })),
    };
  }
  const row = raw as Record<string, unknown>;
  const logoMode = String(row.logoMode || '').trim().toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT';
  return {
    logoMode,
    logoText: (getString(row.logoText) || NAVIGATION_SETTINGS_DEFAULTS.logoText).slice(0, 80),
    logoImageUrl: (getString(row.logoImageUrl) || '').slice(0, 2000),
    logoAltText: (getString(row.logoAltText) || NAVIGATION_SETTINGS_DEFAULTS.logoAltText).slice(0, 120),
    logoWidth: Math.max(40, Math.min(600, Math.round(getNumber(row.logoWidth) ?? NAVIGATION_SETTINGS_DEFAULTS.logoWidth))),
    logoHeight: Math.max(20, Math.min(300, Math.round(getNumber(row.logoHeight) ?? NAVIGATION_SETTINGS_DEFAULTS.logoHeight))),
    leftMenuLinks: normalizeNavigationMenuLinks(row.leftMenuLinks, NAVIGATION_SETTINGS_DEFAULTS.leftMenuLinks),
    rightMenuLinks: normalizeNavigationMenuLinks(row.rightMenuLinks, NAVIGATION_SETTINGS_DEFAULTS.rightMenuLinks),
    hamburgerMenuLinks: normalizeNavigationMenuLinks(row.hamburgerMenuLinks, NAVIGATION_SETTINGS_DEFAULTS.hamburgerMenuLinks),
    showHamburger: getBoolean(row.showHamburger) ?? NAVIGATION_SETTINGS_DEFAULTS.showHamburger,
    showSearchIcon: getBoolean(row.showSearchIcon) ?? NAVIGATION_SETTINGS_DEFAULTS.showSearchIcon,
    showCartIcon: getBoolean(row.showCartIcon) ?? NAVIGATION_SETTINGS_DEFAULTS.showCartIcon,
    showProfileIcon: getBoolean(row.showProfileIcon) ?? NAVIGATION_SETTINGS_DEFAULTS.showProfileIcon,
    showCurrencySelector: getBoolean(row.showCurrencySelector) ?? NAVIGATION_SETTINGS_DEFAULTS.showCurrencySelector,
    showExperienceModeSelector:
      getBoolean(row.showExperienceModeSelector) ?? NAVIGATION_SETTINGS_DEFAULTS.showExperienceModeSelector,
    showThemeModeSelector: getBoolean(row.showThemeModeSelector) ?? NAVIGATION_SETTINGS_DEFAULTS.showThemeModeSelector,
  };
};
const normalizeHeroQuickLinks = (value: unknown, fallback: HeroQuickLink[]): HeroQuickLink[] => {
  const rows = Array.isArray(value) ? value : [];
  const mapped = rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const label = getString(row.label);
      const href = getString(row.href);
      if (!label || !href) return null;
      return {
        label: label.slice(0, 32),
        href: normalizeHref(href, '/shop'),
      } as HeroQuickLink;
    })
    .filter((entry): entry is HeroQuickLink => Boolean(entry))
    .slice(0, 8);
  return mapped.length > 0 ? mapped : fallback.map((entry) => ({ ...entry }));
};
const normalizeHeroSettings = (raw: unknown): HomepageHeroSettings => {
  if (!raw || typeof raw !== 'object') {
    return {
      ...HERO_SETTINGS_DEFAULTS,
      quickLinks: HERO_SETTINGS_DEFAULTS.quickLinks.map((entry) => ({ ...entry })),
    };
  }
  const row = raw as Record<string, unknown>;
  const ctaTarget = String(row.ctaTarget || '').trim().toUpperCase() === 'NEW_TAB' ? 'NEW_TAB' : 'SAME_TAB';
  return {
    rotationSeconds: Math.max(3, Math.min(20, Math.round(getNumber(row.rotationSeconds) ?? HERO_SETTINGS_DEFAULTS.rotationSeconds))),
    forceUppercaseCtas: getBoolean(row.forceUppercaseCtas) ?? HERO_SETTINGS_DEFAULTS.forceUppercaseCtas,
    ctaTarget,
    showQuickLinks: getBoolean(row.showQuickLinks) ?? HERO_SETTINGS_DEFAULTS.showQuickLinks,
    quickLinks: normalizeHeroQuickLinks(row.quickLinks, HERO_SETTINGS_DEFAULTS.quickLinks),
  };
};
const normalizeAuthPageSettings = (raw: unknown): AuthPageSettings => {
  if (!raw || typeof raw !== 'object') return { ...AUTH_PAGE_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    brandName: getString(row.brandName) || AUTH_PAGE_SETTINGS_DEFAULTS.brandName,
    loginHeroImage: getString(row.loginHeroImage) || AUTH_PAGE_SETTINGS_DEFAULTS.loginHeroImage,
    registerHeroImage: getString(row.registerHeroImage) || AUTH_PAGE_SETTINGS_DEFAULTS.registerHeroImage,
    forgotPasswordHeroImage:
      getString(row.forgotPasswordHeroImage) || AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroImage,
    loginHeroCaption: getString(row.loginHeroCaption) || AUTH_PAGE_SETTINGS_DEFAULTS.loginHeroCaption,
    registerHeroCaption: getString(row.registerHeroCaption) || AUTH_PAGE_SETTINGS_DEFAULTS.registerHeroCaption,
    forgotPasswordHeroCaption:
      getString(row.forgotPasswordHeroCaption) || AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroCaption,
    loginTitle: getString(row.loginTitle) || AUTH_PAGE_SETTINGS_DEFAULTS.loginTitle,
    loginSubtitle: getString(row.loginSubtitle) || AUTH_PAGE_SETTINGS_DEFAULTS.loginSubtitle,
    registerTitle: getString(row.registerTitle) || AUTH_PAGE_SETTINGS_DEFAULTS.registerTitle,
    registerSubtitle: getString(row.registerSubtitle) || AUTH_PAGE_SETTINGS_DEFAULTS.registerSubtitle,
    forgotPasswordTitle: getString(row.forgotPasswordTitle) || AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordTitle,
    forgotPasswordSubtitle:
      getString(row.forgotPasswordSubtitle) || AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordSubtitle,
    loginSubmitLabel: getString(row.loginSubmitLabel) || AUTH_PAGE_SETTINGS_DEFAULTS.loginSubmitLabel,
    registerSubmitLabel: getString(row.registerSubmitLabel) || AUTH_PAGE_SETTINGS_DEFAULTS.registerSubmitLabel,
    forgotPasswordSubmitLabel:
      getString(row.forgotPasswordSubmitLabel) || AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordSubmitLabel,
    googleClientIds:
      getString(row.googleClientIds) || getString(row.googleClientId) || AUTH_PAGE_SETTINGS_DEFAULTS.googleClientIds,
    showGoogleOnLogin: getBoolean(row.showGoogleOnLogin) ?? AUTH_PAGE_SETTINGS_DEFAULTS.showGoogleOnLogin,
    showGoogleOnRegister:
      getBoolean(row.showGoogleOnRegister) ?? AUTH_PAGE_SETTINGS_DEFAULTS.showGoogleOnRegister,
  };
};
const normalizeDashboardClockWeatherSettings = (raw: unknown): DashboardClockWeatherSettings => {
  if (!raw || typeof raw !== 'object') return { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const locationModeCandidate = String(row.weatherLocationMode || '').trim().toUpperCase();
  const weatherLocationMode: DashboardWeatherLocationMode =
    locationModeCandidate === 'CUSTOM_LOCATION' ? 'CUSTOM_LOCATION' : 'AUTO_USER_COUNTRY';
  const weatherUnit: DashboardTemperatureUnit =
    String(row.weatherUnit || '').trim().toUpperCase() === 'F' ? 'F' : 'C';
  const showClock = getBoolean(row.showClock) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showClock;
  let showAmPm = getBoolean(row.showAmPm) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showAmPm;
  let showGmt = getBoolean(row.showGmt) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showGmt;
  if (showClock && !showAmPm && !showGmt) {
    showAmPm = true;
    showGmt = DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showGmt;
  }
  return {
    showClock,
    showDate: getBoolean(row.showDate) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showDate,
    showAmPm,
    showGmt,
    showSeconds: getBoolean(row.showSeconds) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showSeconds,
    showTimeZoneName:
      getBoolean(row.showTimeZoneName) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showTimeZoneName,
    showWeather: getBoolean(row.showWeather) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showWeather,
    weatherLocationMode,
    customWeatherLocation: (getString(row.customWeatherLocation) || '').slice(0, 120),
    weatherUnit,
    weatherRefreshSeconds: Math.max(
      60,
      Math.min(
        3600,
        Math.round(getNumber(row.weatherRefreshSeconds) ?? DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.weatherRefreshSeconds)
      )
    ),
  };
};

const normalizeEnumList = <T extends string>(
  values: unknown,
  allowed: readonly T[],
  fallback: readonly T[]
): T[] => {
  const allowedSet = new Set(allowed);
  const source = Array.isArray(values) ? values : fallback;
  const normalized: T[] = [];
  for (const entry of source) {
    const value = String(entry || '').trim().toUpperCase();
    if (!allowedSet.has(value as T)) continue;
    if (!normalized.includes(value as T)) normalized.push(value as T);
  }
  return normalized.length > 0 ? normalized : [...fallback];
};

const normalizeHomepageExperienceSettings = (raw: unknown): HomepageExperienceSettings => {
  if (!raw || typeof raw !== 'object') return { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const enabledModes = normalizeEnumList(
    row.enabledModes,
    HOMEPAGE_EXPERIENCE_MODES,
    HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.enabledModes
  );
  const defaultModeCandidate = String(row.defaultMode || '').trim().toUpperCase() as HomepageExperienceMode;
  const defaultMode = enabledModes.includes(defaultModeCandidate)
    ? defaultModeCandidate
    : enabledModes.includes(HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.defaultMode)
      ? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.defaultMode
      : enabledModes[0];

  const themeModes = normalizeEnumList(
    row.themeModes,
    HOMEPAGE_THEME_MODES,
    HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.themeModes
  );
  const defaultThemeCandidate = String(row.defaultThemeMode || '').trim().toUpperCase() as HomepageThemeMode;
  const defaultThemeMode = themeModes.includes(defaultThemeCandidate)
    ? defaultThemeCandidate
    : themeModes.includes(HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.defaultThemeMode)
      ? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.defaultThemeMode
      : themeModes[0];

  const tokenSetCandidate = String(row.tokenSet || '').trim().toUpperCase() as HomepageTokenSet;
  const tokenSet = HOMEPAGE_TOKEN_SETS.includes(tokenSetCandidate)
    ? tokenSetCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.tokenSet;

  const heroVariantCandidate = String(row.heroVariant || '').trim().toUpperCase() as HomepageHeroVariant;
  const heroVariant = HOMEPAGE_HERO_VARIANTS.includes(heroVariantCandidate)
    ? heroVariantCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.heroVariant;

  const categoryVariantCandidate = String(row.categoryEntryVariant || '')
    .trim()
    .toUpperCase() as HomepageCategoryEntryVariant;
  const categoryEntryVariant = HOMEPAGE_CATEGORY_ENTRY_VARIANTS.includes(categoryVariantCandidate)
    ? categoryVariantCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.categoryEntryVariant;

  const spotlightVariantCandidate = String(row.spotlightVariant || '').trim().toUpperCase() as HomepageSpotlightVariant;
  const spotlightVariant = HOMEPAGE_SPOTLIGHT_VARIANTS.includes(spotlightVariantCandidate)
    ? spotlightVariantCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.spotlightVariant;

  const homepageTemplateCandidateRaw = String(row.homepageTemplate || '').trim().toUpperCase();
  const homepageTemplateCandidate =
    homepageTemplateCandidateRaw === 'KIMI' ? 'JENKS' : (homepageTemplateCandidateRaw as HomepageTemplate);
  const homepageTemplateRaw = HOMEPAGE_TEMPLATES.includes(homepageTemplateCandidate)
    ? homepageTemplateCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.homepageTemplate;
  const rolloutModeCandidate = String(row.rolloutMode || '').trim().toUpperCase() as HomepageRolloutMode;
  const rolloutMode = HOMEPAGE_ROLLOUT_MODES.includes(rolloutModeCandidate)
    ? rolloutModeCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.rolloutMode;
  const previewQueryParamCandidate = getString(row.previewQueryParam) || HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.previewQueryParam;
  const previewQueryParam = /^[A-Za-z0-9_-]{2,40}$/.test(previewQueryParamCandidate)
    ? previewQueryParamCandidate
    : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.previewQueryParam;
  const legacyHomepageEnabled =
    getBoolean(row.legacyHomepageEnabled) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.legacyHomepageEnabled;
  const homepageTemplate =
    !legacyHomepageEnabled && homepageTemplateRaw === 'LEGACY' ? 'JENKS' : homepageTemplateRaw;

  const trustBadgeRows = Array.isArray(row.trustBadges) ? row.trustBadges : [];
  const trustBadges = trustBadgeRows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const title = (getString(item.title) || '').slice(0, 48);
      const subtitle = (getString(item.subtitle) || '').slice(0, 90);
      if (!title || !subtitle) return null;
      const iconCandidate = String(item.icon || '')
        .trim()
        .toUpperCase() as HomepageTrustBadgeIcon;
      const icon = HOMEPAGE_TRUST_BADGE_ICONS.includes(iconCandidate)
        ? iconCandidate
        : HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.trustBadges[0].icon;
      return {
        icon,
        title,
        subtitle,
        enabled: getBoolean(item.enabled) ?? true,
      } as HomepageTrustBadge;
    })
    .filter((entry): entry is HomepageTrustBadge => Boolean(entry))
    .slice(0, 6);
  const fallbackTrustBadges = HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.trustBadges.map((item) => ({ ...item }));

  const copyInput = row.kimiCopy && typeof row.kimiCopy === 'object' ? (row.kimiCopy as Record<string, unknown>) : {};
  const defaultCopy = HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.kimiCopy;
  const kimiCopy: HomepageKimiCopy = {
    heroEyebrow: (getString(copyInput.heroEyebrow) || defaultCopy.heroEyebrow).slice(0, 40),
    shopByEyebrow: (getString(copyInput.shopByEyebrow) || defaultCopy.shopByEyebrow).slice(0, 40),
    shopByTitle: (getString(copyInput.shopByTitle) || defaultCopy.shopByTitle).slice(0, 60),
    featuredRtwTitle: (getString(copyInput.featuredRtwTitle) || defaultCopy.featuredRtwTitle).slice(0, 60),
    featuredFabricsTitle: (getString(copyInput.featuredFabricsTitle) || defaultCopy.featuredFabricsTitle).slice(0, 60),
    featuredDesignsTitle: (getString(copyInput.featuredDesignsTitle) || defaultCopy.featuredDesignsTitle).slice(0, 60),
    designerSpotlightTitle: (getString(copyInput.designerSpotlightTitle) || defaultCopy.designerSpotlightTitle).slice(0, 60),
    quickPathRtwLabel: (getString(copyInput.quickPathRtwLabel) || defaultCopy.quickPathRtwLabel).slice(0, 32),
    quickPathCustomLabel: (getString(copyInput.quickPathCustomLabel) || defaultCopy.quickPathCustomLabel).slice(0, 32),
    quickPathFabricsLabel: (getString(copyInput.quickPathFabricsLabel) || defaultCopy.quickPathFabricsLabel).slice(0, 32),
  };

  return {
    enabledModes,
    defaultMode,
    allowUserModeOverride: getBoolean(row.allowUserModeOverride) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.allowUserModeOverride,
    adaptiveByDevice: getBoolean(row.adaptiveByDevice) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.adaptiveByDevice,
    adaptiveByConnection:
      getBoolean(row.adaptiveByConnection) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.adaptiveByConnection,
    respectReducedMotion:
      getBoolean(row.respectReducedMotion) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.respectReducedMotion,
    themeModes,
    defaultThemeMode,
    tokenSet,
    heroVariant,
    categoryEntryVariant,
    spotlightVariant,
    homepageTemplate,
    rolloutMode,
    allowPreviewQuery: getBoolean(row.allowPreviewQuery) ?? HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.allowPreviewQuery,
    previewQueryParam,
    legacyHomepageEnabled,
    requireReasonForRuntimeActions:
      getBoolean(row.requireReasonForRuntimeActions) ??
      HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS.requireReasonForRuntimeActions,
    trustBadges: trustBadges.length > 0 ? trustBadges : fallbackTrustBadges,
    kimiCopy,
  };
};

const countryImageGenerationUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  apiUrl: z.string().trim().optional(),
  apiKey: z.string().trim().optional(),
  model: z.string().trim().optional(),
  promptTemplate: z.string().trim().min(1).optional(),
  responseImagePath: z.string().trim().min(1).optional(),
  requestMethod: z.enum(['GET', 'POST']).optional(),
});

type CountryImageGenerationSettings = {
  enabled: boolean;
  apiUrl: string;
  apiKey: string;
  model: string;
  promptTemplate: string;
  responseImagePath: string;
  requestMethod: 'GET' | 'POST';
};

const COUNTRY_IMAGE_GENERATION_DEFAULTS: CountryImageGenerationSettings = {
  enabled: true,
  apiUrl: 'https://image.pollinations.ai/prompt/{prompt}',
  apiKey: '',
  model: 'flux',
  promptTemplate: 'High quality fashion editorial image inspired by {country}. Keywords: {keywords}. Fabrics: {fabrics}.',
  responseImagePath: 'url',
  requestMethod: 'GET',
};

const normalizeCountryImageGenerationSettings = (raw: unknown): CountryImageGenerationSettings => {
  if (!raw || typeof raw !== 'object') return { ...COUNTRY_IMAGE_GENERATION_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const requestMethod = String(row.requestMethod || '').toUpperCase();
  return {
    enabled: getBoolean(row.enabled) ?? COUNTRY_IMAGE_GENERATION_DEFAULTS.enabled,
    apiUrl: getString(row.apiUrl) || '',
    apiKey: getString(row.apiKey) || '',
    model: getString(row.model) || '',
    promptTemplate: getString(row.promptTemplate) || COUNTRY_IMAGE_GENERATION_DEFAULTS.promptTemplate,
    responseImagePath: getString(row.responseImagePath) || COUNTRY_IMAGE_GENERATION_DEFAULTS.responseImagePath,
    requestMethod: requestMethod === 'GET' ? 'GET' : 'POST',
  };
};

const getValueAtPath = (obj: unknown, path: string): unknown => {
  if (!obj || !path) return undefined;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1').replace(/^\./, '');
  return normalized.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
};

const isLikelyImageUrl = (value: string) =>
  /^https?:\/\//i.test(value) ||
  value.startsWith('/uploads/') ||
  value.startsWith('data:image/');

const buildCountryImageFallbackUrl = (keyword: string) =>
  `https://picsum.photos/seed/${encodeURIComponent(slugify(keyword || 'african-country-card'))}/1200/1600`;

const normalizeHomepageSectionVisibility = (raw: unknown): HomepageSectionVisibility => {
  const defaults = { ...HOMEPAGE_SECTION_VISIBILITY_DEFAULTS };
  if (!raw || typeof raw !== 'object') {
    return defaults;
  }
  const row = raw as Record<string, unknown>;
  for (const item of HOMEPAGE_SECTION_VISIBILITY_META) {
    if (typeof row[item.key] === 'boolean') {
      defaults[item.key] = row[item.key] as boolean;
    }
  }
  return defaults;
};

const readHomepageSectionVisibility = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_VISIBILITY_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      visibility: { ...HOMEPAGE_SECTION_VISIBILITY_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }

  let parsed: HomepageSectionVisibility = { ...HOMEPAGE_SECTION_VISIBILITY_DEFAULTS };
  try {
    parsed = normalizeHomepageSectionVisibility(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...HOMEPAGE_SECTION_VISIBILITY_DEFAULTS };
  }
  return {
    rowId: String(row.id),
    visibility: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};

const saveHomepageSectionVisibility = async (next: Partial<Record<HomepageVisibilityKey, boolean>>) => {
  const existing = await readHomepageSectionVisibility();
  const merged = normalizeHomepageSectionVisibility({
    ...existing.visibility,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_VISIBILITY_SETTINGS_KEY,
    payload
  );
  return merged;
};

const getHomepageSectionVisibilityForAdmin = async () => {
  const { visibility, source, updatedAt } = await readHomepageSectionVisibility();
  return {
    source,
    updatedAt,
    sections: HOMEPAGE_SECTION_VISIBILITY_META.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      enabled: Boolean(visibility[item.key]),
    })),
  };
};

const readTopStripSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...TOP_STRIP_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  let parsed = { ...TOP_STRIP_DEFAULTS };
  try {
    parsed = normalizeTopStripSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...TOP_STRIP_DEFAULTS };
  }
  return {
    rowId: String(row.id),
    settings: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};

const saveTopStripSettings = async (next: Partial<TopStripSettings>) => {
  const existing = await readTopStripSettings();
  const merged = normalizeTopStripSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_TOP_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readStatsStripSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_STATS_STRIP_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  let parsed = { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] };
  try {
    parsed = normalizeStatsStripSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] };
  }
  return {
    rowId: String(row.id),
    settings: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};
const saveStatsStripSettings = async (next: unknown) => {
  const existing = await readStatsStripSettings();
  const nextObject = next && typeof next === 'object' ? (next as Record<string, unknown>) : {};
  const merged = normalizeStatsStripSettings({
    ...existing.settings,
    ...nextObject,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_STATS_STRIP_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readFeaturedProductDescriptionSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...FEATURED_PRODUCT_DESCRIPTION_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  let parsed = { ...FEATURED_PRODUCT_DESCRIPTION_DEFAULTS };
  try {
    parsed = normalizeFeaturedProductDescriptionSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...FEATURED_PRODUCT_DESCRIPTION_DEFAULTS };
  }
  return {
    rowId: String(row.id),
    settings: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};
const saveFeaturedProductDescriptionSettings = async (next: Partial<FeaturedProductDescriptionSettings>) => {
  const existing = await readFeaturedProductDescriptionSettings();
  const merged = normalizeFeaturedProductDescriptionSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_FEATURED_PRODUCT_DESCRIPTION_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readHowItWorksStyleSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...HOW_IT_WORKS_STYLE_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  let parsed = { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  try {
    parsed = normalizeHowItWorksStyleSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  }
  return {
    rowId: String(row.id),
    settings: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};

const saveHowItWorksStyleSettings = async (next: Partial<HowItWorksStyleSettings>) => {
  const existing = await readHowItWorksStyleSettings();
  const merged = normalizeHowItWorksStyleSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readAuthPageSettings = async () => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "value", "updatedAt"
       FROM "HomepageSectionSetting"
       WHERE "key" = $1
       LIMIT 1`,
      AUTH_PAGE_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return {
        rowId: null as string | null,
        settings: { ...AUTH_PAGE_SETTINGS_DEFAULTS },
        source: 'DEFAULT' as const,
        updatedAt: null as Date | null,
      };
    }
    let parsed = { ...AUTH_PAGE_SETTINGS_DEFAULTS };
    try {
      parsed = normalizeAuthPageSettings(JSON.parse(String(row.value || '{}')));
    } catch {
      parsed = { ...AUTH_PAGE_SETTINGS_DEFAULTS };
    }
    return {
      rowId: String(row.id),
      settings: parsed,
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    // Keep auth screens available even if homepage settings table is unavailable.
    return {
      rowId: null as string | null,
      settings: { ...AUTH_PAGE_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
};

const saveAuthPageSettings = async (next: Partial<AuthPageSettings>) => {
  const existing = await readAuthPageSettings();
  const merged = normalizeAuthPageSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    AUTH_PAGE_SETTINGS_KEY,
    payload
  );
  return merged;
};
const readDashboardClockWeatherSettings = async () => {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT "id", "value", "updatedAt"
       FROM "HomepageSectionSetting"
       WHERE "key" = $1
       LIMIT 1`,
      DASHBOARD_CLOCK_WEATHER_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return {
        rowId: null as string | null,
        settings: { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS },
        source: 'DEFAULT' as const,
        updatedAt: null as Date | null,
      };
    }
    let parsed = { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS };
    try {
      parsed = normalizeDashboardClockWeatherSettings(JSON.parse(String(row.value || '{}')));
    } catch {
      parsed = { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS };
    }
    return {
      rowId: String(row.id),
      settings: parsed,
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: null as string | null,
      settings: { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
};
const saveDashboardClockWeatherSettings = async (next: Partial<DashboardClockWeatherSettings>) => {
  const existing = await readDashboardClockWeatherSettings();
  const merged = normalizeDashboardClockWeatherSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    DASHBOARD_CLOCK_WEATHER_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readHomepageExperienceSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_EXPERIENCE_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  let parsed = { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS };
  try {
    parsed = normalizeHomepageExperienceSettings(JSON.parse(String(row.value || '{}')));
  } catch {
    parsed = { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS };
  }
  return {
    rowId: String(row.id),
    settings: parsed,
    source: 'DATABASE' as const,
    updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
  };
};

const saveHomepageExperienceSettings = async (next: HomepageExperienceSettingsPatch) => {
  const existing = await readHomepageExperienceSettings();
  const merged = normalizeHomepageExperienceSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_EXPERIENCE_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readShopByBlocksSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_SHOP_BY_BLOCKS_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: normalizeShopByBlocksSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeShopByBlocksSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: normalizeShopByBlocksSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};
const saveShopByBlocksSettings = async (next: Partial<ShopByBlocksSettings>) => {
  const existing = await readShopByBlocksSettings();
  const merged = normalizeShopByBlocksSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_SHOP_BY_BLOCKS_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readFreshDropsSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_FRESH_DROPS_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...FRESH_DROPS_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeFreshDropsSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { ...FRESH_DROPS_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};
const saveFreshDropsSettings = async (next: Partial<FreshDropsSettings>) => {
  const existing = await readFreshDropsSettings();
  const merged = normalizeFreshDropsSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_FRESH_DROPS_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readNewsletterSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_NEWSLETTER_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...NEWSLETTER_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeNewsletterSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { ...NEWSLETTER_SETTINGS_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};
const saveNewsletterSettings = async (next: Partial<NewsletterSettings>) => {
  const existing = await readNewsletterSettings();
  const merged = normalizeNewsletterSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_NEWSLETTER_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readNavigationSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_NAVIGATION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: normalizeNavigationSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeNavigationSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: normalizeNavigationSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};
const saveNavigationSettings = async (next: Partial<HomepageNavigationSettings>) => {
  const existing = await readNavigationSettings();
  const merged = normalizeNavigationSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_NAVIGATION_SETTINGS_KEY,
    payload
  );
  return merged;
};

const readHeroSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_HERO_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: normalizeHeroSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeHeroSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: normalizeHeroSettings({}),
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};
const saveHeroSettings = async (next: Partial<HomepageHeroSettings>) => {
  const existing = await readHeroSettings();
  const merged = normalizeHeroSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_HERO_SETTINGS_KEY,
    payload
  );
  return merged;
};

const getHomepageRuntimeSnapshot = (settings: HomepageExperienceSettings): HomepageRuntimeSnapshot => ({
  homepageTemplate: settings.homepageTemplate,
  rolloutMode: settings.rolloutMode,
  allowPreviewQuery: settings.allowPreviewQuery,
  previewQueryParam: settings.previewQueryParam,
  legacyHomepageEnabled: settings.legacyHomepageEnabled,
});

const areHomepageRuntimeSnapshotsEqual = (a: HomepageRuntimeSnapshot, b: HomepageRuntimeSnapshot) =>
  a.homepageTemplate === b.homepageTemplate &&
  a.rolloutMode === b.rolloutMode &&
  a.allowPreviewQuery === b.allowPreviewQuery &&
  a.previewQueryParam === b.previewQueryParam &&
  a.legacyHomepageEnabled === b.legacyHomepageEnabled;

const normalizeHomepageRuntimeSnapshot = (input: unknown): HomepageRuntimeSnapshot | null => {
  if (!input || typeof input !== 'object') return null;
  const row = input as Record<string, unknown>;
  const homepageTemplateRaw = String(row.homepageTemplate || '').trim().toUpperCase();
  const homepageTemplate =
    (homepageTemplateRaw === 'KIMI' ? 'JENKS' : homepageTemplateRaw) as HomepageTemplate;
  const rolloutMode = String(row.rolloutMode || '').trim().toUpperCase() as HomepageRolloutMode;
  const allowPreviewQuery = getBoolean(row.allowPreviewQuery);
  const previewQueryParam = String(row.previewQueryParam || '').trim();
  const legacyHomepageEnabled = getBoolean(row.legacyHomepageEnabled);
  const resolvedLegacyHomepageEnabled =
    typeof legacyHomepageEnabled === 'boolean' ? legacyHomepageEnabled : true;
  if (!HOMEPAGE_TEMPLATES.includes(homepageTemplate)) return null;
  if (!HOMEPAGE_ROLLOUT_MODES.includes(rolloutMode)) return null;
  if (typeof allowPreviewQuery !== 'boolean') return null;
  if (!/^[A-Za-z0-9_-]{2,40}$/.test(previewQueryParam)) return null;
  return {
    homepageTemplate:
      !resolvedLegacyHomepageEnabled && homepageTemplate === 'LEGACY' ? 'JENKS' : homepageTemplate,
    rolloutMode,
    allowPreviewQuery,
    previewQueryParam,
    legacyHomepageEnabled: resolvedLegacyHomepageEnabled,
  };
};

const parseHomepageRuntimeAuditEntry = (row: any): HomepageRuntimeAuditEntry | null => {
  const action = String(row?.action || '').trim().toUpperCase() as HomepageRuntimeAuditAction;
  if (!HOMEPAGE_RUNTIME_AUDIT_ACTIONS.includes(action)) return null;
  let previousRaw: unknown = null;
  let nextRaw: unknown = null;
  let healthSummaryRaw: unknown = null;
  let metadataRaw: unknown = null;
  try {
    previousRaw = JSON.parse(String(row?.previousValue || '{}'));
  } catch {
    previousRaw = null;
  }
  try {
    nextRaw = JSON.parse(String(row?.nextValue || '{}'));
  } catch {
    nextRaw = null;
  }
  try {
    healthSummaryRaw = row?.healthSummary ? JSON.parse(String(row.healthSummary)) : null;
  } catch {
    healthSummaryRaw = null;
  }
  try {
    metadataRaw = row?.metadata ? JSON.parse(String(row.metadata)) : {};
  } catch {
    metadataRaw = {};
  }
  const previous = normalizeHomepageRuntimeSnapshot(previousRaw);
  const next = normalizeHomepageRuntimeSnapshot(nextRaw);
  if (!previous || !next) return null;
  const parsedHealthSummary =
    healthSummaryRaw && typeof healthSummaryRaw === 'object'
      ? (healthSummaryRaw as HomepageRuntimeHealthResult)
      : null;
  const metadata =
    metadataRaw && typeof metadataRaw === 'object' ? (metadataRaw as Record<string, unknown>) : {};
  return {
    id: String(row?.id || ''),
    action,
    reason: String(row?.reason || '').trim(),
    previous,
    next,
    healthSummary: parsedHealthSummary,
    metadata,
    performedByUserId: getString(row?.performedByUserId) || null,
    performedByEmail: getString(row?.performedByEmail) || null,
    createdAt: row?.createdAt ? new Date(row.createdAt) : null,
  };
};

const parseDateInput = (value: unknown): Date | null => {
  const raw = getString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeHomepageRuntimeAuditFilters = (input: Record<string, unknown>): HomepageRuntimeAuditFilters => {
  const actionCandidate = String(input.action || '')
    .trim()
    .toUpperCase() as HomepageRuntimeAuditAction;
  const from = parseDateInput(input.from);
  const to = parseDateInput(input.to);
  const normalized: HomepageRuntimeAuditFilters = {
    action: HOMEPAGE_RUNTIME_AUDIT_ACTIONS.includes(actionCandidate) ? actionCandidate : undefined,
    performedByEmail: getString(input.performedByEmail)?.slice(0, 160),
    from: from || undefined,
    to: to || undefined,
  };
  if (normalized.from && normalized.to && normalized.from.getTime() > normalized.to.getTime()) {
    const swap = normalized.from;
    normalized.from = normalized.to;
    normalized.to = swap;
  }
  return normalized;
};

const listHomepageRuntimeAudit = async (
  limit: number,
  filters: HomepageRuntimeAuditFilters = {},
  maxLimit = 100
) => {
  const normalizedMaxLimit = Number.isFinite(maxLimit) ? Math.max(1, Math.floor(maxLimit)) : 100;
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(normalizedMaxLimit, Math.floor(limit))) : 25;
  const params: unknown[] = [];
  const whereParts: string[] = [];
  if (filters.action) {
    params.push(filters.action);
    whereParts.push(`"action" = $${params.length}`);
  }
  if (filters.performedByEmail) {
    params.push(`%${String(filters.performedByEmail).toLowerCase()}%`);
    whereParts.push(`LOWER(COALESCE("performedByEmail", '')) LIKE $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    whereParts.push(`"createdAt" >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    whereParts.push(`"createdAt" <= $${params.length}`);
  }
  params.push(safeLimit);
  const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT
        "id",
        "action",
        "reason",
        "previousValue",
        "nextValue",
        "healthSummary",
        "metadata",
        "performedByUserId",
        "performedByEmail",
        "createdAt"
      FROM "HomepageRuntimeAudit"
      ${whereClause}
      ORDER BY "createdAt" DESC
      LIMIT $${params.length}`,
    ...params
  );
  return (Array.isArray(rows) ? rows : [])
    .map((entry) => parseHomepageRuntimeAuditEntry(entry))
    .filter((entry): entry is HomepageRuntimeAuditEntry => Boolean(entry));
};

const stringifyCsvCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const buildHomepageRuntimeAuditCsv = (entries: HomepageRuntimeAuditEntry[]) => {
  const header = [
    'id',
    'createdAt',
    'action',
    'fromTemplate',
    'fromRolloutMode',
    'fromAllowPreviewQuery',
    'fromPreviewQueryParam',
    'toTemplate',
    'toRolloutMode',
    'toAllowPreviewQuery',
    'toPreviewQueryParam',
    'performedByEmail',
    'reason',
  ];
  const rows = entries.map((entry) => [
    entry.id,
    entry.createdAt ? entry.createdAt.toISOString() : '',
    entry.action,
    entry.previous.homepageTemplate,
    entry.previous.rolloutMode,
    entry.previous.allowPreviewQuery ? 'true' : 'false',
    entry.previous.previewQueryParam,
    entry.next.homepageTemplate,
    entry.next.rolloutMode,
    entry.next.allowPreviewQuery ? 'true' : 'false',
    entry.next.previewQueryParam,
    entry.performedByEmail || '',
    entry.reason || '',
  ]);
  return [header, ...rows].map((row) => row.map((cell) => stringifyCsvCell(cell)).join(',')).join('\n');
};

const writeHomepageRuntimeAuditEntry = async (input: {
  action: HomepageRuntimeAuditAction;
  reason?: string;
  previous: HomepageRuntimeSnapshot;
  next: HomepageRuntimeSnapshot;
  healthSummary?: HomepageRuntimeHealthResult | null;
  metadata?: Record<string, unknown>;
  performedByUserId?: string | null;
  performedByEmail?: string | null;
}) => {
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageRuntimeAudit"
      ("id", "action", "reason", "previousValue", "nextValue", "healthSummary", "metadata", "performedByUserId", "performedByEmail", "createdAt")
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
    randomUUID(),
    input.action,
    String(input.reason || '').trim(),
    JSON.stringify(input.previous),
    JSON.stringify(input.next),
    input.healthSummary ? JSON.stringify(input.healthSummary) : null,
    input.metadata ? JSON.stringify(input.metadata) : null,
    input.performedByUserId || null,
    input.performedByEmail || null
  );
};

const buildHomepageRuntimeHealth = async (nextSettings: HomepageExperienceSettings): Promise<HomepageRuntimeHealthResult> => {
  const checks: HomepageRuntimeHealthCheck[] = [];

  try {
    await prisma.$queryRawUnsafe(`SELECT 1`);
    checks.push({
      key: 'database',
      label: 'Database connectivity',
      status: 'PASS',
      detail: 'Database read check passed.',
    });
  } catch {
    checks.push({
      key: 'database',
      label: 'Database connectivity',
      status: 'FAIL',
      detail: 'Failed to query the database.',
    });
  }

  const previewParamValid = /^[A-Za-z0-9_-]{2,40}$/.test(nextSettings.previewQueryParam);
  checks.push({
    key: 'previewParam',
    label: 'Preview query parameter',
    status: previewParamValid ? 'PASS' : 'FAIL',
    detail: previewParamValid
      ? `Preview query parameter "${nextSettings.previewQueryParam}" is valid.`
      : 'Preview query parameter must match /^[A-Za-z0-9_-]{2,40}$/',
  });
  checks.push({
    key: 'legacyRuntimeGate',
    label: 'Legacy runtime gate',
    status:
      nextSettings.legacyHomepageEnabled || nextSettings.homepageTemplate !== 'LEGACY'
        ? 'PASS'
        : 'FAIL',
    detail:
      nextSettings.legacyHomepageEnabled
        ? 'Legacy homepage is enabled by runtime policy.'
        : nextSettings.homepageTemplate === 'LEGACY'
          ? 'Legacy homepage is disabled. Switch template to JENKS.'
          : 'Legacy homepage is disabled; Jenks-only mode is active.',
  });

  const enabledBadgesCount = (Array.isArray(nextSettings.trustBadges) ? nextSettings.trustBadges : []).filter(
    (badge) => badge.enabled !== false
  ).length;
  checks.push({
    key: 'trustBadges',
    label: 'Trust badges',
    status: enabledBadgesCount > 0 ? 'PASS' : 'FAIL',
    detail:
      enabledBadgesCount > 0
        ? `${enabledBadgesCount} trust badge(s) enabled.`
        : 'No trust badges are enabled for the selected runtime.',
  });

  try {
    const [activeCountries, activeCategories] = await Promise.all([
      prisma.countryMarquee.count({ where: { isActive: true } }),
      prisma.shopCategory.count({ where: { isActive: true } }),
    ]);
    checks.push({
      key: 'contentCountries',
      label: 'Country content readiness',
      status: activeCountries >= 6 ? 'PASS' : 'WARN',
      detail: `${activeCountries} active country card(s) found.`,
    });
    checks.push({
      key: 'contentCategories',
      label: 'Category content readiness',
      status: activeCategories >= 3 ? 'PASS' : 'WARN',
      detail: `${activeCategories} active category card(s) found.`,
    });
  } catch {
    checks.push({
      key: 'contentCountries',
      label: 'Country content readiness',
      status: 'FAIL',
      detail: 'Could not validate country content readiness.',
    });
    checks.push({
      key: 'contentCategories',
      label: 'Category content readiness',
      status: 'FAIL',
      detail: 'Could not validate category content readiness.',
    });
  }

  if (nextSettings.homepageTemplate === 'JENKS') {
    const requiredCopyFields: Array<keyof HomepageKimiCopy> = [
      'heroEyebrow',
      'shopByEyebrow',
      'shopByTitle',
      'featuredRtwTitle',
      'featuredFabricsTitle',
      'featuredDesignsTitle',
      'designerSpotlightTitle',
      'quickPathRtwLabel',
      'quickPathCustomLabel',
      'quickPathFabricsLabel',
    ];
    const missingCopyFields = requiredCopyFields.filter((key) => !String(nextSettings.kimiCopy?.[key] || '').trim());
    checks.push({
      key: 'jenksCopy',
      label: 'Jenks copy completeness',
      status: missingCopyFields.length === 0 ? 'PASS' : 'FAIL',
      detail:
        missingCopyFields.length === 0
          ? 'All required Jenks copy fields are configured.'
          : `Missing Jenks copy fields: ${missingCopyFields.join(', ')}`,
    });
  }

  const ok = checks.every((check) => check.status !== 'FAIL');
  return {
    ok,
    checkedAt: new Date().toISOString(),
    checks,
  };
};

const readCountryImageGenerationSettings = async () => {
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: { ...COUNTRY_IMAGE_GENERATION_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    return {
      rowId: String(row.id),
      settings: normalizeCountryImageGenerationSettings(JSON.parse(String(row.value || '{}'))),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: { ...COUNTRY_IMAGE_GENERATION_DEFAULTS },
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};

const saveCountryImageGenerationSettings = async (next: Partial<CountryImageGenerationSettings>) => {
  const existing = await readCountryImageGenerationSettings();
  const merged = normalizeCountryImageGenerationSettings({
    ...existing.settings,
    ...next,
  });
  const payload = JSON.stringify(merged);
  if (existing.rowId) {
    await prisma.$executeRawUnsafe(
      `UPDATE "HomepageSectionSetting"
       SET "value" = $1, "updatedAt" = NOW()
       WHERE "id" = $2`,
      payload,
      existing.rowId
    );
    return merged;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "HomepageSectionSetting" ("id", "key", "value", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, NOW(), NOW())`,
    randomUUID(),
    HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY,
    payload
  );
  return merged;
};

const generateCountryImage = async (input: {
  country: string;
  fabrics?: string;
  imageKeyword?: string;
}) => {
  const keyword = getString(input.imageKeyword) || `${input.country} ${input.fabrics || ''}`.trim();
  const fallbackUrl = buildCountryImageFallbackUrl(keyword || input.country);
  try {
    const { settings } = await readCountryImageGenerationSettings();
    if (!settings.enabled || !settings.apiUrl) {
      return fallbackUrl;
    }
    const prompt = settings.promptTemplate
      .replace(/\{country\}/gi, input.country)
      .replace(/\{fabrics\}/gi, input.fabrics || 'African textiles')
      .replace(/\{keywords\}/gi, keyword || input.country);
    const headers: Record<string, string> = {};
    if (settings.apiKey) {
      headers.Authorization = `Bearer ${settings.apiKey}`;
      headers['x-api-key'] = settings.apiKey;
    }
    let response: Response;
    if (settings.requestMethod === 'GET') {
      const templateUrl = String(settings.apiUrl || '').trim();
      if (templateUrl.includes('{prompt}')) {
        const resolvedUrl = templateUrl.replace('{prompt}', encodeURIComponent(prompt));
        const url = new URL(resolvedUrl);
        if (settings.model) url.searchParams.set('model', settings.model);
        return url.toString();
      }
      const url = new URL(templateUrl);
      url.searchParams.set('prompt', prompt);
      if (settings.model) url.searchParams.set('model', settings.model);
      response = await fetch(url.toString(), { method: 'GET', headers });
    } else {
      headers['Content-Type'] = 'application/json';
      response = await fetch(settings.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          model: settings.model || undefined,
          country: input.country,
          keywords: keyword || input.country,
        }),
      });
    }
    if (!response.ok) return fallbackUrl;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('image/')) {
      return response.url || fallbackUrl;
    }
    const json = await response.json().catch(() => null);
    if (!json) return fallbackUrl;
    const direct = typeof json === 'string' ? json : undefined;
    const fromPath = getValueAtPath(json, settings.responseImagePath);
    const resolved =
      (typeof fromPath === 'string' ? fromPath : undefined) ||
      (typeof (json as any)?.url === 'string' ? (json as any).url : undefined) ||
      (typeof (json as any)?.image === 'string' ? (json as any).image : undefined) ||
      direct;
    if (resolved && isLikelyImageUrl(resolved)) {
      return resolved;
    }
    return fallbackUrl;
  } catch {
    return fallbackUrl;
  }
};

type SpotlightProfileView = {
  id: string;
  businessName: string;
  country: string;
  bio?: string;
  vendorType: 'DESIGNER' | 'SELLER';
};

const mapSpotlightProfileName = (
  row: { id: string; businessName?: string | null; user?: { firstName?: string | null; lastName?: string | null; email?: string | null } | null },
  fallbackLabel: string
) => {
  const directName = getString(row.businessName);
  if (directName) return directName;
  const fullName = `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim();
  if (fullName) return fullName;
  return row.user?.email || `${fallbackLabel} ${String(row.id || '').slice(0, 8)}`;
};

const readSpotlightProfilesByIds = async (ids: string[]): Promise<Map<string, SpotlightProfileView>> => {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean)));
  if (uniqueIds.length === 0) return new Map();
  const [designers, sellers] = await Promise.all([
    prisma.designerProfile.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        businessName: true,
        country: true,
        bio: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
    prisma.fabricSellerProfile.findMany({
      where: { id: { in: uniqueIds } },
      select: {
        id: true,
        businessName: true,
        country: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    }),
  ]);

  const mapped = new Map<string, SpotlightProfileView>();
  for (const row of designers) {
    mapped.set(row.id, {
      id: row.id,
      businessName: mapSpotlightProfileName(row, 'Designer'),
      country: getString(row.country) || '',
      bio: getString(row.bio) || undefined,
      vendorType: 'DESIGNER',
    });
  }
  for (const row of sellers) {
    if (mapped.has(row.id)) continue;
    mapped.set(row.id, {
      id: row.id,
      businessName: mapSpotlightProfileName(row, 'Seller'),
      country: getString(row.country) || '',
      bio: undefined,
      vendorType: 'SELLER',
    });
  }
  return mapped;
};

type SpotlightLinkConfig = {
  linkMode: SpotlightLinkMode;
  externalUrl: string | null;
  blogPostId: string | null;
};

type BlogLinkMeta = {
  id: string;
  slug: string;
  title: string;
  audienceType: string;
  isPublished: boolean;
};

const normalizeSpotlightLinkMode = (value: unknown): SpotlightLinkMode =>
  SPOTLIGHT_LINK_MODES.includes(String(value || '').toUpperCase() as SpotlightLinkMode)
    ? (String(value || '').toUpperCase() as SpotlightLinkMode)
    : 'DEFAULT_STORE';

const normalizeSpotlightLinkConfig = (raw: any): SpotlightLinkConfig => ({
  linkMode: normalizeSpotlightLinkMode(raw?.linkMode),
  externalUrl: getString(raw?.externalUrl) || null,
  blogPostId: getString(raw?.blogPostId) || null,
});

const readSpotlightLinkMap = async (spotlightIds: string[]) => {
  await ensureSpotlightLinkSchema();
  const uniqueIds = Array.from(new Set(spotlightIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "spotlightId","linkMode","externalUrl","blogPostId"
     FROM "DesignerSpotlightLink"`
  );
  const map = new Map<string, SpotlightLinkConfig>();
  for (const row of rows || []) {
    const spotlightId = String(row.spotlightId || '').trim();
    if (!spotlightId) continue;
    if (uniqueIds.length > 0 && !uniqueIds.includes(spotlightId)) continue;
    map.set(spotlightId, normalizeSpotlightLinkConfig(row));
  }
  return map;
};

const readBlogLinkMetaMap = async (blogIds: string[], publishedOnly = false) => {
  await ensureBlogSchema();
  const uniqueIds = Array.from(new Set(blogIds.map((id) => String(id || '').trim()).filter(Boolean)));
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","slug","title","audienceType","isPublished"
     FROM "BlogPost"`
  );
  const map = new Map<string, BlogLinkMeta>();
  for (const row of rows || []) {
    const id = String(row.id || '').trim();
    if (!id || !uniqueIds.includes(id)) continue;
    const isPublished = Boolean(row.isPublished);
    if (publishedOnly && !isPublished) continue;
    map.set(id, {
      id,
      slug: String(row.slug || ''),
      title: String(row.title || ''),
      audienceType: String(row.audienceType || '').toUpperCase(),
      isPublished,
    });
  }
  return map;
};

const upsertSpotlightLinkConfig = async (spotlightId: string, input: Partial<SpotlightLinkConfig>) => {
  await ensureSpotlightLinkSchema();
  const normalized = normalizeSpotlightLinkConfig(input);
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id" FROM "DesignerSpotlightLink" WHERE "spotlightId" = $1 LIMIT 1`,
    spotlightId
  );
  const existing = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (existing?.id) {
    await prisma.$executeRawUnsafe(
      `UPDATE "DesignerSpotlightLink"
       SET "linkMode" = $1, "externalUrl" = $2, "blogPostId" = $3, "updatedAt" = NOW()
       WHERE "id" = $4`,
      normalized.linkMode,
      normalized.externalUrl,
      normalized.blogPostId,
      String(existing.id)
    );
    return normalized;
  }
  await prisma.$executeRawUnsafe(
    `INSERT INTO "DesignerSpotlightLink" ("id","spotlightId","linkMode","externalUrl","blogPostId","createdAt","updatedAt")
     VALUES ($1,$2,$3,$4,$5,NOW(),NOW())`,
    randomUUID(),
    spotlightId,
    normalized.linkMode,
    normalized.externalUrl,
    normalized.blogPostId
  );
  return normalized;
};

const deleteSpotlightLinkConfig = async (spotlightId: string) => {
  await ensureSpotlightLinkSchema();
  await prisma.$executeRawUnsafe(`DELETE FROM "DesignerSpotlightLink" WHERE "spotlightId" = $1`, spotlightId);
};

// ==================== PUBLIC ENDPOINTS ====================

router.get('/visibility', async (_req, res) => {
  try {
    const { visibility } = await readHomepageSectionVisibility();
    res.json({ success: true, data: visibility });
  } catch (error) {
    console.error('Error fetching homepage visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch homepage visibility settings.' });
  }
});

router.get('/top-strip', async (_req, res) => {
  try {
    const { settings } = await readTopStripSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top strip settings.' });
  }
});
router.get('/stats-strip', async (_req, res) => {
  try {
    const { settings } = await readStatsStripSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats strip settings.' });
  }
});
router.get('/featured-product-description-settings', async (_req, res) => {
  try {
    const { settings } = await readFeaturedProductDescriptionSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching featured product description settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch featured product description settings.' });
  }
});

router.get('/how-it-works-style', async (_req, res) => {
  try {
    const { settings } = await readHowItWorksStyleSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch how it works style settings.' });
  }
});
router.get('/auth-page-settings', async (_req, res) => {
  try {
    const { settings } = await readAuthPageSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching auth page settings:', error);
    res.json({ success: true, data: { ...AUTH_PAGE_SETTINGS_DEFAULTS } });
  }
});
router.get('/dashboard-clock-weather-settings', async (_req, res) => {
  try {
    const { settings } = await readDashboardClockWeatherSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching dashboard clock/weather settings:', error);
    res.json({ success: true, data: { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS } });
  }
});
router.get('/experience-settings', async (_req, res) => {
  try {
    const { settings } = await readHomepageExperienceSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching homepage experience settings:', error);
    res.json({ success: true, data: { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS } });
  }
});
router.get('/navigation-settings', async (_req, res) => {
  try {
    const { settings } = await readNavigationSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching navigation settings:', error);
    res.json({ success: true, data: normalizeNavigationSettings({}) });
  }
});
router.get('/hero-settings', async (_req, res) => {
  try {
    const { settings } = await readHeroSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    res.json({ success: true, data: normalizeHeroSettings({}) });
  }
});
router.get('/shop-by-blocks-settings', async (_req, res) => {
  try {
    const { settings } = await readShopByBlocksSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching shop-by blocks settings:', error);
    res.json({ success: true, data: normalizeShopByBlocksSettings({}) });
  }
});
router.get('/fresh-drops-settings', async (_req, res) => {
  try {
    const { settings } = await readFreshDropsSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching fresh drops settings:', error);
    res.json({ success: true, data: { ...FRESH_DROPS_SETTINGS_DEFAULTS } });
  }
});
router.get('/newsletter-settings', async (_req, res) => {
  try {
    const { settings } = await readNewsletterSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching newsletter settings:', error);
    res.json({ success: true, data: { ...NEWSLETTER_SETTINGS_DEFAULTS } });
  }
});
router.post('/newsletter-subscribe', async (req, res) => {
  try {
    const payload = newsletterSubscribeSchema.parse(req.body || {});
    const normalizedEmail = String(payload.email || '').trim().toLowerCase();
    const source = String(payload.source || 'HOMEPAGE').trim().toUpperCase().slice(0, 80) || 'HOMEPAGE';
    const metadata = payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {};
    await ensureNewsletterSubscriptionSchema();
    const existingRows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT "id"
       FROM "NewsletterSubscription"
       WHERE LOWER("email") = LOWER($1)
       LIMIT 1`,
      normalizedEmail
    );
    const existing = Array.isArray(existingRows) && existingRows.length > 0 ? existingRows[0] : null;
    if (existing?.id) {
      await prisma.$executeRawUnsafe(
        `UPDATE "NewsletterSubscription"
         SET "source" = $1, "metadata" = $2, "updatedAt" = NOW()
         WHERE "id" = $3`,
        source,
        JSON.stringify(metadata),
        String(existing.id)
      );
      return res.json({
        success: true,
        data: { status: 'ALREADY_SUBSCRIBED', email: normalizedEmail },
      });
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO "NewsletterSubscription"
       ("id", "email", "source", "metadata", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, NOW(), NOW())`,
      randomUUID(),
      normalizedEmail,
      source,
      JSON.stringify(metadata)
    );
    return res.status(201).json({
      success: true,
      data: { status: 'SUBSCRIBED', email: normalizedEmail },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error subscribing newsletter:', error);
    return res.status(500).json({ success: false, message: 'Failed to subscribe newsletter.' });
  }
});

router.get(['/jenks-homepage-payload', '/kimi-homepage-payload'], async (_req, res) => {
  const safeResult = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
    result.status === 'fulfilled' ? result.value : fallback;

  const readFeaturedCollectionsPayload = async () => {
    const sections = ['FEATURED_DESIGNS', 'FEATURED_FABRICS', 'FEATURED_READY_TO_WEAR', 'TRENDING_NOW'] as const;
    const result: Record<string, any[]> = {
      FEATURED_DESIGNS: [],
      FEATURED_FABRICS: [],
      FEATURED_READY_TO_WEAR: [],
      TRENDING_NOW: [],
    };
    const rows = await prisma.featuredProduct.findMany({
      where: {
        isActive: true,
        section: { in: [...sections] as any[] },
      },
      orderBy: [{ section: 'asc' }, { displayOrder: 'asc' }],
      take: 100,
    });

    const toImage = (images: Array<{ url: string }> | null | undefined) =>
      Array.isArray(images) && images.length > 0 ? String(images[0]?.url || '') : '';

    const hydrate = async (row: any) => {
      const productType = String(row?.productType || '').toUpperCase();
      if (productType === 'DESIGN') {
        const product = await prisma.design.findUnique({
          where: { id: String(row.productId || '') },
          include: {
            designer: {
              select: {
                businessName: true,
                country: true,
              },
            },
            images: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
        if (!product) return null;
        return {
          id: product.id,
          name: String(row?.customTitle || product.name || ''),
          description: String(row?.customDescription || product.description || ''),
          price: Number(product.basePrice ?? product.finalPrice ?? 0),
          image: toImage(product.images as any) || '/images/placeholder.jpg',
          designer: product.designer?.businessName || 'Designer',
          country: product.designer?.country || '',
          productType: 'DESIGN',
          productLabels: [],
        };
      }
      if (productType === 'FABRIC') {
        const product = await prisma.fabric.findUnique({
          where: { id: String(row.productId || '') },
          include: {
            seller: {
              select: {
                businessName: true,
                country: true,
              },
            },
            images: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
        if (!product) return null;
        return {
          id: product.id,
          name: String(row?.customTitle || product.name || ''),
          description: String(row?.customDescription || product.description || ''),
          price: Number(product.sellerPrice ?? product.finalPrice ?? 0),
          image: toImage(product.images as any) || '/images/placeholder.jpg',
          designer: product.seller?.businessName || 'Fabric Seller',
          country: product.seller?.country || '',
          productType: 'FABRIC',
          productLabels: [],
        };
      }
      if (productType === 'READY_TO_WEAR') {
        const product = await prisma.readyToWear.findUnique({
          where: { id: String(row.productId || '') },
          include: {
            designer: {
              select: {
                businessName: true,
                country: true,
              },
            },
            images: {
              take: 1,
              orderBy: { sortOrder: 'asc' },
            },
          },
        });
        if (!product) return null;
        return {
          id: product.id,
          name: String(row?.customTitle || product.name || ''),
          description: String(row?.customDescription || product.description || ''),
          price: Number(product.basePrice || 0),
          image: toImage(product.images as any) || '/images/placeholder.jpg',
          designer: product.designer?.businessName || 'Designer',
          country: product.designer?.country || '',
          productType: 'READY_TO_WEAR',
          productLabels: [],
        };
      }
      return null;
    };

    const hydrated = await Promise.all(
      rows.map(async (row) => {
        const data = await hydrate(row);
        if (!data) return null;
        return {
          section: String(row.section || ''),
          displayOrder: Number(row.displayOrder || 0),
          data,
        };
      })
    );

    for (const entry of hydrated) {
      if (!entry) continue;
      if (!Array.isArray(result[entry.section])) continue;
      result[entry.section].push({
        ...entry.data,
        __displayOrder: entry.displayOrder,
      });
    }

    for (const sectionKey of sections) {
      result[sectionKey] = (result[sectionKey] || [])
        .sort((a, b) => Number(a?.__displayOrder || 0) - Number(b?.__displayOrder || 0))
        .slice(0, 6)
        .map((entry) => {
          const next = { ...entry };
          delete (next as any).__displayOrder;
          return next;
        });
    }

    return result;
  };

  const readManagedBanners = async () => {
    const rows = await prisma.banner.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    return rows.map((banner) => ({
      ...banner,
      displayImage:
        Array.isArray(banner.images) && banner.images.length > 0
          ? banner.images[Math.floor(Math.random() * banner.images.length)]
          : null,
    }));
  };

  const readPromoBadgeSettings = async () => {
    const rows = await prisma.$queryRawUnsafe<Array<{ value: string }>>(
      `SELECT "value"
       FROM "HomepageSectionSetting"
       WHERE "key" = $1
       LIMIT 1`,
      HOMEPAGE_PROMO_BADGE_SETTINGS_KEY
    );
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!row?.value) return { ...PROMO_BADGE_DEFAULTS };
    try {
      const parsed = JSON.parse(String(row.value || '{}')) as Record<string, unknown>;
      const valueText = getString(parsed.valueText) || PROMO_BADGE_DEFAULTS.valueText;
      const labelText = getString(parsed.labelText) || PROMO_BADGE_DEFAULTS.labelText;
      return { valueText, labelText };
    } catch {
      return { ...PROMO_BADGE_DEFAULTS };
    }
  };

  const readDesignerSpotlightsPayload = async () => {
    const spotlights = await prisma.designerSpotlight.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });
    const designerIds = spotlights.map((spotlight) => spotlight.designerId);
    const spotlightIds = spotlights.map((spotlight) => spotlight.id);
    const [profilesById, spotlightLinkMap] = await Promise.all([
      readSpotlightProfilesByIds(designerIds),
      readSpotlightLinkMap(spotlightIds),
    ]);
    const blogIds = Array.from(
      new Set(
        spotlights
          .map((spotlight) => spotlightLinkMap.get(spotlight.id)?.blogPostId || null)
          .filter((value): value is string => Boolean(value))
      )
    );
    const blogMap = await readBlogLinkMetaMap(blogIds, true);
    return spotlights.map((spotlight) => ({
      ...spotlight,
      designer: profilesById.get(spotlight.designerId)
        ? {
            id: profilesById.get(spotlight.designerId)!.id,
            businessName: profilesById.get(spotlight.designerId)!.businessName,
            country: profilesById.get(spotlight.designerId)!.country,
            bio: profilesById.get(spotlight.designerId)!.bio || null,
          }
        : null,
      vendorType: profilesById.get(spotlight.designerId)?.vendorType || null,
      linkMode: spotlightLinkMap.get(spotlight.id)?.linkMode || 'DEFAULT_STORE',
      externalUrl: spotlightLinkMap.get(spotlight.id)?.externalUrl || null,
      blogPostId: spotlightLinkMap.get(spotlight.id)?.blogPostId || null,
      blog:
        spotlightLinkMap.get(spotlight.id)?.blogPostId &&
        blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))
          ? {
              id: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.id,
              slug: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug,
              title: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.title,
              audienceType: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.audienceType,
              url: `/stories/${blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug}`,
            }
          : null,
    }));
  };

  try {
    const [
      visibilityResult,
      topStripResult,
      statsStripResult,
      howItWorksStyleResult,
      featuredDescriptionResult,
      authPageSettingsResult,
      dashboardClockWeatherSettingsResult,
      experienceSettingsResult,
      navigationSettingsResult,
      heroSettingsResult,
      heroSlidesResult,
      managedBannersResult,
      promoBadgeResult,
      countriesResult,
      categoriesResult,
      howItWorksResult,
      designerSpotlightsResult,
      featuredCollectionsResult,
      heritageResult,
      testimonialsResult,
      footerResult,
      shopByBlocksResult,
      freshDropsResult,
      newsletterResult,
    ] = await Promise.allSettled([
      readHomepageSectionVisibility().then((row) => row.visibility),
      readTopStripSettings().then((row) => row.settings),
      readStatsStripSettings().then((row) => row.settings),
      readHowItWorksStyleSettings().then((row) => row.settings),
      readFeaturedProductDescriptionSettings().then((row) => row.settings),
      readAuthPageSettings().then((row) => row.settings),
      readDashboardClockWeatherSettings().then((row) => row.settings),
      readHomepageExperienceSettings().then((row) => row.settings),
      readNavigationSettings().then((row) => row.settings),
      readHeroSettings().then((row) => row.settings),
      prisma.heroSlide.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      readManagedBanners(),
      readPromoBadgeSettings(),
      prisma.countryMarquee.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.shopCategory.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.howItWorksStep.findMany({
        where: { isActive: true },
        orderBy: { stepNumber: 'asc' },
      }),
      readDesignerSpotlightsPayload(),
      readFeaturedCollectionsPayload(),
      prisma.heritageSection.findFirst({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.testimonial.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      }),
      prisma.footerContent.findFirst(),
      readShopByBlocksSettings().then((row) => row.settings),
      readFreshDropsSettings().then((row) => row.settings),
      readNewsletterSettings().then((row) => row.settings),
    ]);

    const managedBanners = safeResult(managedBannersResult, []);
    const promoBadge = safeResult(promoBadgeResult, { ...PROMO_BADGE_DEFAULTS });
    const freshDropsSettings = safeResult(freshDropsResult, { ...FRESH_DROPS_SETTINGS_DEFAULTS });
    const promoBanner =
      (Array.isArray(managedBanners)
        ? managedBanners.find((row: any) => String(row?.section || '').toUpperCase() === 'PROMO')
        : null) || null;
    const payloadBody = {
      visibility: safeResult(visibilityResult, { ...HOMEPAGE_SECTION_VISIBILITY_DEFAULTS }),
      topStrip: safeResult(topStripResult, { ...TOP_STRIP_DEFAULTS }),
      statsStrip: safeResult(statsStripResult, { ...STATS_STRIP_DEFAULTS }),
      howItWorksStyle: safeResult(howItWorksStyleResult, { ...HOW_IT_WORKS_STYLE_DEFAULTS }),
      featuredProductDescription: safeResult(featuredDescriptionResult, {
        ...FEATURED_PRODUCT_DESCRIPTION_DEFAULTS,
      }),
      authPageSettings: safeResult(authPageSettingsResult, { ...AUTH_PAGE_SETTINGS_DEFAULTS }),
      dashboardClockWeatherSettings: safeResult(dashboardClockWeatherSettingsResult, {
        ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS,
      }),
      experienceSettings: safeResult(experienceSettingsResult, { ...HOMEPAGE_EXPERIENCE_SETTINGS_DEFAULTS }),
      navigationSettings: safeResult(navigationSettingsResult, normalizeNavigationSettings({})),
      heroSettings: safeResult(heroSettingsResult, normalizeHeroSettings({})),
      heroSlides: safeResult(heroSlidesResult, []),
      managedBanners,
      promoBadge,
      countries: safeResult(countriesResult, []),
      categories: safeResult(categoriesResult, []),
      howItWorks: safeResult(howItWorksResult, []),
      designerSpotlights: safeResult(designerSpotlightsResult, []),
      featuredCollections: safeResult(featuredCollectionsResult, {
        FEATURED_DESIGNS: [],
        FEATURED_FABRICS: [],
        FEATURED_READY_TO_WEAR: [],
        TRENDING_NOW: [],
      }),
      heritage: safeResult(heritageResult, null),
      testimonials: safeResult(testimonialsResult, []),
      footer: safeResult(footerResult, null),
      shopByBlocks: safeResult(shopByBlocksResult, normalizeShopByBlocksSettings({})),
      freshDrops: {
        ...freshDropsSettings,
        title: getString(freshDropsSettings?.title) || getString(promoBanner?.title) || FRESH_DROPS_SETTINGS_DEFAULTS.title,
        subtitle:
          getString(freshDropsSettings?.subtitle) ||
          getString(promoBanner?.subtitle) ||
          FRESH_DROPS_SETTINGS_DEFAULTS.subtitle,
        ctaText:
          getString(freshDropsSettings?.ctaText) ||
          getString(promoBanner?.ctaText) ||
          FRESH_DROPS_SETTINGS_DEFAULTS.ctaText,
        ctaLink:
          getString(freshDropsSettings?.ctaLink) ||
          getString(promoBanner?.ctaLink) ||
          FRESH_DROPS_SETTINGS_DEFAULTS.ctaLink,
        badgeValueText: getString(freshDropsSettings?.badgeValueText) || getString(promoBadge?.valueText) || PROMO_BADGE_DEFAULTS.valueText,
        badgeLabelText: getString(freshDropsSettings?.badgeLabelText) || getString(promoBadge?.labelText) || PROMO_BADGE_DEFAULTS.labelText,
      },
      newsletter: {
        ...safeResult(newsletterResult, { ...NEWSLETTER_SETTINGS_DEFAULTS }),
        subscribeEndpoint: '/api/homepage-sections/newsletter-subscribe',
      },
    };
    const contractVersion = 'JENKS_HOMEPAGE_PAYLOAD_V1';
    const payloadChecksum = createHash('sha256')
      .update(JSON.stringify({ contractVersion, payload: payloadBody }))
      .digest('hex');
    res.json({
      success: true,
      data: {
        contractVersion,
        generatedAt: new Date().toISOString(),
        payloadChecksum,
        ...payloadBody,
      },
    });
  } catch (error) {
    console.error('Error fetching jenks homepage payload:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch jenks homepage payload',
    });
  }
});

// Get all active countries for marquee
router.get('/countries', async (req, res) => {
  try {
    const countries = await prisma.countryMarquee.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: countries,
    });
  } catch (error) {
    console.error('Error fetching countries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch countries',
    });
  }
});

// Get all How It Works steps
router.get('/how-it-works', async (req, res) => {
  try {
    const steps = await prisma.howItWorksStep.findMany({
      where: { isActive: true },
      orderBy: { stepNumber: 'asc' },
    });

    res.json({
      success: true,
      data: steps,
    });
  } catch (error) {
    console.error('Error fetching how it works steps:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch how it works steps',
    });
  }
});

// Get all shop categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.shopCategory.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories',
    });
  }
});

// Get active designer spotlight
router.get('/designer-spotlight', async (req, res) => {
  try {
    const spotlight = await prisma.designerSpotlight.findFirst({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (!spotlight) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const profilesById = await readSpotlightProfilesByIds([spotlight.designerId]);
    const spotlightLinkMap = await readSpotlightLinkMap([spotlight.id]);
    const spotlightLink = spotlightLinkMap.get(spotlight.id) || {
      linkMode: 'DEFAULT_STORE' as SpotlightLinkMode,
      externalUrl: null,
      blogPostId: null,
    };
    const blogMap =
      spotlightLink.blogPostId
        ? await readBlogLinkMetaMap([spotlightLink.blogPostId], true)
        : new Map<string, BlogLinkMeta>();
    const blog = spotlightLink.blogPostId ? blogMap.get(spotlightLink.blogPostId) || null : null;
    const profile = profilesById.get(spotlight.designerId) || null;

    res.json({
      success: true,
      data: {
        ...spotlight,
        designer: profile
          ? {
              id: profile.id,
              businessName: profile.businessName,
              country: profile.country,
              bio: profile.bio || null,
            }
          : null,
        vendorType: profile?.vendorType || null,
        linkMode: spotlightLink.linkMode,
        externalUrl: spotlightLink.externalUrl,
        blogPostId: spotlightLink.blogPostId,
        blog: blog
          ? {
              id: blog.id,
              slug: blog.slug,
              title: blog.title,
              audienceType: blog.audienceType,
              url: `/stories/${blog.slug}`,
            }
          : null,
      },
    });
  } catch (error) {
    console.error('Error fetching designer spotlight:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designer spotlight',
    });
  }
});

// Get all active designer spotlights
router.get('/designer-spotlights', async (req, res) => {
  try {
    const spotlights = await prisma.designerSpotlight.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    const designerIds = spotlights.map((spotlight) => spotlight.designerId);
    const spotlightIds = spotlights.map((spotlight) => spotlight.id);
    const [profilesById, spotlightLinkMap] = await Promise.all([
      readSpotlightProfilesByIds(designerIds),
      readSpotlightLinkMap(spotlightIds),
    ]);
    const blogIds = Array.from(
      new Set(
        spotlights
          .map((spotlight) => spotlightLinkMap.get(spotlight.id)?.blogPostId || null)
          .filter((value): value is string => Boolean(value))
      )
    );
    const blogMap = await readBlogLinkMetaMap(blogIds, true);

    res.json({
      success: true,
      data: spotlights.map((spotlight) => ({
        ...spotlight,
        designer: profilesById.get(spotlight.designerId)
          ? {
              id: profilesById.get(spotlight.designerId)!.id,
              businessName: profilesById.get(spotlight.designerId)!.businessName,
              country: profilesById.get(spotlight.designerId)!.country,
              bio: profilesById.get(spotlight.designerId)!.bio || null,
            }
          : null,
        vendorType: profilesById.get(spotlight.designerId)?.vendorType || null,
        linkMode: spotlightLinkMap.get(spotlight.id)?.linkMode || 'DEFAULT_STORE',
        externalUrl: spotlightLinkMap.get(spotlight.id)?.externalUrl || null,
        blogPostId: spotlightLinkMap.get(spotlight.id)?.blogPostId || null,
        blog:
          spotlightLinkMap.get(spotlight.id)?.blogPostId &&
          blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))
            ? {
                id: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.id,
                slug: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug,
                title: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.title,
                audienceType: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.audienceType,
                url: `/stories/${blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug}`,
              }
            : null,
      })),
    });
  } catch (error) {
    console.error('Error fetching designer spotlights:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch designer spotlights',
    });
  }
});

// Get heritage section
router.get('/heritage', async (req, res) => {
  try {
    const heritage = await prisma.heritageSection.findFirst({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: heritage,
    });
  } catch (error) {
    console.error('Error fetching heritage section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch heritage section',
    });
  }
});

// Get all testimonials
router.get('/testimonials', async (req, res) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: 'asc' },
    });

    res.json({
      success: true,
      data: testimonials,
    });
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch testimonials',
    });
  }
});

// Get footer content
router.get('/footer', async (req, res) => {
  try {
    const footer = await prisma.footerContent.findFirst();

    res.json({
      success: true,
      data: footer,
    });
  } catch (error) {
    console.error('Error fetching footer content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch footer content',
    });
  }
});

// ==================== ADMIN ENDPOINTS ====================

router.use(
  '/admin',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  authorizeSuperAdmin
);

router.get('/admin/visibility', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const data = await getHomepageSectionVisibilityForAdmin();
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching homepage section visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch homepage section visibility.' });
  }
});

router.put('/admin/visibility', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = homepageVisibilityUpdateSchema.parse(req.body);
    const allowedKeys = new Set(HOMEPAGE_SECTION_VISIBILITY_META.map((item) => item.key));
    const next: Partial<Record<HomepageVisibilityKey, boolean>> = {};
    for (const [key, enabled] of Object.entries(payload.visibility || {})) {
      if (!allowedKeys.has(key as HomepageVisibilityKey)) continue;
      next[key as HomepageVisibilityKey] = Boolean(enabled);
    }
    await saveHomepageSectionVisibility(next);
    const data = await getHomepageSectionVisibilityForAdmin();
    res.json({ success: true, data });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating homepage section visibility:', error);
    res.status(500).json({ success: false, message: 'Failed to update homepage section visibility.' });
  }
});

router.get('/admin/top-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readTopStripSettings();
    res.json({
      success: true,
      data: {
        ...settings,
        source,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching admin top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch top strip settings.' });
  }
});
router.get('/admin/stats-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readStatsStripSettings();
    res.json({
      success: true,
      data: {
        ...settings,
        source,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching admin stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats strip settings.' });
  }
});
router.get(
  '/admin/featured-product-description-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const { settings, source, updatedAt } = await readFeaturedProductDescriptionSettings();
      res.json({
        success: true,
        data: {
          ...settings,
          source,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('Error fetching admin featured product description settings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch featured product description settings.' });
    }
  }
);

router.put('/admin/top-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = topStripUpdateSchema.parse(req.body);
    const settings = await saveTopStripSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating top strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update top strip settings.' });
  }
});
router.put('/admin/stats-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = statsStripUpdateSchema.parse(req.body);
    const settings = await saveStatsStripSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update stats strip settings.' });
  }
});
router.patch('/admin/stats-strip', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = statsStripUpdateSchema.parse(req.body);
    const settings = await saveStatsStripSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating stats strip settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update stats strip settings.' });
  }
});
router.put(
  '/admin/featured-product-description-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = featuredProductDescriptionUpdateSchema.parse(req.body);
      const settings = await saveFeaturedProductDescriptionSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating featured product description settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update featured product description settings.' });
    }
  }
);
router.patch(
  '/admin/featured-product-description-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = featuredProductDescriptionUpdateSchema.parse(req.body);
      const settings = await saveFeaturedProductDescriptionSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating featured product description settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update featured product description settings.' });
    }
  }
);

router.get('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readHowItWorksStyleSettings();
    res.json({
      success: true,
      data: {
        ...settings,
        source,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching admin how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch how it works style settings.' });
  }
});

router.put('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = howItWorksStyleUpdateSchema.parse(req.body);
    const settings = await saveHowItWorksStyleSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update how it works style settings.' });
  }
});

router.patch('/admin/how-it-works-style', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = howItWorksStyleUpdateSchema.parse(req.body);
    const settings = await saveHowItWorksStyleSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update how it works style settings.' });
  }
});

router.get('/admin/auth-page-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readAuthPageSettings();
    res.json({
      success: true,
      data: {
        ...settings,
        source,
        updatedAt,
      },
    });
  } catch (error) {
    console.error('Error fetching admin auth page settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch auth page settings.' });
  }
});

router.put('/admin/auth-page-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = authPageSettingsUpdateSchema.parse(req.body);
    const settings = await saveAuthPageSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating auth page settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update auth page settings.' });
  }
});

router.patch(
  '/admin/auth-page-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = authPageSettingsUpdateSchema.parse(req.body);
      const settings = await saveAuthPageSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating auth page settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update auth page settings.' });
    }
  }
);
router.get(
  '/admin/dashboard-clock-weather-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const { settings, source, updatedAt } = await readDashboardClockWeatherSettings();
      res.json({
        success: true,
        data: {
          ...settings,
          source,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('Error fetching dashboard clock/weather settings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch dashboard clock/weather settings.' });
    }
  }
);
router.put(
  '/admin/dashboard-clock-weather-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = dashboardClockWeatherSettingsUpdateSchema.parse(req.body);
      const settings = await saveDashboardClockWeatherSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating dashboard clock/weather settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update dashboard clock/weather settings.' });
    }
  }
);
router.patch(
  '/admin/dashboard-clock-weather-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = dashboardClockWeatherSettingsUpdateSchema.parse(req.body);
      const settings = await saveDashboardClockWeatherSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating dashboard clock/weather settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update dashboard clock/weather settings.' });
    }
  }
);

router.get(
  '/admin/experience-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const { settings, source, updatedAt } = await readHomepageExperienceSettings();
      res.json({
        success: true,
        data: {
          ...settings,
          source,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('Error fetching homepage experience settings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch homepage experience settings.' });
    }
  }
);

const resolveRuntimeActor = (req: any) => {
  const user = req?.user || {};
  return {
    performedByUserId: getString(user.id) || null,
    performedByEmail: getString(user.email) || null,
  };
};

const applyHomepageExperienceSettingsUpdate = async (req: any, res: any) => {
  try {
    const payload = homepageExperienceSettingsUpdateSchema.parse(req.body);
    const reason =
      typeof req.body?.changeReason === 'string' ? String(req.body.changeReason).trim().slice(0, 280) : '';

    const existing = await readHomepageExperienceSettings();
    const currentRuntime = getHomepageRuntimeSnapshot(existing.settings);
    const nextMergedSettings = normalizeHomepageExperienceSettings({
      ...existing.settings,
      ...payload,
    });
    const nextRuntime = getHomepageRuntimeSnapshot(nextMergedSettings);
    const runtimeChanged = !areHomepageRuntimeSnapshotsEqual(currentRuntime, nextRuntime);
    const reasonRequired = nextMergedSettings.requireReasonForRuntimeActions === true;

    if (runtimeChanged && reasonRequired && !reason) {
      return res.status(400).json({
        success: false,
        message: 'A reason is required before switching homepage runtime.',
      });
    }

    let runtimeHealth: HomepageRuntimeHealthResult | null = null;
    if (runtimeChanged && nextRuntime.homepageTemplate === 'JENKS' && nextRuntime.rolloutMode === 'LIVE') {
      runtimeHealth = await buildHomepageRuntimeHealth(nextMergedSettings);
      if (!runtimeHealth.ok) {
        return res.status(409).json({
          success: false,
          message: 'Runtime health checks failed. Resolve failing checks before switching Jenks live.',
          data: { runtimeHealth },
        });
      }
    }

    const settings = await saveHomepageExperienceSettings(payload);

    if (runtimeChanged) {
      if (!runtimeHealth && settings.homepageTemplate === 'JENKS' && settings.rolloutMode === 'LIVE') {
        runtimeHealth = await buildHomepageRuntimeHealth(settings);
      }
      const actor = resolveRuntimeActor(req);
      await writeHomepageRuntimeAuditEntry({
        action: 'RUNTIME_SWITCH',
        reason,
        previous: currentRuntime,
        next: getHomepageRuntimeSnapshot(settings),
        healthSummary: runtimeHealth,
        metadata: {
          source: 'admin-experience-settings',
          changedFields: Object.keys(payload || {}),
        },
        performedByUserId: actor.performedByUserId,
        performedByEmail: actor.performedByEmail,
      });
    }

    res.json({ success: true, data: settings, runtimeHealth });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating homepage experience settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update homepage experience settings.' });
  }
};

router.put(
  '/admin/experience-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  applyHomepageExperienceSettingsUpdate
);

router.patch(
  '/admin/experience-settings',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  applyHomepageExperienceSettingsUpdate
);

router.get('/admin/navigation-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readNavigationSettings();
    res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching navigation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch navigation settings.' });
  }
});
router.put('/admin/navigation-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = navigationSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveNavigationSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating navigation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update navigation settings.' });
  }
});
router.patch('/admin/navigation-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = navigationSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveNavigationSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating navigation settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update navigation settings.' });
  }
});

router.get('/admin/hero-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readHeroSettings();
    res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching hero settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch hero settings.' });
  }
});
router.put('/admin/hero-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = heroSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveHeroSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating hero settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update hero settings.' });
  }
});
router.patch('/admin/hero-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = heroSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveHeroSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating hero settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update hero settings.' });
  }
});

router.get('/admin/shop-by-blocks-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readShopByBlocksSettings();
    res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching shop-by blocks settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch shop-by blocks settings.' });
  }
});
router.put('/admin/shop-by-blocks-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = shopByBlocksUpdateSchema.parse(req.body || {});
    const settings = await saveShopByBlocksSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating shop-by blocks settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update shop-by blocks settings.' });
  }
});
router.patch('/admin/shop-by-blocks-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = shopByBlocksUpdateSchema.parse(req.body || {});
    const settings = await saveShopByBlocksSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating shop-by blocks settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update shop-by blocks settings.' });
  }
});

router.get('/admin/fresh-drops-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readFreshDropsSettings();
    res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching fresh drops settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch fresh drops settings.' });
  }
});
router.put('/admin/fresh-drops-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = freshDropsSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveFreshDropsSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating fresh drops settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update fresh drops settings.' });
  }
});
router.patch('/admin/fresh-drops-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = freshDropsSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveFreshDropsSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating fresh drops settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update fresh drops settings.' });
  }
});

router.get('/admin/newsletter-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const { settings, source, updatedAt } = await readNewsletterSettings();
    res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching newsletter settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch newsletter settings.' });
  }
});
router.put('/admin/newsletter-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = newsletterSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveNewsletterSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating newsletter settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update newsletter settings.' });
  }
});
router.patch('/admin/newsletter-settings', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = newsletterSettingsUpdateSchema.parse(req.body || {});
    const settings = await saveNewsletterSettings(payload);
    res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating newsletter settings:', error);
    res.status(500).json({ success: false, message: 'Failed to update newsletter settings.' });
  }
});

router.get(
  '/admin/runtime-health',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const { settings } = await readHomepageExperienceSettings();
      const runtimeHealth = await buildHomepageRuntimeHealth(settings);
      res.json({
        success: true,
        data: {
          runtime: getHomepageRuntimeSnapshot(settings),
          runtimeHealth,
        },
      });
    } catch (error) {
      console.error('Error fetching homepage runtime health:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch runtime health.' });
    }
  }
);

router.post(
  '/admin/runtime-health/dry-run',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = homepageExperienceSettingsUpdateSchema.parse(req.body || {});
      const { settings: currentSettings } = await readHomepageExperienceSettings();
      const nextSettings = normalizeHomepageExperienceSettings({
        ...currentSettings,
        ...payload,
      });
      const runtimeHealth = await buildHomepageRuntimeHealth(nextSettings);
      res.json({
        success: true,
        data: {
          runtime: getHomepageRuntimeSnapshot(nextSettings),
          runtimeHealth,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error running homepage runtime dry-run health check:', error);
      res.status(500).json({ success: false, message: 'Failed to run runtime health dry-run.' });
    }
  }
);

router.get(
  '/admin/runtime-audit',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Math.floor(Number(req.query.limit) || 25)));
      const filters = normalizeHomepageRuntimeAuditFilters(req.query as Record<string, unknown>);
      const entries = await listHomepageRuntimeAudit(limit, filters);
      res.json({ success: true, data: entries });
    } catch (error) {
      console.error('Error fetching homepage runtime audit trail:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch runtime audit trail.' });
    }
  }
);

router.get(
  '/admin/runtime-audit/export',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(5000, Math.floor(Number(req.query.limit) || 1000)));
      const filters = normalizeHomepageRuntimeAuditFilters(req.query as Record<string, unknown>);
      const entries = await listHomepageRuntimeAudit(limit, filters, 5000);
      const csv = buildHomepageRuntimeAuditCsv(entries);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="homepage-runtime-audit-${stamp}.csv"`);
      res.status(200).send(csv);
    } catch (error) {
      console.error('Error exporting homepage runtime audit trail:', error);
      res.status(500).json({ success: false, message: 'Failed to export runtime audit trail.' });
    }
  }
);

router.post(
  '/admin/runtime-rollback',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = runtimeRollbackSchema.parse(req.body || {});
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
            "id",
            "action",
            "reason",
            "previousValue",
            "nextValue",
            "healthSummary",
            "metadata",
            "performedByUserId",
            "performedByEmail",
            "createdAt"
         FROM "HomepageRuntimeAudit"
         ${payload.auditId ? 'WHERE "id" = $1' : ''}
         ORDER BY "createdAt" DESC
         LIMIT 1`,
        ...(payload.auditId ? [payload.auditId] : [])
      );
      const selectedEntry =
        Array.isArray(rows) && rows.length > 0 ? parseHomepageRuntimeAuditEntry(rows[0]) : null;
      if (!selectedEntry) {
        return res.status(404).json({ success: false, message: 'No runtime audit entry found to roll back.' });
      }

      const { settings: currentSettings } = await readHomepageExperienceSettings();
      const currentRuntime = getHomepageRuntimeSnapshot(currentSettings);
      const targetRuntime = selectedEntry.previous;
      const reasonRequired = currentSettings.requireReasonForRuntimeActions === true;
      if (reasonRequired && !String(payload.reason || '').trim()) {
        return res.status(400).json({
          success: false,
          message: 'A reason is required before rolling back homepage runtime.',
        });
      }

      if (areHomepageRuntimeSnapshotsEqual(currentRuntime, targetRuntime)) {
        return res.json({
          success: true,
          message: 'Runtime already matches selected rollback snapshot.',
          data: {
            settings: currentSettings,
            rolledBackFromAuditId: selectedEntry.id,
          },
        });
      }

      const nextSettings = await saveHomepageExperienceSettings(targetRuntime);
      const actor = resolveRuntimeActor(req);
      await writeHomepageRuntimeAuditEntry({
        action: 'RUNTIME_ROLLBACK',
        reason:
          payload.reason ||
          `Rollback applied from audit ${selectedEntry.id}`,
        previous: currentRuntime,
        next: getHomepageRuntimeSnapshot(nextSettings),
        metadata: {
          source: 'admin-runtime-rollback',
          rollbackFromAuditId: selectedEntry.id,
        },
        performedByUserId: actor.performedByUserId,
        performedByEmail: actor.performedByEmail,
      });
      res.json({
        success: true,
        data: {
          settings: nextSettings,
          rolledBackFromAuditId: selectedEntry.id,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error rolling back homepage runtime:', error);
      res.status(500).json({ success: false, message: 'Failed to roll back homepage runtime.' });
    }
  }
);

router.get(
  '/admin/country-image-generation',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (_req, res) => {
    try {
      const { settings, source, updatedAt } = await readCountryImageGenerationSettings();
      res.json({
        success: true,
        data: {
          ...settings,
          source,
          updatedAt,
        },
      });
    } catch (error) {
      console.error('Error fetching country image generation settings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch country image generation settings.' });
    }
  }
);

router.put(
  '/admin/country-image-generation',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = countryImageGenerationUpdateSchema.parse(req.body);
      const settings = await saveCountryImageGenerationSettings(payload);
      res.json({ success: true, data: settings });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error updating country image generation settings:', error);
      res.status(500).json({ success: false, message: 'Failed to update country image generation settings.' });
    }
  }
);

router.get('/admin/country-options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  res.json({
    success: true,
    data: AFRICAN_COUNTRY_OPTIONS,
  });
});

router.get('/admin/designer-options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const [designerUsers, sellerUsers, existingDesignerProfiles, existingSellerProfiles] = await Promise.all([
      prisma.user.findMany({
        where: { role: UserRole.FASHION_DESIGNER },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      }),
      prisma.user.findMany({
        where: { role: UserRole.FABRIC_SELLER },
        select: { id: true, email: true, firstName: true, lastName: true, phone: true },
      }),
      prisma.designerProfile.findMany({ select: { userId: true } }),
      prisma.fabricSellerProfile.findMany({ select: { userId: true } }),
    ]);
    const designerProfileUserIds = new Set(existingDesignerProfiles.map((row) => row.userId));
    const sellerProfileUserIds = new Set(existingSellerProfiles.map((row) => row.userId));
    const missingDesignerProfiles = designerUsers.filter((user) => !designerProfileUserIds.has(user.id));
    const missingSellerProfiles = sellerUsers.filter((user) => !sellerProfileUserIds.has(user.id));

    if (missingDesignerProfiles.length > 0) {
      await prisma.designerProfile.createMany({
        data: missingDesignerProfiles.map((user) => ({
          userId: user.id,
          businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Designer',
          businessEmail: user.email,
          businessPhone: user.phone || '',
          country: '',
          city: '',
          address: '',
        })),
        skipDuplicates: true,
      });
    }

    if (missingSellerProfiles.length > 0) {
      await prisma.fabricSellerProfile.createMany({
        data: missingSellerProfiles.map((user) => ({
          userId: user.id,
          businessName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Seller',
          businessEmail: user.email,
          businessPhone: user.phone || '',
          country: '',
          city: '',
          address: '',
        })),
        skipDuplicates: true,
      });
    }

    const [designersRaw, sellersRaw] = await Promise.all([
      prisma.designerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.fabricSellerProfile.findMany({
        select: {
          id: true,
          businessName: true,
          country: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: [{ createdAt: 'desc' }],
      }),
    ]);

    const designers = designersRaw.map((item) => {
      const businessName = String(item.businessName || '').trim();
      const fallbackName =
        `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() ||
        item.user?.email ||
        `Designer ${String(item.id || '').slice(0, 8)}`;
      return {
        id: item.id,
        ownerUserId: item.user?.id || item.id,
        businessName: businessName || fallbackName,
        country: String(item.country || '').trim(),
        vendorType: 'DESIGNER' as const,
      };
    });
    const sellers = sellersRaw.map((item) => {
      const businessName = String(item.businessName || '').trim();
      const fallbackName =
        `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() ||
        item.user?.email ||
        `Seller ${String(item.id || '').slice(0, 8)}`;
      return {
        id: item.id,
        ownerUserId: item.user?.id || item.id,
        businessName: businessName || fallbackName,
        country: String(item.country || '').trim(),
        vendorType: 'SELLER' as const,
      };
    });
    const options = [...designers, ...sellers].sort((a, b) => a.businessName.localeCompare(b.businessName));
    res.json({
      success: true,
      data: options,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch designer options' });
  }
});

// Country Marquee Admin
router.get('/admin/countries', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const countries = await prisma.countryMarquee.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: countries });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch countries' });
  }
});

router.post('/admin/countries', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const parsed = countryCreateSchema.parse(normalizeCountryInput(req.body));
    const selected = parsed.countryCode ? AFRICAN_COUNTRY_OPTION_BY_CODE.get(parsed.countryCode.toUpperCase()) : undefined;
    const image =
      getString(parsed.image) ||
      (await generateCountryImage({
        country: selected?.name || parsed.name,
        fabrics: parsed.fabrics,
        imageKeyword: parsed.imageKeyword,
      }));
    const data = {
      name: selected?.name || parsed.name,
      flag: selected?.flag || parsed.flag || countryCodeToFlag(parsed.countryCode || ''),
      fabrics: parsed.fabrics || 'African textiles',
      image,
      displayOrder: parsed.displayOrder ?? 0,
      isActive: parsed.isActive ?? true,
    };
    const country = await prisma.countryMarquee.create({ data });
    res.status(201).json({ success: true, data: country });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    res.status(500).json({ success: false, message: 'Failed to create country' });
  }
});

router.post('/admin/countries/generate-image', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const payload = countryImageGenerateSchema.parse(req.body);
    const countryCode = String(payload.countryCode || '').trim().toUpperCase();
    const selected = countryCode ? AFRICAN_COUNTRY_OPTION_BY_CODE.get(countryCode) : undefined;
    const countryName = selected?.name || getString(payload.country) || 'African country';
    const imageUrl = await generateCountryImage({
      country: countryName,
      fabrics: getString(payload.fabrics) || undefined,
      imageKeyword: getString(payload.imageKeyword) || undefined,
    });
    res.json({
      success: true,
      data: {
        image: imageUrl,
        country: countryName,
        countryCode: selected?.code || countryCode || null,
        flag: selected?.flag || (countryCode ? countryCodeToFlag(countryCode) : null),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error generating country image:', error);
    res.status(500).json({ success: false, message: 'Failed to generate country image.' });
  }
});

router.put('/admin/countries/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const parsed = countryUpdateSchema.parse(normalizeCountryInput(req.body));
    const existing = await prisma.countryMarquee.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Country card not found.' });
    }
    const selected = parsed.countryCode ? AFRICAN_COUNTRY_OPTION_BY_CODE.get(parsed.countryCode.toUpperCase()) : undefined;
    const resolvedName = selected?.name || parsed.name || existing.name;
    const resolvedFabrics = parsed.fabrics || existing.fabrics || 'African textiles';
    const shouldRegenerateImage = !getString(parsed.image) && Boolean(getString(parsed.imageKeyword));
    const resolvedImage =
      getString(parsed.image) ||
      (shouldRegenerateImage
        ? await generateCountryImage({
            country: resolvedName,
            fabrics: resolvedFabrics,
            imageKeyword: parsed.imageKeyword,
          })
        : existing.image) ||
      (await generateCountryImage({
        country: resolvedName,
        fabrics: resolvedFabrics,
        imageKeyword: parsed.imageKeyword,
      }));
    const data = {
      ...(parsed.name ? { name: resolvedName } : selected ? { name: selected.name } : {}),
      ...(parsed.flag ? { flag: parsed.flag } : selected ? { flag: selected.flag } : {}),
      ...(parsed.fabrics ? { fabrics: resolvedFabrics } : {}),
      ...(parsed.image || !existing.image ? { image: resolvedImage } : {}),
      ...(typeof parsed.displayOrder === 'number' ? { displayOrder: parsed.displayOrder } : {}),
      ...(typeof parsed.isActive === 'boolean' ? { isActive: parsed.isActive } : {}),
    };
    const country = await prisma.countryMarquee.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: country });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    res.status(500).json({ success: false, message: 'Failed to update country' });
  }
});

router.delete('/admin/countries/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.countryMarquee.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Country deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete country' });
  }
});

// How It Works Steps Admin
router.get('/admin/how-it-works', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const steps = await prisma.howItWorksStep.findMany({
      orderBy: { stepNumber: 'asc' },
    });
    res.json({ success: true, data: steps });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch steps' });
  }
});

router.post('/admin/how-it-works', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = howItWorksCreateSchema.parse(normalizeHowItWorksInput(req.body));
    const step = await prisma.howItWorksStep.create({ data });
    res.status(201).json({ success: true, data: step });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create step' });
  }
});

router.put('/admin/how-it-works/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = howItWorksUpdateSchema.parse(normalizeHowItWorksInput(req.body));
    const step = await prisma.howItWorksStep.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: step });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update step' });
  }
});

router.delete('/admin/how-it-works/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.howItWorksStep.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Step deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete step' });
  }
});

// Shop Categories Admin
router.get('/admin/categories', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const categories = await prisma.shopCategory.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories' });
  }
});

router.post('/admin/categories', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = shopCategoryCreateSchema.parse(normalizeCategoryInput(req.body));
    const category = await prisma.shopCategory.create({ data });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create category' });
  }
});

router.put('/admin/categories/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = shopCategoryUpdateSchema.parse(normalizeCategoryInput(req.body));
    const category = await prisma.shopCategory.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: category });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update category' });
  }
});

router.delete('/admin/categories/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.shopCategory.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete category' });
  }
});

// Designer Spotlight Admin
router.get('/admin/designer-spotlight', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const spotlights = await prisma.designerSpotlight.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    const designerIds = spotlights.map((spotlight) => spotlight.designerId);
    const spotlightIds = spotlights.map((spotlight) => spotlight.id);
    const [profilesById, spotlightLinkMap] = await Promise.all([
      readSpotlightProfilesByIds(designerIds),
      readSpotlightLinkMap(spotlightIds),
    ]);
    const blogIds = Array.from(
      new Set(
        spotlights
          .map((spotlight) => spotlightLinkMap.get(spotlight.id)?.blogPostId || null)
          .filter((value): value is string => Boolean(value))
      )
    );
    const blogMap = await readBlogLinkMetaMap(blogIds, false);
    const data = spotlights.map((spotlight) => ({
      ...spotlight,
      designer: profilesById.get(spotlight.designerId)
        ? {
            id: profilesById.get(spotlight.designerId)!.id,
            businessName: profilesById.get(spotlight.designerId)!.businessName,
            country: profilesById.get(spotlight.designerId)!.country,
          }
        : null,
      vendorType: profilesById.get(spotlight.designerId)?.vendorType || null,
      linkMode: spotlightLinkMap.get(spotlight.id)?.linkMode || 'DEFAULT_STORE',
      externalUrl: spotlightLinkMap.get(spotlight.id)?.externalUrl || null,
      blogPostId: spotlightLinkMap.get(spotlight.id)?.blogPostId || null,
      blog:
        spotlightLinkMap.get(spotlight.id)?.blogPostId &&
        blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))
          ? {
              id: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.id,
              slug: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug,
              title: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.title,
              audienceType: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.audienceType,
              isPublished: blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.isPublished,
              url: `/stories/${blogMap.get(String(spotlightLinkMap.get(spotlight.id)?.blogPostId || ''))!.slug}`,
            }
          : null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch spotlights' });
  }
});

router.post('/admin/designer-spotlight', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const parsed = designerSpotlightCreateSchema.parse(normalizeDesignerSpotlightInput(req.body));
    if (parsed.linkMode === 'BLOG' && parsed.blogPostId) {
      const blogMap = await readBlogLinkMetaMap([parsed.blogPostId], false);
      if (!blogMap.has(parsed.blogPostId)) {
        return res.status(400).json({ success: false, message: 'Selected blog post was not found.' });
      }
    }
    const spotlight = await prisma.designerSpotlight.create({
      data: {
        designerId: parsed.designerId,
        quote: parsed.quote,
        bio: parsed.bio,
        image: parsed.image,
        displayOrder: parsed.displayOrder,
        isActive: parsed.isActive,
      },
    });
    const linkConfig = await upsertSpotlightLinkConfig(spotlight.id, {
      linkMode: normalizeSpotlightLinkMode(parsed.linkMode),
      externalUrl: parsed.externalUrl || null,
      blogPostId: parsed.blogPostId || null,
    });
    res.status(201).json({ success: true, data: { ...spotlight, ...linkConfig } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create spotlight' });
  }
});

router.put('/admin/designer-spotlight/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = designerSpotlightUpdateSchema.parse(normalizeDesignerSpotlightInput(req.body));
    if (data.linkMode === 'BLOG' && data.blogPostId) {
      const blogMap = await readBlogLinkMetaMap([data.blogPostId], false);
      if (!blogMap.has(data.blogPostId)) {
        return res.status(400).json({ success: false, message: 'Selected blog post was not found.' });
      }
    }
    const spotlight = await prisma.designerSpotlight.update({
      where: { id: req.params.id },
      data: {
        ...(data.designerId ? { designerId: data.designerId } : {}),
        ...(data.quote ? { quote: data.quote } : {}),
        ...(data.bio ? { bio: data.bio } : {}),
        ...(data.image ? { image: data.image } : {}),
        ...(typeof data.displayOrder === 'number' ? { displayOrder: data.displayOrder } : {}),
        ...(typeof data.isActive === 'boolean' ? { isActive: data.isActive } : {}),
      },
    });
    const existingLinkMap = await readSpotlightLinkMap([spotlight.id]);
    const existingLink = existingLinkMap.get(spotlight.id) || {
      linkMode: 'DEFAULT_STORE' as SpotlightLinkMode,
      externalUrl: null,
      blogPostId: null,
    };
    const linkConfig = await upsertSpotlightLinkConfig(spotlight.id, {
      linkMode: normalizeSpotlightLinkMode(data.linkMode ?? existingLink.linkMode),
      externalUrl: data.externalUrl !== undefined ? data.externalUrl || null : existingLink.externalUrl,
      blogPostId: data.blogPostId !== undefined ? data.blogPostId || null : existingLink.blogPostId,
    });
    res.json({ success: true, data: { ...spotlight, ...linkConfig } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update spotlight' });
  }
});

router.delete('/admin/designer-spotlight/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await deleteSpotlightLinkConfig(req.params.id);
    await prisma.designerSpotlight.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Spotlight deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete spotlight' });
  }
});

// Heritage Section Admin
router.get('/admin/heritage', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const heritage = await prisma.heritageSection.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: heritage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch heritage' });
  }
});

router.post('/admin/heritage', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = heritageCreateSchema.parse(normalizeHeritageInput(req.body));
    const heritage = await prisma.heritageSection.create({ data });
    res.status(201).json({ success: true, data: heritage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create heritage' });
  }
});

router.put('/admin/heritage/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = heritageUpdateSchema.parse(normalizeHeritageInput(req.body));
    const heritage = await prisma.heritageSection.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: heritage });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update heritage' });
  }
});

router.delete('/admin/heritage/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.heritageSection.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Heritage deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete heritage' });
  }
});

// Testimonials Admin
router.get('/admin/testimonials', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { displayOrder: 'asc' },
    });
    res.json({ success: true, data: testimonials });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
  }
});

router.post('/admin/testimonials', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = testimonialCreateSchema.parse(normalizeTestimonialInput(req.body));
    const testimonial = await prisma.testimonial.create({ data });
    res.status(201).json({ success: true, data: testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
});

router.put('/admin/testimonials/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = testimonialUpdateSchema.parse(normalizeTestimonialInput(req.body));
    const testimonial = await prisma.testimonial.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: testimonial });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update testimonial' });
  }
});

router.delete('/admin/testimonials/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    await prisma.testimonial.delete({ where: { id: req.params.id } });
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
  }
});

// Footer Content Admin
router.get('/admin/footer', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const footer = await prisma.footerContent.findFirst();
    res.json({ success: true, data: footer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch footer' });
  }
});

router.post('/admin/footer', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = footerCreateSchema.parse(normalizeFooterInput(req.body));
    const footer = await prisma.footerContent.create({ data });
    res.status(201).json({ success: true, data: footer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create footer' });
  }
});

router.put('/admin/footer/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = footerUpdateSchema.parse(normalizeFooterInput(req.body));
    const footer = await prisma.footerContent.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: footer });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update footer' });
  }
});

export default router;
