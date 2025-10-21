/**
 * Scraper Registry
 * 
 * Central registry for all scraper services.
 * Automatically detects which scraper to use based on URL.
 * Loads YAML-based scrapers from configs directory.
 */

const YamlScraperService = require('./YamlScraperService');
const AebnScraper = require('./AebnScraper');
const fs = require('fs');
const path = require('path');

class ScraperRegistry {
  constructor() {
    this.scrapers = [];
    
    // Load code-based scrapers
    this.loadCodeScrapers();
    
    // Load all YAML-based scrapers from configs directory
    this.loadYamlScrapers();
    
    console.log(`📚 Scraper Registry initialized with ${this.scrapers.length} scraper(s)`);
  }

  /**
   * Load code-based scrapers (non-YAML)
   */
  loadCodeScrapers() {
    try {
      const aebnScraper = new AebnScraper();
      this.scrapers.push(aebnScraper);
      console.log(`   ✅ Loaded code scraper: ${aebnScraper.siteName}`);
    } catch (error) {
      console.error(`   ❌ Failed to load AEBN scraper:`, error.message);
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
    
    // Read all .yml and .yaml files
    const files = fs.readdirSync(configsDir).filter(file => 
      file.endsWith('.yml') || file.endsWith('.yaml')
    );
    
    console.log(`📂 Found ${files.length} YAML scraper config(s) in ${configsDir}`);
    
    // Load each YAML scraper
    files.forEach(file => {
      try {
        const yamlPath = path.join(configsDir, file);
        const scraper = new YamlScraperService(yamlPath);
        this.scrapers.push(scraper);
        console.log(`   ✅ Loaded: ${scraper.siteName} (${file})`);
      } catch (error) {
        console.error(`   ❌ Failed to load ${file}:`, error.message);
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
   * Check which scrapers can handle URLs from a scene
   * @param {Array<string>} urls - Array of URLs to check
   * @returns {Array<Object>} - Array of {scraper, url, name} objects (one per matching URL)
   */
  getAvailableScrapers(urls) {
    if (!urls || !Array.isArray(urls)) return [];

    const available = [];
    
    for (const url of urls) {
      const scraper = this.getScraperForUrl(url);
      if (scraper) {
        // Add an entry for each URL that has a matching scraper
        // (even if the same scraper handles multiple URLs)
        available.push({
          scraper,
          url,
          name: scraper.siteName,
          canHandle: true
        });
      }
    }

    return available;
  }
}

module.exports = ScraperRegistry;
