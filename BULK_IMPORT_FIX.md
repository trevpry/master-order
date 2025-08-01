## Bulk Import Fix for Movies/Episodes Not in Plex

### Problem
The bulk import was failing with "not found in Plex" errors for movies and TV episodes that don't exist in Plex yet.

### Root Cause
The client-side bulk import logic was:
1. Searching for movies/episodes in Plex first
2. Only calling the API if found in Plex
3. Failing if not found in Plex

### Solution
Modified the client-side bulk import logic to:
1. Search for movies/episodes in Plex first (for existing items)
2. If found in Plex: Use the existing logic
3. If NOT found in Plex: Create a minimal media object and call the API anyway
4. Let the server-side logic (which we already updated) handle adding items that don't exist in Plex yet

### Server-Side Changes Already Made
- Modified validation to allow movies/episodes without plexKey
- Added plexKey generation for items not in Plex
- Added isFromTvdbOnly flag for tracking
- Enhanced duplicate checking for items without plexKey

### Client-Side Changes Made
- Modified bulk import logic in `client/src/pages/custom-orders/index.jsx`
- Added fallback for movies/episodes not found in Plex
- Creates minimal media objects with required fields:
  - For movies: title, mediaType, year (if available)
  - For episodes: title, mediaType, seriesTitle, seasonNumber, episodeNumber

### Test Case
Before: "The Fantastic Four: First Steps" would fail with "not found in Plex"
After: Should successfully add to custom order with isFromTvdbOnly=true

### Next Steps
1. Test the bulk import with the movie that was failing
2. Verify it gets added to the custom order successfully
3. Confirm it shows up with appropriate metadata in the custom order
