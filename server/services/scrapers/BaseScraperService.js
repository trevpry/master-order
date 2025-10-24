/**
 * Base Scraper Service
 * 
 * Abstract base class for all scraper implementations.
 * Each scraper should extend this class and implement the required methods.
 */

const cheerio = require('cheerio');
const { applyUrlReplacements } = require('../../utils/urlReplacements');

class BaseScraperService {
  constructor(siteName = 'Unknown') {
    this.name = siteName;
    this.siteName = siteName;
    this.urlReplacements = []; // Can be set by subclasses
  }

  /**
   * Apply configured URL replacements to a URL
   * @param {string} url - The URL to transform
   * @returns {string} - The transformed URL
   */
  applyUrlReplacements(url) {
    return applyUrlReplacements(url, this.urlReplacements);
  }

  /**
   * Check if this scraper can handle the given URL
   * @param {string} url - The URL to check
   * @returns {boolean} - True if this scraper can handle the URL
   */
  canHandle(url) {
    throw new Error('canHandle() must be implemented by subclass');
  }

  /**
   * Scrape metadata from the given URL
   * @param {string} url - The URL to scrape
   * @returns {Promise<Object>} - Scraped metadata
   */
  async scrape(url) {
    throw new Error('scrape() must be implemented by subclass');
  }

  /**
   * Helper method to fetch HTML from a URL
   * @param {string} url - The URL to fetch
   * @returns {Promise<CheerioStatic>} - Cheerio instance with loaded HTML
   */
  async fetchHtml(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    return cheerio.load(html);
  }

  /**
   * Helper method to convert relative URL to absolute
   * @param {string} url - The relative or absolute URL
   * @param {string} baseUrl - The base URL
   * @returns {string} - Absolute URL
   */
  absUrl(url, baseUrl) {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    try {
      const base = new URL(baseUrl);
      return new URL(url, base.origin).toString();
    } catch (e) {
      return url;
    }
  }

  /**
   * Format the scraped data into a standard structure
   * @param {Object} data - Raw scraped data
   * @returns {Object} - Formatted scraper result
   */
  formatResult(data) {
    return {
      success: true, // Indicate successful scrape
      source: this.siteName,
      scraped: {
        title: data.title || null,
        details: data.details || null,
        studio: data.studio || null,
        date: data.date || null,
        url: data.url || null,
        image: data.coverImage || data.image || null, // Use 'image' for consistency with GEVI
        performers: data.performers || [],
        tags: data.tags || [],
        movies: data.movies || [],
        episodeUrls: data.episodeUrls || [],
        duration: data.duration || null
      }
    };
  }
}

module.exports = BaseScraperService;
