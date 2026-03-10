import { useState, useEffect, useMemo } from 'react';
import { 
  Scissors, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag,
  Plus,
  Edit,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Star,
  Calendar,
  MessageSquare,
  ArrowRight,
  TrendingDown,
  Palette,
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

interface DesignerStats {
  totalDesigns: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  inProductionOrders: number;
  completedOrders: number;
  monthlyRevenue: { label: string; value: number }[];
  topDesigns: { label: string; value: number }[];
  rating: number;
  revenueChange: number;
  orderChange: number;
}

interface Design {
  id: string;
  name: string;
  description: string;
  categoryId?: string;
  basePrice: number;
  images: string[];
  category: { name: string };
  suitableFabrics: Array<{ fabricId: string; yardsNeeded: number }>;
  measurementVariables: Array<{ name: string; unit: string; isRequired: boolean; instructions?: string }>;
  rating: number;
  orderCount: number;
  status: string;
  createdAt: string;
  isFeatured?: boolean;
  featuredSections?: string[];
  listingCurrencyCode?: string;
  listingLocalPrice?: number;
  listingUsdPrice?: number;
}

interface ReadyProduct {
  id: string;
  name: string;
  description: string;
  category: { name: string };
  basePrice: number;
  status: string;
  images: string[];
  orderCount: number;
  isFeatured?: boolean;
  featuredSections?: string[];
  listingCurrencyCode?: string;
  listingLocalPrice?: number;
  listingUsdPrice?: number;
}

interface DesignOrder {
  id: string;
  orderId: string;
  orderNumber: string;
  designName: string;
  customerName: string;
  measurements: Record<string, number>;
  fabricInfo: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  dueDate: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface Activity {
  id: string;
  type: 'order' | 'review' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

interface ProductCategoryOption {
  id: string;
  name: string;
}

interface FabricOption {
  id: string;
  name: string;
}

interface DesignFormState {
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  imageUrls: string;
  selectedFabricIds: string[];
  yardsByFabricId: Record<string, string>;
  measurementLines: string;
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

interface DesignerProfileCompletion {
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
    bio?: string;
    storefrontPath?: string;
  };
  profileData?: Record<string, any>;
  fields?: VendorProfileField[];
}

interface GovernanceDebugInfo {
  dashboardCall: string;
  designsCall: string;
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

const getDesignerProfilePrefillValue = (profile: DesignerProfileCompletion['profile'] | undefined, key: string) => {
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
  if (normalized.includes('bio') || normalized.includes('about') || normalized.includes('description')) {
    return String(profile.bio || '');
  }
  return '';
};

export default function DesignerDashboard() {
  const [stats, setStats] = useState<DesignerStats | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [orders, setOrders] = useState<DesignOrder[]>([]);
  const [readyProducts, setReadyProducts] = useState<ReadyProduct[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);
  const [fabricOptions, setFabricOptions] = useState<FabricOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'designs' | 'featured' | 'orders'>('overview');
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [designForm, setDesignForm] = useState<DesignFormState>({
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
    imageUrls: '',
    selectedFabricIds: [],
    yardsByFabricId: {},
    measurementLines: 'chest|cm|required\nwaist|cm|required\nhips|cm|required',
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
  const [profileCompletion, setProfileCompletion] = useState<DesignerProfileCompletion | null>(null);
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [governanceDebug, setGovernanceDebug] = useState<GovernanceDebugInfo | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [productSearch, setProductSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');

  const syncTabWithUrl = (tab: 'overview' | 'designs' | 'featured' | 'orders') => {
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
    if (tabParam === 'designs' || tabParam === 'featured' || tabParam === 'orders' || tabParam === 'overview') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsResult, designsResult, readyResult, ordersResult, categoriesResult, fabricsResult, currencyResult] = await Promise.allSettled([
        api.designer.getDashboard(),
        api.designer.getDesigns(),
        api.designer.getReadyToWear(),
        api.designer.getOrders(),
        api.products.getCategories(),
        api.products.getFabrics({ limit: 200 }),
        api.currency.getMyOptions(),
      ]);
      const statsRes = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const designsRes = designsResult.status === 'fulfilled' ? designsResult.value : null;
      const readyRes = readyResult.status === 'fulfilled' ? readyResult.value : null;
      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const categoriesRes = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;
      const fabricsRes = fabricsResult.status === 'fulfilled' ? fabricsResult.value : null;
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
      const dashboardCompletion = statsRes?.success ? statsRes.data?.profileCompletion : null;
      let profileCompletionCallStatus = dashboardCompletion ? 'from-dashboard' : 'skipped';
      let profileFieldsCallStatus = dashboardCompletion ? 'from-dashboard' : 'skipped';
      let profileRes: any = null;
      let profileFieldsRes: any = null;
      if (!dashboardCompletion) {
        const [profileResult, profileFieldsResult] = await Promise.allSettled([
          api.designer.getProfileCompletion(),
          api.designer.getProfileFields(),
        ]);
        profileRes = profileResult.status === 'fulfilled' ? profileResult.value : null;
        profileFieldsRes = profileFieldsResult.status === 'fulfilled' ? profileFieldsResult.value : null;
        profileCompletionCallStatus = settledCallStatus(profileResult);
        profileFieldsCallStatus = settledCallStatus(profileFieldsResult);
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

      const mappedOrders: DesignOrder[] = ordersRes?.success
        ? (ordersRes.data || []).map((item: any) => {
            const shippingAddress = toAddressObject(item.order?.shippingAddress);
            const createdAt = item.order?.createdAt || item.createdAt;
            const dueDate = new Date(new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            return {
              id: String(item.id),
              orderId: String(item.orderId || ''),
              orderNumber: item.order?.orderNumber || 'N/A',
              designName: item.design?.name || 'Design',
              customerName: shippingAddress?.fullName || 'Customer',
              measurements: (item.measurements && typeof item.measurements === 'object') ? item.measurements : {},
              fabricInfo: 'Included in order details',
              totalAmount: Number(item.price || 0),
              status: item.status || 'PENDING',
              createdAt,
              dueDate,
              priority: item.status === 'PENDING' ? 'HIGH' : 'MEDIUM',
            };
          })
        : [];

      if (statsRes?.success) {
        const baseStats = statsRes.data?.stats || {};
        setStats({
          totalDesigns: Number(baseStats.totalDesigns || 0),
          totalOrders: Number(baseStats.totalOrders || 0),
          totalRevenue: Number(baseStats.totalRevenue || 0),
          pendingOrders: Number(baseStats.pendingOrders || 0),
          inProductionOrders: mappedOrders.filter((order) => order.status === 'IN_PRODUCTION').length,
          completedOrders: mappedOrders.filter((order) => order.status === 'COMPLETED').length,
          monthlyRevenue: [],
          topDesigns: [],
          rating: 0,
          revenueChange: 0,
          orderChange: 0,
        });
      }
      if (designsRes?.success) {
        const mappedDesigns = (designsRes.data || []).map((design: any) => ({
          id: String(design.id),
          name: design.name || 'Design',
          description: design.description || '',
          categoryId: design.categoryId || design.category?.id || '',
          basePrice: Number(design.basePrice || 0),
          images: Array.isArray(design.images) ? design.images.map((img: any) => img?.url).filter(Boolean) : [],
          category: design.category || { name: 'Category' },
          suitableFabrics: Array.isArray(design.suitableFabrics)
            ? design.suitableFabrics.map((item: any) => ({
                fabricId: String(item.fabricId || item.fabric?.id || ''),
                yardsNeeded: Number(item.yardsNeeded || 1),
              }))
            : [],
          measurementVariables: Array.isArray(design.measurementVariables)
            ? design.measurementVariables.map((item: any) => ({
                name: String(item.name || ''),
                unit: String(item.unit || 'cm'),
                isRequired: Boolean(item.isRequired ?? true),
                instructions: item.instructions ? String(item.instructions) : undefined,
              }))
            : [],
          rating: Number(design.rating || 0),
          orderCount: Number(design?._count?.orderItems || 0),
          status: design.status || 'DRAFT',
          createdAt: design.createdAt,
          isFeatured: Boolean(design.isFeatured),
          featuredSections: Array.isArray(design.featuredSections) ? design.featuredSections : [],
          listingCurrencyCode: String(design.listingCurrencyCode || 'USD'),
          listingLocalPrice: Number(design.listingLocalPrice || design.basePrice || 0),
          listingUsdPrice: Number(design.listingUsdPrice || design.basePrice || 0),
        }));
        setDesigns(mappedDesigns);
      }
      if (readyRes?.success) {
        const mappedReady = (readyRes.data || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Ready To Wear',
          description: item.description || '',
          category: item.category || { name: 'Category' },
          basePrice: Number(item.basePrice || 0),
          status: item.status || 'DRAFT',
          images: Array.isArray(item.images) ? item.images.map((img: any) => img?.url).filter(Boolean) : [],
          orderCount: Number(item?._count?.orderItems || 0),
          isFeatured: Boolean(item.isFeatured),
          featuredSections: Array.isArray(item.featuredSections) ? item.featuredSections : [],
          listingCurrencyCode: String(item.listingCurrencyCode || 'USD'),
          listingLocalPrice: Number(item.listingLocalPrice || item.basePrice || 0),
          listingUsdPrice: Number(item.listingUsdPrice || item.basePrice || 0),
        }));
        setReadyProducts(mappedReady);
      }
      if (ordersRes?.success) setOrders(mappedOrders);
      if (categoriesRes?.success) {
        setCategories(
          Array.isArray(categoriesRes.data)
            ? categoriesRes.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Category') }))
            : []
        );
      }
      if (fabricsRes?.success) {
        const rows = Array.isArray(fabricsRes.data?.fabrics) ? fabricsRes.data.fabrics : [];
        setFabricOptions(rows.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Fabric') })));
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
      const completionPayload = dashboardCompletion || (profileRes?.success ? profileRes.data : null);
      const governanceFields = profileFieldsRes?.success && Array.isArray(profileFieldsRes.data?.fields)
        ? profileFieldsRes.data.fields.filter((entry: any) => entry?.isActive !== false)
        : [];
      const completionFieldCount = completionPayload && Array.isArray((completionPayload as any)?.fields)
        ? (completionPayload as any).fields.filter((entry: any) => entry?.isActive !== false).length
        : 0;
      const profileRoutesMissing =
        !dashboardCompletion &&
        completionFieldCount === 0 &&
        governanceFields.length === 0 &&
        String(profileCompletionCallStatus).toLowerCase().includes('route not found') &&
        String(profileFieldsCallStatus).toLowerCase().includes('route not found');
      if (completionPayload) {
        const completion = completionPayload as DesignerProfileCompletion;
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
              ? getDesignerProfilePrefillValue(completion.profile, field.key)
              : String(rawValue);
        }
        setProfileForm(nextProfileForm);
        if (effectiveFields.length === 0) {
          setProfileMessage('Vendor governance fields are empty for Fashion Designer. Please verify API deployment and re-save Vendor Profile Governance fields.');
        }
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: effectiveFields.length,
          sampleFieldKeys: governanceFields.slice(0, 5).map((field: any) => String(field?.key || '')).filter(Boolean),
        });
      } else if (governanceFields.length > 0) {
        const fallbackProfile = (statsRes?.success ? statsRes.data?.profile : null) || {};
        const syntheticCompletion: DesignerProfileCompletion = {
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
            bio: String(fallbackProfile?.bio || ''),
            storefrontPath: String(fallbackProfile?.storefrontPath || ''),
          },
          profileData: {},
          fields: governanceFields,
        };
        setProfileCompletion(syntheticCompletion);
        const nextProfileForm: Record<string, string> = {};
        for (const field of governanceFields) {
          nextProfileForm[field.key] = getDesignerProfilePrefillValue(syntheticCompletion.profile, field.key);
        }
        setProfileForm(nextProfileForm);
        setProfileMessage('Vendor profile governance loaded directly. Complete and submit for admin approval.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: governanceFields.length,
          sampleFieldKeys: governanceFields.slice(0, 5).map((field: any) => String(field?.key || '')).filter(Boolean),
        });
      } else if (profileRoutesMissing && statsRes?.success) {
        const fallbackProfile = statsRes.data?.profile || {};
        setProfileCompletion({
          canUpload: true,
          profileStatus: 'APPROVED',
          profile: {
            businessName: String(fallbackProfile?.businessName || ''),
            businessEmail: String(fallbackProfile?.businessEmail || ''),
            businessPhone: String(fallbackProfile?.businessPhone || ''),
            country: String(fallbackProfile?.country || ''),
            city: String(fallbackProfile?.city || ''),
            address: String(fallbackProfile?.address || ''),
            website: String(fallbackProfile?.website || ''),
            bio: String(fallbackProfile?.bio || ''),
            storefrontPath: String(fallbackProfile?.storefrontPath || ''),
          },
          profileData: {},
          fields: [],
        });
        setProfileForm({});
        setProfileMessage(null);
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: `${profileCompletionCallStatus} (isolated)`,
          profileFieldsCall: `${profileFieldsCallStatus} (isolated)`,
          completionFieldCount,
          governanceFieldCount: governanceFields.length,
          effectiveFieldCount: 0,
          sampleFieldKeys: [],
          error: 'Governance endpoints missing in deployment; compatibility mode enabled.',
        });
      } else {
        setProfileMessage('Unable to load vendor application fields right now. Please refresh the page.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
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
          title: 'New order received',
          description: 'Order #D-2024-089 for Royal Kente Gown',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        },
        {
          id: '2',
          type: 'review',
          title: '5-star review received',
          description: 'Customer loved the Ankara Maxi Dress',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '3',
          type: 'order',
          title: 'Order completed',
          description: 'Order #D-2024-076 delivered successfully',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        },
        {
          id: '4',
          type: 'system',
          title: 'Payout processed',
          description: '$1,250.00 deposited to your account',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      setGovernanceDebug({
        dashboardCall: 'not-reached',
        designsCall: 'not-reached',
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

  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.designer.updateOrderStatus(orderId, status);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to update order status:', error);
    }
  };

  useEffect(() => {
    if (categories.length > 0 && !designForm.categoryId) {
      setDesignForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, designForm.categoryId]);

  const resetDesignForm = () => {
    setDesignForm({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      basePrice: '',
      imageUrls: '',
      selectedFabricIds: [],
      yardsByFabricId: {},
      measurementLines: 'chest|cm|required\nwaist|cm|required\nhips|cm|required',
      priceCurrencyCode: currencyOptions.defaultCurrency || 'USD',
    });
    setSelectedDesign(null);
    setIsEditMode(false);
    setDesignError(null);
  };

  const openCreateDesignModal = () => {
    resetDesignForm();
    setShowDesignModal(true);
  };

  const openEditDesignModal = (design: Design) => {
    const yardsByFabricId = (design.suitableFabrics || []).reduce<Record<string, string>>((acc, item) => {
      if (item.fabricId) acc[item.fabricId] = String(item.yardsNeeded || 1);
      return acc;
    }, {});
    const measurementLines = (design.measurementVariables || [])
      .map((variable) =>
        [variable.name, variable.unit || 'cm', variable.isRequired ? 'required' : 'optional', variable.instructions || '']
          .filter(Boolean)
          .join('|')
      )
      .join('\n');

    setSelectedDesign(design);
    setIsEditMode(true);
    setDesignError(null);
    setDesignForm({
      name: design.name,
      description: design.description || '',
      categoryId: design.categoryId || categories[0]?.id || '',
      basePrice: String(design.listingLocalPrice || design.basePrice || ''),
      imageUrls: (design.images || []).join('\n'),
      selectedFabricIds: (design.suitableFabrics || []).map((item) => item.fabricId).filter(Boolean),
      yardsByFabricId,
      measurementLines: measurementLines || 'chest|cm|required\nwaist|cm|required\nhips|cm|required',
      priceCurrencyCode: String(design.listingCurrencyCode || currencyOptions.defaultCurrency || 'USD'),
    });
    setShowDesignModal(true);
  };

  const parseImageInputs = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

  const parseMeasurementLines = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name = '', unit = 'cm', required = 'required', ...rest] = line.split('|').map((item) => item.trim());
        return {
          name,
          unit: unit || 'cm',
          isRequired: required.toLowerCase() !== 'optional',
          instructions: rest.join('|') || undefined,
        };
      })
      .filter((row) => row.name);

  const toggleFabricSelection = (fabricId: string) => {
    setDesignForm((prev) => {
      const exists = prev.selectedFabricIds.includes(fabricId);
      const selectedFabricIds = exists
        ? prev.selectedFabricIds.filter((id) => id !== fabricId)
        : [...prev.selectedFabricIds, fabricId];
      const yardsByFabricId = { ...prev.yardsByFabricId };
      if (!exists && !yardsByFabricId[fabricId]) {
        yardsByFabricId[fabricId] = '1';
      }
      if (exists) {
        delete yardsByFabricId[fabricId];
      }
      return { ...prev, selectedFabricIds, yardsByFabricId };
    });
  };

  const handleSaveDesign = async () => {
    setDesignError(null);
    const images = parseImageInputs(designForm.imageUrls);
    const measurementVariables = parseMeasurementLines(designForm.measurementLines);
    const suitableFabricIds = designForm.selectedFabricIds.map((fabricId) => ({
      fabricId,
      yardsNeeded: Number(designForm.yardsByFabricId[fabricId] || 1),
    }));

    if (!designForm.name.trim()) {
      setDesignError('Design name is required.');
      return;
    }
    if (!designForm.description.trim() || designForm.description.trim().length < 10) {
      setDesignError('Description must be at least 10 characters.');
      return;
    }
    if (!designForm.categoryId) {
      setDesignError('Please select a category.');
      return;
    }
    if (Number(designForm.basePrice || 0) <= 0) {
      setDesignError('Base price must be greater than zero.');
      return;
    }
    if (images.length < 4 || images.length > 6) {
      setDesignError('Custom-to-wear designs require 4 to 6 images.');
      return;
    }
    if (suitableFabricIds.length === 0) {
      setDesignError('Select at least one suitable fabric.');
      return;
    }
    if (measurementVariables.length === 0) {
      setDesignError('Add at least one measurement variable.');
      return;
    }
    if (suitableFabricIds.some((item) => Number(item.yardsNeeded || 0) < 1)) {
      setDesignError('Each selected fabric must have yardsNeeded >= 1.');
      return;
    }

    const payload = {
      name: designForm.name.trim(),
      description: designForm.description.trim(),
      categoryId: designForm.categoryId,
      basePrice: Number(designForm.basePrice),
      priceCurrencyCode: designForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD',
      suitableFabricIds,
      measurementVariables,
      images,
    };

    setIsSavingDesign(true);
    try {
      if (isEditMode && selectedDesign) {
        await api.designer.updateDesign(selectedDesign.id, payload);
      } else {
        await api.designer.createDesign(payload);
      }
      setShowDesignModal(false);
      resetDesignForm();
      await fetchDashboardData();
      syncTabWithUrl('designs');
    } catch (error: any) {
      setDesignError(error?.message || 'Unable to save design right now.');
    } finally {
      setIsSavingDesign(false);
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
      const response = await api.designer.updateProfileCompletion({
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

  const productRows = [
    ...designs.map((item) => ({ ...item, productType: 'CUSTOM_TO_WEAR' as const })),
    ...readyProducts.map((item) => ({ ...item, productType: 'READY_TO_WEAR' as const })),
  ];
  const filteredProductRows = useMemo(() => {
    const normalizedSearch = productSearch.trim().toLowerCase();
    return productRows.filter((item) => {
      if (productTypeFilter && item.productType !== productTypeFilter) return false;
      if (productStatusFilter && String(item.status || '').toUpperCase() !== productStatusFilter.toUpperCase()) return false;
      if (productCategoryFilter && String(item.category?.name || '') !== productCategoryFilter) return false;
      if (!normalizedSearch) return true;
      return (
        String(item.name || '').toLowerCase().includes(normalizedSearch) ||
        String(item.category?.name || '').toLowerCase().includes(normalizedSearch) ||
        String(item.productType || '').toLowerCase().includes(normalizedSearch)
      );
    });
  }, [productRows, productSearch, productTypeFilter, productStatusFilter, productCategoryFilter]);
  const featuredRows = productRows.filter((item) => item.isFeatured);
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const activeProfileFields = useMemo(
    () => (profileCompletion?.fields || []).filter((field) => field.isActive !== false),
    [profileCompletion?.fields]
  );
  const selectedProfileCountryField = activeProfileFields.find(isCountryGovernanceField);
  const selectedProfileCountry = selectedProfileCountryField
    ? profileForm[selectedProfileCountryField.key] || ''
    : profileCompletion?.profile?.country || '';
  const profileCityOptions = getCityOptionsByCountryCode(resolveCountryCode(selectedProfileCountry));
  const selectedListingCurrency = String(designForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD').toUpperCase();
  const selectedUsdPerUnit = Number(currencyOptions.usdPerUnitByCurrency?.[selectedListingCurrency] || 1);
  const localPricePreview = Number(designForm.basePrice || 0);
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
          <h1 className="text-2xl font-bold text-gray-900">Designer Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your designs and track orders</p>
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
        <Button onClick={openCreateDesignModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Design Product
        </Button>
      </div>

      {profileCompletion ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-amber-900">Vendor governance profile</h2>
            <p className="text-sm text-amber-800 mt-1">
              Status: <span className="font-semibold">{profileCompletion?.profileStatus || 'INCOMPLETE'}</span>. Upload restriction is temporarily disabled while governance fields are validated.
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
              <p>designs: {governanceDebug.designsCall}</p>
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
          title="Total Designs"
          value={stats?.totalDesigns || 0}
          icon={Palette}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          subtitle="Active designs"
        />
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          change={stats?.orderChange}
          icon={ShoppingBag}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Revenue"
          value={`$${(stats?.totalRevenue || 0).toFixed(2)}`}
          change={stats?.revenueChange}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Rating"
          value={`${(stats?.rating || 0).toFixed(1)} ⭐`}
          icon={Star}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-100"
          subtitle="Average rating"
        />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['overview', 'designs', 'featured', 'orders'] as const).map((tab) => (
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
          {/* Order Status & Revenue Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Order Status</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-900">Pending</span>
                  </div>
                  <span className="text-xl font-bold text-yellow-700">{stats?.pendingOrders || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Scissors className="w-5 h-5 text-purple-600" />
                    <span className="text-sm font-medium text-purple-900">In Production</span>
                  </div>
                  <span className="text-xl font-bold text-purple-700">{stats?.inProductionOrders || 0}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">Completed</span>
                  </div>
                  <span className="text-xl font-bold text-green-700">{stats?.completedOrders || 0}</span>
                </div>
              </div>
            </div>

            {/* Revenue Chart */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue</h3>
              <LineChart 
                data={stats?.monthlyRevenue || [
                  { label: 'Jan', value: 1200 },
                  { label: 'Feb', value: 1800 },
                  { label: 'Mar', value: 2400 },
                  { label: 'Apr', value: 2100 },
                  { label: 'May', value: 3200 },
                  { label: 'Jun', value: 3800 },
                ]}
                height={200}
              />
            </div>
          </div>

          {/* Top Designs & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Designs */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Designs</h3>
              <BarChart 
                data={stats?.topDesigns || [
                  { label: 'Kente Gown', value: 45, color: 'bg-amber-500' },
                  { label: 'Ankara Dress', value: 38, color: 'bg-blue-500' },
                  { label: 'Dashiki', value: 32, color: 'bg-purple-500' },
                  { label: 'Boubou', value: 28, color: 'bg-green-500' },
                ]}
                height={180}
              />
            </div>

            {/* Activity Feed */}
            <ActivityFeed activities={activities} title="Recent Activity" />
          </div>

          {/* Pending Orders Alert */}
          {pendingOrders.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <div className="flex-1">
                  <p className="font-medium text-amber-900">
                    You have {pendingOrders.length} pending order{pendingOrders.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-amber-700">
                    Start production to keep your customers happy
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => syncTabWithUrl('orders')}
                >
                  View Orders
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'designs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">My Products</h2>
            <Button size="sm" onClick={openCreateDesignModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Custom Product
            </Button>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="w-full md:w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  className="w-full rounded-lg border py-2 pl-10 pr-4"
                />
              </div>
            </div>
            <select
              value={productTypeFilter}
              onChange={(event) => setProductTypeFilter(event.target.value)}
              className="rounded-lg border px-4 py-2"
            >
              <option value="">All Types</option>
              <option value="CUSTOM_TO_WEAR">Custom To Wear</option>
              <option value="READY_TO_WEAR">Ready To Wear</option>
            </select>
            <select
              value={productStatusFilter}
              onChange={(event) => setProductStatusFilter(event.target.value)}
              className="rounded-lg border px-4 py-2"
            >
              <option value="">All Status</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_REVIEW">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
            <select
              value={productCategoryFilter}
              onChange={(event) => setProductCategoryFilter(event.target.value)}
              className="rounded-lg border px-4 py-2"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
            <Button variant="outline" onClick={() => setProductSearch((prev) => prev.trimStart())}>
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Featured</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Orders</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProductRows.map((item) => {
                    const code = String(item.listingCurrencyCode || 'USD').toUpperCase();
                    const local = Number(item.listingLocalPrice || item.basePrice || 0);
                    const usd = Number(item.listingUsdPrice || item.basePrice || 0);
                    const priceText = code === 'USD' ? `$${usd.toFixed(2)}` : `${code} ${local.toFixed(2)} · USD ${usd.toFixed(2)}`;
                    return (
                      <tr key={`${item.productType}-${item.id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.productType === 'READY_TO_WEAR' ? 'Ready To Wear' : 'Custom To Wear'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{item.productType}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{priceText}</td>
                        <td className="px-4 py-3 text-gray-600">{item.category?.name || 'Category'}</td>
                        <td className="px-4 py-3">
                          <Badge variant={item.isFeatured ? 'green' : 'gray'}>{item.isFeatured ? 'YES' : 'NO'}</Badge>
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
                            {item.productType !== 'READY_TO_WEAR' ? (
                              <button
                                onClick={() => openEditDesignModal(item as Design)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit product"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            ) : null}
                            <Link
                              to={item.productType === 'READY_TO_WEAR' ? `/ready-to-wear/${item.id}` : `/designs/${item.id}`}
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
                  {filteredProductRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">
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
                  <img src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.productType === 'READY_TO_WEAR' ? 'Ready To Wear' : 'Custom To Wear'}
                    </p>
                  </div>
                </div>
              ),
            },
            {
              key: 'basePrice',
              header: 'Price',
              render: (item) => {
                const code = String(item.listingCurrencyCode || 'USD').toUpperCase();
                const local = Number(item.listingLocalPrice || item.basePrice || 0);
                const usd = Number(item.listingUsdPrice || item.basePrice || 0);
                if (code === 'USD') return `$${usd.toFixed(2)}`;
                return `${code} ${local.toFixed(2)} · USD ${usd.toFixed(2)}`;
              },
            },
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
          data={featuredRows}
          keyExtractor={(item) => `${item.productType}-${item.id}`}
          searchable
          searchKeys={['name', 'productType']}
          emptyMessage="No featured products yet. Ask admin to feature one of your products."
          actions={(item) => (
            <Button variant="outline" size="sm" asChild>
              <Link to={item.productType === 'READY_TO_WEAR' ? `/ready-to-wear/${item.id}` : `/designs/${item.id}`}>
                <Eye className="w-4 h-4" />
              </Link>
            </Button>
          )}
        />
      )}

      {showDesignModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isEditMode ? 'Update Design Product' : 'Add Design Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Custom-to-wear designs require 4 to 6 images and at least one suitable fabric.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
                <input
                  type="text"
                  value={designForm.name}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. Royal Kente Evening Gown"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={designForm.description}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[90px]"
                  placeholder="Describe style, fit, silhouette, and special details."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={designForm.categoryId}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  {categories.length === 0 ? <option value="">No categories found</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base Price ({selectedListingCurrency})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={designForm.basePrice}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
                <p className="mt-1 text-xs text-gray-500">Converted USD: ${usdPricePreview.toFixed(2)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Currency</label>
                <select
                  value={designForm.priceCurrencyCode}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
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

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Image URLs (one per line)</label>
                <textarea
                  value={designForm.imageUrls}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, imageUrls: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[100px]"
                  placeholder={'https://.../image1.jpg\nhttps://.../image2.jpg\nhttps://.../image3.jpg\nhttps://.../image4.jpg'}
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">Suitable Fabrics (select and set yards)</label>
                <div className="max-h-44 overflow-y-auto rounded-lg border p-3 space-y-2">
                  {fabricOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">No approved fabrics found.</p>
                  ) : (
                    fabricOptions.map((fabric) => {
                      const selected = designForm.selectedFabricIds.includes(fabric.id);
                      return (
                        <div key={fabric.id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleFabricSelection(fabric.id)}
                          />
                          <span className="flex-1 text-sm text-gray-800">{fabric.name}</span>
                          {selected ? (
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={designForm.yardsByFabricId[fabric.id] || '1'}
                              onChange={(e) =>
                                setDesignForm((prev) => ({
                                  ...prev,
                                  yardsByFabricId: { ...prev.yardsByFabricId, [fabric.id]: e.target.value },
                                }))
                              }
                              className="w-20 px-2 py-1 border rounded text-sm"
                            />
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Measurement Variables (one per line: name|unit|required/optional|instructions)
                </label>
                <textarea
                  value={designForm.measurementLines}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, measurementLines: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[100px]"
                />
              </div>
            </div>

            {designError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {designError}
              </div>
            ) : null}

            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowDesignModal(false);
                  resetDesignForm();
                }}
                disabled={isSavingDesign}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleSaveDesign} disabled={isSavingDesign}>
                {isSavingDesign ? 'Saving...' : isEditMode ? 'Update Product' : 'Add Product'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'orders' && (
        <DataTable
          title="All Orders"
          columns={[
            { key: 'orderNumber', header: 'Order ID' },
            { key: 'designName', header: 'Design' },
            { key: 'customerName', header: 'Customer' },
            { 
              key: 'totalAmount', 
              header: 'Amount',
              render: (item) => `$${item.totalAmount.toFixed(2)}`
            },
            { 
              key: 'dueDate', 
              header: 'Due Date',
              render: (item) => new Date(item.dueDate).toLocaleDateString()
            },
            { 
              key: 'status', 
              header: 'Status',
              render: (item) => (
                <Badge variant={
                  item.status === 'COMPLETED' ? 'green' :
                  item.status === 'IN_PRODUCTION' ? 'purple' :
                  item.status === 'PENDING' ? 'yellow' : 'gray'
                }>
                  {item.status}
                </Badge>
              )
            },
          ]}
          data={orders}
          keyExtractor={(item) => item.id}
          searchable
          searchKeys={['orderNumber', 'designName', 'customerName']}
          actions={(item) => (
            <div className="flex gap-2">
              {item.status === 'PENDING' && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'IN_PRODUCTION')}
                >
                  Start
                </Button>
              )}
              {item.status === 'IN_PRODUCTION' && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'COMPLETED')}
                >
                  Complete
                </Button>
              )}
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          )}
        />
      )}
    </div>
  );
}
