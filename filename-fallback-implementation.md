# Filename Fallback Implementation

## Overview
Updated the Next Stash functionality to display the filename from the scene's path (without extension) when no title is available.

## Changes Made

### 1. Helper Functions Added
- **`getFileNameFromPath(path)`**: Extracts filename from file path and removes extension
  - Handles both forward and backslashes
  - Returns null if no valid filename found
  - Removes file extension (everything after last dot)

- **`getSceneDisplayTitle(scene)`**: Determines the best title to display for a scene
  - Priority order:
    1. scene.title (if exists and not empty)
    2. scene.details (if exists and not empty)  
    3. Filename from scene.path (without extension)
    4. Fallback to "Untitled Scene"

### 2. Updated All Title Displays
Updated all locations where scene titles are displayed to use the new `getSceneDisplayTitle()` helper:

- **Next Stash tab**: Main scene title display
- **Library scenes list**: Scene cards title
- **Android companion app data**: Play, pause, and stop commands
- **Modal dialogs**: Both Android companion and delete confirmation modals
- **Image alt text**: All scene images now use consistent titles

### 3. Database Schema Reference
The implementation uses the `path` field from the `StashScene` database model:
```prisma
model StashScene {
  // ... other fields
  path             String?
  // ... other fields
}
```

## Example Behavior

### Before
- Scene with no title → "Untitled Scene"
- Scene with empty title → "Untitled Scene"

### After  
- Scene with title "My Video" → "My Video"
- Scene with no title but path "/path/to/video.mp4" → "video"
- Scene with no title but path "C:\Videos\My Movie.mkv" → "My Movie"
- Scene with no title and no path → "Untitled Scene"

## Benefits
- More descriptive titles for scenes without metadata
- Consistent behavior across all UI components
- Maintains backward compatibility
- Uses existing database fields (no schema changes needed)
