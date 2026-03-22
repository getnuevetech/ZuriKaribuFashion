import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type HomepageRuntimeSettings = {
  homepageTemplate: 'LEGACY' | 'KIMI';
  rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
  allowPreviewQuery: boolean;
  previewQueryParam: string;
  requireReasonForRuntimeActions: boolean;
};
type RuntimeHealthCheck = {
  key: string;
  label: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  detail: string;
};
type RuntimeHealth = {
  ok: boolean;
  checkedAt: string;
  checks: RuntimeHealthCheck[];
};
type RuntimeAuditEntry = {
  id: string;
  action: 'RUNTIME_SWITCH' | 'RUNTIME_ROLLBACK';
  reason: string;
  previous: HomepageRuntimeSettings;
  next: HomepageRuntimeSettings;
  performedByEmail: string | null;
  createdAt: string | null;
};
type RuntimeAuditFilterAction = 'ALL' | 'RUNTIME_SWITCH' | 'RUNTIME_ROLLBACK';

const DEFAULT_RUNTIME_SETTINGS: HomepageRuntimeSettings = {
  homepageTemplate: 'LEGACY',
  rolloutMode: 'PREVIEW_SAFE',
  allowPreviewQuery: true,
  previewQueryParam: 'zkHomePreview',
  requireReasonForRuntimeActions: false,
};
const EMPTY_HEALTH: RuntimeHealth = {
  ok: true,
  checkedAt: '',
  checks: [],
};

const toRuntimeSettings = (input: any): HomepageRuntimeSettings => ({
  homepageTemplate: input?.homepageTemplate === 'KIMI' ? 'KIMI' : 'LEGACY',
  rolloutMode: input?.rolloutMode === 'LIVE' ? 'LIVE' : 'PREVIEW_SAFE',
  allowPreviewQuery: input?.allowPreviewQuery !== false,
  previewQueryParam:
    /^[A-Za-z0-9_-]{2,40}$/.test(String(input?.previewQueryParam || '').trim())
      ? String(input.previewQueryParam).trim()
      : DEFAULT_RUNTIME_SETTINGS.previewQueryParam,
  requireReasonForRuntimeActions: input?.requireReasonForRuntimeActions === true,
});

const runtimeSettingsEqual = (a: HomepageRuntimeSettings, b: HomepageRuntimeSettings) =>
  a.homepageTemplate === b.homepageTemplate &&
  a.rolloutMode === b.rolloutMode &&
  a.allowPreviewQuery === b.allowPreviewQuery &&
  a.previewQueryParam === b.previewQueryParam &&
  a.requireReasonForRuntimeActions === b.requireReasonForRuntimeActions;

const runtimeSwitchFieldsEqual = (a: HomepageRuntimeSettings, b: HomepageRuntimeSettings) =>
  a.homepageTemplate === b.homepageTemplate &&
  a.rolloutMode === b.rolloutMode &&
  a.allowPreviewQuery === b.allowPreviewQuery &&
  a.previewQueryParam === b.previewQueryParam;

const toIsoFromLocalDateTime = (value: string): string | undefined => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return undefined;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

export default function AdminHomepageRuntimeSwitchboard() {
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [exportingAudit, setExportingAudit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<HomepageRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [loadedSettings, setLoadedSettings] = useState<HomepageRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);
  const [changeReason, setChangeReason] = useState('');
  const [rollbackReason, setRollbackReason] = useState('');
  const [runtimeHealth, setRuntimeHealth] = useState<RuntimeHealth>(EMPTY_HEALTH);
  const [runtimeAudit, setRuntimeAudit] = useState<RuntimeAuditEntry[]>([]);
  const [selectedRollbackAuditId, setSelectedRollbackAuditId] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState<RuntimeAuditFilterAction>('ALL');
  const [auditFilterEmail, setAuditFilterEmail] = useState('');
  const [auditFilterFrom, setAuditFilterFrom] = useState('');
  const [auditFilterTo, setAuditFilterTo] = useState('');
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);

  const buildAuditFilterParams = () => ({
    limit: 50,
    action: auditFilterAction === 'ALL' ? undefined : auditFilterAction,
    performedByEmail: auditFilterEmail.trim() || undefined,
    from: toIsoFromLocalDateTime(auditFilterFrom),
    to: toIsoFromLocalDateTime(auditFilterTo),
  });

  const fetchSettings = async () => {
    const response = await api.homepageSections.getAdminExperienceSettings();
    if (response.success && response.data) {
      const next = toRuntimeSettings(response.data);
      setSettings(next);
      setLoadedSettings(next);
    }
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const response = await api.homepageSections.getAdminRuntimeHealth();
      if (response.success && response.data?.runtimeHealth) {
        setRuntimeHealth(response.data.runtimeHealth);
      }
    } finally {
      setHealthLoading(false);
    }
  };

  const fetchAudit = async () => {
    setAuditLoading(true);
    try {
      const response = await api.homepageSections.getAdminRuntimeAudit(buildAuditFilterParams());
      if (response.success && Array.isArray(response.data)) {
        const mapped = response.data.map((entry) => ({
          id: String(entry.id || ''),
          action: entry.action === 'RUNTIME_ROLLBACK' ? 'RUNTIME_ROLLBACK' : 'RUNTIME_SWITCH',
          reason: String(entry.reason || ''),
          previous: toRuntimeSettings(entry.previous),
          next: toRuntimeSettings(entry.next),
          performedByEmail: entry.performedByEmail ? String(entry.performedByEmail) : null,
          createdAt: entry.createdAt ? String(entry.createdAt) : null,
        }));
        setRuntimeAudit(mapped);
        setSelectedRollbackAuditId((current) =>
          mapped.some((entry) => entry.id === current) ? current : mapped[0]?.id || ''
        );
      }
    } finally {
      setAuditLoading(false);
    }
  };

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([fetchSettings(), fetchHealth(), fetchAudit()]);
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.message || 'Failed to load homepage runtime switchboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
  }, []);

  const selectedRollbackAuditEntry =
    runtimeAudit.find((entry) => entry.id === selectedRollbackAuditId) || null;
  const rollbackTargetRuntime = selectedRollbackAuditEntry?.previous || null;
  const formatRuntimeSummary = (runtime: HomepageRuntimeSettings) =>
    `${runtime.homepageTemplate}/${runtime.rolloutMode} • preview ${
      runtime.allowPreviewQuery ? 'ON' : 'OFF'
    } (${runtime.previewQueryParam})`;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const runtimeSwitchChanged = !runtimeSwitchFieldsEqual(settings, loadedSettings);
      if (runtimeSwitchChanged && settings.requireReasonForRuntimeActions && !changeReason.trim()) {
        setError('Reason is required before switching homepage runtime.');
        setSaving(false);
        return;
      }
      const response = await api.homepageSections.updateAdminExperienceSettings({
        homepageTemplate: settings.homepageTemplate,
        rolloutMode: settings.rolloutMode,
        allowPreviewQuery: settings.allowPreviewQuery,
        previewQueryParam: settings.previewQueryParam,
        requireReasonForRuntimeActions: settings.requireReasonForRuntimeActions,
        changeReason: changeReason.trim() || undefined,
      });
      if (response.success) {
        setMessage('Homepage runtime switchboard updated.');
        const next = toRuntimeSettings(response.data);
        setSettings(next);
        setLoadedSettings(next);
        setChangeReason('');
        if (response.runtimeHealth) {
          setRuntimeHealth(response.runtimeHealth);
        } else {
          await fetchHealth();
        }
        await fetchAudit();
      }
    } catch (saveError: any) {
      const serverMessage = saveError?.response?.data?.message || 'Failed to update homepage runtime settings.';
      const maybeHealth = saveError?.response?.data?.data?.runtimeHealth;
      if (maybeHealth?.checks) {
        setRuntimeHealth(maybeHealth);
      }
      setError(serverMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleDryRunHealth = async () => {
    setHealthLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await api.homepageSections.dryRunAdminRuntimeHealth({
        homepageTemplate: settings.homepageTemplate,
        rolloutMode: settings.rolloutMode,
        allowPreviewQuery: settings.allowPreviewQuery,
        previewQueryParam: settings.previewQueryParam,
      });
      if (response.success && response.data?.runtimeHealth) {
        setRuntimeHealth(response.data.runtimeHealth);
        setMessage('Dry-run health check completed for the unsaved runtime draft.');
      }
    } catch (healthError: any) {
      setError(healthError?.response?.data?.message || 'Failed to run runtime health dry-run.');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleAuditExport = async () => {
    setExportingAudit(true);
    setError('');
    setMessage('');
    try {
      const blob = await api.homepageSections.downloadAdminRuntimeAuditCsv(buildAuditFilterParams());
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `homepage-runtime-audit-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
      setMessage('Runtime audit CSV export downloaded.');
    } catch (exportError: any) {
      setError(exportError?.response?.data?.message || 'Failed to export runtime audit.');
    } finally {
      setExportingAudit(false);
    }
  };

  const handleRollback = async () => {
    if (!selectedRollbackAuditId) {
      setError('Select an audit row to choose rollback target.');
      return;
    }
    setShowRollbackConfirm(true);
  };

  const confirmRollback = async () => {
    setRollingBack(true);
    setError('');
    setMessage('');
    try {
      if (settings.requireReasonForRuntimeActions && !rollbackReason.trim()) {
        setError('Reason is required before rolling back homepage runtime.');
        setRollingBack(false);
        return;
      }
      const response = await api.homepageSections.rollbackAdminRuntime({
        auditId: selectedRollbackAuditId || undefined,
        reason: rollbackReason.trim() || undefined,
      });
      if (response.success) {
        setMessage(response.message || 'Runtime rollback completed.');
        setRollbackReason('');
        setShowRollbackConfirm(false);
        await refreshAll();
      }
    } catch (rollbackError: any) {
      setError(rollbackError?.response?.data?.message || 'Failed to roll back homepage runtime.');
    } finally {
      setRollingBack(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Homepage Runtime Switchboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Master runtime switch for live homepage template routing and preview-safe behavior.
        </p>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>
      ) : null}

      <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Active Homepage Template</label>
          <select
            value={settings.homepageTemplate}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                homepageTemplate: e.target.value === 'KIMI' ? 'KIMI' : 'LEGACY',
              }))
            }
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          >
            <option value="LEGACY">Legacy Home</option>
            <option value="KIMI">Kimi Home</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Rollout Mode</label>
          <select
            value={settings.rolloutMode}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                rolloutMode: e.target.value === 'LIVE' ? 'LIVE' : 'PREVIEW_SAFE',
              }))
            }
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          >
            <option value="PREVIEW_SAFE">Preview-safe (legacy for everyone)</option>
            <option value="LIVE">Live rollout (uses selected template)</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Preview Query Param</label>
          <input
            type="text"
            value={settings.previewQueryParam}
            onChange={(e) =>
              setSettings((prev) => ({
                ...prev,
                previewQueryParam:
                  e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || DEFAULT_RUNTIME_SETTINGS.previewQueryParam,
              }))
            }
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            placeholder="zkHomePreview"
          />
        </div>

        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.allowPreviewQuery}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  allowPreviewQuery: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Allow query preview override on "/" (for QA previews)
          </label>
        </div>
        <div className="md:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.requireReasonForRuntimeActions}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  requireReasonForRuntimeActions: e.target.checked,
                }))
              }
              className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Require reason for runtime switch + rollback actions
          </label>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Change Reason (for audit trail)</label>
          <input
            type="text"
            value={changeReason}
            onChange={(e) => setChangeReason(e.target.value.slice(0, 280))}
            className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            placeholder={
              settings.requireReasonForRuntimeActions
                ? 'Reason required when runtime changes.'
                : 'Optional: why are you changing runtime behavior?'
            }
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button onClick={handleDryRunHealth} disabled={healthLoading || saving || rollingBack} variant="outline">
          {healthLoading ? 'Running dry-run...' : 'Dry-run Health Check'}
        </Button>
        <Button onClick={() => void fetchHealth()} disabled={healthLoading || saving || rollingBack} variant="outline">
          {healthLoading ? 'Checking health...' : 'Refresh Health'}
        </Button>
        <Button onClick={handleSave} disabled={saving || rollingBack || runtimeSettingsEqual(settings, loadedSettings)}>
          {saving ? 'Saving...' : 'Save Runtime Switchboard'}
        </Button>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Runtime Health Checks</h2>
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${
              runtimeHealth.ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {runtimeHealth.ok ? 'Healthy' : 'Action required'}
          </span>
        </div>
        {runtimeHealth.checkedAt ? (
          <p className="text-xs text-gray-500">Last checked: {new Date(runtimeHealth.checkedAt).toLocaleString()}</p>
        ) : null}
        <div className="space-y-2">
          {runtimeHealth.checks.map((check) => (
            <div key={check.key} className="rounded border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900">{check.label}</p>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    check.status === 'PASS'
                      ? 'bg-green-100 text-green-700'
                      : check.status === 'WARN'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                  }`}
                >
                  {check.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-gray-600">{check.detail}</p>
            </div>
          ))}
          {runtimeHealth.checks.length === 0 ? <p className="text-sm text-gray-500">No health data yet.</p> : null}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Rollback (select target from audit)</h2>
          <Button onClick={handleRollback} disabled={rollingBack || saving || !selectedRollbackAuditId} variant="outline">
            {rollingBack ? 'Rolling back...' : 'Review rollback'}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          {selectedRollbackAuditId
            ? `Selected audit ID: ${selectedRollbackAuditId}`
            : 'Select an audit row below to choose rollback target.'}
        </p>
        <input
          type="text"
          value={rollbackReason}
          onChange={(e) => setRollbackReason(e.target.value.slice(0, 280))}
          className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
          placeholder={
            settings.requireReasonForRuntimeActions
              ? 'Reason required by policy.'
              : 'Optional rollback reason'
          }
        />
      </div>

      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-gray-900">Runtime Audit Trail</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleAuditExport} disabled={exportingAudit || auditLoading || saving || rollingBack} variant="outline">
              {exportingAudit ? 'Exporting...' : 'Export CSV'}
            </Button>
            <Button onClick={() => void fetchAudit()} disabled={auditLoading || saving || rollingBack} variant="outline">
              {auditLoading ? 'Refreshing...' : 'Refresh Audit'}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 rounded border border-gray-200 p-3 md:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-gray-500">Action</label>
            <select
              value={auditFilterAction}
              onChange={(e) => setAuditFilterAction(e.target.value as RuntimeAuditFilterAction)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            >
              <option value="ALL">All</option>
              <option value="RUNTIME_SWITCH">Switch</option>
              <option value="RUNTIME_ROLLBACK">Rollback</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-gray-500">Performed by (email)</label>
            <input
              type="text"
              value={auditFilterEmail}
              onChange={(e) => setAuditFilterEmail(e.target.value.slice(0, 160))}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
              placeholder="admin@zurikaribu.com"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-gray-500">From</label>
            <input
              type="datetime-local"
              value={auditFilterFrom}
              onChange={(e) => setAuditFilterFrom(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium uppercase text-gray-500">To</label>
            <input
              type="datetime-local"
              value={auditFilterTo}
              onChange={(e) => setAuditFilterTo(e.target.value)}
              className="w-full border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div className="md:col-span-4 flex flex-wrap justify-end gap-2">
            <Button onClick={() => void fetchAudit()} disabled={auditLoading || saving || rollingBack} variant="outline">
              Apply Filters
            </Button>
            <Button
              onClick={() => {
                setAuditFilterAction('ALL');
                setAuditFilterEmail('');
                setAuditFilterFrom('');
                setAuditFilterTo('');
              }}
              disabled={auditLoading || saving || rollingBack}
              variant="ghost"
            >
              Reset Filters
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Select</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">When</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Action</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">From</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">To</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">By</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {runtimeAudit.map((entry) => (
                <tr
                  key={entry.id}
                  className={entry.id === selectedRollbackAuditId ? 'bg-amber-50' : ''}
                >
                  <td className="px-3 py-2">
                    <input
                      type="radio"
                      name="runtimeRollbackAuditRow"
                      checked={entry.id === selectedRollbackAuditId}
                      onChange={() => setSelectedRollbackAuditId(entry.id)}
                      className="h-4 w-4 border-gray-300 text-amber-600 focus:ring-amber-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {entry.createdAt ? new Date(entry.createdAt).toLocaleString() : '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-900">
                    {entry.action === 'RUNTIME_ROLLBACK' ? 'Rollback' : 'Switch'}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {entry.previous.homepageTemplate}/{entry.previous.rolloutMode}
                  </td>
                  <td className="px-3 py-2 text-gray-700">
                    {entry.next.homepageTemplate}/{entry.next.rolloutMode}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{entry.performedByEmail || '-'}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-gray-600" title={entry.reason || ''}>
                    {entry.reason || '-'}
                  </td>
                </tr>
              ))}
              {runtimeAudit.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-sm text-gray-500" colSpan={7}>
                    No runtime audit records found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {showRollbackConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h3 className="text-base font-semibold text-gray-900">Confirm runtime rollback</h3>
              <p className="mt-1 text-sm text-gray-600">
                Review the runtime transition before applying rollback.
              </p>
            </div>
            <div className="space-y-4 px-5 py-4">
              <div className="rounded border border-gray-200 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">From (current)</p>
                <p className="mt-1 text-gray-900">{formatRuntimeSummary(loadedSettings)}</p>
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">To (rollback target)</p>
                <p className="mt-1 text-amber-900">
                  {rollbackTargetRuntime ? formatRuntimeSummary(rollbackTargetRuntime) : 'No target selected.'}
                </p>
                {selectedRollbackAuditEntry?.createdAt ? (
                  <p className="mt-1 text-xs text-amber-700">
                    Source audit: {new Date(selectedRollbackAuditEntry.createdAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              {settings.requireReasonForRuntimeActions ? (
                <p className="text-xs text-red-600">Reason is required by runtime policy for this rollback.</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-5 py-4">
              <Button
                variant="outline"
                onClick={() => setShowRollbackConfirm(false)}
                disabled={rollingBack}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRollback}
                disabled={rollingBack || !selectedRollbackAuditId || !rollbackTargetRuntime}
              >
                {rollingBack ? 'Rolling back...' : 'Confirm rollback'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
