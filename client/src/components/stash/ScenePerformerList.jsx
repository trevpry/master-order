import React, { useState, useEffect } from 'react';
import config from '../../config';
import toast from 'react-hot-toast';
import ScenePerformerMetadataModal from './ScenePerformerMetadataModal';

/**
 * Reusable component for displaying and managing performers in a scene
 * Shows performer list with scene-specific metadata (character names, roles, etc.)
 */
const ScenePerformerList = ({ sceneId, editable = false, onPerformersChange }) => {
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPerformer, setEditingPerformer] = useState(null);
  const [showMetadataModal, setShowMetadataModal] = useState(false);

  useEffect(() => {
    if (sceneId) {
      loadPerformers();
    }
  }, [sceneId]);

  const loadPerformers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers`
      );

      if (!response.ok) {
        throw new Error('Failed to load performers');
      }

      const result = await response.json();
      setPerformers(result.data || []);
    } catch (error) {
      console.error('Error loading performers:', error);
      toast.error('Failed to load performers');
    } finally {
      setLoading(false);
    }
  };

  const handleEditMetadata = (performer) => {
    setEditingPerformer(performer);
    setShowMetadataModal(true);
  };

  const handleMetadataSaved = (updatedRelationship) => {
    // Update the performer in the list with new metadata
    setPerformers(prev => 
      prev.map(p => 
        p.performerId === updatedRelationship.performerId 
          ? { ...p, ...updatedRelationship }
          : p
      )
    );

    if (onPerformersChange) {
      onPerformersChange(performers);
    }
  };

  const handleRemovePerformer = async (performerId) => {
    if (!confirm('Remove this performer from the scene?')) {
      return;
    }

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers/${performerId}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        throw new Error('Failed to remove performer');
      }

      setPerformers(prev => prev.filter(p => p.performerId !== performerId));
      toast.success('Performer removed from scene');

      if (onPerformersChange) {
        onPerformersChange(performers.filter(p => p.performerId !== performerId));
      }
    } catch (error) {
      console.error('Error removing performer:', error);
      toast.error('Failed to remove performer');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (performers.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No performers in this scene</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {performers.map((relationship) => {
          const performer = relationship.performer;
          const hasMetadata = relationship.tags?.length > 0 || relationship.notes;

          return (
            <div
              key={relationship.performerId}
              className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-start space-x-4">
                {/* Performer Image */}
                {performer.image && (
                  <img
                    src={performer.image}
                    alt={performer.name}
                    className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  />
                )}

                {/* Performer Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="text-white font-medium truncate">
                        {performer.name}
                      </h4>
                      {performer.disambiguation && (
                        <p className="text-xs text-gray-400">
                          ({performer.disambiguation})
                        </p>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {editable && (
                      <div className="flex space-x-2 ml-2">
                        <button
                          onClick={() => handleEditMetadata(relationship)}
                          className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
                          title="Edit metadata"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleRemovePerformer(relationship.performerId)}
                          className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded transition-colors"
                          title="Remove from scene"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Scene-Specific Metadata */}
                  {hasMetadata && (
                    <div className="mt-2 space-y-2">
                      {/* Body Attribute Tags */}
                      {relationship.tags && relationship.tags.length > 0 && (
                        <div>
                          <span className="text-xs text-gray-400 block mb-1">Body Attributes:</span>
                          <div className="flex flex-wrap gap-1">
                            {relationship.tags.map(({ tag }) => (
                              <span
                                key={tag.id}
                                className="px-2 py-0.5 text-xs font-medium text-white bg-blue-600 rounded"
                                title={tag.description || tag.name}
                              >
                                {tag.name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {relationship.notes && (
                        <div className="text-sm">
                          <span className="text-gray-400 block mb-1">Notes:</span>
                          <p className="text-gray-300 italic">{relationship.notes}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* No Metadata Message */}
                  {!hasMetadata && editable && (
                    <button
                      onClick={() => handleEditMetadata(relationship)}
                      className="mt-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                    >
                      + Add scene-specific details
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metadata Edit Modal */}
      {showMetadataModal && editingPerformer && (
        <ScenePerformerMetadataModal
          isOpen={showMetadataModal}
          onClose={() => {
            setShowMetadataModal(false);
            setEditingPerformer(null);
          }}
          sceneId={sceneId}
          performer={editingPerformer.performer}
          existingMetadata={{
            notes: editingPerformer.notes || '',
            tagIds: editingPerformer.tags?.map(t => t.tag.id) || []
          }}
          onSave={handleMetadataSaved}
        />
      )}
    </>
  );
};

export default ScenePerformerList;
