import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Menu, Search, ShoppingBag, User, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { useCurrencyStore } from '../store/currencyStore';
import { useHomepageExperienceStore } from '../store/homepageExperienceStore';
import { api, resolveAssetUrl } from '../services/api';
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
type NavMenuLink = {
  label: string;
  href: string;
  enabled?: boolean;
};
const NAVIGATION_SETTINGS_DEFAULTS = {
  logoMode: 'TEXT' as 'TEXT' | 'IMAGE',
  logoText: 'ZURIKARIBU',
  logoImageUrl: '',
  logoAltText: 'ZuriKaribu',
  logoWidth: 180,
  logoHeight: 48,
  leftMenuLinks: [
    { label: 'Home', href: '/', enabled: true },
    { label: 'Ready To Wear', href: '/jenks-v14/ready-to-wear', enabled: true },
    { label: 'Fabric To Buy', href: '/jenks-v14/fabrics', enabled: true },
    { label: 'Custom To Wear', href: '/jenks-v14/custom-to-wear', enabled: true },
  ] as NavMenuLink[],
  rightMenuLinks: [
    { label: 'Shop', href: '/jenks-v14/ready-to-wear', enabled: true },
    { label: 'About Us', href: '/#about', enabled: true },
    { label: 'Contact Us', href: '/contact', enabled: true },
  ] as NavMenuLink[],
  hamburgerMenuLinks: [
    { label: 'Home', href: '/', enabled: true },
    { label: 'Shop', href: '/jenks-v14/ready-to-wear', enabled: true },
    { label: 'Ready To Wear', href: '/jenks-v14/ready-to-wear', enabled: true },
    { label: 'Fabric To Buy', href: '/jenks-v14/fabrics', enabled: true },
    { label: 'Custom To Wear', href: '/jenks-v14/custom-to-wear', enabled: true },
    { label: 'About Us', href: '/#about', enabled: true },
    { label: 'Contact Us', href: '/contact', enabled: true },
  ] as NavMenuLink[],
  showHamburger: true,
  showSearchIcon: true,
  showCartIcon: true,
  showProfileIcon: true,
  showCurrencySelector: true,
  showExperienceModeSelector: true,
  showThemeModeSelector: true,
};

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

type SearchResultItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  image: string;
  typeLabel: 'RTW' | 'CTW' | 'FABRIC';
};

const normalizeSearchImage = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '/product1.jpg';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  return resolveAssetUrl(raw) || raw;
};

const resolveRowImage = (row: any) => {
  const images = Array.isArray(row?.images) ? row.images : [];
  for (const entry of images) {
    const candidate =
      normalizeSearchImage(entry?.url || entry?.secureUrl || entry?.src || entry?.imageUrl || entry);
    if (candidate) return candidate;
  }
  return normalizeSearchImage(row?.image || row?.imageUrl || row?.thumbnail || row?.displayImage);
};

export default function MainLayout() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isHamburgerOpen, setIsHamburgerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchStatus, setSearchStatus] = useState<SearchStatus>('idle');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [searchError, setSearchError] = useState('');
  const [isTopStripHovered, setIsTopStripHovered] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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
  const { data: jenksHomepageConfigForLayout } = useQuery({
    queryKey: ['jenksHomepageConfigForLayoutV1'],
    queryFn: async () => {
      const response = await api.homepageSections.getJenksHomepageConfig();
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
  const homepageExperienceSettings = jenksHomepageConfigForLayout?.experience || null;
  const navigationSettingsData = jenksHomepageConfigForLayout?.navigation || null;
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
  const isProductRetailPath = /^\/(designs|custom|ready-to-wear|fabrics)\/[^/]+$/i.test(location.pathname);
  const showFloatingCheckout = isProductRetailPath && cartItemCount > 0;
  const profileLabel = userRole === 'CUSTOMER' ? 'My Profile' : 'Dashboard';
  const ordersLabel = 'My Orders';
  const topStripVisible = Boolean(jenksHomepageConfigForLayout?.sections?.visibility?.topStrip ?? true);
  const topStripMessages =
    Array.isArray(jenksHomepageConfigForLayout?.topStrip?.messages) && jenksHomepageConfigForLayout.topStrip.messages.length > 0
      ? jenksHomepageConfigForLayout.topStrip.messages
      : TOP_STRIP_DEFAULTS.messages;
  const topStripSeparator = String(jenksHomepageConfigForLayout?.topStrip?.separator || TOP_STRIP_DEFAULTS.separator);
  const topStripRepeatCount = Math.max(
    2,
    Math.min(12, Number(jenksHomepageConfigForLayout?.topStrip?.repeatCount || TOP_STRIP_DEFAULTS.repeatCount))
  );
  const topStripAnimationSeconds = Math.max(
    8,
    Math.min(120, Number(jenksHomepageConfigForLayout?.topStrip?.animationSeconds || TOP_STRIP_DEFAULTS.animationSeconds))
  );
  const topStripFontSize = Math.max(10, Math.min(40, Number(jenksHomepageConfigForLayout?.topStrip?.fontSize || TOP_STRIP_DEFAULTS.fontSize)));
  const topStripIsBold = Boolean(jenksHomepageConfigForLayout?.topStrip?.isBold ?? TOP_STRIP_DEFAULTS.isBold);
  const topStripPauseOnHover = Boolean(jenksHomepageConfigForLayout?.topStrip?.pauseOnHover ?? TOP_STRIP_DEFAULTS.pauseOnHover);
  const topStripTextColor = String(jenksHomepageConfigForLayout?.topStrip?.textColor || TOP_STRIP_DEFAULTS.textColor);
  const topStripBackgroundColor = String(jenksHomepageConfigForLayout?.topStrip?.backgroundColor || TOP_STRIP_DEFAULTS.backgroundColor);
  const trimmedSearchQuery = searchQuery.trim();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsHamburgerOpen(false);
    setIsSearchOpen(false);
  }, [location.pathname]);

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
    const root = document.documentElement;
    root.classList.toggle('dark', concreteTheme === 'DARK');
    return () => {
      delete document.body.dataset.zkScope;
      delete document.body.dataset.zkTheme;
      root.classList.remove('dark');
    };
  }, [concreteTheme]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsSearchOpen(false);
      setTimeout(() => searchButtonRef.current?.focus(), 0);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    if (isSearchOpen) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      document.body.style.overflow = previousOverflow || '';
    }
    return () => {
      document.body.style.overflow = previousOverflow || '';
    };
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    if (trimmedSearchQuery.length < 2) {
      setSearchStatus('idle');
      setSearchResults([]);
      setSearchError('');
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        setSearchStatus('loading');
        setSearchError('');
        const [rtwResponse, ctwResponse, fabricsResponse] = await Promise.all([
          api.products.getReadyToWear({ search: trimmedSearchQuery, limit: 4, page: 1 }),
          api.products.getDesigns({ search: trimmedSearchQuery, limit: 4, page: 1 }),
          api.products.getFabrics({ search: trimmedSearchQuery, limit: 4, page: 1 }),
        ]);
        if (cancelled) return;

        const rtwRows = Array.isArray((rtwResponse as any)?.data?.products)
          ? (rtwResponse as any).data.products
          : [];
        const ctwRows = Array.isArray((ctwResponse as any)?.data?.designs)
          ? (ctwResponse as any).data.designs
          : [];
        const fabricRows = Array.isArray((fabricsResponse as any)?.data?.fabrics)
          ? (fabricsResponse as any).data.fabrics
          : [];

        const nextResults: SearchResultItem[] = [
          ...rtwRows.map((row: any) => ({
            id: `rtw-${row.id}`,
            title: String(row?.name || row?.title || 'Ready to Wear'),
            subtitle: String(row?.country || row?.designer?.country || 'Ready to Wear'),
            href: `/jenks-v14/ready-to-wear/${row.id}`,
            image: resolveRowImage(row),
            typeLabel: 'RTW' as const,
          })),
          ...ctwRows.map((row: any) => ({
            id: `ctw-${row.id}`,
            title: String(row?.name || row?.title || 'Custom to Wear'),
            subtitle: String(row?.country || row?.designer?.country || 'Custom to Wear'),
            href: `/jenks-v14/custom-to-wear/${row.id}`,
            image: resolveRowImage(row),
            typeLabel: 'CTW' as const,
          })),
          ...fabricRows.map((row: any) => ({
            id: `fab-${row.id}`,
            title: String(row?.name || row?.title || 'Fabrics'),
            subtitle: String(row?.country || row?.seller?.country || 'Fabrics'),
            href: `/jenks-v14/fabrics/${row.id}`,
            image: resolveRowImage(row),
            typeLabel: 'FABRIC' as const,
          })),
        ].slice(0, 12);

        setSearchResults(nextResults);
        setSearchStatus('success');
      } catch (error) {
        if (cancelled) return;
        setSearchStatus('error');
        setSearchResults([]);
        setSearchError(
          String((error as any)?.response?.data?.message || (error as Error)?.message || 'Search unavailable.')
        );
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isSearchOpen, trimmedSearchQuery]);

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

  const normalizeNavigationLinks = (value: unknown, fallback: NavMenuLink[]): NavMenuLink[] => {
    const rows = Array.isArray(value) ? value : [];
    const mapped = rows
      .map((entry) => {
        if (!entry || typeof entry !== 'object') return null;
        const row = entry as Record<string, unknown>;
        const label = String(row.label || '').trim();
        const href = String(row.href || '').trim();
        if (!label || !href) return null;
        return {
          label: label.slice(0, 40),
          href,
          enabled: row.enabled !== false,
        } as NavMenuLink;
      })
      .filter((entry): entry is NavMenuLink => Boolean(entry))
      .slice(0, 20);
    return mapped.length > 0 ? mapped : fallback.map((entry) => ({ ...entry }));
  };
  const navigationSettings = {
    ...NAVIGATION_SETTINGS_DEFAULTS,
    ...(navigationSettingsData || {}),
  };
  const logoMode = navigationSettings.logoMode === 'IMAGE' ? 'IMAGE' : 'TEXT';
  const logoText = String(navigationSettings.logoText || brandName || NAVIGATION_SETTINGS_DEFAULTS.logoText).trim() || NAVIGATION_SETTINGS_DEFAULTS.logoText;
  const logoImageUrl = resolveAssetUrl(String(navigationSettings.logoImageUrl || '').trim()) || String(navigationSettings.logoImageUrl || '').trim();
  const logoAltText = String(navigationSettings.logoAltText || logoText || NAVIGATION_SETTINGS_DEFAULTS.logoAltText).trim();
  const logoWidth = Math.max(40, Math.min(600, Number(navigationSettings.logoWidth || NAVIGATION_SETTINGS_DEFAULTS.logoWidth)));
  const logoHeight = Math.max(20, Math.min(300, Number(navigationSettings.logoHeight || NAVIGATION_SETTINGS_DEFAULTS.logoHeight)));
  const leftNavLinks = normalizeNavigationLinks(navigationSettings.leftMenuLinks, NAVIGATION_SETTINGS_DEFAULTS.leftMenuLinks).filter(
    (entry) => entry.enabled !== false
  );
  const rightNavLinks = normalizeNavigationLinks(
    navigationSettings.rightMenuLinks,
    NAVIGATION_SETTINGS_DEFAULTS.rightMenuLinks
  ).filter((entry) => entry.enabled !== false);
  const hamburgerLinks = normalizeNavigationLinks(
    navigationSettings.hamburgerMenuLinks,
    NAVIGATION_SETTINGS_DEFAULTS.hamburgerMenuLinks
  ).filter((entry) => entry.enabled !== false);
  const isHeroHeader = location.pathname === '/' && !isScrolled;
  const isSplitEditorialHero = isHeroHeader && experienceSettings.heroVariant === 'SPLIT_EDITORIAL';
  const menuTextClass = isSplitEditorialHero
    ? 'text-[#1a1917] hover:text-[#000000]'
    : isHeroHeader
      ? 'text-white/90 hover:text-white'
      : 'text-black hover:text-black/70';
  const iconTextClass = isSplitEditorialHero ? 'text-[#1a1917]' : isHeroHeader ? 'text-white' : 'text-black';
  const hoverSurfaceClass = isSplitEditorialHero
    ? 'hover:bg-black/5'
    : isHeroHeader
      ? 'hover:bg-white/15'
      : 'hover:bg-black/5';
  const normalizedBrandName = logoText.replace(/\s+/g, '').toUpperCase();
  const showTwoToneBrand = normalizedBrandName === 'ZURIKARIBU';
  const overlayLogoTone = isHeroHeader && !isSplitEditorialHero;
  const logoPartOneClass = overlayLogoTone ? 'text-white' : concreteTheme === 'DARK' ? 'text-white' : 'text-[#1A1A1A]';
  const logoPartTwoClass = overlayLogoTone ? 'text-[#ff8a6f]' : 'text-[#E85A3C]';
  const popularSearchTerms = useMemo(
    () => ['Ankara Dress', 'Kente Cloth', 'Wedding Look', 'Dashiki', 'Aso Oke', 'Bridal Ready To Wear'],
    []
  );

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
          isScrolled
            ? 'border-b border-black/10 bg-[rgba(250,249,247,0.94)] py-3 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-[rgba(20,20,19,0.94)]'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-20">
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4 lg:gap-8">
              {navigationSettings.showHamburger ? (
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
              ) : null}
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
              {logoMode === 'IMAGE' && logoImageUrl ? (
                <img
                  src={logoImageUrl}
                  alt={logoAltText}
                  style={{ width: `${logoWidth}px`, height: `${logoHeight}px` }}
                  className="max-w-none object-contain"
                  loading="lazy"
                />
              ) : showTwoToneBrand ? (
                <span
                  className="font-['Oswald'] font-semibold tracking-[0.08em]"
                  style={{ fontSize: `${Math.max(18, Math.min(44, logoHeight * 0.6))}px` }}
                >
                  <span className={logoPartOneClass}>ZURI</span>
                  <span className={logoPartTwoClass}>KARIBU</span>
                </span>
              ) : (
                <span
                  className={`font-['Oswald'] font-semibold tracking-wide ${menuTextClass}`}
                  style={{ fontSize: `${Math.max(18, Math.min(44, logoHeight * 0.6))}px` }}
                >
                  {logoText.toUpperCase()}
                </span>
              )}
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
              {navigationSettings.showSearchIcon ? (
                <button
                  ref={searchButtonRef}
                  onClick={() => setIsSearchOpen(true)}
                  className={`rounded-full p-2 transition-colors ${iconTextClass} ${hoverSurfaceClass}`}
                  aria-label="Open search"
                >
                  <Search className="h-5 w-5" />
                </button>
              ) : null}
              {navigationSettings.showCurrencySelector ? (
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
              ) : null}
              {navigationSettings.showExperienceModeSelector || navigationSettings.showThemeModeSelector ? (
                <div className="hidden xl:flex items-center gap-2">
                  {navigationSettings.showExperienceModeSelector ? (
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
                  ) : null}
                  {navigationSettings.showThemeModeSelector ? (
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
                  ) : null}
                </div>
              ) : null}
              {navigationSettings.showCartIcon ? (
                <Link
                  to="/cart"
                  className={`relative rounded-full p-2 transition-colors ${iconTextClass} ${hoverSurfaceClass}`}
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-black text-white text-[10px] rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                </Link>
              ) : null}

              {isAuthenticated ? (
                navigationSettings.showProfileIcon ? (
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
                    to={profileRoute}
                    className={`hidden sm:flex items-center gap-2 text-sm font-medium transition-colors ${menuTextClass}`}
                  >
                    {profileLabel}
                  </Link>
                )
              ) : (
                <Link
                  to="/auth/login"
                  className={`hidden sm:flex items-center gap-2 text-sm font-medium transition-colors ${menuTextClass}`}
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-[120] bg-[rgba(250,249,247,0.97)] px-4 pb-8 pt-24 backdrop-blur-md transition-all duration-200 dark:bg-[rgba(20,20,19,0.97)] sm:px-6 lg:px-12 xl:px-20 ${
          isSearchOpen ? 'visible opacity-100' : 'invisible opacity-0'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Search products overlay"
      >
        <div className="mx-auto w-full max-w-4xl">
          <div className="flex items-center gap-3 border-b border-black/15 pb-3 dark:border-white/20">
            <Search className="h-5 w-5 text-black/60 dark:text-white/70" />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products, fabrics, designers..."
              aria-label="Search input"
              className="h-11 flex-1 bg-transparent text-lg text-black outline-none placeholder:text-black/40 dark:text-white dark:placeholder:text-white/50"
            />
            <button
              onClick={() => {
                setIsSearchOpen(false);
                setTimeout(() => searchButtonRef.current?.focus(), 0);
              }}
              className="rounded-full p-2 text-black/80 transition-colors hover:bg-black/10 dark:text-white/90 dark:hover:bg-white/10"
              aria-label="Close search"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mt-3 text-xs tracking-[0.16em] text-black/50 dark:text-white/55">
            ESC to close. Enter at least 2 characters.
          </p>

          <div className="mt-6">
            {searchStatus === 'idle' ? (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-black/50 dark:text-white/55">
                  Popular searches
                </p>
                <div className="flex flex-wrap gap-2">
                  {popularSearchTerms.map((term) => (
                    <button
                      key={term}
                      onClick={() => setSearchQuery(term)}
                      className="rounded border border-black/20 px-3 py-2 text-xs font-medium text-black/80 transition-colors hover:border-black dark:border-white/25 dark:text-white/85 dark:hover:border-white"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {searchStatus === 'loading' ? (
              <div className="mt-8 flex items-center gap-3 text-sm text-black/75 dark:text-white/80">
                <Loader2 className="h-4 w-4 animate-spin" />
                Searching...
              </div>
            ) : null}

            {searchStatus === 'error' ? (
              <div
                className="mt-8 rounded-lg border border-red-300/60 bg-red-50/90 p-4 text-sm text-red-700 dark:border-red-400/40 dark:bg-red-500/10 dark:text-red-200"
                role="alert"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" />
                  Search unavailable
                </div>
                <p className="mt-1">{searchError || 'Please try again in a moment.'}</p>
              </div>
            ) : null}

            {searchStatus === 'success' && searchResults.length === 0 ? (
              <div className="mt-8 rounded-lg border border-black/15 p-4 text-sm text-black/70 dark:border-white/20 dark:text-white/75">
                No results for "{trimmedSearchQuery}". Try broader keywords.
              </div>
            ) : null}

            {searchStatus === 'success' && searchResults.length > 0 ? (
              <div className="mt-6 grid gap-3">
                {searchResults.map((result) => (
                  <Link
                    key={result.id}
                    to={result.href}
                    onClick={() => setIsSearchOpen(false)}
                    className="grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-lg border border-black/15 bg-white/60 p-2 transition-colors hover:border-black dark:border-white/20 dark:bg-white/5 dark:hover:border-white/40"
                  >
                    <img src={result.image} alt={result.title} className="h-[72px] w-[72px] rounded object-cover" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-black dark:text-white">{result.title}</p>
                      <p className="truncate text-xs text-black/60 dark:text-white/70">{result.subtitle}</p>
                    </div>
                    <span className="rounded border border-black/20 px-2 py-1 text-[10px] font-semibold tracking-[0.08em] text-black/75 dark:border-white/25 dark:text-white/80">
                      {result.typeLabel}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
