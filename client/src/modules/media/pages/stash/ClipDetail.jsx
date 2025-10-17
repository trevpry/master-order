import React, { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import config from '../../../../config';

export default function ClipDetail() {
  const { id } = useParams();
  const [clip, setClip] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadClipDetails();
  }, [id]);

  const loadClipDetails = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/${id}`);
      const result = await response.json();

      if (result.success) {
        setClip(result.data);
      } else {
        setError(result.error || 'Failed to load clip details');
      }
    } catch (err) {
      console.error('Error loading clip details:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page pad">
        <p>Loading clip details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page pad">
        <div className="breadcrumb">
          <Link to="/media/stash">Stash</Link> → <Link to="/media/stash/clips">Clips</Link>
        </div>
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <button onClick={loadClipDetails}>Retry</button>
        </div>
      </div>
    );
  }

  if (!clip) {
    return (
      <div className="page pad">
        <div className="breadcrumb">
          <Link to="/media/stash">Stash</Link> → <Link to="/media/stash/clips">Clips</Link>
        </div>
        <p>Clip not found</p>
      </div>
    );
  }

  return (
    <div className="page pad clip-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link> → <Link to="/media/stash/clips">Clips</Link> → {clip.name || 'Untitled Clip'}
      </div>

      <div className="clip-detail-header">
        <h1>🎞️ {clip.name || 'Untitled Clip'}</h1>
      </div>

      {/* Clip Information */}
      <div className="card">
        <h3>Information</h3>
        <div className="clip-detail-grid">
          {clip.duration && (
            <div className="info-item">
              <span className="label">Duration:</span>
              <span className="value">{Math.floor(clip.duration)} seconds</span>
            </div>
          )}
          {clip.sceneTitle && (
            <div className="info-item">
              <span className="label">Scene:</span>
              <span className="value">
                {clip.sceneId ? (
                  <Link to={`/media/stash/scenes/${clip.sceneId}`}>{clip.sceneTitle}</Link>
                ) : (
                  clip.sceneTitle
                )}
              </span>
            </div>
          )}
          {clip.createdAt && (
            <div className="info-item">
              <span className="label">Created:</span>
              <span className="value">{new Date(clip.createdAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {clip.tags && clip.tags.length > 0 && (
        <div className="card">
          <h3>🏷️ Tags ({clip.tags.length})</h3>
          <div className="tag-chips">
            {clip.tags.map(tag => (
              <Link 
                key={tag.id} 
                to={`/media/stash/tags/${tag.id}`}
                className="tag-chip"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Scene Info (if associated) */}
      {clip.scene && (
        <div className="card">
          <h3>🎬 From Scene</h3>
          <Link 
            to={`/media/stash/scenes/${clip.scene.id}`}
            className="scene-card"
          >
            <div className="scene-card-body">
              <div className="title">{clip.scene.title}</div>
              {clip.scene.studioName && (
                <div className="meta">Studio: {clip.scene.studioName}</div>
              )}
              {clip.scene.date && (
                <div className="meta">Date: {new Date(clip.scene.date).toLocaleDateString()}</div>
              )}
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
