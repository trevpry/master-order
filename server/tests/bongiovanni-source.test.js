const test = require('node:test');
const assert = require('node:assert/strict');
const { createBongiovanniSource, parseProduct, parseSearchResults, productHandle } = require('../services/publishers/bongiovanniSource');
const { listPublishers, getPublisher } = require('../services/publishers');

const product = {
  title: 'MORLACCHI - Il barbiere di Siviglia',
  vendor: 'Bongiovanni',
  description: `<div class="product-single__description rte">
    <p><strong>FRANCESCO MORLACCHI - IL BARBIERE DI SIVIGLIA</strong>&nbsp;<br></p>
    <p><b>Alessandra Ruffini, Maurizio Comencini, Giorgio Gatti, Romano Franceschetto, Aurio Tomicich, Gabriele Catalucci<br><br>
    <a href="https://cdn.shopify.com/libretto.pdf"><strong>SCARICA IL LIBRETTO</strong></a><br></b></p>
  </div>`,
  images: ['//cdn.shopify.com/cover.jpg'],
  variants: [{ sku: 'GB 2085/86', barcode: '123456' }]
};

test('registers Bongiovanni as a publisher', () => {
  assert.ok(listPublishers().some(publisher => publisher.key === 'bongiovanni'));
  assert.equal(getPublisher('Bongiovanni').createSource().key, 'bongiovanni');
});

test('parses the composer, work and six artists without booklet link text', () => {
  const release = parseProduct(product, 'morlacchi-il-barbiere-di-siviglia', [
    { title: 'Sinfonia', index: 1, discNumber: 1 },
    { title: 'Finale', index: 1, discNumber: 2 }
  ]);
  assert.equal(release.title, 'FRANCESCO MORLACCHI - IL BARBIERE DI SIVIGLIA');
  assert.deepEqual(release.extraartists.map(artist => [artist.name, artist.role]), [
    ['FRANCESCO MORLACCHI', 'Composed By'],
    ['Alessandra Ruffini', 'Performer'],
    ['Maurizio Comencini', 'Performer'],
    ['Giorgio Gatti', 'Performer'],
    ['Romano Franceschetto', 'Performer'],
    ['Aurio Tomicich', 'Performer'],
    ['Gabriele Catalucci', 'Performer']
  ]);
  assert.equal(release.tracklist[0].title, 'IL BARBIERE DI SIVIGLIA');
  assert.deepEqual(release.tracklist[0].sub_tracks.map(track => [track.position, track.title]), [['1-1', 'Sinfonia'], ['2-1', 'Finale']]);
  assert.deepEqual(release.labels, [{ name: 'Bongiovanni', catno: 'GB 2085/86' }]);
  assert.equal(release.images[0].uri, 'https://cdn.shopify.com/cover.jpg');
  assert.deepEqual(release.identifiers, [{ type: 'Barcode', value: '123456' }]);
});

test('handles Shopify description fragments, missing fields and hyphenated composer names', () => {
  const release = parseProduct({ description: '<p>JEAN-PHILIPPE RAMEAU - A Work - Subtitle</p><p>A &amp; B, A &amp; B</p>' }, 'album');
  assert.equal(release.extraartists[0].name, 'JEAN-PHILIPPE RAMEAU');
  assert.equal(release.tracklist[0].title, 'A Work - Subtitle');
  assert.equal(release.extraartists.length, 2);
  assert.deepEqual(release.images, []);
  assert.deepEqual(parseProduct({ title: 'Recital' }, 'recital').tracklist, []);
});

test('validates product handles and confines product URLs to Bongiovanni', () => {
  assert.equal(productHandle('https://www.bongiovanni70.it/products/album?_pos=3'), 'album');
  assert.equal(productHandle('album'), 'album');
  for (const invalid of ['https://example.com/products/album', 'http://www.bongiovanni70.it/products/album', '../album', 'https://www.bongiovanni70.it:999/products/album']) {
    assert.equal(productHandle(invalid), null);
  }
});

test('normalizes and deduplicates Shopify search results', () => {
  const entry = { title: product.title, url: '/products/morlacchi-il-barbiere-di-siviglia?_pos=3', image: '//cdn.shopify.com/cover.jpg' };
  const results = parseSearchResults([entry, entry]);
  assert.equal(results.length, 1);
  assert.deepEqual(results[0].releaseTitles, [product.title, 'Il barbiere di Siviglia']);
  assert.deepEqual(results[0].releaseArtistNames, ['MORLACCHI']);
  assert.equal(results[0].thumb, 'https://cdn.shopify.com/cover.jpg');
});

test('fetches product metadata with local album tracks and supports searching by URL', async (context) => {
  const requests = [];
  context.mock.method(global, 'fetch', async (url) => {
    requests.push(url);
    return { ok: true, json: async () => url.includes('suggest.json') ? { resources: { results: { products: [{ ...product, handle: 'album' }] } } } : product };
  });
  const source = createBongiovanniSource();
  const release = await source.getRelease('album', { album: { tracks: [{ title: 'Sinfonia', index: 1 }] } });
  assert.equal(release.tracklist[0].sub_tracks[0].title, 'Sinfonia');
  assert.equal((await source.search('https://www.bongiovanni70.it/products/album?test=1'))[0].id, 'album');
  assert.equal((await source.search('Morlacchi'))[0].id, 'album');
  assert.ok(requests[2].includes('resources%5Btype%5D=product'));
  await assert.rejects(source.getRelease('https://example.com/products/album'), /Invalid Bongiovanni/);
});