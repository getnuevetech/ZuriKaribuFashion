import { useEffect } from 'react';

const CLEAN_STATIC_HOME_PATH = '/main/';

const buildJenksUrl = () => {
  if (typeof window === 'undefined') return CLEAN_STATIC_HOME_PATH;
  return `${CLEAN_STATIC_HOME_PATH}${window.location.search || ''}${window.location.hash || ''}`;
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
