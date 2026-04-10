import axios, { type AxiosRequestConfig } from 'axios';

const resolveWindowOriginSafe = () => {
  try {
    if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  } catch {
    // Ignore origin access failures in restricted browser contexts.
  }
  return '';
};

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : `${resolveWindowOriginSafe() || ''}/api`;
const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

const resolveApiAssetUrl = (value: unknown): string => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const resolveApiOrigin = () => {
    try {
      const fallbackBase = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      return new URL(API_URL, fallbackBase).origin;
    } catch {
      return '';
    }
  };
  const normalizeUploadPath = (pathValue: string) => {
    if (pathValue.startsWith('/api/uploads/')) {
      return `/uploads/${pathValue.slice('/api/uploads/'.length)}`;
    }
    if (pathValue.startsWith('/uploads/')) {
      return pathValue;
    }
    return '';
  };
  const isLegacyApiUploadsPath = (pathValue: string) => pathValue.startsWith('/api/uploads/');
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      if (!isLegacyApiUploadsPath(parsed.pathname)) return raw;
      const uploadPath = normalizeUploadPath(parsed.pathname);
      if (!uploadPath) return raw;
      const preferredOrigin = resolveApiOrigin() || parsed.origin;
      return new URL(uploadPath, preferredOrigin).toString();
    } catch {
      return raw;
    }
  }
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  const uploadPath = normalizeUploadPath(normalizedPath);
  if (!uploadPath) return raw;
  try {
    const apiOrigin = resolveApiOrigin();
    return apiOrigin ? `${apiOrigin}${uploadPath}` : uploadPath;
  } catch {
    return uploadPath;
  }
};

export const resolveAssetUrl = (value: unknown): string => resolveApiAssetUrl(value);

const httpClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const apiService = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    httpClient.get<T>(url, config).then((res) => res.data),
  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    httpClient.post<T>(url, data, config).then((res) => res.data),
};

export const publicApi = {
  jenksV2Frontpage: {
    getPublicConfig: () =>
      apiService.get<{
        success: boolean;
        data: Record<string, unknown>;
      }>('/jenks-v2-frontpage/config'),
  },
  products: {
    getCategoryPageSettings: (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR' | 'COUNTRY' | 'SHOP') =>
      apiService.get<{
        success: boolean;
        data: {
          pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR' | 'COUNTRY' | 'SHOP';
          settings?: {
            productCard?: Record<string, unknown>;
          };
        };
      }>(`/category-pages-v2/${pageType}`, { params: { _r: Date.now() } }),
    getReadyToWear: (params?: Record<string, unknown>) =>
      apiService.get<{
        success: boolean;
        data: { products: any[]; pagination: any };
      }>('/products/ready-to-wear', { params }),
    getDesigns: (params?: Record<string, unknown>) =>
      apiService.get<{
        success: boolean;
        data: { designs: any[]; pagination: any };
      }>('/products/designs', { params }),
    getFabrics: (params?: Record<string, unknown>) =>
      apiService.get<{
        success: boolean;
        data: { fabrics: any[]; pagination: any };
      }>('/products/fabrics', { params }),
    getProductReviews: (productType: 'design' | 'fabric' | 'ready-to-wear', id: string, limit = 12) =>
      apiService.get<{
        success: boolean;
        data: {
          reviews: Array<{
            id: string;
            rating: number;
            title?: string | null;
            comment: string;
            createdAt: string;
            customer?: { id: string; name: string } | null;
          }>;
          summary: { count: number; averageRating: number };
        };
      }>(`/products/${productType}/${id}/reviews`, { params: { limit } }),
  },
  homepageSections: {
    subscribeHomepageNewsletter: (payload: { email: string; source?: string; metadata?: Record<string, unknown> }) =>
      apiService.post<{
        success: boolean;
        data?: { status: 'SUBSCRIBED' | 'ALREADY_SUBSCRIBED'; email: string };
        message?: string;
      }>('/homepage-sections/newsletter-subscribe', payload),
  },
};
