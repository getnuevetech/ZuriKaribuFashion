import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ProviderForm = {
  id: string;
  name: string;
  functionTag: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive: boolean;
};

type MessageTone = 'info' | 'success' | 'error';

const DEFAULT_FUNCTION_OPTIONS = [
  { key: 'text_grammar_enhancement', label: 'Text/Grammatical Correction' },
  { key: 'image_verification', label: 'Image Verification' },
  { key: 'image_regeneration', label: 'Image Regeneration' },
  { key: 'document_ocr_analysis', label: 'Document OCR/Analysis' },
] as const;

const FUNCTION_LABEL_BY_KEY = DEFAULT_FUNCTION_OPTIONS.reduce<Record<string, string>>((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {});

const toProviderForm = (value: any): ProviderForm => ({
  id: String(value?.id || ''),
  name: String(value?.name || ''),
  functionTag: String(value?.functionTag || ''),
  baseUrl: String(value?.baseUrl || ''),
  apiKey: String(value?.apiKey || ''),
  model: String(value?.model || ''),
  isActive: value?.isActive !== false,
});

export default function AdminAutomationAiConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<MessageTone>('info');
  const [testFunctionKey, setTestFunctionKey] = useState('text_grammar_enhancement');
  const [testPrompt, setTestPrompt] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [providerDrafts, setProviderDrafts] = useState<Record<string, ProviderForm>>({});
  const [newProvider, setNewProvider] = useState<ProviderForm>({
    id: '',
    name: '',
    functionTag: '',
    baseUrl: '',
    apiKey: '',
    model: '',
    isActive: true,
  });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [newBinding, setNewBinding] = useState({
    functionKey: DEFAULT_FUNCTION_OPTIONS[0].key,
    providerId: '',
    isActive: true,
  });
  const [newFunction, setNewFunction] = useState({
    key: '',
    label: '',
    description: '',
    isActive: true,
  });
  const [providerFunctionSelections, setProviderFunctionSelections] = useState<Record<string, string[]>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      setMessageTone('info');
      setMessage('');
      const [settingsRes, suggestionsRes] = await Promise.all([
        api.admin.getAutomationSettings(),
        api.admin.getAutomationProviderSuggestions(),
      ]);
      if (settingsRes.success) {
        setSettings(settingsRes.data || null);
      }
      if (suggestionsRes.success) {
        setSuggestions(Array.isArray(suggestionsRes.data) ? suggestionsRes.data : []);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load automation AI settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const providers = useMemo(() => (Array.isArray(settings?.aiProviders) ? settings.aiProviders : []), [settings]);
  const bindings = useMemo(
    () => (Array.isArray(settings?.functionBindings) ? settings.functionBindings : []),
    [settings]
  );
  const functionCatalogOptions = useMemo(() => {
    const catalogRows = Array.isArray(settings?.functionCatalog) ? settings.functionCatalog : [];
    const map = new Map<string, { key: string; label: string; description?: string; isSystem?: boolean; isActive?: boolean }>();
    for (const row of DEFAULT_FUNCTION_OPTIONS) {
      map.set(row.key, {
        key: row.key,
        label: row.label,
        description: '',
        isSystem: true,
        isActive: true,
      });
    }
    for (const row of catalogRows) {
      const key = String(row?.key || '')
        .trim()
        .toLowerCase();
      if (!key) continue;
      map.set(key, {
        key,
        label: String(row?.label || FUNCTION_LABEL_BY_KEY[key] || key).trim() || key,
        description: String(row?.description || '').trim(),
        isSystem: row?.isSystem === true,
        isActive: row?.isActive !== false,
      });
    }
    return Array.from(map.values()).sort((a, b) => String(a.label).localeCompare(String(b.label)));
  }, [settings]);
  const functionKeySet = useMemo(
    () => new Set(functionCatalogOptions.map((entry) => String(entry.key || '').trim().toLowerCase()).filter(Boolean)),
    [functionCatalogOptions]
  );
  const providerTagOptions = useMemo(() => {
    const options = new Map<string, string>();
    const add = (value: string, label: string) => {
      const normalized = String(value || '').trim();
      if (!normalized) return;
      if (!options.has(normalized)) options.set(normalized, String(label || normalized).trim() || normalized);
    };
    add('OPENAI', 'OpenAI');
    add('GEMINI', 'Google Gemini');
    add('STABILITY_AI', 'Stability AI');
    add('AZURE_DOCUMENT_INTELLIGENCE', 'Azure Document Intelligence');
    for (const row of suggestions || []) {
      add(String(row?.providerKey || ''), String(row?.label || row?.providerKey || ''));
    }
    for (const row of providers || []) {
      const tag = String(row?.functionTag || '').trim();
      if (tag) add(tag, tag);
    }
    return Array.from(options.entries()).map(([value, label]) => ({ value, label }));
  }, [suggestions, providers]);

  useEffect(() => {
    const nextDrafts = (providers || []).reduce<Record<string, ProviderForm>>((acc, provider: any) => {
      const id = String(provider?.id || '').trim();
      if (!id) return acc;
      acc[id] = toProviderForm(provider);
      return acc;
    }, {});
    setProviderDrafts(nextDrafts);
    const nextSelections = (providers || []).reduce<Record<string, string[]>>((acc, provider: any) => {
      const id = String(provider?.id || '').trim();
      if (!id) return acc;
      const linkedFunctionKeys = bindings
        .filter((binding: any) => String(binding?.providerId || '').trim() === id)
        .map((binding: any) => String(binding?.functionKey || '').trim().toLowerCase())
        .filter((key: string) => functionKeySet.has(key));
      acc[id] = Array.from(new Set(linkedFunctionKeys));
      return acc;
    }, {});
    setProviderFunctionSelections(nextSelections);
  }, [providers, bindings, functionKeySet]);

  const persist = async (next: any) => {
    try {
      setSaving(true);
      setMessageTone('info');
      setMessage('');
      const response = await api.admin.updateAutomationSettings(next);
      if (response.success) {
        setSettings(response.data || next);
        setMessageTone('success');
        setMessage('Automation AI settings saved.');
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to save automation AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const addProvider = async () => {
    if (!newProvider.name.trim()) {
      setMessageTone('error');
      setMessage('Provider name is required.');
      return;
    }
    const nextProviders = [
      ...providers,
      {
        ...newProvider,
        id: newProvider.id || crypto.randomUUID(),
      },
    ];
    const nextSettings = {
      ...(settings || {}),
      aiProviders: nextProviders,
    };
    await persist(nextSettings);
    setNewProvider({
      id: '',
      name: '',
      functionTag: '',
      baseUrl: '',
      apiKey: '',
      model: '',
      isActive: true,
    });
  };

  const updateProviderDraft = (providerId: string, patch: Partial<ProviderForm>) => {
    setProviderDrafts((prev) => ({
      ...prev,
      [providerId]: {
        ...(prev[providerId] || toProviderForm(providers.find((entry: any) => String(entry?.id || '') === providerId))),
        ...patch,
      },
    }));
  };

  const toggleProviderFunctionSelection = (providerId: string, functionKey: string, checked: boolean) => {
    const normalized = String(functionKey || '').trim().toLowerCase();
    if (!functionKeySet.has(normalized)) return;
    setProviderFunctionSelections((prev) => {
      const current = Array.isArray(prev[providerId]) ? prev[providerId] : [];
      const next = checked
        ? Array.from(new Set([...current, normalized]))
        : current.filter((entry) => entry !== normalized);
      return {
        ...prev,
        [providerId]: next,
      };
    });
  };

  const saveProviderRow = async (providerId: string) => {
    const draft = providerDrafts[providerId];
    if (!draft || !String(draft.name || '').trim()) {
      setMessageTone('error');
      setMessage('Provider name is required.');
      return;
    }
    const nextProviders = providers.map((entry: any) =>
      String(entry?.id || '') === providerId
        ? {
            ...entry,
            ...draft,
            id: providerId,
          }
        : entry
    );
    const selectedFunctionKeys = Array.from(
      new Set(
        (providerFunctionSelections[providerId] || [])
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter((entry) => functionKeySet.has(entry))
      )
    );
    const providerExistingBindings = bindings.filter(
      (entry: any) => String(entry?.providerId || '').trim() === providerId
    );
    const otherBindings = bindings.filter((entry: any) => String(entry?.providerId || '').trim() !== providerId);
    const nextProviderBindings = selectedFunctionKeys.map((functionKey) => {
      const existing = providerExistingBindings.find(
        (entry: any) => String(entry?.functionKey || '').trim().toLowerCase() === functionKey
      );
      return {
        ...(existing || {}),
        id: existing?.id || crypto.randomUUID(),
        functionKey,
        functionLabel: FUNCTION_LABEL_BY_KEY[functionKey] || functionKey,
        providerId,
        isActive: existing?.isActive !== false,
      };
    });
    const nextSettings = {
      ...(settings || {}),
      aiProviders: nextProviders,
      functionBindings: [...otherBindings, ...nextProviderBindings],
    };
    await persist(nextSettings);
  };

  const deleteProviderRow = async (providerId: string) => {
    const nextProviders = providers.filter((entry: any) => String(entry?.id || '') !== providerId);
    const nextBindings = bindings.map((entry: any) =>
      String(entry?.providerId || '') === providerId ? { ...entry, providerId: '' } : entry
    );
    const nextSettings = {
      ...(settings || {}),
      aiProviders: nextProviders,
      functionBindings: nextBindings,
    };
    await persist(nextSettings);
    setProviderDrafts((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
    setProviderFunctionSelections((prev) => {
      const next = { ...prev };
      delete next[providerId];
      return next;
    });
  };

  const testProvider = async (providerId: string) => {
    try {
      setTestingProviderId(providerId);
      setMessageTone('info');
      setMessage('');
      const provider = providers.find((entry: any) => String(entry?.id || '') === providerId);
      const providerBaseUrl = String(
        providerDrafts[providerId]?.baseUrl || provider?.baseUrl || ''
      ).toLowerCase();
      const isStability = providerBaseUrl.includes('stability.ai');
      const resolvedFunctionKey = isStability
        ? 'image_regeneration'
        : testFunctionKey || 'text_grammar_enhancement';
      const response = await api.admin.testAutomationProvider({
        providerId,
        functionKey: resolvedFunctionKey,
        prompt: testPrompt || undefined,
      });
      if (response.success) {
        setMessageTone('success');
        setMessage(
          `Provider test passed${isStability ? ' (using image_regeneration for Stability)' : ''}: ${String(
            response?.data?.message || response?.message || 'OK'
          )}`
        );
      } else {
        setMessageTone('error');
        setMessage(`Provider test failed: ${String(response?.data?.message || response?.message || 'Unknown error')}`);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(
        `Provider test failed: ${String(
          error?.response?.data?.message || error?.response?.data?.data?.message || error?.message || 'Unknown error'
        )}`
      );
    } finally {
      setTestingProviderId(null);
    }
  };

  const addBinding = () => {
    const functionKey = String(newBinding.functionKey || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    if (!functionKey || !functionKeySet.has(functionKey)) {
      setMessageTone('error');
      setMessage('Please select a valid function key.');
      return;
    }
    if (
      bindings.some(
        (entry: any) =>
          String(entry?.functionKey || '').trim().toLowerCase() === functionKey &&
          String(entry?.providerId || '').trim() === String(newBinding.providerId || '').trim()
      )
    ) {
      setMessageTone('error');
      setMessage('Binding already exists for this function key and provider.');
      return;
    }
    const next = {
      ...(settings || {}),
      functionBindings: [
        ...bindings,
        {
          id: crypto.randomUUID(),
          functionKey,
          functionLabel: functionCatalogOptions.find((entry) => entry.key === functionKey)?.label || FUNCTION_LABEL_BY_KEY[functionKey] || functionKey,
          providerId: String(newBinding.providerId || '').trim(),
          isActive: Boolean(newBinding.isActive),
        },
      ],
    };
    setSettings(next);
    setNewBinding({
      functionKey: functionCatalogOptions[0]?.key || DEFAULT_FUNCTION_OPTIONS[0].key,
      providerId: '',
      isActive: true,
    });
  };

  const addFunctionCatalogEntry = async () => {
    const key = String(newFunction.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');
    const label = String(newFunction.label || '').trim();
    if (!key || key.length < 2 || !label) {
      setMessageTone('error');
      setMessage('Function key and label are required.');
      return;
    }
    if (functionCatalogOptions.some((entry) => String(entry.key || '').trim().toLowerCase() === key)) {
      setMessageTone('error');
      setMessage('Function key already exists.');
      return;
    }
    const existingCatalog = Array.isArray(settings?.functionCatalog) ? settings.functionCatalog : [];
    const nextSettings = {
      ...(settings || {}),
      functionCatalog: [
        ...existingCatalog,
        {
          id: crypto.randomUUID(),
          key,
          label,
          description: String(newFunction.description || '').trim(),
          isSystem: false,
          isActive: newFunction.isActive !== false,
        },
      ],
    };
    await persist(nextSettings);
    setNewFunction({
      key: '',
      label: '',
      description: '',
      isActive: true,
    });
    setNewBinding((prev) => ({ ...prev, functionKey: key }));
  };

  const toggleFunctionCatalogEntry = async (entry: any, isActive: boolean) => {
    const key = String(entry?.key || '').trim().toLowerCase();
    const existingCatalog = Array.isArray(settings?.functionCatalog) ? settings.functionCatalog : [];
    const nextCatalog = existingCatalog.map((row: any) =>
      String(row?.key || '').trim().toLowerCase() === key ? { ...row, isActive } : row
    );
    const nextSettings = {
      ...(settings || {}),
      functionCatalog: nextCatalog,
      functionBindings: bindings.map((row: any) =>
        String(row?.functionKey || '').trim().toLowerCase() === key ? { ...row, isActive } : row
      ),
    };
    await persist(nextSettings);
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation AI API Integrations</h1>
        <p className="text-sm text-gray-600">
          Configure multiple AI providers and map each automation function to the provider you want to use.
        </p>
      </div>

      {message ? (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            messageTone === 'success'
              ? 'border-green-200 bg-green-50 text-green-800'
              : messageTone === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : 'border-gray-200 bg-gray-50 text-gray-700'
          }`}
        >
          {message}
        </div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Provider Suggestions</h2>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {suggestions.map((row) => (
            <div key={row.providerKey} className="rounded border px-3 py-2 text-xs text-gray-700">
              <p className="font-medium text-gray-900">{row.label}</p>
              <p className="mt-1">Recommended: {(row.recommendedFunctions || []).join(', ') || '-'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">AI Function Catalog</h2>
        <p className="mt-1 text-xs text-gray-500">
          Add custom AI functions beyond the default system functions, then bind each function to any provider.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="function_key (example: fraud_screening)"
            value={newFunction.key}
            onChange={(event) => setNewFunction((prev) => ({ ...prev, key: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Function label"
            value={newFunction.label}
            onChange={(event) => setNewFunction((prev) => ({ ...prev, label: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Function description (optional)"
            value={newFunction.description}
            onChange={(event) => setNewFunction((prev) => ({ ...prev, description: event.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
            <input
              type="checkbox"
              checked={newFunction.isActive}
              onChange={(event) => setNewFunction((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Button variant="outline" onClick={() => void addFunctionCatalogEntry()} disabled={saving}>
            {saving ? 'Saving...' : 'Add Function'}
          </Button>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Function Key</th>
                <th className="px-3 py-2">Label</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {functionCatalogOptions.map((entry) => (
                <tr key={entry.key} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{entry.key}</td>
                  <td className="px-3 py-2 text-gray-900">{entry.label}</td>
                  <td className="px-3 py-2 text-gray-700">{entry.description || '-'}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs ${
                        entry.isSystem ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {entry.isSystem ? 'System' : 'Custom'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                      <input
                        type="checkbox"
                        checked={entry.isActive !== false}
                        onChange={(event) => void toggleFunctionCatalogEntry(entry, event.target.checked)}
                        disabled={entry.isSystem === true}
                      />
                      {entry.isActive !== false ? 'Active' : 'Inactive'}
                    </label>
                  </td>
                </tr>
              ))}
              {functionCatalogOptions.length < 1 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={5}>
                    No function catalog entries.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">AI Providers</h2>
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-semibold">Base URL and Model guide</p>
          <p className="mt-1">
            Base URL should be the API root used by your provider. For OpenAI-compatible providers, the system appends
            <code className="mx-1 rounded bg-white px-1">/chat/completions</code>
            and
            <code className="mx-1 rounded bg-white px-1">/images/generations</code>
            automatically (and also tries
            <code className="mx-1 rounded bg-white px-1">/v1/...</code>
            fallback routes for 404 errors).
          </p>
          <p className="mt-1">
            Example: OpenAI-compatible Base URL
            <code className="mx-1 rounded bg-white px-1">https://api.openai.com/v1</code>
            with model
            <code className="mx-1 rounded bg-white px-1">gpt-4o-mini</code>
            for text and
            <code className="mx-1 rounded bg-white px-1">gpt-image-1</code>
            for image generation.
          </p>
          <p className="mt-1">
            Gemini native (recommended for text): Base URL
            <code className="mx-1 rounded bg-white px-1">https://generativelanguage.googleapis.com/v1beta</code>
            with model
            <code className="mx-1 rounded bg-white px-1">gemini-2.5-flash</code>
            (do not prefix model with
            <code className="mx-1 rounded bg-white px-1">models/</code>
            ).
          </p>
          <p className="mt-1">
            Gemini OpenAI-compatible: Base URL
            <code className="mx-1 rounded bg-white px-1">https://generativelanguage.googleapis.com/v1beta/openai</code>
            with model
            <code className="mx-1 rounded bg-white px-1">gemini-2.5-flash</code>
            or
            <code className="mx-1 rounded bg-white px-1">gemini-2.5-pro</code>.
          </p>
          <p className="mt-1">
            If you see
            <code className="mx-1 rounded bg-white px-1">429 quota exceeded</code>
            , the key is valid but usage/billing limit is reached.
          </p>
          <p className="mt-1">
            Stability AI: use Base URL
            <code className="mx-1 rounded bg-white px-1">https://api.stability.ai</code>
            and test/bind with
            <code className="mx-1 rounded bg-white px-1">image_regeneration</code>
            (text/chat functions are not supported by Stability in this automation path).
          </p>
          <p className="mt-1">
            If you see
            <code className="mx-1 rounded bg-white px-1">404 Not Found</code>
            , make sure you entered the provider API URL (not the marketing website URL), or paste the exact endpoint.
          </p>
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={testFunctionKey}
            onChange={(event) => setTestFunctionKey(event.target.value)}
          >
            {functionCatalogOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Optional custom test prompt"
            value={testPrompt}
            onChange={(event) => setTestPrompt(event.target.value)}
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1400px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Function Tag</th>
                <th className="px-3 py-2">Base URL</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">API Key</th>
                <th className="px-3 py-2">Function Keys</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Test</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider: any) => {
                const providerId = String(provider.id || '');
                const draft = providerDrafts[providerId] || toProviderForm(provider);
                return (
                  <tr key={provider.id} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={draft.name}
                        onChange={(event) => updateProviderDraft(providerId, { name: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={draft.functionTag}
                        onChange={(event) => updateProviderDraft(providerId, { functionTag: event.target.value })}
                      >
                        <option value="">Select provider tag</option>
                        {providerTagOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={draft.baseUrl}
                        onChange={(event) => updateProviderDraft(providerId, { baseUrl: event.target.value })}
                        placeholder="https://api.openai.com/v1 or https://generativelanguage.googleapis.com/v1beta"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={draft.model}
                        onChange={(event) => updateProviderDraft(providerId, { model: event.target.value })}
                        placeholder="gpt-4o-mini or gemini-2.5-flash"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded border px-2 py-1"
                        value={draft.apiKey}
                        onChange={(event) => updateProviderDraft(providerId, { apiKey: event.target.value })}
                        placeholder="sk-..."
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="grid gap-1">
                        {functionCatalogOptions.map((option) => {
                          const selected = (providerFunctionSelections[providerId] || []).includes(option.key);
                          return (
                            <label key={`${providerId}-${option.key}`} className="inline-flex items-center gap-2 text-xs text-gray-700">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) =>
                                  toggleProviderFunctionSelection(providerId, option.key, event.target.checked)
                                }
                              />
                              {option.label}
                            </label>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={draft.isActive}
                          onChange={(event) => updateProviderDraft(providerId, { isActive: event.target.checked })}
                        />
                        {draft.isActive ? 'Active' : 'Inactive'}
                      </label>
                    </td>
                    <td className="px-3 py-2">
                      <Button
                        variant="outline"
                        disabled={testingProviderId === provider.id || draft.isActive === false}
                        onClick={() => void testProvider(providerId)}
                      >
                        {testingProviderId === provider.id ? 'Testing...' : 'Test Provider'}
                      </Button>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          disabled={saving}
                          onClick={() => void saveProviderRow(providerId)}
                        >
                          Save
                        </Button>
                        <Button
                          variant="outline"
                          disabled={saving}
                          onClick={() => void deleteProviderRow(providerId)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {providers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-sm text-gray-500" colSpan={9}>
                    No provider configured yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Add AI Provider</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            className="rounded border px-3 py-2"
            placeholder="Provider name (e.g., ChatGPT)"
            value={newProvider.name}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, name: event.target.value }))}
          />
          <select
            className="rounded border px-3 py-2"
            value={newProvider.functionTag}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, functionTag: event.target.value }))}
          >
            <option value="">Provider tag (select)</option>
            {providerTagOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            className="rounded border px-3 py-2"
            placeholder="Base URL (e.g., https://api.openai.com/v1 or .../v1beta)"
            value={newProvider.baseUrl}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, baseUrl: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Model (e.g., gpt-4o-mini or gemini-2.5-flash)"
            value={newProvider.model}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, model: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 md:col-span-2"
            placeholder="API Key"
            value={newProvider.apiKey}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, apiKey: event.target.value }))}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={newProvider.isActive}
              onChange={(event) => setNewProvider((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Button onClick={() => void addProvider()} disabled={saving}>
            {saving ? 'Saving...' : 'Add Provider'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Function Bindings</h2>
        <p className="text-xs text-gray-500">
          Bind system-defined automation functions to configured providers.
        </p>
        <div className="mt-3 grid gap-2 rounded border p-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <select
            className="rounded border px-2 py-1 text-sm"
            value={newBinding.functionKey}
            onChange={(event) => setNewBinding((prev) => ({ ...prev, functionKey: event.target.value }))}
          >
            {functionCatalogOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-2 py-1 text-sm"
            value={newBinding.providerId}
            onChange={(event) => setNewBinding((prev) => ({ ...prev, providerId: event.target.value }))}
          >
            <option value="">Unassigned</option>
            {providers.map((provider: any) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={newBinding.isActive}
              onChange={(event) => setNewBinding((prev) => ({ ...prev, isActive: event.target.checked }))}
            />
            Active
          </label>
          <Button variant="outline" onClick={addBinding}>
            Add
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {bindings.map((binding: any) => (
            <div key={binding.id} className="flex flex-wrap items-center gap-2 rounded border px-3 py-2 text-sm">
              <span className="min-w-[220px] font-medium text-gray-800">{binding.functionLabel || binding.functionKey}</span>
              <select
                className="rounded border px-2 py-1"
                value={binding.providerId || ''}
                onChange={(event) => {
                  const next = {
                    ...(settings || {}),
                    functionBindings: bindings.map((entry: any) =>
                      entry.id === binding.id ? { ...entry, providerId: event.target.value } : entry
                    ),
                  };
                  setSettings(next);
                }}
              >
                <option value="">Unassigned</option>
                {providers.map((provider: any) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={binding.isActive !== false}
                  onChange={(event) => {
                    const next = {
                      ...(settings || {}),
                      functionBindings: bindings.map((entry: any) =>
                        entry.id === binding.id ? { ...entry, isActive: event.target.checked } : entry
                      ),
                    };
                    setSettings(next);
                  }}
                />
                Active
              </label>
              <Button
                variant="outline"
                onClick={() => {
                  const next = {
                    ...(settings || {}),
                    functionBindings: bindings.filter((entry: any) => entry.id !== binding.id),
                  };
                  setSettings(next);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          {bindings.length === 0 ? <p className="text-sm text-gray-500">No function bindings available.</p> : null}
        </div>
        <div className="mt-3">
          <Button onClick={() => void persist(settings)} disabled={saving}>
            {saving ? 'Saving...' : 'Save Function Bindings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
