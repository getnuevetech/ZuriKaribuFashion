import { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  DollarSign, 
  Package,
  Clock,
  CheckCircle,
  Truck,
  Star,
  Heart,
  MapPin,
  Ruler,
  ArrowRight,
  Calendar,
  AlertCircle,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CardElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { api } from '../../services/api';
import StatCard from '../../components/dashboard/StatCard';
import ActivityFeed from '../../components/dashboard/ActivityFeed';
import DataTable from '../../components/dashboard/DataTable';
import { LineChart } from '../../components/dashboard/SimpleChart';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import OrderSupportModal from '../../components/orders/OrderSupportModal';

interface CustomerStats {
  totalOrders: number;
  totalSpent: number;
  pendingOrders: number;
  deliveredOrders: number;
  wishlistCount: number;
  savedMeasurements: number;
  monthlySpending: { label: string; value: number }[];
}

interface Order {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  design: {
    name: string;
    images: string[];
  };
  fabric: {
    name: string;
    images: string[];
  };
  designer: {
    businessName: string;
  };
  designStatus: string;
  fabricStatus: string;
  shippingStatus: string;
  trackingNumber?: string;
}

const normalizeCustomerOrder = (row: any): Order => {
  const designImage =
    row?.design?.images?.[0] ||
    row?.designOrder?.design?.images?.[0]?.url ||
    row?.readyToWearItems?.[0]?.readyToWear?.images?.[0]?.url ||
    row?.fabricOrder?.fabric?.images?.[0]?.url ||
    '/images/placeholder.jpg';
  const designName =
    row?.design?.name ||
    row?.designOrder?.design?.name ||
    row?.readyToWearItems?.[0]?.readyToWear?.name ||
    row?.fabricOrder?.fabric?.name ||
    'Order Item';
  const fabricName = row?.fabric?.name || row?.fabricOrder?.fabric?.name || 'N/A';
  const designerName = row?.designer?.businessName || row?.designOrder?.designer?.businessName || 'Designer';
  return {
    id: String(row?.id || ''),
    orderNumber: String(row?.orderNumber || 'Order'),
    status: String(row?.status || 'PENDING'),
    totalAmount: Number(row?.totalAmount ?? row?.totalPrice ?? 0),
    createdAt: String(row?.createdAt || new Date().toISOString()),
    design: {
      name: String(designName),
      images: [String(designImage)],
    },
    fabric: {
      name: String(fabricName),
      images: [String(row?.fabric?.images?.[0] || row?.fabricOrder?.fabric?.images?.[0]?.url || '/images/placeholder.jpg')],
    },
    designer: {
      businessName: String(designerName),
    },
    designStatus: String(row?.designStatus || row?.designOrder?.status || row?.status || 'PENDING'),
    fabricStatus: String(row?.fabricStatus || row?.fabricOrder?.status || row?.status || 'PENDING'),
    shippingStatus: String(row?.shippingStatus || row?.status || 'PENDING'),
    trackingNumber: row?.trackingNumber ? String(row.trackingNumber) : undefined,
  };
};

interface WishlistItem {
  id: string;
  name: string;
  price: number;
  image: string;
  designer: string;
}

interface Activity {
  id: string;
  type: 'order' | 'shipping' | 'review' | 'system';
  title: string;
  description: string;
  timestamp: string;
}

interface TryOnCatalogItem {
  id: string;
  productType: 'DESIGN' | 'READY_TO_WEAR';
  name: string;
  description?: string;
  image?: string;
  priceUsd: number;
  ownerName: string;
  country?: string;
  style?: string;
}

interface PaymentProviderOption {
  providerKey: string;
  displayName: string;
  checkoutType: 'INLINE' | 'REDIRECT';
  mode: 'TEST' | 'LIVE';
  publicConfig?: Record<string, any>;
}

type DashboardTab = 'overview' | 'orders' | 'wishlist' | 'tryon';

const resolveDashboardTab = (value: unknown): DashboardTab => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'orders') return 'orders';
  if (normalized === 'wishlist') return 'wishlist';
  if (normalized === 'tryon' || normalized === 'try-on' || normalized === '3d-tryon' || normalized === '3d-try-on') {
    return 'tryon';
  }
  return 'overview';
};

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeMonthlySpending = (value: unknown): Array<{ label: string; value: number }> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as any;
      return {
        label: String(row.label || row.month || row.name || `M${index + 1}`),
        value: toFiniteNumber(row.value ?? row.amount ?? row.total ?? 0, 0),
      };
    })
    .filter((entry): entry is { label: string; value: number } => Boolean(entry));
};

const normalizeWishlistItems = (value: unknown): WishlistItem[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry: any, index) => ({
      id: String(entry?.id || entry?.productId || `wishlist-${index + 1}`),
      name: String(entry?.name || entry?.title || entry?.productName || 'Saved item'),
      price: toFiniteNumber(entry?.price ?? entry?.priceUsd ?? entry?.basePrice ?? 0, 0),
      image: String(entry?.image || entry?.images?.[0] || entry?.product?.images?.[0] || '/images/placeholder.jpg'),
      designer: String(entry?.designer || entry?.ownerName || entry?.designerName || 'Designer'),
    }))
    .filter((entry) => entry.id.length > 0);
};

const normalizeCustomerStats = (value: unknown, fallbackWishlistCount: number): CustomerStats => {
  const row = value && typeof value === 'object' ? (value as any) : {};
  return {
    totalOrders: Math.max(0, Math.floor(toFiniteNumber(row.totalOrders, 0))),
    totalSpent: toFiniteNumber(row.totalSpent, 0),
    pendingOrders: Math.max(0, Math.floor(toFiniteNumber(row.pendingOrders, 0))),
    deliveredOrders: Math.max(0, Math.floor(toFiniteNumber(row.deliveredOrders, 0))),
    wishlistCount: Math.max(0, Math.floor(toFiniteNumber(row.wishlistCount, fallbackWishlistCount))),
    savedMeasurements: Math.max(0, Math.floor(toFiniteNumber(row.savedMeasurements, 0))),
    monthlySpending: normalizeMonthlySpending(row.monthlySpending),
  };
};

const buildStatsFromOrders = (rows: Order[], wishlistCount: number): CustomerStats => ({
  totalOrders: rows.length,
  totalSpent: rows.reduce((sum, row) => sum + toFiniteNumber(row.totalAmount, 0), 0),
  pendingOrders: rows.filter((row) => ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'QA_REVIEW'].includes(String(row.status))).length,
  deliveredOrders: rows.filter((row) => String(row.status) === 'DELIVERED').length,
  wishlistCount,
  savedMeasurements: 0,
  monthlySpending: [],
});

const statusConfig: Record<string, { icon: any; color: string; label: string; bgColor: string }> = {
  PENDING: { icon: Clock, color: 'text-yellow-600', label: 'Pending', bgColor: 'bg-yellow-50' },
  CONFIRMED: { icon: CheckCircle, color: 'text-blue-600', label: 'Confirmed', bgColor: 'bg-blue-50' },
  IN_PRODUCTION: { icon: Package, color: 'text-purple-600', label: 'In Production', bgColor: 'bg-purple-50' },
  QA_REVIEW: { icon: AlertCircle, color: 'text-orange-600', label: 'QA Review', bgColor: 'bg-orange-50' },
  READY_FOR_SHIPPING: { icon: Package, color: 'text-cyan-600', label: 'Ready to Ship', bgColor: 'bg-cyan-50' },
  SHIPPED: { icon: Truck, color: 'text-indigo-600', label: 'Shipped', bgColor: 'bg-indigo-50' },
  DELIVERED: { icon: CheckCircle, color: 'text-green-600', label: 'Delivered', bgColor: 'bg-green-50' },
  CANCELLED: { icon: AlertCircle, color: 'text-red-600', label: 'Cancelled', bgColor: 'bg-red-50' },
};

const getStatusMeta = (status: string) => {
  const normalized = String(status || '').trim().toUpperCase();
  return (
    statusConfig[normalized] || {
      icon: Clock,
      color: 'text-gray-600',
      label: normalized || 'Unknown',
      bgColor: 'bg-gray-50',
    }
  );
};

const getBadgeVariantFromStatusMeta = (meta: { color: string }) => {
  const token = String(meta?.color || '').replace(/^text-/, '').trim();
  return (token || 'gray-600') as any;
};

export default function CustomerDashboard() {
  const stripe = useStripe();
  const elements = useElements();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [wishlist, setWishlist] = useState<WishlistItem[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>(() => resolveDashboardTab(searchParams.get('tab')));
  const [tryOnSummary, setTryOnSummary] = useState<any>(null);
  const [tryOnCatalog, setTryOnCatalog] = useState<TryOnCatalogItem[]>([]);
  const [tryOnSelected, setTryOnSelected] = useState<Array<{ productType: 'DESIGN' | 'READY_TO_WEAR'; productId: string }>>([]);
  const [tryOnMeasurements, setTryOnMeasurements] = useState<Record<string, number>>({});
  const [tryOnRunning, setTryOnRunning] = useState(false);
  const [tryOnPurchasing, setTryOnPurchasing] = useState(false);
  const [tryOnMessage, setTryOnMessage] = useState('');
  const [tryOnError, setTryOnError] = useState('');
  const [paymentProviders, setPaymentProviders] = useState<PaymentProviderOption[]>([]);
  const [selectedPaymentProvider, setSelectedPaymentProvider] = useState('STRIPE');
  const [tryOnStripeClientSecret, setTryOnStripeClientSecret] = useState<string | null>(null);
  const [pendingTryOnPurchase, setPendingTryOnPurchase] = useState<{
    purchaseId: string;
    providerKey: string;
    verificationReference: string;
  } | null>(null);
  const [ticketOrderId, setTicketOrderId] = useState<string | null>(null);
  const [ticketInitialTab, setTicketInitialTab] = useState<'details' | 'ticket'>('details');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const nextTab = resolveDashboardTab(searchParams.get('tab'));
    setActiveTab((current) => (current === nextTab ? current : nextTab));
  }, [searchParams]);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (tab === 'overview') {
          next.delete('tab');
        } else {
          next.set('tab', tab);
        }
        return next;
      },
      { replace: true }
    );
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, ordersRes, tryOnSummaryRes, tryOnCatalogRes, paymentOptionsRes] = await Promise.allSettled([
        api.customer.getProfile(),
        api.customer.getOrders(),
        api.customer.getTryOnSummary(),
        api.customer.getTryOnCatalog({ productType: 'ALL', page: 1, limit: 120 }),
        api.payments.getOptions(),
      ]);
      
      let normalizedOrders: Order[] = [];
      let normalizedWishlist: WishlistItem[] = [];
      let normalizedStats: CustomerStats | null = null;

      if (statsRes.status === 'fulfilled' && statsRes.value.success) {
        const profilePayload =
          statsRes.value.data && typeof statsRes.value.data === 'object' ? (statsRes.value.data as any) : {};
        normalizedWishlist = normalizeWishlistItems(
          profilePayload?.wishlist ?? profilePayload?.wishlists ?? profilePayload?.savedItems ?? []
        );
        normalizedStats = normalizeCustomerStats(
          profilePayload?.stats ?? profilePayload?.dashboardStats ?? profilePayload?.customerStats ?? {},
          normalizedWishlist.length
        );
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value.success) {
        const rows = Array.isArray(ordersRes.value.data?.orders) ? ordersRes.value.data.orders : [];
        normalizedOrders = rows.map((row: any) => normalizeCustomerOrder(row));
        setOrders(normalizedOrders);
      } else {
        setOrders([]);
      }
      if (!normalizedStats) {
        normalizedStats = buildStatsFromOrders(normalizedOrders, normalizedWishlist.length);
      } else if (normalizedOrders.length > 0 && normalizedStats.totalOrders <= 0) {
        normalizedStats = {
          ...normalizedStats,
          ...buildStatsFromOrders(normalizedOrders, normalizedWishlist.length),
          monthlySpending: normalizedStats.monthlySpending,
        };
      }
      setStats(normalizedStats);
      setWishlist(normalizedWishlist);
      if (tryOnSummaryRes.status === 'fulfilled' && tryOnSummaryRes.value.success) {
        setTryOnSummary(tryOnSummaryRes.value.data || null);
        const measurementSeed = tryOnSummaryRes.value.data?.measurements;
        if (measurementSeed && typeof measurementSeed === 'object') {
          setTryOnMeasurements(
            Object.keys(measurementSeed).reduce((acc, key) => {
              const parsed = Number((measurementSeed as any)[key]);
              if (Number.isFinite(parsed) && parsed > 0) acc[key] = parsed;
              return acc;
            }, {} as Record<string, number>)
          );
        }
      } else if (tryOnSummaryRes.status === 'rejected') {
        const message = String((tryOnSummaryRes.reason as any)?.response?.data?.message || '').toLowerCase();
        if (message.includes('route not found') || message.includes('not found')) {
          setTryOnError('Unable to load 3D TryON details right now. Please try again shortly.');
        } else if (message) {
          setTryOnError(String((tryOnSummaryRes.reason as any)?.response?.data?.message || ''));
        }
      }
      if (tryOnCatalogRes.status === 'fulfilled' && tryOnCatalogRes.value.success) {
        setTryOnCatalog((tryOnCatalogRes.value.data || []) as TryOnCatalogItem[]);
      }
      if (paymentOptionsRes.status === 'fulfilled' && paymentOptionsRes.value.success) {
        const providers = (paymentOptionsRes.value.data?.providers || []).map((entry: any) => ({
          providerKey: String(entry.providerKey || 'STRIPE').toUpperCase(),
          displayName: String(entry.displayName || entry.providerKey || 'Payment Provider'),
          checkoutType: entry.checkoutType === 'REDIRECT' ? 'REDIRECT' : 'INLINE',
          mode: entry.mode === 'LIVE' ? 'LIVE' : 'TEST',
          publicConfig: entry.publicConfig && typeof entry.publicConfig === 'object' ? entry.publicConfig : {},
        })) as PaymentProviderOption[];
        setPaymentProviders(providers);
        setSelectedPaymentProvider((previous) => {
          const current = providers.find((entry) => entry.providerKey === previous);
          return current ? current.providerKey : providers[0]?.providerKey || 'STRIPE';
        });
      }
      
      // Mock activities
      setActivities([
        {
          id: '1',
          type: 'order',
          title: 'Order placed',
          description: 'Order #C-2024-156 for Royal Kente Gown',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        },
        {
          id: '2',
          type: 'shipping',
          title: 'Order shipped',
          description: 'Order #C-2024-142 is on its way',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        },
        {
          id: '3',
          type: 'review',
          title: 'Review requested',
          description: 'Please review your recent purchase',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
        },
        {
          id: '4',
          type: 'system',
          title: 'Welcome offer',
          description: 'Get 10% off your next order with code WELCOME10',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getOrderProgress = (status: string): number => {
    const progressMap: Record<string, number> = {
      'PENDING': 10,
      'CONFIRMED': 20,
      'IN_PRODUCTION': 40,
      'QA_REVIEW': 60,
      'READY_FOR_SHIPPING': 75,
      'SHIPPED': 80,
      'DELIVERED': 100,
    };
    return progressMap[status] || 0;
  };

  const toggleTryOnProduct = (item: TryOnCatalogItem) => {
    const maxProducts = Math.max(1, Number(tryOnSummary?.settings?.maxProductsPerBatch || 5));
    setTryOnSelected((previous) => {
      const key = `${item.productType}:${item.id}`;
      const exists = previous.some((entry) => `${entry.productType}:${entry.productId}` === key);
      if (exists) {
        return previous.filter((entry) => `${entry.productType}:${entry.productId}` !== key);
      }
      if (previous.length >= maxProducts) return previous;
      return [...previous, { productType: item.productType, productId: item.id }];
    });
  };

  const handleTryOnPurchase = async () => {
    try {
      setTryOnPurchasing(true);
      setTryOnError('');
      setTryOnMessage('');
      setTryOnStripeClientSecret(null);
      setPendingTryOnPurchase(null);
      const providerKey = selectedPaymentProvider || paymentProviders[0]?.providerKey || 'STRIPE';
      const returnUrl = `${window.location.origin}/dashboard?tryon_payment=1&provider=${encodeURIComponent(providerKey)}`;
      const cancelUrl = `${window.location.origin}/dashboard?tryon_payment=1&provider=${encodeURIComponent(providerKey)}&cancelled=true`;
      const response = await api.customer.createTryOnPurchaseSession({
        bundles: 1,
        providerKey,
        returnUrl,
        cancelUrl,
      });
      const purchaseId = String(response.data?.purchaseId || '');
      const payment = response.data?.payment || {};
      if (!purchaseId) {
        throw new Error('Unable to initialize TryON purchase.');
      }
      const verificationReference = String(payment.paymentIntentId || payment.reference || '').trim();
      if (!verificationReference) {
        throw new Error('Missing payment reference from provider.');
      }
      if (payment.flow === 'INLINE') {
        if (!payment.clientSecret) {
          throw new Error('Inline payment did not return client secret.');
        }
        setTryOnStripeClientSecret(String(payment.clientSecret));
        setPendingTryOnPurchase({
          purchaseId,
          providerKey,
          verificationReference,
        });
        setTryOnMessage('Card details required: complete payment below to unlock TryON credits.');
        return;
      }
      if (payment.flow === 'REDIRECT' && payment.checkoutUrl) {
        sessionStorage.setItem(
          'tryon_pending_payment',
          JSON.stringify({
            purchaseId,
            providerKey,
            verificationReference,
            createdAt: Date.now(),
          })
        );
        window.location.href = String(payment.checkoutUrl);
        return;
      }
      throw new Error('Unsupported payment flow for selected provider.');
    } catch (error: any) {
      setTryOnError(error?.response?.data?.message || 'Failed to purchase TryON credits.');
    } finally {
      setTryOnPurchasing(false);
    }
  };

  const handleConfirmInlineTryOnPayment = async () => {
    try {
      setTryOnPurchasing(true);
      setTryOnError('');
      if (!stripe || !elements) {
        throw new Error('Stripe is not ready yet. Please try again.');
      }
      if (!tryOnStripeClientSecret || !pendingTryOnPurchase) {
        throw new Error('No pending inline TryON payment found.');
      }
      const card = elements.getElement(CardElement);
      if (!card) {
        throw new Error('Card input is not ready.');
      }
      const result = await stripe.confirmCardPayment(tryOnStripeClientSecret, {
        payment_method: {
          card,
        },
      });
      if (result.error) {
        throw new Error(result.error.message || 'Card payment failed.');
      }
      if (!result.paymentIntent || result.paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment not completed. Status: ${result.paymentIntent?.status || 'unknown'}`);
      }
      const complete = await api.customer.completeTryOnPurchase({
        purchaseId: pendingTryOnPurchase.purchaseId,
        providerKey: pendingTryOnPurchase.providerKey,
        reference: String(result.paymentIntent.id),
      });
      if (complete.success) {
        setTryOnMessage(
          `Purchased ${complete.data?.creditsAdded || 0} TryON credits for $${Number(
            complete.data?.amountChargedUsd || 0
          ).toFixed(2)}.`
        );
        setTryOnStripeClientSecret(null);
        setPendingTryOnPurchase(null);
        const summaryRes = await api.customer.getTryOnSummary();
        if (summaryRes.success) setTryOnSummary(summaryRes.data || null);
      }
    } catch (error: any) {
      setTryOnError(error?.response?.data?.message || error?.message || 'Failed to complete inline payment.');
    } finally {
      setTryOnPurchasing(false);
    }
  };

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('tryon_payment') !== '1') return;
    setActiveTab('tryon');
    const providerKey = String(query.get('provider') || '').toUpperCase();
    const cancelled = query.get('cancelled') === 'true' || query.get('payment_cancelled') === 'true';
    const pendingRaw = sessionStorage.getItem('tryon_pending_payment');
    if (!pendingRaw) return;
    let pending: any = null;
    try {
      pending = JSON.parse(pendingRaw);
    } catch {
      sessionStorage.removeItem('tryon_pending_payment');
      return;
    }
    if (!pending || String(pending.providerKey || '').toUpperCase() !== providerKey) return;
    if (cancelled) {
      setTryOnError('Payment was cancelled. You can choose a provider and try again.');
      sessionStorage.removeItem('tryon_pending_payment');
      window.history.replaceState({}, '', '/dashboard');
      return;
    }
    const reference =
      providerKey === 'FLUTTERWAVE'
        ? String(query.get('tx_ref') || pending.verificationReference || '')
        : String(query.get('token') || pending.verificationReference || '');
    if (!reference) {
      setTryOnError('Unable to resolve payment reference from provider callback.');
      return;
    }
    setTryOnPurchasing(true);
    setTryOnError('');
    api.customer
      .completeTryOnPurchase({
        purchaseId: String(pending.purchaseId || ''),
        providerKey,
        reference,
        payerId: query.get('PayerID') || undefined,
      })
      .then(async (complete) => {
        if (!complete.success) {
          throw new Error('TryON payment could not be completed.');
        }
        setTryOnMessage(
          `Purchased ${complete.data?.creditsAdded || 0} TryON credits for $${Number(
            complete.data?.amountChargedUsd || 0
          ).toFixed(2)}.`
        );
        const summaryRes = await api.customer.getTryOnSummary();
        if (summaryRes.success) setTryOnSummary(summaryRes.data || null);
      })
      .catch((error: any) => {
        setTryOnError(error?.response?.data?.message || error?.message || 'Failed to finalize TryON payment.');
      })
      .finally(() => {
        setTryOnPurchasing(false);
        sessionStorage.removeItem('tryon_pending_payment');
        window.history.replaceState({}, '', '/dashboard');
      });
  }, []);

  const handleRunTryOnBatch = async () => {
    try {
      setTryOnRunning(true);
      setTryOnError('');
      setTryOnMessage('');
      if (tryOnSelected.length === 0) {
        setTryOnError('Select at least one product to run TryON.');
        return;
      }
      const response = await api.customer.runTryOnBatch({
        measurements: tryOnMeasurements,
        selectedProducts: tryOnSelected,
      });
      if (response.success) {
        setTryOnMessage(`TryON generated for ${response.data?.previews?.length || tryOnSelected.length} product(s).`);
        setTryOnSummary(response.data?.summary || tryOnSummary);
      }
    } catch (error: any) {
      const requiresPayment = Boolean(error?.response?.data?.requiresPayment);
      setTryOnError(
        error?.response?.data?.message ||
          (requiresPayment
            ? 'Free TryON quota exhausted. Purchase additional bundle to continue.'
            : 'Failed to run TryON.')
      );
    } finally {
      setTryOnRunning(false);
    }
  };

  const pendingOrders = orders.filter(o => ['PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'QA_REVIEW'].includes(o.status));
  const recentOrders = orders.slice(0, 3);

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
          <h1 className="text-2xl font-bold text-gray-900">My Dashboard</h1>
          <p className="text-gray-500 mt-1">Track your orders and manage your account</p>
        </div>
        <Button asChild>
          <Link to="/designs">
            <ShoppingBag className="w-4 h-4 mr-2" />
            Shop Now
          </Link>
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Orders"
          value={stats?.totalOrders || 0}
          icon={ShoppingBag}
          iconColor="text-blue-600"
          iconBgColor="bg-blue-100"
        />
        <StatCard
          title="Total Spent"
          value={`$${(stats?.totalSpent || 0).toFixed(2)}`}
          icon={DollarSign}
          iconColor="text-green-600"
          iconBgColor="bg-green-100"
        />
        <StatCard
          title="Wishlist"
          value={stats?.wishlistCount || 0}
          icon={Heart}
          iconColor="text-red-600"
          iconBgColor="bg-red-100"
          subtitle="Saved items"
        />
        <StatCard
          title="Measurements"
          value={stats?.savedMeasurements || 0}
          icon={Ruler}
          iconColor="text-purple-600"
          iconBgColor="bg-purple-100"
          subtitle="Saved profiles"
        />
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-6">
          {(['overview', 'orders', 'wishlist', 'tryon'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab ? 'text-amber-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'overview' ? 'Overview' : tab === 'orders' ? 'Orders' : tab === 'wishlist' ? 'Wishlist' : '3D TryON'}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-600" />
              )}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && (
        <>
          {/* Pending Orders Alert */}
          {pendingOrders.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Package className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium text-blue-900">
                    You have {pendingOrders.length} active order{pendingOrders.length > 1 ? 's' : ''}
                  </p>
                  <p className="text-sm text-blue-700">
                    Track your orders to stay updated
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleTabChange('orders')}
                >
                  Track Orders
                </Button>
              </div>
            </div>
          )}

          {/* Spending Chart & Recent Orders */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Spending */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Spending</h3>
              <LineChart 
                data={stats?.monthlySpending || [
                  { label: 'Jan', value: 450 },
                  { label: 'Feb', value: 680 },
                  { label: 'Mar', value: 520 },
                  { label: 'Apr', value: 890 },
                  { label: 'May', value: 1200 },
                  { label: 'Jun', value: 750 },
                ]}
                height={200}
              />
            </div>

            {/* Recent Orders */}
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
                <Button variant="ghost" size="sm" onClick={() => handleTabChange('orders')}>
                  View All
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
              <div className="space-y-4">
                {recentOrders.map((order) => {
                  const status = getStatusMeta(order.status);
                  const StatusIcon = status?.icon || Clock;
                  
                  return (
                    <div key={order.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <img
                        src={order.design.images[0]}
                        alt={order.design.name}
                        className="w-16 h-20 object-cover rounded-lg"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{order.orderNumber}</p>
                          <Badge variant={getBadgeVariantFromStatusMeta(status)} size="sm">
                            {status?.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">{order.design.name}</p>
                        <p className="text-sm font-medium text-amber-700">${order.totalAmount.toFixed(2)}</p>
                      </div>
                      <StatusIcon className={`w-5 h-5 ${status?.color}`} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Activity Feed */}
          <ActivityFeed activities={activities} title="Recent Activity" />
        </>
      )}

      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.map((order) => {
            const status = getStatusMeta(order.status);
            const StatusIcon = status?.icon || Clock;
            const progress = getOrderProgress(order.status);
            
            return (
              <div key={order.id} className="bg-white rounded-xl p-6 shadow-sm border">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900">{order.orderNumber}</h3>
                      <Badge variant={getBadgeVariantFromStatusMeta(status)}>
                        {status?.label}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Ordered on {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-amber-700">
                    ${order.totalAmount.toFixed(2)}
                  </p>
                </div>

                <div className="flex gap-4 mb-4">
                  <img
                    src={order.design.images[0]}
                    alt={order.design.name}
                    className="w-24 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{order.design.name}</h4>
                    <p className="text-sm text-gray-500">by {order.designer.businessName}</p>
                    <p className="text-sm text-gray-500 mt-1">Fabric: {order.fabric.name}</p>
                    
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
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        order.designStatus === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-gray-600">Design: {order.designStatus}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className={`w-2 h-2 rounded-full ${
                        order.fabricStatus === 'DELIVERED' ? 'bg-green-500' : 
                        order.fabricStatus === 'SHIPPED' ? 'bg-blue-500' : 'bg-yellow-500'
                      }`} />
                      <span className="text-gray-600">Fabric: {order.fabricStatus}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {order.status === 'DELIVERED' && (
                      <Button variant="outline" size="sm">
                        <Star className="w-4 h-4 mr-2" />
                        Review
                      </Button>
                    )}
                    {order.trackingNumber && (
                      <Button variant="outline" size="sm">
                        <Truck className="w-4 h-4 mr-2" />
                        Track
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
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'wishlist' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-gray-900">My Wishlist</h2>
            <Button variant="outline" size="sm" asChild>
              <Link to="/designs">
                Continue Shopping
              </Link>
            </Button>
          </div>
          
          {wishlist.length === 0 ? (
            <div className="text-center py-16">
              <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Your wishlist is empty</h3>
              <p className="text-gray-500 mb-4">Save items you love for later</p>
              <Button asChild>
                <Link to="/designs">
                  Browse Designs
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {wishlist.map((item) => (
                <div key={item.id} className="border rounded-xl overflow-hidden group">
                  <div className="relative">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-56 object-cover group-hover:scale-105 transition-transform"
                    />
                    <button className="absolute top-3 right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-red-50">
                      <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    <p className="text-sm text-gray-500">by {item.designer}</p>
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-lg font-bold text-amber-700">${item.price}</p>
                      <Button size="sm">
                        <ShoppingBag className="w-4 h-4 mr-1" />
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'tryon' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 text-amber-700" />
              <div className="flex-1">
                <p className="font-medium text-amber-900">3D TryON Credit Rules</p>
                <p className="text-sm text-amber-800">
                  {tryOnSummary?.settings?.chargeNoticeText ||
                    'First 5 TryON runs are free. Additional bundles are paid and controlled by admin.'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-white px-2 py-1 text-gray-700">
                    Free remaining: {Number(tryOnSummary?.usage?.freeRemaining || 0)}
                  </span>
                  <span className="rounded bg-white px-2 py-1 text-gray-700">
                    Paid credits: {Number(tryOnSummary?.usage?.paidCreditsRemaining || 0)}
                  </span>
                  <span className="rounded bg-white px-2 py-1 text-gray-700">
                    Max per run: {Number(tryOnSummary?.settings?.maxProductsPerBatch || 5)}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <select
                  value={selectedPaymentProvider}
                  onChange={(event) => setSelectedPaymentProvider(event.target.value)}
                  className="rounded border bg-white px-3 py-2 text-xs"
                >
                  {paymentProviders.map((provider) => (
                    <option key={provider.providerKey} value={provider.providerKey}>
                      {provider.displayName} ({provider.providerKey})
                    </option>
                  ))}
                  {paymentProviders.length === 0 ? <option value="STRIPE">Stripe (default)</option> : null}
                </select>
                <Button variant="outline" size="sm" onClick={handleTryOnPurchase} disabled={tryOnPurchasing}>
                  {tryOnPurchasing ? 'Processing...' : `Buy +${Number(tryOnSummary?.settings?.additionalTryOnBundleSize || 5)} for $${Number(
                    tryOnSummary?.settings?.additionalTryOnBundlePriceUsd || 1
                  ).toFixed(2)}`}
                </Button>
              </div>
            </div>
          </div>

          {tryOnError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{tryOnError}</div> : null}
          {tryOnMessage ? <div className="rounded border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{tryOnMessage}</div> : null}
          {tryOnStripeClientSecret && pendingTryOnPurchase ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-2 text-sm font-semibold text-blue-900">Complete Card Payment</h3>
              <div className="rounded border bg-white p-3">
                <CardElement options={{ hidePostalCode: true }} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleConfirmInlineTryOnPayment} disabled={tryOnPurchasing}>
                  {tryOnPurchasing ? 'Confirming...' : 'Confirm Card Payment'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setTryOnStripeClientSecret(null);
                    setPendingTryOnPurchase(null);
                  }}
                  disabled={tryOnPurchasing}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-gray-900">Body Measurements for TryON (cm)</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {(Array.isArray(tryOnSummary?.settings?.requiredMeasurementFields)
                ? tryOnSummary.settings.requiredMeasurementFields
                : ['height', 'bust', 'waist', 'hips', 'shoulder']
              ).map((field: string) => (
                <label key={field} className="text-sm">
                  <span className="mb-1 block capitalize text-gray-600">{field}</span>
                  <input
                    type="number"
                    min={1}
                    value={String(tryOnMeasurements[field] || '')}
                    onChange={(event) =>
                      setTryOnMeasurements((previous) => ({
                        ...previous,
                        [field]: Math.max(0, Number(event.target.value || 0)),
                      }))
                    }
                    className="w-full rounded border px-3 py-2"
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">
                Select up to {Number(tryOnSummary?.settings?.maxProductsPerBatch || 5)} products
              </h3>
              <Button onClick={handleRunTryOnBatch} disabled={tryOnRunning || tryOnSelected.length === 0}>
                {tryOnRunning ? 'Running TryON...' : `Run TryON (${tryOnSelected.length})`}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {tryOnCatalog.map((item) => {
                const selected = tryOnSelected.some(
                  (entry) => entry.productType === item.productType && entry.productId === item.id
                );
                return (
                  <button
                    key={`${item.productType}-${item.id}`}
                    type="button"
                    onClick={() => toggleTryOnProduct(item)}
                    className={`rounded-lg border p-3 text-left transition ${
                      selected ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="mb-2 h-36 overflow-hidden rounded bg-gray-100">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <p className="text-xs text-gray-500">{item.productType === 'READY_TO_WEAR' ? 'Ready-To-Wear' : 'Design'}</p>
                    <p className="line-clamp-1 font-medium text-gray-900">{item.name}</p>
                    <p className="line-clamp-1 text-xs text-gray-500">
                      {item.ownerName} {item.country ? `• ${item.country}` : ''}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-amber-700">${Number(item.priceUsd || 0).toFixed(2)}</p>
                  </button>
                );
              })}
            </div>
          </div>
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
