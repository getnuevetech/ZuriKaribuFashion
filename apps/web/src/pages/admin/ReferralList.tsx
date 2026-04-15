import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

export default function AdminReferralListPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<any[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });

  const loadData = async (nextPage = page, nextSearch = search) => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.admin.getReferralAttributionList({
        page: nextPage,
        limit: pagination.limit,
        search: nextSearch.trim() || undefined,
      });
      if (response.success) {
        setRows(Array.isArray(response.data) ? response.data : []);
        setPagination((prev) => ({ ...prev, ...(response.pagination || {}) }));
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load referral list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(page, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Referral/Influence Referral List</h1>
          <p className="text-sm text-gray-600">
            Track referral owner, referee, role category, join dates, sales, commissions, and account statuses.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadData(page, search)}>
          Refresh
        </Button>
      </div>

      {message ? (
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            type="text"
            className="w-full max-w-sm rounded border px-3 py-2 text-sm"
            placeholder="Search referral name, referee name, code or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            variant="outline"
            onClick={() => {
              setPage(1);
              void loadData(1, search);
            }}
          >
            Apply
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1400px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Referral Name</th>
                <th className="px-3 py-2">Referral Code</th>
                <th className="px-3 py-2">Referred Seller/Designer/User</th>
                <th className="px-3 py-2">Vendor Category</th>
                <th className="px-3 py-2">Referral Join Date</th>
                <th className="px-3 py-2">Referee Join Date</th>
                <th className="px-3 py-2">Designer/Seller Sales</th>
                <th className="px-3 py-2">Referral Commission</th>
                <th className="px-3 py-2">Referee Status</th>
                <th className="px-3 py-2">Seller/Designer/Customer Status</th>
                <th className="px-3 py-2">Referral Program Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-500" colSpan={11}>
                    Loading...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-3 py-8 text-center text-gray-500" colSpan={11}>
                    No referral rows found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.attributionId} className="border-t align-top">
                    <td className="px-3 py-2">{row.referralName || '-'}</td>
                    <td className="px-3 py-2">{row.referralCode || '-'}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{row.referredName || '-'}</p>
                      <p className="text-xs text-gray-500">{row.referredEmail || '-'}</p>
                    </td>
                    <td className="px-3 py-2">{row.vendorCategory || '-'}</td>
                    <td className="px-3 py-2">
                      {row.referralJoinedAt ? new Date(row.referralJoinedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-3 py-2">
                      {row.refereeJoinedAt ? new Date(row.refereeJoinedAt).toLocaleDateString() : '-'}
                    </td>
                    <td className="px-3 py-2">${Number(row.designerSellerSalesUsd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">${Number(row.referralCommissionUsd || 0).toFixed(2)}</td>
                    <td className="px-3 py-2">{row.refereeStatus || '-'}</td>
                    <td className="px-3 py-2">{row.sellerDesignerCustomerStatus || '-'}</td>
                    <td className="px-3 py-2">
                      <Badge variant={String(row.referralProgramStatus || '').toUpperCase() === 'ACTIVE' ? 'green' : 'red'}>
                        {row.referralProgramStatus || 'UNKNOWN'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Page {Number(pagination.page || 1)} of {Math.max(1, Number(pagination.pages || 1))} • Total {Number(pagination.total || 0)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={Number(pagination.page || 1) <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={Number(pagination.page || 1) >= Math.max(1, Number(pagination.pages || 1))}
              onClick={() => setPage((prev) => Math.min(Math.max(1, Number(pagination.pages || 1)), prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
