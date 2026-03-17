import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

type ProductType = 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN';
type CriteriaScope = ProductType | 'ACCOUNT_APPROVAL';

export default function AdminAutomationApprovalsPage() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [activeCriteriaScope, setActiveCriteriaScope] = useState<CriteriaScope>('FABRIC');
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
  });
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

  useEffect(() => {
    const tab = String(searchParams.get('tab') || '').toLowerCase();
    if (tab === 'account') setActiveCriteriaScope('ACCOUNT_APPROVAL');
  }, [searchParams]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await api.admin.getAutomationSettings();
      if (response.success) {
        setSettings(response.data || null);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to load automation settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
  }, []);

  const criteriaRows = useMemo(() => {
    if (!settings?.criteria) return [];
    const list = settings.criteria[activeCriteriaScope] || [];
    return Array.isArray(list) ? list : [];
  }, [settings, activeCriteriaScope]);

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
        image_quality: ['images[0]'],
        predominant_color_match: ['images[0]'],
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
      const response = await api.admin.updateAutomationSettings(settings);
      if (response.success) {
        setSettings(response.data || settings);
        setMessage('Automation settings saved.');
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.message || error?.message || 'Failed to save automation settings.');
    } finally {
      setSaving(false);
    }
  };

  const runEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!evaluateForm.productId.trim()) {
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
      setMessage(error?.response?.data?.message || error?.message || 'Failed to evaluate product.');
    } finally {
      setEvaluating(false);
    }
  };

  const runAccountEvaluation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!accountEvaluateForm.userId.trim()) {
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
      setMessage(error?.response?.data?.message || error?.message || 'Failed to evaluate account.');
    } finally {
      setEvaluating(false);
    }
  };

  const addCriterion = () => {
    const key = String(newCriterion.key || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_');
    const label = String(newCriterion.label || '').trim();
    if (!key || !label) {
      setMessage('Criterion key and label are required.');
      return;
    }
    setSettings((prev: any) => {
      const scopeRows = Array.isArray(prev?.criteria?.[activeCriteriaScope]) ? prev.criteria[activeCriteriaScope] : [];
      if (scopeRows.some((entry: any) => String(entry?.key || '') === key)) {
        setMessage('Criterion key already exists for this scope.');
        return prev;
      }
      return {
        ...(prev || {}),
        criteria: {
          ...(prev?.criteria || {}),
          [activeCriteriaScope]: [
            ...scopeRows,
            {
              key,
              label,
              enabled: true,
              requiresAi: Boolean(newCriterion.requiresAi),
              allowAiEdits: Boolean(newCriterion.allowAiEdits),
            },
          ],
        },
      };
    });
    setNewCriterion({ key: '', label: '', requiresAi: false, allowAiEdits: false });
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
        <h1 className="text-2xl font-bold text-gray-900">Automated Product Approval</h1>
        <p className="text-sm text-gray-600">
          Configure AI-powered approval checks for FTB (Fabric), RTW, and CTW (Design) product submissions.
        </p>
      </div>

      {message ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">{message}</div>
      ) : null}

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Automation Controls</h2>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.enabled)}
              onChange={(event) => setSettings((prev: any) => ({ ...(prev || {}), enabled: event.target.checked }))}
            />
            Enable automation engine
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.autoRunOnProductSubmit)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), autoRunOnProductSubmit: event.target.checked }))
              }
            />
            Auto-run checks on product submit
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(settings?.autoApproveOnPass)}
              onChange={(event) =>
                setSettings((prev: any) => ({ ...(prev || {}), autoApproveOnPass: event.target.checked }))
              }
            />
            Auto-approve when all checks pass
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
          <Button onClick={() => void persist()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Controls'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Criteria Configuration</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['FABRIC', 'READY_TO_WEAR', 'DESIGN', 'ACCOUNT_APPROVAL'] as CriteriaScope[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveCriteriaScope(type)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                activeCriteriaScope === type ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {type === 'FABRIC'
                ? 'FTB'
                : type === 'READY_TO_WEAR'
                  ? 'RTW'
                  : type === 'DESIGN'
                    ? 'CTW'
                    : 'Account Approval'}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2 rounded border p-3 md:grid-cols-[1fr_2fr_auto_auto_auto]">
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
          <Button variant="outline" onClick={addCriterion}>
            Add Criterion
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {criteriaRows.map((criterion: any) => (
            <div
              key={criterion.key}
              className="rounded border px-3 py-2 text-sm text-gray-700"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{criterion.label || criterion.key}</p>
                  <p className="font-mono text-[11px] text-gray-500">{criterion.key}</p>
                  <p className="text-xs text-gray-500">{criterion.requiresAi ? 'Requires AI provider' : 'Rule-based check'}</p>
                </div>
                <div className="grid gap-2 text-xs md:grid-cols-3">
                  <label className="inline-flex items-center gap-2 rounded border px-2 py-1">
                    <input
                      type="checkbox"
                      checked={criterion.enabled !== false}
                      onChange={(event) => {
                        setSettings((prev: any) => ({
                          ...(prev || {}),
                          criteria: {
                            ...(prev?.criteria || {}),
                            [activeCriteriaScope]: (prev?.criteria?.[activeCriteriaScope] || []).map((row: any) =>
                              row.key === criterion.key ? { ...row, enabled: event.target.checked } : row
                            ),
                          },
                        }));
                      }}
                    />
                    Enabled
                  </label>
                  <label className="inline-flex items-center gap-2 rounded border px-2 py-1">
                    <input
                      type="checkbox"
                      checked={criterion.requiresAi === true}
                      onChange={(event) => {
                        setSettings((prev: any) => ({
                          ...(prev || {}),
                          criteria: {
                            ...(prev?.criteria || {}),
                            [activeCriteriaScope]: (prev?.criteria?.[activeCriteriaScope] || []).map((row: any) =>
                              row.key === criterion.key
                                ? {
                                    ...row,
                                    requiresAi: event.target.checked,
                                    allowAiEdits: event.target.checked ? row.allowAiEdits === true : false,
                                  }
                                : row
                            ),
                          },
                        }));
                      }}
                    />
                    Requires AI
                  </label>
                  <label className="inline-flex items-center gap-2 rounded border px-2 py-1">
                    <input
                      type="checkbox"
                      checked={criterion.allowAiEdits === true}
                      disabled={criterion.requiresAi !== true}
                      onChange={(event) => {
                        setSettings((prev: any) => ({
                          ...(prev || {}),
                          criteria: {
                            ...(prev?.criteria || {}),
                            [activeCriteriaScope]: (prev?.criteria?.[activeCriteriaScope] || []).map((row: any) =>
                              row.key === criterion.key ? { ...row, allowAiEdits: event.target.checked } : row
                            ),
                          },
                        }));
                      }}
                    />
                    Allow AI edits
                  </label>
                </div>
              </div>
              {criterion.allowAiEdits === true ? (
                <p className="mt-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                  AI can directly update mapped product fields for this criterion and include before/after comparison.
                  For title/description/image criteria, strict mode is enforced: if AI cannot apply a real change, the
                  criterion remains failed.
                </p>
              ) : null}
            </div>
          ))}
          {criteriaRows.length === 0 ? <p className="text-sm text-gray-500">No criteria configured for this type.</p> : null}
        </div>
        <div className="mt-3">
          <Button onClick={() => void persist()} disabled={saving}>
            {saving ? 'Saving...' : 'Save Criteria'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900">Run Approval Check</h2>
        <form onSubmit={runEvaluation} className="mt-3 space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <select
              className="rounded border px-3 py-2"
              value={evaluateForm.productType}
              onChange={(event) =>
                setEvaluateForm((prev) => ({ ...prev, productType: event.target.value as ProductType }))
              }
            >
              <option value="FABRIC">FTB (Fabric)</option>
              <option value="READY_TO_WEAR">RTW (Ready To Wear)</option>
              <option value="DESIGN">CTW (Design)</option>
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
              {evaluating ? 'Evaluating...' : 'Run Evaluation'}
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
            {evaluating ? 'Evaluating...' : 'Run Account Evaluation'}
          </Button>
        </form>
      </div>

      {evaluationResult ? (
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Evaluation Report</h2>
            <Badge variant={evaluationResult.canAutoApprove ? 'green' : 'yellow'}>
              {evaluationResult.canAutoApprove ? 'PASS' : 'REVIEW REQUIRED'}
            </Badge>
            {evaluationResult.action && evaluationResult.action !== 'NONE' ? (
              <Badge variant={evaluationResult.action === 'AUTO_APPROVED' ? 'green' : 'red'}>
                {evaluationResult.action}
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
                      if (editStatus.applied > 0 && editStatus.skipped < 1) {
                        return <Badge variant="blue">AI EDIT APPLIED</Badge>;
                      }
                      if (editStatus.applied > 0 && editStatus.skipped > 0) {
                        return <Badge variant="yellow">AI EDIT PARTIAL</Badge>;
                      }
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
                      {row.status}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-600">{row.message}</p>
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
                        {String(entry.status || '').toUpperCase()}
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
                        <span className="font-medium text-gray-700">Reason:</span> {String(entry.reason)}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
