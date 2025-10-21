/**
 * Crunchboy Scraper Service
 * 
 * Scraper for crunchboy.com scenes (part of GayNetwork)
 * Based on the GayNetwork.yml scraper configuration
 */

const BaseScraperService = require('./BaseScraperService');

class CrunchboyScraperService extends BaseScraperService {
  constructor() {
    super();
    this.name = 'Crunchboy Scraper';
    this.siteName = 'Crunchboy';
    this.baseUrl = 'https://www.crunchboy.com';
  }

  /**
   * Check if this scraper can handle the given URL
   * @param {string} url - The URL to check
   * @returns {boolean} - True if URL is from crunchboy.com
   */
  canHandle(url) {
    if (!url) return false;
    return url.includes('crunchboy.com/en/videos/detail/');
  }

  /**
   * Scrape metadata from a Crunchboy scene URL
   * @param {string} url - The Crunchboy scene URL
   * @returns {Promise<Object>} - Scraped metadata
   */
  async scrape(url) {
    console.log(`🔍 [Crunchboy] Scraping scene: ${url}`);

    try {
      const $ = await this.fetchHtml(url);

      const metadata = {
        url: url,
        title: null,
        details: null,
        studio: null,
        date: null,
        coverImage: null,
        performers: [],
        tags: [],
        movies: [],
        episodeUrls: [],
        duration: null
      };

      // Extract title from h1
      const titleElement = $('h1').first();
      if (titleElement.length) {
        metadata.title = titleElement.text().trim();
        console.log(`   - Title: ${metadata.title}`);
      }

      // Extract details from h2
      const detailsElement = $('h2').first();
      if (detailsElement.length) {
        metadata.details = detailsElement.text().trim();
        console.log(`   - Details: ${metadata.details}`);
      }

      // Extract canonical URL from link tag
      const canonicalUrl = $('link[rel="alternate"][hreflang="en"]').attr('href');
      if (canonicalUrl) {
        metadata.url = canonicalUrl;
        console.log(`   - Canonical URL: ${metadata.url}`);
      }

      // Extract date and cover image from JSON-LD
      const jsonLdScript = $('script[type="application/ld+json"]').first();
      if (jsonLdScript.length) {
        try {
          const jsonText = jsonLdScript.html();
          const jsonData = JSON.parse(jsonText);
          
          // Extract date
          if (jsonData.datePublished) {
            metadata.date = jsonData.datePublished;
            console.log(`   - Date: ${metadata.date}`);
          }
          
          // Extract cover image
          if (jsonData.contentUrl) {
            metadata.coverImage = jsonData.contentUrl;
            console.log(`   - Cover image: ${metadata.coverImage}`);
          }
        } catch (e) {
          console.warn('   ⚠️ Failed to parse JSON-LD:', e.message);
        }
      }

      // Extract studio name
      const studioElement = $('*:has(i[class*="fa-video"]) span').first();
      if (studioElement.length) {
        metadata.studio = studioElement.text().trim();
        console.log(`   - Studio: ${metadata.studio}`);
      }

      // Extract performers
      $('div[class*="models-list-img"] a').each((i, el) => {
        const performerName = $(el).text().trim();
        if (performerName) {
          metadata.performers.push({ name: performerName });
        }
      });
      if (metadata.performers.length > 0) {
        console.log(`   - Found ${metadata.performers.length} performer(s):`, metadata.performers.map(p => p.name).join(', '));
      }

      // Extract tags (from h3 elements without icons)
      $('div.row.mb-4.px-0 h3:not(:has(i))').each((i, el) => {
        const tagName = $(el).text().trim();
        if (tagName) {
          metadata.tags.push({ name: tagName });
        }
      });
      if (metadata.tags.length > 0) {
        console.log(`   - Found ${metadata.tags.length} tag(s):`, metadata.tags.map(t => t.name).join(', '));
      }

      // Extract movie/DVD information
      const movieTitle = $('div.row.mb-4.px-0 h3:has(i[class*="fa-scrubber"])').first();
      if (movieTitle.length) {
        const dvdText = movieTitle.text().trim();
        const movieName = dvdText.replace(/^DVD:\s*/, '');
        
        const movieLink = $('div.row.mb-4.px-0 a:has(h3:has(i[class*="fa-scrubber"]))').first();
        let movieUrl = null;
        
        if (movieLink.length) {
          const relativeUrl = movieLink.attr('href');
          if (relativeUrl) {
            // Get the canonical URL to build absolute URL
            const canonicalLink = $('link[rel="alternate"][hreflang="en"]').attr('href');
            if (canonicalLink) {
              const baseUrl = new URL(canonicalLink).origin;
              movieUrl = this.absUrl(relativeUrl, baseUrl);
            }
          }
        }

        if (movieName) {
          metadata.movies.push({
            name: movieName,
            url: movieUrl
          });
          console.log(`   - Found movie: ${movieName}`, movieUrl ? `(${movieUrl})` : '');
        }
      }

      console.log(`✅ [Crunchboy] Successfully scraped scene`);
      return this.formatResult(metadata);

    } catch (error) {
      console.error(`❌ [Crunchboy] Error scraping scene:`, error);
      throw new Error(`Failed to scrape Crunchboy scene: ${error.message}`);
    }
  }
}

module.exports = CrunchboyScraperService;
