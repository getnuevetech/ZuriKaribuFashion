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

const noCacheRequestConfig = () => ({
  params: { _r: Date.now() },
  headers: {
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Pragma: 'no-cache',
    Expires: '0',
  },
});

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
      return await apiService.get<T>(path, noCacheRequestConfig());
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
      return await apiService.get<T>(path, noCacheRequestConfig());
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
      return await apiService.get<T>(path, noCacheRequestConfig());
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

const MEASUREMENT_TEMPLATES_FALLBACK_KEY = 'af_measurement_templates_fallback_v1';
const READY_TO_WEAR_SIZES_FALLBACK_KEY = 'af_ready_to_wear_sizes_fallback_v1';
const READY_TO_WEAR_SIZE_GUIDE_FALLBACK_KEY = 'af_ready_to_wear_size_guide_fallback_v1';

const READY_TO_WEAR_SIZES_DEFAULT: Array<ReadyToWearStandardSize> = ['S', 'M', 'L', 'XL'];
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

const readReadyToWearSizesFallback = (): { sizes: Array<ReadyToWearStandardSize> } => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { sizes: [...READY_TO_WEAR_SIZES_DEFAULT] };
  }
  try {
    const raw = window.localStorage.getItem(READY_TO_WEAR_SIZES_FALLBACK_KEY);
    if (!raw) return { sizes: [...READY_TO_WEAR_SIZES_DEFAULT] };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      sizes: normalizeReadyToWearSizes(parsed?.sizes),
    };
  } catch {
    return { sizes: [...READY_TO_WEAR_SIZES_DEFAULT] };
  }
};
const writeReadyToWearSizesFallback = (sizes: Array<ReadyToWearStandardSize>) => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(
      READY_TO_WEAR_SIZES_FALLBACK_KEY,
      JSON.stringify({ sizes: normalizeReadyToWearSizes(sizes) })
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
      const normalized = normalizeReadyToWearSizes(response?.data?.sizes);
      writeReadyToWearSizesFallback(normalized);
      return {
        success: true,
        data: { sizes: normalized },
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

async function writeReadyToWearSizesSettingsWithFallback<T>(sizes: Array<ReadyToWearStandardSize>) {
  const normalized = normalizeReadyToWearSizes(sizes);
  let lastError: unknown = null;
  for (const path of ['/admin/ready-to-wear-sizes', '/admin/readytowear-sizes']) {
    try {
      const response = await apiService.put<any>(path, { sizes: normalized });
      writeReadyToWearSizesFallback(normalized);
      return (response || { success: true, data: { sizes: normalized } }) as T;
    } catch (putError) {
      lastError = putError;
      if (!isRetryableRouteError(putError)) throw putError;
    }
    try {
      const response = await apiService.patch<any>(path, { sizes: normalized });
      writeReadyToWearSizesFallback(normalized);
      return (response || { success: true, data: { sizes: normalized } }) as T;
    } catch (patchError) {
      lastError = patchError;
      if (!isRetryableRouteError(patchError)) throw patchError;
    }
  }
  if (isRetryableRouteError(lastError)) {
    writeReadyToWearSizesFallback(normalized);
    return {
      success: true,
      data: { sizes: normalized },
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
        publishableKey: String(import.meta.env.VITE_STRIPE_PUBLIC_KEY || ''),
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

async function readPaymentOptionsWithFallback<T>() {
  try {
    return await apiService.get<T>('/payments/options', noCacheRequestConfig());
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    const state = readPaymentFallbackState();
    const providers = (state.providers || [])
      .filter((provider: any) => Boolean(provider.isActive))
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
  currency: string;
  reference?: string;
  returnUrl?: string;
  cancelUrl?: string;
  customer?: { email?: string; name?: string; phone?: string };
}) {
  try {
    return await apiService.post<T>('/payments/create-session', data);
  } catch (error) {
    if (!isRetryableRouteError(error)) throw error;
    const providerKey = normalizePaymentProviderKey(data.providerKey);
    if (providerKey === 'STRIPE') {
      const legacy = await apiService.post<{ success: boolean; data: { clientSecret: string; paymentIntentId: string } }>(
        '/payments/create-intent',
        { amount: data.amount, currency: data.currency }
      );
      if (!legacy.success) throw new Error('Failed to initialize Stripe payment.');
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

  getFabrics: (params?: {
    country?: string;
    materialTypeId?: string;
    sellerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{ success: boolean; data: { fabrics: any[]; pagination: any } }>('/products/fabrics', { params }),

  getFabric: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`),

  getFabricById: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`),

  getDesigns: (params?: {
    categoryId?: string;
    country?: string;
    designerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{ success: boolean; data: { designs: any[]; pagination: any } }>('/products/designs', { params }),

  getDesign: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`),

  getDesignById: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`),

  getReadyToWear: (params?: {
    categoryId?: string;
    country?: string;
    designerId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/products/ready-to-wear', { params }),

  getReadyToWearProduct: (id: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/ready-to-wear/${id}`),

  getReadyToWearSizeGuide: () =>
    apiService.get<{ success: boolean; data: { title: string; content: string } }>('/products/ready-to-wear-size-guide'),

  getCountries: () =>
    apiService.get<{ success: boolean; data: string[] }>('/products/countries'),

  getFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/products/featured'),

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

  createFabricOnlyOrder: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/orders/fabric-only', data),

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
const promoPreviewPaths = ['/promotions/preview', '/promo/preview'];

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
  for (const path of promoPreviewPaths) {
    try {
      return await apiService.post<T>(path, payload);
    } catch (error) {
      lastError = error;
      if (isRetryableRouteError(error)) continue;
      throw error;
    }
  }
  if (isRetryableRouteError(lastError)) {
    return buildPromoPreviewFromFallback(payload) as T;
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
  }) => createMinimalVendorWithFallback<{ success: boolean; data: any; message?: string }>(data),

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
      data: { sizes: string[] };
      message?: string;
    }>(),

  updateReadyToWearSizesSettings: (sizes: string[]) =>
    writeReadyToWearSizesSettingsWithFallback<{
      success: boolean;
      data: { sizes: string[] };
      message?: string;
    }>(sizes),

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
    apiService.get<{ success: boolean; data: any[] }>('/admin/partners/apps'),

  createPartnerApp: (data: {
    name: string;
    description?: string;
    scopes?: string[];
    rateLimitPerMinute?: number;
    allowedIps?: string[];
    webhookUrl?: string;
  }) => apiService.post<{ success: boolean; data: any; message?: string }>('/admin/partners/apps', data),

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
  ) => apiService.patch<{ success: boolean; data: any; message?: string }>(`/admin/partners/apps/${appId}`, data),

  rotatePartnerAppKey: (appId: string, expiresAt?: string) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(`/admin/partners/apps/${appId}/rotate-key`, {
      expiresAt,
    }),

  rotatePartnerWebhookSecret: (appId: string) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(
      `/admin/partners/apps/${appId}/rotate-webhook-secret`
    ),

  sendPartnerTestWebhook: (appId: string) =>
    apiService.post<{ success: boolean; data: any; message?: string }>(`/admin/partners/apps/${appId}/test-webhook`),

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

  autoCloseOverdueOrders: () =>
    apiService.post<{ success: boolean; data: { closedCount: number }; message?: string }>(
      '/admin/order-workflow/auto-close-overdue'
    ),

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
    readSellerDashboardWithFallback<{ success: boolean; data: any }>(),

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
    apiService.patch(`/orders/${orderId}/status`, { status }),
};

// Designer API
const designerApi = {
  getDashboard: () =>
    readDesignerDashboardWithFallback<{ success: boolean; data: any }>(),

  getDesigns: () =>
    readDesignerDesignsWithFallback<{ success: boolean; data: any[] }>(),

  getProfileCompletion: () =>
    readDesignerProfileCompletionWithFallback<{ success: boolean; data: any }>(),

  getProfileFields: () =>
    readDesignerProfileFieldsWithFallback<{ success: boolean; data: { role: string; fields: any[] } }>(),

  updateProfileCompletion: (data: any) =>
    writeDesignerProfileCompletionWithFallback<{ success: boolean; data: any; message?: string }>(data),

  createDesign: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/designs', data),

  updateDesign: (designId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/designs/${designId}`, data),

  getReadyToWear: () =>
    readDesignerReadyToWearWithFallback<{ success: boolean; data: any[] }>(),

  getReadyToWearSizeOptions: () =>
    apiService.get<{ success: boolean; data: { sizes: string[]; standardSizes: string[] } }>(
      '/designer/ready-to-wear-size-options'
    ),

  createReadyToWear: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/ready-to-wear', data),

  updateReadyToWear: (productId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/ready-to-wear/${productId}`, data),

  updateReadyToWearSizeStock: (productId: string, sizes: Array<{ size: string; color?: string; stock: number }>) =>
    apiService.patch<{ success: boolean; data: any; message?: string }>(`/designer/ready-to-wear/${productId}/size-stock`, {
      sizes,
    }),

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
  getOptions: () =>
    readPaymentOptionsWithFallback<{
      success: boolean;
      data: {
        providers: Array<{
          providerKey: string;
          displayName: string;
          checkoutType: 'INLINE' | 'REDIRECT';
          mode: 'TEST' | 'LIVE';
          publicConfig?: Record<string, any>;
        }>;
      };
    }>(),

  createPaymentSession: (data: {
    providerKey: string;
    amount: number;
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
  apiService,
  httpClient,
};

export default api;
