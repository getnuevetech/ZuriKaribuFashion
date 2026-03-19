import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ModuleKey =
  | 'platform_core'
  | 'commerce'
  | 'ticketing'
  | 'chat'
  | 'communications'
  | 'help_center'
  | 'automation_ai'
  | 'ops';

type ModuleMode = 'active' | 'degraded' | 'maintenance';
type RolloutScopeType = 'GLOBAL' | 'ROLE' | 'PERCENT';

type ModuleRow = {
  moduleKey: ModuleKey;
  enabled: boolean;
  mode: ModuleMode;
  provider: string;
  rolloutScope: {
    type: RolloutScopeType;
    value: string;
  };
  config: Record<string, unknown>;
  updatedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  accessDecision?: {
    allowed: boolean;
    reason: string | null;
  };
};

const MODE_OPTIONS: Array<{ value: ModuleMode; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'degraded', label: 'Degraded' },
  { value: 'maintenance', label: 'Maintenance' },
];

const SCOPE_OPTIONS: Array<{ value: RolloutScopeType; label: string }> = [
  { value: 'GLOBAL', label: 'Global' },
  { value: 'ROLE', label: 'Role-based' },
  { value: 'PERCENT', label: 'Percent rollout' },
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '-';
  return date.toLocaleString();
};

const moduleTitle = (moduleKey: string) =>
  String(moduleKey || '')
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');

export default function AdminModuleRuntimeSettings() {
  const [rows, setRows] = useState<ModuleRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingMap, setIsSavingMap] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) =>
        String(a.moduleKey || '').localeCompare(String(b.moduleKey || ''))
      ),
    [rows]
  );

  const load = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await api.moduleRuntime.listAdminModules();
      setRows(Array.isArray(response?.data) ? (response.data as ModuleRow[]) : []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load module switchboard settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateRow = (moduleKey: string, patch: Partial<ModuleRow>) => {
    setRows((current) =>
      current.map((entry) => (entry.moduleKey === moduleKey ? { ...entry, ...patch } : entry))
    );
  };

  const saveRow = async (row: ModuleRow) => {
    setMessage('');
    setError('');
    setIsSavingMap((current) => ({ ...current, [row.moduleKey]: true }));
    try {
      const response = await api.moduleRuntime.updateAdminModule(row.moduleKey, {
        enabled: row.enabled,
        mode: row.mode,
        provider: row.provider,
        rolloutScope: row.rolloutScope,
      });
      const updated = response?.data as ModuleRow;
      if (updated?.moduleKey) {
        updateRow(updated.moduleKey, updated);
      }
      setMessage(`Saved ${moduleTitle(row.moduleKey)} module settings.`);
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save module settings.');
    } finally {
      setIsSavingMap((current) => ({ ...current, [row.moduleKey]: false }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900">Module Switchboard</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">
          Enable, degrade, or place modules in maintenance mode. This controls runtime access
          and dashboard visibility without changing deployed code.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Runtime Modules</h2>
          <Button type="button" variant="outline" onClick={() => void load()} disabled={isLoading}>
            Refresh
          </Button>
        </div>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-500">Loading module settings...</div>
        ) : sortedRows.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">No module settings found.</div>
        ) : (
          <div className="space-y-4">
            {sortedRows.map((row) => {
              const isSaving = isSavingMap[row.moduleKey] === true;
              return (
                <div key={row.moduleKey} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900">{moduleTitle(row.moduleKey)}</h3>
                      <p className="text-xs text-gray-500">
                        Key: <span className="font-mono">{row.moduleKey}</span> • Updated:{' '}
                        {formatDateTime(row.updatedAt)}
                      </p>
                    </div>
                    <div className="rounded-full border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700">
                      Access: {row.accessDecision?.allowed ? 'Allowed' : 'Blocked'}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={row.enabled}
                        onChange={(event) => updateRow(row.moduleKey, { enabled: event.target.checked })}
                      />
                      Enabled
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                      <span>Mode</span>
                      <select
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        value={row.mode}
                        onChange={(event) =>
                          updateRow(row.moduleKey, { mode: event.target.value as ModuleMode })
                        }
                      >
                        {MODE_OPTIONS.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                      <span>Provider</span>
                      <input
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        value={row.provider}
                        onChange={(event) => updateRow(row.moduleKey, { provider: event.target.value })}
                        placeholder="internal"
                      />
                    </label>

                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                      <span>Rollout Scope</span>
                      <select
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        value={row.rolloutScope?.type || 'GLOBAL'}
                        onChange={(event) =>
                          updateRow(row.moduleKey, {
                            rolloutScope: {
                              ...(row.rolloutScope || { type: 'GLOBAL', value: '*' }),
                              type: event.target.value as RolloutScopeType,
                            },
                          })
                        }
                      >
                        {SCOPE_OPTIONS.map((entry) => (
                          <option key={entry.value} value={entry.value}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
                    <label className="flex flex-col gap-1 text-sm text-gray-700">
                      <span>Scope Value</span>
                      <input
                        className="rounded-lg border border-gray-300 px-3 py-2"
                        value={row.rolloutScope?.value || ''}
                        onChange={(event) =>
                          updateRow(row.moduleKey, {
                            rolloutScope: {
                              ...(row.rolloutScope || { type: 'GLOBAL', value: '*' }),
                              value: event.target.value,
                            },
                          })
                        }
                        placeholder={
                          row.rolloutScope?.type === 'ROLE'
                            ? 'ADMINISTRATOR,QA_TEAM'
                            : row.rolloutScope?.type === 'PERCENT'
                              ? '25'
                              : '*'
                        }
                      />
                    </label>
                    <div className="flex items-end">
                      <Button type="button" onClick={() => void saveRow(row)} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Module'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

