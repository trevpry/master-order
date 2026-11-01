const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const stubs = {
  [path.join(__dirname, '..', 'prismaClient.js')]: {},
  [path.join(__dirname, '..', 'services', 'jellyfinService.js')]: {
    isJellyfinId: () => true,
    ticksToMs: () => 0,
    dateToUnixSeconds: () => null,
    providerIdsToGuids: () => []
  }
};
for (const [filename, exports] of Object.entries(stubs)) {
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}

const { JellyfinSyncService } = require('../jellyfinSyncService');
const {
  getIgnoredCollections,
  isInIgnoredCollection
} = require('../utils/collectionSettings');

function graph(entries) {
  return new Map(entries.map(([id, name, children]) => [id, {
    id,
    name,
    children: children.map(([childId, type]) => ({ id: childId, type }))
  }]));
}

test('items inherit every ancestor collection name, movies and shows alike', () => {
  const collections = graph([
    ['root', 'Marvel', [['mcu', 'collection']]],
    ['mcu', 'MCU', [['phase1', 'collection'], ['loki', 'show']]],
    ['phase1', 'Phase One', [['ironman', 'movie']]]
  ]);
  const memberships = JellyfinSyncService.computeFlattenedMemberships(collections);
  assert.deepEqual(JSON.parse(memberships.get('ironman')), ['Marvel', 'MCU', 'Phase One']);
  assert.deepEqual(JSON.parse(memberships.get('loki')), ['Marvel', 'MCU']);
  assert.equal(memberships.has('mcu'), false);
});

test('items in several collections get the union and cycles terminate', () => {
  const collections = graph([
    ['a', 'A', [['b', 'collection'], ['x', 'movie']]],
    ['b', 'B', [['a', 'collection'], ['x', 'movie'], ['y', 'show']]],
    ['c', 'C', [['y', 'show']]]
  ]);
  const memberships = JellyfinSyncService.computeFlattenedMemberships(collections);
  assert.deepEqual(JSON.parse(memberships.get('x')), ['A', 'B']);
  assert.deepEqual(JSON.parse(memberships.get('y')), ['A', 'B', 'C']);
});

test('ignored collections merge the unified and legacy per-type lists', () => {
  const ignored = getIgnoredCollections({
    ignoredCollections: JSON.stringify(['Marvel']),
    ignoredMovieCollections: JSON.stringify(['marvel', 'Pixar']),
    ignoredTVCollections: 'not json'
  });
  assert.deepEqual(ignored, ['Marvel', 'Pixar']);
});

test('an item is ignored when any (including ancestor) collection is ignored', () => {
  const ignored = ['marvel'];
  assert.equal(isInIgnoredCollection(JSON.stringify(['Marvel', 'MCU']), ignored), true);
  assert.equal(isInIgnoredCollection(JSON.stringify(['Pixar']), ignored), false);
  assert.equal(isInIgnoredCollection(null, ignored), false);
  assert.equal(isInIgnoredCollection(JSON.stringify(['Marvel']), []), false);
});
