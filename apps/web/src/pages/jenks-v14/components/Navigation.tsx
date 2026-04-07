import { useEffect, useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, ShoppingBag, X, Search, ArrowRight } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const location = useLocation();
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const navLinks = [
    { label: 'Shop', href: '/#shop', hasDropdown: true },
    { label: 'Ready to Wear', href: '/ready-to-wear' },
    { label: 'Fabrics', href: '/fabrics' },
    { label: 'Custom', href: '/custom-to-wear' },
    { label: 'Designers', href: '/#designers' },
    { label: 'About', href: '/#about' },
  ];

  const shopDropdownLinks = [
    { label: 'Ready to Wear', href: '/ready-to-wear', desc: 'Curated contemporary pieces' },
    { label: 'Custom to Wear', href: '/custom-to-wear', desc: 'Bespoke designs by artisans' },
    { label: 'Fabrics', href: '/fabrics', desc: 'Authentic African textiles' },
    { label: 'New Arrivals', href: '/#new', desc: 'Latest drops this week' },
  ];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Navigate to search results
      window.location.href = `/search?q=${encodeURIComponent(searchQuery)}`;
    }
  };

  return (
    <>
      {/* Main Navigation - Sticky */}
      <nav 
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-[1000] transition-all duration-300 ${
          scrolled 
            ? 'bg-[var(--bg-primary)]/95 backdrop-blur-md shadow-sm' 
            : 'bg-transparent'
        }`}
      >
        <div className="px-4 sm:px-6 lg:px-12 h-16 lg:h-20 flex items-center justify-between">
          {/* Left - Menu Button */}
          <button 
            onClick={() => setMenuOpen(true)}
            className="p-2.5 hover:bg-[var(--bg-secondary)] rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-[var(--text-primary)]" strokeWidth={1.5} />
          </button>

          {/* Center - Logo */}
          <Link to="/" className="absolute left-1/2 -translate-x-1/2">
            <span className="font-display font-bold text-base sm:text-lg tracking-[0.15em] sm:tracking-[0.2em] text-[var(--text-primary)]">
              ZURIKARIBU
            </span>
          </Link>

          {/* Right Actions */}
          <div className="flex items-center gap-1 sm:gap-2">
            {/* Search Button */}
            <button 
              onClick={() => setSearchOpen(true)}
              className="p-2.5 hover:bg-[var(--bg-secondary)] rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-[var(--text-primary)]" strokeWidth={1.5} />
            </button>
            
            <ThemeToggle />
            
            <button 
              className="relative p-2.5 hover:bg-[var(--bg-secondary)] rounded-full transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5 text-[var(--text-primary)]" strokeWidth={1.5} />
              <span className="absolute top-1 right-1 w-4 h-4 bg-[var(--accent)] rounded-full text-[10px] flex items-center justify-center text-white font-medium">
                0
              </span>
            </button>
            
            <Link 
              to="#signin" 
              className="hidden sm:block text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors px-3 py-2"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Desktop Secondary Nav - Shows when scrolled */}
        <div className={`hidden lg:block border-t border-[var(--border)] transition-all duration-300 ${
          scrolled ? 'opacity-100 max-h-14' : 'opacity-0 max-h-0 overflow-hidden'
        }`}>
          <div className="px-12 h-12 flex items-center justify-center gap-8">
            {navLinks.map((link) => (
              <div key={link.label} className="relative group">
                <Link 
                  to={link.href}
                  className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-3"
                >
                  {link.label}
                </Link>
                
                {/* Shop Dropdown */}
                {link.hasDropdown && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl rounded-lg p-4 min-w-[280px]">
                      <p className="label-mono text-[var(--text-muted)] mb-3 px-2">SHOP BY CATEGORY</p>
                      {shopDropdownLinks.map((item) => (
                        <Link
                          key={item.label}
                          to={item.href}
                          className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--bg-primary)] transition-colors group/item"
                        >
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)] group-hover/item:text-[var(--accent)] transition-colors">
                              {item.label}
                            </p>
                            <p className="text-xs text-[var(--text-muted)]">{item.desc}</p>
                          </div>
                          <ArrowRight className="w-4 h-4 text-[var(--text-muted)] opacity-0 group-hover/item:opacity-100 transition-opacity" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </nav>

      {/* Search Overlay */}
      <div 
        className={`fixed inset-0 bg-[var(--bg-primary)]/98 backdrop-blur-lg z-[2001] transition-all duration-300 ${
          searchOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}
      >
        <div className="h-full flex flex-col px-6 md:px-12 py-20">
          {/* Close Button */}
          <button 
            onClick={() => setSearchOpen(false)}
            className="absolute top-4 right-4 p-3 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
            aria-label="Close search"
          >
            <X className="w-6 h-6 text-[var(--text-primary)]" strokeWidth={1.5} />
          </button>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="max-w-3xl mx-auto w-full">
            <div className="relative">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products, designers, countries..."
                className="w-full pl-10 pr-4 py-4 bg-transparent border-b-2 border-[var(--border)] text-2xl md:text-3xl text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoFocus={searchOpen}
              />
            </div>
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              Press Enter to search or ESC to close
            </p>
          </form>

          {/* Quick Searches */}
          <div className="max-w-3xl mx-auto w-full mt-12">
            <p className="label-mono text-[var(--text-muted)] mb-4">POPULAR SEARCHES</p>
            <div className="flex flex-wrap gap-2">
              {['Ankara Dress', 'Kente Cloth', 'Nigerian Designers', 'Wedding Gown', 'Dashiki'].map((term) => (
                <button
                  key={term}
                  onClick={() => {
                    setSearchQuery(term);
                    window.location.href = `/search?q=${encodeURIComponent(term)}`;
                  }}
                  className="px-4 py-2 bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-primary)] hover:border-[var(--accent)] transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full Screen Menu */}
      <div 
        className={`fixed inset-0 bg-[var(--bg-primary)] z-[2000] transition-transform duration-500 ease-out ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col justify-center px-6 md:px-12 lg:px-24">
          {/* Close Button */}
          <button 
            onClick={() => setMenuOpen(false)}
            className="absolute top-4 right-4 p-3 hover:bg-[var(--bg-secondary)] rounded-full transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6 text-[var(--text-primary)]" strokeWidth={1.5} />
          </button>

          {/* Menu Links */}
          <nav className="space-y-4 md:space-y-6">
            {navLinks.map((link, index) => (
              <Link
                key={link.label}
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className="block headline-lg text-3xl md:text-5xl lg:text-6xl text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Menu Footer */}
          <div className="absolute bottom-8 left-6 md:left-12 lg:left-24 right-6 flex items-center justify-between">
            <p className="label-mono text-[var(--text-secondary)]">Made by Africans. Worn by the world.</p>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
