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
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/google');
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

const topStripReadPaths = [
  '/homepage-sections/admin/top-strip',
  '/homepage/admin/top-strip',
  '/admin/top-strip',
  '/homepage-sections/top-strip',
  '/homepage/top-strip',
];

const topStripWritePaths = [
  '/homepage-sections/admin/top-strip',
  '/homepage/admin/top-strip',
  '/admin/top-strip',
];

async function readTopStripWithFallback<T>() {
  let lastError: unknown = null;
  for (const path of topStripReadPaths) {
    try {
      return await apiService.get<T>(path);
    } catch (error) {
      lastError = error;
      if (isRouteNotFoundError(error)) {
        continue;
      }
      throw error;
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
      if (!isRouteNotFoundError(putError) && !isMethodNotAllowedError(putError)) {
        throw putError;
      }
    }
    try {
      return await apiService.patch<T>(path, data);
    } catch (patchError) {
      lastError = patchError;
      if (!isRouteNotFoundError(patchError) && !isMethodNotAllowedError(patchError)) {
        throw patchError;
      }
    }
  }
  throw lastError ?? new Error('Top strip route not found.');
}

// Auth API
const authApi = {
  login: (email: string, password: string) =>
    apiService.post<{ success: boolean; data: { user: any; token: string | null } }>('/auth/login', { email, password }),

  loginWithGoogle: (idToken: string) =>
    apiService.post<{ success: boolean; data: { user: any; token: string | null } }>('/auth/google', { idToken }),

  getGoogleLinkStatus: () =>
    apiService.get<{ success: boolean; data: { linked: boolean; email: string | null; linkedAt: string | null } }>('/auth/google/link-status'),

  linkGoogleAccount: (idToken: string) =>
    apiService.post<{ success: boolean; data: { linked: boolean; email: string } }>('/auth/google/link', { idToken }),

  unlinkGoogleAccount: () =>
    apiService.delete<{ success: boolean; data: { linked: boolean } }>('/auth/google/link'),

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
        sellers: Array<{ id: string; businessName: string; country: string }>;
        designers: Array<{ id: string; businessName: string; country: string }>;
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
    apiService.get<{
      success: boolean;
      data: Record<string, boolean>;
    }>('/homepage-sections/visibility'),

  getTopStrip: () =>
    readTopStripWithFallback<{
      success: boolean;
      data: {
        messages: string[];
        separator: string;
        repeatCount: number;
        animationSeconds: number;
        textColor: string;
        backgroundColor: string;
      };
    }>(),

  getCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/countries'),

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

  getAdminTopStrip: () =>
    readTopStripWithFallback<{
      success: boolean;
      data: {
        messages: string[];
        separator: string;
        repeatCount: number;
        animationSeconds: number;
        textColor: string;
        backgroundColor: string;
        source?: 'DATABASE' | 'DEFAULT';
        updatedAt?: string | null;
      };
    }>(),

  updateAdminTopStrip: (data: {
    messages: string[];
    separator?: string;
    repeatCount?: number;
    animationSeconds?: number;
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
        textColor: string;
        backgroundColor: string;
      };
    }>(data),

  getAdminCountryOptions: () =>
    apiService.get<{ success: boolean; data: Array<{ code: string; name: string; flag: string }> }>(
      '/homepage-sections/admin/country-options'
    ),

  getAdminDesignerOptions: () =>
    apiService.get<{ success: boolean; data: Array<{ id: string; businessName: string; country: string }> }>(
      '/homepage-sections/admin/designer-options'
    ),

  getAdminCountries: () =>
    apiService.get<{ success: boolean; data: any[] }>('/homepage-sections/admin/countries'),

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
