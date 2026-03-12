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

/** @type {Array<{label: string; method: 'POST' | 'GET'; path: string; body?: Record<string, unknown>}>} */
const probes = [
  { label: 'Promo preview (canonical)', method: 'POST', path: '/promotions/preview', body: {} },
  { label: 'Promo preview (promo alias)', method: 'POST', path: '/promo/preview', body: {} },
  { label: 'Promo preview (promo-codes alias)', method: 'POST', path: '/promo-codes/preview', body: {} },
  { label: 'Promo preview (check alias)', method: 'POST', path: '/promotions/check', body: {} },
  { label: 'Promo preview (validate alias)', method: 'POST', path: '/promotions/validate', body: {} },
  { label: 'Payment create-session (canonical)', method: 'POST', path: '/payments/create-session', body: {} },
  { label: 'Payment create-session (underscore alias)', method: 'POST', path: '/payments/create_session', body: {} },
  { label: 'Payment create-session (session/create alias)', method: 'POST', path: '/payments/session/create', body: {} },
  { label: 'Payment create-session (payment alias)', method: 'POST', path: '/payment/create-session', body: {} },
  { label: 'Stripe create-intent (canonical)', method: 'POST', path: '/payments/create-intent', body: {} },
  { label: 'Stripe create-intent (intent/create alias)', method: 'POST', path: '/payments/intent/create', body: {} },
  { label: 'Stripe create-intent (payment alias)', method: 'POST', path: '/payment/create-intent', body: {} },
  { label: 'Order create custom (canonical)', method: 'POST', path: '/orders/custom-design', body: {} },
  { label: 'Order create custom (legacy alias)', method: 'POST', path: '/order/custom-order', body: {} },
  { label: 'Order create ready (canonical)', method: 'POST', path: '/orders/ready-to-wear', body: {} },
  { label: 'Order create ready (legacy alias)', method: 'POST', path: '/order/ready', body: {} },
  { label: 'Order create fabric (canonical)', method: 'POST', path: '/orders/fabric-only', body: {} },
  { label: 'Order create fabric (legacy alias)', method: 'POST', path: '/order/fabric-order', body: {} },
  { label: 'Order create fabric (customer alias)', method: 'POST', path: '/customer/orders/fabric-only', body: {} },
];

/** @typedef {{label: string; path: string; status: number | null; outcome: 'AVAILABLE'|'MISSING'|'ERROR'; message: string; durationMs: number}} ProbeResult */

const trimMessage = (value) => {
  const input = String(value || '').replace(/\s+/g, ' ').trim();
  if (!input) return '';
  return input.length > 180 ? `${input.slice(0, 177)}...` : input;
};

const parseMessage = (text) => {
  if (!text) return '';
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object') {
      const obj = parsed;
      if (typeof obj.message === 'string') return trimMessage(obj.message);
      if (Array.isArray(obj.errors) && obj.errors.length > 0) return trimMessage(JSON.stringify(obj.errors[0]));
    }
  } catch {
    // Ignore parse error and fall through.
  }
  return trimMessage(text);
};

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
      body: probe.method === 'POST' ? JSON.stringify(probe.body || {}) : undefined,
      signal: controller.signal,
    });
    const rawText = await response.text();
    const message = parseMessage(rawText) || response.statusText || '';
    const outcome = response.status === 404 ? 'MISSING' : 'AVAILABLE';
    return {
      label: probe.label,
      path: probe.path,
      status: response.status,
      outcome,
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

console.log(`\nAPI smoke test: ${baseUrl}`);
console.log(`Auth token: ${bearerToken ? 'provided' : 'not provided (expect 401/403/400 for protected routes)'}`);
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
  `${pad('Probe', labelWidth)}  ${pad('Path', pathWidth)}  ${pad('Status', 6)}  ${pad('Outcome', 9)}  Message`
);
console.log(`${'-'.repeat(labelWidth)}  ${'-'.repeat(pathWidth)}  ------  ---------  -------`);
for (const row of results) {
  console.log(
    `${pad(row.label, labelWidth)}  ${pad(row.path, pathWidth)}  ${pad(String(row.status ?? '-'), 6)}  ${pad(
      row.outcome,
      9
    )}  ${row.message}`
  );
}

const missing = results.filter((entry) => entry.outcome === 'MISSING');
const errors = results.filter((entry) => entry.outcome === 'ERROR');
const available = results.filter((entry) => entry.outcome === 'AVAILABLE');

console.log('\nSummary:');
console.log(`- Available: ${available.length}`);
console.log(`- Missing (404): ${missing.length}`);
console.log(`- Errors: ${errors.length}`);

if (missing.length > 0 || errors.length > 0) {
  console.error('\nSmoke test failed: one or more critical probes are missing/unreachable.');
  process.exit(2);
}

console.log('\nSmoke test passed: all critical probes resolved to non-404 responses.');
