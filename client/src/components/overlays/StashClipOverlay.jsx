/**
 * StashClipOverlay Component
 * Displays an overlay when Android app requests a Stash clip via /stash/next.
 * Shows parent scene metadata with artwork in a clean, dismissable modal.
 */
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import config from '../../config';
import StashPerformerOverlay from './StashPerformerOverlay';
import StashClipTagSelector from './StashClipTagSelector';

const StashClipOverlay = ({ clipData, onClose }) => {
  const [selectedPerformerId, setSelectedPerformerId] = useState(null);
  const [sceneDate, setSceneDate] = useState(null);
  const [clipTags, setClipTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(true);
  const [addingTag, setAddingTag] = useState(null);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStudioSelector, setShowStudioSelector] = useState(false);
  const [studios, setStudios] = useState([]);
  const [studioSearchQuery, setStudioSearchQuery] = useState('');
  const [loadingStudios, setLoadingStudios] = useState(false);
  const [updatingStudio, setUpdatingStudio] = useState(false);
  const [currentStudio, setCurrentStudio] = useState(null);
  
  if (!clipData) return null;

  const { scene, clipId } = clipData;
  
  // Initialize/reset current studio from scene data whenever scene changes
  useEffect(() => {
    // Always sync currentStudio with scene.studio (could be null)
    setCurrentStudio(scene.studio || null);
  }, [scene.studio, scene.id]); // Also depend on scene.id to catch scene changes
  
  // Debug: Log clipId when component receives data
  useEffect(() => {
    console.log('🎬 StashClipOverlay received clipData:', {
      hasClipData: !!clipData,
      clipId: clipId,
      clipIdType: typeof clipId,
      fullClipData: clipData
    });
  }, [clipData, clipId]);
  
  // Fetch clip tags on mount
  useEffect(() => {
    if (!clipId) {
      console.warn('⚠️ No clipId available, skipping tag fetch');
      return;
    }
    
    fetchClipTags();
  }, [clipId]);

  // Function to fetch clip tags (can be called to refresh)
  const fetchClipTags = async () => {
    if (!clipId) return;
    
    try {
      setLoadingTags(true);
      const url = `${config.apiBaseUrl}/api/stash/clips/${clipId}/tags`;
      console.log('Fetching clip tags from:', url);
      
      const response = await fetch(url);
      console.log('Clip tags response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Clip tags response data:', data);
        
        // Extract tag IDs from the response
        const tagIds = data.tags?.map(t => t.tag.id) || [];
        console.log('Extracted tag IDs:', tagIds);
        setClipTags(tagIds);
      } else {
        const errorText = await response.text();
        console.error('Failed to fetch clip tags:', response.status, errorText);
        // Still set loading to false even if clip not found
        setClipTags([]);
      }
    } catch (error) {
      console.error('Error fetching clip tags:', error);
      setClipTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  // Handle tags added from tag selector
  const handleTagsAdded = (newTagIds) => {
    console.log('Tags added, refreshing clip tags...');
    fetchClipTags();
  };
  
  // Handle tag click to add/remove
  const handleTagClick = async (tagId) => {
    const isTagOnClip = clipTags.includes(tagId);
    
    if (isTagOnClip) {
      // Tag already on clip, don't do anything or optionally show a message
      console.log('Tag already on clip:', tagId);
      return;
    }
    
    try {
      setAddingTag(tagId);
      console.log(`Adding tag ${tagId} to clip ${clipId}`);
      
      const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`;
      console.log('POST URL:', url);
      console.log('POST body:', { tagIds: [tagId] });
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: [tagId] })
      });
      
      console.log('Response status:', response.status);
      const responseData = await response.json();
      console.log('Response data:', responseData);
      console.log('Response data.data:', responseData.data);
      
      if (response.ok) {
        // Add tag to local state
        setClipTags(prev => [...prev, tagId]);
        console.log('✅ Tag added successfully');
        console.log('Updated clipTags:', [...clipTags, tagId]);
        
        // Find the tag name for the toast
        const tag = scene.tags.find(t => t.id === tagId);
        const tagName = tag ? tag.name : `Tag ${tagId}`;
        
        // Show success toast
        toast.success(`✅ Added "${tagName}" to clip`, {
          duration: 3000,
          position: 'bottom-right',
        });
        
        // Emit event for other components to refresh if needed
        window.dispatchEvent(new CustomEvent('clipTagAdded', { 
          detail: { clipId, tagId, responseData } 
        }));
      } else {
        console.error('❌ Failed to add tag:', responseData);
        toast.error('Failed to add tag to clip', {
          duration: 4000,
          position: 'bottom-right',
        });
      }
    } catch (error) {
      console.error('❌ Error adding tag to clip:', error);
    } finally {
      setAddingTag(null);
    }
  };
  
  // Handle scene deletion
  const handleDeleteScene = async () => {
    if (!clipId) {
      toast.error('No clip ID available', { duration: 4000, position: 'bottom-right' });
      return;
    }
    
    const sceneTitle = scene.title || 'this scene';
    
    // Confirm deletion
    if (!window.confirm(
      `Are you sure you want to delete "${sceneTitle}" and all its clips?\n\n` +
      `This will:\n` +
      `• Delete the video file from disk\n` +
      `• Delete all generated content (thumbnails, sprites, etc.)\n` +
      `• Delete the scene from Stash database\n` +
      `• Delete all clips from your local database\n\n` +
      `This action cannot be undone.`
    )) {
      return;
    }
    
    setIsDeleting(true);
    
    try {
      console.log(`🗑️ Deleting scene via clip ID ${clipId}...`);
      
      const response = await fetch(`${config.apiBaseUrl}/api/android/stash/clip/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clipId: clipId,
          deleteFile: true,
          deleteGenerated: true
        })
      });
      
      const result = await response.json();
      
      if (response.ok && result.type === 'STASH_SCENE_DELETED') {
        console.log('✅ Successfully deleted scene:', result.data);
        
        const clipsDeleted = result.data.local?.clipsDeleted || 0;
        const localDeleted = result.data.local?.sceneDeleted || false;
        const remoteDeleted = result.data.remote?.success || false;
        
        // Build success message
        let message = `✅ Successfully deleted "${sceneTitle}"\n\n`;
        message += `• Deleted ${clipsDeleted} clip${clipsDeleted !== 1 ? 's' : ''}\n`;
        message += `• Removed from local database: ${localDeleted ? 'Yes' : 'No'}\n`;
        message += `• Deleted from Stash: ${remoteDeleted ? 'Yes' : 'No'}`;
        
        if (result.data.remote?.warning) {
          message += `\n\n⚠️ ${result.data.remote.warning}`;
        }
        
        toast.success(`Deleted "${sceneTitle}"`, {
          duration: 5000,
          position: 'bottom-right',
        });
        
        alert(message);
        
        // Close the overlay
        onClose();
      } else {
        console.error('❌ Failed to delete scene:', result);
        const errorMessage = result.data?.message || result.message || 'Unknown error';
        toast.error(`Failed to delete scene: ${errorMessage}`, {
          duration: 5000,
          position: 'bottom-right',
        });
        alert(`❌ Failed to delete scene: ${errorMessage}`);
      }
    } catch (error) {
      console.error('❌ Error deleting scene:', error);
      toast.error(`Error deleting scene: ${error.message}`, {
        duration: 5000,
        position: 'bottom-right',
      });
      alert(`❌ Error deleting scene: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Load all studios (called when opening the modal)
  const loadAllStudios = async () => {
    try {
      setLoadingStudios(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/studios?perPage=999999`
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Studios loaded:', data.data?.length || 0);
        setStudios(data.data || []);
      } else {
        console.error('Failed to load studios:', response.status);
        toast.error('Failed to load studios');
      }
    } catch (error) {
      console.error('Error loading studios:', error);
      toast.error('Failed to load studios');
    } finally {
      setLoadingStudios(false);
    }
  };
  
  // Handle studio selection
  const handleStudioSelect = async (studio) => {
    if (!scene.id) {
      toast.error('No scene ID available');
      return;
    }
    
    try {
      setUpdatingStudio(true);
      console.log(`Updating scene ${scene.id} with studio ${studio.id}`);
      
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${scene.id}/studio`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studioId: studio.id })
        }
      );
      
      const result = await response.json();
      
      if (response.ok) {
        setCurrentStudio(studio);
        setShowStudioSelector(false);
        setStudioSearchQuery('');
        setStudios([]);
        
        let message = `✅ Studio set to "${studio.name}"`;
        if (result.warning) {
          message += `\n\n⚠️ ${result.warning}`;
        }
        
        toast.success(`Studio updated to "${studio.name}"`, {
          duration: 4000,
          position: 'bottom-right',
        });
        
        if (result.warning) {
          toast.warning(result.warning, {
            duration: 6000,
            position: 'bottom-right',
          });
        }
      } else {
        toast.error(result.message || 'Failed to update studio');
      }
    } catch (error) {
      console.error('Error updating studio:', error);
      toast.error('Failed to update studio');
    } finally {
      setUpdatingStudio(false);
    }
  };
  
  // Load all studios when modal opens
  useEffect(() => {
    if (showStudioSelector) {
      loadAllStudios();
    }
  }, [showStudioSelector]);
  
  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!scene) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full p-6 border border-gray-700">
          <p className="text-white">No scene data available</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // Build scene image URL from Stash API
  const sceneImageUrl = `${config.apiBaseUrl}/api/stash/image-proxy/scene/${scene.id}/screenshot`;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-black z-[2000] overflow-hidden">
      {/* Close Button - Top Right */}
      <button
        onClick={onClose}
        className="absolute top-6 right-6 z-10 text-gray-400 hover:text-white transition-colors p-2 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75"
        aria-label="Close overlay"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Header - Top Left */}
      <div className="absolute top-6 left-6 z-10">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3 bg-black bg-opacity-50 px-4 py-2 rounded-lg">
          <span>📱</span>
          <span>Android Playing Clip</span>
        </h2>
      </div>

      {/* Main Content - Scrollable */}
      <div className="h-full overflow-y-auto pt-24 pb-8 px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Left Column - Large Artwork */}
            <div className="relative w-full">
              <div className="aspect-video bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
                <img
                  src={sceneImageUrl}
                  alt={scene.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
                  }}
                />
              </div>
            </div>

            {/* Right Column - Scene Info */}
            <div className="space-y-6">
              {/* Title & Basic Info */}
              <div>
                <h3 className="text-4xl font-bold text-white mb-4">{scene.title}</h3>
                <div className="flex flex-wrap gap-3 text-base">
                  {currentStudio ? (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>🎬</span>
                      <span>{currentStudio.name}</span>
                    </span>
                  ) : (
                    <button
                      onClick={() => setShowStudioSelector(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-900 bg-opacity-30 border border-yellow-600 text-yellow-300 rounded-lg hover:bg-opacity-50 transition-colors"
                    >
                      <span>🎬</span>
                      <span>Add Studio</span>
                    </button>
                  )}
                  {scene.date && (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>📅</span>
                      <span>{scene.date}</span>
                    </span>
                  )}
                  {scene.duration && (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>⏱️</span>
                      <span>{Math.round(scene.duration / 60)} min</span>
                    </span>
                  )}
                  {scene.rating && (
                    <span className="flex items-center gap-2 text-gray-300 bg-gray-800 bg-opacity-50 px-3 py-2 rounded-lg">
                      <span>⭐</span>
                      <span>{scene.rating}/5</span>
                    </span>
                  )}
                </div>
              </div>

              </div>

              {/* Description */}
              {scene.details && (
                <div className="bg-gray-800 bg-opacity-50 rounded-xl p-5 border border-gray-700">
                  <p className="text-base text-gray-300 leading-relaxed">{scene.details}</p>
                </div>
              )}

              {/* File Path */}
              {scene.path && (
                <div className="bg-gray-800 bg-opacity-50 rounded-xl p-5 border border-gray-700">
                  <div className="flex items-start gap-3">
                    <span className="text-gray-400 text-lg flex-shrink-0 mt-1">📁</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-2">File Location</p>
                      <p className="text-sm text-gray-300 font-mono break-all">{scene.path}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Details */}
              {(scene.resolution || scene.codec || scene.fileSize) && (
                <div className="bg-gray-800 bg-opacity-50 rounded-xl p-5 border border-gray-700">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3">Technical Details</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {scene.resolution && (
                      <div>
                        <span className="text-gray-500">Resolution:</span>
                        <span className="text-white ml-2">{scene.resolution}</span>
                      </div>
                    )}
                    {scene.codec && (
                      <div>
                        <span className="text-gray-500">Codec:</span>
                        <span className="text-white ml-2">{scene.codec}</span>
                      </div>
                    )}
                    {scene.fileSize && (
                      <div>
                        <span className="text-gray-500">Size:</span>
                        <span className="text-white ml-2">{(scene.fileSize / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                      </div>
                    )}
                    {scene.frameRate && (
                      <div>
                        <span className="text-gray-500">FPS:</span>
                        <span className="text-white ml-2">{scene.frameRate.toFixed(2)}</span>
                      </div>
                    )}
                    {scene.width && scene.height && (
                      <div>
                        <span className="text-gray-500">Dimensions:</span>
                        <span className="text-white ml-2">{scene.width}x{scene.height}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={handleDeleteScene}
                  disabled={isDeleting}
                  className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center justify-center gap-2 text-lg font-semibold"
                >
                  <span>{isDeleting ? '⏳' : '🗑️'}</span>
                  <span>{isDeleting ? 'Deleting...' : 'Delete Scene'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Performers Section - Full Width Below */}
          {scene.performers && scene.performers.length > 0 && (
            <div className="mt-8 bg-gray-800 bg-opacity-50 rounded-xl p-6 border border-gray-700">
              <h4 className="text-lg font-semibold text-gray-300 uppercase mb-4">Performers</h4>
              <div className="flex flex-wrap gap-3">
                {scene.performers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPerformerId(p.id);
                      setSceneDate(scene.date);
                    }}
                    className="flex items-center gap-3 px-4 py-3 bg-gray-700 bg-opacity-50 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer border border-gray-600"
                  >
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-12 h-12 rounded-full object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className="text-white text-base font-medium">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags Section - Full Width Below */}
          <div className="mt-8 bg-gray-800 bg-opacity-50 rounded-xl p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-300 uppercase">
                Tags {!loadingTags && scene.tags && scene.tags.length > 0 && <span className="text-sm text-gray-500 ml-2">(click to add to clip)</span>}
              </h4>
              <button
                onClick={() => setShowTagSelector(true)}
                className="px-4 py-2 bg-blue-600 text-white text-base rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2"
              >
                <span>➕</span>
                <span>Add Tags</span>
              </button>
            </div>
            {loadingTags ? (
              <div className="text-gray-400 text-base py-4">Loading clip tags...</div>
            ) : scene.tags && scene.tags.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {scene.tags
                  .filter(tag => !tag.hasChildren) // Only show leaf tags (no children)
                  .map((tag) => {
                    const isOnClip = clipTags.includes(tag.id);
                    const isAdding = addingTag === tag.id;
                    
                    return (
                      <button
                        key={tag.id}
                        onClick={() => handleTagClick(tag.id)}
                        disabled={isOnClip || isAdding}
                        className={`px-4 py-2 text-base rounded-lg transition-all ${
                          isOnClip
                            ? 'bg-green-900 text-green-200 cursor-default'
                            : isAdding
                            ? 'bg-yellow-900 text-yellow-200 cursor-wait opacity-75'
                            : 'bg-blue-900 text-blue-200 hover:bg-blue-800 cursor-pointer'
                        }`}
                        title={isOnClip ? `${tag.name} - Already on clip` : isAdding ? 'Adding...' : `${tag.description || tag.name} - Click to add to clip`}
                      >
                        {tag.name}
                        {isOnClip && ' ✓'}
                        {isAdding && ' ⏳'}
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="text-gray-400 text-base py-4">No tags on scene yet. Click "Add Tags" to add some!</div>
            )}
          </div>
        </div>
      </div>

      {/* Performer Detail Overlay (nested on top) */}
      {selectedPerformerId && (
        <StashPerformerOverlay
          performerId={selectedPerformerId}
          sceneDate={sceneDate}
          clipId={clipId}
          onClose={() => {
            setSelectedPerformerId(null);
            setSceneDate(null);
          }}
        />
      )}

      {/* Tag Selector Modal (on top of everything) */}
      {showTagSelector && (
        <StashClipTagSelector
          clipId={clipId}
          onClose={() => setShowTagSelector(false)}
          onTagsAdded={handleTagsAdded}
        />
      )}

      {/* Studio Selector Modal */}
      {showStudioSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
          <div className="bg-gray-900 rounded-lg shadow-2xl max-w-2xl w-full border border-gray-700">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Select Studio</h3>
              <button
                onClick={() => {
                  setShowStudioSelector(false);
                  setStudioSearchQuery('');
                  setStudios([]);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Search Input */}
            <div className="p-4">
              <input
                type="text"
                placeholder="Search for a studio..."
                value={studioSearchQuery}
                onChange={(e) => setStudioSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto p-4 space-y-2">
              {loadingStudios ? (
                <div className="text-center text-gray-400 py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <p className="mt-2">Loading studios...</p>
                </div>
              ) : (() => {
                // Filter studios by search query
                const filteredStudios = studioSearchQuery
                  ? studios.filter(studio => 
                      studio.name.toLowerCase().includes(studioSearchQuery.toLowerCase())
                    )
                  : studios;
                
                if (filteredStudios.length === 0) {
                  return (
                    <div className="text-center text-gray-400 py-8">
                      {studioSearchQuery ? `No studios found matching "${studioSearchQuery}"` : 'No studios available'}
                    </div>
                  );
                }
                
                return filteredStudios.map((studio) => (
                  <button
                    key={studio.id}
                    onClick={() => handleStudioSelect(studio)}
                    disabled={updatingStudio}
                    className="w-full flex items-center gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    {studio.image && (
                      <img
                        src={studio.image}
                        alt={studio.name}
                        className="w-12 h-12 rounded object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-semibold text-white">{studio.name}</div>
                      {studio.url && (
                        <div className="text-sm text-gray-400">{studio.url}</div>
                      )}
                      {studio.scene_count !== undefined && (
                        <div className="text-xs text-gray-500">{studio.scene_count} scenes</div>
                      )}
                    </div>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

StashClipOverlay.propTypes = {
  clipData: PropTypes.shape({
    clipId: PropTypes.number,
    scene: PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string,
      details: PropTypes.string,
      date: PropTypes.string,
      rating: PropTypes.number,
      duration: PropTypes.number,
      path: PropTypes.string,
      resolution: PropTypes.string,
      codec: PropTypes.string,
      fileSize: PropTypes.number,
      frameRate: PropTypes.number,
      width: PropTypes.number,
      height: PropTypes.number,
      studio: PropTypes.shape({
        id: PropTypes.string,
        name: PropTypes.string,
        image: PropTypes.string,
      }),
      performers: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          image: PropTypes.string,
        })
      ),
      tags: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.string,
          name: PropTypes.string,
          description: PropTypes.string,
        })
      ),
    }),
  }),
  onClose: PropTypes.func.isRequired,
};

export default StashClipOverlay;
