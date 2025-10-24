/**
 * Mile High Media (Gay) Standalone Scraper
 * Scrapes Icon Male, Noir Male, Taboo Male sites
 * No external dependencies - direct HTML scraping
 */

const https = require('https');

/**
 * Fetch HTML content from a URL
 */
function fetchHtml(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

/**
 * Simple HTML parser - extract text between tags
 */
function extractText(html, selector) {
  const regex = new RegExp(`<${selector}[^>]*>([^<]+)</${selector}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract attribute value
 */
function extractAttr(html, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]+)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract all matches
 */
function extractAll(html, pattern) {
  const results = [];
  const regex = new RegExp(pattern, 'gi');
  let match;
  while ((match = regex.exec(html)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Post-process results to fix domain names
 */
function milehigh(obj) {
  if (!obj) return obj;
  
  let replacement = 'milehighmedia.com';
  
  if (obj.studio && obj.studio.name) {
    if (obj.studio.name === 'Icon Male') {
      replacement = 'iconmale.com';
    } else if (obj.studio.name === 'Noir Male') {
      replacement = 'noirmale.com';
    }
  }
  
  const replaceInObject = (o) => {
    if (!o || typeof o !== 'object') return o;
    
    if (Array.isArray(o)) {
      return o.map(replaceInObject);
    }
    
    const result = {};
    for (const [key, value] of Object.entries(o)) {
      if ((key === 'url' || key === 'urls') && typeof value === 'string') {
        result[key] = value.replace(/milehigh\.com/g, replacement);
      } else if (typeof value === 'object') {
        result[key] = replaceInObject(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  };
  
  return replaceInObject(obj);
}

/**
 * Scrape scene from URL
 */
async function sceneFromUrl(url) {
  const html = await fetchHtml(url);
  
  const result = {
    title: null,
    details: null,
    url: url,
    date: null,
    image: null,
    studio: {},
    performers: [],
    tags: []
  };
  
  // Extract the main scene content div
  const sceneContentMatch = html.match(/<div[^>]*class="[^"]*sc-1fep8qc-0 kDWMJK[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  const sceneHtml = sceneContentMatch ? sceneContentMatch[0] : html;
  
  // Extract title - look for h1 in scene content
  result.title = extractText(sceneHtml, 'h1') || 
                extractAttr(html, 'meta', 'property="og:title"') ||
                extractText(html, 'title');
  
  // Try to extract from JSON-LD structured data first
  const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      if (jsonData.description) result.details = jsonData.description;
      if (jsonData.datePublished) result.date = jsonData.datePublished;
      if (jsonData.keywords) {
        result.tags = jsonData.keywords.split(',').map(tag => ({ name: tag.trim() }));
      }
      if (jsonData.actor && Array.isArray(jsonData.actor)) {
        result.performers = jsonData.actor.map(actor => ({ 
          name: typeof actor === 'string' ? actor : actor.name 
        }));
      }
    } catch (e) {
      // JSON parsing failed, continue with HTML extraction
    }
  }
  
  // Fallback: Extract description from the div following "Description:" text
  if (!result.details) {
    // Look for div containing "Description:" and get the next div
    const descMatch = html.match(/<div[^>]*>Description:<\/div>\s*<div[^>]*>([^<]+)<\/div>/i);
    if (descMatch) {
      result.details = descMatch[1].trim();
    } else {
      // Further fallback to meta tags
      result.details = extractAttr(html, 'meta', 'name="description" content') ||
                      extractAttr(html, 'meta', 'property="og:description"');
    }
  }
  
  // Extract image
  result.image = extractAttr(html, 'meta', 'property="og:image"') ||
                extractAttr(sceneHtml, 'img', 'class="scene-cover"');
  
  // Extract date from scene content if not already found
  if (!result.date) {
    const dateMatch = sceneHtml.match(/Released[:\s]+([A-Za-z]+\s+\d+,\s+\d{4})/i) ||
                     html.match(/Released[:\s]+([A-Za-z]+\s+\d+,\s+\d{4})/i) ||
                     html.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      result.date = dateMatch[1];
    }
  }
  
  // Determine studio from URL
  if (url.includes('iconmale.com')) {
    result.studio = { name: 'Icon Male' };
  } else if (url.includes('noirmale.com')) {
    result.studio = { name: 'Noir Male' };
  } else if (url.includes('taboomale.com')) {
    result.studio = { name: 'Taboo Male' };
  }
  
  // Extract performers if not already found - look for actor links in scene content
  if (result.performers.length === 0) {
    const performerNames = extractAll(sceneHtml, /<a[^>]*href="[^"]*\/model\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    result.performers = performerNames.map(name => ({ name: name.trim() }));
  }
  
  // Extract tags if not already found - look for category/tag links in scene content
  if (result.tags.length === 0) {
    const tagNames = extractAll(sceneHtml, /<a[^>]*href="[^"]*\/categor(?:y|ies)\/[^"]*"[^>]*>([^<]+)<\/a>/i);
    result.tags = tagNames.map(name => ({ name: name.trim() }));
  }
  
  return milehigh(result);
}

/**
 * Main entry point
 */
async function main() {
  try {
    // Arguments are passed as: node script.js operation '{"url":"..."}'
    const operation = process.argv[2];
    const argsJson = process.argv[3];
    
    const args = JSON.parse(argsJson);
    
    let result = null;
    
    switch (operation) {
      case 'scene-by-url':
        if (args.url) {
          result = await sceneFromUrl(args.url);
        }
        break;
      
      // Add other operations as needed
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { sceneFromUrl, milehigh };
