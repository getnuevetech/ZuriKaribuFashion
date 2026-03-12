import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type TryOnProvider = {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  isActive: boolean;
  appliesTo: Array<'DESIGN' | 'READY_TO_WEAR' | 'DASHBOARD' | 'ALL'>;
};

type TryOnSettingsState = {
  enabled: boolean;
  freeTryOnsPerCustomer: number;
  additionalTryOnBundleSize: number;
  additionalTryOnBundlePriceUsd: number;
  maxProductsPerBatch: number;
  requiredMeasurementFields: string[];
  chargeNoticeText: string;
  applyLocations: {
    customerDashboard: boolean;
    adminDashboard: boolean;
    sellerDashboard: boolean;
    designerDashboard: boolean;
    qaDashboard: boolean;
    designProductPage: boolean;
    readyToWearProductPage: boolean;
  };
  apiProviders: TryOnProvider[];
};

const DEFAULT_SETTINGS: TryOnSettingsState = {
  enabled: true,
  freeTryOnsPerCustomer: 5,
  additionalTryOnBundleSize: 5,
  additionalTryOnBundlePriceUsd: 1,
  maxProductsPerBatch: 5,
  requiredMeasurementFields: ['height', 'bust', 'waist', 'hips', 'shoulder'],
  chargeNoticeText: 'First 5 TryON runs are free. Additional bundles are billed per admin pricing.',
  applyLocations: {
    customerDashboard: true,
    adminDashboard: true,
    sellerDashboard: true,
    designerDashboard: true,
    qaDashboard: true,
    designProductPage: true,
    readyToWearProductPage: true,
  },
  apiProviders: [],
};

const normalizeSettings = (input: any): TryOnSettingsState => ({
  ...DEFAULT_SETTINGS,
  ...(input || {}),
  applyLocations: { ...DEFAULT_SETTINGS.applyLocations, ...(input?.applyLocations || {}) },
  requiredMeasurementFields: Array.isArray(input?.requiredMeasurementFields)
    ? input.requiredMeasurementFields.map((field: any) => String(field || '').trim().toLowerCase()).filter(Boolean)
    : DEFAULT_SETTINGS.requiredMeasurementFields,
  apiProviders: Array.isArray(input?.apiProviders)
    ? input.apiProviders.map((provider: any, index: number) => ({
        id: String(provider?.id || `provider-${index + 1}`),
        name: String(provider?.name || ''),
        baseUrl: String(provider?.baseUrl || ''),
        apiKey: String(provider?.apiKey || ''),
        isActive: provider?.isActive !== false,
        appliesTo: Array.isArray(provider?.appliesTo) ? provider.appliesTo : ['ALL'],
      }))
    : [],
});

export default function AdminTryOnSettings() {
  const [settings, setSettings] = useState<TryOnSettingsState>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [measurementDraft, setMeasurementDraft] = useState('height,bust,waist,hips,shoulder');
  const [insights, setInsights] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, insightsRes] = await Promise.all([
        api.admin.getTryOnSettings(),
        api.admin.getTryOnInsights(),
      ]);
      if (settingsRes.success) {
        const normalized = normalizeSettings(settingsRes.data?.settings || settingsRes.data);
        setSettings(normalized);
        setMeasurementDraft(normalized.requiredMeasurementFields.join(','));
      }
      if (insightsRes.success) {
        setInsights(insightsRes.data || null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load TryON settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const totalActiveProviders = useMemo(
    () => settings.apiProviders.filter((provider) => provider.isActive).length,
    [settings.apiProviders]
  );

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const requiredMeasurementFields = Array.from(
        new Set(
          measurementDraft
            .split(',')
            .map((field) => field.trim().toLowerCase())
            .filter(Boolean)
        )
      );
      const payload = {
        ...settings,
        requiredMeasurementFields,
      };
      const response = await api.admin.updateTryOnSettings(payload);
      const normalized = normalizeSettings(response.data || payload);
      setSettings(normalized);
      setMeasurementDraft(normalized.requiredMeasurementFields.join(','));
      setSuccess('TryON settings saved successfully.');
      const insightsRes = await api.admin.getTryOnInsights();
      if (insightsRes.success) setInsights(insightsRes.data || null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save TryON settings.');
    } finally {
      setSaving(false);
    }
  };

  const addProvider = () => {
    setSettings((previous) => ({
      ...previous,
      apiProviders: [
        ...previous.apiProviders,
        {
          id: `provider-${Date.now()}`,
          name: '',
          baseUrl: '',
          apiKey: '',
          isActive: true,
          appliesTo: ['ALL'],
        },
      ],
    }));
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">3D TryON Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Configure free quota, paid bundles, provider APIs, and where TryON appears across the application.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
      {success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Quota & Pricing</h2>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-sm">
              <span>Enable TryON</span>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings((previous) => ({ ...previous, enabled: event.target.checked }))}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Free TryON runs per customer</span>
              <input
                type="number"
                min={0}
                value={settings.freeTryOnsPerCustomer}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    freeTryOnsPerCustomer: Math.max(0, Number(event.target.value || 0)),
                  }))
                }
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Additional bundle size (runs)</span>
              <input
                type="number"
                min={1}
                value={settings.additionalTryOnBundleSize}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    additionalTryOnBundleSize: Math.max(1, Number(event.target.value || 1)),
                  }))
                }
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Bundle price (USD)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={settings.additionalTryOnBundlePriceUsd}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    additionalTryOnBundlePriceUsd: Math.max(0, Number(event.target.value || 0)),
                  }))
                }
                className="w-full rounded border px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-gray-600">Max products per TryON batch</span>
              <input
                type="number"
                min={1}
                max={100}
                value={settings.maxProductsPerBatch}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    maxProductsPerBatch: Math.max(1, Number(event.target.value || 1)),
                  }))
                }
                className="w-full rounded border px-3 py-2"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">Measurements & Notice</h2>
          <label className="mb-3 block text-sm">
            <span className="mb-1 block text-gray-600">Required measurements (comma separated)</span>
            <input
              value={measurementDraft}
              onChange={(event) => setMeasurementDraft(event.target.value)}
              className="w-full rounded border px-3 py-2"
              placeholder="height,bust,waist,hips,shoulder"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-gray-600">Charge notice text</span>
            <textarea
              value={settings.chargeNoticeText}
              onChange={(event) => setSettings((previous) => ({ ...previous, chargeNoticeText: event.target.value }))}
              rows={4}
              className="w-full rounded border px-3 py-2"
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Where TryON Applies</h2>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {Object.keys(settings.applyLocations).map((key) => (
            <label key={key} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
              <span>{key}</span>
              <input
                type="checkbox"
                checked={Boolean(settings.applyLocations[key as keyof typeof settings.applyLocations])}
                onChange={(event) =>
                  setSettings((previous) => ({
                    ...previous,
                    applyLocations: {
                      ...previous.applyLocations,
                      [key]: event.target.checked,
                    },
                  }))
                }
              />
            </label>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">3D TryON API Providers</h2>
          <Button size="sm" variant="outline" onClick={addProvider}>
            Add Provider
          </Button>
        </div>
        <p className="mb-3 text-xs text-gray-500">Active providers: {totalActiveProviders}</p>
        <div className="space-y-3">
          {settings.apiProviders.map((provider, index) => (
            <div key={provider.id} className="rounded-lg border p-3">
              <div className="grid gap-2 md:grid-cols-2">
                <input
                  value={provider.name}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      apiProviders: previous.apiProviders.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, name: event.target.value } : entry
                      ),
                    }))
                  }
                  placeholder="Provider name"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  value={provider.baseUrl}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      apiProviders: previous.apiProviders.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, baseUrl: event.target.value } : entry
                      ),
                    }))
                  }
                  placeholder="https://api.provider.com"
                  className="rounded border px-3 py-2 text-sm"
                />
                <input
                  value={provider.apiKey}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      apiProviders: previous.apiProviders.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, apiKey: event.target.value } : entry
                      ),
                    }))
                  }
                  placeholder="API key"
                  className="rounded border px-3 py-2 text-sm"
                />
                <select
                  value={provider.appliesTo[0] || 'ALL'}
                  onChange={(event) =>
                    setSettings((previous) => ({
                      ...previous,
                      apiProviders: previous.apiProviders.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, appliesTo: [event.target.value as TryOnProvider['appliesTo'][number]] }
                          : entry
                      ),
                    }))
                  }
                  className="rounded border px-3 py-2 text-sm"
                >
                  <option value="ALL">All</option>
                  <option value="DESIGN">Design only</option>
                  <option value="READY_TO_WEAR">Ready-To-Wear only</option>
                  <option value="DASHBOARD">Dashboard only</option>
                </select>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={provider.isActive}
                    onChange={(event) =>
                      setSettings((previous) => ({
                        ...previous,
                        apiProviders: previous.apiProviders.map((entry, entryIndex) =>
                          entryIndex === index ? { ...entry, isActive: event.target.checked } : entry
                        ),
                      }))
                    }
                  />
                  Active
                </label>
                <button
                  onClick={() =>
                    setSettings((previous) => ({
                      ...previous,
                      apiProviders: previous.apiProviders.filter((_, entryIndex) => entryIndex !== index),
                    }))
                  }
                  className="text-red-600 hover:underline"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {settings.apiProviders.length === 0 ? (
            <p className="rounded border border-dashed p-3 text-sm text-gray-500">No provider configured yet.</p>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Usage Insights</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded border p-3">
            <p className="text-xs text-gray-500">Total TryON Runs</p>
            <p className="text-xl font-bold text-gray-900">{Number(insights?.totalTryOns || 0)}</p>
          </div>
          <div className="rounded border p-3 md:col-span-2">
            <p className="mb-1 text-xs text-gray-500">Average Body Measurements (cm)</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(insights?.measurementAverages || {}).map(([key, value]) => (
                <span key={key} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700">
                  {key}: {String(value)}
                </span>
              ))}
              {Object.keys(insights?.measurementAverages || {}).length === 0 ? (
                <span className="text-xs text-gray-500">No insight data yet.</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save TryON Settings'}
        </Button>
      </div>
    </div>
  );
}
