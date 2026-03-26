import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Globe,
  Headphones,
  Heart,
  Menu,
  Palette,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Tag,
  Truck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import '../../styles/jenks-v2.css';

type HeroSlide = {
  id: string;
  image: string;
  titleA: string;
  titleB: string;
  lineA: string;
  lineB: string;
  cta: string;
  href: string;
};

type ShopByTab = 'CATEGORY' | 'COUNTRY' | 'STYLE' | 'PRICE';
type CountryRegion = 'ALL' | 'NORTH' | 'WEST' | 'CENTRAL' | 'EAST' | 'SOUTHERN';

const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';
const HERO_HEIGHT_CLASS = 'min-h-[106vh]';

const HERO: HeroSlide[] = [
  {
    id: '1',
    image: `${ASSET_BASE}/hero_model.jpg`,
    titleA: 'WEAR',
    titleB: 'THE STORY OF AFRICA',
    lineA: 'Curated fashion from top designers and textile houses.',
    lineB: 'Ready-to-wear, fabrics, and custom looks in one destination.',
    cta: 'SHOP NOW',
    href: '/ready-to-wear',
  },
  {
    id: '2',
    image: `${ASSET_BASE}/rw_full.jpg`,
    titleA: 'DISCOVER',
    titleB: 'AFRICAN ELEGANCE',
    lineA: 'Signature pieces and modern tailoring from trusted labels.',
    lineB: 'Designed on the continent. Styled for the world.',
    cta: 'SHOP NOW',
    href: '/ready-to-wear',
  },
];

const HOW_IT_WORKS = [
  ['DISCOVER', 'Browse categories and curated looks'],
  ['PICK FABRIC', 'Choose textile quality and color'],
  ['SUBMIT FIT', 'Send measurements for tailoring'],
  ['PAY SECURELY', 'Checkout with protected payments'],
  ['CRAFTED', 'Makers begin production'],
  ['DELIVERED', 'Shipped globally to your location'],
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

const SHOP_BY_COUNTRY = [
  { name: 'Nigeria', count: 156, textiles: 'Ankara • Adire', flag: 'ng' },
  { name: 'Ghana', count: 89, textiles: 'Kente • Batik', flag: 'gh' },
  { name: 'Kenya', count: 67, textiles: 'Kanga • Kikoy', flag: 'ke' },
  { name: 'South Africa', count: 54, textiles: 'Shweshwe • Xhosa', flag: 'za' },
  { name: 'Egypt', count: 44, textiles: 'Linen • Cotton', flag: 'eg' },
  { name: 'Senegal', count: 38, textiles: 'Bazin • Wax', flag: 'sn' },
];

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

const COUNTRY_SHOWCASE: Array<{ name: string; flag: string; region: Exclude<CountryRegion, 'ALL'> }> = [
  { name: 'Egypt', flag: 'eg', region: 'NORTH' },
  { name: 'Morocco', flag: 'ma', region: 'NORTH' },
  { name: 'Burkina Faso', flag: 'bf', region: 'WEST' },
  { name: 'Ghana', flag: 'gh', region: 'WEST' },
  { name: 'Mali', flag: 'ml', region: 'WEST' },
  { name: 'Nigeria', flag: 'ng', region: 'WEST' },
  { name: 'Senegal', flag: 'sn', region: 'WEST' },
  { name: 'Cameroon', flag: 'cm', region: 'CENTRAL' },
  { name: 'Congo', flag: 'cg', region: 'CENTRAL' },
  { name: 'Ethiopia', flag: 'et', region: 'EAST' },
  { name: 'Kenya', flag: 'ke', region: 'EAST' },
  { name: 'Madagascar', flag: 'mg', region: 'EAST' },
  { name: 'Mauritius', flag: 'mu', region: 'EAST' },
  { name: 'Rwanda', flag: 'rw', region: 'EAST' },
  { name: 'Seychelles', flag: 'sc', region: 'EAST' },
  { name: 'Tanzania', flag: 'tz', region: 'EAST' },
  { name: 'Uganda', flag: 'ug', region: 'EAST' },
  { name: 'Botswana', flag: 'bw', region: 'SOUTHERN' },
  { name: 'Eswatini', flag: 'sz', region: 'SOUTHERN' },
  { name: 'Lesotho', flag: 'ls', region: 'SOUTHERN' },
  { name: 'Namibia', flag: 'na', region: 'SOUTHERN' },
  { name: 'South Africa', flag: 'za', region: 'SOUTHERN' },
  { name: 'Zambia', flag: 'zm', region: 'SOUTHERN' },
  { name: 'Zimbabwe', flag: 'zw', region: 'SOUTHERN' },
];

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

export default function JenksFrontpageV2() {
  const [index, setIndex] = useState(0);
  const [shopByTab, setShopByTab] = useState<ShopByTab>('CATEGORY');
  const [countryRegion, setCountryRegion] = useState<CountryRegion>('ALL');
  const freshDropsStripRef = useRef<HTMLDivElement | null>(null);
  const active = useMemo(() => HERO[index] || HERO[0], [index]);
  const filteredCountryShowcase = useMemo(
    () => COUNTRY_SHOWCASE.filter((country) => countryRegion === 'ALL' || country.region === countryRegion),
    [countryRegion]
  );
  const countryRegionCounts = useMemo(() => {
    return COUNTRY_REGION_OPTIONS.reduce<Record<CountryRegion, number>>(
      (acc, option) => {
        if (option.key === 'ALL') {
          acc.ALL = COUNTRY_SHOWCASE.length;
          return acc;
        }
        acc[option.key] = COUNTRY_SHOWCASE.filter((country) => country.region === option.key).length;
        return acc;
      },
      { ALL: COUNTRY_SHOWCASE.length, NORTH: 0, WEST: 0, CENTRAL: 0, EAST: 0, SOUTHERN: 0 }
    );
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((p) => (p + 1) % HERO.length), 7000);
    return () => window.clearInterval(timer);
  }, []);

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

  return (
    <div className="kimi-site bg-[#f5f3ee] text-[#111]">
      {/* TOP STRIP + TOP NAVIGATION */}
      <div className="sticky top-0 z-50">
        <div className="h-8 bg-black text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
          <div className="mx-auto flex h-full w-full max-w-[1700px] items-center justify-center px-4">
            Made by Africans. Worn by the world.
          </div>
        </div>
        <header className="h-14 border-b border-black/10 bg-[#f5f3ee]/95 backdrop-blur">
          <div className="relative mx-auto flex h-full w-full max-w-[1700px] items-center justify-between px-4 sm:px-6 lg:px-12">
            <div className="flex items-center gap-3 text-black/75">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
            </div>

            <p className="absolute left-1/2 -translate-x-1/2 font-['Oswald'] text-[27px] font-semibold uppercase leading-none tracking-[0.08em]">
              <span>ZURI</span>
              <span className="text-[#e66045]">KARIBU</span>
            </p>

            <div className="flex items-center gap-3 text-black/75">
              <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 md:flex">
                <Link to="/about" className="hover:text-black">About Us</Link>
                <Link to="/contact" className="hover:text-black">Contact Us</Link>
              </div>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20" aria-label="Theme">
                <Sun className="h-4 w-4 text-[#e66045]" />
              </button>
              <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Cart">
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute right-0 top-0 h-3.5 min-w-3.5 rounded-full bg-[#e66045] px-1 text-[9px] font-semibold leading-[14px] text-white">
                  0
                </span>
              </button>
              <Link to="/auth/login" className="hidden text-xs font-semibold uppercase tracking-[0.12em] hover:text-black sm:inline">
                Sign In
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* HERO */}
      <section className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 lg:grid-cols-12`}>
        <div className="relative lg:col-span-7">
          {HERO.map((slide, i) => (
            <img
              key={slide.id}
              src={slide.image}
              alt={slide.titleA}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-1000 ${
                i === index ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
              }`}
            />
          ))}
        </div>
        <div className="relative flex items-center bg-[#f5f3ee] px-6 py-10 lg:col-span-5 lg:px-12">
          <div className="max-w-[560px] animate-fade-in" data-kimi-anim="fade-up">
            <h1 className="font-['Oswald'] text-[58px] font-bold uppercase leading-[0.9] sm:text-[72px]">
              <span>{active.titleA}</span>
              <span className="ml-[0.16em] text-[#e66045]">{active.titleB}</span>
            </h1>
            <p className="mt-6 text-[16px] font-light leading-[1.35] text-black/84 sm:text-[18px]">{active.lineA}</p>
            <p className="mt-4 text-sm text-black/55">{active.lineB}</p>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/45">Shop by category</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to="/ready-to-wear" className="border border-black/15 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                READY TO WEAR
              </Link>
              <Link to="/custom" className="border border-black/15 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                CUSTOM
              </Link>
              <Link to="/fabrics" className="border border-black/15 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em]">
                FABRICS
              </Link>
            </div>
            <Link to={active.href} className="mt-6 inline-flex items-center gap-2 bg-[#e66045] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white">
              {active.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* SHOP BY */}
      <section className="bg-[#07090d] py-14 lg:py-16" data-kimi-anim="fade-up">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <p className="text-center text-[10px] font-semibold uppercase tracking-[0.22em] text-white/45">Discover</p>
          <h2 className="mt-2 text-center font-['Oswald'] text-6xl font-bold uppercase leading-none text-white">SHOP BY</h2>
          <p className="mt-3 text-center text-base text-white/60">Browse by category, country, style, or budget.</p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {[
              { key: 'CATEGORY', label: 'Category', Icon: ShoppingBag },
              { key: 'COUNTRY', label: 'Country', Icon: Globe },
              { key: 'STYLE', label: 'Occasion / Style', Icon: CalendarDays },
              { key: 'PRICE', label: 'Price', Icon: Tag },
            ].map((tab) => {
              const isActive = shopByTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setShopByTab(tab.key as ShopByTab)}
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
              {SHOP_BY_CATEGORY.map((card) => (
                <Link key={card.id} to={card.href} className="group relative overflow-hidden border border-white/10">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="h-[82vh] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
                    <div className="flex items-center gap-2">
                      <card.Icon className="h-4 w-4 text-white/90" />
                      <p className="font-['Oswald'] text-4xl font-semibold uppercase leading-none">{card.title}</p>
                    </div>
                    <p className="mt-2 text-sm text-white/80">{card.subtitle}</p>
                    <p className="mt-1 text-xs text-white/70">{card.meta}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : null}

          {shopByTab === 'COUNTRY' ? (
            <div className="mt-10">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
                {SHOP_BY_COUNTRY.map((country) => (
                  <Link
                    key={country.name}
                    to={`/country-products?country=${encodeURIComponent(country.name)}`}
                    className="group flex flex-col items-center rounded border border-white/10 bg-white/[0.04] px-3 py-4 text-center hover:border-white/25"
                  >
                    <img
                      src={`https://flagcdn.com/w80/${country.flag}.png`}
                      alt={`${country.name} flag`}
                      className="h-9 w-9 rounded-full border border-white/15 object-cover"
                      loading="lazy"
                    />
                    <p className="mt-3 text-base font-semibold text-white">
                      {country.name} - {country.count}
                    </p>
                    <p className="text-xs text-white/55">{country.textiles}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-8 text-center">
                <Link to="/country-products" className="inline-flex items-center gap-2 text-2xl font-semibold text-white/85 hover:text-white">
                  View all 54 countries
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : null}

          {shopByTab === 'STYLE' ? (
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {SHOP_BY_STYLE.map((styleItem) => (
                <Link
                  key={styleItem.name}
                  to="/shop"
                  className="rounded border border-white/10 bg-white/[0.06] px-5 py-9 text-center transition-colors hover:border-white/25"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/40 text-[#e66045]">
                    <styleItem.Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-2xl font-semibold text-white">{styleItem.name}</p>
                  <p className="mt-1 text-sm text-white/50">{styleItem.sub}</p>
                </Link>
              ))}
            </div>
          ) : null}

          {shopByTab === 'PRICE' ? (
            <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
              {SHOP_BY_PRICE.map((priceItem) => (
                <Link
                  key={priceItem.range}
                  to="/shop"
                  className="rounded border border-white/10 bg-white/[0.06] px-5 py-7 transition-colors hover:border-white/25"
                >
                  <div className="flex items-center gap-2 text-[#e66045]">
                    <Tag className="h-4 w-4" />
                  </div>
                  <p className="mt-3 text-3xl font-semibold text-white">{priceItem.range}</p>
                  <p className="mt-1 text-sm text-white/55">{priceItem.sub}</p>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* SHOP BY COUNTRY (DEDICATED) */}
      <section className="bg-[#06080b] py-12 lg:py-14" data-kimi-anim="fade-up">
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
              to="/country-products"
              className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-white/80 hover:text-white lg:mt-10"
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
                      : 'border-white/12 bg-white/[0.04] text-white/82 hover:border-white/28'
                  }`}
                >
                  {option.label}
                  {option.key === 'ALL' ? '' : ` (${countryRegionCounts[option.key]})`}
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12">
            {filteredCountryShowcase.map((country) => (
              <Link
                key={country.name}
                to={`/country-products?country=${encodeURIComponent(country.name)}`}
                className="group flex flex-col items-center rounded border border-white/8 bg-white/[0.03] px-2 py-3 text-center transition-colors hover:border-white/24"
              >
                <img
                  src={`https://flagcdn.com/w80/${country.flag}.png`}
                  alt={`${country.name} flag`}
                  className="h-11 w-11 rounded-full border border-white/18 object-cover"
                  loading="lazy"
                />
                <p className="mt-2 text-sm font-medium text-white/88">{country.name}</p>
              </Link>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/country-products"
              className="inline-flex items-center gap-2 border border-white/14 bg-white/[0.05] px-6 py-3 text-lg text-white/86 hover:border-white/35 hover:text-white"
            >
              Show All 54 Countries
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* RTW / FTB / CTW HERO-HEIGHT SPLIT */}
      <section className="space-y-0">
        <div className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 md:grid-cols-12`}>
          <img src={`${ASSET_BASE}/rw_full.jpg`} alt="editorial ready" className="h-full w-full object-cover md:col-span-8" data-kimi-anim="zoom-in" />
          <div className="flex items-center bg-[#111] px-8 py-12 text-white md:col-span-4" data-kimi-anim="sidebar-right">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.92] lg:text-6xl">STANDARDIZED AFRICAN MADE TO WEAR</h3>
          </div>
        </div>
        <div className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 md:grid-cols-12`}>
          <div className="flex items-center bg-[#1a1a1a] px-8 py-12 text-white md:col-span-4" data-kimi-anim="sidebar-left">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.92] lg:text-6xl">AFRICAN FABRICS ALL ACROSS ALL EDGES OF AFRICA</h3>
          </div>
          <img src={`${ASSET_BASE}/fabrics_full.jpg`} alt="editorial fabric" className="h-full w-full object-cover md:col-span-8" data-kimi-anim="zoom-in" />
        </div>
        <div className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 md:grid-cols-12`}>
          <img src={`${ASSET_BASE}/custom_full.jpg`} alt="editorial custom" className="h-full w-full object-cover md:col-span-8" data-kimi-anim="zoom-in" />
          <div className="flex items-center bg-[#111] px-8 py-12 text-white md:col-span-4" data-kimi-anim="sidebar-right">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.92] lg:text-6xl">EVERY STITCH SEWN BY AN AFRICAN DESIGNER</h3>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-12" data-kimi-anim="fade-up">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <h2 className="font-['Oswald'] text-3xl font-bold uppercase">HOW IT WORKS</h2>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-3">
            {HOW_IT_WORKS.map(([title, sub]) => (
              <article key={title} className="border border-black/10 bg-[#faf9f5] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</p>
                <p className="mt-1 text-xs text-black/55">{sub}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED RTW + CTW (full-width, no gaps) */}
      <section className="space-y-0">
        <div className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 gap-0 md:grid-cols-2`}>
          {FEATURED_RTW.map((card) => (
            <Link key={card.id} to={card.href} className="group relative overflow-hidden" data-kimi-anim="zoom-in">
              <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute right-6 top-6 max-w-[46%] text-right text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Ready To Wear</p>
                <p className="mt-2 font-['Oswald'] text-4xl font-bold uppercase leading-[0.95]">Featured Ready To Wear</p>
                <p className="mt-2 text-xs text-white/75">{card.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
        <div className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 gap-0 md:grid-cols-2`}>
          {FEATURED_CTW.map((card) => (
            <Link key={card.id} to={card.href} className="group relative overflow-hidden" data-kimi-anim="zoom-in">
              <img src={card.image} alt={card.title} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute right-6 top-6 max-w-[46%] text-right text-white">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Custom To Wear</p>
                <p className="mt-2 font-['Oswald'] text-4xl font-bold uppercase leading-[0.95]">Featured Custom To Wear</p>
                <p className="mt-2 text-xs text-white/75">{card.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FRESH DROPS */}
      <section className="bg-[#f5f5f3] py-12" data-kimi-anim="fade-up">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="font-['Oswald'] text-6xl font-bold uppercase leading-none">FRESH DROPS</h2>
              <p className="mt-3 text-base text-black/65">New arrivals from the most talented designers across the continent.</p>
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
            {FRESH_DROPS.map((drop) => (
              <article key={drop.id} className="min-w-[260px] flex-1 overflow-hidden border border-black/10 bg-white md:min-w-[calc((100%-48px)/4)]">
                <div className="relative">
                  <img src={drop.image} alt={drop.name} className="h-[52vh] w-full object-cover" />
                  <span className="absolute left-4 top-4 bg-[#e66045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white">
                    NEW
                  </span>
                </div>
                <div className="p-4">
                  <p className="text-xl font-semibold">{drop.name}</p>
                  <p className="mt-1 text-sm text-black/60">{drop.brand}</p>
                  <p className="mt-2 text-2xl font-semibold text-[#e66045]">{drop.price}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* SPOTLIGHT */}
      <section className={`grid ${HERO_HEIGHT_CLASS} grid-cols-1 bg-[#101010] md:grid-cols-12`}>
        <img src={`${ASSET_BASE}/designer_spotlight.jpg`} alt="designer spotlight" className="h-full w-full object-cover md:col-span-8" data-kimi-anim="zoom-in" />
        <div className="flex items-center px-8 py-12 text-white md:col-span-4" data-kimi-anim="sidebar-right">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Designer spotlight</p>
            <h2 className="mt-2 font-['Oswald'] text-5xl font-bold uppercase leading-[0.95]">MEET DESIGNERS ACROSS AFRICA</h2>
            <p className="mt-3 text-sm text-white/70">Craft stories from Lagos to Dakar, stitched with heritage and modern precision.</p>
          </div>
        </div>
      </section>

      {/* ROOTED IN CULTURE */}
      <section className={`relative ${HERO_HEIGHT_CLASS}`} data-kimi-anim="fade-up">
        <img src={`${ASSET_BASE}/heritage_story.jpg`} alt="heritage" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/42" />
        <div className="relative flex h-full flex-col justify-between px-8 py-10 text-white">
          <div className="self-end text-right">
            <h2 className="font-['Oswald'] text-6xl font-bold uppercase leading-[0.92]">ROOTED IN CULTURE.</h2>
            <p className="mt-4 max-w-xl text-base text-white/80">
              The world is yet to experience Africa&apos;s fashion. We&apos;re building the bridge connecting heritage craft to modern wardrobes everywhere.
            </p>
          </div>
          <div className="flex items-end gap-10 self-start">
            <div>
              <p className="font-['Oswald'] text-7xl font-bold leading-none">120+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Countries</p>
            </div>
            <div>
              <p className="font-['Oswald'] text-7xl font-bold leading-none">50K+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Designers</p>
            </div>
            <div>
              <p className="font-['Oswald'] text-7xl font-bold leading-none">1M+</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Fabrics</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST + NEWSLETTER */}
      <section className="bg-white py-10" data-kimi-anim="fade-up">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {trust.map((item) => (
              <article key={item.label} className="border border-black/10 bg-[#faf9f5] p-4">
                <div className="flex items-center gap-2">
                  <item.Icon className="h-4 w-4" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{item.label}</p>
                </div>
                <p className="mt-1 text-xs text-black/55">{item.sub}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h3 className="font-['Oswald'] text-4xl font-bold uppercase">JOIN THE MOVEMENT.</h3>
              <p className="mt-2 text-sm text-black/60">Subscribe for new arrivals and stories from the continent.</p>
            </div>
            <form className="flex gap-2">
              <input className="h-10 border border-black/20 px-3 text-sm outline-none" placeholder="Enter email" />
              <button className="h-10 bg-[#e66045] px-4 text-xs font-semibold uppercase tracking-[0.12em] text-white">Subscribe</button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}

