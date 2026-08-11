const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSelectedPerformersForApply } = require('./scrapeReviewSelectionUtils');

test('buildSelectedPerformersForApply uses the selected review entry to map action codes to the chosen performer', () => {
  const reviewEntries = [
    {
      key: 'jane',
      name: 'Jane',
      defaultSelection: 'Jane',
      actionCode: 'OGRAT',
      options: ['Jane', 'Other Jane']
    }
  ];

  const matchedPerformers = [
    {
      id: 'perf-1',
      name: 'Jane',
      originalName: 'Jane',
      actionCode: 'OGRAT'
    }
  ];

  const scrapedPerformers = [
    {
      name: 'Jane',
      actionCode: 'OGRAT'
    }
  ];

  const result = buildSelectedPerformersForApply({
    reviewEntries,
    matchedPerformers,
    scrapedPerformers,
    performerSelections: { jane: 'Jane' }
  });

  assert.deepEqual(result, [
    {
      id: 'perf-1',
      name: 'Jane',
      originalName: 'Jane',
      actionCode: 'OGRAT',
      selectionValue: 'Jane'
    }
  ]);
});

test('buildSelectedPerformersForApply falls back to scraped performer action codes when no matched performer id is available', () => {
  const reviewEntries = [
    {
      key: 'jane',
      name: 'Jane',
      defaultSelection: 'Jane',
      actionCode: 'ATB',
      options: ['Jane']
    }
  ];

  const matchedPerformers = [];
  const scrapedPerformers = [
    {
      name: 'Jane',
      actionCode: 'ATB'
    }
  ];

  const result = buildSelectedPerformersForApply({
    reviewEntries,
    matchedPerformers,
    scrapedPerformers,
    performerSelections: { jane: 'Jane' }
  });

  assert.deepEqual(result, [
    {
      id: null,
      name: 'Jane',
      originalName: 'Jane',
      actionCode: 'ATB',
      selectionValue: 'Jane'
    }
  ]);
});
