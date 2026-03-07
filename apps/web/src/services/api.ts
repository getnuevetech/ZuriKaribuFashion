import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/authStore';

const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : `${window.location.origin}/api`;
const API_URL = import.meta.env.VITE_API_URL || defaultApiUrl;

function getApiAssetOrigin(apiUrl: string): string {
  const trimmed = String(apiUrl || '').trim();
  if (!trimmed) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  // Absolute URL -> always use plain origin for static assets like /uploads/*
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.origin;
    } catch {
      return trimmed.replace(/\/api\/?$/, '');
    }
  }

  // Relative API path (e.g. /api) -> use current site origin
  if (trimmed.startsWith('/')) {
    return typeof window !== 'undefined' ? window.location.origin : '';
  }

  return trimmed.replace(/\/api\/?$/, '');
}

const API_ORIGIN = getApiAssetOrigin(API_URL);

export function resolveAssetUrl(url: string | undefined | null): string {
  if (!url) {
    return '';
  }
  const normalized = String(url).trim();
  if (!normalized) {
    return '';
  }
  if (/^https?:\/\//i.test(normalized)) {
    // Normalize legacy URLs and re-home localhost/upload links to the API origin.
    const cleaned = normalized.replace(/\/api\/uploads\//i, '/uploads/');
    try {
      const parsed = new URL(cleaned);
      const isLocalLegacyHost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '0.0.0.0';
      if (isLocalLegacyHost && parsed.pathname.startsWith('/uploads/')) {
        return `${API_ORIGIN}${parsed.pathname}`;
      }
    } catch {
      // Ignore parse errors and return cleaned URL as-is.
    }
    return cleaned;
  }
  if (normalized.startsWith('/api/uploads/')) {
    return `${API_ORIGIN}${normalized.replace(/^\/api/, '')}`;
  }
  if (normalized.startsWith('/')) {
    return `${API_ORIGIN}${normalized}`;
  }
  return `${API_ORIGIN}/${normalized}`;
}

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
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      const headers: any = config.headers || {};
      if (typeof headers.set === 'function') {
        headers.set('Content-Type', undefined);
      } else {
        delete headers['Content-Type'];
      }
      config.headers = headers;
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
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register');
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

// Auth API
type AuthAccess = {
  homeRoute?: string;
  permissions?: string[];
};

type AuthPayload = {
  user: any;
  token: string | null;
  access?: AuthAccess;
};

const authApi = {
  login: (email: string, password: string) =>
    apiService.post<{ success: boolean; data: AuthPayload }>('/auth/login', { email, password }),

  register: (data: any) =>
    apiService.post<{ success: boolean; data: AuthPayload }>('/auth/register', data),

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

  getFabrics: async (params?: { country?: string; materialTypeId?: string; sellerUserId?: string; search?: string; page?: number; limit?: number }) => {
    const response = await apiService.get<{ success: boolean; data: { fabrics: any[]; pagination: any } }>('/products/fabrics', { params });
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        fabrics: (response.data?.fabrics || []).map((fabric: any) => ({
          ...fabric,
          sellerPrice: Number(fabric?.sellerPrice || 0),
          finalPrice: Number(fabric?.finalPrice || 0),
          minYards: Number(fabric?.minYards || 1),
          stockYards: Number(fabric?.stockYards || 0),
          images: (fabric?.images || []).map((img: any) => ({
            ...img,
            url: resolveAssetUrl(img?.url),
          })),
        })),
        pagination: response.data?.pagination,
      },
    };
  },

  getFabric: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/fabrics/${id}`);
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        ...response.data,
        sellerPrice: Number(response.data?.sellerPrice || 0),
        finalPrice: Number(response.data?.finalPrice || 0),
        minYards: Number(response.data?.minYards || 1),
        stockYards: Number(response.data?.stockYards || 0),
        images: (response.data?.images || []).map((img: any) => ({
          ...img,
          url: resolveAssetUrl(img?.url),
        })),
      },
    };
  },

  getFabricById: (id: string) => productsApi.getFabric(id),

  getDesigns: async (params?: { categoryId?: string; country?: string; designerId?: string; designerUserId?: string; search?: string; page?: number; limit?: number }) => {
    const response = await apiService.get<{ success: boolean; data: { designs: any[]; pagination: any } }>('/products/designs', { params });
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        designs: (response.data?.designs || []).map((design: any) => ({
          ...design,
          basePrice: Number(design?.basePrice || 0),
          finalPrice: Number(design?.finalPrice || 0),
          images: (design?.images || []).map((img: any) => ({
            ...img,
            url: resolveAssetUrl(img?.url),
          })),
          suitableFabrics: (design?.suitableFabrics || []).map((sf: any) => ({
            ...sf,
            fabric: sf?.fabric
              ? {
                  ...sf.fabric,
                  finalPrice: Number(sf.fabric?.finalPrice || 0),
                  images: (sf.fabric?.images || []).map((img: any) => ({
                    ...img,
                    url: resolveAssetUrl(img?.url),
                  })),
                }
              : sf?.fabric,
          })),
        })),
        pagination: response.data?.pagination,
      },
    };
  },

  getDesign: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/designs/${id}`);
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        ...response.data,
        basePrice: Number(response.data?.basePrice || 0),
        finalPrice: Number(response.data?.finalPrice || 0),
        images: (response.data?.images || []).map((img: any) => ({
          ...img,
          url: resolveAssetUrl(img?.url),
        })),
        suitableFabrics: (response.data?.suitableFabrics || []).map((sf: any) => ({
          ...sf,
          fabric: sf?.fabric
            ? {
                ...sf.fabric,
                finalPrice: Number(sf.fabric?.finalPrice || 0),
                images: (sf.fabric?.images || []).map((img: any) => ({
                  ...img,
                  url: resolveAssetUrl(img?.url),
                })),
              }
            : sf?.fabric,
        })),
      },
    };
  },

  getDesignById: (id: string) => productsApi.getDesign(id),

  getReadyToWear: async (params?: { categoryId?: string; country?: string; designerId?: string; designerUserId?: string; search?: string; page?: number; limit?: number }) => {
    const response = await apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/products/ready-to-wear', { params });
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        products: (response.data?.products || []).map((product: any) => ({
          ...product,
          basePrice: Number(product?.basePrice || 0),
          images: (product?.images || []).map((img: any) => ({
            ...img,
            url: resolveAssetUrl(img?.url),
          })),
          sizeVariations: (product?.sizeVariations || []).map((size: any) => ({
            ...size,
            price: Number(size?.price || 0),
            stock: Number(size?.stock || 0),
          })),
        })),
        pagination: response.data?.pagination,
      },
    };
  },

  getReadyToWearProduct: async (id: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/products/ready-to-wear/${id}`);
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: {
        ...response.data,
        basePrice: Number(response.data?.basePrice || 0),
        images: (response.data?.images || []).map((img: any) => ({
          ...img,
          url: resolveAssetUrl(img?.url),
        })),
        sizeVariations: (response.data?.sizeVariations || []).map((size: any) => ({
          ...size,
          price: Number(size?.price || 0),
          stock: Number(size?.stock || 0),
        })),
      },
    };
  },

  getCountries: () =>
    apiService.get<{ success: boolean; data: string[] }>('/products/countries'),

  getFeatured: () =>
    apiService.get<{ success: boolean; data: any }>('/products/featured'),

  getVendorStore: async (role: 'seller' | 'designer', userId: string) =>
    apiService.get<{ success: boolean; data: any }>(`/products/vendor/${role}/${userId}`),
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
const adminApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/admin/dashboard'),

  getTrafficReport: (params?: {
    startDate?: string;
    endDate?: string;
    productType?: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    vendorUserId?: string;
    page?: string;
  }) => apiService.get<{ success: boolean; data: any }>('/admin/traffic-report', { params }),

  getSessionAudit: (params?: {
    action?: 'VENDOR_SESSION_STARTED' | 'VENDOR_SESSION_REPLACED' | 'VENDOR_SESSION_LOGOUT';
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    userId?: string;
    page?: number;
    limit?: number;
  }) =>
    apiService.get<{
      success: boolean;
      data: {
        events: any[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }>('/admin/security/session-audit', { params }),

  getDashboardStats: async (range: '24h' | '7d' | '30d' | '90d' = '7d') => {
    const response = await apiService.get<{ success: boolean; data: any }>('/admin/dashboard', {
      params: { range },
    });
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
        pendingOrders: Number(data?.pendingOrders || 0),
        inProductionOrders: Number(data?.inProductionOrders || 0),
        revenueChange: Number(data?.revenueChange || 0),
        orderChange: Number(data?.orderChange || 0),
        userChange: Number(data?.userChange || 0),
        productChange: Number(data?.productChange || 0),
        monthlyRevenue: (data?.monthlyRevenue || []).map((item: any) => ({
          label: String(item?.label || ''),
          value: Number(item?.value || 0),
        })),
        ordersByStatus: (data?.ordersByStatus || []).map((item: any) => ({
          label: String(item?.label || ''),
          value: Number(item?.value || 0),
          color: item?.color,
        })),
        usersByRole: (data?.usersByRole || [
          { label: 'Customers', value: Number(data?.users?.customers || 0) },
          { label: 'Designers', value: Number(data?.users?.designers || 0) },
          { label: 'Sellers', value: Number(data?.users?.fabricSellers || 0) },
          { label: 'QA Team', value: Number(data?.users?.qa || 0) },
        ]).map((item: any) => ({
          label: String(item?.label || ''),
          value: Number(item?.value || 0),
          color: item?.color,
        })),
      },
    };
  },

  getRecentOrders: async (range: '24h' | '7d' | '30d' | '90d' = '7d') => {
    const response = await apiService.get<{ success: boolean; data: any }>('/admin/dashboard', {
      params: { range },
    });
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

  getVendorProfileFields: (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER') =>
    apiService.get<{ success: boolean; data: { role: string; fields: any[] } }>('/admin/vendor-profile/fields', {
      params: { role },
    }),

  updateVendorProfileFields: (
    role: 'FABRIC_SELLER' | 'FASHION_DESIGNER',
    fields: any[]
  ) =>
    apiService.put<{ success: boolean; data: { role: string; fields: any[] } }>('/admin/vendor-profile/fields', {
      role,
      fields,
    }),

  getVendorProfiles: (params?: {
    role?: 'FABRIC_SELLER' | 'FASHION_DESIGNER';
    status?: 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
    search?: string;
    page?: number;
    limit?: number;
  }) => apiService.get<{ success: boolean; data: { profiles: any[]; pagination: any } }>('/admin/vendor-profiles', { params }),

  getVendorProfileDetails: (role: 'FABRIC_SELLER' | 'FASHION_DESIGNER', userId: string) =>
    apiService.get<{ success: boolean; data: any }>(`/admin/vendor-profiles/${role}/${userId}`),

  reviewVendorProfile: (
    role: 'FABRIC_SELLER' | 'FASHION_DESIGNER',
    userId: string,
    data: { status: 'APPROVED' | 'REJECTED'; notes?: string }
  ) => apiService.patch<{ success: boolean; data?: any }>(`/admin/vendor-profiles/${role}/${userId}/review`, data),

  updateUserStatus: (id: string, status: string, reason?: string) =>
    apiService.patch(`/admin/users/${id}/status`, { status, reason }),

  createUser: (data: {
    email: string;
    firstName: string;
    lastName: string;
    role: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
    status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
    password: string;
    phone?: string;
  }) => apiService.post<{ success: boolean; data: any }>('/admin/users', data),

  updateUser: (
    id: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      role?: 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
      status?: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
      phone?: string | null;
    }
  ) => apiService.patch<{ success: boolean; data: any }>(`/admin/users/${id}`, data),

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
  }) =>
    apiService.post<{ success: boolean; data: any }>('/admin/roles', data),

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

  getMeasurementTemplates: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/measurement-templates'),

  updateMeasurementTemplates: (templates: any[]) =>
    apiService.put<{ success: boolean; data: any[] }>('/admin/measurement-templates', { templates }),

  getPricingRules: () =>
    apiService.get<{ success: boolean; data: any[] }>('/admin/pricing-rules'),

  createPricingRule: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/pricing-rules', data),

  updatePricingRule: (id: string, data: any) =>
    apiService.patch(`/admin/pricing-rules/${id}`, data),

  deletePricingRule: (id: string) =>
    apiService.delete(`/admin/pricing-rules/${id}`),

  getProducts: async (params?: { type?: string; status?: string; search?: string; page?: number; limit?: number }) => {
    const response = await apiService.get<{ success: boolean; data: { products: any[]; pagination: any } }>('/admin/products', { params });
    if (!response.success) {
      return response;
    }

    const payload: any = response.data;
    const sourceRows = Array.isArray(payload?.products)
      ? payload.products
      : Array.isArray(payload?.data?.products)
        ? payload.data.products
        : Array.isArray(response.data as any)
          ? (response.data as any)
          : [];
    const products = sourceRows.map((product: any) => ({
      ...product,
      basePrice: Number(product?.basePrice || 0),
      finalPrice: Number(product?.finalPrice || 0),
      image: resolveAssetUrl(product?.image),
    }));
    const pagination = payload?.pagination || payload?.data?.pagination;

    return {
      success: true,
      data: {
        products,
        pagination: pagination || { page: 1, pages: 1, total: products.length, limit: products.length },
      },
    };
  },

  getProductDetails: async (productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', productId: string) => {
    const response = await apiService.get<{ success: boolean; data: any }>(`/admin/products/${productType}/${productId}`);
    if (!response.success) return response;
    const imageRows = (response.data?.images || []).map((item: any) => ({
      ...item,
      url: resolveAssetUrl(item?.url),
    }));
    return {
      success: true,
      data: {
        ...response.data,
        basePrice: Number(response.data?.basePrice || 0),
        finalPrice: Number(response.data?.finalPrice || 0),
        image: imageRows?.[0]?.url,
        images: imageRows,
      },
    };
  },

  createProduct: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/admin/products', data),

  updateProduct: (productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', productId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/admin/products/${productType}/${productId}`, data),

  moderateProduct: (
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    productId: string,
    data: {
      action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'PUBLISH' | 'UNPUBLISH';
      message?: string;
      notifyVendor?: boolean;
    }
  ) => apiService.patch(`/admin/products/${productType}/${productId}/moderate`, data),

  moderateProductsBulk: (data: {
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
    productIds: string[];
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'PUBLISH' | 'UNPUBLISH';
    message?: string;
    notifyVendor?: boolean;
  }) => apiService.post('/admin/products/moderate-bulk', data),

  setProductFeatured: (
    productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    productId: string,
    data: { isFeatured: boolean; section?: string; displayOrder?: number }
  ) => apiService.patch(`/admin/products/${productType}/${productId}/featured`, data),

  getOrders: async (params?: { status?: string; page?: number; limit?: number }) => {
    const response = await apiService.get<{ success: boolean; data: { orders: any[]; pagination: any } }>('/admin/orders', { params });
    if (!response.success) {
      return response;
    }

    const mappedOrders = (response.data?.orders || []).map((order: any) => {
      const customerName = `${order.customer?.firstName || ''} ${order.customer?.lastName || ''}`.trim() || 'Unknown';
      const designerName =
        `${order.designOrder?.design?.designer?.user?.firstName || order.readyToWearItems?.[0]?.readyToWear?.designer?.user?.firstName || ''} ${order.designOrder?.design?.designer?.user?.lastName || order.readyToWearItems?.[0]?.readyToWear?.designer?.user?.lastName || ''}`.trim() || 'N/A';
      const fabricSellerName =
        `${order.fabricOrder?.fabric?.seller?.user?.firstName || ''} ${order.fabricOrder?.fabric?.seller?.user?.lastName || ''}`.trim() || 'N/A';
      const qaStatus = String(order.status || 'N/A').startsWith('QA_') ? order.status : 'N/A';

      return {
        id: order.id,
        orderNumber: order.orderNumber,
        customerName,
        designName: order.designOrder?.design?.name || order.readyToWearItems?.[0]?.readyToWear?.name || 'N/A',
        designerName,
        fabricSellerName,
        totalAmount: Number(order.total || 0),
        status: String(order.status || 'UNKNOWN'),
        designStatus: order.designOrder?.status || 'N/A',
        fabricStatus: order.fabricOrder?.status || 'N/A',
        qaStatus,
        trackingNumber: order.trackingNumber || '',
        timeline: (order.timeline || []).map((entry: any) => ({
          id: entry.id,
          status: entry.status,
          notes: entry.notes,
          updatedByRole: entry.updatedByRole,
          updatedById: entry.updatedById,
          createdAt: entry.createdAt,
        })),
        createdAt: order.createdAt,
      };
    });

    return {
      success: true,
      data: {
        orders: mappedOrders,
        pagination: response.data?.pagination,
      },
    };
  },

  assignQA: (orderId: string, qaId: string) =>
    apiService.patch(`/admin/orders/${orderId}/assign-qa`, { qaId }),

  forceOrderStatus: (orderId: string, status: string, notes?: string) =>
    apiService.patch(`/admin/orders/${orderId}/status`, { status, notes }),

  updateOrderTracking: (orderId: string, trackingNumber: string, notes?: string) =>
    apiService.patch(`/admin/orders/${orderId}/tracking`, { trackingNumber, notes }),

  sendOrderMessage: (
    orderId: string,
    data: { recipient: 'CUSTOMER' | 'VENDORS' | 'QA' | 'INTERNAL'; message: string }
  ) => apiService.post(`/admin/orders/${orderId}/messages`, data),

  getOrderMessages: (orderId: string) =>
    apiService.get<{ success: boolean; data: any[] }>(`/admin/orders/${orderId}/messages`),

  // Banner Management
  getBanners: () =>
    apiService.get<{ success: boolean; data: any[] }>('/banners/admin/all'),

  createBanner: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/banners', data),

  updateBanner: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/banners/${id}`, data),

  deleteBanner: (id: string) =>
    apiService.delete<{ success: boolean }>(`/banners/${id}`),

  toggleBanner: (id: string) =>
    apiService.patch<{ success: boolean; data: any }>(`/banners/${id}/toggle`),
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSellerStats = (payload: any) => {
  const source = payload?.stats && typeof payload?.stats === 'object' ? payload.stats : payload;
  const monthlySales = Array.isArray(source?.monthlySales) ? source.monthlySales : [];
  const topFabrics = Array.isArray(source?.topFabrics) ? source.topFabrics : [];

  return {
    totalFabrics: toFiniteNumber(source?.totalFabrics),
    totalSales: toFiniteNumber(source?.totalSales ?? source?.totalOrders),
    totalRevenue: toFiniteNumber(source?.totalRevenue),
    pendingOrders: toFiniteNumber(source?.pendingOrders),
    lowStockItems: toFiniteNumber(source?.lowStockItems),
    monthlySales: monthlySales.map((item: any) => ({
      label: String(item?.label || ''),
      value: toFiniteNumber(item?.value),
    })),
    topFabrics: topFabrics.map((item: any) => ({
      label: String(item?.label || ''),
      value: toFiniteNumber(item?.value),
    })),
    salesChange: toFiniteNumber(source?.salesChange),
    revenueChange: toFiniteNumber(source?.revenueChange),
  };
};

// Fabric Seller API
const sellerApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/fabric-seller/dashboard'),

  getProfileSetup: () =>
    apiService.get<{ success: boolean; data: any }>('/fabric-seller/profile/full'),

  saveProfileSetup: (profileData: Record<string, any>) =>
    apiService.put<{ success: boolean; data: any }>('/fabric-seller/profile/full', { profileData }),

  submitProfileSetup: () =>
    apiService.post<{ success: boolean; data?: any }>('/fabric-seller/profile/full/submit'),

  getFabrics: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/fabric-seller/fabrics');
    if (!response.success) {
      return response;
    }
    const sourceRows = Array.isArray(response.data)
      ? response.data
      : Array.isArray((response.data as any)?.fabrics)
        ? (response.data as any).fabrics
        : [];
    return {
      success: true,
      data: sourceRows.map((fabric: any) => ({
        id: fabric.id,
        name: fabric.name,
        description: fabric.description || '',
        pricePerMeter: toFiniteNumber(fabric.finalPrice || fabric.sellerPrice),
        currencyCode: fabric.currencyCode || 'USD',
        localSellerPrice: toFiniteNumber(fabric.localSellerPrice),
        sellerPriceUsd: toFiniteNumber(fabric.sellerPriceUsd || fabric.sellerPrice),
        stockMeters: toFiniteNumber(fabric.stockYards),
        images: (fabric.images || [])
          .map((img: any) => resolveAssetUrl(typeof img === 'string' ? img : img?.url))
          .filter(Boolean),
        orderCount: toFiniteNumber(fabric?._count?.orderItems),
        status: fabric.status === 'APPROVED' ? 'ACTIVE' : fabric.status,
        materialType: fabric.materialType,
        minOrderMeters: toFiniteNumber(fabric.minYards, 1),
      })),
    };
  },

  createFabric: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/fabric-seller/fabrics', data),

  updateFabric: (fabricId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/fabric-seller/fabrics/${fabricId}`, data),

  getOrders: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/fabric-seller/orders');
    if (!response.success) {
      return response;
    }
    const sourceRows = Array.isArray(response.data)
      ? response.data
      : Array.isArray((response.data as any)?.orders)
        ? (response.data as any).orders
        : [];
    return {
      success: true,
      data: sourceRows.map((item: any) => ({
        id: item.id,
        orderNumber: item.order?.orderNumber || 'N/A',
        fabricName: item.fabric?.name || 'Unknown Fabric',
        meters: toFiniteNumber(item.yards),
        totalAmount: toFiniteNumber(item.totalPrice),
        status: item.status || 'PENDING',
        designerCountry: item.order?.designOrder?.design?.designer?.country || '',
        createdAt: item.order?.createdAt || item.createdAt,
        customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`.trim() || 'Unknown',
      })),
    };
  },

  getStats: async () => {
    try {
      const response = await apiService.get<{ success: boolean; data: any }>('/fabric-seller/stats');
      if (!response.success) {
        return response;
      }
      return {
        success: true,
        data: normalizeSellerStats(response.data),
      };
    } catch {
      const fallback = await apiService.get<{ success: boolean; data: any }>('/fabric-seller/dashboard');
      if (!fallback.success) {
        return fallback;
      }
      return {
        success: true,
        data: normalizeSellerStats(fallback.data),
      };
    }
  },

  updateFabricStock: (fabricId: string, stock: number) =>
    apiService.patch(`/fabric-seller/fabrics/${fabricId}/stock`, { stock }),

  updateOrderStatus: (orderId: string, status: string, options?: { trackingNumber?: string; notes?: string }) =>
    apiService.patch(`/fabric-seller/orders/${orderId}/status`, {
      status,
      trackingNumber: options?.trackingNumber,
      notes: options?.notes,
    }),
};

// Designer API
const designerApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/designer/dashboard'),

  getProfileSetup: () =>
    apiService.get<{ success: boolean; data: any }>('/designer/profile/full'),

  saveProfileSetup: (profileData: Record<string, any>) =>
    apiService.put<{ success: boolean; data: any }>('/designer/profile/full', { profileData }),

  submitProfileSetup: () =>
    apiService.post<{ success: boolean; data?: any }>('/designer/profile/full/submit'),

  getDesigns: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/designer/designs');
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: (response.data || []).map((design: any) => ({
        id: design.id,
        name: design.name,
        description: design.description || '',
        basePrice: Number(design.basePrice || 0),
        currencyCode: design.currencyCode || 'USD',
        localBasePrice: Number(design.localBasePrice || 0),
        basePriceUsd: Number(design.basePriceUsd || design.basePrice || 0),
        images: (design.images || []).map((img: any) => resolveAssetUrl(img.url)).filter(Boolean),
        category: design.category,
        rating: Number(design.designer?.rating || 0),
        orderCount: Number(design?._count?.orderItems || 0),
        status: design.status === 'APPROVED' ? 'ACTIVE' : design.status,
        createdAt: design.createdAt,
      })),
    };
  },

  createDesign: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/designs', data),

  updateDesign: (designId: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/designs/${designId}`, data),

  getMeasurementTemplates: () =>
    apiService.get<{ success: boolean; data: any[] }>('/designer/measurement-templates'),

  getReadyToWear: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/designer/ready-to-wear');
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: (response.data || []).map((product: any) => ({
        ...product,
        currencyCode: product.currencyCode || 'USD',
        localBasePrice: Number(product.localBasePrice || 0),
        basePriceUsd: Number(product.basePriceUsd || product.basePrice || 0),
        images: (product.images || []).map((img: any) => ({
          ...img,
          url: resolveAssetUrl(img.url),
        })),
      })),
    };
  },

  createReadyToWear: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/designer/ready-to-wear', data),

  updateReadyToWear: (id: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/ready-to-wear/${id}`, data),

  updateReadyToWearStock: (id: string, sizes: Array<{ id: string; stock: number }>) =>
    apiService.patch<{ success: boolean; data: any }>(`/designer/ready-to-wear/${id}/stock`, { sizes }),

  getOrders: async () => {
    const response = await apiService.get<{ success: boolean; data: any[] }>('/designer/orders');
    if (!response.success) {
      return response;
    }
    return {
      success: true,
      data: (response.data || []).map((item: any) => {
        const createdAt = item.order?.createdAt || item.createdAt;
        const createdDate = new Date(createdAt);
        const dueDate = new Date(createdDate);
        dueDate.setDate(createdDate.getDate() + 14);
        const ageMs = Date.now() - createdDate.getTime();
        const priority = ageMs > 10 * 24 * 60 * 60 * 1000 ? 'HIGH' : ageMs > 5 * 24 * 60 * 60 * 1000 ? 'MEDIUM' : 'LOW';
        return {
          id: item.id,
          orderNumber: item.order?.orderNumber || 'N/A',
          designName: item.design?.name || 'Unknown Design',
          customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`.trim() || 'Unknown',
          measurements: item.measurements || {},
          fabricInfo: item.order?.fabricOrder?.fabric?.name || 'N/A',
          totalAmount: Number(item.order?.total || item.price || 0),
          status: item.status || 'PENDING',
          createdAt,
          dueDate: dueDate.toISOString(),
          priority,
        };
      }),
    };
  },

  getStats: async () => {
    try {
      return await apiService.get<{ success: boolean; data: any }>('/designer/stats');
    } catch {
      const fallback = await apiService.get<{ success: boolean; data: any }>('/designer/dashboard');
      if (!fallback.success) {
        return fallback;
      }
      const stats = fallback.data?.stats || {};
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
          rating: Number(fallback.data?.profile?.rating || 0),
          revenueChange: 0,
          orderChange: 0,
        },
      };
    }
  },

  updateOrderStatus: (orderId: string, status: string, notes?: string) =>
    apiService.patch(`/designer/orders/${orderId}/status`, { status, notes }),
};

// QA API
const qaApi = {
  getDashboard: () =>
    apiService.get<{ success: boolean; data: any }>('/qa/dashboard'),

  getOrders: (params?: { status?: string }) =>
    apiService.get<{ success: boolean; data: any[] }>('/qa/orders', { params }),

  shipOrder: (orderId: string, trackingNumber: string, notes?: string) =>
    apiService.patch(`/qa/orders/${orderId}/ship`, { trackingNumber, notes }),

  getStats: () =>
    apiService.get<{ success: boolean; data: any }>('/qa/stats'),

  getPendingItems: () =>
    apiService.get<{ success: boolean; data: any[] }>('/qa/pending'),

  getReviewHistory: () =>
    apiService.get<{ success: boolean; data: any[] }>('/qa/history'),

  submitReview: (data: { orderId: string; status: 'APPROVED' | 'REJECTED'; notes: string }) =>
    apiService.post<{ success: boolean; data: any }>('/qa/review', data),
};

// Payments API
const paymentsApi = {
  getConfig: () =>
    apiService.get<{ success: boolean; data: { supportedCurrencies: string[]; defaultCurrency: string } }>('/payments/config'),

  createPaymentIntent: (data: { amountUsd: number; currency: string }) =>
    apiService.post<
      {
        success: boolean;
        data: {
          clientSecret: string;
          paymentIntentId: string;
          currency: string;
          amountMinor: number;
          convertedAmountMajor: number;
          requestedCurrency: string;
        };
      }
    >('/payments/create-intent', data),

  confirmPayment: (paymentIntentId: string) =>
    apiService.post<{ success: boolean; data: any }>('/payments/confirm', { paymentIntentId }),
};

// Banners API (public)
const bannersApi = {
  getBanners: (section?: string) =>
    apiService.get<{ success: boolean; data: any[] }>('/banners', { params: section ? { section } : undefined }),

  getBannerSections: () =>
    apiService.get<{ success: boolean; data: any[] }>('/banners/meta/sections'),
};

// Upload API
const uploadApi = {
  image: (formData: FormData) =>
    httpClient.post<{ success: boolean; data: { url: string } }>('/upload/image', formData).then((res) => ({
      ...res.data,
      data: {
        ...res.data.data,
        url: resolveAssetUrl(res.data.data?.url || ''),
      },
    })),
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
    apiService.patch<{ success: boolean; data: any }>(`/homepage/admin/hero-slides/${id}`, data),

  deleteHeroSlide: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/hero-slides/${id}`),

  getAdminFeatured: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/featured'),

  addFeaturedProduct: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage/admin/featured', data),

  updateFeaturedProduct: (id: string, data: any) =>
    apiService.patch<{ success: boolean; data: any }>(`/homepage/admin/featured/${id}`, data),

  removeFeaturedProduct: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage/admin/featured/${id}`),

  getProductsForFeaturing: (type?: string) =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage/admin/products-for-featured', { params: type ? { type } : undefined }),
};

// Homepage Sections API (new dynamic sections)
const homepageSectionsApi = {
  // Public endpoints
  getVisibility: () =>
    apiService.get<{
      success: boolean;
      data: Record<string, boolean>;
    }>('/homepage-sections/visibility'),

  getCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/countries'),

  getStoryBySlug: (slug: string) =>
    apiService.get<{ success: boolean; data: any }>(`/homepage-sections/stories/${encodeURIComponent(slug)}`),

  getHowItWorks: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/how-it-works'),

  getCategories: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/categories'),

  getDesignerSpotlight: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/designer-spotlight'),

  getDesignerSpotlights: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/designer-spotlights'),

  getHeritage: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/heritage'),

  getTestimonials: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/testimonials'),

  getFooter: () =>
    apiService.get<{ success: boolean; data: any }>('/homepage-sections/footer'),

  // Admin endpoints - Countries
  getAdminDesigners: () =>
    apiService.get<{ success: boolean; data: Array<{ id: string; businessName: string; country: string; isVerified: boolean }> }>(
      '/homepage-sections/admin/designers'
    ),

  getAdminCountryOptions: () =>
    apiService.get<{ success: boolean; data: Array<{ code: string; name: string; flag: string }> }>(
      '/homepage-sections/admin/country-options'
    ),

  getAdminVisibility: () =>
    apiService.get<{
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
    }>('/homepage-sections/admin/visibility'),

  updateAdminVisibility: (visibility: Record<string, boolean>) =>
    apiService.put<{
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
    }>('/homepage-sections/admin/visibility', { visibility }),

  getAdminCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/countries'),

  getAdminStories: (type?: 'COUNTRY' | 'DESIGNER_SPOTLIGHT') =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/stories', {
      params: type ? { type } : undefined,
    }),

  createStory: (data: {
    type: 'COUNTRY' | 'DESIGNER_SPOTLIGHT';
    title: string;
    subtitle?: string;
    countryCode?: string;
    designerId?: string;
    coverImage?: string;
    contentHtml: string;
    displayOrder?: number;
    isActive?: boolean;
  }) => apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/stories', data),

  updateStory: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/stories/${id}`, data),

  deleteStory: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/stories/${id}`),

  getCountryImageApiConfig: () =>
    apiService.get<{
      success: boolean;
      data: {
        provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS';
        endpoint: string;
        model: string;
        imageSize: string;
        hasApiKey: boolean;
        maskedApiKey: string;
        source: 'DATABASE' | 'ENV_DEFAULT';
      };
      warning?: string;
      message?: string;
    }>('/homepage-sections/admin/countries/image-api-config'),

  updateCountryImageApiConfig: (data: {
    provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS';
    endpoint?: string;
    model?: string;
    imageSize?: string;
    apiKey?: string;
    clearApiKey?: boolean;
  }) =>
    apiService.put<{
      success: boolean;
      data: {
        provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS';
        endpoint: string;
        model: string;
        imageSize: string;
        hasApiKey: boolean;
        maskedApiKey: string;
        source: 'DATABASE' | 'ENV_DEFAULT';
      };
      warning?: string;
      message?: string;
    }>('/homepage-sections/admin/countries/image-api-config', data),

  testCountryImageApiConfig: (data: {
    provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS';
    endpoint?: string;
    model?: string;
    imageSize?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    useStoredApiKey?: boolean;
    countryCode?: string;
    name?: string;
    keywords?: string;
  }) =>
    apiService.post<{
      success: boolean;
      message?: string;
      data: {
        url: string;
        provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS' | 'PICSUM';
        prompt: string;
        fallbackUsed: boolean;
        country: { code: string; name: string; flag: string };
      };
    }>('/homepage-sections/admin/countries/image-api-config/test', data),

  generateCountryImage: (data: { countryCode: string; name?: string; keywords: string }) =>
    apiService.post<{
      success: boolean;
      data: {
        url: string;
        provider: 'OPENAI' | 'OPENAI_COMPATIBLE' | 'POLLINATIONS' | 'PICSUM';
        prompt: string;
        fallbackUsed: boolean;
        country: { code: string; name: string; flag: string };
      };
    }>('/homepage-sections/admin/countries/generate-image', data),

  createCountry: (data: any) =>
    apiService.post<{ success: boolean; data: any }>('/homepage-sections/admin/countries', data),

  updateCountry: (id: string, data: any) =>
    apiService.put<{ success: boolean; data: any }>(`/homepage-sections/admin/countries/${id}`, data),

  deleteCountry: (id: string) =>
    apiService.delete<{ success: boolean }>(`/homepage-sections/admin/countries/${id}`),

  // Admin endpoints - How It Works
  getAdminHowItWorks: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/how-it-works'),

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

  getAdminDesignerSpotlightSettings: () =>
    apiService.get<{
      success: boolean;
      data: {
        maxWords: number;
        source: 'DATABASE' | 'DEFAULT';
        updatedAt: string | null;
      };
    }>('/homepage-sections/admin/designer-spotlight-settings'),

  updateAdminDesignerSpotlightSettings: (data: { maxWords: number }) =>
    apiService.put<{
      success: boolean;
      data: {
        maxWords: number;
        source: 'DATABASE' | 'DEFAULT';
        updatedAt: string | null;
      };
    }>('/homepage-sections/admin/designer-spotlight-settings', data),

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
  apiService,
  httpClient,
};

export default api;
