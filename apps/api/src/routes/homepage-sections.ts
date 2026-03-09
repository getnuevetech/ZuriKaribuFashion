import { Router } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { prisma, UserRole } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';
import { AFRICAN_CURRENCY_BASELINE } from '../constants/africanCurrencies';

const router = Router();

const HOMEPAGE_VISIBILITY_SETTINGS_KEY = 'HOMEPAGE_SECTION_VISIBILITY';
const HOMEPAGE_TOP_STRIP_SETTINGS_KEY = 'HOMEPAGE_TOP_STRIP';
const HOMEPAGE_COUNTRY_IMAGE_GENERATION_SETTINGS_KEY = 'HOMEPAGE_COUNTRY_IMAGE_GENERATION';
const HOMEPAGE_HOW_IT_WORKS_STYLE_SETTINGS_KEY = 'HOMEPAGE_HOW_IT_WORKS_STYLE';
const HOMEPAGE_SECTION_VISIBILITY_META = [
  { key: 'topStrip', label: 'Top Announcement Strip', description: 'Scrolling announcement bar above the hero banner.' },
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

const howItWorksStyleUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  iconColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
  iconHoverColor: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
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

type HowItWorksStyleSettings = {
  enabled: boolean;
  iconColor: string;
  iconHoverColor: string;
};

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

const HOW_IT_WORKS_STYLE_DEFAULTS: HowItWorksStyleSettings = {
  enabled: false,
  iconColor: '#111827',
  iconHoverColor: '#ffffff',
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

const normalizeHowItWorksStyleSettings = (raw: unknown): HowItWorksStyleSettings => {
  if (!raw || typeof raw !== 'object') return { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: getBoolean(row.enabled) ?? HOW_IT_WORKS_STYLE_DEFAULTS.enabled,
    iconColor: normalizeHexColor(row.iconColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconColor),
    iconHoverColor: normalizeHexColor(row.iconHoverColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconHoverColor),
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

router.get('/how-it-works-style', async (_req, res) => {
  try {
    const { settings } = await readHowItWorksStyleSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching how it works style settings:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch how it works style settings.' });
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
    const profilesById = await readSpotlightProfilesByIds(designerIds);

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
            select: { firstName: true, lastName: true, email: true },
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
            select: { firstName: true, lastName: true, email: true },
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
    const profilesById = await readSpotlightProfilesByIds(designerIds);
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
