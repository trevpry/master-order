const test = require('node:test');
const assert = require('node:assert/strict');

const {
  normalizeScrapedPerformers,
  normalizeScrapedTags,
  extractGeviUrlsFromScraped,
  shouldAttemptGeviFollowUp,
  collectStashBoxSearchTermsFromResults,
  buildStashBoxEndpointCandidates
} = require('../utils/stashScrapeNormalization');

test('normalizeScrapedPerformers skips malformed entries and preserves names', () => {
  const performers = [
    'Alice',
    { name: 'Bob' },
    { performer: { name: 'Carol' } },
    null,
    undefined,
    { weird: true }
  ];

  const normalized = normalizeScrapedPerformers(performers);

  assert.deepEqual(normalized, [
    { name: 'Alice' },
    { name: 'Bob' },
    { name: 'Carol' }
  ]);
});

test('normalizeScrapedTags handles strings and objects without crashing', () => {
  const tags = ['Big Dick', { name: 'Anal' }, null, undefined, { alias: 'Toy' }];

  const normalized = normalizeScrapedTags(tags);

  assert.deepEqual(normalized, ['Big Dick', 'Anal']);
});

test('extractGeviUrlsFromScraped collects GEVI URLs from mixed fields', () => {
  const scraped = {
    url: 'https://example.com/scene',
    urls: ['https://example.com/alt'],
    sourceUrl: 'https://gayeroticvideoindex.com/scene/123',
    geviUrl: 'https://gayeroticvideoindex.com/scene/456'
  };

  const urls = extractGeviUrlsFromScraped(scraped);

  assert.deepEqual(urls, [
    'https://gayeroticvideoindex.com/scene/123',
    'https://gayeroticvideoindex.com/scene/456'
  ]);
});

test('shouldAttemptGeviFollowUp allows single-performer seed data', () => {
  const scraped = {
    performers: [{ name: 'Alice' }]
  };

  assert.equal(shouldAttemptGeviFollowUp(scraped), true);
});

test('buildStashBoxEndpointCandidates includes the selected endpoint plus configured boxes', () => {
  const candidates = buildStashBoxEndpointCandidates('https://selected.example/graphql', [
    { endpoint: 'https://box-a.example/graphql', name: 'Box A' },
    { endpoint: 'https://box-b.example/graphql', name: 'Box B' }
  ]);

  assert.deepEqual(candidates, [
    { endpoint: 'https://selected.example/graphql', name: 'selected' },
    { endpoint: 'https://box-a.example/graphql', name: 'Box A' },
    { endpoint: 'https://box-b.example/graphql', name: 'Box B' }
  ]);
});

test('collectStashBoxSearchTermsFromResults extracts performer names from successful fragment results', () => {
  const terms = collectStashBoxSearchTermsFromResults([
    { title: 'Alpha', performers: [{ name: 'Alice' }] },
    { title: 'Beta', performers: [{ name: 'Bob' }, { name: 'Alice' }] }
  ]);

  assert.deepEqual(terms, ['Alice', 'Bob', 'Alpha', 'Beta']);
});
