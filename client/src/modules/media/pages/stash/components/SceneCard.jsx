import React from 'react';
import { Link } from 'react-router-dom';
import { formatDuration } from '../../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../../utils/stashUtils';

const styles = {
  card: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    paddingBottom: '56.25%', // 16:9 aspect ratio
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  durationBadge: {
    position: 'absolute',
    bottom: '0.5rem',
    right: '0.5rem',
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  playCountBadge: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    background: 'rgba(59, 130, 246, 0.9)',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  sceneNumberBadge: {
    position: 'absolute',
    top: '0.5rem',
    left: '0.5rem',
    background: 'rgba(102, 126, 234, 0.95)',
    color: 'white',
    padding: '0.25rem 0.6rem',
    borderRadius: '0.25rem',
    fontSize: '0.85rem',
    fontWeight: '700',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
  },
  checkboxContainer: {
    position: 'absolute',
    bottom: '0.5rem',
    left: '0.5rem',
    zIndex: 10,
  },
  checkbox: {
    width: '1.25rem',
    height: '1.25rem',
    cursor: 'pointer',
  },
  cardBody: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
  },
  title: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#1f2937',
    textDecoration: 'none',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  titleLink: {
    color: 'inherit',
    textDecoration: 'none',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    fontSize: '0.875rem',
  },
  metaItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    color: '#6b7280',
  },
  metaIcon: {
    flexShrink: 0,
    fontSize: '0.875rem',
  },
  performerLink: {
    color: '#3b82f6',
    textDecoration: 'none',
  },
  performerTags: {
    marginLeft: '0.25rem',
    fontSize: '0.75rem',
    color: '#9ca3af',
  },
  actions: {
    marginTop: '0.5rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #e5e7eb',
  },
  playBtn: {
    width: '100%',
    padding: '0.5rem',
    background: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'background 0.2s ease',
  },
  unlinkBtn: {
    width: '100%',
    padding: '0.5rem',
    background: '#ef4444',
    color: 'white',
    border: 'none',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '600',
    transition: 'background 0.2s ease',
    marginTop: '0.5rem',
  },
};

export default function SceneCard({ scene, onSceneClick, sceneNumber = null, onUnlinkClick = null, isSelected = false, onToggleSelect = null }) {
  const handleMouseEnter = (e) => {
    e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    e.currentTarget.style.transform = 'translateY(-2px)';
  };

  const handleMouseLeave = (e) => {
    e.currentTarget.style.boxShadow = 'none';
    e.currentTarget.style.transform = 'translateY(0)';
  };

  const handlePlayBtnHover = (e) => {
    e.currentTarget.style.background = '#2563eb';
  };

  const handlePlayBtnLeave = (e) => {
    e.currentTarget.style.background = '#3b82f6';
  };

  const handleUnlinkBtnHover = (e) => {
    e.currentTarget.style.background = '#dc2626';
  };

  const handleUnlinkBtnLeave = (e) => {
    e.currentTarget.style.background = '#ef4444';
  };

  return (
    <div 
      style={styles.card}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Link to={`/media/stash/scenes/${scene.id}`} style={{ textDecoration: 'none' }}>
        <div style={styles.imageContainer}>
          <img
            src={getSceneImageUrl(scene)}
            alt={getSceneDisplayTitle(scene)}
            style={styles.image}
            onError={(e) => {
              e.target.src = '/placeholder-scene.jpg';
            }}
          />
          {sceneNumber !== null && (
            <div style={styles.sceneNumberBadge}>
              #{sceneNumber}
            </div>
          )}
          <div style={styles.durationBadge}>
            {formatDuration(scene.duration)}
          </div>
          {scene.o_counter > 0 && (
            <div style={styles.playCountBadge}>
              ▶️ {scene.o_counter}
            </div>
          )}
          {onToggleSelect && (
            <div style={styles.checkboxContainer} onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect(scene.id);
            }}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => {}}
                style={styles.checkbox}
              />
            </div>
          )}
        </div>
      </Link>
      
      <div style={styles.cardBody}>
        <Link to={`/media/stash/scenes/${scene.id}`} style={styles.titleLink}>
          <h3 style={styles.title}>{getSceneDisplayTitle(scene)}</h3>
        </Link>
        
        <div style={styles.meta}>
          {scene.date && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📅</span>
              <span>{formatDate(scene.date)}</span>
            </div>
          )}
          
          {scene.studio && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>🏢</span>
              {typeof scene.studio === 'object' && scene.studio.id ? (
                <Link 
                  to={`/stash/studios/${scene.studio.id}`}
                  style={{ color: '#667eea', textDecoration: 'none' }}
                  onMouseOver={(e) => e.target.style.textDecoration = 'underline'}
                  onMouseOut={(e) => e.target.style.textDecoration = 'none'}
                >
                  {scene.studio.name}
                </Link>
              ) : (
                <span>
                  {typeof scene.studio === 'string' 
                    ? scene.studio 
                    : scene.studio.name || scene.studio
                  }
                </span>
              )}
            </div>
          )}
          
          {scene.performers && scene.performers.length > 0 && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>👤</span>
              <span>
                {scene.performers.slice(0, 3).map((p, idx) => {
                  const id = p?.performer?.id || p?.performerId || p?.id;
                  const name = (typeof p === 'string') ? p : (p?.performer?.name || p?.name || p);
                  const tags = p?.tags || [];
                  
                  // Build display with tags
                  const tagElements = tags.length > 0 ? (
                    <span style={styles.performerTags} title={tags.map(t => t.tag.name).join(', ')}>
                      ({tags.length} tag{tags.length !== 1 ? 's' : ''})
                    </span>
                  ) : null;
                  
                  const content = id ? (
                    <span key={id}>
                      <Link to={`/media/stash/performer/${id}`} style={styles.performerLink}>
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
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>⭐</span>
              <span>{scene.rating}/100</span>
            </div>
          )}
        </div>
        
        {(onSceneClick || onUnlinkClick) && (
          <div style={styles.actions}>
            {onSceneClick && (
              <button 
                style={styles.playBtn}
                onClick={() => onSceneClick(scene)}
                onMouseEnter={handlePlayBtnHover}
                onMouseLeave={handlePlayBtnLeave}
                title="Play Scene"
              >
                ▶️ Play
              </button>
            )}
            {onUnlinkClick && (
              <button 
                style={styles.unlinkBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlinkClick(scene);
                }}
                onMouseEnter={handleUnlinkBtnHover}
                onMouseLeave={handleUnlinkBtnLeave}
                title="Unlink scene from group"
              >
                🔗 Unlink from Group
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
