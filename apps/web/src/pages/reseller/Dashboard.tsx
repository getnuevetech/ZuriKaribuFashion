import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

type DashboardTab = 'overview' | 'referrals' | 'commissions';

export default function ResellerDashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [payload, setPayload] = useState<any>(null);
  const tab = (String(searchParams.get('tab') || '').toLowerCase() as DashboardTab) || 'overview';
  const activeTab: DashboardTab = ['overview', 'referrals', 'commissions'].includes(tab) ? tab : 'overview';

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.referrals.getMyDashboard({ page: 1, limit: 100 });
      if (response.success) {
        setPayload(response.data || null);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load reseller dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totals = payload?.totals || {};
  const referrals = useMemo(() => (Array.isArray(payload?.referrals) ? payload.referrals : []), [payload]);
  const commissions = useMemo(() => (Array.isArray(payload?.commissions) ? payload.commissions : []), [payload]);

  const setTab = (next: DashboardTab) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'overview') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params);
  };

  const copyLink = async () => {
    const value = String(payload?.profile?.referralLink || '').trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage('Referral link copied.');
    } catch {
      setMessage('Could not copy link automatically.');
    }
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reseller / Influencer Dashboard</h1>
          <p className="text-sm text-gray-600">
            Track onboarding activity and commissions from sellers/designers referred with your link.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData()}>
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded border p-3">
            <p className="text-xs text-gray-500">Total Referrals</p>
            <p className="text-2xl font-semibold text-gray-900">{Number(totals.totalReferrals || 0)}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-gray-500">Total Commission</p>
            <p className="text-2xl font-semibold text-gray-900">${Number(totals.totalCommissionUsd || 0).toFixed(2)}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-gray-500">Pending Commission</p>
            <p className="text-2xl font-semibold text-gray-900">${Number(totals.pendingCommissionUsd || 0).toFixed(2)}</p>
          </div>
          <div className="rounded border p-3">
            <p className="text-xs text-gray-500">Available Commission</p>
            <p className="text-2xl font-semibold text-gray-900">${Number(totals.availableCommissionUsd || 0).toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-4 rounded border bg-gray-50 p-3">
          <p className="text-xs text-gray-500">Referral ID</p>
          <p className="font-medium text-gray-900">
            {payload?.profile?.referralCode || '-'} <span className="text-xs text-gray-500">#{payload?.profile?.numericRefId || '-'}</span>
          </p>
          <p className="mt-2 break-all text-xs text-gray-700">{payload?.profile?.referralLink || '-'}</p>
          <div className="mt-2">
            <Button variant="outline" onClick={() => void copyLink()}>
              Copy Referral Link
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTab('overview')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            activeTab === 'overview' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab('referrals')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            activeTab === 'referrals' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Referrals
        </button>
        <button
          type="button"
          onClick={() => setTab('commissions')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            activeTab === 'commissions' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
          }`}
        >
          Commissions
        </button>
      </div>

      {(activeTab === 'overview' || activeTab === 'referrals') && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Referred Users</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">
                        {`${row?.user?.firstName || ''} ${row?.user?.lastName || ''}`.trim() || 'User'}
                      </p>
                      <p className="text-xs text-gray-500">{row?.user?.email || '-'}</p>
                    </td>
                    <td className="px-3 py-2">{String(row.referredRole || '').replaceAll('_', ' ') || '-'}</td>
                    <td className="px-3 py-2">{row?.user?.status || '-'}</td>
                    <td className="px-3 py-2">
                      {row?.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
                {referrals.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-sm text-gray-500" colSpan={4}>
                      No referrals yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'commissions') && (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Commission Ledger</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  <th className="px-3 py-2">Order</th>
                  <th className="px-3 py-2">Vendor Role</th>
                  <th className="px-3 py-2">Base Amount</th>
                  <th className="px-3 py-2">Rate</th>
                  <th className="px-3 py-2">Commission</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Available At</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((row: any) => (
                  <tr key={row.id} className="border-t">
                    <td className="px-3 py-2">{row?.orderNumber || row?.orderId || '-'}</td>
                    <td className="px-3 py-2">{String(row?.vendorRole || '').replaceAll('_', ' ')}</td>
                    <td className="px-3 py-2">${Number(row?.baseAmountUsd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{Number(row?.commissionPercent || 0).toFixed(2)}%</td>
                    <td className="px-3 py-2">${Number(row?.commissionAmountUsd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={
                          String(row?.status || '').toUpperCase() === 'PAID'
                            ? 'green'
                            : String(row?.status || '').toUpperCase() === 'REJECTED'
                              ? 'red'
                              : 'yellow'
                        }
                      >
                        {row?.status || 'PENDING'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{row?.availableAt ? new Date(row.availableAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {commissions.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-center text-sm text-gray-500" colSpan={7}>
                      No commission entries yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
