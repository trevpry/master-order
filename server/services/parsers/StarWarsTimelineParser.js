const cheerio = require('cheerio');
const BaseListParser = require('./BaseListParser');

/**
 * Parser for the Star Wars Fandom Wiki "Timeline of canon media" page.
 * Uses the MediaWiki API to bypass Cloudflare.
 *
 * Page structure:
 *   - table.timeline-toggles: media type toggle buttons (F, N, JR, YR, VG, TV, C, SS, RPG, A, P)
 *   - table.wikitable (first): main timeline table with columns: Year | MediaType | Title | Released
 *   - table.wikitable (second): undated / uncertain placement items
 *
 * Media type abbreviations in column 2:
 *   F = Film, N = Novel, JR = Junior Novel, YR = Young Reader, VG = Video Game,
 *   TV = Television, C = Comic, SS = Short Story, RPG = Adventure/Scenario,
 *   A = Audio, P = Promotional
 *
 * Unreleased items have class "unpublished" on the row or media cell.
 */
class StarWarsTimelineParser extends BaseListParser {
  constructor() {
    super('Star Wars Timeline Parser');
  }

  static MEDIA_TYPE_MAP = {
    'F':   'movie',
    'N':   'book',
    'JR':  'book',
    'YR':  'book',
    'VG':  'game',
    'TV':  'episode',
    'C':   'comic',
    'SS':  'shortstory',
    'RPG': 'game',
    'A':   'book',
    'P':   'webvideo'
  };

  async parse(config) {
    const parserConfig = config.parserConfig ? JSON.parse(config.parserConfig) : {};
    const mediaFilter = parserConfig.mediaFilter || null; // e.g. ["F", "TV"]
    const includeUnreleased = parserConfig.includeUnreleased || false;
    const includeUndated = parserConfig.includeUndated || false;

    const $ = await this.fetchViaApi(config.url);

    const wikitables = $('table.wikitable');
    if (!wikitables.length) {
      throw new Error('Could not find the wikitable on the page');
    }

    const items = [];
    let position = 0;

    // Process main timeline table (first wikitable)
    const mainTable = wikitables.first();
    position = this.processTable($, mainTable, items, position, mediaFilter, includeUnreleased);

    // Optionally process undated items table (second wikitable)
    if (includeUndated && wikitables.length > 1) {
      this.processTable($, wikitables.eq(1), items, position, mediaFilter, includeUnreleased);
    }

    return items;
  }

  processTable($, table, items, startPosition, mediaFilter, includeUnreleased) {
    const rows = table.find('tr').slice(1); // skip header
    let position = startPosition;

    rows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find('td');
      if (cells.length < 4) return;

      const yearCell = cells.eq(0);
      const mediaCell = cells.eq(1);
      const titleCell = cells.eq(2);
      const releasedCell = cells.eq(3);

      const abbr = mediaCell.text().trim();
      if (!abbr) return;

      // Skip unreleased items unless configured to include them
      const mediaCls = (mediaCell.attr('class') || '') + ' ' + ($row.attr('class') || '');
      if (!includeUnreleased && mediaCls.includes('unpublished')) return;

      // Skip excluded media types
      if (['A', 'P', 'Ad'].includes(abbr)) return;

      // Apply media filter if configured
      if (mediaFilter && mediaFilter.length > 0) {
        if (!mediaFilter.includes(abbr)) return;
      }

      // Extract title text, cleaning up footnote references and wiki markers
      let title = titleCell.text().trim();
      // Remove footnote markers like [122] and trailing notes after newlines
      title = title.replace(/\[[\d,]+\]/g, '').split('\n')[0].trim();
      // Remove trailing dagger marks (†) used for expanded editions
      title = title.replace(/\s*†\s*$/, '').trim();
      if (!title) return;

      // Skip titles containing excluded keywords
      const lowerTitle = title.toLowerCase();
      if (lowerTitle.includes('adaptation') ||
          lowerTitle.includes('young jedi adventures') ||
          lowerTitle.includes('fun with nubs')) return;

      // Get link URL from the title cell
      const titleLink = titleCell.find('a').first();
      let itemUrl = null;
      if (titleLink.length) {
        const href = titleLink.attr('href') || '';
        if (href) {
          itemUrl = href.startsWith('http') ? href : `https://starwars.fandom.com${href}`;
        }
      }

      // Extract release year from the Released column (format: YYYY-MM-DD)
      const releasedText = releasedCell.text().trim();
      const yearMatch = releasedText.match(/^(\d{4})/);
      const itemYear = yearMatch ? yearMatch[1] : null;

      const mediaType = StarWarsTimelineParser.MEDIA_TYPE_MAP[abbr] || 'movie';

      // For TV episodes, try to parse "Series — Episode Title" format
      const tvMatch = title.match(/^(.+?)\s*—\s*"?(.+?)"?\s*$/);
      if (mediaType === 'episode' && tvMatch) {
        items.push({
          title: tvMatch[2].replace(/"$/, '').trim(),
          position: position++,
          mediaType,
          itemUrl,
          itemYear,
          seriesTitle: tvMatch[1].trim(),
          releaseDate: releasedText || null,
          wikiMedium: abbr
        });
      } else if (mediaType === 'comic') {
        // Extract comic series, year, and issue number from title
        // Patterns: "Series (YYYY) 4", "Series (YYYY) — Subtitle 3", "Series 12", "Series — Subtitle"
        let comicSeries = title;
        let comicIssue = null;
        let comicYear = null;

        // "Series (YYYY) Issue" — e.g. "The High Republic (2022) 4"
        const yearIssueMatch = title.match(/^(.+?)\s*\((\d{4})\)\s+(\d+)\s*$/);
        // "Series (YYYY)" with no issue — e.g. "Darth Vader (2020)"
        const yearOnlyMatch = !yearIssueMatch && title.match(/^(.+?)\s*\((\d{4})\)\s*$/);
        // "Series Issue" with no year — e.g. "The High Republic — The Blade 3"
        const issueOnlyMatch = !yearIssueMatch && !yearOnlyMatch && title.match(/^(.+?)\s+(\d+)\s*$/);

        if (yearIssueMatch) {
          comicSeries = yearIssueMatch[1].trim();
          comicYear = yearIssueMatch[2];
          comicIssue = yearIssueMatch[3];
        } else if (yearOnlyMatch) {
          comicSeries = yearOnlyMatch[1].trim();
          comicYear = yearOnlyMatch[2];
        } else if (issueOnlyMatch) {
          comicSeries = issueOnlyMatch[1].trim();
          comicIssue = issueOnlyMatch[2];
        }

        items.push({
          title,
          position: position++,
          mediaType,
          itemUrl,
          itemYear: comicYear || itemYear,
          comicSeries,
          comicIssue,
          comicYear: comicYear || null,
          releaseDate: releasedText || null,
          wikiMedium: abbr
        });
      } else {
        items.push({
          title,
          position: position++,
          mediaType,
          itemUrl,
          itemYear,
          releaseDate: releasedText || null,
          wikiMedium: abbr
        });
      }
    });

    return position;
  }

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

  /**
   * Fetch book details (ISBN, author, page count) from an individual wiki page's infobox
   */
  async fetchBookDetailsFromWiki(itemUrl) {
    const parsed = new URL(itemUrl);
    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch) return {};

    const wikiBase = `${parsed.protocol}//${parsed.host}`;
    const pageName = decodeURIComponent(pathMatch[1]);
    const apiUrl = `${wikiBase}/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text&format=json`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return {};

    const data = await response.json();
    if (data.error) return {};

    const $ = cheerio.load(data.parse.text['*']);
    const details = {};

    // Extract ISBN from infobox
    const isbnValue = $('[data-source="isbn"] .pi-data-value').first().text().trim();
    if (isbnValue) {
      // Extract the first ISBN (13-digit preferred)
      const isbnMatch = isbnValue.match(/(\d{13}|\d{10})/);
      if (isbnMatch) details.isbn = isbnMatch[1];
    }

    // Extract author
    const authorValue = $('[data-source="author"] .pi-data-value').first().text().trim()
      .replace(/\[\d+\]/g, '').trim();
    if (authorValue) details.author = authorValue;

    // Extract page count
    const pagesValue = $('[data-source="pages"] .pi-data-value').first().text().trim()
      .replace(/\[\d+\]/g, '').trim();
    if (pagesValue) {
      const pageNum = parseInt(pagesValue);
      if (!isNaN(pageNum)) details.pageCount = pageNum;
    }

    return details;
  }

  getDescription() {
    return 'Parses the Star Wars Fandom Wiki Timeline of canon media. Extracts title, media type, and release date. Supports filtering by media type abbreviation (F, TV, C, N, etc.).';
  }

  getConfigFields() {
    return [
      {
        name: 'mediaFilter',
        label: 'Media Filter (comma-separated abbreviations, e.g. "F,TV,VG")',
        required: false,
        type: 'text',
        default: ''
      },
      {
        name: 'includeUnreleased',
        label: 'Include unreleased items',
        required: false,
        type: 'boolean',
        default: false
      },
      {
        name: 'includeUndated',
        label: 'Include undated/uncertain placement items (second table)',
        required: false,
        type: 'boolean',
        default: false
      }
    ];
  }
}

module.exports = StarWarsTimelineParser;
