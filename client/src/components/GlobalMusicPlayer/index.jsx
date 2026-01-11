import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../config';
import CastButton from './CastButton';
import SonosCastButton from './SonosCastButton';
import StarRating from '../StarRating';
import './GlobalMusicPlayer.css';

const GlobalMusicPlayer = () => {
  const navigate = useNavigate();
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
  const [isExpanded, setIsExpanded] = useState(false); // Full-screen view
  const [isVisible, setIsVisible] = useState(false); // Hidden by default until music is played
  const [isCasting, setIsCasting] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState('');
  const [castDeviceType, setCastDeviceType] = useState(''); // 'chromecast' or 'sonos'
  const [sonosDeviceRef, setSonosDeviceRef] = useState(null); // Reference to SONOS device for controls
  
  const audioRef = useRef(null);
  const progressRef = useRef(null);

  // Function to get artwork URL for a track/media item
  const getArtworkUrl = (track) => {
    if (!track) return null;

    console.log('🎨 Getting artwork URL for track:', {
      title: track.title,
      type: track.type,
      thumb: track.thumb,
      art: track.art,
      parentThumb: track.parentThumb,
      grandparentThumb: track.grandparentThumb
    });

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

    // Fall back to Plex artwork for music tracks
    // Priority: parentThumb (album art) > grandparentThumb (artist art) > thumb (track art) > art
    const thumb = track?.parentThumb || track?.grandparentThumb || track?.thumb || track?.art;
    if (!thumb) {
      console.log('🎨 No artwork available for track');
      return null;
    }

    // Check if thumb is already a full URL (starts with http)
    if (thumb.startsWith('http')) {
      console.log('🎨 Using full artwork URL:', thumb);
      return thumb;
    }

    // Otherwise, it's a relative path, so proxy through our API
    // Remove leading slash from thumb if present to avoid double slashes
    const cleanThumb = thumb.startsWith('/') ? thumb.substring(1) : thumb;
    const artworkUrl = `${config.apiBaseUrl}/api/artwork/${cleanThumb}`;
    console.log('🎨 Using Plex artwork via proxy:', artworkUrl);
    return artworkUrl;
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
      
      // Only update if the track has actually changed (different ratingKey)
      setCurrentTrack(prev => {
        if (!prev || prev.ratingKey !== newTrack.ratingKey) {
          console.log('🎵 [useEffect] Updating current track display:', newTrack.title, 'by', newTrack.artist, 'from', newTrack.album);
          console.log('🔍 [DEBUG] Full track object structure:', JSON.stringify(newTrack, null, 2));
          console.log('🔍 [DEBUG] Track properties:', {
            ratingKey: newTrack.ratingKey,
            grandparentRatingKey: newTrack.grandparentRatingKey,
            parentRatingKey: newTrack.parentRatingKey,
            title: newTrack.title,
            grandparentTitle: newTrack.grandparentTitle,
            parentTitle: newTrack.parentTitle,
            artist: newTrack.artist,
            album: newTrack.album,
            originalTitle: newTrack.originalTitle
          });
          return newTrack;
        }
        // Track hasn't changed, keep previous to avoid re-render
        console.log('🎵 [useEffect] Same track, not updating');
        return prev;
      });
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
    if (tracks && tracks.length > 0 && playlist && playlist.id && (playlist.id.includes('tracks-playlist') || playlist.id.includes('radio-playlist'))) {
      // This is a playlist that should auto-play
      console.log('🎵 Auto-playing playlist with', tracks.length, 'tracks', isShuffled ? '(shuffled)' : '');
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
  
  const togglePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio || !tracks[currentTrackIndex]) return;
    
    // Handle Sonos casting
    if (isCasting && castDeviceType === 'sonos' && sonosDeviceRef) {
      try {
        const action = isPlaying ? 'pause' : 'play';
        const response = await fetch(`${config.apiBaseUrl}/api/sonos/${action}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: sonosDeviceRef.uuid || sonosDeviceRef.host
          }),
        });
        
        if (response.ok) {
          setIsPlaying(!isPlaying);
          console.log(`🔊 Sonos ${action} successful`);
        } else {
          console.error(`Failed to ${action} on Sonos`);
        }
      } catch (error) {
        console.error(`Error controlling Sonos playback:`, error);
      }
      return;
    }
    
    // Handle local playback
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      playTrack(currentTrackIndex);
    }
  };
  
  const handleNextTrack = async () => {
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (!trackList.length) return;
    
    // Handle Sonos casting
    if (isCasting && castDeviceType === 'sonos' && sonosDeviceRef) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/api/sonos/next`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: sonosDeviceRef.uuid || sonosDeviceRef.host
          }),
        });
        
        if (response.ok) {
          // Update local state to match
          let nextIndex;
          if (isRepeat) {
            nextIndex = currentTrackIndex;
          } else if (currentTrackIndex < trackList.length - 1) {
            nextIndex = currentTrackIndex + 1;
          } else {
            nextIndex = 0;
          }
          setCurrentTrackIndex(nextIndex);
          setCurrentTrack(trackList[nextIndex]);
          console.log('🔊 Sonos next track successful');
        } else {
          console.error('Failed to skip to next track on Sonos');
        }
      } catch (error) {
        console.error('Error skipping Sonos track:', error);
      }
      return;
    }
    
    // Handle local playback
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
  
  const handlePreviousTrack = async () => {
    const trackList = isShuffled ? shuffledTracks : tracks;
    if (!trackList.length) return;
    
    // Handle Sonos casting
    if (isCasting && castDeviceType === 'sonos' && sonosDeviceRef) {
      try {
        const response = await fetch(`${config.apiBaseUrl}/api/sonos/previous`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: sonosDeviceRef.uuid || sonosDeviceRef.host
          }),
        });
        
        if (response.ok) {
          // Update local state to match
          let prevIndex;
          if (currentTrackIndex > 0) {
            prevIndex = currentTrackIndex - 1;
          } else {
            prevIndex = trackList.length - 1;
          }
          setCurrentTrackIndex(prevIndex);
          setCurrentTrack(trackList[prevIndex]);
          console.log('🔊 Sonos previous track successful');
        } else {
          console.error('Failed to skip to previous track on Sonos');
        }
      } catch (error) {
        console.error('Error going to previous Sonos track:', error);
      }
      return;
    }
    
    // Handle local playback
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
  
  const handleCastStateChange = (connected, deviceName, deviceType = 'chromecast', deviceRef = null) => {
    setIsCasting(connected);
    setCastDeviceName(deviceName);
    setCastDeviceType(connected ? deviceType : '');
    setSonosDeviceRef(deviceRef);
    
    if (connected) {
      // Pause local audio when casting
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
    } else {
      // When disconnecting, resume local playback if there was something playing
      console.log('🔊 Disconnected from cast device, resuming local playback');
    }
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
  
  const handleVolumeChange = async (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    
    // Update local audio volume
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    
    // Update SONOS volume if casting to SONOS
    if (castDeviceType === 'sonos' && sonosDeviceRef) {
      try {
        const sonosVolume = Math.round(newVolume * 100); // Convert 0-1 to 0-100
        const response = await fetch(`${config.apiBaseUrl}/api/sonos/volume`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            deviceId: sonosDeviceRef.uuid || sonosDeviceRef.host,
            volume: sonosVolume
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to set SONOS volume');
        }
      } catch (error) {
        console.error('Error setting SONOS volume:', error);
      }
    }
  };
  
  const toggleShuffle = () => {
    if (!isShuffled) {
      // Turning shuffle ON - create shuffled version
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setShuffledTracks(shuffled);
      setIsShuffled(true);
      
      // Find current track in shuffled array and update index
      if (currentTrack) {
        const newIndex = shuffled.findIndex(t => t.ratingKey === currentTrack.ratingKey);
        if (newIndex >= 0) {
          setCurrentTrackIndex(newIndex);
        }
      }
    } else {
      // Turning shuffle OFF - use original tracks order
      setIsShuffled(false);
      
      // Find current track in original array and update index
      if (currentTrack) {
        const newIndex = tracks.findIndex(t => t.ratingKey === currentTrack.ratingKey);
        if (newIndex >= 0) {
          setCurrentTrackIndex(newIndex);
        }
      }
    }
  };
  
  const toggleRepeat = () => {
    setIsRepeat(!isRepeat);
  };
  
  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
    if (isMinimized) {
      setIsMinimized(false);
    }
  };
  
  // Navigate to artist page
  const goToArtist = (artistRatingKey, artistName) => {
    if (!artistRatingKey) return;
    console.log('🎵 Navigating to artist:', artistName);
    navigate(`/media/music?view=albums&artist=${artistRatingKey}`);
  };
  
  // Navigate to album page
  const goToAlbum = (albumRatingKey, albumName) => {
    if (!albumRatingKey) return;
    console.log('🎵 Navigating to album:', albumName);
    navigate(`/media/music?view=album&album=${albumRatingKey}`);
  };
  
  const handleRatingChange = async (rating) => {
    if (!currentTrack) return;
    
    try {
      console.log('📊 Setting rating in player:', { trackRatingKey: currentTrack.ratingKey, rating });
      
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/${currentTrack.ratingKey}/rating`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rating }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Rating updated in player:', data.track.userRating);
        
        // ONLY update currentTrack - don't touch tracks/shuffledTracks arrays
        // to avoid triggering any effects that might restart playback
        setCurrentTrack(prev => {
          if (prev && prev.ratingKey === currentTrack.ratingKey) {
            return { ...prev, userRating: data.track.userRating };
          }
          return prev;
        });
      }
    } catch (error) {
      console.error('Error updating rating:', error);
    }
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
    <div className={`global-music-player ${isMinimized ? 'minimized' : ''} ${isExpanded ? 'expanded' : ''}`}>
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
            className="expand-btn"
            onClick={toggleExpanded}
            title={isExpanded ? 'Exit full screen' : 'Full screen view'}
          >
            {isExpanded ? '🗗' : '⛶'}
          </button>
          <button
            className="minimize-btn"
            onClick={() => {
              setIsMinimized(!isMinimized);
              if (isExpanded) setIsExpanded(false);
            }}
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
      
      {!isMinimized && !isExpanded && (
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
                  <span 
                    className="artist-link"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      console.log('🎵 Artist clicked:', {
                        grandparentRatingKey: currentTrack.grandparentRatingKey,
                        grandparentTitle: currentTrack.grandparentTitle,
                        originalTitle: currentTrack.originalTitle,
                        artist: currentTrack.artist,
                        album: currentTrack.album
                      });
                      const artistRatingKey = currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey;
                      const artistName = currentTrack.originalTitle || currentTrack.album?.parentTitle || currentTrack.grandparentTitle || currentTrack.artist;
                      if (artistRatingKey) {
                        goToArtist(artistRatingKey, artistName);
                      } else {
                        console.warn('No artist rating key found');
                      }
                    }}
                    style={{
                      cursor: (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) ? 'pointer' : 'default',
                      color: (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) ? '#007bff' : '#666',
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                    onMouseEnter={(e) => {
                      if (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) {
                        e.target.style.textDecoration = 'underline';
                      }
                    }}
                    onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                  >
                    {currentTrack.originalTitle || currentTrack.album?.parentTitle || currentTrack.grandparentTitle || currentTrack.artist}
                  </span>
                  {(currentTrack.album || currentTrack.parentTitle) && (
                    <>
                      {' • '}
                      <span
                        className="album-link"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('🎵 Album clicked:', {
                            parentRatingKey: currentTrack.parentRatingKey,
                            parentTitle: currentTrack.parentTitle,
                            album: currentTrack.album
                          });
                          const albumRatingKey = currentTrack.parentRatingKey;
                          const albumName = currentTrack.album || currentTrack.parentTitle;
                          if (albumRatingKey) {
                            goToAlbum(albumRatingKey, albumName);
                          } else {
                            console.warn('No album rating key found');
                          }
                        }}
                        style={{
                          cursor: currentTrack.parentRatingKey ? 'pointer' : 'default',
                          color: currentTrack.parentRatingKey ? '#007bff' : '#666',
                          textDecoration: 'none',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => {
                          if (currentTrack.parentRatingKey) {
                            e.target.style.textDecoration = 'underline';
                          }
                        }}
                        onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                      >
                        {currentTrack.album || currentTrack.parentTitle}
                      </span>
                    </>
                  )}
                </div>
                <div className="track-rating-display">
                  <StarRating
                    value={currentTrack.userRating || 0}
                    onChange={handleRatingChange}
                    size="small"
                  />
                </div>
                {isCasting && castDeviceName && (
                  <div className="casting-indicator">
                    📡 Casting to {castDeviceName}
                  </div>
                )}
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
          
          {/* Controls and Volume Section */}
          <div className="controls-volume-wrapper">
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
            
            {/* Cast Buttons */}
            <CastButton
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onCastStateChange={handleCastStateChange}
            />
            
            <SonosCastButton
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              onCastStateChange={handleCastStateChange}
            />
            
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
      
      {/* Expanded/Full Screen View */}
      {isExpanded && currentTrack && (
        <div className="expanded-view">
          <div className="expanded-content">
            {/* Large Artwork */}
            <div className="expanded-artwork">
              {getArtworkUrl(currentTrack) ? (
                <img 
                  src={getArtworkUrl(currentTrack)} 
                  alt={`${currentTrack.album || currentTrack.parentTitle || 'Album'} artwork`}
                  className="expanded-artwork-image"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="expanded-artwork-placeholder">
                  🎵
                </div>
              )}
            </div>
            
            {/* Track Info */}
            <div className="expanded-track-info">
              <h1 className="expanded-track-title">{currentTrack.title}</h1>
              <h2 
                className="expanded-track-artist"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const artistRatingKey = currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey;
                  const artistName = currentTrack.originalTitle || currentTrack.album?.parentTitle || currentTrack.grandparentTitle || currentTrack.artist;
                  console.log('🎵 Expanded artist clicked:', { artistRatingKey, artistName });
                  if (artistRatingKey) {
                    goToArtist(artistRatingKey, artistName);
                  }
                }}
                style={{
                  cursor: (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) ? 'pointer' : 'default',
                  color: (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) ? '#007bff' : 'inherit',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  if (currentTrack.grandparentRatingKey || currentTrack.album?.parentRatingKey) {
                    e.target.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {currentTrack.originalTitle || currentTrack.album?.parentTitle || currentTrack.grandparentTitle || currentTrack.artist}
              </h2>
              <p 
                className="expanded-track-album"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const albumRatingKey = currentTrack.parentRatingKey;
                  const albumName = currentTrack.album || currentTrack.parentTitle;
                  console.log('🎵 Expanded album clicked:', { albumRatingKey, albumName });
                  if (albumRatingKey) {
                    goToAlbum(albumRatingKey, albumName);
                  }
                }}
                style={{
                  cursor: currentTrack.parentRatingKey ? 'pointer' : 'default',
                  color: currentTrack.parentRatingKey ? '#007bff' : 'inherit',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  if (currentTrack.parentRatingKey) {
                    e.target.style.textDecoration = 'underline';
                  }
                }}
                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
              >
                {currentTrack.album || currentTrack.parentTitle}
              </p>
              <div className="expanded-track-rating">
                <StarRating
                  key={currentTrack.ratingKey}
                  value={currentTrack.userRating || 0}
                  onChange={handleRatingChange}
                  size="large"
                />
              </div>
              {isCasting && castDeviceName && (
                <div className="expanded-casting-indicator">
                  📡 Casting to {castDeviceName}
                </div>
              )}
            </div>
            
            {/* Progress Bar */}
            <div className="expanded-progress-section">
              <span className="expanded-time-display">{formatTime(currentTime)}</span>
              <div 
                className="expanded-progress-bar" 
                ref={progressRef}
                onClick={handleSeek}
              >
                <div 
                  className="expanded-progress-fill" 
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
              <span className="expanded-time-display">{formatTime(duration)}</span>
            </div>
            
            {/* Control Buttons */}
            <div className="expanded-controls">
              <button
                className={`expanded-control-btn ${isShuffled ? 'active' : ''}`}
                onClick={toggleShuffle}
                title="Toggle shuffle"
              >
                🔀
              </button>
              
              <button
                className="expanded-control-btn"
                onClick={handlePreviousTrack}
                disabled={!tracks.length}
                title="Previous track"
              >
                ⏮
              </button>
              
              <button
                className="expanded-play-pause-btn"
                onClick={togglePlayPause}
                disabled={!tracks.length || isLoading}
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isLoading ? '⏳' : (isPlaying ? '⏸' : '▶')}
              </button>
              
              <button
                className="expanded-control-btn"
                onClick={handleNextTrack}
                disabled={!tracks.length}
                title="Next track"
              >
                ⏭
              </button>
              
              <button
                className={`expanded-control-btn ${isRepeat ? 'active' : ''}`}
                onClick={toggleRepeat}
                title="Toggle repeat"
              >
                🔁
              </button>
            </div>
            
            {/* Volume and Cast */}
            <div className="expanded-bottom-controls">
              <div className="expanded-volume-section">
                <span className="volume-icon">🔊</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={handleVolumeChange}
                  className="expanded-volume-slider"
                />
              </div>
              
              <CastButton
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onCastStateChange={handleCastStateChange}
              />
              
              <SonosCastButton
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                onCastStateChange={handleCastStateChange}
              />
            </div>
          </div>
          
          {/* Up Next Queue */}
          <div className="up-next-section">
            <h3 className="up-next-title">Up Next</h3>
            <div className="up-next-list">
              {tracks.slice(currentTrackIndex + 1, currentTrackIndex + 11).map((track, index) => (
                <div 
                  key={track.ratingKey || index} 
                  className="up-next-item"
                  onClick={() => playTrack(currentTrackIndex + 1 + index)}
                >
                  <div className="up-next-artwork">
                    {getArtworkUrl(track) ? (
                      <img 
                        src={getArtworkUrl(track)} 
                        alt="Album artwork"
                        className="up-next-artwork-image"
                      />
                    ) : (
                      <div className="up-next-artwork-placeholder">🎵</div>
                    )}
                  </div>
                  <div className="up-next-info">
                    <div className="up-next-track-title">{track.title}</div>
                    <div className="up-next-track-artist">
                      {track.originalTitle || track.album?.parentTitle || track.grandparentTitle || 'Unknown Artist'}
                    </div>
                  </div>
                  <div className="up-next-duration">{formatTime(track.duration / 1000)}</div>
                </div>
              ))}
              {tracks.length <= currentTrackIndex + 1 && (
                <div className="up-next-empty">
                  <p>No more tracks in queue</p>
                </div>
              )}
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
