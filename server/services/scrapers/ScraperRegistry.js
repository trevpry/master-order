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
   * Get available scrapers for a list of URLs
   * @param {Array<string>} urls - Array of URLs to check
   * @returns {Array<{name: string, scraper: BaseScraperService, url: string}>} - Available scrapers with matching URLs
   */
  getAvailableScrapers(urls) {
    const availableScrapers = [];
    
    urls.forEach(url => {
      const scraper = this.getScraperForUrl(url);
      if (scraper) {
        availableScrapers.push({
          name: scraper.siteName,
          scraper: scraper,
          url: url
        });
      }
    });
    
    return availableScrapers;
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
