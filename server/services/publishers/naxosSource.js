// Naxos Music Library catalogue (naxos.com) as a release source for the album import pipeline.

const BASE_URL = 'https://www.naxos.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const CATALOGUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.\-_]{0,40}$/;

const decodeEntities = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number.parseInt(dec, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));

const stripTags = (html = '') => decodeEntities(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
  .replace(/[ \t]+/g, ' ')
  .trim();

// Naxos lists people as "Calderon, Rani"; ensembles have no comma.
const naturalName = (name) => {
  const text = String(name || '').trim();
  const parts = text.split(',');
  return parts.length === 2 && parts[1].trim() ? `${parts[1].trim()} ${parts[0].trim()}` : text;
};

// "MEYERBEER: Semiramide riconosciuta" / "MEYERBEER, G.: Semiramide [Opera] (...)" -> "Semiramide riconosciuta"
const stripComposerPrefix = (title) => {
  const match = String(title || '').match(/^[A-ZÀ-Ý][A-ZÀ-Ý.,'\-\s/]+(?:,\s*[A-Z][\w.\s-]*)?:\s*(.+)$/);
  return match ? match[1].trim() : String(title || '').trim();
};

const isValidCatalogueId = (value) => CATALOGUE_ID_PATTERN.test(String(value || ''));

// "<strong>Caputo, Aldo</strong> (tenor) <br>Calderon, Rani (Conductor)" -> [{ name, role }, ...]
const parsePerformers = (html) => String(html || '')
  .split(/<br\s*\/?>/i)
  .map(line => stripTags(line).match(/^(.+?)\s*\(([^()]+)\)\s*$/))
  .filter(Boolean)
  .map(match => ({ name: match[1].trim(), role: match[2].trim() }));

const fetchHtml = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'en-US,en;q=0.9' } });
  if (!response.ok) {
    throw new Error(`Naxos request failed (${response.status})`);
  }
  return await response.text();
};

/**
 * Parses the keyword search results page into normalized candidates.
 */
const parseSearchResults = (html) => {
  const results = new Map();
  const blocks = String(html).split(/<div class="row" style="padding-top:20px; border-bottom:1px solid #dadada;">/i).slice(1);

  for (const block of blocks) {
    const id = decodeEntities((block.match(/CatalogueDetail\/\?id=([^"'&]+)/i) || [])[1] || '').trim();
    if (!id || results.has(id)) continue;

    const title = stripTags((block.match(/class="link-title"\s*>([\s\S]*?)<\/a>/i) || [])[1] || '');
    const field = (label) => {
      const match = block.match(new RegExp(`>${label}<\\/td>\\s*<td[^>]*>([\\s\\S]*?)<\\/td>`, 'i'));
      return match ? stripTags(match[1]) : '';
    };
    const composers = field('Composers').split(/\s*--\s*/).filter(Boolean);
    const artists = field('Artists').split(/\s*--\s*/).filter(Boolean);
    const image = (block.match(/data-img-orig="([^"]+)"/i) || block.match(/data-src="([^"]+)"/i) || [])[1] || null;

    results.set(id, {
      id,
      releaseTitles: [...new Set([title, stripComposerPrefix(title)].filter(Boolean))],
      releaseArtist: [...composers, ...artists].map(naturalName).join(', ') || null,
      releaseArtistNames: [...composers, ...artists].map(naturalName),
      year: null,
      country: null,
      label: null,
      catno: id,
      format: field('Categories') || null,
      formatQuantity: null,
      thumb: image,
      url: `${BASE_URL}/CatalogueDetail/?id=${encodeURIComponent(id)}`
    });
  }

  return [...results.values()];
};

/**
 * Parses a catalogue detail page into a Discogs-shaped release so the shared import pipeline
 * (track matching, works, credits, artwork) can consume it unchanged.
 */
const parseCatalogueDetail = (html, catalogueId) => {
  const text = String(html);

  const sidebarField = (label) => {
    const match = text.match(new RegExp(`${label}:\\s*<span>([\\s\\S]*?)<\\/span><\\/div>`, 'i'));
    if (!match) return [];
    const linked = [...match[1].matchAll(/<a [^>]*>([\s\S]*?)<\/a>/gi)].map(m => stripTags(m[1]));
    return linked.length > 0 ? linked : stripTags(match[1]).split(/\s*;\s*/).filter(Boolean);
  };
  const sidebarValue = (label) => sidebarField(label)[0] || null;

  const title = stripTags((text.match(/<h3 id="album-title"[^>]*>([\s\S]*?)<\/h3>/i) || [])[1] || '') || catalogueId;
  const releaseDate = sidebarValue('Release Date');
  const dateMatch = String(releaseDate || '').match(/^(\d{1,2})\/(\d{4})$/);
  const year = dateMatch ? Number(dateMatch[2]) : (Number.parseInt(String(releaseDate || '').slice(-4), 10) || null);

  // Performer roles appear in the per-work/per-track lists, e.g. "<strong>Caputo, Aldo</strong> (tenor)".
  const roleByName = new Map();
  for (const match of text.matchAll(/(?:<strong>)?([^<>()\n]+?)(?:<\/strong>)?\s*\(([^()<>]+)\)\s*<br\s*\/?>/gi)) {
    const name = decodeEntities(match[1]).trim();
    const role = decodeEntities(match[2]).trim();
    if (name && role && !roleByName.has(name)) roleByName.set(name, role);
  }

  const composers = sidebarField('Composer\\(s\\)');
  const credit = (name, role) => ({ name: naturalName(name), anv: '', join: '', role, tracks: '', id: null });
  const writerCredits = [
    // With several composers the per-work composer lines (below) carry the attribution instead.
    ...(composers.length === 1 ? composers.map(name => credit(name, 'Composed By')) : []),
    ...sidebarField('Lyricist\\(s\\)').map(name => credit(name, 'Lyrics By')),
    ...sidebarField('Arranger\\(s\\)').map(name => credit(name, 'Arranged By'))
  ];
  const sidebarPerformerCredits = [
    ...sidebarField('Conductor\\(s\\)').map(name => credit(name, 'Conductor')),
    ...sidebarField('Orchestra\\(s\\)').map(name => credit(name, 'Orchestra')),
    ...sidebarField('Choir\\(s\\)').map(name => credit(name, 'Chorus')),
    ...sidebarField('Ensemble\\(s\\)').map(name => credit(name, 'Ensemble')),
    ...sidebarField('Artist\\(s\\)').map(name => credit(name, roleByName.get(name) || 'Performer'))
  ];

  const tracklist = [];
  const trackSection = text.slice(Math.max(0, text.indexOf('id="all-tracks-wrap"')));
  const discCount = Math.max(1, (trackSection.match(/>\s*Disc \d+\s*<\/div>/gi) || []).length);
  const multiDisc = discCount > 1;
  const tokenPattern = /<div[^>]*>\s*Disc (\d+)\s*<\/div>|<div class="track-composer">\s*<strong>([\s\S]*?)<\/strong>|<div class="card-header3[\s\S]*?<strong>([\s\S]*?)<\/strong>|class="number-track"[^>]*>\s*(\d+)\s*<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class="track-num"[^>]*>\s*([\d:]*)\s*<\/td>/gi;

  let disc = 1;
  const allTracks = [];
  const tokens = [...trackSection.matchAll(tokenPattern)];
  tokens.forEach((match, tokenIndex) => {
    if (match[1]) {
      disc = Number(match[1]);
    } else if (match[2]) {
      currentComposer = stripTags(match[2]);
      currentWork = null;
    } else if (match[3]) {
      currentWork = {
        type_: 'index',
        title: stripTags(match[3]),
        position: '',
        sub_tracks: [],
        extraartists: composers.length > 1 && currentComposer ? [credit(currentComposer, 'Composed By')] : []
      };
      tracklist.push(currentWork);
    } else if (match[4]) {
      // Each track row is followed by its own collapsed performer list (the "+" icon on naxos.com).
      const nextTokenStart = tokens[tokenIndex + 1]?.index ?? trackSection.length;
      const trailing = trackSection.slice(match.index + match[0].length, nextTokenStart);
      const performerHtml = (trailing.match(/class="card-body[^"]*">([\s\S]*?)<\/div>/i) || [])[1] || '';

      const track = {
        type_: 'track',
        position: multiDisc ? `${disc}-${match[4]}` : match[4],
        title: stripTags(match[5]),
        duration: match[6] || '',
        performers: parsePerformers(performerHtml)
      };
      allTracks.push(track);
      if (currentWork) {
        currentWork.sub_tracks.push(track);
      } else {
        if (composers.length > 1 && currentComposer) track.extraartists = [credit(currentComposer, 'Composed By')];
        tracklist.push(track);
      }
    }
  });

  // Performers on every track are album credits; the rest are credited only on their tracks.
  let albumPerformerCredits = sidebarPerformerCredits;
  if (allTracks.some(track => track.performers.length > 0)) {
    const tracksByPerformer = new Map();
    for (const track of allTracks) {
      for (const performer of track.performers) {
        const key = `${performer.name}|${performer.role}`;
        if (!tracksByPerformer.has(key)) tracksByPerformer.set(key, { performer, tracks: new Set() });
        tracksByPerformer.get(key).tracks.add(track);
      }
    }

    albumPerformerCredits = [];
    for (const { performer, tracks } of tracksByPerformer.values()) {
      if (tracks.size === allTracks.length) {
        albumPerformerCredits.push(credit(performer.name, performer.role));
      } else {
        for (const track of tracks) {
          track.extraartists = [...(track.extraartists || []), credit(performer.name, performer.role)];
        }
      }
    }
  }
  allTracks.forEach((track) => { delete track.performers; });
  const extraartists = [...writerCredits, ...albumPerformerCredits];

  const coverUrl = (text.match(/href="(https:\/\/cdn\.naxos\.com\/sharedfiles\/images\/cds\/hires\/[^"]+)"/i) || [])[1]
    || (text.match(/src="(https:\/\/cdn\.naxos\.com\/sharedfiles\/images\/cds\/hires\/[^"]+)"/i) || [])[1]
    || null;
  const barcode = sidebarValue('Barcode');

  return {
    id: catalogueId,
    title,
    uri: `${BASE_URL}/CatalogueDetail/?id=${encodeURIComponent(catalogueId)}`,
    year,
    released: dateMatch ? `${dateMatch[2]}-${dateMatch[1].padStart(2, '0')}` : (year ? String(year) : null),
    country: null,
    format_quantity: discCount,
    labels: sidebarValue('Label') ? [{ name: sidebarValue('Label'), catno: sidebarValue('Catalogue No') || catalogueId }] : [],
    identifiers: barcode ? [{ type: 'Barcode', value: barcode }] : [],
    artists: composers.slice(0, 1).map(name => ({ name: naturalName(name), anv: '', join: '', role: '', tracks: '', id: null })),
    extraartists,
    tracklist,
    images: coverUrl ? [{ type: 'primary', uri: coverUrl, uri150: coverUrl, width: null, height: null }] : []
  };
};

const createNaxosSource = () => ({
  key: 'naxos',
  label: 'Naxos',
  userAgent: USER_AGENT,
  isValidReleaseId: isValidCatalogueId,
  getRelease: async (catalogueId) => {
    if (!isValidCatalogueId(catalogueId)) {
      throw new Error('Invalid Naxos catalogue number');
    }
    const html = await fetchHtml(`${BASE_URL}/CatalogueDetail/?id=${encodeURIComponent(catalogueId)}`);
    const release = parseCatalogueDetail(html, catalogueId);
    if (release.tracklist.length === 0) {
      throw new Error(`No tracks found for Naxos catalogue number ${catalogueId}`);
    }
    return release;
  },
  buildSearches: ({ query, albumTitle, titleSegments, primarySurname, keyWords }) => (query
    ? [query]
    : [
        ...titleSegments.map(segment => [keyWords(segment), primarySurname].filter(Boolean).join(' ')),
        keyWords(albumTitle)
      ]),
  search: async (keywords) => {
    const html = await fetchHtml(`${BASE_URL}/Search/KeywordSearchResults/?q=${encodeURIComponent(String(keywords).trim())}`);
    return parseSearchResults(html);
  }
});

module.exports = { createNaxosSource, parseSearchResults, parseCatalogueDetail, parsePerformers, stripComposerPrefix, naturalName };
