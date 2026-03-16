import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import OrderSupportModal from '../../components/orders/OrderSupportModal';
import { api } from '../../services/api';

type WithdrawalMethod = {
  id: string;
  methodType: string;
  providerName?: string;
  accountName?: string;
  accountNumber?: string;
  isDefault?: boolean;
};

type WithdrawalRequest = {
  id: string;
  amountUsd: number;
  status: string;
  notes?: string;
  requestedAt: string;
};

type EarningRow = {
  orderId: string;
  orderNumber: string;
  itemName: string;
  grossAmountUsd: number;
  paymentStatus: string;
  orderStatus: string;
  createdAt: string;
  availableAt: string;
  isAvailableForWithdrawal: boolean;
  customerName?: string;
};

export default function DesignerPayments() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [config, setConfig] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [earnings, setEarnings] = useState<EarningRow[]>([]);
  const [methods, setMethods] = useState<WithdrawalMethod[]>([]);
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [methodForm, setMethodForm] = useState({
    methodType: 'BANK_TRANSFER',
    providerName: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    routingNumber: '',
    walletAddress: '',
    currencyCode: 'USD',
    isDefault: false,
  });
  const [withdrawForm, setWithdrawForm] = useState({ methodId: '', amountUsd: '', notes: '' });
  const [savingMethod, setSavingMethod] = useState(false);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);
  const [supportOrderId, setSupportOrderId] = useState<string | null>(null);
  const [supportInitialTab, setSupportInitialTab] = useState<'details' | 'ticket'>('ticket');

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [configRes, walletRes, earningsRes, methodsRes, requestsRes] = await Promise.all([
        api.payments.getVendorConfig(),
        api.payments.getVendorWallet(),
        api.payments.getVendorEarnings(),
        api.payments.getVendorWithdrawalMethods(),
        api.payments.getVendorWithdrawalRequests(),
      ]);
      if (configRes.success) setConfig(configRes.data || null);
      if (walletRes.success) setWallet(walletRes.data || null);
      if (earningsRes.success && Array.isArray(earningsRes.data)) setEarnings(earningsRes.data as EarningRow[]);
      if (methodsRes.success && Array.isArray(methodsRes.data)) {
        const nextMethods = methodsRes.data as WithdrawalMethod[];
        setMethods(nextMethods);
        if (nextMethods.length > 0) {
          const defaultMethod = nextMethods.find((entry) => entry.isDefault) || nextMethods[0];
          setWithdrawForm((prev) => ({ ...prev, methodId: prev.methodId || defaultMethod.id }));
        }
      }
      if (requestsRes.success && Array.isArray(requestsRes.data)) setRequests(requestsRes.data as WithdrawalRequest[]);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load payment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const availableWithdrawalOptions = useMemo(() => {
    const options = Array.isArray(config?.effectiveWithdrawalOptions)
      ? config.effectiveWithdrawalOptions
      : Array.isArray(config?.withdrawalOptions)
        ? config.withdrawalOptions
        : [];
    return options.length > 0 ? options : ['BANK_TRANSFER', 'MOBILE_MONEY', 'PAYPAL'];
  }, [config]);

  const availableWithdrawalProviders = useMemo(() => {
    const rows = Array.isArray(config?.availableWithdrawalProviders) ? config.availableWithdrawalProviders : [];
    return rows.map((entry: any) => ({
      providerKey: String(entry?.providerKey || '').toUpperCase(),
      displayName: String(entry?.displayName || entry?.providerKey || '').trim(),
    }));
  }, [config]);

  const saveMethod = async () => {
    try {
      if (!methodForm.methodType.trim()) {
        setError('Withdrawal method type is required.');
        return;
      }
      setSavingMethod(true);
      setError('');
      setMessage('');
      const normalizedMethodType = methodForm.methodType.trim().toUpperCase();
      const normalizedProviderName =
        String(methodForm.providerName || '').trim().toUpperCase() ||
        (availableWithdrawalProviders.some((entry) => entry.providerKey === normalizedMethodType)
          ? normalizedMethodType
          : '');
      const response = await api.payments.createVendorWithdrawalMethod({
        ...methodForm,
        methodType: normalizedMethodType,
        providerName: normalizedProviderName || undefined,
      });
      if (!response.success) {
        setError(response.message || 'Unable to save withdrawal method.');
        return;
      }
      setMessage('Withdrawal method saved.');
      setMethodForm((prev) => ({
        ...prev,
        providerName: '',
        accountName: '',
        accountNumber: '',
        bankName: '',
        routingNumber: '',
        walletAddress: '',
        isDefault: false,
      }));
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save withdrawal method.');
    } finally {
      setSavingMethod(false);
    }
  };

  const submitWithdrawal = async () => {
    try {
      const amountUsd = Number(withdrawForm.amountUsd || 0);
      if (!withdrawForm.methodId) {
        setError('Please select a withdrawal method.');
        return;
      }
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        setError('Enter a valid withdrawal amount.');
        return;
      }
      setSubmittingWithdrawal(true);
      setError('');
      setMessage('');
      const response = await api.payments.createVendorWithdrawalRequest({
        methodId: withdrawForm.methodId,
        amountUsd,
        notes: withdrawForm.notes || undefined,
      });
      if (!response.success) {
        setError(response.message || 'Unable to submit withdrawal request.');
        return;
      }
      setMessage('Withdrawal request submitted successfully.');
      setWithdrawForm((prev) => ({ ...prev, amountUsd: '', notes: '' }));
      await loadData();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit withdrawal request.');
    } finally {
      setSubmittingWithdrawal(false);
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
        <h1 className="text-2xl font-bold text-gray-900">Payment</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track designer earnings, manage withdrawal methods, and submit payout requests.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{message}</div> : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Total Earnings</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">${Number(wallet?.totalEarningsUsd || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Available</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">${Number(wallet?.withdrawableUsd || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Pending Withdrawals</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">${Number(wallet?.pendingWithdrawalUsd || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Paid Out</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">${Number(wallet?.paidOutUsd || 0).toFixed(2)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Withdrawal Method</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Method Type</label>
              <select
                value={methodForm.methodType}
                onChange={(event) => setMethodForm((prev) => ({ ...prev, methodType: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              >
                {availableWithdrawalOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Provider</label>
              {availableWithdrawalProviders.length > 0 ? (
                <select
                  value={methodForm.providerName}
                  onChange={(event) => setMethodForm((prev) => ({ ...prev, providerName: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  <option value="">Select provider...</option>
                  {availableWithdrawalProviders.map((provider) => (
                    <option key={provider.providerKey} value={provider.providerKey}>
                      {provider.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={methodForm.providerName}
                  onChange={(event) => setMethodForm((prev) => ({ ...prev, providerName: event.target.value }))}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="e.g. GTBank, MTN, PayPal"
                />
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Account Name</label>
              <input
                value={methodForm.accountName}
                onChange={(event) => setMethodForm((prev) => ({ ...prev, accountName: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Account Number / Wallet</label>
              <input
                value={methodForm.accountNumber}
                onChange={(event) => setMethodForm((prev) => ({ ...prev, accountNumber: event.target.value }))}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={methodForm.isDefault}
              onChange={(event) => setMethodForm((prev) => ({ ...prev, isDefault: event.target.checked }))}
            />
            Set as default method
          </label>
          <Button onClick={saveMethod} disabled={savingMethod}>
            {savingMethod ? 'Saving...' : 'Save Method'}
          </Button>

          {methods.length > 0 ? (
            <div className="space-y-2 border-t pt-3">
              {methods.map((method) => (
                <div key={method.id} className="rounded border bg-gray-50 p-2 text-sm text-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{method.methodType}</p>
                    {method.isDefault ? <Badge variant="green">Default</Badge> : null}
                  </div>
                  <p>{method.providerName || method.accountName || 'Saved method'}</p>
                  {method.accountNumber ? <p className="text-xs text-gray-500">{method.accountNumber}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Withdraw Earnings</h2>
          <p className="text-sm text-gray-500">
            Minimum withdrawal: ${Number(config?.minimumWithdrawalUsd || 0).toFixed(2)} • Release delay: {Number(config?.releaseDelayDays || 0)} days
          </p>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Method</label>
            <select
              value={withdrawForm.methodId}
              onChange={(event) => setWithdrawForm((prev) => ({ ...prev, methodId: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">Select method...</option>
              {methods.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.methodType} - {method.providerName || method.accountName || method.accountNumber}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Amount (USD)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={withdrawForm.amountUsd}
              onChange={(event) => setWithdrawForm((prev) => ({ ...prev, amountUsd: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Notes (optional)</label>
            <textarea
              value={withdrawForm.notes}
              onChange={(event) => setWithdrawForm((prev) => ({ ...prev, notes: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm min-h-[90px]"
            />
          </div>
          <Button onClick={submitWithdrawal} disabled={submittingWithdrawal}>
            {submittingWithdrawal ? 'Submitting...' : 'Submit Withdrawal Request'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Earnings by Order</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Order</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Customer</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Amount</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Availability</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {earnings.map((entry) => (
                <tr key={`${entry.orderId}-${entry.itemName}-${entry.createdAt}`}>
                  <td className="px-3 py-2">{entry.orderNumber}</td>
                  <td className="px-3 py-2">{entry.itemName}</td>
                  <td className="px-3 py-2">{entry.customerName || 'Customer'}</td>
                  <td className="px-3 py-2">${Number(entry.grossAmountUsd || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    {entry.isAvailableForWithdrawal ? (
                      <Badge variant="green">Available</Badge>
                    ) : (
                      <span className="text-xs text-gray-500">Available on {new Date(entry.availableAt).toLocaleDateString()}</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSupportInitialTab('details');
                          setSupportOrderId(entry.orderId);
                        }}
                      >
                        Details
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSupportInitialTab('ticket');
                          setSupportOrderId(entry.orderId);
                        }}
                      >
                        Raise Concern
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {earnings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                    No earnings found yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Withdrawal History</h2>
        <div className="space-y-2">
          {requests.map((entry) => (
            <div key={entry.id} className="rounded border bg-gray-50 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">${Number(entry.amountUsd || 0).toFixed(2)}</p>
                <Badge variant={entry.status === 'PAID' ? 'green' : entry.status === 'REJECTED' ? 'red' : 'yellow'}>
                  {entry.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-1">Requested: {new Date(entry.requestedAt).toLocaleString()}</p>
              {entry.notes ? <p className="text-xs text-gray-600 mt-1">{entry.notes}</p> : null}
            </div>
          ))}
          {requests.length === 0 ? <p className="text-sm text-gray-500">No withdrawal requests yet.</p> : null}
        </div>
      </div>

      <OrderSupportModal
        isOpen={Boolean(supportOrderId)}
        orderId={supportOrderId}
        initialTab={supportInitialTab}
        onClose={() => setSupportOrderId(null)}
      />
    </div>
  );
}
