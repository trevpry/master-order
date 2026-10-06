const cheerio = require('cheerio');

const BASE_URL = 'https://www.bongiovanni70.it';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const cleanText = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const productHandle = (value) => {
  const text = String(value || '').trim();
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(text)) return text;
  try {
    const url = new URL(text);
    if (url.protocol !== 'https:' || !['www.bongiovanni70.it', 'bongiovanni70.it'].includes(url.hostname) || url.port) return null;
    return url.pathname.match(/^\/products\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/)?.[1] || null;
  } catch {
    return null;
  }
};

const absoluteImage = (value) => {
  if (!value) return null;
  const url = new URL(value, BASE_URL);
  return url.protocol === 'https:' ? url.href : null;
};

const splitTitle = (value) => {
  const title = cleanText(value);
  const match = title.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
  return { title, composer: match ? match[1] : null, work: match ? match[2] : null };
};

const parseProduct = (product, handle, tracks = []) => {
  const $ = cheerio.load(product.description || product.body_html || '');
  const paragraphs = $('.product-single__description').length
    ? $('.product-single__description').first().find('p')
    : $('p');
  const { title, composer, work } = splitTitle(paragraphs.first().text() || product.title);
  const artistParagraph = paragraphs.eq(1).clone();
  artistParagraph.find('a, script, style').remove();
  artistParagraph.find('br').replaceWith(' ');
  const performers = [...new Set(artistParagraph.text().split(',').map(cleanText).filter(Boolean))];
  const credit = (name, role) => ({ name, role, anv: '', join: '', tracks: '', id: null });
  const variant = product.variants?.[0];
  const images = (product.images || []).map(image => absoluteImage(typeof image === 'string' ? image : image.src)).filter(Boolean);

  return {
    id: handle,
    title: title || handle,
    uri: `${BASE_URL}/products/${handle}`,
    year: null,
    released: null,
    country: null,
    format_quantity: null,
    labels: [{ name: cleanText(product.vendor) || 'Bongiovanni', catno: variant?.sku || '' }],
    identifiers: variant?.barcode ? [{ type: 'Barcode', value: variant.barcode }] : [],
    artists: composer ? [credit(composer, '')] : [],
    extraartists: [
      ...(composer ? [credit(composer, 'Composed By')] : []),
      ...performers.map(name => credit(name, 'Performer'))
    ],
    tracklist: work ? [{
      type_: 'index',
      title: work,
      position: '',
      sub_tracks: tracks.map(track => ({
        type_: 'track',
        position: `${track.discNumber || 1}-${track.index}`,
        title: track.title,
        duration: ''
      }))
    }] : [],
    images: images.map((uri, index) => ({ type: index === 0 ? 'primary' : 'secondary', uri, uri150: uri, width: null, height: null }))
  };
};

const parseSearchResults = (products) => {
  const results = new Map();
  for (const product of products || []) {
    const handle = productHandle(product.url ? new URL(product.url, BASE_URL).href : product.handle);
    if (!handle || results.has(handle)) continue;
    const { title, composer, work } = splitTitle(product.title);
    results.set(handle, {
      id: handle,
      releaseTitles: [...new Set([title, work].filter(Boolean))],
      releaseArtist: composer,
      releaseArtistNames: composer ? [composer] : [],
      year: null,
      country: null,
      label: cleanText(product.vendor) || 'Bongiovanni',
      catno: null,
      format: product.type || null,
      formatQuantity: null,
      thumb: absoluteImage(product.featured_image?.url || product.image),
      url: `${BASE_URL}/products/${handle}`
    });
  }
  return [...results.values()];
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!response.ok) {
    const error = new Error(`Bongiovanni request failed (${response.status})`);
    if (response.status === 404) error.statusCode = 404;
    throw error;
  }
  return response.json();
};

const createBongiovanniSource = () => ({
  key: 'bongiovanni',
  label: 'Bongiovanni',
  userAgent: USER_AGENT,
  isValidReleaseId: (value) => Boolean(productHandle(value)),
  getRelease: async (releaseId, { album } = {}) => {
    const handle = productHandle(releaseId);
    if (!handle) throw new Error('Invalid Bongiovanni product URL or handle');
    const product = await fetchJson(`${BASE_URL}/products/${handle}.js`);
    return parseProduct(product, handle, album?.tracks || []);
  },
  buildSearches: ({ query, albumTitle, titleSegments, primarySurname, keyWords }) => (query
    ? [query]
    : [...new Set([
        ...titleSegments.map(segment => [keyWords(segment), primarySurname].filter(Boolean).join(' ')),
        keyWords(albumTitle)
      ].filter(Boolean))]),
  search: async (keywords) => {
    const handle = productHandle(keywords);
    if (handle && String(keywords).startsWith('https://')) {
      const product = await fetchJson(`${BASE_URL}/products/${handle}.js`);
      return parseSearchResults([{ ...product, handle }]);
    }
    const params = new URLSearchParams({ q: String(keywords).trim(), 'resources[type]': 'product', 'resources[limit]': '10' });
    const data = await fetchJson(`${BASE_URL}/search/suggest.json?${params}`);
    return parseSearchResults(data.resources?.results?.products || []);
  }
});

module.exports = { createBongiovanniSource, parseProduct, parseSearchResults, productHandle };