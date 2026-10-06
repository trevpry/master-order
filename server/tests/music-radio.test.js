const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/music.js'), 'utf8');

const matchesWhere = (record, where = {}) => Object.entries(where).every(([field, condition]) => {
  if (field === 'AND') return condition.every(clause => matchesWhere(record, clause));
  if (field === 'OR') return condition.some(clause => matchesWhere(record, clause));
  if (condition && typeof condition === 'object') {
    if ('in' in condition) return condition.in.includes(record[field]);
    if ('gte' in condition) return record[field] !== null && record[field] >= condition.gte;
    if ('some' in condition) return record[field].some(entry => matchesWhere(entry, condition.some));
    return matchesWhere(record[field], condition);
  }
  return record[field] === condition;
});

const track = (ratingKey, fields = {}) => ({
  ratingKey,
  viewCount: 0,
  userRating: null,
  removed: false,
  parentRatingKey: `album-${ratingKey}`,
  grandparentRatingKey: `artist-${ratingKey}`,
  librarySection: { sectionKey: '6' },
  workPartTracks: [],
  trackArtists: [],
  album: { albumArtists: [] },
  work: null,
  ...fields
});

const runRadio = async (tracks, query, sectionKey) => {
  const handlers = new Map();
  const context = vm.createContext({
    prisma: { plexTrack: { findMany: async ({ where, select }) => tracks.filter(entry => matchesWhere(entry, where)).map(entry => ({
      ...entry,
      trackArtists: select?.trackArtists ? entry.trackArtists.filter(credit => matchesWhere(credit, select.trackArtists.where)) : entry.trackArtists,
      album: select?.album ? { ...entry.album, albumArtists: entry.album.albumArtists.filter(credit => matchesWhere(credit, select.album.select.albumArtists.where)) } : entry.album
    })) } },
    console: { log: () => {} },
    router: { get: (route, handler) => handlers.set(route, handler) },
    asyncHandler: handler => handler,
    sendBadRequest: (res, message) => res.status(400).json({ error: message })
  });
  const helperStart = source.indexOf('const UNPLAYED_TRACK_FILTER');
  const helperEnd = source.indexOf('// Music Sections', helperStart);
  const routeStart = source.indexOf('// Get random tracks - All sections');
  const routeEnd = source.indexOf('// Get single track with details', routeStart);
  vm.runInContext(`${source.slice(helperStart, helperEnd)}\n${source.slice(routeStart, routeEnd)}`, context);
  let result;
  const handler = handlers.get(sectionKey ? '/tracks/random/section/:sectionKey' : '/tracks/random');
  const response = { status: () => response, json: data => { result = data; } };
  await handler({ query: { limit: '100', ...query }, params: { sectionKey } }, response);
  if (result.error) throw new Error(result.error);
  return result.tracks;
};

for (const sectionKey of [undefined, '6']) {
  const scope = sectionKey ? 'section radio' : 'all-sections radio';

  test(`${scope}: unplayed-only preserves rating exclusions`, async () => {
    const tracks = [track('zero'), track('null', { viewCount: null }), track('played', { viewCount: 2 }), track('low-rated', { userRating: 2 })];
    const result = await runRadio(tracks, { unplayed: 'true' }, sectionKey);
    assert.deepEqual(new Set(result.map(entry => entry.ratingKey)), new Set(['zero', 'null']));
  });

  test(`${scope}: rated percentage cannot select played tracks`, async () => {
    const tracks = [track('rated-unplayed', { userRating: 10 }), track('rated-played', { userRating: 10, viewCount: 3 }), track('unrated')];
    const result = await runRadio(tracks, { unplayed: 'true', minRating: '8', minRatingPercent: '50' }, sectionKey);
    assert.ok(result.some(entry => entry.ratingKey === 'rated-unplayed'));
    assert.ok(result.every(entry => entry.viewCount === null || entry.viewCount === 0));
  });

  test(`${scope}: grouped filters and work expansion cannot add played movements`, async () => {
    const workPartTracks = [{ workPart: { workId: 1, work: { id: 1 } } }];
    const tracks = [
      track('movement-1', { parentRatingKey: 'work-album', workPartTracks }),
      track('movement-2', { parentRatingKey: 'work-album', workPartTracks, viewCount: 1, userRating: 2 }),
      track('fresh-movement', { workPartTracks: [{ workPart: { workId: 2, work: { id: 2 } } }] })
    ];
    for (const groupedFilter of ['unplayedAlbums', 'unplayedArtists', 'unplayedWorks']) {
      const result = await runRadio(tracks, { [groupedFilter]: 'true', playCompleteWork: 'true' }, sectionKey);
      assert.ok(result.length > 0);
      assert.ok(result.every(entry => entry.viewCount === null || entry.viewCount === 0));
    }
    const result = await runRadio(tracks, { unplayed: 'true', playCompleteWork: 'true', minRating: '1', minRatingPercent: '50' }, sectionKey);
    assert.ok(result.length > 0);
    assert.ok(result.every(entry => entry.viewCount === null || entry.viewCount === 0));
  });

  test(`${scope}: played tracks remain eligible when the checkbox is off`, async () => {
    const result = await runRadio([track('played', { viewCount: 1 })], {}, sectionKey);
    assert.equal(result[0].ratingKey, 'played');
  });

  for (const groupedFilter of ['unplayedAlbums', 'unplayedArtists', 'unplayedWorks']) {
    test(`${scope}: ${groupedFilter} counts low-rated play history in every selection branch`, async () => {
      const workPartTracks = [{ workPart: { workId: 10, work: { id: 10 } } }];
      const tracks = [
        track('ineligible', { userRating: 10, parentRatingKey: 'played-album', grandparentRatingKey: 'played-artist', workPartTracks }),
        track('low-rated-played', { userRating: 2, viewCount: 1, parentRatingKey: 'played-album', grandparentRatingKey: 'played-artist', workPartTracks }),
        track('fresh', { userRating: 10, workPartTracks: [{ workPart: { workId: 20, work: { id: 20 } } }] }),
        track('fresh-unrated', { workPartTracks: [{ workPart: { workId: 30, work: { id: 30 } } }] })
      ];
      for (const options of [{}, { minRating: '8' }, { minRating: '8', minRatingPercent: '50' }, { playCompleteWork: 'true' }]) {
        const result = await runRadio(tracks, { [groupedFilter]: 'true', ...options }, sectionKey);
        assert.ok(result.length > 0);
        assert.ok(result.every(entry => entry.ratingKey.startsWith('fresh')), `${groupedFilter} admitted a played group`);
        if (options.minRating && !options.minRatingPercent) {
          assert.ok(result.every(entry => entry.userRating >= 8));
        }
      }
    });
  }

  test(`${scope}: artist history includes other albums and work history includes other recordings`, async () => {
    const workPartTracks = [{ workPart: { workId: 40, work: { id: 40 } } }];
    const tracks = [
      track('candidate', { grandparentRatingKey: 'shared-artist', workPartTracks }),
      track('played-recording', { viewCount: 1, userRating: 2, grandparentRatingKey: 'shared-artist', workPartTracks })
    ];
    assert.equal((await runRadio(tracks, { unplayedAlbums: 'true' }, sectionKey))[0].ratingKey, 'candidate');
    assert.equal((await runRadio(tracks, { unplayedArtists: 'true' }, sectionKey)).length, 0);
    assert.equal((await runRadio(tracks, { unplayedWorks: 'true' }, sectionKey)).length, 0);
  });

  test(`${scope}: grouped flags ignore removed play history`, async () => {
    const workPartTracks = [{ workPart: { workId: 50, work: { id: 50 } } }];
    const tracks = [
      track('fresh', { userRating: 10, viewCount: null, parentRatingKey: 'fresh-album', grandparentRatingKey: 'fresh-artist', workPartTracks }),
      track('removed-history', { removed: true, viewCount: 2, parentRatingKey: 'fresh-album', grandparentRatingKey: 'fresh-artist', workPartTracks }),
      track('album-blocked', { userRating: 10, parentRatingKey: 'blocked-album', workPartTracks }),
      track('album-history', { userRating: 2, viewCount: 1, parentRatingKey: 'blocked-album' }),
      track('artist-blocked', { userRating: 10, grandparentRatingKey: 'blocked-artist', workPartTracks }),
      track('artist-history', { userRating: 2, viewCount: 1, grandparentRatingKey: 'blocked-artist' })
    ];
    for (const groupedFilter of ['unplayedAlbums', 'unplayedArtists', 'unplayedWorks']) {
      const result = await runRadio(tracks, {
        [groupedFilter]: 'true', minRating: '8', minRatingPercent: '50', playCompleteWork: 'true'
      }, sectionKey);
      assert.ok(result.some(entry => entry.ratingKey === 'fresh'));
      if (groupedFilter === 'unplayedAlbums') assert.ok(result.every(entry => entry.ratingKey !== 'album-blocked'));
      if (groupedFilter === 'unplayedArtists') assert.ok(result.every(entry => entry.ratingKey !== 'artist-blocked'));
    }
  });

  test(`${scope}: work expansion cannot reintroduce a track linked to a played work`, async () => {
    const freshWork = { workPart: { workId: 60, work: { id: 60 } } };
    const playedWork = { workPart: { workId: 70, work: { id: 70 } } };
    const tracks = [
      track('eligible', { parentRatingKey: 'shared-album', workPartTracks: [freshWork] }),
      track('bridge', { parentRatingKey: 'shared-album', workPartTracks: [freshWork, playedWork] }),
      track('played-other-work', { viewCount: 1, userRating: 2, workPartTracks: [playedWork] }),
      track('no-work'),
      track('missing-work-id', { workPartTracks: [{ workPart: {} }] })
    ];
    const result = await runRadio(tracks, { unplayedWorks: 'true', playCompleteWork: 'true' }, sectionKey);
    assert.deepEqual(new Set(result.map(entry => entry.ratingKey)), new Set(['eligible']));
  });

  test(`${scope}: unplayed composers checks all credited history and excludes unknown composers`, async () => {
    const composerCredit = artistKey => ({ artistKey, artistType: { name: 'Composer' } });
    const tracks = [
      track('blocked-track-credit', { userRating: 10, trackArtists: [composerCredit('played-composer')] }),
      track('played-low-rated', { viewCount: 1, userRating: 2, work: { composerKey: 'played-composer' } }),
      track('fresh-track-credit', { userRating: 10, trackArtists: [composerCredit('fresh-composer')] }),
      track('fresh-work-credit', { workPartTracks: [{ workPart: { workId: 90, work: { id: 90, composerKey: 'fresh-composer' } } }] }),
      track('fresh-album-credit', { album: { albumArtists: [composerCredit('album-composer')] } }),
      track('removed-composer-history', { removed: true, viewCount: 1, trackArtists: [composerCredit('fresh-composer')] }),
      track('blocked-work-expansion', { trackArtists: [composerCredit('played-composer')], parentRatingKey: 'album-fresh-work-credit', workPartTracks: [{ workPart: { workId: 90, work: { id: 90, composerKey: 'fresh-composer' } } }] }),
      track('performer-only', { trackArtists: [{ artistKey: 'performer', artistType: { name: 'Performer' } }] }),
      track('unknown-composer')
    ];
    for (const options of [{}, { minRating: '8' }, { minRating: '8', minRatingPercent: '50' }, { playCompleteWork: 'true' }]) {
      const result = await runRadio(tracks, { unplayedComposers: 'true', ...options }, sectionKey);
      const expected = options.minRating && !options.minRatingPercent ? ['fresh-track-credit'] : ['fresh-track-credit', 'fresh-work-credit', 'fresh-album-credit'];
      assert.deepEqual(new Set(result.map(entry => entry.ratingKey)), new Set(expected));
    }
  });

  test(`${scope}: track-specific composer credits take precedence over album credits`, async () => {
    const composerCredit = artistKey => ({ artistKey, artistType: { name: 'Composer' } });
    const tracks = [
      track('fresh', { trackArtists: [composerCredit('fresh-composer')], album: { albumArtists: [composerCredit('played-composer')] } }),
      track('played', { viewCount: 1, album: { albumArtists: [composerCredit('played-composer')] } }),
      track('co-composed', { trackArtists: [composerCredit('fresh-composer'), composerCredit('played-composer')] })
    ];
    const result = await runRadio(tracks, { unplayedComposers: 'true' }, sectionKey);
    assert.deepEqual(new Set(result.map(entry => entry.ratingKey)), new Set(['fresh']));
  });

  test(`${scope}: rejects multiple unplayed flags`, async () => {
    const filters = ['unplayed', 'unplayedAlbums', 'unplayedArtists', 'unplayedWorks', 'unplayedComposers'];
    for (const [index, filter] of filters.entries()) {
      for (const otherFilter of filters.slice(index + 1)) {
        await assert.rejects(runRadio([], { [filter]: 'true', [otherFilter]: 'true' }, sectionKey), /Only one unplayed filter/);
      }
    }
  });
}

test('section filters use section history while all-sections filters include all libraries', async () => {
  const workPartTracks = [{ workPart: { workId: 80, work: { id: 80, composerKey: 'section-composer' } } }];
  const tracks = [
    track('section-candidate', { parentRatingKey: 'shared-album', grandparentRatingKey: 'shared-artist', workPartTracks }),
    track('other-section-history', { viewCount: 1, userRating: 2, librarySection: { sectionKey: '7' }, parentRatingKey: 'shared-album', grandparentRatingKey: 'shared-artist', workPartTracks })
  ];
  for (const groupedFilter of ['unplayedAlbums', 'unplayedArtists', 'unplayedWorks', 'unplayedComposers']) {
    assert.equal((await runRadio(tracks, { [groupedFilter]: 'true' }, '6'))[0].ratingKey, 'section-candidate');
    assert.equal((await runRadio(tracks, { [groupedFilter]: 'true' })).length, 0);
  }
});