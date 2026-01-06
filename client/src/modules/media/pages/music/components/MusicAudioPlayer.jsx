import React from 'react';

const MusicAudioPlayer = ({
  currentTrack,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
  onSelectArtist,
  onSelectAlbum,
  formatTime
}) => {
  if (!currentTrack) return null;

  const handleArtistClick = (e) => {
    e.stopPropagation();
    if (onSelectArtist && currentTrack.grandparentRatingKey) {
      onSelectArtist({ 
        ratingKey: currentTrack.grandparentRatingKey, 
        title: currentTrack.grandparentTitle 
      });
    }
  };

  const handleAlbumClick = (e) => {
    e.stopPropagation();
    if (onSelectAlbum && currentTrack.parentRatingKey) {
      onSelectAlbum({ 
        ratingKey: currentTrack.parentRatingKey, 
        title: currentTrack.parentTitle 
      });
    }
  };

  return (
    <div className="audio-player">
      <div className="player-info">
        <span className="track-title">{currentTrack.title}</span>
        <div className="track-meta-links">
          {currentTrack.grandparentTitle && (
            <span 
              className="track-artist"
              onClick={handleArtistClick}
              style={{
                cursor: onSelectArtist && currentTrack.grandparentRatingKey ? 'pointer' : 'default',
                color: onSelectArtist && currentTrack.grandparentRatingKey ? '#007bff' : 'inherit',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                if (onSelectArtist && currentTrack.grandparentRatingKey) {
                  e.target.style.textDecoration = 'underline';
                }
              }}
              onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
            >
              {currentTrack.grandparentTitle}
            </span>
          )}
          {currentTrack.parentTitle && (
            <>
              {currentTrack.grandparentTitle && ' • '}
              <span
                className="track-album"
                onClick={handleAlbumClick}
                style={{
                  cursor: onSelectAlbum && currentTrack.parentRatingKey ? 'pointer' : 'default',
                  color: onSelectAlbum && currentTrack.parentRatingKey ? '#007bff' : 'inherit',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  if (onSelectAlbum && currentTrack.parentRatingKey) {
                    e.target.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {currentTrack.parentTitle}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="player-controls">
        <button 
          onClick={onPlayPause}
          className="play-pause-btn"
          disabled={isLoading}
        >
          {isLoading ? '⏳' : (isPlaying ? '⏸' : '▶')}
        </button>
        <div className="progress-container">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={(e) => onSeek(e.target.value)}
            className="progress-bar"
          />
          <div className="time-display">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="volume-container">
          <span>🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(e.target.value)}
            className="volume-bar"
          />
        </div>
      </div>
    </div>
  );
};

export default MusicAudioPlayer;
