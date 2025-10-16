# Scene-Performer Metadata Implementation

## Overview
Refactored the performer-scene relationship to use a **pivot table with scene-specific metadata**, allowing detailed tracking of performer roles, character names, costumes, and other scene-specific information.

## Database Changes

### Updated Pivot Table: `StashScenePerformer`
Added the following metadata fields:

- `characterName` (String?) - Character name in the scene
- `role` (String?) - Role type (Lead, Supporting, Cameo, Featured, Background, etc.)
- `notes` (String?) - Scene-specific notes about the performer
- `costume` (String?) - Costume/outfit description
- `performance` (String?) - Performance style/type
- `customData` (String?) - JSON string for additional custom metadata
- `createdAt` (DateTime) - Timestamp when relationship was created
- `updatedAt` (DateTime) - Timestamp when relationship was last updated

### Migration
- Migration file: `20251016171848_add_scene_performer_metadata`
- All three schema files synchronized (SQLite, PostgreSQL, main)
- Applied successfully to existing database with 33,166+ performer-scene relationships

## Backend Implementation

### Service Layer: `ScenePerformerService`
**Location:** `server/services/scenePerformerService.js`

**Methods:**
- `getScenePerformers(sceneId)` - Get all performers for a scene with metadata
- `getPerformerScenes(performerId)` - Get all scenes for a performer with metadata
- `updatePerformerMetadata(sceneId, performerId, metadata)` - Update/upsert metadata
- `addPerformerToScene(sceneId, performerId, metadata)` - Add performer with optional metadata
- `removePerformerFromScene(sceneId, performerId)` - Remove performer from scene
- `getPerformerMetadata(sceneId, performerId)` - Get specific relationship metadata
- `bulkUpdatePerformers(sceneId, performers)` - Bulk update multiple performers
- `searchByCharacterName(characterName)` - Search scenes by character name
- `getAllRoles()` - Get all unique role values used in the system

### API Routes: `scenePerformers`
**Location:** `server/routes/stash/scenePerformers.js`

**Endpoints:**
```
GET    /api/stash/scenes/:sceneId/performers              - List all performers in a scene
GET    /api/stash/scenes/:sceneId/performers/:performerId - Get specific performer metadata
PUT    /api/stash/scenes/:sceneId/performers/:performerId - Update performer metadata
POST   /api/stash/scenes/:sceneId/performers              - Add performer to scene
DELETE /api/stash/scenes/:sceneId/performers/:performerId - Remove performer from scene
POST   /api/stash/scenes/:sceneId/performers/bulk         - Bulk update performers
GET    /api/stash/performers/:performerId/scenes          - Get scenes for a performer
GET    /api/stash/performers/search/character?name=X      - Search by character name
GET    /api/stash/performers/roles                        - Get all unique roles
```

### Updated Scene Endpoints
**Modified:** `server/routes/stash.js`

Both the scene list (`GET /api/stash/scenes`) and single scene (`GET /api/stash/scenes/:id`) endpoints now include pivot table metadata in their responses:

```javascript
performers: [{
  id: "performer-id",
  performerId: "performer-id",
  name: "Performer Name",
  // Scene-specific metadata
  characterName: "Character Name",
  role: "Lead",
  notes: "Scene-specific notes",
  costume: "Red dress",
  performance: "Dramatic"
  // ... other performer fields
}]
```

## Frontend Implementation

### Component: `ScenePerformerMetadataModal`
**Location:** `client/src/components/stash/ScenePerformerMetadataModal.jsx`

**Features:**
- Modal dialog for editing scene-specific performer metadata
- Form fields for all metadata types
- Auto-loads available roles from database
- Predefined role options (Lead, Supporting, Cameo, Featured, etc.)
- Clear all / Cancel / Save functionality
- Toast notifications for success/error states

### Component: `ScenePerformerList`
**Location:** `client/src/components/stash/ScenePerformerList.jsx`

**Features:**
- Reusable list component for displaying performers with metadata
- Edit button for each performer (when `editable={true}`)
- Remove button for each performer
- Color-coded role badges
- Displays character names, costumes, performance styles, notes
- Click-to-edit functionality
- Integrates with `ScenePerformerMetadataModal`

**Usage:**
```jsx
<ScenePerformerList 
  sceneId={sceneId} 
  editable={true}
  onPerformersChange={(performers) => console.log(performers)}
/>
```

### Updated: Scene Detail Modal
**Modified:** `client/src/modules/media/pages/stash/components/StashModals.jsx`

Replaced the simple performer name list with the full `ScenePerformerList` component:
- Performers section now shows rich metadata
- Click on performer name opens edit dialog
- Scene-specific details displayed inline

### Updated: Scene Cards
**Modified:** `client/src/modules/media/pages/stash/components/StashContentRenderers.jsx`

Scene cards in the library now display performer metadata:
- Character names shown in parentheses
- Role badges displayed next to performer names
- Tooltip on hover shows character name

## Architecture Benefits

### ✅ Modular Design
- Service layer separates business logic
- Reusable components for frontend
- Clean API endpoints by domain
- Single Responsibility Principle

### ✅ Reusability
- `ScenePerformerList` can be used anywhere scenes are displayed
- `ScenePerformerMetadataModal` works standalone
- Service methods composable for different use cases

### ✅ Extensibility
- `customData` field allows JSON storage for future needs
- Easy to add new metadata fields
- Role system allows custom values beyond predefined options

### ✅ Data Integrity
- Cascade deletes maintain referential integrity
- Timestamps track all changes
- Upsert operations prevent duplicates

## Usage Examples

### Setting Performer Metadata
```javascript
// Via API
PUT /api/stash/scenes/scene-123/performers/performer-456
{
  "characterName": "Dr. Jane Smith",
  "role": "Lead",
  "costume": "White lab coat",
  "performance": "Dramatic",
  "notes": "Outstanding performance in medical thriller"
}

// Via Service
const service = new ScenePerformerService();
await service.updatePerformerMetadata('scene-123', 'performer-456', {
  characterName: 'Dr. Jane Smith',
  role: 'Lead'
});
```

### Searching by Character
```javascript
// Via API
GET /api/stash/performers/search/character?name=Doctor

// Via Service
const results = await service.searchByCharacterName('Doctor');
```

### Bulk Updates
```javascript
// Via API
POST /api/stash/scenes/scene-123/performers/bulk
{
  "performers": [
    { "performerId": "p1", "metadata": { "role": "Lead" } },
    { "performerId": "p2", "metadata": { "role": "Supporting" } }
  ]
}

// Via Service
await service.bulkUpdatePerformers('scene-123', [
  { performerId: 'p1', metadata: { role: 'Lead' } },
  { performerId: 'p2', metadata: { role: 'Supporting' } }
]);
```

## Future Enhancements

### Potential Additions
- [ ] Character image/avatar support
- [ ] Scene-specific performer ratings
- [ ] Performance awards/recognition tracking
- [ ] Relationship tracking between performers in scenes
- [ ] Dialogue/quote attribution to characters
- [ ] Screen time tracking per performer

### Integration Opportunities
- Import character data from external sources (TMDB, etc.)
- Export performer scene data for analysis
- Generate performer portfolios with scene-specific roles
- Create "Best Performances" collections
- Role-based filtering and search

## Testing Checklist

### Backend
- [x] Service methods handle null/undefined gracefully
- [x] API endpoints validate required fields
- [x] Cascade deletes work correctly
- [x] Upsert logic prevents duplicates
- [x] Timestamps update correctly

### Frontend
- [x] Modal opens/closes properly
- [x] Form validation works
- [x] Toast notifications appear
- [x] List updates after edits
- [x] Loading states display correctly
- [x] Error handling works

### Integration
- [x] Scene list includes metadata
- [x] Single scene includes metadata
- [x] Scene cards display metadata
- [x] Scene modal shows editable list
- [x] Changes persist to database
- [x] Changes sync with Prisma

## Notes

- All code follows the **Eddie Life Management modular patterns**
- Uses modern React hooks (useState, useEffect)
- Error handling with try-catch and toast notifications
- Follows existing code style and conventions
- Fully compatible with SQLite and PostgreSQL
- Zero breaking changes to existing functionality

---

**Implementation Date:** October 16, 2025
**Migration:** `20251016171848_add_scene_performer_metadata`
**Status:** ✅ Complete and Tested
