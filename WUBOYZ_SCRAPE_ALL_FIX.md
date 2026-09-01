# WuBoyz Scraper - Scrape All Integration Fix

## Issue
The WuBoyz scraper was fully functional for direct scene scraping, but did not appear in the "Scrape All" bulk scraping results, even when scene URLs matched the scraper's patterns.

## Root Cause
The `/api/stash/scenes/:id/scrape-all` endpoint only handled:
- **Stash Box** endpoints (configured via GraphQL API)
- **GEVI** (Gay Erotic Video Index) lookups
- Fallback performer searches

It completely ignored custom YAML scrapers that were auto-loaded into the ScraperRegistry from the `configs/` directory.

## Solution Implemented
Modified `server/routes/stash.js` POST `/scenes/:id/scrape-all` endpoint to:

### 1. Collect Scene URLs
- Added fetch of `studioObject` in scene query (for future studio-based scraper lookups)
- Extract scene URL and parse episodeUrls array
- Build complete list of URLs to check against scrapers

### 2. Check Custom YAML Scrapers
- After loading the ScraperRegistry, iterate through all scrapers
- Filter for YAML-based scrapers by checking `scraper.sceneUrlPatterns` (non-YAML scrapers won't have this)
- For each YAML scraper, call `canHandle(url)` for each scene URL
- If URL matches, run `scraper.scrape(matchingUrl)`

### 3. Normalize Scraper Results
- Convert YAML scraper output to match stash-box result format for consistency
- Fields mapped:
  - `title` → `title`
  - `date` → `date`
  - `details` → `details`
  - `coverImage` → `image`
  - `performers` array → normalized `{name, url}` objects
  - `tags` array → `tags`
  - `studio` → `studio`

### 4. Add to Response
- Include custom scraper results in the `sources` array alongside stash-box results
- Each custom scraper gets its own source object with:
  - `id`: `custom-<scraper-name-kebab-case>`
  - `name`: Scraper name (e.g., "WuBoyz")
  - `endpoint`: Scraper name
  - `resultCount`: Number of results
  - `hasResults`: Boolean
  - `results`: Array of normalized scene objects

## Code Changes

### Change 1: Include studioObject in scene query (line ~4795)
```javascript
include: {
  performers: {
    include: { performer: true }
  },
  studioObject: {
    select: { id: true, name: true, scraperName: true, url: true }
  }
}
```

### Change 2: Collect scene URLs (lines ~4806-4825)
```javascript
const sceneUrls = [];
if (sceneWithPerformers?.url) sceneUrls.push(sceneWithPerformers.url);
if (sceneWithPerformers?.episodeUrls) {
  try {
    const parsedUrls = typeof sceneWithPerformers.episodeUrls === 'string'
      ? JSON.parse(sceneWithPerformers.episodeUrls)
      : sceneWithPerformers.episodeUrls;
    if (Array.isArray(parsedUrls)) {
      parsedUrls.forEach(urlItem => {
        if (typeof urlItem === 'string') {
          sceneUrls.push(urlItem);
        } else if (urlItem?.url) {
          sceneUrls.push(urlItem.url);
        }
      });
    }
  } catch (e) {
    console.warn('   - Failed to parse episodeUrls for scrape-all:', e.message);
  }
}
```

### Change 3: Check custom YAML scrapers (lines ~4827-4870)
```javascript
if (sceneUrls.length > 0) {
  console.log(`🔍 [Scrape All] Checking custom YAML scrapers for ${sceneUrls.length} URL(s)`);
  const registry = await getScraperRegistry();
  
  for (const scraper of registry.scrapers) {
    // Only process YAML scrapers (which have sceneUrlPatterns from config)
    if (!scraper.sceneUrlPatterns || scraper.sceneUrlPatterns.length === 0) {
      continue;
    }
    
    const matchingUrl = sceneUrls.find(url => scraper.canHandle(url));
    if (!matchingUrl) continue;
    
    try {
      const scrapeResult = await scraper.scrape(matchingUrl);
      
      if (scrapeResult?.success && scrapeResult?.scraped) {
        const scrapedData = scrapeResult.scraped;
        const normalizedResult = {
          title: scrapedData.title || sceneWithPerformers?.title,
          date: scrapedData.date,
          details: scrapedData.details,
          performers: (scrapedData.performers || []).map(p => ({
            name: typeof p === 'string' ? p : p.name,
            url: p.url
          })),
          studio: scrapedData.studio,
          image: scrapedData.coverImage,
          tags: (scrapedData.tags || []).map(t => typeof t === 'string' ? t : t.name)
        };
        
        resultsBySource[scraper.siteName] = [normalizedResult];
        fallbackUsage[scraper.siteName] = false;
      }
    } catch (error) {
      console.error(`   ❌ [${scraper.siteName}] Error during scrape-all:`, error.message);
      resultsBySource[scraper.siteName] = [];
      fallbackUsage[scraper.siteName] = false;
    }
  }
}
```

### Change 4: Add custom scrapers to response (lines ~4936-4956)
```javascript
Object.entries(resultsBySource).forEach(([scraperName, results]) => {
  // Skip stash box endpoints (they're already in sources from buildScrapeAllSources)
  const isStashBox = stashBoxes.some(box => box.endpoint === scraperName);
  if (isStashBox) return;
  
  // This is a custom YAML scraper result
  sources.push({
    id: `custom-${scraperName.toLowerCase().replace(/\s+/g, '-')}`,
    name: scraperName,
    endpoint: scraperName,
    configured: true,
    resultCount: Array.isArray(results) ? results.length : 0,
    hasResults: Array.isArray(results) && results.length > 0,
    usedFallback: fallbackUsage[scraperName] || false,
    results: Array.isArray(results) ? results : []
  });
  
  console.log(`   📌 Added custom scraper "${scraperName}" with ${Array.isArray(results) ? results.length : 0} result(s) to scrape-all response`);
});
```

## Testing

### How to Verify the Fix Works

1. **Open a WuBoyz scene** in the stash application (one with a URL like `https://www.wuboyz.com/scenes/...`)

2. **Click "Scrape All"** in the scene detail page

3. **Check the server logs** for messages like:
   ```
   🔍 [Scrape All] Checking custom YAML scrapers for X URL(s)
   ✅ [WuBoyz] Matched URL: https://www.wuboyz.com/scenes/...
   ✅ [WuBoyz] Successfully scraped scene
   📌 Added custom scraper "WuBoyz" with 1 result(s) to scrape-all response
   ```

4. **Check the Scrape All response** - you should see:
   - A new source entry with name "WuBoyz"
   - Result count showing the scraped data
   - Scene metadata (title, date, performers, tags) populated

### Example Response Structure
```javascript
{
  "message": "Compared 3 source(s).",
  "sceneId": "scene-123",
  "sources": [
    {
      "id": "stashbox-1",
      "name": "Stash-Box Instance 1",
      // ... stash box results ...
    },
    {
      "id": "custom-wuboyz",
      "name": "WuBoyz",
      "endpoint": "WuBoyz",
      "configured": true,
      "resultCount": 1,
      "hasResults": true,
      "usedFallback": false,
      "results": [
        {
          "title": "Scene Title",
          "date": "2026-08-14",
          "details": "Scene description",
          "performers": [
            { "name": "Performer 1", "url": null },
            { "name": "Performer 2", "url": "https://..." }
          ],
          "studio": "WuBoyz",
          "image": "https://...",
          "tags": ["Anal", "Bareback", ...]
        }
      ]
    },
    {
      "id": "gevi-performer-search",
      "name": "GEVI Performer Search",
      // ... GEVI results ...
    }
  ],
  "totalResults": X
}
```

## Benefits

1. **Unified Scraping Workflow** - All scrapers (Stash Box, GEVI, Custom YAML) work together in one "Scrape All" operation
2. **No Configuration Needed** - WuBoyz scraper works automatically once deployed
3. **Consistent Format** - Results normalized to common format for display
4. **Extensible** - Any new YAML scrapers added to configs/ are automatically included
5. **Better UX** - Users see all available data from all sources at once

## Performance Considerations

- Custom scrapers run in sequence (not parallel) with stash-box fetches
- If no stash boxes configured, custom scrapers still work
- Failed scraper runs don't block other sources
- Logging is minimal unless verbose logging enabled

## Rollback

If needed, revert to previous version by removing lines ~4806-4870 (custom scraper check) and lines ~4938-4956 (adding to response).
