# GEVI Movie Search Fix - Puppeteer Button Click Issue

## Problem

When searching for GEVI movies, the Puppeteer automation was failing with:
```
❌ Error searching GEVI movie: Node is either not clickable or not an Element
```

The issue occurred when trying to click the "Movies" button (#moviesButton) on the GEVI search page.

## Root Cause

The Movies button was either:
1. Not immediately visible/clickable when the selector was found
2. Had a different ID or structure than expected
3. Required additional wait time or different interaction method

## Solution Implemented

### 1. Multiple Click Strategies

Instead of a single `page.click('#moviesButton')`, the code now tries **three different strategies** in order:

#### Strategy 1: Click by ID
```javascript
await page.waitForSelector('#moviesButton', { visible: true, timeout: 5000 });
await page.evaluate(() => {
  const btn = document.getElementById('moviesButton');
  if (btn) btn.click();
});
```

#### Strategy 2: Click by Text Content
```javascript
await page.evaluate(() => {
  const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
  const movieBtn = buttons.find(btn => 
    btn.textContent?.toLowerCase().includes('movie')
  );
  if (movieBtn) movieBtn.click();
});
```

#### Strategy 3: Click by Class/Data Attributes
```javascript
const selectors = [
  'button[data-filter="movies"]',
  'button.movies',
  'button.movie-filter',
  '[data-type="movies"]',
  '.filter-movies',
  'a[href*="movies"]'
];

for (const selector of selectors) {
  const elem = document.querySelector(selector);
  if (elem) {
    elem.click();
    return { success: true, selector };
  }
}
```

### 2. Debug Logging

Added comprehensive logging to understand what's on the page:

```javascript
// Log all buttons found on the page
const buttons = await page.evaluate(() => {
  const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
  return allButtons.map(btn => ({
    id: btn.id,
    class: btn.className,
    text: btn.textContent?.trim().substring(0, 50)
  }));
});
console.log(`   - Found ${buttons.length} buttons:`, JSON.stringify(buttons, null, 2));
```

```javascript
// Log page state after search
const pageInfo = await page.evaluate(() => {
  return {
    title: document.title,
    url: window.location.href,
    videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
    allLinks: document.querySelectorAll('a').length
  };
});
console.log(`   - Page info:`, pageInfo);
```

### 3. Graceful Degradation

If the Movies button can't be clicked, the search continues with all content types:

```javascript
if (!movieButtonClicked) {
  console.log(`   - ⚠️ Could not click Movies button, searching all content`);
}
// Continue with search anyway
```

### 4. Better Results Extraction

Instead of only looking for `a[href*="/video/"]`, now tries multiple patterns:

```javascript
const selectors = [
  'a[href*="/video/"]',
  'a[href*="/movie/"]',
  'a[href*="/m/"]',
  '.movie-link',
  '.video-link'
];
```

### 5. Improved Timing

- Changed `waitUntil: 'networkidle0'` → `waitUntil: 'domcontentloaded'` (faster, more reliable)
- Added 2 second wait after page load before attempting button click
- Increased search results wait from 2s → 3s

## Testing the Fix

To test the updated code:

1. **Start the server**:
   ```powershell
   npm run dev
   ```

2. **Try searching for a GEVI movie** from the Stash Group detail page

3. **Check the console logs** to see:
   - How many buttons were found
   - Which click strategy succeeded
   - What the page contains after search
   - How many results were found

## Expected Log Output (Success)

```
🎬 Searching GEVI for movie: "1000 Horny Nights"
   - Launching browser...
   - Navigating to search page...
   - Found 5 buttons: [{"id":"moviesButton","class":"filter-btn","text":"Movies"}...]
   - Attempting to click Movies button...
   - ✓ Clicked via ID
   - Entering search term: "1000 Horny Nights"
   - Waiting for search results...
   - Page info: {"title":"Search Results","url":"https://gayeroticvideoindex.com/search","videoLinks":12,"allLinks":45}
✅ Found 12 movies matching "1000 Horny Nights"
```

## Expected Log Output (Fallback)

```
🎬 Searching GEVI for movie: "1000 Horny Nights"
   - Launching browser...
   - Navigating to search page...
   - Found 3 buttons: [{"id":"searchBtn","class":"btn","text":"Search"}...]
   - Attempting to click Movies button...
   - ID selector failed: waiting for selector `#moviesButton` failed: timeout 5000ms exceeded
   - Text search failed: No movie button found
   - ⚠️ Could not click Movies button, searching all content
   - Entering search term: "1000 Horny Nights"
   - Waiting for search results...
   - Page info: {"title":"Search Results","url":"https://gayeroticvideoindex.com/search","videoLinks":25,"allLinks":80}
✅ Found 25 movies matching "1000 Horny Nights"
```

## Advantages of This Approach

1. **Resilient**: Works even if GEVI changes their button IDs/classes
2. **Debuggable**: Comprehensive logging shows exactly what's happening
3. **Graceful**: Falls back to searching all content if movie filter fails
4. **Fast**: Uses `domcontentloaded` instead of waiting for all network activity
5. **Flexible**: Multiple result extraction patterns catch different URL formats

## Potential Future Improvements

If the issue persists, consider:

1. **Screenshot on failure**: Save page screenshot for debugging
   ```javascript
   await page.screenshot({ path: 'debug-gevi-search.png' });
   ```

2. **HTML dump on failure**: Save page HTML to inspect structure
   ```javascript
   const html = await page.content();
   fs.writeFileSync('debug-gevi-search.html', html);
   ```

3. **Interactive mode**: Launch browser with `headless: false` to watch it work
   ```javascript
   browser = await puppeteer.launch({ headless: false });
   ```

4. **Alternative search method**: If button clicking never works, could try:
   - Directly navigating to search URL with query parameters
   - Using GEVI's API endpoints (if they exist)
   - Parsing the raw HTML of the search page

## Files Modified

- `server/services/geviScraperService.js` (searchMovie function, lines ~900-1050)

## Related Documentation

- `GEVI_SEARCH_BY_PERFORMERS.md` - Performer search implementation
- `GEVI_MOVIE_INTEGRATION.md` - Original movie scraping feature
- `GEVI_URL_STORAGE_AND_SCENE_GROUP_FIX.md` - Group/scene integration

---

**Status**: ✅ Fix Implemented, Ready for Testing  
**Date**: January 14, 2025  
**Version**: 1.1.0
