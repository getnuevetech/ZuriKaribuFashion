import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type CriteriaScope = 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN' | 'ACCOUNT_APPROVAL';

const FUNCTION_OPTIONS = [
  { key: 'text_grammar_enhancement', label: 'Text/Grammatical Correction' },
  { key: 'image_verification', label: 'Image Verification' },
  { key: 'image_regeneration', label: 'Image Regeneration' },
  { key: 'document_ocr_analysis', label: 'Document OCR/Analysis' },
] as const;

const FIELD_OPTIONS_BY_SCOPE: Record<CriteriaScope, Array<{ value: string; label: string }>> = {
  FABRIC: [
    { value: '', label: 'Auto (by criterion)' },
    { value: 'name', label: 'Product Name' },
    { value: 'description', label: 'Product Description' },
    { value: 'finalPrice', label: 'Final Price' },
    { value: 'minYards', label: 'Minimum Yards' },
    { value: 'stockYards', label: 'Stock Yards' },
    { value: 'predominantColor', label: 'Predominant Color' },
    { value: 'images[0]', label: 'Primary Product Image' },
  ],
  READY_TO_WEAR: [
    { value: '', label: 'Auto (by criterion)' },
    { value: 'name', label: 'Product Name' },
    { value: 'description', label: 'Product Description' },
    { value: 'basePrice', label: 'Base Price' },
    { value: 'predominantColor', label: 'Predominant Color' },
    { value: 'images[0]', label: 'Primary Product Image' },
  ],
  DESIGN: [
    { value: '', label: 'Auto (by criterion)' },
    { value: 'name', label: 'Design Name' },
    { value: 'description', label: 'Design Description' },
    { value: 'basePrice', label: 'Base Price' },
    { value: 'predominantColor', label: 'Predominant Color' },
    { value: 'images[0]', label: 'Primary Product Image' },
  ],
  ACCOUNT_APPROVAL: [
    { value: '', label: 'Auto (by criterion)' },
    { value: 'account.notes', label: 'Account Notes / Summary' },
    { value: 'account.identity', label: 'Identity Fields' },
    { value: 'account.contact', label: 'Contact Fields' },
  ],
};

const toProviderOptions = (settings: any) =>
  (Array.isArray(settings?.aiProviders) ? settings.aiProviders : [])
    .filter((entry: any) => String(entry?.id || '').trim().length > 0)
    .map((entry: any) => ({
      value: String(entry.id),
      label: `${String(entry.name || entry.id)}${entry.isActive === false ? ' (inactive)' : ''}`,
    }));

export default function AdminAutomationSystemPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const [activeScope, setActiveScope] = useState<CriteriaScope>('FABRIC');
  const [settings, setSettings] = useState<any>(null);

  const load = async () => {
    try {
      setLoading(true);
      setMessage('');
      const response = await api.admin.getAutomationSettings();
      if (response.success) {
        setSettings(response.data || null);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load automation system settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const providerOptions = useMemo(() => toProviderOptions(settings), [settings]);
  const criteriaRows = useMemo(() => {
    const rows = settings?.criteria?.[activeScope];
    return Array.isArray(rows) ? rows : [];
  }, [settings, activeScope]);

  const persist = async () => {
    try {
      setSaving(true);
      setMessage('');
      setMessageTone('info');
      const response = await api.admin.updateAutomationSettings(settings || {});
      if (response.success) {
        setSettings(response.data || settings);
        setMessageTone('success');
        setMessage('Automation system settings saved.');
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to save automation system settings.');
    } finally {
      setSaving(false);
    }
  };

  const setAutomationSystems = (patch: Record<string, any>) => {
    setSettings((prev: any) => ({
      ...(prev || {}),
      automationSystems: {
        legacyEngineEnabled: true,
        fieldPipelineEngineEnabled: false,
        activeEngine: 'LEGACY',
        fallbackToLegacy: true,
        ...(prev?.automationSystems || {}),
        ...patch,
      },
    }));
  };

  const updateCriterion = (criterionKey: string, patch: Record<string, any>) => {
    setSettings((prev: any) => ({
      ...(prev || {}),
      criteria: {
        ...(prev?.criteria || {}),
        [activeScope]: (prev?.criteria?.[activeScope] || []).map((row: any) =>
          String(row?.key || '') === criterionKey ? { ...row, ...patch } : row
        ),
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex h-80 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-amber-600" />
      </div>
    );
  }

  const systems = settings?.automationSystems || {
    legacyEngineEnabled: true,
    fieldPipelineEngineEnabled: false,
    activeEngine: 'LEGACY',
    fallbackToLegacy: true,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Automation System Switchboard</h1>
        <p className="text-sm text-gray-600">
          Run legacy automation, field-level pipeline automation, or switch between both engines without disabling your existing setup.
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
        <h2 className="text-sm font-semibold text-gray-900">Engine Controls</h2>
        <p className="mt-1 text-xs text-gray-500">
          Choose which automation system runs product/account checks. Field Pipeline enables per-field verifier/fixer AI chaining.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(systems.legacyEngineEnabled)}
              onChange={(event) => setAutomationSystems({ legacyEngineEnabled: event.target.checked })}
            />
            Enable Legacy Automation Engine
          </label>
          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(systems.fieldPipelineEngineEnabled)}
              onChange={(event) => setAutomationSystems({ fieldPipelineEngineEnabled: event.target.checked })}
            />
            Enable Field Pipeline Engine
          </label>
          <label className="rounded border px-3 py-2 text-sm text-gray-700">
            <span className="mb-1 block text-xs text-gray-500">Active engine</span>
            <select
              className="w-full rounded border px-2 py-1"
              value={String(systems.activeEngine || 'LEGACY')}
              onChange={(event) =>
                setAutomationSystems({
                  activeEngine: event.target.value === 'FIELD_PIPELINE' ? 'FIELD_PIPELINE' : 'LEGACY',
                })
              }
            >
              <option value="LEGACY">Legacy Engine</option>
              <option value="FIELD_PIPELINE">Field Pipeline Engine</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(systems.fallbackToLegacy)}
              onChange={(event) => setAutomationSystems({ fallbackToLegacy: event.target.checked })}
            />
            Fallback to legacy when active engine is unavailable
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.enabled)}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), enabled: event.target.checked }))}
            />
            Enable overall automation
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.autoRunOnProductSubmit)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), autoRunOnProductSubmit: event.target.checked }))
              }
            />
            Auto-run on product submit
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.autoApproveOnPass)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), autoApproveOnPass: event.target.checked }))
              }
            />
            Auto-approve when checks pass
          </label>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Field-level AI Pipeline Mapping</h2>
        <p className="mt-1 text-xs text-gray-500">
          For each criterion/field, choose one AI for verification and another AI for fixing. Verifier output can be passed into the fixer stage.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['FABRIC', 'READY_TO_WEAR', 'DESIGN', 'ACCOUNT_APPROVAL'] as CriteriaScope[]).map((scope) => (
            <button
              key={scope}
              type="button"
              onClick={() => setActiveScope(scope)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeScope === scope ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {scope === 'FABRIC' ? 'FTB' : scope === 'READY_TO_WEAR' ? 'RTW' : scope === 'DESIGN' ? 'CTW' : 'Account'}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1600px] text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2">Criterion</th>
                <th className="px-3 py-2">Enabled</th>
                <th className="px-3 py-2">Requires AI</th>
                <th className="px-3 py-2">Allow AI edits</th>
                <th className="px-3 py-2">Target field</th>
                <th className="px-3 py-2">Verifier function</th>
                <th className="px-3 py-2">Verifier provider</th>
                <th className="px-3 py-2">Fixer function</th>
                <th className="px-3 py-2">Fixer provider</th>
                <th className="px-3 py-2">Pass verifier to fixer</th>
              </tr>
            </thead>
            <tbody>
              {criteriaRows.map((row: any) => {
                const key = String(row?.key || '');
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{row?.label || key}</p>
                      <p className="font-mono text-[11px] text-gray-500">{key}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row?.enabled !== false}
                        onChange={(event) => updateCriterion(key, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row?.requiresAi === true}
                        onChange={(event) => updateCriterion(key, { requiresAi: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row?.allowAiEdits === true}
                        onChange={(event) => updateCriterion(key, { allowAiEdits: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.targetField || '')}
                        onChange={(event) => updateCriterion(key, { targetField: event.target.value })}
                      >
                        {FIELD_OPTIONS_BY_SCOPE[activeScope].map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.verifierFunctionKey || row?.aiFunctionKey || 'text_grammar_enhancement')}
                        onChange={(event) =>
                          updateCriterion(key, { verifierFunctionKey: event.target.value, aiFunctionKey: event.target.value })
                        }
                      >
                        {FUNCTION_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.verifierProviderId || row?.aiProviderId || '')}
                        onChange={(event) =>
                          updateCriterion(key, { verifierProviderId: event.target.value, aiProviderId: event.target.value })
                        }
                      >
                        <option value="">Use global function binding</option>
                        {providerOptions.map((provider) => (
                          <option key={provider.value} value={provider.value}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.fixerFunctionKey || '')}
                        onChange={(event) => updateCriterion(key, { fixerFunctionKey: event.target.value })}
                      >
                        <option value="">Auto-fixer by field type</option>
                        {FUNCTION_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.fixerProviderId || '')}
                        onChange={(event) => updateCriterion(key, { fixerProviderId: event.target.value })}
                      >
                        <option value="">Default to verifier provider</option>
                        {providerOptions.map((provider) => (
                          <option key={provider.value} value={provider.value}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row?.passResultToFixer !== false}
                        onChange={(event) => updateCriterion(key, { passResultToFixer: event.target.checked })}
                      />
                    </td>
                  </tr>
                );
              })}
              {criteriaRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={10}>
                    No criteria found for this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={() => void persist()} disabled={saving}>
          {saving ? 'Saving...' : 'Save Automation System'}
        </Button>
        <Button variant="outline" onClick={() => void load()} disabled={saving}>
          Reload
        </Button>
      </div>
    </div>
  );
}

