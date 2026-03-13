import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, MessageSquare, Paperclip, Upload, X } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

type TicketRole = 'CUSTOMER' | 'FABRIC_SELLER' | 'FASHION_DESIGNER' | 'QA_TEAM' | 'ADMINISTRATOR';

const ROLE_LABELS: Record<TicketRole, string> = {
  CUSTOMER: 'Customer',
  FABRIC_SELLER: 'Seller',
  FASHION_DESIGNER: 'Designer',
  QA_TEAM: 'QA',
  ADMINISTRATOR: 'Admin',
};

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

  const loadData = async () => {
    if (!orderId || !isOpen) return;
    try {
      setLoading(true);
      setError('');
      const [orderRes, threadRes] = await Promise.all([api.orders.getOrder(orderId), api.orders.getOrderTicketThread(orderId)]);
      if (orderRes.success) setOrderDetail(orderRes.data || null);
      if (threadRes.success) {
        setThread(threadRes.data || null);
        const allowed = Array.isArray(threadRes.data?.permissions?.allowedRecipientRoles)
          ? (threadRes.data.permissions.allowedRecipientRoles as TicketRole[])
          : [];
        setSelectedRecipients(allowed.slice(0, Math.min(2, allowed.length)));
        setVisibleToCustomer(Boolean(threadRes.data?.settings?.defaultVisibleToCustomer));
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
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, orderId, initialTab]);

  const reloadThread = async () => {
    if (!orderId) return;
    const response = await api.orders.getOrderTicketThread(orderId);
    if (response.success) setThread(response.data || null);
  };

  const allowedRecipientRoles = useMemo(
    () => (Array.isArray(thread?.permissions?.allowedRecipientRoles) ? (thread.permissions.allowedRecipientRoles as TicketRole[]) : []),
    [thread]
  );

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
      } = {
        body: String(messageBody || '').trim(),
      };
      if (selectedRecipients.length > 0) payload.recipientRoles = selectedRecipients;
      if (attachmentUrls.length > 0) payload.attachments = attachmentUrls;
      if (thread?.permissions?.canControlCustomerVisibility) {
        payload.visibleToCustomer = Boolean(visibleToCustomer);
      }
      const response = await api.orders.sendOrderTicketMessage(orderId, payload);
      if (response.success) {
        setMessageBody('');
        setAttachmentUrls([]);
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
  const customerName = `${String(orderDetail?.customer?.firstName || '').trim()} ${String(orderDetail?.customer?.lastName || '').trim()}`.trim();
  const timeline = Array.isArray(orderDetail?.timeline) ? orderDetail.timeline : [];
  const shippingAddress = orderDetail?.shippingAddress && typeof orderDetail.shippingAddress === 'object' ? orderDetail.shippingAddress : {};

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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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
            </div>

            <div className="rounded-lg border p-3">
              <p className="text-sm font-semibold text-gray-900 mb-2">Shipping</p>
              <p className="text-sm text-gray-700">
                {String(shippingAddress.addressLine1 || shippingAddress.address || '').trim() || 'N/A'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {String(shippingAddress.city || '').trim()}
                {shippingAddress.city && shippingAddress.country ? ', ' : ''}
                {String(shippingAddress.country || '').trim()}
              </p>
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
                {allowedRecipientRoles.length > 0 ? (
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

