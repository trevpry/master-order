const test = require('node:test');
const assert = require('node:assert/strict');

const { parseSearchResults, parseCatalogueDetail, parsePerformers, stripComposerPrefix, naturalName } = require('../services/publishers/naxosSource');

const searchHtml = `
<div id="page_detail_1" class="row"><div class="col-md-12">
<div class="row" style="padding-top:20px; border-bottom:1px solid #dadada;">
  <a href="/CatalogueDetail/?id=CDS533"><img data-src="https://cdn.naxos.com/sharedfiles/images/cds/hires/cds533.jpg" data-img-orig="https://cdn.naxos.com/sharedfiles/images/cds/hires/cds533.jpg"></a>
  <table>
    <tr><td colspan="2"><a href="/CatalogueDetail/?id=CDS533" class="link-title" >MEYERBEER: Semiramide riconosciuta</a></td></tr>
    <tr><td style="width:100px;">Categories</td> <td style="padding-top:6px;">Opera</td></tr>
    <tr><td style="width:100px;">Composers</td> <td style="padding-top:6px;">Meyerbeer, Giacomo</td></tr>
    <tr><td style="width:100px;">Artists</td> <td style="padding-top:6px;">Tufano, Eufemia -- Calderon, Rani -- Orchestra Internazionale d&#39;Italia</td></tr>
  </table>
</div>
<div class="row" style="padding-top:20px; border-bottom:1px solid #dadada;">
  <a href="/CatalogueDetail/?id=CDS533"></a><a href="/CatalogueDetail/?id=CDS533" class="link-title" >MEYERBEER: Semiramide riconosciuta</a>
</div>
</div></div>`;

const detailHtml = `
<a href="https://cdn.naxos.com/sharedfiles/images/cds/hires/CDS533.jpg" data-lightbox="image-1"></a>
<div class="mb-1">Composer(s): <span><a href="/Bio/Person/x" class="sidebar-link">Meyerbeer, Giacomo</a></span></div>
<div class="mb-1">Lyricist(s): <span><a href="/Bio/Person/y" class="sidebar-link">Rossi, Gaetano</a></span></div>
<div class="mb-1">Conductor(s): <span><a href="/Bio/Person/z" class="sidebar-link">Calderon, Rani</a></span></div>
<div class="mb-1">Orchestra(s): <span><a href="/Bio/O/1" class="sidebar-link">Orchestra Internazionale d'Italia</a></span></div>
<div class="mb-1">Artist(s): <span><a href="/Bio/Person/a" class="sidebar-link">Caputo, Aldo</a>; <a href="/Bio/Person/b" class="sidebar-link">Polito, Clara</a></span></div>
<div class="mb-1">Label: <span>Dynamic</span></div>
<div class="mb-1">Catalogue No: <span>CDS533</span></div>
<div class="mb-1">Barcode: <span>8007144605339</span></div>
<div class="mb-1">Release Date: <span>01/2007</span></div>
<h3 id="album-title" class="text-normal">MEYERBEER: Semiramide riconosciuta</h3>
<div id="all-tracks-wrap">
  <div style="font-size: 16px;">Disc 1</div>
  <div class="track-composer"><strong>Meyerbeer, Giacomo</strong><br>Rossi, Gaetano - Lyricist</div>
  <div class="card-header3 shadow-none"><label><strong>Semiramide riconosciuta</strong></label></div>
  <div class="card-body mb-2"><strong>Caputo, Aldo</strong> (tenor) <br><strong>Polito, Clara</strong> (soprano) <br></div>
  <table><tr><td class="number-track" valign="top">1</td>
  <td style="color:#003d78;" valign="top">Sinfonia</td>
  <td style="width:50px;" class="track-num" valign="top" align="right">07:37</td></tr></table>
  <table><tr><td class="number-track" valign="top">2</td>
  <td style="color:#003d78;" valign="top">Act I Scene 1: Dall&#39;Olimpio a noi scendete</td>
  <td style="width:50px;" class="track-num" valign="top" align="right">03:52</td></tr></table>
  <div style="font-size: 16px;">Disc 2</div>
  <table><tr><td class="number-track" valign="top">1</td>
  <td style="color:#003d78;" valign="top">Act I Scene 12: Mora l&#39;indo audace!</td>
  <td style="width:50px;" class="track-num" valign="top" align="right">05:32</td></tr></table>
</div>`;

test('normalizes Naxos names and titles', () => {
  assert.equal(naturalName('Calderon, Rani'), 'Rani Calderon');
  assert.equal(naturalName("Orchestra Internazionale d'Italia"), "Orchestra Internazionale d'Italia");
  assert.equal(stripComposerPrefix('MEYERBEER: Semiramide riconosciuta'), 'Semiramide riconosciuta');
  assert.equal(stripComposerPrefix('MEYERBEER, G.: Semiramide [Opera]'), 'Semiramide [Opera]');
});

test('parses Naxos search results without duplicates', () => {
  const results = parseSearchResults(searchHtml);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'CDS533');
  assert.deepEqual(results[0].releaseTitles, ['MEYERBEER: Semiramide riconosciuta', 'Semiramide riconosciuta']);
  assert.deepEqual(results[0].releaseArtistNames, ['Giacomo Meyerbeer', 'Eufemia Tufano', 'Rani Calderon', "Orchestra Internazionale d'Italia"]);
  assert.equal(results[0].url, 'https://www.naxos.com/CatalogueDetail/?id=CDS533');
});

test('parses per-track performer lists', () => {
  assert.deepEqual(
    parsePerformers("<strong>Caputo, Aldo</strong> (tenor) <br>Orchestra Internazionale d&#39;Italia (Orchestra) <br>Calderon, Rani (Conductor) "),
    [
      { name: 'Caputo, Aldo', role: 'tenor' },
      { name: "Orchestra Internazionale d'Italia", role: 'Orchestra' },
      { name: 'Calderon, Rani', role: 'Conductor' }
    ]
  );
});

test('credits performers only on the tracks they appear on', () => {
  const html = `
<div class="mb-1">Composer(s): <span><a class="sidebar-link">Meyerbeer, Giacomo</a></span></div>
<div class="mb-1">Conductor(s): <span><a class="sidebar-link">Calderon, Rani</a></span></div>
<div class="mb-1">Artist(s): <span><a class="sidebar-link">Tufano, Eufemia</a>; <a class="sidebar-link">Polito, Clara</a></span></div>
<h3 id="album-title">MEYERBEER: Semiramide riconosciuta</h3>
<div id="all-tracks-wrap">
  <div class="card-header3 shadow-none"><label><strong>Semiramide riconosciuta</strong></label></div>
  <div class="collapse all-tracks"><div class="card-body mb-2"><strong>Tufano, Eufemia</strong> (mezzo-soprano) <br><strong>Polito, Clara</strong> (soprano) <br><strong>Calderon, Rani</strong> (Conductor) </div></div>
  <table><tr><td class="number-track" valign="top">7</td>
  <td valign="top">Act I Scene 5: Sperai su questa sponda (Scitalce)</td>
  <td class="track-num" valign="top">05:33</td></tr></table>
  <div class="collapse all-tracks"><div class="card-body mb-2"> Tufano, Eufemia (mezzo-soprano) <br>Calderon, Rani (Conductor) </div></div>
  <table><tr><td class="number-track" valign="top">8</td>
  <td valign="top">Act I Scene 5: Amico in rivederti</td>
  <td class="track-num" valign="top">03:12</td></tr></table>
  <div class="collapse all-tracks"><div class="card-body mb-2"> Polito, Clara (soprano) <br>Tufano, Eufemia (mezzo-soprano) <br>Calderon, Rani (Conductor) </div></div>
</div>`;

  const release = parseCatalogueDetail(html, 'CDS533');
  const tracks = release.tracklist[0].sub_tracks;

  // On every track -> album credit; sidebar artists are no longer applied to all tracks.
  assert.deepEqual(release.extraartists.map(a => `${a.name}/${a.role}`), [
    'Giacomo Meyerbeer/Composed By',
    'Eufemia Tufano/mezzo-soprano',
    'Rani Calderon/Conductor'
  ]);
  assert.equal(tracks[0].extraartists, undefined);
  assert.deepEqual(tracks[1].extraartists.map(a => `${a.name}/${a.role}`), ['Clara Polito/soprano']);
  assert.equal(tracks.some(track => 'performers' in track), false);
});

test('parses a Naxos catalogue page into a Discogs-shaped release', () => {
  const release = parseCatalogueDetail(detailHtml, 'CDS533');

  assert.equal(release.title, 'MEYERBEER: Semiramide riconosciuta');
  assert.equal(release.year, 2007);
  assert.equal(release.released, '2007-01');
  assert.equal(release.format_quantity, 2);
  assert.deepEqual(release.labels, [{ name: 'Dynamic', catno: 'CDS533' }]);
  assert.deepEqual(release.identifiers, [{ type: 'Barcode', value: '8007144605339' }]);
  assert.deepEqual(release.images.map(image => image.uri), ['https://cdn.naxos.com/sharedfiles/images/cds/hires/CDS533.jpg']);
  assert.deepEqual(release.extraartists.map(a => `${a.name}/${a.role}`), [
    'Giacomo Meyerbeer/Composed By',
    'Gaetano Rossi/Lyrics By',
    'Rani Calderon/Conductor',
    "Orchestra Internazionale d'Italia/Orchestra",
    'Aldo Caputo/tenor',
    'Clara Polito/soprano'
  ]);

  assert.equal(release.tracklist.length, 1);
  const work = release.tracklist[0];
  assert.equal(work.type_, 'index');
  assert.equal(work.title, 'Semiramide riconosciuta');
  assert.deepEqual(work.sub_tracks.map(t => `${t.position}|${t.title}|${t.duration}`), [
    '1-1|Sinfonia|07:37',
    "1-2|Act I Scene 1: Dall'Olimpio a noi scendete|03:52",
    "2-1|Act I Scene 12: Mora l'indo audace!|05:32"
  ]);
});
