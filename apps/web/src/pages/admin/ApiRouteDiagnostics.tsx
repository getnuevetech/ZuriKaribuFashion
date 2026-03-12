import { useMemo, useState } from 'react';
import Button from '../../components/ui/Button';
import { httpClient } from '../../services/api';

type ProbeMethod = 'GET' | 'POST';
type ProbeOutcome = 'AVAILABLE' | 'MISSING' | 'ERROR';

type ProbeDefinition = {
  label: string;
  method: ProbeMethod;
  path: string;
  payload?: Record<string, unknown>;
};

type ProbeResult = ProbeDefinition & {
  status: number | null;
  message: string;
  durationMs: number;
  outcome: ProbeOutcome;
};

const PROBE_DEFINITIONS: ProbeDefinition[] = [
  { label: 'Promo preview (canonical)', method: 'POST', path: '/promotions/preview', payload: {} },
  { label: 'Promo preview (promo alias)', method: 'POST', path: '/promo/preview', payload: {} },
  { label: 'Promo preview (promo-codes alias)', method: 'POST', path: '/promo-codes/preview', payload: {} },
  { label: 'Promo preview (check alias)', method: 'POST', path: '/promotions/check', payload: {} },
  { label: 'Promo preview (validate alias)', method: 'POST', path: '/promotions/validate', payload: {} },
  { label: 'Payment create-session (canonical)', method: 'POST', path: '/payments/create-session', payload: {} },
  { label: 'Payment create-session (underscore alias)', method: 'POST', path: '/payments/create_session', payload: {} },
  { label: 'Payment create-session (session/create alias)', method: 'POST', path: '/payments/session/create', payload: {} },
  { label: 'Payment create-session (payment alias)', method: 'POST', path: '/payment/create-session', payload: {} },
  { label: 'Stripe create-intent (canonical)', method: 'POST', path: '/payments/create-intent', payload: {} },
  { label: 'Stripe create-intent (intent/create alias)', method: 'POST', path: '/payments/intent/create', payload: {} },
  { label: 'Stripe create-intent (payment alias)', method: 'POST', path: '/payment/create-intent', payload: {} },
];

const parseResponseMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') return '';
  const row = payload as Record<string, unknown>;
  return String(row.message || row.error || row.details || '').trim();
};

const isRouteMissingResponse = (status: number, message: string) =>
  status === 404 && /route not found/i.test(String(message || ''));

const resolveHealthUrl = () => {
  const base = String(httpClient.defaults.baseURL || '').replace(/\/+$/, '');
  if (!base) return '/health';
  if (base.endsWith('/api')) {
    return `${base.slice(0, -4)}/health`;
  }
  return `${base}/health`;
};

async function runProbe(definition: ProbeDefinition): Promise<ProbeResult> {
  const startedAt = Date.now();
  try {
    const response = await httpClient.request({
      url: definition.path,
      method: definition.method.toLowerCase() as 'get' | 'post',
      data: definition.payload,
      validateStatus: () => true,
    });
    const status = Number(response.status || 0);
    const message = parseResponseMessage(response.data);
    const outcome: ProbeOutcome = isRouteMissingResponse(status, message) ? 'MISSING' : 'AVAILABLE';
    return {
      ...definition,
      status,
      message,
      outcome,
      durationMs: Date.now() - startedAt,
    };
  } catch (error: any) {
    return {
      ...definition,
      status: Number(error?.response?.status || 0) || null,
      message: String(error?.response?.data?.message || error?.message || 'Request failed'),
      outcome: 'ERROR',
      durationMs: Date.now() - startedAt,
    };
  }
}

export default function AdminApiRouteDiagnostics() {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<ProbeResult[]>([]);
  const [error, setError] = useState('');
  const [lastRunAt, setLastRunAt] = useState<string>('');
  const [healthPayload, setHealthPayload] = useState<any>(null);

  const summary = useMemo(() => {
    return results.reduce(
      (acc, row) => {
        if (row.outcome === 'AVAILABLE') acc.available += 1;
        if (row.outcome === 'MISSING') acc.missing += 1;
        if (row.outcome === 'ERROR') acc.errors += 1;
        return acc;
      },
      { available: 0, missing: 0, errors: 0, total: results.length }
    );
  }, [results]);

  const runDiagnostics = async () => {
    try {
      setRunning(true);
      setError('');
      const healthUrl = resolveHealthUrl();
      const [healthResult, routeResults] = await Promise.all([
        fetch(healthUrl, { method: 'GET', credentials: 'include' })
          .then(async (res) => ({ status: res.status, payload: await res.json().catch(() => null) }))
          .catch((err: any) => ({ status: 0, payload: { message: String(err?.message || 'Health check failed') } })),
        Promise.all(PROBE_DEFINITIONS.map((definition) => runProbe(definition))),
      ]);
      setHealthPayload(healthResult);
      setResults(routeResults);
      setLastRunAt(new Date().toISOString());
    } catch (err: any) {
      setError(String(err?.message || 'Failed to run diagnostics.'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Route Diagnostics</h1>
          <p className="text-sm text-gray-600">
            Live probe for checkout promo/payment route aliases on the currently deployed backend.
          </p>
        </div>
        <Button onClick={runDiagnostics} disabled={running}>
          {running ? 'Running checks...' : 'Run diagnostics'}
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-500">Available</p>
          <p className="text-xl font-semibold text-green-700">{summary.available}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-500">Missing</p>
          <p className="text-xl font-semibold text-amber-700">{summary.missing}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-500">Errors</p>
          <p className="text-xl font-semibold text-red-700">{summary.errors}</p>
        </div>
        <div className="rounded-lg border bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-500">Last run</p>
          <p className="text-sm font-medium text-gray-900">
            {lastRunAt ? new Date(lastRunAt).toLocaleString() : 'Not yet'}
          </p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Backend health</h2>
        <p className="mt-1 text-xs text-gray-600">Use this to confirm the deployed commit/branch for Railway.</p>
        <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-gray-50 p-3 text-xs text-gray-800">
{JSON.stringify(healthPayload || { status: null, payload: null }, null, 2)}
        </pre>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Probe</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Path</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Outcome</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Duration</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-500">
                  No diagnostics yet. Click <span className="font-medium">Run diagnostics</span>.
                </td>
              </tr>
            ) : (
              results.map((row) => (
                <tr key={`${row.method}-${row.path}`}>
                  <td className="px-4 py-3 text-gray-900">{row.label}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">{row.path}</td>
                  <td className="px-4 py-3 text-gray-900">{row.status ?? 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                        row.outcome === 'AVAILABLE'
                          ? 'bg-green-100 text-green-800'
                          : row.outcome === 'MISSING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {row.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.durationMs}ms</td>
                  <td className="px-4 py-3 text-gray-700">{row.message || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
