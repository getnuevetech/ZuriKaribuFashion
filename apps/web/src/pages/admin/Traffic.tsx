import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface TrafficData {
  summary: {
    totalOrders: number;
    totalLineItems: number;
    totalRevenue: number;
  };
  vendors: Array<{
    vendorUserId: string;
    vendorName: string;
    vendorRole: string;
    orderCount: number;
    revenue: number;
  }>;
  products: Array<{
    productId: string;
    productName: string;
    productType: string;
    page: string;
    orderCount: number;
    revenue: number;
  }>;
  pages: Array<{
    page: string;
    orderCount: number;
    revenue: number;
  }>;
}

export default function AdminTraffic() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<TrafficData | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    productType: '',
    vendorUserId: '',
    page: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.admin.getTrafficReport({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        productType: (filters.productType || undefined) as any,
        vendorUserId: filters.vendorUserId || undefined,
        page: filters.page || undefined,
      });
      if (res.success) {
        setData(res.data);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load traffic report.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traffic Report</h1>
        <p className="mt-1 text-sm text-gray-500">Filter performance by product type and date range.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
            className="rounded-lg border px-3 py-2"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
            className="rounded-lg border px-3 py-2"
          />
          <select
            value={filters.productType}
            onChange={(e) => setFilters((prev) => ({ ...prev, productType: e.target.value }))}
            className="rounded-lg border px-3 py-2"
          >
            <option value="">All Product Types</option>
            <option value="FABRIC">Fabric</option>
            <option value="DESIGN">Design</option>
            <option value="READY_TO_WEAR">Ready to Wear</option>
          </select>
          <input
            value={filters.vendorUserId}
            onChange={(e) => setFilters((prev) => ({ ...prev, vendorUserId: e.target.value }))}
            placeholder="Seller/Designer User ID"
            className="rounded-lg border px-3 py-2"
          />
          <input
            value={filters.page}
            onChange={(e) => setFilters((prev) => ({ ...prev, page: e.target.value }))}
            placeholder="Page (e.g. /designs/...)"
            className="rounded-lg border px-3 py-2"
          />
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg bg-navy-600 px-4 py-2 text-white hover:bg-navy-700"
          >
            Apply Filters
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex h-72 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Orders</p>
              <p className="text-2xl font-bold">{data?.summary.totalOrders || 0}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Line Items</p>
              <p className="text-2xl font-bold">{data?.summary.totalLineItems || 0}</p>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm text-gray-500">Revenue</p>
              <p className="text-2xl font-bold">${Number(data?.summary.totalRevenue || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="rounded-xl border bg-white p-4">
              <h2 className="mb-3 font-semibold text-gray-900">Top Vendors</h2>
              <div className="space-y-2 text-sm">
                {(data?.vendors || []).slice(0, 10).map((row) => (
                  <div key={`${row.vendorRole}-${row.vendorUserId}`} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{row.vendorName}</p>
                      <p className="text-xs text-gray-500">{row.vendorRole.replace('_', ' ')}</p>
                    </div>
                    <p className="font-semibold">${Number(row.revenue || 0).toFixed(0)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4 xl:col-span-2">
              <h2 className="mb-3 font-semibold text-gray-900">Top Products</h2>
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="pb-2 pr-3">Product</th>
                      <th className="pb-2 pr-3">Type</th>
                      <th className="pb-2 pr-3">Orders</th>
                      <th className="pb-2">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.products || []).slice(0, 12).map((row) => (
                      <tr key={`${row.productType}-${row.productId}`} className="border-t">
                        <td className="py-2 pr-3">{row.productName}</td>
                        <td className="py-2 pr-3">{row.productType}</td>
                        <td className="py-2 pr-3">{row.orderCount}</td>
                        <td className="py-2">${Number(row.revenue || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Page Performance</h2>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500">
                    <th className="pb-2 pr-3">Page</th>
                    <th className="pb-2 pr-3">Orders</th>
                    <th className="pb-2">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.pages || []).slice(0, 20).map((row) => (
                    <tr key={row.page} className="border-t">
                      <td className="py-2 pr-3">{row.page}</td>
                      <td className="py-2 pr-3">{row.orderCount}</td>
                      <td className="py-2">${Number(row.revenue || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
