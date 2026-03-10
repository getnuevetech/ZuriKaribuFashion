import { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Plus,
  Edit,
  Eye,
  AlertCircle,
  TrendingDown,
  Truck,
  CheckCircle,
  Clock,
  BarChart3,
  MapPin,
  ArrowRight,
  Search,
  Filter
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, LineChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { getCityOptionsByCountryCode, getCountryOptions, resolveCountryCode, resolveCountryName } from '../../data/locationOptions';

interface SellerStats {
  totalFabrics: number;
  totalSales: number;
  totalRevenue: number;
  pendingOrders: number;
  lowStockItems: number;
  monthlySales: { label: string; value: number }[];
  topFabrics: { label: string; value: number }[];
  salesChange: number;
  revenueChange: number;
}

interface Fabric {
  id: string;
  name: string;
  description: string;
  materialTypeId?: string;
  pricePerMeter: number;
  stockMeters: number;
  images: string[];
  orderCount: number;
  status: string;
  materialType: { name: string };
  minOrderMeters: number;
  isFeatured?: boolean;
  featuredSections?: string[];
  listingCurrencyCode?: string;
  listingLocalPrice?: number;
  listingUsdPrice?: number;
}

interface FabricOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  fabricName: string;
  meters: number;
  totalAmount: number;
  status: string;
  designerCountry: string;
  createdAt: string;
  customerName: string;
}

interface Activity {
  id: string;
  type: 'order' | 'inventory' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

interface MaterialOption {
  id: string;
  name: string;
}

interface FabricFormState {
  name: string;
  description: string;
  materialTypeId: string;
  sellerPrice: string;
  minYards: string;
  stockYards: string;
  imageUrls: string;
  priceCurrencyCode: string;
}

interface VendorProfileField {
  key: string;
  label: string;
  fieldType: string;
  required?: boolean;
  options?: string[];
  helpText?: string;
  placeholder?: string;
  isActive?: boolean;
}

interface SellerProfileCompletion {
  canUpload: boolean;
  profileStatus: 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  profileReviewNotes?: string | null;
  profile: {
    businessName?: string;
    businessEmail?: string;
    businessPhone?: string;
    country?: string;
    city?: string;
    address?: string;
    website?: string;
    storefrontPath?: string;
  };
  profileData?: Record<string, any>;
  fields?: VendorProfileField[];
}

interface GovernanceDebugInfo {
  dashboardCall: string;
  fabricsCall: string;
  ordersCall: string;
  profileCompletionCall: string;
  profileFieldsCall: string;
  completionFieldCount: number;
  governanceFieldCount: number;
  effectiveFieldCount: number;
  sampleFieldKeys: string[];
  error?: string;
}

const LOCATION_COUNTRIES = getCountryOptions();
const COUNTRY_FIELD_HINTS = ['country', 'businesscountry', 'vendorcountry'];
const CITY_FIELD_HINTS = ['city', 'businesscity', 'vendorcity', 'town'];

const normalizeFieldKey = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const isCountryGovernanceField = (field: VendorProfileField) => {
  const key = normalizeFieldKey(field.key);
  const label = normalizeFieldKey(field.label);
  return COUNTRY_FIELD_HINTS.some((hint) => key.includes(hint) || label.includes(hint));
};

const isCityGovernanceField = (field: VendorProfileField) => {
  const key = normalizeFieldKey(field.key);
  const label = normalizeFieldKey(field.label);
  return CITY_FIELD_HINTS.some((hint) => key.includes(hint) || label.includes(hint));
};

const getSellerProfilePrefillValue = (profile: SellerProfileCompletion['profile'] | undefined, key: string) => {
  const normalized = normalizeFieldKey(key);
  if (!profile) return '';
  if (normalized.includes('businessname') || normalized.includes('brandname') || normalized.includes('companyname')) {
    return String(profile.businessName || '');
  }
  if (normalized.includes('businessemail') || normalized === 'email' || normalized.includes('companyemail')) {
    return String(profile.businessEmail || '');
  }
  if (normalized.includes('businessphone') || normalized.includes('phone')) {
    return String(profile.businessPhone || '');
  }
  if (normalized.includes('country')) return String(profile.country || '');
  if (normalized.includes('city') || normalized.includes('town')) return String(profile.city || '');
  if (normalized.includes('address')) return String(profile.address || '');
  if (normalized.includes('website')) return String(profile.website || '');
  return '';
};

export default function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [orders, setOrders] = useState<FabricOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'fabrics' | 'featured' | 'orders'>('overview');
  const [showStockModal, setShowStockModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [newStock, setNewStock] = useState(0);
  const [productForm, setProductForm] = useState<FabricFormState>({
    name: '',
    description: '',
    materialTypeId: '',
    sellerPrice: '',
    minYards: '1',
    stockYards: '0',
    imageUrls: '',
    priceCurrencyCode: 'USD',
  });
  const [currencyOptions, setCurrencyOptions] = useState<{
    defaultCurrency: string;
    allowedCurrencies: string[];
    usdPerUnitByCurrency: Record<string, number>;
  }>({
    defaultCurrency: 'USD',
    allowedCurrencies: ['USD'],
    usdPerUnitByCurrency: { USD: 1 },
  });
  const [profileCompletion, setProfileCompletion] = useState<SellerProfileCompletion | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [governanceDebug, setGovernanceDebug] = useState<GovernanceDebugInfo | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [fabricSearch, setFabricSearch] = useState('');
  const [fabricStatusFilter, setFabricStatusFilter] = useState('');
  const [fabricMaterialFilter, setFabricMaterialFilter] = useState('');

  const syncTabWithUrl = (tab: 'overview' | 'fabrics' | 'featured' | 'orders') => {
    setActiveTab(tab);
    if (tab === 'overview') {
      setSearchParams({});
      return;
    }
    setSearchParams({ tab });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'fabrics' || tabParam === 'featured' || tabParam === 'orders' || tabParam === 'overview') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    if (materialOptions.length > 0 && !productForm.materialTypeId) {
      setProductForm((prev) => ({ ...prev, materialTypeId: materialOptions[0].id }));
    }
  }, [materialOptions, productForm.materialTypeId]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardResult, fabricsResult, ordersResult, materialsResult, currencyResult] = await Promise.allSettled([
        api.seller.getDashboard(),
        api.seller.getFabrics(),
        api.seller.getOrders(),
        api.products.getMaterials(),
        api.currency.getMyOptions(),
      ]);
      const dashboardRes = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const fabricsRes = fabricsResult.status === 'fulfilled' ? fabricsResult.value : null;
      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const materialsRes = materialsResult.status === 'fulfilled' ? materialsResult.value : null;
      const currencyRes = currencyResult.status === 'fulfilled' ? currencyResult.value : null;
      const settledCallStatus = (result: PromiseSettledResult<any>) => {
        if (result.status === 'fulfilled') {
          return result.value?.success
            ? 'success'
            : `api-failed:${String(result.value?.message || 'unknown')}`;
        }
        const reason = result.reason as any;
        const status = reason?.response?.status;
        const message = String(reason?.response?.data?.message || reason?.message || 'unknown');
        return `request-failed:${status ?? 'no-status'}:${message.slice(0, 120)}`;
      };
      const dashboardCompletion = dashboardRes?.success ? dashboardRes.data?.profileCompletion : null;
      let profileCompletionCallStatus = dashboardCompletion ? 'from-dashboard' : 'skipped';
      let profileFieldsCallStatus = dashboardCompletion ? 'from-dashboard' : 'skipped';
      let profileRes: any = null;
      let profileFieldsRes: any = null;
      if (!dashboardCompletion) {
        const [profileResult, profileFieldsResult] = await Promise.allSettled([
          api.seller.getProfileCompletion(),
          api.seller.getProfileFields(),
        ]);
        profileRes = profileResult.status === 'fulfilled' ? profileResult.value : null;
        profileFieldsRes = profileFieldsResult.status === 'fulfilled' ? profileFieldsResult.value : null;
        profileCompletionCallStatus = settledCallStatus(profileResult);
        profileFieldsCallStatus = settledCallStatus(profileFieldsResult);
      }

      if (dashboardRes?.success) {
        const baseStats = dashboardRes.data?.stats || {};
        setStats({
          totalFabrics: Number(baseStats.totalFabrics || 0),
          totalSales: Number(baseStats.totalOrders || 0),
          totalRevenue: Number(baseStats.totalRevenue || 0),
          pendingOrders: Number(baseStats.pendingOrders || 0),
          lowStockItems: 0,
          monthlySales: [],
          topFabrics: [],
          salesChange: 0,
          revenueChange: 0,
        });
      }
      if (fabricsRes?.success) {
        const mappedFabrics = (fabricsRes.data || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Fabric',
          description: item.description || '',
          materialTypeId: item.materialTypeId || item.materialType?.id || '',
          pricePerMeter: Number(item.finalPrice ?? item.sellerPrice ?? 0),
          stockMeters: Number(item.stockYards ?? 0),
          images: Array.isArray(item.images)
            ? item.images.map((img: any) => img?.url).filter(Boolean)
            : [],
          orderCount: Number(item?._count?.orderItems ?? 0),
          status: item.status || 'DRAFT',
          materialType: item.materialType || { name: 'Material' },
          minOrderMeters: Number(item.minYards ?? 1),
          isFeatured: Boolean(item.isFeatured),
          featuredSections: Array.isArray(item.featuredSections) ? item.featuredSections : [],
          listingCurrencyCode: String(item.listingCurrencyCode || 'USD'),
          listingLocalPrice: Number(item.listingLocalPrice || item.sellerPrice || 0),
          listingUsdPrice: Number(item.listingUsdPrice || item.sellerPrice || 0),
        }));
        setFabrics(mappedFabrics);
      }
      if (currencyRes?.success) {
        setCurrencyOptions({
          defaultCurrency: String(currencyRes.data?.defaultCurrency || 'USD'),
          allowedCurrencies: Array.isArray(currencyRes.data?.allowedCurrencies)
            ? currencyRes.data.allowedCurrencies.map((entry: any) => String(entry || '').toUpperCase()).filter(Boolean)
            : ['USD'],
          usdPerUnitByCurrency: (currencyRes.data?.usdPerUnitByCurrency || { USD: 1 }) as Record<string, number>,
        });
      }
      if (materialsRes?.success) {
        const options = Array.isArray(materialsRes.data)
          ? materialsRes.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Material') }))
          : [];
        setMaterialOptions(options);
      }
      if (ordersRes?.success) {
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
        const mappedOrders = (ordersRes.data || []).map((item: any) => {
          const shippingAddress = toAddressObject(item.order?.shippingAddress);
          return {
            id: String(item.id),
            orderId: String(item.orderId || ''),
            orderNumber: item.order?.orderNumber || 'N/A',
            fabricName: item.fabric?.name || 'Fabric',
            meters: Number(item.yards || 0),
            totalAmount: Number(item.totalPrice || 0),
            status: item.status || 'PENDING',
            designerCountry: shippingAddress?.country || 'N/A',
            createdAt: item.order?.createdAt || item.createdAt,
            customerName: shippingAddress?.fullName || 'Customer',
          };
        });
        setOrders(mappedOrders);
      }
      const completionPayload = dashboardCompletion || (profileRes?.success ? profileRes.data : null);
      const governanceFields = profileFieldsRes?.success && Array.isArray(profileFieldsRes.data?.fields)
        ? profileFieldsRes.data.fields.filter((entry: any) => entry?.isActive !== false)
        : [];
      const completionFieldCount = completionPayload && Array.isArray((completionPayload as any)?.fields)
        ? (completionPayload as any).fields.filter((entry: any) => entry?.isActive !== false).length
        : 0;

      if (completionPayload) {
        const completion = completionPayload as SellerProfileCompletion;
        const completionFields = Array.isArray(completion?.fields)
          ? completion.fields.filter((entry: any) => entry?.isActive !== false)
          : [];
        const effectiveFields = completionFields.length > 0 ? completionFields : governanceFields;
        setProfileMessage(null);
        setProfileCompletion({
          ...completion,
          fields: effectiveFields,
        });
        const nextProfileForm: Record<string, string> = {};
        const dynamicData = completion?.profileData && typeof completion.profileData === 'object'
          ? completion.profileData
          : {};
        for (const field of effectiveFields) {
          const rawValue = (dynamicData as Record<string, unknown>)[field.key];
          nextProfileForm[field.key] = Array.isArray(rawValue)
            ? rawValue.join(', ')
            : rawValue === undefined || rawValue === null
              ? getSellerProfilePrefillValue(completion.profile, field.key)
              : String(rawValue);
        }
        setProfileForm(nextProfileForm);
        if (effectiveFields.length === 0) {
          setProfileMessage('Vendor governance fields are empty for Fabric Seller. Please verify API deployment and re-save Vendor Profile Governance fields.');
        }
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: effectiveFields.length,
          sampleFieldKeys: governanceFields.slice(0, 5).map((field: any) => String(field?.key || '')).filter(Boolean),
        });
      } else if (governanceFields.length > 0) {
        const fallbackProfile = (dashboardRes?.success ? dashboardRes.data?.profile : null) || {};
        const syntheticCompletion: SellerProfileCompletion = {
          canUpload: false,
          profileStatus: 'INCOMPLETE',
          profile: {
            businessName: String(fallbackProfile?.businessName || ''),
            businessEmail: String(fallbackProfile?.businessEmail || ''),
            businessPhone: String(fallbackProfile?.businessPhone || ''),
            country: String(fallbackProfile?.country || ''),
            city: String(fallbackProfile?.city || ''),
            address: String(fallbackProfile?.address || ''),
            website: String(fallbackProfile?.website || ''),
            storefrontPath: String(fallbackProfile?.storefrontPath || ''),
          },
          profileData: {},
          fields: governanceFields,
        };
        setProfileCompletion(syntheticCompletion);
        const nextProfileForm: Record<string, string> = {};
        for (const field of governanceFields) {
          nextProfileForm[field.key] = getSellerProfilePrefillValue(syntheticCompletion.profile, field.key);
        }
        setProfileForm(nextProfileForm);
        setProfileMessage('Vendor profile governance loaded directly. Complete and submit for admin approval.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: governanceFields.length,
          sampleFieldKeys: governanceFields.slice(0, 5).map((field: any) => String(field?.key || '')).filter(Boolean),
        });
      } else {
        setProfileMessage('Unable to load vendor application fields right now. Please refresh the page.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: 0,
          sampleFieldKeys: [],
        });
      }
      
      // Mock activities
      setActivities([
        {
          id: '1',
          type: 'order',
          title: 'New fabric order',
          description: 'Order #F-2024-156 for 15m of Premium Kente',
          timestamp: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        },
        {
          id: '2',
          type: 'inventory',
          title: 'Low stock alert',
          description: 'Ghana Adinkra Cloth is running low (8m left)',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        },
        {
          id: '3',
          type: 'order',
          title: 'Order shipped',
          description: 'Order #F-2024-142 shipped to Nigeria',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
          id: '4',
          type: 'system',
          title: 'Payout processed',
          description: '$890.00 deposited to your account',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setGovernanceDebug({
        dashboardCall: 'not-reached',
        fabricsCall: 'not-reached',
        ordersCall: 'not-reached',
        profileCompletionCall: 'not-reached',
        profileFieldsCall: 'not-reached',
        completionFieldCount: 0,
        governanceFieldCount: 0,
        effectiveFieldCount: 0,
        sampleFieldKeys: [],
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStock = async (fabricId: string, stock: number) => {
    try {
      await api.seller.updateFabricStock(fabricId, stock);
      setShowStockModal(false);
      setSelectedFabric(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update stock:', error);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.seller.updateOrderStatus(orderId, status);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  const openStockModal = (fabric: Fabric) => {
    setSelectedFabric(fabric);
    setNewStock(fabric.stockMeters);
    setShowStockModal(true);
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      materialTypeId: materialOptions[0]?.id || '',
      sellerPrice: '',
      minYards: '1',
      stockYards: '0',
      imageUrls: '',
      priceCurrencyCode: currencyOptions.defaultCurrency || 'USD',
    });
    setSelectedFabric(null);
    setIsEditMode(false);
    setProductError(null);
  };

  const openCreateProductModal = () => {
    if (!profileCompletion?.canUpload) {
      setProductError('Complete and submit your full vendor profile for admin approval before uploading products.');
      return;
    }
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProductModal = (fabric: Fabric) => {
    setSelectedFabric(fabric);
    setIsEditMode(true);
    setProductError(null);
    setProductForm({
      name: fabric.name,
      description: fabric.description || '',
      materialTypeId: fabric.materialTypeId || materialOptions[0]?.id || '',
      sellerPrice: String(fabric.listingLocalPrice || fabric.pricePerMeter || ''),
      minYards: String(fabric.minOrderMeters || 1),
      stockYards: String(fabric.stockMeters || 0),
      imageUrls: (fabric.images || []).join('\n'),
      priceCurrencyCode: String(fabric.listingCurrencyCode || currencyOptions.defaultCurrency || 'USD'),
    });
    setShowProductModal(true);
  };

  const parseImageInputs = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

  const handleSaveProduct = async () => {
    setProductError(null);
    const images = parseImageInputs(productForm.imageUrls);
    if (!productForm.name.trim()) {
      setProductError('Fabric name is required.');
      return;
    }
    if (!productForm.description.trim() || productForm.description.trim().length < 10) {
      setProductError('Description must be at least 10 characters.');
      return;
    }
    if (!productForm.materialTypeId) {
      setProductError('Please select a material type.');
      return;
    }
    if (Number(productForm.sellerPrice || 0) <= 0) {
      setProductError('Seller price must be greater than zero.');
      return;
    }
    if (Number(productForm.minYards || 0) < 1) {
      setProductError('Minimum yards must be at least 1.');
      return;
    }
    if (Number(productForm.stockYards || 0) < 0) {
      setProductError('Stock yards cannot be negative.');
      return;
    }
    if (images.length < 3 || images.length > 4) {
      setProductError('Fabrics require 3 to 4 images.');
      return;
    }

    setIsSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        description: productForm.description.trim(),
        materialTypeId: productForm.materialTypeId,
        sellerPrice: Number(productForm.sellerPrice || 0),
        priceCurrencyCode: productForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD',
        minYards: Number(productForm.minYards || 1),
        stockYards: Number(productForm.stockYards || 0),
        images,
      };
      if (isEditMode && selectedFabric) {
        await api.seller.updateFabric(selectedFabric.id, payload);
      } else {
        await api.seller.createFabric(payload);
      }
      setShowProductModal(false);
      resetProductForm();
      await fetchDashboardData();
      syncTabWithUrl('fabrics');
    } catch (error: any) {
      setProductError(error?.message || 'Unable to save fabric right now.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleSubmitProfile = async () => {
    if (!profileCompletion) return;
    setProfileMessage(null);
    setSubmittingProfile(true);
    try {
      const dynamicPayload: Record<string, string | number | boolean | string[]> = {};
      for (const field of activeProfileFields) {
        if (!field?.key) continue;
        const raw = String(profileForm[field.key] ?? '').trim();
        if (field.fieldType === 'NUMBER') {
          if (!raw) {
            dynamicPayload[field.key] = '';
          } else {
            const parsed = Number(raw);
            dynamicPayload[field.key] = Number.isFinite(parsed) ? parsed : raw;
          }
        } else if (field.fieldType === 'MULTI_SELECT') {
          dynamicPayload[field.key] = raw
            ? raw
                .split(',')
                .map((item) => item.trim())
                .filter(Boolean)
            : [];
        } else {
          dynamicPayload[field.key] = raw;
        }
      }
      const response = await api.seller.updateProfileCompletion({
        profileData: dynamicPayload,
      });
      if (response.success) {
        setProfileCompletion(response.data);
        setProfileMessage(response.message || 'Profile submitted successfully.');
      } else {
        setProfileMessage(response.message || 'Unable to submit profile right now.');
      }
    } catch (error: any) {
      const issueText = Array.isArray(error?.response?.data?.issues)
        ? error.response.data.issues
            .map((issue: any) => String(issue?.message || '').trim())
            .filter(Boolean)
            .join(', ')
        : '';
      setProfileMessage(issueText || error?.response?.data?.message || error?.message || 'Unable to submit profile right now.');
    } finally {
      setSubmittingProfile(false);
    }
  };

  const lowStockFabrics = fabrics.filter(f => f.stockMeters < 20);
  const featuredFabrics = fabrics.filter((fabric) => fabric.isFeatured);
  const pendingOrders = orders.filter(o => o.status === 'CONFIRMED');
  const filteredFabrics = useMemo(() => {
    const normalizedSearch = fabricSearch.trim().toLowerCase();
    return fabrics.filter((item) => {
      if (fabricStatusFilter && String(item.status || '').toUpperCase() !== fabricStatusFilter.toUpperCase()) {
        return false;
      }
      if (fabricMaterialFilter) {
        const materialId = String(item.materialTypeId || '');
        const materialName = String(item.materialType?.name || '');
        if (materialId !== fabricMaterialFilter && materialName !== fabricMaterialFilter) return false;
      }
      if (!normalizedSearch) return true;
      return (
        String(item.name || '').toLowerCase().includes(normalizedSearch) ||
        String(item.description || '').toLowerCase().includes(normalizedSearch) ||
        String(item.materialType?.name || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [fabrics, fabricSearch, fabricStatusFilter, fabricMaterialFilter]);
  const activeProfileFields = useMemo(
    () => (profileCompletion?.fields || []).filter((field) => field.isActive !== false),
    [profileCompletion?.fields]
  );
  const selectedProfileCountryField = activeProfileFields.find(isCountryGovernanceField);
  const selectedProfileCountry = selectedProfileCountryField
    ? profileForm[selectedProfileCountryField.key] || ''
    : profileCompletion?.profile?.country || '';
  const profileCityOptions = getCityOptionsByCountryCode(resolveCountryCode(selectedProfileCountry));
  const selectedListingCurrency = String(productForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD').toUpperCase();
  const selectedUsdPerUnit = Number(currencyOptions.usdPerUnitByCurrency?.[selectedListingCurrency] || 1);
  const localPricePreview = Number(productForm.sellerPrice || 0);
  const usdPricePreview =
    selectedListingCurrency === 'USD'
      ? localPricePreview
      : Number((localPricePreview * selectedUsdPerUnit).toFixed(2));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Seller Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your fabrics and track sales</p>
          {profileCompletion?.profile?.storefrontPath ? (
            <a
              href={profileCompletion.profile.storefrontPath}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex text-sm text-amber-700 hover:underline"
            >
              Storefront: {profileCompletion.profile.storefrontPath}
            </a>
          ) : null}
        </div>
        <Button onClick={openCreateProductModal} disabled={!profileCompletion?.canUpload}>
          <Plus className="w-4 h-4 mr-2" />
          Add Fabric Product
        </Button>
      </div>

      {!profileCompletion?.canUpload ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Complete vendor profile before uploading</h2>
            <p className="text-sm text-amber-800 mt-1">
              Status: <span className="font-semibold">{profileCompletion?.profileStatus || 'INCOMPLETE'}</span>. Upload actions stay locked until admin approval.
            </p>
            {profileCompletion?.profileReviewNotes ? (
              <p className="text-sm text-amber-900 mt-1">Admin note: {profileCompletion.profileReviewNotes}</p>
            ) : null}
          </div>

          {activeProfileFields.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeProfileFields.map((field) => {
                  const value = profileForm[field.key] || '';
                  const isTextArea = field.fieldType === 'TEXTAREA';
                  const isSelect = field.fieldType === 'SELECT' && Array.isArray(field.options) && field.options.length > 0;
                  const isCountryField = isCountryGovernanceField(field);
                  const isCityField = isCityGovernanceField(field);
                  return (
                    <div key={field.key} className={isTextArea ? 'md:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-amber-900 mb-1">
                        {field.label}
                        {field.required ? <span className="text-red-600 ml-1">*</span> : null}
                      </label>
                      {isCountryField ? (
                        <select
                          value={resolveCountryCode(value)}
                          onChange={(event) =>
                            setProfileForm((prev) => {
                              const next = { ...prev, [field.key]: resolveCountryName(event.target.value) };
                              for (const entry of activeProfileFields) {
                                if (entry.key !== field.key && isCityGovernanceField(entry)) {
                                  next[entry.key] = '';
                                }
                              }
                              return next;
                            })
                          }
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select country...</option>
                          {LOCATION_COUNTRIES.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.name}
                            </option>
                          ))}
                        </select>
                      ) : isCityField ? (
                        <select
                          value={value}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                          disabled={!selectedProfileCountry}
                        >
                          <option value="">
                            {selectedProfileCountry
                              ? profileCityOptions.length > 0
                                ? 'Select city...'
                                : 'No cities found for selected country'
                              : 'Select country first'}
                          </option>
                          {profileCityOptions.map((city) => (
                            <option key={city} value={city}>
                              {city}
                            </option>
                          ))}
                        </select>
                      ) : isSelect ? (
                        <select
                          value={value}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                        >
                          <option value="">Select...</option>
                          {(field.options || []).map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : isTextArea ? (
                        <textarea
                          value={value}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm min-h-[90px]"
                        />
                      ) : (
                        <input
                          type={field.fieldType === 'NUMBER' ? 'number' : 'text'}
                          value={value}
                          onChange={(event) => setProfileForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                          placeholder={field.placeholder || ''}
                          className="w-full rounded-lg border border-amber-200 px-3 py-2 text-sm"
                        />
                      )}
                      {field.helpText ? <p className="mt-1 text-xs text-amber-700">{field.helpText}</p> : null}
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-amber-900">
              Vendor application fields are unavailable right now. Please refresh, or ask admin to re-save Vendor Profile Governance fields.
            </p>
          )}

          {profileMessage ? <p className="text-sm text-amber-900">{profileMessage}</p> : null}
          {governanceDebug ? (
            <div className="rounded-lg border border-amber-300 bg-amber-100/60 p-3 text-xs text-amber-950">
              <p className="font-semibold">Governance debug (temporary)</p>
              <p>dashboard: {governanceDebug.dashboardCall}</p>
              <p>fabrics: {governanceDebug.fabricsCall}</p>
              <p>orders: {governanceDebug.ordersCall}</p>
              <p>profile-completion: {governanceDebug.profileCompletionCall}</p>
              <p>profile-fields: {governanceDebug.profileFieldsCall}</p>
              <p>completion fields: {governanceDebug.completionFieldCount}</p>
              <p>governance fields: {governanceDebug.governanceFieldCount}</p>
              <p>effective fields used: {governanceDebug.effectiveFieldCount}</p>
              <p>sample keys: {governanceDebug.sampleFieldKeys.join(', ') || 'none'}</p>
              {governanceDebug.error ? <p>error: {governanceDebug.error}</p> : null}
            </div>
          ) : null}
          <div>
            <Button size="sm" onClick={handleSubmitProfile} disabled={submittingProfile || activeProfileFields.length === 0}>
              {submittingProfile ? 'Submitting...' : 'Submit for Admin Approval'}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Fabrics"
          value={stats?.totalFabrics || 0}
          icon={Package}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
          subtitle="Active fabrics"
        />
        <StatCard
          title="Total Sales"
          value={stats?.totalSales || 0}
          change={stats?.salesChange}
          icon={ShoppingBag}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Revenue"
          value={`$${(stats?.totalRevenue || 0).toFixed(2)}`}
          change={stats?.revenueChange}
          icon={DollarSign}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-100"
        />
        <StatCard
          title="Pending Orders"
          value={stats?.pendingOrders || 0}
          icon={Clock}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          subtitle="Awaiting shipment"
        />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['overview', 'fabrics', 'featured', 'orders'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => syncTabWithUrl(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'orders' && pendingOrders.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingOrders.length}
                </span>
              )}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Low Stock Alert */}
          {lowStockFabrics.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">
                    Low Stock Alert
                  </p>
                  <p className="text-sm text-red-700">
                    {lowStockFabrics.length} fabric{lowStockFabrics.length > 1 ? 's are' : ' is'} running low on stock
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => syncTabWithUrl('fabrics')}
                >
                  Update Stock
                </Button>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Sales */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Sales</h3>
              <LineChart 
                data={stats?.monthlySales || [
                  { label: 'Jan', value: 45 },
                  { label: 'Feb', value: 52 },
                  { label: 'Mar', value: 68 },
                  { label: 'Apr', value: 61 },
                  { label: 'May', value: 85 },
                  { label: 'Jun', value: 92 },
                ]}
                height={200}
              />
            </div>

            {/* Top Fabrics */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Fabrics</h3>
              <BarChart 
                data={stats?.topFabrics || [
                  { label: 'Kente', value: 156, color: 'bg-amber-500' },
                  { label: 'Ankara', value: 142, color: 'bg-blue-500' },
                  { label: 'Aso Oke', value: 98, color: 'bg-purple-500' },
                  { label: 'Adinkra', value: 76, color: 'bg-green-500' },
                ]}
                height={200}
              />
            </div>
          </div>

          {/* Recent Orders & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
                <Button variant="ghost" size="sm" onClick={() => syncTabWithUrl('orders')}>
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-3">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{order.orderNumber}</p>
                      <p className="text-sm text-gray-500">{order.fabricName} · {order.meters}m</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-amber-700">${order.totalAmount.toFixed(2)}</p>
                      <Badge variant={
                        order.status === 'DELIVERED' ? 'green' :
                        order.status === 'SHIPPED_TO_DESIGNER' ? 'blue' :
                        order.status === 'CONFIRMED' ? 'yellow' : 'gray'
                      } size="sm">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity Feed */}
            <ActivityFeed activities={activities} title="Recent Activity" />
          </div>
        </>
      )}

      {activeTab === 'fabrics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">My Fabrics</h2>
            <Button size="sm" onClick={openCreateProductModal} disabled={!profileCompletion?.canUpload}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="w-full md:w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={fabricSearch}
                  onChange={(event) => setFabricSearch(event.target.value)}
                  className="w-full rounded-lg border py-2 pl-10 pr-4"
                />
              </div>
            </div>
            <select
              value={fabricMaterialFilter}
              onChange={(event) => setFabricMaterialFilter(event.target.value)}
              className="rounded-lg border px-4 py-2"
            >
              <option value="">All Materials</option>
              {materialOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <select
              value={fabricStatusFilter}
              onChange={(event) => setFabricStatusFilter(event.target.value)}
              className="rounded-lg border px-4 py-2"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <Button variant="outline" onClick={() => setFabricSearch((prev) => prev.trimStart())}>
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Stock</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFabrics.map((item) => {
                    const code = String(item.listingCurrencyCode || 'USD').toUpperCase();
                    const local = Number(item.listingLocalPrice || item.pricePerMeter || 0);
                    const usd = Number(item.listingUsdPrice || item.pricePerMeter || 0);
                    const priceText = code === 'USD' ? `$${usd.toFixed(2)} / yd` : `${code} ${local.toFixed(2)} / yd · USD ${usd.toFixed(2)}`;
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.materialType?.name || 'Material'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">FABRIC</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{priceText}</td>
                        <td className="px-4 py-3">
                          <span className={item.stockMeters < 20 ? 'font-medium text-red-600' : ''}>{item.stockMeters} yd</span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              item.status === 'APPROVED'
                                ? 'green'
                                : item.status === 'PENDING_REVIEW'
                                  ? 'yellow'
                                  : item.status === 'REJECTED'
                                    ? 'red'
                                    : 'gray'
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.orderCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => openEditProductModal(item)}
                              disabled={!profileCompletion?.canUpload}
                              className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Edit product"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openStockModal(item)}
                              className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                              title="Update stock"
                            >
                              <Package className="h-4 w-4" />
                            </button>
                            <Link
                              to={`/fabrics/${item.id}`}
                              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                              title="View"
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredFabrics.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">
                        No products found for the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'featured' && (
        <DataTable
          title="Featured Products"
          columns={[
            {
              key: 'name',
              header: 'Product',
              render: (item) => (
                <div className="flex items-center gap-3">
                  <img src={item.images[0] || '/images/placeholder.jpg'} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">{item.materialType?.name}</p>
                  </div>
                </div>
              ),
            },
            { key: 'pricePerMeter', header: 'Price', render: (item) => `$${item.pricePerMeter}/m` },
            {
              key: 'featuredSections',
              header: 'Homepage Sections',
              render: (item) => (
                <span className="text-xs text-gray-600">{(item.featuredSections || []).join(', ') || 'Featured'}</span>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => <Badge variant={item.status === 'ACTIVE' ? 'green' : 'gray'}>{item.status}</Badge>,
            },
          ]}
          data={featuredFabrics}
          keyExtractor={(item) => item.id}
          searchable
          searchKeys={['name', 'materialType.name']}
          emptyMessage="No featured fabrics yet. Ask admin to feature one of your products."
          actions={(item) => (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/fabrics/${item.id}`}>
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
          )}
        />
      )}

      {activeTab === 'orders' && (
        <DataTable
          title="All Fabric Orders"
          columns={[
            { key: 'orderNumber', header: 'Order ID' },
            { key: 'fabricName', header: 'Fabric' },
            { key: 'meters', header: 'Meters', render: (item) => `${item.meters}m` },
            { 
              key: 'totalAmount', 
              header: 'Amount',
              render: (item) => `$${item.totalAmount.toFixed(2)}`
            },
            { 
              key: 'designerCountry', 
              header: 'Destination',
              render: (item) => (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {item.designerCountry}
                </div>
              )
            },
            { 
              key: 'status', 
              header: 'Status',
              render: (item) => (
                <Badge variant={
                  item.status === 'DELIVERED' ? 'green' :
                  item.status === 'SHIPPED_TO_DESIGNER' ? 'blue' :
                  item.status === 'CONFIRMED' ? 'yellow' : 'gray'
                }>
                  {item.status}
                </Badge>
              )
            },
          ]}
          data={orders}
          keyExtractor={(item) => item.id}
          searchable
          searchKeys={['orderNumber', 'fabricName', 'designerCountry']}
          actions={(item) => (
            <div className="flex gap-2">
              {item.status === 'CONFIRMED' && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'SHIPPED_TO_DESIGNER')}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  Ship
                </Button>
              )}
            </div>
          )}
        />
      )}

      {/* Product Create/Edit Modal */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isEditMode ? 'Update Fabric Product' : 'Add Fabric Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">Fabrics require 3 to 4 image URLs.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabric Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. Premium Ankara Cotton"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[90px]"
                  placeholder="Describe fabric quality, weave, and best use."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                <select
                  value={productForm.materialTypeId}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, materialTypeId: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {materialOptions.length === 0 ? (
                    <option value="">No material types found</option>
                  ) : null}
                  {materialOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seller Price ({selectedListingCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={productForm.sellerPrice}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, sellerPrice: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">Converted USD: ${usdPricePreview.toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Currency</label>
                <select
                  value={productForm.priceCurrencyCode}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={(currencyOptions.allowedCurrencies || []).length <= 1}
                >
                  {(currencyOptions.allowedCurrencies || [currencyOptions.defaultCurrency || 'USD']).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Yards</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={productForm.minYards}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, minYards: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Yards</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.stockYards}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, stockYards: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URLs (one per line)</label>
                <textarea
                  value={productForm.imageUrls}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, imageUrls: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[120px]"
                  placeholder={'https://.../image1.jpg\nhttps://.../image2.jpg\nhttps://.../image3.jpg'}
                />
              </div>
            </div>

            {productError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {productError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowProductModal(false);
                  resetProductForm();
                }}
                disabled={isSavingProduct}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveProduct} disabled={isSavingProduct}>
                {isSavingProduct ? 'Saving...' : isEditMode ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Update Modal */}
      {showStockModal && selectedFabric && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-lg rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Update Stock: {selectedFabric.name}
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Stock: {selectedFabric.stockMeters}m
              </label>
              <input
                type="number"
                value={newStock}
                onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                className="w-full px-4 py-2 border rounded-lg"
                min="0"
              />
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowStockModal(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                onClick={() => handleUpdateStock(selectedFabric.id, newStock)}
              >
                Update Stock
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
