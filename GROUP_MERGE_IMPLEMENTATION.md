# Group Merge Feature Implementation

## Overview
Added merge functionality to the Groups (Movies) page, allowing users to merge multiple groups/movies into a single primary group with all scenes consolidated.

## Implementation Details

### Backend (server/routes/stash.js)
**Endpoint**: `POST /api/stash/groups/merge` (Lines 3750-3882)

**Features**:
- Validates `primaryGroupId` and `mergeGroupIds` parameters
- Fetches all groups with their scenes (includes sceneIndex from pivot table)
- Consolidates all unique scenes from merged groups into primary group
- Preserves original `sceneIndex` values from each group
- Updates primary group metadata with merged data
- Deletes old scene-to-group links and creates new consolidated links
- Deletes merged groups from database
- Returns updated primary group with all scenes

**Request Body**:
```json
{
  "primaryGroupId": 123,
  "mergeGroupIds": [124, 125],
  "mergedData": {
    "name": "Updated Group Name",
    "date": "2024-01-01",
    "synopsis": "Merged synopsis",
    "director": "Director Name",
    "rating": 85,
    "duration": 7200,
    "urls": "url1,url2",
    "frontImage": "image_url",
    "backImage": "image_url",
    "studio": { "id": 1, "name": "Studio Name" },
    "tags": [{ "id": 1, "name": "Tag Name" }]
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "name": "Updated Group Name",
    "scenes": [...],
    "totalScenes": 15,
    "...": "other group properties"
  }
}
```

### Frontend (client/src/modules/media/pages/stash/GroupsPage.jsx)

#### New State Variables (Lines 23-27)
- `selectedGroups` - Set of group IDs selected for merging
- `showMergeModal` - Boolean to control merge modal visibility
- `groupsToMerge` - Array of full group objects with details
- `mergeGroupData` - Object holding merged group metadata
- `isMerging` - Boolean for merge operation loading state

#### New Functions

**`toggleGroupSelection(groupId)`** (Lines 89-99)
- Toggles group selection for merging
- Adds/removes group ID from `selectedGroups` Set

**`handleOpenMergeModal()`** (Lines 101-149)
- Validates at least 2 groups are selected
- Fetches full details for all selected groups
- Initializes `mergeGroupData` with first group's metadata
- Opens merge modal

**`handleMergeGroups()`** (Lines 151-207)
- Validates primary group is selected
- Shows confirmation dialog with merge details
- Calls backend `/api/stash/groups/merge` endpoint
- Handles success/error states
- Reloads groups list after successful merge
- Clears selection state

#### UI Components

**Merge Button in Header** (Lines 225-237)
- Appears when 2+ groups are selected
- Shows count of selected groups
- Styled with purple theme (`#667eea`)

**Selection Checkboxes on Group Cards** (Lines 329-353)
- Positioned absolutely in top-right corner
- 20x20px size for easy clicking
- Stops propagation to prevent navigation on click
- Visual feedback: border and background color change when selected

**Merge Modal** (Lines 523-643)
- **Primary Group Selector**: Dropdown to choose which group ID to keep
- **Groups List**: Shows all groups being merged with scene counts
- **Total Scenes Summary**: Displays total number of scenes to be consolidated
- **Warning Message**: Red-bordered warning about irreversible action
- **Action Buttons**: "Merge Groups" and "Cancel"
- **Loading State**: Disabled buttons and "Merging..." text during operation

#### Styling (Lines 693-796)
- `position: relative` on `.group-card` for absolute-positioned checkbox
- Complete modal styles:
  - `.modal-overlay` - Dark semi-transparent backdrop with flexbox centering
  - `.modal-content` - White rounded container with shadow
  - `.modal-header` - Title and close button
  - `.modal-body` - Scrollable content area
  - `.modal-actions` - Button container at bottom
  - `.btn-accept` - Purple primary action button
  - `.btn-cancel` - Gray secondary button
  - `.btn-close` - Large X button with hover effect

## User Workflow

1. **Selection**: User checks checkboxes on 2+ group cards
2. **Trigger**: Merge button appears in header, user clicks it
3. **Review**: Modal opens showing:
   - List of groups to merge with scene counts
   - Primary group selector (determines which ID is kept)
   - Total scenes summary
   - Warning about irreversibility
4. **Confirmation**: User selects primary group and clicks "Merge Groups"
5. **Execution**: 
   - Confirmation dialog appears
   - Backend merges groups and consolidates scenes
   - Success message shown
   - Groups list reloads
   - Selection cleared

## Technical Notes

### Scene Consolidation Logic
- Uses `Map` to collect unique scenes across all groups
- Preserves original `sceneIndex` from each group's pivot table
- Prevents duplicate scenes (same scene in multiple groups = single entry)
- All scenes get new links to primary group with their original indices

### Data Safety
- Transaction wrapping ensures atomic operation
- Primary group validation before deletion
- Confirmation dialog shows exactly what will be deleted
- All scene data preserved (only group associations change)

### Error Handling
- Validates minimum 2 groups selected
- Validates primary group exists
- Try-catch blocks with user-friendly error messages
- Loading states prevent double-clicks
- Backend returns detailed error messages

## Similar Implementations
Pattern based on existing scene merge functionality in `StudioDetail.jsx`:
- Same modal structure and styling
- Same confirmation workflow
- Same loading/error handling patterns
- Adapted for group-specific data model

## Future Enhancements (Possible)
- Bulk metadata editing in merge modal
- Preview of combined tags/performers across all scenes
- Ability to reorder scenes after merge
- Undo functionality (would require significant database changes)
- Drag-and-drop group selection

## Testing Checklist
- ✅ Select 2+ groups and merge successfully
- ✅ Verify all scenes consolidated into primary group
- ✅ Verify scene indices preserved correctly
- ✅ Verify merged groups deleted
- ✅ Verify primary group updated with merged metadata
- ✅ Test with groups containing overlapping scenes
- ✅ Test with groups containing no scenes
- ✅ Test modal cancel button
- ✅ Test confirmation dialog cancel
- ✅ Test error handling (network errors, invalid IDs)
- ✅ Test loading states during merge operation
