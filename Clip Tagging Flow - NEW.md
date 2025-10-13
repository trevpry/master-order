# Clip Tagging Flow

## Overview
When adding tags to a clip, the user is presented with a hierarchical, expandable tree view of all available tags in the database.

## Implementation

### User Flow
1. Click "➕ Add Tags" button on the clip overlay
2. Modal opens showing hierarchical tag tree
3. Click **▶** to expand parent tags and see children
4. Click **▼** to collapse expanded tags
5. Click checkbox next to tag name to select/deselect tags
6. Click "Apply ✓ X Tags" button to add selected tags to clip
7. Modal closes and clip overlay refreshes to show new tags

### Features
- **Hierarchical Display**: Tags organized by parent-child relationships
- **Expandable/Collapsible**: Click arrows to expand/collapse tag categories
- **Visual Indicators**:
  - Blue checkbox with ✓: Tag selected for addition
  - Green checkbox with ✓: Tag already exists on clip (not selectable)
  - ▶: Collapsed parent tag (has children)
  - ▼: Expanded parent tag (showing children)
- **Multi-Select**: Select multiple tags before applying
- **Existing Tag Prevention**: Tags already on clip are disabled and marked green

### Technical Details

**Component**: `StashClipTagSelector.jsx`  
**Location**: `client/src/components/overlays/`

**State Management**:
- `allTags`: All tags fetched from database
- `tagHierarchy`: Root-level tags with nested children
- `expandedTags`: Set of tag IDs that are currently expanded
- `selectedTags`: Array of tag IDs selected for addition
- `existingTags`: Set of tag IDs already on the clip

**Data Fetching**:
- Fetches all tags: `GET /api/stash/tags?rootOnly=false&perPage=10000`
- Fetches existing clip tags: `GET /api/android/stash/clip/:clipId/tags`
- Builds hierarchy from flat tag list using `parentTags` relationships

**Tag Application**:
- Applies tags: `POST /api/android/stash/clip/:clipId/tags`
- Sends `{ tagIds: [array of selected tag IDs] }`
- Shows success toast with tag names
- Triggers parent overlay refresh

**Hierarchy Building**:
```javascript
// Tags with no parentTags are root tags
// Tags with parentTags are added as children to their parents
// Recursive rendering shows full tree structure
```

### UI Layout
```
┌────────────────────────────────────────┐
│ 🏷️ Add Tags to Clip              [×]  │
│ Select tags from the hierarchical list │
├────────────────────────────────────────┤
│                                        │
│ ☐ ▶ Category A                       │
│ ☐ ▼ Category B                       │
│     ☐ ▶ Subcategory B1               │
│     ✓ ☑ Subcategory B2 (selected)    │
│     ✓ ☑ Subcategory B3 (already add) │
│ ☐ ▶ Category C                       │
│                                        │
├────────────────────────────────────────┤
│ Click ▶ to expand    [Cancel] [Apply] │
└────────────────────────────────────────┘
```

### Integration Points

**Parent Component**: `StashClipOverlay.jsx`
- Renders "➕ Add Tags" button
- Opens modal with `setShowTagSelector(true)`
- Passes `clipId` to tag selector
- Provides `onTagsAdded` callback to refresh clip tags
- No longer passes `performerCount` (removed)

**Props**:
- `clipId` (number): ID of clip to add tags to
- `onClose` (function): Callback to close modal
- `onTagsAdded` (function): Callback after tags applied

### Example Tag Hierarchy
```
Sex Acts (parent)
├─ Oral Sex (child)
│  ├─ Blowjob (grandchild)
│  └─ Cunnilingus (grandchild)
└─ Penetration (child)
   ├─ Vaginal (grandchild)
   └─ Anal (grandchild)

Performer Count (parent)
├─ Solo (child)
├─ Couple Sex (child)
└─ Group Sex (child)
   ├─ Threesome (grandchild)
   └─ Orgy (grandchild)
```

## Benefits
- **Intuitive Navigation**: Tree structure matches how tags are organized
- **Full Access**: All database tags available, not filtered
- **Visual Feedback**: Clear indication of selected vs existing tags
- **Efficient Selection**: Multi-select reduces repetitive actions
- **Context Aware**: Shows which tags already exist on clip
