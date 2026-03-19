import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu, ShoppingBag, User, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { useHomepageExperienceStore } from '../store/homepageExperienceStore';
import { api } from '../services/api';
import Footer from '../components/Footer';
import { getHomeRouteForUser, normalizeRole } from '../auth/rbac';
import CustomerServiceChatWidget from '../components/chat/CustomerServiceChatWidget';
import CustomerServiceChatWidgetBoundary from '../components/chat/CustomerServiceChatWidgetBoundary';
import type { HomepageExperienceMode, HomepageThemeMode } from '../design/homepageExperience';

const USE_DYNAMIC_HOMEPAGE = import.meta.env.VITE_HOMEPAGE_MODE === 'dynamic';
const TOP_STRIP_DEFAULTS = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  fontSize: 12,
  isBold: false,
  pauseOnHover: true,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};

export default function MainLayout() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isTopStripHovered, setIsTopStripHovered] = useState(false);
  const { isAuthenticated, logout, user } = useAuthStore();
  const { getItemCount } = useCartStore();
  const { selectedCurrency, supportedCurrencies, hydrateFromConfig, setSelectedCurrency } = useCurrencyStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: footerContent } = useQuery({
    queryKey: ['homepageFooterForHeader'],
    enabled: USE_DYNAMIC_HOMEPAGE,
    queryFn: async () => {
      const response = await api.homepageSections.getFooter();
      return response.success ? response.data : null;
    },
  });
  const { data: visibilityContent } = useQuery({
    queryKey: ['homepageVisibilityForLayout'],
    queryFn: async () => {
      const response = await api.homepageSections.getVisibility();
      return response.success ? response.data : null;
    },
  });
  const { data: topStripContent } = useQuery({
    queryKey: ['homepageTopStrip'],
    queryFn: async () => {
      const response = await api.homepageSections.getTopStrip();
      return response.success ? response.data : null;
    },
  });
  const { data: currencyConfig } = useQuery({
    queryKey: ['currencyConfigForLayout'],
    queryFn: async () => {
      const response = await api.currency.getConfig();
      return response.success ? response.data : null;
    },
  });
  const { data: homepageExperienceSettings } = useQuery({
    queryKey: ['homepageExperienceSettings'],
    queryFn: async () => {
      const response = await api.homepageSections.getExperienceSettings();
      return response.success ? response.data : null;
    },
  });
  const experienceSettings = useHomepageExperienceStore((state) => state.settings);
  const resolvedExperienceMode = useHomepageExperienceStore((state) => state.resolvedMode);
  const userOverrideMode = useHomepageExperienceStore((state) => state.userOverrideMode);
  const resolvedThemeMode = useHomepageExperienceStore((state) => state.resolvedThemeMode);
  const userOverrideThemeMode = useHomepageExperienceStore((state) => state.userOverrideThemeMode);
  const concreteTheme = useHomepageExperienceStore((state) => state.concreteTheme);
  const hydrateExperienceSettings = useHomepageExperienceStore((state) => state.hydrateSettings);
  const evaluateExperienceCapabilities = useHomepageExperienceStore((state) => state.evaluateCapabilities);
  const setUserOverrideMode = useHomepageExperienceStore((state) => state.setUserOverrideMode);
  const setUserOverrideThemeMode = useHomepageExperienceStore((state) => state.setUserOverrideThemeMode);
  const brandName = footerContent?.companyName?.trim() || 'ZURIKARIBU';
  const userRole = normalizeRole(user?.role);
  const dashboardRoute = getHomeRouteForUser(user);
  const profileRoute = userRole === 'CUSTOMER' ? '/profile' : dashboardRoute;
  const ordersRoute = userRole === 'CUSTOMER' ? '/orders' : null;
  const cartItemCount = getItemCount();
  const isProductRetailPath = /^\/(designs|ready-to-wear|fabrics)\/[^/]+$/i.test(location.pathname);
  const showFloatingCheckout = isProductRetailPath && cartItemCount > 0;
  const profileLabel = userRole === 'CUSTOMER' ? 'My Profile' : 'Dashboard';
  const ordersLabel = 'My Orders';
  const topStripVisible = Boolean(visibilityContent?.topStrip ?? true);
  const topStripMessages =
    Array.isArray(topStripContent?.messages) && topStripContent.messages.length > 0
      ? topStripContent.messages
      : TOP_STRIP_DEFAULTS.messages;
  const topStripSeparator = String(topStripContent?.separator || TOP_STRIP_DEFAULTS.separator);
  const topStripRepeatCount = Math.max(
    2,
    Math.min(12, Number(topStripContent?.repeatCount || TOP_STRIP_DEFAULTS.repeatCount))
  );
  const topStripAnimationSeconds = Math.max(
    8,
    Math.min(120, Number(topStripContent?.animationSeconds || TOP_STRIP_DEFAULTS.animationSeconds))
  );
  const topStripFontSize = Math.max(10, Math.min(40, Number(topStripContent?.fontSize || TOP_STRIP_DEFAULTS.fontSize)));
  const topStripIsBold = Boolean(topStripContent?.isBold ?? TOP_STRIP_DEFAULTS.isBold);
  const topStripPauseOnHover = Boolean(topStripContent?.pauseOnHover ?? TOP_STRIP_DEFAULTS.pauseOnHover);
  const topStripTextColor = String(topStripContent?.textColor || TOP_STRIP_DEFAULTS.textColor);
  const topStripBackgroundColor = String(topStripContent?.backgroundColor || TOP_STRIP_DEFAULTS.backgroundColor);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (currencyConfig) {
      hydrateFromConfig(currencyConfig);
    }
  }, [currencyConfig, hydrateFromConfig]);

  useEffect(() => {
    hydrateExperienceSettings(homepageExperienceSettings || undefined);
  }, [homepageExperienceSettings, hydrateExperienceSettings]);

  useEffect(() => {
    evaluateExperienceCapabilities();
  }, [evaluateExperienceCapabilities]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.dataset.zkScope = 'public';
    document.body.dataset.zkTheme = concreteTheme.toLowerCase();
    return () => {
      delete document.body.dataset.zkScope;
      delete document.body.dataset.zkTheme;
    };
  }, [concreteTheme]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const enabledModes = Array.isArray(experienceSettings.enabledModes)
    ? experienceSettings.enabledModes
    : ['LITE_COMMERCE', 'STANDARD_PREMIUM', 'EDITORIAL_IMMERSIVE'];
  const enabledThemeModes = Array.isArray(experienceSettings.themeModes)
    ? experienceSettings.themeModes
    : ['SYSTEM', 'LIGHT', 'DARK'];
  const currentModePickerValue = userOverrideMode || 'AUTO';
  const currentThemePickerValue = userOverrideThemeMode || 'AUTO';
  const handleExperienceModeChange = (value: string) => {
    if (value === 'AUTO') {
      setUserOverrideMode(null);
      return;
    }
    setUserOverrideMode(value as HomepageExperienceMode);
  };
  const handleThemeModeChange = (value: string) => {
    if (value === 'AUTO') {
      setUserOverrideThemeMode(null);
      return;
    }
    setUserOverrideThemeMode(value as HomepageThemeMode);
  };

  const leftNavLinks = [
    { label: 'Home', href: '/' },
    { label: 'Ready To Wear', href: '/ready-to-wear' },
    { label: 'Fabric To Buy', href: '/fabrics' },
    { label: 'Custom To Wear', href: '/designs' },
  ];
  const rightNavLinks = [
    { label: 'Shop', href: '/shop' },
    { label: 'About Us', href: '/#about' },
    { label: 'Contact Us', href: '/contact' },
  ];
  const hamburgerLinks = [
    { label: 'Home', href: '/' },
    { label: 'Shop', href: '/shop' },
    { label: 'Ready To Wear', href: '/ready-to-wear' },
    { label: 'Fabric To Buy', href: '/fabrics' },
    { label: 'Custom To Wear', href: '/designs' },
    { label: 'About Us', href: '/#about' },
    { label: 'Contact Us', href: '/contact' },
  ];
  const isHeroHeader = location.pathname === '/' && !isScrolled;
  const menuTextClass = isHeroHeader ? 'text-white/90 hover:text-white' : 'text-black hover:text-black/70';
  const iconTextClass = isHeroHeader ? 'text-white' : 'text-black';
  const hoverSurfaceClass = isHeroHeader ? 'hover:bg-white/15' : 'hover:bg-black/5';

  return (
    <div className="min-h-screen flex flex-col">
      {topStripVisible ? (
        <div
          className="h-10 flex items-center overflow-hidden"
          style={{
            backgroundColor: topStripBackgroundColor,
            color: topStripTextColor,
          }}
          onMouseEnter={() => setIsTopStripHovered(true)}
          onMouseLeave={() => setIsTopStripHovered(false)}
        >
          <div
            className="animate-marquee whitespace-nowrap flex gap-8"
            style={{
              animationDuration: `${topStripAnimationSeconds}s`,
              animationPlayState: topStripPauseOnHover && isTopStripHovered ? 'paused' : 'running',
            }}
          >
            {[...Array(topStripRepeatCount)].map((_, i) => (
              <div
                key={i}
                className="flex gap-8 tracking-wider"
                style={{ fontSize: `${topStripFontSize}px`, fontWeight: topStripIsBold ? 700 : 400 }}
              >
                {topStripMessages.map((message, idx) => (
                  <span key={`${i}-${idx}`} className="inline-flex items-center gap-8">
                    <span>{message}</span>
                    <span>{topStripSeparator}</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <header
        className={`fixed ${topStripVisible ? 'top-10' : 'top-0'} left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled ? 'glass shadow-lg py-3' : 'bg-transparent py-5'
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4 lg:gap-8">
              <div className="relative">
                <button
                  onClick={() => setIsHamburgerOpen((prev) => !prev)}
                  className={`rounded-full p-2 transition-colors ${iconTextClass} ${hoverSurfaceClass}`}
                  aria-label="Toggle site menu"
                >
                  {isHamburgerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
                {isHamburgerOpen ? (
                  <div className="absolute left-0 top-full z-50 mt-3 w-64 rounded-xl border border-gray-100 bg-white p-2 shadow-xl">
                    <nav className="flex flex-col">
                      {hamburgerLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          onClick={() => setIsHamburgerOpen(false)}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>
                  </div>
                ) : null}
              </div>
              <nav className="hidden lg:flex items-center gap-8">
                {leftNavLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`text-sm font-medium link-underline transition-colors ${menuTextClass}`}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </div>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className={`font-['Oswald'] text-xl sm:text-2xl font-semibold tracking-wide ${menuTextClass}`}>
                {brandName.toUpperCase()}
              </span>
            </Link>

            <div className="flex items-center gap-2 lg:gap-4">
              <nav className="hidden lg:flex items-center gap-8 pr-3">
                {rightNavLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`text-sm font-medium link-underline transition-colors ${menuTextClass}`}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
              <div className="hidden md:block">
                <select
                  className={`h-8 min-w-[88px] border-none bg-transparent text-xs ${iconTextClass}`}
                  value={selectedCurrency}
                  onChange={(event) => setSelectedCurrency(event.target.value)}
                >
                  {(supportedCurrencies || ['USD']).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className="hidden xl:flex items-center gap-2">
                <select
                  className={`h-8 min-w-[132px] rounded border border-current/20 bg-transparent px-2 text-[11px] ${iconTextClass}`}
                  value={currentModePickerValue}
                  onChange={(event) => handleExperienceModeChange(event.target.value)}
                  aria-label="Homepage experience mode"
                >
                  <option value="AUTO">Mode: Auto ({resolvedExperienceMode.replace('_', ' ')})</option>
                  {enabledModes.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode === 'LITE_COMMERCE'
                        ? 'Lite Commerce'
                        : mode === 'STANDARD_PREMIUM'
                          ? 'Standard Premium'
                          : 'Editorial Immersive'}
                    </option>
                  ))}
                </select>
                <select
                  className={`h-8 min-w-[124px] rounded border border-current/20 bg-transparent px-2 text-[11px] ${iconTextClass}`}
                  value={currentThemePickerValue}
                  onChange={(event) => handleThemeModeChange(event.target.value)}
                  aria-label="Theme mode"
                >
                  <option value="AUTO">Theme: Auto ({resolvedThemeMode})</option>
                  {enabledThemeModes.map((theme) => (
                    <option key={theme} value={theme}>
                      {theme}
                    </option>
                  ))}
                </select>
              </div>
              <Link
                to="/cart"
                className={`relative rounded-full p-2 transition-colors ${iconTextClass} ${hoverSurfaceClass}`}
              >
                <ShoppingBag className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                  {cartItemCount}
                </span>
              </Link>

              {isAuthenticated ? (
                <div className="relative group">
                  <button className={`rounded-full p-2 transition-colors ${iconTextClass} ${hoverSurfaceClass}`}>
                    <User className="w-5 h-5" />
                  </button>
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                    <div className="py-2">
                      <Link
                        to={profileRoute}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {profileLabel}
                      </Link>
                      {ordersRoute ? (
                        <Link
                          to={ordersRoute}
                          className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {ordersLabel}
                        </Link>
                      ) : null}
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <Link
                  to="/login"
                  className={`hidden sm:flex items-center gap-2 text-sm font-medium transition-colors ${menuTextClass}`}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
      {showFloatingCheckout ? (
        <Link
          to="/checkout"
          className="fixed right-3 top-1/2 z-40 -translate-y-1/2 border border-black bg-black px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-lg hover:bg-gray-900"
        >
          Checkout ({cartItemCount})
        </Link>
      ) : null}
      <CustomerServiceChatWidgetBoundary>
        <CustomerServiceChatWidget />
      </CustomerServiceChatWidgetBoundary>
      <Footer />
    </div>
  );
}
