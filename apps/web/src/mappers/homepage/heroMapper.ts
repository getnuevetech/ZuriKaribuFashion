import { resolveAssetUrl } from '../../services/api';

export type HeroSlideDTO = {
  id: string;
  image: string;
  title: string;
  subtitle: string;
  badge: string;
  ctaText: string;
  ctaLink: string;
};

export type HeroQuickLinkDTO = {
  label: string;
  href: string;
};

type HeroMapperArgs = {
  heroSlidesData: unknown;
  managedBannersData: unknown;
  fallbackSlides: HeroSlideDTO[];
};

const asText = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const clampText = (value: unknown, maxLength: number, fallback = '') => {
  const source = asText(value, fallback);
  if (!source) return '';
  if (source.length <= maxLength) return source;
  return `${source.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
};

const safeHref = (...values: unknown[]) => {
  const fallback = asText(values[values.length - 1], '/shop') || '/shop';
  const href = asText(...values)
    .replace(/^\/designs(\/|$)/i, '/custom$1')
    .replace(/^\/custom-to-wear(\/|$)/i, '/custom$1');
  if (!href) return fallback;
  if (/^https?:\/\//i.test(href)) return href;
  if (!href.startsWith('/')) return fallback;
  return href;
};

const PUBLIC_BASE = (() => {
  const base = String(import.meta.env.BASE_URL || '/').trim();
  if (!base) return '/';
  return base.endsWith('/') ? base : `${base}/`;
})();

const normalizeImageUrl = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (raw.startsWith('/kimi/')) return `${PUBLIC_BASE}${raw.slice(1)}`;
  return resolveAssetUrl(raw) || raw;
};

const asImage = (...values: unknown[]) => {
  for (const value of values) {
    const resolved = normalizeImageUrl(value);
    if (resolved) return resolved;
  }
  return '';
};

export const mapHeroSlides = (args: HeroMapperArgs): HeroSlideDTO[] => {
  const fallbackSlides = Array.isArray(args.fallbackSlides) ? args.fallbackSlides : [];
  if (fallbackSlides.length === 0) {
    return [
      {
        id: 'fallback-hero-1',
        image: '/kimi/hero_model.jpg',
        title: 'ZURI KARIBU',
        subtitle: 'Made by Africans. Worn by the world.',
        badge: 'GLOBAL AFRICAN FASHION',
        ctaText: 'SHOP NOW',
        ctaLink: '/shop',
      },
    ];
  }

  const managedRows = Array.isArray(args.managedBannersData) ? args.managedBannersData : [];
  const heroBanners = managedRows
    .filter((row: any) => String(row?.section || '').trim().toUpperCase() === 'HERO')
    .map((row: any, index: number) => {
      const fallback = fallbackSlides[index % fallbackSlides.length];
      return {
        id: String(row?.id ?? `hero-banner-${index}`),
        image: asImage(row?.displayImage, row?.images?.[0], fallback.image),
        title: clampText(row?.title, 56, fallback.title),
        subtitle: clampText(row?.subtitle, 120, fallback.subtitle),
        badge: clampText(row?.badge, 24, fallback.badge),
        ctaText: clampText(row?.ctaText, 24, fallback.ctaText),
        ctaLink: safeHref(row?.ctaLink, fallback.ctaLink),
      } as HeroSlideDTO;
    });

  const sourceRows =
    heroBanners.length > 0
      ? heroBanners
      : Array.isArray(args.heroSlidesData) && args.heroSlidesData.length > 0
        ? args.heroSlidesData
        : fallbackSlides;

  const mapped = sourceRows
    .map((row: any, index: number) => {
      const fallback = fallbackSlides[index % fallbackSlides.length];
      return {
        id: String(row?.id ?? fallback.id ?? index),
        image: asImage(row?.image, fallback.image),
        title: clampText(row?.title, 56, fallback.title),
        subtitle: clampText(row?.subtitle, 120, fallback.subtitle),
        badge: clampText(row?.badge, 24, fallback.badge),
        ctaText: clampText(row?.ctaText, 24, fallback.ctaText),
        ctaLink: safeHref(row?.ctaLink, fallback.ctaLink),
      } as HeroSlideDTO;
    })
    .filter((row) => Boolean(row.image && row.title));

  return mapped.length > 0 ? mapped : fallbackSlides;
};

export const mapHeroQuickLinks = (rawKimiCopy: unknown): HeroQuickLinkDTO[] => {
  const kimiCopy = rawKimiCopy && typeof rawKimiCopy === 'object' ? (rawKimiCopy as Record<string, unknown>) : {};
  return [
    {
      label: clampText(kimiCopy.quickPathRtwLabel, 32, 'Ready to Wear'),
      href: '/ready-to-wear',
    },
    {
      label: clampText(kimiCopy.quickPathCustomLabel, 32, 'Custom'),
      href: '/custom',
    },
    {
      label: clampText(kimiCopy.quickPathFabricsLabel, 32, 'Fabrics'),
      href: '/fabrics',
    },
  ];
};
