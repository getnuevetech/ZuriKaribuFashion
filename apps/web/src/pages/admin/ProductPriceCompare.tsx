import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type PriceCompareRow = {
  productId: string;
  productType: 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR';
  name: string;
  status: string;
  isAvailable: boolean;
  ownerName: string;
  ownerCountry: string;
  category: string;
  currentPrice: number;
  peerAveragePrice: number;
  diffAmount: number;
  diffPercent: number;
  absDiffPercent: number;
  direction: 'ABOVE' | 'BELOW';
  severity: 'AMBER' | 'RED';
  image: string | null;
  createdAt: string;
};

export default function AdminProductPriceCompare() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PriceCompareRow[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    amberCount: 0,
    redCount: 0,
    byType: { FABRIC: 0, DESIGN: 0, READY_TO_WEAR: 0 },
  });
  const [pagination, setPagination] = useState({ page: 1, limit: 30, total: 0, pages: 1 });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'FABRIC' | 'DESIGN' | 'READY_TO_WEAR'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'AMBER' | 'RED'>('ALL');
  const [minMarginPercent, setMinMarginPercent] = useState(30);

  const load = async (page = pagination.page) => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.admin.getProductPriceCompare({
        search: search.trim() || undefined,
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        severity: severityFilter === 'ALL' ? undefined : severityFilter,
        minMarginPercent,
        page,
        limit: pagination.limit,
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load product price compare.');
      }
      const data: any = response.data || {};
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setSummary({
        total: Number(data?.summary?.total || 0),
        amberCount: Number(data?.summary?.amberCount || 0),
        redCount: Number(data?.summary?.redCount || 0),
        byType: {
          FABRIC: Number(data?.summary?.byType?.FABRIC || 0),
          DESIGN: Number(data?.summary?.byType?.DESIGN || 0),
          READY_TO_WEAR: Number(data?.summary?.byType?.READY_TO_WEAR || 0),
        },
      });
      setPagination({
        page: Number(data?.pagination?.page || page || 1),
        limit: Number(data?.pagination?.limit || pagination.limit || 30),
        total: Number(data?.pagination?.total || 0),
        pages: Number(data?.pagination?.pages || 1),
      });
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Failed to load product price compare.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const typeLabel = (type: string) =>
    type === 'FABRIC' ? 'Fabric To Buy' : type === 'READY_TO_WEAR' ? 'Ready To Wear' : 'Custom To Wear';

  const filteredLabel = useMemo(() => {
    if (severityFilter === 'RED') return 'Critical outliers';
    if (severityFilter === 'AMBER') return 'Moderate outliers';
    return 'All outliers';
  }, [severityFilter]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Product Price Compare</h1>
            <p className="text-sm text-gray-600">
              Lists products priced 30%+ above or below the average of similar approved products in the same category.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load(pagination.page)} disabled={loading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-5">
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Total outliers</p>
            <p className="text-xl font-semibold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="text-xs uppercase text-amber-700">Amber</p>
            <p className="text-xl font-semibold text-amber-900">{summary.amberCount}</p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
            <p className="text-xs uppercase text-red-700">Red</p>
            <p className="text-xl font-semibold text-red-900">{summary.redCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Fabrics</p>
            <p className="text-xl font-semibold text-gray-900">{summary.byType.FABRIC}</p>
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Design + RTW</p>
            <p className="text-xl font-semibold text-gray-900">{summary.byType.DESIGN + summary.byType.READY_TO_WEAR}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <input
            className="rounded-lg border px-3 py-2 text-sm md:col-span-2"
            placeholder="Search product name/description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as any)}
          >
            <option value="ALL">All product types</option>
            <option value="FABRIC">Fabric To Buy</option>
            <option value="DESIGN">Custom To Wear</option>
            <option value="READY_TO_WEAR">Ready To Wear</option>
          </select>
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value as any)}
          >
            <option value="ALL">All severities</option>
            <option value="AMBER">Amber</option>
            <option value="RED">Red</option>
          </select>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={30}
              max={500}
              className="w-28 rounded-lg border px-3 py-2 text-sm"
              value={minMarginPercent}
              onChange={(event) => setMinMarginPercent(Math.max(30, Number(event.target.value || 30)))}
            />
            <Button onClick={() => void load(1)} disabled={loading}>
              Apply
            </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Showing: {filteredLabel}. Threshold: {minMarginPercent}%.
        </p>
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading price comparison list...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Current Price</th>
                  <th className="px-4 py-3">Category Avg</th>
                  <th className="px-4 py-3">Difference</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={9}>
                      No price outliers found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={`${row.productType}-${row.productId}`}
                      className={`border-t ${
                        row.severity === 'RED'
                          ? 'bg-gradient-to-r from-red-50 via-red-50/80 to-white'
                          : 'bg-gradient-to-r from-amber-50 via-amber-50/70 to-white'
                      }`}
                    >
                      <td className="px-4 py-3 font-medium text-gray-700">{typeLabel(row.productType)}</td>
                      <td className="px-4 py-3 text-gray-900">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-gray-500">{new Date(row.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <p>{row.ownerName}</p>
                        <p className="text-xs text-gray-500">{row.ownerCountry || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.category || '-'}</td>
                      <td className="px-4 py-3 text-gray-900">${Number(row.currentPrice || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-700">${Number(row.peerAveragePrice || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">
                          {row.direction === 'ABOVE' ? '+' : '-'}
                          {Math.abs(Number(row.diffPercent || 0)).toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">
                          {row.direction === 'ABOVE' ? '+' : '-'}${Math.abs(Number(row.diffAmount || 0)).toFixed(2)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                            row.severity === 'RED' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {row.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-sm">
        <p className="text-gray-600">
          Page {pagination.page} of {Math.max(1, pagination.pages)} • {pagination.total} total
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={loading || pagination.page <= 1}
            onClick={() => void load(Math.max(1, pagination.page - 1))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={loading || pagination.page >= pagination.pages}
            onClick={() => void load(Math.min(pagination.pages, pagination.page + 1))}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

