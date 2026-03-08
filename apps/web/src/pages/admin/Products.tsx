import { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Plus, Edit, Package, Scissors } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

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
  createdAt: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'fabrics' | 'designs' | 'ready-to-wear'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
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
    isAvailable: true,
    image: '',
    minYards: 1,
    stockYards: 0,
    stock: 0,
    size: 'M',
  });

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

  const fetchOptions = async () => {
    try {
      const response = await api.admin.getProductOptions();
      if (response.success) {
        setOptions(response.data);
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
      isAvailable: true,
      image: '',
      minYards: 1,
      stockYards: 0,
      stock: 0,
      size: 'M',
    });
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
      image: product.image || '',
      minYards: 1,
      stockYards: 0,
      stock: 0,
      size: 'M',
    });
    setShowModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      if (editing) {
        await api.admin.updateProduct(editing.type, editing.id, {
          name: form.name,
          description: form.description,
          price: form.price,
          status: form.status,
          isAvailable: form.isAvailable,
          image: form.image || undefined,
          materialTypeId: form.materialTypeId || undefined,
          categoryId: form.categoryId || undefined,
          stock: form.stock,
          stockYards: form.stockYards,
          minYards: form.minYards,
        });
        setSuccess('Product updated successfully.');
      } else {
        await api.admin.createProduct({
          type: form.type,
          name: form.name,
          description: form.description,
          price: form.price,
          sellerId: form.type === 'FABRIC' ? form.sellerId : undefined,
          designerId: form.type !== 'FABRIC' ? form.designerId : undefined,
          materialTypeId: form.type === 'FABRIC' || form.type === 'DESIGN' ? form.materialTypeId || undefined : undefined,
          categoryId: form.type !== 'FABRIC' ? form.categoryId : undefined,
          status: form.status,
          isAvailable: form.isAvailable,
          image: form.image || undefined,
          minYards: form.minYards,
          stockYards: form.stockYards,
          stock: form.stock,
          size: form.size || undefined,
        });
        setSuccess('Product created successfully.');
      }
      setShowModal(false);
      await fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Failed to save product.');
    } finally {
      setSaving(false);
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
                        <p className="font-medium text-gray-900">{product.name}</p>
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
                        product.status === 'APPROVED' ? 'green' :
                        product.status === 'PENDING_REVIEW' ? 'yellow' :
                        product.status === 'REJECTED' ? 'red' : 'gray'
                      }
                    >
                      {product.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {product.ownerName || 'N/A'}
                  </td>
                  <td className="py-3 px-4 text-gray-600">{product.orderCount}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
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
                <select value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as any }))} className="w-full rounded border px-3 py-2">
                  <option value="FABRIC">Fabric</option>
                  <option value="DESIGN">Design</option>
                  <option value="READY_TO_WEAR">Ready To Wear</option>
                </select>
              )}
              <input required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Product name" className="w-full rounded border px-3 py-2" />
              <textarea required value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Description" className="h-24 w-full rounded border px-3 py-2" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input type="number" step="0.01" required value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) || 0 }))} placeholder="Price" className="rounded border px-3 py-2" />
                <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded border px-3 py-2">
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="REJECTED">REJECTED</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
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
              <input type="url" value={form.image} onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))} placeholder="Image URL (optional)" className="w-full rounded border px-3 py-2" />
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.isAvailable} onChange={(e) => setForm((prev) => ({ ...prev, isAvailable: e.target.checked }))} />
                Available on storefront
              </label>
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
