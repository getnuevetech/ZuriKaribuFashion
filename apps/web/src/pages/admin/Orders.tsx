import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  Search, 
  Filter, 
  Eye,
  Truck,
  CheckCircle,
  XCircle,
  UserCheck,
  Package,
  MessageSquare
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import OrderSupportModal from '../../components/orders/OrderSupportModal';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  designName: string;
  designerName: string;
  fabricSellerName: string;
  totalAmount: number;
  status: string;
  designStatus: string;
  fabricStatus: string;
  qaStatus: string;
  createdAt: string;
}

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOrderRow = (input: any): Order => {
  const customerFirst = String(input?.customer?.firstName || '').trim();
  const customerLast = String(input?.customer?.lastName || '').trim();
  const customerName =
    String(input?.customerName || '').trim() ||
    [customerFirst, customerLast].filter(Boolean).join(' ').trim() ||
    'Customer';
  const designName =
    String(input?.designName || '').trim() ||
    String(input?.designOrder?.design?.name || '').trim() ||
    'N/A';
  const designerName =
    String(input?.designerName || '').trim() ||
    String(input?.designOrder?.design?.designer?.businessName || '').trim() ||
    'Designer';
  const fabricSellerName =
    String(input?.fabricSellerName || '').trim() ||
    String(input?.fabricOrder?.fabric?.seller?.businessName || '').trim() ||
    'Seller';

  return {
    id: String(input?.id || ''),
    orderNumber: String(input?.orderNumber || '').trim() || 'ORDER',
    customerName,
    designName,
    designerName,
    fabricSellerName,
    totalAmount: toFiniteNumber(input?.totalAmount ?? input?.total ?? 0, 0),
    status: String(input?.status || 'PENDING').toUpperCase(),
    designStatus: String(input?.designStatus || 'N/A'),
    fabricStatus: String(input?.fabricStatus || 'N/A'),
    qaStatus: String(input?.qaStatus || 'N/A'),
    createdAt: String(input?.createdAt || new Date().toISOString()),
  };
};

interface AdminTicketRow {
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  assignedToRole: string | null;
  assignedToUserId: string | null;
  assignedToUserName: string;
  customerName: string;
  dueAt: string | null;
  escalatedAt: string | null;
  escalationStatus: string;
  isOverdue: boolean;
  messageCount: number;
  lastMessagePreview: string;
  updatedAt: string;
}

type OrderManagementTab = 'all' | 'list' | 'ticket-queue' | 'ticketing-workflow' | 'processing-workflow';

const resolveOrderManagementTab = (value: unknown): OrderManagementTab => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'list') return 'list';
  if (normalized === 'ticket-queue') return 'ticket-queue';
  if (normalized === 'ticketing-workflow') return 'ticketing-workflow';
  if (normalized === 'processing-workflow') return 'processing-workflow';
  return 'all';
};

export default function AdminOrders() {
  const [searchParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [workflowSettings, setWorkflowSettings] = useState<any | null>(null);
  const [savingWorkflow, setSavingWorkflow] = useState(false);
  const [workflowMessage, setWorkflowMessage] = useState('');
  const [ticketingSettings, setTicketingSettings] = useState<any | null>(null);
  const [savingTicketing, setSavingTicketing] = useState(false);
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);
  const [supportInitialTab, setSupportInitialTab] = useState<'details' | 'ticket'>('ticket');
  const [tickets, setTickets] = useState<AdminTicketRow[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('');
  const [ticketEscalatedFilter, setTicketEscalatedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [ticketAssignedRoleFilter, setTicketAssignedRoleFilter] = useState('');
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPages, setTicketPages] = useState(1);
  const [adminRoleOptions, setAdminRoleOptions] = useState<Array<{ id: string; name: string }>>([]);
  const activeManagementTab = resolveOrderManagementTab(searchParams.get('tab'));
  const showOrderList = activeManagementTab === 'all' || activeManagementTab === 'list';
  const showTicketQueue = activeManagementTab === 'all' || activeManagementTab === 'ticket-queue';
  const showTicketingWorkflow = activeManagementTab === 'all' || activeManagementTab === 'ticketing-workflow';
  const showProcessingWorkflow = activeManagementTab === 'all' || activeManagementTab === 'processing-workflow';
  const formatTicketRoleLabel = (value: unknown) => {
    const token = String(value || '').trim();
    if (!token) return '';
    if (token.startsWith('ADMIN_ROLE:')) {
      const roleId = token.slice('ADMIN_ROLE:'.length);
      const matched = adminRoleOptions.find((row) => row.id === roleId);
      return matched ? `Admin Role: ${matched.name}` : 'Admin Role';
    }
    if (token === 'ADMINISTRATOR') return 'Admin';
    if (token === 'QA_TEAM') return 'QA';
    if (token === 'FABRIC_SELLER') return 'Seller';
    if (token === 'FASHION_DESIGNER') return 'Designer';
    if (token === 'CUSTOMER') return 'Customer';
    return token;
  };

  useEffect(() => {
    fetchOrders();
    fetchWorkflowSettings();
    fetchTicketingSettings();
    void fetchAdminRoles();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchTickets();
    }, 250);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketSearch, ticketStatusFilter, ticketEscalatedFilter, ticketAssignedRoleFilter, ticketPage]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getOrders({
        status: statusFilter || undefined,
      });
      if (response.success) {
        const rows = Array.isArray((response.data as any)?.orders) ? (response.data as any).orders : [];
        setOrders(rows.map((row: any) => normalizeOrderRow(row)));
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkflowSettings = async () => {
    try {
      const response = await api.admin.getOrderWorkflowSettings();
      if (response.success) {
        setWorkflowSettings(response.data || null);
      }
    } catch (error) {
      console.error('Failed to fetch workflow settings:', error);
    }
  };

  const fetchTicketingSettings = async () => {
    try {
      const response = await api.admin.getOrderTicketingSettings();
      if (response.success) setTicketingSettings(response.data || null);
    } catch (error) {
      console.error('Failed to load ticketing settings:', error);
    }
  };

  const fetchAdminRoles = async () => {
    try {
      const response = await api.admin.getAdminRoles();
      if (response.success) {
        const rows = Array.isArray(response.data) ? response.data : [];
        setAdminRoleOptions(
          rows
            .filter((row: any) => row?.isActive !== false)
            .map((row: any) => ({ id: String(row.id || ''), name: String(row.name || '') }))
            .filter((row) => row.id && row.name)
        );
      }
    } catch (error) {
      console.error('Failed to load admin roles for ticketing controls:', error);
      setAdminRoleOptions([]);
    }
  };

  const fetchTickets = async () => {
    try {
      setTicketsLoading(true);
      const response = await api.orders.listAdminTickets({
        search: ticketSearch || undefined,
        status: ticketStatusFilter || undefined,
        assignedRole: ticketAssignedRoleFilter || undefined,
        escalated: ticketEscalatedFilter === 'all' ? undefined : ticketEscalatedFilter === 'yes',
        page: ticketPage,
        limit: 8,
      });
      if (response.success) {
        setTickets(Array.isArray(response.data) ? (response.data as AdminTicketRow[]) : []);
        setTicketPages(Math.max(1, Number((response as any)?.pagination?.pages || 1)));
      }
    } catch (error) {
      console.error('Failed to load tickets:', error);
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleSaveWorkflowSettings = async () => {
    if (!workflowSettings) return;
    try {
      setSavingWorkflow(true);
      setWorkflowMessage('');
      const response = await api.admin.updateOrderWorkflowSettings(workflowSettings);
      if (response.success) {
        setWorkflowSettings(response.data || workflowSettings);
        setWorkflowMessage('Order workflow settings saved.');
      }
    } catch (error: any) {
      setWorkflowMessage(error?.response?.data?.message || 'Failed to save workflow settings.');
    } finally {
      setSavingWorkflow(false);
    }
  };

  const handleRunAutoClose = async () => {
    try {
      const response = await api.admin.autoCloseOverdueOrders();
      setWorkflowMessage(response.message || 'Auto-close completed.');
      fetchOrders();
    } catch (error: any) {
      setWorkflowMessage(error?.response?.data?.message || 'Auto-close failed.');
    }
  };

  const handleSaveTicketingSettings = async () => {
    if (!ticketingSettings) return;
    try {
      setSavingTicketing(true);
      setWorkflowMessage('');
      const response = await api.admin.updateOrderTicketingSettings(ticketingSettings);
      if (response.success) {
        setTicketingSettings(response.data || ticketingSettings);
        setWorkflowMessage('Order ticketing settings saved.');
      }
    } catch (error: any) {
      setWorkflowMessage(error?.response?.data?.message || 'Failed to save order ticketing settings.');
    } finally {
      setSavingTicketing(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const orderNumber = String(order?.orderNumber || '').toLowerCase();
    const customerName = String(order?.customerName || '').toLowerCase();
    const matchesSearch = 
      orderNumber.includes(search.toLowerCase()) ||
      customerName.includes(search.toLowerCase());
    const matchesStatus = !statusFilter || String(order?.status || '') === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
        <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
        <Button variant="outline" onClick={fetchOrders}>
          Refresh
        </Button>
      </div>

      {/* Filters */}
      {showOrderList ? (
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="">All Status</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PAYMENT_CONFIRMED">Payment Confirmed</option>
          <option value="FABRIC_PENDING">Fabric Pending</option>
          <option value="FABRIC_CONFIRMED">Fabric Confirmed</option>
          <option value="FABRIC_SHIPPED">Fabric Shipped</option>
          <option value="FABRIC_RECEIVED">Fabric Received</option>
          <option value="IN_PRODUCTION">In Production</option>
          <option value="PRODUCTION_COMPLETE">Production Complete</option>
          <option value="QA_PENDING">QA Pending</option>
          <option value="QA_INSPECTING">QA Inspecting</option>
          <option value="QA_APPROVED">QA Approved</option>
          <option value="QA_REJECTED">QA Rejected</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <Button variant="outline" onClick={fetchOrders}>
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>
      ) : null}

      {showProcessingWorkflow && workflowSettings ? (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Order Processing Workflow</h2>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleRunAutoClose}>
                Auto-close overdue delivered
              </Button>
              <Button onClick={handleSaveWorkflowSettings} disabled={savingWorkflow}>
                {savingWorkflow ? 'Saving...' : 'Save Workflow'}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm text-gray-700">
              Processing mode
              <select
                value={workflowSettings.processingMode || 'MANUAL'}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({ ...prev, processingMode: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="MANUAL">Manual admin verification</option>
                <option value="AUTO">Auto processing (criteria required)</option>
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Auto-close window (days)
              <input
                type="number"
                min={1}
                max={60}
                value={workflowSettings.autoCloseDays || 3}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({ ...prev, autoCloseDays: Number(event.target.value || 3) }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Reminder lead time (hours)
              <input
                type="number"
                min={1}
                max={720}
                value={workflowSettings.reminderLeadHours || 24}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({
                    ...prev,
                    reminderLeadHours: Number(event.target.value || 24),
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm text-gray-700">
              Admin review SLA (hrs)
              <input
                type="number"
                min={1}
                value={workflowSettings.slaHours?.adminReview || 24}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({
                    ...prev,
                    slaHours: { ...(prev?.slaHours || {}), adminReview: Number(event.target.value || 24) },
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Vendor fulfillment SLA (hrs)
              <input
                type="number"
                min={1}
                value={workflowSettings.slaHours?.vendorFulfillment || 72}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({
                    ...prev,
                    slaHours: { ...(prev?.slaHours || {}), vendorFulfillment: Number(event.target.value || 72) },
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              QA review SLA (hrs)
              <input
                type="number"
                min={1}
                value={workflowSettings.slaHours?.qaReview || 24}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({
                    ...prev,
                    slaHours: { ...(prev?.slaHours || {}), qaReview: Number(event.target.value || 24) },
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Customer concern window (hrs)
              <input
                type="number"
                min={1}
                value={workflowSettings.slaHours?.customerConcernWindow || 72}
                onChange={(event) =>
                  setWorkflowSettings((prev: any) => ({
                    ...prev,
                    slaHours: {
                      ...(prev?.slaHours || {}),
                      customerConcernWindow: Number(event.target.value || 72),
                    },
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>
          <div className="rounded-lg border border-gray-200 p-3">
            <h3 className="text-sm font-semibold text-gray-900">Order Limits by Category</h3>
            <p className="mt-1 text-xs text-gray-600">
              Configure maximum/minimum checkout limits for Ready To Wear, Custom To Wear, and Fabric To Buy.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <label className="text-sm text-gray-700">
                RTW max units/order
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={Number(workflowSettings.orderLimits?.maxReadyToWearUnitsPerOrder || 3)}
                  onChange={(event) =>
                    setWorkflowSettings((prev: any) => ({
                      ...prev,
                      orderLimits: {
                        ...(prev?.orderLimits || {}),
                        maxReadyToWearUnitsPerOrder: Number(event.target.value || 3),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                CTW max items/checkout
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={Number(workflowSettings.orderLimits?.maxCustomToWearItemsPerCheckout || 3)}
                  onChange={(event) =>
                    setWorkflowSettings((prev: any) => ({
                      ...prev,
                      orderLimits: {
                        ...(prev?.orderLimits || {}),
                        maxCustomToWearItemsPerCheckout: Number(event.target.value || 3),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                FTB min yards/order
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={Number(workflowSettings.orderLimits?.minFabricYardsPerOrder || 3)}
                  onChange={(event) =>
                    setWorkflowSettings((prev: any) => ({
                      ...prev,
                      orderLimits: {
                        ...(prev?.orderLimits || {}),
                        minFabricYardsPerOrder: Number(event.target.value || 3),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="text-sm text-gray-700">
                FTB max yards/checkout
                <input
                  type="number"
                  min={1}
                  max={5000}
                  value={Number(workflowSettings.orderLimits?.maxFabricYardsPerOrder || 200)}
                  onChange={(event) =>
                    setWorkflowSettings((prev: any) => ({
                      ...prev,
                      orderLimits: {
                        ...(prev?.orderLimits || {}),
                        maxFabricYardsPerOrder: Number(event.target.value || 200),
                      },
                    }))
                  }
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>
          </div>
          {workflowMessage ? <p className="text-xs text-emerald-700">{workflowMessage}</p> : null}
        </div>
      ) : null}

      {showTicketingWorkflow && ticketingSettings ? (
        <div className="bg-white rounded-xl border p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-gray-900">Order Ticketing Workflow Controls</h2>
            <Button onClick={handleSaveTicketingSettings} disabled={savingTicketing}>
              {savingTicketing ? 'Saving...' : 'Save Ticketing Settings'}
            </Button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ticketingSettings.enabled !== false}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), enabled: event.target.checked }))
                }
              />
              Enable ticketing on orders
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(ticketingSettings.defaultVisibleToCustomer)}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), defaultVisibleToCustomer: event.target.checked }))
                }
              />
              Internal team messages visible to customer by default
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(ticketingSettings.allowVendorToVendorDirect)}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), allowVendorToVendorDirect: event.target.checked }))
                }
              />
              Allow Seller ↔ Designer messaging
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(ticketingSettings.allowVendorToCustomerDirect)}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), allowVendorToCustomerDirect: event.target.checked }))
                }
              />
              Allow Vendor → Customer messaging
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={Boolean(ticketingSettings.allowCustomerToVendorDirect)}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), allowCustomerToVendorDirect: event.target.checked }))
                }
              />
              Allow Customer → Vendor messaging
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ticketingSettings.allowQaToVendorMessaging !== false}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), allowQaToVendorMessaging: event.target.checked }))
                }
              />
              Allow QA ↔ Vendor messaging
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={ticketingSettings.autoAssignEnabled !== false}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), autoAssignEnabled: event.target.checked }))
                }
              />
              Auto-assign new tickets
            </label>
            <label className="text-sm text-gray-700">
              Auto-assign role
              <select
                value={String(ticketingSettings.autoAssignRole || 'QA_TEAM')}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), autoAssignRole: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="QA_TEAM">QA</option>
                <option value="ADMINISTRATOR">Admin</option>
                <option value="FABRIC_SELLER">Seller</option>
                <option value="FASHION_DESIGNER">Designer</option>
                {adminRoleOptions.map((role) => (
                  <option key={`auto-${role.id}`} value={`ADMIN_ROLE:${role.id}`}>
                    Admin Role: {role.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Ticket response SLA (hours)
              <input
                type="number"
                min={1}
                max={720}
                value={Number(ticketingSettings.slaResponseHours || 24)}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({
                    ...(prev || {}),
                    slaResponseHours: Number(event.target.value || 24),
                  }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm text-gray-700">
              Escalation role
              <select
                value={String(ticketingSettings.escalationRole || 'ADMINISTRATOR')}
                onChange={(event) =>
                  setTicketingSettings((prev: any) => ({ ...(prev || {}), escalationRole: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border px-3 py-2"
              >
                <option value="ADMINISTRATOR">Admin</option>
                <option value="QA_TEAM">QA</option>
                <option value="FABRIC_SELLER">Seller</option>
                <option value="FASHION_DESIGNER">Designer</option>
                {adminRoleOptions.map((role) => (
                  <option key={`esc-${role.id}`} value={`ADMIN_ROLE:${role.id}`}>
                    Admin Role: {role.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : null}

      {showTicketQueue ? (
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Ticket Queue</h2>
          <Button variant="outline" onClick={() => void fetchTickets()} disabled={ticketsLoading}>
            Refresh Tickets
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            value={ticketSearch}
            onChange={(event) => {
              setTicketPage(1);
              setTicketSearch(event.target.value);
            }}
            placeholder="Search order #, subject, customer"
            className="rounded-lg border px-3 py-2 text-sm"
          />
          <select
            value={ticketStatusFilter}
            onChange={(event) => {
              setTicketPage(1);
              setTicketStatusFilter(event.target.value);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="OPEN">OPEN</option>
            <option value="PENDING">PENDING</option>
            <option value="RESOLVED">RESOLVED</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <select
            value={ticketAssignedRoleFilter}
            onChange={(event) => {
              setTicketPage(1);
              setTicketAssignedRoleFilter(event.target.value);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">All assignees</option>
            <option value="ADMINISTRATOR">Admin</option>
            <option value="QA_TEAM">QA</option>
            <option value="FABRIC_SELLER">Seller</option>
            <option value="FASHION_DESIGNER">Designer</option>
            {adminRoleOptions.map((role) => (
              <option key={`filter-${role.id}`} value={`ADMIN_ROLE:${role.id}`}>
                Admin Role: {role.name}
              </option>
            ))}
          </select>
          <select
            value={ticketEscalatedFilter}
            onChange={(event) => {
              setTicketPage(1);
              setTicketEscalatedFilter(event.target.value as 'all' | 'yes' | 'no');
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            <option value="all">Escalation: all</option>
            <option value="yes">Escalated only</option>
            <option value="no">Not escalated</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Order</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Ticket</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Assignee</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Due</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Messages</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Action</th>
              </tr>
            </thead>
            <tbody>
              {ticketsLoading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    Loading tickets...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No tickets found.
                  </td>
                </tr>
              ) : (
                tickets.map((ticket) => (
                  <tr key={ticket.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{ticket.orderNumber}</p>
                      <p className="text-xs text-gray-500">{ticket.customerName}</p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{ticket.status}</Badge>
                        {ticket.escalatedAt ? <Badge variant="red">Escalated</Badge> : null}
                      </div>
                      <p className="mt-1 max-w-[300px] truncate text-xs text-gray-600">
                        {ticket.subject || ticket.lastMessagePreview || 'No subject'}
                      </p>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {ticket.assignedToUserName || formatTicketRoleLabel(ticket.assignedToRole) || 'Unassigned'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {ticket.dueAt ? new Date(ticket.dueAt).toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">{ticket.messageCount}</td>
                    <td className="px-3 py-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSupportInitialTab('ticket');
                          setSupportOrderId(ticket.orderId);
                        }}
                      >
                        Open
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={ticketPage <= 1}
            onClick={() => setTicketPage((previous) => Math.max(1, previous - 1))}
          >
            Prev
          </Button>
          <span className="text-xs text-gray-500">
            Page {ticketPage} / {ticketPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={ticketPage >= ticketPages}
            onClick={() => setTicketPage((previous) => Math.min(ticketPages, previous + 1))}
          >
            Next
          </Button>
        </div>
      </div>
      ) : null}

      {/* Orders Table */}
      {showOrderList ? (
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Order</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Customer</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Amount</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Design</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Fabric</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">QA</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Date</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{order.orderNumber}</td>
                  <td className="py-3 px-4">{order.customerName}</td>
                  <td className="py-3 px-4 font-medium">${order.totalAmount.toFixed(2)}</td>
                  <td className="py-3 px-4">
                    <Badge 
                      variant={
                        order.status === 'DELIVERED' ? 'green' :
                        order.status === 'SHIPPED' ? 'blue' :
                        order.status === 'IN_PRODUCTION' ? 'purple' :
                        order.status === 'PENDING' ? 'yellow' : 'gray'
                      }
                    >
                      {order.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs">
                      {order.designStatus}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs">
                      {order.fabricStatus}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="outline" className="text-xs">
                      {order.qaStatus}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setSupportInitialTab('ticket');
                          setSupportOrderId(order.id);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Open ticket console"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      ) : null}

      {/* Order Detail Modal */}
      {showDetailModal && selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
          <div className="mx-auto w-full max-w-4xl rounded-2xl bg-white p-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold">Order Details</h3>
              <button 
                onClick={() => setShowDetailModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Order Number</p>
                  <p className="text-lg font-bold">{selectedOrder.orderNumber}</p>
                </div>
                <Badge 
                  variant={
                    selectedOrder.status === 'DELIVERED' ? 'green' :
                    selectedOrder.status === 'SHIPPED' ? 'blue' :
                    selectedOrder.status === 'IN_PRODUCTION' ? 'purple' :
                    selectedOrder.status === 'PENDING' ? 'yellow' : 'gray'
                  }
                >
                  {selectedOrder.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Customer</p>
                  <p className="font-medium">{selectedOrder.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Amount</p>
                  <p className="font-medium text-amber-700">${selectedOrder.totalAmount.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Designer</p>
                  <p className="font-medium">{selectedOrder.designerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Fabric Seller</p>
                  <p className="font-medium">{selectedOrder.fabricSellerName}</p>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-3">Order Progress</p>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-purple-600" />
                      <span>Design Production</span>
                    </div>
                    <Badge variant="outline">{selectedOrder.designStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5 text-blue-600" />
                      <span>Fabric Delivery</span>
                    </div>
                    <Badge variant="outline">{selectedOrder.fabricStatus}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <UserCheck className="w-5 h-5 text-orange-600" />
                      <span>QA Review</span>
                    </div>
                    <Badge variant="outline">{selectedOrder.qaStatus}</Badge>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1">
                  <Truck className="w-4 h-4 mr-2" />
                  Update Tracking
                </Button>
                <Button variant="outline" className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSupportInitialTab('ticket');
                    setSupportOrderId(selectedOrder.id);
                  }}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Ticket Console
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      <OrderSupportModal
        isOpen={Boolean(supportOrderId)}
        orderId={supportOrderId}
        initialTab={supportInitialTab}
        onClose={() => setSupportOrderId(null)}
      />
    </div>
  );
}
