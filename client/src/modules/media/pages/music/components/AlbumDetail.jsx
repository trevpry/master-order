import React, { useState, useEffect } from 'react';
import config from '../../../../../config';
import TracksPlaylistPlayer from './TracksPlaylistPlayer';
import StarRating from '../../../../../components/StarRating';
import './AlbumDetail.css';

const AlbumDetail = ({
  album,
  tracks: initialTracks,
  currentTrack,
  isPlaying,
  playlists,
  selectedSection,
  onGoBack,
  onPlayTrack,
  onSelectArtist,
  onAddTrackToCustomPlaylist,
  formatDuration,
  formatFileSize
}) => {
  if (!album) return null;
  
  const [tracks, setTracks] = useState(initialTracks);
  
  // Sync local state when prop changes
  useEffect(() => {
    setTracks(initialTracks);
  }, [initialTracks]);
  
  const handleRatingChange = async (trackRatingKey, newRating) => {
    try {
      console.log('📊 Setting rating:', { trackRatingKey, rating: newRating });
      
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${trackRatingKey}/rating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating: newRating }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Rating updated successfully:', data.track.userRating);
        // Update local state with new rating
        setTracks(prevTracks =>
          prevTracks.map(t =>
            t.ratingKey === trackRatingKey
              ? { ...t, userRating: data.track.userRating }
              : t
          )
        );
      } else {
        console.error('Failed to update rating:', await response.text());
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
  };

  return (
    <div className="album-detail">
      {/* Header with Back Button */}
      <div className="album-detail-header">
        <button className="back-button" onClick={onGoBack}>
          ← Back to Albums
        </button>
      </div>

      {/* Album Info Section */}
      <div className="album-info">
        {album.thumb && (
          <div className="album-artwork">
            <img 
              src={`${config.plexUrl}${album.thumb}?X-Plex-Token=${config.plexToken}`}
              alt={album.title}
              onError={(e) => {
                console.error('Album artwork failed to load');
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}
        
        <div className="album-metadata">
          <h1 className="album-title">{album.title}</h1>
          <p 
            className="album-artist"
            onClick={() => {
              if (album.parentRatingKey && onSelectArtist) {
                onSelectArtist({ ratingKey: album.parentRatingKey, title: album.parentTitle });
              }
            }}
            style={{
              cursor: onSelectArtist && album.parentRatingKey ? 'pointer' : 'default',
              color: onSelectArtist && album.parentRatingKey ? '#007bff' : '#666'
            }}
            title={onSelectArtist && album.parentRatingKey ? `View ${album.parentTitle || 'artist'}'s albums` : ''}
            onMouseEnter={(e) => {
              if (onSelectArtist && album.parentRatingKey) {
                e.target.style.textDecoration = 'underline';
              }
            }}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            {album.parentTitle || album.artist?.title || 'Various Artists'}
          </p>
          
          <div className="album-details">
            {album.year && <span className="album-year">{album.year}</span>}
            {tracks && tracks.length > 0 && (
              <span className="album-track-count">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {album.summary && (
            <p className="album-summary">{album.summary}</p>
          )}
        </div>
      </div>

      {/* Playlist Player */}
      {tracks && tracks.length > 0 && (
        <TracksPlaylistPlayer
          tracks={tracks}
          selectedSection={selectedSection}
          searchQuery=""
          onPlayTrack={onPlayTrack}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          selectedAlbum={album}
          selectedArtist={null}
        />
      )}

      {/* Tracks List */}
      <div className="album-tracks">
        <h2>Tracks</h2>
        {!tracks || tracks.length === 0 ? (
          <div className="empty-state">
            <p>No tracks found for this album.</p>
          </div>
        ) : (
          <div className="tracks-table">
            <div className="tracks-header">
              <span className="track-controls">▶</span>
              <span className="track-number">#</span>
              <span className="track-title">Title</span>
              <span className="track-rating">Rating</span>
              <span className="track-duration">Duration</span>
              <span className="track-size">Size</span>
              <span className="track-playlist">Playlist</span>
            </div>
            {tracks.map((track, index) => (
              <div 
                key={track.ratingKey} 
                className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}
              >
                <button 
                  className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                  onClick={() => onPlayTrack(track)}
                  title={currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'Pause' : 'Play'}
                >
                  {currentTrack?.ratingKey === track.ratingKey && isPlaying ? '⏸' : '▶'}
                </button>
                <span className="track-number">{track.index || index + 1}</span>
                <div className="track-title">
                  <div className="track-name">{track.title || 'Untitled'}</div>
                  {track.originalTitle && (
                    <div className="track-subtitle">{track.originalTitle}</div>
                  )}
                </div>
                <div className="track-rating">
                  <StarRating
                    value={track.userRating || 0}
                    onChange={(rating) => handleRatingChange(track.ratingKey, rating)}
                    size="small"
                  />
                </div>
                <span className="track-duration">{formatDuration(track.duration)}</span>
                <span className="track-size">{formatFileSize(track.size)}</span>
                <div className="track-playlist">
                  {playlists && playlists.length > 0 ? (
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          onAddTrackToCustomPlaylist(parseInt(e.target.value), track);
                          e.target.value = '';
                        }
                      }}
                      className="playlist-select"
                    >
                      <option value="">+ Add to Playlist</option>
                      {playlists.map(playlist => (
                        <option key={playlist.id} value={playlist.id}>
                          {playlist.title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="no-playlists">No playlists</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbumDetail;
