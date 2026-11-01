const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };

const { applyCollectionArtwork } = require('../utils/collectionArtwork');

const SERIES = 'a'.repeat(32);
const EPISODE = 'b'.repeat(32);
const MOVIE = 'c'.repeat(32);

function makePrisma() {
  const collections = {
    1: { id: 1, jellyfinId: '1'.repeat(32), name: 'Now Watching', thumb: null, removed: false },
    2: { id: 2, jellyfinId: '2'.repeat(32), name: 'Star Trek Collection', thumb: '/Items/2/Images/Primary', removed: false },
    3: { id: 3, jellyfinId: '3'.repeat(32), name: 'Sci-Fi Universe', thumb: '/Items/3/Images/Primary', removed: false }
  };
  const links = [
    { collectionId: 1, itemKey: SERIES, childCollectionId: null },
    { collectionId: 2, itemKey: SERIES, childCollectionId: null },
    { collectionId: 1, itemKey: MOVIE, childCollectionId: null },
    { collectionId: 2, itemKey: MOVIE, childCollectionId: null },
    { collectionId: 3, itemKey: collections[2].jellyfinId, childCollectionId: 2 }
  ];
  return {
    plexEpisode: { findUnique: async ({ where }) => (where.ratingKey === EPISODE ? { grandparentRatingKey: SERIES } : null) },
    plexTVShow: { findFirst: async () => null },
    settings: { findUnique: async () => ({ collectionName: 'Now Watching' }) },
    mediaCollectionItem: {
      findMany: async ({ where }) => links
        .filter((l) => (where.itemKey ? l.itemKey === where.itemKey : where.childCollectionId.in.includes(l.childCollectionId)))
        .map((l) => ({ ...l, collection: collections[l.collectionId] }))
    }
  };
}

test('custom-order and TV-pick episodes get identical collection artwork, including parent collections', async () => {
  const prisma = makePrisma();
  const customOrder = { customOrderMediaType: 'episode', type: 'episode', ratingKey: EPISODE };
  const tvPick = { type: 'episode', ratingKey: SERIES, episodeRatingKey: EPISODE, title: 'Star Trek' };
  await applyCollectionArtwork(customOrder, prisma);
  await applyCollectionArtwork(tvPick, prisma);

  assert.deepEqual(customOrder.collectionArtwork, tvPick.collectionArtwork);
  assert.deepEqual(customOrder.collectionArtwork.map((c) => [c.title, c.depth]), [
    ['Star Trek Collection', 0],
    ['Sci-Fi Universe', 1]
  ]);
});

test('general and custom-order movies get the same collection posters and ancestor artwork', async () => {
  const prisma = makePrisma();
  const movie = { type: 'movie', ratingKey: MOVIE, orderType: 'MOVIES_GENERAL' };
  const customOrder = { type: 'movie', customOrderMediaType: 'movie', ratingKey: 'order-item', plexKey: MOVIE };
  await applyCollectionArtwork(movie, prisma);
  await applyCollectionArtwork(customOrder, prisma);
  assert.deepEqual(movie.collectionArtwork, customOrder.collectionArtwork);
  assert.deepEqual(movie.collectionArtwork.map(c => [c.title, c.depth]), [
    ['Star Trek Collection', 0],
    ['Sci-Fi Universe', 1]
  ]);
  assert.equal(movie.collectionArtwork[0].thumb, '/Items/2/Images/Primary');
});

test('movie order payloads without an explicit type still receive collection artwork', async () => {
  const movie = { orderType: 'MOVIES_GENERAL', ratingKey: MOVIE };
  await applyCollectionArtwork(movie, makePrisma());
  assert.equal(movie.collectionArtwork.length, 2);
});

test('movies without collections return an empty artwork list', async () => {
  const movie = { type: 'movie', ratingKey: 'd'.repeat(32) };
  await applyCollectionArtwork(movie, makePrisma());
  assert.deepEqual(movie.collectionArtwork, []);
});

test('non-video, Arr-backed and legacy Plex content is left untouched', async () => {
  for (const media of [
    { type: 'book', ratingKey: MOVIE },
    { type: 'movie', ratingKey: MOVIE, libraryProvider: 'arr' },
    { type: 'movie', ratingKey: '123' }
  ]) {
    await applyCollectionArtwork(media, makePrisma());
    assert.equal(media.collectionArtwork, undefined);
  }
});
