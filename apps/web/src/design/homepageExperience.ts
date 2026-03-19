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
