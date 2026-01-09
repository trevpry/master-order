# IdentifyModal Integration Guide

## Quick Integration Examples

### Example 1: AlbumDetail Page Integration

```jsx
import React, { useState } from 'react';
import { Edit2, Search } from 'lucide-react';
import MetadataEditor from '@/components/MetadataEditor';
import IdentifyModal from '@/components/IdentifyModal';

function AlbumDetail({ album, onAlbumUpdate }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);

  const handleIdentified = (updatedAlbum) => {
    // Refresh album data after identification
    onAlbumUpdate(updatedAlbum);
    // Could also refetch from API to get all updated fields
  };

  return (
    <div className="album-detail">
      {/* Action Buttons */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowIdentifyModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Search size={16} />
          Identify with MusicBrainz
        </button>
        
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Edit2 size={16} />
          {isEditMode ? 'Done Editing' : 'Edit Metadata'}
        </button>
      </div>

      {/* Identification Status Badge */}
      {album.identificationStatus && (
        <div className="mb-4">
          <span className={`inline-flex items-center px-3 py-1 rounded text-sm ${
            album.identificationStatus === 'identified' 
              ? 'bg-green-900 text-green-200'
              : album.identificationStatus === 'pending_review'
              ? 'bg-yellow-900 text-yellow-200'
              : 'bg-gray-700 text-gray-300'
          }`}>
            {album.identificationStatus === 'identified' && '✓ Identified'}
            {album.identificationStatus === 'pending_review' && '⏳ Pending Review'}
            {album.identificationStatus === 'unidentified' && 'Not Identified'}
            {album.identificationStatus === 'manual' && 'Manual Entry'}
            {album.identificationConfidence && ` (${Math.round(album.identificationConfidence * 100)}% match)`}
          </span>
        </div>
      )}

      {/* Album Metadata */}
      {isEditMode ? (
        <div className="bg-gray-800 p-6 rounded-lg space-y-4">
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="title"
            label="Album Title"
            currentValue={album.title}
            onUpdate={(val) => onAlbumUpdate({ ...album, title: val })}
          />
          
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="releaseDate"
            label="Release Date"
            currentValue={album.releaseDate}
            onUpdate={(val) => onAlbumUpdate({ ...album, releaseDate: val })}
          />
          
          <MetadataEditor
            entityType="album"
            entityKey={album.ratingKey}
            field="label"
            label="Record Label"
            currentValue={album.studio}
            onUpdate={(val) => onAlbumUpdate({ ...album, studio: val })}
          />
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-bold mb-2">{album.title}</h1>
          <p className="text-gray-400">{album.artist?.title}</p>
          <p className="text-gray-400">{album.year}</p>
        </div>
      )}

      {/* Identify Modal */}
      <IdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        entityType="album"
        entityKey={album.ratingKey}
        entityTitle={album.title}
        onIdentified={handleIdentified}
      />

      {/* Rest of album detail UI */}
    </div>
  );
}

export default AlbumDetail;
```

### Example 2: ArtistDetail Page Integration

```jsx
import React, { useState } from 'react';
import { Search, Edit2 } from 'lucide-react';
import IdentifyModal from '@/components/IdentifyModal';
import MetadataEditor from '@/components/MetadataEditor';

function ArtistDetail({ artist, onArtistUpdate }) {
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  return (
    <div className="artist-detail">
      {/* Header Actions */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setShowIdentifyModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Search size={16} />
          Identify Artist
        </button>
        
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
        >
          <Edit2 size={16} />
          {isEditMode ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Metadata Editing */}
      {isEditMode && (
        <div className="bg-gray-800 p-6 rounded-lg mb-6 space-y-4">
          <MetadataEditor
            entityType="artist"
            entityKey={artist.ratingKey}
            field="title"
            label="Artist Name"
            currentValue={artist.title}
            onUpdate={(val) => onArtistUpdate({ ...artist, title: val })}
          />
          
          <MetadataEditor
            entityType="artist"
            entityKey={artist.ratingKey}
            field="sortName"
            label="Sort Name"
            currentValue={artist.titleSort}
            onUpdate={(val) => onArtistUpdate({ ...artist, titleSort: val })}
          />
          
          <MetadataEditor
            entityType="artist"
            entityKey={artist.ratingKey}
            field="country"
            label="Country"
            currentValue={artist.country}
            onUpdate={(val) => onArtistUpdate({ ...artist, country: val })}
          />
        </div>
      )}

      {/* Identify Modal */}
      <IdentifyModal
        isOpen={showIdentifyModal}
        onClose={() => setShowIdentifyModal(false)}
        entityType="artist"
        entityKey={artist.ratingKey}
        entityTitle={artist.title}
        onIdentified={(updated) => onArtistUpdate(updated)}
      />

      {/* Rest of artist UI */}
    </div>
  );
}

export default ArtistDetail;
```

### Example 3: Batch Auto-Accept (Admin Tool)

```jsx
import React, { useState } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

function BatchIdentifyPanel() {
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState(null);
  const [minConfidence, setMinConfidence] = useState(95);

  const handleBatchAutoAccept = async () => {
    setProcessing(true);
    setResults(null);
    
    try {
      const response = await fetch('/api/identification/batch/auto-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entityType: 'album',
          minConfidence: minConfidence / 100
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResults(data.data);
      }
    } catch (error) {
      console.error('Batch operation failed:', error);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="batch-identify-panel bg-gray-800 p-6 rounded-lg">
      <h3 className="text-xl font-bold mb-4">Batch Auto-Identify</h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Minimum Confidence: {minConfidence}%
        </label>
        <input
          type="range"
          min="50"
          max="100"
          value={minConfidence}
          onChange={(e) => setMinConfidence(parseInt(e.target.value))}
          className="w-full"
        />
      </div>

      <button
        onClick={handleBatchAutoAccept}
        disabled={processing}
        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Auto-Accept High-Confidence Matches'}
      </button>

      {results && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle size={20} />
            <span>{results.accepted} albums identified successfully</span>
          </div>
          {results.failed > 0 && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle size={20} />
              <span>{results.failed} albums failed</span>
            </div>
          )}
          <p className="text-gray-400 text-sm">
            Total candidates processed: {results.total}
          </p>
        </div>
      )}
    </div>
  );
}

export default BatchIdentifyPanel;
```

## Usage Tips

### When to Show Identify Button
- **Unidentified Albums:** Always show for albums without MusicBrainz ID
- **Pending Review:** Show badge + button for pending matches
- **Identified Albums:** Show "Re-identify" option in settings/dropdown
- **Manual Albums:** Show "Try Identification Again" option

### Status Badge Colors
```jsx
const getStatusColor = (status) => {
  switch (status) {
    case 'identified': return 'bg-green-900 text-green-200';
    case 'pending_review': return 'bg-yellow-900 text-yellow-200';
    case 'manual': return 'bg-purple-900 text-purple-200';
    case 'no_match': return 'bg-red-900 text-red-200';
    default: return 'bg-gray-700 text-gray-300';
  }
};
```

### Error Handling
```jsx
const handleIdentifyError = (error) => {
  if (error.message.includes('not found')) {
    toast.error('Album not found in database');
  } else if (error.message.includes('MusicBrainz')) {
    toast.error('MusicBrainz service unavailable');
  } else {
    toast.error('Identification failed. Please try again.');
  }
};
```

### Refresh After Identification
```jsx
const handleIdentified = async (updatedEntity) => {
  // Option 1: Use returned entity
  setAlbum(updatedEntity);
  
  // Option 2: Refetch from API for complete data
  const response = await fetch(`/api/music/albums/${album.ratingKey}`);
  const data = await response.json();
  setAlbum(data.data);
  
  // Show success message
  toast.success('Album identified successfully!');
};
```

## Next Steps
1. Integrate IdentifyModal into AlbumDetail page
2. Test with real albums (especially various confidence levels)
3. Add to ArtistDetail page
4. Implement batch operations UI
5. Add identification status to album/artist lists
6. Create admin panel for bulk operations
