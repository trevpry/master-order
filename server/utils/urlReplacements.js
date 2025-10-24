/**
 * URL Replacement Utility
 * Handles URL transformations before scraping
 */

/**
 * Apply URL replacements based on configuration
 * @param {string} url - The URL to transform
 * @param {Array} replacements - Array of replacement rules
 * @returns {string} - The transformed URL
 * 
 * Replacement rule format:
 * {
 *   find: "string to find",      // For simple string replacement
 *   replace: "replacement",       // Replacement string
 *   regex: false                  // Optional: use regex (default false)
 * }
 * 
 * OR for regex:
 * {
 *   pattern: "regex pattern",     // Regex pattern string
 *   replace: "replacement",       // Replacement (can use $1, $2, etc.)
 *   regex: true                   // Must be true for regex
 * }
 */
function applyUrlReplacements(url, replacements) {
  if (!replacements || !Array.isArray(replacements) || replacements.length === 0) {
    return url;
  }

  let transformedUrl = url;

  replacements.forEach((rule, index) => {
    try {
      if (rule.regex === true && rule.pattern) {
        // Regex replacement
        const regex = new RegExp(rule.pattern, 'g');
        const before = transformedUrl;
        transformedUrl = transformedUrl.replace(regex, rule.replace || '');
        
        if (before !== transformedUrl) {
          console.log(`   🔄 URL replacement ${index + 1} (regex): "${before}" → "${transformedUrl}"`);
        }
      } else if (rule.find) {
        // Simple string replacement
        const before = transformedUrl;
        transformedUrl = transformedUrl.replace(new RegExp(escapeRegex(rule.find), 'g'), rule.replace || '');
        
        if (before !== transformedUrl) {
          console.log(`   🔄 URL replacement ${index + 1} (string): "${before}" → "${transformedUrl}"`);
        }
      }
    } catch (error) {
      console.error(`   ⚠️ URL replacement ${index + 1} failed:`, error.message);
    }
  });

  return transformedUrl;
}

/**
 * Escape special regex characters in a string
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Load URL replacements from a JSON config file
 * @param {string} configPath - Path to the config file
 * @returns {Object} - Map of scraper ID to replacement rules
 */
function loadUrlReplacementsConfig(configPath) {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const fullPath = path.resolve(configPath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`ℹ️ URL replacements config not found: ${fullPath}`);
      return {};
    }
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const config = JSON.parse(content);
    
    console.log(`✅ Loaded URL replacements for ${Object.keys(config).length} scraper(s)`);
    
    return config;
  } catch (error) {
    console.error(`❌ Failed to load URL replacements config:`, error.message);
    return {};
  }
}

module.exports = {
  applyUrlReplacements,
  loadUrlReplacementsConfig,
  escapeRegex
};
