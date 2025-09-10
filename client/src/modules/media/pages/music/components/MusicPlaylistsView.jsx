import React from 'react';

const MusicPlaylistsView = ({ 
  playlists, 
  config,
  onSetShowCreatePlaylistModal,
  onDeleteCustomPlaylist
}) => {
  return (
    <div className="playlists-section">
      <div className="playlists-header">
        <h2>Playlists</h2>
        <button 
          className="create-playlist-button"
          onClick={() => onSetShowCreatePlaylistModal(true)}
        >
          + Create Custom Playlist
        </button>
      </div>
      
      <div className="playlists-grid">
        {playlists.length === 0 ? (
          <div className="empty-state">
            <p>No playlists found.</p>
            <p>Create your first custom playlist to get started!</p>
          </div>
        ) : (
          playlists.map(playlist => (
            <div key={`${playlist.type}-${playlist.ratingKey || playlist.id}`} className={`playlist-card ${playlist.type}-playlist`}>
              <div className="playlist-type-badge">
                {playlist.type === 'plex' ? 'Plex' : 'Custom'}
              </div>
              
              {playlist.type === 'custom' && (
                <div className="playlist-actions">
                  <button 
                    className="delete-playlist-button"
                    onClick={() => onDeleteCustomPlaylist(playlist.id)}
                    title="Delete Playlist"
                  >
                    🗑️
                  </button>
                </div>
              )}
              
              {playlist.thumb && playlist.type === 'plex' && (
                <div className="playlist-thumbnail">
                  <img 
                    src={`${config.plexUrl}${playlist.thumb}?X-Plex-Token=${config.plexToken}`}
                    alt={playlist.title}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}
              
              <div className="playlist-info">
                <h3>{playlist.title}</h3>
                {(playlist.summary || playlist.description) && (
                  <p className="playlist-summary">{playlist.summary || playlist.description}</p>
                )}
                
                <div className="playlist-meta">
                  <span className="track-count">
                    {playlist.leafCount || playlist.tracks?.length || 0} track{(playlist.leafCount || playlist.tracks?.length || 0) !== 1 ? 's' : ''}
                  </span>
                  
                  {playlist.duration && (
                    <span className="playlist-duration">
                      {Math.floor(playlist.duration / 60000)}:{String(Math.floor((playlist.duration % 60000) / 1000)).padStart(2, '0')}
                    </span>
                  )}
                  
                  {playlist.smart && (
                    <span className="smart-playlist">Smart Playlist</span>
                  )}
                  
                  {playlist.type === 'custom' && playlist.isPublic && (
                    <span className="public-playlist">Public</span>
                  )}
                  
                  {playlist.type === 'custom' && (
                    <span className="playlist-created">
                      Created {new Date(playlist.createdAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                
                {/* Show preview tracks for Plex playlists */}
                {playlist.items && playlist.items.length > 0 && (
                  <div className="playlist-preview">
                    <h4>Tracks:</h4>
                    <div className="playlist-tracks">
                      {playlist.items.slice(0, 5).map((item, index) => (
                        <div key={`${item.ratingKey}-${index}`} className="playlist-track">
                          <span className="track-index">{item.index}.</span>
                          <span className="track-title">
                            {item.track ? item.track.title : item.album ? item.album.title : 'Unknown'}
                          </span>
                        </div>
                      ))}
                      {playlist.items.length > 5 && (
                        <div className="playlist-more">
                          ...and {playlist.items.length - 5} more tracks
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Show preview tracks for Custom playlists */}
                {playlist.tracks && playlist.tracks.length > 0 && (
                  <div className="playlist-preview">
                    <h4>Tracks:</h4>
                    <div className="playlist-tracks">
                      {playlist.tracks.slice(0, 5).map((track, index) => (
                        <div key={track.id} className="playlist-track">
                          <span className="track-index">{index + 1}.</span>
                          <span className="track-title">{track.title}</span>
                          {track.artist && <span className="track-artist">by {track.artist}</span>}
                        </div>
                      ))}
                      {playlist.tracks.length > 5 && (
                        <div className="playlist-more">
                          ...and {playlist.tracks.length - 5} more tracks
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MusicPlaylistsView;
