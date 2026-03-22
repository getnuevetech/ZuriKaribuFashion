import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type HomepageRuntimeSettings = {
  homepageTemplate: 'LEGACY' | 'KIMI';
  rolloutMode: 'LIVE' | 'PREVIEW_SAFE';
  allowPreviewQuery: boolean;
  previewQueryParam: string;
};

const DEFAULT_RUNTIME_SETTINGS: HomepageRuntimeSettings = {
  homepageTemplate: 'LEGACY',
  rolloutMode: 'PREVIEW_SAFE',
  allowPreviewQuery: true,
  previewQueryParam: 'zkHomePreview',
};

export default function AdminHomepageRuntimeSwitchboard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<HomepageRuntimeSettings>(DEFAULT_RUNTIME_SETTINGS);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.homepageSections.getAdminExperienceSettings();
      if (response.success && response.data) {
        setSettings({
          homepageTemplate: response.data.homepageTemplate === 'KIMI' ? 'KIMI' : 'LEGACY',
          rolloutMode: response.data.rolloutMode === 'LIVE' ? 'LIVE' : 'PREVIEW_SAFE',
          allowPreviewQuery: response.data.allowPreviewQuery !== false,
          previewQueryParam:
            /^[A-Za-z0-9_-]{2,40}$/.test(String(response.data.previewQueryParam || '').trim())
              ? String(response.data.previewQueryParam).trim()
              : 'zkHomePreview',
        });
      }
    } catch (fetchError: any) {
      setError(fetchError?.response?.data?.message || 'Failed to load homepage runtime settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await api.homepageSections.updateAdminExperienceSettings({
        homepageTemplate: settings.homepageTemplate,
        rolloutMode: settings.rolloutMode,
        allowPreviewQuery: settings.allowPreviewQuery,
        previewQueryParam: settings.previewQueryParam,
      });
      if (response.success) {
        setMessage('Homepage runtime switchboard updated.');
      }
    } catch (saveError: any) {
      setError(saveError?.response?.data?.message || 'Failed to update homepage runtime settings.');
    } finally {
      setSaving(false);
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
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Runtime Switchboard'}
        </Button>
      </div>
    </div>
  );
}
