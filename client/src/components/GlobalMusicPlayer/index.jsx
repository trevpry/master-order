import React, { useState, useRef, useEffect } from 'react';
import config from '../../config';
import './GlobalMusicPlayer.css';

const GlobalMusicPlayer = () => {
  const [playlist, setPlaylist] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledTracks, setShuffledTracks] = useState([]);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true); // Make visible by default for testing
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);
  
  // Load playlist tracks when playlist changes
  useEffect(() => {
    if (playlist && playlist.id) {
      loadPlaylistTracks();
    }
  }, [playlist]);
  
  // Update current track when index changes
  useEffect(() => {
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (trackList && trackList.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < trackList.length) {
      setCurrentTrack(trackList[currentTrackIndex]);
    }
  }, [currentTrackIndex, tracks, shuffledTracks, isShuffled]);
  
  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };
    
    const handleEnded = () => {
      handleNextTrack();
    };
    
    const handleError = () => {
      setError('Failed to load audio track');
      setIsPlaying(false);
      setIsLoading(false);
    };
    
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
    };
  }, [tracks, currentTrackIndex, isRepeat]);
  
  // Event listener for starting music from reading sessions
  useEffect(() => {
    const handleStartMusicPlayback = (event) => {
      console.log('🎵 GlobalMusicPlayer received startMusicPlayback event:', event.detail);
      const { playlist, shuffle, sessionId } = event.detail;
      
      if (playlist && playlist.tracks && playlist.tracks.length > 0) {
        console.log('🎵 Starting playlist with', playlist.tracks.length, 'tracks');
        setPlaylist(playlist);
        setTracks(playlist.tracks);
        
        if (shuffle) {
          const shuffledTracks = [...playlist.tracks].sort(() => Math.random() - 0.5);
          setShuffledTracks(shuffledTracks);
          setIsShuffled(true);
          
          setCurrentTrackIndex(0);
          const firstTrack = shuffledTracks[0];
          setCurrentTrack(firstTrack);
          
          // Start playing the first track
          const audioElement = audioRef.current;
          if (audioElement && firstTrack) {
            console.log('🎵 Starting to play first track:', firstTrack.title);
            audioElement.src = `${config.apiBaseUrl}/api/music/stream/${firstTrack.id}`;
            audioElement.play().catch(err => {
              console.error('Error playing track:', err);
              setError(`Failed to play ${firstTrack.title}`);
            });
          }
        } else {
          setCurrentTrackIndex(0);
          const firstTrack = playlist.tracks[0];
          setCurrentTrack(firstTrack);
          
          // Start playing the first track
          const audioElement = audioRef.current;
          if (audioElement && firstTrack) {
            console.log('🎵 Starting to play first track (no shuffle):', firstTrack.title);
            audioElement.src = `${config.apiBaseUrl}/api/music/stream/${firstTrack.id}`;
            audioElement.play().catch(err => {
              console.error('Error playing track:', err);
              setError(`Failed to play ${firstTrack.title}`);
            });
          }
        }
        
        setIsVisible(true);
        setIsMinimized(false);
        setIsPlaying(true);
      } else {
        console.log('❌ No valid playlist data received:', playlist);
      }
    };

    console.log('🎵 GlobalMusicPlayer: Adding event listener for startMusicPlayback');
    window.addEventListener('startMusicPlayback', handleStartMusicPlayback);
    
    return () => {
      window.removeEventListener('startMusicPlayback', handleStartMusicPlayback);
    };
  }, []);
  
  const loadPlaylistTracks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch(
        `${config.apiBaseUrl}/api/playlists/${playlist.type}/${playlist.id}/tracks?shuffle=${playlist.shuffle || false}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load playlist tracks');
      }
      
      const data = await response.json();
      setTracks(data.tracks || []);
      setIsShuffled(data.shuffled || false);
      setCurrentTrackIndex(0);
      
      // Auto-play first track if there are tracks
      if (data.tracks && data.tracks.length > 0) {
        setTimeout(() => {
          playTrack(0);
        }, 500);
      }
    } catch (error) {
      console.error('Error loading playlist tracks:', error);
      setError('Failed to load playlist');
    } finally {
      setIsLoading(false);
    }
  };
  
  const playTrack = async (trackIndex = currentTrackIndex) => {
    if (!tracks[trackIndex]) return;
    
    const track = tracks[trackIndex];
    setIsLoading(true);
    setError(null);
    
    try {
      const audio = audioRef.current;
      
      // If playing a different track, load new audio
      if (trackIndex !== currentTrackIndex) {
        setCurrentTrackIndex(trackIndex);
        setCurrentTime(0);
        setDuration(0);
      }
      
      // Get stream URL based on track type
      let streamUrl;
      if (track.type === 'plex' && track.ratingKey) {
        streamUrl = `${config.apiBaseUrl}/api/music/stream/${track.ratingKey}`;
      } else if (track.type === 'custom' && track.ratingKey) {
        streamUrl = `${config.apiBaseUrl}/api/music/stream/${track.ratingKey}`;
      } else {
        throw new Error('Invalid track data');
      }
      
      // Set audio source and play
      audio.src = streamUrl;
      audio.volume = volume;
      
      const playAudio = async () => {
        try {
          await audio.play();
          setIsPlaying(true);
          
          // Notify parent component of track change
          if (onTrackChange) {
            onTrackChange(track, trackIndex);
          }
        } catch (playError) {
          if (playError.name === 'NotAllowedError') {
            setError('Audio playback blocked. Please interact with the page first.');
          } else {
            setError(`Playback failed: ${playError.message}`);
          }
        }
      };
      
      if (audio.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
        await playAudio();
      } else {
        const onCanPlay = () => {
          audio.removeEventListener('canplay', onCanPlay);
          playAudio();
        };
        audio.addEventListener('canplay', onCanPlay, { once: true });
      }
    } catch (error) {
      console.error('Error playing track:', error);
      setError('Failed to play track');
    } finally {
      setIsLoading(false);
    }
  };
  
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio || !tracks[currentTrackIndex]) return;
    
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      playTrack(currentTrackIndex);
    }
  };
  
  const handleNextTrack = () => {
    if (!tracks.length) return;
    
    let nextIndex;
    if (isRepeat) {
      nextIndex = currentTrackIndex;
    } else if (currentTrackIndex < tracks.length - 1) {
      nextIndex = currentTrackIndex + 1;
    } else {
      nextIndex = 0; // Loop back to first track
    }
    
    playTrack(nextIndex);
  };
  
  const handlePreviousTrack = () => {
    if (!tracks.length) return;
    
    let prevIndex;
    if (currentTrackIndex > 0) {
      prevIndex = currentTrackIndex - 1;
    } else {
      prevIndex = tracks.length - 1; // Loop to last track
    }
    
    playTrack(prevIndex);
  };
  
  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };
  
  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };
  
  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
    // Re-shuffle tracks if turning shuffle on
    if (!isShuffled) {
      const shuffledTracks = [...tracks].sort(() => Math.random() - 0.5);
      setTracks(shuffledTracks);
      setCurrentTrackIndex(0);
    } else {
      // Reload tracks in original order
      loadPlaylistTracks();
    }
  };
  
  const toggleRepeat = () => {
    setIsRepeat(!isRepeat);
  };
  
  const formatTime = (time) => {
    if (!time || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className={`global-music-player ${isMinimized ? 'minimized' : ''}`}>
      <audio ref={audioRef} preload="metadata" />
      
      <div className="player-header">
        <div className="playlist-info">
          <span className="playlist-title">🎵 {playlist?.title || 'Music Player'}</span>
          <span className="playlist-meta">
            {tracks.length} tracks {isShuffled ? '(shuffled)' : ''}
          </span>
        </div>
        <div className="player-controls-header">
          <button
            className="minimize-btn"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand player' : 'Minimize player'}
          >
            {isMinimized ? '▲' : '▼'}
          </button>
          <button
            className="close-btn"
            onClick={() => {
              // Stop playing and hide the player
              setIsPlaying(false);
              setIsVisible(false);
              const audio = audioRef.current;
              if (audio) {
                audio.pause();
              }
            }}
            title="Stop music and close player"
          >
            ✕
          </button>
        </div>
      </div>
      
      {!isMinimized && (
        <>
          {/* Current Track Info */}
          {currentTrack && (
            <div className="current-track">
              <div className="track-info">
                <div className="track-title">{currentTrack.title}</div>
                <div className="track-meta">
                  {currentTrack.artist || currentTrack.grandparentTitle}
                  {(currentTrack.album || currentTrack.parentTitle) && 
                    ` • ${currentTrack.album || currentTrack.parentTitle}`
                  }
                </div>
              </div>
            </div>
          )}
          
          {/* Progress Bar */}
          <div className="progress-section">
            <span className="time-display">{formatTime(currentTime)}</span>
            <div 
              className="progress-bar" 
              ref={progressRef}
              onClick={handleSeek}
            >
              <div 
                className="progress-fill" 
                style={{ 
                  width: duration ? `${(currentTime / duration) * 100}%` : '0%' 
                }}
              />
            </div>
            <span className="time-display">{formatTime(duration)}</span>
          </div>
          
          {/* Control Buttons */}
          <div className="player-controls">
            <button
              className={`control-btn ${isShuffled ? 'active' : ''}`}
              onClick={toggleShuffle}
              title="Toggle shuffle"
            >
              🔀
            </button>
            
            <button
              className="control-btn"
              onClick={handlePreviousTrack}
              disabled={!tracks.length}
              title="Previous track"
            >
              ⏮
            </button>
            
            <button
              className="play-pause-btn"
              onClick={togglePlayPause}
              disabled={!tracks.length || isLoading}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isLoading ? '⏳' : (isPlaying ? '⏸' : '▶')}
            </button>
            
            <button
              className="control-btn"
              onClick={handleNextTrack}
              disabled={!tracks.length}
              title="Next track"
            >
              ⏭
            </button>
            
            <button
              className={`control-btn ${isRepeat ? 'active' : ''}`}
              onClick={toggleRepeat}
              title="Toggle repeat"
            >
              🔁
            </button>
          </div>
          
          {/* Volume Control */}
          <div className="volume-section">
            <span className="volume-icon">🔊</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
        </>
      )}
      
      {/* Minimized View */}
      {isMinimized && currentTrack && (
        <div className="minimized-controls">
          <button
            className="mini-control-btn"
            onClick={handlePreviousTrack}
            disabled={!tracks.length}
          >
            ⏮
          </button>
          
          <button
            className="mini-play-pause-btn"
            onClick={togglePlayPause}
            disabled={!tracks.length || isLoading}
          >
            {isLoading ? '⏳' : (isPlaying ? '⏸' : '▶')}
          </button>
          
          <button
            className="mini-control-btn"
            onClick={handleNextTrack}
            disabled={!tracks.length}
          >
            ⏭
          </button>
          
          <div className="mini-track-info">
            <span className="mini-track-title">{currentTrack?.title || 'No track loaded'}</span>
            <span className="mini-track-artist">
              {currentTrack?.artist || currentTrack?.grandparentTitle || 'Unknown artist'}
            </span>
          </div>
        </div>
      )}
      
      {/* Error Display */}
      {error && (
        <div className="player-error">
          {error}
        </div>
      )}
      
      {/* Debug button for testing */}
      <div style={{ padding: '1rem', textAlign: 'center' }}>
        <button 
          onClick={() => {
            console.log('🎵 Test button clicked - current state:', {
              playlist,
              tracks: tracks.length,
              isPlaying,
              currentTrack: currentTrack?.title,
              isVisible
            });
          }}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Debug Music Player State
        </button>
      </div>
    </div>
  );
};

export default GlobalMusicPlayer;
