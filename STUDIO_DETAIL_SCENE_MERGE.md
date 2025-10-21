# Studio Detail Scene Merge Feature

## Overview
Added complete scene merge functionality to the Studio Detail page, matching the capability available on the Performer Detail page. Users can now select multiple scenes from a studio and merge them into a single scene with combined metadata.

## New Features

### 1. Scene Selection
- **Checkboxes**: Each scene card now has a checkbox overlay
- **Visual Feedback**: Selected scenes have a light gray background
- **Multi-select**: Select 2 or more scenes to enable merge

### 2. Merge Button
- **Conditional Display**: Only appears when 2+ scenes are selected
- **Styled Design**: Purple gradient button with hover effects
- **Clear Count**: Shows "🔀 Merge X Selected Scenes"

### 3. Scene Merge Modal
Comprehensive merge interface with multiple selection options:

#### Primary Scene Selection
- Choose which scene ID to keep (others are deleted from database)
- Dropdown with scene title and date for easy identification

#### File Selection
- Choose which video file to keep on disk
- Shows file path, name, and size
- ⚠️ WARNING: Other video files are PERMANENTLY DELETED

#### Metadata Selection
Users can choose from each scene's data for:
- **Title**: Radio buttons to select which title to keep
- **Date**: Radio buttons to select which date to keep
- Visual feedback with blue highlight for selected option

#### Safety Features
- Comprehensive confirmation dialog before merge
- Lists all actions that will be taken
- Shows which files will be deleted
- Requires explicit confirmation

### 4. Merge Process
1. Select 2+ scenes using checkboxes
2. Click "Merge X Selected Scenes" button
3. Modal loads full details for all selected scenes
4. Choose primary scene (ID to keep)
5. Choose file to keep (other files deleted from disk)
6. Select desired metadata (title, date, etc.)
7. Confirm merge operation
8. Scene list automatically reloads with merged result

## Technical Implementation

### State Management
```javascript
const [selectedScenes, setSelectedScenes] = useState(new Set());
const [showSceneMergeModal, setShowSceneMergeModal] = useState(false);
const [scenesToMerge, setScenesToMerge] = useState([]);
const [mergeSceneData, setMergeSceneData] = useState(null);
const [isMergingScenes, setIsMergingScenes] = useState(false);
```

### Key Functions

**handleToggleScene(sceneId)**
- Adds/removes scene from selection Set
- Manages checkbox state

**handleOpenSceneMergeModal()**
- Validates 2+ scenes selected
- Fetches full scene details via API
- Initializes merge data with first scene's values
- Opens modal

**handleUpdateMergeField(field, value)**
- Updates merge data for specific field
- Handles radio button selections

**handleMergeScenes()**
- Validates selections
- Shows comprehensive confirmation dialog
- Calls `/api/stash/scenes/merge` endpoint
- Reloads scene list on success

### API Integration

**Endpoint**: `POST /api/stash/scenes/merge`

**Request Body**:
```javascript
{
  primarySceneId: string,      // Scene ID to keep
  mergeSceneIds: string[],     // Scene IDs to delete
  mergedData: {
    title: string,
    date: string,
    details: string,
    url: string,
    studio: object,
    performers: array,
    tags: array,
    episodeUrls: array,
    geviUrl: string,
    keepFileFromSceneId: string,  // Which file to keep
    primarySceneId: string
  }
}
```

### UI Components

**Scene Grid with Checkboxes**:
- Wraps each SceneCard in a checkbox container
- Positioned checkbox overlay (top-left)
- Background highlight for selected scenes

**Merge Button**:
- Purple gradient (#8b5cf6 → #7c3aed)
- Hover animations (lift + shadow)
- Only visible when 2+ scenes selected

**Merge Modal**:
- Large modal (900px max-width)
- Scrollable content
- Organized sections for each selection
- Radio buttons with visual feedback
- Clear labeling and instructions

## User Experience

### Visual Feedback
- ✅ Selected scenes: Gray background
- ✅ Active radio option: Blue background
- ✅ Merge button: Hover animations
- ✅ Loading states: Spinner + disabled buttons

### Safety Measures
1. **Minimum Selection**: Must select 2+ scenes
2. **Confirmation Dialog**: Detailed list of actions
3. **File Deletion Warning**: Explicit warning about permanent deletion
4. **Lists What's Deleted**: Shows exactly which scenes/files will be removed
5. **No Undo Warning**: Clear statement that action cannot be undone

### Workflow Efficiency
- Checkboxes inline with scene cards (no separate mode)
- One-click merge button (no menu navigation)
- Smart defaults (first scene's data pre-selected)
- Clear visual organization in modal
- Automatic reload after merge

## Use Cases

### 1. Duplicate Scenes
- Studio uploaded same scene twice
- Different file versions (quality, resolution)
- Keep best quality file, merge metadata

### 2. Multi-Part Scenes
- Scene split across multiple files in Stash
- Merge into single scene entry
- Keep primary file

### 3. Metadata Consolidation
- One scene has better title
- Another has accurate date
- Combine best of both

### 4. File Management
- Multiple versions taking up space
- Keep preferred file
- Delete duplicates from disk

## Safety & Data Protection

### What's Preserved
✅ Primary scene ID (database entry)
✅ Selected file (on disk)
✅ Chosen metadata values
✅ All URLs (combined from all scenes)
✅ Performers (combined)
✅ Tags (combined)

### What's Deleted
❌ Secondary scene database entries
❌ Unselected video files (PERMANENT)
❌ Duplicate metadata

### Safeguards
- Explicit confirmation required
- Clear listing of deletions
- File size information shown
- Cannot be undone warning

## Files Modified

- `client/src/modules/media/pages/stash/StudioDetail.jsx`
  - Added scene merge state
  - Added merge handlers
  - Modified scene rendering (checkboxes)
  - Added merge button
  - Added merge modal

## API Compatibility

Uses existing merge endpoint:
- `POST /api/stash/scenes/merge` (already exists)
- Same request/response format as Performer Detail
- No backend changes required

## Testing Checklist

- [ ] Checkboxes appear on each scene
- [ ] Selection toggles correctly
- [ ] Merge button appears at 2+ selections
- [ ] Modal opens with scene details
- [ ] Primary scene dropdown works
- [ ] File selection dropdown works
- [ ] Title radio buttons work
- [ ] Date radio buttons work
- [ ] Confirmation dialog shows
- [ ] Merge executes successfully
- [ ] Scene list reloads after merge
- [ ] Merged scene shows correct data
- [ ] Files are deleted from disk
- [ ] Checkboxes clear after merge

## Future Enhancements

Potential improvements:
- Details/synopsis selection
- Performer merge UI
- Tag merge UI
- Studio selection
- URL combine preview
- File comparison details
- Batch merge (merge sets)
- Undo last merge
- Merge history log

## Notes

- **Identical to Performer Detail**: Same functionality, ensures consistency
- **File Deletion**: Video files are PERMANENTLY DELETED - cannot recover
- **Database Safety**: Primary scene ID preserved, others removed
- **Metadata Merging**: URLs, performers, tags automatically combined
- **No Rebuild Required**: Uses existing API endpoint
