import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const KIMI_V14_PUBLIC_BASE = '/kimi-v14-r20260320';
const KIMI_V14_CACHE_BUST = '20260320-1';

const buildKimiUrl = (targetPath: string) => {
  const normalizedTarget = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  const base = `${KIMI_V14_PUBLIC_BASE}/index.html?v=${KIMI_V14_CACHE_BUST}`;
  if (normalizedTarget === '/') return base;
  if (normalizedTarget === '/ready-to-wear') return `${base}#ready-to-wear`;
  if (normalizedTarget === '/fabrics') return `${base}#fabrics`;
  if (normalizedTarget === '/designs' || normalizedTarget === '/custom' || normalizedTarget === '/custom-to-wear') {
    return `${base}#custom`;
  }
  return base;
};

export function KimiV14Redirect({ targetPath }: { targetPath: string }) {
  useEffect(() => {
    window.location.replace(buildKimiUrl(targetPath));
  }, [targetPath]);

  const destination = buildKimiUrl(targetPath);
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

export function KimiV14ProductRedirect() {
  const location = useLocation();
  const targetPath = location.pathname;

  useEffect(() => {
    window.location.replace(buildKimiUrl(targetPath));
  }, [targetPath]);

  const destination = buildKimiUrl(targetPath);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f8f6f1] px-4 text-center">
      <div>
        <p className="text-sm text-black/70">Opening Kimi v14 product page…</p>
        <a href={destination} className="mt-3 inline-block text-sm font-semibold underline">
          Continue if not redirected
        </a>
      </div>
    </div>
  );
}

