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
  formatTime
}) => {
  if (!currentTrack) return null;

  return (
    <div className="audio-player">
      <div className="player-info">
        <span className="track-title">{currentTrack.title}</span>
        <span className="track-artist">{currentTrack.grandparentTitle}</span>
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
