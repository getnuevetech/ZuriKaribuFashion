import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const toMoney = (value: unknown) => Number(Number(value || 0).toFixed(2));

export default function AdminFeaturedRequests() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [settings, setSettings] = useState<any>({
    enabled: true,
    defaultDurationValue: 2,
    defaultDurationUnit: 'WEEKS',
    basePriceUsdByType: { FABRIC: 15, DESIGN: 25, READY_TO_WEAR: 20 },
    allowVendorRequestedDuration: true,
    maxDurationValue: 12,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage('');
      const [settingsRes, requestsRes] = await Promise.all([
        api.featuredRequests.getSettings(),
        api.featuredRequests.listAdminRequests({ search: search || undefined, status: statusFilter || undefined, limit: 120 }),
      ]);
      if (settingsRes.success) {
        setSettings(settingsRes.data || settings);
      }
      if (requestsRes.success) {
        setRequests(Array.isArray(requestsRes.data) ? requestsRes.data : []);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load featured requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      setMessage('');
      const response = await api.featuredRequests.updateSettings(settings);
      if (response.success) {
        setSettings(response.data || settings);
        setMessage('Featured request settings saved.');
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleReview = async (request: any, decision: 'APPROVE' | 'REJECT') => {
    try {
      setReviewingId(request.id);
      setMessage('');
      const approvedDurationValue = Math.max(
        1,
        Number(request.approvedDurationValue || request.requestedDurationValue || settings.defaultDurationValue || 2)
      );
      const approvedDurationUnit = String(
        request.approvedDurationUnit || request.requestedDurationUnit || settings.defaultDurationUnit || 'WEEKS'
      ).toUpperCase() as 'DAYS' | 'WEEKS' | 'MONTHS';
      const approvedPriceUsd = toMoney(
        request.approvedPriceUsd ??
          (Array.isArray(request.productEntries)
            ? request.productEntries.reduce(
                (sum: number, entry: any) =>
                  sum + Number(settings?.basePriceUsdByType?.[String(entry?.productType || '')] || 0),
                0
              )
            : 0)
      );
      const response = await api.featuredRequests.reviewAdminRequest(request.id, {
        decision,
        approvedDurationValue,
        approvedDurationUnit,
        approvedPriceUsd,
      });
      if (response.success) {
        setMessage(response.message || `Request ${decision === 'APPROVE' ? 'approved' : 'rejected'}.`);
        await loadData();
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to review request.');
    } finally {
      setReviewingId(null);
    }
  };

  const statusBadge = (value: string) => {
    const token = String(value || '').toUpperCase();
    if (token === 'ACTIVE') return <Badge variant="green">ACTIVE</Badge>;
    if (token === 'APPROVED_AWAITING_PAYMENT') return <Badge variant="blue">AWAITING PAYMENT</Badge>;
    if (token === 'REJECTED') return <Badge variant="red">REJECTED</Badge>;
    if (token === 'EXPIRED') return <Badge variant="gray">EXPIRED</Badge>;
    return <Badge variant="yellow">PENDING</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Featured Product Requests</h1>
          <p className="text-sm text-gray-600">Approve seller/designer paid requests and configure request pricing/timeframes.</p>
        </div>
        <Button onClick={() => void loadData()} variant="outline">
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Request Pricing & Duration Settings</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Fabric price (USD)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded border px-3 py-2"
              value={settings.basePriceUsdByType?.FABRIC ?? 0}
              onChange={(e) =>
                setSettings((prev: any) => ({
                  ...prev,
                  basePriceUsdByType: { ...(prev.basePriceUsdByType || {}), FABRIC: toMoney(e.target.value) },
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Design price (USD)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded border px-3 py-2"
              value={settings.basePriceUsdByType?.DESIGN ?? 0}
              onChange={(e) =>
                setSettings((prev: any) => ({
                  ...prev,
                  basePriceUsdByType: { ...(prev.basePriceUsdByType || {}), DESIGN: toMoney(e.target.value) },
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Ready-to-Wear price (USD)</span>
            <input
              type="number"
              min={0}
              step="0.01"
              className="rounded border px-3 py-2"
              value={settings.basePriceUsdByType?.READY_TO_WEAR ?? 0}
              onChange={(e) =>
                setSettings((prev: any) => ({
                  ...prev,
                  basePriceUsdByType: { ...(prev.basePriceUsdByType || {}), READY_TO_WEAR: toMoney(e.target.value) },
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Default duration value</span>
            <input
              type="number"
              min={1}
              max={24}
              className="rounded border px-3 py-2"
              value={settings.defaultDurationValue ?? 2}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, defaultDurationValue: Math.max(1, Number(e.target.value || 1)) }))}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Default duration unit</span>
            <select
              className="rounded border px-3 py-2"
              value={settings.defaultDurationUnit || 'WEEKS'}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, defaultDurationUnit: e.target.value }))}
            >
              <option value="DAYS">Days</option>
              <option value="WEEKS">Weeks</option>
              <option value="MONTHS">Months</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-gray-700">
            <span>Max duration value</span>
            <input
              type="number"
              min={1}
              max={36}
              className="rounded border px-3 py-2"
              value={settings.maxDurationValue ?? 12}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, maxDurationValue: Math.max(1, Number(e.target.value || 1)) }))}
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings.enabled)}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable featured product requests
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings.allowVendorRequestedDuration)}
              onChange={(e) => setSettings((prev: any) => ({ ...prev, allowVendorRequestedDuration: e.target.checked }))}
            />
            Allow vendor to suggest duration
          </label>
          <Button onClick={handleSaveSettings} disabled={savingSettings}>
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            className="w-full max-w-sm rounded border px-3 py-2"
            placeholder="Search requests..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="rounded border px-3 py-2" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED_AWAITING_PAYMENT">Awaiting payment</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXPIRED">Expired</option>
          </select>
          <Button variant="outline" onClick={() => void loadData()}>
            Apply
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Requester</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Products</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Duration</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Price</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Status</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    Loading featured requests...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No featured requests found.
                  </td>
                </tr>
              ) : (
                requests.map((request) => {
                  const entries = Array.isArray(request.productEntries) ? request.productEntries : [];
                  const duration = `${request.approvedDurationValue || request.requestedDurationValue || '-'} ${
                    request.approvedDurationUnit || request.requestedDurationUnit || ''
                  }`;
                  return (
                    <tr key={request.id}>
                      <td className="px-3 py-3 align-top">
                        <div className="font-medium text-gray-900">{request.requesterName || request.requesterUserId}</div>
                        <div className="text-xs text-gray-500">{request.requesterEmail || request.requesterRole}</div>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <div className="space-y-1">
                          {entries.map((entry: any, idx: number) => (
                            <div key={`${request.id}-${idx}`} className="text-xs text-gray-700">
                              {String(entry.productType || '').replaceAll('_', ' ')}: {entry.productId}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top text-gray-700">{duration}</td>
                      <td className="px-3 py-3 align-top text-gray-700">
                        ${toMoney(request.approvedPriceUsd ?? 0).toFixed(2)}
                        <div className="mt-1 text-xs text-gray-500">Payment: {request.paymentStatus || 'UNPAID'}</div>
                      </td>
                      <td className="px-3 py-3 align-top">{statusBadge(request.requestStatus)}</td>
                      <td className="px-3 py-3 align-top">
                        {(request.requestStatus === 'PENDING' || request.requestStatus === 'APPROVED_AWAITING_PAYMENT') && (
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => void handleReview(request, 'APPROVE')} disabled={reviewingId === request.id}>
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleReview(request, 'REJECT')}
                              disabled={reviewingId === request.id}
                            >
                              Reject
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

