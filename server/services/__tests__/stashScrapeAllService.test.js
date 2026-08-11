const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScrapeAllSources } = require('../stashScrapeAllService');

test('buildScrapeAllSources groups results by source and preserves source metadata', () => {
  const sources = [
    { name: 'First Box', endpoint: 'https://box1.example' },
    { name: 'Second Box', endpoint: 'https://box2.example' }
  ];

  const resultsBySource = {
    'https://box1.example': [{ title: 'Alpha' }],
    'https://box2.example': []
  };

  const grouped = buildScrapeAllSources(sources, resultsBySource, {
    'https://box1.example': false,
    'https://box2.example': true
  });

  assert.equal(grouped.length, 2);
  assert.equal(grouped[0].name, 'First Box');
  assert.equal(grouped[0].endpoint, 'https://box1.example');
  assert.equal(grouped[0].resultCount, 1);
  assert.equal(grouped[0].results[0].title, 'Alpha');
  assert.equal(grouped[0].usedFallback, false);
  assert.equal(grouped[1].resultCount, 0);
  assert.equal(grouped[1].hasResults, false);
  assert.equal(grouped[1].usedFallback, true);
});
