import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectedPerformersForApply } from './scrapeReviewSelectionUtils.mjs';

test('builds from matchedPerformers when reviewEntries is empty', () => {
  const matchedPerformers = [
    { id: 'perf-1', name: 'Jane', originalName: 'Jane' }
  ];
  const scrapedPerformers = [
    { name: 'Jane', actionCode: 'OGRAT' }
  ];

  const result = buildSelectedPerformersForApply({ matchedPerformers, scrapedPerformers, performerSelections: {} });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'perf-1');
  assert.equal(result[0].actionCode, 'OGRAT');
});

test('action code comes from scraped performer via originalName when matched performer has none', () => {
  const reviewEntries = [
    { key: 'jane', name: 'Jane', originalName: 'Jane', defaultSelection: 'Jane Local', options: ['Jane Local'], actionCode: null }
  ];
  const matchedPerformers = [
    { id: 'perf-1', name: 'Jane Local', originalName: 'Jane' }
  ];
  const scrapedPerformers = [
    { name: 'Jane', actionCode: 'ATB' }
  ];

  const result = buildSelectedPerformersForApply({ reviewEntries, matchedPerformers, scrapedPerformers, performerSelections: {} });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'perf-1');
  assert.equal(result[0].actionCode, 'ATB');
});

test('unmatched scraped performer with __ADD_NEW__ selection appears in result with id null', () => {  const matchedPerformers = [
    { id: 'perf-1', name: 'Jane', originalName: 'Jane', actionCode: 'OGR' }
  ];
  const scrapedPerformers = [
    { name: 'Jane', actionCode: 'OGR' },
    { name: 'Bob', actionCode: 'AT' }   // unmatched
  ];

  const result = buildSelectedPerformersForApply({
    matchedPerformers,
    scrapedPerformers,
    performerSelections: { bob: '__ADD_NEW__' }
  });

  const bob = result.find((e) => e.originalName === 'Bob');
  assert.ok(bob, 'Bob must appear in result');
  assert.equal(bob.id, null, 'id must be null so caller creates the performer');
  assert.equal(bob.selectionValue, '__ADD_NEW__');
  assert.equal(bob.actionCode, 'AT');
});

test('compound key __ADD_NEW__ wins over simple key default set by useEffect', () => {
  const matchedPerformers = [];
  const scrapedPerformers = [
    { name: 'Cameron Michaels', actionCode: 'ATB' }
  ];

  const result = buildSelectedPerformersForApply({
    matchedPerformers,
    scrapedPerformers,
    // useEffect seeds the simple key with the default name;
    // user then picks __ADD_NEW__ stored under the compound column key
    performerSelections: {
      'cameron michaels': 'Cameron Michaels',
      'gevi-performer-search:cameron michaels': '__ADD_NEW__'
    }
  });

  const cameron = result.find((e) => e.originalName === 'Cameron Michaels');
  assert.ok(cameron, 'Cameron must appear in result');
  assert.equal(cameron.selectionValue, '__ADD_NEW__', 'compound-key __ADD_NEW__ must win over simple-key default');
  assert.equal(cameron.id, null);
});

test('compound key from multi-source column view resolves __ADD_NEW__ for unmatched performer', () => {
  const matchedPerformers = [
    { id: 'perf-1', name: 'Jane', originalName: 'Jane', actionCode: 'OGR' }
  ];
  const scrapedPerformers = [
    { name: 'Jane', actionCode: 'OGR' },
    { name: 'Cameron Michaels', actionCode: 'ATB' }
  ];

  const result = buildSelectedPerformersForApply({
    matchedPerformers,
    scrapedPerformers,
    // Multi-source column view stores as "sourceKey:performerKey"
    performerSelections: { 'gevi-performer-search:cameron michaels': '__ADD_NEW__' }
  });

  const cameron = result.find((e) => e.originalName === 'Cameron Michaels');
  assert.ok(cameron, 'Cameron must appear in result');
  assert.equal(cameron.selectionValue, '__ADD_NEW__');
  assert.equal(cameron.id, null);
});

test('unmatched entries (no id) do not appear in a pairedPerformers filter', () => {
  const matchedPerformers = [
    { id: 'perf-1', name: 'Jane', originalName: 'Jane', actionCode: null }
  ];
  const scrapedPerformers = [
    { name: 'Jane', actionCode: 'OGR' },
    { name: 'Bob', actionCode: 'AT' }
  ];

  const result = buildSelectedPerformersForApply({ matchedPerformers, scrapedPerformers, performerSelections: {} });
  const paired = result.filter((e) => e.id);
  const ids = paired.map((e) => e.id);
  const codes = paired.map((e) => e.actionCode);

  // Only Jane is matched; ids and codes must be aligned
  assert.deepEqual(ids, ['perf-1']);
  assert.deepEqual(codes, ['OGR']);
});
