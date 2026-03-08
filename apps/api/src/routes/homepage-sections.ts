import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { AFRICAN_CURRENCY_BASELINE } from '../constants/africanCurrencies';

const router = Router();

const HOMEPAGE_VISIBILITY_SETTINGS_KEY = 'HOMEPAGE_SECTION_VISIBILITY';
const HOMEPAGE_SECTION_VISIBILITY_META = [
  { key: 'hero', label: 'Hero Banner', description: 'Top hero carousel section.' },
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

router.use(async (_req, _res, next) => {
  try {
    await ensureHomepageSettingsSchema();
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

const AFRICAN_COUNTRY_OPTIONS = Array.from(
  new Map(
    AFRICAN_CURRENCY_BASELINE.map((row) => [
      row.countryCode.toUpperCase(),
      {
        code: row.countryCode.toUpperCase(),
        name: row.country,
        flag: countryCodeToFlag(row.countryCode),
      },
    ])
  ).values()
).sort((a, b) => a.name.localeCompare(b.name));

const countryCreateSchema = z.object({
  name: z.string().min(1),
  flag: z.string().min(1),
  fabrics: z.string().min(1),
  image: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const countryUpdateSchema = countryCreateSchema.partial();

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

const designerSpotlightCreateSchema = z.object({
  designerId: z.string().uuid(),
  quote: z.string().min(1),
  bio: z.string().min(1),
  image: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
const normalizeDesignerSpotlightInput = (input: any) => ({
  ...input,
  designerId: getString(input?.designerId) ?? input?.designerId,
  quote: getString(input?.quote) ?? getString(input?.headline) ?? input?.quote,
  bio: getString(input?.bio) ?? getString(input?.description) ?? input?.bio,
  image: getString(input?.image) ?? input?.image,
  displayOrder: getNumber(input?.displayOrder) ?? input?.displayOrder,
  isActive: getBoolean(input?.isActive) ?? input?.isActive,
});
const designerSpotlightUpdateSchema = designerSpotlightCreateSchema.partial();

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

    const designer = await prisma.designerProfile.findUnique({
      where: { id: spotlight.designerId },
      select: {
        id: true,
        businessName: true,
        country: true,
        bio: true,
      },
    });

    res.json({
      success: true,
      data: {
        ...spotlight,
        designer,
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
    const designers = await prisma.designerProfile.findMany({
      where: { id: { in: designerIds } },
      select: {
        id: true,
        businessName: true,
        country: true,
        bio: true,
      },
    });
    const designersById = new Map(designers.map((designer) => [designer.id, designer]));

    res.json({
      success: true,
      data: spotlights.map((spotlight) => ({
        ...spotlight,
        designer: designersById.get(spotlight.designerId) || null,
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

router.get('/admin/country-options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  res.json({
    success: true,
    data: AFRICAN_COUNTRY_OPTIONS,
  });
});

router.get('/admin/designer-options', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    const designers = await prisma.designerProfile.findMany({
      select: {
        id: true,
        businessName: true,
        country: true,
      },
      orderBy: [{ businessName: 'asc' }],
    });
    res.json({
      success: true,
      data: designers,
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
    const data = countryCreateSchema.parse(req.body);
    const country = await prisma.countryMarquee.create({ data });
    res.status(201).json({ success: true, data: country });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create country' });
  }
});

router.put('/admin/countries/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = countryUpdateSchema.parse(req.body);
    const country = await prisma.countryMarquee.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: country });
  } catch (error) {
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
    const designers = await prisma.designerProfile.findMany({
      where: { id: { in: designerIds } },
      select: {
        id: true,
        businessName: true,
        country: true,
      },
    });

    const designersById = new Map(designers.map((designer) => [designer.id, designer]));
    const data = spotlights.map((spotlight) => ({
      ...spotlight,
      designer: designersById.get(spotlight.designerId) || null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch spotlights' });
  }
});

router.post('/admin/designer-spotlight', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = designerSpotlightCreateSchema.parse(normalizeDesignerSpotlightInput(req.body));
    const spotlight = await prisma.designerSpotlight.create({ data });
    res.status(201).json({ success: true, data: spotlight });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to create spotlight' });
  }
});

router.put('/admin/designer-spotlight/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
    const data = designerSpotlightUpdateSchema.parse(normalizeDesignerSpotlightInput(req.body));
    const spotlight = await prisma.designerSpotlight.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ success: true, data: spotlight });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update spotlight' });
  }
});

router.delete('/admin/designer-spotlight/:id', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (req, res) => {
  try {
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
