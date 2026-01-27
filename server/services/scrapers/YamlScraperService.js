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
    this.yamlDir = path.dirname(yamlFilePath);
    
    // Check if this is a script-based scraper
    this.isScriptBased = this._detectScriptBased();
    
    // Load URL replacements from config
    this.urlReplacements = this.config.urlReplacements || [];
    
    // Extract URL patterns from sceneByURL configuration
    this.sceneUrlPatterns = [];
    if (this.config.sceneByURL) {
      this.config.sceneByURL.forEach(scraper => {
        if (scraper.url) {
          this.sceneUrlPatterns.push(...scraper.url);
        }
      });
    }
    
    // Extract URL patterns from movieByURL configuration
    this.movieUrlPatterns = [];
    if (this.config.movieByURL) {
      this.config.movieByURL.forEach(scraper => {
        if (scraper.url) {
          this.movieUrlPatterns.push(...scraper.url);
        }
      });
    }
    
    console.log(`📋 Loaded YAML scraper: ${this.siteName}`);
    console.log(`   - Type: ${this.isScriptBased ? 'Script-based' : 'XPath-based'}`);
    if (this.urlReplacements.length > 0) {
      console.log(`   - URL Replacements: ${this.urlReplacements.length} rule(s) configured`);
    };
    console.log(`   - Scene URL patterns: ${this.sceneUrlPatterns.length}`);
    console.log(`   - Movie URL patterns: ${this.movieUrlPatterns.length}`);
  }

  /**
   * Detect if this scraper uses external scripts
   */
  _detectScriptBased() {
    const checkAction = (config) => {
      if (!config) return false;
      if (Array.isArray(config)) {
        return config.some(item => item.action === 'script');
      }
      return config.action === 'script';
    };

    return (
      checkAction(this.config.sceneByURL) ||
      checkAction(this.config.sceneByFragment) ||
      checkAction(this.config.sceneByName) ||
      checkAction(this.config.galleryByURL) ||
      checkAction(this.config.performerByName)
    );
  }

  /**
   * Execute an external script
   */
  async _executeScript(scriptConfig, operation, args) {
    const { spawn } = require('child_process');
    
    if (!scriptConfig || !Array.isArray(scriptConfig) || scriptConfig.length < 2) {
      throw new Error('Invalid script configuration');
    }
    
    const [executor, scriptFile, ...scriptArgs] = scriptConfig;
    const scriptPath = path.join(this.yamlDir, scriptFile);
    
    // Check if script file exists
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script file not found: ${scriptPath}`);
    }
    
    console.log(`   🔧 Executing script: ${executor} ${scriptFile} ${operation}`);
    console.log(`   📝 Args:`, JSON.stringify(args));
    
    return new Promise((resolve, reject) => {
      const process = spawn(executor, [scriptPath, operation, JSON.stringify(args)], {
        cwd: this.yamlDir
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`   ❌ Script failed with code ${code}`);
          console.error(`   stderr:`, stderr);
          reject(new Error(`Script exited with code ${code}: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          console.log(`   ✅ Script completed successfully`);
          resolve(result);
        } catch (error) {
          console.error(`   ❌ Failed to parse script output as JSON`);
          console.error(`   stdout:`, stdout);
          reject(new Error(`Failed to parse script output: ${error.message}`));
        }
      });
      
      process.on('error', (error) => {
        reject(new Error(`Failed to execute script: ${error.message}`));
      });
    });
  }

  /**
   * Check if this scraper can handle the given URL
   */
  canHandle(url) {
    if (!url) return false;
    
    // Check if URL matches any of the scene URL patterns
    const matchesScene = this.sceneUrlPatterns.some(pattern => {
      // Remove protocol and www for comparison
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      
      // Extract domain from both URL and pattern (everything before first /)
      const urlDomain = normalizedUrl.split('/')[0];
      const patternDomain = normalizedPattern.split('/')[0];
      
      // Domain must match, then check if URL starts with the full pattern
      return urlDomain === patternDomain && normalizedUrl.startsWith(normalizedPattern);
    });
    
    if (matchesScene) return true;
    
    // Check if URL matches any of the movie URL patterns
    const matchesMovie = this.movieUrlPatterns.some(pattern => {
      const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
      
      // Extract domain from both URL and pattern
      const urlDomain = normalizedUrl.split('/')[0];
      const patternDomain = normalizedPattern.split('/')[0];
      
      // Domain must match, then check if URL starts with the full pattern
      return urlDomain === patternDomain && normalizedUrl.startsWith(normalizedPattern);
    });
    
    return matchesMovie;
  }

  /**
   * Normalize script output to match expected format
   */
  _normalizeScriptResult(result) {
    if (!result) return null;
    
    // Scripts may return data in various formats, normalize to our expected structure
    return {
      url: result.url || null,
      title: result.title || null,
      details: result.details || result.synopsis || null,
      studio: result.studio?.name || result.studio || null, // Extract name if object, or use string directly
      date: result.date || null,
      coverImage: result.image || result.images?.[0] || null,
      performers: result.performers || [],
      tags: result.tags || [],
      movies: result.movies || [],
      duration: result.duration || null
    };
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
    
    // Handle parent:: axis - mark it for special processing
    // Example: //h3[@class="h90"]/parent::a -> h3[class="h90"]::PARENT::a
    const hasParent = selector.includes('/parent::');
    if (hasParent) {
      selector = selector.replace(/\/parent::/g, '::PARENT::');
    }
    
    // Convert // to nothing (descendant)
    selector = selector.replace(/^\/\//, '');
    
    // Handle mixed attribute conditions with 'and' (e.g., [@class="value" and contains(@href, "text")])
    // This must come BEFORE other replacements
    selector = selector.replace(
      /\[@(\w+)="([^"]+)"\s+and\s+contains\(@(\w+),\s*["']([^"']+)["']\)\]/g,
      '[$1="$2"][$3*="$4"]'
    );
    
    // Handle reverse order (e.g., [contains(@href, "text") and @class="value"])
    selector = selector.replace(
      /\[contains\(@(\w+),\s*["']([^"']+)["']\)\s+and\s+@(\w+)="([^"]+)"\]/g,
      '[$1*="$2"][$3="$4"]'
    );
    
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
    // Special handling for class attributes with multiple values
    selector = selector.replace(/\[@class="([^"]+)"\]/g, (match, classes) => {
      // If class has multiple space-separated values, convert to multiple class selectors
      if (classes.includes(' ')) {
        const classNames = classes.split(/\s+/).filter(c => c);
        return classNames.map(c => `[class*="${c}"]`).join('');
      }
      return `[class="${classes}"]`;
    });
    
    // Handle other attribute conditions
    selector = selector.replace(/\[@(\w+)="([^"]+)"\]/g, '[$1="$2"]');
    
    // Handle text() = "value" - convert to :contains() selector
    // Example: //strong[text() = "From:"] -> strong:contains("From:")
    selector = selector.replace(/\[text\(\)\s*=\s*["']([^"']+)["']\]/g, ':contains("$1")');
    
    // Handle contains() for class attributes
    // Example: [contains(@class, "value")]
    selector = selector.replace(/\[contains\(@class,\s*["']([^"']+)["']\)\]/g, '[class*="$1"]');
    
    // Handle contains() for other attributes  
    // Example: [contains(@href, "value")]
    selector = selector.replace(/\[contains\(@(\w+),\s*["']([^"']+)["']\)\]/g, '[$1*="$2"]');
    
    // Handle contains(text(), "value") - convert to :contains() selector
    // Example: //li[contains(text(),"Added:")] -> li:contains("Added:")
    selector = selector.replace(/\[contains\(text\(\),\s*["']([^"']+)["']\)\]/g, ':contains("$1")');
    
    // Handle contains(., "value") - convert to :contains() selector
    // Example: //p[contains(.,'Guys')]/a -> p:contains("Guys") a
    selector = selector.replace(/\[contains\(\.,\s*["']([^"']+)["']\)\]/g, ':contains("$1")');
    
    // Handle not() conditions
    // Example: [not(i)]
    selector = selector.replace(/\[not\(([^)]+)\)\]/g, ':not($1)');
    
    // Handle numeric position selectors [1], [2], etc.
    // XPath uses 1-based indexing, jQuery uses 0-based
    // Example: p[1] -> p:eq(0), div[3] -> div:eq(2)
    selector = selector.replace(/\[(\d+)\]/g, (match, num) => {
      const index = parseInt(num) - 1; // Convert from 1-based to 0-based
      return `:eq(${index})`;
    });
    
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
      
      // Special handling for following-sibling:: which jQuery doesn't support directly
      if (originalXpath.includes('/following-sibling::')) {
        const parts = originalXpath.split('/following-sibling::');
        const basePath = parts[0];
        const siblingPath = parts[1];
        
        // Extract just the element name and position from sibling path
        const siblingMatch = siblingPath.match(/^(\w+)\[(\d+)\](\/text\(\)|\/\@(\w+))?$/);
        if (siblingMatch) {
          const siblingTag = siblingMatch[1];
          const position = parseInt(siblingMatch[2]) - 1; // Convert 1-based to 0-based
          const extractAttr = siblingMatch[4] || attributeName;
          
          // Convert base path to jQuery selector
          const baseSelector = this.xpathToJquery(basePath);
          
          console.log(`   🔍 extractValue (following-sibling) - Base selector: "${baseSelector}"`);
          console.log(`   🔍 extractValue (following-sibling) - Looking for sibling: ${siblingTag} at position ${position}`);
          
          try {
            const baseElement = $(baseSelector).first();
            if (baseElement.length > 0) {
              // Get all following siblings of the matching tag
              const siblings = baseElement.nextAll(siblingTag);
              console.log(`   🔍 extractValue (following-sibling) - Found ${siblings.length} ${siblingTag} siblings`);
              
              if (siblings.length > position) {
                const targetElement = siblings.eq(position);
                if (extractAttr) {
                  const value = targetElement.attr(extractAttr);
                  console.log(`   🔍 extractValue (following-sibling) - Extracted attribute "${extractAttr}": "${value}"`);
                  return value || null;
                } else {
                  const value = targetElement.text().trim();
                  console.log(`   🔍 extractValue (following-sibling) - Extracted text: "${value}"`);
                  return value || null;
                }
              }
            }
            console.log(`   ❌ extractValue (following-sibling) - No matching sibling found`);
            return null;
          } catch (error) {
            console.warn(`   ⚠️ following-sibling error:`, error.message);
            return null;
          }
        }
      }
      
      // Convert XPath to jQuery
      const selector = this.xpathToJquery(originalXpath);
      
      console.log(`   🔍 extractValue - Original XPath: "${originalXpath}"`);
      console.log(`   🔍 extractValue - Converted selector: "${selector}"`);
      console.log(`   🔍 extractValue - Attribute to extract: "${attributeName}"`);
      
      try {
        const element = $(selector).first();
        
        console.log(`   🔍 extractValue - Found ${$(selector).length} elements`);
        console.log(`   🔍 extractValue - Element length: ${element.length}`);
        
        if (element.length === 0) {
          console.log(`   ❌ extractValue - No elements found for selector: "${selector}"`);
          return null;
        }
        
        // Extract attribute or text
        if (attributeName) {
          const attrValue = element.attr(attributeName);
          console.log(`   🔍 extractValue - Attribute "${attributeName}" value: "${attrValue}"`);
          return attrValue || null;
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
      
      console.log(`   🔍 extractValue (complex) - Original XPath: "${originalXpath}"`);
      console.log(`   🔍 extractValue (complex) - Converted selector: "${selector}"`);
      console.log(`   🔍 extractValue (complex) - Attribute to extract: "${attributeName}"`);
      
      try {
        const element = $(selector).first();
        
        console.log(`   🔍 extractValue (complex) - Found ${$(selector).length} elements`);
        console.log(`   🔍 extractValue (complex) - Element length: ${element.length}`);
        
        if (element.length === 0) {
          console.log(`   ❌ extractValue (complex) - No elements found for selector: "${selector}"`);
          return null;
        }
        
        // Get value (text or attribute)
        let value;
        if (attributeName) {
          value = element.attr(attributeName) || '';
          console.log(`   🔍 extractValue (complex) - Attribute "${attributeName}" value: "${value}"`);
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
      
      // Check if this uses parent:: axis
      const parentMatch = selector.match(/^(.+?)::PARENT::(.*)$/);
      
      try {
        if (parentMatch) {
          // Handle parent:: axis - find child elements, then get their parents
          const childSelector = parentMatch[1];
          const afterParent = parentMatch[2].trim();
          
          $(childSelector).each((i, el) => {
            let parentEl = $(el).parent();
            
            // If there's a selector after parent::, filter by it
            if (afterParent && !parentEl.is(afterParent)) {
              return; // Skip this element
            }
            
            let value;
            if (attributeName) {
              value = parentEl.attr(attributeName);
            } else {
              value = parentEl.text().trim();
            }
            
            // Apply post-processing if defined
            if (value && config.postProcess) {
              value = this.applyPostProcess(value, config.postProcess);
            }
            
            if (value && value.trim() !== '') {
              results.push(value.trim());
            }
          });
        } else {
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
        }
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
    
    // Check if this uses parent:: axis
    const parentMatch = selector.match(/^(.+?)::PARENT::(.*)$/);
    
    try {
      if (parentMatch) {
        // Handle parent:: axis - find child elements, then get their parents
        const childSelector = parentMatch[1];
        const afterParent = parentMatch[2].trim();
        
        $(childSelector).each((i, el) => {
          let parentEl = $(el).parent();
          
          // If there's a selector after parent::, filter by it
          if (afterParent && !parentEl.is(afterParent)) {
            return; // Skip this element
          }
          
          let value;
          if (attributeName) {
            value = parentEl.attr(attributeName);
          } else {
            value = parentEl.text().trim();
          }
          
          if (value && value.trim() !== '') {
            results.push(value.trim());
          }
        });
      } else {
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
      }
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
    
    // Apply URL replacements if configured
    const transformedUrl = this.applyUrlReplacements(url);

    try {
      // Check if this is a script-based scraper
      if (this.isScriptBased && this.config.sceneByURL) {
        const sceneConfig = Array.isArray(this.config.sceneByURL) 
          ? this.config.sceneByURL[0] 
          : this.config.sceneByURL;
        
        if (sceneConfig.action === 'script' && sceneConfig.script) {
          console.log(`   🔧 Using script-based scraping`);
          const result = await this._executeScript(sceneConfig.script, 'scene-by-url', { url: transformedUrl });
          const normalized = this._normalizeScriptResult(result);
          console.log(`✅ [${this.siteName}] Successfully scraped scene via script`);
          return this.formatResult(normalized);
        }
      }

      // XPath-based scraping (existing code)
      const $ = await this.fetchHtml(transformedUrl);

      // Debug: Check what images exist in the HTML
      console.log(`   🔍 DEBUG - Checking all img tags in HTML:`);
      const allImgs = $('img');
      console.log(`   🔍 DEBUG - Found ${allImgs.length} total img tags`);
      allImgs.each((i, el) => {
        const src = $(el).attr('src');
        const className = $(el).attr('class');
        console.log(`   🔍 DEBUG - img[${i}]: class="${className}", src="${src}"`);
      });
      
      // Debug: Check for div with id="preview"
      const previewDiv = $('div[id="preview"]');
      console.log(`   🔍 DEBUG - Found ${previewDiv.length} div with id="preview"`);
      if (previewDiv.length > 0) {
        console.log(`   🔍 DEBUG - Preview div HTML (first 500 chars):`, previewDiv.html().substring(0, 500));
      }
      
      // Debug: Check for video tags
      const videos = $('video');
      console.log(`   🔍 DEBUG - Found ${videos.length} video tags`);
      videos.each((i, el) => {
        const poster = $(el).attr('poster');
        const src = $(el).attr('src');
        console.log(`   🔍 DEBUG - video[${i}]: poster="${poster}", src="${src}"`);
      });
      
      // Debug: Check for mejs class
      const mejsImgs = $('img[class*="mejs"]');
      console.log(`   🔍 DEBUG - Found ${mejsImgs.length} img tags with "mejs" in class`);

      // Find the matching scene scraper configuration based on URL
      let sceneScraper = null;
      if (Array.isArray(this.config.sceneByURL)) {
        // Find the scraper config that matches the URL
        for (const config of this.config.sceneByURL) {
          if (config.url && Array.isArray(config.url)) {
            const normalizedUrl = transformedUrl.toLowerCase();
            const matches = config.url.some(pattern => {
              const normalizedPattern = pattern.toLowerCase();
              return normalizedUrl.includes(normalizedPattern);
            });
            if (matches) {
              sceneScraper = config;
              console.log(`   📌 Matched scraper config for URL patterns: ${config.url.join(', ')}`);
              break;
            }
          }
        }
        
        // Fall back to first config if no match found
        if (!sceneScraper) {
          console.log(`   ⚠️ No URL pattern matched, using first scraper config`);
          sceneScraper = this.config.sceneByURL[0];
        }
      } else {
        sceneScraper = this.config.sceneByURL;
      }
      
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
          // Convert acute accent to apostrophe
          metadata.details = metadata.details.replace(/´/g, "'");
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
        // Resolve variable references from common section
        let performerNameSelector = sceneConfig.Performers.Name;
        let performerUrlSelector = sceneConfig.Performers.URL;
        
        // Check if selectors reference variables (start with $)
        if (scraperConfig.common) {
          // Replace variable references
          if (typeof performerNameSelector === 'string' && performerNameSelector.startsWith('$')) {
            const varMatch = performerNameSelector.match(/^\$(\w+)(.*)/);
            if (varMatch) {
              const varName = '$' + varMatch[1];
              const suffix = varMatch[2];
              if (scraperConfig.common[varName]) {
                performerNameSelector = scraperConfig.common[varName] + suffix;
              }
            }
          }
          
          if (typeof performerUrlSelector === 'string' && performerUrlSelector.startsWith('$')) {
            const varMatch = performerUrlSelector.match(/^\$(\w+)(.*)/);
            if (varMatch) {
              const varName = '$' + varMatch[1];
              const suffix = varMatch[2];
              if (scraperConfig.common[varName]) {
                performerUrlSelector = scraperConfig.common[varName] + suffix;
              }
            }
          }
        }
        
        const performerNames = this.extractArray($, performerNameSelector);
        metadata.performers = performerNames.map(name => ({ name, url: null }));
        
        // Extract performer URLs if configured
        if (performerUrlSelector) {
          const performerUrls = this.extractArray($, performerUrlSelector);
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

      // Extract Movies/Groups
      const moviesConfig = sceneConfig.Movies || sceneConfig.Groups;
      if (moviesConfig && moviesConfig.Name) {
        console.log(`   🎬 Extracting movies/groups with selector: ${JSON.stringify(moviesConfig.Name)}`);
        
        // Resolve variable references if needed
        let nameSelector = moviesConfig.Name;
        let urlSelector = moviesConfig.URL;
        
        if (scraperConfig.common && typeof nameSelector === 'string' && nameSelector.startsWith('$')) {
          const varMatch = nameSelector.match(/^\$(\w+)(.*)/);
          if (varMatch) {
            const varName = '$' + varMatch[1];
            const suffix = varMatch[2];
            if (scraperConfig.common[varName]) {
              nameSelector = scraperConfig.common[varName] + suffix;
            }
          }
        }
        
        if (scraperConfig.common && typeof urlSelector === 'string' && urlSelector.startsWith('$')) {
          const varMatch = urlSelector.match(/^\$(\w+)(.*)/);
          if (varMatch) {
            const varName = '$' + varMatch[1];
            const suffix = varMatch[2];
            if (scraperConfig.common[varName]) {
              urlSelector = scraperConfig.common[varName] + suffix;
            }
          }
        }
        
        // Extract arrays of names and URLs
        const movieNames = this.extractArray($, nameSelector);
        console.log(`   🎬 Found ${movieNames.length} movie/group name(s)`);
        
        const movieUrls = urlSelector ? this.extractArray($, urlSelector) : [];
        console.log(`   🎬 Found ${movieUrls.length} movie/group URL(s)`);
        
        // Match names to URLs by index
        movieNames.forEach((name, index) => {
          const movie = { name, url: null };
          
          if (index < movieUrls.length && movieUrls[index]) {
            movie.url = movieUrls[index];
            // Convert relative URL to absolute
            if (movie.url && !movie.url.startsWith('http')) {
              movie.url = this.absUrl(movie.url, url);
            }
          }
          
          metadata.movies.push(movie);
          console.log(`   - Found movie: ${name}`, movie.url ? `(${movie.url})` : '(no URL)');
        });
        
        if (movieNames.length === 0) {
          console.log(`   ⚠️ Movie selector didn't match anything`);
        }
      }

      console.log(`✅ [${this.siteName}] Successfully scraped scene`);
      return this.formatResult(metadata);

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error scraping scene:`, error);
      throw new Error(`Failed to scrape ${this.siteName} scene: ${error.message}`);
    }
  }

  /**
   * Search for scenes using performers
   * Supports two workflows:
   * 1. Direct scene extraction: performerSearchUrl points directly to performer page, extract scenes with performerSearchScraper
   * 2. Two-stage search: performerSearchUrl points to search results, use performerSearchScraper to find performer URLs,
   *    then visit each URL and use sceneScraper to extract scenes
   * Returns all scenes found on each performer's page that match ALL provided performers
   */
  async searchScenes(performers) {
    console.log(`🔍 [${this.siteName}] Searching scenes with ${performers.length} performer(s):`, 
      performers.map(p => p.name));

    // Check if scraper supports scene search
    if (!this.config.sceneByFragment || this.config.sceneByFragment.length === 0) {
      throw new Error(`${this.siteName} does not support scene searching by performers`);
    }

    const searchConfig = this.config.sceneByFragment[0];
    
    // Get performer search URL pattern from config
    const performerSearchUrlPattern = searchConfig.performerSearchUrl;
    if (!performerSearchUrlPattern) {
      throw new Error(`${this.siteName} sceneByFragment config missing performerSearchUrl`);
    }

    // Get spacesConvertTo value from config, default to underscore
    const spacesConvertTo = searchConfig.spacesConvertTo || '_';

    // Determine workflow based on config
    // If performerSearchScraper is specified AND has 'performer' config (not 'scene'), use two-stage workflow
    const performerSearchScraperName = searchConfig.performerSearchScraper;
    const useTwoStageWorkflow = performerSearchScraperName && 
                                this.config.xPathScrapers[performerSearchScraperName] &&
                                this.config.xPathScrapers[performerSearchScraperName].performer;

    if (useTwoStageWorkflow) {
      console.log(`   🔄 Using two-stage workflow: search for performers, then extract scenes from their pages`);
      return await this.searchScenesTwoStage(performers, searchConfig, spacesConvertTo);
    } else {
      console.log(`   ➡️  Using direct workflow: extract scenes directly from performer URLs`);
      return await this.searchScenesDirect(performers, searchConfig, spacesConvertTo);
    }
  }

  /**
   * Direct workflow: performerSearchUrl points to performer page, extract scenes directly
   */
  async searchScenesDirect(performers, searchConfig, spacesConvertTo) {
    // Use performerSearchScraper if specified, otherwise fall back to scraper
    const scraperName = searchConfig.performerSearchScraper || searchConfig.scraper;
    if (!scraperName) {
      throw new Error(`${this.siteName} sceneByFragment config missing performerSearchScraper or scraper`);
    }
    
    const scraperConfig = this.config.xPathScrapers[scraperName];
    
    if (!scraperConfig || !scraperConfig.scene) {
      throw new Error(`Performer search scraper configuration not found: ${scraperName}`);
    }

    const performerSearchUrlPattern = searchConfig.performerSearchUrl;

    try {
      // Collect all scenes from all performer pages
      const allScenes = [];
      const performerNames = performers.map(p => p.name.toLowerCase());

      for (const performer of performers) {
        // Build list of names to try: primary name + aliases
        const namesToTry = [performer.name];
        if (performer.alias) {
          // Split aliases by comma and trim whitespace
          const aliases = performer.alias.split(',').map(a => a.trim()).filter(a => a);
          namesToTry.push(...aliases);
        }

        console.log(`   🔍 Trying ${namesToTry.length} name(s) for ${performer.name}:`, namesToTry);

        // Try each name/alias
        for (const name of namesToTry) {
          // Build performer slug: replace spaces per config, then URL encode special chars
          let performerSlug = name.toLowerCase().replace(/\s+/g, spacesConvertTo);
          
          // URL encode special characters using manual encoding map
          const encodeMap = {
            "'": '%27',
            '"': '%22',
            '!': '%21',
            '#': '%23',
            '$': '%24',
            '%': '%25',
            '&': '%26',
            '(': '%28',
            ')': '%29',
            '*': '%2A',
            ',': '%2C',
            '/': '%2F',
            ':': '%3A',
            ';': '%3B',
            '=': '%3D',
            '?': '%3F',
            '@': '%40',
            '[': '%5B',
            ']': '%5D'
          };
          
          performerSlug = performerSlug.replace(/[^a-z0-9]/gi, (char) => {
            // Don't encode the spacesConvertTo character
            if (char === spacesConvertTo) {
              return char;
            }
            // Use manual encoding map for common special characters
            if (encodeMap[char]) {
              return encodeMap[char];
            }
            // Fall back to encodeURIComponent for other characters
            return encodeURIComponent(char);
          });
          
          // Build performer URL from pattern
          const performerUrl = performerSearchUrlPattern.replace('{performer}', performerSlug);
          
          console.log(`      - Trying: ${performerUrl}`);

          try {
            let pageCount = 0;
            const maxPages = scraperConfig.pagination?.maxPages || 1;
            let foundAnyScenes = false;

            // Loop through paginated results using page numbers
            while (pageCount < maxPages) {
              pageCount++;
              
              // Build URL with page parameter
              let currentUrl = performerUrl;
              if (pageCount > 1) {
                // Check if custom pagination URL pattern is specified
                if (scraperConfig.pagination?.urlPattern) {
                  // Replace {page} placeholder with page number
                  currentUrl = scraperConfig.pagination.urlPattern.replace('{url}', performerUrl).replace('{page}', pageCount);
                } else {
                  // Default: Add page parameter to URL as query string
                  const separator = performerUrl.includes('?') ? '&' : '?';
                  currentUrl = `${performerUrl}${separator}page=${pageCount}`;
                }
              }
              
              console.log(`      📄 Scraping page ${pageCount}: ${currentUrl}`);

              const $ = await this.fetchHtml(currentUrl);
              
              // Check for "no results" error message
              if (scraperConfig.pagination?.noResultsSelector) {
                const noResults = this.extractValue($, scraperConfig.pagination.noResultsSelector);
                if (noResults) {
                  console.log(`      ✓ No more results (error message found on page ${pageCount})`);
                  break;
                }
              }
              
              const sceneConfig = scraperConfig.scene;

              // Extract all scenes from the current page
              const titleElements = this.extractArrayElements($, sceneConfig.Title);
              
              console.log(`      DEBUG: Title config:`, JSON.stringify(sceneConfig.Title));
              console.log(`      DEBUG: URL config:`, JSON.stringify(sceneConfig.URL));
              console.log(`      DEBUG: titleElements.length = ${titleElements.length}`);
              
              if (titleElements.length > 0) {
                foundAnyScenes = true;
                console.log(`      ✓ Found ${titleElements.length} scene(s) for "${name}" on page ${pageCount}`);

                for (let i = 0; i < titleElements.length; i++) {
                  const scene = {
                    title: null,
                    url: null,
                    coverImage: null,
                    date: null,
                    studio: this.siteName
                  };

                  // Extract title
                  if (sceneConfig.Title) {
                    scene.title = this.extractValueAtIndex($, sceneConfig.Title, i);
                  }

                  // Extract URL
                  if (sceneConfig.URL) {
                    scene.url = this.extractValueAtIndex($, sceneConfig.URL, i);
                  }

                  // Extract cover image
                  if (sceneConfig.Image) {
                    scene.coverImage = this.extractValueAtIndex($, sceneConfig.Image, i);
                  }

                  // Extract date
                  if (sceneConfig.Date) {
                    scene.date = this.extractValueAtIndex($, sceneConfig.Date, i);
                  }

                  if (scene.title && scene.url) {
                    allScenes.push(scene);
                    console.log(`         Added scene: "${scene.title}" (${scene.url})`);
                  } else {
                    console.log(`         Skipped scene ${i}: title="${scene.title}", url="${scene.url}"`);
                  }
                }
              } else {
                console.log(`      - No scenes found for "${name}" on page ${pageCount}`);
                // If no scenes found, break out of pagination loop
                break;
              }
            }
            
            // If we found scenes with this name, don't try other aliases
            if (foundAnyScenes) {
              break;
            }
          } catch (error) {
            console.warn(`      ⚠️ Failed to fetch scenes for "${name}":`, error.message);
            // Continue with next alias
          }
        }
      }

      console.log(`   📊 Total scenes collected: ${allScenes.length}`);

      // Filter scenes that appear for ALL performers (intersection)
      // Count how many times each scene URL appears
      const sceneUrlCounts = new Map();
      allScenes.forEach(scene => {
        const count = sceneUrlCounts.get(scene.url) || 0;
        sceneUrlCounts.set(scene.url, count + 1);
      });

      // Keep only scenes that appear at least as many times as we have performers
      const matchingScenes = allScenes.filter(scene => 
        sceneUrlCounts.get(scene.url) >= performers.length
      );

      // Deduplicate by URL
      const uniqueScenes = [];
      const seenUrls = new Set();
      matchingScenes.forEach(scene => {
        if (!seenUrls.has(scene.url)) {
          seenUrls.add(scene.url);
          uniqueScenes.push(scene);
        }
      });

      console.log(`   ✅ Found ${uniqueScenes.length} scene(s) with ALL ${performers.length} performer(s)`);

      return uniqueScenes.map(scene => ({
        url: scene.url,
        title: scene.title,
        date: scene.date,
        studio: { name: this.siteName },
        image: scene.coverImage,
        performers: performers.map(p => ({ name: p.name }))
      }));

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error searching scenes:`, error);
      throw new Error(`Failed to search ${this.siteName} scenes: ${error.message}`);
    }
  }

  /**
   * Two-stage workflow: search for performers, then extract scenes from their pages
   * 1. Use performerSearchScraper to search and get performer URLs
   * 2. Visit each performer URL and use sceneScraper (or performerSceneScraper if specified) to extract scenes
   * 3. Filter scenes that contain ALL original performers
   */
  async searchScenesTwoStage(performers, searchConfig, spacesConvertTo) {
    const performerSearchScraperName = searchConfig.performerSearchScraper;
    const performerSearchConfig = this.config.xPathScrapers[performerSearchScraperName];
    
    if (!performerSearchConfig || !performerSearchConfig.performer) {
      throw new Error(`Performer search scraper configuration not found or missing performer config: ${performerSearchScraperName}`);
    }

    // Check if performerSearchScraper specifies a custom scene scraper for performer pages
    const performerPageSceneScraperName = performerSearchConfig.performer.performerSceneScraper;
    
    // Get scene scraper for extracting scenes from performer pages
    let sceneScraperName;
    let sceneScraperConfig;
    
    if (performerPageSceneScraperName) {
      // Use custom scraper specified in performerSearchScraper config
      sceneScraperName = performerPageSceneScraperName;
      sceneScraperConfig = this.config.xPathScrapers[sceneScraperName];
      console.log(`   📋 Using custom performer page scene scraper: ${sceneScraperName}`);
    } else {
      // Fall back to main scene scraper
      sceneScraperName = searchConfig.scraper || 'sceneScraper';
      sceneScraperConfig = this.config.xPathScrapers[sceneScraperName];
    }
    
    if (!sceneScraperConfig || !sceneScraperConfig.scene) {
      throw new Error(`Scene scraper configuration not found: ${sceneScraperName}`);
    }

    const performerSearchUrlPattern = searchConfig.performerSearchUrl;
    const performerSceneSets = []; // Array of Sets, one per performer

    try {
      // Stage 1: For each performer, collect all their scene URLs
      for (const performer of performers) {
        // Build list of names to try: primary name + aliases
        const namesToTry = [performer.name];
        if (performer.alias) {
          const aliases = performer.alias.split(',').map(a => a.trim()).filter(a => a);
          namesToTry.push(...aliases);
        }

        console.log(`   🔍 Stage 1: Searching for performer "${performer.name}" (${namesToTry.length} name(s))`);

        let performerUrlFound = null;

        // Try each name/alias
        for (const name of namesToTry) {
          // Build search URL
          const searchSlug = name.toLowerCase().replace(/\s+/g, spacesConvertTo);
          const searchUrl = performerSearchUrlPattern.replace('{performer}', searchSlug);
          
          console.log(`      - Searching: ${searchUrl}`);

          try {
            const $ = await this.fetchHtml(searchUrl);
            const performerConfig = performerSearchConfig.performer;

            // Extract performer search results - first get element count
            const performerElements = this.extractArrayElements($, performerConfig.Name);
            const resultCount = performerElements.length;
            
            if (resultCount > 0) {
              console.log(`      ✓ Found ${resultCount} performer result(s)`);

              // Try to find exact match (case-insensitive)
              const searchNameLower = name.toLowerCase();
              let matchIndex = -1;

              // Extract actual text values and compare
              for (let i = 0; i < resultCount; i++) {
                const resultName = this.extractValueAtIndex($, performerConfig.Name, i);
                if (resultName && resultName.toLowerCase().trim() === searchNameLower) {
                  matchIndex = i;
                  console.log(`      ✓ Found exact match: "${resultName}" at index ${i}`);
                  break;
                }
              }

              // If no exact match, use first result
              if (matchIndex === -1 && resultCount > 0) {
                matchIndex = 0;
                const firstResultName = this.extractValueAtIndex($, performerConfig.Name, 0);
                console.log(`      ⚠️  No exact match, using first result: "${firstResultName}"`);
              }

              if (matchIndex >= 0) {
                // Extract performer URL
                const performerUrl = this.extractValueAtIndex($, performerConfig.URL, matchIndex);
                
                if (performerUrl) {
                  performerUrlFound = performerUrl;
                  console.log(`      ✓ Performer URL: ${performerUrl}`);
                  break; // Found a match, no need to try other aliases
                }
              }
            } else {
              console.log(`      - No results for "${name}"`);
            }
          } catch (error) {
            console.warn(`      ⚠️ Failed to search for "${name}":`, error.message);
          }
        }

        if (!performerUrlFound) {
          console.log(`      ⚠️ Could not find performer URL for "${performer.name}"`);
          continue;
        }

        // Stage 2: Extract scenes from performer's page
        console.log(`   🔍 Stage 2: Extracting scenes from ${performerUrlFound}`);

        const performerScenes = new Map(); // Map of URL -> scene object

        try {
          const $ = await this.fetchHtml(performerUrlFound);
          const sceneConfig = sceneScraperConfig.scene;

          // Extract all scenes from the performer page
          const titleElements = this.extractArrayElements($, sceneConfig.Title);
          
          if (titleElements.length > 0) {
            console.log(`      ✓ Found ${titleElements.length} scene(s) for "${performer.name}"`);

            for (let i = 0; i < titleElements.length; i++) {
              const scene = {
                title: null,
                url: null,
                coverImage: null,
                date: null,
                studio: this.siteName,
                performers: []
              };

              // Extract scene details
              if (sceneConfig.Title) {
                scene.title = this.extractValueAtIndex($, sceneConfig.Title, i);
              }

              if (sceneConfig.URL) {
                scene.url = this.extractValueAtIndex($, sceneConfig.URL, i);
              }

              if (sceneConfig.Image) {
                scene.coverImage = this.extractValueAtIndex($, sceneConfig.Image, i);
              }

              if (sceneConfig.Date) {
                scene.date = this.extractValueAtIndex($, sceneConfig.Date, i);
              }

              if (scene.title && scene.url) {
                performerScenes.set(scene.url, scene);
              }
            }
          } else {
            console.log(`      - No scenes found for "${performer.name}"`);
          }
        } catch (error) {
          console.warn(`      ⚠️ Failed to extract scenes from performer page:`, error.message);
        }

        performerSceneSets.push(performerScenes);
      }

      console.log(`   📊 Collected scenes for ${performerSceneSets.length} performer(s)`);

      // Stage 3: Find scenes that appear in ALL performer lists (intersection)
      console.log(`   🔍 Stage 3: Finding scenes with ALL performers`);

      if (performerSceneSets.length === 0) {
        console.log(`   ⚠️  No performers found`);
        return [];
      }

      // Start with the first performer's scenes
      const commonScenes = new Map(performerSceneSets[0]);

      // Keep only scenes that appear in all other performer sets
      for (let i = 1; i < performerSceneSets.length; i++) {
        const performerScenes = performerSceneSets[i];
        const performerUrls = new Set(performerScenes.keys());

        // Remove scenes that aren't in this performer's list
        for (const [url, scene] of commonScenes) {
          if (!performerUrls.has(url)) {
            commonScenes.delete(url);
          }
        }
      }

      const validScenes = Array.from(commonScenes.values());
      console.log(`   ✅ Found ${validScenes.length} scene(s) with ALL ${performers.length} performer(s)`);

      return validScenes.map(scene => ({
        url: scene.url,
        title: scene.title,
        date: scene.date,
        studio: { name: this.siteName },
        image: scene.coverImage,
        performers: performers.map(p => ({ name: p.name }))
      }));

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error in two-stage scene search:`, error);
      throw new Error(`Failed to search ${this.siteName} scenes: ${error.message}`);
    }
  }

  /**
   * Search for scenes by title on studio page
   * @param {string} title - Scene title to search for
   * @param {string} studioUrl - Optional studio URL to search on (uses studioSearchUrl from config if not provided)
   * @returns {Array} Array of matching scenes
   */
  async searchByTitle(title, studioUrl = null) {
    console.log(`🔍 [${this.siteName}] Searching scenes by title: "${title}"`);

    // Check if scraper supports scene search
    if (!this.config.sceneByFragment || this.config.sceneByFragment.length === 0) {
      throw new Error(`${this.siteName} does not support scene searching`);
    }

    const searchConfig = this.config.sceneByFragment[0];
    
    // Use titleSearchScraper if specified, otherwise fall back to scraper
    const scraperName = searchConfig.titleSearchScraper || searchConfig.scraper;
    if (!scraperName) {
      throw new Error(`${this.siteName} sceneByFragment config missing titleSearchScraper or scraper`);
    }
    
    const scraperConfig = this.config.xPathScrapers[scraperName];
    
    if (!scraperConfig || !scraperConfig.scene) {
      throw new Error(`Title search scraper configuration not found: ${scraperName}`);
    }

    // Get studio search URL from config or parameter
    let searchUrl = studioUrl || searchConfig.studioSearchUrl;
    if (!searchUrl) {
      throw new Error(`${this.siteName} sceneByFragment config missing studioSearchUrl and no studioUrl provided`);
    }

    // Get spacesConvertTo value from config, default to underscore
    const spacesConvertTo = searchConfig.spacesConvertTo || '_';
    
    console.log(`   🔧 spacesConvertTo: "${spacesConvertTo}"`);

    // Check if URL has {title} placeholder - if so, replace it with normalized title
    if (searchUrl.includes('{title}')) {
      console.log(`   🔧 Original title: "${title}"`);
      
      // Normalize title: replace spaces per config, then URL encode special chars
      let titleSlug = title.toLowerCase().replace(/\s+/g, spacesConvertTo);
      console.log(`   🔧 After space replacement: "${titleSlug}"`);
      
      // URL encode special characters using manual encoding map
      // This works around Node.js encodeURIComponent issues with apostrophes
      const encodeMap = {
        "'": '%27',
        '"': '%22',
        '!': '%21',
        '#': '%23',
        '$': '%24',
        '%': '%25',
        '&': '%26',
        '(': '%28',
        ')': '%29',
        '*': '%2A',
        ',': '%2C',
        '/': '%2F',
        ':': '%3A',
        ';': '%3B',
        '=': '%3D',
        '?': '%3F',
        '@': '%40',
        '[': '%5B',
        ']': '%5D'
      };
      
      titleSlug = titleSlug.replace(/[^a-z0-9]/gi, (char) => {
        // Don't encode the spacesConvertTo character
        if (char === spacesConvertTo) {
          console.log(`   🔧 Skipping "${char}" (spacesConvertTo character)`);
          return char;
        }
        // Use manual encoding map for common special characters
        if (encodeMap[char]) {
          console.log(`   🔧 Encoding "${char}" → "${encodeMap[char]}"`);
          return encodeMap[char];
        }
        // Fall back to encodeURIComponent for other characters
        const encoded = encodeURIComponent(char);
        console.log(`   🔧 Encoding "${char}" (via encodeURIComponent) → "${encoded}"`);
        return encoded;
      });
      
      console.log(`   🔧 Final titleSlug: "${titleSlug}"`);
      
      searchUrl = searchUrl.replace('{title}', titleSlug);
      console.log(`   🔍 Using title-based URL: ${searchUrl}`);
    }

    // Check if titleSearchScraper is actually a direct scene scraper (not a search results scraper)
    // This is indicated by the scraper being the same as the main scene scraper, which means
    // the URL goes directly to a scene page, not a search results page
    const isDirectSceneScraper = scraperName === this.config.sceneByURL?.[0]?.scraper;
    
    if (isDirectSceneScraper) {
      console.log(`   🔍 Direct scene URL detected - scraping single scene`);
      
      try {
        // Scrape the page as a single scene using the main scrape method
        const sceneData = await this.scrape(searchUrl);
        
        // Return as search result format
        return [{
          url: sceneData.url || searchUrl,
          title: sceneData.title,
          date: sceneData.date,
          studio: { name: this.siteName },
          image: sceneData.coverImage
        }];
      } catch (error) {
        console.error(`❌ [${this.siteName}] Error scraping direct scene URL:`, error);
        throw new Error(`Failed to scrape ${this.siteName} scene: ${error.message}`);
      }
    }

    // Original behavior: fetch page and filter by title
    try {
      console.log(`   🔍 Fetching scenes from: ${searchUrl}`);

      const allScenes = [];
      let pageCount = 0;
      const maxPages = scraperConfig.pagination?.maxPages || 1;

      // Loop through paginated results using page numbers
      while (pageCount < maxPages) {
        pageCount++;
        
        // Build URL with page parameter
        let currentUrl = searchUrl;
        if (pageCount > 1) {
          // Check if custom pagination URL pattern is specified
          if (scraperConfig.pagination?.urlPattern) {
            // Replace {page} placeholder with page number
            currentUrl = scraperConfig.pagination.urlPattern.replace('{url}', searchUrl).replace('{page}', pageCount);
          } else {
            // Default: Add page parameter to URL as query string
            const separator = searchUrl.includes('?') ? '&' : '?';
            currentUrl = `${searchUrl}${separator}page=${pageCount}`;
          }
        }
        
        console.log(`   📄 Scraping page ${pageCount}: ${currentUrl}`);

        const $ = await this.fetchHtml(currentUrl);
        
        // Check for "no results" error message
        if (scraperConfig.pagination?.noResultsSelector) {
          const noResults = this.extractValue($, scraperConfig.pagination.noResultsSelector);
          if (noResults) {
            console.log(`   ✓ No more results (error message found on page ${pageCount})`);
            break;
          }
        }
        
        const sceneConfig = scraperConfig.scene;

        // Extract all scenes from the current page
        const titleElements = this.extractArrayElements($, sceneConfig.Title);
        
        console.log(`   - Found ${titleElements.length} scene(s) on page ${pageCount}`);
        
        // If no scenes found, we've reached the end
        if (titleElements.length === 0) {
          console.log(`   ✓ No more scenes found on page ${pageCount}`);
          break;
        }

        for (let i = 0; i < titleElements.length; i++) {
          const scene = {
            title: null,
            url: null,
            coverImage: null,
            date: null,
            studio: this.siteName
          };

          // Extract title
          if (sceneConfig.Title) {
            scene.title = this.extractValueAtIndex($, sceneConfig.Title, i);
          }

          // Extract URL
          if (sceneConfig.URL) {
            scene.url = this.extractValueAtIndex($, sceneConfig.URL, i);
          }

          // Extract cover image
          if (sceneConfig.Image) {
            scene.coverImage = this.extractValueAtIndex($, sceneConfig.Image, i);
          }

          // Extract date
          if (sceneConfig.Date) {
            scene.date = this.extractValueAtIndex($, sceneConfig.Date, i);
          }

          if (scene.title && scene.url) {
            allScenes.push(scene);
          }
        }
      }

      console.log(`   📊 Total scenes extracted from ${pageCount} page(s): ${allScenes.length}`);

      // Filter scenes by title match (case-insensitive partial match)
      const normalizedSearchTitle = title.toLowerCase().trim();
      const matchingScenes = allScenes.filter(scene => 
        scene.title && scene.title.toLowerCase().includes(normalizedSearchTitle)
      );

      console.log(`   ✅ Found ${matchingScenes.length} scene(s) matching title: "${title}"`);

      return matchingScenes.map(scene => ({
        url: scene.url,
        title: scene.title,
        date: scene.date,
        studio: { name: this.siteName },
        image: scene.coverImage
      }));

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error searching by title:`, error);
      throw new Error(`Failed to search ${this.siteName} by title: ${error.message}`);
    }
  }

  /**
   * Extract array of elements (not just text values) for indexed extraction
   */
  extractArrayElements($, config) {
    if (!config) return [];
    
    const selector = typeof config === 'string' ? config : config.selector;
    if (!selector) return [];

    const jquerySelector = this.xpathToJquery(selector);
    const elements = $(jquerySelector);
    return elements.toArray();
  }

  /**
   * Extract value at specific index from array selector
   */
  extractValueAtIndex($, config, index) {
    if (!config) return null;
    
    const selector = typeof config === 'string' ? config : config.selector;
    if (!selector) return null;

    try {
      const jquerySelector = this.xpathToJquery(selector);
      const elements = $(jquerySelector);
      
      if (index >= elements.length) return null;

      const element = elements.eq(index);
      
      // Check if this is an attribute extraction
      const attrMatch = selector.match(/\/@(\w+)$/);
      let value;
      
      if (attrMatch) {
        value = element.attr(attrMatch[1]);
      } else {
        value = element.text().trim();
      }

      // Apply post-processing if defined
      if (typeof config === 'object' && config.postProcess) {
        value = this.applyPostProcess(value, config.postProcess);
      }

      return value;
    } catch (error) {
      console.warn(`   ⚠️ Error extracting value at index ${index}:`, error.message);
      return null;
    }
  }

  /**
   * Scrape movie details from a movie URL
   * @param {string} url - Movie URL to scrape
   * @returns {Object} Movie metadata
   */
  async scrapeMovie(url) {
    console.log(`🎬 [${this.siteName}] Scraping movie: ${url}`);

    try {
      // Check if URL matches movieByURL or groupByURL patterns (groupByURL is the standard Stash term)
      const movieScraper = (this.config.movieByURL || this.config.groupByURL)?.find(scraper => {
        return scraper.url.some(pattern => {
          const normalizedUrl = url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
          const normalizedPattern = pattern.toLowerCase().replace(/^https?:\/\/(www\.)?/, '');
          return normalizedUrl.includes(normalizedPattern);
        });
      });

      if (!movieScraper) {
        throw new Error(`No movie scraper configuration found for URL: ${url}`);
      }

      const $ = await this.fetchHtml(url);

      const scraperName = movieScraper.scraper;
      const scraperConfig = this.config.xPathScrapers[scraperName];
      
      // Support both 'movie' and 'group' config names
      if (!scraperConfig || (!scraperConfig.movie && !scraperConfig.group)) {
        throw new Error(`Movie scraper configuration not found: ${scraperName}`);
      }

      const movieConfig = scraperConfig.movie || scraperConfig.group;
      const metadata = {
        url: url,
        name: null,
        synopsis: null,
        studio: null,
        date: null,
        frontImage: null,
        backImage: null,
        director: null,
        duration: null,
        rating: null
      };

      // Extract Name/Title
      if (movieConfig.Title) {
        metadata.name = this.extractValue($, movieConfig.Title);
        if (metadata.name) {
          console.log(`   - Title: ${metadata.name}`);
        }
      }

      // Extract Synopsis
      if (movieConfig.Synopsis) {
        metadata.synopsis = this.extractValue($, movieConfig.Synopsis);
        if (metadata.synopsis) {
          console.log(`   - Synopsis: ${metadata.synopsis.substring(0, 100)}...`);
        }
      }

      // Extract Date
      if (movieConfig.Date) {
        metadata.date = this.extractValue($, movieConfig.Date);
        if (metadata.date) {
          console.log(`   - Date: ${metadata.date}`);
        }
      }

      // Extract Front Image
      if (movieConfig.Image || movieConfig.FrontImage) {
        metadata.frontImage = this.extractValue($, movieConfig.Image || movieConfig.FrontImage);
        if (metadata.frontImage) {
          console.log(`   - Front Image: ${metadata.frontImage}`);
        }
      }

      // Extract Back Image
      if (movieConfig.BackImage) {
        metadata.backImage = this.extractValue($, movieConfig.BackImage);
        if (metadata.backImage) {
          console.log(`   - Back Image: ${metadata.backImage}`);
        }
      }

      // Extract Studio
      if (movieConfig.Studio && movieConfig.Studio.Name) {
        metadata.studio = this.extractValue($, movieConfig.Studio.Name);
        if (metadata.studio) {
          console.log(`   - Studio: ${metadata.studio}`);
        }
      }

      // Extract Director
      if (movieConfig.Director) {
        metadata.director = this.extractValue($, movieConfig.Director);
        if (metadata.director) {
          console.log(`   - Director: ${metadata.director}`);
        }
      }

      // Extract Duration
      if (movieConfig.Duration) {
        metadata.duration = this.extractValue($, movieConfig.Duration);
        if (metadata.duration) {
          console.log(`   - Duration: ${metadata.duration}`);
        }
      }

      // Extract Rating
      if (movieConfig.Rating) {
        metadata.rating = this.extractValue($, movieConfig.Rating);
        if (metadata.rating) {
          console.log(`   - Rating: ${metadata.rating}`);
        }
      }

      console.log(`✅ [${this.siteName}] Successfully scraped movie`);
      return {
        success: true,
        movie: metadata
      };

    } catch (error) {
      console.error(`❌ [${this.siteName}] Error scraping movie:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = YamlScraperService;
