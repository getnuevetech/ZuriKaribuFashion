import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  Package,
  AlertCircle,
  CheckCircle,
  Clock,
  ArrowRight,
  Calendar,
  MapPin,
  Star,
  MoreHorizontal,
  Filter,
  Download,
  Sparkles
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, LineChart, PieChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
  totalProducts: number;
  pendingOrders: number;
  inProductionOrders: number;
  revenueChange: number;
  orderChange: number;
  userChange: number;
  productChange: number;
  monthlyRevenue: { label: string; value: number }[];
  ordersByStatus: { label: string; value: number; color?: string }[];
  usersByRole: { label: string; value: number; color?: string }[];
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  items: number;
}

interface Activity {
  id: string;
  type: 'order' | 'user' | 'product' | 'review' | 'system';
  title: string;
  description: string;
  timestamp: string;
  user?: { name: string; avatar?: string };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [tryOnInsights, setTryOnInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');

  useEffect(() => {
    fetchDashboardData();
  }, [dateRange]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, ordersRes, tryOnRes] = await Promise.all([
        api.admin.getDashboardStats(),
        api.admin.getRecentOrders(),
        api.admin.getTryOnInsights()
      ]);
      
      if (statsRes.success) {
        setStats(statsRes.data);
      }
      if (ordersRes.success) {
        setRecentOrders(ordersRes.data);
      }
      if (tryOnRes.success) {
        setTryOnInsights(tryOnRes.data || null);
      }
      
      // Mock activities for now
      setActivities([
        {
          id: '1',
          type: 'order',
          title: 'New order received',
          description: 'Order #ORD-2024-001 for $299.00',
          timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
          user: { name: 'Sarah Johnson' }
        },
        {
          id: '2',
          type: 'user',
          title: 'New designer registered',
          description: 'Amara Okafor from Lagos, Nigeria',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: '3',
          type: 'review',
          title: 'QA Review completed',
          description: 'Order #ORD-2024-045 approved for shipping',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          user: { name: 'QA Team' }
        },
        {
          id: '4',
          type: 'product',
          title: 'New design published',
          description: 'Royal Kente Gown by Amma Designs',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '5',
          type: 'order',
          title: 'Order shipped',
          description: 'Order #ORD-2024-038 shipped to New York',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString()}`;

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
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button variant="outline" onClick={fetchDashboardData}>
            <Calendar className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats?.totalRevenue || 0)}
          change={stats?.revenueChange}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
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
          title="Total Users"
          value={stats?.totalUsers || 0}
          change={stats?.userChange}
          icon={Users}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
        <StatCard
          title="Products"
          value={stats?.totalProducts || 0}
          change={stats?.productChange}
          icon={Package}
          iconColor="text-amber-600"
          iconBgColor="bg-amber-100"
        />
      </div>

      <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-purple-700" />
            <div>
              <p className="font-medium text-purple-900">3D TryON Insights</p>
              <p className="text-sm text-purple-800">
                Total TryON runs: <span className="font-semibold">{Number(tryOnInsights?.totalTryOns || 0)}</span>
              </p>
              <p className="mt-1 text-xs text-purple-700">
                {Object.entries(tryOnInsights?.measurementAverages || {})
                  .slice(0, 5)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(' • ') || 'No measurement trends yet.'}
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/try-on">Manage TryON Settings</Link>
          </Button>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Revenue Overview</h3>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
          <LineChart 
            data={stats?.monthlyRevenue || [
              { label: 'Jan', value: 12000 },
              { label: 'Feb', value: 15000 },
              { label: 'Mar', value: 18000 },
              { label: 'Apr', value: 14000 },
              { label: 'May', value: 22000 },
              { label: 'Jun', value: 28000 },
            ]} 
            height={250}
          />
        </div>

        {/* Orders by Status */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Orders by Status</h3>
          <PieChart 
            data={stats?.ordersByStatus || [
              { label: 'Pending', value: 24, color: '#fbbf24' },
              { label: 'In Production', value: 18, color: '#a855f7' },
              { label: 'QA Review', value: 12, color: '#3b82f6' },
              { label: 'Shipped', value: 35, color: '#06b6d4' },
              { label: 'Delivered', value: 89, color: '#22c55e' },
            ]}
            size={180}
          />
        </div>
      </div>

      {/* Order Status & User Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Overview */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Order Status Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-900">Pending</span>
              </div>
              <p className="text-3xl font-bold text-yellow-700">{stats?.pendingOrders || 0}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-medium text-purple-900">In Production</span>
              </div>
              <p className="text-3xl font-bold text-purple-700">{stats?.inProductionOrders || 0}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">QA Review</span>
              </div>
              <p className="text-3xl font-bold text-blue-700">12</p>
            </div>
            <div className="p-4 bg-green-50 rounded-xl border border-green-100">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm font-medium text-green-900">Completed</span>
              </div>
              <p className="text-3xl font-bold text-green-700">89</p>
            </div>
          </div>
        </div>

        {/* User Distribution */}
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">User Distribution</h3>
          <BarChart 
            data={stats?.usersByRole || [
              { label: 'Customers', value: 1250, color: 'bg-blue-500' },
              { label: 'Designers', value: 85, color: 'bg-purple-500' },
              { label: 'Sellers', value: 120, color: 'bg-amber-500' },
              { label: 'QA Team', value: 15, color: 'bg-green-500' },
            ]}
            height={150}
          />
        </div>
      </div>

      {/* Recent Orders & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <DataTable
            title="Recent Orders"
            columns={[
              { key: 'orderNumber', header: 'Order ID' },
              { key: 'customerName', header: 'Customer' },
              { 
                key: 'totalAmount', 
                header: 'Amount',
                render: (item) => `$${item.totalAmount.toFixed(2)}`
              },
              { 
                key: 'status', 
                header: 'Status',
                render: (item) => (
                  <Badge 
                    variant={
                      item.status === 'DELIVERED' ? 'green' :
                      item.status === 'SHIPPED' ? 'blue' :
                      item.status === 'IN_PRODUCTION' ? 'purple' :
                      item.status === 'PENDING' ? 'yellow' : 'gray'
                    }
                  >
                    {item.status}
                  </Badge>
                )
              },
              { 
                key: 'createdAt', 
                header: 'Date',
                render: (item) => new Date(item.createdAt).toLocaleDateString()
              },
            ]}
            data={recentOrders}
            keyExtractor={(item) => item.id}
            searchable
            searchKeys={['orderNumber', 'customerName']}
            pageSize={5}
            actions={(item) => (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/admin/orders">
                  View
                </Link>
              </Button>
            )}
          />
        </div>

        {/* Activity Feed */}
        <ActivityFeed activities={activities} />
      </div>

      {/* Quick Actions */}
      <div className="bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Quick Actions</h3>
            <p className="text-amber-100 text-sm mt-1">Manage your platform efficiently</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" className="bg-white text-amber-600 hover:bg-amber-50" asChild>
              <Link to="/admin/users">
                <Users className="w-4 h-4 mr-2" />
                Manage Users
              </Link>
            </Button>
            <Button variant="secondary" className="bg-white text-amber-600 hover:bg-amber-50" asChild>
              <Link to="/admin/products">
                <Package className="w-4 h-4 mr-2" />
                Products
              </Link>
            </Button>
            <Button variant="secondary" className="bg-white text-amber-600 hover:bg-amber-50" asChild>
              <Link to="/admin/pricing">
                <DollarSign className="w-4 h-4 mr-2" />
                Pricing Rules
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
