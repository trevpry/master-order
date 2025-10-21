# Tag Scraping and Management in Scrape Modal

## Overview
Added comprehensive tag support to the scrape results modal, allowing users to see scraped tags, match them against the database, and create new tags directly from the modal.

## Features Implemented

### 1. Backend Tag Matching ✅
**File**: `server/services/geviScraperService.js`

Added `matchTags()` function that:
- Matches scraped tag names against database tags (case-insensitive)
- Checks both tag names and aliases
- Returns matched tags (with database IDs) and unmatched tags
- Similar pattern to `matchPerformers()` and `matchStudio()`

**Lines 1234-1289**:
```javascript
async matchTags(scrapedTags, prisma) {
  const matched = [];
  const unmatched = [];

  if (!scrapedTags || scrapedTags.length === 0) {
    return { matched, unmatched };
  }

  // Get all tags once for efficiency
  const allTags = await prisma.stashTag.findMany();

  for (const tag of scrapedTags) {
    const tagName = typeof tag === 'string' ? tag : tag.name;
    if (!tagName) continue;

    const normalizedName = tagName.toLowerCase().trim();
    let foundTag = null;
    
    // Look for exact match or alias match
    for (const dbTag of allTags) {
      const dbNormalized = dbTag.name.toLowerCase().trim();
      
      // Exact match on name
      if (dbNormalized === normalizedName) {
        foundTag = dbTag;
        break;
      }
      
      // Check aliases if present
      if (dbTag.aliases) {
        const aliases = dbTag.aliases.split(',').map(a => a.trim().toLowerCase());
        if (aliases.includes(normalizedName)) {
          foundTag = dbTag;
          break;
        }
      }
    }

    if (foundTag) {
      matched.push({
        id: foundTag.id,
        name: foundTag.name,
        originalName: tagName
      });
    } else {
      unmatched.push(typeof tag === 'object' ? tag : tagName);
    }
  }

  return { matched, unmatched };
}
```

### 2. Generic Scraper Tag Integration ✅
**File**: `server/routes/stash.js` - POST `/api/stash/scenes/:id/scrape-generic`

**Lines 4512-4522** - Added tag matching:
```javascript
// Match performers, studio, tags, and movies/groups against database
let matchedTags = { matched: [], unmatched: [] };

if (metadata.tags && metadata.tags.length > 0) {
  matchedTags = await geviScraper.matchTags(metadata.tags, prisma);
}

console.log(`   - Matched tags: ${matchedTags.matched.length}`);
console.log(`   - Unmatched tags:`, matchedTags.unmatched);
```

**Lines 4547-4560** - Return tags in response:
```javascript
sendSuccess(res, {
  scraped: metadata,
  matched: {
    studio: matchedStudio,
    performers: matchedPerformers.matched,
    tags: matchedTags.matched,
    groups: matchedGroups.matched
  },
  unmatched: {
    studio: matchedStudio ? null : metadata.studio,
    performers: matchedPerformers.unmatched,
    tags: matchedTags.unmatched,
    groups: matchedGroups.unmatched
  },
  source: scraper.siteName,
  sourceUrl: url
});
```

### 3. Tag Creation Endpoint ✅
**File**: `server/routes/stash.js` - POST `/api/stash/tags/create`

**Lines 1389-1482** - New endpoint to create tags:
```javascript
router.post('/tags/create', asyncHandler(async (req, res) => {
  const { name, aliases } = req.body;

  // Validate required fields
  validateRequiredFieldsDirect(req.body, ['name']);

  // Initialize sync service
  const syncService = getActiveSyncService();
  
  // Create tag in Stash via GraphQL
  const createMutation = `
    mutation TagCreate($input: TagCreateInput!) {
      tagCreate(input: $input) {
        id
        name
        aliases
      }
    }
  `;

  const variables = {
    input: {
      name: name,
      aliases: aliases || []
    }
  };

  const data = await syncService.makeGraphQLRequest(createMutation, variables);
  const stashTag = data.tagCreate;

  // Create in local database
  const localTag = await prisma.stashTag.create({
    data: {
      id: stashTag.id,
      name: stashTag.name,
      aliases: stashTag.aliases?.join(', ') || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSyncedAt: new Date()
    }
  });

  sendSuccess(res, {
    tag: localTag,
    message: `Tag "${name}" created successfully`
  });
}));
```

### 4. Scene Update with Tags ✅
**File**: `server/routes/stash.js` - PUT `/api/stash/scenes/:id`

**Line 4707** - Extract tagIds from request:
```javascript
const { id } = req.params;
const { title, studio, studioId, performerIds, tagIds, groupIds, ... } = req.body;
```

**Lines 4781-4803** - Handle tag relationships:
```javascript
// Handle tag relationships if provided
if (tagIds !== undefined && Array.isArray(tagIds)) {
  console.log('🏷️  Processing tag associations for scene...');
  
  // Add new tag relationships (upsert to avoid duplicates)
  for (const tagId of tagIds) {
    await prisma.stashSceneTag.upsert({
      where: {
        sceneId_tagId: {
          sceneId: id,
          tagId: tagId
        }
      },
      create: {
        sceneId: id,
        tagId: tagId
      },
      update: {} // No update needed, just ensure it exists
    });
  }
  console.log(`   - Added ${tagIds.length} tag(s) to scene`);
}
```

### 5. Frontend Tag State Management ✅
**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Line 37** - Added creatingTags state:
```javascript
const [creatingTags, setCreatingTags] = useState(new Set());
```

**Lines 822-887** - Added handleCreateTag function:
```javascript
const handleCreateTag = async (tagName) => {
  if (!tagName || !tagName.trim()) {
    alert('Tag name cannot be empty');
    return;
  }

  setCreatingTags(prev => new Set(prev).add(tagName));

  try {
    console.log('🏷️ Creating tag:', tagName);
    
    // Create the tag
    const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/tags/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: tagName,
        aliases: []
      })
    });

    const createResult = await createResponse.json();

    if (createResult.success) {
      const newTag = createResult.data.tag;

      // Update scrapeData to move tag from unmatched to matched
      setScrapeData(prev => ({
        ...prev,
        matched: {
          ...prev.matched,
          tags: [
            ...prev.matched.tags,
            {
              id: newTag.id,
              name: newTag.name,
              originalName: tagName
            }
          ]
        },
        unmatched: {
          ...prev.unmatched,
          tags: prev.unmatched.tags.filter(t => {
            const tName = typeof t === 'string' ? t : t.name;
            return tName !== tagName;
          })
        }
      }));

      alert(`✅ Tag "${tagName}" created successfully!`);
    }
  } catch (error) {
    console.error('Error creating tag:', error);
    alert(`Failed to create tag: ${error.message}`);
  } finally {
    setCreatingTags(prev => {
      const newSet = new Set(prev);
      newSet.delete(tagName);
      return newSet;
    });
  }
};
```

### 6. Accept Scrape with Tags ✅
**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Lines 617-619** - Collect matched tag IDs:
```javascript
// Collect matched tag IDs
const tagIds = scrapeData.matched.tags?.map(t => t.id) || [];
```

**Line 633** - Include in scene update:
```javascript
body: JSON.stringify({
  title: editedTitle,
  studio: editedStudio,
  studioId: studioId,
  performerIds: performerIds,
  actionCodes: actionCodes,
  tagIds: tagIds,  // ← Added
  groupIds: groupIds,
  // ... other fields
})
```

### 7. Tags Display in Modal ✅
**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Lines 2620-2698** - Added tags section in scrape review modal:

```javascript
{/* Tags Field */}
{(scrapeData.matched.tags?.length > 0 || scrapeData.unmatched.tags?.length > 0) && (
  <div className="parse-field">
    <label>Tags ({(scrapeData.matched.tags?.length || 0) + (scrapeData.unmatched.tags?.length || 0)}):</label>
    <div className="performers-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {/* Tags already on the scene */}
      {data?.tags?.map((tag, index) => (
        <div key={`existing-${index}`} style={{
          padding: '4px 10px',
          background: '#e5e7eb',
          color: '#374151',
          borderRadius: '12px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>📌</span>
          <span>{tag.name}</span>
          <span style={{ fontSize: '11px', color: '#6b7280' }}>(on scene)</span>
        </div>
      ))}
      
      {/* Matched tags from scrape */}
      {scrapeData.matched.tags?.map((tag, index) => (
        <div key={`matched-${index}`} style={{
          padding: '4px 10px',
          background: '#d1fae5',
          color: '#065f46',
          borderRadius: '12px',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <span>✓</span>
          <span>{tag.name}</span>
        </div>
      ))}
      
      {/* Unmatched tags - can be created */}
      {scrapeData.unmatched.tags?.map((tag, index) => {
        const tagName = typeof tag === 'string' ? tag : tag.name;
        const isCreating = creatingTags.has(tagName);
        
        return (
          <div key={`unmatched-${index}`} style={{
            padding: '4px 10px',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: '12px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: '1px dashed #f59e0b'
          }}>
            <span>✗</span>
            <span>{tagName}</span>
            <button
              onClick={() => handleCreateTag(tagName)}
              disabled={isCreating}
              style={{
                padding: '2px 8px',
                fontSize: '11px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isCreating ? 'not-allowed' : 'pointer',
                opacity: isCreating ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '2px'
              }}
            >
              {isCreating ? '⏳' : '➕'}
            </button>
          </div>
        );
      })}
    </div>
    <div style={{ 
      marginTop: '8px', 
      padding: '8px 12px', 
      background: '#f3f4f6', 
      borderRadius: '4px',
      fontSize: '12px',
      color: '#6b7280'
    }}>
      ℹ️ Tags with ✓ are in your database. Tags with ✗ are not - click ➕ to add them. Tags with 📌 are already on this scene.
    </div>
  </div>
)}
```

## UI/UX Design

### Tag Display States

1. **📌 Existing Tags** (Gray badges):
   - Tags already on the scene
   - Read-only display
   - Shows "(on scene)" label

2. **✓ Matched Tags** (Green badges):
   - Tags found in database
   - Will be added to scene when "Accept Changes" is clicked
   - No action needed

3. **✗ Unmatched Tags** (Yellow badges with dashed border):
   - Tags not found in database
   - Has ➕ button to create them
   - After creation, moves to "Matched" state
   - Shows ⏳ spinner while creating

### User Flow

1. **Scrape Scene** → Tags are extracted and matched
2. **Review Tags** → See which tags exist and which don't
3. **Create Missing Tags** → Click ➕ on unmatched tags
4. **Accept Changes** → All matched tags (including newly created) are added to scene

## Example Usage

### Scraping a GayNetwork Scene:

**Scraped Tags**: `["Anal", "Bareback", "Outdoor", "NewTag123"]`

**Modal Display**:
- 📌 "Outdoor" (on scene) - Gray badge
- ✓ "Anal" - Green badge (matched in DB)
- ✓ "Bareback" - Green badge (matched in DB)
- ✗ "NewTag123" ➕ - Yellow badge (not in DB, has create button)

**User Action**: Clicks ➕ next to "NewTag123"
- Button shows ⏳
- Tag created in Stash and local DB
- Moves to matched section: ✓ "NewTag123" - Green badge

**Accept Changes**: All 4 tags added to scene (Outdoor already there, 3 new ones added)

## Benefits

✅ **Complete tag workflow** - From scraping to database integration
✅ **Visual feedback** - Clear distinction between existing, matched, and unmatched tags
✅ **One-click creation** - No need to manually navigate to tag management
✅ **Automatic matching** - Handles both names and aliases
✅ **Safe operations** - Upsert prevents duplicate tag associations
✅ **Consistent UX** - Same pattern as performers and groups

## Testing

1. **Scrape a GayNetwork scene** with tags
2. **Check console logs**:
   - Should show "Matched tags: X"
   - Should show "Unmatched tags: [...]"
3. **Verify modal display**:
   - Tags should appear in correct sections
   - Badges should have appropriate colors
4. **Create unmatched tag**:
   - Click ➕ button
   - Should show success alert
   - Tag should move to matched section
5. **Accept changes**:
   - Tags should be added to scene
   - Verify in Stash tags list
