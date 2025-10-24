/**
 * Stash Native Scraper Service
 * Wraps Stash's built-in scrapers accessed via GraphQL API
 */

const BaseScraperService = require('./BaseScraperService');

class StashNativeScraperService extends BaseScraperService {
  /**
   * @param {Object} stashSyncService - Instance of StashSyncService for GraphQL communication
   * @param {string} scraperId - Stash scraper ID
   * @param {string} scraperName - Display name for the scraper
   */
  constructor(stashSyncService, scraperId, scraperName) {
    super(scraperName);
    this.stashSyncService = stashSyncService;
    this.scraperId = scraperId;
    this.supportedUrls = []; // Will be populated by ScraperRegistry
  }

  /**
   * Check if this scraper can handle the given URL
   * @param {string} url - URL to check
   * @returns {boolean} True if this scraper can handle the URL
   */
  canHandle(url) {
    const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
    
    return this.supportedUrls.some(pattern => {
      const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      return normalizedUrl.includes(normalizedPattern);
    });
  }

  /**
   * Scrape scene from URL using Stash's native scraper
   * @param {string} url - Scene URL to scrape
   * @returns {Object} Formatted scrape result
   */
  async scrape(url) {
    console.log(`🔍 [${this.siteName}] Scraping scene via Stash native scraper: ${url}`);
    
    // Apply URL replacements if configured
    const transformedUrl = this.applyUrlReplacements(url);

    try {
      // Use Stash's scrapeURL query with this specific scraper
      const result = await this.stashSyncService.scrapeURL(transformedUrl, 'Scene');
      
      if (!result) {
        return {
          success: false,
          error: 'No data returned from Stash scraper'
        };
      }

      // Normalize the Stash response to our format
      const metadata = this._normalizeStashResult(result);
      
      console.log(`✅ [${this.siteName}] Successfully scraped scene via Stash`);
      return this.formatResult(metadata);

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error scraping via Stash:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Normalize Stash scraper result to our standard format
   * @param {Object} result - Raw result from Stash scraper
   * @returns {Object} Normalized metadata
   */
  _normalizeStashResult(result) {
    return {
      title: result.title || null,
      details: result.details || null,
      url: result.url || null,
      date: result.date || null,
      coverImage: result.image || null,
      studio: result.studio?.name || null,
      performers: result.performers?.map(p => ({ name: p.name })) || [],
      tags: result.tags?.map(t => ({ name: t.name })) || [],
      movies: result.movies?.map(m => ({ name: m.name, url: m.url })) || [],
      // Handle aliased duration fields from GraphQL query
      duration: result.scene_duration || result.movie_duration || result.duration || null
    };
  }

  /**
   * Search for scenes by title using Stash fragment scraping
   * @param {string} title - Scene title to search for
   * @param {string} studioUrl - Optional studio URL (not used by Stash native)
   * @returns {Array} Array of scene results
   */
  async searchByTitle(title, studioUrl = null) {
    console.log(`🔍 [${this.siteName}] Searching by title via Stash fragment scraping: "${title}"`);
    
    try {
      const source = {
        scraper_id: this.scraperId
      };
      
      // Use 'query' field for title search, not 'title'
      const input = {
        query: title
      };
      
      const results = await this.stashSyncService.scrapeSingleScene(input, source);
      
      if (!results || results.length === 0) {
        console.log(`   ℹ️ No results found`);
        return [];
      }
      
      console.log(`   ✅ Found ${results.length} result(s)`);
      
      // Log URLs for each result
      results.forEach((result, idx) => {
        const urls = result.urls || (result.url ? [result.url] : []);
        console.log(`   - Result ${idx + 1}: "${result.title || 'Untitled'}"`);
        if (urls.length > 0) {
          console.log(`     URLs (${urls.length}): ${urls.join(', ')}`);
        } else {
          console.log(`     URLs: none`);
        }
      });
      
      // Normalize results to match expected format
      // Each result may have multiple URLs - expand them into separate entries
      const normalized = [];
      
      results.forEach(result => {
        const urls = result.urls || (result.url ? [result.url] : []);
        
        if (urls.length === 0) {
          // No URLs, still add the result with basic info
          normalized.push({
            title: result.title,
            url: null,
            date: result.date,
            image: result.image,
            studio: result.studio?.name,
            performers: result.performers?.map(p => p.name).join(', ') || '',
            tags: result.tags?.map(t => t.name) || []
          });
        } else {
          // Create an entry for each URL, applying URL replacements
          urls.forEach(url => {
            const transformedUrl = this.applyUrlReplacements(url);
            normalized.push({
              title: result.title,
              url: transformedUrl,
              date: result.date,
              image: result.image,
              studio: result.studio?.name,
              performers: result.performers?.map(p => p.name).join(', ') || '',
              tags: result.tags?.map(t => t.name) || []
            });
          });
        }
      });
      
      console.log(`   📋 Expanded to ${normalized.length} selectable result(s)`);
      
      return normalized;
      
    } catch (error) {
      console.error(`❌ [${this.siteName}] Error searching by title:`, error);
      throw error;
    }
  }

  /**
   * Smart/Fragment scraping - Use existing clip metadata to find matches
   * This is more powerful than title-only search as it uses all available metadata
   * @param {Object} clipData - Existing clip metadata
   * @param {string} clipData.title - Scene title
   * @param {string} clipData.code - Scene code/ID
   * @param {string} clipData.details - Scene description
   * @param {string} clipData.director - Director name
   * @param {string} clipData.date - Release date (YYYY-MM-DD)
   * @param {Array<string>} clipData.urls - Array of URLs
   * @param {string} clipData.remote_site_id - Remote site ID
   * @returns {Array} Array of scene results
   */
  async scrapeByMetadata(clipData) {
    console.log(`🧠 [${this.siteName}] Smart scraping using clip metadata`);
    console.log(`   Title: "${clipData.title || 'N/A'}"`);
    console.log(`   Code: ${clipData.code || 'N/A'}`);
    console.log(`   Date: ${clipData.date || 'N/A'}`);
    console.log(`   URLs: ${clipData.urls?.length || 0} URL(s)`);
    
    try {
      const source = {
        scraper_id: this.scraperId
      };
      
      // Build scene_input from available metadata
      const sceneInput = {};
      
      if (clipData.title) sceneInput.title = clipData.title;
      if (clipData.code) sceneInput.code = clipData.code;
      if (clipData.details) sceneInput.details = clipData.details;
      if (clipData.director) sceneInput.director = clipData.director;
      if (clipData.date) sceneInput.date = clipData.date;
      if (clipData.remote_site_id) sceneInput.remote_site_id = clipData.remote_site_id;
      
      // Include URLs - apply replacements before sending to scraper
      if (clipData.urls && clipData.urls.length > 0) {
        sceneInput.urls = clipData.urls.map(url => this.applyUrlReplacements(url));
      } else if (clipData.url) {
        sceneInput.urls = [this.applyUrlReplacements(clipData.url)];
      } else {
        sceneInput.urls = [];
      }
      
      // Use scene_input for fragment scraping
      const input = {
        scene_input: sceneInput
      };
      
      const results = await this.stashSyncService.scrapeSingleScene(input, source);
      
      if (!results || results.length === 0) {
        console.log(`   ℹ️ No matches found`);
        return [];
      }
      
      console.log(`   ✅ Found ${results.length} match(es)`);
      
      // Log results
      results.forEach((result, idx) => {
        const urls = result.urls || (result.url ? [result.url] : []);
        console.log(`   - Match ${idx + 1}: "${result.title || 'Untitled'}"`);
        if (result.date) console.log(`     Date: ${result.date}`);
        if (urls.length > 0) {
          console.log(`     URLs (${urls.length}): ${urls.join(', ')}`);
        }
      });
      
      // Normalize results to match expected format
      const normalized = [];
      
      results.forEach(result => {
        const urls = result.urls || (result.url ? [result.url] : []);
        
        if (urls.length === 0) {
          // No URLs, still add the result with basic info
          normalized.push({
            title: result.title,
            url: null,
            date: result.date,
            image: result.image,
            studio: result.studio?.name,
            performers: result.performers?.map(p => p.name).join(', ') || '',
            tags: result.tags?.map(t => t.name) || [],
            details: result.details
          });
        } else {
          // Create an entry for each URL, applying URL replacements
          urls.forEach(url => {
            const transformedUrl = this.applyUrlReplacements(url);
            normalized.push({
              title: result.title,
              url: transformedUrl,
              date: result.date,
              image: result.image,
              studio: result.studio?.name,
              performers: result.performers?.map(p => p.name).join(', ') || '',
              tags: result.tags?.map(t => t.name) || [],
              details: result.details
            });
          });
        }
      });
      
      console.log(`   📋 Expanded to ${normalized.length} selectable result(s)`);
      
      return normalized;
      
    } catch (error) {
      console.error(`❌ [${this.siteName}] Error in smart scraping:`, error);
      throw error;
    }
  }

  /**
   * Search for scenes (not directly supported by URL scraping)
   * @param {Array} performers - Array of performer objects
   * @returns {Object} Error result
   */
  async searchScenes(performers) {
    console.log(`⚠️ [${this.siteName}] Scene search not supported by Stash URL scrapers`);
    return {
      success: false,
      error: 'Scene search not supported by Stash native scrapers. Use fragment scraping instead.'
    };
  }
}

module.exports = StashNativeScraperService;
