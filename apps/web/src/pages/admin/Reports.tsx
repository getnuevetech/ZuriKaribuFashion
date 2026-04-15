import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

type ReportType = 'GENERAL_SALES' | 'STOCK_OVERVIEW' | 'VENDOR_SALES' | 'REFERRAL_PERFORMANCE' | 'ORDER_ACTIVITY';

const DEFAULT_TYPE: ReportType = 'GENERAL_SALES';

export default function AdminReportsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [catalog, setCatalog] = useState<any>(null);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    reportType: DEFAULT_TYPE as ReportType,
    groupBy: 'DAY',
    fromDate: '',
    toDate: '',
    lowStockThreshold: '10',
    vendorCategory: 'ALL',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      setMessage('');
      const [catalogRes, definitionsRes] = await Promise.all([
        api.admin.getReportCatalog(),
        api.admin.getReportDefinitions(),
      ]);
      if (catalogRes.success) setCatalog(catalogRes.data || null);
      if (definitionsRes.success) setDefinitions(Array.isArray(definitionsRes.data) ? definitionsRes.data : []);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load report studio.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const reportTypeOptions = useMemo(() => {
    const rows = Array.isArray(catalog?.reportTypes) ? catalog.reportTypes : [];
    return rows.length > 0 ? rows : [];
  }, [catalog]);

  const buildConfigFromForm = () => ({
    groupBy: form.groupBy,
    filters: {
      fromDate: form.fromDate || undefined,
      toDate: form.toDate || undefined,
      lowStockThreshold: Number(form.lowStockThreshold || 10),
      vendorCategory: form.vendorCategory,
    },
  });

  const createDefinition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setMessage('Definition name is required.');
      return;
    }
    try {
      setSaving(true);
      setMessage('');
      const response = await api.admin.createReportDefinition({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        reportType: form.reportType,
        config: buildConfigFromForm(),
      });
      if (response.success) {
        setDefinitions((prev) => [response.data, ...prev]);
        setMessage('Report definition created.');
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to create definition.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDefinition = async (definition: any) => {
    try {
      setSaving(true);
      const response = await api.admin.updateReportDefinition(String(definition.id), {
        isActive: definition.isActive === false,
      });
      if (response.success && response.data) {
        setDefinitions((prev) =>
          prev.map((row) => (String(row.id) === String(definition.id) ? response.data : row))
        );
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to update definition.');
    } finally {
      setSaving(false);
    }
  };

  const generateFromDefinition = async (definitionId: string) => {
    try {
      setGenerating(true);
      setMessage('');
      const response = await api.admin.generateReport({ definitionId });
      if (response.success) setResult(response.data || null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
    }
  };

  const generateAdhoc = async () => {
    try {
      setGenerating(true);
      setMessage('');
      const response = await api.admin.generateReport({
        reportType: form.reportType,
        config: buildConfigFromForm(),
      });
      if (response.success) setResult(response.data || null);
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to generate report.');
    } finally {
      setGenerating(false);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Report Studio</h1>
        <p className="text-sm text-gray-600">
          Configure reusable report definitions and generate General Sales, Stock, Vendor Sales, Referral, and Order Activity reports.
        </p>
      </div>

      {message ? (
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Available Report Types</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {reportTypeOptions.map((entry: any) => (
            <div key={entry.key} className="rounded border p-3">
              <p className="font-medium text-gray-900">{entry.label}</p>
              <p className="mt-1 text-xs text-gray-600">{entry.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {(entry.supportedMetrics || []).slice(0, 4).map((metric: string) => (
                  <Badge key={metric} variant="gray">
                    {metric}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Create Report Definition</h2>
        <form onSubmit={createDefinition} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <input
            className="rounded border px-3 py-2"
            placeholder="Definition name"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="rounded border px-3 py-2"
            value={form.reportType}
            onChange={(event) => setForm((prev) => ({ ...prev, reportType: event.target.value as ReportType }))}
          >
            {reportTypeOptions.map((entry: any) => (
              <option key={entry.key} value={entry.key}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2"
            value={form.groupBy}
            onChange={(event) => setForm((prev) => ({ ...prev, groupBy: event.target.value }))}
          >
            <option value="DAY">Group by day</option>
            <option value="WEEK">Group by week</option>
            <option value="MONTH">Group by month</option>
            <option value="NONE">No date grouping</option>
          </select>
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={form.fromDate}
            onChange={(event) => setForm((prev) => ({ ...prev, fromDate: event.target.value }))}
          />
          <input
            type="date"
            className="rounded border px-3 py-2"
            value={form.toDate}
            onChange={(event) => setForm((prev) => ({ ...prev, toDate: event.target.value }))}
          />
          <input
            type="number"
            className="rounded border px-3 py-2"
            placeholder="Low stock threshold"
            value={form.lowStockThreshold}
            onChange={(event) => setForm((prev) => ({ ...prev, lowStockThreshold: event.target.value }))}
          />
          <select
            className="rounded border px-3 py-2"
            value={form.vendorCategory}
            onChange={(event) => setForm((prev) => ({ ...prev, vendorCategory: event.target.value }))}
          >
            <option value="ALL">All vendor categories</option>
            <option value="SELLER">Seller only</option>
            <option value="DESIGNER">Designer only</option>
          </select>
          <input
            className="rounded border px-3 py-2 md:col-span-2 xl:col-span-2"
            placeholder="Description (optional)"
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
          />
          <div className="flex gap-2 xl:col-span-3">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Definition'}
            </Button>
            <Button type="button" variant="outline" disabled={generating} onClick={() => void generateAdhoc()}>
              {generating ? 'Generating...' : 'Generate Ad-hoc'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Saved Definitions</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {definitions.map((definition) => (
                <tr key={definition.id} className="border-t">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{definition.name}</p>
                    <p className="text-xs text-gray-500">{definition.description || '-'}</p>
                  </td>
                  <td className="px-3 py-2">{definition.reportType}</td>
                  <td className="px-3 py-2">{definition.updatedAt ? new Date(definition.updatedAt).toLocaleString() : '-'}</td>
                  <td className="px-3 py-2">
                    <Badge variant={definition.isActive !== false ? 'green' : 'gray'}>
                      {definition.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button variant="outline" disabled={generating} onClick={() => void generateFromDefinition(String(definition.id))}>
                        Generate
                      </Button>
                      <Button variant="outline" disabled={saving} onClick={() => void toggleDefinition(definition)}>
                        {definition.isActive !== false ? 'Disable' : 'Enable'}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {definitions.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-500" colSpan={5}>
                    No report definitions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {result ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Generated Report</h2>
            <Badge variant="gray">{result.reportType}</Badge>
            <span className="text-xs text-gray-500">{result.generatedAt ? new Date(result.generatedAt).toLocaleString() : ''}</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(result.summary || {}).map(([key, value]) => (
              <div key={key} className="rounded border px-3 py-2">
                <p className="text-xs text-gray-500">{key}</p>
                <p className="text-sm font-semibold text-gray-900">
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-50 text-left text-gray-500">
                <tr>
                  {(Array.isArray(result.columns) ? result.columns : []).map((column: string) => (
                    <th key={column} className="px-3 py-2">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(result.rows) ? result.rows : []).slice(0, 500).map((row: any, index: number) => (
                  <tr key={index} className="border-t">
                    {(Array.isArray(result.columns) ? result.columns : []).map((column: string) => (
                      <td key={column} className="px-3 py-2">
                        {typeof row?.[column] === 'object' ? JSON.stringify(row?.[column]) : String(row?.[column] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
                {(Array.isArray(result.rows) ? result.rows : []).length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-gray-500" colSpan={Math.max(1, (result.columns || []).length)}>
                      No rows generated for this report.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
