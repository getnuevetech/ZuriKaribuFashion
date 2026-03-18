import { useEffect, useState } from 'react';
import { RefreshCw, Save } from 'lucide-react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

export default function AdminCustomerServiceSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [departments, setDepartments] = useState<any[]>([]);
  const [newDepartment, setNewDepartment] = useState({
    name: '',
    code: '',
    description: '',
    targetType: 'AUTO',
    targetId: '',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsResponse, departmentsResponse] = await Promise.all([
        api.customerService.getSettings(),
        api.customerService.listDepartments(),
      ]);
      setSettings(settingsResponse?.data || null);
      setDepartments(Array.isArray(departmentsResponse?.data) ? departmentsResponse.data : []);
    } catch (loadError: any) {
      setError(loadError?.response?.data?.message || 'Failed to load customer service settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.updateSettings({
        translationEnabled: Boolean(settings?.translationEnabled),
        defaultLanguage: String(settings?.defaultLanguage || 'en'),
        chatPopupDelayMinutes: Number(settings?.chatPopupDelayMinutes || 2),
        shoppingBotDelayMinutes: Number(settings?.shoppingBotDelayMinutes || 3),
        botEnabled: Boolean(settings?.botEnabled),
        shoppingBotEnabled: Boolean(settings?.shoppingBotEnabled),
        serviceBotEnabled: Boolean(settings?.serviceBotEnabled),
        shoppingBotAvatarFemale: String(settings?.shoppingBotAvatarFemale || ''),
        shoppingBotAvatarMale: String(settings?.shoppingBotAvatarMale || ''),
      });
      setMessage('Customer service settings updated.');
      await load();
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to update customer service settings.');
    } finally {
      setSaving(false);
    }
  };

  const createDepartment = async () => {
    if (!newDepartment.name.trim() || !newDepartment.code.trim()) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api.customerService.createDepartment({
        name: newDepartment.name.trim(),
        code: newDepartment.code.trim().toUpperCase(),
        description: newDepartment.description.trim() || undefined,
        targetType: newDepartment.targetType,
        targetId: newDepartment.targetId.trim() || undefined,
      });
      setNewDepartment({
        name: '',
        code: '',
        description: '',
        targetType: 'AUTO',
        targetId: '',
      });
      setMessage('Department created.');
      await load();
    } catch (createError: any) {
      setError(createError?.response?.data?.message || 'Failed to create department.');
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
          <h1 className="text-2xl font-semibold text-gray-900">Customer Service Settings</h1>
          <p className="text-sm text-gray-600">
            Dynamic runtime controls for chat popup, language translation, service/shopping bot behavior and department routing.
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

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Runtime Controls</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.translationEnabled)}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), translationEnabled: event.target.checked }))}
            />
            Enable live chat translation
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.botEnabled)}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), botEnabled: event.target.checked }))}
            />
            Enable combined bot runtime
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.serviceBotEnabled)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), serviceBotEnabled: event.target.checked }))
              }
            />
            Enable service bot
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.shoppingBotEnabled)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), shoppingBotEnabled: event.target.checked }))
              }
            />
            Enable shopping bot
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Default language</span>
            <select
              value={String(settings?.defaultLanguage || 'en')}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), defaultLanguage: event.target.value }))}
              className="w-full rounded border px-3 py-2"
            >
              {Array.isArray(settings?.supportedLanguages) ? (
                settings.supportedLanguages.map((lang: any) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))
              ) : (
                <option value="en">English</option>
              )}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Chat popup delay (minutes)</span>
            <input
              type="number"
              min={0}
              max={60}
              value={Number(settings?.chatPopupDelayMinutes || 2)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), chatPopupDelayMinutes: Number(event.target.value || 0) }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Shopping bot delay (minutes)</span>
            <input
              type="number"
              min={0}
              max={60}
              value={Number(settings?.shoppingBotDelayMinutes || 3)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), shoppingBotDelayMinutes: Number(event.target.value || 0) }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Shopping avatar (female URL)</span>
            <input
              value={String(settings?.shoppingBotAvatarFemale || '')}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), shoppingBotAvatarFemale: event.target.value }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </label>
          <label className="text-sm text-gray-700">
            <span className="mb-1 block">Shopping avatar (male URL)</span>
            <input
              value={String(settings?.shoppingBotAvatarMale || '')}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), shoppingBotAvatarMale: event.target.value }))
              }
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
        <Button onClick={() => void saveSettings()} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Settings
        </Button>
      </section>

      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Departments</h2>
        <p className="text-xs text-gray-500">
          Define issue departments and map each department to AUTO routing, admin user, admin role, or admin group.
        </p>
        <div className="grid gap-2 md:grid-cols-5">
          <input
            value={newDepartment.name}
            onChange={(event) => setNewDepartment((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Department name"
            className="rounded border px-3 py-2 text-sm"
          />
          <input
            value={newDepartment.code}
            onChange={(event) => setNewDepartment((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="Code"
            className="rounded border px-3 py-2 text-sm"
          />
          <select
            value={newDepartment.targetType}
            onChange={(event) => setNewDepartment((prev) => ({ ...prev, targetType: event.target.value }))}
            className="rounded border px-2 py-2 text-sm"
          >
            <option value="AUTO">AUTO</option>
            <option value="ADMIN_GROUP">ADMIN_GROUP</option>
            <option value="ADMIN_ROLE">ADMIN_ROLE</option>
            <option value="ADMIN_USER">ADMIN_USER</option>
          </select>
          <input
            value={newDepartment.targetId}
            onChange={(event) => setNewDepartment((prev) => ({ ...prev, targetId: event.target.value }))}
            placeholder="Target id"
            className="rounded border px-3 py-2 text-sm"
          />
          <Button onClick={() => void createDepartment()} disabled={saving}>
            Add
          </Button>
        </div>
        <textarea
          value={newDepartment.description}
          onChange={(event) => setNewDepartment((prev) => ({ ...prev, description: event.target.value }))}
          placeholder="Department description"
          rows={2}
          className="w-full rounded border px-3 py-2 text-sm"
        />
        <div className="grid gap-2 md:grid-cols-2">
          {departments.map((department) => (
            <div key={department.id} className="rounded border px-3 py-2">
              <p className="text-sm font-medium text-gray-900">
                {department.name} <span className="text-xs text-gray-500">({department.code})</span>
              </p>
              <p className="text-xs text-gray-600 mt-1">{department.description || 'No description'}</p>
              <p className="text-xs text-gray-500 mt-1">
                Route: {department.targetType || 'AUTO'} {department.targetId ? `• ${department.targetId}` : ''}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
