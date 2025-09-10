import React from 'react';
import config from '../../../../../config';

const MusicArtistsView = ({
  artists,
  artistsLoading,
  artistsHasMore,
  onSelectArtist,
  onLoadMoreArtists
}) => {
  return (
    <div className="artists-grid">
      {artists.length === 0 ? (
        <div className="empty-state">
          <p>No artists found. Try adjusting your search or filters.</p>
        </div>
      ) : (
        artists.map(artist => (
          <div 
            key={artist.ratingKey} 
            className="artist-card"
            onClick={() => onSelectArtist(artist)}
          >
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
            </div>
          </div>
        ))
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
  );
};

export default MusicArtistsView;
