import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type FailedApprovalRow = {
  id: string;
  productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  productId: string;
  productName: string;
  productCategory: string;
  ownerName: string;
  latestFailureReason: string;
  updatedAt: string;
  messageCount: number;
};

type TicketMessage = {
  id: string;
  senderRole: string;
  body: string;
  createdAt: string;
};

const toTypeLabel = (type: FailedApprovalRow['productType']) =>
  type === 'FABRIC' ? 'Fabric To Buy' : type === 'READY_TO_WEAR' ? 'Ready To Wear' : 'Custom To Wear';

export default function AdminFailedAiApprovalPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<FailedApprovalRow[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [productType, setProductType] = useState<'ALL' | 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>('ALL');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [rerunning, setRerunning] = useState(false);

  const [ticketId, setTicketId] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<TicketMessage[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketSending, setTicketSending] = useState(false);
  const [ticketText, setTicketText] = useState('');

  const load = async (nextPage = page) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getFailedProductApprovals({
        search: search.trim() || undefined,
        category: category || undefined,
        productType: productType === 'ALL' ? undefined : productType,
        page: nextPage,
        limit: 20,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load failed AI approvals.');
      }
      const data: any = response.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setCategories(Array.isArray(data.categories) ? data.categories : []);
      setPage(Number(data?.pagination?.page || nextPage || 1));
      setPages(Math.max(1, Number(data?.pagination?.pages || 1)));
      setTotal(Number(data?.pagination?.total || 0));
      setSelected({});
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Failed to load failed AI approvals.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => selected[`${row.productType}:${row.productId}`]),
    [rows, selected]
  );

  const openTicket = async (row: FailedApprovalRow) => {
    try {
      setTicketId(row.id);
      setTicketLoading(true);
      setTicketText('');
      const response = await api.admin.getFailedProductApprovalTicketMessages(row.id);
      if (!response?.success) throw new Error(response?.message || 'Failed to load ticket messages.');
      const messages = Array.isArray(response?.data?.messages) ? response.data.messages : [];
      setTicketMessages(messages);
    } catch (ticketError: any) {
      setTicketMessages([]);
      setError(String(ticketError?.message || 'Failed to load ticket messages.'));
    } finally {
      setTicketLoading(false);
    }
  };

  const sendTicketMessage = async () => {
    if (!ticketId || !ticketText.trim()) return;
    try {
      setTicketSending(true);
      const response = await api.admin.sendFailedProductApprovalTicketMessage(ticketId, ticketText.trim());
      if (!response?.success) throw new Error(response?.message || 'Failed to send message.');
      setTicketText('');
      const refresh = await api.admin.getFailedProductApprovalTicketMessages(ticketId);
      setTicketMessages(Array.isArray(refresh?.data?.messages) ? refresh.data.messages : []);
    } catch (sendError: any) {
      setError(String(sendError?.message || 'Failed to send ticket message.'));
    } finally {
      setTicketSending(false);
    }
  };

  const rerunSelected = async () => {
    if (selectedRows.length === 0) return;
    try {
      setRerunning(true);
      setMessage('');
      setError('');
      const response = await api.admin.rerunFailedProductApprovals(
        selectedRows.map((row) => ({
          productType: row.productType,
          productId: row.productId,
        })),
        true
      );
      if (!response?.success) throw new Error(response?.message || 'Failed to rerun selected products.');
      const summary = response?.data?.summary;
      setMessage(
        `Rerun completed: ${Number(summary?.successCount || 0)} succeeded, ${Number(summary?.failedCount || 0)} failed.`
      );
      await load(page);
    } catch (rerunError: any) {
      setError(String(rerunError?.message || 'Failed to rerun selected products.'));
    } finally {
      setRerunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Failed AI Approval</h1>
            <p className="text-sm text-gray-600">
              Products that failed approval because of AI/API technical issues after one automatic rerun.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load(page)} disabled={loading}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button onClick={rerunSelected} disabled={rerunning || selectedRows.length === 0}>
              {rerunning ? 'Rerunning...' : `Rerun Selected (${selectedRows.length})`}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-lg border px-3 py-2 text-sm"
            placeholder="Search product/owner/reason"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select className="rounded-lg border px-3 py-2 text-sm" value={productType} onChange={(event) => setProductType(event.target.value as any)}>
            <option value="ALL">All product types</option>
            <option value="FABRIC">Fabric To Buy</option>
            <option value="DESIGN">Custom To Wear</option>
            <option value="READY_TO_WEAR">Ready To Wear</option>
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
          <Button onClick={() => void load(1)} disabled={loading}>
            Apply Filters
          </Button>
        </div>
        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading failed approvals...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Failure Reason</th>
                  <th className="px-4 py-3">Updated</th>
                  <th className="px-4 py-3">Ticket</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>
                      No failed AI approvals found.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const key = `${row.productType}:${row.productId}`;
                    return (
                      <tr key={key} className="border-t bg-red-50/40">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[key])}
                            onChange={(event) =>
                              setSelected((prev) => ({
                                ...prev,
                                [key]: event.target.checked,
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3">{toTypeLabel(row.productType)}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{row.productName}</p>
                          <p className="text-xs text-gray-500">{row.productId.slice(0, 8)}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{row.productCategory || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{row.ownerName || '-'}</td>
                        <td className="px-4 py-3 text-red-700">{row.latestFailureReason || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">{new Date(row.updatedAt).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <Button variant="outline" onClick={() => void openTicket(row)}>
                            Ticket ({Number(row.messageCount || 0)})
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm">
        <p className="text-gray-600">
          Page {page} of {pages} • {total} total
        </p>
        <div className="flex gap-2">
          <Button variant="outline" disabled={loading || page <= 1} onClick={() => void load(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" disabled={loading || page >= pages} onClick={() => void load(page + 1)}>
            Next
          </Button>
        </div>
      </div>

      {ticketId ? (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="mx-auto mt-8 w-full max-w-2xl rounded-xl bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Resolution Ticket</h2>
              <button className="text-sm text-gray-600 hover:text-gray-900" onClick={() => setTicketId(null)}>
                Close
              </button>
            </div>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border bg-gray-50 p-3">
              {ticketLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading messages...
                </div>
              ) : ticketMessages.length === 0 ? (
                <p className="text-sm text-gray-500">No messages yet.</p>
              ) : (
                <div className="space-y-2">
                  {ticketMessages.map((msg) => (
                    <div key={msg.id} className="rounded border bg-white p-2 text-sm">
                      <p className="text-xs font-semibold text-gray-500">{msg.senderRole}</p>
                      <p className="mt-1 whitespace-pre-wrap text-gray-800">{msg.body}</p>
                      <p className="mt-1 text-[11px] text-gray-500">{new Date(msg.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 space-y-2">
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                rows={3}
                placeholder="Send resolution message to seller/designer..."
                value={ticketText}
                onChange={(event) => setTicketText(event.target.value)}
              />
              <div className="flex justify-end">
                <Button onClick={sendTicketMessage} disabled={ticketSending || !ticketText.trim()}>
                  {ticketSending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

