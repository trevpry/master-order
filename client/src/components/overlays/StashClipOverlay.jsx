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
  
  if (!clipData) return null;

  const { scene, clipId } = clipData;
  
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>📱</span>
            <span>Android Playing Clip</span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close overlay"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Scene Artwork */}
          <div className="relative w-full aspect-video bg-gray-800 rounded-lg overflow-hidden">
            <img
              src={sceneImageUrl}
              alt={scene.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIyNCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2UgQXZhaWxhYmxlPC90ZXh0Pjwvc3ZnPg==';
              }}
            />
          </div>

          {/* Title & Basic Info */}
          <div>
            <h3 className="text-2xl font-semibold text-white mb-2">{scene.title}</h3>
            <div className="flex flex-wrap gap-3 text-sm">
              {scene.studio && (
                <span className="flex items-center gap-1 text-gray-300">
                  <span>🎬</span>
                  <span>{scene.studio.name}</span>
                </span>
              )}
              {scene.date && (
                <span className="flex items-center gap-1 text-gray-300">
                  <span>📅</span>
                  <span>{scene.date}</span>
                </span>
              )}
              {scene.duration && (
                <span className="flex items-center gap-1 text-gray-300">
                  <span>⏱️</span>
                  <span>{Math.round(scene.duration / 60)} min</span>
                </span>
              )}
              {scene.rating && (
                <span className="flex items-center gap-1 text-gray-300">
                  <span>⭐</span>
                  <span>{scene.rating}/5</span>
                </span>
              )}
            </div>
          </div>

          {/* Description */}
          {scene.details && (
            <div className="bg-gray-800 rounded-lg p-4">
              <p className="text-sm text-gray-300 leading-relaxed">{scene.details}</p>
            </div>
          )}

          {/* Performers */}
          {scene.performers && scene.performers.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3">Performers</h4>
              <div className="flex flex-wrap gap-2">
                {scene.performers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPerformerId(p.id);
                      setSceneDate(scene.date);
                    }}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors cursor-pointer"
                  >
                    {p.image && (
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-8 h-8 rounded-full object-cover"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <span className="text-white text-sm">{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-300 uppercase">
                Tags {!loadingTags && scene.tags && scene.tags.length > 0 && <span className="text-xs text-gray-500">(click to add to clip)</span>}
              </h4>
              <button
                onClick={() => setShowTagSelector(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-1"
              >
                <span>➕</span>
                <span>Add Tags</span>
              </button>
            </div>
            {loadingTags ? (
              <div className="text-gray-400 text-sm">Loading clip tags...</div>
            ) : scene.tags && scene.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
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
                        className={`px-3 py-1 text-sm rounded-full transition-all ${
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
              <div className="text-gray-400 text-sm">No tags on scene yet. Click "Add Tags" to add some!</div>
            )}
          </div>

          {/* Technical Details */}
          {(scene.resolution || scene.codec || scene.fileSize) && (
            <div className="bg-gray-800 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-300 uppercase mb-2">Technical Details</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            Dismiss
          </button>
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
