const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveTrackDetails, getTrackDetails } = require('../services/trackDetailsService');

test('uses the track work and its composer', () => {
  const details = resolveTrackDetails({
    title: 'I. Allegro',
    work: { title: 'Symphony No. 5', userCatalogNumber: 'Op. 67', composer: { title: 'Ludwig van Beethoven' } }
  });
  assert.deepEqual(details, {
    composer: 'Ludwig van Beethoven',
    work: 'Symphony No. 5',
    workCatalog: 'Op. 67',
    movement: null
  });
});

test('falls back to the work part work and reports the movement', () => {
  const details = resolveTrackDetails({
    title: 'Track 1',
    workPartTracks: [{
      workPart: {
        title: 'II. Andante',
        work: { title: 'Piano Concerto No. 21', userTitle: 'Piano Concerto No. 21 "Elvira Madigan"', composer: { title: 'Mozart' } }
      }
    }]
  });
  assert.equal(details.work, 'Piano Concerto No. 21 "Elvira Madigan"');
  assert.equal(details.composer, 'Mozart');
  assert.equal(details.movement, 'II. Andante');
});

test('prefers user composer, then composer credits, then album work', () => {
  assert.equal(resolveTrackDetails({ userComposer: 'Bach', work: { title: 'W', composer: { title: 'Other' } } }).composer, 'Bach');

  const credited = resolveTrackDetails({
    trackArtists: [
      { artistType: { name: 'Conductor' }, artist: { title: 'Karajan' } },
      { artistType: { name: 'Composer' }, artist: { title: 'Brahms' } }
    ],
    album: { work: { title: 'Album Work', composer: { title: 'Ignored' } } }
  });
  assert.equal(credited.composer, 'Ignored');
  assert.equal(credited.work, 'Album Work');

  const albumCredit = resolveTrackDetails({
    album: { albumArtists: [{ artistType: { name: 'Composer' }, artist: { title: 'Dvořák' } }] }
  });
  assert.equal(albumCredit.composer, 'Dvořák');
  assert.equal(albumCredit.work, null);
});

test('returns nulls for unknown tracks', async () => {
  assert.deepEqual(resolveTrackDetails(null), { composer: null, work: null, workCatalog: null, movement: null });
  const prisma = { plexTrack: { findUnique: async () => null } };
  assert.equal(await getTrackDetails(prisma, '1'), null);
});

test('getTrackDetails exposes stored front album artwork', async () => {
  const prisma = {
    plexTrack: {
      findUnique: async () => ({
        title: 'Song',
        album: { ratingKey: 'a 1', artworks: [{ updatedAt: new Date(1000) }] }
      })
    }
  };
  const details = await getTrackDetails(prisma, '5');
  assert.equal(details.albumArtworkPath, '/api/music/albums/a%201/artwork/front?v=1000');
});
