import React, { useState, useEffect, useRef } from 'react';
import config from '../../config';
import './Music.css';

const Music = () => {
  const [sections, setSections] = useState([]);
  const [artists, setArtists] = useState([]);
  const [artistsLoading, setArtistsLoading] = useState(false);
  const [artistsPage, setArtistsPage] = useState(1);
  const [artistsHasMore, setArtistsHasMore] = useState(true);
  const [albums, setAlbums] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(false);
  const [albumsPage, setAlbumsPage] = useState(1);
  const [albumsHasMore, setAlbumsHasMore] = useState(true);
  const [tracks, setTracks] = useState([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [tracksPage, setTracksPage] = useState(1);
  const [tracksHasMore, setTracksHasMore] = useState(true);
  const [stats, setStats] = useState(null);
  const [collections, setCollections] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeView, setActiveView] = useState('artists');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [extractingMetadata, setExtractingMetadata] = useState(new Set());
  const [metadataResults, setMetadataResults] = useState({});
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentMetadataResult, setCurrentMetadataResult] = useState(null);
  const [expandedSections, setExpandedSections] = useState({});
  
  // Custom playlist state
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [playlistFormData, setPlaylistFormData] = useState({
    title: '',
    description: '',
    isPublic: false
  });
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  
  // Audio player state
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef(null);

  // Helper function to safely parse JSON responses
  const safeJsonParse = async (response, url) => {
    const text = await response.text();
    
    if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
      console.error(`Server returned HTML instead of JSON for ${url}`);
      console.error('Response text:', text.substring(0, 200) + '...');
      throw new Error(`Server returned HTML page instead of JSON for ${url}. This usually indicates a routing issue or that the API endpoint is not available.`);
    }
    
    try {
      return JSON.parse(text);
    } catch (err) {
      console.error(`Failed to parse JSON for ${url}:`, text.substring(0, 200) + '...');
      throw new Error(`Invalid JSON response from ${url}: ${err.message}`);
    }
  };

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

  // Load static data that doesn't change often
  const loadStaticData = async () => {
    try {
      const [sectionsRes, statsRes, collectionsRes, playlistsRes, customPlaylistsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/sections`),
        fetch(`${config.apiBaseUrl}/api/music/stats`),
        fetch(`${config.apiBaseUrl}/api/music/collections`),
        fetch(`${config.apiBaseUrl}/api/music/playlists`),
        fetch(`${config.apiBaseUrl}/api/music/custom-playlists`)
      ]);

      if (!sectionsRes.ok || !statsRes.ok || !collectionsRes.ok || !playlistsRes.ok || !customPlaylistsRes.ok) {
        // Check which specific requests failed
        const failedRequests = [];
        if (!sectionsRes.ok) failedRequests.push(`sections (${sectionsRes.status})`);
        if (!statsRes.ok) failedRequests.push(`stats (${statsRes.status})`);
        if (!collectionsRes.ok) failedRequests.push(`collections (${collectionsRes.status})`);
        if (!playlistsRes.ok) failedRequests.push(`playlists (${playlistsRes.status})`);
        if (!customPlaylistsRes.ok) failedRequests.push(`custom-playlists (${customPlaylistsRes.status})`);
        
        throw new Error(`Failed to fetch music data: ${failedRequests.join(', ')}`);
      }

      const [sectionsData, statsData, collectionsData, playlistsData, customPlaylistsData] = await Promise.all([
        safeJsonParse(sectionsRes, `${config.apiBaseUrl}/api/music/sections`),
        safeJsonParse(statsRes, `${config.apiBaseUrl}/api/music/stats`),
        safeJsonParse(collectionsRes, `${config.apiBaseUrl}/api/music/collections`),
        safeJsonParse(playlistsRes, `${config.apiBaseUrl}/api/music/playlists`),
        safeJsonParse(customPlaylistsRes, `${config.apiBaseUrl}/api/music/custom-playlists`)
      ]);

      setSections(sectionsData);
      console.log('Loaded sections:', sectionsData);
      setStats(statsData);
      setCollections(collectionsData);
      
      // Combine Plex playlists and custom playlists
      const combinedPlaylists = [
        ...playlistsData.map(playlist => ({ ...playlist, type: 'plex' })),
        ...customPlaylistsData.map(playlist => ({ ...playlist, type: 'custom' }))
      ];
      setPlaylists(combinedPlaylists);
    } catch (err) {
      console.error('Error loading static music data:', err);
      throw err;
    }
  };

  // Load albums and tracks (for album/track views)
  const loadAlbumsAndTracks = async () => {
    try {
      const [albumsRes, tracksRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/albums`),
        fetch(`${config.apiBaseUrl}/api/music/tracks`)
      ]);

      if (!albumsRes.ok || !tracksRes.ok) {
        const failedRequests = [];
        if (!albumsRes.ok) failedRequests.push(`albums (${albumsRes.status})`);
        if (!tracksRes.ok) failedRequests.push(`tracks (${tracksRes.status})`);
        throw new Error(`Failed to fetch: ${failedRequests.join(', ')}`);
      }

      const [albumsData, tracksData] = await Promise.all([
        safeJsonParse(albumsRes, `${config.apiBaseUrl}/api/music/albums`),
        safeJsonParse(tracksRes, `${config.apiBaseUrl}/api/music/tracks`)
      ]);

      setAlbums(albumsData);
      setTracks(tracksData);
    } catch (err) {
      console.error('Error loading albums and tracks:', err);
      throw err;
    }
  };

  // Full data load (for initial load and explicit refresh)
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      
      console.log('Starting Music page data load...');
      console.log('API Base URL:', config.apiBaseUrl);
      
      // Reset pagination state for artists
      setArtistsPage(1);
      setArtistsHasMore(true);
      
      // Load static data first
      console.log('Loading static data...');
      await loadStaticData();
      console.log('Static data loaded successfully');

      // Load first page of artists
      console.log('Loading first page of artists...');
      await loadArtists(1, true);
      console.log('Artists loaded successfully');
      
    } catch (err) {
      console.error('Error loading music data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Refresh just the artists (for filtering/searching)
  const refreshArtists = async (sectionOverride = null) => {
    try {
      // Reset pagination state for all views
      setArtistsPage(1);
      setArtistsHasMore(true);
      setAlbumsPage(1);
      setAlbumsHasMore(true);
      setTracksPage(1);
      setTracksHasMore(true);
      
      // Clear albums and tracks so they get lazily loaded with new context
      setAlbums([]);
      setTracks([]);
      
      // Load first page of artists with current settings
      await loadArtists(1, true, sectionOverride);
    } catch (err) {
      console.error('Error refreshing artists:', err);
      setError(err.message);
    }
  };

  // Load albums and tracks when navigating to those views
  const loadAlbumsView = async (forceReload = false) => {
    if (!albums.length || forceReload) {
      await loadAlbums(1, true, selectedSection);
    }
  };

  const loadTracksView = async (forceReload = false) => {
    if (!tracks.length || forceReload) {
      await loadTracks(1, true, selectedSection);
    }
  };

  const loadAlbums = async (page = 1, replace = false, sectionOverride = null) => {
    try {
      setAlbumsLoading(true);
      
      const currentSection = sectionOverride !== null ? sectionOverride : selectedSection;
      
      console.log('loadAlbums called with:', { page, replace, sectionOverride, currentSection, searchQuery });
      
      let url;
      if (searchQuery.trim()) {
        // For search, respect the selected section
        if (currentSection !== 'all') {
          url = `${config.apiBaseUrl}/api/music/albums/section/${currentSection}?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        } else {
          url = `${config.apiBaseUrl}/api/music/albums?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        }
      } else if (currentSection !== 'all') {
        url = `${config.apiBaseUrl}/api/music/albums/section/${currentSection}?page=${page}&limit=20`;
      } else {
        url = `${config.apiBaseUrl}/api/music/albums?page=${page}&limit=20`;
      }
      
      console.log('Fetching albums from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch albums (${response.status})`);
      }

      const data = await safeJsonParse(response, url);
      
      console.log('Received albums data:', data, 'Replace:', replace);
      
      if (replace) {
        setAlbums(data.albums || data);
        setAlbumsPage(1);
      } else {
        setAlbums(prevAlbums => [...prevAlbums, ...(data.albums || data)]);
        setAlbumsPage(page);
      }
      
      // Check if we have more data to load
      setAlbumsHasMore(data.hasMore !== false && (data.albums || data).length === 20);
      
    } catch (err) {
      console.error('Error loading albums:', err);
      setError(err.message);
    } finally {
      setAlbumsLoading(false);
    }
  };

  const loadTracks = async (page = 1, replace = false, sectionOverride = null) => {
    try {
      setTracksLoading(true);
      
      const currentSection = sectionOverride !== null ? sectionOverride : selectedSection;
      
      console.log('loadTracks called with:', { page, replace, sectionOverride, currentSection, searchQuery });
      
      let url;
      if (searchQuery.trim()) {
        // For search, respect the selected section
        if (currentSection !== 'all') {
          url = `${config.apiBaseUrl}/api/music/tracks/section/${currentSection}?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        } else {
          url = `${config.apiBaseUrl}/api/music/tracks?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        }
      } else if (currentSection !== 'all') {
        url = `${config.apiBaseUrl}/api/music/tracks/section/${currentSection}?page=${page}&limit=20`;
      } else {
        url = `${config.apiBaseUrl}/api/music/tracks?page=${page}&limit=20`;
      }
      
      console.log('Fetching tracks from:', url);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch tracks (${response.status})`);
      }

      const data = await safeJsonParse(response, url);
      
      console.log('Received tracks data:', data, 'Replace:', replace);
      
      if (replace) {
        const tracksArray = Array.isArray(data.tracks) ? data.tracks : (Array.isArray(data) ? data : []);
        setTracks(tracksArray);
        setTracksPage(1);
      } else {
        const newTracksArray = Array.isArray(data.tracks) ? data.tracks : (Array.isArray(data) ? data : []);
        setTracks(prevTracks => [...prevTracks, ...newTracksArray]);
        setTracksPage(page);
      }
      
      // Check if we have more data to load
      setTracksHasMore(data.hasMore !== false && (data.tracks || data).length === 20);
      
    } catch (err) {
      console.error('Error loading tracks:', err);
      setError(err.message);
    } finally {
      setTracksLoading(false);
    }
  };

  const loadMoreAlbums = () => {
    if (!albumsLoading && albumsHasMore) {
      loadAlbums(albumsPage + 1, false);
    }
  };

  const loadMoreTracks = () => {
    if (!tracksLoading && tracksHasMore) {
      loadTracks(tracksPage + 1, false);
    }
  };

  const loadArtists = async (page = 1, replace = false, sectionOverride = null) => {
    try {
      setArtistsLoading(true);
      
      const currentSection = sectionOverride !== null ? sectionOverride : selectedSection;
      
      console.log('loadArtists called with:', { page, replace, sectionOverride, currentSection, searchQuery });
      
      let url;
      if (searchQuery) {
        // For search, respect the selected section
        if (currentSection !== 'all') {
          url = `${config.apiBaseUrl}/api/music/artists/section/${currentSection}?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        } else {
          url = `${config.apiBaseUrl}/api/music/artists?search=${encodeURIComponent(searchQuery)}&page=${page}&limit=20`;
        }
      } else if (currentSection !== 'all') {
        url = `${config.apiBaseUrl}/api/music/artists/section/${currentSection}?page=${page}&limit=20`;
      } else {
        url = `${config.apiBaseUrl}/api/music/artists?page=${page}&limit=20`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch artists (${response.status})`);
      }

      const data = await safeJsonParse(response, url);
      
      console.log('Received artists data:', data, 'Replace:', replace);
      
      if (replace) {
        setArtists(data.artists || data);
        setArtistsPage(1);
      } else {
        setArtists(prevArtists => [...prevArtists, ...(data.artists || data)]);
        setArtistsPage(page);
      }
      
      // Check if we have more data to load
      setArtistsHasMore(data.hasMore !== false && (data.artists || data).length === 20);
      
    } catch (err) {
      console.error('Error loading artists:', err);
      setError(err.message);
    } finally {
      setArtistsLoading(false);
    }
  };

  const loadMoreArtists = () => {
    if (!artistsLoading && artistsHasMore) {
      loadArtists(artistsPage + 1, false);
    }
  };

  const searchMusic = async () => {
    if (!searchQuery.trim()) {
      refreshArtists();
      return;
    }

    try {
      setLoading(true);
      
      // For search, just load artists initially
      // Albums and tracks will be loaded if user navigates to those views
      await refreshArtists();
    } catch (err) {
      console.error('Error searching music:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filterBySection = async (sectionId) => {
    console.log('filterBySection called with:', sectionId, 'Current selectedSection:', selectedSection, 'Current view:', activeView);
    console.log('Available sections:', sections);
    console.log('Selected section object:', sections.find(s => s.sectionKey === sectionId));
    
    setSelectedSection(sectionId);

    try {
      setLoading(true);
      
      console.log('About to load data for section:', sectionId);
      
      // Reset selected artist/album when filtering by section
      setSelectedArtist(null);
      setSelectedAlbum(null);
      
      // Always refresh artists data
      await refreshArtists(sectionId);
      
      // If we're currently viewing albums or tracks, reload that data too
      if (activeView === 'albums') {
        console.log('Reloading albums for new section');
        await loadAlbums(1, true, sectionId); // Use sectionId instead of selectedSection
      } else if (activeView === 'tracks') {
        console.log('Reloading tracks for new section');
        await loadTracks(1, true, sectionId); // Use sectionId instead of selectedSection
      }
      
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
        fetch(`${config.apiBaseUrl}/api/music/albums/artist/${artist.ratingKey}`),
        fetch(`${config.apiBaseUrl}/api/music/tracks/artist/${artist.ratingKey}`)
      ]);
      
      if (!albumsRes.ok || !tracksRes.ok) {
        const failedRequests = [];
        if (!albumsRes.ok) failedRequests.push(`albums (${albumsRes.status})`);
        if (!tracksRes.ok) failedRequests.push(`tracks (${tracksRes.status})`);
        throw new Error(`Failed to fetch artist data: ${failedRequests.join(', ')}`);
      }
      
      const [albumsData, tracksData] = await Promise.all([
        safeJsonParse(albumsRes, `${config.apiBaseUrl}/api/music/albums/artist/${artist.ratingKey}`),
        safeJsonParse(tracksRes, `${config.apiBaseUrl}/api/music/tracks/artist/${artist.ratingKey}`)
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
      const tracksRes = await fetch(`${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`);
      
      if (!tracksRes.ok) {
        throw new Error(`Failed to fetch album tracks (${tracksRes.status})`);
      }
      
      const tracksData = await safeJsonParse(tracksRes, `${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`);
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
    // Just refresh artists, no need to reload all data
    refreshArtists();
  };

  const extractAlbumMetadata = async (album) => {
    try {
      setExtractingMetadata(prev => new Set([...prev, album.ratingKey]));
      
      const response = await fetch(`${config.apiBaseUrl}/api/music/albums/${album.ratingKey}/extract-file-metadata`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await safeJsonParse(response, `${config.apiBaseUrl}/api/music/albums/${album.ratingKey}/extract-file-metadata`);
      
      // Store the results for display
      setMetadataResults(prev => ({
        ...prev,
        [album.ratingKey]: result
      }));
      
      console.log(`Metadata extraction completed for album "${album.title}":`, result);
      
      // Show metadata modal with results
      setCurrentMetadataResult(result);
      setShowMetadataModal(true);
      
    } catch (error) {
      console.error('Error extracting metadata:', error);
      alert(`Failed to extract metadata: ${error.message}`);
    } finally {
      setExtractingMetadata(prev => {
        const newSet = new Set(prev);
        newSet.delete(album.ratingKey);
        return newSet;
      });
    }
  };

  const formatMetadataValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  const formatMetadataFileSize = (bytes) => {
    if (!bytes || bytes === 0) return 'N/A';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatMetadataDuration = (seconds) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderMetadataSection = (title, data, trackIndex, isExpanded = false) => {
    const sectionKey = `${trackIndex}-${title}`;
    const expanded = expandedSections[sectionKey] || isExpanded;
    
    if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
      return null;
    }

    const toggleSection = () => {
      setExpandedSections(prev => ({
        ...prev,
        [sectionKey]: !expanded
      }));
    };

    return (
      <div className="metadata-section" key={sectionKey}>
        <h4 onClick={toggleSection} style={{cursor: 'pointer'}}>
          {expanded ? '▼' : '▶'} {title}
        </h4>
        {expanded && (
          <div className="metadata-content">
            {typeof data === 'object' ? (
              Object.entries(data).map(([key, value]) => (
                <div key={key} className="metadata-row">
                  <span className="metadata-key">{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</span>
                  <span className="metadata-value">{formatMetadataValue(value)}</span>
                </div>
              ))
            ) : (
              <div className="metadata-row">
                <span className="metadata-value">{formatMetadataValue(data)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Helper function to format time in MM:SS
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Custom playlist functions
  const createCustomPlaylist = async () => {
    if (!playlistFormData.title.trim()) {
      alert('Playlist title is required');
      return;
    }

    setCreatingPlaylist(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/music/custom-playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: playlistFormData.title,
          description: playlistFormData.description,
          isPublic: playlistFormData.isPublic,
          createdBy: 'User' // You can implement proper user management later
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create playlist (${response.status})`);
      }

      const newPlaylist = await safeJsonParse(response, `${config.apiBaseUrl}/api/music/custom-playlists`);
      
      // Add the new playlist to the list with type marker
      setPlaylists(prev => [
        { ...newPlaylist, type: 'custom' },
        ...prev
      ]);

      // Reset form and close modal
      setPlaylistFormData({ title: '', description: '', isPublic: false });
      setShowCreatePlaylistModal(false);
      
      console.log('Created custom playlist:', newPlaylist);
    } catch (error) {
      console.error('Error creating playlist:', error);
      alert(`Failed to create playlist: ${error.message}`);
    } finally {
      setCreatingPlaylist(false);
    }
  };

  const deleteCustomPlaylist = async (playlistId) => {
    if (!confirm('Are you sure you want to delete this playlist?')) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/music/custom-playlists/${playlistId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete playlist');
      }

      // Remove the playlist from the list
      setPlaylists(prev => prev.filter(playlist => 
        !(playlist.type === 'custom' && playlist.id === playlistId)
      ));
      
      console.log('Deleted custom playlist:', playlistId);
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert(`Failed to delete playlist: ${error.message}`);
    }
  };

  const addTrackToCustomPlaylist = async (playlistId, track) => {
    try {
      // Extract album name properly - handle various track data structures
      let albumName = null;
      if (track.album) {
        if (typeof track.album === 'string') {
          albumName = track.album;
        } else if (track.album.title) {
          albumName = track.album.title;
        }
      } else if (track.parentTitle) {
        albumName = track.parentTitle;
      }

      // Extract artist name properly
      let artistName = null;
      if (track.artist) {
        if (typeof track.artist === 'string') {
          artistName = track.artist;
        } else if (track.artist.title) {
          artistName = track.artist.title;
        }
      } else if (track.grandparentTitle) {
        artistName = track.grandparentTitle;
      }

      console.log('Adding track to playlist:', {
        ratingKey: track.ratingKey,
        title: track.title,
        artist: artistName,
        album: albumName,
        duration: track.duration
      });

      const response = await fetch(`${config.apiBaseUrl}/api/music/custom-playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ratingKey: track.ratingKey,
          title: track.title,
          artist: artistName,
          album: albumName,
          duration: track.duration
        }),
      });

      if (!response.ok) {
        if (response.status === 409) {
          alert('Track is already in this playlist');
          return;
        }
        throw new Error('Failed to add track to playlist');
      }

      console.log('Added track to playlist:', track.title);
      
      // Refresh playlists to show updated track count
      loadStaticData();
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      alert(`Failed to add track to playlist: ${error.message}`);
    }
  };

  const addAlbumToCustomPlaylist = async (playlistId, album) => {
    try {
      // First, fetch all tracks from the album
      const response = await fetch(`${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch album tracks (${response.status})`);
      }
      
      const tracks = await safeJsonParse(response, `${config.apiBaseUrl}/api/music/tracks/album/${album.ratingKey}`);
      if (!tracks || tracks.length === 0) {
        alert('No tracks found in this album');
        return;
      }

      console.log(`Adding ${tracks.length} tracks from album "${album.title}" to playlist`);
      
      let addedCount = 0;
      let skippedCount = 0;
      let errors = [];

      // Add each track to the playlist
      for (const track of tracks) {
        try {
          // Extract album name properly
          let albumName = null;
          if (track.album) {
            if (typeof track.album === 'string') {
              albumName = track.album;
            } else if (track.album.title) {
              albumName = track.album.title;
            }
          } else if (track.parentTitle) {
            albumName = track.parentTitle;
          } else {
            albumName = album.title; // Use the album title as fallback
          }

          // Extract artist name properly
          let artistName = null;
          if (track.artist) {
            if (typeof track.artist === 'string') {
              artistName = track.artist;
            } else if (track.artist.title) {
              artistName = track.artist.title;
            }
          } else if (track.grandparentTitle) {
            artistName = track.grandparentTitle;
          }

          const trackResponse = await fetch(`${config.apiBaseUrl}/api/music/custom-playlists/${playlistId}/tracks`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ratingKey: track.ratingKey,
              title: track.title,
              artist: artistName,
              album: albumName,
              duration: track.duration
            }),
          });

          if (trackResponse.ok) {
            addedCount++;
          } else if (trackResponse.status === 409) {
            skippedCount++; // Track already exists
          } else {
            errors.push(`${track.title}: ${trackResponse.statusText}`);
          }
        } catch (trackError) {
          errors.push(`${track.title}: ${trackError.message}`);
        }
      }

      // Show results to user
      let message = `Album "${album.title}": `;
      if (addedCount > 0) {
        message += `${addedCount} track${addedCount !== 1 ? 's' : ''} added`;
      }
      if (skippedCount > 0) {
        message += `${addedCount > 0 ? ', ' : ''}${skippedCount} track${skippedCount !== 1 ? 's' : ''} already in playlist`;
      }
      if (errors.length > 0) {
        message += `${addedCount > 0 || skippedCount > 0 ? ', ' : ''}${errors.length} error${errors.length !== 1 ? 's' : ''}`;
      }

      if (errors.length > 0 && errors.length < 5) {
        message += `\nErrors: ${errors.join(', ')}`;
      }

      alert(message);
      
      if (addedCount > 0) {
        // Refresh playlists to show updated track count
        loadStaticData();
      }
    } catch (error) {
      console.error('Error adding album to playlist:', error);
      alert(`Failed to add album to playlist: ${error.message}`);
    }
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
              <span>{stats.artists} Artists</span>
              <span>{stats.albums} Albums</span>
              <span>{stats.tracks} Tracks</span>
              <span>{stats.playlists} Playlists</span>
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
                <option key={section.id} value={section.sectionKey}>
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
          <button 
            onClick={() => setActiveView('collections')}
            className={`nav-button ${activeView === 'collections' ? 'active' : ''}`}
          >
            Collections
          </button>
          <button 
            onClick={() => setActiveView('playlists')}
            className={`nav-button ${activeView === 'playlists' ? 'active' : ''}`}
          >
            Playlists
          </button>
          <button 
            onClick={async () => {
              await loadAlbumsView();
              setActiveView('albums');
            }}
            className={`nav-button ${activeView === 'albums' ? 'active' : ''}`}
          >
            Albums
          </button>
          <button 
            onClick={async () => {
              await loadTracksView();
              setActiveView('tracks');
            }}
            className={`nav-button ${activeView === 'tracks' ? 'active' : ''}`}
          >
            Tracks
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
                  <div className="artist-info">
                    <h3>{artist.title}</h3>
                  </div>
                </div>
              ))
            )}
            
            {/* Load More Button */}
            {artists.length > 0 && artistsHasMore && (
              <div className="load-more-container">
                <button 
                  className="load-more-button"
                  onClick={loadMoreArtists}
                  disabled={artistsLoading}
                >
                  {artistsLoading ? 'Loading...' : 'Load More Artists'}
                </button>
              </div>
            )}
            
            {/* Loading indicator for pagination */}
            {artistsLoading && artists.length > 0 && (
              <div className="pagination-loading">
                <p>Loading more artists...</p>
              </div>
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
                >
                  {album.thumb && (
                    <div 
                      className="album-image"
                      style={{ position: 'relative' }}
                    >
                      <img 
                        src={`${config.apiBaseUrl}/api/plex-album-art/${album.ratingKey}?width=300&height=300`}
                        alt={album.title}
                        onClick={() => selectAlbum(album)}
                        style={{ cursor: 'pointer', width: '100%', height: '100%' }}
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                      
                      {/* Add to Playlist Button Overlay */}
                      <div className="album-playlist-overlay">
                        <div className="album-playlist-dropdown">
                          <select
                            onChange={(e) => {
                              if (e.target.value) {
                                addAlbumToCustomPlaylist(parseInt(e.target.value), album);
                                e.target.value = '';
                              }
                            }}
                            defaultValue=""
                            onClick={(e) => e.stopPropagation()} // Prevent triggering album click
                          >
                            <option value="">+ Add Album to...</option>
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
                  )}
                  <div className="album-info">
                    <h3 onClick={() => selectAlbum(album)} style={{ cursor: 'pointer' }}>
                      {album.title}
                    </h3>
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
                    <div className="album-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          extractAlbumMetadata(album);
                        }}
                        className="extract-metadata-button"
                        disabled={extractingMetadata.has(album.ratingKey)}
                      >
                        {extractingMetadata.has(album.ratingKey) ? (
                          <>
                            <span className="spinner">⟳</span>
                            Extracting...
                          </>
                        ) : (
                          <>
                            🏷️ Extract Metadata
                          </>
                        )}
                      </button>
                    </div>
                    {metadataResults[album.ratingKey] && (
                      <div className="metadata-results">
                        <small>
                          ✅ Metadata extracted: {metadataResults[album.ratingKey].successCount}/
                          {metadataResults[album.ratingKey].tracksProcessed} tracks
                        </small>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {albumsHasMore && (
              <div className="pagination-section">
                <button 
                  onClick={loadMoreAlbums}
                  className="load-more-button"
                  disabled={albumsLoading}
                >
                  {albumsLoading ? (
                    <>
                      <span className="spinner">⟳</span>
                      Loading...
                    </>
                  ) : (
                    'Load More Albums'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeView === 'tracks' && (
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
                    <div className="track-playlist">
                      <div className="playlist-dropdown">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              addTrackToCustomPlaylist(parseInt(e.target.value), track);
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
                  onClick={loadMoreTracks}
                  className="load-more-button"
                  disabled={tracksLoading}
                >
                  {tracksLoading ? (
                    <>
                      <span className="spinner">⟳</span>
                      Loading...
                    </>
                  ) : (
                    'Load More Tracks'
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeView === 'collections' && (
          <div className="collections-grid">
            {collections.length === 0 ? (
              <div className="empty-state">
                <p>No collections found.</p>
              </div>
            ) : (
              collections.map(collection => (
                <div key={collection.value} className="collection-card">
                  <div className="collection-info">
                    <h3>{collection.label}</h3>
                    <div className="collection-meta">
                      <span className="collection-type">Music Collection</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeView === 'playlists' && (
          <div className="playlists-section">
            <div className="playlists-header">
              <h2>Playlists</h2>
              <button 
                className="create-playlist-button"
                onClick={() => setShowCreatePlaylistModal(true)}
              >
                + Create Custom Playlist
              </button>
            </div>
            
            <div className="playlists-grid">
              {playlists.length === 0 ? (
                <div className="empty-state">
                  <p>No playlists found.</p>
                  <p>Create your first custom playlist to get started!</p>
                </div>
              ) : (
                playlists.map(playlist => (
                  <div key={`${playlist.type}-${playlist.ratingKey || playlist.id}`} className={`playlist-card ${playlist.type}-playlist`}>
                    <div className="playlist-type-badge">
                      {playlist.type === 'plex' ? 'Plex' : 'Custom'}
                    </div>
                    
                    {playlist.type === 'custom' && (
                      <div className="playlist-actions">
                        <button 
                          className="delete-playlist-button"
                          onClick={() => deleteCustomPlaylist(playlist.id)}
                          title="Delete Playlist"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                    
                    {playlist.thumb && playlist.type === 'plex' && (
                      <div className="playlist-thumbnail">
                        <img 
                          src={`${config.plexUrl}${playlist.thumb}?X-Plex-Token=${config.plexToken}`}
                          alt={playlist.title}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="playlist-info">
                      <h3>{playlist.title}</h3>
                      {(playlist.summary || playlist.description) && (
                        <p className="playlist-summary">{playlist.summary || playlist.description}</p>
                      )}
                      
                      <div className="playlist-meta">
                        <span className="track-count">
                          {playlist.leafCount || playlist.tracks?.length || 0} track{(playlist.leafCount || playlist.tracks?.length || 0) !== 1 ? 's' : ''}
                        </span>
                        
                        {playlist.duration && (
                          <span className="playlist-duration">
                            {Math.floor(playlist.duration / 60000)}:{String(Math.floor((playlist.duration % 60000) / 1000)).padStart(2, '0')}
                          </span>
                        )}
                        
                        {playlist.smart && (
                          <span className="smart-playlist">Smart Playlist</span>
                        )}
                        
                        {playlist.type === 'custom' && playlist.isPublic && (
                          <span className="public-playlist">Public</span>
                        )}
                        
                        {playlist.type === 'custom' && (
                          <span className="playlist-created">
                            Created {new Date(playlist.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      
                      {/* Show preview tracks for Plex playlists */}
                      {playlist.items && playlist.items.length > 0 && (
                        <div className="playlist-preview">
                          <h4>Tracks:</h4>
                          <div className="playlist-tracks">
                            {playlist.items.slice(0, 5).map((item, index) => (
                              <div key={`${item.ratingKey}-${index}`} className="playlist-track">
                                <span className="track-index">{item.index}.</span>
                                <span className="track-title">
                                  {item.track ? item.track.title : item.album ? item.album.title : 'Unknown'}
                                </span>
                              </div>
                            ))}
                            {playlist.items.length > 5 && (
                              <div className="playlist-more">
                                ...and {playlist.items.length - 5} more tracks
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Show preview tracks for Custom playlists */}
                      {playlist.tracks && playlist.tracks.length > 0 && (
                        <div className="playlist-preview">
                          <h4>Tracks:</h4>
                          <div className="playlist-tracks">
                            {playlist.tracks.slice(0, 5).map((track, index) => (
                              <div key={track.id} className="playlist-track">
                                <span className="track-index">{index + 1}.</span>
                                <span className="track-title">{track.title}</span>
                                {track.artist && <span className="track-artist">by {track.artist}</span>}
                              </div>
                            ))}
                            {playlist.tracks.length > 5 && (
                              <div className="playlist-more">
                                ...and {playlist.tracks.length - 5} more tracks
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div className="modal-overlay" onClick={() => setShowCreatePlaylistModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Custom Playlist</h2>
              <button 
                className="modal-close"
                onClick={() => setShowCreatePlaylistModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-content">
              <div className="form-group">
                <label htmlFor="playlist-title">Playlist Title *</label>
                <input
                  id="playlist-title"
                  type="text"
                  value={playlistFormData.title}
                  onChange={(e) => setPlaylistFormData(prev => ({
                    ...prev,
                    title: e.target.value
                  }))}
                  placeholder="Enter playlist title"
                  maxLength={100}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="playlist-description">Description</label>
                <textarea
                  id="playlist-description"
                  value={playlistFormData.description}
                  onChange={(e) => setPlaylistFormData(prev => ({
                    ...prev,
                    description: e.target.value
                  }))}
                  placeholder="Optional description"
                  rows={3}
                  maxLength={500}
                />
              </div>
              
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={playlistFormData.isPublic}
                    onChange={(e) => setPlaylistFormData(prev => ({
                      ...prev,
                      isPublic: e.target.checked
                    }))}
                  />
                  Make this playlist public
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="cancel-button"
                onClick={() => setShowCreatePlaylistModal(false)}
                disabled={creatingPlaylist}
              >
                Cancel
              </button>
              <button 
                className="create-button"
                onClick={createCustomPlaylist}
                disabled={creatingPlaylist || !playlistFormData.title.trim()}
              >
                {creatingPlaylist ? (
                  <>
                    <span className="spinner">⟳</span>
                    Creating...
                  </>
                ) : (
                  'Create Playlist'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Metadata Modal */}
      {showMetadataModal && currentMetadataResult && (
        <div className="metadata-modal-overlay" onClick={() => setShowMetadataModal(false)}>
          <div className="metadata-modal" onClick={(e) => e.stopPropagation()}>
            <div className="metadata-modal-header">
              <h2>🏷️ Extracted Metadata Results</h2>
              <button 
                className="metadata-modal-close"
                onClick={() => setShowMetadataModal(false)}
              >
                ✕
              </button>
            </div>
            
            <div className="metadata-modal-content">
              <div className="metadata-summary">
                <h3>Summary</h3>
                <div className="metadata-stats">
                  <div className="stat">
                    <span className="stat-label">Tracks Processed:</span>
                    <span className="stat-value">{currentMetadataResult.tracksProcessed}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Successful:</span>
                    <span className="stat-value success">{currentMetadataResult.successCount}</span>
                  </div>
                  <div className="stat">
                    <span className="stat-label">Errors:</span>
                    <span className="stat-value error">{currentMetadataResult.errorCount}</span>
                  </div>
                </div>
              </div>

              <div className="metadata-tracks">
                {currentMetadataResult.extractedMetadata?.map((track, index) => (
                  <div key={track.ratingKey || index} className="metadata-track">
                    <div className="metadata-track-header">
                      <h4>
                        {track.error ? '❌' : '✅'} {track.title}
                      </h4>
                      {track.filePath && (
                        <small className="file-path">{track.filePath}</small>
                      )}
                    </div>
                    
                    {track.error ? (
                      <div className="metadata-error">
                        <p><strong>Error:</strong> {track.error}</p>
                        {track.plexPath && <p><strong>Plex Path:</strong> {track.plexPath}</p>}
                        {track.libraryBasePaths && (
                          <p><strong>Tried Library Paths:</strong> {track.libraryBasePaths.join(', ')}</p>
                        )}
                      </div>
                    ) : track.common && (
                      <div className="metadata-details">
                        {/* Basic Info */}
                        {renderMetadataSection('Basic Information', {
                          Title: track.common.title,
                          Artist: track.common.artist,
                          'Album Artist': track.common.albumartist,
                          Album: track.common.album,
                          Year: track.common.year,
                          Track: track.common.track?.no ? `${track.common.track.no}${track.common.track.of ? `/${track.common.track.of}` : ''}` : track.common.track,
                          Genre: track.common.genre?.join(', '),
                          Duration: formatMetadataDuration(track.formatInfo?.duration),
                          Composer: track.common.composer?.join(', '),
                          Comment: track.common.comment?.join(', ')
                        }, index, true)}
                        
                        {/* MusicBrainz IDs */}
                        {renderMetadataSection('MusicBrainz IDs', {
                          'Recording ID': track.common.musicbrainz_recordingid,
                          'Track ID': track.common.musicbrainz_trackid,
                          'Album ID': track.common.musicbrainz_albumid,
                          'Artist ID': track.common.musicbrainz_artistid,
                          'Album Artist ID': track.common.musicbrainz_albumartistid,
                          'Release Group ID': track.common.musicbrainz_releasegroupid,
                          'Work ID': track.common.musicbrainz_workid
                        }, index)}
                        
                        {/* Technical Info */}
                        {renderMetadataSection('Technical Information', {
                          Format: track.formatInfo?.container,
                          Codec: track.formatInfo?.codec,
                          Lossless: track.formatInfo?.lossless,
                          Bitrate: track.formatInfo?.bitrate ? `${track.formatInfo.bitrate} kbps` : null,
                          'Sample Rate': track.formatInfo?.sampleRate ? `${track.formatInfo.sampleRate} Hz` : null,
                          'Bits Per Sample': track.formatInfo?.bitsPerSample,
                          Channels: track.formatInfo?.numberOfChannels,
                          'File Size': formatMetadataFileSize(track.formatInfo?.size)
                        }, index)}
                        
                        {/* Release Info */}
                        {renderMetadataSection('Release Information', {
                          Label: track.common.label?.join(', '),
                          Date: track.common.date,
                          'Original Date': track.common.originaldate,
                          'Original Year': track.common.originalyear,
                          'Release Type': track.common.releasetype?.join(', '),
                          'Release Status': track.common.releasestatus,
                          'Release Country': track.common.releasecountry,
                          Barcode: track.common.barcode,
                          'Catalog Number': track.common.catalognumber?.join(', '),
                          ISRC: track.common.isrc?.join(', ')
                        }, index)}
                        
                        {/* Additional Metadata */}
                        {renderMetadataSection('Additional Information', {
                          Language: track.common.language,
                          Mood: track.common.mood?.join(', '),
                          BPM: track.common.bpm,
                          Key: track.common.key,
                          Rating: track.common.rating?.join(', '),
                          Compilation: track.common.compilation,
                          Gapless: track.common.gapless,
                          Copyright: track.common.copyright,
                          License: track.common.license,
                          'Encoded By': track.common.encodedby,
                          'Encoder Settings': track.common.encodersettings
                        }, index)}
                        
                        {/* Raw Tags for debugging */}
                        {track.nativeTags && Object.keys(track.nativeTags).length > 0 && 
                          renderMetadataSection('Raw Tags (Debug)', track.nativeTags, index)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Music;
