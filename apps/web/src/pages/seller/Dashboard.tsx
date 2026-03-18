import { useState, useEffect, useMemo, useRef } from 'react';
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
  Filter,
  Upload,
  X,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, LineChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import OrderSupportModal from '../../components/orders/OrderSupportModal';
import { getCityOptionsByCountryCode, getCountryOptions, resolveCountryCode, resolveCountryName } from '../../data/locationOptions';
import { normalizePhoneWithCountryPrefix } from '../../utils/phone';

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

type AutomationReportRow = {
  key: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'NEEDS_AI' | 'SKIPPED' | string;
  message: string;
};

type ProductAutomationOutcome = {
  evaluationStatus: string;
  action: string;
  failureSeverity: 'NONE' | 'MID' | 'MAJOR' | string;
  needsCorrection: boolean;
  summaryMessage: string;
  report: AutomationReportRow[];
  updatedAt?: string | null;
};

interface Fabric {
  id: string;
  name: string;
  description: string;
  materialTypeId?: string;
  predominantColor?: string;
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
  approvedEditableFields?: string[];
  approvedEditAccessEndsAt?: string | null;
  automationOutcome?: ProductAutomationOutcome | null;
  aiAutomationApprovedTag?: boolean;
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

interface FeaturedRequest {
  id: string;
  requestStatus: string;
  paymentStatus: string;
  productEntries: Array<{ productId: string; productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'; section?: string | null }>;
  requestedDurationValue?: number | null;
  requestedDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  approvedDurationValue?: number | null;
  approvedDurationUnit?: 'DAYS' | 'WEEKS' | 'MONTHS' | null;
  approvedPriceUsd?: number | null;
  paymentProviderKey?: string | null;
  paymentReference?: string | null;
  activationEndsAt?: string | null;
  createdAt: string;
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
  predominantColor: string;
  sellerPrice: string;
  minYards: string;
  stockYards: string;
  imageUrls: string;
  priceCurrencyCode: string;
}

interface PaymentProviderOption {
  providerKey: string;
  displayName: string;
  checkoutType: 'INLINE' | 'REDIRECT';
  mode: 'TEST' | 'LIVE';
}

const FABRIC_COLOR_OPTIONS = [
  'BLACK',
  'BLUE',
  'BROWN',
  'GOLD',
  'GREEN',
  'GREY',
  'MULTI',
  'ORANGE',
  'PINK',
  'PURPLE',
  'RED',
  'WHITE',
  'YELLOW',
];
const ALL_FABRIC_EDITABLE_FIELDS = [
  'name',
  'description',
  'materialTypeId',
  'predominantColor',
  'sellerPrice',
  'minYards',
  'stockYards',
  'images',
] as const;

const toReadableAutomationMessage = (value: string) =>
  String(value || '')
    .replace(/\bAI verification:\s*/gi, 'Review note: ')
    .replace(/\bAI guidance:\s*/gi, 'Recommended update: ')
    .replace(/\bAI execution error:\s*/gi, 'Processing error: ')
    .replace(/\bAI\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const normalizeAutomationOutcome = (value: any): ProductAutomationOutcome | null => {
  if (!value || typeof value !== 'object') return null;
  const report = Array.isArray(value.report)
    ? value.report.map((row: any) => ({
        key: String(row?.key || '').trim(),
        label: String(row?.label || row?.key || '').trim(),
        status: String(row?.status || 'SKIPPED').toUpperCase(),
        message: toReadableAutomationMessage(String(row?.message || '').trim()),
      }))
        .filter(
          (row: any) =>
            !(
              String(row?.status || '').toUpperCase() === 'SKIPPED' &&
              /disabled by admin automation settings/i.test(String(row?.message || ''))
            )
        )
    : [];
  const severity = String(value.failureSeverity || 'NONE').toUpperCase();
  return {
    evaluationStatus: String(value.evaluationStatus || 'REVIEW_REQUIRED'),
    action: String(value.action || 'NONE'),
    failureSeverity: severity === 'MAJOR' ? 'MAJOR' : severity === 'MID' ? 'MID' : 'NONE',
    needsCorrection: Boolean(value.needsCorrection),
    summaryMessage: toReadableAutomationMessage(String(value.summaryMessage || '').trim()),
    report,
    updatedAt: value.updatedAt ? String(value.updatedAt) : null,
  };
};

const getOutcomeSeverity = (outcome?: ProductAutomationOutcome | null) =>
  String(outcome?.failureSeverity || 'NONE').toUpperCase() === 'MAJOR'
    ? 'MAJOR'
    : String(outcome?.failureSeverity || 'NONE').toUpperCase() === 'MID'
      ? 'MID'
      : 'NONE';

const hasPriceCompareRecommendation = (outcome?: ProductAutomationOutcome | null) =>
  Boolean(
    (outcome?.report || []).some(
      (row) => String(row?.key || '').trim() === 'price_outlier' && String(row?.status || '').toUpperCase() !== 'PASS'
    )
  );

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
  canResubmitProfile?: boolean;
  canOperateAccount?: boolean;
  profileStatus: 'INCOMPLETE' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  profileReviewNotes?: string | null;
  rejectionType?: 'TEMPORARY' | 'PERMANENT' | null;
  rejectionReasonCode?: string | null;
  rejectionReasonLabel?: string | null;
  profileReviewMessage?: string | null;
  permanentDisableAt?: string | null;
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

type SellerDashboardGovernance = {
  tabs: {
    overview: boolean;
    fabrics: boolean;
    featured: boolean;
    orders: boolean;
    tryon: boolean;
  };
  sections: {
    profileGovernance: boolean;
    stats: boolean;
    overviewLowStockAlert: boolean;
    overviewCharts: boolean;
    overviewRecentOrders: boolean;
    overviewActivity: boolean;
    overviewTryOnInsights: boolean;
    tryOnInsightsSummary: boolean;
    tryOnInsightsRecent: boolean;
    fabricsTable: boolean;
    featuredTable: boolean;
    ordersTable: boolean;
  };
  actions: {
    submitProfile: boolean;
    addProduct: boolean;
    editProduct: boolean;
    updateStock: boolean;
    updateOrderStatus: boolean;
  };
  fields: {
    productName: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    productDescription: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    materialType: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    predominantColor: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    sellerPrice: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    listingCurrency: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    minYards: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    stockYards: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    productImages: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
  };
};

const DEFAULT_SELLER_DASHBOARD_GOVERNANCE: SellerDashboardGovernance = {
  tabs: {
    overview: true,
    fabrics: true,
    featured: true,
    orders: true,
    tryon: true,
  },
  sections: {
    profileGovernance: true,
    stats: true,
    overviewLowStockAlert: true,
    overviewCharts: true,
    overviewRecentOrders: true,
    overviewActivity: true,
    overviewTryOnInsights: true,
    tryOnInsightsSummary: true,
    tryOnInsightsRecent: true,
    fabricsTable: true,
    featuredTable: true,
    ordersTable: true,
  },
  actions: {
    submitProfile: true,
    addProduct: true,
    editProduct: true,
    updateStock: true,
    updateOrderStatus: true,
  },
  fields: {
    productName: 'ENABLED',
    productDescription: 'ENABLED',
    materialType: 'ENABLED',
    predominantColor: 'ENABLED',
    sellerPrice: 'ENABLED',
    listingCurrency: 'ENABLED',
    minYards: 'ENABLED',
    stockYards: 'ENABLED',
    productImages: 'ENABLED',
  },
};

const normalizeFieldMode = (value: unknown): 'ENABLED' | 'READ_ONLY' | 'HIDDEN' => {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === 'READ_ONLY') return 'READ_ONLY';
  if (normalized === 'HIDDEN') return 'HIDDEN';
  if (normalized === 'ENABLED') return 'ENABLED';
  if (typeof value === 'boolean') return value ? 'ENABLED' : 'HIDDEN';
  return 'ENABLED';
};

const normalizeSellerDashboardGovernance = (input: any): SellerDashboardGovernance => ({
  tabs: { ...DEFAULT_SELLER_DASHBOARD_GOVERNANCE.tabs, ...(input?.tabs || {}) },
  sections: { ...DEFAULT_SELLER_DASHBOARD_GOVERNANCE.sections, ...(input?.sections || {}) },
  actions: { ...DEFAULT_SELLER_DASHBOARD_GOVERNANCE.actions, ...(input?.actions || {}) },
  fields: {
    productName: normalizeFieldMode(input?.fields?.productName ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.productName),
    productDescription: normalizeFieldMode(
      input?.fields?.productDescription ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.productDescription
    ),
    materialType: normalizeFieldMode(input?.fields?.materialType ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.materialType),
    predominantColor: normalizeFieldMode(
      input?.fields?.predominantColor ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.predominantColor
    ),
    sellerPrice: normalizeFieldMode(input?.fields?.sellerPrice ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.sellerPrice),
    listingCurrency: normalizeFieldMode(
      input?.fields?.listingCurrency ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.listingCurrency
    ),
    minYards: normalizeFieldMode(input?.fields?.minYards ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.minYards),
    stockYards: normalizeFieldMode(input?.fields?.stockYards ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.stockYards),
    productImages: normalizeFieldMode(input?.fields?.productImages ?? DEFAULT_SELLER_DASHBOARD_GOVERNANCE.fields.productImages),
  },
});

const LOCATION_COUNTRIES = getCountryOptions();
const COUNTRY_FIELD_HINTS = ['country', 'businesscountry', 'vendorcountry'];
const CITY_FIELD_HINTS = ['city', 'businesscity', 'vendorcity', 'town'];
const PHONE_FIELD_HINTS = ['phone', 'phonenumber', 'businessphone', 'mobile', 'contactnumber'];

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
const isPhoneGovernanceField = (field: VendorProfileField) => {
  const key = normalizeFieldKey(field.key);
  const label = normalizeFieldKey(field.label);
  return PHONE_FIELD_HINTS.some((hint) => key.includes(hint) || label.includes(hint));
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

const normalizeVendorFieldType = (fieldType: string) => {
  const normalized = String(fieldType || '').trim().toUpperCase().replace(/\s+/g, '_');
  if (
    normalized === 'IMAGE/DOCUMENT' ||
    normalized === 'DOCUMENT/IMAGE' ||
    normalized === 'IMAGE_DOCUMENT' ||
    normalized === 'DOCUMENT_IMAGE'
  ) {
    return 'IMAGE_DOCUMENT';
  }
  return normalized;
};

const isImageFile = (file: File) => {
  if (String(file.type || '').toLowerCase().startsWith('image/')) return true;
  const name = String(file.name || '').toLowerCase();
  return ['.jpg', '.jpeg', '.png', '.webp'].some((ext) => name.endsWith(ext));
};

const isDocumentFile = (file: File) => {
  const mime = String(file.type || '').toLowerCase();
  if (
    [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
    ].includes(mime)
  ) {
    return true;
  }
  const name = String(file.name || '').toLowerCase();
  return ['.pdf', '.doc', '.docx', '.txt', '.rtf', '.odt'].some((ext) => name.endsWith(ext));
};

const parseProfileFileValue = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((entry) => String(entry || '').trim()).filter(Boolean);
        }
      } catch {
        // no-op
      }
    }
    return trimmed
      .split(/\n|,/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
};

export default function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [orders, setOrders] = useState<FabricOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'fabrics' | 'featured' | 'orders' | 'tryon'>('overview');
  const [showStockModal, setShowStockModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);
  const [productSuccess, setProductSuccess] = useState<string | null>(null);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);
  const [productImageUrlInput, setProductImageUrlInput] = useState('');
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [newStock, setNewStock] = useState(0);
  const [productForm, setProductForm] = useState<FabricFormState>({
    name: '',
    description: '',
    materialTypeId: '',
    predominantColor: 'MULTI',
    sellerPrice: '',
    minYards: '3',
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
  const [profileFileValues, setProfileFileValues] = useState<Record<string, string[]>>({});
  const [uploadingProfileField, setUploadingProfileField] = useState<string | null>(null);
  const profileUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [, setGovernanceDebug] = useState<GovernanceDebugInfo | null>(null);
  const [dashboardGovernance, setDashboardGovernance] = useState<SellerDashboardGovernance>(
    DEFAULT_SELLER_DASHBOARD_GOVERNANCE
  );
  const [tryOnInsights, setTryOnInsights] = useState<any>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [fabricSearch, setFabricSearch] = useState('');
  const [fabricStatusFilter, setFabricStatusFilter] = useState('');
  const [fabricMaterialFilter, setFabricMaterialFilter] = useState('');
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);
  const [supportInitialTab, setSupportInitialTab] = useState<'details' | 'ticket'>('ticket');
  const [featuredRequests, setFeaturedRequests] = useState<FeaturedRequest[]>([]);
  const [featuredRequestDurationValue, setFeaturedRequestDurationValue] = useState(2);
  const [featuredRequestDurationUnit, setFeaturedRequestDurationUnit] = useState<'DAYS' | 'WEEKS' | 'MONTHS'>('WEEKS');
  const [featuredRequestNotes, setFeaturedRequestNotes] = useState('');
  const [featuredSettings, setFeaturedSettings] = useState<any>({
    enabled: true,
    defaultDurationValue: 2,
    defaultDurationUnit: 'WEEKS',
    allowVendorRequestedDuration: true,
    maxDurationValue: 12,
    basePriceUsdByType: { FABRIC: 0, DESIGN: 0, READY_TO_WEAR: 0 },
  });
  const [submittingFeaturedRequest, setSubmittingFeaturedRequest] = useState(false);
  const [featuredPaymentProviders, setFeaturedPaymentProviders] = useState<PaymentProviderOption[]>([]);
  const [featuredPaymentDrafts, setFeaturedPaymentDrafts] = useState<Record<string, { providerKey: string; reference: string }>>({});
  const [featuredPaymentActionRequestId, setFeaturedPaymentActionRequestId] = useState<string | null>(null);
  const [featuredPaymentMessage, setFeaturedPaymentMessage] = useState<string | null>(null);
  const [productChangeRequestMessage, setProductChangeRequestMessage] = useState('');
  const [productChangeRequestedFields, setProductChangeRequestedFields] = useState<string[]>([]);
  const [submittingProductChangeRequest, setSubmittingProductChangeRequest] = useState(false);

  const hasRejectionRestriction = profileCompletion?.profileStatus === 'REJECTED';
  const restrictedTabs = hasRejectionRestriction ? (['overview'] as const) : (['overview', 'fabrics', 'featured', 'orders', 'tryon'] as const);
  const visibleTabs = useMemo(
    () =>
      restrictedTabs.filter(
        (tab) => dashboardGovernance.tabs[tab] !== false
      ),
    [dashboardGovernance.tabs, restrictedTabs]
  );
  const fallbackTab = visibleTabs[0] || 'overview';

  const syncTabWithUrl = (tab: 'overview' | 'fabrics' | 'featured' | 'orders' | 'tryon') => {
    const nextTab = dashboardGovernance.tabs[tab] !== false ? tab : fallbackTab;
    setActiveTab(nextTab);
    const currentTab = String(searchParams.get('tab') || '').toLowerCase();
    if (nextTab === 'overview') {
      if (currentTab) setSearchParams({});
      return;
    }
    if (currentTab !== nextTab) setSearchParams({ tab: nextTab });
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const rawTab = String(searchParams.get('tab') || '').toLowerCase();
    if (visibleTabs.length === 0) {
      if (activeTab !== 'overview') {
        setActiveTab('overview');
      }
      if (rawTab) {
        setSearchParams({}, { replace: true });
      }
      return;
    }

    const normalizedTab =
      rawTab === 'try-on' || rawTab === '3d-tryon' || rawTab === '3d-try-on' ? 'tryon' : rawTab;
    const parsedTab =
      normalizedTab === 'fabrics' ||
      normalizedTab === 'featured' ||
      normalizedTab === 'orders' ||
      normalizedTab === 'overview' ||
      normalizedTab === 'tryon'
        ? (normalizedTab as 'overview' | 'fabrics' | 'featured' | 'orders' | 'tryon')
        : 'overview';

    if (!visibleTabs.includes(parsedTab)) {
      const nextTab = fallbackTab;
      if (activeTab !== nextTab) {
        setActiveTab(nextTab);
      }
      if (nextTab === 'overview') {
        if (rawTab) setSearchParams({}, { replace: true });
      } else if (rawTab !== nextTab) {
        setSearchParams({ tab: nextTab }, { replace: true });
      }
      return;
    }

    if (activeTab !== parsedTab) {
      setActiveTab(parsedTab);
    }
  }, [activeTab, fallbackTab, searchParams, setSearchParams, visibleTabs]);

  useEffect(() => {
    if (materialOptions.length > 0 && !productForm.materialTypeId) {
      setProductForm((prev) => ({ ...prev, materialTypeId: materialOptions[0].id }));
    }
  }, [materialOptions, productForm.materialTypeId]);

  const resolveDefaultFeaturedProvider = (countryName?: string) => {
    const available = featuredPaymentProviders.map((entry) => String(entry.providerKey || '').toUpperCase()).filter(Boolean);
    if (available.length === 0) return '';
    const normalizedCountry = String(countryName || '').trim().toUpperCase();
    const preferredOrder = normalizedCountry ? ['FLUTTERWAVE', 'PAYPAL', 'STRIPE'] : ['STRIPE', 'PAYPAL', 'FLUTTERWAVE'];
    for (const key of preferredOrder) {
      if (available.includes(key)) return key;
    }
    return available[0] || '';
  };

  const getFeaturedPaymentDraft = (request: FeaturedRequest) => {
    const existing = featuredPaymentDrafts[request.id];
    if (existing) return existing;
    return {
      providerKey:
        String(request.paymentProviderKey || '').toUpperCase() ||
        resolveDefaultFeaturedProvider(profileCompletion?.profile?.country),
      reference: String(request.paymentReference || '').trim(),
    };
  };

  useEffect(() => {
    if (featuredRequests.length === 0 || featuredPaymentProviders.length === 0) return;
    setFeaturedPaymentDrafts((prev) => {
      const next = { ...prev };
      for (const request of featuredRequests) {
        if (String(request.requestStatus || '').toUpperCase() !== 'APPROVED_AWAITING_PAYMENT') continue;
        const existing = next[request.id];
        next[request.id] = {
          providerKey:
            String(existing?.providerKey || request.paymentProviderKey || '').toUpperCase() ||
            resolveDefaultFeaturedProvider(profileCompletion?.profile?.country),
          reference: String(existing?.reference || request.paymentReference || '').trim(),
        };
      }
      return next;
    });
  }, [featuredRequests, featuredPaymentProviders, profileCompletion?.profile?.country]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setDashboardLoadError(null);
      const [
        dashboardResult,
        fabricsResult,
        ordersResult,
        materialsResult,
        currencyResult,
        governanceResult,
        tryOnInsightsResult,
        featuredRequestsResult,
        featuredSettingsResult,
        paymentOptionsResult,
      ] = await Promise.allSettled([
        api.seller.getDashboard(),
        api.seller.getFabrics(),
        api.seller.getOrders(),
        api.products.getMaterials(),
        api.currency.getMyOptions(),
        api.seller.getDashboardGovernance(),
        api.seller.getTryOnInsights(),
        api.featuredRequests.listMyRequests(),
        api.featuredRequests.getSettings(),
        api.payments.getOptions({ useCase: 'FEATURED' }),
      ]);
      const dashboardRes = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const fabricsRes = fabricsResult.status === 'fulfilled' ? fabricsResult.value : null;
      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const materialsRes = materialsResult.status === 'fulfilled' ? materialsResult.value : null;
      const currencyRes = currencyResult.status === 'fulfilled' ? currencyResult.value : null;
      const governanceRes = governanceResult.status === 'fulfilled' ? governanceResult.value : null;
      const tryOnInsightsRes = tryOnInsightsResult.status === 'fulfilled' ? tryOnInsightsResult.value : null;
      const featuredRequestsRes = featuredRequestsResult.status === 'fulfilled' ? featuredRequestsResult.value : null;
      const featuredSettingsRes = featuredSettingsResult.status === 'fulfilled' ? featuredSettingsResult.value : null;
      const paymentOptionsRes = paymentOptionsResult.status === 'fulfilled' ? paymentOptionsResult.value : null;
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
      const getSettledFailureMessage = (label: string, result: PromiseSettledResult<any>) => {
        if (result.status === 'rejected') {
          const reason: any = result.reason;
          const status = reason?.response?.status;
          const message = String(reason?.response?.data?.message || reason?.message || 'Request failed');
          return `${label}: ${status ? `${status} ` : ''}${message}`;
        }
        if (!result.value?.success) {
          const message = String(result.value?.message || 'Request failed');
          return `${label}: ${message}`;
        }
        return null;
      };
      const firstCriticalFailure = [
        getSettledFailureMessage('Dashboard', dashboardResult),
        getSettledFailureMessage('Fabrics', fabricsResult),
        getSettledFailureMessage('Orders', ordersResult),
      ].find((entry): entry is string => Boolean(entry));
      if (firstCriticalFailure) {
        setDashboardLoadError(firstCriticalFailure);
      }
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
      } else {
        const profileFieldsResult = await Promise.allSettled([api.seller.getProfileFields()]);
        profileFieldsRes = profileFieldsResult[0]?.status === 'fulfilled' ? profileFieldsResult[0].value : null;
        profileFieldsCallStatus = settledCallStatus(profileFieldsResult[0] as PromiseSettledResult<any>);
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
          predominantColor: String(item.predominantColor || 'MULTI').toUpperCase(),
          pricePerMeter: Number(item.finalPrice ?? item.sellerPrice ?? 0),
          stockMeters: Number(item.stockYards ?? 0),
          images: Array.isArray(item.images)
            ? item.images.map((img: any) => img?.url).filter(Boolean)
            : [],
          orderCount: Number(item?._count?.orderItems ?? 0),
          status: item.status || 'DRAFT',
          materialType: item.materialType || { name: 'Material' },
          minOrderMeters: Math.max(3, Number(item.minYards ?? 3)),
          isFeatured: Boolean(item.isFeatured),
          featuredSections: Array.isArray(item.featuredSections) ? item.featuredSections : [],
          listingCurrencyCode: String(item.listingCurrencyCode || 'USD'),
          listingLocalPrice: Number(item.listingLocalPrice || item.sellerPrice || 0),
          listingUsdPrice: Number(item.listingUsdPrice || item.sellerPrice || 0),
          approvedEditableFields: Array.isArray(item.approvedEditableFields) ? item.approvedEditableFields : [],
          approvedEditAccessEndsAt: item.approvedEditAccessEndsAt ? String(item.approvedEditAccessEndsAt) : null,
          automationOutcome: normalizeAutomationOutcome(item.automationOutcome),
          aiAutomationApprovedTag: item.aiAutomationApprovedTag === true,
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
      if (governanceRes?.success) {
        setDashboardGovernance(normalizeSellerDashboardGovernance(governanceRes.data));
      } else {
        setDashboardGovernance(DEFAULT_SELLER_DASHBOARD_GOVERNANCE);
      }
      if (materialsRes?.success) {
        const options = Array.isArray(materialsRes.data)
          ? materialsRes.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Material') }))
          : [];
        setMaterialOptions(options);
      }
      if (ordersRes?.success) {
        const mappedOrders = (ordersRes.data || []).map((item: any) => {
          return {
            id: String(item.id),
            orderId: String(item.orderId || item.order?.id || item.id || ''),
            orderNumber: item.order?.orderNumber || 'N/A',
            fabricName: item.fabric?.name || 'Fabric',
            meters: Number(item.yards || 0),
            totalAmount: Number(item.totalPrice || 0),
            status: item.status || 'PENDING',
            designerCountry: 'Protected',
            createdAt: item.order?.createdAt || item.createdAt,
            customerName: 'Customer (Protected)',
          };
        });
        setOrders(mappedOrders);
      }
      if (tryOnInsightsRes?.success) {
        setTryOnInsights(tryOnInsightsRes.data || null);
      }
      if (featuredRequestsRes?.success && Array.isArray(featuredRequestsRes.data)) {
        const mappedRequests = featuredRequestsRes.data.map((row: any) => ({
          id: String(row.id),
          requestStatus: String(row.requestStatus || 'PENDING'),
          paymentStatus: String(row.paymentStatus || 'UNPAID'),
          productEntries: Array.isArray(row.productEntries) ? row.productEntries : [],
          requestedDurationValue: row.requestedDurationValue != null ? Number(row.requestedDurationValue) : null,
          requestedDurationUnit: row.requestedDurationUnit || null,
          approvedDurationValue: row.approvedDurationValue != null ? Number(row.approvedDurationValue) : null,
          approvedDurationUnit: row.approvedDurationUnit || null,
          approvedPriceUsd: row.approvedPriceUsd != null ? Number(row.approvedPriceUsd) : null,
          paymentProviderKey: row.paymentProviderKey ? String(row.paymentProviderKey).toUpperCase() : null,
          paymentReference: row.paymentReference ? String(row.paymentReference) : null,
          activationEndsAt: row.activationEndsAt || null,
          createdAt: String(row.createdAt || new Date().toISOString()),
        }));
        setFeaturedRequests(mappedRequests);
        setFeaturedPaymentDrafts((prev) => {
          const next = { ...prev };
          for (const request of mappedRequests) {
            if (String(request.requestStatus || '').toUpperCase() !== 'APPROVED_AWAITING_PAYMENT') continue;
            const current = next[request.id];
            next[request.id] = {
              providerKey:
                String(current?.providerKey || request.paymentProviderKey || '').toUpperCase() ||
                resolveDefaultFeaturedProvider(profileCompletion?.profile?.country),
              reference: String(current?.reference || request.paymentReference || '').trim(),
            };
          }
          return next;
        });
      }
      if (featuredSettingsRes?.success && featuredSettingsRes.data) {
        setFeaturedSettings(featuredSettingsRes.data);
        if (featuredSettingsRes.data.defaultDurationValue) {
          setFeaturedRequestDurationValue(Math.max(1, Number(featuredSettingsRes.data.defaultDurationValue)));
        }
        if (featuredSettingsRes.data.defaultDurationUnit) {
          setFeaturedRequestDurationUnit(String(featuredSettingsRes.data.defaultDurationUnit).toUpperCase() as any);
        }
      }
      if (paymentOptionsRes?.success) {
        const providerRows = Array.isArray(paymentOptionsRes.data?.providers) ? paymentOptionsRes.data.providers : [];
        const normalizedProviders = providerRows
          .map((entry: any) => ({
            providerKey: String(entry?.providerKey || '').toUpperCase(),
            displayName: String(entry?.displayName || entry?.providerKey || 'Payment'),
            checkoutType: String(entry?.checkoutType || 'REDIRECT').toUpperCase() === 'INLINE' ? 'INLINE' : 'REDIRECT',
            mode: String(entry?.mode || 'TEST').toUpperCase() === 'LIVE' ? 'LIVE' : 'TEST',
          }))
          .filter((entry: PaymentProviderOption) => Boolean(entry.providerKey));
        setFeaturedPaymentProviders(normalizedProviders);
      } else {
        setFeaturedPaymentProviders([]);
      }
      const completionPayload = dashboardCompletion || (profileRes?.success ? profileRes.data : null);
      const configuredProfileFields =
        profileFieldsRes?.success && Array.isArray(profileFieldsRes.data?.fields)
          ? profileFieldsRes.data.fields.filter((entry: any) => entry?.isActive !== false)
          : [];
      const completionFieldCount = completionPayload && Array.isArray((completionPayload as any)?.fields)
        ? (completionPayload as any).fields.filter((entry: any) => entry?.isActive !== false).length
        : 0;
      const profileRoutesMissing =
        !dashboardCompletion &&
        completionFieldCount === 0 &&
        configuredProfileFields.length === 0 &&
        String(profileCompletionCallStatus).toLowerCase().includes('route not found') &&
        String(profileFieldsCallStatus).toLowerCase().includes('route not found');

      if (completionPayload) {
        const completion = completionPayload as SellerProfileCompletion;
        const configuredKeys = new Set(
          configuredProfileFields.map((field: any) => String(field?.key || '')).filter(Boolean)
        );
        const completionFields =
          Array.isArray(completion?.fields)
            ? completion.fields.filter(
                (entry: any) =>
                  entry?.isActive !== false &&
                  configuredKeys.has(String(entry?.key || ''))
              )
            : [];
        const effectiveFields = completionFields.length > 0 ? completionFields : configuredProfileFields;
        setProfileMessage(null);
        setProfileCompletion({
          ...completion,
          fields: effectiveFields,
        });
        const nextProfileForm: Record<string, string> = {};
        const nextProfileFileValues: Record<string, string[]> = {};
        const dynamicData = completion?.profileData && typeof completion.profileData === 'object'
          ? completion.profileData
          : {};
        for (const field of effectiveFields) {
          const rawValue = (dynamicData as Record<string, unknown>)[field.key];
          const normalizedFieldType = normalizeVendorFieldType(field.fieldType);
          if (
            normalizedFieldType === 'IMAGE' ||
            normalizedFieldType === 'DOCUMENT' ||
            normalizedFieldType === 'IMAGE_DOCUMENT'
          ) {
            nextProfileFileValues[field.key] = parseProfileFileValue(rawValue);
            nextProfileForm[field.key] = '';
            continue;
          }
          nextProfileForm[field.key] = Array.isArray(rawValue)
            ? rawValue.join(', ')
            : rawValue === undefined || rawValue === null
              ? getSellerProfilePrefillValue(completion.profile, field.key)
              : String(rawValue);
        }
        setProfileForm(nextProfileForm);
        setProfileFileValues(nextProfileFileValues);
        if (effectiveFields.length === 0) {
          setProfileMessage('Vendor profile form is not configured yet. Admin must define Fabric Seller fields first.');
        }
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: configuredProfileFields.length,
          effectiveFieldCount: effectiveFields.length,
          sampleFieldKeys: configuredProfileFields
            .slice(0, 5)
            .map((field: any) => String(field?.key || ''))
            .filter(Boolean),
        });
      } else if (configuredProfileFields.length > 0) {
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
          fields: configuredProfileFields,
        };
        setProfileCompletion(syntheticCompletion);
        const nextProfileForm: Record<string, string> = {};
        const nextProfileFileValues: Record<string, string[]> = {};
        for (const field of configuredProfileFields) {
          const normalizedFieldType = normalizeVendorFieldType(String(field.fieldType || ''));
          if (
            normalizedFieldType === 'IMAGE' ||
            normalizedFieldType === 'DOCUMENT' ||
            normalizedFieldType === 'IMAGE_DOCUMENT'
          ) {
            nextProfileFileValues[field.key] = [];
            nextProfileForm[field.key] = '';
          } else {
            nextProfileForm[field.key] = getSellerProfilePrefillValue(syntheticCompletion.profile, field.key);
          }
        }
        setProfileForm(nextProfileForm);
        setProfileFileValues(nextProfileFileValues);
        setProfileMessage('Vendor profile form loaded from admin configuration. Complete and submit for admin approval.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: configuredProfileFields.length,
          effectiveFieldCount: configuredProfileFields.length,
          sampleFieldKeys: configuredProfileFields
            .slice(0, 5)
            .map((field: any) => String(field?.key || ''))
            .filter(Boolean),
        });
      } else if (profileRoutesMissing && dashboardRes?.success) {
        const fallbackProfile = dashboardRes.data?.profile || {};
        setProfileCompletion({
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
          fields: [],
        });
        setProfileForm({});
        setProfileFileValues({});
        setProfileMessage('Vendor profile form is unavailable because admin profile-field routes are missing on this deployment.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: `${profileCompletionCallStatus} (isolated)`,
          profileFieldsCall: `${profileFieldsCallStatus} (isolated)`,
          completionFieldCount,
          governanceFieldCount: configuredProfileFields.length,
          effectiveFieldCount: 0,
          sampleFieldKeys: [],
          error: 'Governance endpoints missing in deployment; compatibility mode enabled.',
        });
      } else {
        setProfileMessage('Vendor profile form is not configured yet. Please ask admin to define profile fields.');
        setProfileFileValues({});
        setGovernanceDebug({
          dashboardCall: settledCallStatus(dashboardResult),
          fabricsCall: settledCallStatus(fabricsResult),
          ordersCall: settledCallStatus(ordersResult),
          profileCompletionCall: profileCompletionCallStatus,
          profileFieldsCall: profileFieldsCallStatus,
          completionFieldCount,
          governanceFieldCount: configuredProfileFields.length,
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
      const message =
        String((error as any)?.response?.data?.message || (error as any)?.message || 'Unknown error');
      setDashboardLoadError(`Unable to load seller dashboard data: ${message}`);
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
    if (!canUpdateStock) return;
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
    if (!canUpdateOrderStatus) return;
    try {
      await api.seller.updateOrderStatus(orderId, status);
      fetchDashboardData();
    } catch (error: any) {
      const message = String(error?.response?.data?.message || error?.message || 'Failed to update order status.');
      setDashboardLoadError(message);
      console.error('Failed to update order status:', error);
    }
  };

  const openStockModal = (fabric: Fabric) => {
    if (!canUpdateStock || dashboardGovernance.sections.fabricsTable === false) return;
    setSelectedFabric(fabric);
    setNewStock(fabric.stockMeters);
    setShowStockModal(true);
  };

  const resetProductForm = () => {
    setProductForm({
      name: '',
      description: '',
      materialTypeId: materialOptions[0]?.id || '',
      predominantColor: 'MULTI',
      sellerPrice: '',
      minYards: '3',
      stockYards: '0',
      imageUrls: '',
      priceCurrencyCode: currencyOptions.defaultCurrency || 'USD',
    });
    setProductImageUrlInput('');
    setSelectedFabric(null);
    setIsEditMode(false);
    setProductError(null);
    setProductSuccess(null);
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
  };

  const openCreateProductModal = () => {
    if (!canAddProduct) return;
    resetProductForm();
    setShowProductModal(true);
  };

  const openEditProductModal = (fabric: Fabric) => {
    if (!canEditProduct) return;
    setSelectedFabric(fabric);
    setIsEditMode(true);
    setProductError(null);
    setProductSuccess(null);
    setProductForm({
      name: fabric.name,
      description: fabric.description || '',
      materialTypeId: fabric.materialTypeId || materialOptions[0]?.id || '',
      predominantColor: String(fabric.predominantColor || 'MULTI').toUpperCase(),
      sellerPrice: String(fabric.listingLocalPrice || fabric.pricePerMeter || ''),
      minYards: String(Math.max(3, Number(fabric.minOrderMeters || 3))),
      stockYards: String(fabric.stockMeters || 0),
      imageUrls: (fabric.images || []).join('\n'),
      priceCurrencyCode: String(fabric.listingCurrencyCode || currencyOptions.defaultCurrency || 'USD'),
    });
    setShowProductModal(true);
    setProductImageUrlInput('');
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
    setFeaturedRequestDurationValue(Math.max(1, Number(featuredSettings?.defaultDurationValue || 2)));
    setFeaturedRequestDurationUnit(
      String(featuredSettings?.defaultDurationUnit || 'WEEKS').toUpperCase() as 'DAYS' | 'WEEKS' | 'MONTHS'
    );
  };

  const parseImageInputs = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

  const normalizeImageList = (urls: string[]) =>
    Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean))).slice(0, 4);

  const writeProductImageList = (urls: string[]) => {
    const next = normalizeImageList(urls);
    setProductForm((prev) => ({ ...prev, imageUrls: next.join('\n') }));
  };

  const handleProductImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      setUploadingProductImage(true);
      setProductError(null);
      const uploadResults = await Promise.all(
        files.map(async (file) => {
          const data = new FormData();
          data.append('image', file);
          const response = await api.upload.image(data);
          return response.success && response.data?.url ? response.data.url : null;
        })
      );
      const uploadedUrls = uploadResults.filter((url): url is string => Boolean(url));
      if (uploadedUrls.length === 0) {
        setProductError('Image upload failed.');
        return;
      }
      const current = parseImageInputs(productForm.imageUrls).map((entry) => entry.url);
      writeProductImageList([...current, ...uploadedUrls]);
    } catch (error: any) {
      setProductError(error?.response?.data?.message || error?.message || 'Failed to upload image.');
    } finally {
      setUploadingProductImage(false);
      event.target.value = '';
    }
  };

  const handleAddProductImageUrl = () => {
    const value = String(productImageUrlInput || '').trim();
    if (!value) return;
    const current = parseImageInputs(productForm.imageUrls).map((entry) => entry.url);
    writeProductImageList([...current, value]);
    setProductImageUrlInput('');
  };

  const handleRemoveProductImage = (url: string) => {
    const current = parseImageInputs(productForm.imageUrls).map((entry) => entry.url);
    writeProductImageList(current.filter((entry) => entry !== url));
  };

  const handleSaveProduct = async () => {
    if (!isEditMode && !canAddProduct) return;
    if (isEditMode && !canEditProduct) return;
    setProductError(null);
    setProductSuccess(null);
    const images = parseImageInputs(productForm.imageUrls);
    setIsSavingProduct(true);
    try {
      const payload: any = {};
      if (isApprovedProductEdit) {
        if (editableFieldSet.has('sellerPrice')) {
          if (Number(productForm.sellerPrice || 0) <= 0) {
            setProductError('Seller price must be greater than zero.');
            setIsSavingProduct(false);
            return;
          }
          payload.sellerPrice = Number(productForm.sellerPrice || 0);
          payload.priceCurrencyCode = productForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
        }
        if (editableFieldSet.has('minYards')) {
          if (Number(productForm.minYards || 0) < 3) {
            setProductError('Minimum yards must be at least 3.');
            setIsSavingProduct(false);
            return;
          }
          payload.minYards = Math.max(3, Number(productForm.minYards || 3));
        }
        if (editableFieldSet.has('stockYards')) {
          if (Number(productForm.stockYards || 0) < 0) {
            setProductError('Stock yards cannot be negative.');
            setIsSavingProduct(false);
            return;
          }
          payload.stockYards = Number(productForm.stockYards || 0);
        }
        if (editableFieldSet.has('name')) {
          if (!productForm.name.trim()) {
            setProductError('Fabric name is required.');
            setIsSavingProduct(false);
            return;
          }
          payload.name = productForm.name.trim();
        }
        if (editableFieldSet.has('description')) {
          if (!productForm.description.trim() || productForm.description.trim().length < 10) {
            setProductError('Description must be at least 10 characters.');
            setIsSavingProduct(false);
            return;
          }
          payload.description = productForm.description.trim();
        }
        if (editableFieldSet.has('materialTypeId')) {
          if (!productForm.materialTypeId) {
            setProductError('Please select a material type.');
            setIsSavingProduct(false);
            return;
          }
          payload.materialTypeId = productForm.materialTypeId;
        }
        if (editableFieldSet.has('predominantColor')) {
          payload.predominantColor = String(productForm.predominantColor || 'MULTI').toUpperCase();
        }
        if (editableFieldSet.has('images')) {
          if (images.length < 3 || images.length > 4) {
            setProductError('Fabrics require 3 to 4 images.');
            setIsSavingProduct(false);
            return;
          }
          payload.images = images;
        }
        if (Object.keys(payload).length === 0) {
          setProductError('No editable fields are enabled for this approved product.');
          setIsSavingProduct(false);
          return;
        }
      } else {
        if (!productForm.name.trim()) {
          setProductError('Fabric name is required.');
          setIsSavingProduct(false);
          return;
        }
        if (!productForm.description.trim() || productForm.description.trim().length < 10) {
          setProductError('Description must be at least 10 characters.');
          setIsSavingProduct(false);
          return;
        }
        if (!productForm.materialTypeId) {
          setProductError('Please select a material type.');
          setIsSavingProduct(false);
          return;
        }
        if (Number(productForm.sellerPrice || 0) <= 0) {
          setProductError('Seller price must be greater than zero.');
          setIsSavingProduct(false);
          return;
        }
        if (Number(productForm.minYards || 0) < 3) {
          setProductError('Minimum yards must be at least 3.');
          setIsSavingProduct(false);
          return;
        }
        if (Number(productForm.stockYards || 0) < 0) {
          setProductError('Stock yards cannot be negative.');
          setIsSavingProduct(false);
          return;
        }
        if (images.length < 3 || images.length > 4) {
          setProductError('Fabrics require 3 to 4 images.');
          setIsSavingProduct(false);
          return;
        }
        payload.name = productForm.name.trim();
        payload.description = productForm.description.trim();
        payload.materialTypeId = productForm.materialTypeId;
        payload.predominantColor = String(productForm.predominantColor || 'MULTI').toUpperCase();
        payload.sellerPrice = Number(productForm.sellerPrice || 0);
        payload.priceCurrencyCode = productForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
        payload.minYards = Math.max(3, Number(productForm.minYards || 3));
        payload.stockYards = Number(productForm.stockYards || 0);
        payload.images = images;
      }
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

  const handleSubmitProductChangeRequest = async () => {
    if (!selectedFabric?.id) return;
    const message = String(productChangeRequestMessage || '').trim();
    if (!message) {
      setProductError('Please enter a message for the admin change request.');
      return;
    }
    try {
      setSubmittingProductChangeRequest(true);
      setProductError(null);
      setProductSuccess(null);
      const response = await api.productChangeRequests.createRequest({
        productType: 'FABRIC',
        productId: selectedFabric.id,
        message,
        requestedFields: productChangeRequestedFields,
      });
      if (!response.success) {
        setProductError(response.message || 'Unable to submit product change request.');
        return;
      }
      setProductChangeRequestMessage('');
      setProductChangeRequestedFields([]);
      setProductSuccess('Change request submitted to admin. You can continue editing allowed fields.');
    } catch (error: any) {
      setProductError(error?.response?.data?.message || error?.message || 'Unable to submit product change request.');
    } finally {
      setSubmittingProductChangeRequest(false);
    }
  };

  const handleProfileFieldFileUpload = async (field: VendorProfileField, files: FileList | null) => {
    const selectedFiles = Array.from(files || []);
    if (!field?.key || selectedFiles.length === 0) return;
    const normalizedFieldType = normalizeVendorFieldType(field.fieldType);
    const invalidFile = selectedFiles.find((file) => {
      if (normalizedFieldType === 'IMAGE') return !isImageFile(file);
      if (normalizedFieldType === 'DOCUMENT') return !isDocumentFile(file);
      if (normalizedFieldType === 'IMAGE_DOCUMENT') return !isImageFile(file) && !isDocumentFile(file);
      return true;
    });
    if (invalidFile) {
      setProfileMessage(
        normalizedFieldType === 'IMAGE'
          ? 'Only image files are allowed for this field.'
          : normalizedFieldType === 'DOCUMENT'
            ? 'Only document files are allowed for this field.'
            : 'Only image or document files are allowed for this field.'
      );
      return;
    }
    try {
      setProfileMessage(null);
      setUploadingProfileField(field.key);
      const uploadResults = await Promise.all(
        selectedFiles.map(async (file) => {
          if (isImageFile(file)) {
            const data = new FormData();
            data.append('image', file);
            const response = await api.upload.image(data);
            return response.success && response.data?.url ? response.data.url : null;
          }
          const data = new FormData();
          data.append('document', file);
          const response = await api.upload.document(data);
          return response.success && response.data?.url ? response.data.url : null;
        })
      );
      const uploadedUrls = uploadResults.filter((url): url is string => Boolean(url));
      if (uploadedUrls.length === 0) {
        setProfileMessage('File upload failed. Please try again.');
        return;
      }
      setProfileFileValues((prev) => ({
        ...prev,
        [field.key]: Array.from(new Set([...(prev[field.key] || []), ...uploadedUrls])),
      }));
    } catch (error: any) {
      setProfileMessage(error?.response?.data?.message || error?.message || 'Unable to upload file.');
    } finally {
      setUploadingProfileField(null);
    }
  };

  const handleRemoveProfileFile = (fieldKey: string, fileUrl: string) => {
    setProfileFileValues((prev) => ({
      ...prev,
      [fieldKey]: (prev[fieldKey] || []).filter((entry) => entry !== fileUrl),
    }));
  };

  const handleSubmitProfile = async () => {
    if (!profileCompletion || !canSubmitProfile) return;
    setProfileMessage(null);
    setSubmittingProfile(true);
    try {
      const dynamicPayload: Record<string, string | number | boolean | string[]> = {};
      for (const field of activeProfileFields) {
        if (!field?.key) continue;
        const normalizedFieldType = normalizeVendorFieldType(field.fieldType);
        if (
          normalizedFieldType === 'IMAGE' ||
          normalizedFieldType === 'DOCUMENT' ||
          normalizedFieldType === 'IMAGE_DOCUMENT'
        ) {
          dynamicPayload[field.key] = profileFileValues[field.key] || [];
          continue;
        }
        const raw = String(profileForm[field.key] ?? '').trim();
        if (normalizedFieldType === 'NUMBER') {
          if (!raw) {
            dynamicPayload[field.key] = '';
          } else {
            const parsed = Number(raw);
            dynamicPayload[field.key] = Number.isFinite(parsed) ? parsed : raw;
          }
        } else if (normalizedFieldType === 'MULTI_SELECT') {
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

  const handleSubmitFeaturedRequestForProduct = async (productId: string) => {
    if (!productId || !canUploadByProfile) return;
    try {
      setSubmittingFeaturedRequest(true);
      setDashboardLoadError(null);
      const response = await api.featuredRequests.createRequest({
        products: [{ productId, productType: 'FABRIC', section: 'FEATURED_FABRICS' }],
        requestedDurationValue: featuredRequestDurationValue,
        requestedDurationUnit: featuredRequestDurationUnit,
        requestNotes: featuredRequestNotes || undefined,
      });
      if (!response.success) {
        setDashboardLoadError(response.message || 'Unable to submit featured request.');
        return;
      }
      setFeaturedRequestNotes('');
      await fetchDashboardData();
    } catch (error: any) {
      setDashboardLoadError(error?.response?.data?.message || error?.message || 'Unable to submit featured request.');
    } finally {
      setSubmittingFeaturedRequest(false);
    }
  };

  const handleFeaturedPaymentDraftChange = (
    requestId: string,
    patch: Partial<{ providerKey: string; reference: string }>
  ) => {
    setFeaturedPaymentDrafts((prev) => {
      const current = prev[requestId] || {
        providerKey: resolveDefaultFeaturedProvider(profileCompletion?.profile?.country),
        reference: '',
      };
      return {
        ...prev,
        [requestId]: {
          providerKey: String(patch.providerKey ?? current.providerKey ?? '').toUpperCase(),
          reference: String(patch.reference ?? current.reference ?? '').trim(),
        },
      };
    });
  };

  const handleCreateFeaturedPaymentSession = async (requestId: string) => {
    if (!canUploadByProfile) return;
    const draft = featuredPaymentDrafts[requestId] || {
      providerKey: resolveDefaultFeaturedProvider(profileCompletion?.profile?.country),
      reference: '',
    };
    const providerKey = String(draft.providerKey || '').toUpperCase();
    if (!providerKey) {
      setDashboardLoadError('No active payment provider found. Configure payment providers in admin dashboard.');
      return;
    }
    try {
      setFeaturedPaymentActionRequestId(requestId);
      setDashboardLoadError(null);
      setFeaturedPaymentMessage(null);
      const response = await api.featuredRequests.createPaymentSession(requestId, {
        providerKey,
        returnUrl: `${window.location.origin}/seller?tab=featured`,
        cancelUrl: `${window.location.origin}/seller?tab=featured&payment_cancelled=true`,
      });
      if (!response.success) {
        setDashboardLoadError(response.message || 'Unable to create featured payment session.');
        return;
      }
      const nextReference = String(response.data?.paymentIntentId || response.data?.reference || '').trim();
      handleFeaturedPaymentDraftChange(requestId, {
        providerKey: String(response.data?.providerKey || providerKey),
        reference: nextReference,
      });
      if (response.data?.checkoutUrl) {
        window.open(String(response.data.checkoutUrl), '_blank', 'noopener,noreferrer');
      }
      setFeaturedPaymentMessage(
        response.message || 'Payment session created. Complete payment, then click Verify Payment to activate.'
      );
    } catch (error: any) {
      setDashboardLoadError(error?.response?.data?.message || error?.message || 'Unable to create payment session.');
    } finally {
      setFeaturedPaymentActionRequestId(null);
    }
  };

  const handleVerifyFeaturedPayment = async (requestId: string) => {
    if (!canUploadByProfile) return;
    const draft = featuredPaymentDrafts[requestId];
    if (!draft?.providerKey || !draft.reference) {
      setDashboardLoadError('Create a payment session first to generate a payment reference.');
      return;
    }
    try {
      setFeaturedPaymentActionRequestId(requestId);
      setDashboardLoadError(null);
      setFeaturedPaymentMessage(null);
      const response = await api.featuredRequests.verifyPayment(requestId, {
        providerKey: draft.providerKey,
        reference: draft.reference,
      });
      if (!response.success) {
        setDashboardLoadError(response.message || 'Unable to verify featured request payment.');
        return;
      }
      setFeaturedPaymentMessage(response.message || 'Payment verified and featured request activated.');
      await fetchDashboardData();
    } catch (error: any) {
      setDashboardLoadError(error?.response?.data?.message || error?.message || 'Unable to verify payment.');
    } finally {
      setFeaturedPaymentActionRequestId(null);
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
  const showProfileGovernance = dashboardGovernance.sections.profileGovernance !== false;
  const showStats = dashboardGovernance.sections.stats !== false;
  const canUploadByProfile = Boolean(profileCompletion?.canUpload);
  const profileStatus = String(profileCompletion?.profileStatus || 'INCOMPLETE').toUpperCase();
  const canEditGovernanceProfile = profileStatus === 'INCOMPLETE' || profileStatus === 'REJECTED';
  const isFieldHidden = (mode: 'ENABLED' | 'READ_ONLY' | 'HIDDEN') => mode === 'HIDDEN';
  const isFieldReadOnly = (mode: 'ENABLED' | 'READ_ONLY' | 'HIDDEN') => mode === 'READ_ONLY';
  const canAddProduct = dashboardGovernance.actions.addProduct !== false && canUploadByProfile;
  const canEditProduct = dashboardGovernance.actions.editProduct !== false && canUploadByProfile;
  const canUpdateStock = dashboardGovernance.actions.updateStock !== false && canUploadByProfile;
  const canUpdateOrderStatus = dashboardGovernance.actions.updateOrderStatus !== false && canUploadByProfile;
  const canSubmitProfile =
    dashboardGovernance.actions.submitProfile !== false &&
    profileCompletion?.canResubmitProfile !== false &&
    canEditGovernanceProfile;
  const hasNoDashboardTabs = visibleTabs.length === 0;
  const overviewHasVisibleContent =
    dashboardGovernance.sections.overviewCharts !== false ||
    dashboardGovernance.sections.overviewRecentOrders !== false ||
    dashboardGovernance.sections.overviewActivity !== false ||
    dashboardGovernance.sections.overviewTryOnInsights !== false ||
    (dashboardGovernance.sections.overviewLowStockAlert !== false && lowStockFabrics.length > 0);
  const tryOnHasVisibleContent =
    dashboardGovernance.sections.tryOnInsightsSummary !== false ||
    dashboardGovernance.sections.tryOnInsightsRecent !== false;
  const activeFeaturedRequestForSelectedFabric =
    selectedFabric?.id
      ? featuredRequests.find((request) => {
          const status = String(request.requestStatus || '').toUpperCase();
          if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') return false;
          return Array.isArray(request.productEntries)
            ? request.productEntries.some((entry) => String(entry.productId || '') === String(selectedFabric.id))
            : false;
        })
      : null;
  const isApprovedProductEdit =
    Boolean(isEditMode && selectedFabric && String(selectedFabric.status || '').toUpperCase() === 'APPROVED');
  const editableFieldSet = new Set<string>(
    isApprovedProductEdit
      ? Array.isArray(selectedFabric?.approvedEditableFields)
        ? selectedFabric.approvedEditableFields
        : []
      : [...ALL_FABRIC_EDITABLE_FIELDS]
  );
  const lockedFieldKeys = isApprovedProductEdit
    ? ALL_FABRIC_EDITABLE_FIELDS.filter((field) => !editableFieldSet.has(field))
    : [];
  const isApprovedFieldLocked = (fieldKey: string) => isApprovedProductEdit && !editableFieldSet.has(fieldKey);
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
        {canAddProduct ? (
          <Button onClick={openCreateProductModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Fabric Product
          </Button>
        ) : null}
      </div>

      {dashboardLoadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {dashboardLoadError}
        </div>
      ) : null}

      {showProfileGovernance && profileCompletion ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Vendor governance profile</h2>
            <p className="text-sm text-gray-600 mt-1">
              Status: <span className="font-semibold">{profileCompletion?.profileStatus || 'INCOMPLETE'}</span>. Product upload access is controlled by admin approval.
            </p>
            {profileCompletion?.rejectionType ? (
              <p className="text-sm text-gray-700 mt-1">
                Rejection type: <span className="font-semibold">{profileCompletion.rejectionType}</span>
                {profileCompletion.rejectionReasonLabel ? ` • ${profileCompletion.rejectionReasonLabel}` : ''}
              </p>
            ) : null}
            {profileCompletion?.profileReviewNotes ? (
              <p className="text-sm text-gray-700 mt-1">Admin note: {profileCompletion.profileReviewNotes}</p>
            ) : null}
            {profileCompletion?.profileReviewMessage ? (
              <div
                className="mt-2 rounded border border-gray-200 bg-gray-50 p-2 text-sm text-gray-800"
                dangerouslySetInnerHTML={{ __html: String(profileCompletion.profileReviewMessage) }}
              />
            ) : null}
            {profileCompletion?.permanentDisableAt ? (
              <p className="text-xs text-red-700 mt-2">
                Account auto-disable date: {new Date(profileCompletion.permanentDisableAt).toLocaleString()}
              </p>
            ) : null}
          </div>

          {canEditGovernanceProfile ? (
            <>
              {activeProfileFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {activeProfileFields.map((field) => {
                  const normalizedFieldType = normalizeVendorFieldType(field.fieldType);
                  const value = String(profileForm[field.key] || '');
                  const isTextArea = normalizedFieldType === 'TEXTAREA';
                  const isSelect = normalizedFieldType === 'SELECT' && Array.isArray(field.options) && field.options.length > 0;
                  const isImageUploadField = normalizedFieldType === 'IMAGE';
                  const isDocumentUploadField = normalizedFieldType === 'DOCUMENT';
                  const isMixedUploadField = normalizedFieldType === 'IMAGE_DOCUMENT';
                  const isUploadField = isImageUploadField || isDocumentUploadField || isMixedUploadField;
                  const uploadAccept = isImageUploadField
                    ? '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp'
                    : isDocumentUploadField
                      ? '.pdf,.doc,.docx,.txt,.rtf,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,application/vnd.oasis.opendocument.text'
                      : '.jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.txt,.rtf,.odt,image/jpeg,image/png,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/rtf,application/vnd.oasis.opendocument.text';
                  const uploadedFiles = profileFileValues[field.key] || [];
                  const isCountryField = isCountryGovernanceField(field);
                  const isCityField = isCityGovernanceField(field);
                  return (
                    <div key={field.key} className={isTextArea ? 'md:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-gray-900 mb-1">
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
                                if (isPhoneGovernanceField(entry) && String(next[entry.key] || '').trim()) {
                                  next[entry.key] = normalizePhoneWithCountryPrefix(
                                    String(next[entry.key] || ''),
                                    resolveCountryName(event.target.value)
                                  );
                                }
                              }
                              return next;
                            })
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
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
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
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
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
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
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[90px] text-gray-900"
                        />
                      ) : isUploadField ? (
                        <div className="space-y-2">
                          <input
                            type="file"
                            multiple
                            accept={uploadAccept}
                            ref={(node) => {
                              profileUploadInputRefs.current[field.key] = node;
                            }}
                            onChange={(event) => {
                              handleProfileFieldFileUpload(field, event.target.files);
                              event.target.value = '';
                            }}
                            className="sr-only"
                            disabled={uploadingProfileField === field.key}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => profileUploadInputRefs.current[field.key]?.click()}
                              className={`inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 transition-colors ${
                                uploadingProfileField === field.key ? 'pointer-events-none opacity-60' : 'hover:bg-gray-100'
                              }`}
                            >
                              <Upload className="mr-2 h-4 w-4" />
                              {uploadingProfileField === field.key ? 'Uploading...' : 'Choose file(s)'}
                            </button>
                            <span className="text-xs text-gray-500">
                              {isImageUploadField
                                ? 'Images only'
                                : isDocumentUploadField
                                  ? 'Documents only'
                                  : 'Images or documents'}
                            </span>
                          </div>
                          {uploadedFiles.length > 0 ? (
                            <div className="space-y-1">
                              {uploadedFiles.map((fileUrl) => (
                                <div
                                  key={fileUrl}
                                  className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-gray-50 px-2 py-1"
                                >
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="truncate text-xs text-gray-700 hover:underline"
                                  >
                                    {fileUrl}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveProfileFile(field.key, fileUrl)}
                                    className="text-xs font-medium text-red-600 hover:text-red-700"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">
                              {uploadingProfileField === field.key
                                ? 'Uploading files...'
                                : 'No files uploaded yet.'}
                            </p>
                          )}
                        </div>
                      ) : (
                        <input
                          type={normalizedFieldType === 'NUMBER' ? 'number' : 'text'}
                          value={value}
                          onChange={(event) =>
                            setProfileForm((prev) => ({
                              ...prev,
                              [field.key]: isPhoneGovernanceField(field)
                                ? normalizePhoneWithCountryPrefix(event.target.value, selectedProfileCountry)
                                : event.target.value,
                            }))
                          }
                          placeholder={field.placeholder || ''}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        />
                      )}
                      {field.helpText ? <p className="mt-1 text-xs text-gray-500">{field.helpText}</p> : null}
                    </div>
                  );
                })}
                </div>
              ) : (
                <p className="text-sm text-gray-700">
                  Vendor application form is not configured yet. Admin must create Fabric Seller profile fields first.
                </p>
              )}

              {profileMessage ? <p className="text-sm text-gray-700">{profileMessage}</p> : null}
              <div>
                <Button
                  size="sm"
                  onClick={handleSubmitProfile}
                  disabled={submittingProfile || Boolean(uploadingProfileField) || activeProfileFields.length === 0 || !canSubmitProfile}
                >
                  {submittingProfile
                    ? 'Submitting...'
                    : profileCompletion?.rejectionType === 'PERMANENT'
                      ? 'Account Permanently Rejected'
                      : 'Submit for Admin Approval'}
                </Button>
              </div>
            </>
          ) : profileStatus === 'SUBMITTED' ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-3 text-sm text-blue-800">
              Your vendor profile is submitted and currently under admin review. The form is locked until a review decision is made.
            </div>
          ) : profileStatus === 'APPROVED' ? (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-800">
              Your vendor profile is approved and locked. To request any changes, contact the administrator.
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-700">
              This profile is currently not editable.
            </div>
          )}
        </div>
      ) : null}

      {/* Stats Grid */}
      {showStats ? (
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
      ) : null}

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => syncTabWithUrl(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'fabrics' ? 'Fabrics' : tab === 'featured' ? 'Featured' : tab === 'orders' ? 'Orders' : '3D TryON'}
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
      {hasNoDashboardTabs ? (
        <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
          All seller dashboard tabs are disabled by admin governance.
        </div>
      ) : null}

      {activeTab === 'overview' && (
        <>
          {/* Low Stock Alert */}
          {dashboardGovernance.sections.overviewLowStockAlert !== false && lowStockFabrics.length > 0 && (
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
          {dashboardGovernance.sections.overviewCharts !== false ? (
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
          ) : null}

          {dashboardGovernance.sections.overviewTryOnInsights !== false ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-purple-700" />
                <div>
                  <p className="font-medium text-purple-900">3D TryON Insights</p>
                  <p className="text-sm text-purple-800">
                    Total customer TryON runs: <span className="font-semibold">{Number(tryOnInsights?.totalTryOns || 0)}</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    {Object.entries(tryOnInsights?.measurementAverages || {})
                      .slice(0, 4)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ') || 'No measurement trend data yet.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {/* Recent Orders & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Orders */}
            {dashboardGovernance.sections.overviewRecentOrders !== false ? (
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
                        <Badge
                          variant={
                            order.status === 'DELIVERED'
                              ? 'green'
                              : order.status === 'SHIPPED_TO_DESIGNER'
                                ? 'blue'
                                : order.status === 'CONFIRMED'
                                  ? 'yellow'
                                  : 'gray'
                          }
                          size="sm"
                        >
                          {order.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Activity Feed */}
            {dashboardGovernance.sections.overviewActivity !== false ? (
              <ActivityFeed activities={activities} title="Recent Activity" />
            ) : null}
          </div>
          {!overviewHasVisibleContent ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Overview widgets are disabled by admin governance.
            </div>
          ) : null}
        </>
      )}

      {activeTab === 'tryon' && (
        <div className="space-y-4">
          {dashboardGovernance.sections.tryOnInsightsSummary !== false ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-purple-700" />
                <div className="flex-1">
                  <p className="font-medium text-purple-900">3D TryON Insights</p>
                  <p className="text-sm text-purple-800">
                    Total customer TryON runs: <span className="font-semibold">{Number(tryOnInsights?.totalTryOns || 0)}</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    {Object.entries(tryOnInsights?.measurementAverages || {})
                      .slice(0, 8)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ') || 'No measurement trend data yet.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {dashboardGovernance.sections.tryOnInsightsRecent !== false ? (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
              <div className="border-b bg-gray-50 px-4 py-3">
                <h2 className="text-sm font-semibold text-gray-900">Recent TryON activity</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">When</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Owner</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Sample Measures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {(Array.isArray(tryOnInsights?.recentTryOns) ? tryOnInsights.recentTryOns : [])
                      .slice(0, 25)
                      .map((row: any, index: number) => (
                      <tr key={String(row?.id || `tryon-${index}`)}>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {row?.createdAt ? new Date(row.createdAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          <div className="font-medium">{String(row?.productName || 'Product')}</div>
                          <div className="text-xs text-gray-500">
                            {String(row?.productType || '') === 'READY_TO_WEAR' ? 'Ready-To-Wear' : 'Design'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{String(row?.ownerName || 'Designer')}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{String(row?.customerName || 'Customer')}</td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {Object.entries((row?.measurements as Record<string, unknown>) || {})
                            .slice(0, 4)
                            .map(([key, value]) => `${key}:${value}`)
                            .join(' • ') || '—'}
                        </td>
                      </tr>
                    ))}
                    {(Array.isArray(tryOnInsights?.recentTryOns) ? tryOnInsights.recentTryOns.length : 0) === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">
                          No TryON activity yet.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
          {!tryOnHasVisibleContent ? (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              3D TryON insights are disabled by admin governance.
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'fabrics' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">My Fabrics</h2>
            {canAddProduct ? (
              <Button size="sm" onClick={openCreateProductModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            ) : null}
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

          {dashboardGovernance.sections.fabricsTable !== false ? (
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
                    const severity = getOutcomeSeverity(item.automationOutcome);
                    const rowClass =
                      severity === 'MAJOR'
                        ? 'border-b border-red-200 bg-red-50/70 hover:bg-red-100/80'
                        : severity === 'MID'
                          ? 'border-b border-amber-200 bg-amber-50/70 hover:bg-amber-100/80'
                          : 'border-b last:border-0 hover:bg-gray-50';
                    return (
                      <tr key={item.id} className={rowClass}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.materialType?.name || 'Material'}</p>
                              {item.aiAutomationApprovedTag ? (
                                <p className="text-xs font-semibold text-emerald-700">AI Approved</p>
                              ) : null}
                              {item.automationOutcome?.needsCorrection ? (
                                <p
                                  className={`text-xs font-semibold ${
                                    severity === 'MAJOR' ? 'text-red-700' : 'text-amber-700'
                                  }`}
                                >
                                  Automation correction required ({severity === 'MAJOR' ? 'Major' : 'Mid'})
                                </p>
                              ) : null}
                              <p className="font-mono text-[11px] text-gray-400">ID: {item.id}</p>
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
                            {canEditProduct ? (
                              <button
                                onClick={() => openEditProductModal(item)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit product"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            ) : null}
                            {canUpdateStock ? (
                              <button
                                onClick={() => openStockModal(item)}
                                className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                                title="Update stock"
                              >
                                <Package className="h-4 w-4" />
                              </button>
                            ) : null}
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
          ) : (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Fabric table is disabled by admin governance.
            </div>
          )}
        </div>
      )}

      {activeTab === 'featured' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-5 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Featured Request Workflow</h2>
            <p className="text-sm text-gray-600">
              Create a featured request from the Fabric upload/edit popup for each product. This page is now dedicated to request history and approvals.
            </p>
            <div className="text-xs text-gray-600">
              Base price (USD): Fabric ${Number(featuredSettings?.basePriceUsdByType?.FABRIC || 0).toFixed(2)}
            </div>
            {!featuredSettings?.enabled ? (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Featured requests are currently disabled by admin.
              </div>
            ) : null}
            <div>
              <Button variant="outline" size="sm" onClick={() => syncTabWithUrl('fabrics')}>
                Open Product List
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <h3 className="text-base font-semibold text-gray-900 mb-3">My Featured Requests</h3>
            {featuredPaymentMessage ? (
              <div className="mb-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
                {featuredPaymentMessage}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Created</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Products</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Status</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Price</th>
                    <th className="px-3 py-2 text-left text-gray-600 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {featuredRequests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-3 py-2">{new Date(request.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{Array.isArray(request.productEntries) ? request.productEntries.length : 0}</td>
                      <td className="px-3 py-2">
                        <Badge
                          variant={
                            request.requestStatus === 'ACTIVE'
                              ? 'green'
                              : request.requestStatus === 'APPROVED_AWAITING_PAYMENT'
                              ? 'blue'
                              : request.requestStatus === 'REJECTED'
                              ? 'red'
                              : 'yellow'
                          }
                        >
                          {request.requestStatus}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">${Number(request.approvedPriceUsd || 0).toFixed(2)}</td>
                      <td className="px-3 py-2">
                        {request.requestStatus === 'APPROVED_AWAITING_PAYMENT' ? (
                          <div className="space-y-2">
                            <select
                              value={getFeaturedPaymentDraft(request).providerKey}
                              onChange={(event) =>
                                handleFeaturedPaymentDraftChange(request.id, { providerKey: event.target.value })
                              }
                              className="w-full rounded border px-2 py-1 text-xs"
                              disabled={featuredPaymentActionRequestId === request.id}
                            >
                              {featuredPaymentProviders.length === 0 ? (
                                <option value="">No payment providers</option>
                              ) : null}
                              {featuredPaymentProviders.map((provider) => (
                                <option key={provider.providerKey} value={provider.providerKey}>
                                  {provider.displayName} ({provider.mode})
                                </option>
                              ))}
                            </select>
                            <input
                              type="text"
                              value={getFeaturedPaymentDraft(request).reference}
                              onChange={(event) =>
                                handleFeaturedPaymentDraftChange(request.id, { reference: event.target.value })
                              }
                              placeholder="Payment reference"
                              className="w-full rounded border px-2 py-1 text-xs"
                              disabled={featuredPaymentActionRequestId === request.id}
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                type="button"
                                onClick={() => handleCreateFeaturedPaymentSession(request.id)}
                                disabled={!canUploadByProfile || featuredPaymentActionRequestId === request.id}
                              >
                                {featuredPaymentActionRequestId === request.id ? 'Processing...' : 'Pay'}
                              </Button>
                              <Button
                                size="sm"
                                type="button"
                                variant="outline"
                                onClick={() => handleVerifyFeaturedPayment(request.id)}
                                disabled={
                                  !canUploadByProfile ||
                                  featuredPaymentActionRequestId === request.id ||
                                  !getFeaturedPaymentDraft(request).reference
                                }
                              >
                                Verify
                              </Button>
                            </div>
                          </div>
                        ) : request.requestStatus === 'ACTIVE' ? (
                          <span className="text-xs text-gray-600">
                            Active until {request.activationEndsAt ? new Date(request.activationEndsAt).toLocaleDateString() : '-'}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {featuredRequests.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                        No featured requests yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          {dashboardGovernance.sections.featuredTable !== false ? (
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
          ) : (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Featured table is disabled by admin governance.
            </div>
          )}
        </div>
      )}

      {activeTab === 'orders' && (
        dashboardGovernance.sections.ordersTable !== false ? (
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
              {canUpdateOrderStatus &&
                ['CONFIRMED', 'FABRIC_CONFIRMED', 'PAYMENT_CONFIRMED'].includes(String(item.status || '').toUpperCase()) && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'SHIPPED_TO_DESIGNER')}
                >
                  <Truck className="w-4 h-4 mr-1" />
                  Ship
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSupportInitialTab('details');
                  setSupportOrderId(item.orderId);
                }}
              >
                <Eye className="w-4 h-4 mr-1" />
                Details
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setSupportInitialTab('ticket');
                  setSupportOrderId(item.orderId);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Contact
              </Button>
            </div>
          )}
        />
        ) : (
          <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
            Orders table is disabled by admin governance.
          </div>
        )
      )}

      {/* Product Create/Edit Modal */}
      {showProductModal && (canAddProduct || canEditProduct) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isEditMode ? 'Update Fabric Product' : 'Add Fabric Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">Fabrics require 3 to 4 image URLs.</p>
            {isEditMode &&
            (selectedFabric?.automationOutcome?.needsCorrection ||
              hasPriceCompareRecommendation(selectedFabric?.automationOutcome)) ? (
              <div
                className={`mb-5 rounded-lg border p-3 ${
                  getOutcomeSeverity(selectedFabric.automationOutcome) === 'MAJOR'
                    ? 'border-red-300 bg-red-50'
                    : 'border-amber-300 bg-amber-50'
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    getOutcomeSeverity(selectedFabric.automationOutcome) === 'MAJOR' ? 'text-red-700' : 'text-amber-700'
                  }`}
                >
                  {selectedFabric.automationOutcome?.needsCorrection
                    ? `Automation flagged this product for correction (${
                        getOutcomeSeverity(selectedFabric.automationOutcome) === 'MAJOR' ? 'Major' : 'Mid'
                      } severity)`
                    : 'Pricing recommendation for this product (amber alert)'}
                </p>
                {selectedFabric.automationOutcome.summaryMessage ? (
                  <p className="mt-1 text-xs text-gray-700">{selectedFabric.automationOutcome.summaryMessage}</p>
                ) : null}
                <div className="mt-2 space-y-2">
                  {(selectedFabric.automationOutcome.report || [])
                    .filter((row) => String(row.status || '').toUpperCase() !== 'PASS')
                    .map((row) => {
                      const rowStatus = String(row.status || '').toUpperCase();
                      const rowClass =
                        rowStatus === 'FAIL'
                          ? 'border-red-200 bg-red-100 text-red-800'
                          : 'border-amber-200 bg-amber-100 text-amber-800';
                      return (
                        <div key={`${row.key}-${rowStatus}`} className={`rounded border px-2 py-1 text-xs ${rowClass}`}>
                          <span className="font-semibold">{row.label || row.key}</span>: {row.message || 'Needs review'}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.productName) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fabric Name</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. Premium Ankara Cotton"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.productName) || isApprovedFieldLocked('name')}
                />
              </div>
              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.productDescription) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={productForm.description}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[90px]"
                  placeholder="Describe fabric quality, weave, and best use."
                  disabled={isFieldReadOnly(dashboardGovernance.fields.productDescription) || isApprovedFieldLocked('description')}
                />
              </div>
              <div className={isFieldHidden(dashboardGovernance.fields.materialType) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Material Type</label>
                <select
                  value={productForm.materialTypeId}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, materialTypeId: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.materialType) || isApprovedFieldLocked('materialTypeId')}
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
              <div className={isFieldHidden(dashboardGovernance.fields.predominantColor) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Predominant Fabric Color</label>
                <select
                  value={productForm.predominantColor}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, predominantColor: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.predominantColor) || isApprovedFieldLocked('predominantColor')}
                >
                  {FABRIC_COLOR_OPTIONS.map((color) => (
                    <option key={color} value={color}>
                      {color}
                    </option>
                  ))}
                </select>
              </div>
              <div className={isFieldHidden(dashboardGovernance.fields.sellerPrice) ? 'hidden' : ''}>
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
                  disabled={isFieldReadOnly(dashboardGovernance.fields.sellerPrice) || isApprovedFieldLocked('sellerPrice')}
                />
                <p className="mt-1 text-xs text-gray-500">Converted USD: ${usdPricePreview.toFixed(2)}</p>
              </div>
              <div className={isFieldHidden(dashboardGovernance.fields.listingCurrency) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Currency</label>
                <select
                  value={productForm.priceCurrencyCode}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={
                    isFieldReadOnly(dashboardGovernance.fields.listingCurrency) ||
                    (currencyOptions.allowedCurrencies || []).length <= 1 ||
                    isApprovedFieldLocked('sellerPrice')
                  }
                >
                  {(currencyOptions.allowedCurrencies || [currencyOptions.defaultCurrency || 'USD']).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
              <div className={isFieldHidden(dashboardGovernance.fields.minYards) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Minimum Yards</label>
                <input
                  type="number"
                  min="3"
                  step="1"
                  value={productForm.minYards}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, minYards: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.minYards) || isApprovedFieldLocked('minYards')}
                />
              </div>
              <div className={isFieldHidden(dashboardGovernance.fields.stockYards) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Yards</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={productForm.stockYards}
                  onChange={(e) => setProductForm((prev) => ({ ...prev, stockYards: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.stockYards) || isApprovedFieldLocked('stockYards')}
                />
              </div>
              {!isFieldHidden(dashboardGovernance.fields.productImages) ? (
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Images (minimum 3, maximum 4)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={productImageUrlInput}
                    onChange={(event) => setProductImageUrlInput(event.target.value)}
                    placeholder="Paste image URL and add"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddProductImageUrl}
                    disabled={isFieldReadOnly(dashboardGovernance.fields.productImages) || isApprovedFieldLocked('images')}
                  >
                    Add URL
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingProductImage ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleProductImageUpload}
                      disabled={
                        uploadingProductImage ||
                        isFieldReadOnly(dashboardGovernance.fields.productImages) ||
                        isApprovedFieldLocked('images')
                      }
                      multiple
                    />
                  </label>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {parseImageInputs(productForm.imageUrls).length} image(s) selected
                </div>
                {parseImageInputs(productForm.imageUrls).length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {parseImageInputs(productForm.imageUrls).map((entry) => (
                      <div key={entry.url} className="relative overflow-hidden rounded border">
                        <img src={entry.url} alt="Fabric" className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveProductImage(entry.url)}
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.productImages) || isApprovedFieldLocked('images')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              ) : null}
            </div>

            {isApprovedProductEdit ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Approved Product Edit Access</p>
                <p className="text-xs text-blue-800">
                  Editable fields: {Array.from(editableFieldSet).join(', ') || 'None configured by admin'}.
                  {selectedFabric?.approvedEditAccessEndsAt
                    ? ` Extended access expires ${new Date(selectedFabric.approvedEditAccessEndsAt).toLocaleString()}.`
                    : ''}
                </p>
                {lockedFieldKeys.length > 0 ? (
                  <div className="rounded border border-blue-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-800">
                      Need changes to locked fields? Send request to admin.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {lockedFieldKeys.map((fieldKey) => (
                        <label key={fieldKey} className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={productChangeRequestedFields.includes(fieldKey)}
                            onChange={(event) =>
                              setProductChangeRequestedFields((prev) => {
                                if (event.target.checked) return Array.from(new Set([...prev, fieldKey]));
                                return prev.filter((entry) => entry !== fieldKey);
                              })
                            }
                          />
                          {fieldKey}
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={productChangeRequestMessage}
                      onChange={(event) => setProductChangeRequestMessage(event.target.value)}
                      placeholder="Describe exactly what needs to change for this product..."
                      className="h-20 w-full rounded border px-3 py-2 text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        type="button"
                        variant="outline"
                        onClick={handleSubmitProductChangeRequest}
                        disabled={submittingProductChangeRequest}
                      >
                        {submittingProductChangeRequest ? 'Submitting...' : 'Submit Product Change Request'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isEditMode && selectedFabric ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Featured Request</h4>
                <p className="text-xs text-gray-600">
                  Submit featured placement for this product from this popup. Admin approval and payment are required before activation.
                </p>
                {String(selectedFabric.status || '').toUpperCase() !== 'APPROVED' ? (
                  <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    This product is not approved yet. Featured requests are available only after admin approval.
                  </div>
                ) : !featuredSettings?.enabled ? (
                  <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    Featured requests are currently disabled by admin.
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="flex flex-col gap-1 text-xs text-gray-700">
                        <span>Duration value</span>
                        <input
                          type="number"
                          min={1}
                          max={Number(featuredSettings?.maxDurationValue || 36)}
                          className="rounded border px-3 py-2 text-sm"
                          value={featuredRequestDurationValue}
                          disabled={featuredSettings?.allowVendorRequestedDuration === false}
                          onChange={(e) => setFeaturedRequestDurationValue(Math.max(1, Number(e.target.value || 1)))}
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-700">
                        <span>Duration unit</span>
                        <select
                          className="rounded border px-3 py-2 text-sm"
                          value={featuredRequestDurationUnit}
                          disabled={featuredSettings?.allowVendorRequestedDuration === false}
                          onChange={(e) => setFeaturedRequestDurationUnit(e.target.value as 'DAYS' | 'WEEKS' | 'MONTHS')}
                        >
                          <option value="DAYS">Days</option>
                          <option value="WEEKS">Weeks</option>
                          <option value="MONTHS">Months</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-gray-700">
                        <span>Request note</span>
                        <input
                          type="text"
                          className="rounded border px-3 py-2 text-sm"
                          value={featuredRequestNotes}
                          onChange={(e) => setFeaturedRequestNotes(e.target.value)}
                          placeholder="Optional note"
                        />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleSubmitFeaturedRequestForProduct(selectedFabric.id)}
                        disabled={submittingFeaturedRequest || !canUploadByProfile}
                      >
                        {submittingFeaturedRequest ? 'Submitting...' : 'Submit Featured Request'}
                      </Button>
                      <span className="text-xs text-gray-600">
                        Base price: ${Number(featuredSettings?.basePriceUsdByType?.FABRIC || 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {activeFeaturedRequestForSelectedFabric ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Existing request status: {activeFeaturedRequestForSelectedFabric.requestStatus}
                    {activeFeaturedRequestForSelectedFabric.requestStatus === 'APPROVED_AWAITING_PAYMENT' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleCreateFeaturedPaymentSession(activeFeaturedRequestForSelectedFabric.id)}
                          disabled={!canUploadByProfile || featuredPaymentActionRequestId === activeFeaturedRequestForSelectedFabric.id}
                        >
                          {featuredPaymentActionRequestId === activeFeaturedRequestForSelectedFabric.id
                            ? 'Processing...'
                            : 'Open Payment'}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => handleVerifyFeaturedPayment(activeFeaturedRequestForSelectedFabric.id)}
                          disabled={
                            !canUploadByProfile ||
                            featuredPaymentActionRequestId === activeFeaturedRequestForSelectedFabric.id ||
                            !getFeaturedPaymentDraft(activeFeaturedRequestForSelectedFabric).reference
                          }
                        >
                          Verify Payment
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {productError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {productError}
              </div>
            ) : null}
            {productSuccess ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {productSuccess}
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
      {showStockModal && selectedFabric && canUpdateStock && (
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
      <OrderSupportModal
        isOpen={Boolean(supportOrderId)}
        orderId={supportOrderId}
        initialTab={supportInitialTab}
        onClose={() => setSupportOrderId(null)}
      />
    </div>
  );
}
