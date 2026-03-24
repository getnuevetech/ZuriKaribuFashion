import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  Globe,
  Headphones,
  Heart,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, resolveAssetUrl } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import { useHomepageExperienceStore } from '../store/homepageExperienceStore';
import { AFRICAN_COUNTRIES, AFRICAN_REGION_OPTIONS, type AfricanRegion } from '../data/africanCountries';
import { trackHomeEvent } from '../mappers/homepage/analytics';
import {
  mapFeaturedCollections,
  mapFeaturedSectionTitles,
  type FeaturedProductDTO,
} from '../mappers/homepage/featuredMapper';
import { mapHeroQuickLinks, mapHeroSlides } from '../mappers/homepage/heroMapper';
import { mapShopByCategories, mapShopByCountries } from '../mappers/homepage/shopByMapper';
import { mapDesignerSpotlightTitle, mapDesignerSpotlights } from '../mappers/homepage/spotlightMapper';
import { mapTrustBadges, type TrustBadgeDTO } from '../mappers/homepage/trustMapper';

type HeroSlide = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge: string;
  ctaText: string;
  ctaLink: string;
};

type FeaturedProduct = FeaturedProductDTO;
type LegacyFeaturedProduct = {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  designer: string;
  country: string;
  flag?: string;
  productType: string;
  productLabels?: Array<{
    id: string;
    name: string;
    textColor: string;
    backgroundColor: string;
    sizePercent?: number;
    fontSizePx?: number;
    isBold?: boolean;
  }>;
};

type CountryCard = {
  name: string;
  flag?: string;
  flagCode?: string;
  region?: AfricanRegion;
  fabrics: string;
  productCount?: number;
  href?: string;
};

type ManagedBanner = {
  id: string;
  section: string;
  title?: string | null;
  subtitle?: string | null;
  ctaText?: string | null;
  ctaLink?: string | null;
  images?: string[];
  displayImage?: string | null;
};
type StatsStripItem = {
  value: string;
  suffix?: string;
  label: string;
  displayOrder?: number;
  isActive?: boolean;
};
type StatsStripSettings = {
  items: StatsStripItem[];
  backgroundImage?: string;
  backgroundColor?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  valueColor?: string;
  suffixColor?: string;
  labelColor?: string;
};
type JenksHomepageCtaSettings = {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  backgroundImage?: string;
};

type HomepageVisibility = Record<
  | 'hero'
  | 'statsStrip'
  | 'countries'
  | 'categories'
  | 'howItWorks'
  | 'featuredCustomToWear'
  | 'featuredReadyToWear'
  | 'featuredFabrics'
  | 'promoBanner'
  | 'designerSpotlight'
  | 'heritage'
  | 'testimonials'
  | 'cta',
  boolean
>;

const DEFAULT_HOMEPAGE_VISIBILITY: HomepageVisibility = {
  hero: true,
  statsStrip: true,
  countries: true,
  categories: true,
  howItWorks: true,
  featuredCustomToWear: true,
  featuredReadyToWear: true,
  featuredFabrics: true,
  promoBanner: true,
  designerSpotlight: true,
  heritage: true,
  testimonials: true,
  cta: true,
};
const DEFAULT_STATS_STRIP: StatsStripSettings = {
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

const countryNameToCode: Record<string, string> = {
  algeria: 'DZ',
  angola: 'AO',
  benin: 'BJ',
  botswana: 'BW',
  'burkina faso': 'BF',
  burundi: 'BI',
  'cabo verde': 'CV',
  cameroon: 'CM',
  'central african republic': 'CF',
  chad: 'TD',
  comoros: 'KM',
  congo: 'CG',
  'democratic republic of the congo': 'CD',
  'dr congo': 'CD',
  'cote d’ivoire': 'CI',
  "cote d'ivoire": 'CI',
  djibouti: 'DJ',
  egypt: 'EG',
  'equatorial guinea': 'GQ',
  eritrea: 'ER',
  eswatini: 'SZ',
  ethiopia: 'ET',
  gabon: 'GA',
  gambia: 'GM',
  ghana: 'GH',
  guinea: 'GN',
  'guinea-bissau': 'GW',
  kenya: 'KE',
  lesotho: 'LS',
  liberia: 'LR',
  libya: 'LY',
  madagascar: 'MG',
  malawi: 'MW',
  mali: 'ML',
  mauritania: 'MR',
  mauritius: 'MU',
  morocco: 'MA',
  mozambique: 'MZ',
  namibia: 'NA',
  niger: 'NE',
  nigeria: 'NG',
  rwanda: 'RW',
  senegal: 'SN',
  seychelles: 'SC',
  'sierra leone': 'SL',
  somalia: 'SO',
  'south africa': 'ZA',
  'south sudan': 'SS',
  sudan: 'SD',
  tanzania: 'TZ',
  togo: 'TG',
  tunisia: 'TN',
  uganda: 'UG',
  zambia: 'ZM',
  zimbabwe: 'ZW',
};

const sanitizeCountryCode = (countryCode: string) =>
  String(countryCode || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

const countryCodeToFlagImageUrl = (countryCode: string, size: 80 | 40 = 80) => {
  const normalizedCode = sanitizeCountryCode(countryCode).toLowerCase();
  if (!normalizedCode) return '';
  return `https://flagcdn.com/w${size}/${normalizedCode}.png`;
};

const resolveCountryCode = (country?: string | null, explicitFlag?: string | null) => {
  const explicit = String(explicitFlag || '').trim();
  if (/^[a-z]{2}$/i.test(explicit)) return explicit.toUpperCase();
  const raw = String(country || '').trim();
  if (!raw) return '';
  if (/^[a-z]{2}$/i.test(raw)) return raw.toUpperCase();
  const normalized = raw.toLowerCase();
  return (
    countryNameToCode[normalized] ||
    countryNameToCode[normalized.split(',')[0]?.trim() || ''] ||
    ''
  );
};

const jenksHeroSlides: HeroSlide[] = [
  {
    id: '1',
    image: '/hero_model.jpg',
    badge: 'NEW COLLECTION',
    title: 'The Elegance of Africa',
    subtitle: 'Discover authentic fashion crafted by African designers',
    ctaText: 'SHOP NOW',
    ctaLink: '/ready-to-wear',
  },
  {
    id: '2',
    image: '/rw_full.jpg',
    badge: 'FRESH DROPS',
    title: 'Timeless Heritage',
    subtitle: 'Wear the story of African craftsmanship',
    ctaText: 'SHOP NOW',
    ctaLink: '/custom',
  },
  {
    id: '3',
    image: '/custom_full.jpg',
    badge: 'TRENDING NOW',
    title: 'Modern African Luxury',
    subtitle: 'Contemporary designs rooted in tradition',
    ctaText: 'SHOP NOW',
    ctaLink: '/ready-to-wear',
  },
];

const jenksCountries: CountryCard[] = [
  { name: 'Angola', flag: '🇦🇴', fabrics: 'Kanari, Masai' },
  { name: 'Algeria', flag: '🇩🇿', fabrics: 'Camru, Kokomo' },
  { name: 'Nigeria', flag: '🇳🇬', fabrics: 'Adire, Ankara, Aso-Oke' },
];

const jenksCategories = [
  {
    id: '1',
    title: 'Ready To Wear',
    description: 'Made by African, Worn by the World',
    image: '/rw_full.jpg',
    link: '/ready-to-wear',
  },
  {
    id: '2',
    title: 'Fabrics To Buy',
    description: 'African fabrics across all edges of Africa',
    image: '/fabrics_full.jpg',
    link: '/fabrics',
  },
  {
    id: '3',
    title: 'Custom To Wear',
    description: 'Every stitch sewn by an African Designer',
    image: '/custom_full.jpg',
    link: '/custom',
  },
];

const jenksHowItWorks = [
  { id: 1, title: 'Discover Your Style', subtitle: 'Explore curated African designs and fabrics.', icon: Search },
  { id: 2, title: 'Preview Virtually', subtitle: 'Visualize your outfit before checkout.', icon: Eye },
  { id: 3, title: 'Select Your Fabric', subtitle: 'Choose textures and colors that match your look.', icon: Sparkles },
  { id: 4, title: 'Pay Securely', subtitle: 'Complete checkout with protected payment flows.', icon: CreditCard },
  { id: 5, title: 'Quality Assured', subtitle: 'Every order passes expert review before dispatch.', icon: Star },
  { id: 6, title: 'Delivered to You', subtitle: 'Receive your order anywhere in the world.', icon: Truck },
];

const iconByName: Record<string, any> = {
  Search,
  Eye,
  Sparkles,
  CreditCard,
  Star,
  Truck,
};

const normalizeIconKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');

const iconByNormalizedName: Record<string, any> = {
  search: Search,
  eye: Eye,
  sparkles: Sparkles,
  sparkle: Sparkles,
  creditcard: CreditCard,
  card: CreditCard,
  star: Star,
  truck: Truck,
  delivery: Truck,
  shipped: Truck,
};

const TRUST_BADGES: TrustBadgeDTO[] = [
  {
    id: 'authentic',
    title: 'Authentic Guarantee',
    subtitle: 'Verified sellers and designers only.',
    icon: 'SHIELD_CHECK',
    enabled: true,
  },
  {
    id: 'shipping',
    title: 'Global Shipping',
    subtitle: 'Reliable delivery across major markets.',
    icon: 'TRUCK',
    enabled: true,
  },
  {
    id: 'returns',
    title: 'Easy Returns',
    subtitle: 'Clear return policy on eligible orders.',
    icon: 'REFRESH_CW',
    enabled: true,
  },
  {
    id: 'support',
    title: '24/7 Support',
    subtitle: 'Human support via chat, ticket, and call.',
    icon: 'HEADPHONES',
    enabled: true,
  },
  {
    id: 'secure',
    title: 'Secure Payment',
    subtitle: 'Protected checkout and trusted processors.',
    icon: 'SHOPPING_BAG',
    enabled: true,
  },
  {
    id: 'artisan',
    title: 'Artisan Made',
    subtitle: 'Craft rooted in African heritage.',
    icon: 'GLOBE',
    enabled: true,
  },
];

const TRUST_ICON_BY_NAME = {
  SHIELD_CHECK: ShieldCheck,
  TRUCK: Truck,
  REFRESH_CW: RefreshCw,
  HEADPHONES: Headphones,
  GLOBE: Globe,
  SHOPPING_BAG: ShoppingBag,
} as const;

const jenksFeaturedDesigns: LegacyFeaturedProduct[] = [
  { id: '1', name: 'Exclusive Gorgeous', price: 1428.57, image: '/product1.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
  { id: '2', name: 'My Skkentele', price: 714.29, image: '/product2.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
  { id: '3', name: 'Ankara Gbasibe', price: 857.14, image: '/product3.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'DESIGN' },
];

const jenksReadyToWear: LegacyFeaturedProduct[] = [
  { id: 'r1', name: 'Bridal Traditional', price: 2285.71, image: '/product4.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
  { id: 'r2', name: 'Afigan', price: 1642.86, image: '/product5.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
  { id: 'r3', name: 'Kakaki Africa', price: 1507.14, image: '/product6.jpg', designer: 'Asante Designs', country: 'Ghana', productType: 'READY_TO_WEAR' },
];

const jenksFabrics: LegacyFeaturedProduct[] = [
  { id: 'f1', name: 'Ankara Mummy', price: 2142.86, image: '/fabrics_full.jpg', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f2', name: 'Dancing Queen Adire', price: 785.71, image: '/featured_rw_left.jpg', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f3', name: 'Ankara Party', price: 928.57, image: '/featured_rw_right.jpg', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
  { id: 'f4', name: 'Awon Da', price: 1428.57, image: '/featured_custom_left.jpg', designer: 'Diallo Fabrics', country: 'Nigeria', productType: 'FABRIC' },
];

const jenksDesigners = [
  {
    id: '1',
    name: 'Asante Designs',
    country: 'Ghana',
    flag: '🇬🇭',
    quote: 'When we sew, it is from the heart. Every stitch tells a story.',
    image: '/designer_spotlight.jpg',
  },
  {
    id: '2',
    name: 'Ngozi Couture',
    country: 'Nigeria',
    flag: '🇳🇬',
    quote: 'Bringing the vibrant spirit of Africa to the world through fashion.',
    image: '/featured_custom_right.jpg',
  },
  {
    id: '3',
    name: 'Kente Masters',
    country: 'Ghana',
    flag: '🇬🇭',
    quote: 'Kente to the world. Preserving tradition while embracing modernity.',
    image: '/featured_rw_left.jpg',
  },
];

const jenksTestimonials = [
  {
    id: '1',
    name: 'Amara Johnson',
    location: 'New York, USA',
    avatar: '/product1.jpg',
    quote: 'The quality exceeded my expectations. My dress fits perfectly and the fabric is gorgeous.',
  },
  {
    id: '2',
    name: 'Kwame Asante',
    location: 'London, UK',
    avatar: '/product2.jpg',
    quote: 'Amazing experience from start to finish. The custom tailoring service is a game changer!',
  },
  {
    id: '3',
    name: 'Fatima Mohammed',
    location: 'Dubai, UAE',
    avatar: '/product3.jpg',
    quote: 'Supporting African designers while getting beautiful clothes—this platform is a gem.',
  },
];

const asText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};
const clampText = (value: unknown, maxLength: number, fallback = '') => {
  const source = asText(value, fallback);
  if (!source) return '';
  return source.length > maxLength ? `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…` : source;
};
const safeHref = (...values: any[]) => {
  const fallback = asText(values[values.length - 1], '/shop') || '/shop';
  const href = asText(...values)
    .replace(/^\/designs(\/|$)/i, '/custom$1')
    .replace(/^\/custom-to-wear(\/|$)/i, '/custom$1');
  if (!href) return fallback;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return fallback;
  return href;
};
const PUBLIC_BASE = (() => {
  const base = String(import.meta.env.BASE_URL || '/').trim();
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
})();
const normalizeImageUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }
  if (raw.startsWith('/')) {
    return `${PUBLIC_BASE}${raw.slice(1)}`;
  }
  return resolveAssetUrl(raw) || raw;
};
const asImage = (...values: any[]) => {
  for (const value of values) {
    const normalized = normalizeImageUrl(value);
    if (normalized) return normalized;
  }
  return '';
};
const trimToWordLimit = (text: string, limit: number) => {
  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= limit) return words.join(' ');
  return `${words.slice(0, limit).join(' ')}…`;
};

const CTA_BUTTON_BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-none border px-6 py-2.5 text-sm font-semibold tracking-wider transition-colors duration-200';
const CTA_BUTTON_DARK_CLASS = `${CTA_BUTTON_BASE_CLASS} border-black bg-black text-white hover:bg-black hover:text-white`;
const CTA_BUTTON_LIGHT_CLASS = `${CTA_BUTTON_BASE_CLASS} border-black bg-black text-white hover:bg-black hover:text-white`;
const CTA_BUTTON_OVERLAY_CLASS = `${CTA_BUTTON_BASE_CLASS} border-black bg-black text-white hover:bg-black hover:text-white`;
const HERO_SETTINGS_DEFAULTS = {
  rotationSeconds: 6,
  forceUppercaseCtas: true,
  ctaTarget: 'SAME_TAB' as 'SAME_TAB' | 'NEW_TAB',
  showQuickLinks: true,
  quickLinks: [] as Array<{ label: string; href: string }>,
};
const toCtaLabel = (value: unknown, fallback = 'SHOP NOW') => clampText(value, 60, fallback).toUpperCase();

const productBasePath = (productType: string) => {
  if (productType === 'DESIGN') return '/custom';
  if (productType === 'FABRIC') return '/fabrics';
  return '/ready-to-wear';
};

function ProductCard({ product, descriptionWordLimit }: { product: FeaturedProduct; descriptionWordLimit: number }) {
  const description = trimToWordLimit(asText(product.description, ''), Math.max(5, Math.min(60, descriptionWordLimit)));
  const { formatFromUsd } = useCurrencyStore();
  const productFlagCode = resolveCountryCode(product.country, product.flag);
  return (
    <Link to={`${productBasePath(product.productType)}/${product.id}`} className="group block">
      <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 mb-4 img-zoom">
        <img src={product.image} alt={clampText(product.name, 60, 'Product')} className="w-full h-full object-cover" loading="lazy" />
        {(product.productLabels || []).length > 0 ? (
          <div className="absolute left-3 top-3 z-10 flex flex-wrap gap-1">
            {(product.productLabels || []).slice(0, 2).map((label) => (
              <span
                key={`${product.id}-home-label-${label.id}`}
                className="inline-flex items-center"
                style={{
                  backgroundColor: label.backgroundColor || '#111827',
                  color: label.textColor || '#ffffff',
                  fontSize: `${Math.max(8, Math.min(36, Number(label.fontSizePx || 12)))}px`,
                  fontWeight: label.isBold === false ? 500 : 700,
                  padding: `${0.125 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)}rem ${
                    0.375 * (Math.max(60, Math.min(300, Number(label.sizePercent || 120))) / 100)
                  }rem`,
                }}
              >
                {label.name}
              </span>
            ))}
          </div>
        ) : null}
        <button className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white">
          <Heart className="w-4 h-4" />
        </button>
        <div className="absolute bottom-3 right-3 text-xs font-medium flex items-center gap-1">
          {productFlagCode ? (
            <img
              src={countryCodeToFlagImageUrl(productFlagCode, 40)}
              alt={`${product.country} flag`}
              className="h-4 w-6 rounded-sm object-cover shadow-lg"
              loading="lazy"
            />
          ) : (
            <span className="text-[10px] font-semibold uppercase text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
              {sanitizeCountryCode(product.country || '') || '--'}
            </span>
          )}
        </div>
      </div>
      <div>
        <h3 className="text-lg font-semibold line-clamp-2 transition-colors group-hover:text-gray-600">
          {clampText(product.name, 60, 'Product')}
        </h3>
        <p className="text-gray-500 text-sm line-clamp-1">{product.designer}</p>
        {description ? (
          <p className="text-gray-500 text-xs line-clamp-2 mt-1">{description}</p>
        ) : null}
        <p className="font-semibold mt-1">{formatFromUsd(Number(product.price || 0))}</p>
      </div>
    </Link>
  );
}

function ProductCarousel({
  title,
  subtitle,
  products,
  stripRef,
  onLeft,
  onRight,
  viewAllLink,
  loading,
  itemWidthClassName = 'w-72',
  descriptionWordLimit,
}: {
  title: string;
  subtitle: string;
  products: FeaturedProduct[];
  stripRef: { current: HTMLDivElement | null };
  onLeft: () => void;
  onRight: () => void;
  viewAllLink: string;
  loading: boolean;
  itemWidthClassName?: string;
  descriptionWordLimit: number;
}) {
  return (
    <section className="py-8 lg:py-12 bg-white">
      <div className="w-full px-2 sm:px-4 lg:px-8 xl:px-12">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-10">
          <div>
            <p className="inline-flex mb-3 px-2 py-1 border border-black text-xs tracking-wider font-semibold">FEATURED</p>
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl font-bold">{title}</h2>
            <p className="text-gray-600 mt-2">{subtitle}</p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <button onClick={onLeft} className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={onRight} className="w-10 h-10 border border-black/20 rounded-full flex items-center justify-center hover:bg-black hover:text-white transition-colors">
              <ChevronRight className="w-5 h-5" />
            </button>
            <Link to={viewAllLink} className="hidden sm:flex items-center gap-1 text-sm font-medium">
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div
            ref={stripRef}
            className="flex gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-2 px-2 sm:-mx-0 sm:px-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {products.map((product) => (
              <div key={product.id} className={`flex-shrink-0 ${itemWidthClassName}`}>
                <ProductCard product={product} descriptionWordLimit={descriptionWordLimit} />
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function EditorialFeatureSection({
  eyebrow,
  title,
  description,
  ctaText,
  ctaLink,
  image,
  imageOnRight = false,
}: {
  eyebrow: string;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  image: string;
  imageOnRight?: boolean;
}) {
  return (
    <section className="bg-[#0b0b0c]">
      <div className="grid min-h-[78vh] grid-cols-1 lg:grid-cols-12">
        <div className={`relative overflow-hidden lg:col-span-7 ${imageOnRight ? 'lg:order-2' : ''}`}>
          <img src={image} alt={title} className="h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-black/20" />
        </div>
        <div className={`flex items-center bg-[#0b0b0c] px-6 py-10 lg:col-span-5 lg:px-12 ${imageOnRight ? 'lg:order-1' : ''}`}>
          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">{eyebrow}</p>
            <h2 className="font-['Oswald'] text-4xl font-bold uppercase leading-[0.95] text-white md:text-5xl max-w-[14ch] break-words">
              {clampText(title, 56, 'Zuri Karibu')}
            </h2>
            <p className="mt-5 max-w-[52ch] text-sm leading-relaxed text-white/75 line-clamp-4">
              {clampText(description, 140, 'Discover premium African fashion stories.')}
            </p>
            <Link to={safeHref(ctaLink, '/shop')} className={`${CTA_BUTTON_OVERLAY_CLASS} mt-6`}>
              {toCtaLabel(ctaText, 'Explore')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const location = useLocation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const [activeCountryRegion, setActiveCountryRegion] = useState<'ALL' | AfricanRegion>('ALL');
  const [showAllCountries, setShowAllCountries] = useState(false);
  const [countryShuffleSeed] = useState(() => Date.now());
  const [hoveredHowItWorksId, setHoveredHowItWorksId] = useState<number | null>(null);
  const [categoryImageById, setCategoryImageById] = useState<Record<string, string>>({});
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<{
    kind: 'idle' | 'loading' | 'success' | 'error';
    message: string;
  }>({ kind: 'idle', message: '' });
  const customStripRef = useRef<HTMLDivElement>(null);
  const rtwStripRef = useRef<HTMLDivElement>(null);
  const fabricsStripRef = useRef<HTMLDivElement>(null);
  const experienceSettings = useHomepageExperienceStore((state) => state.settings);
  const resolvedExperienceMode = useHomepageExperienceStore((state) => state.resolvedMode);
  const capabilityProfile = useHomepageExperienceStore((state) => state.capability);
  const isLiteExperienceMode = resolvedExperienceMode === 'LITE_COMMERCE';
  const useMotion = !isLiteExperienceMode && !capabilityProfile?.prefersReducedMotion;
  const strictCanonicalMode = true;
  const heroVariant = experienceSettings.heroVariant || 'SPLIT_EDITORIAL';
  const categoryEntryVariant = experienceSettings.categoryEntryVariant || 'THREE_COLUMN_CORE';
  const spotlightVariant = experienceSettings.spotlightVariant || 'CAROUSEL';
  const tokenSet = experienceSettings.tokenSet || 'GLOBAL_PREMIUM_DARK';
  const tokenPalette = useMemo(
    () =>
      ({
        GLOBAL_PREMIUM_DARK: {
          heroPanel: '#0b0b0c',
          heroText: '#ffffff',
          heroMuted: '#b8b5ad',
          accent: '#ff4d2e',
        },
        GLOBAL_PREMIUM_LIGHT: {
          heroPanel: '#ffffff',
          heroText: '#111827',
          heroMuted: '#4b5563',
          accent: '#111827',
        },
        AFRO_EDITORIAL: {
          heroPanel: '#1f140f',
          heroText: '#f9f3ea',
          heroMuted: '#d9c7af',
          accent: '#d7662a',
        },
      } as const)[tokenSet],
    [tokenSet]
  );

  const { data: jenksHomepagePayloadData, isLoading: jenksHomepagePayloadLoading } = useQuery({
    queryKey: ['homepageJenksPayloadV1'],
    queryFn: async () => {
      const response = await api.homepageSections.getJenksHomepagePayload();
      return response.success ? response.data : null;
    },
  });
  const { data: jenksHomepageConfigData } = useQuery({
    queryKey: ['jenksHomepageConfigV1'],
    queryFn: async () => {
      const response = await api.homepageSections.getJenksHomepageConfig();
      return response.success ? response.data : null;
    },
  });

  const heroSlidesDataResolved = (jenksHomepagePayloadData as any)?.heroSlides;
  const featuredDataResolved = (jenksHomepagePayloadData as any)?.featuredCollections ?? null;
  const managedBannersDataResolved = (jenksHomepagePayloadData as any)?.managedBanners;
  const promoBadgeDataResolved = (jenksHomepagePayloadData as any)?.promoBadge;
  const countriesDataResolved = (jenksHomepagePayloadData as any)?.countries;
  const categoriesDataResolved = (jenksHomepagePayloadData as any)?.categories;
  const howItWorksDataResolved = (jenksHomepagePayloadData as any)?.howItWorks;
  const howItWorksStyleDataResolved = (jenksHomepagePayloadData as any)?.howItWorksStyle;
  const designerSpotlightsDataResolved = (jenksHomepagePayloadData as any)?.designerSpotlights;
  const heritageDataResolved = (jenksHomepagePayloadData as any)?.heritage;
  const testimonialsDataResolved = (jenksHomepagePayloadData as any)?.testimonials;
  const statsStripDataResolved = (jenksHomepagePayloadData as any)?.statsStrip;
  const featuredDescriptionSettingsDataResolved = (jenksHomepagePayloadData as any)?.featuredProductDescription;
  const visibilityDataResolved =
    (jenksHomepageConfigData as any)?.sections?.visibility ?? (jenksHomepagePayloadData as any)?.visibility;
  const shopByBlocksDataResolved =
    (jenksHomepageConfigData as any)?.shopByBlocks ?? (jenksHomepagePayloadData as any)?.shopByBlocks;
  const freshDropsDataResolved =
    (jenksHomepageConfigData as any)?.freshDrops ?? (jenksHomepagePayloadData as any)?.freshDrops;
  const newsletterDataResolved =
    (jenksHomepageConfigData as any)?.newsletter ?? (jenksHomepagePayloadData as any)?.newsletter;
  const homepageCtaDataResolved = ((jenksHomepageConfigData as any)?.cta ??
    (jenksHomepagePayloadData as any)?.cta) as JenksHomepageCtaSettings | undefined;

  const sectionVisibility = useMemo<HomepageVisibility>(() => {
    if (!visibilityDataResolved) {
      return DEFAULT_HOMEPAGE_VISIBILITY;
    }
    return {
      ...DEFAULT_HOMEPAGE_VISIBILITY,
      ...visibilityDataResolved,
    };
  }, [visibilityDataResolved]);
  const statsStrip = useMemo<StatsStripSettings>(() => {
    const fallback = { ...DEFAULT_STATS_STRIP, items: [...DEFAULT_STATS_STRIP.items] };
    if (!statsStripDataResolved || typeof statsStripDataResolved !== 'object') {
      return fallback;
    }
    const row = statsStripDataResolved as Record<string, any>;
    const items = Array.isArray(row.items)
      ? row.items
          .map((item: any, index: number) => ({
            value: asText(item?.value),
            suffix: asText(item?.suffix, ''),
            label: asText(item?.label).toUpperCase(),
            displayOrder: Number(item?.displayOrder ?? index) || index,
            isActive: item?.isActive !== false,
          }))
          .filter((item: StatsStripItem) => item.value && item.label)
          .sort((a: StatsStripItem, b: StatsStripItem) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0))
      : [];
    return {
      items: items.length > 0 ? items : [...DEFAULT_STATS_STRIP.items],
      backgroundImage: asText(row.backgroundImage),
      backgroundColor: asText(row.backgroundColor, DEFAULT_STATS_STRIP.backgroundColor),
      overlayColor: asText(row.overlayColor, DEFAULT_STATS_STRIP.overlayColor),
      overlayOpacity: Math.max(0, Math.min(100, Number(row.overlayOpacity ?? DEFAULT_STATS_STRIP.overlayOpacity) || 0)),
      valueColor: asText(row.valueColor, DEFAULT_STATS_STRIP.valueColor),
      suffixColor: asText(row.suffixColor, DEFAULT_STATS_STRIP.suffixColor),
      labelColor: asText(row.labelColor, DEFAULT_STATS_STRIP.labelColor),
    };
  }, [statsStripDataResolved]);
  const activeStatsItems = useMemo(
    () => (Array.isArray(statsStrip.items) ? statsStrip.items.filter((item) => item.isActive !== false) : []),
    [statsStrip.items]
  );
  const featuredDescriptionWordLimit = useMemo(() => {
    const raw = Number((featuredDescriptionSettingsDataResolved as any)?.wordLimit);
    return Number.isFinite(raw) ? Math.max(5, Math.min(60, Math.round(raw))) : 12;
  }, [featuredDescriptionSettingsDataResolved]);

  const heroSlides = useMemo(
    () =>
      mapHeroSlides({
        heroSlidesData: heroSlidesDataResolved,
        managedBannersData: managedBannersDataResolved,
        fallbackSlides: jenksHeroSlides,
      }),
    [heroSlidesDataResolved, managedBannersDataResolved]
  );
  const heroSettings = useMemo(() => {
    const row =
      jenksHomepageConfigData && typeof jenksHomepageConfigData === 'object'
        ? ((jenksHomepageConfigData as any)?.hero ?? {})
        : {};
    const quickLinks = Array.isArray(row.quickLinks)
      ? row.quickLinks
          .map((entry: any) => ({
            label: String(entry?.label || '').trim(),
            href: safeHref(entry?.href, '/shop'),
          }))
          .filter((entry: any) => Boolean(entry.label && entry.href))
          .slice(0, 8)
      : [];
    return {
      rotationSeconds: Math.max(3, Math.min(20, Number(row.rotationSeconds || HERO_SETTINGS_DEFAULTS.rotationSeconds))),
      forceUppercaseCtas: row.forceUppercaseCtas !== false,
      ctaTarget: row.ctaTarget === 'NEW_TAB' ? 'NEW_TAB' : 'SAME_TAB',
      showQuickLinks: row.showQuickLinks !== false,
      quickLinks,
    } as typeof HERO_SETTINGS_DEFAULTS;
  }, [jenksHomepageConfigData]);
  const heroQuickLinks = useMemo(
    () => {
      if (heroSettings.quickLinks.length > 0) return heroSettings.quickLinks;
      return mapHeroQuickLinks(experienceSettings?.jenksCopy);
    },
    [experienceSettings?.jenksCopy, heroSettings.quickLinks]
  );
  const trustBadges = useMemo(
    () => mapTrustBadges(experienceSettings?.trustBadges, TRUST_BADGES),
    [experienceSettings?.trustBadges]
  );
  const showTrustSection = Boolean(sectionVisibility.statsStrip) && trustBadges.length > 0;
  const heroEyebrowText = useMemo(
    () =>
      clampText(
        experienceSettings?.jenksCopy?.heroEyebrow,
        40,
        heroVariant === 'VIDEO_STORY' ? 'Cinematic Story' : 'Global African Fashion'
      ),
    [experienceSettings?.jenksCopy?.heroEyebrow, heroVariant]
  );
  const shopByEyebrowText = useMemo(
    () => clampText(experienceSettings?.jenksCopy?.shopByEyebrow, 40, 'Shop by country'),
    [experienceSettings?.jenksCopy?.shopByEyebrow]
  );
  const shopByTitleText = useMemo(
    () => clampText(experienceSettings?.jenksCopy?.shopByTitle, 60, 'Shop by Country'),
    [experienceSettings?.jenksCopy?.shopByTitle]
  );
  const featuredCollections = useMemo(
    () =>
      mapFeaturedCollections({
        featuredData: featuredDataResolved,
        fallbackCustomToWear: strictCanonicalMode ? [] : jenksFeaturedDesigns,
        fallbackReadyToWear: strictCanonicalMode ? [] : jenksReadyToWear,
        fallbackFabricsToBuy: strictCanonicalMode ? [] : jenksFabrics,
      }),
    [featuredDataResolved, strictCanonicalMode]
  );
  const featuredLoading = jenksHomepagePayloadLoading && !featuredDataResolved;
  const featuredSectionTitles = useMemo(
    () => mapFeaturedSectionTitles(experienceSettings?.jenksCopy),
    [experienceSettings?.jenksCopy]
  );
  const featuredDesigns = featuredCollections.customToWear;
  const featuredRTW = featuredCollections.readyToWear;
  const featuredFabrics = featuredCollections.fabricsToBuy;
  const managedBannersBySection = useMemo(() => {
    const map = new Map<string, ManagedBanner>();
    if (!Array.isArray(managedBannersDataResolved)) return map;
    for (const row of managedBannersDataResolved) {
      const key = String(row?.section || '').toUpperCase();
      if (!key || map.has(key)) continue;
      map.set(key, row);
    }
    return map;
  }, [managedBannersDataResolved]);

  const countries = useMemo<CountryCard[]>(
    () =>
      mapShopByCountries({
        countriesData: countriesDataResolved,
        staticCountries: AFRICAN_COUNTRIES,
      }),
    [countriesDataResolved]
  );

  const visibleCountries = useMemo(
    () =>
      countries.filter((country) => {
        if (activeCountryRegion === 'ALL') return true;
        return country.region === activeCountryRegion;
      }),
    [activeCountryRegion, countries]
  );
  const featuredCountries = useMemo(() => {
    const rows = [...visibleCountries];
    let seed = Number(countryShuffleSeed || Date.now());
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = rows.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    return rows.slice(0, 6);
  }, [countryShuffleSeed, visibleCountries]);
  const allCountriesForGrid = useMemo(() => {
    const featuredNames = new Set(featuredCountries.map((entry) => String(entry.name || '').toLowerCase()));
    return [
      ...featuredCountries,
      ...visibleCountries.filter((entry) => !featuredNames.has(String(entry.name || '').toLowerCase())),
    ];
  }, [featuredCountries, visibleCountries]);
  const regionCountByKey = useMemo(() => {
    const counts: Record<'ALL' | AfricanRegion, number> = {
      ALL: countries.length,
      North: 0,
      West: 0,
      Central: 0,
      East: 0,
      Southern: 0,
    };
    for (const country of countries) {
      const region = country.region;
      if (!region) continue;
      counts[region] += 1;
    }
    return counts;
  }, [countries]);

  const categories = useMemo(
    () =>
      mapShopByCategories({
        categoriesData: categoriesDataResolved,
        fallbackCategories: strictCanonicalMode ? [] : jenksCategories,
      }),
    [categoriesDataResolved, strictCanonicalMode]
  );
  const readyCategory = categories.find((item) => /ready/i.test(String(item.title || ''))) || categories[0];
  const customCategory =
    categories.find((item) => /custom/i.test(String(item.title || ''))) ||
    categories.find((item) => /design/i.test(String(item.title || ''))) ||
    categories[1] ||
    categories[0];
  const fabricsCategory =
    categories.find((item) => /fabric/i.test(String(item.title || ''))) ||
    categories[2] ||
    categories[0];

  const editorialReadyFeature = useMemo(
    () => ({
      eyebrow: 'Ready to wear',
      title: asText(readyCategory?.title, 'Standardized African attire made to buy.'),
      description: asText(
        readyCategory?.description,
        'Curated fits built for real life, tailored enough to feel special, versatile enough to wear anywhere.'
      ),
      ctaText: asText(readyCategory?.ctaText, 'Shop ready to wear'),
      ctaLink: safeHref(readyCategory?.link, '/ready-to-wear'),
      image: asImage(
        managedBannersBySection.get('BANNER_2')?.displayImage,
        managedBannersBySection.get('BANNER_2')?.images?.[0],
        '/rw_full.jpg'
      ),
    }),
    [readyCategory, managedBannersBySection]
  );
  const editorialFabricsFeature = useMemo(
    () => ({
      eyebrow: 'Fabrics to buy',
      title: asText(fabricsCategory?.title, 'African fabrics across all edges of Africa.'),
      description: asText(
        fabricsCategory?.description,
        'Source the same textiles artisans use, from wax prints to hand-woven heritage fabrics.'
      ),
      ctaText: asText(fabricsCategory?.ctaText, 'Browse fabrics'),
      ctaLink: safeHref(fabricsCategory?.link, '/fabrics'),
      image: asImage(
        managedBannersBySection.get('BANNER_1')?.displayImage,
        managedBannersBySection.get('BANNER_1')?.images?.[0],
        '/fabrics_full.jpg'
      ),
    }),
    [fabricsCategory, managedBannersBySection]
  );
  const editorialCustomFeature = useMemo(
    () => ({
      eyebrow: 'Custom to wear',
      title: asText(customCategory?.title, 'Every stitch sewn by an African designer.'),
      description: asText(
        customCategory?.description,
        'Submit your measurements, choose your fabric, and work directly with a maker who understands the details.'
      ),
      ctaText: asText(customCategory?.ctaText, 'Start a custom order'),
      ctaLink: safeHref(customCategory?.link, '/custom'),
      image: asImage(
        managedBannersBySection.get('PROMO')?.displayImage,
        managedBannersBySection.get('PROMO')?.images?.[0],
        '/custom_full.jpg'
      ),
    }),
    [customCategory, managedBannersBySection]
  );

  const howItWorks = useMemo(
    () =>
      (
        Array.isArray(howItWorksDataResolved) && howItWorksDataResolved.length > 0
          ? howItWorksDataResolved
          : strictCanonicalMode
            ? []
            : jenksHowItWorks
      )
        .slice(0, 6)
        .map((item: any, index: number) => ({
        id: Number(item.id ?? index + 1),
        title: asText(item.title, jenksHowItWorks[index % jenksHowItWorks.length].title),
        subtitle: asText(item.subtitle, item.description, jenksHowItWorks[index % jenksHowItWorks.length].subtitle),
        icon:
          iconByName[asText(item.icon, '')] ||
          iconByNormalizedName[normalizeIconKey(item.icon)] ||
          jenksHowItWorks[index % jenksHowItWorks.length].icon,
        })),
    [howItWorksDataResolved, strictCanonicalMode],
  );
  const useCustomHowItWorksColors = Boolean(howItWorksStyleDataResolved?.enabled);
  const howItWorksIconColor = asText(howItWorksStyleDataResolved?.iconColor, '#111827');
  const howItWorksIconHoverColor = asText(howItWorksStyleDataResolved?.iconHoverColor, '#ffffff');
  const designers = useMemo(
    () =>
      mapDesignerSpotlights({
        designerSpotlightsData: designerSpotlightsDataResolved,
        fallbackDesigners: strictCanonicalMode ? [] : jenksDesigners,
      }),
    [designerSpotlightsDataResolved, strictCanonicalMode]
  );
  const designerSpotlightTitle = useMemo(
    () => mapDesignerSpotlightTitle(experienceSettings?.jenksCopy),
    [experienceSettings?.jenksCopy]
  );

  useEffect(() => {
    setShowAllCountries(false);
  }, [activeCountryRegion]);

  useEffect(() => {
    if (categories.length === 0) return;
    setCategoryImageById((prev) => {
      const next = { ...prev };
      for (const category of categories) {
        if (!next[category.id]) {
          next[category.id] = category.images?.[0] || category.image;
        }
      }
      return next;
    });
  }, [categories]);

  useEffect(() => {
    if (!useMotion || categories.length === 0) return;
    const interval = window.setInterval(() => {
      setCategoryImageById((prev) => {
        const next = { ...prev };
        for (const category of categories) {
          const imagePool = Array.isArray(category.images) ? category.images.filter(Boolean) : [];
          if (imagePool.length <= 1) continue;
          const current = prev[category.id] || imagePool[0];
          const candidates = imagePool.filter((image) => image !== current);
          next[category.id] = candidates[Math.floor(Math.random() * candidates.length)] || imagePool[0];
        }
        return next;
      });
    }, 6000);
    return () => window.clearInterval(interval);
  }, [categories, useMotion]);

  const testimonials = useMemo(
    () =>
      (Array.isArray(testimonialsDataResolved) && testimonialsDataResolved.length > 0
        ? testimonialsDataResolved
        : strictCanonicalMode
          ? []
          : jenksTestimonials
      ).map((item: any, index: number) => ({
        id: String(item.id ?? index),
        name: asText(item.name, jenksTestimonials[index % jenksTestimonials.length].name),
        location: asText(item.location, jenksTestimonials[index % jenksTestimonials.length].location),
        avatar: asImage(item.avatar, jenksTestimonials[index % jenksTestimonials.length].avatar),
        quote: asText(item.quote, item.text, jenksTestimonials[index % jenksTestimonials.length].quote),
      })),
    [testimonialsDataResolved, strictCanonicalMode],
  );

  const heritage = useMemo(
    () => ({
      title: asText(heritageDataResolved?.title, 'Rooted in Culture'),
      content: asText(
        heritageDataResolved?.subtitle,
        heritageDataResolved?.description,
        "Every pattern carries meaning. From Kente's bold geometry to Ankara's vibrant motifs, African textiles tell stories of identity, celebration, and legacy passed through generations.",
      ),
      image: asImage(heritageDataResolved?.image, '/heritage_story.jpg'),
      ctaText: asText(heritageDataResolved?.ctaText, 'READ OUR STORY'),
      ctaLink: safeHref(heritageDataResolved?.ctaLink, '/about'),
    }),
    [heritageDataResolved],
  );
  const promoBadgeValue = asText(
    freshDropsDataResolved?.badgeValueText,
    promoBadgeDataResolved?.valueText,
    managedBannersBySection.get('PROMO_BADGE')?.title,
    '50+'
  );
  const promoBadgeLabel = asText(
    freshDropsDataResolved?.badgeLabelText,
    promoBadgeDataResolved?.labelText,
    managedBannersBySection.get('PROMO_BADGE')?.subtitle,
    'New Arrivals'
  );
  const shopByStyleOptions = useMemo(
    () =>
      (Array.isArray(shopByBlocksDataResolved?.styleOptions) ? shopByBlocksDataResolved.styleOptions : []).filter(
        (item: any) => asText(item?.label) && asText(item?.href)
      ),
    [shopByBlocksDataResolved]
  );
  const shopByPriceOptions = useMemo(
    () =>
      (Array.isArray(shopByBlocksDataResolved?.priceOptions) ? shopByBlocksDataResolved.priceOptions : []).filter(
        (item: any) => asText(item?.label) && asText(item?.href)
      ),
    [shopByBlocksDataResolved]
  );
  const freshDropsConfig = useMemo(
    () => ({
      eyebrow: asText(freshDropsDataResolved?.eyebrow, 'FRESH DROPS'),
      title: asText(
        freshDropsDataResolved?.title,
        managedBannersBySection.get('PROMO')?.title,
        managedBannersBySection.get('HERO')?.title,
        'New arrivals from the most talented designers across the continent.'
      ),
      subtitle: asText(
        freshDropsDataResolved?.subtitle,
        managedBannersBySection.get('PROMO')?.subtitle,
        'Curated highlights from ready-to-wear, custom, and fabrics.'
      ),
      ctaText: asText(
        freshDropsDataResolved?.ctaText,
        managedBannersBySection.get('PROMO')?.ctaText,
        managedBannersBySection.get('HERO')?.ctaText,
        'SHOP NEW ARRIVALS'
      ),
      ctaLink: safeHref(
        freshDropsDataResolved?.ctaLink,
        managedBannersBySection.get('PROMO')?.ctaLink,
        managedBannersBySection.get('HERO')?.ctaLink,
        '/ready-to-wear'
      ),
      showBadge: freshDropsDataResolved?.showBadge !== false,
    }),
    [freshDropsDataResolved, managedBannersBySection]
  );
  const newsletterConfig = useMemo(
    () => ({
      enabled: newsletterDataResolved?.enabled !== false,
      title: asText(newsletterDataResolved?.title, 'Join the Movement'),
      subtitle: asText(
        newsletterDataResolved?.subtitle,
        'Subscribe to our newsletter for exclusive offers, new arrivals, and stories from the continent.'
      ),
      emailPlaceholder: asText(newsletterDataResolved?.emailPlaceholder, 'Enter your email'),
      submitLabel: asText(newsletterDataResolved?.submitLabel, 'SUBSCRIBE'),
      successMessage: asText(newsletterDataResolved?.successMessage, 'You are subscribed. We will keep you updated.'),
      duplicateMessage: asText(
        newsletterDataResolved?.duplicateMessage,
        'You are already subscribed to our newsletter.'
      ),
    }),
    [newsletterDataResolved]
  );

  useEffect(() => {
    if (!useMotion) {
      setCurrentSlide(0);
      return;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, Math.max(3000, Number(heroSettings.rotationSeconds || 6) * 1000));
    return () => clearInterval(timer);
  }, [heroSettings.rotationSeconds, heroSlides.length, useMotion]);

  useEffect(() => {
    if (!useMotion) {
      setActiveTestimonial(0);
      return;
    }
    const timer = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [testimonials.length, useMotion]);

  const scrollStrip = (stripRef: { current: HTMLDivElement | null }, direction: 'left' | 'right') => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollBy({
      left: direction === 'left' ? -320 : 320,
      behavior: 'smooth',
    });
  };
  const handleHeroQuickLinkClick = (label: string, href: string) => {
    trackHomeEvent('home_quicklink_click', {
      label,
      href,
      slideIndex: currentSlide,
      variant: heroVariant,
    });
  };
  const handleHeroCtaClick = (slide: { id: string; ctaText: string; ctaLink: string }) => {
    trackHomeEvent('home_hero_cta_click', {
      slideId: slide.id,
      ctaText: slide.ctaText,
      ctaLink: slide.ctaLink,
      slideIndex: currentSlide,
      variant: heroVariant,
    });
  };
  const handleNewsletterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = String(newsletterEmail || '').trim().toLowerCase();
    if (!normalizedEmail) {
      setNewsletterStatus({ kind: 'error', message: 'Please enter a valid email address.' });
      return;
    }
    setNewsletterStatus({ kind: 'loading', message: '' });
    try {
      const response = await api.homepageSections.subscribeHomepageNewsletter({
        email: normalizedEmail,
        source: 'HOMEPAGE',
        metadata: { path: window.location.pathname },
      });
      if (!response.success) {
        throw new Error(response.message || 'Subscription failed');
      }
      const status = response.data?.status;
      const successMessage =
        status === 'ALREADY_SUBSCRIBED' ? newsletterConfig.duplicateMessage : newsletterConfig.successMessage;
      setNewsletterStatus({ kind: 'success', message: successMessage });
      setNewsletterEmail('');
    } catch (error) {
      setNewsletterStatus({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to subscribe right now.',
      });
    }
  };

  const resolveSpotlightHref = (designer: any) => {
    const linkMode = String(designer?.linkMode || 'DEFAULT_STORE').toUpperCase();
    if (linkMode === 'CUSTOM_URL' && designer?.externalUrl) {
      return String(designer.externalUrl);
    }
    if (linkMode === 'BLOG' && designer?.blog?.slug) {
      return `/stories/${encodeURIComponent(String(designer.blog.slug))}`;
    }
    const profileId = String(designer?.profileId || '').trim();
    if (String(designer?.vendorType || '').toUpperCase() === 'SELLER') {
      return profileId ? `/fabrics?sellerId=${encodeURIComponent(profileId)}` : '/fabrics';
    }
    return profileId ? `/custom?designerId=${encodeURIComponent(profileId)}` : '/custom';
  };

  const isExternalHref = (href: string) => /^(https?:\/\/|mailto:|tel:)/i.test(String(href || ''));
  const renderSpotlightCard = (designer: any, className = '', imageClassName = 'aspect-[3/4]') => {
    const href = resolveSpotlightHref(designer);
    const handleSpotlightClick = () => {
      trackHomeEvent('home_designer_spotlight_click', {
        designerId: String(designer?.id || ''),
        profileId: String(designer?.profileId || ''),
        vendorType: String(designer?.vendorType || 'DESIGNER'),
        href,
      });
    };
    const content = (
      <>
        <div className={`${imageClassName} overflow-hidden`}>
          <img
            src={designer.image}
            alt={designer.name}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 grayscale group-hover:grayscale-0"
            loading="lazy"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-center gap-2 mb-2">
            {designer.flagCode ? (
              <img
                src={countryCodeToFlagImageUrl(String(designer.flagCode || ''), 40)}
                alt={`${designer.country} flag`}
                className="h-5 w-7 rounded-sm object-cover shadow-md"
                loading="lazy"
              />
            ) : (
              <span className="text-[10px] font-semibold uppercase text-white/80">
                {sanitizeCountryCode(designer.country || '') || '--'}
              </span>
            )}
            <span className="text-white/70 text-sm">{designer.country}</span>
          </div>
          <h3 className="font-['Oswald'] text-2xl font-bold text-white mb-2">{designer.name}</h3>
          <p className="text-white/80 text-sm italic">&ldquo;{designer.quote}&rdquo;</p>
        </div>
      </>
    );
    if (isExternalHref(href)) {
      return (
        <a
          key={designer.id}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleSpotlightClick}
          className={`group relative overflow-hidden rounded-xl block ${className}`}
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        key={designer.id}
        to={href}
        onClick={handleSpotlightClick}
        className={`group relative overflow-hidden rounded-xl block ${className}`}
      >
        {content}
      </Link>
    );
  };

  return (
    <div
      className="min-h-screen bg-white"
      data-experience-mode={resolvedExperienceMode}
      data-hero-variant={heroVariant}
      data-category-variant={categoryEntryVariant}
      data-spotlight-variant={spotlightVariant}
      data-token-set={tokenSet}
    >
      {sectionVisibility.hero ? (
      <section
        className={`relative w-full overflow-hidden ${
          heroVariant === 'SPLIT_EDITORIAL'
            ? isLiteExperienceMode
              ? 'h-[76vh]'
              : 'h-[90vh]'
            : isLiteExperienceMode
              ? 'h-[72vh]'
              : 'h-screen'
        }`}
        data-analytics-section="home-hero"
      >
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 ${useMotion ? 'transition-opacity duration-1000' : ''} ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <img
              src={slide.image}
              alt={slide.title}
              className={`h-full object-cover ${
                heroVariant === 'SPLIT_EDITORIAL' ? 'w-full lg:w-[58%]' : 'w-full'
              }`}
            />
            {heroVariant === 'SPLIT_EDITORIAL' ? (
              <>
                <div className="absolute inset-y-0 right-0 hidden w-[42%] lg:block" style={{ backgroundColor: tokenPalette.heroPanel }} />
                <div className="absolute inset-0 bg-black/45 lg:hidden" />
              </>
            ) : (
              <div
                className={`absolute inset-0 ${
                  isLiteExperienceMode
                    ? 'bg-gradient-to-r from-black/55 via-black/35 to-black/30'
                    : heroVariant === 'VIDEO_STORY'
                      ? 'bg-gradient-to-r from-black/70 via-black/45 to-black/30'
                      : 'bg-gradient-to-r from-black/60 via-black/30 to-transparent'
                }`}
              />
            )}
          </div>
        ))}

        <div className="relative h-full flex items-center">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className={heroVariant === 'SPLIT_EDITORIAL' ? 'max-w-xl lg:ml-auto lg:pr-8' : 'max-w-2xl'}>
              {heroSlides.map((slide, index) => (
                <div
                  key={slide.id}
                  className={`${useMotion ? 'transition-all duration-700' : ''} ${
                    index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 absolute'
                  }`}
                >
                  {index === currentSlide && (
                    <>
                      <p
                        className="mb-3 text-[11px] font-semibold tracking-[0.25em] uppercase"
                        style={{ color: tokenPalette.heroMuted }}
                      >
                        {heroEyebrowText}
                      </p>
                      <h1
                        className={`font-['Oswald'] font-bold mb-6 leading-tight ${
                          heroVariant === 'SPLIT_EDITORIAL'
                            ? 'text-4xl sm:text-5xl lg:text-6xl'
                            : 'text-4xl sm:text-5xl lg:text-6xl xl:text-7xl'
                        } max-w-[12ch] break-words`}
                        style={{ color: tokenPalette.heroText }}
                      >
                        {clampText(slide.title, 56, 'ZURI KARIBU')}
                      </h1>
                      <p className="mb-8 max-w-[50ch] text-lg line-clamp-3 sm:text-xl" style={{ color: tokenPalette.heroMuted }}>
                        {clampText(
                          slide.subtitle,
                          120,
                          'Made by Africans. Worn by the world.'
                        )}
                      </p>
                      {heroSettings.showQuickLinks ? (
                        <div className="mb-5 flex flex-wrap items-center gap-2">
                          {heroQuickLinks.map((quickLink) => (
                            <Link
                              key={`${slide.id}-${quickLink.href}`}
                              to={safeHref(quickLink.href, '/shop')}
                              onClick={() => handleHeroQuickLinkClick(quickLink.label, quickLink.href)}
                              className={`${CTA_BUTTON_OVERLAY_CLASS} px-4 py-2 text-xs`}
                            >
                              {toCtaLabel(quickLink.label, 'Explore')}
                            </Link>
                          ))}
                        </div>
                      ) : null}
                      {heroSettings.ctaTarget === 'NEW_TAB' ? (
                        <a
                          href={safeHref(slide.ctaLink, '/ready-to-wear')}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => handleHeroCtaClick(slide)}
                          className={CTA_BUTTON_LIGHT_CLASS}
                        >
                          {heroSettings.forceUppercaseCtas
                            ? toCtaLabel(slide.ctaText || 'SHOP NOW', 'SHOP NOW')
                            : clampText(slide.ctaText || 'SHOP NOW', 24, 'SHOP NOW')}
                          <ArrowRight className="w-4 h-4" />
                        </a>
                      ) : (
                        <Link
                          to={safeHref(slide.ctaLink, '/ready-to-wear')}
                          onClick={() => handleHeroCtaClick(slide)}
                          className={CTA_BUTTON_LIGHT_CLASS}
                        >
                          {heroSettings.forceUppercaseCtas
                            ? toCtaLabel(slide.ctaText || 'SHOP NOW', 'SHOP NOW')
                            : clampText(slide.ctaText || 'SHOP NOW', 24, 'SHOP NOW')}
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      )}
                      {heroVariant === 'CLEAN_COMMERCE' ? (
                        <div className="mt-5 flex w-full max-w-xl items-center gap-2 rounded-md bg-white/95 p-2 text-black">
                          <Search className="h-4 w-4 text-gray-500" />
                          <input
                            type="text"
                            className="h-8 flex-1 bg-transparent text-sm outline-none"
                            placeholder="Search products..."
                            aria-label="Search products"
                          />
                          <Link
                            to="/shop"
                            className="inline-flex items-center rounded border border-black px-3 py-1 text-xs font-semibold"
                          >
                            Go
                          </Link>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {useMotion ? (
          <div
            className={`absolute left-1/2 -translate-x-1/2 flex gap-2 z-10 ${
              sectionVisibility.countries && !isLiteExperienceMode ? 'bottom-10' : 'bottom-8'
            }`}
          >
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  index === currentSlide
                    ? heroVariant === 'SPLIT_EDITORIAL'
                      ? 'w-8'
                      : 'bg-white w-8'
                    : heroVariant === 'SPLIT_EDITORIAL'
                      ? ''
                      : 'bg-white/50 hover:bg-white/70'
                }`}
                style={
                  heroVariant === 'SPLIT_EDITORIAL'
                    ? {
                        backgroundColor:
                          index === currentSlide ? tokenPalette.accent : `${tokenPalette.heroMuted}66`,
                      }
                    : undefined
                }
              />
            ))}
          </div>
        ) : null}
      </section>
      ) : null}

      {showTrustSection ? (
        <section className="border-y border-black/10 bg-[#f6f3ee] py-6 dark:border-white/10 dark:bg-[#141413]">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {trustBadges.map((badge) => {
                const BadgeIcon = TRUST_ICON_BY_NAME[badge.icon] || ShieldCheck;
                return (
                  <div
                    key={badge.id}
                    className="rounded-md border border-black/10 bg-white/70 px-4 py-3 dark:border-white/15 dark:bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <BadgeIcon className="h-4 w-4 text-black/70 dark:text-white/80" />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-black/75 dark:text-white/85">
                        {badge.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-black/60 dark:text-white/70">{badge.subtitle}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.countries ? (
        <section className="bg-[#0b0b0c] py-14 lg:py-20" data-analytics-section="shop-by-country">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/55">{shopByEyebrowText}</p>
                <h2 className="mt-2 font-['Oswald'] text-4xl font-bold uppercase leading-[0.95] text-white md:text-5xl">
                  {shopByTitleText}
                </h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-white/70">
                  Browse styles rooted in place, from West African prints to East African beadwork.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {AFRICAN_REGION_OPTIONS.map((regionKey) => (
                    <button
                      key={regionKey}
                      onClick={() => setActiveCountryRegion(regionKey)}
                      className={`rounded border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
                        activeCountryRegion === regionKey
                          ? 'border-white bg-white text-black'
                          : 'border-white/25 text-white/80 hover:border-white/60'
                      }`}
                    >
                      {regionKey} ({regionCountByKey[regionKey]})
                    </button>
                  ))}
                </div>
                {shopByStyleOptions.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {shopByStyleOptions.map((option: any, index: number) => (
                      <Link
                        key={`style-${index}-${asText(option?.label)}`}
                        to={safeHref(option?.href, '/shop')}
                        className="rounded border border-white/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/80 hover:border-white/60 hover:text-white"
                      >
                        {clampText(option?.label, 40, 'Style')}
                      </Link>
                    ))}
                  </div>
                ) : null}
                {shopByPriceOptions.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {shopByPriceOptions.map((option: any, index: number) => (
                      <Link
                        key={`price-${index}-${asText(option?.label)}`}
                        to={safeHref(option?.href, '/shop')}
                        className="rounded border border-white/15 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-white/70 hover:border-white/50 hover:text-white"
                      >
                        {clampText(option?.label, 40, 'Price')}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <Link to="/shop" className={`${CTA_BUTTON_OVERLAY_CLASS} mt-7`}>
                  {toCtaLabel('Explore countries', 'Explore countries')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="lg:col-span-7">
                <div className="space-y-4">
                  <div className="flex flex-nowrap gap-3 overflow-x-auto pb-1">
                    {featuredCountries.map((country) => (
                      <Link
                        key={`featured-${country.name}-${country.flagCode || 'na'}`}
                        to={safeHref(country.href, `/country-products?country=${encodeURIComponent(country.name)}`)}
                        className="min-w-[170px] rounded-md border border-white/15 bg-white/5 px-3 py-3 text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <div className="flex items-center gap-2">
                          {country.flagCode ? (
                            <img
                              src={countryCodeToFlagImageUrl(country.flagCode)}
                              alt={`${country.name} flag`}
                              className="h-5 w-7 rounded-sm object-cover shadow-sm"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-[10px] font-semibold uppercase">{sanitizeCountryCode(country.name) || '--'}</span>
                          )}
                          <span className="text-xs font-semibold">{country.name}</span>
                        </div>
                        <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-white/55">{country.region}</p>
                        <p className="text-[11px] text-white/70">{country.fabrics}</p>
                      </Link>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAllCountries((prev) => !prev)}
                    className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/80 hover:text-white"
                  >
                    {showAllCountries
                      ? 'Show featured countries only'
                      : `Show all ${Math.max(visibleCountries.length, 54).toLocaleString()} countries`}
                    <ArrowRight className={`h-3.5 w-3.5 transition-transform ${showAllCountries ? 'rotate-90' : ''}`} />
                  </button>
                  {showAllCountries ? (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-12">
                      {allCountriesForGrid.map((country) => (
                        <Link
                          key={`all-${country.name}-${country.flagCode || 'na'}`}
                          to={safeHref(country.href, `/country-products?country=${encodeURIComponent(country.name)}`)}
                          className="rounded-md border border-white/12 bg-white/5 px-2 py-3 text-center text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                        >
                          <span className="mx-auto flex items-center justify-center">
                            {country.flagCode ? (
                              <img
                                src={countryCodeToFlagImageUrl(country.flagCode)}
                                alt={`${country.name} flag`}
                                className="h-5 w-7 rounded-sm object-cover shadow-sm"
                                loading="lazy"
                              />
                            ) : (
                              <span className="text-[10px] font-semibold uppercase">{sanitizeCountryCode(country.name) || '--'}</span>
                            )}
                          </span>
                          <p className="mt-2 text-[11px] font-semibold leading-tight">{country.name}</p>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.statsStrip && activeStatsItems.length > 0 ? (
      <section
        className="relative overflow-hidden py-5"
        style={{
          backgroundColor: asText(statsStrip.backgroundColor, '#111827'),
          backgroundImage: asText(statsStrip.backgroundImage) ? `url(${asText(statsStrip.backgroundImage)})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: asText(statsStrip.overlayColor, '#000000'),
            opacity: Math.max(0, Math.min(1, Number(statsStrip.overlayOpacity ?? 45) / 100)),
          }}
        />
        <div className="relative w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-2 gap-6 text-center md:grid-cols-4">
            {activeStatsItems.map((item, index) => (
              <div key={`${item.label}-${index}`}>
                <p
                  className="font-['Oswald'] text-3xl font-bold sm:text-4xl lg:text-5xl"
                  style={{ color: asText(statsStrip.valueColor, '#ffffff') }}
                >
                  {item.value}
                  <span style={{ color: asText(statsStrip.suffixColor, '#facc15') }}>{item.suffix || ''}</span>
                </p>
                <p
                  className="mt-1 text-xs tracking-[0.25em] sm:text-sm"
                  style={{ color: asText(statsStrip.labelColor, '#d1d5db') }}
                >
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {!isLiteExperienceMode ? (
        <>
          <EditorialFeatureSection
            eyebrow={editorialReadyFeature.eyebrow}
            title={editorialReadyFeature.title}
            description={editorialReadyFeature.description}
            ctaText={editorialReadyFeature.ctaText}
            ctaLink={editorialReadyFeature.ctaLink}
            image={editorialReadyFeature.image}
          />
          <EditorialFeatureSection
            eyebrow={editorialFabricsFeature.eyebrow}
            title={editorialFabricsFeature.title}
            description={editorialFabricsFeature.description}
            ctaText={editorialFabricsFeature.ctaText}
            ctaLink={editorialFabricsFeature.ctaLink}
            image={editorialFabricsFeature.image}
            imageOnRight
          />
          <EditorialFeatureSection
            eyebrow={editorialCustomFeature.eyebrow}
            title={editorialCustomFeature.title}
            description={editorialCustomFeature.description}
            ctaText={editorialCustomFeature.ctaText}
            ctaLink={editorialCustomFeature.ctaLink}
            image={editorialCustomFeature.image}
          />
        </>
      ) : null}

      {sectionVisibility.categories ? (
      <section id="shop" className="py-10 lg:py-16 bg-white">
        <div className="w-full px-2 sm:px-4 lg:px-8 xl:px-12">
          <div className="text-center mb-16">
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              {asText(shopByBlocksDataResolved?.title, 'Shop by Category')}
            </h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              {asText(
                shopByBlocksDataResolved?.subtitle,
                'Choose what fits your moment, ready pieces, custom fits, or raw fabrics.'
              )}
            </p>
          </div>
          {categoryEntryVariant === 'MEGA_GRID' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-6" data-analytics-section="category-entry-mega-grid">
              {categories[0] ? (
                <Link key={categories[0].id} to={categories[0].link} className="group relative overflow-hidden rounded-xl cursor-pointer card-hover md:row-span-2">
                  <div className="aspect-[3/4] h-full overflow-hidden">
                    <img
                      src={categoryImageById[categories[0].id] || categories[0].image}
                      alt={categories[0].title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="mb-2 font-['Oswald'] text-3xl font-bold line-clamp-2">
                      {clampText(categories[0].title, 40, 'Ready To Wear')}
                    </h3>
                    <p className="mb-4 text-sm text-white/80 line-clamp-3">
                      {clampText(categories[0].description, 100, 'Discover curated looks from African makers.')}
                    </p>
                    {categories[0].countLabel ? (
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {categories[0].countLabel}
                      </p>
                    ) : null}
                    <span className="inline-flex items-center justify-center rounded-none border border-black bg-black px-6 py-2.5 text-sm font-semibold tracking-wider text-white transition-colors duration-200 group-hover:bg-black group-hover:text-white">
                      {toCtaLabel(categories[0].ctaText, 'SHOP NOW')}
                    </span>
                  </div>
                </Link>
              ) : null}
              {categories.slice(1).map((category) => (
                <Link key={category.id} to={category.link} className="group relative overflow-hidden rounded-xl cursor-pointer card-hover">
                  <div className="aspect-[16/10] overflow-hidden">
                    <img
                      src={categoryImageById[category.id] || category.image}
                      alt={category.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="mb-2 font-['Oswald'] text-2xl font-bold line-clamp-2">
                      {clampText(category.title, 40, 'Category')}
                    </h3>
                    <p className="mb-4 text-sm text-white/80 line-clamp-3">
                      {clampText(category.description, 100, 'Explore standout products across African fashion.')}
                    </p>
                    {category.countLabel ? (
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {category.countLabel}
                      </p>
                    ) : null}
                    <span className="inline-flex items-center justify-center rounded-none border border-black bg-black px-6 py-2.5 text-sm font-semibold tracking-wider text-white transition-colors duration-200 group-hover:bg-black group-hover:text-white">
                      {toCtaLabel(category.ctaText, 'SHOP NOW')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6" data-analytics-section="category-entry-three-column">
              {categories.map((category) => (
                <Link key={category.id} to={category.link} className="group relative overflow-hidden rounded-xl cursor-pointer card-hover">
                  <div className="aspect-[3/4] overflow-hidden">
                    <img
                      src={categoryImageById[category.id] || category.image}
                      alt={category.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                    <h3 className="mb-2 font-['Oswald'] text-2xl font-bold line-clamp-2">
                      {clampText(category.title, 40, 'Category')}
                    </h3>
                    <p className="mb-4 text-sm text-white/80 line-clamp-3">
                      {clampText(category.description, 100, 'Explore standout products across African fashion.')}
                    </p>
                    {category.countLabel ? (
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
                        {category.countLabel}
                      </p>
                    ) : null}
                    <span className="inline-flex items-center justify-center rounded-none border border-black bg-black px-6 py-2.5 text-sm font-semibold tracking-wider text-white transition-colors duration-200 group-hover:bg-black group-hover:text-white">
                      {toCtaLabel(category.ctaText, 'SHOP NOW')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      ) : null}

      {sectionVisibility.howItWorks ? (
      <section className="py-8 lg:py-12 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {howItWorks.map((step, index) => (
              <div
                key={step.id}
                className="group flex flex-col items-center text-center relative"
                onMouseEnter={() => setHoveredHowItWorksId(step.id)}
                onMouseLeave={() => setHoveredHowItWorksId(null)}
              >
                <div className="relative w-20 h-20 bg-white rounded-full border border-gray-200 flex items-center justify-center card-hover group-hover:bg-black group-hover:border-black transition-all duration-300 mb-4">
                  <step.icon
                    className={`w-8 h-8 transition-colors duration-300 ${useCustomHowItWorksColors ? '' : 'text-black/80 group-hover:text-white'}`}
                    style={
                      useCustomHowItWorksColors
                        ? { color: hoveredHowItWorksId === step.id ? howItWorksIconHoverColor : howItWorksIconColor }
                        : undefined
                    }
                  />
                  <span className="absolute -top-1 -right-1 w-6 h-6 bg-black text-white rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">{step.title}</h3>
                <p className="mt-1 text-xs text-gray-500 max-w-[180px]">{step.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.featuredCustomToWear ? (
        <ProductCarousel
          title={featuredSectionTitles.customToWear}
          subtitle="Made To Fit by an African with Love"
          products={featuredDesigns}
          stripRef={customStripRef}
          onLeft={() => scrollStrip(customStripRef, 'left')}
          onRight={() => scrollStrip(customStripRef, 'right')}
          viewAllLink="/custom"
          loading={featuredLoading}
          descriptionWordLimit={featuredDescriptionWordLimit}
        />
      ) : null}

      {managedBannersBySection.get('BANNER_1') ? (
        <section className="py-6 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={asImage(
                  managedBannersBySection.get('BANNER_1')?.displayImage,
                  managedBannersBySection.get('BANNER_1')?.images?.[0],
                  '/featured_custom_right.jpg'
                )}
                alt={asText(managedBannersBySection.get('BANNER_1')?.title, 'Homepage Banner')}
                className="h-[340px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 flex flex-col items-start justify-center p-8 text-white lg:p-12">
                <h3 className="font-['Oswald'] text-3xl font-bold lg:text-4xl">
                  {asText(managedBannersBySection.get('BANNER_1')?.title, 'Discover New African Fashion')}
                </h3>
                <p className="mt-2 max-w-xl text-white/85">
                  {asText(managedBannersBySection.get('BANNER_1')?.subtitle, 'Curated looks and handcrafted pieces from across the continent.')}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.featuredReadyToWear ? (
        <ProductCarousel
          title={featuredSectionTitles.readyToWear}
          subtitle="Made To Standard sizes for all"
          products={featuredRTW}
          stripRef={rtwStripRef}
          onLeft={() => scrollStrip(rtwStripRef, 'left')}
          onRight={() => scrollStrip(rtwStripRef, 'right')}
          viewAllLink="/ready-to-wear"
          loading={featuredLoading}
          descriptionWordLimit={featuredDescriptionWordLimit}
        />
      ) : null}

      {managedBannersBySection.get('BANNER_2') ? (
        <section className="py-6 bg-white">
          <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
            <div className="relative overflow-hidden rounded-xl">
              <img
                src={asImage(
                  managedBannersBySection.get('BANNER_2')?.displayImage,
                  managedBannersBySection.get('BANNER_2')?.images?.[0],
                  '/featured_rw_right.jpg'
                )}
                alt={asText(managedBannersBySection.get('BANNER_2')?.title, 'Homepage Banner')}
                className="h-[340px] w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/45" />
              <div className="absolute inset-0 flex flex-col items-start justify-center p-8 text-white lg:p-12">
                <h3 className="font-['Oswald'] text-3xl font-bold lg:text-4xl">
                  {asText(managedBannersBySection.get('BANNER_2')?.title, 'Fresh Collections')}
                </h3>
                <p className="mt-2 max-w-xl text-white/85">
                  {asText(managedBannersBySection.get('BANNER_2')?.subtitle, 'Limited releases and standout pieces from trusted African vendors.')}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {sectionVisibility.featuredFabrics ? (
        <ProductCarousel
          title={featuredSectionTitles.fabricsToBuy}
          subtitle="Fabrics from all across the edges of Africa"
          products={featuredFabrics}
          stripRef={fabricsStripRef}
          onLeft={() => scrollStrip(fabricsStripRef, 'left')}
          onRight={() => scrollStrip(fabricsStripRef, 'right')}
          viewAllLink="/fabrics"
          loading={featuredLoading}
          descriptionWordLimit={featuredDescriptionWordLimit}
        />
      ) : null}

      {sectionVisibility.promoBanner ? (
      <section className="py-10 lg:py-16 bg-gray-50">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="mb-4 rounded-none border-black text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
                {freshDropsConfig.eyebrow}
              </span>
              <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
                {freshDropsConfig.title}
              </h2>
              <p className="mb-6 text-gray-600 max-w-2xl">{freshDropsConfig.subtitle}</p>
              <Link
                to={freshDropsConfig.ctaLink}
                className={CTA_BUTTON_DARK_CLASS}
              >
                {toCtaLabel(freshDropsConfig.ctaText, 'SHOP NOW')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            <div>
              <div className="relative">
                <img
                  src={asImage(
                    managedBannersBySection.get('PROMO')?.displayImage,
                    managedBannersBySection.get('PROMO')?.images?.[0],
                    managedBannersBySection.get('HERO')?.displayImage,
                    managedBannersBySection.get('HERO')?.images?.[0],
                    '/rw_full.jpg'
                  )}
                  alt="Fresh Drops"
                  className="w-full aspect-[3/4] object-cover rounded-xl"
                />
                {freshDropsConfig.showBadge ? (
                  <div className="absolute -bottom-6 -left-6 bg-black text-white p-6 rounded-xl">
                    <p className="font-['Oswald'] text-3xl font-bold">{promoBadgeValue}</p>
                    <p className="text-sm text-white/70">{promoBadgeLabel}</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.designerSpotlight ? (
      <section className="py-10 lg:py-16 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="text-center mb-16">
            <span className="mb-4 rounded-none border-black text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
              DESIGNER SPOTLIGHT
            </span>
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">{designerSpotlightTitle}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">Showcasing rotating talent from different countries.</p>
          </div>

          {spotlightVariant === 'SINGLE_FEATURE' ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3" data-analytics-section="designer-spotlight-single">
              {designers[0] ? renderSpotlightCard(designers[0], 'md:col-span-2', 'aspect-[16/10] md:aspect-[4/3]') : null}
              <div className="grid grid-cols-1 gap-5">
                {designers.slice(1, 3).map((designer) =>
                  renderSpotlightCard(designer, '', 'aspect-[16/10]')
                )}
              </div>
            </div>
          ) : spotlightVariant === 'MOSAIC' ? (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3" data-analytics-section="designer-spotlight-mosaic">
              {designers.map((designer, index) =>
                renderSpotlightCard(
                  designer,
                  index === 0 ? 'md:col-span-2 md:row-span-2' : '',
                  index === 0 ? 'aspect-[16/10] md:aspect-[4/3]' : 'aspect-[16/10]'
                )
              )}
            </div>
          ) : (
            <div
              className="flex gap-6 overflow-x-auto pb-2 scrollbar-hide"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              data-analytics-section="designer-spotlight-carousel"
            >
              {designers.map((designer) => (
                <div key={designer.id} className="min-w-[300px] flex-1 md:min-w-[360px]">
                  {renderSpotlightCard(designer)}
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to="/custom"
              className={CTA_BUTTON_LIGHT_CLASS}
            >
              MEET ALL DESIGNERS
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.heritage ? (
      <section
        id="about"
        className="relative py-16 lg:py-24 bg-fixed bg-cover bg-center"
        style={{ backgroundImage: `url(${heritage.image})` }}
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-2xl mx-auto text-center">
            <span className="mb-4 rounded-none border-white text-white text-xs tracking-wider inline-flex border px-2.5 py-0.5 font-medium">
              HERITAGE STORY
            </span>
            <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">{heritage.title}</h2>
            <p className="text-white/80 text-lg leading-relaxed mb-8">{heritage.content}</p>
            {isExternalHref(heritage.ctaLink) ? (
              <a
                href={heritage.ctaLink}
                target="_blank"
                rel="noreferrer"
                className={CTA_BUTTON_OVERLAY_CLASS}
              >
                {toCtaLabel(heritage.ctaText, 'Read Story')}
                <ArrowRight className="w-4 h-4" />
              </a>
            ) : (
              <Link to={heritage.ctaLink} className={CTA_BUTTON_OVERLAY_CLASS}>
                {toCtaLabel(heritage.ctaText, 'Read Story')}
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.testimonials ? (
      <section className="py-10 lg:py-16 bg-white">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="text-center mb-16">
            <h2 className="font-['Oswald'] text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">What Our Customers Say</h2>
            <p className="text-gray-600">Join thousands of happy customers worldwide.</p>
          </div>

          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.id}
                  className={`transition-all duration-500 ${
                    index === activeTestimonial ? 'opacity-100 translate-x-0' : 'opacity-0 absolute inset-0 translate-x-8'
                  }`}
                >
                  {index === activeTestimonial && (
                    <div className="text-center">
                      <div className="flex justify-center gap-1 mb-6">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                      <blockquote className="text-lg sm:text-xl lg:text-2xl font-light italic text-gray-800 mb-8 leading-relaxed">
                        &ldquo;{testimonial.quote}&rdquo;
                      </blockquote>
                      <div className="flex items-center justify-center gap-4">
                        <img src={testimonial.avatar} alt={testimonial.name} className="w-14 h-14 rounded-full object-cover" />
                        <div className="text-left">
                          <p className="font-semibold">{testimonial.name}</p>
                          <p className="text-gray-500 text-sm">{testimonial.location}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-2 mt-10">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === activeTestimonial ? 'bg-black w-8' : 'bg-black/20 hover:bg-black/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.cta && (homepageCtaDataResolved?.enabled !== false) ? (
      <section
        className="py-10 lg:py-16 bg-gray-50"
        style={
          asText(homepageCtaDataResolved?.backgroundImage)
            ? {
                backgroundImage: `linear-gradient(rgba(255,255,255,0.86), rgba(255,255,255,0.9)), url(${asImage(
                  homepageCtaDataResolved?.backgroundImage
                )})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : undefined
        }
      >
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {asText(homepageCtaDataResolved?.title, 'Ready to Wear African Fashion?')}
            </h2>
            <p className="text-gray-600 text-lg mb-10">
              {asText(
                homepageCtaDataResolved?.subtitle,
                'Join our community of fashion lovers and discover unique pieces from talented African designers.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to={safeHref(homepageCtaDataResolved?.primaryCtaLink, '/ready-to-wear')}
                className={CTA_BUTTON_DARK_CLASS}
              >
                {toCtaLabel(homepageCtaDataResolved?.primaryCtaText, 'SHOP NOW')}
              </Link>
              <Link
                to={safeHref(homepageCtaDataResolved?.secondaryCtaLink, '/auth/register')}
                className={CTA_BUTTON_LIGHT_CLASS}
              >
                {toCtaLabel(homepageCtaDataResolved?.secondaryCtaText, 'CREATE ACCOUNT')}
              </Link>
            </div>
          </div>
        </div>
      </section>
      ) : null}

      {sectionVisibility.cta && newsletterConfig.enabled ? (
      <section id="contact" className="py-8 lg:py-12 bg-white border-t border-gray-100">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="max-w-xl mx-auto text-center">
            <h2 className="font-['Oswald'] text-2xl sm:text-3xl font-bold mb-3">{newsletterConfig.title}</h2>
            <p className="text-gray-600 mb-6">{newsletterConfig.subtitle}</p>
            <form className="flex flex-col sm:flex-row gap-3" onSubmit={handleNewsletterSubmit}>
              <input
                type="email"
                value={newsletterEmail}
                onChange={(event) => setNewsletterEmail(event.target.value)}
                placeholder={newsletterConfig.emailPlaceholder}
                className="flex-1 rounded-none border-black/20 focus:border-black h-12"
                required
              />
              <button
                type="submit"
                className={`${CTA_BUTTON_DARK_CLASS} whitespace-nowrap ${newsletterStatus.kind === 'loading' ? 'opacity-70' : ''}`}
                disabled={newsletterStatus.kind === 'loading'}
              >
                {newsletterStatus.kind === 'loading' ? 'SUBSCRIBING…' : newsletterConfig.submitLabel}
              </button>
            </form>
            {newsletterStatus.kind === 'success' ? (
              <p className="mt-3 text-sm text-green-700">{newsletterStatus.message}</p>
            ) : null}
            {newsletterStatus.kind === 'error' ? (
              <p className="mt-3 text-sm text-red-600">{newsletterStatus.message}</p>
            ) : null}
          </div>
        </div>
      </section>
      ) : null}
    </div>
  );
}
