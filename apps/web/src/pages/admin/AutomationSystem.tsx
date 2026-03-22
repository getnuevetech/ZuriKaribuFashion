import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { api } from '../../services/api';

type ProductType = 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN';
type CriteriaScope = ProductType | 'ACCOUNT_APPROVAL';

const SYSTEM_FUNCTION_OPTIONS = [
  { key: 'text_grammar_enhancement', label: 'Text/Grammatical Correction' },
  { key: 'image_verification', label: 'Image Verification' },
  { key: 'image_regeneration', label: 'Image Regeneration' },
  { key: 'document_ocr_analysis', label: 'Document OCR/Analysis' },
] as const;

const FUNCTION_LABEL_BY_KEY = SYSTEM_FUNCTION_OPTIONS.reduce<Record<string, string>>((acc, entry) => {
  acc[entry.key] = entry.label;
  return acc;
}, {});

const DEFAULT_AI_FUNCTION_BY_CRITERION: Record<string, string> = {
  name_grammar: 'text_grammar_enhancement',
  description_grammar: 'text_grammar_enhancement',
  material_match: 'image_verification',
  style_match: 'image_verification',
  predominant_color_match: 'image_verification',
  image_quality: 'image_verification',
};

const resolveDefaultAiFunctionKey = (criterionKey: string) =>
  DEFAULT_AI_FUNCTION_BY_CRITERION[String(criterionKey || '').trim().toLowerCase()] || 'text_grammar_enhancement';

const friendlyAutomationStatus = (status: string) => {
  const token = String(status || '').trim().toUpperCase();
  if (token === 'PASS') return 'Passed';
  if (token === 'FAIL') return 'Needs correction';
  if (token === 'NEEDS_AI') return 'Needs manual review';
  if (token === 'SKIPPED') return 'Skipped';
  return token || 'Unknown';
};

const friendlyAutomationAction = (action: string) => {
  const token = String(action || '').trim().toUpperCase();
  if (token === 'AUTO_APPROVED') return 'Automatically approved';
  if (token === 'AUTO_REJECTED') return 'Automatically rejected';
  if (token === 'ERROR') return 'Automation error';
  if (token === 'NONE') return 'No automatic decision';
  return action || 'No automatic decision';
};

const friendlyEditStatus = (status: string) => {
  const token = String(status || '').trim().toUpperCase();
  if (token === 'APPLIED') return 'Applied successfully';
  if (token === 'SKIPPED') return 'Skipped (no change)';
  return token || 'Unknown';
};

const toReadableAutomationMessage = (value: string) =>
  String(value || '')
    .replace(/\bAI verification:\s*/gi, 'Review note: ')
    .replace(/\bAI guidance:\s*/gi, 'Recommended update: ')
    .replace(/\bAI execution error:\s*/gi, 'Processing error: ')
    .replace(/\bAI\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

const toProviderOptions = (settings: any) =>
  (Array.isArray(settings?.aiProviders) ? settings.aiProviders : [])
    .filter((entry: any) => String(entry?.id || '').trim().length > 0)
    .map((entry: any) => ({
      value: String(entry.id),
      label: `${String(entry.name || entry.id)}${entry.isActive === false ? ' (inactive)' : ''}`,
    }));

const formatFieldOptionLabel = (entry: { key?: string; label?: string; dataType?: string; source?: 'CORE' | 'DYNAMIC' }) => {
  const key = String(entry.key || '').trim().toLowerCase();
  let label = String(entry.label || entry.key || '').trim();
  if (key === 'images[*]') {
    label = 'All Product Images (recommended for complete image verification)';
  }
  if (key === 'images[0]') {
    label = 'Primary Product Image (first uploaded image)';
  }
  const sourceTag = entry.source === 'DYNAMIC' ? ' • dynamic' : '';
  const typeTag = entry.dataType ? ` (${String(entry.dataType)})` : '';
  return `${label}${sourceTag}${typeTag}`;
};

export default function AdminAutomationSystemPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error' | 'info'>('info');
  const [activeScope, setActiveScope] = useState<CriteriaScope>('FABRIC');
  const [settings, setSettings] = useState<any>(null);
  const [evaluationResult, setEvaluationResult] = useState<any>(null);
  const [fieldCatalog, setFieldCatalog] = useState<
    Record<CriteriaScope, Array<{ key: string; label: string; dataType?: string; source?: 'CORE' | 'DYNAMIC' }>>
  >({
    FABRIC: [],
    READY_TO_WEAR: [],
    DESIGN: [],
    ACCOUNT_APPROVAL: [],
  });
  const [evaluateForm, setEvaluateForm] = useState({
    productType: 'FABRIC' as ProductType,
    productId: '',
    applyDecision: false,
  });
  const [accountEvaluateForm, setAccountEvaluateForm] = useState({
    userId: '',
    role: '',
  });
  const [newCriterion, setNewCriterion] = useState({
    key: '',
    label: '',
    requiresAi: false,
    allowAiEdits: false,
    aiProviderId: '',
    targetField: '',
    verifierFunctionKey: '',
    fixerFunctionKey: '',
  });

  const load = async () => {
    try {
      setLoading(true);
      setMessage('');
      const [response, catalogResponse] = await Promise.all([
        api.admin.getAutomationSettings(),
        api.admin.getAutomationFieldCatalog(),
      ]);
      if (response.success) {
        setSettings(response.data || null);
      }
      if (catalogResponse.success) {
        setFieldCatalog(catalogResponse.data || {});
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
  const functionOptions = useMemo(() => {
    const rows = Array.isArray(settings?.functionCatalog) ? settings.functionCatalog : [];
    const dedupe = new Map<string, { key: string; label: string }>();
    for (const row of rows) {
      const key = String(row?.key || '').trim().toLowerCase();
      if (!key) continue;
      dedupe.set(key, { key, label: String(row?.label || key).trim() || key });
    }
    if (dedupe.size < 1) {
      for (const entry of SYSTEM_FUNCTION_OPTIONS) {
        dedupe.set(entry.key, { key: entry.key, label: entry.label });
      }
    }
    return Array.from(dedupe.values());
  }, [settings]);

  const criteriaRows = useMemo(() => {
    const rows = settings?.criteria?.[activeScope];
    return Array.isArray(rows) ? rows : [];
  }, [settings, activeScope]);

  const fieldOptionsForScope = useMemo(() => {
    const rows = Array.isArray(fieldCatalog?.[activeScope]) ? fieldCatalog[activeScope] : [];
    return [
      { value: '', label: 'Auto (by criterion)' },
      ...rows.map((entry) => ({
        value: String(entry.key || ''),
        label: formatFieldOptionLabel(entry),
      })),
    ];
  }, [activeScope, fieldCatalog]);

  const providerNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const provider of providerOptions) {
      const id = String(provider.value || '').trim();
      if (!id) continue;
      map.set(id, String(provider.label || id).replace(/\s+\(inactive\)\s*$/, '').trim());
    }
    return map;
  }, [providerOptions]);

  const globalProviderByFunctionKey = useMemo(() => {
    const map = new Map<string, string>();
    const rows = Array.isArray(settings?.functionBindings) ? settings.functionBindings : [];
    for (const row of rows) {
      const functionKey = String(row?.functionKey || '').trim().toLowerCase();
      const providerId = String(row?.providerId || '').trim();
      if (!functionKey || !providerId) continue;
      map.set(functionKey, providerNameById.get(providerId) || providerId);
    }
    return map;
  }, [settings, providerNameById]);

  const aiEditStatusByKey = useMemo(() => {
    const map = new Map<string, { attempted: number; applied: number; skipped: number }>();
    const rows = Array.isArray(evaluationResult?.changeReport) ? evaluationResult.changeReport : [];
    for (const entry of rows) {
      const key = String(entry?.key || '').trim();
      if (!key) continue;
      const status = String(entry?.status || '').toUpperCase();
      const current = map.get(key) || { attempted: 0, applied: 0, skipped: 0 };
      current.attempted += 1;
      if (status === 'APPLIED') current.applied += 1;
      else current.skipped += 1;
      map.set(key, current);
    }
    return map;
  }, [evaluationResult]);

  const aiEditFieldsByKey = useMemo(() => {
    const map = new Map<string, string[]>();
    const rows = Array.isArray(evaluationResult?.changeReport) ? evaluationResult.changeReport : [];
    for (const entry of rows) {
      const key = String(entry?.key || '').trim();
      const field = String(entry?.field || '').trim();
      if (!key || !field) continue;
      const current = map.get(key) || [];
      if (!current.includes(field)) current.push(field);
      map.set(key, current);
    }
    return map;
  }, [evaluationResult]);

  const fallbackFieldByCriterionKey = useMemo(
    () =>
      ({
        name_grammar: ['name'],
        description_grammar: ['description'],
        image_quality: ['images[*]'],
        predominant_color_match: ['images[*]'],
        material_match: ['images[*]'],
        price_outlier: ['finalPrice/basePrice'],
        currency_sanity: ['finalPrice/basePrice'],
        minimum_yards: ['minYards'],
        stock_vs_minimum: ['stockYards'],
      }) as Record<string, string[]>,
    []
  );

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

  const removeCriterion = (criterionKey: string) => {
    setSettings((prev: any) => ({
      ...(prev || {}),
      criteria: {
        ...(prev?.criteria || {}),
        [activeScope]: (prev?.criteria?.[activeScope] || []).filter(
          (row: any) => String(row?.key || '') !== criterionKey
        ),
      },
    }));
    setMessageTone('info');
    setMessage(`Removed criterion "${criterionKey}" from ${activeScope}. Save to persist.`);
  };

  const addCriterion = () => {
    const key = String(newCriterion.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const label = String(newCriterion.label || '').trim();
    if (!key || !label) {
      setMessageTone('error');
      setMessage('Criterion key and label are required.');
      return;
    }
    const scopeRows = Array.isArray(settings?.criteria?.[activeScope]) ? settings.criteria[activeScope] : [];
    if (scopeRows.some((entry: any) => String(entry?.key || '') === key)) {
      setMessageTone('error');
      setMessage('Criterion key already exists for this scope.');
      return;
    }
    const verifierFunctionKey = String(newCriterion.verifierFunctionKey || '').trim() || resolveDefaultAiFunctionKey(key);
    const fixerFunctionKey = String(newCriterion.fixerFunctionKey || '').trim();
    const aiProviderId = String(newCriterion.aiProviderId || '').trim();
    const targetField = String(newCriterion.targetField || '').trim();
    setSettings((prev: any) => ({
      ...(prev || {}),
      criteria: {
        ...(prev?.criteria || {}),
        [activeScope]: [
          ...(Array.isArray(prev?.criteria?.[activeScope]) ? prev.criteria[activeScope] : []),
          {
            key,
            label,
            enabled: true,
            requiresAi: Boolean(newCriterion.requiresAi),
            allowAiEdits: Boolean(newCriterion.allowAiEdits),
            aiFunctionKey: verifierFunctionKey,
            aiProviderId: Boolean(newCriterion.requiresAi) ? aiProviderId : '',
            verifierFunctionKey,
            verifierProviderId: Boolean(newCriterion.requiresAi) ? aiProviderId : '',
            fixerFunctionKey,
            fixerProviderId: '',
            passResultToFixer: true,
            targetField,
          },
        ],
      },
    }));
    setNewCriterion({
      key: '',
      label: '',
      requiresAi: false,
      allowAiEdits: false,
      aiProviderId: '',
      targetField: '',
      verifierFunctionKey: '',
      fixerFunctionKey: '',
    });
    setMessageTone('info');
    setMessage(`Added criterion "${key}" for ${activeScope}. Save to persist.`);
  };

  const syncFieldCatalog = async () => {
    try {
      setSaving(true);
      setMessage('');
      setMessageTone('info');
      const response = await api.admin.syncAutomationFieldCatalog();
      if (response.success) {
        if (response.settings) {
          setSettings(response.settings);
        }
        setFieldCatalog(response.data || fieldCatalog);
        setMessageTone('success');
        setMessage(response.message || 'Field catalog synced successfully.');
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to sync field catalog.');
    } finally {
      setSaving(false);
    }
  };

  const runEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    if (!evaluateForm.productId.trim()) {
      setMessageTone('error');
      setMessage('Product ID is required.');
      return;
    }
    try {
      setEvaluating(true);
      setMessage('');
      const response = await api.admin.evaluateAutomationProduct({
        productType: evaluateForm.productType,
        productId: evaluateForm.productId.trim(),
        applyDecision: evaluateForm.applyDecision,
      });
      if (response.success) {
        setEvaluationResult(response.data || null);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to evaluate product.');
    } finally {
      setEvaluating(false);
    }
  };

  const runAccountEvaluation = async (event: FormEvent) => {
    event.preventDefault();
    if (!accountEvaluateForm.userId.trim()) {
      setMessageTone('error');
      setMessage('Account user ID is required.');
      return;
    }
    try {
      setEvaluating(true);
      setMessage('');
      const response = await api.admin.evaluateAutomationAccount({
        userId: accountEvaluateForm.userId.trim(),
        role: accountEvaluateForm.role.trim() || undefined,
      });
      if (response.success) {
        setEvaluationResult(response.data || null);
      }
    } catch (error: any) {
      setMessageTone('error');
      setMessage(error?.response?.data?.message || error?.message || 'Failed to evaluate account.');
    } finally {
      setEvaluating(false);
    }
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
          Centralized control center for engine selection, field-level criteria mapping, and manual product/account checks.
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
          Choose which automation engine runs and define global behavior for approvals, retries, and visibility.
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
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.failOnNeedsAi)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), failOnNeedsAi: event.target.checked }))
              }
            />
            Treat missing AI provider as failure
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-800">AI Approval Tag Visibility</p>
          <p className="mt-1 text-xs text-gray-600">
            Admins always see the "AI Approved" tag. Use these toggles to allow other groups to see it.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            {[
              { key: 'seller', label: 'Sellers' },
              { key: 'designer', label: 'Designers' },
              { key: 'customer', label: 'Customers' },
              { key: 'reseller', label: 'Resellers' },
              { key: 'qa', label: 'QA Team' },
            ].map((entry) => (
              <label key={entry.key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings?.aiApprovalTagVisibility?.[entry.key])}
                  onChange={(event) =>
                    setSettings((prev: any) => ({
                      ...(prev || {}),
                      aiApprovalTagVisibility: {
                        ...(prev?.aiApprovalTagVisibility || {}),
                        [entry.key]: event.target.checked,
                      },
                    }))
                  }
                />
                Show to {entry.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Field-level AI Pipeline Mapping</h2>
        <p className="mt-1 text-xs text-gray-500">
          Add, remove, and configure criteria rows per scope. Sync to include newly created dynamic fields.
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
          <Button variant="outline" onClick={() => void syncFieldCatalog()} disabled={saving}>
            {saving ? 'Syncing...' : 'Sync fields'}
          </Button>
        </div>

        <div className="mt-3 grid gap-2 rounded border p-3 md:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto_auto_auto]">
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="criterion_key"
            value={newCriterion.key}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, key: event.target.value }))}
          />
          <input
            className="rounded border px-3 py-2 text-sm"
            placeholder="Criterion label"
            value={newCriterion.label}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, label: event.target.value }))}
          />
          <select
            className="rounded border px-3 py-2 text-xs"
            value={newCriterion.targetField}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, targetField: event.target.value }))}
          >
            {fieldOptionsForScope.map((option) => (
              <option key={`new-field-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-xs"
            value={newCriterion.verifierFunctionKey}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, verifierFunctionKey: event.target.value }))}
          >
            <option value="">Verifier function (auto by criterion key)</option>
            {functionOptions.map((option) => (
              <option key={`new-verifier-${option.key}`} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="rounded border px-3 py-2 text-xs"
            value={newCriterion.fixerFunctionKey}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, fixerFunctionKey: event.target.value }))}
          >
            <option value="">Fixer function (auto by field type)</option>
            {functionOptions.map((option) => (
              <option key={`new-fixer-${option.key}`} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={newCriterion.requiresAi}
              onChange={(event) => setNewCriterion((prev) => ({ ...prev, requiresAi: event.target.checked }))}
            />
            Requires AI
          </label>
          <label className="inline-flex items-center gap-2 rounded border px-3 py-2 text-xs">
            <input
              type="checkbox"
              checked={newCriterion.allowAiEdits}
              onChange={(event) => setNewCriterion((prev) => ({ ...prev, allowAiEdits: event.target.checked }))}
            />
            Allow AI edits
          </label>
          <select
            className="rounded border px-3 py-2 text-xs"
            value={newCriterion.aiProviderId}
            disabled={!newCriterion.requiresAi}
            onChange={(event) => setNewCriterion((prev) => ({ ...prev, aiProviderId: event.target.value }))}
          >
            <option value="">AI provider (optional override)</option>
            {providerOptions.map((provider) => (
              <option key={`new-provider-${provider.value}`} value={provider.value}>
                {provider.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2">
          <Button variant="outline" onClick={addCriterion}>
            Add Criterion
          </Button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[1750px] text-sm">
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
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {criteriaRows.map((row: any) => {
                const key = String(row?.key || '');
                const effectiveFunctionKey = String(row?.verifierFunctionKey || row?.aiFunctionKey || '')
                  .trim()
                  .toLowerCase();
                const effectiveProviderName = String(row?.verifierProviderId || row?.aiProviderId || '').trim()
                  ? providerNameById.get(String(row?.verifierProviderId || row?.aiProviderId || '').trim()) ||
                    String(row?.verifierProviderId || row?.aiProviderId || '').trim()
                  : globalProviderByFunctionKey.get(effectiveFunctionKey) || 'Global default not set';
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
                        onChange={(event) =>
                          updateCriterion(key, {
                            requiresAi: event.target.checked,
                            allowAiEdits: event.target.checked ? row?.allowAiEdits === true : false,
                            aiProviderId: event.target.checked ? String(row?.aiProviderId || '') : '',
                            verifierProviderId: event.target.checked ? String(row?.verifierProviderId || '') : '',
                          })
                        }
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={row?.allowAiEdits === true}
                        disabled={row?.requiresAi !== true}
                        onChange={(event) => updateCriterion(key, { allowAiEdits: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.targetField || '')}
                        onChange={(event) => updateCriterion(key, { targetField: event.target.value })}
                      >
                        {fieldOptionsForScope.map((option) => (
                          <option key={`field-${key}-${option.value}`} value={option.value}>
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
                        {functionOptions.map((option) => (
                          <option key={`verifier-${key}-${option.key}`} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-[11px] text-gray-500">
                        Active provider: <span className="font-medium">{effectiveProviderName}</span>{' '}
                        {effectiveFunctionKey ? (
                          <span className="text-gray-400">({FUNCTION_LABEL_BY_KEY[effectiveFunctionKey] || effectiveFunctionKey})</span>
                        ) : null}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded border px-2 py-1"
                        value={String(row?.verifierProviderId || row?.aiProviderId || '')}
                        disabled={row?.requiresAi !== true}
                        onChange={(event) =>
                          updateCriterion(key, { verifierProviderId: event.target.value, aiProviderId: event.target.value })
                        }
                      >
                        <option value="">Use global function binding</option>
                        {providerOptions.map((provider) => (
                          <option key={`provider-${key}-${provider.value}`} value={provider.value}>
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
                        {functionOptions.map((option) => (
                          <option key={`fixer-${key}-${option.key}`} value={option.key}>
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
                          <option key={`fixer-provider-${key}-${provider.value}`} value={provider.value}>
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
                    <td className="px-3 py-2">
                      <Button variant="outline" onClick={() => removeCriterion(key)} className="text-red-600">
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {criteriaRows.length === 0 ? (
                <tr>
                  <td className="px-3 py-4 text-center text-gray-500" colSpan={11}>
                    No criteria found for this scope.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Manual Approval Checks</h2>
        <p className="mt-1 text-xs text-gray-500">
          Run immediate checks for a single product or account from this switchboard.
        </p>
        <form onSubmit={runEvaluation} className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded border px-3 py-2"
              value={evaluateForm.productType}
              onChange={(event) => setEvaluateForm((prev) => ({ ...prev, productType: event.target.value as ProductType }))}
            >
              <option value="FABRIC">FTB (Fabric)</option>
              <option value="READY_TO_WEAR">RTW (Ready To Wear)</option>
              <option value="DESIGN">CTW (Custom To Wear)</option>
            </select>
            <input
              className="rounded border px-3 py-2 md:col-span-2"
              placeholder="Product UUID"
              value={evaluateForm.productId}
              onChange={(event) => setEvaluateForm((prev) => ({ ...prev, productId: event.target.value }))}
            />
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={evaluateForm.applyDecision}
              onChange={(event) => setEvaluateForm((prev) => ({ ...prev, applyDecision: event.target.checked }))}
            />
            Apply decision automatically (approve if pass, reject if fail)
          </label>
          <div>
            <Button type="submit" disabled={evaluating}>
              {evaluating ? 'Evaluating...' : 'Run Product Approval Check'}
            </Button>
          </div>
        </form>

        <form onSubmit={runAccountEvaluation} className="mt-4 space-y-3 border-t pt-4">
          <h3 className="text-sm font-semibold text-gray-900">Run Account Approval Check</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="rounded border px-3 py-2 md:col-span-2"
              placeholder="User UUID"
              value={accountEvaluateForm.userId}
              onChange={(event) => setAccountEvaluateForm((prev) => ({ ...prev, userId: event.target.value }))}
            />
            <select
              className="rounded border px-3 py-2"
              value={accountEvaluateForm.role}
              onChange={(event) => setAccountEvaluateForm((prev) => ({ ...prev, role: event.target.value }))}
            >
              <option value="">Role auto-detect</option>
              <option value="CUSTOMER">Customer</option>
              <option value="FABRIC_SELLER">Seller</option>
              <option value="FASHION_DESIGNER">Designer</option>
              <option value="RESELLER_INFLUENCER">Reseller</option>
            </select>
          </div>
          <Button type="submit" disabled={evaluating}>
            {evaluating ? 'Evaluating...' : 'Run Account Approval Check'}
          </Button>
        </form>
      </div>

      {evaluationResult ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Evaluation Report</h2>
            <Badge variant={evaluationResult.canAutoApprove ? 'green' : 'yellow'}>
              {evaluationResult.canAutoApprove ? 'Ready for auto-approval' : 'Review required'}
            </Badge>
            {evaluationResult.action && evaluationResult.action !== 'NONE' ? (
              <Badge variant={evaluationResult.action === 'AUTO_APPROVED' ? 'green' : 'red'}>
                {friendlyAutomationAction(evaluationResult.action)}
              </Badge>
            ) : null}
          </div>
          <div className="mt-3 space-y-2">
            {(evaluationResult.report || []).map((row: any, index: number) => (
              <div key={`${row.key}-${index}`} className="rounded border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-gray-900">{row.label || row.key}</p>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const editStatus = aiEditStatusByKey.get(String(row.key || '').trim());
                      if (!editStatus || editStatus.attempted < 1) return null;
                      if (editStatus.applied > 0 && editStatus.skipped < 1) return <Badge variant="blue">AI EDIT APPLIED</Badge>;
                      if (editStatus.applied > 0 && editStatus.skipped > 0) return <Badge variant="yellow">AI EDIT PARTIAL</Badge>;
                      return <Badge variant="yellow">AI EDIT SKIPPED</Badge>;
                    })()}
                    <Badge
                      variant={
                        row.status === 'PASS'
                          ? 'green'
                          : row.status === 'FAIL'
                            ? 'red'
                            : row.status === 'NEEDS_AI'
                              ? 'yellow'
                              : 'gray'
                      }
                    >
                      {friendlyAutomationStatus(String(row.status || ''))}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-600">{toReadableAutomationMessage(String(row.message || ''))}</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Edit source field used:{' '}
                  {(aiEditFieldsByKey.get(String(row.key || '').trim()) ||
                    fallbackFieldByCriterionKey[String(row.key || '').trim()] ||
                    ['not-mapped'])
                    .join(', ')}
                </p>
              </div>
            ))}
          </div>

          {Array.isArray(evaluationResult.changeReport) && evaluationResult.changeReport.length > 0 ? (
            <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-amber-900">
                AI Applied Changes (Comparison Report)
              </h3>
              <div className="mt-2 space-y-2">
                {evaluationResult.changeReport.map((entry: any, index: number) => (
                  <div key={`${entry.key}-${entry.field}-${index}`} className="rounded border bg-white px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-900">
                        {entry.label || entry.key} • Field: {entry.field}
                      </p>
                      <Badge variant={String(entry.status || '').toUpperCase() === 'APPLIED' ? 'green' : 'yellow'}>
                        {friendlyEditStatus(String(entry.status || ''))}
                      </Badge>
                    </div>
                    <p className="mt-1 text-gray-600">
                      <span className="font-medium text-gray-800">Before:</span> {String(entry.beforeValue || '-')}
                    </p>
                    <p className="mt-1 text-gray-600">
                      <span className="font-medium text-gray-800">After:</span> {String(entry.afterValue || '-')}
                    </p>
                    {entry.reason ? (
                      <p className="mt-1 text-gray-500">
                        <span className="font-medium text-gray-700">Reason:</span>{' '}
                        {toReadableAutomationMessage(String(entry.reason || ''))}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

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

