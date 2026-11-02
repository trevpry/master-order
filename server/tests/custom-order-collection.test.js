const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };

const service = require('../services/customOrderCollectionService');
const { applyCollectionArtwork } = require('../utils/collectionArtwork');

const id = (ch) => ch.repeat(32);
const COLLECTION = id('c');
const PARENT_COLLECTION = id('d');
const MOVIE = id('1');
const SERIES_A = id('a');
const SERIES_B = id('b');
const EP_A1 = id('2');
const EP_A2 = id('3');
const EP_B1 = id('4');

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond && typeof cond === 'object') {
      if ('in' in cond) return cond.in.includes(value);
      if ('not' in cond) return value !== cond.not && !(cond.not === null && value == null);
    }
    return value === cond;
  });
}

function makePrisma({ orders, items, episodes = [], collections = [], collectionItems = [] }) {
  const table = (rows) => ({
    findMany: async ({ where } = {}) => rows.filter((r) => matches(r, where)),
    findUnique: async ({ where }) => rows.find((r) => matches(r, where)) || null
  });
  return {
    customOrder: table(orders),
    customOrderItem: table(items),
    plexEpisode: table(episodes),
    plexTVShow: { findFirst: async () => null },
    settings: { findUnique: async () => ({ collectionName: 'Now Watching' }) },
    mediaCollection: {
      ...table(collections),
      upsert: async ({ where, create, update }) => {
        const existing = collections.find((c) => c.jellyfinId === where.jellyfinId);
        if (existing) return Object.assign(existing, update);
        const row = { id: collections.length + 1, ...create };
        collections.push(row);
        return row;
      }
    },
    mediaCollectionItem: {
      findMany: async ({ where }) => collectionItems
        .filter((l) => (where.itemKey ? l.itemKey === where.itemKey : where.childCollectionId.in.includes(l.childCollectionId)))
        .map((l) => ({ ...l, collection: collections.find((c) => c.id === l.collectionId) })),
      upsert: async ({ where, create }) => {
        const key = where.collectionId_itemKey;
        let row = collectionItems.find((l) => l.collectionId === key.collectionId && l.itemKey === key.itemKey);
        if (!row) collectionItems.push(row = { childCollectionId: null, ...create });
        return row;
      }
    }
  };
}

function makeJellyfin(existing = []) {
  const calls = { added: [], created: [] };
  return {
    calls,
    isConfigured: async () => true,
    getCollectionChildren: async () => existing.map((Id) => ({ Id })),
    addToCollection: async (collectionId, ids) => calls.added.push({ collectionId, ids }),
    getItems: async (ids) => ids.filter((i) => i === EP_B1).map((Id) => ({ Id, SeriesId: SERIES_B })),
    createCollection: async (name) => { calls.created.push(name); return { Id: COLLECTION }; },
    getItem: async (itemId) => ({ Id: itemId, Type: itemId === COLLECTION ? 'BoxSet' : 'Movie', Name: 'MCU', ImageTags: { Primary: 'x' } })
  };
}

function fixture() {
  return {
    orders: [
      { id: 1, name: 'MCU', parentOrderId: null, jellyfinCollectionId: COLLECTION },
      { id: 2, name: 'Phase 1', parentOrderId: 1, jellyfinCollectionId: null },
      { id: 3, name: 'Shows', parentOrderId: null, jellyfinCollectionId: null }
    ],
    items: [
      { id: 10, customOrderId: 1, mediaType: 'movie', plexKey: MOVIE, sourceProvider: 'jellyfin' },
      { id: 11, customOrderId: 1, mediaType: 'movie', plexKey: id('9'), sourceProvider: 'arr' },
      { id: 12, customOrderId: 1, mediaType: 'suborder', referencedCustomOrderId: 3, plexKey: null },
      { id: 13, customOrderId: 1, mediaType: 'book', plexKey: null },
      { id: 20, customOrderId: 2, mediaType: 'episode', plexKey: EP_A1, sourceProvider: 'jellyfin' },
      { id: 21, customOrderId: 2, mediaType: 'episode', plexKey: EP_A2, sourceProvider: 'jellyfin' },
      { id: 30, customOrderId: 3, mediaType: 'episode', plexKey: EP_B1, sourceProvider: 'jellyfin' },
      { id: 31, customOrderId: 3, mediaType: 'webvideo', plexKey: null }
    ],
    episodes: [
      { ratingKey: EP_A1, grandparentRatingKey: SERIES_A },
      { ratingKey: EP_A2, grandparentRatingKey: SERIES_A }
    ],
    collections: [
      { id: 1, jellyfinId: COLLECTION, name: 'MCU', thumb: `/Items/${COLLECTION}/Images/Primary`, removed: false },
      { id: 2, jellyfinId: PARENT_COLLECTION, name: 'Marvel', thumb: null, removed: false }
    ],
    collectionItems: [
      { collectionId: 1, itemKey: SERIES_A, itemType: 'show', childCollectionId: null },
      { collectionId: 2, itemKey: COLLECTION, itemType: 'collection', childCollectionId: 1 }
    ]
  };
}

test('collects movies and episode series across nested sub-orders, skipping Arr and non-video items', async () => {
  const data = fixture();
  const keys = await service.collectOrderLibraryKeys(1, { prisma: makePrisma(data), jellyfin: makeJellyfin() });
  assert.deepEqual(keys.movies, [MOVIE]);
  assert.deepEqual(keys.shows.sort(), [SERIES_A, SERIES_B].sort());
});

test('sync adds only missing members to the linked collection and mirrors them locally', async () => {
  const data = fixture();
  const jellyfin = makeJellyfin([SERIES_A]);
  const result = await service.syncOrderCollection(1, { prisma: makePrisma(data), jellyfin });
  assert.equal(result.added, 2);
  assert.deepEqual(jellyfin.calls.added, [{ collectionId: COLLECTION, ids: [MOVIE, SERIES_B] }]);
  assert.deepEqual(
    data.collectionItems.filter((l) => l.collectionId === 1).map((l) => [l.itemKey, l.itemType]),
    [[SERIES_A, 'show'], [MOVIE, 'movie'], [SERIES_B, 'show']]
  );
});

test('item changes in a sub-order sync every linked containing order', async () => {
  const data = fixture();
  const jellyfin = makeJellyfin();
  const results = await service.syncLinkedCollectionsForOrder(3, { prisma: makePrisma(data), jellyfin });
  assert.deepEqual(results.map((r) => r.orderId), [1]);
  assert.equal(jellyfin.calls.added[0].collectionId, COLLECTION);
});

test('unlinked orders are not synced', async () => {
  const data = fixture();
  data.orders[0].jellyfinCollectionId = null;
  const jellyfin = makeJellyfin();
  assert.deepEqual(await service.syncLinkedCollectionsForOrder(3, { prisma: makePrisma(data), jellyfin }), []);
  assert.equal(jellyfin.calls.added.length, 0);
});

test('linking validates the BoxSet, can create a collection named after the order, and allows unlinking', async () => {
  const data = fixture();
  const prisma = makePrisma(data);
  const jellyfin = makeJellyfin();
  assert.equal(await service.resolveCollectionLink({ jellyfinCollectionId: COLLECTION }, { prisma, jellyfin }), COLLECTION);
  assert.equal(await service.resolveCollectionLink({ createJellyfinCollection: true, orderName: 'MCU' }, { prisma, jellyfin }), COLLECTION);
  assert.deepEqual(jellyfin.calls.created, ['MCU']);
  assert.equal(await service.resolveCollectionLink({ jellyfinCollectionId: null }, { prisma, jellyfin }), null);
  await assert.rejects(service.resolveCollectionLink({ jellyfinCollectionId: MOVIE }, { prisma, jellyfin }), { status: 400 });
  await assert.rejects(service.resolveCollectionLink({ jellyfinCollectionId: 'nope' }, { prisma, jellyfin }), { status: 400 });
});

test('any item from a linked order (or its sub-orders) gets the linked collection art first', async () => {
  const data = fixture();
  const prisma = makePrisma(data);
  const book = { type: 'book', customOrderId: 2, title: 'Iron Man comic' };
  await applyCollectionArtwork(book, prisma);
  assert.deepEqual(book.collectionArtwork.map((c) => [c.title, c.depth]), [['MCU', 0], ['Marvel', 1]]);

  const episode = { type: 'episode', customOrderMediaType: 'episode', ratingKey: EP_A1, customOrderId: 2 };
  await applyCollectionArtwork(episode, prisma);
  assert.deepEqual(episode.collectionArtwork.map((c) => c.title), ['MCU', 'Marvel']);

  const nested = { type: 'book', customOrderId: 3 };
  await applyCollectionArtwork(nested, prisma);
  assert.deepEqual(nested.collectionArtwork.map((c) => c.title), ['MCU', 'Marvel']);

  data.orders[0].jellyfinCollectionId = null;
  const unlinked = { type: 'book', customOrderId: 3 };
  await applyCollectionArtwork(unlinked, prisma);
  assert.equal(unlinked.collectionArtwork, undefined);
});

test('orders in API responses (and nested sub-orders) get their linked collection', async () => {
  const data = fixture();
  const orders = [{ id: 1, jellyfinCollectionId: COLLECTION, subOrders: [{ id: 2, jellyfinCollectionId: null }] }];
  await service.attachLinkedCollections(orders, makePrisma(data));
  assert.deepEqual(orders[0].jellyfinCollection, {
    jellyfinId: COLLECTION, name: 'MCU', thumb: `/Items/${COLLECTION}/Images/Primary`, removed: false
  });
  assert.equal(orders[0].subOrders[0].jellyfinCollection, null);
});
