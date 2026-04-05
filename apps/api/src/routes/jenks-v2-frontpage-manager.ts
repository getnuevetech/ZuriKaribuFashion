import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import { authenticate, authorizePermissions } from '../middleware/auth';
import { Permissions } from '../rbac';

const router = Router();

const SETTINGS_KEY = 'JENKS_V2_FRONTPAGE_MANAGER_SETTINGS';
const CONTRACT_VERSION = 'JENKS_V2_FRONTPAGE_MANAGER_V1';
const TEMPLATE_KEYS = [
  'TOP_NAVIGATIONS',
  'SHOP_BY',
  'CATEGORY_MANAGE',
  'HOW_IT_WORKS',
  'CUSTOM_TEXT_ICON',
  'SHOP_WITH_CONFIDENCE',
  'FEATURED',
  'FRESH_DROPS',
  'DESIGNER_SPOTLIGHT',
  'HERITAGE',
  'CUSTOMER_REVIEWS',
  'NEWSLETTER_FOOTER',
] as const;

type TemplateKey = (typeof TEMPLATE_KEYS)[number];
type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
type CountMode = 'STATIC' | 'DATABASE';

type MenuLink = {
  id: string;
  label: string;
  href: string;
  routeKey?: string;
  icon?: string;
  enabled: boolean;
};

type CtaStyle = {
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  borderWidth: number;
  hoverTextColor: string;
  hoverBorderColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
};

type HeroBanner = {
  id: string;
  enabled: boolean;
  displayOrder: number;
  image: string;
  rightPanelBackgroundMode: 'NONE' | 'IMAGE';
  rightPanelBackgroundImage: string;
  textVerticalAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
  leftWidthPercent: number;
  rightWidthPercent: number;
  tag: string;
  title: string;
  titleFontSize: number;
  text: string;
  textEnabled: boolean;
  description: string;
  descriptionEnabled: boolean;
  descriptionFontSize: number;
  primaryCtaEnabled: boolean;
  primaryCtaText: string;
  primaryCtaLink: string;
  primaryCtaStyle: CtaStyle;
  secondaryCtaEnabled: boolean;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  secondaryCtaStyle: CtaStyle;
  tertiaryCtaEnabled: boolean;
  tertiaryCtaText: string;
  tertiaryCtaLink: string;
  tertiaryCtaStyle: CtaStyle;
};

type TopNavigationsSettings = {
  topStripEnabled: boolean;
  topStripConfig: {
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
  hamburgerMenu: MenuLink[];
  hamburgerMenuFontSize: number;
  hamburgerMenuFontWeight: number;
  searchIconEnabled: boolean;
  logo: {
    mode: 'TEXT' | 'IMAGE';
    text: string;
    textColor: string;
    fontFamily: string;
    fontSize: number;
    imageUrl: string;
    altText: string;
    width: number;
    height: number;
  };
  additionalTopMenu: MenuLink[];
  signInMenu: {
    enabled: boolean;
    label: string;
    href: string;
    routeKey?: string;
    icon: string;
  };
  controllers: {
    showControllerIcons: boolean;
    theme: {
      enabled: boolean;
      mode: ThemeMode;
      icon: string;
    };
  };
  heroBanners: HeroBanner[];
};

type ShopByCountry = {
  id: string;
  code: string;
  name: string;
  icon: string;
  productCountMode: 'STATIC' | 'DATABASE_FTB';
  staticProductCount: number;
  enabled: boolean;
  displayOrder: number;
};

type ShopByCategory = {
  id: string;
  key: string;
  title: string;
  description: string;
  image: string;
  icon: string;
  productCountMode: 'STATIC' | 'DATABASE_CATEGORY';
  staticProductCount: number;
  enabled: boolean;
  displayOrder: number;
};

type ShopByCard = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  titleFontSize: number;
  descriptionFontSize: number;
  enabled: boolean;
  displayOrder: number;
};

type ShopByPriceCard = ShopByCard & {
  priceLabel: string;
};

type ShopBySettings = {
  sectionTag: string;
  sectionTitle: string;
  sectionDescription: string;
  sectionDescriptionEnabled: boolean;
  enabledTabs: Array<'CATEGORY' | 'COUNTRY' | 'STYLE' | 'PRICE'>;
  defaultTab: 'CATEGORY' | 'COUNTRY' | 'STYLE' | 'PRICE';
  countriesCountMode: CountMode;
  categoriesCountMode: CountMode;
  countries: ShopByCountry[];
  categories: ShopByCategory[];
  styleCards: ShopByCard[];
  priceCards: ShopByPriceCard[];
};

type CategorySection = {
  id: string;
  key: string;
  title: string;
  tag: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: CtaStyle;
  enabled: boolean;
  displayOrder: number;
};

type TextIconSectionType = 'HOW_IT_WORKS' | 'SHOP_WITH_CONFIDENCE' | 'CUSTOM';
const TEXT_ICON_SECTION_TYPES: TextIconSectionType[] = ['HOW_IT_WORKS', 'CUSTOM', 'SHOP_WITH_CONFIDENCE'];

type TextIconCard = {
  id: string;
  sectionType: TextIconSectionType;
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  displayOrder: number;
};

type TextIconCardStyle = {
  cardMinHeight: number;
  cardWidth: number;
  iconSize: number;
  titleFontSize: number;
  descriptionFontSize: number;
};

type TextIconSectionHeading = {
  title: string;
  titleEnabled: boolean;
  titlePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  titleFontSize: number;
  description: string;
  descriptionEnabled: boolean;
  descriptionFontSize: number;
};

type FeaturedCard = {
  id: string;
  key: string;
  image: string;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaMode: 'URL' | 'PAGE' | 'PRODUCT_GROUP';
  ctaPageKey?: string;
  productGroup: 'ALL' | 'RTW' | 'CTW' | 'FTB';
  ctaStyle: CtaStyle;
  enabled: boolean;
  displayOrder: number;
};

type CustomerReviewStaticMessage = {
  id: string;
  customerName: string;
  location: string;
  message: string;
  rating: number;
  enabled: boolean;
  displayOrder: number;
};

type CustomerReviewsSettings = {
  enabled: boolean;
  sectionTitle: string;
  titleFontSize: number;
  messageFontSize: number;
  metaFontSize: number;
  sourceMode: 'STATIC_ONLY' | 'PRODUCT_REVIEWS_ONLY' | 'BOTH';
  maxItems: number;
  displayMode: 'GRID' | 'SLIDER';
  autoplayEnabled: boolean;
  autoplayIntervalMs: number;
  pauseOnHover: boolean;
  showNavigation: boolean;
  showIndicators: boolean;
  staticMessages: CustomerReviewStaticMessage[];
};

type FreshDropsSettings = {
  sourceMode: 'NEWLY_LISTED' | 'FILTERED';
  listingAgeDays: number;
  countryFilters: string[];
  categoryFilters: string[];
  mixCategoryResults: boolean;
  rows: number;
  columns: number;
  title: string;
  description: string;
};

type DesignerSpotlightCard = {
  id: string;
  image: string;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaStyle: CtaStyle;
  enabled: boolean;
  displayOrder: number;
};

type DesignerSpotlightSettings = {
  rows: number;
  columns: number;
  cards: DesignerSpotlightCard[];
};

type HeritageStat = {
  id: string;
  label: string;
  value: string;
  suffix: string;
  positionX: number;
  positionY: number;
  enabled: boolean;
  displayOrder: number;
};

type HeritageSettings = {
  image: string;
  title: string;
  tag: string;
  description: string;
  storyHtml: string;
  readMoreLabel: string;
  readMoreHref: string;
  statsPosition: 'TOP' | 'MIDDLE' | 'BOTTOM';
  stats: HeritageStat[];
};

type FooterLinkMode = 'PAGE' | 'CUSTOM_URL';

type FooterMapSettings = {
  enabled: boolean;
  image: string;
  overlayColor: string;
  overlayOpacity: number;
  minHeight: number;
};

type FooterLogoSettings = {
  mode: 'TEXT' | 'IMAGE';
  text: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  imageUrl: string;
  altText: string;
  width: number;
  height: number;
};

type LinkItem = {
  id: string;
  label: string;
  icon?: string;
  hrefMode: FooterLinkMode;
  pageKey?: string;
  href: string;
  enabled: boolean;
};

type LinkGroup = {
  id: string;
  title: string;
  links: LinkItem[];
};

type NewsletterFooterSettings = {
  newsletter: {
    enabled: boolean;
    title: string;
    description: string;
    emailPlaceholder: string;
    submitLabel: string;
    successMessage: string;
  };
  footer: {
    enabled: boolean;
    brandText: string;
    logo: FooterLogoSettings;
    address: string;
    contactEmail: string;
    contactPhone: string;
    copyright: string;
    policyLinks: LinkItem[];
    socialLinks: LinkItem[];
    linkGroups: LinkGroup[];
    map: FooterMapSettings;
  };
};

type SectionVisibilityEntry = {
  id: string;
  key: string;
  name: string;
  templateKey: TemplateKey;
  enabled: boolean;
  order: number;
  isCustom: boolean;
  configSnapshot: Record<string, unknown>;
};

type SectionVisibilitySettings = {
  sections: SectionVisibilityEntry[];
  titleSettings: {
    show: boolean;
    align: 'LEFT' | 'CENTER' | 'RIGHT';
  };
};

type JenksV2FrontpageManagerSettings = {
  contractVersion: string;
  topNavigations: TopNavigationsSettings;
  shopBy: ShopBySettings;
  categoryManage: {
    sections: CategorySection[];
  };
  textIconCards: {
    sectionTitles: {
      howItWorks: string;
      custom: string;
      shopWithConfidence: string;
    };
    sectionHeadings: {
      howItWorks: TextIconSectionHeading;
      custom: TextIconSectionHeading;
      shopWithConfidence: TextIconSectionHeading;
    };
    cardStyle: TextIconCardStyle;
    sectionStyles: {
      howItWorks: TextIconCardStyle;
      custom: TextIconCardStyle;
      shopWithConfidence: TextIconCardStyle;
    };
    allowCustomCards: boolean;
    cards: TextIconCard[];
  };
  featured: {
    cards: FeaturedCard[];
  };
  freshDrops: FreshDropsSettings;
  designerSpotlight: DesignerSpotlightSettings;
  heritage: HeritageSettings;
  customerReviews: CustomerReviewsSettings;
  newsletterFooter: NewsletterFooterSettings;
  sectionVisibility: SectionVisibilitySettings;
};

const TEMPLATE_META: Array<{ templateKey: TemplateKey; key: string; name: string }> = [
  { templateKey: 'TOP_NAVIGATIONS', key: 'top-navigations', name: 'Top Navigations' },
  { templateKey: 'SHOP_BY', key: 'shop-by', name: 'Shop By' },
  { templateKey: 'CATEGORY_MANAGE', key: 'category-manage', name: 'Category Manage' },
  { templateKey: 'HOW_IT_WORKS', key: 'how-it-works', name: 'How It Works' },
  { templateKey: 'CUSTOM_TEXT_ICON', key: 'custom-text-icon', name: 'Custom' },
  { templateKey: 'SHOP_WITH_CONFIDENCE', key: 'shop-with-confidence', name: 'Shop With Confidence' },
  { templateKey: 'FEATURED', key: 'featured', name: 'Featured' },
  { templateKey: 'FRESH_DROPS', key: 'fresh-drops', name: 'Fresh Drops' },
  { templateKey: 'DESIGNER_SPOTLIGHT', key: 'designer-spotlight', name: 'Designer Spotlight' },
  { templateKey: 'HERITAGE', key: 'heritage', name: 'Heritage' },
  { templateKey: 'CUSTOMER_REVIEWS', key: 'customer-reviews', name: 'From Our Customers' },
  { templateKey: 'NEWSLETTER_FOOTER', key: 'newsletter-footer', name: 'Newsletter and Footer' },
];

const updateSchema = z.object({
  topNavigations: z.unknown().optional(),
  shopBy: z.unknown().optional(),
  categoryManage: z.unknown().optional(),
  textIconCards: z.unknown().optional(),
  featured: z.unknown().optional(),
  freshDrops: z.unknown().optional(),
  designerSpotlight: z.unknown().optional(),
  heritage: z.unknown().optional(),
  customerReviews: z.unknown().optional(),
  newsletterFooter: z.unknown().optional(),
  sectionVisibility: z.unknown().optional(),
});

const duplicateSectionSchema = z.object({
  name: z.string().trim().min(1).max(80),
  templateKey: z.enum(TEMPLATE_KEYS),
  order: z.number().int().min(1).max(999).optional(),
});

let schemaReady = false;
let schemaPromise: Promise<void> | null = null;
const ensureSettingsSchema = async () => {
  if (schemaReady) return;
  if (schemaPromise) {
    await schemaPromise;
    return;
  }
  schemaPromise = (async () => {
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
    schemaReady = true;
  })();
  try {
    await schemaPromise;
  } finally {
    schemaPromise = null;
  }
};

router.use(async (_req, _res, next) => {
  try {
    await ensureSettingsSchema();
  } catch (error) {
    console.error('Failed to ensure Jenks-V2 manager schema:', error);
  }
  next();
});

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const getString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const next = value.trim();
  return next ? next : undefined;
};

const getBoolean = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const getNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const defaultCtaStyle = (overrides: Partial<CtaStyle> = {}): CtaStyle => ({
  backgroundColor: '#e66045',
  textColor: '#ffffff',
  borderColor: '#e66045',
  borderWidth: 0,
  hoverTextColor: '#ffffff',
  hoverBorderColor: '#e66045',
  fontFamily: 'Montserrat, Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  ...overrides,
});

const normalizeCtaStyle = (raw: unknown, fallback: CtaStyle): CtaStyle => {
  const row = asRecord(raw);
  return {
    backgroundColor: (getString(row.backgroundColor) || fallback.backgroundColor).slice(0, 40),
    textColor: (getString(row.textColor) || fallback.textColor).slice(0, 40),
    borderColor: (getString(row.borderColor) || fallback.borderColor).slice(0, 40),
    borderWidth: clamp(Math.round(getNumber(row.borderWidth) ?? fallback.borderWidth), 0, 12),
    hoverTextColor: (getString(row.hoverTextColor) || fallback.hoverTextColor).slice(0, 40),
    hoverBorderColor: (getString(row.hoverBorderColor) || fallback.hoverBorderColor).slice(0, 40),
    fontFamily: (getString(row.fontFamily) || fallback.fontFamily).slice(0, 120),
    fontSize: clamp(Math.round(getNumber(row.fontSize) ?? fallback.fontSize), 8, 72),
    fontWeight: clamp(Math.round(getNumber(row.fontWeight) ?? fallback.fontWeight), 100, 900),
  };
};

const mapLegacyV2Href = (value: string): string => {
  const normalized = value.trim();
  if (
    normalized === '/main' ||
    normalized === '/main/' ||
    normalized.startsWith('/main?') ||
    normalized.startsWith('/main#') ||
    normalized === '/shop' ||
    normalized === '/shop/' ||
    normalized.startsWith('/shop?') ||
    normalized.startsWith('/shop#')
  ) {
    if (normalized.startsWith('/shop?') || normalized.startsWith('/shop#')) {
      return `/ready-to-wear${normalized.slice('/shop'.length)}`;
    }
    return '/ready-to-wear';
  }
  return normalized;
};

const PAGE_HREF_BY_KEY: Record<string, string> = {
  HOME: '/',
  READY_TO_WEAR: '/ready-to-wear',
  CUSTOM_TO_WEAR: '/custom',
  FABRICS: '/fabrics',
  COUNTRY_PRODUCTS: '/country-products',
  ABOUT: '/about',
  CONTACT: '/contact',
  HELP_CENTER: '/help-center',
  AUTH_LOGIN: '/auth/login',
};

const resolveFooterPageHref = (pageKey: unknown, fallbackHref: string) => {
  const token = String(pageKey || '').trim().toUpperCase();
  if (token && PAGE_HREF_BY_KEY[token]) return PAGE_HREF_BY_KEY[token];
  return mapLegacyV2Href(fallbackHref);
};

const normalizeHref = (value: unknown, fallback: string) => {
  const next = getString(value);
  if (!next) return mapLegacyV2Href(fallback);
  if (/^https?:\/\//i.test(next)) return next;
  if (!next.startsWith('/')) return mapLegacyV2Href(fallback);
  return mapLegacyV2Href(next);
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const cloneJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const defaultMenuLink = (label: string, href: string, routeKey?: string): MenuLink => ({
  id: randomUUID(),
  label,
  href,
  routeKey,
  icon: '',
  enabled: true,
});

const defaultSettings = (): JenksV2FrontpageManagerSettings => {
  const base: JenksV2FrontpageManagerSettings = {
    contractVersion: CONTRACT_VERSION,
    topNavigations: {
      topStripEnabled: true,
      topStripConfig: {
        messages: ['Made by Africans', 'Worn by the world'],
        separator: '•',
        repeatCount: 4,
        animationSeconds: 36,
        fontSize: 10,
        isBold: true,
        pauseOnHover: true,
        textColor: '#ffffff',
        backgroundColor: '#111111',
      },
      hamburgerMenu: [
        defaultMenuLink('Home', '/', 'HOME'),
        defaultMenuLink('Ready To Wear', '/ready-to-wear', 'READY_TO_WEAR'),
        defaultMenuLink('Fabric To Buy', '/fabrics', 'FABRICS'),
        defaultMenuLink('Custom To Wear', '/custom', 'CUSTOM_TO_WEAR'),
      ],
      hamburgerMenuFontSize: 32,
      hamburgerMenuFontWeight: 800,
      searchIconEnabled: true,
      logo: {
        mode: 'TEXT',
        text: 'JENKS',
        textColor: '#111111',
        fontFamily: 'Montserrat',
        fontSize: 28,
        imageUrl: '',
        altText: 'Jenks',
        width: 180,
        height: 50,
      },
      additionalTopMenu: [
        defaultMenuLink('Shop', '/ready-to-wear', 'SHOP'),
        defaultMenuLink('Contact', '/contact', 'CONTACT'),
      ],
      signInMenu: {
        enabled: true,
        label: 'Sign In',
        href: '/auth/login',
        routeKey: 'AUTH_LOGIN',
        icon: 'User',
      },
      controllers: {
        showControllerIcons: true,
        theme: {
          enabled: true,
          mode: 'SYSTEM',
          icon: 'MoonStar',
        },
      },
      heroBanners: [
        {
          id: randomUUID(),
          enabled: true,
          displayOrder: 0,
          image: '',
          rightPanelBackgroundMode: 'NONE',
          rightPanelBackgroundImage: '',
          textVerticalAlign: 'MIDDLE',
          leftWidthPercent: 58,
          rightWidthPercent: 42,
          tag: 'Editorial Premium',
          title: 'Wear the Story of Africa',
          titleFontSize: 56,
          text: 'Curated fashion from top designers and textile houses.',
          textEnabled: true,
          description:
            'Manage title, copy, tags, CTA labels and links for each hero slide directly from admin.',
          descriptionEnabled: true,
          descriptionFontSize: 16,
          primaryCtaEnabled: true,
          primaryCtaText: 'SHOP NOW',
          primaryCtaLink: '/ready-to-wear',
          primaryCtaStyle: defaultCtaStyle({
            backgroundColor: '#e66045',
            textColor: '#ffffff',
            borderColor: '#e66045',
            borderWidth: 0,
            fontSize: 12,
          }),
          secondaryCtaEnabled: true,
          secondaryCtaText: 'EXPLORE DESIGNERS',
          secondaryCtaLink: '/custom',
          secondaryCtaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#111111',
            borderColor: '#111111',
            borderWidth: 1,
            fontSize: 12,
          }),
          tertiaryCtaEnabled: true,
          tertiaryCtaText: 'SHOP FABRICS',
          tertiaryCtaLink: '/fabrics',
          tertiaryCtaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#111111',
            borderColor: '#111111',
            borderWidth: 1,
            fontSize: 12,
          }),
        },
      ],
    },
    shopBy: {
      sectionTag: 'Discover',
      sectionTitle: 'Shop By',
      sectionDescription: 'Browse by category, country, style, or budget.',
      sectionDescriptionEnabled: true,
      enabledTabs: ['CATEGORY', 'COUNTRY', 'STYLE', 'PRICE'],
      defaultTab: 'CATEGORY',
      countriesCountMode: 'STATIC',
      categoriesCountMode: 'STATIC',
      countries: [
        {
          id: randomUUID(),
          code: 'NG',
          name: 'Nigeria',
          icon: '🇳🇬',
          productCountMode: 'STATIC',
          staticProductCount: 120,
          enabled: true,
          displayOrder: 1,
        },
      ],
      categories: [
        {
          id: randomUUID(),
          key: 'RTW',
          title: 'Ready To Wear',
          description: 'Curated premium ready styles',
          image: '',
          icon: 'Shirt',
          productCountMode: 'STATIC',
          staticProductCount: 90,
          enabled: true,
          displayOrder: 1,
        },
        {
          id: randomUUID(),
          key: 'CTW',
          title: 'Custom To Wear',
          description: 'Made for your measurements',
          image: '',
          icon: 'Scissors',
          productCountMode: 'STATIC',
          staticProductCount: 70,
          enabled: true,
          displayOrder: 2,
        },
        {
          id: randomUUID(),
          key: 'FTB',
          title: 'Fabric To Buy',
          description: 'Authentic textiles and prints',
          image: '',
          icon: 'Package',
          productCountMode: 'STATIC',
          staticProductCount: 150,
          enabled: true,
          displayOrder: 3,
        },
      ],
      styleCards: [
        {
          id: randomUUID(),
          title: 'Occasion',
          description: 'Wedding, Casual, Festival and more',
          href: '/ready-to-wear',
          icon: 'CalendarDays',
          titleFontSize: 15,
          descriptionFontSize: 14,
          enabled: true,
          displayOrder: 1,
        },
      ],
      priceCards: [
        {
          id: randomUUID(),
          title: 'Under $100',
          priceLabel: 'Budget Friendly',
          description: 'Affordable picks for every wardrobe',
          href: '/ready-to-wear?price=under-100',
          icon: 'Tag',
          titleFontSize: 24,
          descriptionFontSize: 14,
          enabled: true,
          displayOrder: 1,
        },
      ],
    },
    categoryManage: {
      sections: [
        {
          id: randomUUID(),
          key: 'RTW',
          title: 'Ready To Wear',
          tag: 'RTW',
          description: 'Manage title, tag, description and CTA for RTW block.',
          ctaText: 'Shop RTW',
          ctaLink: '/ready-to-wear',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 18,
          }),
          enabled: true,
          displayOrder: 1,
        },
        {
          id: randomUUID(),
          key: 'CTW',
          title: 'Custom To Wear',
          tag: 'CTW',
          description: 'Manage title, tag, description and CTA for CTW block.',
          ctaText: 'Explore CTW',
          ctaLink: '/custom',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 18,
          }),
          enabled: true,
          displayOrder: 2,
        },
        {
          id: randomUUID(),
          key: 'FTB',
          title: 'Fabric To Buy',
          tag: 'FTB',
          description: 'Manage title, tag, description and CTA for FTB block.',
          ctaText: 'Shop Fabrics',
          ctaLink: '/fabrics',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 18,
          }),
          enabled: true,
          displayOrder: 3,
        },
      ],
    },
    textIconCards: {
      sectionTitles: {
        howItWorks: 'How It Works',
        custom: 'Custom',
        shopWithConfidence: 'Shop With Confidence',
      },
      sectionHeadings: {
        howItWorks: {
          title: 'How It Works',
          titleEnabled: true,
          titlePosition: 'LEFT',
          titleFontSize: 30,
          description: '',
          descriptionEnabled: false,
          descriptionFontSize: 14,
        },
        custom: {
          title: 'Custom',
          titleEnabled: true,
          titlePosition: 'LEFT',
          titleFontSize: 30,
          description: '',
          descriptionEnabled: false,
          descriptionFontSize: 14,
        },
        shopWithConfidence: {
          title: 'Shop With Confidence',
          titleEnabled: true,
          titlePosition: 'LEFT',
          titleFontSize: 30,
          description: '',
          descriptionEnabled: false,
          descriptionFontSize: 14,
        },
      },
      cardStyle: {
        cardMinHeight: 220,
        cardWidth: 320,
        iconSize: 44,
        titleFontSize: 11,
        descriptionFontSize: 12,
      },
      sectionStyles: {
        howItWorks: {
          cardMinHeight: 220,
          cardWidth: 320,
          iconSize: 44,
          titleFontSize: 11,
          descriptionFontSize: 12,
        },
        custom: {
          cardMinHeight: 220,
          cardWidth: 320,
          iconSize: 44,
          titleFontSize: 11,
          descriptionFontSize: 12,
        },
        shopWithConfidence: {
          cardMinHeight: 220,
          cardWidth: 320,
          iconSize: 44,
          titleFontSize: 11,
          descriptionFontSize: 12,
        },
      },
      allowCustomCards: true,
      cards: [
        {
          id: randomUUID(),
          sectionType: 'HOW_IT_WORKS',
          title: 'How it works',
          description: 'Explain the customer journey step-by-step.',
          icon: 'Workflow',
          enabled: true,
          displayOrder: 1,
        },
        {
          id: randomUUID(),
          sectionType: 'CUSTOM',
          title: 'Custom',
          description: 'Standalone custom text and icon cards.',
          icon: 'Sparkles',
          enabled: true,
          displayOrder: 2,
        },
        {
          id: randomUUID(),
          sectionType: 'SHOP_WITH_CONFIDENCE',
          title: 'Shop with confidence',
          description: 'Trust and support card settings.',
          icon: 'ShieldCheck',
          enabled: true,
          displayOrder: 3,
        },
      ],
    },
    featured: {
      cards: [
        {
          id: randomUUID(),
          key: 'RTW',
          image: '',
          tag: 'Featured RTW',
          title: 'Featured Ready To Wear',
          description: 'Spotlight featured RTW products.',
          ctaText: 'Shop RTW',
          ctaLink: '/ready-to-wear',
          ctaMode: 'PAGE',
          ctaPageKey: 'READY_TO_WEAR',
          productGroup: 'RTW',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 14,
          }),
          enabled: true,
          displayOrder: 1,
        },
        {
          id: randomUUID(),
          key: 'CTW',
          image: '',
          tag: 'Featured CTW',
          title: 'Featured Custom To Wear',
          description: 'Spotlight featured CTW products.',
          ctaText: 'Explore CTW',
          ctaLink: '/custom',
          ctaMode: 'PAGE',
          ctaPageKey: 'CUSTOM_TO_WEAR',
          productGroup: 'CTW',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 14,
          }),
          enabled: true,
          displayOrder: 2,
        },
        {
          id: randomUUID(),
          key: 'FTB',
          image: '',
          tag: 'Featured FTB',
          title: 'Featured Fabric To Buy',
          description: 'Spotlight featured fabric products.',
          ctaText: 'Shop FTB',
          ctaLink: '/fabrics',
          ctaMode: 'PAGE',
          ctaPageKey: 'FABRICS',
          productGroup: 'FTB',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 14,
          }),
          enabled: true,
          displayOrder: 3,
        },
      ],
    },
    freshDrops: {
      sourceMode: 'NEWLY_LISTED',
      listingAgeDays: 14,
      countryFilters: [],
      categoryFilters: ['RTW', 'CTW', 'FTB'],
      mixCategoryResults: true,
      rows: 2,
      columns: 4,
      title: 'Fresh Drops',
      description: 'Latest products, configurable by listing age and category mix.',
    },
    designerSpotlight: {
      rows: 1,
      columns: 3,
      cards: [
        {
          id: randomUUID(),
          image: '',
          tag: 'Designer Spotlight',
          title: 'Meet the Designers',
          description: 'Highlight featured designers.',
          ctaText: 'View Designer',
          ctaLink: '/custom',
          ctaStyle: defaultCtaStyle({
            backgroundColor: 'transparent',
            textColor: '#ffffff',
            borderColor: 'transparent',
            borderWidth: 0,
            fontSize: 14,
          }),
          enabled: true,
          displayOrder: 1,
        },
      ],
    },
    heritage: {
      image: '',
      title: 'Our Heritage',
      tag: 'Culture & Craft',
      description: 'Celebrate African textile heritage with configurable stats and layout.',
      storyHtml:
        "<p>Our heritage is woven from artisan craft, bold silhouettes, and stories passed down across generations.</p>",
      readMoreLabel: 'Read More',
      readMoreHref: '/stories/our-heritage',
      statsPosition: 'BOTTOM',
      stats: [
        {
          id: randomUUID(),
          label: 'Designers',
          value: '500',
          suffix: '+',
          positionX: 12,
          positionY: 80,
          enabled: true,
          displayOrder: 1,
        },
      ],
    },
    customerReviews: {
      enabled: true,
      sectionTitle: 'From Our Customers',
      titleFontSize: 56,
      messageFontSize: 14,
      metaFontSize: 12,
      sourceMode: 'BOTH',
      maxItems: 6,
      displayMode: 'SLIDER',
      autoplayEnabled: true,
      autoplayIntervalMs: 5000,
      pauseOnHover: true,
      showNavigation: true,
      showIndicators: true,
      staticMessages: [
        {
          id: randomUUID(),
          customerName: 'Amara Okafor',
          location: 'Lagos, Nigeria',
          message: 'The quality and finishing exceeded my expectations.',
          rating: 5,
          enabled: true,
          displayOrder: 1,
        },
      ],
    },
    newsletterFooter: {
      newsletter: {
        enabled: true,
        title: 'Join the Movement',
        description: 'Subscribe for curated updates and new drops.',
        emailPlaceholder: 'Enter your email',
        submitLabel: 'Subscribe',
        successMessage: 'You are subscribed.',
      },
      footer: {
        enabled: true,
        brandText: 'Jenks',
        logo: {
          mode: 'TEXT',
          text: 'Jenks',
          textColor: '#ffffff',
          fontFamily: 'Oswald',
          fontSize: 30,
          imageUrl: '',
          altText: 'Jenks',
          width: 180,
          height: 48,
        },
        address: 'Lagos, Nigeria',
        contactEmail: 'support@jenks.africa',
        contactPhone: '+234 000 000 0000',
        copyright: '© Jenks. All rights reserved.',
        policyLinks: [
          { id: randomUUID(), label: 'Privacy Policy', hrefMode: 'PAGE', pageKey: 'HELP_CENTER', href: '/help-center', enabled: true },
          { id: randomUUID(), label: 'Terms of Service', hrefMode: 'PAGE', pageKey: 'HELP_CENTER', href: '/help-center', enabled: true },
        ],
        socialLinks: [
          {
            id: randomUUID(),
            label: 'Instagram',
            icon: 'Instagram',
            hrefMode: 'CUSTOM_URL',
            pageKey: '',
            href: 'https://instagram.com',
            enabled: true,
          },
        ],
        linkGroups: [
          {
            id: randomUUID(),
            title: 'Shop',
            links: [
              {
                id: randomUUID(),
                label: 'Ready To Wear',
                hrefMode: 'PAGE',
                pageKey: 'READY_TO_WEAR',
                href: '/ready-to-wear',
                enabled: true,
              },
              {
                id: randomUUID(),
                label: 'Custom To Wear',
                hrefMode: 'PAGE',
                pageKey: 'CUSTOM_TO_WEAR',
                href: '/custom',
                enabled: true,
              },
            ],
          },
        ],
        map: {
          enabled: false,
          image: '',
          overlayColor: '#0a0a0a',
          overlayOpacity: 55,
          minHeight: 320,
        },
      },
    },
    sectionVisibility: {
      sections: [],
      titleSettings: {
        show: true,
        align: 'LEFT',
      },
    },
  };

  base.sectionVisibility.sections = TEMPLATE_META.map((meta, index) => ({
    id: randomUUID(),
    key: meta.key,
    name: meta.name,
    templateKey: meta.templateKey,
    enabled: true,
    order: index + 1,
    isCustom: false,
    configSnapshot: buildTemplateSnapshot(base, meta.templateKey),
  }));
  return base;
};

const normalizeMenuLink = (raw: unknown, fallback: MenuLink): MenuLink => {
  const row = asRecord(raw);
  return {
    id: getString(row.id) || fallback.id || randomUUID(),
    label: (getString(row.label) || fallback.label).slice(0, 60),
    href: normalizeHref(row.href, fallback.href),
    routeKey: getString(row.routeKey)?.slice(0, 120),
    icon: (getString(row.icon) || fallback.icon || '').slice(0, 60),
    enabled: getBoolean(row.enabled) ?? fallback.enabled,
  };
};

const normalizeHeroBanner = (raw: unknown, fallback: HeroBanner, index: number): HeroBanner => {
  const row = asRecord(raw);
  const modeToken = String(row.rightPanelBackgroundMode || fallback.rightPanelBackgroundMode || 'NONE')
    .trim()
    .toUpperCase();
  const rightPanelBackgroundMode: HeroBanner['rightPanelBackgroundMode'] = modeToken === 'IMAGE' ? 'IMAGE' : 'NONE';
  const alignToken = String(row.textVerticalAlign || fallback.textVerticalAlign || 'MIDDLE')
    .trim()
    .toUpperCase();
  const textVerticalAlign: HeroBanner['textVerticalAlign'] =
    alignToken === 'TOP' || alignToken === 'BOTTOM' ? (alignToken as HeroBanner['textVerticalAlign']) : 'MIDDLE';
  const leftWidthPercent = clamp(Math.round(getNumber(row.leftWidthPercent) ?? fallback.leftWidthPercent), 20, 80);
  const fallbackRightFromLeft = 100 - leftWidthPercent;
  const rightWidthPercent = clamp(
    Math.round(getNumber(row.rightWidthPercent) ?? fallback.rightWidthPercent ?? fallbackRightFromLeft),
    20,
    80
  );
  const combinedWidth = leftWidthPercent + rightWidthPercent;
  const scaledLeftPercent =
    combinedWidth > 0 ? clamp(Math.round((leftWidthPercent / combinedWidth) * 100), 20, 80) : fallback.leftWidthPercent;
  const normalizedLeftWidthPercent = combinedWidth === 100 ? leftWidthPercent : scaledLeftPercent;
  const normalizedRightWidthPercent = 100 - normalizedLeftWidthPercent;
  return {
    id: getString(row.id) || fallback.id || `hero-${index + 1}`,
    enabled: getBoolean(row.enabled) ?? fallback.enabled,
    displayOrder: clamp(Math.round(getNumber(row.displayOrder) ?? fallback.displayOrder), 0, 99),
    image: (getString(row.image) || fallback.image).slice(0, 2000),
    rightPanelBackgroundMode,
    rightPanelBackgroundImage: (getString(row.rightPanelBackgroundImage) || fallback.rightPanelBackgroundImage || '').slice(
      0,
      2000
    ),
    textVerticalAlign,
    leftWidthPercent: normalizedLeftWidthPercent,
    rightWidthPercent: normalizedRightWidthPercent,
    tag: (getString(row.tag) || fallback.tag).slice(0, 80),
    title: (getString(row.title) || fallback.title).slice(0, 180),
    titleFontSize: clamp(Math.round(getNumber(row.titleFontSize) ?? fallback.titleFontSize), 16, 120),
    text: (getString(row.text) || fallback.text).slice(0, 240),
    textEnabled: getBoolean(row.textEnabled) ?? fallback.textEnabled,
    description: (getString(row.description) || fallback.description).slice(0, 500),
    descriptionEnabled: getBoolean(row.descriptionEnabled) ?? fallback.descriptionEnabled,
    descriptionFontSize: clamp(Math.round(getNumber(row.descriptionFontSize) ?? fallback.descriptionFontSize), 10, 48),
    primaryCtaEnabled: getBoolean(row.primaryCtaEnabled) ?? fallback.primaryCtaEnabled,
    primaryCtaText: (getString(row.primaryCtaText) || fallback.primaryCtaText).slice(0, 80),
    primaryCtaLink: normalizeHref(row.primaryCtaLink, fallback.primaryCtaLink),
    primaryCtaStyle: normalizeCtaStyle(row.primaryCtaStyle, fallback.primaryCtaStyle),
    secondaryCtaEnabled: getBoolean(row.secondaryCtaEnabled) ?? fallback.secondaryCtaEnabled,
    secondaryCtaText: (getString(row.secondaryCtaText) || fallback.secondaryCtaText).slice(0, 80),
    secondaryCtaLink: normalizeHref(row.secondaryCtaLink, fallback.secondaryCtaLink),
    secondaryCtaStyle: normalizeCtaStyle(row.secondaryCtaStyle, fallback.secondaryCtaStyle),
    tertiaryCtaEnabled: getBoolean(row.tertiaryCtaEnabled) ?? fallback.tertiaryCtaEnabled,
    tertiaryCtaText: (getString(row.tertiaryCtaText) || fallback.tertiaryCtaText).slice(0, 80),
    tertiaryCtaLink: normalizeHref(row.tertiaryCtaLink, fallback.tertiaryCtaLink),
    tertiaryCtaStyle: normalizeCtaStyle(row.tertiaryCtaStyle, fallback.tertiaryCtaStyle),
  };
};

const normalizeTopNavigations = (raw: unknown, fallback: TopNavigationsSettings): TopNavigationsSettings => {
  const row = asRecord(raw);
  const logoRaw = asRecord(row.logo);
  const controllersRaw = asRecord(row.controllers);
  const themeRaw = asRecord(controllersRaw.theme);
  const modeToken = String(themeRaw.mode || fallback.controllers.theme.mode).trim().toUpperCase();
  const mode: ThemeMode = modeToken === 'LIGHT' || modeToken === 'DARK' ? (modeToken as ThemeMode) : 'SYSTEM';
  const heroRows = Array.isArray(row.heroBanners) ? row.heroBanners : [];
  const fallbackHero = fallback.heroBanners.length > 0 ? fallback.heroBanners : defaultSettings().topNavigations.heroBanners;
  const topStripRaw = asRecord(row.topStripConfig);
  const fallbackStrip = fallback.topStripConfig;
  const rawTopStripMessages = Array.isArray(topStripRaw.messages)
    ? topStripRaw.messages
    : typeof topStripRaw.messages === 'string'
      ? topStripRaw.messages.split(/\r?\n/)
      : fallbackStrip.messages;
  const messages = rawTopStripMessages
    .flatMap((entry) => String(entry || '').split(/\r?\n/))
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20);
  return {
    topStripEnabled: getBoolean(row.topStripEnabled) ?? fallback.topStripEnabled,
    topStripConfig: {
      messages: messages.length > 0 ? messages : fallbackStrip.messages,
      separator: (getString(topStripRaw.separator) || fallbackStrip.separator).slice(0, 20),
      repeatCount: clamp(Math.round(getNumber(topStripRaw.repeatCount) ?? fallbackStrip.repeatCount), 1, 20),
      animationSeconds: clamp(Math.round(getNumber(topStripRaw.animationSeconds) ?? fallbackStrip.animationSeconds), 6, 240),
      fontSize: clamp(Math.round(getNumber(topStripRaw.fontSize) ?? fallbackStrip.fontSize), 8, 40),
      isBold: getBoolean(topStripRaw.isBold) ?? fallbackStrip.isBold,
      pauseOnHover: getBoolean(topStripRaw.pauseOnHover) ?? fallbackStrip.pauseOnHover,
      textColor: (getString(topStripRaw.textColor) || fallbackStrip.textColor).slice(0, 32),
      backgroundColor: (getString(topStripRaw.backgroundColor) || fallbackStrip.backgroundColor).slice(0, 32),
    },
    hamburgerMenu: (Array.isArray(row.hamburgerMenu) ? row.hamburgerMenu : fallback.hamburgerMenu)
      .map((entry, index) => normalizeMenuLink(entry, fallback.hamburgerMenu[index] || defaultMenuLink('Menu', '/')))
      .slice(0, 40),
    hamburgerMenuFontSize: clamp(Math.round(getNumber(row.hamburgerMenuFontSize) ?? fallback.hamburgerMenuFontSize), 16, 72),
    hamburgerMenuFontWeight: clamp(
      Math.round(getNumber(row.hamburgerMenuFontWeight) ?? fallback.hamburgerMenuFontWeight),
      100,
      900
    ),
    searchIconEnabled: getBoolean(row.searchIconEnabled) ?? fallback.searchIconEnabled,
    logo: {
      mode: String(logoRaw.mode || fallback.logo.mode).trim().toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT',
      text: (getString(logoRaw.text) || fallback.logo.text).slice(0, 80),
      textColor: (getString(logoRaw.textColor) || fallback.logo.textColor).slice(0, 32),
      fontFamily: (getString(logoRaw.fontFamily) || fallback.logo.fontFamily).slice(0, 80),
      fontSize: clamp(Math.round(getNumber(logoRaw.fontSize) ?? fallback.logo.fontSize), 10, 96),
      imageUrl: (getString(logoRaw.imageUrl) || fallback.logo.imageUrl).slice(0, 2000),
      altText: (getString(logoRaw.altText) || fallback.logo.altText).slice(0, 120),
      width: clamp(Math.round(getNumber(logoRaw.width) ?? fallback.logo.width), 40, 600),
      height: clamp(Math.round(getNumber(logoRaw.height) ?? fallback.logo.height), 20, 300),
    },
    additionalTopMenu: (Array.isArray(row.additionalTopMenu) ? row.additionalTopMenu : fallback.additionalTopMenu)
      .map((entry, index) => normalizeMenuLink(entry, fallback.additionalTopMenu[index] || defaultMenuLink('Link', '/')))
      .slice(0, 40),
    signInMenu: {
      enabled: getBoolean(asRecord(row.signInMenu).enabled) ?? fallback.signInMenu.enabled,
      label: (getString(asRecord(row.signInMenu).label) || fallback.signInMenu.label).slice(0, 60),
      href: normalizeHref(asRecord(row.signInMenu).href, fallback.signInMenu.href),
      routeKey: (getString(asRecord(row.signInMenu).routeKey) || fallback.signInMenu.routeKey || '').slice(0, 120) || undefined,
      icon: (getString(asRecord(row.signInMenu).icon) || fallback.signInMenu.icon).slice(0, 60),
    },
    controllers: {
      showControllerIcons: getBoolean(controllersRaw.showControllerIcons) ?? fallback.controllers.showControllerIcons,
      theme: {
        enabled: getBoolean(themeRaw.enabled) ?? fallback.controllers.theme.enabled,
        mode,
        icon: (getString(themeRaw.icon) || fallback.controllers.theme.icon).slice(0, 60),
      },
    },
    heroBanners: (heroRows.length > 0 ? heroRows : fallbackHero)
      .map((entry, index) => normalizeHeroBanner(entry, fallbackHero[index] || fallbackHero[0], index))
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 12),
  };
};

const normalizeShopBy = (raw: unknown, fallback: ShopBySettings): ShopBySettings => {
  const row = asRecord(raw);
  const normalizeCountMode = (value: unknown, fallbackMode: CountMode): CountMode =>
    String(value || '').trim().toUpperCase() === 'DATABASE' ? 'DATABASE' : fallbackMode;
  const tabsSource = Array.isArray(row.enabledTabs) ? row.enabledTabs : fallback.enabledTabs;
  const allowedTabs: ShopBySettings['enabledTabs'] = ['CATEGORY', 'COUNTRY', 'STYLE', 'PRICE'];
  const enabledTabs = tabsSource
    .map((entry) => String(entry || '').trim().toUpperCase())
    .filter((entry): entry is ShopBySettings['enabledTabs'][number] =>
      allowedTabs.includes(entry as ShopBySettings['enabledTabs'][number])
    );
  const dedupTabs = Array.from(new Set(enabledTabs));
  const defaultTabToken = String(row.defaultTab || '').trim().toUpperCase();
  const defaultTab = dedupTabs.includes(defaultTabToken as ShopBySettings['defaultTab'])
    ? (defaultTabToken as ShopBySettings['defaultTab'])
    : dedupTabs[0] || fallback.defaultTab;

  const countries = (Array.isArray(row.countries) ? row.countries : fallback.countries)
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.countries[index] || fallback.countries[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        code: (getString(item.code) || fallbackItem.code || '').slice(0, 8).toUpperCase(),
        name: (getString(item.name) || fallbackItem.name || 'Country').slice(0, 80),
        icon: (getString(item.icon) || fallbackItem.icon || '🌍').slice(0, 64),
        productCountMode: String(item.productCountMode || '').trim().toUpperCase() === 'DATABASE_FTB' ? 'DATABASE_FTB' : 'STATIC',
        staticProductCount: clamp(Math.round(getNumber(item.staticProductCount) ?? fallbackItem.staticProductCount ?? 0), 0, 999999),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled ?? true,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder ?? index + 1), 0, 999),
      } as ShopByCountry;
    })
    .slice(0, 200);

  const categories = (Array.isArray(row.categories) ? row.categories : fallback.categories)
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.categories[index] || fallback.categories[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        key: (getString(item.key) || fallbackItem.key || 'CATEGORY').slice(0, 32).toUpperCase(),
        title: (getString(item.title) || fallbackItem.title || 'Category').slice(0, 120),
        description: (getString(item.description) || fallbackItem.description || '').slice(0, 260),
        image: (getString(item.image) || fallbackItem.image || '').slice(0, 2000),
        icon: (getString(item.icon) || fallbackItem.icon || '').slice(0, 60),
        productCountMode: String(item.productCountMode || '').trim().toUpperCase() === 'DATABASE_CATEGORY' ? 'DATABASE_CATEGORY' : 'STATIC',
        staticProductCount: clamp(Math.round(getNumber(item.staticProductCount) ?? fallbackItem.staticProductCount ?? 0), 0, 999999),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled ?? true,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder ?? index + 1), 0, 999),
      } as ShopByCategory;
    })
    .slice(0, 100);

  const styleCards = (Array.isArray(row.styleCards) ? row.styleCards : fallback.styleCards)
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.styleCards[index] || fallback.styleCards[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        title: (getString(item.title) || fallbackItem.title || 'Card').slice(0, 80),
        description: (getString(item.description) || fallbackItem.description || '').slice(0, 220),
        href: normalizeHref(item.href, fallbackItem.href || '/ready-to-wear'),
        icon: (getString(item.icon) || fallbackItem.icon || 'CalendarDays').slice(0, 60),
        titleFontSize: clamp(Math.round(getNumber(item.titleFontSize) ?? fallbackItem.titleFontSize ?? 15), 10, 72),
        descriptionFontSize: clamp(Math.round(getNumber(item.descriptionFontSize) ?? fallbackItem.descriptionFontSize ?? 14), 10, 72),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled ?? true,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder ?? index + 1), 0, 999),
      } as ShopByCard;
    })
    .slice(0, 50);

  const priceCards = (Array.isArray(row.priceCards) ? row.priceCards : fallback.priceCards)
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.priceCards[index] || fallback.priceCards[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        title: (getString(item.title) || fallbackItem.title || 'Price').slice(0, 80),
        priceLabel: (getString(item.priceLabel) || fallbackItem.priceLabel || '').slice(0, 80),
        description: (getString(item.description) || fallbackItem.description || '').slice(0, 220),
        href: normalizeHref(item.href, fallbackItem.href || '/ready-to-wear'),
        icon: (getString(item.icon) || fallbackItem.icon || 'Tag').slice(0, 60),
        titleFontSize: clamp(Math.round(getNumber(item.titleFontSize) ?? fallbackItem.titleFontSize ?? 24), 10, 72),
        descriptionFontSize: clamp(Math.round(getNumber(item.descriptionFontSize) ?? fallbackItem.descriptionFontSize ?? 14), 10, 72),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled ?? true,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder ?? index + 1), 0, 999),
      } as ShopByPriceCard;
    })
    .slice(0, 50);

  return {
    sectionTag: (getString(row.sectionTag) || fallback.sectionTag || 'Discover').slice(0, 80),
    sectionTitle: (getString(row.sectionTitle) || fallback.sectionTitle || 'Shop By').slice(0, 120),
    sectionDescription: (getString(row.sectionDescription) || fallback.sectionDescription || '').slice(0, 280),
    sectionDescriptionEnabled: getBoolean(row.sectionDescriptionEnabled) ?? fallback.sectionDescriptionEnabled,
    enabledTabs: (dedupTabs.length > 0 ? dedupTabs : fallback.enabledTabs).slice(0, 4) as ShopBySettings['enabledTabs'],
    defaultTab,
    countriesCountMode: normalizeCountMode(row.countriesCountMode, fallback.countriesCountMode),
    categoriesCountMode: normalizeCountMode(row.categoriesCountMode, fallback.categoriesCountMode),
    countries,
    categories,
    styleCards,
    priceCards,
  };
};

const normalizeCategoryManage = (
  raw: unknown,
  fallback: JenksV2FrontpageManagerSettings['categoryManage']
): JenksV2FrontpageManagerSettings['categoryManage'] => {
  const row = asRecord(raw);
  const rows = Array.isArray(row.sections) ? row.sections : fallback.sections;
  const sections = rows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.sections[index] || fallback.sections[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        key: (getString(item.key) || fallbackItem.key || `CAT-${index + 1}`).slice(0, 32).toUpperCase(),
        title: (getString(item.title) || fallbackItem.title).slice(0, 120),
        tag: (getString(item.tag) || fallbackItem.tag).slice(0, 80),
        description: (getString(item.description) || fallbackItem.description).slice(0, 300),
        ctaText: (getString(item.ctaText) || fallbackItem.ctaText).slice(0, 80),
        ctaLink: normalizeHref(item.ctaLink, fallbackItem.ctaLink),
        ctaStyle: normalizeCtaStyle(item.ctaStyle, fallbackItem.ctaStyle),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder), 0, 999),
      } as CategorySection;
    })
    .slice(0, 30);
  return { sections };
};

const normalizeTextIconCards = (
  raw: unknown,
  fallback: JenksV2FrontpageManagerSettings['textIconCards']
): JenksV2FrontpageManagerSettings['textIconCards'] => {
  const row = asRecord(raw);
  const rawSectionTitles = asRecord(row.sectionTitles);
  const fallbackSectionTitles = fallback.sectionTitles;
  const sectionTitles = {
    howItWorks: (getString(rawSectionTitles.howItWorks) || fallbackSectionTitles.howItWorks).slice(0, 120),
    custom: (getString(rawSectionTitles.custom) || fallbackSectionTitles.custom).slice(0, 120),
    shopWithConfidence: (getString(rawSectionTitles.shopWithConfidence) || fallbackSectionTitles.shopWithConfidence).slice(0, 120),
  };
  const rawSectionHeadings = asRecord(row.sectionHeadings);
  const fallbackSectionHeadings = fallback.sectionHeadings;
  const normalizeHeading = (
    key: keyof JenksV2FrontpageManagerSettings['textIconCards']['sectionHeadings'],
    input: Record<string, unknown>,
    fallbackHeading: TextIconSectionHeading
  ): TextIconSectionHeading => {
    const positionToken = String(input.titlePosition || fallbackHeading.titlePosition || 'LEFT')
      .trim()
      .toUpperCase();
    const titlePosition: TextIconSectionHeading['titlePosition'] =
      positionToken === 'CENTER' || positionToken === 'RIGHT' ? positionToken : 'LEFT';
    return {
      title: (getString(input.title) || sectionTitles[key] || fallbackHeading.title).slice(0, 140),
      titleEnabled: getBoolean(input.titleEnabled) ?? fallbackHeading.titleEnabled,
      titlePosition,
      titleFontSize: clamp(Math.round(getNumber(input.titleFontSize) ?? fallbackHeading.titleFontSize), 10, 96),
      description: (getString(input.description) || fallbackHeading.description || '').slice(0, 400),
      descriptionEnabled: getBoolean(input.descriptionEnabled) ?? fallbackHeading.descriptionEnabled,
      descriptionFontSize: clamp(Math.round(getNumber(input.descriptionFontSize) ?? fallbackHeading.descriptionFontSize), 8, 72),
    };
  };
  const sectionHeadings = {
    howItWorks: normalizeHeading('howItWorks', asRecord(rawSectionHeadings.howItWorks), fallbackSectionHeadings.howItWorks),
    custom: normalizeHeading('custom', asRecord(rawSectionHeadings.custom), fallbackSectionHeadings.custom),
    shopWithConfidence: normalizeHeading(
      'shopWithConfidence',
      asRecord(rawSectionHeadings.shopWithConfidence),
      fallbackSectionHeadings.shopWithConfidence
    ),
  };
  const rawCardStyle = asRecord(row.cardStyle);
  const fallbackCardStyle = fallback.cardStyle;
  const normalizeCardStyle = (input: Record<string, unknown>, fallbackStyle: TextIconCardStyle): TextIconCardStyle => ({
    cardMinHeight: clamp(Math.round(getNumber(input.cardMinHeight) ?? fallbackStyle.cardMinHeight), 80, 520),
    cardWidth: clamp(Math.round(getNumber(input.cardWidth) ?? fallbackStyle.cardWidth), 180, 520),
    iconSize: clamp(Math.round(getNumber(input.iconSize) ?? fallbackStyle.iconSize), 20, 120),
    titleFontSize: clamp(Math.round(getNumber(input.titleFontSize) ?? fallbackStyle.titleFontSize), 8, 72),
    descriptionFontSize: clamp(Math.round(getNumber(input.descriptionFontSize) ?? fallbackStyle.descriptionFontSize), 8, 72),
  });
  const cardStyle = normalizeCardStyle(rawCardStyle, fallbackCardStyle);
  const rawSectionStyles = asRecord(row.sectionStyles);
  const fallbackSectionStyles = fallback.sectionStyles;
  const sectionStyles = {
    howItWorks: normalizeCardStyle(asRecord(rawSectionStyles.howItWorks), fallbackSectionStyles.howItWorks),
    custom: normalizeCardStyle(asRecord(rawSectionStyles.custom), fallbackSectionStyles.custom),
    shopWithConfidence: normalizeCardStyle(
      asRecord(rawSectionStyles.shopWithConfidence),
      fallbackSectionStyles.shopWithConfidence
    ),
  };
  const rows = Array.isArray(row.cards) ? row.cards : fallback.cards;
  const cards = rows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.cards[index] || fallback.cards[0];
      const typeToken = String(item.sectionType || fallbackItem.sectionType).trim().toUpperCase();
      const sectionType: TextIconSectionType = TEXT_ICON_SECTION_TYPES.includes(typeToken as TextIconSectionType)
        ? (typeToken as TextIconSectionType)
        : 'HOW_IT_WORKS';
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        sectionType,
        title: (getString(item.title) || fallbackItem.title).slice(0, 120),
        description: (getString(item.description) || fallbackItem.description).slice(0, 280),
        icon: (getString(item.icon) || fallbackItem.icon).slice(0, 80),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder), 0, 999),
      } as TextIconCard;
    })
    .slice(0, 100);
  return {
    sectionTitles,
    sectionHeadings,
    cardStyle,
    sectionStyles,
    allowCustomCards: getBoolean(row.allowCustomCards) ?? fallback.allowCustomCards,
    cards,
  };
};

const normalizeFeatured = (
  raw: unknown,
  fallback: JenksV2FrontpageManagerSettings['featured']
): JenksV2FrontpageManagerSettings['featured'] => {
  const row = asRecord(raw);
  const rows = Array.isArray(row.cards) ? row.cards : fallback.cards;
  const cards = rows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.cards[index] || fallback.cards[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        key: (getString(item.key) || fallbackItem.key).slice(0, 40).toUpperCase(),
        image: (getString(item.image) || fallbackItem.image).slice(0, 2000),
        tag: (getString(item.tag) || fallbackItem.tag).slice(0, 80),
        title: (getString(item.title) || fallbackItem.title).slice(0, 140),
        description: (getString(item.description) || fallbackItem.description).slice(0, 320),
        ctaText: (getString(item.ctaText) || fallbackItem.ctaText).slice(0, 80),
        ctaLink: normalizeHref(item.ctaLink, fallbackItem.ctaLink),
        ctaMode: ((): FeaturedCard['ctaMode'] => {
          const token = String(item.ctaMode || fallbackItem.ctaMode || 'URL').trim().toUpperCase();
          if (token === 'PRODUCT_GROUP') return 'PRODUCT_GROUP';
          if (token === 'PAGE') return 'PAGE';
          return 'URL';
        })(),
        ctaPageKey: (getString(item.ctaPageKey) || getString(fallbackItem.ctaPageKey) || '').slice(0, 120) || undefined,
        productGroup: ((): FeaturedCard['productGroup'] => {
          const token = String(item.productGroup || fallbackItem.productGroup || fallbackItem.key || 'ALL')
            .trim()
            .toUpperCase();
          return token === 'RTW' || token === 'CTW' || token === 'FTB' ? token : 'ALL';
        })(),
        ctaStyle: normalizeCtaStyle(item.ctaStyle, fallbackItem.ctaStyle),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder), 0, 999),
      } as FeaturedCard;
    })
    .slice(0, 30);
  return { cards };
};

const normalizeCustomerReviews = (
  raw: unknown,
  fallback: CustomerReviewsSettings
): CustomerReviewsSettings => {
  const row = asRecord(raw);
  const staticRows = Array.isArray(row.staticMessages) ? row.staticMessages : fallback.staticMessages;
  const staticMessages = staticRows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.staticMessages[index] || fallback.staticMessages[0];
      return {
        id: getString(item.id) || fallbackItem?.id || randomUUID(),
        customerName: (getString(item.customerName) || fallbackItem?.customerName || 'Customer').slice(0, 120),
        location: (getString(item.location) || fallbackItem?.location || '').slice(0, 120),
        message: (getString(item.message) || fallbackItem?.message || '').slice(0, 600),
        rating: clamp(Math.round(getNumber(item.rating) ?? fallbackItem?.rating ?? 5), 1, 5),
        enabled: getBoolean(item.enabled) ?? fallbackItem?.enabled ?? true,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem?.displayOrder ?? index + 1), 0, 999),
      } as CustomerReviewStaticMessage;
    })
    .slice(0, 60);
  const sourceModeToken = String(row.sourceMode || fallback.sourceMode || 'BOTH').trim().toUpperCase();
  const displayModeToken = String(row.displayMode || fallback.displayMode || 'SLIDER').trim().toUpperCase();
  return {
    enabled: getBoolean(row.enabled) ?? fallback.enabled,
    sectionTitle: (getString(row.sectionTitle) || fallback.sectionTitle || 'From Our Customers').slice(0, 140),
    titleFontSize: clamp(Math.round(getNumber(row.titleFontSize) ?? fallback.titleFontSize), 14, 120),
    messageFontSize: clamp(Math.round(getNumber(row.messageFontSize) ?? fallback.messageFontSize), 10, 64),
    metaFontSize: clamp(Math.round(getNumber(row.metaFontSize) ?? fallback.metaFontSize), 8, 40),
    sourceMode:
      sourceModeToken === 'STATIC_ONLY' || sourceModeToken === 'PRODUCT_REVIEWS_ONLY' || sourceModeToken === 'BOTH'
        ? (sourceModeToken as CustomerReviewsSettings['sourceMode'])
        : 'BOTH',
    maxItems: clamp(Math.round(getNumber(row.maxItems) ?? fallback.maxItems), 1, 24),
    displayMode: displayModeToken === 'GRID' ? 'GRID' : 'SLIDER',
    autoplayEnabled: getBoolean(row.autoplayEnabled) ?? fallback.autoplayEnabled,
    autoplayIntervalMs: clamp(Math.round(getNumber(row.autoplayIntervalMs) ?? fallback.autoplayIntervalMs), 1000, 30000),
    pauseOnHover: getBoolean(row.pauseOnHover) ?? fallback.pauseOnHover,
    showNavigation: getBoolean(row.showNavigation) ?? fallback.showNavigation,
    showIndicators: getBoolean(row.showIndicators) ?? fallback.showIndicators,
    staticMessages,
  };
};

const normalizeFreshDrops = (raw: unknown, fallback: FreshDropsSettings): FreshDropsSettings => {
  const row = asRecord(raw);
  const sourceMode =
    String(row.sourceMode || '').trim().toUpperCase() === 'FILTERED'
      ? 'FILTERED'
      : 'NEWLY_LISTED';
  return {
    sourceMode,
    listingAgeDays: clamp(Math.round(getNumber(row.listingAgeDays) ?? fallback.listingAgeDays), 1, 365),
    countryFilters: (Array.isArray(row.countryFilters) ? row.countryFilters : fallback.countryFilters)
      .map((entry) => String(entry || '').trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 100),
    categoryFilters: (Array.isArray(row.categoryFilters) ? row.categoryFilters : fallback.categoryFilters)
      .map((entry) => String(entry || '').trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 40),
    mixCategoryResults: getBoolean(row.mixCategoryResults) ?? fallback.mixCategoryResults,
    rows: clamp(Math.round(getNumber(row.rows) ?? fallback.rows), 1, 12),
    columns: clamp(Math.round(getNumber(row.columns) ?? fallback.columns), 1, 12),
    title: (getString(row.title) || fallback.title).slice(0, 140),
    description: (getString(row.description) || fallback.description).slice(0, 320),
  };
};

const normalizeDesignerSpotlight = (
  raw: unknown,
  fallback: DesignerSpotlightSettings
): DesignerSpotlightSettings => {
  const row = asRecord(raw);
  const rows = Array.isArray(row.cards) ? row.cards : fallback.cards;
  const cards = rows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.cards[index] || fallback.cards[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        image: (getString(item.image) || fallbackItem.image).slice(0, 2000),
        tag: (getString(item.tag) || fallbackItem.tag).slice(0, 80),
        title: (getString(item.title) || fallbackItem.title).slice(0, 140),
        description: (getString(item.description) || fallbackItem.description).slice(0, 320),
        ctaText: (getString(item.ctaText) || fallbackItem.ctaText).slice(0, 80),
        ctaLink: normalizeHref(item.ctaLink, fallbackItem.ctaLink),
        ctaStyle: normalizeCtaStyle(item.ctaStyle, fallbackItem.ctaStyle),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder), 0, 999),
      } as DesignerSpotlightCard;
    })
    .slice(0, 120);
  return {
    rows: clamp(Math.round(getNumber(row.rows) ?? fallback.rows), 1, 12),
    columns: clamp(Math.round(getNumber(row.columns) ?? fallback.columns), 1, 12),
    cards,
  };
};

const normalizeHeritage = (raw: unknown, fallback: HeritageSettings): HeritageSettings => {
  const row = asRecord(raw);
  const statsPositionToken = String(row.statsPosition || fallback.statsPosition || 'BOTTOM').trim().toUpperCase();
  const statsPosition: HeritageSettings['statsPosition'] =
    statsPositionToken === 'TOP' || statsPositionToken === 'MIDDLE' ? statsPositionToken : 'BOTTOM';
  const statRows = Array.isArray(row.stats) ? row.stats : fallback.stats;
  const stats = statRows
    .map((entry, index) => {
      const item = asRecord(entry);
      const fallbackItem = fallback.stats[index] || fallback.stats[0];
      return {
        id: getString(item.id) || fallbackItem.id || randomUUID(),
        label: (getString(item.label) || fallbackItem.label).slice(0, 80),
        value: (getString(item.value) || fallbackItem.value).slice(0, 40),
        suffix: (getString(item.suffix) || fallbackItem.suffix).slice(0, 12),
        positionX: clamp(Math.round(getNumber(item.positionX) ?? fallbackItem.positionX), 0, 100),
        positionY: clamp(Math.round(getNumber(item.positionY) ?? fallbackItem.positionY), 0, 100),
        enabled: getBoolean(item.enabled) ?? fallbackItem.enabled,
        displayOrder: clamp(Math.round(getNumber(item.displayOrder) ?? fallbackItem.displayOrder), 0, 999),
      } as HeritageStat;
    })
    .slice(0, 40);
  return {
    image: (getString(row.image) || fallback.image).slice(0, 2000),
    title: (getString(row.title) || fallback.title).slice(0, 140),
    tag: (getString(row.tag) || fallback.tag).slice(0, 80),
    description: (getString(row.description) || fallback.description).slice(0, 320),
    storyHtml: (getString(row.storyHtml) || fallback.storyHtml || '').slice(0, 12000),
    readMoreLabel: (getString(row.readMoreLabel) || fallback.readMoreLabel || 'Read More').slice(0, 80),
    readMoreHref: normalizeHref(row.readMoreHref, fallback.readMoreHref || '/stories/our-heritage'),
    statsPosition,
    stats,
  };
};

const normalizeLinkItem = (raw: unknown, fallback: LinkItem): LinkItem => {
  const row = asRecord(raw);
  const fallbackMode: FooterLinkMode = fallback.hrefMode === 'PAGE' ? 'PAGE' : 'CUSTOM_URL';
  const modeToken = String(row.hrefMode || fallbackMode).trim().toUpperCase();
  const hrefMode: FooterLinkMode = modeToken === 'PAGE' || modeToken === 'DROPDOWN' ? 'PAGE' : 'CUSTOM_URL';
  const pageKey = (getString(row.pageKey) || getString((row as Record<string, unknown>).routeKey) || fallback.pageKey || '')
    .slice(0, 80)
    .toUpperCase();
  const baseHref = normalizeHref(row.href, fallback.href);
  const href = hrefMode === 'PAGE' ? resolveFooterPageHref(pageKey, baseHref) : baseHref;
  return {
    id: getString(row.id) || fallback.id || randomUUID(),
    label: (getString(row.label) || fallback.label).slice(0, 80),
    icon: (getString(row.icon) || fallback.icon || '').slice(0, 60) || undefined,
    hrefMode,
    pageKey,
    href,
    enabled: getBoolean(row.enabled) ?? fallback.enabled,
  };
};

const normalizeNewsletterFooter = (
  raw: unknown,
  fallback: NewsletterFooterSettings
): NewsletterFooterSettings => {
  const row = asRecord(raw);
  const newsletterRaw = asRecord(row.newsletter);
  const footerRaw = asRecord(row.footer);
  const groupsRaw = Array.isArray(footerRaw.linkGroups) ? footerRaw.linkGroups : fallback.footer.linkGroups;
  const policyRaw = Array.isArray(footerRaw.policyLinks) ? footerRaw.policyLinks : fallback.footer.policyLinks;
  const socialRaw = Array.isArray(footerRaw.socialLinks) ? footerRaw.socialLinks : fallback.footer.socialLinks;
  const mapRawRecord = asRecord(footerRaw.map);
  const fallbackMap = fallback.footer.map;
  const footerLogoRaw = asRecord(footerRaw.logo);
  const fallbackLogo = fallback.footer.logo;
  const legacyMapOverlay = getNumber(footerRaw.mapOverlayOpacity);
  const legacyMapOverlayPercent =
    typeof legacyMapOverlay === 'number'
      ? legacyMapOverlay <= 1
        ? Math.round(legacyMapOverlay * 100)
        : Math.round(legacyMapOverlay)
      : undefined;
  const mapRaw =
    Object.keys(mapRawRecord).length > 0
      ? mapRawRecord
      : ({
          enabled: footerRaw.showMapUnderlay,
          image: footerRaw.mapImage,
          overlayColor: '#0a0a0a',
          overlayOpacity: legacyMapOverlayPercent,
          minHeight: footerRaw.mapHeight,
        } as Record<string, unknown>);
  return {
    newsletter: {
      enabled: getBoolean(newsletterRaw.enabled) ?? fallback.newsletter.enabled,
      title: (getString(newsletterRaw.title) || fallback.newsletter.title).slice(0, 140),
      description: (getString(newsletterRaw.description) || fallback.newsletter.description).slice(0, 320),
      emailPlaceholder: (getString(newsletterRaw.emailPlaceholder) || fallback.newsletter.emailPlaceholder).slice(0, 120),
      submitLabel: (getString(newsletterRaw.submitLabel) || fallback.newsletter.submitLabel).slice(0, 80),
      successMessage: (getString(newsletterRaw.successMessage) || fallback.newsletter.successMessage).slice(0, 200),
    },
    footer: {
      enabled: getBoolean(footerRaw.enabled) ?? fallback.footer.enabled,
      brandText: (getString(footerRaw.brandText) || fallback.footer.brandText).slice(0, 120),
      logo: {
        mode: String(footerLogoRaw.mode || fallbackLogo.mode || 'TEXT').trim().toUpperCase() === 'IMAGE' ? 'IMAGE' : 'TEXT',
        text: (getString(footerLogoRaw.text) || fallbackLogo.text || '').slice(0, 120),
        textColor: (getString(footerLogoRaw.textColor) || fallbackLogo.textColor || '#ffffff').slice(0, 30),
        fontFamily: (getString(footerLogoRaw.fontFamily) || fallbackLogo.fontFamily || 'Oswald').slice(0, 120),
        fontSize: clamp(Math.round(getNumber(footerLogoRaw.fontSize) ?? fallbackLogo.fontSize), 10, 96),
        imageUrl: (getString(footerLogoRaw.imageUrl) || fallbackLogo.imageUrl || '').slice(0, 2000),
        altText: (getString(footerLogoRaw.altText) || fallbackLogo.altText || 'Footer logo').slice(0, 120),
        width: clamp(Math.round(getNumber(footerLogoRaw.width) ?? fallbackLogo.width), 40, 900),
        height: clamp(Math.round(getNumber(footerLogoRaw.height) ?? fallbackLogo.height), 16, 500),
      },
      address: (getString(footerRaw.address) || fallback.footer.address).slice(0, 200),
      contactEmail: (getString(footerRaw.contactEmail) || fallback.footer.contactEmail).slice(0, 120),
      contactPhone: (getString(footerRaw.contactPhone) || fallback.footer.contactPhone).slice(0, 80),
      copyright: (getString(footerRaw.copyright) || fallback.footer.copyright).slice(0, 200),
      policyLinks: policyRaw.map((entry, index) => normalizeLinkItem(entry, fallback.footer.policyLinks[index] || fallback.footer.policyLinks[0])).slice(0, 20),
      socialLinks: socialRaw.map((entry, index) => normalizeLinkItem(entry, fallback.footer.socialLinks[index] || fallback.footer.socialLinks[0])).slice(0, 20),
      linkGroups: groupsRaw
        .map((entry, index) => {
          const item = asRecord(entry);
          const fallbackItem = fallback.footer.linkGroups[index] || fallback.footer.linkGroups[0];
          const linksRaw = Array.isArray(item.links) ? item.links : fallbackItem.links;
          return {
            id: getString(item.id) || fallbackItem.id || randomUUID(),
            title: (getString(item.title) || fallbackItem.title).slice(0, 80),
            links: linksRaw.map((link, linkIndex) => normalizeLinkItem(link, fallbackItem.links[linkIndex] || fallbackItem.links[0])).slice(0, 20),
          } as LinkGroup;
        })
        .slice(0, 20),
      map: {
        enabled: getBoolean(mapRaw.enabled) ?? fallbackMap.enabled,
        image: (getString(mapRaw.image) || fallbackMap.image || '').slice(0, 2000),
        overlayColor: (getString(mapRaw.overlayColor) || fallbackMap.overlayColor || '#0a0a0a').slice(0, 40),
        overlayOpacity: clamp(Math.round(getNumber(mapRaw.overlayOpacity) ?? fallbackMap.overlayOpacity), 0, 100),
        minHeight: clamp(Math.round(getNumber(mapRaw.minHeight) ?? fallbackMap.minHeight), 120, 900),
      },
    },
  };
};

const buildTemplateSnapshot = (
  settings: JenksV2FrontpageManagerSettings,
  templateKey: TemplateKey
): Record<string, unknown> => {
  const textCards = Array.isArray(settings.textIconCards.cards) ? settings.textIconCards.cards : [];
  const filterTextCardsByTemplate = (target: TextIconSectionType) => {
    const cards = textCards.filter((card) => {
      const token = String(card.sectionType || '').toUpperCase();
      return token === target;
    });
    return {
      sectionTitles: settings.textIconCards.sectionTitles,
      sectionHeadings: settings.textIconCards.sectionHeadings,
      cardStyle: settings.textIconCards.cardStyle,
      sectionStyles: settings.textIconCards.sectionStyles,
      allowCustomCards: settings.textIconCards.allowCustomCards,
      cards,
    };
  };
  switch (templateKey) {
    case 'TOP_NAVIGATIONS':
      return cloneJson(asRecord(settings.topNavigations));
    case 'SHOP_BY':
      return cloneJson(asRecord(settings.shopBy));
    case 'CATEGORY_MANAGE':
      return cloneJson(asRecord(settings.categoryManage));
    case 'HOW_IT_WORKS':
      return cloneJson(asRecord(filterTextCardsByTemplate('HOW_IT_WORKS')));
    case 'CUSTOM_TEXT_ICON':
      return cloneJson(asRecord(filterTextCardsByTemplate('CUSTOM')));
    case 'SHOP_WITH_CONFIDENCE':
      return cloneJson(asRecord(filterTextCardsByTemplate('SHOP_WITH_CONFIDENCE')));
    case 'FEATURED':
      return cloneJson(asRecord(settings.featured));
    case 'FRESH_DROPS':
      return cloneJson(asRecord(settings.freshDrops));
    case 'DESIGNER_SPOTLIGHT':
      return cloneJson(asRecord(settings.designerSpotlight));
    case 'HERITAGE':
      return cloneJson(asRecord(settings.heritage));
    case 'CUSTOMER_REVIEWS':
      return cloneJson(asRecord(settings.customerReviews));
    case 'NEWSLETTER_FOOTER':
    default:
      return cloneJson(asRecord(settings.newsletterFooter));
  }
};

const mergeLegacyTextIconSectionEntries = (
  sections: SectionVisibilityEntry[],
  settings: JenksV2FrontpageManagerSettings
) => {
  const next = [...sections];
  const legacyIndex = next.findIndex((section) => String(section.templateKey || '').toUpperCase() === 'TEXT_ICON_CARDS');
  if (legacyIndex === -1) return next;

  const legacy = next[legacyIndex];
  next.splice(legacyIndex, 1);

  const cards = Array.isArray(settings.textIconCards.cards) ? settings.textIconCards.cards : [];
  const hasHowCards = cards.some((card) => String(card.sectionType || '').toUpperCase() === 'HOW_IT_WORKS');
  const hasCustomCards = cards.some((card) => String(card.sectionType || '').toUpperCase() === 'CUSTOM');
  const hasTrustCards = cards.some((card) => String(card.sectionType || '').toUpperCase() === 'SHOP_WITH_CONFIDENCE');

  const baseOrder = clamp(Math.round(getNumber(legacy.order) ?? 1), 1, 999);
  const legacyEnabled = getBoolean(legacy.enabled) ?? true;

  next.push({
    ...legacy,
    id: randomUUID(),
    key: 'how-it-works',
    name: 'How It Works',
    templateKey: 'HOW_IT_WORKS',
    enabled: legacyEnabled && hasHowCards,
    order: baseOrder,
    isCustom: false,
    configSnapshot: buildTemplateSnapshot(settings, 'HOW_IT_WORKS'),
  });
  next.push({
    ...legacy,
    id: randomUUID(),
    key: 'custom-text-icon',
    name: 'Custom',
    templateKey: 'CUSTOM_TEXT_ICON',
    enabled: legacyEnabled && hasCustomCards,
    order: clamp(baseOrder + 1, 1, 999),
    isCustom: false,
    configSnapshot: buildTemplateSnapshot(settings, 'CUSTOM_TEXT_ICON'),
  });
  next.push({
    ...legacy,
    id: randomUUID(),
    key: 'shop-with-confidence',
    name: 'Shop With Confidence',
    templateKey: 'SHOP_WITH_CONFIDENCE',
    enabled: legacyEnabled && hasTrustCards,
    order: clamp(baseOrder + 2, 1, 999),
    isCustom: false,
    configSnapshot: buildTemplateSnapshot(settings, 'SHOP_WITH_CONFIDENCE'),
  });

  return next;
};

const normalizeSectionVisibility = (
  raw: unknown,
  fallback: SectionVisibilitySettings,
  settings: JenksV2FrontpageManagerSettings
): SectionVisibilitySettings => {
  const row = asRecord(raw);
  const titleRaw = asRecord(row.titleSettings);
  const fallbackTitle = fallback.titleSettings;
  const rawRowsSource = Array.isArray(row.sections) ? row.sections : fallback.sections;
  const rawRows = mergeLegacyTextIconSectionEntries(
    rawRowsSource.map((entry, index) => {
      const source = asRecord(entry);
      return {
        ...source,
        id: getString(source.id) || randomUUID(),
        key: getString(source.key) || `section-${index + 1}`,
        name: getString(source.name) || 'Section',
        templateKey: getString(source.templateKey) || 'TOP_NAVIGATIONS',
        enabled: getBoolean(source.enabled) ?? true,
        order: clamp(Math.round(getNumber(source.order) ?? index + 1), 1, 999),
        isCustom: getBoolean(source.isCustom) ?? false,
        configSnapshot:
          source.configSnapshot && typeof source.configSnapshot === 'object'
            ? cloneJson(source.configSnapshot as Record<string, unknown>)
            : {},
      } as SectionVisibilityEntry;
    }),
    settings
  );
  const parsed = rawRows.map((entry, index) => {
    const item = asRecord(entry);
    const fallbackItem = fallback.sections[index] || fallback.sections[0];
    const templateTokenRaw = String(item.templateKey || fallbackItem.templateKey || 'TOP_NAVIGATIONS')
      .trim()
      .toUpperCase();
    const templateToken = templateTokenRaw === 'TEXT_ICON_CARDS' ? 'HOW_IT_WORKS' : templateTokenRaw;
    const templateKey = TEMPLATE_KEYS.includes(templateToken as TemplateKey)
      ? (templateToken as TemplateKey)
      : 'TOP_NAVIGATIONS';
    const name = (getString(item.name) || fallbackItem.name || 'Section').slice(0, 80);
    const keyBase =
      getString(item.key) ||
      (getBoolean(item.isCustom) ? `custom-${slugify(name)}` : TEMPLATE_META.find((meta) => meta.templateKey === templateKey)?.key) ||
      `custom-${slugify(name)}`;
    return {
      id: getString(item.id) || fallbackItem.id || randomUUID(),
      key: keyBase || `custom-section-${index + 1}`,
      name,
      templateKey,
      enabled: getBoolean(item.enabled) ?? fallbackItem.enabled ?? true,
      order: clamp(Math.round(getNumber(item.order) ?? fallbackItem.order ?? index + 1), 1, 999),
      isCustom: getBoolean(item.isCustom) ?? fallbackItem.isCustom ?? false,
      configSnapshot:
        item.configSnapshot && typeof item.configSnapshot === 'object'
          ? cloneJson(item.configSnapshot as Record<string, unknown>)
          : buildTemplateSnapshot(settings, templateKey),
    } as SectionVisibilityEntry;
  });

  const sectionsByTemplate = new Map<TemplateKey, SectionVisibilityEntry>();
  for (const section of parsed) {
    if (section.isCustom) continue;
    if (!sectionsByTemplate.has(section.templateKey)) {
      sectionsByTemplate.set(section.templateKey, section);
    }
  }

  for (const [index, meta] of TEMPLATE_META.entries()) {
    if (!sectionsByTemplate.has(meta.templateKey)) {
      parsed.push({
        id: randomUUID(),
        key: meta.key,
        name: meta.name,
        templateKey: meta.templateKey,
        enabled: true,
        order: index + 1,
        isCustom: false,
        configSnapshot: buildTemplateSnapshot(settings, meta.templateKey),
      });
    }
  }

  const keySeen = new Set<string>();
  const normalized = parsed
    .map((section, index) => {
      const keySeed = slugify(section.key || section.name || `section-${index + 1}`) || `section-${index + 1}`;
      let key = keySeed;
      let suffix = 2;
      while (keySeen.has(key)) {
        key = `${keySeed}-${suffix}`;
        suffix += 1;
      }
      keySeen.add(key);
      const meta = TEMPLATE_META.find((entry) => entry.templateKey === section.templateKey);
      return {
        ...section,
        key: section.isCustom ? key : meta?.key || key,
        name: section.isCustom ? section.name : meta?.name || section.name,
        isCustom: section.isCustom,
      };
    })
    .sort((a, b) => a.order - b.order)
    .slice(0, 200);

  const alignToken = String(titleRaw.align || fallbackTitle.align || 'LEFT').trim().toUpperCase();
  const align: SectionVisibilitySettings['titleSettings']['align'] =
    alignToken === 'CENTER' || alignToken === 'RIGHT' ? alignToken : 'LEFT';
  return {
    sections: normalized,
    titleSettings: {
      show: getBoolean(titleRaw.show) ?? fallbackTitle.show,
      align,
    },
  };
};

const applyTemplateSnapshotToSettings = (
  settings: JenksV2FrontpageManagerSettings,
  templateKey: TemplateKey,
  snapshot: Record<string, unknown>
): JenksV2FrontpageManagerSettings => {
  const next = cloneJson(settings);
  const snapshotRecord = asRecord(snapshot);
  switch (templateKey) {
    case 'TOP_NAVIGATIONS':
      next.topNavigations = normalizeTopNavigations(snapshotRecord, next.topNavigations);
      break;
    case 'SHOP_BY':
      next.shopBy = normalizeShopBy(snapshotRecord, next.shopBy);
      break;
    case 'CATEGORY_MANAGE':
      next.categoryManage = normalizeCategoryManage(snapshotRecord, next.categoryManage);
      break;
    case 'HOW_IT_WORKS':
    case 'CUSTOM_TEXT_ICON':
    case 'SHOP_WITH_CONFIDENCE': {
      const normalized = normalizeTextIconCards(snapshotRecord, next.textIconCards);
      const scopedRows = normalized.cards.filter((card) => {
        const token = String(card.sectionType || '').toUpperCase();
        if (templateKey === 'HOW_IT_WORKS') return token === 'HOW_IT_WORKS';
        if (templateKey === 'CUSTOM_TEXT_ICON') return token === 'CUSTOM';
        return token === 'SHOP_WITH_CONFIDENCE';
      });
      const otherRows = next.textIconCards.cards.filter((card) => {
        const token = String(card.sectionType || '').toUpperCase();
        if (templateKey === 'HOW_IT_WORKS') return token !== 'HOW_IT_WORKS';
        if (templateKey === 'CUSTOM_TEXT_ICON') return token !== 'CUSTOM';
        return token !== 'SHOP_WITH_CONFIDENCE';
      });
      next.textIconCards = {
        ...next.textIconCards,
        sectionTitles: normalized.sectionTitles,
        sectionHeadings: normalized.sectionHeadings,
        cardStyle: normalized.cardStyle,
        sectionStyles: normalized.sectionStyles,
        allowCustomCards: normalized.allowCustomCards,
        cards: [...otherRows, ...scopedRows],
      };
      break;
    }
    case 'FEATURED':
      next.featured = normalizeFeatured(snapshotRecord, next.featured);
      break;
    case 'FRESH_DROPS':
      next.freshDrops = normalizeFreshDrops(snapshotRecord, next.freshDrops);
      break;
    case 'DESIGNER_SPOTLIGHT':
      next.designerSpotlight = normalizeDesignerSpotlight(snapshotRecord, next.designerSpotlight);
      break;
    case 'HERITAGE':
      next.heritage = normalizeHeritage(snapshotRecord, next.heritage);
      break;
    case 'CUSTOMER_REVIEWS':
      next.customerReviews = normalizeCustomerReviews(snapshotRecord, next.customerReviews);
      break;
    case 'NEWSLETTER_FOOTER':
      next.newsletterFooter = normalizeNewsletterFooter(snapshotRecord, next.newsletterFooter);
      break;
    default:
      break;
  }
  next.sectionVisibility = normalizeSectionVisibility(next.sectionVisibility, next.sectionVisibility, next);
  return next;
};

const normalizeSettings = (
  raw: unknown,
  fallback: JenksV2FrontpageManagerSettings = defaultSettings()
): JenksV2FrontpageManagerSettings => {
  if (!raw || typeof raw !== 'object') return cloneJson(fallback);
  const row = asRecord(raw);
  const topNavigations = normalizeTopNavigations(row.topNavigations, fallback.topNavigations);
  const shopBy = normalizeShopBy(row.shopBy, fallback.shopBy);
  const categoryManage = normalizeCategoryManage(row.categoryManage, fallback.categoryManage);
  const textIconCards = normalizeTextIconCards(row.textIconCards, fallback.textIconCards);
  const featured = normalizeFeatured(row.featured, fallback.featured);
  const freshDrops = normalizeFreshDrops(row.freshDrops, fallback.freshDrops);
  const designerSpotlight = normalizeDesignerSpotlight(row.designerSpotlight, fallback.designerSpotlight);
  const heritage = normalizeHeritage(row.heritage, fallback.heritage);
  const customerReviews = normalizeCustomerReviews(row.customerReviews, fallback.customerReviews);
  const newsletterFooter = normalizeNewsletterFooter(row.newsletterFooter, fallback.newsletterFooter);
  const base: JenksV2FrontpageManagerSettings = {
    contractVersion: CONTRACT_VERSION,
    topNavigations,
    shopBy,
    categoryManage,
    textIconCards,
    featured,
    freshDrops,
    designerSpotlight,
    heritage,
    customerReviews,
    newsletterFooter,
    sectionVisibility: {
      sections: [],
      titleSettings: fallback.sectionVisibility.titleSettings,
    },
  };
  base.sectionVisibility = normalizeSectionVisibility(row.sectionVisibility, fallback.sectionVisibility, base);
  return base;
};

const readSettings = async () => {
  const defaults = defaultSettings();
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string; value: string; updatedAt: Date | null }>>(
    `SELECT "id", "value", "updatedAt"
     FROM "HomepageSectionSetting"
     WHERE "key" = $1
     LIMIT 1`,
    SETTINGS_KEY
  );
  const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  if (!row) {
    return {
      rowId: null as string | null,
      settings: defaults,
      source: 'DEFAULT' as const,
      updatedAt: null as Date | null,
    };
  }
  try {
    const parsed = JSON.parse(String(row.value || '{}'));
    return {
      rowId: String(row.id),
      settings: normalizeSettings(parsed, defaults),
      source: 'DATABASE' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  } catch {
    return {
      rowId: String(row.id),
      settings: defaults,
      source: 'DEFAULT' as const,
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : null,
    };
  }
};

const saveSettings = async (next: Partial<JenksV2FrontpageManagerSettings>) => {
  const existing = await readSettings();
  const merged = normalizeSettings(
    {
      ...existing.settings,
      ...next,
      topNavigations: {
        ...existing.settings.topNavigations,
        ...asRecord(next.topNavigations),
      },
      shopBy: {
        ...existing.settings.shopBy,
        ...asRecord(next.shopBy),
      },
      categoryManage: {
        ...existing.settings.categoryManage,
        ...asRecord(next.categoryManage),
      },
      textIconCards: {
        ...existing.settings.textIconCards,
        ...asRecord(next.textIconCards),
      },
      featured: {
        ...existing.settings.featured,
        ...asRecord(next.featured),
      },
      freshDrops: {
        ...existing.settings.freshDrops,
        ...asRecord(next.freshDrops),
      },
      designerSpotlight: {
        ...existing.settings.designerSpotlight,
        ...asRecord(next.designerSpotlight),
      },
      heritage: {
        ...existing.settings.heritage,
        ...asRecord(next.heritage),
      },
      customerReviews: {
        ...existing.settings.customerReviews,
        ...asRecord(next.customerReviews),
      },
      newsletterFooter: {
        ...existing.settings.newsletterFooter,
        ...asRecord(next.newsletterFooter),
      },
      sectionVisibility: {
        ...existing.settings.sectionVisibility,
        ...asRecord(next.sectionVisibility),
      },
    },
    existing.settings
  );

  const payload = JSON.stringify(merged);
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
      SETTINGS_KEY,
      payload
    );
  }
  return merged;
};

const cloneTextCardsWithType = (cards: unknown[], sectionType: TextIconSectionType) =>
  cards
    .map((entry, idx) => {
      const row = asRecord(entry);
      return {
        id: randomUUID(),
        sectionType,
        title: (getString(row.title) || `${sectionType} ${idx + 1}`).slice(0, 120),
        description: (getString(row.description) || '').slice(0, 280),
        icon: (getString(row.icon) || 'Sparkles').slice(0, 80),
        enabled: getBoolean(row.enabled) ?? true,
        displayOrder: idx + 1,
      } as TextIconCard;
    })
    .slice(0, 40);

const appendTemplateContent = (
  settings: JenksV2FrontpageManagerSettings,
  templateKey: TemplateKey,
  snapshot: Record<string, unknown>
): JenksV2FrontpageManagerSettings => {
  const next = cloneJson(settings);
  switch (templateKey) {
    case 'HOW_IT_WORKS': {
      const cards = cloneTextCardsWithType(asArray(asRecord(snapshot).cards), 'HOW_IT_WORKS');
      if (cards.length > 0) {
        const baseOrder = next.textIconCards.cards.reduce((acc, card) => Math.max(acc, card.displayOrder), 0);
        next.textIconCards.cards.push(
          ...cards.map((card, idx) => ({
            ...card,
            displayOrder: baseOrder + idx + 1,
          }))
        );
      }
      return next;
    }
    case 'CUSTOM_TEXT_ICON': {
      const cards = cloneTextCardsWithType(asArray(asRecord(snapshot).cards), 'CUSTOM');
      if (cards.length > 0) {
        const baseOrder = next.textIconCards.cards.reduce((acc, card) => Math.max(acc, card.displayOrder), 0);
        next.textIconCards.cards.push(
          ...cards.map((card, idx) => ({
            ...card,
            displayOrder: baseOrder + idx + 1,
          }))
        );
      }
      return next;
    }
    case 'SHOP_WITH_CONFIDENCE': {
      const cards = cloneTextCardsWithType(asArray(asRecord(snapshot).cards), 'SHOP_WITH_CONFIDENCE');
      if (cards.length > 0) {
        const baseOrder = next.textIconCards.cards.reduce((acc, card) => Math.max(acc, card.displayOrder), 0);
        next.textIconCards.cards.push(
          ...cards.map((card, idx) => ({
            ...card,
            displayOrder: baseOrder + idx + 1,
          }))
        );
      }
      return next;
    }
    default:
      return next;
  }
};

router.get('/config', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    const { settings } = await readSettings();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('Error fetching Jenks-V2 frontpage manager config:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch Jenks-V2 frontpage manager config.' });
  }
});

router.get('/admin/config', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
    const { settings, source, updatedAt } = await readSettings();
    return res.json({ success: true, data: { ...settings, source, updatedAt } });
  } catch (error) {
    console.error('Error fetching admin Jenks-V2 frontpage manager config:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch Jenks-V2 frontpage manager config.' });
  }
});

const applyUpdate = async (req: any, res: any) => {
  try {
    const payload = updateSchema.parse(req.body || {});
    const settings = await saveSettings(payload as Partial<JenksV2FrontpageManagerSettings>);
    return res.json({ success: true, data: settings });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
    }
    console.error('Error updating Jenks-V2 frontpage manager config:', error);
    return res.status(500).json({ success: false, message: 'Failed to update Jenks-V2 frontpage manager config.' });
  }
};

router.put('/admin/config', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), applyUpdate);
router.patch('/admin/config', authenticate, authorizePermissions(Permissions.HOMEPAGE_MANAGE), applyUpdate);

router.post(
  '/admin/section-visibility/duplicate',
  authenticate,
  authorizePermissions(Permissions.HOMEPAGE_MANAGE),
  async (req, res) => {
    try {
      const payload = duplicateSectionSchema.parse(req.body || {});
      const { settings } = await readSettings();
      const existingSections = [...settings.sectionVisibility.sections];
      const slugBase = slugify(payload.name) || 'section';
      let key = `custom-${slugBase}`;
      let suffix = 2;
      const usedKeys = new Set(existingSections.map((section) => section.key));
      while (usedKeys.has(key)) {
        key = `custom-${slugBase}-${suffix}`;
        suffix += 1;
      }
      const maxOrder = existingSections.reduce((acc, section) => Math.max(acc, section.order), 0);
      const order = clamp(payload.order ?? maxOrder + 1, 1, 999);
      const templateSnapshot = buildTemplateSnapshot(settings, payload.templateKey);
      const withTemplateContent = appendTemplateContent(settings, payload.templateKey, templateSnapshot);
      existingSections.push({
        id: randomUUID(),
        key,
        name: payload.name,
        templateKey: payload.templateKey,
        enabled: true,
        order,
        isCustom: true,
        configSnapshot: templateSnapshot,
      });
      const next = await saveSettings({
        ...withTemplateContent,
        sectionVisibility: {
          sections: existingSections,
          titleSettings: settings.sectionVisibility.titleSettings,
        },
      });
      return res.status(201).json({
        success: true,
        data: next,
        message: `Created section "${payload.name}" from template ${payload.templateKey}.`,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ success: false, message: 'Validation failed', issues: error.issues });
      }
      console.error('Error duplicating Jenks-V2 section:', error);
      return res.status(500).json({ success: false, message: 'Failed to duplicate section template.' });
    }
  }
);

export default router;
