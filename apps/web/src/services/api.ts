import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';
import { getCountryOptions } from '../data/locationOptions';

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;
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
  if (/^https?:\/\//i.test(raw)) {
    try {
      const parsed = new URL(raw);
      const uploadPath = normalizeUploadPath(parsed.pathname);
      if (!uploadPath) return raw;
      const preferredOrigin = resolveApiOrigin() || parsed.origin;
      const normalized = new URL(uploadPath, preferredOrigin);
      return normalized.toString();
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
    const isProtectedPath = (() => {
      const pathname = window.location.pathname || '/';
      const protectedPrefixes = [
        '/admin',
        '/seller',
        '/designer',
        '/dashboard',
        '/orders',
        '/profile',
        '/measurements',
        '/qa',
        '/checkout',
      ];
      return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    })();
    if (error.response?.status === 401 && !isAuthRequest) {
      useAuthStore.getState().logout();
      if (isProtectedPath && window.location.pathname !== '/login') {
        const returnTo = `${window.location.pathname || '/'}${window.location.search || ''}${window.location.hash || ''}`;
        const encodedReturnTo = encodeURIComponent(returnTo);
        window.location.href = `/login?returnTo=${encodedReturnTo}`;
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

const noCacheRequestConfig = () => ({
  params: { _r: Date.now() },
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

const CHECKOUT_PAYMENT_DEBUG_KEY = 'af_checkout_last_payment_session_debug_v1';

type CheckoutPaymentDebugInfo = {
  routePath: string;
  mode: 'PRIMARY' | 'COMPATIBILITY' | 'LEGACY_INTENT' | 'LEGACY_INTENT_FORCED';
  amountMinor: number;
  amountUsd: number;
  providerKey: string;
  timestamp: string;
};

const setCheckoutPaymentDebugInfo = (entry: CheckoutPaymentDebugInfo) => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(CHECKOUT_PAYMENT_DEBUG_KEY, JSON.stringify(entry));
  } catch {
    // ignore storage write failures
  }
};

const getCheckoutPaymentDebugInfo = (): CheckoutPaymentDebugInfo | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_PAYMENT_DEBUG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      routePath: String((parsed as any).routePath || ''),
      mode:
        String((parsed as any).mode || '').toUpperCase() === 'COMPATIBILITY'
          ? 'COMPATIBILITY'
          : String((parsed as any).mode || '').toUpperCase() === 'LEGACY_INTENT_FORCED'
            ? 'LEGACY_INTENT_FORCED'
          : String((parsed as any).mode || '').toUpperCase() === 'LEGACY_INTENT'
            ? 'LEGACY_INTENT'
            : 'PRIMARY',
      amountMinor: Number((parsed as any).amountMinor || 0),
      amountUsd: Number((parsed as any).amountUsd || 0),
      providerKey: String((parsed as any).providerKey || ''),
      timestamp: String((parsed as any).timestamp || ''),
    };
  } catch {
    return null;
  }
};

const STATIC_COUNTRY_NAMES = getCountryOptions().map((entry) => String(entry.name || '').trim()).filter(Boolean);

const normalizeApiImageObjectList = (images: unknown): Array<{ url: string }> =>
  (Array.isArray(images) ? images : [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return String((entry as any).url || '');
      return '';
    })
    .map((entry) => resolveApiAssetUrl(entry))
    .filter(Boolean)
    .map((url) => ({ url }));

const normalizeSellerFabricsResponse = (payload: any) => {
  if (!payload || !payload.success || !Array.isArray(payload.data)) return payload;
  return {
    ...payload,
    data: payload.data.map((item: any) => ({
      ...item,
      images: normalizeApiImageObjectList(item?.images),
    })),
  };
};

const normalizeDesignerDesignsResponse = (payload: any) => {
  if (!payload || !payload.success || !Array.isArray(payload.data)) return payload;
  return {
    ...payload,
    data: payload.data.map((item: any) => ({
      ...item,
      images: normalizeApiImageObjectList(item?.images),
      suitableFabrics: Array.isArray(item?.suitableFabrics)
        ? item.suitableFabrics.map((entry: any) => ({
            ...entry,
            fabric: entry?.fabric
              ? {
                  ...entry.fabric,
                  images: normalizeApiImageObjectList(entry.fabric.images),
                }
              : entry?.fabric,
          }))
        : item?.suitableFabrics,
    })),
  };
};

const normalizeDesignerReadyToWearResponse = (payload: any) => {
  if (!payload || !payload.success || !Array.isArray(payload.data)) return payload;
  return {
    ...payload,
    data: payload.data.map((item: any) => ({
      ...item,
      images: normalizeApiImageObjectList(item?.images),
    })),
  };
};

async function readSellerProfileCompletionWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/profile-completion', '/seller/profile-completion']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller profile-completion route not found.');
}

async function readSellerDashboardWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/dashboard', '/seller/dashboard']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller dashboard route not found.');
}

async function readSellerFabricsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/fabrics', '/seller/fabrics']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      return normalizeSellerFabricsResponse(response) as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller fabrics route not found.');
}

async function readSellerOrdersWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/orders', '/seller/orders']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller orders route not found.');
}

async function readSellerTryOnInsightsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of [
    '/seller/try-on/insights',
    '/fabric-seller/try-on/insights',
    '/seller/tryon/insights',
    '/fabric-seller/tryon/insights',
    '/seller/3d-try-on/insights',
    '/fabric-seller/3d-try-on/insights',
    '/seller/3d-tryon/insights',
    '/fabric-seller/3d-tryon/insights',
  ]) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller TryON insights route not found.');
}

async function writeSellerProfileCompletionWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/profile-completion', '/seller/profile-completion']) {
    try {
      return await apiService.patch<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller profile-completion update route not found.');
}

async function readSellerProfileFieldsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/fabric-seller/profile-fields', '/seller/profile-fields']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Seller profile-fields route not found.');
}

async function readDesignerDashboardWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/dashboard', '/fashion-designer/dashboard']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer dashboard route not found.');
}

async function readDesignerDesignsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/designs', '/fashion-designer/designs']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      return normalizeDesignerDesignsResponse(response) as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer designs route not found.');
}

async function readDesignerReadyToWearWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/ready-to-wear', '/fashion-designer/ready-to-wear']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      return normalizeDesignerReadyToWearResponse(response) as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer ready-to-wear route not found.');
}

async function readDesignerOrdersWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/orders', '/fashion-designer/orders']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer orders route not found.');
}

async function readDesignerTryOnInsightsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of [
    '/designer/try-on/insights',
    '/fashion-designer/try-on/insights',
    '/designer/tryon/insights',
    '/fashion-designer/tryon/insights',
    '/designer/3d-try-on/insights',
    '/fashion-designer/3d-try-on/insights',
    '/designer/3d-tryon/insights',
    '/fashion-designer/3d-tryon/insights',
  ]) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer TryON insights route not found.');
}

async function readDesignerProfileCompletionWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/profile-completion', '/fashion-designer/profile-completion']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer profile-completion route not found.');
}

async function writeDesignerProfileCompletionWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/designer/profile-completion', '/fashion-designer/profile-completion']) {
    try {
      return await apiService.patch<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer profile-completion update route not found.');
}

async function readDesignerProfileFieldsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/designer/profile-fields', '/fashion-designer/profile-fields']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Designer profile-fields route not found.');
}

type MeasurementTemplateRow = {
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
};
type ReadyToWearStandardSize = string;
type ReadyToWearSizeSettings = {
  sizes: Array<ReadyToWearStandardSize>;
  minVariantStock: number;
};

const MEASUREMENT_TEMPLATES_FALLBACK_KEY = 'af_measurement_templates_fallback_v1';
const READY_TO_WEAR_SIZES_FALLBACK_KEY = 'af_ready_to_wear_sizes_fallback_v1';
const READY_TO_WEAR_SIZE_GUIDE_FALLBACK_KEY = 'af_ready_to_wear_size_guide_fallback_v1';

const READY_TO_WEAR_SIZES_DEFAULT: Array<ReadyToWearStandardSize> = ['S', 'M', 'L', 'XL'];
const READY_TO_WEAR_MIN_VARIANT_STOCK_DEFAULT = 2;
const READY_TO_WEAR_SIZE_GUIDE_DEFAULT = {
  title: 'Ready-To-Wear Size Guide',
  content:
    'Use your body measurements to select your best standard size.\n\nS: Bust 84-90cm, Waist 66-72cm, Hips 90-96cm\nM: Bust 91-98cm, Waist 73-80cm, Hips 97-104cm\nL: Bust 99-106cm, Waist 81-88cm, Hips 105-112cm\nXL: Bust 107-115cm, Waist 89-98cm, Hips 113-122cm',
};

const normalizeMeasurementTemplates = (input: unknown): MeasurementTemplateRow[] =>
  Array.isArray(input)
    ? input
        .map((entry) => {
          const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
          return {
            name: String(row.name || '').trim(),
            unit: String(row.unit || 'cm').trim() || 'cm',
            isRequired: Boolean(row.isRequired),
            instructions: String(row.instructions || '').trim(),
          } as MeasurementTemplateRow;
        })
        .filter((row) => row.name.length > 0)
    : [];

const normalizeReadyToWearSizes = (input: unknown): Array<ReadyToWearStandardSize> => {
  const raw = Array.isArray(input) ? input : [];
  const normalized = Array.from(
    new Set(
      raw
        .map((entry) => String(entry || '').trim().toUpperCase())
        .filter((entry) => entry.length > 0 && entry.length <= 20)
        .slice(0, 20)
    )
  );
  return normalized.length >= 3 ? normalized : [...READY_TO_WEAR_SIZES_DEFAULT];
};

const normalizeReadyToWearMinVariantStock = (input: unknown): number => {
  const numeric = Number(input);
  if (!Number.isFinite(numeric)) return READY_TO_WEAR_MIN_VARIANT_STOCK_DEFAULT;
  return Math.max(2, Math.min(500, Math.floor(numeric)));
};

const normalizeReadyToWearSizeGuide = (input: unknown) => {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const title = String(row.title || '').trim();
  const content = String(row.content || '').trim();
  return {
    title: title.length > 0 ? title : READY_TO_WEAR_SIZE_GUIDE_DEFAULT.title,
    content: content.length > 0 ? content : READY_TO_WEAR_SIZE_GUIDE_DEFAULT.content,
  };
};

const readMeasurementTemplatesFallback = (): MeasurementTemplateRow[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(MEASUREMENT_TEMPLATES_FALLBACK_KEY);
    if (!raw) return [];
    return normalizeMeasurementTemplates(JSON.parse(raw));
  } catch {
    return [];
  }
};
const writeMeasurementTemplatesFallback = (templates: MeasurementTemplateRow[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      MEASUREMENT_TEMPLATES_FALLBACK_KEY,
      JSON.stringify(normalizeMeasurementTemplates(templates))
    );
  } catch {
    // ignore localStorage write failures
  }
};

const readReadyToWearSizesFallback = (): ReadyToWearSizeSettings => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {
      sizes: [...READY_TO_WEAR_SIZES_DEFAULT],
      minVariantStock: READY_TO_WEAR_MIN_VARIANT_STOCK_DEFAULT,
    };
  }
  try {
    const raw = window.localStorage.getItem(READY_TO_WEAR_SIZES_FALLBACK_KEY);
    if (!raw) {
      return {
        sizes: [...READY_TO_WEAR_SIZES_DEFAULT],
        minVariantStock: READY_TO_WEAR_MIN_VARIANT_STOCK_DEFAULT,
      };
    }
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      sizes: normalizeReadyToWearSizes(parsed?.sizes),
      minVariantStock: normalizeReadyToWearMinVariantStock(parsed?.minVariantStock),
    };
  } catch {
    return {
      sizes: [...READY_TO_WEAR_SIZES_DEFAULT],
      minVariantStock: READY_TO_WEAR_MIN_VARIANT_STOCK_DEFAULT,
    };
  }
};
const writeReadyToWearSizesFallback = (settings: ReadyToWearSizeSettings) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      READY_TO_WEAR_SIZES_FALLBACK_KEY,
      JSON.stringify({
        sizes: normalizeReadyToWearSizes(settings.sizes),
        minVariantStock: normalizeReadyToWearMinVariantStock(settings.minVariantStock),
      })
    );
  } catch {
    // ignore localStorage write failures
  }
};

const readReadyToWearSizeGuideFallback = (): { title: string; content: string } => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...READY_TO_WEAR_SIZE_GUIDE_DEFAULT };
  }
  try {
    const raw = window.localStorage.getItem(READY_TO_WEAR_SIZE_GUIDE_FALLBACK_KEY);
    if (!raw) return { ...READY_TO_WEAR_SIZE_GUIDE_DEFAULT };
    return normalizeReadyToWearSizeGuide(JSON.parse(raw));
  } catch {
    return { ...READY_TO_WEAR_SIZE_GUIDE_DEFAULT };
  }
};
const writeReadyToWearSizeGuideFallback = (payload: { title: string; content: string }) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      READY_TO_WEAR_SIZE_GUIDE_FALLBACK_KEY,
      JSON.stringify(normalizeReadyToWearSizeGuide(payload))
    );
  } catch {
    // ignore localStorage write failures
  }
};

async function readMeasurementTemplatesWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/admin/measurement-templates', '/admin/measurement_templates']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const rows = normalizeMeasurementTemplates(response?.data);
      writeMeasurementTemplatesFallback(rows);
      return { success: true, data: rows } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: readMeasurementTemplatesFallback(),
    } as T;
  }
  throw lastError ?? new Error('Measurement templates route not found.');
}

async function writeMeasurementTemplatesWithFallback<T>(templates: MeasurementTemplateRow[]) {
  let lastError: unknown = null;
  for (const path of ['/admin/measurement-templates', '/admin/measurement_templates']) {
    try {
      const response = await apiService.put<any>(path, { templates });
      writeMeasurementTemplatesFallback(templates);
      return (response || { success: true, data: templates }) as T;
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      const response = await apiService.patch<any>(path, { templates });
      writeMeasurementTemplatesFallback(templates);
      return (response || { success: true, data: templates }) as T;
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  if (isRetryableRouteError(lastError)) {
    writeMeasurementTemplatesFallback(templates);
    return {
      success: true,
      data: templates,
      message: 'Measurement templates saved to local fallback.',
    } as T;
  }
  throw lastError ?? new Error('Measurement templates update route not found.');
}

async function readReadyToWearSizesSettingsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/admin/ready-to-wear-sizes', '/admin/readytowear-sizes']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const normalizedSettings: ReadyToWearSizeSettings = {
        sizes: normalizeReadyToWearSizes(response?.data?.sizes),
        minVariantStock: normalizeReadyToWearMinVariantStock(response?.data?.minVariantStock),
      };
      writeReadyToWearSizesFallback(normalizedSettings);
      return {
        success: true,
        data: normalizedSettings,
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: readReadyToWearSizesFallback(),
    } as T;
  }
  throw lastError ?? new Error('Ready-to-wear sizes route not found.');
}

async function writeReadyToWearSizesSettingsWithFallback<T>(input: ReadyToWearSizeSettings) {
  const normalizedSettings: ReadyToWearSizeSettings = {
    sizes: normalizeReadyToWearSizes(input?.sizes),
    minVariantStock: normalizeReadyToWearMinVariantStock(input?.minVariantStock),
  };
  let lastError: unknown = null;
  for (const path of ['/admin/ready-to-wear-sizes', '/admin/readytowear-sizes']) {
    try {
      const response = await apiService.put<any>(path, normalizedSettings);
      writeReadyToWearSizesFallback(normalizedSettings);
      return (response || { success: true, data: normalizedSettings }) as T;
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      const response = await apiService.patch<any>(path, normalizedSettings);
      writeReadyToWearSizesFallback(normalizedSettings);
      return (response || { success: true, data: normalizedSettings }) as T;
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  if (isRetryableRouteError(lastError)) {
    writeReadyToWearSizesFallback(normalizedSettings);
    return {
      success: true,
      data: normalizedSettings,
      message: 'Ready-to-wear sizes saved to local fallback.',
    } as T;
  }
  throw lastError ?? new Error('Ready-to-wear sizes update route not found.');
}

async function readReadyToWearSizeGuideSettingsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/admin/ready-to-wear-size-guide', '/admin/readytowear-size-guide']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const normalized = normalizeReadyToWearSizeGuide(response?.data);
      writeReadyToWearSizeGuideFallback(normalized);
      return {
        success: true,
        data: normalized,
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: readReadyToWearSizeGuideFallback(),
    } as T;
  }
  throw lastError ?? new Error('Ready-to-wear size guide route not found.');
}

async function writeReadyToWearSizeGuideSettingsWithFallback<T>(payload: { title: string; content: string }) {
  const normalized = normalizeReadyToWearSizeGuide(payload);
  let lastError: unknown = null;
  for (const path of ['/admin/ready-to-wear-size-guide', '/admin/readytowear-size-guide']) {
    try {
      const response = await apiService.put<any>(path, normalized);
      writeReadyToWearSizeGuideFallback(normalized);
      return (response || { success: true, data: normalized }) as T;
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      const response = await apiService.patch<any>(path, normalized);
      writeReadyToWearSizeGuideFallback(normalized);
      return (response || { success: true, data: normalized }) as T;
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  if (isRetryableRouteError(lastError)) {
    writeReadyToWearSizeGuideFallback(normalized);
    return {
      success: true,
      data: normalized,
      message: 'Ready-to-wear size guide saved to local fallback.',
    } as T;
  }
  throw lastError ?? new Error('Ready-to-wear size guide update route not found.');
}

type DesignerFabricAccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type DesignerFabricAccessFallbackRequest = {
  id: string;
  designerUserId: string;
  requestedCountries: string[];
  reason?: string;
  status: DesignerFabricAccessRequestStatus;
  reviewNotes?: string;
  reviewedByUserId?: string;
  reviewedByName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  businessName?: string;
  email?: string;
  homeCountry?: string;
};

const DESIGNER_FABRIC_COUNTRY_ACCESS_FALLBACK_KEY = 'af_designer_fabric_country_access_fallback_v1';
const DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_FALLBACK_KEY = 'af_designer_fabric_country_access_requests_fallback_v1';

const normalizeCountryToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase();
const normalizeCountryName = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
const dedupeCountryList = (input: unknown) => {
  const rows = Array.isArray(input) ? input : [];
  const deduped = new Map<string, string>();
  for (const entry of rows) {
    const country = normalizeCountryName(entry);
    const token = normalizeCountryToken(country);
    if (!country || !token) continue;
    if (!deduped.has(token)) deduped.set(token, country);
  }
  return Array.from(deduped.values());
};
const normalizeRequestStatus = (value: unknown): DesignerFabricAccessRequestStatus => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'APPROVED' || normalized === 'REJECTED') return normalized;
  return 'PENDING';
};

const readDesignerFabricAccessFallbackMap = (): Record<string, string[]> => {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(DESIGNER_FABRIC_COUNTRY_ACCESS_FALLBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const next: Record<string, string[]> = {};
    for (const [designerUserId, countries] of Object.entries(parsed as Record<string, unknown>)) {
      const userId = String(designerUserId || '').trim();
      if (!userId) continue;
      next[userId] = dedupeCountryList(countries);
    }
    return next;
  } catch {
    return {};
  }
};
const writeDesignerFabricAccessFallbackMap = (value: Record<string, string[]>) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const sanitized: Record<string, string[]> = {};
    for (const [designerUserId, countries] of Object.entries(value || {})) {
      const userId = String(designerUserId || '').trim();
      if (!userId) continue;
      sanitized[userId] = dedupeCountryList(countries);
    }
    window.localStorage.setItem(
      DESIGNER_FABRIC_COUNTRY_ACCESS_FALLBACK_KEY,
      JSON.stringify(sanitized)
    );
  } catch {
    // ignore localStorage failures
  }
};

const readDesignerFabricAccessRequestsFallback = (): DesignerFabricAccessFallbackRequest[] => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    const rejectedRetentionMs = 7 * 24 * 60 * 60 * 1000;
    return parsed
      .map((entry) => {
        const row = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
        return {
          id: String(row.id || '').trim(),
          designerUserId: String(row.designerUserId || '').trim(),
          requestedCountries: dedupeCountryList(row.requestedCountries),
          reason: String(row.reason || '').trim() || undefined,
          status: normalizeRequestStatus(row.status),
          reviewNotes: String(row.reviewNotes || '').trim() || undefined,
          reviewedByUserId: String(row.reviewedByUserId || '').trim() || undefined,
          reviewedByName: String(row.reviewedByName || '').trim() || undefined,
          createdAt: String(row.createdAt || new Date().toISOString()),
          updatedAt: String(row.updatedAt || row.createdAt || new Date().toISOString()),
          resolvedAt: String(row.resolvedAt || '').trim() || undefined,
          businessName: String(row.businessName || '').trim() || undefined,
          email: String(row.email || '').trim() || undefined,
          homeCountry: String(row.homeCountry || '').trim() || undefined,
        } as DesignerFabricAccessFallbackRequest;
      })
      .filter((row) => row.id && row.designerUserId && row.requestedCountries.length > 0)
      .filter((row) => {
        if (row.status !== 'REJECTED') return true;
        const baseTime = new Date(row.resolvedAt || row.updatedAt || row.createdAt).getTime();
        if (!Number.isFinite(baseTime)) return true;
        return now - baseTime <= rejectedRetentionMs;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch {
    return [];
  }
};
const writeDesignerFabricAccessRequestsFallback = (value: DesignerFabricAccessFallbackRequest[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const sanitized = (Array.isArray(value) ? value : [])
      .map((entry) => ({
        ...entry,
        id: String(entry.id || '').trim(),
        designerUserId: String(entry.designerUserId || '').trim(),
        requestedCountries: dedupeCountryList(entry.requestedCountries),
        status: normalizeRequestStatus(entry.status),
        createdAt: String(entry.createdAt || new Date().toISOString()),
        updatedAt: String(entry.updatedAt || entry.createdAt || new Date().toISOString()),
      }))
      .filter((entry) => entry.id && entry.designerUserId && entry.requestedCountries.length > 0);
    window.localStorage.setItem(
      DESIGNER_FABRIC_COUNTRY_ACCESS_REQUESTS_FALLBACK_KEY,
      JSON.stringify(sanitized)
    );
  } catch {
    // ignore localStorage failures
  }
};

async function readAdminDesignerFabricCountryAccessWithFallback<T>(params?: { search?: string }) {
  let lastError: unknown = null;
  for (const path of [
    '/admin/designer-fabric-country-access',
    '/admin/designer/fabric-country-access',
    '/admin/designer-fabric-access',
  ]) {
    try {
      const response = await apiService.get<any>(path, {
        params: { ...(params || {}), _r: Date.now() },
      });
      const designers = Array.isArray(response?.data?.designers) ? response.data.designers : [];
      const map: Record<string, string[]> = {};
      for (const row of designers) {
        const userId = String(row?.designerUserId || '').trim();
        if (!userId) continue;
        map[userId] = dedupeCountryList(row?.extraCountries);
      }
      writeDesignerFabricAccessFallbackMap(map);
      const serverAvailableCountries = Array.isArray(response?.data?.availableCountries)
        ? response.data.availableCountries
        : [];
      return {
        ...(response || {}),
        success: response?.success !== false,
        data: {
          ...(response?.data || {}),
          designers,
          availableCountries: dedupeCountryList([...serverAvailableCountries, ...STATIC_COUNTRY_NAMES]),
        },
      } as T;
    } catch (error) {
      lastError = error;
      // Keep probing aliases; fallback logic below also handles network failures.
    }
  }

  const fallbackMap = readDesignerFabricAccessFallbackMap();
  let designerProfiles: any[] = [];
  let sellerProfiles: any[] = [];
  try {
    const response = await apiService.get<any>('/admin/vendor-profiles', {
      params: { role: 'FASHION_DESIGNER', page: 1, limit: 500, search: params?.search || undefined, _r: Date.now() },
    });
    designerProfiles = Array.isArray(response?.data?.profiles) ? response.data.profiles : [];
  } catch {
    designerProfiles = [];
  }
  try {
    const response = await apiService.get<any>('/admin/vendor-profiles', {
      params: { role: 'FABRIC_SELLER', page: 1, limit: 500, _r: Date.now() },
    });
    sellerProfiles = Array.isArray(response?.data?.profiles) ? response.data.profiles : [];
  } catch {
    sellerProfiles = [];
  }
  const availableCountries = dedupeCountryList(
    [
      ...sellerProfiles.map((entry) => entry?.profileData?.country || entry?.country).filter(Boolean),
      ...STATIC_COUNTRY_NAMES,
    ]
  );
  const designers = designerProfiles.map((entry) => {
    const designerUserId = String(entry?.userId || '').trim();
    const homeCountry = String(entry?.profileData?.country || entry?.country || '').trim();
    const extraCountries = dedupeCountryList(fallbackMap[designerUserId] || []).filter(
      (country) => normalizeCountryToken(country) !== normalizeCountryToken(homeCountry)
    );
    const allowedCountries = dedupeCountryList([homeCountry, ...extraCountries]);
    const fullName = `${String(entry?.user?.firstName || '').trim()} ${String(entry?.user?.lastName || '').trim()}`.trim();
    return {
      designerProfileId: String(entry?.profileId || entry?.id || '').trim(),
      designerUserId,
      businessName: String(entry?.businessName || '').trim() || fullName || String(entry?.user?.email || '').trim(),
      email: String(entry?.user?.email || '').trim(),
      homeCountry,
      extraCountries,
      allowedCountries,
    };
  });
  return {
    success: true,
    data: {
      designers,
      availableCountries,
    },
    message: 'Designer country access loaded from local fallback.',
  } as T;
}

async function writeAdminDesignerFabricCountryAccessWithFallback<T>(designerUserId: string, extraCountries: string[]) {
  const normalizedUserId = String(designerUserId || '').trim();
  const normalizedExtraCountries = dedupeCountryList(extraCountries);
  let lastError: unknown = null;
  for (const path of [
    `/admin/designer-fabric-country-access/${normalizedUserId}`,
    `/admin/designer/fabric-country-access/${normalizedUserId}`,
    `/admin/designer-fabric-access/${normalizedUserId}`,
  ]) {
    try {
      const response = await apiService.put<any>(path, {
        extraCountries: normalizedExtraCountries,
      });
      const nextMap = {
        ...readDesignerFabricAccessFallbackMap(),
        [normalizedUserId]: dedupeCountryList(response?.data?.extraCountries || normalizedExtraCountries),
      };
      writeDesignerFabricAccessFallbackMap(nextMap);
      return response as T;
    } catch (error) {
      lastError = error;
      // Try next alias and gracefully degrade for network errors.
    }
  }
  return {
    success: false,
    message: isRetryableRouteError(lastError)
      ? 'Designer fabric country access route not available on this backend deployment.'
      : String((lastError as any)?.response?.data?.message || (lastError as any)?.message || 'Network error while updating designer country access.'),
  } as T;
}

async function readAdminDesignerFabricCountryAccessRequestsWithFallback<T>(params?: {
  status?: DesignerFabricAccessRequestStatus | 'ALL';
  search?: string;
  page?: number;
  limit?: number;
}) {
  let lastError: unknown = null;
  for (const path of [
    '/admin/designer-fabric-country-access/requests/list',
    '/admin/designer-fabric-country-access/requests',
    '/admin/designer/fabric-country-access/requests/list',
    '/admin/designer/fabric-country-access/requests',
    '/admin/designer-fabric-access/requests/list',
    '/admin/designer-fabric-access/requests',
  ]) {
    try {
      const response = await apiService.get<any>(path, {
        params: { ...(params || {}), _r: Date.now() },
      });
      const rows = Array.isArray(response?.data) ? response.data : [];
      writeDesignerFabricAccessRequestsFallback(rows);
      return {
        ...(response || {}),
        data: rows,
        pagination: response?.pagination || {
          page: Math.max(1, Number(params?.page || 1)),
          limit: Math.max(1, Math.min(100, Number(params?.limit || 20))),
          total: rows.length,
          pages: Math.max(1, Math.ceil(rows.length / Math.max(1, Math.min(100, Number(params?.limit || 20))))),
        },
      } as T;
    } catch (error) {
      lastError = error;
      // Continue alias probing and use local fallback below on errors.
    }
  }
  const fallbackRows = readDesignerFabricAccessRequestsFallback();
  const normalizedStatus = normalizeRequestStatus(params?.status);
  const search = String(params?.search || '').trim().toLowerCase();
  const filtered = fallbackRows.filter((row) => {
    if (normalizedStatus !== 'ALL' && row.status !== normalizedStatus) return false;
    if (!search) return true;
    return (
      String(row.designerUserId || '').toLowerCase().includes(search) ||
      row.requestedCountries.some((country) => String(country || '').toLowerCase().includes(search)) ||
      String(row.reason || '').toLowerCase().includes(search)
    );
  });
  const page = Math.max(1, Number(params?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(params?.limit || 20)));
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);
  return {
    success: true,
    data,
    pagination: {
      page,
      limit,
      total: filtered.length,
      pages: Math.max(1, Math.ceil(filtered.length / limit)),
    },
    message: isRetryableRouteError(lastError)
      ? 'Country access requests route unavailable; showing local fallback.'
      : String((lastError as any)?.response?.data?.message || (lastError as any)?.message || 'Network error while loading country access requests; showing fallback.'),
  } as T;
}

async function reviewAdminDesignerFabricCountryAccessRequestWithFallback<T>(
  requestId: string,
  payload: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string; grantedCountries?: string[] }
) {
  let lastError: unknown = null;
  for (const path of [
    `/admin/designer-fabric-country-access/requests/${encodeURIComponent(requestId)}/review`,
    `/admin/designer-fabric-country-access/requests/${encodeURIComponent(requestId)}`,
    `/admin/designer/fabric-country-access/requests/${encodeURIComponent(requestId)}/review`,
    `/admin/designer/fabric-country-access/requests/${encodeURIComponent(requestId)}`,
    `/admin/designer-fabric-access/requests/${encodeURIComponent(requestId)}/review`,
    `/admin/designer-fabric-access/requests/${encodeURIComponent(requestId)}`,
  ]) {
    try {
      const response = await apiService.patch<any>(path, payload);
      return response as T;
    } catch (error) {
      lastError = error;
      // Continue alias probing and degrade gracefully on network failures.
    }
    try {
      const response = await apiService.put<any>(path, payload);
      return response as T;
    } catch (error) {
      lastError = error;
      // Continue alias probing and degrade gracefully on network failures.
    }
  }
  return {
    success: false,
    message: isRetryableRouteError(lastError)
      ? 'Country access review route is not available on this backend deployment.'
      : String((lastError as any)?.response?.data?.message || (lastError as any)?.message || 'Network error while reviewing country access request.'),
  } as T;
}

async function readDesignerFabricCountryAccessSummaryWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of [
    '/designer/fabric-country-access',
    '/fashion-designer/fabric-country-access',
    '/designer/fabric-country-access/summary',
  ]) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const homeCountry = String(response?.data?.homeCountry || '').trim();
      const allowedCountries = dedupeCountryList(response?.data?.allowedCountries || []);
      const availableCountries = dedupeCountryList([
        ...(Array.isArray(response?.data?.availableCountries) ? response.data.availableCountries : []),
        ...allowedCountries,
        ...STATIC_COUNTRY_NAMES,
      ]);
      return {
        ...(response || {}),
        data: {
          ...(response?.data || {}),
          homeCountry,
          allowedCountries,
          availableCountries,
        },
      } as T;
    } catch (error) {
      lastError = error;
      // Continue probing aliases and then fallback, including network errors.
    }
  }
  const profileCompletion = await readDesignerProfileCompletionWithFallback<any>().catch(() => null);
  const homeCountry = String(profileCompletion?.data?.profile?.country || '').trim();
  const allowedCountries = dedupeCountryList([homeCountry]);
  const fallbackMessage = isRetryableRouteError(lastError)
    ? 'Designer country-access route unavailable; showing home-country-only fallback.'
    : String((lastError as any)?.response?.data?.message || (lastError as any)?.message || 'Network error while loading country-access summary.');
  return {
    success: true,
    data: {
      homeCountry,
      allowedCountries,
      availableCountries: dedupeCountryList([...allowedCountries, ...STATIC_COUNTRY_NAMES]),
      requests: [],
    },
    message: fallbackMessage,
  } as T;
}

async function createDesignerFabricCountryAccessRequestWithFallback<T>(payload: {
  requestedCountries: string[];
  reason?: string;
}) {
  let lastError: unknown = null;
  for (const path of [
    '/designer/fabric-country-access/requests',
    '/fashion-designer/fabric-country-access/requests',
    '/designer/fabric-country-access/request',
  ]) {
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (!isRetryableRouteError(error)) throw error;
    }
  }
  return {
    success: false,
    message: isRetryableRouteError(lastError)
      ? 'Designer fabric country access request route is not available on the current backend deployment. Please contact admin.'
      : String((lastError as any)?.response?.data?.message || (lastError as any)?.message || 'Network error while submitting country access request.'),
  } as T;
}

async function updateDesignerReadyToWearSizeStockWithFallback<T>(
  productId: string,
  sizes: Array<{ size: string; color?: string; stock: number }>
) {
  const safeProductId = encodeURIComponent(String(productId || '').trim());
  let lastError: unknown = null;
  const payload = { sizes };
  for (const path of [
    `/designer/ready-to-wear/${safeProductId}/size-stock`,
    `/designer/ready-to-wear/${safeProductId}/stock`,
    `/designer/ready-to-wear/${safeProductId}/sizes/stock`,
    `/fashion-designer/ready-to-wear/${safeProductId}/size-stock`,
  ]) {
    try {
      return await apiService.patch<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (!isRetryableRouteError(error)) throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    throw new Error('Ready-to-wear size stock endpoint is not available on this backend deployment yet.');
  }
  throw lastError ?? new Error('Ready-to-wear size stock route not found.');
}

const PARTNER_APPS_FALLBACK_KEY = 'af_partner_apps_fallback_v1';
const CATEGORY_PAGE_SETTINGS_FALLBACK_KEY_PREFIX = 'af_category_page_settings_fallback_v1_';

const readPartnerAppsFallback = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [] as any[];
  try {
    const raw = window.localStorage.getItem(PARTNER_APPS_FALLBACK_KEY);
    if (!raw) return [] as any[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as any[];
  }
};
const writePartnerAppsFallback = (rows: any[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PARTNER_APPS_FALLBACK_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // ignore local storage failures
  }
};
const slugifyPartnerName = (value: string) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `partner-${Date.now()}`;

const readCategoryPageSettingsFallback = (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR') => {
  if (typeof window === 'undefined' || !window.localStorage) return null as any;
  try {
    const raw = window.localStorage.getItem(`${CATEGORY_PAGE_SETTINGS_FALLBACK_KEY_PREFIX}${pageType}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const defaultCategoryPageSettings = (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR') => ({
  bannerTitle: pageType === 'FABRIC_TO_BUY' ? 'Fabrics To Buy' : pageType === 'CUSTOM_TO_WEAR' ? 'Custom To Wear' : 'Ready To Wear',
  bannerSubtitle: '',
  bannerImage: '',
  designPreset: 'STANDARD' as 'STANDARD' | 'EDITORIAL' | 'MINIMAL',
  bannerHeight: 320,
  pageSize: 24,
  columns: 4,
  showPagination: true,
  featuredProductIds: [] as string[],
  featuredSlots: [
    { productId: '', isActive: false },
    { productId: '', isActive: false },
    { productId: '', isActive: false },
  ] as Array<{ productId: string; isActive: boolean }>,
  rotatingProductIds: [] as string[],
  rotatingColumns: 2,
  rotatingRows: 1,
  rotatingTitleSize: 32,
});

const normalizeCategoryPageSettingsPayload = (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR', input: any) => {
  const merged = {
    ...defaultCategoryPageSettings(pageType),
    ...(input && typeof input === 'object' ? input : {}),
  } as any;
  const presetToken = String(merged.designPreset || '').trim().toUpperCase();
  const designPreset =
    presetToken === 'EDITORIAL' || presetToken === 'MINIMAL' || presetToken === 'STANDARD'
      ? presetToken
      : 'STANDARD';
  return {
    ...merged,
    designPreset,
    bannerImage: resolveApiAssetUrl(merged.bannerImage),
  };
};

const resolveActiveFeaturedIdsFromSettings = (settings: any) => {
  if (Array.isArray(settings?.featuredSlots)) {
    return settings.featuredSlots
      .map((slot: any) => ({
        productId: String(slot?.productId || '').trim(),
        isActive: slot?.isActive !== false,
      }))
      .filter((slot: any) => slot.isActive && slot.productId)
      .map((slot: any) => slot.productId)
      .slice(0, 3);
  }
  return Array.isArray(settings?.featuredProductIds)
    ? settings.featuredProductIds.map((id: any) => String(id || '').trim()).filter(Boolean).slice(0, 3)
    : [];
};

const toCategoryPageHref = (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR', id: string) =>
  pageType === 'FABRIC_TO_BUY' ? `/fabrics/${id}` : pageType === 'CUSTOM_TO_WEAR' ? `/custom/${id}` : `/ready-to-wear/${id}`;

const optionToPreview = (
  pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
  option: any
) => ({
  id: String(option?.id || ''),
  name: String(option?.name || '').trim() || 'Product',
  description: String(option?.description || '').trim() || undefined,
  image: resolveApiAssetUrl(option?.image),
  priceUsd: Number(option?.priceUsd || 0),
  country: String(option?.country || '').trim(),
  ownerName: String(option?.ownerName || '').trim() || 'Seller',
  href: toCategoryPageHref(pageType, String(option?.id || '')),
});
const writeCategoryPageSettingsFallback = (
  pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
  payload: any
) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(`${CATEGORY_PAGE_SETTINGS_FALLBACK_KEY_PREFIX}${pageType}`, JSON.stringify(payload || {}));
  } catch {
    // ignore local storage failures
  }
};

async function readAdminPartnerAppsWithFallback<T>() {
  try {
    const response = await apiService.get<any>('/admin/partners/apps', noCacheRequestConfig());
    writePartnerAppsFallback(Array.isArray(response?.data) ? response.data : []);
    return response as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  return {
    success: true,
    data: readPartnerAppsFallback(),
    message: 'Partner apps loaded from local fallback.',
  } as T;
}
async function createAdminPartnerAppWithFallback<T>(data: {
  name: string;
  description?: string;
  scopes?: string[];
  rateLimitPerMinute?: number;
  allowedIps?: string[];
  webhookUrl?: string;
}) {
  try {
    const response = await apiService.post<any>('/admin/partners/apps', data);
    return response as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  const nowIso = new Date().toISOString();
  const fallbackApp = {
    id: `local-partner-${Date.now()}`,
    name: String(data.name || '').trim(),
    slug: slugifyPartnerName(data.name),
    description: String(data.description || '').trim() || null,
    status: 'ACTIVE',
    scopes: Array.isArray(data.scopes) && data.scopes.length > 0 ? data.scopes : ['catalog:read', 'orders:read'],
    rateLimitPerMinute: Number(data.rateLimitPerMinute || 120),
    allowedIps: Array.isArray(data.allowedIps) ? data.allowedIps : [],
    webhookUrl: String(data.webhookUrl || '').trim() || null,
    credentialCount: 1,
    activeCredentialCount: 1,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  writePartnerAppsFallback([fallbackApp, ...readPartnerAppsFallback()]);
  return {
    success: true,
    message: 'Partner app saved locally while backend route is unavailable.',
    data: {
      app: fallbackApp,
      generatedCredential: {
        token: `local-token-${Math.random().toString(36).slice(2, 14)}`,
        webhookSecret: `local-whsec-${Math.random().toString(36).slice(2, 14)}`,
      },
    },
  } as T;
}
async function updateAdminPartnerAppWithFallback<T>(appId: string, data: Record<string, unknown>) {
  try {
    return (await apiService.patch<any>(`/admin/partners/apps/${appId}`, data)) as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  const rows = readPartnerAppsFallback();
  const index = rows.findIndex((entry: any) => String(entry?.id) === String(appId));
  if (index >= 0) {
    rows[index] = { ...rows[index], ...(data || {}), updatedAt: new Date().toISOString() };
    writePartnerAppsFallback(rows);
  }
  return { success: true, message: 'Partner app updated in local fallback.', data: rows[index] || null } as T;
}
async function rotateAdminPartnerAppKeyWithFallback<T>(appId: string, expiresAt?: string) {
  try {
    return (await apiService.post<any>(`/admin/partners/apps/${appId}/rotate-key`, { expiresAt })) as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  return {
    success: true,
    message: 'Partner credential rotated locally.',
    data: { token: `local-token-${Math.random().toString(36).slice(2, 18)}` },
  } as T;
}
async function rotateAdminPartnerWebhookSecretWithFallback<T>(appId: string) {
  try {
    return (await apiService.post<any>(`/admin/partners/apps/${appId}/rotate-webhook-secret`)) as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  return {
    success: true,
    message: 'Webhook secret rotated locally.',
    data: { webhookSecret: `local-whsec-${Math.random().toString(36).slice(2, 18)}` },
  } as T;
}
async function sendAdminPartnerTestWebhookWithFallback<T>(appId: string) {
  try {
    return (await apiService.post<any>(`/admin/partners/apps/${appId}/test-webhook`)) as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  return {
    success: true,
    message: 'Test webhook simulated in local fallback.',
    data: { success: true, fallback: true },
  } as T;
}

async function readAdminCategoryPageSettingsWithFallback<T>(pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR') {
  let lastError: unknown = null;
  for (const path of [`/category-page-settings/admin/${pageType}`, `/category-page-settings/${pageType}`]) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      if (response?.data?.settings) {
        const normalizedSettings = normalizeCategoryPageSettingsPayload(pageType, response.data.settings);
        writeCategoryPageSettingsFallback(pageType, normalizedSettings);
        return {
          ...(response || {}),
          data: {
            ...(response?.data || {}),
            settings: normalizedSettings,
          },
        } as T;
      }
      return response as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError;
  const fallbackSettings = normalizeCategoryPageSettingsPayload(pageType, readCategoryPageSettingsFallback(pageType) || {});
  return {
    success: true,
    data: {
      pageType,
      settings: fallbackSettings,
      featuredProducts: [],
      rotatingProducts: [],
    },
    message: 'Category page settings loaded from local fallback.',
  } as T;
}
async function writeAdminCategoryPageSettingsWithFallback<T>(
  pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
  data: Record<string, unknown>
) {
  let lastError: unknown = null;
  for (const method of ['patch', 'put'] as const) {
    try {
      const response =
        method === 'patch'
          ? await apiService.patch<any>(`/category-page-settings/admin/${pageType}`, data)
          : await apiService.put<any>(`/category-page-settings/admin/${pageType}`, data);
      if (response?.data?.settings) {
        const normalizedSettings = normalizeCategoryPageSettingsPayload(pageType, response.data.settings);
        writeCategoryPageSettingsFallback(pageType, normalizedSettings);
        return {
          ...(response || {}),
          data: {
            ...(response?.data || {}),
            settings: normalizedSettings,
          },
        } as T;
      }
      return response as T;
    } catch (error) {
      lastError = error;
      if (!isRetryableRouteError(error)) throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError;
  const current = normalizeCategoryPageSettingsPayload(pageType, readCategoryPageSettingsFallback(pageType) || {});
  const settings = normalizeCategoryPageSettingsPayload(pageType, { ...current, ...(data || {}) });
  writeCategoryPageSettingsFallback(pageType, settings);
  return {
    success: true,
    data: {
      pageType,
      settings,
      featuredProducts: [],
      rotatingProducts: [],
    },
    message: 'Category page settings saved to local fallback.',
  } as T;
}
async function readCategoryPageProductOptionsWithFallback<T>(
  pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
  params?: { search?: string; limit?: number }
) {
  try {
    const response = await apiService.get<any>(`/category-page-settings/admin/${pageType}/options`, {
      params: { ...(params || {}), _r: Date.now() },
    });
    return {
      ...(response || {}),
      data: Array.isArray(response?.data) ? response.data : [],
    } as T;
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  const search = String(params?.search || '').trim().toLowerCase();
  const limit = Math.max(10, Math.min(200, Number(params?.limit || 120)));
  let rows: any[] = [];
  if (pageType === 'READY_TO_WEAR') {
    const response = await apiService.get<any>('/products/ready-to-wear', {
      params: { limit: Math.max(200, limit), page: 1, _r: Date.now() },
    });
    const products = Array.isArray(response?.data?.products) ? response.data.products : [];
    rows = products.map((entry: any) => ({
      id: String(entry?.id || ''),
      name: String(entry?.name || 'Ready To Wear'),
      ownerName: String(entry?.designer?.businessName || entry?.designer?.name || 'Designer'),
      country: String(entry?.designer?.country || ''),
      priceUsd: Number(entry?.finalPrice || entry?.basePrice || 0),
      image: String(entry?.images?.[0]?.url || ''),
    }));
  } else if (pageType === 'FABRIC_TO_BUY') {
    const response = await apiService.get<any>('/products/fabrics', {
      params: { limit: Math.max(200, limit), page: 1, _r: Date.now() },
    });
    const products = Array.isArray(response?.data?.fabrics) ? response.data.fabrics : [];
    rows = products.map((entry: any) => ({
      id: String(entry?.id || ''),
      name: String(entry?.name || 'Fabric'),
      ownerName: String(entry?.seller?.businessName || 'Seller'),
      country: String(entry?.seller?.country || ''),
      priceUsd: Number(entry?.finalPrice || entry?.sellerPrice || 0),
      image: String(entry?.images?.[0]?.url || ''),
    }));
  } else {
    const response = await apiService.get<any>('/products/designs', {
      params: { limit: Math.max(200, limit), page: 1, _r: Date.now() },
    });
    const products = Array.isArray(response?.data?.designs) ? response.data.designs : [];
    rows = products.map((entry: any) => ({
      id: String(entry?.id || ''),
      name: String(entry?.name || 'Design'),
      ownerName: String(entry?.designer?.businessName || 'Designer'),
      country: String(entry?.designer?.country || ''),
      priceUsd: Number(entry?.finalPrice || entry?.basePrice || 0),
      image: String(entry?.images?.[0]?.url || ''),
    }));
  }
  const filtered = rows
    .filter((entry) => entry.id)
    .filter((entry) => {
      if (!search) return true;
      return (
        String(entry.name || '').toLowerCase().includes(search) ||
        String(entry.ownerName || '').toLowerCase().includes(search) ||
        String(entry.country || '').toLowerCase().includes(search)
      );
    })
    .slice(0, limit);
  return {
    success: true,
    data: filtered,
    message: 'Product options loaded from fallback products endpoint.',
  } as T;
}

async function readPublicCategoryPageSettingsWithFallback<T>(
  pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR'
) {
  let lastError: unknown = null;
  for (const path of [`/category-page-settings/${pageType}`, `/category-page-settings/admin/${pageType}`]) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const settings = normalizeCategoryPageSettingsPayload(pageType, response?.data?.settings || {});
      writeCategoryPageSettingsFallback(pageType, settings);

      let featuredProducts = Array.isArray(response?.data?.featuredProducts) ? response.data.featuredProducts : [];
      let rotatingProducts = Array.isArray(response?.data?.rotatingProducts) ? response.data.rotatingProducts : [];
      const activeFeaturedIds = resolveActiveFeaturedIdsFromSettings(settings);
      const needsFeaturedHydration = featuredProducts.length === 0 && activeFeaturedIds.length > 0;
      const needsRotatingHydration =
        rotatingProducts.length === 0 &&
        Array.isArray(settings?.rotatingProductIds) &&
        settings.rotatingProductIds.length > 0;
      if (needsFeaturedHydration || needsRotatingHydration) {
        const optionsResponse = await readCategoryPageProductOptionsWithFallback<any>(pageType, { limit: 220 });
        const optionsRows = Array.isArray(optionsResponse?.data) ? optionsResponse.data : [];
        const optionMap = new Map(optionsRows.map((row: any) => [String(row?.id || ''), row]));
        if (needsFeaturedHydration) {
          featuredProducts = activeFeaturedIds
            .map((id: any) => optionMap.get(String(id || '').trim()))
            .filter(Boolean)
            .map((row: any) => optionToPreview(pageType, row));
        }
        if (needsRotatingHydration) {
          rotatingProducts = (settings.rotatingProductIds || [])
            .map((id: any) => optionMap.get(String(id || '').trim()))
            .filter(Boolean)
            .map((row: any) => optionToPreview(pageType, row));
        }
      }

      return {
        ...(response || {}),
        success: response?.success !== false,
        data: {
          ...(response?.data || {}),
          pageType,
          settings,
          featuredProducts,
          rotatingProducts,
        },
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError;
  const settings = normalizeCategoryPageSettingsPayload(pageType, readCategoryPageSettingsFallback(pageType) || {});
  let featuredProducts: any[] = [];
  let rotatingProducts: any[] = [];
  try {
    const optionsResponse = await readCategoryPageProductOptionsWithFallback<any>(pageType, { limit: 220 });
    const optionsRows = Array.isArray(optionsResponse?.data) ? optionsResponse.data : [];
    const optionMap = new Map(optionsRows.map((row: any) => [String(row?.id || ''), row]));
    featuredProducts = resolveActiveFeaturedIdsFromSettings(settings)
      .map((id: any) => optionMap.get(String(id || '').trim()))
      .filter(Boolean)
      .map((row: any) => optionToPreview(pageType, row));
    rotatingProducts = (settings.rotatingProductIds || [])
      .map((id: any) => optionMap.get(String(id || '').trim()))
      .filter(Boolean)
      .map((row: any) => optionToPreview(pageType, row));
  } catch {
    featuredProducts = [];
    rotatingProducts = [];
  }
  return {
    success: true,
    data: {
      pageType,
      settings,
      featuredProducts,
      rotatingProducts,
    },
    message: 'Category page settings loaded from local fallback.',
  } as T;
}

async function readDesignerFabricOptionsWithFallback<T>(params?: {
  country?: string;
  materialTypeId?: string;
  search?: string;
  limit?: number;
}) {
  let lastError: unknown = null;
  try {
    const response = await apiService.get<any>('/designer/fabric-options', {
      params: { ...(params || {}), _r: Date.now() },
    });
    if (!response?.success || !response?.data) return response as T;
    const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
    return {
      ...response,
      data: {
        ...response.data,
        fabrics: rows.map((entry: any) => ({
          ...entry,
          image: resolveApiAssetUrl(entry?.image || entry?.images?.[0]?.url || entry?.images?.[0] || ''),
        })),
      },
    } as T;
  } catch (error) {
    lastError = error;
    if (!isRetryableRouteError(error)) throw error;
  }
  if (!isRetryableRouteError(lastError)) throw lastError;
  const fabricsResponse = await apiService.get<any>('/products/fabrics', {
    params: { limit: Math.max(50, Number(params?.limit || 300)), _r: Date.now() },
  });
  const rows = Array.isArray(fabricsResponse?.data?.fabrics) ? fabricsResponse.data.fabrics : [];
  const normalizedRows = rows.map((entry: any) => ({
    id: String(entry?.id || '').trim(),
    name: String(entry?.name || 'Fabric').trim(),
    materialTypeId: String(entry?.materialTypeId || entry?.materialType?.id || '').trim(),
    materialTypeName: String(entry?.materialType?.name || 'Material').trim(),
    sellerCountry: String(entry?.seller?.country || '').trim(),
    sellerName: String(entry?.seller?.businessName || 'Fabric Seller').trim(),
    priceUsd: Number(entry?.finalPrice || entry?.sellerPrice || 0),
    image: resolveApiAssetUrl(String(entry?.images?.[0]?.url || '').trim()),
  }));
  const profileCompletion = await readDesignerProfileCompletionWithFallback<any>().catch(() => null);
  const homeCountry = String(profileCompletion?.data?.profile?.country || '').trim();
  const allowedCountries = dedupeCountryList([homeCountry]);
  const allowedTokens = new Set(allowedCountries.map((country) => normalizeCountryToken(country)));
  const requestedCountryToken = normalizeCountryToken(params?.country);
  const filteredRows = normalizedRows.filter((entry) => {
    if (!entry.id) return false;
    const countryToken = normalizeCountryToken(entry.sellerCountry);
    if (allowedTokens.size === 0) return false;
    if (countryToken && !allowedTokens.has(countryToken)) return false;
    if (requestedCountryToken && countryToken !== requestedCountryToken) return false;
    if (params?.materialTypeId && entry.materialTypeId !== params.materialTypeId) return false;
    if (params?.search && !entry.name.toLowerCase().includes(String(params.search).toLowerCase())) return false;
    return true;
  });
  const countries = dedupeCountryList([
    ...allowedCountries,
    ...filteredRows.map((entry) => entry.sellerCountry).filter(Boolean),
  ]);
  const materials = Array.from(
    new Map(
      filteredRows
        .map((entry) => [entry.materialTypeId, { id: entry.materialTypeId, name: entry.materialTypeName }] as const)
        .filter(([id]) => Boolean(id))
    ).values()
  );
  return {
    success: true,
    data: {
      allowedCountries,
      countries,
      materials,
      fabrics: filteredRows.slice(0, Math.max(1, Number(params?.limit || 300))),
    },
    message: 'Fabric options loaded from fallback endpoint.',
  } as T;
}

async function readDesignerMeasurementTemplateOptionsWithFallback<T>() {
  try {
    return await apiService.get<T>('/designer/measurement-template-options', noCacheRequestConfig());
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
  }
  const templatesResponse = await readMeasurementTemplatesWithFallback<any>();
  const templates = normalizeMeasurementTemplates(templatesResponse?.data);
  return {
    success: true,
    data: templates,
  } as T;
}

const PAYMENT_INTEGRATIONS_FALLBACK_KEY = 'af_payment_integrations_fallback_v1';
const PAYMENT_INTEGRATIONS_BUILTIN_KEYS = ['STRIPE', 'FLUTTERWAVE', 'PAYPAL'];

const PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS = {
  providers: [
    {
      id: 'fallback-stripe',
      providerKey: 'STRIPE',
      displayName: 'Stripe',
      checkoutType: 'INLINE' as const,
      mode: 'TEST' as const,
      isActive: true,
      configSchema: [
        { key: 'publishableKey', label: 'Publishable Key', type: 'TEXT', required: false, exposePublic: true },
        { key: 'secretKey', label: 'Secret Key', type: 'PASSWORD', required: false, isSecret: true },
      ],
      configValues: {
        publishableKey: '',
      },
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fallback-flutterwave',
      providerKey: 'FLUTTERWAVE',
      displayName: 'Flutterwave',
      checkoutType: 'REDIRECT' as const,
      mode: 'TEST' as const,
      isActive: false,
      configSchema: [
        { key: 'publicKey', label: 'Public Key', type: 'TEXT', required: false, exposePublic: true },
        { key: 'secretKey', label: 'Secret Key', type: 'PASSWORD', required: false, isSecret: true },
      ],
      configValues: {},
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fallback-paypal',
      providerKey: 'PAYPAL',
      displayName: 'PayPal',
      checkoutType: 'REDIRECT' as const,
      mode: 'TEST' as const,
      isActive: false,
      configSchema: [
        { key: 'clientId', label: 'Client ID', type: 'TEXT', required: false, exposePublic: true },
        { key: 'clientSecret', label: 'Client Secret', type: 'PASSWORD', required: false, isSecret: true },
      ],
      configValues: {},
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
  ],
  builtinProviderKeys: PAYMENT_INTEGRATIONS_BUILTIN_KEYS,
};

const normalizePaymentProviderKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

const clonePaymentFallbackState = (state: typeof PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS) => ({
  providers: (state.providers || []).map((provider: any) => ({
    ...provider,
    configSchema: Array.isArray(provider.configSchema) ? provider.configSchema.map((field: any) => ({ ...field })) : [],
    configValues: provider.configValues && typeof provider.configValues === 'object' ? { ...provider.configValues } : {},
  })),
  builtinProviderKeys: Array.isArray(state.builtinProviderKeys)
    ? [...state.builtinProviderKeys]
    : [...PAYMENT_INTEGRATIONS_BUILTIN_KEYS],
});

const readPaymentFallbackState = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return clonePaymentFallbackState(PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS);
  }
  try {
    const raw = window.localStorage.getItem(PAYMENT_INTEGRATIONS_FALLBACK_KEY);
    if (!raw) return clonePaymentFallbackState(PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return clonePaymentFallbackState(PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS);
    }
    return clonePaymentFallbackState({
      providers: Array.isArray((parsed as any).providers) ? (parsed as any).providers : PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS.providers,
      builtinProviderKeys: Array.isArray((parsed as any).builtinProviderKeys)
        ? (parsed as any).builtinProviderKeys
        : PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS.builtinProviderKeys,
    });
  } catch {
    return clonePaymentFallbackState(PAYMENT_INTEGRATIONS_FALLBACK_DEFAULTS);
  }
};

const writePaymentFallbackState = (state: { providers: any[]; builtinProviderKeys: string[] }) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PAYMENT_INTEGRATIONS_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // ignore localStorage write failures
  }
};

async function readAdminPaymentIntegrationsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/payments/admin/integrations', '/admin/payments/integrations']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const fallback = readPaymentFallbackState();
    return {
      success: true,
      data: fallback,
    } as T;
  }
  throw lastError ?? new Error('Payment integrations route not found.');
}

async function createAdminPaymentIntegrationWithFallback<T>(data: {
  providerKey: string;
  displayName?: string;
  checkoutType?: 'INLINE' | 'REDIRECT';
  mode?: 'TEST' | 'LIVE';
  isActive?: boolean;
  configSchema?: any[];
  configValues?: Record<string, any>;
  notes?: string | null;
}) {
  let lastError: unknown = null;
  for (const path of ['/payments/admin/integrations', '/admin/payments/integrations']) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Payment integration create route not found.');

  const state = readPaymentFallbackState();
  const providerKey = normalizePaymentProviderKey(data.providerKey);
  if (!providerKey) {
    throw new Error('Provider key is required.');
  }
  const existing = state.providers.find((entry: any) => String(entry.providerKey).toUpperCase() === providerKey);
  if (existing) {
    throw new Error(`${providerKey} already exists.`);
  }
  const row = {
    id: `fallback-${providerKey.toLowerCase()}-${Date.now()}`,
    providerKey,
    displayName: String(data.displayName || providerKey),
    checkoutType: data.checkoutType === 'REDIRECT' ? 'REDIRECT' : 'INLINE',
    mode: data.mode === 'LIVE' ? 'LIVE' : 'TEST',
    isActive: Boolean(data.isActive),
    configSchema: Array.isArray(data.configSchema) ? data.configSchema : [],
    configValues: data.configValues && typeof data.configValues === 'object' ? data.configValues : {},
    notes: data.notes || '',
    updatedAt: new Date().toISOString(),
  };
  state.providers.push(row);
  writePaymentFallbackState(state);
  return {
    success: true,
    data: row,
  } as T;
}

async function updateAdminPaymentIntegrationWithFallback<T>(
  providerKey: string,
  data: {
    displayName?: string;
    checkoutType?: 'INLINE' | 'REDIRECT';
    mode?: 'TEST' | 'LIVE';
    isActive?: boolean;
    configSchema?: any[];
    configValues?: Record<string, any>;
    notes?: string | null;
  }
) {
  let lastError: unknown = null;
  for (const path of [`/payments/admin/integrations/${providerKey}`, `/admin/payments/integrations/${providerKey}`]) {
    try {
      return await apiService.put<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Payment integration update route not found.');

  const normalizedKey = normalizePaymentProviderKey(providerKey);
  const state = readPaymentFallbackState();
  const existingIndex = state.providers.findIndex((entry: any) => String(entry.providerKey).toUpperCase() === normalizedKey);
  if (existingIndex < 0) {
    throw new Error(`${normalizedKey} was not found in local fallback storage.`);
  }
  const existing = state.providers[existingIndex];
  const updated = {
    ...existing,
    ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
    ...(data.checkoutType !== undefined ? { checkoutType: data.checkoutType } : {}),
    ...(data.mode !== undefined ? { mode: data.mode } : {}),
    ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    ...(data.configSchema !== undefined ? { configSchema: data.configSchema } : {}),
    ...(data.configValues !== undefined ? { configValues: data.configValues } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    updatedAt: new Date().toISOString(),
  };
  state.providers[existingIndex] = updated;
  writePaymentFallbackState(state);
  return {
    success: true,
    data: updated,
  } as T;
}

async function deleteAdminPaymentIntegrationWithFallback<T>(providerKey: string) {
  let lastError: unknown = null;
  for (const path of [`/payments/admin/integrations/${providerKey}`, `/admin/payments/integrations/${providerKey}`]) {
    try {
      return await apiService.delete<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Payment integration delete route not found.');

  const normalizedKey = normalizePaymentProviderKey(providerKey);
  const state = readPaymentFallbackState();
  const isBuiltin = state.builtinProviderKeys.includes(normalizedKey);
  if (isBuiltin) {
    state.providers = state.providers.map((entry: any) =>
      String(entry.providerKey).toUpperCase() === normalizedKey ? { ...entry, isActive: false, updatedAt: new Date().toISOString() } : entry
    );
  } else {
    state.providers = state.providers.filter((entry: any) => String(entry.providerKey).toUpperCase() !== normalizedKey);
  }
  writePaymentFallbackState(state);
  return {
    success: true,
    message: 'Payment integration removed.',
  } as T;
}

async function readPaymentOptionsWithFallback<T>(params?: {
  useCase?: 'CHECKOUT' | 'FEATURED' | 'ENTERPRISE' | 'WITHDRAWAL';
}) {
  const requestedUseCase = String(params?.useCase || '').trim().toUpperCase();
  const useCase =
    requestedUseCase === 'FEATURED' || requestedUseCase === 'ENTERPRISE' ? requestedUseCase : 'CHECKOUT';
  try {
    return await apiService.get<T>('/payments/options', {
      ...noCacheRequestConfig(),
      params: {
        ...(noCacheRequestConfig().params || {}),
        useCase,
      },
    });
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    const state = readPaymentFallbackState();
    const providers = (state.providers || [])
      .filter((provider: any) => Boolean(provider.isActive))
      .filter((provider: any) => {
        const configured =
          provider?.configValues && typeof provider.configValues === 'object'
            ? (provider.configValues as Record<string, unknown>)
            : {};
        const rawUseCases = Array.isArray(configured.enabledUseCases)
          ? configured.enabledUseCases
          : typeof configured.enabledUseCases === 'string'
            ? String(configured.enabledUseCases)
                .split(',')
                .map((entry) => entry.trim())
            : ['CHECKOUT', 'FEATURED', 'ENTERPRISE', 'WITHDRAWAL'];
        const normalized = rawUseCases
          .map((entry) => String(entry || '').trim().toUpperCase())
          .filter(Boolean);
        return normalized.includes(useCase);
      })
      .map((provider: any) => {
        const schema = Array.isArray(provider.configSchema) ? provider.configSchema : [];
        const values = provider.configValues && typeof provider.configValues === 'object' ? provider.configValues : {};
        const publicConfig: Record<string, any> = {};
        for (const field of schema) {
          if (!field?.exposePublic) continue;
          const key = String(field.key || '');
          if (!key) continue;
          publicConfig[key] = (values as any)[key];
        }
        return {
          providerKey: String(provider.providerKey || '').toUpperCase(),
          displayName: String(provider.displayName || provider.providerKey || 'Payment Provider'),
          checkoutType: provider.checkoutType === 'REDIRECT' ? 'REDIRECT' : 'INLINE',
          mode: provider.mode === 'LIVE' ? 'LIVE' : 'TEST',
          enabledUseCases:
            provider?.configValues && Array.isArray(provider.configValues.enabledUseCases)
              ? provider.configValues.enabledUseCases
              : ['CHECKOUT', 'FEATURED', 'ENTERPRISE', 'WITHDRAWAL'],
          publicConfig,
        };
      });
    return {
      success: true,
      data: {
        providers: providers.length > 0 ? providers : [{ providerKey: 'STRIPE', displayName: 'Stripe', checkoutType: 'INLINE', mode: 'TEST', publicConfig: {} }],
      },
    } as T;
  }
}

async function createPaymentSessionWithFallback<T>(data: {
  providerKey: string;
  amount: number;
  amountUsd?: number;
  currency: string;
  reference?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customer?: { email?: string; name?: string; phone?: string };
}) {
  const providedAmountMinor = Number(data.amount);
  const providedAmountUsd = Number(data.amountUsd);
  const normalizedAmountMinor =
    Number.isFinite(providedAmountMinor) && providedAmountMinor > 0
      ? Math.round(providedAmountMinor)
      : Number.isFinite(providedAmountUsd) && providedAmountUsd > 0
        ? Math.round(providedAmountUsd * 100)
        : 0;
  const normalizedAmountUsd =
    Number.isFinite(providedAmountUsd) && providedAmountUsd > 0
      ? Number(providedAmountUsd.toFixed(2))
      : normalizedAmountMinor > 0
        ? Number((normalizedAmountMinor / 100).toFixed(2))
        : 0;
  const payload = {
    ...data,
    amount: normalizedAmountMinor,
    amountUsd: normalizedAmountUsd,
  };
  const createSessionPaths = [
    '/payments/create-session',
    '/payments/create_session',
    '/payments/session/create',
    '/payment/create-session',
    '/payment/create_session',
    '/payment/session/create',
  ];
  const createIntentPaths = [
    '/payments/create-intent',
    '/payment/create-intent',
    '/payments/intent/create',
    '/payment/intent/create',
  ];
  const isAmountUsdRequiredError = (error: unknown) => {
    const status = (error as AxiosError)?.response?.status;
    const message = String((error as AxiosError)?.response?.data?.message || '').toLowerCase();
    return status === 400 && message.includes('amountusd') && message.includes('required');
  };
  const postLegacyStripeIntent = async () => {
    let lastError: unknown = null;
    for (const path of createIntentPaths) {
      try {
        return await apiService.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>(path, {
          amount: normalizedAmountMinor,
          currency: data.currency,
        });
      } catch (error) {
        if (isAmountUsdRequiredError(error)) {
          try {
            return await apiService.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>(path, {
              providerKey: data.providerKey,
              amount: normalizedAmountMinor,
              amountMinor: normalizedAmountMinor,
              amountCents: normalizedAmountMinor,
              amountUsd: normalizedAmountUsd,
              amountUSD: normalizedAmountUsd,
              amount_usd: normalizedAmountUsd,
              amountInUsd: normalizedAmountUsd,
              convertedAmountUsd: normalizedAmountUsd,
              currency: data.currency,
              reference: data.reference,
              returnUrl: data.returnUrl,
              cancelUrl: data.cancelUrl,
              customer: data.customer,
            });
          } catch (compatibilityError) {
            lastError = compatibilityError;
            if (isRetryableRouteError(compatibilityError)) continue;
            throw compatibilityError;
          }
        }
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new Error('Legacy create-intent route not found.');
  };
  const postCreateSession = async (
    sessionPayload: Record<string, unknown>,
    mode: CheckoutPaymentDebugInfo['mode']
  ) => {
    let lastError: unknown = null;
    for (const path of createSessionPaths) {
      try {
        const response = await apiService.post<T>(path, sessionPayload);
        setCheckoutPaymentDebugInfo({
          routePath: path,
          mode,
          amountMinor: normalizedAmountMinor,
          amountUsd: normalizedAmountUsd,
          providerKey: normalizePaymentProviderKey(data.providerKey),
          timestamp: new Date().toISOString(),
        });
        return response;
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new Error('Payment create-session route not found.');
  };
  const createStripeLegacyIntentFallback = async () => {
    const legacy = await postLegacyStripeIntent();
    if (!legacy.success) throw new Error('Failed to initialize Stripe payment.');
    setCheckoutPaymentDebugInfo({
      routePath: '/payments/create-intent',
      mode: 'LEGACY_INTENT',
      amountMinor: normalizedAmountMinor,
      amountUsd: normalizedAmountUsd,
      providerKey: 'STRIPE',
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      data: {
        providerKey: 'STRIPE',
        flow: 'INLINE',
        reference: String(legacy.data.paymentIntentId || ''),
        clientSecret: legacy.data.clientSecret,
        paymentIntentId: legacy.data.paymentIntentId,
      },
    } as T;
  };
  const createStripeLegacyIntentForcedFallback = async () => {
    const legacy = await postLegacyStripeIntent();
    if (!legacy.success) throw new Error('Failed to initialize Stripe fallback payment.');
    setCheckoutPaymentDebugInfo({
      routePath: '/payments/create-intent',
      mode: 'LEGACY_INTENT_FORCED',
      amountMinor: normalizedAmountMinor,
      amountUsd: normalizedAmountUsd,
      providerKey: 'STRIPE',
      timestamp: new Date().toISOString(),
    });
    return {
      success: true,
      data: {
        providerKey: 'STRIPE',
        flow: 'INLINE',
        reference: String(legacy.data.paymentIntentId || ''),
        clientSecret: legacy.data.clientSecret,
        paymentIntentId: legacy.data.paymentIntentId,
      },
    } as T;
  };
  try {
    return await postCreateSession(payload as Record<string, unknown>, 'PRIMARY');
  } catch (error) {
    const message = String((error as AxiosError)?.response?.data?.message || '').toLowerCase();
    if (
      (error as AxiosError)?.response?.status === 400 &&
      message.includes('amountusd') &&
      message.includes('required') &&
      payload.amount > 0
    ) {
      // Legacy deployments may parse alternate USD amount keys only.
      const compatibilityPayload = {
        providerKey: data.providerKey,
        amountUsd: payload.amountUsd,
        amountUSD: payload.amountUsd,
        amount_usd: payload.amountUsd,
        convertedAmountUsd: payload.amountUsd,
        amountInUsd: payload.amountUsd,
        amount: payload.amount,
        currency: data.currency,
        reference: data.reference,
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        customer: data.customer,
      };
      try {
        return await postCreateSession(compatibilityPayload as Record<string, unknown>, 'COMPATIBILITY');
      } catch (compatibilityError) {
        if (normalizedAmountMinor > 0) {
          try {
            return await createStripeLegacyIntentForcedFallback();
          } catch {
            // fall through to original compatibility error
          }
        }
        throw compatibilityError;
      }
    }
    if (!isRetryableRouteError(error)) throw error;
    const providerKey = normalizePaymentProviderKey(data.providerKey);
    if (providerKey === 'STRIPE') {
      return await createStripeLegacyIntentFallback();
    }
    throw new Error(
      `${providerKey} payment session endpoint is not available on the current backend deployment yet.`
    );
  }
}

async function verifyPaymentWithFallback<T>(data: { providerKey: string; reference: string; payerId?: string }) {
  try {
    return await apiService.post<T>('/payments/verify', data);
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    const providerKey = normalizePaymentProviderKey(data.providerKey);
    if (providerKey === 'STRIPE') {
      const legacy = await apiService.post<{ success: boolean; data: any }>('/payments/confirm', {
        paymentIntentId: data.reference,
      });
      if (!legacy.success) throw new Error('Failed to verify Stripe payment.');
      return {
        success: true,
        data: {
          providerKey: 'STRIPE',
          isPaid: true,
          paymentReference: data.reference,
          status: 'CONFIRMED',
        },
      } as T;
    }
    throw new Error(
      `${providerKey} payment verification endpoint is not available on the current backend deployment yet.`
    );
  }
}

const SHIPPING_FALLBACK_KEY = 'af_shipping_integrations_fallback_v1';
const SHIPPING_LOCAL_OPTIONS_FALLBACK_KEY = 'af_shipping_local_options_fallback_v1';
const SHIPPING_STAGE_TEMPLATES_FALLBACK_KEY = 'af_shipping_stage_templates_fallback_v1';
const SHIPPING_ORDER_STAGE_EVENTS_FALLBACK_KEY = 'af_shipping_order_stage_events_fallback_v1';
const SHIPPING_BUILTIN_PROVIDER_KEYS = ['UPS', 'USPS', 'FEDEX', 'DHL'];

const SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS = {
  providers: [
    {
      id: 'fallback-ups',
      providerKey: 'UPS',
      displayName: 'UPS',
      providerType: 'GLOBAL',
      mode: 'TEST',
      isActive: true,
      supportsCountries: [],
      configSchema: [
        { key: 'apiKey', label: 'API Key', type: 'PASSWORD', required: false, isSecret: true },
        { key: 'apiSecret', label: 'API Secret', type: 'PASSWORD', required: false, isSecret: true },
        { key: 'accountNumber', label: 'Account Number', type: 'TEXT', required: false },
        { key: 'baseRateUsd', label: 'Base Rate (USD)', type: 'NUMBER', required: true },
        { key: 'percentRate', label: 'Rate % of Subtotal', type: 'NUMBER', required: false },
        { key: 'markupUsd', label: 'Extra Markup (USD)', type: 'NUMBER', required: false },
        { key: 'etaMinDays', label: 'ETA Min Days', type: 'NUMBER', required: false },
        { key: 'etaMaxDays', label: 'ETA Max Days', type: 'NUMBER', required: false },
      ],
      configValues: { baseRateUsd: 30, percentRate: 2.5, markupUsd: 0, etaMinDays: 4, etaMaxDays: 10 },
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fallback-usps',
      providerKey: 'USPS',
      displayName: 'USPS',
      providerType: 'GLOBAL',
      mode: 'TEST',
      isActive: false,
      supportsCountries: [],
      configSchema: [],
      configValues: { baseRateUsd: 25, percentRate: 2.2, markupUsd: 0, etaMinDays: 5, etaMaxDays: 11 },
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fallback-fedex',
      providerKey: 'FEDEX',
      displayName: 'FedEx',
      providerType: 'GLOBAL',
      mode: 'TEST',
      isActive: false,
      supportsCountries: [],
      configSchema: [],
      configValues: { baseRateUsd: 32, percentRate: 2.9, markupUsd: 0, etaMinDays: 3, etaMaxDays: 8 },
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'fallback-dhl',
      providerKey: 'DHL',
      displayName: 'DHL',
      providerType: 'GLOBAL',
      mode: 'TEST',
      isActive: false,
      supportsCountries: [],
      configSchema: [],
      configValues: { baseRateUsd: 35, percentRate: 3.1, markupUsd: 0, etaMinDays: 3, etaMaxDays: 7 },
      notes: 'Local fallback config',
      updatedAt: new Date().toISOString(),
    },
  ],
  builtinProviderKeys: SHIPPING_BUILTIN_PROVIDER_KEYS,
};

const normalizeShippingProviderKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

const normalizeCountryCodeToken = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 2);

const readShippingFallbackIntegrations = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return JSON.parse(JSON.stringify(SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS));
  }
  try {
    const raw = window.localStorage.getItem(SHIPPING_FALLBACK_KEY);
    if (!raw) return JSON.parse(JSON.stringify(SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS));
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return JSON.parse(JSON.stringify(SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS));
    return {
      providers: Array.isArray((parsed as any).providers)
        ? (parsed as any).providers
        : SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS.providers,
      builtinProviderKeys: Array.isArray((parsed as any).builtinProviderKeys)
        ? (parsed as any).builtinProviderKeys
        : SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS.builtinProviderKeys,
    };
  } catch {
    return JSON.parse(JSON.stringify(SHIPPING_INTEGRATIONS_FALLBACK_DEFAULTS));
  }
};

const writeShippingFallbackIntegrations = (state: { providers: any[]; builtinProviderKeys: string[] }) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SHIPPING_FALLBACK_KEY, JSON.stringify(state));
  } catch {
    // ignore write failures
  }
};

const readShippingFallbackLocalOptions = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [] as any[];
  try {
    const raw = window.localStorage.getItem(SHIPPING_LOCAL_OPTIONS_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeShippingFallbackLocalOptions = (rows: any[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SHIPPING_LOCAL_OPTIONS_FALLBACK_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // ignore write failures
  }
};

const readShippingFallbackStageTemplates = () => {
  const defaults = [
    {
      id: 'stage-local-default-order-received',
      providerKey: 'LOCAL_DEFAULT',
      stageKey: 'ORDER_RECEIVED',
      stageLabel: 'Order Received',
      description: 'Local carrier has received shipment request.',
      sortOrder: 0,
      isFinal: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'stage-local-default-picked-up',
      providerKey: 'LOCAL_DEFAULT',
      stageKey: 'PICKED_UP',
      stageLabel: 'Picked Up',
      description: 'Shipment has been picked up from origin.',
      sortOrder: 1,
      isFinal: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'stage-local-default-in-transit',
      providerKey: 'LOCAL_DEFAULT',
      stageKey: 'IN_TRANSIT',
      stageLabel: 'In Transit',
      description: 'Shipment is currently moving to destination.',
      sortOrder: 2,
      isFinal: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'stage-local-default-out-for-delivery',
      providerKey: 'LOCAL_DEFAULT',
      stageKey: 'OUT_FOR_DELIVERY',
      stageLabel: 'Out For Delivery',
      description: 'Shipment is out for final delivery.',
      sortOrder: 3,
      isFinal: false,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'stage-local-default-delivered',
      providerKey: 'LOCAL_DEFAULT',
      stageKey: 'DELIVERED',
      stageLabel: 'Delivered',
      description: 'Shipment has been delivered.',
      sortOrder: 4,
      isFinal: true,
      isActive: true,
      updatedAt: new Date().toISOString(),
    },
  ] as any[];
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }
  try {
    const raw = window.localStorage.getItem(SHIPPING_STAGE_TEMPLATES_FALLBACK_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaults;
  } catch {
    return defaults;
  }
};

const writeShippingFallbackStageTemplates = (rows: any[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      SHIPPING_STAGE_TEMPLATES_FALLBACK_KEY,
      JSON.stringify(Array.isArray(rows) ? rows : [])
    );
  } catch {
    // ignore write failures
  }
};

const readShippingFallbackOrderStageEvents = () => {
  if (typeof window === 'undefined' || !window.localStorage) return {} as Record<string, any[]>;
  try {
    const raw = window.localStorage.getItem(SHIPPING_ORDER_STAGE_EVENTS_FALLBACK_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const writeShippingFallbackOrderStageEvents = (value: Record<string, any[]>) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(SHIPPING_ORDER_STAGE_EVENTS_FALLBACK_KEY, JSON.stringify(value || {}));
  } catch {
    // ignore write failures
  }
};

async function readAdminShippingIntegrationsWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/integrations', '/admin/shipping/integrations']) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const fallback = readShippingFallbackIntegrations();
    return { success: true, data: fallback } as T;
  }
  throw lastError ?? new Error('Shipping integrations route not found.');
}

async function createAdminShippingIntegrationWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/integrations', '/admin/shipping/integrations']) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping integration create route not found.');
  const state = readShippingFallbackIntegrations();
  const providerKey = normalizeShippingProviderKey(data?.providerKey);
  if (!providerKey) throw new Error('Provider key is required.');
  if (state.providers.some((entry: any) => String(entry.providerKey || '').toUpperCase() === providerKey)) {
    throw new Error(`${providerKey} already exists.`);
  }
  const row = {
    id: `fallback-${providerKey.toLowerCase()}-${Date.now()}`,
    providerKey,
    displayName: String(data?.displayName || providerKey),
    providerType: data?.providerType === 'LOCAL' ? 'LOCAL' : 'GLOBAL',
    mode: data?.mode === 'LIVE' ? 'LIVE' : 'TEST',
    isActive: Boolean(data?.isActive),
    supportsCountries: Array.isArray(data?.supportsCountries) ? data.supportsCountries : [],
    configSchema: Array.isArray(data?.configSchema) ? data.configSchema : [],
    configValues: data?.configValues && typeof data.configValues === 'object' ? data.configValues : {},
    notes: data?.notes || '',
    updatedAt: new Date().toISOString(),
  };
  state.providers.push(row);
  writeShippingFallbackIntegrations(state);
  return { success: true, data: row } as T;
}

async function updateAdminShippingIntegrationWithFallback<T>(providerKey: string, data: any) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/integrations/${providerKey}`, `/admin/shipping/integrations/${providerKey}`]) {
    try {
      return await apiService.put<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping integration update route not found.');
  const normalizedKey = normalizeShippingProviderKey(providerKey);
  const state = readShippingFallbackIntegrations();
  const index = state.providers.findIndex((entry: any) => String(entry.providerKey || '').toUpperCase() === normalizedKey);
  if (index < 0) throw new Error(`${normalizedKey} was not found in local fallback storage.`);
  state.providers[index] = {
    ...state.providers[index],
    ...data,
    providerKey: normalizedKey,
    updatedAt: new Date().toISOString(),
  };
  writeShippingFallbackIntegrations(state);
  return { success: true, data: state.providers[index] } as T;
}

async function deleteAdminShippingIntegrationWithFallback<T>(providerKey: string) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/integrations/${providerKey}`, `/admin/shipping/integrations/${providerKey}`]) {
    try {
      return await apiService.delete<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping integration delete route not found.');
  const normalizedKey = normalizeShippingProviderKey(providerKey);
  const state = readShippingFallbackIntegrations();
  const isBuiltin = (state.builtinProviderKeys || []).includes(normalizedKey);
  if (isBuiltin) {
    state.providers = state.providers.map((entry: any) =>
      String(entry.providerKey || '').toUpperCase() === normalizedKey ? { ...entry, isActive: false, updatedAt: new Date().toISOString() } : entry
    );
  } else {
    state.providers = state.providers.filter((entry: any) => String(entry.providerKey || '').toUpperCase() !== normalizedKey);
  }
  writeShippingFallbackIntegrations(state);
  return { success: true, message: 'Shipping integration removed.' } as T;
}

async function readAdminShippingLocalOptionsWithFallback<T>(params?: { countryCode?: string; city?: string; providerKey?: string }) {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/local-options', '/admin/shipping/local-options']) {
    try {
      return await apiService.get<T>(path, { params: { ...(params || {}), _r: Date.now() } });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const rows = readShippingFallbackLocalOptions().filter((row: any) => {
      if (params?.countryCode && normalizeCountryCodeToken(row.countryCode) !== normalizeCountryCodeToken(params.countryCode)) return false;
      if (params?.providerKey && normalizeShippingProviderKey(row.providerKey) !== normalizeShippingProviderKey(params.providerKey)) return false;
      if (params?.city) {
        const city = String(params.city || '').trim().toLowerCase();
        if (city && String(row.city || '').trim().toLowerCase() !== city) return false;
      }
      return true;
    });
    return { success: true, data: rows } as T;
  }
  throw lastError ?? new Error('Shipping local-options route not found.');
}

async function createAdminShippingLocalOptionWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/local-options', '/admin/shipping/local-options']) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping local option create route not found.');
  const rows = readShippingFallbackLocalOptions();
  const row = {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    countryCode: normalizeCountryCodeToken(data?.countryCode),
    countryName: String(data?.countryName || ''),
    city: data?.city ? String(data.city) : null,
    providerKey: normalizeShippingProviderKey(data?.providerKey),
    providerName: String(data?.providerName || ''),
    serviceName: String(data?.serviceName || 'Standard'),
    etaMinDays: Number(data?.etaMinDays || 0),
    etaMaxDays: Number(data?.etaMaxDays || 0),
    priceUsd: Number(data?.priceUsd || 0),
    isActive: data?.isActive !== false,
    metadata: data?.metadata && typeof data.metadata === 'object' ? data.metadata : {},
    updatedAt: new Date().toISOString(),
  };
  rows.push(row);
  writeShippingFallbackLocalOptions(rows);
  return { success: true, data: row } as T;
}

async function updateAdminShippingLocalOptionWithFallback<T>(id: string, data: any) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/local-options/${id}`, `/admin/shipping/local-options/${id}`]) {
    try {
      return await apiService.put<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping local option update route not found.');
  const rows = readShippingFallbackLocalOptions();
  const index = rows.findIndex((row: any) => String(row.id) === String(id));
  if (index < 0) throw new Error('Shipping local option was not found in local fallback storage.');
  rows[index] = { ...rows[index], ...data, id, updatedAt: new Date().toISOString() };
  writeShippingFallbackLocalOptions(rows);
  return { success: true, data: rows[index] } as T;
}

async function deleteAdminShippingLocalOptionWithFallback<T>(id: string) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/local-options/${id}`, `/admin/shipping/local-options/${id}`]) {
    try {
      return await apiService.delete<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping local option delete route not found.');
  const rows = readShippingFallbackLocalOptions().filter((row: any) => String(row.id) !== String(id));
  writeShippingFallbackLocalOptions(rows);
  return { success: true, message: 'Shipping local option removed.' } as T;
}

async function readAdminShippingStageTemplatesWithFallback<T>(params?: { providerKey?: string }) {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/stage-templates', '/admin/shipping/stage-templates']) {
    try {
      return await apiService.get<T>(path, { params: { ...(params || {}), _r: Date.now() } });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const rows = readShippingFallbackStageTemplates().filter((row: any) => {
      if (!params?.providerKey) return true;
      return normalizeShippingProviderKey(row.providerKey) === normalizeShippingProviderKey(params.providerKey);
    });
    return { success: true, data: rows } as T;
  }
  throw lastError ?? new Error('Shipping stage templates route not found.');
}

async function createAdminShippingStageTemplateWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/shipping/admin/stage-templates', '/admin/shipping/stage-templates']) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping stage template create route not found.');
  const rows = readShippingFallbackStageTemplates();
  const providerKey = normalizeShippingProviderKey(data?.providerKey || 'LOCAL_DEFAULT');
  const stageKey = normalizeShippingProviderKey(data?.stageKey || '');
  if (!stageKey) throw new Error('Stage key is required.');
  const existingIndex = rows.findIndex(
    (row: any) =>
      normalizeShippingProviderKey(row.providerKey) === providerKey &&
      normalizeShippingProviderKey(row.stageKey) === stageKey
  );
  const row = {
    id: `stage-${providerKey.toLowerCase()}-${stageKey.toLowerCase()}-${Date.now()}`,
    providerKey,
    stageKey,
    stageLabel: String(data?.stageLabel || stageKey),
    description: data?.description ? String(data.description) : '',
    sortOrder: Number(data?.sortOrder || 0),
    isFinal: Boolean(data?.isFinal),
    isActive: data?.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
  if (existingIndex >= 0) {
    rows[existingIndex] = { ...rows[existingIndex], ...row };
  } else {
    rows.push(row);
  }
  writeShippingFallbackStageTemplates(rows);
  return { success: true, data: row } as T;
}

async function updateAdminShippingStageTemplateWithFallback<T>(id: string, data: any) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/stage-templates/${id}`, `/admin/shipping/stage-templates/${id}`]) {
    try {
      return await apiService.put<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping stage template update route not found.');
  const rows = readShippingFallbackStageTemplates();
  const index = rows.findIndex((row: any) => String(row.id) === String(id));
  if (index < 0) throw new Error('Shipping stage template was not found in local fallback storage.');
  rows[index] = { ...rows[index], ...data, id, updatedAt: new Date().toISOString() };
  writeShippingFallbackStageTemplates(rows);
  return { success: true, data: rows[index] } as T;
}

async function deleteAdminShippingStageTemplateWithFallback<T>(id: string) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/stage-templates/${id}`, `/admin/shipping/stage-templates/${id}`]) {
    try {
      return await apiService.delete<T>(path);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Shipping stage template delete route not found.');
  const rows = readShippingFallbackStageTemplates().filter((row: any) => String(row.id) !== String(id));
  writeShippingFallbackStageTemplates(rows);
  return { success: true, message: 'Shipping stage template removed.' } as T;
}

async function readAdminOrderShippingStagesWithFallback<T>(orderId: string) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/orders/${orderId}/local-stages`, `/admin/shipping/orders/${orderId}/local-stages`]) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const all = readShippingFallbackOrderStageEvents();
    return {
      success: true,
      data: Array.isArray(all[orderId]) ? all[orderId] : [],
    } as T;
  }
  throw lastError ?? new Error('Order local shipping stages route not found.');
}

async function updateAdminOrderShippingStageWithFallback<T>(
  orderId: string,
  data: { providerKey?: string; stageKey: string; notes?: string; trackingNumber?: string; currentLocation?: string }
) {
  let lastError: unknown = null;
  for (const path of [`/shipping/admin/orders/${orderId}/local-stage`, `/admin/shipping/orders/${orderId}/local-stage`]) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!isRetryableRouteError(lastError)) throw lastError ?? new Error('Order local shipping stage update route not found.');
  const allEvents = readShippingFallbackOrderStageEvents();
  const list = Array.isArray(allEvents[orderId]) ? allEvents[orderId] : [];
  const event = {
    id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    providerKey: normalizeShippingProviderKey(data.providerKey || 'LOCAL_DEFAULT'),
    stageKey: normalizeShippingProviderKey(data.stageKey),
    stageLabel: String(data.stageKey || '').replace(/_/g, ' '),
    notes: data.notes || '',
    trackingNumber: data.trackingNumber || '',
    currentLocation: data.currentLocation || '',
    createdAt: new Date().toISOString(),
  };
  list.push(event);
  allEvents[orderId] = list;
  writeShippingFallbackOrderStageEvents(allEvents);
  return {
    success: true,
    data: {
      orderId,
      shippingTracking: {
        providerKey: event.providerKey,
        stageKey: event.stageKey,
        stageLabel: event.stageLabel,
        notes: event.notes,
        trackingNumber: event.trackingNumber,
        currentLocation: event.currentLocation,
        updatedAt: event.createdAt,
      },
      stages: list,
    },
  } as T;
}

async function readShippingOptionsWithFallback<T>(data: {
  countryCode: string;
  city?: string;
  subtotalUsd: number;
  weightKg?: number;
}) {
  try {
    return await apiService.post<T>('/shipping/options', data);
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    const countryCode = normalizeCountryCodeToken(data.countryCode);
    const normalizedCity = String(data.city || '').trim().toLowerCase();
    const subtotalUsd = Number(data.subtotalUsd || 0);
    const weightKg = Number(data.weightKg || 0);
    const integrationsState = readShippingFallbackIntegrations();
    const providers = Array.isArray(integrationsState.providers) ? integrationsState.providers : [];
    const globalQuotes = providers
      .filter((provider: any) => Boolean(provider.isActive))
      .filter((provider: any) => String(provider.providerType || 'GLOBAL').toUpperCase() === 'GLOBAL')
      .filter((provider: any) => {
        const supported = Array.isArray(provider.supportsCountries) ? provider.supportsCountries.map((entry: any) => normalizeCountryCodeToken(entry)).filter(Boolean) : [];
        if (supported.length === 0) return true;
        return supported.includes(countryCode);
      })
      .map((provider: any, index: number) => {
        const values = provider.configValues && typeof provider.configValues === 'object' ? provider.configValues : {};
        const baseRate = Number(values.baseRateUsd ?? 25);
        const percentRate = Number(values.percentRate ?? 2.5);
        const markupUsd = Number(values.markupUsd ?? 0);
        const etaMinDays = Math.max(0, Number(values.etaMinDays ?? 4));
        const etaMaxDays = Math.max(etaMinDays, Number(values.etaMaxDays ?? 10));
        const weightRate = Number(values.weightRateUsdPerKg ?? 0);
        const priceUsd = Number((baseRate + subtotalUsd * (percentRate / 100) + markupUsd + weightKg * weightRate).toFixed(2));
        return {
          id: `global-${normalizeShippingProviderKey(provider.providerKey || `provider-${index}`).toLowerCase()}`,
          source: 'GLOBAL',
          providerKey: normalizeShippingProviderKey(provider.providerKey),
          providerName: String(provider.displayName || provider.providerKey || 'Shipping Provider'),
          serviceName: String(values.serviceName || `${provider.displayName || provider.providerKey} Standard`),
          etaMinDays,
          etaMaxDays,
          priceUsd,
        };
      });
    const localRows = readShippingFallbackLocalOptions()
      .filter((row: any) => Boolean(row.isActive))
      .filter((row: any) => normalizeCountryCodeToken(row.countryCode) === countryCode)
      .filter((row: any) => !normalizedCity || !row.city || String(row.city).trim().toLowerCase() === normalizedCity)
      .map((row: any) => ({
        id: String(row.id),
        source: 'LOCAL',
        providerKey: normalizeShippingProviderKey(row.providerKey),
        providerName: String(row.providerName || row.providerKey || 'Local Carrier'),
        serviceName: String(row.serviceName || 'Standard'),
        etaMinDays: Number(row.etaMinDays || 0),
        etaMaxDays: Number(row.etaMaxDays || row.etaMinDays || 0),
        priceUsd: Number(Number(row.priceUsd || 0).toFixed(2)),
        countryCode: normalizeCountryCodeToken(row.countryCode),
        city: row.city ? String(row.city) : null,
      }));
    const quotes = [...globalQuotes, ...localRows].sort((a, b) => Number(a.priceUsd || 0) - Number(b.priceUsd || 0));
    return {
      success: true,
      data: {
        countryCode,
        city: data.city || '',
        quotes,
        recommendedQuoteId: quotes[0]?.id || null,
      },
    } as T;
  }
}

async function readShippingTrackingWithFallback<T>(data: { providerKey: string; trackingNumber: string }) {
  try {
    return await apiService.post<T>('/shipping/track', data);
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    throw new Error(
      `${normalizeShippingProviderKey(data.providerKey)} tracking endpoint is not available on the current backend deployment yet.`
    );
  }
}

async function readShippingCheckoutDeliveryInfoWithFallback<T>(params?: { providerKey?: string }) {
  const attempts = ['/shipping/delivery-info', '/shipping/checkout-delivery-info'];
  let lastError: unknown = null;
  for (const path of attempts) {
    try {
      return await apiService.get<T>(path, {
        params: params?.providerKey ? { providerKey: params.providerKey } : undefined,
      });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const preferredProviderKey = normalizeShippingProviderKey(params?.providerKey || 'LOCAL_DEFAULT');
    const rows = readShippingFallbackStageTemplates()
      .filter((entry: any) => Boolean(entry?.isActive))
      .filter((entry: any) => {
        const providerKey = normalizeShippingProviderKey(entry?.providerKey || 'LOCAL_DEFAULT');
        return providerKey === preferredProviderKey || providerKey === 'LOCAL_DEFAULT';
      })
      .sort((a: any, b: any) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
      .map((entry: any, index: number) => ({
        id: String(entry?.id || `${preferredProviderKey}-${index + 1}`),
        step: index + 1,
        stageKey: String(entry?.stageKey || '').toUpperCase(),
        stageLabel: String(entry?.stageLabel || entry?.stageKey || `Step ${index + 1}`),
        description: entry?.description ? String(entry.description) : null,
        isFinal: Boolean(entry?.isFinal),
        sortOrder: Number(entry?.sortOrder || index),
      }));
    return {
      success: true,
      data: {
        providerKey: preferredProviderKey,
        stages: rows,
      },
    } as T;
  }
  throw lastError ?? new Error('Checkout delivery info route not found.');
}

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
  login: (email: string, password: string, mfaMethod?: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR') =>
    apiService.post<{
      success: boolean;
      data: {
        user?: any;
        token?: string | null;
        requiresSecondFactor?: boolean;
        challenge?: any;
      };
    }>('/auth/login', { email, password, ...(mfaMethod ? { mfaMethod } : {}) }),

  loginWithGoogle: (idToken: string, mfaMethod?: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR') =>
    postWithRouteFallback<{
      success: boolean;
      data: {
        user?: any;
        token?: string | null;
        requiresSecondFactor?: boolean;
        challenge?: any;
      };
    }>(googleLoginPaths, { idToken, ...(mfaMethod ? { mfaMethod } : {}) }),

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

  requestPasswordReset: (email: string) =>
    apiService.post<{ success: boolean; message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    apiService.post<{ success: boolean; message: string }>('/auth/reset-password', { token, newPassword }),

  selectMfaChallengeMethod: (challengeId: string, method: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR') =>
    apiService.post<{
      success: boolean;
      data: {
        challenge: any;
      };
      message?: string;
    }>('/auth/mfa/challenge/select', { challengeId, method }),

  verifyMfaChallenge: (challengeId: string, code: string) =>
    apiService.post<{
      success: boolean;
      data: {
        user?: any;
        token?: string | null;
      };
      message?: string;
    }>('/auth/mfa/verify', { challengeId, code }),

  getMfaPreferences: () =>
    apiService.get<{
      success: boolean;
      data: {
        preferredMethod: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR' | null;
        availableMethods: Array<'EMAIL_OTP' | 'TOTP_AUTHENTICATOR'>;
        totpConfigured: boolean;
        required: boolean;
      };
    }>('/auth/mfa/preferences'),

  updateMfaPreferences: (preferredMethod: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR' | null) =>
    apiService.patch<{
      success: boolean;
      message?: string;
      data: { preferredMethod: 'EMAIL_OTP' | 'TOTP_AUTHENTICATOR' | null };
    }>('/auth/mfa/preferences', { preferredMethod }),

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
const toFiniteNumber = (...values: any[]) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeImageUrls = (images: any): string[] =>
  (Array.isArray(images) ? images : [])
    .map((entry) => resolveApiAssetUrl(entry?.url || entry))
    .filter(Boolean);

const normalizeImageObjects = (images: any): Array<{ url: string }> =>
  normalizeImageUrls(images).map((url) => ({ url }));

const normalizeFabricDetailPayload = (raw: any) => {
  const pricePerMeter = toFiniteNumber(
    raw?.finalPrice,
    raw?.listingUsdPrice,
    raw?.sellerPrice,
    raw?.pricePerMeter,
    raw?.price
  );
  const minOrderMeters = Math.max(3, toFiniteNumber(raw?.minOrderMeters, raw?.minYards, 3));
  const stockMeters = toFiniteNumber(raw?.stockMeters, raw?.stockYards, 0);
  return {
    ...(raw || {}),
    images: normalizeImageObjects(raw?.images),
    pricePerMeter,
    finalPrice: toFiniteNumber(raw?.finalPrice, pricePerMeter),
    sellerPrice: toFiniteNumber(raw?.sellerPrice, pricePerMeter),
    minOrderMeters,
    minYards: minOrderMeters,
    stockMeters,
    stockYards: stockMeters,
    materialTypeName: String(raw?.materialTypeName || raw?.materialType?.name || 'Material').trim() || 'Material',
    fabricCategoryName: String(raw?.fabricCategoryName || raw?.fabricCategory?.name || 'Fabric').trim() || 'Fabric',
  };
};

const normalizeDesignDetailPayload = (raw: any) => {
  const images = normalizeImageUrls(raw?.images);
  const basePrice = toFiniteNumber(raw?.finalPrice, raw?.basePrice, raw?.price);
  const designerProfileImage = resolveApiAssetUrl(
    raw?.designer?.profileImage || raw?.designer?.user?.avatar || raw?.designer?.avatar
  );
  const suitableFabrics = (Array.isArray(raw?.suitableFabrics) ? raw.suitableFabrics : []).map((entry: any) => {
    const fabricImages = normalizeImageUrls(entry?.fabric?.images);
    const fabricPricePerMeter = toFiniteNumber(
      entry?.fabric?.finalPrice,
      entry?.fabric?.listingUsdPrice,
      entry?.fabric?.sellerPrice,
      entry?.fabric?.pricePerMeter,
      entry?.fabric?.price
    );
    return {
      ...(entry || {}),
      minMeters: toFiniteNumber(entry?.minMeters, entry?.yardsNeeded, 1),
      maxMeters: toFiniteNumber(entry?.maxMeters, entry?.yardsNeeded, 1),
      fabric: {
        ...(entry?.fabric || {}),
        images: fabricImages,
        pricePerMeter: fabricPricePerMeter,
        finalPrice: toFiniteNumber(entry?.fabric?.finalPrice, fabricPricePerMeter),
        sellerPrice: toFiniteNumber(entry?.fabric?.sellerPrice, fabricPricePerMeter),
      },
    };
  });
  const measurements = (Array.isArray(raw?.measurementVariables) ? raw.measurementVariables : [])
    .map((entry: any) => ({
      name: String(entry?.name || '').trim(),
      description: String(entry?.instructions || entry?.description || '').trim(),
      unit: String(entry?.unit || 'cm').trim() || 'cm',
      isRequired: entry?.isRequired !== false,
    }))
    .filter((entry: any) => entry.name);

  return {
    ...(raw || {}),
    images,
    basePrice,
    finalPrice: toFiniteNumber(raw?.finalPrice, basePrice),
    designer: raw?.designer
      ? {
          ...raw.designer,
          profileImage: designerProfileImage || raw?.designer?.profileImage || '',
        }
      : raw?.designer,
    suitableFabrics,
    measurements,
  };
};

const normalizeReadyToWearDetailPayload = (raw: any) => {
  const designerProfileImage = resolveApiAssetUrl(
    raw?.designer?.profileImage || raw?.designer?.user?.avatar || raw?.designer?.avatar
  );
  const sizeVariations = (Array.isArray(raw?.sizeVariations) ? raw.sizeVariations : []).map((entry: any) => ({
    ...(entry || {}),
    price: toFiniteNumber(entry?.price, raw?.finalPrice, raw?.basePrice, raw?.price),
    stock: toFiniteNumber(entry?.stock, 0),
  }));
  const firstVariantPrice = toFiniteNumber(
    sizeVariations.find((entry: any) => toFiniteNumber(entry?.price, 0) > 0)?.price,
    0
  );
  const price = toFiniteNumber(raw?.finalPrice, raw?.price, raw?.basePrice, firstVariantPrice);
  return {
    ...(raw || {}),
    images: normalizeImageObjects(raw?.images),
    designer: raw?.designer
      ? {
          ...raw.designer,
          profileImage: designerProfileImage || raw?.designer?.profileImage || '',
        }
      : raw?.designer,
    sizeVariations,
    basePrice: toFiniteNumber(raw?.basePrice, raw?.finalPrice, firstVariantPrice, price),
    finalPrice: toFiniteNumber(raw?.finalPrice, price),
    price,
    materialTypeName: String(raw?.materialTypeName || raw?.materialType?.name || raw?.material || 'Material').trim() || 'Material',
    fabricCategoryName: String(raw?.fabricCategoryName || raw?.fabricCategory?.name || raw?.fabric || 'Fabric').trim() || 'Fabric',
    material: String(raw?.materialTypeName || raw?.materialType?.name || raw?.material || 'Material').trim() || 'Material',
    fabric: String(raw?.fabricCategoryName || raw?.fabricCategory?.name || raw?.fabric || 'Fabric').trim() || 'Fabric',
    inStock: sizeVariations.some((entry: any) => Number(entry?.stock || 0) > 0),
  };
};

const productsApi = {
  getCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/products/categories'),

  getMaterials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/products/materials'),

  getFabricCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/products/fabric-categories'),

  getFabrics: async (params?: {
    country?: string;
    materialTypeId?: string;
    fabricCategoryId?: string;
    color?: string;
    sellerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiService.get<{ success: boolean; data: { fabrics: any[]; pagination: any } }>('/products/fabrics', {
      params,
    });
    if (!response?.success) return response;
    const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
    return {
      ...response,
      data: {
        ...(response.data || {}),
        fabrics: rows.map((row: any) => ({
          ...row,
          images: normalizeImageObjects(row?.images),
        })),
      },
    };
  },

  getFabric: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`);
    if (!response?.success) return response;
    return {
      ...response,
      data: normalizeFabricDetailPayload(response.data),
    };
  },

  getFabricById: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`);
    if (!response?.success) return response;
    return {
      ...response,
      data: normalizeFabricDetailPayload(response.data),
    };
  },

  getDesigns: async (params?: {
    categoryId?: string;
    country?: string;
    materialTypeId?: string;
    size?: string;
    color?: string;
    designerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiService.get<{ success: boolean; data: { designs: any[]; pagination: any } }>('/products/designs', {
      params,
    });
    if (!response?.success) return response;
    const rows = Array.isArray(response.data?.designs) ? response.data.designs : [];
    return {
      ...response,
      data: {
        ...(response.data || {}),
        designs: rows.map((row: any) => ({
          ...row,
          images: normalizeImageObjects(row?.images),
        })),
      },
    };
  },

  getDesign: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`);
    if (!response?.success) return response;
    return {
      ...response,
      data: normalizeDesignDetailPayload(response.data),
    };
  },

  getDesignById: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`);
    if (!response?.success) return response;
    return {
      ...response,
      data: normalizeDesignDetailPayload(response.data),
    };
  },

  getReadyToWear: async (params?: {
    categoryId?: string;
    country?: string;
    material?: string;
    materialTypeId?: string;
    fabricCategoryId?: string;
    size?: string;
    color?: string;
    designerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    const response = await apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>(
      '/products/ready-to-wear',
      { params }
    );
    if (!response?.success) return response;
    const rows = Array.isArray(response.data?.products) ? response.data.products : [];
    return {
      ...response,
      data: {
        ...(response.data || {}),
        products: rows.map((row: any) => ({
          ...row,
          images: normalizeImageObjects(row?.images),
        })),
      },
    };
  },

  getReadyToWearProduct: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/ready-to-wear/${id}`);
    if (!response?.success) return response;
    return {
      ...response,
      data: normalizeReadyToWearDetailPayload(response.data),
    };
  },

  getReadyToWearSizeGuide: () =>
    apiService.get<{ success: boolean; data: { title: string; content: string } }>('/products/ready-to-wear-size-guide'),

  getCountries: () =>
    apiService.get<{ success: boolean; data: string[] }>('/products/countries'),

  getFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/products/featured'),

  getCategoryPageSettings: (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR') =>
    readPublicCategoryPageSettingsWithFallback<{
      success: boolean;
      data: {
        pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
        rowId?: string | null;
        source?: 'DEFAULT' | 'DATABASE';
        updatedAt?: string | null;
        settings: {
          bannerTitle: string;
          bannerSubtitle: string;
          bannerImage: string;
          designPreset: 'STANDARD' | 'EDITORIAL' | 'MINIMAL';
          bannerHeight: number;
          pageSize: number;
          columns: number;
          showPagination: boolean;
          featuredProductIds: string[];
          featuredSlots: Array<{ productId: string; isActive: boolean }>;
          rotatingProductIds: string[];
          rotatingColumns: number;
          rotatingRows: number;
          rotatingTitleSize: number;
          recommendationProductIds: string[];
          recommendationDisplayCount: number;
          recommendationConfiguredOnly: boolean;
          recommendationPreferSameCountry: boolean;
          recommendationPreferDifferentSeller: boolean;
        };
        featuredProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
        rotatingProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
      };
      message?: string;
    }>(pageType),

  getProductLikes: (productType: 'design' | 'fabric' | 'ready-to-wear', id: string) =>
    apiService.get<{ success: boolean; data: { count: number; likedByMe: boolean } }>(
      `/products/${productType}/${id}/likes`
    ),

  toggleProductLike: (productType: 'design' | 'fabric' | 'ready-to-wear', id: string) =>
    apiService.post<{ success: boolean; data: { count: number; likedByMe: boolean } }>(
      `/products/${productType}/${id}/likes/toggle`
    ),

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

  createProductReview: (
    productType: 'design' | 'fabric' | 'ready-to-wear',
    id: string,
    data: { rating: number; title?: string; comment: string }
  ) =>
    apiService.post<{ success: boolean; data: any }>(`/products/${productType}/${id}/reviews`, data),

  getDiscoverByCountry: (productType: 'design' | 'fabric' | 'ready-to-wear', id: string, limit = 12) =>
    apiService.get<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        image: string;
        priceUsd: number;
        country: string;
        ownerName: string;
        productType: 'DESIGN' | 'FABRIC' | 'READY_TO_WEAR';
      }>;
    }>(`/products/${productType}/${id}/discover`, { params: { limit } }),
};

const customDesignOrderCreatePaths = [
  '/orders/custom-design',
  '/order/custom-design',
  '/orders/design',
  '/order/design',
  '/orders/custom',
  '/order/custom',
  '/orders/custom-order',
  '/order/custom-order',
  '/customer/orders/custom-design',
  '/customer/order/custom-design',
];

const readyToWearOrderCreatePaths = [
  '/orders/ready-to-wear',
  '/order/ready-to-wear',
  '/orders/readytowear',
  '/order/readytowear',
  '/orders/ready-to-buy',
  '/order/ready-to-buy',
  '/orders/ready',
  '/order/ready',
  '/customer/orders/ready-to-wear',
  '/customer/order/ready-to-wear',
];

const fabricOnlyOrderCreatePaths = [
  '/orders/fabric-only',
  '/order/fabric-only',
  '/orders/fabric',
  '/order/fabric',
  '/orders/fabric-order',
  '/order/fabric-order',
  '/orders/fabric-only-order',
  '/order/fabric-only-order',
  '/customer/orders/fabric-only',
  '/customer/order/fabric-only',
];

async function createOrderWithFallback<T>(paths: string[], data: any) {
  let lastError: unknown = null;
  const attemptedPaths: string[] = [];
  for (const path of paths) {
    attemptedPaths.push(path);
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  const routeMessage = String((lastError as AxiosError)?.response?.data?.message || '').toLowerCase();
  if (isRetryableRouteError(lastError) || routeMessage.includes('route not found')) {
    throw new Error(`Order create route not found. Tried: ${attemptedPaths.join(', ')}`);
  }
  throw lastError ?? new Error('Order create route not found.');
}

const isRouteMissingCreateOrderError = (error: unknown) => {
  const responseMessage = String((error as AxiosError)?.response?.data?.message || '').toLowerCase();
  const message = String((error as Error)?.message || '').toLowerCase();
  return (
    isRetryableRouteError(error) ||
    responseMessage.includes('route not found') ||
    message.includes('route not found')
  );
};

async function probeOrderCreateRoute(paths: string[]) {
  try {
    await createOrderWithFallback(paths, {});
    return { available: true, message: '' };
  } catch (error) {
    if (isRouteMissingCreateOrderError(error)) {
      return { available: false, message: String((error as Error)?.message || 'Route not found') };
    }
    // Non-route errors (e.g. 400 validation) imply route exists.
    return {
      available: true,
      message: String((error as AxiosError)?.response?.data?.message || (error as Error)?.message || ''),
    };
  }
}

async function updateOrderStatusWithFallback<T>(
  orderId: string,
  status: string,
  extraPaths: string[] = []
) {
  const normalizedOrderId = String(orderId || '').trim();
  const normalizedStatus = String(status || '').trim().toUpperCase();
  const basePaths = [`/orders/${normalizedOrderId}/status`, `/order/${normalizedOrderId}/status`, ...extraPaths];
  let lastError: unknown = null;
  for (const path of basePaths) {
    try {
      return await apiService.patch<T>(path, { status: normalizedStatus });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Order status update route not found.');
}

// Orders API
const ordersApi = {
  getOrder: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/orders/${id}`),

  getOrderLimits: () =>
    apiService.get<{
      success: boolean;
      data: {
        maxReadyToWearUnitsPerOrder: number;
        maxCustomToWearItemsPerCheckout: number;
        maxSuitableFabricsPerDesign: number;
        minFabricYardsPerOrder: number;
        maxFabricYardsPerOrder: number;
      };
    }>('/orders/limits'),

  previewCheckoutPricing: (data: {
    country?: string;
    segments: Array<{ productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; subtotalUsd: number }>;
  }) =>
    apiService.post<{
      success: boolean;
      data: {
        label: string;
        baseSubtotalUsd: number;
        totalAdjustmentUsd: number;
        finalSubtotalUsd: number;
        appliedRules: Array<{
          ruleId: string;
          ruleName: string;
          adjustmentType: string;
          value: number;
          amountUsd: number;
          occurrences: number;
        }>;
      };
    }>('/orders/checkout-pricing/preview', data),

  getOrderTicketThread: (orderId: string) =>
    apiService.get<{
      success: boolean;
      data: {
        orderId: string;
        orderNumber: string;
        ticket: {
          id: string;
          orderId: string;
          subject?: string | null;
          status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
          createdById: string;
          isLocked: boolean;
          assignedToUserId?: string | null;
          assignedToRole?: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR' | null;
          dueAt?: string | null;
          escalatedAt?: string | null;
          escalationStatus?: string;
          lastMessageAt?: string | null;
          createdAt: string;
          updatedAt: string;
        } | null;
        messages: Array<{
          id: string;
          ticketId: string;
          orderId: string;
          senderUserId: string;
          senderRole: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
          senderDisplayName: string;
          body: string;
          originalBody?: string;
          sourceLanguage?: string;
          translated?: boolean;
          translatedToLanguage?: string;
          translationStatus?: string;
          recipientRoles: Array<'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR'>;
          attachments?: string[];
          visibleToCustomer: boolean;
          isInternal: boolean;
          createdAt: string;
        }>;
        participants: Array<{
          role: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
          label: string;
          users: Array<{ id: string; name: string }>;
        }>;
        permissions: {
          canPost: boolean;
          canManageTicket: boolean;
          canControlCustomerVisibility: boolean;
          allowedRecipientRoles: Array<'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR'>;
        };
        settings: {
          enabled: boolean;
          defaultVisibleToCustomer: boolean;
          allowVendorToVendorDirect: boolean;
          autoAssignEnabled?: boolean;
          autoAssignRole?: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
          slaResponseHours?: number;
          escalationRole?: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
          escalationNotifyRoles?: Array<'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR'>;
        };
        language?: {
          viewerPreferredLanguage: string;
          translationEnabled: boolean;
          defaultLanguage: string;
          supportedLanguages: Array<{ code: string; label: string }>;
        };
      };
    }>(`/orders/${orderId}/ticketing`),

  sendOrderTicketMessage: (
    orderId: string,
    data: {
      body: string;
      recipientRoles?: Array<'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR'>;
      attachments?: string[];
      visibleToCustomer?: boolean;
      subject?: string;
      sourceLanguage?: string;
    }
  ) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(`/orders/${orderId}/ticketing/messages`, data),

  getTicketingLanguagePreference: () =>
    apiService.get<{
      success: boolean;
      data: {
        language: string;
        translationEnabled: boolean;
        defaultLanguage: string;
        supportedLanguages: Array<{ code: string; label: string }>;
      };
    }>('/orders/ticketing/language-preference'),

  updateTicketingLanguagePreference: (data: { language: string }) =>
    apiService.put<{
      success: boolean;
      data: {
        language: string;
        translationEnabled: boolean;
        defaultLanguage: string;
        supportedLanguages: Array<{ code: string; label: string }>;
      };
      message?: string;
    }>('/orders/ticketing/language-preference', data),

  updateOrderTicketStatus: (orderId: string, status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(`/orders/${orderId}/ticketing/status`, { status }),

  listAdminTickets: (params?: {
    search?: string;
    status?: string;
    assignedRole?: string;
    escalated?: boolean;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{ success: boolean; data: any[]; pagination?: any }>('/orders/admin/tickets', { params }),

  assignAdminTicket: (
    ticketId: string,
    data: { assignedToRole?: string; assignedToUserId?: string; dueAt?: string }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/orders/admin/tickets/${ticketId}/assign`, data),

  createOrder: (data: any) =>
    createOrderWithFallback<{ success: boolean; data: any }>(customDesignOrderCreatePaths, data),

  createCustomDesignOrder: (data: any) =>
    createOrderWithFallback<{ success: boolean; data: any }>(customDesignOrderCreatePaths, data),

  createReadyToWearOrder: (data: any) =>
    createOrderWithFallback<{ success: boolean; data: any }>(readyToWearOrderCreatePaths, data),

  createFabricOnlyOrder: (data: any) =>
    createOrderWithFallback<{ success: boolean; data: any }>(fabricOnlyOrderCreatePaths, data),

  probeCustomDesignCreateRoute: () => probeOrderCreateRoute(customDesignOrderCreatePaths),
  probeReadyToWearCreateRoute: () => probeOrderCreateRoute(readyToWearOrderCreatePaths),
  probeFabricOnlyCreateRoute: () => probeOrderCreateRoute(fabricOnlyOrderCreatePaths),

  updateStatus: (id: string, status: string, notes?: string) =>
    apiService.patch(`/orders/${id}/status`, { status, notes }),

  addTracking: (id: string, trackingNumber: string) =>
    apiService.patch(`/orders/${id}/tracking`, { trackingNumber }),
};

const customerTryOnSummaryPaths = [
  '/customer/try-on/summary',
  '/customer/tryon/summary',
  '/customer/3d-try-on/summary',
  '/customer/3d-tryon/summary',
];
const customerTryOnCatalogPaths = [
  '/customer/try-on/catalog',
  '/customer/tryon/catalog',
  '/customer/3d-try-on/catalog',
  '/customer/3d-tryon/catalog',
];
const customerTryOnBatchPaths = [
  '/customer/try-on/batch',
  '/customer/tryon/batch',
  '/customer/3d-try-on/batch',
  '/customer/3d-tryon/batch',
];
const customerTryOnPurchaseSessionPaths = [
  '/customer/try-on/purchase/session',
  '/customer/tryon/purchase/session',
  '/customer/3d-try-on/purchase/session',
  '/customer/3d-tryon/purchase/session',
];
const customerTryOnPurchaseCompletePaths = [
  '/customer/try-on/purchase',
  '/customer/try-on/purchase/complete',
  '/customer/tryon/purchase',
  '/customer/tryon/purchase/complete',
  '/customer/3d-try-on/purchase',
  '/customer/3d-try-on/purchase/complete',
  '/customer/3d-tryon/purchase',
  '/customer/3d-tryon/purchase/complete',
];

const TRY_ON_SETTINGS_FALLBACK_KEY = 'af_try_on_settings_fallback_v1';
const TRY_ON_SETTINGS_FALLBACK_DEFAULTS = {
  enabled: true,
  freeTryOnsPerCustomer: 5,
  additionalTryOnBundleSize: 5,
  additionalTryOnBundlePriceUsd: 1,
  maxProductsPerBatch: 5,
  requiredMeasurementFields: ['height', 'bust', 'waist', 'hips', 'shoulder'],
  chargeNoticeText:
    'First 5 TryON runs are free. Additional bundles are paid and controlled by admin pricing settings.',
  applyLocations: {
    customerDashboard: true,
    adminDashboard: true,
    sellerDashboard: true,
    designerDashboard: true,
    qaDashboard: true,
    designProductPage: true,
    readyToWearProductPage: true,
  },
  apiProviders: [] as Array<any>,
};

const normalizeTryOnSettingsFallback = (input: unknown) => {
  const row = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const applyLocationsRow =
    row.applyLocations && typeof row.applyLocations === 'object'
      ? (row.applyLocations as Record<string, unknown>)
      : {};
  const requiredMeasurementFields = Array.isArray(row.requiredMeasurementFields)
    ? Array.from(
        new Set(
          row.requiredMeasurementFields
            .map((entry) => String(entry || '').trim().toLowerCase())
            .filter(Boolean)
        )
      )
    : [...TRY_ON_SETTINGS_FALLBACK_DEFAULTS.requiredMeasurementFields];
  return {
    enabled: row.enabled !== false,
    freeTryOnsPerCustomer: Math.max(0, Number(row.freeTryOnsPerCustomer || TRY_ON_SETTINGS_FALLBACK_DEFAULTS.freeTryOnsPerCustomer)),
    additionalTryOnBundleSize: Math.max(
      1,
      Number(row.additionalTryOnBundleSize || TRY_ON_SETTINGS_FALLBACK_DEFAULTS.additionalTryOnBundleSize)
    ),
    additionalTryOnBundlePriceUsd: Math.max(
      0,
      Number(row.additionalTryOnBundlePriceUsd || TRY_ON_SETTINGS_FALLBACK_DEFAULTS.additionalTryOnBundlePriceUsd)
    ),
    maxProductsPerBatch: Math.max(1, Number(row.maxProductsPerBatch || TRY_ON_SETTINGS_FALLBACK_DEFAULTS.maxProductsPerBatch)),
    requiredMeasurementFields:
      requiredMeasurementFields.length > 0
        ? requiredMeasurementFields
        : [...TRY_ON_SETTINGS_FALLBACK_DEFAULTS.requiredMeasurementFields],
    chargeNoticeText:
      String(row.chargeNoticeText || '').trim() || TRY_ON_SETTINGS_FALLBACK_DEFAULTS.chargeNoticeText,
    applyLocations: {
      customerDashboard:
        typeof applyLocationsRow.customerDashboard === 'boolean'
          ? applyLocationsRow.customerDashboard
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.customerDashboard,
      adminDashboard:
        typeof applyLocationsRow.adminDashboard === 'boolean'
          ? applyLocationsRow.adminDashboard
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.adminDashboard,
      sellerDashboard:
        typeof applyLocationsRow.sellerDashboard === 'boolean'
          ? applyLocationsRow.sellerDashboard
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.sellerDashboard,
      designerDashboard:
        typeof applyLocationsRow.designerDashboard === 'boolean'
          ? applyLocationsRow.designerDashboard
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.designerDashboard,
      qaDashboard:
        typeof applyLocationsRow.qaDashboard === 'boolean'
          ? applyLocationsRow.qaDashboard
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.qaDashboard,
      designProductPage:
        typeof applyLocationsRow.designProductPage === 'boolean'
          ? applyLocationsRow.designProductPage
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.designProductPage,
      readyToWearProductPage:
        typeof applyLocationsRow.readyToWearProductPage === 'boolean'
          ? applyLocationsRow.readyToWearProductPage
          : TRY_ON_SETTINGS_FALLBACK_DEFAULTS.applyLocations.readyToWearProductPage,
    },
    apiProviders: Array.isArray(row.apiProviders) ? row.apiProviders : [],
  };
};

const readTryOnSettingsFallback = () => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return normalizeTryOnSettingsFallback(TRY_ON_SETTINGS_FALLBACK_DEFAULTS);
  }
  try {
    const raw = window.localStorage.getItem(TRY_ON_SETTINGS_FALLBACK_KEY);
    if (!raw) return normalizeTryOnSettingsFallback(TRY_ON_SETTINGS_FALLBACK_DEFAULTS);
    return normalizeTryOnSettingsFallback(JSON.parse(raw));
  } catch {
    return normalizeTryOnSettingsFallback(TRY_ON_SETTINGS_FALLBACK_DEFAULTS);
  }
};

const writeTryOnSettingsFallback = (settings: unknown) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      TRY_ON_SETTINGS_FALLBACK_KEY,
      JSON.stringify(normalizeTryOnSettingsFallback(settings))
    );
  } catch {
    // ignore localStorage write failures
  }
};

async function readCustomerTryOnSummaryWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of customerTryOnSummaryPaths) {
    try {
      return await apiService.get<T>(path, noCacheRequestConfig());
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!lastError || isRetryableRouteError(lastError)) {
    const settings = readTryOnSettingsFallback();
    return {
      success: true,
      data: {
        settings,
        usage: {
          freeUsedCount: 0,
          freeRemaining: Math.max(0, Number(settings.freeTryOnsPerCustomer || 0)),
          paidCreditsRemaining: 0,
          totalRuns: 0,
          purchaseCount: 0,
        },
        measurements: {},
        recent: [],
      },
      message: 'Using fallback TryON settings while backend routes are unavailable.',
    } as T;
  }
  throw lastError;
}

async function readCustomerTryOnCatalogWithFallback<T>(params?: {
  search?: string;
  productType?: 'ALL' | 'DESIGN' | 'READY_TO_WEAR';
  page?: number;
  limit?: number;
}) {
  let lastError: unknown = null;
  for (const path of customerTryOnCatalogPaths) {
    try {
      return await apiService.get<T>(path, { params });
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (!lastError || isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: [],
      pagination: {
        page: Math.max(1, Number(params?.page || 1)),
        limit: Math.max(1, Number(params?.limit || 24)),
        total: 0,
        pages: 1,
      },
      message: 'TryON catalog fallback in use while backend routes are unavailable.',
    } as T;
  }
  throw lastError;
}

async function runCustomerTryOnBatchWithFallback<T>(payload: {
  measurements: Record<string, number>;
  selectedProducts: Array<{ productType: 'DESIGN' | 'READY_TO_WEAR'; productId: string }>;
}) {
  let lastError: unknown = null;
  for (const path of customerTryOnBatchPaths) {
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Customer TryON batch route not found.');
}

async function createCustomerTryOnPurchaseSessionWithFallback<T>(payload: {
  bundles: number;
  providerKey: string;
  returnUrl?: string;
  cancelUrl?: string;
}) {
  let lastError: unknown = null;
  for (const path of customerTryOnPurchaseSessionPaths) {
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Customer TryON purchase-session route not found.');
}

async function completeCustomerTryOnPurchaseWithFallback<T>(payload: {
  purchaseId: string;
  providerKey: string;
  reference: string;
  payerId?: string;
}) {
  let lastError: unknown = null;
  for (const path of customerTryOnPurchaseCompletePaths) {
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  throw lastError ?? new Error('Customer TryON purchase-complete route not found.');
}

const CUSTOMER_ADDRESSES_FALLBACK_KEY = 'af_customer_addresses_fallback_v1';

type CustomerAddressFallbackRow = {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  postalCode?: string;
  isDefault: boolean;
};

const normalizeCustomerAddressFallbackRow = (input: any): CustomerAddressFallbackRow | null => {
  const id = String(input?.id || '').trim();
  if (!id) return null;
  return {
    id,
    label: String(input?.label || '').trim(),
    fullName: String(input?.fullName || '').trim(),
    phone: String(input?.phone || '').trim(),
    country: String(input?.country || '').trim(),
    city: String(input?.city || '').trim(),
    address: String(input?.address || '').trim(),
    postalCode: input?.postalCode ? String(input.postalCode).trim() : undefined,
    isDefault: input?.isDefault === true,
  };
};

const readCustomerAddressesFallback = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [] as CustomerAddressFallbackRow[];
  try {
    const raw = window.localStorage.getItem(CUSTOMER_ADDRESSES_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizeCustomerAddressFallbackRow(entry))
      .filter((entry): entry is CustomerAddressFallbackRow => Boolean(entry));
  } catch {
    return [];
  }
};

const writeCustomerAddressesFallback = (rows: CustomerAddressFallbackRow[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(CUSTOMER_ADDRESSES_FALLBACK_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // ignore localStorage write failures
  }
};

const upsertCustomerAddressFallback = (rows: CustomerAddressFallbackRow[], row: CustomerAddressFallbackRow) => {
  const next = [...rows];
  const index = next.findIndex((entry) => entry.id === row.id);
  if (index >= 0) {
    next[index] = { ...next[index], ...row };
  } else {
    next.unshift(row);
  }
  if (row.isDefault) {
    return next.map((entry) => (entry.id === row.id ? entry : { ...entry, isDefault: false }));
  }
  return next;
};

const normalizeCustomerAddressesFromResponse = (response: any) => {
  const rows = Array.isArray(response?.data)
    ? response.data
    : Array.isArray(response?.data?.addresses)
      ? response.data.addresses
      : [];
  return rows
    .map((entry: any) => normalizeCustomerAddressFallbackRow(entry))
    .filter((entry: CustomerAddressFallbackRow | null): entry is CustomerAddressFallbackRow => Boolean(entry));
};

const isNetworkLikeError = (error: unknown) => {
  const code = String((error as AxiosError)?.code || '').toUpperCase();
  const status = (error as AxiosError)?.response?.status;
  const message = String((error as AxiosError)?.message || '').toLowerCase();
  return !status && (code === 'ERR_NETWORK' || message.includes('network error') || message.includes('failed to fetch'));
};

async function readCustomerAddressesWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of ['/customer/addresses', '/customer/addresses/list', '/customer/address']) {
    try {
      const response = await apiService.get<any>(path, noCacheRequestConfig());
      const rows = normalizeCustomerAddressesFromResponse(response);
      if (rows.length > 0) {
        writeCustomerAddressesFallback(rows);
      }
      if (rows.length === 0) {
        const fallbackRows = readCustomerAddressesFallback();
        if (fallbackRows.length > 0) {
          return {
            ...(response || {}),
            success: true,
            data: fallbackRows,
            message: 'Loaded saved addresses from local cache while backend returned empty results.',
          } as T;
        }
      }
      return {
        ...(response || {}),
        success: response?.success !== false,
        data: rows,
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error) || isNetworkLikeError(error)) continue;
      throw error;
    }
  }
  const fallbackRows = readCustomerAddressesFallback();
  if (fallbackRows.length > 0 && (isRetryableRouteError(lastError) || isNetworkLikeError(lastError))) {
    return {
      success: true,
      data: fallbackRows,
      message: 'Loaded saved addresses from local cache while backend address routes are unavailable.',
    } as T;
  }
  throw lastError ?? new Error('Customer addresses route not found.');
}

async function createCustomerAddressWithFallback<T>(data: any) {
  let lastError: unknown = null;
  for (const path of ['/customer/addresses', '/customer/address']) {
    try {
      const response = await apiService.post<any>(path, data);
      const normalized = normalizeCustomerAddressFallbackRow(response?.data);
      if (normalized) {
        writeCustomerAddressesFallback(upsertCustomerAddressFallback(readCustomerAddressesFallback(), normalized));
      }
      return response as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error) || isNetworkLikeError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError) || isNetworkLikeError(lastError)) {
    const rows = readCustomerAddressesFallback();
    const generatedId = `local-address-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const localRow = normalizeCustomerAddressFallbackRow({
      ...data,
      id: generatedId,
      isDefault: Boolean(data?.isDefault),
    });
    if (!localRow) throw lastError ?? new Error('Customer add-address route not found.');
    writeCustomerAddressesFallback(upsertCustomerAddressFallback(rows, localRow));
    return {
      success: true,
      data: localRow,
      message: 'Address saved locally while backend address route is unavailable.',
    } as T;
  }
  throw lastError ?? new Error('Customer add-address route not found.');
}

async function updateCustomerAddressWithFallback<T>(id: string, data: any) {
  let lastError: unknown = null;
  for (const path of [`/customer/addresses/${id}`, `/customer/address/${id}`]) {
    try {
      const response = await apiService.patch<any>(path, data);
      const normalized = normalizeCustomerAddressFallbackRow(response?.data || { ...data, id });
      if (normalized) {
        writeCustomerAddressesFallback(upsertCustomerAddressFallback(readCustomerAddressesFallback(), normalized));
      }
      return response as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error) || isNetworkLikeError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError) || isNetworkLikeError(lastError)) {
    const rows = readCustomerAddressesFallback();
    const existing = rows.find((entry) => entry.id === String(id));
    if (!existing) throw lastError ?? new Error('Customer update-address route not found.');
    const localRow = normalizeCustomerAddressFallbackRow({
      ...existing,
      ...data,
      id: String(id),
    });
    if (!localRow) throw lastError ?? new Error('Customer update-address route not found.');
    writeCustomerAddressesFallback(upsertCustomerAddressFallback(rows, localRow));
    return {
      success: true,
      data: localRow,
      message: 'Address update saved locally while backend address route is unavailable.',
    } as T;
  }
  throw lastError ?? new Error('Customer update-address route not found.');
}

async function deleteCustomerAddressWithFallback<T>(id: string) {
  let lastError: unknown = null;
  for (const path of [`/customer/addresses/${id}`, `/customer/address/${id}`]) {
    try {
      const response = await apiService.delete<T>(path);
      const rows = readCustomerAddressesFallback().filter((entry) => entry.id !== String(id));
      writeCustomerAddressesFallback(rows);
      return response;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error) || isNetworkLikeError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError) || isNetworkLikeError(lastError)) {
    const rows = readCustomerAddressesFallback().filter((entry) => entry.id !== String(id));
    writeCustomerAddressesFallback(rows);
    return {
      success: true,
      message: 'Address deleted locally while backend address route is unavailable.',
    } as T;
  }
  throw lastError ?? new Error('Customer delete-address route not found.');
}

// Customer API
const customerApi = {
  getProfile: () =>
    apiService.get<{ success: boolean; data: any }>('/customer/profile'),

  getAddresses: () =>
    readCustomerAddressesWithFallback<{ success: boolean; data: any[] }>(),

  addAddress: (data: any) =>
    createCustomerAddressWithFallback<{ success: boolean; data: any }>(data),

  updateAddress: (id: string, data: any) =>
    updateCustomerAddressWithFallback<{ success: boolean; data: any }>(id, data),

  deleteAddress: (id: string) =>
    deleteCustomerAddressWithFallback(id),

  saveMeasurements: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/customer/measurements', data),

  getTryOnSummary: () =>
    readCustomerTryOnSummaryWithFallback<{ success: boolean; data: any }>(),

  getTryOnCatalog: (params?: { search?: string; productType?: 'ALL' | 'DESIGN' | 'READY_TO_WEAR'; page?: number; limit?: number }) =>
    readCustomerTryOnCatalogWithFallback<{ success: boolean; data: any[]; pagination?: any }>(params),

  runTryOnBatch: (payload: {
    measurements: Record<string, number>;
    selectedProducts: Array<{ productType: 'DESIGN' | 'READY_TO_WEAR'; productId: string }>;
  }) => runCustomerTryOnBatchWithFallback<{ success: boolean; data?: any; requiresPayment?: boolean; message?: string }>(payload),

  createTryOnPurchaseSession: (payload: {
    bundles: number;
    providerKey: string;
    returnUrl?: string;
    cancelUrl?: string;
  }) => createCustomerTryOnPurchaseSessionWithFallback<{ success: boolean; data?: any; message?: string }>(payload),

  completeTryOnPurchase: (payload: { purchaseId: string; providerKey: string; reference: string; payerId?: string }) =>
    completeCustomerTryOnPurchaseWithFallback<{ success: boolean; data?: any; message?: string }>(payload),

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
const adminCreateMinimalVendorPaths = [
  '/admin/vendor-profiles/create-minimal',
  '/admin/vendor-profile/create-minimal',
  '/admin/vendors/create-minimal',
];
const PROMO_CODES_FALLBACK_KEY = 'af_admin_promo_codes_fallback_v1';
const adminPromoCodesReadPaths = ['/promotions/admin', '/promo/admin', '/admin/promotions', '/admin/promo-codes'];
const adminPromoCodesCreatePaths = ['/promotions/admin', '/promo/admin', '/admin/promotions', '/admin/promo-codes'];
const adminPromoCodesUpdatePaths = (id: string) => [
  `/promotions/admin/${id}`,
  `/promo/admin/${id}`,
  `/admin/promotions/${id}`,
  `/admin/promo-codes/${id}`,
];
const adminPromoCodesDeletePaths = (id: string) => [
  `/promotions/admin/${id}`,
  `/promo/admin/${id}`,
  `/admin/promotions/${id}`,
  `/admin/promo-codes/${id}`,
];
const promoPreviewPaths = [
  '/promotions/preview',
  '/promo/preview',
  '/promo-codes/preview',
];

type PromoCriteriaFallback = {
  productTypes?: string[];
  productIds?: string[];
  countries?: string[];
  cities?: string[];
  materialTypeIds?: string[];
  designerIds?: string[];
  sellerIds?: string[];
  paymentProviders?: string[];
  shippingProviders?: string[];
  cardPatterns?: string[];
  shippingQuoteIds?: string[];
};

type PromoCodeFallbackRow = {
  id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  maxDiscountUsd?: number;
  minOrderUsd?: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
  criteria: PromoCriteriaFallback;
};

const toPromoList = (value: unknown, toUpper = false) =>
  Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .map((entry) => (toUpper ? entry.toUpperCase() : entry))
    )
  );

const normalizePromoFallbackRow = (input: any): PromoCodeFallbackRow | null => {
  const code = String(input?.code || '').trim().toUpperCase();
  if (!code) return null;
  const discountType = String(input?.discountType || '').toUpperCase() === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  const discountValue = Number(input?.discountValue || 0);
  if (!Number.isFinite(discountValue) || discountValue <= 0) return null;
  return {
    id: String(input?.id || `local-promo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
    code,
    name: String(input?.name || code).trim() || code,
    description: String(input?.description || '').trim() || undefined,
    discountType,
    discountValue,
    maxDiscountUsd:
      input?.maxDiscountUsd === undefined || input?.maxDiscountUsd === null
        ? undefined
        : Number(input.maxDiscountUsd),
    minOrderUsd:
      input?.minOrderUsd === undefined || input?.minOrderUsd === null
        ? undefined
        : Number(input.minOrderUsd),
    isActive: input?.isActive !== false,
    startsAt: input?.startsAt ? String(input.startsAt) : undefined,
    endsAt: input?.endsAt ? String(input.endsAt) : undefined,
    criteria: {
      productTypes: toPromoList(input?.criteria?.productTypes, true),
      productIds: toPromoList(input?.criteria?.productIds),
      countries: toPromoList(input?.criteria?.countries),
      cities: toPromoList(input?.criteria?.cities),
      materialTypeIds: toPromoList(input?.criteria?.materialTypeIds),
      designerIds: toPromoList(input?.criteria?.designerIds),
      sellerIds: toPromoList(input?.criteria?.sellerIds),
      paymentProviders: toPromoList(input?.criteria?.paymentProviders, true),
      shippingProviders: toPromoList(input?.criteria?.shippingProviders, true),
      cardPatterns: toPromoList(input?.criteria?.cardPatterns),
      shippingQuoteIds: toPromoList(input?.criteria?.shippingQuoteIds),
    },
  };
};

const readPromoCodesFallback = () => {
  if (typeof window === 'undefined' || !window.localStorage) return [] as PromoCodeFallbackRow[];
  try {
    const raw = window.localStorage.getItem(PROMO_CODES_FALLBACK_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => normalizePromoFallbackRow(entry))
      .filter((entry): entry is PromoCodeFallbackRow => Boolean(entry));
  } catch {
    return [];
  }
};

const writePromoCodesFallback = (rows: PromoCodeFallbackRow[]) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PROMO_CODES_FALLBACK_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
  } catch {
    // ignore storage write failures
  }
};

const upsertPromoCodesFallback = (rows: PromoCodeFallbackRow[], row: PromoCodeFallbackRow) => {
  const next = [...rows];
  const byIdIndex = next.findIndex((entry) => entry.id === row.id);
  const byCodeIndex = next.findIndex((entry) => entry.code === row.code);
  const targetIndex = byIdIndex >= 0 ? byIdIndex : byCodeIndex;
  if (targetIndex >= 0) {
    next[targetIndex] = { ...next[targetIndex], ...row };
  } else {
    next.unshift(row);
  }
  return next;
};

async function readAdminPromoCodesWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of adminPromoCodesReadPaths) {
    try {
      const response = await apiService.get<{ success: boolean; data: any[]; message?: string }>(path);
      const rows = Array.isArray(response?.data)
        ? response.data.map((entry) => normalizePromoFallbackRow(entry)).filter((entry): entry is PromoCodeFallbackRow => Boolean(entry))
        : [];
      writePromoCodesFallback(rows);
      return response as unknown as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return {
      success: true,
      data: readPromoCodesFallback(),
      message: 'Promo routes not found on this backend deployment. Using local fallback.',
    } as T;
  }
  throw lastError ?? new Error('Promo codes route not found.');
}

async function createAdminPromoCodeWithFallback<T>(payload: any) {
  let lastError: unknown = null;
  for (const path of adminPromoCodesCreatePaths) {
    try {
      const response = await apiService.post<{ success: boolean; data: any; message?: string }>(path, payload);
      const normalized = normalizePromoFallbackRow(response?.data || payload);
      if (normalized) {
        const current = readPromoCodesFallback();
        writePromoCodesFallback(upsertPromoCodesFallback(current, normalized));
      }
      return response as unknown as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const fallbackRow = normalizePromoFallbackRow(payload);
    if (!fallbackRow) throw new Error('Invalid promo code payload.');
    const rows = readPromoCodesFallback();
    writePromoCodesFallback(upsertPromoCodesFallback(rows, fallbackRow));
    return {
      success: true,
      data: fallbackRow,
      message: 'Promo saved locally until backend promo routes are deployed.',
    } as T;
  }
  throw lastError ?? new Error('Promo code create route not found.');
}

async function updateAdminPromoCodeWithFallback<T>(id: string, payload: any) {
  let lastError: unknown = null;
  for (const path of adminPromoCodesUpdatePaths(id)) {
    try {
      const response = await apiService.patch<{ success: boolean; data: any; message?: string }>(path, payload);
      const normalized = normalizePromoFallbackRow(response?.data || { ...payload, id });
      if (normalized) {
        const rows = readPromoCodesFallback();
        writePromoCodesFallback(upsertPromoCodesFallback(rows, normalized));
      }
      return response as unknown as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const currentRows = readPromoCodesFallback();
    const existing = currentRows.find((entry) => entry.id === id);
    if (!existing) {
      throw new Error('Promo code not found in local fallback.');
    }
    const merged = normalizePromoFallbackRow({ ...existing, ...payload, id });
    if (!merged) throw new Error('Invalid promo code payload.');
    writePromoCodesFallback(upsertPromoCodesFallback(currentRows, merged));
    return {
      success: true,
      data: merged,
      message: 'Promo updated locally until backend promo routes are deployed.',
    } as T;
  }
  throw lastError ?? new Error('Promo code update route not found.');
}

async function deleteAdminPromoCodeWithFallback<T>(id: string) {
  let lastError: unknown = null;
  for (const path of adminPromoCodesDeletePaths(id)) {
    try {
      const response = await apiService.delete<{ success: boolean; message?: string }>(path);
      const rows = readPromoCodesFallback().filter((entry) => entry.id !== id);
      writePromoCodesFallback(rows);
      return response as unknown as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    const rows = readPromoCodesFallback().filter((entry) => entry.id !== id);
    writePromoCodesFallback(rows);
    return {
      success: true,
      message: 'Promo deleted locally until backend promo routes are deployed.',
    } as T;
  }
  throw lastError ?? new Error('Promo code delete route not found.');
}

const listContains = (list: string[] | undefined, value: string, toUpper = false) => {
  if (!Array.isArray(list) || list.length === 0) return true;
  const normalizedValue = toUpper ? String(value || '').toUpperCase() : String(value || '');
  const normalizedList = toUpper ? list.map((entry) => String(entry || '').toUpperCase()) : list;
  return normalizedList.includes(normalizedValue);
};

function buildPromoPreviewFromFallback(payload: {
  code: string;
  items: Array<{ productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productId: string; unitPrice: number; quantity: number }>;
  paymentProvider?: string;
  shippingProvider?: string;
  shippingQuoteId?: string;
  cardFingerprint?: string;
  country?: string;
  city?: string;
}) {
  const code = String(payload.code || '').trim().toUpperCase();
  const rows = readPromoCodesFallback();
  const promo = rows.find((entry) => entry.code === code && entry.isActive);
  if (!promo) {
    throw new Error('Promo code not found or inactive.');
  }
  const now = Date.now();
  if (promo.startsAt && now < new Date(promo.startsAt).getTime()) {
    throw new Error('Promo code is not active yet.');
  }
  if (promo.endsAt && now > new Date(promo.endsAt).getTime()) {
    throw new Error('Promo code has expired.');
  }
  const criteria = promo.criteria || {};
  if (
    (criteria.materialTypeIds?.length || 0) > 0 ||
    (criteria.designerIds?.length || 0) > 0 ||
    (criteria.sellerIds?.length || 0) > 0 ||
    (criteria.shippingQuoteIds?.length || 0) > 0
  ) {
    throw new Error('Promo criteria requires backend validation. Please deploy latest API routes.');
  }
  if (!listContains(criteria.countries, payload.country || '')) {
    throw new Error('Promo code does not match selected country.');
  }
  if (!listContains(criteria.cities, payload.city || '')) {
    throw new Error('Promo code does not match selected city.');
  }
  if (!listContains(criteria.paymentProviders, payload.paymentProvider || '', true)) {
    throw new Error('Promo code does not match selected payment option.');
  }
  if (!listContains(criteria.shippingProviders, payload.shippingProvider || '', true)) {
    throw new Error('Promo code does not match selected shipping option.');
  }
  if (Array.isArray(criteria.cardPatterns) && criteria.cardPatterns.length > 0) {
    const card = String(payload.cardFingerprint || '');
    if (!criteria.cardPatterns.some((pattern) => card.startsWith(String(pattern || '')))) {
      throw new Error('Promo code does not match card criteria.');
    }
  }
  const eligibleItems = payload.items.filter((item) => {
    if (!listContains(criteria.productTypes, item.productType, true)) return false;
    if (!listContains(criteria.productIds, item.productId)) return false;
    return true;
  });
  const subtotal = payload.items.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );
  const eligibleSubtotal = eligibleItems.reduce(
    (sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0),
    0
  );
  if (Number(promo.minOrderUsd || 0) > subtotal) {
    throw new Error(`Promo requires minimum order value of $${Number(promo.minOrderUsd).toFixed(2)}.`);
  }
  if (eligibleSubtotal <= 0) {
    throw new Error('Promo code does not match selected products/criteria.');
  }
  const rawDiscount =
    promo.discountType === 'PERCENTAGE'
      ? (eligibleSubtotal * Number(promo.discountValue || 0)) / 100
      : Number(promo.discountValue || 0);
  const cappedDiscount = Number.isFinite(Number(promo.maxDiscountUsd))
    ? Math.min(rawDiscount, Number(promo.maxDiscountUsd || 0))
    : rawDiscount;
  const discountUsd = Math.max(0, Math.min(eligibleSubtotal, Number(cappedDiscount || 0)));
  return {
    success: true,
    data: {
      code: promo.code,
      name: promo.name,
      discountType: promo.discountType,
      discountValue: Number(promo.discountValue || 0),
      discountUsd: Number(discountUsd.toFixed(2)),
      subtotalUsd: Number(subtotal.toFixed(2)),
      eligibleSubtotalUsd: Number(eligibleSubtotal.toFixed(2)),
      matchedItems: eligibleItems.map((item) => ({
        productType: item.productType,
        productId: item.productId,
      })),
    },
    message: 'Promo preview computed locally because promotions routes are unavailable.',
  };
}

const isPromoNotFoundOrInactiveError = (error: unknown) => {
  const status = (error as AxiosError)?.response?.status;
  const responseMessage = String((error as AxiosError)?.response?.data?.message || '').toLowerCase();
  const errorMessage = String((error as Error)?.message || '').toLowerCase();
  const isRouteMissing =
    responseMessage.includes('route not found') ||
    errorMessage.includes('route not found') ||
    responseMessage.includes('cannot') && responseMessage.includes('post') && responseMessage.includes('/promo') ||
    errorMessage.includes('cannot') && errorMessage.includes('post') && errorMessage.includes('/promo');
  return (
    (status === 404 && !isRouteMissing && (responseMessage.includes('promo') || errorMessage.includes('promo'))) ||
    responseMessage.includes('promo code not found') ||
    responseMessage.includes('promo code not found or inactive') ||
    responseMessage.includes('inactive') ||
    errorMessage.includes('promo code not found') ||
    errorMessage.includes('promo code not found or inactive')
  );
};

async function previewPromotionWithFallback<T>(payload: {
  code: string;
  items: Array<{ productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productId: string; unitPrice: number; quantity: number }>;
  paymentProvider?: string;
  shippingProvider?: string;
  shippingQuoteId?: string;
  cardFingerprint?: string;
  country?: string;
  city?: string;
}) {
  let lastError: unknown = null;
  for (let index = 0; index < promoPreviewPaths.length; index += 1) {
    const path = promoPreviewPaths[index];
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      // If backend confirms promo code is invalid/inactive on any reachable promo endpoint, stop immediately.
      if (isPromoNotFoundOrInactiveError(error)) {
        throw new Error('Promo code not found or inactive.');
      }
      // Continue only when endpoint itself is missing/unavailable.
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    throw new Error(
      'Promo validation is unavailable on this backend deployment right now (promo routes missing). Please continue checkout without promo or deploy the latest API.'
    );
  }
  if (isPromoNotFoundOrInactiveError(lastError)) {
    throw new Error('Promo code not found or inactive.');
  }
  throw lastError ?? new Error('Promo preview route not found.');
}

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

async function createMinimalVendorWithFallback<T>(data: {
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
}) {
  let lastError: unknown = null;
  for (const path of adminCreateMinimalVendorPaths) {
    try {
      return await apiService.post<T>(path, data);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }

  // Compatibility fallback for older backends that only support /admin/users.
  if (!isRetryableRouteError(lastError)) {
    throw lastError ?? new Error('Vendor creation route not found.');
  }
  const fallbackResponse = await apiService.post<{ success: boolean; data: any; message?: string }>('/admin/users', {
    email: data.email,
    firstName: data.firstName,
    lastName: data.lastName,
    password: data.password,
    role: data.role,
    status: 'PENDING',
    phone: data.phone,
  });
  return {
    success: Boolean(fallbackResponse?.success),
    message:
      fallbackResponse?.message ||
      'Vendor user created. If location/profile fields are blank, update Vendor Profile Governance and ask vendor to complete profile on first login.',
    data: fallbackResponse?.data,
  } as T;
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
          { label: 'Resellers', value: Number(data?.users?.resellers || 0) },
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
    country?: string;
    callerId?: string;
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
      country?: string | null;
      callerId?: string | null;
    }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/users/${id}`, data),

  updateUserStatus: (id: string, status: string, reason?: string) =>
    apiService.patch(`/admin/users/${id}/status`, { status, reason }),

  sendUserPasswordResetLink: (id: string) =>
    apiService.post<{ success: boolean; message?: string; data?: { userId: string; email: string } }>(
      `/admin/users/${id}/send-password-reset-link`,
      {}
    ),
  setUserTemporaryPassword: (id: string, data: { temporaryPassword: string; reason?: string }) =>
    apiService.post<{ success: boolean; message?: string; data?: { userId: string; email: string } }>(
      `/admin/users/${id}/set-temporary-password`,
      data
    ),

  getAdminProfile: () =>
    apiService.get<{ success: boolean; data: any }>('/admin/profile'),

  updateAdminProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    avatar?: string | null;
    country?: string;
  }) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/admin/profile', data),

  getReferralProgramSettings: () =>
    apiService.get<{ success: boolean; data: any; source?: string; updatedAt?: string | null }>(
      '/admin/referrals/program/settings'
    ),

  updateReferralProgramSettings: (data: {
    enabled?: boolean;
    registrationReferralEnabled?: boolean;
    defaultReferralCode?: string;
    codePrefix?: string;
    codeDigits?: number;
    sellerCommissionPercent?: number;
    designerCommissionPercent?: number;
    customerCommissionPercent?: number;
    earnFromCustomerOrders?: boolean;
    holdDays?: number;
    minimumPayoutUsd?: number;
    referralBaseUrl?: string;
    profileEditableFields?: Array<'firstName' | 'lastName' | 'phone' | 'avatar' | 'displayName'>;
  }) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/admin/referrals/program/settings', data),

  getResellerInfluencers: (params?: { search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; pagination?: any }>('/admin/referrals/resellers', { params }),

  getReferralAttributionList: (params?: { search?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; pagination?: any }>('/admin/referrals/referral-list', { params }),

  createResellerInfluencer: (data: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    phone?: string;
    status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
    displayName?: string;
    commissionOverridePercent?: number | null;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/referrals/resellers', data),

  updateResellerInfluencer: (
    userId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      displayName?: string;
      isActive?: boolean;
      commissionOverridePercent?: number | null;
      status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'REJECTED';
      phone?: string | null;
      avatar?: string | null;
    }
  ) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/referrals/resellers/${userId}`, data),

  getReferralMaterials: () =>
    apiService
      .get<{ success: boolean; data: any[] }>('/admin/referrals/materials/manage')
      .then((response) => ({
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.map((row: any) => ({
              ...row,
              imageUrl: resolveApiAssetUrl(row?.imageUrl || ''),
            }))
          : [],
      })),

  createReferralMaterial: (data: {
    title: string;
    description?: string;
    imageUrl?: string;
    targetUrl?: string;
    widthPx?: number;
    heightPx?: number;
    sortOrder?: number;
    isActive?: boolean;
  }) =>
    apiService
      .post<{ success: boolean; data: any[]; message?: string }>('/admin/referrals/materials/manage', data)
      .then((response) => ({
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.map((row: any) => ({
              ...row,
              imageUrl: resolveApiAssetUrl(row?.imageUrl || ''),
            }))
          : [],
      })),

  updateReferralMaterial: (
    id: string,
    data: {
      title?: string;
      description?: string;
      imageUrl?: string;
      targetUrl?: string;
      widthPx?: number;
      heightPx?: number;
      sortOrder?: number;
      isActive?: boolean;
    }
  ) =>
    apiService
      .patch<{ success: boolean; data: any[]; message?: string }>(`/admin/referrals/materials/manage/${id}`, data)
      .then((response) => ({
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.map((row: any) => ({
              ...row,
              imageUrl: resolveApiAssetUrl(row?.imageUrl || ''),
            }))
          : [],
      })),

  deleteReferralMaterial: (id: string) =>
    apiService
      .delete<{ success: boolean; data: any[]; message?: string }>(`/admin/referrals/materials/manage/${id}`)
      .then((response) => ({
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.map((row: any) => ({
              ...row,
              imageUrl: resolveApiAssetUrl(row?.imageUrl || ''),
            }))
          : [],
      })),

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
  }) => createMinimalVendorWithFallback<{ success: boolean; data: any; message?: string }>(data),

  getProducts: async (params?: {
    search?: string;
    status?: string;
    type?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    page?: number;
    limit?: number;
  }) => {
    const response = await apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/admin/products', {
      params,
    });
    if (!response?.success) return response;
    const rows = Array.isArray(response.data?.products) ? response.data.products : [];
    return {
      ...response,
      data: {
        ...(response.data || {}),
        products: rows.map((row: any) => ({
          ...row,
          images: normalizeImageObjects(row?.images),
          image: resolveApiAssetUrl(row?.image || row?.images?.[0]?.url || row?.images?.[0] || ''),
        })),
      },
    };
  },

  getProductStockMonitor: () =>
    apiService.get<{
      success: boolean;
      data: {
        threshold: number;
        updatedAt?: string | null;
        summary: {
          total: number;
          zeroStockCount: number;
          byType?: {
            FABRIC: number;
            READY_TO_WEAR: number;
          };
          sync?: {
            changed: number;
            disabledOutOfStock: number;
            reenabledInStock: number;
          };
        };
        rows: Array<{
          productId: string;
          productType: 'FABRIC' | 'READY_TO_WEAR';
          name: string;
          ownerName: string;
          ownerCountry: string;
          ownerUserId: string | null;
          stockValue: number;
          status: string;
          isAvailable: boolean;
          updatedAt: string;
        }>;
      };
    }>('/admin/products/stock-monitor'),

  getProductPriceCompare: (params?: {
    search?: string;
    status?: string;
    type?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    severity?: 'AMBER' | 'RED';
    page?: number;
    limit?: number;
    minMarginPercent?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: {
        rows: Array<{
          productId: string;
          productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
          name: string;
          status: string;
          isAvailable: boolean;
          ownerName: string;
          ownerCountry: string;
          category: string;
          currentPrice: number;
          peerAveragePrice: number;
          diffAmount: number;
          diffPercent: number;
          absDiffPercent: number;
          direction: 'ABOVE' | 'BELOW';
          severity: 'AMBER' | 'RED';
          image: string | null;
          createdAt: string;
        }>;
        summary: {
          total: number;
          amberCount: number;
          redCount: number;
          byType: { FABRIC: number; DESIGN: number; READY_TO_WEAR: number };
        };
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/admin/products/price-compare', { params }),

  getFailedProductApprovals: (params?: {
    search?: string;
    productType?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    category?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: {
        rows: Array<{
          id: string;
          productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
          productId: string;
          productName: string;
          productCategory: string;
          ownerUserId: string;
          ownerRole: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
          ownerName: string;
          latestFailureReason: string;
          status: 'OPEN' | 'RESOLVED';
          createdAt: string;
          updatedAt: string;
          messageCount: number;
        }>;
        categories: string[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/failed-product-approvals/admin', { params }),

  rerunFailedProductApprovals: (
    items: Array<{ productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; productId: string }>,
    applyDecision = true
  ) =>
    apiService.post<{
      success: boolean;
      data: {
        results: Array<{
          productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
          productId: string;
          action: 'NONE' | 'AUTO_APPROVED' | 'AUTO_REJECTED';
          canAutoApprove: boolean;
          status: string;
          summaryMessage: string;
          technicalFailure: boolean;
          technicalFailureReason: string;
          retryExhausted: boolean;
          autoRetryCount: number;
          success: boolean;
          error?: string;
        }>;
        summary: { total: number; successCount: number; failedCount: number };
      };
    }>('/failed-product-approvals/admin/rerun', { items, applyDecision }),

  getFailedProductApprovalTicketMessages: (ticketId: string) =>
    apiService.get<{
      success: boolean;
      data: {
        ticket: any;
        messages: Array<{
          id: string;
          ticketId: string;
          senderUserId: string;
          senderRole: string;
          body: string;
          createdAt: string;
        }>;
      };
    }>(`/failed-product-approvals/admin/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`),

  sendFailedProductApprovalTicketMessage: (ticketId: string, body: string) =>
    apiService.post<{
      success: boolean;
      message?: string;
      data?: {
        id: string;
        ticketId: string;
        senderUserId: string;
        senderRole: string;
        body: string;
        createdAt: string;
      };
    }>(`/failed-product-approvals/admin/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`, {
      body,
    }),

  updateProductStockMonitor: (payload: { threshold: number }) =>
    apiService.patch<{
      success: boolean;
      message?: string;
      data: {
        threshold: number;
        summary: { total: number; zeroStockCount: number };
        rows: Array<any>;
      };
    }>('/admin/products/stock-monitor', payload),

  runProductStockMonitorSync: () =>
    apiService.post<{
      success: boolean;
      message?: string;
      data: {
        changed: number;
        disabledOutOfStock: number;
        reenabledInStock: number;
      };
    }>('/admin/products/stock-monitor/sync', {}),

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
  getActivityLogs: (params?: {
    role?: 'ADMINISTRATOR' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'CUSTOMER' | 'QA_TEAM';
    userQuery?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: any }>('/admin/activity-logs', { params }),
  exportActivityLogs: async (params?: {
    format?: 'csv' | 'xlsx' | 'pdf';
    role?: 'ADMINISTRATOR' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'CUSTOMER' | 'QA_TEAM';
    userQuery?: string;
    action?: string;
  }) => {
    const response = await httpClient.get('/admin/activity-logs/export', {
      params,
      responseType: 'blob',
    });
    const disposition = String(response.headers['content-disposition'] || '');
    const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = filenameMatch?.[1] || `activity-logs.${params?.format || 'csv'}`;
    return {
      blob: response.data as Blob,
      filename,
    };
  },

  getNotificationTemplates: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/notification-center/templates'),

  createNotificationTemplate: (payload: {
    key: string;
    title: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    audienceRole: 'ALL' | 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'VENDORS' | 'ADMINISTRATOR' | 'QA_TEAM';
    channelEmail: boolean;
    channelPush: boolean;
    channelInApp: boolean;
    isActive: boolean;
  }) => apiService.post<{ success: boolean; message?: string; data?: { key: string } }>('/admin/notification-center/templates', payload),

  upsertNotificationTemplate: (
    key: string,
    payload: {
      title: string;
      subject: string;
      bodyHtml: string;
      bodyText: string;
      audienceRole: 'ALL' | 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'VENDORS' | 'ADMINISTRATOR' | 'QA_TEAM';
      channelEmail: boolean;
      channelPush: boolean;
      channelInApp: boolean;
      isActive: boolean;
    }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/notification-center/templates/${key}`, payload),

  deleteNotificationTemplate: (key: string) =>
    apiService.delete<{ success: boolean; message?: string }>(`/admin/notification-center/templates/${encodeURIComponent(String(key || '').trim())}`),

  getNotificationDispatches: (params?: {
    role?: 'ALL' | 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'VENDORS' | 'ADMINISTRATOR' | 'QA_TEAM';
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: any }>('/admin/notification-center/dispatches', { params }),

  sendNotificationDispatch: (payload: {
    templateKey?: string;
    title?: string;
    subject?: string;
    bodyHtml?: string;
    bodyText?: string;
    audienceRole: 'ALL' | 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'VENDORS' | 'ADMINISTRATOR' | 'QA_TEAM';
    recipientUserIds?: string[];
    channelEmail?: boolean;
    channelPush?: boolean;
    channelInApp?: boolean;
  }) => apiService.post<{ success: boolean; message?: string; data?: any }>('/admin/notification-center/send', payload),

  getMeasurementTemplates: () =>
    readMeasurementTemplatesWithFallback<{
      success: boolean;
      data: Array<{ name: string; unit: string; isRequired: boolean; instructions?: string }>;
      message?: string;
    }>(),

  updateMeasurementTemplates: (templates: Array<{ name: string; unit: string; isRequired: boolean; instructions?: string }>) =>
    writeMeasurementTemplatesWithFallback<{ success: boolean; data?: any; message?: string }>(templates),

  getReadyToWearSizesSettings: () =>
    readReadyToWearSizesSettingsWithFallback<{
      success: boolean;
      data: { sizes: string[]; minVariantStock: number };
      message?: string;
    }>(),

  updateReadyToWearSizesSettings: (settings: { sizes: string[]; minVariantStock: number }) =>
    writeReadyToWearSizesSettingsWithFallback<{
      success: boolean;
      data: { sizes: string[]; minVariantStock: number };
      message?: string;
    }>(settings),

  getReadyToWearSizeGuideSettings: () =>
    readReadyToWearSizeGuideSettingsWithFallback<{
      success: boolean;
      data: { title: string; content: string };
      message?: string;
    }>(),

  updateReadyToWearSizeGuideSettings: (payload: { title: string; content: string }) =>
    writeReadyToWearSizeGuideSettingsWithFallback<{
      success: boolean;
      data: { title: string; content: string };
      message?: string;
    }>(payload),

  getProductLabelsSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        newTagDays: number;
        autoConditions?: {
          newTagDaysForSaleProducts: number;
          autoNewProductTypes: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>;
          autoSaleProductTypes: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>;
          autoSaleUsePriceDrop: boolean;
          autoSaleUseMarkdownRules: boolean;
        };
        appearance: {
          sizePercent: number;
          fontSizePx: number;
          isBold: boolean;
        };
        labels: Array<{
          id: string;
          name: string;
          mode: 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';
          textColor: string;
          backgroundColor: string;
          isActive: boolean;
        }>;
        assignments: Array<{
          labelId: string;
          productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
          productIds: string[];
        }>;
      };
    }>('/admin/product-labels'),

  updateProductLabelsSettings: (payload: {
    newTagDays: number;
    autoConditions?: {
      newTagDaysForSaleProducts: number;
      autoNewProductTypes: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>;
      autoSaleProductTypes: Array<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>;
      autoSaleUsePriceDrop: boolean;
      autoSaleUseMarkdownRules: boolean;
    };
    appearance?: {
      sizePercent: number;
      fontSizePx: number;
      isBold: boolean;
    };
    labels: Array<{
      id: string;
      name: string;
      mode: 'AUTO_NEW' | 'AUTO_SALE' | 'MANUAL';
      textColor: string;
      backgroundColor: string;
      isActive?: boolean;
    }>;
    assignments?: Array<{
      labelId: string;
      productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      productIds: string[];
    }>;
  }) => apiService.put<{ success: boolean; data: any; message?: string }>('/admin/product-labels', payload),

  getPromoCodes: () =>
    readAdminPromoCodesWithFallback<{ success: boolean; data: any[]; message?: string }>(),

  createPromoCode: (payload: any) =>
    createAdminPromoCodeWithFallback<{ success: boolean; data: any; message?: string }>(payload),

  updatePromoCode: (id: string, payload: any) =>
    updateAdminPromoCodeWithFallback<{ success: boolean; data: any; message?: string }>(id, payload),

  deletePromoCode: (id: string) =>
    deleteAdminPromoCodeWithFallback<{ success: boolean; message?: string }>(id),

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
    data: {
      status: 'APPROVED' | 'REJECTED';
      notes?: string;
      rejectionType?: 'TEMPORARY' | 'PERMANENT';
      rejectionReasonCode?: string;
      rejectionReasonLabel?: string;
      messageHtml?: string;
    }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/vendor-profiles/${role}/${userId}/review`, data),

  getVendorDashboardGovernance: () =>
    apiService.get<{
      success: boolean;
      data: {
        source?: 'DEFAULT' | 'DATABASE';
        updatedAt?: string | null;
        settings: {
          seller: Record<string, any>;
          designer: Record<string, any>;
        };
      };
      message?: string;
    }>('/admin/vendor-dashboard-governance'),

  updateVendorDashboardGovernance: (settings: {
    seller: Record<string, any>;
    designer: Record<string, any>;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        seller: Record<string, any>;
        designer: Record<string, any>;
      };
      message?: string;
    }>('/admin/vendor-dashboard-governance', { settings }),

  getTryOnSettings: () =>
    (async () => {
      let lastError: unknown = null;
      for (const path of [
        '/admin/try-on/settings',
        '/admin/tryon/settings',
        '/admin/3d-try-on/settings',
        '/admin/3d-tryon/settings',
      ]) {
        try {
          const response = await apiService.get<{
            success: boolean;
            data: { source?: 'DEFAULT' | 'DATABASE'; updatedAt?: string | null; settings: any };
          }>(path, noCacheRequestConfig());
          if (response.success) {
            writeTryOnSettingsFallback(response.data?.settings || response.data);
          }
          return response;
        } catch (error) {
          lastError = error;
          if (!isRetryableRouteError(error)) throw error;
        }
      }
      if (!lastError || isRetryableRouteError(lastError)) {
        const fallbackSettings = readTryOnSettingsFallback();
        return {
          success: true,
          data: {
            source: 'DEFAULT',
            updatedAt: null,
            settings: fallbackSettings,
          },
          message: 'Using local fallback TryON settings while backend route is unavailable.',
        };
      }
      throw lastError;
    })(),

  updateTryOnSettings: (settings: any) =>
    (async () => {
      let lastError: unknown = null;
      const normalizedSettings = normalizeTryOnSettingsFallback(settings);
      for (const path of [
        '/admin/try-on/settings',
        '/admin/tryon/settings',
        '/admin/3d-try-on/settings',
        '/admin/3d-tryon/settings',
      ]) {
        try {
          const response = await apiService.put<{ success: boolean; data: any; message?: string }>(path, {
            settings: normalizedSettings,
          });
          if (response.success) writeTryOnSettingsFallback(response.data || normalizedSettings);
          return response;
        } catch (error) {
          lastError = error;
          if (!isRetryableRouteError(error)) throw error;
        }
        try {
          const response = await apiService.patch<{ success: boolean; data: any; message?: string }>(path, {
            settings: normalizedSettings,
          });
          if (response.success) writeTryOnSettingsFallback(response.data || normalizedSettings);
          return response;
        } catch (error) {
          lastError = error;
          if (!isRetryableRouteError(error)) throw error;
        }
      }
      if (!lastError || isRetryableRouteError(lastError)) {
        writeTryOnSettingsFallback(normalizedSettings);
        return {
          success: true,
          data: normalizedSettings,
          message: 'Saved TryON settings locally. Backend route is currently unavailable.',
        };
      }
      throw lastError;
    })(),

  getTryOnInsights: () =>
    (async () => {
      let lastError: unknown = null;
      for (const path of [
        '/admin/try-on/insights',
        '/admin/tryon/insights',
        '/admin/3d-try-on/insights',
        '/admin/3d-tryon/insights',
      ]) {
        try {
          return await apiService.get<{ success: boolean; data: any }>(path, noCacheRequestConfig());
        } catch (error) {
          lastError = error;
          if (!isRetryableRouteError(error)) throw error;
        }
      }
      if (!lastError || isRetryableRouteError(lastError)) {
        return {
          success: true,
          data: {
            disabled: false,
            totalTryOns: 0,
            measurementAverages: {},
            recentTryOns: [],
          },
          message: 'Using fallback TryON insights while backend route is unavailable.',
        };
      }
      throw lastError;
    })(),

  getDesignerFabricCountryAccess: (params?: { search?: string }) =>
    readAdminDesignerFabricCountryAccessWithFallback<{
      success: boolean;
      data: {
        designers: Array<{
          designerProfileId: string;
          designerUserId: string;
          businessName: string;
          email: string;
          homeCountry: string;
          extraCountries: string[];
          allowedCountries: string[];
        }>;
        availableCountries: string[];
      };
      message?: string;
    }>(params),

  updateDesignerFabricCountryAccess: (designerUserId: string, extraCountries: string[]) =>
    writeAdminDesignerFabricCountryAccessWithFallback<{
      success: boolean;
      message?: string;
      data: {
        designerProfileId: string;
        designerUserId: string;
        businessName: string;
        homeCountry: string;
        extraCountries: string[];
        allowedCountries: string[];
      };
    }>(designerUserId, extraCountries),

  getDesignerFabricCountryAccessRequests: (params?: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL';
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    readAdminDesignerFabricCountryAccessRequestsWithFallback<{
      success: boolean;
      data: Array<{
        id: string;
        designerUserId: string;
        requestedCountries: string[];
        reason?: string;
        status: 'PENDING' | 'APPROVED' | 'REJECTED';
        reviewNotes?: string;
        reviewedByUserId?: string;
        reviewedByName?: string;
        createdAt: string;
        updatedAt: string;
        resolvedAt?: string;
        businessName?: string;
        email?: string;
        homeCountry?: string;
      }>;
      pagination?: {
        page: number;
        limit: number;
        total: number;
        pages: number;
      };
      message?: string;
    }>(params),

  reviewDesignerFabricCountryAccessRequest: (
    requestId: string,
    payload: { status: 'APPROVED' | 'REJECTED'; reviewNotes?: string; grantedCountries?: string[] }
  ) =>
    reviewAdminDesignerFabricCountryAccessRequestWithFallback<{
      success: boolean;
      data?: any;
      message?: string;
    }>(requestId, payload),

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

  getAuthenticatorSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        settings: {
          enabled: boolean;
          allowEmailOtp: boolean;
          allowTotpAuthenticator: boolean;
          otpLength: number;
          otpExpiryMinutes: number;
          challengeMaxAttempts: number;
          totpIssuer: string;
          totpPeriodSeconds: number;
          totpDigits: number;
          requiredUserRoles: string[];
          requiredAdminRoleIds: string[];
        };
        smtpSettings?: {
          enabled: boolean;
          host: string;
          port: number;
          secure: boolean;
          user: string;
          from: string;
          hasPassword: boolean;
        };
        userRoles: string[];
        adminRoles: Array<{ id: string; name: string; isActive: boolean }>;
      };
    }>('/admin/authenticator/settings'),

  updateAuthenticatorSettings: (payload: Partial<{
    enabled: boolean;
    allowEmailOtp: boolean;
    allowTotpAuthenticator: boolean;
    otpLength: number;
    otpExpiryMinutes: number;
    challengeMaxAttempts: number;
    totpIssuer: string;
    totpPeriodSeconds: number;
    totpDigits: number;
    requiredUserRoles: string[];
    requiredAdminRoleIds: string[];
    smtpSettings: Partial<{
      enabled: boolean;
      host: string;
      port: number;
      secure: boolean;
      user: string;
      from: string;
      password: string;
    }>;
  }>) =>
    apiService.patch<{
      success: boolean;
      message?: string;
      data: {
        settings: any;
        smtpSettings?: {
          enabled: boolean;
          host: string;
          port: number;
          secure: boolean;
          user: string;
          from: string;
          hasPassword: boolean;
        };
        userRoles: string[];
        adminRoles: Array<{ id: string; name: string; isActive: boolean }>;
      };
    }>('/admin/authenticator/settings', payload),

  getSmtpSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        host: string;
        port: number;
        secure: boolean;
        user: string;
        from: string;
        hasPassword: boolean;
      };
    }>('/admin/authenticator/smtp-settings'),

  updateSmtpSettings: (payload: Partial<{
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    password: string;
  }>) =>
    apiService.patch<{
      success: boolean;
      message?: string;
      data: {
        enabled: boolean;
        host: string;
        port: number;
        secure: boolean;
        user: string;
        from: string;
        hasPassword: boolean;
      };
    }>('/admin/authenticator/smtp-settings', payload),

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

  getFabricCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/fabric-categories'),

  createFabricCategory: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/fabric-categories', data),

  updateFabricCategory: (id: string, data: any) =>
    apiService.patch(`/admin/fabric-categories/${id}`, data),

  deleteFabricCategory: (id: string) =>
    apiService.delete(`/admin/fabric-categories/${id}`),

  getPricingRules: (scope: 'CATALOG' | 'CHECKOUT' = 'CATALOG') =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/pricing-rules', {
      params: { scope },
    }),

  getCheckoutPricingSettings: () =>
    apiService.get<{ success: boolean; data: { label: string } }>('/admin/pricing-rules/checkout-settings'),

  updateCheckoutPricingSettings: (data: { label: string }) =>
    apiService.patch<{ success: boolean; data: { label: string } }>('/admin/pricing-rules/checkout-settings', data),

  createPricingRule: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/pricing-rules', data),

  updatePricingRule: (id: string, data: any) =>
    apiService.patch(`/admin/pricing-rules/${id}`, data),

  deletePricingRule: (id: string) =>
    apiService.delete(`/admin/pricing-rules/${id}`),

  getPaymentIntegrations: () =>
    readAdminPaymentIntegrationsWithFallback<{
      success: boolean;
      data: {
        providers: any[];
        builtinProviderKeys: string[];
      };
    }>(),

  createPaymentIntegration: (data: {
    providerKey: string;
    displayName?: string;
    checkoutType?: 'INLINE' | 'REDIRECT';
    mode?: 'TEST' | 'LIVE';
    isActive?: boolean;
    configSchema?: any[];
    configValues?: Record<string, any>;
    notes?: string | null;
  }) =>
    createAdminPaymentIntegrationWithFallback<{ success: boolean; data: any }>(data),

  updatePaymentIntegration: (
    providerKey: string,
    data: {
      displayName?: string;
      checkoutType?: 'INLINE' | 'REDIRECT';
      mode?: 'TEST' | 'LIVE';
      isActive?: boolean;
      configSchema?: any[];
      configValues?: Record<string, any>;
      notes?: string | null;
    }
  ) => updateAdminPaymentIntegrationWithFallback<{ success: boolean; data: any }>(providerKey, data),

  deletePaymentIntegration: (providerKey: string) =>
    deleteAdminPaymentIntegrationWithFallback<{ success: boolean; message?: string }>(providerKey),

  getVendorPaymentConfig: () =>
    apiService.get<{ success: boolean; data: any }>('/payments/admin/vendor-config'),

  updateVendorPaymentConfig: (data: {
    releaseDelayDays?: number;
    minimumWithdrawalUsd?: number;
    slaHours?: number;
    platformFeePercent?: number;
    withdrawalOptions?: string[];
    payoutIntegrationProviders?: string[];
    countryWithdrawalRules?: Array<{
      country: string;
      withdrawalOptions?: string[];
      payoutIntegrationProviders?: string[];
      notes?: string;
    }>;
    notes?: string;
  }) => apiService.put<{ success: boolean; data: any; message?: string }>('/payments/admin/vendor-config', data),

  getVendorEarnings: (params?: { role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER' }) =>
    apiService.get<{ success: boolean; data: { seller: any[]; designer: any[] } }>('/payments/admin/vendor-earnings', {
      params,
    }),

  getVendorWithdrawals: (params?: { role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER'; status?: string }) =>
    apiService.get<{ success: boolean; data: any[] }>('/payments/admin/vendor-withdrawals', { params }),

  updateVendorWithdrawal: (
    id: string,
    data: { status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED'; adminNotes?: string; payoutReference?: string }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/payments/admin/vendor-withdrawals/${id}`, data),

  getShippingIntegrations: () =>
    readAdminShippingIntegrationsWithFallback<{
      success: boolean;
      data: {
        providers: any[];
        builtinProviderKeys: string[];
      };
    }>(),

  createShippingIntegration: (data: {
    providerKey: string;
    displayName?: string;
    providerType?: 'GLOBAL' | 'LOCAL';
    mode?: 'TEST' | 'LIVE';
    isActive?: boolean;
    supportsCountries?: string[];
    configSchema?: any[];
    configValues?: Record<string, any>;
    notes?: string | null;
  }) => createAdminShippingIntegrationWithFallback<{ success: boolean; data: any }>(data),

  updateShippingIntegration: (
    providerKey: string,
    data: {
      displayName?: string;
      providerType?: 'GLOBAL' | 'LOCAL';
      mode?: 'TEST' | 'LIVE';
      isActive?: boolean;
      supportsCountries?: string[];
      configSchema?: any[];
      configValues?: Record<string, any>;
      notes?: string | null;
    }
  ) => updateAdminShippingIntegrationWithFallback<{ success: boolean; data: any }>(providerKey, data),

  deleteShippingIntegration: (providerKey: string) =>
    deleteAdminShippingIntegrationWithFallback<{ success: boolean; message?: string }>(providerKey),

  getShippingLocalOptions: (params?: { countryCode?: string; city?: string; providerKey?: string }) =>
    readAdminShippingLocalOptionsWithFallback<{ success: boolean; data: any[] }>(params),

  createShippingLocalOption: (data: {
    countryCode: string;
    countryName: string;
    city?: string | null;
    providerKey: string;
    providerName: string;
    serviceName: string;
    etaMinDays: number;
    etaMaxDays: number;
    priceUsd: number;
    isActive?: boolean;
    metadata?: Record<string, any>;
  }) => createAdminShippingLocalOptionWithFallback<{ success: boolean; data: any }>(data),

  updateShippingLocalOption: (
    id: string,
    data: {
      countryCode?: string;
      countryName?: string;
      city?: string | null;
      providerKey?: string;
      providerName?: string;
      serviceName?: string;
      etaMinDays?: number;
      etaMaxDays?: number;
      priceUsd?: number;
      isActive?: boolean;
      metadata?: Record<string, any>;
    }
  ) => updateAdminShippingLocalOptionWithFallback<{ success: boolean; data: any }>(id, data),

  deleteShippingLocalOption: (id: string) =>
    deleteAdminShippingLocalOptionWithFallback<{ success: boolean; message?: string }>(id),

  getShippingStageTemplates: (params?: { providerKey?: string }) =>
    readAdminShippingStageTemplatesWithFallback<{ success: boolean; data: any[] }>(params),

  createShippingStageTemplate: (data: {
    providerKey: string;
    stageKey: string;
    stageLabel: string;
    description?: string | null;
    sortOrder?: number;
    isFinal?: boolean;
    isActive?: boolean;
  }) => createAdminShippingStageTemplateWithFallback<{ success: boolean; data: any }>(data),

  updateShippingStageTemplate: (
    id: string,
    data: {
      providerKey?: string;
      stageKey?: string;
      stageLabel?: string;
      description?: string | null;
      sortOrder?: number;
      isFinal?: boolean;
      isActive?: boolean;
    }
  ) => updateAdminShippingStageTemplateWithFallback<{ success: boolean; data: any }>(id, data),

  deleteShippingStageTemplate: (id: string) =>
    deleteAdminShippingStageTemplateWithFallback<{ success: boolean; message?: string }>(id),

  getOrderLocalShippingStages: (orderId: string) =>
    readAdminOrderShippingStagesWithFallback<{ success: boolean; data: any[] }>(orderId),

  updateOrderLocalShippingStage: (
    orderId: string,
    data: {
      providerKey?: string;
      stageKey: string;
      notes?: string;
      trackingNumber?: string;
      currentLocation?: string;
    }
  ) =>
    updateAdminOrderShippingStageWithFallback<{
      success: boolean;
      data: {
        orderId: string;
        shippingTracking: any;
        stages: any[];
      };
    }>(orderId, data),

  getOrders: (params?: { status?: string; page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: { orders: any[]; pagination: any } }>('/admin/orders', { params }),

  assignQA: (orderId: string, qaId: string) =>
    apiService.patch(`/admin/orders/${orderId}/assign-qa`, { qaId }),

  getPartnerApps: () =>
    readAdminPartnerAppsWithFallback<{ success: boolean; data: any[]; message?: string }>(),

  createPartnerApp: (data: {
    name: string;
    description?: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    allowedIps?: string[];
    webhookUrl?: string;
  }) => createAdminPartnerAppWithFallback<{ success: boolean; data: any; message?: string }>(data),

  updatePartnerApp: (
    appId: string,
    data: {
      name?: string;
      description?: string | null;
      status?: 'ACTIVE' | 'INACTIVE';
      scopes?: string[];
      rateLimitPerMinute?: number;
      allowedIps?: string[];
      webhookUrl?: string | null;
    }
  ) => updateAdminPartnerAppWithFallback<{ success: boolean; data: any; message?: string }>(appId, data as any),

  rotatePartnerAppKey: (appId: string, expiresAt?: string) =>
    rotateAdminPartnerAppKeyWithFallback<{ success: boolean; data: any; message?: string }>(appId, expiresAt),

  rotatePartnerWebhookSecret: (appId: string) =>
    rotateAdminPartnerWebhookSecretWithFallback<{ success: boolean; data: any; message?: string }>(appId),

  sendPartnerTestWebhook: (appId: string) =>
    sendAdminPartnerTestWebhookWithFallback<{ success: boolean; data: any; message?: string }>(appId),

  getPartnerAudit: (appId: string, params?: { page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; pagination?: any }>(`/admin/partners/apps/${appId}/audit`, {
      params,
    }),

  getPartnerWebhookDeliveries: (appId: string, params?: { page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; pagination?: any }>(
      `/admin/partners/apps/${appId}/webhook-deliveries`,
      { params }
    ),

  getOrderWorkflowSettings: () =>
    apiService.get<{ success: boolean; data: any }>('/admin/order-workflow/settings'),

  updateOrderWorkflowSettings: (data: any) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/admin/order-workflow/settings', data),

  getAutomationSettings: () =>
    apiService.get<{ success: boolean; data: any; source?: string; updatedAt?: string | null }>(
      '/admin/automation/settings'
    ),

  updateAutomationSettings: (data: any) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/admin/automation/settings', data),

  evaluateAutomationProduct: (data: {
    productType: 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN';
    productId: string;
    applyDecision?: boolean;
  }) => apiService.post<{ success: boolean; data: any }>('/admin/automation/evaluate-product', data),

  evaluateAutomationAccount: (data: { userId: string; role?: string }) =>
    apiService.post<{ success: boolean; data: any }>('/admin/automation/evaluate-account', data),

  getReportCatalog: () =>
    apiService.get<{ success: boolean; data: any }>('/admin/reports/catalog'),

  getReportDefinitions: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/reports/definitions'),

  createReportDefinition: (data: {
    name: string;
    description?: string;
    reportType: 'GENERAL_SALES' | 'STOCK_OVERVIEW' | 'VENDOR_SALES' | 'REFERRAL_PERFORMANCE' | 'ORDER_ACTIVITY';
    config?: Record<string, any>;
    isActive?: boolean;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/reports/definitions', data),

  updateReportDefinition: (
    id: string,
    data: {
      name?: string;
      description?: string;
      reportType?: 'GENERAL_SALES' | 'STOCK_OVERVIEW' | 'VENDOR_SALES' | 'REFERRAL_PERFORMANCE' | 'ORDER_ACTIVITY';
      config?: Record<string, any>;
      isActive?: boolean;
    }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/reports/definitions/${id}`, data),

  generateReport: (data: {
    definitionId?: string;
    reportType?: 'GENERAL_SALES' | 'STOCK_OVERVIEW' | 'VENDOR_SALES' | 'REFERRAL_PERFORMANCE' | 'ORDER_ACTIVITY';
    config?: Record<string, any>;
  }) => apiService.post<{ success: boolean; data: any }>('/admin/reports/generate', data),

  getAutomationProviderSuggestions: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/automation/providers/suggestions'),

  testAutomationProvider: (data: { providerId: string; functionKey?: string; prompt?: string }) =>
    apiService.post<{ success: boolean; data: any; message?: string }>('/admin/automation/providers/test', data),

  getAutomationFieldCatalog: () =>
    apiService.get<{
      success: boolean;
      data: {
        FABRIC: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        READY_TO_WEAR: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        DESIGN: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        ACCOUNT_APPROVAL: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
      };
    }>('/admin/automation/field-catalog'),

  syncAutomationFieldCatalog: () =>
    apiService.post<{
      success: boolean;
      message?: string;
      settings?: any;
      data: {
        FABRIC: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        READY_TO_WEAR: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        DESIGN: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
        ACCOUNT_APPROVAL: Array<{ key: string; label: string; dataType: string; source: 'CORE' | 'DYNAMIC' }>;
      };
    }>('/admin/automation/field-catalog/sync'),

  listDynamicFields: (params?: { module?: string; scope?: string; isActive?: boolean }) =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/dynamic-fields', { params }),

  createDynamicField: (data: {
    key: string;
    label: string;
    module: string;
    scope: string;
    dataType?: string;
    placeholder?: string;
    helpText?: string;
    defaultValue?: string;
    options?: string[];
    validation?: Record<string, any>;
    functionKeys?: string[];
    isRequired?: boolean;
    isActive?: boolean;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/dynamic-fields', data),

  updateDynamicField: (
    id: string,
    data: {
      key?: string;
      label?: string;
      module?: string;
      scope?: string;
      dataType?: string;
      placeholder?: string;
      helpText?: string;
      defaultValue?: string;
      options?: string[];
      validation?: Record<string, any>;
      functionKeys?: string[];
      isRequired?: boolean;
      isActive?: boolean;
    }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/dynamic-fields/${id}`, data),

  deleteDynamicField: (id: string) =>
    apiService.delete<{ success: boolean; message?: string }>(`/admin/dynamic-fields/${id}`),

  autoCloseOverdueOrders: () =>
    apiService.post<{ success: boolean; data: { closedCount: number }; message?: string }>(
      '/admin/order-workflow/auto-close-overdue'
    ),

  getBackupSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        storage: {
          uploadToS3: boolean;
          bucket: string;
          region: string;
          prefix: string;
          credentialsConfigured?: boolean;
        };
        daily: {
          enabled: boolean;
          runAtUtc: string;
          retainDays: number;
          backupDatabase: boolean;
          backupCustomerData: boolean;
          backupSellerData: boolean;
          backupDesignerData: boolean;
          backupSystemFiles: boolean;
        };
      };
    }>('/admin/backups/settings'),

  updateBackupSettings: (data: {
    storage?: {
      uploadToS3?: boolean;
      bucket?: string;
      region?: string;
      prefix?: string;
    };
    daily?: {
      enabled?: boolean;
      runAtUtc?: string;
      retainDays?: number;
      backupDatabase?: boolean;
      backupCustomerData?: boolean;
      backupSellerData?: boolean;
      backupDesignerData?: boolean;
      backupSystemFiles?: boolean;
    };
  }) => apiService.patch<{ success: boolean; data: any; message?: string }>('/admin/backups/settings', data),

  runBackups: (data: {
    types: Array<'DATABASE_FULL' | 'SYSTEM_FULL' | 'CUSTOMER_FULL' | 'SELLER_FULL' | 'DESIGNER_FULL'>;
    uploadToS3?: boolean;
    reason?: string;
  }) => apiService.post<{ success: boolean; data: { jobs: Array<{ id: string }> }; message?: string }>('/admin/backups/run', data),

  runDailyBackupsNow: () =>
    apiService.post<{ success: boolean; data: { jobs: Array<{ id: string }> }; message?: string }>(
      '/admin/backups/run-daily-now'
    ),

  listBackups: (params?: { limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; message?: string }>('/admin/backups/jobs', { params }),

  listBackupRestoreJobs: (params?: { limit?: number }) =>
    apiService.get<{ success: boolean; data: any[]; message?: string }>('/admin/backups/restore/jobs', { params }),

  runBackupRestore: (data: { artifactId: string; mode?: 'MERGE'; reason?: string }) =>
    apiService.post<{ success: boolean; data: { job: any }; message?: string }>('/admin/backups/restore/run', data),

  downloadBackupArtifact: async (backupId: string) => {
    const sanitizedId = encodeURIComponent(String(backupId || '').trim());
    const response = await httpClient.get(`/admin/backups/jobs/${sanitizedId}/download`, {
      responseType: 'blob',
    });
    const contentDisposition = String(response.headers?.['content-disposition'] || '').trim();
    let fileName = `backup-${String(backupId || '').trim() || 'artifact'}`;
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    const basicMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
    if (utf8Match?.[1]) {
      try {
        fileName = decodeURIComponent(String(utf8Match[1]).trim());
      } catch {
        fileName = String(utf8Match[1]).trim();
      }
    } else if (basicMatch?.[1]) {
      fileName = String(basicMatch[1]).trim();
    }
    return {
      blob: response.data as Blob,
      fileName,
    };
  },

  getBackupDownloadUrl: (backupId: string) => `${API_URL}/admin/backups/jobs/${encodeURIComponent(String(backupId || '').trim())}/download`,

  getOrderTicketingSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        defaultVisibleToCustomer: boolean;
        allowVendorToVendorDirect: boolean;
        allowVendorToCustomerDirect: boolean;
        allowCustomerToVendorDirect: boolean;
        allowQaToVendorMessaging: boolean;
        allowQaToCustomerMessaging: boolean;
        autoAssignEnabled: boolean;
        autoAssignRole: string;
        slaResponseHours: number;
        escalationRole: string;
        escalationNotifyRoles: string[];
        recipientMatrix: Record<string, string[]>;
      };
    }>('/orders/admin/ticketing/settings'),

  updateOrderTicketingSettings: (data: {
    enabled?: boolean;
    defaultVisibleToCustomer?: boolean;
    allowVendorToVendorDirect?: boolean;
    allowVendorToCustomerDirect?: boolean;
    allowCustomerToVendorDirect?: boolean;
    allowQaToVendorMessaging?: boolean;
    allowQaToCustomerMessaging?: boolean;
    autoAssignEnabled?: boolean;
    autoAssignRole?: string;
    slaResponseHours?: number;
    escalationRole?: string;
    escalationNotifyRoles?: string[];
    recipientMatrix?: Record<string, string[]>;
  }) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/orders/admin/ticketing/settings', data),

  getOrderTicketingTranslationSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        defaultLanguage: string;
        supportedLanguages: Array<{ code: string; label: string }>;
      };
    }>('/orders/admin/ticketing/translation-settings'),

  updateOrderTicketingTranslationSettings: (data: {
    enabled?: boolean;
    defaultLanguage?: string;
  }) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(
      '/orders/admin/ticketing/translation-settings',
      data
    ),

  getCategoryPageSettings: (pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR') =>
    readAdminCategoryPageSettingsWithFallback<{
      success: boolean;
      data: {
        pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
        source?: 'DEFAULT' | 'DATABASE';
        updatedAt?: string | null;
        settings: {
          bannerTitle: string;
          bannerSubtitle: string;
          bannerImage: string;
          designPreset: 'STANDARD' | 'EDITORIAL' | 'MINIMAL';
          bannerHeight: number;
          pageSize: number;
          columns: number;
          showPagination: boolean;
          featuredProductIds: string[];
          featuredSlots: Array<{ productId: string; isActive: boolean }>;
          rotatingProductIds: string[];
          rotatingColumns: number;
          rotatingRows: number;
          rotatingTitleSize: number;
          recommendationProductIds: string[];
          recommendationDisplayCount: number;
          recommendationConfiguredOnly: boolean;
          recommendationPreferSameCountry: boolean;
          recommendationPreferDifferentSeller: boolean;
        };
        featuredProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
        rotatingProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
      };
      message?: string;
    }>(pageType),

  updateCategoryPageSettings: (
    pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
    data: Partial<{
      bannerTitle: string;
      bannerSubtitle: string;
      bannerImage: string;
      designPreset: 'STANDARD' | 'EDITORIAL' | 'MINIMAL';
      bannerHeight: number;
      pageSize: number;
      columns: number;
      showPagination: boolean;
      featuredProductIds: string[];
      featuredSlots: Array<{ productId: string; isActive: boolean }>;
      rotatingProductIds: string[];
      rotatingColumns: number;
      rotatingRows: number;
      rotatingTitleSize: number;
      recommendationProductIds: string[];
      recommendationDisplayCount: number;
      recommendationConfiguredOnly: boolean;
      recommendationPreferSameCountry: boolean;
      recommendationPreferDifferentSeller: boolean;
    }>
  ) =>
    writeAdminCategoryPageSettingsWithFallback<{
      success: boolean;
      data: {
        pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
        settings: {
          bannerTitle: string;
          bannerSubtitle: string;
          bannerImage: string;
          designPreset: 'STANDARD' | 'EDITORIAL' | 'MINIMAL';
          bannerHeight: number;
          pageSize: number;
          columns: number;
          showPagination: boolean;
          featuredProductIds: string[];
          featuredSlots: Array<{ productId: string; isActive: boolean }>;
          rotatingProductIds: string[];
          rotatingColumns: number;
          rotatingRows: number;
          rotatingTitleSize: number;
          recommendationProductIds: string[];
          recommendationDisplayCount: number;
          recommendationConfiguredOnly: boolean;
          recommendationPreferSameCountry: boolean;
          recommendationPreferDifferentSeller: boolean;
        };
        featuredProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
        rotatingProducts: Array<{
          id: string;
          name: string;
          description?: string;
          image: string;
          priceUsd: number;
          country: string;
          ownerName: string;
          href: string;
        }>;
      };
      message?: string;
    }>(pageType, data as any),

  getCategoryPageProductOptions: (
    pageType: 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR',
    params?: { search?: string; limit?: number }
  ) =>
    readCategoryPageProductOptionsWithFallback<{
      success: boolean;
      data: Array<{
        id: string;
        name: string;
        description?: string;
        ownerName: string;
        country: string;
        priceUsd: number;
        image: string;
      }>;
      message?: string;
    }>(pageType, params),

  // Banner Management
  normalizeBannerRow: (row: any) => ({
    ...(row || {}),
    images: Array.isArray(row?.images) ? row.images.map((image: any) => resolveApiAssetUrl(image)) : [],
  }),
  getBanners: () =>
    apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all').then((response) => ({
      ...response,
      data: Array.isArray(response?.data) ? response.data.map((row) => adminApi.normalizeBannerRow(row)) : [],
    })),

  getPromoBadgeSettings: () =>
    readAdminPromoBadgeWithFallback<{ success: boolean; data: { valueText: string; labelText: string } }>(),

  updatePromoBadgeSettings: (data: { valueText: string; labelText: string }) =>
    writeAdminPromoBadgeWithFallback<{ success: boolean; data: { valueText: string; labelText: string } }>(data),

  createBanner: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/banners', data).then((response) => ({
      ...response,
      data: response?.data ? adminApi.normalizeBannerRow(response.data) : response?.data,
    })),

  updateBanner: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/banners/${id}`, data).then((response) => ({
      ...response,
      data: response?.data ? adminApi.normalizeBannerRow(response.data) : response?.data,
    })),

  deleteBanner: (id: string) =>
    apiService.delete<{ success: boolean }>(`/banners/${id}`),

  toggleBanner: (id: string) =>
    apiService.patch<{ success: boolean; data: any }>(`/banners/${id}/toggle`).then((response) => ({
      ...response,
      data: response?.data ? adminApi.normalizeBannerRow(response.data) : response?.data,
    })),
};

// Fabric Seller API
const sellerApi = {
  getDashboard: () =>
    readSellerDashboardWithFallback<{ success: boolean; data: any }>(),

  getDashboardGovernance: () =>
    apiService.get<{ success: boolean; data: any }>('/seller/dashboard-governance'),

  getTryOnInsights: () =>
    readSellerTryOnInsightsWithFallback<{ success: boolean; data: any }>(),

  getFabrics: () =>
    readSellerFabricsWithFallback<{ success: boolean; data: any[] }>(),

  getProfileCompletion: () =>
    readSellerProfileCompletionWithFallback<{ success: boolean; data: any }>(),

  getProfileFields: () =>
    readSellerProfileFieldsWithFallback<{ success: boolean; data: { role: string; fields: any[] } }>(),

  updateProfileCompletion: (data: any) =>
    writeSellerProfileCompletionWithFallback<{ success: boolean; data: any; message?: string }>(data),

  createFabric: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/fabric-seller/fabrics', data),

  updateFabric: (fabricId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/fabric-seller/fabrics/${fabricId}`, data),

  getOrders: () =>
    readSellerOrdersWithFallback<{ success: boolean; data: any[] }>(),

  getStats: async () => {
    const response = await readSellerDashboardWithFallback<{ success: boolean; data: any }>();
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
    updateOrderStatusWithFallback(orderId, status, [
      `/fabric-seller/orders/${orderId}/status`,
      `/seller/orders/${orderId}/status`,
    ]),

  getFailedProductApprovals: (params?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: {
        rows: Array<any>;
        categories: string[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/failed-product-approvals/my', { params }),

  getFailedProductApprovalTicketMessages: (ticketId: string) =>
    apiService.get<{
      success: boolean;
      data: { ticket: any; messages: Array<any> };
    }>(`/failed-product-approvals/my/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`),

  sendFailedProductApprovalTicketMessage: (ticketId: string, body: string) =>
    apiService.post<{ success: boolean; message?: string; data?: any }>(
      `/failed-product-approvals/my/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`,
      { body }
    ),
};

// Designer API
const designerApi = {
  getDashboard: () =>
    readDesignerDashboardWithFallback<{ success: boolean; data: any }>(),

  getDashboardGovernance: () =>
    apiService.get<{ success: boolean; data: any }>('/designer/dashboard-governance'),

  getTryOnInsights: () =>
    readDesignerTryOnInsightsWithFallback<{ success: boolean; data: any }>(),

  getDesigns: () =>
    readDesignerDesignsWithFallback<{ success: boolean; data: any[] }>(),

  getProfileCompletion: () =>
    readDesignerProfileCompletionWithFallback<{ success: boolean; data: any }>(),

  getProfileFields: () =>
    readDesignerProfileFieldsWithFallback<{ success: boolean; data: { role: string; fields: any[] } }>(),

  getMeasurementTemplateOptions: () =>
    readDesignerMeasurementTemplateOptionsWithFallback<{
      success: boolean;
      data: Array<{
        name: string;
        unit: string;
        isRequired: boolean;
        instructions?: string;
      }>;
    }>(),

  getDesignFabricOptions: (params?: { country?: string; materialTypeId?: string; search?: string; limit?: number }) =>
    readDesignerFabricOptionsWithFallback<{
      success: boolean;
      data: {
        allowedCountries: string[];
        countries: string[];
        materials: Array<{ id: string; name: string }>;
        fabrics: Array<{
          id: string;
          name: string;
          materialTypeId: string;
          materialTypeName: string;
          sellerCountry: string;
          sellerName: string;
          priceUsd: number;
          image: string;
        }>;
      };
      message?: string;
    }>(params),

  getFabricCountryAccessSummary: () =>
    readDesignerFabricCountryAccessSummaryWithFallback<{
      success: boolean;
      data: {
        homeCountry: string;
        allowedCountries: string[];
        availableCountries: string[];
        requests: Array<{
          id: string;
          designerUserId: string;
          requestedCountries: string[];
          reason?: string;
          status: 'PENDING' | 'APPROVED' | 'REJECTED';
          reviewNotes?: string;
          reviewedByUserId?: string;
          reviewedByName?: string;
          createdAt: string;
          updatedAt: string;
          resolvedAt?: string;
        }>;
      };
      message?: string;
    }>(),

  createFabricCountryAccessRequest: (payload: { requestedCountries: string[]; reason?: string }) =>
    createDesignerFabricCountryAccessRequestWithFallback<{
      success: boolean;
      data?: any;
      message?: string;
    }>(payload),

  getFailedProductApprovals: (params?: {
    search?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: {
        rows: Array<any>;
        categories: string[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/failed-product-approvals/my', { params }),

  getFailedProductApprovalTicketMessages: (ticketId: string) =>
    apiService.get<{
      success: boolean;
      data: { ticket: any; messages: Array<any> };
    }>(`/failed-product-approvals/my/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`),

  sendFailedProductApprovalTicketMessage: (ticketId: string, body: string) =>
    apiService.post<{ success: boolean; message?: string; data?: any }>(
      `/failed-product-approvals/my/tickets/${encodeURIComponent(String(ticketId || '').trim())}/messages`,
      { body }
    ),

  updateProfileCompletion: (data: any) =>
    writeDesignerProfileCompletionWithFallback<{ success: boolean; data: any; message?: string }>(data),

  createDesign: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/designs', data),

  updateDesign: (designId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/designs/${designId}`, data),

  getReadyToWear: () =>
    readDesignerReadyToWearWithFallback<{ success: boolean; data: any[] }>(),

  getReadyToWearSizeOptions: () =>
    apiService.get<{ success: boolean; data: { sizes: string[]; standardSizes: string[]; minVariantStock: number } }>(
      '/designer/ready-to-wear-size-options'
    ),

  createReadyToWear: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/ready-to-wear', data),

  updateReadyToWear: (productId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/ready-to-wear/${productId}`, data),

  updateReadyToWearSizeStock: (productId: string, sizes: Array<{ size: string; color?: string; stock: number }>) =>
    updateDesignerReadyToWearSizeStockWithFallback<{ success: boolean; data: any; message?: string }>(productId, sizes),

  getOrders: () =>
    readDesignerOrdersWithFallback<{ success: boolean; data: any[] }>(),

  getStats: async () => {
    const response = await readDesignerDashboardWithFallback<{ success: boolean; data: any }>();
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
    updateOrderStatusWithFallback(orderId, status, [
      `/designer/orders/${orderId}/status`,
      `/fashion-designer/orders/${orderId}/status`,
    ]),
};

// QA API
const qaApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/qa/dashboard'),

  getTryOnInsights: () =>
    apiService.get<{ success: boolean; data: any }>('/qa/try-on/insights'),

  getOrders: (params?: { status?: string }) =>
    apiService.get<{ success: boolean; data: any[] }>('/qa/orders', { params }),

  shipOrder: (orderId: string, trackingNumber: string, notes?: string) =>
    apiService.patch(`/qa/orders/${orderId}/ship`, { trackingNumber, notes }),

  getOrderChecklist: (orderId: string) =>
    apiService.get<{ success: boolean; data: any[] }>(`/qa/orders/${orderId}/checklist`),

  updateOrderChecklist: (
    orderId: string,
    data: { items: Array<{ key: string; label: string; required: boolean; checked: boolean; notes?: string }>; notes?: string }
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/qa/orders/${orderId}/checklist`, data),

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
  getLastCreateSessionDebugInfo: () => getCheckoutPaymentDebugInfo(),

  getOptions: (params?: { useCase?: 'CHECKOUT' | 'FEATURED' | 'ENTERPRISE' | 'WITHDRAWAL' }) =>
    readPaymentOptionsWithFallback<{
      success: boolean;
      data: {
        providers: Array<{
          providerKey: string;
          displayName: string;
          checkoutType: 'INLINE' | 'REDIRECT';
          mode: 'TEST' | 'LIVE';
          enabledUseCases?: Array<'CHECKOUT' | 'FEATURED' | 'ENTERPRISE' | 'WITHDRAWAL'>;
          publicConfig?: Record<string, any>;
        }>;
      };
    }>(params),

  createPaymentSession: (data: {
    providerKey: string;
    amount: number;
    amountUsd?: number;
    currency: string;
    reference?: string;
    returnUrl?: string;
    cancelUrl?: string;
    customer?: { email?: string; name?: string; phone?: string };
  }) =>
    createPaymentSessionWithFallback<{
      success: boolean;
      data: {
        providerKey: string;
        flow: 'INLINE' | 'REDIRECT';
        reference: string;
        clientSecret?: string;
        paymentIntentId?: string;
        checkoutUrl?: string;
      };
    }>(data),

  verifyPayment: (data: { providerKey: string; reference: string; payerId?: string }) =>
    verifyPaymentWithFallback<{
      success: boolean;
      data: {
        providerKey: string;
        isPaid: boolean;
        paymentReference: string;
        status: string;
      };
    }>(data),

  createPaymentIntent: (data: { amount: number; currency: string }) =>
    apiService.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>('/payments/create-intent', data),

  confirmPayment: (paymentIntentId: string) =>
    apiService.post<{ success: boolean; data: any }>('/payments/confirm', { paymentIntentId }),

  getVendorConfig: () =>
    apiService.get<{ success: boolean; data: any }>('/payments/vendor/config'),

  getVendorEarnings: () =>
    apiService.get<{ success: boolean; data: any[] }>('/payments/vendor/earnings'),

  getVendorWallet: () =>
    apiService.get<{ success: boolean; data: any }>('/payments/vendor/wallet'),

  getVendorWithdrawalMethods: () =>
    apiService.get<{ success: boolean; data: any[] }>('/payments/vendor/withdrawal-methods'),

  createVendorWithdrawalMethod: (data: any) =>
    apiService.post<{ success: boolean; data?: any; message?: string }>('/payments/vendor/withdrawal-methods', data),

  updateVendorWithdrawalMethod: (id: string, data: any) =>
    apiService.put<{ success: boolean; message?: string }>(`/payments/vendor/withdrawal-methods/${id}`, data),

  getVendorWithdrawalRequests: () =>
    apiService.get<{ success: boolean; data: any[] }>('/payments/vendor/withdrawals'),

  createVendorWithdrawalRequest: (data: { methodId: string; amountUsd: number; notes?: string }) =>
    apiService.post<{ success: boolean; data?: any; message?: string }>('/payments/vendor/withdrawals', data),
};

// Shipping API
const shippingApi = {
  getOptions: (data: { countryCode: string; city?: string; subtotalUsd: number; weightKg?: number }) =>
    readShippingOptionsWithFallback<{
      success: boolean;
      data: {
        countryCode: string;
        city: string;
        quotes: Array<{
          id: string;
          source: 'GLOBAL' | 'LOCAL';
          providerKey: string;
          providerName: string;
          serviceName: string;
          etaMinDays: number;
          etaMaxDays: number;
          priceUsd: number;
          countryCode?: string;
          city?: string | null;
        }>;
        recommendedQuoteId: string | null;
      };
    }>(data),

  trackShipment: (data: { providerKey: string; trackingNumber: string }) =>
    readShippingTrackingWithFallback<{
      success: boolean;
      data: {
        providerKey: string;
        providerName: string;
        trackingNumber: string;
        status: string;
        events: Array<{ status: string; location?: string; timestamp: string; notes?: string }>;
      };
    }>(data),

  getCheckoutDeliveryInfo: (params?: { providerKey?: string }) =>
    readShippingCheckoutDeliveryInfoWithFallback<{
      success: boolean;
      data: {
        providerKey: string;
        stages: Array<{
          id: string;
          step: number;
          stageKey: string;
          stageLabel: string;
          description: string | null;
          isFinal: boolean;
          sortOrder: number;
        }>;
      };
    }>(params),
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
    }).then((res) => {
      const payload = res.data;
      return {
        ...payload,
        data: payload?.data
          ? {
              ...payload.data,
              url: resolveApiAssetUrl(payload.data.url),
            }
          : payload?.data,
      };
    }),
  document: (formData: FormData) =>
    httpClient.post<{ success: boolean; data: { url: string } }>('/upload/document', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((res) => {
      const payload = res.data;
      return {
        ...payload,
        data: payload?.data
          ? {
              ...payload.data,
              url: resolveApiAssetUrl(payload.data.url),
            }
          : payload?.data,
      };
    }),
  file: (formData: FormData) =>
    httpClient.post<{ success: boolean; data: { url: string } }>('/upload/file', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }).then((res) => {
      const payload = res.data;
      return {
        ...payload,
        data: payload?.data
          ? {
              ...payload.data,
              url: resolveApiAssetUrl(payload.data.url),
            }
          : payload?.data,
      };
    }),
};

const normalizeHomepageSlide = (entry: any) => ({
  ...(entry || {}),
  image: resolveApiAssetUrl(entry?.image || ''),
});
const normalizeHomepageFeaturedEntry = (entry: any) => ({
  ...(entry || {}),
  image: resolveApiAssetUrl(entry?.image || ''),
  images: Array.isArray(entry?.images) ? entry.images.map((item: any) => resolveApiAssetUrl(item)) : entry?.images,
});

// Homepage API
const homepageApi = {
  // Public endpoints
  getHeroSlides: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/hero-slides').then((response) => ({
      ...response,
      data: Array.isArray(response?.data) ? response.data.map((entry) => normalizeHomepageSlide(entry)) : [],
    })),

  getFeaturedBySection: (section: string) =>
    apiService.get<{ success: boolean; data: any[] }>(`/homepage/featured/${section}`).then((response) => ({
      ...response,
      data: Array.isArray(response?.data) ? response.data.map((entry) => normalizeHomepageFeaturedEntry(entry)) : [],
    })),

  getAllFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage/featured').then((response) => ({
      ...response,
      data: response?.data
        ? {
            ...(response.data || {}),
            featuredProducts: Array.isArray(response.data?.featuredProducts)
              ? response.data.featuredProducts.map((entry: any) => normalizeHomepageFeaturedEntry(entry))
              : response.data?.featuredProducts,
          }
        : response?.data,
    })),

  // Admin endpoints
  getAdminHeroSlides: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/hero-slides').then((response) => ({
      ...response,
      data: Array.isArray(response?.data) ? response.data.map((entry) => normalizeHomepageSlide(entry)) : [],
    })),

  createHeroSlide: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage/admin/hero-slides', data).then((response) => ({
      ...response,
      data: response?.data ? normalizeHomepageSlide(response.data) : response?.data,
    })),

  updateHeroSlide: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage/admin/hero-slides/${id}`, data).then((response) => ({
      ...response,
      data: response?.data ? normalizeHomepageSlide(response.data) : response?.data,
    })),

  deleteHeroSlide: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/hero-slides/${id}`),

  getAdminFeatured: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/featured').then((response) => ({
      ...response,
      data: Array.isArray(response?.data) ? response.data.map((entry) => normalizeHomepageFeaturedEntry(entry)) : [],
    })),

  addFeaturedProduct: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage/admin/featured', data).then((response) => ({
      ...response,
      data: response?.data ? normalizeHomepageFeaturedEntry(response.data) : response?.data,
    })),

  updateFeaturedProduct: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage/admin/featured/${id}`, data).then((response) => ({
      ...response,
      data: response?.data ? normalizeHomepageFeaturedEntry(response.data) : response?.data,
    })),

  removeFeaturedProduct: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/featured/${id}`),

  getProductsForFeaturing: (type?: string) =>
    apiService
      .get<{ success: boolean; data: any[] }>('/homepage/admin/products-for-featured', { params: type ? { type } : undefined })
      .then((response) => ({
        ...response,
        data: Array.isArray(response?.data)
          ? response.data.map((entry) => ({
              ...entry,
              image: resolveApiAssetUrl(entry?.image || entry?.images?.[0] || ''),
              images: Array.isArray(entry?.images) ? entry.images.map((image: any) => resolveApiAssetUrl(image)) : entry?.images,
            }))
          : [],
      })),
};

type AuthPageSettingsPayload = {
  brandName: string;
  loginHeroImage: string;
  registerHeroImage: string;
  forgotPasswordHeroImage: string;
  loginHeroCaption: string;
  registerHeroCaption: string;
  forgotPasswordHeroCaption: string;
  loginTitle: string;
  loginSubtitle: string;
  registerTitle: string;
  registerSubtitle: string;
  forgotPasswordTitle: string;
  forgotPasswordSubtitle: string;
  loginSubmitLabel: string;
  registerSubmitLabel: string;
  forgotPasswordSubmitLabel: string;
  googleClientIds: string;
  showGoogleOnLogin: boolean;
  showGoogleOnRegister: boolean;
};
type DashboardClockWeatherSettingsPayload = {
  showClock: boolean;
  showDate: boolean;
  showAmPm: boolean;
  showGmt: boolean;
  showSeconds: boolean;
  showTimeZoneName: boolean;
  showWeather: boolean;
  weatherLocationMode: 'AUTO_USER_COUNTRY' | 'CUSTOM_LOCATION';
  customWeatherLocation: string;
  weatherUnit: 'C' | 'F';
  weatherRefreshSeconds: number;
};

const AUTH_PAGE_SETTINGS_DEFAULTS: AuthPageSettingsPayload = {
  brandName: 'ZuriKaribu',
  loginHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  registerHeroImage:
    'https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=80',
  forgotPasswordHeroImage:
    'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=80',
  loginHeroCaption: 'Wear the Story of Africa',
  registerHeroCaption: 'Wear the Story of Africa',
  forgotPasswordHeroCaption: 'Secure your African fashion account',
  loginTitle: 'Welcome Back',
  loginSubtitle: 'Sign in to continue your African fashion journey',
  registerTitle: 'Create Account',
  registerSubtitle: 'Join African fashion marketplace',
  forgotPasswordTitle: 'Forgot Password',
  forgotPasswordSubtitle: 'Enter your email to receive a secure reset link.',
  loginSubmitLabel: 'Sign In',
  registerSubmitLabel: 'Create Account',
  forgotPasswordSubmitLabel: 'Send Reset Link',
  googleClientIds: '',
  showGoogleOnLogin: true,
  showGoogleOnRegister: true,
};
const DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS: DashboardClockWeatherSettingsPayload = {
  showClock: true,
  showDate: true,
  showAmPm: true,
  showGmt: true,
  showSeconds: true,
  showTimeZoneName: true,
  showWeather: true,
  weatherLocationMode: 'AUTO_USER_COUNTRY',
  customWeatherLocation: '',
  weatherUnit: 'C',
  weatherRefreshSeconds: 600,
};

const normalizeAuthPageSettingsPayload = (raw: unknown): AuthPageSettingsPayload => {
  if (!raw || typeof raw !== 'object') return { ...AUTH_PAGE_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const readText = (key: keyof AuthPageSettingsPayload, maxLength: number, fallback: string) =>
    String(row[key] ?? '').trim().slice(0, maxLength) || fallback;
  const readImage = (key: keyof AuthPageSettingsPayload, fallback: string) => {
    const rawValue = String(row[key] ?? '').trim();
    return resolveApiAssetUrl(rawValue || fallback);
  };
  return {
    brandName: readText('brandName', 80, AUTH_PAGE_SETTINGS_DEFAULTS.brandName),
    loginHeroImage: readImage('loginHeroImage', AUTH_PAGE_SETTINGS_DEFAULTS.loginHeroImage),
    registerHeroImage: readImage('registerHeroImage', AUTH_PAGE_SETTINGS_DEFAULTS.registerHeroImage),
    forgotPasswordHeroImage: readImage('forgotPasswordHeroImage', AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroImage),
    loginHeroCaption: readText('loginHeroCaption', 200, AUTH_PAGE_SETTINGS_DEFAULTS.loginHeroCaption),
    registerHeroCaption: readText('registerHeroCaption', 200, AUTH_PAGE_SETTINGS_DEFAULTS.registerHeroCaption),
    forgotPasswordHeroCaption: readText(
      'forgotPasswordHeroCaption',
      200,
      AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordHeroCaption
    ),
    loginTitle: readText('loginTitle', 120, AUTH_PAGE_SETTINGS_DEFAULTS.loginTitle),
    loginSubtitle: readText('loginSubtitle', 240, AUTH_PAGE_SETTINGS_DEFAULTS.loginSubtitle),
    registerTitle: readText('registerTitle', 120, AUTH_PAGE_SETTINGS_DEFAULTS.registerTitle),
    registerSubtitle: readText('registerSubtitle', 240, AUTH_PAGE_SETTINGS_DEFAULTS.registerSubtitle),
    forgotPasswordTitle: readText('forgotPasswordTitle', 120, AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordTitle),
    forgotPasswordSubtitle: readText(
      'forgotPasswordSubtitle',
      240,
      AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordSubtitle
    ),
    loginSubmitLabel: readText('loginSubmitLabel', 60, AUTH_PAGE_SETTINGS_DEFAULTS.loginSubmitLabel),
    registerSubmitLabel: readText('registerSubmitLabel', 60, AUTH_PAGE_SETTINGS_DEFAULTS.registerSubmitLabel),
    forgotPasswordSubmitLabel: readText(
      'forgotPasswordSubmitLabel',
      80,
      AUTH_PAGE_SETTINGS_DEFAULTS.forgotPasswordSubmitLabel
    ),
    googleClientIds:
      readText('googleClientIds', 2000, '') || readText('googleClientId', 300, AUTH_PAGE_SETTINGS_DEFAULTS.googleClientIds),
    showGoogleOnLogin:
      typeof row.showGoogleOnLogin === 'boolean'
        ? row.showGoogleOnLogin
        : AUTH_PAGE_SETTINGS_DEFAULTS.showGoogleOnLogin,
    showGoogleOnRegister:
      typeof row.showGoogleOnRegister === 'boolean'
        ? row.showGoogleOnRegister
        : AUTH_PAGE_SETTINGS_DEFAULTS.showGoogleOnRegister,
  };
};
const normalizeDashboardClockWeatherSettingsPayload = (raw: unknown): DashboardClockWeatherSettingsPayload => {
  if (!raw || typeof raw !== 'object') return { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS };
  const row = raw as Record<string, unknown>;
  const asBoolean = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);
  const asNumber = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
  };
  const showClock = asBoolean(row.showClock, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showClock);
  let showAmPm = asBoolean(row.showAmPm, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showAmPm);
  let showGmt = asBoolean(row.showGmt, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showGmt);
  if (showClock && !showAmPm && !showGmt) {
    showAmPm = true;
    showGmt = true;
  }
  return {
    showClock,
    showDate: asBoolean(row.showDate, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showDate),
    showAmPm,
    showGmt,
    showSeconds: asBoolean(row.showSeconds, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showSeconds),
    showTimeZoneName: asBoolean(row.showTimeZoneName, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showTimeZoneName),
    showWeather: asBoolean(row.showWeather, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.showWeather),
    weatherLocationMode:
      String(row.weatherLocationMode || '').trim().toUpperCase() === 'CUSTOM_LOCATION'
        ? 'CUSTOM_LOCATION'
        : 'AUTO_USER_COUNTRY',
    customWeatherLocation: String(row.customWeatherLocation ?? '').trim().slice(0, 120),
    weatherUnit: String(row.weatherUnit || '').trim().toUpperCase() === 'F' ? 'F' : 'C',
    weatherRefreshSeconds: Math.max(
      60,
      Math.min(3600, Math.round(asNumber(row.weatherRefreshSeconds, DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS.weatherRefreshSeconds)))
    ),
  };
};

const authPageSettingsReadPathsPublic = [
  '/homepage-sections/auth-page-settings',
  '/homepage/auth-page-settings',
];
const dashboardClockWeatherSettingsReadPathsPublic = [
  '/homepage-sections/dashboard-clock-weather-settings',
];
const dashboardClockWeatherSettingsReadPathsAdmin = [
  '/homepage-sections/admin/dashboard-clock-weather-settings',
];
const dashboardClockWeatherSettingsWritePaths = [
  '/homepage-sections/admin/dashboard-clock-weather-settings',
];
const authPageSettingsReadPathsAdmin = [
  '/homepage-sections/admin/auth-page-settings',
  '/homepage/admin/auth-page-settings',
  '/admin/auth-page-settings',
  '/admin/homepage/auth-page-settings',
  '/admin/homepage-sections/auth-page-settings',
];
const authPageSettingsWritePaths = [
  '/homepage-sections/admin/auth-page-settings',
  '/homepage/admin/auth-page-settings',
  '/admin/auth-page-settings',
  '/admin/homepage/auth-page-settings',
  '/admin/homepage-sections/auth-page-settings',
];

async function readAuthPageSettingsWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths = mode === 'admin'
    ? [...authPageSettingsReadPathsAdmin, ...authPageSettingsReadPathsPublic]
    : [...authPageSettingsReadPathsPublic];
  for (const path of readPaths) {
    try {
      const response = await apiService.get<T>(path);
      const normalized = normalizeAuthPageSettingsPayload((response as any)?.data);
      return {
        ...(response as any),
        data: normalized,
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (mode === 'public') {
    return {
      success: true,
      data: { ...AUTH_PAGE_SETTINGS_DEFAULTS },
    } as T;
  }
  throw lastError ?? new Error('Auth page settings route not found.');
}

async function writeAuthPageSettingsWithFallback<T>(data: unknown) {
  const normalized = normalizeAuthPageSettingsPayload(data);
  let lastError: unknown = null;
  for (const path of authPageSettingsWritePaths) {
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
  throw lastError ?? new Error('Auth page settings route not found.');
}
async function readDashboardClockWeatherSettingsWithFallback<T>(mode: 'admin' | 'public') {
  let lastError: unknown = null;
  const readPaths =
    mode === 'admin'
      ? [...dashboardClockWeatherSettingsReadPathsAdmin, ...dashboardClockWeatherSettingsReadPathsPublic]
      : [...dashboardClockWeatherSettingsReadPathsPublic];
  for (const path of readPaths) {
    try {
      const response = await apiService.get<T>(path);
      const normalized = normalizeDashboardClockWeatherSettingsPayload((response as any)?.data);
      return {
        ...(response as any),
        data: normalized,
      } as T;
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (mode === 'public') {
    return {
      success: true,
      data: { ...DASHBOARD_CLOCK_WEATHER_SETTINGS_DEFAULTS },
    } as T;
  }
  throw lastError ?? new Error('Dashboard clock/weather settings route not found.');
}
async function writeDashboardClockWeatherSettingsWithFallback<T>(data: unknown) {
  const normalized = normalizeDashboardClockWeatherSettingsPayload(data);
  let lastError: unknown = null;
  for (const path of dashboardClockWeatherSettingsWritePaths) {
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
  throw lastError ?? new Error('Dashboard clock/weather settings route not found.');
}

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
  getAuthPageSettings: () =>
    readAuthPageSettingsWithFallback<{
      success: boolean;
      data: AuthPageSettingsPayload;
    }>('public'),
  getDashboardClockWeatherSettings: () =>
    readDashboardClockWeatherSettingsWithFallback<{
      success: boolean;
      data: DashboardClockWeatherSettingsPayload;
    }>('public'),
  getExperienceSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabledModes: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
        defaultMode: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
        allowUserModeOverride: boolean;
        adaptiveByDevice: boolean;
        adaptiveByConnection: boolean;
        respectReducedMotion: boolean;
        themeModes: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
        defaultThemeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
        tokenSet: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
        heroVariant: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
        categoryEntryVariant: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
        spotlightVariant: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
        homepageTemplate: 'LEGACY' | 'JENKS';
        rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
        allowPreviewQuery: boolean;
        previewQueryParam: string;
        legacyHomepageEnabled: boolean;
        requireReasonForRuntimeActions: boolean;
        trustBadges: Array<{
          title: string;
          subtitle: string;
          icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
          enabled: boolean;
        }>;
        kimiCopy: {
          heroEyebrow: string;
          shopByEyebrow: string;
          shopByTitle: string;
          featuredRtwTitle: string;
          featuredFabricsTitle: string;
          featuredDesignsTitle: string;
          designerSpotlightTitle: string;
          quickPathRtwLabel: string;
          quickPathCustomLabel: string;
          quickPathFabricsLabel: string;
        };
      };
    }>('/homepage-sections/experience-settings'),
  getNavigationSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        logoMode: 'TEXT' | 'IMAGE';
        logoText: string;
        logoImageUrl: string;
        logoAltText: string;
        logoWidth: number;
        logoHeight: number;
        leftMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        rightMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        hamburgerMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        showHamburger: boolean;
        showSearchIcon: boolean;
        showCartIcon: boolean;
        showProfileIcon: boolean;
        showCurrencySelector: boolean;
        showExperienceModeSelector: boolean;
        showThemeModeSelector: boolean;
      };
    }>('/homepage-sections/navigation-settings'),
  getHeroSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        rotationSeconds: number;
        forceUppercaseCtas: boolean;
        ctaTarget: 'SAME_TAB' | 'NEW_TAB';
        showQuickLinks: boolean;
        quickLinks: Array<{ label: string; href: string }>;
      };
    }>('/homepage-sections/hero-settings'),
  getJenksHomepagePayload: () =>
    apiService.get<{
      success: boolean;
      data: {
        contractVersion: string;
        generatedAt: string;
        payloadChecksum: string;
        visibility: Record<string, boolean>;
        topStrip: {
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
        statsStrip: {
          items: Array<{ value: string; suffix?: string; label: string; displayOrder?: number; isActive?: boolean }>;
          backgroundImage?: string;
          backgroundColor?: string;
          overlayColor?: string;
          overlayOpacity?: number;
          valueColor?: string;
          suffixColor?: string;
          labelColor?: string;
        };
        howItWorksStyle: {
          enabled: boolean;
          iconColor: string;
          iconHoverColor: string;
        };
        featuredProductDescription: { wordLimit: number };
        authPageSettings: AuthPageSettingsPayload;
        experienceSettings: {
          enabledModes: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
          defaultMode: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
          allowUserModeOverride: boolean;
          adaptiveByDevice: boolean;
          adaptiveByConnection: boolean;
          respectReducedMotion: boolean;
          themeModes: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
          defaultThemeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
          tokenSet: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
          heroVariant: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
          categoryEntryVariant: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
          spotlightVariant: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
          legacyHomepageEnabled: boolean;
          requireReasonForRuntimeActions: boolean;
          trustBadges: Array<{
            title: string;
            subtitle: string;
            icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
            enabled: boolean;
          }>;
          kimiCopy: {
            heroEyebrow: string;
            shopByEyebrow: string;
            shopByTitle: string;
            featuredRtwTitle: string;
            featuredFabricsTitle: string;
            featuredDesignsTitle: string;
            designerSpotlightTitle: string;
            quickPathRtwLabel: string;
            quickPathCustomLabel: string;
            quickPathFabricsLabel: string;
          };
        };
        navigationSettings: {
          logoMode: 'TEXT' | 'IMAGE';
          logoText: string;
          logoImageUrl: string;
          logoAltText: string;
          logoWidth: number;
          logoHeight: number;
          leftMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
          rightMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
          hamburgerMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
          showHamburger: boolean;
          showSearchIcon: boolean;
          showCartIcon: boolean;
          showProfileIcon: boolean;
          showCurrencySelector: boolean;
          showExperienceModeSelector: boolean;
          showThemeModeSelector: boolean;
        };
        heroSettings: {
          rotationSeconds: number;
          forceUppercaseCtas: boolean;
          ctaTarget: 'SAME_TAB' | 'NEW_TAB';
          showQuickLinks: boolean;
          quickLinks: Array<{ label: string; href: string }>;
        };
        heroSlides: any[];
        managedBanners: any[];
        promoBadge: { valueText: string; labelText: string };
        countries: any[];
        categories: any[];
        howItWorks: any[];
        designerSpotlights: any[];
        featuredCollections: {
          FEATURED_DESIGNS: any[];
          FEATURED_FABRICS: any[];
          FEATURED_READY_TO_WEAR: any[];
          TRENDING_NOW: any[];
        };
        heritage: any;
        testimonials: any[];
        footer: any;
        shopByBlocks: {
          title: string;
          subtitle: string;
          styleOptions: Array<{ label: string; href: string }>;
          priceOptions: Array<{ label: string; href: string }>;
          enabledTabs: Array<'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE'>;
          defaultTab: 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
        };
        freshDrops: {
          eyebrow: string;
          title: string;
          subtitle: string;
          ctaText: string;
          ctaLink: string;
          badgeValueText: string;
          badgeLabelText: string;
          showBadge: boolean;
        };
        newsletter: {
          enabled: boolean;
          title: string;
          subtitle: string;
          emailPlaceholder: string;
          submitLabel: string;
          successMessage: string;
          duplicateMessage: string;
          subscribeEndpoint: string;
        };
      };
    }>('/homepage-sections/jenks-homepage-payload'),
  subscribeHomepageNewsletter: (payload: { email: string; source?: string; metadata?: Record<string, unknown> }) =>
    apiService.post<{
      success: boolean;
      data?: { status: 'SUBSCRIBED' | 'ALREADY_SUBSCRIBED'; email: string };
      message?: string;
    }>('/homepage-sections/newsletter-subscribe', payload),

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
  getAdminAuthPageSettings: () =>
    readAuthPageSettingsWithFallback<{
      success: boolean;
      data: AuthPageSettingsPayload & { source?: 'DATABASE' | 'DEFAULT'; updatedAt?: string | null };
    }>('admin'),
  getAdminDashboardClockWeatherSettings: () =>
    readDashboardClockWeatherSettingsWithFallback<{
      success: boolean;
      data: DashboardClockWeatherSettingsPayload & { source?: 'DATABASE' | 'DEFAULT'; updatedAt?: string | null };
    }>('admin'),
  getAdminShopByBlocksSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        title: string;
        subtitle: string;
        styleOptions: Array<{ label: string; href: string }>;
        priceOptions: Array<{ label: string; href: string }>;
        enabledTabs: Array<'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE'>;
        defaultTab: 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/shop-by-blocks-settings'),
  getAdminFreshDropsSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        eyebrow: string;
        title: string;
        subtitle: string;
        ctaText: string;
        ctaLink: string;
        badgeValueText: string;
        badgeLabelText: string;
        showBadge: boolean;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/fresh-drops-settings'),
  getAdminNewsletterSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        title: string;
        subtitle: string;
        emailPlaceholder: string;
        submitLabel: string;
        successMessage: string;
        duplicateMessage: string;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/newsletter-settings'),
  getAdminNavigationSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        logoMode: 'TEXT' | 'IMAGE';
        logoText: string;
        logoImageUrl: string;
        logoAltText: string;
        logoWidth: number;
        logoHeight: number;
        leftMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        rightMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        hamburgerMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        showHamburger: boolean;
        showSearchIcon: boolean;
        showCartIcon: boolean;
        showProfileIcon: boolean;
        showCurrencySelector: boolean;
        showExperienceModeSelector: boolean;
        showThemeModeSelector: boolean;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/navigation-settings'),
  getAdminHeroSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        rotationSeconds: number;
        forceUppercaseCtas: boolean;
        ctaTarget: 'SAME_TAB' | 'NEW_TAB';
        showQuickLinks: boolean;
        quickLinks: Array<{ label: string; href: string }>;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/hero-settings'),
  getAdminExperienceSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabledModes: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
        defaultMode: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
        allowUserModeOverride: boolean;
        adaptiveByDevice: boolean;
        adaptiveByConnection: boolean;
        respectReducedMotion: boolean;
        themeModes: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
        defaultThemeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
        tokenSet: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
        heroVariant: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
        categoryEntryVariant: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
        spotlightVariant: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
        homepageTemplate: 'LEGACY' | 'JENKS';
        rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
        allowPreviewQuery: boolean;
        previewQueryParam: string;
        legacyHomepageEnabled: boolean;
        trustBadges: Array<{
          title: string;
          subtitle: string;
          icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
          enabled: boolean;
        }>;
        kimiCopy: {
          heroEyebrow: string;
          shopByEyebrow: string;
          shopByTitle: string;
          featuredRtwTitle: string;
          featuredFabricsTitle: string;
          featuredDesignsTitle: string;
          designerSpotlightTitle: string;
          quickPathRtwLabel: string;
          quickPathCustomLabel: string;
          quickPathFabricsLabel: string;
        };
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>('/homepage-sections/admin/experience-settings'),
  getAdminRuntimeHealth: () =>
    apiService.get<{
      success: boolean;
      data: {
        runtime: {
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
          legacyHomepageEnabled: boolean;
        };
        runtimeHealth: {
          ok: boolean;
          checkedAt: string;
          checks: Array<{
            key: string;
            label: string;
            status: 'PASS' | 'WARN' | 'FAIL';
            detail: string;
          }>;
        };
      };
    }>('/homepage-sections/admin/runtime-health'),
  dryRunAdminRuntimeHealth: (data: {
    homepageTemplate?: 'LEGACY' | 'JENKS';
    rolloutMode?: 'LIVE' | 'PREVIEW_SAFE';
    allowPreviewQuery?: boolean;
    previewQueryParam?: string;
    legacyHomepageEnabled?: boolean;
  }) =>
    apiService.post<{
      success: boolean;
      data: {
        runtime: {
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
          legacyHomepageEnabled: boolean;
        };
        runtimeHealth: {
          ok: boolean;
          checkedAt: string;
          checks: Array<{
            key: string;
            label: string;
            status: 'PASS' | 'WARN' | 'FAIL';
            detail: string;
          }>;
        };
      };
    }>('/homepage-sections/admin/runtime-health/dry-run', data),
  getAdminRuntimeAudit: (options?: {
    limit?: number;
    action?: 'RUNTIME_SWITCH' | 'RUNTIME_ROLLBACK';
    performedByEmail?: string;
    from?: string;
    to?: string;
  }) =>
    apiService.get<{
      success: boolean;
      data: Array<{
        id: string;
        action: 'RUNTIME_SWITCH' | 'RUNTIME_ROLLBACK';
        reason: string;
        previous: {
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
          legacyHomepageEnabled: boolean;
        };
        next: {
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
          legacyHomepageEnabled: boolean;
        };
        healthSummary: {
          ok: boolean;
          checkedAt: string;
          checks: Array<{
            key: string;
            label: string;
            status: 'PASS' | 'WARN' | 'FAIL';
            detail: string;
          }>;
        } | null;
        metadata: Record<string, unknown>;
        performedByUserId: string | null;
        performedByEmail: string | null;
        createdAt: string | null;
      }>;
    }>(
      (() => {
        const params = new URLSearchParams();
        params.set('limit', String(Math.max(1, Math.min(100, Math.floor(Number(options?.limit) || 25)))));
        if (options?.action) params.set('action', options.action);
        if (options?.performedByEmail) params.set('performedByEmail', String(options.performedByEmail).trim());
        if (options?.from) params.set('from', options.from);
        if (options?.to) params.set('to', options.to);
        return `/homepage-sections/admin/runtime-audit?${params.toString()}`;
      })()
    ),
  downloadAdminRuntimeAuditCsv: (options?: {
    limit?: number;
    action?: 'RUNTIME_SWITCH' | 'RUNTIME_ROLLBACK';
    performedByEmail?: string;
    from?: string;
    to?: string;
  }) =>
    httpClient
      .get<Blob>(
        (() => {
          const params = new URLSearchParams();
          params.set('limit', String(Math.max(1, Math.min(5000, Math.floor(Number(options?.limit) || 1000)))));
          if (options?.action) params.set('action', options.action);
          if (options?.performedByEmail) params.set('performedByEmail', String(options.performedByEmail).trim());
          if (options?.from) params.set('from', options.from);
          if (options?.to) params.set('to', options.to);
          return `/homepage-sections/admin/runtime-audit/export?${params.toString()}`;
        })(),
        { responseType: 'blob' }
      )
      .then((res) => res.data),
  rollbackAdminRuntime: (data?: { auditId?: string; reason?: string }) =>
    apiService.post<{
      success: boolean;
      data: {
        settings: {
          homepageTemplate: 'LEGACY' | 'JENKS';
          rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
          allowPreviewQuery: boolean;
          previewQueryParam: string;
        } & Record<string, unknown>;
        rolledBackFromAuditId: string;
      };
      message?: string;
    }>('/homepage-sections/admin/runtime-rollback', data || {}),
  updateAdminExperienceSettings: (data: {
    enabledModes?: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
    defaultMode?: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
    allowUserModeOverride?: boolean;
    adaptiveByDevice?: boolean;
    adaptiveByConnection?: boolean;
    respectReducedMotion?: boolean;
    themeModes?: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
    defaultThemeMode?: 'SYSTEM' | 'LIGHT' | 'DARK';
    tokenSet?: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
    heroVariant?: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
    categoryEntryVariant?: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
    spotlightVariant?: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
    homepageTemplate?: 'LEGACY' | 'JENKS';
    rolloutMode?: 'LIVE' | 'PREVIEW_SAFE';
    allowPreviewQuery?: boolean;
    previewQueryParam?: string;
    legacyHomepageEnabled?: boolean;
    requireReasonForRuntimeActions?: boolean;
    changeReason?: string;
    trustBadges?: Array<{
      title: string;
      subtitle: string;
      icon?: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
      enabled?: boolean;
    }>;
    kimiCopy?: {
      heroEyebrow?: string;
      shopByEyebrow?: string;
      shopByTitle?: string;
      featuredRtwTitle?: string;
      featuredFabricsTitle?: string;
      featuredDesignsTitle?: string;
      designerSpotlightTitle?: string;
      quickPathRtwLabel?: string;
      quickPathCustomLabel?: string;
      quickPathFabricsLabel?: string;
    };
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        enabledModes: Array<'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE'>;
        defaultMode: 'LITE_COMMERCE' | 'STANDARD_PREMIUM' | 'EDITORIAL_IMMERSIVE';
        allowUserModeOverride: boolean;
        adaptiveByDevice: boolean;
        adaptiveByConnection: boolean;
        respectReducedMotion: boolean;
        themeModes: Array<'SYSTEM' | 'LIGHT' | 'DARK'>;
        defaultThemeMode: 'SYSTEM' | 'LIGHT' | 'DARK';
        tokenSet: 'GLOBAL_PREMIUM_DARK' | 'GLOBAL_PREMIUM_LIGHT' | 'AFRO_EDITORIAL';
        heroVariant: 'SPLIT_EDITORIAL' | 'CLEAN_COMMERCE' | 'VIDEO_STORY';
        categoryEntryVariant: 'THREE_COLUMN_CORE' | 'MEGA_GRID';
        spotlightVariant: 'CAROUSEL' | 'SINGLE_FEATURE' | 'MOSAIC';
        homepageTemplate: 'LEGACY' | 'JENKS';
        rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
        allowPreviewQuery: boolean;
        previewQueryParam: string;
        legacyHomepageEnabled: boolean;
        requireReasonForRuntimeActions: boolean;
        trustBadges: Array<{
          title: string;
          subtitle: string;
          icon: 'SHIELD_CHECK' | 'TRUCK' | 'REFRESH_CW' | 'HEADPHONES' | 'GLOBE' | 'SHOPPING_BAG';
          enabled: boolean;
        }>;
        kimiCopy: {
          heroEyebrow: string;
          shopByEyebrow: string;
          shopByTitle: string;
          featuredRtwTitle: string;
          featuredFabricsTitle: string;
          featuredDesignsTitle: string;
          designerSpotlightTitle: string;
          quickPathRtwLabel: string;
          quickPathCustomLabel: string;
          quickPathFabricsLabel: string;
        };
      };
      runtimeHealth?: {
        ok: boolean;
        checkedAt: string;
        checks: Array<{
          key: string;
          label: string;
          status: 'PASS' | 'WARN' | 'FAIL';
          detail: string;
        }>;
      } | null;
    }>('/homepage-sections/admin/experience-settings', data),
  updateAdminAuthPageSettings: (data: Partial<AuthPageSettingsPayload>) =>
    writeAuthPageSettingsWithFallback<{
      success: boolean;
      data: AuthPageSettingsPayload;
    }>(data),
  updateAdminDashboardClockWeatherSettings: (data: Partial<DashboardClockWeatherSettingsPayload>) =>
    writeDashboardClockWeatherSettingsWithFallback<{
      success: boolean;
      data: DashboardClockWeatherSettingsPayload;
    }>(data),
  updateAdminShopByBlocksSettings: (data: {
    title?: string;
    subtitle?: string;
    styleOptions?: Array<{ label: string; href: string }>;
    priceOptions?: Array<{ label: string; href: string }>;
    enabledTabs?: Array<'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE'>;
    defaultTab?: 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        title: string;
        subtitle: string;
        styleOptions: Array<{ label: string; href: string }>;
        priceOptions: Array<{ label: string; href: string }>;
        enabledTabs: Array<'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE'>;
        defaultTab: 'CATEGORY' | 'COUNTRY' | 'OCCASION_STYLE' | 'PRICE';
      };
    }>('/homepage-sections/admin/shop-by-blocks-settings', data),
  updateAdminFreshDropsSettings: (data: {
    eyebrow?: string;
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    badgeValueText?: string;
    badgeLabelText?: string;
    showBadge?: boolean;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        eyebrow: string;
        title: string;
        subtitle: string;
        ctaText: string;
        ctaLink: string;
        badgeValueText: string;
        badgeLabelText: string;
        showBadge: boolean;
      };
    }>('/homepage-sections/admin/fresh-drops-settings', data),
  updateAdminNewsletterSettings: (data: {
    enabled?: boolean;
    title?: string;
    subtitle?: string;
    emailPlaceholder?: string;
    submitLabel?: string;
    successMessage?: string;
    duplicateMessage?: string;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        enabled: boolean;
        title: string;
        subtitle: string;
        emailPlaceholder: string;
        submitLabel: string;
        successMessage: string;
        duplicateMessage: string;
      };
    }>('/homepage-sections/admin/newsletter-settings', data),
  updateAdminNavigationSettings: (data: {
    logoMode?: 'TEXT' | 'IMAGE';
    logoText?: string;
    logoImageUrl?: string;
    logoAltText?: string;
    logoWidth?: number;
    logoHeight?: number;
    leftMenuLinks?: Array<{ label: string; href: string; enabled?: boolean }>;
    rightMenuLinks?: Array<{ label: string; href: string; enabled?: boolean }>;
    hamburgerMenuLinks?: Array<{ label: string; href: string; enabled?: boolean }>;
    showHamburger?: boolean;
    showSearchIcon?: boolean;
    showCartIcon?: boolean;
    showProfileIcon?: boolean;
    showCurrencySelector?: boolean;
    showExperienceModeSelector?: boolean;
    showThemeModeSelector?: boolean;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        logoMode: 'TEXT' | 'IMAGE';
        logoText: string;
        logoImageUrl: string;
        logoAltText: string;
        logoWidth: number;
        logoHeight: number;
        leftMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        rightMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        hamburgerMenuLinks: Array<{ label: string; href: string; enabled: boolean }>;
        showHamburger: boolean;
        showSearchIcon: boolean;
        showCartIcon: boolean;
        showProfileIcon: boolean;
        showCurrencySelector: boolean;
        showExperienceModeSelector: boolean;
        showThemeModeSelector: boolean;
      };
    }>('/homepage-sections/admin/navigation-settings', data),
  updateAdminHeroSettings: (data: {
    rotationSeconds?: number;
    forceUppercaseCtas?: boolean;
    ctaTarget?: 'SAME_TAB' | 'NEW_TAB';
    showQuickLinks?: boolean;
    quickLinks?: Array<{ label: string; href: string }>;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        rotationSeconds: number;
        forceUppercaseCtas: boolean;
        ctaTarget: 'SAME_TAB' | 'NEW_TAB';
        showQuickLinks: boolean;
        quickLinks: Array<{ label: string; href: string }>;
      };
    }>('/homepage-sections/admin/hero-settings', data),

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

  getEnterpriseConfig: async () => {
    let lastError: unknown = null;
    for (const path of ['/admin/enterprise/config', '/enterprise/config']) {
      try {
        return await apiService.get<{ success: boolean; data: any }>(path);
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new Error('Enterprise config route not found.');
  },

  updateEnterpriseConfig: (payload: {
    sellerEnabled: boolean;
    designerEnabled: boolean;
    enforceSubscription: boolean;
    defaultSeatLimit: number;
    defaultYearlyFeeUsd: number;
    levels: Array<{ key: string; name: string; seatLimit: number; yearlyFeeUsd: number }>;
  }) => apiService.put<{ success: boolean; data: any; message?: string }>('/admin/enterprise/config', payload),

  getEnterpriseAccounts: async (params?: {
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    let lastError: unknown = null;
    for (const path of ['/admin/enterprise/accounts', '/enterprise/accounts']) {
      try {
        return await apiService.get<{ success: boolean; data: any }>(path, { params });
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new Error('Enterprise accounts route not found.');
  },

  convertVendorToEnterprise: (
    ownerUserId: string,
    payload: {
      isEnterprise: boolean;
      status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
      seatLimit?: number;
      yearlyFeeUsd?: number;
      levelName?: string;
      enforceSubscription?: boolean;
    }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/enterprise/accounts/${ownerUserId}/convert`, payload),

  updateEnterpriseSubscription: (
    ownerUserId: string,
    payload: {
      subscriptionStatus: 'INACTIVE' | 'PENDING_PAYMENT' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
      years?: number;
      seatLimit?: number;
      yearlyFeeUsd?: number;
      levelName?: string;
    }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/enterprise/accounts/${ownerUserId}/subscription`, payload),

  getEnterpriseSubAccountsForOwner: (ownerUserId: string) =>
    apiService.get<{ success: boolean; data: any[] }>(`/admin/enterprise/accounts/${ownerUserId}/subaccounts`),

  getEnterpriseUpgradeRequests: async (params?: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    page?: number;
    limit?: number;
  }) => {
    let lastError: unknown = null;
    for (const path of ['/admin/enterprise/upgrade-requests', '/admin/enterprise/requests']) {
      try {
        return await apiService.get<{ success: boolean; data: any }>(path, { params });
      } catch (error) {
        lastError = error;
        if (isRetryableRouteError(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new Error('Enterprise upgrade requests route not found.');
  },

  reviewEnterpriseUpgradeRequest: (
    requestId: string,
    payload: {
      status: 'APPROVED' | 'REJECTED';
      reviewNote?: string;
      approvedLevelName?: string;
      approvedSeatLimit?: number;
      approvedYearlyFeeUsd?: number;
    }
  ) =>
    apiService.patch<{ success: boolean; message?: string }>(`/admin/enterprise/upgrade-requests/${requestId}/review`, payload),

  setEnterpriseSubAccountStatus: (
    subAccountId: string,
    payload: { status: 'ACTIVE' | 'DISABLED' }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/admin/enterprise/subaccounts/${subAccountId}/status`, payload),
};

const promotionsApi = {
  preview: (payload: {
    code: string;
    items: Array<{
      productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      productId: string;
      unitPrice: number;
      quantity: number;
    }>;
    paymentProvider?: string;
    shippingProvider?: string;
    shippingQuoteId?: string;
    cardFingerprint?: string;
    country?: string;
    city?: string;
  }) => previewPromotionWithFallback<{ success: boolean; data?: any; message?: string }>(payload),
  getPostCheckoutOffers: () =>
    apiService.get<{
      success: boolean;
      data: Array<{
        code: string;
        name: string;
        description?: string;
        discountType: 'PERCENTAGE' | 'FIXED';
        discountValue: number;
        maxDiscountUsd?: number | null;
      }>;
    }>('/promotions/post-checkout-offers'),
};

const featuredRequestsApi = {
  getSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        defaultDurationValue: number;
        defaultDurationUnit: 'DAYS' | 'WEEKS' | 'MONTHS';
        basePriceUsdByType: { FABRIC: number; DESIGN: number; READY_TO_WEAR: number };
        allowVendorRequestedDuration: boolean;
        maxDurationValue: number;
      };
    }>('/featured-requests/settings'),

  updateSettings: (data: {
    enabled?: boolean;
    defaultDurationValue?: number;
    defaultDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS';
    basePriceUsdByType?: { FABRIC?: number; DESIGN?: number; READY_TO_WEAR?: number };
    allowVendorRequestedDuration?: boolean;
    maxDurationValue?: number;
  }) => apiService.patch<{ success: boolean; data: any; message?: string }>('/featured-requests/settings', data),

  createRequest: (data: {
    products: Array<{ productId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; section?: string }>;
    requestedDurationValue?: number;
    requestedDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS';
    requestNotes?: string;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/featured-requests/requests', data),

  listMyRequests: () => apiService.get<{ success: boolean; data: any[] }>('/featured-requests/requests/my'),

  createPaymentSession: (
    requestId: string,
    data: { providerKey?: string; returnUrl?: string; cancelUrl?: string }
  ) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(
      `/featured-requests/requests/${requestId}/payment-session`,
      data
    ),

  verifyPayment: (
    requestId: string,
    data: { providerKey?: string; reference?: string; payerId?: string }
  ) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(
      `/featured-requests/requests/${requestId}/payment-verify`,
      data
    ),

  payRequest: (requestId: string, data: { providerKey?: string; paymentReference: string }) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(`/featured-requests/requests/${requestId}/pay`, data),

  listAdminRequests: (params?: {
    status?: string;
    paymentStatus?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: any[]; pagination?: any }>('/featured-requests/admin/requests', { params }),

  reviewAdminRequest: (
    requestId: string,
    data: {
      decision: 'APPROVE' | 'REJECT';
      reviewNotes?: string;
      approvedDurationValue?: number;
      approvedDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS';
      approvedPriceUsd?: number;
    }
  ) => apiService.patch<{ success: boolean; data?: any; message?: string }>(`/featured-requests/admin/requests/${requestId}/review`, data),
};

const productChangeRequestsApi = {
  getPolicy: () =>
    apiService.get<{
      success: boolean;
      data: {
        role: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
        allowedFieldsByProductType: Record<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', string[]>;
        defaultGrantDurationHours: number;
        fieldCatalog: Array<{ key: string; label: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' }>;
      };
    }>('/product-change-requests/policy'),

  listMyRequests: (params?: { status?: string; page?: number; limit?: number }) =>
    apiService.get<{
      success: boolean;
      data: { requests: any[]; pagination: { page: number; limit: number; total: number; pages: number } };
    }>('/product-change-requests/requests/my', { params }),

  createRequest: (payload: {
    productType?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    productId: string;
    message: string;
    requestedFields?: string[];
  }) =>
    apiService.post<{ success: boolean; data?: { id: string }; message?: string }>('/product-change-requests/requests', payload),

  getAdminConfig: () =>
    apiService.get<{
      success: boolean;
      data: {
        defaultGrantDurationHours: number;
        allowedFieldsByRole: Record<'FABRIC_SELLER' | 'FASHION_DESIGNER', Record<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', string[]>>;
        fieldCatalog: Array<{ key: string; label: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' }>;
      };
    }>('/product-change-requests/admin/config'),

  updateAdminConfig: (payload: {
    defaultGrantDurationHours?: number;
    allowedFieldsByRole?: {
      FABRIC_SELLER?: { FABRIC?: string[]; DESIGN?: string[]; READY_TO_WEAR?: string[] };
      FASHION_DESIGNER?: { FABRIC?: string[]; DESIGN?: string[]; READY_TO_WEAR?: string[] };
    };
  }) =>
    apiService.put<{ success: boolean; data?: any; message?: string }>('/product-change-requests/admin/config', payload),

  listAdminRequests: (params?: {
    status?: string;
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    productType?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: { requests: any[]; pagination: { page: number; limit: number; total: number; pages: number } };
    }>('/product-change-requests/admin/requests', { params }),

  reviewAdminRequest: (
    requestId: string,
    payload: {
      status: 'APPROVED' | 'REJECTED';
      reviewNote?: string;
      grantAllChanges?: boolean;
      grantedFields?: string[];
      grantDurationHours?: number;
    }
  ) =>
    apiService.patch<{ success: boolean; message?: string }>(
      `/product-change-requests/admin/requests/${requestId}/review`,
      payload
    ),
};

const messagesApi = {
  getInbox: (params?: { page?: number; limit?: number; unreadOnly?: boolean }) =>
    apiService.get<{
      success: boolean;
      data: {
        messages: Array<{
          id: string;
          source: 'IN_APP' | 'DISPATCH';
          title: string;
          subject: string;
          body: string;
          roleTarget?: string | null;
          userTarget?: string | null;
          sentEmail?: boolean;
          sentPush?: boolean;
          sentInApp?: boolean;
          deliveryStatus?: string;
          isRead?: boolean;
          createdAt: string;
          relatedType?: string | null;
          relatedId?: string | null;
        }>;
        unreadCount: number;
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/messages/inbox', {
      params: {
        ...params,
        unreadOnly: params?.unreadOnly ? 'true' : undefined,
      },
    }),

  markInboxRead: (payload: { notificationIds?: string[]; markAll?: boolean }) =>
    apiService.patch<{ success: boolean; message?: string }>('/messages/inbox/read', payload),
};

const enterpriseApi = {
  getMe: () =>
    apiService.get<{ success: boolean; data: any }>('/enterprise/me'),

  getRoles: () =>
    apiService.get<{ success: boolean; data: any[] }>('/enterprise/roles'),

  createRole: (payload: { key: string; name: string; permissions: string[] }) =>
    apiService.post<{ success: boolean; message?: string }>('/enterprise/roles', payload),

  updateRole: (
    roleId: string,
    payload: { name?: string; permissions?: string[]; isActive?: boolean }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/enterprise/roles/${roleId}`, payload),

  getSubAccounts: () =>
    apiService.get<{ success: boolean; data: any[] }>('/enterprise/subaccounts'),

  createSubAccount: (payload: {
    roleId: string;
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
  }) => apiService.post<{ success: boolean; data?: any; message?: string }>('/enterprise/subaccounts', payload),

  updateSubAccount: (
    subAccountId: string,
    payload: { status?: 'ACTIVE' | 'DISABLED'; roleId?: string }
  ) => apiService.patch<{ success: boolean; message?: string }>(`/enterprise/subaccounts/${subAccountId}`, payload),

  listMyUpgradeRequests: () =>
    apiService.get<{ success: boolean; data: any[] }>('/enterprise/upgrade-requests/my'),

  createUpgradeRequest: (payload: {
    requestedLevelKey?: string;
    requestedYears?: number;
    note?: string;
  }) => apiService.post<{ success: boolean; message?: string }>('/enterprise/upgrade-requests', payload),

  createUpgradePaymentSession: (
    requestId: string,
    payload: { providerKey: string; returnUrl?: string; cancelUrl?: string }
  ) =>
    apiService.post<{ success: boolean; data?: any; message?: string }>(
      `/enterprise/upgrade-requests/${requestId}/payment-session`,
      payload
    ),

  verifyUpgradePayment: (
    requestId: string,
    payload: { providerKey?: string; reference?: string; payerId?: string }
  ) =>
    apiService.post<{ success: boolean; data?: any; message?: string }>(
      `/enterprise/upgrade-requests/${requestId}/payment-verify`,
      payload
    ),
  getActivityLogs: (params?: {
    userQuery?: string;
    action?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{ success: boolean; data: any }>('/enterprise/activity-logs', {
      params,
    }),
};

const referralsApi = {
  getPublicProgramSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        registrationReferralEnabled: boolean;
        defaultReferralCode: string;
        codePrefix?: string;
        codeDigits?: number;
      };
      source?: string;
      updatedAt?: string | null;
    }>('/referrals/program/public'),

  getMyDashboard: (params?: { page?: number; limit?: number }) =>
    apiService.get<{ success: boolean; data: any }>('/referrals/me', { params }),

  getMyProfile: () =>
    apiService.get<{ success: boolean; data: { profile: any; editableFields: string[] } }>('/referrals/me/profile'),

  updateMyProfile: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string | null;
    avatar?: string | null;
    displayName?: string;
  }) => apiService.patch<{ success: boolean; data: { profile: any; editableFields: string[] }; message?: string }>('/referrals/me/profile', data),

  getMyMaterials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/referrals/materials').then((response) => ({
      ...response,
      data: Array.isArray(response?.data)
        ? response.data.map((row: any) => ({
            ...row,
            imageUrl: resolveApiAssetUrl(row?.imageUrl || ''),
          }))
        : [],
    })),
};

const customerServiceApi = {
  getPublicConfig: () =>
    apiService.get<{
      success: boolean;
      data: {
        settings: {
          translationEnabled: boolean;
          defaultLanguage: string;
          chatPopupDelayMinutes: number;
          shoppingBotDelayMinutes: number;
          botEnabled: boolean;
          shoppingBotEnabled: boolean;
          serviceBotEnabled: boolean;
          shoppingBotAvatarFemale: string;
          shoppingBotAvatarMale: string;
        };
        supportedLanguages: Array<{ code: string; label: string }>;
        departments: Array<{ id: string; name: string; code: string; description?: string }>;
      };
    }>('/customer-service/public/config'),

  getSettings: () =>
    apiService.get<{ success: boolean; data: any }>('/customer-service/admin/settings'),
  updateSettings: (payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>('/customer-service/admin/settings', payload),

  listDepartments: () =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/departments'),
  createDepartment: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: any; message?: string }>('/customer-service/admin/departments', payload),
  updateDepartment: (id: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; message?: string }>(`/customer-service/admin/departments/${id}`, payload),

  listRoutingGroups: () =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/ticket-routing/groups'),
  createRoutingGroup: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(
      '/customer-service/admin/ticket-routing/groups',
      payload
    ),
  updateRoutingGroup: (id: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; message?: string }>(
      `/customer-service/admin/ticket-routing/groups/${id}`,
      payload
    ),

  listRoutingRules: () =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/ticket-routing/rules'),
  createRoutingRule: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(
      '/customer-service/admin/ticket-routing/rules',
      payload
    ),
  updateRoutingRule: (id: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; message?: string }>(
      `/customer-service/admin/ticket-routing/rules/${id}`,
      payload
    ),

  listTickets: (params?: Record<string, unknown>) =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/tickets', { params }),
  createTicket: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: any; message?: string }>('/customer-service/admin/tickets', payload),
  getTicketMessages: (ticketRef: string) =>
    apiService.get<{ success: boolean; data: any[] }>(
      `/customer-service/admin/tickets/${encodeURIComponent(ticketRef)}/messages`
    ),
  replyTicket: (ticketRef: string, payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; message?: string }>(
      `/customer-service/admin/tickets/${encodeURIComponent(ticketRef)}/messages`,
      payload
    ),
  assignTicket: (ticketRef: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; message?: string }>(
      `/customer-service/admin/tickets/${encodeURIComponent(ticketRef)}/assign`,
      payload
    ),

  startChat: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: { sessionId: string; token?: string; preferredLanguage: string } }>(
      '/customer-service/chat/start',
      payload
    ),
  getChatThread: (sessionId: string, params?: Record<string, unknown>, token?: string) =>
    apiService.get<{ success: boolean; data: any }>(`/customer-service/chat/${sessionId}`, {
      params,
      headers: token ? { 'x-chat-token': token } : undefined,
    }),
  sendChatMessage: (sessionId: string, payload: Record<string, unknown>, token?: string) =>
    apiService.post<{ success: boolean; data: any }>(`/customer-service/chat/${sessionId}/messages`, payload, {
      headers: token ? { 'x-chat-token': token } : undefined,
    }),

  listAdminChats: (params?: Record<string, unknown>) =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/chats', { params }),
  applyAdminChatAction: (sessionId: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; message?: string }>(
      `/customer-service/admin/chats/${sessionId}/actions`,
      payload
    ),

  botRespond: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: any }>('/customer-service/bot/respond', payload),

  getVoipSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        provider: string;
        callBaseUrl: string;
        pbx?: {
          enabled: boolean;
          deploymentMode: 'LOCAL_HOSTED' | 'EXTERNAL_PROVIDER';
          host: string;
          port: number;
          transport: 'UDP' | 'TCP' | 'TLS' | 'WS' | 'WSS';
          webSocketUrl: string;
          realm: string;
          context: string;
          extensionPrefix: string;
          extensionDigits: number;
          extensionNext: number;
          recordingEnabled: boolean;
          codecPreferences: string[];
          emergencyNumbers: string[];
          trunks: any[];
          queues: any[];
        };
        routes?: any[];
        transferTargets?: any[];
      };
    }>(
      '/customer-service/admin/voip/settings'
    ),
  updateVoipSettings: (payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(
      '/customer-service/admin/voip/settings',
      payload
    ),
  startVoipCall: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: { id: string; callLink: string; provider: string } }>(
      '/customer-service/voip/calls/start',
      payload
    ),
  endVoipCall: (id: string) =>
    apiService.post<{ success: boolean; message?: string }>(`/customer-service/voip/calls/${id}/end`),
  listVoipCalls: (params?: Record<string, unknown>) =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/voip/calls', { params }),

  getWhatsAppSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        enabled: boolean;
        businessNumber: string;
        chatBaseUrl: string;
        callBaseUrl: string;
        routes: any[];
      };
    }>('/customer-service/admin/whatsapp/settings'),
  updateWhatsAppSettings: (payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(
      '/customer-service/admin/whatsapp/settings',
      payload
    ),
  listWhatsAppEvents: (params?: Record<string, unknown>) =>
    apiService.get<{ success: boolean; data: any[] }>('/customer-service/admin/whatsapp/events', { params }),
  startWhatsAppSession: (payload: Record<string, unknown>) =>
    apiService.post<{ success: boolean; data: { id: string; eventLink: string; mode: 'CHAT' | 'CALL' } }>(
      '/customer-service/whatsapp/start',
      payload
    ),
  endWhatsAppSession: (id: string) =>
    apiService.post<{ success: boolean; message?: string }>(`/customer-service/whatsapp/events/${id}/end`),
};

const helpCenterApi = {
  getPublic: (audience: 'CUSTOMER' | 'VENDOR' | 'SELLER_DESIGNER' = 'CUSTOMER') =>
    apiService.get<{
      success: boolean;
      data: {
        audience: 'CUSTOMER' | 'VENDOR';
        heroTitle: string;
        heroSubtitle: string;
        supportHint: string;
        faqs: Array<{ id: string; question: string; answer: string; isActive: boolean; sortOrder: number }>;
        articles: Array<{
          id: string;
          title: string;
          summary: string;
          body: string;
          tags: string[];
          isActive: boolean;
          sortOrder: number;
        }>;
        contacts: Array<{
          id: string;
          label: string;
          value: string;
          type: 'EMAIL' | 'PHONE' | 'WHATSAPP' | 'LINK' | 'OTHER';
          isActive: boolean;
          sortOrder: number;
        }>;
      };
    }>(`/help-center/public/${audience.toLowerCase()}`),
  getAdminContent: () =>
    apiService.get<{ success: boolean; data: any }>('/help-center/admin/content'),
  updateAdminContent: (payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(
      '/help-center/admin/content',
      payload
    ),
};

const moduleRuntimeApi = {
  getDecisions: (params?: { keys?: string[] }) =>
    apiService.get<{
      success: boolean;
      data: {
        keys: string[];
        map: Record<
          string,
          {
            moduleKey: string;
            enabled: boolean;
            mode: 'active' | 'degraded' | 'maintenance';
            provider: string;
            rolloutScope: { type: 'GLOBAL' | 'ROLE' | 'PERCENT'; value: string };
            allowed: boolean;
            reason: null | 'MODULE_DISABLED' | 'MODULE_MAINTENANCE' | 'MODULE_SCOPE_BLOCKED';
          }
        >;
      };
    }>('/module-runtime/decisions', {
      params: {
        ...(Array.isArray(params?.keys) && params?.keys.length > 0 ? { keys: params.keys.join(',') } : {}),
      },
    }),
  listAdminModules: () =>
    apiService.get<{ success: boolean; data: any[] }>('/module-runtime/admin/modules'),
  updateAdminModule: (moduleKey: string, payload: Record<string, unknown>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(
      `/module-runtime/admin/modules/${encodeURIComponent(moduleKey)}`,
      payload
    ),
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
  shipping: shippingApi,
  banners: bannersApi,
  upload: uploadApi,
  homepage: homepageApi,
  homepageSections: homepageSectionsApi,
  blogs: blogsApi,
  promotions: promotionsApi,
  featuredRequests: featuredRequestsApi,
  productChangeRequests: productChangeRequestsApi,
  messages: messagesApi,
  enterprise: enterpriseApi,
  referrals: referralsApi,
  customerService: customerServiceApi,
  helpCenter: helpCenterApi,
  moduleRuntime: moduleRuntimeApi,
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
  shippingApi,
  bannersApi,
  uploadApi,
  homepageApi,
  homepageSectionsApi,
  blogsApi,
  promotionsApi,
  featuredRequestsApi,
  productChangeRequestsApi,
  messagesApi,
  enterpriseApi,
  referralsApi,
  customerServiceApi,
  helpCenterApi,
  moduleRuntimeApi,
  apiService,
  httpClient,
};

export default api;
