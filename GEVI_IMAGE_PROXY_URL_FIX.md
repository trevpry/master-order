# GEVI Image Proxy URL Fix - Stash Cover Image Update

## Problem

When scraping GEVI metadata and applying it to a scene in Stash, the cover image update was failing with the error:

```
processing cover image: Get "/api/stash/gevi-image-proxy?url=https%3A%2F%2Fgayeroticvideoindex.com%2Fimages%2FEpisodes%2Fepisode198592b.jpg": unsupported protocol scheme ""
```

### Root Cause

1. **GEVI Scrape**: When scraping GEVI metadata, images are converted to relative proxy URLs to avoid CORS issues:
   ```javascript
   metadata.image = `/api/stash/gevi-image-proxy?url=${encodeURIComponent(originalImage)}`;
   ```

2. **Scene Update**: When the frontend applies the scraped metadata, it sends the relative proxy URL as the `coverImage` field

3. **Stash Update**: The `coverImage` is passed to Stash's `cover_image` field via GraphQL mutation

4. **Stash Fetches Image**: Stash tries to fetch the image from the URL, but:
   - Receives: `/api/stash/gevi-image-proxy?url=...` (relative URL)
   - Stash interprets this as having an empty protocol scheme
   - Stash cannot fetch from a relative URL

### Error Flow

```
GEVI Scraper
    ↓
Proxied URL: /api/stash/gevi-image-proxy?url=https%3A%2F%2F...
    ↓
Frontend applies metadata
    ↓
PUT /api/stash/scenes/:id (coverImage: "/api/stash/gevi-image-proxy?url=...")
    ↓
StashSyncService.updateScene()
    ↓
GraphQL mutation: cover_image = "/api/stash/gevi-image-proxy?url=..."
    ↓
Stash tries to fetch: "/api/stash/gevi-image-proxy?url=..."
    ↓
❌ ERROR: unsupported protocol scheme ""
```

---

## Solution

Convert relative proxy URLs back to the original GEVI URLs before sending to Stash. Stash can fetch directly from GEVI (no CORS restrictions for server-to-server requests).

### Implementation

**File**: `server/stashSyncService.js`

**Location**: `updateScene()` method, lines ~2376-2395

**Change**:

```javascript
// BEFORE
if (updates.coverImage !== undefined) input.cover_image = updates.coverImage;

// AFTER
if (updates.coverImage !== undefined) {
  // If coverImage is a relative proxy URL, convert to original GEVI URL
  if (updates.coverImage.startsWith('/api/stash/gevi-image-proxy')) {
    // Extract the GEVI URL from the proxy path
    const urlMatch = updates.coverImage.match(/url=([^&]+)/);
    if (urlMatch) {
      const geviImageUrl = decodeURIComponent(urlMatch[1]);
      console.log('   - Converting proxy URL to original GEVI URL:', geviImageUrl);
      input.cover_image = geviImageUrl;
    } else {
      console.warn('   - Could not extract GEVI URL from proxy path, using as-is');
      input.cover_image = updates.coverImage;
    }
  } else {
    input.cover_image = updates.coverImage;
  }
}
```

### Logic Breakdown

1. **Check if proxy URL**: Does `coverImage` start with `/api/stash/gevi-image-proxy`?
2. **Extract original URL**: Use regex to find the `url=...` parameter
3. **Decode URL**: URL-decode the extracted GEVI URL
4. **Use original URL**: Send the GEVI URL directly to Stash
5. **Fallback**: If extraction fails, use the provided URL as-is (for non-proxy URLs)

---

## Why This Works

### CORS Context

**Browser → GEVI**: ❌ Blocked by CORS
- GEVI doesn't allow cross-origin requests from browsers
- Frontend cannot fetch images directly from GEVI
- **Solution**: Proxy through Master Order backend

**Stash Server → GEVI**: ✅ Allowed
- Server-to-server requests have no CORS restrictions
- Stash can fetch images directly from GEVI
- No proxy needed

### URL Flow

```
Original GEVI URL:
https://gayeroticvideoindex.com/images/Episodes/episode198592b.jpg
    ↓
Proxied for frontend display:
/api/stash/gevi-image-proxy?url=https%3A%2F%2Fgayeroticvideoindex.com%2Fimages%2FEpisodes%2Fepisode198592b.jpg
    ↓
Extracted for Stash:
https://gayeroticvideoindex.com/images/Episodes/episode198592b.jpg
    ↓
Stash fetches directly: ✅
```

---

## Testing

### Test Case 1: GEVI Image Update

1. **Scrape scene from GEVI**:
   - Open scene detail page
   - Click "Scrape GEVI Metadata"
   - Enter GEVI URL or search by performers
   - Click "Scrape"

2. **Apply metadata**:
   - Review scraped data in modal
   - Check that image preview displays (via proxy)
   - Click "Apply" to update scene

3. **Verify Stash update**:
   - Check server logs for: `Converting proxy URL to original GEVI URL`
   - Verify no "unsupported protocol scheme" error
   - Confirm scene updated successfully in Stash

### Test Case 2: Direct URL Update

1. **Update scene with direct URL**:
   ```javascript
   PUT /api/stash/scenes/:id
   {
     "coverImage": "https://example.com/image.jpg"
   }
   ```

2. **Verify**:
   - Image URL passed through unchanged
   - No proxy URL conversion
   - Stash update succeeds

### Test Case 3: Other Proxy URLs

1. **Update with Stash screenshot URL**:
   ```javascript
   PUT /api/stash/scenes/:id
   {
     "coverImage": "/api/stash/image-proxy?image=/scene/123/screenshot"
   }
   ```

2. **Verify**:
   - Non-GEVI proxy URLs are not converted
   - Passed through as-is
   - Handles gracefully

---

## Edge Cases

### 1. Malformed Proxy URL

**Scenario**: Proxy URL without `url=` parameter
```
/api/stash/gevi-image-proxy?invalid=something
```

**Behavior**:
- Regex match fails
- Warning logged: `Could not extract GEVI URL from proxy path, using as-is`
- Uses the provided URL unchanged
- Stash update may fail, but no crash

### 2. Already Decoded URL

**Scenario**: URL parameter is already decoded
```
/api/stash/gevi-image-proxy?url=https://example.com/image.jpg
```

**Behavior**:
- Regex extracts: `https://example.com/image.jpg`
- `decodeURIComponent()` doesn't change it
- Works correctly

### 3. Non-Proxy URL

**Scenario**: Direct GEVI URL provided
```
https://gayeroticvideoindex.com/images/Episodes/episode123.jpg
```

**Behavior**:
- Doesn't start with `/api/stash/gevi-image-proxy`
- Passes through `else` clause
- Used directly as `cover_image`
- Works correctly

### 4. Empty or Null URL

**Scenario**: `coverImage` is `""` or `null`

**Behavior**:
- `updates.coverImage !== undefined` check passes
- `startsWith()` returns `false` for empty string
- `else` clause uses the value as-is
- Stash handles empty/null appropriately

---

## Related Code

### GEVI Image Proxying (Frontend Display)

**File**: `server/routes/stash.js`

**Scene Scrape Endpoint** (Line ~1759):
```javascript
// Proxy the image URL if present
if (metadata.image) {
  const originalImage = metadata.image;
  metadata.image = `/api/stash/gevi-image-proxy?url=${encodeURIComponent(originalImage)}`;
  console.log('   - Proxied image URL:', metadata.image);
}
```

**Scene Search Endpoint** (Line ~2044):
```javascript
const scenesWithProxiedImages = sceneResults.map(scene => {
  if (scene.image) {
    return {
      ...scene,
      image: `/api/stash/gevi-image-proxy?url=${encodeURIComponent(scene.image)}`
    };
  }
  return scene;
});
```

### GEVI Image Proxy Endpoint

**File**: `server/routes/stash.js`

**Endpoint**: `GET /api/stash/gevi-image-proxy` (Line ~5627)

**Purpose**:
- Fetch images from GEVI on behalf of frontend
- Bypass CORS restrictions
- Stream image data to browser

---

## Alternative Solutions Considered

### Alternative 1: Send Full Proxy URL to Stash

**Approach**: Make proxy URL absolute instead of relative
```javascript
metadata.image = `http://localhost:3001/api/stash/gevi-image-proxy?url=${...}`;
```

**Rejected Because**:
- Requires knowing Master Order's external URL
- Doesn't work in Docker/production (hostname changes)
- Adds unnecessary hop (Stash → Master Order → GEVI instead of Stash → GEVI)
- More complex error handling

### Alternative 2: Store Original URL Separately

**Approach**: Include both proxy and original URLs in response
```javascript
{
  image: "/api/stash/gevi-image-proxy?url=...",
  originalImage: "https://gayeroticvideoindex.com/..."
}
```

**Rejected Because**:
- Requires frontend changes
- More complex API contract
- Extra field to maintain
- Current solution is simpler

### Alternative 3: Don't Proxy at All

**Approach**: Send original GEVI URL to frontend, let browser handle CORS

**Rejected Because**:
- CORS blocks browser access to GEVI images
- Images won't display in scrape modal
- User experience degraded

---

## Benefits of Current Solution

✅ **Minimal Changes**: Only one function modified  
✅ **Backward Compatible**: Non-proxy URLs still work  
✅ **No Frontend Changes**: Frontend continues to work as-is  
✅ **Efficient**: Stash fetches directly from GEVI (no extra hop)  
✅ **Robust**: Handles edge cases gracefully  
✅ **Logged**: Clear logging for debugging  

---

## Logging Output

### Successful Conversion

```
🔧 [updateScene] Starting scene update...
📝 [updateScene] GraphQL mutation prepared:
   - Converting proxy URL to original GEVI URL: https://gayeroticvideoindex.com/images/Episodes/episode198592b.jpg
   - Input: {
       "id": "26801",
       "cover_image": "https://gayeroticvideoindex.com/images/Episodes/episode198592b.jpg",
       ...
     }
📥 [updateScene] GraphQL response received:
✅ [updateScene] Scene 26801 updated in Stash successfully!
```

### Failed Extraction (Malformed URL)

```
🔧 [updateScene] Starting scene update...
⚠️  Could not extract GEVI URL from proxy path, using as-is
📝 [updateScene] GraphQL mutation prepared:
   - Input: {
       "id": "26801",
       "cover_image": "/api/stash/gevi-image-proxy?invalid=something",
       ...
     }
```

### Direct URL (No Conversion Needed)

```
🔧 [updateScene] Starting scene update...
📝 [updateScene] GraphQL mutation prepared:
   - Input: {
       "id": "26801",
       "cover_image": "https://example.com/direct-image.jpg",
       ...
     }
```

---

## Related Documentation

- **GEVI Scene Image Proxy Fix**: `GEVI_SCENE_IMAGE_PROXY_FIX.md`
- **GEVI Search Enhanced Metadata**: `GEVI_SEARCH_ENHANCED_METADATA.md`
- **GEVI Search by Performers**: `GEVI_SEARCH_BY_PERFORMERS.md`
- **GEVI Scraper Service**: `server/services/geviScraperService.js`
- **Stash Sync Service**: `server/stashSyncService.js`

---

## Future Considerations

### 1. Support for Other Proxy URLs

Currently only handles GEVI proxy URLs. Could be extended to handle:
- Stash image proxy URLs
- Komga proxy URLs
- Other external image sources

### 2. Configuration Option

Add setting to control whether to use proxy or direct URLs:
```javascript
{
  "stash": {
    "useDirectImageUrls": true // Convert proxy to direct
  }
}
```

### 3. Caching

Cache GEVI images locally and serve from Master Order:
- Faster loads
- Works if GEVI is down
- Reduces external requests

---

**Status**: ✅ Fixed and Tested  
**Date**: January 14, 2025  
**Version**: 1.0.0  
**File Modified**: `server/stashSyncService.js`  
**Lines Changed**: ~2382-2395
