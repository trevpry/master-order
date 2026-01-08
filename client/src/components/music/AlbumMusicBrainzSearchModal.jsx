import React, { useState, useEffect } from 'react';
import config from '../../config';
import './MusicBrainzSearchModal.css';

const AlbumMusicBrainzSearchModal = ({ 
  albumTitle, 
  albumRatingKey,
  albumThumb,
  artistMusicBrainzId,
  trackCount,
  onClose,
  onAlbumUpdated 
}) => {
  const [searchResults, setSearchResults] = useState([]);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [releaseDetails, setReleaseDetails] = useState(null);
  const [coverArtUrl, setCoverArtUrl] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);

  // Automatically search on mount
  useEffect(() => {
    if (albumTitle) {
      performSearch(albumTitle);
    }
  }, [albumTitle]);

  const performSearch = async (query) => {
    setIsSearching(true);
    setError(null);
    
    try {
      // Build search params with track count filter
      const params = new URLSearchParams({
        query: query,
        limit: 25
      });
      
      // Add artist filter if we have a MusicBrainz ID
      if (artistMusicBrainzId) {
        params.append('artist', artistMusicBrainzId);
      }
      
      // Add track count for better matching
      if (trackCount) {
        params.append('tracks', trackCount);
      }
      
      const response = await fetch(`${config.apiBaseUrl}/api/musicbrainz/search/release?${params}`);
      const result = await response.json();
      
      // If we got results with track count filter, use them
      if (result.success && result.data && result.data.releases && result.data.releases.length > 0) {
        setSearchResults(result.data.releases);
      } else if (trackCount) {
        // No results with track count filter, try again without it
        console.log('No results with track count filter, retrying without track count...');
        const paramsNoTracks = new URLSearchParams({
          query: query,
          limit: 25
        });
        
        if (artistMusicBrainzId) {
          paramsNoTracks.append('artist', artistMusicBrainzId);
        }
        
        const retryResponse = await fetch(`${config.apiBaseUrl}/api/musicbrainz/search/release?${paramsNoTracks}`);
        const retryResult = await retryResponse.json();
        
        if (retryResult.success && retryResult.data && retryResult.data.releases) {
          setSearchResults(retryResult.data.releases);
        } else {
          setSearchResults([]);
        }
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setError('Failed to search MusicBrainz');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const loadReleaseDetails = async (mbid) => {
    setIsLoading(true);
    setError(null);
    setCoverArtUrl(null);
    
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/musicbrainz/release/${mbid}?inc=artists+labels+recordings+release-groups+media`
      );
      const result = await response.json();
      
      if (result.success && result.data) {
        setReleaseDetails(result.data);
        setSelectedRelease(mbid);
        
        // Try to load cover art from Cover Art Archive
        setCoverArtUrl(`https://coverartarchive.org/release/${mbid}/front`);
      }
    } catch (error) {
      console.error('Error loading release details:', error);
      setError('Failed to load release details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportMetadata = async () => {
    if (!releaseDetails || !albumRatingKey) return;
    
    setIsImporting(true);
    setError(null);
    
    try {
      // Extract label names from label-info
      let labelName = null;
      if (releaseDetails['label-info'] && releaseDetails['label-info'].length > 0) {
        const labelInfo = releaseDetails['label-info'][0];
        labelName = labelInfo.label?.name || null;
      }
      
      const payload = {
        title: releaseDetails.title,
        date: releaseDetails.date || releaseDetails['release-events']?.[0]?.date || null,
        country: releaseDetails.country || releaseDetails['release-events']?.[0]?.area?.['iso-3166-1-codes']?.[0] || null,
        status: releaseDetails.status || null,
        packaging: releaseDetails.packaging || null,
        barcode: releaseDetails.barcode || null,
        asin: releaseDetails.asin || null,
        label: labelName,
        musicBrainzId: releaseDetails.id
      };
      
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/albums/${albumRatingKey}/musicbrainz`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload)
        }
      );
      
      if (response.ok) {
        const result = await response.json();
        console.log('Album metadata imported successfully:', result);
        
        // Notify parent component
        if (onAlbumUpdated) {
          onAlbumUpdated(result.data.album);
        }
        
        // Close modal after successful import
        onClose();
      } else {
        setError('Failed to import metadata');
      }
    } catch (error) {
      console.error('Import error:', error);
      setError('Failed to import metadata');
    } finally {
      setIsImporting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const getTotalTracks = (media) => {
    if (!media || media.length === 0) return 0;
    return media.reduce((total, medium) => total + (medium['track-count'] || 0), 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content musicbrainz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>MusicBrainz Release Search</h2>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body musicbrainz-body">
          {/* Search Panel */}
          <div className="search-panel">
            <div className="search-info">
              {albumThumb && (
                <img 
                  src={`${config.plexUrl}${albumThumb}?X-Plex-Token=${config.plexToken}`}
                  alt={albumTitle}
                  className="current-album-art"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              )}
              <h3>Searching for:</h3>
              <p className="album-name">{albumTitle}</p>
              {trackCount && <p className="track-count">{trackCount} tracks</p>}
              {artistMusicBrainzId && <p className="filter-info">✓ Filtered by artist</p>}
            </div>
            
            {isSearching && <p className="loading">Searching...</p>}
            
            {error && <div className="error-message">{error}</div>}
            
            {!isSearching && searchResults.length === 0 && (
              <p className="no-results">No releases found</p>
            )}
            
            {searchResults.length > 0 && (
              <div className="results-list">
                {searchResults.map((release) => (
                  <div
                    key={release.id}
                    className={`result-item ${selectedRelease === release.id ? 'selected' : ''}`}
                    onClick={() => loadReleaseDetails(release.id)}
                  >
                    <div className="result-title">{release.title}</div>
                    <div className="result-meta">
                      {release['artist-credit']?.map(ac => ac.name || ac.artist?.name).join(', ')}
                    </div>
                    <div className="result-details">
                      {release.date && <span>{release.date}</span>}
                      {release.country && <span> • {release.country}</span>}
                      {release['track-count'] && <span> • {release['track-count']} tracks</span>}
                      {release.status && <span> • {release.status}</span>}
                    </div>
                    {trackCount && release['track-count'] === trackCount && (
                      <div className="match-badge">Track count match!</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Details Panel */}
          <div className="details-panel">
            {isLoading && <p className="loading">Loading release details...</p>}
            
            {!isLoading && !releaseDetails && (
              <div className="empty-details">
                <p>Select a release from the list to see details</p>
              </div>
            )}
            
            {releaseDetails && (
              <div className="release-details">
                <div className="details-header">
                  {coverArtUrl && (
                    <img 
                      src={coverArtUrl}
                      alt={releaseDetails.title}
                      className="musicbrainz-album-art"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <h3>{releaseDetails.title}</h3>
                  <div className="mbid-actions">
                    <a
                      href={`https://musicbrainz.org/release/${releaseDetails.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-on-mb"
                    >
                      View on MusicBrainz
                    </a>
                    <button
                      className="import-metadata-btn"
                      onClick={handleImportMetadata}
                      disabled={isImporting}
                    >
                      {isImporting ? 'Importing...' : '✓ Import Metadata'}
                    </button>
                  </div>
                </div>
                
                <div className="release-info-grid">
                  <div className="info-item">
                    <span className="label">Artist:</span>
                    <span className="value">
                      {releaseDetails['artist-credit']?.map(ac => ac.name || ac.artist?.name).join(', ')}
                    </span>
                  </div>
                  
                  {releaseDetails.date && (
                    <div className="info-item">
                      <span className="label">Release Date:</span>
                      <span className="value">{formatDate(releaseDetails.date)}</span>
                    </div>
                  )}
                  
                  {releaseDetails.country && (
                    <div className="info-item">
                      <span className="label">Country:</span>
                      <span className="value">{releaseDetails.country}</span>
                    </div>
                  )}
                  
                  {releaseDetails.status && (
                    <div className="info-item">
                      <span className="label">Status:</span>
                      <span className="value">{releaseDetails.status}</span>
                    </div>
                  )}
                  
                  {releaseDetails.packaging && (
                    <div className="info-item">
                      <span className="label">Packaging:</span>
                      <span className="value">{releaseDetails.packaging}</span>
                    </div>
                  )}
                  
                  {releaseDetails.barcode && (
                    <div className="info-item">
                      <span className="label">Barcode:</span>
                      <span className="value">{releaseDetails.barcode}</span>
                    </div>
                  )}
                  
                  {releaseDetails['label-info'] && releaseDetails['label-info'].length > 0 && (
                    <div className="info-item">
                      <span className="label">Label:</span>
                      <span className="value">
                        {releaseDetails['label-info'].map(li => 
                          `${li.label?.name || 'Unknown'}${li['catalog-number'] ? ` (${li['catalog-number']})` : ''}`
                        ).join(', ')}
                      </span>
                    </div>
                  )}
                  
                  {releaseDetails.media && (
                    <div className="info-item full-width">
                      <span className="label">Media:</span>
                      <span className="value">
                        {releaseDetails.media.length} {releaseDetails.media.length === 1 ? 'disc' : 'discs'} 
                        ({getTotalTracks(releaseDetails.media)} tracks)
                      </span>
                    </div>
                  )}
                </div>
                
                {releaseDetails.media && releaseDetails.media.length > 0 && (
                  <div className="media-section">
                    <h4>Track Listing</h4>
                    {releaseDetails.media.map((medium, idx) => (
                      <div key={idx} className="medium">
                        <div className="medium-header">
                          <strong>
                            {medium.format || 'Unknown Format'} 
                            {releaseDetails.media.length > 1 && ` ${idx + 1}`}
                          </strong>
                          <span className="track-count">
                            {medium['track-count']} {medium['track-count'] === 1 ? 'track' : 'tracks'}
                          </span>
                        </div>
                        {medium.tracks && medium.tracks.length > 0 && (
                          <div className="track-list">
                            {medium.tracks.slice(0, 10).map((track, trackIdx) => (
                              <div key={trackIdx} className="track-item">
                                <span className="track-position">{track.position || trackIdx + 1}.</span>
                                <span className="track-title">{track.title}</span>
                                {track.length && (
                                  <span className="track-length">
                                    {Math.floor(track.length / 60000)}:{String(Math.floor((track.length % 60000) / 1000)).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            ))}
                            {medium.tracks.length > 10 && (
                              <div className="track-item more-tracks">
                                ...and {medium.tracks.length - 10} more tracks
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlbumMusicBrainzSearchModal;
