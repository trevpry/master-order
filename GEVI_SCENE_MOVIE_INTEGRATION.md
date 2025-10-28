# GEVI Scene-Movie Integration Enhancement

## Overview
When scraping a scene with the GEVI scraper, if movies are found and associated with the scene, this enhancement automatically:
1. Adds the GEVI scene URL to the movie(s) 
2. Applies the movie's studio to the scene if the scene doesn't have a studio assigned

## Implementation Details

### Location
`server/routes/stash.js` - Scene update endpoint (`PUT /api/stash/scenes/:id`)

### Key Changes (Lines ~6797-6940)

#### 1. GEVI URL Addition to Movies
When a scene is associated with groups (movies) and has a `geviUrl`:

```javascript
// If scene was scraped from GEVI, add GEVI URL to the movie
if (geviUrl) {
  const group = await prisma.stashGroup.findUnique({
    where: { id: groupId },
    select: { id: true, name: true, url: true }
  });
  
  if (group) {
    let existingUrls = [];
    
    // Parse existing URLs (handle both JSON array and single string)
    if (group.url) {
      try {
        existingUrls = JSON.parse(group.url);
        if (!Array.isArray(existingUrls)) {
          existingUrls = [group.url];
        }
      } catch (e) {
        existingUrls = [group.url];
      }
    }
    
    // Add GEVI URL if not already present
    if (!existingUrls.includes(geviUrl)) {
      existingUrls.push(geviUrl);
      
      // Update local database
      await prisma.stashGroup.update({
        where: { id: groupId },
        data: { url: JSON.stringify(existingUrls) }
      });
      
      // Also update Stash if configured
      if (stashSyncService && await stashSyncService.isConfigured()) {
        // Fetch existing URLs from Stash
        const stashGroup = await stashSyncService.graphqlClient.request(...);
        const stashUrls = stashGroup.findGroup?.urls || [];
        
        // Merge and update
        if (!stashUrls.includes(geviUrl)) {
          const mergedUrls = [...stashUrls, geviUrl];
          await stashSyncService.graphqlClient.request(MovieUpdate, ...);
        }
      }
    }
  }
}
```

**How it works:**
- When scene is saved with group associations and has a `geviUrl` field
- Fetches each group/movie from database
- Parses existing URLs (handles both JSON array format and legacy single string)
- Appends GEVI URL if not already present
- Updates both local database and Stash (if configured)
- Logs all operations for debugging

#### 2. Studio Inheritance from Movie
When a scene has no studio but is being associated with a movie that has a studio:

```javascript
// If scene was scraped from GEVI and has a geviUrl, check if scene needs studio from movies
let movieStudioToApply = null;
if (geviUrl && !resolvedStudioId) {
  console.log('🏢 Scene has no studio but has GEVI URL - checking if movies have studio...');
  
  // Check first group for studio
  if (groupIds.length > 0) {
    const firstGroup = await prisma.stashGroup.findUnique({
      where: { id: groupIds[0] },
      include: { studio: true }
    });
    
    if (firstGroup && firstGroup.studioId) {
      movieStudioToApply = firstGroup.studioId;
      console.log(`   - Found studio from movie "${firstGroup.name}": ${firstGroup.studio?.name}`);
    }
  }
}

// ... later, after processing all groups ...

// Apply movie studio to scene if scene has no studio
if (movieStudioToApply && !resolvedStudioId) {
  console.log(`🏢 Applying movie studio ${movieStudioToApply} to scene...`);
  
  // Update local database
  await prisma.stashScene.update({
    where: { id },
    data: { studioId: movieStudioToApply }
  });
  
  // Set for Stash update below
  resolvedStudioId = movieStudioToApply;
  
  console.log(`   - ✅ Scene studio updated from movie`);
}
```

**How it works:**
- Before processing group associations, checks if scene needs a studio
- Condition: Scene has `geviUrl` but no `resolvedStudioId` (no studio assigned)
- Fetches first movie/group in the list with studio relationship
- If movie has a studio, stores it as `movieStudioToApply`
- After all groups are processed, applies the studio to the scene
- Updates both local database and sets `resolvedStudioId` for subsequent Stash update
- Only uses first movie's studio (assumes all movies in a compilation share same studio)

## Use Cases

### Scenario 1: Compilation Scene with Movie URLs
```
Scene: "Hot Action Scene 1"
GEVI URL: https://gayeroticvideoindex.com/scene/12345
Movies: ["Hot Action (2024)"] (has studio: "Studio XYZ")
Studio: (none)

After Save:
- Scene gets studio "Studio XYZ" from movie
- Movie "Hot Action (2024)" gets GEVI URL added
- Both Stash and local DB updated
```

### Scenario 2: Scene Already Has Studio
```
Scene: "Hot Action Scene 1"
GEVI URL: https://gayeroticvideoindex.com/scene/12345
Movies: ["Hot Action (2024)"] (has studio: "Studio XYZ")
Studio: "Different Studio"

After Save:
- Scene keeps "Different Studio" (no override)
- Movie "Hot Action (2024)" gets GEVI URL added
```

### Scenario 3: Multiple Movies
```
Scene: "Hot Action Scene 1"
GEVI URL: https://gayeroticvideoindex.com/scene/12345
Movies: ["Hot Action (2024)", "Best Of 2024"] (both have studio: "Studio XYZ")
Studio: (none)

After Save:
- Scene gets studio "Studio XYZ" from first movie
- Both movies get GEVI URL added to their URL lists
```

## Database Schema

### StashGroup (Movie)
- `url` field: Stores JSON stringified array of URLs
- Example: `'["https://aebn.com/...", "https://gayeroticvideoindex.com/..."]'`

### StashScene
- `geviUrl` field: Stores the GEVI scene URL when scraped
- `studioId` field: Foreign key to studio (can be inherited from movie)

## Logging
All operations are logged with emoji prefixes for easy debugging:
- `🎬` - Group/movie processing
- `🏢` - Studio operations
- `✅` - Successful operations
- `⚠️` - Warnings

Example log output:
```
🎬 Processing group associations for scene...
   - Group IDs: ['abc123']
   - Scene Numbers: [1]
   - GEVI URL: https://gayeroticvideoindex.com/scene/12345
🏢 Scene has no studio but has GEVI URL - checking if movies have studio...
   - Found studio from movie "Hot Action (2024)": Studio XYZ (studio123)
   - Added scene to group abc123 at index 1
   - Added GEVI URL to movie "Hot Action (2024)": https://gayeroticvideoindex.com/scene/12345
   - Updated GEVI URL in Stash for movie abc123
🏢 Applying movie studio studio123 to scene...
   - ✅ Scene studio updated from movie
```

## Error Handling
- **URL Parsing**: Handles both JSON array and legacy single string formats
- **Missing Data**: Gracefully continues if group not found or has no URLs
- **Stash Sync Failures**: Logs warnings but doesn't fail entire operation
- **Duplicate URLs**: Checks existence before adding to prevent duplicates

## Benefits
1. **Automatic URL Enrichment**: Movies automatically get GEVI URLs when scenes are scraped
2. **Studio Consistency**: Scenes inherit studio from compilation/movie, improving metadata completeness
3. **Bidirectional Linking**: Strengthens relationship between scenes and movies
4. **GEVI Coverage**: Builds comprehensive GEVI URL collection for movies over time
5. **Non-Destructive**: Only adds URLs and studios, never removes or replaces existing data

## Compatibility
- Works with both SQLite (development) and PostgreSQL (production)
- Compatible with existing URL storage format
- Respects existing studio assignments (no overwrite)
- Integrates seamlessly with Stash GraphQL API when configured
