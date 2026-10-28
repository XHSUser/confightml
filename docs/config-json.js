(function (root) {
  'use strict';

  // Empty children are removed before deciding whether their parent is empty.
  function cleanValue(value) {
    if (value == null || (typeof value === 'string' && value.trim() === '')) return undefined;
    if (Array.isArray(value)) {
      const items = value.map(cleanValue).filter((item) => item !== undefined);
      return items.length ? items : undefined;
    }
    if (typeof value === 'object') {
      const entries = Object.entries(value)
        .map(([key, item]) => [key, cleanValue(item)])
        .filter(([, item]) => item !== undefined);
      return entries.length ? Object.fromEntries(entries) : undefined;
    }
    return value;
  }

  function omitEmptyFields(document) {
    const output = cleanValue(document) ?? {};
    // The app configuration applies only when a version is specified.
    if (output.app && !String(output.app.version ?? '').trim()) delete output.app;
    return output;
  }

  const api = { omitEmptyFields };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.configJSON = api;
})(typeof window === 'object' ? window : globalThis);
