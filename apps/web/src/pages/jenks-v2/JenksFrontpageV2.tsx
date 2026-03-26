import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Headphones, Menu, RefreshCw, Search, ShieldCheck, ShoppingBag, Sun, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';

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

const COUNTRIES = [
  ['DZ', 'AO', 'BJ', 'BW', 'BF', 'CM', 'CI', 'EG', 'ET', 'GH', 'KE', 'MA'],
  ['MZ', 'NA', 'NG', 'RW', 'SN', 'ZA', 'TZ', 'TN', 'UG', 'ZM', 'ZW', 'SD'],
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

export default function JenksFrontpageV2() {
  const [index, setIndex] = useState(0);
  const active = useMemo(() => HERO[index] || HERO[0], [index]);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((p) => (p + 1) % HERO.length), 7000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="bg-[#f5f3ee] text-[#111]">
      {/* TOP STRIP + TOP NAVIGATION */}
      <div className="sticky top-0 z-50">
        <div className="h-8 bg-black text-[10px] font-semibold uppercase tracking-[0.18em] text-white/85">
          <div className="mx-auto flex h-full w-full max-w-[1700px] items-center justify-center px-4">
            Made by Africans. Worn by the world.
          </div>
        </div>
        <header className="h-14 border-b border-black/10 bg-[#f5f3ee]/95 backdrop-blur">
          <div className="mx-auto flex h-full w-full max-w-[1700px] items-center justify-between px-4 sm:px-6 lg:px-12">
            <div className="flex items-center gap-3 text-black/75">
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Open menu">
                <Menu className="h-4 w-4" />
              </button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5" aria-label="Search">
                <Search className="h-4 w-4" />
              </button>
            </div>
            <p className="font-['Oswald'] text-[34px] font-semibold uppercase leading-none tracking-[0.08em]">
              <span>ZURI</span>
              <span className="text-[#e66045]">KARIBU</span>
            </p>
            <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 md:flex">
              <Link to="/about" className="hover:text-black">About Us</Link>
              <Link to="/contact" className="hover:text-black">Contact Us</Link>
            </div>
            <div className="flex items-center gap-3 text-black/75">
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
      <section className="grid min-h-[106vh] grid-cols-1 lg:grid-cols-12">
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
          <div className="max-w-[560px] animate-fade-in">
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
      <section className="bg-white py-10">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <h2 className="text-center font-['Oswald'] text-4xl font-bold uppercase">SHOP BY</h2>
          <div className="mx-auto mt-2 h-px w-24 bg-black/15" />
          <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
            <Link to="/ready-to-wear" className="group relative overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/featured_rw_left.jpg`} alt="ready to wear" className="h-[62vh] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </Link>
            <Link to="/custom" className="group relative overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/featured_custom_right.jpg`} alt="custom" className="h-[62vh] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </Link>
            <Link to="/fabrics" className="group relative overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/fabrics_full.jpg`} alt="fabrics" className="h-[62vh] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
            </Link>
          </div>
        </div>
      </section>

      {/* SHOP BY COUNTRY */}
      <section className="bg-[#f9f8f4] py-10">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="flex items-end justify-between">
            <h2 className="font-['Oswald'] text-3xl font-bold uppercase">SHOP BY COUNTRY</h2>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/45">54 COUNTRIES</p>
          </div>
          <div className="mt-6 space-y-2 border border-black/10 bg-white p-4">
            {COUNTRIES.map((row, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-6 gap-2 md:grid-cols-12">
                {row.map((code) => (
                  <div key={code} className="border border-black/10 px-2 py-2 text-center text-[10px] font-semibold uppercase">
                    {code}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EDITORIAL STACK */}
      <section className="space-y-0">
        <div className="grid min-h-[78vh] grid-cols-1 md:grid-cols-2">
          <img src={`${ASSET_BASE}/rw_full.jpg`} alt="editorial ready" className="h-full w-full object-cover" />
          <div className="flex items-center bg-[#111] px-8 py-12 text-white">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.95]">STANDARDIZED AFRICAN MADE TO WEAR</h3>
          </div>
        </div>
        <div className="grid min-h-[78vh] grid-cols-1 md:grid-cols-2">
          <div className="flex items-center bg-[#1a1a1a] px-8 py-12 text-white">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.95]">AFRICAN FABRICS ALL ACROSS ALL EDGES OF AFRICA</h3>
          </div>
          <img src={`${ASSET_BASE}/fabrics_full.jpg`} alt="editorial fabric" className="h-full w-full object-cover" />
        </div>
        <div className="grid min-h-[78vh] grid-cols-1 md:grid-cols-2">
          <img src={`${ASSET_BASE}/custom_full.jpg`} alt="editorial custom" className="h-full w-full object-cover" />
          <div className="flex items-center bg-[#111] px-8 py-12 text-white">
            <h3 className="font-['Oswald'] text-5xl font-bold uppercase leading-[0.95]">EVERY STITCH SEWN BY AN AFRICAN DESIGNER</h3>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-white py-12">
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

      {/* FEATURED MOSAIC */}
      <section className="bg-[#f8f6f1] py-10">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[`${ASSET_BASE}/product4.jpg`, `${ASSET_BASE}/featured_custom_left.jpg`, `${ASSET_BASE}/product1.jpg`, `${ASSET_BASE}/featured_rw_right.jpg`].map((src, i) => (
              <div key={src} className={`${i % 3 === 0 ? 'md:col-span-2' : ''} overflow-hidden border border-black/10`}>
                <img src={src} alt="feature" className="h-[46vh] w-full object-cover transition-transform duration-700 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FRESH DROPS */}
      <section className="bg-white py-12">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <h2 className="font-['Oswald'] text-3xl font-bold uppercase">FRESH DROPS</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[`${ASSET_BASE}/product1.jpg`, `${ASSET_BASE}/product2.jpg`, `${ASSET_BASE}/product3.jpg`, `${ASSET_BASE}/product6.jpg`].map((src) => (
              <div key={src} className="overflow-hidden border border-black/10">
                <img src={src} alt="drop" className="h-[38vh] w-full object-cover transition-transform duration-700 hover:scale-105" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SPOTLIGHT */}
      <section className="grid min-h-[76vh] grid-cols-1 md:grid-cols-2 bg-[#101010]">
        <img src={`${ASSET_BASE}/designer_spotlight.jpg`} alt="designer spotlight" className="h-full w-full object-cover" />
        <div className="flex items-center px-8 py-12 text-white">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/65">Designer spotlight</p>
            <h2 className="mt-2 font-['Oswald'] text-5xl font-bold uppercase leading-[0.95]">MEET DESIGNERS ACROSS AFRICA</h2>
          </div>
        </div>
      </section>

      {/* ROOTED IN CULTURE */}
      <section className="relative min-h-[74vh]">
        <img src={`${ASSET_BASE}/heritage_story.jpg`} alt="heritage" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative flex h-full items-end px-8 py-10 text-white">
          <div>
            <h2 className="font-['Oswald'] text-5xl font-bold uppercase">ROOTED IN CULTURE</h2>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">120+ • 50k+ • 1M+</p>
          </div>
        </div>
      </section>

      {/* TRUST + NEWSLETTER */}
      <section className="bg-white py-10">
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

