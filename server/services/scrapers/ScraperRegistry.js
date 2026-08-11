/**
 * Scraper Registry
 * 
 * Central registry for all scraper services.
 * Automatically detects which scraper to use based on URL.
 * Loads YAML-based scrapers from configs directory.
 * Loads Stash native scrapers via GraphQL API.
 */

const YamlScraperService = require('./YamlScraperService');
const StashNativeScraperService = require('./StashNativeScraperService');
const AebnScraper = require('./AebnScraper');
const fs = require('fs');
const path = require('path');

class ScraperRegistry {
  constructor(stashSyncService = null) {
    this.scrapers = [];
    this.stashSyncService = stashSyncService;
    this.stashNativeScrapers = [];
    this.stashNativeScrapersLoaded = false; // Track loading status
    
    // Load code-based scrapers
    this.loadCodeScrapers();
    
    // Load all YAML-based scrapers from configs directory
    this.loadYamlScrapers();
    
    // Note: Stash native scrapers are loaded async via loadStashNativeScrapers()
    // They are NOT loaded in the constructor to avoid race conditions
    
    console.debug(`📚 Scraper Registry initialized with ${this.scrapers.length} scraper(s)`);
  }

  /**
   * Load code-based scrapers (non-YAML)
   */
  loadCodeScrapers() {
    try {
      const aebnScraper = new AebnScraper();
      this.scrapers.push(aebnScraper);
      console.debug(`   ✅ Loaded code scraper: ${aebnScraper.siteName}`);
    } catch (error) {
      console.error(`   ❌ Failed to load AEBN scraper:`, error.message);
    }
  }

  /**
   * Load Stash native scrapers via GraphQL API
   * Should be called after construction to ensure async loading completes
   */
  async loadStashNativeScrapers() {
    if (!this.stashSyncService) {
      console.log('⚠️ No StashSyncService provided - skipping Stash native scrapers');
      return;
    }

    if (this.stashNativeScrapersLoaded) {
      console.log('ℹ️ Stash native scrapers already loaded');
      return;
    }

    try {
      console.debug('🔄 Loading Stash native scrapers...');
      
      // Load URL replacements config for Stash native scrapers
      const { loadUrlReplacementsConfig } = require('../../utils/urlReplacements');
      const configPath = path.join(__dirname, '../../config/stashScraperUrlReplacements.json');
      const urlReplacementsConfig = loadUrlReplacementsConfig(configPath);
      
      const stashScrapers = await this.stashSyncService.listScrapers();
      
      console.debug(`   - Found ${stashScrapers.length} Stash scraper(s)`);
      
      for (const stashScraper of stashScrapers) {
        // Only load scrapers that support scene scraping
        if (stashScraper.scene && stashScraper.scene.supported_scrapes.includes('URL')) {
          const nativeScraper = new StashNativeScraperService(
            this.stashSyncService,
            stashScraper.id,
            `${stashScraper.name} (Stash Native)`
          );
          
          // Store supported URLs for matching
          nativeScraper.supportedUrls = stashScraper.scene.urls || [];
          
          // Store supported scrape types (NAME, FRAGMENT, URL)
          nativeScraper.supportedScrapes = stashScraper.scene.supported_scrapes || [];
          
          // Apply URL replacements from config if available
          if (urlReplacementsConfig[stashScraper.id]) {
            nativeScraper.urlReplacements = urlReplacementsConfig[stashScraper.id];
            console.debug(`   🔄 Loaded ${nativeScraper.urlReplacements.length} URL replacement(s) for ${stashScraper.name}`);
          }
          
          this.scrapers.push(nativeScraper);
          this.stashNativeScrapers.push(nativeScraper);
          
          console.debug(`   ✅ Loaded Stash native: ${stashScraper.name} (${nativeScraper.supportedUrls.length} URL patterns, supports: ${nativeScraper.supportedScrapes.join(', ')})`);
        }
      }
      
      this.stashNativeScrapersLoaded = true;
      console.log(`✅ Loaded ${this.stashNativeScrapers.length} Stash native scraper(s)`);
      
    } catch (error) {
      console.error('❌ Failed to load Stash native scrapers:', error.message);
      throw error;
    }
  }

  /**
   * Load all YAML scraper configurations
   */
  loadYamlScrapers() {
    const configsDir = path.join(__dirname, 'configs');
    
    // Check if configs directory exists
    if (!fs.existsSync(configsDir)) {
      console.warn('⚠️ Scrapers configs directory not found:', configsDir);
      return;
    }
    
    // Recursive function to find all YAML files
    const findYamlFiles = (dir) => {
      const results = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Recursively search subdirectories
          results.push(...findYamlFiles(fullPath));
        } else if (entry.isFile() && (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))) {
          // Skip backup files
          if (!entry.name.endsWith('.bak')) {
            results.push(fullPath);
          }
        }
      }
      
      return results;
    };
    
    // Find all YAML files recursively
    const yamlFiles = findYamlFiles(configsDir);
    
    console.debug(`📂 Found ${yamlFiles.length} YAML scraper config(s) in ${configsDir}`);
    
    // Load each YAML scraper
    yamlFiles.forEach(yamlPath => {
      try {
        const relativePath = path.relative(configsDir, yamlPath);
        const scraper = new YamlScraperService(yamlPath);
        this.scrapers.push(scraper);
        console.debug(`   ✅ Loaded: ${scraper.siteName} (${relativePath})`);
      } catch (error) {
        const relativePath = path.relative(configsDir, yamlPath);
        console.error(`   ❌ Failed to load ${relativePath}:`, error.message);
      }
    });
  }

  /**
   * Find a scraper that can handle the given URL
   * @param {string} url - The URL to scrape
   * @returns {BaseScraperService|null} - The appropriate scraper or null
   */
  getScraperForUrl(url) {
    for (const scraper of this.scrapers) {
      if (scraper.canHandle(url)) {
        return scraper;
      }
    }
    return null;
  }

  /**
   * Get all available scrapers
   * @returns {Array<BaseScraperService>} - All registered scrapers
   */
  getAllScrapers() {
    return this.scrapers;
  }

  /**
   * Get available scrapers for a list of URLs
   * @param {Array<string>} urls - Array of URLs to check
   * @returns {Array<{name: string, scraper: BaseScraperService, url: string}>} - Available scrapers with matching URLs
   */
  getAvailableScrapers(urls) {
    const scraperMap = new Map(); // Use Map to deduplicate by scraper instance
    
    urls.forEach(url => {
      // Find ALL scrapers that can handle this URL (not just the first)
      this.scrapers.forEach(scraper => {
        if (scraper.canHandle(url) && !scraperMap.has(scraper)) {
          // Store by scraper instance to ensure uniqueness
          scraperMap.set(scraper, {
            name: scraper.siteName,
            scraper: scraper,
            url: url
          });
        }
      });
    });
    
    return Array.from(scraperMap.values());
  }

  /**
   * Reload all YAML scrapers (useful in production when configs are updated)
   * Keeps code-based scrapers intact, only reloads YAML configs
   */
  reloadYamlScrapers() {
    console.log('🔄 Reloading YAML scrapers...');
    
    // Remove all YAML scrapers (keep code-based ones like AEBN)
    this.scrapers = this.scrapers.filter(scraper => !(scraper instanceof YamlScraperService));
    
    // Reload YAML scrapers
    this.loadYamlScrapers();
    
    console.log(`✅ Reload complete - ${this.scrapers.length} total scraper(s) now registered`);
    
    return {
      success: true,
      totalScrapers: this.scrapers.length,
      yamlScrapers: this.scrapers.filter(s => s instanceof YamlScraperService).length,
      codeScrapers: this.scrapers.filter(s => !(s instanceof YamlScraperService)).length
    };
  }
}

module.exports = ScraperRegistry;
