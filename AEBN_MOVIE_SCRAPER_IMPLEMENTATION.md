# AEBN Movie Scraper Implementation Status

## Overview
Added infrastructure to support AEBN and other scrapers for movie/group scraping in the GroupDetail page, following the same pattern used in SceneDetail.

## Changes Completed

### Frontend (`client/src/modules/media/pages/stash/GroupDetail.jsx`)

1. **State Management (Lines 19-21)**
   ```javascript
   const [selectedScraper, setSelectedScraper] = useState(null);
   const [availableScrapers, setAvailableScrapers] = useState([]);
   ```

2. **Scraper Loading (Lines 23-45)**
   - Added `loadScrapers()` function called in useEffect
   - Fetches available scrapers from `/api/stash/scrapers`
   - Filters for scrapers supporting movies: `s.siteName === 'AEBN' || s.scrapeMovie`
   - Defaults to AEBN if available, otherwise first scraper

3. **Dual-Mode Scraping (Lines 115-145)**
   - Modified `handleScrapeGevi()` to check `selectedScraper`
   - Routes to appropriate endpoint:
     - GEVI → `/api/gevi/movie` (native)
     - YAML scrapers → `/api/stash/groups/:id/scrape-generic`
   - Passes `scraperName` for YAML scrapers

4. **Scraper Selector UI**
   - Added dropdown in scrape modal to select scraper
   - Shows scraper name (GEVI or scraper siteName)
   - Updates placeholder text based on selected scraper
   - Disabled during scraping

### Backend (`server/routes/stash.js`)

1. **New Endpoint (Lines 3186-3296)** - `POST /api/stash/groups/:id/scrape-generic`
   - Accepts `url` and optional `scraperName` parameters
   - Validates URL and group existence
   - Uses scraper registry to find appropriate scraper
   - Auto-detects scraper from URL if name not provided
   - Calls `scrapeMovie()` method if available, falls back to `scrape()`
   - Matches studio and tags against local database
   - Returns scraped metadata with matched/unmatched entities

## Current Limitations

### AEBN Movie Support NOT Implemented
The AEBN scraper (`server/services/scrapers/AebnScraper.js`) currently only supports **scene scraping**, not movie scraping:

- **Current**: `scrape(url, scenePerformers, sceneNumber)` - Scrapes scenes from movie pages
- **Missing**: `scrapeMovie(url)` method for movie metadata

### Why This Matters
When a user selects AEBN scraper and provides an AEBN movie URL, the current implementation will:
1. ✅ Accept the URL
2. ✅ Route to `/groups/:id/scrape-generic` endpoint
3. ✅ Find AEBN scraper in registry
4. ❌ **FAIL** - AEBN scraper has no `scrapeMovie()` method

## Implementation Options

### Option 1: Add scrapeMovie() to AebnScraper.js (Recommended)
Create a new method in `server/services/scrapers/AebnScraper.js`:

```javascript
/**
 * Scrape movie metadata from AEBN movie page
 * @param {string} url - AEBN movie URL (e.g., https://gay.aebn.com/gay/movies/...)
 */
async scrapeMovie(url) {
  console.log(`🔍 [AEBN Movie Scraper] Scraping movie URL: ${url}`);
  
  let browser = null;
  
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    const content = await page.content();
    const $ = cheerio.load(content);
    
    // Extract movie-level metadata
    const title = $('h1[class*="title"]').first().text().trim();
    const synopsis = $('div[class*="synopsis"], div[class*="description"]').first().text().trim();
    const releaseDate = $('span:contains("Release Date")').next().text().trim();
    const studio = $('a[href*="/studios/"]').first().text().trim();
    const duration = $('span:contains("Length")').next().text().trim();
    const director = $('a[href*="/directors/"]').first().text().trim();
    const image = $('img[class*="boxcover"], img[alt*="Cover"]').first().attr('src');
    
    // Extract tags/categories
    const tags = [];
    $('a[href*="/categories/"]').each((i, el) => {
      const tag = $(el).text().trim();
      if (tag) tags.push(tag);
    });
    
    // Extract external URLs
    const urls = [url]; // Include the AEBN URL itself
    
    return {
      success: true,
      scraped: {
        title,
        synopsis,
        date: releaseDate,
        studio,
        duration,
        director,
        image,
        tags,
        urls
      }
    };
  } catch (error) {
    console.error('❌ [AEBN Movie Scraper] Error:', error);
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
```

**Note**: Selectors above are placeholders - need to inspect actual AEBN movie pages to determine correct selectors.

### Option 2: Create AEBN YAML Configuration
Create `server/services/scrapers/configs/AEBN.yml`:

```yaml
name: AEBN
movieByURL:
  - action: scrapeXPath
    url:
      - aebn.com
      - gay.aebn.com
    scraper: movieScraper

xPathScrapers:
  movieScraper:
    movie:
      Title: //h1[@class="movie-title"]/text()
      Synopsis: //div[@class="synopsis"]/p/text()
      Date: //span[contains(text(),"Release Date")]/following-sibling::span/text()
      Studio:
        Name: //a[contains(@href,"/studios/")]/text()
      Duration: //span[contains(text(),"Length")]/following-sibling::span/text()
      Director: //a[contains(@href,"/directors/")]/text()
      Image: //img[@class="boxcover"]/@src
      Tags:
        Name: //a[contains(@href,"/categories/")]/text()
```

**Note**: XPath selectors above are placeholders - need to inspect actual AEBN movie pages.

## Search by Title Feature

The user also requested "Allow searching by title" for movies. This would require:

1. **Frontend**: Add search input and button to scrape modal (similar to SceneDetail)
2. **Backend**: Create search endpoint that queries AEBN's search API or scrapes search results
3. **Flow**: User types title → searches AEBN → selects result → scrapes selected movie

This is not yet implemented.

## Testing Checklist

Once AEBN movie support is added:

- [ ] Verify AEBN movie URL can be scraped
- [ ] Confirm metadata fields are correctly extracted (title, date, studio, tags, etc.)
- [ ] Test studio matching against local database
- [ ] Test tag matching against local database
- [ ] Verify scraped data appears in review modal
- [ ] Confirm data saves correctly to Stash and local database
- [ ] Test with multiple AEBN movie URLs
- [ ] Verify external URLs are collected and saved

## Related Files

- **Frontend**: `client/src/modules/media/pages/stash/GroupDetail.jsx`
- **Backend Route**: `server/routes/stash.js` (lines 3186-3296)
- **AEBN Scraper**: `server/services/scrapers/AebnScraper.js`
- **YAML Scraper**: `server/services/scrapers/YamlScraperService.js`
- **Scraper Registry**: `server/services/scrapers/ScraperRegistry.js`
- **Reference Implementation**: `client/src/modules/media/pages/stash/SceneDetail.jsx` (lines 770-850)

## Current Status

✅ **Infrastructure Complete**: All plumbing for AEBN movie scraping is in place
❌ **Scraper Not Implemented**: AEBN scraper needs `scrapeMovie()` method or YAML config
❌ **Search Not Implemented**: Title-based search functionality not yet added

The UI is ready and will work once the AEBN scraper implements `scrapeMovie()` or a YAML configuration is created.
