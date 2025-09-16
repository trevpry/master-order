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
  const [isVisible, setIsVisible] = useState(false); // Hidden by default until music is played
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  // Function to get artwork URL for a track/media item
  const getArtworkUrl = (track) => {
    if (!track) return null;

    // Web videos don't have artwork
    if (track?.type === 'webvideo') {
      return null;
    }

    // First priority: Check for cached artwork (works for all media types)
    if (track?.localArtworkPath) {
      const filename = track.localArtworkPath.includes('\\') || track.localArtworkPath.includes('/')
        ? track.localArtworkPath.split(/[\\\/]/).pop()
        : track.localArtworkPath;
      console.log('🎨 Using cached artwork:', filename);
      return `${config.apiBaseUrl}/api/artwork/${filename}`;
    }

    // For comics, fallback to ComicVine artwork if no cached artwork
    if (track?.type === 'comic' && track?.comicDetails?.coverUrl) {
      console.log('🎨 Using ComicVine artwork (fallback):', track.comicDetails.coverUrl);
      return `${config.apiBaseUrl}/api/comicvine-artwork?url=${encodeURIComponent(track.comicDetails.coverUrl)}`;
    }

    // For books, use OpenLibrary artwork
    if (track?.type === 'book' && track?.bookCoverUrl) {
      console.log('🎨 Using OpenLibrary artwork:', track.bookCoverUrl);
      return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(track.bookCoverUrl)}`;
    }

    // For short stories, use story cover or fallback to containing book's cover
    if (track?.type === 'shortstory') {
      if (track?.storyCoverUrl) {
        console.log('🎨 Using short story cover artwork:', track.storyCoverUrl);
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(track.storyCoverUrl)}`;
      } else if (track?.containedInBookDetails?.coverUrl) {
        console.log('🎨 Using containing book cover artwork for short story:', track.containedInBookDetails.coverUrl);
        return `${config.apiBaseUrl}/api/openlibrary-artwork?url=${encodeURIComponent(track.containedInBookDetails.coverUrl)}`;
      }
    }

    // Prioritize TVDB artwork if available for TV content
    if (track?.tvdbArtwork?.url) {
      console.log('🎨 Using TVDB artwork:', track.tvdbArtwork.url);
      return `${config.apiBaseUrl}/api/tvdb-artwork?url=${encodeURIComponent(track.tvdbArtwork.url)}`;
    }

    // Fall back to Plex artwork
    const thumb = track?.thumb || track?.art;
    if (!thumb) return null;

    // Check if thumb is already a full URL (starts with http)
    if (thumb.startsWith('http')) {
      console.log('🎨 Using full artwork URL:', thumb);
      return thumb;
    }

    // Otherwise, it's a relative path, so add the base URL
    console.log('🎨 Using Plex artwork:', thumb);
    return `${config.apiBaseUrl}/api/artwork${thumb}`;
  };
  
  // Load playlist tracks when playlist changes
  useEffect(() => {
    if (playlist && playlist.id && (!tracks || tracks.length === 0)) {
      // Only load from API if we don't already have tracks directly provided
      console.log('🎵 Loading playlist tracks for playlist ID:', playlist.id);
      loadPlaylistTracks();
    }
  }, [playlist]);
  
  // Update current track when index changes
  useEffect(() => {
    const trackList = isShuffled ? shuffledTracks : tracks;
    console.log('🎵 [useEffect] Current track index changed to:', currentTrackIndex);
    console.log('🎵 [useEffect] Using track list:', isShuffled ? 'shuffled' : 'original', 'length:', trackList?.length);
    if (trackList && trackList.length > 0 && currentTrackIndex >= 0 && currentTrackIndex < trackList.length) {
      const newTrack = trackList[currentTrackIndex];
      console.log('🎵 [useEffect] Updating current track display:', newTrack.title, 'by', newTrack.artist, 'from', newTrack.album);
      setCurrentTrack(newTrack);
    } else {
      console.log('🎵 [useEffect] Invalid conditions - trackList length:', trackList?.length, 'currentTrackIndex:', currentTrackIndex);
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
  
  // Auto-play when tracks are loaded from event
  useEffect(() => {
    if (tracks && tracks.length > 0 && playlist && playlist.id && playlist.id.includes('tracks-playlist')) {
      // This is a tracks page playlist that should auto-play
      console.log('🎵 Auto-playing tracks playlist with', tracks.length, 'tracks', isShuffled ? '(shuffled)' : '');
      setCurrentTrackIndex(0);
      
      // Immediately set the current track for display
      const firstTrack = isShuffled && shuffledTracks && shuffledTracks.length > 0 
        ? shuffledTracks[0] 
        : tracks[0];
      
      if (firstTrack) {
        console.log('🎵 Setting current track for display:', firstTrack.title, 'by', firstTrack.artist);
        setCurrentTrack(firstTrack);
      }
      
      // Small delay to ensure all state is updated, including shuffled tracks
      const timer = setTimeout(() => {
        if (isShuffled && shuffledTracks && shuffledTracks.length > 0) {
          console.log('🎵 Playing first shuffled track:', shuffledTracks[0].title);
        } else {
          console.log('🎵 Playing first track:', tracks[0].title);
        }
        playTrack(0);
      }, 200); // Increased delay to ensure shuffled tracks are set
      
      return () => clearTimeout(timer);
    }
  }, [tracks, playlist, isShuffled, shuffledTracks]);

  // Event listener for starting music from reading sessions
  useEffect(() => {
    const handleStartMusicPlayback = (event) => {
      console.log('🎵 GlobalMusicPlayer received startMusicPlayback event:', event.detail);
      const { playlist, shuffle, sessionId } = event.detail;
      
      if (playlist && playlist.tracks && playlist.tracks.length > 0) {
        console.log('🎵 Starting playlist with', playlist.tracks.length, 'tracks');
        setPlaylist(playlist);
        setIsLoading(false); // Set loading to false since we have tracks directly
        setError(null); // Clear any existing errors
        
        if (shuffle) {
          const shuffledTracks = [...playlist.tracks].sort(() => Math.random() - 0.5);
          setShuffledTracks(shuffledTracks);
          setIsShuffled(true);
        } else {
          setIsShuffled(false);
        }
        
        // Set tracks (this will trigger the auto-play useEffect above)
        setTracks(playlist.tracks);
        setIsVisible(true);
        setIsMinimized(false);
      } else {
        console.log('❌ No valid playlist data received:', playlist);
      }
    };

    console.log('🎵 GlobalMusicPlayer: Adding event listener for startMusicPlayback');
    window.addEventListener('startMusicPlayback', handleStartMusicPlayback);
    
    // Event listener for external player controls
    const handlePlayerControl = (event) => {
      console.log('🎵 GlobalMusicPlayer received control event:', event.detail);
      const { action } = event.detail;
      
      switch (action) {
        case 'next':
          handleNextTrack();
          break;
        case 'previous':
          handlePreviousTrack();
          break;
        case 'toggle':
          togglePlayPause();
          break;
        default:
          console.log('Unknown control action:', action);
      }
    };
    
    window.addEventListener('globalMusicPlayerControl', handlePlayerControl);
    
    return () => {
      window.removeEventListener('startMusicPlayback', handleStartMusicPlayback);
      window.removeEventListener('globalMusicPlayerControl', handlePlayerControl);
    };
  }, []);
  
  const loadPlaylistTracks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check if playlist contains tracks directly (for ad-hoc playlists like from tracks page)
      if (playlist.tracks && Array.isArray(playlist.tracks)) {
        console.log('🎵 Using provided tracks directly:', playlist.tracks.length);
        setTracks(playlist.tracks);
        setIsShuffled(playlist.shuffle || false);
        setCurrentTrackIndex(0);
        
        // Auto-play first track if there are tracks
        if (playlist.tracks.length > 0) {
          console.log('🎵 Auto-playing first track:', playlist.tracks[0].title);
          setCurrentTrack(playlist.tracks[0]);
          setIsPlaying(true);
        }
        return;
      }
      
      // Otherwise, load from API (for saved playlists)
      console.log('🎵 Loading playlist tracks from API for:', playlist.id);
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
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (!trackList[trackIndex]) return;
    
    const track = trackList[trackIndex];
    console.log('🎵 [playTrack] Playing track at index:', trackIndex, '| Track:', track.title, 'by', track.artist);
    console.log('🎵 [playTrack] Current track index before:', currentTrackIndex, 'setting to:', trackIndex);
    
    setIsLoading(true);
    setError(null);
    
    try {
      const audio = audioRef.current;
      
      // If playing a different track, load new audio
      if (trackIndex !== currentTrackIndex) {
        console.log('🎵 [playTrack] Index changed, updating currentTrackIndex from', currentTrackIndex, 'to', trackIndex);
        setCurrentTrackIndex(trackIndex);
        setCurrentTime(0);
        setDuration(0);
      } else {
        console.log('🎵 [playTrack] Same track index, not updating currentTrackIndex');
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
          
          // Track change is handled by the useEffect that watches currentTrackIndex
          console.log('🎵 Successfully started playing:', track.title);
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
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (!trackList.length) return;
    
    let nextIndex;
    if (isRepeat) {
      nextIndex = currentTrackIndex;
    } else if (currentTrackIndex < trackList.length - 1) {
      nextIndex = currentTrackIndex + 1;
    } else {
      nextIndex = 0; // Loop back to first track
    }
    
    console.log('🎵 Moving to next track. Current index:', currentTrackIndex, 'Next index:', nextIndex);
    console.log('🎵 Next track will be:', trackList[nextIndex]?.title, 'by', trackList[nextIndex]?.artist);
    
    playTrack(nextIndex);
  };
  
  const handlePreviousTrack = () => {
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (!trackList.length) return;
    
    let prevIndex;
    if (currentTrackIndex > 0) {
      prevIndex = currentTrackIndex - 1;
    } else {
      prevIndex = trackList.length - 1; // Loop to last track
    }
    
    console.log('🎵 Moving to previous track. Current index:', currentTrackIndex, 'Previous index:', prevIndex);
    console.log('🎵 Previous track will be:', trackList[prevIndex]?.title, 'by', trackList[prevIndex]?.artist);
    
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
              <div className="track-artwork">
                {getArtworkUrl(currentTrack) ? (
                  <img 
                    src={getArtworkUrl(currentTrack)} 
                    alt={`${currentTrack.album || currentTrack.parentTitle || 'Album'} artwork`}
                    className="artwork-image"
                    onError={(e) => {
                      console.log('🎨 Artwork failed to load, hiding image');
                      e.target.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="artwork-placeholder">
                    🎵
                  </div>
                )}
              </div>
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
            <div className="mini-track-artwork">
              {getArtworkUrl(currentTrack) ? (
                <img 
                  src={getArtworkUrl(currentTrack)} 
                  alt="Album artwork"
                  className="mini-artwork-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="mini-artwork-placeholder">🎵</div>
              )}
            </div>
            <div className="mini-track-details">
              <span className="mini-track-title">{currentTrack?.title || 'No track loaded'}</span>
              <span className="mini-track-artist">
                {currentTrack?.artist || currentTrack?.grandparentTitle || 'Unknown artist'}
              </span>
            </div>
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
