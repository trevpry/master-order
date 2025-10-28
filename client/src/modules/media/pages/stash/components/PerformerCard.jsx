import React from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../../../utils/stashUtils';
import PerformerCheckboxOverlay from '../../../../../components/stash/PerformerCheckboxOverlay';

const styles = {
  card: {
    backgroundColor: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    transition: 'all 0.2s ease',
    display: 'flex',
    flexDirection: 'column',
    textDecoration: 'none',
    color: 'inherit',
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    paddingBottom: '133.33%', // 3:4 aspect ratio for performer portraits
    overflow: 'hidden',
    backgroundColor: '#e5e7eb',
  },
  image: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '4rem',
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
  },
  sceneCountBadge: {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    background: 'rgba(59, 130, 246, 0.95)',
    color: 'white',
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  cardBody: {
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
  },
  name: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#1f2937',
    lineHeight: '1.4',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  alias: {
    fontSize: '0.8rem',
    color: '#6b7280',
    fontStyle: 'italic',
    lineHeight: '1.2',
  },
  disambiguation: {
    fontSize: '0.75rem',
    color: '#ffffff',
    backgroundColor: '#667eea',
    padding: '0.15rem 0.5rem',
    borderRadius: '0.75rem',
    fontWeight: '600',
    display: 'inline-block',
    marginTop: '0.25rem',
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
  tagsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.25rem',
    marginTop: '0.5rem',
  },
  tag: {
    fontSize: '0.7rem',
    padding: '0.15rem 0.4rem',
    borderRadius: '0.25rem',
    backgroundColor: '#e5e7eb',
    color: '#4b5563',
    whiteSpace: 'nowrap',
  },
};

export default function PerformerCard({ 
  performer, 
  selectionMode = false, 
  isSelected = false, 
  onToggleSelection,
  currentPage = 1
}) {
  const imageUrl = performer.image_path || performer.image;
  const sceneCount = performer.scene_count || performer.scenes?.length || 0;
  const tags = performer.tags || [];

  const cardContent = (
    <>
      <div style={styles.imageContainer}>
        {selectionMode && (
          <PerformerCheckboxOverlay
            performerId={performer.id}
            isSelected={isSelected}
            onToggle={onToggleSelection}
          />
        )}
        {imageUrl ? (
          <>
            <img
              src={imageUrl}
              alt={performer.name}
              style={styles.image}
              onError={(e) => {
                e.target.style.display = 'none';
                const placeholder = e.target.parentElement.querySelector('.performer-placeholder');
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
            <div className="performer-placeholder" style={{ ...styles.placeholder, display: 'none' }}>
              <span>👤</span>
            </div>
          </>
        ) : (
          <div style={styles.placeholder}>
            <span>👤</span>
          </div>
        )}
        {sceneCount > 0 && (
          <div style={styles.sceneCountBadge}>
            🎬 {sceneCount}
          </div>
        )}
      </div>
      
      <div style={styles.cardBody}>
        <h3 style={styles.name}>{performer.name}</h3>
        
        {performer.alias && (
          <div style={styles.alias}>
            aka {performer.alias}
          </div>
        )}
        
        {performer.disambiguation && (
          <div style={styles.disambiguation}>
            {performer.disambiguation}
          </div>
        )}
        
        <div style={styles.meta}>
          {performer.birthdate && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>🎂</span>
              <span>{formatDate(performer.birthdate)}</span>
            </div>
          )}
          
          {performer.country && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>🌍</span>
              <span>{performer.country}</span>
            </div>
          )}
          
          {performer.gender && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>⚧</span>
              <span>{performer.gender}</span>
            </div>
          )}
          
          {performer.height && (
            <div style={styles.metaItem}>
              <span style={styles.metaIcon}>📏</span>
              <span>{performer.height}cm</span>
            </div>
          )}
        </div>
        
        {tags.length > 0 && (
          <div style={styles.tagsList}>
            {tags.slice(0, 5).map((tagRel, idx) => {
              const tag = tagRel.tag || tagRel;
              return (
                <span key={tag.id || idx} style={styles.tag}>
                  {tag.name}
                </span>
              );
            })}
            {tags.length > 5 && (
              <span style={styles.tag}>
                +{tags.length - 5} more
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  // In selection mode, render as div instead of Link
  if (selectionMode) {
    return (
      <div
        style={styles.card}
        className="performer-card"
      >
        {cardContent}
      </div>
    );
  }

  // Normal mode: render as Link
  return (
    <Link 
      to={`/media/stash/performer/${performer.id}?fromPage=${currentPage}`} 
      style={styles.card}
      className="performer-card"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {cardContent}
    </Link>
  );
}
