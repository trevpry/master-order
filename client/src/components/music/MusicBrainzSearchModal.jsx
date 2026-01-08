import React, { useState } from 'react';
import config from '../../config';
import './MusicBrainzSearchModal.css';

const MusicBrainzSearchModal = ({ artistName, artistRatingKey, onClose, onArtistUpdated }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [artistDetails, setArtistDetails] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);

  // Automatically search when modal opens
  React.useEffect(() => {
    if (artistName) {
      performSearch(artistName);
    }
  }, [artistName]);

  const performSearch = async (query) => {
    setIsSearching(true);
    setError(null);
    setSearchResults([]);
    setSelectedArtist(null);
    setArtistDetails(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/musicbrainz/search/artist?query=${encodeURIComponent(query)}&limit=20`
      );
      
      if (!response.ok) {
        throw new Error('Failed to search MusicBrainz');
      }

      const result = await response.json();
      const artists = result.data?.artists || [];
      setSearchResults(artists);
      
      if (artists.length === 0) {
        setError('No artists found matching your search');
      }
    } catch (err) {
      console.error('MusicBrainz search error:', err);
      setError(err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const loadArtistDetails = async (mbid) => {
    setIsLoadingDetails(true);
    setError(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/musicbrainz/artist/${mbid}?inc=aliases+tags+genres+ratings+url-rels`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load artist details');
      }

      const result = await response.json();
      setArtistDetails(result.data);
    } catch (err) {
      console.error('MusicBrainz details error:', err);
      setError(err.message);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleArtistSelect = (artist) => {
    setSelectedArtist(artist);
    loadArtistDetails(artist.id);
  };

  const handleImportMetadata = async () => {
    if (!artistDetails || !artistRatingKey) return;
    
    setIsImporting(true);
    setError(null);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/music/artists/${artistRatingKey}/musicbrainz`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: artistDetails.name,
            sortName: artistDetails['sort-name'],
            disambiguation: artistDetails.disambiguation,
            country: artistDetails.country,
            lifeSpan: artistDetails['life-span'],
            aliases: artistDetails.aliases,
            relations: artistDetails.relations,
            musicBrainzId: artistDetails.id
          })
        }
      );

      if (!response.ok) {
        throw new Error('Failed to import MusicBrainz metadata');
      }

      const result = await response.json();
      
      // Notify parent component that artist was updated
      if (onArtistUpdated && result.data?.artist) {
        onArtistUpdated(result.data.artist);
      }

      // Show success message
      alert('Artist metadata imported successfully!');
      onClose();
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const formatLifeSpan = (lifeSpan) => {
    if (!lifeSpan) return null;
    const { begin, end, ended } = lifeSpan;
    if (!begin) return null;
    
    if (ended && end) {
      return `${begin} - ${end}`;
    } else if (begin) {
      return `${begin} - present`;
    }
    return begin;
  };

  const getArtistTypeLabel = (type) => {
    if (!type) return '';
    return type.charAt(0).toUpperCase() + type.slice(1);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content musicbrainz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>MusicBrainz Search</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div className="search-section">
            <div className="search-input-group">
              <input
                type="text"
                defaultValue={artistName}
                placeholder="Search for artist..."
                className="search-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    performSearch(e.target.value);
                  }
                }}
              />
              <button
                className="search-button"
                onClick={(e) => {
                  const input = e.target.previousElementSibling;
                  performSearch(input.value);
                }}
                disabled={isSearching}
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="results-container">
            {/* Search Results List */}
            <div className="results-list">
              <h3>Search Results</h3>
              {isSearching ? (
                <div className="loading">Searching MusicBrainz...</div>
              ) : searchResults.length > 0 ? (
                <div className="artist-results">
                  {searchResults.map((artist) => (
                    <div
                      key={artist.id}
                      className={`artist-result-item ${selectedArtist?.id === artist.id ? 'selected' : ''}`}
                      onClick={() => handleArtistSelect(artist)}
                    >
                      <div className="artist-result-name">{artist.name}</div>
                      {artist['life-span'] && formatLifeSpan(artist['life-span']) && (
                        <div className="artist-result-dates">{formatLifeSpan(artist['life-span'])}</div>
                      )}
                      {artist.disambiguation && (
                        <div className="artist-result-disambiguation">{artist.disambiguation}</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-results">Search for an artist to see results</div>
              )}
            </div>

            {/* Artist Details Panel */}
            <div className="details-panel">
              <h3>Artist Details</h3>
              {isLoadingDetails ? (
                <div className="loading">Loading details...</div>
              ) : artistDetails ? (
                <div className="artist-details">
                  <div className="detail-section">
                    <h4>{artistDetails.name}</h4>
                    {artistDetails['sort-name'] && artistDetails['sort-name'] !== artistDetails.name && (
                      <p className="sort-name">Sort Name: {artistDetails['sort-name']}</p>
                    )}
                    {artistDetails.disambiguation && (
                      <p className="disambiguation">{artistDetails.disambiguation}</p>
                    )}
                  </div>

                  {artistDetails.type && (
                    <div className="detail-section">
                      <label>Type:</label>
                      <span>{getArtistTypeLabel(artistDetails.type)}</span>
                    </div>
                  )}

                  {artistDetails.country && (
                    <div className="detail-section">
                      <label>Country:</label>
                      <span>{artistDetails.country}</span>
                    </div>
                  )}

                  {artistDetails['life-span'] && formatLifeSpan(artistDetails['life-span']) && (
                    <div className="detail-section">
                      <label>Active:</label>
                      <span>{formatLifeSpan(artistDetails['life-span'])}</span>
                    </div>
                  )}

                  {artistDetails.aliases && artistDetails.aliases.length > 0 && (
                    <div className="detail-section">
                      <label>Aliases:</label>
                      <div className="aliases-list">
                        {artistDetails.aliases.map((alias, idx) => (
                          <div key={idx} className="alias-item">
                            {alias.name}
                            {alias.locale && <span className="alias-locale"> ({alias.locale})</span>}
                            {alias.type && <span className="alias-type"> - {alias.type}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {artistDetails.genres && artistDetails.genres.length > 0 && (
                    <div className="detail-section">
                      <label>Genres:</label>
                      <div className="genres-list">
                        {artistDetails.genres.map((genre, idx) => (
                          <span key={idx} className="genre-tag">
                            {genre.name}
                            {genre.count && <span className="genre-count"> ({genre.count})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {artistDetails.tags && artistDetails.tags.length > 0 && (
                    <div className="detail-section">
                      <label>Tags:</label>
                      <div className="tags-list">
                        {artistDetails.tags.map((tag, idx) => (
                          <span key={idx} className="tag-item">
                            {tag.name}
                            {tag.count && <span className="tag-count"> ({tag.count})</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {artistDetails.rating && artistDetails.rating.value && (
                    <div className="detail-section">
                      <label>Community Rating:</label>
                      <span>{artistDetails.rating.value} / 5 ({artistDetails.rating['votes-count']} votes)</span>
                    </div>
                  )}

                  {artistDetails.relations && artistDetails.relations.length > 0 && (
                    <div className="detail-section">
                      <label>External Links:</label>
                      <div className="relations-list">
                        {artistDetails.relations
                          .filter(rel => rel.type === 'url' || rel.url)
                          .slice(0, 10)
                          .map((rel, idx) => (
                            <div key={idx} className="relation-item">
                              <a href={rel.url?.resource || rel.url} target="_blank" rel="noopener noreferrer">
                                {rel.type || 'Link'}: {rel.url?.resource || rel.url}
                              </a>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="detail-section">
                    <label>MusicBrainz ID:</label>
                    <div className="mbid-container">
                      <code className="mbid">{artistDetails.id}</code>
                      <div className="mbid-actions">
                        <a
                          href={`https://musicbrainz.org/artist/${artistDetails.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="view-on-mb"
                        >
                          View on MusicBrainz →
                        </a>
                        {artistRatingKey && (
                          <button
                            className="import-metadata-btn"
                            onClick={handleImportMetadata}
                            disabled={isImporting}
                          >
                            {isImporting ? 'Importing...' : '✓ Import Metadata'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="no-details">Select an artist to view details</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MusicBrainzSearchModal;
