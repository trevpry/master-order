const cheerio = require('cheerio');
const BaseListParser = require('./BaseListParser');

/**
 * Parser for Marvel Reading Order (marvelreading.com).
 * Extracts comics from the main 616 core reading order.
 *
 * Table structure:
 *   Row: <tr class="ro-tr">
 *     - Order: <td class="ro-td ro-td--order"><strong>{number}</strong>
 *     - Date: <td class="ro-td ro-td--date">{date text}
 *     - Title: <td class="ro-td ro-td--title"><a href="{url}" class="ro-title-link">{title}</a>
 *     - Story Arc: <td class="ro-td ro-td--arc">{arc text}
 *
 * Supports pagination starting from a configurable page number.
 */
class MarvelComicsParser extends BaseListParser {
  constructor() {
    super('CMRO Parser');
  }

  async parse(config) {
    const parserConfig = config.parserConfig ? JSON.parse(config.parserConfig) : {};
    const currentPage = parserConfig.currentPage || parserConfig.startPage || 59;
    const useJavaScript = parserConfig.useJavaScript || config.useJavaScript || true; // Default to true for this site

    const items = [];
    let position = 0;

    // Extract the base URL without page parameter
    const baseUrl = this.extractBaseUrl(config.url);

    // Fetch only the current page (pagination is handled by initialImport)
    try {
      const pageUrl = `${baseUrl}?page=${currentPage}`;
      console.log(`[MarvelComicsParser] Fetching page ${currentPage}: ${pageUrl}`);
      const $ = await this.fetchHtml(pageUrl, useJavaScript);

      // Extract all comic rows from the page
      const rows = $('tr.ro-tr');
      if (rows.length === 0) {
        console.log(`[MarvelComicsParser] No rows found on page ${currentPage}`);
        return items; // Return empty array if no rows
      }

      rows.each((_i, element) => {
        const $row = $(element);

        // Extract order number
        const orderCell = $row.find('td.ro-td--order strong').text().trim();
        const normalizedOrderCell = orderCell.replace(/[^\d]/g, '');
        const parsedOrder = normalizedOrderCell ? parseInt(normalizedOrderCell, 10) : NaN;
        const hasExplicitOrder = Number.isInteger(parsedOrder) && parsedOrder > 0;
        const orderNum = hasExplicitOrder ? parsedOrder : null;

        // Extract title from link
        const titleLink = $row.find('td.ro-td--title a.ro-title-link');
        const title = titleLink.text().trim();
        if (!title) return; // Skip rows without a title

        // Extract URL
        let itemUrl = titleLink.attr('href') || null;
        if (itemUrl && !itemUrl.startsWith('http')) {
          try {
            const base = new URL(config.url);
            itemUrl = new URL(itemUrl, base.origin).toString();
          } catch (e) {
            // Keep relative URL or null
          }
        }

        // Extract date
        const dateCell = $row.find('td.ro-td--date').text().trim();
        let itemYear = null;
        if (dateCell) {
          // Try to extract year from date string (e.g., "January 2025" or "2025")
          const yearMatch = dateCell.match(/(\d{4})/);
          if (yearMatch) {
            itemYear = yearMatch[1];
          }
        }

        // Extract story arc (informational only, not used in position)
        const arcCell = $row.find('td.ro-td--arc').text().trim();

        items.push({
          title,
          // Use the source list order number when available so position stays
          // globally stable across pagination and sync runs.
          position: hasExplicitOrder ? orderNum : position,
          mediaType: 'comic',
          itemUrl,
          itemYear,
          storyArc: arcCell || null,
          releaseDate: dateCell || null,
          orderNumber: orderNum
        });

        position += 1;
      });

      console.log(`[MarvelComicsParser] Fetched ${rows.length} items from page ${currentPage}`);
    } catch (error) {
      console.error(`[MarvelComicsParser] Error fetching page ${currentPage}:`, error.message);
      // Return empty array on error
    }

    return items;
  }

  /**
   * Extract the base URL without the page parameter.
   * Handles URLs like:
   *   - https://marvelreading.com/reading-order/main-616-core?page=59
   *   - https://marvelreading.com/reading-order/main-616-core
   */
  extractBaseUrl(url) {
    try {
      const parsed = new URL(url);
      // Remove the page parameter if it exists
      parsed.searchParams.delete('page');
      return parsed.toString().replace(/\?$/, ''); // Remove trailing ? if no other params
    } catch (e) {
      // Fallback: simple string manipulation
      return url.split('?')[0];
    }
  }

  async fetchHtml(url, useJavaScript = true) {
    if (useJavaScript) {
      return await this.fetchHtmlWithPuppeteer(url);
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://marvelreading.com/'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }

    return cheerio.load(await response.text());
  }

  async fetchHtmlWithPuppeteer(url) {
    let browser = null;
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Set additional headers to look like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://marvelreading.com/'
      });

      console.log(`[MarvelComicsParser] Loading page with Puppeteer: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const html = await page.content();
      await browser.close();
      
      return cheerio.load(html);
    } catch (error) {
      if (browser) await browser.close();
      throw error;
    }
  }

  getDescription() {
    return 'Parses the Marvel Reading Order (marvelreading.com) for the main 616 core timeline. Extracts comic titles, release dates, and story arcs. Automatically paginates across pages starting from a configurable page number until the "Import First N Items" limit is reached. Uses Puppeteer by default to bypass anti-scraping measures.';
  }

  getConfigFields() {
    return [
      {
        name: 'startPage',
        label: 'Starting Page Number',
        required: false,
        type: 'number',
        default: '59'
      },
      {
        name: 'useJavaScript',
        label: 'Use JavaScript Rendering (Puppeteer)',
        required: false,
        type: 'checkbox',
        default: 'true'
      }
    ];
  }
}

module.exports = MarvelComicsParser;
