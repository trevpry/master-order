import React from 'react';
import LoadingState from '../../../../../shared/components/LoadingState';

const MusicAlbumsView = ({ 
  albums, 
  albumsLoading, 
  albumsHasMore, 
  config,
  selectedArtist,
  playlists,
  extractingMetadata,
  metadataResults,
  onSelectAlbum, 
  onLoadMoreAlbums,
  onGoBackToArtists,
  onAddAlbumToCustomPlaylist,
  onExtractAlbumMetadata
}) => {
  return (
    <div className="albums-section">
      <div className="section-header">
        <button 
          className="back-button" 
          onClick={onGoBackToArtists}
          title="Back to Artists"
        >
          ← Back
        </button>
        <h2>
          {selectedArtist ? `Albums by ${selectedArtist.title}` : 'All Albums'}
        </h2>
      </div>
      <div className="albums-grid">
        {albums.length === 0 ? (
          <div className="empty-state">
            <p>No albums found{selectedArtist ? ' for this artist' : ''}.</p>
          </div>
        ) : (
          albums.map(album => (
            <div 
              key={album.ratingKey} 
              className="album-card"
            >
              {album.thumb && (
                <div 
                  className="album-image"
                  style={{ position: 'relative' }}
                >
                  <img 
                    src={`${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`}
                    alt={album.title}
                    onClick={() => onSelectAlbum(album)}
                    style={{ cursor: 'pointer', width: '100%', height: '100%' }}
                    onLoad={() => console.log('Album image loaded:', album.title)}
                    onError={(e) => {
                      console.error('Album image failed to load:', {
                        album: album.title,
                        thumb: album.thumb,
                        url: e.target.src,
                        plexUrl: config.plexUrl,
                        hasToken: !!config.plexToken
                      });
                      e.target.style.display = 'none';
                    }}
                  />
                  
                  {/* Add to Playlist Button Overlay */}
                  <div className="album-playlist-overlay">
                    <div className="album-playlist-dropdown">
                      <select
                        onChange={(e) => {
                          if (e.target.value) {
                            onAddAlbumToCustomPlaylist(parseInt(e.target.value), album);
                            e.target.value = '';
                          }
                        }}
                        defaultValue=""
                        onClick={(e) => e.stopPropagation()} // Prevent triggering album click
                      >
                        <option value="">+ Add Album to...</option>
                        {playlists
                          .filter(p => p.type === 'custom')
                          .map(playlist => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.title}
                            </option>
                          ))
                        }
                      </select>
                    </div>
                  </div>
                </div>
              )}
              <div className="album-info">
                <h3 onClick={() => onSelectAlbum(album)} style={{ cursor: 'pointer' }}>
                  {album.title}
                </h3>
                {album.year && <span className="album-year">({album.year})</span>}
                {album.summary && (
                  <p className="album-summary">{album.summary}</p>
                )}
                <div className="album-meta">
                  {album.genres && album.genres.length > 0 && (
                    <span className="genres">
                      {album.genres.slice(0, 2).join(', ')}
                    </span>
                  )}
                  {album.childCount && (
                    <span className="track-count">
                      {album.childCount} track{album.childCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <div className="album-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onExtractAlbumMetadata(album);
                    }}
                    className="extract-metadata-button"
                    disabled={extractingMetadata.has(album.ratingKey)}
                  >
                    {extractingMetadata.has(album.ratingKey) ? (
                      <>
                        <LoadingState type="spinner" />
                        Extracting...
                      </>
                    ) : (
                      <>
                        🏷️ Extract Metadata
                      </>
                    )}
                  </button>
                </div>
                {metadataResults[album.ratingKey] && (
                  <div className="metadata-results">
                    <small>
                      ✅ Metadata extracted: {metadataResults[album.ratingKey].successCount}/
                      {metadataResults[album.ratingKey].tracksProcessed} tracks
                    </small>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {albumsHasMore && (
          <div className="pagination-section">
            <button 
              onClick={onLoadMoreAlbums}
              className="load-more-button"
              disabled={albumsLoading}
            >
              {albumsLoading ? (
                <>
                  <LoadingState type="spinner" />
                  Loading...
                </>
              ) : (
                'Load More Albums'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicAlbumsView;
