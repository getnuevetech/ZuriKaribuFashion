import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';
import { getCountryOptions } from '../../data/locationOptions';

type FieldType = 'TEXT' | 'PASSWORD' | 'URL' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'TEXTAREA';
type ProviderType = 'GLOBAL' | 'LOCAL';
type ModeType = 'TEST' | 'LIVE';

interface IntegrationField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
  isSecret?: boolean;
  exposePublic?: boolean;
  sortOrder?: number;
}

interface ShippingProviderRow {
  id: string;
  providerKey: string;
  displayName: string;
  providerType: ProviderType;
  mode: ModeType;
  isActive: boolean;
  supportsCountries: string[];
  configSchema: IntegrationField[];
  configValues: Record<string, any>;
  notes?: string | null;
}

interface LocalShippingOption {
  id: string;
  countryCode: string;
  countryName: string;
  city?: string | null;
  providerKey: string;
  providerName: string;
  serviceName: string;
  etaMinDays: number;
  etaMaxDays: number;
  priceUsd: number;
  isActive: boolean;
}

const FIELD_TYPE_OPTIONS: FieldType[] = ['TEXT', 'PASSWORD', 'URL', 'NUMBER', 'BOOLEAN', 'SELECT', 'TEXTAREA'];

const cloneProvider = (row: ShippingProviderRow): ShippingProviderRow => ({
  ...row,
  supportsCountries: Array.isArray(row.supportsCountries) ? [...row.supportsCountries] : [],
  configSchema: Array.isArray(row.configSchema)
    ? row.configSchema.map((field, idx) => ({
        ...field,
        options: Array.isArray(field.options) ? [...field.options] : [],
        sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : idx,
      }))
    : [],
  configValues: row.configValues && typeof row.configValues === 'object' ? { ...row.configValues } : {},
});

const COUNTRY_OPTIONS = getCountryOptions();

const makeLocalDraft = (): Omit<LocalShippingOption, 'id'> => ({
  countryCode: 'NG',
  countryName: 'Nigeria',
  city: '',
  providerKey: 'LOCAL',
  providerName: '',
  serviceName: 'Standard Delivery',
  etaMinDays: 1,
  etaMaxDays: 3,
  priceUsd: 0,
  isActive: true,
});

export default function AdminShipping() {
  const [providers, setProviders] = useState<ShippingProviderRow[]>([]);
  const [builtinProviderKeys, setBuiltinProviderKeys] = useState<string[]>([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState('');
  const [draft, setDraft] = useState<ShippingProviderRow | null>(null);
  const [localOptions, setLocalOptions] = useState<LocalShippingOption[]>([]);
  const [localDraft, setLocalDraft] = useState<Omit<LocalShippingOption, 'id'>>(makeLocalDraft());
  const [editingLocalId, setEditingLocalId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newProviderKey, setNewProviderKey] = useState('');
  const [newProviderName, setNewProviderName] = useState('');

  const selectedProvider = useMemo(
    () => providers.find((entry) => entry.providerKey === selectedProviderKey) || null,
    [providers, selectedProviderKey]
  );

  const loadAll = async () => {
    try {
      setLoading(true);
      setError('');
      const [providersResponse, localResponse] = await Promise.all([
        api.admin.getShippingIntegrations(),
        api.admin.getShippingLocalOptions(),
      ]);
      const providerRows = Array.isArray(providersResponse.data?.providers) ? providersResponse.data.providers : [];
      const normalizedProviders = providerRows.map((entry: any) =>
        cloneProvider({
          id: String(entry.id || ''),
          providerKey: String(entry.providerKey || ''),
          displayName: String(entry.displayName || entry.providerKey || 'Shipping Provider'),
          providerType: entry.providerType === 'LOCAL' ? 'LOCAL' : 'GLOBAL',
          mode: entry.mode === 'LIVE' ? 'LIVE' : 'TEST',
          isActive: Boolean(entry.isActive),
          supportsCountries: Array.isArray(entry.supportsCountries) ? entry.supportsCountries : [],
          configSchema: Array.isArray(entry.configSchema) ? entry.configSchema : [],
          configValues: entry.configValues && typeof entry.configValues === 'object' ? entry.configValues : {},
          notes: entry.notes ? String(entry.notes) : '',
        })
      );
      setProviders(normalizedProviders);
      setBuiltinProviderKeys(
        Array.isArray(providersResponse.data?.builtinProviderKeys) ? providersResponse.data.builtinProviderKeys : []
      );
      const localRows = Array.isArray(localResponse.data) ? localResponse.data : [];
      setLocalOptions(
        localRows.map((entry: any) => ({
          id: String(entry.id || ''),
          countryCode: String(entry.countryCode || ''),
          countryName: String(entry.countryName || ''),
          city: entry.city ? String(entry.city) : '',
          providerKey: String(entry.providerKey || ''),
          providerName: String(entry.providerName || ''),
          serviceName: String(entry.serviceName || 'Standard Delivery'),
          etaMinDays: Number(entry.etaMinDays || 0),
          etaMaxDays: Number(entry.etaMaxDays || 0),
          priceUsd: Number(entry.priceUsd || 0),
          isActive: Boolean(entry.isActive),
        }))
      );

      const nextSelected =
        normalizedProviders.find((entry) => entry.providerKey === selectedProviderKey)?.providerKey ||
        normalizedProviders[0]?.providerKey ||
        '';
      setSelectedProviderKey(nextSelected);
      setDraft(nextSelected ? cloneProvider(normalizedProviders.find((entry) => entry.providerKey === nextSelected) as ShippingProviderRow) : null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load shipping configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProvider) {
      setDraft(null);
      return;
    }
    setDraft(cloneProvider(selectedProvider));
  }, [selectedProvider]);

  const saveProvider = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const payload = {
        displayName: draft.displayName.trim(),
        providerType: draft.providerType,
        mode: draft.mode,
        isActive: draft.isActive,
        supportsCountries: draft.supportsCountries.map((entry) => String(entry || '').toUpperCase()).filter(Boolean),
        configSchema: draft.configSchema
          .map((field, index) => ({
            ...field,
            key: String(field.key || '').trim(),
            label: String(field.label || field.key || '').trim(),
            sortOrder: index,
            options: Array.isArray(field.options) ? field.options.filter(Boolean) : [],
          }))
          .filter((field) => field.key.length > 0),
        configValues: draft.configValues || {},
        notes: draft.notes || '',
      };
      const response = await api.admin.updateShippingIntegration(draft.providerKey, payload);
      if (!response.success) throw new Error('Failed to save shipping integration.');
      setMessage(`${draft.displayName} saved.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save shipping integration.');
    } finally {
      setSaving(false);
    }
  };

  const createProvider = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const providerKey = String(newProviderKey || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_');
      if (!providerKey) throw new Error('Provider key is required.');
      if (!newProviderName.trim()) throw new Error('Provider name is required.');
      const response = await api.admin.createShippingIntegration({
        providerKey,
        displayName: newProviderName.trim(),
        providerType: 'GLOBAL',
        mode: 'TEST',
        isActive: false,
        supportsCountries: [],
        configSchema: [],
        configValues: {},
      });
      if (!response.success) throw new Error('Failed to create provider.');
      setMessage(`Provider ${providerKey} created.`);
      setNewProviderKey('');
      setNewProviderName('');
      setSelectedProviderKey(providerKey);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create provider.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async () => {
    if (!draft) return;
    if (!window.confirm(`Remove shipping provider ${draft.displayName}?`)) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await api.admin.deleteShippingIntegration(draft.providerKey);
      setMessage(`${draft.displayName} removed.`);
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to remove provider.');
    } finally {
      setSaving(false);
    }
  };

  const startEditLocalOption = (row: LocalShippingOption) => {
    setEditingLocalId(row.id);
    setLocalDraft({
      countryCode: row.countryCode,
      countryName: row.countryName,
      city: row.city || '',
      providerKey: row.providerKey,
      providerName: row.providerName,
      serviceName: row.serviceName,
      etaMinDays: Number(row.etaMinDays || 0),
      etaMaxDays: Number(row.etaMaxDays || 0),
      priceUsd: Number(row.priceUsd || 0),
      isActive: Boolean(row.isActive),
    });
  };

  const clearLocalDraft = () => {
    setEditingLocalId(null);
    setLocalDraft(makeLocalDraft());
  };

  const saveLocalOption = async () => {
    try {
      setSaving(true);
      setError('');
      setMessage('');
      if (!localDraft.providerName.trim()) throw new Error('Provider name is required.');
      if (!localDraft.serviceName.trim()) throw new Error('Service name is required.');
      const payload = {
        countryCode: localDraft.countryCode,
        countryName: localDraft.countryName,
        city: localDraft.city || null,
        providerKey: localDraft.providerKey || 'LOCAL',
        providerName: localDraft.providerName.trim(),
        serviceName: localDraft.serviceName.trim(),
        etaMinDays: Number(localDraft.etaMinDays || 0),
        etaMaxDays: Number(localDraft.etaMaxDays || 0),
        priceUsd: Number(localDraft.priceUsd || 0),
        isActive: Boolean(localDraft.isActive),
      };
      if (editingLocalId) {
        await api.admin.updateShippingLocalOption(editingLocalId, payload);
        setMessage('Local shipping option updated.');
      } else {
        await api.admin.createShippingLocalOption(payload);
        setMessage('Local shipping option created.');
      }
      clearLocalDraft();
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save local shipping option.');
    } finally {
      setSaving(false);
    }
  };

  const deleteLocalOption = async (id: string) => {
    if (!window.confirm('Delete this local shipping option?')) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await api.admin.deleteShippingLocalOption(id);
      setMessage('Local shipping option removed.');
      await loadAll();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to remove local shipping option.');
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shipping Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage UPS, USPS, FedEx, DHL and configure local shipping options across African countries.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 xl:col-span-1">
          <h2 className="mb-3 font-semibold text-gray-900">Global Providers</h2>
          <div className="space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.providerKey}
                type="button"
                onClick={() => setSelectedProviderKey(provider.providerKey)}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedProviderKey === provider.providerKey
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <p className="font-medium">{provider.displayName}</p>
                <p className="text-xs opacity-70">
                  {provider.providerKey} • {provider.isActive ? 'Active' : 'Disabled'}
                </p>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-2 rounded-lg border border-dashed border-gray-300 p-3">
            <p className="text-sm font-medium text-gray-900">Add provider</p>
            <input
              value={newProviderKey}
              onChange={(event) => setNewProviderKey(event.target.value)}
              placeholder="Provider key (e.g. ARAMEX)"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <input
              value={newProviderName}
              onChange={(event) => setNewProviderName(event.target.value)}
              placeholder="Display name"
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            <Button size="sm" onClick={createProvider} disabled={saving}>
              Create Provider
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4 xl:col-span-3">
          {!draft ? (
            <p className="text-sm text-gray-500">Select a provider to configure.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Provider Key</label>
                  <input value={draft.providerKey} disabled className="w-full rounded-lg border bg-gray-50 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Display Name</label>
                  <input
                    value={draft.displayName}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, displayName: event.target.value } : prev))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Status</label>
                  <select
                    value={draft.isActive ? 'ACTIVE' : 'DISABLED'}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, isActive: event.target.value === 'ACTIVE' } : prev))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Provider Type</label>
                  <select
                    value={draft.providerType}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, providerType: event.target.value as ProviderType } : prev))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="GLOBAL">Global API</option>
                    <option value="LOCAL">Local Managed</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Mode</label>
                  <select
                    value={draft.mode}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, mode: event.target.value as ModeType } : prev))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="TEST">Test</option>
                    <option value="LIVE">Live</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Notes</label>
                  <input
                    value={draft.notes || ''}
                    onChange={(event) => setDraft((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <h3 className="mb-2 font-semibold text-gray-900">Supported Countries (optional)</h3>
                <textarea
                  value={(draft.supportsCountries || []).join(', ')}
                  onChange={(event) =>
                    setDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            supportsCountries: event.target.value
                              .split(',')
                              .map((entry) => entry.trim().toUpperCase())
                              .filter(Boolean),
                          }
                        : prev
                    )
                  }
                  placeholder="NG, GH, KE (leave empty for all countries)"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  rows={2}
                />
              </div>

              <div className="rounded-lg border p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">Integration Fields</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              configSchema: [
                                ...prev.configSchema,
                                {
                                  key: `field_${prev.configSchema.length + 1}`,
                                  label: 'New Field',
                                  type: 'TEXT',
                                  required: false,
                                  options: [],
                                  sortOrder: prev.configSchema.length,
                                },
                              ],
                            }
                          : prev
                      )
                    }
                  >
                    Add Field
                  </Button>
                </div>
                <div className="space-y-2">
                  {draft.configSchema.map((field, index) => (
                    <div key={`${field.key}-${index}`} className="grid grid-cols-1 gap-2 rounded-lg border p-2 md:grid-cols-6">
                      <input
                        value={field.key}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  configSchema: prev.configSchema.map((entry, entryIdx) =>
                                    entryIdx === index ? { ...entry, key: event.target.value } : entry
                                  ),
                                }
                              : prev
                          )
                        }
                        placeholder="fieldKey"
                        className="rounded border px-2 py-1 text-sm"
                      />
                      <input
                        value={field.label}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  configSchema: prev.configSchema.map((entry, entryIdx) =>
                                    entryIdx === index ? { ...entry, label: event.target.value } : entry
                                  ),
                                }
                              : prev
                          )
                        }
                        placeholder="Label"
                        className="rounded border px-2 py-1 text-sm"
                      />
                      <select
                        value={field.type}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  configSchema: prev.configSchema.map((entry, entryIdx) =>
                                    entryIdx === index ? { ...entry, type: event.target.value as FieldType } : entry
                                  ),
                                }
                              : prev
                          )
                        }
                        className="rounded border px-2 py-1 text-sm"
                      >
                        {FIELD_TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        value={Array.isArray(field.options) ? field.options.join(', ') : ''}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  configSchema: prev.configSchema.map((entry, entryIdx) =>
                                    entryIdx === index
                                      ? {
                                          ...entry,
                                          options: event.target.value
                                            .split(',')
                                            .map((token) => token.trim())
                                            .filter(Boolean),
                                        }
                                      : entry
                                  ),
                                }
                              : prev
                          )
                        }
                        placeholder="Options"
                        className="rounded border px-2 py-1 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={Boolean(field.required)}
                          onChange={(event) =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    configSchema: prev.configSchema.map((entry, entryIdx) =>
                                      entryIdx === index ? { ...entry, required: event.target.checked } : entry
                                    ),
                                  }
                                : prev
                            )
                          }
                        />
                        Required
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setDraft((prev) =>
                            prev ? { ...prev, configSchema: prev.configSchema.filter((_, entryIdx) => entryIdx !== index) } : prev
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <h3 className="mb-2 font-semibold text-gray-900">Configured Values</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {draft.configSchema.map((field, index) => (
                    <div key={`${field.key}-${index}`}>
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {field.label} {field.required ? '*' : ''}
                      </label>
                      <input
                        value={draft.configValues?.[field.key] ?? ''}
                        type={field.type === 'NUMBER' ? 'number' : field.type === 'PASSWORD' || field.isSecret ? 'password' : 'text'}
                        onChange={(event) =>
                          setDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  configValues: { ...prev.configValues, [field.key]: event.target.value },
                                }
                              : prev
                          )
                        }
                        className="w-full rounded border px-3 py-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={saveProvider} disabled={saving}>
                  Save Provider
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setDraft(selectedProvider ? cloneProvider(selectedProvider) : null)}
                  disabled={saving}
                >
                  Reset
                </Button>
                <Button variant="outline" onClick={deleteProvider} disabled={saving || builtinProviderKeys.includes(draft.providerKey)}>
                  Remove Provider
                </Button>
                {builtinProviderKeys.includes(draft.providerKey) ? (
                  <span className="text-xs text-gray-500">Built-in providers can be disabled but not fully deleted.</span>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Local Shipping Options (African Countries)</h2>
        <p className="mb-4 text-sm text-gray-500">
          Add local carriers/services by country and optional city override. These are used alongside global providers.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Country</label>
            <select
              value={localDraft.countryCode}
              onChange={(event) => {
                const code = event.target.value;
                const match = COUNTRY_OPTIONS.find((country) => country.code === code);
                setLocalDraft((prev) => ({ ...prev, countryCode: code, countryName: match?.name || code }));
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">City (optional)</label>
            <input
              value={localDraft.city || ''}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, city: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Lagos"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Provider Name</label>
            <input
              value={localDraft.providerName}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, providerName: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="GIG Logistics"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Provider Key</label>
            <input
              value={localDraft.providerKey}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, providerKey: event.target.value.toUpperCase() }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="LOCAL_NG"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Service Name</label>
            <input
              value={localDraft.serviceName}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, serviceName: event.target.value }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="Same-day"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Price (USD)</label>
            <input
              type="number"
              min={0}
              value={localDraft.priceUsd}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, priceUsd: Number(event.target.value || 0) }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">ETA Min (days)</label>
            <input
              type="number"
              min={0}
              value={localDraft.etaMinDays}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, etaMinDays: Number(event.target.value || 0) }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">ETA Max (days)</label>
            <input
              type="number"
              min={0}
              value={localDraft.etaMaxDays}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, etaMaxDays: Number(event.target.value || 0) }))}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={Boolean(localDraft.isActive)}
              onChange={(event) => setLocalDraft((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Button onClick={saveLocalOption} disabled={saving}>
            {editingLocalId ? 'Update Local Option' : 'Add Local Option'}
          </Button>
          <Button variant="outline" onClick={clearLocalDraft} disabled={saving}>
            Reset
          </Button>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Country</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">City</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Provider</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Service</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">ETA</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Price</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Status</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {localOptions.map((row) => (
                <tr key={row.id}>
                  <td className="px-3 py-2">{row.countryName} ({row.countryCode})</td>
                  <td className="px-3 py-2">{row.city || 'All cities'}</td>
                  <td className="px-3 py-2">{row.providerName}</td>
                  <td className="px-3 py-2">{row.serviceName}</td>
                  <td className="px-3 py-2">
                    {row.etaMinDays}-{row.etaMaxDays} days
                  </td>
                  <td className="px-3 py-2">${Number(row.priceUsd || 0).toFixed(2)}</td>
                  <td className="px-3 py-2">{row.isActive ? 'Active' : 'Disabled'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => startEditLocalOption(row)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => deleteLocalOption(row.id)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {localOptions.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-sm text-gray-500" colSpan={8}>
                    No local shipping options configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
