import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Calendar, Globe, Headphones, RefreshCw, ShieldCheck, ShoppingBag, Tag, Truck } from 'lucide-react';
import { AFRICAN_COUNTRIES, AFRICAN_REGION_OPTIONS, type AfricanRegion } from '../data/africanCountries';

type ShopTab = 'category' | 'country' | 'occasion' | 'price';

const HERO_IMAGE =
  'https://images.unsplash.com/photo-1594736797933-d0d9e022f7f1?auto=format&fit=crop&w=1600&q=80';

const KIMI_FEATURE_IMAGES = {
  readyToWear:
    'https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1200&q=80',
  customToWear:
    'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?auto=format&fit=crop&w=1200&q=80',
  fabrics:
    'https://images.unsplash.com/photo-1582719508461-905c673771fd?auto=format&fit=crop&w=1200&q=80',
  freshDrops:
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=80',
  spotlight:
    'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
};

const HERO_COPY = {
  eyebrow: 'Editorial premium',
  title: 'ZURI KARIBU',
  subtitle: 'Made by Africans. Worn by the world.',
  ctaText: 'Shop now',
  ctaLink: '/shop',
};

const TRUST_BADGES = [
  { icon: ShieldCheck, title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers' },
  { icon: Truck, title: 'Global Shipping', subtitle: 'Reliable delivery worldwide' },
  { icon: RefreshCw, title: 'Easy Returns', subtitle: 'Simple returns on eligible orders' },
  { icon: Headphones, title: '24/7 Support', subtitle: 'Chat and ticket support anytime' },
];

const SHOP_BY_CATEGORIES = [
  { label: 'Ready to Wear', href: '/ready-to-wear', image: KIMI_FEATURE_IMAGES.readyToWear, count: '480+' },
  { label: 'Custom to Wear', href: '/custom', image: KIMI_FEATURE_IMAGES.customToWear, count: '220+' },
  { label: 'Fabrics', href: '/fabrics', image: KIMI_FEATURE_IMAGES.fabrics, count: '640+' },
  { label: 'Fresh Drops', href: '/shop', image: KIMI_FEATURE_IMAGES.freshDrops, count: '80+' },
];

const OCCASION_ITEMS = [
  { label: 'Wedding', href: '/shop' },
  { label: 'Casual', href: '/shop' },
  { label: 'Formal', href: '/shop' },
  { label: 'Festival', href: '/shop' },
];

const PRICE_ITEMS = [
  { label: 'Under $100', href: '/shop' },
  { label: '$100 - $300', href: '/shop' },
  { label: '$300 - $500', href: '/shop' },
  { label: '$500+', href: '/shop' },
];

const STATIC_PRODUCTS = {
  rtw: [
    { id: 'rtw-1', name: 'Ankara Midi Dress', price: '$240', country: 'Nigeria', image: KIMI_FEATURE_IMAGES.readyToWear, href: '/ready-to-wear' },
    { id: 'rtw-2', name: 'Kente Street Set', price: '$280', country: 'Ghana', image: KIMI_FEATURE_IMAGES.freshDrops, href: '/ready-to-wear' },
    { id: 'rtw-3', name: 'Boubou Luxe', price: '$320', country: 'Senegal', image: KIMI_FEATURE_IMAGES.customToWear, href: '/ready-to-wear' },
    { id: 'rtw-4', name: 'Aso Oke Signature', price: '$360', country: 'Nigeria', image: KIMI_FEATURE_IMAGES.spotlight, href: '/ready-to-wear' },
  ],
  fabrics: [
    { id: 'fab-1', name: 'Premium Ankara Roll', price: '$90', country: 'Nigeria', image: KIMI_FEATURE_IMAGES.fabrics, href: '/fabrics' },
    { id: 'fab-2', name: 'Kente Woven Cloth', price: '$120', country: 'Ghana', image: KIMI_FEATURE_IMAGES.readyToWear, href: '/fabrics' },
    { id: 'fab-3', name: 'Adire Indigo Print', price: '$75', country: 'Nigeria', image: KIMI_FEATURE_IMAGES.customToWear, href: '/fabrics' },
    { id: 'fab-4', name: 'Bogolan Heritage', price: '$110', country: 'Mali', image: KIMI_FEATURE_IMAGES.freshDrops, href: '/fabrics' },
  ],
  custom: [
    { id: 'ctw-1', name: 'Tailored Kaftan Experience', price: 'From $260', country: 'Morocco', image: KIMI_FEATURE_IMAGES.customToWear, href: '/custom' },
    { id: 'ctw-2', name: 'Bridal Couture Edit', price: 'From $490', country: 'South Africa', image: KIMI_FEATURE_IMAGES.spotlight, href: '/custom' },
    { id: 'ctw-3', name: 'Diaspora Signature Fit', price: 'From $300', country: 'Kenya', image: KIMI_FEATURE_IMAGES.readyToWear, href: '/custom' },
    { id: 'ctw-4', name: 'Festival Bespoke Look', price: 'From $340', country: 'Cote d’Ivoire', image: KIMI_FEATURE_IMAGES.freshDrops, href: '/custom' },
  ],
};

const DESIGNERS = [
  { id: 'd-1', name: 'Amina Atelier', country: 'Nigeria', image: KIMI_FEATURE_IMAGES.spotlight },
  { id: 'd-2', name: 'Kente House', country: 'Ghana', image: KIMI_FEATURE_IMAGES.readyToWear },
  { id: 'd-3', name: 'Sahara Tailoring', country: 'Morocco', image: KIMI_FEATURE_IMAGES.customToWear },
];

const asFlag = (code: string) =>
  String(code || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

function ProductStrip({ title, rows }: { title: string; rows: Array<{ id: string; name: string; price: string; country: string; image: string; href: string }> }) {
  return (
    <section className="mx-auto w-full max-w-[1400px] px-4 py-8 lg:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-['Oswald'] text-3xl font-bold">{title}</h3>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {rows.map((row) => (
          <Link key={row.id} to={row.href} className="group block">
            <div className="relative aspect-[3/4] overflow-hidden border border-black/15 bg-white">
              <img
                src={row.image}
                alt={row.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
            <p className="mt-2 line-clamp-2 text-sm font-semibold">{row.name}</p>
            <p className="text-xs text-black/60">{row.country}</p>
            <p className="text-sm font-semibold">{row.price}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function HomeKimi() {
  const [tab, setTab] = useState<ShopTab>('category');
  const [region, setRegion] = useState<'ALL' | AfricanRegion>('ALL');

  const filteredCountries = useMemo(
    () => AFRICAN_COUNTRIES.filter((country) => (region === 'ALL' ? true : country.region === region)).slice(0, 12),
    [region]
  );

  return (
    <div className="min-h-screen bg-[#f8f6f1] text-[#1a1a1a]">
      <section className="grid min-h-[86vh] grid-cols-1 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <img src={HERO_IMAGE} alt="Kimi hero" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent lg:hidden" />
        </div>
        <div className="flex items-center bg-[#f8f6f1] px-6 py-10 lg:col-span-5 lg:px-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665c]">{HERO_COPY.eyebrow}</p>
            <h1 className="mt-3 font-['Oswald'] text-5xl font-bold leading-[0.9] md:text-6xl">
              {HERO_COPY.title.replace(/KARIBU/i, '').trim()} <span className="text-[#e85a3c]">KARIBU</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-base text-[#5b564d]">{HERO_COPY.subtitle}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to={HERO_COPY.ctaLink}
                className="inline-flex items-center gap-2 border border-black bg-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                {HERO_COPY.ctaText}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/ready-to-wear" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                Ready to Wear
              </Link>
              <Link to="/custom" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                Custom
              </Link>
              <Link to="/fabrics" className="border border-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em]">
                Fabrics
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white py-6">
        <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {TRUST_BADGES.map((badge) => (
            <div key={badge.title} className="flex items-center gap-3 rounded border border-black/10 px-4 py-3">
              <badge.icon className="h-4 w-4 text-[#e85a3c]" />
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6b665c]">Discover</p>
          <h2 className="mt-2 font-['Oswald'] text-4xl font-bold">Shop by</h2>
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
            {SHOP_BY_CATEGORIES.map((item) => (
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
                  <p className="text-[10px] text-black/50">Explore</p>
                </Link>
              ))}
            </div>
          </>
        ) : null}

        {tab === 'occasion' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {OCCASION_ITEMS.map((item) => (
              <Link key={item.label} to={item.href} className="border bg-white p-4 text-center text-sm font-medium hover:border-[#e85a3c]">
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}

        {tab === 'price' ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {PRICE_ITEMS.map((item) => (
              <Link key={item.label} to={item.href} className="border bg-white p-4 text-center text-sm font-medium hover:border-[#e85a3c]">
                {item.label}
              </Link>
            ))}
          </div>
        ) : null}
      </section>

      <ProductStrip title="Featured Ready to Wear" rows={STATIC_PRODUCTS.rtw} />
      <ProductStrip title="Featured Fabrics" rows={STATIC_PRODUCTS.fabrics} />
      <ProductStrip title="Featured Custom Designs" rows={STATIC_PRODUCTS.custom} />

      <section className="mx-auto w-full max-w-[1400px] px-4 pb-10 pt-2 lg:px-8">
        <h3 className="mb-4 font-['Oswald'] text-3xl font-bold">Designer Spotlight</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {DESIGNERS.map((designer) => (
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

      <section className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-6 px-4 pb-20 lg:grid-cols-3 lg:px-8">
        <Link to="/ready-to-wear" className="group relative overflow-hidden border border-black/15">
          <img src={KIMI_FEATURE_IMAGES.readyToWear} alt="Ready to wear feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Ready to Wear</p>
            <p className="mt-2 font-['Oswald'] text-3xl">Standardized fits</p>
          </div>
        </Link>
        <Link to="/fabrics" className="group relative overflow-hidden border border-black/15">
          <img src={KIMI_FEATURE_IMAGES.fabrics} alt="Fabrics feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          <div className="absolute bottom-0 p-5 text-white">
            <p className="text-xs uppercase tracking-[0.2em] text-white/65">Fabrics</p>
            <p className="mt-2 font-['Oswald'] text-3xl">Authentic textiles</p>
          </div>
        </Link>
        <Link to="/custom" className="group relative overflow-hidden border border-black/15">
          <img src={KIMI_FEATURE_IMAGES.customToWear} alt="Custom feature" className="h-[340px] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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

