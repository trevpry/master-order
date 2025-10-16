import React from 'react';
import { formatDuration } from '../../../../../utils/timeUtils';
import { getSceneDisplayTitle } from '../../../utils/stashUtils';
import ScenePerformerList from '../../../../../components/stash/ScenePerformerList';

const StashModals = ({
  selectedScene,
  setSelectedScene,
  selectedPerformer,
  setSelectedPerformer,
  deleteSceneId,
  setDeleteSceneId,
  handleDeleteScene,
  connectionStatus
}) => {
  return (
    <>
      {/* Scene Detail Modal */}
      {selectedScene && (
        <div className="modal-overlay" onClick={() => setSelectedScene(null)}>
          <div className="modal-content scene-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🎬 {getSceneDisplayTitle(selectedScene)}</h2>
              <button className="close-btn" onClick={() => setSelectedScene(null)}>❌</button>
            </div>
            <div className="modal-body">
              <div className="scene-details">
                {selectedScene.paths?.screenshot && (
                  <div className="scene-image">
                    <img 
                      src={`${connectionStatus.stashUrl}${selectedScene.paths.screenshot}`}
                      alt={getSceneDisplayTitle(selectedScene)}
                    />
                  </div>
                )}
                <div className="scene-info">
                  <div className="info-row">
                    <span className="label">📅 Date:</span>
                    <span className="value">{selectedScene.date}</span>
                  </div>
                  {selectedScene.details && (
                    <div className="info-row">
                      <span className="label">📝 Details:</span>
                      <span className="value">{selectedScene.details}</span>
                    </div>
                  )}
                  {selectedScene.rating && (
                    <div className="info-row">
                      <span className="label">⭐ Rating:</span>
                      <span className="value">{selectedScene.rating}/5</span>
                    </div>
                  )}
                  
                  {/* Performers Section with Scene-Specific Metadata */}
                  {selectedScene.id && (
                    <div className="info-row performers-section">
                      <span className="label">👥 Performers:</span>
                      <div className="value performers-list-container">
                        <ScenePerformerList 
                          sceneId={selectedScene.id} 
                          editable={true}
                        />
                      </div>
                    </div>
                  )}
                  
                  {selectedScene.studio && (
                    <div className="info-row">
                      <span className="label">🏢 Studio:</span>
                      <span className="value">{selectedScene.studio.name}</span>
                    </div>
                  )}
                  {selectedScene.tags && selectedScene.tags.length > 0 && (
                    <div className="info-row">
                      <span className="label">🏷️ Tags:</span>
                      <span className="value">
                        {selectedScene.tags.map(t => t.name).join(', ')}
                      </span>
                    </div>
                  )}
                  {selectedScene.file?.duration && (
                    <div className="info-row">
                      <span className="label">⏱️ Duration:</span>
                      <span className="value">{formatDuration(selectedScene.file.duration)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performer Images Modal */}
      {selectedPerformer && (
        <div className="modal-overlay" onClick={() => setSelectedPerformer(null)}>
          <div className="modal-content performer-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>� {selectedPerformer.name}</h2>
              <button className="close-btn" onClick={() => setSelectedPerformer(null)}>❌</button>
            </div>
            <div className="modal-body">
              <div className="performer-images">
                {selectedPerformer.images && selectedPerformer.images.length > 0 ? (
                  <div className="images-grid">
                    {selectedPerformer.images.map((image, index) => (
                      <div key={index} className="image-item">
                        <img 
                          src={`${connectionStatus.stashUrl}${image.url}`}
                          alt={`${selectedPerformer.name} ${index + 1}`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>No images available for this performer.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteSceneId && (
        <div className="modal-overlay">
          <div className="modal-content delete-modal">
            <div className="modal-header">
              <h2>⚠️ Confirm Delete</h2>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this scene? This action cannot be undone.</p>
              <div className="modal-actions">
                <button 
                  onClick={() => handleDeleteScene(deleteSceneId)}
                  className="delete-btn"
                >
                  🗑️ Delete
                </button>
                <button 
                  onClick={() => setDeleteSceneId(null)}
                  className="cancel-btn"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StashModals;
