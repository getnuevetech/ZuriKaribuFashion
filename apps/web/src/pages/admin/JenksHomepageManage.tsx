import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Loader2, Upload } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type VisibilityMap = Record<string, boolean>;

type OptionLink = {
  label: string;
  href: string;
};

type NavLink = {
  label: string;
  href: string;
  enabled: boolean;
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
    trustBadges: Array<{
      title: string;
      subtitle: string;
      icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
      enabled: boolean;
    }>;
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
    trustBadges: [],
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
    leftMenuLinks: [],
    rightMenuLinks: [],
    hamburgerMenuLinks: [],
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
    quickLinks: [],
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
      const [labelRaw, hrefRaw, enabledRaw] = line.split('|').map((part) => part.trim());
      if (!labelRaw || !hrefRaw) return null;
      const enabledToken = String(enabledRaw || 'true').toLowerCase();
      const enabled = !['false', '0', 'off', 'no'].includes(enabledToken);
      return { label: labelRaw, href: hrefRaw, enabled };
    })
    .filter((row): row is NavLink => Boolean(row))
    .slice(0, 20);

const formatNavLinks = (rows: NavLink[]) => rows.map((row) => `${row.label} | ${row.href} | ${row.enabled}`).join('\n');

const toNumber = (value: string, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function AdminJenksHomepageManage() {
  const [config, setConfig] = useState<JenksHomepageConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'cta' | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const ctaBgInputRef = useRef<HTMLInputElement | null>(null);

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
      if (!response.success || !response.data) {
        throw new Error('Failed to load Jenks homepage config.');
      }
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
        navigation: {
          ...prev.navigation,
          logoImageUrl: url,
          logoMode: 'IMAGE',
        },
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
      setConfig((prev) => ({
        ...prev,
        cta: {
          ...prev.cta,
          backgroundImage: url,
        },
      }));
      setSuccess('CTA background image uploaded.');
    } catch (uploadError: any) {
      setError(uploadError?.message || 'Failed to upload CTA background image.');
    } finally {
      setUploading(null);
      event.target.value = '';
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        sections: { visibility: config.sections.visibility },
        topStrip: config.topStrip,
        experience: config.experience,
        navigation: config.navigation,
        hero: config.hero,
        shopByBlocks: config.shopByBlocks,
        freshDrops: config.freshDrops,
        newsletter: config.newsletter,
        cta: config.cta,
      };
      const response = await api.homepageSections.updateAdminJenksHomepageConfig(payload);
      if (!response.success) {
        throw new Error('Failed to save config');
      }
      setConfig((prev) => ({ ...prev, ...(response.data || {}) }));
      setSuccess('Jenks homepage config saved successfully.');
      await fetchConfig();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || saveError?.message || 'Failed to save config.');
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="text-sm">
            Separator
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.topStrip.separator}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, topStrip: { ...prev.topStrip, separator: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Repeat Count
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.topStrip.repeatCount}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  topStrip: { ...prev.topStrip, repeatCount: Math.max(2, Math.min(12, toNumber(event.target.value, 4))) },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Animation Seconds
            <input
              type="number"
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.topStrip.animationSeconds}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  topStrip: {
                    ...prev.topStrip,
                    animationSeconds: Math.max(8, Math.min(120, toNumber(event.target.value, 20))),
                  },
                }))
              }
            />
          </label>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm">
            Text Color
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.topStrip.textColor}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, topStrip: { ...prev.topStrip, textColor: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Background Color
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.topStrip.backgroundColor}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, topStrip: { ...prev.topStrip, backgroundColor: event.target.value } }))
              }
            />
          </label>
          <label className="flex items-center gap-2 text-sm pt-7">
            <input
              type="checkbox"
              checked={config.topStrip.isBold}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, topStrip: { ...prev.topStrip, isBold: event.target.checked } }))
              }
              className="h-4 w-4"
            />
            Bold text
          </label>
          <label className="flex items-center gap-2 text-sm pt-7">
            <input
              type="checkbox"
              checked={config.topStrip.pauseOnHover}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, topStrip: { ...prev.topStrip, pauseOnHover: event.target.checked } }))
              }
              className="h-4 w-4"
            />
            Pause on hover
          </label>
        </div>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Experience + Copy</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm">
            Default Mode
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.defaultMode}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, defaultMode: event.target.value as JenksHomepageConfig['experience']['defaultMode'] },
                }))
              }
            >
              <option value="LITE_COMMERCE">LITE_COMMERCE</option>
              <option value="STANDARD_PREMIUM">STANDARD_PREMIUM</option>
              <option value="EDITORIAL_IMMERSIVE">EDITORIAL_IMMERSIVE</option>
            </select>
          </label>
          <label className="text-sm">
            Hero Variant
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.heroVariant}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, heroVariant: event.target.value as JenksHomepageConfig['experience']['heroVariant'] },
                }))
              }
            >
              <option value="SPLIT_EDITORIAL">SPLIT_EDITORIAL</option>
              <option value="CLEAN_COMMERCE">CLEAN_COMMERCE</option>
              <option value="VIDEO_STORY">VIDEO_STORY</option>
            </select>
          </label>
          <label className="text-sm">
            Category Variant
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.categoryEntryVariant}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    categoryEntryVariant: event.target.value as JenksHomepageConfig['experience']['categoryEntryVariant'],
                  },
                }))
              }
            >
              <option value="THREE_COLUMN_CORE">THREE_COLUMN_CORE</option>
              <option value="MEGA_GRID">MEGA_GRID</option>
            </select>
          </label>
          <label className="text-sm">
            Spotlight Variant
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.spotlightVariant}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    spotlightVariant: event.target.value as JenksHomepageConfig['experience']['spotlightVariant'],
                  },
                }))
              }
            >
              <option value="CAROUSEL">CAROUSEL</option>
              <option value="SINGLE_FEATURE">SINGLE_FEATURE</option>
              <option value="MOSAIC">MOSAIC</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-sm">
            Hero Eyebrow
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.heroEyebrow}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, jenksCopy: { ...prev.experience.jenksCopy, heroEyebrow: event.target.value } },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Shop By Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.shopByTitle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: { ...prev.experience, jenksCopy: { ...prev.experience.jenksCopy, shopByTitle: event.target.value } },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Featured RTW Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.featuredRtwTitle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, featuredRtwTitle: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Featured Fabrics Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.featuredFabricsTitle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, featuredFabricsTitle: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Featured Designs Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.featuredDesignsTitle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, featuredDesignsTitle: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Designer Spotlight Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.designerSpotlightTitle}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, designerSpotlightTitle: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Quick Path RTW Label
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.quickPathRtwLabel}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, quickPathRtwLabel: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Quick Path Custom Label
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.quickPathCustomLabel}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, quickPathCustomLabel: event.target.value },
                  },
                }))
              }
            />
          </label>
          <label className="text-sm">
            Quick Path Fabrics Label
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.experience.jenksCopy.quickPathFabricsLabel}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  experience: {
                    ...prev.experience,
                    jenksCopy: { ...prev.experience.jenksCopy, quickPathFabricsLabel: event.target.value },
                  },
                }))
              }
            />
          </label>
        </div>

        <label className="block text-sm font-medium">Trust Badges (one per line: TITLE | SUBTITLE | ICON | true/false)</label>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={5}
          value={config.experience.trustBadges
            .map((badge) => `${badge.title} | ${badge.subtitle} | ${badge.icon} | ${badge.enabled}`)
            .join('\n')}
          onChange={(event) => {
            const nextBadges = event.target.value
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
              .map((line) => {
                const [title, subtitle, iconRaw, enabledRaw] = line.split('|').map((part) => part.trim());
                const icon = String(iconRaw || '').toUpperCase() as
                  | 'SHIELD_CHECK'
                  | 'TRUCK'
                  | 'REFRESH_CW'
                  | 'HEADPHONES'
                  | 'GLOBE'
                  | 'SHOPPING_BAG';
                const allowedIcons = ['SHIELD_CHECK', 'TRUCK', 'REFRESH_CW', 'HEADPHONES', 'GLOBE', 'SHOPPING_BAG'];
                return {
                  title: title || 'Trust Badge',
                  subtitle: subtitle || 'Reliable experience.',
                  icon: allowedIcons.includes(icon) ? icon : 'SHIELD_CHECK',
                  enabled: !['false', '0', 'off', 'no'].includes(String(enabledRaw || 'true').toLowerCase()),
                };
              })
              .slice(0, 6);
            setConfig((prev) => ({
              ...prev,
              experience: {
                ...prev.experience,
                trustBadges: nextBadges.length > 0 ? nextBadges : prev.experience.trustBadges,
              },
            }));
          }}
        />
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Navigation + Hero</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            Logo Mode
            <select
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.navigation.logoMode}
              onChange={(event) =>
                setConfig((prev) => ({
                  ...prev,
                  navigation: { ...prev.navigation, logoMode: event.target.value as 'TEXT' | 'IMAGE' },
                }))
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
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, navigation: { ...prev.navigation, logoText: event.target.value } }))
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => logoInputRef.current?.click()}
            isLoading={uploading === 'logo'}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload Logo Image
          </Button>
          <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          <span className="text-xs text-gray-600 break-all">{config.navigation.logoImageUrl || 'No logo image uploaded'}</span>
        </div>

        <label className="block text-sm font-medium">Hero Quick Links (one per line: label | /href)</label>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          value={formatOptions(config.hero.quickLinks)}
          onChange={(event) =>
            setConfig((prev) => ({ ...prev, hero: { ...prev.hero, quickLinks: parseOptions(event.target.value) } }))
          }
        />
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Shop By / Fresh Drops / Newsletter</h2>
        <label className="text-sm">
          Shop By Title
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={config.shopByBlocks.title}
            onChange={(event) =>
              setConfig((prev) => ({ ...prev, shopByBlocks: { ...prev.shopByBlocks, title: event.target.value } }))
            }
          />
        </label>
        <label className="block text-sm font-medium">Style Options (label | /href)</label>
        <textarea
          className="w-full rounded border px-3 py-2 text-sm"
          rows={3}
          value={formatOptions(config.shopByBlocks.styleOptions)}
          onChange={(event) =>
            setConfig((prev) => ({ ...prev, shopByBlocks: { ...prev.shopByBlocks, styleOptions: parseOptions(event.target.value) } }))
          }
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="text-sm">
            Fresh Drops Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.freshDrops.title}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, freshDrops: { ...prev.freshDrops, title: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Newsletter Title
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.newsletter.title}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, newsletter: { ...prev.newsletter, title: event.target.value } }))
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
          <label className="text-sm">
            Primary CTA Text
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.primaryCtaText}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, cta: { ...prev.cta, primaryCtaText: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Primary CTA Link
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.primaryCtaLink}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, cta: { ...prev.cta, primaryCtaLink: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Secondary CTA Text
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.secondaryCtaText}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, cta: { ...prev.cta, secondaryCtaText: event.target.value } }))
              }
            />
          </label>
          <label className="text-sm">
            Secondary CTA Link
            <input
              className="mt-1 w-full rounded border px-3 py-2"
              value={config.cta.secondaryCtaLink}
              onChange={(event) =>
                setConfig((prev) => ({ ...prev, cta: { ...prev.cta, secondaryCtaLink: event.target.value } }))
              }
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => ctaBgInputRef.current?.click()}
            isLoading={uploading === 'cta'}
          >
            <Upload className="mr-2 h-4 w-4" />
            Upload CTA Background
          </Button>
          <input ref={ctaBgInputRef} type="file" accept="image/*" onChange={handleCtaBackgroundUpload} className="hidden" />
          <span className="text-xs text-gray-600 break-all">{config.cta.backgroundImage || 'No CTA background image uploaded'}</span>
        </div>
      </section>

      <section className="rounded-lg border bg-white p-5 space-y-4">
        <h2 className="text-lg font-semibold">Advanced Nav Links</h2>
        <p className="text-xs text-gray-600">Format: label | /href | true/false</p>
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
    </div>
  );
}

