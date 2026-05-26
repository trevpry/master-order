export const parseDateValue = (value) => {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value < 1e12 ? value * 1000 : value;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) {
        const millis = numeric < 1e12 ? numeric * 1000 : numeric;
        const parsedNumeric = new Date(millis);
        if (!Number.isNaN(parsedNumeric.getTime())) {
          return parsedNumeric;
        }
      }
    }

    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
};

export const formatDate = (value, options = {}) => {
  const date = parseDateValue(value);
  if (!date) return 'Unknown date';

  const { includeTime = false } = options;
  if (includeTime) {
    return date.toLocaleString();
  }

  return date.toLocaleDateString();
};
