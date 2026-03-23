import { useEffect } from 'react';
import { api } from '../services/api';
import {
  HOMEPAGE_EXPERIENCE_DEFAULTS,
  normalizeHomepageExperienceSettings,
  type HomepageExperienceSettings,
} from '../design/homepageExperience';

const KIMI_V14_PUBLIC_BASE = '/kimi-v14-r20260320-35';
const KIMI_V14_CACHE_BUST = '20260322-1';
const LEGACY_HOME_PATH = '/home-legacy';
const KIMI_HOME_PATH = '/home-kimi';
const KIMI_STATIC_HOME_PATH = '/home-kimi-static';

const buildKimiStaticUrl = () => `${KIMI_V14_PUBLIC_BASE}/index.html?v=${KIMI_V14_CACHE_BUST}`;

const normalizePreviewChoice = (
  value: string | null
): 'KIMI_DYNAMIC' | 'KIMI_STATIC' | 'LEGACY' | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;
  if (['kimi', 'kimi-dynamic', 'dynamic', 'react', '1', 'true', 'on'].includes(normalized)) return 'KIMI_DYNAMIC';
  if (['kimi-static', 'v14', 'static'].includes(normalized)) return 'KIMI_STATIC';
  if (['legacy', '0', 'false', 'off'].includes(normalized)) return 'LEGACY';
  return null;
};

const resolveHomepageTarget = (
  settings: HomepageExperienceSettings
): 'KIMI_DYNAMIC' | 'KIMI_STATIC' | 'LEGACY' => {
  if (typeof window === 'undefined') return 'LEGACY';
  const previewParamCandidate = String(settings.previewQueryParam || '').trim();
  const previewParam = /^[A-Za-z0-9_-]{2,40}$/.test(previewParamCandidate)
    ? previewParamCandidate
    : HOMEPAGE_EXPERIENCE_DEFAULTS.previewQueryParam;
  const search = new URLSearchParams(window.location.search);
  if (settings.allowPreviewQuery) {
    const previewChoice = normalizePreviewChoice(search.get(previewParam));
    if (previewChoice) return previewChoice;
  }
  if (settings.rolloutMode !== 'LIVE') {
    return 'LEGACY';
  }
  return settings.homepageTemplate === 'KIMI' ? 'KIMI_DYNAMIC' : 'LEGACY';
};

export default function HomeEntry() {
  useEffect(() => {
    let cancelled = false;

    const redirectTo = (target: 'KIMI_DYNAMIC' | 'KIMI_STATIC' | 'LEGACY') => {
      if (cancelled || typeof window === 'undefined') return;
      if (target === 'KIMI_STATIC') {
        window.location.replace(buildKimiStaticUrl());
        return;
      }
      if (target === 'KIMI_DYNAMIC') {
        const destination = `${KIMI_HOME_PATH}${window.location.search || ''}${window.location.hash || ''}`;
        window.location.replace(destination);
        return;
      }
      const destination = `${LEGACY_HOME_PATH}${window.location.search || ''}${window.location.hash || ''}`;
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
        redirectTo('LEGACY');
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1] px-4 text-center">
      <div>
        <p className="text-sm text-black/70">Resolving homepage runtime…</p>
        <a href={KIMI_HOME_PATH} className="mt-3 inline-block text-sm font-semibold underline">
          Continue to homepage
        </a>
        <a href={KIMI_STATIC_HOME_PATH} className="mt-2 block text-xs text-black/60 underline">
          Open static Kimi v14 fallback
        </a>
      </div>
    </div>
  );
}
