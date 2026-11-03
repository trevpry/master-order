const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseMovieSearchTitle,
  titleSimilarity,
  rankMovieCandidates,
  buildGeviMovieResult,
  buildAebnMovieResult,
  searchMoviesByTitle,
  isTitleOnlyScene
} = require('../services/sceneTitleMovieSearchService');
const { parseAebnSearchResults } = require('../services/scrapers/AebnScraper');

test('parseMovieSearchTitle strips file noise and splits a trailing scene number', () => {
  assert.deepEqual(parseMovieSearchTitle('13_Deutsche_Bareback-Jungs - Scene 3.mp4'), { query: '13 Deutsche Bareback-Jungs', sceneNumber: 3 });
  assert.deepEqual(parseMovieSearchTitle('Fuck U Part 2 (2004)'), { query: 'Fuck U Part 2', sceneNumber: null });
  assert.deepEqual(parseMovieSearchTitle('Hot.Movie.Sc4.wmv'), { query: 'Hot Movie', sceneNumber: 4 });
  assert.deepEqual(parseMovieSearchTitle('  '), { query: '', sceneNumber: null });
});

test('titleSimilarity rewards exact titles and penalises different volume numbers', () => {
  assert.equal(titleSimilarity('Bareback Castings 13', 'bareback castings 13'), 1);
  assert.equal(titleSimilarity('Bare Back Castings', 'Bareback Castings'), 0.98);
  assert.ok(titleSimilarity('Bareback Castings 13', 'Bareback Castings 13: Hardball') > 0.8);
  assert.ok(titleSimilarity('Bareback Castings 13', 'Bareback Castings 3') < 0.5);
  assert.ok(titleSimilarity('Bareback Castings 13', 'Bareback Castings') < 0.6);
});

test('rankMovieCandidates dedupes, filters and orders by score', () => {
  const ranked = rankMovieCandidates('Bareback Castings 13', [
    { url: 'a', title: 'Bareback Castings 3' },
    { url: 'b', title: 'Bareback Castings 13: Hardball' },
    { url: 'b', name: 'Bareback Castings 13: Hardball' },
    { url: 'c', name: 'Bareback Castings 13' },
    { url: 'd', title: 'Unrelated' }
  ]);
  assert.deepEqual(ranked.map(r => r.url), ['c', 'b']);
});

test('buildGeviMovieResult narrows to the requested scene', () => {
  const movie = {
    url: 'https://gevi/m/1',
    name: 'Movie',
    date: '2004-01-01',
    studio: { name: 'Studio' },
    front_image: 'https://img/1.jpg',
    synopsis: 'Synopsis',
    scenes: [
      { sceneNumber: 1, performers: [{ name: 'A' }, { name: 'B' }], episodeUrl: 'https://gevi/e/1' },
      { sceneNumber: 2, performers: [{ name: 'B' }, { name: 'C' }], details: 'Scene two', episodeUrl: 'https://gevi/e/2' }
    ]
  };
  const whole = buildGeviMovieResult(movie, { score: 1, proxyImage: (u) => `proxy:${u}` });
  assert.equal(whole.title, 'Movie');
  assert.equal(whole.studio, 'Studio');
  assert.equal(whole.image, 'proxy:https://img/1.jpg');
  assert.deepEqual(whole.performers.map(p => p.name), ['A', 'B', 'C']);
  assert.equal(whole.scenes.length, 2);

  const scene = buildGeviMovieResult(movie, { score: 1, sceneNumber: 2 });
  assert.equal(scene.title, 'Movie - Scene 2');
  assert.equal(scene.details, 'Scene two');
  assert.deepEqual(scene.performers.map(p => p.name), ['B', 'C']);
  assert.deepEqual(scene.urls, ['https://gevi/m/1', 'https://gevi/e/2']);
  assert.equal(scene.movies[0].sceneNumber, 2);
});

test('buildAebnMovieResult unions scene tags for whole movies', () => {
  const result = buildAebnMovieResult({
    title: 'Movie',
    studio: 'Studio',
    performers: [{ name: 'A' }],
    tags: [],
    movies: [{ name: 'Movie', url: 'u' }],
    allScenes: [{ tags: [{ name: 'Tag1' }] }, { tags: [{ name: 'tag1' }, { name: 'Tag2' }] }]
  }, 'https://aebn/movie', { score: 0.9, image: 'https://img' });
  assert.deepEqual(result.tags, ['Tag1', 'Tag2']);
  assert.equal(result.image, 'https://img');
  assert.equal(result.source, 'AEBN');
  assert.equal(result.sceneNumber, null);
});

test('searchMoviesByTitle returns GEVI and AEBN sources and falls back to the whole AEBN movie', async () => {
  const aebnCalls = [];
  const out = await searchMoviesByTitle('My Movie - Scene 5', {
    searchGevi: async () => [{ name: 'My Movie', url: 'https://gevi/m/1' }, { name: 'Other', url: 'https://gevi/m/2' }],
    scrapeGevi: async (url) => ({ url, name: 'My Movie', scenes: [{ sceneNumber: 5, performers: [{ name: 'P' }] }] }),
    searchAebn: async () => [{ title: 'My Movie', url: 'https://aebn/movies/1/my-movie', image: 'img' }],
    scrapeAebn: async (url, sceneNumber) => {
      aebnCalls.push(sceneNumber);
      if (sceneNumber) throw new Error('Scene 5 not found');
      return { success: true, scraped: { title: 'My Movie', performers: [], movies: [{ name: 'My Movie', url }], allScenes: [] } };
    },
    matchPerformers: async (list) => ({ matched: [], unmatched: list }),
    matchGroups: async (movies) => ({ matched: [{ id: 'g1', name: movies[0].name }], unmatched: [] })
  });

  assert.equal(out.query, 'My Movie');
  assert.equal(out.sceneNumber, 5);
  assert.deepEqual(out.sources.map(s => s.endpoint), ['gevi-title-search', 'aebn-title-search']);
  const [gevi, aebn] = out.sources;
  assert.equal(gevi.resultCount, 1);
  assert.equal(gevi.results[0].title, 'My Movie - Scene 5');
  assert.equal(gevi.results[0].matched.groups[0].id, 'g1');
  assert.deepEqual(gevi.results[0].unmatched.performers, [{ name: 'P' }]);
  assert.deepEqual(aebnCalls, [5, null]);
  assert.equal(aebn.resultCount, 1);
  assert.equal(aebn.results[0].url, 'https://aebn/movies/1/my-movie');
});

test('searchMoviesByTitle survives a failing source', async () => {
  const out = await searchMoviesByTitle('My Movie', {
    searchGevi: async () => { throw new Error('down'); },
    scrapeGevi: async () => null,
    searchAebn: async () => [],
    scrapeAebn: async () => null
  });
  assert.deepEqual(out.sources.map(s => s.resultCount), [0, 0]);
});

test('parseGeviMovieTableRows reads GEVI movie search rows', () => {
  const { parseGeviMovieTableRows } = require('../services/geviScraperService');
  const payload = { draw: 1, data: [
    [0, "<a href='/video/50215'>13 Deutsche Bareback-Jungs</a>", '2014', "<a href='company/6066'>FoersterMedia</a>", null, 'Compilation', '', 'General Hardcore'],
    [0, "<a href='/video/50215'>13 Deutsche Bareback-Jungs</a>", '2014', '', null, '', '', ''],
    [0, 'no link', '', '', null, '', '', '']
  ] };
  assert.deepEqual(parseGeviMovieTableRows(JSON.stringify(payload)), [
    { name: '13 Deutsche Bareback-Jungs', url: 'https://gayeroticvideoindex.com/video/50215', year: '2014', studio: 'FoersterMedia', type: 'Compilation' }
  ]);
});

test('searchMoviesByTitle retries GEVI with looser queries', async () => {
  const queries = [];
  await searchMoviesByTitle('Big Movie: The Return Part', {
    searchGevi: async (q) => { queries.push(q); return []; },
    scrapeGevi: async () => null,
    searchAebn: async () => [],
    scrapeAebn: async () => null
  });
  assert.deepEqual(queries, ['Big Movie: The Return Part', 'Big Movie The Return Part', 'Big Movie The']);
});

test('isTitleOnlyScene requires a title and nothing else', () => {
  assert.equal(isTitleOnlyScene({ title: 'X' }), true);
  assert.equal(isTitleOnlyScene({ title: 'X', performerCount: 1 }), false);
  assert.equal(isTitleOnlyScene({ title: 'X', urlCount: 1 }), false);
  assert.equal(isTitleOnlyScene({ title: ' ' }), false);
});

test('parseAebnSearchResults reads movie hits in order and strips scene prefixes', () => {
  const html = `
    <div class="dts-collection-item dts-collection-item-movie" data-item-id="317993">
      <h2><span>Scene 10, Bareback Castings 13: Hardball</span></h2>
      <a href="/gay/movies/317993/bareback-castings-13--hardball#scene-123">Bareback Castings 13: HardballScene 10</a>
    </div>
    <div class="dts-collection-item dts-collection-item-movie" data-item-id="252272">
      <h2><span>Bareback Castings 3</span></h2>
      <a href="/gay/movies/252272/bareback-castings-3"><img src="//pic.aebn.net/a252272_xlf.jpg?s=430h" title="Bareback Castings 3" alt="Gay Adult Movie Bareback Castings 3"></a>
      <a href="/gay/movies/252272/bareback-castings-3?x=1">Bareback Castings 3</a>
    </div>
    <a href="/gay/stars/1/someone">Someone</a>`;
  assert.deepEqual(parseAebnSearchResults(html), [
    { url: 'https://gay.aebn.com/gay/movies/317993/bareback-castings-13--hardball', title: 'Bareback Castings 13: Hardball', image: null },
    { url: 'https://gay.aebn.com/gay/movies/252272/bareback-castings-3', title: 'Bareback Castings 3', image: 'https://pic.aebn.net/a252272_xlf.jpg?s=430h' }
  ]);
});
