import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { formatDuration } from '../../../../utils/timeUtils';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate } from '../../utils/stashUtils';
import StashPerformerOverlay from '../../../../components/overlays/StashPerformerOverlay';
import config from '../../../../config';

export default function SceneDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [showPerformerChoice, setShowPerformerChoice] = useState(false);
  const [clickedPerformer, setClickedPerformer] = useState(null);
  const [mergedTags, setMergedTags] = useState([]);
  const [showParseModal, setShowParseModal] = useState(false);
  const [parseData, setParseData] = useState(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedStudio, setEditedStudio] = useState('');
  const [editedPerformers, setEditedPerformers] = useState([]);

  useEffect(() => {
    const fetchScene = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load scene');
        setData(json.data);
        
        // Merge scene tags with performer tags
        const tagMap = new Map();
        
        // Add scene tags
        if (json.data.tags) {
          json.data.tags.forEach(tag => {
            tagMap.set(tag.id, {
              id: tag.id,
              name: tag.name,
              description: tag.description,
              isSceneTag: true,
              performers: []
            });
          });
        }
        
        // Add performer tags
        if (json.data.performers) {
          json.data.performers.forEach(performer => {
            if (performer.tags && performer.tags.length > 0) {
              performer.tags.forEach(tagWrapper => {
                const tag = tagWrapper.tag;
                if (tagMap.has(tag.id)) {
                  // Tag exists, add performer reference
                  tagMap.get(tag.id).performers.push({
                    id: performer.id,
                    name: performer.name
                  });
                } else {
                  // New tag from performer
                  tagMap.set(tag.id, {
                    id: tag.id,
                    name: tag.name,
                    description: tag.description,
                    isSceneTag: false,
                    performers: [{
                      id: performer.id,
                      name: performer.name
                    }]
                  });
                }
              });
            }
          });
        }
        
        // Convert to sorted array
        const merged = Array.from(tagMap.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        setMergedTags(merged);
        
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchScene();
  }, [id]);

  const handlePerformerClick = (e, performer) => {
    e.preventDefault();
    const performerData = performer.performer || performer;
    setClickedPerformer(performerData);
    setShowPerformerChoice(true);
  };

  const handleViewPerformerDetails = () => {
    if (clickedPerformer) {
      navigate(`/media/stash/performers/${clickedPerformer.id}`);
    }
  };

  const handleShowPerformerOverlay = () => {
    setSelectedPerformer(clickedPerformer);
    setShowPerformerChoice(false);
  };

  const handleParseFilename = async () => {
    if (!data || !data.path) {
      alert('No file path available to parse');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}/parse-filename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (result.success) {
        const { parsed, matched, unmatched } = result.data;
        
        // Store parse results and show modal
        setParseData({ parsed, matched, unmatched });
        setEditedTitle(parsed.title || '');
        setEditedStudio(parsed.studio || '');
        setEditedPerformers(parsed.performers || []);
        setShowParseModal(true);
      } else {
        alert(`Failed to parse filename: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error parsing filename:', error);
      alert('Failed to parse filename');
    }
  };

  const handleAcceptParse = async () => {
    try {
      // Collect matched performer IDs
      const performerIds = parseData.matched.performers
        .filter(p => {
          // Only include performers that are still in editedPerformers list
          const normalizedPName = p.name.toLowerCase().replace(/\s+/g, '');
          return editedPerformers.some(ep => 
            ep.toLowerCase().replace(/\s+/g, '') === normalizedPName ||
            (p.matchedAlias && ep.toLowerCase().replace(/\s+/g, '') === p.matchedAlias.toLowerCase().replace(/\s+/g, ''))
          );
        })
        .map(p => p.id);

      // Determine studio ID if matched
      const studioId = parseData.matched.studio ? parseData.matched.studio.id : null;

      // Update scene with edited values
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: editedTitle,
          studio: editedStudio,
          studioId: studioId,
          performerIds: performerIds
        })
      });

      const result = await response.json();
      if (result.success) {
        setShowParseModal(false);
        window.location.reload();
      } else {
        alert(`Failed to update scene: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error updating scene:', error);
      alert('Failed to update scene');
    }
  };

  const closePerformerChoice = () => {
    setShowPerformerChoice(false);
    setClickedPerformer(null);
  };

  const closePerformerOverlay = () => {
    setSelectedPerformer(null);
  };

  if (loading) {
    return (
      <div className="page pad scene-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading scene details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="page pad scene-detail">
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <Link to="/media/stash/scenes" className="btn">← Back to Scenes</Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="page pad scene-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link>
        <span> → </span>
        <Link to="/media/stash/scenes">Scenes</Link>
        <span> → </span>
        <span>{getSceneDisplayTitle(data)}</span>
      </div>

      {/* Hero Section with Image */}
      <div className="scene-detail-hero">
        <div className="scene-hero-image">
          <img
            src={getSceneImageUrl(data)}
            alt={getSceneDisplayTitle(data)}
            onError={(e) => {
              e.target.src = '/placeholder-scene.jpg';
            }}
          />
          {data.duration && (
            <div className="duration-badge-large">
              ⏱️ {formatDuration(data.duration)}
            </div>
          )}
          {data.o_counter > 0 && (
            <div className="play-count-badge-large">
              ▶️ {data.o_counter} plays
            </div>
          )}
        </div>
        
        <div className="scene-hero-info">
          <h1 className="scene-title">🎬 {getSceneDisplayTitle(data)}</h1>
          
          {data.path && (
            <button 
              onClick={handleParseFilename}
              className="parse-filename-button"
              title="Parse filename to extract studio, performers, and title"
            >
              🔍 Parse Filename
            </button>
          )}
          
          <div className="scene-meta-badges">
            {data.date && (
              <div className="meta-badge">
                <span className="badge-icon">📅</span>
                <span>{formatDate(data.date)}</span>
              </div>
            )}
            {data.studio && (
              <div className="meta-badge">
                <span className="badge-icon">🏢</span>
                <span>{typeof data.studio === 'string' ? data.studio : data.studio?.name}</span>
              </div>
            )}
            {data.rating && (
              <div className="meta-badge rating">
                <span className="badge-icon">⭐</span>
                <span>{data.rating}/100</span>
              </div>
            )}
            {data.code && (
              <div className="meta-badge">
                <span className="badge-icon">🔖</span>
                <span>{data.code}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="scene-detail-content">
        {/* Details Section */}
        {data.details && (
          <div className="card scene-details-card">
            <h3>📝 Details</h3>
            <p className="scene-description">{data.details}</p>
          </div>
        )}

        {/* Performers Section */}
        {data.performers && data.performers.length > 0 && (
          <div className="card">
            <h3>👥 Performers ({data.performers.length})</h3>
            <div className="performers-grid">
              {data.performers.map(performer => {
                const performerData = performer.performer || performer;
                return (
                  <div
                    key={performerData.id}
                    className="performer-thumbnail-card clickable"
                    onClick={(e) => handlePerformerClick(e, performer)}
                    style={{ cursor: 'pointer' }}
                  >
                    {performerData.image ? (
                      <div className="performer-thumbnail-image">
                        <img src={performerData.image} alt={performerData.name} />
                      </div>
                    ) : (
                      <div className="performer-thumbnail-placeholder">
                        👤
                      </div>
                    )}
                    <div className="performer-thumbnail-name">
                      <div className="title">{performerData.name}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tags Section - Merged scene + performer tags */}
        {mergedTags.length > 0 && (
          <div className="card">
            <h3>🏷️ Tags ({mergedTags.length})</h3>
            <p className="text-sm text-gray-600 mb-3">
              Scene tags and tags from performers in this scene
            </p>
            <div className="tags-grid-detailed">
              {mergedTags.map(tag => (
                <div key={tag.id} className="tag-detail-item">
                  <Link
                    to={`/media/stash/tags/${tag.id}`}
                    className="tag-name-link"
                  >
                    {tag.name}
                  </Link>
                  <div className="tag-meta">
                    {tag.isSceneTag && tag.performers.length === 0 && (
                      <span className="tag-badge scene-only">Scene</span>
                    )}
                    {!tag.isSceneTag && tag.performers.length > 0 && (
                      <span className="tag-badge performer-only">
                        From {tag.performers.length} performer{tag.performers.length > 1 ? 's' : ''}
                      </span>
                    )}
                    {tag.isSceneTag && tag.performers.length > 0 && (
                      <span className="tag-badge scene-and-performer">
                        Scene + {tag.performers.length} performer{tag.performers.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {tag.performers.length > 0 && (
                    <div className="tag-performers-list">
                      {tag.performers.map(performer => (
                        <Link
                          key={performer.id}
                          to={`/media/stash/performers/${performer.id}`}
                          className="tag-performer-link"
                        >
                          {performer.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className="card">
          <h3>ℹ️ Additional Information</h3>
          <div className="info-grid-2col">
            {data.director && (
              <div className="info-row">
                <span className="info-label">Director:</span>
                <span className="info-value">{data.director}</span>
              </div>
            )}
            {data.organized !== undefined && (
              <div className="info-row">
                <span className="info-label">Organized:</span>
                <span className="info-value">{data.organized ? '✅ Yes' : '❌ No'}</span>
              </div>
            )}
            {data.playCount !== undefined && data.playCount > 0 && (
              <div className="info-row">
                <span className="info-label">Total Plays:</span>
                <span className="info-value">{data.playCount}</span>
              </div>
            )}
            {data.lastPlayedAt && (
              <div className="info-row">
                <span className="info-label">Last Played:</span>
                <span className="info-value">{new Date(data.lastPlayedAt).toLocaleString()}</span>
              </div>
            )}
            {data.resumeTime && data.resumeTime > 0 && (
              <div className="info-row">
                <span className="info-label">Resume Time:</span>
                <span className="info-value">{formatDuration(data.resumeTime)}</span>
              </div>
            )}
            {data.path && (
              <div className="info-row full-width">
                <span className="info-label">File Path:</span>
                <span className="info-value file-path">{data.path}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Performer Choice Modal */}
      {showPerformerChoice && clickedPerformer && (
        <div className="modal-overlay" onClick={closePerformerChoice}>
          <div className="modal-content performer-choice-modal" onClick={(e) => e.stopPropagation()}>
            <h3>View Performer: {clickedPerformer.name}</h3>
            <div className="performer-choice-buttons">
              <button
                className="choice-button primary"
                onClick={handleViewPerformerDetails}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Go to Performer Page
              </button>
              <button
                className="choice-button secondary"
                onClick={handleShowPerformerOverlay}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                Tag Performer in Scene
              </button>
            </div>
            <button className="modal-close" onClick={closePerformerChoice}>Cancel</button>
          </div>
        </div>
      )}

      {/* Performer Overlay - Reusing existing StashPerformerOverlay component */}
      {selectedPerformer && (
        <StashPerformerOverlay
          performerId={selectedPerformer.id}
          sceneDate={data.date}
          sceneId={id}
          onClose={closePerformerOverlay}
        />
      )}

      {/* Parse Filename Modal */}
      {showParseModal && parseData && (
        <div className="modal-overlay" onClick={() => setShowParseModal(false)}>
          <div className="modal-content parse-filename-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📋 Review Parsed Filename</h3>
            
            <div className="parse-results">
              {/* Title Field */}
              <div className="parse-field">
                <label>Title:</label>
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="parse-input"
                  placeholder="Scene title"
                />
              </div>

              {/* Studio Field */}
              <div className="parse-field">
                <label>Studio:</label>
                <div className="parse-field-with-status">
                  <input
                    type="text"
                    value={editedStudio}
                    onChange={(e) => setEditedStudio(e.target.value)}
                    className="parse-input"
                    placeholder="Studio name"
                  />
                  {parseData.matched.studio ? (
                    <span className="match-status matched">✓ Matched: {parseData.matched.studio.name}</span>
                  ) : parseData.unmatched.studio ? (
                    <span className="match-status unmatched">✗ Not found in database</span>
                  ) : null}
                </div>
              </div>

              {/* Performers Field */}
              <div className="parse-field">
                <label>Performers:</label>
                <div className="performers-list">
                  {editedPerformers.map((performer, index) => {
                    // Check if matched by name
                    let matched = parseData.matched.performers.find(
                      p => p.name.toLowerCase().replace(/\s+/g, '') === performer.toLowerCase().replace(/\s+/g, '')
                    );
                    
                    // Check if matched by alias
                    if (!matched) {
                      matched = parseData.matched.performers.find(
                        p => p.matchedAlias && p.matchedAlias.toLowerCase().replace(/\s+/g, '') === performer.toLowerCase().replace(/\s+/g, '')
                      );
                    }
                    
                    const isUnmatched = parseData.unmatched.performers.includes(performer);
                    
                    const hasAlternatives = matched && matched.alternatives && matched.alternatives.length > 0;
                    
                    return (
                      <div key={index} className="performer-item">
                        <div className="performer-input-wrapper">
                          <input
                            type="text"
                            value={performer}
                            onChange={(e) => {
                              const newPerformers = [...editedPerformers];
                              newPerformers[index] = e.target.value;
                              setEditedPerformers(newPerformers);
                            }}
                            className="parse-input performer-input"
                          />
                          {hasAlternatives && (
                            <select
                              className="performer-alternatives-dropdown"
                              onChange={(e) => {
                                if (e.target.value) {
                                  const newPerformers = [...editedPerformers];
                                  newPerformers[index] = e.target.value;
                                  setEditedPerformers(newPerformers);
                                }
                              }}
                              value=""
                            >
                              <option value="">Switch to alternative...</option>
                              {matched.alternatives.map((alt, altIndex) => (
                                <option key={altIndex} value={alt.name}>
                                  {alt.name} {alt.matchedVia === 'alias' && alt.matchedAlias ? `(via: ${alt.matchedAlias})` : ''}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                        {matched && (
                          <span className="match-status matched">
                            ✓ {matched.name}
                            {matched.matchedVia === 'alias' && matched.matchedAlias && (
                              <span className="alias-info"> (via alias: {matched.matchedAlias})</span>
                            )}
                            {hasAlternatives && (
                              <span className="alternatives-count"> (+{matched.alternatives.length} more)</span>
                            )}
                          </span>
                        )}
                        {isUnmatched && (
                          <span className="match-status unmatched">✗ Not found</span>
                        )}
                        <button
                          className="remove-performer-btn"
                          onClick={() => setEditedPerformers(editedPerformers.filter((_, i) => i !== index))}
                          title="Remove performer"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                  <button
                    className="add-performer-btn"
                    onClick={() => setEditedPerformers([...editedPerformers, ''])}
                  >
                    + Add Performer
                  </button>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-accept" onClick={handleAcceptParse}>
                ✓ Accept & Update
              </button>
              <button className="btn-cancel" onClick={() => setShowParseModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

