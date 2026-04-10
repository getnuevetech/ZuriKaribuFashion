import { Link, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { Menu, Moon, Search, ShoppingBag, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import JenksV2NewsletterFooter from '../components/JenksV2NewsletterFooter';
import { api, resolveAssetUrl } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { getHomeRouteForUser, normalizeRole } from '../auth/rbac';
import CustomerServiceChatWidgetBoundary from '../components/chat/CustomerServiceChatWidgetBoundary';
import CustomerServiceChatWidget from '../components/chat/CustomerServiceChatWidget';

type ThemeMode = 'LIGHT' | 'DARK';
type IconComponent = LucideIcon;

type MenuLinkMode = 'PAGE' | 'CUSTOM_URL';

const DEFAULT_HREF_BY_KEY: Record<string, string> = {
  HOME: '/',
  SHOP: '/Shop',
  READY_TO_WEAR: '/readytowear',
  FABRICS: '/fabricstobuy',
  FABRICS_TO_BUY: '/fabricstobuy',
  CUSTOM_TO_WEAR: '/customtowear',
  DESIGNERS: '/customtowear',
  ABOUT: '/about',
  CONTACT: '/contact',
  HELP_CENTER: '/help-center',
  COUNTRY_PRODUCTS: '/country-products',
  AUTH_LOGIN: '/auth/login',
};

const ICON_BY_KEY: Record<string, IconComponent> = {
  SUN: Sun,
  MOON: Moon,
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asString = (value: unknown, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const asBoolean = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const asNumber = (value: unknown, fallback: number) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const iconFromKey = (iconKey: unknown, fallback: IconComponent) => {
  const token = asString(iconKey, '').toUpperCase();
  if (!token) return fallback;
  return ICON_BY_KEY[token] || fallback;
};

const splitPathAndSuffix = (href: string) => {
  const marker = href.search(/[?#]/);
  if (marker < 0) return { path: href, suffix: '' };
  return {
    path: href.slice(0, marker),
    suffix: href.slice(marker),
  };
};

const sanitizeLegacyInternalHref = (href: string) => {
  const { path, suffix } = splitPathAndSuffix(href);
  let nextPath = path;
  if (/^\/main\/?$/i.test(nextPath)) nextPath = '/';
  if (/^\/shop\/?$/i.test(nextPath)) nextPath = '/Shop';
  if (/^\/ready-to-wear(\/.*)?$/i.test(nextPath)) nextPath = nextPath.replace(/^\/ready-to-wear/i, '/readytowear');
  if (/^\/custom(\/.*)?$/i.test(nextPath)) nextPath = nextPath.replace(/^\/custom/i, '/customtowear');
  if (/^\/cystomtowear(\/.*)?$/i.test(nextPath)) nextPath = nextPath.replace(/^\/cystomtowear/i, '/customtowear');
  if (/^\/fabrics(\/.*)?$/i.test(nextPath)) nextPath = nextPath.replace(/^\/fabrics/i, '/fabricstobuy');
  if (/^\/jenks-v14\/ready-to-wear(\/.*)?$/i.test(nextPath)) {
    nextPath = nextPath.replace(/^\/jenks-v14\/ready-to-wear/i, '/readytowear');
  }
  if (/^\/jenks-v14\/custom-to-wear(\/.*)?$/i.test(nextPath)) {
    nextPath = nextPath.replace(/^\/jenks-v14\/custom-to-wear/i, '/customtowear');
  }
  if (/^\/jenks-v14\/fabrics(\/.*)?$/i.test(nextPath)) {
    nextPath = nextPath.replace(/^\/jenks-v14\/fabrics/i, '/fabricstobuy');
  }
  return `${nextPath}${suffix}`;
};

const toSafeInternalHref = (href: string) => {
  const raw = String(href || '').trim();
  if (!raw) return '/';
  if (/^https?:\/\//i.test(raw)) return raw;
  const absolute = raw.startsWith('/') ? raw : `/${raw}`;
  return sanitizeLegacyInternalHref(absolute);
};

const normalizeHref = (value: unknown, fallback: string, routeKey?: unknown) => {
  const href = asString(value, '');
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('/')) return toSafeInternalHref(href);
  const routeToken = String(routeKey || '').trim().toUpperCase();
  if (routeToken && DEFAULT_HREF_BY_KEY[routeToken]) return toSafeInternalHref(DEFAULT_HREF_BY_KEY[routeToken]);
  return toSafeInternalHref(fallback);
};

const resolveConfiguredMenuHref = (
  entry: Record<string, unknown>,
  fallbackHref: string
) => {
  const hrefMode: MenuLinkMode = asString(entry.hrefMode, 'PAGE').toUpperCase() === 'CUSTOM_URL' ? 'CUSTOM_URL' : 'PAGE';
  if (hrefMode === 'CUSTOM_URL') {
    return toSafeInternalHref(normalizeHref(entry.customUrl, normalizeHref(entry.href, fallbackHref)));
  }
  const pageKey = asString(entry.pageKey, asString(entry.routeKey, '')).toUpperCase();
  const pageHref = pageKey && DEFAULT_HREF_BY_KEY[pageKey] ? DEFAULT_HREF_BY_KEY[pageKey] : normalizeHref(entry.href, fallbackHref);
  return toSafeInternalHref(pageHref);
};

export default function JenksV2MainLayout() {
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { getItemCount } = useCartStore();
  const [hamburgerOpen, setHamburgerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [topStripPaused, setTopStripPaused] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>('LIGHT');

  const { data: frontpageConfig } = useQuery({
    queryKey: ['jenksV2MainLayoutPublicConfig'],
    queryFn: async () => {
      const response = await api.jenksV2Frontpage.getPublicConfig();
      return response.success ? response.data : null;
    },
  });

  const userRole = normalizeRole(user?.role);
  const profileRoute = userRole === 'CUSTOMER' ? '/profile' : getHomeRouteForUser(user);
  const cartItemCount = getItemCount();
  const isProductRetailPath = /^\/(readytowear|customtowear|cystomtowear|fabricstobuy)\/[^/]+$/i.test(location.pathname);
  const showFloatingCheckout = isProductRetailPath && cartItemCount > 0;

  const topNavigationsCfg = useMemo(() => asRecord(asRecord(frontpageConfig).topNavigations), [frontpageConfig]);
  const logoCfg = useMemo(() => asRecord(topNavigationsCfg.logo), [topNavigationsCfg.logo]);
  const logoTextRaw = asString(logoCfg.text, 'ZURIKARIBU');
  const logoTextSplit = useMemo(() => {
    const compact = logoTextRaw.replace(/\s+/g, '').trim();
    if (!compact) return { left: 'ZURI', right: 'KARIBU' };
    const upper = compact.toUpperCase();
    if (upper.startsWith('ZURI') && compact.length > 4) {
      return {
        left: compact.slice(0, 4),
        right: compact.slice(4),
      };
    }
    const pivot = Math.max(1, Math.ceil(compact.length / 2));
    return {
      left: compact.slice(0, pivot),
      right: compact.slice(pivot),
    };
  }, [logoTextRaw]);
  const headerLogoFontWeight = Math.max(100, Math.min(900, Math.round(asNumber(logoCfg.fontWeight, 700))));
  const themeCfg = useMemo(() => asRecord(asRecord(topNavigationsCfg.controllers).theme), [topNavigationsCfg.controllers]);
  const ThemeIcon = iconFromKey(themeCfg.icon, Sun);
  const ComputedThemeIcon = themeMode === 'DARK' ? Moon : ThemeIcon;

  const hamburgerMenuLinks = useMemo(
    () =>
      asArray(topNavigationsCfg.hamburgerMenu)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry) => ({
          label: asString(entry.label, 'Menu'),
          href: resolveConfiguredMenuHref(entry, '/'),
        })),
    [topNavigationsCfg.hamburgerMenu]
  );

  const additionalTopMenuLinks = useMemo(
    () =>
      asArray(topNavigationsCfg.additionalTopMenu)
        .map((entry) => asRecord(entry))
        .filter((entry) => asBoolean(entry.enabled, true))
        .map((entry) => ({
          label: asString(entry.label, 'Link'),
          href: resolveConfiguredMenuHref(entry, '/'),
        })),
    [topNavigationsCfg.additionalTopMenu]
  );

  const signInCfg = useMemo(() => asRecord(topNavigationsCfg.signInMenu), [topNavigationsCfg.signInMenu]);

  const topStripCfg = useMemo(() => asRecord(topNavigationsCfg.topStripConfig), [topNavigationsCfg.topStripConfig]);
  const topStripSeparator = asString(topStripCfg.separator, '•');
  const topStripItems = useMemo(() => {
    const messages = asArray(topStripCfg.messages)
      .map((entry) => asString(entry, ''))
      .filter(Boolean);
    const content = messages.length > 0 ? messages : ['Free shipping on orders over $1960', 'New arrivals weekly', 'Authentic African designs'];
    const repeatCount = Math.max(1, Math.min(20, Math.round(asNumber(topStripCfg.repeatCount, 4))));
    const rows: string[] = [];
    for (let i = 0; i < repeatCount; i += 1) {
      rows.push(...content);
    }
    return rows;
  }, [topStripCfg.messages, topStripCfg.repeatCount]);
  const topStripAnimationSeconds = Math.max(12, Math.min(180, Math.round(asNumber(topStripCfg.animationSeconds, 36))));
  const topStripPauseOnHover = asBoolean(topStripCfg.pauseOnHover, true);
  const topStripFontSize = Math.max(8, Math.min(22, Math.round(asNumber(topStripCfg.fontSize, 11))));
  const topStripIsBold = asBoolean(topStripCfg.isBold, true);
  const topStripTextColor = asString(topStripCfg.textColor, '#ffffff');
  const topStripBackgroundColor = asString(topStripCfg.backgroundColor, '#111111');
  const showTopStrip = asBoolean(topNavigationsCfg.topStripEnabled, true);

  const hamburgerMenuFontSize = Math.max(16, Math.min(72, Math.round(asNumber(topNavigationsCfg.hamburgerMenuFontSize, 32))));
  const hamburgerMenuFontWeight = Math.max(500, Math.min(900, Math.round(asNumber(topNavigationsCfg.hamburgerMenuFontWeight, 800))));

  useEffect(() => {
    const token = asString(themeCfg.mode, 'LIGHT').toUpperCase();
    if (token === 'LIGHT' || token === 'DARK') {
      setThemeMode(token as ThemeMode);
      return;
    }
    if (typeof window === 'undefined') return;
    try {
      const prefersDark =
        typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
      setThemeMode(prefersDark ? 'DARK' : 'LIGHT');
    } catch {
      setThemeMode('LIGHT');
    }
  }, [themeCfg.mode]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.toggle('dark', themeMode === 'DARK');
    document.body.style.backgroundColor = themeMode === 'DARK' ? '#111111' : '#f5f3ee';
    document.body.style.color = themeMode === 'DARK' ? '#f5f3ee' : '#111111';
    return () => {
      document.body.style.backgroundColor = '';
      document.body.style.color = '';
    };
  }, [themeMode]);

  useEffect(() => {
    setHamburgerOpen(false);
    setSearchOpen(false);
    setSearchQuery('');
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const styleId = 'jenks-topstrip-marquee-keyframes-layout';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @keyframes jenksTopStripMarqueeLayout {
        0% { transform: translateX(100%); }
        100% { transform: translateX(-100%); }
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <div className="kimi-site flex min-h-screen flex-col bg-[#f5f3ee] text-[#111]">
      <div className="sticky top-0 z-50">
        {showTopStrip ? (
          <div
            className="group relative h-8 overflow-hidden uppercase tracking-[0.18em]"
            style={{
              backgroundColor: topStripBackgroundColor,
              color: topStripTextColor,
              fontSize: `${topStripFontSize}px`,
              fontWeight: topStripIsBold ? 700 : 500,
            }}
            onMouseEnter={() => setTopStripPaused(true)}
            onMouseLeave={() => setTopStripPaused(false)}
          >
            <div
              className="absolute inset-y-0 left-0 flex items-center whitespace-nowrap px-4"
              style={{
                animationName: 'jenksTopStripMarqueeLayout',
                animationDuration: `${topStripAnimationSeconds}s`,
                animationTimingFunction: 'linear',
                animationIterationCount: 'infinite',
                animationPlayState: topStripPauseOnHover && topStripPaused ? 'paused' : 'running',
                minWidth: 'max-content',
              }}
            >
              {topStripItems.map((item, idx) => (
                <span key={`${item}-${idx}`} className="mx-6">
                  {idx > 0 ? `${topStripSeparator} ${item}` : item}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        <header className="h-14 border-b border-black/10 bg-[#f5f3ee]/95 backdrop-blur">
          <div className="relative mx-auto flex h-full w-full max-w-[1700px] items-center justify-between px-4 sm:px-6 lg:px-12">
            <div className="flex items-center gap-3 text-black/75">
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black text-white shadow-sm transition-colors hover:bg-[#e66045]"
                aria-label="Open menu"
                onClick={() => setHamburgerOpen(true)}
              >
                <Menu className="h-5 w-5 stroke-[2.75]" />
              </button>
              {asBoolean(topNavigationsCfg.searchIconEnabled, true) ? (
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/20 hover:bg-black/5"
                  aria-label="Search"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <Link to="/" className="absolute left-1/2 -translate-x-1/2">
              {asString(logoCfg.mode, 'TEXT').toUpperCase() === 'IMAGE' && asString(logoCfg.imageUrl, '') ? (
                <img
                  src={resolveAssetUrl(asString(logoCfg.imageUrl, '')) || asString(logoCfg.imageUrl, '')}
                  alt={asString(logoCfg.altText, 'Jenks')}
                  className="object-contain"
                  style={{
                    width: Math.max(80, Math.round(asNumber(logoCfg.width, 180))),
                    height: Math.max(24, Math.round(asNumber(logoCfg.height, 50))),
                  }}
                />
              ) : (
                <p
                  className="font-['Oswald'] uppercase leading-none tracking-[0.08em]"
                  style={{
                    color: asString(logoCfg.textColor, '#111111'),
                    fontFamily: asString(logoCfg.fontFamily, 'Oswald'),
                    fontSize: Math.max(18, Math.round(asNumber(logoCfg.fontSize, 27))),
                    fontWeight: headerLogoFontWeight,
                  }}
                >
                  <span>{logoTextSplit.left}</span>
                  <span className="text-[#e66045]">{logoTextSplit.right}</span>
                </p>
              )}
            </Link>

            <div className="flex items-center gap-3 text-black/75">
              <div className="hidden items-center gap-6 text-xs font-semibold uppercase tracking-[0.12em] text-black/75 md:flex">
                {(additionalTopMenuLinks.length > 0
                  ? additionalTopMenuLinks
                  : [
                      { label: 'About Us', href: '/about' },
                      { label: 'Contact Us', href: '/contact' },
                    ]
                ).map((link) => (
                  <Link key={`${link.label}-${link.href}`} to={toSafeInternalHref(link.href)} className="hover:text-black">
                    {link.label}
                  </Link>
                ))}
              </div>

              {asBoolean(themeCfg.enabled, true) ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/20"
                  aria-label="Toggle theme"
                  onClick={() => setThemeMode((prev) => (prev === 'LIGHT' ? 'DARK' : 'LIGHT'))}
                >
                  <ComputedThemeIcon className="h-4 w-4 text-[#e66045]" />
                </button>
              ) : null}

              <Link
                to="/cart"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5"
                aria-label="Cart"
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="absolute right-0 top-0 h-3.5 min-w-3.5 rounded-full bg-[#e66045] px-1 text-[9px] font-semibold leading-[14px] text-white">
                  {cartItemCount}
                </span>
              </Link>

              {asBoolean(signInCfg.enabled, true) ? (
                <Link
                  to={isAuthenticated ? profileRoute : resolveConfiguredMenuHref(signInCfg, '/auth/login')}
                  className="hidden text-xs font-semibold uppercase tracking-[0.12em] hover:text-black sm:inline"
                >
                  {isAuthenticated ? 'Dashboard' : asString(signInCfg.label, 'Sign In')}
                </Link>
              ) : null}
            </div>
          </div>
        </header>

        {searchOpen ? (
          <div className="fixed inset-0 z-[69]">
            <button
              type="button"
              aria-label="Close search overlay"
              className="absolute inset-0 h-full w-full bg-white/40 backdrop-blur-[1px]"
              onClick={() => setSearchOpen(false)}
            />
            <div className="absolute left-1/2 top-16 w-[94vw] max-w-[860px] -translate-x-1/2 rounded-xl border border-black/10 bg-white/88 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur sm:p-5">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-black/60" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search products, categories, countries..."
                  className="h-10 w-full bg-transparent text-sm text-black placeholder:text-black/45 focus:outline-none"
                />
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-black/20 text-black/70 hover:bg-black/5"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                  }}
                  aria-label="Close search"
                >
                  ×
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                {['Ready To Wear', 'Custom To Wear', 'Fabrics', 'Shop By Country'].map((suggestion) => (
                  <Link
                    key={suggestion}
                    to={toSafeInternalHref(
                      suggestion === 'Ready To Wear'
                        ? '/readytowear'
                        : suggestion === 'Custom To Wear'
                          ? '/customtowear'
                          : suggestion === 'Fabrics'
                            ? '/fabricstobuy'
                            : '/country-products'
                    )}
                    onClick={() => setSearchOpen(false)}
                    className="rounded border border-black/20 px-2.5 py-1 text-black/75 hover:border-[#e66045] hover:text-[#e66045]"
                  >
                    {suggestion}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {hamburgerOpen ? (
          <div className="fixed inset-0 z-[70]">
            <button
              type="button"
              aria-label="Close menu overlay"
              className="absolute inset-0 h-full w-full bg-black/60"
              onClick={() => setHamburgerOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-[98vw] max-w-[760px] overflow-y-auto bg-black/96 shadow-none">
              <button
                type="button"
                className="absolute left-4 top-8 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
                aria-label="Close menu"
                onClick={() => setHamburgerOpen(false)}
              >
                <span className="text-xl leading-none">×</span>
              </button>
              <nav className="flex h-full w-full items-start overflow-y-auto px-6 pt-20 sm:px-8">
                <div className="w-full space-y-2 pb-8">
                  {(hamburgerMenuLinks.length > 0
                    ? hamburgerMenuLinks
                    : [
                        { label: 'Home', href: '/' },
                        { label: 'Shop', href: '/readytowear' },
                        { label: 'Ready To Wear', href: '/readytowear' },
                        { label: 'Fabrics To Buy', href: '/fabricstobuy' },
                        { label: 'Custom To Wear', href: '/customtowear' },
                        { label: 'About Us', href: '/about' },
                        { label: 'Contact Us', href: '/contact' },
                      ]
                  ).map((link) => (
                    <Link
                      key={`${link.label}-${link.href}`}
                      to={toSafeInternalHref(link.href)}
                      className="block whitespace-nowrap px-4 py-3 font-['Oswald'] uppercase leading-none tracking-[0.01em] text-white transition-colors hover:text-[#e66045]"
                      style={{
                        fontSize: `${hamburgerMenuFontSize}px`,
                        fontWeight: hamburgerMenuFontWeight,
                      }}
                      onClick={() => setHamburgerOpen(false)}
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className="pt-6 text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
                    Made by Africans. Worn by the world.
                  </p>
                </div>
              </nav>
            </div>
          </div>
        ) : null}
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
      <JenksV2NewsletterFooter config={asRecord(frontpageConfig)} />
    </div>
  );
}
