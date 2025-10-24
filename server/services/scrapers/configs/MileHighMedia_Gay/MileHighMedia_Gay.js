/**
 * Mile High Media (Gay) Scraper Script
 * Scrapes: Icon Male, Noir Male, Taboo Male
 * 
 * This script interfaces with the Aylo API for scraping adult content sites
 */

const AyloAPI = require('../../lib/AyloAPI');

/**
 * Post-process function to fix domain names in URLs
 */
function milehigh(obj) {
  if (!obj) return obj;
  
  let replacement = 'milehighmedia.com'; // default
  
  // Determine the correct domain based on studio name
  const studioName = obj?.studio?.name;
  if (studioName === 'Icon Male') {
    replacement = 'iconmale.com';
  } else if (studioName === 'Noir Male') {
    replacement = 'noirmale.com';
  }
  
  // Helper function to replace all occurrences in nested objects
  const replaceInObj = (object, key, replaceFn) => {
    if (!object || typeof object !== 'object') return object;
    
    const result = Array.isArray(object) ? [...object] : { ...object };
    
    for (const k in result) {
      if (k === key && typeof result[k] === 'string') {
        result[k] = replaceFn(result[k]);
      } else if (typeof result[k] === 'object') {
        result[k] = replaceInObj(result[k], key, replaceFn);
      }
    }
    
    return result;
  };
  
  // Replace milehigh.com in all URLs
  let fixed = replaceInObj(obj, 'url', (x) => x.replace('milehigh.com', replacement));
  fixed = replaceInObj(fixed, 'urls', (x) => x.replace('milehigh.com', replacement));
  
  return fixed;
}

/**
 * Main scraper function
 */
async function scrape(operation, args) {
  const domains = ['iconmale', 'noirmale', 'taboomale'];
  
  let result = null;
  
  try {
    switch (operation) {
      case 'gallery-by-url':
      case 'gallery-by-fragment':
        if (args.url) {
          result = await AyloAPI.galleryFromUrl(args.url, milehigh);
        }
        break;
        
      case 'scene-by-url':
        if (args.url) {
          result = await AyloAPI.sceneFromUrl(args.url, milehigh);
        }
        break;
        
      case 'scene-by-name':
        if (args.name) {
          result = await AyloAPI.sceneSearch(args.name, domains, milehigh);
        }
        break;
        
      case 'scene-by-fragment':
      case 'scene-by-query-fragment':
        result = await AyloAPI.sceneFromFragment(args, domains, milehigh);
        break;
        
      case 'performer-by-url':
        if (args.url) {
          result = await AyloAPI.performerFromUrl(args.url, milehigh);
        }
        break;
        
      case 'performer-by-fragment':
        result = await AyloAPI.performerFromFragment(args);
        break;
        
      case 'performer-by-name':
        if (args.name) {
          result = await AyloAPI.performerSearch(args.name, domains, milehigh);
        }
        break;
        
      case 'movie-by-url':
        if (args.url) {
          result = await AyloAPI.movieFromUrl(args.url, milehigh);
        }
        break;
        
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
    
    return result;
    
  } catch (error) {
    console.error(`Error in ${operation}:`, error);
    throw error;
  }
}

module.exports = {
  scrape,
  milehigh
};

// If run directly from command line
if (require.main === module) {
  const operation = process.argv[2];
  const argsJson = process.argv[3];
  
  if (!operation) {
    console.error('Usage: node MileHighMedia_Gay.js <operation> <args-json>');
    process.exit(1);
  }
  
  let args = {};
  if (argsJson) {
    try {
      args = JSON.parse(argsJson);
    } catch (e) {
      console.error('Invalid JSON arguments:', e.message);
      process.exit(1);
    }
  }
  
  scrape(operation, args)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Script error:', error);
      process.exit(1);
    });
}
