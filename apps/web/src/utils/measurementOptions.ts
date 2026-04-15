export const normalizeMeasurementKey = (value: unknown) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');

const buildRange = (min: number, max: number, step = 1) => {
  const values: number[] = [];
  const safeStep = Math.max(0.1, Number(step || 1));
  for (let value = min; value <= max; value += safeStep) {
    values.push(Number(value.toFixed(2)));
  }
  return values;
};

const cmRangeByMeasurement: Array<{ tokens: string[]; min: number; max: number; step?: number }> = [
  { tokens: ['height', 'stature'], min: 130, max: 220 },
  { tokens: ['bust', 'chest'], min: 60, max: 170 },
  { tokens: ['waist'], min: 50, max: 160 },
  { tokens: ['hips', 'hip'], min: 70, max: 180 },
  { tokens: ['shoulder'], min: 30, max: 70 },
  { tokens: ['neck'], min: 25, max: 60 },
  { tokens: ['sleeve', 'arm'], min: 30, max: 95 },
  { tokens: ['wrist'], min: 10, max: 30, step: 0.5 },
  { tokens: ['thigh'], min: 30, max: 95, step: 0.5 },
  { tokens: ['knee'], min: 20, max: 65, step: 0.5 },
  { tokens: ['ankle'], min: 15, max: 45, step: 0.5 },
  { tokens: ['inseam', 'outseam'], min: 45, max: 130 },
];

const toInches = (cmValue: number) => Number((cmValue / 2.54).toFixed(1));

export const buildMeasurementDropdownOptions = (name: string, unit: string): number[] => {
  const key = normalizeMeasurementKey(name);
  const normalizedUnit = String(unit || 'cm').trim().toLowerCase();
  const matched =
    cmRangeByMeasurement.find((row) => row.tokens.some((token) => key.includes(token))) || {
      min: 20,
      max: 220,
      step: 1,
    };
  const cmValues = buildRange(matched.min, matched.max, matched.step || 1);
  if (normalizedUnit === 'in' || normalizedUnit === 'inch' || normalizedUnit === 'inches') {
    return Array.from(new Set(cmValues.map((value) => toInches(value))));
  }
  return cmValues;
};

export const readMeasurementCache = (storageKey: string): Record<string, number> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return Object.entries(parsed as Record<string, unknown>).reduce((acc, [key, value]) => {
      const parsedValue = Number(value);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) return acc;
      acc[normalizeMeasurementKey(key)] = parsedValue;
      return acc;
    }, {} as Record<string, number>);
  } catch {
    return {};
  }
};

export const writeMeasurementCache = (storageKey: string, values: Record<string, number>) => {
  if (typeof window === 'undefined') return;
  try {
    const sanitized = Object.entries(values || {}).reduce((acc, [key, value]) => {
      const parsedValue = Number(value);
      if (!Number.isFinite(parsedValue) || parsedValue <= 0) return acc;
      acc[normalizeMeasurementKey(key)] = Number(parsedValue.toFixed(2));
      return acc;
    }, {} as Record<string, number>);
    window.localStorage.setItem(storageKey, JSON.stringify(sanitized));
  } catch {
    // ignore localStorage write failures
  }
};
