/**
 * YAML-Based Scraper Service
 * 
 * Generic scraper that reads configuration from YAML files
 * Compatible with Stash scraper YAML format
 */

const BaseScraperService = require('./BaseScraperService');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

class YamlScraperService extends BaseScraperService {
  constructor(yamlFilePath) {
    super();
    
    // Load and parse YAML configuration
    const yamlContent = fs.readFileSync(yamlFilePath, 'utf8');
    this.config = yaml.load(yamlContent);
    
    this.name = `${this.config.name} Scraper`;
    this.siteName = this.config.name;
    this.yamlPath = yamlFilePath;
    
    // Extract URL patterns from sceneByURL configuration
    this.sceneUrlPatterns = [];
    if (this.config.sceneByURL) {
      this.config.sceneByURL.forEach(scraper => {
        if (scraper.url) {
          this.sceneUrlPatterns.push(...scraper.url);
        }
      });
    }
    
    console.log(`📋 Loaded YAML scraper: ${this.siteName}`);
    console.log(`   - Scene URL patterns: ${this.sceneUrlPatterns.length}`);
  }

  /**
   * Check if this scraper can handle the given URL
   */
  canHandle(url) {
    if (!url) return false;
    
    // Check if URL matches any of the scene URL patterns
    return this.sceneUrlPatterns.some(pattern => {
      // Remove protocol and www for comparison
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      return normalizedUrl.includes(normalizedPattern);
    });
  }

  /**
   * Apply XPath selector from YAML config
   */
  applyXPath($, element, selector) {
    if (typeof selector === 'string') {
      // Simple XPath-like selector (convert to jQuery)
      const jquerySelector = this.xpathToJquery(selector);
      const result = element ? $(element).find(jquerySelector) : $(jquerySelector);
      return result.length > 0 ? result : null;
    } else if (selector.selector) {
      // Complex selector with post-processing
      const jquerySelector = this.xpathToJquery(selector.selector);
      const result = element ? $(element).find(jquerySelector) : $(jquerySelector);
      
      if (result.length === 0) return null;
      
      let value = result.first().text();
      
      // Apply post-processing if defined
      if (selector.postProcess) {
        value = this.applyPostProcess(value, selector.postProcess);
      }
      
      return value;
    }
    
    return null;
  }

  /**
   * Convert XPath to jQuery selector (improved conversion)
   */
  xpathToJquery(xpath) {
    // This is a simplified converter for common XPath patterns used in Stash scrapers
    
    let selector = xpath;
    
    // Handle attribute extraction (ends with /@attribute)
    const attrMatch = selector.match(/\/@(\w+)$/);
    if (attrMatch) {
      // Remove the attribute part, we'll handle it separately
      selector = selector.replace(/\/@\w+$/, '');
    }
    
    // Handle text() extraction
    if (selector.endsWith('/text()')) {
      selector = selector.replace(/\/text\(\)$/, '');
    }
    
    // Convert // to nothing (descendant)
    selector = selector.replace(/^\/\//, '');
    
    // Handle complex attribute conditions with 'and'
    // Example: [@rel="alternate" and @hreflang="en"]
    selector = selector.replace(/\[@(\w+)="([^"]+)"\s+and\s+@(\w+)="([^"]+)"\]/g, '[$1="$2"][$3="$4"]');
    
    // Handle multiple contains() with 'and'
    // Example: [contains(@class, "val1") and contains(@class, "val2")]
    while (selector.includes('contains') && selector.includes(' and ')) {
      selector = selector.replace(
        /\[contains\(@(\w+),\s*["']([^"']+)["']\)\s+and\s+contains\(@\1,\s*["']([^"']+)["']\)\]/g,
        '[$1*="$2"][$1*="$3"]'
      );
      // Break if no more replacements (avoid infinite loop)
      if (!selector.match(/\[contains\(@(\w+),\s*["']([^"']+)["']\)\s+and\s+contains\(@\1,\s*["']([^"']+)["']\)\]/)) {
        break;
      }
    }
    
    // Handle simple attribute conditions
    // Example: [@class="test"]
    selector = selector.replace(/\[@(\w+)="([^"]+)"\]/g, '[$1="$2"]');
    
    // Handle contains() for class attributes
    // Example: [contains(@class, "value")]
    selector = selector.replace(/\[contains\(@class,\s*["']([^"']+)["']\)\]/g, '[class*="$1"]');
    
    // Handle contains() for other attributes  
    // Example: [contains(@href, "value")]
    selector = selector.replace(/\[contains\(@(\w+),\s*["']([^"']+)["']\)\]/g, '[$1*="$2"]');
    
    // Handle contains(text(), "value") - convert to :contains() selector
    // Example: //li[contains(text(),"Added:")] -> li:contains("Added:")
    selector = selector.replace(/\[contains\(text\(\),\s*["']([^"']+)["']\)\]/g, ':contains("$1")');
    
    // Handle not() conditions
    // Example: [not(i)]
    selector = selector.replace(/\[not\(([^)]+)\)\]/g, ':not($1)');
    
    // Handle descendant with specific path (but preserve attribute values)
    // Replace / with space, but be careful not to mess up attribute values
    // Only replace / that are NOT inside [...] brackets
    let result = '';
    let inBrackets = 0;
    for (let i = 0; i < selector.length; i++) {
      const char = selector[i];
      if (char === '[') inBrackets++;
      else if (char === ']') inBrackets--;
      else if (char === '/' && inBrackets === 0) {
        result += ' ';
        continue;
      }
      result += char;
    }
    selector = result;
    
    // Clean up multiple spaces
    selector = selector.replace(/\s+/g, ' ').trim();
    
    return selector;
  }

  /**
   * Apply post-processing rules from YAML
   */
  applyPostProcess(value, postProcess) {
    console.log(`   🔧 applyPostProcess called with value: "${value}"`);
    console.log(`   🔧 postProcess rules:`, JSON.stringify(postProcess, null, 2));
    
    postProcess.forEach(rule => {
      if (rule.replace) {
        console.log(`   🔄 Applying replace rule:`, rule.replace);
        rule.replace.forEach(replacement => {
          if (replacement.regex) {
            const regex = new RegExp(replacement.regex);
            const oldValue = value;
            value = value.replace(regex, replacement.with || '');
            console.log(`   🔄 Replace: "${oldValue}" → "${value}"`);
          }
        });
      }
      
      if (rule.parseDate) {
        // Parse date using Go-style format and convert to YYYY-MM-DD
        console.log(`   🔍 Parsing date "${value}" with format "${rule.parseDate}"`);
        const parsedValue = this.parseDate(value, rule.parseDate);
        console.log(`   ✅ Parsed date result: "${parsedValue}"`);
        value = parsedValue;
      }
    });
    
    console.log(`   🔧 applyPostProcess final value: "${value}"`);
    return value;
  }

  /**
   * Parse date string using Go-style format
   * Converts to YYYY-MM-DD format
   * 
   * Go date format reference:
   * 02 = day (01-31)
   * 01 = month (01-12)  
   * 2006 = year
   * 
   * Example: "02-01-2006" means DD-MM-YYYY
   */
  parseDate(dateString, formatString) {
    if (!dateString || !formatString) return dateString;

    try {
      // Build regex from Go format string
      // 02 = day, 01 = month, 2006 = year
      let regexPattern = formatString
        .replace(/2006/g, '(\\d{4})')  // Year
        .replace(/01/g, '(\\d{1,2})')  // Month
        .replace(/02/g, '(\\d{1,2})'); // Day
      
      // Escape special regex characters in separators
      regexPattern = regexPattern.replace(/[-\/]/g, (match) => '\\' + match);
      
      const regex = new RegExp(regexPattern);
      const match = dateString.match(regex);
      
      if (!match) {
        console.warn(`   ⚠️ Date "${dateString}" doesn't match format "${formatString}"`);
        return dateString;
      }

      // Determine which capture group is which based on format string
      const yearIndex = formatString.indexOf('2006');
      const monthIndex = formatString.indexOf('01');
      const dayIndex = formatString.indexOf('02');
      
      // Create array of positions
      const positions = [
        { type: 'year', index: yearIndex },
        { type: 'month', index: monthIndex },
        { type: 'day', index: dayIndex }
      ].sort((a, b) => a.index - b.index);
      
      // Map capture groups to date parts
      const parts = {};
      positions.forEach((pos, idx) => {
        parts[pos.type] = match[idx + 1];
      });
      
      // Pad month and day with leading zeros if needed
      const year = parts.year;
      const month = parts.month.padStart(2, '0');
      const day = parts.day.padStart(2, '0');
      
      // Return in YYYY-MM-DD format
      return `${year}-${month}-${day}`;
      
    } catch (error) {
      console.warn(`   ⚠️ Error parsing date "${dateString}" with format "${formatString}":`, error.message);
      return dateString;
    }
  }

  /**
   * Extract value from element using YAML config
   */
  extractValue($, config) {
    if (!config) return null;
    
    if (typeof config === 'string') {
      // Simple XPath selector - convert and extract
      const originalXpath = config;
      
      // Check if it's an attribute selector
      const attrMatch = originalXpath.match(/\/@(\w+)$/);
      const attributeName = attrMatch ? attrMatch[1] : null;
      
      // Convert XPath to jQuery
      const selector = this.xpathToJquery(originalXpath);
      
      try {
        const element = $(selector).first();
        
        if (element.length === 0) return null;
        
        // Extract attribute or text
        if (attributeName) {
          return element.attr(attributeName) || null;
        }
        
        return element.text().trim() || null;
      } catch (error) {
        console.warn(`   ⚠️ Selector error for "${selector}":`, error.message);
        console.warn(`   ⚠️ Original XPath: "${originalXpath}"`);
        return null;
      }
    } else if (config.selector) {
      // Complex selector with post-processing
      const originalXpath = config.selector;
      
      // Check if it's an attribute selector
      const attrMatch = originalXpath.match(/\/@(\w+)$/);
      const attributeName = attrMatch ? attrMatch[1] : null;
      
      // Convert XPath to jQuery
      const selector = this.xpathToJquery(originalXpath);
      
      try {
        const element = $(selector).first();
        
        if (element.length === 0) return null;
        
        // Get value (text or attribute)
        let value;
        if (attributeName) {
          value = element.attr(attributeName) || '';
        } else {
          value = element.text() || element.html() || '';
        }
        
        // Apply post-processing
        if (config.postProcess) {
          value = this.applyPostProcess(value, config.postProcess);
        }
        
        return value.trim() || null;
      } catch (error) {
        console.warn(`   ⚠️ Selector error for "${selector}":`, error.message);
        console.warn(`   ⚠️ Original XPath: "${originalXpath}"`);
        return null;
      }
    } else if (config.fixed) {
      // Fixed value
      return config.fixed;
    }
    
    return null;
  }

  /**
   * Extract array of values from elements
   */
  extractArray($, config) {
    const results = [];
    
    if (!config) return results;
    
    // Handle complex config with selector and postProcess
    if (typeof config === 'object' && config.selector) {
      const originalXpath = config.selector;
      
      // Check if it's an attribute selector
      const attrMatch = originalXpath.match(/\/@(\w+)$/);
      const attributeName = attrMatch ? attrMatch[1] : null;
      
      const selector = this.xpathToJquery(config.selector);
      
      try {
        $(selector).each((i, el) => {
          let value;
          
          // Extract attribute or text
          if (attributeName) {
            value = $(el).attr(attributeName);
          } else {
            value = $(el).text().trim();
          }
          
          // Apply post-processing if defined
          if (value && config.postProcess) {
            value = this.applyPostProcess(value, config.postProcess);
          }
          
          if (value && value.trim() !== '') {
            results.push(value.trim());
          }
        });
      } catch (error) {
        console.warn(`   ⚠️ Array selector error for "${selector}":`, error.message);
        console.warn(`   ⚠️ Original XPath: "${originalXpath}"`);
      }
      
      return results;
    }
    
    // Handle simple string XPath selector (legacy format)
    const originalXpath = config;
    
    // Check if it's an attribute selector
    const attrMatch = originalXpath.match(/\/@(\w+)$/);
    const attributeName = attrMatch ? attrMatch[1] : null;
    
    const selector = this.xpathToJquery(config);
    
    try {
      $(selector).each((i, el) => {
        let value;
        
        // Extract attribute or text
        if (attributeName) {
          value = $(el).attr(attributeName);
        } else {
          value = $(el).text().trim();
        }
        
        if (value && value.trim() !== '') {
          results.push(value.trim());
        }
      });
    } catch (error) {
      console.warn(`   ⚠️ Array selector error for "${selector}":`, error.message);
      console.warn(`   ⚠️ Original XPath: "${originalXpath}"`);
    }
    
    return results;
  }

  /**
   * Scrape metadata from URL using YAML configuration
   */
  async scrape(url) {
    console.log(`🔍 [${this.siteName}] Scraping scene: ${url}`);

    try {
      const $ = await this.fetchHtml(url);

      // Find the scene scraper configuration
      const sceneScraper = this.config.sceneByURL[0];
      const scraperName = sceneScraper.scraper;
      const scraperConfig = this.config.xPathScrapers[scraperName];
      
      if (!scraperConfig || !scraperConfig.scene) {
        throw new Error(`Scraper configuration not found: ${scraperName}`);
      }

      const sceneConfig = scraperConfig.scene;
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

      // Extract Title
      if (sceneConfig.Title) {
        metadata.title = this.extractValue($, sceneConfig.Title);
        if (metadata.title) {
          console.log(`   - Title: ${metadata.title}`);
        }
      }

      // Extract Details
      if (sceneConfig.Details) {
        metadata.details = this.extractValue($, sceneConfig.Details);
        if (metadata.details) {
          console.log(`   - Details: ${metadata.details}`);
        }
      }

      // Extract URL (canonical)
      if (sceneConfig.URL) {
        const extractedUrl = this.extractValue($, sceneConfig.URL);
        if (extractedUrl) {
          metadata.url = extractedUrl;
          console.log(`   - Canonical URL: ${metadata.url}`);
        }
      }

      // Extract Date
      if (sceneConfig.Date) {
        console.log(`   🔍 Extracting Date with config:`, JSON.stringify(sceneConfig.Date, null, 2));
        metadata.date = this.extractValue($, sceneConfig.Date);
        console.log(`   📅 Date extraction result: "${metadata.date}"`);
        if (metadata.date) {
          console.log(`   - Date: ${metadata.date}`);
        } else {
          console.log(`   ⚠️ Date is null/empty after extraction`);
        }
      }

      // Extract Cover Image
      if (sceneConfig.Image) {
        metadata.coverImage = this.extractValue($, sceneConfig.Image);
        if (metadata.coverImage) {
          console.log(`   - Cover image: ${metadata.coverImage}`);
        }
      }

      // Extract Studio
      if (sceneConfig.Studio && sceneConfig.Studio.Name) {
        metadata.studio = this.extractValue($, sceneConfig.Studio.Name);
        if (metadata.studio) {
          console.log(`   - Studio: ${metadata.studio}`);
        }
      }

      // Extract Performers
      if (sceneConfig.Performers && sceneConfig.Performers.Name) {
        const performerNames = this.extractArray($, sceneConfig.Performers.Name);
        metadata.performers = performerNames.map(name => ({ name, url: null }));
        
        // Extract performer URLs if configured
        if (sceneConfig.Performers.URL) {
          const performerUrls = this.extractArray($, sceneConfig.Performers.URL);
          // Match URLs to performers by index
          performerUrls.forEach((url, index) => {
            if (metadata.performers[index]) {
              // Convert relative URL to absolute
              if (url && !url.startsWith('http')) {
                url = this.absUrl(url, metadata.url);
              }
              metadata.performers[index].url = url;
            }
          });
        }
        
        if (metadata.performers.length > 0) {
          console.log(`   - Found ${metadata.performers.length} performer(s):`, 
            metadata.performers.map(p => p.url ? `${p.name} (${p.url})` : p.name).join(', '));
        }
      }

      // Extract Tags
      if (sceneConfig.Tags && sceneConfig.Tags.Name) {
        const tagNames = this.extractArray($, sceneConfig.Tags.Name);
        metadata.tags = tagNames.map(name => ({ name }));
        if (metadata.tags.length > 0) {
          console.log(`   - Found ${metadata.tags.length} tag(s):`, 
            metadata.tags.map(t => t.name).join(', '));
        }
      }

      // Extract Movies
      if (sceneConfig.Movies && sceneConfig.Movies.Name) {
        const movieName = this.extractValue($, sceneConfig.Movies.Name);
        if (movieName) {
          const movie = { name: movieName, url: null };
          
          // Extract movie URL if configured
          if (sceneConfig.Movies.URL) {
            movie.url = this.extractValue($, sceneConfig.Movies.URL);
            // Convert relative URL to absolute
            if (movie.url && !movie.url.startsWith('http')) {
              movie.url = this.absUrl(movie.url, url);
            }
          }
          
          metadata.movies.push(movie);
          console.log(`   - Found movie: ${movieName}`, movie.url ? `(${movie.url})` : '');
        }
      }

      console.log(`✅ [${this.siteName}] Successfully scraped scene`);
      return this.formatResult(metadata);

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error scraping scene:`, error);
      throw new Error(`Failed to scrape ${this.siteName} scene: ${error.message}`);
    }
  }
}

module.exports = YamlScraperService;
