const cheerio = require('cheerio');
const BaseListParser = require('./BaseListParser');

/**
 * Parser for the MCU Fandom Wiki "Release Order / All Media Timeline" page.
 * Uses the MediaWiki API to bypass Cloudflare.
 *
 * Table structure (table.table-progress-tracking):
 *   Header: [ checkbox | NAME (colspan=2: group + title) | Release | Medium | Notes ]
 *   6-cell rows: [ checkbox | group | title | date | medium | notes ]
 *   5-cell rows: [ checkbox | title | date | medium | notes ] (group rowspanned from above)
 */
class McuTimelineParser extends BaseListParser {
  constructor() {
    super('MCU Timeline Parser');
  }

  /**
   * Map the wiki "Medium" column to normalized media types.
   */
  static MEDIA_TYPE_MAP = {
    'film': 'movie',
    'tv series': 'episode',
    'web series': 'webvideo',
    'comic': 'comic',
    'book': 'book',
    'video game': 'game',
    'game': 'game',
    'one-shot': 'movie',
    'short film': 'movie',
    'special presentation': 'movie',
    'promo clip': 'webvideo',
    'promo campaign': 'webvideo'
  };

  async parse(config) {
    const parserConfig = config.parserConfig ? JSON.parse(config.parserConfig) : {};
    const mediaFilter = parserConfig.mediaFilter || null; // e.g. ["Film", "TV Series"]

    const $ = await this.fetchViaApi(config.url);

    const table = $('table.table-progress-tracking');
    if (!table.length) {
      throw new Error('Could not find the progress tracking table on the page');
    }

    const rows = table.find('tr').slice(1); // skip header
    const items = [];
    let position = 0;

    const SKIP_BACKGROUNDS = [
      'background:rgba(255, 0, 120, 0.25)',
      'background:rgba(206, 200, 122, 0.25)',
      'background:rgba(0, 255, 135, 0.25)'
    ];

    rows.each((_, r) => {
      // Skip rows with certain background colors
      const rowStyle = ($(r).attr('style') || '').replace(/\s/g, '');
      if (SKIP_BACKGROUNDS.some(bg => rowStyle.includes(bg.replace(/\s/g, '')))) return;

      const cells = $(r).find('td');
      const cellCount = cells.length;

      // Also check style on individual cells
      let hasSkipBg = false;
      cells.each((_, c) => {
        const cellStyle = ($(c).attr('style') || '').replace(/\s/g, '');
        if (SKIP_BACKGROUNDS.some(bg => cellStyle.includes(bg.replace(/\s/g, '')))) {
          hasSkipBg = true;
          return false;
        }
      });
      if (hasSkipBg) return;

      let title, dateText, medium, notes;
      if (cellCount === 6) {
        title = $(cells[2]).text().trim();
        dateText = $(cells[3]).text().trim();
        medium = $(cells[4]).text().trim();
        notes = $(cells[5]).text().trim();
      } else if (cellCount === 5) {
        title = $(cells[1]).text().trim();
        dateText = $(cells[2]).text().trim();
        medium = $(cells[3]).text().trim();
        notes = $(cells[4]).text().trim();
      } else {
        return; // skip non-standard rows
      }

      if (!title || !medium) return;

      // Skip novelizations
      if (notes && notes.toLowerCase().includes('novelization')) return;

      // Skip Promo Campaign entries
      if (medium.toLowerCase() === 'promo campaign') return;

      // Apply media filter if configured
      if (mediaFilter && mediaFilter.length > 0) {
        const matchesFilter = mediaFilter.some(f => medium.toLowerCase() === f.toLowerCase());
        if (!matchesFilter) return;
      }

      // Extract year from date like "May 2, 2008" or "March 25, 2008"
      const yearMatch = dateText.match(/\b(\d{4})\b/);
      const itemYear = yearMatch ? yearMatch[1] : null;

      // Get link URL from the title cell
      const titleCellIdx = cellCount === 6 ? 2 : 1;
      const titleLink = $(cells[titleCellIdx]).find('a').first();
      let itemUrl = null;
      if (titleLink.length) {
        const href = titleLink.attr('href') || '';
        if (href) {
          itemUrl = href.startsWith('http') ? href : `https://marvelcinematicuniverse.fandom.com${href}`;
        }
      }

      const mediaType = McuTimelineParser.MEDIA_TYPE_MAP[medium.toLowerCase()] || config.defaultMediaType || 'movie';

      // Parse episode format "Series: S.EE: Title" for TV Series entries
      const episodeMatch = title.match(/^(.+?):\s*(\d+)\.(\d+):\s*(.+)$/);
      if (episodeMatch && mediaType === 'episode') {
        items.push({
          title: episodeMatch[4].trim(),
          position: position++,
          mediaType,
          itemUrl,
          itemYear,
          seriesTitle: episodeMatch[1].trim(),
          seasonNumber: parseInt(episodeMatch[2]),
          episodeNumber: parseInt(episodeMatch[3]),
          releaseDate: dateText || null,
          wikiMedium: medium
        });
      } else {
        items.push({
          title,
          position: position++,
          mediaType,
          itemUrl,
          itemYear,
          releaseDate: dateText || null,
          wikiMedium: medium
        });
      }
    });

    return items;
  }

  /**
   * Fetch page content via the MediaWiki API (bypasses Cloudflare).
   */
  async fetchViaApi(url) {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch) {
      throw new Error(`Could not parse wiki page name from URL: ${url}`);
    }
    const wikiBase = `${parsed.protocol}//${parsed.host}`;
    const pageName = decodeURIComponent(pathMatch[1]);
    const apiUrl = `${wikiBase}/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text&format=json`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`MediaWiki API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`MediaWiki API error: ${data.error.info}`);
    }

    return cheerio.load(data.parse.text['*']);
  }

  getDescription() {
    return 'Parses the MCU Fandom Wiki Release Order / All Media Timeline. Extracts title, release date, and medium from the tracking table. Supports filtering by media type.';
  }

  getConfigFields() {
    return [
      {
        name: 'mediaFilter',
        label: 'Media Filter (comma-separated, e.g. "Film,TV Series")',
        required: false,
        type: 'text',
        default: ''
      }
    ];
  }
}

module.exports = McuTimelineParser;
