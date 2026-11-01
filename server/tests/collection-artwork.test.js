const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const prismaPath = path.join(__dirname, '..', 'prismaClient.js');
require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {} };

const { applyCollectionArtwork } = require('../utils/collectionArtwork');

const SERIES = 'a'.repeat(32);
const EPISODE = 'b'.repeat(32);

function makePrisma() {
  const collections = {
    1: { id: 1, jellyfinId: '1'.repeat(32), name: 'Now Watching', thumb: null, removed: false },
    2: { id: 2, jellyfinId: '2'.repeat(32), name: 'Star Trek Collection', thumb: '/Items/2/Images/Primary', removed: false },
    3: { id: 3, jellyfinId: '3'.repeat(32), name: 'Sci-Fi Universe', thumb: '/Items/3/Images/Primary', removed: false }
  };
  const links = [
    { collectionId: 1, itemKey: SERIES, childCollectionId: null },
    { collectionId: 2, itemKey: SERIES, childCollectionId: null },
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

test('non-episode content is left untouched', async () => {
  const movie = { type: 'movie', ratingKey: SERIES };
  await applyCollectionArtwork(movie, makePrisma());
  assert.equal(movie.collectionArtwork, undefined);
});
