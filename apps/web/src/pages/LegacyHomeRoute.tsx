import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../services/api';
import { normalizeHomepageExperienceSettings } from '../design/homepageExperience';
import Home from './Home';

export default function LegacyHomeRoute() {
  const [legacyEnabled, setLegacyEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      try {
        const response = await api.homepageSections.getJenksHomepageConfig();
        const settings = normalizeHomepageExperienceSettings(response?.data?.experience);
        if (!cancelled) {
          setLegacyEnabled(settings.legacyHomepageEnabled === true);
        }
      } catch {
        if (!cancelled) {
          setLegacyEnabled(false);
        }
      }
    };
    void resolve();
    return () => {
      cancelled = true;
    };
  }, []);

  if (legacyEnabled === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1] px-4 text-center">
        <p className="text-sm text-black/70">Resolving homepage runtime…</p>
      </div>
    );
  }

  if (!legacyEnabled) {
    return <Navigate to="/home" replace />;
  }

  return <Home />;
}
