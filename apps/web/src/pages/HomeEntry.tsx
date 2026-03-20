import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Home from './Home';
import HomeKimi from './HomeKimi';
import { api } from '../services/api';
import {
  HOMEPAGE_EXPERIENCE_DEFAULTS,
  normalizeHomepageExperienceSettings,
  type HomepageTemplate,
} from '../design/homepageExperience';

const PREVIEW_QUERY_ALIASES = ['homePreview', 'home_preview', 'zkHomePreview'];

const normalizeTemplate = (value: string | null | undefined): HomepageTemplate | null => {
  const candidate = String(value || '').trim().toUpperCase();
  if (candidate === 'KIMI') return 'KIMI';
  if (candidate === 'LEGACY') return 'LEGACY';
  return null;
};

const getPreviewTemplateFromSearch = (search: string, primaryParam: string): HomepageTemplate | null => {
  const params = new URLSearchParams(search);
  const primary = normalizeTemplate(params.get(primaryParam));
  if (primary) return primary;
  for (const alias of PREVIEW_QUERY_ALIASES) {
    const candidate = normalizeTemplate(params.get(alias));
    if (candidate) return candidate;
  }
  return null;
};

export default function HomeEntry() {
  const location = useLocation();
  const { data: experienceSettingsData } = useQuery({
    queryKey: ['homepageExperienceSettings'],
    queryFn: async () => {
      const response = await api.homepageSections.getExperienceSettings();
      return response.success ? response.data : null;
    },
  });
  const experienceSettings = useMemo(
    () => normalizeHomepageExperienceSettings(experienceSettingsData || HOMEPAGE_EXPERIENCE_DEFAULTS),
    [experienceSettingsData]
  );

  const resolvedTemplate = useMemo<HomepageTemplate>(() => {
    if (experienceSettings.rolloutMode === 'LIVE') {
      return experienceSettings.homepageTemplate;
    }
    if (!experienceSettings.allowPreviewQuery) {
      return 'LEGACY';
    }
    const previewTemplate = getPreviewTemplateFromSearch(
      location.search,
      experienceSettings.previewQueryParam || HOMEPAGE_EXPERIENCE_DEFAULTS.previewQueryParam
    );
    return previewTemplate || 'LEGACY';
  }, [experienceSettings, location.search]);

  return resolvedTemplate === 'KIMI' ? <HomeKimi /> : <Home />;
}

