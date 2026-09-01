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
  playlistFilter,
  onSelectAlbum, 
  onSelectArtist,
  onLoadMoreAlbums,
  onGoBackToArtists,
  onAddAlbumToCustomPlaylist,
  onExtractAlbumMetadata,
  onPlaylistFilterChange
}) => {
  const customPlaylists = playlists?.filter(p => p.type === 'custom') || [];

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
      
      {/* Playlist Filter */}
      {!selectedArtist && customPlaylists.length > 0 && (
        <div className="filter-section" style={{ 
          marginBottom: '20px', 
          padding: '15px', 
          backgroundColor: '#f8f9fa', 
          borderRadius: '8px',
          border: '1px solid #e9ecef'
        }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '8px', 
            fontWeight: '600',
            color: '#495057' 
          }}>
            Filter by Custom Playlist:
          </label>
          <select 
            value={playlistFilter || ''} 
            onChange={(e) => onPlaylistFilterChange(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #ced4da',
              backgroundColor: 'white',
              minWidth: '200px',
              fontSize: '14px'
            }}
          >
            <option value="">All Albums</option>
            {customPlaylists.map(playlist => (
              <option key={`in-${playlist.id}`} value={`in-${playlist.id}`}>
                In "{playlist.name}"
              </option>
            ))}
            {customPlaylists.map(playlist => (
              <option key={`not-in-${playlist.id}`} value={`not-in-${playlist.id}`}>
                NOT in "{playlist.name}"
              </option>
            ))}
          </select>
        </div>
      )}
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
                  
                  {/* Extract Metadata Button Overlay */}
                  <div className="album-metadata-overlay">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onExtractAlbumMetadata(album);
                      }}
                      className="metadata-icon-button"
                      disabled={extractingMetadata.has(album.ratingKey)}
                      title={extractingMetadata.has(album.ratingKey) ? 'Extracting metadata...' : 'Extract metadata'}
                    >
                      {extractingMetadata.has(album.ratingKey) ? (
                        <LoadingState type="spinner" />
                      ) : (
                        '🏷️'
                      )}
                    </button>
                  </div>
                </div>
              )}
              <div className="album-info">
                <h3 className="album-title-line" onClick={() => onSelectAlbum(album)} style={{ cursor: 'pointer' }}>
                  {album.title}
                  {album.year && <span className="album-year"> ({album.year})</span>}
                </h3>
                {(album.artist?.title || album.parentTitle) && (
                  <p className="album-artist-name">
                    {album.artist?.title || album.parentTitle}
                  </p>
                )}
                <div className="album-meta">
                  {album.genres && album.genres.length > 0 && (
                    <span className="genres">
                      {album.genres.slice(0, 2).join(', ')}
                    </span>
                  )}
                  {album.trackCount !== undefined && (
                    <span className="track-count">
                      {album.trackCount} track{album.trackCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {album.workCount !== undefined && (
                    <span className="work-count">
                      {album.workCount} work{album.workCount !== 1 ? 's' : ''}
                    </span>
                  )}
                  {album.totalPlayCount !== undefined && album.totalPlayCount > 0 && (
                    <span className="play-count">
                      • {album.totalPlayCount} {album.totalPlayCount === 1 ? 'play' : 'plays'}
                    </span>
                  )}
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
