import { useState, useEffect } from 'react';
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
  ArrowRight
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, LineChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

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
  pricePerMeter: number;
  stockMeters: number;
  images: string[];
  orderCount: number;
  status: string;
  materialType: { name: string };
  minOrderMeters: number;
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

export default function SellerDashboard() {
  const [stats, setStats] = useState<SellerStats | null>(null);
  const [fabrics, setFabrics] = useState<Fabric[]>([]);
  const [orders, setOrders] = useState<FabricOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'fabrics' | 'orders'>('overview');
  const [showStockModal, setShowStockModal] = useState(false);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [newStock, setNewStock] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();

  const syncTabWithUrl = (tab: 'overview' | 'fabrics' | 'orders') => {
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
    if (tabParam === 'fabrics' || tabParam === 'orders' || tabParam === 'overview') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, fabricsRes, ordersRes] = await Promise.all([
        api.seller.getDashboard(),
        api.seller.getFabrics(),
        api.seller.getOrders()
      ]);

      if (dashboardRes.success) {
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
      if (fabricsRes.success) {
        const mappedFabrics = (fabricsRes.data || []).map((item: any) => ({
          id: String(item.id),
          name: item.name || 'Fabric',
          pricePerMeter: Number(item.finalPrice ?? item.sellerPrice ?? 0),
          stockMeters: Number(item.stockYards ?? 0),
          images: Array.isArray(item.images)
            ? item.images.map((img: any) => img?.url).filter(Boolean)
            : [],
          orderCount: Number(item?._count?.orderItems ?? 0),
          status: item.status || 'DRAFT',
          materialType: item.materialType || { name: 'Material' },
          minOrderMeters: Number(item.minYards ?? 1),
        }));
        setFabrics(mappedFabrics);
      }
      if (ordersRes.success) {
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

  const lowStockFabrics = fabrics.filter(f => f.stockMeters < 20);
  const pendingOrders = orders.filter(o => o.status === 'CONFIRMED');

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
        </div>
        <Button asChild>
          <Link to="/seller?tab=fabrics">
            <Plus className="w-4 h-4 mr-2" />
            Manage Fabrics
          </Link>
        </Button>
      </div>

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
          {(['overview', 'fabrics', 'orders'] as const).map((tab) => (
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
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">My Fabrics</h2>
            <Button size="sm" asChild>
              <Link to="/seller?tab=fabrics">
                <Plus className="w-4 h-4 mr-2" />
                Add/Manage Fabric
              </Link>
            </Button>
          </div>
          <DataTable
            columns={[
              { 
                key: 'name', 
                header: 'Fabric',
                render: (item) => (
                  <div className="flex items-center gap-3">
                    <img src={item.images[0]} alt={item.name} className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.materialType?.name}</p>
                    </div>
                  </div>
                )
              },
              { 
                key: 'pricePerMeter', 
                header: 'Price',
                render: (item) => `$${item.pricePerMeter}/m`
              },
              { 
                key: 'stockMeters', 
                header: 'Stock',
                render: (item) => (
                  <span className={item.stockMeters < 20 ? 'text-red-600 font-medium' : ''}>
                    {item.stockMeters}m
                  </span>
                )
              },
              { key: 'orderCount', header: 'Orders' },
              { 
                key: 'status', 
                header: 'Status',
                render: (item) => (
                  <Badge variant={item.status === 'ACTIVE' ? 'green' : 'gray'}>
                    {item.status}
                  </Badge>
                )
              },
            ]}
            data={fabrics}
            keyExtractor={(item) => item.id}
            searchable
            searchKeys={['name', 'materialType.name']}
            actions={(item) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openStockModal(item)}>
                  <Edit className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/fabrics/${item.id}`}>
                    <Eye className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            )}
          />
        </div>
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
