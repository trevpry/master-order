import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import './WorkDetail.css';

const WorkDetail = ({ workId, onGoBack, onSelectArtist, onSelectTrack }) => {
  const [work, setWork] = useState(null);
  const [artistTypes, setArtistTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editComposerSearch, setEditComposerSearch] = useState('');
  const [editComposerResults, setEditComposerResults] = useState([]);
  const [selectedComposer, setSelectedComposer] = useState(null);
  const [searchingComposer, setSearchingComposer] = useState(false);
  const [savingWork, setSavingWork] = useState(false);
  const [editingPartId, setEditingPartId] = useState(null);
  const [editPartTitle, setEditPartTitle] = useState('');
  const [editPartOrder, setEditPartOrder] = useState('');
  const [savingPartId, setSavingPartId] = useState(null);

  useEffect(() => {
    loadWorkDetails();
    loadArtistTypes();
  }, [workId]);

  useEffect(() => {
    if (!work) {
      return;
    }

    setEditTitle(work.title || '');
    setSelectedComposer(work.composer || null);
    setEditComposerSearch(work.composer?.title || '');
  }, [work]);

  const loadWorkDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.apiBaseUrl}/api/works/${workId}`);
      if (!response.ok) throw new Error('Failed to load work details');
      const result = await response.json();
      setWork(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadArtistTypes = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/artist-types`);
      if (!response.ok) throw new Error('Failed to load artist types');
      const result = await response.json();
      setArtistTypes(result.data?.artistTypes || []);
    } catch (err) {
      console.error('Error loading artist types:', err);
    }
  };

  const searchComposers = async (query) => {
    const trimmedQuery = String(query || '').trim();
    if (trimmedQuery.length < 2) {
      setEditComposerResults([]);
      return;
    }

    try {
      setSearchingComposer(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(trimmedQuery)}&limit=10`
      );

      if (!response.ok) {
        throw new Error('Failed to search composers');
      }

      const result = await response.json();
      setEditComposerResults(result.artists || result || []);
    } catch (err) {
      console.error('Error searching composers:', err);
    } finally {
      setSearchingComposer(false);
    }
  };

  const openEditMode = () => {
    setEditTitle(work?.title || '');
    setSelectedComposer(work?.composer || null);
    setEditComposerSearch(work?.composer?.title || '');
    setEditComposerResults([]);
    setIsEditing(true);
  };

  const cancelEditMode = () => {
    setIsEditing(false);
    setEditTitle(work?.title || '');
    setSelectedComposer(work?.composer || null);
    setEditComposerSearch(work?.composer?.title || '');
    setEditComposerResults([]);
  };

  const handleSelectEditComposer = (composer) => {
    setSelectedComposer(composer);
    setEditComposerSearch(composer.title || '');
    setEditComposerResults([]);
  };

  const handleSaveWork = async () => {
    const trimmedTitle = String(editTitle || '').trim();
    if (!trimmedTitle) {
      alert('Work title is required.');
      return;
    }

    if (!selectedComposer?.ratingKey) {
      alert('Select a composer for this work.');
      return;
    }

    try {
      setSavingWork(true);
      const response = await fetch(`${config.apiBaseUrl}/api/works/${workId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          composerKey: selectedComposer.ratingKey,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update work');
      }

      setWork(result.data || result.work || result);
      setIsEditing(false);
      await loadWorkDetails();
    } catch (err) {
      console.error('Error updating work:', err);
      alert(`Error updating work: ${err.message}`);
    } finally {
      setSavingWork(false);
    }
  };

  const openPartEditMode = (part) => {
    setEditingPartId(part.id);
    setEditPartTitle(part.title || '');
    setEditPartOrder(Number.isInteger(part.order) ? String(part.order) : '');
  };

  const cancelPartEditMode = () => {
    setEditingPartId(null);
    setEditPartTitle('');
    setEditPartOrder('');
  };

  const handleSavePart = async () => {
    if (!editingPartId) {
      return;
    }

    const trimmedTitle = String(editPartTitle || '').trim();
    const parsedOrder = parseInt(editPartOrder, 10);

    if (!trimmedTitle) {
      alert('Part title is required.');
      return;
    }

    if (!Number.isInteger(parsedOrder) || parsedOrder <= 0) {
      alert('Part order must be a positive number.');
      return;
    }

    try {
      setSavingPartId(editingPartId);
      const response = await fetch(`${config.apiBaseUrl}/api/works/${workId}/parts/${editingPartId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: trimmedTitle,
          order: parsedOrder,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update part');
      }

      await loadWorkDetails();
      cancelPartEditMode();
    } catch (err) {
      console.error('Error updating part:', err);
      alert(`Error updating part: ${err.message}`);
    } finally {
      setSavingPartId(null);
    }
  };

  const handleAddArtistType = async (partId, artistTypeId) => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${workId}/parts/${partId}/artist-types/${artistTypeId}`,
        { method: 'POST' }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add artist type');
      }
      await loadWorkDetails();
    } catch (err) {
      console.error('Error adding artist type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleRemoveArtistType = async (partId, artistTypeId) => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${workId}/parts/${partId}/artist-types/${artistTypeId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to remove artist type');
      }
      await loadWorkDetails();
    } catch (err) {
      console.error('Error removing artist type:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '--:--';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="work-detail">
        <div className="work-detail-loading">Loading work details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="work-detail">
        <div className="work-detail-error">Error: {error}</div>
        <button className="btn-back" onClick={onGoBack}>← Back</button>
      </div>
    );
  }

  if (!work) return null;

  // Aggregate unique artist types from all parts
  const aggregatedArtistTypes = work.parts
    .flatMap(part => part.artistTypes || [])
    .map(at => at.artistType)
    .filter((type, index, self) => 
      index === self.findIndex(t => t.id === type.id)
    );

  return (
    <div className="work-detail">
      <div className="work-detail-header">
        <button className="btn-back" onClick={onGoBack}>
          ← Back
        </button>
        {!isEditing && (
          <button className="btn-edit-work" onClick={openEditMode}>
            Edit Work
          </button>
        )}
      </div>

      <div className="work-detail-content">
        {isEditing && (
          <div className="work-edit-panel">
            <div className="work-edit-grid">
              <label className="work-edit-field">
                <span className="work-edit-label">Title</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="work-edit-input"
                />
              </label>

              <label className="work-edit-field">
                <span className="work-edit-label">Composer</span>
                <input
                  type="text"
                  value={editComposerSearch}
                  onChange={(event) => {
                    const value = event.target.value;
                    setEditComposerSearch(value);
                    setSelectedComposer(null);
                    searchComposers(value);
                  }}
                  className="work-edit-input"
                  placeholder="Search composer..."
                />
              </label>
            </div>

            {searchingComposer && <div className="work-edit-hint">Searching...</div>}

            {editComposerResults.length > 0 && (
              <div className="work-edit-results">
                {editComposerResults.map((composer) => (
                  <button
                    key={composer.ratingKey}
                    type="button"
                    className={`work-edit-result ${selectedComposer?.ratingKey === composer.ratingKey ? 'selected' : ''}`}
                    onClick={() => handleSelectEditComposer(composer)}
                  >
                    {composer.title}
                  </button>
                ))}
              </div>
            )}

            {selectedComposer && (
              <div className="work-edit-hint">
                Selected composer: {selectedComposer.title}
              </div>
            )}

            <div className="work-edit-actions">
              <button type="button" className="btn-cancel-edit" onClick={cancelEditMode} disabled={savingWork}>
                Cancel
              </button>
              <button type="button" className="btn-save-edit" onClick={handleSaveWork} disabled={savingWork}>
                {savingWork ? 'Saving...' : 'Save Work'}
              </button>
            </div>
          </div>
        )}

        {/* Work Header */}
        <div className="work-header-section">
          {work.composer.thumb && (
            <div className="composer-artwork">
              <img
                src={`${config.plexUrl}${work.composer.thumb}?X-Plex-Token=${config.plexToken}`}
                alt={work.composer.title}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          <div className="work-main-info">
            <h1 className="work-title">{work.title}</h1>
            <div className="work-composer">
              <span className="label">Composer:</span>
              <button className="link-button" onClick={() => onSelectArtist && onSelectArtist(work.composer)}>
                {work.composer.title}
              </button>
            </div>
            <div className="work-stats">
              <span className="stat-item">{work.parts.length} parts</span>
              <span className="stat-separator">•</span>
              <span className="stat-item">
                {work.parts.reduce((sum, part) => sum + (part.tracks?.length || 0), 0)} tracks
              </span>
              {work.totalPlayCount !== undefined && work.totalPlayCount > 0 && (
                <>
                  <span className="stat-separator">•</span>
                  <span className="stat-item">
                    {work.totalPlayCount} {work.totalPlayCount === 1 ? 'play' : 'plays'}
                  </span>
                </>
              )}
            </div>
            
            {/* Aggregated Artist Types */}
            {aggregatedArtistTypes.length > 0 && (
              <div className="work-artist-types">
                <span className="artist-types-label">Artist Types:</span>
                <div className="artist-types-badges">
                  {aggregatedArtistTypes.map(artistType => (
                    <span
                      key={artistType.id}
                      className="artist-type-badge"
                      style={artistType.color ? { backgroundColor: artistType.color } : {}}
                    >
                      {artistType.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Parts List */}
        <div className="work-parts-section">
          <h2>Parts</h2>
          {work.parts.length === 0 ? (
            <p className="no-parts">No parts defined for this work yet.</p>
          ) : (
            <div className="parts-list">
              {work.parts.map((part) => (
                <div key={part.id} className="part-card">
                  <div className="part-header">
                    <span className="part-number">{part.order}</span>
                    <h3 className="part-title">{part.title}</h3>                    {part.totalPlayCount !== undefined && part.totalPlayCount > 0 && (
                      <span className="part-play-count">
                        • {part.totalPlayCount} {part.totalPlayCount === 1 ? 'play' : 'plays'}
                      </span>
                    )}                  </div>

                  {editingPartId === part.id ? (
                    <div className="part-edit-panel">
                      <div className="part-edit-grid">
                        <label className="part-edit-field">
                          <span className="work-edit-label">Part title</span>
                          <input
                            type="text"
                            value={editPartTitle}
                            onChange={(event) => setEditPartTitle(event.target.value)}
                            className="work-edit-input"
                          />
                        </label>

                        <label className="part-edit-field">
                          <span className="work-edit-label">Order</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editPartOrder}
                            onChange={(event) => setEditPartOrder(event.target.value)}
                            className="work-edit-input"
                          />
                        </label>
                      </div>

                      <div className="work-edit-actions">
                        <button
                          type="button"
                          className="btn-cancel-edit"
                          onClick={cancelPartEditMode}
                          disabled={savingPartId === part.id}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="btn-save-edit"
                          onClick={handleSavePart}
                          disabled={savingPartId === part.id}
                        >
                          {savingPartId === part.id ? 'Saving...' : 'Save Part'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="part-edit-toolbar">
                      <button
                        type="button"
                        className="btn-edit-part"
                        onClick={() => openPartEditMode(part)}
                      >
                        Edit Part
                      </button>
                    </div>
                  )}
                  
                  {/* Artist Types for this part */}
                  <div className="part-artist-types-section">
                    <div className="part-artist-types-header">
                      <label className="artist-types-label">Artist Types:</label>
                      {artistTypes.length > 0 && (
                        <select 
                          className="artist-type-dropdown-small"
                          onChange={e => {
                            const selectedId = parseInt(e.target.value);
                            if (selectedId) {
                              handleAddArtistType(part.id, selectedId);
                            }
                            e.target.value = '';
                          }}
                          value=""
                        >
                          <option value="">+ Add type...</option>
                          {artistTypes
                            .filter(at => !part.artistTypes?.find(pat => pat.artistType.id === at.id))
                            .map(artistType => (
                              <option key={artistType.id} value={artistType.id}>
                                {artistType.name}
                              </option>
                            ))
                          }
                        </select>
                      )}
                    </div>
                    {part.artistTypes && part.artistTypes.length > 0 && (
                      <div className="part-artist-types">
                        {part.artistTypes.map(({ artistType }) => (
                          <span
                            key={artistType.id}
                            className="artist-type-badge-small"
                            style={artistType.color ? { backgroundColor: artistType.color } : {}}
                          >
                            {artistType.name}
                            <button
                              className="remove-type-btn-small"
                              onClick={() => handleRemoveArtistType(part.id, artistType.id)}
                              title="Remove artist type"
                            >
                              ✖
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {part.tracks && part.tracks.length > 0 ? (
                    <div className="part-tracks">
                      <h4>Recordings ({part.tracks.length})</h4>
                      <div className="tracks-list">
                        {part.tracks.map(({ track }) => (
                          <div key={track.ratingKey} className="track-item">
                            <div className="track-info">
                              <div 
                                className="track-title track-title-link"
                                onClick={() => onSelectTrack && onSelectTrack(track)}
                              >
                                {track.title}
                              </div>
                              {track.album && (
                                <div className="track-album">
                                  {track.album.title}
                                  {track.album.artist && (
                                    <span className="track-artist">
                                      {' • '}{track.album.artist.title}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="track-meta">
                              {track.viewCount > 0 && (
                                <span className="track-play-count">
                                  {track.viewCount} {track.viewCount === 1 ? 'play' : 'plays'}
                                  {' • '}
                                </span>
                              )}
                              <span className="track-duration">
                                {formatDuration(track.duration)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="no-tracks">No recordings linked to this part yet.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="work-metadata">
          <div className="metadata-item">
            <span className="metadata-label">Created:</span>
            <span className="metadata-value">
              {new Date(work.createdAt).toLocaleDateString()}
            </span>
          </div>
          {work.updatedAt && work.updatedAt !== work.createdAt && (
            <div className="metadata-item">
              <span className="metadata-label">Last Updated:</span>
              <span className="metadata-value">
                {new Date(work.updatedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkDetail;
