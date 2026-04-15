import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

interface MatrixRow {
  countryCode: string;
  country: string;
  currencyCode: string;
  currencyName: string;
  usdPerUnit: number;
}

interface RuleRow {
  id: string;
  scopeType: 'COUNTRY' | 'USER' | 'ROLE';
  scopeValue: string;
  currencies: string[];
}

export default function AdminCurrencyMatrix() {
  const [matrix, setMatrix] = useState<MatrixRow[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [health, setHealth] = useState<{
    lastRefreshedAt: string | null;
    staleAfterHours: number;
    isStale: boolean;
    lastSource: string | null;
  } | null>(null);
  const [overrideCount, setOverrideCount] = useState(0);
  const [overridesByCountryCode, setOverridesByCountryCode] = useState<Record<string, MatrixRow>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.currency.getAdminMatrix();
      if (res.success) {
        setMatrix(res.data.matrix || []);
        setRules(res.data.rules || []);
        setHealth(res.data.health || null);
        const overrideMap = (res.data.overrides || {}) as Record<string, MatrixRow>;
        setOverridesByCountryCode(overrideMap);
        setOverrideCount(Object.keys(overrideMap).length);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load currency matrix.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return matrix;
    return matrix.filter(
      (row) =>
        row.country.toLowerCase().includes(term) ||
        row.countryCode.toLowerCase().includes(term) ||
        row.currencyCode.toLowerCase().includes(term)
    );
  }, [matrix, search]);

  const saveRuleSet = async () => {
    try {
      setSaving(true);
      setError('');
      await api.currency.updateRules(
        rules
          .filter((row) => row.id && row.scopeValue && row.currencies.length > 0)
          .map((row) => ({
            ...row,
            currencies: row.currencies.map((code) => code.toUpperCase()),
          }))
      );
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save currency rules.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Currency Matrix</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage African country exchange rates (to USD) and vendor multi-currency permissions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={async () => {
              setSaving(true);
              try {
                await api.currency.refreshRates(true);
                await load();
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            Refresh (Keep Overrides)
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              if (!window.confirm('Clear all admin currency overrides and restore provider rates?')) return;
              setSaving(true);
              try {
                await api.currency.refreshRates(false);
                await load();
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            Refresh & Clear Overrides
          </Button>
        </div>
      </div>

      {health && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            health.isStale ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
          }`}
        >
          {health.isStale
            ? `Exchange rates are stale (>${health.staleAfterHours}h). Last refresh: ${
                health.lastRefreshedAt ? new Date(health.lastRefreshedAt).toLocaleString() : 'never'
              }.`
            : `Exchange rates are fresh. Last refresh: ${
                health.lastRefreshedAt ? new Date(health.lastRefreshedAt).toLocaleString() : 'n/a'
              }.`}
          <span className="ml-2 text-xs opacity-80">
            Source: {String(health.lastSource || 'manual')} • Manual overrides: {overrideCount}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-gray-900">Country Exchange Rates</h2>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search country/currency"
            className="rounded-lg border px-3 py-2 text-sm"
          />
        </div>
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-blue-700">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
            Third-Party
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-500" />
            Admin Entered
          </span>
        </div>
        <div className="max-h-[520px] overflow-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-2 pr-3">Country</th>
                <th className="pb-2 pr-3">Currency</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 pr-3">USD per 1 Unit</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => {
                const isAdminOverride = Boolean(overridesByCountryCode[row.countryCode]);
                return (
                <tr
                  key={`${row.countryCode}-${row.currencyCode}-${idx}`}
                  className={`border-t ${isAdminOverride ? 'bg-amber-50/40' : 'bg-blue-50/30'}`}
                >
                  <td className="py-2 pr-3">
                    <div className="font-medium text-gray-900">{row.country}</div>
                    <div className="text-xs text-gray-500">{row.countryCode}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-gray-900">{row.currencyCode}</div>
                    <div className="text-xs text-gray-500">{row.currencyName}</div>
                  </td>
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                        isAdminOverride
                          ? 'border-amber-200 bg-amber-100 text-amber-800'
                          : 'border-blue-200 bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isAdminOverride ? 'Admin Entered' : 'Third-Party'}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      type="number"
                      min={0}
                      step="0.00000001"
                      value={row.usdPerUnit}
                      onChange={(e) =>
                        setMatrix((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, usdPerUnit: Number(e.target.value || 0) } : item))
                        )
                      }
                      className="w-40 rounded border px-2 py-1"
                    />
                  </td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await api.currency.updateCountryRate(row);
                            await load();
                          } catch (err: any) {
                            setError(err?.response?.data?.message || 'Failed to update country rate.');
                          }
                        }}
                      >
                        Save
                      </Button>
                      {isAdminOverride && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await api.currency.clearOverride(row.countryCode);
                              await load();
                            } catch (err: any) {
                              setError(err?.response?.data?.message || 'Failed to clear override.');
                            }
                          }}
                        >
                          Use Provider
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Vendor Currency Listing Rules</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setRules((prev) => [
                ...prev,
                {
                  id: `rule-${Date.now()}`,
                  scopeType: 'COUNTRY',
                  scopeValue: '',
                  currencies: ['USD'],
                },
              ])
            }
          >
            Add Rule
          </Button>
        </div>
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="grid grid-cols-1 gap-2 rounded-lg border p-3 md:grid-cols-5">
              <input
                value={rule.id}
                onChange={(e) => setRules((prev) => prev.map((item, i) => (i === idx ? { ...item, id: e.target.value } : item)))}
                className="rounded border px-3 py-2 text-sm"
                placeholder="Rule ID"
              />
              <select
                value={rule.scopeType}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((item, i) => (i === idx ? { ...item, scopeType: e.target.value as RuleRow['scopeType'] } : item))
                  )
                }
                className="rounded border px-3 py-2 text-sm"
              >
                <option value="COUNTRY">Country</option>
                <option value="USER">User</option>
                <option value="ROLE">Role</option>
              </select>
              <input
                value={rule.scopeValue}
                onChange={(e) =>
                  setRules((prev) => prev.map((item, i) => (i === idx ? { ...item, scopeValue: e.target.value } : item)))
                }
                className="rounded border px-3 py-2 text-sm"
                placeholder="Country name / userId / role"
              />
              <input
                value={rule.currencies.join(',')}
                onChange={(e) =>
                  setRules((prev) =>
                    prev.map((item, i) =>
                      i === idx
                        ? {
                            ...item,
                            currencies: e.target.value
                              .split(',')
                              .map((entry) => entry.trim().toUpperCase())
                              .filter(Boolean),
                          }
                        : item
                    )
                  )
                }
                className="rounded border px-3 py-2 text-sm md:col-span-2"
                placeholder="Allowed currencies (comma-separated, e.g. NGN,USD)"
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button onClick={saveRuleSet} disabled={saving}>
            {saving ? 'Saving...' : 'Save Rules'}
          </Button>
        </div>
      </div>
    </div>
  );
}
