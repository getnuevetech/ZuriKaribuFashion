import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Facebook,
  Globe,
  Headphones,
  Heart,
  Instagram,
  Loader2,
  Mail,
  Menu,
  Moon,
  Ruler,
  Palette,
  Phone,
  MapPin,
  RefreshCw,
  Scissors,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Sun,
  Tag,
  Truck,
  Twitter,
  Youtube,
} from 'lucide-react';
import BrandImageWithFallback from '../../components/BrandImageWithFallback';
import { Link, useNavigate } from 'react-router-dom';
import { publicApi as api, resolveAssetUrl } from '../../services/publicApi';
import { stripLegacyFallbackImage } from '../../utils/imageFallback';
import '../../styles/jenks-v2.css';

type HeroSlide = {
  id: string;
  layoutMode: 'SPLIT' | 'FULL';
  image: string;
  rightPanelBackgroundMode: 'NONE' | 'IMAGE';
  rightPanelBackgroundImage: string;
  textVerticalAlign: 'TOP' | 'MIDDLE' | 'BOTTOM';
  leftWidthPercent: number;
  rightWidthPercent: number;
  tag: string;
  tagColor: string;
  titleFontSize: number;
  titleColor: string;
  titleSecondaryColor: string;
  textEnabled: boolean;
  textColor: string;
  descriptionEnabled: boolean;
  descriptionFontSize: number;
  descriptionColor: string;
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
type InstantBuyCategoryKey = 'RTW' | 'FTB';
type InstantBuyFeatureTile = {
  id: string;
  categoryKey: InstantBuyCategoryKey;
  tag: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  ctaMode: CtaMode;
  ctaPageKey?: string;
  ctaStyle?: CTAStyle;
  image: string;
  showBadge: boolean;
  badgeText: string;
  enabled: boolean;
  displayOrder: number;
};
type InstantBuyProductTile = {
  id: string;
  categoryKey: InstantBuyCategoryKey;
  sourceMode: 'AUTO_RANDOM' | 'MANUAL';
  manualProductType: 'READY_TO_WEAR' | 'FABRIC';
  manualProductId: string;
  manualTitle: string;
  manualSubtitle: string;
  manualPrice: string;
  manualImage: string;
  manualHref: string;
  randomPoolSize: number;
  slideIntervalMs: number;
  showBadge: boolean;
  badgeText: string;
  enabled: boolean;
  displayOrder: number;
};
type InstantBuyAutoProduct = {
  id: string;
  categoryKey: InstantBuyCategoryKey;
  image: string;
  title: string;
  subtitle: string;
  price: string;
  href: string;
  createdAtTs: number;
};
type FeaturedTile = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  href: string;
  tag: string;
  cta: string;
  ctaMode: 'URL' | 'PAGE' | 'PRODUCT_GROUP';
  ctaPageKey?: string;
  productGroup: 'ALL' | 'RTW' | 'CTW' | 'FTB';
  ctaStyle?: CTAStyle;
};
type CtaMode = 'URL' | 'PAGE' | 'PRODUCT_ID';
type FeaturedCategoryKey = 'RTW' | 'CTW' | 'FTB';
type FeaturedLayout = {
  rows: number;
  columns: number;
};
type CategorySectionRuntime = {
  id: string;
  key: string;
  sectionName: string;
  title: string;
  titleColor: string;
  titleHoverColor: string;
  description: string;
  cta: string;
  href: string;
  ctaMode: CtaMode;
  ctaPageKey?: string;
  ctaStyle?: CTAStyle;
  image: string;
  textOnLeft: boolean;
  panelBg: string;
  stepsEnabled: boolean;
  stepCardHeaderTitle: string;
  stepCardHeaderIcon: string;
  stepCardHeaderFontSize: number;
  stepCardHeaderFontStyle: 'normal' | 'italic';
  stepCardHeaderFontWeight: number;
  stepCardBackgroundColor: string;
  stepCardOverlayOpacity: number;
  stepCardPanelWidth: number;
  stepCardAccentColor: string;
  stepCardIconColor: string;
  stepCardTitleFontSize: number;
  stepCardDescriptionFontSize: number;
  stepCards: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    displayOrder: number;
  }>;
};
type SpotlightRuntime = {
  id: string;
  image: string;
  title: string;
  description: string;
  designerName?: string;
  designerCountry?: string;
  designerSpecialty?: string;
  showCountry: boolean;
  showDesignerName: boolean;
  showSpecialty: boolean;
  showTag: boolean;
  showDescription: boolean;
  textBackgroundEnabled: boolean;
  textBackgroundColor: string;
  cta: string;
  href: string;
  ctaMode: CtaMode;
  ctaPageKey?: string;
  tag: string;
  countryCode: string;
  ctaStyle?: CTAStyle;
};
type SpotlightTypography = {
  countryFontSize: number;
  nameFontSize: number;
  nameColor: string;
  nameHoverColor: string;
  specialtyFontSize: number;
  descriptionFontSize: number;
  priceFontSize?: number;
  priceColor?: string;
  priceHoverColor?: string;
};
type ProductCardFieldKey = 'DESIGNER_NAME' | 'PRODUCT_NAME' | 'SHORT_DESCRIPTION' | 'PRICE';
type ProductCardStyle = {
  imageEnabled: boolean;
  fieldOrder: ProductCardFieldKey[];
  imageAspectRatio: '3:4' | '1:1';
  textGap: number;
  contentPaddingX: number;
  contentPaddingY: number;
  designerNameEnabled: boolean;
  designerNameFontSize: number;
  designerNameColor: string;
  productNameEnabled: boolean;
  productNameFontSize: number;
  productNameColor: string;
  shortDescriptionEnabled: boolean;
  shortDescriptionFontSize: number;
  shortDescriptionColor: string;
  shortDescriptionWordLimit: number;
  priceEnabled: boolean;
  priceFontSize: number;
  priceFontWeight: number;
  priceColor: string;
  labelEnabled: boolean;
  labelFontSize: number;
  labelTextColor: string;
  labelBackgroundColor: string;
  likesEnabled: boolean;
  likesSize: number;
  likesColor: string;
  likesActiveColor: string;
  countryIconEnabled: boolean;
  countryIconSize: number;
};

type CustomerReviewCard = {
  id: string;
  customerName: string;
  location: string;
  message: string;
  rating: number;
  source: 'STATIC' | 'PRODUCT';
};
type CustomerReviewSliderSettings = {
  mode: 'SLIDER' | 'GRID';
  autoPlay: boolean;
  autoPlayIntervalMs: number;
  transitionMs: number;
  showDots: boolean;
  pauseOnHover: boolean;
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

type ShopByTab = 'CATEGORY' | 'STYLE' | 'PRICE';
type CountryRegion = 'ALL' | 'NORTH' | 'WEST' | 'CENTRAL' | 'EAST' | 'SOUTHERN';
type TemplateKey =
  | 'TOP_NAVIGATIONS'
  | 'SHOP_BY'
  | 'SHOP_BY_COUNTRY'
  | 'CATEGORY_MANAGE_RTW'
  | 'CATEGORY_MANAGE_FTB'
  | 'CATEGORY_MANAGE_CTW'
  | 'CATEGORY_MANAGE'
  | 'HOW_IT_WORKS'
  | 'CUSTOM_TEXT_ICON'
  | 'SHOP_WITH_CONFIDENCE'
  | 'FEATURED_RTW'
  | 'FEATURED_CTW'
  | 'FEATURED_FTB'
  | 'FEATURED'
  | 'INSTANT_BUY'
  | 'FRESH_DROPS'
  | 'DESIGNER_SPOTLIGHT'
  | 'RTW_FTB'
  | 'FTB_SPOTLIGHT'
  | 'HERITAGE'
  | 'CUSTOMER_REVIEWS'
  | 'NEWSLETTER_FOOTER';

type JenksV2ManagerPayload = Record<string, unknown>;
type IconComponent = ComponentType<{ className?: string }>;
type ProductCardPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
type FrontpageProductCardCategory = 'RTW' | 'FTB' | 'CTW';

const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';
const HERO_HEIGHT_CLASS = 'min-h-[106vh]';

const TEMPLATE_KEYS: TemplateKey[] = [
  'TOP_NAVIGATIONS',
  'SHOP_BY',
  'SHOP_BY_COUNTRY',
  'CATEGORY_MANAGE_RTW',
  'CATEGORY_MANAGE_FTB',
  'CATEGORY_MANAGE_CTW',
  'CATEGORY_MANAGE',
  'HOW_IT_WORKS',
  'CUSTOM_TEXT_ICON',
  'SHOP_WITH_CONFIDENCE',
  'FEATURED_RTW',
  'FEATURED_CTW',
  'FEATURED_FTB',
  'FEATURED',
  'INSTANT_BUY',
  'FRESH_DROPS',
  'DESIGNER_SPOTLIGHT',
  'RTW_FTB',
  'FTB_SPOTLIGHT',
  'HERITAGE',
  'CUSTOMER_REVIEWS',
  'NEWSLETTER_FOOTER',
];

const CATEGORY_SECTION_TEMPLATE_BY_KEY: Record<'RTW' | 'FTB' | 'CTW', TemplateKey> = {
  RTW: 'CATEGORY_MANAGE_RTW',
  FTB: 'CATEGORY_MANAGE_FTB',
  CTW: 'CATEGORY_MANAGE_CTW',
};
const PRODUCT_PAGE_BY_SECTION_KEY: Record<'RTW' | 'FTB' | 'CTW', ProductCardPageType> = {
  RTW: 'READY_TO_WEAR',
  FTB: 'FABRIC_TO_BUY',
  CTW: 'CUSTOM_TO_WEAR',
};
const PRODUCT_CARD_FALLBACK_STYLE: ProductCardStyle = {
  imageEnabled: true,
  fieldOrder: ['DESIGNER_NAME', 'PRODUCT_NAME', 'SHORT_DESCRIPTION', 'PRICE'],
  imageAspectRatio: '3:4',
  textGap: 6,
  contentPaddingX: 16,
  contentPaddingY: 16,
  designerNameEnabled: true,
  designerNameFontSize: 14,
  designerNameColor: '#6b7280',
  productNameEnabled: true,
  productNameFontSize: 16,
  productNameColor: '#111111',
  shortDescriptionEnabled: true,
  shortDescriptionFontSize: 13,
  shortDescriptionColor: '#4b5563',
  shortDescriptionWordLimit: 10,
  priceEnabled: true,
  priceFontSize: 14,
  priceFontWeight: 600,
  priceColor: '#e66045',
  labelEnabled: true,
  labelFontSize: 11,
  labelTextColor: '#ffffff',
  labelBackgroundColor: 'rgba(17, 17, 17, 0.75)',
  likesEnabled: true,
  likesSize: 18,
  likesColor: '#ffffff',
  likesActiveColor: '#ef4444',
  countryIconEnabled: true,
  countryIconSize: 24,
};

const FEATURED_SECTION_TEMPLATE_BY_KEY: Record<'RTW' | 'CTW' | 'FTB', TemplateKey> = {
  RTW: 'FEATURED_RTW',
  CTW: 'FEATURED_CTW',
  FTB: 'FEATURED_FTB',
};

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
  Ruler,
  CreditCard,
  Scissors,
};

const SHOP_BY_TAB_META: Array<{ key: ShopByTab; label: string; Icon: IconComponent }> = [
  { key: 'CATEGORY', label: 'Category', Icon: ShoppingBag },
  { key: 'STYLE', label: 'Occasion / Style', Icon: CalendarDays },
  { key: 'PRICE', label: 'Price', Icon: Tag },
];

const DEFAULT_HREF_BY_KEY: Record<string, string> = {
  RTW: '/readytowear',
  CTW: '/customtowear',
  FTB: '/fabricstobuy',
  HOME: '/',
  SHOP: '/shop',
  READY_TO_WEAR: '/readytowear',
  CUSTOM_TO_WEAR: '/customtowear',
  FABRICS: '/fabricstobuy',
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
  RTW: '/readytowear',
  CTW: '/customtowear',
  FTB: '/fabricstobuy',
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

const CATEGORY_STEP_CARD_DEFAULTS = [
  { id: 'step-1', icon: 'Search', title: 'SELECT A DESIGN', description: 'Choose from designer templates', enabled: true, displayOrder: 1 },
  { id: 'step-2', icon: 'Palette', title: 'PICK YOUR FABRIC', description: 'Browse kente, Ankara and more', enabled: true, displayOrder: 2 },
  { id: 'step-3', icon: 'Ruler', title: 'ADD MEASUREMENTS', description: 'Enter your exact measurements', enabled: true, displayOrder: 3 },
  { id: 'step-4', icon: 'Sparkles', title: 'VIRTUAL TRY-ON', description: 'See how it looks before ordering', enabled: true, displayOrder: 4 },
  { id: 'step-5', icon: 'CreditCard', title: 'CHECKOUT & PAY', description: 'Secure payment options', enabled: true, displayOrder: 5 },
  { id: 'step-6', icon: 'Truck', title: 'RECEIVE YOUR DESIGN', description: 'Crafted and delivered to you', enabled: true, displayOrder: 6 },
] as const;

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

type TextIconSectionType = 'HOW_IT_WORKS' | 'CUSTOM' | 'SHOP_WITH_CONFIDENCE';
type TextIconSectionTitleConfig = {
  howItWorks: string;
  custom: string;
  shopWithConfidence: string;
};
type TextIconSectionHeadingConfig = {
  title: string;
  titleEnabled: boolean;
  titlePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  titleFontSize: number;
  description: string;
  descriptionEnabled: boolean;
  descriptionFontSize: number;
};
type TextIconCardStyleConfig = {
  cardMinHeight: number;
  cardWidth: number;
  iconSize: number;
  titleFontSize: number;
  descriptionFontSize: number;
};
type TextIconSectionStyleConfig = Record<TextIconSectionType, TextIconCardStyleConfig>;
type SectionTitlePosition = 'LEFT' | 'CENTER' | 'RIGHT';

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

const resolveConfiguredMenuHref = (
  entry: Record<string, unknown>,
  fallbackHref: string
) => {
  const hrefMode = asString(entry.hrefMode, 'PAGE').toUpperCase() === 'CUSTOM_URL' ? 'CUSTOM_URL' : 'PAGE';
  if (hrefMode === 'CUSTOM_URL') {
    return toSafeInternalHref(normalizeHref(entry.customUrl, normalizeHref(entry.href, fallbackHref)));
  }
  const pageKey = asString(entry.pageKey, asString(entry.routeKey, '')).toUpperCase();
  const pageHref = pageKey && PAGE_HREF_BY_KEY[pageKey] ? PAGE_HREF_BY_KEY[pageKey] : normalizeHref(entry.href, fallbackHref);
  return toSafeInternalHref(pageHref);
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

const productGroupHref = (groupRaw: unknown) => {
  const group = String(groupRaw || '')
    .trim()
    .toUpperCase();
  if (group === 'RTW') return buildCountryProductsHref('Nigeria', 'RTW');
  if (group === 'CTW') return buildCountryProductsHref('Nigeria', 'CTW');
  if (group === 'FTB') return buildCountryProductsHref('Nigeria', 'FTB');
  return '/shop';
};

const PAGE_HREF_BY_KEY: Record<string, string> = {
  HOME: '/',
  SHOP: '/shop',
  READY_TO_WEAR: '/readytowear',
  FABRICS: '/fabricstobuy',
  CUSTOM_TO_WEAR: '/customtowear',
  DESIGNERS: '/customtowear',
  ABOUT: '/about',
  CONTACT: '/contact',
  HELP_CENTER: '/help-center',
  COUNTRY_PRODUCTS: '/country-products',
  AUTH_LOGIN: '/auth/login',
};

const mapSourceCategoryToDetailHref = (
  category: 'RTW' | 'CTW' | 'FTB',
  id: string,
  source: Record<string, unknown>
) => {
  const safeId = asString(id, '').trim();
  if (!safeId) return '/shop';
  const preferredHref = asString(source.href, asString(source.url, ''));
  if (preferredHref) return toSafeInternalHref(preferredHref);
  if (category === 'RTW') return `/readytowear/${safeId}`;
  if (category === 'CTW') return `/customtowear/${safeId}`;
  return `/fabricstobuy/${safeId}`;
};

const resolveSpotlightProductHref = (fallbackHref: string, productId: string) => {
  const safeId = asString(productId, '').trim();
  if (!safeId) return toSafeInternalHref(fallbackHref);
  const fallback = String(fallbackHref || '').toLowerCase();
  if (fallback.includes('/fabricstobuy')) return `/fabricstobuy/${safeId}`;
  if (fallback.includes('/customtowear')) return `/customtowear/${safeId}`;
  return `/readytowear/${safeId}`;
};

const resolveManagerImage = (value: unknown, fallback = '') => {
  const raw = asString(value, '');
  if (!raw) return fallback;
  const resolved = resolveAssetUrl(raw);
  const sanitized = stripLegacyFallbackImage(asString(resolved, fallback));
  return asString(sanitized, '');
};

const hasImageSource = (value: unknown) => stripLegacyFallbackImage(asString(value, '')).length > 0;

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

const countryCodeToFlagEmoji = (value: unknown) => {
  const code = asString(value, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);
  if (code.length !== 2) return '🌍';
  return String.fromCodePoint(...code.split('').map((char) => 127397 + char.charCodeAt(0)));
};

const wordsToText = (html: string) =>
  String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();

const truncateWords = (value: unknown, maxWords: number) => {
  const text = asString(value, '');
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ')}…`;
};
const normalizeProductCardFieldOrder = (value: unknown): ProductCardFieldKey[] => {
  const source = Array.isArray(value) ? value : [];
  const next: ProductCardFieldKey[] = [];
  source.forEach((entry) => {
    const key = asString(entry, '').trim().toUpperCase() as ProductCardFieldKey;
    if (!['DESIGNER_NAME', 'PRODUCT_NAME', 'SHORT_DESCRIPTION', 'PRICE'].includes(key)) return;
    if (!next.includes(key)) next.push(key);
  });
  (['DESIGNER_NAME', 'PRODUCT_NAME', 'SHORT_DESCRIPTION', 'PRICE'] as ProductCardFieldKey[]).forEach((key) => {
    if (!next.includes(key)) next.push(key);
  });
  return next;
};
const normalizeProductCardStyle = (value: unknown): ProductCardStyle => {
  const row = asRecord(value);
  return {
    imageEnabled: asBoolean(row.imageEnabled, PRODUCT_CARD_FALLBACK_STYLE.imageEnabled),
    fieldOrder: normalizeProductCardFieldOrder(row.fieldOrder),
    imageAspectRatio: asString(row.imageAspectRatio, '3:4') === '1:1' ? '1:1' : '3:4',
    textGap: Math.max(0, Math.min(24, Math.round(asNumber(row.textGap, PRODUCT_CARD_FALLBACK_STYLE.textGap)))),
    contentPaddingX: Math.max(0, Math.min(40, Math.round(asNumber(row.contentPaddingX, PRODUCT_CARD_FALLBACK_STYLE.contentPaddingX)))),
    contentPaddingY: Math.max(0, Math.min(40, Math.round(asNumber(row.contentPaddingY, PRODUCT_CARD_FALLBACK_STYLE.contentPaddingY)))),
    designerNameEnabled: asBoolean(row.designerNameEnabled, PRODUCT_CARD_FALLBACK_STYLE.designerNameEnabled),
    designerNameFontSize: Math.max(8, Math.min(72, Math.round(asNumber(row.designerNameFontSize, PRODUCT_CARD_FALLBACK_STYLE.designerNameFontSize)))),
    designerNameColor: asString(row.designerNameColor, PRODUCT_CARD_FALLBACK_STYLE.designerNameColor),
    productNameEnabled: asBoolean(row.productNameEnabled, PRODUCT_CARD_FALLBACK_STYLE.productNameEnabled),
    productNameFontSize: Math.max(8, Math.min(72, Math.round(asNumber(row.productNameFontSize, PRODUCT_CARD_FALLBACK_STYLE.productNameFontSize)))),
    productNameColor: asString(row.productNameColor, PRODUCT_CARD_FALLBACK_STYLE.productNameColor),
    shortDescriptionEnabled: asBoolean(row.shortDescriptionEnabled, PRODUCT_CARD_FALLBACK_STYLE.shortDescriptionEnabled),
    shortDescriptionFontSize: Math.max(
      8,
      Math.min(72, Math.round(asNumber(row.shortDescriptionFontSize, PRODUCT_CARD_FALLBACK_STYLE.shortDescriptionFontSize)))
    ),
    shortDescriptionColor: asString(row.shortDescriptionColor, PRODUCT_CARD_FALLBACK_STYLE.shortDescriptionColor),
    shortDescriptionWordLimit: Math.max(
      4,
      Math.min(24, Math.round(asNumber(row.shortDescriptionWordLimit, PRODUCT_CARD_FALLBACK_STYLE.shortDescriptionWordLimit)))
    ),
    priceEnabled: asBoolean(row.priceEnabled, PRODUCT_CARD_FALLBACK_STYLE.priceEnabled),
    priceFontSize: Math.max(8, Math.min(72, Math.round(asNumber(row.priceFontSize, PRODUCT_CARD_FALLBACK_STYLE.priceFontSize)))),
    priceFontWeight: Math.max(
      100,
      Math.min(900, Math.round(asNumber(row.priceFontWeight, PRODUCT_CARD_FALLBACK_STYLE.priceFontWeight) / 100) * 100)
    ),
    priceColor: asString(row.priceColor, PRODUCT_CARD_FALLBACK_STYLE.priceColor),
    labelEnabled: asBoolean(row.labelEnabled, PRODUCT_CARD_FALLBACK_STYLE.labelEnabled),
    labelFontSize: Math.max(8, Math.min(72, Math.round(asNumber(row.labelFontSize, PRODUCT_CARD_FALLBACK_STYLE.labelFontSize)))),
    labelTextColor: asString(row.labelTextColor, PRODUCT_CARD_FALLBACK_STYLE.labelTextColor),
    labelBackgroundColor: asString(row.labelBackgroundColor, PRODUCT_CARD_FALLBACK_STYLE.labelBackgroundColor),
    likesEnabled: asBoolean(row.likesEnabled, PRODUCT_CARD_FALLBACK_STYLE.likesEnabled),
    likesSize: Math.max(8, Math.min(72, Math.round(asNumber(row.likesSize, PRODUCT_CARD_FALLBACK_STYLE.likesSize)))),
    likesColor: asString(row.likesColor, PRODUCT_CARD_FALLBACK_STYLE.likesColor),
    likesActiveColor: asString(row.likesActiveColor, PRODUCT_CARD_FALLBACK_STYLE.likesActiveColor),
    countryIconEnabled: asBoolean(row.countryIconEnabled, PRODUCT_CARD_FALLBACK_STYLE.countryIconEnabled),
    countryIconSize: Math.max(8, Math.min(96, Math.round(asNumber(row.countryIconSize, PRODUCT_CARD_FALLBACK_STYLE.countryIconSize)))),
  };
};

const normalizeDesignerSpotlightTag = (value: unknown) => {
  const raw = asString(value, '').trim().toUpperCase();
  if (!raw) return 'NIGERIA';
  if (raw.length <= 3 && COUNTRY_LABEL_BY_CODE[raw]) return COUNTRY_LABEL_BY_CODE[raw].toUpperCase();
  return raw;
};

const normalizeDesignerSpotlightTitle = (value: unknown, fallback = 'DESIGNER SPOTLIGHT') => {
  const text = asString(value, fallback).trim();
  return text.toUpperCase();
};

const normalizeDesignerSpotlightRole = (value: unknown, fallback = 'Contemporary African Designer') => {
  const text = asString(value, fallback).trim();
  if (!text) return fallback;
  return text;
};

const normalizeDesignerSpotlightDescription = (
  value: unknown,
  fallback = 'Crafted pieces that honor heritage while embracing modern silhouettes.'
) => {
  const text = asString(value, fallback).trim();
  if (!text) return fallback;
  const clean = text.replace(/\s+/g, ' ');
  return clean.length > 180 ? `${clean.slice(0, 177).trim()}...` : clean;
};

const hasHtmlTag = (value: string) => /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
const sanitizeHtmlForStory = (raw: string) => {
  const source = String(raw || '');
  if (!source.trim()) return '';
  if (!hasHtmlTag(source)) {
    return escapeHtml(source).replace(/\n/g, '<br/>');
  }
  if (typeof window === 'undefined') {
    return escapeHtml(source).replace(/\n/g, '<br/>');
  }
  const allowedTags = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'IMG', 'HR',
  ]);
  const isSafeUrl = (value: string, image = false) => {
    const url = String(value || '').trim().toLowerCase();
    if (!url) return false;
    if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) return true;
    if (!image && (url.startsWith('mailto:') || url.startsWith('tel:'))) return true;
    if (image && url.startsWith('data:image/')) return true;
    return false;
  };
  const traverse = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tag = element.tagName.toUpperCase();
      if (!allowedTags.has(tag)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) parent.insertBefore(element.firstChild, element);
          parent.removeChild(element);
          return;
        }
      } else {
        Array.from(element.attributes).forEach((attribute) => {
          const name = attribute.name.toLowerCase();
          const value = attribute.value;
          if (tag === 'A') {
            if (name === 'href' && isSafeUrl(value, false)) return;
            if (name === 'target' || name === 'rel') return;
            element.removeAttribute(attribute.name);
          } else if (tag === 'IMG') {
            if (name === 'src' && isSafeUrl(value, true)) return;
            if (name === 'alt' || name === 'title') return;
            element.removeAttribute(attribute.name);
          } else {
            element.removeAttribute(attribute.name);
          }
        });
        if (tag === 'A') {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }
    Array.from(node.childNodes).forEach(traverse);
  };
  let rootNode: HTMLElement | null = null;
  try {
    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const parsedDoc = parser.parseFromString(source, 'text/html');
      rootNode = parsedDoc?.body || null;
    }
  } catch {
    rootNode = null;
  }
  if (!rootNode) {
    const fallbackNode = document.createElement('div');
    fallbackNode.innerHTML = source;
    rootNode = fallbackNode;
  }
  traverse(rootNode);
  return rootNode.innerHTML;
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
  if (!trimmed) return '/shop';
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
    if (/^\/shop(\/)?$/i.test(trimmed)) return '/shop';
    if (/^\/shop[?#]/i.test(trimmed)) return `/shop${trimmed.slice('/shop'.length)}`;
    return trimmed;
  }
  return trimmed;
};

const toSafeInternalHref = (href: string) =>
  isExternalHref(href) ? href : sanitizeLegacyInternalHref(href);

const toSafeBackgroundImage = (value: unknown) => {
  const safe = stripLegacyFallbackImage(value);
  return safe ? `url(${safe})` : 'none';
};

const formatMoneyLabel = (value: unknown, fallback = '$0.00') => {
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return `$${Math.max(0, numeric).toFixed(2)}`;
  const text = String(value || '').trim();
  return text || fallback;
};

const buildCTAStyle = (raw: unknown, fallback: CTAStyle): CSSProperties => {
  const row = asRecord(raw);
  const baseTextColor = asString(row.textColor, fallback.textColor);
  const baseBorderColor = asString(row.borderColor, fallback.borderColor);
  const hoverTextColor = asString(row.hoverTextColor, fallback.hoverTextColor);
  const hoverBorderColor = asString(row.hoverBorderColor, fallback.hoverBorderColor);
  return {
    backgroundColor: asString(row.backgroundColor, fallback.backgroundColor),
    color: 'var(--cta-text-color)',
    borderColor: 'var(--cta-border-color)',
    borderWidth: `${Math.max(0, Math.min(12, Math.round(asNumber(row.borderWidth, fallback.borderWidth))))}px`,
    borderStyle: 'solid',
    fontFamily: asString(row.fontFamily, fallback.fontFamily),
    fontSize: `${Math.max(8, Math.min(72, Math.round(asNumber(row.fontSize, fallback.fontSize))))}px`,
    fontWeight: Math.max(100, Math.min(900, Math.round(asNumber(row.fontWeight, fallback.fontWeight)))),
    '--cta-text-color': baseTextColor,
    '--cta-hover-text-color': hoverTextColor,
    '--cta-border-color': baseBorderColor,
    '--cta-hover-border-color': hoverBorderColor,
  };
};

const buildShopFilterHref = (filterKey: 'style' | 'price', value: string) =>
  `/shop?${filterKey}=${encodeURIComponent(value.trim())}`;

const resolveCTAHoverStyle = (raw: unknown, fallback: CTAStyle) => {
  const row = asRecord(raw);
  return {
    hoverTextColor: asString(row.hoverTextColor, fallback.hoverTextColor),
    hoverBorderColor: asString(row.hoverBorderColor, fallback.hoverBorderColor),
  };
};

const applyHeroCtaHoverState = (
  element: HTMLElement,
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
    layoutMode: 'SPLIT',
    image: `${ASSET_BASE}/hero_model.jpg`,
    rightPanelBackgroundMode: 'NONE',
    rightPanelBackgroundImage: '',
    textVerticalAlign: 'MIDDLE',
    leftWidthPercent: 58,
    rightWidthPercent: 42,
    tag: 'Editorial Premium',
    tagColor: '#ffffff',
    titleColor: '#ffffff',
    titleSecondaryColor: '#ffffff',
    textColor: '#ffffff',
    descriptionColor: '#ffffff',
    titleA: 'WEAR',
    titleB: 'THE STORY OF AFRICA',
    lineA: 'Curated fashion from top designers and textile houses.',
    lineB: 'Ready-to-wear, fabrics, and custom looks in one destination.',
    primaryCtaText: 'SHOP NOW',
    primaryCtaHref: '/readytowear',
    primaryCtaEnabled: true,
    secondaryCtaText: 'EXPLORE DESIGNERS',
    secondaryCtaHref: '/customtowear',
    secondaryCtaEnabled: true,
    tertiaryCtaText: 'SHOP FABRICS',
    tertiaryCtaHref: '/fabricstobuy',
    tertiaryCtaEnabled: true,
  },
  {
    id: '2',
    layoutMode: 'SPLIT',
    image: `${ASSET_BASE}/rw_full.jpg`,
    rightPanelBackgroundMode: 'NONE',
    rightPanelBackgroundImage: '',
    textVerticalAlign: 'MIDDLE',
    leftWidthPercent: 58,
    rightWidthPercent: 42,
    tag: 'Editorial Premium',
    tagColor: '#111111',
    titleColor: '#111111',
    titleSecondaryColor: '#111111',
    textColor: '#111111',
    descriptionColor: '#111111',
    titleA: 'DISCOVER',
    titleB: 'AFRICAN ELEGANCE',
    lineA: 'Signature pieces and modern tailoring from trusted labels.',
    lineB: 'Designed on the continent. Styled for the world.',
    primaryCtaText: 'SHOP NOW',
    primaryCtaHref: '/readytowear',
    primaryCtaEnabled: true,
    secondaryCtaText: 'EXPLORE DESIGNERS',
    secondaryCtaHref: '/customtowear',
    secondaryCtaEnabled: true,
    tertiaryCtaText: 'SHOP FABRICS',
    tertiaryCtaHref: '/fabricstobuy',
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
    href: '/readytowear',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    Icon: ShoppingBag,
  },
  {
    id: 'cat-custom',
    title: 'CUSTOM TO WEAR',
    subtitle: 'Bespoke pieces tailored for your story',
    meta: '24 products',
    href: '/customtowear',
    image: `${ASSET_BASE}/featured_custom_right.jpg`,
    Icon: Sparkles,
  },
  {
    id: 'cat-fabrics',
    title: 'FABRICS TO BUY',
    subtitle: 'Signature textiles from across the continent',
    meta: '64 products',
    href: '/fabricstobuy',
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
    href: '/readytowear',
  },
  {
    id: 'fr2',
    image: `${ASSET_BASE}/featured_rw_right.jpg`,
    title: 'Afigan',
    subtitle: 'Premium ready-to-wear edits',
    href: '/readytowear',
  },
];

const FEATURED_CTW = [
  {
    id: 'fc1',
    image: `${ASSET_BASE}/product1.jpg`,
    title: 'Exclusive Gorgeous',
    subtitle: 'Custom craftsmanship for your story',
    href: '/customtowear',
  },
  {
    id: 'fc2',
    image: `${ASSET_BASE}/featured_custom_left.jpg`,
    title: 'Signature Couture',
    subtitle: 'Tailored by African designers',
    href: '/customtowear',
  },
];

const FEATURED_FTB = [
  {
    id: 'ff1',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    title: 'Signature Textile Vault',
    subtitle: 'Premium fabrics sourced from artisan houses across Africa.',
    href: '/fabricstobuy',
  },
  {
    id: 'ff2',
    image: `${ASSET_BASE}/product6.jpg`,
    title: 'Occasion Fabric Edit',
    subtitle: 'Handpicked weaves and prints for ceremony and statement looks.',
    href: '/fabricstobuy',
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
    href: '/readytowear',
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
    href: '/fabricstobuy',
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
    href: '/customtowear',
    image: `${ASSET_BASE}/custom_full.jpg`,
    textOnLeft: false,
    panelBg: 'bg-[#111]',
  },
] as const;

const FRESH_DROPS: Array<{
  id: string;
  image: string;
  name: string;
  brand: string;
  price: string;
  href: string;
}> = [
  {
    id: 'drop-1',
    image: `${ASSET_BASE}/featured_custom_left.jpg`,
    name: 'Awon Da',
    brand: 'Diallo Fabrics',
    price: '$230.00',
    href: '/shop',
  },
  {
    id: 'drop-2',
    image: `${ASSET_BASE}/featured_rw_right.jpg`,
    name: 'Kakaki Kentus',
    brand: 'Diallo Fabrics',
    price: '$115.00',
    href: '/shop',
  },
  {
    id: 'drop-3',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    name: 'Ankara Agege',
    brand: 'Diallo Fabrics',
    price: '$0.13/yd',
    href: '/shop',
  },
  {
    id: 'drop-4',
    image: `${ASSET_BASE}/product6.jpg`,
    name: 'Bazin Royale',
    brand: 'Diallo Fabrics',
    price: '$145.00',
    href: '/shop',
  },
];

const DESIGNER_SPOTLIGHT = [
  {
    id: 'spot-1',
    image: `${ASSET_BASE}/designer_spotlight.jpg`,
    title: 'OLUWASEUN ADEYEMI',
    country: 'NIGERIA',
    specialty: 'Contemporary Menswear Designer',
    description:
      'With over 15 years of experience, Oluwaseun blends traditional Nigerian craftsmanship with modern silhouettes, creating pieces that honor heritage while embracing contemporary elegance.',
    cta: 'VIEW COLLECTION',
    href: '/designers',
  },
  {
    id: 'spot-2',
    image: `${ASSET_BASE}/featured_custom_right.jpg`,
    title: 'AMINATA DIALLO',
    country: 'SENEGAL',
    specialty: 'Luxury Custom Tailor',
    description:
      'Aminata creates tailored pieces that blend Dakar elegance with contemporary silhouettes for ceremonies and modern city life.',
    cta: 'VIEW COLLECTION',
    href: '/customtowear',
  },
  {
    id: 'spot-3',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    title: 'KWESI MENSAH',
    country: 'GHANA',
    specialty: 'Ready-To-Wear Creative Director',
    description:
      'Kwesi curates bold ready-to-wear edits inspired by Ghanaian heritage and modern global street tailoring.',
    cta: 'VIEW COLLECTION',
    href: '/readytowear',
  },
] as const;

const RTW_SPOTLIGHT = [
  {
    id: 'rtw-spotlight-1',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    title: 'RTW CURATION',
    country: 'NIGERIA',
    specialty: 'Ready-to-Wear Curation',
    description: 'Hand-picked ready-to-wear looks curated for immediate shopping.',
    cta: 'SHOP RTW',
    href: '/readytowear',
    tag: 'RTW',
  },
  {
    id: 'rtw-spotlight-2',
    image: `${ASSET_BASE}/featured_rw_right.jpg`,
    title: 'FEATURED RTW EDIT',
    country: 'GHANA',
    specialty: 'Ready-to-Wear Selection',
    description: 'Discover bold RTW silhouettes selected for modern African wardrobes.',
    cta: 'SHOP RTW',
    href: '/readytowear',
    tag: 'RTW',
  },
  {
    id: 'rtw-spotlight-3',
    image: `${ASSET_BASE}/featured_rw_left.jpg`,
    title: 'READY-TO-WEAR PICKS',
    country: 'SENEGAL',
    specialty: 'Ready-to-Wear Styling',
    description: 'From statement silhouettes to everyday staples, shop latest RTW selections instantly.',
    cta: 'SHOP RTW',
    href: '/readytowear',
    tag: 'RTW',
  },
] as const;

const FTB_SPOTLIGHT = [
  {
    id: 'ftb-spotlight-1',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    title: 'PREMIUM FABRIC EDIT',
    country: 'GHANA',
    specialty: 'Fabric Selection',
    description: 'Discover bold prints and artisan materials selected for modern African wardrobes.',
    cta: 'SHOP FTB',
    href: '/fabricstobuy',
    tag: 'FTB',
  },
  {
    id: 'ftb-spotlight-2',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    title: 'FABRIC COLLECTION',
    country: 'SENEGAL',
    specialty: 'Textile Curation',
    description: 'Explore premium fabric collections selected for distinctive custom and ready looks.',
    cta: 'SHOP FTB',
    href: '/fabricstobuy',
    tag: 'FTB',
  },
  {
    id: 'ftb-spotlight-3',
    image: `${ASSET_BASE}/fabrics_full.jpg`,
    title: 'ARTISAN FABRICS',
    country: 'NIGERIA',
    specialty: 'Fabric Styling',
    description: 'Find fabrics built for ceremonies, statement outfits, and everyday elegance.',
    cta: 'SHOP FTB',
    href: '/fabricstobuy',
    tag: 'FTB',
  },
] as const;

const ALL_COUNTRIES_COUNT = 54;
const COUNTRY_LABEL_BY_CODE: Record<string, string> = {
  DZ: 'Algeria',
  AO: 'Angola',
  BJ: 'Benin',
  BW: 'Botswana',
  BF: 'Burkina Faso',
  BI: 'Burundi',
  CV: 'Cabo Verde',
  CM: 'Cameroon',
  CF: 'Central African Republic',
  TD: 'Chad',
  KM: 'Comoros',
  CG: 'Congo',
  CD: 'Democratic Republic of the Congo',
  CI: "Cote d'Ivoire",
  DJ: 'Djibouti',
  EG: 'Egypt',
  GQ: 'Equatorial Guinea',
  ER: 'Eritrea',
  SZ: 'Eswatini',
  ET: 'Ethiopia',
  GA: 'Gabon',
  GM: 'Gambia',
  GH: 'Ghana',
  GN: 'Guinea',
  GW: 'Guinea-Bissau',
  KE: 'Kenya',
  LS: 'Lesotho',
  LR: 'Liberia',
  LY: 'Libya',
  MG: 'Madagascar',
  MW: 'Malawi',
  ML: 'Mali',
  MR: 'Mauritania',
  MU: 'Mauritius',
  MA: 'Morocco',
  MZ: 'Mozambique',
  NA: 'Namibia',
  NE: 'Niger',
  NG: 'Nigeria',
  RW: 'Rwanda',
  ST: 'Sao Tome and Principe',
  SN: 'Senegal',
  SC: 'Seychelles',
  SL: 'Sierra Leone',
  SO: 'Somalia',
  ZA: 'South Africa',
  SS: 'South Sudan',
  SD: 'Sudan',
  TZ: 'Tanzania',
  TG: 'Togo',
  TN: 'Tunisia',
  UG: 'Uganda',
  ZM: 'Zambia',
  ZW: 'Zimbabwe',
};
const normalizeCountryLabelToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
const COUNTRY_CODE_BY_LABEL = Object.entries(COUNTRY_LABEL_BY_CODE).reduce<Record<string, string>>((acc, [code, label]) => {
  acc[normalizeCountryLabelToken(label)] = code;
  return acc;
}, {});
const resolveDesignerCountryCode = (countryCodeValue: unknown, countryValue: unknown) => {
  const code = String(countryCodeValue || '')
    .trim()
    .toUpperCase();
  if (/^[A-Z]{2}$/.test(code) && COUNTRY_LABEL_BY_CODE[code]) return code;
  const labelToken = normalizeCountryLabelToken(countryValue);
  return COUNTRY_CODE_BY_LABEL[labelToken] || 'NG';
};

const normalizeInstantBuyCategoryKey = (value: unknown): InstantBuyCategoryKey => {
  const token = String(value || '').trim().toUpperCase();
  return token === 'FTB' ? 'FTB' : 'RTW';
};

export default function JenksFrontpageV2() {
  const [managerConfig, setManagerConfig] = useState<JenksV2ManagerPayload | null>(null);
  const [index, setIndex] = useState(0);
  const [shopByTab, setShopByTab] = useState<ShopByTab>('CATEGORY');
  const [countryRegion, setCountryRegion] = useState<CountryRegion>('ALL');
  const [dedicatedCountryExpanded, setDedicatedCountryExpanded] = useState(false);
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [themeMode, setThemeMode] = useState<'LIGHT' | 'DARK'>('LIGHT');
  const [freshDropsProducts, setFreshDropsProducts] = useState<
    Array<{
      id: string;
      image: string;
      name: string;
      description: string;
      brand: string;
      priceUsd: number;
      href: string;
      createdAtTs: number;
      category: 'RTW' | 'CTW' | 'FTB';
      countryCode: string;
      productLabel?: {
        name: string;
        textColor: string;
        backgroundColor: string;
      };
      label: string;
    }>
  >([]);
  const [frontpageProductCardByType, setFrontpageProductCardByType] = useState<Record<ProductCardPageType, ProductCardStyle>>({
    READY_TO_WEAR: PRODUCT_CARD_FALLBACK_STYLE,
    FABRIC_TO_BUY: PRODUCT_CARD_FALLBACK_STYLE,
    CUSTOM_TO_WEAR: PRODUCT_CARD_FALLBACK_STYLE,
  });
  const [instantBuyAutoProducts, setInstantBuyAutoProducts] = useState<Record<'RTW' | 'FTB', InstantBuyAutoProduct[]>>({
    RTW: [],
    FTB: [],
  });
  const [instantBuySlotIndices, setInstantBuySlotIndices] = useState<Record<'RTW' | 'FTB', number>>({
    RTW: 0,
    FTB: 0,
  });
  const [productReviewCards, setProductReviewCards] = useState<CustomerReviewCard[]>([]);
  const [customerReviewIndex, setCustomerReviewIndex] = useState(0);
  const [customerReviewsHovered, setCustomerReviewsHovered] = useState(false);
  const [topStripPaused, setTopStripPaused] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterSubmitting, setNewsletterSubmitting] = useState(false);
  const [newsletterStatus, setNewsletterStatus] = useState<{ kind: 'idle' | 'success' | 'error'; message: string }>({
    kind: 'idle',
    message: '',
  });
  const searchSuggestions = useMemo(
    () => [
      { label: 'Ready To Wear', href: '/readytowear' },
      { label: 'Custom To Wear', href: '/customtowear' },
      { label: 'Fabrics', href: '/fabricstobuy' },
      { label: 'Shop', href: '/shop' },
      { label: 'Country', href: '/country' },
    ],
    []
  );
  const searchTargetHref = useMemo(() => {
    const token = searchQuery.trim().toLowerCase();
    if (!token) return '/shop';
    const matched =
      searchSuggestions.find((entry) => entry.label.toLowerCase() === token) ||
      searchSuggestions.find((entry) => entry.label.toLowerCase().includes(token));
    return matched?.href || `/shop?search=${encodeURIComponent(searchQuery.trim())}`;
  }, [searchQuery, searchSuggestions]);
  const submitSearchOverlay = () => {
    const target = searchTargetHref;
    setSearchOpen(false);
    setSearchQuery('');
    if (target) window.location.assign(target);
  };
  const freshDropsStripRef = useRef<HTMLDivElement | null>(null);
  const designerSpotlightStripRef = useRef<HTMLDivElement | null>(null);
  const [designerCanScrollLeft, setDesignerCanScrollLeft] = useState(false);
  const [designerCanScrollRight, setDesignerCanScrollRight] = useState(false);
  const rtwSpotlightStripRef = useRef<HTMLDivElement | null>(null);
  const [rtwCanScrollLeft, setRtwCanScrollLeft] = useState(false);
  const [rtwCanScrollRight, setRtwCanScrollRight] = useState(false);
  const ftbSpotlightStripRef = useRef<HTMLDivElement | null>(null);
  const [ftbCanScrollLeft, setFtbCanScrollLeft] = useState(false);
  const [ftbCanScrollRight, setFtbCanScrollRight] = useState(false);
  const topNavigationsCfg = useMemo(() => asRecord(asRecord(managerConfig).topNavigations), [managerConfig]);
  const shopByCfg = useMemo(() => asRecord(asRecord(managerConfig).shopBy), [managerConfig]);
  const shopByCountryCfg = useMemo(() => asRecord(asRecord(managerConfig).shopByCountry), [managerConfig]);
  const categoryManageCfg = useMemo(() => asRecord(asRecord(managerConfig).categoryManage), [managerConfig]);
  const textIconCfg = useMemo(() => asRecord(asRecord(managerConfig).textIconCards), [managerConfig]);
  const featuredCfg = useMemo(() => asRecord(asRecord(managerConfig).featured), [managerConfig]);
  const freshDropsCfg = useMemo(() => asRecord(asRecord(managerConfig).freshDrops), [managerConfig]);
  const designerSpotlightCfg = useMemo(() => asRecord(asRecord(managerConfig).designerSpotlight), [managerConfig]);
  const rtwFtbCfg = useMemo(() => asRecord(asRecord(managerConfig).rtwFtb), [managerConfig]);
  const ftbSpotlightCfg = useMemo(
    () => asRecord(asRecord(managerConfig).ftbSpotlight || asRecord(managerConfig).rtwFtb),
    [managerConfig]
  );
  const heritageCfg = useMemo(() => asRecord(asRecord(managerConfig).heritage), [managerConfig]);
  const customerReviewsCfg = useMemo(() => asRecord(asRecord(managerConfig).customerReviews), [managerConfig]);
  const newsletterFooterCfg = useMemo(() => asRecord(asRecord(managerConfig).newsletterFooter), [managerConfig]);
  const sectionVisibilityCfg = useMemo(() => asRecord(asRecord(managerConfig).sectionVisibility), [managerConfig]);

  const sectionVisibilityState = useMemo(() => {
    const defaults = new Map<TemplateKey, { enabled: boolean; order: number }>();
    TEMPLATE_KEYS.forEach((key, index) => {
      defaults.set(key, { enabled: true, order: index + 1 });
    });
    const configured = new Set<TemplateKey>();
    const rows = asArray(sectionVisibilityCfg.sections);
    if (rows.length === 0) return { layout: defaults, configured };
    const byTemplate = new Map<TemplateKey, { enabled: boolean; order: number }>();
    rows.forEach((entry, index) => {
      const row = asRecord(entry);
      if (asBoolean(row.isCustom, false)) return;
      const token = asString(row.templateKey, '').toUpperCase() as TemplateKey;
      if (!TEMPLATE_KEYS.includes(token)) return;
      configured.add(token);
      const enabled = asBoolean(row.enabled, true);
      const fallbackOrder = TEMPLATE_KEYS.indexOf(token) + 1 || index + 1;
      const order = Math.max(1, Math.round(asNumber(row.order, fallbackOrder)));
      const existing = byTemplate.get(token);
      if (!existing) {
        byTemplate.set(token, { enabled, order });
        return;
      }
      // If duplicate core template rows exist, prefer the one with the
      // smallest order (top-most in section visibility), and preserve that
      // row's enabled state directly so disable/enable is deterministic.
      if (order <= existing.order) {
        byTemplate.set(token, { enabled, order });
      }
    });
    if (byTemplate.size === 0) return { layout: defaults, configured };
    byTemplate.forEach((value, key) => defaults.set(key, value));
    return { layout: defaults, configured };
  }, [sectionVisibilityCfg.sections]);
  const sectionLayoutByTemplate = sectionVisibilityState.layout;
  const configuredTemplateKeys = sectionVisibilityState.configured;
  const resolveSectionLayout = (templateKey: TemplateKey, fallbackTemplateKey?: TemplateKey) => {
    if (configuredTemplateKeys.has(templateKey)) {
      return sectionLayoutByTemplate.get(templateKey);
    }
    if (fallbackTemplateKey) {
      return sectionLayoutByTemplate.get(fallbackTemplateKey) || sectionLayoutByTemplate.get(templateKey);
    }
    return sectionLayoutByTemplate.get(templateKey);
  };
  const isSectionVisible = (templateKey: TemplateKey, fallbackTemplateKey?: TemplateKey) =>
    resolveSectionLayout(templateKey, fallbackTemplateKey)?.enabled ?? true;
  const getSectionOrder = (templateKey: TemplateKey, fallbackTemplateKey?: TemplateKey) =>
    resolveSectionLayout(templateKey, fallbackTemplateKey)?.order ??
    Math.max(1, TEMPLATE_KEYS.indexOf(templateKey) + 1);
  const sectionTitleCfg = useMemo(() => asRecord(sectionVisibilityCfg.titleSettings), [sectionVisibilityCfg.titleSettings]);
  const sectionTitlesEnabled = asBoolean(sectionTitleCfg.show, asBoolean(sectionTitleCfg.enabled, true));
  const sectionTitlePosition = ((): SectionTitlePosition => {
    const token = asString(sectionTitleCfg.align, asString(sectionTitleCfg.position, 'LEFT')).toUpperCase();
    if (token === 'CENTER' || token === 'RIGHT') return token;
    return 'LEFT';
  })();
  const sectionTitleClass =
    sectionTitlePosition === 'CENTER' ? 'text-center' : sectionTitlePosition === 'RIGHT' ? 'text-right' : 'text-left';

  const logoCfg = useMemo(() => asRecord(topNavigationsCfg.logo), [topNavigationsCfg.logo]);
  const logoTextRaw = asString(logoCfg.text, 'ZURIKARIBU');
  const logoTextSplit = useMemo(() => {
    const compact = logoTextRaw.replace(/\s+/g, '').trim();
    if (!compact) return { left: 'ZURI', right: 'KARIBU' };
    const upper = compact.toUpperCase();
    if (upper.startsWith('ZURI') && compact.length > 4) {
      return {
        left: compact.slice(0, 4),
        right: compact.slice(4),
      };
    }
    const pivot = Math.max(1, Math.ceil(compact.length / 2));
    return {
      left: compact.slice(0, pivot),
      right: compact.slice(pivot),
    };
  }, [logoTextRaw]);
  const headerLogoFontWeight = Math.max(100, Math.min(900, Math.round(asNumber(logoCfg.fontWeight, 700))));
  const themeCfg = useMemo(() => asRecord(asRecord(topNavigationsCfg.controllers).theme), [topNavigationsCfg.controllers]);
  const ThemeIcon = iconFromKey(themeCfg.icon, Sun);
  const hamburgerMenuLinks = useMemo(
    () =>
      asArray(topNavigationsCfg.hamburgerMenu)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry) => ({
          label: asString(entry.label, 'Menu'),
          href: resolveConfiguredMenuHref(entry, '/'),
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
          href: resolveConfiguredMenuHref(entry, '/'),
        })),
    [topNavigationsCfg.additionalTopMenu]
  );
  const signInCfg = useMemo(() => asRecord(topNavigationsCfg.signInMenu), [topNavigationsCfg.signInMenu]);

  const heroSlides = useMemo(() => {
    const rows = asArray(topNavigationsCfg.heroBanners)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    if (rows.length === 0) return [];
    const mapped = rows.map((row, indexKey) => {
      const fallbackSlide = HERO[indexKey % HERO.length] || HERO[0];
      const title = asString(row.title, 'Wear the Story of Africa');
      const split = splitHeroTitle(title.toUpperCase());
      const layoutToken = asString(row.layoutMode, fallbackSlide.layoutMode).toUpperCase();
      const layoutMode: HeroSlide['layoutMode'] = layoutToken === 'FULL' ? 'FULL' : 'SPLIT';
      const panelModeToken = asString(row.rightPanelBackgroundMode, fallbackSlide.rightPanelBackgroundMode).toUpperCase();
      const rightPanelBackgroundMode: HeroSlide['rightPanelBackgroundMode'] =
        layoutMode === 'FULL' ? 'NONE' : panelModeToken === 'IMAGE' ? 'IMAGE' : 'NONE';
      const panelAlignToken = asString(row.textVerticalAlign, fallbackSlide.textVerticalAlign).toUpperCase();
      const textVerticalAlign: HeroSlide['textVerticalAlign'] =
        panelAlignToken === 'TOP' || panelAlignToken === 'BOTTOM' ? panelAlignToken : 'MIDDLE';
      const leftWidthPercent = Math.max(20, Math.min(80, Math.round(asNumber(row.leftWidthPercent, fallbackSlide.leftWidthPercent))));
      const rightWidthPercent = 100 - leftWidthPercent;
      return {
        id: asString(row.id, `hero-${indexKey + 1}`),
        layoutMode,
        image: resolveManagerImage(row.image, ''),
        rightPanelBackgroundMode,
        rightPanelBackgroundImage: resolveManagerImage(row.rightPanelBackgroundImage, ''),
        textVerticalAlign,
        leftWidthPercent,
        rightWidthPercent,
        tag: asString(row.tag, fallbackSlide.tag || ''),
        tagColor: asString(row.tagColor, fallbackSlide.tagColor || '#ffffff'),
        titleFontSize: Math.max(32, Math.min(120, Math.round(asNumber(row.titleFontSize, 72)))),
        titleColor: asString(row.titleColor, fallbackSlide.titleColor || '#ffffff'),
        titleSecondaryColor: asString(
          row.titleSecondaryColor,
          fallbackSlide.titleSecondaryColor || fallbackSlide.titleColor || '#ffffff'
        ),
        textEnabled: asBoolean(row.textEnabled, true),
        textColor: asString(row.textColor, fallbackSlide.textColor || '#ffffff'),
        descriptionEnabled: asBoolean(row.descriptionEnabled, true),
        descriptionFontSize: Math.max(10, Math.min(48, Math.round(asNumber(row.descriptionFontSize, 14)))),
        descriptionColor: asString(row.descriptionColor, fallbackSlide.descriptionColor || '#ffffff'),
        titleA: split.titleA || HERO[indexKey % HERO.length]?.titleA || 'WEAR',
        titleB: split.titleB || HERO[indexKey % HERO.length]?.titleB || 'THE STORY OF AFRICA',
        lineA: asString(row.text, HERO[indexKey % HERO.length]?.lineA || ''),
        lineB: asString(row.description, HERO[indexKey % HERO.length]?.lineB || ''),
        primaryCtaText: asString(row.primaryCtaText, HERO[indexKey % HERO.length]?.primaryCtaText || 'SHOP NOW'),
        primaryCtaHref: normalizeHref(
          row.primaryCtaLink,
          HERO[indexKey % HERO.length]?.primaryCtaHref || '/readytowear'
        ),
        primaryCtaStyle: row.primaryCtaStyle,
        primaryCtaEnabled: asBoolean(row.primaryCtaEnabled, true),
        secondaryCtaText: asString(
          row.secondaryCtaText,
          HERO[indexKey % HERO.length]?.secondaryCtaText || 'EXPLORE DESIGNERS'
        ),
        secondaryCtaHref: normalizeHref(row.secondaryCtaLink, HERO[indexKey % HERO.length]?.secondaryCtaHref || '/customtowear'),
        secondaryCtaStyle: row.secondaryCtaStyle,
        secondaryCtaEnabled: asBoolean(row.secondaryCtaEnabled, true),
        tertiaryCtaText: asString(
          row.tertiaryCtaText,
          HERO[indexKey % HERO.length]?.tertiaryCtaText || 'SHOP FABRICS'
        ),
        tertiaryCtaHref: normalizeHref(row.tertiaryCtaLink, HERO[indexKey % HERO.length]?.tertiaryCtaHref || '/fabricstobuy'),
        tertiaryCtaStyle: row.tertiaryCtaStyle,
        tertiaryCtaEnabled: asBoolean(row.tertiaryCtaEnabled, true),
      } as HeroSlide;
    });
    return mapped.length > 0 ? mapped : [];
  }, [topNavigationsCfg.heroBanners]);
  const active = useMemo(() => heroSlides[index] || heroSlides[0] || null, [heroSlides, index]);
  const showHeroSection = isSectionVisible('TOP_NAVIGATIONS') && heroSlides.length > 0;

  const categorySections = useMemo(() => {
    const rows = asArray(categoryManageCfg.sections)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    return rows.length > 0 ? rows : [];
  }, [categoryManageCfg.sections]);

  const enabledShopByTabs = useMemo(() => {
    const allowed: ShopByTab[] = ['CATEGORY', 'STYLE', 'PRICE'];
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
        href: normalizeHref(row.href, DEFAULT_HREF_BY_KEY[key] || '/readytowear', key),
        image: asString(stripLegacyFallbackImage(row.image), ''),
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
    if (rows.length === 0) {
      return SHOP_BY_STYLE.map((row) => ({
        ...row,
        href: buildShopFilterHref('style', row.name),
      }));
    }
    return rows.map((row) => ({
      name: asString(row.title, 'Style'),
      sub: asString(row.description, ''),
      href: buildShopFilterHref('style', asString(row.title, 'Style')),
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
    if (rows.length === 0) {
      return SHOP_BY_PRICE.map((row) => ({
        ...row,
        href: buildShopFilterHref('price', row.range),
      }));
    }
    return rows.map((row) => ({
      range: asString(row.priceLabel, asString(row.title, '$0 - $100')),
      sub: asString(row.description, ''),
      href: buildShopFilterHref('price', asString(row.priceLabel, asString(row.title, '$0 - $100'))),
      Icon: iconFromKey(row.icon, Tag),
      titleFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.titleFontSize, 24)))),
      descriptionFontSize: Math.max(10, Math.min(72, Math.round(asNumber(row.descriptionFontSize, 14)))),
    }));
  }, [shopByCfg.priceCards]);

  const shopByCountriesData = useMemo(() => {
    const baselineByName = new Map(SHOP_BY_COUNTRY.map((row) => [row.name.toLowerCase(), row]));
    const rows = asArray(shopByCountryCfg.countries)
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
  }, [shopByCountryCfg.countries]);
  const countryShowcaseData = useMemo(() => {
    const regionByName = new Map(AFRICAN_COUNTRIES_54.map((row) => [row.name.toLowerCase(), row.region]));
    return shopByCountriesData.map((row) => ({
      name: row.name,
      flag: row.flag,
      region: regionByName.get(row.name.toLowerCase()) || 'WEST',
    })) as Array<{ name: string; flag: string; region: Exclude<CountryRegion, 'ALL'> }>;
  }, [shopByCountriesData]);

  const sectionsRtwFtbCtw = useMemo<CategorySectionRuntime[]>(() => {
    if (categorySections.length === 0) {
      return RTW_FTB_CTW_SECTIONS.map((entry) => ({
        ...entry,
        titleColor: '#ffffff',
        titleHoverColor: '#ffffff',
      }));
    }
    const mapped = categorySections.map((entry, idx) => {
      const key = asString(entry.key, '').toUpperCase();
      const matchingCategory = shopByCategoryCards.find((row) => row.title.includes(key) || row.id.toUpperCase().includes(key));
      const ctaMode = asString(entry.ctaMode, 'PAGE').toUpperCase() === 'PAGE' ? 'PAGE' : 'URL';
      const ctaPageKey = asString(entry.ctaPageKey, '').toUpperCase();
      const fallbackHref = FEATURED_HREF_BY_KEY[key] || '/readytowear';
      const href =
        ctaMode === 'PAGE'
          ? toSafeInternalHref(PAGE_HREF_BY_KEY[ctaPageKey] || fallbackHref)
          : normalizeHref(entry.ctaLink, fallbackHref, key);
      return {
        id: asString(entry.id, `cat-${idx + 1}`),
        key,
        sectionName: asString(entry.tag, asString(entry.title, key || 'CATEGORY')).toUpperCase(),
        title: asString(entry.title, key || 'Category').toUpperCase(),
        titleColor: asString(entry.titleColor, '#ffffff'),
        titleHoverColor: asString(entry.titleHoverColor, asString(entry.titleColor, '#ffffff')),
        description: asString(entry.description, ''),
        cta: asString(entry.ctaText, FEATURED_CTA_BY_KEY[key] || 'SHOP NOW').toUpperCase(),
        href,
        ctaMode,
        ctaPageKey: ctaPageKey || undefined,
        ctaStyle: entry.ctaStyle,
        image: asString(
          stripLegacyFallbackImage(entry.image),
          asString(stripLegacyFallbackImage(matchingCategory?.image), '')
        ),
        textOnLeft: CATEGORY_TEXT_LEFT_BY_KEY[key] ?? (idx % 2 === 1),
        panelBg: CATEGORY_PANEL_BG_BY_KEY[key] || 'bg-[#111]',
        stepsEnabled: asBoolean(entry.stepsEnabled, true),
        stepCardHeaderTitle: asString(
          entry.stepCardsTitle,
          asString(entry.stepCardHeaderTitle, 'Create your own style step-by-step')
        ),
        stepCardHeaderIcon: asString(entry.stepCardsTitleIcon, asString(entry.stepCardHeaderIcon, 'Scissors')),
        stepCardHeaderFontSize: Math.max(10, Math.min(40, Math.round(asNumber(entry.stepCardsTitleFontSize, 16)))),
        stepCardHeaderFontStyle: String(
          asString(entry.stepCardsTitleFontStyle, asString(entry.stepCardHeaderFontStyle, 'NORMAL'))
        )
          .trim()
          .toUpperCase() === 'ITALIC'
          ? 'italic'
          : 'normal',
        stepCardHeaderFontWeight: Math.max(100, Math.min(900, Math.round(asNumber(entry.stepCardsTitleFontWeight, 600)))),
        stepCardBackgroundColor: asString(entry.stepCardBackgroundColor, '#111111'),
        stepCardOverlayOpacity: Math.max(0, Math.min(100, Math.round(asNumber(entry.stepCardOverlayOpacity, 78)))),
        stepCardPanelWidth: Math.max(280, Math.min(640, Math.round(asNumber(entry.stepCardPanelWidth, 420)))),
        stepCardAccentColor: asString(entry.stepCardAccentColor, '#e66045'),
        stepCardIconColor: asString(entry.stepCardIconColor, '#ff7c61'),
        stepCardTitleFontSize: Math.max(10, Math.min(32, Math.round(asNumber(entry.stepCardTitleFontSize, 18)))),
        stepCardDescriptionFontSize: Math.max(10, Math.min(28, Math.round(asNumber(entry.stepCardDescriptionFontSize, 20)))),
        stepCards: ((): CategorySectionRuntime['stepCards'] => {
          const rawSteps = asArray(entry.stepCards)
            .map((step) => asRecord(step))
            .filter((step) => asBoolean(step.enabled, true))
            .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
            .map((step, stepIdx) => ({
              id: asString(step.id, `${asString(entry.id, `cat-${idx + 1}`)}-step-${stepIdx + 1}`),
              icon: asString(step.icon, 'Sparkles'),
              title: asString(step.title, `STEP ${stepIdx + 1}`).toUpperCase(),
              description: asString(step.description, ''),
              enabled: asBoolean(step.enabled, true),
              displayOrder: Math.max(0, Math.round(asNumber(step.displayOrder, stepIdx + 1))),
            }));
          if (rawSteps.length > 0) return rawSteps;
          return CATEGORY_STEP_CARD_DEFAULTS.map((step, stepIdx) => ({
            id: `${asString(entry.id, `cat-${idx + 1}`)}-default-${step.id}`,
            icon: step.icon,
            title: step.title,
            description: step.description,
            enabled: step.enabled,
            displayOrder: step.displayOrder || stepIdx + 1,
          }));
        })(),
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
    const defaults: Record<'RTW' | 'CTW' | 'FTB', FeaturedTile[]> = {
      RTW: FEATURED_RTW.map((row) => ({
        ...row,
        tag: FEATURED_LABEL_BY_KEY.RTW,
        cta: FEATURED_CTA_BY_KEY.RTW,
        ctaMode: 'PAGE',
        ctaPageKey: 'READY_TO_WEAR',
        productGroup: 'RTW',
      })),
      CTW: FEATURED_CTW.map((row) => ({
        ...row,
        tag: FEATURED_LABEL_BY_KEY.CTW,
        cta: FEATURED_CTA_BY_KEY.CTW,
        ctaMode: 'PAGE',
        ctaPageKey: 'CUSTOM_TO_WEAR',
        productGroup: 'CTW',
      })),
      FTB: FEATURED_FTB.map((row) => ({
        ...row,
        tag: FEATURED_LABEL_BY_KEY.FTB,
        cta: FEATURED_CTA_BY_KEY.FTB,
        ctaMode: 'PAGE',
        ctaPageKey: 'FABRICS',
        productGroup: 'FTB',
      })),
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
        image: asString(stripLegacyFallbackImage(row.image), ''),
        title: asString(row.title, defaults[key][0]?.title || ''),
        subtitle: asString(row.description, defaults[key][0]?.subtitle || ''),
        href: normalizeHref(row.ctaLink, FEATURED_HREF_BY_KEY[key] || '/readytowear', key),
        tag: asString(row.tag, FEATURED_LABEL_BY_KEY[key] || ''),
        cta: asString(row.ctaText, FEATURED_CTA_BY_KEY[key] || 'SHOP NOW').toUpperCase(),
        ctaMode: ((): FeaturedTile['ctaMode'] => {
          const token = String(row.ctaMode || '').trim().toUpperCase();
          if (token === 'PRODUCT_GROUP') return 'PRODUCT_GROUP';
          if (token === 'PAGE') return 'PAGE';
          return 'URL';
        })(),
        ctaPageKey: asString(row.ctaPageKey, ''),
        productGroup:
          String(row.productGroup || key)
            .trim()
            .toUpperCase() === 'CTW'
            ? 'CTW'
            : String(row.productGroup || key)
                  .trim()
                  .toUpperCase() === 'FTB'
              ? 'FTB'
              : String(row.productGroup || key)
                    .trim()
                    .toUpperCase() === 'RTW'
                ? 'RTW'
                : 'ALL',
        ctaStyle: row.ctaStyle,
      });
    });
    return {
      RTW: grouped.RTW.length > 0 ? grouped.RTW : defaults.RTW,
      CTW: grouped.CTW.length > 0 ? grouped.CTW : defaults.CTW,
      FTB: grouped.FTB.length > 0 ? grouped.FTB : defaults.FTB,
    };
  }, [featuredCfg.cards]);
  const featuredColumns = Math.max(1, Math.min(4, Math.round(asNumber(featuredCfg.columns, 2))));
  const featuredLayoutByKey = useMemo<Record<FeaturedCategoryKey, FeaturedLayout>>(() => {
    const raw = asRecord(featuredCfg.layoutByKey);
    const make = (key: FeaturedCategoryKey): FeaturedLayout => {
      const row = asRecord(raw[key] ?? raw[key.toLowerCase()]);
      const rows = Math.max(1, Math.min(12, Math.round(asNumber(row.rows, 1))));
      const columns = Math.max(1, Math.min(4, Math.round(asNumber(row.columns, featuredColumns))));
      return { rows, columns };
    };
    return {
      RTW: make('RTW'),
      CTW: make('CTW'),
      FTB: make('FTB'),
    };
  }, [featuredCfg.layoutByKey, featuredColumns]);
  const sectionCtaHref = (section: CategorySectionRuntime) => {
    if (section.ctaMode === 'PAGE') {
      const routeToken = String(section.ctaPageKey || '').trim().toUpperCase();
      const pageHref = PAGE_HREF_BY_KEY[routeToken] || section.href;
      return toSafeInternalHref(pageHref || '/readytowear');
    }
    return normalizeHref(section.href, '/readytowear');
  };
  const orderedSectionsRtwFtbCtw = useMemo(() => [...sectionsRtwFtbCtw], [sectionsRtwFtbCtw]);
  const orderedCategorySections = useMemo(
    () =>
      (['RTW', 'FTB', 'CTW'] as const)
        .map((key) =>
          orderedSectionsRtwFtbCtw.find((section) => String(section.key || '').trim().toUpperCase() === key)
        )
        .filter((section): section is CategorySectionRuntime => Boolean(section)),
    [orderedSectionsRtwFtbCtw]
  );
  const visibleCategorySections = useMemo(
    () =>
      orderedCategorySections.filter((section) =>
        isSectionVisible(
          CATEGORY_SECTION_TEMPLATE_BY_KEY[String(section.key || '').trim().toUpperCase() as 'RTW' | 'FTB' | 'CTW'],
          'CATEGORY_MANAGE'
        )
      ),
    [orderedCategorySections, sectionLayoutByTemplate, configuredTemplateKeys]
  );
  const featuredCategoryOrder = ['RTW', 'CTW', 'FTB'] as const;
  const visibleFeaturedKeys = useMemo(
    () =>
      featuredCategoryOrder.filter((key) =>
        isSectionVisible(FEATURED_SECTION_TEMPLATE_BY_KEY[key], 'FEATURED')
      ),
    [sectionLayoutByTemplate, configuredTemplateKeys]
  );
  const categoryStepCardOverlayStyle = (section: CategorySectionRuntime): CSSProperties => {
    const alpha = Math.max(0, Math.min(1, section.stepCardOverlayOpacity / 100));
    const background = asString(section.stepCardBackgroundColor, '#111111');
    return {
      backgroundColor: background,
      borderColor: `rgba(255,255,255,${Math.max(0.18, alpha * 0.4)})`,
      color: '#ffffff',
      boxShadow: '0 14px 34px rgba(0,0,0,0.35)',
    };
  };
  const renderCategoryStepCards = (section: CategorySectionRuntime) => (
    (() => {
      const isCtwSection = String(section.key || '').trim().toUpperCase() === 'CTW';
      const stepCardHoverClass = isCtwSection
        ? 'hover:scale-[1.03] hover:z-10 hover:shadow-[0_28px_56px_rgba(0,0,0,0.52)]'
        : 'hover:-translate-y-0.5 hover:shadow-[0_20px_38px_rgba(0,0,0,0.42)]';
      return (
    <div
      className="pointer-events-none absolute inset-y-6 left-6 z-20 hidden overflow-y-auto pr-1 md:block"
      style={{ width: `${section.stepCardPanelWidth}px` }}
    >
      <div className="space-y-2">
        <div
          className="rounded-t-sm border border-white/25 px-4 py-3"
          style={{
            ...categoryStepCardOverlayStyle(section),
            borderRadius: '0.08rem',
            backgroundColor: 'rgba(55,53,51,0.88)',
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-white/20 bg-black/20"
              style={{ color: section.stepCardAccentColor }}
            >
              {(() => {
                const HeaderIcon = iconFromKey(section.stepCardHeaderIcon, Scissors);
                return <HeaderIcon className="h-4 w-4" />;
              })()}
            </span>
            <p
              className="leading-tight text-white/95"
              style={{
                fontSize: `${section.stepCardHeaderFontSize}px`,
                fontStyle: section.stepCardHeaderFontStyle,
                fontWeight: section.stepCardHeaderFontWeight,
              }}
            >
              {section.stepCardHeaderTitle}
            </p>
          </div>
        </div>
        {section.stepCards
          .slice()
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((step, stepIndex) => {
            const StepIcon = iconFromKey(step.icon, Sparkles);
            const orderLabel = String(stepIndex + 1);
            return (
              <div
                key={step.id}
                className={`group relative overflow-hidden border backdrop-blur-md transform-gpu transition-all duration-300 ${stepCardHoverClass}`}
                style={{
                  ...categoryStepCardOverlayStyle(section),
                  borderRadius: '0.08rem',
                }}
              >
                <div className="flex min-h-[96px] items-stretch">
                  <div
                    className="inline-flex w-[62px] shrink-0 items-center justify-center border-r border-white/35 text-[56px] font-semibold leading-none text-white transition-colors duration-300 group-hover:bg-[#e66045]"
                    style={{ backgroundColor: section.stepCardAccentColor }}
                  >
                    {orderLabel}
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-3">
                    <div
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/25 transition-colors duration-300 group-hover:border-white/45"
                      style={{ color: section.stepCardIconColor }}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p
                        className="font-semibold uppercase tracking-[0.14em] text-white"
                        style={{ fontSize: `${section.stepCardTitleFontSize}px` }}
                      >
                        {step.title}
                      </p>
                      {step.description ? (
                        <p
                          className="mt-1 leading-snug text-white/88"
                          style={{ fontSize: `${section.stepCardDescriptionFontSize}px` }}
                        >
                          {step.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
      );
    })()
  );

  const featuredHrefForCountry = (key: 'RTW' | 'CTW' | 'FTB') => {
    const categoryToken = categoryTokenFromSectionKey(key);
    if (categoryToken === 'ALL') return '/readytowear';
    return buildCountryProductsHref('Nigeria', categoryToken);
  };
  const featuredCardHref = (card: FeaturedTile, key: 'RTW' | 'CTW' | 'FTB') => {
    if (card.ctaMode === 'PRODUCT_GROUP') {
      const token = card.productGroup === 'ALL' ? key : card.productGroup;
      return productGroupHref(token);
    }
    if (card.ctaMode === 'PAGE') {
      const routeToken = String(card.ctaPageKey || '').trim().toUpperCase();
      const pageHref = PAGE_HREF_BY_KEY[routeToken] || card.href || featuredHrefForCountry(key);
      return toSafeInternalHref(pageHref);
    }
    return toSafeInternalHref(card.href || featuredHrefForCountry(key));
  };
  const freshDropsCountryFilterTokens = useMemo(
    () =>
      asArray(freshDropsCfg.countryFilters)
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 100),
    [freshDropsCfg.countryFilters]
  );
  const freshDropsCategoryFilterTokens = useMemo(
    () =>
      asArray(freshDropsCfg.categoryFilters)
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter(Boolean)
        .slice(0, 40),
    [freshDropsCfg.categoryFilters]
  );

  const freshDropsCards = useMemo(() => {
    const rows = Math.max(1, Math.round(asNumber(freshDropsCfg.rows, 2)));
    const cols = Math.max(1, Math.round(asNumber(freshDropsCfg.columns, 4)));
    const maxItems = rows * cols;
    const dynamicRows = freshDropsProducts.map((entry) => ({
      id: entry.id,
      image: entry.image,
      name: entry.name,
      description: entry.description,
      brand: entry.brand,
      priceUsd: entry.priceUsd,
      href: entry.href,
      category: entry.category,
      countryCode: entry.countryCode,
      productLabel: entry.productLabel,
      label: entry.label,
    }));
    if (dynamicRows.length > 0) return dynamicRows.slice(0, maxItems);
    return FRESH_DROPS.slice(0, maxItems).map((entry) => ({
      ...entry,
      description: '',
      priceUsd: Number(String(entry.price || '').replace(/[^0-9.]/g, '')) || 0,
      category: 'RTW' as const,
      countryCode: 'NG',
      productLabel: undefined,
      label: '',
    }));
  }, [freshDropsCfg.columns, freshDropsCfg.rows, freshDropsProducts]);

  const spotCtaHref = (entry: Record<string, unknown>, fallbackHref: string) => {
    const modeToken = asString(entry.ctaMode, 'PAGE').toUpperCase();
    const ctaMode: CtaMode = modeToken === 'URL' ? 'URL' : modeToken === 'PRODUCT_ID' ? 'PRODUCT_ID' : 'PAGE';
    if (ctaMode === 'PAGE') {
      const pageKey = asString(entry.ctaPageKey, '').toUpperCase();
      return toSafeInternalHref(PAGE_HREF_BY_KEY[pageKey] || fallbackHref);
    }
    if (ctaMode === 'PRODUCT_ID') {
      const productId = asString(entry.ctaProductId, asString(entry.ctaLink, ''));
      return toSafeInternalHref(resolveSpotlightProductHref(fallbackHref, productId));
    }
    return normalizeHref(entry.ctaLink, fallbackHref);
  };

  const buildSpotlightModel = useCallback(
    (cfg: Record<string, unknown>, variant: 'DESIGNER' | 'RTW' | 'FTB') => {
      const fallbackRows =
        variant === 'RTW' ? RTW_SPOTLIGHT : variant === 'FTB' ? FTB_SPOTLIGHT : DESIGNER_SPOTLIGHT;
      const rows = Math.max(1, Math.round(asNumber(cfg.rows, 1)));
      const columns = Math.max(1, Math.min(12, Math.round(asNumber(cfg.columns, 3))));
      const sectionHeightPx = Math.max(
        0,
        Math.min(2400, Math.round(asNumber(cfg.sectionHeightPx ?? cfg.sectionMinHeightPx, 0)))
      );
      const columnHeightPx = Math.max(
        0,
        Math.min(2400, Math.round(asNumber(cfg.columnHeightPx ?? cfg.cardHeightPx, 0)))
      );
      const imageHeightPx = Math.max(
        0,
        Math.min(2400, Math.round(asNumber(cfg.imageHeightPx ?? cfg.cardImageHeightPx, 0)))
      );
      const descriptionWordLimit = Math.max(
        5,
        Math.min(80, Math.round(asNumber(cfg.descriptionWordLimit, variant === 'DESIGNER' ? 25 : 25)))
      );
      const typography: SpotlightTypography = {
        countryFontSize: Math.max(10, Math.min(72, Math.round(asNumber(cfg.countryFontSize, 22)))),
        nameFontSize: Math.max(16, Math.min(140, Math.round(asNumber(cfg.designerNameFontSize ?? cfg.nameFontSize, 52)))),
        nameColor: asString(cfg.designerNameColor ?? cfg.nameColor, '#ffffff'),
        nameHoverColor: asString(cfg.designerNameHoverColor ?? cfg.nameHoverColor, asString(cfg.designerNameColor ?? cfg.nameColor, '#ffffff')),
        specialtyFontSize: Math.max(10, Math.min(72, Math.round(asNumber(cfg.specialtyFontSize, 22)))),
        descriptionFontSize: Math.max(10, Math.min(96, Math.round(asNumber(cfg.descriptionFontSize, 24)))),
        ...(variant !== 'DESIGNER'
          ? {
              priceFontSize: Math.max(10, Math.min(96, Math.round(asNumber(cfg.priceFontSize, 18)))),
              priceColor: asString(cfg.priceColor, '#ffffff'),
              priceHoverColor: asString(cfg.priceHoverColor, asString(cfg.priceColor, '#ffffff')),
            }
          : {}),
      };
      const colsClass = (() => {
        if (columns <= 1) return 'md:grid-cols-1';
        if (columns === 2) return 'md:grid-cols-2';
        if (columns === 3) return 'md:grid-cols-3';
        if (columns === 4) return 'md:grid-cols-4';
        if (columns === 5) return 'md:grid-cols-5';
        if (columns === 6) return 'md:grid-cols-6';
        if (columns === 7) return 'md:grid-cols-7';
        if (columns === 8) return 'md:grid-cols-8';
        if (columns === 9) return 'md:grid-cols-9';
        if (columns === 10) return 'md:grid-cols-10';
        if (columns === 11) return 'md:grid-cols-11';
        return 'md:grid-cols-12';
      })();
      const maxItems = rows * columns;
      const entries = asArray(cfg.cards)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
        .map((entry, idx) => {
          const fallbackRow = fallbackRows[idx % fallbackRows.length];
          const fallbackHref =
            fallbackRow?.href || (variant === 'RTW' ? '/readytowear' : variant === 'FTB' ? '/fabricstobuy' : '/customtowear');
          const fallbackTitle = fallbackRow?.title || 'OLUWASEUN ADEYEMI';
          const fallbackSpecialty = fallbackRow?.specialty || 'Contemporary African Designer';
          const fallbackDescription =
            fallbackRow?.description ||
            'With over 15 years of experience, Oluwaseun blends traditional Nigerian craftsmanship with modern silhouettes, creating pieces that honor heritage while embracing contemporary elegance.';
          const fallbackCountry = fallbackRow?.country || 'NIGERIA';
          const fallbackTag =
            variant === 'RTW'
              ? asString((fallbackRow as any)?.tag, 'RTW')
              : variant === 'FTB'
                ? asString((fallbackRow as any)?.tag, 'FTB')
                : asString((fallbackRow as any)?.tag, 'DESIGNER SPOTLIGHT');
          const fallbackCta =
            fallbackRow?.cta || (variant === 'RTW' ? 'SHOP RTW' : variant === 'FTB' ? 'SHOP FTB' : 'VIEW COLLECTION');
          const countryToken = resolveDesignerCountryCode(
            (entry as Record<string, unknown>).countryCode,
            asString(entry.country, asString(entry.designerCountry, ''))
          );
          const designerName = asString(entry.designerName, asString(entry.title, fallbackTitle));
          const country = asString(
            entry.country,
            asString(entry.designerCountry, COUNTRY_LABEL_BY_CODE[countryToken] || fallbackCountry)
          );
          const textBackgroundEnabled = asBoolean(
            entry.textBackgroundEnabled,
            asBoolean(cfg.textAreaBackgroundEnabled, true)
          );
          const textBackgroundColor = asString(
            entry.textBackgroundColor,
            asString(cfg.textAreaBackgroundColor, 'rgba(0,0,0,0.45)')
          );
          return {
            id: asString(entry.id, `spot-${idx + 1}`),
            image: asString(stripLegacyFallbackImage(entry.image), ''),
            title: designerName,
            designerName,
            designerCountry: country,
            designerSpecialty: asString(entry.specialty, fallbackSpecialty),
            description: truncateWords(asString(entry.description, fallbackDescription), descriptionWordLimit),
            price: variant !== 'DESIGNER' ? asString(entry.price, '') : '',
            showCountry: asBoolean(entry.showCountry, true),
            showDesignerName: asBoolean(entry.showDesignerName, true),
            showSpecialty: asBoolean(entry.showSpecialty, true),
            showTag: asBoolean(entry.showTag, true),
            showDescription: asBoolean(entry.showDescription, true),
            showPrice: variant !== 'DESIGNER' ? asBoolean(entry.showPrice, true) : false,
            textBackgroundEnabled,
            textBackgroundColor,
            cta: asString(entry.ctaText, fallbackCta).toUpperCase(),
            href: spotCtaHref(entry, fallbackHref),
            tag: asString(entry.tag, fallbackTag),
            countryCode: countryToken || 'NG',
            ctaStyle: entry.ctaStyle,
          };
        });
      const source =
        entries.length > 0
          ? entries
          : fallbackRows.map((row) => ({
              ...row,
              designerName: row.title,
              title: row.title,
              designerCountry: asString((row as any).country, ''),
              designerSpecialty: asString((row as any).specialty, 'Contemporary African Designer'),
              description: truncateWords(asString((row as any).description, ''), descriptionWordLimit),
              price: variant !== 'DESIGNER' ? asString((row as any).price, '') : '',
              showCountry: true,
              showDesignerName: true,
              showSpecialty: true,
              showTag: true,
              showDescription: true,
              showPrice: variant !== 'DESIGNER',
              textBackgroundEnabled: true,
              textBackgroundColor: 'rgba(0,0,0,0.45)',
              tag:
                variant === 'RTW'
                  ? asString((row as any).tag, 'RTW')
                  : variant === 'FTB'
                    ? asString((row as any).tag, 'FTB')
                    : asString((row as any).tag, 'DESIGNER SPOTLIGHT'),
              countryCode: resolveDesignerCountryCode('', asString((row as any).country, '')),
            }));
      return {
        rows,
        columns,
        sectionHeightPx,
        columnHeightPx,
        imageHeightPx,
        typography,
        colsClass,
        cards: source,
      };
    },
    [spotCtaHref]
  );
  const designerSpotlightModel = useMemo(
    () => buildSpotlightModel(designerSpotlightCfg, 'DESIGNER'),
    [buildSpotlightModel, designerSpotlightCfg]
  );
  const rtwFtbSpotlightModel = useMemo(
    () => buildSpotlightModel(rtwFtbCfg, 'RTW'),
    [buildSpotlightModel, rtwFtbCfg]
  );
  const ftbSpotlightModel = useMemo(
    () => buildSpotlightModel(ftbSpotlightCfg, 'FTB'),
    [buildSpotlightModel, ftbSpotlightCfg]
  );
  const designerSpotlightTypography = useMemo<SpotlightTypography>(
    () => ({
      ...designerSpotlightModel.typography,
    }),
    [designerSpotlightModel.typography]
  );
  const spotlightCards = designerSpotlightModel.cards;
  const designerSpotlightColsClass = designerSpotlightModel.colsClass;
  const designerSpotlightSectionHeightPx = Math.max(0, Math.round(asNumber(designerSpotlightModel.sectionHeightPx, 0)));
  const designerSpotlightColumnHeightPx = Math.max(0, Math.round(asNumber(designerSpotlightModel.columnHeightPx, 0)));
  const designerSpotlightSectionMinHeight =
    designerSpotlightSectionHeightPx > 0 ? `${designerSpotlightSectionHeightPx}px` : '106vh';
  const designerSpotlightCardMinHeight =
    designerSpotlightColumnHeightPx > 0 ? `${designerSpotlightColumnHeightPx}px` : designerSpotlightSectionMinHeight;
  const designerSpotlightImageHeightPx = Math.max(0, Math.round(asNumber(designerSpotlightModel.imageHeightPx, 0)));
  const designerSpotlightImageHeight = designerSpotlightImageHeightPx > 0 ? `${designerSpotlightImageHeightPx}px` : '100%';
  const designerSpotlightVisibleColumns = Math.max(1, Math.round(asNumber(designerSpotlightModel.columns, 3)));
  const designerSpotlightNeedsHorizontalScroll = spotlightCards.length > designerSpotlightVisibleColumns;
  const syncDesignerSpotlightScrollButtons = useCallback(() => {
    const node = designerSpotlightStripRef.current;
    if (!node || !designerSpotlightNeedsHorizontalScroll) {
      setDesignerCanScrollLeft(false);
      setDesignerCanScrollRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setDesignerCanScrollLeft(node.scrollLeft > 4);
    setDesignerCanScrollRight(node.scrollLeft < maxScrollLeft - 4);
  }, [designerSpotlightNeedsHorizontalScroll]);
  const scrollDesignerSpotlight = useCallback(
    (direction: 'LEFT' | 'RIGHT') => {
      const node = designerSpotlightStripRef.current;
      if (!node) return;
      const cardWidth = node.clientWidth / Math.max(1, designerSpotlightVisibleColumns);
      node.scrollBy({
        left: (direction === 'LEFT' ? -1 : 1) * cardWidth,
        behavior: 'smooth',
      });
    },
    [designerSpotlightVisibleColumns]
  );
  const designerSpotlightCardBasis = `${100 / designerSpotlightVisibleColumns}%`;
  const rtwFtbSpotlightCards = rtwFtbSpotlightModel.cards;
  const rtwFtbSpotlightColsClass = rtwFtbSpotlightModel.colsClass;
  const rtwFtbSpotlightTypography = rtwFtbSpotlightModel.typography;
  const rtwSpotlightSectionHeightPx = Math.max(0, Math.round(asNumber(rtwFtbSpotlightModel.sectionHeightPx, 0)));
  const rtwSpotlightColumnHeightPx = Math.max(0, Math.round(asNumber(rtwFtbSpotlightModel.columnHeightPx, 0)));
  const rtwSpotlightSectionMinHeight = rtwSpotlightSectionHeightPx > 0 ? `${rtwSpotlightSectionHeightPx}px` : '106vh';
  const rtwSpotlightCardMinHeight =
    rtwSpotlightColumnHeightPx > 0 ? `${rtwSpotlightColumnHeightPx}px` : rtwSpotlightSectionMinHeight;
  const rtwSpotlightImageHeightPx = Math.max(0, Math.round(asNumber(rtwFtbSpotlightModel.imageHeightPx, 0)));
  const rtwSpotlightImageHeight = rtwSpotlightImageHeightPx > 0 ? `${rtwSpotlightImageHeightPx}px` : '100%';
  const rtwSpotlightVisibleColumns = Math.max(1, Math.round(asNumber(rtwFtbSpotlightModel.columns, 3)));
  const rtwSpotlightNeedsHorizontalScroll = rtwFtbSpotlightCards.length > rtwSpotlightVisibleColumns;
  const syncRtwSpotlightScrollButtons = useCallback(() => {
    const node = rtwSpotlightStripRef.current;
    if (!node || !rtwSpotlightNeedsHorizontalScroll) {
      setRtwCanScrollLeft(false);
      setRtwCanScrollRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setRtwCanScrollLeft(node.scrollLeft > 4);
    setRtwCanScrollRight(node.scrollLeft < maxScrollLeft - 4);
  }, [rtwSpotlightNeedsHorizontalScroll]);
  const scrollRtwSpotlight = useCallback(
    (direction: 'LEFT' | 'RIGHT') => {
      const node = rtwSpotlightStripRef.current;
      if (!node) return;
      const cardWidth = node.clientWidth / Math.max(1, rtwSpotlightVisibleColumns);
      node.scrollBy({
        left: (direction === 'LEFT' ? -1 : 1) * cardWidth,
        behavior: 'smooth',
      });
    },
    [rtwSpotlightVisibleColumns]
  );
  const rtwSpotlightCardBasis = `${100 / rtwSpotlightVisibleColumns}%`;
  const ftbSpotlightCards = ftbSpotlightModel.cards;
  const ftbSpotlightColsClass = ftbSpotlightModel.colsClass;
  const ftbSpotlightTypography = ftbSpotlightModel.typography;
  const ftbSpotlightSectionHeightPx = Math.max(0, Math.round(asNumber(ftbSpotlightModel.sectionHeightPx, 0)));
  const ftbSpotlightColumnHeightPx = Math.max(0, Math.round(asNumber(ftbSpotlightModel.columnHeightPx, 0)));
  const ftbSpotlightSectionMinHeight = ftbSpotlightSectionHeightPx > 0 ? `${ftbSpotlightSectionHeightPx}px` : '106vh';
  const ftbSpotlightCardMinHeight =
    ftbSpotlightColumnHeightPx > 0 ? `${ftbSpotlightColumnHeightPx}px` : ftbSpotlightSectionMinHeight;
  const ftbSpotlightImageHeightPx = Math.max(0, Math.round(asNumber(ftbSpotlightModel.imageHeightPx, 0)));
  const ftbSpotlightImageHeight = ftbSpotlightImageHeightPx > 0 ? `${ftbSpotlightImageHeightPx}px` : '100%';
  const ftbSpotlightVisibleColumns = Math.max(1, Math.round(asNumber(ftbSpotlightModel.columns, 3)));
  const ftbSpotlightNeedsHorizontalScroll = ftbSpotlightCards.length > ftbSpotlightVisibleColumns;
  const syncFtbSpotlightScrollButtons = useCallback(() => {
    const node = ftbSpotlightStripRef.current;
    if (!node || !ftbSpotlightNeedsHorizontalScroll) {
      setFtbCanScrollLeft(false);
      setFtbCanScrollRight(false);
      return;
    }
    const maxScrollLeft = Math.max(0, node.scrollWidth - node.clientWidth);
    setFtbCanScrollLeft(node.scrollLeft > 4);
    setFtbCanScrollRight(node.scrollLeft < maxScrollLeft - 4);
  }, [ftbSpotlightNeedsHorizontalScroll]);
  const scrollFtbSpotlight = useCallback(
    (direction: 'LEFT' | 'RIGHT') => {
      const node = ftbSpotlightStripRef.current;
      if (!node) return;
      const cardWidth = node.clientWidth / Math.max(1, ftbSpotlightVisibleColumns);
      node.scrollBy({
        left: (direction === 'LEFT' ? -1 : 1) * cardWidth,
        behavior: 'smooth',
      });
    },
    [ftbSpotlightVisibleColumns]
  );
  const ftbSpotlightCardBasis = `${100 / ftbSpotlightVisibleColumns}%`;
  const staticReviewCards = useMemo(() => {
    const rows = asArray(customerReviewsCfg.staticMessages)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0));
    return rows.map((entry, idx) => ({
      id: asString(entry.id, `static-review-${idx + 1}`),
      customerName: asString(entry.customerName, 'Verified Buyer'),
      location: asString(entry.location, ''),
      message: asString(entry.message, ''),
      rating: Math.max(1, Math.min(5, Math.round(asNumber(entry.rating, 5)))),
      source: 'STATIC' as const,
    }));
  }, [customerReviewsCfg.staticMessages]);

  const textIconSectionTitles = useMemo<TextIconSectionTitleConfig>(() => {
    const titles = asRecord(textIconCfg.sectionTitles);
    return {
      howItWorks: asString(titles.howItWorks, 'How It Works'),
      custom: asString(titles.custom, 'Custom'),
      shopWithConfidence: asString(titles.shopWithConfidence, 'Shop With Confidence'),
    };
  }, [textIconCfg.sectionTitles]);
  const textIconSectionHeadings = useMemo<Record<TextIconSectionType, TextIconSectionHeadingConfig>>(() => {
    const headings = asRecord(textIconCfg.sectionHeadings);
    const makeHeading = (
      key: 'howItWorks' | 'custom' | 'shopWithConfidence',
      fallbackTitle: string
    ): TextIconSectionHeadingConfig => {
      const row = asRecord(headings[key]);
      const sectionTitleOverride =
        key === 'howItWorks'
          ? asString(textIconSectionTitles.howItWorks, '')
          : key === 'custom'
            ? asString(textIconSectionTitles.custom, '')
            : asString(textIconSectionTitles.shopWithConfidence, '');
      const title = asString(sectionTitleOverride, asString(row.title, fallbackTitle));
      const positionToken = asString(row.titlePosition, 'LEFT').toUpperCase();
      const titlePosition: 'LEFT' | 'CENTER' | 'RIGHT' =
        positionToken === 'CENTER' || positionToken === 'RIGHT' ? positionToken : 'LEFT';
      return {
        title,
        titleEnabled: asBoolean(row.titleEnabled, true),
        titlePosition,
        titleFontSize: Math.max(12, Math.min(96, Math.round(asNumber(row.titleFontSize, 48)))),
        description: asString(row.description, ''),
        descriptionEnabled: asBoolean(row.descriptionEnabled, false),
        descriptionFontSize: Math.max(8, Math.min(72, Math.round(asNumber(row.descriptionFontSize, 14)))),
      };
    };
    return {
      HOW_IT_WORKS: makeHeading('howItWorks', 'How It Works'),
      CUSTOM: makeHeading('custom', 'Custom'),
      SHOP_WITH_CONFIDENCE: makeHeading('shopWithConfidence', 'Shop With Confidence'),
    };
  }, [textIconCfg.sectionHeadings, textIconSectionTitles]);
  const textIconSectionStyles = useMemo<TextIconSectionStyleConfig>(() => {
    const fallbackStyle = asRecord(textIconCfg.cardStyle);
    const rawSectionStyles = asRecord(textIconCfg.sectionStyles);
    const makeStyle = (key: TextIconSectionType): TextIconCardStyleConfig => {
      const sectionStyleRow =
        key === 'HOW_IT_WORKS'
          ? rawSectionStyles.howItWorks ?? rawSectionStyles.HOW_IT_WORKS
          : key === 'CUSTOM'
            ? rawSectionStyles.custom ?? rawSectionStyles.CUSTOM
            : rawSectionStyles.shopWithConfidence ?? rawSectionStyles.SHOP_WITH_CONFIDENCE;
      const row = asRecord(sectionStyleRow);
      return {
        cardMinHeight: Math.max(
          80,
          Math.min(
            520,
            Math.round(asNumber(row.cardMinHeight, asNumber(fallbackStyle.cardMinHeight, 220)))
          )
        ),
        cardWidth: Math.max(
          180,
          Math.min(520, Math.round(asNumber(row.cardWidth, asNumber(fallbackStyle.cardWidth, 320))))
        ),
        iconSize: Math.max(20, Math.min(120, Math.round(asNumber(row.iconSize, asNumber(fallbackStyle.iconSize, 44))))),
        titleFontSize: Math.max(
          8,
          Math.min(72, Math.round(asNumber(row.titleFontSize, asNumber(fallbackStyle.titleFontSize, 11))))
        ),
        descriptionFontSize: Math.max(
          8,
          Math.min(
            72,
            Math.round(asNumber(row.descriptionFontSize, asNumber(fallbackStyle.descriptionFontSize, 12)))
          )
        ),
      };
    };
    return {
      HOW_IT_WORKS: makeStyle('HOW_IT_WORKS'),
      CUSTOM: makeStyle('CUSTOM'),
      SHOP_WITH_CONFIDENCE: makeStyle('SHOP_WITH_CONFIDENCE'),
    };
  }, [textIconCfg.cardStyle, textIconCfg.sectionStyles]);

  const makeTextIconCards = (
    target: TextIconSectionType,
    fallbackRows: Array<{ title?: string; label?: string; sub: string; Icon: IconComponent }>
  ) => {
    const allRows = asArray(textIconCfg.cards).map((entry) => asRecord(entry));
    const rows = asArray(textIconCfg.cards)
      .map((entry) => asRecord(entry))
      .filter((entry) => {
        if (!asBoolean(entry.enabled, true)) return false;
        return asString(entry.sectionType, '').toUpperCase() === target;
      })
      .sort((a, b) => asNumber(a.displayOrder, 0) - asNumber(b.displayOrder, 0))
      .map((entry, idx) => ({
        id: asString(entry.id, `${target}-${idx + 1}`),
        title: asString(entry.title, target === 'SHOP_WITH_CONFIDENCE' ? 'Trust' : target === 'CUSTOM' ? 'Custom' : 'Step').toUpperCase(),
        sub: asString(entry.description, ''),
        Icon: iconFromKey(entry.icon, target === 'SHOP_WITH_CONFIDENCE' ? ShieldCheck : Sparkles),
      }));
    if (rows.length > 0) return rows;
    if (allRows.length > 0) return [];
    return fallbackRows.map((row, idx) => ({
      id: `${target}-fallback-${idx + 1}`,
      title: asString(row.title || row.label, 'Card').toUpperCase(),
      sub: asString(row.sub, ''),
      Icon: row.Icon,
    }));
  };

  const howItWorksCards = useMemo(
    () => makeTextIconCards('HOW_IT_WORKS', HOW_IT_WORKS),
    [textIconCfg.cards]
  );
  const customTextIconCards = useMemo(
    () => makeTextIconCards('CUSTOM', []),
    [textIconCfg.cards]
  );
  const trustCards = useMemo(
    () => makeTextIconCards('SHOP_WITH_CONFIDENCE', trust.map((row) => ({ ...row, title: row.label }))),
    [textIconCfg.cards]
  );
  const showHowItWorksSection = isSectionVisible('HOW_IT_WORKS') && howItWorksCards.length > 0;
  const showCustomTextIconSection = isSectionVisible('CUSTOM_TEXT_ICON') && customTextIconCards.length > 0;
  const showTrustSection = isSectionVisible('SHOP_WITH_CONFIDENCE') && trustCards.length > 0;
  const getTextIconHeadingConfig = (sectionType: TextIconSectionType): TextIconSectionHeadingConfig => {
    if (sectionType === 'HOW_IT_WORKS') return textIconSectionHeadings.HOW_IT_WORKS;
    if (sectionType === 'CUSTOM') return textIconSectionHeadings.CUSTOM;
    return textIconSectionHeadings.SHOP_WITH_CONFIDENCE;
  };
  const textIconSectionHeading = (sectionType: TextIconSectionType) =>
    asString(getTextIconHeadingConfig(sectionType).title, '').toUpperCase();
  const textIconSectionTitleClass = (sectionType: TextIconSectionType) => {
    const position = getTextIconHeadingConfig(sectionType).titlePosition;
    return position === 'CENTER' ? 'text-center' : position === 'RIGHT' ? 'text-right' : 'text-left';
  };
  const renderTextIconCard = (
    sectionType: TextIconSectionType,
    item: { id: string; title: string; sub: string; Icon: IconComponent }
  ) => {
    const textIconCardStyle = textIconSectionStyles[sectionType];
    const iconSize = textIconCardStyle.iconSize;
    const iconGlyphSize = Math.max(14, Math.round(iconSize * 0.45));
    return (
      <article
        key={item.id}
        className="mt-2 flex flex-col items-center border border-black/10 bg-[#faf9f5] px-4 py-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_14px_28px_rgba(0,0,0,0.12)]"
        style={{
          minHeight: `${textIconCardStyle.cardMinHeight}px`,
          width: '100%',
          maxWidth: `${textIconCardStyle.cardWidth}px`,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        <div
          className="flex items-center justify-center rounded-full border border-black/15 bg-white"
          style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
        >
          <item.Icon className="text-[#e66045]" style={{ width: `${iconGlyphSize}px`, height: `${iconGlyphSize}px` }} />
        </div>
        <p
          className="mt-3 font-semibold uppercase tracking-[0.12em]"
          style={{ fontSize: `${textIconCardStyle.titleFontSize}px` }}
        >
          {item.title}
        </p>
        <p
          className="mt-2 text-black/55"
          style={{ fontSize: `${textIconCardStyle.descriptionFontSize}px` }}
        >
          {item.sub}
        </p>
      </article>
    );
  };

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
  const heritageStoryHtml = useMemo(
    () =>
      sanitizeHtmlForStory(
        asString(
          heritageCfg.storyHtml,
          asString(
            heritageCfg.description,
            "The world is yet to experience Africa's fashion. We're building the bridge connecting heritage craft to modern wardrobes everywhere."
          )
        )
      ),
    [heritageCfg.description, heritageCfg.storyHtml]
  );
  const heritageReadMoreLabel = asString(heritageCfg.readMoreLabel, 'Read More');
  const heritageReadMoreHref = normalizeHref(heritageCfg.readMoreHref, '/stories/our-heritage');
  const heritageStoryTitle = asString(heritageCfg.storyTitle, 'The Story');
  const heritageStoryTitleFontSize = Math.max(12, Math.min(72, Math.round(asNumber(heritageCfg.storyTitleFontSize, 30))));
  const heritageStoryTextFontSize = Math.max(10, Math.min(64, Math.round(asNumber(heritageCfg.storyTextFontSize, 16))));
  const heritagePreviewWords = Math.max(10, Math.min(260, Math.round(asNumber(heritageCfg.storyPreviewWords, 60))));
  const [heritageStoryExpanded, setHeritageStoryExpanded] = useState(false);
  useEffect(() => {
    setHeritageStoryExpanded(false);
  }, [heritageStoryHtml, heritagePreviewWords]);
  const heritageStoryPreviewText = useMemo(() => {
    const plain = wordsToText(heritageStoryHtml);
    const tokens = plain.split(/\s+/).filter(Boolean);
    if (tokens.length <= heritagePreviewWords) return plain;
    return `${tokens.slice(0, heritagePreviewWords).join(' ')}…`;
  }, [heritageStoryHtml, heritagePreviewWords]);
  const showFullStory = heritageStoryExpanded;
  const heritageStatsAnchorClass = (() => {
    const token = asString(heritageCfg.statsPosition, 'BOTTOM').trim().toUpperCase();
    if (token === 'TOP') return 'top-10 md:top-12';
    if (token === 'MIDDLE') return 'top-1/2 -translate-y-1/2';
    return 'bottom-8 md:bottom-10';
  })();

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
              { id: 'fallback-rtw', label: 'Ready To Wear', href: '/readytowear' },
              { id: 'fallback-ctw', label: 'Custom To Wear', href: '/customtowear' },
              { id: 'fallback-ftb', label: 'Fabrics', href: '/fabricstobuy' },
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
  const footerMapCfg = useMemo(() => asRecord(footerCfg.map), [footerCfg.map]);
  const footerMapEnabled = asBoolean(footerMapCfg.enabled, false);
  const footerMapImage = asString(footerMapCfg.image, '');
  const footerMapOverlayColor = asString(footerMapCfg.overlayColor, '#0a0a0a');
  const footerMapOverlayOpacity = Math.max(
    0,
    Math.min(1, Math.round(asNumber(footerMapCfg.overlayOpacity, 55)) / 100)
  );
  const footerMapHeight = Math.max(80, Math.min(900, Math.round(asNumber(footerMapCfg.minHeight, 320))));
  const instantBuyCfg = useMemo(() => asRecord(asRecord(managerConfig).instantBuy), [managerConfig]);
  const instantBuyRows = Math.max(1, Math.min(4, Math.round(asNumber(instantBuyCfg.rows, 1))));
  const instantBuyColumns = Math.max(1, Math.min(4, Math.round(asNumber(instantBuyCfg.columns, 4))));
  const instantBuyFeatureTiles = useMemo<InstantBuyFeatureTile[]>(() => {
    const entries = asArray(instantBuyCfg.featureCards)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .map((entry, index) => {
        const categoryToken = asString(entry.categoryKey, index === 0 ? 'FTB' : 'RTW').toUpperCase();
        const categoryKey: InstantBuyCategoryKey = categoryToken === 'RTW' ? 'RTW' : 'FTB';
        const modeToken = asString(entry.ctaMode, 'PAGE').toUpperCase();
        const ctaMode: CtaMode = modeToken === 'URL' ? 'URL' : 'PAGE';
        const pageToken = asString(entry.ctaPageKey, '').toUpperCase();
        const categoryFallbackHref = categoryKey === 'RTW' ? '/readytowear' : '/fabricstobuy';
        const ctaHref =
          ctaMode === 'PAGE'
            ? toSafeInternalHref(PAGE_HREF_BY_KEY[pageToken] || normalizeHref(entry.ctaLink, categoryFallbackHref))
            : toSafeInternalHref(normalizeHref(entry.ctaLink, categoryFallbackHref));
        return {
          id: asString(entry.id, `instant-feature-${index + 1}`),
          categoryKey,
          tag: asString(entry.tag, categoryKey === 'RTW' ? 'READY TO WEAR' : 'FABRICS TO BUY').toUpperCase(),
          title: asString(entry.title, categoryKey === 'RTW' ? 'READY TO WEAR' : 'FABRICS TO BUY').toUpperCase(),
          description: asString(entry.description, ''),
          ctaText: asString(entry.ctaText, categoryKey === 'RTW' ? 'SHOP YOUR STYLE' : 'EXPLORE AFRICAN FABRICS').toUpperCase(),
          ctaLink: ctaHref,
          ctaMode,
          ctaPageKey: pageToken || undefined,
          ctaStyle: asRecord(entry.ctaStyle),
          image: resolveManagerImage(entry.image, ''),
          showBadge: asBoolean(entry.showBadge, false),
          badgeText: asString(entry.badgeText, 'NEW').toUpperCase(),
          enabled: true,
          displayOrder: Math.max(1, Math.round(asNumber(entry.displayOrder, index * 2 + 1))),
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (entries.length > 0) return entries;
    return [
      {
        id: 'instant-feature-ftb-fallback',
        categoryKey: 'FTB',
        tag: 'READY TO WEAR',
        title: 'FABRICS TO BUY',
        description: 'The Vibe: The raw DNA of African creativity, premium artisan fabrics sourced directly.',
        ctaText: 'EXPLORE AFRICAN FABRICS',
        ctaLink: '/fabricstobuy',
        ctaMode: 'PAGE',
        ctaPageKey: 'FABRICS',
        ctaStyle: DEFAULT_INLINE_CTA_STYLE,
        image: `${ASSET_BASE}/fabrics_full.jpg`,
        showBadge: false,
        badgeText: 'NEW',
        enabled: true,
        displayOrder: 1,
      },
      {
        id: 'instant-feature-rtw-fallback',
        categoryKey: 'RTW',
        tag: 'READY TO WEAR',
        title: 'READY TO WEAR',
        description: 'The Vibe: Modern convenience meets ancestral elegance.',
        ctaText: 'SHOP YOUR STYLE',
        ctaLink: '/readytowear',
        ctaMode: 'PAGE',
        ctaPageKey: 'READY_TO_WEAR',
        ctaStyle: DEFAULT_INLINE_CTA_STYLE,
        image: `${ASSET_BASE}/rw_full.jpg`,
        showBadge: false,
        badgeText: 'NEW',
        enabled: true,
        displayOrder: 3,
      },
    ];
  }, [instantBuyCfg.featureCards]);
  const instantBuyProductTiles = useMemo<InstantBuyProductTile[]>(() => {
    const entries = asArray(instantBuyCfg.productSlots)
      .map((entry) => asRecord(entry))
      .filter((entry) => asBoolean(entry.enabled, true))
      .map((entry, index) => {
        const categoryToken = asString(entry.categoryKey, index === 0 ? 'FTB' : 'RTW').toUpperCase();
        const categoryKey: InstantBuyCategoryKey = categoryToken === 'RTW' ? 'RTW' : 'FTB';
        const sourceModeToken = asString(entry.sourceMode, 'AUTO_RANDOM').toUpperCase();
        const sourceMode: InstantBuyProductTile['sourceMode'] = sourceModeToken === 'MANUAL' ? 'MANUAL' : 'AUTO_RANDOM';
        const manualTypeToken = asString(entry.manualProductType, categoryKey === 'RTW' ? 'READY_TO_WEAR' : 'FABRIC').toUpperCase();
        const manualProductType: InstantBuyProductTile['manualProductType'] =
          manualTypeToken === 'FABRIC' ? 'FABRIC' : 'READY_TO_WEAR';
        return {
          id: asString(entry.id, `instant-product-${index + 1}`),
          categoryKey,
          sourceMode,
          manualProductType,
          manualProductId: asString(entry.manualProductId, '').trim(),
          manualTitle: asString(entry.manualTitle, ''),
          manualSubtitle: asString(entry.manualSubtitle, ''),
          manualPrice: asString(entry.manualPrice, ''),
          manualImage: resolveManagerImage(entry.manualImage, ''),
          manualHref: toSafeInternalHref(normalizeHref(entry.manualHref, categoryKey === 'RTW' ? '/readytowear' : '/fabricstobuy')),
          randomPoolSize: Math.max(1, Math.min(36, Math.round(asNumber(entry.randomPoolSize, 8)))),
          slideIntervalMs: Math.max(1500, Math.min(30000, Math.round(asNumber(entry.slideIntervalMs, 5000)))),
          showBadge: asBoolean(entry.showBadge, false),
          badgeText: asString(entry.badgeText, 'NEW').toUpperCase(),
          enabled: true,
          displayOrder: Math.max(1, Math.round(asNumber(entry.displayOrder, index * 2 + 2))),
        };
      })
      .sort((a, b) => a.displayOrder - b.displayOrder);
    if (entries.length > 0) return entries;
    return [
      {
        id: 'instant-product-ftb-fallback',
        categoryKey: 'FTB',
        sourceMode: 'AUTO_RANDOM',
        manualProductType: 'FABRIC',
        manualProductId: '',
        manualTitle: '',
        manualSubtitle: '',
        manualPrice: '',
        manualImage: '',
        manualHref: '/fabricstobuy',
        randomPoolSize: 8,
        slideIntervalMs: 5000,
        showBadge: true,
        badgeText: 'NEW',
        enabled: true,
        displayOrder: 2,
      },
      {
        id: 'instant-product-rtw-fallback',
        categoryKey: 'RTW',
        sourceMode: 'AUTO_RANDOM',
        manualProductType: 'READY_TO_WEAR',
        manualProductId: '',
        manualTitle: '',
        manualSubtitle: '',
        manualPrice: '',
        manualImage: '',
        manualHref: '/readytowear',
        randomPoolSize: 8,
        slideIntervalMs: 5000,
        showBadge: false,
        badgeText: '',
        enabled: true,
        displayOrder: 4,
      },
    ];
  }, [instantBuyCfg.productSlots]);
  const instantBuyManualByCategory = useMemo<Record<'RTW' | 'FTB', InstantBuyProductTile | null>>(
    () => ({
      RTW:
        instantBuyProductTiles.find((slot) => slot.categoryKey === 'RTW' && slot.sourceMode === 'MANUAL') || null,
      FTB:
        instantBuyProductTiles.find((slot) => slot.categoryKey === 'FTB' && slot.sourceMode === 'MANUAL') || null,
    }),
    [instantBuyProductTiles]
  );
  const instantBuyResolvedProducts = useMemo<Record<'RTW' | 'FTB', InstantBuyResolvedProductCard>>(() => {
    const resolve = (categoryKey: 'RTW' | 'FTB'): InstantBuyResolvedProductCard => {
      const manual = instantBuyManualByCategory[categoryKey];
      const autoPool = instantBuyAutoProducts[categoryKey] || [];
      const activeIndex = instantBuySlotIndices[categoryKey] || 0;
      if (manual && manual.sourceMode === 'MANUAL') {
        return {
          id: manual.id,
          image: manual.manualImage,
          title: manual.manualTitle || (categoryKey === 'RTW' ? 'Ready To Wear' : 'Fabrics'),
          subtitle: manual.manualSubtitle || '',
          price: manual.manualPrice || '',
          href: manual.manualHref || (categoryKey === 'RTW' ? '/readytowear' : '/fabricstobuy'),
          showBadge: manual.showBadge,
          badgeText: manual.badgeText,
          sourceMode: 'MANUAL',
        };
      }
      if (autoPool.length > 0) {
        const entry = autoPool[(activeIndex + autoPool.length) % autoPool.length];
        return {
          id: entry.id,
          image: entry.image,
          title: entry.title,
          subtitle: entry.subtitle,
          price: entry.price,
          href: entry.href,
          showBadge: false,
          badgeText: '',
          sourceMode: 'AUTO_RANDOM',
        };
      }
      return {
        id: `instant-fallback-${categoryKey.toLowerCase()}`,
        image: categoryKey === 'RTW' ? `${ASSET_BASE}/featured_rw_right.jpg` : `${ASSET_BASE}/fabrics_full.jpg`,
        title: categoryKey === 'RTW' ? 'Kente Jacket' : 'Awon Da',
        subtitle: categoryKey === 'RTW' ? 'Asante Designs' : 'Diallo Fabrics',
        price: categoryKey === 'RTW' ? '$174.89' : '$230.00',
        href: categoryKey === 'RTW' ? '/readytowear' : '/fabricstobuy',
        showBadge: categoryKey === 'FTB',
        badgeText: 'NEW',
        sourceMode: 'AUTO_RANDOM',
      };
    };
    return {
      RTW: resolve('RTW'),
      FTB: resolve('FTB'),
    };
  }, [instantBuyAutoProducts, instantBuyManualByCategory, instantBuySlotIndices]);
  const instantBuyFeatureByCategory = useMemo<Record<'RTW' | 'FTB', InstantBuyFeatureTile>>(() => {
    const fallback = (categoryKey: 'RTW' | 'FTB'): InstantBuyFeatureTile => ({
      id: `instant-feature-fallback-${categoryKey.toLowerCase()}`,
      categoryKey,
      tag: 'READY TO WEAR',
      title: categoryKey === 'RTW' ? 'READY TO WEAR' : 'FABRICS TO BUY',
      description:
        categoryKey === 'RTW'
          ? 'The Vibe: Modern convenience meets ancestral elegance.'
          : 'The Vibe: The raw DNA of African creativity, premium artisan fabrics sourced directly.',
      ctaText: categoryKey === 'RTW' ? 'SHOP YOUR STYLE' : 'EXPLORE AFRICAN FABRICS',
      ctaLink: categoryKey === 'RTW' ? '/readytowear' : '/fabricstobuy',
      ctaMode: 'PAGE',
      ctaPageKey: categoryKey === 'RTW' ? 'READY_TO_WEAR' : 'FABRICS',
      ctaStyle: DEFAULT_INLINE_CTA_STYLE,
      image: categoryKey === 'RTW' ? `${ASSET_BASE}/rw_full.jpg` : `${ASSET_BASE}/fabrics_full.jpg`,
      showBadge: false,
      badgeText: 'NEW',
      enabled: true,
      displayOrder: categoryKey === 'RTW' ? 3 : 1,
    });
    return {
      RTW: instantBuyFeatureTiles.find((item) => item.categoryKey === 'RTW') || fallback('RTW'),
      FTB: instantBuyFeatureTiles.find((item) => item.categoryKey === 'FTB') || fallback('FTB'),
    };
  }, [instantBuyFeatureTiles]);
  const instantBuyOrderedTiles = useMemo(() => {
    const slotsByCategory: Record<'RTW' | 'FTB', InstantBuyProductTile | null> = {
      RTW: instantBuyProductTiles.find((slot) => slot.categoryKey === 'RTW') || null,
      FTB: instantBuyProductTiles.find((slot) => slot.categoryKey === 'FTB') || null,
    };
    const rows = [
      {
        id: instantBuyFeatureByCategory.FTB.id,
        order: Math.max(1, Math.round(asNumber(instantBuyFeatureByCategory.FTB.displayOrder, 1))),
        type: 'feature' as const,
        feature: instantBuyFeatureByCategory.FTB,
      },
      {
        id: slotsByCategory.FTB?.id || 'instant-product-ftb',
        order: Math.max(1, Math.round(asNumber(slotsByCategory.FTB?.displayOrder, 2))),
        type: 'product' as const,
        slot: slotsByCategory.FTB || instantBuyProductTiles[0],
        product: instantBuyResolvedProducts.FTB,
      },
      {
        id: instantBuyFeatureByCategory.RTW.id,
        order: Math.max(1, Math.round(asNumber(instantBuyFeatureByCategory.RTW.displayOrder, 3))),
        type: 'feature' as const,
        feature: instantBuyFeatureByCategory.RTW,
      },
      {
        id: slotsByCategory.RTW?.id || 'instant-product-rtw',
        order: Math.max(1, Math.round(asNumber(slotsByCategory.RTW?.displayOrder, 4))),
        type: 'product' as const,
        slot: slotsByCategory.RTW || instantBuyProductTiles[0],
        product: instantBuyResolvedProducts.RTW,
      },
    ];
    return rows
      .sort((a, b) => a.order - b.order)
      .slice(0, instantBuyRows * instantBuyColumns);
  }, [
    instantBuyColumns,
    instantBuyFeatureByCategory,
    instantBuyProductTiles,
    instantBuyResolvedProducts,
    instantBuyRows,
  ]);
  const showInstantBuySection = isSectionVisible('INSTANT_BUY') && instantBuyOrderedTiles.length > 0;
  const shopByTabs = useMemo(
    () => SHOP_BY_TAB_META.filter((tab) => enabledShopByTabs.includes(tab.key)),
    [enabledShopByTabs]
  );
  const shopBySectionTag = asString(shopByCfg.sectionTag, 'Discover');
  const shopBySectionTitle = asString(shopByCfg.sectionTitle, 'Shop By');
  const shopBySectionDescription = asString(shopByCfg.sectionDescription, 'Browse by category, style, or budget.');
  const showShopBySectionDescription = asBoolean(shopByCfg.sectionDescriptionEnabled, true);
  const shopByCountrySectionTag = asString(shopByCountryCfg.sectionTag, 'Discover');
  const shopByCountrySectionTitle = asString(shopByCountryCfg.sectionTitle, 'Shop By Country');
  const shopByCountrySectionDescription = asString(
    shopByCountryCfg.sectionDescription,
    'Explore traditional textiles and contemporary designs from across the African continent.'
  );
  const showShopByCountrySectionDescription = asBoolean(shopByCountryCfg.sectionDescriptionEnabled, true);
  const topStripCfg = useMemo(() => asRecord(topNavigationsCfg.topStripConfig), [topNavigationsCfg.topStripConfig]);
  const topStripSeparator = asString(topStripCfg.separator, '•');
  const topStripItems = useMemo(() => {
    const messages = asArray(topStripCfg.messages)
      .flatMap((entry) =>
        asString(entry, '')
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
      )
      .filter(Boolean);
    const repeatCount = Math.max(1, Math.min(20, Math.round(asNumber(topStripCfg.repeatCount, 4))));
    const base =
      messages.length > 0
        ? messages
        : ['Bespoke tailoring. Pan-African elegance. Worldwide delivery.'];
    const lane: string[] = [];
    for (let idx = 0; idx < repeatCount; idx += 1) {
      lane.push(...base);
    }
    return lane;
  }, [topStripCfg.messages, topStripCfg.repeatCount]);
  const topStripAnimationSeconds = Math.max(
    6,
    Math.min(180, Math.round(asNumber(topStripCfg.animationSeconds, 36)))
  );
  const topStripPauseOnHover = asBoolean(topStripCfg.pauseOnHover, true);
  const topStripFontSize = Math.max(8, Math.min(22, Math.round(asNumber(topStripCfg.fontSize, 11))));
  const topStripIsBold = asBoolean(topStripCfg.isBold, true);
  const topStripTextColor = asString(topStripCfg.textColor, '#ffffff');
  const topStripBackgroundColor = asString(topStripCfg.backgroundColor, '#111111');
  const customerReviewsSourceMode = ((): 'STATIC_ONLY' | 'PRODUCT_REVIEWS_ONLY' | 'BOTH' => {
    const token = asString(customerReviewsCfg.sourceMode, 'BOTH').toUpperCase();
    if (token === 'STATIC_ONLY' || token === 'PRODUCT_REVIEWS_ONLY' || token === 'BOTH') return token;
    return 'BOTH';
  })();
  const customerReviewsMaxItems = Math.max(1, Math.min(24, Math.round(asNumber(customerReviewsCfg.maxItems, 6))));
  const customerReviewsTitle = asString(customerReviewsCfg.sectionTitle, 'From Our Customers');
  const customerReviewsTitleFontSize = Math.max(18, Math.min(92, Math.round(asNumber(customerReviewsCfg.titleFontSize, 52))));
  const customerReviewsMessageFontSize = Math.max(10, Math.min(40, Math.round(asNumber(customerReviewsCfg.messageFontSize, 14))));
  const customerReviewsMetaFontSize = Math.max(8, Math.min(24, Math.round(asNumber(customerReviewsCfg.metaFontSize, 11))));
  const customerReviewSliderSettings = useMemo<CustomerReviewSliderSettings>(() => {
    const token = asString(
      customerReviewsCfg.displayMode,
      'SLIDER'
    ).toUpperCase();
    return {
      mode: token === 'SLIDER' ? 'SLIDER' : 'GRID',
      autoPlay: asBoolean(customerReviewsCfg.autoplayEnabled, true),
      autoPlayIntervalMs: Math.max(
        1000,
        Math.min(30000, Math.round(asNumber(customerReviewsCfg.autoplayIntervalMs, 5000)))
      ),
      transitionMs: 450,
      showArrows: false,
      showDots: asBoolean(customerReviewsCfg.showIndicators, true),
      pauseOnHover: asBoolean(customerReviewsCfg.pauseOnHover, true),
    };
  }, [
    customerReviewsCfg.displayMode,
    customerReviewsCfg.autoplayEnabled,
    customerReviewsCfg.autoplayIntervalMs,
    customerReviewsCfg.showIndicators,
    customerReviewsCfg.pauseOnHover,
  ]);
  const heroLeftColSpan = Math.max(3, Math.min(9, Math.round(((active?.leftWidthPercent || 58) / 100) * 12)));
  const heroRightColSpan = Math.max(3, 12 - heroLeftColSpan);
  const heroTextAlignClass =
    active?.textVerticalAlign === 'TOP'
      ? 'items-start'
      : active?.textVerticalAlign === 'BOTTOM'
        ? 'items-end'
        : 'items-center';
  const heroRightHasPanelImage =
    active?.rightPanelBackgroundMode === 'IMAGE' &&
    Boolean(stripLegacyFallbackImage(active?.rightPanelBackgroundImage || ''));
  const hamburgerMenuFontSize = Math.max(16, Math.min(72, Math.round(asNumber(topNavigationsCfg.hamburgerMenuFontSize, 32))));
  const hamburgerMenuFontWeight = Math.max(500, Math.min(900, Math.round(asNumber(topNavigationsCfg.hamburgerMenuFontWeight, 800))));
  const footerLogoCfg = useMemo(() => asRecord(footerCfg.logo), [footerCfg.logo]);
  const footerLogoTextRaw = asString(footerLogoCfg.text, asString(footerCfg.brandText, 'ZURIKARIBU'));
  const footerLogoSplit = useMemo(() => {
    const compact = footerLogoTextRaw.replace(/\s+/g, '').trim();
    if (!compact) return { left: 'ZURI', right: 'KARIBU' };
    const upper = compact.toUpperCase();
    if (upper.startsWith('ZURI') && compact.length > 4) {
      return {
        left: compact.slice(0, 4),
        right: compact.slice(4),
      };
    }
    const pivot = Math.max(1, Math.ceil(compact.length / 2));
    return {
      left: compact.slice(0, pivot),
      right: compact.slice(pivot),
    };
  }, [footerLogoTextRaw]);
  const footerLogoImageUrl = resolveManagerImage(footerLogoCfg.imageUrl, '');
  const footerLogoFontWeight = Math.max(100, Math.min(900, Math.round(asNumber(footerLogoCfg.fontWeight, 700))));

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
  const fullDedicatedCountries = useMemo(
    () => countryShowcaseData.slice(0, Math.max(ALL_COUNTRIES_COUNT, countryShowcaseData.length)),
    [countryShowcaseData]
  );
  const visibleDedicatedCountries = useMemo(
    () => (dedicatedCountryExpanded ? fullDedicatedCountries : filteredCountryShowcase.slice(0, 12)),
    [dedicatedCountryExpanded, filteredCountryShowcase, fullDedicatedCountries]
  );
  const resolvedThemeMode = useMemo<'LIGHT' | 'DARK'>(() => {
    const token = asString(themeCfg.mode, 'LIGHT').toUpperCase();
    if (token === 'DARK') return 'DARK';
    if (token === 'SYSTEM' && typeof window !== 'undefined') {
      try {
        if (typeof window.matchMedia === 'function') {
          return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'DARK' : 'LIGHT';
        }
      } catch {
        return 'LIGHT';
      }
    }
    return 'LIGHT';
  }, [themeCfg.mode]);
  const ComputedThemeIcon = themeMode === 'DARK' ? Moon : ThemeIcon;
  const customerReviewCards = useMemo(() => {
    const staticRows = staticReviewCards.filter((entry) => entry.message.length > 0);
    const productRows = productReviewCards.filter((entry) => entry.message.length > 0);
    if (customerReviewsSourceMode === 'STATIC_ONLY') return staticRows.slice(0, customerReviewsMaxItems);
    if (customerReviewsSourceMode === 'PRODUCT_REVIEWS_ONLY') return productRows.slice(0, customerReviewsMaxItems);
    return [...staticRows, ...productRows].slice(0, customerReviewsMaxItems);
  }, [customerReviewsMaxItems, customerReviewsSourceMode, productReviewCards, staticReviewCards]);
  const showCustomerReviewsSection =
    isSectionVisible('CUSTOMER_REVIEWS') &&
    asBoolean(customerReviewsCfg.enabled, true) &&
    customerReviewCards.length > 0;
  const customerReviewActiveCard =
    customerReviewCards.length > 0 ? customerReviewCards[(customerReviewIndex + customerReviewCards.length) % customerReviewCards.length] : null;

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
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-kimi-anim]'));
    if (nodes.length === 0) return;
    if (typeof IntersectionObserver === 'undefined') {
      nodes.forEach((node, idx) => {
        node.style.transitionDelay = `${Math.min(idx % 6, 5) * 60}ms`;
        node.classList.add('is-in');
      });
      return;
    }
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
    if (typeof document === 'undefined') return;
    if (!hamburgerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
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
  useEffect(() => {
    let cancelled = false;
    const shouldLoadProducts =
      asBoolean(customerReviewsCfg.enabled, true) &&
      (customerReviewsSourceMode === 'PRODUCT_REVIEWS_ONLY' || customerReviewsSourceMode === 'BOTH');
    if (!shouldLoadProducts) {
      setProductReviewCards([]);
      return () => {
        cancelled = true;
      };
    }
  const loadProductReviews = async () => {
      try {
        const [ready, designs, fabrics] = await Promise.all([
          api.products.getReadyToWear({ page: 1, limit: 8 }).catch(() => null),
          api.products.getDesigns({ page: 1, limit: 8 }).catch(() => null),
          api.products.getFabrics({ page: 1, limit: 8 }).catch(() => null),
        ]);
        const seeds: Array<{ type: 'ready-to-wear' | 'design' | 'fabric'; id: string; location: string }> = [];
        const pushSeed = (type: 'ready-to-wear' | 'design' | 'fabric', row: unknown) => {
          const record = asRecord(row);
          const id = asString(record.id, asString(record._id, ''));
          if (!id) return;
          seeds.push({
            type,
            id,
            location: asString(record.country, ''),
          });
        };
        asArray(asRecord(ready?.data).products).forEach((row) => pushSeed('ready-to-wear', row));
        asArray(asRecord(designs?.data).designs).forEach((row) => pushSeed('design', row));
        asArray(asRecord(fabrics?.data).fabrics).forEach((row) => pushSeed('fabric', row));
        const uniqueSeeds = Array.from(new Map(seeds.map((seed) => [`${seed.type}:${seed.id}`, seed])).values()).slice(0, 10);
        const reviewResponses = await Promise.all(
          uniqueSeeds.map(async (seed) => {
            const response = await api.products.getProductReviews(seed.type, seed.id, 3).catch(() => null);
            return { seed, response };
          })
        );
        const rows: Array<CustomerReviewCard & { createdAtTs: number }> = [];
        reviewResponses.forEach(({ seed, response }) => {
          asArray(asRecord(asRecord(response).data).reviews).forEach((reviewRaw, reviewIdx) => {
            const review = asRecord(reviewRaw);
            const comment = asString(review.comment, '');
            if (!comment) return;
            const customer = asRecord(review.customer);
            rows.push({
              id: `${seed.type}-${seed.id}-${asString(review.id, String(reviewIdx + 1))}`,
              customerName: asString(customer.name, 'Verified Buyer'),
              location: seed.location || 'Africa',
              message: comment,
              rating: Math.max(1, Math.min(5, Math.round(asNumber(review.rating, 5)))),
              source: 'PRODUCT',
              createdAtTs: Date.parse(asString(review.createdAt, '')) || 0,
            });
          });
        });
        rows.sort((left, right) => right.createdAtTs - left.createdAtTs);
        const normalized = rows.map(({ createdAtTs: _ignore, ...entry }) => entry);
        if (!cancelled) {
          setProductReviewCards(normalized.slice(0, customerReviewsMaxItems * 2));
        }
      } catch {
        if (!cancelled) setProductReviewCards([]);
      }
    };
    void loadProductReviews();
    return () => {
      cancelled = true;
    };
  }, [customerReviewsCfg.enabled, customerReviewsMaxItems, customerReviewsSourceMode]);

  useEffect(() => {
    let cancelled = false;
    const loadFrontpageProductCardSettings = async () => {
      try {
        const [rtw, ftb, ctw] = await Promise.all([
          api.products.getCategoryPageSettings('READY_TO_WEAR').catch(() => null),
          api.products.getCategoryPageSettings('FABRIC_TO_BUY').catch(() => null),
          api.products.getCategoryPageSettings('CUSTOM_TO_WEAR').catch(() => null),
        ]);
        if (cancelled) return;
        setFrontpageProductCardByType({
          READY_TO_WEAR: normalizeProductCardStyle(asRecord(asRecord(rtw).data).settings?.productCard),
          FABRIC_TO_BUY: normalizeProductCardStyle(asRecord(asRecord(ftb).data).settings?.productCard),
          CUSTOM_TO_WEAR: normalizeProductCardStyle(asRecord(asRecord(ctw).data).settings?.productCard),
        });
      } catch {
        if (cancelled) return;
        setFrontpageProductCardByType({
          READY_TO_WEAR: PRODUCT_CARD_FALLBACK_STYLE,
          FABRIC_TO_BUY: PRODUCT_CARD_FALLBACK_STYLE,
          CUSTOM_TO_WEAR: PRODUCT_CARD_FALLBACK_STYLE,
        });
      }
    };
    void loadFrontpageProductCardSettings();
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const loadFreshDropsProducts = async () => {
      try {
        const sourceMode = asString(freshDropsCfg.sourceMode, 'NEWLY_LISTED').toUpperCase();
        if (sourceMode !== 'FILTERED' && sourceMode !== 'NEWLY_LISTED') {
          if (!cancelled) setFreshDropsProducts([]);
          return;
        }
        const rowsPerSource = Math.max(8, Math.round(asNumber(freshDropsCfg.rows, 2)) * Math.round(asNumber(freshDropsCfg.columns, 4)) * 2);
        const [ready, designs, fabrics] = await Promise.all([
          api.products.getReadyToWear({ page: 1, limit: rowsPerSource }).catch(() => null),
          api.products.getDesigns({ page: 1, limit: rowsPerSource }).catch(() => null),
          api.products.getFabrics({ page: 1, limit: rowsPerSource }).catch(() => null),
        ]);

        const toTimestamp = (value: unknown) => {
          const ts = Date.parse(String(value || ''));
          return Number.isFinite(ts) ? ts : 0;
        };
        const normalizedCategoryToken = (value: unknown): 'RTW' | 'CTW' | 'FTB' | '' => {
          const token = String(value || '').trim().toUpperCase();
          if (token === 'RTW' || token === 'READY_TO_WEAR' || token === 'READY-TO-WEAR') return 'RTW';
          if (token === 'CTW' || token === 'CUSTOM_TO_WEAR' || token === 'CUSTOM-TO-WEAR' || token === 'CUSTOM') return 'CTW';
          if (token === 'FTB' || token === 'FABRIC' || token === 'FABRICS' || token === 'FABRICS_TO_BUY' || token === 'FABRICS-TO-BUY') return 'FTB';
          return '';
        };
        const selectedCategoryTokens = freshDropsCategoryFilterTokens
          .map((entry) => normalizedCategoryToken(entry))
          .filter(Boolean);
        const selectedCategorySet = new Set(selectedCategoryTokens);
        const selectedCountrySet = new Set(freshDropsCountryFilterTokens);
        const listingAgeDays = Math.max(1, Math.round(asNumber(freshDropsCfg.listingAgeDays, 14)));
        const listingAgeCutoff = Date.now() - listingAgeDays * 24 * 60 * 60 * 1000;
        const includeOnlyFresh = sourceMode === 'NEWLY_LISTED';

        const rows: Array<{
          id: string;
          image: string;
          name: string;
          description: string;
          brand: string;
          priceUsd: number;
          createdAtTs: number;
          category: 'RTW' | 'CTW' | 'FTB';
          countryCode: string;
          productLabel?: {
            name: string;
            textColor: string;
            backgroundColor: string;
          };
        }> = [];
        const pushRows = (sourceRows: unknown[], category: 'RTW' | 'CTW' | 'FTB') => {
          sourceRows.forEach((raw, index) => {
            const row = asRecord(raw);
            const id = asString(row.id, asString(row._id, `${category}-${index + 1}`));
            if (!id) return;
            const countryToken = asString(
              row.country,
              asString(asRecord(row.designer).country, asString(asRecord(row.seller).country, ''))
            ).toUpperCase();
            if (selectedCountrySet.size > 0 && !selectedCountrySet.has(countryToken)) return;
            if (selectedCategorySet.size > 0 && !selectedCategorySet.has(category)) return;
            const createdAtTs = toTimestamp(row.createdAt);
            if (includeOnlyFresh && createdAtTs > 0 && createdAtTs < listingAgeCutoff) return;
            const image = resolveManagerImage(
              asArray(row.images).map((entry) => asString(asRecord(entry).url, '')).find(Boolean) || row.image || row.coverImage || '',
              ''
            );
            const firstVariantPrice = (() => {
              const variationValues = asArray(row.sizeVariations)
                .map((entry) => asNumber(asRecord(entry).price, 0))
                .filter((entry) => Number.isFinite(entry) && entry > 0);
              return variationValues.length > 0 ? Math.min(...variationValues) : 0;
            })();
            const priceValue = asNumber(
              row.price,
              asNumber(row.finalPrice, asNumber(row.basePrice, asNumber(row.sellerPrice, asNumber(row.listingUsdPrice, firstVariantPrice))))
            );
            const labelRow = asRecord(asArray(row.productLabels)[0]);
            const labelName = asString(labelRow.name, '').trim();
            const productLabel =
              labelName.length > 0
                ? {
                    name: labelName.toUpperCase(),
                    textColor: asString(labelRow.textColor, '#ffffff'),
                    backgroundColor: asString(labelRow.backgroundColor, '#111827'),
                  }
                : undefined;
            rows.push({
              id: `${category}-${id}`,
              image,
              name: asString(row.name, category === 'FTB' ? 'Fabric' : 'Product'),
              description: asString(row.description, ''),
              brand: asString(
                asRecord(row.designer).businessName,
                asString(
                  asRecord(row.seller).businessName,
                  asString(
                    row.designerName,
                    asString(row.sellerName, asString(row.ownerName, category === 'FTB' ? 'Seller' : 'Designer'))
                  )
                )
              ),
              priceUsd: Math.max(0, priceValue),
              href: category === 'RTW' ? `/readytowear/${id}` : category === 'CTW' ? `/customtowear/${id}` : `/fabricstobuy/${id}`,
              createdAtTs,
              category,
              countryCode: countryToken || 'NG',
              productLabel,
            });
          });
        };

        pushRows(asArray(asRecord(ready?.data).products), 'RTW');
        pushRows(asArray(asRecord(designs?.data).designs), 'CTW');
        pushRows(asArray(asRecord(fabrics?.data).fabrics), 'FTB');
        rows.sort((left, right) => right.createdAtTs - left.createdAtTs);

        if (!cancelled) {
          setFreshDropsProducts(rows.map((entry) => ({
            id: entry.id,
            image: entry.image,
            name: entry.name,
            description: entry.description,
            brand: entry.brand,
            priceUsd: entry.priceUsd,
            href: entry.href,
            createdAtTs: entry.createdAtTs,
            category: entry.category,
            countryCode: entry.countryCode,
            productLabel: entry.productLabel,
            label: entry.productLabel?.name || '',
          })));
        }
      } catch {
        if (!cancelled) setFreshDropsProducts([]);
      }
    };
    void loadFreshDropsProducts();
    return () => {
      cancelled = true;
    };
  }, [
    freshDropsCfg.columns,
    freshDropsCfg.listingAgeDays,
    freshDropsCfg.rows,
    freshDropsCfg.sourceMode,
    freshDropsCategoryFilterTokens,
    freshDropsCountryFilterTokens,
  ]);
  useEffect(() => {
    if (!showInstantBuySection) return;
    const timers: number[] = [];
    (['RTW', 'FTB'] as const).forEach((categoryKey) => {
      const slot = instantBuyProductTiles.find(
        (entry) => entry.categoryKey === categoryKey && entry.sourceMode === 'AUTO_RANDOM'
      );
      if (!slot) return;
      const pool = instantBuyAutoProducts[categoryKey] || [];
      if (pool.length <= 1) return;
      const intervalMs = Math.max(1500, Math.min(30000, Math.round(asNumber(slot.slideIntervalMs, 5000))));
      const timer = window.setInterval(() => {
        setInstantBuySlotIndices((prev) => ({
          ...prev,
          [categoryKey]: (prev[categoryKey] + 1) % pool.length,
        }));
      }, intervalMs);
      timers.push(timer);
    });
    return () => {
      timers.forEach((timer) => window.clearInterval(timer));
    };
  }, [instantBuyAutoProducts, instantBuyProductTiles, showInstantBuySection]);
  useEffect(() => {
    if (customerReviewCards.length === 0) {
      setCustomerReviewIndex(0);
      return;
    }
    setCustomerReviewIndex((prev) => ((prev % customerReviewCards.length) + customerReviewCards.length) % customerReviewCards.length);
  }, [customerReviewCards.length]);
  useEffect(() => {
    if (!showCustomerReviewsSection) return;
    if (customerReviewSliderSettings.mode !== 'SLIDER') return;
    if (!customerReviewSliderSettings.autoPlay) return;
    if (customerReviewSliderSettings.pauseOnHover && customerReviewsHovered) return;
    if (customerReviewCards.length <= 1) return;
    const timer = window.setInterval(() => {
      setCustomerReviewIndex((prev) => (prev + 1) % customerReviewCards.length);
    }, customerReviewSliderSettings.autoPlayIntervalMs);
    return () => window.clearInterval(timer);
  }, [
    customerReviewCards.length,
    customerReviewSliderSettings.autoPlay,
    customerReviewSliderSettings.autoPlayIntervalMs,
    customerReviewSliderSettings.mode,
    customerReviewSliderSettings.pauseOnHover,
    customerReviewsHovered,
    showCustomerReviewsSection,
  ]);
  useEffect(() => {
    const node = designerSpotlightStripRef.current;
    syncDesignerSpotlightScrollButtons();
    if (!node || !designerSpotlightNeedsHorizontalScroll) return;
    const handleScroll = () => syncDesignerSpotlightScrollButtons();
    const handleResize = () => syncDesignerSpotlightScrollButtons();
    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    designerSpotlightNeedsHorizontalScroll,
    spotlightCards.length,
    designerSpotlightVisibleColumns,
    syncDesignerSpotlightScrollButtons,
  ]);
  useEffect(() => {
    const node = rtwSpotlightStripRef.current;
    syncRtwSpotlightScrollButtons();
    if (!node || !rtwSpotlightNeedsHorizontalScroll) return;
    const handleScroll = () => syncRtwSpotlightScrollButtons();
    const handleResize = () => syncRtwSpotlightScrollButtons();
    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    rtwSpotlightNeedsHorizontalScroll,
    rtwFtbSpotlightCards.length,
    rtwSpotlightVisibleColumns,
    syncRtwSpotlightScrollButtons,
  ]);
  useEffect(() => {
    const node = ftbSpotlightStripRef.current;
    syncFtbSpotlightScrollButtons();
    if (!node || !ftbSpotlightNeedsHorizontalScroll) return;
    const handleScroll = () => syncFtbSpotlightScrollButtons();
    const handleResize = () => syncFtbSpotlightScrollButtons();
    node.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      node.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [
    ftbSpotlightNeedsHorizontalScroll,
    ftbSpotlightCards.length,
    ftbSpotlightVisibleColumns,
    syncFtbSpotlightScrollButtons,
  ]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'jenks-topstrip-marquee-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes jenksTopStripMarquee {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  const renderDesignerSpotlightCard = (spot: any, key: string, cardClassName = '', cardStyle?: CSSProperties) => (
    <Link
      key={key}
      to={spot.href}
      className={`group relative block h-full w-full overflow-hidden ${cardClassName}`}
      style={cardStyle}
      data-kimi-anim="zoom-in"
    >
      <BrandImageWithFallback
        src={spot.image}
        alt={spot.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        style={{ height: designerSpotlightImageHeight }}
        spinnerClassName="h-8 w-8"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />
      {spot.showTag ? (
        <p className="absolute left-6 top-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-black">
          {spot.tag}
        </p>
      ) : null}
      {spot.showCountry ? (
        <p className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/25 text-xl">
          {countryCodeToFlagEmoji(resolveDesignerCountryCode(spot.countryCode, spot.designerCountry))}
        </p>
      ) : null}
      <div
        className="absolute bottom-6 left-6 right-6 text-white"
        style={{
          backgroundColor: spot.textBackgroundEnabled ? spot.textBackgroundColor : 'transparent',
          padding: spot.textBackgroundEnabled ? '10px 12px' : '0px',
          borderRadius: spot.textBackgroundEnabled ? '2px' : '0px',
        }}
      >
        {spot.showCountry ? (
          <p
            className="font-medium uppercase tracking-[0.08em] text-white/78"
            style={{ fontSize: `${designerSpotlightTypography.countryFontSize}px` }}
          >
            {spot.designerCountry || spot.tag}
          </p>
        ) : null}
        {spot.showDesignerName ? (
          <h3
            className="font-['Oswald'] font-bold uppercase leading-[0.95] text-[var(--spotlight-name-color)] transition-colors duration-300 group-hover:text-[var(--spotlight-name-hover-color)]"
            style={
              {
                fontSize: `${designerSpotlightTypography.nameFontSize}px`,
                '--spotlight-name-color': asString(designerSpotlightTypography.nameColor, '#ffffff'),
                '--spotlight-name-hover-color': asString(
                  designerSpotlightTypography.nameHoverColor,
                  asString(designerSpotlightTypography.nameColor, '#ffffff')
                ),
              } as CSSProperties
            }
          >
            {spot.designerName || spot.title}
          </h3>
        ) : null}
        {spot.showSpecialty ? (
          <p
            className="mt-2 leading-[1.25] text-white/78"
            style={{ fontSize: `${designerSpotlightTypography.specialtyFontSize}px` }}
          >
            {spot.designerSpecialty || 'Contemporary African Designer'}
          </p>
        ) : null}
        {spot.showDescription ? (
          <p
            className="mt-3 max-w-[42ch] leading-[1.35] text-white/88"
            style={{ fontSize: `${designerSpotlightTypography.descriptionFontSize}px` }}
          >
            {spot.description}
          </p>
        ) : null}
        <span
          className="relative mt-5 inline-flex items-center gap-3 border-[var(--cta-border-color)] pb-1 text-[clamp(18px,1.05vw,26px)] font-semibold uppercase tracking-[0.12em] text-[var(--cta-text-color)] transition-colors duration-300 group-hover:border-[var(--cta-hover-border-color)] group-hover:text-[var(--cta-hover-text-color)]"
          style={buildCTAStyle(spot.ctaStyle, {
            ...DEFAULT_INLINE_CTA_STYLE,
            textColor: '#ffffff',
            hoverTextColor: '#ffffff',
            borderColor: 'transparent',
            hoverBorderColor: 'transparent',
          })}
          onMouseEnter={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, true)
          }
          onMouseLeave={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, false)
          }
        >
          {spot.cta}
          <ArrowRight className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 bg-[#e66045] transition-all duration-300 group-hover:w-full" />
        </span>
      </div>
    </Link>
  );

  const renderRtwSpotlightCard = (spot: any, key: string, cardClassName = '', cardStyle?: CSSProperties) => (
    <Link
      key={key}
      to={spot.href}
      className={`group relative block h-full w-full overflow-hidden ${cardClassName}`}
      style={cardStyle}
      data-kimi-anim="zoom-in"
    >
      <BrandImageWithFallback
        src={spot.image}
        alt={spot.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        style={{ height: rtwSpotlightImageHeight }}
        spinnerClassName="h-8 w-8"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />
      {spot.showTag ? (
        <p className="absolute left-6 top-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-black">
          {spot.tag}
        </p>
      ) : null}
      {spot.showCountry ? (
        <p className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/25 text-xl">
          {countryCodeToFlagEmoji(resolveDesignerCountryCode(spot.countryCode, spot.designerCountry))}
        </p>
      ) : null}
      <div
        className="absolute bottom-6 left-6 right-6 text-white"
        style={{
          backgroundColor: spot.textBackgroundEnabled ? spot.textBackgroundColor : 'transparent',
          padding: spot.textBackgroundEnabled ? '10px 12px' : '0px',
          borderRadius: spot.textBackgroundEnabled ? '2px' : '0px',
        }}
      >
        {spot.showPrice ? (
          <p
            className="font-semibold uppercase tracking-[0.08em] text-[var(--rtw-ftb-price-color)] transition-colors duration-300 group-hover:text-[var(--rtw-ftb-price-hover-color)]"
            style={
              {
                fontSize: `${rtwFtbSpotlightTypography.priceFontSize}px`,
                '--rtw-ftb-price-color': asString(rtwFtbSpotlightTypography.priceColor, '#ffffff'),
                '--rtw-ftb-price-hover-color': asString(
                  rtwFtbSpotlightTypography.priceHoverColor,
                  asString(rtwFtbSpotlightTypography.priceColor, '#ffffff')
                ),
              } as CSSProperties
            }
          >
            {spot.price || ''}
          </p>
        ) : null}
        {spot.showCountry ? (
          <p
            className="font-medium uppercase tracking-[0.08em] text-white/78"
            style={{ fontSize: `${rtwFtbSpotlightTypography.countryFontSize}px` }}
          >
            {spot.designerCountry || spot.tag}
          </p>
        ) : null}
        {spot.showDesignerName ? (
          <h3
            className="font-['Oswald'] font-bold uppercase leading-[0.95] text-[var(--rtw-ftb-name-color)] transition-colors duration-300 group-hover:text-[var(--rtw-ftb-name-hover-color)]"
            style={
              {
                fontSize: `${rtwFtbSpotlightTypography.nameFontSize}px`,
                '--rtw-ftb-name-color': asString(rtwFtbSpotlightTypography.nameColor, '#ffffff'),
                '--rtw-ftb-name-hover-color': asString(
                  rtwFtbSpotlightTypography.nameHoverColor,
                  asString(rtwFtbSpotlightTypography.nameColor, '#ffffff')
                ),
              } as CSSProperties
            }
          >
            {spot.designerName || spot.title}
          </h3>
        ) : null}
        {spot.showSpecialty ? (
          <p
            className="mt-2 leading-[1.25] text-white/78"
            style={{ fontSize: `${rtwFtbSpotlightTypography.specialtyFontSize}px` }}
          >
            {spot.designerSpecialty || 'Contemporary African Designer'}
          </p>
        ) : null}
        {spot.showDescription ? (
          <p
            className="mt-3 max-w-[42ch] leading-[1.35] text-white/88"
            style={{ fontSize: `${rtwFtbSpotlightTypography.descriptionFontSize}px` }}
          >
            {spot.description}
          </p>
        ) : null}
        <span
          className="relative mt-5 inline-flex items-center gap-3 border-[var(--cta-border-color)] pb-1 text-[clamp(18px,1.05vw,26px)] font-semibold uppercase tracking-[0.12em] text-[var(--cta-text-color)] transition-colors duration-300 group-hover:border-[var(--cta-hover-border-color)] group-hover:text-[var(--cta-hover-text-color)]"
          style={buildCTAStyle(spot.ctaStyle, {
            ...DEFAULT_INLINE_CTA_STYLE,
            textColor: '#ffffff',
            hoverTextColor: '#ffffff',
            borderColor: 'transparent',
            hoverBorderColor: 'transparent',
          })}
          onMouseEnter={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, true)
          }
          onMouseLeave={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, false)
          }
        >
          {spot.cta}
          <ArrowRight className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 bg-[#e66045] transition-all duration-300 group-hover:w-full" />
        </span>
      </div>
    </Link>
  );

  const renderFtbSpotlightCard = (spot: any, key: string, cardClassName = '', cardStyle?: CSSProperties) => (
    <Link
      key={key}
      to={spot.href}
      className={`group relative block h-full w-full overflow-hidden ${cardClassName}`}
      style={cardStyle}
      data-kimi-anim="zoom-in"
    >
      <BrandImageWithFallback
        src={spot.image}
        alt={spot.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        style={{ height: ftbSpotlightImageHeight }}
        spinnerClassName="h-8 w-8"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/15 to-transparent" />
      {spot.showTag ? (
        <p className="absolute left-6 top-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-black">
          {spot.tag}
        </p>
      ) : null}
      {spot.showCountry ? (
        <p className="absolute right-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-black/25 text-xl">
          {countryCodeToFlagEmoji(resolveDesignerCountryCode(spot.countryCode, spot.designerCountry))}
        </p>
      ) : null}
      <div
        className="absolute bottom-6 left-6 right-6 text-white"
        style={{
          backgroundColor: spot.textBackgroundEnabled ? spot.textBackgroundColor : 'transparent',
          padding: spot.textBackgroundEnabled ? '10px 12px' : '0px',
          borderRadius: spot.textBackgroundEnabled ? '2px' : '0px',
        }}
      >
        {spot.showPrice ? (
          <p
            className="font-semibold uppercase tracking-[0.08em] text-[var(--ftb-price-color)] transition-colors duration-300 group-hover:text-[var(--ftb-price-hover-color)]"
            style={
              {
                fontSize: `${ftbSpotlightTypography.priceFontSize}px`,
                '--ftb-price-color': asString(ftbSpotlightTypography.priceColor, '#ffffff'),
                '--ftb-price-hover-color': asString(
                  ftbSpotlightTypography.priceHoverColor,
                  asString(ftbSpotlightTypography.priceColor, '#ffffff')
                ),
              } as CSSProperties
            }
          >
            {spot.price || ''}
          </p>
        ) : null}
        {spot.showCountry ? (
          <p
            className="font-medium uppercase tracking-[0.08em] text-white/78"
            style={{ fontSize: `${ftbSpotlightTypography.countryFontSize}px` }}
          >
            {spot.designerCountry || spot.tag}
          </p>
        ) : null}
        {spot.showDesignerName ? (
          <h3
            className="font-['Oswald'] font-bold uppercase leading-[0.95] text-[var(--ftb-name-color)] transition-colors duration-300 group-hover:text-[var(--ftb-name-hover-color)]"
            style={
              {
                fontSize: `${ftbSpotlightTypography.nameFontSize}px`,
                '--ftb-name-color': asString(ftbSpotlightTypography.nameColor, '#ffffff'),
                '--ftb-name-hover-color': asString(
                  ftbSpotlightTypography.nameHoverColor,
                  asString(ftbSpotlightTypography.nameColor, '#ffffff')
                ),
              } as CSSProperties
            }
          >
            {spot.designerName || spot.title}
          </h3>
        ) : null}
        {spot.showSpecialty ? (
          <p
            className="mt-2 leading-[1.25] text-white/78"
            style={{ fontSize: `${ftbSpotlightTypography.specialtyFontSize}px` }}
          >
            {spot.designerSpecialty || 'Contemporary African Designer'}
          </p>
        ) : null}
        {spot.showDescription ? (
          <p
            className="mt-3 max-w-[42ch] leading-[1.35] text-white/88"
            style={{ fontSize: `${ftbSpotlightTypography.descriptionFontSize}px` }}
          >
            {spot.description}
          </p>
        ) : null}
        <span
          className="relative mt-5 inline-flex items-center gap-3 border-[var(--cta-border-color)] pb-1 text-[clamp(18px,1.05vw,26px)] font-semibold uppercase tracking-[0.12em] text-[var(--cta-text-color)] transition-colors duration-300 group-hover:border-[var(--cta-hover-border-color)] group-hover:text-[var(--cta-hover-text-color)]"
          style={buildCTAStyle(spot.ctaStyle, {
            ...DEFAULT_INLINE_CTA_STYLE,
            textColor: '#ffffff',
            hoverTextColor: '#ffffff',
            borderColor: 'transparent',
            hoverBorderColor: 'transparent',
          })}
          onMouseEnter={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, true)
          }
          onMouseLeave={(event) =>
            applyHeroCtaHoverState(event.currentTarget, spot.ctaStyle, DEFAULT_INLINE_CTA_STYLE, false)
          }
        >
          {spot.cta}
          <ArrowRight className="h-4 w-4" />
          <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 bg-[#e66045] transition-all duration-300 group-hover:w-full" />
        </span>
      </div>
    </Link>
  );

  return (
    <div className="kimi-site flex flex-col bg-[#f5f3ee] text-[#111]">
      {/* TOP STRIP + TOP NAVIGATION */}
      {isSectionVisible('TOP_NAVIGATIONS') ? (
        <div className="sticky top-0 z-50" style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}>
          {asBoolean(topNavigationsCfg.topStripEnabled, true) ? (
            <div
              className="group relative h-8 overflow-hidden uppercase tracking-[0.18em]"
              style={{
                backgroundColor: topStripBackgroundColor,
                color: topStripTextColor,
                fontSize: `${topStripFontSize}px`,
                fontWeight: topStripIsBold ? 700 : 500,
              }}
              onMouseEnter={() => setTopStripPaused(true)}
              onMouseLeave={() => setTopStripPaused(false)}
            >
              <div
                className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap px-4"
                style={{
                  animationName: 'jenksTopStripMarquee',
                  animationDuration: `${topStripAnimationSeconds}s`,
                  animationTimingFunction: 'linear',
                  animationIterationCount: 'infinite',
                  animationPlayState: topStripPauseOnHover && topStripPaused ? 'paused' : 'running',
                  minWidth: 'max-content',
                }}
              >
                {topStripItems.map((item, idx) => (
                  <span key={`${item}-${idx}`} className="mx-6">
                    {idx > 0 ? `${topStripSeparator} ${item}` : item}
                  </span>
                ))}
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

              <Link to="/" className="absolute left-1/2 -translate-x-1/2">
                {asString(logoCfg.mode, 'TEXT').toUpperCase() === 'IMAGE' && asString(logoCfg.imageUrl, '') ? (
                  <BrandImageWithFallback
                    src={asString(logoCfg.imageUrl, '')}
                    alt={asString(logoCfg.altText, 'Jenks')}
                    className="object-contain"
                    style={{
                      width: Math.max(80, Math.round(asNumber(logoCfg.width, 180))),
                      height: Math.max(24, Math.round(asNumber(logoCfg.height, 50))),
                    }}
                    spinnerClassName="h-4 w-4"
                  />
                ) : (
                  <p
                    className="font-['Oswald'] uppercase leading-none tracking-[0.08em]"
                    style={{
                      color: asString(logoCfg.textColor, '#111111'),
                      fontFamily: asString(logoCfg.fontFamily, 'Oswald'),
                      fontSize: Math.max(18, Math.round(asNumber(logoCfg.fontSize, 27))),
                      fontWeight: headerLogoFontWeight,
                    }}
                  >
                    <span>{logoTextSplit.left}</span>
                    <span className="text-[#e66045]">{logoTextSplit.right}</span>
                  </p>
                )}
              </Link>

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
                className="absolute inset-0 h-full w-full bg-white/40 backdrop-blur-[1px]"
                onClick={() => setSearchOpen(false)}
              />
              <div className="absolute left-1/2 top-16 w-[94vw] max-w-[920px] -translate-x-1/2 rounded-xl border border-black/30 bg-white/95 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur sm:p-5">
                <form
                  className="flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    submitSearchOverlay();
                  }}
                >
                  <Search className="h-5 w-5 text-black/85" />
                  <input
                    type="text"
                    autoFocus
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        submitSearchOverlay();
                      }
                    }}
                    placeholder="Search products, categories, countries..."
                    className="h-11 w-full bg-transparent text-base font-medium text-black placeholder:text-black/60 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex h-9 items-center gap-1 rounded border border-black/40 px-3 text-black hover:bg-black/5"
                    aria-label="Submit search"
                  >
                    <Search className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.08em]">Search</span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-black/20 text-black/70 hover:bg-black/5"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    aria-label="Close search"
                  >
                    ×
                  </button>
                </form>
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
              <div className="absolute left-0 top-0 h-full w-[98vw] max-w-[760px] overflow-hidden bg-black/96 shadow-none">
                <button
                  type="button"
                  className="absolute left-4 top-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                  aria-label="Close menu"
                  onClick={() => setHamburgerOpen(false)}
                >
                  <span className="text-xl leading-none">×</span>
                </button>
                <nav className="scrollbar-hide flex h-full w-full items-start overflow-y-auto px-6 pt-20 sm:px-8">
                  <div className="w-full space-y-2 pb-8">
                    {(hamburgerMenuLinks.length > 0
                      ? hamburgerMenuLinks
                      : [
                          { label: 'Home', href: '/' },
                          { label: 'Shop', href: '/shop' },
                          { label: 'Ready To Wear', href: '/readytowear' },
                          { label: 'Fabrics To Buy', href: '/fabricstobuy' },
                          { label: 'Custom To Wear', href: '/customtowear' },
                          { label: 'Designers', href: '/designers' },
                          { label: 'About Us', href: '/about' },
                          { label: 'Contact Us', href: '/contact' },
                        ]
                    ).map((link) => (
                      <Link
                        key={`${link.label}-${link.href}`}
                        to={toSafeInternalHref(link.href)}
                        className="block whitespace-nowrap px-4 py-3 font-['Oswald'] uppercase leading-none tracking-[0.01em] text-white transition-colors hover:text-[#e66045]"
                        style={{
                          fontSize: `${hamburgerMenuFontSize}px`,
                          fontWeight: hamburgerMenuFontWeight,
                        }}
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
        heroSlides.length > 0 && active ? (
          active.layoutMode === 'FULL' ? (
            <section
              className={`relative flex ${HERO_HEIGHT_CLASS} ${heroTextAlignClass} px-5 py-10 sm:px-8 lg:px-12 xl:px-16`}
              style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}
            >
              <BrandImageWithFallback
                src={active.image}
                alt={active.titleA}
                className="absolute inset-0 h-full w-full object-cover"
                spinnerClassName="h-8 w-8"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/58 via-black/34 to-black/45" />
              <div className="relative ml-auto w-full max-w-[720px] text-right animate-fade-in" data-kimi-anim="fade-up">
                {active.tag ? (
                  <p
                    className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                    style={{ color: active.tagColor }}
                  >
                    {active.tag}
                  </p>
                ) : null}
                <h1
                  className="break-words font-['Oswald'] font-bold uppercase leading-[0.9]"
                  style={{
                    fontSize: `${Math.max(36, Math.min(120, Math.round(active.titleFontSize)))}px`,
                  }}
                >
                  <span style={{ color: active.titleColor }}>{active.titleA}</span>
                  <span className="ml-[0.16em]" style={{ color: active.titleSecondaryColor || active.titleColor }}>
                    {active.titleB}
                  </span>
                </h1>
                {active.textEnabled ? (
                  <p
                    className="mt-6 text-[16px] font-light leading-[1.35] sm:text-[18px]"
                    style={{ color: active.textColor }}
                  >
                    {active.lineA}
                  </p>
                ) : null}
                {active.descriptionEnabled ? (
                  <p
                    className="mt-4"
                    style={{ fontSize: `${active.descriptionFontSize}px`, color: active.descriptionColor }}
                  >
                    {active.lineB}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-wrap items-center justify-end gap-1.5">
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
            </section>
          ) : (
            <section className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 lg:grid-cols-12`} style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}>
              <div className="relative lg:col-span-7" style={{ gridColumn: `span ${heroLeftColSpan} / span ${heroLeftColSpan}` }}>
                {heroSlides.map((slide, i) => (
                  <BrandImageWithFallback
                    key={slide.id}
                    src={slide.image}
                    alt={slide.titleA}
                    className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${
                      i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
                    }`}
                    spinnerClassName="h-8 w-8"
                  />
                ))}
              </div>
              <div
                className={`relative flex ${heroTextAlignClass} px-5 py-10 lg:pl-8 lg:pr-12 xl:pl-10 xl:pr-16`}
                style={{
                  gridColumn: `span ${heroRightColSpan} / span ${heroRightColSpan}`,
                  backgroundColor: '#f5f3ee',
                  backgroundImage: heroRightHasPanelImage ? toSafeBackgroundImage(active.rightPanelBackgroundImage) : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {heroRightHasPanelImage ? <div className="absolute inset-0 bg-[#f5f3ee]/68" /> : null}
                <div className="relative w-full max-w-[520px] pr-3 sm:pr-4 animate-fade-in" data-kimi-anim="fade-up">
                  {active.tag ? (
                    <p
                      className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
                      style={{ color: active.tagColor }}
                    >
                      {active.tag}
                    </p>
                  ) : null}
                  <h1
                    className="break-words font-['Oswald'] font-bold uppercase leading-[0.9]"
                    style={{
                      fontSize: `${Math.max(36, Math.min(120, Math.round(active.titleFontSize)))}px`,
                    }}
                  >
                  <span style={{ color: active.titleColor }}>{active.titleA}</span>
                  <span className="ml-[0.16em]" style={{ color: active.titleSecondaryColor || active.titleColor }}>
                    {active.titleB}
                  </span>
                  </h1>
                  {active.textEnabled ? (
                    <p
                      className="mt-6 text-[16px] font-light leading-[1.35] sm:text-[18px]"
                      style={{ color: active.textColor }}
                    >
                      {active.lineA}
                    </p>
                  ) : null}
                  {active.descriptionEnabled ? (
                    <p
                      className="mt-4"
                      style={{ fontSize: `${active.descriptionFontSize}px`, color: active.descriptionColor }}
                    >
                      {active.lineB}
                    </p>
                  ) : null}
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
          )
        ) : (
          <section
            className={`relative flex ${HERO_HEIGHT_CLASS} items-center justify-center bg-[#0e0e0e]`}
            style={{ order: getSectionOrder('TOP_NAVIGATIONS') }}
          >
            <div className="flex flex-col items-center gap-4 text-white">
              <Loader2 className="h-8 w-8 animate-spin text-[#e66045]" />
              <p className="font-['Oswald'] text-3xl font-bold uppercase tracking-[0.08em]">ZURIKARIBU</p>
            </div>
          </section>
        )
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
                    <BrandImageWithFallback
                      src={card.image}
                      alt={card.title}
                      className="h-[82vh] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      spinnerClassName="h-6 w-6"
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
      {isSectionVisible('SHOP_BY_COUNTRY') ? (
        <section className="bg-[#06080b] py-12 lg:py-14" data-kimi-anim="fade-up" style={{ order: getSectionOrder('SHOP_BY_COUNTRY') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">{shopByCountrySectionTag}</p>
              <h2 className="mt-2 font-['Oswald'] text-6xl font-bold uppercase leading-none text-white">{shopByCountrySectionTitle}</h2>
              {showShopByCountrySectionDescription ? (
                <p className="mt-3 max-w-2xl text-base text-white/62">{shopByCountrySectionDescription}</p>
              ) : null}
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
                className="group flex flex-col items-center px-1 py-2 text-center text-white transition-colors hover:text-[#e66045]"
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
      {visibleCategorySections.map((section) => {
        const sectionKey = String(section.key || '').trim().toUpperCase() as 'RTW' | 'FTB' | 'CTW';
        const sectionTemplateKey = CATEGORY_SECTION_TEMPLATE_BY_KEY[sectionKey];
        return (
          <section key={section.id} className="space-y-0" style={{ order: getSectionOrder(sectionTemplateKey, 'CATEGORY_MANAGE') }}>
            <div
              className={`group grid ${HERO_HEIGHT_CLASS} grid-cols-1 ${
                section.textOnLeft ? 'md:grid-cols-[32%_68%]' : 'md:grid-cols-[68%_32%]'
              }`}
            >
              {section.textOnLeft ? (
                <>
                  <div className={`relative overflow-hidden px-8 py-12 text-white ${section.panelBg}`} data-kimi-anim="sidebar-left">
                    <div
                      className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center blur-2xl"
                      style={{ backgroundImage: toSafeBackgroundImage(section.image), opacity: 0.18 }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/70" />
                    <div className="relative flex h-full items-center">
                      <div className="flex h-full max-w-[560px] flex-col items-start justify-center text-left">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">{section.sectionName}</p>
                        <h3
                          className="mt-5 font-['Oswald'] text-[54px] font-bold uppercase leading-[0.92] text-[var(--featured-title-color)] transition-colors duration-300 group-hover:text-[var(--featured-title-hover-color)] lg:text-[72px]"
                          style={
                            {
                              '--featured-title-color': asString(section.titleColor, '#ffffff'),
                              '--featured-title-hover-color': asString(section.titleHoverColor, asString(section.titleColor, '#ffffff')),
                            } as CSSProperties
                          }
                        >
                          {section.title}
                        </h3>
                        <p className="mt-5 max-w-[560px] text-base leading-relaxed text-white/74 sm:text-lg">{section.description}</p>
                      <Link
                        to={sectionCtaHref(section)}
                        style={buildCTAStyle(section.ctaStyle, DEFAULT_SOLID_CTA_STYLE)}
                        className="mt-9 inline-flex items-center border-[var(--cta-border-color)] px-0 py-2.5 text-[var(--cta-text-color)] text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-300 hover:border-[var(--cta-hover-border-color)] hover:text-[var(--cta-hover-text-color)] hover:underline hover:decoration-[#d40000] hover:underline-offset-[6px]"
                        onMouseEnter={(event) =>
                          applyHeroCtaHoverState(event.currentTarget, section.ctaStyle, DEFAULT_SOLID_CTA_STYLE, true)
                        }
                        onMouseLeave={(event) =>
                          applyHeroCtaHoverState(event.currentTarget, section.ctaStyle, DEFAULT_SOLID_CTA_STYLE, false)
                        }
                      >
                          {section.cta}
                      </Link>
                      </div>
                    </div>
                  </div>
                  <div className="relative h-full w-full">
                    <BrandImageWithFallback
                      src={section.image}
                      alt={section.sectionName}
                      className="h-full w-full object-cover"
                      spinnerClassName="h-7 w-7"
                      data-kimi-anim="zoom-in"
                    />
                    {section.stepsEnabled && section.stepCards.length > 0 ? renderCategoryStepCards(section) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="relative h-full w-full">
                    <BrandImageWithFallback
                      src={section.image}
                      alt={section.sectionName}
                      className="h-full w-full object-cover"
                      spinnerClassName="h-7 w-7"
                      data-kimi-anim="zoom-in"
                    />
                    {section.stepsEnabled && section.stepCards.length > 0 ? renderCategoryStepCards(section) : null}
                  </div>
                  <div className={`relative overflow-hidden px-8 py-12 text-white ${section.panelBg}`} data-kimi-anim="sidebar-right">
                    <div
                      className="pointer-events-none absolute inset-0 scale-105 bg-cover bg-center blur-2xl"
                      style={{ backgroundImage: toSafeBackgroundImage(section.image), opacity: 0.18 }}
                    />
                    <div className="pointer-events-none absolute inset-0 bg-black/70" />
                    <div className="relative flex h-full items-center">
                      <div className="flex h-full max-w-[560px] flex-col items-start justify-center text-left">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/72">{section.sectionName}</p>
                        <h3
                          className="mt-5 font-['Oswald'] text-[54px] font-bold uppercase leading-[0.92] text-[var(--featured-title-color)] transition-colors duration-300 group-hover:text-[var(--featured-title-hover-color)] lg:text-[72px]"
                          style={
                            {
                              '--featured-title-color': asString(section.titleColor, '#ffffff'),
                              '--featured-title-hover-color': asString(section.titleHoverColor, asString(section.titleColor, '#ffffff')),
                            } as CSSProperties
                          }
                        >
                          {section.title}
                        </h3>
                        <p className="mt-5 max-w-[560px] text-base leading-relaxed text-white/74 sm:text-lg">{section.description}</p>
                      <Link
                        to={sectionCtaHref(section)}
                        style={buildCTAStyle(section.ctaStyle, DEFAULT_SOLID_CTA_STYLE)}
                        className="mt-9 inline-flex items-center border-[var(--cta-border-color)] px-0 py-2.5 text-[var(--cta-text-color)] text-xs font-semibold uppercase tracking-[0.12em] transition-colors duration-300 hover:border-[var(--cta-hover-border-color)] hover:text-[var(--cta-hover-text-color)] hover:underline hover:decoration-[#d40000] hover:underline-offset-[6px]"
                        onMouseEnter={(event) =>
                          applyHeroCtaHoverState(event.currentTarget, section.ctaStyle, DEFAULT_SOLID_CTA_STYLE, true)
                        }
                        onMouseLeave={(event) =>
                          applyHeroCtaHoverState(event.currentTarget, section.ctaStyle, DEFAULT_SOLID_CTA_STYLE, false)
                        }
                      >
                          {section.cta}
                      </Link>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>
        );
      })}

      {/* HOW IT WORKS */}
      {showHowItWorksSection ? (
      <section className="bg-white py-12" data-kimi-anim="fade-up" style={{ order: getSectionOrder('HOW_IT_WORKS') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          {sectionTitlesEnabled && getTextIconHeadingConfig('HOW_IT_WORKS').titleEnabled ? (
            <h2
              className={`font-['Oswald'] font-bold uppercase ${textIconSectionTitleClass('HOW_IT_WORKS')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('HOW_IT_WORKS').titleFontSize}px` }}
            >
              {textIconSectionHeading('HOW_IT_WORKS')}
            </h2>
          ) : null}
          {getTextIconHeadingConfig('HOW_IT_WORKS').descriptionEnabled ? (
            <p
              className={`mt-2 text-black/65 ${textIconSectionTitleClass('HOW_IT_WORKS')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('HOW_IT_WORKS').descriptionFontSize}px` }}
            >
              {getTextIconHeadingConfig('HOW_IT_WORKS').description}
            </p>
          ) : null}
          <div className={`mt-6 flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide ${sectionTitlesEnabled ? '' : 'mt-0'}`}>
            {howItWorksCards.map((item) => renderTextIconCard('HOW_IT_WORKS', item))}
          </div>
        </div>
      </section>
      ) : null}

      {/* CUSTOM TEXT & ICON */}
      {showCustomTextIconSection ? (
      <section className="bg-white py-12" data-kimi-anim="fade-up" style={{ order: getSectionOrder('CUSTOM_TEXT_ICON') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          {sectionTitlesEnabled && getTextIconHeadingConfig('CUSTOM').titleEnabled ? (
            <h2
              className={`font-['Oswald'] font-bold uppercase ${textIconSectionTitleClass('CUSTOM')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('CUSTOM').titleFontSize}px` }}
            >
              {textIconSectionHeading('CUSTOM')}
            </h2>
          ) : null}
          {getTextIconHeadingConfig('CUSTOM').descriptionEnabled ? (
            <p
              className={`mt-2 text-black/65 ${textIconSectionTitleClass('CUSTOM')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('CUSTOM').descriptionFontSize}px` }}
            >
              {getTextIconHeadingConfig('CUSTOM').description}
            </p>
          ) : null}
          <div className={`mt-6 flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide ${sectionTitlesEnabled ? '' : 'mt-0'}`}>
            {customTextIconCards.map((item) => renderTextIconCard('CUSTOM', item))}
          </div>
        </div>
      </section>
      ) : null}

      {/* FEATURED RTW + CTW + FTB */}
      {visibleFeaturedKeys.map((key) => {
        const sectionTemplateKey = FEATURED_SECTION_TEMPLATE_BY_KEY[key];
        return (
          <section key={`featured-${key}`} className="space-y-0" style={{ order: getSectionOrder(sectionTemplateKey, 'FEATURED') }}>
            <div
              className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 gap-0 ${
                (featuredLayoutByKey[key]?.columns ?? featuredColumns) >= 4
                  ? 'md:grid-cols-4'
                  : (featuredLayoutByKey[key]?.columns ?? featuredColumns) === 3
                    ? 'md:grid-cols-3'
                    : (featuredLayoutByKey[key]?.columns ?? featuredColumns) === 1
                      ? 'md:grid-cols-1'
                      : 'md:grid-cols-2'
              }`}
            >
              {featuredCardsByKey[key]
                .slice(0, (featuredLayoutByKey[key]?.rows ?? 1) * (featuredLayoutByKey[key]?.columns ?? featuredColumns))
                .map((card) => (
                  <Link key={card.id} to={featuredCardHref(card, key)} className="group relative overflow-hidden" data-kimi-anim="zoom-in">
                    <BrandImageWithFallback
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      spinnerClassName="h-6 w-6"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <p className="absolute left-6 top-6 text-[12px] font-semibold uppercase tracking-[0.2em] text-white/72">{card.tag}</p>
                    <div className="absolute bottom-[10%] right-6 max-w-[58%] text-right text-white">
                      <p className="font-['Oswald'] text-4xl font-bold uppercase leading-[0.95]">{card.title}</p>
                      <p className="mt-2 text-sm text-white/78">{card.subtitle}</p>
                      <span
                        className="mt-4 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-[0.06em] text-white/92 hover:underline hover:decoration-[#d40000] hover:underline-offset-[6px]"
                        style={buildCTAStyle(card.ctaStyle, DEFAULT_INLINE_CTA_STYLE)}
                      >
                        {card.cta}
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        );
      })}

      {/* INSTANT BUY */}
      {showInstantBuySection ? (
        <section className="bg-[#f5f5f3] py-0" data-kimi-anim="fade-up" style={{ order: getSectionOrder('INSTANT_BUY') }}>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-4">
            {instantBuyOrderedTiles.map((tile) => {
              if (tile.type === 'feature') {
                const card = tile.feature;
                return (
                  <Link key={tile.id} to={toSafeInternalHref(card.ctaLink)} className="group relative block min-h-[68vh] overflow-hidden">
                    <BrandImageWithFallback
                      src={card.image}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                      spinnerClassName="h-6 w-6"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/42 to-transparent" />
                    <p className="absolute left-5 top-5 text-[12px] font-semibold uppercase tracking-[0.18em] text-black/95">
                      {card.tag}
                    </p>
                    {card.showBadge && card.badgeText ? (
                      <span className="absolute right-5 top-5 bg-[#e66045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                        {card.badgeText}
                      </span>
                    ) : null}
                    <div className="absolute bottom-5 left-5 right-5">
                      <div className="inline-block bg-black px-3 py-2">
                        <p className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.9] text-white">{card.title}</p>
                      </div>
                      {card.description ? <p className="mt-3 max-w-[95%] text-sm leading-relaxed text-white/90">{card.description}</p> : null}
                      <span
                        className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.12em] text-white"
                        style={buildCTAStyle(card.ctaStyle, DEFAULT_INLINE_CTA_STYLE)}
                      >
                        {card.ctaText}
                      </span>
                    </div>
                  </Link>
                );
              }

              const slot = tile.slot;
              const product = tile.product;
              const cardHref = toSafeInternalHref(product.href || productGroupHref(slot.categoryKey));
              return (
                <Link key={tile.id} to={cardHref} className="group block min-h-[68vh] overflow-hidden bg-white">
                  <div className="relative h-[78%] overflow-hidden bg-[#111]">
                    <BrandImageWithFallback
                      src={product.image}
                      alt={product.title || 'Instant Buy product'}
                      className="h-full w-full object-cover transition-opacity duration-500"
                      spinnerClassName="h-5 w-5"
                    />
                    {slot.showBadge && slot.badgeText ? (
                      <span className="absolute left-4 top-4 bg-[#e66045] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                        {slot.badgeText}
                      </span>
                    ) : null}
                  </div>
                  <div className="h-[22%] p-4">
                    <p className="text-[40px] font-semibold leading-[1.02] tracking-[-0.01em] text-black">{product.title}</p>
                    {product.subtitle ? <p className="mt-1 text-xl text-black/65">{product.subtitle}</p> : null}
                    {product.price ? <p className="mt-2 text-[30px] font-semibold text-[#e66045]">{product.price}</p> : null}
                  </div>
                </Link>
              );
            })}
          </div>
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
            {freshDropsCards.map((drop) => {
              const productPageType = PRODUCT_PAGE_BY_SECTION_KEY[drop.category || 'RTW'];
              const cardCfg = frontpageProductCardByType[productPageType] || PRODUCT_CARD_FALLBACK_STYLE;
              const labelText = asString(drop.productLabel?.name, asString(drop.label, '')).trim();
              const fieldRenderers: Record<ProductCardFieldKey, () => JSX.Element | null> = {
                DESIGNER_NAME: () =>
                  cardCfg.designerNameEnabled ? (
                    <p
                      className="leading-tight"
                      style={{ fontSize: `${cardCfg.designerNameFontSize}px`, color: cardCfg.designerNameColor }}
                    >
                      {drop.brand}
                    </p>
                  ) : null,
                PRODUCT_NAME: () =>
                  cardCfg.productNameEnabled ? (
                    <h3
                      className="line-clamp-1 leading-tight"
                      style={{ fontSize: `${cardCfg.productNameFontSize}px`, color: cardCfg.productNameColor, fontWeight: 500 }}
                    >
                      {drop.name}
                    </h3>
                  ) : null,
                SHORT_DESCRIPTION: () =>
                  cardCfg.shortDescriptionEnabled ? (
                    <p
                      className="line-clamp-2 leading-snug"
                      style={{ fontSize: `${cardCfg.shortDescriptionFontSize}px`, color: cardCfg.shortDescriptionColor }}
                    >
                      {truncateWords(drop.description || '', cardCfg.shortDescriptionWordLimit)}
                    </p>
                  ) : null,
                PRICE: () =>
                  cardCfg.priceEnabled ? (
                    <p
                      className="leading-tight"
                      style={{
                        fontSize: `${cardCfg.priceFontSize}px`,
                        fontWeight: cardCfg.priceFontWeight,
                        color: cardCfg.priceColor,
                      }}
                    >
                      ${Number(drop.priceUsd || 0).toFixed(2)}
                    </p>
                  ) : null,
              };
              return (
              <Link
                key={drop.id}
                to={toSafeInternalHref(drop.href)}
                aria-label={`Open ${drop.name} quick view`}
                className="group min-w-[312px] flex-1 overflow-hidden border border-black/10 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-black/20 hover:shadow-[0_18px_46px_rgba(0,0,0,0.2)] md:min-w-[calc((100%-24px)/4)]"
              >
                {cardCfg.imageEnabled ? (
                  <div
                    className="relative overflow-hidden"
                    style={{ aspectRatio: cardCfg.imageAspectRatio === '1:1' ? '1 / 1' : '3 / 4' }}
                  >
                    <BrandImageWithFallback
                      src={drop.image}
                      alt={drop.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      spinnerClassName="h-6 w-6"
                    />
                    {cardCfg.labelEnabled && labelText ? (
                      <span
                        className="absolute left-3 top-3 rounded px-2 py-1 uppercase tracking-[0.06em]"
                        style={{
                          fontSize: `${cardCfg.labelFontSize}px`,
                          color: asString(drop.productLabel?.textColor, cardCfg.labelTextColor),
                          backgroundColor: asString(drop.productLabel?.backgroundColor, cardCfg.labelBackgroundColor),
                        }}
                      >
                        {labelText}
                      </span>
                    ) : null}
                    {cardCfg.likesEnabled ? (
                      <span className="absolute right-3 top-3">
                        <Heart
                          className="drop-shadow"
                          style={{
                            width: `${cardCfg.likesSize}px`,
                            height: `${cardCfg.likesSize}px`,
                            color: cardCfg.likesColor,
                          }}
                        />
                      </span>
                    ) : null}
                    {cardCfg.countryIconEnabled ? (
                      <span className="absolute bottom-3 right-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/40 bg-white/90 text-lg shadow">
                        {countryCodeToFlagEmoji(drop.countryCode)}
                      </span>
                    ) : null}
                    <span className="pointer-events-none absolute inset-0 inline-flex items-center justify-center opacity-0 transition-all duration-300 group-hover:opacity-100">
                      <span className="inline-flex items-center gap-2 border border-white/70 bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                        Quick View
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </span>
                  </div>
                ) : null}
                <div
                  style={{
                    paddingLeft: `${cardCfg.contentPaddingX}px`,
                    paddingRight: `${cardCfg.contentPaddingX}px`,
                    paddingTop: `${cardCfg.contentPaddingY}px`,
                    paddingBottom: `${cardCfg.contentPaddingY}px`,
                    display: 'grid',
                    gap: `${cardCfg.textGap}px`,
                  }}
                >
                  {cardCfg.fieldOrder.map((fieldKey) => fieldRenderers[fieldKey]?.() || null)}
                </div>
              </Link>
              );
            })}
          </div>
        </div>
      </section>
      ) : null}

      {/* SPOTLIGHT */}
      {isSectionVisible('DESIGNER_SPOTLIGHT') ? (
        <section
          className={`${HERO_HEIGHT_CLASS} bg-[#101010] ${designerSpotlightNeedsHorizontalScroll ? 'relative' : `grid grid-cols-1 gap-0 ${designerSpotlightColsClass}`}`}
          style={{ order: getSectionOrder('DESIGNER_SPOTLIGHT'), minHeight: designerSpotlightSectionMinHeight }}
        >
          {designerSpotlightNeedsHorizontalScroll ? (
            <>
              <button
                type="button"
                onClick={() => scrollDesignerSpotlight('LEFT')}
                disabled={!designerCanScrollLeft}
                className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll designer spotlight left"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollDesignerSpotlight('RIGHT')}
                disabled={!designerCanScrollRight}
                className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll designer spotlight right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div
                ref={designerSpotlightStripRef}
                className="flex h-full items-stretch overflow-x-auto scroll-smooth scrollbar-hide"
                style={{ '--designer-card-basis': designerSpotlightCardBasis, minHeight: designerSpotlightSectionMinHeight } as CSSProperties}
              >
                {spotlightCards.map((spot) =>
                  renderDesignerSpotlightCard(
                    spot,
                    `designer-${spot.id}`,
                    'h-full shrink-0 basis-full self-stretch md:[flex-basis:var(--designer-card-basis)]',
                    { minHeight: designerSpotlightCardMinHeight }
                  )
                )}
              </div>
            </>
          ) : (
            spotlightCards.map((spot) =>
              renderDesignerSpotlightCard(spot, `designer-${spot.id}`, '', { minHeight: designerSpotlightCardMinHeight })
            )
          )}
        </section>
      ) : null}

      {/* RTW SPOTLIGHT */}
      {isSectionVisible('RTW_FTB') ? (
        <section
          className={`${HERO_HEIGHT_CLASS} bg-[#101010] ${rtwSpotlightNeedsHorizontalScroll ? 'relative' : `grid grid-cols-1 gap-0 ${rtwFtbSpotlightColsClass}`}`}
          style={{ order: getSectionOrder('RTW_FTB'), minHeight: rtwSpotlightSectionMinHeight }}
        >
          {rtwSpotlightNeedsHorizontalScroll ? (
            <>
              <button
                type="button"
                onClick={() => scrollRtwSpotlight('LEFT')}
                disabled={!rtwCanScrollLeft}
                className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll RTW spotlight left"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollRtwSpotlight('RIGHT')}
                disabled={!rtwCanScrollRight}
                className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll RTW spotlight right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div
                ref={rtwSpotlightStripRef}
                className="flex h-full items-stretch overflow-x-auto scroll-smooth scrollbar-hide"
                style={{ '--rtw-card-basis': rtwSpotlightCardBasis, minHeight: rtwSpotlightSectionMinHeight } as CSSProperties}
              >
                {rtwFtbSpotlightCards.map((spot) =>
                  renderRtwSpotlightCard(
                    spot,
                    `rtw-ftb-${spot.id}`,
                    'h-full shrink-0 basis-full self-stretch md:[flex-basis:var(--rtw-card-basis)]',
                    { minHeight: rtwSpotlightCardMinHeight }
                  )
                )}
              </div>
            </>
          ) : (
            rtwFtbSpotlightCards.map((spot) =>
              renderRtwSpotlightCard(spot, `rtw-ftb-${spot.id}`, '', { minHeight: rtwSpotlightCardMinHeight })
            )
          )}
        </section>
      ) : null}

      {/* FTB SPOTLIGHT */}
      {isSectionVisible('FTB_SPOTLIGHT') ? (
        <section
          className={`${HERO_HEIGHT_CLASS} bg-[#101010] ${ftbSpotlightNeedsHorizontalScroll ? 'relative' : `grid grid-cols-1 gap-0 ${ftbSpotlightColsClass}`}`}
          style={{ order: getSectionOrder('FTB_SPOTLIGHT'), minHeight: ftbSpotlightSectionMinHeight }}
        >
          {ftbSpotlightNeedsHorizontalScroll ? (
            <>
              <button
                type="button"
                onClick={() => scrollFtbSpotlight('LEFT')}
                disabled={!ftbCanScrollLeft}
                className="absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll FTB spotlight left"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => scrollFtbSpotlight('RIGHT')}
                disabled={!ftbCanScrollRight}
                className="absolute right-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center border border-white/30 bg-black/45 text-white transition-colors hover:border-white/60 hover:bg-black/65 disabled:cursor-not-allowed disabled:opacity-40 md:inline-flex"
                aria-label="Scroll FTB spotlight right"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div
                ref={ftbSpotlightStripRef}
                className="flex h-full items-stretch overflow-x-auto scroll-smooth scrollbar-hide"
                style={{ '--ftb-card-basis': ftbSpotlightCardBasis, minHeight: ftbSpotlightSectionMinHeight } as CSSProperties}
              >
                {ftbSpotlightCards.map((spot) =>
                  renderFtbSpotlightCard(
                    spot,
                    `ftb-${spot.id}`,
                    'h-full shrink-0 basis-full self-stretch md:[flex-basis:var(--ftb-card-basis)]',
                    { minHeight: ftbSpotlightCardMinHeight }
                  )
                )}
              </div>
            </>
          ) : (
            ftbSpotlightCards.map((spot) => renderFtbSpotlightCard(spot, `ftb-${spot.id}`, '', { minHeight: ftbSpotlightCardMinHeight }))
          )}
        </section>
      ) : null}

      {/* ROOTED IN CULTURE */}
      {isSectionVisible('HERITAGE') ? (
        <section className="relative min-h-[84vh]" data-kimi-anim="fade-up" style={{ order: getSectionOrder('HERITAGE') }}>
          <BrandImageWithFallback
            src={asString(stripLegacyFallbackImage(heritageCfg.image), '')}
            alt="heritage"
            className="absolute inset-0 h-full w-full object-cover"
            spinnerClassName="h-7 w-7"
          />
          {hasImageSource(stripLegacyFallbackImage(heritageCfg.image)) ? <div className="absolute inset-0 bg-black/22" /> : null}
          <div className="relative mx-auto flex min-h-[84vh] w-full max-w-[1480px] flex-col px-8 py-10 text-white md:px-10 md:py-12">
            <div className="w-full max-w-xl text-left">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/72">
                {asString(heritageCfg.tag, 'Heritage')}
              </p>
              <h2 className="mt-2 font-['Oswald'] text-6xl font-bold uppercase leading-[0.92]">
                {asString(heritageCfg.title, 'ROOTED IN CULTURE.')}
              </h2>
              <p className="mt-3 max-w-xl text-base text-white/82">
                {asString(
                  heritageCfg.description,
                  "The world is yet to experience Africa's fashion. We're building the bridge connecting heritage craft to modern wardrobes everywhere."
                )}
              </p>
            </div>

            <div className="mt-8 flex-1">
              <div className="ml-auto w-full max-w-3xl text-right">
                <h3
                  className="font-['Oswald'] font-bold uppercase leading-[0.94] text-white"
                  style={{ fontSize: `${heritageStoryTitleFontSize}px` }}
                >
                  {heritageStoryTitle}
                </h3>
                <div
                  className="mt-4 max-h-[34vh] overflow-y-auto pr-1 text-white/84 [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar]:w-1 [&_a]:text-white [&_a]:underline [&_b]:text-white [&_br]:leading-[1.35] [&_h1]:text-white [&_h2]:text-white [&_h3]:text-white [&_li]:text-white/84 [&_ol]:my-0 [&_p]:my-0 [&_p+*]:mt-3 [&_strong]:text-white [&_ul]:my-0"
                  style={{ fontSize: `${heritageStoryTextFontSize}px`, lineHeight: 1.45 }}
                >
                  {showFullStory ? (
                    <div dangerouslySetInnerHTML={{ __html: heritageStoryHtml }} />
                  ) : (
                    <p>{heritageStoryPreviewText}</p>
                  )}
                </div>
                {isExternalHref(heritageReadMoreHref) ? (
                  <a
                    href={heritageReadMoreHref}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setHeritageStoryExpanded((prev) => !prev)}
                    className="group relative z-20 mt-6 inline-flex items-center gap-2 pb-1 text-sm font-semibold uppercase tracking-[0.08em] text-white"
                  >
                    {heritageReadMoreLabel}
                    <ArrowRight className="h-4 w-4" />
                    <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 bg-[#e66045] transition-all duration-300 group-hover:w-full" />
                  </a>
                ) : (
                  <Link
                    to={heritageReadMoreHref}
                    onClick={() => setHeritageStoryExpanded((prev) => !prev)}
                    className="group relative z-20 mt-6 inline-flex items-center gap-2 pb-1 text-sm font-semibold uppercase tracking-[0.08em] text-white"
                  >
                    {heritageReadMoreLabel}
                    <ArrowRight className="h-4 w-4" />
                    <span className="pointer-events-none absolute bottom-0 left-0 h-[2px] w-0 bg-[#e66045] transition-all duration-300 group-hover:w-full" />
                  </Link>
                )}
              </div>
            </div>
            <div className={`pointer-events-none absolute left-8 z-10 md:left-10 ${heritageStatsAnchorClass}`}>
              <div className="flex flex-wrap items-end gap-x-8 gap-y-4 px-1 py-1">
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

      {/* FROM OUR CUSTOMERS */}
      {showCustomerReviewsSection ? (
        <section className="bg-[#0b0e14] py-14 lg:py-16" data-kimi-anim="fade-up" style={{ order: getSectionOrder('CUSTOMER_REVIEWS') }}>
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">From Our Customers</p>
            <h2
              className="mt-2 text-center font-['Oswald'] font-bold uppercase leading-none text-white"
              style={{ fontSize: `${customerReviewsTitleFontSize}px` }}
            >
              {customerReviewsTitle}
            </h2>
            {customerReviewSliderSettings.mode === 'SLIDER' ? (
              <div
                className="relative mx-auto mt-8 flex w-full max-w-3xl flex-col items-center justify-center"
                onMouseEnter={() => setCustomerReviewsHovered(true)}
                onMouseLeave={() => setCustomerReviewsHovered(false)}
              >
                {customerReviewActiveCard ? (
                  <article
                    key={customerReviewActiveCard.id}
                    className="w-full max-w-3xl p-6 text-center text-white transition-all"
                    style={{ transitionDuration: `${customerReviewSliderSettings.transitionMs}ms` }}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <p className="font-semibold uppercase tracking-[0.08em]">{customerReviewActiveCard.customerName}</p>
                    </div>
                    <p className="mt-1 text-white/62" style={{ fontSize: `${customerReviewsMetaFontSize}px` }}>
                      {customerReviewActiveCard.location || 'Africa'}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-1 text-[#f6b73c]">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={`${customerReviewActiveCard.id}-star-${starIndex}`}
                          className={`h-3.5 w-3.5 ${starIndex < customerReviewActiveCard.rating ? 'fill-current' : 'text-white/20'}`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 leading-relaxed text-white/82" style={{ fontSize: `${customerReviewsMessageFontSize}px` }}>
                      {customerReviewActiveCard.message}
                    </p>
                  </article>
                ) : null}
                {customerReviewSliderSettings.showDots && customerReviewCards.length > 1 ? (
                  <div className="mt-5 flex w-full items-center justify-center gap-2">
                    {customerReviewCards.map((review, idx) => (
                      <button
                        key={`${review.id}-dot`}
                        type="button"
                        onClick={() => setCustomerReviewIndex(idx)}
                        className={`h-2.5 w-2.5 rounded-full transition-colors ${
                          idx === customerReviewIndex ? 'bg-white' : 'bg-white/35 hover:bg-white/60'
                        }`}
                        aria-label={`Go to review ${idx + 1}`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {customerReviewCards.map((review) => (
                  <article
                    key={review.id}
                    className="p-5 text-center text-white transition-all duration-300"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <p className="font-semibold uppercase tracking-[0.08em]">{review.customerName}</p>
                    </div>
                    <p className="mt-1 text-white/62" style={{ fontSize: `${customerReviewsMetaFontSize}px` }}>
                      {review.location || 'Africa'}
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-1 text-[#f6b73c]">
                      {Array.from({ length: 5 }).map((_, starIndex) => (
                        <Star
                          key={`${review.id}-star-${starIndex}`}
                          className={`h-3.5 w-3.5 ${starIndex < review.rating ? 'fill-current' : 'text-white/20'}`}
                        />
                      ))}
                    </div>
                    <p className="mt-3 leading-relaxed text-white/82" style={{ fontSize: `${customerReviewsMessageFontSize}px` }}>
                      {review.message}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* TRUST */}
      {showTrustSection ? (
        <section className="bg-white py-16 lg:py-20" data-kimi-anim="fade-up" style={{ order: getSectionOrder('SHOP_WITH_CONFIDENCE') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          {sectionTitlesEnabled && getTextIconHeadingConfig('SHOP_WITH_CONFIDENCE').titleEnabled ? (
            <h2
              className={`font-['Oswald'] font-bold uppercase leading-none ${textIconSectionTitleClass('SHOP_WITH_CONFIDENCE')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('SHOP_WITH_CONFIDENCE').titleFontSize}px` }}
            >
              {textIconSectionHeading('SHOP_WITH_CONFIDENCE')}
            </h2>
          ) : null}
          {getTextIconHeadingConfig('SHOP_WITH_CONFIDENCE').descriptionEnabled ? (
            <p
              className={`mt-2 text-black/65 ${textIconSectionTitleClass('SHOP_WITH_CONFIDENCE')}`}
              style={{ fontSize: `${getTextIconHeadingConfig('SHOP_WITH_CONFIDENCE').descriptionFontSize}px` }}
            >
              {getTextIconHeadingConfig('SHOP_WITH_CONFIDENCE').description}
            </p>
          ) : null}
          <div className={`mt-8 flex w-full gap-2 overflow-x-auto pb-1 scrollbar-hide ${sectionTitlesEnabled ? '' : 'mt-0'}`}>
            {trustCards.map((item) => renderTextIconCard('SHOP_WITH_CONFIDENCE', item))}
          </div>
        </div>
        </section>
      ) : null}

      {/* NEWSLETTER */}
      {isSectionVisible('NEWSLETTER_FOOTER') && asBoolean(newsletterCfg.enabled, true) ? (
        <section className="bg-white py-24" data-kimi-anim="fade-up" style={{ order: getSectionOrder('NEWSLETTER_FOOTER') }}>
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="mx-auto flex w-full max-w-[920px] flex-col items-center justify-center gap-6 text-center">
            <div className="max-w-[760px]">
              <h3 className="font-['Oswald'] text-4xl font-bold uppercase">{asString(newsletterCfg.title, 'JOIN THE MOVEMENT.')}</h3>
              <p className="mt-2 text-sm text-black/60">{asString(newsletterCfg.description, 'Subscribe for new arrivals and stories from the continent.')}</p>
            </div>
            <form
              className="flex w-full max-w-[560px] gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                const email = newsletterEmail.trim().toLowerCase();
                const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
                if (!emailValid) {
                  setNewsletterStatus({ kind: 'error', message: 'Enter a valid email address.' });
                  return;
                }
                setNewsletterSubmitting(true);
                setNewsletterStatus({ kind: 'idle', message: '' });
                try {
                  const response = await api.homepageSections.subscribeHomepageNewsletter({
                    email,
                    source: 'jenks-v2-frontpage',
                  });
                  if (!response.success) {
                    throw new Error(String(response.message || 'Subscription failed.'));
                  }
                  setNewsletterStatus({
                    kind: 'success',
                    message: asString(newsletterCfg.successMessage, 'You are subscribed.'),
                  });
                  setNewsletterEmail('');
                } catch (error: any) {
                  const message = String(error?.response?.data?.message || error?.message || 'Unable to subscribe right now.');
                  setNewsletterStatus({ kind: 'error', message });
                } finally {
                  setNewsletterSubmitting(false);
                }
              }}
            >
              <input
                className="h-10 flex-1 border border-black/20 px-3 text-sm outline-none"
                placeholder={asString(newsletterCfg.emailPlaceholder, 'Enter email')}
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
              />
              <button
                type="submit"
                disabled={newsletterSubmitting}
                className="h-10 bg-[#e66045] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {newsletterSubmitting ? 'Submitting...' : asString(newsletterCfg.submitLabel, 'Subscribe')}
              </button>
            </form>
            {newsletterStatus.kind !== 'idle' ? (
              <p className={`text-xs ${newsletterStatus.kind === 'success' ? 'text-green-700' : 'text-red-600'}`}>
                {newsletterStatus.message}
              </p>
            ) : null}
          </div>
        </div>
        </section>
      ) : null}

      {/* FOOTER */}
      {isSectionVisible('NEWSLETTER_FOOTER') && asBoolean(footerCfg.enabled, true) ? (
        <footer
          className="relative bg-[#0a0a0a] text-white"
          style={{ order: getSectionOrder('NEWSLETTER_FOOTER'), minHeight: `${footerMapHeight}px` }}
        >
        {footerMapEnabled && stripLegacyFallbackImage(footerMapImage) ? (
          <>
            <BrandImageWithFallback
              src={stripLegacyFallbackImage(footerMapImage)}
              alt="Footer map underlay"
              className="absolute inset-0 h-full w-full object-cover"
              spinnerClassName="h-6 w-6"
            />
            <div
              className="absolute inset-0"
              style={{ backgroundColor: footerMapOverlayColor, opacity: footerMapOverlayOpacity }}
            />
          </>
        ) : null}
        <div className="relative z-10 w-full px-4 pt-12 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:grid-cols-5">
            <div>
              {asString(footerLogoCfg.mode, 'TEXT').toUpperCase() === 'IMAGE' && footerLogoImageUrl ? (
                <BrandImageWithFallback
                  src={footerLogoImageUrl}
                  alt={asString(footerLogoCfg.altText, 'Jenks')}
                  className="object-contain"
                  style={{
                    width: Math.max(40, Math.round(asNumber(footerLogoCfg.width, 180))),
                    height: Math.max(16, Math.round(asNumber(footerLogoCfg.height, 52))),
                  }}
                  spinnerClassName="h-4 w-4"
                />
              ) : (
                <p
                  className="font-['Oswald'] uppercase tracking-[0.08em]"
                  style={{
                    color: asString(footerLogoCfg.textColor, '#ffffff'),
                    fontFamily: asString(footerLogoCfg.fontFamily, 'Oswald'),
                    fontSize: `${Math.max(10, Math.round(asNumber(footerLogoCfg.fontSize, 30)))}px`,
                    fontWeight: footerLogoFontWeight,
                  }}
                >
                  <span className="text-[#ffffff]">{logoTextSplit.left}</span>
                  <span className="text-[#e66045]">{logoTextSplit.right}</span>
                </p>
              )}
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

            {footerLinkGroups.map((group) => (
              <div key={group.id} className="md:col-span-1">
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

            <div className="md:col-span-2 lg:col-span-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">Contact</p>
              <div className="mt-3 space-y-2 text-sm text-white/75">
                <p className="inline-flex items-center gap-2"><Mail className="h-4 w-4" /> {asString(footerCfg.contactEmail, 'support@zurikaribu.com')}</p>
                <p className="block">
                  <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" /> {asString(footerCfg.contactPhone, '+234 000 000 0000')}</span>
                </p>
                <p className="inline-flex items-center gap-2 text-white/72"><MapPin className="h-4 w-4" /> {asString(footerCfg.address, 'Lagos, Nigeria')}</p>
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

