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

export default function AdminAutomationAiConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [testFunctionKey, setTestFunctionKey] = useState('text_grammar_enhancement');
  const [testPrompt, setTestPrompt] = useState('');
  const [settings, setSettings] = useState<any>(null);
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
    functionKey: '',
    functionLabel: '',
    providerId: '',
    isActive: true,
  });

  const loadData = async () => {
    try {
      setLoading(true);
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

  const persist = async (next: any) => {
    try {
      setSaving(true);
      setMessage('');
      const response = await api.admin.updateAutomationSettings(next);
      if (response.success) {
        setSettings(response.data || next);
        setMessage('Automation AI settings saved.');
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to save automation AI settings.');
    } finally {
      setSaving(false);
    }
  };

  const addProvider = async () => {
    if (!newProvider.name.trim()) {
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

  const testProvider = async (providerId: string) => {
    try {
      setTestingProviderId(providerId);
      setMessage('');
      const response = await api.admin.testAutomationProvider({
        providerId,
        functionKey: testFunctionKey || 'text_grammar_enhancement',
        prompt: testPrompt || undefined,
      });
      if (response.success) {
        setMessage(`Provider test passed: ${String(response?.data?.message || response?.message || 'OK')}`);
      } else {
        setMessage(`Provider test failed: ${String(response?.data?.message || response?.message || 'Unknown error')}`);
      }
    } catch (error: any) {
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
    const functionLabel = String(newBinding.functionLabel || '').trim();
    if (!functionKey || !functionLabel) {
      setMessage('Function key and label are required to add a binding.');
      return;
    }
    const next = {
      ...(settings || {}),
      functionBindings: [
        ...bindings,
        {
          id: crypto.randomUUID(),
          functionKey,
          functionLabel,
          providerId: String(newBinding.providerId || '').trim(),
          isActive: Boolean(newBinding.isActive),
        },
      ],
    };
    setSettings(next);
    setNewBinding({
      functionKey: '',
      functionLabel: '',
      providerId: '',
      isActive: true,
    });
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
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
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
        <h2 className="text-sm font-semibold text-gray-900">AI Providers</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <select
            className="rounded border px-3 py-2 text-sm"
            value={testFunctionKey}
            onChange={(event) => setTestFunctionKey(event.target.value)}
          >
            <option value="text_grammar_enhancement">Text/Grammatical Correction</option>
            <option value="image_verification">Image Verification</option>
            <option value="image_regeneration">Image Regeneration</option>
            <option value="document_ocr_analysis">Document OCR/Analysis</option>
          </select>
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Optional custom test prompt"
            value={testPrompt}
            onChange={(event) => setTestPrompt(event.target.value)}
          />
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Function Tag</th>
                <th className="px-3 py-2">Base URL</th>
                <th className="px-3 py-2">Model</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Test</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider: any) => (
                <tr key={provider.id} className="border-t">
                  <td className="px-3 py-2">{provider.name || '-'}</td>
                  <td className="px-3 py-2">{provider.functionTag || '-'}</td>
                  <td className="px-3 py-2">{provider.baseUrl || '-'}</td>
                  <td className="px-3 py-2">{provider.model || '-'}</td>
                  <td className="px-3 py-2">{provider.isActive !== false ? 'Active' : 'Inactive'}</td>
                  <td className="px-3 py-2">
                    <Button
                      variant="outline"
                      disabled={testingProviderId === provider.id || provider.isActive === false}
                      onClick={() => void testProvider(String(provider.id || ''))}
                    >
                      {testingProviderId === provider.id ? 'Testing...' : 'Test Provider'}
                    </Button>
                  </td>
                </tr>
              ))}
              {providers.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-sm text-gray-500" colSpan={6}>
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
          <input
            className="rounded border px-3 py-2"
            placeholder="Function tag (e.g., Text/Grammatical AI)"
            value={newProvider.functionTag}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, functionTag: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Base URL (endpoint)"
            value={newProvider.baseUrl}
            onChange={(event) => setNewProvider((prev) => ({ ...prev, baseUrl: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2"
            placeholder="Model"
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
          Bind each automation function to a configured provider. You can add/edit more functions in settings payload.
        </p>
        <div className="mt-3 grid gap-2 rounded border p-3 md:grid-cols-[1fr_2fr_1fr_auto_auto]">
          <input
            className="rounded border px-2 py-1 text-sm"
            placeholder="function_key"
            value={newBinding.functionKey}
            onChange={(event) => setNewBinding((prev) => ({ ...prev, functionKey: event.target.value }))}
          />
          <input
            className="rounded border px-2 py-1 text-sm"
            placeholder="Function label"
            value={newBinding.functionLabel}
            onChange={(event) => setNewBinding((prev) => ({ ...prev, functionLabel: event.target.value }))}
          />
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
