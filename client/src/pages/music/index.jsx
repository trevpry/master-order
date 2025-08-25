import React, { useState, useEffect, useRef } from 'react';
import config from '../../config';
import './Music.css';

const Music = () => {
  const [sections, setSections] = useState([]);
  const [artists, setArtists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [tracks, setTracks] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('artists');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  
  // Audio player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    loadData();
  }, []);

  // Audio player event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleError = (e) => {
      console.error('Audio error:', e);
      setError('Failed to play audio track');
      setIsPlaying(false);
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
  }, [currentTrack]);

  // Play/pause track
  const playTrack = async (track) => {
    try {
      if (currentTrack?.ratingKey === track.ratingKey) {
        // Toggle play/pause for current track
        if (isPlaying) {
          audioRef.current.pause();
          setIsPlaying(false);
        } else {
          setIsLoading(true);
          try {
            await audioRef.current.play();
            setIsPlaying(true);
          } catch (playError) {
            console.error('Failed to resume track:', playError);
            setError('Failed to resume track. Please try again.');
          } finally {
            setIsLoading(false);
          }
        }
      } else {
        // Load and play new track
        if (audioRef.current) {
          // Stop current playback cleanly
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setIsPlaying(false);
        }
        
        setCurrentTrack(track);
        setCurrentTime(0);
        setDuration(0);
        setIsLoading(true);
        
        const streamUrl = `${config.apiBaseUrl}/api/music/stream/${track.ratingKey}`;
        audioRef.current.src = streamUrl;
        
        // Wait for the source to be set
        await new Promise(resolve => setTimeout(resolve, 100));
        
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (playError) {
          console.error('Failed to play track:', playError);
          setError('Failed to play track. Please check if Plex is accessible.');
        } finally {
          setIsLoading(false);
        }
      }
    } catch (error) {
      console.error('Error playing track:', error);
      setError('Failed to play track');
      setIsLoading(false);
    }
  };

  const stopTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setCurrentTime(0);
      setIsLoading(false);
    }
  };

  const seekTo = (time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const setVolumeLevel = (newVolume) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolume(newVolume);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load all data in parallel
      const [sectionsRes, artistsRes, albumsRes, tracksRes, statsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/sections`),
        fetch(`${config.apiBaseUrl}/api/music/artists`),
        fetch(`${config.apiBaseUrl}/api/music/albums`),
        fetch(`${config.apiBaseUrl}/api/music/tracks`),
        fetch(`${config.apiBaseUrl}/api/music/stats`)
      ]);

      if (!sectionsRes.ok || !artistsRes.ok || !albumsRes.ok || !tracksRes.ok || !statsRes.ok) {
        throw new Error('Failed to fetch music data');
      }

      const [sectionsData, artistsData, albumsData, tracksData, statsData] = await Promise.all([
        sectionsRes.json(),
        artistsRes.json(),
        albumsRes.json(),
        tracksRes.json(),
        statsRes.json()
      ]);

      setSections(sectionsData);
      setArtists(artistsData);
      setAlbums(albumsData);
      setTracks(tracksData);
      setStats(statsData);
    } catch (err) {
      console.error('Error loading music data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchMusic = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }

    try {
      setLoading(true);
      
      const [artistsRes, albumsRes, tracksRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(searchQuery)}`),
        fetch(`${config.apiBaseUrl}/api/music/albums?search=${encodeURIComponent(searchQuery)}`),
        fetch(`${config.apiBaseUrl}/api/music/tracks?search=${encodeURIComponent(searchQuery)}`)
      ]);

      const [artistsData, albumsData, tracksData] = await Promise.all([
        artistsRes.json(),
        albumsRes.json(),
        tracksRes.json()
      ]);

      setArtists(artistsData);
      setAlbums(albumsData);
      setTracks(tracksData);
    } catch (err) {
      console.error('Error searching music:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterBySection = async (sectionId) => {
    setSelectedSection(sectionId);
    
    if (sectionId === 'all') {
      loadData();
      return;
    }

    try {
      setLoading(true);
      const artistsRes = await fetch(`${config.apiBaseUrl}/api/music/artists?section=${sectionId}`);
      const artistsData = await artistsRes.json();
      setArtists(artistsData);
    } catch (err) {
      console.error('Error filtering by section:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectArtist = async (artist) => {
    setSelectedArtist(artist);
    setActiveView('albums');
    
    try {
      const [albumsRes, tracksRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/albums?artist=${artist.ratingKey}`),
        fetch(`${config.apiBaseUrl}/api/music/tracks?artist=${artist.ratingKey}`)
      ]);
      
      const [albumsData, tracksData] = await Promise.all([
        albumsRes.json(),
        tracksRes.json()
      ]);
      
      setAlbums(albumsData);
      setTracks(tracksData);
    } catch (err) {
      console.error('Error loading artist data:', err);
      setError(err.message);
    }
  };

  const selectAlbum = async (album) => {
    setSelectedAlbum(album);
    setActiveView('tracks');
    
    try {
      const tracksRes = await fetch(`${config.apiBaseUrl}/api/music/tracks?album=${album.ratingKey}`);
      const tracksData = await tracksRes.json();
      setTracks(tracksData);
    } catch (err) {
      console.error('Error loading album tracks:', err);
      setError(err.message);
    }
  };

  const resetToArtists = () => {
    setActiveView('artists');
    setSelectedArtist(null);
    setSelectedAlbum(null);
    loadData();
  };

  // Helper function to format time in MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (ms) => {
    if (!ms) return '';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    }
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="music-page">
        <div className="music-loading">
          <div className="loading-spinner"></div>
          <p>Loading your music library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="music-page">
        <div className="music-error">
          <h2>Error Loading Music</h2>
          <p>{error}</p>
          <button onClick={loadData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="music-page">
      <div className="music-header">
        <div className="header-top">
          <h1>🎵 Music Library</h1>
          {stats && (
            <div className="music-stats">
              <span>{stats.artistCount} Artists</span>
              <span>{stats.albumCount} Albums</span>
              <span>{stats.trackCount} Tracks</span>
            </div>
          )}
        </div>
        
        <div className="music-controls">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search artists, albums, or tracks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchMusic()}
              className="search-input"
            />
            <button onClick={searchMusic} className="search-button">
              🔍 Search
            </button>
          </div>
          
          <div className="filter-section">
            <select 
              value={selectedSection} 
              onChange={(e) => filterBySection(e.target.value)}
              className="section-filter"
            >
              <option value="all">All Sections</option>
              {sections.map(section => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="view-navigation">
          <button 
            onClick={resetToArtists}
            className={`nav-button ${activeView === 'artists' ? 'active' : ''}`}
          >
            Artists
          </button>
          {selectedArtist && (
            <button 
              onClick={() => setActiveView('albums')}
              className={`nav-button ${activeView === 'albums' ? 'active' : ''}`}
            >
              Albums ({selectedArtist.title})
            </button>
          )}
          {selectedAlbum && (
            <button 
              onClick={() => setActiveView('tracks')}
              className={`nav-button ${activeView === 'tracks' ? 'active' : ''}`}
            >
              Tracks ({selectedAlbum.title})
            </button>
          )}
        </div>
      </div>

      {/* Audio Element */}
      <audio 
        ref={audioRef}
        onTimeUpdate={() => {
          if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
            setDuration(audioRef.current.duration || 0);
          }
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onError={(e) => {
          console.error('Audio error:', e);
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />

      {/* Audio Player Controls */}
      {currentTrack && (
        <div className="audio-player">
          <div className="player-info">
            <span className="track-title">{currentTrack.title}</span>
            <span className="track-artist">{currentTrack.grandparentTitle}</span>
          </div>
          <div className="player-controls">
            <button 
              onClick={() => isPlaying ? stopTrack() : playTrack(currentTrack)}
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
                onChange={(e) => seekTo(e.target.value)}
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
                onChange={(e) => setVolumeLevel(e.target.value)}
                className="volume-bar"
              />
            </div>
          </div>
        </div>
      )}

      <div className="music-content">
        {activeView === 'artists' && (
          <div className="artists-grid">
            {artists.length === 0 ? (
              <div className="empty-state">
                <p>No artists found. Try adjusting your search or filters.</p>
              </div>
            ) : (
              artists.map(artist => (
                <div 
                  key={artist.ratingKey} 
                  className="artist-card"
                  onClick={() => selectArtist(artist)}
                >
                  {artist.thumb && (
                    <div className="artist-image">
                      <img 
                        src={`/api/plex-media/${artist.thumb}`} 
                        alt={artist.title}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="artist-info">
                    <h3>{artist.title}</h3>
                    {artist.summary && (
                      <p className="artist-summary">{artist.summary}</p>
                    )}
                    <div className="artist-meta">
                      {artist.genres && artist.genres.length > 0 && (
                        <span className="genres">
                          {artist.genres.slice(0, 3).join(', ')}
                        </span>
                      )}
                      {artist.childCount && (
                        <span className="album-count">
                          {artist.childCount} album{artist.childCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeView === 'albums' && (
          <div className="albums-grid">
            {albums.length === 0 ? (
              <div className="empty-state">
                <p>No albums found for this artist.</p>
              </div>
            ) : (
              albums.map(album => (
                <div 
                  key={album.ratingKey} 
                  className="album-card"
                  onClick={() => selectAlbum(album)}
                >
                  {album.thumb && (
                    <div className="album-image">
                      <img 
                        src={`/api/plex-media/${album.thumb}`} 
                        alt={album.title}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <div className="album-info">
                    <h3>{album.title}</h3>
                    {album.year && <span className="album-year">({album.year})</span>}
                    {album.summary && (
                      <p className="album-summary">{album.summary}</p>
                    )}
                    <div className="album-meta">
                      {album.genres && album.genres.length > 0 && (
                        <span className="genres">
                          {album.genres.slice(0, 2).join(', ')}
                        </span>
                      )}
                      {album.childCount && (
                        <span className="track-count">
                          {album.childCount} track{album.childCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeView === 'tracks' && (
          <div className="tracks-list">
            {tracks.length === 0 ? (
              <div className="empty-state">
                <p>No tracks found for this album.</p>
              </div>
            ) : (
              <div className="tracks-table">
                <div className="tracks-header">
                  <span className="track-controls">▶</span>
                  <span className="track-number">#</span>
                  <span className="track-title">Title</span>
                  <span className="track-duration">Duration</span>
                  <span className="track-size">Size</span>
                </div>
                {tracks.map(track => (
                  <div key={track.ratingKey} className={`track-row ${currentTrack?.ratingKey === track.ratingKey ? 'playing' : ''}`}>
                    <button 
                      className={`track-play-button ${currentTrack?.ratingKey === track.ratingKey && isPlaying ? 'playing' : ''}`}
                      onClick={() => playTrack(track)}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Music;
