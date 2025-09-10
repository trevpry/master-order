import React from 'react';
import { formatDuration, formatTime } from '../../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../../utils/stashUtils';

const StashContentRenderers = ({
  data,
  setSelectedScene,
  setSelectedPerformer,
  setDeleteSceneId,
  setVideoPlayer,
  setAutoSkipRetries
}) => {
  const renderScenes = () => {
    const scenes = data.scenes || [];
    
    return (
      <div className="content-grid scenes-grid">
        {scenes.map((scene) => (
          <div key={scene.id} className="content-card scene-card">
            <div className="scene-image">
              <img
                src={getSceneImageUrl(scene)}
                alt={getSceneDisplayTitle(scene)}
                onError={(e) => {
                  e.target.src = '/placeholder-scene.jpg';
                }}
              />
              <div className="duration-badge">
                {formatDuration(scene.duration)}
              </div>
              {scene.o_counter > 0 && (
                <div className="play-count-badge">
                  ▶️ {scene.o_counter}
                </div>
              )}
            </div>
            
            <div className="content-card-body">
              <h3 className="content-title">{getSceneDisplayTitle(scene)}</h3>
              
              <div className="content-meta">
                {scene.date && (
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span>{formatDate(scene.date)}</span>
                  </div>
                )}
                
                {scene.studio && (
                  <div className="meta-item">
                    <span className="meta-icon">🏢</span>
                    <span>
                      {typeof scene.studio === 'string' 
                        ? scene.studio 
                        : scene.studio.name || scene.studio
                      }
                    </span>
                  </div>
                )}
                
                {scene.performers && scene.performers.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">👤</span>
                    <span>
                      {scene.performers.map(p => {
                        if (typeof p === 'string') return p;
                        if (p.performer) return p.performer.name;
                        return p.name || p;
                      }).slice(0, 3).join(', ')}
                      {scene.performers.length > 3 && ` +${scene.performers.length - 3} more`}
                    </span>
                  </div>
                )}
                
                {scene.rating && (
                  <div className="meta-item">
                    <span className="meta-icon">⭐</span>
                    <span>{scene.rating}/100</span>
                  </div>
                )}
              </div>
              
              <div className="card-actions">
                <button 
                  className="action-btn play-btn"
                  onClick={() => setSelectedScene(scene)}
                  title="Play Scene"
                >
                  ▶️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPerformers = () => {
    const performers = data.performers || [];
    
    return (
      <div className="content-grid performers-grid">
        {performers.map((performer) => (
          <div key={performer.id} className="content-card performer-card">
            <div className="performer-image">
              {performer.image ? (
                <img
                  src={performer.image}
                  alt={performer.name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="performer-placeholder">
                  <span>👤</span>
                </div>
              )}
              {performer.image && (
                <div className="performer-placeholder" style={{display: 'none'}}>
                  <span>👤</span>
                </div>
              )}
            </div>
            
            <div className="content-card-body">
              <h3 className="content-title">{performer.name}</h3>
              
              <div className="content-meta">
                {performer.birthdate && (
                  <div className="meta-item">
                    <span className="meta-icon">🎂</span>
                    <span>Born: {formatDate(performer.birthdate)}</span>
                  </div>
                )}
                
                {performer.country && (
                  <div className="meta-item">
                    <span className="meta-icon">🌍</span>
                    <span>{performer.country}</span>
                  </div>
                )}
                
                {performer.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{performer.scene_count} scenes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStudios = () => {
    const studios = data.studios || [];
    
    return (
      <div className="content-grid studios-grid">
        {studios.map((studio) => (
          <div key={studio.id} className="content-card studio-card">
            <div className="studio-image">
              {studio.image ? (
                <img
                  src={studio.image}
                  alt={studio.name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextElementSibling.style.display = 'flex';
                  }}
                />
              ) : (
                <div className="studio-placeholder">
                  <span>🏢</span>
                </div>
              )}
              {studio.image && (
                <div className="studio-placeholder" style={{display: 'none'}}>
                  <span>🏢</span>
                </div>
              )}
            </div>
            
            <div className="content-card-body">
              <div className="studio-header">
                <h3 className="content-title">{studio.name}</h3>
              </div>
              
              <div className="content-meta">
                {studio.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{studio.scene_count} scenes</span>
                  </div>
                )}
                
                {studio.url && (
                  <div className="meta-item">
                    <span className="meta-icon">🔗</span>
                    <a href={studio.url} target="_blank" rel="noopener noreferrer">
                      Website
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTags = () => {
    const tags = data.tags || [];
    
    return (
      <div className="content-grid tags-grid">
        {tags.map((tag) => (
          <div key={tag.id} className="content-card tag-card">
            <div className="tag-content">
              <div className="tag-header">
                <h3 className="content-title">{tag.name}</h3>
                {tag.scene_count && (
                  <span className="tag-count">{tag.scene_count}</span>
                )}
              </div>
              
              {tag.description && (
                <p className="tag-description">{tag.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderClips = () => {
    const clips = data.clips || [];
    
    return (
      <div className="content-grid clips-grid">
        {clips.map((clip) => (
          <div key={clip.id} className="content-card clip-card">
            <div className="clip-thumbnail-container">
              <div className="clip-placeholder">
                🎬
              </div>
              <div className="clip-duration-badge">
                {Math.round(clip.duration)}s
              </div>
              <div className={`clip-watch-status ${clip.watched ? 'watched' : 'unwatched'}`}>
                {clip.watched ? '✅' : '⏳'}
              </div>
            </div>
            
            <div className="content-card-body">
              <h3 className="content-title">{clip.scene?.title || 'Unknown Scene'}</h3>
              
              <div className="clip-info">
                <div className="clip-timing">
                  {clip.markerBased && clip.title ? (
                    <span className="clip-marker-title">📍 {clip.title}</span>
                  ) : (
                    <span className="clip-index">Clip #{clip.clipIndex + 1}</span>
                  )}
                  <span className="clip-time-range">
                    {formatTime(clip.startTime)} - {formatTime(clip.endTime)}
                  </span>
                </div>
                
                {clip.scene?.performers && clip.scene.performers.length > 0 && (
                  <div className="clip-performers">
                    <span className="meta-icon">👥</span>
                    <span>{clip.scene.performers.map(p => p.performer.name).join(', ')}</span>
                  </div>
                )}
                
                {clip.scene?.studioObject && (
                  <div className="clip-studio">
                    <span className="meta-icon">🏢</span>
                    <span>{clip.scene.studioObject.name}</span>
                  </div>
                )}
              </div>
              
              <div className="clip-actions">
                <button 
                  className="clip-play-btn"
                  onClick={() => {
                    console.log('🎬 Playing clip from content renderer:', clip.title);
                    setVideoPlayer({
                      isOpen: true,
                      clip: clip,
                      scene: clip.scene,
                      playbackInfo: null
                    });
                    setAutoSkipRetries(0);
                  }}
                >
                  ▶️ Play Clip
                </button>
                
                {!clip.watched && (
                  <button 
                    className="clip-mark-watched-btn"
                    onClick={() => {
                      console.log('✅ Marking clip as watched:', clip.id);
                      // This would need an API call to mark the clip as watched
                      // For now, just log it
                    }}
                  >
                    ✅ Mark Watched
                  </button>
                )}
                
                {clip.watched && (
                  <div className="clip-watched-info">
                    <span>✅ Watched</span>
                    {clip.watchedAt && (
                      <span className="clip-watched-date">
                        {new Date(clip.watchedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return {
    renderScenes,
    renderPerformers,
    renderStudios,
    renderTags,
    renderClips
  };
};

export default StashContentRenderers;
