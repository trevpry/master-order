import React from 'react';
import { Link } from 'react-router-dom';
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
                      {scene.performers.slice(0, 3).map((p, idx) => {
                        const id = p?.performer?.id || p?.performerId || p?.id;
                        const name = (typeof p === 'string') ? p : (p?.performer?.name || p?.name || p);
                        const tags = p?.tags || [];
                        
                        // Build display with tags
                        const tagElements = tags.length > 0 ? (
                          <span className="performer-tags" title={tags.map(t => t.tag.name).join(', ')}>
                            ({tags.length} tag{tags.length !== 1 ? 's' : ''})
                          </span>
                        ) : null;
                        
                        const content = id ? (
                          <span key={id} className="performer-with-metadata">
                            <Link to={`/media/stash/performer/${id}`}>
                              {name}
                            </Link>
                            {tagElements}
                          </span>
                        ) : (
                          <span key={idx}>{name}</span>
                        );
                        return (
                          <React.Fragment key={id || idx}>
                            {idx > 0 && ', '}
                            {content}
                          </React.Fragment>
                        );
                      })}
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
          <Link key={performer.id} to={`/media/stash/performer/${performer.id}`} className="content-card performer-card" style={{ textDecoration: 'none', color: 'inherit' }}>
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
          </Link>
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
    const [expandedTags, setExpandedTags] = React.useState(new Set());
    
    const toggleTag = (tagId) => {
      setExpandedTags(prev => {
        const newSet = new Set(prev);
        if (newSet.has(tagId)) {
          newSet.delete(tagId);
        } else {
          newSet.add(tagId);
        }
        return newSet;
      });
    };
    
    const renderTagCard = (tag, level = 0, parentExpanded = true) => {
      if (!parentExpanded && level > 0) return null;
      
      const isExpanded = expandedTags.has(tag.id);
      const hasChildren = tag.children && tag.children.length > 0;
      
      return (
        <React.Fragment key={tag.id}>
          <div 
            className={`content-card tag-card-enhanced ${tag.favorite ? 'favorite-tag' : ''}`}
            style={{ marginLeft: `${level * 1.5}rem` }}
          >
            {/* Tag Image/Icon */}
            <div className="tag-visual">
              {tag.image ? (
                <img 
                  src={tag.image} 
                  alt={tag.name}
                  className="tag-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'flex';
                  }}
                />
              ) : null}
              <div 
                className="tag-icon-fallback" 
                style={{ display: tag.image ? 'none' : 'flex' }}
              >
                🏷️
              </div>
              
              {/* Favorite Badge */}
              {tag.favorite && (
                <div className="tag-favorite-badge" title="Favorite Tag">
                  ⭐
                </div>
              )}
            </div>

            {/* Tag Content */}
            <div className="tag-content-enhanced">
              {/* Header with Name, Counts, and Expand Button */}
              <div className="tag-header-enhanced">
                <div className="tag-name-row">
                  <h3 className="tag-name" title={tag.name}>{tag.name}</h3>
                  {hasChildren && (
                    <button 
                      className="tag-expand-button"
                      onClick={() => toggleTag(tag.id)}
                      title={isExpanded ? 'Collapse children' : 'Expand children'}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                  )}
                </div>
                <div className="tag-stats">
                  {tag.scene_count > 0 && (
                    <span className="stat-badge scene-badge" title="Scenes">
                      🎬 {tag.scene_count}
                    </span>
                  )}
                  {tag.performer_count > 0 && (
                    <span className="stat-badge performer-badge" title="Performers">
                      👤 {tag.performer_count}
                    </span>
                  )}
                  {hasChildren && (
                    <span className="stat-badge children-badge" title="Child Tags">
                      📂 {tag.child_count}
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              {tag.description && (
                <p className="tag-description-enhanced" title={tag.description}>
                  {tag.description}
                </p>
              )}

              {/* Aliases */}
              {tag.aliases && tag.aliases.length > 0 && (
                <div className="tag-aliases">
                  <span className="aliases-label">Aliases:</span>
                  <div className="aliases-list">
                    {tag.aliases.slice(0, 3).map((alias, idx) => (
                      <span key={idx} className="alias-chip" title={alias}>
                        {alias}
                      </span>
                    ))}
                    {tag.aliases.length > 3 && (
                      <span className="alias-chip more" title={`+${tag.aliases.length - 3} more`}>
                        +{tag.aliases.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Render children if expanded */}
          {hasChildren && isExpanded && (
            <div className="tag-children-container">
              {tag.children.map(child => renderTagCard(child, level + 1, true))}
            </div>
          )}
        </React.Fragment>
      );
    };
    
    return (
      <div className="content-grid tags-grid-hierarchical">
        {tags.map((tag) => renderTagCard(tag, 0, true))}
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
                
                {clip.tags && clip.tags.length > 0 && (
                  <div className="clip-tags">
                    <span className="meta-icon">🏷️</span>
                    <div className="clip-tag-list">
                      {clip.tags.slice(0, 5).map(tagRelation => (
                        <span 
                          key={tagRelation.tag.id} 
                          className={`clip-tag-badge ${tagRelation.tag.favorite ? 'favorite' : ''}`}
                          title={tagRelation.tag.name}
                          style={{
                            backgroundColor: '#ffffff',
                            color: '#000000',
                            border: '2px solid #000000',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '14px',
                            fontWeight: '900',
                            textShadow: 'none',
                            fontFamily: 'system-ui, -apple-system, sans-serif'
                          }}
                        >
                          {tagRelation.tag.name}
                        </span>
                      ))}
                      {clip.tags.length > 5 && (
                        <span className="clip-tag-more">+{clip.tags.length - 5} more</span>
                      )}
                    </div>
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
