import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ChevronRight,
  Star,
  MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';
import { useCurrencyStore } from '../../store/currencyStore';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import OrderSupportModal from '../../components/orders/OrderSupportModal';

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  type?: string;
  total?: number;
  totalAmount?: number;
  createdAt: string;
  designOrder?: {
    status?: string;
    design?: {
      name: string;
      images?: Array<{ url: string }>;
    };
  };
  fabricOrder?: {
    status?: string;
    fabric?: {
      name: string;
      images?: Array<{ url: string }>;
    };
  };
  readyToWearItems?: Array<{
    size: string;
    quantity: number;
    readyToWear?: {
      name: string;
      images?: Array<{ url: string }>;
    };
  }>;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  PENDING: { icon: Clock, color: 'yellow', label: 'Pending' },
  CONFIRMED: { icon: CheckCircle, color: 'blue', label: 'Confirmed' },
  IN_PRODUCTION: { icon: Package, color: 'purple', label: 'In Production' },
  QA_REVIEW: { icon: AlertCircle, color: 'orange', label: 'QA Review' },
  READY_FOR_SHIPPING: { icon: Package, color: 'cyan', label: 'Ready to Ship' },
  SHIPPED: { icon: Truck, color: 'indigo', label: 'Shipped' },
  DELIVERED: { icon: CheckCircle, color: 'green', label: 'Delivered' },
  CANCELLED: { icon: AlertCircle, color: 'red', label: 'Cancelled' },
};

export default function CustomerOrders() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const orderNumbersFromRedirect = searchParams.get('orders');
  
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [ticketOrderId, setTicketOrderId] = useState<string | null>(null);
  const [ticketInitialTab, setTicketInitialTab] = useState<'details' | 'ticket'>('details');
  const { formatFromUsd } = useCurrencyStore();

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.customer.getOrders();
      if (response.success) {
        setOrders((response.data.orders || response.data || []) as Order[]);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = filter === 'all' 
    ? orders 
    : orders.filter(o => o.status === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <div>
            <p className="font-medium text-green-900">Order placed successfully!</p>
            <p className="text-sm text-green-700">
              You can track your order status below.
              {orderNumbersFromRedirect ? ` Order No: ${orderNumbersFromRedirect}` : ''}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">My Orders</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg text-sm"
        >
          <option value="all">All Orders</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PRODUCTION">In Production</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
        </select>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-4">Start exploring products and place your first order.</p>
          <Button onClick={() => window.location.href = '/ready-to-wear'}>
            Browse Products
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const statusColor = statusConfig[order.status]?.color || 'gray';
            const mainReadyToWearItem = order.readyToWearItems?.[0];
            const productName =
              mainReadyToWearItem?.readyToWear?.name ||
              order.designOrder?.design?.name ||
              'Order Item';
            const productImage =
              mainReadyToWearItem?.readyToWear?.images?.[0]?.url ||
              order.designOrder?.design?.images?.[0]?.url ||
              '/images/placeholder.jpg';
            const productDetailText = mainReadyToWearItem
              ? `Size ${mainReadyToWearItem.size} · Qty ${mainReadyToWearItem.quantity}`
              : order.fabricOrder?.fabric?.name
                ? `Fabric: ${order.fabricOrder.fabric.name}`
                : 'Custom Order';
            const totalAmount = Number(order.total ?? order.totalAmount ?? 0);
            const designStatus = order.designOrder?.status || 'N/A';
            const fabricStatus = order.fabricOrder?.status || (mainReadyToWearItem ? 'N/A' : 'PENDING');
            
            return (
              <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{order.orderNumber}</h3>
                      <Badge variant={statusColor as any}>
                        {statusConfig[order.status]?.label || order.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Ordered on {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-amber-700">
                    {formatFromUsd(totalAmount)}
                  </p>
                </div>

                <div className="flex gap-4 mb-4">
                  <img
                    src={productImage}
                    alt={productName}
                    className="w-24 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{productName}</h4>
                    <p className="text-sm text-gray-500 mt-1">{productDetailText}</p>
                    
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                        <span>Order Placed</span>
                        <span>In Production</span>
                        <span>QA Review</span>
                        <span>Shipped</span>
                        <span>Delivered</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-600 transition-all duration-500"
                          style={{ 
                            width: order.status === 'DELIVERED' ? '100%' :
                                   order.status === 'SHIPPED' ? '80%' :
                                   order.status === 'READY_FOR_SHIPPING' ? '75%' :
                                   order.status === 'QA_REVIEW' ? '60%' :
                                   order.status === 'IN_PRODUCTION' ? '40%' :
                                   order.status === 'CONFIRMED' ? '20%' : '10%'
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        designStatus === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-gray-600">Design: {designStatus}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        fabricStatus === 'DELIVERED' ? 'bg-green-500' : 
                        fabricStatus === 'SHIPPED' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-gray-600">Fabric: {fabricStatus}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'DELIVERED' && (
                      <Button variant="outline" size="sm">
                        <Star className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setTicketInitialTab('ticket');
                        setTicketOrderId(order.id);
                      }}
                    >
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Contact
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTicketInitialTab('details');
                        setTicketOrderId(order.id);
                      }}
                    >
                      Details
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <OrderSupportModal
        isOpen={Boolean(ticketOrderId)}
        orderId={ticketOrderId}
        initialTab={ticketInitialTab}
        onClose={() => setTicketOrderId(null)}
      />
    </div>
  );
}
