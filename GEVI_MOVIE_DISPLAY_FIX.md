# GEVI Movie Display - Quick Fix Summary

## Issue
The "Review Scraped Metadata" modal was not showing any movie/group data, even though the backend was successfully scraping and matching movies from GEVI episode pages.

## Root Cause
The frontend `SceneDetail.jsx` component was not rendering the `matched.groups` and `unmatched.groups` data that was being returned by the backend API.

## Solution
Added a new "Movies/Groups" section in the scrape review modal (SceneDetail.jsx) that displays:

### For Matched Groups
- ✅ Group name with checkmark (✓)
- ✅ Studio name in gray text (if available)
- ✅ "Matched" label with match method (name/alias)
- ✅ Alternatives dropdown (like performers)
- ✅ Alternative count indicator (+X more)
- ✅ Ability to switch to alternative matches

### For Unmatched Groups
- ✅ Group name with X mark (✗)
- ✅ "Not found" label
- ✅ "📥 Fetch Details" button
- ✅ Button calls `/api/stash/gevi/movie` endpoint
- ✅ Shows alert with movie metadata (title, studio, date, duration, director)
- ✅ Full details logged to console

## Code Changes

**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Location**: Lines ~1375 (after Performers Field, before Date Field)

**Added**: ~130 lines of JSX code for Movies/Groups display section

## Visual Example

```
┌─────────────────────────────────────────────────────────┐
│ Movies/Groups:                                          │
├─────────────────────────────────────────────────────────┤
│ ✓ The Big Movie (Studio Name)                          │
│   (Matched)                         [Switch to alt ▼]  │
├─────────────────────────────────────────────────────────┤
│ ✗ Unknown Movie Title              [📥 Fetch Details]  │
│   (Not found)                                           │
└─────────────────────────────────────────────────────────┘
```

## Testing
1. ✅ Navigate to a Stash scene
2. ✅ Click "🌐 Scrape GEVI"
3. ✅ Enter a GEVI episode URL that has movies
4. ✅ Click "🔍 Scrape"
5. ✅ Verify "Movies/Groups" section appears in review modal
6. ✅ Check matched groups display correctly
7. ✅ Check unmatched groups have "Fetch Details" button
8. ✅ Click "Fetch Details" to test movie fetching

## Next Steps

### Phase 1: Display ✅ COMPLETE
- [x] Show matched groups with alternatives
- [x] Show unmatched groups
- [x] Add "Fetch Details" functionality

### Phase 2: Association (To Be Implemented)
- [ ] Create new group from fetched movie details
- [ ] Associate scene with selected group
- [ ] Set scene index within group
- [ ] Save associations to database
- [ ] Update scene detail page to show groups
- [ ] Update group detail page to show scenes

## Related Files
- Backend: `server/services/geviScraperService.js`
- Backend: `server/routes/stash.js`
- Frontend: `client/src/modules/media/pages/stash/SceneDetail.jsx`
- Documentation: `GEVI_MOVIE_INTEGRATION.md`

## Status
✅ **Movies/Groups now display in scrape results modal**

The movie data from GEVI episodes is now visible to users during the scrape review process. Users can see which groups/movies are matched to existing entries and which ones are new. The "Fetch Details" button allows users to preview full movie metadata before deciding to create a new group.
