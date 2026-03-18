import { useEffect, useState } from 'react';
import { PhoneCall, RefreshCw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

export default function AdminVoipConfiguration() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState({
    enabled: false,
    provider: 'INTERNAL',
    callBaseUrl: '',
  });
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
        });
      }
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load VoIP settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.customerService.updateVoipSettings({
        enabled: settings.enabled,
        provider: settings.provider.trim(),
        callBaseUrl: settings.callBaseUrl.trim(),
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
          <h1 className="text-2xl font-semibold text-gray-900">VoIP Configuration</h1>
          <p className="text-sm text-gray-600">
            Configure in-app call provider and call URL template used across ticket list, chat, and account pages.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div>
      ) : null}

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
        <Button onClick={() => void save()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save VoIP Settings
        </Button>
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
        <Button onClick={() => void startTestCall()} disabled={saving}>
          <PhoneCall className="mr-2 h-4 w-4" />
          Start Test Call
        </Button>
      </section>
    </div>
  );
}
