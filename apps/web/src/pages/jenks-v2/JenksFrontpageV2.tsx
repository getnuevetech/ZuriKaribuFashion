import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Headphones, RefreshCw, ShieldCheck, Truck } from 'lucide-react';
import { Link } from 'react-router-dom';

type HeroSlide = {
  id: string;
  image: string;
  titlePrimary: string;
  titleAccent: string;
  body: string;
  sub: string;
  ctaText: string;
  ctaHref: string;
  quickLinks: Array<{ label: string; href: string }>;
};

type ProductCard = {
  id: string;
  name: string;
  price: string;
  country: string;
  image: string;
  href: string;
};

const ASSET_BASE = 'https://african-fashion-zurikaribu.vercel.app';

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'hero-1',
    image: `${ASSET_BASE}/hero_model.jpg`,
    titlePrimary: 'WEAR',
    titleAccent: 'THE STORY OF AFRICA',
    body: 'Curated fashion from top designers and textile houses.',
    sub: 'Ready-to-wear, fabrics, and custom looks in one destination.',
    ctaText: 'SHOP NOW',
    ctaHref: '/ready-to-wear',
    quickLinks: [
      { label: 'READY TO WEAR', href: '/ready-to-wear' },
      { label: 'CUSTOM', href: '/custom' },
      { label: 'FABRICS', href: '/fabrics' },
    ],
  },
  {
    id: 'hero-2',
    image: `${ASSET_BASE}/rw_full.jpg`,
    titlePrimary: 'DISCOVER',
    titleAccent: 'AFRICAN COUTURE',
    body: 'Modern silhouettes rooted in culture and craftsmanship.',
    sub: 'Handpicked pieces from trusted sellers and designers.',
    ctaText: 'SHOP NOW',
    ctaHref: '/ready-to-wear',
    quickLinks: [
      { label: 'READY TO WEAR', href: '/ready-to-wear' },
      { label: 'CUSTOM', href: '/custom' },
      { label: 'FABRICS', href: '/fabrics' },
    ],
  },
  {
    id: 'hero-3',
    image: `${ASSET_BASE}/custom_full.jpg`,
    titlePrimary: 'MADE',
    titleAccent: 'FOR YOUR FIT',
    body: 'Custom-to-wear looks created by expert African tailors.',
    sub: 'From consultation to delivery with premium quality control.',
    ctaText: 'START CUSTOM',
    ctaHref: '/custom',
    quickLinks: [
      { label: 'READY TO WEAR', href: '/ready-to-wear' },
      { label: 'CUSTOM', href: '/custom' },
      { label: 'FABRICS', href: '/fabrics' },
    ],
  },
];

const TRUST_BADGES = [
  { id: 'authentic', title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers.', Icon: ShieldCheck },
  { id: 'shipping', title: 'Global Shipping', subtitle: 'Reliable delivery worldwide.', Icon: Truck },
  { id: 'returns', title: 'Easy Returns', subtitle: 'Simple returns on eligible orders.', Icon: RefreshCw },
  { id: 'support', title: '24/7 Support', subtitle: 'Chat and ticket support anytime.', Icon: Headphones },
];

const FEATURED_RTW: ProductCard[] = [
  { id: 'rtw-1', name: 'Bridal Traditional', price: '$2,285', country: 'Ghana', image: `${ASSET_BASE}/product4.jpg`, href: '/ready-to-wear' },
  { id: 'rtw-2', name: 'Afigan Set', price: '$1,642', country: 'Ghana', image: `${ASSET_BASE}/product5.jpg`, href: '/ready-to-wear' },
  { id: 'rtw-3', name: 'Kakaki Africa', price: '$1,507', country: 'Ghana', image: `${ASSET_BASE}/product6.jpg`, href: '/ready-to-wear' },
  { id: 'rtw-4', name: 'Signature Ankara', price: '$1,280', country: 'Nigeria', image: `${ASSET_BASE}/rw_full.jpg`, href: '/ready-to-wear' },
];

const FEATURED_FABRICS: ProductCard[] = [
  { id: 'fab-1', name: 'Ankara Mummy', price: '$2,142', country: 'Nigeria', image: `${ASSET_BASE}/fabrics_full.jpg`, href: '/fabrics' },
  { id: 'fab-2', name: 'Dancing Queen Adire', price: '$785', country: 'Nigeria', image: `${ASSET_BASE}/featured_rw_left.jpg`, href: '/fabrics' },
  { id: 'fab-3', name: 'Ankara Party', price: '$928', country: 'Nigeria', image: `${ASSET_BASE}/featured_rw_right.jpg`, href: '/fabrics' },
  { id: 'fab-4', name: 'Awon Da', price: '$1,428', country: 'Nigeria', image: `${ASSET_BASE}/featured_custom_left.jpg`, href: '/fabrics' },
];

const FEATURED_CUSTOM: ProductCard[] = [
  { id: 'ctw-1', name: 'Exclusive Gorgeous', price: '$1,428', country: 'Ghana', image: `${ASSET_BASE}/product1.jpg`, href: '/custom' },
  { id: 'ctw-2', name: 'My Skkentele', price: '$714', country: 'Ghana', image: `${ASSET_BASE}/product2.jpg`, href: '/custom' },
  { id: 'ctw-3', name: 'Ankara Gbasibe', price: '$857', country: 'Ghana', image: `${ASSET_BASE}/product3.jpg`, href: '/custom' },
  { id: 'ctw-4', name: 'Custom Heritage', price: '$1,020', country: 'Kenya', image: `${ASSET_BASE}/custom_full.jpg`, href: '/custom' },
];

function ProductRow({ title, products }: { title: string; products: ProductCard[] }) {
  return (
    <section className="bg-white py-10 lg:py-14">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
        <div className="mb-6 flex items-center justify-between">
          <h3 className="font-['Oswald'] text-3xl font-bold uppercase tracking-[0.01em]">{title}</h3>
          <Link to="/shop" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.14em] text-black/70 hover:text-black">
            View all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {products.map((product) => (
            <Link key={product.id} to={product.href} className="group block">
              <div className="relative aspect-[3/4] overflow-hidden border border-black/10 bg-[#f8f6f1]">
                <img src={product.image} alt={product.name} className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              </div>
              <p className="mt-2 text-sm font-semibold">{product.name}</p>
              <p className="text-xs text-black/60">{product.country}</p>
              <p className="text-sm font-semibold">{product.price}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function JenksFrontpageV2() {
  const [slideIndex, setSlideIndex] = useState(0);
  const active = useMemo(() => HERO_SLIDES[slideIndex] || HERO_SLIDES[0], [slideIndex]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f6f1] text-[#111111]">
      <section className="relative grid min-h-[88vh] grid-cols-1 lg:grid-cols-12">
        <div className="relative overflow-hidden lg:col-span-7">
          {HERO_SLIDES.map((slide, idx) => (
            <img
              key={slide.id}
              src={slide.image}
              alt={slide.titlePrimary}
              className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] ${
                idx === slideIndex ? 'scale-100 opacity-100' : 'scale-105 opacity-0'
              }`}
            />
          ))}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent lg:hidden" />
        </div>
        <div className="relative flex items-center bg-[#f8f6f1] px-6 py-10 lg:col-span-5 lg:px-12">
          <div className="w-full max-w-[560px] animate-fade-in">
            <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-black/45">Editorial premium</p>
            <h1 className="mt-3 font-['Oswald'] text-[54px] font-bold uppercase leading-[0.9] text-black sm:text-[64px]">
              <span>{active.titlePrimary}</span>
              <span className="ml-[0.22em] text-[#e85a3c]">{active.titleAccent}</span>
            </h1>
            <p className="mt-5 max-w-[46ch] text-[36px] text-black/80">{active.body}</p>
            <p className="mt-3 text-sm text-black/55">{active.sub}</p>
            <div className="mt-6">
              <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-black/45">Shop by category</p>
              <div className="flex flex-wrap gap-2">
                {active.quickLinks.map((link) => (
                  <Link
                    key={link.label}
                    to={link.href}
                    className="inline-flex items-center border border-black/10 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] text-black/80 transition-colors hover:border-black/30 hover:text-black"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link
                to={active.ctaHref}
                className="inline-flex items-center gap-2 border border-black bg-[#e85a3c] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
              >
                {active.ctaText}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-black/40">Explore designers</p>
            </div>
          </div>
          <div className="absolute bottom-8 right-8 hidden items-center gap-2 lg:flex">
            <button
              onClick={() => setSlideIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
              className="inline-flex h-9 w-9 items-center justify-center border border-black/20 text-black/70 hover:border-black/40 hover:text-black"
              aria-label="Previous hero"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setSlideIndex((prev) => (prev + 1) % HERO_SLIDES.length)}
              className="inline-flex h-9 w-9 items-center justify-center border border-black/20 text-black/70 hover:border-black/40 hover:text-black"
              aria-label="Next hero"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      <section className="border-y border-black/10 bg-white py-6">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST_BADGES.map((badge) => (
              <div key={badge.id} className="rounded border border-black/10 px-4 py-3">
                <div className="flex items-center gap-2">
                  <badge.Icon className="h-4 w-4 text-[#111111]" />
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">{badge.title}</p>
                </div>
                <p className="mt-1 text-xs text-black/55">{badge.subtitle}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#f6f3ee] py-10 lg:py-14">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Link to="/ready-to-wear" className="group relative block overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/rw_full.jpg`} alt="Ready to wear" className="h-[340px] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/65">Ready to Wear</p>
                <p className="mt-2 font-['Oswald'] text-3xl uppercase">Made to standard sizes</p>
              </div>
            </Link>
            <Link to="/fabrics" className="group relative block overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/fabrics_full.jpg`} alt="Fabrics" className="h-[340px] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/65">Fabrics to Buy</p>
                <p className="mt-2 font-['Oswald'] text-3xl uppercase">Authentic textiles</p>
              </div>
            </Link>
            <Link to="/custom" className="group relative block overflow-hidden border border-black/10">
              <img src={`${ASSET_BASE}/custom_full.jpg`} alt="Custom to wear" className="h-[340px] w-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 p-5 text-white">
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/65">Custom to Wear</p>
                <p className="mt-2 font-['Oswald'] text-3xl uppercase">Every stitch by designers</p>
              </div>
            </Link>
          </div>
        </div>
      </section>

      <ProductRow title="Featured Ready to Wear" products={FEATURED_RTW} />
      <ProductRow title="Featured Fabrics" products={FEATURED_FABRICS} />
      <ProductRow title="Featured Custom Designs" products={FEATURED_CUSTOM} />

      <section className="bg-[#0b0b0c] py-16">
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/55">Designer spotlight</p>
              <h2 className="mt-2 font-['Oswald'] text-5xl font-bold uppercase leading-[0.95] text-white">Asante Designs</h2>
              <p className="mt-4 max-w-[56ch] text-sm leading-relaxed text-white/75">
                When we sew, it is from the heart. Every stitch tells a story rooted in craft, heritage, and modern African elegance.
              </p>
              <Link to="/custom" className="mt-6 inline-flex items-center gap-2 border border-white bg-white px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-black">
                Meet designers
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative overflow-hidden border border-white/20">
              <img src={`${ASSET_BASE}/designer_spotlight.jpg`} alt="Designer spotlight" className="h-[420px] w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

