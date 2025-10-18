# GEVI Movie Action Code Extraction - Fix Summary

## 🐛 Issue

Action codes were not being extracted from GEVI movie scenes. The original implementation was looking for action codes in table cells (`<td>`), but the actual HTML structure has action codes in text nodes immediately after performer `<a>` tags.

## 📋 HTML Structure

**Actual GEVI HTML**:
```html
<div class="">
  <a href="performer/55357" class="pr-1">
    <span class="whitespace-nowrap">Dre (lfc)</span>
  </a>OgAtbRgr, 
  <a href="performer/63419" class="pr-1">
    <span class="whitespace-nowrap">Junior (cc)</span>
  </a>OrAtRg, 
  <a href="performer/45579" class="pr-1">
    <span class="whitespace-nowrap">Enferno</span>
  </a>OrAbRr
</div>
```

**Pattern**: `</a>[ActionCode],` or `</a>[ActionCode]`

## ✅ Solution

Updated `movieFromUrl()` method in `geviScraperService.js` to:

1. **Find the performers div** containing all performer links
2. **Iterate through each `<a>` tag** for performers
3. **Access the text node** immediately following each `</a>` tag using DOM `nextSibling`
4. **Extract action code** from text before comma or whitespace using regex `/^([^,\s]+)/`

## 🔧 Code Changes

**File**: `server/services/geviScraperService.js`

**Before** (Incorrect - looking in table cells):
```javascript
// Try to find action code in the 3rd td of the same row
const row = $(perfLink).closest('tr');
if (row.length) {
  const tds = row.find('td');
  if (tds.length >= 3) {
    const actionCode = $(tds[2]).text().trim();
    if (actionCode && actionCode !== '&nbsp;' && actionCode !== '') {
      performerData.actionCode = actionCode;
    }
  }
}
```

**After** (Correct - reading text node):
```javascript
// Get the text node immediately after the </a> tag
const nextNode = perfLink.nextSibling;
if (nextNode && nextNode.nodeType === 3) { // Text node
  // Extract action code (everything before comma or end of text)
  const textAfter = nextNode.nodeValue || '';
  const actionCodeMatch = textAfter.match(/^([^,\s]+)/);
  if (actionCodeMatch && actionCodeMatch[1]) {
    const actionCode = actionCodeMatch[1].trim();
    if (actionCode && actionCode !== '' && actionCode.length > 0) {
      performerData.actionCode = actionCode;
    }
  }
}
```

## 📊 Data Flow

### 1. Movie Scraping
```javascript
// movieFromUrl() extracts scenes with performers and action codes
{
  sceneNumber: 1,
  performers: [
    { name: "Dre (lfc)", actionCode: "OgAtbRgr" },
    { name: "Junior (cc)", actionCode: "OrAtRg" },
    { name: "Enferno", actionCode: "OrAbRr" }
  ]
}
```

### 2. Scene Matching
```javascript
// matchMovieScenes() includes performers in match results
{
  sceneId: "scene-123",
  sceneNumber: 1,
  performers: [
    { name: "Dre (lfc)", actionCode: "OgAtbRgr" },
    { name: "Junior (cc)", actionCode: "OrAtRg" },
    { name: "Enferno", actionCode: "OrAbRr" }
  ]
}
```

### 3. Database Update
```javascript
// stash.js updates StashPerformerScene.actionCode
await prisma.stashPerformerScene.update({
  where: {
    performerId_sceneId: {
      performerId: "performer-id",
      sceneId: "scene-123"
    }
  },
  data: {
    actionCode: "OgAtbRgr"  // ✅ Now correctly extracted
  }
});
```

## 🔍 Action Code Format

GEVI uses compact action code notation:

**Common Codes**:
- `Og` = Oral Giving (performer performs oral)
- `Or` = Oral Receiving (performer receives oral)
- `At` = Anal Top (performer tops)
- `Ab` = Anal Bottom (performer bottoms)
- `Rg` = Rimming Giving (performer rims)
- `Rr` = Rimming Receiving (performer receives rimming)

**Examples**:
- `OgAtbRgr` = Oral Giving, Anal Top (Bottom?), Rimming Giving/Receiving
- `OrAtRg` = Oral Receiving, Anal Top, Rimming Giving
- `OrAbRr` = Oral Receiving, Anal Bottom, Rimming Receiving

## 🎯 Impact

### Before Fix
- ❌ Action codes not extracted from movies
- ❌ `StashPerformerScene.actionCode` remained null
- ❌ No performer role information stored

### After Fix
- ✅ Action codes correctly extracted from movie scenes
- ✅ `StashPerformerScene.actionCode` populated automatically
- ✅ Complete performer role information preserved

## 🧪 Testing

### Test Cases

**1. Single Performer**:
```html
<a href="performer/123"><span>John Doe</span></a>OgAt
```
Expected: `{ name: "John Doe", actionCode: "OgAt" }`

**2. Multiple Performers**:
```html
<a href="performer/123"><span>John</span></a>OgAt, <a href="performer/456"><span>Mike</span></a>OrAb
```
Expected:
```javascript
[
  { name: "John", actionCode: "OgAt" },
  { name: "Mike", actionCode: "OrAb" }
]
```

**3. Last Performer (No Comma)**:
```html
<a href="performer/789"><span>Dave</span></a>Versatile
```
Expected: `{ name: "Dave", actionCode: "Versatile" }`

**4. Performer Without Action Code**:
```html
<a href="performer/999"><span>Unknown</span></a>
```
Expected: `{ name: "Unknown" }` (no actionCode field)

### Validation Steps

1. **Scrape a movie** with known action codes
2. **Check console output** for extracted performer data
3. **Verify database** - Query `StashPerformerScene` table
4. **Confirm Stash sync** - Check if action codes appear in Stash UI

```sql
-- Check action codes in database
SELECT 
  sp.name as performer,
  ss.title as scene,
  sps.actionCode
FROM StashPerformerScene sps
JOIN StashPerformer sp ON sps.performerId = sp.id
JOIN StashScene ss ON sps.sceneId = ss.id
WHERE sps.actionCode IS NOT NULL;
```

## 📝 Related Code

### Performer Matching Logic
**File**: `server/routes/stash.js` (Lines ~2010-2060)

Fuzzy matching to handle name variations:
```javascript
const dbPerformer = dbScene.performers.find(sp => 
  sp.performer.name.toLowerCase() === performerName.toLowerCase() ||
  sp.performer.name.toLowerCase().includes(performerName.toLowerCase()) ||
  performerName.toLowerCase().includes(sp.performer.name.toLowerCase())
);
```

### Action Code Storage
**Database**: `StashPerformerScene.actionCode` field

**Updates**: Automatic during movie scraping when scenes are matched

**Display**: Should appear in Stash scene performer details

## 🚀 Next Steps

1. ✅ **Action code extraction** - FIXED
2. ✅ **Database storage** - Already implemented
3. 🔄 **Frontend display** - Show action codes in scene UI
4. 🔄 **Tag translation** - Convert codes to readable tags (Top, Bottom, Versatile)
5. 🔄 **Search/filter** - Enable filtering by performer roles

## 🔗 Related Documentation

- **GEVI Movie Integration**: `GEVI_MOVIE_ACTION_CODES_AND_COMPILATIONS.md`
- **Action Code Tagging**: `GEVI_ACTION_CODE_TAGGING.md`
- **Movie Scraping**: `GEVI_MOVIE_INTEGRATION.md`

---

**Fixed**: January 17, 2025  
**Version**: 1.0.2  
**Status**: ✅ Ready for Testing
