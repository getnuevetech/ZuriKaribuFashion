import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;
const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

// Create axios instance
const httpClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
httpClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const url = error.config?.url || '';
    const isAuthRequest =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/google') ||
      url.endsWith('/google') ||
      url.includes('/google-login') ||
      url.includes('/login/google');
    if (error.response?.status === 401 && !isAuthRequest) {
      useAuthStore.getState().logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Generic API methods
const apiService = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    httpClient.get<T>(url, config).then((res) => res.data),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    httpClient.post<T>(url, data, config).then((res) => res.data),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    httpClient.patch<T>(url, data, config).then((res) => res.data),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    httpClient.put<T>(url, data, config).then((res) => res.data),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    httpClient.delete<T>(url, config).then((res) => res.data),
};

const isRouteNotFoundError = (error: unknown) =>
  (error as AxiosError)?.response?.status === 404;
const isMethodNotAllowedError = (error: unknown) =>
  (error as AxiosError)?.response?.status === 405;
const isRouteNotFoundMessageError = (error: unknown) => {
  const message = String((error as AxiosError)?.response?.data?.message || '').toLowerCase();
  return message.includes('route not found') || message.includes('not found');
};
const isRetryableRouteError = (error: unknown) =>
  isRouteNotFoundError(error) || isMethodNotAllowedError(error) || isRouteNotFoundMessageError(error);

type TopStripPayload = {
  messages: string[];
  separator: string;
  repeatCount: number;
  animationSeconds: number;
  fontSize: number;
  isBold: boolean;
  pauseOnHover: boolean;
  textColor: string;
  backgroundColor: string;
};
type StatsStripItemPayload = {
  value: string;
  suffix: string;
  label: string;
  displayOrder: number;
  isActive: boolean;
};
type StatsStripPayload = {
  items: StatsStripItemPayload[];
  backgroundImage: string;
  backgroundColor: string;
  overlayColor: string;
  overlayOpacity: number;
  valueColor: string;
  suffixColor: string;
  labelColor: string;
};
type FeaturedProductDescriptionSettingsPayload = {
  wordLimit: number;
};

const TOP_STRIP_DEFAULTS: TopStripPayload = {
  messages: ['Free shipping on orders over $250', 'New arrivals weekly', 'Authentic African designs'],
  separator: '•',
  repeatCount: 4,
  animationSeconds: 20,
  fontSize: 12,
  isBold: false,
  pauseOnHover: true,
  textColor: '#ffffff',
  backgroundColor: '#000000',
};
const STATS_STRIP_DEFAULTS: StatsStripPayload = {
  items: [
    { value: '120', suffix: '+', label: 'COUNTRIES', displayOrder: 0, isActive: true },
    { value: '50', suffix: 'K+', label: 'DESIGNERS', displayOrder: 1, isActive: true },
    { value: '1', suffix: 'M+', label: 'FABRICS', displayOrder: 2, isActive: true },
    { value: '100', suffix: 'K+', label: 'PRODUCTS', displayOrder: 3, isActive: true },
  ],
  backgroundImage: '',
  backgroundColor: '#111827',
  overlayColor: '#000000',
  overlayOpacity: 45,
  valueColor: '#ffffff',
  suffixColor: '#facc15',
  labelColor: '#d1d5db',
};
const FEATURED_PRODUCT_DESCRIPTION_SETTINGS_DEFAULTS: FeaturedProductDescriptionSettingsPayload = {
  wordLimit: 12,
};

const TOP_STRIP_BANNER_SECTION = 'TOP_STRIP';
const TOP_STRIP_BANNER_PREFIX = 'TOP_STRIP_JSON:';
const STATS_STRIP_BANNER_SECTION = 'STATS_STRIP';
const STATS_STRIP_BANNER_PREFIX = 'STATS_STRIP_JSON:';
const TOP_STRIP_BANNER_PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const normalizeHexColor = (value: unknown, fallback: string) => {
  const trimmed = String(value || '').trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(trimmed) ? trimmed.toLowerCase() : fallback;
};

const normalizeTopStripPayload = (raw: unknown): TopStripPayload => {
  if (!raw || typeof raw !== 'object') return { ...TOP_STRIP_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const messages = Array.isArray(row.messages)
    ? row.messages.map((entry) => String(entry || '').trim()).filter(Boolean)
    : [];
  const repeatCount = Number(row.repeatCount);
  const animationSeconds = Number(row.animationSeconds);
  const fontSize = Number(row.fontSize);
  const pauseOnHover = typeof row.pauseOnHover === 'boolean' ? row.pauseOnHover : TOP_STRIP_DEFAULTS.pauseOnHover;
  const separator = String(row.separator || '').trim();
  return {
    messages: messages.length > 0 ? messages : [...TOP_STRIP_DEFAULTS.messages],
    separator: separator.length > 0 ? separator.slice(0, 8) : TOP_STRIP_DEFAULTS.separator,
    repeatCount: Number.isFinite(repeatCount) ? Math.max(2, Math.min(12, Math.round(repeatCount))) : TOP_STRIP_DEFAULTS.repeatCount,
    animationSeconds: Number.isFinite(animationSeconds)
      ? Math.max(8, Math.min(120, Math.round(animationSeconds)))
      : TOP_STRIP_DEFAULTS.animationSeconds,
    fontSize: Number.isFinite(fontSize) ? Math.max(10, Math.min(40, Math.round(fontSize))) : TOP_STRIP_DEFAULTS.fontSize,
    isBold: typeof row.isBold === 'boolean' ? row.isBold : TOP_STRIP_DEFAULTS.isBold,
    pauseOnHover,
    textColor: normalizeHexColor(row.textColor, TOP_STRIP_DEFAULTS.textColor),
    backgroundColor: normalizeHexColor(row.backgroundColor, TOP_STRIP_DEFAULTS.backgroundColor),
  };
};
const normalizeStatsStripPayload = (raw: unknown): StatsStripPayload => {
  if (!raw || typeof raw !== 'object') {
    return { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] };
  }
  const row = raw as Record<string, unknown>;
  const items = Array.isArray(row.items)
    ? row.items
        .map((entry, index) => {
          if (!entry || typeof entry !== 'object') return null;
          const item = entry as Record<string, unknown>;
          const value = String(item.value || '').trim();
          const label = String(item.label || '').trim().toUpperCase();
          if (!value || !label) return null;
          const suffix = String(item.suffix || '').trim();
          const displayOrderRaw = Number(item.displayOrder);
          return {
            value: value.slice(0, 20),
            suffix: suffix.slice(0, 8),
            label: label.slice(0, 40),
            displayOrder: Number.isFinite(displayOrderRaw) ? Math.max(0, Math.min(100, Math.round(displayOrderRaw))) : index,
            isActive: typeof item.isActive === 'boolean' ? item.isActive : true,
          } as StatsStripItemPayload;
        })
        .filter((entry): entry is StatsStripItemPayload => Boolean(entry))
        .sort((a, b) => a.displayOrder - b.displayOrder)
    : [];
  return {
    items: items.length > 0 ? items : [...STATS_STRIP_DEFAULTS.items],
    backgroundImage: String(row.backgroundImage || '').trim(),
    backgroundColor: normalizeHexColor(row.backgroundColor, STATS_STRIP_DEFAULTS.backgroundColor),
    overlayColor: normalizeHexColor(row.overlayColor, STATS_STRIP_DEFAULTS.overlayColor),
    overlayOpacity: Math.max(
      0,
      Math.min(100, Math.round(Number.isFinite(Number(row.overlayOpacity)) ? Number(row.overlayOpacity) : STATS_STRIP_DEFAULTS.overlayOpacity))
    ),
    valueColor: normalizeHexColor(row.valueColor, STATS_STRIP_DEFAULTS.valueColor),
    suffixColor: normalizeHexColor(row.suffixColor, STATS_STRIP_DEFAULTS.suffixColor),
    labelColor: normalizeHexColor(row.labelColor, STATS_STRIP_DEFAULTS.labelColor),
  };
};

const parseTopStripPayloadFromBanner = (banner: any): TopStripPayload | null => {
  const ctaLink = String(banner?.ctaLink || '');
  if (!ctaLink.startsWith(TOP_STRIP_BANNER_PREFIX)) return null;
  try {
    const encoded = ctaLink.slice(TOP_STRIP_BANNER_PREFIX.length);
    const parsed = JSON.parse(decodeURIComponent(encoded));
    return normalizeTopStripPayload(parsed);
  } catch {
    return null;
  }
};
const parseStatsStripPayloadFromBanner = (banner: any): StatsStripPayload | null => {
  const ctaLink = String(banner?.ctaLink || '');
  if (!ctaLink.startsWith(STATS_STRIP_BANNER_PREFIX)) return null;
  try {
    const encoded = ctaLink.slice(STATS_STRIP_BANNER_PREFIX.length);
    const parsed = JSON.parse(decodeURIComponent(encoded));
    return normalizeStatsStripPayload(parsed);
  } catch {
    return null;
  }
};

const topStripReadPathsAdmin = [
  '/homepage-sections/admin/top-strip',
  '/homepage/admin/top-strip',
  '/admin/top-strip',
  '/admin/homepage/top-strip',
  '/admin/homepage-sections/top-strip',
];
const topStripReadPathsPublic = [
  '/homepage-sections/top-strip',
  '/homepage/top-strip',
];
const homepageVisibilityReadPathsPublic = [
  '/homepage-sections/visibility',
  '/homepage/visibility',
];
const homepageVisibilityReadPathsAdmin = [
  '/homepage-sections/admin/visibility',
  '/homepage/admin/visibility',
  '/admin/visibility',
  '/admin/homepage/visibility',
  '/admin/homepage-sections/visibility',
];
const homepageVisibilityWritePathsAdmin = [
  '/homepage-sections/admin/visibility',
  '/homepage/admin/visibility',
  '/admin/visibility',
  '/admin/homepage/visibility',
  '/admin/homepage-sections/visibility',
];
const statsStripReadPathsAdmin = [
  '/homepage-sections/admin/stats-strip',
  '/homepage/admin/stats-strip',
  '/admin/stats-strip',
  '/admin/homepage/stats-strip',
  '/admin/homepage-sections/stats-strip',
];
const statsStripReadPathsPublic = [
  '/homepage-sections/stats-strip',
  '/homepage/stats-strip',
];
const statsStripWritePaths = [
  '/homepage-sections/admin/stats-strip',
  '/homepage/admin/stats-strip',
  '/admin/stats-strip',
  '/admin/homepage/stats-strip',
  '/admin/homepage-sections/stats-strip',
];
const featuredProductDescriptionReadPathsAdmin = [
  '/homepage-sections/admin/featured-product-description-settings',
  '/admin/featured-product-description-settings',
];
const featuredProductDescriptionReadPathsPublic = [
  '/homepage-sections/featured-product-description-settings',
];
const featuredProductDescriptionWritePaths = [
  '/homepage-sections/admin/featured-product-description-settings',
  '/admin/featured-product-description-settings',
];

const topStripWritePaths = [
  '/homepage-sections/admin/top-strip',
  '/homepage/admin/top-strip',
  '/admin/top-strip',
  '/admin/homepage/top-strip',
  '/admin/homepage-sections/top-strip',
];

async function readHomepageVisibilityPublicWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of homepageVisibilityReadPathsPublic) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Homepage visibility route not found.');
}

async function readHomepageVisibilityAdminWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of homepageVisibilityReadPathsAdmin) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Admin homepage visibility route not found.');
}

async function writeHomepageVisibilityAdminWithFallback<T>(visibility: Record<string, boolean>) {
  let lastError: unknown = null;
  for (const path of homepageVisibilityWritePathsAdmin) {
    try {
      return await apiService.put<T>(path, { visibility });
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      return await apiService.patch<T>(path, { visibility });
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  throw lastError ?? new Error('Admin homepage visibility route not found.');
}

async function readTopStripWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths = mode === 'admin'
    ? [...topStripReadPathsAdmin, ...topStripReadPathsPublic]
    : [...topStripReadPathsPublic];
  for (const path of readPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) {
        continue;
      }
      throw error;
    }
  }

  try {
    if (mode === 'admin') {
      const adminBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all');
      const topStripBanner = (adminBanners.data || []).find(
        (banner: any) => String(banner?.section || '').toUpperCase() === TOP_STRIP_BANNER_SECTION
      );
      const parsed = parseTopStripPayloadFromBanner(topStripBanner);
      return {
        success: true,
        data: parsed || { ...TOP_STRIP_DEFAULTS },
      } as T;
    }
    const publicBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners', {
      params: { section: TOP_STRIP_BANNER_SECTION },
    });
    const topStripBanner = Array.isArray(publicBanners.data) ? publicBanners.data[0] : null;
    const parsed = parseTopStripPayloadFromBanner(topStripBanner);
    return {
      success: true,
      data: parsed || { ...TOP_STRIP_DEFAULTS },
    } as T;
  } catch (bannerFallbackError) {
    if (!isRetryableRouteError(bannerFallbackError)) {
      throw bannerFallbackError;
    }
  }

  throw lastError ?? new Error('Top strip route not found.');
}

async function writeTopStripWithFallback<T>(data: unknown) {
  let lastError: unknown = null;
  for (const path of topStripWritePaths) {
    try {
      return await apiService.put<T>(path, data);
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) {
        throw putError;
      }
    }
    try {
      return await apiService.patch<T>(path, data);
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) {
        throw patchError;
      }
    }
  }

  try {
    const normalized = normalizeTopStripPayload(data);
    const payloadString = `${TOP_STRIP_BANNER_PREFIX}${encodeURIComponent(JSON.stringify(normalized))}`;
    const adminBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all');
    const topStripBanner = (adminBanners.data || []).find(
      (banner: any) => String(banner?.section || '').toUpperCase() === TOP_STRIP_BANNER_SECTION
    );
    const payload = {
      name: topStripBanner?.name || 'Top Strip Settings',
      section: TOP_STRIP_BANNER_SECTION,
      title: topStripBanner?.title || 'Top Strip',
      subtitle: normalized.messages.join(' | '),
      ctaText: 'SYSTEM_TOP_STRIP',
      ctaLink: payloadString,
      images:
        Array.isArray(topStripBanner?.images) && topStripBanner.images.length > 0
          ? topStripBanner.images
          : [TOP_STRIP_BANNER_PLACEHOLDER_IMAGE],
      isActive: true,
      displayOrder: Number(topStripBanner?.displayOrder || 0),
    };
    const response = topStripBanner?.id
      ? await apiService.put<{ success: boolean; data: any }>(`/banners/${topStripBanner.id}`, payload)
      : await apiService.post<{ success: boolean; data: any }>('/banners', payload);
    const parsed = parseTopStripPayloadFromBanner(response?.data);
    return {
      success: true,
      data: parsed || normalized,
    } as T;
  } catch (bannerWriteError) {
    if (!isRetryableRouteError(bannerWriteError)) {
      throw bannerWriteError;
    }
  }

  throw lastError ?? new Error('Top strip route not found.');
}
async function readStatsStripWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths = mode === 'admin'
    ? [...statsStripReadPathsAdmin, ...statsStripReadPathsPublic]
    : [...statsStripReadPathsPublic];
  for (const path of readPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }

  try {
    if (mode === 'admin') {
      const adminBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all');
      const statsStripBanner = (adminBanners.data || []).find(
        (banner: any) => String(banner?.section || '').toUpperCase() === STATS_STRIP_BANNER_SECTION
      );
      const parsed = parseStatsStripPayloadFromBanner(statsStripBanner);
      if (parsed) {
        return {
          success: true,
          data: parsed,
        } as T;
      }
    } else {
      const publicBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners', {
        params: { section: STATS_STRIP_BANNER_SECTION },
      });
      const statsStripBanner = Array.isArray(publicBanners.data) ? publicBanners.data[0] : null;
      const parsed = parseStatsStripPayloadFromBanner(statsStripBanner);
      if (parsed) {
        return {
          success: true,
          data: parsed,
        } as T;
      }
    }
  } catch (bannerFallbackError) {
    if (!isRetryableRouteError(bannerFallbackError)) {
      throw bannerFallbackError;
    }
  }

  return {
    success: true,
    data: { ...STATS_STRIP_DEFAULTS, items: [...STATS_STRIP_DEFAULTS.items] },
  } as T;
}
async function writeStatsStripWithFallback<T>(data: unknown) {
  const normalized = normalizeStatsStripPayload(data);
  let lastError: unknown = null;
  for (const path of statsStripWritePaths) {
    try {
      return await apiService.put<T>(path, normalized);
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      return await apiService.patch<T>(path, normalized);
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  try {
    const payloadString = `${STATS_STRIP_BANNER_PREFIX}${encodeURIComponent(JSON.stringify(normalized))}`;
    const adminBanners = await apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all');
    const statsStripBanner = (adminBanners.data || []).find(
      (banner: any) => String(banner?.section || '').toUpperCase() === STATS_STRIP_BANNER_SECTION
    );
    const payload = {
      name: statsStripBanner?.name || 'Stats Strip Settings',
      section: STATS_STRIP_BANNER_SECTION,
      title: statsStripBanner?.title || 'Stats Strip',
      subtitle: normalized.items.filter((item) => item.isActive).map((item) => `${item.value}${item.suffix || ''} ${item.label}`).join(' | '),
      ctaText: 'SYSTEM_STATS_STRIP',
      ctaLink: payloadString,
      images:
        Array.isArray(statsStripBanner?.images) && statsStripBanner.images.length > 0
          ? statsStripBanner.images
          : [TOP_STRIP_BANNER_PLACEHOLDER_IMAGE],
      isActive: true,
      displayOrder: Number(statsStripBanner?.displayOrder || 0),
    };
    const response = statsStripBanner?.id
      ? await apiService.put<{ success: boolean; data: any }>(`/banners/${statsStripBanner.id}`, payload)
      : await apiService.post<{ success: boolean; data: any }>('/banners', payload);
    const parsed = parseStatsStripPayloadFromBanner(response?.data);
    return {
      success: true,
      data: parsed || normalized,
    } as T;
  } catch (bannerWriteError) {
    if (!isRetryableRouteError(bannerWriteError)) {
      throw bannerWriteError;
    }
  }
  throw lastError ?? new Error('Stats strip route not found.');
}
async function readFeaturedProductDescriptionSettingsWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths = mode === 'admin'
    ? [...featuredProductDescriptionReadPathsAdmin, ...featuredProductDescriptionReadPathsPublic]
    : [...featuredProductDescriptionReadPathsPublic];
  for (const path of readPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  return {
    success: true,
    data: { ...FEATURED_PRODUCT_DESCRIPTION_SETTINGS_DEFAULTS },
  } as T;
}
async function writeFeaturedProductDescriptionSettingsWithFallback<T>(data: unknown) {
  const parsedWordLimit = Number((data as any)?.wordLimit);
  const normalized = {
    wordLimit: Number.isFinite(parsedWordLimit) ? Math.max(5, Math.min(60, Math.round(parsedWordLimit))) : 12,
  };
  let lastError: unknown = null;
  for (const path of featuredProductDescriptionWritePaths) {
    try {
      return await apiService.put<T>(path, normalized);
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      return await apiService.patch<T>(path, normalized);
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  throw lastError ?? new Error('Featured product description settings route not found.');
}

const countryImageGenerationPaths = [
  '/homepage-sections/admin/country-image-generation',
  '/homepage/admin/country-image-generation',
  '/admin/country-image-generation',
  '/admin/homepage/country-image-generation',
  '/admin/homepage-sections/country-image-generation',
];

type HowItWorksStylePayload = {
  enabled: boolean;
  iconColor: string;
  iconHoverColor: string;
};

const HOW_IT_WORKS_STYLE_DEFAULTS: HowItWorksStylePayload = {
  enabled: false,
  iconColor: '#111827',
  iconHoverColor: '#ffffff',
};

const normalizeHowItWorksStylePayload = (raw: unknown): HowItWorksStylePayload => {
  if (!raw || typeof raw !== 'object') return { ...HOW_IT_WORKS_STYLE_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    enabled: typeof row.enabled === 'boolean' ? row.enabled : HOW_IT_WORKS_STYLE_DEFAULTS.enabled,
    iconColor: normalizeHexColor(row.iconColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconColor),
    iconHoverColor: normalizeHexColor(row.iconHoverColor, HOW_IT_WORKS_STYLE_DEFAULTS.iconHoverColor),
  };
};

const howItWorksStyleReadPathsPublic = [
  '/homepage-sections/how-it-works-style',
  '/homepage/how-it-works-style',
];
const howItWorksStyleReadPathsAdmin = [
  '/homepage-sections/admin/how-it-works-style',
  '/homepage/admin/how-it-works-style',
  '/admin/how-it-works-style',
  '/admin/homepage/how-it-works-style',
  '/admin/homepage-sections/how-it-works-style',
];

const howItWorksStyleWritePaths = [
  '/homepage-sections/admin/how-it-works-style',
  '/homepage/admin/how-it-works-style',
  '/admin/how-it-works-style',
  '/admin/homepage/how-it-works-style',
  '/admin/homepage-sections/how-it-works-style',
];

const homepageCategoryReadPaths = [
  '/homepage-sections/categories',
  '/homepage/categories',
];

const designerOptionsReadPaths = [
  '/homepage-sections/admin/designer-options',
  '/homepage/admin/designer-options',
  '/admin/designer-options',
];
const designerSpotlightsReadPaths = [
  '/homepage-sections/designer-spotlights',
  '/homepage-sections/designer-spotlight',
  '/homepage/designer-spotlights',
  '/homepage/designer-spotlight',
];

type NormalizedDesignerOption = {
  id: string;
  businessName: string;
  country: string;
  vendorType: 'DESIGNER' | 'SELLER';
};

const normalizeDesignerOptionRows = (
  rows: unknown[],
  defaultVendorType: 'DESIGNER' | 'SELLER'
): NormalizedDesignerOption[] =>
  rows
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const id = String(
        row.id ??
          row.profileId ??
          row.designerId ??
          row.sellerId ??
          row.userId ??
          ''
      ).trim();
      if (!id) return null;
      const vendorTypeRaw = String(row.vendorType || '').trim().toUpperCase();
      const vendorType: 'DESIGNER' | 'SELLER' =
        vendorTypeRaw === 'SELLER' ? 'SELLER' : defaultVendorType;
      const businessName = String(
        row.businessName ??
          row.name ??
          row.fullName ??
          row.displayName ??
          row.email ??
          `${vendorType === 'SELLER' ? 'Seller' : 'Designer'} ${id.slice(0, 8)}`
      ).trim();
      const country = String(row.country ?? row.location ?? '').trim();
      return {
        id,
        businessName: businessName || `${vendorType === 'SELLER' ? 'Seller' : 'Designer'} ${id.slice(0, 8)}`,
        country,
        vendorType,
      };
    })
    .filter((row): row is NormalizedDesignerOption => Boolean(row));

const normalizeDesignerOptionsPayload = (payload: unknown): NormalizedDesignerOption[] => {
  const data = (payload as any)?.data ?? payload;
  let combined: NormalizedDesignerOption[] = [];

  if (Array.isArray(data)) {
    combined = normalizeDesignerOptionRows(data, 'DESIGNER');
  } else if (data && typeof data === 'object') {
    const row = data as Record<string, unknown>;
    const designers = Array.isArray(row.designers) ? normalizeDesignerOptionRows(row.designers, 'DESIGNER') : [];
    const sellers = Array.isArray(row.sellers) ? normalizeDesignerOptionRows(row.sellers, 'SELLER') : [];
    combined = [...designers, ...sellers];
  }

  const byId = new Map<string, NormalizedDesignerOption>();
  for (const item of combined) {
    if (!item.id) continue;
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return Array.from(byId.values()).sort((a, b) => a.businessName.localeCompare(b.businessName));
};

async function readDesignerOptionsFromVendorProfilesFallback() {
  const response = await apiService.get<{
    success: boolean;
    data?: {
      profiles?: Array<{
        role?: string;
        profileId?: string;
        userId?: string;
        businessName?: string;
        profileData?: Record<string, unknown> | null;
        user?: {
          firstName?: string | null;
          lastName?: string | null;
          email?: string | null;
        } | null;
      }>;
    };
  }>('/admin/vendor-profiles', { params: { page: 1, limit: 100 } });
  const rows = Array.isArray(response?.data?.profiles) ? response.data.profiles : [];
  const mapped = rows
    .map((row) => {
      const role = String(row.role || '').toUpperCase();
      const vendorType: 'DESIGNER' | 'SELLER' =
        role === 'FABRIC_SELLER' ? 'SELLER' : 'DESIGNER';
      const id = String(row.profileId || '').trim();
      if (!id) return null;
      const fallbackName =
        `${row.user?.firstName || ''} ${row.user?.lastName || ''}`.trim() ||
        String(row.user?.email || '').trim() ||
        `${vendorType === 'SELLER' ? 'Seller' : 'Designer'} ${id.slice(0, 8)}`;
      const businessName = String(row.businessName || '').trim() || fallbackName;
      const profileCountry = String((row.profileData?.country as string) || '').trim();
      return {
        id,
        businessName,
        country: profileCountry,
        vendorType,
      };
    })
    .filter((row): row is NormalizedDesignerOption => Boolean(row));
  const deduped = new Map<string, NormalizedDesignerOption>();
  for (const item of mapped) {
    if (!deduped.has(item.id)) deduped.set(item.id, item);
  }
  return Array.from(deduped.values()).sort((a, b) => a.businessName.localeCompare(b.businessName));
}

async function readHowItWorksStyleWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths = mode === 'admin'
    ? [...howItWorksStyleReadPathsAdmin, ...howItWorksStyleReadPathsPublic]
    : [...howItWorksStyleReadPathsPublic];
  for (const path of readPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) {
        continue;
      }
      throw error;
    }
  }
  return {
    success: true,
    data: { ...HOW_IT_WORKS_STYLE_DEFAULTS },
  } as T;
}

async function writeHowItWorksStyleWithFallback<T>(data: unknown) {
  const normalized = normalizeHowItWorksStylePayload(data);
  let lastError: unknown = null;
  for (const path of howItWorksStyleWritePaths) {
    try {
      return await apiService.put<T>(path, normalized);
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) {
        throw putError;
      }
    }
    try {
      return await apiService.patch<T>(path, normalized);
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) {
        throw patchError;
      }
    }
  }
  throw lastError ?? new Error('How it works style route not found.');
}

async function readHomepageCategoriesWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of homepageCategoryReadPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) {
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error('Homepage categories route not found.');
}

async function readDesignerOptionsWithFallback<T>() {
  let lastError: unknown = null;
  let sawEmptySuccess = false;
  for (const path of designerOptionsReadPaths) {
    try {
      const response = await apiService.get<any>(path);
      const normalized = normalizeDesignerOptionsPayload(response);
      if (normalized.length > 0) {
        return {
          success: true,
          data: normalized,
        } as T;
      }
      sawEmptySuccess = true;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) {
        continue;
      }
      throw error;
    }
  }
  try {
    const vendorProfileOptions = await readDesignerOptionsFromVendorProfilesFallback();
    if (vendorProfileOptions.length > 0) {
      return {
        success: true,
        data: vendorProfileOptions,
      } as T;
    }
  } catch (vendorProfileError) {
    if (!isRetryableRouteError(vendorProfileError)) {
      lastError = vendorProfileError;
    }
  }
  try {
    const productOptions = await apiService.get<any>('/admin/products/options');
    const designers = normalizeDesignerOptionRows(
      Array.isArray(productOptions?.data?.designers) ? productOptions.data.designers : [],
      'DESIGNER'
    );
    const sellers = normalizeDesignerOptionRows(
      Array.isArray(productOptions?.data?.sellers) ? productOptions.data.sellers : [],
      'SELLER'
    );
    const combined = [...designers, ...sellers];
    return {
      success: true,
      data: combined,
    } as T;
  } catch (fallbackError) {
    if (!isRetryableRouteError(fallbackError)) {
      throw fallbackError;
    }
  }
  if (sawEmptySuccess) {
    return {
      success: true,
      data: [],
    } as T;
  }
  throw lastError ?? new Error('Designer options route not found.');
}

async function readDesignerSpotlightsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of designerSpotlightsReadPaths) {
    try {
      const response = await apiService.get<any>(path);
      const raw = response?.data;
      if (Array.isArray(raw)) {
        return {
          success: true,
          data: raw,
        } as T;
      }
      if (raw && typeof raw === 'object') {
        return {
          success: true,
          data: [raw],
        } as T;
      }
      return {
        success: true,
        data: [],
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer spotlight route not found.');
}

async function readCountryImageGenerationWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of countryImageGenerationPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) {
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error('Country image generation route not found.');
}

async function writeCountryImageGenerationWithFallback<T>(data: unknown) {
  let lastError: unknown = null;
  for (const path of countryImageGenerationPaths) {
    try {
      return await apiService.put<T>(path, data);
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) {
        throw putError;
      }
    }
    try {
      return await apiService.patch<T>(path, data);
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) {
        throw patchError;
      }
    }
  }
  throw lastError ?? new Error('Country image generation route not found.');
}

const googleLoginPaths = [
  '/auth/google',
  '/auth/google-login',
  '/auth/login/google',
  '/google',
  '/google-login',
  '/login/google',
];
const googleLinkStatusPaths = [
  '/auth/google/link-status',
  '/auth/google-link-status',
  '/google/link-status',
  '/google-link-status',
];
const googleLinkPaths = [
  '/auth/google/link',
  '/auth/google-link',
  '/google/link',
  '/google-link',
];

const buildAuthBaseCandidates = () => {
  const candidates: string[] = [];
  const pushUnique = (value: unknown) => {
    const normalized = String(value || '').trim().replace(/\/+$/, '');
    if (!normalized) return;
    if (!candidates.includes(normalized)) candidates.push(normalized);
  };
  pushUnique(API_URL);
  if (typeof window !== 'undefined') {
    pushUnique(`${window.location.origin}/api`);
  }
  return candidates;
};

const joinBaseAndPath = (base: string, path: string) => {
  if (/^https?:\/\//i.test(path)) return path;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
};

async function postWithRouteFallback<T>(paths: string[], data: unknown) {
  let lastError: unknown = null;
  const baseCandidates = buildAuthBaseCandidates();
  for (const base of baseCandidates) {
    for (const path of paths) {
      try {
        return await apiService.post<T>(joinBaseAndPath(base, path), data);
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
  }
  throw lastError ?? new Error('Route not found.');
}

async function getWithRouteFallback<T>(paths: string[]) {
  let lastError: unknown = null;
  const baseCandidates = buildAuthBaseCandidates();
  for (const base of baseCandidates) {
    for (const path of paths) {
      try {
        return await apiService.get<T>(joinBaseAndPath(base, path));
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
  }
  throw lastError ?? new Error('Route not found.');
}

async function deleteWithRouteFallback<T>(paths: string[]) {
  let lastError: unknown = null;
  const baseCandidates = buildAuthBaseCandidates();
  for (const base of baseCandidates) {
    for (const path of paths) {
      try {
        return await apiService.delete<T>(joinBaseAndPath(base, path));
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
  }
  throw lastError ?? new Error('Route not found.');
}

// Auth API
const authApi = {
  login: (email: string, password: string) =>
    apiService.post<{ success: boolean; data: { user: any; token: string | null } }>('/auth/login', { email, password }),

  loginWithGoogle: (idToken: string) =>
    postWithRouteFallback<{ success: boolean; data: { user: any; token: string | null } }>(googleLoginPaths, { idToken }),

  getGoogleLinkStatus: () =>
    getWithRouteFallback<{ success: boolean; data: { linked: boolean; email: string | null; linkedAt: string | null } }>(
      googleLinkStatusPaths
    ),

  linkGoogleAccount: (idToken: string) =>
    postWithRouteFallback<{ success: boolean; data: { linked: boolean; email: string } }>(googleLinkPaths, { idToken }),

  unlinkGoogleAccount: () =>
    deleteWithRouteFallback<{ success: boolean; data: { linked: boolean } }>(googleLinkPaths),

  register: (data: any) =>
    apiService.post<{ success: boolean; data: { user: any; token: string | null } }>('/auth/register', data),

  getMe: () =>
    apiService.get<{ success: boolean; data: any }>('/auth/me'),

  updateProfile: (data: any) =>
    apiService.patch<{ success: boolean; data: any }>('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    apiService.post('/auth/change-password', { currentPassword, newPassword }),

  logout: () =>
    apiService.post('/auth/logout'),
};

const currencyApi = {
  getConfig: () =>
    apiService.get<{
      success: boolean;
      data: {
        defaultCurrency: string;
        supportedCurrencies: string[];
        visitorCountry?: {
          countryCode: string;
          country: string;
          currencyCode: string;
        } | null;
        usdPerUnitByCurrency?: Record<string, number>;
        matrix: Array<{
          countryCode: string;
          country: string;
          currencyCode: string;
          currencyName: string;
          usdPerUnit: number;
        }>;
      };
    }>('/currency/config'),

  getMyOptions: () =>
    apiService.get<{
      success: boolean;
      data: {
        country: string;
        defaultCurrency: string;
        allowedCurrencies: string[];
        usdPerUnitByCurrency: Record<string, number>;
      };
    }>('/currency/my-options'),

  getAdminMatrix: () =>
    apiService.get<{
      success: boolean;
      data: {
        matrix: any[];
        rules: any[];
        health?: {
          lastRefreshedAt: string | null;
          staleAfterHours: number;
          isStale: boolean;
          lastSource: string | null;
        };
        overrides?: Record<string, any>;
      };
    }>('/currency/admin/matrix'),

  updateCountryRate: (data: {
    countryCode: string;
    country: string;
    currencyCode: string;
    currencyName: string;
    usdPerUnit: number;
  }) => apiService.put('/currency/admin/rate', data),

  updateRules: (rules: Array<{ id: string; scopeType: 'COUNTRY' | 'USER' | 'ROLE'; scopeValue: string; currencies: string[] }>) =>
    apiService.put('/currency/admin/rules', { rules }),

  refreshRates: (preserveOverrides = true) => apiService.post('/currency/admin/refresh', { preserveOverrides }),

  clearOverride: (countryCode: string) => apiService.delete(`/currency/admin/override/${countryCode}`),
};

// Products API
const productsApi = {
  getCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/products/categories'),

  getMaterials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/products/materials'),

  getFabrics: (params?: { country?: string; materialTypeId?: string; search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { fabrics: any[]; pagination: any } }>('/products/fabrics', { params }),

  getFabric: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`),

  getFabricById: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`),

  getDesigns: (params?: { categoryId?: string; country?: string; search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { designs: any[]; pagination: any } }>('/products/designs', { params }),

  getDesign: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`),

  getDesignById: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`),

  getReadyToWear: (params?: { categoryId?: string; country?: string; search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/products/ready-to-wear', { params }),

  getReadyToWearProduct: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/ready-to-wear/${id}`),

  getCountries: () =>
    apiService.get<{ success: boolean; data: string[] }>('/products/countries'),

  getFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/products/featured'),
};

// Orders API
const ordersApi = {
  getOrder: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/orders/${id}`),

  createOrder: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/orders/custom-design', data),

  createCustomDesignOrder: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/orders/custom-design', data),

  createReadyToWearOrder: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/orders/ready-to-wear', data),

  updateStatus: (id: string, status: string, notes?: string) =>
    apiService.patch(`/orders/${id}/status`, { status, notes }),

  addTracking: (id: string, trackingNumber: string) =>
    apiService.patch(`/orders/${id}/tracking`, { trackingNumber }),
};

// Customer API
const customerApi = {
  getProfile: () =>
    apiService.get<{ success: boolean; data: any }>('/customer/profile'),

  getAddresses: () =>
    apiService.get<{ success: boolean; data: any[] }>('/customer/addresses'),

  addAddress: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/customer/addresses', data),

  updateAddress: (id: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/customer/addresses/${id}`, data),

  deleteAddress: (id: string) =>
    apiService.delete(`/customer/addresses/${id}`),

  saveMeasurements: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/customer/measurements', data),

  getOrders: (params?: { page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { orders: any[]; pagination: any } }>('/customer/orders', { params }),

  acceptOrder: (id: string) =>
    apiService.post(`/customer/orders/${id}/accept`),

  requestRefund: (id: string, reason: string) =>
    apiService.post(`/customer/orders/${id}/refund`, { reason }),
};

// Admin API
const PROMO_BADGE_FALLBACK_DEFAULTS = {
  valueText: '50+',
  labelText: 'New Arrivals',
};

const adminPromoBadgeReadPaths = ['/banners/admin/promo-badge', '/admin/banners/promo-badge'];
const adminPromoBadgeWriteAttempts = [
  { method: 'put', path: '/banners/admin/promo-badge' },
  { method: 'patch', path: '/banners/admin/promo-badge' },
  { method: 'put', path: '/admin/banners/promo-badge' },
  { method: 'patch', path: '/admin/banners/promo-badge' },
] as const;

async function readAdminPromoBadgeWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of adminPromoBadgeReadPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: { ...PROMO_BADGE_FALLBACK_DEFAULTS },
    } as T;
  }
  throw lastError ?? new Error('Promo badge settings route not found.');
}

async function writeAdminPromoBadgeWithFallback<T>(data: { valueText: string; labelText: string }) {
  const payload = {
    valueText: String(data.valueText || '').trim() || PROMO_BADGE_FALLBACK_DEFAULTS.valueText,
    labelText: String(data.labelText || '').trim() || PROMO_BADGE_FALLBACK_DEFAULTS.labelText,
  };
  let lastError: unknown = null;
  for (const attempt of adminPromoBadgeWriteAttempts) {
    try {
      if (attempt.method === 'patch') {
        return await apiService.patch<T>(attempt.path, payload);
      }
      return await apiService.put<T>(attempt.path, payload);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Promo badge settings route not found.');
}

const adminApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/admin/dashboard'),

  getDashboardStats: async () => {
    const response = await apiService.get<{ success: boolean; data: any }>('/admin/dashboard');
    if (!response.success) {
      return response;
    }

    const data = response.data;
    return {
      success: true,
      data: {
        totalRevenue: Number(data?.orders?.revenue || 0),
        totalOrders: Number(data?.orders?.total || 0),
        totalUsers: Number(data?.users?.total || 0),
        totalProducts: Number(data?.products?.total || 0),
        pendingOrders: 0,
        inProductionOrders: 0,
        revenueChange: 0,
        orderChange: 0,
        userChange: 0,
        productChange: 0,
        monthlyRevenue: [],
        ordersByStatus: [],
        usersByRole: [
          { label: 'Customers', value: Number(data?.users?.customers || 0) },
          { label: 'Designers', value: Number(data?.users?.designers || 0) },
          { label: 'Sellers', value: Number(data?.users?.fabricSellers || 0) },
          { label: 'QA Team', value: Number(data?.users?.qa || 0) },
        ],
      },
    };
  },

  getRecentOrders: async () => {
    const response = await apiService.get<{ success: boolean; data: any }>('/admin/dashboard');
    if (!response.success) {
      return response;
    }

    const recentOrders = (response.data?.recentOrders || []).map((order: any) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown',
      totalAmount: Number(order.total || 0),
      status: order.status,
      createdAt: order.createdAt,
      items: 1,
    }));

    return {
      success: true,
      data: recentOrders,
    };
  },

  getUsers: (params?: { role?: string; status?: string; search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { users: any[]; pagination: any } }>('/admin/users', { params }),

  createUser: (data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: string;
    status?: string;
    phone?: string;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/users', data),

  updateUser: (
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: string;
      status?: string;
      phone?: string | null;
    }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/users/${id}`, data),

  updateUserStatus: (id: string, status: string, reason?: string) =>
    apiService.patch(`/admin/users/${id}/status`, { status, reason }),

  createMinimalVendor: (data: {
    role: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    businessName: string;
    country: string;
    city?: string;
    address?: string;
    phone?: string;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/vendor-profiles/create-minimal', data),

  getProducts: (params?: {
    search?: string;
    status?: string;
    type?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/admin/products', { params }),

  getProductOptions: () =>
    apiService.get<{
      success: boolean;
      data: {
        categories: Array<{ id: string; name: string }>;
        materials: Array<{ id: string; name: string }>;
        sellers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string; userId?: string }>;
        designers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string; userId?: string }>;
      };
    }>('/admin/products/options'),

  createProduct: (data: any) =>
    apiService.post<{ success: boolean; data: any; message?: string }>('/admin/products', data),

  updateProduct: (type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', id: string, data: any) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/products/${type}/${id}`, data),

  setProductFeatured: (
    type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    id: string,
    data: { isFeatured: boolean; section?: string; displayOrder?: number }
  ) => apiService.patch<{ success: boolean; data?: any; message?: string }>(`/admin/products/${type}/${id}/featured`, data),

  moderateProduct: (
    type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    id: string,
    data: {
      action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'PUBLISH' | 'UNPUBLISH';
      message?: string;
      notifyVendor?: boolean;
    }
  ) => apiService.patch<{ success: boolean; data?: any; message?: string }>(`/admin/products/${type}/${id}/moderate`, data),

  moderateProductsBulk: (data: {
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    productIds: string[];
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'PUBLISH' | 'UNPUBLISH';
    message?: string;
    notifyVendor?: boolean;
  }) => apiService.post<{ success: boolean; data?: any; message?: string }>('/admin/products/moderate-bulk', data),

  getTrafficReport: (params?: {
    startDate?: string;
    endDate?: string;
    productType?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    vendorUserId?: string;
    page?: string;
  }) =>
    apiService.get<{ success: boolean; data: any }>('/admin/traffic-report', { params }),

  getSessionAudit: (params?: {
    action?: 'VENDOR_SESSION_STARTED' | 'VENDOR_SESSION_REPLACED' | 'VENDOR_SESSION_LOGOUT';
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    userId?: string;
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: any }>('/admin/security/session-audit', { params }),

  getMeasurementTemplates: () =>
    apiService.get<{ success: boolean; data: Array<{ name: string; unit: string; isRequired: boolean; instructions?: string }> }>(
      '/admin/measurement-templates'
    ),

  updateMeasurementTemplates: (templates: Array<{ name: string; unit: string; isRequired: boolean; instructions?: string }>) =>
    apiService.put('/admin/measurement-templates', { templates }),

  getVendorProfileFields: (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER') =>
    apiService.get<{ success: boolean; data: { role: string; fields: any[] } }>('/admin/vendor-profile/fields', {
      params: { role },
    }),

  updateVendorProfileFields: (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER', fields: any[]) =>
    apiService.put<{ success: boolean; data: any }>('/admin/vendor-profile/fields', { role, fields }),

  getVendorProfiles: (params?: {
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    status?: 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    search?: string;
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: any }>('/admin/vendor-profiles', { params }),

  getVendorProfileDetails: (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER', userId: string) =>
    apiService.get<{ success: boolean; data: any }>(`/admin/vendor-profiles/${role}/${userId}`),

  reviewVendorProfile: (
    role: 'FABRIC_SELLER' | 'FASHION_DESIGNER',
    userId: string,
    data: { status: 'APPROVED' | 'REJECTED'; notes?: string }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/vendor-profiles/${role}/${userId}/review`, data),

  getPermissionCatalog: () =>
    apiService.get<{
      success: boolean;
      data: {
        catalog: Array<{
          key: string;
          label: string;
          group: string;
          description: string;
        }>;
        groups: string[];
      };
    }>('/admin/permission-catalog'),

  getAdminRoles: () =>
    apiService.get<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        description: string;
        permissions: string[];
        isSystem: boolean;
        isActive: boolean;
        assignedAdmins: number;
        createdAt: string;
        updatedAt: string;
      }>;
    }>('/admin/roles'),

  createAdminRole: (data: {
    name: string;
    description?: string;
    permissions: string[];
    isActive?: boolean;
  }) => apiService.post<{ success: boolean; data: any }>('/admin/roles', data),

  updateAdminRole: (
    id: string,
    data: {
      name?: string;
      description?: string | null;
      permissions?: string[];
      isActive?: boolean;
    }
  ) => apiService.patch<{ success: boolean; data: any }>(`/admin/roles/${id}`, data),

  deleteAdminRole: (id: string) =>
    apiService.delete<{ success: boolean; message?: string }>(`/admin/roles/${id}`),

  updateAdminUserAccess: (
    userId: string,
    data: {
      adminRoleId?: string | null;
      permissions?: string[];
    }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/users/${userId}/admin-access`, data),

  getCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/categories'),

  createCategory: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/categories', data),

  updateCategory: (id: string, data: any) =>
    apiService.patch(`/admin/categories/${id}`, data),

  deleteCategory: (id: string) =>
    apiService.delete(`/admin/categories/${id}`),

  getMaterials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/materials'),

  createMaterial: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/materials', data),

  updateMaterial: (id: string, data: any) =>
    apiService.patch(`/admin/materials/${id}`, data),

  deleteMaterial: (id: string) =>
    apiService.delete(`/admin/materials/${id}`),

  getPricingRules: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/pricing-rules'),

  createPricingRule: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/pricing-rules', data),

  updatePricingRule: (id: string, data: any) =>
    apiService.patch(`/admin/pricing-rules/${id}`, data),

  deletePricingRule: (id: string) =>
    apiService.delete(`/admin/pricing-rules/${id}`),

  getOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { orders: any[]; pagination: any } }>('/admin/orders', { params }),

  assignQA: (orderId: string, qaId: string) =>
    apiService.patch(`/admin/orders/${orderId}/assign-qa`, { qaId }),

  // Banner Management
  getBanners: () =>
    apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all'),

  getPromoBadgeSettings: () =>
    readAdminPromoBadgeWithFallback<{ success: boolean; data: { valueText: string; labelText: string } }>(),

  updatePromoBadgeSettings: (data: { valueText: string; labelText: string }) =>
    writeAdminPromoBadgeWithFallback<{ success: boolean; data: { valueText: string; labelText: string } }>(data),

  createBanner: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/banners', data),

  updateBanner: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/banners/${id}`, data),

  deleteBanner: (id: string) =>
    apiService.delete<{ success: boolean }>(`/banners/${id}`),

  toggleBanner: (id: string) =>
    apiService.patch<{ success: boolean; data: any }>(`/banners/${id}/toggle`),
};

// Fabric Seller API
const sellerApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/fabric-seller/dashboard'),

  getFabrics: () =>
    apiService.get<{ success: boolean; data: any[] }>('/fabric-seller/fabrics'),

  createFabric: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/fabric-seller/fabrics', data),

  getOrders: () =>
    apiService.get<{ success: boolean; data: any[] }>('/fabric-seller/orders'),

  getStats: async () => {
    const response = await apiService.get<{ success: boolean; data: any }>('/fabric-seller/dashboard');
    if (!response.success) {
      return response;
    }
    const stats = response.data?.stats || {};
    return {
      success: true,
      data: {
        totalFabrics: Number(stats.totalFabrics || 0),
        totalSales: Number(stats.totalOrders || 0),
        totalRevenue: Number(stats.totalRevenue || 0),
        pendingOrders: Number(stats.pendingOrders || 0),
        lowStockItems: 0,
        monthlySales: [],
        topFabrics: [],
        salesChange: 0,
        revenueChange: 0,
      },
    };
  },

  updateFabricStock: (fabricId: string, stock: number) =>
    apiService.patch(`/fabric-seller/fabrics/${fabricId}/stock`, { stock }),

  updateOrderStatus: (orderId: string, status: string) =>
    apiService.patch(`/orders/${orderId}/status`, { status }),
};

// Designer API
const designerApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/designer/dashboard'),

  getDesigns: () =>
    apiService.get<{ success: boolean; data: any[] }>('/designer/designs'),

  createDesign: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/designs', data),

  getReadyToWear: () =>
    apiService.get<{ success: boolean; data: any[] }>('/designer/ready-to-wear'),

  createReadyToWear: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/ready-to-wear', data),

  getOrders: () =>
    apiService.get<{ success: boolean; data: any[] }>('/designer/orders'),

  getStats: async () => {
    const response = await apiService.get<{ success: boolean; data: any }>('/designer/dashboard');
    if (!response.success) {
      return response;
    }
    const stats = response.data?.stats || {};
    return {
      success: true,
      data: {
        totalDesigns: Number(stats.totalDesigns || 0),
        totalOrders: Number(stats.totalOrders || 0),
        totalRevenue: Number(stats.totalRevenue || 0),
        pendingOrders: Number(stats.pendingOrders || 0),
        inProductionOrders: 0,
        completedOrders: 0,
        monthlyRevenue: [],
        topDesigns: [],
        rating: 0,
        revenueChange: 0,
        orderChange: 0,
      },
    };
  },

  updateOrderStatus: (orderId: string, status: string) =>
    apiService.patch(`/orders/${orderId}/status`, { status }),
};

// QA API
const qaApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/qa/dashboard'),

  getOrders: (params?: { status?: string }) =>
    apiService.get<{ success: boolean; data: any[] }>('/qa/orders', { params }),

  shipOrder: (orderId: string, trackingNumber: string, notes?: string) =>
    apiService.patch(`/qa/orders/${orderId}/ship`, { trackingNumber, notes }),

  getStats: async () => {
    const response = await apiService.get<{ success: boolean; data: any }>('/qa/dashboard');
    if (!response.success) {
      return response;
    }
    const stats = response.data?.stats || {};
    return {
      success: true,
      data: {
        pendingReviews: Number(stats.pendingInspection || 0),
        approvedToday: Number(stats.completedToday || 0),
        rejectedToday: 0,
        totalReviewed: Number(stats.assignedOrders || 0),
        avgReviewTime: 0,
        approvalRate: 0,
        weeklyReviews: [],
        reviewsByStatus: [],
      },
    };
  },

  getPendingItems: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/qa/orders');
    if (!response.success) {
      return response;
    }
    const toAddressObject = (value: any) => {
      if (!value) return null;
      if (typeof value === 'object') return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return null;
    };

    const pendingStatuses = new Set(['QA_PENDING', 'QA_INSPECTING']);
    const data = (response.data || [])
      .filter((order: any) => pendingStatuses.has(order?.status))
      .map((order: any) => {
        const shippingAddress = toAddressObject(order.shippingAddress);
        const design = order.designOrder?.design;
        const firstImage = design?.images?.[0]?.url || order.readyToWearItems?.[0]?.readyToWear?.images?.[0]?.url;
        return {
          id: String(order.id),
          orderNumber: order.orderNumber || 'N/A',
          designName: design?.name || order.readyToWearItems?.[0]?.readyToWear?.name || 'Order Item',
          designerName: 'Assigned Designer',
          customerName:
            `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() ||
            shippingAddress?.fullName ||
            'Customer',
          images: firstImage ? [firstImage] : ['https://picsum.photos/seed/qa-order/600/400'],
          measurements: (order.designOrder?.measurements && typeof order.designOrder.measurements === 'object')
            ? order.designOrder.measurements
            : {},
          submittedAt: order.createdAt,
          priority: order.status === 'QA_PENDING' ? 'HIGH' : 'MEDIUM',
          notes: order.timeline?.[0]?.notes || '',
        };
      });

    return { success: true, data };
  },

  getReviewHistory: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/qa/orders');
    if (!response.success) {
      return response;
    }
    const doneStatuses = new Set(['QA_APPROVED', 'QA_REJECTED', 'SHIPPED', 'DELIVERED', 'COMPLETED']);
    const data = (response.data || [])
      .filter((order: any) => doneStatuses.has(order?.status))
      .map((order: any) => {
        const latestTimeline = Array.isArray(order.timeline) ? order.timeline[0] : null;
        return {
          id: String(order.id),
          orderNumber: order.orderNumber || 'N/A',
          designName: order.designOrder?.design?.name || order.readyToWearItems?.[0]?.readyToWear?.name || 'Order Item',
          status: order.status === 'QA_REJECTED' ? 'REJECTED' : 'APPROVED',
          reviewedAt: latestTimeline?.createdAt || order.updatedAt || order.createdAt,
          notes: latestTimeline?.notes || '',
          reviewerName: 'QA Team',
          designerName: 'Assigned Designer',
        };
      });
    return { success: true, data };
  },

  submitReview: (data: { orderId: string; status: 'APPROVED' | 'REJECTED'; notes: string }) =>
    apiService.patch<{ success: boolean; data: any }>(`/orders/${data.orderId}/status`, {
      status: data.status === 'APPROVED' ? 'QA_APPROVED' : 'QA_REJECTED',
      notes: data.notes,
    }),
};

// Payments API
const paymentsApi = {
  createPaymentIntent: (data: { amount: number; currency: string }) =>
    apiService.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>('/payments/create-intent', data),

  confirmPayment: (paymentIntentId: string) =>
    apiService.post<{ success: boolean; data: any }>('/payments/confirm', { paymentIntentId }),
};

// Banners API (public)
const bannersApi = {
  getBanners: (section?: string) =>
    apiService.get<{ success: boolean; data: any[] }>('/banners', { params: section ? { section } : undefined }),

  getPromoBadgeSettings: () =>
    apiService.get<{ success: boolean; data: { valueText: string; labelText: string } }>('/banners/promo-badge'),

  getBannerSections: () =>
    apiService.get<{ success: boolean; data: any[] }>('/banners/meta/sections'),
};

// Upload API
const uploadApi = {
  image: (formData: FormData) =>
    httpClient.post<{ success: boolean; data: { url: string } }>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((res) => res.data),
};

// Homepage API
const homepageApi = {
  // Public endpoints
  getHeroSlides: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/hero-slides'),

  getFeaturedBySection: (section: string) =>
    apiService.get<{ success: boolean; data: any[] }>(`/homepage/featured/${section}`),

  getAllFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage/featured'),

  // Admin endpoints
  getAdminHeroSlides: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/hero-slides'),

  createHeroSlide: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage/admin/hero-slides', data),

  updateHeroSlide: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage/admin/hero-slides/${id}`, data),

  deleteHeroSlide: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/hero-slides/${id}`),

  getAdminFeatured: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/featured'),

  addFeaturedProduct: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage/admin/featured', data),

  updateFeaturedProduct: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage/admin/featured/${id}`, data),

  removeFeaturedProduct: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/featured/${id}`),

  getProductsForFeaturing: (type?: string) =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/products-for-featured', { params: type ? { type } : undefined }),
};

// Homepage Sections API (new dynamic sections)
const homepageSectionsApi = {
  // Public endpoints
  getVisibility: () =>
    readHomepageVisibilityPublicWithFallback<{
      success: boolean;
      data: Record<string, boolean>;
    }>(),

  getTopStrip: () =>
    readTopStripWithFallback<{
      success: boolean;
      data: {
        messages: string[];
        separator: string;
        repeatCount: number;
        animationSeconds: number;
        fontSize: number;
        isBold: boolean;
        pauseOnHover: boolean;
        textColor: string;
        backgroundColor: string;
      };
    }>('public'),
  getStatsStrip: () =>
    readStatsStripWithFallback<{
      success: boolean;
      data: {
        items: Array<{ value: string; suffix: string; label: string; displayOrder: number; isActive: boolean }>;
        backgroundImage: string;
        backgroundColor: string;
        overlayColor: string;
        overlayOpacity: number;
        valueColor: string;
        suffixColor: string;
        labelColor: string;
      };
    }>('public'),
  getFeaturedProductDescriptionSettings: () =>
    readFeaturedProductDescriptionSettingsWithFallback<{
      success: boolean;
      data: { wordLimit: number };
    }>('public'),

  getCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/countries'),

  getHowItWorks: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/how-it-works'),

  getHowItWorksStyle: () =>
    readHowItWorksStyleWithFallback<{
      success: boolean;
      data: { enabled: boolean; iconColor: string; iconHoverColor: string };
    }>('public'),

  getCategories: () =>
    readHomepageCategoriesWithFallback<{ success: boolean; data: any[] }>(),

  getDesignerSpotlight: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/designer-spotlight'),

  getDesignerSpotlights: () =>
    readDesignerSpotlightsWithFallback<{ success: boolean; data: any[] }>(),

  getHeritage: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/heritage'),

  getTestimonials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/testimonials'),

  getFooter: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/footer'),

  // Admin endpoints - Countries
  getAdminVisibility: () =>
    readHomepageVisibilityAdminWithFallback<{
      success: boolean;
      data: {
        source: 'DATABASE' | 'DEFAULT';
        updatedAt: string | null;
        sections: Array<{
          key: string;
          label: string;
          description: string;
          enabled: boolean;
        }>;
      };
    }>(),

  updateAdminVisibility: (visibility: Record<string, boolean>) =>
    writeHomepageVisibilityAdminWithFallback<{
      success: boolean;
      data: {
        source: 'DATABASE' | 'DEFAULT';
        updatedAt: string | null;
        sections: Array<{
          key: string;
          label: string;
          description: string;
          enabled: boolean;
        }>;
      };
    }>(visibility),

  getAdminTopStrip: () =>
    readTopStripWithFallback<{
      success: boolean;
      data: {
        messages: string[];
        separator: string;
        repeatCount: number;
        animationSeconds: number;
        fontSize: number;
        isBold: boolean;
        pauseOnHover: boolean;
        textColor: string;
        backgroundColor: string;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('admin'),
  getAdminStatsStrip: () =>
    readStatsStripWithFallback<{
      success: boolean;
      data: {
        items: Array<{ value: string; suffix: string; label: string; displayOrder: number; isActive: boolean }>;
        backgroundImage: string;
        backgroundColor: string;
        overlayColor: string;
        overlayOpacity: number;
        valueColor: string;
        suffixColor: string;
        labelColor: string;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('admin'),
  getAdminFeaturedProductDescriptionSettings: () =>
    readFeaturedProductDescriptionSettingsWithFallback<{
      success: boolean;
      data: { wordLimit: number; source?: 'DATABASE' | 'DEFAULT'; updatedAt?: string | null };
    }>('admin'),

  getAdminCountryImageGeneration: () =>
    readCountryImageGenerationWithFallback<{
      success: boolean;
      data: {
        enabled: boolean;
        apiUrl: string;
        apiKey: string;
        model: string;
        promptTemplate: string;
        responseImagePath: string;
        requestMethod: 'GET' | 'POST';
      };
    }>(),

  updateAdminCountryImageGeneration: (data: {
    enabled?: boolean;
    apiUrl?: string;
    apiKey?: string;
    model?: string;
    promptTemplate?: string;
    responseImagePath?: string;
    requestMethod?: 'GET' | 'POST';
  }) =>
    writeCountryImageGenerationWithFallback<{
      success: boolean;
      data: {
        enabled: boolean;
        apiUrl: string;
        apiKey: string;
        model: string;
        promptTemplate: string;
        responseImagePath: string;
        requestMethod: 'GET' | 'POST';
      };
    }>(data),

  updateAdminTopStrip: (data: {
    messages: string[];
    separator?: string;
    repeatCount?: number;
    animationSeconds?: number;
    fontSize?: number;
    isBold?: boolean;
    pauseOnHover?: boolean;
    textColor?: string;
    backgroundColor?: string;
  }) =>
    writeTopStripWithFallback<{
      success: boolean;
      data: {
        messages: string[];
        separator: string;
        repeatCount: number;
        animationSeconds: number;
        fontSize: number;
        isBold: boolean;
        pauseOnHover: boolean;
        textColor: string;
        backgroundColor: string;
      };
    }>(data),
  updateAdminStatsStrip: (data: {
    items: Array<{ value: string; suffix?: string; label: string; displayOrder?: number; isActive?: boolean }>;
    backgroundImage?: string;
    backgroundColor?: string;
    overlayColor?: string;
    overlayOpacity?: number;
    valueColor?: string;
    suffixColor?: string;
    labelColor?: string;
  }) =>
    writeStatsStripWithFallback<{
      success: boolean;
      data: {
        items: Array<{ value: string; suffix: string; label: string; displayOrder: number; isActive: boolean }>;
        backgroundImage: string;
        backgroundColor: string;
        overlayColor: string;
        overlayOpacity: number;
        valueColor: string;
        suffixColor: string;
        labelColor: string;
      };
    }>(data),
  updateAdminFeaturedProductDescriptionSettings: (data: { wordLimit: number }) =>
    writeFeaturedProductDescriptionSettingsWithFallback<{
      success: boolean;
      data: { wordLimit: number };
    }>(data),

  getAdminCountryOptions: () =>
    apiService.get<{ success: boolean; data: Array<{ code: string; name: string; flag: string }> }>(
      '/homepage-sections/admin/country-options'
    ),

  getAdminDesignerOptions: () =>
    readDesignerOptionsWithFallback<{
      success: boolean;
      data: Array<{
        id: string;
        businessName: string;
        country: string;
        ownerUserId?: string;
        userId?: string;
        vendorType?: 'DESIGNER' | 'SELLER';
      }>;
    }>(),

  getAdminCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/countries'),

  createCountry: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/countries', data),

  updateCountry: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/countries/${id}`, data),

  generateCountryImage: (data: {
    countryCode?: string;
    country?: string;
    fabrics?: string;
    imageKeyword?: string;
  }) =>
    apiService.post<{
      success: boolean;
      data: { image: string; country: string; countryCode: string | null; flag: string | null };
    }>('/homepage-sections/admin/countries/generate-image', data),

  deleteCountry: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/countries/${id}`),

  // Admin endpoints - How It Works
  getAdminHowItWorks: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/how-it-works'),

  getAdminHowItWorksStyle: () =>
    readHowItWorksStyleWithFallback<{
      success: boolean;
      data: { enabled: boolean; iconColor: string; iconHoverColor: string; source?: 'DATABASE' | 'DEFAULT'; updatedAt?: string | null };
    }>('admin'),

  updateAdminHowItWorksStyle: (data: { enabled?: boolean; iconColor?: string; iconHoverColor?: string }) =>
    writeHowItWorksStyleWithFallback<{
      success: boolean;
      data: { enabled: boolean; iconColor: string; iconHoverColor: string };
    }>(data),

  createHowItWorksStep: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/how-it-works', data),

  updateHowItWorksStep: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/how-it-works/${id}`, data),

  deleteHowItWorksStep: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/how-it-works/${id}`),

  // Admin endpoints - Categories
  getAdminCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/categories'),

  createCategory: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/categories', data),

  updateCategory: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/categories/${id}`, data),

  deleteCategory: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/categories/${id}`),

  // Admin endpoints - Designer Spotlight
  getAdminDesignerSpotlights: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/designer-spotlight'),

  createDesignerSpotlight: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/designer-spotlight', data),

  updateDesignerSpotlight: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/designer-spotlight/${id}`, data),

  deleteDesignerSpotlight: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/designer-spotlight/${id}`),

  // Admin endpoints - Heritage
  getAdminHeritage: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/heritage'),

  createHeritage: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/heritage', data),

  updateHeritage: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/heritage/${id}`, data),

  deleteHeritage: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/heritage/${id}`),

  // Admin endpoints - Testimonials
  getAdminTestimonials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/testimonials'),

  createTestimonial: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/testimonials', data),

  updateTestimonial: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/testimonials/${id}`, data),

  deleteTestimonial: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/testimonials/${id}`),

  // Admin endpoints - Footer
  getAdminFooter: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/admin/footer'),

  createFooter: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/footer', data),

  updateFooter: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/footer/${id}`, data),
};

const adminBlogReadPaths = ['/blogs/admin', '/admin/blogs'];
const adminBlogOptionPaths = ['/blogs/admin/options', '/admin/blogs/options'];
const adminBlogWritePaths = ['/blogs/admin', '/admin/blogs'];
const BLOGS_FALLBACK_SECTION = 'BLOG_STORY';
const BLOGS_FALLBACK_META_PREFIX = 'BLOG_JSON:';
const BLOGS_FALLBACK_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';

const normalizeBlogAudienceType = (value: unknown): 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER' => {
  const normalized = String(value || '').trim().toUpperCase();
  return normalized === 'SELLER' || normalized === 'DESIGNER' || normalized === 'COUNTRY' ? normalized : 'OTHER';
};

const slugifyBlog = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200);

const parseFallbackBlogMeta = (value: unknown) => {
  const raw = String(value || '').trim();
  if (!raw) return {};
  const jsonText = raw.startsWith(BLOGS_FALLBACK_META_PREFIX) ? raw.slice(BLOGS_FALLBACK_META_PREFIX.length) : raw;
  try {
    const parsed = JSON.parse(jsonText);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};

const mapFallbackBannerToBlog = (row: any) => {
  if (String(row?.section || '').toUpperCase() !== BLOGS_FALLBACK_SECTION) return null;
  const meta = parseFallbackBlogMeta(row?.ctaLink);
  const slug = slugifyBlog(meta.slug || row?.name || row?.title) || `story-${String(row?.id || '').slice(0, 8)}`;
  const content = String(meta.content || '').trim();
  const excerpt = String(meta.excerpt || row?.subtitle || '').trim();
  const coverImage = String(meta.coverImage || row?.images?.[0] || '').trim();
  const targetName = String(meta.targetName || '').trim();
  const targetEntityId = String(meta.targetEntityId || '').trim();
  const isPublished = typeof meta.isPublished === 'boolean' ? Boolean(meta.isPublished) : Boolean(row?.isActive);
  const publishedAt = isPublished
    ? String(meta.publishedAt || row?.updatedAt || row?.createdAt || '')
    : null;
  return {
    id: String(row?.id || ''),
    title: String(row?.title || row?.name || 'Untitled Story').trim(),
    slug,
    excerpt: excerpt || null,
    content: content || excerpt || '',
    audienceType: normalizeBlogAudienceType(meta.audienceType || row?.ctaText),
    targetName: targetName || null,
    targetEntityId: targetEntityId || null,
    coverImage: coverImage || null,
    isPublished,
    publishedAt,
    createdAt: String(meta.createdAt || row?.createdAt || ''),
    updatedAt: String(row?.updatedAt || meta.updatedAt || row?.createdAt || ''),
    link: `/stories/${slug}`,
  };
};
type FallbackBlogRow = NonNullable<ReturnType<typeof mapFallbackBannerToBlog>>;

async function readFallbackBlogsFromBannerStore() {
  const response = await adminApi.getBanners();
  const rows = Array.isArray((response as any)?.data) ? (response as any).data : [];
  return rows
    .map(mapFallbackBannerToBlog)
    .filter((row): row is FallbackBlogRow => Boolean(row))
    .sort((a, b) => {
      const left = Date.parse(a.updatedAt || '') || 0;
      const right = Date.parse(b.updatedAt || '') || 0;
      return right - left;
    });
}

async function readFallbackPublishedBlogsFromBannerStore(params?: {
  audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
}) {
  const response = await bannersApi.getBanners(BLOGS_FALLBACK_SECTION);
  const rows = Array.isArray((response as any)?.data) ? (response as any).data : [];
  const normalizedAudience = params?.audienceType ? normalizeBlogAudienceType(params.audienceType) : '';
  return rows
    .map(mapFallbackBannerToBlog)
    .filter((row): row is FallbackBlogRow => Boolean(row))
    .filter((row) => row.isPublished)
    .filter((row) => (!normalizedAudience ? true : row.audienceType === normalizedAudience))
    .sort((a, b) => {
      const left = Date.parse(a.publishedAt || a.updatedAt || '') || 0;
      const right = Date.parse(b.publishedAt || b.updatedAt || '') || 0;
      return right - left;
    });
}

const applyAdminBlogFilters = (
  rows: FallbackBlogRow[],
  params?: { search?: string; audienceType?: string; status?: 'PUBLISHED' | 'DRAFT' }
) => {
  const search = String(params?.search || '').trim().toLowerCase();
  const audience = params?.audienceType ? normalizeBlogAudienceType(params.audienceType) : '';
  const status = String(params?.status || '').trim().toUpperCase();
  return rows.filter((row) => {
    const matchesSearch =
      !search ||
      row.title.toLowerCase().includes(search) ||
      row.slug.toLowerCase().includes(search) ||
      String(row.excerpt || '').toLowerCase().includes(search);
    const matchesAudience = !audience || row.audienceType === audience;
    const matchesStatus = !status || (status === 'PUBLISHED' ? row.isPublished : !row.isPublished);
    return matchesSearch && matchesAudience && matchesStatus;
  });
};

async function generateUniqueFallbackBlogSlug(title: unknown, explicit?: unknown, excludeId?: string) {
  const base = slugifyBlog(explicit || title) || `story-${Date.now()}`;
  const rows = await readFallbackBlogsFromBannerStore();
  const used = new Set(
    rows.filter((row) => !excludeId || row.id !== excludeId).map((row) => String(row.slug || '').toLowerCase())
  );
  if (!used.has(base.toLowerCase())) return base;
  let suffix = 2;
  let candidate = `${base}-${suffix}`;
  while (used.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}

const toFallbackBannerPayloadFromBlog = (
  input: {
    title?: unknown;
    slug?: unknown;
    excerpt?: unknown;
    content?: unknown;
    audienceType?: unknown;
    targetName?: unknown;
    targetEntityId?: unknown;
    coverImage?: unknown;
    isPublished?: unknown;
  },
  existing?: ReturnType<typeof mapFallbackBannerToBlog> | null
) => {
  const title = String(input.title ?? existing?.title ?? '').trim() || 'Untitled Story';
  const slug = slugifyBlog(input.slug ?? existing?.slug ?? title) || `story-${Date.now()}`;
  const excerpt = String(input.excerpt ?? existing?.excerpt ?? '').trim();
  const content = String(input.content ?? existing?.content ?? '').trim() || excerpt || title;
  const audienceType = normalizeBlogAudienceType(input.audienceType ?? existing?.audienceType);
  const targetName = String(input.targetName ?? existing?.targetName ?? '').trim();
  const targetEntityId = String(input.targetEntityId ?? existing?.targetEntityId ?? '').trim();
  const coverImage = String(input.coverImage ?? existing?.coverImage ?? '').trim();
  const isPublished =
    typeof input.isPublished === 'boolean' ? input.isPublished : Boolean(existing?.isPublished);
  const now = new Date().toISOString();
  const publishedAt = isPublished ? String(existing?.publishedAt || now) : null;
  const meta = {
    slug,
    content,
    excerpt,
    audienceType,
    targetName: targetName || null,
    targetEntityId: targetEntityId || null,
    coverImage: coverImage || null,
    isPublished,
    publishedAt,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  return {
    name: `BLOG:${slug}`,
    section: BLOGS_FALLBACK_SECTION,
    title,
    subtitle: excerpt || null,
    ctaText: audienceType,
    ctaLink: `${BLOGS_FALLBACK_META_PREFIX}${JSON.stringify(meta)}`,
    images: [coverImage || existing?.coverImage || BLOGS_FALLBACK_IMAGE],
    isActive: isPublished,
    displayOrder: 0,
  };
};

async function readAdminBlogsWithFallback<T>(params?: { search?: string; audienceType?: string; status?: 'PUBLISHED' | 'DRAFT' }) {
  let lastError: unknown = null;
  for (const path of adminBlogReadPaths) {
    try {
      return await apiService.get<T>(path, { params });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const fallbackRows = await readFallbackBlogsFromBannerStore();
    return {
      success: true,
      data: applyAdminBlogFilters(fallbackRows, params),
    } as T;
  }
  throw lastError ?? new Error('Blog admin route not found.');
}

async function readAdminBlogOptionsWithFallback<T>(params?: { audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER' }) {
  let lastError: unknown = null;
  for (const path of adminBlogOptionPaths) {
    try {
      return await apiService.get<T>(path, { params });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const fallbackRows = await readFallbackBlogsFromBannerStore();
    const normalizedAudience = params?.audienceType ? normalizeBlogAudienceType(params.audienceType) : '';
    return {
      success: true,
      data: fallbackRows
        .filter((row) => row.isPublished)
        .filter((row) => (!normalizedAudience ? true : row.audienceType === normalizedAudience))
        .map((row) => ({
          id: row.id,
          title: row.title,
          slug: row.slug,
          audienceType: row.audienceType,
          link: row.link,
        })),
    } as T;
  }
  throw lastError ?? new Error('Blog option route not found.');
}

async function createAdminBlogWithFallback<T>(data: unknown) {
  let lastError: unknown = null;
  for (const path of adminBlogWritePaths) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const input = (data || {}) as any;
    const uniqueSlug = await generateUniqueFallbackBlogSlug(input.title, input.slug);
    const payload = toFallbackBannerPayloadFromBlog({
      ...input,
      slug: uniqueSlug,
      isPublished: Boolean(input.isPublished),
    });
    const created = await adminApi.createBanner(payload);
    const mapped = mapFallbackBannerToBlog((created as any)?.data);
    if (!mapped) {
      throw new Error('Failed to create blog.');
    }
    return {
      success: true,
      data: mapped,
      message: 'Blog created.',
    } as T;
  }
  throw lastError ?? new Error('Blog create route not found.');
}

async function updateAdminBlogWithFallback<T>(id: string, data: unknown) {
  let lastError: unknown = null;
  for (const path of adminBlogWritePaths) {
    try {
      return await apiService.put<T>(`${path}/${id}`, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const input = (data || {}) as any;
    const fallbackRows = await readFallbackBlogsFromBannerStore();
    const existing = fallbackRows.find((row) => row.id === id);
    if (!existing) {
      throw new Error('Blog not found.');
    }
    const nextSlug =
      input.slug !== undefined
        ? await generateUniqueFallbackBlogSlug(input.title ?? existing.title, input.slug, id)
        : existing.slug;
    const payload = toFallbackBannerPayloadFromBlog(
      {
        ...existing,
        ...input,
        slug: nextSlug,
      },
      existing
    );
    const updated = await adminApi.updateBanner(id, payload);
    const mapped = mapFallbackBannerToBlog((updated as any)?.data);
    if (!mapped) {
      throw new Error('Failed to update blog.');
    }
    return {
      success: true,
      data: mapped,
      message: 'Blog updated.',
    } as T;
  }
  throw lastError ?? new Error('Blog update route not found.');
}

async function deleteAdminBlogWithFallback<T>(id: string) {
  let lastError: unknown = null;
  for (const path of adminBlogWritePaths) {
    try {
      return await apiService.delete<T>(`${path}/${id}`);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    await adminApi.deleteBanner(id);
    return {
      success: true,
      message: 'Blog deleted.',
    } as T;
  }
  throw lastError ?? new Error('Blog delete route not found.');
}

const adminBlogsApi = {
  getAdminBlogs: (params?: { search?: string; audienceType?: string; status?: 'PUBLISHED' | 'DRAFT' }) =>
    readAdminBlogsWithFallback<{ success: boolean; data: any[] }>(params),

  getAdminOptions: (params?: { audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER' }) =>
    readAdminBlogOptionsWithFallback<{
      success: boolean;
      data: Array<{ id: string; title: string; slug: string; audienceType: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER'; link: string }>;
    }>(params),

  createAdminBlog: (data: {
    title: string;
    slug?: string;
    excerpt?: string;
    content: string;
    audienceType: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
    targetName?: string;
    targetEntityId?: string;
    coverImage?: string;
    isPublished?: boolean;
  }) => createAdminBlogWithFallback<{ success: boolean; data: any; message?: string }>(data),

  updateAdminBlog: (
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
      targetName?: string;
      targetEntityId?: string;
      coverImage?: string;
      isPublished?: boolean;
    }
  ) => updateAdminBlogWithFallback<{ success: boolean; data: any; message?: string }>(id, data),

  deleteAdminBlog: (id: string) =>
    deleteAdminBlogWithFallback<{ success: boolean; message?: string }>(id),
};

const blogsApi = {
  getPublished: async (params?: { audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER' }) => {
    try {
      return await apiService.get<{ success: boolean; data: any[] }>('/blogs', { params });
    } catch (error) {
      if (!isRetryableRouteError(error)) throw error;
      const rows = await readFallbackPublishedBlogsFromBannerStore(params);
      return { success: true, data: rows };
    }
  },

  getBySlug: async (slug: string) => {
    try {
      return await apiService.get<{ success: boolean; data: any }>(`/blogs/${encodeURIComponent(slug)}`);
    } catch (error) {
      if (!isRetryableRouteError(error)) throw error;
      const rows = await readFallbackPublishedBlogsFromBannerStore();
      const normalized = String(slug || '').trim().toLowerCase();
      const row = rows.find((item) => String(item.slug || '').toLowerCase() === normalized);
      if (!row) {
        const notFoundError = new Error('Story not found.');
        (notFoundError as any).response = { status: 404, data: { success: false, message: 'Story not found.' } };
        throw notFoundError;
      }
      return { success: true, data: row };
    }
  },

  getAdminBlogs: (params?: { search?: string; audienceType?: string; status?: 'PUBLISHED' | 'DRAFT' }) =>
    adminBlogsApi.getAdminBlogs(params),

  getAdminOptions: (params?: { audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER' }) =>
    adminBlogsApi.getAdminOptions(params),

  createAdminBlog: (data: {
    title: string;
    slug?: string;
    excerpt?: string;
    content: string;
    audienceType: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
    targetName?: string;
    targetEntityId?: string;
    coverImage?: string;
    isPublished?: boolean;
  }) => adminBlogsApi.createAdminBlog(data),

  updateAdminBlog: (
    id: string,
    data: {
      title?: string;
      slug?: string;
      excerpt?: string;
      content?: string;
      audienceType?: 'SELLER' | 'DESIGNER' | 'COUNTRY' | 'OTHER';
      targetName?: string;
      targetEntityId?: string;
      coverImage?: string;
      isPublished?: boolean;
    }
  ) => adminBlogsApi.updateAdminBlog(id, data),

  deleteAdminBlog: (id: string) =>
    adminBlogsApi.deleteAdminBlog(id),
};

// Export combined API
export const api = {
  auth: authApi,
  currency: currencyApi,
  products: productsApi,
  orders: ordersApi,
  customer: customerApi,
  admin: adminApi,
  seller: sellerApi,
  designer: designerApi,
  qa: qaApi,
  payments: paymentsApi,
  banners: bannersApi,
  upload: uploadApi,
  homepage: homepageApi,
  homepageSections: homepageSectionsApi,
  blogs: blogsApi,
};

// Named exports for direct import
export {
  authApi,
  currencyApi,
  productsApi,
  ordersApi,
  customerApi,
  adminApi,
  sellerApi,
  designerApi,
  qaApi,
  paymentsApi,
  bannersApi,
  uploadApi,
  homepageApi,
  homepageSectionsApi,
  blogsApi,
  apiService,
  httpClient,
};

export default api;
