# Stash Virtual Scenes - Feature Proposal

## Overview
A system to split Stash groups/movies into "virtual scenes" - lightweight scene references that link to specific time ranges within a parent group file, enabling individual tagging, viewing, and management without file duplication.

## Use Cases

### Primary Use Case: Scene Compilation Management
- **Problem**: Adult content often comes as compilations (30+ minutes) with multiple distinct scenes
- **Current Limitation**: Can only tag/rate/organize the entire file as one unit
- **Solution**: Create virtual scenes representing each segment with independent metadata

### Example Scenarios
1. **Compilation Video**: 45-minute file with 6 different performers/scenes
   - Virtual Scene 1: 0:00-7:30 (Performer A)
   - Virtual Scene 2: 7:30-15:00 (Performer B)
   - Virtual Scene 3: 15:00-23:30 (Performer C)
   - etc.

2. **Movie with Multiple Scenes**: Full-length feature with distinct acts
   - Virtual Scene 1: Opening scene (0:00-12:00)
   - Virtual Scene 2: Main scene (12:00-35:00)
   - Virtual Scene 3: Finale (35:00-52:00)

3. **Series Grouping**: Episode collection that needs fine-grained access
   - Virtual Scene per episode within a season pack file

## Architecture

### Database Schema

```prisma
model StashVirtualScene {
  id           String   @id @default(uuid())
  
  // Link to parent group/movie
  parentGroupId String?
  parentGroup   StashGroup? @relation(fields: [parentGroupId], references: [id], onDelete: Cascade)
  
  // Scene metadata
  title        String
  details      String?
  date         DateTime?
  
  // Time range within parent file (in seconds)
  startTime    Float    // Seconds from start of parent (e.g., 450 for 7:30)
  endTime      Float    // Seconds from start of parent (e.g., 900 for 15:00)
  duration     Int?     // Calculated duration in seconds (endTime - startTime)
  
  // Scene ordering
  sceneIndex   Int      // Position within parent (1, 2, 3, etc.)
  
  // Standard Stash scene fields
  rating       Int?
  organized    Boolean  @default(false)
  url          String?
  
  // Relationships
  performers   StashVirtualScenePerformer[]
  tags         StashVirtualSceneTag[]
  clips        StashClip[] // Clips created from this virtual scene
  studio       StashStudio? @relation(fields: [studioId], references: [id])
  studioId     String?
  
  // Playback tracking
  playCount    Int      @default(0)
  lastPlayedAt DateTime?
  resumeTime   Float?   // Resume position within THIS virtual scene (relative, 0 to duration)
  
  // Metadata
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  
  @@index([parentGroupId])
  @@index([sceneIndex])
}

// Extension to existing StashClip model
model StashClip {
  // ... existing fields ...
  
  // Virtual scene support
  virtualSceneId          String?
  virtualScene            StashVirtualScene? @relation(fields: [virtualSceneId], references: [id], onDelete: Cascade)
  virtualSceneStartTime   Float? // Start time relative to virtual scene (e.g., 2:00 within virtual scene)
  virtualSceneEndTime     Float? // End time relative to virtual scene (e.g., 4:00 within virtual scene)
  
  // Note: startTime/endTime fields remain absolute to parent scene for playback
  // virtualSceneStartTime/EndTime are for display in virtual scene context
  
  @@index([virtualSceneId])
}

model StashVirtualScenePerformer {
  id           String   @id @default(uuid())
  sceneId      String
  scene        StashVirtualScene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  performerId  String
  performer    StashPerformer @relation(fields: [performerId], references: [id], onDelete: Cascade)
  
  // Scene-specific metadata
  notes        String?
  tags         StashVirtualScenePerformerTag[]
  
  @@unique([sceneId, performerId])
  @@index([sceneId])
  @@index([performerId])
}

model StashVirtualSceneTag {
  id      String   @id @default(uuid())
  sceneId String
  scene   StashVirtualScene @relation(fields: [sceneId], references: [id], onDelete: Cascade)
  tagId   String
  tag     StashTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  
  @@unique([sceneId, tagId])
  @@index([sceneId])
  @@index([tagId])
}

model StashVirtualScenePerformerTag {
  id                      String   @id @default(uuid())
  virtualScenePerformerId String
  virtualScenePerformer   StashVirtualScenePerformer @relation(fields: [virtualScenePerformerId], references: [id], onDelete: Cascade)
  tagId                   String
  tag                     StashTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  
  @@unique([virtualScenePerformerId, tagId])
  @@index([virtualScenePerformerId])
  @@index([tagId])
}
```

## User Workflows

### 1. Creating Virtual Scenes

#### Workflow A: Bulk Time Entry (Primary Method)
1. User browses to a Stash Group detail page
2. Clicks "Split into Virtual Scenes" button
3. Opens Virtual Scene Bulk Entry modal
4. User enters all scene information in a table/form:
   ```
   Scene 1: Start [00:00:00] End [00:07:30] Title: [Scene 1 Title]
   Scene 2: Start [00:07:30] End [00:15:00] Title: [Scene 2 Title]
   Scene 3: Start [00:15:00] End [00:23:30] Title: [Scene 3 Title]
   Scene 4: Start [00:23:30] End [00:32:00] Title: [Scene 4 Title]
   [+ Add Row]
   ```
5. System validates:
   - No overlapping time ranges
   - End time > start time for each scene
   - Times within parent group duration
6. Preview button shows each scene segment
7. "Create All Scenes" generates all virtual scenes at once
8. Success: Redirects to virtual scenes list for the group

**Key Features:**
- Copy/paste support (can paste from spreadsheet/notes)
- Auto-increment start times (Scene N end = Scene N+1 start)
- Time format support: HH:MM:SS, MM:SS, or seconds
- Bulk validation before creation
- Undo/redo support during entry

#### Workflow B: Timeline Visual Editor
1. From group detail page, click "Visual Split Editor"
2. Opens timeline editor with video player
3. Video player shows the full group with timeline
4. User adds split points:
   - Click "Add Scene" button
   - Drag timeline markers to set start/end times
   - Enter scene title inline
   - Click timestamp to jump video to that point
   - Preview scene segment
5. Repeat for each scene segment
6. Save all virtual scenes

**Key Features:**
- Drag markers on timeline for visual feedback
- Click markers to fine-tune with keyboard (arrow keys)
- Keyboard shortcuts (S = set start, E = set end, Space = play/pause)
- Visual representation of all scenes at once
- Color-coded segments

#### Workflow C: Quick Split
1. From group detail page, click "Quick Split"
2. Enter number of equal segments (e.g., "6 scenes")
3. System auto-divides the duration
4. Generates default titles (Scene 1, Scene 2, etc.)
5. User can adjust times/titles before saving
6. Save to create all virtual scenes

#### Workflow D: Import from Markers/Chapters
1. If group file has embedded chapters/markers
2. "Import from Chapters" button
3. System creates virtual scenes from chapter data
4. User reviews and confirms
5. Save to create all virtual scenes

### 2. Managing Virtual Scenes

#### Browse Virtual Scenes
- New tab in Stash module: "Virtual Scenes"
- Grid/list view showing virtual scene cards
- Each card displays:
  - Scene thumbnail (screenshot at startTime)
  - Title and duration
  - Parent group reference
  - Performers, tags, rating
  - Play button overlay

#### Edit Virtual Scene
- Click virtual scene card → detail modal
- Edit metadata:
  - Title, details, date
  - Start/end times (with live preview)
  - Add/remove performers
  - Add/remove tags
  - Set studio
  - Rate the scene
- Save changes

#### Delete Virtual Scene
- Delete button removes virtual scene
- Parent group remains intact
- Confirmation prompt

### 3. Playing Virtual Scenes

#### Direct Playback
1. User clicks play on virtual scene card
2. System constructs playback URL:
   ```
   {stashUrl}/scene/{parentGroupId}/stream?start={startTime}&end={endTime}
   ```
3. Video player opens at startTime
4. Player stops at endTime (or loops back to start)
5. Resume position saved within virtual scene context

#### Clip Playback Integration
**Critical**: Clip system must be aware of virtual scenes to ensure proper time calculations.

When creating/playing clips from a virtual scene:
1. **Clip Creation from Virtual Scene**:
   - User opens virtual scene (e.g., 7:30-15:00 of parent)
   - Creates clip at 2:00-4:00 within virtual scene
   - System stores clip with:
     - `parentSceneId`: Parent group ID
     - `virtualSceneId`: Virtual scene ID
     - `startTime`: 9:30 (virtual scene start 7:30 + clip start 2:00)
     - `endTime`: 11:30 (virtual scene start 7:30 + clip end 4:00)
     - `virtualSceneStartTime`: 2:00 (relative to virtual scene)
     - `virtualSceneEndTime`: 4:00 (relative to virtual scene)

2. **Clip Display in Virtual Scene Context**:
   - When viewing clips for a virtual scene
   - Display times relative to virtual scene (2:00-4:00)
   - Not absolute parent times (9:30-11:30)
   - Maintains intuitive UX within virtual scene scope

3. **Clip Playback**:
   - Calculate absolute time from parent group
   - Stream from correct position
   - UI shows virtual scene relative time

4. **Clip Tagging**:
   - Tags apply to clip within virtual scene context
   - Virtual scene tags propagate to clips (optional setting)
   - Clip performer tags independent of virtual scene performers

#### Playlist Integration
- Virtual scenes appear in playlists
- Can mix regular scenes and virtual scenes
- Playback seamlessly transitions between types
- Clips from virtual scenes also supported

#### Android App Integration
- Virtual scenes exposed via Android API
- App handles time-based playback
- Shows "Virtual Scene from [Group Name]" indicator
- Clip playback respects virtual scene boundaries

### 4. Organizing Virtual Scenes

#### Tagging
- Add tags specific to this scene segment
- Tags apply ONLY to virtual scene, not parent
- Can tag with action tags, location tags, etc.

#### Performer Assignment
- Assign performers to each virtual scene
- Each performer can have scene-specific metadata
- Scene-performer relationships independent of parent

#### Studio Assignment
- Assign different studios to virtual scenes if needed
- Useful for compilation videos from multiple studios

#### Collections/Playlists
- Add virtual scenes to custom orders
- Include in "Up Next" rotation
- Filter/search across virtual scenes

## Technical Implementation

### Backend API Endpoints

```javascript
// Virtual Scene CRUD
POST   /api/stash/groups/:groupId/virtual-scenes          - Create virtual scene(s) (bulk create support)
GET    /api/stash/groups/:groupId/virtual-scenes          - List group's virtual scenes
GET    /api/stash/virtual-scenes                          - Browse all virtual scenes
GET    /api/stash/virtual-scenes/:id                      - Get virtual scene details
PUT    /api/stash/virtual-scenes/:id                      - Update virtual scene
DELETE /api/stash/virtual-scenes/:id                      - Delete virtual scene
POST   /api/stash/groups/:groupId/virtual-scenes/validate - Validate time ranges before creation

// Batch operations
POST   /api/stash/groups/:groupId/virtual-scenes/bulk     - Bulk create from time array
POST   /api/stash/groups/:groupId/virtual-scenes/quick-split - Auto-split into N scenes
POST   /api/stash/groups/:groupId/virtual-scenes/from-chapters - Import from file chapters

// Playback
GET    /api/stash/virtual-scenes/:id/play                 - Get playback info
POST   /api/stash/virtual-scenes/:id/view                 - Track view/playback
PUT    /api/stash/virtual-scenes/:id/resume               - Update resume position

// Metadata
POST   /api/stash/virtual-scenes/:id/performers           - Add performer
DELETE /api/stash/virtual-scenes/:id/performers/:performerId - Remove performer
POST   /api/stash/virtual-scenes/:id/tags                 - Add tag
DELETE /api/stash/virtual-scenes/:id/tags/:tagId          - Remove tag

// Clip Integration
GET    /api/stash/virtual-scenes/:id/clips                - Get clips for virtual scene
POST   /api/stash/virtual-scenes/:id/clips                - Create clip within virtual scene
GET    /api/stash/clips/:id/context                       - Get clip context (scene or virtual scene)
PUT    /api/stash/clips/:id                               - Update clip (virtual scene aware)
```

#### Bulk Create Endpoint Example
```javascript
POST /api/stash/groups/:groupId/virtual-scenes/bulk
Body: {
  scenes: [
    { title: "Scene 1", startTime: 0, endTime: 450 },       // 0:00 - 7:30
    { title: "Scene 2", startTime: 450, endTime: 900 },     // 7:30 - 15:00
    { title: "Scene 3", startTime: 900, endTime: 1410 },    // 15:00 - 23:30
    { title: "Scene 4", startTime: 1410, endTime: 1920 }    // 23:30 - 32:00
  ]
}

Response: {
  success: true,
  created: 4,
  virtualScenes: [ /* array of created virtual scenes */ ]
}
```

### Video Playback Strategy

#### Option 1: Time-Range Streaming (Preferred)
- Use Stash's existing stream endpoint with query params
- Stash supports start/end time in stream URLs
- Example: `/scene/{id}/stream?start=120&end=450`
- Browser/app handles time-bounded playback

#### Option 2: Client-Side Time Control
- Stream full parent scene
- Client-side player enforces start/end times
- Set `currentTime` on load
- Monitor `timeupdate` event to stop at endTime

#### Option 3: HLS Segment Extraction
- For advanced use: generate HLS playlist with specific segments
- More complex but allows true segment isolation

### Frontend Components

```
client/src/modules/media/pages/stash/
├── VirtualScenes.jsx              - Main browse page
├── VirtualSceneDetail.jsx         - Detail modal/page
├── VirtualSceneBulkEntry.jsx      - Bulk time entry form (PRIMARY)
├── VirtualSceneEditor.jsx         - Timeline-based visual editor
├── components/
│   ├── VirtualSceneCard.jsx       - Grid/list item
│   ├── VirtualSceneTimeEntry.jsx  - Time input component with validation
│   ├── VirtualSceneTimeline.jsx   - Timeline editor with markers
│   ├── VirtualScenePlayer.jsx     - Playback component (virtual scene aware)
│   ├── QuickSplitModal.jsx        - Quick split wizard
│   └── VirtualSceneClipList.jsx   - Clips within virtual scene context
```

### Database Queries

```javascript
// Get all virtual scenes for a group
const virtualScenes = await prisma.stashVirtualScene.findMany({
  where: { parentGroupId: groupId },
  include: {
    performers: { include: { performer: true } },
    tags: { include: { tag: true } },
    studio: true
  },
  orderBy: { sceneIndex: 'asc' }
});

// Get virtual scene with full metadata
const virtualScene = await prisma.stashVirtualScene.findUnique({
  where: { id: sceneId },
  include: {
    parentGroup: {
      include: {
        performers: { include: { performer: true } },
        tags: { include: { tag: true } }
      }
    },
    performers: {
      include: {
        performer: true,
        tags: { include: { tag: true } }
      }
    },
    tags: { include: { tag: true } },
    studio: true
  }
});

// Browse virtual scenes with filters
const virtualScenes = await prisma.stashVirtualScene.findMany({
  where: {
    AND: [
      performerFilter ? {
        performers: {
          some: { performerId: performerId }
        }
      } : {},
      tagFilter ? {
        tags: {
          some: { tagId: tagId }
        }
      } : {},
      ratingFilter ? {
        rating: { gte: minRating }
      } : {}
    ]
  },
  include: {
    parentGroup: { select: { title: true } },
    performers: { include: { performer: true } },
    tags: { include: { tag: true } },
    studio: true
  },
  orderBy: orderBy,
  skip: skip,
  take: take
});
```

## UI/UX Design

### Virtual Scene Card
```
┌─────────────────────────────────────┐
│ [Thumbnail with play button overlay]│
│                                     │
│ Scene Title                    ⭐4.5│
│ From: Parent Group Name             │
│ 👤 Performer A, Performer B         │
│ 🏷️ Tag1, Tag2, Tag3                 │
│ ⏱️ 7:30 (2:15 - 9:45 of parent)    │
│                                     │
│ [Play] [Edit] [Add to Playlist]    │
└─────────────────────────────────────┘
```

### Bulk Time Entry Form (Primary Method)
```
┌──────────────────────────────────────────────────┐
│ Split Group into Virtual Scenes      [Close ❌] │
│ Group: "Hot Compilation Vol 5" (45:00 duration) │
├──────────────────────────────────────────────────┤
│ Enter all scene times below:                     │
│                                                  │
│ Scene 1:                                         │
│ ├ Title: [Performer A Solo]                    │
│ ├ Start: [00:00:00] End: [00:07:30] ✓ Valid   │
│ └ Duration: 7:30 auto-calculated                │
│                                                  │
│ Scene 2:                                         │
│ ├ Title: [Performer B & C Scene]               │
│ ├ Start: [00:07:30] End: [00:15:00] ✓ Valid   │
│ └ Duration: 7:30 auto-calculated                │
│                                                  │
│ Scene 3:                                         │
│ ├ Title: [Group Scene]                         │
│ ├ Start: [00:15:00] End: [00:23:30] ✓ Valid   │
│ └ Duration: 8:30 auto-calculated                │
│                                                  │
│ [+ Add Scene]                                    │
│                                                  │
│ ℹ️ Tips:                                         │
│ • Use format HH:MM:SS or MM:SS                  │
│ • Copy/paste from spreadsheet supported         │
│ • End time of scene N auto-fills start of N+1  │
│ • [Preview All] to verify segments              │
│                                                  │
│ [Preview All] [Switch to Visual Editor]         │
│              [Cancel] [Create All Scenes]       │
└──────────────────────────────────────────────────┘
```

### Timeline Visual Editor
```
┌──────────────────────────────────────────────────┐
│ Video Player                                     │
│ [Parent Group Playing - 00:12:34 / 45:00]      │
│                                                  │
└──────────────────────────────────────────────────┘
│ Timeline:                                        │
│ ├──Scene 1──┤──Scene 2──┤──Scene 3──┤         │
│ 0:00    7:30     15:00    23:30        45:00   │
│   │        │        │        │            │     │
│   [Add Scene] [Adjust] [Delete] [Preview]      │
│                                                  │
│ Current Scene: Scene 2                           │
│ ├ Title: [Performer B Solo Scene]              │
│ ├ Start: [00:07:30] End: [00:15:00]            │
│ ├ Duration: 7:30                                │
│ └ [Set Current Time as Start/End]               │
│                                                  │
│ [Switch to Bulk Entry] [Cancel] [Save All]     │
└──────────────────────────────────────────────────┘
```

### Virtual Scene Detail Modal
```
┌──────────────────────────────────────────────────┐
│ Scene Title                           [Close ❌] │
│ From: Parent Group Name                          │
├──────────────────────────────────────────────────┤
│                                                  │
│ [Video Preview - 7:30 duration]                 │
│                                                  │
├──────────────────────────────────────────────────┤
│ Time Range: 2:15 - 9:45 (of 45:00 parent)      │
│                                                  │
│ Details: [Description text]                     │
│                                                  │
│ Performers: [Performer A] [Performer B] [+Add]  │
│                                                  │
│ Tags: [Tag1] [Tag2] [Tag3] [+Add]              │
│                                                  │
│ Studio: [Studio Name ▼]                         │
│                                                  │
│ Rating: ⭐⭐⭐⭐⭐ (4.5)                          │
│                                                  │
│ [Play Scene] [Edit Times] [Delete] [Save]       │
└──────────────────────────────────────────────────┘
```

## Clip System Integration

### Clip Creation from Virtual Scenes

When a user creates a clip while viewing a virtual scene, the system must:

1. **Calculate Absolute Times**:
   ```javascript
   // User creates clip at 2:00-4:00 within virtual scene
   // Virtual scene is at 7:30-15:00 in parent
   
   const absoluteStartTime = virtualScene.startTime + clipRelativeStart;
   // 450 (7:30) + 120 (2:00) = 570 (9:30)
   
   const absoluteEndTime = virtualScene.startTime + clipRelativeEnd;
   // 450 (7:30) + 240 (4:00) = 690 (11:30)
   ```

2. **Store Both Relative and Absolute Times**:
   ```javascript
   {
     clipId: "uuid",
     sceneId: "parent-group-id",
     virtualSceneId: "virtual-scene-id",
     startTime: 570,              // Absolute: 9:30 in parent
     endTime: 690,                // Absolute: 11:30 in parent
     virtualSceneStartTime: 120,  // Relative: 2:00 in virtual scene
     virtualSceneEndTime: 240,    // Relative: 4:00 in virtual scene
     title: "Clip from Virtual Scene"
   }
   ```

3. **Display Context-Aware Times**:
   - **In virtual scene view**: Show "2:00 - 4:00" (relative times)
   - **In parent group view**: Show "9:30 - 11:30" (absolute times)
   - **In clip detail**: Show both with labels

### Clip Playback from Virtual Scenes

```javascript
// When playing a clip from a virtual scene
function playClipFromVirtualScene(clip) {
  // Use absolute times for Stash API
  const playbackUrl = `${stashUrl}/scene/${clip.sceneId}/stream?start=${clip.startTime}&end=${clip.endTime}`;
  
  // But show relative times in UI
  const displayStart = formatTime(clip.virtualSceneStartTime); // "2:00"
  const displayEnd = formatTime(clip.virtualSceneEndTime);     // "4:00"
  
  return {
    url: playbackUrl,
    displayTimeRange: `${displayStart} - ${displayEnd}`,
    context: `From: ${virtualScene.title}`
  };
}
```

### Clip Tagging in Virtual Scene Context

When tagging clips created from virtual scenes:

1. **Tag Inheritance** (Optional Setting):
   - Virtual scene tags can auto-apply to new clips
   - Setting: "Inherit tags from virtual scene"
   - User can override/remove inherited tags

2. **Independent Tagging**:
   - Clips have their own tag relationships
   - Adding tags to clip doesn't affect virtual scene
   - Removing virtual scene doesn't remove clip tags

3. **Performer Tagging**:
   - Clips can have performer-specific tags
   - Independent from virtual scene performer tags
   - Full scene-performer metadata system applies

### Virtual Scene Clip List View

Show all clips within a virtual scene:
```
┌──────────────────────────────────────────────────┐
│ Virtual Scene: "Performer A Solo"               │
│ Time Range: 0:00 - 7:30 (of parent)            │
├──────────────────────────────────────────────────┤
│ Clips (3):                                       │
│                                                  │
│ 📹 "Best moment" - 2:00-4:00                    │
│    Tags: passionate, closeup                    │
│    [Play] [Edit] [Tag]                          │
│                                                  │
│ 📹 "Highlight" - 5:00-6:30                      │
│    Tags: transition                             │
│    [Play] [Edit] [Tag]                          │
│                                                  │
│ 📹 "Finale" - 6:30-7:30                         │
│    Tags: climax                                 │
│    [Play] [Edit] [Tag]                          │
│                                                  │
│ [Create New Clip]                                │
└──────────────────────────────────────────────────┘
```

## Advanced Features

### Auto-Detection (Future Enhancement)
- AI/ML-based scene detection
- Analyze video for scene transitions
- Detect performer changes via face recognition
- Suggest split points automatically

### Scene Stitching (Future Enhancement)
- Combine multiple virtual scenes into a playlist
- Export as single file if needed
- Create "highlight reels" from virtual scenes

### Thumbnail Generation
- Extract frame at startTime as thumbnail
- Store in artwork cache
- Update if startTime changes

### Statistics & Analytics
- Track play counts per virtual scene
- Most popular scenes within groups
- Performer appearance statistics across virtual scenes
- Clip creation statistics per virtual scene

### Search Integration
- Search across virtual scene titles/descriptions
- Filter by virtual scene tags
- "Show me all scenes with Performer X in compilations"
- Include clips from virtual scenes in clip search

## Migration Considerations

### Existing Data
- Virtual scenes are additive - no impact on existing scenes/groups
- Users opt-in by creating virtual scenes
- Can work alongside regular scenes

### Sync with Stash
- Virtual scenes are Eddie-only (not synced back to Stash)
- Parent groups still sync normally
- Virtual scene metadata stored in Eddie database

## Performance Considerations

### Database Indexes
- Index on parentGroupId for fast group lookups
- Index on sceneIndex for ordered retrieval
- Composite indexes for common filter combinations

### Caching
- Cache virtual scene lists per group
- Invalidate on CRUD operations
- Cache thumbnails in artwork cache

### Pagination
- Virtual scene browse supports pagination
- Default 24 items per page
- Infinite scroll option

## Security & Data Integrity

### Cascading Deletes
- If parent group deleted, virtual scenes cascade delete
- If performer deleted, remove from virtual scenes
- If tag deleted, remove from virtual scenes

### Validation
- Start time must be < end time
- End time must be <= parent group duration
- Scene index must be unique within parent group
- Duration auto-calculated from start/end

## Development Phases

### Phase 1: Core Foundation (Week 1)
- [ ] Database schema and migration
  - [ ] StashVirtualScene model
  - [ ] Update StashClip model for virtual scene support
  - [ ] Pivot tables for relationships
- [ ] Basic CRUD API endpoints
- [ ] Virtual scene model and services
- [ ] Time validation utilities

### Phase 2: Bulk Entry System (Week 2)
- [ ] Bulk time entry form component
- [ ] Time input validation and formatting
- [ ] Bulk create API endpoint
- [ ] Time range conflict detection
- [ ] Copy/paste support from external sources
- [ ] Preview functionality

### Phase 3: UI Components (Week 3)
- [ ] Virtual scene card component
- [ ] Virtual scene list/grid view
- [ ] Basic detail modal
- [ ] Simple playback integration
- [ ] Context-aware time display

### Phase 4: Visual Timeline Editor (Week 4)
- [ ] Timeline editor component
- [ ] Draggable timeline markers
- [ ] Video player integration
- [ ] Visual feedback for segments
- [ ] Quick split functionality
- [ ] Switch between bulk/visual modes

### Phase 5: Clip Integration (Week 5)
- [ ] Update clip creation for virtual scenes
- [ ] Absolute/relative time calculation
- [ ] Clip list in virtual scene context
- [ ] Context-aware clip display
- [ ] Clip tagging with virtual scene awareness
- [ ] Clip playback from virtual scenes

### Phase 6: Metadata & Organization (Week 6)
- [ ] Performer assignment UI
- [ ] Tag management UI
- [ ] Rating and organization
- [ ] Studio assignment
- [ ] Tag inheritance settings

### Phase 7: Playback & Tracking (Week 7)
- [ ] Time-bounded playback
- [ ] Resume position tracking (virtual scene relative)
- [ ] View count tracking
- [ ] Playlist integration
- [ ] Clip playback integration

### Phase 8: Advanced Features (Week 8+)
- [ ] Thumbnail generation
- [ ] Search integration (scenes and clips)
- [ ] Statistics/analytics
- [ ] Android app support
- [ ] Chapter import functionality

## Success Metrics

- Users can create virtual scenes from groups
- Virtual scenes display correctly in browse views
- Time-bounded playback works reliably
- Virtual scene metadata is independent and accurate
- Search/filter includes virtual scenes
- Performance acceptable with 100+ virtual scenes per group

## Implementation Details

### Time Format Handling

Support multiple time input formats:
```javascript
function parseTimeInput(input) {
  // Support formats:
  // "1:23:45" (1h 23m 45s) → 5025 seconds
  // "12:34" (12m 34s) → 754 seconds
  // "123" (123 seconds) → 123 seconds
  // "1h 23m 45s" (human readable) → 5025 seconds
  
  // Return seconds or throw validation error
}

function formatTimeDisplay(seconds, format = 'HH:MM:SS') {
  // Convert seconds back to display format
  // 5025 → "1:23:45"
  // 754 → "12:34"
}
```

### Validation Rules

```javascript
async function validateVirtualScenes(groupId, scenes) {
  const group = await getGroup(groupId);
  const errors = [];
  
  scenes.forEach((scene, index) => {
    // 1. End must be after start
    if (scene.endTime <= scene.startTime) {
      errors.push(`Scene ${index + 1}: End time must be after start time`);
    }
    
    // 2. Times must be within parent duration
    if (scene.endTime > group.duration) {
      errors.push(`Scene ${index + 1}: End time exceeds parent duration`);
    }
    
    // 3. Check for overlaps with other scenes
    scenes.forEach((otherScene, otherIndex) => {
      if (index !== otherIndex) {
        if (scene.startTime < otherScene.endTime && scene.endTime > otherScene.startTime) {
          errors.push(`Scene ${index + 1} overlaps with Scene ${otherIndex + 1}`);
        }
      }
    });
  });
  
  return { valid: errors.length === 0, errors };
}
```

### Clip Time Calculation Service

```javascript
class VirtualSceneClipService {
  /**
   * Calculate absolute times for clip within virtual scene
   */
  calculateAbsoluteTimes(virtualScene, relativeStart, relativeEnd) {
    return {
      absoluteStart: virtualScene.startTime + relativeStart,
      absoluteEnd: virtualScene.startTime + relativeEnd
    };
  }
  
  /**
   * Calculate relative times for clip display in virtual scene
   */
  calculateRelativeTimes(virtualScene, absoluteStart, absoluteEnd) {
    return {
      relativeStart: absoluteStart - virtualScene.startTime,
      relativeEnd: absoluteEnd - virtualScene.startTime
    };
  }
  
  /**
   * Get clip context (scene or virtual scene)
   */
  async getClipContext(clipId) {
    const clip = await prisma.stashClip.findUnique({
      where: { id: clipId },
      include: {
        scene: true,
        virtualScene: true
      }
    });
    
    if (clip.virtualScene) {
      return {
        type: 'virtual-scene',
        context: clip.virtualScene,
        displayTimes: {
          start: clip.virtualSceneStartTime,
          end: clip.virtualSceneEndTime
        }
      };
    }
    
    return {
      type: 'scene',
      context: clip.scene,
      displayTimes: {
        start: clip.startTime,
        end: clip.endTime
      }
    };
  }
}
```

## Open Questions

1. **Stash API Support**: Does Stash's streaming API support start/end time params? *(Need to verify)*
2. **Chapter Import**: How to extract chapter data from video files? *(ffprobe integration?)*
3. **Thumbnail Storage**: Use existing artwork cache or separate storage? *(Use existing cache)*
4. **Android Playback**: How to implement time ranges in Android player? *(ExoPlayer seek support)*
5. **Export**: Should users be able to export virtual scenes as separate files? *(Future enhancement)*
6. **Clip Migration**: Should existing clips be checked for virtual scene context? *(No, only new clips)*

## Conclusion

Virtual scenes provide a powerful way to organize and access specific segments within larger group files without file duplication. This feature enables fine-grained tagging, rating, and playback control while maintaining the benefits of consolidated storage.
