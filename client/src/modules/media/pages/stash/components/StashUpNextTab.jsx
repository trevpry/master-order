import React from 'react';
import Button from '../../../../../shared/components/Button';
import { formatDuration } from '../../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../../utils/stashUtils';

const StashUpNextTab = ({
  data,
  pagination,
  setVideoPlayer,
  slideshow,
  setSlideshow,
  mixedMode,
  setMixedMode,
  setAutoSkipRetries,
  selectedScene,
  setSelectedScene,
  handleGetUpNext,
  handleClipPlay,
  startSlideshow,
  startMixedMode,
  stopMixedMode,
  handleMarkStashWatched,
  handlePlayScene,
  handlePauseScene,
  handleDeleteStashScene,
  upNextLoading,
  markingWatched,
  deletingScene,
  connectionStatus
}) => {
  return (
    <div className="up-next-content">
      <div className="up-next-hero">
        <div className="stash-controls">
          <Button
            onClick={handleGetUpNext}
            disabled={upNextLoading || !connectionStatus.connected}
            className={`up-next-main-button ${upNextLoading ? 'loading' : ''}`}
          >
            {upNextLoading ? '🎲 Getting...' : '🎲 Next Stash'}
          </Button>

          <Button
            onClick={handleClipPlay}
            disabled={upNextLoading || !connectionStatus.connected}
            className={`clip-play-button ${upNextLoading ? 'loading' : ''}`}
            style={{
              backgroundColor: '#e74c3c',
              color: '#fff',
              marginLeft: '10px'
            }}
          >
            {upNextLoading ? '🎬 Loading...' : '🎬 Clip Play'}
          </Button>

          <Button
            onClick={startSlideshow}
            disabled={slideshow.isLoading || !connectionStatus.connected}
            className={`slideshow-button ${slideshow.isLoading ? 'loading' : ''}`}
            style={{
              backgroundColor: '#9b59b6',
              color: '#fff',
              marginLeft: '10px'
            }}
          >
            {slideshow.isLoading ? '🖼️ Loading...' : '🖼️ Slideshow'}
          </Button>

          <Button
            onClick={mixedMode.isActive ? stopMixedMode : startMixedMode}
            disabled={mixedMode.isLoading || !connectionStatus.connected}
            className={`mixed-mode-button ${mixedMode.isLoading ? 'loading' : ''} ${mixedMode.isActive ? 'active' : ''}`}
            style={{
              backgroundColor: mixedMode.isActive ? '#e67e22' : '#34495e',
              color: '#fff',
              marginLeft: '10px'
            }}
          >
            {mixedMode.isLoading ? '🎭 Loading...' : mixedMode.isActive ? '🛑 Stop Mixed' : '🎭 Clips + Slideshow'}
          </Button>

          {/* Mixed Mode Status */}
          {mixedMode.isActive && (
            <div className="mixed-mode-status" style={{
              marginTop: '15px',
              padding: '10px 15px',
              backgroundColor: '#e67e22',
              color: 'white',
              borderRadius: '8px',
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>🎭</span>
              <span>Mixed Mode Active</span>
              <span style={{ opacity: 0.8 }}>
                {mixedMode.currentType === 'clip' ? '(Currently: 🎬 Clip)' :
                 mixedMode.currentType === 'slideshow' ? '(Currently: 🖼️ Slideshow)' :
                 '(Selecting next...)'}
              </span>
            </div>
          )}

          {selectedScene && (
            <>
              {/* Scene Title */}
              <h3 className="selected-scene-title">
                {getSceneDisplayTitle(selectedScene)}
                {selectedScene.clipInfo && (
                  <span className="clip-info">
                    <br />
                    <small style={{ color: selectedScene.clipInfo.mixedMode ? '#e67e22' : '#e74c3c', fontWeight: 'normal' }}>
                      {selectedScene.clipInfo.mixedMode ? '🎭 Mixed Mode • ' : ''}
                      🎬 Clip {selectedScene.clipInfo.clipIndex} •
                      {Math.floor(selectedScene.clipInfo.startTime / 60)}:{String(Math.floor(selectedScene.clipInfo.startTime % 60)).padStart(2, '0')} -
                      {Math.floor(selectedScene.clipInfo.endTime / 60)}:{String(Math.floor(selectedScene.clipInfo.endTime % 60)).padStart(2, '0')} •
                      {selectedScene.clipInfo.duration}s •
                      {selectedScene.clipInfo.unwatchedClipsRemaining} clips left
                    </small>
                  </span>
                )}
              </h3>

              {/* Action Buttons */}
              <div className="stash-action-buttons">
                <Button
                  onClick={() => handleMarkStashWatched(selectedScene)}
                  disabled={markingWatched}
                  style={{
                    backgroundColor: '#28a745',
                    color: '#fff',
                    minWidth: '40px',
                    padding: '8px 12px'
                  }}
                  title="Mark as Watched"
                >
                  {markingWatched ? '⏳' : '✓'}
                </Button>

                <Button
                  onClick={() => handlePlayScene(selectedScene)}
                  disabled={!connectionStatus.stashUrl}
                  style={{
                    backgroundColor: '#e5a00d',
                    color: '#000',
                    minWidth: '40px',
                    padding: '8px 12px'
                  }}
                  title="Play Scene"
                >
                  ▶️
                </Button>

                <Button
                  onClick={() => handlePauseScene(selectedScene)}
                  disabled={!connectionStatus.stashUrl}
                  style={{
                    backgroundColor: '#f39c12',
                    color: '#fff',
                    minWidth: '40px',
                    padding: '8px 12px'
                  }}
                  title="Pause Scene"
                >
                  ⏸️
                </Button>

                <Button
                  onClick={() => handleDeleteStashScene(selectedScene)}
                  disabled={deletingScene || !selectedScene}
                  style={{
                    backgroundColor: '#dc3545',
                    color: '#fff',
                    minWidth: '40px',
                    padding: '8px 12px'
                  }}
                  title="Delete Scene (keeps video file)"
                >
                  {deletingScene ? '⏳' : '🗑️'}
                </Button>
              </div>

              {/* Scene Image */}
              {selectedScene && (
                <div className="selected-scene-image">
                  <img
                    src={getSceneImageUrl(selectedScene)}
                    alt={getSceneDisplayTitle(selectedScene)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                  <div className="duration-badge">
                    {formatDuration(selectedScene.duration)}
                  </div>
                </div>
              )}

              {/* Scene Metadata Card */}
              {selectedScene && (
                <div className="scene-metadata-card">
                  <div className="scene-meta">
                    {selectedScene.date && (
                      <div className="meta-item">
                        <span className="meta-icon">📅</span>
                        <span>{formatDate(selectedScene.date)}</span>
                      </div>
                    )}

                    {selectedScene.studio && (
                      <div className="meta-item">
                        <span className="meta-icon">🏢</span>
                        <span>
                          {typeof selectedScene.studio === 'string'
                            ? selectedScene.studio
                            : selectedScene.studio.name || selectedScene.studio
                          }
                        </span>
                      </div>
                    )}

                    {selectedScene.performers && selectedScene.performers.length > 0 && (
                      <div className="meta-item">
                        <span className="meta-icon">�</span>
                        <span>
                          {selectedScene.performers.map(p => {
                            if (typeof p === 'string') return p;
                            return p.performer?.name || p.name || `Performer ${p.performerId || p.id}` || 'Unknown Performer';
                          }).join(', ')}
                        </span>
                      </div>
                    )}

                    {selectedScene.rating && (
                      <div className="meta-item">
                        <span className="meta-icon">⭐</span>
                        <span>{selectedScene.rating}/5</span>
                      </div>
                    )}

                    {selectedScene.playCount > 0 && (
                      <div className="meta-item">
                        <span className="meta-icon">▶️</span>
                        <span>
                          Played {selectedScene.playCount} time{selectedScene.playCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}

                    {selectedScene.lastPlayedAt && (
                      <div className="meta-item">
                        <span className="meta-icon">🕒</span>
                        <span>
                          Last: {formatDate(selectedScene.lastPlayedAt)}
                        </span>
                      </div>
                    )}

                    {selectedScene.tags && selectedScene.tags.length > 0 && (
                      <div className="meta-item">
                        <span className="meta-icon">🏷️</span>
                        <span>
                          {selectedScene.tags.slice(0, 3).map(t => {
                            if (typeof t === 'string') return t;
                            return t.tag?.name || t.name || `Tag ${t.tagId || t.id}` || 'Unknown Tag';
                          }).join(', ')}
                          {selectedScene.tags.length > 3 && ` +${selectedScene.tags.length - 3}`}
                        </span>
                      </div>
                    )}

                    {selectedScene.duration && (
                      <div className="meta-item">
                        <span className="meta-icon">⏱️</span>
                        <span>{formatDuration(selectedScene.duration)}</span>
                      </div>
                    )}

                    {selectedScene.details && (
                      <div className="meta-item">
                        <span className="meta-icon">📝</span>
                        <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>  
                          {selectedScene.details}
                        </span>
                      </div>
                    )}

                    {selectedScene.url && (
                      <div className="meta-item">
                        <span className="meta-icon">🔗</span>
                        <a href={selectedScene.url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', textDecoration: 'none' }}>
                          View on External Site
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StashUpNextTab;
