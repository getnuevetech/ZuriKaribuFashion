import { useEffect } from 'react';

const KIMI_V14_PUBLIC_BASE = '/kimi-v14-r20260320-35';
const KIMI_V14_CACHE_BUST = '20260322-1';

const buildJenksUrl = () => {
  const base = `${KIMI_V14_PUBLIC_BASE}/index.html?v=${KIMI_V14_CACHE_BUST}`;
  if (typeof window === 'undefined') return base;
  const rawSearch = String(window.location.search || '').trim();
  const search = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
  const hash = String(window.location.hash || '');
  const withSearch = search ? `${base}&${search}` : base;
  return `${withSearch}${hash}`;
};

export function JenksV14Redirect() {
  useEffect(() => {
    window.location.replace(buildJenksUrl());
  }, []);

  const destination = buildJenksUrl();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1] px-4 text-center">
      <div>
        <p className="text-sm text-black/70">Opening Jenks v14 page…</p>
        <a href={destination} className="mt-3 inline-block text-sm font-semibold underline">
          Continue if not redirected
        </a>
      </div>
    </div>
  );
}

// Backward-compatible named export for existing imports.
export const KimiV14Redirect = JenksV14Redirect;

