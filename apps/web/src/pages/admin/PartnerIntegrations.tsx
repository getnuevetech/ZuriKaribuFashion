import { useEffect, useMemo, useState } from 'react';
import { KeyRound, Link as LinkIcon, RefreshCw, ShieldCheck, Webhook } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';

const SUPPORTED_SCOPES = ['catalog:read', 'orders:read', 'orders:write', 'events:order'];

type PartnerApp = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  scopes: string[];
  rateLimitPerMinute: number;
  allowedIps: string[];
  webhookUrl?: string | null;
  credentialCount?: number;
  activeCredentialCount?: number;
};

export default function AdminPartnerIntegrations() {
  const [apps, setApps] = useState<PartnerApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sensitiveOutput, setSensitiveOutput] = useState('');
  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [savingByApp, setSavingByApp] = useState<Record<string, boolean>>({});

  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    scopes: ['catalog:read', 'orders:read'] as string[],
    rateLimitPerMinute: 120,
    allowedIpsText: '',
    webhookUrl: '',
  });

  const selectedApp = useMemo(
    () => apps.find((entry) => entry.id === selectedAppId) || null,
    [apps, selectedAppId]
  );

  const fetchApps = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getPartnerApps();
      if (!response.success) {
        setError('Failed to load partner apps.');
        return;
      }
      const rows = Array.isArray(response.data) ? response.data : [];
      setApps(rows as PartnerApp[]);
      if (!selectedAppId && rows[0]?.id) {
        setSelectedAppId(String(rows[0].id));
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load partner apps.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const parseIps = (text: string) =>
    Array.from(
      new Set(
        text
          .split(/[,\n]/)
          .map((entry) => entry.trim())
          .filter(Boolean)
      )
    );

  const handleCreate = async () => {
    if (!createForm.name.trim()) {
      setError('Partner app name is required.');
      return;
    }
    try {
      setCreating(true);
      setError('');
      setMessage('');
      setSensitiveOutput('');
      const response = await api.admin.createPartnerApp({
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
        scopes: createForm.scopes,
        rateLimitPerMinute: Number(createForm.rateLimitPerMinute || 120),
        allowedIps: parseIps(createForm.allowedIpsText),
        webhookUrl: createForm.webhookUrl.trim() || undefined,
      });
      if (response.success) {
        const credential = response.data?.generatedCredential;
        const rows = await api.admin.getPartnerApps();
        if (rows.success) {
          setApps(Array.isArray(rows.data) ? (rows.data as PartnerApp[]) : []);
        }
        if (response.data?.app?.id) setSelectedAppId(String(response.data.app.id));
        setCreateForm({
          name: '',
          description: '',
          scopes: ['catalog:read', 'orders:read'],
          rateLimitPerMinute: 120,
          allowedIpsText: '',
          webhookUrl: '',
        });
        setMessage('Partner app created.');
        if (credential?.token || credential?.webhookSecret) {
          setSensitiveOutput(
            [
              credential?.token ? `API Token (show once): ${credential.token}` : '',
              credential?.webhookSecret ? `Webhook Secret (show once): ${credential.webhookSecret}` : '',
            ]
              .filter(Boolean)
              .join('\n')
          );
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create partner app.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateApp = async (app: PartnerApp) => {
    try {
      setSavingByApp((prev) => ({ ...prev, [app.id]: true }));
      setError('');
      setMessage('');
      await api.admin.updatePartnerApp(app.id, {
        name: app.name,
        description: app.description || null,
        status: app.status,
        scopes: app.scopes,
        rateLimitPerMinute: Number(app.rateLimitPerMinute || 120),
        allowedIps: Array.isArray(app.allowedIps) ? app.allowedIps : [],
        webhookUrl: app.webhookUrl || null,
      });
      setMessage(`Saved settings for ${app.name}.`);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || `Failed to save ${app.name}.`);
    } finally {
      setSavingByApp((prev) => ({ ...prev, [app.id]: false }));
    }
  };

  const updateLocalApp = (appId: string, patch: Partial<PartnerApp>) => {
    setApps((prev) =>
      prev.map((entry) => (entry.id === appId ? ({ ...entry, ...patch } as PartnerApp) : entry))
    );
  };

  const handleRotateKey = async (appId: string) => {
    try {
      setError('');
      setMessage('');
      setSensitiveOutput('');
      const response = await api.admin.rotatePartnerAppKey(appId);
      if (response.success) {
        setSensitiveOutput(`New API Token (show once): ${response.data?.token || ''}`);
        setMessage('Partner API key rotated.');
        fetchApps();
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to rotate partner key.');
    }
  };

  const handleRotateWebhookSecret = async (appId: string) => {
    try {
      setError('');
      setMessage('');
      setSensitiveOutput('');
      const response = await api.admin.rotatePartnerWebhookSecret(appId);
      if (response.success) {
        setSensitiveOutput(`New Webhook Secret (show once): ${response.data?.webhookSecret || ''}`);
        setMessage('Webhook secret rotated.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to rotate webhook secret.');
    }
  };

  const handleTestWebhook = async (appId: string) => {
    try {
      setError('');
      const response = await api.admin.sendPartnerTestWebhook(appId);
      setMessage(response?.message || 'Test webhook triggered.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to send test webhook.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Partner API Integrations</h1>
          <p className="text-sm text-gray-500">
            Create secure API credentials for third-party integrations and control access scopes.
          </p>
        </div>
        <Button variant="outline" onClick={fetchApps}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{message}</div>
      ) : null}
      {sensitiveOutput ? (
        <pre className="overflow-x-auto rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          {sensitiveOutput}
        </pre>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="rounded-xl border bg-white p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Create Partner App</h2>
          <input
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="App name"
          />
          <textarea
            value={createForm.description}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
            className="h-20 w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Description"
          />
          <div>
            <p className="mb-1 text-xs font-medium text-gray-700">Scopes</p>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORTED_SCOPES.map((scope) => {
                const active = createForm.scopes.includes(scope);
                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() =>
                      setCreateForm((prev) => ({
                        ...prev,
                        scopes: active ? prev.scopes.filter((entry) => entry !== scope) : [...prev.scopes, scope],
                      }))
                    }
                    className={`rounded border px-2 py-1 text-xs ${
                      active ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700'
                    }`}
                  >
                    {scope}
                  </button>
                );
              })}
            </div>
          </div>
          <label className="block text-xs font-medium text-gray-700">
            Rate limit / minute
            <input
              type="number"
              min={10}
              max={5000}
              value={createForm.rateLimitPerMinute}
              onChange={(event) =>
                setCreateForm((prev) => ({ ...prev, rateLimitPerMinute: Number(event.target.value || 120) }))
              }
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
            />
          </label>
          <textarea
            value={createForm.allowedIpsText}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, allowedIpsText: event.target.value }))}
            className="h-20 w-full rounded-lg border px-3 py-2 text-xs"
            placeholder="Allowed IPs (optional, comma or newline separated)"
          />
          <input
            value={createForm.webhookUrl}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, webhookUrl: event.target.value }))}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Webhook URL (optional)"
          />
          <Button className="w-full" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating...' : 'Create Partner App'}
          </Button>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold text-gray-900">Existing Partner Apps</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : apps.length === 0 ? (
            <p className="text-sm text-gray-500">No partner app created yet.</p>
          ) : (
            <div className="space-y-3">
              {apps.map((app) => (
                <div
                  key={app.id}
                  className={`rounded-lg border p-3 ${selectedApp?.id === app.id ? 'border-black' : 'border-gray-200'}`}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedAppId(app.id)}
                      className="text-left"
                    >
                      <p className="font-medium text-gray-900">{app.name}</p>
                      <p className="text-xs text-gray-500">
                        {app.slug} · {app.activeCredentialCount || 0}/{app.credentialCount || 0} active keys
                      </p>
                    </button>
                    <Badge variant={app.status === 'ACTIVE' ? 'green' : 'gray'}>{app.status}</Badge>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-gray-700">
                      Status
                      <select
                        value={app.status}
                        onChange={(event) =>
                          updateLocalApp(app.id, {
                            status: event.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                          })
                        }
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </label>
                    <label className="text-xs text-gray-700">
                      Rate limit / minute
                      <input
                        type="number"
                        min={10}
                        max={5000}
                        value={app.rateLimitPerMinute}
                        onChange={(event) =>
                          updateLocalApp(app.id, {
                            rateLimitPerMinute: Number(event.target.value || 120),
                          })
                        }
                        className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      />
                    </label>
                  </div>
                  <label className="mt-2 block text-xs text-gray-700">
                    Webhook URL
                    <input
                      value={app.webhookUrl || ''}
                      onChange={(event) => updateLocalApp(app.id, { webhookUrl: event.target.value })}
                      className="mt-1 w-full rounded border px-2 py-1 text-xs"
                      placeholder="https://example.com/webhooks"
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {SUPPORTED_SCOPES.map((scope) => {
                      const active = app.scopes.includes(scope);
                      return (
                        <button
                          key={`${app.id}-${scope}`}
                          type="button"
                          onClick={() =>
                            updateLocalApp(app.id, {
                              scopes: active ? app.scopes.filter((entry) => entry !== scope) : [...app.scopes, scope],
                            })
                          }
                          className={`rounded border px-2 py-0.5 text-[11px] ${
                            active ? 'border-black bg-black text-white' : 'border-gray-300 bg-white text-gray-700'
                          }`}
                        >
                          {scope}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    value={(app.allowedIps || []).join('\n')}
                    onChange={(event) =>
                      updateLocalApp(app.id, {
                        allowedIps: parseIps(event.target.value),
                      })
                    }
                    className="mt-2 h-16 w-full rounded border px-2 py-1 text-[11px]"
                    placeholder="Allowed IP list (optional)"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateApp(app)}
                      disabled={Boolean(savingByApp[app.id])}
                    >
                      <ShieldCheck className="mr-1 h-4 w-4" />
                      {savingByApp[app.id] ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRotateKey(app.id)}>
                      <KeyRound className="mr-1 h-4 w-4" />
                      Rotate Key
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleRotateWebhookSecret(app.id)}>
                      <Webhook className="mr-1 h-4 w-4" />
                      Rotate Webhook Secret
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleTestWebhook(app.id)}>
                      <LinkIcon className="mr-1 h-4 w-4" />
                      Test Webhook
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
