/**
 * StashPerformerOverlay Component
 * Displays detailed performer information in a modal overlay.
 * Can be triggered from any component that has performer data.
 * Supports tagging performers in specific clips (clip-performer-tag relationship).
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import config from '../../config';

const StashPerformerOverlay = ({ performerId, sceneDate, clipId, onClose }) => {
  const [performer, setPerformer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clipPerformerTags, setClipPerformerTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [addingTag, setAddingTag] = useState(null);

  useEffect(() => {
    if (!performerId) return;

    const fetchPerformerDetails = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${config.apiBaseUrl}/api/android/stash/performer/${performerId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch performer details: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.type === 'STASH_PERFORMER_DETAIL' && data.data) {
          setPerformer(data.data);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching performer details:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformerDetails();
  }, [performerId]);

  // Fetch clip-performer tags if clipId is provided
  useEffect(() => {
    if (!clipId || !performerId) {
      setClipPerformerTags([]);
      return;
    }

    const fetchClipPerformerTags = async () => {
      try {
        setLoadingTags(true);
        const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/performer/${performerId}/tags`;
        console.log('🏷️ Fetching clip-performer tags from:', url);

        const response = await fetch(url);
        console.log('Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('Clip-performer tags data:', data);
          
          // Extract tag IDs from the response
          const tagIds = data.tags?.map(tag => tag.id) || [];
          setClipPerformerTags(tagIds);
          console.log('Extracted tag IDs:', tagIds);
        } else {
          console.log('Failed to fetch clip-performer tags:', response.status);
          setClipPerformerTags([]);
        }
      } catch (error) {
        console.error('Error fetching clip-performer tags:', error);
        setClipPerformerTags([]);
      } finally {
        setLoadingTags(false);
      }
    };

    fetchClipPerformerTags();
  }, [clipId, performerId]);

  // Handle tag click to add tag to clip-performer combination
  const handleTagClick = async (tagId, tagName) => {
    if (!clipId) {
      toast.error('Clip ID not available. Tags can only be added when viewing a specific clip.');
      return;
    }

    const isTagOnClipPerformer = clipPerformerTags.includes(tagId);
    
    if (isTagOnClipPerformer) {
      console.log('Tag already on this clip-performer combination:', tagId);
      toast('Tag already added to this performer in this clip', { icon: 'ℹ️' });
      return;
    }
    
    try {
      setAddingTag(tagId);
      console.log(`Adding tag ${tagId} to clip ${clipId} performer ${performerId}`);
      
      const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/performer/${performerId}/tags`;
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
      
      if (response.ok) {
        // Update local state
        setClipPerformerTags(prev => [...prev, tagId]);
        toast.success(`✅ Added "${tagName}" to performer in this clip`);
      } else {
        toast.error(responseData.error || 'Failed to add tag');
      }
    } catch (error) {
      console.error('Error adding tag to clip-performer:', error);
      toast.error('Failed to add tag to performer in clip');
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

  if (!performerId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>👤</span>
            <span>Performer Details</span>
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
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-400">Loading performer details...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-lg p-4">
              <p className="text-red-400">Error: {error}</p>
            </div>
          )}

          {!loading && !error && performer && (
            <div className="space-y-6">
              {/* Performer Header with Image */}
              <div className="flex flex-col sm:flex-row gap-6">
                {/* Profile Image - Full Size */}
                {performer.image && (
                  <div className="flex-shrink-0 mx-auto sm:mx-0">
                    <img
                      src={performer.image}
                      alt={performer.name}
                      className="w-full sm:w-80 rounded-lg border-2 border-gray-700 object-cover"
                      onError={(e) => {
                        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzY2NiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+PC9zdmc+';
                      }}
                    />
                  </div>
                )}

                {/* Basic Info */}
                <div className="flex-grow space-y-3">
                  <h3 className="text-3xl font-bold text-white">{performer.name}</h3>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {performer.birthdate && (
                      <div>
                        <span className="text-gray-500">Age:</span>
                        <span className="text-white ml-2">
                          {(() => {
                            const birthDate = new Date(performer.birthdate);
                            const today = new Date();
                            let age = today.getFullYear() - birthDate.getFullYear();
                            const monthDiff = today.getMonth() - birthDate.getMonth();
                            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                              age--;
                            }
                            return age;
                          })()}
                        </span>
                      </div>
                    )}
                    {performer.birthdate && sceneDate && (
                      <div>
                        <span className="text-gray-500">Age at Performance:</span>
                        <span className="text-white ml-2">
                          {(() => {
                            const birthDate = new Date(performer.birthdate);
                            const performanceDate = new Date(sceneDate);
                            let ageAtPerformance = performanceDate.getFullYear() - birthDate.getFullYear();
                            const monthDiff = performanceDate.getMonth() - birthDate.getMonth();
                            if (monthDiff < 0 || (monthDiff === 0 && performanceDate.getDate() < birthDate.getDate())) {
                              ageAtPerformance--;
                            }
                            return ageAtPerformance;
                          })()}
                        </span>
                      </div>
                    )}
                    {performer.country && (
                      <div>
                        <span className="text-gray-500">Country:</span>
                        <span className="text-white ml-2">{performer.country}</span>
                      </div>
                    )}
                    {performer.ethnicity && (
                      <div>
                        <span className="text-gray-500">Ethnicity:</span>
                        <span className="text-white ml-2">{performer.ethnicity}</span>
                      </div>
                    )}
                    {performer.hairColor && (
                      <div>
                        <span className="text-gray-500">Hair Color:</span>
                        <span className="text-white ml-2">{performer.hairColor}</span>
                      </div>
                    )}
                    {performer.eyeColor && (
                      <div>
                        <span className="text-gray-500">Eye Color:</span>
                        <span className="text-white ml-2">{performer.eyeColor}</span>
                      </div>
                    )}
                    {performer.height && (
                      <div>
                        <span className="text-gray-500">Height:</span>
                        <span className="text-white ml-2">
                          {(() => {
                            // Parse height value - might be a string with "cm" suffix or just a number
                            let heightInCm = performer.height;
                            if (typeof heightInCm === 'string') {
                              heightInCm = parseFloat(heightInCm.replace(/[^\d.]/g, ''));
                            }
                            
                            // Validate we have a valid number
                            if (isNaN(heightInCm) || heightInCm <= 0) {
                              return performer.height; // Return original value if invalid
                            }
                            
                            const totalInches = heightInCm / 2.54;
                            const feet = Math.floor(totalInches / 12);
                            const inches = Math.round(totalInches % 12);
                            return `${feet}'${inches}"`;
                          })()}
                        </span>
                      </div>
                    )}
                    {performer.weight && (
                      <div>
                        <span className="text-gray-500">Weight:</span>
                        <span className="text-white ml-2">{performer.weight} kg ({Math.round(performer.weight * 2.20462)} lbs)</span>
                      </div>
                    )}
                    {performer.rating && (
                      <div>
                        <span className="text-gray-500">Rating:</span>
                        <span className="text-white ml-2">⭐ {performer.rating}/5</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Section */}
              {performer.details && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase mb-2">About</h4>
                  <p className="text-gray-300 text-sm leading-relaxed">{performer.details}</p>
                </div>
              )}

              {/* Tags */}
              {performer.tags && performer.tags.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3">
                    Tags {clipId && <span className="text-xs text-gray-500">(Click to add to clip)</span>}
                  </h4>
                  {loadingTags && (
                    <div className="text-xs text-gray-400 mb-2">Loading clip-performer tags...</div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {performer.tags.map((tag) => {
                      const isOnClipPerformer = clipPerformerTags.includes(tag.id);
                      const isAdding = addingTag === tag.id;
                      
                      // Color coding:
                      // Green = already on this clip-performer combination
                      // Blue = available to add (only if clipId provided)
                      // Purple = not clickable (no clipId)
                      const colorClass = isOnClipPerformer
                        ? 'bg-green-700 text-green-100'
                        : clipId
                        ? 'bg-blue-700 text-blue-100 hover:bg-blue-600 cursor-pointer'
                        : 'bg-purple-900 text-purple-200';
                      
                      const opacityClass = isAdding ? 'opacity-50' : '';
                      
                      return (
                        <button
                          key={tag.id}
                          onClick={() => clipId && !isOnClipPerformer && handleTagClick(tag.id, tag.name)}
                          disabled={isAdding || !clipId || isOnClipPerformer}
                          className={`px-3 py-1 text-sm rounded-full transition-colors ${colorClass} ${opacityClass} ${!clipId || isOnClipPerformer ? 'cursor-default' : ''}`}
                          title={
                            isOnClipPerformer
                              ? 'Already added to this performer in this clip'
                              : clipId
                              ? 'Click to add tag to this performer in this clip'
                              : 'Clip ID not available'
                          }
                        >
                          {isAdding ? '...' : tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Images Gallery */}
              {performer.images && performer.images.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3">
                    Gallery ({performer.images.length})
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
                    {performer.images.map((image) => (
                      <div
                        key={image.id}
                        className="aspect-square bg-gray-700 rounded-lg overflow-hidden"
                      >
                        <img
                          src={image.url}
                          alt={`${performer.name} - Image ${image.id}`}
                          className="w-full h-full object-cover hover:scale-110 transition-transform"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Statistics */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-300 uppercase mb-3">Statistics</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="text-2xl font-bold text-blue-400">
                      {performer.scenes?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Scenes</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="text-2xl font-bold text-purple-400">
                      {performer.images?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Images</div>
                  </div>
                  <div className="bg-gray-700 rounded-lg p-3">
                    <div className="text-2xl font-bold text-green-400">
                      {performer.tags?.length || 0}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">Tags</div>
                  </div>
                </div>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

StashPerformerOverlay.propTypes = {
  performerId: PropTypes.string.isRequired,
  sceneDate: PropTypes.string,
  clipId: PropTypes.number,
  onClose: PropTypes.func.isRequired,
};

export default StashPerformerOverlay;
