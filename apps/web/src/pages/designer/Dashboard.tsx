import { useState, useEffect } from 'react';
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
  Palette
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, LineChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

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
}

export default function DesignerDashboard() {
  const [stats, setStats] = useState<DesignerStats | null>(null);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [orders, setOrders] = useState<DesignOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [categories, setCategories] = useState<ProductCategoryOption[]>([]);
  const [fabricOptions, setFabricOptions] = useState<FabricOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'designs' | 'orders'>('overview');
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
  });
  const [searchParams, setSearchParams] = useSearchParams();

  const syncTabWithUrl = (tab: 'overview' | 'designs' | 'orders') => {
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
    if (tabParam === 'designs' || tabParam === 'orders' || tabParam === 'overview') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, designsRes, ordersRes, categoriesRes, fabricsRes] = await Promise.all([
        api.designer.getDashboard(),
        api.designer.getDesigns(),
        api.designer.getOrders(),
        api.products.getCategories(),
        api.products.getFabrics({ limit: 200 }),
      ]);

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

      const mappedOrders: DesignOrder[] = ordersRes.success
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

      if (statsRes.success) {
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
      if (designsRes.success) {
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
        }));
        setDesigns(mappedDesigns);
      }
      if (ordersRes.success) setOrders(mappedOrders);
      if (categoriesRes.success) {
        setCategories(
          Array.isArray(categoriesRes.data)
            ? categoriesRes.data.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Category') }))
            : []
        );
      }
      if (fabricsRes.success) {
        const rows = Array.isArray(fabricsRes.data?.fabrics) ? fabricsRes.data.fabrics : [];
        setFabricOptions(rows.map((item: any) => ({ id: String(item.id), name: String(item.name || 'Fabric') })));
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
      basePrice: String(design.basePrice || ''),
      imageUrls: (design.images || []).join('\n'),
      selectedFabricIds: (design.suitableFabrics || []).map((item) => item.fabricId).filter(Boolean),
      yardsByFabricId,
      measurementLines: measurementLines || 'chest|cm|required\nwaist|cm|required\nhips|cm|required',
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

  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const inProductionOrders = orders.filter(o => o.status === 'IN_PRODUCTION');

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
        </div>
        <Button onClick={openCreateDesignModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Design Product
        </Button>
      </div>

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
          {(['overview', 'designs', 'orders'] as const).map((tab) => (
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
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">My Designs</h2>
            <Button size="sm" onClick={openCreateDesignModal}>
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {designs.map((design) => (
              <div key={design.id} className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
                <div className="relative">
                  <img
                    src={design.images[0] || '/images/placeholder.jpg'}
                    alt={design.name}
                    className="w-full h-56 object-cover"
                  />
                  <Badge 
                    variant={design.status === 'ACTIVE' ? 'green' : 'gray'}
                    className="absolute top-3 right-3"
                  >
                    {design.status}
                  </Badge>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{design.name}</h3>
                      <p className="text-sm text-gray-500">{design.category.name}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">Price</p>
                      <p className="font-medium text-amber-700">${design.basePrice}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Rating</p>
                      <p className="font-medium text-gray-900">⭐ {Number(design.rating || 0).toFixed(1)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Orders</p>
                      <p className="font-medium text-gray-900">{design.orderCount}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => openEditDesignModal(design)}>
                      <Edit className="w-4 h-4 mr-1" />
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link to={`/designs/${design.id}`}>
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={designForm.basePrice}
                  onChange={(e) => setDesignForm((prev) => ({ ...prev, basePrice: e.target.value }))}
                  className="w-full px-4 py-2 border rounded-lg"
                />
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
