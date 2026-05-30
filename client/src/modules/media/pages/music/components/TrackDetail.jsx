import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import EmbeddedPicardTagsPanel from './EmbeddedPicardTagsPanel';
import './TrackDetail.css';

const TrackDetail = ({ trackRatingKey, onGoBack, onSelectAlbum, onSelectArtist, onSelectWork, onPlayTrack }) => {
  const [track, setTrack] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Work part linking state
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [composerSearch, setComposerSearch] = useState('');
  const [composers, setComposers] = useState([]);
  const [selectedComposer, setSelectedComposer] = useState(null);
  const [works, setWorks] = useState([]);
  const [selectedWork, setSelectedWork] = useState(null);
  const [selectedPart, setSelectedPart] = useState(null);
  const [linking, setLinking] = useState(false);
  
  // Artist type assignment state
  const [artistSearchQueries, setArtistSearchQueries] = useState({});
  const [artistSearchResults, setArtistSearchResults] = useState({});
  const [assigningArtistType, setAssigningArtistType] = useState(null);

  useEffect(() => {
    loadTrackDetails();
  }, [trackRatingKey]);

  const loadTrackDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${config.apiBaseUrl}/api/music/track/${trackRatingKey}`);
      if (!response.ok) throw new Error('Failed to load track details');
      const result = await response.json();
      setTrack(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchComposers = async (query) => {
    if (!query || query.length < 2) {
      setComposers([]);
      return;
    }

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!response.ok) throw new Error('Failed to search composers');
      const data = await response.json();
      setComposers(data.artists || data);
    } catch (err) {
      console.error('Error searching composers:', err);
    }
  };

  const loadWorksByComposer = async (composerKey) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/works`);
      if (!response.ok) throw new Error('Failed to load works');
      const result = await response.json();
      const allWorks = result.data || [];
      const composerWorks = allWorks.filter(w => w.composerKey === composerKey);
      setWorks(composerWorks);
    } catch (err) {
      console.error('Error loading works:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const handleSelectComposer = (composer) => {
    setSelectedComposer(composer);
    setComposerSearch(composer.title);
    setComposers([]);
    loadWorksByComposer(composer.ratingKey);
  };

  const handleSelectWork = (work) => {
    setSelectedWork(work);
    setSelectedPart(null);
  };

  const handleLinkTrackToPart = async () => {
    if (!selectedWork || !selectedPart) return;

    try {
      setLinking(true);
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${selectedWork.id}/parts/${selectedPart.id}/tracks`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trackKey: trackRatingKey })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to link track');
      }

      // Reload track details to show new association
      await loadTrackDetails();
      
      // Reset modal state
      setShowLinkModal(false);
      setComposerSearch('');
      setComposers([]);
      setSelectedComposer(null);
      setWorks([]);
      setSelectedWork(null);
      setSelectedPart(null);
    } catch (err) {
      console.error('Error linking track:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setLinking(false);
    }
  };

  const handleUnlinkTrack = async (workId, partId) => {
    if (!confirm('Remove this track from the work part?')) return;

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/works/${workId}/parts/${partId}/tracks/${trackRatingKey}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to unlink track');
      }

      await loadTrackDetails();
    } catch (err) {
      console.error('Error unlinking track:', err);
      alert(`Error: ${err.message}`);
    }
  };

  const searchArtistsForType = async (artistTypeId, query) => {
    if (!query || query.length < 2) {
      setArtistSearchResults(prev => ({ ...prev, [artistTypeId]: [] }));
      return;
    }

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(query)}&limit=10&artistTypeId=${artistTypeId}`
      );
      if (!response.ok) throw new Error('Failed to search artists');
      const data = await response.json();
      setArtistSearchResults(prev => ({ ...prev, [artistTypeId]: data.artists || data }));
    } catch (err) {
      console.error('Error searching artists:', err);
    }
  };

  const handleAssignArtistToType = async (artistKey, artistTypeId) => {
    try {
      setAssigningArtistType(artistTypeId);
      
      // Assign artist to track with this artist type
      const assignResponse = await fetch(
        `${config.apiBaseUrl}/api/music/track/${track.ratingKey}/artists/${artistKey}/types/${artistTypeId}`,
        { method: 'POST' }
      );

      if (!assignResponse.ok) {
        const errorData = await assignResponse.json();
        throw new Error(errorData.error || 'Failed to assign artist to track');
      }

      // Clear search for this type
      setArtistSearchQueries(prev => ({ ...prev, [artistTypeId]: '' }));
      setArtistSearchResults(prev => ({ ...prev, [artistTypeId]: [] }));
      
      // Reload track details to show updated artists
      await loadTrackDetails();
    } catch (err) {
      console.error('Error assigning artist to type:', err);
      alert(`Error: ${err.message}`);
    } finally {
      setAssigningArtistType(null);
    }
  };

  const markAsPlayed = async () => {
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/track/${track.ratingKey}/scrobble`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to mark as played');
      }

      // Reload track details to show updated play count
      await loadTrackDetails();
    } catch (err) {
      console.error('Error marking track as played:', err);
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const linkedWork = track?.work || track?.workPartTracks?.[0]?.workPart?.work || null;

  if (loading) {
    return (
      <div className="track-detail">
        <div className="track-detail-loading">Loading track details...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="track-detail">
        <div className="track-detail-error">Error: {error}</div>
        <button className="btn-back" onClick={onGoBack}>← Back</button>
      </div>
    );
  }

  if (!track) return null;

  return (
    <div className="track-detail">
      <div className="track-detail-header">
        <button className="btn-back" onClick={onGoBack}>
          ← Back
        </button>
      </div>

      <div className="track-detail-content">
        {/* Track Artwork */}
        {track.album && (
          <div className="track-artwork">
            <img
              src={`${config.plexUrl}${track.album.thumb || track.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={track.title}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Main Track Info */}
        <div className="track-main-info">
          <h1 className="track-title">{track.title}</h1>
          
          {track.album && (
            <div className="track-album-info">
              <span className="label">Album:</span>
              <button 
                className="link-button"
                onClick={() => onSelectAlbum(track.album)}
              >
                {track.album.title}
              </button>
              {track.album.year && <span className="year">({track.album.year})</span>}
            </div>
          )}

          {track.album?.artist && (
            <div className="track-artist-info">
              <span className="label">Artist:</span>
              <button 
                className="link-button"
                onClick={() => onSelectArtist(track.album.artist)}
              >
                {track.album.artist.title}
              </button>
            </div>
          )}

          {track.index && (
            <div className="track-number">
              <span className="label">Track:</span>
              <span>{track.index}</span>
            </div>
          )}

          {linkedWork && (
            <div className="track-work-info">
              <div className="track-work-row">
                <span className="label">Work:</span>
                <button
                  className="link-button"
                  onClick={() => onSelectWork && onSelectWork(linkedWork.id)}
                >
                  {linkedWork.title}
                </button>
              </div>
              {linkedWork.composer?.title && (
                <div className="track-work-composer">
                  <span className="label">Composer:</span>
                  <span>{linkedWork.composer.title}</span>
                </div>
              )}
              {linkedWork.parts && linkedWork.parts.length > 0 && (
                <div className="track-work-parts">
                  <span className="label">Parts:</span>
                  <span>
                    {linkedWork.parts.map((part) => part.title).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="track-actions">
            {onPlayTrack && (
              <button 
                className="btn-play-track"
                onClick={() => onPlayTrack(track)}
              >
                ▶ Play Track
              </button>
            )}
            <button 
              className="btn-mark-played"
              onClick={markAsPlayed}
              title="Mark this track as played in Plex"
            >
              ✓ Mark as Played
            </button>
          </div>
        </div>

        {/* Technical Details */}
        <div className="track-technical-details">
          <h3>Technical Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Duration:</span>
              <span className="detail-value">{formatDuration(track.duration)}</span>
            </div>
            {track.audioCodec && (
              <div className="detail-item">
                <span className="detail-label">Codec:</span>
                <span className="detail-value">{track.audioCodec.toUpperCase()}</span>
              </div>
            )}
            {track.audioChannels && (
              <div className="detail-item">
                <span className="detail-label">Channels:</span>
                <span className="detail-value">{track.audioChannels}</span>
              </div>
            )}
            {track.bitrate && (
              <div className="detail-item">
                <span className="detail-label">Bitrate:</span>
                <span className="detail-value">{track.bitrate} kbps</span>
              </div>
            )}
            {track.size && (
              <div className="detail-item">
                <span className="detail-label">File Size:</span>
                <span className="detail-value">{formatFileSize(track.size)}</span>
              </div>
            )}
            {track.container && (
              <div className="detail-item">
                <span className="detail-label">Container:</span>
                <span className="detail-value">{track.container.toUpperCase()}</span>
              </div>
            )}
            {track.rating && (
              <div className="detail-item">
                <span className="detail-label">Rating:</span>
                <span className="detail-value">{'★'.repeat(Math.round(track.rating))}</span>
              </div>
            )}
            {track.viewCount !== null && track.viewCount !== undefined && (
              <div className="detail-item">
                <span className="detail-label">Play Count:</span>
                <span className="detail-value">{track.viewCount}</span>
              </div>
            )}
          </div>

          {track.file && (
            <div className="detail-item detail-file">
              <span className="detail-label">File Path:</span>
              <span className="detail-value">{track.file}</span>
            </div>
          )}
        </div>

        {/* Work Parts */}
        <EmbeddedPicardTagsPanel entityType="track" entityKey={track.ratingKey} />

        {/* Work Parts */}
        <div className="track-works">
          <div className="track-works-header">
            <h3>Part of Musical Works</h3>
            <button 
              className="btn-link-work"
              onClick={() => setShowLinkModal(true)}
            >
              ➕ Link to Work
            </button>
          </div>
          
          {track.workPartTracks && track.workPartTracks.length > 0 ? (
            track.workPartTracks.map(({ workPart }) => (
              <div key={workPart.id} className="work-info">
                <div className="work-header-row">
                  <div className="work-title">
                    <button 
                      className="work-title-link"
                      onClick={() => onSelectWork && onSelectWork(workPart.work.id)}
                    >
                      {workPart.work.title}
                    </button>
                    <span className="composer"> by {workPart.work.composer.title}</span>
                  </div>
                  <button
                    className="btn-unlink-work"
                    onClick={() => handleUnlinkTrack(workPart.work.id, workPart.id)}
                    title="Remove from this work"
                  >
                    ✖
                  </button>
                </div>
                <div className="work-part">
                  Part {workPart.order}: {workPart.title}
                </div>
                
                {/* Artist Types for this work part */}
                {workPart.artistTypes && workPart.artistTypes.length > 0 && (
                  <div className="work-part-artist-types">
                    <h4>Artist Types for this Recording</h4>
                    <div className="artist-types-list">
                      {workPart.artistTypes.map(({ artistType }) => {
                        // Find artists assigned to this track for this type
                        const assignedArtists = track.trackArtists 
                          ? track.trackArtists.filter(ta => ta.artistTypeId === artistType.id)
                          : [];

                        return (
                          <div key={artistType.id} className="artist-type-assignment">
                            <div 
                              className="artist-type-label"
                              style={artistType.color ? { borderLeftColor: artistType.color } : {}}
                            >
                              <span className="type-name">{artistType.name}</span>
                              {artistType.description && (
                                <span className="type-description">{artistType.description}</span>
                              )}
                            </div>

                            {/* Show assigned artists */}
                            {assignedArtists.length > 0 && (
                              <div className="assigned-artists">
                                {assignedArtists.map(ta => (
                                  <div key={ta.id} className="assigned-artist-item">
                                    {ta.artist.thumb && (
                                      <img 
                                        src={`${config.plexUrl}${ta.artist.thumb}?X-Plex-Token=${config.plexToken}`}
                                        alt={ta.artist.title}
                                        className="artist-thumb"
                                      />
                                    )}
                                    <span className="artist-name">{ta.artist.title}</span>
                                    <button
                                      className="btn-remove-artist"
                                      onClick={async () => {
                                        if (confirm(`Remove ${ta.artist.title} from this role?`)) {
                                          try {
                                            const response = await fetch(
                                              `${config.apiBaseUrl}/api/music/track/${track.ratingKey}/artists/${ta.artist.ratingKey}/types/${artistType.id}`,
                                              { method: 'DELETE' }
                                            );
                                            if (!response.ok) throw new Error('Failed to remove artist');
                                            await loadTrackDetails();
                                          } catch (err) {
                                            console.error('Error removing artist:', err);
                                            alert('Failed to remove artist');
                                          }
                                        }
                                      }}
                                      title="Remove artist"
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            <div className="artist-assignment-section">
                              <div className="artist-search">
                                <input
                                  type="text"
                                  placeholder="Search for artist..."
                                  value={artistSearchQueries[artistType.id] || ''}
                                  onChange={(e) => {
                                    const query = e.target.value;
                                    setArtistSearchQueries(prev => ({ ...prev, [artistType.id]: query }));
                                    searchArtistsForType(artistType.id, query);
                                  }}
                                  className="artist-search-input"
                                />
                              </div>
                              
                              {artistSearchResults[artistType.id] && artistSearchResults[artistType.id].length > 0 && (
                                <div className="artist-search-results">
                                  {artistSearchResults[artistType.id].map(artist => (
                                    <button
                                      key={artist.ratingKey}
                                      className="artist-result-item"
                                      onClick={() => handleAssignArtistToType(artist.ratingKey, artistType.id)}
                                      disabled={assigningArtistType === artistType.id}
                                    >
                                      {artist.thumb && (
                                        <img 
                                          src={`${config.plexUrl}${artist.thumb}?X-Plex-Token=${config.plexToken}`}
                                          alt={artist.title}
                                          className="artist-thumb"
                                        />
                                      )}
                                      <span>{artist.title}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                <div className="work-all-parts">
                  <span className="parts-label">All parts:</span>
                  <ol>
                    {workPart.work.parts.map(part => (
                      <li 
                        key={part.id}
                        className={part.id === workPart.id ? 'current-part' : ''}
                      >
                        {part.title}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            ))
          ) : (
            <p className="no-works">This track is not linked to any musical works yet.</p>
          )}
        </div>

        {/* Additional Metadata */}
        {(track.originalTitle || track.summary) && (
          <div className="track-additional-info">
            <h3>Additional Information</h3>
            {track.originalTitle && (
              <div className="info-item">
                <span className="info-label">Original Title:</span>
                <span className="info-value">{track.originalTitle}</span>
              </div>
            )}
            {track.summary && (
              <div className="info-item">
                <span className="info-label">Description:</span>
                <p className="info-value">{track.summary}</p>
              </div>
            )}
          </div>
        )}

        {/* Dates */}
        <div className="track-dates">
          {track.addedAt && (
            <div className="date-item">
              <span className="date-label">Added:</span>
              <span className="date-value">
                {new Date(track.addedAt).toLocaleDateString()}
              </span>
            </div>
          )}
          {track.lastViewedAt && (
            <div className="date-item">
              <span className="date-label">Last Played:</span>
              <span className="date-value">
                {new Date(track.lastViewedAt).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Link to Work Modal */}
      {showLinkModal && (
        <div className="modal-overlay" onClick={() => setShowLinkModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h2>Link Track to Work Part</h2>
            
            <div className="link-work-steps">
              {/* Step 1: Search Composer */}
              <div className="link-step">
                <h4>1. Search for Composer</h4>
                <input
                  type="text"
                  value={composerSearch}
                  onChange={e => {
                    setComposerSearch(e.target.value);
                    searchComposers(e.target.value);
                  }}
                  placeholder="Search composer name..."
                  className="composer-search-input"
                />
                {composers.length > 0 && (
                  <div className="composer-results">
                    {composers.map(composer => (
                      <div
                        key={composer.ratingKey}
                        className={`composer-item ${selectedComposer?.ratingKey === composer.ratingKey ? 'selected' : ''}`}
                        onClick={() => handleSelectComposer(composer)}
                      >
                        {composer.title}
                      </div>
                    ))}
                  </div>
                )}
                {selectedComposer && (
                  <div className="selected-item">
                    ✓ Selected: <strong>{selectedComposer.title}</strong>
                  </div>
                )}
              </div>

              {/* Step 2: Select Work */}
              {selectedComposer && (
                <div className="link-step">
                  <h4>2. Select Work</h4>
                  {works.length === 0 ? (
                    <p className="no-works-message">No works found for this composer.</p>
                  ) : (
                    <div className="works-list-modal">
                      {works.map(work => (
                        <div
                          key={work.id}
                          className={`work-item ${selectedWork?.id === work.id ? 'selected' : ''}`}
                          onClick={() => handleSelectWork(work)}
                        >
                          <div className="work-item-title">{work.title}</div>
                          <div className="work-item-parts">{work.parts.length} parts</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Select Part */}
              {selectedWork && (
                <div className="link-step">
                  <h4>3. Select Part</h4>
                  <div className="parts-list-modal">
                    {selectedWork.parts.map(part => (
                      <div
                        key={part.id}
                        className={`part-item ${selectedPart?.id === part.id ? 'selected' : ''}`}
                        onClick={() => setSelectedPart(part)}
                      >
                        <span className="part-order">{part.order}.</span>
                        <span className="part-title">{part.title}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button
                className="btn-link-confirm"
                onClick={handleLinkTrackToPart}
                disabled={!selectedWork || !selectedPart || linking}
              >
                {linking ? 'Linking...' : 'Link Track'}
              </button>
              <button
                className="btn-cancel"
                onClick={() => {
                  setShowLinkModal(false);
                  setComposerSearch('');
                  setComposers([]);
                  setSelectedComposer(null);
                  setWorks([]);
                  setSelectedWork(null);
                  setSelectedPart(null);
                }}
                disabled={linking}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackDetail;
