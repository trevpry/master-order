# GEVI Scene Search - Enhanced Metadata Display

## Overview

Enhanced the GEVI scene search results to display additional metadata for each matched scene, including:
- Studio name
- Performers (costars)
- Release date
- Direct link to view on GEVI

This gives users more information to identify the correct scene before selecting it.

## Changes Implemented

### 1. Backend Enhancement

**File**: `server/services/geviScraperService.js` (searchScenesWithPerformers function)

**Data Extraction**: Updated to extract additional columns from the GEVI episodes table:

```javascript
// Get the date (4th td, index 3)
const dateCell = $row.find('td').eq(3);
const date = dateCell.text().trim();

// Get the studio (5th td, index 4)
const studioCell = $row.find('td').eq(4);
const studio = studioCell.text().trim();

// Get the costars cell (7th td, index 6)
const costarsCell = $row.find('td').eq(6);
const costarsText = costarsCell.text().trim();
```

**Response Format**: Each scene now includes:

```javascript
{
  title: "Hot Summer Day",
  url: "https://gayeroticvideoindex.com/episode/12345",
  image: "https://gayeroticvideoindex.com/Images/Episodes/12345.jpg",
  date: "2024-07-15",           // NEW
  studio: "Next Door Studios",   // NEW
  performers: "Alex Tanner, Brad Banks"  // NEW
}
```

### 2. Frontend Enhancement

**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Display Format**: Each search result now shows rich metadata:

```jsx
<div style={{ flex: 1 }}>
  <div>{scene.title}</div>           {/* Title */}
  {scene.studio && (
    <div>🎬 {scene.studio}</div>     {/* Studio */}
  )}
  {scene.performers && (
    <div>👥 {scene.performers}</div> {/* Performers */}
  )}
  {scene.date && (
    <div>📅 {scene.date}</div>       {/* Date */}
  )}
  <div>Click to select this scene</div>
</div>
<a href={scene.url}>🔗 View on GEVI</a>
```

## UI Layout

### Search Result Card (Updated)

```
┌──────────────────────────────────────────────────────────┐
│ [Thumbnail]  📽️ Hot Summer Day           [🔗 View on GEVI]│
│              🎬 Next Door Studios                          │
│              👥 Alex Tanner, Brad Banks                    │
│              📅 2024-07-15                                 │
│              Click to select this scene                    │
└──────────────────────────────────────────────────────────┘
```

### Visual Hierarchy

1. **Title** (Bold, dark text) - Most prominent
2. **Studio** (Purple text with 🎬 icon) - Secondary info
3. **Performers** (Gray text with 👥 icon) - Important for matching
4. **Date** (Light gray with 📅 icon) - Tertiary info
5. **Helper text** (Italic gray) - Instructions
6. **GEVI Link** (Purple button) - Action button on right

### Icons Used

- 🎬 Studio
- 👥 Performers
- 📅 Date
- 🔗 View on GEVI link

## Benefits

### 1. Better Scene Identification

**Before**: Only title was shown, making it hard to identify the correct scene
```
Hot Summer Day
Click to select this scene
```

**After**: Full context helps users identify the right scene
```
📽️ Hot Summer Day
🎬 Next Door Studios
👥 Alex Tanner, Brad Banks
📅 2024-07-15
Click to select this scene
```

### 2. Verify Performer Matches

Users can now see ALL performers in the scene, not just the two they searched for. This helps verify they found the right scene.

**Example**:
- **Searched for**: Alex Tanner + Brad Banks
- **Result shows**: "Alex Tanner, Brad Banks, Chris Reed"
- **User realizes**: This is a threesome scene, can decide if it's the right one

### 3. Studio Context

Knowing the studio helps when:
- Multiple studios have scenes with similar titles
- User wants to verify it's from the expected series/collection
- Building a library organized by studio

### 4. Date Context

Release date helps when:
- Multiple scenes with same performers exist
- User is looking for a specific time period
- Organizing chronologically

### 5. Preview Before Selection

The "View on GEVI" link allows users to:
- Open the GEVI page in a new tab
- View full scene details, description, screenshots
- Confirm it's the correct scene before selecting
- Compare multiple results side-by-side

## Example Use Cases

### Use Case 1: Multiple Similar Scenes

**Scenario**: Two performers have done multiple scenes together

**Search Results**:
```
1. Summer Fun
   🎬 Next Door Studios
   👥 Alex Tanner, Brad Banks
   📅 2024-06-10
   
2. Hot Summer Day  
   🎬 Next Door Studios
   👥 Alex Tanner, Brad Banks
   📅 2024-07-15
   
3. Beach Encounter
   🎬 Cocky Boys
   👥 Alex Tanner, Brad Banks, Mike Wilson
   📅 2024-08-20
```

**User can easily**:
- See these are 3 different scenes
- Identify studios and dates
- Notice the third is a threesome
- Click "View on GEVI" to preview each one

### Use Case 2: Performer Name Variations

**Scenario**: Performer uses different names/aliases

**Search Result**:
```
College Jocks
🎬 Active Duty
👥 Alex (Alex Tanner), Brad B. (Brad Banks)
📅 2024-05-01
```

**User can verify**:
- Aliases shown in parentheses match their search
- Studio confirms it's the expected scene
- Date helps place it in timeline

### Use Case 3: Studio Disambiguation

**Scenario**: Multiple studios have similar titles

**Search Results**:
```
1. First Time
   🎬 Next Door Studios
   👥 Alex Tanner, Brad Banks
   
2. First Time
   🎬 Broke Straight Boys
   👥 Alex Tanner, Brad Banks
```

**User can distinguish**: Same title, different studios

## Technical Details

### GEVI Episodes Table Structure

The GEVI performer pages contain a DataTable with the following columns:

| Index | Column | Content | Extracted |
|-------|--------|---------|-----------|
| 0 | Checkbox | Selection checkbox | ❌ No |
| 1 | Thumbnail | Episode image | ✅ Yes (`image`) |
| 2 | Title | Episode title + link | ✅ Yes (`title`, `url`) |
| 3 | Date | Release date | ✅ Yes (`date`) |
| 4 | Studio | Studio name | ✅ Yes (`studio`) |
| 5 | Director | Director name | ❌ No |
| 6 | Costars | Other performers | ✅ Yes (`performers`) |

### Data Formatting

**Studio**: Plain text, as shown on GEVI
```
"Next Door Studios"
```

**Performers**: Comma-separated list
```
"Alex Tanner, Brad Banks"
"Javi Xisco & Ollie with David Ace"  // GEVI uses various separators
```

**Date**: ISO-like date format from GEVI
```
"2024-07-15"
"07/15/2024"  // Format may vary
```

### Null Handling

Frontend conditionally renders each field:
```jsx
{scene.studio && <div>🎬 {scene.studio}</div>}
{scene.performers && <div>👥 {scene.performers}</div>}
{scene.date && <div>📅 {scene.date}</div>}
```

If any field is missing/null, it simply won't display (graceful degradation).

## Testing

### Test Cases

1. **All Fields Present**
   - Search returns scenes with studio, performers, date
   - ✅ All fields display correctly

2. **Missing Studio**
   - Some scenes might not have studio listed
   - ✅ Studio line doesn't display, layout still works

3. **Missing Date**
   - Older scenes might not have dates
   - ✅ Date line doesn't display, layout still works

4. **Long Performer Lists**
   - Scenes with 3+ performers
   - ✅ Text wraps properly, doesn't break layout

5. **Special Characters**
   - Performers with accents, apostrophes
   - ✅ Characters display correctly (UTF-8 handling)

6. **Click Behavior**
   - Click title/studio/performers area → Selects scene
   - Click "View on GEVI" button → Opens new tab
   - ✅ Both interactions work without conflict

## Styling Details

### Colors
- Title: `#333` (Dark gray)
- Studio: `#8b5cf6` (Purple - brand color)
- Performers: `#666` (Medium gray)
- Date: `#999` (Light gray)
- Helper text: `#666` italic

### Spacing
- Title: `marginBottom: '4px'`
- Studio: `marginBottom: '2px'`
- Performers: `marginBottom: '2px'`
- Date: `marginBottom: '4px'`

### Font Sizes
- Title: Default (inherited)
- Studio: `12px`
- Performers: `12px`
- Date: `11px`
- Helper text: `12px`

### Hover States
- Entire content area (except button) turns purple on hover
- "View on GEVI" button darkens on hover
- Smooth transitions for better UX

## Related Files

- **Backend Service**: `server/services/geviScraperService.js`
  - Function: `searchScenesWithPerformers()` (lines ~1255-1370)
  - Data extraction and formatting
  
- **Backend Route**: `server/routes/stash.js`
  - Endpoint: `POST /api/stash/scenes/:id/search-gevi`
  - Already proxies images, no changes needed for this enhancement
  
- **Frontend Component**: `client/src/modules/media/pages/stash/SceneDetail.jsx`
  - Search results display (lines ~1245-1290)
  - Rich metadata rendering

## Future Enhancements

### 1. Filterable Results
- Add filters for studio, date range
- Hide/show scenes by studio
- Sort by date, title, studio

### 2. Highlighted Matches
- Bold the searched performer names in results
- Highlight matching keywords in titles

### 3. Thumbnail Preview
- Show full-size image on hover
- Lazy-load thumbnails as user scrolls

### 4. Additional Metadata
- Extract director information
- Show scene duration if available
- Display scene rating/tags if on GEVI

### 5. Smart Ranking
- Rank exact matches higher
- Prefer recent scenes
- Boost popular studios

---

**Status**: ✅ Implemented and Ready  
**Date**: January 14, 2025  
**Version**: 1.1.0  
**Files Modified**: 
- `server/services/geviScraperService.js`
- `client/src/modules/media/pages/stash/SceneDetail.jsx`
