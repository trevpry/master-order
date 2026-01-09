# Integrating MetadataEditor into AlbumDetail Page

## Quick Integration Guide

### Step 1: Import MetadataEditor
Add this import to your AlbumDetail component:

```jsx
import MetadataEditor from '@/components/MetadataEditor';
```

### Step 2: Add to Album Info Section
Replace static text fields with MetadataEditor components. Example for album title:

**Before:**
```jsx
<div className="text-3xl font-bold mb-2">
  {album.title}
</div>
```

**After:**
```jsx
<MetadataEditor
  entityType="album"
  entityKey={album.ratingKey}
  field="title"
  label="Album Title"
  currentValue={album.title}
  onUpdate={(newValue) => {
    // Option 1: Refresh entire album data
    refetchAlbum();
    
    // Option 2: Update local state
    setAlbum({ ...album, title: newValue });
  }}
/>
```

### Step 3: Add Edit Button
Add a prominent "Edit Metadata" button to toggle edit mode:

```jsx
const [isEditMode, setIsEditMode] = useState(false);

// In your header section:
<button
  onClick={() => setIsEditMode(!isEditMode)}
  className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
>
  <Edit2 size={16} />
  {isEditMode ? 'Done Editing' : 'Edit Metadata'}
</button>

// Then conditionally show MetadataEditor or static text:
{isEditMode ? (
  <MetadataEditor
    entityType="album"
    entityKey={album.ratingKey}
    field="title"
    label="Album Title"
    currentValue={album.title}
    onUpdate={handleUpdate}
  />
) : (
  <div className="text-3xl font-bold">
    {album.title}
  </div>
)}
```

### Step 4: Add Identify Button
Add a "Identify with MusicBrainz" button (Phase 3 will implement the modal):

```jsx
<button
  onClick={() => setShowIdentifyModal(true)}
  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
>
  <Search size={16} />
  Identify Album
</button>
```

### Complete Example

```jsx
import React, { useState } from 'react';
import { Edit2, Search } from 'lucide-react';
import MetadataEditor from '@/components/MetadataEditor';

function AlbumDetail({ album, onAlbumUpdate }) {
  const [isEditMode, setIsEditMode] = useState(false);

  const handleMetadataUpdate = (field, newValue) => {
    // Update local state or refetch
    onAlbumUpdate({ ...album, [field]: newValue });
  };

  return (
    <div className="album-detail">
      {/* Header with action buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Edit2 size={16} />
          {isEditMode ? 'Done Editing' : 'Edit Metadata'}
        </button>
        
        <button
          onClick={() => console.log('Identify modal coming in Phase 3')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Search size={16} />
          Identify Album
        </button>
      </div>

      {/* Album metadata */}
      {isEditMode ? (
        <div className="bg-gray-800 p-6 rounded-lg">
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="title"
            label="Album Title"
            currentValue={album.title}
            onUpdate={(val) => handleMetadataUpdate('title', val)}
          />
          
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="releaseDate"
            label="Release Date"
            currentValue={album.releaseDate}
            onUpdate={(val) => handleMetadataUpdate('releaseDate', val)}
          />
          
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="label"
            label="Record Label"
            currentValue={album.studio}
            onUpdate={(val) => handleMetadataUpdate('label', val)}
          />
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-2">{album.title}</h1>
          <p className="text-gray-400">{album.releaseDate}</p>
          <p className="text-gray-400">{album.studio}</p>
        </div>
      )}
      
      {/* Rest of your album detail UI */}
    </div>
  );
}

export default AlbumDetail;
```

## Usage Notes

### When to Use MetadataEditor
- **Album/Artist Detail Pages:** Primary use case - full metadata editing
- **Track Lists:** For inline title/composer edits
- **Bulk Edit Modals:** Edit multiple entities at once (Phase 5)

### When NOT to Use
- **Simple Display:** If user doesn't need to edit, use regular text
- **Performance-Critical Lists:** Use static text, add edit button to detail view
- **Read-Only Views:** Public-facing or shared views

### State Management Tips
1. **Optimistic Updates:** Update UI immediately, then refetch in background
2. **Error Handling:** Show toast/notification on save errors
3. **Dirty State:** Track unsaved changes with banner/warning
4. **Auto-Save:** Consider debounced auto-save for better UX

### Styling Customization
The MetadataEditor uses Tailwind classes. To customize:
- Change color scheme by replacing purple-* classes
- Adjust sizing with px/py values
- Override with wrapper div classes

Example custom styling:
```jsx
<div className="metadata-editor-custom">
  <MetadataEditor {...props} />
</div>

<style>
.metadata-editor-custom button {
  /* Your custom button styles */
}
</style>
```

## Next Steps
1. Integrate MetadataEditor into AlbumDetail page
2. Test with real album data
3. Add to ArtistDetail page for artist metadata
4. Implement IdentificationService (Phase 3)
5. Build Identify modal UI (Phase 4)
