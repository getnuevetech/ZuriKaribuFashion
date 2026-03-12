import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Plus, Edit, Package, Scissors, Upload, Star, CheckCircle, XCircle } from 'lucide-react';
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
  orderCount: number;
  image?: string | null;
  sizeVariations?: Array<{ id?: string; size: string; color?: string; variantKey?: string; price: number; stock: number }>;
  isFeatured?: boolean;
  featuredSections?: string[];
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

const STATIC_COUNTRIES = getCountryOptions().map((entry) => String(entry.name || '').trim()).filter(Boolean);

export default function AdminProducts() {
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
  const [options, setOptions] = useState<{
    categories: Array<{ id: string; name: string }>;
    materials: Array<{ id: string; name: string }>;
    sellers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string }>;
    designers: Array<{ id: string; businessName: string; country: string; ownerUserId?: string }>;
  }>({ categories: [], materials: [], sellers: [], designers: [] });
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
  const [form, setForm] = useState({
    type: 'FABRIC' as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR',
    name: '',
    description: '',
    price: 0,
    materialTypeId: '',
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
    stock: 0,
    size: 'M',
    readyVariants: [{ size: 'M', color: 'DEFAULT', price: 0, stock: 0 }] as ReadyVariantRow[],
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
  }, []);

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
    const [productOptionsResult, currencyResult, ownerResult, categoriesResult, materialsResult, sellerProfilesResult, designerProfilesResult] =
      await Promise.allSettled([
      api.admin.getProductOptions(),
      api.currency.getConfig(),
      api.homepageSections.getAdminDesignerOptions(),
      api.admin.getCategories(),
      api.admin.getMaterials(),
      api.admin.getVendorProfiles({ role: 'FABRIC_SELLER', page: 1, limit: 500 }),
      api.admin.getVendorProfiles({ role: 'FASHION_DESIGNER', page: 1, limit: 500 }),
    ]);

    const productOptions =
      productOptionsResult.status === 'fulfilled' && productOptionsResult.value.success
        ? productOptionsResult.value.data
        : null;
    const categoriesFromProducts = Array.isArray(productOptions?.categories) ? productOptions.categories : [];
    const materialsFromProducts = Array.isArray(productOptions?.materials) ? productOptions.materials : [];
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

  const fetchProducts = async (pageOverride?: number) => {
    try {
      setLoading(true);
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
      stock: 0,
      size: 'M',
      readyVariants: [{ size: 'M', color: 'DEFAULT', price: 0, stock: 0 }],
    });
    setImagesDirty(false);
    setReadyVariantsDirty(false);
    setImageUrlInput('');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    const matchedCategoryId =
      String(product.categoryId || '').trim() ||
      options.categories.find((item) => String(item.name || '').trim().toLowerCase() === String(product.category || '').trim().toLowerCase())?.id ||
      '';
    const matchedMaterialTypeId =
      options.materials.find((item) => String(item.name || '').trim().toLowerCase() === String(product.category || '').trim().toLowerCase())?.id ||
      '';
    const existingReadyVariants = (
      Array.isArray((product as any).readyVariants)
        ? (product as any).readyVariants
        : Array.isArray((product as any).sizeVariations)
          ? (product as any).sizeVariations
          : []
    )
      .map((entry: any) => ({
        size: String(entry?.size || '').trim() || 'M',
        color: String(entry?.color || 'DEFAULT').trim() || 'DEFAULT',
        price: Number(entry?.price || product.finalPrice || 0),
        stock: Math.max(0, Number(entry?.stock || 0)),
      }))
      .filter((entry: any) => entry.size && Number.isFinite(entry.price));

    setEditing(product);
    setError('');
    setSuccess('');
    setModalError('');
    setForm({
      type: product.type,
      name: product.name,
      description: product.description || '',
      price: Number(product.finalPrice || 0),
      materialTypeId: matchedMaterialTypeId,
      categoryId: matchedCategoryId,
      sellerId: product.sellerId || '',
      designerId: product.designerId || '',
      status: product.status,
      isAvailable: product.isAvailable,
      publishNow: product.status === 'APPROVED' && product.isAvailable,
      isFeatured: Boolean(product.isFeatured),
      featuredSection: product.featuredSections?.[0] || getDefaultFeaturedSection(product.type),
      images: product.image ? [product.image] : [],
      minYards: 1,
      stockYards: 0,
      stock: Math.max(0, Number(existingReadyVariants[0]?.stock || 0)),
      size: 'M',
      readyVariants:
        existingReadyVariants.length > 0
          ? existingReadyVariants
          : [{ size: 'M', color: 'DEFAULT', price: Number(product.finalPrice || 0), stock: 0 }],
    });
    setImagesDirty(false);
    setReadyVariantsDirty(false);
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
        if (!editing && !form.materialTypeId) {
          setModalError('Please select a material type for this fabric product.');
          setSaving(false);
          return;
        }
      } else {
        if (!editing && !form.designerId) {
          setModalError('Please select a designer for this product.');
          setSaving(false);
          return;
        }
        if (!editing && !form.categoryId) {
          setModalError('Please select a style for this product.');
          setSaving(false);
          return;
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
              Number(variant.stock || 0) < 0
          )
        ) {
          setModalError('Each ready-to-wear variant needs size, price > 0, and stock >= 0.');
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
          categoryId: form.categoryId || undefined,
          stock: isFabricEdit ? form.stock : undefined,
          stockYards: isFabricEdit ? form.stockYards : undefined,
          minYards: isFabricEdit ? form.minYards : undefined,
          variants:
            isReadyEdit && readyVariantsDirty
              ? form.readyVariants.map((variant) => ({
                  size: String(variant.size || '').trim().toUpperCase(),
                  color: String(variant.color || 'DEFAULT').trim().toUpperCase() || 'DEFAULT',
                  price: Number(variant.price || 0),
                  stock: Math.max(0, Math.floor(Number(variant.stock || 0))),
                }))
              : undefined,
        });
      } else {
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
          materialTypeId: form.type === 'FABRIC' || form.type === 'DESIGN' ? form.materialTypeId || undefined : undefined,
          categoryId: form.type !== 'FABRIC' ? form.categoryId : undefined,
          status: resolvedStatus,
          isAvailable: resolvedIsAvailable,
          images: form.images,
          minYards: form.minYards,
          stockYards: form.stockYards,
          stock: form.stock,
          size: form.size || undefined,
          variants:
            form.type === 'READY_TO_WEAR'
              ? form.readyVariants.map((variant) => ({
                  size: String(variant.size || '').trim().toUpperCase(),
                  color: String(variant.color || 'DEFAULT').trim().toUpperCase() || 'DEFAULT',
                  price: Number(variant.price || 0),
                  stock: Math.max(0, Math.floor(Number(variant.stock || 0))),
                }))
              : undefined,
        });
        savedId = created.data?.id || null;
        savedType = (created.data?.type as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') || form.type;
      }

      if (savedId) {
        await api.admin.setProductFeatured(savedType, savedId, {
          isFeatured: form.isFeatured,
          section: form.isFeatured ? form.featuredSection : undefined,
          displayOrder: 0,
        });
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
      setError('Failed to update featured status.');
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
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Product Taxonomy Management</h2>
          <p className="text-xs text-gray-500">
            Manage material types used for Fabrics and styles used for Custom/Ready-to-Wear uploads.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        product.type === 'FABRIC' ? 'bg-blue-100' :
                        product.type === 'DESIGN' ? 'bg-purple-100' : 'bg-green-100'
                      }`}>
                        {product.type === 'FABRIC' ? (
                          <Package className="w-5 h-5 text-blue-600" />
                        ) : product.type === 'DESIGN' ? (
                          <Scissors className="w-5 h-5 text-purple-600" />
                        ) : (
                          <Package className="w-5 h-5 text-green-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {product.name}
                          {product.isFeatured ? <Star className="ml-1 inline h-3.5 w-3.5 text-amber-500" /> : null}
                        </p>
                        <p className="text-sm text-gray-500">{product.category}</p>
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
      {showModal && (
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
                              : [{ size: 'M', color: 'DEFAULT', price: Number(prev.price || 0), stock: 0 }]
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
                    <select required={!editing} value={form.sellerId} onChange={(e) => setForm((prev) => ({ ...prev, sellerId: e.target.value }))} className="rounded border px-3 py-2">
                      <option value="">Select seller</option>
                      {options.sellers.length === 0 ? (
                        <option value="" disabled>No sellers available</option>
                      ) : null}
                      {options.sellers.map((item) => (
                        <option key={item.id} value={item.id}>{item.businessName} ({item.country})</option>
                      ))}
                    </select>
                    <select required={!editing} value={form.materialTypeId} onChange={(e) => setForm((prev) => ({ ...prev, materialTypeId: e.target.value }))} className="rounded border px-3 py-2">
                      <option value="">Select material</option>
                      {options.materials.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </>
                ) : (
                  <>
                    <select required={!editing} value={form.designerId} onChange={(e) => setForm((prev) => ({ ...prev, designerId: e.target.value }))} className="rounded border px-3 py-2">
                      <option value="">Select designer</option>
                      {options.designers.length === 0 ? (
                        <option value="" disabled>No designers available</option>
                      ) : null}
                      {options.designers.map((item) => (
                        <option key={item.id} value={item.id}>{item.businessName} ({item.country})</option>
                      ))}
                    </select>
                    <select required={!editing} value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="rounded border px-3 py-2">
                      <option value="">Select style</option>
                      {options.categories.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              {(editing?.type || form.type) === 'READY_TO_WEAR' ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">Ready-To-Wear Variants (Size + Color + Quantity)</p>
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
                            { size: 'M', color: 'DEFAULT', price: Number(prev.price || 0), stock: 0 },
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
                          min={0}
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
      )}
    </div>
  );
}
