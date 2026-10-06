const test = require('node:test');
const assert = require('node:assert/strict');
const prisma = { customOrderItem: { update: async () => {}, findFirst: async () => null } };
const dependencies = {
  '../prismaClient': prisma,
  '../tvdbCachedService': {},
  '../comicVineService': {},
  '../openLibraryService': {},
  '../plexDatabaseService': class {},
  '../artworkCacheService': class {},
  '../subOrderService': {}
};
const cachedModules = new Map();
let markCustomOrderItemAsWatched;
try {
  for (const [name, exports] of Object.entries(dependencies)) {
    const modulePath = require.resolve(name);
    cachedModules.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = { id: modulePath, filename: modulePath, loaded: true, exports };
  }
  ({ markCustomOrderItemAsWatched } = require('../getNextCustomOrder'));
} finally {
  for (const [modulePath, cachedModule] of cachedModules) {
    if (cachedModule) require.cache[modulePath] = cachedModule;
    else delete require.cache[modulePath];
  }
}

test('marks a custom order item watched using only supported schema fields', async (context) => {
  const update = context.mock.method(prisma.customOrderItem, 'update', async (args) => {
    assert.deepEqual(args, { where: { id: 2740 }, data: { isWatched: true } });
    return { id: 2740, isWatched: true };
  });
  await markCustomOrderItemAsWatched('2740');
  assert.equal(update.mock.callCount(), 1);
});

test('propagates update failures so callers cannot report success', async (context) => {
  const failure = new Error('Database update failed');
  context.mock.method(console, 'error', () => {});
  context.mock.method(prisma.customOrderItem, 'update', async () => { throw failure; });
  await assert.rejects(markCustomOrderItemAsWatched(2740), error => error === failure);
});

test('resolves a non-numeric Plex identifier to the unwatched custom order item', async (context) => {
  context.mock.method(prisma.customOrderItem, 'findFirst', async (args) => {
    assert.deepEqual(args, { where: { plexKey: 'plex-item', isWatched: false }, orderBy: { id: 'desc' } });
    return { id: 2740 };
  });
  const update = context.mock.method(prisma.customOrderItem, 'update', async (args) => {
    assert.deepEqual(args, { where: { id: 2740 }, data: { isWatched: true } });
    return { id: 2740, isWatched: true };
  });
  await markCustomOrderItemAsWatched('plex-item');
  assert.equal(update.mock.callCount(), 1);
});

test('rejects unresolved identifiers without updating an item', async (context) => {
  context.mock.method(console, 'error', () => {});
  context.mock.method(prisma.customOrderItem, 'findFirst', async () => null);
  const update = context.mock.method(prisma.customOrderItem, 'update', async () => {});
  await assert.rejects(markCustomOrderItemAsWatched('missing-item'), /Could not find CustomOrderItem/);
  assert.equal(update.mock.callCount(), 0);
});