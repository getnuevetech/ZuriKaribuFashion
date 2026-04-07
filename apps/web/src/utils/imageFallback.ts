const LEGACY_FALLBACK_IMAGE_HINTS = [
  '/images/placeholder.jpg',
  '/hero_model.jpg',
  '/rw_hero.jpg',
  '/rw_full.jpg',
  '/fabrics_full.jpg',
  '/custom_full.jpg',
  '/featured_rw_left.jpg',
  '/featured_rw_right.jpg',
  '/featured_custom_left.jpg',
  '/featured_custom_right.jpg',
  '/designer_spotlight.jpg',
  '/heritage_story.jpg',
  '/product1.jpg',
  '/product2.jpg',
  '/product3.jpg',
  '/product4.jpg',
  '/product5.jpg',
  '/product6.jpg',
];

const normalizePathname = (value: string) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw, 'https://fallback.local');
    return String(parsed.pathname || '').toLowerCase();
  } catch {
    return raw.toLowerCase().split('?')[0].split('#')[0];
  }
};

export const stripLegacyFallbackImage = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const pathname = normalizePathname(raw);
  if (!pathname) return raw;
  const isLegacyFallback = LEGACY_FALLBACK_IMAGE_HINTS.some((hint) => pathname.endsWith(hint));
  return isLegacyFallback ? '' : raw;
};
