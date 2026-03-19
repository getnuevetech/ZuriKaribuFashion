import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  evaluateHomepageCapabilityProfile,
  HOMEPAGE_EXPERIENCE_DEFAULTS,
  type HomepageCapabilityProfile,
  type HomepageExperienceMode,
  type HomepageExperienceSettings,
  type HomepageThemeMode,
  normalizeHomepageExperienceSettings,
  resolveConcreteTheme,
  resolveHomepageMode,
  resolveHomepageThemeMode,
} from '../design/homepageExperience';

interface HomepageExperienceStoreState {
  settings: HomepageExperienceSettings;
  capability: HomepageCapabilityProfile | null;
  resolvedMode: HomepageExperienceMode;
  userOverrideMode: HomepageExperienceMode | null;
  resolvedThemeMode: HomepageThemeMode;
  userOverrideThemeMode: HomepageThemeMode | null;
  concreteTheme: 'LIGHT' | 'DARK';
  hydrateSettings: (incoming: unknown) => void;
  evaluateCapabilities: () => void;
  setUserOverrideMode: (mode: HomepageExperienceMode | null) => void;
  setUserOverrideThemeMode: (mode: HomepageThemeMode | null) => void;
  recomputeResolved: () => void;
}

const resolveState = (
  settings: HomepageExperienceSettings,
  capability: HomepageCapabilityProfile | null,
  userOverrideMode: HomepageExperienceMode | null,
  userOverrideThemeMode: HomepageThemeMode | null
) => {
  const resolvedMode = resolveHomepageMode({ settings, capability, userOverrideMode });
  const resolvedThemeMode = resolveHomepageThemeMode({ settings, userOverrideTheme: userOverrideThemeMode });
  const concreteTheme = resolveConcreteTheme(resolvedThemeMode);
  return { resolvedMode, resolvedThemeMode, concreteTheme };
};

export const useHomepageExperienceStore = create<HomepageExperienceStoreState>()(
  persist(
    (set, get) => ({
      settings: { ...HOMEPAGE_EXPERIENCE_DEFAULTS },
      capability: null,
      resolvedMode: HOMEPAGE_EXPERIENCE_DEFAULTS.defaultMode,
      userOverrideMode: null,
      resolvedThemeMode: HOMEPAGE_EXPERIENCE_DEFAULTS.defaultThemeMode,
      userOverrideThemeMode: null,
      concreteTheme: resolveConcreteTheme(HOMEPAGE_EXPERIENCE_DEFAULTS.defaultThemeMode),
      hydrateSettings: (incoming) => {
        const settings = normalizeHomepageExperienceSettings(incoming);
        const next = resolveState(
          settings,
          get().capability,
          get().userOverrideMode,
          get().userOverrideThemeMode
        );
        set({
          settings,
          ...next,
        });
      },
      evaluateCapabilities: () => {
        const capability = evaluateHomepageCapabilityProfile();
        const next = resolveState(
          get().settings,
          capability,
          get().userOverrideMode,
          get().userOverrideThemeMode
        );
        set({
          capability,
          ...next,
        });
      },
      setUserOverrideMode: (mode) => {
        const next = resolveState(
          get().settings,
          get().capability,
          mode,
          get().userOverrideThemeMode
        );
        set({
          userOverrideMode: mode,
          ...next,
        });
      },
      setUserOverrideThemeMode: (mode) => {
        const next = resolveState(
          get().settings,
          get().capability,
          get().userOverrideMode,
          mode
        );
        set({
          userOverrideThemeMode: mode,
          ...next,
        });
      },
      recomputeResolved: () => {
        const next = resolveState(
          get().settings,
          get().capability,
          get().userOverrideMode,
          get().userOverrideThemeMode
        );
        set(next);
      },
    }),
    {
      name: 'homepage-experience-preferences',
      partialize: (state) => ({
        userOverrideMode: state.userOverrideMode,
        userOverrideThemeMode: state.userOverrideThemeMode,
      }),
    }
  )
);
