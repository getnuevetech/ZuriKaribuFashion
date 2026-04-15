import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCcw } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type StockRow = {
  productId: string;
  productType: 'FABRIC' | 'READY_TO_WEAR';
  name: string;
  ownerName: string;
  ownerCountry: string;
  ownerUserId: string | null;
  stockValue: number;
  status: string;
  isAvailable: boolean;
  updatedAt: string;
};

export default function AdminProductStockList() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [threshold, setThreshold] = useState(0);
  const [rows, setRows] = useState<StockRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.admin.getProductStockMonitor();
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to load stock monitor.');
      }
      const data: any = response.data || {};
      setThreshold(Number(data?.threshold || 0));
      setRows(Array.isArray(data?.rows) ? data.rows : []);
      const syncSummary = data?.summary?.sync;
      if (syncSummary && Number(syncSummary.changed || 0) > 0) {
        setSyncMessage(
          `Stock sync updated ${Number(syncSummary.changed || 0)} product(s): ${Number(syncSummary.disabledOutOfStock || 0)} disabled, ${Number(syncSummary.reenabledInStock || 0)} re-enabled.`
        );
      } else {
        setSyncMessage(null);
      }
    } catch (loadError: any) {
      setError(String(loadError?.message || 'Failed to load stock monitor.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const summary = useMemo(() => {
    const zeroStockCount = rows.filter((row) => Number(row.stockValue || 0) <= 0).length;
    return {
      total: rows.length,
      zeroStockCount,
      fabricCount: rows.filter((row) => row.productType === 'FABRIC').length,
      readyToWearCount: rows.filter((row) => row.productType === 'READY_TO_WEAR').length,
    };
  }, [rows]);

  const handleSaveThreshold = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const response = await api.admin.updateProductStockMonitor({
        threshold: Math.max(0, Math.floor(Number(threshold || 0))),
      });
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to update threshold.');
      }
      const nextRows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
      setRows(nextRows);
      setThreshold(Number(response?.data?.threshold || 0));
      setMessage('Stock threshold saved.');
    } catch (saveError: any) {
      setError(String(saveError?.message || 'Failed to update threshold.'));
    } finally {
      setSaving(false);
    }
  };

  const handleRunSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const response = await api.admin.runProductStockMonitorSync();
      if (!response?.success) {
        throw new Error(response?.message || 'Failed to sync stock statuses.');
      }
      const payload: any = response?.data || {};
      setSyncMessage(
        `Stock sync updated ${Number(payload.changed || 0)} product(s): ${Number(payload.disabledOutOfStock || 0)} disabled, ${Number(payload.reenabledInStock || 0)} re-enabled.`
      );
      await load();
    } catch (syncError: any) {
      setError(String(syncError?.message || 'Failed to sync stock statuses.'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Stock List</h1>
            <p className="text-sm text-gray-600">
              Products at or below the configured stock threshold. Products that hit zero stock are automatically disabled.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
            <Button variant="outline" onClick={handleRunSync} disabled={syncing}>
              <RefreshCcw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Run Stock Sync'}
            </Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Total in list</p>
            <p className="text-xl font-semibold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Zero stock</p>
            <p className="text-xl font-semibold text-gray-900">{summary.zeroStockCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Fabrics</p>
            <p className="text-xl font-semibold text-gray-900">{summary.fabricCount}</p>
          </div>
          <div className="rounded-lg border border-gray-200 px-3 py-2">
            <p className="text-xs uppercase text-gray-500">Ready-to-Wear</p>
            <p className="text-xl font-semibold text-gray-900">{summary.readyToWearCount}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            Stock list threshold
            <input
              type="number"
              min={0}
              max={100000}
              value={threshold}
              onChange={(event) => setThreshold(Math.max(0, Number(event.target.value || 0)))}
              className="mt-1 block w-48 rounded-lg border px-3 py-2"
            />
          </label>
          <Button onClick={handleSaveThreshold} disabled={saving}>
            {saving ? 'Saving...' : 'Save Threshold'}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Set to 0 to list only zero-stock products. Increase to monitor low-stock products before they run out.
        </p>
        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {syncMessage ? <p className="mt-1 text-sm text-blue-700">{syncMessage}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading stock list...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Stock</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-gray-500" colSpan={8}>
                      No products found for the current threshold.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={`${row.productType}-${row.productId}`} className="border-t">
                      <td className="px-4 py-3 font-medium text-gray-700">
                        {row.productType === 'FABRIC' ? 'Fabric To Buy' : 'Ready To Wear'}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{row.name}</td>
                      <td className="px-4 py-3 text-gray-700">{row.ownerName}</td>
                      <td className="px-4 py-3 text-gray-700">{row.ownerCountry || '-'}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                            Number(row.stockValue || 0) <= 0 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {Number(row.stockValue || 0)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{row.status}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${
                            row.isAvailable ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {row.isAvailable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{new Date(row.updatedAt).toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
