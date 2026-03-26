const cheerio = require('cheerio');
const BaseListParser = require('./BaseListParser');

/**
 * Parser for DCU Universe Fandom Wiki Timeline page.
 * Uses the MediaWiki API to bypass Cloudflare and extracts the Full Chronology section.
 *
 * Rules:
 * - Items are <li> tags in the <ul> after the "Full Chronology" heading
 * - Skip items where <small> contains "(unreleased)"
 * - If a <li> has nested <li> children, it's a TV series — skip the parent, extract children as episodes
 * - Episode titles are parsed from "Series: S.EE: Title" format
 * - Movies are top-level <li> items without nested children
 */
class DcuTimelineParser extends BaseListParser {
  constructor() {
    super('DCU Timeline Parser');
  }

  async parse(config) {
    const parserConfig = config.parserConfig ? JSON.parse(config.parserConfig) : {};
    const sectionId = parserConfig.sectionId || 'Full_Chronology';

    const $ = await this.fetchViaApi(config.url);
    const heading = $(`span#${sectionId}`).parent();

    if (!heading.length) {
      throw new Error(`Could not find section with id "${sectionId}" on the page`);
    }

    // Find the list element after the heading
    const listEl = heading.nextAll('ul, ol').first();
    if (!listEl.length) {
      throw new Error('Could not find the list after the Full Chronology heading');
    }

    const items = [];
    const filmYearLookups = []; // { index, href } — resolve years after main loop
    let position = 0;

    listEl.children('li').each((_i, el) => {
      const $el = $(el);
      const smallText = $el.find('> small').text().trim();
      const isUnreleased = smallText.includes('(unreleased)');
      if (isUnreleased) return;

      // Get direct text (excluding nested lists)
      const directText = $el.clone().children('ul, ol').remove().end().text().trim();

      // Collect all <a> tags at the direct level only (not inside nested <ul>/<ol>)
      const $directContent = $el.clone().children('ul, ol').remove().end();
      const directLinks = [];
      $directContent.find('a').each((_j, a) => {
        directLinks.push({
          href: $(a).attr('href') || '',
          title: $(a).attr('title') || '',
          text: $(a).text().trim(),
          hasImg: $(a).find('img').length > 0
        });
      });

      // Classify by href patterns in direct-level links
      const filmLink = directLinks.find(l => l.href.includes('(film)') || l.title.includes('(film)'));
      const tvLink = directLinks.find(l => l.href.includes('(TV_series)') || l.title.includes('(TV series)'));
      // The title link is typically the non-image <a> at direct level
      const titleLink = directLinks.find(l => !l.hasImg && l.text);

      const isFilm = !!filmLink;
      const isTVSeries = !!tvLink;

      const primaryLink = titleLink || filmLink || tvLink || directLinks[0];
      const href = primaryLink?.href || '';
      let itemUrl = null;
      if (href) {
        itemUrl = href.startsWith('http') ? href : `https://dcuniverse.fandom.com${href}`;
      }

      if (isFilm) {
        // Film — extract title from the title link text, strip "(film)", fetch year later
        let title = (titleLink || filmLink)?.text || directText;
        title = title.replace(/\s*\(film\)\s*/gi, '').trim();
        if (!title) return;

        const itemIndex = items.length;
        items.push({
          title,
          position: position++,
          mediaType: 'movie',
          itemUrl,
          itemYear: null
        });
        filmYearLookups.push({ index: itemIndex, href: filmLink.href });
      } else if (isTVSeries) {
        // TV Series — skip the parent, process nested <li> children as episodes
        const seriesName = this.extractSeriesName(directText);
        const nestedLis = $el.find('> ul > li, > ol > li');

        nestedLis.each((_j, subEl) => {
          const $sub = $(subEl);
          const subSmall = $sub.find('small').text().trim();
          if (subSmall.includes('(unreleased)')) return;

          // Find the episode title link (prefer <i><a> or non-image <a>)
          let epLink = $sub.find('i > a').first();
          if (!epLink.length) {
            $sub.find('a').each((_k, a) => {
              const $a = $(a);
              if (!$a.find('img').length) { epLink = $a; return false; }
            });
          }

          const episodeText = epLink.length ? epLink.text().trim() : $sub.clone().children('ul, ol').remove().end().text().trim();
          const parsed = this.parseEpisodeText(episodeText, seriesName);

          let epUrl = null;
          if (epLink.length) {
            const epHref = epLink.attr('href');
            if (epHref) {
              epUrl = epHref.startsWith('http') ? epHref : `https://dcuniverse.fandom.com${epHref}`;
            }
          }

          items.push({
            title: parsed.title || episodeText,
            position: position++,
            mediaType: 'episode',
            itemUrl: epUrl,
            itemYear: null,
            seriesTitle: parsed.seriesTitle || seriesName,
            seasonNumber: parsed.seasonNumber || null,
            episodeNumber: parsed.episodeNumber || null
          });
        });
      } else {
        // Other standalone items (specials, etc.)
        let title = primaryLink?.text || directText;
        title = title.replace(/\s*\(unreleased\)\s*/gi, '').trim();
        if (!title) return;

        // Check if the title matches episode format "Series: S.EE: Title"
        const parsed = this.parseEpisodeText(title);
        if (parsed.seasonNumber !== null) {
          items.push({
            title: parsed.title,
            position: position++,
            mediaType: 'episode',
            itemUrl,
            itemYear: null,
            seriesTitle: parsed.seriesTitle,
            seasonNumber: parsed.seasonNumber,
            episodeNumber: parsed.episodeNumber
          });
        } else {
          items.push({
            title,
            position: position++,
            mediaType: 'movie',
            itemUrl,
            itemYear: null
          });
        }
      }
    });

    // Resolve release years for films by fetching their wiki pages
    if (filmYearLookups.length > 0) {
      const wikiBase = this.parseWikiUrl(config.url).wikiBase;
      await Promise.all(filmYearLookups.map(async ({ index, href }) => {
        try {
          const year = await this.fetchFilmYear(wikiBase, href);
          if (year) items[index].itemYear = year;
        } catch (e) {
          // Non-critical — leave year as null
        }
      }));
    }

    return items;
  }

  /**
   * Extract series name from the parent <li> text.
   * e.g., "Creature Commandos | Season One" → "Creature Commandos"
   */
  extractSeriesName(text) {
    // Remove (unreleased) and season info
    let name = text.replace(/\s*\(unreleased\)\s*/gi, '').trim();
    // Split on " | " to separate series name from season
    const pipeIdx = name.indexOf(' | ');
    if (pipeIdx > -1) {
      name = name.substring(0, pipeIdx).trim();
    }
    return name;
  }

  /**
   * Parse episode text like "Creature Commandos: 1.01: The Collywobbles"
   * Returns { seriesTitle, seasonNumber, episodeNumber, title }
   */
  parseEpisodeText(text, fallbackSeries) {
    // Pattern: "Series: S.EE: Episode Title" or "Series: S.EE Episode Title"
    const match = text.match(/^(.+?):\s*(\d+)\.(\d+)[:\s]\s*(.+)$/);
    if (match) {
      return {
        seriesTitle: match[1].trim(),
        seasonNumber: parseInt(match[2]),
        episodeNumber: parseInt(match[3]),
        title: match[4].trim()
      };
    }

    // Fallback: just use the full text as title
    return {
      seriesTitle: fallbackSeries,
      seasonNumber: null,
      episodeNumber: null,
      title: text.trim()
    };
  }

  /**
   * Fetch a film's wiki page and extract the release year from the infobox.
   * Looks for the data-source="release" section in the portable infobox.
   */
  async fetchFilmYear(wikiBase, href) {
    // Extract page name from href like "/wiki/Superman_(film)"
    const pageMatch = href.match(/\/wiki\/(.+)$/);
    if (!pageMatch) return null;

    const pageName = decodeURIComponent(pageMatch[1]);
    const apiUrl = `${wikiBase}/api.php?action=parse&page=${encodeURIComponent(pageName)}&prop=text&format=json`;

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data.error || !data.parse?.text?.['*']) return null;

    const $ = cheerio.load(data.parse.text['*']);
    const releaseDateValue = $('[data-source="release"] .pi-data-value').text().trim();
    if (!releaseDateValue) return null;

    // Extract year from date string like "July 11, 2025"
    const yearMatch = releaseDateValue.match(/\b(\d{4})\b/);
    return yearMatch ? yearMatch[1] : null;
  }

  /**
   * Fetch page content via the MediaWiki API (bypasses Cloudflare).
   * Converts a wiki page URL to an API call.
   */
  async fetchViaApi(url) {
    const { wikiBase, pageName } = this.parseWikiUrl(url);
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

    const html = data.parse.text['*'];
    return cheerio.load(html);
  }

  /**
   * Parse a Fandom wiki URL into base and page name.
   * e.g., "https://dcuniverse.fandom.com/wiki/Timeline" → { wikiBase: "https://dcuniverse.fandom.com", pageName: "Timeline" }
   */
  parseWikiUrl(url) {
    const parsed = new URL(url);
    const pathMatch = parsed.pathname.match(/\/wiki\/(.+)$/);
    if (!pathMatch) {
      throw new Error(`Could not parse wiki page name from URL: ${url}`);
    }
    return {
      wikiBase: `${parsed.protocol}//${parsed.host}`,
      pageName: decodeURIComponent(pathMatch[1])
    };
  }

  getDescription() {
    return 'Parses the DCU Universe Fandom Wiki Timeline page. Extracts the Full Chronology section, skips unreleased items, and expands TV series into individual episodes.';
  }

  getConfigFields() {
    return [
      { name: 'sectionId', label: 'Section ID', required: false, type: 'text', default: 'Full_Chronology' }
    ];
  }
}

module.exports = DcuTimelineParser;
