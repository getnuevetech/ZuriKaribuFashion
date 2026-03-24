import { useEffect } from 'react';
import { api } from '../services/api';
import {
  HOMEPAGE_EXPERIENCE_DEFAULTS,
  normalizeHomepageExperienceSettings,
  type HomepageExperienceSettings,
} from '../design/homepageExperience';

const JENKS_HOME_PATH = '/home';
const JENKS_STATIC_HOME_PATH = '/home';

const buildJenksStaticUrl = () => JENKS_STATIC_HOME_PATH;

const normalizePreviewChoice = (
  value: string | null
): 'JENKS_DYNAMIC' | 'JENKS_STATIC' | 'LEGACY' | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['jenks', 'jenks-dynamic', 'dynamic', 'react', '1', 'true', 'on'].includes(normalized)) {
    return 'JENKS_DYNAMIC';
  }
  if (['jenks-static', 'v14', 'static'].includes(normalized)) return 'JENKS_STATIC';
  if (['legacy', '0', 'false', 'off'].includes(normalized)) return 'LEGACY';
  return null;
};

const resolveHomepageTarget = (
  settings: HomepageExperienceSettings
): 'JENKS_DYNAMIC' | 'JENKS_STATIC' | 'LEGACY' => {
  if (typeof window === 'undefined') return 'JENKS_STATIC';
  const previewParamCandidate = String(settings.previewQueryParam || '').trim();
  const previewParam = /^[A-Za-z0-9_-]{2,40}$/.test(previewParamCandidate)
    ? previewParamCandidate
    : HOMEPAGE_EXPERIENCE_DEFAULTS.previewQueryParam;
  const search = new URLSearchParams(window.location.search);
  if (settings.allowPreviewQuery) {
    const previewChoice = normalizePreviewChoice(search.get(previewParam));
    if (previewChoice === 'LEGACY') {
      return settings.legacyHomepageEnabled === true ? 'LEGACY' : 'JENKS_STATIC';
    }
    if (previewChoice) return previewChoice;
  }
  if (settings.homepageTemplate === 'JENKS') {
    // In preview-safe mode, send users to the static v14 experience
    // instead of legacy fallback.
    if (settings.rolloutMode !== 'LIVE') {
      return 'JENKS_STATIC';
    }
    return 'JENKS_DYNAMIC';
  }
  // Guardrail: root runtime should never silently fall back to legacy.
  // Legacy remains available only via explicit preview override when enabled.
  if (settings.rolloutMode !== 'LIVE') {
    return 'JENKS_STATIC';
  }
  return 'JENKS_DYNAMIC';
};

export default function HomeEntry() {
  if (typeof window !== 'undefined') {
    // Never show a resolver prompt to public users; route immediately.
    window.location.replace(buildJenksStaticUrl());
    return null;
  }

  useEffect(() => {
    let cancelled = false;

    const redirectTo = (target: 'JENKS_DYNAMIC' | 'JENKS_STATIC' | 'LEGACY') => {
      if (cancelled || typeof window === 'undefined') return;
      if (target === 'JENKS_STATIC') {
        window.location.replace(buildJenksStaticUrl());
        return;
      }
      if (target === 'JENKS_DYNAMIC') {
        const destination = `${JENKS_HOME_PATH}${window.location.search || ''}${window.location.hash || ''}`;
        window.location.replace(destination);
        return;
      }
      // Even when legacy preview is requested and enabled, keep URL canonical.
      const destination = `${JENKS_HOME_PATH}${window.location.search || ''}${window.location.hash || ''}`;
      window.location.replace(destination);
    };

    const bootstrap = async () => {
      try {
        const response = await api.homepageSections.getExperienceSettings();
        const normalizedSettings = normalizeHomepageExperienceSettings(response?.data);
        const target = resolveHomepageTarget(normalizedSettings);
        redirectTo(target);
      } catch (error) {
        console.error('Failed to resolve homepage runtime route:', error);
        redirectTo('JENKS_STATIC');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
