import { useEffect, useState } from 'react';
import { PhoneCall, RefreshCw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type VoipRoute = {
  id: string;
  name: string;
  enabled: boolean;
  contextType: 'TICKET' | 'CHAT' | 'DIRECT' | 'ANY';
  fromRoles: string[];
  targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE' | 'CUSTOMER_SERVICE';
  targetId: string;
};

type VoipTransferTarget = {
  id: string;
  name: string;
  enabled: boolean;
  targetType: 'ADMIN_USER' | 'ADMIN_GROUP' | 'ADMIN_ROLE';
  targetId: string;
};

type VoipCallLog = {
  id: string;
  routeId?: string | null;
  contextType: string;
  contextId?: string | null;
  fromCallerId?: string | null;
  toCallerId?: string | null;
  status: string;
  startedAt?: string | null;
  endedAt?: string | null;
};

const buildEmptyRoute = (): VoipRoute => ({
  id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  contextType: 'ANY',
  fromRoles: [],
  targetType: 'CUSTOMER_SERVICE',
  targetId: '',
});

const buildEmptyTransferTarget = (): VoipTransferTarget => ({
  id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  enabled: true,
  targetType: 'ADMIN_USER',
  targetId: '',
});

export default function AdminVoipConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'configuration' | 'logs' | 'transfer'>('configuration');
  const [settings, setSettings] = useState({
    enabled: false,
    provider: 'INTERNAL',
    callBaseUrl: '',
    routes: [] as VoipRoute[],
    transferTargets: [] as VoipTransferTarget[],
  });
  const [callLogs, setCallLogs] = useState<VoipCallLog[]>([]);
  const [testContextId, setTestContextId] = useState('');
  const [testToUserId, setTestToUserId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.customerService.getVoipSettings();
      if (response.success && response.data) {
        setSettings({
          enabled: Boolean(response.data.enabled),
          provider: String(response.data.provider || 'INTERNAL'),
          callBaseUrl: String(response.data.callBaseUrl || ''),
          routes: Array.isArray(response.data.routes)
            ? response.data.routes.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                contextType: ['TICKET', 'CHAT', 'DIRECT', 'ANY'].includes(String(row?.contextType || '').toUpperCase())
                  ? (String(row?.contextType || '').toUpperCase() as any)
                  : 'ANY',
                fromRoles: Array.isArray(row?.fromRoles)
                  ? row.fromRoles.map((entry: any) => String(entry || '').toUpperCase()).filter(Boolean)
                  : [],
                targetType: ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE', 'CUSTOMER_SERVICE'].includes(
                  String(row?.targetType || '').toUpperCase()
                )
                  ? (String(row?.targetType || '').toUpperCase() as any)
                  : 'CUSTOMER_SERVICE',
                targetId: String(row?.targetId || ''),
              }))
            : [],
          transferTargets: Array.isArray(response.data.transferTargets)
            ? response.data.transferTargets.map((row: any) => ({
                id: String(row?.id || ''),
                name: String(row?.name || ''),
                enabled: row?.enabled !== false,
                targetType: ['ADMIN_USER', 'ADMIN_GROUP', 'ADMIN_ROLE'].includes(String(row?.targetType || '').toUpperCase())
                  ? (String(row?.targetType || '').toUpperCase() as any)
                  : 'ADMIN_USER',
                targetId: String(row?.targetId || ''),
              }))
            : [],
        });
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load VoIP settings.');
    } finally {
      setLoading(false);
    }
  };

  const loadCallLogs = async () => {
    try {
      const response = await api.customerService.listVoipCalls({ limit: 200 });
      if (response.success) {
        setCallLogs(Array.isArray(response.data) ? response.data : []);
      }
    } catch (logError: any) {
      setError(logError?.response?.data?.message || 'Failed to load call logs.');
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (activeTab !== 'logs') return;
    void loadCallLogs();
  }, [activeTab]);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.updateVoipSettings({
        enabled: settings.enabled,
        provider: settings.provider.trim(),
        callBaseUrl: settings.callBaseUrl.trim(),
        routes: settings.routes.map((row) => ({
          ...row,
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          targetId: String(row.targetId || '').trim(),
          fromRoles: (Array.isArray(row.fromRoles) ? row.fromRoles : []).map((entry) => String(entry || '').trim().toUpperCase()).filter(Boolean),
        })),
        transferTargets: settings.transferTargets.map((row) => ({
          ...row,
          id: String(row.id || '').trim(),
          name: String(row.name || '').trim(),
          targetId: String(row.targetId || '').trim(),
        })),
      });
      if (response.success) {
        setMessage(response.message || 'VoIP settings saved.');
      }
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to save VoIP settings.');
    } finally {
      setSaving(false);
    }
  };

  const startTestCall = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.startVoipCall({
        contextType: 'DIRECT',
        contextId: testContextId.trim() || undefined,
        toUserId: testToUserId.trim() || undefined,
      });
      if (response.success && response.data?.callLink) {
        setMessage(`Call started. Opening ${response.data.callLink}`);
        window.open(response.data.callLink, '_blank', 'noopener,noreferrer');
      }
      if (activeTab === 'logs') await loadCallLogs();
    } catch (callError: any) {
      setError(callError?.response?.data?.message || 'Failed to start test call.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">VoIP Management</h1>
          <p className="text-sm text-gray-600">Manage PBX-style call configuration, routing, call logs, and transfer targets.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('configuration')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'configuration' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          VoIP Configuration
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'logs' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Call Logs List
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('transfer')}
          className={`rounded-lg px-3 py-2 text-sm ${activeTab === 'transfer' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'}`}
        >
          Call Transfer Management Configuration
        </button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      {activeTab === 'configuration' ? (
        <>
          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Provider Setup</h2>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings((prev) => ({ ...prev, enabled: event.target.checked }))}
              />
              Enable VoIP
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Provider</span>
                <input
                  value={settings.provider}
                  onChange={(event) => setSettings((prev) => ({ ...prev, provider: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="INTERNAL or provider name"
                />
              </label>
              <label className="text-sm text-gray-700">
                <span className="mb-1 block">Call base URL</span>
                <input
                  value={settings.callBaseUrl}
                  onChange={(event) => setSettings((prev) => ({ ...prev, callBaseUrl: event.target.value }))}
                  className="w-full rounded border px-3 py-2"
                  placeholder="https://your-voip-app/call"
                />
              </label>
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Call Route Management</h2>
              <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, routes: [...prev.routes, buildEmptyRoute()] }))}>
                Add Route
              </Button>
            </div>
            <div className="space-y-3">
              {settings.routes.map((route, index) => (
                <div key={route.id || `route-${index}`} className="rounded border p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-5">
                    <input
                      value={route.id}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                        }))
                      }
                      placeholder="Route ID"
                      className="rounded border px-2 py-1 text-sm"
                    />
                    <input
                      value={route.name}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                        }))
                      }
                      placeholder="Route name"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.contextType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, contextType: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="ANY">ANY</option>
                      <option value="TICKET">TICKET</option>
                      <option value="CHAT">CHAT</option>
                      <option value="DIRECT">DIRECT</option>
                    </select>
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={route.enabled}
                        onChange={(event) =>
                          setSettings((prev) => ({
                            ...prev,
                            routes: prev.routes.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                          }))
                        }
                      />
                      Enabled
                    </label>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <input
                      value={route.fromRoles.join(',')}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) =>
                            idx === index
                              ? {
                                  ...row,
                                  fromRoles: event.target.value
                                    .split(',')
                                    .map((entry) => entry.trim().toUpperCase())
                                    .filter(Boolean),
                                }
                              : row
                          ),
                        }))
                      }
                      placeholder="From roles (comma-separated)"
                      className="rounded border px-2 py-1 text-sm md:col-span-2"
                    />
                    <select
                      value={route.targetType}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, targetType: event.target.value as any } : row)),
                        }))
                      }
                      className="rounded border px-2 py-1 text-sm"
                    >
                      <option value="CUSTOMER_SERVICE">CUSTOMER_SERVICE</option>
                      <option value="ADMIN_USER">ADMIN_USER</option>
                      <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                      <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                    </select>
                    <input
                      value={route.targetId}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.map((row, idx) => (idx === index ? { ...row, targetId: event.target.value } : row)),
                        }))
                      }
                      placeholder="Target ID (if required)"
                      className="rounded border px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          routes: prev.routes.filter((_row, idx) => idx !== index),
                        }))
                      }
                    >
                      Remove Route
                    </button>
                  </div>
                </div>
              ))}
              {settings.routes.length === 0 ? <p className="text-sm text-gray-500">No routes configured yet.</p> : null}
            </div>
          </section>

          <section className="rounded-xl border bg-white p-4 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Test Call</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={testContextId}
                onChange={(event) => setTestContextId(event.target.value)}
                placeholder="Context id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
              <input
                value={testToUserId}
                onChange={(event) => setTestToUserId(event.target.value)}
                placeholder="Target user id (optional)"
                className="rounded border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="mr-2 h-4 w-4" />
                Save VoIP Configuration
              </Button>
              <Button onClick={() => void startTestCall()} disabled={saving} variant="outline">
                <PhoneCall className="mr-2 h-4 w-4" />
                Start Test Call
              </Button>
            </div>
          </section>
        </>
      ) : null}

      {activeTab === 'transfer' ? (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Call Transfer Targets</h2>
            <Button variant="outline" onClick={() => setSettings((prev) => ({ ...prev, transferTargets: [...prev.transferTargets, buildEmptyTransferTarget()] }))}>
              Add Transfer Target
            </Button>
          </div>
          <div className="space-y-3">
            {settings.transferTargets.map((target, index) => (
              <div key={target.id || `transfer-${index}`} className="rounded border p-3 space-y-2">
                <div className="grid gap-2 md:grid-cols-5">
                  <input
                    value={target.id}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, id: event.target.value } : row)),
                      }))
                    }
                    placeholder="Transfer ID"
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <input
                    value={target.name}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, name: event.target.value } : row)),
                      }))
                    }
                    placeholder="Transfer name"
                    className="rounded border px-2 py-1 text-sm md:col-span-2"
                  />
                  <select
                    value={target.targetType}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, targetType: event.target.value as any } : row)),
                      }))
                    }
                    className="rounded border px-2 py-1 text-sm"
                  >
                    <option value="ADMIN_USER">ADMIN_USER</option>
                    <option value="ADMIN_GROUP">ADMIN_GROUP</option>
                    <option value="ADMIN_ROLE">ADMIN_ROLE</option>
                  </select>
                  <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={target.enabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, enabled: event.target.checked } : row)),
                        }))
                      }
                    />
                    Enabled
                  </label>
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    value={target.targetId}
                    onChange={(event) =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.map((row, idx) => (idx === index ? { ...row, targetId: event.target.value } : row)),
                      }))
                    }
                    placeholder="Target ID"
                    className="rounded border px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        transferTargets: prev.transferTargets.filter((_row, idx) => idx !== index),
                      }))
                    }
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {settings.transferTargets.length === 0 ? <p className="text-sm text-gray-500">No transfer targets configured yet.</p> : null}
          </div>
          <Button onClick={() => void save()} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Transfer Configuration
          </Button>
        </section>
      ) : null}

      {activeTab === 'logs' ? (
        <section className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Call Logs</h2>
            <Button variant="outline" onClick={() => void loadCallLogs()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh Logs
            </Button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3">Call ID</th>
                  <th className="py-2 pr-3">Route</th>
                  <th className="py-2 pr-3">Context</th>
                  <th className="py-2 pr-3">From</th>
                  <th className="py-2 pr-3">To</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Started</th>
                  <th className="py-2 pr-3">Ended</th>
                </tr>
              </thead>
              <tbody>
                {callLogs.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="py-2 pr-3 font-mono text-xs">{row.id}</td>
                    <td className="py-2 pr-3">{row.routeId || '-'}</td>
                    <td className="py-2 pr-3">
                      {row.contextType}
                      {row.contextId ? ` (${row.contextId})` : ''}
                    </td>
                    <td className="py-2 pr-3">{row.fromCallerId || '-'}</td>
                    <td className="py-2 pr-3">{row.toCallerId || '-'}</td>
                    <td className="py-2 pr-3">{row.status}</td>
                    <td className="py-2 pr-3">{row.startedAt ? new Date(row.startedAt).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-3">{row.endedAt ? new Date(row.endedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
                {callLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No call logs yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
