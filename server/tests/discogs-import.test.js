const test = require('node:test');
const assert = require('node:assert/strict');

const DiscogsImportService = require('../services/discogsImportService');
const { parsePosition, parseDurationMs, cleanDiscogsName } = DiscogsImportService.helpers;

const service = new DiscogsImportService();

test('parses Discogs positions and durations', () => {
  assert.deepEqual(parsePosition('1-12'), { discNumber: 1, trackNumber: 12 });
  assert.deepEqual(parsePosition('CD2-3'), { discNumber: 2, trackNumber: 3 });
  assert.deepEqual(parsePosition('7'), { discNumber: null, trackNumber: 7 });
  assert.deepEqual(parsePosition('A1'), { discNumber: null, trackNumber: null });
  assert.equal(parseDurationMs('2:10'), 130000);
  assert.equal(parseDurationMs(''), null);
  assert.equal(cleanDiscogsName('John Smith (3)'), 'John Smith');
});

test('maps Discogs roles to artist types and drops production credits', () => {
  assert.deepEqual(service.mapRoleToTypeNames('Composed By'), ['Composer']);
  assert.deepEqual(service.mapRoleToTypeNames('Libretto By'), ['Librettist']);
  assert.deepEqual(service.mapRoleToTypeNames('Soprano Vocals [Aminta]'), ['Soprano']);
  assert.deepEqual(service.mapRoleToTypeNames('Harpsichord, Conductor'), ['Harpsichord', 'Conductor']);
  assert.deepEqual(service.mapRoleToTypeNames('Recorded By, Producer'), []);
});

test('flattens headings and index tracks, and resolves track ranges', () => {
  const items = service.flattenTracklist({
    tracklist: [
      { type_: 'heading', title: 'Atto 1', position: '' },
      { type_: 'track', title: 'Sinfonia ', position: '1-1', duration: '2:10' },
      {
        type_: 'index', title: 'Concerto in D', position: '',
        sub_tracks: [
          { type_: 'track', title: 'Allegro', position: '1-2' },
          { type_: 'track', title: 'Largo', position: '1-3' }
        ]
      },
      { type_: 'track', title: 'Finale', position: '2-1' }
    ]
  });

  assert.equal(items.length, 4);
  assert.equal(items[0].title, 'Sinfonia');
  assert.equal(items[0].heading, 'Atto 1');
  assert.equal(items[1].title, 'Concerto in D: Allegro');
  assert.equal(items[1].workTitle, 'Concerto in D');
  assert.equal(items[2].partOrder, 2);
  assert.deepEqual([...service.resolveTrackRange('1-2 to 1-3, 2-1', items)], [2, 3, 4]);
});

test('builds album and track credits, treating unroled main artists as performers', () => {
  const release = {
    artists: [
      { id: 1, name: 'Antonio Mazzoni', role: '' },
      { id: 2, name: 'Anna Maria Panzarella', role: '' }
    ],
    extraartists: [
      { id: 1, name: 'Antonio Mazzoni', role: 'Composed By', tracks: '' },
      { id: 3, name: 'Some Engineer', role: 'Recorded By', tracks: '' },
      { id: 4, name: 'Harpsichordist (2)', role: 'Harpsichord', tracks: '1-2' }
    ]
  };
  const items = service.flattenTracklist({
    tracklist: [
      { type_: 'track', title: 'One', position: '1-1' },
      { type_: 'track', title: 'Two', position: '1-2' }
    ]
  });
  const index = { exact: new Map([['Antonio Mazzoni', { ratingKey: 'a1', title: 'Antonio Mazzoni' }]]), normalized: new Map() };

  const credits = service.buildCredits(release, items, index);
  const summary = credits.map(c => `${c.source}:${c.artistName}:${c.artistTypeName}:${c.discogsOrdinal ?? ''}`);

  assert.deepEqual(summary.sort(), [
    'album:Anna Maria Panzarella:Performer:',
    'album:Antonio Mazzoni:Composer:',
    'track:Harpsichordist:Harpsichord:2'
  ]);
  assert.equal(credits.find(c => c.artistName === 'Antonio Mazzoni').matchedExisting, true);
});

test('matches local tracks using disc/track numbers embedded in titles', () => {
  const items = service.flattenTracklist({
    tracklist: [
      { type_: 'track', title: 'Sinfonia', position: '1-1' },
      { type_: 'track', title: 'Andantino', position: '1-2' },
      { type_: 'track', title: 'Or Per La Tamiri', position: '2-1' },
      { type_: 'track', title: 'Se Vincendo Vi Rendo Felici', position: '2-2' }
    ]
  });
  const localTracks = [
    { ratingKey: 'l1', title: 'Disc 1 - (01)  SINFONIA', index: 1, discNumber: 1 },
    { ratingKey: 'l2', title: 'Aminta - Disc 2 - (02)  Se vincendo Vi rendo felici', index: null, discNumber: 1 }
  ];

  const mappings = service.matchTracks(items, localTracks);

  assert.deepEqual(mappings.map(m => m.localTrackKey), ['l1', null, null, 'l2']);
});
