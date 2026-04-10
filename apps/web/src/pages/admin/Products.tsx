import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Plus, Edit, Upload, Star, CheckCircle, XCircle } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { getCountryOptions } from '../../data/locationOptions';

type ModerationAction = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'SUSPEND' | 'PUBLISH' | 'UNPUBLISH';

interface Product {
  id: string;
  type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  name: string;
  description: string;
  status: string;
  isAvailable: boolean;
  finalPrice: number;
  sellerId?: string;
  designerId?: string;
  ownerName: string;
  ownerCountry?: string | null;
  categoryId?: string | null;
  category: string;
  materialTypeId?: string | null;
  materialTypeName?: string | null;
  fabricCategoryId?: string | null;
  fabricCategoryName?: string | null;
  orderCount: number;
  image?: string | null;
  images?: string[];
  sizeVariations?: Array<{ id?: string; size: string; color?: string; variantKey?: string; price: number; stock: number }>;
  measurements?: Array<{ name: string; unit?: string; isRequired?: boolean; description?: string }>;
  suitableFabrics?: Array<{
    id?: string;
    minMeters?: number;
    maxMeters?: number;
    yardsNeeded?: number;
    fabric?: {
      id: string;
      name: string;
      images?: string[];
      seller?: { businessName?: string; country?: string };
    };
  }>;
  requiredFabricYards?: number;
  predominantColor?: string | null;
  hasAdditionalMaterialOrFabric?: boolean;
  isFeatured?: boolean;
  featuredSections?: string[];
  aiAutomationApprovedTag?: boolean;
  createdAt: string;
}

interface CurrencyMatrixRow {
  countryCode: string;
  country: string;
  currencyCode: string;
  currencyName: string;
  usdPerUnit: number;
}

interface ReadyVariantRow {
  size: string;
  color: string;
  price: number;
  stock: number;
}

interface DesignerFabricCountryAccessRow {
  designerProfileId: string;
  designerUserId: string;
  businessName: string;
  email: string;
  homeCountry: string;
  extraCountries: string[];
  allowedCountries: string[];
}

interface DesignerFabricCountryAccessRequestRow {
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
}

type ProductViewPageType = 'READY_TO_WEAR' | 'FABRIC_TO_BUY' | 'CUSTOM_TO_WEAR';
type ProductCardFieldKey = 'DESIGNER_NAME' | 'PRODUCT_NAME' | 'SHORT_DESCRIPTION' | 'PRICE';
type DetailTabKey = 'DETAILS' | 'SPECS' | 'REVIEWS';
type ProductConfigurationSubview = 'PRODUCT_CARDS' | 'DETAILED_PRODUCT_VIEW';

type ProductCardManagerSettings = {
  imageEnabled: boolean;
  fieldOrder: ProductCardFieldKey[];
  imageAspectRatio: '3:4' | '1:1';
  textGap: number;
  contentPaddingX: number;
  contentPaddingY: number;
  designerNameEnabled: boolean;
  designerNameFontSize: number;
  designerNameColor: string;
  productNameEnabled: boolean;
  productNameFontSize: number;
  productNameColor: string;
  shortDescriptionEnabled: boolean;
  shortDescriptionFontSize: number;
  shortDescriptionColor: string;
  shortDescriptionWordLimit: number;
  priceEnabled: boolean;
  priceFontSize: number;
  priceColor: string;
  labelEnabled: boolean;
  labelFontSize: number;
  labelTextColor: string;
  labelBackgroundColor: string;
  likesEnabled: boolean;
  likesSize: number;
  likesColor: string;
  likesActiveColor: string;
  countryIconEnabled: boolean;
  countryIconSize: number;
};

type DetailViewManagerSettings = {
  titleFontSize: number;
  titleColor: string;
  ownerFontSize: number;
  ownerColor: string;
  priceLabelColor: string;
  priceValueFontSize: number;
  priceValueColor: string;
  descriptionFontSize: number;
  descriptionColor: string;
  specLabelColor: string;
  specValueColor: string;
  tabOrder: DetailTabKey[];
  defaultTab: DetailTabKey;
  reviewsEnabled: boolean;
  discoverEnabled: boolean;
  likesEnabled: boolean;
};

type ProductViewManagerSettings = {
  productCard: ProductCardManagerSettings;
  detailView: DetailViewManagerSettings;
};

const PRODUCT_VIEW_PAGE_TABS: Array<{ key: ProductViewPageType; label: string; hint: string }> = [
  { key: 'READY_TO_WEAR', label: 'RTW', hint: 'Ready To Wear product card/detail settings' },
  { key: 'FABRIC_TO_BUY', label: 'FTB', hint: 'Fabrics To Buy product card/detail settings' },
  { key: 'CUSTOM_TO_WEAR', label: 'CTW', hint: 'Custom To Wear product card/detail settings' },
];

const PRODUCT_CONFIGURATION_SUBMENU: Array<{
  key: ProductConfigurationSubview;
  label: string;
  href: string;
  hint: string;
}> = [
  {
    key: 'PRODUCT_CARDS',
    label: 'Product Cards',
    href: '/admin/products/configuration/product-cards',
    hint: 'Manage minimal product card fields and overlays',
  },
  {
    key: 'DETAILED_PRODUCT_VIEW',
    label: 'Detailed Product View',
    href: '/admin/products/configuration/detailed-product-view',
    hint: 'Manage full product detail page typography and visibility',
  },
];

const PRODUCT_CARD_FIELDS: Array<{ key: ProductCardFieldKey; label: string }> = [
  { key: 'DESIGNER_NAME', label: 'Designer Name' },
  { key: 'PRODUCT_NAME', label: 'Product Name' },
  { key: 'SHORT_DESCRIPTION', label: 'Short Description' },
  { key: 'PRICE', label: 'Price' },
];

const DETAIL_TABS: DetailTabKey[] = ['DETAILS', 'SPECS', 'REVIEWS'];

const DEFAULT_PRODUCT_CARD_MANAGER_SETTINGS: ProductCardManagerSettings = {
  imageEnabled: true,
  fieldOrder: ['DESIGNER_NAME', 'PRODUCT_NAME', 'SHORT_DESCRIPTION', 'PRICE'],
  imageAspectRatio: '3:4',
  textGap: 6,
  contentPaddingX: 16,
  contentPaddingY: 16,
  designerNameEnabled: true,
  designerNameFontSize: 14,
  designerNameColor: '#6b7280',
  productNameEnabled: true,
  productNameFontSize: 16,
  productNameColor: '#111827',
  shortDescriptionEnabled: true,
  shortDescriptionFontSize: 13,
  shortDescriptionColor: '#4b5563',
  shortDescriptionWordLimit: 10,
  priceEnabled: true,
  priceFontSize: 14,
  priceColor: '#e66045',
  labelEnabled: true,
  labelFontSize: 11,
  labelTextColor: '#ffffff',
  labelBackgroundColor: 'rgba(17, 17, 17, 0.75)',
  likesEnabled: true,
  likesSize: 18,
  likesColor: '#ffffff',
  likesActiveColor: '#ef4444',
  countryIconEnabled: true,
  countryIconSize: 24,
};

const DEFAULT_DETAIL_VIEW_MANAGER_SETTINGS: DetailViewManagerSettings = {
  titleFontSize: 64,
  titleColor: '#1A1A1A',
  ownerFontSize: 16,
  ownerColor: '#6B6B6B',
  priceLabelColor: '#6B6B6B',
  priceValueFontSize: 36,
  priceValueColor: '#E85A3C',
  descriptionFontSize: 14,
  descriptionColor: '#2f2d29',
  specLabelColor: '#6B6B6B',
  specValueColor: '#1A1A1A',
  tabOrder: ['DETAILS', 'SPECS', 'REVIEWS'],
  defaultTab: 'DETAILS',
  reviewsEnabled: true,
  discoverEnabled: true,
  likesEnabled: true,
};

const DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS: ProductViewManagerSettings = {
  productCard: { ...DEFAULT_PRODUCT_CARD_MANAGER_SETTINGS },
  detailView: { ...DEFAULT_DETAIL_VIEW_MANAGER_SETTINGS },
};

const cloneDefaultProductViewManagerSettings = (): ProductViewManagerSettings => ({
  productCard: { ...DEFAULT_PRODUCT_CARD_MANAGER_SETTINGS },
  detailView: { ...DEFAULT_DETAIL_VIEW_MANAGER_SETTINGS },
});

const createInitialProductViewSettingsByType = (): Record<ProductViewPageType, ProductViewManagerSettings> => ({
  READY_TO_WEAR: cloneDefaultProductViewManagerSettings(),
  FABRIC_TO_BUY: cloneDefaultProductViewManagerSettings(),
  CUSTOM_TO_WEAR: cloneDefaultProductViewManagerSettings(),
});

const clamp = (value: unknown, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
};

const normalizeCardFieldOrder = (value: unknown): ProductCardFieldKey[] => {
  const source = Array.isArray(value)
    ? value.map((entry) => String(typeof entry === 'string' ? entry : (entry as any)?.key || '').trim().toUpperCase())
    : [];
  const next: ProductCardFieldKey[] = [];
  source.forEach((entry) => {
    if (!PRODUCT_CARD_FIELDS.some((row) => row.key === entry)) return;
    if (!next.includes(entry as ProductCardFieldKey)) next.push(entry as ProductCardFieldKey);
  });
  PRODUCT_CARD_FIELDS.forEach((row) => {
    if (!next.includes(row.key)) next.push(row.key);
  });
  return next;
};

const normalizeDetailTabOrder = (value: unknown): DetailTabKey[] => {
  const source = Array.isArray(value) ? value.map((entry) => String(entry || '').trim().toUpperCase()) : [];
  const next: DetailTabKey[] = [];
  source.forEach((entry) => {
    if (!DETAIL_TABS.includes(entry as DetailTabKey)) return;
    if (!next.includes(entry as DetailTabKey)) next.push(entry as DetailTabKey);
  });
  DETAIL_TABS.forEach((tab) => {
    if (!next.includes(tab)) next.push(tab);
  });
  return next;
};

const normalizeProductViewManagerSettings = (raw: any): ProductViewManagerSettings => {
  const productCardRaw = raw?.productCard || {};
  const detailRaw = raw?.detailView || {};
  const tabOrder = normalizeDetailTabOrder(detailRaw?.tabOrder);
  const defaultTabRaw = String(detailRaw?.defaultTab || '').trim().toUpperCase() as DetailTabKey;
  return {
    productCard: {
      imageEnabled: productCardRaw?.imageEnabled !== false,
      fieldOrder: normalizeCardFieldOrder(productCardRaw?.fieldOrder),
      imageAspectRatio: String(productCardRaw?.imageAspectRatio || '3:4') === '1:1' ? '1:1' : '3:4',
      textGap: clamp(productCardRaw?.textGap, 6, 0, 24),
      contentPaddingX: clamp(productCardRaw?.contentPaddingX, 16, 0, 40),
      contentPaddingY: clamp(productCardRaw?.contentPaddingY, 16, 0, 40),
      designerNameEnabled: productCardRaw?.designerNameEnabled !== false,
      designerNameFontSize: clamp(productCardRaw?.designerNameFontSize, 14, 8, 72),
      designerNameColor: String(productCardRaw?.designerNameColor || '#6b7280'),
      productNameEnabled: productCardRaw?.productNameEnabled !== false,
      productNameFontSize: clamp(productCardRaw?.productNameFontSize, 16, 8, 72),
      productNameColor: String(productCardRaw?.productNameColor || '#111827'),
      shortDescriptionEnabled: productCardRaw?.shortDescriptionEnabled !== false,
      shortDescriptionFontSize: clamp(productCardRaw?.shortDescriptionFontSize, 13, 8, 72),
      shortDescriptionColor: String(productCardRaw?.shortDescriptionColor || '#4b5563'),
      shortDescriptionWordLimit: clamp(productCardRaw?.shortDescriptionWordLimit, 10, 4, 24),
      priceEnabled: productCardRaw?.priceEnabled !== false,
      priceFontSize: clamp(productCardRaw?.priceFontSize, 14, 8, 72),
      priceColor: String(productCardRaw?.priceColor || '#e66045'),
      labelEnabled: productCardRaw?.labelEnabled !== false,
      labelFontSize: clamp(productCardRaw?.labelFontSize, 11, 8, 72),
      labelTextColor: String(productCardRaw?.labelTextColor || '#ffffff'),
      labelBackgroundColor: String(productCardRaw?.labelBackgroundColor || 'rgba(17, 17, 17, 0.75)'),
      likesEnabled: productCardRaw?.likesEnabled !== false,
      likesSize: clamp(productCardRaw?.likesSize, 18, 8, 72),
      likesColor: String(productCardRaw?.likesColor || '#ffffff'),
      likesActiveColor: String(productCardRaw?.likesActiveColor || '#ef4444'),
      countryIconEnabled: productCardRaw?.countryIconEnabled !== false,
      countryIconSize: clamp(productCardRaw?.countryIconSize, 24, 8, 96),
    },
    detailView: {
      titleFontSize: clamp(detailRaw?.titleFontSize, 64, 18, 96),
      titleColor: String(detailRaw?.titleColor || '#1A1A1A'),
      ownerFontSize: clamp(detailRaw?.ownerFontSize, 16, 10, 42),
      ownerColor: String(detailRaw?.ownerColor || '#6B6B6B'),
      priceLabelColor: String(detailRaw?.priceLabelColor || '#6B6B6B'),
      priceValueFontSize: clamp(detailRaw?.priceValueFontSize, 36, 18, 96),
      priceValueColor: String(detailRaw?.priceValueColor || '#E85A3C'),
      descriptionFontSize: clamp(detailRaw?.descriptionFontSize, 14, 12, 36),
      descriptionColor: String(detailRaw?.descriptionColor || '#2f2d29'),
      specLabelColor: String(detailRaw?.specLabelColor || '#6B6B6B'),
      specValueColor: String(detailRaw?.specValueColor || '#1A1A1A'),
      tabOrder,
      defaultTab: tabOrder.includes(defaultTabRaw) ? defaultTabRaw : tabOrder[0],
      reviewsEnabled: detailRaw?.reviewsEnabled !== false,
      discoverEnabled: detailRaw?.discoverEnabled !== false,
      likesEnabled: detailRaw?.likesEnabled !== false,
    },
  };
};

const STATIC_COUNTRIES = getCountryOptions().map((entry) => String(entry.name || '').trim()).filter(Boolean);
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
const normalizeImageUrlList = (input: unknown): string[] =>
  (Array.isArray(input) ? input : [])
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      if (entry && typeof entry === 'object') return String((entry as any).url || '');
      return '';
    })
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);

export default function AdminProducts() {
  const location = useLocation();
  const isConfigurationView = location.pathname.startsWith('/admin/products/configuration');
  const activeProductConfigurationSubview: ProductConfigurationSubview = location.pathname.includes(
    '/admin/products/configuration/detailed-product-view'
  )
    ? 'DETAILED_PRODUCT_VIEW'
    : 'PRODUCT_CARDS';
  const [products, setProducts] = useState<Product[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(40);
  const [totalProducts, setTotalProducts] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [materialFilter, setMaterialFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fabrics' | 'designs' | 'ready-to-wear'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [readyVariantsDirty, setReadyVariantsDirty] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<ModerationAction>('REQUEST_CHANGES');
  const [imagesDirty, setImagesDirty] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [currencyMatrix, setCurrencyMatrix] = useState<CurrencyMatrixRow[]>([]);
  const [taxonomySaving, setTaxonomySaving] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newMaterialName, setNewMaterialName] = useState('');
  const [newFabricCategoryName, setNewFabricCategoryName] = useState('');
  const [options, setOptions] = useState<{
    categories: Array<{ id: string; name: string }>;
    materials: Array<{ id: string; name: string }>;
    fabricCategories: Array<{ id: string; name: string }>;
    sellers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string }>;
    designers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string }>;
  }>({ categories: [], materials: [], fabricCategories: [], sellers: [], designers: [] });
  const [designerFabricAccessRows, setDesignerFabricAccessRows] = useState<DesignerFabricCountryAccessRow[]>([]);
  const [designerFabricAccessCountries, setDesignerFabricAccessCountries] = useState<string[]>([]);
  const [designerFabricAccessDrafts, setDesignerFabricAccessDrafts] = useState<Record<string, string[]>>({});
  const [designerFabricAccessLoading, setDesignerFabricAccessLoading] = useState(false);
  const [designerFabricAccessSavingUserId, setDesignerFabricAccessSavingUserId] = useState<string | null>(null);
  const [designerFabricAccessMessage, setDesignerFabricAccessMessage] = useState('');
  const [designerFabricAccessRequests, setDesignerFabricAccessRequests] = useState<DesignerFabricCountryAccessRequestRow[]>([]);
  const [designerFabricAccessRequestsLoading, setDesignerFabricAccessRequestsLoading] = useState(false);
  const [designerFabricAccessReviewingRequestId, setDesignerFabricAccessReviewingRequestId] = useState<string | null>(null);
  const [designerFabricAccessRequestStatusFilter, setDesignerFabricAccessRequestStatusFilter] = useState<
    'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  >('ALL');
  const [designerFabricAccessRequestSearch, setDesignerFabricAccessRequestSearch] = useState('');
  const [designerFabricAccessRequestPage, setDesignerFabricAccessRequestPage] = useState(1);
  const [designerFabricAccessRequestLimit] = useState(20);
  const [designerFabricAccessRequestTotalPages, setDesignerFabricAccessRequestTotalPages] = useState(1);
  const [designerFabricAccessRequestTotal, setDesignerFabricAccessRequestTotal] = useState(0);
  const [activeProductViewPage, setActiveProductViewPage] = useState<ProductViewPageType>('READY_TO_WEAR');
  const [productViewSettingsByType, setProductViewSettingsByType] = useState<
    Record<ProductViewPageType, ProductViewManagerSettings>
  >({
    READY_TO_WEAR: normalizeProductViewManagerSettings(DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS),
    FABRIC_TO_BUY: normalizeProductViewManagerSettings(DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS),
    CUSTOM_TO_WEAR: normalizeProductViewManagerSettings(DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS),
  });
  const [productViewLoading, setProductViewLoading] = useState(false);
  const [productViewSaving, setProductViewSaving] = useState(false);
  const [productViewMessage, setProductViewMessage] = useState('');
  const [productViewMessageType, setProductViewMessageType] = useState<'success' | 'error'>('success');
  const [minReadyVariantStock, setMinReadyVariantStock] = useState(2);
  const [form, setForm] = useState({
    type: 'FABRIC' as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    name: '',
    description: '',
    price: 0,
    materialTypeId: '',
    fabricCategoryId: '',
    categoryId: '',
    sellerId: '',
    designerId: '',
    status: 'DRAFT',
    isAvailable: false,
    publishNow: false,
    isFeatured: false,
    featuredSection: 'FEATURED_DESIGNS',
    images: [] as string[],
    minYards: 1,
    stockYards: 0,
    stock: 2,
    size: 'M',
    readyVariants: [{ size: 'M', color: 'DEFAULT', price: 0, stock: 2 }] as ReadyVariantRow[],
    hasAdditionalMaterialOrFabric: false,
  });

  const getDefaultFeaturedSection = (type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') => {
    if (type === 'FABRIC') return 'FEATURED_FABRICS';
    if (type === 'READY_TO_WEAR') return 'FEATURED_READY_TO_WEAR';
    return 'FEATURED_DESIGNS';
  };

  const getImagePolicy = (type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') => {
    if (type === 'FABRIC') return { min: 3, max: 4, label: 'Fabrics To Buy' };
    if (type === 'READY_TO_WEAR') return { min: 3, max: 5, label: 'Ready To Wear' };
    return { min: 4, max: 6, label: 'Custom To Wear' };
  };

  const currencySymbolByCode: Record<string, string> = {
    USD: '$',
    NGN: '₦',
    GHS: '₵',
    KES: 'KSh',
    ZAR: 'R',
    UGX: 'USh',
    TZS: 'TSh',
    RWF: 'RF',
    XOF: 'CFA',
    XAF: 'CFA',
    EGP: 'E£',
    MAD: 'DH',
    ETB: 'Br',
  };

  const slugify = (value: string) =>
    String(value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120);

  const normalizeOwnerName = (name: string | undefined, role: 'Seller' | 'Designer', id: string) => {
    const trimmed = String(name || '').trim();
    return trimmed || `${role} ${String(id || '').slice(0, 8)}`;
  };

  const formatApiError = (error: any, fallbackMessage: string) => {
    const directMessage = String(error?.response?.data?.message || error?.message || '').trim();
    const issues = error?.response?.data?.issues;
    if (Array.isArray(issues) && issues.length > 0) {
      const details = issues
        .map((issue: any) => String(issue?.message || '').trim())
        .filter(Boolean)
        .join(', ');
      if (details) return details;
    }
    return directMessage || fallbackMessage;
  };

  const normalizeCountryToken = (value: unknown) =>
    String(value || '')
      .trim()
      .toLowerCase();

  useEffect(() => {
    void fetchOptions();
    void fetchDesignerFabricAccess();
    if (isConfigurationView) {
      void fetchProductViewManagerSettings(activeProductViewPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isConfigurationView) return;
    void fetchProductViewManagerSettings(activeProductViewPage);
  }, [activeProductViewPage, isConfigurationView]);

  useEffect(() => {
    void fetchDesignerFabricAccessRequests();
  }, [designerFabricAccessRequestStatusFilter, designerFabricAccessRequestSearch, designerFabricAccessRequestPage]);

  useEffect(() => {
    setCurrentPage(1);
    void fetchProducts(1);
  }, [typeFilter, statusFilter, activeTab, pageSize]);

  const effectiveType = useMemo(() => {
    if (activeTab === 'fabrics') return 'FABRIC';
    if (activeTab === 'designs') return 'DESIGN';
    if (activeTab === 'ready-to-wear') return 'READY_TO_WEAR';
    return typeFilter || undefined;
  }, [activeTab, typeFilter]);

  const activeProductType = (editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  const countryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((item) => String(item.ownerCountry || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const ownerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .map((item) => String(item.ownerName || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const materialOptions = useMemo(
    () =>
      Array.from(
        new Set(
          products
            .filter((item) => item.type === 'FABRIC')
            .map((item) => String(item.category || '').trim())
            .filter(Boolean)
        )
      ).sort((a, b) => a.localeCompare(b)),
    [products]
  );
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        if (countryFilter && String(product.ownerCountry || '').trim().toLowerCase() !== countryFilter.toLowerCase()) {
          return false;
        }
        if (ownerFilter && String(product.ownerName || '').trim().toLowerCase() !== ownerFilter.toLowerCase()) {
          return false;
        }
        if (materialFilter) {
          if (product.type !== 'FABRIC') return false;
          if (String(product.category || '').trim().toLowerCase() !== materialFilter.toLowerCase()) return false;
        }
        return true;
      }),
    [products, countryFilter, ownerFilter, materialFilter]
  );
  const selectedVisibleIds = useMemo(
    () => filteredProducts.filter((product) => selectedIds.includes(product.id)).map((product) => product.id),
    [filteredProducts, selectedIds]
  );
  const selectedOwnerUserId = useMemo(() => {
    if (activeProductType === 'FABRIC') {
      const seller = options.sellers.find((item) => item.id === form.sellerId);
      return String(seller?.ownerUserId || '').trim();
    }
    const designer = options.designers.find((item) => item.id === form.designerId);
    return String(designer?.ownerUserId || '').trim();
  }, [activeProductType, options.sellers, options.designers, form.sellerId, form.designerId]);
  const selectedOwnerCountry = useMemo(() => {
    if (activeProductType === 'FABRIC') {
      const seller = options.sellers.find((item) => item.id === form.sellerId);
      return String(seller?.country || '').trim();
    }
    const designer = options.designers.find((item) => item.id === form.designerId);
    return String(designer?.country || '').trim();
  }, [activeProductType, options.sellers, options.designers, form.sellerId, form.designerId]);

  useEffect(() => {
    const visibleIdSet = new Set(filteredProducts.map((item) => item.id));
    setSelectedIds((prev) => prev.filter((id) => visibleIdSet.has(id)));
  }, [filteredProducts]);

  const selectedLocalCurrency = useMemo(() => {
    if (!selectedOwnerCountry) return null;
    const normalized = selectedOwnerCountry.toUpperCase();
    return (
      currencyMatrix.find((row) => String(row.countryCode || '').toUpperCase() === normalized) ||
      currencyMatrix.find((row) => String(row.country || '').toUpperCase() === normalized) ||
      currencyMatrix.find((row) => String(row.country || '').toUpperCase().includes(normalized)) ||
      null
    );
  }, [selectedOwnerCountry, currencyMatrix]);

  const fetchOptions = async () => {
    const [
      productOptionsResult,
      currencyResult,
      ownerResult,
      categoriesResult,
      materialsResult,
      fabricCategoriesResult,
      sellerProfilesResult,
      designerProfilesResult,
      readySizesSettingsResult,
    ] =
      await Promise.allSettled([
      api.admin.getProductOptions(),
      api.currency.getConfig(),
      api.homepageSections.getAdminDesignerOptions(),
      api.admin.getCategories(),
      api.admin.getMaterials(),
      api.admin.getFabricCategories(),
      api.admin.getVendorProfiles({ role: 'FABRIC_SELLER', page: 1, limit: 500 }),
      api.admin.getVendorProfiles({ role: 'FASHION_DESIGNER', page: 1, limit: 500 }),
      api.admin.getReadyToWearSizesSettings(),
    ]);

    const productOptions =
      productOptionsResult.status === 'fulfilled' && productOptionsResult.value.success
        ? productOptionsResult.value.data
        : null;
    const categoriesFromProducts = Array.isArray(productOptions?.categories) ? productOptions.categories : [];
    const materialsFromProducts = Array.isArray(productOptions?.materials) ? productOptions.materials : [];
    const fabricCategoriesFromProducts = Array.isArray((productOptions as any)?.fabricCategories)
      ? (productOptions as any).fabricCategories
      : [];
    const sellersFromProducts = Array.isArray(productOptions?.sellers) ? productOptions.sellers : [];
    const designersFromProducts = Array.isArray(productOptions?.designers) ? productOptions.designers : [];

    const categoriesFromAdmin =
      categoriesResult.status === 'fulfilled' && categoriesResult.value.success && Array.isArray(categoriesResult.value.data)
        ? categoriesResult.value.data
        : [];
    const materialsFromAdmin =
      materialsResult.status === 'fulfilled' && materialsResult.value.success && Array.isArray(materialsResult.value.data)
        ? materialsResult.value.data
        : [];
    const fabricCategoriesFromAdmin =
      fabricCategoriesResult.status === 'fulfilled' &&
      fabricCategoriesResult.value.success &&
      Array.isArray(fabricCategoriesResult.value.data)
        ? fabricCategoriesResult.value.data
        : [];

    const ownerFallbackRows =
      ownerResult.status === 'fulfilled' && ownerResult.value.success && Array.isArray(ownerResult.value.data)
        ? ownerResult.value.data
        : [];

    const sellerProfileRows =
      sellerProfilesResult.status === 'fulfilled' && sellerProfilesResult.value.success
        ? Array.isArray(sellerProfilesResult.value.data?.profiles)
          ? sellerProfilesResult.value.data.profiles
          : []
        : [];
    const designerProfileRows =
      designerProfilesResult.status === 'fulfilled' && designerProfilesResult.value.success
        ? Array.isArray(designerProfilesResult.value.data?.profiles)
          ? designerProfilesResult.value.data.profiles
          : []
        : [];

    const fallbackSellerProfiles = sellerProfileRows.map((item: any) => {
      const profileId = String(item.profileId || item.id || '').trim();
      const ownerUserId = String(item.userId || item.ownerUserId || '').trim();
      return {
        id: profileId,
        ownerUserId,
        businessName: normalizeOwnerName(
          String(item.businessName || `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() || item.user?.email || ''),
          'Seller',
          profileId || ownerUserId
        ),
        country: String(item.profileData?.country || item.country || '').trim(),
      };
    }).filter((item) => item.id);
    const fallbackDesignerProfiles = designerProfileRows.map((item: any) => {
      const profileId = String(item.profileId || item.id || '').trim();
      const ownerUserId = String(item.userId || item.ownerUserId || '').trim();
      return {
        id: profileId,
        ownerUserId,
        businessName: normalizeOwnerName(
          String(item.businessName || `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim() || item.user?.email || ''),
          'Designer',
          profileId || ownerUserId
        ),
        country: String(item.profileData?.country || item.country || '').trim(),
      };
    }).filter((item) => item.id);

    const fallbackSellers = ownerFallbackRows
      .filter((item) => {
        const type = String(item.vendorType || item.role || '').toUpperCase();
        return type === 'SELLER' || type === 'FABRIC_SELLER';
      })
      .map((item) => ({
        id: String(item.id || ''),
        ownerUserId: String(item.ownerUserId || item.userId || ''),
        businessName: normalizeOwnerName(String(item.businessName || ''), 'Seller', String(item.id || '')),
        country: String(item.country || '').trim(),
      }));
    const fallbackDesigners = ownerFallbackRows
      .filter((item) => {
        const type = String(item.vendorType || item.role || '').toUpperCase();
        return type === 'DESIGNER' || type === 'FASHION_DESIGNER';
      })
      .map((item) => ({
        id: String(item.id || ''),
        ownerUserId: String(item.ownerUserId || item.userId || ''),
        businessName: normalizeOwnerName(String(item.businessName || ''), 'Designer', String(item.id || '')),
        country: String(item.country || '').trim(),
      }));

    const sellerSource = sellersFromProducts.length > 0 ? sellersFromProducts : (fallbackSellerProfiles.length > 0 ? fallbackSellerProfiles : fallbackSellers);
    const designerSource =
      designersFromProducts.length > 0 ? designersFromProducts : (fallbackDesignerProfiles.length > 0 ? fallbackDesignerProfiles : fallbackDesigners);
    const sellerUserIdByProfileId = new Map(
      fallbackSellerProfiles
        .filter((item) => item.id && item.ownerUserId)
        .map((item) => [item.id, item.ownerUserId] as const)
    );
    const designerUserIdByProfileId = new Map(
      fallbackDesignerProfiles
        .filter((item) => item.id && item.ownerUserId)
        .map((item) => [item.id, item.ownerUserId] as const)
    );

    setOptions({
      categories:
        (categoriesFromProducts.length > 0 ? categoriesFromProducts : categoriesFromAdmin).map((item: any) => ({
          id: String(item.id || ''),
          name: String(item.name || '').trim(),
        })),
      materials:
        (materialsFromProducts.length > 0 ? materialsFromProducts : materialsFromAdmin).map((item: any) => ({
          id: String(item.id || ''),
          name: String(item.name || '').trim(),
        })),
      fabricCategories:
        (fabricCategoriesFromProducts.length > 0 ? fabricCategoriesFromProducts : fabricCategoriesFromAdmin).map(
          (item: any) => ({
            id: String(item.id || ''),
            name: String(item.name || '').trim(),
          })
        ),
      sellers:
        sellerSource.map((item: any) => ({
          id: String(item.id || '').trim(),
          ownerUserId:
            String(item.ownerUserId || item.userId || '').trim() ||
            sellerUserIdByProfileId.get(String(item.id || '').trim()) ||
            undefined,
          businessName: normalizeOwnerName(item.businessName, 'Seller', item.id),
          country: String(item.country || '').trim(),
        })),
      designers:
        designerSource.map((item: any) => ({
          id: String(item.id || '').trim(),
          ownerUserId:
            String(item.ownerUserId || item.userId || '').trim() ||
            designerUserIdByProfileId.get(String(item.id || '').trim()) ||
            undefined,
          businessName: normalizeOwnerName(item.businessName, 'Designer', item.id),
          country: String(item.country || '').trim(),
        })),
    });

    if (currencyResult.status === 'fulfilled' && currencyResult.value.success) {
      setCurrencyMatrix(Array.isArray(currencyResult.value.data?.matrix) ? currencyResult.value.data.matrix : []);
    }
    if (readySizesSettingsResult.status === 'fulfilled' && readySizesSettingsResult.value.success) {
      setMinReadyVariantStock(Math.max(2, Math.floor(Number(readySizesSettingsResult.value.data?.minVariantStock || 2))));
    }
  };

  const fetchProductViewManagerSettings = async (pageType: ProductViewPageType) => {
    try {
      setProductViewLoading(true);
      const response = await api.admin.getCategoryPageSettings(pageType);
      const runtime = response?.data || {};
      const normalized = normalizeProductViewManagerSettings(runtime?.settings || {});
      setProductViewSettingsByType((prev) => ({
        ...prev,
        [pageType]: normalized,
      }));
      setProductViewMessage('');
    } catch (loadError) {
      console.error('Failed to load product view manager settings:', loadError);
      setProductViewMessageType('error');
      setProductViewMessage('Unable to load Product Card/Detailed Product View settings.');
      setProductViewSettingsByType((prev) => ({
        ...prev,
        [pageType]: normalizeProductViewManagerSettings(DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS),
      }));
    } finally {
      setProductViewLoading(false);
    }
  };

  const saveProductViewManager = async () => {
    const payload = productViewSettingsByType[activeProductViewPage] || DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS;
    const normalized = normalizeProductViewManagerSettings(payload);
    const fieldOrderWithFallback = normalizeCardFieldOrder(normalized.productCard.fieldOrder);
    const detailTabOrderWithFallback = normalizeDetailTabOrder(normalized.detailView.tabOrder);
    try {
      setProductViewSaving(true);
      setProductViewMessage('');
      await api.admin.updateCategoryPageSettings(activeProductViewPage, {
        productCard: {
          imageEnabled: normalized.productCard.imageEnabled !== false,
          fieldOrder: fieldOrderWithFallback,
          imageAspectRatio: normalized.productCard.imageAspectRatio === '1:1' ? '1:1' : '3:4',
          textGap: clamp(normalized.productCard.textGap, 6, 0, 24),
          contentPaddingX: clamp(normalized.productCard.contentPaddingX, 16, 0, 40),
          contentPaddingY: clamp(normalized.productCard.contentPaddingY, 16, 0, 40),
          designerNameEnabled: normalized.productCard.designerNameEnabled !== false,
          designerNameFontSize: clamp(normalized.productCard.designerNameFontSize, 14, 8, 72),
          designerNameColor: String(normalized.productCard.designerNameColor || '#6b7280'),
          productNameEnabled: normalized.productCard.productNameEnabled !== false,
          productNameFontSize: clamp(normalized.productCard.productNameFontSize, 16, 8, 72),
          productNameColor: String(normalized.productCard.productNameColor || '#111827'),
          shortDescriptionEnabled: normalized.productCard.shortDescriptionEnabled !== false,
          shortDescriptionFontSize: clamp(normalized.productCard.shortDescriptionFontSize, 13, 8, 72),
          shortDescriptionColor: String(normalized.productCard.shortDescriptionColor || '#4b5563'),
          shortDescriptionWordLimit: clamp(normalized.productCard.shortDescriptionWordLimit, 10, 4, 24),
          priceEnabled: normalized.productCard.priceEnabled !== false,
          priceFontSize: clamp(normalized.productCard.priceFontSize, 14, 8, 72),
          priceColor: String(normalized.productCard.priceColor || '#e66045'),
          labelEnabled: normalized.productCard.labelEnabled !== false,
          labelFontSize: clamp(normalized.productCard.labelFontSize, 11, 8, 72),
          labelTextColor: String(normalized.productCard.labelTextColor || '#ffffff'),
          labelBackgroundColor: String(normalized.productCard.labelBackgroundColor || 'rgba(17, 17, 17, 0.75)'),
          labelPosition: 'TOP_LEFT',
          likesEnabled: normalized.productCard.likesEnabled !== false,
          likesSize: clamp(normalized.productCard.likesSize, 18, 8, 72),
          likesColor: String(normalized.productCard.likesColor || '#ffffff'),
          likesActiveColor: String(normalized.productCard.likesActiveColor || '#ef4444'),
          likesPosition: 'TOP_RIGHT',
          countryIconEnabled: normalized.productCard.countryIconEnabled !== false,
          countryIconSize: clamp(normalized.productCard.countryIconSize, 24, 8, 96),
          countryIconPosition: 'BOTTOM_RIGHT',
        },
        detailView: {
          titleFontSize: clamp(normalized.detailView.titleFontSize, 64, 18, 96),
          titleColor: String(normalized.detailView.titleColor || '#1A1A1A'),
          ownerFontSize: clamp(normalized.detailView.ownerFontSize, 16, 10, 42),
          ownerColor: String(normalized.detailView.ownerColor || '#6B6B6B'),
          priceLabelColor: String(normalized.detailView.priceLabelColor || '#6B6B6B'),
          priceValueFontSize: clamp(normalized.detailView.priceValueFontSize, 36, 18, 96),
          priceValueColor: String(normalized.detailView.priceValueColor || '#E85A3C'),
          descriptionFontSize: clamp(normalized.detailView.descriptionFontSize, 14, 12, 36),
          descriptionColor: String(normalized.detailView.descriptionColor || '#2f2d29'),
          specLabelColor: String(normalized.detailView.specLabelColor || '#6B6B6B'),
          specValueColor: String(normalized.detailView.specValueColor || '#1A1A1A'),
          tabOrder: detailTabOrderWithFallback,
          defaultTab: detailTabOrderWithFallback.includes(normalized.detailView.defaultTab)
            ? normalized.detailView.defaultTab
            : detailTabOrderWithFallback[0],
          reviewsEnabled: normalized.detailView.reviewsEnabled !== false,
          discoverEnabled: normalized.detailView.discoverEnabled !== false,
          likesEnabled: normalized.detailView.likesEnabled !== false,
        },
      });
      setProductViewSettingsByType((prev) => ({
        ...prev,
        [activeProductViewPage]: normalized,
      }));
      setProductViewMessageType('success');
      setProductViewMessage('Product Card and Detailed Product View settings saved.');
    } catch (saveError) {
      console.error('Failed to save product view manager settings:', saveError);
      setProductViewMessageType('error');
      setProductViewMessage(formatApiError(saveError, 'Unable to save Product Card/Detailed Product View settings.'));
    } finally {
      setProductViewSaving(false);
    }
  };

  const renderProductViewManager = (activeSubview: ProductConfigurationSubview) => {
    const runtime = productViewSettingsByType[activeProductViewPage] || DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS;
    const card = runtime.productCard;
    const detail = runtime.detailView;
    const showProductCardManager = activeSubview === 'PRODUCT_CARDS';
    const showDetailViewManager = activeSubview === 'DETAILED_PRODUCT_VIEW';

    const setProductCardPatch = (patch: Partial<ProductCardManagerSettings>) => {
      setProductViewSettingsByType((prev) => {
        const current = prev[activeProductViewPage] || DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS;
        return {
          ...prev,
          [activeProductViewPage]: {
            ...current,
            productCard: {
              ...current.productCard,
              ...patch,
            },
          },
        };
      });
    };

    const setDetailPatch = (patch: Partial<DetailViewManagerSettings>) => {
      setProductViewSettingsByType((prev) => {
        const current = prev[activeProductViewPage] || DEFAULT_PRODUCT_VIEW_MANAGER_SETTINGS;
        return {
          ...prev,
          [activeProductViewPage]: {
            ...current,
            detailView: {
              ...current.detailView,
              ...patch,
            },
          },
        };
      });
    };

    return (
      <div className="space-y-4">
        {showProductCardManager ? (
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Product Card Manager</p>
            {productViewLoading ? <span className="text-xs text-gray-500">Loading...</span> : null}
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Controls Product Card display for frontpage/category/smaller placements and ads.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={card.imageEnabled !== false}
                onChange={(event) => setProductCardPatch({ imageEnabled: event.target.checked })}
              />
              Product image enabled
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={card.labelEnabled !== false}
                onChange={(event) => setProductCardPatch({ labelEnabled: event.target.checked })}
              />
              Product label enabled (top-left)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={card.likesEnabled !== false}
                onChange={(event) => setProductCardPatch({ likesEnabled: event.target.checked })}
              />
              Likes icon enabled (top-right)
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={card.countryIconEnabled !== false}
                onChange={(event) => setProductCardPatch({ countryIconEnabled: event.target.checked })}
              />
              Country icon enabled (bottom-right)
            </label>
            <label className="text-xs text-gray-700">
              Image aspect ratio
              <select
                value={card.imageAspectRatio}
                onChange={(event) =>
                  setProductCardPatch({
                    imageAspectRatio: event.target.value === '1:1' ? '1:1' : '3:4',
                  })
                }
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              >
                <option value="3:4">3:4</option>
                <option value="1:1">1:1</option>
              </select>
            </label>
            <label className="text-xs text-gray-700">
              Short description word limit
              <input
                type="number"
                min={4}
                max={24}
                value={card.shortDescriptionWordLimit}
                onChange={(event) =>
                  setProductCardPatch({
                    shortDescriptionWordLimit: clamp(event.target.value, card.shortDescriptionWordLimit, 4, 24),
                  })
                }
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {PRODUCT_CARD_FIELDS.map((field) => {
              const fieldEnabledKey =
                field.key === 'DESIGNER_NAME'
                  ? 'designerNameEnabled'
                  : field.key === 'PRODUCT_NAME'
                    ? 'productNameEnabled'
                    : field.key === 'SHORT_DESCRIPTION'
                      ? 'shortDescriptionEnabled'
                      : 'priceEnabled';
              const fieldFontSizeKey =
                field.key === 'DESIGNER_NAME'
                  ? 'designerNameFontSize'
                  : field.key === 'PRODUCT_NAME'
                    ? 'productNameFontSize'
                    : field.key === 'SHORT_DESCRIPTION'
                      ? 'shortDescriptionFontSize'
                      : 'priceFontSize';
              const fieldColorKey =
                field.key === 'DESIGNER_NAME'
                  ? 'designerNameColor'
                  : field.key === 'PRODUCT_NAME'
                    ? 'productNameColor'
                    : field.key === 'SHORT_DESCRIPTION'
                      ? 'shortDescriptionColor'
                      : 'priceColor';
              const order = Math.max(1, card.fieldOrder.indexOf(field.key) + 1);
              return (
                <div key={field.key} className="rounded border p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-800">{field.label}</p>
                    <label className="flex items-center gap-1 text-[11px] text-gray-600">
                      <input
                        type="checkbox"
                        checked={Boolean((card as any)[fieldEnabledKey])}
                        onChange={(event) => setProductCardPatch({ [fieldEnabledKey]: event.target.checked } as any)}
                      />
                      enabled
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-[11px] text-gray-700">
                      Order
                      <input
                        type="number"
                        min={1}
                        max={4}
                        value={order}
                        onChange={(event) => {
                          const target = clamp(event.target.value, order, 1, PRODUCT_CARD_FIELDS.length);
                          const ordered = [...normalizeCardFieldOrder(card.fieldOrder)];
                          const currentIndex = ordered.indexOf(field.key);
                          if (currentIndex < 0) return;
                          ordered.splice(currentIndex, 1);
                          ordered.splice(target - 1, 0, field.key);
                          setProductCardPatch({ fieldOrder: normalizeCardFieldOrder(ordered) });
                        }}
                        className="mt-1 w-full rounded border px-2 py-1 text-[11px]"
                      />
                    </label>
                    <label className="text-[11px] text-gray-700">
                      Size
                      <input
                        type="number"
                        min={8}
                        max={72}
                        value={Number((card as any)[fieldFontSizeKey] || 14)}
                        onChange={(event) =>
                          setProductCardPatch({
                            [fieldFontSizeKey]: clamp(event.target.value, Number((card as any)[fieldFontSizeKey] || 14), 8, 72),
                          } as any)
                        }
                        className="mt-1 w-full rounded border px-2 py-1 text-[11px]"
                      />
                    </label>
                    <label className="text-[11px] text-gray-700">
                      Color
                      <input
                        value={String((card as any)[fieldColorKey] || '')}
                        onChange={(event) => setProductCardPatch({ [fieldColorKey]: event.target.value } as any)}
                        className="mt-1 w-full rounded border px-2 py-1 text-[11px]"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        ) : null}

        {showDetailViewManager ? (
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-sm font-semibold text-gray-900">Detailed Product View Manager</p>
          <p className="mb-3 text-xs text-gray-500">
            Controls full product details page typography, tab ordering, and visibility.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-gray-700">
              Title font size
              <input
                type="number"
                min={18}
                max={96}
                value={detail.titleFontSize}
                onChange={(event) => setDetailPatch({ titleFontSize: clamp(event.target.value, detail.titleFontSize, 18, 96) })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Title color
              <input
                value={detail.titleColor}
                onChange={(event) => setDetailPatch({ titleColor: event.target.value })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Price value font size
              <input
                type="number"
                min={18}
                max={96}
                value={detail.priceValueFontSize}
                onChange={(event) =>
                  setDetailPatch({ priceValueFontSize: clamp(event.target.value, detail.priceValueFontSize, 18, 96) })
                }
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Price value color
              <input
                value={detail.priceValueColor}
                onChange={(event) => setDetailPatch({ priceValueColor: event.target.value })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Description size
              <input
                type="number"
                min={12}
                max={36}
                value={detail.descriptionFontSize}
                onChange={(event) =>
                  setDetailPatch({ descriptionFontSize: clamp(event.target.value, detail.descriptionFontSize, 12, 36) })
                }
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Description color
              <input
                value={detail.descriptionColor}
                onChange={(event) => setDetailPatch({ descriptionColor: event.target.value })}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs text-gray-700">
              Default tab
              <select
                value={detail.defaultTab}
                onChange={(event) => {
                  const tab = String(event.target.value || 'DETAILS').trim().toUpperCase() as DetailTabKey;
                  setDetailPatch({ defaultTab: DETAIL_TABS.includes(tab) ? tab : 'DETAILS' });
                }}
                className="mt-1 w-full rounded border px-2 py-1.5 text-xs"
              >
                {DETAIL_TABS.map((tab) => (
                  <option key={tab} value={tab}>
                    {tab}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={detail.reviewsEnabled !== false}
                onChange={(event) => setDetailPatch({ reviewsEnabled: event.target.checked })}
              />
              Reviews enabled
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={detail.discoverEnabled !== false}
                onChange={(event) => setDetailPatch({ discoverEnabled: event.target.checked })}
              />
              Discover products enabled
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={detail.likesEnabled !== false}
                onChange={(event) => setDetailPatch({ likesEnabled: event.target.checked })}
              />
              Likes controls enabled
            </label>
          </div>

          <div className="mt-3 rounded border p-2">
            <p className="mb-2 text-xs font-medium text-gray-700">Tab order numbering (DETAILS / SPECS / REVIEWS)</p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {DETAIL_TABS.map((tab) => {
                const order = Math.max(1, detail.tabOrder.indexOf(tab) + 1);
                return (
                  <label key={tab} className="text-[11px] text-gray-700">
                    {tab} order
                    <input
                      type="number"
                      min={1}
                      max={DETAIL_TABS.length}
                      value={order}
                      onChange={(event) => {
                        const target = clamp(event.target.value, order, 1, DETAIL_TABS.length);
                        const ordered = [...normalizeDetailTabOrder(detail.tabOrder)];
                        const currentIndex = ordered.indexOf(tab);
                        if (currentIndex < 0) return;
                        ordered.splice(currentIndex, 1);
                        ordered.splice(target - 1, 0, tab);
                        setDetailPatch({ tabOrder: normalizeDetailTabOrder(ordered) });
                      }}
                      className="mt-1 w-full rounded border px-2 py-1 text-[11px]"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
        ) : null}
      </div>
    );
  };

  const fetchDesignerFabricAccess = async () => {
    try {
      setDesignerFabricAccessLoading(true);
      const response = await api.admin.getDesignerFabricCountryAccess();
      if (!response.success) return;
      const rows = Array.isArray(response.data?.designers) ? response.data.designers : [];
      const countries = Array.isArray(response.data?.availableCountries) ? response.data.availableCountries : [];
      setDesignerFabricAccessRows(rows);
      setDesignerFabricAccessCountries(
        Array.from(new Set([...countries, ...STATIC_COUNTRIES].map((entry) => String(entry || '').trim()).filter(Boolean))).sort(
          (a, b) => a.localeCompare(b)
        )
      );
      setDesignerFabricAccessDrafts(
        rows.reduce<Record<string, string[]>>((acc, row) => {
          acc[row.designerUserId] = Array.isArray(row.extraCountries) ? row.extraCountries : [];
          return acc;
        }, {})
      );
    } catch (accessError: any) {
      setDesignerFabricAccessMessage(
        accessError?.response?.data?.message || accessError?.message || 'Failed to load designer fabric country access.'
      );
    } finally {
      setDesignerFabricAccessLoading(false);
    }
  };

  const fetchDesignerFabricAccessRequests = async () => {
    try {
      setDesignerFabricAccessRequestsLoading(true);
      const response = await api.admin.getDesignerFabricCountryAccessRequests({
        status: designerFabricAccessRequestStatusFilter,
        search: designerFabricAccessRequestSearch.trim() || undefined,
        page: designerFabricAccessRequestPage,
        limit: designerFabricAccessRequestLimit,
      });
      if (!response.success) return;
      setDesignerFabricAccessRequests(Array.isArray(response.data) ? response.data : []);
      setDesignerFabricAccessRequestPage(Math.max(1, Number(response.pagination?.page || designerFabricAccessRequestPage)));
      setDesignerFabricAccessRequestTotalPages(Math.max(1, Number(response.pagination?.pages || 1)));
      setDesignerFabricAccessRequestTotal(Math.max(0, Number(response.pagination?.total || 0)));
    } catch (requestError: any) {
      setDesignerFabricAccessMessage(
        requestError?.response?.data?.message || requestError?.message || 'Failed to load country access requests.'
      );
    } finally {
      setDesignerFabricAccessRequestsLoading(false);
    }
  };

  const reviewDesignerFabricAccessRequest = async (
    request: DesignerFabricCountryAccessRequestRow,
    status: 'APPROVED' | 'REJECTED'
  ) => {
    try {
      setDesignerFabricAccessReviewingRequestId(request.id);
      setDesignerFabricAccessMessage('');
      const defaultNotes =
        status === 'APPROVED'
          ? 'Approved by admin.'
          : 'Rejected by admin.';
      const reviewNotes = window.prompt(
        status === 'APPROVED' ? 'Approval note (optional):' : 'Rejection reason (optional):',
        defaultNotes
      ) || undefined;
      await api.admin.reviewDesignerFabricCountryAccessRequest(request.id, {
        status,
        reviewNotes: reviewNotes?.trim() || undefined,
        grantedCountries: status === 'APPROVED' ? request.requestedCountries : undefined,
      });
      setDesignerFabricAccessRequestPage(1);
      await Promise.all([fetchDesignerFabricAccess(), fetchDesignerFabricAccessRequests()]);
      setDesignerFabricAccessMessage(
        status === 'APPROVED'
          ? 'Country access request approved and access granted.'
          : 'Country access request rejected.'
      );
    } catch (reviewError: any) {
      setDesignerFabricAccessMessage(
        reviewError?.response?.data?.message || reviewError?.message || 'Failed to review country access request.'
      );
    } finally {
      setDesignerFabricAccessReviewingRequestId(null);
    }
  };

  const saveDesignerFabricAccess = async (designerUserId: string) => {
    const selected = designerFabricAccessDrafts[designerUserId] || [];
    try {
      setDesignerFabricAccessSavingUserId(designerUserId);
      setDesignerFabricAccessMessage('');
      await api.admin.updateDesignerFabricCountryAccess(designerUserId, selected);
      setDesignerFabricAccessRequestPage(1);
      await Promise.all([fetchDesignerFabricAccess(), fetchDesignerFabricAccessRequests()]);
      setDesignerFabricAccessMessage('Designer fabric country access updated.');
    } catch (accessError: any) {
      setDesignerFabricAccessMessage(
        accessError?.response?.data?.message || accessError?.message || 'Failed to update designer fabric country access.'
      );
    } finally {
      setDesignerFabricAccessSavingUserId(null);
    }
  };

  const createCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    if (name.length < 2) {
      setError('Style name must be at least 2 characters.');
      return;
    }
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.createCategory({
        name,
        slug: slugify(name),
        description: '',
        sortOrder: options.categories.length,
      });
      setNewCategoryName('');
      await fetchOptions();
      setSuccess('Style saved.');
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create style.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const createMaterial = async () => {
    const name = newMaterialName.trim();
    if (!name) return;
    if (name.length < 2) {
      setError('Material type name must be at least 2 characters.');
      return;
    }
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.createMaterial({
        name,
        slug: slugify(name),
        description: '',
      });
      setNewMaterialName('');
      await fetchOptions();
      setSuccess('Material type saved.');
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create material type.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const createFabricCategory = async () => {
    const name = newFabricCategoryName.trim();
    if (!name) return;
    if (name.length < 2) {
      setError('Fabric category name must be at least 2 characters.');
      return;
    }
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.createFabricCategory({
        name,
        slug: slugify(name),
        description: '',
        sortOrder: options.fabricCategories.length,
      });
      setNewFabricCategoryName('');
      await fetchOptions();
      setSuccess('Fabric category saved.');
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create fabric category.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const renameCategory = async (id: string, currentName: string) => {
    const nextName = window.prompt('Update style name', currentName)?.trim();
    if (!nextName || nextName === currentName) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.updateCategory(id, { name: nextName });
      await fetchOptions();
      setSuccess('Style updated.');
    } catch (updateError: any) {
      setError(updateError?.response?.data?.message || 'Failed to update style.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const renameMaterial = async (id: string, currentName: string) => {
    const nextName = window.prompt('Update material type name', currentName)?.trim();
    if (!nextName || nextName === currentName) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.updateMaterial(id, { name: nextName });
      await fetchOptions();
      setSuccess('Material type updated.');
    } catch (updateError: any) {
      setError(updateError?.response?.data?.message || 'Failed to update material type.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const removeCategory = async (id: string) => {
    if (!window.confirm('Delete this style?')) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.deleteCategory(id);
      await fetchOptions();
      setSuccess('Style deleted.');
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Failed to delete style.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const removeMaterial = async (id: string) => {
    if (!window.confirm('Delete this material type?')) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.deleteMaterial(id);
      await fetchOptions();
      setSuccess('Material type deleted.');
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Failed to delete material type.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const renameFabricCategory = async (id: string, currentName: string) => {
    const nextName = window.prompt('Update fabric category name', currentName)?.trim();
    if (!nextName || nextName === currentName) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.updateFabricCategory(id, { name: nextName });
      await fetchOptions();
      setSuccess('Fabric category updated.');
    } catch (updateError: any) {
      setError(updateError?.response?.data?.message || 'Failed to update fabric category.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const removeFabricCategory = async (id: string) => {
    if (!window.confirm('Delete this fabric category?')) return;
    try {
      setTaxonomySaving(true);
      setError('');
      await api.admin.deleteFabricCategory(id);
      await fetchOptions();
      setSuccess('Fabric category deleted.');
    } catch (deleteError: any) {
      setError(deleteError?.response?.data?.message || 'Failed to delete fabric category.');
    } finally {
      setTaxonomySaving(false);
    }
  };

  const fetchProducts = async (pageOverride?: number) => {
    try {
      setLoading(true);
      setError('');
      const requestedPage = pageOverride ?? currentPage;
      const response = await api.admin.getProducts({
        search: search || undefined,
        status: statusFilter || undefined,
        type: (effectiveType as any) || undefined,
        page: requestedPage,
        limit: pageSize,
      });
      if (response.success) {
        setProducts(response.data.products || []);
        const pagination = response.data?.pagination || {};
        setCurrentPage(Number(pagination.page || requestedPage));
        setTotalPages(Math.max(1, Number(pagination.pages || 1)));
        setTotalProducts(Number(pagination.total || 0));
        setSelectedIds([]);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
      setProducts([]);
      setError(formatApiError(error, 'Unable to load products. Check admin permissions and API deployment.'));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditing(null);
    setError('');
    setSuccess('');
    setModalError('');
    setForm({
      type: 'FABRIC',
      name: '',
      description: '',
      price: 0,
      materialTypeId: '',
      fabricCategoryId: '',
      categoryId: '',
      sellerId: '',
      designerId: '',
      status: 'DRAFT',
      isAvailable: false,
      publishNow: false,
      isFeatured: false,
      featuredSection: 'FEATURED_DESIGNS',
      images: [],
      minYards: 1,
      stockYards: 0,
      stock: minReadyVariantStock,
      size: 'M',
      readyVariants: [{ size: 'M', color: 'DEFAULT', price: 0, stock: minReadyVariantStock }],
      hasAdditionalMaterialOrFabric: false,
    });
    setImagesDirty(false);
    setReadyVariantsDirty(false);
    setImageUrlInput('');
    setShowModal(true);
  };

  const openEditModal = async (product: Product) => {
    let sourceProduct: Product & Record<string, any> = product as Product & Record<string, any>;
    if (product.type === 'READY_TO_WEAR') {
      try {
        const detail = await api.products.getReadyToWearProduct(product.id);
        if (detail?.success && detail.data) {
          const detailImages = normalizeImageUrlList((detail.data as any).images);
          sourceProduct = {
            ...sourceProduct,
            ...(detail.data as any),
            categoryId: String((detail.data as any).categoryId || sourceProduct.categoryId || ''),
            category: (detail.data as any).category || sourceProduct.category,
            finalPrice: Number((detail.data as any).finalPrice || (detail.data as any).basePrice || sourceProduct.finalPrice || 0),
            image: detailImages[0] || sourceProduct.image || null,
            images: detailImages,
            sizeVariations: Array.isArray((detail.data as any).sizeVariations) ? (detail.data as any).sizeVariations : [],
          };
        }
      } catch (error) {
        // Fall back to table row payload if detail hydration fails.
      }
    } else if (product.type === 'DESIGN') {
      try {
        const detail = await api.products.getDesignById(product.id);
        if (detail?.success && detail.data) {
          const detailImages = normalizeImageUrlList((detail.data as any).images);
          sourceProduct = {
            ...sourceProduct,
            ...(detail.data as any),
            categoryId: String((detail.data as any).categoryId || sourceProduct.categoryId || ''),
            category: (detail.data as any).category?.name || sourceProduct.category,
            finalPrice: Number((detail.data as any).finalPrice || (detail.data as any).basePrice || sourceProduct.finalPrice || 0),
            image: detailImages[0] || sourceProduct.image || null,
            images: detailImages,
            measurements: Array.isArray((detail.data as any).measurements)
              ? (detail.data as any).measurements
              : Array.isArray((detail.data as any).measurementVariables)
                ? (detail.data as any).measurementVariables
                : [],
            suitableFabrics: Array.isArray((detail.data as any).suitableFabrics) ? (detail.data as any).suitableFabrics : [],
            requiredFabricYards: Number((detail.data as any).requiredFabricYards || (detail.data as any).yardsNeeded || 0),
            predominantColor: String((detail.data as any).predominantColor || sourceProduct.predominantColor || ''),
          };
        }
      } catch (error) {
        // Fall back to table row payload if detail hydration fails.
      }
    }
    const matchedCategoryId =
      String(sourceProduct.categoryId || '').trim() ||
      options.categories.find((item) => String(item.name || '').trim().toLowerCase() === String(sourceProduct.category || '').trim().toLowerCase())?.id ||
      '';
    const matchedMaterialTypeId =
      String(sourceProduct.materialTypeId || '').trim() ||
      options.materials.find(
        (item) =>
          String(item.name || '').trim().toLowerCase() ===
          String(sourceProduct.materialTypeName || sourceProduct.category || '').trim().toLowerCase()
      )?.id ||
      options.materials.find((item) => String(item.name || '').trim().toLowerCase() === String(sourceProduct.category || '').trim().toLowerCase())?.id ||
      '';
    const matchedFabricCategoryId =
      String(sourceProduct.fabricCategoryId || '').trim() ||
      options.fabricCategories.find(
        (item) =>
          String(item.name || '').trim().toLowerCase() ===
          String(sourceProduct.fabricCategoryName || '').trim().toLowerCase()
      )?.id ||
      '';
    const existingReadyVariants = (
      Array.isArray((sourceProduct as any).readyVariants)
        ? (sourceProduct as any).readyVariants
        : Array.isArray((sourceProduct as any).sizeVariations)
          ? (sourceProduct as any).sizeVariations
          : []
    )
      .map((entry: any) => {
        const decoded = decodeReadyVariant(entry?.size, entry?.color);
        return {
          size: decoded.size || 'M',
          color: decoded.color || 'DEFAULT',
          price: Number(entry?.price || sourceProduct.finalPrice || 0),
          stock: Math.max(minReadyVariantStock, Number(entry?.stock || 0)),
        };
      })
      .filter((entry: any) => entry.size && Number.isFinite(entry.price));
    const shouldForceVariantSave = sourceProduct.type === 'READY_TO_WEAR' && existingReadyVariants.length === 0;

    setEditing(sourceProduct as Product);
    setError('');
    setSuccess('');
    setModalError('');
    setForm({
      type: sourceProduct.type,
      name: sourceProduct.name,
      description: sourceProduct.description || '',
      price: Number(sourceProduct.finalPrice || 0),
      materialTypeId: matchedMaterialTypeId,
      fabricCategoryId: matchedFabricCategoryId,
      categoryId: matchedCategoryId,
      sellerId: sourceProduct.sellerId || '',
      designerId: sourceProduct.designerId || '',
      status: sourceProduct.status,
      isAvailable: sourceProduct.isAvailable,
      publishNow: sourceProduct.status === 'APPROVED' && sourceProduct.isAvailable,
      isFeatured: Boolean(sourceProduct.isFeatured),
      featuredSection: sourceProduct.featuredSections?.[0] || getDefaultFeaturedSection(sourceProduct.type),
      images:
        Array.isArray(sourceProduct.images) && sourceProduct.images.length > 0
          ? normalizeImageUrlList(sourceProduct.images)
          : sourceProduct.image
            ? [sourceProduct.image]
            : [],
      minYards: 1,
      stockYards: 0,
      stock: Math.max(minReadyVariantStock, Number(existingReadyVariants[0]?.stock || 0)),
      size: 'M',
      readyVariants:
        existingReadyVariants.length > 0
          ? existingReadyVariants
          : [{ size: 'M', color: 'DEFAULT', price: Number(sourceProduct.finalPrice || 0), stock: minReadyVariantStock }],
      hasAdditionalMaterialOrFabric: sourceProduct.hasAdditionalMaterialOrFabric === true,
    });
    setImagesDirty(false);
    setReadyVariantsDirty(shouldForceVariantSave);
    if (shouldForceVariantSave) {
      setModalError('No saved variants were found for this ready-to-wear product. Please confirm variants and save to restore inventory rows.');
    }
    setImageUrlInput('');
    setShowModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setModalError('');
      const currentType = (editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      const resolvedPrice = Number(form.price);
      if (!String(form.name || '').trim()) {
        setModalError('Product name is required.');
        setSaving(false);
        return;
      }
      if (!String(form.description || '').trim()) {
        setModalError('Product description is required.');
        setSaving(false);
        return;
      }
      if (!Number.isFinite(resolvedPrice) || resolvedPrice <= 0) {
        setModalError('Base price must be greater than 0.');
        setSaving(false);
        return;
      }
      if (currentType === 'FABRIC') {
        if (!editing && !form.sellerId) {
          setModalError('Please select a seller for this fabric product.');
          setSaving(false);
          return;
        }
        if (!form.materialTypeId) {
          setModalError('Please select a material type for this fabric product.');
          setSaving(false);
          return;
        }
        if (!form.fabricCategoryId) {
          setModalError('Please select a fabric category for this fabric product.');
          setSaving(false);
          return;
        }
      } else {
        if (!editing && !form.designerId) {
          setModalError('Please select a designer for this product.');
          setSaving(false);
          return;
        }
        if (!form.categoryId) {
          setModalError('Please select a style for this product.');
          setSaving(false);
          return;
        }
        if (currentType === 'READY_TO_WEAR') {
          if (!form.materialTypeId) {
            setModalError('Please select a material type for this ready-to-wear product.');
            setSaving(false);
            return;
          }
          if (!form.fabricCategoryId) {
            setModalError('Please select a fabric category for this ready-to-wear product.');
            setSaving(false);
            return;
          }
        }
      }
      const imagePolicy = getImagePolicy(currentType);
      const imageCount = form.images.length;
      const shouldValidateImages = !editing || imagesDirty;
      if (shouldValidateImages && (imageCount < imagePolicy.min || imageCount > imagePolicy.max)) {
        const message = `${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`;
        setError(message);
        setModalError(message);
        setSaving(false);
        return;
      }
      if (currentType === 'READY_TO_WEAR') {
        if (!Array.isArray(form.readyVariants) || form.readyVariants.length === 0) {
          setModalError('Ready-to-wear products require at least one variant row.');
          setSaving(false);
          return;
        }
        const normalizedVariantKeys = form.readyVariants.map((variant) =>
          `${String(variant.size || '').trim().toUpperCase()}::${String(variant.color || 'DEFAULT').trim().toUpperCase() || 'DEFAULT'}`
        );
        if (new Set(normalizedVariantKeys).size !== normalizedVariantKeys.length) {
          setModalError('Duplicate size/color variants are not allowed.');
          setSaving(false);
          return;
        }
        if (
          form.readyVariants.some(
            (variant) =>
              !String(variant.size || '').trim() ||
              !Number.isFinite(Number(variant.price || 0)) ||
              Number(variant.price || 0) <= 0 ||
              !Number.isFinite(Number(variant.stock || 0)) ||
              Number(variant.stock || 0) < minReadyVariantStock
          )
        ) {
          setModalError(`Each ready-to-wear variant needs size, price > 0, and stock >= ${minReadyVariantStock}.`);
          setSaving(false);
          return;
        }
      }
      const resolvedStatus = form.publishNow ? 'APPROVED' : form.status;
      const resolvedIsAvailable = form.publishNow ? true : false;
      let savedType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' = editing ? editing.type : form.type;
      let savedId: string | null = editing?.id || null;
      if (editing) {
        const isFabricEdit = editing.type === 'FABRIC';
        const isReadyEdit = editing.type === 'READY_TO_WEAR';
        const readyVariantPayload =
          isReadyEdit && readyVariantsDirty
            ? form.readyVariants.map((variant) => ({
                size: String(variant.size || '').trim().toUpperCase(),
                color: String(variant.color || 'DEFAULT').trim().toUpperCase() || 'DEFAULT',
                price: Number(variant.price || 0),
                stock: Math.max(minReadyVariantStock, Math.floor(Number(variant.stock || 0))),
              }))
            : undefined;
        await api.admin.updateProduct(editing.type, editing.id, {
          name: form.name,
          description: form.description,
          price: resolvedPrice,
          basePrice: resolvedPrice,
          sellerPrice: resolvedPrice,
          ownerUserId: selectedOwnerUserId || undefined,
          status: resolvedStatus,
          isAvailable: resolvedIsAvailable,
          images: imagesDirty ? form.images : undefined,
          materialTypeId: form.materialTypeId || undefined,
          fabricCategoryId: form.fabricCategoryId || undefined,
          categoryId: form.categoryId || undefined,
          stock: isFabricEdit ? form.stock : undefined,
          stockYards: isFabricEdit ? form.stockYards : undefined,
          minYards: isFabricEdit ? form.minYards : undefined,
          variants: readyVariantPayload,
          // Backward compatibility for older admin APIs that expect `sizes`.
          sizes: readyVariantPayload,
          hasAdditionalMaterialOrFabric:
            editing.type === 'DESIGN' || editing.type === 'READY_TO_WEAR'
              ? form.hasAdditionalMaterialOrFabric === true
              : undefined,
        });
      } else {
        const readyVariantPayload =
          form.type === 'READY_TO_WEAR'
            ? form.readyVariants.map((variant) => ({
                size: String(variant.size || '').trim().toUpperCase(),
                color: String(variant.color || 'DEFAULT').trim().toUpperCase() || 'DEFAULT',
                price: Number(variant.price || 0),
                stock: Math.max(minReadyVariantStock, Math.floor(Number(variant.stock || 0))),
              }))
            : undefined;
        const created = await api.admin.createProduct({
          type: form.type,
          name: form.name,
          description: form.description,
          price: resolvedPrice,
          basePrice: resolvedPrice,
          sellerPrice: resolvedPrice,
          ownerUserId: selectedOwnerUserId || undefined,
          sellerId: form.type === 'FABRIC' ? form.sellerId : undefined,
          designerId: form.type !== 'FABRIC' ? form.designerId : undefined,
          materialTypeId:
            form.type === 'FABRIC' || form.type === 'READY_TO_WEAR' || form.type === 'DESIGN'
              ? form.materialTypeId || undefined
              : undefined,
          fabricCategoryId: form.type === 'FABRIC' || form.type === 'READY_TO_WEAR' ? form.fabricCategoryId || undefined : undefined,
          categoryId: form.type !== 'FABRIC' ? form.categoryId : undefined,
          status: resolvedStatus,
          isAvailable: resolvedIsAvailable,
          images: form.images,
          minYards: form.minYards,
          stockYards: form.stockYards,
          stock: form.stock,
          size: form.size || undefined,
          variants: readyVariantPayload,
          // Backward compatibility for older admin APIs that expect `sizes`.
          sizes: readyVariantPayload,
          hasAdditionalMaterialOrFabric:
            form.type === 'DESIGN' || form.type === 'READY_TO_WEAR'
              ? form.hasAdditionalMaterialOrFabric === true
              : undefined,
        });
        savedId = created.data?.id || null;
        savedType = (created.data?.type as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') || form.type;
      }

      if (savedId) {
        try {
          await api.admin.setProductFeatured(savedType, savedId, {
            isFeatured: form.isFeatured,
            section: form.isFeatured ? form.featuredSection : undefined,
            displayOrder: 0,
          });
        } catch (featuredError) {
          console.warn('Featured toggle failed; product data was still saved.', featuredError);
          setError('Product updated, but featured setting could not be saved on this deployment.');
        }
      }
      setSuccess(editing ? 'Product updated successfully.' : 'Product created successfully.');
      setShowModal(false);
      setModalError('');
      setImagesDirty(false);
      setReadyVariantsDirty(false);
      setImageUrlInput('');
      await fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      const message = formatApiError(error, 'Failed to save product.');
      setError(message);
      setModalError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;
    try {
      setUploadingImage(true);
      setError('');
      setModalError('');
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
        const message = 'Image upload failed.';
        setError(message);
        setModalError(message);
        return;
      }
      const policy = getImagePolicy((editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR');
      setForm((prev) => {
        const merged = Array.from(new Set([...prev.images, ...uploadedUrls]));
        const trimmed = merged.slice(0, policy.max);
        if (merged.length > policy.max) {
          const message = `${policy.label} allows a maximum of ${policy.max} images.`;
          setError(message);
          setModalError(message);
        }
        return { ...prev, images: trimmed };
      });
      setImagesDirty(true);
      setSuccess('Image(s) uploaded successfully.');
    } catch (uploadError) {
      console.error('Failed to upload product image:', uploadError);
      const message = formatApiError(uploadError, 'Failed to upload image.');
      setError(message);
      setModalError(message);
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const value = imageUrlInput.trim();
    if (!value) {
      setModalError('Please enter an image URL before adding.');
      return;
    }
    setModalError('');
    const policy = getImagePolicy(activeProductType);
    setForm((prev) => {
      const merged = Array.from(new Set([...prev.images, value])).slice(0, policy.max);
      if (prev.images.length >= policy.max) {
        const message = `${policy.label} allows a maximum of ${policy.max} images.`;
        setError(message);
        setModalError(message);
      }
      return { ...prev, images: merged };
    });
    setImagesDirty(true);
    setImageUrlInput('');
  };

  const handleRemoveImage = (url: string) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((item) => item !== url),
    }));
    setImagesDirty(true);
  };

  const statusLabel = (product: Product) => {
    if (product.status === 'APPROVED' && !product.isAvailable) return 'UNPUBLISHED';
    return product.status;
  };

  const moderateProduct = async (product: Product, action: ModerationAction) => {
    try {
      setSubmitting(true);
      const requiresMessage = action === 'REQUEST_CHANGES' || action === 'REJECT' || action === 'SUSPEND';
      const message = requiresMessage ? window.prompt('Enter message to vendor (required):', '')?.trim() || undefined : undefined;
      if (requiresMessage && !message) return;
      await api.admin.moderateProduct(product.type, product.id, {
        action,
        message,
        notifyVendor: true,
      });
      await fetchProducts();
      setSuccess('Product moderation action applied.');
    } catch (moderationError) {
      console.error('Failed to moderate product:', moderationError);
      setError('Failed to apply moderation action.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkModeration = async () => {
    if (selectedIds.length === 0) return;
    try {
      setSubmitting(true);
      setError('');
      const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
      const byType = selectedProducts.reduce<Record<'FABRIC' | 'DESIGN' | 'READY_TO_WEAR', string[]>>(
        (acc, product) => {
          acc[product.type].push(product.id);
          return acc;
        },
        { FABRIC: [], DESIGN: [], READY_TO_WEAR: [] }
      );

      const requiresMessage = bulkAction === 'REQUEST_CHANGES' || bulkAction === 'REJECT' || bulkAction === 'SUSPEND';
      const message = requiresMessage
        ? window.prompt('Enter message to affected vendors (required):', '')?.trim() || undefined
        : undefined;
      if (requiresMessage && !message) return;

      await Promise.all(
        (Object.entries(byType) as Array<['FABRIC' | 'DESIGN' | 'READY_TO_WEAR', string[]]>)
          .filter(([, ids]) => ids.length > 0)
          .map(([productType, ids]) =>
            api.admin.moderateProductsBulk({
              productType,
              productIds: ids,
              action: bulkAction,
              message,
              notifyVendor: true,
            })
          )
      );
      setSelectedIds([]);
      await fetchProducts();
      setSuccess('Bulk moderation action applied.');
    } catch (bulkError) {
      console.error('Failed to run bulk moderation:', bulkError);
      setError('Failed to run bulk moderation.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeaturedFromList = async (product: Product) => {
    try {
      setSubmitting(true);
      await api.admin.setProductFeatured(product.type, product.id, {
        isFeatured: !Boolean(product.isFeatured),
        section: product.featuredSections?.[0] || getDefaultFeaturedSection(product.type),
        displayOrder: 0,
      });
      await fetchProducts();
      setSuccess(product.isFeatured ? 'Removed from featured.' : 'Marked as featured.');
    } catch (featureError) {
      console.error('Failed to toggle featured:', featureError);
      setError(formatApiError(featureError, 'Failed to update featured status.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
        {!isConfigurationView ? (
          <Button onClick={openCreateModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Product
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/admin/products"
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            !isConfigurationView
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Product
        </Link>
        <Link
          to="/admin/products/configuration/product-cards"
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            isConfigurationView
              ? 'border-amber-300 bg-amber-50 text-amber-800'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          Product Configuration
        </Link>
      </div>

      {isConfigurationView ? (
      <>
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Product Configuration</h2>
            <p className="text-xs text-gray-500">
              Manage Product Card and Detailed Product View from Product Management. RTW & FTB can be alike with different
              fields from each product type, while CTW can be configured independently for its ordering flow.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={() => void saveProductViewManager()}
            disabled={productViewSaving}
          >
            {productViewSaving ? 'Saving...' : 'Save Product View Settings'}
          </Button>
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRODUCT_VIEW_PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveProductViewPage(tab.key)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                activeProductViewPage === tab.key
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title={tab.hint}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="mb-3 flex flex-wrap gap-2">
          {PRODUCT_CONFIGURATION_SUBMENU.map((submenu) => (
            <Link
              key={submenu.key}
              to={submenu.href}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                activeProductConfigurationSubview === submenu.key
                  ? 'border-amber-300 bg-amber-50 text-amber-800'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
              title={submenu.hint}
            >
              {submenu.label}
            </Link>
          ))}
        </div>
        {productViewMessage ? (
          <div
            className={`mb-3 rounded border px-3 py-2 text-xs ${
              productViewMessageType === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }`}
          >
            {productViewMessage}
          </div>
        ) : null}
        {renderProductViewManager(activeProductConfigurationSubview)}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Product Taxonomy Management</h2>
          <p className="text-xs text-gray-500">
            Manage styles, material types, and fabric categories used across FTB/CTW/RTW uploads.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium text-gray-800">Styles (Custom/Ready-to-Wear)</p>
            <div className="mb-2 flex gap-2">
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Add style name"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" onClick={createCategory} disabled={taxonomySaving || !newCategoryName.trim()}>
                Add
              </Button>
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {options.categories.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span className="truncate">{item.name}</span>
                  <div className="ml-2 flex shrink-0 gap-2">
                    <button type="button" onClick={() => renameCategory(item.id, item.name)} className="text-amber-600 hover:text-amber-800">
                      Edit
                    </button>
                    <button type="button" onClick={() => removeCategory(item.id)} className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium text-gray-800">Material Types (Fabrics)</p>
            <div className="mb-2 flex gap-2">
              <input
                value={newMaterialName}
                onChange={(e) => setNewMaterialName(e.target.value)}
                placeholder="Add material type"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <Button type="button" size="sm" onClick={createMaterial} disabled={taxonomySaving || !newMaterialName.trim()}>
                Add
              </Button>
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {options.materials.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span className="truncate">{item.name}</span>
                  <div className="ml-2 flex shrink-0 gap-2">
                    <button type="button" onClick={() => renameMaterial(item.id, item.name)} className="text-amber-600 hover:text-amber-800">
                      Edit
                    </button>
                    <button type="button" onClick={() => removeMaterial(item.id)} className="text-red-600 hover:text-red-800">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium text-gray-800">Fabric Categories (FTB)</p>
            <div className="mb-2 flex gap-2">
              <input
                value={newFabricCategoryName}
                onChange={(e) => setNewFabricCategoryName(e.target.value)}
                placeholder="Add fabric category"
                className="w-full rounded border px-3 py-2 text-sm"
              />
              <Button
                type="button"
                size="sm"
                onClick={createFabricCategory}
                disabled={taxonomySaving || !newFabricCategoryName.trim()}
              >
                Add
              </Button>
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
              {options.fabricCategories.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm">
                  <span className="truncate">{item.name}</span>
                  <div className="ml-2 flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => renameFabricCategory(item.id, item.name)}
                      className="text-amber-600 hover:text-amber-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removeFabricCategory(item.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Designer Fabric Country Access</h2>
          <p className="text-xs text-gray-500">
            Designers can see fabrics from their own country by default. Select additional countries for specific designers below.
          </p>
        </div>
        {designerFabricAccessMessage ? (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {designerFabricAccessMessage}
          </div>
        ) : null}
        {designerFabricAccessLoading ? (
          <p className="text-sm text-gray-500">Loading designer access settings...</p>
        ) : (
          <div className="space-y-3">
            {designerFabricAccessRows.length === 0 ? (
              <p className="text-sm text-gray-500">No designers found.</p>
            ) : (
              designerFabricAccessRows.map((row) => (
                <div key={row.designerUserId} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{row.businessName}</p>
                      <p className="text-xs text-gray-500">
                        {row.email || 'No email'} • Home country: {row.homeCountry || 'Not specified'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => saveDesignerFabricAccess(row.designerUserId)}
                      disabled={designerFabricAccessSavingUserId === row.designerUserId}
                    >
                      {designerFabricAccessSavingUserId === row.designerUserId ? 'Saving...' : 'Save Access'}
                    </Button>
                  </div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">Additional allowed countries</label>
                  <select
                    multiple
                    value={designerFabricAccessDrafts[row.designerUserId] || []}
                    onChange={(event) => {
                      const values = Array.from(event.target.selectedOptions).map((option) => option.value);
                      setDesignerFabricAccessDrafts((prev) => ({
                        ...prev,
                        [row.designerUserId]: values.filter(
                          (entry) => normalizeCountryToken(entry) !== normalizeCountryToken(row.homeCountry)
                        ),
                      }));
                    }}
                    className="h-28 w-full rounded border px-2 py-2 text-sm"
                  >
                    {designerFabricAccessCountries
                      .filter((country) => normalizeCountryToken(country) !== normalizeCountryToken(row.homeCountry))
                      .map((country) => (
                        <option key={`${row.designerUserId}-${country}`} value={country}>
                          {country}
                        </option>
                      ))}
                  </select>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Designer Country Access Requests</h2>
          <p className="text-xs text-gray-500">
            Approve or reject requests submitted by designers to access additional fabric seller countries.
          </p>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select
            value={designerFabricAccessRequestStatusFilter}
            onChange={(event) => {
              setDesignerFabricAccessRequestStatusFilter(
                (event.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED') || 'ALL'
              );
              setDesignerFabricAccessRequestPage(1);
            }}
            className="rounded border px-2 py-1 text-xs"
          >
            <option value="ALL">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <input
            type="text"
            value={designerFabricAccessRequestSearch}
            onChange={(event) => {
              setDesignerFabricAccessRequestSearch(event.target.value);
              setDesignerFabricAccessRequestPage(1);
            }}
            placeholder="Search designer/email/country..."
            className="w-full rounded border px-3 py-1.5 text-xs md:w-[260px]"
          />
          <span className="text-xs text-gray-500">
            {designerFabricAccessRequestTotal} total • Page {designerFabricAccessRequestPage} of{' '}
            {designerFabricAccessRequestTotalPages}
          </span>
        </div>
        {designerFabricAccessRequestsLoading ? (
          <p className="text-sm text-gray-500">Loading requests...</p>
        ) : designerFabricAccessRequests.length === 0 ? (
          <p className="text-sm text-gray-500">No country access requests yet.</p>
        ) : (
          <div className="space-y-2">
            {designerFabricAccessRequests.map((request) => (
              <div key={request.id} className="rounded-lg border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {request.businessName || `Designer ${request.designerUserId.slice(0, 8)}`}
                    </p>
                    <p className="text-xs text-gray-500">
                      {request.email || 'No email'} • Home country: {request.homeCountry || 'N/A'}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">
                      Requested: {(request.requestedCountries || []).join(', ') || 'N/A'}
                    </p>
                    {request.reason ? (
                      <p className="mt-1 text-xs text-gray-600">Reason: {request.reason}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-gray-500">
                      Status: {request.status}
                      {request.reviewedByName ? ` • Reviewed by: ${request.reviewedByName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {request.status === 'PENDING' ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => reviewDesignerFabricAccessRequest(request, 'APPROVED')}
                          disabled={designerFabricAccessReviewingRequestId === request.id}
                        >
                          {designerFabricAccessReviewingRequestId === request.id ? 'Processing...' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reviewDesignerFabricAccessRequest(request, 'REJECTED')}
                          disabled={designerFabricAccessReviewingRequestId === request.id}
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-gray-500">{request.status}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDesignerFabricAccessRequestPage((prev) => Math.max(1, prev - 1))}
                disabled={designerFabricAccessRequestPage <= 1}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setDesignerFabricAccessRequestPage((prev) =>
                    Math.min(designerFabricAccessRequestTotalPages, prev + 1)
                  )
                }
                disabled={designerFabricAccessRequestPage >= designerFabricAccessRequestTotalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      </>
      ) : null}

      {!isConfigurationView ? (
      <>
      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['all', 'fabrics', 'designs', 'ready-to-wear'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'ready-to-wear' ? 'Ready to Wear' : tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-full md:w-[320px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Types</option>
          <option value="FABRIC">Fabric</option>
          <option value="DESIGN">Design</option>
          <option value="READY_TO_WEAR">Ready to Wear</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Countries</option>
          {countryOptions.map((country) => (
            <option key={country} value={country}>
              {country}
            </option>
          ))}
        </select>
        <select
          value={materialFilter}
          onChange={(e) => setMaterialFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Materials</option>
          {materialOptions.map((material) => (
            <option key={material} value={material}>
              {material}
            </option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Seller/Designer</option>
          {ownerOptions.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
        <Button
          variant="outline"
          onClick={() => {
            setCurrentPage(1);
            void fetchProducts(1);
          }}
        >
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
        <p>
          Showing page <span className="font-semibold">{currentPage}</span> of{' '}
          <span className="font-semibold">{totalPages}</span> • Total products:{' '}
          <span className="font-semibold">{totalProducts}</span>
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Rows per page</label>
          <select
            value={pageSize}
            onChange={(event) => setPageSize(Math.max(10, Number(event.target.value || 40)))}
            className="rounded-lg border px-2 py-1 text-sm"
          >
            {[20, 40, 80, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <span className="text-sm font-medium text-amber-900">{selectedVisibleIds.length} selected</span>
        <select
          value={bulkAction}
          onChange={(e) => setBulkAction(e.target.value as ModerationAction)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="REQUEST_CHANGES">Request Changes</option>
          <option value="APPROVE">Approve</option>
          <option value="REJECT">Reject</option>
          <option value="SUSPEND">Suspend</option>
          <option value="PUBLISH">Publish</option>
          <option value="UNPUBLISH">Unpublish</option>
        </select>
        <Button size="sm" disabled={selectedIds.length === 0 || submitting} onClick={handleBulkModeration}>
          {submitting ? 'Applying...' : 'Apply to selected'}
        </Button>
      </div>
      {(error || success) && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${error ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          {error || success}
        </div>
      )}

      {/* Products Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-4">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedVisibleIds.length === filteredProducts.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? filteredProducts.map((product) => product.id) : [])
                    }
                  />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Product</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Type</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Price</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Publish State</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Seller/Designer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Orders</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(product.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, product.id] : prev.filter((id) => id !== product.id)
                        )
                      }
                    />
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={String(product.image || product.images?.[0] || '/images/placeholder.jpg')}
                        alt={product.name}
                        className="h-10 w-10 rounded-lg object-cover border"
                      />
                      <div>
                        <p className="font-medium text-gray-900">
                          {product.name}
                          {product.isFeatured ? <Star className="ml-1 inline h-3.5 w-3.5 text-amber-500" /> : null}
                        </p>
                        {product.aiAutomationApprovedTag ? (
                          <p className="text-xs font-semibold text-emerald-700">AI Approved</p>
                        ) : null}
                        <p className="text-sm text-gray-500">{product.category}</p>
                        <p className="font-mono text-[11px] text-gray-400">ID: {product.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="secondary">{product.type}</Badge>
                  </td>
                  <td className="py-3 px-4 font-medium">${Number(product.finalPrice || 0).toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={
                        product.status === 'APPROVED' && product.isAvailable ? 'green' :
                        product.status === 'PENDING_REVIEW' ? 'yellow' :
                        product.status === 'REJECTED' ? 'red' : 'gray'
                      }
                    >
                      {statusLabel(product)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={product.status === 'APPROVED' && product.isAvailable ? 'green' : 'gray'}>
                      {product.status === 'APPROVED' && product.isAvailable ? 'PUBLISHED' : 'UNPUBLISHED'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {product.ownerName || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{product.orderCount}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleFeaturedFromList(product)}
                        className={`p-2 rounded-lg ${
                          product.isFeatured ? 'text-amber-600 bg-amber-50' : 'text-gray-400 hover:text-amber-600 hover:bg-amber-50'
                        }`}
                        title={product.isFeatured ? 'Remove featured' : 'Mark featured'}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      {product.status !== 'APPROVED' || !product.isAvailable ? (
                        <button
                          onClick={() => moderateProduct(product, 'PUBLISH')}
                          className="p-2 rounded-lg text-green-600 hover:bg-green-50"
                          title="Publish"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => moderateProduct(product, 'UNPUBLISH')}
                          className="p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                          title="Unpublish"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => openEditModal(product)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchProducts(Math.max(1, currentPage - 1))}
          disabled={loading || currentPage <= 1}
        >
          Previous
        </Button>
        <span className="px-2 text-sm text-gray-600">
          Page {currentPage} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchProducts(Math.min(totalPages, currentPage + 1))}
          disabled={loading || currentPage >= totalPages}
        >
          Next
        </Button>
      </div>
      </>
      ) : null}
      {!isConfigurationView && showModal ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-2xl rounded-xl bg-white p-6 max-h-[92vh] overflow-hidden">
            <h3 className="mb-4 text-xl font-bold text-gray-900">{editing ? 'Edit Product' : 'Add Product'}</h3>
            {modalError ? (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {modalError}
              </div>
            ) : null}
            <form onSubmit={saveProduct} className="flex h-[calc(92vh-120px)] flex-col">
              <div className="space-y-3 overflow-y-auto pr-1">
              {!editing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Product Type *</label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm((prev) => {
                        const nextType = e.target.value as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
                        return {
                          ...prev,
                          type: nextType,
                          featuredSection: getDefaultFeaturedSection(nextType),
                          readyVariants:
                            nextType === 'READY_TO_WEAR'
                              ? prev.readyVariants.length > 0
                                ? prev.readyVariants
                                : [{ size: 'M', color: 'DEFAULT', price: Number(prev.price || 0), stock: minReadyVariantStock }]
                              : prev.readyVariants,
                        };
                      })
                    }
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="FABRIC">Fabric</option>
                    <option value="DESIGN">Design</option>
                    <option value="READY_TO_WEAR">Ready To Wear</option>
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Product Name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Product name"
                  className="w-full rounded border px-3 py-2"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Description *</label>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Description"
                  className="h-24 w-full rounded border px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Base Price (USD, Admin) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))}
                    placeholder="Price in USD"
                    className="w-full rounded border px-3 py-2"
                  />
                  {selectedLocalCurrency ? (
                    <p className="mt-1 text-xs text-gray-500">
                      Seller/Designer local estimate for {selectedOwnerCountry}: {currencySymbolByCode[selectedLocalCurrency.currencyCode] || selectedLocalCurrency.currencyCode}{' '}
                      {(form.price / Number(selectedLocalCurrency.usdPerUnit || 1)).toFixed(2)} ({selectedLocalCurrency.currencyCode})
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">Admin uploads in USD. Local conversion appears after selecting seller/designer.</p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Review Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        status: e.target.value,
                        publishNow: e.target.value === 'APPROVED' ? prev.publishNow : false,
                      }))
                    }
                    className="w-full rounded border px-3 py-2"
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                    <option value="APPROVED">APPROVED</option>
                    <option value="REJECTED">REJECTED</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
                {(editing?.type || form.type) === 'FABRIC' ? (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Seller *</label>
                      <select
                        required={!editing}
                        value={form.sellerId}
                        onChange={(e) => setForm((prev) => ({ ...prev, sellerId: e.target.value }))}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select seller</option>
                        {options.sellers.length === 0 ? (
                          <option value="" disabled>No sellers available</option>
                        ) : null}
                        {options.sellers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.businessName} ({item.country})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Material Type *</label>
                      <select
                        required={!editing}
                        value={form.materialTypeId}
                        onChange={(e) => setForm((prev) => ({ ...prev, materialTypeId: e.target.value }))}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select material</option>
                        {options.materials.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Fabric Category (Fabric) *</label>
                      <select
                        required={!editing}
                        value={form.fabricCategoryId}
                        onChange={(e) => setForm((prev) => ({ ...prev, fabricCategoryId: e.target.value }))}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select fabric</option>
                        {options.fabricCategories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Designer *</label>
                      <select
                        required={!editing}
                        value={form.designerId}
                        onChange={(e) => setForm((prev) => ({ ...prev, designerId: e.target.value }))}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select designer</option>
                        {options.designers.length === 0 ? (
                          <option value="" disabled>No designers available</option>
                        ) : null}
                        {options.designers.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.businessName} ({item.country})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Style Category *</label>
                      <select
                        required={!editing}
                        value={form.categoryId}
                        onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="">Select style</option>
                        {options.categories.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {(editing?.type || form.type) === 'READY_TO_WEAR' ? (
                      <>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Material Type *</label>
                          <select
                            required
                            value={form.materialTypeId}
                            onChange={(e) => setForm((prev) => ({ ...prev, materialTypeId: e.target.value }))}
                            className="w-full rounded border px-3 py-2"
                          >
                            <option value="">Select material type</option>
                            {options.materials.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Fabric Category (Fabric) *</label>
                          <select
                            required
                            value={form.fabricCategoryId}
                            onChange={(e) => setForm((prev) => ({ ...prev, fabricCategoryId: e.target.value }))}
                            className="w-full rounded border px-3 py-2"
                          >
                            <option value="">Select fabric</option>
                            {options.fabricCategories.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : null}
                    <div className="md:col-span-2">
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        {(editing?.type || form.type) === 'READY_TO_WEAR'
                          ? 'Did you use any other material/fabric besides the primary fabric for the design?'
                          : 'Will you use any other material/fabric besides the primary fabric for this design?'}
                      </label>
                      <select
                        value={form.hasAdditionalMaterialOrFabric ? 'YES' : 'NO'}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, hasAdditionalMaterialOrFabric: e.target.value === 'YES' }))
                        }
                        className="w-full rounded border px-3 py-2"
                      >
                        <option value="NO">No</option>
                        <option value="YES">Yes</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              {(editing?.type || form.type) === 'READY_TO_WEAR' ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">
                      Ready-To-Wear Variants (Size + Color + Quantity, min stock {minReadyVariantStock})
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setReadyVariantsDirty(true);
                        setForm((prev) => ({
                          ...prev,
                          readyVariants: [
                            ...prev.readyVariants,
                            {
                              size: 'M',
                              color: 'DEFAULT',
                              price: Number(prev.price || 0),
                              stock: minReadyVariantStock,
                            },
                          ],
                        }));
                      }}
                    >
                      Add Variant
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {form.readyVariants.map((variant, index) => (
                      <div key={`${index}-${variant.size}-${variant.color}`} className="grid grid-cols-1 gap-2 rounded border p-2 md:grid-cols-12">
                        <input
                          value={variant.size}
                          onChange={(event) => {
                            setReadyVariantsDirty(true);
                            setForm((prev) => ({
                              ...prev,
                              readyVariants: prev.readyVariants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, size: event.target.value } : entry
                              ),
                            }));
                          }}
                          placeholder="Size (e.g. M)"
                          className="rounded border px-2 py-1 text-sm md:col-span-2"
                        />
                        <input
                          value={variant.color}
                          onChange={(event) => {
                            setReadyVariantsDirty(true);
                            setForm((prev) => ({
                              ...prev,
                              readyVariants: prev.readyVariants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, color: event.target.value } : entry
                              ),
                            }));
                          }}
                          placeholder="Color (e.g. Black)"
                          className="rounded border px-2 py-1 text-sm md:col-span-3"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={variant.price}
                          onChange={(event) => {
                            setReadyVariantsDirty(true);
                            setForm((prev) => ({
                              ...prev,
                              readyVariants: prev.readyVariants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, price: Number(event.target.value || 0) } : entry
                              ),
                            }));
                          }}
                          placeholder="Price"
                          className="rounded border px-2 py-1 text-sm md:col-span-2"
                        />
                        <input
                          type="number"
                          min={minReadyVariantStock}
                          step="1"
                          value={variant.stock}
                          onChange={(event) => {
                            setReadyVariantsDirty(true);
                            setForm((prev) => ({
                              ...prev,
                              readyVariants: prev.readyVariants.map((entry, rowIndex) =>
                                rowIndex === index ? { ...entry, stock: Number(event.target.value || 0) } : entry
                              ),
                            }));
                          }}
                          placeholder="Qty"
                          className="rounded border px-2 py-1 text-sm md:col-span-2"
                        />
                        <div className="md:col-span-3 flex justify-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReadyVariantsDirty(true);
                              setForm((prev) => ({
                                ...prev,
                                readyVariants: prev.readyVariants.filter((_, rowIndex) => rowIndex !== index),
                              }));
                            }}
                            disabled={form.readyVariants.length <= 1}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {(editing?.type || form.type) === 'DESIGN' && editing ? (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-sm font-medium text-gray-800">Design Details (full detail view)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded border bg-gray-50 px-3 py-2 text-sm">
                      <p className="text-xs text-gray-500">Predominant color</p>
                      <p className="font-medium text-gray-900">{String((editing as any).predominantColor || 'Not set')}</p>
                    </div>
                    <div className="rounded border bg-gray-50 px-3 py-2 text-sm">
                      <p className="text-xs text-gray-500">Required minimum yard (primary fabric)</p>
                      <p className="font-medium text-gray-900">
                        {Number((editing as any).requiredFabricYards || 0) > 0
                          ? `${Number((editing as any).requiredFabricYards).toFixed(2)} yards`
                          : 'Not set'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                      Required Measurements
                    </p>
                    {Array.isArray((editing as any).measurements) && (editing as any).measurements.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {(editing as any).measurements.map((row: any, index: number) => (
                          <span
                            key={`${String(row?.name || 'measurement')}-${index}`}
                            className="rounded border bg-white px-2 py-1 text-xs text-gray-700"
                          >
                            {String(row?.name || 'Measurement')}
                            {row?.unit ? ` (${String(row.unit)})` : ''}
                            {row?.isRequired === false ? ' • Optional' : ' • Required'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No measurement variables configured.</p>
                    )}
                  </div>
                  <div className="rounded border p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">Suitable Fabrics</p>
                    {Array.isArray((editing as any).suitableFabrics) && (editing as any).suitableFabrics.length > 0 ? (
                      <div className="space-y-2">
                        {(editing as any).suitableFabrics.map((row: any, index: number) => {
                          const minMeters = Number(row?.minMeters ?? row?.yardsNeeded ?? 0);
                          const maxMeters = Number(row?.maxMeters ?? row?.yardsNeeded ?? 0);
                          return (
                            <div key={`${String(row?.fabric?.id || index)}`} className="rounded border bg-white px-3 py-2">
                              <p className="text-sm font-medium text-gray-900">{String(row?.fabric?.name || `Fabric ${index + 1}`)}</p>
                              <p className="text-xs text-gray-500">
                                {String(row?.fabric?.seller?.businessName || 'Seller')} • {String(row?.fabric?.seller?.country || 'Country not set')}
                              </p>
                              <p className="text-xs text-gray-600">
                                Required range: {Number.isFinite(minMeters) ? minMeters.toFixed(2) : '0.00'}
                                {' - '}
                                {Number.isFinite(maxMeters) ? Math.max(maxMeters, minMeters).toFixed(2) : '0.00'} yards
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No suitable fabrics configured for this design.</p>
                    )}
                  </div>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isFeatured: e.target.checked,
                        featuredSection: e.target.checked
                          ? prev.featuredSection || getDefaultFeaturedSection(editing?.type || prev.type)
                          : prev.featuredSection,
                      }))
                    }
                  />
                  Featured on homepage
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.publishNow}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        publishNow: e.target.checked,
                        isAvailable: e.target.checked,
                        status: e.target.checked ? 'APPROVED' : prev.status,
                      }))
                    }
                  />
                  Publish on storefront
                </label>
              </div>
              {form.isFeatured ? (
                <select
                  value={form.featuredSection}
                  onChange={(e) => setForm((prev) => ({ ...prev, featuredSection: e.target.value }))}
                  className="w-full rounded border px-3 py-2"
                >
                  <option value="FEATURED_DESIGNS">Featured Designs</option>
                  <option value="FEATURED_FABRICS">Featured Fabrics</option>
                  <option value="FEATURED_READY_TO_WEAR">Featured Ready To Wear</option>
                  <option value="TRENDING_NOW">Trending Now</option>
                  <option value="NEW_ARRIVALS">New Arrivals</option>
                </select>
              ) : null}
              <div className="space-y-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Product Images ({getImagePolicy(activeProductType).min} - {getImagePolicy(activeProductType).max} required)
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    placeholder="Paste image URL and add"
                    className="w-full rounded border px-3 py-2"
                  />
                  <Button type="button" variant="outline" onClick={handleAddImageUrl}>
                    Add URL
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border px-3 py-2 text-sm hover:bg-gray-50">
                    <Upload className="mr-2 h-4 w-4" />
                    {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      multiple
                    />
                  </label>
                  <span className="text-xs text-gray-600">{form.images.length} image(s) selected</span>
                </div>
                {form.images.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {form.images.map((url) => (
                      <div key={url} className="relative overflow-hidden rounded border">
                        <img src={url} alt="Product" className="h-20 w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
              </div>
              <div className="sticky bottom-0 flex gap-3 border-t bg-white pt-3">
                <Button type="button" variant="outline" className="flex-1" onClick={() => { setShowModal(false); setModalError(''); }}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}</Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
