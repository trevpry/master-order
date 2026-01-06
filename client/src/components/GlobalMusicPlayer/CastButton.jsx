import React, { useEffect, useState, useRef } from 'react';
import './CastButton.css';

const CastButton = ({ currentTrack, isPlaying, onCastStateChange }) => {
  const [castAvailable, setCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const [castDeviceName, setCastDeviceName] = useState('');
  const castContextRef = useRef(null);
  const remotePlayerRef = useRef(null);
  const remotePlayerControllerRef = useRef(null);

  useEffect(() => {
    // Initialize Cast SDK
    const initializeCast = () => {
      if (!window.chrome || !window.chrome.cast) {
        console.log('⚡ Google Cast SDK not loaded yet, retrying...');
        setTimeout(initializeCast, 1000);
        return;
      }

      try {
        const castContext = window.cast.framework.CastContext.getInstance();
        castContextRef.current = castContext;

        // Configure Cast options
        castContext.setOptions({
          receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });

        setCastAvailable(true);
        console.log('✅ Google Cast initialized');

        // Listen for session state changes
        castContext.addEventListener(
          window.cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
          (event) => {
            console.log('🎵 Cast session state changed:', event.sessionState);
            handleSessionStateChange(event.sessionState);
          }
        );

        // Initialize remote player
        const remotePlayer = new window.cast.framework.RemotePlayer();
        const remotePlayerController = new window.cast.framework.RemotePlayerController(remotePlayer);
        
        remotePlayerRef.current = remotePlayer;
        remotePlayerControllerRef.current = remotePlayerController;

        // Check if already connected
        const session = castContext.getCurrentSession();
        if (session) {
          setCastConnected(true);
          setCastDeviceName(session.getCastDevice().friendlyName);
        }

      } catch (error) {
        console.error('❌ Failed to initialize Cast:', error);
        // Show button anyway so user knows casting is attempted
        setCastAvailable(true);
      }
    };

    // Show button immediately while SDK loads
    setCastAvailable(true);

    // Wait for Cast SDK to load
    if (window.__onGCastApiAvailable) {
      initializeCast();
    } else {
      window.__onGCastApiAvailable = (isAvailable) => {
        if (isAvailable) {
          initializeCast();
        }
      };
    }
  }, []);

  const handleSessionStateChange = (sessionState) => {
    const isConnected = sessionState === window.cast.framework.SessionState.SESSION_STARTED ||
                       sessionState === window.cast.framework.SessionState.SESSION_RESUMED;
    
    setCastConnected(isConnected);
    
    if (isConnected) {
      const session = castContextRef.current.getCurrentSession();
      const deviceName = session.getCastDevice().friendlyName;
      setCastDeviceName(deviceName);
      console.log(`🎵 Connected to ${deviceName}`);
      
      if (onCastStateChange) {
        onCastStateChange(true, deviceName);
      }
    } else {
      setCastDeviceName('');
      console.log('🎵 Disconnected from Cast device');
      
      if (onCastStateChange) {
        onCastStateChange(false, '');
      }
    }
  };

  const handleCastClick = () => {
    if (!castContextRef.current) {
      console.error('Cast context not initialized');
      return;
    }

    if (castConnected) {
      // Stop casting
      castContextRef.current.endCurrentSession(true);
    } else {
      // Request cast session
      castContextRef.current.requestSession()
        .then(() => {
          console.log('✅ Cast session started');
          // Load current track if available
          if (currentTrack) {
            loadTrackToCast(currentTrack, isPlaying);
          }
        })
        .catch((error) => {
          if (error !== 'cancel') {
            console.error('Failed to start cast session:', error);
          }
        });
    }
  };

  const loadTrackToCast = (track, shouldPlay = true) => {
    if (!castConnected || !castContextRef.current) return;

    const session = castContextRef.current.getCurrentSession();
    if (!session) return;

    // Construct the audio stream URL
    const streamUrl = `${window.location.origin}/api/music/stream/${track.ratingKey}`;

    // Create media info
    const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, 'audio/mpeg');
    
    // Add metadata
    const metadata = new window.chrome.cast.media.MusicTrackMediaMetadata();
    metadata.title = track.title || 'Unknown Track';
    metadata.artist = track.artist || 'Unknown Artist';
    metadata.albumName = track.album || 'Unknown Album';
    
    // Add artwork if available
    if (track.parentThumb || track.thumb || track.art) {
      const artworkUrl = track.parentThumb || track.thumb || track.art;
      const fullArtworkUrl = `${window.location.origin}/api/artwork${artworkUrl}`;
      metadata.images = [new window.chrome.cast.Image(fullArtworkUrl)];
    }
    
    mediaInfo.metadata = metadata;

    // Create load request
    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = shouldPlay;

    // Load media
    session.loadMedia(request)
      .then(() => {
        console.log('✅ Media loaded to Cast device');
      })
      .catch((error) => {
        console.error('Failed to load media:', error);
      });
  };

  // Expose method to load track from parent
  useEffect(() => {
    if (castConnected && currentTrack) {
      loadTrackToCast(currentTrack, isPlaying);
    }
  }, [currentTrack?.ratingKey, castConnected]);

  // Control playback when isPlaying changes
  useEffect(() => {
    if (!castConnected || !remotePlayerControllerRef.current) return;

    const remotePlayer = remotePlayerRef.current;
    const controller = remotePlayerControllerRef.current;

    if (remotePlayer.isPaused !== !isPlaying) {
      if (isPlaying) {
        controller.playOrPause();
      } else {
        controller.playOrPause();
      }
    }
  }, [isPlaying, castConnected]);

  // Always show the button
  return (
    <div className="cast-button-container">
      <button
        className={`cast-button ${castConnected ? 'connected' : ''} ${!castContextRef.current ? 'disabled' : ''}`}
        onClick={handleCastClick}
        disabled={!castContextRef.current}
        title={castConnected ? `Casting to ${castDeviceName}` : (castContextRef.current ? 'Cast to device' : 'Cast loading...')}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          {castConnected ? (
            // Connected icon
            <>
              <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              <circle cx="6" cy="18" r="1"/>
            </>
          ) : (
            // Disconnected icon
            <path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          )}
        </svg>
        {castConnected && castDeviceName && (
          <span className="cast-device-name">{castDeviceName}</span>
        )}
      </button>
    </div>
  );
};

export default CastButton;
