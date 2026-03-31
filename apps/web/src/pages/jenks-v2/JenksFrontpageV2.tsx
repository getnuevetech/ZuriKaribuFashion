import { useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Globe,
  Headphones,
  Heart,
  Instagram,
  Mail,
  Menu,
  Moon,
  Palette,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  Truck,
  Twitter,
  Youtube,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, resolveAssetUrl } from '../../services/api';
import '../../styles/jenks-v2.css';

type HeroSlide = {
  id: string;
  image: string;
  fallbackImage: string;
  rightPanelBackgroundMode: 'NONE' | 'IMAGE';
  rightPanelBackgroundImage: string;
  textVerticalAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
  leftWidthPercent: number;
  rightWidthPercent: number;
  titleA: string;
  titleB: string;
  lineA: string;
  lineB: string;
  primaryCtaText: string;
  primaryCtaHref: string;
  primaryCtaStyle?: CTAStyle;
  primaryCtaEnabled: boolean;
  secondaryCtaText: string;
  secondaryCtaHref: string;
  secondaryCtaStyle?: CTAStyle;
  secondaryCtaEnabled: boolean;
  tertiaryCtaText: string;
  tertiaryCtaHref: string;
  tertiaryCtaStyle?: CTAStyle;
  tertiaryCtaEnabled: boolean;
};
type FeaturedTile = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  href: string;
  tag: string;
  cta: string;
  ctaStyle?: CTAStyle;
};
type CTAStyle = {
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

type ShopByTab = 'CATEGORY' | 'COUNTRY' | 'STYLE' | 'PRICE';
type CountryRegion = 'ALL' | 'NORTH' | 'WEST' | 'CENTRAL' | 'EAST' | 'SOUTHERN';
type TemplateKey =
  | 'TOP_NAVIGATIONS'
  | 'SHOP_BY'
  | 'CATEGORY_MANAGE'
  | 'HOW_IT_WORKS'
  | 'SHOP_WITH_CONFIDENCE'
  | 'FEATURED'
  | 'FRESH_DROPS'
  | 'DESIGNER_SPOTLIGHT'
  | 'HERITAGE'
  | 'NEWSLETTER_FOOTER';

type JenksV2ManagerPayload = Record<string, unknown>;
type IconComponent = ComponentType<{ className?: string }>;

const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';
const HERO_HEIGHT_CLASS = 'min-h-[106vh]';

const TEMPLATE_KEYS: TemplateKey[] = [
  'TOP_NAVIGATIONS',
  'SHOP_BY',
  'CATEGORY_MANAGE',
  'HOW_IT_WORKS',
  'SHOP_WITH_CONFIDENCE',
  'FEATURED',
  'FRESH_DROPS',
  'DESIGNER_SPOTLIGHT',
  'HERITAGE',
  'NEWSLETTER_FOOTER',
];

const ICON_BY_KEY: Record<string, IconComponent> = {
  Search,
  Palette,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  Truck,
  Headphones,
  ShoppingBag,
  Heart,
  Briefcase,
  CalendarDays,
  Globe,
};

const SHOP_BY_TAB_META: Array<{ key: ShopByTab; label: string; Icon: IconComponent }> = [
  { key: 'CATEGORY', label: 'Category', Icon: ShoppingBag },
  { key: 'COUNTRY', label: 'Country', Icon: Globe },
  { key: 'STYLE', label: 'Occasion / Style', Icon: CalendarDays },
  { key: 'PRICE', label: 'Price', Icon: Tag },
];

const DEFAULT_HREF_BY_KEY: Record<string, string> = {
  RTW: '/ready-to-wear',
  CTW: '/custom',
  FTB: '/fabrics',
  HOME: '/',
  SHOP: '/ready-to-wear',
  READY_TO_WEAR: '/ready-to-wear',
  CUSTOM_TO_WEAR: '/custom',
  FABRICS: '/fabrics',
  CONTACT: '/contact',
  AUTH_LOGIN: '/auth/login',
};

const FEATURED_LABEL_BY_KEY: Record<string, string> = {
  RTW: 'Ready To Wear',
  CTW: 'Custom To Wear',
  FTB: 'Fabrics To Buy',
};

const FEATURED_CTA_BY_KEY: Record<string, string> = {
  RTW: 'SHOP READY TO WEAR',
  CTW: 'SHOP CUSTOM TO WEAR',
  FTB: 'SHOP FABRICS TO BUY',
};

const FEATURED_HREF_BY_KEY: Record<string, string> = {
  RTW: '/ready-to-wear',
  CTW: '/custom',
  FTB: '/fabrics',
};

const CATEGORY_IMAGE_BY_KEY: Record<string, string> = {
  RTW: `${ASSET_BASE}/rw_full.jpg`,
  FTB: `${ASSET_BASE}/fabrics_full.jpg`,
  CTW: `${ASSET_BASE}/custom_full.jpg`,
};

const CATEGORY_PANEL_BG_BY_KEY: Record<string, string> = {
  RTW: 'bg-[#111]',
  FTB: 'bg-[#171717]',
  CTW: 'bg-[#111]',
};

const CATEGORY_TEXT_LEFT_BY_KEY: Record<string, boolean> = {
  RTW: false,
  FTB: true,
  CTW: false,
};

const DEFAULT_SOLID_CTA_STYLE: CTAStyle = {
  backgroundColor: '#e66045',
  textColor: '#ffffff',
  borderColor: '#e66045',
  borderWidth: 0,
  hoverTextColor: '#ffffff',
  hoverBorderColor: '#e66045',
  fontFamily: 'Montserrat, Inter, sans-serif',
  fontSize: 12,
  fontWeight: 600,
};

const DEFAULT_INLINE_CTA_STYLE: CTAStyle = {
  backgroundColor: 'transparent',
  textColor: '#ffffff',
  borderColor: 'transparent',
  borderWidth: 0,
  hoverTextColor: '#ffffff',
  hoverBorderColor: '#ffffff',
  fontFamily: 'Montserrat, Inter, sans-serif',
  fontSize: 16,
  fontWeight: 600,
};

const HERO_COL_SPAN_CLASS: Record<number, string> = {
  3: 'lg:col-span-3',
  4: 'lg:col-span-4',
  5: 'lg:col-span-5',
  6: 'lg:col-span-6',
  7: 'lg:col-span-7',
  8: 'lg:col-span-8',
  9: 'lg:col-span-9',
};

const buildCountryProductsHref = (
  countryName: string,
  category: 'RTW' | 'CTW' | 'FTB' | 'ALL' = 'ALL'
) => {
  const params = new URLSearchParams();
  params.set('country', countryName);
  if (category !== 'ALL') {
    params.set('category', category);
  }
  return `/country-products?${params.toString()}`;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const asNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const normalizeHref = (value: unknown, fallback: string, routeKey?: unknown) => {
  const href = asString(value, '');
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return toSafeInternalHref(href);
  const routeToken = String(routeKey || '').trim().toUpperCase();
  if (routeToken && DEFAULT_HREF_BY_KEY[routeToken]) return toSafeInternalHref(DEFAULT_HREF_BY_KEY[routeToken]);
  return toSafeInternalHref(fallback);
};

const normalizeCountryCategoryToken = (value: unknown): 'RTW' | 'CTW' | 'FTB' | 'ALL' => {
  const token = asString(value, '').trim().toUpperCase();
  if (!token) return 'ALL';
  if (token === 'RTW' || token === 'READY_TO_WEAR' || token === 'READY-TO-WEAR') return 'RTW';
  if (token === 'CTW' || token === 'CUSTOM' || token === 'CUSTOM_TO_WEAR' || token === 'CUSTOM-TO-WEAR') return 'CTW';
  if (token === 'FTB' || token === 'FABRIC' || token === 'FABRICS' || token === 'FABRICS_TO_BUY' || token === 'FABRICS-TO-BUY') return 'FTB';
  return 'ALL';
};

const categoryTokenFromSectionKey = (key: unknown): 'RTW' | 'CTW' | 'FTB' | 'ALL' => {
  const token = String(key || '')
    .trim()
    .toUpperCase();
  if (token === 'RTW') return 'RTW';
  if (token === 'CTW') return 'CTW';
  if (token === 'FTB') return 'FTB';
  return 'ALL';
};

const resolveManagerImage = (value: unknown, fallback: string) => {
  const raw = asString(value, '');
  if (!raw) return fallback;
  const resolved = resolveAssetUrl(raw);
  return asString(resolved, fallback);
};

const iconFromKey = (iconKey: unknown, fallback: IconComponent) => {
  const token = asString(iconKey, '');
  if (!token) return fallback;
  return ICON_BY_KEY[token] || ICON_BY_KEY[token.toUpperCase()] || fallback;
};

const splitHeroTitle = (title: string) => {
  const compact = title.trim().replace(/\s+/g, ' ');
  if (!compact) return { titleA: 'WEAR', titleB: 'THE STORY OF AFRICA' };
  const words = compact.split(' ');
  if (words.length <= 1) return { titleA: words[0], titleB: '' };
  return {
    titleA: words.slice(0, 1).join(' '),
    titleB: words.slice(1).join(' '),
  };
};

const SOCIAL_ICON_BY_KEY: Record<string, IconComponent> = {
  INSTAGRAM: Instagram,
  FACEBOOK: Facebook,
  TWITTER: Twitter,
  X: Twitter,
  YOUTUBE: Youtube,
};

const toUpperToken = (value: unknown) => asString(value, '').toUpperCase();

const toSocialIcon = (value: unknown): IconComponent => {
  const token = toUpperToken(value);
  return SOCIAL_ICON_BY_KEY[token] || Instagram;
};

const isExternalHref = (href: string) => /^https?:\/\//i.test(href);

const sanitizeLegacyInternalHref = (href: string) => {
  const trimmed = href.trim();
  if (!trimmed) return '/ready-to-wear';
  if (
    trimmed === '/main' ||
    trimmed === '/main/' ||
    trimmed.startsWith('/main?') ||
    trimmed.startsWith('/main#') ||
    trimmed === '/shop' ||
    trimmed === '/shop/' ||
    trimmed.startsWith('/shop?') ||
    trimmed.startsWith('/shop#')
  ) {
    if (trimmed.startsWith('/shop?') || trimmed.startsWith('/shop#')) {
      return `/ready-to-wear${trimmed.slice('/shop'.length)}`;
    }
    return '/ready-to-wear';
  }
  return trimmed;
};

const toSafeInternalHref = (href: string) =>
  isExternalHref(href) ? href : sanitizeLegacyInternalHref(href);

const buildCTAStyle = (raw: unknown, fallback: CTAStyle): CSSProperties => {
  const row = asRecord(raw);
  return {
    backgroundColor: asString(row.backgroundColor, fallback.backgroundColor),
    color: asString(row.textColor, fallback.textColor),
    borderColor: asString(row.borderColor, fallback.borderColor),
    borderWidth: `${Math.max(0, Math.min(12, Math.round(asNumber(row.borderWidth, fallback.borderWidth))))}px`,
    borderStyle: 'solid',
    fontFamily: asString(row.fontFamily, fallback.fontFamily),
    fontSize: `${Math.max(8, Math.min(72, Math.round(asNumber(row.fontSize, fallback.fontSize))))}px`,
    fontWeight: Math.max(100, Math.min(900, Math.round(asNumber(row.fontWeight, fallback.fontWeight)))),
  };
};

const resolveCTAHoverStyle = (raw: unknown, fallback: CTAStyle) => {
  const row = asRecord(raw);
  return {
    hoverTextColor: asString(row.hoverTextColor, fallback.hoverTextColor),
    hoverBorderColor: asString(row.hoverBorderColor, fallback.hoverBorderColor),
  };
};

const applyHeroCtaHoverState = (
  element: HTMLAnchorElement,
  raw: unknown,
  fallback: CTAStyle,
  isHovering: boolean
) => {
  const row = asRecord(raw);
  const baseTextColor = asString(row.textColor, fallback.textColor);
  const baseBorderColor = asString(row.borderColor, fallback.borderColor);
  const hover = resolveCTAHoverStyle(raw, fallback);
  element.style.color = isHovering ? hover.hoverTextColor : baseTextColor;
  element.style.borderColor = isHovering ? hover.hoverBorderColor : baseBorderColor;
};

const socialIconFromLabel = (label: string): IconComponent => {
  const token = label.toLowerCase();
  if (token.includes('insta')) return Instagram;
  if (token.includes('face')) return Facebook;
  if (token === 'x' || token.includes('twitter')) return Twitter;
  if (token.includes('you')) return Youtube;
  return Globe;
};

const HERO: HeroSlide[] = [
  {
    id: '1',
    image: `${ASSET_BASE}/hero_model.jpg`,
    fallbackImage: `${ASSET_BASE}/hero_model.jpg`,
    rightPanelBackgroundMode: 'NONE',
    rightPanelBackgroundImage: '',
    textVerticalAlign: 'MIDDLE',
    leftWidthPercent: 58,
    rightWidthPercent: 42,
    titleA: 'WEAR',
    titleB: 'THE STORY OF AFRICA',
    lineA: 'Curated fashion from top designers and textile houses.',
    lineB: 'Ready-to-wear, fabrics, and custom looks in one destination.',
    primaryCtaText: 'SHOP NOW',
    primaryCtaHref: '/ready-to-wear',
    primaryCtaEnabled: true,
    secondaryCtaText: 'EXPLORE DESIGNERS',
    secondaryCtaHref: '/custom',
    secondaryCtaEnabled: true,
    tertiaryCtaText: 'SHOP FABRICS',
    tertiaryCtaHref: '/fabrics',
    tertiaryCtaEnabled: true,
  },
  {
    id: '2',
    image: `${ASSET_BASE}/rw_full.jpg`,
    fallbackImage: `${ASSET_BASE}/rw_full.jpg`,
    rightPanelBackgroundMode: 'NONE',
    rightPanelBackgroundImage: '',
    textVerticalAlign: 'MIDDLE',
    leftWidthPercent: 58,
    rightWidthPercent: 42,
    titleA: 'DISCOVER',
    titleB: 'AFRICAN ELEGANCE',
    lineA: 'Signature pieces and modern tailoring from trusted labels.',
    lineB: 'Designed on the continent. Styled for the world.',
    primaryCtaText: 'SHOP NOW',
    primaryCtaHref: '/ready-to-wear',
    primaryCtaEnabled: true,
    secondaryCtaText: 'EXPLORE DESIGNERS',
    secondaryCtaHref: '/custom',
    secondaryCtaEnabled: true,
    tertiaryCtaText: 'SHOP FABRICS',
    tertiaryCtaHref: '/fabrics',
    tertiaryCtaEnabled: true,
  },
];

const HOW_IT_WORKS = [
  { title: 'DISCOVER', sub: 'Browse categories and curated looks', Icon: Search },
  { title: 'PICK FABRIC', sub: 'Choose textile quality and color', Icon: Palette },
  { title: 'SUBMIT FIT', sub: 'Send measurements for tailoring', Icon: Sparkles },
  { title: 'PAY SECURELY', sub: 'Checkout with protected payments', Icon: ShieldCheck },
  { title: 'CRAFTED', sub: 'Makers begin production', Icon: RefreshCw },
  { title: 'DELIVERED', sub: 'Shipped globally to your location', Icon: Truck },
];

const trust = [
  { label: 'AUTHENTIC GUARANTEE', sub: 'Verified sellers and designers', Icon: ShieldCheck },
  { label: 'GLOBAL SHIPPING', sub: 'Reliable delivery worldwide', Icon: Truck },
  { label: 'EASY RETURNS', sub: 'Simple returns on eligible orders', Icon: RefreshCw },
  { label: '24/7 SUPPORT', sub: 'Chat and ticket support', Icon: Headphones },
];

const SHOP_BY_CATEGORY = [
  {
    id: 'cat-ready',
    title: 'READY TO WEAR',
    subtitle: 'Everyday edits in premium African style',
    meta: '48 products',
    href: '/ready-to-wear',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    Icon: ShoppingBag,
  },
  {
    id: 'cat-custom',
    title: 'CUSTOM TO WEAR',
    subtitle: 'Bespoke pieces tailored for your story',
    meta: '24 products',
    href: '/custom',
    image: `${ASSET_BASE}/featured_custom_right.jpg`,
    Icon: Sparkles,
  },
  {
    id: 'cat-fabrics',
    title: 'FABRICS TO BUY',
    subtitle: 'Signature textiles from across the continent',
    meta: '64 products',
    href: '/fabrics',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    Icon: Palette,
  },
];

const AFRICAN_COUNTRIES_54: Array<{
  name: string;
  flag: string;
  region: Exclude<CountryRegion, 'ALL'>;
  count: number;
  textiles: string;
}> = [
  { name: 'Algeria', flag: 'dz', region: 'NORTH', count: 62, textiles: 'Burnous • Silk' },
  { name: 'Angola', flag: 'ao', region: 'SOUTHERN', count: 34, textiles: 'Sambo • Cotton' },
  { name: 'Benin', flag: 'bj', region: 'WEST', count: 28, textiles: 'Aso-Oke • Batik' },
  { name: 'Botswana', flag: 'bw', region: 'SOUTHERN', count: 23, textiles: 'Leteisi • Prints' },
  { name: 'Burkina Faso', flag: 'bf', region: 'WEST', count: 37, textiles: 'Faso Dan Fani' },
  { name: 'Burundi', flag: 'bi', region: 'EAST', count: 21, textiles: 'Barkcloth • Cotton' },
  { name: 'Cabo Verde', flag: 'cv', region: 'WEST', count: 19, textiles: 'Creole Lace • Cotton' },
  { name: 'Cameroon', flag: 'cm', region: 'CENTRAL', count: 49, textiles: 'Toghu • Wax' },
  { name: 'Central African Republic', flag: 'cf', region: 'CENTRAL', count: 18, textiles: 'Raffia • Cotton' },
  { name: 'Chad', flag: 'td', region: 'CENTRAL', count: 20, textiles: 'Saharan Weave • Cotton' },
  { name: 'Comoros', flag: 'km', region: 'EAST', count: 16, textiles: 'Island Weave • Silk' },
  { name: 'Congo', flag: 'cg', region: 'CENTRAL', count: 31, textiles: 'Raffia • Prints' },
  { name: 'DR Congo', flag: 'cd', region: 'CENTRAL', count: 33, textiles: 'Kuba Cloth • Raffia' },
  { name: 'Djibouti', flag: 'dj', region: 'EAST', count: 15, textiles: 'Nomad Weave • Cotton' },
  { name: 'Egypt', flag: 'eg', region: 'NORTH', count: 44, textiles: 'Linen • Cotton' },
  { name: 'Equatorial Guinea', flag: 'gq', region: 'CENTRAL', count: 17, textiles: 'Barkcloth • Prints' },
  { name: 'Eritrea', flag: 'er', region: 'EAST', count: 18, textiles: 'Habesha Weave • Cotton' },
  { name: 'Eswatini', flag: 'sz', region: 'SOUTHERN', count: 19, textiles: 'Swazi Prints' },
  { name: 'Ethiopia', flag: 'et', region: 'EAST', count: 57, textiles: 'Shemma • Cotton' },
  { name: 'Gabon', flag: 'ga', region: 'CENTRAL', count: 22, textiles: 'Barkcloth • Indigo' },
  { name: 'Gambia', flag: 'gm', region: 'WEST', count: 20, textiles: 'Batik • Cotton' },
  { name: 'Ghana', flag: 'gh', region: 'WEST', count: 89, textiles: 'Kente • Batik' },
  { name: 'Guinea', flag: 'gn', region: 'WEST', count: 24, textiles: 'Bogolan • Indigo' },
  { name: 'Guinea-Bissau', flag: 'gw', region: 'WEST', count: 18, textiles: 'Wax • Cotton' },
  { name: "Cote d'Ivoire", flag: 'ci', region: 'WEST', count: 26, textiles: 'Baule Weave • Batik' },
  { name: 'Kenya', flag: 'ke', region: 'EAST', count: 67, textiles: 'Kanga • Kikoy' },
  { name: 'Lesotho', flag: 'ls', region: 'SOUTHERN', count: 20, textiles: 'Basotho Blanket' },
  { name: 'Liberia', flag: 'lr', region: 'WEST', count: 19, textiles: 'Country Cloth • Cotton' },
  { name: 'Libya', flag: 'ly', region: 'NORTH', count: 22, textiles: 'Silk Weave • Linen' },
  { name: 'Madagascar', flag: 'mg', region: 'EAST', count: 29, textiles: 'Lamba • Silk' },
  { name: 'Malawi', flag: 'mw', region: 'SOUTHERN', count: 21, textiles: 'Chitenje • Cotton' },
  { name: 'Mali', flag: 'ml', region: 'WEST', count: 46, textiles: 'Bogolan • Indigo' },
  { name: 'Mauritania', flag: 'mr', region: 'NORTH', count: 17, textiles: 'Melfa • Cotton' },
  { name: 'Mauritius', flag: 'mu', region: 'EAST', count: 21, textiles: 'Creole Lace • Cotton' },
  { name: 'Morocco', flag: 'ma', region: 'NORTH', count: 72, textiles: 'Caftan • Brocade' },
  { name: 'Mozambique', flag: 'mz', region: 'SOUTHERN', count: 25, textiles: 'Capulana • Cotton' },
  { name: 'Namibia', flag: 'na', region: 'SOUTHERN', count: 27, textiles: 'Ovaherero • Prints' },
  { name: 'Niger', flag: 'ne', region: 'WEST', count: 20, textiles: 'Indigo Weave • Cotton' },
  { name: 'Nigeria', flag: 'ng', region: 'WEST', count: 156, textiles: 'Ankara • Adire' },
  { name: 'Rwanda', flag: 'rw', region: 'EAST', count: 35, textiles: 'Imigongo • Weave' },
  { name: 'Sao Tome and Principe', flag: 'st', region: 'CENTRAL', count: 14, textiles: 'Island Cotton • Prints' },
  { name: 'Senegal', flag: 'sn', region: 'WEST', count: 38, textiles: 'Bazin • Wax' },
  { name: 'Seychelles', flag: 'sc', region: 'EAST', count: 17, textiles: 'Island Cotton' },
  { name: 'Sierra Leone', flag: 'sl', region: 'WEST', count: 18, textiles: 'Country Cloth • Batik' },
  { name: 'Somalia', flag: 'so', region: 'EAST', count: 16, textiles: 'Dirac • Cotton' },
  { name: 'South Africa', flag: 'za', region: 'SOUTHERN', count: 54, textiles: 'Shweshwe • Xhosa' },
  { name: 'South Sudan', flag: 'ss', region: 'EAST', count: 15, textiles: 'Nile Weave • Cotton' },
  { name: 'Sudan', flag: 'sd', region: 'NORTH', count: 23, textiles: 'Toob • Cotton' },
  { name: 'Tanzania', flag: 'tz', region: 'EAST', count: 41, textiles: 'Kitenge • Kanga' },
  { name: 'Togo', flag: 'tg', region: 'WEST', count: 22, textiles: 'Kente • Batik' },
  { name: 'Tunisia', flag: 'tn', region: 'NORTH', count: 24, textiles: 'Silk • Linen' },
  { name: 'Uganda', flag: 'ug', region: 'EAST', count: 33, textiles: 'Barkcloth • Cotton' },
  { name: 'Zambia', flag: 'zm', region: 'SOUTHERN', count: 26, textiles: 'Chitenge • Cotton' },
  { name: 'Zimbabwe', flag: 'zw', region: 'SOUTHERN', count: 24, textiles: 'Batik • Cotton' },
];

const SHOP_BY_COUNTRY = AFRICAN_COUNTRIES_54.map((country) => ({
  name: country.name,
  count: country.count,
  textiles: country.textiles,
  flag: country.flag,
}));

const SHOP_BY_STYLE = [
  { name: 'Wedding', sub: 'Bridal & celebration wear', Icon: Heart },
  { name: 'Formal Events', sub: 'Business & evening attire', Icon: Briefcase },
  { name: 'Everyday', sub: 'Comfortable daily wear', Icon: ShoppingBag },
  { name: 'Cultural', sub: 'Traditional ceremonies', Icon: Sparkles },
];

const SHOP_BY_PRICE = [
  { range: '$0 - $100', sub: 'Affordable finds' },
  { range: '$100 - $300', sub: 'Mid-range quality' },
  { range: '$300 - $500', sub: 'Premium pieces' },
  { range: '$500+', sub: 'Luxury & bespoke' },
];

const COUNTRY_REGION_OPTIONS: Array<{ key: CountryRegion; label: string }> = [
  { key: 'ALL', label: 'All Regions' },
  { key: 'NORTH', label: 'North' },
  { key: 'WEST', label: 'West' },
  { key: 'CENTRAL', label: 'Central' },
  { key: 'EAST', label: 'East' },
  { key: 'SOUTHERN', label: 'Southern' },
];

const COUNTRY_SHOWCASE: Array<{ name: string; flag: string; region: Exclude<CountryRegion, 'ALL'> }> = AFRICAN_COUNTRIES_54.map(
  ({ name, flag, region }) => ({ name, flag, region })
);

const FEATURED_RTW = [
  {
    id: 'fr1',
    image: `${ASSET_BASE}/product4.jpg`,
    title: 'Bridal Traditional',
    subtitle: 'Made to standard sizes for all',
    href: '/ready-to-wear',
  },
  {
    id: 'fr2',
    image: `${ASSET_BASE}/featured_rw_right.jpg`,
    title: 'Afigan',
    subtitle: 'Premium ready-to-wear edits',
    href: '/ready-to-wear',
  },
];

const FEATURED_CTW = [
  {
    id: 'fc1',
    image: `${ASSET_BASE}/product1.jpg`,
    title: 'Exclusive Gorgeous',
    subtitle: 'Custom craftsmanship for your story',
    href: '/custom',
  },
  {
    id: 'fc2',
    image: `${ASSET_BASE}/featured_custom_left.jpg`,
    title: 'Signature Couture',
    subtitle: 'Tailored by African designers',
    href: '/custom',
  },
];

const FEATURED_FTB = [
  {
    id: 'ff1',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    title: 'Signature Textile Vault',
    subtitle: 'Premium fabrics sourced from artisan houses across Africa.',
    href: '/fabrics',
  },
  {
    id: 'ff2',
    image: `${ASSET_BASE}/product6.jpg`,
    title: 'Occasion Fabric Edit',
    subtitle: 'Handpicked weaves and prints for ceremony and statement looks.',
    href: '/fabrics',
  },
];

const RTW_FTB_CTW_SECTIONS = [
  {
    id: 'rtw',
    key: 'RTW',
    sectionName: 'READY TO WEAR',
    title: 'FEATURED READY TO WEAR',
    description: 'Curated fits built for real life - tailored enough to feel special, versatile enough to wear anywhere.',
    cta: 'SHOP READY TO WEAR',
    href: '/ready-to-wear',
    image: `${ASSET_BASE}/rw_full.jpg`,
    textOnLeft: false,
    panelBg: 'bg-[#111]',
  },
  {
    id: 'ftb',
    key: 'FTB',
    sectionName: 'FABRICS TO BUY',
    title: 'FEATURED FABRICS TO BUY',
    description: 'Handpicked textiles from trusted makers across Africa, ready for your next design and story.',
    cta: 'SHOP FABRICS TO BUY',
    href: '/fabrics',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    textOnLeft: true,
    panelBg: 'bg-[#171717]',
  },
  {
    id: 'ctw',
    key: 'CTW',
    sectionName: 'CUSTOM TO WEAR',
    title: 'FEATURED CUSTOM TO WEAR',
    description: 'Work directly with designers for made-to-measure pieces shaped around your fit and vision.',
    cta: 'SHOP CUSTOM TO WEAR',
    href: '/custom',
    image: `${ASSET_BASE}/custom_full.jpg`,
    textOnLeft: false,
    panelBg: 'bg-[#111]',
  },
] as const;

const FRESH_DROPS = [
  {
    id: 'drop-1',
    image: `${ASSET_BASE}/featured_custom_left.jpg`,
    name: 'Awon Da',
    brand: 'Diallo Fabrics',
    price: '$230.00',
  },
  {
    id: 'drop-2',
    image: `${ASSET_BASE}/featured_rw_right.jpg`,
    name: 'Kakaki Kentus',
    brand: 'Diallo Fabrics',
    price: '$115.00',
  },
  {
    id: 'drop-3',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    name: 'Ankara Agege',
    brand: 'Diallo Fabrics',
    price: '$0.13/yd',
  },
  {
    id: 'drop-4',
    image: `${ASSET_BASE}/product6.jpg`,
    name: 'Bazin Royale',
    brand: 'Diallo Fabrics',
    price: '$145.00',
  },
];

const DESIGNER_SPOTLIGHT = [
  {
    id: 'spot-1',
    image: `${ASSET_BASE}/designer_spotlight.jpg`,
    title: 'LAGOS TAILORING HOUSE',
    description: 'Sharp silhouettes, modern cuts, and rooted craftsmanship from Nigeria.',
    cta: 'VIEW DESIGNER',
    href: '/designers',
  },
  {
    id: 'spot-2',
    image: `${ASSET_BASE}/featured_custom_right.jpg`,
    title: 'DAKAR COUTURE STUDIO',
    description: 'Elegant made-to-measure looks inspired by Senegalese heritage details.',
    cta: 'SHOP COLLECTION',
    href: '/custom',
  },
  {
    id: 'spot-3',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    title: 'ACCRA READY EDIT',
    description: 'Ready pieces styled for events, work, and everyday confidence.',
    cta: 'EXPLORE RTW',
    href: '/ready-to-wear',
  },
] as const;

const ALL_COUNTRIES_COUNT = 54;

export default function JenksFrontpageV2() {
  const [managerConfig, setManagerConfig] = useState<JenksV2ManagerPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [shopByTab, setShopByTab] = useState<ShopByTab>('CATEGORY');
  const [countryRegion, setCountryRegion] = useState<CountryRegion>('ALL');
  const [shopByCountryExpanded, setShopByCountryExpanded] = useState(false);
  const [dedicatedCountryExpanded, setDedicatedCountryExpanded] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'LIGHT' | 'DARK'>('LIGHT');
  const freshDropsStripRef = useRef<HTMLDivElement | null>(null);
  const topNavigationsCfg = useMemo(() => asRecord(asRecord(managerConfig).topNavigations), [managerConfig]);
  const shopByCfg = useMemo(() => asRecord(asRecord(managerConfig).shopBy), [managerConfig]);
  const categoryManageCfg = useMemo(() => asRecord(asRecord(managerConfig).categoryManage), [managerConfig]);
  const textIconCfg = useMemo(() => asRecord(asRecord(managerConfig).textIconCards), [managerConfig]);
  const featuredCfg = useMemo(() => asRecord(asRecord(managerConfig).featured), [managerConfig]);
  const freshDropsCfg = useMemo(() => asRecord(asRecord(managerConfig).freshDrops), [managerConfig]);
  const designerSpotlightCfg = useMemo(() => asRecord(asRecord(managerConfig).designerSpotlight), [managerConfig]);
  const heritageCfg = useMemo(() => asRecord(asRecord(managerConfig).heritage), [managerConfig]);
  const newsletterFooterCfg = useMemo(() => asRecord(asRecord(managerConfig).newsletterFooter), [managerConfig]);
  const sectionVisibilityCfg = useMemo(() => asRecord(asRecord(managerConfig).sectionVisibility), [managerConfig]);

  const sectionLayoutByTemplate = useMemo(() => {
    const defaults = new Map<TemplateKey, { enabled: boolean; order: number }>();
    TEMPLATE_KEYS.forEach((key, index) => {
      defaults.set(key, { enabled: true, order: index + 1 });
    });
    const rows = asArray(sectionVisibilityCfg.sections);
    if (rows.length === 0) return defaults;
    const byTemplate = new Map<TemplateKey, { enabled: boolean; order: number }>();
    rows.forEach((entry, index) => {
      const row = asRecord(entry);
      if (asBoolean(row.isCustom, false)) return;
      const token = asString(row.templateKey, '').toUpperCase() as TemplateKey;
      if (!TEMPLATE_KEYS.includes(token)) return;
      const enabled = asBoolean(row.enabled, true);
      const fallbackOrder = TEMPLATE_KEYS.indexOf(token) + 1 || index + 1;
      const order = Math.max(1, Math.round(asNumber(row.order, fallbackOrder)));
      const existing = byTemplate.get(token);
      if (!existing) {
        byTemplate.set(token, { enabled, order });
        return;
      }
      byTemplate.set(token, {
        enabled: existing.enabled || enabled,
        order: Math.min(existing.order, order),
      });
    });
    if (byTemplate.size === 0) return defaults;
    byTemplate.forEach((value, key) => defaults.set(key, value));
    return defaults;
  }, [sectionVisibilityCfg.sections]);
  const isSectionVisible = (templateKey: TemplateKey) => sectionLayoutByTemplate.get(templateKey)?.enabled ?? true;
  const getSectionOrder = (templateKey: TemplateKey) =>
    sectionLayoutByTemplate.get(templateKey)?.order ?? Math.max(1, TEMPLATE_KEYS.indexOf(templateKey) + 1);

  const logoCfg = useMemo(() => asRecord(topNavigationsCfg.logo), [topNavigationsCfg.logo]);
  const logoTextRaw = asString(logoCfg.text, 'ZURIKARIBU');
  const logoTextSplit = useMemo(() => {
    const compact = logoTextRaw.replace(/\s+/g, '').trim();
    if (!compact) return { left: 'ZURI', right: 'KARIBU' };
    const pivot = Math.max(1, Math.ceil(compact.length / 2));
    return {
      left: compact.slice(0, pivot),
      right: compact.slice(pivot),
    };
  }, [logoTextRaw]);
  const themeCfg = useMemo(() => asRecord(asRecord(topNavigationsCfg.controllers).theme), [topNavigationsCfg.controllers]);
  const ThemeIcon = iconFromKey(themeCfg.icon, Sun);
  const hamburgerMenuLinks = useMemo(
    () =>
      asArray(topNavigationsCfg.hamburgerMenu)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry) => ({
          label: asString(entry.label, 'Menu'),
          href: normalizeHref(entry.href, '/', entry.routeKey),
        })),
    [topNavigationsCfg.hamburgerMenu]
  );
  const additionalTopMenuLinks = useMemo(
    () =>
      asArray(topNavigationsCfg.additionalTopMenu)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry) => ({
          label: asString(entry.label, 'Link'),
          href: normalizeHref(entry.href, '/', entry.routeKey),
        })),
    [topNavigationsCfg.additionalTopMenu]
  );
  const signInCfg = useMemo(() => asRecord(topNavigationsCfg.signInMenu), [topNavigationsCfg.signInMenu]);

  const heroSlides = useMemo(() => {
    const rows = asArray(topNavigationsCfg.heroBanners)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return HERO;
    const mapped = rows.map((row, indexKey) => {
      const fallbackImage = HERO[indexKey % HERO.length]?.image || `${ASSET_BASE}/hero_model.jpg`;
      const fallbackSlide = HERO[indexKey % HERO.length] || HERO[0];
      const title = asString(row.title, 'Wear the Story of Africa');
      const split = splitHeroTitle(title.toUpperCase());
      const panelModeToken = asString(row.rightPanelBackgroundMode, fallbackSlide.rightPanelBackgroundMode).toUpperCase();
      const rightPanelBackgroundMode: HeroSlide['rightPanelBackgroundMode'] = panelModeToken === 'IMAGE' ? 'IMAGE' : 'NONE';
      const panelAlignToken = asString(row.textVerticalAlign, fallbackSlide.textVerticalAlign).toUpperCase();
      const textVerticalAlign: HeroSlide['textVerticalAlign'] =
        panelAlignToken === 'TOP' || panelAlignToken === 'BOTTOM' ? panelAlignToken : 'MIDDLE';
      const leftWidthPercent = Math.max(20, Math.min(80, Math.round(asNumber(row.leftWidthPercent, fallbackSlide.leftWidthPercent))));
      const rightWidthPercent = 100 - leftWidthPercent;
      return {
        id: asString(row.id, `hero-${indexKey + 1}`),
        image: resolveManagerImage(row.image, fallbackImage),
        fallbackImage,
        rightPanelBackgroundMode,
        rightPanelBackgroundImage: resolveManagerImage(row.rightPanelBackgroundImage, ''),
        textVerticalAlign,
        leftWidthPercent,
        rightWidthPercent,
        titleA: split.titleA || HERO[indexKey % HERO.length]?.titleA || 'WEAR',
        titleB: split.titleB || HERO[indexKey % HERO.length]?.titleB || 'THE STORY OF AFRICA',
        lineA: asString(row.text, HERO[indexKey % HERO.length]?.lineA || ''),
        lineB: asString(row.description, HERO[indexKey % HERO.length]?.lineB || ''),
        primaryCtaText: asString(row.primaryCtaText, HERO[indexKey % HERO.length]?.primaryCtaText || 'SHOP NOW'),
        primaryCtaHref: normalizeHref(
          row.primaryCtaLink,
          HERO[indexKey % HERO.length]?.primaryCtaHref || '/ready-to-wear'
        ),
        primaryCtaStyle: row.primaryCtaStyle,
        primaryCtaEnabled: asBoolean(row.primaryCtaEnabled, true),
        secondaryCtaText: asString(
          row.secondaryCtaText,
          HERO[indexKey % HERO.length]?.secondaryCtaText || 'EXPLORE DESIGNERS'
        ),
        secondaryCtaHref: normalizeHref(row.secondaryCtaLink, HERO[indexKey % HERO.length]?.secondaryCtaHref || '/custom'),
        secondaryCtaStyle: row.secondaryCtaStyle,
        secondaryCtaEnabled: asBoolean(row.secondaryCtaEnabled, true),
        tertiaryCtaText: asString(
          row.tertiaryCtaText,
          HERO[indexKey % HERO.length]?.tertiaryCtaText || 'SHOP FABRICS'
        ),
        tertiaryCtaHref: normalizeHref(row.tertiaryCtaLink, HERO[indexKey % HERO.length]?.tertiaryCtaHref || '/fabrics'),
        tertiaryCtaStyle: row.tertiaryCtaStyle,
        tertiaryCtaEnabled: asBoolean(row.tertiaryCtaEnabled, true),
      } as HeroSlide;
    });
    return mapped.length > 0 ? mapped : HERO;
  }, [topNavigationsCfg.heroBanners]);
  const active = useMemo(() => heroSlides[index] || heroSlides[0] || HERO[0], [heroSlides, index]);
  const showHeroSection = isSectionVisible('TOP_NAVIGATIONS') || heroSlides.length > 0;

  const categorySections = useMemo(() => {
    const rows = asArray(categoryManageCfg.sections)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    return rows.length > 0 ? rows : [];
  }, [categoryManageCfg.sections]);

  const enabledShopByTabs = useMemo(() => {
    const allowed: ShopByTab[] = ['CATEGORY', 'COUNTRY', 'STYLE', 'PRICE'];
    const rows = asArray(shopByCfg.enabledTabs)
      .map((entry) => String(entry || '').trim().toUpperCase())
      .map((token) => (token === 'OCCASION_STYLE' ? 'STYLE' : token))
      .filter((token): token is ShopByTab => allowed.includes(token as ShopByTab));
    const deduped = Array.from(new Set(rows));
    return deduped.length > 0 ? deduped : allowed;
  }, [shopByCfg.enabledTabs]);
  const defaultShopByTab = useMemo(() => {
    const token = String(shopByCfg.defaultTab || '').trim().toUpperCase();
    const normalized = token === 'OCCASION_STYLE' ? 'STYLE' : token;
    if (enabledShopByTabs.includes(normalized as ShopByTab)) return normalized as ShopByTab;
    return enabledShopByTabs[0] || 'CATEGORY';
  }, [enabledShopByTabs, shopByCfg.defaultTab]);

  const shopByCategoryCards = useMemo(() => {
    const rows = asArray(shopByCfg.categories)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return SHOP_BY_CATEGORY;
    const mapped = rows.map((row, idx) => {
      const key = asString(row.key, '').toUpperCase();
      return {
        id: asString(row.id, `shop-cat-${idx + 1}`),
        title: asString(row.title, key || `Category ${idx + 1}`).toUpperCase(),
        subtitle: asString(row.description, ''),
        meta: `${Math.max(0, Math.round(asNumber(row.staticProductCount, 0)))} products`,
        href: normalizeHref(row.href, DEFAULT_HREF_BY_KEY[key] || '/ready-to-wear', key),
        image: asString(row.image, CATEGORY_IMAGE_BY_KEY[key] || `${ASSET_BASE}/featured_rw_left.jpg`),
        Icon: iconFromKey(row.icon, ShoppingBag),
      };
    });
    return mapped.length > 0 ? mapped : SHOP_BY_CATEGORY;
  }, [shopByCfg.categories]);

  const shopByStyleCards = useMemo(() => {
    const rows = asArray(shopByCfg.styleCards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return SHOP_BY_STYLE;
    return rows.map((row) => ({
      name: asString(row.title, 'Style'),
      sub: asString(row.description, ''),
      href: normalizeHref(row.href, '/ready-to-wear'),
      Icon: iconFromKey(row.icon, CalendarDays),
      titleFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.titleFontSize, 15)))),
      descriptionFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.descriptionFontSize, 14)))),
    }));
  }, [shopByCfg.styleCards]);

  const shopByPriceCards = useMemo(() => {
    const rows = asArray(shopByCfg.priceCards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return SHOP_BY_PRICE;
    return rows.map((row) => ({
      range: asString(row.priceLabel, asString(row.title, '$0 - $100')),
      sub: asString(row.description, ''),
      href: normalizeHref(row.href, '/ready-to-wear'),
      Icon: iconFromKey(row.icon, Tag),
      titleFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.titleFontSize, 24)))),
      descriptionFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.descriptionFontSize, 14)))),
    }));
  }, [shopByCfg.priceCards]);

  const shopByCountriesData = useMemo(() => {
    const baselineByName = new Map(SHOP_BY_COUNTRY.map((row) => [row.name.toLowerCase(), row]));
    const rows = asArray(shopByCfg.countries)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return SHOP_BY_COUNTRY;
    const mapped = rows.map((row) => {
      const name = asString(row.name, 'Country');
      const baseline = baselineByName.get(name.toLowerCase());
      const code = asString(row.code, baseline?.flag || '').toLowerCase();
      return {
        name,
        count: Math.max(0, Math.round(asNumber(row.staticProductCount, baseline?.count || 0))),
        textiles: baseline?.textiles || 'African Textiles',
        flag: code || baseline?.flag || 'ng',
      };
    });
    return mapped.length > 0 ? mapped : SHOP_BY_COUNTRY;
  }, [shopByCfg.countries]);
  const countryShowcaseData = useMemo(() => {
    const regionByName = new Map(AFRICAN_COUNTRIES_54.map((row) => [row.name.toLowerCase(), row.region]));
    return shopByCountriesData.map((row) => ({
      name: row.name,
      flag: row.flag,
      region: regionByName.get(row.name.toLowerCase()) || 'WEST',
    })) as Array<{ name: string; flag: string; region: Exclude<CountryRegion, 'ALL'> }>;
  }, [shopByCountriesData]);

  const sectionsRtwFtbCtw = useMemo(() => {
    if (categorySections.length === 0) return RTW_FTB_CTW_SECTIONS;
    const mapped = categorySections.map((entry, idx) => {
      const key = asString(entry.key, '').toUpperCase();
      const matchingCategory = shopByCategoryCards.find((row) => row.title.includes(key) || row.id.toUpperCase().includes(key));
      return {
        id: asString(entry.id, `cat-${idx + 1}`),
        key,
        sectionName: asString(entry.tag, asString(entry.title, key || 'CATEGORY')).toUpperCase(),
        title: asString(entry.title, key || 'Category').toUpperCase(),
        description: asString(entry.description, ''),
        cta: asString(entry.ctaText, FEATURED_CTA_BY_KEY[key] || 'SHOP NOW').toUpperCase(),
        href: normalizeHref(entry.ctaLink, FEATURED_HREF_BY_KEY[key] || '/ready-to-wear', key),
        ctaStyle: entry.ctaStyle,
        image: matchingCategory?.image || CATEGORY_IMAGE_BY_KEY[key] || `${ASSET_BASE}/rw_full.jpg`,
        textOnLeft: CATEGORY_TEXT_LEFT_BY_KEY[key] ?? (idx % 2 === 1),
        panelBg: CATEGORY_PANEL_BG_BY_KEY[key] || 'bg-[#111]',
      };
    });
    const source = mapped.length > 0 ? mapped : RTW_FTB_CTW_SECTIONS;
    const orderedKeys = ['RTW', 'FTB', 'CTW'];
    const orderedSections = source
      .slice()
      .sort((a, b) => {
        const left = orderedKeys.indexOf(String(a.key || '').toUpperCase());
        const right = orderedKeys.indexOf(String(b.key || '').toUpperCase());
        const leftRank = left === -1 ? Number.MAX_SAFE_INTEGER : left;
        const rightRank = right === -1 ? Number.MAX_SAFE_INTEGER : right;
        return leftRank - rightRank;
      });
    return orderedSections;
  }, [categorySections, shopByCategoryCards]);

  const featuredCardsByKey = useMemo(() => {
    const defaults = {
      RTW: FEATURED_RTW,
      CTW: FEATURED_CTW,
      FTB: FEATURED_FTB,
    };
    const rows = asArray(featuredCfg.cards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return defaults;
    const grouped: Record<'RTW' | 'CTW' | 'FTB', FeaturedTile[]> = {
      RTW: [],
      CTW: [],
      FTB: [],
    };
    rows.forEach((row, idx) => {
      const key = asString(row.key, '').toUpperCase();
      if (key !== 'RTW' && key !== 'CTW' && key !== 'FTB') return;
      grouped[key].push({
        id: asString(row.id, `${key.toLowerCase()}-${idx + 1}`),
        image: asString(row.image, defaults[key][0]?.image || `${ASSET_BASE}/product4.jpg`),
        title: asString(row.title, defaults[key][0]?.title || ''),
        subtitle: asString(row.description, defaults[key][0]?.subtitle || ''),
        href: normalizeHref(row.ctaLink, FEATURED_HREF_BY_KEY[key] || '/ready-to-wear', key),
        tag: asString(row.tag, FEATURED_LABEL_BY_KEY[key] || ''),
        cta: asString(row.ctaText, FEATURED_CTA_BY_KEY[key] || 'SHOP NOW').toUpperCase(),
        ctaStyle: row.ctaStyle,
      });
    });
    return {
      RTW: grouped.RTW.length > 0 ? grouped.RTW : defaults.RTW.map((row) => ({ ...row, tag: FEATURED_LABEL_BY_KEY.RTW, cta: FEATURED_CTA_BY_KEY.RTW })),
      CTW: grouped.CTW.length > 0 ? grouped.CTW : defaults.CTW.map((row) => ({ ...row, tag: FEATURED_LABEL_BY_KEY.CTW, cta: FEATURED_CTA_BY_KEY.CTW })),
      FTB: grouped.FTB.length > 0 ? grouped.FTB : defaults.FTB.map((row) => ({ ...row, tag: FEATURED_LABEL_BY_KEY.FTB, cta: FEATURED_CTA_BY_KEY.FTB })),
    };
  }, [featuredCfg.cards]);

  const sectionHrefForCountry = (sectionKey: unknown) => {
    const categoryToken = categoryTokenFromSectionKey(sectionKey);
    if (categoryToken === 'ALL') return '/ready-to-wear';
    return buildCountryProductsHref('Nigeria', categoryToken);
  };
  const orderedSectionsRtwFtbCtw = useMemo(() => [...sectionsRtwFtbCtw], [sectionsRtwFtbCtw]);

  const featuredHrefForCountry = (key: 'RTW' | 'CTW' | 'FTB') => {
    const categoryToken = categoryTokenFromSectionKey(key);
    if (categoryToken === 'ALL') return '/ready-to-wear';
    return buildCountryProductsHref('Nigeria', categoryToken);
  };

  const freshDropsCards = useMemo(() => {
    const rows = Math.max(1, Math.round(asNumber(freshDropsCfg.rows, 2)));
    const cols = Math.max(1, Math.round(asNumber(freshDropsCfg.columns, 4)));
    return FRESH_DROPS.slice(0, rows * cols);
  }, [freshDropsCfg.columns, freshDropsCfg.rows]);

  const spotlightCards = useMemo(() => {
    const rows = Math.max(1, Math.round(asNumber(designerSpotlightCfg.rows, 1)));
    const cols = Math.max(1, Math.round(asNumber(designerSpotlightCfg.columns, 3)));
    const maxItems = rows * cols;
    const entries = asArray(designerSpotlightCfg.cards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
      .map((entry, idx) => ({
        id: asString(entry.id, `spot-${idx + 1}`),
        image: asString(entry.image, DESIGNER_SPOTLIGHT[idx % DESIGNER_SPOTLIGHT.length]?.image || `${ASSET_BASE}/designer_spotlight.jpg`),
        title: asString(entry.title, DESIGNER_SPOTLIGHT[idx % DESIGNER_SPOTLIGHT.length]?.title || 'Designer Spotlight'),
        description: asString(entry.description, DESIGNER_SPOTLIGHT[idx % DESIGNER_SPOTLIGHT.length]?.description || ''),
        cta: asString(entry.ctaText, DESIGNER_SPOTLIGHT[idx % DESIGNER_SPOTLIGHT.length]?.cta || 'VIEW DESIGNER').toUpperCase(),
        href: normalizeHref(entry.ctaLink, DESIGNER_SPOTLIGHT[idx % DESIGNER_SPOTLIGHT.length]?.href || '/custom'),
        tag: asString(entry.tag, 'Designer Spotlight'),
        ctaStyle: entry.ctaStyle,
      }));
    const source = entries.length > 0 ? entries : DESIGNER_SPOTLIGHT.map((row) => ({ ...row, tag: 'Designer Spotlight' }));
    return source.slice(0, maxItems);
  }, [designerSpotlightCfg.cards, designerSpotlightCfg.columns, designerSpotlightCfg.rows]);

  const howItWorksCards = useMemo(() => {
    const allRows = asArray(textIconCfg.cards).map((entry) => asRecord(entry));
    const rows = asArray(textIconCfg.cards)
      .map((entry) => asRecord(entry))
      .filter((entry) => {
        if (!asBoolean(entry.enabled, true)) return false;
        const token = asString(entry.sectionType, '').toUpperCase();
        return token === 'HOW_IT_WORKS' || token === 'CUSTOM';
      })
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
      .map((entry) => ({
        title: asString(entry.title, 'Step').toUpperCase(),
        sub: asString(entry.description, ''),
        Icon: iconFromKey(entry.icon, Sparkles),
      }));
    if (rows.length > 0) return rows;
    return allRows.length > 0 ? [] : HOW_IT_WORKS;
  }, [textIconCfg.cards]);

  const trustCards = useMemo(() => {
    const allRows = asArray(textIconCfg.cards).map((entry) => asRecord(entry));
    const rows = asArray(textIconCfg.cards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true) && asString(entry.sectionType, '').toUpperCase() === 'SHOP_WITH_CONFIDENCE')
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
      .map((entry) => ({
        label: asString(entry.title, 'Trust').toUpperCase(),
        sub: asString(entry.description, ''),
        Icon: iconFromKey(entry.icon, ShieldCheck),
      }));
    if (rows.length > 0) return rows;
    return allRows.length > 0 ? [] : trust;
  }, [textIconCfg.cards]);
  const showHowItWorksSection = isSectionVisible('HOW_IT_WORKS') && howItWorksCards.length > 0;
  const showTrustSection = isSectionVisible('SHOP_WITH_CONFIDENCE') && trustCards.length > 0;

  const heritageStats = useMemo(() => {
    const rows = asArray(heritageCfg.stats)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
      .map((entry, idx) => ({
        id: asString(entry.id, `heritage-stat-${idx + 1}`),
        label: asString(entry.label, 'Metric').toUpperCase(),
        value: asString(entry.value, '0'),
        suffix: asString(entry.suffix, ''),
        positionX: Math.max(0, Math.min(100, Math.round(asNumber(entry.positionX, 12 + idx * 22)))),
        positionY: Math.max(0, Math.min(100, Math.round(asNumber(entry.positionY, 76)))),
      }));
    return rows.length > 0
      ? rows
      : [
          { id: 'stat-1', label: 'COUNTRIES', value: '120', suffix: '+', positionX: 12, positionY: 76 },
          { id: 'stat-2', label: 'DESIGNERS', value: '50K', suffix: '+', positionX: 35, positionY: 76 },
          { id: 'stat-3', label: 'FABRICS', value: '1M', suffix: '+', positionX: 58, positionY: 76 },
        ];
  }, [heritageCfg.stats]);

  const newsletterCfg = useMemo(() => asRecord(newsletterFooterCfg.newsletter), [newsletterFooterCfg.newsletter]);
  const footerCfg = useMemo(() => asRecord(newsletterFooterCfg.footer), [newsletterFooterCfg.footer]);
  const footerLinkGroups = useMemo(() => {
    const rows = asArray(footerCfg.linkGroups)
      .map((entry) => asRecord(entry))
      .map((entry, idx) => ({
        id: asString(entry.id, `group-${idx + 1}`),
        title: asString(entry.title, `Group ${idx + 1}`),
        links: asArray(entry.links)
          .map((link) => asRecord(link))
          .filter((link) => asBoolean(link.enabled, true))
          .map((link, linkIndex) => ({
            id: asString(link.id, `link-${idx + 1}-${linkIndex + 1}`),
            label: asString(link.label, 'Link'),
            href: normalizeHref(link.href, '/'),
          })),
      }))
      .filter((entry) => entry.links.length > 0);
    return rows.length > 0
      ? rows
      : [
          {
            id: 'fallback-shop',
            title: 'Shop',
            links: [
              { id: 'fallback-rtw', label: 'Ready To Wear', href: '/ready-to-wear' },
              { id: 'fallback-ctw', label: 'Custom To Wear', href: '/custom' },
              { id: 'fallback-ftb', label: 'Fabrics', href: '/fabrics' },
            ],
          },
        ];
  }, [footerCfg.linkGroups]);
  const footerSocialLinks = useMemo(
    () =>
      asArray(footerCfg.socialLinks)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry, idx) => ({
          id: asString(entry.id, `social-${idx + 1}`),
          label: asString(entry.label, 'Social'),
          icon: asString(entry.icon, asString(entry.label, 'Instagram')),
          href: normalizeHref(entry.href, 'https://instagram.com'),
        })),
    [footerCfg.socialLinks]
  );
  const footerPolicyLinks = useMemo(
    () =>
      asArray(footerCfg.policyLinks)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry, idx) => ({
          id: asString(entry.id, `policy-${idx + 1}`),
          label: asString(entry.label, 'Policy'),
          href: normalizeHref(entry.href, '/'),
        })),
    [footerCfg.policyLinks]
  );
  const shopByTabs = useMemo(
    () => SHOP_BY_TAB_META.filter((tab) => enabledShopByTabs.includes(tab.key)),
    [enabledShopByTabs]
  );
  const shopBySectionTag = asString(shopByCfg.sectionTag, 'Discover');
  const shopBySectionTitle = asString(shopByCfg.sectionTitle, 'Shop By');
  const shopBySectionDescription = asString(shopByCfg.sectionDescription, 'Browse by category, country, style, or budget.');
  const showShopBySectionDescription = asBoolean(shopByCfg.sectionDescriptionEnabled, true);
  const heroLeftColSpan = Math.max(3, Math.min(9, Math.round((active.leftWidthPercent / 100) * 12)));
  const heroRightColSpan = Math.max(3, 12 - heroLeftColSpan);
  const heroTextAlignClass =
    active.textVerticalAlign === 'TOP'
      ? 'items-start'
      : active.textVerticalAlign === 'BOTTOM'
        ? 'items-end'
        : 'items-center';
  const heroRightHasPanelImage = active.rightPanelBackgroundMode === 'IMAGE' && Boolean(active.rightPanelBackgroundImage);
  const footerBrandText = asString(footerCfg.brandText, logoTextRaw || 'ZURIKARIBU');
  const footerBrandSplit = useMemo(() => {
    const compact = footerBrandText.replace(/\s+/g, '').trim();
    if (!compact) return { left: 'ZURI', right: 'KARIBU' };
    const pivot = Math.max(1, Math.ceil(compact.length / 2));
    return {
      left: compact.slice(0, pivot),
      right: compact.slice(pivot),
    };
  }, [footerBrandText]);

  const filteredCountryShowcase = useMemo(
    () => countryShowcaseData.filter((country) => countryRegion === 'ALL' || country.region === countryRegion),
    [countryRegion, countryShowcaseData]
  );
  const countryRegionCounts = useMemo(() => {
    return COUNTRY_REGION_OPTIONS.reduce<Record<CountryRegion, number>>(
      (acc, option) => {
        if (option.key === 'ALL') {
          acc.ALL = countryShowcaseData.length;
          return acc;
        }
        acc[option.key] = countryShowcaseData.filter((country) => country.region === option.key).length;
        return acc;
      },
      { ALL: countryShowcaseData.length, NORTH: 0, WEST: 0, CENTRAL: 0, EAST: 0, SOUTHERN: 0 }
    );
  }, [countryShowcaseData]);
  const fullShopByCountries = useMemo(
    () => shopByCountriesData.slice(0, Math.max(ALL_COUNTRIES_COUNT, shopByCountriesData.length)),
    [shopByCountriesData]
  );
  const fullDedicatedCountries = useMemo(
    () => countryShowcaseData.slice(0, Math.max(ALL_COUNTRIES_COUNT, countryShowcaseData.length)),
    [countryShowcaseData]
  );
  const visibleShopByCountries = useMemo(() => {
    if (shopByCountryExpanded) return fullShopByCountries;
    return fullShopByCountries.slice(0, 12);
  }, [fullShopByCountries, shopByCountryExpanded]);
  const visibleDedicatedCountries = useMemo(
    () => (dedicatedCountryExpanded ? fullDedicatedCountries : filteredCountryShowcase.slice(0, 12)),
    [dedicatedCountryExpanded, filteredCountryShowcase, fullDedicatedCountries]
  );
  const resolvedThemeMode = useMemo<'LIGHT' | 'DARK'>(() => {
    const token = asString(themeCfg.mode, 'LIGHT').toUpperCase();
    if (token === 'DARK') return 'DARK';
    if (token === 'SYSTEM' && typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT';
    }
    return 'LIGHT';
  }, [themeCfg.mode]);
  const ComputedThemeIcon = themeMode === 'DARK' ? Moon : ThemeIcon;

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      try {
        const response = await api.jenksV2Frontpage.getPublicConfig();
        if (!cancelled && response.success && response.data) {
          setManagerConfig(response.data as JenksV2ManagerPayload);
        }
      } catch {
        if (!cancelled) {
          setManagerConfig(null);
        }
      }
    };
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (enabledShopByTabs.length === 0) return;
    if (!enabledShopByTabs.includes(shopByTab)) {
      setShopByTab(defaultShopByTab);
    }
  }, [defaultShopByTab, enabledShopByTabs, shopByTab]);

  useEffect(() => {
    if (heroSlides.length === 0) return;
    const timer = window.setInterval(() => setIndex((p) => (p + 1) % heroSlides.length), 7000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    if (index < heroSlides.length) return;
    setIndex(0);
  }, [heroSlides.length, index]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-kimi-anim]'));
    if (nodes.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
    );
    nodes.forEach((node, idx) => {
      node.style.transitionDelay = `${Math.min(idx % 6, 5) * 60}ms`;
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hamburgerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHamburgerOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hamburgerOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [searchOpen]);

  useEffect(() => {
    setThemeMode(resolvedThemeMode);
  }, [resolvedThemeMode]);

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const root = document.documentElement;
    const body = document.body;
    const isDark = themeMode === 'DARK';
    root.classList.toggle('dark', isDark);
    body.style.backgroundColor = isDark ? '#090b10' : '#f5f3ee';
    body.style.color = isDark ? '#f5f3ee' : '#111111';
    return () => {
      root.classList.remove('dark');
      body.style.backgroundColor = '';
      body.style.color = '';
    };
  }, [themeMode]);

  return (
    <div className="kimi-site flex flex-col bg-[#f5f3ee] text-[#111]">
      {/* TOP STRIP + TOP NAVIGATION */}
      {isSectionVisible('TOP_NAVIGATIONS') ? (
        <div className="sticky top-0 z-50" style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}>
          {asBoolean(topNavigationsCfg.topStripEnabled, true) ? (
            <div className="h-8 bg-black text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <div className="mx-auto flex h-full w-full max-w-[1700px] items-center justify-center px-4">
                Made by Africans. Worn by the world.
              </div>
            </div>
          ) : null}
          <header className="h-14 border-b border-black/10 bg-[#f5f3ee]/95 backdrop-blur">
            <div className="relative mx-auto flex h-full w-full max-w-[1700px] items-center justify-between px-4 sm:px-6 lg:px-12">
              <div className="flex items-center gap-3 text-black/75">
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-sm transition-colors hover:bg-[#e66045]"
                  aria-label="Open menu"
                  onClick={() => setHamburgerOpen(true)}
                >
                  <Menu className="h-5 w-5 stroke-[2.75]" />
                </button>
                {asBoolean(topNavigationsCfg.searchIconEnabled, true) ? (
                  <button
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 hover:bg-black/5"
                    aria-label="Search"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <div className="absolute left-1/2 -translate-x-1/2">
                {asString(logoCfg.mode, 'TEXT').toUpperCase() === 'IMAGE' && asString(logoCfg.imageUrl, '') ? (
                  <img
                    src={asString(logoCfg.imageUrl, '')}
                    alt={asString(logoCfg.altText, 'Jenks')}
                    className="object-contain"
                    style={{
                      width: Math.max(80, Math.round(asNumber(logoCfg.width, 180))),
                      height: Math.max(24, Math.round(asNumber(logoCfg.height, 50))),
                    }}
                  />
                ) : (
                  <p
                    className="font-['Oswald'] font-semibold uppercase leading-none tracking-[0.08em]"
                    style={{
                      color: asString(logoCfg.textColor, '#111111'),
                      fontFamily: asString(logoCfg.fontFamily, 'Oswald'),
                      fontSize: Math.max(18, Math.round(asNumber(logoCfg.fontSize, 27))),
                    }}
                  >
                    <span>{logoTextSplit.left}</span>
                    <span className="text-[#e66045]">{logoTextSplit.right}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center gap-3 text-black/75">
                <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 md:flex">
                  {(additionalTopMenuLinks.length > 0
                    ? additionalTopMenuLinks
                    : [
                        { label: 'About Us', href: '/about' },
                        { label: 'Contact Us', href: '/contact' },
                      ]
                  ).map((link) => (
                    <Link key={`${link.label}-${link.href}`} to={toSafeInternalHref(link.href)} className="hover:text-black">
                      {link.label}
                    </Link>
                  ))}
                </div>
                {asBoolean(themeCfg.enabled, true) ? (
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20"
                    aria-label="Toggle theme"
                    onClick={() => setThemeMode((prev) => (prev === 'LIGHT' ? 'DARK' : 'LIGHT'))}
                  >
                    {ComputedThemeIcon ? (
                      <ComputedThemeIcon className="h-4 w-4 text-[#e66045]" />
                    ) : (
                      <Sun className="h-4 w-4 text-[#e66045]" />
                    )}
                  </button>
                ) : null}
                <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Cart">
                  <ShoppingBag className="h-4 w-4" />
                  <span className="absolute right-0 top-0 h-3.5 min-w-3.5 rounded-full bg-[#e66045] px-1 text-[9px] font-semibold leading-[14px] text-white">
                    0
                  </span>
                </button>
                {asBoolean(signInCfg.enabled, true) ? (
                  <Link
                    to={toSafeInternalHref(normalizeHref(signInCfg.href, '/auth/login', signInCfg.routeKey))}
                    className="hidden text-xs font-semibold uppercase tracking-[0.12em] hover:text-black sm:inline"
                  >
                    {asString(signInCfg.label, 'Sign In')}
                  </Link>
                ) : null}
              </div>
            </div>
          </header>
          {searchOpen ? (
            <div className="fixed inset-0 z-[69]">
              <button
                type="button"
                aria-label="Close search overlay"
                className="absolute inset-0 h-full w-full bg-black/50"
                onClick={() => setSearchOpen(false)}
              />
              <div className="absolute left-1/2 top-16 w-[94vw] max-w-[860px] -translate-x-1/2 rounded-xl border border-white/20 bg-[#0d1016] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.45)] sm:p-5">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-white/70" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search products, categories, countries..."
                    className="h-10 w-full bg-transparent text-sm text-white placeholder:text-white/45 focus:outline-none"
                  />
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-white/20 text-white hover:bg-white/10"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    aria-label="Close search"
                  >
                    ×
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  {['Ready To Wear', 'Custom To Wear', 'Fabrics', 'Shop By Country'].map((suggestion) => (
                    <Link
                      key={suggestion}
                      to={toSafeInternalHref(
                        suggestion === 'Ready To Wear'
                          ? '/ready-to-wear'
                          : suggestion === 'Custom To Wear'
                            ? '/custom'
                            : suggestion === 'Fabrics'
                              ? '/fabrics'
                              : '/country-products'
                      )}
                      onClick={() => setSearchOpen(false)}
                      className="rounded border border-white/20 px-2.5 py-1 text-white/85 hover:border-[#e66045] hover:text-[#e66045]"
                    >
                      {suggestion}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          {hamburgerOpen ? (
            <div className="fixed inset-0 z-[70]">
              <button
                type="button"
                aria-label="Close menu overlay"
                className="absolute inset-0 h-full w-full bg-black/60"
                onClick={() => setHamburgerOpen(false)}
              />
              <div className="absolute left-0 top-0 h-full w-[92vw] max-w-[420px] overflow-y-auto border-r border-white/20 bg-black/96 shadow-[0_20px_80px_rgba(0,0,0,0.55)]">
                <button
                  type="button"
                  className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                  aria-label="Close menu"
                  onClick={() => setHamburgerOpen(false)}
                >
                  <span className="text-xl leading-none">×</span>
                </button>
                <nav className="flex h-full w-full items-start overflow-y-auto px-6 pt-20 sm:px-8">
                  <div className="w-full space-y-2 pb-8">
                    {(hamburgerMenuLinks.length > 0
                      ? hamburgerMenuLinks
                      : [
                          { label: 'Home', href: '/' },
                          { label: 'Shop', href: '/ready-to-wear' },
                          { label: 'Ready To Wear', href: '/ready-to-wear' },
                          { label: 'Fabrics To Buy', href: '/fabrics' },
                          { label: 'Custom To Wear', href: '/custom' },
                          { label: 'Designers', href: '/designers' },
                          { label: 'About Us', href: '/about' },
                          { label: 'Contact Us', href: '/contact' },
                        ]
                    ).map((link) => (
                      <Link
                        key={`${link.label}-${link.href}`}
                        to={toSafeInternalHref(link.href)}
                        className="block rounded border border-white/10 px-4 py-3 font-['Oswald'] text-2xl font-bold uppercase leading-none tracking-[0.01em] text-white transition-colors hover:border-[#e66045] hover:text-[#e66045] sm:text-3xl"
                        onClick={() => setHamburgerOpen(false)}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <p className="pt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
                      Made by Africans. Worn by the world.
                    </p>
                  </div>
                </nav>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* HERO */}
      {showHeroSection ? (
      <section className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 lg:grid-cols-12`} style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}>
        <div className="relative lg:col-span-7" style={{ gridColumn: `span ${heroLeftColSpan} / span ${heroLeftColSpan}` }}>
          {heroSlides.map((slide, i) => (
            <img
              key={slide.id}
              src={slide.image}
              alt={slide.titleA}
              onError={(event) => {
                if (event.currentTarget.src !== slide.fallbackImage) {
                  event.currentTarget.src = slide.fallbackImage;
                }
              }}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${
                i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
              }`}
            />
          ))}
        </div>
        <div
          className={`relative flex ${heroTextAlignClass} px-5 py-10 lg:px-8 xl:px-10`}
          style={{
            gridColumn: `span ${heroRightColSpan} / span ${heroRightColSpan}`,
            backgroundColor: '#f5f3ee',
            backgroundImage: heroRightHasPanelImage ? `url(${active.rightPanelBackgroundImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {heroRightHasPanelImage ? <div className="absolute inset-0 bg-[#f5f3ee]/68" /> : null}
          <div className="relative max-w-[540px] pr-1 sm:pr-2 animate-fade-in" data-kimi-anim="fade-up">
            <h1 className="font-['Oswald'] text-[58px] font-bold uppercase leading-[0.9] sm:text-[72px]">
              <span>{active.titleA}</span>
              <span className="ml-[0.16em] text-[#e66045]">{active.titleB}</span>
            </h1>
            <p className="mt-6 text-[16px] font-light leading-[1.35] text-black/84 sm:text-[18px]">{active.lineA}</p>
            <p className="mt-4 text-sm text-black/55">{active.lineB}</p>
            <div className="mt-6 flex flex-wrap items-center gap-1.5">
              {active.primaryCtaEnabled ? (
                <Link
                  to={toSafeInternalHref(active.primaryCtaHref)}
                  style={buildCTAStyle(active.primaryCtaStyle, DEFAULT_SOLID_CTA_STYLE)}
                  onMouseEnter={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.primaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, true)
                  }
                  onMouseLeave={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.primaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, false)
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {active.primaryCtaText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {active.secondaryCtaEnabled ? (
                <Link
                  to={toSafeInternalHref(active.secondaryCtaHref)}
                  style={buildCTAStyle(active.secondaryCtaStyle, DEFAULT_SOLID_CTA_STYLE)}
                  onMouseEnter={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.secondaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, true)
                  }
                  onMouseLeave={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.secondaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, false)
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
                >
                  <Heart className="h-3.5 w-3.5" />
                  {active.secondaryCtaText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
              {active.tertiaryCtaEnabled ? (
                <Link
                  to={toSafeInternalHref(active.tertiaryCtaHref)}
                  style={buildCTAStyle(active.tertiaryCtaStyle, DEFAULT_SOLID_CTA_STYLE)}
                  onMouseEnter={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.tertiaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, true)
                  }
                  onMouseLeave={(event) =>
                    applyHeroCtaHoverState(event.currentTarget, active.tertiaryCtaStyle, DEFAULT_SOLID_CTA_STYLE, false)
                  }
                  className="inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white"
                >
                  <ShoppingBag className="h-3.5 w-3.5" />
                  {active.tertiaryCtaText}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {/* SHOP BY */}
      {isSectionVisible('SHOP_BY') ? (
        <section className="bg-[#07090d] py-14 lg:py-16" data-kimi-anim="fade-up" style={{ order: getSectionOrder('SHOP_BY') }}>
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">{shopBySectionTag}</p>
            <h2 className="mt-2 text-center font-['Oswald'] text-6xl font-bold uppercase leading-none text-white">{shopBySectionTitle}</h2>
            {showShopBySectionDescription ? (
              <p className="mt-3 text-center text-base text-white/60">{shopBySectionDescription}</p>
            ) : null}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {shopByTabs.map((tab) => {
                const isActive = shopByTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setShopByTab(tab.key)}
                    className={`inline-flex items-center gap-2 border px-5 py-3 text-sm font-medium transition-colors ${
                      isActive
                        ? 'border-white bg-white text-[#111]'
                        : 'border-white/15 bg-white/[0.06] text-white/85 hover:border-white/35'
                    }`}
                  >
                    <tab.Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {shopByTab === 'CATEGORY' ? (
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
                {shopByCategoryCards.map((card) => (
                  <Link key={card.id} to={toSafeInternalHref(card.href)} className="group relative overflow-hidden border border-white/10">
                    <img
                      src={card.image}
                      alt={card.title}
                      className="h-[82vh] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute right-4 top-4 text-white/50 transition-colors group-hover:text-white">
                      <ArrowRight className="h-6 w-6" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                      <card.Icon className="h-5 w-5 text-white/90" />
                      <p className="mt-3 font-['Oswald'] text-4xl font-semibold uppercase leading-none">{card.title}</p>
                      <p className="mt-2 text-sm text-white/80">{card.subtitle}</p>
                      <p className="mt-2 text-sm font-medium text-white/75">{card.meta}</p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}

            {shopByTab === 'COUNTRY' ? (
              <div className="mt-10">
                <div className={shopByCountryExpanded ? 'grid grid-cols-2 gap-x-2 gap-y-2 md:grid-cols-4 lg:grid-cols-12' : 'grid grid-cols-12 gap-x-2 gap-y-0'}>
                  {visibleShopByCountries.map((country) => (
                    <Link
                      key={country.name}
                      to={buildCountryProductsHref(country.name, 'ALL')}
                      className="group flex flex-col items-center text-center text-white/78 transition-colors hover:text-[#e66045]"
                    >
                      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/[0.02] transition-colors group-hover:border-[#e66045]">
                        <img
                          src={`https://flagcdn.com/w80/${country.flag}.png`}
                          alt={`${country.name} flag`}
                          className="h-10 w-10 rounded-full border border-white/10 object-cover"
                          loading="lazy"
                        />
                      </span>
                      <p className="mt-2 text-[11px] font-medium text-white/92">
                        {country.name} - {country.count}
                      </p>
                      <p className="text-[10px] text-white/54 group-hover:text-[#e66045]/85">{country.textiles}</p>
                    </Link>
                  ))}
                </div>
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={() => setShopByCountryExpanded((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-xs font-normal text-white/85 hover:text-white"
                  >
                    {shopByCountryExpanded ? 'Show less countries' : `View all ${ALL_COUNTRIES_COUNT} countries`}
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : null}

            {shopByTab === 'STYLE' ? (
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {shopByStyleCards.map((styleItem) => (
                  <Link
                    key={styleItem.name}
                    to={toSafeInternalHref(styleItem.href)}
                    className="rounded border border-white/10 bg-white/[0.06] px-5 py-9 text-center transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_16px_34px_rgba(0,0,0,0.35)]"
                  >
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-[#e66045]">
                      <styleItem.Icon className="h-5 w-5" />
                    </div>
                    <p
                      className="mt-4 font-semibold uppercase tracking-[0.06em] text-white"
                      style={{ fontSize: `${styleItem.titleFontSize}px` }}
                    >
                      {styleItem.name}
                    </p>
                    <p className="mt-1 text-white/50" style={{ fontSize: `${styleItem.descriptionFontSize}px` }}>
                      {styleItem.sub}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}

            {shopByTab === 'PRICE' ? (
              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {shopByPriceCards.map((priceItem) => (
                  <Link
                    key={priceItem.range}
                    to={toSafeInternalHref(priceItem.href)}
                    className="rounded border border-white/10 bg-white/[0.06] px-5 py-7 text-center transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_16px_34px_rgba(0,0,0,0.35)]"
                  >
                    <div className="flex items-center justify-center gap-2 text-[#e66045]">
                      <priceItem.Icon className="h-4 w-4" />
                    </div>
                    <p className="mt-3 font-semibold text-white" style={{ fontSize: `${priceItem.titleFontSize}px` }}>
                      {priceItem.range}
                    </p>
                    <p className="mt-1 text-white/55" style={{ fontSize: `${priceItem.descriptionFontSize}px` }}>
                      {priceItem.sub}
                    </p>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* SHOP BY COUNTRY (DEDICATED) */}
      {isSectionVisible('SHOP_BY') ? (
        <section className="bg-[#06080b] py-12 lg:py-14" data-kimi-anim="fade-up" style={{ order: getSectionOrder('SHOP_BY') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">Discover</p>
              <h2 className="mt-2 font-['Oswald'] text-6xl font-bold uppercase leading-none text-white">SHOP BY COUNTRY</h2>
              <p className="mt-3 max-w-2xl text-base text-white/62">
                Explore traditional textiles and contemporary designs from across the African continent.
              </p>
            </div>
            <Link
              to={buildCountryProductsHref('Nigeria', 'ALL')}
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white lg:mt-10"
            >
              View All 54 Countries
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            {COUNTRY_REGION_OPTIONS.map((option) => {
              const isActive = countryRegion === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setCountryRegion(option.key)}
                  className={`border px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-white bg-white text-[#111]'
                      : 'border-white/10 bg-white/[0.02] text-white/75 hover:border-[#e66045] hover:text-[#e66045]'
                  }`}
                >
                  {option.label}
                  {option.key === 'ALL' ? '' : ` (${countryRegionCounts[option.key]})`}
                </button>
              );
            })}
          </div>

          <div className={dedicatedCountryExpanded ? 'mt-6 grid grid-cols-2 gap-x-2 gap-y-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12' : 'mt-6 grid grid-cols-12 gap-x-2 gap-y-0'}>
            {visibleDedicatedCountries.map((country) => (
              <Link
                key={country.name}
                to={buildCountryProductsHref(country.name, 'ALL')}
                className="group flex flex-col items-center px-1 py-2 text-center text-white/75 transition-colors hover:text-[#e66045]"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.02] transition-colors group-hover:border-[#e66045]">
                  <img
                    src={`https://flagcdn.com/w80/${country.flag}.png`}
                    alt={`${country.name} flag`}
                    className="h-10 w-10 rounded-full border border-white/8 object-cover"
                    loading="lazy"
                  />
                </span>
                <p className="mt-2 text-sm font-medium">{country.name}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => setDedicatedCountryExpanded((prev) => !prev)}
              className="inline-flex items-center gap-2 border border-white/18 bg-white/[0.05] px-6 py-3 text-[11px] text-white transition-colors hover:border-[#e66045] hover:text-[#e66045]"
            >
              {dedicatedCountryExpanded ? 'Show less countries' : `Show All ${ALL_COUNTRIES_COUNT} Countries`}
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>
        </section>
      ) : null}

      {/* RTW / FTB / CTW HERO-HEIGHT SPLIT */}
      {isSectionVisible('CATEGORY_MANAGE') ? (
      <section className="space-y-0" style={{ order: getSectionOrder('CATEGORY_MANAGE') }}>
        {orderedSectionsRtwFtbCtw.map((section) => (
          <div
            key={section.id}
            className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 ${
              section.textOnLeft ? 'md:grid-cols-[32%_68%]' : 'md:grid-cols-[68%_32%]'
            }`}
          >
            {section.textOnLeft ? (
              <>
                <div className={`relative overflow-hidden px-8 py-12 text-white ${section.panelBg}`} data-kimi-anim="sidebar-left">
                  <div
                    className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center blur-2xl"
                    style={{ backgroundImage: `url(${section.image})`, opacity: 0.18 }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/70" />
                  <div className="relative flex h-full items-start">
                    <div className="flex h-full max-w-[560px] flex-col items-start justify-start text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">{section.sectionName}</p>
                      <h3 className="mt-5 font-['Oswald'] text-[54px] font-bold uppercase leading-[0.92] lg:text-[72px]">{section.title}</h3>
                      <p className="mt-5 max-w-[560px] text-base leading-relaxed text-white/74 sm:text-lg">{section.description}</p>
                    <Link
                      to={sectionHrefForCountry(section.key)}
                      style={buildCTAStyle(section.ctaStyle, DEFAULT_SOLID_CTA_STYLE)}
                      className="mt-9 inline-flex items-center px-0 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] hover:underline hover:decoration-[#d40000] underline-offset-[6px]"
                    >
                        {section.cta}
                    </Link>
                    </div>
                  </div>
                </div>
                <img src={section.image} alt={section.sectionName} className="h-full w-full object-cover" data-kimi-anim="zoom-in" />
              </>
            ) : (
              <>
                <img src={section.image} alt={section.sectionName} className="h-full w-full object-cover" data-kimi-anim="zoom-in" />
                <div className={`relative overflow-hidden px-8 py-12 text-white ${section.panelBg}`} data-kimi-anim="sidebar-right">
                  <div
                    className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center blur-2xl"
                    style={{ backgroundImage: `url(${section.image})`, opacity: 0.18 }}
                  />
                  <div className="pointer-events-none absolute inset-0 bg-black/70" />
                  <div className="relative flex h-full items-start">
                    <div className="flex h-full max-w-[560px] flex-col items-start justify-start text-left">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">{section.sectionName}</p>
                      <h3 className="mt-5 font-['Oswald'] text-[54px] font-bold uppercase leading-[0.92] lg:text-[72px]">{section.title}</h3>
                      <p className="mt-5 max-w-[560px] text-base leading-relaxed text-white/74 sm:text-lg">{section.description}</p>
                    <Link
                      to={sectionHrefForCountry(section.key)}
                      style={buildCTAStyle(section.ctaStyle, DEFAULT_SOLID_CTA_STYLE)}
                      className="mt-9 inline-flex items-center px-0 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] hover:underline hover:decoration-[#d40000] underline-offset-[6px]"
                    >
                        {section.cta}
                    </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </section>
      ) : null}

      {/* HOW IT WORKS */}
      {showHowItWorksSection ? (
      <section className="bg-white py-12" data-kimi-anim="fade-up" style={{ order: getSectionOrder('HOW_IT_WORKS') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <h2 className="font-['Oswald'] text-3xl font-bold uppercase">HOW IT WORKS</h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {howItWorksCards.map(({ title, sub, Icon }) => (
              <article key={title} className="flex flex-col items-center border border-black/10 bg-[#faf9f5] px-4 py-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-black/15 bg-white">
                  <Icon className="h-5 w-5 text-[#e66045]" />
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</p>
                <p className="mt-1 text-xs text-black/55">{sub}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* FEATURED RTW + CTW + FTB */}
      {isSectionVisible('FEATURED') ? (
        <section className="space-y-0" style={{ order: getSectionOrder('FEATURED') }}>
          {(['RTW', 'CTW', 'FTB'] as const).map((key) => (
            <div key={key} className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 gap-0 md:grid-cols-2`}>
              {featuredCardsByKey[key].map((card) => (
                <Link key={card.id} to={featuredHrefForCountry(key)} className="group relative overflow-hidden" data-kimi-anim="zoom-in">
                  <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <p className="absolute left-6 top-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/72">{card.tag}</p>
                  <div className="absolute bottom-[10%] right-6 max-w-[58%] text-right text-white">
                    <p className="font-['Oswald'] text-4xl font-bold uppercase leading-[0.95]">{card.title}</p>
                    <p className="mt-2 text-sm text-white/78">{card.subtitle}</p>
                    <span
                      className="mt-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.06em] text-white/92 hover:underline hover:decoration-[#d40000] underline-offset-[6px]"
                      style={buildCTAStyle(card.ctaStyle, DEFAULT_INLINE_CTA_STYLE)}
                    >
                      {card.cta}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </section>
      ) : null}

      {/* FRESH DROPS */}
      {isSectionVisible('FRESH_DROPS') ? (
      <section className="bg-[#f5f5f3] py-12" data-kimi-anim="fade-up" style={{ order: getSectionOrder('FRESH_DROPS') }}>
        <div className="w-full px-3 sm:px-4 lg:px-8 xl:px-10">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-['Oswald'] text-6xl font-bold uppercase leading-none">{asString(freshDropsCfg.title, 'FRESH DROPS')}</h2>
              <p className="mt-3 text-base text-black/65">{asString(freshDropsCfg.description, 'New arrivals from the most talented designers across the continent.')}</p>
            </div>
            <div className="hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={() => freshDropsStripRef.current?.scrollBy({ left: -340, behavior: 'smooth' })}
                className="inline-flex h-10 w-10 items-center justify-center border border-black/20 text-black/70 hover:border-black/50 hover:text-black"
                aria-label="Scroll fresh drops left"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => freshDropsStripRef.current?.scrollBy({ left: 340, behavior: 'smooth' })}
                className="inline-flex h-10 w-10 items-center justify-center border border-black/20 text-black/70 hover:border-black/50 hover:text-black"
                aria-label="Scroll fresh drops right"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div
            ref={freshDropsStripRef}
            className="mt-8 flex gap-4 overflow-x-auto pb-1 scrollbar-hide"
          >
            {freshDropsCards.map((drop) => (
              <article
                key={drop.id}
                className="group min-w-[312px] flex-1 overflow-hidden border border-black/10 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_18px_46px_rgba(0,0,0,0.2)] md:min-w-[calc((100%-24px)/4)]"
              >
                <div className="relative">
                  <img src={drop.image} alt={drop.name} className="h-[63vh] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="absolute left-4 top-4 bg-[#e66045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    NEW
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xl font-semibold">{drop.name}</p>
                  <p className="mt-1 text-sm text-black/60">{drop.brand}</p>
                  <p className="mt-2 text-xl font-semibold text-[#e66045]">{drop.price}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {/* SPOTLIGHT */}
      {isSectionVisible('DESIGNER_SPOTLIGHT') ? (
        <section className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 gap-0 bg-[#101010] md:grid-cols-3`} style={{ order: getSectionOrder('DESIGNER_SPOTLIGHT') }}>
          {spotlightCards.map((spot) => (
            <Link key={spot.id} to={toSafeInternalHref(spot.href)} className="group relative overflow-hidden" data-kimi-anim="zoom-in">
              <img src={spot.image} alt={spot.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">{spot.tag}</p>
                <h3 className="mt-3 font-['Oswald'] text-4xl font-bold uppercase leading-[0.95]">{spot.title}</h3>
                <p className="mt-3 text-sm text-white/78">{spot.description}</p>
                <span
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.08em] text-white hover:underline hover:decoration-[#d40000] underline-offset-[6px]"
                  style={buildCTAStyle(spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE)}
                >
                  {spot.cta}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </section>
      ) : null}

      {/* ROOTED IN CULTURE */}
      {isSectionVisible('HERITAGE') ? (
        <section className={`relative ${HERO_HEIGHT_CLASS}`} data-kimi-anim="fade-up" style={{ order: getSectionOrder('HERITAGE') }}>
          <img
            src={asString(heritageCfg.image, `${ASSET_BASE}/heritage_story.jpg`)}
            alt="heritage"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/42" />
          <div className="relative flex h-full flex-col justify-between px-8 py-10 text-white">
            <div className="self-end text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">{asString(heritageCfg.tag, 'Heritage')}</p>
              <h2 className="mt-2 font-['Oswald'] text-6xl font-bold uppercase leading-[0.92]">
                {asString(heritageCfg.title, 'ROOTED IN CULTURE.')}
              </h2>
              <p className="mt-4 max-w-xl text-base text-white/80">
                {asString(
                  heritageCfg.description,
                  "The world is yet to experience Africa's fashion. We're building the bridge connecting heritage craft to modern wardrobes everywhere."
                )}
              </p>
            </div>
            <div className="self-start pb-[14%]">
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 rounded border border-white/15 bg-black/28 px-5 py-4 backdrop-blur-[1px]">
                {heritageStats.map((stat) => (
                  <div key={stat.id} className="min-w-[120px]">
                    <p className="font-['Oswald'] text-5xl font-bold leading-none sm:text-6xl">
                      {stat.value}
                      {stat.suffix}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* TRUST */}
      {showTrustSection ? (
        <section className="bg-white py-16 lg:py-20" data-kimi-anim="fade-up" style={{ order: getSectionOrder('SHOP_WITH_CONFIDENCE') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <h2 className="text-center font-['Oswald'] text-4xl font-bold uppercase leading-none">SHOP WITH CONFIDENCE</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {trustCards.map((item) => (
              <article key={item.label} className="mt-8 flex flex-col items-center border border-black/10 bg-[#faf9f5] px-4 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_14px_28px_rgba(0,0,0,0.12)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-black/15 bg-white">
                  <item.Icon className="h-5 w-5 text-[#e66045]" />
                </div>
                <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                <p className="mt-2 text-xs text-black/55">{item.sub}</p>
              </article>
            ))}
          </div>
        </div>
        </section>
      ) : null}

      {/* NEWSLETTER */}
      {isSectionVisible('NEWSLETTER_FOOTER') && asBoolean(newsletterCfg.enabled, true) ? (
        <section className="bg-white py-24" data-kimi-anim="fade-up" style={{ order: getSectionOrder('NEWSLETTER_FOOTER') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h3 className="font-['Oswald'] text-4xl font-bold uppercase">{asString(newsletterCfg.title, 'JOIN THE MOVEMENT.')}</h3>
              <p className="mt-2 text-sm text-black/60">{asString(newsletterCfg.description, 'Subscribe for new arrivals and stories from the continent.')}</p>
            </div>
            <form className="flex gap-2" onSubmit={(event) => event.preventDefault()}>
              <input className="h-10 border border-black/20 px-3 text-sm outline-none" placeholder={asString(newsletterCfg.emailPlaceholder, 'Enter email')} />
              <button className="h-10 bg-[#e66045] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">{asString(newsletterCfg.submitLabel, 'Subscribe')}</button>
            </form>
          </div>
        </div>
        </section>
      ) : null}

      {/* FOOTER */}
      {isSectionVisible('NEWSLETTER_FOOTER') && asBoolean(footerCfg.enabled, true) ? (
        <footer className="bg-[#0a0a0a] py-12 text-white" style={{ order: getSectionOrder('NEWSLETTER_FOOTER') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            <div>
              <p className="font-['Oswald'] text-3xl uppercase tracking-[0.08em]">
                {footerBrandSplit.left}
                <span className="text-[#e66045]">{footerBrandSplit.right}</span>
              </p>
              <p className="mt-3 text-sm text-white/65">{asString(footerCfg.address, 'Made by Africans. Worn by the world.')}</p>
              <div className="mt-5 flex items-center gap-3 text-white/75">
                {footerSocialLinks.map((social) => {
                  const Icon = toSocialIcon(social.icon || social.label);
                  return (
                    <a key={social.id} href={social.href} className="hover:text-white" target="_blank" rel="noreferrer">
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            </div>

            {footerLinkGroups.slice(0, 2).map((group) => (
              <div key={group.id}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">{group.title}</p>
                <div className="mt-3 space-y-2 text-sm text-white/75">
                  {group.links.map((link) => (
                    <Link key={link.id} to={link.href} className="block hover:text-white">
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Contact</p>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> {asString(footerCfg.contactEmail, 'support@zurikaribu.com')}</p>
                <p className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> {asString(footerCfg.contactPhone, '+234 000 000 0000')}</p>
                <p className="pl-6 text-white/72">{asString(footerCfg.address, 'Lagos, Nigeria')}</p>
              </div>
            </div>
          </div>
          <div className="mt-10 border-t border-white/10 pt-5 text-xs text-white/50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span>{asString(footerCfg.copyright, `© ${new Date().getFullYear()} ZuriKaribu. All rights reserved.`)}</span>
              {footerPolicyLinks.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  {footerPolicyLinks.map((link) => (
                    <Link key={link.id} to={link.href} className="hover:text-white/80">
                      {link.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
        </footer>
      ) : null}
    </div>
  );
}

