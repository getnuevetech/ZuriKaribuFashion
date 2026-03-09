import { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle,
  TrendingUp,
  Clock,
  Package,
  Eye,
  Check,
  X,
  MessageSquare,
  Camera,
  Star,
  Calendar,
  ArrowRight,
  Filter,
  Search,
  Truck
} from 'lucide-react';
import { api } from '../../services/api';
import { useSearchParams } from 'react-router-dom';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { BarChart, PieChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';

interface QAStats {
  pendingReviews: number;
  approvedToday: number;
  rejectedToday: number;
  totalReviewed: number;
  avgReviewTime: number;
  approvalRate: number;
  weeklyReviews: { label: string; value: number }[];
  reviewsByStatus: { label: string; value: number; color?: string }[];
}

interface QAItem {
  id: string;
  orderNumber: string;
  designName: string;
  designerName: string;
  customerName: string;
  images: string[];
  measurements: Record<string, number>;
  submittedAt: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  notes?: string;
}

interface QAReview {
  id: string;
  orderNumber: string;
  designName: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedAt: string;
  notes: string;
  reviewerName: string;
  designerName: string;
}

interface Activity {
  id: string;
  type: 'review' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

export default function QADashboard() {
  const [stats, setStats] = useState<QAStats | null>(null);
  const [pendingItems, setPendingItems] = useState<QAItem[]>([]);
  const [recentReviews, setRecentReviews] = useState<QAReview[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'history'>('overview');
  const [selectedItem, setSelectedItem] = useState<QAItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [showShipModal, setShowShipModal] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const syncTabWithUrl = (tab: 'overview' | 'pending' | 'history') => {
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
    if (tabParam === 'pending' || tabParam === 'history' || tabParam === 'overview') {
      setActiveTab(tabParam);
    } else {
      setActiveTab('overview');
    }
  }, [searchParams]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, pendingRes, historyRes] = await Promise.all([
        api.qa.getStats(),
        api.qa.getPendingItems(),
        api.qa.getReviewHistory()
      ]);
      
      if (statsRes.success) setStats(statsRes.data);
      if (pendingRes.success) setPendingItems(pendingRes.data);
      if (historyRes.success) setRecentReviews(historyRes.data);
      
      // Mock activities
      setActivities([
        {
          id: '1',
          type: 'review',
          title: 'Order approved',
          description: 'Order #QA-2024-089 passed QA review',
          timestamp: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        },
        {
          id: '2',
          type: 'review',
          title: 'Order rejected',
          description: 'Order #QA-2024-087 requires rework',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        },
        {
          id: '3',
          type: 'system',
          title: 'High priority alert',
          description: '3 orders are marked as high priority',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        },
        {
          id: '4',
          type: 'review',
          title: 'Order shipped',
          description: 'Order #QA-2024-076 shipped to customer',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (status: 'APPROVED' | 'REJECTED') => {
    if (!selectedItem) return;
    
    try {
      await api.qa.submitReview({
        orderId: selectedItem.id,
        status,
        notes: reviewNotes,
      });
      
      setShowReviewModal(false);
      setReviewNotes('');
      
      if (status === 'APPROVED') {
        setShowShipModal(true);
      } else {
        setSelectedItem(null);
        fetchDashboardData();
      }
    } catch (error) {
      console.error('Failed to submit review:', error);
    }
  };

  const handleShip = async () => {
    if (!selectedItem || !trackingNumber) return;
    
    try {
      await api.qa.shipOrder(selectedItem.id, trackingNumber, reviewNotes);
      setShowShipModal(false);
      setTrackingNumber('');
      setSelectedItem(null);
      fetchDashboardData();
    } catch (error) {
      console.error('Failed to ship order:', error);
    }
  };

  const openReviewModal = (item: QAItem) => {
    setSelectedItem(item);
    setReviewNotes('');
    setShowReviewModal(true);
  };

  const highPriorityItems = pendingItems.filter(item => item.priority === 'HIGH');

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
          <h1 className="text-2xl font-bold text-gray-900">QA Dashboard</h1>
          <p className="text-gray-500 mt-1">Review and approve orders for shipping</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-gray-600">Online</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Pending Reviews"
          value={stats?.pendingReviews || 0}
          icon={Clock}
          iconColor="text-yellow-600"
          iconBgColor="bg-yellow-100"
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday || 0}
          icon={CheckCircle}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Rejected Today"
          value={stats?.rejectedToday || 0}
          icon={XCircle}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
        />
        <StatCard
          title="Total Reviewed"
          value={stats?.totalReviewed || 0}
          icon={TrendingUp}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Avg Review Time"
          value={`${stats?.avgReviewTime || 0}m`}
          icon={Clock}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
        />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['overview', 'pending', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => syncTabWithUrl(tab)}
              className={`pb-3 text-sm font-medium capitalize transition-colors relative ${
                activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
              {tab === 'pending' && pendingItems.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingItems.length}
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
          {/* High Priority Alert */}
          {highPriorityItems.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <div className="flex-1">
                  <p className="font-medium text-red-900">
                    High Priority Items
                  </p>
                  <p className="text-sm text-red-700">
                    {highPriorityItems.length} item(s) require urgent review
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => syncTabWithUrl('pending')}
                >
                  Review Now
                </Button>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Weekly Reviews */}
            <div className="lg:col-span-2 bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Weekly Reviews</h3>
              <BarChart 
                data={stats?.weeklyReviews || [
                  { label: 'Mon', value: 12, color: 'bg-amber-500' },
                  { label: 'Tue', value: 18, color: 'bg-amber-500' },
                  { label: 'Wed', value: 15, color: 'bg-amber-500' },
                  { label: 'Thu', value: 22, color: 'bg-amber-500' },
                  { label: 'Fri', value: 28, color: 'bg-amber-500' },
                  { label: 'Sat', value: 16, color: 'bg-amber-500' },
                  { label: 'Sun', value: 10, color: 'bg-amber-500' },
                ]}
                height={200}
              />
            </div>

            {/* Reviews by Status */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviews by Status</h3>
              <PieChart 
                data={stats?.reviewsByStatus || [
                  { label: 'Approved', value: 156, color: '#22c55e' },
                  { label: 'Rejected', value: 24, color: '#ef4444' },
                ]}
                size={150}
              />
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-500">Approval Rate</p>
                <p className="text-2xl font-bold text-green-600">{stats?.approvalRate || 87}%</p>
              </div>
            </div>
          </div>

          {/* Pending Reviews & Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending Reviews */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Pending Reviews</h3>
                <Button variant="ghost" size="sm" onClick={() => syncTabWithUrl('pending')}>
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingItems.slice(0, 4).map((item) => (
                  <div key={item.id} className="border rounded-xl overflow-hidden">
                    <div className="relative">
                      <img
                        src={item.images[0]}
                        alt={item.designName}
                        className="w-full h-32 object-cover"
                      />
                      <Badge 
                        variant={item.priority === 'HIGH' ? 'red' : item.priority === 'MEDIUM' ? 'yellow' : 'blue'}
                        className="absolute top-2 right-2"
                      >
                        {item.priority}
                      </Badge>
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-gray-900 text-sm">{item.designName}</h4>
                      <p className="text-xs text-gray-500">by {item.designerName}</p>
                      <Button 
                        size="sm" 
                        className="w-full mt-2"
                        onClick={() => openReviewModal(item)}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Review
                      </Button>
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

      {activeTab === 'pending' && (
        <DataTable
          title="All Pending Reviews"
          columns={[
            { 
              key: 'designName', 
              header: 'Design',
              render: (item) => (
                <div className="flex items-center gap-3">
                  <img src={item.images[0]} alt={item.designName} className="w-12 h-12 rounded-lg object-cover" />
                  <div>
                    <p className="font-medium text-gray-900">{item.designName}</p>
                    <p className="text-xs text-gray-500">{item.orderNumber}</p>
                  </div>
                </div>
              )
            },
            { key: 'designerName', header: 'Designer' },
            { key: 'customerName', header: 'Customer' },
            { 
              key: 'priority', 
              header: 'Priority',
              render: (item) => (
                <Badge variant={
                  item.priority === 'HIGH' ? 'red' :
                  item.priority === 'MEDIUM' ? 'yellow' : 'blue'
                }>
                  {item.priority}
                </Badge>
              )
            },
            { 
              key: 'submittedAt', 
              header: 'Submitted',
              render: (item) => new Date(item.submittedAt).toLocaleString()
            },
          ]}
          data={pendingItems}
          keyExtractor={(item) => item.id}
          searchable
          searchKeys={['designName', 'designerName', 'customerName', 'orderNumber']}
          actions={(item) => (
            <Button size="sm" onClick={() => openReviewModal(item)}>
              <Eye className="w-4 h-4 mr-1" />
              Review
            </Button>
          )}
        />
      )}

      {activeTab === 'history' && (
        <DataTable
          title="Review History"
          columns={[
            { key: 'orderNumber', header: 'Order ID' },
            { key: 'designName', header: 'Design' },
            { key: 'designerName', header: 'Designer' },
            { 
              key: 'status', 
              header: 'Status',
              render: (item) => (
                <Badge variant={item.status === 'APPROVED' ? 'green' : 'red'}>
                  {item.status}
                </Badge>
              )
            },
            { 
              key: 'reviewedAt', 
              header: 'Reviewed At',
              render: (item) => new Date(item.reviewedAt).toLocaleString()
            },
            { key: 'reviewerName', header: 'Reviewer' },
            { 
              key: 'notes', 
              header: 'Notes',
              render: (item) => (
                <span className="truncate max-w-xs block">{item.notes}</span>
              )
            },
          ]}
          data={recentReviews}
          keyExtractor={(item) => item.id}
          searchable
          searchKeys={['orderNumber', 'designName', 'designerName', 'reviewerName']}
        />
      )}

      {/* Review Modal */}
      {showReviewModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-4xl rounded-2xl bg-white max-h-[92vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-bold">QA Review</h3>
                  <p className="text-gray-500">{selectedItem.orderNumber}</p>
                </div>
                <button 
                  onClick={() => setShowReviewModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {selectedItem.images.map((img, idx) => (
                  <img
                    key={idx}
                    src={img}
                    alt={`Review ${idx + 1}`}
                    className="w-full h-48 object-cover rounded-lg"
                  />
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <h4 className="font-semibold mb-2">Order Details</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="text-gray-500">Design:</span> {selectedItem.designName}</p>
                    <p><span className="text-gray-500">Designer:</span> {selectedItem.designerName}</p>
                    <p><span className="text-gray-500">Customer:</span> {selectedItem.customerName}</p>
                    <p><span className="text-gray-500">Submitted:</span> {new Date(selectedItem.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Measurements</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(selectedItem.measurements).map(([key, value]) => (
                      <div key={key} className="p-2 bg-gray-50 rounded">
                        <p className="text-xs text-gray-500">{key}</p>
                        <p className="font-medium">{value} cm</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Review Notes
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Enter your review notes..."
                  className="w-full px-4 py-2 border rounded-lg h-24 resize-none"
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => handleReview('REJECTED')}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  className="flex-1"
                  onClick={() => handleReview('APPROVED')}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ship Modal */}
      {showShipModal && selectedItem && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-lg rounded-xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Order Approved!</h3>
                <p className="text-gray-500">Enter tracking number to ship</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tracking Number
              </label>
              <input
                type="text"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="e.g., TRK123456789"
                className="w-full px-4 py-2 border rounded-lg"
              />
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowShipModal(false);
                  setSelectedItem(null);
                  fetchDashboardData();
                }}
              >
                Skip for Now
              </Button>
              <Button 
                className="flex-1"
                onClick={handleShip}
                disabled={!trackingNumber}
              >
                <Truck className="w-4 h-4 mr-2" />
                Ship Order
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
