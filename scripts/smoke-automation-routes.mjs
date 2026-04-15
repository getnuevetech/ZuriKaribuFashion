#!/usr/bin/env node

const args = process.argv.slice(2);
const readArg = (name) => {
  const withEquals = args.find((entry) => entry.startsWith(`--${name}=`));
  if (withEquals) return withEquals.slice(name.length + 3);
  const index = args.findIndex((entry) => entry === `--${name}`);
  if (index >= 0) return args[index + 1];
  return undefined;
};

const baseUrlInput = readArg('base') || process.env.API_BASE_URL || 'http://localhost:3001/api';
const bearerToken = readArg('token') || process.env.API_SMOKE_TOKEN || '';
const timeoutMs = Number(readArg('timeout') || process.env.API_SMOKE_TIMEOUT_MS || 12000);
const baseUrl = String(baseUrlInput || '').trim().replace(/\/+$/, '');

if (!baseUrl) {
  console.error('Missing API base URL. Pass --base=https://your-api-domain/api');
  process.exit(1);
}

/**
 * @typedef {{
 *   label: string;
 *   method: 'GET' | 'POST' | 'PATCH';
 *   path: string;
 *   body?: Record<string, unknown>;
 *   semanticCheck?: (status: number, jsonBody: any) => { ok: boolean; message: string };
 * }} Probe
 */

/**
 * @typedef {{
 *   label: string;
 *   path: string;
 *   status: number | null;
 *   outcome: 'AVAILABLE'|'MISSING'|'ERROR'|'SEMANTIC_FAIL';
 *   message: string;
 *   durationMs: number;
 * }} ProbeResult
 */

const trimMessage = (value) => {
  const input = String(value || '').replace(/\s+/g, ' ').trim();
  if (!input) return '';
  return input.length > 220 ? `${input.slice(0, 217)}...` : input;
};

const parseMessage = (text) => {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.message === 'string') return trimMessage(parsed.message);
      if (Array.isArray(parsed.errors) && parsed.errors.length > 0) return trimMessage(JSON.stringify(parsed.errors[0]));
    }
  } catch {
    // Ignore parse errors and return raw text.
  }
  return trimMessage(text);
};

const hasFieldKey = (rows, key) =>
  Array.isArray(rows) && rows.some((entry) => String(entry?.key || '').trim() === key);

/** @type {Probe[]} */
const probes = [
  {
    label: 'Automation settings',
    method: 'GET',
    path: '/admin/automation/settings',
  },
  {
    label: 'Automation settings update route',
    method: 'PATCH',
    path: '/admin/automation/settings',
    body: {},
  },
  {
    label: 'Automation field catalog',
    method: 'GET',
    path: '/admin/automation/field-catalog',
    semanticCheck: (status, jsonBody) => {
      if (status !== 200) {
        return { ok: true, message: 'Semantic checks skipped (endpoint not returning 200).' };
      }
      const data = jsonBody?.data || {};
      const readyRows = Array.isArray(data?.READY_TO_WEAR) ? data.READY_TO_WEAR : [];
      const designRows = Array.isArray(data?.DESIGN) ? data.DESIGN : [];
      const fabricRows = Array.isArray(data?.FABRIC) ? data.FABRIC : [];
      const checks = [
        hasFieldKey(readyRows, 'hasAdditionalMaterialOrFabric'),
        hasFieldKey(designRows, 'hasAdditionalMaterialOrFabric'),
        hasFieldKey(readyRows, 'images[*]'),
        hasFieldKey(designRows, 'images[*]'),
        hasFieldKey(fabricRows, 'images[*]'),
      ];
      const ok = checks.every(Boolean);
      return {
        ok,
        message: ok
          ? 'Catalog includes hasAdditionalMaterialOrFabric + images[*] fields.'
          : 'Expected automation fields missing in catalog.',
      };
    },
  },
  {
    label: 'Automation field catalog sync',
    method: 'POST',
    path: '/admin/automation/field-catalog/sync',
    body: {},
  },
  {
    label: 'Product evaluation route',
    method: 'POST',
    path: '/admin/automation/evaluate-product',
    body: {},
  },
  {
    label: 'Account evaluation route',
    method: 'POST',
    path: '/admin/automation/evaluate-account',
    body: {},
  },
  {
    label: 'Product price compare list',
    method: 'GET',
    path: '/admin/products/price-compare',
  },
  {
    label: 'Failed AI approvals list',
    method: 'GET',
    path: '/failed-product-approvals/admin',
  },
];

const pad = (value, width) => {
  const text = String(value ?? '');
  if (text.length >= width) return text;
  return `${text}${' '.repeat(width - text.length)}`;
};

const runProbe = async (probe) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  const headers = {
    'content-type': 'application/json',
  };
  if (bearerToken) headers.authorization = `Bearer ${bearerToken}`;

  /** @type {ProbeResult} */
  const fallback = {
    label: probe.label,
    path: probe.path,
    status: null,
    outcome: 'ERROR',
    message: 'Unknown error',
    durationMs: Date.now() - started,
  };

  try {
    const response = await fetch(`${baseUrl}${probe.path}`, {
      method: probe.method,
      headers,
      body: probe.method !== 'GET' ? JSON.stringify(probe.body || {}) : undefined,
      signal: controller.signal,
    });
    const rawText = await response.text();
    let parsedJson = null;
    try {
      parsedJson = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsedJson = null;
    }

    const message = parseMessage(rawText) || response.statusText || '';
    if (response.status === 404) {
      return {
        label: probe.label,
        path: probe.path,
        status: response.status,
        outcome: 'MISSING',
        message,
        durationMs: Date.now() - started,
      };
    }

    if (probe.semanticCheck) {
      const semantic = probe.semanticCheck(response.status, parsedJson);
      if (!semantic.ok) {
        return {
          label: probe.label,
          path: probe.path,
          status: response.status,
          outcome: 'SEMANTIC_FAIL',
          message: trimMessage(semantic.message),
          durationMs: Date.now() - started,
        };
      }
      return {
        label: probe.label,
        path: probe.path,
        status: response.status,
        outcome: 'AVAILABLE',
        message: trimMessage(semantic.message || message),
        durationMs: Date.now() - started,
      };
    }

    return {
      label: probe.label,
      path: probe.path,
      status: response.status,
      outcome: 'AVAILABLE',
      message,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return {
      ...fallback,
      message: trimMessage(error instanceof Error ? error.message : String(error || 'Request failed')),
      durationMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
};

console.log(`\nAutomation smoke test: ${baseUrl}`);
console.log(`Auth token: ${bearerToken ? 'provided' : 'not provided (semantic checks requiring 200 may be skipped)'}`);
console.log(`Timeout: ${timeoutMs}ms\n`);

/** @type {ProbeResult[]} */
const results = [];
for (const probe of probes) {
  // eslint-disable-next-line no-await-in-loop
  results.push(await runProbe(probe));
}

const labelWidth = Math.max(...results.map((entry) => entry.label.length), 16);
const pathWidth = Math.max(...results.map((entry) => entry.path.length), 12);
console.log(
  `${pad('Probe', labelWidth)}  ${pad('Path', pathWidth)}  ${pad('Status', 6)}  ${pad('Outcome', 13)}  Message`
);
console.log(`${'-'.repeat(labelWidth)}  ${'-'.repeat(pathWidth)}  ------  -------------  -------`);
for (const row of results) {
  console.log(
    `${pad(row.label, labelWidth)}  ${pad(row.path, pathWidth)}  ${pad(String(row.status ?? '-'), 6)}  ${pad(
      row.outcome,
      13
    )}  ${row.message}`
  );
}

const missing = results.filter((entry) => entry.outcome === 'MISSING');
const errors = results.filter((entry) => entry.outcome === 'ERROR');
const semanticFailures = results.filter((entry) => entry.outcome === 'SEMANTIC_FAIL');
const available = results.filter((entry) => entry.outcome === 'AVAILABLE');

console.log('\nSummary:');
console.log(`- Available: ${available.length}`);
console.log(`- Missing (404): ${missing.length}`);
console.log(`- Semantic failures: ${semanticFailures.length}`);
console.log(`- Errors: ${errors.length}`);

if (missing.length > 0 || errors.length > 0 || semanticFailures.length > 0) {
  console.error('\nAutomation smoke test failed: one or more probes are missing/unreachable or failed semantic checks.');
  process.exit(2);
}

console.log('\nAutomation smoke test passed.');
