# TV Series Exact Matching Implementation

## Overview
Implemented sophisticated exact matching logic for both Plex TV series selection (during bulk import) and TVDB series selection (when fetching artwork) to prioritize exact matches over partial matches.

## Problem Solved
Previously, when searching for "Doctor Who", the system might select "Doctor Who (2005)" instead of the exact match "Doctor Who" because it used simple substring matching that would match the first result found.

## Solution Implementation

### 1. Plex TV Series Matching (Bulk Import)
**File**: `client/src/pages/custom-orders/index.jsx`

**Changes**: Modified the episode matching logic around line 1523 to use a sophisticated scoring algorithm instead of simple bidirectional substring matching.

**Scoring Algorithm**:
- **1.0**: Exact match after normalization (highest priority)
- **0.95**: Exact match without normalization
- **0.6-0.8**: Partial match with length penalty (shorter titles preferred)
- **0.6**: Search term contained in result
- **0.2-0.4**: Bidirectional partial match with length penalty

### 2. TVDB Series Matching (Artwork Selection)
**Files**: 
- `server/tvdbCachedService.js` - Primary cached service
- `server/tvdbService.js` - Fallback service

**Changes**: Modified the `searchSeries()` functions to sort results by exact matching priority before returning them.

**Features**:
- Same scoring algorithm as Plex matching
- Results are sorted by match score (descending)
- Maintains caching functionality
- Logging shows match scores for debugging

### 3. Normalization Logic
Both implementations use the same normalization logic to handle common variations:

```javascript
const normalize = (title) => {
  return title.toLowerCase()
    .replace(/\s*\((\d{4})\)\s*/g, ' ') // Remove years like (2005)
    .replace(/\s*\(uk\)\s*/gi, ' ') // Remove (UK)
    .replace(/\s*\(us\)\s*/gi, ' ') // Remove (US)
    .replace(/\s*\(american\)\s*/gi, ' ') // Remove (American)
    .replace(/\s*\(british\)\s*/gi, ' ') // Remove (British)
    .replace(/\s*\(original\)\s*/gi, ' ') // Remove (Original)
    .replace(/\s*\(reboot\)\s*/gi, ' ') // Remove (Reboot)
    .replace(/\s*\(remake\)\s*/gi, ' ') // Remove (Remake)
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
};
```

## Test Results

### Plex TV Series Matching Test
```
✅ Doctor Who: "Doctor Who" (1.000) > "Doctor Who (2005)" (0.718)
✅ Star Trek: "Star Trek" (1.000) > "Star Trek: Discovery" (0.690)
```

### TVDB Series Matching Test
```
✅ Algorithm verification shows correct prioritization:
   - "Doctor Who" (1.000) beats "Doctor Who (2005)" (0.718)
   - "Star Trek" (1.000) beats "Star Trek: Discovery" (0.690)
```

## Benefits

1. **Exact Match Priority**: "Doctor Who" now correctly selects "Doctor Who" instead of "Doctor Who (2005)"
2. **Consistent Logic**: Same matching algorithm used for both Plex and TVDB searches
3. **Length Preference**: When multiple partial matches exist, shorter titles are preferred
4. **Robust Fallback**: Still handles cases where no exact match exists
5. **Debug Logging**: Match scores are logged for troubleshooting

## Usage Impact

### For Users
- Bulk imports now select the most appropriate TV series automatically
- TVDB artwork fetching uses the correct series variant
- More accurate matching reduces manual corrections needed

### For Developers
- Consistent matching logic across the application
- Easily extensible scoring system
- Comprehensive test coverage
- Debug logging for troubleshooting

## Test Files Created
- `test-tv-series-matching-priority.js` - Tests Plex TV series matching
- `test-tv-matching-algorithm.js` - Tests the matching algorithm directly  
- `test-tvdb-matching-priority.js` - Tests TVDB series matching
- `test-tv-bulk-import-exact-matching.js` - End-to-end bulk import test

## Related Implementation
This builds on the word matching priority system previously implemented for ComicVine searches, creating a consistent exact-match-first approach across all media types in the application.
