import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Plus, Edit, Package, Scissors, Upload, Star, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

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
  category: string;
  orderCount: number;
  image?: string | null;
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

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fabrics' | 'designs' | 'ready-to-wear'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<ModerationAction>('REQUEST_CHANGES');
  const [imagesDirty, setImagesDirty] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [currencyMatrix, setCurrencyMatrix] = useState<CurrencyMatrixRow[]>([]);
  const [options, setOptions] = useState<{
    categories: Array<{ id: string; name: string }>;
    materials: Array<{ id: string; name: string }>;
    sellers: Array<{ id: string; businessName: string; country: string }>;
    designers: Array<{ id: string; businessName: string; country: string }>;
  }>({ categories: [], materials: [], sellers: [], designers: [] });
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
  });

  const getDefaultFeaturedSection = (type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') => {
    if (type === 'FABRIC') return 'FEATURED_FABRICS';
    if (type === 'READY_TO_WEAR') return 'FEATURED_READY_TO_WEAR';
    return 'FEATURED_DESIGNS';
  };

  const getImagePolicy = (type: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR') => {
    if (type === 'READY_TO_WEAR') return { min: 3, max: 4, label: 'Ready To Wear' };
    return { min: 4, max: 6, label: type === 'DESIGN' ? 'Custom To Wear / Designer' : 'Designer / Fabric' };
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

  useEffect(() => {
    void Promise.all([fetchProducts(), fetchOptions()]);
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [typeFilter, statusFilter, activeTab]);

  const effectiveType = useMemo(() => {
    if (activeTab === 'fabrics') return 'FABRIC';
    if (activeTab === 'designs') return 'DESIGN';
    if (activeTab === 'ready-to-wear') return 'READY_TO_WEAR';
    return typeFilter || undefined;
  }, [activeTab, typeFilter]);

  const activeProductType = (editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  const selectedOwnerCountry = useMemo(() => {
    if (activeProductType === 'FABRIC') {
      const seller = options.sellers.find((item) => item.id === form.sellerId);
      return String(seller?.country || '').trim();
    }
    const designer = options.designers.find((item) => item.id === form.designerId);
    return String(designer?.country || '').trim();
  }, [activeProductType, options.sellers, options.designers, form.sellerId, form.designerId]);

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
    try {
      const [response, currencyResponse] = await Promise.all([
        api.admin.getProductOptions(),
        api.currency.getConfig(),
      ]);
      if (response.success) {
        const normalizeOwnerName = (name: string | undefined, role: 'Seller' | 'Designer', id: string) => {
          const trimmed = String(name || '').trim();
          return trimmed || `${role} ${String(id || '').slice(0, 8)}`;
        };
        setOptions({
          categories: Array.isArray(response.data?.categories) ? response.data.categories : [],
          materials: Array.isArray(response.data?.materials) ? response.data.materials : [],
          sellers: Array.isArray(response.data?.sellers)
            ? response.data.sellers.map((item: any) => ({
                id: String(item.id || ''),
                businessName: normalizeOwnerName(item.businessName, 'Seller', item.id),
                country: String(item.country || '').trim(),
              }))
            : [],
          designers: Array.isArray(response.data?.designers)
            ? response.data.designers.map((item: any) => ({
                id: String(item.id || ''),
                businessName: normalizeOwnerName(item.businessName, 'Designer', item.id),
                country: String(item.country || '').trim(),
              }))
            : [],
        });
      }
      const currentSellers = Array.isArray(response.data?.sellers) ? response.data.sellers : [];
      const currentDesigners = Array.isArray(response.data?.designers) ? response.data.designers : [];
      if (currentSellers.length === 0 && currentDesigners.length === 0) {
        try {
          const ownerFallback = await api.homepageSections.getAdminDesignerOptions();
          if (ownerFallback.success && Array.isArray(ownerFallback.data) && ownerFallback.data.length > 0) {
            const sellers = ownerFallback.data
              .filter((item) => String(item.vendorType || '').toUpperCase() === 'SELLER')
              .map((item) => ({
                id: String(item.id || ''),
                businessName: String(item.businessName || '').trim() || `Seller ${String(item.id || '').slice(0, 8)}`,
                country: String(item.country || '').trim(),
              }));
            const designers = ownerFallback.data
              .filter((item) => String(item.vendorType || 'DESIGNER').toUpperCase() !== 'SELLER')
              .map((item) => ({
                id: String(item.id || ''),
                businessName: String(item.businessName || '').trim() || `Designer ${String(item.id || '').slice(0, 8)}`,
                country: String(item.country || '').trim(),
              }));
            setOptions((prev) => ({
              ...prev,
              sellers,
              designers,
            }));
          }
        } catch (ownerFallbackError) {
          console.error('Failed to load seller/designer fallback options', ownerFallbackError);
        }
      }
      if (currencyResponse.success) {
        setCurrencyMatrix(Array.isArray(currencyResponse.data?.matrix) ? currencyResponse.data.matrix : []);
      }
    } catch (err) {
      console.error('Failed to fetch product options', err);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getProducts({
        search: search || undefined,
        status: statusFilter || undefined,
        type: (effectiveType as any) || undefined,
        page: 1,
        limit: 200,
      });
      if (response.success) {
        setProducts(response.data.products || []);
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
    });
    setImagesDirty(false);
    setImageUrlInput('');
    setShowModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditing(product);
    setError('');
    setSuccess('');
    setForm({
      type: product.type,
      name: product.name,
      description: product.description || '',
      price: Number(product.finalPrice || 0),
      materialTypeId: '',
      categoryId: '',
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
      stock: 0,
      size: 'M',
    });
    setImagesDirty(false);
    setImageUrlInput('');
    setShowModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      const currentType = (editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
      const imagePolicy = getImagePolicy(currentType);
      const imageCount = form.images.length;
      if (imageCount < imagePolicy.min || imageCount > imagePolicy.max) {
        setError(`${imagePolicy.label} requires between ${imagePolicy.min} and ${imagePolicy.max} images.`);
        setSaving(false);
        return;
      }
      const resolvedStatus = form.publishNow ? 'APPROVED' : form.status;
      const resolvedIsAvailable = form.publishNow ? true : false;
      let savedType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR' = editing ? editing.type : form.type;
      let savedId: string | null = editing?.id || null;
      if (editing) {
        await api.admin.updateProduct(editing.type, editing.id, {
          name: form.name,
          description: form.description,
          price: form.price,
          status: resolvedStatus,
          isAvailable: resolvedIsAvailable,
          images: imagesDirty ? form.images : undefined,
          materialTypeId: form.materialTypeId || undefined,
          categoryId: form.categoryId || undefined,
          stock: form.stock,
          stockYards: form.stockYards,
          minYards: form.minYards,
        });
      } else {
        const created = await api.admin.createProduct({
          type: form.type,
          name: form.name,
          description: form.description,
          price: form.price,
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
      setImagesDirty(false);
      setImageUrlInput('');
      await fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Failed to save product.');
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
        setError('Image upload failed.');
        return;
      }
      const policy = getImagePolicy((editing?.type || form.type) as 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR');
      setForm((prev) => {
        const merged = Array.from(new Set([...prev.images, ...uploadedUrls]));
        const trimmed = merged.slice(0, policy.max);
        if (merged.length > policy.max) {
          setError(`${policy.label} allows a maximum of ${policy.max} images.`);
        }
        return { ...prev, images: trimmed };
      });
      setImagesDirty(true);
      setSuccess('Image(s) uploaded successfully.');
    } catch (uploadError) {
      console.error('Failed to upload product image:', uploadError);
      setError('Failed to upload image.');
    } finally {
      setUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const value = imageUrlInput.trim();
    if (!value) return;
    const policy = getImagePolicy(activeProductType);
    setForm((prev) => {
      const merged = Array.from(new Set([...prev.images, value])).slice(0, policy.max);
      if (prev.images.length >= policy.max) {
        setError(`${policy.label} allows a maximum of ${policy.max} images.`);
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
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
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
        <Button variant="outline" onClick={fetchProducts}>
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
        <span className="text-sm font-medium text-amber-900">{selectedIds.length} selected</span>
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
                    checked={products.length > 0 && selectedIds.length === products.length}
                    onChange={(e) =>
                      setSelectedIds(e.target.checked ? products.map((product) => product.id) : [])
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
              {products.map((product) => (
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6">
            <h3 className="mb-4 text-xl font-bold text-gray-900">{editing ? 'Edit Product' : 'Add Product'}</h3>
            <form onSubmit={saveProduct} className="space-y-3">
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
                      {options.designers.map((item) => (
                        <option key={item.id} value={item.id}>{item.businessName} ({item.country})</option>
                      ))}
                    </select>
                    <select required={!editing} value={form.categoryId} onChange={(e) => setForm((prev) => ({ ...prev, categoryId: e.target.value }))} className="rounded border px-3 py-2">
                      <option value="">Select category</option>
                      {options.categories.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
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
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={saving}>{saving ? 'Saving...' : editing ? 'Update Product' : 'Create Product'}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
