import { useEffect } from 'react';

const KIMI_V14_PUBLIC_BASE = '/kimi-v14-r20260320-33';
const KIMI_V14_CACHE_BUST = '20260320-33';

const buildKimiUrl = () => {
  const base = `${KIMI_V14_PUBLIC_BASE}/index.html?v=${KIMI_V14_CACHE_BUST}`;
  return base;
};

export function KimiV14Redirect() {
  useEffect(() => {
    window.location.replace(buildKimiUrl());
  }, []);

  const destination = buildKimiUrl();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1] px-4 text-center">
      <div>
        <p className="text-sm text-black/70">Opening Kimi v14 page…</p>
        <a href={destination} className="mt-3 inline-block text-sm font-semibold underline">
          Continue if not redirected
        </a>
      </div>
    </div>
  );
}

