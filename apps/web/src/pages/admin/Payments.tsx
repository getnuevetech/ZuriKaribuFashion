import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type FieldType = 'TEXT' | 'PASSWORD' | 'URL' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'TEXTAREA';
type CheckoutType = 'INLINE' | 'REDIRECT';
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

interface PaymentProviderRow {
  id: string;
  providerKey: string;
  displayName: string;
  checkoutType: CheckoutType;
  mode: ModeType;
  isActive: boolean;
  configSchema: IntegrationField[];
  configValues: Record<string, any>;
  notes?: string | null;
  updatedAt?: string;
}

const FIELD_TYPE_OPTIONS: FieldType[] = ['TEXT', 'PASSWORD', 'URL', 'NUMBER', 'BOOLEAN', 'SELECT', 'TEXTAREA'];

const cloneProvider = (row: PaymentProviderRow): PaymentProviderRow => ({
  ...row,
  configSchema: Array.isArray(row.configSchema)
    ? row.configSchema.map((field, idx) => ({
        ...field,
        options: Array.isArray(field.options) ? [...field.options] : [],
        sortOrder: Number.isFinite(Number(field.sortOrder)) ? Number(field.sortOrder) : idx,
      }))
    : [],
  configValues: row.configValues && typeof row.configValues === 'object' ? { ...row.configValues } : {},
});

export default function AdminPayments() {
  const [providers, setProviders] = useState<PaymentProviderRow[]>([]);
  const [builtinProviderKeys, setBuiltinProviderKeys] = useState<string[]>([]);
  const [selectedProviderKey, setSelectedProviderKey] = useState<string>('');
  const [draft, setDraft] = useState<PaymentProviderRow | null>(null);
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

  const loadProviders = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.admin.getPaymentIntegrations();
      if (!response.success) throw new Error('Failed to load payment integrations.');
      const rows = Array.isArray(response.data?.providers) ? response.data.providers : [];
      const normalized = rows.map((entry: any) => cloneProvider({
        id: String(entry.id || ''),
        providerKey: String(entry.providerKey || ''),
        displayName: String(entry.displayName || entry.providerKey || 'Provider'),
        checkoutType: entry.checkoutType === 'REDIRECT' ? 'REDIRECT' : 'INLINE',
        mode: entry.mode === 'LIVE' ? 'LIVE' : 'TEST',
        isActive: Boolean(entry.isActive),
        configSchema: Array.isArray(entry.configSchema) ? entry.configSchema : [],
        configValues: entry.configValues && typeof entry.configValues === 'object' ? entry.configValues : {},
        notes: entry.notes ? String(entry.notes) : '',
        updatedAt: entry.updatedAt ? String(entry.updatedAt) : '',
      }));
      setProviders(normalized);
      setBuiltinProviderKeys(Array.isArray(response.data?.builtinProviderKeys) ? response.data.builtinProviderKeys : []);
      const nextSelected = normalized.find((entry) => entry.providerKey === selectedProviderKey)?.providerKey || normalized[0]?.providerKey || '';
      setSelectedProviderKey(nextSelected);
      setDraft(nextSelected ? cloneProvider(normalized.find((entry) => entry.providerKey === nextSelected) as PaymentProviderRow) : null);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load payment integrations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProviders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedProvider) {
      setDraft(null);
      return;
    }
    setDraft(cloneProvider(selectedProvider));
  }, [selectedProvider]);

  const updateDraftField = (index: number, updates: Partial<IntegrationField>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const configSchema = prev.configSchema.map((field, fieldIdx) =>
        fieldIdx === index ? { ...field, ...updates } : field
      );
      return { ...prev, configSchema };
    });
  };

  const saveProvider = async () => {
    if (!draft) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      const configSchema = draft.configSchema
        .map((field, index) => ({
          ...field,
          key: String(field.key || '').trim(),
          label: String(field.label || field.key || '').trim(),
          sortOrder: index,
          options: Array.isArray(field.options) ? field.options.filter(Boolean) : [],
        }))
        .filter((field) => field.key.length > 0);
      const configValues = draft.configValues && typeof draft.configValues === 'object' ? draft.configValues : {};
      const response = await api.admin.updatePaymentIntegration(draft.providerKey, {
        displayName: draft.displayName,
        checkoutType: draft.checkoutType,
        mode: draft.mode,
        isActive: draft.isActive,
        configSchema,
        configValues,
        notes: draft.notes || '',
      });
      if (!response.success) throw new Error('Failed to save payment integration.');
      setMessage(`${draft.displayName} saved successfully.`);
      await loadProviders();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to save payment integration.');
    } finally {
      setSaving(false);
    }
  };

  const createProvider = async () => {
    try {
      const providerKey = String(newProviderKey || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9_]/g, '_');
      if (!providerKey) {
        setError('Provider key is required (letters/numbers/underscore).');
        return;
      }
      if (!newProviderName.trim()) {
        setError('Provider name is required.');
        return;
      }
      setSaving(true);
      setError('');
      setMessage('');
      const response = await api.admin.createPaymentIntegration({
        providerKey,
        displayName: newProviderName.trim(),
        checkoutType: 'REDIRECT',
        mode: 'TEST',
        isActive: false,
        configSchema: [],
        configValues: {},
      });
      if (!response.success) throw new Error('Failed to create payment integration.');
      setNewProviderKey('');
      setNewProviderName('');
      setSelectedProviderKey(providerKey);
      setMessage(`Provider ${providerKey} created.`);
      await loadProviders();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to create payment integration.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProvider = async () => {
    if (!draft) return;
    const confirmed = window.confirm(`Remove payment provider ${draft.displayName}?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      setError('');
      setMessage('');
      await api.admin.deletePaymentIntegration(draft.providerKey);
      setMessage(`${draft.displayName} removed.`);
      await loadProviders();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to remove payment integration.');
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
        <h1 className="text-2xl font-bold text-gray-900">Payment Integrations</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure payment providers dynamically. Add/edit required API variables and custom fields without code changes.
        </p>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {message ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</div> : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 xl:col-span-1">
          <h2 className="mb-3 font-semibold text-gray-900">Providers</h2>
          <div className="space-y-2">
            {providers.map((provider) => (
              <button
                key={provider.providerKey}
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
              placeholder="Provider key (e.g. PAYSTACK)"
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
                    onChange={(event) =>
                      setDraft((prev) => (prev ? { ...prev, isActive: event.target.value === 'ACTIVE' } : prev))
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="DISABLED">Disabled</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Checkout Type</label>
                  <select
                    value={draft.checkoutType}
                    onChange={(event) =>
                      setDraft((prev) =>
                        prev ? { ...prev, checkoutType: event.target.value as CheckoutType } : prev
                      )
                    }
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  >
                    <option value="INLINE">Inline</option>
                    <option value="REDIRECT">Redirect</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-gray-600">Mode</label>
                  <select
                    value={draft.mode}
                    onChange={(event) =>
                      setDraft((prev) => (prev ? { ...prev, mode: event.target.value as ModeType } : prev))
                    }
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
                    placeholder="Optional operational notes"
                  />
                </div>
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

                <div className="space-y-3">
                  {draft.configSchema.map((field, index) => (
                    <div key={`${field.key}-${index}`} className="rounded-lg border p-3">
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
                        <input
                          value={field.key}
                          onChange={(event) => updateDraftField(index, { key: event.target.value })}
                          placeholder="fieldKey"
                          className="rounded border px-2 py-1 text-sm"
                        />
                        <input
                          value={field.label}
                          onChange={(event) => updateDraftField(index, { label: event.target.value })}
                          placeholder="Label"
                          className="rounded border px-2 py-1 text-sm"
                        />
                        <select
                          value={field.type}
                          onChange={(event) => updateDraftField(index, { type: event.target.value as FieldType })}
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
                            updateDraftField(index, {
                              options: event.target.value
                                .split(',')
                                .map((token) => token.trim())
                                .filter(Boolean),
                            })
                          }
                          placeholder="Options (comma-separated)"
                          className="rounded border px-2 py-1 text-sm"
                        />
                        <div className="flex items-center gap-3 text-xs">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={Boolean(field.required)}
                              onChange={(event) => updateDraftField(index, { required: event.target.checked })}
                            />
                            Required
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={Boolean(field.isSecret)}
                              onChange={(event) => updateDraftField(index, { isSecret: event.target.checked })}
                            />
                            Secret
                          </label>
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={Boolean(field.exposePublic)}
                              onChange={(event) => updateDraftField(index, { exposePublic: event.target.checked })}
                            />
                            Public
                          </label>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setDraft((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    configSchema: prev.configSchema.filter((_, fieldIdx) => fieldIdx !== index),
                                  }
                                : prev
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                        <input
                          value={field.placeholder || ''}
                          onChange={(event) => updateDraftField(index, { placeholder: event.target.value })}
                          placeholder="Placeholder"
                          className="rounded border px-2 py-1 text-sm"
                        />
                        <input
                          value={field.helpText || ''}
                          onChange={(event) => updateDraftField(index, { helpText: event.target.value })}
                          placeholder="Help text"
                          className="rounded border px-2 py-1 text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <h3 className="mb-3 font-semibold text-gray-900">Configured Values</h3>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {draft.configSchema.map((field, index) => {
                    const value = draft.configValues?.[field.key];
                    const normalizedValue =
                      field.type === 'BOOLEAN'
                        ? String(Boolean(value))
                        : value === undefined || value === null
                          ? ''
                          : String(value);
                    return (
                      <div key={`${field.key}-value-${index}`}>
                        <label className="mb-1 block text-xs font-semibold text-gray-600">
                          {field.label} {field.required ? '*' : ''}
                        </label>
                        {field.type === 'BOOLEAN' ? (
                          <select
                            value={normalizedValue}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      configValues: {
                                        ...prev.configValues,
                                        [field.key]: event.target.value === 'true',
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full rounded border px-3 py-2 text-sm"
                          >
                            <option value="false">false</option>
                            <option value="true">true</option>
                          </select>
                        ) : field.type === 'SELECT' && Array.isArray(field.options) && field.options.length > 0 ? (
                          <select
                            value={normalizedValue}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      configValues: {
                                        ...prev.configValues,
                                        [field.key]: event.target.value,
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full rounded border px-3 py-2 text-sm"
                          >
                            <option value="">Select...</option>
                            {field.options.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        ) : field.type === 'TEXTAREA' ? (
                          <textarea
                            value={normalizedValue}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      configValues: {
                                        ...prev.configValues,
                                        [field.key]: event.target.value,
                                      },
                                    }
                                  : prev
                              )
                            }
                            className="w-full rounded border px-3 py-2 text-sm"
                          />
                        ) : (
                          <input
                            type={field.type === 'NUMBER' ? 'number' : field.type === 'PASSWORD' || field.isSecret ? 'password' : 'text'}
                            value={normalizedValue}
                            onChange={(event) =>
                              setDraft((prev) =>
                                prev
                                  ? {
                                      ...prev,
                                      configValues: {
                                        ...prev.configValues,
                                        [field.key]: event.target.value,
                                      },
                                    }
                                  : prev
                              )
                            }
                            placeholder={field.placeholder || ''}
                            className="w-full rounded border px-3 py-2 text-sm"
                          />
                        )}
                        {field.helpText ? <p className="mt-1 text-xs text-gray-500">{field.helpText}</p> : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={saveProvider} disabled={saving}>
                  Save Integration
                </Button>
                <Button variant="outline" onClick={() => setDraft(selectedProvider ? cloneProvider(selectedProvider) : null)} disabled={saving}>
                  Reset Changes
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
    </div>
  );
}
