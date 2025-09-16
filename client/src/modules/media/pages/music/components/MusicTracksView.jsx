import React from 'react';
import LoadingState from '../../../../../shared/components/LoadingState';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import './TracksPlaylistPlayer.css';

const MusicTracksView = ({ 
  tracks, 
  tracksLoading, 
  tracksHasMore,
  selectedAlbum,
  selectedArtist,
  selectedSection,
  searchQuery,
  currentTrack,
  isPlaying,
  playlists,
  onGoBackFromTracks,
  onPlayTrack,
  onLoadMoreTracks,
  onAddTrackToCustomPlaylist,
  formatDuration,
  formatFileSize
}) => {
  return (
    <div className="tracks-section">
      <div className="section-header">
        <button 
          className="back-button" 
          onClick={onGoBackFromTracks}
          title={selectedAlbum ? `Back to ${selectedAlbum.title}` : selectedArtist ? `Back to ${selectedArtist.title}` : 'Back to Artists'}
        >
          ← Back
        </button>
        <h2>
          {selectedAlbum ? `Tracks from ${selectedAlbum.title}` : 
           selectedArtist ? `All tracks by ${selectedArtist.title}` : 
           'All Tracks'}
        </h2>
      </div>

      {/* Playlist Player for all tracks */}
      {tracks && tracks.length > 0 && (
        <TracksPlaylistPlayer
          tracks={tracks}
          selectedSection={selectedSection}
          searchQuery={searchQuery}
          onPlayTrack={onPlayTrack}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          selectedAlbum={selectedAlbum}
          selectedArtist={selectedArtist}
        />
      )}

      <div className="tracks-list">
        {!Array.isArray(tracks) || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found{selectedAlbum ? ` for ${selectedAlbum.title}` : ''}.</p>
          </div>
        ) : (
          <div className="tracks-table">
            <div className="tracks-header">
              <span className="track-controls">▶</span>
              <span className="track-number">#</span>
              <span className="track-title">Title</span>
              <span className="track-duration">Duration</span>
              <span className="track-size">Size</span>
              <span className="track-playlist">Playlist</span>
            </div>
            {tracks.map(track => (
              <div key={track.ratingKey} className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}>
                <button 
                  className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                  onClick={() => onPlayTrack(track)}
                  title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                >
                  {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                </button>
                <span className="track-number">{track.index}</span>
                <div className="track-title">
                  <strong>{track.title}</strong>
                  {track.originalTitle && track.originalTitle !== track.title && (
                    <span className="original-title">({track.originalTitle})</span>
                  )}
                </div>
                <span className="track-duration">
                  {formatDuration(track.duration)}
                </span>
                <span className="track-size">
                  {formatFileSize(track.media?.[0]?.parts?.[0]?.size)}
                </span>
                <div className="track-playlist">
                  <div className="playlist-dropdown">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          onAddTrackToCustomPlaylist(parseInt(e.target.value), track);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                    >
                      <option value="">+ Add to...</option>
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
            ))}
          </div>
        )}
        {tracksHasMore && (
          <div className="pagination-section">
            <button 
              onClick={onLoadMoreTracks}
              className="load-more-button"
              disabled={tracksLoading}
            >
              {tracksLoading ? (
                <>
                  <LoadingState type="spinner" />
                  Loading...
                </>
              ) : (
                'Load More Tracks'
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MusicTracksView;
