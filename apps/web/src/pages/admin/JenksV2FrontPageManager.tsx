import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
type CountMode = 'STATIC' | 'DATABASE';
type TemplateKey =
  | 'TOP_NAVIGATIONS'
  | 'SHOP_BY'
  | 'CATEGORY_MANAGE'
  | 'TEXT_ICON_CARDS'
  | 'FEATURED'
  | 'FRESH_DROPS'
  | 'DESIGNER_SPOTLIGHT'
  | 'HERITAGE'
  | 'NEWSLETTER_FOOTER';

type MenuLink = {
  id: string;
  label: string;
  href: string;
  routeKey?: string;
  icon?: string;
  enabled: boolean;
};

type HeroBanner = {
  id: string;
  enabled: boolean;
  displayOrder: number;
  image: string;
  tag: string;
  title: string;
  titleFontSize: number;
  text: string;
  description: string;
  descriptionFontSize: number;
  primaryCtaText: string;
  primaryCtaLink: string;
  primaryCtaEnabled: boolean;
  primaryCtaStyle: CTAStyle;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  secondaryCtaEnabled: boolean;
  secondaryCtaStyle: CTAStyle;
};

type TopNavigations = {
  topStripEnabled: boolean;
  hamburgerMenu: MenuLink[];
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
  enabled: boolean;
  displayOrder: number;
};

type ShopByPriceCard = ShopByCard & {
  priceLabel: string;
};

type ShopBy = {
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
  ctaStyle: CTAStyle;
  enabled: boolean;
  displayOrder: number;
};

type TextIconCard = {
  id: string;
  sectionType: 'HOW_IT_WORKS' | 'SHOP_WITH_CONFIDENCE' | 'CUSTOM';
  title: string;
  description: string;
  icon: string;
  enabled: boolean;
  displayOrder: number;
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
  ctaStyle: CTAStyle;
  enabled: boolean;
  displayOrder: number;
};

type FreshDrops = {
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
  ctaStyle: CTAStyle;
  enabled: boolean;
  displayOrder: number;
};

type CTAStyle = {
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
};

type DesignerSpotlight = {
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

type Heritage = {
  image: string;
  title: string;
  tag: string;
  description: string;
  stats: HeritageStat[];
};

type LinkItem = {
  id: string;
  label: string;
  href: string;
  enabled: boolean;
};

type LinkGroup = {
  id: string;
  title: string;
  links: LinkItem[];
};

type NewsletterFooter = {
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
    address: string;
    contactEmail: string;
    contactPhone: string;
    copyright: string;
    policyLinks: LinkItem[];
    socialLinks: LinkItem[];
    linkGroups: LinkGroup[];
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

type JenksV2FrontpageConfig = {
  contractVersion: string;
  topNavigations: TopNavigations;
  shopBy: ShopBy;
  categoryManage: {
    sections: CategorySection[];
  };
  textIconCards: {
    allowCustomCards: boolean;
    cards: TextIconCard[];
  };
  featured: {
    cards: FeaturedCard[];
  };
  freshDrops: FreshDrops;
  designerSpotlight: DesignerSpotlight;
  heritage: Heritage;
  newsletterFooter: NewsletterFooter;
  sectionVisibility: {
    sections: SectionVisibilityEntry[];
  };
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
};

const TEMPLATES: Array<{ key: TemplateKey; label: string }> = [
  { key: 'TOP_NAVIGATIONS', label: 'Top Navigations' },
  { key: 'SHOP_BY', label: 'Shop By' },
  { key: 'CATEGORY_MANAGE', label: 'Category Manage' },
  { key: 'TEXT_ICON_CARDS', label: 'Text & Icon Cards' },
  { key: 'FEATURED', label: 'Featured' },
  { key: 'FRESH_DROPS', label: 'Fresh Drops' },
  { key: 'DESIGNER_SPOTLIGHT', label: 'Designer Spotlight' },
  { key: 'HERITAGE', label: 'Heritage' },
  { key: 'NEWSLETTER_FOOTER', label: 'Newsletter and Footer' },
];

const ROUTE_OPTIONS = [
  { key: 'HOME', label: 'Home', href: '/' },
  { key: 'SHOP', label: 'Shop', href: '/ready-to-wear' },
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', href: '/ready-to-wear' },
  { key: 'FABRICS', label: 'Fabric To Buy', href: '/fabrics' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', href: '/custom' },
  { key: 'CONTACT', label: 'Contact', href: '/contact' },
  { key: 'AUTH_LOGIN', label: 'Sign In', href: '/auth/login' },
];

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const toBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

const defaultLink = (label: string, href: string, routeKey?: string): MenuLink => ({
  id: uid(),
  label,
  href,
  routeKey,
  icon: '',
  enabled: true,
});

const DEFAULT_CTA_STYLE: CTAStyle = {
  textColor: '#ffffff',
  backgroundColor: '#e66045',
  borderColor: '#e66045',
  borderWidth: 0,
  fontFamily: 'Montserrat, Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
};

const createCtaStyle = (overrides: Partial<CTAStyle> = {}): CTAStyle => ({
  ...DEFAULT_CTA_STYLE,
  ...overrides,
});

const normalizeCtaStyle = (value: unknown, fallback: CTAStyle = DEFAULT_CTA_STYLE): CTAStyle => {
  if (!value || typeof value !== 'object') return { ...fallback };
  const row = value as Partial<CTAStyle>;
  const clampNumber = (num: unknown, min: number, max: number, fallbackValue: number) => {
    const parsed = typeof num === 'number' && Number.isFinite(num) ? num : Number(num);
    if (!Number.isFinite(parsed)) return fallbackValue;
    return clamp(Math.round(parsed), min, max);
  };
  return {
    textColor: String(row.textColor || fallback.textColor || '#ffffff'),
    backgroundColor: String((row as any).backgroundColor || (row as any).bgColor || fallback.backgroundColor || '#e66045'),
    borderColor: String(row.borderColor || fallback.borderColor || '#e66045'),
    borderWidth: clampNumber(row.borderWidth, 0, 12, fallback.borderWidth),
    fontFamily: String(row.fontFamily || fallback.fontFamily || 'Montserrat, Inter, sans-serif'),
    fontSize: clampNumber(row.fontSize, 8, 72, fallback.fontSize),
    fontWeight: clampNumber(row.fontWeight, 100, 900, fallback.fontWeight),
  };
};

const renderCtaStyleEditor = (
  label: string,
  style: CTAStyle,
  onChange: (next: CTAStyle) => void,
  className = 'md:col-span-4'
) => (
  <div className={`rounded border border-gray-200 bg-gray-50 p-3 ${className}`}>
    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-700">{label}</p>
    <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
      <label className="text-[11px]">
        Background
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.backgroundColor}
          onChange={(event) => onChange({ ...style, backgroundColor: event.target.value })}
        />
      </label>
      <label className="text-[11px]">
        Text Color
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.textColor}
          onChange={(event) => onChange({ ...style, textColor: event.target.value })}
        />
      </label>
      <label className="text-[11px]">
        Border Color
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.borderColor}
          onChange={(event) => onChange({ ...style, borderColor: event.target.value })}
        />
      </label>
      <label className="text-[11px]">
        Border Width (px)
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.borderWidth}
          onChange={(event) => onChange({ ...style, borderWidth: clamp(toNumber(event.target.value, style.borderWidth), 0, 12) })}
        />
      </label>
      <label className="text-[11px]">
        Font Family
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.fontFamily}
          onChange={(event) => onChange({ ...style, fontFamily: event.target.value })}
        />
      </label>
      <label className="text-[11px]">
        Font Size (px)
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.fontSize}
          onChange={(event) => onChange({ ...style, fontSize: clamp(toNumber(event.target.value, style.fontSize), 8, 72) })}
        />
      </label>
      <label className="text-[11px]">
        Font Weight
        <input
          type="number"
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.fontWeight}
          onChange={(event) => onChange({ ...style, fontWeight: clamp(toNumber(event.target.value, style.fontWeight), 100, 900) })}
        />
      </label>
    </div>
  </div>
);

const DEFAULT_CONFIG: JenksV2FrontpageConfig = {
  contractVersion: 'JENKS_V2_FRONTPAGE_MANAGER_V1',
  topNavigations: {
    topStripEnabled: true,
    hamburgerMenu: [defaultLink('Home', '/', 'HOME')],
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
    additionalTopMenu: [defaultLink('Shop', '/ready-to-wear', 'SHOP')],
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
        id: uid(),
        enabled: true,
        displayOrder: 0,
        image: '',
        tag: 'Editorial Premium',
        title: 'Wear the Story of Africa',
        titleFontSize: 56,
        text: 'Curated fashion from top designers and textile houses.',
        description: 'Control title, text, tags, font size, CTA labels and links for each hero banner.',
        descriptionFontSize: 16,
        primaryCtaEnabled: true,
        primaryCtaText: 'SHOP NOW',
        primaryCtaLink: '/ready-to-wear',
        primaryCtaStyle: createCtaStyle({
          backgroundColor: '#e66045',
          textColor: '#ffffff',
          borderColor: '#e66045',
          borderWidth: 0,
          fontSize: 12,
        }),
        secondaryCtaEnabled: true,
        secondaryCtaText: 'EXPLORE DESIGNERS',
        secondaryCtaLink: '/custom',
        secondaryCtaStyle: createCtaStyle({
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
    enabledTabs: ['CATEGORY', 'COUNTRY', 'STYLE', 'PRICE'],
    defaultTab: 'CATEGORY',
    countriesCountMode: 'STATIC',
    categoriesCountMode: 'STATIC',
    countries: [
      {
        id: uid(),
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
        id: uid(),
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
    ],
    styleCards: [
      {
        id: uid(),
        title: 'Occasion',
        description: 'Wedding, Casual, Festival and more',
        href: '/ready-to-wear',
        enabled: true,
        displayOrder: 1,
      },
    ],
    priceCards: [
      {
        id: uid(),
        title: 'Under $100',
        priceLabel: 'Budget Friendly',
        description: 'Affordable picks for every wardrobe',
        href: '/ready-to-wear?price=under-100',
        enabled: true,
        displayOrder: 1,
      },
    ],
  },
  categoryManage: {
    sections: [
      {
        id: uid(),
        key: 'RTW',
        title: 'Ready To Wear',
        tag: 'RTW',
        description: 'Manage title, tag, description and CTA for RTW block.',
        ctaText: 'Shop RTW',
        ctaLink: '/ready-to-wear',
        ctaStyle: createCtaStyle({
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
        id: uid(),
        key: 'CTW',
        title: 'Custom To Wear',
        tag: 'CTW',
        description: 'Manage title, tag, description and CTA for CTW block.',
        ctaText: 'Explore CTW',
        ctaLink: '/custom',
        ctaStyle: createCtaStyle({
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
        id: uid(),
        key: 'FTB',
        title: 'Fabric To Buy',
        tag: 'FTB',
        description: 'Manage title, tag, description and CTA for FTB block.',
        ctaText: 'Shop FTB',
        ctaLink: '/fabrics',
        ctaStyle: createCtaStyle({
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
    allowCustomCards: true,
    cards: [
      {
        id: uid(),
        sectionType: 'HOW_IT_WORKS',
        title: 'How it works',
        description: 'Manage process cards and icon settings.',
        icon: 'Workflow',
        enabled: true,
        displayOrder: 1,
      },
    ],
  },
  featured: {
    cards: [
      {
        id: uid(),
        key: 'RTW',
        image: '',
        tag: 'Featured RTW',
        title: 'Featured Ready To Wear',
        description: 'Spotlight featured RTW products.',
        ctaText: 'Shop RTW',
        ctaLink: '/ready-to-wear',
        ctaStyle: createCtaStyle({
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
        id: uid(),
        key: 'CTW',
        image: '',
        tag: 'Featured CTW',
        title: 'Featured Custom To Wear',
        description: 'Spotlight featured CTW products.',
        ctaText: 'Explore CTW',
        ctaLink: '/custom',
        ctaStyle: createCtaStyle({
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
        id: uid(),
        key: 'FTB',
        image: '',
        tag: 'Featured FTB',
        title: 'Featured Fabric To Buy',
        description: 'Spotlight featured fabric products.',
        ctaText: 'Shop FTB',
        ctaLink: '/fabrics',
        ctaStyle: createCtaStyle({
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
    description: 'Latest products configurable by listing age, country and category mix.',
  },
  designerSpotlight: {
    rows: 1,
    columns: 3,
    cards: [
      {
        id: uid(),
        image: '',
        tag: 'Designer Spotlight',
        title: 'Meet the Designers',
        description: 'Highlight featured designers with CTA.',
        ctaText: 'View Designer',
        ctaLink: '/custom',
        ctaStyle: createCtaStyle({
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
    description: 'Configure heritage titles, description and floating stats.',
    stats: [
      {
        id: uid(),
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
      address: 'Lagos, Nigeria',
      contactEmail: 'support@jenks.africa',
      contactPhone: '+234 000 000 0000',
      copyright: '© Jenks. All rights reserved.',
      policyLinks: [{ id: uid(), label: 'Privacy Policy', href: '/help-center', enabled: true }],
      socialLinks: [{ id: uid(), label: 'Instagram', href: 'https://instagram.com', enabled: true }],
      linkGroups: [
        {
          id: uid(),
          title: 'Shop',
          links: [
            { id: uid(), label: 'Ready To Wear', href: '/ready-to-wear', enabled: true },
            { id: uid(), label: 'Custom To Wear', href: '/custom', enabled: true },
          ],
        },
      ],
    },
  },
  sectionVisibility: {
    sections: TEMPLATES.map((template, index) => ({
      id: uid(),
      key: template.key.toLowerCase(),
      name: template.label,
      templateKey: template.key,
      enabled: true,
      order: index + 1,
      isCustom: false,
      configSnapshot: {},
    })),
  },
};

type TabKey =
  | 'topNavigations'
  | 'shopBy'
  | 'categoryManage'
  | 'textIconCards'
  | 'featured'
  | 'freshDrops'
  | 'designerSpotlight'
  | 'heritage'
  | 'newsletterFooter'
  | 'sectionVisibility';

const TAB_META: Array<{ key: TabKey; label: string }> = [
  { key: 'topNavigations', label: 'Top Navigations' },
  { key: 'shopBy', label: 'Shop By' },
  { key: 'categoryManage', label: 'Category Manage' },
  { key: 'textIconCards', label: 'Text & Icon Cards' },
  { key: 'featured', label: 'Featured' },
  { key: 'freshDrops', label: 'Fresh Drops' },
  { key: 'designerSpotlight', label: 'Designer Spotlight' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'newsletterFooter', label: 'Newsletter & Footer' },
  { key: 'sectionVisibility', label: 'Section Visibility' },
];
const SUBMENU_TO_TAB: Record<string, TabKey> = {
  'top-navigations': 'topNavigations',
  'shop-by': 'shopBy',
  'category-manage': 'categoryManage',
  'text-icon-cards': 'textIconCards',
  featured: 'featured',
  'fresh-drops': 'freshDrops',
  'designer-spotlight': 'designerSpotlight',
  heritage: 'heritage',
  'newsletter-footer': 'newsletterFooter',
  'section-visibility': 'sectionVisibility',
};
const TAB_TO_SUBMENU: Record<TabKey, string> = {
  topNavigations: 'top-navigations',
  shopBy: 'shop-by',
  categoryManage: 'category-manage',
  textIconCards: 'text-icon-cards',
  featured: 'featured',
  freshDrops: 'fresh-drops',
  designerSpotlight: 'designer-spotlight',
  heritage: 'heritage',
  newsletterFooter: 'newsletter-footer',
  sectionVisibility: 'section-visibility',
};

const toApiPayload = (config: JenksV2FrontpageConfig) => ({
  topNavigations: config.topNavigations,
  shopBy: config.shopBy,
  categoryManage: config.categoryManage,
  textIconCards: config.textIconCards,
  featured: config.featured,
  freshDrops: config.freshDrops,
  designerSpotlight: config.designerSpotlight,
  heritage: config.heritage,
  newsletterFooter: config.newsletterFooter,
  sectionVisibility: config.sectionVisibility,
});

const mapLegacyManagerHref = (href: string) => {
  const normalized = href.trim();
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

const normalizeManagerHref = (value: unknown, fallback: string) => {
  const raw = String(value ?? '').trim();
  if (!raw) return mapLegacyManagerHref(fallback);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (!raw.startsWith('/')) return mapLegacyManagerHref(fallback);
  return mapLegacyManagerHref(raw);
};

const sanitizeConfigHrefs = (input: JenksV2FrontpageConfig): JenksV2FrontpageConfig => {
  const next = { ...input };
  next.topNavigations = {
    ...next.topNavigations,
    hamburgerMenu: next.topNavigations.hamburgerMenu.map((item) => ({
      ...item,
      href: normalizeManagerHref(item.href, '/'),
    })),
    additionalTopMenu: next.topNavigations.additionalTopMenu.map((item) => ({
      ...item,
      href: normalizeManagerHref(item.href, '/'),
    })),
    signInMenu: {
      ...next.topNavigations.signInMenu,
      href: normalizeManagerHref(next.topNavigations.signInMenu.href, '/auth/login'),
    },
    heroBanners: next.topNavigations.heroBanners.map((banner) => ({
      ...banner,
      primaryCtaLink: normalizeManagerHref(banner.primaryCtaLink, '/ready-to-wear'),
      secondaryCtaLink: normalizeManagerHref(banner.secondaryCtaLink, '/custom'),
    })),
  };
  next.shopBy = {
    ...next.shopBy,
    categories: next.shopBy.categories.map((item) => ({
      ...item,
      image: item.image,
    })),
    styleCards: next.shopBy.styleCards.map((item) => ({
      ...item,
      href: normalizeManagerHref(item.href, '/ready-to-wear'),
    })),
    priceCards: next.shopBy.priceCards.map((item) => ({
      ...item,
      href: normalizeManagerHref(item.href, '/ready-to-wear'),
    })),
  };
  next.categoryManage = {
    ...next.categoryManage,
    sections: next.categoryManage.sections.map((item) => ({
      ...item,
      ctaLink: normalizeManagerHref(item.ctaLink, '/ready-to-wear'),
    })),
  };
  next.featured = {
    ...next.featured,
    cards: next.featured.cards.map((item) => ({
      ...item,
      ctaLink: normalizeManagerHref(item.ctaLink, '/ready-to-wear'),
    })),
  };
  next.designerSpotlight = {
    ...next.designerSpotlight,
    cards: next.designerSpotlight.cards.map((item) => ({
      ...item,
      ctaLink: normalizeManagerHref(item.ctaLink, '/custom'),
    })),
  };
  next.newsletterFooter = {
    ...next.newsletterFooter,
    footer: {
      ...next.newsletterFooter.footer,
      policyLinks: next.newsletterFooter.footer.policyLinks.map((link) => ({
        ...link,
        href: normalizeManagerHref(link.href, '/help-center'),
      })),
      socialLinks: next.newsletterFooter.footer.socialLinks.map((link) => ({
        ...link,
        href: /^https?:\/\//i.test(String(link.href || '').trim())
          ? String(link.href || '').trim()
          : normalizeManagerHref(link.href, '/contact'),
      })),
      linkGroups: next.newsletterFooter.footer.linkGroups.map((group) => ({
        ...group,
        links: group.links.map((link) => ({
          ...link,
          href: normalizeManagerHref(link.href, '/ready-to-wear'),
        })),
      })),
    },
  };
  return next;
};

const asApiConfig = (input: unknown): JenksV2FrontpageConfig => {
  if (!input || typeof input !== 'object') return DEFAULT_CONFIG;
  const data = input as Partial<JenksV2FrontpageConfig>;
  const topNavigations = {
    ...DEFAULT_CONFIG.topNavigations,
    ...(data.topNavigations || {}),
  };
  const categoryManage = {
    ...DEFAULT_CONFIG.categoryManage,
    ...(data.categoryManage || {}),
  };
  const featured = {
    ...DEFAULT_CONFIG.featured,
    ...(data.featured || {}),
  };
  const designerSpotlight = {
    ...DEFAULT_CONFIG.designerSpotlight,
    ...(data.designerSpotlight || {}),
  };
  const fallbackHero = DEFAULT_CONFIG.topNavigations.heroBanners[0];
  const fallbackCategory = DEFAULT_CONFIG.categoryManage.sections[0];
  const fallbackFeatured = DEFAULT_CONFIG.featured.cards[0];
  const fallbackSpotlight = DEFAULT_CONFIG.designerSpotlight.cards[0];
  return {
    ...DEFAULT_CONFIG,
    ...data,
    topNavigations: {
      ...topNavigations,
      heroBanners: Array.isArray(topNavigations.heroBanners)
        ? topNavigations.heroBanners.map((banner, index) => {
            const next = { ...fallbackHero, ...banner };
            return {
              ...next,
              primaryCtaEnabled: toBoolean((banner as HeroBanner)?.primaryCtaEnabled, fallbackHero.primaryCtaEnabled),
              primaryCtaStyle: normalizeCtaStyle((banner as HeroBanner)?.primaryCtaStyle, fallbackHero.primaryCtaStyle),
              secondaryCtaEnabled: toBoolean((banner as HeroBanner)?.secondaryCtaEnabled, fallbackHero.secondaryCtaEnabled),
              secondaryCtaStyle: normalizeCtaStyle((banner as HeroBanner)?.secondaryCtaStyle, fallbackHero.secondaryCtaStyle),
            };
          })
        : DEFAULT_CONFIG.topNavigations.heroBanners,
    },
    categoryManage: {
      ...categoryManage,
      sections: Array.isArray(categoryManage.sections)
        ? categoryManage.sections.map((section) => ({
            ...fallbackCategory,
            ...section,
            ctaStyle: normalizeCtaStyle((section as CategorySection)?.ctaStyle, fallbackCategory.ctaStyle),
          }))
        : DEFAULT_CONFIG.categoryManage.sections,
    },
    featured: {
      ...featured,
      cards: Array.isArray(featured.cards)
        ? featured.cards.map((card) => ({
            ...fallbackFeatured,
            ...card,
            ctaStyle: normalizeCtaStyle((card as FeaturedCard)?.ctaStyle, fallbackFeatured.ctaStyle),
          }))
        : DEFAULT_CONFIG.featured.cards,
    },
    designerSpotlight: {
      ...designerSpotlight,
      cards: Array.isArray(designerSpotlight.cards)
        ? designerSpotlight.cards.map((card) => ({
            ...fallbackSpotlight,
            ...card,
            ctaStyle: normalizeCtaStyle((card as DesignerSpotlightCard)?.ctaStyle, fallbackSpotlight.ctaStyle),
          }))
        : DEFAULT_CONFIG.designerSpotlight.cards,
    },
  };
};

export default function JenksV2FrontPageManager() {
  const navigate = useNavigate();
  const { submenu } = useParams<{ submenu?: string }>();
  const [config, setConfig] = useState<JenksV2FrontpageConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('topNavigations');
  const [templateName, setTemplateName] = useState('');
  const [templateKey, setTemplateKey] = useState<TemplateKey>('TOP_NAVIGATIONS');
  const [templateOrder, setTemplateOrder] = useState('');
  const [addingMenuRouteKey, setAddingMenuRouteKey] = useState<string>('HOME');

  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const heroUploadRef = useRef<HTMLInputElement | null>(null);
  const categoryImageUploadRef = useRef<HTMLInputElement | null>(null);
  const featuredImageUploadRef = useRef<HTMLInputElement | null>(null);
  const heritageImageUploadRef = useRef<HTMLInputElement | null>(null);
  const spotlightImageUploadRef = useRef<HTMLInputElement | null>(null);

  const [heroUploadIndex, setHeroUploadIndex] = useState<number | null>(null);
  const [categoryUploadIndex, setCategoryUploadIndex] = useState<number | null>(null);
  const [featuredUploadIndex, setFeaturedUploadIndex] = useState<number | null>(null);
  const [spotlightUploadIndex, setSpotlightUploadIndex] = useState<number | null>(null);

  const updatedAtLabel = useMemo(() => {
    if (!config.updatedAt) return 'Never';
    const parsed = new Date(config.updatedAt);
    return Number.isNaN(parsed.getTime()) ? 'Never' : parsed.toLocaleString();
  }, [config.updatedAt]);

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.jenksV2Frontpage.getConfig();
      if (!response.success || !response.data) throw new Error('Failed to load Jenks-V2 frontpage manager config.');
      setConfig(sanitizeConfigHrefs(asApiConfig(response.data)));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load Jenks-V2 frontpage manager config.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, []);

  useEffect(() => {
    const nextTab = submenu ? SUBMENU_TO_TAB[submenu] : undefined;
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
    if (!submenu && activeTab !== 'topNavigations') {
      setActiveTab('topNavigations');
    }
  }, [submenu, activeTab]);

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.upload.image(formData);
    if (!response.success || !response.data?.url) {
      throw new Error('Image upload failed.');
    }
    return String(response.data.url);
  };

  const triggerUpload = (target: string) => {
    setUploadingTarget(target);
    setError('');
    setSuccess('');
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    triggerUpload('logo');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        topNavigations: {
          ...prev.topNavigations,
          logo: { ...prev.topNavigations.logo, mode: 'IMAGE', imageUrl: url },
        },
      }));
      setSuccess('Logo image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload logo image.');
    } finally {
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const handleHeroUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || heroUploadIndex === null) return;
    triggerUpload('hero');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        topNavigations: {
          ...prev.topNavigations,
          heroBanners: prev.topNavigations.heroBanners.map((banner, index) =>
            index === heroUploadIndex ? { ...banner, image: url } : banner
          ),
        },
      }));
      setSuccess('Hero banner image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload hero image.');
    } finally {
      setHeroUploadIndex(null);
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const handleCategoryImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || categoryUploadIndex === null) return;
    triggerUpload('category');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        shopBy: {
          ...prev.shopBy,
          categories: prev.shopBy.categories.map((category, index) =>
            index === categoryUploadIndex ? { ...category, image: url } : category
          ),
        },
      }));
      setSuccess('Category image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload category image.');
    } finally {
      setCategoryUploadIndex(null);
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const handleFeaturedImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || featuredUploadIndex === null) return;
    triggerUpload('featured');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        featured: {
          ...prev.featured,
          cards: prev.featured.cards.map((card, index) =>
            index === featuredUploadIndex ? { ...card, image: url } : card
          ),
        },
      }));
      setSuccess('Featured image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload featured image.');
    } finally {
      setFeaturedUploadIndex(null);
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const handleSpotlightImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || spotlightUploadIndex === null) return;
    triggerUpload('spotlight');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        designerSpotlight: {
          ...prev.designerSpotlight,
          cards: prev.designerSpotlight.cards.map((card, index) =>
            index === spotlightUploadIndex ? { ...card, image: url } : card
          ),
        },
      }));
      setSuccess('Designer spotlight image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload spotlight image.');
    } finally {
      setSpotlightUploadIndex(null);
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const handleHeritageImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    triggerUpload('heritage');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        heritage: {
          ...prev.heritage,
          image: url,
        },
      }));
      setSuccess('Heritage image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload heritage image.');
    } finally {
      setUploadingTarget(null);
      event.target.value = '';
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const sanitized = sanitizeConfigHrefs(config);
      const response = await api.jenksV2Frontpage.updateConfig(toApiPayload(sanitized));
      if (!response.success) throw new Error('Failed to save Jenks-V2 frontpage manager config.');
      setConfig(sanitizeConfigHrefs(asApiConfig(response.data)));
      setSuccess('Jenks-V2 frontpage manager config saved.');
    } catch (saveError: any) {
      const issues = saveError?.response?.data?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        const path = Array.isArray(first?.path) ? first.path.join('.') : '';
        const message = String(first?.message || 'Validation failed');
        setError(path ? `Validation failed at "${path}": ${message}` : `Validation failed: ${message}`);
      } else {
        setError(saveError?.response?.data?.message || saveError?.message || 'Failed to save Jenks-V2 config.');
      }
    } finally {
      setSaving(false);
    }
  };

  const createTemplateSection = async () => {
    if (!templateName.trim()) {
      setError('Section name is required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload: {
        name: string;
        templateKey: TemplateKey;
        order?: number;
      } = {
        name: templateName.trim(),
        templateKey,
      };
      const parsedOrder = Number(templateOrder);
      if (Number.isFinite(parsedOrder) && parsedOrder > 0) {
        payload.order = Math.round(parsedOrder);
      }
      const response = await api.jenksV2Frontpage.duplicateSection(payload);
      if (!response.success) throw new Error('Failed to duplicate section template.');
      setConfig(sanitizeConfigHrefs(asApiConfig(response.data)));
      setTemplateName('');
      setTemplateOrder('');
      setSuccess(response.message || 'Section template duplicated successfully.');
    } catch (duplicateError: any) {
      setError(duplicateError?.response?.data?.message || duplicateError?.message || 'Failed to duplicate section template.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Jenks-V2 FrontPage Manager...</span>
        </div>
      </div>
    );
  }

  const activeSection = TAB_META.find((item) => item.key === activeTab);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jenks-V2 FrontPage Manager</h1>
          <p className="text-sm text-gray-600">Comprehensive admin controllers for all Jenks-V2 frontpage sections.</p>
          <p className="mt-1 text-xs text-gray-500">
            Contract: {config.contractVersion} • Source: {config.source || 'DEFAULT'} • Updated: {updatedAtLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void fetchConfig()} disabled={saving}>
            Refresh
          </Button>
          <Button onClick={() => void saveConfig()} isLoading={saving}>
            Save All
          </Button>
        </div>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <div className="rounded-lg border bg-white p-3">
        <div className="flex flex-wrap gap-2">
          {TAB_META.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                navigate(`/admin/jenks-v2-frontpage-manager/${TAB_TO_SUBMENU[tab.key]}`);
              }}
              className={`rounded border px-3 py-2 text-xs font-medium ${
                activeTab === tab.key
                  ? 'border-black bg-black text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500">Active submenu: {activeSection?.label}</p>
      </div>

      {activeTab === 'topNavigations' ? (
        <section className="rounded-lg border bg-white p-5 space-y-6">
          <h2 className="text-xl font-semibold">Top Navigations</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.topNavigations.topStripEnabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: { ...prev.topNavigations, topStripEnabled: event.target.checked },
                  }))
                }
              />
              Enable Top Strip
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.topNavigations.searchIconEnabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: { ...prev.topNavigations, searchIconEnabled: event.target.checked },
                  }))
                }
              />
              Search Icon Enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.topNavigations.controllers.theme.enabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: {
                      ...prev.topNavigations,
                      controllers: {
                        ...prev.topNavigations.controllers,
                        theme: { ...prev.topNavigations.controllers.theme, enabled: event.target.checked },
                      },
                    },
                  }))
                }
              />
              Theme Controller Enabled
            </label>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Website Logo</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-xs">
                Mode
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.mode}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: { ...prev.topNavigations.logo, mode: event.target.value as 'TEXT' | 'IMAGE' },
                      },
                    }))
                  }
                >
                  <option value="TEXT">TEXT</option>
                  <option value="IMAGE">IMAGE</option>
                </select>
              </label>
              <label className="text-xs">
                Logo Text
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.text}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: { ...prev.topNavigations.logo, text: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Font Family
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.fontFamily}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: { ...prev.topNavigations.logo, fontFamily: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Text Color
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.textColor}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: { ...prev.topNavigations.logo, textColor: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Font Size
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.fontSize}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: {
                          ...prev.topNavigations.logo,
                          fontSize: clamp(toNumber(event.target.value, prev.topNavigations.logo.fontSize), 10, 96),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Width
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.width}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: {
                          ...prev.topNavigations.logo,
                          width: clamp(toNumber(event.target.value, prev.topNavigations.logo.width), 40, 600),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Height
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.height}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: {
                          ...prev.topNavigations.logo,
                          height: clamp(toNumber(event.target.value, prev.topNavigations.logo.height), 20, 300),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-2">
                Alt Text
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.logo.altText}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        logo: { ...prev.topNavigations.logo, altText: event.target.value },
                      },
                    }))
                  }
                />
              </label>
            </div>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" isLoading={uploadingTarget === 'logo'} onClick={() => logoUploadRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Logo Image
              </Button>
              <input ref={logoUploadRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <span className="text-xs text-gray-600 break-all">{config.topNavigations.logo.imageUrl || 'No logo image uploaded'}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Hamburger Menu</h3>
              <div className="flex gap-2">
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={addingMenuRouteKey}
                  onChange={(event) => setAddingMenuRouteKey(event.target.value)}
                >
                  {ROUTE_OPTIONS.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} ({option.href})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => {
                    const route = ROUTE_OPTIONS.find((item) => item.key === addingMenuRouteKey);
                    if (!route) return;
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        hamburgerMenu: [
                          ...prev.topNavigations.hamburgerMenu,
                          {
                            id: uid(),
                            label: route.label,
                            href: route.href,
                            routeKey: route.key,
                            icon: '',
                            enabled: true,
                          },
                        ],
                      },
                    }));
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {config.topNavigations.hamburgerMenu.map((item, index) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 rounded border p-2">
                  <input
                    className="col-span-3 rounded border px-2 py-1 text-xs"
                    value={item.label}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          hamburgerMenu: prev.topNavigations.hamburgerMenu.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, label: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-5 rounded border px-2 py-1 text-xs"
                    value={item.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          hamburgerMenu: prev.topNavigations.hamburgerMenu.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, href: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-2 rounded border px-2 py-1 text-xs"
                    value={item.routeKey || ''}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          hamburgerMenu: prev.topNavigations.hamburgerMenu.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, routeKey: event.target.value || undefined } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            hamburgerMenu: prev.topNavigations.hamburgerMenu.map((entry, itemIndex) =>
                              itemIndex === index ? { ...entry, enabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            hamburgerMenu: prev.topNavigations.hamburgerMenu.filter((_, itemIndex) => itemIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Additional Top Menu + Sign In + Theme Controller</h3>
              <div className="space-y-2">
                {config.topNavigations.additionalTopMenu.map((item, index) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 rounded border p-2">
                    <input
                      className="col-span-3 rounded border px-2 py-1 text-xs"
                      value={item.label}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            additionalTopMenu: prev.topNavigations.additionalTopMenu.map((entry, itemIndex) =>
                              itemIndex === index ? { ...entry, label: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <input
                      className="col-span-6 rounded border px-2 py-1 text-xs"
                      value={item.href}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            additionalTopMenu: prev.topNavigations.additionalTopMenu.map((entry, itemIndex) =>
                              itemIndex === index ? { ...entry, href: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <div className="col-span-3 flex items-center justify-end gap-1">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            topNavigations: {
                              ...prev.topNavigations,
                              additionalTopMenu: prev.topNavigations.additionalTopMenu.map((entry, itemIndex) =>
                                itemIndex === index ? { ...entry, enabled: event.target.checked } : entry
                              ),
                            },
                          }))
                        }
                      />
                      <button
                        type="button"
                        className="rounded border p-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            topNavigations: {
                              ...prev.topNavigations,
                              additionalTopMenu: prev.topNavigations.additionalTopMenu.filter((_, itemIndex) => itemIndex !== index),
                            },
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="text-xs">
                  Sign In Label
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={config.topNavigations.signInMenu.label}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          signInMenu: { ...prev.topNavigations.signInMenu, label: event.target.value },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Sign In Link
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={config.topNavigations.signInMenu.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          signInMenu: { ...prev.topNavigations.signInMenu, href: event.target.value },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Theme Mode
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={config.topNavigations.controllers.theme.mode}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          controllers: {
                            ...prev.topNavigations.controllers,
                            theme: { ...prev.topNavigations.controllers.theme, mode: event.target.value as ThemeMode },
                          },
                        },
                      }))
                    }
                  >
                    <option value="SYSTEM">SYSTEM</option>
                    <option value="LIGHT">LIGHT</option>
                    <option value="DARK">DARK</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Hero Banner Manager</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: {
                      ...prev.topNavigations,
                      heroBanners: [
                        ...prev.topNavigations.heroBanners,
                        {
                          id: uid(),
                          enabled: true,
                          displayOrder: prev.topNavigations.heroBanners.length,
                          image: '',
                          tag: '',
                          title: 'New Hero Banner',
                          titleFontSize: 56,
                          text: '',
                          description: '',
                          descriptionFontSize: 16,
                          primaryCtaEnabled: true,
                          primaryCtaText: 'SHOP NOW',
                          primaryCtaLink: '/ready-to-wear',
                          primaryCtaStyle: createCtaStyle({
                            backgroundColor: '#e66045',
                            textColor: '#ffffff',
                            borderColor: '#e66045',
                            borderWidth: 0,
                            fontSize: 12,
                          }),
                          secondaryCtaEnabled: true,
                          secondaryCtaText: 'EXPLORE',
                          secondaryCtaLink: '/custom',
                          secondaryCtaStyle: createCtaStyle({
                            backgroundColor: 'transparent',
                            textColor: '#111111',
                            borderColor: '#111111',
                            borderWidth: 1,
                            fontSize: 12,
                          }),
                        },
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Banner
              </Button>
            </div>

            {config.topNavigations.heroBanners.map((banner, index) => (
              <div key={banner.id} className="rounded border p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Banner {index + 1}</h4>
                  <div className="flex items-center gap-2">
                    <label className="text-xs flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={banner.enabled}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            topNavigations: {
                              ...prev.topNavigations,
                              heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                              ),
                            },
                          }))
                        }
                      />
                      Enabled
                    </label>
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.filter((_, entryIndex) => entryIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <label className="text-xs">
                    Tag
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.tag}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, tag: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs md:col-span-2">
                    Title
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.title}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, title: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Title Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.titleFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    titleFontSize: clamp(toNumber(event.target.value, entry.titleFontSize), 16, 120),
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs md:col-span-2">
                    Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.text}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, text: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs md:col-span-2">
                    Description
                    <textarea
                      rows={2}
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.description}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, description: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Description Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.descriptionFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    descriptionFontSize: clamp(
                                      toNumber(event.target.value, entry.descriptionFontSize),
                                      10,
                                      48
                                    ),
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Primary CTA Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.primaryCtaText}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, primaryCtaText: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Primary CTA Link
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.primaryCtaLink}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, primaryCtaLink: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={banner.primaryCtaEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, primaryCtaEnabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Primary CTA Enabled
                  </label>
                  <label className="text-xs">
                    Secondary CTA Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.secondaryCtaText}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, secondaryCtaText: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Secondary CTA Link
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.secondaryCtaLink}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, secondaryCtaLink: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={banner.secondaryCtaEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, secondaryCtaEnabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Secondary CTA Enabled
                  </label>
                {renderCtaStyleEditor(
                  'Primary CTA Style',
                  banner.primaryCtaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, primaryCtaStyle: nextStyle } : entry
                        ),
                      },
                    })),
                  'md:col-span-2'
                )}
                {renderCtaStyleEditor(
                  'Secondary CTA Style',
                  banner.secondaryCtaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, secondaryCtaStyle: nextStyle } : entry
                        ),
                      },
                    })),
                  'md:col-span-2'
                )}
                  <label className="text-xs">
                    Display Order
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.displayOrder}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, displayOrder: clamp(toNumber(event.target.value, 0), 0, 999) } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={uploadingTarget === 'hero'}
                    onClick={() => {
                      setHeroUploadIndex(index);
                      heroUploadRef.current?.click();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Banner Image
                  </Button>
                  <span className="text-xs text-gray-600 break-all">{banner.image || 'No hero image uploaded'}</span>
                </div>
              </div>
            ))}
            <input ref={heroUploadRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
          </div>
        </section>
      ) : null}

      {activeTab === 'shopBy' ? (
        <section className="rounded-lg border bg-white p-5 space-y-6">
          <h2 className="text-xl font-semibold">Shop By</h2>
          <p className="text-sm text-gray-600">
            Configure Shop By Category/Country/Style/Price, with static or database count modes.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-xs">
              Default Tab
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.defaultTab}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, defaultTab: event.target.value as ShopBy['defaultTab'] },
                  }))
                }
              >
                <option value="CATEGORY">CATEGORY</option>
                <option value="COUNTRY">COUNTRY</option>
                <option value="STYLE">STYLE</option>
                <option value="PRICE">PRICE</option>
              </select>
            </label>
            <label className="text-xs">
              Countries Count Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.countriesCountMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, countriesCountMode: event.target.value as CountMode },
                  }))
                }
              >
                <option value="STATIC">STATIC</option>
                <option value="DATABASE">DATABASE</option>
              </select>
            </label>
            <label className="text-xs">
              Categories Count Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.categoriesCountMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, categoriesCountMode: event.target.value as CountMode },
                  }))
                }
              >
                <option value="STATIC">STATIC</option>
                <option value="DATABASE">DATABASE</option>
              </select>
            </label>
            <div className="text-xs">
              Enabled Tabs
              <div className="mt-1 flex flex-wrap gap-2">
                {(['CATEGORY', 'COUNTRY', 'STYLE', 'PRICE'] as const).map((tab) => (
                  <label key={tab} className="flex items-center gap-1 rounded border px-2 py-1">
                    <input
                      type="checkbox"
                      checked={config.shopBy.enabledTabs.includes(tab)}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            enabledTabs: event.target.checked
                              ? Array.from(new Set([...prev.shopBy.enabledTabs, tab]))
                              : prev.shopBy.enabledTabs.filter((entry) => entry !== tab),
                          },
                        }))
                      }
                    />
                    {tab}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Shop By Country Manager</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: {
                      ...prev.shopBy,
                      countries: [
                        ...prev.shopBy.countries,
                        {
                          id: uid(),
                          code: '',
                          name: 'New Country',
                          icon: '🌍',
                          productCountMode: 'STATIC',
                          staticProductCount: 0,
                          enabled: true,
                          displayOrder: prev.shopBy.countries.length + 1,
                        },
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Country
              </Button>
            </div>
            {config.shopBy.countries.map((country, index) => (
              <div key={country.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={country.code}
                  placeholder="Code"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, code: event.target.value.toUpperCase() } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={country.name}
                  placeholder="Name"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, name: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={country.icon}
                  placeholder="Icon"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, icon: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <select
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={country.productCountMode}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, productCountMode: event.target.value as ShopByCountry['productCountMode'] } : entry
                        ),
                      },
                    }))
                  }
                >
                  <option value="STATIC">STATIC</option>
                  <option value="DATABASE_FTB">DATABASE_FTB</option>
                </select>
                <input
                  type="number"
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={country.staticProductCount}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index
                            ? { ...entry, staticProductCount: clamp(toNumber(event.target.value, 0), 0, 999999) }
                            : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  type="number"
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={country.displayOrder}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        countries: prev.shopBy.countries.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, displayOrder: clamp(toNumber(event.target.value, 1), 1, 999) } : entry
                        ),
                      },
                    }))
                  }
                />
                <div className="md:col-span-1 flex items-center gap-2 justify-end">
                  <input
                    type="checkbox"
                    checked={country.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          countries: prev.shopBy.countries.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded border p-1"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          countries: prev.shopBy.countries.filter((_, entryIndex) => entryIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Shop By Category Manager</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: {
                      ...prev.shopBy,
                      categories: [
                        ...prev.shopBy.categories,
                        {
                          id: uid(),
                          key: '',
                          title: 'New Category',
                          description: '',
                          image: '',
                          icon: '',
                          productCountMode: 'STATIC',
                          staticProductCount: 0,
                          enabled: true,
                          displayOrder: prev.shopBy.categories.length + 1,
                        },
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Category
              </Button>
            </div>
            {config.shopBy.categories.map((category, index) => (
              <div key={category.id} className="rounded border p-2 space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <input
                    className="md:col-span-1 rounded border px-2 py-1 text-xs"
                    value={category.key}
                    placeholder="Key"
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, key: event.target.value.toUpperCase() } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="md:col-span-2 rounded border px-2 py-1 text-xs"
                    value={category.title}
                    placeholder="Title"
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, title: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="md:col-span-3 rounded border px-2 py-1 text-xs"
                    value={category.description}
                    placeholder="Description"
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, description: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="md:col-span-1 rounded border px-2 py-1 text-xs"
                    value={category.icon}
                    placeholder="Icon"
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, icon: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <select
                    className="md:col-span-2 rounded border px-2 py-1 text-xs"
                    value={category.productCountMode}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, productCountMode: event.target.value as ShopByCategory['productCountMode'] } : entry
                          ),
                        },
                      }))
                    }
                  >
                    <option value="STATIC">STATIC</option>
                    <option value="DATABASE_CATEGORY">DATABASE_CATEGORY</option>
                  </select>
                  <input
                    type="number"
                    className="md:col-span-1 rounded border px-2 py-1 text-xs"
                    value={category.staticProductCount}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          categories: prev.shopBy.categories.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, staticProductCount: clamp(toNumber(event.target.value, 0), 0, 999999) }
                              : entry
                          ),
                        },
                      }))
                    }
                  />
                  <div className="md:col-span-2 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCategoryUploadIndex(index);
                        categoryImageUploadRef.current?.click();
                      }}
                      isLoading={uploadingTarget === 'category'}
                    >
                      <Upload className="h-3.5 w-3.5" />
                    </Button>
                    <input
                      type="checkbox"
                      checked={category.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            categories: prev.shopBy.categories.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            categories: prev.shopBy.categories.filter((_, entryIndex) => entryIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 break-all">Image: {category.image || 'No image uploaded'}</p>
              </div>
            ))}
            <input
              ref={categoryImageUploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCategoryImageUpload}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Shop By Style Cards</h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        styleCards: [
                          ...prev.shopBy.styleCards,
                          {
                            id: uid(),
                            title: 'New Style',
                            description: '',
                            href: '/ready-to-wear',
                            enabled: true,
                            displayOrder: prev.shopBy.styleCards.length + 1,
                          },
                        ],
                      },
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {config.shopBy.styleCards.map((card, index) => (
                <div key={card.id} className="grid grid-cols-12 gap-2 rounded border p-2">
                  <input
                    className="col-span-3 rounded border px-2 py-1 text-xs"
                    value={card.title}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, title: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-4 rounded border px-2 py-1 text-xs"
                    value={card.description}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, description: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-3 rounded border px-2 py-1 text-xs"
                    value={card.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, href: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <input
                      type="checkbox"
                      checked={card.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            styleCards: prev.shopBy.styleCards.filter((_, entryIndex) => entryIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Shop By Price Cards</h3>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      shopBy: {
                        ...prev.shopBy,
                        priceCards: [
                          ...prev.shopBy.priceCards,
                          {
                            id: uid(),
                            title: 'New Price',
                            priceLabel: '',
                            description: '',
                            href: '/shop',
                            enabled: true,
                            displayOrder: prev.shopBy.priceCards.length + 1,
                          },
                        ],
                      },
                    }))
                  }
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {config.shopBy.priceCards.map((card, index) => (
                <div key={card.id} className="grid grid-cols-12 gap-2 rounded border p-2">
                  <input
                    className="col-span-3 rounded border px-2 py-1 text-xs"
                    value={card.title}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, title: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-2 rounded border px-2 py-1 text-xs"
                    value={card.priceLabel}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, priceLabel: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-3 rounded border px-2 py-1 text-xs"
                    value={card.description}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, description: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <input
                    className="col-span-2 rounded border px-2 py-1 text-xs"
                    value={card.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, href: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <input
                      type="checkbox"
                      checked={card.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            priceCards: prev.shopBy.priceCards.filter((_, entryIndex) => entryIndex !== index),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'categoryManage' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Category Manage</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  categoryManage: {
                    sections: [
                      ...prev.categoryManage.sections,
                      {
                        id: uid(),
                        key: '',
                        title: 'New Category Section',
                        tag: '',
                        description: '',
                        ctaText: '',
                        ctaLink: '/ready-to-wear',
                        ctaStyle: createCtaStyle({
                          backgroundColor: 'transparent',
                          textColor: '#ffffff',
                          borderColor: 'transparent',
                          borderWidth: 0,
                          fontSize: 18,
                        }),
                        enabled: true,
                        displayOrder: prev.categoryManage.sections.length + 1,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Section
            </Button>
          </div>
          {config.categoryManage.sections.map((section, index) => (
            <div key={section.id} className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-16">
              <input
                className="md:col-span-1 rounded border px-2 py-1 text-xs"
                value={section.key}
                placeholder="Key"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, key: event.target.value.toUpperCase() } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-2 rounded border px-2 py-1 text-xs"
                value={section.title}
                placeholder="Title"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, title: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-1 rounded border px-2 py-1 text-xs"
                value={section.tag}
                placeholder="Tag"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, tag: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-3 rounded border px-2 py-1 text-xs"
                value={section.description}
                placeholder="Description"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, description: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-2 rounded border px-2 py-1 text-xs"
                value={section.ctaText}
                placeholder="CTA Text"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, ctaText: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-2 rounded border px-2 py-1 text-xs"
                value={section.ctaLink}
                placeholder="CTA Link"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, ctaLink: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              {renderCtaStyleEditor(
                'Section CTA Style',
                section.ctaStyle,
                (nextStyle) =>
                  setConfig((prev) => ({
                    ...prev,
                    categoryManage: {
                      sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, ctaStyle: nextStyle } : entry
                      ),
                    },
                  })),
                'md:col-span-4'
              )}
              <div className="md:col-span-1 flex items-center justify-end gap-1">
                <input
                  type="checkbox"
                  checked={section.enabled}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      categoryManage: {
                        sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                        ),
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  className="rounded border p-1"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      categoryManage: {
                        sections: prev.categoryManage.sections.filter((_, entryIndex) => entryIndex !== index),
                      },
                    }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'textIconCards' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Text & Icon Cards</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  textIconCards: {
                    ...prev.textIconCards,
                    cards: [
                      ...prev.textIconCards.cards,
                      {
                        id: uid(),
                        sectionType: 'CUSTOM',
                        title: 'New Custom Card',
                        description: '',
                        icon: 'Sparkles',
                        enabled: true,
                        displayOrder: prev.textIconCards.cards.length + 1,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={config.textIconCards.allowCustomCards}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  textIconCards: { ...prev.textIconCards, allowCustomCards: event.target.checked },
                }))
              }
            />
            Allow admin to create custom cards from this section
          </label>

          {config.textIconCards.cards.map((card, index) => (
            <div key={card.id} className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-12">
              <select
                className="md:col-span-2 rounded border px-2 py-1 text-xs"
                value={card.sectionType}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      cards: prev.textIconCards.cards.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, sectionType: event.target.value as TextIconCard['sectionType'] } : entry
                      ),
                    },
                  }))
                }
              >
                <option value="HOW_IT_WORKS">HOW_IT_WORKS</option>
                <option value="SHOP_WITH_CONFIDENCE">SHOP_WITH_CONFIDENCE</option>
                <option value="CUSTOM">CUSTOM</option>
              </select>
              <input
                className="md:col-span-3 rounded border px-2 py-1 text-xs"
                value={card.title}
                placeholder="Title"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      cards: prev.textIconCards.cards.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, title: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-4 rounded border px-2 py-1 text-xs"
                value={card.description}
                placeholder="Description"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      cards: prev.textIconCards.cards.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, description: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <input
                className="md:col-span-2 rounded border px-2 py-1 text-xs"
                value={card.icon}
                placeholder="Icon"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      cards: prev.textIconCards.cards.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, icon: event.target.value } : entry
                      ),
                    },
                  }))
                }
              />
              <div className="md:col-span-1 flex items-center justify-end gap-1">
                <input
                  type="checkbox"
                  checked={card.enabled}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      textIconCards: {
                        ...prev.textIconCards,
                        cards: prev.textIconCards.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                        ),
                      },
                    }))
                  }
                />
                <button
                  type="button"
                  className="rounded border p-1"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      textIconCards: {
                        ...prev.textIconCards,
                        cards: prev.textIconCards.cards.filter((_, entryIndex) => entryIndex !== index),
                      },
                    }))
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {activeTab === 'featured' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Featured</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  featured: {
                    cards: [
                      ...prev.featured.cards,
                      {
                        id: uid(),
                        key: '',
                        image: '',
                        tag: '',
                        title: 'New Featured Section',
                        description: '',
                        ctaText: 'View',
                        ctaLink: '/ready-to-wear',
                        ctaStyle: createCtaStyle({
                          backgroundColor: 'transparent',
                          textColor: '#ffffff',
                          borderColor: 'transparent',
                          borderWidth: 0,
                          fontSize: 14,
                        }),
                        enabled: true,
                        displayOrder: prev.featured.cards.length + 1,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Featured Card
            </Button>
          </div>
          {config.featured.cards.map((card, index) => (
            <div key={card.id} className="rounded border p-3 space-y-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={card.key}
                  placeholder="Key"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, key: event.target.value.toUpperCase() } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={card.tag}
                  placeholder="Tag"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, tag: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-3 rounded border px-2 py-1 text-xs"
                  value={card.title}
                  placeholder="Title"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, title: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-3 rounded border px-2 py-1 text-xs"
                  value={card.description}
                  placeholder="Description"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, description: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={card.ctaText}
                  placeholder="CTA"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaText: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={card.ctaLink}
                  placeholder="Link"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaLink: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                {renderCtaStyleEditor(
                  'Card CTA Style',
                  card.ctaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaStyle: nextStyle } : entry
                        ),
                      },
                    })),
                  'md:col-span-3'
                )}
                <div className="md:col-span-1 flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={uploadingTarget === 'featured'}
                    onClick={() => {
                      setFeaturedUploadIndex(index);
                      featuredImageUploadRef.current?.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    type="checkbox"
                    checked={card.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          cards: prev.featured.cards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded border p-1"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          cards: prev.featured.cards.filter((_, entryIndex) => entryIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 break-all">Image: {card.image || 'No image uploaded'}</p>
            </div>
          ))}
          <input
            ref={featuredImageUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFeaturedImageUpload}
          />
        </section>
      ) : null}

      {activeTab === 'freshDrops' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="text-xl font-semibold">Fresh Drops</h2>
          <p className="text-sm text-gray-600">
            Control product population source, listing age, country/category filters, row/column layout, and section copy.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs">
              Source Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.sourceMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: { ...prev.freshDrops, sourceMode: event.target.value as FreshDrops['sourceMode'] },
                  }))
                }
              >
                <option value="NEWLY_LISTED">NEWLY_LISTED</option>
                <option value="FILTERED">FILTERED</option>
              </select>
            </label>
            <label className="text-xs">
              Listing Age (days)
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.listingAgeDays}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: {
                      ...prev.freshDrops,
                      listingAgeDays: clamp(toNumber(event.target.value, prev.freshDrops.listingAgeDays), 1, 365),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Rows
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.rows}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: { ...prev.freshDrops, rows: clamp(toNumber(event.target.value, prev.freshDrops.rows), 1, 12) },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Columns
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.columns}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: {
                      ...prev.freshDrops,
                      columns: clamp(toNumber(event.target.value, prev.freshDrops.columns), 1, 12),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-2">
              Country Filters (comma-separated)
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.countryFilters.join(', ')}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: {
                      ...prev.freshDrops,
                      countryFilters: event.target.value
                        .split(',')
                        .map((item) => item.trim().toUpperCase())
                        .filter(Boolean)
                        .slice(0, 100),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-2">
              Category Filters (comma-separated)
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.categoryFilters.join(', ')}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: {
                      ...prev.freshDrops,
                      categoryFilters: event.target.value
                        .split(',')
                        .map((item) => item.trim().toUpperCase())
                        .filter(Boolean)
                        .slice(0, 40),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.freshDrops.mixCategoryResults}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: { ...prev.freshDrops, mixCategoryResults: event.target.checked },
                  }))
                }
              />
              Mix and match category results
            </label>
            <label className="text-xs md:col-span-2">
              Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.title}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: { ...prev.freshDrops, title: event.target.value },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-2">
              Section Description
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.freshDrops.description}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    freshDrops: { ...prev.freshDrops, description: event.target.value },
                  }))
                }
              />
            </label>
          </div>
        </section>
      ) : null}

      {activeTab === 'designerSpotlight' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Designer Spotlight</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  designerSpotlight: {
                    ...prev.designerSpotlight,
                    cards: [
                      ...prev.designerSpotlight.cards,
                      {
                        id: uid(),
                        image: '',
                        tag: '',
                        title: 'New Spotlight Card',
                        description: '',
                        ctaText: 'View Designer',
                        ctaLink: '/custom',
                        ctaStyle: createCtaStyle({
                          backgroundColor: 'transparent',
                          textColor: '#ffffff',
                          borderColor: 'transparent',
                          borderWidth: 0,
                          fontSize: 14,
                        }),
                        enabled: true,
                        displayOrder: prev.designerSpotlight.cards.length + 1,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Card
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs">
              Rows
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.designerSpotlight.rows}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    designerSpotlight: {
                      ...prev.designerSpotlight,
                      rows: clamp(toNumber(event.target.value, prev.designerSpotlight.rows), 1, 12),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Columns
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.designerSpotlight.columns}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    designerSpotlight: {
                      ...prev.designerSpotlight,
                      columns: clamp(toNumber(event.target.value, prev.designerSpotlight.columns), 1, 12),
                    },
                  }))
                }
              />
            </label>
          </div>

          {config.designerSpotlight.cards.map((card, index) => (
            <div key={card.id} className="rounded border p-3 space-y-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={card.tag}
                  placeholder="Tag"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, tag: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-3 rounded border px-2 py-1 text-xs"
                  value={card.title}
                  placeholder="Title"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, title: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-3 rounded border px-2 py-1 text-xs"
                  value={card.description}
                  placeholder="Description"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, description: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={card.ctaText}
                  placeholder="CTA"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaText: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={card.ctaLink}
                  placeholder="CTA Link"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaLink: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                {renderCtaStyleEditor(
                  'Card CTA Style',
                  card.ctaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      designerSpotlight: {
                        ...prev.designerSpotlight,
                        cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaStyle: nextStyle } : entry
                        ),
                      },
                    })),
                  'md:col-span-3'
                )}
                <div className="md:col-span-1 flex items-center justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={uploadingTarget === 'spotlight'}
                    onClick={() => {
                      setSpotlightUploadIndex(index);
                      spotlightImageUploadRef.current?.click();
                    }}
                  >
                    <Upload className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    type="checkbox"
                    checked={card.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        designerSpotlight: {
                          ...prev.designerSpotlight,
                          cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded border p-1"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        designerSpotlight: {
                          ...prev.designerSpotlight,
                          cards: prev.designerSpotlight.cards.filter((_, entryIndex) => entryIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 break-all">Image: {card.image || 'No image uploaded'}</p>
            </div>
          ))}
          <input
            ref={spotlightImageUploadRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleSpotlightImageUpload}
          />
        </section>
      ) : null}

      {activeTab === 'heritage' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Heritage</h2>
            <Button type="button" variant="outline" isLoading={uploadingTarget === 'heritage'} onClick={() => heritageImageUploadRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Upload Heritage Image
            </Button>
          </div>
          <input ref={heritageImageUploadRef} type="file" accept="image/*" className="hidden" onChange={handleHeritageImageUpload} />
          <p className="text-[11px] text-gray-500 break-all">Image: {config.heritage.image || 'No image uploaded'}</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs">
              Title
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.title}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, title: event.target.value } }))}
              />
            </label>
            <label className="text-xs">
              Tag
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.tag}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, tag: event.target.value } }))}
              />
            </label>
            <label className="text-xs">
              Description
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.description}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, description: event.target.value } }))}
              />
            </label>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Stats (value + location)</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    heritage: {
                      ...prev.heritage,
                      stats: [
                        ...prev.heritage.stats,
                        {
                          id: uid(),
                          label: 'Stat',
                          value: '0',
                          suffix: '',
                          positionX: 12,
                          positionY: 80,
                          enabled: true,
                          displayOrder: prev.heritage.stats.length + 1,
                        },
                      ],
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Stat
              </Button>
            </div>
            {config.heritage.stats.map((stat, index) => (
              <div key={stat.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={stat.label}
                  placeholder="Label"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, label: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={stat.value}
                  placeholder="Value"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, value: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  value={stat.suffix}
                  placeholder="Suffix"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, suffix: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  type="number"
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={stat.positionX}
                  placeholder="X"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, positionX: clamp(toNumber(event.target.value, 0), 0, 100) } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  type="number"
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={stat.positionY}
                  placeholder="Y"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, positionY: clamp(toNumber(event.target.value, 0), 0, 100) } : entry
                        ),
                      },
                    }))
                  }
                />
                <input
                  type="number"
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={stat.displayOrder}
                  placeholder="Order"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      heritage: {
                        ...prev.heritage,
                        stats: prev.heritage.stats.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, displayOrder: clamp(toNumber(event.target.value, 1), 1, 999) } : entry
                        ),
                      },
                    }))
                  }
                />
                <div className="md:col-span-1 flex items-center justify-end gap-1">
                  <input
                    type="checkbox"
                    checked={stat.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        heritage: {
                          ...prev.heritage,
                          stats: prev.heritage.stats.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <button
                    type="button"
                    className="rounded border p-1"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        heritage: {
                          ...prev.heritage,
                          stats: prev.heritage.stats.filter((_, entryIndex) => entryIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'newsletterFooter' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="text-xl font-semibold">Newsletter and Footer</h2>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Newsletter Controls</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.newsletterFooter.newsletter.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          newsletter: { ...prev.newsletterFooter.newsletter, enabled: event.target.checked },
                        },
                      }))
                    }
                  />
                  Enabled
                </span>
              </label>
              <label className="text-xs">
                Title
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.newsletter.title}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        newsletter: { ...prev.newsletterFooter.newsletter, title: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Description
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.newsletter.description}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        newsletter: { ...prev.newsletterFooter.newsletter, description: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Email Placeholder
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.newsletter.emailPlaceholder}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        newsletter: { ...prev.newsletterFooter.newsletter, emailPlaceholder: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Submit Label
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.newsletter.submitLabel}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        newsletter: { ...prev.newsletterFooter.newsletter, submitLabel: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Success Message
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.newsletter.successMessage}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        newsletter: { ...prev.newsletterFooter.newsletter, successMessage: event.target.value },
                      },
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Footer Controls</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <label className="text-xs">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.newsletterFooter.footer.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: { ...prev.newsletterFooter.footer, enabled: event.target.checked },
                        },
                      }))
                    }
                  />
                  Footer Enabled
                </span>
              </label>
              <label className="text-xs">
                Brand Text
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.brandText}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: { ...prev.newsletterFooter.footer, brandText: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Address
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.address}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: { ...prev.newsletterFooter.footer, address: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Contact Email
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.contactEmail}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: { ...prev.newsletterFooter.footer, contactEmail: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Contact Phone
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.contactPhone}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: { ...prev.newsletterFooter.footer, contactPhone: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-3">
                Copyright
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.copyright}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: { ...prev.newsletterFooter.footer, copyright: event.target.value },
                      },
                    }))
                  }
                />
              </label>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === 'sectionVisibility' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <h2 className="text-xl font-semibold">Section Visibility</h2>
          <p className="text-sm text-gray-600">
            Turn frontpage sections on/off and duplicate any section template into a custom section with ordered placement.
          </p>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Create Section from Template</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <label className="text-xs md:col-span-2">
                Section Name
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="e.g. Custom Story Section"
                />
              </label>
              <label className="text-xs">
                Replica Template
                <select
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={templateKey}
                  onChange={(event) => setTemplateKey(event.target.value as TemplateKey)}
                >
                  {TEMPLATES.map((template) => (
                    <option key={template.key} value={template.key}>
                      {template.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs">
                Order Number (optional)
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={templateOrder}
                  onChange={(event) => setTemplateOrder(event.target.value)}
                  placeholder="Auto"
                />
              </label>
            </div>
            <Button onClick={() => void createTemplateSection()} isLoading={saving}>
              Create Section from Template
            </Button>
          </div>

          <div className="rounded-lg border p-4 space-y-2">
            <h3 className="text-sm font-semibold">Section Order and Visibility</h3>
            {config.sectionVisibility.sections
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((section, index) => (
                <div key={section.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                  <div className="md:col-span-3 text-xs font-medium">
                    {section.name}
                    <span className="ml-2 rounded border px-1 py-0.5 text-[10px] text-gray-600">
                      {section.isCustom ? 'Custom' : 'Core'}
                    </span>
                  </div>
                  <div className="md:col-span-3 text-xs text-gray-600">{section.templateKey}</div>
                  <input
                    type="number"
                    className="md:col-span-2 rounded border px-2 py-1 text-xs"
                    value={section.order}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        sectionVisibility: {
                          sections: prev.sectionVisibility.sections.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, order: clamp(toNumber(event.target.value, entry.order), 1, 999) } : entry
                          ),
                        },
                      }))
                    }
                  />
                  <label className="md:col-span-2 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={section.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          sectionVisibility: {
                            sections: prev.sectionVisibility.sections.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Visible
                  </label>
                  <div className="md:col-span-2 flex justify-end">
                    {section.isCustom ? (
                      <button
                        type="button"
                        className="rounded border p-1"
                        onClick={() =>
                          setConfig((prev) => ({
                            ...prev,
                            sectionVisibility: {
                              sections: prev.sectionVisibility.sections.filter((entry) => entry.id !== section.id),
                            },
                          }))
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="text-[11px] text-gray-400">Core section</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </section>
      ) : null}

      {activeTab === 'newsletterFooter' ||
      activeTab === 'shopBy' ||
      activeTab === 'topNavigations' ||
      activeTab === 'categoryManage' ||
      activeTab === 'textIconCards' ||
      activeTab === 'featured' ||
      activeTab === 'freshDrops' ||
      activeTab === 'designerSpotlight' ||
      activeTab === 'heritage' ||
      activeTab === 'sectionVisibility' ? null : (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-xl font-semibold">Section coming soon</h2>
        </section>
      )}
    </div>
  );
}
