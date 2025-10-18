# GEVI Movie/Group Integration - Implementation Summary

## Overview
Added comprehensive movie/group scraping and matching functionality to the GEVI scraper, enabling automatic detection and linking of movies when scraping episodes from GEVI.

## Implementation Date
January 2025

## Features Implemented

### 1. Movie Detection in Episodes
- **Location**: `server/services/geviScraperService.js` - `scrapeScene()` method
- **Functionality**: 
  - Detects "Found in these movies:" and "Found in this movie:" sections on GEVI episode pages
  - Extracts all movie links with names and URLs
  - Returns movie data as part of the scene scrape metadata

**Code Pattern**:
```javascript
// Extract movies from "Found in these movies:" or "Found in this movie:" sections
metadata.movies = [];

// Try "Found in these movies:" (plural)
let moviesHeader = $('div:contains("Found in these movies:")').filter((i, el) => {
  return $(el).text().trim() === "Found in these movies:";
}).first();

// Try "Found in this movie:" (singular) if plural not found
if (!moviesHeader.length) {
  moviesHeader = $('div:contains("Found in this movie:")').filter((i, el) => {
    return $(el).text().trim() === "Found in this movie:";
  }).first();
}

if (moviesHeader.length) {
  const moviesContainer = moviesHeader.parent();
  if (moviesContainer.length) {
    const movieLinks = moviesContainer.find('a[href*="video/"]');
    movieLinks.each((i, link) => {
      const movie = this.nameWithUrl($, link);
      metadata.movies.push(movie);
    });
  }
}
```

### 2. Movie Full Details Fetching
- **Method**: `movieFromUrl(url)` in `GeviScraperService`
- **Location**: `server/services/geviScraperService.js`
- **Extracts**:
  - Movie name (title)
  - Front and back cover images
  - Synopsis/description
  - Duration (length)
  - Release date (year - GEVI only provides year, defaults to Jan 1)
  - Studio and distributor information
  - Director(s)
  - Source URL

**Based on Python Implementation**: 
References `GEVI.py` lines 249-289 (`movie_from_url()` function)

**Data Structure**:
```javascript
{
  url: "https://gayeroticvideoindex.com/video/...",
  name: "Movie Title",
  front_image: "https://gayeroticvideoindex.com/.../Covers/...",
  back_image: "https://gayeroticvideoindex.com/.../Covers/...",
  synopsis: "Movie description...",
  duration: "120:00",
  date: "2023-01-01",
  studio: "Studio Name" or {
    name: "Studio Name",
    parent: { name: "Parent Company", url: "..." }
  },
  director: "Director Name, Co-Director Name"
}
```

### 3. Group Matching Logic
- **Method**: `matchGroups(scrapedMovies, prisma)` in `GeviScraperService`
- **Location**: `server/services/geviScraperService.js`
- **Matching Strategy**:
  1. Exact name match (normalized - no spaces, lowercase)
  2. Partial match - scraped name contains DB name
  3. Partial match - DB name contains scraped name
  4. Alias matching - checks comma-separated aliases field
  5. Confidence threshold: 0.7 (70% match required)

**Features**:
- Returns best match with alternatives
- Includes match metadata (matched via name/alias, score)
- Returns studio and date info for context
- Stores GEVI URL for fetching full details later
- SQLite-compatible (filters in JavaScript, not SQL)

**Response Format**:
```javascript
{
  matched: [
    {
      id: "stash-group-id",
      name: "Movie Title",
      studio: "Studio Name",
      date: "2023-01-01",
      matchedVia: "name" | "alias",
      matchedAlias: "Alternative Title" (if matched via alias),
      alternatives: [
        {id: "...", name: "...", studio: "...", matchedVia: "..."}
      ],
      originalName: "Scraped Movie Title",
      url: "https://gayeroticvideoindex.com/video/..."
    }
  ],
  unmatched: [
    {
      name: "Unmatched Movie Title",
      url: "https://gayeroticvideoindex.com/video/..."
    }
  ]
}
```

### 4. API Endpoints

#### Updated: POST `/api/stash/scenes/:id/scrape-gevi`
- **Location**: `server/routes/stash.js` line 1361
- **Enhancement**: Now includes group matching in response
- **Response Structure**:
```javascript
{
  scraped: {
    title: "...",
    performers: [...],
    studio: "...",
    movies: [
      {name: "Movie Title", url: "https://..."}
    ],
    ...
  },
  matched: {
    studio: {...},
    performers: [...],
    groups: [...]  // NEW: Matched groups/movies
  },
  unmatched: {
    studio: null | "Studio Name",
    performers: [...],
    groups: [...]  // NEW: Unmatched groups/movies
  }
}
```

#### New: POST `/api/stash/gevi/movie`
- **Location**: `server/routes/stash.js` (after scrape-gevi endpoint)
- **Purpose**: Fetch full movie details when user selects an unmatched movie
- **Request Body**:
```javascript
{
  url: "https://gayeroticvideoindex.com/video/12345"
}
```
- **Response**:
```javascript
{
  movie: {
    name: "...",
    front_image: "...",
    back_image: "...",
    synopsis: "...",
    duration: "120:00",
    date: "2023-01-01",
    studio: "...",
    director: "...",
    url: "..."
  },
  source: "GEVI",
  sourceUrl: "..."
}
```

## Integration Points

### Backend Services
1. **GeviScraperService** (`server/services/geviScraperService.js`)
   - Added `movieFromUrl()` method (~130 lines)
   - Added `matchGroups()` method (~120 lines)
   - Updated `scrapeScene()` to extract movie links (~30 lines added)

2. **Stash Routes** (`server/routes/stash.js`)
   - Updated `/scenes/:id/scrape-gevi` endpoint to include group matching
   - Added `/gevi/movie` endpoint for fetching full movie details

### Frontend Integration (✅ COMPLETE)
The frontend has been updated to display movie/group data in the scrape results modal:

1. **SceneDetail.jsx** - GEVI scrape results modal updated:
   - ✅ Added "Movies/Groups" section after performers
   - ✅ Display matched groups with selection UI (like performers)
   - ✅ Show alternatives dropdown for matched groups
   - ✅ Display unmatched groups with "Fetch Details" button
   - ✅ "Fetch Details" button calls `/api/stash/gevi/movie` to get full movie metadata
   - ✅ Shows group studio info in matched results
   - ✅ Allows switching between alternative group matches

2. **Group Association** (Next Phase - To Be Implemented):
   - ⏳ Create new group from fetched movie details
   - ⏳ Add scene to selected group's scene list
   - ⏳ Set appropriate scene index in group
   - ⏳ Show group cover images in selection UI

## Workflow

### User Flow for Scene Scraping
1. User clicks "Scrape from GEVI" on a scene
2. System scrapes GEVI episode page
3. Backend extracts:
   - Scene metadata (title, date, performers, etc.)
   - Movie links from "Found in these movies" section
4. Backend matches:
   - Performers against StashPerformer table
   - Studio against StashStudio table
   - **Movies against StashGroup table** ← NEW
5. Frontend displays scrape results with:
   - Matched performers (with alternatives)
   - Matched studio
   - **Matched groups/movies (with alternatives)** ← NEW
   - Unmatched items for creation
6. User reviews and selects:
   - Which performer matches to use
   - Which studio to use
   - **Which group to associate (or create new)** ← NEW
7. System updates scene with selected associations

### Movie Details Fetching (for unmatched)
1. User sees unmatched movie in scrape results
2. User clicks "Fetch Details" or "Create New Group"
3. Frontend calls POST `/api/stash/gevi/movie` with movie URL
4. Backend fetches full movie metadata from GEVI
5. Frontend displays full movie details for review
6. User confirms to create new group with fetched metadata
7. System creates StashGroup and associates scene

## Database Schema
No changes needed - uses existing `StashGroup` table:
```prisma
model StashGroup {
  id            String              @id
  name          String
  aliases       String?
  duration      Int?
  date          String?
  rating        Int?
  director      String?
  synopsis      String?
  url           String?
  front_image   String?
  back_image    String?
  studio_id     String?
  studio        StashStudio?        @relation(fields: [studio_id], references: [id])
  scenes        StashGroupScene[]
  tags          StashGroupTag[]
}
```

## Testing Checklist

### Backend Tests
- [x] Syntax validation of `geviScraperService.js`
- [x] Syntax validation of `stash.js`
- [ ] Test `scrapeScene()` with episode that has movie links
- [ ] Test `scrapeScene()` with episode without movies
- [ ] Test `movieFromUrl()` with various movie pages
- [ ] Test `matchGroups()` with exact name matches
- [ ] Test `matchGroups()` with partial matches
- [ ] Test `matchGroups()` with alias matches
- [ ] Test `matchGroups()` with no matches
- [ ] Test POST `/api/stash/scenes/:id/scrape-gevi` endpoint
- [ ] Test POST `/api/stash/gevi/movie` endpoint

### Frontend Tests
- [x] Verify movie data appears in scrape results modal
- [x] Test matched group selection with alternatives
- [x] Test "Fetch Details" button for unmatched movies
- [x] Test unmatched group "Add New" flow
- [ ] Verify group association saves correctly (ready to test)
- [ ] Test scene appears in group's scene list (ready to test)
- [ ] Verify scene number set correctly in group (ready to test)

### Integration Tests
- [ ] Full scrape → match → select → save workflow
- [ ] Full scrape → no match → fetch details → create group workflow
- [ ] Verify group appears in scene detail page after association
- [ ] Verify scene appears in group detail page after association

## Files Modified

### Backend
1. **server/services/geviScraperService.js** (+280 lines)
   - Added `movieFromUrl()` method
   - Added `matchGroups()` method
   - Updated `scrapeScene()` to extract movies

2. **server/routes/stash.js** (+40 lines)
   - Updated `/scenes/:id/scrape-gevi` endpoint
   - Added `/gevi/movie` endpoint

### Documentation
1. **GEVI_MOVIE_INTEGRATION.md** (this file)

## Next Steps

### ✅ FULLY COMPLETE
1. ✅ Updated SceneDetail.jsx scrape results modal to display movies
2. ✅ Added group selection UI (matched with alternatives)
3. ✅ Added "Fetch Details" button to call `/api/stash/gevi/movie`
4. ✅ Added "Add New" button for unmatched movies
5. ✅ Implemented group creation flow (fetches details + creates in Stash + DB)
6. ✅ Implemented group association save logic
7. ✅ Updated scene save handler to include group associations
8. ✅ Backend endpoint to create groups in Stash and local DB
9. ✅ Scene update includes group associations
10. ✅ Stash GraphQL mutations updated to sync group associations

### Testing
1. Test backend endpoints with real GEVI URLs
2. Test matching logic with various movie names
3. Test full integration flow

### Future Enhancements
1. Add movie/group search functionality (like performer search)
2. Support bulk group association for multiple scenes
3. Add group sync from Stash (already implemented in sync services)
4. Add group editing/management UI improvements

## Related Documentation
- `GEVI_SEARCH_BY_PERFORMERS.md` - Performer-based GEVI search
- `GEVI_ACTION_CODE_TAGGING.md` - Action code extraction
- `GROUPS_FEATURE.md` - Groups/Movies database and UI implementation
- `GEVI.py` - Python reference implementation (lines 101-120, 249-289)

## Architecture Notes

### Pattern Consistency
This implementation follows the existing patterns for performer and studio matching:
- Extract data from GEVI HTML
- Match against local database
- Return matched/unmatched with confidence scores
- Provide alternatives for ambiguous matches
- Allow user to select best match or create new entry

### SQLite Compatibility
All matching logic filters results in JavaScript rather than using SQL `LIKE` operators, ensuring compatibility with the SQLite backend used in development.

### Modular Design
- Movie scraping logic isolated in dedicated method
- Matching logic separated from scraping
- Reusable across different endpoints
- Follows service layer pattern

### Error Handling
- Graceful fallbacks for missing movie data
- Console logging for debugging
- Returns null on movie fetch failure
- Validates URLs and required fields

## Conclusion
The GEVI movie integration enables automatic detection and matching of movies when scraping episodes from GEVI, following the same proven patterns used for performers and studios. This enhancement significantly reduces manual data entry and improves scene organization within the Stash media library.
