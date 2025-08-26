# Music Library Filtering Debug

## Issue
Library section filtering is working server-side but the artist list doesn't update in the UI until page refresh.

## Debugging Steps Applied

### 1. Added State Resets
- Reset `artistsPage` to 1 when changing filters
- Reset `artistsHasMore` to true when changing filters  
- Applied to: `filterBySection`, `searchMusic`, `loadData`

### 2. Added Debug Logging
- `filterBySection`: Log section changes and current state
- `loadArtists`: Log parameters and current section
- Artist data: Log received data and replace flag

### 3. Potential Issues to Check
- **State timing**: React state updates are async, sectionOverride should handle this
- **Race conditions**: Multiple async calls might interfere
- **Component re-rendering**: Artists list might not re-render with new data
- **State preservation**: Something might be preserving old artist list

## Debug Output to Watch For
1. **filterBySection log**: Should show section change
2. **loadArtists log**: Should show correct sectionOverride 
3. **Received data log**: Should show new artists with replace=true
4. **Network tab**: Check if correct API calls are made
5. **Artists array**: Check if state actually updates in React DevTools

## Expected Flow
1. User selects section → `filterBySection` called
2. `filterBySection` sets new section state  
3. `loadArtists(1, true, sectionId)` called with explicit section
4. API call made with correct section
5. Artists state replaced with new data
6. UI re-renders with filtered artists

## If Issue Persists
- Check React DevTools for state updates
- Verify no other useEffect is interfering
- Consider using a ref for immediate section access
- Check if artists list component is properly subscribing to state changes
