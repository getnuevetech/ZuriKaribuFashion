import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Truck, RefreshCw, BadgeCheck } from 'lucide-react';
import { africanCountries } from '../data/africanCountries';

const categoryCards = [
  { label: 'READY TO WEAR', image: '/rw_product1.jpg', to: '/ready-to-wear' },
  { label: 'CUSTOM TO WEAR', image: '/custom_product1.jpg', to: '/custom-to-wear' },
  { label: 'FABRICS TO BUY', image: '/fabric_product1.jpg', to: '/fabrics' },
];

const featuredCountryIds = ['nigeria', 'ghana', 'kenya', 'south-africa', 'egypt', 'senegal'];
const featuredCountries = africanCountries.filter((country) => featuredCountryIds.includes(country.id));

const freshDrops = [
  { id: '1', image: '/product1.jpg', label: 'BROWN ADIRE SET' },
  { id: '2', image: '/product2.jpg', label: 'GREEN PRINT DRESS' },
  { id: '3', image: '/product3.jpg', label: 'MIDNIGHT KAFTAN' },
  { id: '4', image: '/product4.jpg', label: 'GOLDEN WRAP' },
];

const confidenceItems = [
  { icon: Truck, title: 'FAST DELIVERY' },
  { icon: ShieldCheck, title: 'SECURE CHECKOUT' },
  { icon: RefreshCw, title: 'EASY RETURNS' },
  { icon: BadgeCheck, title: 'AUTHENTIC QUALITY' },
];

export default function HomeStaticPage() {
  return (
    <div className="min-h-screen bg-[#e6e6e6] py-3 md:py-8">
      <div className="mx-auto w-full max-w-[440px] overflow-hidden border border-black/5 bg-[var(--bg-primary)] shadow-sm">
        {/* Hero */}
        <section className="grid grid-cols-2">
          <img src="/hero_model.jpg" alt="ZuriKaribu hero" className="h-[170px] w-full object-cover" />
          <div className="flex h-[170px] flex-col justify-between p-3">
            <div>
              <span className="font-display text-sm font-bold tracking-[0.08em]">
                <span className="text-[var(--text-primary)]">ZURI</span>
                <span className="text-[var(--accent)]">KARIBU</span>
              </span>
              <p className="mt-2 text-[10px] leading-4 text-[var(--text-secondary)]">
                Made by Africans. Worn by the world.
              </p>
            </div>
            <div className="space-y-1.5">
              <Link to="/ready-to-wear" className="block border border-[var(--border)] px-2 py-1 text-[9px] font-semibold">
                READY TO WEAR
              </Link>
              <Link to="/custom-to-wear" className="block border border-[var(--border)] px-2 py-1 text-[9px] font-semibold">
                CUSTOM TO WEAR
              </Link>
              <Link to="/fabrics" className="block border border-[var(--border)] px-2 py-1 text-[9px] font-semibold">
                FABRICS TO BUY
              </Link>
            </div>
          </div>
        </section>

        {/* Shop by */}
        <section className="px-3 py-4">
          <h2 className="headline-lg text-sm">SHOP BY</h2>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {categoryCards.map((card) => (
              <Link key={card.label} to={card.to} className="group">
                <div className="relative h-[116px] overflow-hidden border border-[var(--border)]">
                  <img src={card.image} alt={card.label} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                  <p className="absolute bottom-1 left-1 right-1 text-[8px] font-bold leading-tight text-white">{card.label}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Shop by country */}
        <section className="border-t border-[var(--border)] px-3 py-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="headline-lg text-[11px]">SHOP BY COUNTRY</h3>
            <Link to="/countries" className="text-[9px] font-semibold text-[var(--text-secondary)] hover:text-[var(--accent)]">
              VIEW ALL 54
            </Link>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {featuredCountries.map((country) => (
              <Link key={country.id} to={`/country/${country.id}`} className="flex flex-col items-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--bg-secondary)] text-xs">
                  {country.flag}
                </span>
                <span className="mt-1 line-clamp-1 text-center text-[8px] text-[var(--text-muted)]">{country.name}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Category banners */}
        <section className="space-y-0.5">
          <Link to="/ready-to-wear" className="relative block h-[145px] overflow-hidden">
            <img src="/rw_full.jpg" alt="Ready to wear" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute right-3 top-3 max-w-[130px] text-right">
              <p className="text-[9px] font-semibold tracking-[0.08em] text-white/85">READY TO WEAR</p>
              <p className="mt-1 text-[11px] font-bold leading-3 text-white">STANDARDIZED AFRICAN ATTIRE MADE TO BUY.</p>
            </div>
          </Link>

          <Link to="/fabrics" className="relative block h-[145px] overflow-hidden">
            <img src="/fabrics_full.jpg" alt="Fabrics to buy" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute left-3 bottom-3 max-w-[130px]">
              <p className="text-[9px] font-semibold tracking-[0.08em] text-white/85">FABRICS TO BUY</p>
              <p className="mt-1 text-[11px] font-bold leading-3 text-white">AFRICA'S FINEST FABRICS ACROSS ALL REGIONS OF AFRICA.</p>
            </div>
          </Link>

          <Link to="/custom-to-wear" className="relative block h-[145px] overflow-hidden">
            <img src="/custom_full.jpg" alt="Custom to wear" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute right-3 top-3 max-w-[130px] text-right">
              <p className="text-[9px] font-semibold tracking-[0.08em] text-white/85">CUSTOM TO WEAR</p>
              <p className="mt-1 text-[11px] font-bold leading-3 text-white">EVERY STITCH SEWN BY AN AFRICAN DESIGNER.</p>
            </div>
          </Link>
        </section>

        {/* How it works */}
        <section className="px-3 py-4">
          <h3 className="headline-lg text-sm">HOW IT WORKS</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {['CHOOSE CATEGORY', 'PICK YOUR STYLE', 'PLACE ORDER', 'GET DELIVERED'].map((step) => (
              <div key={step} className="border border-[var(--border)] bg-[var(--bg-secondary)] p-2">
                <p className="text-[9px] font-semibold text-[var(--text-primary)]">{step}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Featured two-up */}
        <section className="grid grid-cols-2 gap-0.5">
          <img src="/featured_custom_left.jpg" alt="Featured custom left" className="h-[130px] w-full object-cover" />
          <img src="/featured_custom_right.jpg" alt="Featured custom right" className="h-[130px] w-full object-cover" />
          <img src="/featured_rw_left.jpg" alt="Featured ready left" className="h-[130px] w-full object-cover" />
          <img src="/featured_rw_right.jpg" alt="Featured ready right" className="h-[130px] w-full object-cover" />
        </section>

        {/* Fresh drops */}
        <section className="px-3 py-4">
          <h3 className="headline-lg text-sm">FRESH DROPS</h3>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {freshDrops.map((item) => (
              <Link key={item.id} to={`/product/${item.id}`}>
                <div className="overflow-hidden border border-[var(--border)]">
                  <img src={item.image} alt={item.label} className="h-[72px] w-full object-cover" />
                </div>
                <p className="mt-1 line-clamp-1 text-[8px] text-[var(--text-muted)]">{item.label}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Culture strips */}
        <section className="space-y-0.5">
          <div className="relative h-[100px] overflow-hidden">
            <img src="/designer_spotlight.jpg" alt="Designer spotlight" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <p className="absolute left-3 bottom-3 text-[11px] font-bold leading-3 text-white">MEET DESIGNERS ACROSS AFRICA.</p>
          </div>
          <div className="relative h-[95px] overflow-hidden">
            <img src="/heritage_story.jpg" alt="Heritage story" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30" />
            <p className="absolute right-3 top-3 text-right text-[11px] font-bold leading-3 text-white">ROOTED IN CULTURE.</p>
          </div>
        </section>

        {/* Shop with confidence */}
        <section className="px-3 py-4">
          <h3 className="headline-lg text-[11px]">SHOP WITH CONFIDENCE</h3>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {confidenceItems.map((item) => (
              <div key={item.title} className="flex items-center gap-1.5 border border-[var(--border)] bg-[var(--bg-secondary)] p-2">
                <item.icon className="h-3.5 w-3.5 text-[var(--accent)]" />
                <p className="text-[8px] font-semibold text-[var(--text-primary)]">{item.title}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Newsletter */}
        <section className="border-t border-[var(--border)] px-3 py-5">
          <h3 className="headline-lg text-sm leading-4">JOIN THE MOVEMENT.</h3>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="email"
              placeholder="Email address"
              className="h-8 min-h-0 flex-1 border border-[var(--border)] bg-[var(--bg-secondary)] px-2 text-[10px]"
            />
            <button className="inline-flex h-8 min-h-0 items-center gap-1 bg-[var(--accent)] px-2 text-[9px] font-semibold uppercase text-white">
              Subscribe
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-4">
          <div className="grid grid-cols-3 gap-3 text-[8px] text-[var(--text-muted)]">
            <div>
              <p className="mb-1 font-semibold text-[var(--text-primary)]">SHOP</p>
              <p>Ready To Wear</p>
              <p>Custom To Wear</p>
              <p>Fabrics To Buy</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[var(--text-primary)]">COMPANY</p>
              <p>About Us</p>
              <p>Designers</p>
              <p>Contact</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[var(--text-primary)]">SUPPORT</p>
              <p>FAQs</p>
              <p>Shipping</p>
              <p>Returns</p>
            </div>
          </div>
          <p className="mt-4 border-t border-[var(--border)] pt-2 text-[8px] text-[var(--text-muted)]">
            © 2026 ZuriKaribu. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
