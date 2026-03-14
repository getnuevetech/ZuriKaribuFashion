import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

type AdminTab = 'seller-earnings' | 'designer-earnings' | 'vendor-config' | 'withdrawal-integrations';

export default function AdminVendorPayments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as AdminTab) || 'seller-earnings';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sellerEarnings, setSellerEarnings] = useState<any[]>([]);
  const [designerEarnings, setDesignerEarnings] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [config, setConfig] = useState({
    releaseDelayDays: 7,
    minimumWithdrawalUsd: 25,
    slaHours: 72,
    platformFeePercent: 0,
    withdrawalOptions: [] as string[],
    payoutIntegrationProviders: [] as string[],
    notes: '',
  });
  const [withdrawalAction, setWithdrawalAction] = useState<Record<string, { status: string; adminNotes: string; payoutReference: string }>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [earningsRes, configRes, withdrawalsRes] = await Promise.all([
        api.admin.getVendorEarnings(),
        api.admin.getVendorPaymentConfig(),
        api.admin.getVendorWithdrawals(),
      ]);
      if (earningsRes.success) {
        setSellerEarnings(Array.isArray(earningsRes.data?.seller) ? earningsRes.data.seller : []);
        setDesignerEarnings(Array.isArray(earningsRes.data?.designer) ? earningsRes.data.designer : []);
      }
      if (configRes.success && configRes.data) {
        const data = configRes.data;
        setConfig({
          releaseDelayDays: Number(data.releaseDelayDays || 7),
          minimumWithdrawalUsd: Number(data.minimumWithdrawalUsd || 25),
          slaHours: Number(data.slaHours || 72),
          platformFeePercent: Number(data.platformFeePercent || 0),
          withdrawalOptions: Array.isArray(data.withdrawalOptions) ? data.withdrawalOptions : [],
          payoutIntegrationProviders: Array.isArray(data.payoutIntegrationProviders) ? data.payoutIntegrationProviders : [],
          notes: String(data.notes || ''),
        });
      }
      if (withdrawalsRes.success && Array.isArray(withdrawalsRes.data)) {
        setWithdrawals(withdrawalsRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load vendor payment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const activeRows = useMemo(() => (activeTab === 'designer-earnings' ? designerEarnings : sellerEarnings), [activeTab, sellerEarnings, designerEarnings]);

  const updateConfig = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const response = await api.admin.updateVendorPaymentConfig({
        ...config,
        releaseDelayDays: Math.max(0, Math.floor(Number(config.releaseDelayDays || 0))),
        minimumWithdrawalUsd: Number(config.minimumWithdrawalUsd || 0),
        slaHours: Math.max(1, Math.floor(Number(config.slaHours || 1))),
        platformFeePercent: Number(config.platformFeePercent || 0),
      });
      if (!response.success) {
        setError(response.message || 'Unable to save vendor payment configuration.');
        return;
      }
      setMessage(response.message || 'Vendor payment configuration saved.');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save vendor payment configuration.');
    } finally {
      setSaving(false);
    }
  };

  const applyWithdrawalUpdate = async (id: string) => {
    const draft = withdrawalAction[id];
    if (!draft?.status) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const response = await api.admin.updateVendorWithdrawal(id, {
        status: draft.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED',
        adminNotes: draft.adminNotes || undefined,
        payoutReference: draft.payoutReference || undefined,
      });
      if (!response.success) {
        setError(response.message || 'Unable to update withdrawal request.');
        return;
      }
      setMessage('Withdrawal request updated.');
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to update withdrawal request.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-black" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendor Payments</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor seller/designer earnings and configure payout terms, SLA, and withdrawal integrations.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={activeTab === 'seller-earnings' ? 'primary' : 'outline'} onClick={() => setSearchParams({ tab: 'seller-earnings' })}>
          Seller Earnings
        </Button>
        <Button size="sm" variant={activeTab === 'designer-earnings' ? 'primary' : 'outline'} onClick={() => setSearchParams({ tab: 'designer-earnings' })}>
          Designer Earnings
        </Button>
        <Button size="sm" variant={activeTab === 'vendor-config' ? 'primary' : 'outline'} onClick={() => setSearchParams({ tab: 'vendor-config' })}>
          Seller/Designer Payment Configuration
        </Button>
        <Button size="sm" variant={activeTab === 'withdrawal-integrations' ? 'primary' : 'outline'} onClick={() => setSearchParams({ tab: 'withdrawal-integrations' })}>
          Withdrawal Pay Integration
        </Button>
      </div>

      {(activeTab === 'seller-earnings' || activeTab === 'designer-earnings') && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {activeTab === 'designer-earnings' ? 'Designer Earnings' : 'Seller Earnings'}
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Vendor</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Order</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Amount</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Availability</th>
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {activeRows.map((entry) => (
                  <tr key={`${entry.vendorUserId}-${entry.orderId}-${entry.itemName}-${entry.createdAt}`}>
                    <td className="px-3 py-2">{entry.vendorName}</td>
                    <td className="px-3 py-2">{entry.orderNumber}</td>
                    <td className="px-3 py-2">{entry.itemName}</td>
                    <td className="px-3 py-2">${Number(entry.grossAmountUsd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      {entry.isAvailableForWithdrawal ? (
                        <Badge variant="green">Available</Badge>
                      ) : (
                        <span className="text-xs text-gray-500">{new Date(entry.availableAt).toLocaleDateString()}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={String(entry.paymentStatus || '').toUpperCase() === 'COMPLETED' ? 'green' : 'yellow'}>
                        {entry.paymentStatus || 'PENDING'}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {activeRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                      No earnings data found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'vendor-config' && (
        <div className="rounded-xl border bg-white p-4 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Seller/Designer Payment Configuration</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Funds Release Delay (days)</label>
              <input
                type="number"
                min="0"
                value={config.releaseDelayDays}
                onChange={(event) => setConfig((prev) => ({ ...prev, releaseDelayDays: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Withdrawal SLA (hours)</label>
              <input
                type="number"
                min="1"
                value={config.slaHours}
                onChange={(event) => setConfig((prev) => ({ ...prev, slaHours: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Minimum Withdrawal (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.minimumWithdrawalUsd}
                onChange={(event) => setConfig((prev) => ({ ...prev, minimumWithdrawalUsd: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Platform Fee (%)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={config.platformFeePercent}
                onChange={(event) => setConfig((prev) => ({ ...prev, platformFeePercent: Number(event.target.value || 0) }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Allowed Withdrawal Options (comma separated)</label>
              <input
                value={config.withdrawalOptions.join(', ')}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    withdrawalOptions: event.target.value
                      .split(',')
                      .map((entry) => entry.trim().toUpperCase())
                      .filter(Boolean),
                  }))
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
              <textarea
                value={config.notes}
                onChange={(event) => setConfig((prev) => ({ ...prev, notes: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm min-h-[90px]"
              />
            </div>
          </div>
          <Button onClick={updateConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      )}

      {activeTab === 'withdrawal-integrations' && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="text-lg font-semibold text-gray-900">Withdrawal Pay Integration Configuration</h2>
            <p className="text-sm text-gray-500">Set which payout integration providers are available for seller and designer withdrawals.</p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Payout Integration Providers (comma separated)</label>
              <input
                value={config.payoutIntegrationProviders.join(', ')}
                onChange={(event) =>
                  setConfig((prev) => ({
                    ...prev,
                    payoutIntegrationProviders: event.target.value
                      .split(',')
                      .map((entry) => entry.trim().toUpperCase())
                      .filter(Boolean),
                  }))
                }
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="BANK_TRANSFER, PAYPAL, FLUTTERWAVE_PAYOUT"
              />
            </div>
            <Button onClick={updateConfig} disabled={saving}>
              {saving ? 'Saving...' : 'Save Withdrawal Integration'}
            </Button>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-lg font-semibold text-gray-900">Withdrawal Requests</h3>
            <div className="space-y-3">
              {withdrawals.map((entry) => {
                const draft = withdrawalAction[entry.id] || {
                  status: String(entry.status || 'PENDING').toUpperCase(),
                  adminNotes: String(entry.adminNotes || ''),
                  payoutReference: String(entry.payoutReference || ''),
                };
                return (
                  <div key={entry.id} className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        {entry.vendorName} • ${Number(entry.amountUsd || 0).toFixed(2)}
                      </p>
                      <Badge variant={entry.status === 'PAID' ? 'green' : entry.status === 'REJECTED' ? 'red' : 'yellow'}>
                        {entry.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {entry.role} • {entry.methodType} • Requested {new Date(entry.requestedAt).toLocaleString()}
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <select
                        value={draft.status}
                        onChange={(event) =>
                          setWithdrawalAction((prev) => ({
                            ...prev,
                            [entry.id]: { ...draft, status: event.target.value },
                          }))
                        }
                        className="rounded border px-3 py-2 text-sm"
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="PAID">PAID</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                      <input
                        value={draft.payoutReference}
                        onChange={(event) =>
                          setWithdrawalAction((prev) => ({
                            ...prev,
                            [entry.id]: { ...draft, payoutReference: event.target.value },
                          }))
                        }
                        className="rounded border px-3 py-2 text-sm"
                        placeholder="Payout reference"
                      />
                      <Button size="sm" onClick={() => applyWithdrawalUpdate(entry.id)} disabled={saving}>
                        Apply
                      </Button>
                    </div>
                    <textarea
                      value={draft.adminNotes}
                      onChange={(event) =>
                        setWithdrawalAction((prev) => ({
                          ...prev,
                          [entry.id]: { ...draft, adminNotes: event.target.value },
                        }))
                      }
                      className="mt-2 w-full rounded border px-3 py-2 text-sm"
                      placeholder="Admin notes"
                    />
                  </div>
                );
              })}
              {withdrawals.length === 0 ? <p className="text-sm text-gray-500">No withdrawal requests found.</p> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
