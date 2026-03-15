import { useState, useEffect, useMemo, useRef } from 'react';
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
  Filter,
  Upload,
  X,
  Sparkles,
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
  suitableFabrics: Array<{
    fabricId: string;
    yardsNeeded: number;
    fabricName?: string;
    sellerCountry?: string;
    materialTypeId?: string;
    materialTypeName?: string;
  }>;
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
  approvedEditableFields?: string[];
  approvedEditAccessEndsAt?: string | null;
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
  sizeVariations: Array<{ id?: string; size: string; color?: string; variantKey?: string; price: number; stock: number }>;
  isFeatured?: boolean;
  featuredSections?: string[];
  listingCurrencyCode?: string;
  listingLocalPrice?: number;
  listingUsdPrice?: number;
  approvedEditableFields?: string[];
  approvedEditAccessEndsAt?: string | null;
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
  materialTypeId: string;
  materialTypeName: string;
  sellerCountry: string;
  sellerName: string;
  image?: string;
  priceUsd?: number;
}

interface MeasurementTemplateOption {
  name: string;
  unit: string;
  isRequired: boolean;
  instructions?: string;
}

interface FabricMaterialOption {
  id: string;
  name: string;
}

interface FabricCountryAccessRequest {
  id: string;
  designerUserId: string;
  requestedCountries: string[];
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
  reviewedByName?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface DesignFormState {
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  imageUrls: string;
  selectedFabricIds: string[];
  yardsByFabricId: Record<string, string>;
  selectedMeasurementNames: string[];
  priceCurrencyCode: string;
}

interface ReadyVariantFormRow {
  size: string;
  color: string;
  price: string;
  stock: string;
}

interface ReadyToWearFormState {
  name: string;
  description: string;
  categoryId: string;
  basePrice: string;
  imageUrls: string;
  priceCurrencyCode: string;
  variants: ReadyVariantFormRow[];
}

interface PaymentProviderOption {
  providerKey: string;
  displayName: string;
  checkoutType: 'INLINE' | 'REDIRECT';
  mode: 'TEST' | 'LIVE';
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

type DesignerDashboardGovernance = {
  tabs: {
    overview: boolean;
    designs: boolean;
    featured: boolean;
    orders: boolean;
    tryon: boolean;
  };
  sections: {
    profileGovernance: boolean;
    stats: boolean;
    overviewOrderStatus: boolean;
    overviewRevenueChart: boolean;
    overviewTopDesigns: boolean;
    overviewActivity: boolean;
    overviewPendingOrdersAlert: boolean;
    overviewTryOnInsights: boolean;
    tryOnInsightsSummary: boolean;
    tryOnInsightsRecent: boolean;
    productsTable: boolean;
    featuredTable: boolean;
    ordersTable: boolean;
    fabricCountryAccess: boolean;
    readyStockModal: boolean;
  };
  actions: {
    submitProfile: boolean;
    addDesignProduct: boolean;
    addReadyToWearProduct: boolean;
    editDesignProduct: boolean;
    editReadyToWearProduct: boolean;
    manageReadyStock: boolean;
    requestFabricCountryAccess: boolean;
    updateOrderStatus: boolean;
  };
  fields: {
    designName: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designDescription: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designStyle: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designBasePrice: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designListingCurrency: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designImages: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designSuitableFabrics: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    designMeasurementVariables: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyName: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyDescription: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyStyle: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyBasePrice: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyListingCurrency: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyImages: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
    readyVariants: 'ENABLED' | 'READ_ONLY' | 'HIDDEN';
  };
};

const DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE: DesignerDashboardGovernance = {
  tabs: { overview: true, designs: true, featured: true, orders: true, tryon: true },
  sections: {
    profileGovernance: true,
    stats: true,
    overviewOrderStatus: true,
    overviewRevenueChart: true,
    overviewTopDesigns: true,
    overviewActivity: true,
    overviewPendingOrdersAlert: true,
    overviewTryOnInsights: true,
    tryOnInsightsSummary: true,
    tryOnInsightsRecent: true,
    productsTable: true,
    featuredTable: true,
    ordersTable: true,
    fabricCountryAccess: true,
    readyStockModal: true,
  },
  actions: {
    submitProfile: true,
    addDesignProduct: true,
    addReadyToWearProduct: true,
    editDesignProduct: true,
    editReadyToWearProduct: true,
    manageReadyStock: true,
    requestFabricCountryAccess: true,
    updateOrderStatus: true,
  },
  fields: {
    designName: 'ENABLED',
    designDescription: 'ENABLED',
    designStyle: 'ENABLED',
    designBasePrice: 'ENABLED',
    designListingCurrency: 'ENABLED',
    designImages: 'ENABLED',
    designSuitableFabrics: 'ENABLED',
    designMeasurementVariables: 'ENABLED',
    readyName: 'ENABLED',
    readyDescription: 'ENABLED',
    readyStyle: 'ENABLED',
    readyBasePrice: 'ENABLED',
    readyListingCurrency: 'ENABLED',
    readyImages: 'ENABLED',
    readyVariants: 'ENABLED',
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

const normalizeDesignerDashboardGovernance = (input: any): DesignerDashboardGovernance => ({
  tabs: { ...DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.tabs, ...(input?.tabs || {}) },
  sections: { ...DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.sections, ...(input?.sections || {}) },
  actions: { ...DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.actions, ...(input?.actions || {}) },
  fields: {
    designName: normalizeFieldMode(input?.fields?.designName ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designName),
    designDescription: normalizeFieldMode(
      input?.fields?.designDescription ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designDescription
    ),
    designStyle: normalizeFieldMode(input?.fields?.designStyle ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designStyle),
    designBasePrice: normalizeFieldMode(
      input?.fields?.designBasePrice ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designBasePrice
    ),
    designListingCurrency: normalizeFieldMode(
      input?.fields?.designListingCurrency ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designListingCurrency
    ),
    designImages: normalizeFieldMode(input?.fields?.designImages ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designImages),
    designSuitableFabrics: normalizeFieldMode(
      input?.fields?.designSuitableFabrics ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designSuitableFabrics
    ),
    designMeasurementVariables: normalizeFieldMode(
      input?.fields?.designMeasurementVariables ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.designMeasurementVariables
    ),
    readyName: normalizeFieldMode(input?.fields?.readyName ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyName),
    readyDescription: normalizeFieldMode(
      input?.fields?.readyDescription ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyDescription
    ),
    readyStyle: normalizeFieldMode(input?.fields?.readyStyle ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyStyle),
    readyBasePrice: normalizeFieldMode(
      input?.fields?.readyBasePrice ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyBasePrice
    ),
    readyListingCurrency: normalizeFieldMode(
      input?.fields?.readyListingCurrency ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyListingCurrency
    ),
    readyImages: normalizeFieldMode(input?.fields?.readyImages ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyImages),
    readyVariants: normalizeFieldMode(input?.fields?.readyVariants ?? DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE.fields.readyVariants),
  },
});

const LOCATION_COUNTRIES = getCountryOptions();
const COUNTRY_FIELD_HINTS = ['country', 'businesscountry', 'vendorcountry'];
const CITY_FIELD_HINTS = ['city', 'businesscity', 'vendorcity', 'town'];
const PHONE_FIELD_HINTS = ['phone', 'phonenumber', 'businessphone', 'mobile', 'contactnumber'];
const READY_TO_WEAR_VARIANT_SEPARATOR = '::';
const LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS = [' / ', '/', '|'] as const;
const DEFAULT_READY_TO_WEAR_COLOR = 'DEFAULT';

const normalizeReadyVariantSize = (value: unknown) => String(value || '').trim().toUpperCase();
const normalizeReadyVariantColor = (value: unknown) =>
  String(value || DEFAULT_READY_TO_WEAR_COLOR)
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ') || DEFAULT_READY_TO_WEAR_COLOR;
const encodeReadyVariantKey = (size: unknown, color?: unknown) =>
  `${normalizeReadyVariantSize(size)}${READY_TO_WEAR_VARIANT_SEPARATOR}${normalizeReadyVariantColor(color)}`;
const decodeReadyVariant = (sizeValue: unknown, colorValue?: unknown) => {
  const rawSize = String(sizeValue || '').trim().toUpperCase();
  const rawColor = String(colorValue || '').trim();
  if (rawSize.includes(READY_TO_WEAR_VARIANT_SEPARATOR)) {
    const [sizePart, colorPart] = rawSize.split(READY_TO_WEAR_VARIANT_SEPARATOR);
    const size = normalizeReadyVariantSize(sizePart);
    const color = normalizeReadyVariantColor(colorPart);
    return { size, color, variantKey: encodeReadyVariantKey(size, color) };
  }
  for (const separator of LEGACY_READY_TO_WEAR_VARIANT_SEPARATORS) {
    if (!rawSize.includes(separator)) continue;
    const [sizePart, colorPart] = rawSize.split(separator);
    const size = normalizeReadyVariantSize(sizePart);
    const color = normalizeReadyVariantColor(colorPart);
    return { size, color, variantKey: encodeReadyVariantKey(size, color) };
  }
  const size = normalizeReadyVariantSize(rawSize);
  const color = normalizeReadyVariantColor(rawColor || DEFAULT_READY_TO_WEAR_COLOR);
  return { size, color, variantKey: encodeReadyVariantKey(size, color) };
};

const READY_COLOR_OPTIONS = [
  'DEFAULT',
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
const ALL_DESIGN_EDITABLE_FIELDS = [
  'name',
  'description',
  'categoryId',
  'basePrice',
  'suitableFabricIds',
  'measurementVariables',
  'images',
] as const;
const ALL_READY_TO_WEAR_EDITABLE_FIELDS = [
  'name',
  'description',
  'categoryId',
  'basePrice',
  'sizes',
  'images',
] as const;
const normalizeImageUrlList = (input: unknown): string[] =>
  (Array.isArray(input) ? input : [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return String((entry as any).url || '');
      return '';
    })
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

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

export default function DesignerDashboard() {
  const [stats, setStats] = useState<DesignerStats | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [orders, setOrders] = useState<DesignOrder[]>([]);
  const [readyProducts, setReadyProducts] = useState<ReadyProduct[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);
  const [fabricOptions, setFabricOptions] = useState<FabricOption[]>([]);
  const [fabricCountryOptions, setFabricCountryOptions] = useState<string[]>([]);
  const [fabricMaterialOptions, setFabricMaterialOptions] = useState<FabricMaterialOption[]>([]);
  const [measurementTemplateOptions, setMeasurementTemplateOptions] = useState<MeasurementTemplateOption[]>([]);
  const [designFabricCountryFilter, setDesignFabricCountryFilter] = useState('');
  const [designFabricMaterialFilter, setDesignFabricMaterialFilter] = useState('');
  const [designFabricSearch, setDesignFabricSearch] = useState('');
  const [designSelectedFabricOptionId, setDesignSelectedFabricOptionId] = useState('');
  const [designFabricOptionsLoading, setDesignFabricOptionsLoading] = useState(false);
  const [designFabricCache, setDesignFabricCache] = useState<Record<string, FabricOption>>({});
  const [fabricAccessHomeCountry, setFabricAccessHomeCountry] = useState('');
  const [fabricAccessAllowedCountries, setFabricAccessAllowedCountries] = useState<string[]>([]);
  const [fabricAccessAvailableCountries, setFabricAccessAvailableCountries] = useState<string[]>([]);
  const [fabricAccessRequests, setFabricAccessRequests] = useState<FabricCountryAccessRequest[]>([]);
  const [fabricAccessRequestCountries, setFabricAccessRequestCountries] = useState<string[]>([]);
  const [fabricAccessRequestReason, setFabricAccessRequestReason] = useState('');
  const [fabricAccessLoading, setFabricAccessLoading] = useState(false);
  const [fabricAccessSubmitting, setFabricAccessSubmitting] = useState(false);
  const [fabricAccessMessage, setFabricAccessMessage] = useState<string | null>(null);
  const [designUploadingImage, setDesignUploadingImage] = useState(false);
  const [designImageUrlInput, setDesignImageUrlInput] = useState('');
  const [maxSuitableFabricsPerDesign, setMaxSuitableFabricsPerDesign] = useState(5);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'designs' | 'featured' | 'orders' | 'tryon'>('overview');
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [isSavingDesign, setIsSavingDesign] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [dashboardLoadError, setDashboardLoadError] = useState<string | null>(null);
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
    selectedMeasurementNames: [],
    priceCurrencyCode: 'USD',
  });
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [isSavingReady, setIsSavingReady] = useState(false);
  const [isReadyEditMode, setIsReadyEditMode] = useState(false);
  const [selectedReadyForEdit, setSelectedReadyForEdit] = useState<ReadyProduct | null>(null);
  const [readyError, setReadyError] = useState<string | null>(null);
  const [readyUploadingImage, setReadyUploadingImage] = useState(false);
  const [readyImageUrlInput, setReadyImageUrlInput] = useState('');
  const [readySizeOptions, setReadySizeOptions] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [readyForm, setReadyForm] = useState<ReadyToWearFormState>({
    name: '',
    description: '',
    categoryId: '',
    basePrice: '',
    imageUrls: '',
    priceCurrencyCode: 'USD',
    variants: [{ size: 'M', color: 'DEFAULT', price: '', stock: '0' }],
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
  const [profileFileValues, setProfileFileValues] = useState<Record<string, string[]>>({});
  const [uploadingProfileField, setUploadingProfileField] = useState<string | null>(null);
  const profileUploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [submittingProfile, setSubmittingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [, setGovernanceDebug] = useState<GovernanceDebugInfo | null>(null);
  const [dashboardGovernance, setDashboardGovernance] = useState<DesignerDashboardGovernance>(
    DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const [productSearch, setProductSearch] = useState('');
  const [productTypeFilter, setProductTypeFilter] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('');
  const [showReadyStockModal, setShowReadyStockModal] = useState(false);
  const [selectedReadyProduct, setSelectedReadyProduct] = useState<ReadyProduct | null>(null);
  const [readyStockDraft, setReadyStockDraft] = useState<Array<{ size: string; color: string; stock: string }>>([]);
  const [readyStockSaving, setReadyStockSaving] = useState(false);
  const [readyStockError, setReadyStockError] = useState<string | null>(null);
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);
  const [supportInitialTab, setSupportInitialTab] = useState<'details' | 'ticket'>('ticket');
  const [tryOnInsights, setTryOnInsights] = useState<any>(null);
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
  const [designSuccess, setDesignSuccess] = useState<string | null>(null);
  const [readySuccess, setReadySuccess] = useState<string | null>(null);

  const hasRejectionRestriction = profileCompletion?.profileStatus === 'REJECTED';
  const restrictedTabs = hasRejectionRestriction ? (['overview'] as const) : (['overview', 'designs', 'featured', 'orders', 'tryon'] as const);
  const visibleTabs = useMemo(
    () =>
      restrictedTabs.filter(
        (tab) => dashboardGovernance.tabs[tab] !== false
      ),
    [dashboardGovernance.tabs, restrictedTabs]
  );
  const fallbackTab = visibleTabs[0] || 'overview';

  const syncTabWithUrl = (tab: 'overview' | 'designs' | 'featured' | 'orders' | 'tryon') => {
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
      normalizedTab === 'designs' ||
      normalizedTab === 'featured' ||
      normalizedTab === 'orders' ||
      normalizedTab === 'overview' ||
      normalizedTab === 'tryon'
        ? (normalizedTab as 'overview' | 'designs' | 'featured' | 'orders' | 'tryon')
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
        statsResult,
        designsResult,
        readyResult,
        ordersResult,
        categoriesResult,
        fabricOptionsResult,
        measurementTemplatesResult,
        currencyResult,
        readySizeOptionsResult,
        governanceResult,
        tryOnInsightsResult,
        featuredRequestsResult,
        featuredSettingsResult,
        paymentOptionsResult,
        orderLimitsResult,
      ] = await Promise.allSettled([
        api.designer.getDashboard(),
        api.designer.getDesigns(),
        api.designer.getReadyToWear(),
        api.designer.getOrders(),
        api.products.getCategories(),
        api.designer.getDesignFabricOptions({ limit: 300 }),
        api.designer.getMeasurementTemplateOptions(),
        api.currency.getMyOptions(),
        api.designer.getReadyToWearSizeOptions(),
        api.designer.getDashboardGovernance(),
        api.designer.getTryOnInsights(),
        api.featuredRequests.listMyRequests(),
        api.featuredRequests.getSettings(),
        api.payments.getOptions({ useCase: 'FEATURED' }),
        api.orders.getOrderLimits(),
      ]);
      const statsRes = statsResult.status === 'fulfilled' ? statsResult.value : null;
      const designsRes = designsResult.status === 'fulfilled' ? designsResult.value : null;
      const readyRes = readyResult.status === 'fulfilled' ? readyResult.value : null;
      const ordersRes = ordersResult.status === 'fulfilled' ? ordersResult.value : null;
      const categoriesRes = categoriesResult.status === 'fulfilled' ? categoriesResult.value : null;
      const fabricOptionsRes = fabricOptionsResult.status === 'fulfilled' ? fabricOptionsResult.value : null;
      const measurementTemplatesRes =
        measurementTemplatesResult.status === 'fulfilled' ? measurementTemplatesResult.value : null;
      const currencyRes = currencyResult.status === 'fulfilled' ? currencyResult.value : null;
      const readySizeOptionsRes = readySizeOptionsResult.status === 'fulfilled' ? readySizeOptionsResult.value : null;
      const governanceRes = governanceResult.status === 'fulfilled' ? governanceResult.value : null;
      const tryOnInsightsRes = tryOnInsightsResult.status === 'fulfilled' ? tryOnInsightsResult.value : null;
      const featuredRequestsRes = featuredRequestsResult.status === 'fulfilled' ? featuredRequestsResult.value : null;
      const featuredSettingsRes = featuredSettingsResult.status === 'fulfilled' ? featuredSettingsResult.value : null;
      const paymentOptionsRes = paymentOptionsResult.status === 'fulfilled' ? paymentOptionsResult.value : null;
      const orderLimitsRes = orderLimitsResult.status === 'fulfilled' ? orderLimitsResult.value : null;
      setMaxSuitableFabricsPerDesign(
        orderLimitsRes?.success
          ? Math.max(1, Math.min(50, Number(orderLimitsRes.data?.maxSuitableFabricsPerDesign || 5)))
          : 5
      );
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
        getSettledFailureMessage('Dashboard', statsResult),
        getSettledFailureMessage('Designs', designsResult),
        getSettledFailureMessage('Ready-to-wear', readyResult),
        getSettledFailureMessage('Orders', ordersResult),
      ].find((entry): entry is string => Boolean(entry));
      if (firstCriticalFailure) {
        setDashboardLoadError(firstCriticalFailure);
      }
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
      } else {
        const profileFieldsResult = await Promise.allSettled([api.designer.getProfileFields()]);
        profileFieldsRes = profileFieldsResult[0]?.status === 'fulfilled' ? profileFieldsResult[0].value : null;
        profileFieldsCallStatus = settledCallStatus(profileFieldsResult[0] as PromiseSettledResult<any>);
      }

      const mappedOrders: DesignOrder[] = ordersRes?.success
        ? (ordersRes.data || []).map((item: any) => {
            const kind = String(item.kind || 'DESIGN_ORDER');
            const createdAt = item.order?.createdAt || item.createdAt;
            const dueDate = new Date(new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const isReadyToWear = kind === 'READY_TO_WEAR_ORDER';
            const totalAmount = isReadyToWear
              ? Number(item.price || 0) * Math.max(1, Number(item.quantity || 1))
              : Number(item.price || 0);
            const fabricInfo = isReadyToWear
              ? `${item.size ? `Size ${String(item.size)}` : 'Ready-to-wear'} · Qty ${Math.max(1, Number(item.quantity || 1))}`
              : 'Included in order details';
            const status = String(item.order?.status || item.status || 'PENDING');
            return {
              id: String(item.id),
              orderId: String(item.orderId || item.order?.id || ''),
              orderNumber: item.order?.orderNumber || 'N/A',
              designName: isReadyToWear ? item.readyToWear?.name || 'Ready To Wear' : item.design?.name || 'Design',
              customerName: 'Customer (Protected)',
              measurements:
                !isReadyToWear && item.measurements && typeof item.measurements === 'object'
                  ? item.measurements
                  : {},
              fabricInfo,
              totalAmount,
              status,
              createdAt,
              dueDate,
              priority: status === 'PENDING' || status === 'PAYMENT_CONFIRMED' ? 'HIGH' : 'MEDIUM',
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
          images: normalizeImageUrlList(design.images),
          category: design.category || { name: 'Style' },
          suitableFabrics: Array.isArray(design.suitableFabrics)
            ? design.suitableFabrics.map((item: any) => ({
                fabricId: String(item.fabricId || item.fabric?.id || ''),
                yardsNeeded: Number(item.yardsNeeded || 1),
                fabricName: String(item.fabric?.name || ''),
                sellerCountry: String(item.fabric?.seller?.country || ''),
                materialTypeId: String(item.fabric?.materialTypeId || item.fabric?.materialType?.id || ''),
                materialTypeName: String(item.fabric?.materialType?.name || ''),
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
          approvedEditableFields: Array.isArray(design.approvedEditableFields) ? design.approvedEditableFields : [],
          approvedEditAccessEndsAt: design.approvedEditAccessEndsAt ? String(design.approvedEditAccessEndsAt) : null,
        }));
        setDesigns(mappedDesigns);
      }
      if (readyRes?.success) {
        const mappedReady = (readyRes.data || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Ready To Wear',
          description: item.description || '',
          category: item.category || { name: 'Style' },
          basePrice: Number(item.basePrice || 0),
          status: item.status || 'DRAFT',
          images: normalizeImageUrlList(item.images),
          orderCount: Number(item?._count?.orderItems || 0),
          sizeVariations: Array.isArray(item.sizeVariations)
            ? item.sizeVariations.map((variation: any) => {
                const decoded = decodeReadyVariant(variation?.size, variation?.color);
                return {
                  id: String(variation?.id || ''),
                  size: decoded.size,
                  color: decoded.color,
                  variantKey: String(variation?.variantKey || decoded.variantKey || ''),
                  price: Number(variation?.price || 0),
                  stock: Number(variation?.stock || 0),
                };
              })
            : [],
          isFeatured: Boolean(item.isFeatured),
          featuredSections: Array.isArray(item.featuredSections) ? item.featuredSections : [],
          listingCurrencyCode: String(item.listingCurrencyCode || 'USD'),
          listingLocalPrice: Number(item.listingLocalPrice || item.basePrice || 0),
          listingUsdPrice: Number(item.listingUsdPrice || item.basePrice || 0),
          approvedEditableFields: Array.isArray(item.approvedEditableFields) ? item.approvedEditableFields : [],
          approvedEditAccessEndsAt: item.approvedEditAccessEndsAt ? String(item.approvedEditAccessEndsAt) : null,
        }));
        setReadyProducts(mappedReady);
      }
      if (ordersRes?.success) setOrders(mappedOrders);
      if (categoriesRes?.success) {
        setCategories(
          Array.isArray(categoriesRes.data)
            ? categoriesRes.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Style') }))
            : []
        );
      }
      if (fabricOptionsRes?.success) {
        const rows = Array.isArray(fabricOptionsRes.data?.fabrics) ? fabricOptionsRes.data.fabrics : [];
        const mappedFabrics = rows.map((item: any) => ({
          id: String(item.id),
          name: String(item.name || 'Fabric'),
          materialTypeId: String(item.materialTypeId || ''),
          materialTypeName: String(item.materialTypeName || 'Material'),
          sellerCountry: String(item.sellerCountry || ''),
          sellerName: String(item.sellerName || 'Fabric Seller'),
          image: String(item.image || ''),
          priceUsd: Number(item.priceUsd || 0),
        }));
        setFabricOptions(mappedFabrics);
        setDesignFabricCache((prev) => ({
          ...prev,
          ...mappedFabrics.reduce<Record<string, FabricOption>>((acc, item) => {
            acc[item.id] = item;
            return acc;
          }, {}),
        }));
        const countries = Array.isArray(fabricOptionsRes.data?.countries)
          ? fabricOptionsRes.data.countries.map((entry: any) => String(entry || '').trim()).filter(Boolean)
          : [];
        const materials = Array.isArray(fabricOptionsRes.data?.materials)
          ? fabricOptionsRes.data.materials.map((entry: any) => ({
              id: String(entry?.id || ''),
              name: String(entry?.name || ''),
            }))
          : [];
        setFabricCountryOptions(countries);
        setFabricMaterialOptions(materials.filter((entry) => entry.id && entry.name));
        if (countries.length > 0 && !designFabricCountryFilter) {
          setDesignFabricCountryFilter(countries[0]);
        }
      }
      if (measurementTemplatesRes?.success) {
        const rows = Array.isArray(measurementTemplatesRes.data) ? measurementTemplatesRes.data : [];
        const templates = rows
          .map((item: any) => ({
            name: String(item?.name || '').trim(),
            unit: String(item?.unit || 'cm').trim() || 'cm',
            isRequired: Boolean(item?.isRequired ?? true),
            instructions: String(item?.instructions || '').trim(),
          }))
          .filter((item) => item.name.length > 0);
        setMeasurementTemplateOptions(templates);
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
      if (readySizeOptionsRes?.success) {
        const rows = Array.isArray(readySizeOptionsRes.data?.sizes) ? readySizeOptionsRes.data.sizes : [];
        const normalized = rows
          .map((entry: any) => String(entry || '').trim().toUpperCase())
          .filter(Boolean);
        if (normalized.length > 0) {
          setReadySizeOptions(normalized);
        }
      }
      if (governanceRes?.success) {
        setDashboardGovernance(normalizeDesignerDashboardGovernance(governanceRes.data));
      } else {
        setDashboardGovernance(DEFAULT_DESIGNER_DASHBOARD_GOVERNANCE);
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
        const completion = completionPayload as DesignerProfileCompletion;
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
              ? getDesignerProfilePrefillValue(completion.profile, field.key)
              : String(rawValue);
        }
        setProfileForm(nextProfileForm);
        setProfileFileValues(nextProfileFileValues);
        if (effectiveFields.length === 0) {
          setProfileMessage('Vendor profile form is not configured yet. Admin must define Fashion Designer fields first.');
        }
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
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
            nextProfileForm[field.key] = getDesignerProfilePrefillValue(syntheticCompletion.profile, field.key);
          }
        }
        setProfileForm(nextProfileForm);
        setProfileFileValues(nextProfileFileValues);
        setProfileMessage('Vendor profile form loaded from admin configuration. Complete and submit for admin approval.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
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
      } else if (profileRoutesMissing && statsRes?.success) {
        const fallbackProfile = statsRes.data?.profile || {};
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
            bio: String(fallbackProfile?.bio || ''),
            storefrontPath: String(fallbackProfile?.storefrontPath || ''),
          },
          profileData: {},
          fields: [],
        });
        setProfileForm({});
        setProfileFileValues({});
        setProfileMessage('Vendor profile form is unavailable because admin profile-field routes are missing on this deployment.');
        setGovernanceDebug({
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
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
          dashboardCall: settledCallStatus(statsResult),
          designsCall: settledCallStatus(designsResult),
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
      const message =
        String((error as any)?.response?.data?.message || (error as any)?.message || 'Unknown error');
      setDashboardLoadError(`Unable to load designer dashboard data: ${message}`);
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
    if (!canUpdateOrderStatus) return;
    try {
      await api.designer.updateOrderStatus(orderId, status);
      fetchDashboardData();
    } catch (error: any) {
      const message = String(error?.response?.data?.message || error?.message || 'Failed to update order status.');
      setDashboardLoadError(message);
      console.error('Failed to update order status:', error);
    }
  };

  useEffect(() => {
    if (categories.length > 0 && !designForm.categoryId) {
      setDesignForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, designForm.categoryId]);

  const resetDesignForm = () => {
    const defaultMeasurements = measurementTemplateOptions
      .filter((item) => item.isRequired)
      .map((item) => item.name);
    setDesignForm({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      basePrice: '',
      imageUrls: '',
      selectedFabricIds: [],
      yardsByFabricId: {},
      selectedMeasurementNames: defaultMeasurements,
      priceCurrencyCode: currencyOptions.defaultCurrency || 'USD',
    });
    setSelectedDesign(null);
    setIsEditMode(false);
    setDesignError(null);
    setDesignSuccess(null);
    setDesignImageUrlInput('');
    setDesignSelectedFabricOptionId('');
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
  };

  const openCreateDesignModal = () => {
    if (!canAddDesignProduct) return;
    resetDesignForm();
    setShowDesignModal(true);
  };

  const resetReadyForm = () => {
    const defaultSize = readySizeOptions[0] || 'M';
    setReadyForm({
      name: '',
      description: '',
      categoryId: categories[0]?.id || '',
      basePrice: '',
      imageUrls: '',
      priceCurrencyCode: currencyOptions.defaultCurrency || 'USD',
      variants: [{ size: defaultSize, color: 'DEFAULT', price: '', stock: '0' }],
    });
    setIsReadyEditMode(false);
    setSelectedReadyForEdit(null);
    setReadyError(null);
    setReadySuccess(null);
    setReadyImageUrlInput('');
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
  };

  const openCreateReadyModal = () => {
    if (!canAddReadyProduct) return;
    resetReadyForm();
    setShowReadyModal(true);
  };

  const openEditDesignModal = (design: Design) => {
    if (!canEditDesignProduct) return;
    const yardsByFabricId = (design.suitableFabrics || []).reduce<Record<string, string>>((acc, item) => {
      if (item.fabricId) acc[item.fabricId] = String(item.yardsNeeded || 1);
      return acc;
    }, {});

    setSelectedDesign(design);
    setIsEditMode(true);
    setDesignError(null);
    setDesignSuccess(null);
    setDesignForm({
      name: design.name,
      description: design.description || '',
      categoryId: design.categoryId || categories[0]?.id || '',
      basePrice: String(design.listingLocalPrice || design.basePrice || ''),
      imageUrls: (design.images || []).join('\n'),
      selectedFabricIds: (design.suitableFabrics || []).map((item) => item.fabricId).filter(Boolean),
      yardsByFabricId,
      selectedMeasurementNames: (design.measurementVariables || []).map((item) => item.name).filter(Boolean),
      priceCurrencyCode: String(design.listingCurrencyCode || currencyOptions.defaultCurrency || 'USD'),
    });
    const firstSellerCountry = String(design.suitableFabrics?.[0]?.sellerCountry || '').trim();
    if (firstSellerCountry) {
      setDesignFabricCountryFilter(firstSellerCountry);
    }
    setDesignFabricCache((prev) => {
      const next = { ...prev };
      for (const entry of design.suitableFabrics || []) {
        const fabricId = String(entry.fabricId || '').trim();
        if (!fabricId) continue;
        next[fabricId] = {
          id: fabricId,
          name: String(entry.fabricName || `Fabric ${fabricId.slice(0, 8)}`),
          materialTypeId: String(entry.materialTypeId || ''),
          materialTypeName: String(entry.materialTypeName || 'Material'),
          sellerCountry: String(entry.sellerCountry || ''),
          sellerName: 'Fabric Seller',
        };
      }
      return next;
    });
    setDesignSelectedFabricOptionId('');
    setDesignImageUrlInput('');
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
    setFeaturedRequestDurationValue(Math.max(1, Number(featuredSettings?.defaultDurationValue || 2)));
    setFeaturedRequestDurationUnit(
      String(featuredSettings?.defaultDurationUnit || 'WEEKS').toUpperCase() as 'DAYS' | 'WEEKS' | 'MONTHS'
    );
    setShowDesignModal(true);
  };

  const openEditReadyModal = (product: ReadyProduct) => {
    if (!canEditReadyProduct) return;
    const matchedCategoryId =
      categories.find((entry) => String(entry.name || '').trim().toLowerCase() === String(product.category?.name || '').trim().toLowerCase())?.id ||
      categories[0]?.id ||
      '';
    const mappedVariants =
      Array.isArray(product.sizeVariations) && product.sizeVariations.length > 0
        ? product.sizeVariations.map((entry) => ({
            size: String(entry.size || '').trim() || 'M',
            color: String(entry.color || 'DEFAULT').trim() || 'DEFAULT',
            price: String(Number(entry.price || 0)),
            stock: String(Math.max(0, Number(entry.stock || 0))),
          }))
        : [{ size: readySizeOptions[0] || 'M', color: 'DEFAULT', price: String(Number(product.basePrice || 0)), stock: '0' }];
    setIsReadyEditMode(true);
    setSelectedReadyForEdit(product);
    setReadyError(null);
    setReadySuccess(null);
    setReadyImageUrlInput('');
    setReadyForm({
      name: product.name || '',
      description: product.description || '',
      categoryId: matchedCategoryId,
      basePrice: String(product.listingLocalPrice || product.basePrice || 0),
      imageUrls: Array.isArray(product.images) ? product.images.join('\n') : '',
      priceCurrencyCode: String(product.listingCurrencyCode || currencyOptions.defaultCurrency || 'USD'),
      variants: mappedVariants,
    });
    setFeaturedRequestNotes('');
    setProductChangeRequestMessage('');
    setProductChangeRequestedFields([]);
    setFeaturedRequestDurationValue(Math.max(1, Number(featuredSettings?.defaultDurationValue || 2)));
    setFeaturedRequestDurationUnit(
      String(featuredSettings?.defaultDurationUnit || 'WEEKS').toUpperCase() as 'DAYS' | 'WEEKS' | 'MONTHS'
    );
    setShowReadyModal(true);
  };

  const parseImageInputs = (value: string) =>
    value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((url) => ({ url }));

  const normalizeReadyImageList = (urls: string[]) =>
    Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean))).slice(0, 5);

  const normalizeDesignImageList = (urls: string[]) =>
    Array.from(new Set(urls.map((url) => String(url || '').trim()).filter(Boolean))).slice(0, 6);

  const writeDesignImageList = (urls: string[]) => {
    const next = normalizeDesignImageList(urls);
    setDesignForm((prev) => ({ ...prev, imageUrls: next.join('\n') }));
  };

  const writeReadyImageList = (urls: string[]) => {
    const next = normalizeReadyImageList(urls);
    setReadyForm((prev) => ({ ...prev, imageUrls: next.join('\n') }));
  };

  const handleDesignImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      setDesignUploadingImage(true);
      setDesignError(null);
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
        setDesignError('Image upload failed.');
        return;
      }
      const current = parseImageInputs(designForm.imageUrls).map((entry) => entry.url);
      writeDesignImageList([...current, ...uploadedUrls]);
    } catch (error: any) {
      setDesignError(error?.response?.data?.message || error?.message || 'Failed to upload image.');
    } finally {
      setDesignUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleAddDesignImageUrl = () => {
    const value = String(designImageUrlInput || '').trim();
    if (!value) return;
    const current = parseImageInputs(designForm.imageUrls).map((entry) => entry.url);
    writeDesignImageList([...current, value]);
    setDesignImageUrlInput('');
  };

  const handleRemoveDesignImage = (url: string) => {
    const current = parseImageInputs(designForm.imageUrls).map((entry) => entry.url);
    writeDesignImageList(current.filter((entry) => entry !== url));
  };

  const handleReadyImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      setReadyUploadingImage(true);
      setReadyError(null);
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
        setReadyError('Image upload failed.');
        return;
      }
      const current = parseImageInputs(readyForm.imageUrls).map((entry) => entry.url);
      writeReadyImageList([...current, ...uploadedUrls]);
    } catch (error: any) {
      setReadyError(error?.response?.data?.message || error?.message || 'Failed to upload image.');
    } finally {
      setReadyUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleAddReadyImageUrl = () => {
    const value = String(readyImageUrlInput || '').trim();
    if (!value) return;
    const current = parseImageInputs(readyForm.imageUrls).map((entry) => entry.url);
    writeReadyImageList([...current, value]);
    setReadyImageUrlInput('');
  };

  const handleRemoveReadyImage = (url: string) => {
    const current = parseImageInputs(readyForm.imageUrls).map((entry) => entry.url);
    writeReadyImageList(current.filter((entry) => entry !== url));
  };

  const addReadyVariantRow = () => {
    const defaultSize = readySizeOptions[0] || 'M';
    setReadyForm((prev) => ({
      ...prev,
      variants: [...prev.variants, { size: defaultSize, color: 'DEFAULT', price: prev.basePrice || '', stock: '0' }],
    }));
  };

  const removeReadyVariantRow = (index: number) => {
    setReadyForm((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, rowIndex) => rowIndex !== index),
    }));
  };

  const addSelectedFabricFromDropdown = () => {
    const fabricId = String(designSelectedFabricOptionId || '').trim();
    if (!fabricId) return;
    setDesignForm((prev) => {
      if (prev.selectedFabricIds.includes(fabricId)) return prev;
      if (prev.selectedFabricIds.length >= maxSuitableFabricsPerDesign) {
        setDesignError(`You can select up to ${maxSuitableFabricsPerDesign} suitable fabrics for each CTW product.`);
        return prev;
      }
      return {
        ...prev,
        selectedFabricIds: [...prev.selectedFabricIds, fabricId],
        yardsByFabricId: {
          ...prev.yardsByFabricId,
          [fabricId]: prev.yardsByFabricId[fabricId] || '1',
        },
      };
    });
    setDesignSelectedFabricOptionId('');
  };

  const removeSelectedFabric = (fabricId: string) => {
    setDesignForm((prev) => {
      const yardsByFabricId = { ...prev.yardsByFabricId };
      delete yardsByFabricId[fabricId];
      return {
        ...prev,
        selectedFabricIds: prev.selectedFabricIds.filter((entry) => entry !== fabricId),
        yardsByFabricId,
      };
    });
  };

  const loadDesignFabricOptions = async () => {
    try {
      setDesignFabricOptionsLoading(true);
      const response = await api.designer.getDesignFabricOptions({
        country: designFabricCountryFilter || undefined,
        materialTypeId: designFabricMaterialFilter || undefined,
        search: designFabricSearch || undefined,
        limit: 300,
      });
      if (!response.success) return;
      const rows = Array.isArray(response.data?.fabrics) ? response.data.fabrics : [];
      const countries = Array.isArray(response.data?.countries)
        ? response.data.countries.map((entry: any) => String(entry || '').trim()).filter(Boolean)
        : [];
      const materials = Array.isArray(response.data?.materials)
        ? response.data.materials.map((entry: any) => ({
            id: String(entry?.id || ''),
            name: String(entry?.name || ''),
          }))
        : [];
      const mappedRows = rows.map((item: any) => ({
        id: String(item.id),
        name: String(item.name || 'Fabric'),
        materialTypeId: String(item.materialTypeId || ''),
        materialTypeName: String(item.materialTypeName || 'Material'),
        sellerCountry: String(item.sellerCountry || ''),
        sellerName: String(item.sellerName || 'Fabric Seller'),
        image: String(item.image || ''),
        priceUsd: Number(item.priceUsd || 0),
      }));
      setFabricOptions(mappedRows);
      setDesignFabricCache((prev) => ({
        ...prev,
        ...mappedRows.reduce<Record<string, FabricOption>>((acc, item) => {
          acc[item.id] = item;
          return acc;
        }, {}),
      }));
      setFabricCountryOptions(countries);
      setFabricMaterialOptions(materials.filter((entry) => entry.id && entry.name));
      if (!designFabricCountryFilter && countries.length > 0) {
        setDesignFabricCountryFilter(countries[0]);
      }
      if (designFabricCountryFilter && countries.length > 0 && !countries.includes(designFabricCountryFilter)) {
        setDesignFabricCountryFilter(countries[0]);
      }
      if (
        designFabricMaterialFilter &&
        materials.length > 0 &&
        !materials.some((entry) => entry.id === designFabricMaterialFilter)
      ) {
        setDesignFabricMaterialFilter('');
      }
    } catch (error) {
      console.error('Failed to load design fabric options:', error);
    } finally {
      setDesignFabricOptionsLoading(false);
    }
  };

  const loadFabricCountryAccessSummary = async () => {
    try {
      setFabricAccessLoading(true);
      const response = await api.designer.getFabricCountryAccessSummary();
      if (!response.success) return;
      const fallbackProfileCountry = String(selectedProfileCountry || profileCompletion?.profile?.country || '').trim();
      const responseHomeCountry = String(response.data?.homeCountry || '').trim();
      const homeCountry =
        responseHomeCountry && responseHomeCountry.toLowerCase() !== 'not set'
          ? responseHomeCountry
          : fallbackProfileCountry;
      const allowedCountries = Array.isArray(response.data?.allowedCountries)
        ? response.data.allowedCountries.map((entry: any) => String(entry || '').trim()).filter(Boolean)
        : [];
      const availableCountries = Array.isArray(response.data?.availableCountries)
        ? response.data.availableCountries.map((entry: any) => String(entry || '').trim()).filter(Boolean)
        : [];
      const mergedAllowedCountries = Array.from(new Set([homeCountry, ...allowedCountries].filter(Boolean))).sort((a, b) =>
        a.localeCompare(b)
      );
      const mergedAvailableCountries = Array.from(
        new Set([...availableCountries, ...mergedAllowedCountries, ...getCountryOptions().map((entry) => entry.name)])
      )
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      const requests = Array.isArray(response.data?.requests)
        ? response.data.requests
            .map((entry: any) => ({
              id: String(entry?.id || ''),
              designerUserId: String(entry?.designerUserId || ''),
              requestedCountries: Array.isArray(entry?.requestedCountries)
                ? entry.requestedCountries.map((country: any) => String(country || '').trim()).filter(Boolean)
                : [],
              reason: String(entry?.reason || '').trim() || undefined,
              status: String(entry?.status || 'PENDING').toUpperCase() as 'PENDING' | 'APPROVED' | 'REJECTED',
              reviewNotes: String(entry?.reviewNotes || '').trim() || undefined,
              reviewedByName: String(entry?.reviewedByName || '').trim() || undefined,
              createdAt: String(entry?.createdAt || ''),
              updatedAt: String(entry?.updatedAt || ''),
              resolvedAt: String(entry?.resolvedAt || '').trim() || undefined,
            }))
            .filter((entry: any) => entry.id && entry.designerUserId)
        : [];
      setFabricAccessHomeCountry(homeCountry);
      setFabricAccessAllowedCountries(mergedAllowedCountries);
      setFabricAccessAvailableCountries(mergedAvailableCountries);
      setFabricAccessRequests(requests);
      if (!designFabricCountryFilter && mergedAllowedCountries.length > 0) {
        setDesignFabricCountryFilter(mergedAllowedCountries[0]);
      }
    } catch (error) {
      console.error('Failed to load fabric country access summary:', error);
    } finally {
      setFabricAccessLoading(false);
    }
  };

  const submitFabricCountryAccessRequest = async () => {
    if (!canRequestFabricCountryAccess) return;
    const selectedCountries = (fabricAccessRequestCountries || []).map((entry) => String(entry || '').trim()).filter(Boolean);
    if (selectedCountries.length === 0) {
      setFabricAccessMessage('Select at least one country to request.');
      return;
    }
    try {
      setFabricAccessSubmitting(true);
      setFabricAccessMessage(null);
      const response = await api.designer.createFabricCountryAccessRequest({
        requestedCountries: selectedCountries,
        reason: fabricAccessRequestReason.trim() || undefined,
      });
      if (!response.success) {
        setFabricAccessMessage(response.message || 'Unable to submit request right now.');
        return;
      }
      setFabricAccessRequestCountries([]);
      setFabricAccessRequestReason('');
      setFabricAccessMessage(response.message || 'Country access request submitted.');
      await loadFabricCountryAccessSummary();
    } catch (error: any) {
      const issueText = Array.isArray(error?.response?.data?.issues)
        ? error.response.data.issues
            .map((issue: any) => String(issue?.message || '').trim())
            .filter(Boolean)
            .join(', ')
        : '';
      setFabricAccessMessage(issueText || error?.response?.data?.message || error?.message || 'Failed to submit request.');
    } finally {
      setFabricAccessSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showDesignModal) return;
    const timer = setTimeout(() => {
      void loadDesignFabricOptions();
    }, 200);
    return () => clearTimeout(timer);
  }, [showDesignModal, designFabricCountryFilter, designFabricMaterialFilter, designFabricSearch]);

  useEffect(() => {
    if (!showDesignModal) return;
    void loadFabricCountryAccessSummary();
  }, [showDesignModal]);

  const handleSaveDesign = async () => {
    if (!isEditMode && !canAddDesignProduct) return;
    if (isEditMode && !canEditDesignProduct) return;
    setDesignError(null);
    setDesignSuccess(null);

    const images = parseImageInputs(designForm.imageUrls);
    const selectedMeasurementSet = new Set(
      (designForm.selectedMeasurementNames || []).map((name) => String(name || '').trim()).filter(Boolean)
    );
    const measurementVariables = measurementTemplateOptions
      .filter((item) => selectedMeasurementSet.has(item.name))
      .map((item) => ({
        name: item.name,
        unit: item.unit || 'cm',
        isRequired: true,
        instructions: item.instructions || undefined,
      }));
    const suitableFabricIds = designForm.selectedFabricIds.map((fabricId) => ({
      fabricId,
      yardsNeeded: Number(designForm.yardsByFabricId[fabricId] || 1),
    }));
    const isApprovedEdit = Boolean(isEditMode && selectedDesign && String(selectedDesign.status || '').toUpperCase() === 'APPROVED');
    const editableFieldSet = new Set<string>(
      isApprovedEdit
        ? Array.isArray(selectedDesign?.approvedEditableFields)
          ? selectedDesign.approvedEditableFields
          : []
        : [...ALL_DESIGN_EDITABLE_FIELDS]
    );

    const payload: any = {};
    if (isApprovedEdit) {
      if (editableFieldSet.has('name')) {
        if (!designForm.name.trim()) {
          setDesignError('Design name is required.');
          return;
        }
        payload.name = designForm.name.trim();
      }
      if (editableFieldSet.has('description')) {
        if (!designForm.description.trim() || designForm.description.trim().length < 10) {
          setDesignError('Description must be at least 10 characters.');
          return;
        }
        payload.description = designForm.description.trim();
      }
      if (editableFieldSet.has('categoryId')) {
        if (!designForm.categoryId) {
          setDesignError('Please select a style.');
          return;
        }
        payload.categoryId = designForm.categoryId;
      }
      if (editableFieldSet.has('basePrice')) {
        if (Number(designForm.basePrice || 0) <= 0) {
          setDesignError('Base price must be greater than zero.');
          return;
        }
        payload.basePrice = Number(designForm.basePrice);
        payload.priceCurrencyCode = designForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
      }
      if (editableFieldSet.has('images')) {
        if (images.length < 4 || images.length > 6) {
          setDesignError('Custom-to-wear designs require 4 to 6 images.');
          return;
        }
        payload.images = images;
      }
      if (editableFieldSet.has('suitableFabricIds')) {
        if (suitableFabricIds.length === 0) {
          setDesignError('Select at least one suitable fabric.');
          return;
        }
        if (suitableFabricIds.length > maxSuitableFabricsPerDesign) {
          setDesignError(`You can select up to ${maxSuitableFabricsPerDesign} suitable fabrics for each CTW product.`);
          return;
        }
        if (suitableFabricIds.some((item) => Number(item.yardsNeeded || 0) < 1)) {
          setDesignError('Each selected fabric must have yardsNeeded >= 1.');
          return;
        }
        payload.suitableFabricIds = suitableFabricIds;
      }
      if (editableFieldSet.has('measurementVariables')) {
        if (measurementVariables.length === 0) {
          setDesignError('Select at least one measurement field.');
          return;
        }
        payload.measurementVariables = measurementVariables;
      }
      if (Object.keys(payload).length === 0) {
        setDesignError('No editable fields are enabled for this approved product.');
        return;
      }
    } else {
      if (!designForm.name.trim()) {
        setDesignError('Design name is required.');
        return;
      }
      if (!designForm.description.trim() || designForm.description.trim().length < 10) {
        setDesignError('Description must be at least 10 characters.');
        return;
      }
      if (!designForm.categoryId) {
        setDesignError('Please select a style.');
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
      if (suitableFabricIds.length > maxSuitableFabricsPerDesign) {
        setDesignError(`You can select up to ${maxSuitableFabricsPerDesign} suitable fabrics for each CTW product.`);
        return;
      }
      if (measurementVariables.length === 0) {
        setDesignError('Select at least one measurement field.');
        return;
      }
      if (suitableFabricIds.some((item) => Number(item.yardsNeeded || 0) < 1)) {
        setDesignError('Each selected fabric must have yardsNeeded >= 1.');
        return;
      }
      payload.name = designForm.name.trim();
      payload.description = designForm.description.trim();
      payload.categoryId = designForm.categoryId;
      payload.basePrice = Number(designForm.basePrice);
      payload.priceCurrencyCode = designForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
      payload.suitableFabricIds = suitableFabricIds;
      payload.measurementVariables = measurementVariables;
      payload.images = images;
    }

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
      const issueText = Array.isArray(error?.response?.data?.issues)
        ? error.response.data.issues
            .map((issue: any) => String(issue?.message || '').trim())
            .filter(Boolean)
            .join(', ')
        : '';
      setDesignError(issueText || error?.response?.data?.message || error?.message || 'Unable to save design right now.');
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleSaveReadyToWear = async () => {
    if (!isReadyEditMode && !canAddReadyProduct) return;
    if (isReadyEditMode && !canEditReadyProduct) return;
    setReadyError(null);
    setReadySuccess(null);
    const images = parseImageInputs(readyForm.imageUrls);
    const basePrice = Number(readyForm.basePrice || 0);
    const normalizedVariants = readyForm.variants.map((row) => ({
      size: String(row.size || '').trim().toUpperCase(),
      color: String(row.color || '').trim().toUpperCase() || 'DEFAULT',
      price: Number(row.price || 0),
      stock: Number(row.stock || 0),
    }));
    const isApprovedEdit = Boolean(
      isReadyEditMode && selectedReadyForEdit && String(selectedReadyForEdit.status || '').toUpperCase() === 'APPROVED'
    );
    const editableFieldSet = new Set<string>(
      isApprovedEdit
        ? Array.isArray(selectedReadyForEdit?.approvedEditableFields)
          ? selectedReadyForEdit.approvedEditableFields
          : []
        : [...ALL_READY_TO_WEAR_EDITABLE_FIELDS]
    );

    const payload: any = {};
    if (isApprovedEdit) {
      if (editableFieldSet.has('name')) {
        if (!readyForm.name.trim()) {
          setReadyError('Product name is required.');
          return;
        }
        payload.name = readyForm.name.trim();
      }
      if (editableFieldSet.has('description')) {
        if (!readyForm.description.trim() || readyForm.description.trim().length < 10) {
          setReadyError('Description must be at least 10 characters.');
          return;
        }
        payload.description = readyForm.description.trim();
      }
      if (editableFieldSet.has('categoryId')) {
        if (!readyForm.categoryId) {
          setReadyError('Please select a style.');
          return;
        }
        payload.categoryId = readyForm.categoryId;
      }
      if (editableFieldSet.has('basePrice')) {
        if (basePrice <= 0) {
          setReadyError('Base price must be greater than zero.');
          return;
        }
        payload.basePrice = basePrice;
        payload.priceCurrencyCode = readyForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
      }
      if (editableFieldSet.has('images')) {
        if (images.length < 3 || images.length > 5) {
          setReadyError('Ready-to-wear products require 3 to 5 images.');
          return;
        }
        payload.images = images.map((entry, index) => ({
          url: entry.url,
          alt: `${readyForm.name.trim() || 'Ready To Wear'} image ${index + 1}`,
        }));
      }
      if (editableFieldSet.has('sizes')) {
        if (normalizedVariants.length === 0) {
          setReadyError('Please add at least one size/color variant.');
          return;
        }
        if (
          normalizedVariants.some(
            (row) =>
              !row.size ||
              !row.color ||
              !Number.isFinite(row.price) ||
              row.price <= 0 ||
              !Number.isFinite(row.stock) ||
              row.stock < 0
          )
        ) {
          setReadyError('Each variant must include size, color, price, and stock quantity (0 or greater).');
          return;
        }
        if (new Set(normalizedVariants.map((row) => `${row.size}::${row.color}`)).size !== normalizedVariants.length) {
          setReadyError('Duplicate size/color variants are not allowed.');
          return;
        }
        payload.sizes = normalizedVariants.map((row) => ({
          size: row.size,
          color: row.color,
          price: row.price,
          stock: Math.max(0, Math.floor(row.stock)),
        }));
      }
      if (Object.keys(payload).length === 0) {
        setReadyError('No editable fields are enabled for this approved product.');
        return;
      }
    } else {
      if (!readyForm.name.trim()) {
        setReadyError('Product name is required.');
        return;
      }
      if (!readyForm.description.trim() || readyForm.description.trim().length < 10) {
        setReadyError('Description must be at least 10 characters.');
        return;
      }
      if (!readyForm.categoryId) {
        setReadyError('Please select a style.');
        return;
      }
      if (basePrice <= 0) {
        setReadyError('Base price must be greater than zero.');
        return;
      }
      if (images.length < 3 || images.length > 5) {
        setReadyError('Ready-to-wear products require 3 to 5 images.');
        return;
      }
      if (normalizedVariants.length === 0) {
        setReadyError('Please add at least one size/color variant.');
        return;
      }
      if (
        normalizedVariants.some(
          (row) =>
            !row.size ||
            !row.color ||
            !Number.isFinite(row.price) ||
            row.price <= 0 ||
            !Number.isFinite(row.stock) ||
            row.stock < 0
        )
      ) {
        setReadyError('Each variant must include size, color, price, and stock quantity (0 or greater).');
        return;
      }
      if (new Set(normalizedVariants.map((row) => `${row.size}::${row.color}`)).size !== normalizedVariants.length) {
        setReadyError('Duplicate size/color variants are not allowed.');
        return;
      }
      payload.name = readyForm.name.trim();
      payload.description = readyForm.description.trim();
      payload.categoryId = readyForm.categoryId;
      payload.basePrice = basePrice;
      payload.priceCurrencyCode = readyForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD';
      payload.sizes = normalizedVariants.map((row) => ({
        size: row.size,
        color: row.color,
        price: row.price,
        stock: Math.max(0, Math.floor(row.stock)),
      }));
      payload.images = images.map((entry, index) => ({
        url: entry.url,
        alt: `${readyForm.name.trim() || 'Ready To Wear'} image ${index + 1}`,
      }));
    }

    try {
      setIsSavingReady(true);
      if (isReadyEditMode && selectedReadyForEdit) {
        await api.designer.updateReadyToWear(selectedReadyForEdit.id, payload);
      } else {
        await api.designer.createReadyToWear(payload);
      }
      setShowReadyModal(false);
      resetReadyForm();
      await fetchDashboardData();
    } catch (error: any) {
      const issueText = Array.isArray(error?.response?.data?.issues)
        ? error.response.data.issues
            .map((issue: any) => String(issue?.message || '').trim())
            .filter(Boolean)
            .join(', ')
        : '';
      setReadyError(issueText || error?.response?.data?.message || error?.message || 'Failed to save ready-to-wear product.');
    } finally {
      setIsSavingReady(false);
    }
  };

  const handleSubmitProductChangeRequest = async (productType: 'DESIGN' | 'READY_TO_WEAR', productId: string) => {
    const message = String(productChangeRequestMessage || '').trim();
    if (!message) {
      if (productType === 'DESIGN') setDesignError('Please enter a message for the admin change request.');
      else setReadyError('Please enter a message for the admin change request.');
      return;
    }
    try {
      setSubmittingProductChangeRequest(true);
      if (productType === 'DESIGN') {
        setDesignError(null);
        setDesignSuccess(null);
      } else {
        setReadyError(null);
        setReadySuccess(null);
      }
      const response = await api.productChangeRequests.createRequest({
        productType,
        productId,
        message,
        requestedFields: productChangeRequestedFields,
      });
      if (!response.success) {
        const text = response.message || 'Unable to submit product change request.';
        if (productType === 'DESIGN') setDesignError(text);
        else setReadyError(text);
        return;
      }
      setProductChangeRequestMessage('');
      setProductChangeRequestedFields([]);
      if (productType === 'DESIGN') setDesignSuccess('Change request submitted to admin. You can continue editing allowed fields.');
      else setReadySuccess('Change request submitted to admin. You can continue editing allowed fields.');
    } catch (error: any) {
      const text = error?.response?.data?.message || error?.message || 'Unable to submit product change request.';
      if (productType === 'DESIGN') setDesignError(text);
      else setReadyError(text);
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

  const openReadyStockModal = (product: ReadyProduct) => {
    if (!canManageReadyStock || dashboardGovernance.sections.readyStockModal === false) return;
    const rows = (product.sizeVariations || []).map((entry) => ({
      size: String(entry.size || ''),
      color: String(entry.color || 'DEFAULT'),
      stock: String(Math.max(0, Number(entry.stock || 0))),
    }));
    setSelectedReadyProduct(product);
    setReadyStockDraft(rows);
    setReadyStockError(null);
    setShowReadyStockModal(true);
  };

  const handleSaveReadyStock = async () => {
    if (!selectedReadyProduct || !canManageReadyStock) return;
    const normalized = readyStockDraft.map((entry) => ({
      size: String(entry.size || '').trim(),
      color: String(entry.color || 'DEFAULT').trim().toUpperCase(),
      stock: Number(entry.stock || 0),
    }));
    if (normalized.length === 0) {
      setReadyStockError('No size rows found for this product.');
      return;
    }
    if (normalized.some((entry) => !entry.size || !Number.isFinite(entry.stock) || entry.stock < 0)) {
      setReadyStockError('Each size must have a valid stock value (0 or greater).');
      return;
    }

    try {
      setReadyStockSaving(true);
      setReadyStockError(null);
      await api.designer.updateReadyToWearSizeStock(selectedReadyProduct.id, normalized);
      await fetchDashboardData();
      setShowReadyStockModal(false);
      setSelectedReadyProduct(null);
    } catch (error: any) {
      setReadyStockError(
        error?.response?.data?.message || error?.message || 'Failed to save size stock values.'
      );
    } finally {
      setReadyStockSaving(false);
    }
  };

  const handleSubmitFeaturedRequestForProduct = async (
    productId: string,
    productType: 'DESIGN' | 'READY_TO_WEAR'
  ) => {
    if (!productId || !canUploadByProfile) return;
    try {
      setSubmittingFeaturedRequest(true);
      setDashboardLoadError(null);
      const response = await api.featuredRequests.createRequest({
        products: [
          {
            productId,
            productType,
            section: productType === 'READY_TO_WEAR' ? 'FEATURED_READY_TO_WEAR' : 'FEATURED_DESIGNS',
          },
        ],
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
        returnUrl: `${window.location.origin}/designer?tab=featured`,
        cancelUrl: `${window.location.origin}/designer?tab=featured&payment_cancelled=true`,
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
  const selectedReadyListingCurrency = String(readyForm.priceCurrencyCode || currencyOptions.defaultCurrency || 'USD').toUpperCase();
  const selectedReadyUsdPerUnit = Number(currencyOptions.usdPerUnitByCurrency?.[selectedReadyListingCurrency] || 1);
  const readyLocalPricePreview = Number(readyForm.basePrice || 0);
  const readyUsdPricePreview =
    selectedReadyListingCurrency === 'USD'
      ? readyLocalPricePreview
      : Number((readyLocalPricePreview * selectedReadyUsdPerUnit).toFixed(2));
  const isFieldHidden = (mode: 'ENABLED' | 'READ_ONLY' | 'HIDDEN') => mode === 'HIDDEN';
  const isFieldReadOnly = (mode: 'ENABLED' | 'READ_ONLY' | 'HIDDEN') => mode === 'READ_ONLY';
  const canUseDesignForm =
    !isFieldHidden(dashboardGovernance.fields.designName) &&
    !isFieldHidden(dashboardGovernance.fields.designDescription) &&
    !isFieldHidden(dashboardGovernance.fields.designStyle) &&
    !isFieldHidden(dashboardGovernance.fields.designBasePrice) &&
    !isFieldHidden(dashboardGovernance.fields.designImages) &&
    !isFieldHidden(dashboardGovernance.fields.designSuitableFabrics) &&
    !isFieldHidden(dashboardGovernance.fields.designMeasurementVariables);
  const canUseReadyForm =
    !isFieldHidden(dashboardGovernance.fields.readyName) &&
    !isFieldHidden(dashboardGovernance.fields.readyDescription) &&
    !isFieldHidden(dashboardGovernance.fields.readyStyle) &&
    !isFieldHidden(dashboardGovernance.fields.readyBasePrice) &&
    !isFieldHidden(dashboardGovernance.fields.readyImages) &&
    !isFieldHidden(dashboardGovernance.fields.readyVariants);
  const showProfileGovernance = dashboardGovernance.sections.profileGovernance !== false;
  const showStats = dashboardGovernance.sections.stats !== false;
  const canUploadByProfile = Boolean(profileCompletion?.canUpload);
  const profileStatus = String(profileCompletion?.profileStatus || 'INCOMPLETE').toUpperCase();
  const canEditGovernanceProfile = profileStatus === 'INCOMPLETE' || profileStatus === 'REJECTED';
  const canSubmitProfile =
    dashboardGovernance.actions.submitProfile !== false &&
    profileCompletion?.canResubmitProfile !== false &&
    canEditGovernanceProfile;
  const canAddDesignProduct = dashboardGovernance.actions.addDesignProduct !== false && canUseDesignForm && canUploadByProfile;
  const canAddReadyProduct = dashboardGovernance.actions.addReadyToWearProduct !== false && canUseReadyForm && canUploadByProfile;
  // Keep add-product strict on full form visibility, but allow edit when edit action is enabled.
  const canEditDesignProduct = dashboardGovernance.actions.editDesignProduct !== false && canUploadByProfile;
  const canEditReadyProduct = dashboardGovernance.actions.editReadyToWearProduct !== false && canUploadByProfile;
  const canManageReadyStock = dashboardGovernance.actions.manageReadyStock !== false && canUploadByProfile;
  const canRequestFabricCountryAccess = dashboardGovernance.actions.requestFabricCountryAccess !== false && canUploadByProfile;
  const canUpdateOrderStatus = dashboardGovernance.actions.updateOrderStatus !== false && canUploadByProfile;
  const hasNoDashboardTabs = visibleTabs.length === 0;
  const overviewHasVisibleContent =
    dashboardGovernance.sections.overviewOrderStatus !== false ||
    dashboardGovernance.sections.overviewRevenueChart !== false ||
    dashboardGovernance.sections.overviewTopDesigns !== false ||
    dashboardGovernance.sections.overviewActivity !== false ||
    dashboardGovernance.sections.overviewTryOnInsights !== false ||
    (dashboardGovernance.sections.overviewPendingOrdersAlert !== false && pendingOrders.length > 0);
  const tryOnHasVisibleContent =
    dashboardGovernance.sections.tryOnInsightsSummary !== false ||
    dashboardGovernance.sections.tryOnInsightsRecent !== false;
  const activeFeaturedRequestForSelectedDesign =
    selectedDesign?.id
      ? featuredRequests.find((request) => {
          const status = String(request.requestStatus || '').toUpperCase();
          if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') return false;
          return Array.isArray(request.productEntries)
            ? request.productEntries.some(
                (entry) =>
                  String(entry.productId || '') === String(selectedDesign.id) &&
                  String(entry.productType || '').toUpperCase() === 'DESIGN'
              )
            : false;
        })
      : null;
  const activeFeaturedRequestForSelectedReady =
    selectedReadyForEdit?.id
      ? featuredRequests.find((request) => {
          const status = String(request.requestStatus || '').toUpperCase();
          if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') return false;
          return Array.isArray(request.productEntries)
            ? request.productEntries.some(
                (entry) =>
                  String(entry.productId || '') === String(selectedReadyForEdit.id) &&
                  String(entry.productType || '').toUpperCase() === 'READY_TO_WEAR'
              )
            : false;
        })
      : null;
  const isApprovedDesignEdit =
    Boolean(isEditMode && selectedDesign && String(selectedDesign.status || '').toUpperCase() === 'APPROVED');
  const designEditableFieldSet = new Set<string>(
    isApprovedDesignEdit
      ? Array.isArray(selectedDesign?.approvedEditableFields)
        ? selectedDesign.approvedEditableFields
        : []
      : [...ALL_DESIGN_EDITABLE_FIELDS]
  );
  const designLockedFieldKeys = isApprovedDesignEdit
    ? ALL_DESIGN_EDITABLE_FIELDS.filter((field) => !designEditableFieldSet.has(field))
    : [];
  const isApprovedDesignFieldLocked = (fieldKey: string) => isApprovedDesignEdit && !designEditableFieldSet.has(fieldKey);
  const isApprovedReadyEdit =
    Boolean(isReadyEditMode && selectedReadyForEdit && String(selectedReadyForEdit.status || '').toUpperCase() === 'APPROVED');
  const readyEditableFieldSet = new Set<string>(
    isApprovedReadyEdit
      ? Array.isArray(selectedReadyForEdit?.approvedEditableFields)
        ? selectedReadyForEdit.approvedEditableFields
        : []
      : [...ALL_READY_TO_WEAR_EDITABLE_FIELDS]
  );
  const readyLockedFieldKeys = isApprovedReadyEdit
    ? ALL_READY_TO_WEAR_EDITABLE_FIELDS.filter((field) => !readyEditableFieldSet.has(field))
    : [];
  const isApprovedReadyFieldLocked = (fieldKey: string) => isApprovedReadyEdit && !readyEditableFieldSet.has(fieldKey);
  const fabricOptionById = useMemo(() => {
    const map = new Map<string, FabricOption>();
    for (const option of Object.values(designFabricCache)) {
      map.set(option.id, option);
    }
    for (const option of fabricOptions) {
      map.set(option.id, option);
    }
    return map;
  }, [fabricOptions, designFabricCache]);
  const selectedDesignFabricRows = designForm.selectedFabricIds
    .map((fabricId) => fabricOptionById.get(fabricId))
    .filter(Boolean) as FabricOption[];
  const hasReachedSuitableFabricLimit = designForm.selectedFabricIds.length >= maxSuitableFabricsPerDesign;

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
        <div className="flex flex-wrap items-center gap-2">
          {canAddReadyProduct ? (
            <Button variant="outline" onClick={openCreateReadyModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Ready-To-Wear
            </Button>
          ) : null}
          {canAddDesignProduct ? (
            <Button onClick={openCreateDesignModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Design Product
            </Button>
          ) : null}
        </div>
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
                  Vendor application form is not configured yet. Admin must create Fashion Designer profile fields first.
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
              {tab === 'overview' ? 'Overview' : tab === 'designs' ? 'Products' : tab === 'featured' ? 'Featured' : tab === 'orders' ? 'Orders' : '3D TryON'}
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
          All designer dashboard tabs are disabled by admin governance.
        </div>
      ) : null}

      {activeTab === 'overview' && (
        <>
          {/* Order Status & Revenue Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Status */}
            {dashboardGovernance.sections.overviewOrderStatus !== false ? (
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
            ) : null}

            {/* Revenue Chart */}
            {dashboardGovernance.sections.overviewRevenueChart !== false ? (
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
            ) : null}
          </div>

          {/* Top Designs & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Designs */}
            {dashboardGovernance.sections.overviewTopDesigns !== false ? (
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
            ) : null}

            {/* Activity Feed */}
            {dashboardGovernance.sections.overviewActivity !== false ? (
              <ActivityFeed activities={activities} title="Recent Activity" />
            ) : null}
          </div>

          {/* Pending Orders Alert */}
          {dashboardGovernance.sections.overviewPendingOrdersAlert !== false && pendingOrders.length > 0 && (
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
          {dashboardGovernance.sections.overviewTryOnInsights !== false ? (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-5 w-5 text-purple-700" />
                <div>
                  <p className="font-medium text-purple-900">3D TryON Body Insights</p>
                  <p className="text-sm text-purple-800">
                    Total TryON runs linked to your products:{' '}
                    <span className="font-semibold">{Number(tryOnInsights?.totalTryOns || 0)}</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    {Object.entries(tryOnInsights?.measurementAverages || {})
                      .slice(0, 5)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ') || 'No measurement trends yet.'}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
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
                  <p className="font-medium text-purple-900">3D TryON Body Insights</p>
                  <p className="text-sm text-purple-800">
                    Total TryON runs linked to your products:{' '}
                    <span className="font-semibold">{Number(tryOnInsights?.totalTryOns || 0)}</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-700">
                    {Object.entries(tryOnInsights?.measurementAverages || {})
                      .slice(0, 8)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(' • ') || 'No measurement trends yet.'}
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
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Country</th>
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
                          <td className="px-4 py-3 text-sm text-gray-700">{String(row?.customerName || 'Customer')}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{String(row?.country || '—')}</td>
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

      {activeTab === 'designs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">My Products</h2>
            {canAddDesignProduct ? (
              <Button size="sm" onClick={openCreateDesignModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Product
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
              <option value="">All Styles</option>
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

          {dashboardGovernance.sections.productsTable !== false ? (
            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Product</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Price</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Style</th>
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
                    const readySizeSummary =
                      item.productType === 'READY_TO_WEAR'
                        ? (((item as ReadyProduct).sizeVariations || [])
                            .map((entry) => `${entry.size}/${String(entry.color || 'DEFAULT')}: ${Number(entry.stock || 0)}`)
                            .join(' • ') || 'No sizes')
                        : '';
                    return (
                      <tr key={`${item.productType}-${item.id}`} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <img src={item.images?.[0] || '/images/placeholder.jpg'} alt={item.name} className="h-10 w-10 rounded-lg object-cover" />
                            <div>
                              <p className="font-medium text-gray-900">{item.name}</p>
                              <p className="text-sm text-gray-500">{item.productType === 'READY_TO_WEAR' ? 'Ready To Wear' : 'Custom To Wear'}</p>
                              <p className="font-mono text-[11px] text-gray-400">ID: {item.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{item.productType}</Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{priceText}</td>
                        <td className="px-4 py-3 text-gray-600">
                          <p>{item.category?.name || 'Style'}</p>
                          {item.productType === 'READY_TO_WEAR' ? (
                            <p className="mt-1 text-xs text-gray-500">Size stock: {readySizeSummary}</p>
                          ) : null}
                        </td>
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
                            {item.productType !== 'READY_TO_WEAR' && canEditDesignProduct ? (
                              <button
                                onClick={() => openEditDesignModal(item as Design)}
                                className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                title="Edit product"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            ) : null}
                            {item.productType === 'READY_TO_WEAR' ? (
                              <>
                                {canEditReadyProduct ? (
                                  <button
                                    onClick={() => openEditReadyModal(item as ReadyProduct)}
                                    className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                                    title="Edit product"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                ) : null}
                                {canManageReadyStock ? (
                                  <button
                                    onClick={() => openReadyStockModal(item as ReadyProduct)}
                                    className="rounded-lg p-2 text-gray-500 hover:bg-amber-50 hover:text-amber-700"
                                    title="Manage size stock"
                                  >
                                    <Scissors className="h-4 w-4" />
                                  </button>
                                ) : null}
                              </>
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
          ) : (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Products table is disabled by admin governance.
            </div>
          )}
        </div>
      )}

      {activeTab === 'featured' && (
        <div className="space-y-6">
          <div className="rounded-xl border bg-white p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Featured Request Workflow</h2>
            <p className="text-sm text-gray-600">
              Create featured requests from each Design/Ready-to-Wear upload or edit popup. This page is now dedicated to request history and approvals.
            </p>
            <div className="text-xs text-gray-600">
              Base price (USD): Design ${Number(featuredSettings?.basePriceUsdByType?.DESIGN || 0).toFixed(2)} · Ready-to-Wear $
              {Number(featuredSettings?.basePriceUsdByType?.READY_TO_WEAR || 0).toFixed(2)}
            </div>
            {!featuredSettings?.enabled ? (
              <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800">
                Featured requests are currently disabled by admin.
              </div>
            ) : null}
            <div>
              <Button variant="outline" size="sm" onClick={() => syncTabWithUrl('designs')}>
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
          ) : (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-600">
              Featured table is disabled by admin governance.
            </div>
          )}
        </div>
      )}

      {showReadyStockModal && selectedReadyProduct && canManageReadyStock && dashboardGovernance.sections.readyStockModal !== false ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Manage Ready-To-Wear Size Stock</h3>
            <p className="mt-1 text-sm text-gray-500">{selectedReadyProduct.name}</p>

            <div className="mt-4 space-y-3">
              {readyStockDraft.map((row, index) => (
                <div key={`${row.size}-${index}`} className="grid grid-cols-[1fr_140px] items-center gap-3">
                  <div className="rounded-lg border bg-gray-50 px-3 py-2 text-sm font-medium text-gray-700">
                    {row.size} / {row.color === 'DEFAULT' ? 'Default' : row.color}
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={row.stock}
                    onChange={(event) =>
                      setReadyStockDraft((previous) =>
                        previous.map((entry, draftIndex) =>
                          draftIndex === index ? { ...entry, stock: event.target.value } : entry
                        )
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>

            {readyStockError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {readyStockError}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReadyStockModal(false);
                  setSelectedReadyProduct(null);
                  setReadyStockError(null);
                }}
                disabled={readyStockSaving}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveReadyStock} disabled={readyStockSaving}>
                {readyStockSaving ? 'Saving...' : 'Save Stock'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showReadyModal && (canAddReadyProduct || canEditReadyProduct) ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isReadyEditMode ? 'Update Ready-To-Wear Product' : 'Add Ready-To-Wear Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Configure variant rows by size, color, and quantity to manage stock accurately.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.readyName) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                <input
                  type="text"
                  value={readyForm.name}
                  onChange={(e) => setReadyForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. Ready-to-wear Kaftan"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.readyName) || isApprovedReadyFieldLocked('name')}
                />
              </div>

              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.readyDescription) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={readyForm.description}
                  onChange={(e) => setReadyForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[90px]"
                  placeholder="Describe fit, cut, fabric, and styling details."
                  disabled={isFieldReadOnly(dashboardGovernance.fields.readyDescription) || isApprovedReadyFieldLocked('description')}
                />
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.readyStyle) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                <select
                  value={readyForm.categoryId}
                  onChange={(e) => setReadyForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.readyStyle) || isApprovedReadyFieldLocked('categoryId')}
                >
                  {categories.length === 0 ? <option value="">No styles found</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.readyBasePrice) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price ({readyForm.priceCurrencyCode})</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={readyForm.basePrice}
                  onChange={(e) => setReadyForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.readyBasePrice) || isApprovedReadyFieldLocked('basePrice')}
                />
                <p className="mt-1 text-xs text-gray-500">Converted USD: ${readyUsdPricePreview.toFixed(2)}</p>
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.readyListingCurrency) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Currency</label>
                <select
                  value={readyForm.priceCurrencyCode}
                  onChange={(e) => setReadyForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={
                    isFieldReadOnly(dashboardGovernance.fields.readyListingCurrency) ||
                    (currencyOptions.allowedCurrencies || []).length <= 1 ||
                    isApprovedReadyFieldLocked('basePrice')
                  }
                >
                  {(currencyOptions.allowedCurrencies || [currencyOptions.defaultCurrency || 'USD']).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              {!isFieldHidden(dashboardGovernance.fields.readyImages) ? (
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Images (minimum 3, maximum 5)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={readyImageUrlInput}
                    onChange={(event) => setReadyImageUrlInput(event.target.value)}
                    placeholder="Paste image URL and add"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddReadyImageUrl}
                    disabled={isFieldReadOnly(dashboardGovernance.fields.readyImages) || isApprovedReadyFieldLocked('images')}
                  >
                    Add URL
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                    <Upload className="mr-2 h-4 w-4" />
                    {readyUploadingImage ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleReadyImageUpload}
                      disabled={
                        readyUploadingImage ||
                        isFieldReadOnly(dashboardGovernance.fields.readyImages) ||
                        isApprovedReadyFieldLocked('images')
                      }
                      multiple
                    />
                  </label>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {parseImageInputs(readyForm.imageUrls).length} image(s) selected
                </div>
                {parseImageInputs(readyForm.imageUrls).length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {parseImageInputs(readyForm.imageUrls).map((entry) => (
                      <div key={entry.url} className="relative overflow-hidden rounded border">
                        <img src={entry.url} alt="Ready-to-wear" className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveReadyImage(entry.url)}
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.readyImages) || isApprovedReadyFieldLocked('images')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              ) : null}

              {!isFieldHidden(dashboardGovernance.fields.readyVariants) ? (
                <div className="md:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Variant Rows (Size + Color + Quantity)</label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addReadyVariantRow}
                    disabled={isFieldReadOnly(dashboardGovernance.fields.readyVariants) || isApprovedReadyFieldLocked('sizes')}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Variant
                  </Button>
                </div>
                <div className="space-y-2">
                  {readyForm.variants.map((row, index) => (
                    <div key={`${index}-${row.size}-${row.color}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border p-3">
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Size</label>
                        <select
                          value={row.size}
                          onChange={(event) =>
                            setReadyForm((prev) => ({
                              ...prev,
                              variants: prev.variants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, size: event.target.value } : entry
                              ),
                            }))
                          }
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.readyVariants) || isApprovedReadyFieldLocked('sizes')}
                        >
                          {readySizeOptions.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Color</label>
                        <select
                          value={row.color}
                          onChange={(event) =>
                            setReadyForm((prev) => ({
                              ...prev,
                              variants: prev.variants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, color: event.target.value } : entry
                              ),
                            }))
                          }
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.readyVariants) || isApprovedReadyFieldLocked('sizes')}
                        >
                          {!READY_COLOR_OPTIONS.includes(String(row.color || '').toUpperCase()) && row.color ? (
                            <option value={row.color}>{String(row.color).toUpperCase()}</option>
                          ) : null}
                          {READY_COLOR_OPTIONS.map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Price</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.price}
                          onChange={(event) =>
                            setReadyForm((prev) => ({
                              ...prev,
                              variants: prev.variants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, price: event.target.value } : entry
                              ),
                            }))
                          }
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.readyVariants) || isApprovedReadyFieldLocked('sizes')}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Quantity</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.stock}
                          onChange={(event) =>
                            setReadyForm((prev) => ({
                              ...prev,
                              variants: prev.variants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, stock: event.target.value } : entry
                              ),
                            }))
                          }
                          className="w-full rounded-lg border px-3 py-2 text-sm"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.readyVariants) || isApprovedReadyFieldLocked('sizes')}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-end justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => removeReadyVariantRow(index)}
                          disabled={
                            readyForm.variants.length <= 1 ||
                            isFieldReadOnly(dashboardGovernance.fields.readyVariants) ||
                            isApprovedReadyFieldLocked('sizes')
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              ) : null}
            </div>

            {isApprovedReadyEdit ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Approved Product Edit Access</p>
                <p className="text-xs text-blue-800">
                  Editable fields: {Array.from(readyEditableFieldSet).join(', ') || 'None configured by admin'}.
                  {selectedReadyForEdit?.approvedEditAccessEndsAt
                    ? ` Extended access expires ${new Date(selectedReadyForEdit.approvedEditAccessEndsAt).toLocaleString()}.`
                    : ''}
                </p>
                {readyLockedFieldKeys.length > 0 ? (
                  <div className="rounded border border-blue-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-800">
                      Need changes to locked fields? Send request to admin.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {readyLockedFieldKeys.map((fieldKey) => (
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
                        onClick={() => handleSubmitProductChangeRequest('READY_TO_WEAR', selectedReadyForEdit?.id || '')}
                        disabled={submittingProductChangeRequest || !selectedReadyForEdit?.id}
                      >
                        {submittingProductChangeRequest ? 'Submitting...' : 'Submit Product Change Request'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isReadyEditMode && selectedReadyForEdit ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Featured Request</h4>
                <p className="text-xs text-gray-600">
                  Submit featured placement for this ready-to-wear product from this popup.
                </p>
                {String(selectedReadyForEdit.status || '').toUpperCase() !== 'APPROVED' ? (
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
                        onClick={() => handleSubmitFeaturedRequestForProduct(selectedReadyForEdit.id, 'READY_TO_WEAR')}
                        disabled={submittingFeaturedRequest || !canUploadByProfile}
                      >
                        {submittingFeaturedRequest ? 'Submitting...' : 'Submit Featured Request'}
                      </Button>
                      <span className="text-xs text-gray-600">
                        Base price: ${Number(featuredSettings?.basePriceUsdByType?.READY_TO_WEAR || 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {activeFeaturedRequestForSelectedReady ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Existing request status: {activeFeaturedRequestForSelectedReady.requestStatus}
                    {activeFeaturedRequestForSelectedReady.requestStatus === 'APPROVED_AWAITING_PAYMENT' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleCreateFeaturedPaymentSession(activeFeaturedRequestForSelectedReady.id)}
                          disabled={!canUploadByProfile || featuredPaymentActionRequestId === activeFeaturedRequestForSelectedReady.id}
                        >
                          {featuredPaymentActionRequestId === activeFeaturedRequestForSelectedReady.id
                            ? 'Processing...'
                            : 'Open Payment'}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => handleVerifyFeaturedPayment(activeFeaturedRequestForSelectedReady.id)}
                          disabled={
                            !canUploadByProfile ||
                            featuredPaymentActionRequestId === activeFeaturedRequestForSelectedReady.id ||
                            !getFeaturedPaymentDraft(activeFeaturedRequestForSelectedReady).reference
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

            {readyError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {readyError}
              </div>
            ) : null}
            {readySuccess ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                {readySuccess}
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowReadyModal(false);
                  resetReadyForm();
                }}
                disabled={isSavingReady}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveReadyToWear} disabled={isSavingReady}>
                {isSavingReady ? 'Saving...' : isReadyEditMode ? 'Update Ready-To-Wear Product' : 'Submit Ready-To-Wear Product'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showDesignModal && (canAddDesignProduct || canEditDesignProduct) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-3xl rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {isEditMode ? 'Update Design Product' : 'Add Design Product'}
            </h3>
            <p className="text-sm text-gray-500 mb-5">
              Custom-to-wear designs require 4 to 6 images and at least one suitable fabric.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.designName) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Design Name</label>
                <input
                  type="text"
                  value={designForm.name}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="e.g. Royal Kente Evening Gown"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.designName) || isApprovedDesignFieldLocked('name')}
                />
              </div>

              <div className={`md:col-span-2 ${isFieldHidden(dashboardGovernance.fields.designDescription) ? 'hidden' : ''}`}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={designForm.description}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg min-h-[90px]"
                  placeholder="Describe style, fit, silhouette, and special details."
                  disabled={isFieldReadOnly(dashboardGovernance.fields.designDescription) || isApprovedDesignFieldLocked('description')}
                />
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.designStyle) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Style</label>
                <select
                  value={designForm.categoryId}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={isFieldReadOnly(dashboardGovernance.fields.designStyle) || isApprovedDesignFieldLocked('categoryId')}
                >
                  {categories.length === 0 ? <option value="">No styles found</option> : null}
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.designBasePrice) ? 'hidden' : ''}>
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
                  disabled={isFieldReadOnly(dashboardGovernance.fields.designBasePrice) || isApprovedDesignFieldLocked('basePrice')}
                />
                <p className="mt-1 text-xs text-gray-500">Converted USD: ${usdPricePreview.toFixed(2)}</p>
              </div>

              <div className={isFieldHidden(dashboardGovernance.fields.designListingCurrency) ? 'hidden' : ''}>
                <label className="block text-sm font-medium text-gray-700 mb-1">Listing Currency</label>
                <select
                  value={designForm.priceCurrencyCode}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, priceCurrencyCode: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                  disabled={
                    isFieldReadOnly(dashboardGovernance.fields.designListingCurrency) ||
                    (currencyOptions.allowedCurrencies || []).length <= 1 ||
                    isApprovedDesignFieldLocked('basePrice')
                  }
                >
                  {(currencyOptions.allowedCurrencies || [currencyOptions.defaultCurrency || 'USD']).map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>

              {!isFieldHidden(dashboardGovernance.fields.designImages) ? (
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Images (minimum 4, maximum 6)</label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={designImageUrlInput}
                    onChange={(event) => setDesignImageUrlInput(event.target.value)}
                    placeholder="Paste image URL and add"
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddDesignImageUrl}
                    disabled={isFieldReadOnly(dashboardGovernance.fields.designImages) || isApprovedDesignFieldLocked('images')}
                  >
                    Add URL
                  </Button>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                    <Upload className="mr-2 h-4 w-4" />
                    {designUploadingImage ? 'Uploading...' : 'Upload'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleDesignImageUpload}
                      disabled={
                        designUploadingImage ||
                        isFieldReadOnly(dashboardGovernance.fields.designImages) ||
                        isApprovedDesignFieldLocked('images')
                      }
                      multiple
                    />
                  </label>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {parseImageInputs(designForm.imageUrls).length} image(s) selected
                </div>
                {parseImageInputs(designForm.imageUrls).length > 0 ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
                    {parseImageInputs(designForm.imageUrls).map((entry) => (
                      <div key={entry.url} className="relative overflow-hidden rounded border">
                        <img src={entry.url} alt="Design" className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveDesignImage(entry.url)}
                          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white"
                          disabled={isFieldReadOnly(dashboardGovernance.fields.designImages) || isApprovedDesignFieldLocked('images')}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                </div>
              ) : null}

              {!isFieldHidden(dashboardGovernance.fields.designSuitableFabrics) ? (
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Suitable Fabrics (country → material → fabric name)
                </label>
                <div className="rounded-lg border p-3 space-y-3">
                  {dashboardGovernance.sections.fabricCountryAccess !== false ? (
                    <div className="rounded border border-amber-100 bg-amber-50 p-3">
                      <p className="text-xs text-amber-900">
                        Home country: <span className="font-semibold">{fabricAccessHomeCountry || 'Not set'}</span>
                      </p>
                      <p className="mt-1 text-xs text-amber-800">
                        Allowed countries: {fabricAccessAllowedCountries.join(', ') || 'None'}
                      </p>
                      {fabricAccessMessage ? (
                        <p className="mt-1 text-xs text-amber-900">{fabricAccessMessage}</p>
                      ) : null}
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
                        <select
                          multiple
                          value={fabricAccessRequestCountries}
                          onChange={(event) =>
                            setFabricAccessRequestCountries(
                              Array.from(event.target.selectedOptions).map((option) => option.value)
                            )
                          }
                          className="h-20 w-full rounded border px-2 py-1 text-xs"
                          disabled={
                            fabricAccessLoading ||
                            !canRequestFabricCountryAccess ||
                            isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) ||
                            isApprovedDesignFieldLocked('suitableFabricIds')
                          }
                        >
                          {fabricAccessAvailableCountries
                            .filter((country) => !fabricAccessAllowedCountries.includes(country))
                            .map((country) => (
                              <option key={`request-${country}`} value={country}>
                                {country}
                              </option>
                            ))}
                        </select>
                        <input
                          type="text"
                          value={fabricAccessRequestReason}
                          onChange={(event) => setFabricAccessRequestReason(event.target.value)}
                          placeholder="Reason (optional)"
                          className="rounded border px-2 py-1 text-xs"
                          disabled={
                            !canRequestFabricCountryAccess ||
                            isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) ||
                            isApprovedDesignFieldLocked('suitableFabricIds')
                          }
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={submitFabricCountryAccessRequest}
                          disabled={
                            fabricAccessSubmitting ||
                            fabricAccessLoading ||
                            !canRequestFabricCountryAccess ||
                            isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) ||
                            isApprovedDesignFieldLocked('suitableFabricIds')
                          }
                        >
                          {fabricAccessSubmitting ? 'Submitting...' : 'Request Access'}
                        </Button>
                      </div>
                      {fabricAccessRequests.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {fabricAccessRequests.slice(0, 3).map((request) => (
                            <p key={request.id} className="text-[11px] text-amber-900">
                              {request.status}: {request.requestedCountries.join(', ')}
                              {request.reviewNotes ? ` (${request.reviewNotes})` : ''}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Fabric Seller Country</label>
                      <select
                        value={designFabricCountryFilter}
                        onChange={(event) => {
                          setDesignFabricCountryFilter(event.target.value);
                          setDesignFabricMaterialFilter('');
                        }}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                      >
                        <option value="">All allowed countries</option>
                        {fabricCountryOptions.map((country) => (
                          <option key={country} value={country}>
                            {country}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Material Type</label>
                      <select
                        value={designFabricMaterialFilter}
                        onChange={(event) => setDesignFabricMaterialFilter(event.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                      >
                        <option value="">All materials</option>
                        {fabricMaterialOptions.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Search Fabric</label>
                      <input
                        type="text"
                        value={designFabricSearch}
                        onChange={(event) => setDesignFabricSearch(event.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm"
                        placeholder="Search by fabric name"
                        disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={designSelectedFabricOptionId}
                      onChange={(event) => setDesignSelectedFabricOptionId(event.target.value)}
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                      disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                    >
                      <option value="">
                        {designFabricOptionsLoading
                          ? 'Loading fabrics...'
                          : fabricOptions.length > 0
                            ? 'Select fabric name'
                            : 'No fabrics found for selected filters'}
                      </option>
                      {fabricOptions.map((fabric) => (
                        <option key={fabric.id} value={fabric.id}>
                          {fabric.name} • {fabric.materialTypeName} • {fabric.sellerCountry}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={addSelectedFabricFromDropdown}
                      disabled={
                        isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) ||
                        isApprovedDesignFieldLocked('suitableFabricIds') ||
                        hasReachedSuitableFabricLimit
                      }
                    >
                      Add Fabric
                    </Button>
                  </div>
                  <p className="text-xs text-gray-600">
                    Selected: {designForm.selectedFabricIds.length}/{maxSuitableFabricsPerDesign} suitable fabrics.
                  </p>

                  <div className="space-y-2">
                    {selectedDesignFabricRows.length === 0 ? (
                      <p className="text-sm text-gray-500">No suitable fabrics selected yet.</p>
                    ) : (
                      selectedDesignFabricRows.map((fabric) => (
                        <div key={fabric.id} className="grid grid-cols-1 items-center gap-2 rounded border p-2 md:grid-cols-[1fr_120px_96px]">
                          <div className="text-sm text-gray-800">
                            <p className="font-medium">{fabric.name}</p>
                            <p className="text-xs text-gray-500">
                              {fabric.materialTypeName} • {fabric.sellerCountry}
                            </p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={designForm.yardsByFabricId[fabric.id] || '1'}
                            onChange={(event) =>
                              setDesignForm((prev) => ({
                                ...prev,
                                yardsByFabricId: { ...prev.yardsByFabricId, [fabric.id]: event.target.value },
                              }))
                            }
                            className="rounded border px-2 py-1 text-sm"
                            disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => removeSelectedFabric(fabric.id)}
                            disabled={isFieldReadOnly(dashboardGovernance.fields.designSuitableFabrics) || isApprovedDesignFieldLocked('suitableFabricIds')}
                          >
                            Remove
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
                </div>
              ) : null}

              {!isFieldHidden(dashboardGovernance.fields.designMeasurementVariables) ? (
                <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Required Measurements (admin-defined templates)
                </label>
                <p className="mb-2 text-xs text-gray-500">
                  Select the measurements required for this design. Customers must complete selected fields on the product detail page.
                </p>
                <div className="max-h-44 overflow-y-auto rounded-lg border p-3 space-y-2">
                  {measurementTemplateOptions.length === 0 ? (
                    <p className="text-sm text-gray-500">No measurement templates found.</p>
                  ) : (
                    measurementTemplateOptions.map((template) => {
                      const checked = designForm.selectedMeasurementNames.includes(template.name);
                      return (
                        <label key={template.name} className="flex items-start gap-3 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) =>
                              setDesignForm((prev) => {
                                const next = event.target.checked
                                  ? [...prev.selectedMeasurementNames, template.name]
                                  : prev.selectedMeasurementNames.filter((name) => name !== template.name);
                                return { ...prev, selectedMeasurementNames: Array.from(new Set(next)) };
                              })
                            }
                            disabled={
                              isFieldReadOnly(dashboardGovernance.fields.designMeasurementVariables) ||
                              isApprovedDesignFieldLocked('measurementVariables')
                            }
                          />
                          <span>
                            <span className="font-medium">{template.name}</span> ({template.unit})
                            <span className="ml-1 text-amber-700">required when selected</span>
                            {template.instructions ? (
                              <span className="block text-xs text-gray-500">{template.instructions}</span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
                </div>
              ) : null}
            </div>

            {isApprovedDesignEdit ? (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Approved Product Edit Access</p>
                <p className="text-xs text-blue-800">
                  Editable fields: {Array.from(designEditableFieldSet).join(', ') || 'None configured by admin'}.
                  {selectedDesign?.approvedEditAccessEndsAt
                    ? ` Extended access expires ${new Date(selectedDesign.approvedEditAccessEndsAt).toLocaleString()}.`
                    : ''}
                </p>
                {designLockedFieldKeys.length > 0 ? (
                  <div className="rounded border border-blue-200 bg-white p-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-800">
                      Need changes to locked fields? Send request to admin.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {designLockedFieldKeys.map((fieldKey) => (
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
                        onClick={() => handleSubmitProductChangeRequest('DESIGN', selectedDesign?.id || '')}
                        disabled={submittingProductChangeRequest || !selectedDesign?.id}
                      >
                        {submittingProductChangeRequest ? 'Submitting...' : 'Submit Product Change Request'}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isEditMode && selectedDesign ? (
              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">Featured Request</h4>
                <p className="text-xs text-gray-600">
                  Submit featured placement for this custom design from this popup.
                </p>
                {String(selectedDesign.status || '').toUpperCase() !== 'APPROVED' ? (
                  <div className="rounded border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                    This design is not approved yet. Featured requests are available only after admin approval.
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
                        onClick={() => handleSubmitFeaturedRequestForProduct(selectedDesign.id, 'DESIGN')}
                        disabled={submittingFeaturedRequest || !canUploadByProfile}
                      >
                        {submittingFeaturedRequest ? 'Submitting...' : 'Submit Featured Request'}
                      </Button>
                      <span className="text-xs text-gray-600">
                        Base price: ${Number(featuredSettings?.basePriceUsdByType?.DESIGN || 0).toFixed(2)}
                      </span>
                    </div>
                  </>
                )}
                {activeFeaturedRequestForSelectedDesign ? (
                  <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
                    Existing request status: {activeFeaturedRequestForSelectedDesign.requestStatus}
                    {activeFeaturedRequestForSelectedDesign.requestStatus === 'APPROVED_AWAITING_PAYMENT' ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => handleCreateFeaturedPaymentSession(activeFeaturedRequestForSelectedDesign.id)}
                          disabled={!canUploadByProfile || featuredPaymentActionRequestId === activeFeaturedRequestForSelectedDesign.id}
                        >
                          {featuredPaymentActionRequestId === activeFeaturedRequestForSelectedDesign.id
                            ? 'Processing...'
                            : 'Open Payment'}
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          variant="outline"
                          onClick={() => handleVerifyFeaturedPayment(activeFeaturedRequestForSelectedDesign.id)}
                          disabled={
                            !canUploadByProfile ||
                            featuredPaymentActionRequestId === activeFeaturedRequestForSelectedDesign.id ||
                            !getFeaturedPaymentDraft(activeFeaturedRequestForSelectedDesign).reference
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

            {designError ? (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {designError}
              </div>
            ) : null}
            {designSuccess ? (
              <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {designSuccess}
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
        dashboardGovernance.sections.ordersTable !== false ? (
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
                  item.status === 'COMPLETED' || item.status === 'PRODUCTION_COMPLETE' ? 'green' :
                  item.status === 'IN_PRODUCTION' ? 'purple' :
                  item.status === 'PAYMENT_CONFIRMED' || item.status === 'PENDING' ? 'yellow' : 'gray'
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
              {canUpdateOrderStatus &&
                ['PENDING', 'CONFIRMED', 'PAYMENT_CONFIRMED', 'FABRIC_CONFIRMED', 'FABRIC_RECEIVED'].includes(
                  String(item.status || '').toUpperCase()
                ) && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'IN_PRODUCTION')}
                >
                  Start
                </Button>
              )}
              {canUpdateOrderStatus && item.status === 'IN_PRODUCTION' && (
                <Button 
                  size="sm"
                  onClick={() => handleUpdateOrderStatus(item.orderId, 'COMPLETED')}
                >
                  Complete
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSupportInitialTab('ticket');
                  setSupportOrderId(item.orderId);
                }}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                Contact
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSupportInitialTab('details');
                  setSupportOrderId(item.orderId);
                }}
              >
                <Eye className="w-4 h-4" />
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
      <OrderSupportModal
        isOpen={Boolean(supportOrderId)}
        orderId={supportOrderId}
        initialTab={supportInitialTab}
        onClose={() => setSupportOrderId(null)}
      />
    </div>
  );
}
