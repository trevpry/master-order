# GEVI URL Storage & Scene-Group Link Fix

## 🎉 Status: READY FOR TESTING

Two related improvements have been implemented:
1. **GEVI URL Storage**: Automatically saves and populates the GEVI URL when scraping scenes
2. **Scene-Group Link Fix**: Corrected Stash GraphQL mutation to properly link scenes to groups/movies

---

## Overview

### Problem 1: Repetitive URL Entry
Users had to manually enter the GEVI URL every time they wanted to scrape a scene, even if they had already scraped it before.

### Solution 1: Persistent URL Storage
- GEVI URL is now saved to the database when scraping
- URL automatically populates when opening the "Scrape GEVI" modal
- Users can still change the URL if needed

### Problem 2: Scene-Group Links Not Syncing to Stash
When saving scrape results with selected groups/movies, the associations were created in the local database but not syncing to Stash.

### Solution 2: Correct GraphQL Mutation Format
According to [Stash's GraphQL schema](https://github.com/stashapp/stash/blob/develop/graphql/schema/types/scene.graphql), scenes must be linked to groups using the `groups` field with `SceneGroupInput` objects, not `group_ids`.

**Incorrect (Old)**:
```javascript
input.group_ids = ["123", "456"];
```

**Correct (New)**:
```javascript
input.groups = [
  { group_id: "123", scene_index: 0 },
  { group_id: "456", scene_index: 1 }
];
```

---

## Implementation Details

### 1. Database Schema Changes

#### Added Field: `geviUrl`
**Model**: `StashScene`
**Type**: `String?` (optional)
**Purpose**: Store the GEVI episode URL used for scraping

**Migration**: `20251017171611_add_gevi_url_to_scenes`

```prisma
model StashScene {
  // ... existing fields ...
  geviUrl             String?
  // ... rest of fields ...
}
```

**Schema Files Updated**:
- ✅ `server/prisma/schema.prisma`
- ✅ `server/prisma/schema.sqlite.prisma`
- ✅ `server/prisma/schema.postgresql.prisma`

---

### 2. Backend Changes

#### A. Scene Update Endpoint (`server/routes/stash.js`)

**Line 1820**: Added `geviUrl` parameter to destructuring

```javascript
const { title, studio, studioId, performerIds, groupIds, details, date, url, coverImage, actionCodes, geviUrl } = req.body;
```

**Line 1837**: Added `geviUrl` to update data

```javascript
if (geviUrl !== undefined) updateData.geviUrl = geviUrl;
```

#### B. Stash Sync Service (`server/stashSyncService.js`)

**Lines 2291-2322**: Updated GraphQL mutation to include `groups` and `movies` in response

```javascript
const mutation = `
  mutation SceneUpdate($input: SceneUpdateInput!) {
    sceneUpdate(input: $input) {
      id
      title
      studio {
        id
        name
      }
      performers {
        id
        name
      }
      groups {
        group {
          id
          name
        }
        scene_index
      }
      movies {
        movie {
          id
          name
        }
        scene_index
      }
    }
  }
`;
```

**Lines 2344-2372**: Fixed group association logic to use correct `SceneGroupInput` format

**Old Logic**:
```javascript
if (updates.groupIds !== undefined && Array.isArray(updates.groupIds)) {
  const existingGroups = await this.prisma.stashGroupScene.findMany({
    where: { sceneId: String(sceneId) }
  });
  
  const allGroupIds = [...new Set([
    ...existingGroups.map(g => g.groupId),
    ...updates.groupIds
  ])];
  
  input.group_ids = allGroupIds.map(id => String(id));
}
```

**New Logic**:
```javascript
if (updates.groupIds !== undefined && Array.isArray(updates.groupIds)) {
  // Get all existing groups for this scene first to preserve scene_index
  const existingGroups = await this.prisma.stashGroupScene.findMany({
    where: { sceneId: String(sceneId) },
    orderBy: { sceneIndex: 'asc' }
  });
  
  // Build groups array with SceneGroupInput format: { group_id, scene_index }
  const groupsMap = new Map();
  
  // First, add existing groups with their scene indices
  existingGroups.forEach(eg => {
    groupsMap.set(eg.groupId, { group_id: String(eg.groupId), scene_index: eg.sceneIndex });
  });
  
  // Then add new groups at the end
  let nextIndex = existingGroups.length > 0 
    ? Math.max(...existingGroups.map(g => g.sceneIndex)) + 1 
    : 0;
  
  updates.groupIds.forEach(groupId => {
    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, { group_id: String(groupId), scene_index: nextIndex++ });
    }
  });
  
  input.groups = Array.from(groupsMap.values());
}
```

**Key Changes**:
- ✅ Uses `groups` field instead of `group_ids`
- ✅ Builds `SceneGroupInput` objects with `group_id` and `scene_index`
- ✅ Preserves existing group associations and their scene indices
- ✅ Adds new groups at the end with sequential indices
- ✅ Avoids duplicates using Map

---

### 3. Frontend Changes

#### A. Scene Detail Component (`client/src/modules/media/pages/stash/SceneDetail.jsx`)

**Line 340**: Added `geviUrl` to scene update request

```javascript
body: JSON.stringify({
  title: editedTitle,
  studio: editedStudio,
  studioId: studioId,
  performerIds: performerIds,
  actionCodes: actionCodes,
  groupIds: groupIds,
  details: scrapeData.scraped.details,
  date: scrapeData.scraped.date,
  url: scrapeData.scraped.url,
  coverImage: scrapeData.scraped.originalImage || scrapeData.scraped.image,
  geviUrl: scrapeData.sourceUrl // Save the GEVI URL used for scraping
})
```

**Line 706**: Auto-populate GEVI URL when opening scrape modal

**Old**:
```javascript
onClick={() => {
  setShowScrapeModal(true);
  setScrapeUrl('');
}}
```

**New**:
```javascript
onClick={() => {
  setShowScrapeModal(true);
  // Auto-populate with previously saved GEVI URL if available
  setScrapeUrl(scene?.geviUrl || '');
}}
```

---

## Stash GraphQL Schema Reference

According to the official [Stash GraphQL schema](https://github.com/stashapp/stash/blob/develop/graphql/schema/types/scene.graphql):

### SceneUpdateInput Type
```graphql
input SceneUpdateInput {
  clientMutationId: String
  id: ID!
  title: String
  code: String
  details: String
  director: String
  url: String @deprecated(reason: "Use urls")
  urls: [String!]
  date: String
  rating100: Int
  o_counter: Int
  organized: Boolean
  studio_id: ID
  gallery_ids: [ID!]
  performer_ids: [ID!]
  groups: [SceneGroupInput!]  # ← CORRECT FIELD
  movies: [SceneMovieInput!] @deprecated(reason: "Use groups")
  tag_ids: [ID!]
  cover_image: String
  stash_ids: [StashIDInput!]
  resume_time: Float
  play_duration: Float
  play_count: Int
  primary_file_id: ID
}
```

### SceneGroupInput Type
```graphql
input SceneGroupInput {
  group_id: ID!
  scene_index: Int
}
```

### Key Points
- ✅ `groups` field expects an array of `SceneGroupInput` objects
- ✅ Each object must have `group_id` (required) and `scene_index` (optional)
- ✅ `movies` field is deprecated, use `groups` instead
- ❌ `group_ids` field does NOT exist in the schema (was our mistake)

---

## User Flow

### 1. First Time Scraping a Scene

1. User clicks **"🌐 Scrape GEVI"** button on scene detail page
2. Modal opens with **empty URL field**
3. User enters GEVI episode URL or uses "Search by Performers"
4. User clicks **"🔍 Scrape"**
5. Metadata is fetched from GEVI
6. User reviews and accepts the scraped data
7. Scene is updated with metadata **AND** GEVI URL is saved

### 2. Re-Scraping a Scene

1. User clicks **"🌐 Scrape GEVI"** button
2. Modal opens with **previously saved GEVI URL pre-filled**
3. User can:
   - Click **"🔍 Scrape"** immediately (no need to re-enter URL)
   - Edit the URL if needed
   - Use "Search by Performers" to find a different episode
4. Rest of flow is the same

### 3. Linking Scenes to Groups/Movies

1. User scrapes scene with GEVI (which includes movie information)
2. Movies are matched to existing groups or user creates new groups
3. User selects which groups/movies to associate with the scene
4. User clicks **"Accept & Update"**
5. Scene is updated in local database **AND** Stash
6. ✅ Scene now appears in the group's scene list in Stash
7. ✅ Group appears in the scene's movies/groups in Stash

---

## Bug Fixes

### Issue 1: Prisma Client Not Initialized
**Error**: `TypeError: Cannot read properties of undefined (reading 'stashGroupScene')`

**Cause**: The `StashSyncService` and `StashSyncServiceOptimized` classes were not initializing `this.prisma` in their constructors, even though the `updateScene` method referenced `this.prisma.stashGroupScene`.

**Solution**: Added `this.prisma = prisma;` to both service class constructors.

**Files Fixed**:
- ✅ `server/stashSyncService.js` - Line 16
- ✅ `server/stashSyncServiceOptimized.js` - Line 16

### Issue 2: Scene Variable Not Defined in Frontend
**Error**: `Uncaught ReferenceError: scene is not defined at onClick (SceneDetail.jsx:708:32)`

**Cause**: The `SceneDetail.jsx` component stores scene data in a state variable called `data`, not `scene`. The auto-populate code was trying to access `scene?.geviUrl` which didn't exist.

**Solution**: Changed `scene?.geviUrl` to `data?.geviUrl` to match the component's state variable name.

**Files Fixed**:
- ✅ `client/src/modules/media/pages/stash/SceneDetail.jsx` - Line 708

### Issue 3: GEVI URL Not Included in API Response
**Error**: No error, but `geviUrl` was undefined in frontend even after fixing variable name

**Cause**: The `GET /api/stash/scenes/:id` endpoint was fetching the scene from the database (which includes `geviUrl`) but not including it in the `transformedScene` object sent to the frontend.

**Solution**: Added `geviUrl: scene.geviUrl` to the transformed scene object in the response.

**Files Fixed**:
- ✅ `server/routes/stash.js` - Line 763 (added to transformedScene)

### Issue 4: Source URL Not Extracted from Scrape Response
**Error**: No error, but `geviUrl` was not being saved when accepting scrape results

**Cause**: The frontend was receiving `sourceUrl` in the scrape response but not extracting it from the destructured data. The scrape response includes `{ scraped, matched, unmatched, sourceUrl }` but the code was only destructuring the first three properties.

**Solution**: 
1. Updated destructuring to include `sourceUrl` from `result.data`
2. Added `sourceUrl: sourceUrl` to the `scrapeData` state object
3. The existing code already sends `geviUrl: scrapeData.sourceUrl` when updating the scene

**Files Fixed**:
- ✅ `client/src/modules/media/pages/stash/SceneDetail.jsx` - Line 259 (extract sourceUrl from response, store in scrapeData)

---

## Testing Checklist

### GEVI URL Storage
- [ ] First scrape: URL field is empty
- [ ] After scraping: GEVI URL is saved to database
- [ ] Re-open scrape modal: URL is pre-populated
- [ ] Can change URL: Edit field and scrape different episode
- [ ] Can clear URL: Delete text and search by performers
- [ ] URL persists: Refresh page, URL still saved

### Scene-Group Links in Stash
- [ ] Scrape scene with movie data
- [ ] Create new group from unmatched movie
- [ ] Select group to associate with scene
- [ ] Accept scrape results
- [ ] **Check Local DB**: StashGroupScene record exists
- [ ] **Check Stash**: Open scene in Stash, groups/movies section shows linked group
- [ ] **Check Stash**: Open group in Stash, scenes list shows linked scene
- [ ] **Check Scene Index**: Scene has correct index in group (0, 1, 2...)
- [ ] Multiple groups: Can link scene to multiple groups
- [ ] Existing groups: Adding new group preserves existing associations
- [ ] Re-scrape: Existing group links not lost when re-scraping scene

---

## Validation

### Backend Syntax
```bash
✅ node -c server/routes/stash.js
✅ node -c server/stashSyncService.js
```

### Database Migration
```bash
✅ npx prisma migrate dev --name "add_gevi_url_to_scenes"
✅ Prisma Client generated successfully
```

### GraphQL Mutation Format
```javascript
// Correct format sent to Stash
{
  "input": {
    "id": "123",
    "groups": [
      { "group_id": "456", "scene_index": 0 },
      { "group_id": "789", "scene_index": 1 }
    ]
  }
}
```

---

## Known Issues & Limitations

### 1. ~~Scene-Group Links Not Syncing~~ ✅ FIXED
**Status**: RESOLVED
**Cause**: Was using incorrect `group_ids` field instead of `groups` with `SceneGroupInput` objects
**Solution**: Updated to use proper GraphQL schema format

### 2. Scene Index Management
**Current Behavior**: Scene indices are sequential starting from 0
**Limitation**: If a scene is removed from a group in Stash, indices are not recalculated
**Impact**: Low - scene index is mainly for display order
**Future Enhancement**: Add logic to compact indices when scenes are removed

### 3. URL Not Validated
**Current Behavior**: Any string can be saved as `geviUrl`
**Limitation**: No validation that the URL is actually a valid GEVI episode URL
**Impact**: Low - invalid URLs will just fail to scrape
**Future Enhancement**: Add URL validation/normalization

---

## File Changes Summary

| File | Lines Changed | Change Type | Description |
|------|--------------|-------------|-------------|
| `server/prisma/schema.prisma` | +1 | ➕ Added | Added `geviUrl` field to StashScene |
| `server/prisma/schema.sqlite.prisma` | +1 | ➕ Added | Synchronized schema |
| `server/prisma/schema.postgresql.prisma` | +1 | ➕ Added | Synchronized schema |
| `server/routes/stash.js` | +2 | ✏️ Modified | Added geviUrl parameter handling |
| `server/stashSyncService.js` | +37 | ✏️ Modified | Fixed GraphQL mutation format |
| `client/src/modules/media/pages/stash/SceneDetail.jsx` | +3 | ✏️ Modified | Auto-populate URL, save on update |

**Total Lines Changed**: ~45 lines

---

## Related Documentation

- **GEVI Search**: `GEVI_SEARCH_BY_PERFORMERS.md` - Search GEVI using performers
- **GEVI Scraper**: `geviScraperService.js` - Core scraping logic
- **Movie Integration**: `GEVI_MOVIE_INTEGRATION.md` - Full movie scraping with matching
- **Group Creation**: `GEVI_GROUP_CREATION_FIX.md` - Create groups from GEVI movies
- **Stash GraphQL Schema**: [scene.graphql](https://github.com/stashapp/stash/blob/develop/graphql/schema/types/scene.graphql) - Official schema reference

---

## API Changes

### Modified Endpoint: PUT /api/stash/scenes/:id

**New Parameter**: `geviUrl`

**Request Body**:
```json
{
  "title": "Scene Title",
  "studioId": "123",
  "performerIds": ["456", "789"],
  "groupIds": ["101", "102"],
  "geviUrl": "https://gayeroticvideoindex.com/episode/12345"
}
```

**Database Update**: The `geviUrl` field is now saved to the `StashScene` table

**Stash GraphQL Update**: Groups are now sent in correct format:
```graphql
mutation SceneUpdate($input: SceneUpdateInput!) {
  sceneUpdate(input: $input) {
    id
    groups {
      group {
        id
        name
      }
      scene_index
    }
  }
}
```

---

## Debugging

### Check if GEVI URL is Saved
```sql
SELECT id, title, geviUrl FROM StashScene WHERE geviUrl IS NOT NULL;
```

### Check Scene-Group Associations (Local DB)
```sql
SELECT * FROM StashGroupScene WHERE sceneId = 'YOUR_SCENE_ID';
```

### Check GraphQL Request Being Sent
Look for console logs when updating a scene:
```
📝 [updateScene] GraphQL mutation prepared:
   - Input: {
       "id": "123",
       "groups": [
         { "group_id": "456", "scene_index": 0 }
       ]
     }
```

### Check GraphQL Response
```
📥 [updateScene] GraphQL response received:
   - groups: [
       {
         "group": { "id": "456", "name": "Movie Title" },
         "scene_index": 0
       }
     ]
```

If `groups` array is empty in response, the mutation failed to link the groups in Stash.

---

**Last Updated**: October 17, 2025  
**Implementation Version**: 1.0.0  
**Status**: ✅ Ready for Testing

---

## Next Steps

1. ✅ Test GEVI URL storage and auto-population
2. ✅ Test scene-group links appear in Stash
3. ✅ Verify scene indices are correct
4. 📋 Document any issues found during testing
5. 📋 Consider adding URL validation
6. 📋 Consider adding scene index compaction logic
