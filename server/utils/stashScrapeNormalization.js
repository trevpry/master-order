function normalizeScrapedPerformers(rawPerformers = []) {
  if (!Array.isArray(rawPerformers)) return [];

  return rawPerformers
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim() ? { name: entry.trim() } : null;
      }

      if (!entry || typeof entry !== 'object') return null;

      const performer = entry.performer || entry;
      if (!performer || typeof performer !== 'object') return null;

      const name = typeof performer.name === 'string' ? performer.name.trim() : '';
      if (!name) return null;

      return { name };
    })
    .filter(Boolean);
}

function normalizeScrapedTags(rawTags = []) {
  if (!Array.isArray(rawTags)) return [];

  return rawTags
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry.trim() || null;
      }

      if (!entry || typeof entry !== 'object') return null;

      const tagName = typeof entry.name === 'string' ? entry.name.trim() : '';
      return tagName || null;
    })
    .filter(Boolean);
}

function extractGeviUrlsFromScraped(scraped = {}) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (value) => {
    if (!value) return;

    if (Array.isArray(value)) {
      value.forEach(addCandidate);
      return;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      candidates.push(trimmed);
    }
  };

  addCandidate(scraped?.url);
  addCandidate(scraped?.urls);
  addCandidate(scraped?.sourceUrl);
  addCandidate(scraped?.source_url);
  addCandidate(scraped?.geviUrl);
  addCandidate(scraped?.gevi_url);

  return candidates.filter((entry) => /gayeroticvideoindex\.com|gevi/i.test(entry));
}

function shouldAttemptGeviFollowUp(scraped = {}) {
  const normalizedPerformers = normalizeScrapedPerformers(scraped?.performers || []);
  const geviUrls = extractGeviUrlsFromScraped(scraped);
  return normalizedPerformers.length >= 1 || geviUrls.length > 0;
}

function collectStashBoxSearchTermsFromResults(results = []) {
  const collected = [];
  const seen = new Set();

  const addTerm = (value) => {
    if (!value) return;

    const normalized = String(value).trim();
    if (!normalized || seen.has(normalized)) return;

    seen.add(normalized);
    collected.push(normalized);
  };

  (Array.isArray(results) ? results : []).forEach((result) => {
    if (!result || typeof result !== 'object') return;

    normalizeScrapedPerformers(result?.performers || []).forEach((performer) => addTerm(performer.name));
  });

  (Array.isArray(results) ? results : []).forEach((result) => {
    if (!result || typeof result !== 'object') return;

    if (result?.title) addTerm(result.title);
  });

  return collected;
}

function buildStashBoxEndpointCandidates(requestedEndpoint = null, configuredEndpoints = []) {
  const candidates = [];
  const seen = new Set();

  const addCandidate = (endpoint, label) => {
    const normalizedEndpoint = String(endpoint || '').trim();
    if (!normalizedEndpoint || seen.has(normalizedEndpoint)) return;

    seen.add(normalizedEndpoint);
    candidates.push({
      endpoint: normalizedEndpoint,
      name: label || normalizedEndpoint
    });
  };

  addCandidate(requestedEndpoint, 'selected');

  (Array.isArray(configuredEndpoints) ? configuredEndpoints : []).forEach((box) => {
    addCandidate(box?.endpoint, box?.name || box?.endpoint);
  });

  return candidates;
}

module.exports = {
  normalizeScrapedPerformers,
  normalizeScrapedTags,
  extractGeviUrlsFromScraped,
  shouldAttemptGeviFollowUp,
  collectStashBoxSearchTermsFromResults,
  buildStashBoxEndpointCandidates
};
