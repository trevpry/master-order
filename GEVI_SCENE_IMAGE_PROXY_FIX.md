# GEVI Image Proxying Fix - Scene Scrape Modal

## Problem

The "Scrape GEVI Metadata" modal was not displaying scene images from GEVI due to CORS (Cross-Origin Resource Sharing) restrictions. When the frontend tried to load images directly from `https://gayeroticvideoindex.com/`, the browser blocked them.

## Root Cause

The scrape and search endpoints were returning direct GEVI image URLs instead of using the proxy endpoint that bypasses CORS issues.

**Example of problematic URLs**:
- Direct: `https://gayeroticvideoindex.com/Images/Episodes/12345.jpg` ❌ (CORS blocked)
- Proxied: `/api/stash/gevi-image-proxy?url=https://...` ✅ (Works)

## Solution Implemented

### 1. Scene Scrape Endpoint Fix

**File**: `server/routes/stash.js` (POST `/api/stash/scenes/:id/scrape-gevi`)

**Change**: Added image URL proxying before returning scraped metadata:

```javascript
// Proxy the image URL if present
if (metadata.image) {
  const originalImage = metadata.image;
  metadata.image = `/api/stash/gevi-image-proxy?url=${encodeURIComponent(originalImage)}`;
  console.log('   - Proxied image URL:', metadata.image);
}
```

**Result**: Scene images now display in the "Review Scraped Metadata" modal.

### 2. Scene Search Endpoint Fix

**File**: `server/routes/stash.js` (POST `/api/stash/scenes/:id/search-gevi`)

**Change**: Added image URL proxying for search results:

```javascript
// Return the search results
// Proxy image URLs for any scenes that have images
const scenesWithProxiedImages = sceneResults.map(scene => {
  if (scene.image) {
    return {
      ...scene,
      image: `/api/stash/gevi-image-proxy?url=${encodeURIComponent(scene.image)}`
    };
  }
  return scene;
});

sendSuccess(res, {
  firstPerformer: { ... },
  secondPerformer: secondPerformer.name,
  scenes: scenesWithProxiedImages, // Using proxied images
  triedMatches: matchedFirstPerformerIndex + 1,
  totalMatches: firstPerformerResults.length
});
```

**Result**: Scene thumbnails now display in search results when using "Search by Performers".

## How It Works

### GEVI Image Proxy Endpoint

**Endpoint**: `GET /api/stash/gevi-image-proxy`

**Location**: `server/routes/stash.js` (line ~5608)

**Purpose**: Acts as a proxy server to fetch GEVI images and serve them to the frontend, bypassing CORS restrictions.

**Parameters**:
- `url` (query parameter) - The full GEVI image URL to proxy

**Example Usage**:
```
/api/stash/gevi-image-proxy?url=https://gayeroticvideoindex.com/Images/Episodes/12345.jpg
```

**How It Works**:
1. Validates the URL is from GEVI domain (security check)
2. Fetches the image from GEVI with proper headers (User-Agent, Referer)
3. Streams the image data back to the frontend
4. Sets appropriate headers (Content-Type, Cache-Control)
5. Caches for 24 hours to reduce repeated requests

### URL Encoding

The image URLs are properly encoded using `encodeURIComponent()` to handle special characters:

```javascript
encodeURIComponent('https://gayeroticvideoindex.com/Images/Episodes/foo bar.jpg')
// Returns: "https%3A%2F%2Fgayeroticvideoindex.com%2FImages%2FEpisodes%2Ffoo%20bar.jpg"
```

## Before vs After

### Scene Scrape Modal

**Before**:
```javascript
// Backend returns
scraped: {
  title: "Hot Summer Day",
  image: "https://gayeroticvideoindex.com/Images/Episodes/12345.jpg" // ❌ CORS blocked
}

// Frontend displays
<img src="https://gayeroticvideoindex.com/Images/Episodes/12345.jpg" />
// Result: No image shown, CORS error in console
```

**After**:
```javascript
// Backend returns
scraped: {
  title: "Hot Summer Day",
  image: "/api/stash/gevi-image-proxy?url=https%3A%2F%2F..." // ✅ Proxied
}

// Frontend displays
<img src="/api/stash/gevi-image-proxy?url=https%3A%2F%2F..." />
// Result: Image loads successfully
```

### Scene Search Results

**Before**:
```javascript
// Backend returns
scenes: [
  {
    title: "Beach Encounter",
    image: "https://gayeroticvideoindex.com/Images/Episodes/67890.jpg" // ❌ CORS blocked
  }
]

// Frontend displays search result with broken image
```

**After**:
```javascript
// Backend returns
scenes: [
  {
    title: "Beach Encounter",
    image: "/api/stash/gevi-image-proxy?url=https%3A%2F%2F..." // ✅ Proxied
  }
]

// Frontend displays search result with working thumbnail
```

## Affected Features

### 1. Scene Scraping
- **Modal**: "Scrape GEVI Metadata"
- **Location**: Scene Detail page → "🌐 Scrape GEVI" button
- **Impact**: Scene preview images now display in the review modal

### 2. Scene Search
- **Modal**: "Scrape GEVI Metadata" → "Search by Performers"
- **Location**: Scene Detail page → Search results
- **Impact**: Thumbnail images now display in search result list

## Frontend Display

### Review Modal Image Display

The frontend already had the code to display images, it just needed the proxied URLs:

```javascript
{scrapeData.scraped.image && (
  <div className="parse-field" style={{ /* ... */ }}>
    <img 
      src={scrapeData.scraped.image}  // Now receives proxied URL
      alt={scrapeData.scraped.title || 'Scene preview'}
      style={{
        maxWidth: '100%',
        maxHeight: '400px',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}
      onError={(e) => {
        e.target.style.display = 'none';
        console.error('Failed to load scene image:', scrapeData.scraped.image);
      }}
      onLoad={() => {
        console.log('✅ Scene image loaded successfully:', scrapeData.scraped.image);
      }}
    />
  </div>
)}
```

### Search Results Image Display

```javascript
{scene.image && (
  <img 
    src={scene.image}  // Now receives proxied URL
    alt={scene.title}
    style={{
      width: '120px',
      height: '68px',
      objectFit: 'cover',
      borderRadius: '4px',
      flexShrink: 0
    }}
    onError={(e) => {
      e.target.style.display = 'none';
    }}
  />
)}
```

## Testing

### Manual Testing Steps

1. **Scene Scrape with Image**:
   - Navigate to a Stash scene
   - Click "🌐 Scrape GEVI"
   - Enter a GEVI episode URL
   - Click "🔍 Scrape"
   - ✅ Verify: Scene image displays in review modal

2. **Scene Search with Images**:
   - Navigate to a Stash scene with 2+ performers
   - Click "🌐 Scrape GEVI"
   - Click "🔎 Search by Performers"
   - ✅ Verify: Thumbnails display next to each search result

3. **Console Checks**:
   - Open browser DevTools → Console
   - ✅ Verify: No CORS errors
   - ✅ Verify: Success message: "✅ Scene image loaded successfully"

4. **Network Tab**:
   - Open browser DevTools → Network tab
   - Filter by "Img"
   - ✅ Verify: Image requests go to `/api/stash/gevi-image-proxy`
   - ✅ Verify: Status 200 OK

## Performance Considerations

### Caching
- **Server-side**: 24-hour cache header set on proxy responses
- **Browser-side**: Browser will cache images based on headers
- **Benefit**: Repeated views don't re-fetch images from GEVI

### Image Loading
- **Size**: GEVI episode images are typically 200-400 KB
- **Load Time**: ~0.5-2 seconds depending on network
- **Optimization**: Images load asynchronously, don't block UI

### Bandwidth
- **First Load**: Full image fetched from GEVI through proxy
- **Subsequent Loads**: Served from browser cache (no bandwidth)
- **Concurrency**: Multiple images can load in parallel

## Security

### URL Validation
The proxy endpoint validates that URLs are from GEVI domain:

```javascript
if (!url.startsWith('https://gayeroticvideoindex.com/')) {
  return sendBadRequest(res, 'Only GEVI images are allowed');
}
```

This prevents the proxy from being used to fetch arbitrary external resources.

### Headers
Proper headers are sent to GEVI to avoid detection as a bot:

```javascript
headers: {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Referer': 'https://gayeroticvideoindex.com/'
}
```

## Troubleshooting

### Images Still Not Showing

**Check 1**: Browser Console Errors
- Look for CORS errors or 404s
- If `/api/stash/gevi-image-proxy` returns 404, server routing issue

**Check 2**: Server Logs
- Should see: `- Proxied image URL: /api/stash/gevi-image-proxy?url=...`
- If not present, backend fix not applied

**Check 3**: Network Requests
- Image URLs should start with `/api/stash/gevi-image-proxy`
- If starting with `https://gayeroticvideoindex.com/`, backend not proxying

### Slow Image Loading

**Possible Causes**:
1. GEVI server slow to respond
2. Large image files
3. Network latency

**Solutions**:
- Wait for images to load (check browser network tab)
- Images will cache after first load
- Consider increasing proxy timeout if needed

### Image 404 Errors

**Possible Causes**:
1. Image doesn't exist on GEVI
2. Invalid image URL in GEVI metadata
3. GEVI changed image paths

**Solutions**:
- Check the original GEVI URL in browser
- Verify image exists on GEVI's website
- May need to update scraper if GEVI changed structure

## Related Files

- **Backend Route**: `server/routes/stash.js`
  - Line ~1754: Scene scrape endpoint (image proxying added)
  - Line ~2039: Scene search endpoint (image proxying added)
  - Line ~5608: GEVI image proxy endpoint (existing)
- **Backend Service**: `server/services/geviScraperService.js`
  - Line ~110: Scene image extraction
  - Line ~1343: Search results image extraction
- **Frontend Component**: `client/src/modules/media/pages/stash/SceneDetail.jsx`
  - Line ~1323: Review modal image display
  - Line ~1260: Search results image display

## Related Documentation

- `GEVI_SEARCH_BY_PERFORMERS.md` - Scene search feature
- `GEVI_MOVIE_INTEGRATION.md` - Group/movie scraping (also uses proxied images)
- `GEVI_ACTION_CODE_TAGGING.md` - Action code extraction

---

**Status**: ✅ Fixed and Ready for Testing  
**Date**: January 14, 2025  
**Version**: 1.0.0  
**Files Modified**: `server/routes/stash.js` (2 endpoints updated)
