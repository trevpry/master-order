/**
 * Collections are unified across movies and TV (Jellyfin BoxSets can hold
 * both), so there is a single ignored-collection list. The legacy
 * per-type lists are still honoured for existing installs.
 */
function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(v => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
    } catch (_e) {
      return [];
    }
  }
  return [];
}

function getIgnoredCollections(settings) {
  if (!settings) return [];
  const seen = new Map();
  for (const name of [
    ...parseList(settings.ignoredCollections),
    ...parseList(settings.ignoredMovieCollections),
    ...parseList(settings.ignoredTVCollections)
  ]) {
    const key = name.trim().toLowerCase();
    if (key && !seen.has(key)) seen.set(key, name.trim());
  }
  return [...seen.values()];
}

function parseItemCollections(collectionsJson) {
  return parseList(collectionsJson);
}

function isInIgnoredCollection(collectionsJson, ignored) {
  if (!ignored || ignored.length === 0) return false;
  const ignoredSet = new Set(ignored.map(n => n.toLowerCase()));
  return parseItemCollections(collectionsJson).some(c => ignoredSet.has(String(c).toLowerCase()));
}

module.exports = { getIgnoredCollections, parseItemCollections, isInIgnoredCollection, parseList };
