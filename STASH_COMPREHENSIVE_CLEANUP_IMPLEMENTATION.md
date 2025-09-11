# Stash Comprehensive Cleanup Implementation

## Overview
Implemented comprehensive cleanup functionality for Stash sync that removes any items from the local database which no longer exist in Stash. This ensures data integrity and prevents database bloat from deleted Stash entities.

## What Was Implemented

### 1. Comprehensive Cleanup Methods
Added to both `StashSyncService` and `StashSyncServiceOptimized`:

- **Entity ID Fetching**: `getAllStashEntityIds()` - Fetches all current entity IDs from Stash for comparison
- **Main Cleanup Controller**: `cleanupOrphanedEntities()` / `cleanupOrphanedEntitiesOptimized()` - Orchestrates the entire cleanup process
- **Specific Entity Cleanup**: Individual cleanup methods for each entity type

### 2. Supported Entity Types
The cleanup covers **16+ Stash entity models**:

#### Main Entities
- `StashScene` - Primary content entities
- `StashGallery` - Image collections
- `StashMovie` - Movie entities (if supported)

#### Reference Entities  
- `StashPerformer` - Actors/performers
- `StashStudio` - Production studios
- `StashTag` - Content tags

#### Dependent Entities
- `StashImage` - Individual images
- `StashScenefile` - Scene file metadata
- `StashSceneMarker` - Scene markers/chapters

#### Junction Tables
- `StashScenePerformer` - Scene-performer relationships
- `StashSceneTag` - Scene-tag relationships
- `StashGalleryTag` - Gallery-tag relationships
- `StashGalleryPerformer` - Gallery-performer relationships
- `StashImageTag` - Image-tag relationships
- `StashImagePerformer` - Image-performer relationships
- `StashMovieTag` - Movie-tag relationships
- `StashMoviePerformer` - Movie-performer relationships

### 3. Cleanup Process Flow

#### Phase 1: Junction Tables
- Cleans up orphaned relationship records first
- Prevents referential integrity issues

#### Phase 2: Dependent Entities
- Removes scene files, markers, and images that reference deleted entities
- Handles foreign key dependencies properly

#### Phase 3: Main Entities
- Removes scenes, galleries, and movies that no longer exist in Stash
- Core content cleanup

#### Phase 4: Reference Entities
- Removes performers, studios, and tags that no longer exist in Stash
- Only cleaned if no dependent records remain

### 4. Optimizations

#### Standard Service Features
- Batch processing for large datasets
- Progress logging and error handling
- Dependency-aware cleanup order

#### Optimized Service Enhancements
- **Batch Configuration**: Uses optimized batch sizes from `batchConfig`
- **Memory Efficiency**: Processes deletions in configurable chunks
- **Performance Optimization**: Leverages existing optimization patterns
- **Database-Friendly**: Minimizes lock time with smaller transaction batches

### 5. API Endpoints

#### New Stash Routes Added:

```javascript
// Comprehensive cleanup
POST /api/stash/cleanup/orphaned-entities
// Performs actual cleanup of orphaned entities

// Test cleanup (dry run)  
POST /api/stash/cleanup/test
// Shows what would be cleaned without actually removing anything
```

#### Response Format:
```json
{
  "success": true,
  "data": {
    "message": "Comprehensive cleanup completed using optimized service",
    "totalEntitiesRemoved": 156,
    "details": {
      "scenes": 45,
      "performers": 12,
      "studios": 8,
      "tags": 23,
      "galleries": 15,
      "images": 38,
      "movies": 3,
      "sceneFiles": 7,
      "sceneMarkers": 2,
      "junctionTables": 3
    },
    "serviceType": "optimized"
  }
}
```

### 6. Integration with Sync Process

#### Automatic Cleanup During Full Sync
- **Standard Service**: Calls `cleanupOrphanedEntities(true)` after entity sync
- **Optimized Service**: Calls `cleanupOrphanedEntitiesOptimized(true)` after entity sync

#### Configuration
- Cleanup can be disabled by passing `false` to the cleanup methods
- Automatically detects which sync service is active (`optimized` vs `legacy`)

## How It Works

### 1. ID Comparison Process
```javascript
// For each entity type:
1. Fetch all current IDs from Stash via GraphQL
2. Fetch all local IDs from database
3. Compare to find orphaned entities (exist locally but not in Stash)
4. Remove orphaned entities in dependency-safe order
```

### 2. GraphQL Queries Used
The cleanup uses lightweight ID-only queries:
- `findScenes` - Gets scene IDs
- `findPerformers` - Gets performer IDs  
- `findStudios` - Gets studio IDs
- `findTags` - Gets tag IDs
- `findGalleries` - Gets gallery IDs
- `findImages` - Gets image IDs
- `findMovies` - Gets movie IDs (if supported)

### 3. Dependency Management
Entities are cleaned in specific order to maintain referential integrity:
1. **Junction tables** first (prevent constraint violations)
2. **Dependent entities** (files, markers, images)
3. **Main entities** (scenes, galleries, movies)
4. **Reference entities** last (performers, studios, tags)

## Usage Examples

### Manual Cleanup via API
```bash
# Test what would be cleaned (dry run)
curl -X POST http://localhost:5001/api/stash/cleanup/test

# Actually perform cleanup
curl -X POST http://localhost:5001/api/stash/cleanup/orphaned-entities
```

### Automatic Cleanup During Sync
```javascript
// Cleanup happens automatically after full sync
const result = await stashSyncService.fullSync();
// OR
const result = await stashSyncServiceOptimized.fullSyncOptimized();
```

### Programmatic Usage
```javascript
const stashSyncService = new StashSyncService();

// Test cleanup (no actual deletion)
const testResults = await stashSyncService.cleanupOrphanedEntities(false);

// Perform actual cleanup
const cleanupResults = await stashSyncService.cleanupOrphanedEntities(true);
```

## Benefits

### 1. Data Integrity
- Removes orphaned entities that would otherwise remain in database
- Prevents accumulation of stale data over time
- Maintains clean referential relationships

### 2. Database Efficiency
- Reduces database size by removing unused records
- Improves query performance by eliminating dead data
- Keeps indexes and statistics accurate

### 3. User Experience
- Prevents confusion from outdated/deleted content appearing in lists
- Ensures search results only show current Stash content
- Maintains accurate statistics and counts

### 4. Maintenance Automation
- Automatic cleanup during regular sync operations
- Manual trigger available for on-demand cleanup
- Dry-run testing to preview changes before execution

## Performance Considerations

### Standard Service
- Processes entities individually for maximum compatibility
- Provides detailed logging for troubleshooting
- Suitable for smaller datasets or high-reliability needs

### Optimized Service  
- Uses batch processing for better performance
- Configurable batch sizes prevent database lock issues
- Optimized for larger datasets and frequent sync operations
- Leverages existing Phase 1 & Phase 2 optimization patterns

## Error Handling

### Graceful Degradation
- Individual entity type failures don't prevent other cleanups
- Detailed error logging for troubleshooting
- Rollback-safe operations (each delete is atomic)

### Fallback Behavior
- If movies not supported, skips movie cleanup gracefully
- Missing GraphQL endpoints are handled without crashing
- Service initialization failures are logged and reported

## Future Enhancements

### Potential Improvements
1. **Configurable cleanup intervals** - Run cleanup every N syncs instead of every sync
2. **Selective cleanup** - Allow cleanup of specific entity types only
3. **Cleanup scheduling** - Background cleanup separate from sync operations
4. **Archive before delete** - Option to archive entities before permanent deletion
5. **Cleanup metrics** - Track cleanup statistics over time

### Integration Opportunities
1. **Admin dashboard** - UI for managing cleanup settings and viewing results
2. **Notification system** - Alerts when large numbers of entities are cleaned
3. **Backup integration** - Automatic backup before major cleanup operations

## Conclusion

The comprehensive cleanup implementation ensures that the local Stash database remains synchronized with the actual Stash instance, removing any entities that have been deleted from Stash. This maintains data integrity, improves performance, and provides a better user experience by ensuring all displayed content is current and accessible.

The implementation supports both standard and optimized sync services, providing flexibility for different deployment scenarios and performance requirements.
