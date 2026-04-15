import { useState, useEffect } from 'react';
import './styles/index.css';

// Navigation Component
function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { label: 'Ready to Wear', href: '#ready-to-wear' },
    { label: 'Fabrics', href: '#fabrics' },
    { label: 'Custom', href: '#custom' },
  ];

  return (
    <>
      <nav 
        className={`fixed top-0 left-0 right-0 z-[var(--z-sticky)] transition-all duration-300 ${
          scrolled 
            ? 'bg-[var(--color-bg-primary)]/95 backdrop-blur-md shadow-md' 
            : 'bg-transparent'
        }`}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="container mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMenuOpen(true)}
              className="lg:hidden p-2 rounded hover:bg-white/10 transition-colors"
              aria-label="Open menu"
              aria-expanded={menuOpen}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Logo */}
            <a href="/" className="flex items-center">
              <span className={`font-display font-black text-xl lg:text-2xl tracking-wider transition-colors ${
                scrolled ? 'text-[var(--color-text-primary)]' : 'text-white'
              }`}>
                ZURI<span className="text-[var(--color-brand-primary)]">KARIBU</span>
              </span>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors relative group ${
                    scrolled 
                      ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)]' 
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  {link.label}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[var(--color-brand-primary)] transition-all duration-250 group-hover:w-full" />
                </a>
              ))}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <button 
                className={`p-2 rounded transition-colors ${scrolled ? 'hover:bg-[var(--color-bg-tertiary)]' : 'hover:bg-white/10'}`}
                aria-label="Search"
              >
                <svg className={`w-5 h-5 ${scrolled ? 'text-[var(--color-text-primary)]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
              <button 
                className={`p-2 rounded transition-colors ${scrolled ? 'hover:bg-[var(--color-bg-tertiary)]' : 'hover:bg-white/10'}`}
                aria-label="Cart"
              >
                <svg className={`w-5 h-5 ${scrolled ? 'text-[var(--color-text-primary)]' : 'text-white'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-[var(--z-modal)] lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <div className="absolute top-0 left-0 bottom-0 w-[280px] bg-[var(--color-bg-primary)] shadow-xl p-6">
            <div className="flex items-center justify-between mb-8">
              <span className="font-display font-bold text-lg">Menu</span>
              <button onClick={() => setMenuOpen(false)} className="p-2 hover:bg-[var(--color-bg-tertiary)] rounded">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="space-y-2">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="block py-3 px-4 rounded-lg hover:bg-[var(--color-bg-tertiary)] font-medium"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden" aria-labelledby="hero-title">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent z-10" />
        <img
          src="https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=1920&q=80"
          alt=""
          className="w-full h-full object-cover"
          loading="eager"
        />
      </div>

      {/* Content */}
      <div className="relative z-20 container mx-auto px-6 lg:px-8 pt-20 lg:pt-24">
        <div className="max-w-2xl">
          <h1 
            id="hero-title"
            className="font-display font-black text-5xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight text-white mb-4 lg:mb-6"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            ZURI<span className="text-[var(--color-brand-primary)]">KARIBU</span>
          </h1>

          <p 
            className="text-lg sm:text-xl lg:text-2xl text-white/90 leading-relaxed mb-8 lg:mb-10 max-w-xl"
            style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
          >
            Made by Africans. Worn by the world. Discover authentic African fashion crafted by artisans across the continent.
          </p>

          {/* Primary CTA */}
          <div className="mb-8 lg:mb-12">
            <a
              href="#shop"
              className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--color-brand-primary)] text-white font-display font-semibold text-sm uppercase tracking-wider rounded hover:bg-[var(--color-brand-primary-hover)] transition-all duration-250 hover:-translate-y-0.5 hover:shadow-lg"
            >
              Shop Now
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </div>

          {/* Quick Paths */}
          <div className="flex flex-wrap gap-3 lg:gap-4">
            {[
              { text: 'Ready to Wear', href: '#ready-to-wear' },
              { text: 'Fabrics', href: '#fabrics' },
              { text: 'Custom', href: '#custom' },
            ].map((path) => (
              <a
                key={path.href}
                href={path.href}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg text-sm font-medium text-white hover:bg-white/20 hover:border-white/40 transition-all duration-250"
              >
                {path.text}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// Shop By Section
function ShopBySection() {
  const [activeTab, setActiveTab] = useState('category');

  const tabs = [
    { id: 'category', label: 'Category' },
    { id: 'country', label: 'Country' },
    { id: 'occasion', label: 'Occasion' },
    { id: 'price', label: 'Price' },
  ];

  const items: Record<string, { name: string; count: string }[]> = {
    category: [
      { name: 'Dresses', count: '240+' },
      { name: 'Tops & Blouses', count: '180+' },
      { name: 'Skirts', count: '120+' },
      { name: 'Pants', count: '95+' },
      { name: 'Outerwear', count: '60+' },
      { name: 'Accessories', count: '320+' },
      { name: "Men's Wear", count: '150+' },
      { name: 'Kids', count: '80+' },
    ],
    country: [
      { name: 'Nigeria', count: '450+' },
      { name: 'Ghana', count: '280+' },
      { name: 'Kenya', count: '190+' },
      { name: 'South Africa', count: '220+' },
      { name: 'Senegal', count: '120+' },
      { name: 'Ethiopia', count: '85+' },
      { name: 'Tanzania', count: '95+' },
      { name: 'Mali', count: '70+' },
    ],
    occasion: [
      { name: 'Wedding', count: '180+' },
      { name: 'Casual', count: '420+' },
      { name: 'Formal', count: '150+' },
      { name: 'Festival', count: '200+' },
      { name: 'Workwear', count: '110+' },
      { name: 'Party', count: '160+' },
      { name: 'Traditional', count: '95+' },
      { name: 'Beach', count: '75+' },
    ],
    price: [
      { name: 'Under $50', count: '280+' },
      { name: '$50 - $100', count: '350+' },
      { name: '$100 - $200', count: '290+' },
      { name: '$200 - $500', count: '180+' },
      { name: '$500+', count: '95+' },
      { name: 'Sale', count: '150+' },
    ],
  };

  return (
    <section className="py-20 lg:py-32 bg-[var(--color-bg-primary)]" aria-labelledby="shop-by-title">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="text-center mb-10 lg:mb-14">
          <h2 id="shop-by-title" className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text-primary)] mb-4">
            Shop by
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-md mx-auto">
            Discover African fashion your way
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 lg:gap-4 mb-10 lg:mb-12" role="tablist" aria-label="Shop by categories">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              className={`px-4 lg:px-6 py-3 rounded-full font-medium text-sm lg:text-base transition-all duration-250 min-h-[44px] ${
                activeTab === tab.id
                  ? 'bg-[var(--color-brand-primary)] text-white shadow-md'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4" role="tabpanel">
          {items[activeTab]?.map((item) => (
            <a
              key={item.name}
              href={`/shop/${activeTab}/${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="group p-4 lg:p-6 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] hover:border-[var(--color-brand-primary)] hover:shadow-lg transition-all duration-250"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-[var(--color-brand-primary)]">
                  <svg className="w-5 h-5 lg:w-6 lg:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </span>
                <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-bg-tertiary)] px-2 py-1 rounded-full">
                  {item.count}
                </span>
              </div>
              <h3 className="font-display font-semibold text-sm lg:text-base text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
                {item.name}
              </h3>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

// Trust Badges Section
function TrustBadges() {
  const badges = [
    { icon: 'shield', title: 'Authentic Guarantee', desc: 'Every piece is verified authentic' },
    { icon: 'truck', title: 'Global Shipping', desc: 'Free delivery on orders over $100' },
    { icon: 'refresh', title: 'Easy Returns', desc: '30-day hassle-free return policy' },
    { icon: 'support', title: '24/7 Support', desc: 'Our team is here to help anytime' },
  ];

  return (
    <section className="py-12 lg:py-16 bg-[var(--color-bg-secondary)] border-y border-[var(--color-border-default)]" aria-labelledby="trust-title">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 id="trust-title" className="font-display font-bold text-2xl lg:text-3xl text-[var(--color-text-primary)] mb-2">
            Why Shop With Us
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {badges.map((badge) => (
            <div key={badge.title} className="flex flex-col items-center text-center">
              <div className="w-12 h-12 lg:w-14 lg:h-14 rounded-full bg-[var(--color-brand-primary)]/10 flex items-center justify-center mb-4">
                {badge.icon === 'shield' && (
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {badge.icon === 'truck' && (
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                )}
                {badge.icon === 'refresh' && (
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                {badge.icon === 'support' && (
                  <svg className="w-6 h-6 lg:w-7 lg:h-7 text-[var(--color-brand-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
              </div>
              <h3 className="font-display font-semibold text-sm lg:text-base text-[var(--color-text-primary)] mb-1">
                {badge.title}
              </h3>
              <p className="text-xs lg:text-sm text-[var(--color-text-secondary)]">
                {badge.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Shop By Country Section
function ShopByCountry() {
  const [selectedRegion, setSelectedRegion] = useState('All');

  const regions = ['All', 'North', 'West', 'Central', 'East', 'Southern'];

  const countries = [
    { code: 'NG', name: 'Nigeria', region: 'West', flag: '🇳🇬' },
    { code: 'GH', name: 'Ghana', region: 'West', flag: '🇬🇭' },
    { code: 'KE', name: 'Kenya', region: 'East', flag: '🇰🇪' },
    { code: 'ZA', name: 'South Africa', region: 'Southern', flag: '🇿🇦' },
    { code: 'SN', name: 'Senegal', region: 'West', flag: '🇸🇳' },
    { code: 'ET', name: 'Ethiopia', region: 'East', flag: '🇪🇹' },
    { code: 'TZ', name: 'Tanzania', region: 'East', flag: '🇹🇿' },
    { code: 'ML', name: 'Mali', region: 'West', flag: '🇲🇱' },
    { code: 'EG', name: 'Egypt', region: 'North', flag: '🇪🇬' },
    { code: 'MA', name: 'Morocco', region: 'North', flag: '🇲🇦' },
    { code: 'DZ', name: 'Algeria', region: 'North', flag: '🇩🇿' },
    { code: 'CM', name: 'Cameroon', region: 'Central', flag: '🇨🇲' },
  ];

  const filteredCountries = selectedRegion === 'All' 
    ? countries 
    : countries.filter(c => c.region === selectedRegion);

  return (
    <section className="py-20 lg:py-32 bg-[var(--color-bg-primary)]" aria-labelledby="country-title">
      <div className="container mx-auto px-6 lg:px-8">
        <div className="text-center mb-8 lg:mb-12">
          <h2 id="country-title" className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl text-[var(--color-text-primary)] mb-4">
            Shop by Country
          </h2>
          <p className="text-lg text-[var(--color-text-secondary)] max-w-md mx-auto">
            Explore fashion from all 54 African nations
          </p>
        </div>

        {/* Region Filter */}
        <div className="flex flex-wrap justify-center gap-2 mb-8 lg:mb-10" role="group" aria-label="Filter by region">
          {regions.map((region) => (
            <button
              key={region}
              onClick={() => setSelectedRegion(region)}
              aria-pressed={selectedRegion === region}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-250 min-h-[36px] ${
                selectedRegion === region
                  ? 'bg-[var(--color-brand-primary)] text-white'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] border border-[var(--color-border-default)]'
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Countries Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 lg:gap-3">
          {filteredCountries.map((country) => (
            <a
              key={country.code}
              href={`/country/${country.name.toLowerCase().replace(/\s+/g, '-')}`}
              className="group flex flex-col items-center p-3 lg:p-4 bg-[var(--color-bg-secondary)] rounded-xl border border-[var(--color-border-default)] hover:border-[var(--color-brand-primary)] hover:shadow-md transition-all duration-250"
              title={`Shop from ${country.name}`}
            >
              <span className="text-2xl lg:text-3xl mb-2 group-hover:scale-110 transition-transform duration-250" role="img" aria-label={`${country.name} flag`}>
                {country.flag}
              </span>
              <span className="text-xs lg:text-sm font-medium text-[var(--color-text-primary)] text-center leading-tight">
                {country.name}
              </span>
            </a>
          ))}
        </div>

        {/* View All */}
        <div className="text-center mt-10">
          <a
            href="/countries"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--color-brand-primary)] text-white font-medium rounded hover:bg-[var(--color-brand-primary-hover)] transition-colors"
          >
            Explore All Countries
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

// Footer Section
function Footer() {
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setSubscribed(true);
      setEmail('');
      setTimeout(() => setSubscribed(false), 3000);
    }
  };

  return (
    <footer className="bg-[var(--color-neutral-900)] text-white" aria-labelledby="footer-heading">
      <h2 id="footer-heading" className="sr-only">Footer</h2>
      
      {/* Newsletter */}
      <div className="border-b border-white/10">
        <div className="container mx-auto px-6 lg:px-8 py-12 lg:py-16">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <h3 className="font-display font-bold text-2xl lg:text-3xl mb-2">
                Join the ZuriKaribu Family
              </h3>
              <p className="text-white/70">
                Subscribe for exclusive offers, new arrivals, and stories from Africa.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 lg:w-80">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/20 rounded text-white placeholder:text-white/50 focus:border-[var(--color-brand-primary)] focus:outline-none"
                  aria-label="Email address for newsletter"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3.5 bg-[var(--color-brand-primary)] text-white font-semibold rounded hover:bg-[var(--color-brand-primary-hover)] transition-colors"
              >
                {subscribed ? 'Subscribed!' : 'Subscribe'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Main Footer */}
      <div className="container mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="inline-block mb-6">
              <span className="font-display font-black text-2xl tracking-wider text-white">
                ZURI<span className="text-[var(--color-brand-primary)]">KARIBU</span>
              </span>
            </a>
            <p className="text-white/70 text-sm mb-6 max-w-xs">
              Connecting the world to authentic African fashion. Every piece tells a story of heritage, craftsmanship, and pride.
            </p>
          </div>

          {/* Shop Links */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              Shop
            </h4>
            <ul className="space-y-3">
              {['Ready to Wear', 'Fabrics', 'Custom', 'New Arrivals', 'Sale'].map((link) => (
                <li key={link}>
                  <a href={`/${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              Support
            </h4>
            <ul className="space-y-3">
              {['Contact Us', 'FAQs', 'Shipping Info', 'Returns', 'Size Guide'].map((link) => (
                <li key={link}>
                  <a href={`/${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4">
              Legal
            </h4>
            <ul className="space-y-3">
              {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map((link) => (
                <li key={link}>
                  <a href={`/${link.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-white/70 hover:text-white transition-colors">
                    {link}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container mx-auto px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-white/50">
              &copy; {new Date().getFullYear()} ZuriKaribu. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              {['Instagram', 'Facebook', 'Twitter'].map((social) => (
                <a
                  key={social}
                  href={`https://${social.toLowerCase()}.com`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[var(--color-brand-primary)] transition-colors"
                  aria-label={social}
                >
                  <span className="text-xs font-bold">{social[0]}</span>
                </a>
              ))}
            </div>
            <p className="text-sm text-white/50 flex items-center gap-1">
              Made with <span className="text-[var(--color-brand-primary)]">♥</span> in Africa
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Main App
function App() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navigation />
      <main id="main-content">
        <HeroSection />
        <ShopBySection />
        <TrustBadges />
        <ShopByCountry />
      </main>
      <Footer />
    </div>
  );
}

export default App;
