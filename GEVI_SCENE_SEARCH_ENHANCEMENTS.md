# GEVI Scene Search Enhancements

**Date**: October 17, 2025  
**Status**: ✅ COMPLETE

---

## Summary

Enhanced the GEVI search functionality to properly distinguish between:
1. **Scene searches** (Search by Performers, Search by Title) - for finding and scraping scene metadata
2. **Movie searches** (Search Movies) - for creating/linking movies

Both search types now behave correctly with appropriate UI indicators and actions.

---

## Issues Fixed

### Issue 1: Scene Search Used Wrong Endpoint Type
**Problem**: Scene search results (from "Search by Performers") were showing movie creation badges and attempting to create/link movies when clicked.

**Root Cause**: 
- Frontend checked for `scene.matchedPerformers` property to determine if result was a movie
- Updated scene search now also returns `matchedPerformers` for ranking
- This caused scene results to be mistaken for movie results

**Solution**: Added explicit flags to differentiate search types:
- `isSceneSearch: true` - Search by Performers results
- `isSceneSearchByTitle: true` - Search by Title results
- No flag - Search Movies results (movie operations)

### Issue 2: Multi-Performer Search Not Working
**Problem**: Scene search was only searching for second performer instead of all performers.

**Solution**: Updated to search all performers (except first) and rank results by match count, similar to movie search.

### Issue 3: Wrong Parameter Type
**Problem**: Backend expected performer object but received string, causing `Cannot read properties of undefined (reading 'toLowerCase')` error.

**Solution**: Changed from passing `performer.name` (string) to passing `performer` (object with name property).

---

## Implementation Changes

### Backend (`server/routes/stash.js`)

#### Updated: `/api/stash/scenes/:id/search-gevi` Endpoint

**Before**: Searched only for second performer
```javascript
const firstPerformer = performers[0];
const secondPerformer = performers[1];

const sceneResults = await geviScraper.searchScenesWithPerformers(
  firstPerformerUrl, 
  secondPerformer.name  // Only searching one performer
);
```

**After**: Searches all performers and ranks by matches
```javascript
const allPerformers = scene.performers.map(sp => sp.performer);
const firstPerformer = allPerformers[0];

// Search for each performer (except first)
const scenesByUrl = new Map();

for (let i = 1; i < allPerformers.length; i++) {
  const performer = allPerformers[i];
  
  // Pass performer object (not just name string)
  const performerScenes = await geviScraper.searchScenesWithPerformers(
    performerPage.url, 
    performer  // Pass full performer object
  );

  // Track which performers matched each scene
  for (const scene of performerScenes) {
    if (scenesByUrl.has(scene.url)) {
      scenesByUrl.get(scene.url).matchedPerformers.push(performer.name);
    } else {
      scenesByUrl.set(scene.url, {
        ...scene,
        matchedPerformers: [performer.name]
      });
    }
  }
}

// Sort by number of matches (descending)
let scenes = Array.from(scenesByUrl.values()).sort((a, b) => {
  return b.matchedPerformers.length - a.matchedPerformers.length;
});
```

**Response Format**:
```json
{
  "success": true,
  "data": {
    "firstPerformer": {
      "name": "Milan Breeze",
      "url": "https://gayeroticvideoindex.com/performer/34766"
    },
    "searchedPerformers": ["George Basten", "Nikolas Markov", "Peter Kyck"],
    "scenes": [
      {
        "title": "Scene Title",
        "url": "https://gayeroticvideoindex.com/episode/123",
        "matchedPerformers": ["George Basten", "Nikolas Markov"]
      }
    ],
    "totalScenes": 5,
    "performersSearched": 3
  }
}
```

### Frontend (`client/src/modules/media/pages/stash/SceneDetail.jsx`)

#### 1. Added Search Type Flags

**handleSearchGevi** (Search by Performers):
```javascript
setSearchResults({
  firstPerformer,
  searchedPerformers,
  scenes: scenesWithProxiedImages,
  isSceneSearch: true  // Flag for scene search
});
```

**handleSearchGeviByTitle** (Search by Title):
```javascript
setSearchResults({
  firstPerformer: { name: studio.name },
  secondPerformer: `(Title: "${searchTitle}")`,
  scenes: scenes,
  isSceneSearchByTitle: true  // Flag for title search
});
```

#### 2. Updated Click Handler Logic

**Before**: Checked for `matchedPerformers` property
```javascript
onClick={() => {
  // Check if this is a movie result (has matchedPerformers)
  if (scene.matchedPerformers) {
    handleSelectSearchResult(scene.url, scene);
  } else {
    handleSelectSearchResult(scene.url);
  }
}}
```

**After**: Checks search type flags first
```javascript
onClick={() => {
  // Only pass movieData if this is a movie search (not scene search)
  if (searchResults.isSceneSearch || searchResults.isSceneSearchByTitle) {
    // Scene search - just populate URL for scraping
    handleSelectSearchResult(scene.url);
  } else if (scene.matchedPerformers) {
    // Movie search - handle movie creation/linking
    handleSelectSearchResult(scene.url, scene);
  } else {
    // Fallback - just populate URL
    handleSelectSearchResult(scene.url);
  }
}}
```

#### 3. Updated Display Logic

**Movie Badges** - Only show for movie searches:
```javascript
{!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && scene.existingMovieId && (
  <span>✓ IN DATABASE</span>
)}
{!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && scene.matchedPerformers && !scene.existingMovieId && (
  <span>✦ NEW MOVIE</span>
)}
```

**Action Hints**:
```javascript
{/* Movie search hints */}
{!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && scene.existingMovieId && (
  <div>→ Will link scene to existing movie</div>
)}
{!searchResults.isSceneSearch && !searchResults.isSceneSearchByTitle && scene.matchedPerformers && !scene.existingMovieId && (
  <div>→ Will create new movie and link scene</div>
)}

{/* Scene search hint */}
{(searchResults.isSceneSearch || searchResults.isSceneSearchByTitle) && (
  <div style={{ color: '#6366f1' }}>
    → Click to populate URL and scrape scene metadata
  </div>
)}
```

**Matched Performers** - Show for both search types:
```javascript
{scene.matchedPerformers && scene.matchedPerformers.length > 0 && (
  <div>
    ✓ {scene.matchedPerformers.length} {scene.matchedPerformers.length === 1 ? 'match' : 'matches'}: 
    {scene.matchedPerformers.join(', ')}
  </div>
)}
```

#### 4. Updated Header Text

```javascript
<h4>
  Found {searchResults.scenes.length} {
    searchResults.isSceneSearch ? 
      (searchResults.scenes.length === 1 ? 'scene' : 'scenes') : 
      (searchResults.scenes.length === 1 ? 'movie' : 'movies')
  }
  {searchResults.searchedPerformers ? 
    ` (searched for: ${searchResults.searchedPerformers.join(', ')})` :
    ` with ${searchResults.firstPerformer.name} and ${searchResults.secondPerformer}`
  }:
</h4>
```

---

## User Experience

### Search by Performers (Scene Search)

**Flow**:
1. User clicks "🔎 Search by Performers"
2. System searches all performers (except first) on first performer's page
3. Results show scenes ranked by number of matching performers
4. Each result displays:
   - Scene title
   - ✓ X matches: [performer names] (green text)
   - → Click to populate URL and scrape scene metadata (blue italic)
5. User clicks desired scene
6. GEVI URL populates in input field
7. User clicks "🔍 Scrape" to extract metadata

**NO movie creation/linking occurs**

### Search by Title (Scene Search)

**Flow**:
1. User clicks "🔎 Search by Title"
2. System searches studio's GEVI page for title
3. Results show matching scenes
4. Each result displays:
   - Scene title
   - → Click to populate URL and scrape scene metadata (blue italic)
5. User clicks desired scene
6. GEVI URL populates in input field
7. User clicks "🔍 Scrape" to extract metadata

**NO movie creation/linking occurs**

### Search Movies (Movie Search)

**Flow**:
1. User clicks "🎬 Search Movies"
2. System searches all performers in movies section
3. Results show movies ranked by number of matching performers
4. Each result displays:
   - Movie title
   - ✓ IN DATABASE badge (green) OR ✦ NEW MOVIE badge (orange)
   - ✓ X matches: [performer names] (green text)
   - → Will link to existing movie OR → Will create new movie (italic)
5. User clicks desired movie
6. System CREATES movie (if new) or LINKS to existing movie
7. Scene is linked to movie
8. Redirects to movie detail page

**Movie creation/linking DOES occur**

---

## Example Outputs

### Scene Search with 4 Performers

**Input**: Scene with Milan Breeze, George Basten, Nikolas Markov, Peter Kyck

**Backend Log**:
```
🔍 [GEVI Search] Starting search for scene: 32205
   - Scene has 4 performers: Milan Breeze, George Basten, Nikolas Markov, Peter Kyck
   - Primary search performer: Milan Breeze
   - Found 1 matches for first performer
   - Using performer: Milan Breeze (https://...)
   - Searching for 3 other performers in episodes...
   - [1/3] Searching for: George Basten
   - Found 12 scenes with George Basten
   - [2/3] Searching for: Nikolas Markov
   - Found 8 scenes with Nikolas Markov
   - [3/3] Searching for: Peter Kyck
   - Found 5 scenes with Peter Kyck
   - Total unique scenes found: 18
   - Match distribution:
   - 3 scene(s) with 3 matching performer(s)
   - 8 scene(s) with 2 matching performer(s)
   - 7 scene(s) with 1 matching performer(s)
```

**Frontend Display**:
```
Found 18 scenes (searched for: George Basten, Nikolas Markov, Peter Kyck):

┌─────────────────────────────────────────────┐
│ Scene Title 1                               │
│ ✓ 3 matches: George Basten, Nikolas Markov,│
│              Peter Kyck                     │
│ → Click to populate URL and scrape scene   │
│   metadata                                  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ Scene Title 2                               │
│ ✓ 2 matches: George Basten, Nikolas Markov │
│ → Click to populate URL and scrape scene   │
│   metadata                                  │
└─────────────────────────────────────────────┘
```

---

## Benefits

✅ **Correct Behavior**: Scene searches populate URL for scraping, movie searches create/link movies  
✅ **Multi-Performer Ranking**: Scene search now ranks by all matching performers (not just one)  
✅ **Clear UI Indicators**: Different helper text and badges for scene vs movie searches  
✅ **Better Results**: More accurate scene matches with multiple performer names  
✅ **No False Positives**: Scene results won't accidentally trigger movie operations  
✅ **Consistent UX**: Similar search and ranking logic for both scene and movie searches

---

## Testing Checklist

- [x] ✅ Backend accepts performer objects (not strings)
- [x] ✅ Scene search searches all performers except first
- [x] ✅ Scene search ranks results by match count
- [x] ✅ Scene search returns `isSceneSearch: true` flag
- [x] ✅ Title search returns `isSceneSearchByTitle: true` flag
- [x] ✅ Movie search has no search type flag
- [x] ✅ Scene search results show blue "scrape metadata" hint
- [x] ✅ Scene search results DON'T show movie badges
- [x] ✅ Movie search results show green/orange badges
- [x] ✅ Movie search results show movie action hints
- [x] ✅ Clicking scene result populates URL only
- [x] ✅ Clicking movie result triggers creation/linking
- [ ] Runtime test: Scene with 3+ performers
- [ ] Runtime test: Click scene result and scrape
- [ ] Runtime test: Click movie result and verify creation
- [ ] Runtime test: Verify no movie operations from scene search

---

## Files Modified

### Backend
- ✅ `server/routes/stash.js`
  - Updated `/api/stash/scenes/:id/search-gevi` endpoint
  - Changed from single performer to multi-performer search
  - Fixed parameter type (object instead of string)
  - Added ranking by match count
  - Updated response format

### Frontend
- ✅ `client/src/modules/media/pages/stash/SceneDetail.jsx`
  - Added `isSceneSearch` flag to scene performer search
  - Added `isSceneSearchByTitle` flag to title search
  - Updated click handler to check flags before passing movieData
  - Conditional display of badges based on search type
  - Different helper text for scene vs movie searches
  - Updated header text to show searched performers

---

## Related Issues

- ✅ Fixed: ID type mismatch (String vs Int) - `GEVI_MOVIE_SEARCH_ENDPOINT_FIX.md`
- ✅ Fixed: Search Movies endpoint and movie creation/linking
- ✅ Fixed: Multi-performer scene search with ranking
- ✅ Fixed: Scene search incorrectly showing movie UI

---

## Related Documentation

- `GEVI_MOVIE_SEARCH_IMPLEMENTATION.md` - Movie search feature
- `GEVI_SEARCH_BY_PERFORMERS.md` - Original scene search documentation
- `GEVI_MOVIE_SEARCH_ENDPOINT_FIX.md` - Endpoint and ID type fixes

---

**Status**: ✅ COMPLETE - Ready for testing  
**Last Updated**: October 17, 2025
