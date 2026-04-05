import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type VisibilityMap = Record<string, boolean>;

type OptionLink = {
  label: string;
  href: string;
};

type RouteOption = {
  key: string;
  label: string;
  href: string;
};

type NavLink = {
  label: string;
  href: string;
  routeKey?: string;
  enabled: boolean;
};

type HeroBanner = {
  id: string;
  enabled: boolean;
  displayOrder: number;
  image: string;
  eyebrow: string;
  badge: string;
  title: string;
  text: string;
  subtitle: string;
  description: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
};

type TrustBadge = {
  title: string;
  subtitle: string;
  icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
  titleColor?: string;
  subtitleColor?: string;
  iconColor?: string;
  cardBackgroundColor?: string;
  cardBorderColor?: string;
  titleFontSize?: number;
  subtitleFontSize?: number;
  iconSize?: number;
  maxTitleWords?: number;
  maxSubtitleWords?: number;
  enabled: boolean;
};

type TrustBadgeStyle = {
  sectionTitle: string;
  sectionSubtitle: string;
  layoutColumns: number;
  arrangement: 'GRID' | 'ROW';
  titleColor: string;
  subtitleColor: string;
  iconColor: string;
  cardBackgroundColor: string;
  cardBorderColor: string;
  titleFontSize: number;
  subtitleFontSize: number;
  iconSize: number;
  maxTitleWords: number;
  maxSubtitleWords: number;
};

type JenksHomepageConfig = {
  contractVersion: string;
  sections: {
    visibility: VisibilityMap;
  };
  topStrip: {
    messages: string[];
    separator: string;
    repeatCount: number;
    animationSeconds: number;
    fontSize: number;
    isBold: boolean;
    pauseOnHover: boolean;
    textColor: string;
    backgroundColor: string;
  };
  experience: {
    enabledModes: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
    defaultMode: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
    allowUserModeOverride: boolean;
    adaptiveByDevice: boolean;
    adaptiveByConnection: boolean;
    respectReducedMotion: boolean;
    themeModes: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
    defaultThemeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
    tokenSet: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
    heroVariant: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
    categoryEntryVariant: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
    spotlightVariant: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
    homepageTemplate: 'LEGACY' | 'JENKS';
    rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
    allowPreviewQuery: boolean;
    previewQueryParam: string;
    legacyHomepageEnabled: boolean;
    requireReasonForRuntimeActions: boolean;
    trustBadges: TrustBadge[];
    trustBadgeStyle: TrustBadgeStyle;
    jenksCopy: {
      heroEyebrow: string;
      shopByEyebrow: string;
      shopByTitle: string;
      featuredRtwTitle: string;
      featuredFabricsTitle: string;
      featuredDesignsTitle: string;
      designerSpotlightTitle: string;
      quickPathRtwLabel: string;
      quickPathCustomLabel: string;
      quickPathFabricsLabel: string;
    };
  };
  navigation: {
    logoMode: 'TEXT' | 'IMAGE';
    logoText: string;
    logoImageUrl: string;
    logoAltText: string;
    logoWidth: number;
    logoHeight: number;
    leftMenuLinks: NavLink[];
    rightMenuLinks: NavLink[];
    hamburgerMenuLinks: NavLink[];
    showHamburger: boolean;
    showSearchIcon: boolean;
    showCartIcon: boolean;
    showProfileIcon: boolean;
    showCurrencySelector: boolean;
    showExperienceModeSelector: boolean;
    showThemeModeSelector: boolean;
  };
  hero: {
    rotationSeconds: number;
    forceUppercaseCtas: boolean;
    ctaTarget: 'SAME_TAB' | 'NEW_TAB';
    showQuickLinks: boolean;
    quickLinks: OptionLink[];
    banners: HeroBanner[];
  };
  shopByBlocks: {
    title: string;
    subtitle: string;
    styleOptions: OptionLink[];
    priceOptions: OptionLink[];
    enabledTabs: Array<'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE'>;
    defaultTab: 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
  };
  freshDrops: {
    eyebrow: string;
    title: string;
    subtitle: string;
    ctaText: string;
    ctaLink: string;
    badgeValueText: string;
    badgeLabelText: string;
    showBadge: boolean;
  };
  newsletter: {
    enabled: boolean;
    title: string;
    subtitle: string;
    emailPlaceholder: string;
    submitLabel: string;
    successMessage: string;
    duplicateMessage: string;
  };
  cta: {
    enabled: boolean;
    title: string;
    subtitle: string;
    primaryCtaText: string;
    primaryCtaLink: string;
    secondaryCtaText: string;
    secondaryCtaLink: string;
    backgroundImage: string;
  };
  source?: 'DATABASE' | 'DEFAULT';
  updatedAt?: string | null;
};

const TRUST_BADGE_ICONS = ['SHIELD_CHECK', 'TRUCK', 'REFRESH_CW', 'HEADPHONES', 'GLOBE', 'SHOPPING_BAG'] as const;

const ROUTE_OPTIONS: RouteOption[] = [
  { key: 'HOME', label: 'Home', href: '/' },
  { key: 'SHOP', label: 'Shop', href: '/ready-to-wear' },
  { key: 'READY_TO_WEAR', label: 'Ready To Wear', href: '/ready-to-wear' },
  { key: 'FABRICS', label: 'Fabrics', href: '/fabrics' },
  { key: 'CUSTOM_TO_WEAR', label: 'Custom To Wear', href: '/custom' },
  { key: 'CONTACT', label: 'Contact', href: '/contact' },
  { key: 'ABOUT', label: 'About (Home anchor)', href: '/home#about' },
  { key: 'HELP_CENTER', label: 'Help Center', href: '/help-center' },
  { key: 'AUTH_LOGIN', label: 'Login', href: '/auth/login' },
  { key: 'AUTH_REGISTER', label: 'Register', href: '/auth/register' },
  { key: 'DASHBOARD', label: 'Customer Dashboard', href: '/dashboard' },
  { key: 'ORDERS', label: 'Orders', href: '/orders' },
  { key: 'CART', label: 'Cart', href: '/cart' },
  { key: 'CHECKOUT', label: 'Checkout', href: '/checkout' },
];

const VISIBILITY_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'topStrip', label: 'Top Strip' },
  { key: 'hero', label: 'Hero' },
  { key: 'statsStrip', label: 'Stats Strip' },
  { key: 'countries', label: 'Countries' },
  { key: 'categories', label: 'Categories' },
  { key: 'howItWorks', label: 'How It Works' },
  { key: 'featuredCustomToWear', label: 'Featured Custom To Wear' },
  { key: 'featuredReadyToWear', label: 'Featured Ready To Wear' },
  { key: 'featuredFabrics', label: 'Featured Fabrics' },
  { key: 'promoBanner', label: 'Promo Banner' },
  { key: 'designerSpotlight', label: 'Designer Spotlight' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'testimonials', label: 'Testimonials' },
  { key: 'cta', label: 'CTA + Newsletter' },
];

const newHeroBanner = (index: number): HeroBanner => ({
  id: `hero-banner-${Date.now()}-${index}`,
  enabled: true,
  displayOrder: index,
  image: '',
  eyebrow: 'Editorial premium',
  badge: '',
  title: 'New Hero Banner',
  text: '',
  subtitle: '',
  description: '',
  primaryCtaText: 'SHOP NOW',
  primaryCtaLink: '/ready-to-wear',
  secondaryCtaText: '',
  secondaryCtaLink: '/custom',
});

const DEFAULT_CONFIG: JenksHomepageConfig = {
  contractVersion: 'JENKS_HOMEPAGE_CONFIG_V1',
  sections: {
    visibility: VISIBILITY_FIELDS.reduce<VisibilityMap>((acc, item) => {
      acc[item.key] = true;
      return acc;
    }, {}),
  },
  topStrip: {
    messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
    separator: '•',
    repeatCount: 4,
    animationSeconds: 20,
    fontSize: 12,
    isBold: false,
    pauseOnHover: true,
    textColor: '#ffffff',
    backgroundColor: '#000000',
  },
  experience: {
    enabledModes: ['LITE_COMMERCE', 'STANDARD_PREMIUM', 'EDITORIAL_IMMERSIVE'],
    defaultMode: 'EDITORIAL_IMMERSIVE',
    allowUserModeOverride: true,
    adaptiveByDevice: false,
    adaptiveByConnection: false,
    respectReducedMotion: true,
    themeModes: ['SYSTEM', 'LIGHT', 'DARK'],
    defaultThemeMode: 'SYSTEM',
    tokenSet: 'GLOBAL_PREMIUM_DARK',
    heroVariant: 'SPLIT_EDITORIAL',
    categoryEntryVariant: 'THREE_COLUMN_CORE',
    spotlightVariant: 'CAROUSEL',
    homepageTemplate: 'JENKS',
    rolloutMode: 'PREVIEW_SAFE',
    allowPreviewQuery: true,
    previewQueryParam: 'zkHomePreview',
    legacyHomepageEnabled: false,
    requireReasonForRuntimeActions: false,
    trustBadges: [
      { icon: 'SHIELD_CHECK', title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers', enabled: true },
      { icon: 'TRUCK', title: 'Global Shipping', subtitle: 'Reliable delivery worldwide', enabled: true },
      { icon: 'REFRESH_CW', title: 'Easy Returns', subtitle: 'Simple returns on eligible orders', enabled: true },
      { icon: 'HEADPHONES', title: '24/7 Support', subtitle: 'Chat and ticket support anytime', enabled: true },
    ],
    trustBadgeStyle: {
      sectionTitle: 'Why shoppers trust us',
      sectionSubtitle: 'Reliability, service, and quality built into every order.',
      layoutColumns: 4,
      arrangement: 'GRID',
      titleColor: '#0f172a',
      subtitleColor: '#475569',
      iconColor: '#0f172a',
      cardBackgroundColor: '#ffffff',
      cardBorderColor: '#e2e8f0',
      titleFontSize: 18,
      subtitleFontSize: 14,
      iconSize: 20,
      maxTitleWords: 4,
      maxSubtitleWords: 10,
    },
    jenksCopy: {
      heroEyebrow: 'Editorial premium',
      shopByEyebrow: 'Discover',
      shopByTitle: 'Shop by',
      featuredRtwTitle: 'Featured Ready to Wear',
      featuredFabricsTitle: 'Featured Fabrics',
      featuredDesignsTitle: 'Featured Custom Designs',
      designerSpotlightTitle: 'Designer Spotlight',
      quickPathRtwLabel: 'Ready to Wear',
      quickPathCustomLabel: 'Custom',
      quickPathFabricsLabel: 'Fabrics',
    },
  },
  navigation: {
    logoMode: 'TEXT',
    logoText: 'ZURIKARIBU',
    logoImageUrl: '',
    logoAltText: 'ZuriKaribu',
    logoWidth: 180,
    logoHeight: 48,
    leftMenuLinks: [
      { label: 'Home', href: '/', routeKey: 'HOME', enabled: true },
      { label: 'Ready To Wear', href: '/ready-to-wear', routeKey: 'READY_TO_WEAR', enabled: true },
      { label: 'Fabric To Buy', href: '/fabrics', routeKey: 'FABRICS', enabled: true },
      { label: 'Custom To Wear', href: '/custom', routeKey: 'CUSTOM_TO_WEAR', enabled: true },
    ],
    rightMenuLinks: [
      { label: 'Shop', href: '/ready-to-wear', routeKey: 'READY_TO_WEAR', enabled: true },
      { label: 'About Us', href: '/home#about', routeKey: 'ABOUT', enabled: true },
      { label: 'Contact Us', href: '/contact', routeKey: 'CONTACT', enabled: true },
    ],
    hamburgerMenuLinks: [
      { label: 'Home', href: '/', routeKey: 'HOME', enabled: true },
      { label: 'Shop', href: '/ready-to-wear', routeKey: 'READY_TO_WEAR', enabled: true },
      { label: 'Ready To Wear', href: '/ready-to-wear', routeKey: 'READY_TO_WEAR', enabled: true },
      { label: 'Fabric To Buy', href: '/fabrics', routeKey: 'FABRICS', enabled: true },
      { label: 'Custom To Wear', href: '/custom', routeKey: 'CUSTOM_TO_WEAR', enabled: true },
      { label: 'About Us', href: '/home#about', routeKey: 'ABOUT', enabled: true },
      { label: 'Contact Us', href: '/contact', routeKey: 'CONTACT', enabled: true },
    ],
    showHamburger: true,
    showSearchIcon: true,
    showCartIcon: true,
    showProfileIcon: true,
    showCurrencySelector: true,
    showExperienceModeSelector: true,
    showThemeModeSelector: true,
  },
  hero: {
    rotationSeconds: 6,
    forceUppercaseCtas: true,
    ctaTarget: 'SAME_TAB',
    showQuickLinks: true,
    quickLinks: [
      { label: 'Ready to Wear', href: '/ready-to-wear' },
      { label: 'Custom', href: '/custom' },
      { label: 'Fabrics', href: '/fabrics' },
    ],
    banners: [newHeroBanner(0)],
  },
  shopByBlocks: {
    title: 'Shop by Category',
    subtitle: 'Choose what fits your moment.',
    styleOptions: [],
    priceOptions: [],
    enabledTabs: ['CATEGORY', 'COUNTRY', 'OCCASION_STYLE', 'PRICE'],
    defaultTab: 'CATEGORY',
  },
  freshDrops: {
    eyebrow: 'FRESH DROPS',
    title: 'New arrivals from top designers',
    subtitle: 'Curated highlights from across the continent.',
    ctaText: 'SHOP NEW ARRIVALS',
    ctaLink: '/ready-to-wear',
    badgeValueText: '50+',
    badgeLabelText: 'New Arrivals',
    showBadge: true,
  },
  newsletter: {
    enabled: true,
    title: 'Join the Movement',
    subtitle: 'Subscribe for exclusive offers and stories.',
    emailPlaceholder: 'Enter your email',
    submitLabel: 'SUBSCRIBE',
    successMessage: 'You are subscribed. We will keep you updated.',
    duplicateMessage: 'You are already subscribed to our newsletter.',
  },
  cta: {
    enabled: true,
    title: 'Ready to Wear African Fashion?',
    subtitle: 'Join our community and discover unique pieces from talented African designers.',
    primaryCtaText: 'SHOP NOW',
    primaryCtaLink: '/ready-to-wear',
    secondaryCtaText: 'CREATE ACCOUNT',
    secondaryCtaLink: '/auth/register',
    backgroundImage: '',
  },
};

const parseOptions = (value: string): OptionLink[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelRaw, hrefRaw] = line.split('|').map((part) => part.trim());
      if (!labelRaw || !hrefRaw) return null;
      return { label: labelRaw, href: hrefRaw };
    })
    .filter((row): row is OptionLink => Boolean(row))
    .slice(0, 20);

const formatOptions = (rows: OptionLink[]) => rows.map((row) => `${row.label} | ${row.href}`).join('\n');

const parseNavLinks = (value: string): NavLink[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [labelRaw, hrefRaw, routeKeyRaw, enabledRaw] = line.split('|').map((part) => part.trim());
      if (!labelRaw || !hrefRaw) return null;
      const enabledToken = String(enabledRaw || 'true').toLowerCase();
      const enabled = !['false', '0', 'off', 'no'].includes(enabledToken);
      return { label: labelRaw, href: hrefRaw, routeKey: routeKeyRaw || undefined, enabled };
    })
    .filter((row): row is NavLink => Boolean(row))
    .slice(0, 20);

const formatNavLinks = (rows: NavLink[]) =>
  rows.map((row) => `${row.label} | ${row.href} | ${row.routeKey || ''} | ${row.enabled}`).join('\n');

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isValidHexColor = (value: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(String(value || '').trim());

const normalizeColorOrDefault = (value: string, fallback: string) => (isValidHexColor(value) ? value.trim() : fallback);

export default function AdminJenksHomepageManage() {
  const [config, setConfig] = useState<JenksHomepageConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'cta' | 'hero' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedHamburgerRouteKey, setSelectedHamburgerRouteKey] = useState<string>(ROUTE_OPTIONS[0]?.key || 'HOME');
  const [selectedHeroBannerIndexForUpload, setSelectedHeroBannerIndexForUpload] = useState<number | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const ctaBgInputRef = useRef<HTMLInputElement | null>(null);
  const heroBannerInputRef = useRef<HTMLInputElement | null>(null);

  const updatedAtLabel = useMemo(() => {
    if (!config.updatedAt) return 'Never';
    const parsed = new Date(config.updatedAt);
    if (Number.isNaN(parsed.getTime())) return 'Never';
    return parsed.toLocaleString();
  }, [config.updatedAt]);

  const fetchConfig = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.homepageSections.getAdminJenksHomepageConfig();
      if (!response.success || !response.data) throw new Error('Failed to load Jenks homepage config.');
      setConfig((prev) => ({ ...prev, ...response.data }));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load Jenks homepage config.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchConfig();
  }, []);

  const uploadImage = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append('image', file);
    const response = await api.upload.image(formData);
    if (response.success && response.data?.url) return String(response.data.url);
    return null;
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading('logo');
    setError('');
    setSuccess('');
    try {
      const url = await uploadImage(file);
      if (!url) throw new Error('Upload failed');
      setConfig((prev) => ({
        ...prev,
        navigation: { ...prev.navigation, logoImageUrl: url, logoMode: 'IMAGE' },
      }));
      setSuccess('Logo image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload logo image.');
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const handleCtaBackgroundUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading('cta');
    setError('');
    setSuccess('');
    try {
      const url = await uploadImage(file);
      if (!url) throw new Error('Upload failed');
      setConfig((prev) => ({ ...prev, cta: { ...prev.cta, backgroundImage: url } }));
      setSuccess('CTA background image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload CTA background image.');
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const openHeroBannerImageUpload = (index: number) => {
    setSelectedHeroBannerIndexForUpload(index);
    heroBannerInputRef.current?.click();
  };

  const handleHeroBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || selectedHeroBannerIndexForUpload === null) return;
    setUploading('hero');
    setError('');
    setSuccess('');
    try {
      const url = await uploadImage(file);
      if (!url) throw new Error('Upload failed');
      setConfig((prev) => ({
        ...prev,
        hero: {
          ...prev.hero,
          banners: prev.hero.banners.map((item, index) =>
            index === selectedHeroBannerIndexForUpload ? { ...item, image: url } : item
          ),
        },
      }));
      setSuccess('Hero banner image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload hero banner image.');
    } finally {
      setUploading(null);
      setSelectedHeroBannerIndexForUpload(null);
      event.target.value = '';
    }
  };

  const addHamburgerMenuItem = () => {
    const route = ROUTE_OPTIONS.find((item) => item.key === selectedHamburgerRouteKey);
    if (!route) return;
    setConfig((prev) => ({
      ...prev,
      navigation: {
        ...prev.navigation,
        hamburgerMenuLinks: [...prev.navigation.hamburgerMenuLinks, { label: route.label, href: route.href, routeKey: route.key, enabled: true }]
          .slice(0, 20),
      },
    }));
  };

  const saveConfig = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const normalizedExperience = {
        ...config.experience,
        trustBadges: (config.experience.trustBadges || []).map((badge) => {
          const nextBadge: TrustBadge = {
            ...badge,
            title: String(badge.title || '').slice(0, 48),
            subtitle: String(badge.subtitle || '').slice(0, 90),
            enabled: badge.enabled !== false,
          };
          if (!nextBadge.titleColor || !isValidHexColor(nextBadge.titleColor)) delete nextBadge.titleColor;
          if (!nextBadge.subtitleColor || !isValidHexColor(nextBadge.subtitleColor)) delete nextBadge.subtitleColor;
          if (!nextBadge.iconColor || !isValidHexColor(nextBadge.iconColor)) delete nextBadge.iconColor;
          if (!nextBadge.cardBackgroundColor || !isValidHexColor(nextBadge.cardBackgroundColor)) delete nextBadge.cardBackgroundColor;
          if (!nextBadge.cardBorderColor || !isValidHexColor(nextBadge.cardBorderColor)) delete nextBadge.cardBorderColor;
          return nextBadge;
        }),
        trustBadgeStyle: {
          ...config.experience.trustBadgeStyle,
          titleColor: normalizeColorOrDefault(
            config.experience.trustBadgeStyle.titleColor,
            DEFAULT_CONFIG.experience.trustBadgeStyle.titleColor
          ),
          subtitleColor: normalizeColorOrDefault(
            config.experience.trustBadgeStyle.subtitleColor,
            DEFAULT_CONFIG.experience.trustBadgeStyle.subtitleColor
          ),
          iconColor: normalizeColorOrDefault(
            config.experience.trustBadgeStyle.iconColor,
            DEFAULT_CONFIG.experience.trustBadgeStyle.iconColor
          ),
          cardBackgroundColor: normalizeColorOrDefault(
            config.experience.trustBadgeStyle.cardBackgroundColor,
            DEFAULT_CONFIG.experience.trustBadgeStyle.cardBackgroundColor
          ),
          cardBorderColor: normalizeColorOrDefault(
            config.experience.trustBadgeStyle.cardBorderColor,
            DEFAULT_CONFIG.experience.trustBadgeStyle.cardBorderColor
          ),
        },
      };
      const payload = {
        sections: { visibility: config.sections.visibility },
        topStrip: config.topStrip,
        experience: normalizedExperience,
        navigation: config.navigation,
        hero: config.hero,
        shopByBlocks: config.shopByBlocks,
        freshDrops: config.freshDrops,
        newsletter: config.newsletter,
        cta: config.cta,
      };
      const response = await api.homepageSections.updateAdminJenksHomepageConfig(payload);
      if (!response.success) throw new Error('Failed to save config');
      setConfig((prev) => ({ ...prev, ...(response.data || {}) }));
      setSuccess('Jenks homepage config saved successfully.');
      await fetchConfig();
    } catch (saveError: any) {
      const issues = saveError?.response?.data?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0];
        const path = Array.isArray(first?.path) ? first.path.join('.') : '';
        const message = String(first?.message || 'Validation failed');
        setError(path ? `Validation failed at "${path}": ${message}` : `Validation failed: ${message}`);
      } else {
        setError(saveError?.response?.data?.message || saveError?.message || 'Failed to save config.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Jenks homepage config…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Jenks Homepage Config</h1>
          <p className="text-sm text-gray-600">Native homepage text, image, and UX controls tailored to Jenks.</p>
          <p className="mt-1 text-xs text-gray-500">
            Contract: {config.contractVersion} • Source: {config.source || 'DEFAULT'} • Updated: {updatedAtLabel}
          </p>
        </div>
        <Button onClick={() => void saveConfig()} isLoading={saving}>
          Save Jenks Config
        </Button>
      </div>

      {error ? <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      {success ? (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{success}</div>
      ) : null}

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Navigation/Head</h2>
        <p className="text-xs text-gray-600">
          Manage logo settings and hamburger links. Add links by selecting a system page from dropdown.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            Logo Mode
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.navigation.logoMode}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, navigation: { ...prev.navigation, logoMode: event.target.value as 'TEXT' | 'IMAGE' } }))
              }
            >
              <option value="TEXT">TEXT</option>
              <option value="IMAGE">IMAGE</option>
            </select>
          </label>
          <label className="text-sm">
            Logo Text
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.navigation.logoText}
              onChange={(event) => setConfig((prev) => ({ ...prev, navigation: { ...prev.navigation, logoText: event.target.value } }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => logoInputRef.current?.click()} isLoading={uploading === 'logo'}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Logo Image
          </Button>
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          <span className="text-xs text-gray-600 break-all">{config.navigation.logoImageUrl || 'No logo image uploaded'}</span>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Hamburger Menu Manager</h3>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <label className="text-sm flex-1">
              System Page
              <select
                className="mt-1 w-full rounded border px-3 py-2"
                value={selectedHamburgerRouteKey}
                onChange={(event) => setSelectedHamburgerRouteKey(event.target.value)}
              >
                {ROUTE_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label} ({option.href})
                  </option>
                ))}
              </select>
            </label>
            <Button type="button" onClick={addHamburgerMenuItem}>
              <Plus className="mr-2 h-4 w-4" />
              Add Menu Item
            </Button>
          </div>
          <div className="space-y-3">
            {config.navigation.hamburgerMenuLinks.map((link, index) => (
              <div key={`${link.label}-${index}`} className="grid grid-cols-1 gap-3 rounded border p-3 md:grid-cols-12">
                <label className="text-xs md:col-span-3">
                  Label
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={link.label}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        navigation: {
                          ...prev.navigation,
                          hamburgerMenuLinks: prev.navigation.hamburgerMenuLinks.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, label: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs md:col-span-4">
                  Link
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={link.href}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        navigation: {
                          ...prev.navigation,
                          hamburgerMenuLinks: prev.navigation.hamburgerMenuLinks.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, href: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs md:col-span-3">
                  Route Key
                  <select
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={link.routeKey || ''}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        navigation: {
                          ...prev.navigation,
                          hamburgerMenuLinks: prev.navigation.hamburgerMenuLinks.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, routeKey: event.target.value || undefined } : item
                          ),
                        },
                      }))
                    }
                  >
                    <option value="">(none)</option>
                    {ROUTE_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.key}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="flex items-center gap-3 md:col-span-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={link.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          navigation: {
                            ...prev.navigation,
                            hamburgerMenuLinks: prev.navigation.hamburgerMenuLinks.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, enabled: event.target.checked } : item
                            ),
                          },
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Enabled
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        navigation: {
                          ...prev.navigation,
                          hamburgerMenuLinks: prev.navigation.hamburgerMenuLinks.filter((_, itemIndex) => itemIndex !== index),
                        },
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Hero Section</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm">
            Rotation Seconds
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.hero.rotationSeconds}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, rotationSeconds: Math.max(3, Math.min(20, toNumber(event.target.value, 6))) },
                }))
              }
            />
          </label>
          <label className="text-sm">
            CTA Target
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.hero.ctaTarget}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, ctaTarget: event.target.value as 'SAME_TAB' | 'NEW_TAB' },
                }))
              }
            >
              <option value="SAME_TAB">SAME_TAB</option>
              <option value="NEW_TAB">NEW_TAB</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm pt-7">
            <input
              type="checkbox"
              checked={config.hero.forceUppercaseCtas}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, hero: { ...prev.hero, forceUppercaseCtas: event.target.checked } }))
              }
              className="h-4 w-4"
            />
            Force uppercase CTAs
          </label>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Hero Banners</h3>
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                setConfig((prev) => ({
                  ...prev,
                  hero: { ...prev.hero, banners: [...prev.hero.banners, newHeroBanner(prev.hero.banners.length)].slice(0, 10) },
                }))
              }
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Banner
            </Button>
          </div>

          {config.hero.banners.map((banner, index) => (
            <div key={banner.id || `banner-${index}`} className="rounded border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Banner {index + 1}</h4>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={banner.enabled}
                      onChange={(event) =>
                        setConfig((prev) => ({
                          ...prev,
                          hero: {
                            ...prev.hero,
                            banners: prev.hero.banners.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, enabled: event.target.checked } : item
                            ),
                          },
                        }))
                      }
                      className="h-4 w-4"
                    />
                    Enabled
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: { ...prev.hero, banners: prev.hero.banners.filter((_, itemIndex) => itemIndex !== index) },
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="text-xs">
                  Title
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.title}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, title: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Display Order
                  <input
                    type="number"
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.displayOrder}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, displayOrder: Math.max(0, Math.min(100, toNumber(event.target.value, index))) } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs md:col-span-2">
                  Text
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.text}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, text: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs md:col-span-2">
                  Description
                  <textarea
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    rows={2}
                    value={banner.description}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, description: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Primary CTA Text
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.primaryCtaText}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, primaryCtaText: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Primary CTA Link
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.primaryCtaLink}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, primaryCtaLink: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Secondary CTA Text
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.secondaryCtaText}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, secondaryCtaText: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
                <label className="text-xs">
                  Secondary CTA Link
                  <input
                    className="mt-1 w-full rounded border px-2 py-1.5"
                    value={banner.secondaryCtaLink}
                    onChange={(event) =>
                      setConfig((prev) => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          banners: prev.hero.banners.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, secondaryCtaLink: event.target.value } : item
                          ),
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" onClick={() => openHeroBannerImageUpload(index)} isLoading={uploading === 'hero'}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Banner Image
                </Button>
                <span className="text-xs text-gray-600 break-all">{banner.image || 'No banner image uploaded'}</span>
              </div>
            </div>
          ))}
        </div>
        <input ref={heroBannerInputRef} type="file" accept="image/*" onChange={handleHeroBannerUpload} className="hidden" />
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Trust Badge</h2>
        <p className="text-xs text-gray-600">Control arrangement, colors, sizes, and word limits.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm">
            Arrangement
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.arrangement}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, arrangement: event.target.value as 'GRID' | 'ROW' },
                  },
                }))
              }
            >
              <option value="GRID">GRID</option>
              <option value="ROW">ROW</option>
            </select>
          </label>
          <label className="text-sm">
            Layout Columns
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.layoutColumns}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: {
                      ...prev.experience.trustBadgeStyle,
                      layoutColumns: Math.max(1, Math.min(6, toNumber(event.target.value, 4))),
                    },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Icon Size
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.iconSize}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, iconSize: Math.max(8, Math.min(120, toNumber(event.target.value, 20))) },
                  },
                }))
              }
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm">
            Title Color
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.titleColor}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, trustBadgeStyle: { ...prev.experience.trustBadgeStyle, titleColor: event.target.value } },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Subtitle Color
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.subtitleColor}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, trustBadgeStyle: { ...prev.experience.trustBadgeStyle, subtitleColor: event.target.value } },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Card Background
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.cardBackgroundColor}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, cardBackgroundColor: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Card Border
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.cardBorderColor}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, cardBorderColor: event.target.value },
                  },
                }))
              }
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm">
            Title Font Size
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.titleFontSize}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, titleFontSize: Math.max(8, Math.min(64, toNumber(event.target.value, 18))) },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Subtitle Font Size
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.subtitleFontSize}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, subtitleFontSize: Math.max(8, Math.min(64, toNumber(event.target.value, 14))) },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Max Title Words
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.maxTitleWords}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, maxTitleWords: Math.max(1, Math.min(20, toNumber(event.target.value, 4))) },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Max Subtitle Words
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.trustBadgeStyle.maxSubtitleWords}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    trustBadgeStyle: { ...prev.experience.trustBadgeStyle, maxSubtitleWords: Math.max(1, Math.min(40, toNumber(event.target.value, 10))) },
                  },
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Section Visibility</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {VISIBILITY_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>{field.label}</span>
              <input
                type="checkbox"
                checked={Boolean(config.sections.visibility[field.key])}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    sections: {
                      ...prev.sections,
                      visibility: {
                        ...prev.sections.visibility,
                        [field.key]: event.target.checked,
                      },
                    },
                  }))
                }
                className="h-4 w-4"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Top Strip</h2>
        <label className="block text-sm font-medium">Messages (one per line)</label>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={4}
          value={config.topStrip.messages.join('\n')}
          onChange={(event) =>
            setConfig((prev) => ({
              ...prev,
              topStrip: {
                ...prev.topStrip,
                messages: event.target.value.split('\n').map((row) => row.trim()).filter(Boolean).slice(0, 12),
              },
            }))
          }
        />
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Advanced Nav Links</h2>
        <p className="text-xs text-gray-600">Format: label | /href | routeKey | true/false</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm">
            Left Menu Links
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={6}
              value={formatNavLinks(config.navigation.leftMenuLinks)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  navigation: { ...prev.navigation, leftMenuLinks: parseNavLinks(event.target.value) },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Right Menu Links
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={6}
              value={formatNavLinks(config.navigation.rightMenuLinks)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  navigation: { ...prev.navigation, rightMenuLinks: parseNavLinks(event.target.value) },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Hamburger Links
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              rows={6}
              value={formatNavLinks(config.navigation.hamburgerMenuLinks)}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  navigation: { ...prev.navigation, hamburgerMenuLinks: parseNavLinks(event.target.value) },
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Homepage CTA Block</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.cta.enabled}
            onChange={(event) => setConfig((prev) => ({ ...prev, cta: { ...prev.cta, enabled: event.target.checked } }))}
            className="h-4 w-4"
          />
          Enable CTA
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            CTA Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.title}
              onChange={(event) => setConfig((prev) => ({ ...prev, cta: { ...prev.cta, title: event.target.value } }))}
            />
          </label>
          <label className="text-sm">
            CTA Subtitle
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.subtitle}
              onChange={(event) => setConfig((prev) => ({ ...prev, cta: { ...prev.cta, subtitle: event.target.value } }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" onClick={() => ctaBgInputRef.current?.click()} isLoading={uploading === 'cta'}>
            <Upload className="mr-2 h-4 w-4" />
            Upload CTA Background
          </Button>
          <input ref={ctaBgInputRef} type="file" accept="image/*" onChange={handleCtaBackgroundUpload} className="hidden" />
          <span className="text-xs text-gray-600 break-all">{config.cta.backgroundImage || 'No CTA background image uploaded'}</span>
        </div>
      </section>
    </div>
  );
}
