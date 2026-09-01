import React from 'react';
import config from '../../../../../config';

const MusicArtistsView = ({
  artists,
  artistsLoading,
  artistsHasMore,
  onSelectArtist,
  onMergeArtist,
  onDeleteArtist,
  onLoadMoreArtists,
  onCreateArtist,
  selectionMode = false,
  selectedArtists = new Set(),
  onToggleSelection,
  onLetterSelect,
  selectedLetter = null
}) => {
  
  const handleArtistClick = (artist) => {
    if (selectionMode && onToggleSelection) {
      onToggleSelection(artist.ratingKey);
    } else if (onSelectArtist) {
      onSelectArtist(artist);
    }
  };
  
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  
  return (
    <div className="artists-view-container">
      {onCreateArtist && (
        <div className="artists-view-header">
          <button 
            className="btn-create-artist"
            onClick={onCreateArtist}
          >
            ➕ Add New Artist
          </button>
        </div>
      )}
      
      {/* Alphabet Browse Bar */}
      <div className="alphabet-browse-bar">
        {alphabet.split('').map((letter) => (
          <button
            key={letter}
            className={`alphabet-letter-btn ${selectedLetter === letter ? 'active' : ''}`}
            onClick={() => onLetterSelect(letter)}
          >
            {letter}
          </button>
        ))}
      </div>
      
      <div className="artists-grid">
      {artists.length === 0 ? (
        <div className="empty-state">
          <p>No artists found. Try adjusting your search or filters.</p>
        </div>
      ) : (
        artists.map(artist => {
          const isSelected = selectedArtists.has(artist.ratingKey);
          
          return (
            <div 
              key={artist.ratingKey} 
              className={`artist-card ${selectionMode ? 'selection-mode' : ''} ${isSelected ? 'selected' : ''}`}
              onClick={() => handleArtistClick(artist)}
            >
              {selectionMode && (
                <div 
                  className="selection-checkbox"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(artist.ratingKey);
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => {}}
                    readOnly
                  />
                </div>
              )}
              {artist.thumb && (
                <div className="artist-image">
                  <img 
                    src={`${config.plexUrl}${artist.thumb}?X-Plex-Token=${config.plexToken}`}
                    alt={artist.title}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="artist-info">
                <h3>{artist.title}</h3>
                {artist.totalPlayCount !== undefined && artist.totalPlayCount > 0 && (
                  <p className="artist-play-count">
                    {artist.totalPlayCount} {artist.totalPlayCount === 1 ? 'play' : 'plays'}
                  </p>
                )}
              </div>
              {(onMergeArtist || onDeleteArtist) && !selectionMode && (
                <div className="artist-card-actions" onClick={(event) => event.stopPropagation()}>
                  {onMergeArtist && (
                    <button
                      type="button"
                      className="artist-card-action-button"
                      onClick={() => onMergeArtist(artist)}
                    >
                      🔀 Merge
                    </button>
                  )}
                  {onDeleteArtist && (
                    <button
                      type="button"
                      className="artist-card-action-button artist-card-delete-button"
                      onClick={() => onDeleteArtist(artist)}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
      
      {/* Load More Button */}
      {artists.length > 0 && artistsHasMore && (
        <div className="load-more-container">
          <button 
            className="load-more-button"
            onClick={onLoadMoreArtists}
            disabled={artistsLoading}
          >
            {artistsLoading ? 'Loading...' : 'Load More Artists'}
          </button>
        </div>
      )}
      
      {/* Loading indicator for pagination */}
      {artistsLoading && artists.length > 0 && (
        <div className="pagination-loading">
          <p>Loading more artists...</p>
        </div>
      )}
    </div>
  </div>
  );
};

export default MusicArtistsView;
