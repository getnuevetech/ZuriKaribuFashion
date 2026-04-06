import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api, resolveAssetUrl } from '../../services/api';

type ThemeMode = 'SYSTEM' | 'LIGHT' | 'DARK';
type CountMode = 'STATIC' | 'DATABASE';
type TemplateKey =
  | 'TOP_NAVIGATIONS'
  | 'SHOP_BY'
  | 'SHOP_BY_COUNTRY'
  | 'CATEGORY_MANAGE'
  | 'HOW_IT_WORKS'
  | 'CUSTOM_TEXT_ICON'
  | 'SHOP_WITH_CONFIDENCE'
  | 'FEATURED'
  | 'FRESH_DROPS'
  | 'DESIGNER_SPOTLIGHT'
  | 'HERITAGE'
  | 'CUSTOMER_REVIEWS'
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
  layoutMode?: 'SPLIT' | 'FULL';
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
  primaryCtaText: string;
  primaryCtaLink: string;
  primaryCtaEnabled: boolean;
  primaryCtaStyle: CTAStyle;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  secondaryCtaEnabled: boolean;
  secondaryCtaStyle: CTAStyle;
  tertiaryCtaText: string;
  tertiaryCtaLink: string;
  tertiaryCtaEnabled: boolean;
  tertiaryCtaStyle: CTAStyle;
};

type TopNavigations = {
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

type ShopBy = {
  sectionTag: string;
  sectionTitle: string;
  sectionDescription: string;
  sectionDescriptionEnabled: boolean;
  enabledTabs: Array<'CATEGORY' | 'STYLE' | 'PRICE'>;
  defaultTab: 'CATEGORY' | 'STYLE' | 'PRICE';
  countriesCountMode: CountMode;
  categoriesCountMode: CountMode;
  countries: ShopByCountry[];
  categories: ShopByCategory[];
  styleCards: ShopByCard[];
  priceCards: ShopByPriceCard[];
};

type ShopByCountrySection = {
  sectionTag: string;
  sectionTitle: string;
  sectionDescription: string;
  sectionDescriptionEnabled: boolean;
  countriesCountMode: CountMode;
  countries: ShopByCountry[];
};

type CategorySection = {
  id: string;
  key: string;
  title: string;
  tag: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaMode: 'URL' | 'PAGE';
  ctaPageKey?: string;
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

type TextIconSectionTitles = {
  howItWorks: string;
  custom: string;
  shopWithConfidence: string;
};

type TextIconCardStyle = {
  cardMinHeight: number;
  cardWidth: number;
  iconSize: number;
  titleFontSize: number;
  descriptionFontSize: number;
};
type TextIconSectionStyles = {
  howItWorks: TextIconCardStyle;
  custom: TextIconCardStyle;
  shopWithConfidence: TextIconCardStyle;
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
  ctaStyle: CTAStyle;
  enabled: boolean;
  displayOrder: number;
};

type FeaturedCategoryKey = 'RTW' | 'CTW' | 'FTB';
type FeaturedLayout = {
  rows: number;
  columns: number;
};
const FEATURED_KEYS: FeaturedCategoryKey[] = ['RTW', 'CTW', 'FTB'];

type CustomerReviewStaticMessage = {
  id: string;
  customerName: string;
  location: string;
  message: string;
  rating: number;
  enabled: boolean;
  displayOrder: number;
};

type CustomerReviews = {
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
  ctaMode: 'URL' | 'PAGE';
  ctaPageKey?: string;
  ctaStyle: CTAStyle;
  enabled: boolean;
  displayOrder: number;
};

type CTAStyle = {
  textColor: string;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  hoverTextColor: string;
  hoverBorderColor: string;
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
  storyHtml: string;
  readMoreLabel: string;
  readMoreHref: string;
  statsPosition: 'TOP' | 'MIDDLE' | 'BOTTOM';
  stats: HeritageStat[];
};

type LinkMode = 'PAGE' | 'CUSTOM_URL';

type LinkItem = {
  id: string;
  label: string;
  icon?: string;
  href: string;
  hrefMode: LinkMode;
  pageKey?: string;
  routeKey?: string;
  customUrl?: string;
  enabled: boolean;
};

type LinkGroup = {
  id: string;
  title: string;
  links: LinkItem[];
};

type FooterLogoSettings = {
  mode: 'TEXT' | 'IMAGE';
  text: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  imageUrl: string;
  altText: string;
  width: number;
  height: number;
};

type FooterMapSettings = {
  enabled: boolean;
  image: string;
  overlayColor: string;
  overlayOpacity: number;
  minHeight: number;
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

type SectionTitleAlign = 'LEFT' | 'CENTER' | 'RIGHT';

type JenksV2FrontpageConfig = {
  contractVersion: string;
  topNavigations: TopNavigations;
  shopBy: ShopBy;
  shopByCountry: ShopByCountrySection;
  categoryManage: {
    sections: CategorySection[];
  };
  textIconCards: {
    sectionTitles: TextIconSectionTitles;
    sectionHeadings: {
      howItWorks: TextIconSectionHeading;
      custom: TextIconSectionHeading;
      shopWithConfidence: TextIconSectionHeading;
    };
    cardStyle: TextIconCardStyle;
    sectionStyles: TextIconSectionStyles;
    allowCustomCards: boolean;
    cards: TextIconCard[];
  };
  featured: {
    columns: number;
    layoutByKey: Record<FeaturedCategoryKey, FeaturedLayout>;
    cards: FeaturedCard[];
  };
  freshDrops: FreshDrops;
  designerSpotlight: DesignerSpotlight;
  heritage: Heritage;
  customerReviews: CustomerReviews;
  newsletterFooter: NewsletterFooter;
  sectionVisibility: {
    sections: SectionVisibilityEntry[];
    sectionTitleSettings?: {
      showTitles: boolean;
      alignment: SectionTitleAlign;
    };
    titleSettings?: {
      show: boolean;
      align: SectionTitleAlign;
    };
  };
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
};

const TEMPLATES: Array<{ key: TemplateKey; label: string }> = [
  { key: 'TOP_NAVIGATIONS', label: 'Top Navigations' },
  { key: 'SHOP_BY', label: 'Shop By' },
  { key: 'SHOP_BY_COUNTRY', label: 'Shop By Country' },
  { key: 'CATEGORY_MANAGE', label: 'Category Manage' },
  { key: 'HOW_IT_WORKS', label: 'How It Works' },
  { key: 'CUSTOM_TEXT_ICON', label: 'Custom' },
  { key: 'SHOP_WITH_CONFIDENCE', label: 'Shop With Confidence' },
  { key: 'FEATURED', label: 'Featured' },
  { key: 'FRESH_DROPS', label: 'Fresh Drops' },
  { key: 'DESIGNER_SPOTLIGHT', label: 'Designer Spotlight' },
  { key: 'HERITAGE', label: 'Heritage' },
  { key: 'CUSTOMER_REVIEWS', label: 'From Our Customers' },
  { key: 'NEWSLETTER_FOOTER', label: 'Newsletter and Footer' },
];

type RouteOption = {
  key: string;
  label: string;
  href: string;
};

const PAGE_HREF_BY_KEY: Record<string, string> = {
  HOME: '/',
  READY_TO_WEAR: '/readytowear',
  CUSTOM_TO_WEAR: '/cystomtowear',
  FABRICS: '/fabricstobuy',
  DESIGNERS: '/designers',
  ABOUT: '/about',
  CONTACT: '/contact',
  HELP_CENTER: '/help-center',
  COUNTRY_PRODUCTS: '/country-products',
  AUTH_LOGIN: '/auth/login',
};

const resolvePageHrefForKey = (pageKey: unknown, fallbackHref: string) => {
  const token = String(pageKey || '').trim().toUpperCase();
  if (token && PAGE_HREF_BY_KEY[token]) return PAGE_HREF_BY_KEY[token];
  return mapLegacyManagerHref(fallbackHref);
};

const normalizeCtaMode = (value: unknown, fallback: 'URL' | 'PAGE' = 'PAGE'): 'URL' | 'PAGE' =>
  String(value || fallback).trim().toUpperCase() === 'PAGE' ? 'PAGE' : 'URL';

const ROUTE_OPTIONS: RouteOption[] = [
  { key: 'HOME', label: 'Home', href: '/' },
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', href: '/readytowear' },
  { key: 'FABRICS', label: 'Fabric To Buy', href: '/fabricstobuy' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', href: '/cystomtowear' },
  { key: 'DESIGNERS', label: 'Designers', href: '/designers' },
  { key: 'ABOUT', label: 'About Us', href: '/about' },
  { key: 'CONTACT', label: 'Contact', href: '/contact' },
  { key: 'HELP_CENTER', label: 'Help Center', href: '/help-center' },
  { key: 'COUNTRY_PRODUCTS', label: 'Country Products', href: '/country-products' },
  { key: 'AUTH_LOGIN', label: 'Sign In', href: '/auth/login' },
];
const PAGE_ROUTE_OPTIONS = ROUTE_OPTIONS;

const toBlogRouteOptions = (input: unknown): RouteOption[] => {
  if (!Array.isArray(input)) return [];
  const seenHrefs = new Set<string>();
  const seenKeys = new Set<string>();
  const routes: RouteOption[] = [];
  for (const entry of input) {
    const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    const rawSlug = String(row.slug || '').trim();
    const rawTitle = String(row.title || '').trim();
    const rawLink = String(row.link || '').trim();
    const href = rawLink || (rawSlug ? `/stories/${rawSlug}` : '');
    if (!href || !href.startsWith('/')) continue;
    if (seenHrefs.has(href)) continue;
    const slugToken = rawSlug ? rawSlug : rawTitle || `story-${routes.length + 1}`;
    const normalizedKeyBase = `BLOG_${slugToken.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}`;
    let key = normalizedKeyBase || `BLOG_${routes.length + 1}`;
    let keyCounter = 2;
    while (seenKeys.has(key)) {
      key = `${normalizedKeyBase}_${keyCounter}`;
      keyCounter += 1;
    }
    seenKeys.add(key);
    seenHrefs.add(href);
    routes.push({
      key,
      label: rawTitle ? `Story: ${rawTitle}` : `Story: ${rawSlug || `#${routes.length + 1}`}`,
      href,
    });
  }
  return routes;
};

const AFRICAN_COUNTRIES_54 = [
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
  { code: 'CD', name: 'DR Congo' },
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
  { code: 'CI', name: "Cote d'Ivoire" },
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
  { code: 'ZM', name: 'Zambia' },
  { code: 'ZW', name: 'Zimbabwe' },
] as const;

const COUNTRY_BY_CODE = new Map(AFRICAN_COUNTRIES_54.map((entry) => [entry.code, entry]));

const ICON_OPTIONS = [
  'Search',
  'Palette',
  'Sparkles',
  'ShieldCheck',
  'RefreshCw',
  'Truck',
  'Headphones',
  'ShoppingBag',
  'Heart',
  'Briefcase',
  'CalendarDays',
  'Globe',
  'Tag',
  'ArrowRight',
  'MapPin',
] as const;

const CATEGORY_SECTION_KEY_OPTIONS = ['RTW', 'FTB', 'CTW'] as const;

const SOCIAL_ICON_OPTIONS = ['Instagram', 'Facebook', 'Twitter', 'X', 'Youtube', 'Globe'] as const;
const LINK_GROUP_TITLE_OPTIONS = ['Shop', 'Company', 'Support', 'Legal', 'Community'] as const;

const flagEmoji = (countryCode: string) => {
  const normalized = String(countryCode || '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '🌍';
  return normalized.replace(/[A-Z]/g, (char) => String.fromCodePoint(char.charCodeAt(0) + 127397));
};

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
  hoverTextColor: '#ffffff',
  hoverBorderColor: '#e66045',
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
    hoverTextColor: String(row.hoverTextColor || fallback.hoverTextColor || '#ffffff'),
    hoverBorderColor: String(row.hoverBorderColor || fallback.hoverBorderColor || '#e66045'),
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
        Hover Text Color
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.hoverTextColor}
          onChange={(event) => onChange({ ...style, hoverTextColor: event.target.value })}
        />
      </label>
      <label className="text-[11px]">
        Hover Border Color
        <input
          className="mt-1 w-full rounded border px-2 py-1.5"
          value={style.hoverBorderColor}
          onChange={(event) => onChange({ ...style, hoverBorderColor: event.target.value })}
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
    hamburgerMenu: [defaultLink('Home', '/', 'HOME')],
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
    additionalTopMenu: [defaultLink('Shop', '/readytowear', 'SHOP')],
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
        layoutMode: 'SPLIT',
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
        description: 'Control title, text, tags, font size, CTA labels and links for each hero banner.',
        descriptionEnabled: true,
        descriptionFontSize: 16,
        primaryCtaEnabled: true,
        primaryCtaText: 'SHOP NOW',
        primaryCtaLink: '/readytowear',
        primaryCtaStyle: createCtaStyle({
          backgroundColor: '#e66045',
          textColor: '#ffffff',
          borderColor: '#e66045',
          borderWidth: 0,
          fontSize: 12,
        }),
        secondaryCtaEnabled: true,
        secondaryCtaText: 'EXPLORE DESIGNERS',
        secondaryCtaLink: '/cystomtowear',
        secondaryCtaStyle: createCtaStyle({
          backgroundColor: 'transparent',
          textColor: '#111111',
          borderColor: '#111111',
          borderWidth: 1,
          fontSize: 12,
        }),
        tertiaryCtaEnabled: true,
        tertiaryCtaText: 'SHOP FABRICS',
        tertiaryCtaLink: '/fabricstobuy',
        tertiaryCtaStyle: createCtaStyle({
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
    sectionDescription: 'Browse by category, style, or budget.',
    sectionDescriptionEnabled: true,
    enabledTabs: ['CATEGORY', 'STYLE', 'PRICE'],
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
        href: '/readytowear',
        icon: 'CalendarDays',
        titleFontSize: 15,
        descriptionFontSize: 14,
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
        href: '/readytowear?price=under-100',
        icon: 'Tag',
        titleFontSize: 24,
        descriptionFontSize: 14,
        enabled: true,
        displayOrder: 1,
      },
    ],
  },
  shopByCountry: {
    sectionTag: 'Discover',
    sectionTitle: 'Shop By Country',
    sectionDescription: 'Explore traditional textiles and contemporary designs from across the African continent.',
    sectionDescriptionEnabled: true,
    countriesCountMode: 'STATIC',
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
        ctaLink: '/readytowear',
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
        ctaLink: '/cystomtowear',
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
        ctaLink: '/fabricstobuy',
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
    sectionTitles: {
      howItWorks: 'How It Works',
      custom: 'Custom',
      shopWithConfidence: 'Shop With Confidence',
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
        id: uid(),
        sectionType: 'HOW_IT_WORKS',
        title: 'How it works',
        description: 'Manage process cards and icon settings.',
        icon: 'Workflow',
        enabled: true,
        displayOrder: 1,
      },
      {
        id: uid(),
        sectionType: 'CUSTOM',
        title: 'Custom',
        description: 'Manage standalone custom text/icon cards.',
        icon: 'Sparkles',
        enabled: true,
        displayOrder: 2,
      },
      {
        id: uid(),
        sectionType: 'SHOP_WITH_CONFIDENCE',
        title: 'Shop with confidence',
        description: 'Manage trust cards and icon settings.',
        icon: 'ShieldCheck',
        enabled: true,
        displayOrder: 3,
      },
    ],
  },
  featured: {
    columns: 2,
    layoutByKey: {
      RTW: { rows: 1, columns: 2 },
      CTW: { rows: 1, columns: 2 },
      FTB: { rows: 1, columns: 2 },
    },
    cards: [
      {
        id: uid(),
        key: 'RTW',
        image: '',
        tag: 'Featured RTW',
        title: 'Featured Ready To Wear',
        description: 'Spotlight featured RTW products.',
        ctaText: 'Shop RTW',
        ctaLink: '/readytowear',
        ctaMode: 'PAGE',
        ctaPageKey: 'READY_TO_WEAR',
        productGroup: 'RTW',
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
        ctaLink: '/cystomtowear',
        ctaMode: 'PAGE',
        ctaPageKey: 'CUSTOM_TO_WEAR',
        productGroup: 'CTW',
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
        ctaLink: '/fabricstobuy',
        ctaMode: 'PAGE',
        ctaPageKey: 'FABRICS',
        productGroup: 'FTB',
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
        ctaLink: '/cystomtowear',
        ctaMode: 'PAGE',
        ctaPageKey: 'CUSTOM_TO_WEAR',
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
    storyHtml: '<p>Our heritage is woven from artisan craft, bold silhouettes, and stories passed down across generations.</p>',
    readMoreLabel: 'Read More',
    readMoreHref: '/stories/our-heritage',
    statsPosition: 'BOTTOM',
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
    autoplayIntervalMs: 4500,
    pauseOnHover: true,
    showNavigation: true,
    showIndicators: true,
    staticMessages: [
      {
        id: uid(),
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
        fontWeight: 700,
        imageUrl: '',
        altText: 'Jenks',
        width: 180,
        height: 52,
      },
      address: 'Lagos, Nigeria',
      contactEmail: 'support@jenks.africa',
      contactPhone: '+234 000 000 0000',
      copyright: '© Jenks. All rights reserved.',
      policyLinks: [{ id: uid(), label: 'Privacy Policy', hrefMode: 'PAGE', pageKey: 'HELP_CENTER', href: '/help-center', enabled: true }],
      socialLinks: [{ id: uid(), label: 'Instagram', icon: 'Instagram', hrefMode: 'CUSTOM_URL', customUrl: 'https://instagram.com', href: 'https://instagram.com', enabled: true }],
      linkGroups: [
        {
          id: uid(),
          title: 'Shop',
          links: [
            { id: uid(), label: 'Ready To Wear', hrefMode: 'PAGE', pageKey: 'READY_TO_WEAR', href: '/readytowear', enabled: true },
            { id: uid(), label: 'Custom To Wear', hrefMode: 'PAGE', pageKey: 'CUSTOM_TO_WEAR', href: '/cystomtowear', enabled: true },
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
    titleSettings: {
      show: true,
      align: 'LEFT',
    },
  },
};

type TabKey =
  | 'topNavigations'
  | 'shopBy'
  | 'shopByCountry'
  | 'categoryManage'
  | 'textIconCards'
  | 'featured'
  | 'freshDrops'
  | 'designerSpotlight'
  | 'heritage'
  | 'customerReviews'
  | 'newsletterFooter'
  | 'sectionVisibility';

const TAB_META: Array<{ key: TabKey; label: string }> = [
  { key: 'topNavigations', label: 'Top Navigations' },
  { key: 'shopBy', label: 'Shop By' },
  { key: 'shopByCountry', label: 'Shop By Country' },
  { key: 'categoryManage', label: 'Category Manage' },
  { key: 'textIconCards', label: 'Text & Icon Cards' },
  { key: 'featured', label: 'Featured' },
  { key: 'freshDrops', label: 'Fresh Drops' },
  { key: 'designerSpotlight', label: 'Designer Spotlight' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'customerReviews', label: 'From Our Customers' },
  { key: 'newsletterFooter', label: 'Newsletter & Footer' },
  { key: 'sectionVisibility', label: 'Section Visibility' },
];
const SUBMENU_TO_TAB: Record<string, TabKey> = {
  'top-navigations': 'topNavigations',
  'shop-by': 'shopBy',
  'shop-by-country': 'shopByCountry',
  'category-manage': 'categoryManage',
  'text-icon-cards': 'textIconCards',
  featured: 'featured',
  'fresh-drops': 'freshDrops',
  'designer-spotlight': 'designerSpotlight',
  heritage: 'heritage',
  'customer-reviews': 'customerReviews',
  'newsletter-footer': 'newsletterFooter',
  'section-visibility': 'sectionVisibility',
};
const TAB_TO_SUBMENU: Record<TabKey, string> = {
  topNavigations: 'top-navigations',
  shopBy: 'shop-by',
  shopByCountry: 'shop-by-country',
  categoryManage: 'category-manage',
  textIconCards: 'text-icon-cards',
  featured: 'featured',
  freshDrops: 'fresh-drops',
  designerSpotlight: 'designer-spotlight',
  heritage: 'heritage',
  customerReviews: 'customer-reviews',
  newsletterFooter: 'newsletter-footer',
  sectionVisibility: 'section-visibility',
};

const toApiPayload = (config: JenksV2FrontpageConfig) => ({
  topNavigations: config.topNavigations,
  shopBy: config.shopBy,
  shopByCountry: config.shopByCountry,
  categoryManage: config.categoryManage,
  textIconCards: config.textIconCards,
  featured: config.featured,
  freshDrops: config.freshDrops,
  designerSpotlight: config.designerSpotlight,
  heritage: config.heritage,
  customerReviews: config.customerReviews,
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
      return `/readytowear${normalized.slice('/shop'.length)}`;
    }
    return '/readytowear';
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

const normalizeFeaturedLayoutByKey = (
  input: unknown,
  fallbackColumns = 2
): Record<FeaturedCategoryKey, FeaturedLayout> => {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const clampLayout = (value: unknown, fallbackRows: number, fallbackCols: number): FeaturedLayout => {
    const item = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      rows: clamp(Math.round(toNumber(String(item.rows ?? fallbackRows), fallbackRows)), 1, 12),
      columns: clamp(Math.round(toNumber(String(item.columns ?? fallbackCols), fallbackCols)), 1, 4),
    };
  };
  return {
    RTW: clampLayout((row as any).RTW ?? (row as any).rtw, 1, fallbackColumns),
    CTW: clampLayout((row as any).CTW ?? (row as any).ctw, 1, fallbackColumns),
    FTB: clampLayout((row as any).FTB ?? (row as any).ftb, 1, fallbackColumns),
  };
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
      primaryCtaLink: normalizeManagerHref(banner.primaryCtaLink, '/readytowear'),
      secondaryCtaLink: normalizeManagerHref(banner.secondaryCtaLink, '/cystomtowear'),
      rightPanelBackgroundMode:
        String((banner as HeroBanner)?.rightPanelBackgroundMode || '').trim().toUpperCase() === 'IMAGE' ? 'IMAGE' : 'NONE',
      rightPanelBackgroundImage: String((banner as HeroBanner)?.rightPanelBackgroundImage || ''),
      textVerticalAlign: ((): HeroBanner['textVerticalAlign'] => {
        const token = String((banner as HeroBanner)?.textVerticalAlign || '').trim().toUpperCase();
        if (token === 'TOP' || token === 'BOTTOM') return token;
        return 'MIDDLE';
      })(),
      leftWidthPercent: clamp(Math.round(toNumber(String((banner as HeroBanner)?.leftWidthPercent ?? 58), 58)), 20, 80),
      rightWidthPercent: clamp(Math.round(toNumber(String((banner as HeroBanner)?.rightWidthPercent ?? 42), 42)), 20, 80),
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
      href: normalizeManagerHref(item.href, '/readytowear'),
    })),
    priceCards: next.shopBy.priceCards.map((item) => ({
      ...item,
      href: normalizeManagerHref(item.href, '/readytowear'),
    })),
  };
  next.categoryManage = {
    ...next.categoryManage,
    sections: next.categoryManage.sections.map((item) => ({
      ...item,
      ctaMode: normalizeCtaMode(item.ctaMode, 'PAGE'),
      ctaPageKey: String(item.ctaPageKey || '').trim().toUpperCase(),
      ctaLink:
        normalizeCtaMode(item.ctaMode, 'PAGE') === 'PAGE'
          ? resolvePageHrefForKey(item.ctaPageKey, '/readytowear')
          : normalizeManagerHref(item.ctaLink, '/readytowear'),
    })),
  };
  next.featured = {
    ...next.featured,
    layoutByKey: {
      RTW: {
        rows: clamp(toNumber(String((next.featured.layoutByKey as any)?.RTW?.rows ?? 1), 1), 1, 12),
        columns: clamp(toNumber(String((next.featured.layoutByKey as any)?.RTW?.columns ?? next.featured.columns ?? 2), 2), 1, 4),
      },
      CTW: {
        rows: clamp(toNumber(String((next.featured.layoutByKey as any)?.CTW?.rows ?? 1), 1), 1, 12),
        columns: clamp(toNumber(String((next.featured.layoutByKey as any)?.CTW?.columns ?? next.featured.columns ?? 2), 2), 1, 4),
      },
      FTB: {
        rows: clamp(toNumber(String((next.featured.layoutByKey as any)?.FTB?.rows ?? 1), 1), 1, 12),
        columns: clamp(toNumber(String((next.featured.layoutByKey as any)?.FTB?.columns ?? next.featured.columns ?? 2), 2), 1, 4),
      },
    },
    cards: next.featured.cards.map((item) => ({
      ...item,
      ctaLink: normalizeManagerHref(item.ctaLink, '/readytowear'),
      ctaMode:
        String((item as FeaturedCard).ctaMode || '').trim().toUpperCase() === 'PAGE'
          ? 'PAGE'
          : String((item as FeaturedCard).ctaMode || '').trim().toUpperCase() === 'PRODUCT_GROUP'
            ? 'PRODUCT_GROUP'
            : 'URL',
      ctaPageKey: String((item as FeaturedCard).ctaPageKey || ''),
    })),
  };
  next.heritage = {
    ...next.heritage,
    readMoreHref: normalizeManagerHref(next.heritage.readMoreHref, '/stories/our-heritage'),
  };
  next.designerSpotlight = {
    ...next.designerSpotlight,
    cards: next.designerSpotlight.cards.map((item) => ({
      ...item,
      ctaMode: normalizeCtaMode(item.ctaMode, 'PAGE'),
      ctaPageKey: String(item.ctaPageKey || '').trim().toUpperCase(),
      ctaLink:
        normalizeCtaMode(item.ctaMode, 'PAGE') === 'PAGE'
          ? resolvePageHrefForKey(item.ctaPageKey, '/cystomtowear')
          : normalizeManagerHref(item.ctaLink, '/cystomtowear'),
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
          href: normalizeManagerHref(link.href, '/readytowear'),
        })),
      })),
    },
  };
  return next;
};

const normalizeLinkItemWithDefaults = (entry: unknown): LinkItem => {
  const row = entry && typeof entry === 'object' ? (entry as Partial<LinkItem>) : {};
  const hrefModeToken = String((row as any).hrefMode || '').trim().toUpperCase();
  const hrefMode: LinkItem['hrefMode'] =
    hrefModeToken === 'CUSTOM_URL' ? 'CUSTOM_URL' : hrefModeToken === 'DROPDOWN' ? 'PAGE' : 'PAGE';
  const pageKey = String((row as any).pageKey || (row as any).routeKey || '').trim().toUpperCase();
  const customUrl = String((row as any).customUrl || '').trim();
  const defaultHref = String(row.href || '/');
  const routeHref =
    ROUTE_OPTIONS.find((entry) => entry.key === pageKey)?.href ||
    defaultHref ||
    '/';
  const href = hrefMode === 'CUSTOM_URL' ? (customUrl || defaultHref || '/') : routeHref;
  return {
    id: String(row.id || uid()),
    label: String(row.label || ''),
    icon: typeof row.icon === 'string' ? row.icon : undefined,
    href,
    hrefMode,
    pageKey: pageKey || undefined,
    routeKey: pageKey || undefined,
    customUrl: hrefMode === 'CUSTOM_URL' ? customUrl : '',
    enabled: typeof row.enabled === 'boolean' ? row.enabled : true,
  };
};

const ensureSectionVisibilityTitleSettings = (
  sectionVisibility: JenksV2FrontpageConfig['sectionVisibility'] | undefined
): JenksV2FrontpageConfig['sectionVisibility'] => {
  const current = sectionVisibility || { sections: [] };
  const legacy = current.sectionTitleSettings;
  const titleSettings = current.titleSettings || {
    show: toBoolean(legacy?.showTitles, true),
    align:
      legacy?.alignment === 'CENTER' || legacy?.alignment === 'RIGHT'
        ? legacy.alignment
        : 'LEFT',
  };
  return {
    ...current,
    titleSettings: {
      show: toBoolean(titleSettings.show, true),
      align:
        titleSettings.align === 'CENTER' || titleSettings.align === 'RIGHT'
          ? titleSettings.align
          : 'LEFT',
    },
  };
};

const templateKeyToSectionKey = (key: TemplateKey) =>
  key.toLowerCase().replace(/[^a-z0-9]+/g, '-');

const ensureCompleteSectionVisibility = (
  sectionVisibility: JenksV2FrontpageConfig['sectionVisibility'] | undefined
): JenksV2FrontpageConfig['sectionVisibility'] => {
  const withTitleSettings = ensureSectionVisibilityTitleSettings(sectionVisibility);
  const existing = Array.isArray(withTitleSettings.sections) ? withTitleSettings.sections : [];
  const normalized = existing.map((entry, index) => {
    const template =
      TEMPLATES.find((item) => item.key === entry.templateKey) ||
      TEMPLATES.find((item) => item.key === 'TOP_NAVIGATIONS');
    const fallbackOrder = index + 1;
    return {
      ...entry,
      id: String(entry.id || uid()),
      key: String(entry.key || templateKeyToSectionKey(template!.key)),
      name: String(entry.name || template?.label || 'Section'),
      templateKey: (template?.key || 'TOP_NAVIGATIONS') as TemplateKey,
      enabled: toBoolean(entry.enabled, true),
      order: clamp(Math.round(toNumber(String(entry.order ?? fallbackOrder), fallbackOrder)), 1, 999),
      isCustom: toBoolean(entry.isCustom, false),
      configSnapshot: entry.configSnapshot || {},
    } as SectionVisibilityEntry;
  });

  const coreSections = normalized.filter((entry) => !entry.isCustom);
  const customSections = normalized.filter((entry) => entry.isCustom);
  const coreByTemplate = new Map<TemplateKey, SectionVisibilityEntry>();
  const maxOrder = normalized.reduce((acc, entry) => Math.max(acc, entry.order), 0);

  coreSections.forEach((entry) => {
    // Keep the first core section per template.
    if (!coreByTemplate.has(entry.templateKey)) {
      coreByTemplate.set(entry.templateKey, entry);
    }
  });

  TEMPLATES.forEach((template, index) => {
    if (!coreByTemplate.has(template.key)) {
      const fallbackOrder = maxOrder + index + 1;
      coreByTemplate.set(template.key, {
        id: uid(),
        key: templateKeyToSectionKey(template.key),
        name: template.label,
        templateKey: template.key,
        enabled: true,
        order: fallbackOrder,
        isCustom: false,
        configSnapshot: {},
      });
    }
  });

  return {
    ...withTitleSettings,
    sections: [...Array.from(coreByTemplate.values()), ...customSections].sort((a, b) => a.order - b.order),
  };
};

const normalizeTextIconHeading = (
  raw: unknown,
  fallback: TextIconSectionHeading,
  fallbackTitle: string
): TextIconSectionHeading => {
  const row = raw && typeof raw === 'object' ? (raw as Partial<TextIconSectionHeading>) : {};
  const titlePositionToken = String(row.titlePosition || fallback.titlePosition || 'LEFT').trim().toUpperCase();
  const titlePosition: TextIconSectionHeading['titlePosition'] =
    titlePositionToken === 'CENTER' || titlePositionToken === 'RIGHT' ? titlePositionToken : 'LEFT';
  return {
    title: String(row.title || fallback.title || fallbackTitle),
    titleEnabled: toBoolean(row.titleEnabled, fallback.titleEnabled),
    titlePosition,
    titleFontSize: clamp(
      Math.round(toNumber(String(row.titleFontSize ?? fallback.titleFontSize), fallback.titleFontSize)),
      10,
      72
    ),
    description: String(row.description || fallback.description || ''),
    descriptionEnabled: toBoolean(row.descriptionEnabled, fallback.descriptionEnabled),
    descriptionFontSize: clamp(
      Math.round(toNumber(String(row.descriptionFontSize ?? fallback.descriptionFontSize), fallback.descriptionFontSize)),
      8,
      72
    ),
  };
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
  const textIconCards = data.textIconCards as Partial<JenksV2FrontpageConfig['textIconCards']> | undefined;
  return {
    ...DEFAULT_CONFIG,
    ...data,
    topNavigations: {
      ...topNavigations,
      hamburgerMenuFontSize: clamp(
        Math.round(toNumber(String((topNavigations as TopNavigations).hamburgerMenuFontSize ?? DEFAULT_CONFIG.topNavigations.hamburgerMenuFontSize), DEFAULT_CONFIG.topNavigations.hamburgerMenuFontSize)),
        16,
        72
      ),
      hamburgerMenuFontWeight: clamp(
        Math.round(
          toNumber(
            String((topNavigations as TopNavigations).hamburgerMenuFontWeight ?? DEFAULT_CONFIG.topNavigations.hamburgerMenuFontWeight),
            DEFAULT_CONFIG.topNavigations.hamburgerMenuFontWeight
          )
        ),
        100,
        900
      ),
      heroBanners: Array.isArray(topNavigations.heroBanners)
        ? topNavigations.heroBanners.map((banner, index) => {
            const next = { ...fallbackHero, ...banner };
            const layoutToken = String((banner as HeroBanner)?.layoutMode || next.layoutMode || 'SPLIT')
              .trim()
              .toUpperCase();
            const layoutMode: HeroBanner['layoutMode'] = layoutToken === 'FULL' ? 'FULL' : 'SPLIT';
            const modeToken = String((banner as HeroBanner)?.rightPanelBackgroundMode || next.rightPanelBackgroundMode || 'NONE')
              .trim()
              .toUpperCase();
            const rightPanelBackgroundMode: HeroBanner['rightPanelBackgroundMode'] =
              layoutMode === 'FULL' ? 'NONE' : modeToken === 'IMAGE' ? 'IMAGE' : 'NONE';
            const alignToken = String((banner as HeroBanner)?.textVerticalAlign || next.textVerticalAlign || 'MIDDLE')
              .trim()
              .toUpperCase();
            const textVerticalAlign: HeroBanner['textVerticalAlign'] =
              alignToken === 'TOP' || alignToken === 'BOTTOM' ? alignToken : 'MIDDLE';
            const leftWidthPercent = clamp(
              Math.round(toNumber(String((banner as HeroBanner)?.leftWidthPercent ?? next.leftWidthPercent), 58)),
              20,
              80
            );
            const rightWidthPercent = 100 - leftWidthPercent;
            return {
              ...next,
              layoutMode,
              rightPanelBackgroundMode,
              rightPanelBackgroundImage: String((banner as HeroBanner)?.rightPanelBackgroundImage || next.rightPanelBackgroundImage || ''),
              textVerticalAlign,
              leftWidthPercent,
              rightWidthPercent,
              textEnabled: toBoolean((banner as HeroBanner)?.textEnabled, fallbackHero.textEnabled),
              descriptionEnabled: toBoolean((banner as HeroBanner)?.descriptionEnabled, fallbackHero.descriptionEnabled),
              primaryCtaEnabled: toBoolean((banner as HeroBanner)?.primaryCtaEnabled, fallbackHero.primaryCtaEnabled),
              primaryCtaStyle: normalizeCtaStyle((banner as HeroBanner)?.primaryCtaStyle, fallbackHero.primaryCtaStyle),
              secondaryCtaEnabled: toBoolean((banner as HeroBanner)?.secondaryCtaEnabled, fallbackHero.secondaryCtaEnabled),
              secondaryCtaStyle: normalizeCtaStyle((banner as HeroBanner)?.secondaryCtaStyle, fallbackHero.secondaryCtaStyle),
              tertiaryCtaEnabled: toBoolean((banner as HeroBanner)?.tertiaryCtaEnabled, fallbackHero.tertiaryCtaEnabled),
              tertiaryCtaStyle: normalizeCtaStyle((banner as HeroBanner)?.tertiaryCtaStyle, fallbackHero.tertiaryCtaStyle),
            };
          })
        : DEFAULT_CONFIG.topNavigations.heroBanners,
    },
    shopBy: {
      ...DEFAULT_CONFIG.shopBy,
      ...(data.shopBy || {}),
      sectionTag: String((data.shopBy as ShopBy | undefined)?.sectionTag || DEFAULT_CONFIG.shopBy.sectionTag),
      sectionTitle: String((data.shopBy as ShopBy | undefined)?.sectionTitle || DEFAULT_CONFIG.shopBy.sectionTitle),
      sectionDescription: String((data.shopBy as ShopBy | undefined)?.sectionDescription || DEFAULT_CONFIG.shopBy.sectionDescription),
      sectionDescriptionEnabled: toBoolean(
        (data.shopBy as ShopBy | undefined)?.sectionDescriptionEnabled,
        DEFAULT_CONFIG.shopBy.sectionDescriptionEnabled
      ),
      countries: Array.isArray((data.shopBy as ShopBy | undefined)?.countries)
        ? (data.shopBy as ShopBy).countries
        : DEFAULT_CONFIG.shopBy.countries,
      categories: Array.isArray((data.shopBy as ShopBy | undefined)?.categories)
        ? (data.shopBy as ShopBy).categories
        : DEFAULT_CONFIG.shopBy.categories,
      styleCards: Array.isArray((data.shopBy as ShopBy | undefined)?.styleCards)
        ? (data.shopBy as ShopBy).styleCards
        : DEFAULT_CONFIG.shopBy.styleCards,
      priceCards: Array.isArray((data.shopBy as ShopBy | undefined)?.priceCards)
        ? (data.shopBy as ShopBy).priceCards
        : DEFAULT_CONFIG.shopBy.priceCards,
    },
    shopByCountry: {
      ...DEFAULT_CONFIG.shopByCountry,
      ...((data as any).shopByCountry || {}),
      sectionTag: String((data as any).shopByCountry?.sectionTag || DEFAULT_CONFIG.shopByCountry.sectionTag),
      sectionTitle: String((data as any).shopByCountry?.sectionTitle || DEFAULT_CONFIG.shopByCountry.sectionTitle),
      sectionDescription: String(
        (data as any).shopByCountry?.sectionDescription || DEFAULT_CONFIG.shopByCountry.sectionDescription
      ),
      sectionDescriptionEnabled: toBoolean(
        (data as any).shopByCountry?.sectionDescriptionEnabled,
        DEFAULT_CONFIG.shopByCountry.sectionDescriptionEnabled
      ),
      countriesCountMode:
        String((data as any).shopByCountry?.countriesCountMode || '').trim().toUpperCase() === 'DATABASE'
          ? 'DATABASE'
          : DEFAULT_CONFIG.shopByCountry.countriesCountMode,
      countries: Array.isArray((data as any).shopByCountry?.countries)
        ? (data as any).shopByCountry.countries
        : Array.isArray((data.shopBy as ShopBy | undefined)?.countries)
          ? (data.shopBy as ShopBy).countries
          : DEFAULT_CONFIG.shopByCountry.countries,
    },
    textIconCards: {
      ...DEFAULT_CONFIG.textIconCards,
      ...(textIconCards || {}),
      sectionTitles: {
        ...DEFAULT_CONFIG.textIconCards.sectionTitles,
        ...(textIconCards?.sectionTitles || {}),
      },
      cardStyle: {
        ...DEFAULT_CONFIG.textIconCards.cardStyle,
        ...(textIconCards?.cardStyle || {}),
      },
      sectionStyles: {
        ...DEFAULT_CONFIG.textIconCards.sectionStyles,
        ...(textIconCards?.sectionStyles || {}),
      },
      cards: Array.isArray(textIconCards?.cards) ? (textIconCards?.cards as TextIconCard[]) : DEFAULT_CONFIG.textIconCards.cards,
    },
    categoryManage: {
      ...categoryManage,
      sections: Array.isArray(categoryManage.sections)
        ? categoryManage.sections.map((section) => ({
            ...fallbackCategory,
            ...section,
            ctaMode: normalizeCtaMode((section as CategorySection)?.ctaMode, fallbackCategory.ctaMode),
            ctaPageKey: ((): string => {
              const explicit = String((section as CategorySection)?.ctaPageKey || fallbackCategory.ctaPageKey || '').trim().toUpperCase();
              if (explicit) return explicit;
              const keyToken = String((section as CategorySection)?.key || '').trim().toUpperCase();
              if (keyToken === 'CTW') return 'CUSTOM_TO_WEAR';
              if (keyToken === 'FTB') return 'FABRICS';
              return 'READY_TO_WEAR';
            })(),
            ctaLink:
              normalizeCtaMode((section as CategorySection)?.ctaMode, fallbackCategory.ctaMode) === 'PAGE'
                ? resolvePageHrefForKey(
                    (section as CategorySection)?.ctaPageKey,
                    (section as CategorySection)?.ctaLink || fallbackCategory.ctaLink
                  )
                : normalizeManagerHref((section as CategorySection)?.ctaLink, fallbackCategory.ctaLink),
            ctaStyle: normalizeCtaStyle((section as CategorySection)?.ctaStyle, fallbackCategory.ctaStyle),
          }))
        : DEFAULT_CONFIG.categoryManage.sections,
    },
    featured: {
      ...featured,
      layoutByKey: {
        RTW: {
          rows: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.RTW?.rows ?? (featured as any)?.layoutByKey?.rtw?.rows ?? 1),
                1
              )
            ),
            1,
            12
          ),
          columns: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.RTW?.columns ?? (featured as any)?.layoutByKey?.rtw?.columns ?? featured.columns ?? 2),
                2
              )
            ),
            1,
            4
          ),
        },
        CTW: {
          rows: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.CTW?.rows ?? (featured as any)?.layoutByKey?.ctw?.rows ?? 1),
                1
              )
            ),
            1,
            12
          ),
          columns: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.CTW?.columns ?? (featured as any)?.layoutByKey?.ctw?.columns ?? featured.columns ?? 2),
                2
              )
            ),
            1,
            4
          ),
        },
        FTB: {
          rows: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.FTB?.rows ?? (featured as any)?.layoutByKey?.ftb?.rows ?? 1),
                1
              )
            ),
            1,
            12
          ),
          columns: clamp(
            Math.round(
              toNumber(
                String((featured as any)?.layoutByKey?.FTB?.columns ?? (featured as any)?.layoutByKey?.ftb?.columns ?? featured.columns ?? 2),
                2
              )
            ),
            1,
            4
          ),
        },
      },
      cards: Array.isArray(featured.cards)
        ? featured.cards.map((card) => ({
            ...fallbackFeatured,
            ...card,
            ctaMode: ((): FeaturedCard['ctaMode'] => {
              const token = String((card as FeaturedCard)?.ctaMode || '').trim().toUpperCase();
              if (token === 'PAGE') return 'PAGE';
              if (token === 'PRODUCT_GROUP') return 'PAGE';
              return 'URL';
            })(),
            ctaPageKey: ((): string => {
              const explicit = String((card as FeaturedCard)?.ctaPageKey || fallbackFeatured.ctaPageKey || '').trim().toUpperCase();
              if (explicit) return explicit;
              const groupToken = String((card as FeaturedCard)?.productGroup || '').trim().toUpperCase();
              if (groupToken === 'CTW') return 'CUSTOM_TO_WEAR';
              if (groupToken === 'FTB') return 'FABRICS';
              return 'READY_TO_WEAR';
            })(),
            productGroup: ((): FeaturedCard['productGroup'] => {
              const token = String((card as FeaturedCard)?.productGroup || '').trim().toUpperCase();
              return token === 'RTW' || token === 'CTW' || token === 'FTB' ? token : 'ALL';
            })(),
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
            ctaMode: normalizeCtaMode((card as DesignerSpotlightCard)?.ctaMode, fallbackSpotlight.ctaMode),
            ctaPageKey: ((): string => {
              const explicit = String((card as DesignerSpotlightCard)?.ctaPageKey || fallbackSpotlight.ctaPageKey || '').trim().toUpperCase();
              if (explicit) return explicit;
              return 'CUSTOM_TO_WEAR';
            })(),
            ctaLink:
              normalizeCtaMode((card as DesignerSpotlightCard)?.ctaMode, fallbackSpotlight.ctaMode) === 'PAGE'
                ? resolvePageHrefForKey(
                    (card as DesignerSpotlightCard)?.ctaPageKey,
                    (card as DesignerSpotlightCard)?.ctaLink || fallbackSpotlight.ctaLink
                  )
                : normalizeManagerHref((card as DesignerSpotlightCard)?.ctaLink, fallbackSpotlight.ctaLink),
            ctaStyle: normalizeCtaStyle((card as DesignerSpotlightCard)?.ctaStyle, fallbackSpotlight.ctaStyle),
          }))
        : DEFAULT_CONFIG.designerSpotlight.cards,
    },
    heritage: {
      ...DEFAULT_CONFIG.heritage,
      ...((data.heritage as Heritage | undefined) || {}),
      storyHtml: String((data.heritage as Heritage | undefined)?.storyHtml || DEFAULT_CONFIG.heritage.storyHtml),
      readMoreLabel: String((data.heritage as Heritage | undefined)?.readMoreLabel || DEFAULT_CONFIG.heritage.readMoreLabel),
      readMoreHref: normalizeManagerHref(
        (data.heritage as Heritage | undefined)?.readMoreHref,
        DEFAULT_CONFIG.heritage.readMoreHref
      ),
      statsPosition: ((): Heritage['statsPosition'] => {
        const token = String((data.heritage as Heritage | undefined)?.statsPosition || '').trim().toUpperCase();
        if (token === 'TOP' || token === 'MIDDLE' || token === 'BOTTOM') return token;
        return DEFAULT_CONFIG.heritage.statsPosition;
      })(),
    },
    customerReviews: {
      ...DEFAULT_CONFIG.customerReviews,
      ...(data.customerReviews || {}),
      titleFontSize: clamp(
        Math.round(
          toNumber(
            String((data.customerReviews as CustomerReviews | undefined)?.titleFontSize ?? DEFAULT_CONFIG.customerReviews.titleFontSize),
            DEFAULT_CONFIG.customerReviews.titleFontSize
          )
        ),
        14,
        120
      ),
      messageFontSize: clamp(
        Math.round(
          toNumber(
            String((data.customerReviews as CustomerReviews | undefined)?.messageFontSize ?? DEFAULT_CONFIG.customerReviews.messageFontSize),
            DEFAULT_CONFIG.customerReviews.messageFontSize
          )
        ),
        10,
        64
      ),
      metaFontSize: clamp(
        Math.round(
          toNumber(
            String((data.customerReviews as CustomerReviews | undefined)?.metaFontSize ?? DEFAULT_CONFIG.customerReviews.metaFontSize),
            DEFAULT_CONFIG.customerReviews.metaFontSize
          )
        ),
        8,
        40
      ),
      sourceMode: ((): CustomerReviews['sourceMode'] => {
        const token = String((data.customerReviews as CustomerReviews | undefined)?.sourceMode || '').trim().toUpperCase();
        if (token === 'STATIC_ONLY' || token === 'PRODUCT_REVIEWS_ONLY' || token === 'BOTH') return token;
        return DEFAULT_CONFIG.customerReviews.sourceMode;
      })(),
      maxItems: clamp(
        Math.round(
          toNumber(
            String((data.customerReviews as CustomerReviews | undefined)?.maxItems ?? DEFAULT_CONFIG.customerReviews.maxItems),
            DEFAULT_CONFIG.customerReviews.maxItems
          )
        ),
        1,
        24
      ),
      displayMode: ((): CustomerReviews['displayMode'] => {
        const token = String((data.customerReviews as CustomerReviews | undefined)?.displayMode || '').trim().toUpperCase();
        return token === 'GRID' ? 'GRID' : 'SLIDER';
      })(),
      autoplayEnabled: toBoolean(
        (data.customerReviews as CustomerReviews | undefined)?.autoplayEnabled,
        DEFAULT_CONFIG.customerReviews.autoplayEnabled
      ),
      autoplayIntervalMs: clamp(
        Math.round(
          toNumber(
            String(
              (data.customerReviews as CustomerReviews | undefined)?.autoplayIntervalMs ??
                DEFAULT_CONFIG.customerReviews.autoplayIntervalMs
            ),
            DEFAULT_CONFIG.customerReviews.autoplayIntervalMs
          )
        ),
        1000,
        30000
      ),
      pauseOnHover: toBoolean(
        (data.customerReviews as CustomerReviews | undefined)?.pauseOnHover,
        DEFAULT_CONFIG.customerReviews.pauseOnHover
      ),
      showNavigation: toBoolean(
        (data.customerReviews as CustomerReviews | undefined)?.showNavigation,
        DEFAULT_CONFIG.customerReviews.showNavigation
      ),
      showIndicators: toBoolean(
        (data.customerReviews as CustomerReviews | undefined)?.showIndicators,
        DEFAULT_CONFIG.customerReviews.showIndicators
      ),
      staticMessages: Array.isArray((data.customerReviews as CustomerReviews | undefined)?.staticMessages)
        ? ((data.customerReviews as CustomerReviews).staticMessages || []).map((item, index) => {
            const row = item as Partial<CustomerReviewStaticMessage>;
            return {
              id: String(row.id || uid()),
              customerName: String(row.customerName || `Customer ${index + 1}`),
              location: String(row.location || ''),
              message: String(row.message || ''),
              rating: clamp(Math.round(toNumber(String(row.rating ?? 5), 5)), 1, 5),
              enabled: toBoolean(row.enabled, true),
              displayOrder: clamp(Math.round(toNumber(String(row.displayOrder ?? index + 1), index + 1)), 1, 999),
            };
          })
        : DEFAULT_CONFIG.customerReviews.staticMessages,
    },
    newsletterFooter: {
      ...DEFAULT_CONFIG.newsletterFooter,
      ...(data.newsletterFooter || {}),
      footer: {
        ...DEFAULT_CONFIG.newsletterFooter.footer,
        ...((data.newsletterFooter as NewsletterFooter | undefined)?.footer || {}),
        logo: {
          ...DEFAULT_CONFIG.newsletterFooter.footer.logo,
          ...((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.logo || {}),
          mode:
            String((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.logo?.mode || 'TEXT')
              .trim()
              .toUpperCase() === 'IMAGE'
              ? 'IMAGE'
              : 'TEXT',
          fontWeight: clamp(
            Math.round(
              toNumber(
                String(
                  (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.logo?.fontWeight ??
                    DEFAULT_CONFIG.newsletterFooter.footer.logo.fontWeight
                ),
                DEFAULT_CONFIG.newsletterFooter.footer.logo.fontWeight
              )
            ),
            100,
            900
          ),
        },
        policyLinks: Array.isArray((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.policyLinks)
          ? ((data.newsletterFooter as NewsletterFooter).footer.policyLinks || []).map((entry) => normalizeLinkItemWithDefaults(entry))
          : DEFAULT_CONFIG.newsletterFooter.footer.policyLinks,
        socialLinks: Array.isArray((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.socialLinks)
          ? ((data.newsletterFooter as NewsletterFooter).footer.socialLinks || []).map((entry) => normalizeLinkItemWithDefaults(entry))
          : DEFAULT_CONFIG.newsletterFooter.footer.socialLinks,
        linkGroups: Array.isArray((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.linkGroups)
          ? ((data.newsletterFooter as NewsletterFooter).footer.linkGroups || []).map((group) => {
              const row = group as Partial<LinkGroup>;
              return {
                id: String(row.id || uid()),
                title: String(row.title || 'Shop'),
                links: Array.isArray(row.links) ? row.links.map((entry) => normalizeLinkItemWithDefaults(entry)) : [],
              };
            })
          : DEFAULT_CONFIG.newsletterFooter.footer.linkGroups,
        map: {
          ...DEFAULT_CONFIG.newsletterFooter.footer.map,
          ...((data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map || {}),
          enabled: toBoolean(
            (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map?.enabled,
            DEFAULT_CONFIG.newsletterFooter.footer.map.enabled
          ),
          image: String(
            (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map?.image ||
              DEFAULT_CONFIG.newsletterFooter.footer.map.image
          ),
          overlayColor: String(
            (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map?.overlayColor ||
              DEFAULT_CONFIG.newsletterFooter.footer.map.overlayColor
          ),
          overlayOpacity: clamp(
            Math.round(
              toNumber(
                String(
                  (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map?.overlayOpacity ??
                    DEFAULT_CONFIG.newsletterFooter.footer.map.overlayOpacity
                ),
                DEFAULT_CONFIG.newsletterFooter.footer.map.overlayOpacity
              )
            ),
            0,
            100
          ),
          minHeight: clamp(
            Math.round(
              toNumber(
                String(
                  (data.newsletterFooter as NewsletterFooter | undefined)?.footer?.map?.minHeight ??
                    DEFAULT_CONFIG.newsletterFooter.footer.map.minHeight
                ),
                DEFAULT_CONFIG.newsletterFooter.footer.map.minHeight
              )
            ),
            80,
            900
          ),
        },
      },
    },
  };
};

export default function JenksV2FrontPageManager() {
  const navigate = useNavigate();
  const { submenu } = useParams<{ submenu?: string }>();
  const [config, setConfig] = useState<JenksV2FrontpageConfig>(DEFAULT_CONFIG);

  const renderShopByCountryManager = (
    countryConfig: ShopByCountrySection,
    setCountryConfig: (updater: (prev: ShopByCountrySection) => ShopByCountrySection) => void
  ) => (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <label className="text-xs">
          Section Tag
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={countryConfig.sectionTag}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                sectionTag: event.target.value,
              }))
            }
          />
        </label>
        <label className="text-xs md:col-span-2">
          Section Title
          <input
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={countryConfig.sectionTitle}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                sectionTitle: event.target.value,
              }))
            }
          />
        </label>
        <label className="flex items-center gap-2 text-xs pt-5">
          <input
            type="checkbox"
            checked={countryConfig.sectionDescriptionEnabled}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                sectionDescriptionEnabled: event.target.checked,
              }))
            }
          />
          Description Enabled
        </label>
        <label className="text-xs md:col-span-3">
          Section Description
          <textarea
            rows={2}
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={countryConfig.sectionDescription}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                sectionDescription: event.target.value,
              }))
            }
          />
        </label>
        <label className="text-xs">
          Countries Count Mode
          <select
            className="mt-1 w-full rounded border px-2 py-1.5"
            value={countryConfig.countriesCountMode}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                countriesCountMode: event.target.value as CountMode,
              }))
            }
          >
            <option value="STATIC">STATIC</option>
            <option value="DATABASE">DATABASE</option>
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Shop By Country Manager</h3>
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            setCountryConfig((prev) => ({
              ...prev,
              countries: [
                ...prev.countries,
                {
                  id: uid(),
                  code: 'DZ',
                  name: 'Algeria',
                  icon: flagEmoji('DZ'),
                  productCountMode: 'STATIC',
                  staticProductCount: 0,
                  enabled: true,
                  displayOrder: prev.countries.length + 1,
                },
              ],
            }))
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Country
        </Button>
      </div>
      {countryConfig.countries.map((country, index) => (
        <div key={country.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
          <label className="md:col-span-4 text-[11px]">
            Country (select)
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              value={country.code}
              onChange={(event) =>
                setCountryConfig((prev) => ({
                  ...prev,
                  countries: prev.countries.map((entry, entryIndex) => {
                    if (entryIndex !== index) return entry;
                    const selected = COUNTRY_BY_CODE.get(event.target.value);
                    return {
                      ...entry,
                      code: event.target.value,
                      name: selected?.name || entry.name,
                      icon: selected ? flagEmoji(selected.code) : entry.icon,
                    };
                  }),
                }))
              }
            >
              {AFRICAN_COUNTRIES_54.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.name} ({entry.code})
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-2 text-[11px]">
            Code
            <select
              className="mt-1 w-full rounded border px-2 py-1 text-xs"
              value={country.code}
              onChange={(event) =>
                setCountryConfig((prev) => ({
                  ...prev,
                  countries: prev.countries.map((entry, entryIndex) => {
                    if (entryIndex !== index) return entry;
                    const selected = COUNTRY_BY_CODE.get(event.target.value);
                    return {
                      ...entry,
                      code: event.target.value,
                      name: selected?.name || entry.name,
                      icon: selected ? flagEmoji(selected.code) : entry.icon,
                    };
                  }),
                }))
              }
            >
              {AFRICAN_COUNTRIES_54.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.code}
                </option>
              ))}
            </select>
          </label>
          <label className="md:col-span-1 text-[11px]">
            Flag
            <input className="mt-1 w-full rounded border px-2 py-1 text-xs" value={country.icon} readOnly />
          </label>
          <select
            className="md:col-span-2 mt-4 rounded border px-2 py-1 text-xs md:mt-0"
            value={country.productCountMode}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                countries: prev.countries.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, productCountMode: event.target.value as ShopByCountry['productCountMode'] } : entry
                ),
              }))
            }
          >
            <option value="STATIC">STATIC</option>
            <option value="DATABASE_FTB">DATABASE_FTB</option>
          </select>
          <input
            type="number"
            className="md:col-span-1 rounded border px-2 py-1 text-xs"
            aria-label="Static Product Count"
            value={country.staticProductCount}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                countries: prev.countries.map((entry, entryIndex) =>
                  entryIndex === index
                    ? { ...entry, staticProductCount: clamp(toNumber(event.target.value, 0), 0, 999999) }
                    : entry
                ),
              }))
            }
          />
          <input
            type="number"
            className="md:col-span-1 rounded border px-2 py-1 text-xs"
            aria-label="Display Order"
            value={country.displayOrder}
            onChange={(event) =>
              setCountryConfig((prev) => ({
                ...prev,
                countries: prev.countries.map((entry, entryIndex) =>
                  entryIndex === index ? { ...entry, displayOrder: clamp(toNumber(event.target.value, 1), 1, 999) } : entry
                ),
              }))
            }
          />
          <div className="md:col-span-1 flex items-center gap-2 justify-end">
            <input
              type="checkbox"
              checked={country.enabled}
              onChange={(event) =>
                setCountryConfig((prev) => ({
                  ...prev,
                  countries: prev.countries.map((entry, entryIndex) =>
                    entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                  ),
                }))
              }
            />
            <button
              type="button"
              className="rounded border p-1"
              onClick={() =>
                setCountryConfig((prev) => ({
                  ...prev,
                  countries: prev.countries.filter((_, entryIndex) => entryIndex !== index),
                }))
              }
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [blogRouteOptions, setBlogRouteOptions] = useState<RouteOption[]>([]);

  const logoUploadRef = useRef<HTMLInputElement | null>(null);
  const footerLogoUploadRef = useRef<HTMLInputElement | null>(null);
  const footerMapUploadRef = useRef<HTMLInputElement | null>(null);
  const heroUploadRef = useRef<HTMLInputElement | null>(null);
  const heroRightPanelUploadRef = useRef<HTMLInputElement | null>(null);
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

  const routeOptions = useMemo(() => {
    if (blogRouteOptions.length === 0) return ROUTE_OPTIONS;
    const seen = new Set<string>(ROUTE_OPTIONS.map((entry) => entry.href));
    const merged = [...ROUTE_OPTIONS];
    for (const route of blogRouteOptions) {
      if (!seen.has(route.href)) {
        merged.push(route);
        seen.add(route.href);
      }
    }
    return merged;
  }, [blogRouteOptions]);

  const pageRouteOptions = useMemo(() => routeOptions.filter((route) => route.key !== 'SHOP'), [routeOptions]);

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.jenksV2Frontpage.getConfig();
      if (!response.success || !response.data) throw new Error('Failed to load Jenks-V2 frontpage manager config.');
      const nextConfig = sanitizeConfigHrefs(asApiConfig(response.data));
      setConfig({
        ...nextConfig,
        sectionVisibility: ensureCompleteSectionVisibility(nextConfig.sectionVisibility),
      });
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load Jenks-V2 frontpage manager config.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBlogRouteOptions = async () => {
    try {
      const response = await api.blogs.getAdminOptions();
      if (response.success) {
        setBlogRouteOptions(toBlogRouteOptions(response.data));
        return;
      }
    } catch {
      // Blog options are auxiliary; keep manager usable if this request fails.
    }
    setBlogRouteOptions([]);
  };

  useEffect(() => {
    void fetchConfig();
    void fetchBlogRouteOptions();
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
  const resolvePreviewUrl = (value: unknown) => resolveAssetUrl(value);

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

  const handleFooterLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    triggerUpload('footer-logo');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        newsletterFooter: {
          ...prev.newsletterFooter,
          footer: {
            ...prev.newsletterFooter.footer,
            logo: { ...prev.newsletterFooter.footer.logo, mode: 'IMAGE', imageUrl: url },
          },
        },
      }));
      setSuccess('Footer logo image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload footer logo image.');
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

  const handleHeroRightPanelUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || heroUploadIndex === null) return;
    triggerUpload('hero-right-panel');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        topNavigations: {
          ...prev.topNavigations,
          heroBanners: prev.topNavigations.heroBanners.map((banner, index) =>
            index === heroUploadIndex
              ? {
                  ...banner,
                  rightPanelBackgroundMode: 'IMAGE',
                  rightPanelBackgroundImage: url,
                }
              : banner
          ),
        },
      }));
      setSuccess('Hero right panel image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload hero right panel image.');
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

  const handleFooterMapUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    triggerUpload('footer-map');
    try {
      const url = await uploadImage(file);
      setConfig((prev) => ({
        ...prev,
        newsletterFooter: {
          ...prev.newsletterFooter,
          footer: {
            ...prev.newsletterFooter.footer,
            map: { ...prev.newsletterFooter.footer.map, image: url },
          },
        },
      }));
      setSuccess('Footer map image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload footer map image.');
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
      {
        const nextConfig = sanitizeConfigHrefs(asApiConfig(response.data));
        setConfig({
          ...nextConfig,
          sectionVisibility: ensureCompleteSectionVisibility(nextConfig.sectionVisibility),
        });
      }
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
      {
        const nextConfig = sanitizeConfigHrefs(asApiConfig(response.data));
        setConfig({
          ...nextConfig,
          sectionVisibility: ensureCompleteSectionVisibility(nextConfig.sectionVisibility),
        });
      }
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
            <h3 className="text-sm font-semibold">Top Strip Manager</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="text-xs md:col-span-2">
                Messages (one per line)
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.topStripConfig.messages.join('\n')}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: {
                          ...prev.topNavigations.topStripConfig,
                          messages: event.target.value.split('\n').slice(0, 20),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Separator
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.topStripConfig.separator}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: { ...prev.topNavigations.topStripConfig, separator: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Repeat Count
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.topStripConfig.repeatCount}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: {
                          ...prev.topNavigations.topStripConfig,
                          repeatCount: clamp(toNumber(event.target.value, prev.topNavigations.topStripConfig.repeatCount), 1, 20),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Animation Seconds
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.topNavigations.topStripConfig.animationSeconds}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: {
                          ...prev.topNavigations.topStripConfig,
                          animationSeconds: clamp(
                            toNumber(event.target.value, prev.topNavigations.topStripConfig.animationSeconds),
                            6,
                            240
                          ),
                        },
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
                  value={config.topNavigations.topStripConfig.fontSize}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: {
                          ...prev.topNavigations.topStripConfig,
                          fontSize: clamp(toNumber(event.target.value, prev.topNavigations.topStripConfig.fontSize), 8, 40),
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Text Color
                <input
                  type="color"
                  className="mt-1 h-9 w-full rounded border px-1 py-1"
                  value={config.topNavigations.topStripConfig.textColor}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: { ...prev.topNavigations.topStripConfig, textColor: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs">
                Background Color
                <input
                  type="color"
                  className="mt-1 h-9 w-full rounded border px-1 py-1"
                  value={config.topNavigations.topStripConfig.backgroundColor}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: { ...prev.topNavigations.topStripConfig, backgroundColor: event.target.value },
                      },
                    }))
                  }
                />
              </label>
              <label className="flex items-center gap-2 text-xs pt-5">
                <input
                  type="checkbox"
                  checked={config.topNavigations.topStripConfig.isBold}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: { ...prev.topNavigations.topStripConfig, isBold: event.target.checked },
                      },
                    }))
                  }
                />
                Bold Text
              </label>
              <label className="flex items-center gap-2 text-xs pt-5">
                <input
                  type="checkbox"
                  checked={config.topNavigations.topStripConfig.pauseOnHover}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        topStripConfig: { ...prev.topNavigations.topStripConfig, pauseOnHover: event.target.checked },
                      },
                    }))
                  }
                />
                Pause On Hover
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs">
              Hamburger Font Size (px)
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.topNavigations.hamburgerMenuFontSize}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: {
                      ...prev.topNavigations,
                      hamburgerMenuFontSize: clamp(
                        toNumber(event.target.value, prev.topNavigations.hamburgerMenuFontSize),
                        16,
                        72
                      ),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Hamburger Font Weight
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.topNavigations.hamburgerMenuFontWeight}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: {
                      ...prev.topNavigations,
                      hamburgerMenuFontWeight: clamp(
                        toNumber(event.target.value, prev.topNavigations.hamburgerMenuFontWeight),
                        100,
                        900
                      ),
                    },
                  }))
                }
              />
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
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    topNavigations: {
                      ...prev.topNavigations,
                      logo: { ...prev.topNavigations.logo, imageUrl: '' },
                    },
                  }))
                }
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Logo Image
              </Button>
              <input ref={logoUploadRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <span className="text-xs text-gray-600 break-all">{config.topNavigations.logo.imageUrl || 'No logo image uploaded'}</span>
            </div>
            <div className="rounded-md border bg-white p-2">
              {config.topNavigations.logo.imageUrl ? (
                <img
                  src={resolvePreviewUrl(config.topNavigations.logo.imageUrl)}
                  alt="Logo preview"
                  className="h-20 w-full rounded object-contain bg-gray-50"
                  onError={(event) => {
                    event.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="flex h-20 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                  No logo image uploaded
                </div>
              )}
            </div>
          </div>

            <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="text-sm font-semibold">Hamburger Menu</h3>
              <div className="flex gap-2">
                <select
                  className="w-full rounded border px-2 py-1.5 text-sm"
                  value={addingMenuRouteKey}
                  onChange={(event) => setAddingMenuRouteKey(event.target.value)}
                >
                  {routeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label} ({option.href})
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => {
                    const route = routeOptions.find((item) => item.key === addingMenuRouteKey);
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
                <div key={item.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                  <label className="md:col-span-3 text-[11px]">
                    Label
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                  </label>
                  <label className="md:col-span-5 text-[11px]">
                    Route
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                    >
                      {routeOptions.map((route) => (
                        <option key={`${route.key}-${route.href}`} value={route.href}>
                          {route.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="md:col-span-2 text-[11px]">
                    Route Key
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                    >
                      <option value="">(None)</option>
                      {routeOptions.map((route) => (
                        <option key={route.key} value={route.key}>
                          {route.key}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-2 flex items-end justify-end gap-1">
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
                  <div key={item.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                    <label className="md:col-span-3 text-[11px]">
                      Label
                      <input
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                    </label>
                    <label className="md:col-span-6 text-[11px]">
                      Route
                      <select
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                      >
                        {routeOptions.map((route) => (
                          <option key={`top-${route.key}`} value={route.href}>
                            {route.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="md:col-span-3 flex items-end justify-end gap-1">
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
                  Sign In Route
                  <select
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
                  >
                    {routeOptions.map((route) => (
                      <option key={`signin-${route.key}`} value={route.href}>
                        {route.label}
                      </option>
                    ))}
                  </select>
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
                          layoutMode: 'SPLIT',
                          rightPanelBackgroundMode: 'NONE',
                          rightPanelBackgroundImage: '',
                          textVerticalAlign: 'MIDDLE',
                          leftWidthPercent: 58,
                          rightWidthPercent: 42,
                          tag: '',
                          title: 'New Hero Banner',
                          titleFontSize: 56,
                          text: '',
                          textEnabled: true,
                          description: '',
                          descriptionEnabled: true,
                          descriptionFontSize: 16,
                          primaryCtaEnabled: true,
                          primaryCtaText: 'SHOP NOW',
                          primaryCtaLink: '/readytowear',
                          primaryCtaStyle: createCtaStyle({
                            backgroundColor: '#e66045',
                            textColor: '#ffffff',
                            borderColor: '#e66045',
                            borderWidth: 0,
                            fontSize: 12,
                          }),
                          secondaryCtaEnabled: true,
                          secondaryCtaText: 'EXPLORE',
                          secondaryCtaLink: '/cystomtowear',
                          secondaryCtaStyle: createCtaStyle({
                            backgroundColor: 'transparent',
                            textColor: '#111111',
                            borderColor: '#111111',
                            borderWidth: 1,
                            fontSize: 12,
                          }),
                          tertiaryCtaEnabled: true,
                          tertiaryCtaText: 'SHOP FABRICS',
                          tertiaryCtaLink: '/fabricstobuy',
                          tertiaryCtaStyle: createCtaStyle({
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
                  <label className="text-xs flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={banner.textEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, textEnabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Text Enabled
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
                  <label className="text-xs flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={banner.descriptionEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, descriptionEnabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Description Enabled
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
                    Layout Mode
                    <select
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.layoutMode || 'SPLIT'}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    layoutMode: event.target.value === 'FULL' ? 'FULL' : 'SPLIT',
                                    rightPanelBackgroundMode:
                                      event.target.value === 'FULL' ? 'NONE' : entry.rightPanelBackgroundMode,
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    >
                      <option value="SPLIT">Split (Image + Side Panel)</option>
                      <option value="FULL">Full Banner Image</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Right Panel Background
                    <select
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.rightPanelBackgroundMode}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    rightPanelBackgroundMode: event.target.value === 'IMAGE' ? 'IMAGE' : 'NONE',
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    >
                      <option value="NONE">NONE</option>
                      <option value="IMAGE">IMAGE</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Text Position
                    <select
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.textVerticalAlign}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    textVerticalAlign:
                                      event.target.value === 'TOP' || event.target.value === 'BOTTOM'
                                        ? (event.target.value as HeroBanner['textVerticalAlign'])
                                        : 'MIDDLE',
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    >
                      <option value="TOP">TOP</option>
                      <option value="MIDDLE">MIDDLE</option>
                      <option value="BOTTOM">BOTTOM</option>
                    </select>
                  </label>
                  <label className="text-xs">
                    Left Width %
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.leftWidthPercent}
                      onChange={(event) =>
                        setConfig((prev) => {
                          const nextLeft = clamp(toNumber(event.target.value, banner.leftWidthPercent), 20, 80);
                          const nextRight = 100 - nextLeft;
                          return {
                            ...prev,
                            topNavigations: {
                              ...prev.topNavigations,
                              heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      leftWidthPercent: nextLeft,
                                      rightWidthPercent: nextRight,
                                    }
                                  : entry
                              ),
                            },
                          };
                        })
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Right Width %
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.rightWidthPercent}
                      onChange={(event) =>
                        setConfig((prev) => {
                          const nextRight = clamp(toNumber(event.target.value, banner.rightWidthPercent), 20, 80);
                          const nextLeft = 100 - nextRight;
                          return {
                            ...prev,
                            topNavigations: {
                              ...prev.topNavigations,
                              heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? {
                                      ...entry,
                                      leftWidthPercent: nextLeft,
                                      rightWidthPercent: nextRight,
                                    }
                                  : entry
                              ),
                            },
                          };
                        })
                      }
                    />
                  </label>
                  <label className="text-xs md:col-span-2">
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
                  <label className="text-xs md:col-span-2">
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
                  <label className="text-xs">
                    Tertiary CTA Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.tertiaryCtaText}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, tertiaryCtaText: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Tertiary CTA Link
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={banner.tertiaryCtaLink}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, tertiaryCtaLink: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      checked={banner.tertiaryCtaEnabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          topNavigations: {
                            ...prev.topNavigations,
                            heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, tertiaryCtaEnabled: event.target.checked } : entry
                            ),
                          },
                        }))
                      }
                    />
                    Tertiary CTA Enabled
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
                  'Tertiary CTA Style',
                  banner.tertiaryCtaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      topNavigations: {
                        ...prev.topNavigations,
                        heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, tertiaryCtaStyle: nextStyle } : entry
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, image: '' } : entry
                          ),
                        },
                      }))
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Banner Image
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={uploadingTarget === 'hero-right-panel'}
                    onClick={() => {
                      setHeroUploadIndex(index);
                      heroRightPanelUploadRef.current?.click();
                    }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Right Panel Image
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        topNavigations: {
                          ...prev.topNavigations,
                          heroBanners: prev.topNavigations.heroBanners.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, rightPanelBackgroundImage: '', rightPanelBackgroundMode: 'NONE' }
                              : entry
                          ),
                        },
                      }))
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Right Panel Image
                  </Button>
                  <span className="text-xs text-gray-600 break-all">{banner.image || 'No hero image uploaded'}</span>
                </div>
                <div className="rounded-md border bg-white p-2">
                  {banner.image ? (
                    <img
                      src={resolvePreviewUrl(banner.image)}
                      alt={`Hero banner preview ${index + 1}`}
                      className="h-28 w-full rounded object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                      No hero image uploaded
                    </div>
                  )}
                </div>
                <div className="rounded-md border bg-white p-2">
                  {banner.rightPanelBackgroundImage ? (
                    <img
                      src={resolvePreviewUrl(banner.rightPanelBackgroundImage)}
                      alt={`Hero right panel preview ${index + 1}`}
                      className="h-24 w-full rounded object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                      No right panel image uploaded
                    </div>
                  )}
                </div>
              </div>
            ))}
            <input ref={heroUploadRef} type="file" accept="image/*" className="hidden" onChange={handleHeroUpload} />
            <input
              ref={heroRightPanelUploadRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleHeroRightPanelUpload}
            />
          </div>
        </section>
      ) : null}

      {activeTab === 'shopBy' ? (
        <section className="rounded-lg border bg-white p-5 space-y-6">
          <h2 className="text-xl font-semibold">Shop By</h2>
          <p className="text-sm text-gray-600">Configure Shop By Category, Style and Price cards.</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-xs">
              Section Tag
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.sectionTag}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, sectionTag: event.target.value },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-2">
              Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.sectionTitle}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, sectionTitle: event.target.value },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={config.shopBy.sectionDescriptionEnabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, sectionDescriptionEnabled: event.target.checked },
                  }))
                }
              />
              Description Enabled
            </label>
            <label className="text-xs md:col-span-4">
              Section Description
              <textarea
                rows={2}
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopBy.sectionDescription}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopBy: { ...prev.shopBy, sectionDescription: event.target.value },
                  }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                <option value="STYLE">STYLE</option>
                <option value="PRICE">PRICE</option>
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
                {(['CATEGORY', 'STYLE', 'PRICE'] as const).map((tab) => (
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
                          key: 'RTW',
                          title: 'New Category',
                          description: '',
                          image: '',
                          icon: 'ShoppingBag',
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
                  <label className="md:col-span-1 text-[11px]">
                    Key
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={category.key}
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
                    >
                      {CATEGORY_SECTION_KEY_OPTIONS.map((option) => (
                        <option key={`shopby-category-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
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
                  <label className="md:col-span-1 text-[11px]">
                    Icon
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={category.icon}
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
                    >
                      {ICON_OPTIONS.map((iconKey) => (
                        <option key={`shopby-category-icon-${iconKey}`} value={iconKey}>
                          {iconKey}
                        </option>
                      ))}
                    </select>
                  </label>
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            categories: prev.shopBy.categories.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, image: '' } : entry
                            ),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
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
                <div className="rounded-md border bg-white p-2">
                  {category.image ? (
                    <img
                      src={resolvePreviewUrl(category.image)}
                      alt={`Category image preview ${index + 1}`}
                      className="h-24 w-full rounded object-cover"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                      No category image uploaded
                    </div>
                  )}
                </div>
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

          <div className="space-y-4">
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
                            href: '/readytowear',
                            icon: 'CalendarDays',
                            titleFontSize: 15,
                            descriptionFontSize: 14,
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
              <div key={card.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                <label className="md:col-span-2 text-[11px]">
                  Title
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                </label>
                <label className="md:col-span-3 text-[11px]">
                  Description
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Route (dropdown)
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                  >
                    {routeOptions.map((route) => (
                      <option key={`${route.key}-${route.href}`} value={route.href}>
                        {route.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Icon (dropdown)
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={card.icon}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopBy: {
                          ...prev.shopBy,
                          styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, icon: event.target.value } : entry
                          ),
                        },
                      }))
                    }
                  >
                    {ICON_OPTIONS.map((iconKey) => (
                      <option key={iconKey} value={iconKey}>
                        {iconKey}
                      </option>
                    ))}
                  </select>
                </label>
                  <label className="md:col-span-1 text-[11px]">
                    Title Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.titleFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, titleFontSize: clamp(toNumber(event.target.value, entry.titleFontSize), 10, 72) }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Description Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.descriptionFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            styleCards: prev.shopBy.styleCards.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, descriptionFontSize: clamp(toNumber(event.target.value, entry.descriptionFontSize), 10, 72) }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="md:col-span-1 flex items-end justify-end gap-1">
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
                            href: '/readytowear',
                            icon: 'Tag',
                            titleFontSize: 24,
                            descriptionFontSize: 14,
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
                <div key={card.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                  <label className="md:col-span-2 text-[11px]">
                    Title
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                  </label>
                  <label className="md:col-span-2 text-[11px]">
                    Price Label
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                  </label>
                  <label className="md:col-span-2 text-[11px]">
                    Description
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                  </label>
                  <label className="md:col-span-2 text-[11px]">
                    Route (dropdown)
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
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
                    >
                      {routeOptions.map((route) => (
                        <option key={`${route.key}-${route.href}`} value={route.href}>
                          {route.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Icon (dropdown)
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.icon}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, icon: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    >
                      {ICON_OPTIONS.map((iconKey) => (
                        <option key={iconKey} value={iconKey}>
                          {iconKey}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Title Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.titleFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, titleFontSize: clamp(toNumber(event.target.value, entry.titleFontSize), 10, 72) }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Description Font Size
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.descriptionFontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          shopBy: {
                            ...prev.shopBy,
                            priceCards: prev.shopBy.priceCards.map((entry, entryIndex) =>
                              entryIndex === index
                                ? {
                                    ...entry,
                                    descriptionFontSize: clamp(
                                      toNumber(event.target.value, entry.descriptionFontSize),
                                      10,
                                      72
                                    ),
                                  }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="md:col-span-2 flex items-end justify-end gap-1">
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

      

      {activeTab === 'shopByCountry' ? (
        <section className="rounded-lg border bg-white p-5 space-y-6">
          <h2 className="text-xl font-semibold">Shop By Country</h2>
          <p className="text-sm text-gray-600">Configure standalone Shop By Country section and country list.</p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="text-xs">
              Section Tag
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopByCountry.sectionTag}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopByCountry: { ...prev.shopByCountry, sectionTag: event.target.value },
                  }))
                }
              />
            </label>
            <label className="text-xs md:col-span-2">
              Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopByCountry.sectionTitle}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopByCountry: { ...prev.shopByCountry, sectionTitle: event.target.value },
                  }))
                }
              />
            </label>
            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={config.shopByCountry.sectionDescriptionEnabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopByCountry: { ...prev.shopByCountry, sectionDescriptionEnabled: event.target.checked },
                  }))
                }
              />
              Description Enabled
            </label>
            <label className="text-xs md:col-span-4">
              Section Description
              <textarea
                rows={2}
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopByCountry.sectionDescription}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopByCountry: { ...prev.shopByCountry, sectionDescription: event.target.value },
                  }))
                }
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="text-xs">
              Countries Count Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.shopByCountry.countriesCountMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    shopByCountry: { ...prev.shopByCountry, countriesCountMode: event.target.value as CountMode },
                  }))
                }
              >
                <option value="STATIC">STATIC</option>
                <option value="DATABASE">DATABASE</option>
              </select>
            </label>
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
                    shopByCountry: {
                      ...prev.shopByCountry,
                      countries: [
                        ...prev.shopByCountry.countries,
                        {
                          id: uid(),
                          code: 'DZ',
                          name: 'Algeria',
                          icon: flagEmoji('DZ'),
                          productCountMode: 'STATIC',
                          staticProductCount: 0,
                          enabled: true,
                          displayOrder: prev.shopByCountry.countries.length + 1,
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
            {config.shopByCountry.countries.map((country, index) => (
              <div key={country.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                <label className="md:col-span-4 text-[11px]">
                  Country (select)
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={country.code}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopByCountry: {
                          ...prev.shopByCountry,
                          countries: prev.shopByCountry.countries.map((entry, entryIndex) => {
                            if (entryIndex !== index) return entry;
                            const selected = COUNTRY_BY_CODE.get(event.target.value);
                            return {
                              ...entry,
                              code: event.target.value,
                              name: selected?.name || entry.name,
                              icon: selected ? flagEmoji(selected.code) : entry.icon,
                            };
                          }),
                        },
                      }))
                    }
                  >
                    {AFRICAN_COUNTRIES_54.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.name} ({entry.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Code
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={country.code}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        shopByCountry: {
                          ...prev.shopByCountry,
                          countries: prev.shopByCountry.countries.map((entry, entryIndex) => {
                            if (entryIndex !== index) return entry;
                            const selected = COUNTRY_BY_CODE.get(event.target.value);
                            return {
                              ...entry,
                              code: event.target.value,
                              name: selected?.name || entry.name,
                              icon: selected ? flagEmoji(selected.code) : entry.icon,
                            };
                          }),
                        },
                      }))
                    }
                  >
                    {AFRICAN_COUNTRIES_54.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-1 text-[11px]">
                  Flag
                  <input className="mt-1 w-full rounded border px-2 py-1 text-xs" value={country.icon} readOnly />
                </label>
                <select
                  className="md:col-span-2 mt-4 rounded border px-2 py-1 text-xs md:mt-0"
                  value={country.productCountMode}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopByCountry: {
                        ...prev.shopByCountry,
                        countries: prev.shopByCountry.countries.map((entry, entryIndex) =>
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
                  className="md:col-span-1 rounded border px-2 py-1 text-xs"
                  aria-label="Static Product Count"
                  value={country.staticProductCount}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopByCountry: {
                        ...prev.shopByCountry,
                        countries: prev.shopByCountry.countries.map((entry, entryIndex) =>
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
                  aria-label="Display Order"
                  value={country.displayOrder}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      shopByCountry: {
                        ...prev.shopByCountry,
                        countries: prev.shopByCountry.countries.map((entry, entryIndex) =>
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
                        shopByCountry: {
                          ...prev.shopByCountry,
                          countries: prev.shopByCountry.countries.map((entry, entryIndex) =>
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
                        shopByCountry: {
                          ...prev.shopByCountry,
                          countries: prev.shopByCountry.countries.filter((_, entryIndex) => entryIndex !== index),
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
                        ctaLink: '/readytowear',
                        ctaMode: 'PAGE',
                        ctaPageKey: 'READY_TO_WEAR',
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
              <label className="md:col-span-1 text-[11px]">
                Section Key
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.key}
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
                >
                  {CATEGORY_SECTION_KEY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="md:col-span-2 text-[11px]">
                Title
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.title}
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
              </label>
              <label className="md:col-span-1 text-[11px]">
                Tag
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.tag}
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
              </label>
              <label className="md:col-span-3 text-[11px]">
                Description
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.description}
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
              </label>
              <label className="md:col-span-2 text-[11px]">
                CTA Text
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.ctaText}
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
              </label>
              <label className="md:col-span-2 text-[11px]">
                CTA Route Type
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={section.ctaMode || 'PAGE'}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      categoryManage: {
                        sections: prev.categoryManage.sections.map((entry, entryIndex) => {
                          if (entryIndex !== index) return entry;
                          const nextMode: 'URL' | 'PAGE' = event.target.value === 'URL' ? 'URL' : 'PAGE';
                          if (nextMode === 'PAGE') {
                            const fallbackRoute =
                              pageRouteOptions.find((route) => route.key === (entry.ctaPageKey || 'READY_TO_WEAR')) ||
                              pageRouteOptions.find((route) => route.key === 'READY_TO_WEAR') ||
                              pageRouteOptions[0];
                            return {
                              ...entry,
                              ctaMode: 'PAGE',
                              ctaPageKey: fallbackRoute?.key || 'READY_TO_WEAR',
                              ctaLink: fallbackRoute?.href || '/readytowear',
                            };
                          }
                          return {
                            ...entry,
                            ctaMode: 'URL',
                            ctaPageKey: '',
                          };
                        }),
                      },
                    }))
                  }
                >
                  <option value="PAGE">Pages dropdown</option>
                  <option value="URL">Custom URL</option>
                </select>
              </label>
              <label className="md:col-span-2 text-[11px]">
                {(section.ctaMode || 'PAGE') === 'PAGE' ? 'CTA Page' : 'CTA URL'}
                {(section.ctaMode || 'PAGE') === 'PAGE' ? (
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={section.ctaPageKey || ''}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        categoryManage: {
                          sections: prev.categoryManage.sections.map((entry, entryIndex) => {
                            if (entryIndex !== index) return entry;
                            const selected = pageRouteOptions.find((route) => route.key === event.target.value);
                            return {
                              ...entry,
                              ctaMode: 'PAGE',
                              ctaPageKey: event.target.value,
                              ctaLink: selected?.href || entry.ctaLink,
                            };
                          }),
                        },
                      }))
                    }
                  >
                    {pageRouteOptions.map((route) => (
                      <option key={`cat-section-page-${route.key}`} value={route.key}>
                        {route.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={section.ctaLink}
                    placeholder="/readytowear or https://..."
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        categoryManage: {
                          sections: prev.categoryManage.sections.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, ctaMode: 'URL', ctaPageKey: '', ctaLink: event.target.value }
                              : entry
                          ),
                        },
                      }))
                    }
                  />
                )}
              </label>
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
          <div className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-3">
            <label className="text-[11px]">
              How It Works Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                value={config.textIconCards.sectionTitles.howItWorks}
                placeholder="How It Works"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      sectionTitles: {
                        ...prev.textIconCards.sectionTitles,
                        howItWorks: event.target.value,
                      },
                    },
                  }))
                }
              />
            </label>
            <label className="text-[11px]">
              Custom Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                value={config.textIconCards.sectionTitles.custom}
                placeholder="Custom"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      sectionTitles: {
                        ...prev.textIconCards.sectionTitles,
                        custom: event.target.value,
                      },
                    },
                  }))
                }
              />
            </label>
            <label className="text-[11px]">
              Shop With Confidence Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1 text-xs"
                value={config.textIconCards.sectionTitles.shopWithConfidence}
                placeholder="Shop With Confidence"
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    textIconCards: {
                      ...prev.textIconCards,
                      sectionTitles: {
                        ...prev.textIconCards.sectionTitles,
                        shopWithConfidence: event.target.value,
                      },
                    },
                  }))
                }
              />
            </label>
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Per-Section Heading & Description Controls</h3>
            {(
              [
                { key: 'howItWorks', label: 'How It Works' },
                { key: 'custom', label: 'Custom' },
                { key: 'shopWithConfidence', label: 'Shop With Confidence' },
              ] as const
            ).map((section) => (
              <div key={`text-icon-heading-${section.key}`} className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-12">
                <p className="text-xs font-semibold md:col-span-12">{section.label}</p>
                <label className="md:col-span-3 flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={toBoolean(config.textIconCards.sectionHeadings?.[section.key]?.titleEnabled, true)}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              titleEnabled: event.target.checked,
                            },
                          },
                        },
                      }))
                    }
                  />
                  Show Section Title
                </label>
                <label className="md:col-span-3 text-[11px]">
                  Title Position
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionHeadings?.[section.key]?.titlePosition || 'LEFT'}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              titlePosition:
                                event.target.value === 'CENTER' || event.target.value === 'RIGHT'
                                  ? (event.target.value as 'LEFT' | 'CENTER' | 'RIGHT')
                                  : 'LEFT',
                            },
                          },
                        },
                      }))
                    }
                  >
                    <option value="LEFT">Left</option>
                    <option value="CENTER">Center</option>
                    <option value="RIGHT">Right</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Title Font Size (px)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionHeadings?.[section.key]?.titleFontSize ?? 36}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              titleFontSize: clamp(
                                toNumber(event.target.value, prev.textIconCards.sectionHeadings[section.key]?.titleFontSize || 36),
                                10,
                                120
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="md:col-span-2 flex items-center gap-2 text-[11px]">
                  <input
                    type="checkbox"
                    checked={toBoolean(config.textIconCards.sectionHeadings?.[section.key]?.descriptionEnabled, true)}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              descriptionEnabled: event.target.checked,
                            },
                          },
                        },
                      }))
                    }
                  />
                  Show Description
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Description Font Size (px)
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionHeadings?.[section.key]?.descriptionFontSize ?? 14}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              descriptionFontSize: clamp(
                                toNumber(
                                  event.target.value,
                                  prev.textIconCards.sectionHeadings[section.key]?.descriptionFontSize || 14
                                ),
                                8,
                                72
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="md:col-span-10 text-[11px]">
                  Section Description
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionHeadings?.[section.key]?.description || ''}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionHeadings: {
                            ...prev.textIconCards.sectionHeadings,
                            [section.key]: {
                              ...prev.textIconCards.sectionHeadings[section.key],
                              description: event.target.value,
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="rounded border bg-gray-50 px-3 py-2 text-[11px] text-gray-600">
            Global card dimension controls are inactive. Use per-section card dimensions below.
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="text-sm font-semibold">Per-Section Card Dimensions</h3>
            {(
              [
                { key: 'howItWorks', label: 'How It Works' },
                { key: 'custom', label: 'Custom' },
                { key: 'shopWithConfidence', label: 'Shop With Confidence' },
              ] as const
            ).map((section) => (
              <div key={`text-icon-style-${section.key}`} className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-6">
                <p className="text-xs font-semibold md:col-span-6">{section.label}</p>
                <label className="text-[11px]">
                  Min Height
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionStyles[section.key].cardMinHeight}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: {
                              ...prev.textIconCards.sectionStyles[section.key],
                              cardMinHeight: clamp(
                                toNumber(event.target.value, prev.textIconCards.sectionStyles[section.key].cardMinHeight),
                                80,
                                520
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-[11px]">
                  Width
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionStyles[section.key].cardWidth}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: {
                              ...prev.textIconCards.sectionStyles[section.key],
                              cardWidth: clamp(
                                toNumber(event.target.value, prev.textIconCards.sectionStyles[section.key].cardWidth),
                                180,
                                520
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-[11px]">
                  Icon
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionStyles[section.key].iconSize}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: {
                              ...prev.textIconCards.sectionStyles[section.key],
                              iconSize: clamp(
                                toNumber(event.target.value, prev.textIconCards.sectionStyles[section.key].iconSize),
                                20,
                                120
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-[11px]">
                  Title Font
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionStyles[section.key].titleFontSize}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: {
                              ...prev.textIconCards.sectionStyles[section.key],
                              titleFontSize: clamp(
                                toNumber(event.target.value, prev.textIconCards.sectionStyles[section.key].titleFontSize),
                                8,
                                72
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-[11px]">
                  Description Font
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={config.textIconCards.sectionStyles[section.key].descriptionFontSize}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: {
                              ...prev.textIconCards.sectionStyles[section.key],
                              descriptionFontSize: clamp(
                                toNumber(
                                  event.target.value,
                                  prev.textIconCards.sectionStyles[section.key].descriptionFontSize
                                ),
                                8,
                                72
                              ),
                            },
                          },
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-[11px]">
                  Reset
                  <button
                    type="button"
                    className="mt-1 w-full rounded border px-2 py-1 text-xs hover:bg-gray-50"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        textIconCards: {
                          ...prev.textIconCards,
                          sectionStyles: {
                            ...prev.textIconCards.sectionStyles,
                            [section.key]: { ...DEFAULT_CONFIG.textIconCards.sectionStyles[section.key] },
                          },
                        },
                      }))
                    }
                  >
                    Reset Section Style
                  </button>
                </label>
              </div>
            ))}
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
              <label className="md:col-span-2 text-[11px]">
                Icon
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={card.icon}
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
                >
                  {ICON_OPTIONS.map((iconKey) => (
                    <option key={`text-icon-${iconKey}`} value={iconKey}>
                      {iconKey}
                    </option>
                  ))}
                </select>
              </label>
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
                    ...prev.featured,
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
                        ctaLink: '/readytowear',
                        ctaMode: 'PAGE',
                        ctaPageKey: 'READY_TO_WEAR',
                        productGroup: 'ALL',
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            {(['RTW', 'CTW', 'FTB'] as const).flatMap((key) => [
              <label key={`featured-${key}-rows`} className="text-xs">
                {key} Rows
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.featured.layoutByKey?.[key]?.rows ?? 1}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        ...prev.featured,
                        layoutByKey: {
                          ...(prev.featured.layoutByKey || ({} as Record<FeaturedCategoryKey, FeaturedLayout>)),
                          RTW: {
                            rows: prev.featured.layoutByKey?.RTW?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.RTW?.columns ?? prev.featured.columns ?? 2,
                          },
                          CTW: {
                            rows: prev.featured.layoutByKey?.CTW?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.CTW?.columns ?? prev.featured.columns ?? 2,
                          },
                          FTB: {
                            rows: prev.featured.layoutByKey?.FTB?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.FTB?.columns ?? prev.featured.columns ?? 2,
                          },
                          [key]: {
                            rows: clamp(toNumber(event.target.value, prev.featured.layoutByKey?.[key]?.rows ?? 1), 1, 12),
                            columns: prev.featured.layoutByKey?.[key]?.columns ?? prev.featured.columns ?? 2,
                          },
                        },
                      },
                    }))
                  }
                />
              </label>,
              <label key={`featured-${key}-columns`} className="text-xs">
                {key} Columns
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.featured.layoutByKey?.[key]?.columns ?? config.featured.columns ?? 2}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        ...prev.featured,
                        layoutByKey: {
                          ...(prev.featured.layoutByKey || ({} as Record<FeaturedCategoryKey, FeaturedLayout>)),
                          RTW: {
                            rows: prev.featured.layoutByKey?.RTW?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.RTW?.columns ?? prev.featured.columns ?? 2,
                          },
                          CTW: {
                            rows: prev.featured.layoutByKey?.CTW?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.CTW?.columns ?? prev.featured.columns ?? 2,
                          },
                          FTB: {
                            rows: prev.featured.layoutByKey?.FTB?.rows ?? 1,
                            columns: prev.featured.layoutByKey?.FTB?.columns ?? prev.featured.columns ?? 2,
                          },
                          [key]: {
                            rows: prev.featured.layoutByKey?.[key]?.rows ?? 1,
                            columns: clamp(toNumber(event.target.value, prev.featured.layoutByKey?.[key]?.columns ?? 2), 1, 4),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>,
            ])}
          </div>
          {config.featured.cards.map((card, index) => (
            <div key={card.id} className="rounded border p-3 space-y-2">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                <label className="md:col-span-1 text-[11px]">
                  Key
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={card.key}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          ...prev.featured,
                          cards: prev.featured.cards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, key: event.target.value.toUpperCase() } : entry
                          ),
                        },
                      }))
                    }
                  >
                    {CATEGORY_SECTION_KEY_OPTIONS.map((option) => (
                      <option key={`featured-key-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  className="md:col-span-2 rounded border px-2 py-1 text-xs"
                  value={card.tag}
                  placeholder="Tag"
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        ...prev.featured,
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
                        ...prev.featured,
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
                        ...prev.featured,
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
                        ...prev.featured,
                        cards: prev.featured.cards.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, ctaText: event.target.value } : entry
                        ),
                      },
                    }))
                  }
                />
                <label className="md:col-span-1 text-[11px]">
                  CTA Route Type
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={card.ctaMode}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          ...prev.featured,
                          cards: prev.featured.cards.map((entry, entryIndex) => {
                            if (entryIndex !== index) return entry;
                            const nextMode: FeaturedCard['ctaMode'] = event.target.value === 'URL' ? 'URL' : 'PAGE';
                            if (nextMode === 'PAGE') {
                              const fallbackRoute = pageRouteOptions.find(
                                (route) => route.key === (entry.ctaPageKey || 'READY_TO_WEAR')
                              ) || pageRouteOptions.find((route) => route.key === 'READY_TO_WEAR') || pageRouteOptions[0];
                              return {
                                ...entry,
                                ctaMode: nextMode,
                                ctaPageKey: fallbackRoute?.key || 'READY_TO_WEAR',
                                ctaLink: fallbackRoute?.href || '/readytowear',
                              };
                            }
                            return {
                              ...entry,
                              ctaMode: nextMode,
                              ctaPageKey: '',
                            };
                          }),
                        },
                      }))
                    }
                  >
                    <option value="URL">URL Link</option>
                    <option value="PAGE">Pages Dropdown</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  {card.ctaMode === 'PAGE' ? 'CTA Page' : 'CTA URL Link'}
                  {card.ctaMode === 'PAGE' ? (
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.ctaPageKey || ''}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          featured: {
                            ...prev.featured,
                            cards: prev.featured.cards.map((entry, entryIndex) => {
                              if (entryIndex !== index) return entry;
                              const selected = pageRouteOptions.find((route) => route.key === event.target.value);
                              return {
                                ...entry,
                                ctaPageKey: event.target.value,
                                ctaLink: selected?.href || entry.ctaLink,
                              };
                            }),
                          },
                        }))
                      }
                    >
                      {pageRouteOptions.map((route) => (
                        <option key={`featured-page-${route.key}`} value={route.key}>
                          {route.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.ctaLink}
                      placeholder="/readytowear or https://..."
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          featured: {
                            ...prev.featured,
                            cards: prev.featured.cards.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, ctaLink: event.target.value, ctaPageKey: '' } : entry
                            ),
                          },
                        }))
                      }
                    />
                  )}
                </label>
                {renderCtaStyleEditor(
                  'Card CTA Style',
                  card.ctaStyle,
                  (nextStyle) =>
                    setConfig((prev) => ({
                      ...prev,
                      featured: {
                        ...prev.featured,
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          ...prev.featured,
                          cards: prev.featured.cards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, image: '' } : entry
                          ),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <input
                    type="checkbox"
                    checked={card.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        featured: {
                          ...prev.featured,
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
                          ...prev.featured,
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
              <div className="rounded-md border bg-white p-2">
                {card.image ? (
                  <img
                    src={resolvePreviewUrl(card.image)}
                    alt={`Featured image preview ${index + 1}`}
                    className="h-24 w-full rounded object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                    No featured image uploaded
                  </div>
                )}
              </div>
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
                        ctaLink: '/cystomtowear',
                        ctaMode: 'PAGE',
                        ctaPageKey: 'CUSTOM_TO_WEAR',
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
                <label className="md:col-span-2 text-[11px]">
                  CTA Route Type
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={card.ctaMode || 'PAGE'}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        designerSpotlight: {
                          ...prev.designerSpotlight,
                          cards: prev.designerSpotlight.cards.map((entry, entryIndex) => {
                            if (entryIndex !== index) return entry;
                            const nextMode: 'URL' | 'PAGE' = event.target.value === 'URL' ? 'URL' : 'PAGE';
                            if (nextMode === 'PAGE') {
                              const fallbackRoute =
                                pageRouteOptions.find((route) => route.key === (entry.ctaPageKey || 'CUSTOM_TO_WEAR')) ||
                                pageRouteOptions.find((route) => route.key === 'CUSTOM_TO_WEAR') ||
                                pageRouteOptions[0];
                              return {
                                ...entry,
                                ctaMode: 'PAGE',
                                ctaPageKey: fallbackRoute?.key || 'CUSTOM_TO_WEAR',
                                ctaLink: fallbackRoute?.href || '/cystomtowear',
                              };
                            }
                            return {
                              ...entry,
                              ctaMode: 'URL',
                              ctaPageKey: '',
                            };
                          }),
                        },
                      }))
                    }
                  >
                    <option value="PAGE">Pages dropdown</option>
                    <option value="URL">Custom URL</option>
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  {(card.ctaMode || 'PAGE') === 'PAGE' ? 'CTA Page' : 'CTA URL'}
                  {(card.ctaMode || 'PAGE') === 'PAGE' ? (
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.ctaPageKey || ''}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          designerSpotlight: {
                            ...prev.designerSpotlight,
                            cards: prev.designerSpotlight.cards.map((entry, entryIndex) => {
                              if (entryIndex !== index) return entry;
                              const selected = pageRouteOptions.find((route) => route.key === event.target.value);
                              return {
                                ...entry,
                                ctaMode: 'PAGE',
                                ctaPageKey: event.target.value,
                                ctaLink: selected?.href || entry.ctaLink,
                              };
                            }),
                          },
                        }))
                      }
                    >
                      {pageRouteOptions.map((route) => (
                        <option key={`spot-page-${route.key}`} value={route.key}>
                          {route.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={card.ctaLink}
                      placeholder="/cystomtowear or https://..."
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          designerSpotlight: {
                            ...prev.designerSpotlight,
                            cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, ctaMode: 'URL', ctaPageKey: '', ctaLink: event.target.value }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  )}
                </label>
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
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        designerSpotlight: {
                          ...prev.designerSpotlight,
                          cards: prev.designerSpotlight.cards.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, image: '' } : entry
                          ),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
              <div className="rounded-md border bg-white p-2">
                {card.image ? (
                  <img
                    src={resolvePreviewUrl(card.image)}
                    alt={`Spotlight image preview ${index + 1}`}
                    className="h-24 w-full rounded object-cover"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                    No spotlight image uploaded
                  </div>
                )}
              </div>
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
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" isLoading={uploadingTarget === 'heritage'} onClick={() => heritageImageUploadRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Heritage Image
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, image: '' } }))}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Heritage Image
              </Button>
            </div>
          </div>
          <input ref={heritageImageUploadRef} type="file" accept="image/*" className="hidden" onChange={handleHeritageImageUpload} />
          <p className="text-[11px] text-gray-500 break-all">Image: {config.heritage.image || 'No image uploaded'}</p>
          <div className="rounded-md border bg-white p-2">
            {config.heritage.image ? (
              <img
                src={resolvePreviewUrl(config.heritage.image)}
                alt="Heritage image preview"
                className="h-28 w-full rounded object-cover"
                onError={(event) => {
                  event.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                No heritage image uploaded
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
            <label className="text-xs">
              Stats Position
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.statsPosition}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    heritage: { ...prev.heritage, statsPosition: event.target.value as Heritage['statsPosition'] },
                  }))
                }
              >
                <option value="TOP">TOP</option>
                <option value="MIDDLE">MIDDLE</option>
                <option value="BOTTOM">BOTTOM</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs md:col-span-2">
              Short Story (supports formatted HTML)
              <textarea
                className="mt-1 min-h-[180px] w-full rounded border px-2 py-1.5"
                value={config.heritage.storyHtml}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, storyHtml: event.target.value } }))}
              />
            </label>
            <label className="text-xs">
              Read More Label
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.readMoreLabel}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, readMoreLabel: event.target.value } }))}
              />
            </label>
            <label className="text-xs">
              Read More Link
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.heritage.readMoreHref}
                onChange={(event) => setConfig((prev) => ({ ...prev, heritage: { ...prev.heritage, readMoreHref: event.target.value } }))}
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

      {activeTab === 'customerReviews' ? (
        <section className="rounded-lg border bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">From Our Customers</h2>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  customerReviews: {
                    ...prev.customerReviews,
                    staticMessages: [
                      ...prev.customerReviews.staticMessages,
                      {
                        id: uid(),
                        customerName: 'Customer Name',
                        location: '',
                        message: '',
                        rating: 5,
                        enabled: true,
                        displayOrder: prev.customerReviews.staticMessages.length + 1,
                      },
                    ],
                  },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Static Message
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={config.customerReviews.enabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: { ...prev.customerReviews, enabled: event.target.checked },
                  }))
                }
              />
              Section Enabled
            </label>
            <label className="text-xs md:col-span-2">
              Section Title
              <input
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.sectionTitle}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: { ...prev.customerReviews, sectionTitle: event.target.value },
                  }))
                }
              />
            </label>
              <label className="text-xs">
                Title Font Size (px)
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.customerReviews.titleFontSize}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      customerReviews: {
                        ...prev.customerReviews,
                        titleFontSize: clamp(toNumber(event.target.value, prev.customerReviews.titleFontSize), 14, 120),
                      },
                    }))
                  }
                />
              </label>
            <label className="text-xs">
              Source Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.sourceMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: {
                      ...prev.customerReviews,
                      sourceMode: event.target.value as CustomerReviews['sourceMode'],
                    },
                  }))
                }
              >
                <option value="STATIC_ONLY">STATIC_ONLY</option>
                <option value="PRODUCT_REVIEWS_ONLY">PRODUCT_REVIEWS_ONLY</option>
                <option value="BOTH">BOTH</option>
              </select>
            </label>
            <label className="text-xs">
              Max Items
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.maxItems}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: {
                      ...prev.customerReviews,
                      maxItems: clamp(toNumber(event.target.value, prev.customerReviews.maxItems), 1, 24),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Message Font Size (px)
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.messageFontSize}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: {
                      ...prev.customerReviews,
                      messageFontSize: clamp(toNumber(event.target.value, prev.customerReviews.messageFontSize), 10, 64),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Meta Font Size (px)
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.metaFontSize}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: {
                      ...prev.customerReviews,
                      metaFontSize: clamp(toNumber(event.target.value, prev.customerReviews.metaFontSize), 8, 40),
                    },
                  }))
                }
              />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            <label className="text-xs">
              Display Mode
              <select
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.displayMode}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: { ...prev.customerReviews, displayMode: event.target.value as CustomerReviews['displayMode'] },
                  }))
                }
              >
                <option value="SLIDER">SLIDER</option>
                <option value="GRID">GRID</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={config.customerReviews.autoplayEnabled}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: { ...prev.customerReviews, autoplayEnabled: event.target.checked },
                  }))
                }
              />
              Autoplay
            </label>
            <label className="flex items-center gap-2 text-xs pt-5">
              <input
                type="checkbox"
                checked={config.customerReviews.pauseOnHover}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: { ...prev.customerReviews, pauseOnHover: event.target.checked },
                  }))
                }
              />
              Pause on Hover
            </label>
            <label className="text-xs">
              Autoplay Interval (ms)
              <input
                type="number"
                className="mt-1 w-full rounded border px-2 py-1.5"
                value={config.customerReviews.autoplayIntervalMs}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    customerReviews: {
                      ...prev.customerReviews,
                      autoplayIntervalMs: clamp(toNumber(event.target.value, prev.customerReviews.autoplayIntervalMs), 1000, 30000),
                    },
                  }))
                }
              />
            </label>
            <label className="text-xs">
              Navigation & Dots
              <div className="mt-2 flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={config.customerReviews.showNavigation}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        customerReviews: { ...prev.customerReviews, showNavigation: event.target.checked },
                      }))
                    }
                  />
                  Show Navigation Arrows
                </label>
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={config.customerReviews.showIndicators}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        customerReviews: { ...prev.customerReviews, showIndicators: event.target.checked },
                      }))
                    }
                  />
                  Show Dots Indicators
                </label>
              </div>
            </label>
          </div>

          <div className="space-y-2">
            {config.customerReviews.staticMessages
              .slice()
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((message, index) => (
                <div key={message.id} className="grid grid-cols-1 gap-2 rounded border p-3 md:grid-cols-12">
                  <label className="md:col-span-3 text-[11px]">
                    Customer Name
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={message.customerName}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.map((entry, entryIndex) =>
                              entry.id === message.id ? { ...entry, customerName: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-3 text-[11px]">
                    Location
                    <input
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={message.location}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.map((entry) =>
                              entry.id === message.id ? { ...entry, location: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-4 text-[11px]">
                    Message
                    <textarea
                      rows={2}
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={message.message}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.map((entry) =>
                              entry.id === message.id ? { ...entry, message: event.target.value } : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Rating
                    <input
                      type="number"
                      min={1}
                      max={5}
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={message.rating}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.map((entry) =>
                              entry.id === message.id
                                ? { ...entry, rating: clamp(toNumber(event.target.value, entry.rating), 1, 5) }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="md:col-span-1 text-[11px]">
                    Order
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={message.displayOrder}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.map((entry) =>
                              entry.id === message.id
                                ? { ...entry, displayOrder: clamp(toNumber(event.target.value, entry.displayOrder), 1, 999) }
                                : entry
                            ),
                          },
                        }))
                      }
                    />
                  </label>
                  <div className="md:col-span-12 flex items-center justify-end gap-2">
                    <label className="inline-flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={message.enabled}
                        onChange={(event) =>
                          setConfig((prev) => ({
                            ...prev,
                            customerReviews: {
                              ...prev.customerReviews,
                              staticMessages: prev.customerReviews.staticMessages.map((entry) =>
                                entry.id === message.id ? { ...entry, enabled: event.target.checked } : entry
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
                          customerReviews: {
                            ...prev.customerReviews,
                            staticMessages: prev.customerReviews.staticMessages.filter((entry) => entry.id !== message.id),
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            {config.customerReviews.staticMessages.length === 0 ? (
              <p className="text-xs text-gray-500">No static customer messages yet.</p>
            ) : null}
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
              <div className="md:col-span-3 rounded border p-3">
                <p className="text-xs font-semibold">Footer Logo Manager</p>
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-4">
                  <label className="text-xs">
                    Logo Mode
                    <select
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={config.newsletterFooter.footer.logo.mode}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: {
                                ...prev.newsletterFooter.footer.logo,
                                mode: event.target.value === 'IMAGE' ? 'IMAGE' : 'TEXT',
                              },
                            },
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
                      value={config.newsletterFooter.footer.logo.text}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: { ...prev.newsletterFooter.footer.logo, text: event.target.value },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Font Family
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={config.newsletterFooter.footer.logo.fontFamily}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: { ...prev.newsletterFooter.footer.logo, fontFamily: event.target.value },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Text Color
                    <input
                      type="color"
                      className="mt-1 h-9 w-full rounded border px-1 py-1"
                      value={config.newsletterFooter.footer.logo.textColor}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: { ...prev.newsletterFooter.footer.logo, textColor: event.target.value },
                            },
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
                      value={config.newsletterFooter.footer.logo.fontSize}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: {
                                ...prev.newsletterFooter.footer.logo,
                                fontSize: clamp(toNumber(event.target.value, prev.newsletterFooter.footer.logo.fontSize), 10, 96),
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Font Weight
                    <input
                      type="number"
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={config.newsletterFooter.footer.logo.fontWeight}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: {
                                ...prev.newsletterFooter.footer.logo,
                                fontWeight: clamp(
                                  toNumber(event.target.value, prev.newsletterFooter.footer.logo.fontWeight),
                                  100,
                                  900
                                ),
                              },
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
                      value={config.newsletterFooter.footer.logo.width}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: {
                                ...prev.newsletterFooter.footer.logo,
                                width: clamp(toNumber(event.target.value, prev.newsletterFooter.footer.logo.width), 40, 900),
                              },
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
                      value={config.newsletterFooter.footer.logo.height}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: {
                                ...prev.newsletterFooter.footer.logo,
                                height: clamp(toNumber(event.target.value, prev.newsletterFooter.footer.logo.height), 16, 500),
                              },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                  <label className="text-xs">
                    Alt Text
                    <input
                      className="mt-1 w-full rounded border px-2 py-1.5"
                      value={config.newsletterFooter.footer.logo.altText}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              logo: { ...prev.newsletterFooter.footer.logo, altText: event.target.value },
                            },
                          },
                        }))
                      }
                    />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    isLoading={uploadingTarget === 'footer-logo'}
                    onClick={() => footerLogoUploadRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Footer Logo Image
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            logo: { ...prev.newsletterFooter.footer.logo, imageUrl: '' },
                          },
                        },
                      }))
                    }
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Footer Logo Image
                  </Button>
                  <span className="text-xs text-gray-600 break-all">
                    {config.newsletterFooter.footer.logo.imageUrl || 'No footer logo image uploaded'}
                  </span>
                </div>
                <div className="mt-2 rounded-md border bg-white p-2">
                  {config.newsletterFooter.footer.logo.imageUrl ? (
                    <img
                      src={resolvePreviewUrl(config.newsletterFooter.footer.logo.imageUrl)}
                      alt="Footer logo preview"
                      className="h-24 w-full rounded object-contain"
                    />
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded border border-dashed text-xs text-gray-500">
                      No footer logo image uploaded
                    </div>
                  )}
                </div>
              </div>
              <label className="text-xs md:col-span-3">
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={config.newsletterFooter.footer.map.enabled}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            map: { ...prev.newsletterFooter.footer.map, enabled: event.target.checked },
                          },
                        },
                      }))
                    }
                  />
                  Show map underlay behind footer
                </span>
              </label>
              <label className="text-xs md:col-span-2">
                Map underlay image URL
                <input
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.map.image}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: {
                          ...prev.newsletterFooter.footer,
                          map: { ...prev.newsletterFooter.footer.map, image: event.target.value },
                        },
                      },
                    }))
                  }
                  placeholder="https://.../map.jpg"
                />
              </label>
              <label className="text-xs">
                Map Height (px)
                <input
                  type="number"
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.map.minHeight}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: {
                          ...prev.newsletterFooter.footer,
                          map: {
                            ...prev.newsletterFooter.footer.map,
                            minHeight: clamp(toNumber(event.target.value, prev.newsletterFooter.footer.map.minHeight), 80, 900),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-3">
                Map Overlay Color
                <input
                  type="color"
                  className="mt-1 h-9 w-full rounded border px-1 py-1"
                  value={config.newsletterFooter.footer.map.overlayColor}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: {
                          ...prev.newsletterFooter.footer,
                          map: {
                            ...prev.newsletterFooter.footer.map,
                            overlayColor: event.target.value,
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <label className="text-xs md:col-span-3">
                Map Overlay Opacity (%)
                <input
                  type="number"
                  step="1"
                  min={0}
                  max={100}
                  className="mt-1 w-full rounded border px-2 py-1.5"
                  value={config.newsletterFooter.footer.map.overlayOpacity}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: {
                          ...prev.newsletterFooter.footer,
                          map: {
                            ...prev.newsletterFooter.footer.map,
                            overlayOpacity: clamp(Math.round((Math.max(0, Math.min(1, Number(event.target.value) || 0)) * 100)), 0, 100),
                          },
                        },
                      },
                    }))
                  }
                />
              </label>
              <div className="md:col-span-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  isLoading={uploadingTarget === 'footer-map'}
                  onClick={() => footerMapUploadRef.current?.click()}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Map Underlay Image
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      newsletterFooter: {
                        ...prev.newsletterFooter,
                        footer: {
                          ...prev.newsletterFooter.footer,
                          map: { ...prev.newsletterFooter.footer.map, image: '' },
                        },
                      },
                    }))
                  }
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Map Image
                </Button>
              </div>
            </div>
            <input ref={footerLogoUploadRef} type="file" accept="image/*" className="hidden" onChange={handleFooterLogoUpload} />
            <input ref={footerMapUploadRef} type="file" accept="image/*" className="hidden" onChange={handleFooterMapUpload} />
          </div>
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Footer Social Media Links</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    newsletterFooter: {
                      ...prev.newsletterFooter,
                      footer: {
                        ...prev.newsletterFooter.footer,
                        socialLinks: [
                          ...prev.newsletterFooter.footer.socialLinks,
                          { id: uid(), label: 'Instagram', icon: 'Instagram', href: 'https://instagram.com', enabled: true },
                        ],
                      },
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Social Link
              </Button>
            </div>
            {config.newsletterFooter.footer.socialLinks.map((link, index) => (
              <div key={link.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                <label className="md:col-span-2 text-[11px]">
                  Platform
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={link.label}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            socialLinks: prev.newsletterFooter.footer.socialLinks.map((entry, entryIndex) =>
                              entryIndex === index
                                ? { ...entry, label: event.target.value, icon: event.target.value === 'X' ? 'X' : event.target.value }
                                : entry
                            ),
                          },
                        },
                      }))
                    }
                  >
                    {SOCIAL_ICON_OPTIONS.map((option) => (
                      <option key={`social-platform-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-2 text-[11px]">
                  Icon
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={link.icon || link.label || 'Instagram'}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            socialLinks: prev.newsletterFooter.footer.socialLinks.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, icon: event.target.value } : entry
                            ),
                          },
                        },
                      }))
                    }
                  >
                    {SOCIAL_ICON_OPTIONS.map((option) => (
                      <option key={`social-icon-${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="md:col-span-5 text-[11px]">
                  Social URL
                  <input
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                    value={link.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            socialLinks: prev.newsletterFooter.footer.socialLinks.map((entry, entryIndex) =>
                              entryIndex === index ? { ...entry, href: event.target.value } : entry
                            ),
                          },
                        },
                      }))
                    }
                  />
                </label>
                <div className="md:col-span-3 flex items-end justify-end gap-2">
                  <label className="inline-flex items-center gap-2 text-[11px]">
                    <input
                      type="checkbox"
                      checked={link.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              socialLinks: prev.newsletterFooter.footer.socialLinks.map((entry, entryIndex) =>
                                entryIndex === index ? { ...entry, enabled: event.target.checked } : entry
                              ),
                            },
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
                        newsletterFooter: {
                          ...prev.newsletterFooter,
                          footer: {
                            ...prev.newsletterFooter.footer,
                            socialLinks: prev.newsletterFooter.footer.socialLinks.filter((_, entryIndex) => entryIndex !== index),
                          },
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
              <h3 className="text-sm font-semibold">Footer Menu Groups</h3>
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setConfig((prev) => ({
                    ...prev,
                    newsletterFooter: {
                      ...prev.newsletterFooter,
                      footer: {
                        ...prev.newsletterFooter.footer,
                        linkGroups: [
                          ...prev.newsletterFooter.footer.linkGroups,
                          {
                            id: uid(),
                            title: 'Shop',
                            links: [{ id: uid(), label: 'Ready To Wear', href: '/readytowear', enabled: true }],
                          },
                        ],
                      },
                    },
                  }))
                }
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Menu Group
              </Button>
            </div>
            {config.newsletterFooter.footer.linkGroups.map((group, groupIndex) => (
              <div key={group.id} className="rounded border p-3 space-y-2">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-12">
                  <label className="md:col-span-3 text-[11px]">
                    Group Title
                    <select
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      value={group.title}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                entryIndex === groupIndex ? { ...entry, title: event.target.value } : entry
                              ),
                            },
                          },
                        }))
                      }
                    >
                      {LINK_GROUP_TITLE_OPTIONS.map((option) => (
                        <option key={`group-title-${option}`} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="md:col-span-9 flex items-end justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                entryIndex === groupIndex
                                  ? {
                                      ...entry,
                                      links: [
                                        ...entry.links,
                                        {
                                          id: uid(),
                                          label: 'New Link',
                                          href: '/readytowear',
                                          hrefMode: 'PAGE',
                                          pageKey: 'READY_TO_WEAR',
                                          customUrl: '',
                                          enabled: true,
                                        },
                                      ],
                                    }
                                  : entry
                              ),
                            },
                          },
                        }))
                      }
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Menu Link
                    </Button>
                    <button
                      type="button"
                      className="rounded border p-1"
                      onClick={() =>
                        setConfig((prev) => ({
                          ...prev,
                          newsletterFooter: {
                            ...prev.newsletterFooter,
                            footer: {
                              ...prev.newsletterFooter.footer,
                              linkGroups: prev.newsletterFooter.footer.linkGroups.filter((_, entryIndex) => entryIndex !== groupIndex),
                            },
                          },
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {group.links.map((link, linkIndex) => (
                    <div key={link.id} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                      <label className="md:col-span-3 text-[11px]">
                        Menu Label
                        <input
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                          value={link.label}
                          onChange={(event) =>
                            setConfig((prev) => ({
                              ...prev,
                              newsletterFooter: {
                                ...prev.newsletterFooter,
                                footer: {
                                  ...prev.newsletterFooter.footer,
                                  linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                    entryIndex === groupIndex
                                      ? {
                                          ...entry,
                                          links: entry.links.map((groupLink, groupLinkIndex) =>
                                            groupLinkIndex === linkIndex ? { ...groupLink, label: event.target.value } : groupLink
                                          ),
                                        }
                                      : entry
                                  ),
                                },
                              },
                            }))
                          }
                        />
                      </label>
                      <label className="md:col-span-2 text-[11px]">
                        Link Source
                        <select
                          className="mt-1 w-full rounded border px-2 py-1 text-xs"
                          value={link.hrefMode || 'PAGE'}
                          onChange={(event) =>
                            setConfig((prev) => ({
                              ...prev,
                              newsletterFooter: {
                                ...prev.newsletterFooter,
                                footer: {
                                  ...prev.newsletterFooter.footer,
                                  linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                    entryIndex === groupIndex
                                      ? {
                                          ...entry,
                                          links: entry.links.map((groupLink, groupLinkIndex) => {
                                            if (groupLinkIndex !== linkIndex) return groupLink;
                                            const nextMode = event.target.value as LinkMode;
                                            const fallbackRoute = pageRouteOptions.find((route) => route.key === 'READY_TO_WEAR') || pageRouteOptions[0];
                                            const activeRoute =
                                              pageRouteOptions.find((route) => route.key === (groupLink.pageKey || groupLink.routeKey || '')) ||
                                              fallbackRoute;
                                            return {
                                              ...groupLink,
                                              hrefMode: nextMode,
                                              pageKey: groupLink.pageKey || groupLink.routeKey || activeRoute.key,
                                              customUrl:
                                                nextMode === 'CUSTOM_URL'
                                                  ? groupLink.customUrl || groupLink.href || ''
                                                  : groupLink.customUrl || '',
                                              href: nextMode === 'CUSTOM_URL' ? groupLink.customUrl || groupLink.href || '' : activeRoute.href,
                                            };
                                          }),
                                        }
                                      : entry
                                  ),
                                },
                              },
                            }))
                          }
                        >
                          <option value="PAGE">Pages dropdown</option>
                          <option value="CUSTOM_URL">Custom URL</option>
                        </select>
                      </label>
                      {(link.hrefMode || 'PAGE') === 'CUSTOM_URL' ? (
                        <label className="md:col-span-4 text-[11px]">
                          Custom URL
                          <input
                            className="mt-1 w-full rounded border px-2 py-1 text-xs"
                            value={link.customUrl || link.href || ''}
                            placeholder="/readytowear or https://example.com"
                            onChange={(event) =>
                              setConfig((prev) => ({
                                ...prev,
                                newsletterFooter: {
                                  ...prev.newsletterFooter,
                                  footer: {
                                    ...prev.newsletterFooter.footer,
                                    linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                      entryIndex === groupIndex
                                        ? {
                                            ...entry,
                                            links: entry.links.map((groupLink, groupLinkIndex) =>
                                              groupLinkIndex === linkIndex
                                                ? {
                                                    ...groupLink,
                                                    customUrl: event.target.value,
                                                    href: event.target.value,
                                                    hrefMode: 'CUSTOM_URL',
                                                  }
                                                : groupLink
                                            ),
                                          }
                                        : entry
                                    ),
                                  },
                                },
                              }))
                            }
                          />
                        </label>
                      ) : (
                        <label className="md:col-span-4 text-[11px]">
                          Menu Route (dropdown)
                          <select
                            className="mt-1 w-full rounded border px-2 py-1 text-xs"
                            value={
                              link.pageKey ||
                              link.routeKey ||
                              pageRouteOptions.find((route) => route.href === link.href)?.key ||
                              'READY_TO_WEAR'
                            }
                            onChange={(event) =>
                              setConfig((prev) => ({
                                ...prev,
                                newsletterFooter: {
                                  ...prev.newsletterFooter,
                                  footer: {
                                    ...prev.newsletterFooter.footer,
                                    linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                      entryIndex === groupIndex
                                        ? {
                                            ...entry,
                                            links: entry.links.map((groupLink, groupLinkIndex) => {
                                              if (groupLinkIndex !== linkIndex) return groupLink;
                                              const selected = pageRouteOptions.find((route) => route.key === event.target.value);
                                              return {
                                                ...groupLink,
                                                hrefMode: 'PAGE',
                                                pageKey: event.target.value,
                                                routeKey: event.target.value,
                                                href: selected?.href || groupLink.href,
                                              };
                                            }),
                                          }
                                        : entry
                                    ),
                                  },
                                },
                              }))
                            }
                          >
                            {pageRouteOptions.map((route) => (
                              <option key={`footer-menu-${route.key}`} value={route.key}>
                                {route.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      <div className="md:col-span-3 flex items-end justify-end gap-2">
                        <label className="inline-flex items-center gap-2 text-[11px]">
                          <input
                            type="checkbox"
                            checked={link.enabled}
                            onChange={(event) =>
                              setConfig((prev) => ({
                                ...prev,
                                newsletterFooter: {
                                  ...prev.newsletterFooter,
                                  footer: {
                                    ...prev.newsletterFooter.footer,
                                    linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                      entryIndex === groupIndex
                                        ? {
                                            ...entry,
                                            links: entry.links.map((groupLink, groupLinkIndex) =>
                                              groupLinkIndex === linkIndex ? { ...groupLink, enabled: event.target.checked } : groupLink
                                            ),
                                          }
                                        : entry
                                    ),
                                  },
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
                              newsletterFooter: {
                                ...prev.newsletterFooter,
                                footer: {
                                  ...prev.newsletterFooter.footer,
                                  linkGroups: prev.newsletterFooter.footer.linkGroups.map((entry, entryIndex) =>
                                    entryIndex === groupIndex
                                      ? { ...entry, links: entry.links.filter((_, groupLinkIndex) => groupLinkIndex !== linkIndex) }
                                      : entry
                                  ),
                                },
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
            ))}
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
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplateKey('HOW_IT_WORKS');
                  if (!templateName.trim()) setTemplateName('How It Works Copy');
                }}
              >
                Add Section from Text/Icon block (How It Works)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplateKey('CUSTOM_TEXT_ICON');
                  if (!templateName.trim()) setTemplateName('Custom Text/Icon Copy');
                }}
              >
                Add Section from Text/Icon block (Custom)
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTemplateKey('SHOP_WITH_CONFIDENCE');
                  if (!templateName.trim()) setTemplateName('Shop With Confidence Copy');
                }}
              >
                Add Section from Text/Icon block (Shop With Confidence)
              </Button>
            </div>
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
            <div className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
              <p className="text-xs font-medium md:col-span-3">Global Section Title Controls</p>
              <label className="md:col-span-3 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={toBoolean(config.sectionVisibility.titleSettings?.show, true)}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      sectionVisibility: {
                        ...prev.sectionVisibility,
                        titleSettings: {
                          show: event.target.checked,
                          align: prev.sectionVisibility.titleSettings?.align || 'LEFT',
                        },
                      },
                    }))
                  }
                />
                Show Section Titles
              </label>
              <label className="md:col-span-3 text-[11px]">
                Title Alignment
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  value={config.sectionVisibility.titleSettings?.align || 'LEFT'}
                  onChange={(event) =>
                    setConfig((prev) => ({
                      ...prev,
                      sectionVisibility: {
                        ...prev.sectionVisibility,
                        titleSettings: {
                          show: toBoolean(prev.sectionVisibility.titleSettings?.show, true),
                          align:
                            event.target.value === 'CENTER' || event.target.value === 'RIGHT'
                              ? (event.target.value as 'LEFT' | 'CENTER' | 'RIGHT')
                              : 'LEFT',
                        },
                      },
                    }))
                  }
                >
                  <option value="LEFT">Left</option>
                  <option value="CENTER">Center</option>
                  <option value="RIGHT">Right</option>
                </select>
              </label>
            </div>
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
                        ...prev.sectionVisibility,
                          sections: prev.sectionVisibility.sections.map((entry, entryIndex) =>
                            entry.id === section.id ? { ...entry, order: clamp(toNumber(event.target.value, entry.order), 1, 999) } : entry
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
                            ...prev.sectionVisibility,
                            sections: prev.sectionVisibility.sections.map((entry, entryIndex) =>
                              entry.id === section.id ? { ...entry, enabled: event.target.checked } : entry
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
                              ...prev.sectionVisibility,
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
      activeTab === 'shopByCountry' ||
      activeTab === 'topNavigations' ||
      activeTab === 'categoryManage' ||
      activeTab === 'textIconCards' ||
      activeTab === 'featured' ||
      activeTab === 'freshDrops' ||
      activeTab === 'designerSpotlight' ||
      activeTab === 'heritage' ||
      activeTab === 'customerReviews' ||
      activeTab === 'sectionVisibility' ? null : (
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-xl font-semibold">Section coming soon</h2>
        </section>
      )}
    </div>
  );
}
