import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Globe,
  Headphones,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api, resolveAssetUrl } from '../services/api';
import { useCurrencyStore } from '../store/currencyStore';
import {
  HOMEPAGE_EXPERIENCE_DEFAULTS,
  normalizeHomepageExperienceSettings,
} from '../design/homepageExperience';
import {
  AFRICAN_COUNTRIES,
  AFRICAN_REGION_OPTIONS,
  type AfricanRegion,
} from '../data/africanCountries';

type ShopTab = 'category' | 'country' | 'occasion' | 'price';

type ProductCardRow = {
  id: string;
  name: string;
  priceUsd: number;
  image: string;
  country: string;
  path: string;
};
type TrustBadgeRow = {
  title: string;
  subtitle: string;
  Icon: typeof ShieldCheck;
};
type KimiCopyRow = {
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

const asFlag = (code: string) =>
  String(code || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

const asText = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
};

const toNumber = (...values: any[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const clampText = (value: unknown, maxLength: number, fallback = '') => {
  const source = asText(value, fallback);
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
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

const normalizeImageUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  return resolveAssetUrl(raw) || raw;
};

const asImage = (...values: any[]) => {
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const normalized = normalizeImageUrl(entry?.url || entry?.secureUrl || entry?.src || entry?.image || entry);
        if (normalized) return normalized;
      }
      continue;
    }
    if (typeof value === 'object' && value) {
      const obj = value as any;
      const normalized = normalizeImageUrl(
        obj.url || obj.secureUrl || obj.src || obj.image || obj.imageUrl || obj.displayImage
      );
      if (normalized) return normalized;
      continue;
    }
    const normalized = normalizeImageUrl(value);
    if (normalized) return normalized;
  }
  return '';
};

const categories = [
  { label: 'Ready to Wear', href: '/ready-to-wear', image: '/kimi/rw_full.jpg', count: '480+' },
  { label: 'Custom to Wear', href: '/custom', image: '/kimi/custom_full.jpg', count: '220+' },
  { label: 'Fabrics', href: '/fabrics', image: '/kimi/fabrics_full.jpg', count: '640+' },
  { label: 'Fresh Drops', href: '/shop', image: '/kimi/featured_rw_right.jpg', count: '80+' },
];

const occasionItems = [
  { label: 'Wedding', href: '/shop' },
  { label: 'Casual', href: '/shop' },
  { label: 'Formal', href: '/shop' },
  { label: 'Festival', href: '/shop' },
];

const priceItems = [
  { label: 'Under $100', href: '/shop' },
  { label: '$100 - $300', href: '/shop' },
  { label: '$300 - $500', href: '/shop' },
  { label: '$500+', href: '/shop' },
];

const TRUST_BADGE_ICON_MAP: Record<string, typeof ShieldCheck> = {
  SHIELD_CHECK: ShieldCheck,
  TRUCK: Truck,
  REFRESH_CW: RefreshCw,
  HEADPHONES: Headphones,
  GLOBE: Globe,
  SHOPPING_BAG: ShoppingBag,
};
const V14_TRUST_BADGES_DEFAULTS: Array<{ icon: keyof typeof TRUST_BADGE_ICON_MAP; title: string; subtitle: string }> = [
  { icon: 'SHIELD_CHECK', title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers' },
  { icon: 'TRUCK', title: 'Global Shipping', subtitle: 'Reliable delivery worldwide' },
  { icon: 'REFRESH_CW', title: 'Easy Returns', subtitle: 'Simple returns on eligible orders' },
  { icon: 'HEADPHONES', title: '24/7 Support', subtitle: 'Chat and ticket support anytime' },
];
const V14_KIMI_COPY_DEFAULTS: KimiCopyRow = {
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
};

const toProductCard = (row: any, path: string): ProductCardRow => ({
  id: String(row?.id || crypto.randomUUID()),
  name: clampText(row?.name, 60, 'Featured Product'),
  priceUsd: toNumber(row?.priceUsd, row?.price, row?.finalPrice, row?.basePrice, 0),
  image: asImage(row?.image, row?.images, '/kimi/product1.jpg'),
  country: clampText(row?.country, 30, 'Africa'),
  path,
});

function ProductStrip({ title, rows }: { title: string; rows: ProductCardRow[] }) {
  const { formatFromUsd } = useCurrencyStore();
  if (!rows.length) return null;
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-['Oswald'] text-3xl font-bold">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {rows.slice(0, 4).map((row) => (
          <Link key={row.id} to={row.path} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden border border-black/15 bg-white">
              <img src={row.image} alt={row.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-black/60">{row.country}</p>
            <p className="text-sm font-semibold">{formatFromUsd(row.priceUsd)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function HomeKimi() {
  const [tab, setTab] = useState<ShopTab>('category');
  const [region, setRegion] = useState<'ALL' | AfricanRegion>('ALL');
  const { data: heroSlidesData } = useQuery({
    queryKey: ['homeKimiHeroSlides'],
    queryFn: async () => {
      const response = await api.homepage.getHeroSlides();
      return response.success ? response.data : null;
    },
  });
  const { data: categoriesData } = useQuery({
    queryKey: ['homeKimiCategories'],
    queryFn: async () => {
      const response = await api.homepageSections.getCategories();
      return response.success ? response.data : null;
    },
  });
  const { data: countriesData } = useQuery({
    queryKey: ['homeKimiCountries'],
    queryFn: async () => {
      const response = await api.homepageSections.getCountries();
      return response.success ? response.data : null;
    },
  });
  const { data: featuredData } = useQuery({
    queryKey: ['homeKimiFeatured'],
    queryFn: async () => {
      const response = await api.homepage.getAllFeatured();
      return response.success ? response.data : null;
    },
  });
  const { data: designerSpotlightsData } = useQuery({
    queryKey: ['homeKimiDesignerSpotlights'],
    queryFn: async () => {
      const response = await api.homepageSections.getDesignerSpotlights();
      return response.success ? response.data : null;
    },
  });
  const { data: homepageExperienceData } = useQuery({
    queryKey: ['homepageExperienceSettings'],
    queryFn: async () => {
      const response = await api.homepageSections.getExperienceSettings();
      return response.success ? response.data : null;
    },
  });
  const homepageExperienceSettings = useMemo(
    () => normalizeHomepageExperienceSettings(homepageExperienceData || HOMEPAGE_EXPERIENCE_DEFAULTS),
    [homepageExperienceData]
  );

  const heroSlide = useMemo(() => {
    const source = Array.isArray(heroSlidesData) && heroSlidesData.length > 0 ? heroSlidesData[0] : null;
    return {
      image: asImage(source?.image, '/kimi/hero_model.jpg'),
      title: clampText(source?.title, 56, 'ZURI KARIBU'),
      subtitle: clampText(source?.subtitle, 120, 'Made by Africans. Worn by the world.'),
      ctaText: clampText(source?.ctaText, 24, 'Shop now'),
      ctaLink: safeHref(source?.ctaLink, '/shop'),
    };
  }, [heroSlidesData]);

  const dynamicCategories = useMemo(() => {
    const source = Array.isArray(categoriesData) && categoriesData.length > 0 ? categoriesData : [];
    if (!source.length) return categories;
    return source.slice(0, 4).map((row: any, index: number) => ({
      label: clampText(row?.title, 40, categories[index % categories.length].label),
      href: safeHref(row?.ctaLink, row?.link, categories[index % categories.length].href),
      image: asImage(row?.image, row?.images, categories[index % categories.length].image),
      count: clampText(
        row?.countText,
        16,
        toNumber(row?.count, row?.productCount, 0) > 0
          ? `${toNumber(row?.count, row?.productCount, 0).toLocaleString()}+`
          : categories[index % categories.length].count
      ),
    }));
  }, [categoriesData]);

  const mergedCountries = useMemo(() => {
    const backendRows = Array.isArray(countriesData) ? countriesData : [];
    const backendByName = new Map<string, any>();
    for (const row of backendRows) {
      const name = asText(row?.name, row?.country, '');
      if (name) backendByName.set(name.toLowerCase(), row);
    }
    return AFRICAN_COUNTRIES.map((country) => {
      const backend = backendByName.get(country.name.toLowerCase()) || null;
      return {
        ...country,
        count: toNumber(backend?.count, backend?.productCount, backend?.products, 0),
      };
    });
  }, [countriesData]);

  const filteredCountries = useMemo(
    () => mergedCountries.filter((country) => (region === 'ALL' ? true : country.region === region)).slice(0, 12),
    [mergedCountries, region]
  );

  const featuredDesigns = useMemo(
    () =>
      (Array.isArray((featuredData as any)?.FEATURED_DESIGNS) ? (featuredData as any).FEATURED_DESIGNS : []).map(
        (row: any) => toProductCard(row, `/custom/${row?.id}`)
      ),
    [featuredData]
  );
  const featuredRtw = useMemo(
    () =>
      (Array.isArray((featuredData as any)?.FEATURED_READY_TO_WEAR)
        ? (featuredData as any).FEATURED_READY_TO_WEAR
        : []
      ).map((row: any) => toProductCard(row, `/ready-to-wear/${row?.id}`)),
    [featuredData]
  );
  const featuredFabrics = useMemo(
    () =>
      (Array.isArray((featuredData as any)?.FEATURED_FABRICS) ? (featuredData as any).FEATURED_FABRICS : []).map(
        (row: any) => toProductCard(row, `/fabrics/${row?.id}`)
      ),
    [featuredData]
  );

  const designers = useMemo(
    () =>
      (Array.isArray(designerSpotlightsData) ? designerSpotlightsData : []).slice(0, 3).map((row: any, index: number) => ({
        id: String(row?.id || index),
        name: clampText(row?.name, 40, 'Designer Spotlight'),
        image: asImage(row?.image, row?.displayImage, '/kimi/designer_spotlight.jpg'),
        country: clampText(row?.country, 28, 'Africa'),
      })),
    [designerSpotlightsData]
  );
  const trustBadges = useMemo<TrustBadgeRow[]>(() => {
    const source = Array.isArray(homepageExperienceSettings.trustBadges)
      ? homepageExperienceSettings.trustBadges
      : HOMEPAGE_EXPERIENCE_DEFAULTS.trustBadges;
    const activeRows = source.filter((row) => row?.enabled !== false);
    const normalizedActiveRows = activeRows.map((row) => ({
      title: clampText(row.title, 48, ''),
      subtitle: clampText(row.subtitle, 90, ''),
      icon: String(row.icon || '').toUpperCase(),
    }));
    const rows: TrustBadgeRow[] = [];
    for (let index = 0; index < V14_TRUST_BADGES_DEFAULTS.length; index += 1) {
      const configured = normalizedActiveRows[index];
      const fallback = V14_TRUST_BADGES_DEFAULTS[index];
      rows.push({
        title: configured?.title || fallback.title,
        subtitle: configured?.subtitle || fallback.subtitle,
        Icon: TRUST_BADGE_ICON_MAP[configured?.icon || fallback.icon] || TRUST_BADGE_ICON_MAP[fallback.icon],
      });
    }
    return rows;
  }, [homepageExperienceSettings.trustBadges]);
  const kimiCopy = useMemo<KimiCopyRow>(() => {
    const source = homepageExperienceSettings.kimiCopy || HOMEPAGE_EXPERIENCE_DEFAULTS.kimiCopy || {};
    return {
      heroEyebrow: clampText(source.heroEyebrow, 40, V14_KIMI_COPY_DEFAULTS.heroEyebrow),
      shopByEyebrow: clampText(source.shopByEyebrow, 40, V14_KIMI_COPY_DEFAULTS.shopByEyebrow),
      shopByTitle: clampText(source.shopByTitle, 60, V14_KIMI_COPY_DEFAULTS.shopByTitle),
      featuredRtwTitle: clampText(source.featuredRtwTitle, 60, V14_KIMI_COPY_DEFAULTS.featuredRtwTitle),
      featuredFabricsTitle: clampText(source.featuredFabricsTitle, 60, V14_KIMI_COPY_DEFAULTS.featuredFabricsTitle),
      featuredDesignsTitle: clampText(source.featuredDesignsTitle, 60, V14_KIMI_COPY_DEFAULTS.featuredDesignsTitle),
      designerSpotlightTitle: clampText(source.designerSpotlightTitle, 60, V14_KIMI_COPY_DEFAULTS.designerSpotlightTitle),
      quickPathRtwLabel: clampText(source.quickPathRtwLabel, 32, V14_KIMI_COPY_DEFAULTS.quickPathRtwLabel),
      quickPathCustomLabel: clampText(source.quickPathCustomLabel, 32, V14_KIMI_COPY_DEFAULTS.quickPathCustomLabel),
      quickPathFabricsLabel: clampText(source.quickPathFabricsLabel, 32, V14_KIMI_COPY_DEFAULTS.quickPathFabricsLabel),
    };
  }, [homepageExperienceSettings.kimiCopy]);

  return (
    <div className="min-h-screen bg-[#f8f6f1] text-[#1a1a1a]">
      <section className="grid min-h-[86vh] grid-cols-1 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <img src={heroSlide.image} alt="Kimi hero" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent lg:hidden" />
        </div>
        <div className="flex items-center bg-[#f8f6f1] px-6 py-10 lg:col-span-5 lg:px-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665c]">{kimiCopy.heroEyebrow}</p>
            <h1 className="mt-3 font-['Oswald'] text-5xl font-bold leading-[0.9] md:text-6xl">
              {heroSlide.title.replace(/KARIBU/i, '').trim()}{' '}
              <span className="text-[#e85a3c]">KARIBU</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-base text-[#5b564d]">
              {heroSlide.subtitle}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to={heroSlide.ctaLink}
                className="inline-flex items-center gap-2 border border-black bg-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                {heroSlide.ctaText}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ready-to-wear" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                {kimiCopy.quickPathRtwLabel}
              </Link>
              <Link to="/custom" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                {kimiCopy.quickPathCustomLabel}
              </Link>
              <Link to="/fabrics" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                {kimiCopy.quickPathFabricsLabel}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white py-6">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {trustBadges.map((badge, index) => (
            <div key={`${badge.title}-${index}`} className="flex items-center gap-3 rounded border border-black/10 px-4 py-3">
              <badge.Icon className="h-4 w-4 text-[#e85a3c]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em]">{badge.title}</p>
                <p className="text-xs text-black/60">{badge.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="shop" className="mx-auto w-full max-w-[1400px] px-4 py-16 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665c]">{kimiCopy.shopByEyebrow}</p>
          <h2 className="mt-2 font-['Oswald'] text-4xl font-bold">{kimiCopy.shopByTitle}</h2>
        </div>
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => setTab('category')} className={`px-4 py-2 text-sm border ${tab === 'category' ? 'bg-black text-white' : 'bg-white'}`}>
            <ShoppingBag className="mr-2 inline h-4 w-4" />
            Category
          </button>
          <button onClick={() => setTab('country')} className={`px-4 py-2 text-sm border ${tab === 'country' ? 'bg-black text-white' : 'bg-white'}`}>
            <Globe className="mr-2 inline h-4 w-4" />
            Country
          </button>
          <button onClick={() => setTab('occasion')} className={`px-4 py-2 text-sm border ${tab === 'occasion' ? 'bg-black text-white' : 'bg-white'}`}>
            <Calendar className="mr-2 inline h-4 w-4" />
            Occasion
          </button>
          <button onClick={() => setTab('price')} className={`px-4 py-2 text-sm border ${tab === 'price' ? 'bg-black text-white' : 'bg-white'}`}>
            <Tag className="mr-2 inline h-4 w-4" />
            Price
          </button>
        </div>

        {tab === 'category' ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {dynamicCategories.map((item) => (
              <Link key={item.label} to={item.href} className="group relative aspect-[3/4] overflow-hidden border border-black/15">
                <img src={item.image} alt={item.label} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-white/70">{item.count}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}

        {tab === 'country' ? (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {AFRICAN_REGION_OPTIONS.map((key) => (
                <button
                  key={key}
                  onClick={() => setRegion(key)}
                  className={`border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] ${
                    region === key ? 'bg-black text-white' : 'bg-white'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {filteredCountries.map((country) => (
                <Link key={country.code} to={`/country-products?country=${encodeURIComponent(country.name)}`} className="border bg-white p-3 text-center hover:border-[#e85a3c]">
                  <p className="text-2xl">{asFlag(country.code)}</p>
                  <p className="mt-1 text-xs font-semibold">{country.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.12em] text-black/55">{country.region}</p>
                  <p className="text-[10px] text-black/50">{country.count > 0 ? `${country.count} products` : 'Explore'}</p>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'occasion' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {occasionItems.map((item) => (
              <Link key={item.label} to={item.href} className="border bg-white p-4 text-center text-sm font-medium hover:border-[#e85a3c]">
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        {tab === 'price' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {priceItems.map((item) => (
              <Link key={item.label} to={item.href} className="border bg-white p-4 text-center text-sm font-medium hover:border-[#e85a3c]">
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <ProductStrip title={kimiCopy.featuredRtwTitle} rows={featuredRtw} />
      <ProductStrip title={kimiCopy.featuredFabricsTitle} rows={featuredFabrics} />
      <ProductStrip title={kimiCopy.featuredDesignsTitle} rows={featuredDesigns} />

      {designers.length > 0 ? (
        <section className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-2 lg:px-8">
          <h3 className="mb-4 font-['Oswald'] text-3xl font-bold">{kimiCopy.designerSpotlightTitle}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {designers.map((designer) => (
              <article key={designer.id} className="relative overflow-hidden border border-black/15">
                <img src={designer.image} alt={designer.name} className="h-[320px] w-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 p-4 text-white">
                  <p className="text-xs uppercase tracking-[0.16em] text-white/70">{designer.country}</p>
                  <p className="font-['Oswald'] text-2xl">{designer.name}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 pb-20 lg:grid-cols-3 lg:px-8">
        <Link to="/ready-to-wear" className="group relative overflow-hidden border border-black/15">
          <img src="/kimi/featured_rw_left.jpg" alt="Ready to wear feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Ready to Wear</p>
            <p className="mt-2 font-['Oswald'] text-3xl">Standardized fits</p>
          </div>
        </Link>
        <Link to="/fabrics" className="group relative overflow-hidden border border-black/15">
          <img src="/kimi/featured_custom_left.jpg" alt="Fabrics feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Fabrics</p>
            <p className="mt-2 font-['Oswald'] text-3xl">Authentic textiles</p>
          </div>
        </Link>
        <Link to="/custom" className="group relative overflow-hidden border border-black/15">
          <img src="/kimi/featured_custom_right.jpg" alt="Custom feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Custom to Wear</p>
            <p className="mt-2 font-['Oswald'] text-3xl">Made for your fit</p>
          </div>
        </Link>
      </section>
    </div>
  );
}

