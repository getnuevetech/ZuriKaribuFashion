import { useEffect, useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { api } from '../../services/api';

type ProductType = 'FABRIC' | 'READY_TO_WEAR' | 'DESIGN';

export default function AdminAutomationApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [message, setMessage] = useState('');
  const [settings, setSettings] = useState<any>(null);
  const [evaluateForm, setEvaluateForm] = useState({
    productType: 'FABRIC' as ProductType,
    productId: '',
    applyDecision: false,
  });
  const [evaluationResult, setEvaluationResult] = useState<any>(null);

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
    const list = settings.criteria[evaluateForm.productType] || [];
    return Array.isArray(list) ? list : [];
  }, [settings, evaluateForm.productType]);

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
          {(['FABRIC', 'READY_TO_WEAR', 'DESIGN'] as ProductType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setEvaluateForm((prev) => ({ ...prev, productType: type }))}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                evaluateForm.productType === type ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
              }`}
            >
              {type === 'FABRIC' ? 'FTB' : type === 'READY_TO_WEAR' ? 'RTW' : 'CTW'}
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {criteriaRows.map((criterion: any) => (
            <label
              key={criterion.key}
              className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm text-gray-700"
            >
              <div>
                <p className="font-medium text-gray-900">{criterion.label || criterion.key}</p>
                <p className="text-xs text-gray-500">{criterion.requiresAi ? 'Requires AI provider' : 'Rule-based check'}</p>
              </div>
              <input
                type="checkbox"
                checked={criterion.enabled !== false}
                onChange={(event) => {
                  setSettings((prev: any) => ({
                    ...(prev || {}),
                    criteria: {
                      ...(prev?.criteria || {}),
                      [evaluateForm.productType]: (prev?.criteria?.[evaluateForm.productType] || []).map((row: any) =>
                        row.key === criterion.key ? { ...row, enabled: event.target.checked } : row
                      ),
                    },
                  }));
                }}
              />
            </label>
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
                <p className="mt-1 text-xs text-gray-600">{row.message}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
