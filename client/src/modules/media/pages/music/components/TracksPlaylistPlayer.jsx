/**
 * Tracks Playlist Player Component
 * Part of Eddie Life Management - Music Module
 * 
 * Provides a playlist player for shuffling and playing all tracks on the tracks page
 * Follows modular architecture with reusable audio player utilities
 */

import React, { useState, useRef, useEffect } from 'react';
import config from '../../../../../config';

const TracksPlaylistPlayer = ({ 
  tracks, 
  selectedSection,
  searchQuery,
  onPlayTrack, 
  currentTrack, 
  isPlaying: externalIsPlaying,
  selectedAlbum,
  selectedArtist 
}) => {
  const [isShuffled, setIsShuffled] = useState(false);
  const [shuffledTracks, setShuffledTracks] = useState([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);

  // Update playing state when external state changes
  useEffect(() => {
    setIsPlaying(externalIsPlaying);
  }, [externalIsPlaying]);

  // Initialize shuffled tracks
  useEffect(() => {
    if (tracks && tracks.length > 0) {
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setShuffledTracks(shuffled);
    }
  }, [tracks]);

  // Update current track index when current track changes
  useEffect(() => {
    if (currentTrack && tracks) {
      const trackList = isShuffled ? shuffledTracks : tracks;
      const index = trackList.findIndex(track => track.ratingKey === currentTrack.ratingKey);
      setCurrentTrackIndex(index);
    } else {
      setCurrentTrackIndex(-1);
    }
  }, [currentTrack, tracks, shuffledTracks, isShuffled]);

  const getDisplayName = () => {
    if (selectedAlbum) {
      return `${selectedAlbum.title} by ${selectedAlbum.parentTitle || selectedArtist?.title || 'Unknown Artist'}`;
    } else if (selectedArtist) {
      return `All tracks by ${selectedArtist.title}`;
    }
    return 'All Tracks';
  };

  // Load all tracks matching current filters (no pagination)
  const loadAllTracks = async () => {
    try {
      setIsLoading(true);
      setError(null);

      let url;
      if (searchQuery && searchQuery.trim()) {
        // For search, respect the selected section
        if (selectedSection !== 'all') {
          url = `${config.apiBaseUrl}/api/music/tracks/section/${selectedSection}?search=${encodeURIComponent(searchQuery)}&limit=10000`;
        } else {
          url = `${config.apiBaseUrl}/api/music/tracks?search=${encodeURIComponent(searchQuery)}&limit=10000`;
        }
      } else if (selectedSection !== 'all') {
        url = `${config.apiBaseUrl}/api/music/tracks/section/${selectedSection}?limit=10000`;
      } else {
        url = `${config.apiBaseUrl}/api/music/tracks?limit=10000`;
      }

      console.log('🎵 Loading all tracks from:', url);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch all tracks (${response.status})`);
      }

      const data = await response.json();
      const allTracks = Array.isArray(data.tracks) ? data.tracks : (Array.isArray(data) ? data : []);
      
      console.log(`🎵 Loaded ${allTracks.length} total tracks for playlist`);
      return allTracks;

    } catch (err) {
      console.error('Error loading all tracks:', err);
      setError(`Failed to load all tracks: ${err.message}`);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const handleShuffle = () => {
    if (!tracks || tracks.length === 0) return;

    const newShuffled = !isShuffled;
    setIsShuffled(newShuffled);
    
    if (newShuffled) {
      // Create shuffled version
      const shuffled = [...tracks].sort(() => Math.random() - 0.5);
      setShuffledTracks(shuffled);
      console.log('🔀 Tracks shuffled');
    } else {
      console.log('🔀 Shuffle disabled - tracks in original order');
    }
  };

  const handlePlayAll = async () => {
    if (isLoading) return;

    try {
      // Load all tracks matching current filters
      const allTracks = await loadAllTracks();
      
      if (!allTracks || allTracks.length === 0) {
        console.log('🎵 No tracks found to play');
        return;
      }

      // Apply shuffle if enabled
      const trackList = isShuffled ? [...allTracks].sort(() => Math.random() - 0.5) : allTracks;
      
      console.log(`🎵 Playing all tracks (${trackList.length} tracks)${isShuffled ? ' - shuffled' : ''}`);
      
      // Create playlist data for GlobalMusicPlayer
      const playlistData = {
        id: `tracks-playlist-${Date.now()}`,
        title: getDisplayName(),
        tracks: trackList.map(track => ({
          id: track.ratingKey,
          ratingKey: track.ratingKey,
          title: track.title,
          artist: track.grandparentTitle || track.artist || 'Unknown Artist',
          album: track.parentTitle || selectedAlbum?.title || 'Unknown Album',
          duration: track.duration,
          type: 'plex'
        }))
      };

      // Dispatch event to trigger GlobalMusicPlayer
      const event = new CustomEvent('startMusicPlayback', {
        detail: {
          playlist: playlistData,
          shuffle: isShuffled,
          sessionId: `tracks-session-${Date.now()}`
        }
      });
      
      window.dispatchEvent(event);
      console.log('🎵 Dispatched startMusicPlayback event for GlobalMusicPlayer');
      
    } catch (err) {
      console.error('Error in handlePlayAll:', err);
      setError(`Failed to play all tracks: ${err.message}`);
    }
  };

  const handleNextTrack = () => {
    if (!tracks || tracks.length === 0) return;

    const trackList = isShuffled ? shuffledTracks : tracks;
    const nextIndex = currentTrackIndex < trackList.length - 1 ? currentTrackIndex + 1 : 0;
    const nextTrack = trackList[nextIndex];
    
    if (nextTrack) {
      console.log(`⏭ Next track: ${nextTrack.title}`);
      
      // Dispatch next track event for GlobalMusicPlayer
      const event = new CustomEvent('globalMusicPlayerControl', {
        detail: {
          action: 'next'
        }
      });
      
      window.dispatchEvent(event);
    }
  };

  const handlePreviousTrack = () => {
    if (!tracks || tracks.length === 0) return;

    const trackList = isShuffled ? shuffledTracks : tracks;
    const prevIndex = currentTrackIndex > 0 ? currentTrackIndex - 1 : trackList.length - 1;
    const prevTrack = trackList[prevIndex];
    
    if (prevTrack) {
      console.log(`⏮ Previous track: ${prevTrack.title}`);
      
      // Dispatch previous track event for GlobalMusicPlayer
      const event = new CustomEvent('globalMusicPlayerControl', {
        detail: {
          action: 'previous'
        }
      });
      
      window.dispatchEvent(event);
    }
  };

  const handlePlayPause = () => {
    if (currentTrack) {
      // If there's a current track, just toggle play/pause via GlobalMusicPlayer
      const event = new CustomEvent('globalMusicPlayerControl', {
        detail: {
          action: 'toggle'
        }
      });
      
      window.dispatchEvent(event);
    } else {
      // If no current track, start playing all tracks
      handlePlayAll();
    }
  };

  // Listen for track end events to auto-advance
  useEffect(() => {
    const handleTrackEnded = () => {
      if (currentTrackIndex >= 0 && tracks && tracks.length > 0) {
        handleNextTrack();
      }
    };

    // Add event listener for track end
    const audio = audioRef.current;
    if (audio) {
      audio.addEventListener('ended', handleTrackEnded);
      return () => audio.removeEventListener('ended', handleTrackEnded);
    }
  }, [currentTrackIndex, tracks, isShuffled]);

  if (!tracks || tracks.length === 0) {
    return null;
  }

  return (
    <div className={`tracks-playlist-player ${isMinimized ? 'minimized' : ''}`}>
      <div className="playlist-player-header">
        <div className="playlist-info">
          <div className="playlist-title">
            🎵 {getDisplayName()}
          </div>
          <div className="playlist-meta">
            {tracks.length} track{tracks.length !== 1 ? 's' : ''} on this page
            {isShuffled && ' (shuffle enabled)'}
            {currentTrack && ` • Now playing: ${currentTrack.title}`}
            <div className="play-all-note">
              "Play All" will load all tracks matching current filters
            </div>
          </div>
        </div>
        <button
          className="minimize-btn"
          onClick={() => setIsMinimized(!isMinimized)}
          title={isMinimized ? 'Expand player' : 'Minimize player'}
        >
          {isMinimized ? '▲' : '▼'}
        </button>
      </div>

      {!isMinimized && (
        <div className="playlist-controls">
          <div className="main-controls">
            <button
              className="control-btn shuffle-btn"
              onClick={handleShuffle}
              title={isShuffled ? 'Disable shuffle' : 'Enable shuffle'}
              data-active={isShuffled}
            >
              🔀
            </button>
            
            <button
              className="control-btn"
              onClick={handlePreviousTrack}
              disabled={!currentTrack}
              title="Previous track"
            >
              ⏮
            </button>
            
            <button
              className="play-all-btn"
              onClick={handlePlayAll}
              disabled={isLoading}
              title="Play all tracks"
            >
              {isLoading ? '⏳' : currentTrack && isPlaying ? '⏸' : '▶'} 
              Play All
            </button>
            
            <button
              className="control-btn"
              onClick={handleNextTrack}
              disabled={!currentTrack}
              title="Next track"
            >
              ⏭
            </button>
          </div>

          {currentTrack && (
            <div className="current-track-info">
              <div className="track-details">
                <span className="track-title">{currentTrack.title}</span>
                <span className="track-artist">
                  {currentTrack.grandparentTitle || currentTrack.artist || 'Unknown Artist'}
                </span>
              </div>
              <div className="track-progress">
                {currentTrackIndex >= 0 && tracks.length > 0 && (
                  <span className="track-position">
                    {currentTrackIndex + 1} of {tracks.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="player-error">
          {error}
        </div>
      )}

      {/* Hidden audio element for track end detection */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
};

export default TracksPlaylistPlayer;