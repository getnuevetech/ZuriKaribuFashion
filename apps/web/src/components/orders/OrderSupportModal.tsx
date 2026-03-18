import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Paperclip, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useAuthStore } from '../../store/authStore';

type TicketRole = 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';
type TicketLanguageOption = { code: string; label: string };

const ROLE_LABELS: Record<TicketRole, string> = {
  CUSTOMER: 'Customer',
  FABRIC_SELLER: 'Seller',
  FASHION_DESIGNER: 'Designer',
  QA_TEAM: 'QA',
  ADMINISTRATOR: 'Admin',
};
const DEFAULT_TICKET_LANGUAGE_OPTIONS: TicketLanguageOption[] = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'de', label: 'German' },
  { code: 'ar', label: 'Arabic' },
  { code: 'sw', label: 'Swahili' },
  { code: 'zh-cn', label: 'Chinese (Simplified)' },
];
const AUTO_LANGUAGE_CODE = 'auto';

const statusLabel = (value: unknown) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .split('_')
    .map((part) => (part ? `${part[0]}${part.slice(1).toLowerCase()}` : part))
    .join(' ');

type ModalTab = 'details' | 'ticket';

interface OrderSupportModalProps {
  isOpen: boolean;
  orderId: string | null;
  initialTab?: ModalTab;
  onClose: () => void;
}

export default function OrderSupportModal({
  isOpen,
  orderId,
  initialTab = 'details',
  onClose,
}: OrderSupportModalProps) {
  const { user } = useAuthStore();
  const isCustomerUser = String(user?.role || '').toUpperCase() === 'CUSTOMER';
  const [activeTab, setActiveTab] = useState<ModalTab>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [thread, setThread] = useState<any>(null);
  const [messageBody, setMessageBody] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<TicketRole[]>([]);
  const [visibleToCustomer, setVisibleToCustomer] = useState(false);
  const [sending, setSending] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [messageNotice, setMessageNotice] = useState('');
  const [attachmentUrls, setAttachmentUrls] = useState<string[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [messageSourceLanguage, setMessageSourceLanguage] = useState(AUTO_LANGUAGE_CODE);
  const [supportedLanguages, setSupportedLanguages] = useState<TicketLanguageOption[]>(DEFAULT_TICKET_LANGUAGE_OPTIONS);
  const [languageSaving, setLanguageSaving] = useState(false);

  const loadData = async () => {
    if (!orderId || !isOpen) return;
    try {
      setLoading(true);
      setError('');
      const [orderRes, threadRes] = await Promise.all([api.orders.getOrder(orderId), api.orders.getOrderTicketThread(orderId)]);
      if (orderRes.success) setOrderDetail(orderRes.data || null);
      if (threadRes.success) {
        const threadData = threadRes.data || null;
        setThread(threadData);
        const allowed = Array.isArray(threadData?.permissions?.allowedRecipientRoles)
          ? (threadData.permissions.allowedRecipientRoles as TicketRole[])
          : [];
        const languageRows = Array.isArray(threadData?.language?.supportedLanguages)
          ? (threadData.language.supportedLanguages as TicketLanguageOption[])
          : DEFAULT_TICKET_LANGUAGE_OPTIONS;
        setSupportedLanguages(languageRows.length > 0 ? languageRows : DEFAULT_TICKET_LANGUAGE_OPTIONS);
        setPreferredLanguage(
          String(threadData?.language?.viewerPreferredLanguage || threadData?.language?.defaultLanguage || 'en')
            .trim()
            .toLowerCase() || 'en'
        );
        setSelectedRecipients(isCustomerUser ? [] : allowed.slice(0, Math.min(2, allowed.length)));
        setVisibleToCustomer(Boolean(threadData?.settings?.defaultVisibleToCustomer));
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to load order details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialTab);
    setMessageBody('');
    setMessageNotice('');
    setAttachmentUrls([]);
    setMessageSourceLanguage(AUTO_LANGUAGE_CODE);
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId, initialTab, isCustomerUser]);

  const reloadThread = async () => {
    if (!orderId) return;
    const response = await api.orders.getOrderTicketThread(orderId);
    if (response.success) {
      const threadData = response.data || null;
      setThread(threadData);
      const languageRows = Array.isArray(threadData?.language?.supportedLanguages)
        ? (threadData.language.supportedLanguages as TicketLanguageOption[])
        : DEFAULT_TICKET_LANGUAGE_OPTIONS;
      setSupportedLanguages(languageRows.length > 0 ? languageRows : DEFAULT_TICKET_LANGUAGE_OPTIONS);
      const language = String(threadData?.language?.viewerPreferredLanguage || preferredLanguage || 'en')
        .trim()
        .toLowerCase();
      if (language) {
        setPreferredLanguage(language);
      }
    }
  };

  const allowedRecipientRoles = useMemo(
    () => (Array.isArray(thread?.permissions?.allowedRecipientRoles) ? (thread.permissions.allowedRecipientRoles as TicketRole[]) : []),
    [thread]
  );
  const languageLabelByCode = useMemo(
    () =>
      new Map(
        (supportedLanguages || []).map((row) => [String(row.code || '').trim().toLowerCase(), String(row.label || '').trim()])
      ),
    [supportedLanguages]
  );
  const resolveLanguageLabel = (code: unknown) =>
    languageLabelByCode.get(String(code || '').trim().toLowerCase()) ||
    String(code || '')
      .trim()
      .toUpperCase() ||
    'Unknown';

  const handlePreferredLanguageChange = async (nextLanguage: string) => {
    const normalized = String(nextLanguage || '').trim().toLowerCase();
    if (!normalized) return;
    setPreferredLanguage(normalized);
    try {
      setLanguageSaving(true);
      const response = await api.orders.updateTicketingLanguagePreference({ language: normalized });
      if (response.success) {
        setMessageNotice('Ticket language updated.');
      }
      await reloadThread();
    } catch (languageError: any) {
      setMessageNotice(languageError?.response?.data?.message || languageError?.message || 'Failed to update ticket language.');
    } finally {
      setLanguageSaving(false);
    }
  };

  const toggleRecipient = (role: TicketRole) => {
    setSelectedRecipients((previous) => {
      if (previous.includes(role)) return previous.filter((entry) => entry !== role);
      return [...previous, role];
    });
  };

  const handleAttachmentUpload = async (file: File | null) => {
    if (!file) return;
    try {
      setUploadingAttachment(true);
      setMessageNotice('');
      const formData = new FormData();
      formData.append('image', file);
      const response = await api.upload.image(formData);
      if (response.success && response.data?.url) {
        setAttachmentUrls((previous) => Array.from(new Set([...previous, String(response.data.url)])).slice(0, 12));
      } else {
        setMessageNotice('Attachment upload failed.');
      }
    } catch (uploadError: any) {
      setMessageNotice(uploadError?.response?.data?.message || uploadError?.message || 'Attachment upload failed.');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = (url: string) => {
    setAttachmentUrls((previous) => previous.filter((entry) => entry !== url));
  };

  const handleSendMessage = async () => {
    if (!orderId || !String(messageBody || '').trim()) return;
    try {
      setSending(true);
      setMessageNotice('');
      const payload: {
        body: string;
        recipientRoles?: TicketRole[];
        attachments?: string[];
        visibleToCustomer?: boolean;
        sourceLanguage?: string;
      } = {
        body: String(messageBody || '').trim(),
      };
      const selectedSourceLanguage = String(messageSourceLanguage || AUTO_LANGUAGE_CODE).trim().toLowerCase() || AUTO_LANGUAGE_CODE;
      if (selectedSourceLanguage && selectedSourceLanguage !== AUTO_LANGUAGE_CODE) {
        payload.sourceLanguage = selectedSourceLanguage;
      }
      if (!isCustomerUser && selectedRecipients.length > 0) payload.recipientRoles = selectedRecipients;
      if (attachmentUrls.length > 0) payload.attachments = attachmentUrls;
      if (thread?.permissions?.canControlCustomerVisibility) {
        payload.visibleToCustomer = Boolean(visibleToCustomer);
      }
      const response = await api.orders.sendOrderTicketMessage(orderId, payload);
      if (response.success) {
        setMessageBody('');
        setAttachmentUrls([]);
        setMessageSourceLanguage(AUTO_LANGUAGE_CODE);
        setMessageNotice('Message sent.');
        await reloadThread();
      }
    } catch (sendError: any) {
      setMessageNotice(sendError?.response?.data?.message || sendError?.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateTicketStatus = async (nextStatus: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') => {
    if (!orderId) return;
    try {
      setStatusSaving(true);
      setMessageNotice('');
      const response = await api.orders.updateOrderTicketStatus(orderId, nextStatus);
      if (response.success) {
        setMessageNotice('Ticket status updated.');
        await reloadThread();
      }
    } catch (statusError: any) {
      setMessageNotice(statusError?.response?.data?.message || statusError?.message || 'Failed to update ticket status.');
    } finally {
      setStatusSaving(false);
    }
  };

  if (!isOpen || !orderId) return null;

  const orderNumber = String(orderDetail?.orderNumber || thread?.orderNumber || 'Order');
  const orderStatus = String(orderDetail?.status || 'PENDING');
  const totalAmount = Number(orderDetail?.totalAmount ?? orderDetail?.total ?? 0);
  const subtotalAmountRaw = Number(orderDetail?.subtotal ?? orderDetail?.subtotalAmount ?? 0);
  const shippingAmount = Number(orderDetail?.shippingCost ?? orderDetail?.shippingCostUsd ?? 0);
  const taxAmount = Number(orderDetail?.tax ?? orderDetail?.taxAmount ?? 0);
  const createdAtLabel = orderDetail?.createdAt ? new Date(orderDetail.createdAt).toLocaleString() : '';
  const customerName = `${String(orderDetail?.customer?.firstName || '').trim()} ${String(orderDetail?.customer?.lastName || '').trim()}`.trim();
  const timeline = Array.isArray(orderDetail?.timeline) ? orderDetail.timeline : [];
  const shippingAddress = orderDetail?.shippingAddress && typeof orderDetail.shippingAddress === 'object' ? orderDetail.shippingAddress : {};
  const readyToWearItems = Array.isArray(orderDetail?.readyToWearItems) ? orderDetail.readyToWearItems : [];
  const invoiceLineItems: Array<{ label: string; meta: string; quantity: number; unitPrice: number; lineTotal: number }> = [];
  if (Array.isArray(readyToWearItems) && readyToWearItems.length > 0) {
    for (const row of readyToWearItems) {
      const quantity = Math.max(1, Number(row?.quantity || 1));
      const unitPrice = Number(row?.price || row?.unitPrice || 0);
      const size = String(row?.size || '').trim();
      const color = String(row?.color || '').trim();
      invoiceLineItems.push({
        label: String(row?.readyToWear?.name || 'Ready To Wear'),
        meta: [size ? `Size ${size}` : '', color ? `Color ${color}` : ''].filter(Boolean).join(' • '),
        quantity,
        unitPrice,
        lineTotal: Number.isFinite(unitPrice) ? unitPrice * quantity : 0,
      });
    }
  }
  if (orderDetail?.designOrder) {
    const designPrice = Number(orderDetail?.designOrder?.price || 0);
    invoiceLineItems.push({
      label: String(orderDetail?.designOrder?.design?.name || 'Custom Design'),
      meta: 'Custom To Wear',
      quantity: 1,
      unitPrice: designPrice,
      lineTotal: designPrice,
    });
  }
  if (orderDetail?.fabricOrder) {
    const yards = Math.max(1, Number(orderDetail?.fabricOrder?.yards || 1));
    const unitPrice = Number(orderDetail?.fabricOrder?.pricePerYard || 0);
    const explicitTotal = Number(orderDetail?.fabricOrder?.totalPrice || 0);
    const computedTotal = Number.isFinite(explicitTotal) && explicitTotal > 0 ? explicitTotal : unitPrice * yards;
    invoiceLineItems.push({
      label: String(orderDetail?.fabricOrder?.fabric?.name || 'Fabric'),
      meta: `${yards} yard${yards === 1 ? '' : 's'}`,
      quantity: yards,
      unitPrice,
      lineTotal: computedTotal,
    });
  }
  const computedLineSubtotal = invoiceLineItems.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
  const subtotalAmount = subtotalAmountRaw > 0 ? subtotalAmountRaw : computedLineSubtotal;
  const checkoutPricingLabel =
    String(orderDetail?.checkoutPricingLabel || 'Checkout Pricing').trim() || 'Checkout Pricing';
  const checkoutPricingAdjustmentAmount = Number(
    orderDetail?.checkoutPricingAdjustmentUsd ?? orderDetail?.shippingAddress?.checkoutPricingAdjustmentUsd ?? 0
  );
  const promoDiscountAmount = Number(orderDetail?.discountUsd ?? 0);
  const baseItemsSubtotal = Math.max(
    0,
    Number((Number(subtotalAmount || 0) - Number(checkoutPricingAdjustmentAmount || 0) + Number(promoDiscountAmount || 0)).toFixed(2))
  );
  const formatSignedCurrency = (amount: number) =>
    `${Number(amount || 0) < 0 ? '-' : ''}$${Math.abs(Number(amount || 0)).toFixed(2)}`;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4">
      <div className="mx-auto w-full max-w-5xl rounded-2xl bg-white p-5 md:p-6 max-h-[94vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Order {orderNumber}</h3>
            <p className="text-xs text-gray-500 mt-1">Details and ticket communication thread</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2 border-b pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`rounded px-3 py-2 text-sm font-medium ${activeTab === 'details' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ticket')}
            className={`rounded px-3 py-2 text-sm font-medium ${activeTab === 'ticket' ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Contact / Ticket
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500">Loading...</div>
        ) : error ? (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
        ) : activeTab === 'details' ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Order Number</p>
                <p className="font-medium text-gray-900">{orderNumber}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Invoice Date</p>
                <p className="font-medium text-gray-900">{createdAtLabel || 'N/A'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-medium text-gray-900">{statusLabel(orderStatus)}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Total</p>
                <p className="font-medium text-gray-900">${Number(totalAmount || 0).toFixed(2)}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Customer</p>
                <p className="font-medium text-gray-900">{customerName || 'Customer'}</p>
              </div>
              <div className="rounded-lg border bg-gray-50 p-3">
                <p className="text-xs text-gray-500">Payment</p>
                <p className="font-medium text-gray-900">
                  {String(orderDetail?.paymentStatus || 'PENDING').toUpperCase()} • {String(orderDetail?.paymentMethod || 'N/A')}
                </p>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-gray-900 mb-2">Shipping</p>
              {String(shippingAddress.fullName || '').trim() ? (
                <p className="text-sm text-gray-700">{String(shippingAddress.fullName || '').trim()}</p>
              ) : null}
              <p className="text-sm text-gray-700">
                {String(shippingAddress.addressLine1 || shippingAddress.address || '').trim() || 'N/A'}
              </p>
              {String(shippingAddress.addressLine2 || '').trim() ? (
                <p className="text-sm text-gray-700">{String(shippingAddress.addressLine2 || '').trim()}</p>
              ) : null}
              <p className="text-xs text-gray-500 mt-1">
                {String(shippingAddress.city || '').trim()}
                {shippingAddress.city && shippingAddress.state ? ', ' : ''}
                {String(shippingAddress.state || '').trim()}
                {shippingAddress.state && shippingAddress.country ? ', ' : ''}
                {String(shippingAddress.country || '').trim()}
              </p>
              {String(shippingAddress.postalCode || '').trim() ? (
                <p className="text-xs text-gray-500">Postal code: {String(shippingAddress.postalCode || '').trim()}</p>
              ) : null}
              {String(shippingAddress.phone || '').trim() ? (
                <p className="text-xs text-gray-500">Phone: {String(shippingAddress.phone || '').trim()}</p>
              ) : null}
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-gray-900 mb-2">Invoice Items</p>
              {invoiceLineItems.length > 0 ? (
                <div className="space-y-2">
                  {invoiceLineItems.map((item, index) => (
                    <div key={`${item.label}-${index}`} className="rounded border bg-gray-50 p-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm font-semibold text-gray-900">${Number(item.lineTotal || 0).toFixed(2)}</p>
                      </div>
                      <p className="text-xs text-gray-600">
                        {item.meta || 'Item'} • Qty {item.quantity} • Unit ${Number(item.unitPrice || 0).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No item rows available for this order.</p>
              )}
              <div className="mt-3 border-t pt-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Items Subtotal</span>
                  <span>${Number(baseItemsSubtotal || 0).toFixed(2)}</span>
                </div>
                {Math.abs(Number(checkoutPricingAdjustmentAmount || 0)) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>{checkoutPricingLabel}</span>
                    <span className={checkoutPricingAdjustmentAmount < 0 ? 'text-green-700' : ''}>
                      {formatSignedCurrency(checkoutPricingAdjustmentAmount)}
                    </span>
                  </div>
                ) : null}
                {Number(promoDiscountAmount || 0) > 0 ? (
                  <div className="flex items-center justify-between">
                    <span>Promo Discount</span>
                    <span className="text-green-700">-${Number(promoDiscountAmount || 0).toFixed(2)}</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between font-medium text-gray-900">
                  <span>Subtotal</span>
                  <span>${Number(subtotalAmount || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Shipping</span>
                  <span>{Number(shippingAmount || 0) === 0 ? 'FREE' : `$${Number(shippingAmount || 0).toFixed(2)}`}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tax</span>
                  <span>${Number(taxAmount || 0).toFixed(2)}</span>
                </div>
                <div className="mt-1 flex items-center justify-between font-semibold text-gray-900">
                  <span>Grand Total</span>
                  <span>${Number(totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-gray-900 mb-2">Timeline</p>
              {timeline.length > 0 ? (
                <div className="space-y-2">
                  {timeline.map((entry: any) => (
                    <div key={entry.id} className="rounded border p-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">{statusLabel(entry.status)}</span>
                        <span className="text-xs text-gray-500">
                          {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}
                        </span>
                      </div>
                      {entry.notes ? <p className="mt-1 text-gray-600">{entry.notes}</p> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">No timeline entries yet.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">Ticket: {thread?.ticket?.id ? String(thread.ticket.id).slice(0, 8) : 'Not created'}</Badge>
              <Badge variant="outline">Status: {thread?.ticket?.status || 'OPEN'}</Badge>
              {thread?.ticket?.assignedToRole ? <Badge variant="outline">Assigned: {statusLabel(thread.ticket.assignedToRole)}</Badge> : null}
              {thread?.ticket?.dueAt ? (
                <Badge variant="outline">Due: {new Date(thread.ticket.dueAt).toLocaleString()}</Badge>
              ) : null}
              {thread?.ticket?.escalatedAt ? <Badge variant="red">Escalated</Badge> : null}
              {thread?.permissions?.canManageTicket ? (
                <select
                  className="rounded border px-2 py-1 text-xs"
                  value={thread?.ticket?.status || 'OPEN'}
                  onChange={(event) =>
                    void handleUpdateTicketStatus(event.target.value as 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED')
                  }
                  disabled={statusSaving}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RESOLVED">RESOLVED</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
              ) : null}
            </div>

            <div className="rounded-lg border bg-gray-50 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-medium text-gray-700">Preferred ticket language</label>
                <select
                  value={preferredLanguage}
                  onChange={(event) => void handlePreferredLanguageChange(event.target.value)}
                  disabled={languageSaving}
                  className="rounded border px-2 py-1 text-xs"
                >
                  {(supportedLanguages.length > 0 ? supportedLanguages : DEFAULT_TICKET_LANGUAGE_OPTIONS).map((row) => (
                    <option key={`ticket-language-${row.code}`} value={String(row.code || '').toLowerCase()}>
                      {row.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-500">
                  {languageSaving ? 'Saving...' : 'Messages are shown in your selected language when translation is available.'}
                </span>
              </div>
            </div>

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border bg-gray-50 p-3">
              {(thread?.messages || []).length === 0 ? (
                <p className="text-sm text-gray-500">No ticket messages yet.</p>
              ) : (
                (thread?.messages || []).map((message: any) => (
                  <div key={message.id} className="rounded border bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="font-medium text-gray-900">{message.senderDisplayName}</span>
                      <span>({ROLE_LABELS[message.senderRole as TicketRole] || message.senderRole})</span>
                      <span>•</span>
                      <span>{message.createdAt ? new Date(message.createdAt).toLocaleString() : ''}</span>
                      <Badge variant={message.visibleToCustomer ? 'green' : 'gray'}>
                        {message.visibleToCustomer ? 'Visible to customer' : 'Internal'}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">{message.body}</p>
                    {message?.translated ? (
                      <p className="mt-1 text-[11px] text-gray-500">
                        Translated from {resolveLanguageLabel(message.sourceLanguage)} to{' '}
                        {resolveLanguageLabel(message.translatedToLanguage || preferredLanguage)}.
                      </p>
                    ) : null}
                    {message?.translated && String(message?.originalBody || '').trim() ? (
                      <details className="mt-2 rounded border border-gray-200 bg-gray-50 p-2">
                        <summary className="cursor-pointer text-[11px] font-medium text-gray-700">
                          View original message ({resolveLanguageLabel(message.sourceLanguage)})
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{String(message.originalBody || '')}</p>
                      </details>
                    ) : null}
                    {Array.isArray(message.attachments) && message.attachments.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.attachments.map((url: string) => (
                          <a
                            key={`${message.id}-${url}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            Attachment
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {thread?.permissions?.canPost ? (
              <div className="rounded-lg border p-3 space-y-3">
                {!isCustomerUser && allowedRecipientRoles.length > 0 ? (
                  <div>
                    <p className="text-xs font-medium text-gray-700 mb-1">Recipients</p>
                    <div className="flex flex-wrap gap-2">
                      {allowedRecipientRoles.map((role) => (
                        <label key={`recipient-${role}`} className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedRecipients.includes(role)}
                            onChange={() => toggleRecipient(role)}
                          />
                          {ROLE_LABELS[role]}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                {thread?.permissions?.canControlCustomerVisibility ? (
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={visibleToCustomer}
                      onChange={(event) => setVisibleToCustomer(event.target.checked)}
                    />
                    Open this message to customer
                  </label>
                ) : null}

                <label className="block text-xs text-gray-700">
                  Message input language (optional)
                  <select
                    value={messageSourceLanguage}
                    onChange={(event) =>
                      setMessageSourceLanguage(String(event.target.value || AUTO_LANGUAGE_CODE).trim().toLowerCase() || AUTO_LANGUAGE_CODE)
                    }
                    className="mt-1 w-full rounded border px-2 py-1 text-xs"
                  >
                    <option value={AUTO_LANGUAGE_CODE}>Auto detect from typed message</option>
                    {(supportedLanguages.length > 0 ? supportedLanguages : DEFAULT_TICKET_LANGUAGE_OPTIONS).map((row) => (
                      <option key={`source-language-${row.code}`} value={String(row.code || '').toLowerCase()}>
                        {row.label}
                      </option>
                    ))}
                  </select>
                </label>

                <textarea
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  placeholder="Write your message..."
                  className="min-h-[110px] w-full rounded border px-3 py-2 text-sm"
                />
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingAttachment ? 'Uploading...' : 'Add attachment'}
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        disabled={uploadingAttachment}
                        onChange={(event) => {
                          const file = event.target.files?.[0] || null;
                          void handleAttachmentUpload(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <span className="text-xs text-gray-500">Up to 12 attachments per message.</span>
                  </div>
                  {attachmentUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {attachmentUrls.map((url) => (
                        <button
                          key={url}
                          type="button"
                          onClick={() => removeAttachment(url)}
                          className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          <Paperclip className="h-3.5 w-3.5" />
                          Attached
                          <X className="h-3 w-3" />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-500">
                    Ticket is attached to this order. All messages are logged for operations traceability.
                  </p>
                  <Button onClick={() => void handleSendMessage()} disabled={sending || !String(messageBody || '').trim()}>
                    <MessageSquare className="mr-2 h-4 w-4" />
                    {sending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <p>Ticket messaging is currently disabled or unavailable for your role on this order.</p>
                </div>
              </div>
            )}

            {messageNotice ? (
              <p className={`text-xs ${messageNotice.toLowerCase().includes('fail') ? 'text-red-600' : 'text-emerald-700'}`}>
                {messageNotice}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

