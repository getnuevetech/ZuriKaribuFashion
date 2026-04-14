export const parseStoredJsonValue = (value: unknown): unknown => {
  if (value && typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed);
    } catch {
      return {};
    }
  }
  return {};
};
