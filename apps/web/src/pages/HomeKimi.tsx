import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Gem,
  Globe,
  Headphones,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Truck,
} from 'lucide-react';
import {
  AFRICAN_COUNTRIES,
  AFRICAN_REGION_OPTIONS,
  type AfricanRegion,
} from '../data/africanCountries';

type ShopTab = 'category' | 'country' | 'occasion' | 'price';

const asFlag = (code: string) =>
  String(code || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2)
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));

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

const trustBadges = [
  { icon: ShieldCheck, title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers' },
  { icon: Truck, title: 'Global Shipping', subtitle: 'Reliable delivery worldwide' },
  { icon: RefreshCw, title: 'Easy Returns', subtitle: 'Simple returns on eligible orders' },
  { icon: Headphones, title: '24/7 Support', subtitle: 'Chat and ticket support anytime' },
];

export default function HomeKimi() {
  const [tab, setTab] = useState<ShopTab>('category');
  const [region, setRegion] = useState<'ALL' | AfricanRegion>('ALL');
  const filteredCountries = useMemo(
    () =>
      AFRICAN_COUNTRIES.filter((country) => (region === 'ALL' ? true : country.region === region)).slice(0, 12),
    [region]
  );

  return (
    <div className="min-h-screen bg-[#f8f6f1] text-[#1a1a1a]">
      <section className="grid min-h-[86vh] grid-cols-1 lg:grid-cols-12">
        <div className="relative lg:col-span-7">
          <img src="/kimi/hero_model.jpg" alt="Kimi hero" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/15 to-transparent lg:hidden" />
        </div>
        <div className="flex items-center bg-[#f8f6f1] px-6 py-10 lg:col-span-5 lg:px-12">
          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b665c]">Editorial premium</p>
            <h1 className="mt-3 font-['Oswald'] text-5xl font-bold leading-[0.9] md:text-6xl">
              ZURI <span className="text-[#e85a3c]">KARIBU</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-base text-[#5b564d]">
              Made by Africans. Worn by the world. Explore ready-to-wear, custom design, and fabrics in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/shop"
                className="inline-flex items-center gap-2 border border-black bg-black px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white"
              >
                Shop now
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
          {trustBadges.map((badge) => (
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
            {categories.map((item) => (
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

