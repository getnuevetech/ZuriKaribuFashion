import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type NewsletterSubscriber = {
  id: string;
  email: string;
  source: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminNewsletterSubscribersPage() {
  const [rows, setRows] = useState<NewsletterSubscriber[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState<'ALL' | 'HOMEPAGE_NEWSLETTER' | 'CHECKOUT_OPT_IN'>('ALL');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const sourceOptions = useMemo(
    () => [
      { value: 'ALL', label: 'All Sources' },
      { value: 'HOMEPAGE_NEWSLETTER', label: 'Homepage Newsletter' },
      { value: 'CHECKOUT_OPT_IN', label: 'Checkout Opt-In' },
    ],
    []
  );

  const fetchSubscribers = async (override?: { page?: number; search?: string; source?: string }) => {
    const nextPage = Math.max(1, Math.round(override?.page ?? page));
    const nextSearch = String(override?.search ?? search).trim();
    const nextSource = String(override?.source ?? source).trim().toUpperCase();
    setLoading(true);
    setError('');
    try {
      const response = await api.homepageSections.getAdminNewsletterSubscribers({
        page: nextPage,
        limit,
        search: nextSearch || undefined,
        source: nextSource === 'ALL' ? undefined : nextSource,
      });
      if (!response.success) throw new Error('Failed to fetch newsletter subscribers.');
      const nextRows = Array.isArray(response.data) ? response.data : [];
      const pagination = response.pagination || { page: nextPage, limit, total: nextRows.length, totalPages: 1 };
      setRows(nextRows);
      setPage(Math.max(1, Number(pagination.page) || nextPage));
      setTotal(Math.max(0, Number(pagination.total) || 0));
      setTotalPages(Math.max(1, Number(pagination.totalPages) || 1));
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || loadError?.message || 'Failed to fetch newsletter subscribers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubscribers({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Newsletter Subscribers</h1>
          <p className="text-sm text-gray-600">
            Standalone subscriber list for all newsletter signups across the platform.
          </p>
        </div>
        <Button type="button" variant="outline" isLoading={loading} onClick={() => void fetchSubscribers()}>
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input
            className="w-full max-w-sm rounded border px-3 py-2 text-sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email"
          />
          <select
            className="rounded border px-3 py-2 text-sm"
            value={source}
            onChange={(event) =>
              setSource(event.target.value as 'ALL' | 'HOMEPAGE_NEWSLETTER' | 'CHECKOUT_OPT_IN')
            }
          >
            {sourceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setPage(1);
              void fetchSubscribers({ page: 1, search, source });
            }}
          >
            Apply
          </Button>
        </div>

        {error ? <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div> : null}

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Metadata</th>
                <th className="px-3 py-2">Subscribed</th>
                <th className="px-3 py-2">Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t align-top">
                  <td className="px-3 py-2 font-medium text-gray-900">{row.email}</td>
                  <td className="px-3 py-2">{row.source || '-'}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{row.metadata ? JSON.stringify(row.metadata) : '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2 text-gray-600">{row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '-'}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-gray-500">
                    {loading ? 'Loading subscribers...' : 'No subscribers found.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            Showing page {page} of {totalPages} • {total} total
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={page <= 1 || loading}
              onClick={() => void fetchSubscribers({ page: Math.max(1, page - 1), search, source })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={page >= totalPages || loading}
              onClick={() => void fetchSubscribers({ page: Math.min(totalPages, page + 1), search, source })}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
