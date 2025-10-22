# Scene & Clip Tags Implementation

**Date**: January 2025  
**Status**: ✅ COMPLETED

## Overview
Enhanced the scene detail page to display tags from all clips, and modified clip tagging behavior to also save tags to the scene-performer relationship for consistency across the application.

## Requirements Implemented

### 1. Display Clip Tags on Scene Detail Page ✅
**Requirement**: Show all tags from a scene's clips on the scene detail page, in addition to scene-level tags.

**Rationale**: Clips may have specific tags that provide additional context not captured at the scene level.

**Implementation**:
- **File**: `server/routes/stash.js`
- **Endpoint**: `GET /api/stash/scenes/:id`
- **Changes**:
  1. Added clips to scene query with nested tags (lines 710-743)
  2. Implemented `clipTags` aggregation in response transformation (lines 854-873)

**Code Details**:
```javascript
// Query enhancement - load clips with their tags
clips: {
  include: {
    tags: {
      include: {
        tag: true
      }
    }
  }
}

// Response transformation - aggregate unique clip tags
clipTags: (() => {
  const tagMap = new Map();
  scene.clips?.forEach(clip => {
    clip.tags?.forEach(ct => {
      if (!tagMap.has(ct.tag.id)) {
        tagMap.set(ct.tag.id, {
          id: ct.tag.id,
          name: ct.tag.name,
          description: ct.tag.description,
          image: ct.tag.image
        });
      }
    });
  });
  return Array.from(tagMap.values());
})()
```

**Result**: Scene API response now includes:
- `tags`: Scene-level tags (existing)
- `clipTags`: Unique tags aggregated from all clips (NEW)

### 2. Save Clip Tagging to Scene-Performer Pivot ✅
**Requirement**: When tagging a performer via the clip overlay, save the tag to the scene-performer relationship in addition to the clip-performer relationship.

**Rationale**: Tags applied in the clip context should also affect the scene-level performer relationship for consistency and better discoverability.

**Implementation**:
- **File**: `server/routes/android/stashClipPerformerTags.js`
- **Endpoint**: `POST /api/android/stash/clip/:clipId/performer/:performerId/tags`
- **Changes**:
  1. Enhanced clip query to include scene relationship
  2. Added validation to ensure clip has an associated scene
  3. Created scene-performer-tag associations alongside clip-performer-tag associations

**Code Details**:
```javascript
// Get clip with scene
const clip = await prisma.stashClip.findUnique({
  where: { id: clipId },
  include: {
    scene: true
  }
});

// Validate scene exists
if (!clip.scene) {
  return res.status(400).json({ error: 'Clip has no associated scene' });
}

const sceneId = clip.scene.id;

// Create BOTH clip-performer-tag AND scene-performer-tag associations
await prisma.stashClipPerformerTag.createMany({
  data: clipPerformerTagsData,
  skipDuplicates: true
});

await prisma.stashScenePerformerTag.createMany({
  data: scenePerformerTagsData,
  skipDuplicates: true
});
```

**Relationships Created**:
When tagging a performer in a clip, the system now creates:
1. ✅ **StashClipPerformerTag** - Clip + Performer + Tag (existing)
2. ✅ **StashScenePerformerTag** - Scene + Performer + Tag (NEW!)
3. ✅ **StashClipTag** - Clip + Tag (existing)
4. ✅ **StashPerformerTag** - Performer + Tag (existing)

## Database Schema

### Relevant Models
```prisma
model StashClip {
  id       Int         @id @default(autoincrement())
  sceneId  String
  scene    StashScene  @relation(fields: [sceneId], references: [id])
  tags     StashClipTag[]
  // ... other fields
}

model StashClipPerformerTag {
  id          Int              @id @default(autoincrement())
  clipId      Int
  performerId String
  tagId       Int
  clip        StashClip        @relation(fields: [clipId], references: [id])
  performer   StashPerformer   @relation(fields: [performerId], references: [id])
  tag         StashTag         @relation(fields: [tagId], references: [id])
  
  @@unique([clipId, performerId, tagId])
}

model StashScenePerformerTag {
  id          Int              @id @default(autoincrement())
  sceneId     String
  performerId String
  tagId       Int
  scene       StashScene       @relation(fields: [sceneId], references: [id])
  performer   StashPerformer   @relation(fields: [performerId], references: [id])
  tag         StashTag         @relation(fields: [tagId], references: [id])
  
  @@unique([sceneId, performerId, tagId])
}
```

## API Changes

### GET /api/stash/scenes/:id
**Enhanced Response**:
```json
{
  "id": "26416",
  "title": "Scene Title",
  "tags": [
    { "id": 1, "name": "Scene Tag 1", "description": "...", "image": "..." }
  ],
  "clipTags": [
    { "id": 2, "name": "Clip Tag 1", "description": "...", "image": "..." },
    { "id": 3, "name": "Clip Tag 2", "description": "...", "image": "..." }
  ],
  // ... other fields
}
```

**Key Points**:
- `clipTags` is deduplicated - each unique tag appears once
- Tags are aggregated from ALL clips in the scene
- Empty array if scene has no clips or clips have no tags

### POST /api/android/stash/clip/:clipId/performer/:performerId/tags
**Enhanced Behavior**:
```javascript
// Request
{
  "tagIds": [1, 2, 3]
}

// Response
{
  "success": true,
  "message": "Tags added to clip-performer and scene-performer combinations",
  "clipId": 6163,
  "sceneId": "26416",
  "performerId": "abc123",
  "tagIds": [1, 2, 3]
}
```

**Key Points**:
- Now returns `sceneId` in response
- Creates dual pivot relationships automatically
- Uses `skipDuplicates: true` to avoid conflicts
- Maintains backward compatibility with existing clip-performer tagging

## Frontend Integration

### Clip Overlay Tagging Flow
**Files**:
- `client/src/components/overlays/StashPerformerOverlay.jsx`
- `client/src/components/overlays/StashPerformerTagSelector.jsx`

**Behavior**:
1. User opens performer overlay while viewing a clip
2. User selects tags for the performer in that clip context
3. Frontend calls: `POST /api/android/stash/clip/:clipId/performer/:performerId/tags`
4. Backend creates BOTH clip-performer-tag AND scene-performer-tag relationships
5. Tags now appear:
   - On the clip-performer relationship ✅
   - On the scene-performer relationship ✅
   - In the scene's `clipTags` array ✅

**No Frontend Changes Required**: The existing UI continues to work seamlessly with the enhanced backend behavior.

## Testing

### Scene Clip Tags Display
**Test Case**: Verify clipTags aggregation
```bash
# Get a scene with clips that have tags
curl http://localhost:3001/api/stash/scenes/26416 | jq '.clipTags'

# Expected: Array of unique tag objects from all clips
```

### Dual Pivot Tag Creation
**Test Case**: Verify scene-performer tag creation
```bash
# Tag a performer in a clip
curl -X POST http://localhost:3001/api/android/stash/clip/6163/performer/abc123/tags \
  -H "Content-Type: application/json" \
  -d '{"tagIds": [1, 2]}'

# Verify clip-performer tags exist
curl http://localhost:3001/api/android/stash/clip/6163/performer/abc123/tags

# Verify scene-performer tags were also created (need to add GET endpoint or query directly)
```

## Benefits

### 1. Enhanced Tag Visibility
- Scene detail pages show comprehensive tag information from all clips
- Users can see all relevant tags without navigating to individual clips
- Better content discovery and filtering

### 2. Consistent Tagging Behavior
- Tags applied in clip context automatically apply to scene-level performer relationship
- Eliminates need to tag performers separately at scene and clip levels
- Maintains data consistency across different views

### 3. Improved Search & Filtering
- Scene-performer tags enable better search results
- Filtering by performer tags works at both scene and clip levels
- More accurate content recommendations

### 4. Backward Compatibility
- Existing clip-performer tagging still works
- No breaking changes to frontend components
- Additive enhancement - doesn't remove any existing functionality

## Future Enhancements

### Potential Improvements
1. **Tag Removal**: Implement DELETE endpoint that removes from both pivots
2. **Tag Synchronization**: Option to sync existing clip-performer tags to scene-performer pivot
3. **Tag Conflict Resolution**: UI to handle tags that exist at different relationship levels
4. **Bulk Operations**: Batch tag application across multiple clips/performers

### Monitoring Points
- Watch for duplicate tag relationships (shouldn't happen with `skipDuplicates`)
- Monitor query performance with large numbers of clips/tags
- Track user behavior - do they find dual tagging intuitive?

## Related Documentation
- [Clip Tagging Flow](Clip%20Tagging%20Flow%20-%20NEW.md)
- [Android API Endpoints](ANDROID_API_ENDPOINTS.md)
- [Stash Integration](ANDROID_COMPANION_API.md)

## Summary
✅ Scene detail pages now display comprehensive tag information from all clips  
✅ Clip overlay tagging automatically creates scene-performer tag relationships  
✅ No breaking changes - fully backward compatible  
✅ Enhanced tag visibility and data consistency across the application  

**Implementation Complete**: Both requirements fully implemented and syntax validated.
