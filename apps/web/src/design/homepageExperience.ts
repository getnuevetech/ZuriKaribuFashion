export const HOMEPAGE_EXPERIENCE_MODES = [
  'LITE_COMMERCE',
  'STANDARD_PREMIUM',
  'EDITORIAL_IMMERSIVE',
] as const;
export type HomepageExperienceMode = (typeof HOMEPAGE_EXPERIENCE_MODES)[number];

export const HOMEPAGE_THEME_MODES = ['SYSTEM', 'LIGHT', 'DARK'] as const;
export type HomepageThemeMode = (typeof HOMEPAGE_THEME_MODES)[number];

export const HOMEPAGE_TOKEN_SETS = [
  'GLOBAL_PREMIUM_DARK',
  'GLOBAL_PREMIUM_LIGHT',
  'AFRO_EDITORIAL',
] as const;
export type HomepageTokenSet = (typeof HOMEPAGE_TOKEN_SETS)[number];

export const HOMEPAGE_HERO_VARIANTS = ['SPLIT_EDITORIAL', 'CLEAN_COMMERCE', 'VIDEO_STORY'] as const;
export type HomepageHeroVariant = (typeof HOMEPAGE_HERO_VARIANTS)[number];

export const HOMEPAGE_CATEGORY_ENTRY_VARIANTS = ['THREE_COLUMN_CORE', 'MEGA_GRID'] as const;
export type HomepageCategoryEntryVariant = (typeof HOMEPAGE_CATEGORY_ENTRY_VARIANTS)[number];

export const HOMEPAGE_SPOTLIGHT_VARIANTS = ['CAROUSEL', 'SINGLE_FEATURE', 'MOSAIC'] as const;
export type HomepageSpotlightVariant = (typeof HOMEPAGE_SPOTLIGHT_VARIANTS)[number];

export const HOMEPAGE_TEMPLATES = ['LEGACY', 'JENKS'] as const;
export type HomepageTemplate = (typeof HOMEPAGE_TEMPLATES)[number];

export const HOMEPAGE_ROLLOUT_MODES = ['LIVE', 'PREVIEW_SAFE'] as const;
export type HomepageRolloutMode = (typeof HOMEPAGE_ROLLOUT_MODES)[number];

export const HOMEPAGE_TRUST_BADGE_ICONS = [
  'SHIELD_CHECK',
  'TRUCK',
  'REFRESH_CW',
  'HEADPHONES',
  'GLOBE',
  'SHOPPING_BAG',
] as const;
export type HomepageTrustBadgeIcon = (typeof HOMEPAGE_TRUST_BADGE_ICONS)[number];

export interface HomepageTrustBadge {
  title: string;
  subtitle: string;
  icon: HomepageTrustBadgeIcon;
  enabled: boolean;
}

export interface HomepageKimiCopy {
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
}

export interface HomepageExperienceSettings {
  enabledModes: HomepageExperienceMode[];
  defaultMode: HomepageExperienceMode;
  allowUserModeOverride: boolean;
  adaptiveByDevice: boolean;
  adaptiveByConnection: boolean;
  respectReducedMotion: boolean;
  themeModes: HomepageThemeMode[];
  defaultThemeMode: HomepageThemeMode;
  tokenSet: HomepageTokenSet;
  heroVariant: HomepageHeroVariant;
  categoryEntryVariant: HomepageCategoryEntryVariant;
  spotlightVariant: HomepageSpotlightVariant;
  homepageTemplate: HomepageTemplate;
  rolloutMode: HomepageRolloutMode;
  allowPreviewQuery: boolean;
  previewQueryParam: string;
  legacyHomepageEnabled: boolean;
  trustBadges: HomepageTrustBadge[];
  kimiCopy: HomepageKimiCopy;
}

export type HomepageCapabilityTier = 'LOW' | 'MEDIUM' | 'HIGH';
export type HomepageConnectionTier = 'SLOW' | 'NORMAL' | 'FAST';

export interface HomepageCapabilityProfile {
  deviceTier: HomepageCapabilityTier;
  connectionTier: HomepageConnectionTier;
  prefersReducedMotion: boolean;
  saveDataEnabled: boolean;
  recommendedMode: HomepageExperienceMode;
}

export const HOMEPAGE_EXPERIENCE_DEFAULTS: HomepageExperienceSettings = {
  enabledModes: [...HOMEPAGE_EXPERIENCE_MODES],
  defaultMode: 'EDITORIAL_IMMERSIVE',
  allowUserModeOverride: true,
  adaptiveByDevice: false,
  adaptiveByConnection: false,
  respectReducedMotion: true,
  themeModes: [...HOMEPAGE_THEME_MODES],
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
  trustBadges: [
    { icon: 'SHIELD_CHECK', title: 'Authentic Guarantee', subtitle: 'Verified sellers and designers', enabled: true },
    { icon: 'TRUCK', title: 'Global Shipping', subtitle: 'Reliable delivery worldwide', enabled: true },
    { icon: 'REFRESH_CW', title: 'Easy Returns', subtitle: 'Simple returns on eligible orders', enabled: true },
    { icon: 'HEADPHONES', title: '24/7 Support', subtitle: 'Chat and ticket support anytime', enabled: true },
  ],
  kimiCopy: {
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
};

const asUniqueList = <T extends string>(values: unknown, allowed: readonly T[], fallback: readonly T[]): T[] => {
  const allowedSet = new Set(allowed);
  const source = Array.isArray(values) ? values : fallback;
  const normalized: T[] = [];
  for (const entry of source) {
    const value = String(entry || '').trim().toUpperCase();
    if (!allowedSet.has(value as T)) continue;
    if (!normalized.includes(value as T)) {
      normalized.push(value as T);
    }
  }
  return normalized.length > 0 ? normalized : [...fallback];
};

const normalizeHomepageTemplateValue = (value: unknown): HomepageTemplate | null => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'KIMI') return 'JENKS';
  if (normalized === 'JENKS' || normalized === 'LEGACY') return normalized as HomepageTemplate;
  return null;
};

export const normalizeHomepageExperienceSettings = (
  raw: unknown
): HomepageExperienceSettings => {
  if (!raw || typeof raw !== 'object') {
    return { ...HOMEPAGE_EXPERIENCE_DEFAULTS };
  }
  const row = raw as Record<string, unknown>;
  const enabledModes = asUniqueList(
    row.enabledModes,
    HOMEPAGE_EXPERIENCE_MODES,
    HOMEPAGE_EXPERIENCE_DEFAULTS.enabledModes
  );
  const defaultModeCandidate = String(row.defaultMode || '').trim().toUpperCase() as HomepageExperienceMode;
  const defaultMode = enabledModes.includes(defaultModeCandidate)
    ? defaultModeCandidate
    : enabledModes.includes(HOMEPAGE_EXPERIENCE_DEFAULTS.defaultMode)
      ? HOMEPAGE_EXPERIENCE_DEFAULTS.defaultMode
      : enabledModes[0];
  const themeModes = asUniqueList(
    row.themeModes,
    HOMEPAGE_THEME_MODES,
    HOMEPAGE_EXPERIENCE_DEFAULTS.themeModes
  );
  const defaultThemeCandidate = String(row.defaultThemeMode || '').trim().toUpperCase() as HomepageThemeMode;
  const defaultThemeMode = themeModes.includes(defaultThemeCandidate)
    ? defaultThemeCandidate
    : themeModes.includes(HOMEPAGE_EXPERIENCE_DEFAULTS.defaultThemeMode)
      ? HOMEPAGE_EXPERIENCE_DEFAULTS.defaultThemeMode
      : themeModes[0];

  const tokenSet = HOMEPAGE_TOKEN_SETS.includes(String(row.tokenSet || '').trim().toUpperCase() as HomepageTokenSet)
    ? (String(row.tokenSet || '').trim().toUpperCase() as HomepageTokenSet)
    : HOMEPAGE_EXPERIENCE_DEFAULTS.tokenSet;
  const heroVariant = HOMEPAGE_HERO_VARIANTS.includes(String(row.heroVariant || '').trim().toUpperCase() as HomepageHeroVariant)
    ? (String(row.heroVariant || '').trim().toUpperCase() as HomepageHeroVariant)
    : HOMEPAGE_EXPERIENCE_DEFAULTS.heroVariant;
  const categoryEntryVariant = HOMEPAGE_CATEGORY_ENTRY_VARIANTS.includes(
    String(row.categoryEntryVariant || '').trim().toUpperCase() as HomepageCategoryEntryVariant
  )
    ? (String(row.categoryEntryVariant || '').trim().toUpperCase() as HomepageCategoryEntryVariant)
    : HOMEPAGE_EXPERIENCE_DEFAULTS.categoryEntryVariant;
  const spotlightVariant = HOMEPAGE_SPOTLIGHT_VARIANTS.includes(
    String(row.spotlightVariant || '').trim().toUpperCase() as HomepageSpotlightVariant
  )
    ? (String(row.spotlightVariant || '').trim().toUpperCase() as HomepageSpotlightVariant)
    : HOMEPAGE_EXPERIENCE_DEFAULTS.spotlightVariant;
  const homepageTemplate = normalizeHomepageTemplateValue(row.homepageTemplate) || HOMEPAGE_EXPERIENCE_DEFAULTS.homepageTemplate;
  const rolloutMode = HOMEPAGE_ROLLOUT_MODES.includes(
    String(row.rolloutMode || '').trim().toUpperCase() as HomepageRolloutMode
  )
    ? (String(row.rolloutMode || '').trim().toUpperCase() as HomepageRolloutMode)
    : HOMEPAGE_EXPERIENCE_DEFAULTS.rolloutMode;
  const previewQueryParamCandidate = String(row.previewQueryParam || '').trim();
  const previewQueryParam = /^[A-Za-z0-9_-]{2,40}$/.test(previewQueryParamCandidate)
    ? previewQueryParamCandidate
    : HOMEPAGE_EXPERIENCE_DEFAULTS.previewQueryParam;
  const legacyHomepageEnabled =
    typeof row.legacyHomepageEnabled === 'boolean'
      ? row.legacyHomepageEnabled
      : HOMEPAGE_EXPERIENCE_DEFAULTS.legacyHomepageEnabled;
  const trustBadgeRows = Array.isArray(row.trustBadges) ? row.trustBadges : [];
  const trustBadges = trustBadgeRows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const title = String(item.title || '').trim().slice(0, 48);
      const subtitle = String(item.subtitle || '').trim().slice(0, 90);
      if (!title || !subtitle) return null;
      const iconCandidate = String(item.icon || '').trim().toUpperCase() as HomepageTrustBadgeIcon;
      const icon = HOMEPAGE_TRUST_BADGE_ICONS.includes(iconCandidate)
        ? iconCandidate
        : HOMEPAGE_EXPERIENCE_DEFAULTS.trustBadges[0].icon;
      return {
        title,
        subtitle,
        icon,
        enabled: item.enabled !== false,
      } as HomepageTrustBadge;
    })
    .filter((entry): entry is HomepageTrustBadge => Boolean(entry))
    .slice(0, 6);
  const copyInput = row.kimiCopy && typeof row.kimiCopy === 'object' ? (row.kimiCopy as Record<string, unknown>) : {};
  const copyDefaults = HOMEPAGE_EXPERIENCE_DEFAULTS.kimiCopy;
  const kimiCopy: HomepageKimiCopy = {
    heroEyebrow: String(copyInput.heroEyebrow || copyDefaults.heroEyebrow).trim().slice(0, 40) || copyDefaults.heroEyebrow,
    shopByEyebrow: String(copyInput.shopByEyebrow || copyDefaults.shopByEyebrow).trim().slice(0, 40) || copyDefaults.shopByEyebrow,
    shopByTitle: String(copyInput.shopByTitle || copyDefaults.shopByTitle).trim().slice(0, 60) || copyDefaults.shopByTitle,
    featuredRtwTitle:
      String(copyInput.featuredRtwTitle || copyDefaults.featuredRtwTitle).trim().slice(0, 60) || copyDefaults.featuredRtwTitle,
    featuredFabricsTitle:
      String(copyInput.featuredFabricsTitle || copyDefaults.featuredFabricsTitle).trim().slice(0, 60) ||
      copyDefaults.featuredFabricsTitle,
    featuredDesignsTitle:
      String(copyInput.featuredDesignsTitle || copyDefaults.featuredDesignsTitle).trim().slice(0, 60) ||
      copyDefaults.featuredDesignsTitle,
    designerSpotlightTitle:
      String(copyInput.designerSpotlightTitle || copyDefaults.designerSpotlightTitle).trim().slice(0, 60) ||
      copyDefaults.designerSpotlightTitle,
    quickPathRtwLabel:
      String(copyInput.quickPathRtwLabel || copyDefaults.quickPathRtwLabel).trim().slice(0, 32) || copyDefaults.quickPathRtwLabel,
    quickPathCustomLabel:
      String(copyInput.quickPathCustomLabel || copyDefaults.quickPathCustomLabel).trim().slice(0, 32) ||
      copyDefaults.quickPathCustomLabel,
    quickPathFabricsLabel:
      String(copyInput.quickPathFabricsLabel || copyDefaults.quickPathFabricsLabel).trim().slice(0, 32) ||
      copyDefaults.quickPathFabricsLabel,
  };

  return {
    enabledModes,
    defaultMode,
    allowUserModeOverride: row.allowUserModeOverride !== false,
    adaptiveByDevice: row.adaptiveByDevice !== false,
    adaptiveByConnection: row.adaptiveByConnection !== false,
    respectReducedMotion: row.respectReducedMotion !== false,
    themeModes,
    defaultThemeMode,
    tokenSet,
    heroVariant,
    categoryEntryVariant,
    spotlightVariant,
    homepageTemplate,
    rolloutMode,
    allowPreviewQuery: row.allowPreviewQuery !== false,
    previewQueryParam,
    legacyHomepageEnabled,
    trustBadges: trustBadges.length > 0 ? trustBadges : [...HOMEPAGE_EXPERIENCE_DEFAULTS.trustBadges],
    kimiCopy,
  };
};

type NetworkConnectionLike = {
  effectiveType?: string;
  downlink?: number;
  saveData?: boolean;
};

const resolveConnection = (): NetworkConnectionLike => {
  if (typeof navigator === 'undefined') return {};
  const nav = navigator as unknown as {
    connection?: NetworkConnectionLike;
    mozConnection?: NetworkConnectionLike;
    webkitConnection?: NetworkConnectionLike;
  };
  return nav.connection || nav.mozConnection || nav.webkitConnection || {};
};

const resolvePrefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const evaluateHomepageCapabilityProfile = (): HomepageCapabilityProfile => {
  if (typeof navigator === 'undefined') {
    return {
      deviceTier: 'MEDIUM',
      connectionTier: 'NORMAL',
      prefersReducedMotion: false,
      saveDataEnabled: false,
      recommendedMode: 'STANDARD_PREMIUM',
    };
  }

  const memory = Number((navigator as any).deviceMemory || 0);
  const cpuCores = Number((navigator as any).hardwareConcurrency || 0);
  const connection = resolveConnection();
  const downlink = Number(connection.downlink || 0);
  const effectiveType = String(connection.effectiveType || '').toLowerCase();
  const saveDataEnabled = Boolean(connection.saveData);
  const prefersReducedMotion = resolvePrefersReducedMotion();

  let deviceTier: HomepageCapabilityTier = 'MEDIUM';
  if ((memory > 0 && memory <= 2) || (cpuCores > 0 && cpuCores <= 2)) {
    deviceTier = 'LOW';
  } else if ((memory >= 8 || memory === 0) && cpuCores >= 8) {
    deviceTier = 'HIGH';
  }

  let connectionTier: HomepageConnectionTier = 'NORMAL';
  if (effectiveType.includes('2g') || downlink > 0 && downlink <= 1.5) {
    connectionTier = 'SLOW';
  } else if (effectiveType.includes('4g') && downlink >= 10) {
    connectionTier = 'FAST';
  }

  let recommendedMode: HomepageExperienceMode = 'STANDARD_PREMIUM';
  if (prefersReducedMotion || saveDataEnabled || deviceTier === 'LOW' || connectionTier === 'SLOW') {
    recommendedMode = 'LITE_COMMERCE';
  } else if (deviceTier === 'HIGH' && connectionTier === 'FAST') {
    recommendedMode = 'EDITORIAL_IMMERSIVE';
  }

  return {
    deviceTier,
    connectionTier,
    prefersReducedMotion,
    saveDataEnabled,
    recommendedMode,
  };
};

export const resolveHomepageMode = (args: {
  settings: HomepageExperienceSettings;
  capability: HomepageCapabilityProfile | null;
  userOverrideMode: HomepageExperienceMode | null;
}): HomepageExperienceMode => {
  const { settings, capability, userOverrideMode } = args;
  const enabledModes = asUniqueList(settings.enabledModes, HOMEPAGE_EXPERIENCE_MODES, HOMEPAGE_EXPERIENCE_DEFAULTS.enabledModes);
  const defaultMode = enabledModes.includes(settings.defaultMode) ? settings.defaultMode : enabledModes[0];

  if (
    settings.allowUserModeOverride &&
    userOverrideMode &&
    enabledModes.includes(userOverrideMode)
  ) {
    return userOverrideMode;
  }

  let candidate = defaultMode;
  if (capability && (settings.adaptiveByDevice || settings.adaptiveByConnection)) {
    candidate = capability.recommendedMode;
  }
  if (capability?.prefersReducedMotion && settings.respectReducedMotion) {
    candidate = 'LITE_COMMERCE';
  }
  return enabledModes.includes(candidate) ? candidate : defaultMode;
};

export const resolveHomepageThemeMode = (args: {
  settings: HomepageExperienceSettings;
  userOverrideTheme: HomepageThemeMode | null;
}): HomepageThemeMode => {
  const enabledThemes = asUniqueList(args.settings.themeModes, HOMEPAGE_THEME_MODES, HOMEPAGE_EXPERIENCE_DEFAULTS.themeModes);
  if (
    args.userOverrideTheme &&
    enabledThemes.includes(args.userOverrideTheme)
  ) {
    return args.userOverrideTheme;
  }
  if (enabledThemes.includes(args.settings.defaultThemeMode)) {
    return args.settings.defaultThemeMode;
  }
  return enabledThemes[0];
};

export const resolveConcreteTheme = (themeMode: HomepageThemeMode): 'LIGHT' | 'DARK' => {
  if (themeMode === 'LIGHT') return 'LIGHT';
  if (themeMode === 'DARK') return 'DARK';
  const prefersDark =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'DARK' : 'LIGHT';
};
