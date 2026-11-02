const test = require('node:test');
const assert = require('node:assert');

const { parseAebnMoviePage, parseAebnDuration, parseClockToSeconds } = require('../services/scrapers/AebnScraper');
const GeviScraperService = require('../services/geviScraperService');

const fixture = `
<html><head><title>13 Deutsche Bareback-Jungs | Gay | AEBN</title></head><body>
<div class="dts-section-page-heading-title"><h1>13 Deutsche Bareback-Jungs</h1></div>
<section class="dts-section-page-detail dts-section-page-detail-movie">
  <div class="dts-section-page-detail-main-image-wrapper">
    <img src="//pic.aebn.net/dis/i/Stream/Movie/BoxCovers/a174626_xlf.jpg?s=293w">
  </div>
  <div class="dts-section-page-detail-info dts-section-page-detail-info-movie">
    <ul class="section-detail-list">
      <li class="section-detail-list-item-studio"><span class="section-detail-list-item-title">Studio:</span> <a href="/gay/studios/1/foerster-media">Foerster Media</a></li>
      <li class="section-detail-list-item-release-date"><span class="section-detail-list-item-title">Released:</span> Jan 05, 2021</li>
      <li class="section-detail-list-item-director"><span class="section-detail-list-item-title">Director:</span> <a href="/gay/directors/1">Hans Foerster</a></li>
      <li class="section-detail-list-item-duration"><span class="section-detail-list-item-title">Quality:</span> SD-480p</li>
      <li class="section-detail-list-item-duration"><span class="section-detail-list-item-title">Running Time:</span> 01:29:57</li>
    </ul>
  </div>
  <div class="dts-section-page-detail-description">
    <div class="dts-section-page-detail-description-header">Description:</div>
    <div class="dts-section-page-detail-description-body">
      Check out the latest from Foerster Media!
    </div>
  </div>
</section>
<img class="dts-modal-boxcover-back" src="//pic.aebn.net/Stream/Movie/BoxCovers/a174626_xlb.jpg">
<section id="scene-1001">
  <div class="dts-panel-header-title"><h1><span class="dts-panel-header-title-no-link">Scene 1</span>
    <span class="dts-scene-title-metadata"><span>16:13 (SD-480p)</span></span></h1></div>
  <a class="dts-movie-star-wrapper dts-text-link" href="/gay/stars/1"><span>Max Mustermann</span></a>
  <div class="scene-strip-meta-data">
    <div><span class="section-detail-list-item-title">Sex acts:</span> <a class="dts-text-link">Anal Sex</a> <a class="dts-text-link">Rim Job</a></div>
    <div><span class="section-detail-list-item-title">Settings:</span> <a class="dts-text-link">Living Room</a></div>
  </div>
</section>
<section id="scene-1002">
  <div class="dts-panel-header-title"><h1><span class="dts-panel-header-title-no-link">Scene 2</span>
    <span class="dts-scene-title-metadata"><span>11:27 (SD-480p)</span></span></h1></div>
</section>
</body></html>`;

test('parseClockToSeconds handles mm:ss and hh:mm:ss', () => {
  assert.strictEqual(parseClockToSeconds('16:13'), 973);
  assert.strictEqual(parseClockToSeconds('01:29:57'), 5397);
  assert.strictEqual(parseClockToSeconds('n/a'), null);
});

test('parseAebnDuration splits the length from the quality label', () => {
  assert.deepStrictEqual(parseAebnDuration(' 16:13 (SD-480p) '), {
    duration: '16:13',
    durationSeconds: 973,
    quality: 'SD-480p'
  });
  assert.deepStrictEqual(parseAebnDuration(''), { duration: null, durationSeconds: null, quality: null });
});

test('parseAebnMoviePage extracts movie metadata and the scene list with lengths', () => {
  const page = parseAebnMoviePage(fixture);

  assert.strictEqual(page.movieTitle, '13 Deutsche Bareback-Jungs');
  assert.strictEqual(page.studioName, 'Foerster Media');
  assert.strictEqual(page.releaseDate, '2021-01-05');
  assert.strictEqual(page.director, 'Hans Foerster');
  assert.strictEqual(page.synopsis, 'Check out the latest from Foerster Media!');
  assert.strictEqual(page.fixedMovieImage, 'https://pic.aebn.net/dis/i/Stream/Movie/BoxCovers/a174626_xlf.jpg');
  assert.strictEqual(page.backImage, 'https://pic.aebn.net/Stream/Movie/BoxCovers/a174626_xlb.jpg');
  assert.strictEqual(page.runningTimeSeconds, 5397);
  assert.strictEqual(page.quality, 'SD-480p');

  assert.strictEqual(page.scenes.length, 2);
  const [first, second] = page.scenes;
  assert.strictEqual(first.number, 1);
  assert.strictEqual(first.title, 'Scene 1');
  assert.strictEqual(first.duration, '16:13');
  assert.strictEqual(first.durationSeconds, 973);
  assert.strictEqual(first.quality, 'SD-480p');
  assert.deepStrictEqual(first.performers, ['Max Mustermann']);
  assert.deepStrictEqual(first.sexActs, ['Anal Sex', 'Rim Job']);
  assert.deepStrictEqual(first.settings, ['Living Room']);
  assert.strictEqual(second.number, 2);
  assert.strictEqual(second.durationSeconds, 687);
  assert.deepStrictEqual(second.performers, []);
});

test('matchMovieScenes matches scenes without performers by length', async () => {
  const service = new GeviScraperService();
  const originalLog = console.log;
  console.log = () => {};
  try {
    const movieScenes = [
      { sceneNumber: 1, title: 'Scene 1', durationSeconds: 973, performers: [], tags: [] },
      { sceneNumber: 2, title: 'Scene 2', durationSeconds: 687, performers: [], tags: [] },
      { sceneNumber: 3, title: 'Scene 3', durationSeconds: 728, performers: [], tags: [] }
    ];
    // Stored out of order (no sceneIndex) - length should still pick the right scenes
    const dbScenes = [
      { id: 'a', title: 'clip-a', duration: 688.4, performers: [], groups: [{ sceneIndex: null }] },
      { id: 'b', title: 'clip-b', duration: 972.9, performers: [], groups: [{ sceneIndex: null }] }
    ];
    const matches = await service.matchMovieScenes(movieScenes, dbScenes);
    const byId = Object.fromEntries(matches.map(m => [m.sceneId, m]));
    assert.strictEqual(byId.a.sceneNumber, 2);
    assert.strictEqual(byId.a.matchMethod, 'duration');
    assert.strictEqual(byId.b.sceneNumber, 1);
  } finally {
    console.log = originalLog;
  }
});
