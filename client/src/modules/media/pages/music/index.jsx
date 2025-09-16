import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import config from '../../../../config';
import MusicAudioPlayer from './components/MusicAudioPlayer';
import MusicBreadcrumb from './components/MusicBreadcrumb';
import MusicControls from './components/MusicControls';
import MusicViewNavigation from './components/MusicViewNavigation';
import MusicArtistsView from './components/MusicArtistsView';
import MusicAlbumsView from './components/MusicAlbumsView';
import MusicTracksView from './components/MusicTracksView';
import MusicCollectionsView from './components/MusicCollectionsView';
import MusicPlaylistsView from './components/MusicPlaylistsView';
import LoadingState from '../../../../shared/components/LoadingState';
import './Music.css';

const Music = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  
  // Get navigation state from URL parameters
  const activeView = searchParams.get('view') || 'artists';
  const artistRatingKey = searchParams.get('artist');
  const albumRatingKey = searchParams.get('album');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [selectedSection, setSelectedSection] = useState(searchParams.get('section') || 'all');
  
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

  // Helper functions for URL management
  const updateUrlParams = (updates, replace = true) => {
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    setSearchParams(newParams, { replace }); // Allow control over replace behavior
  };

  const navigateToView = (view, params = {}) => {
    const updates = { view, ...params };
    
    // Clear irrelevant params based on view
    if (view === 'artists') {
      updates.artist = null;
      updates.album = null;
    } else if (view === 'albums' && !params.artist) {
      updates.artist = null;
      updates.album = null;
    } else if (view === 'tracks' && !params.album && !params.artist) {
      updates.artist = null;
      updates.album = null;
    }
    
    // For major view changes, create new history entries (not replace)
    const newParams = new URLSearchParams(searchParams);
    
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        newParams.delete(key);
      } else {
        newParams.set(key, value);
      }
    });
    
    setSearchParams(newParams); // This creates a new history entry
  };

  // Load artist/album data from URL parameters
  useEffect(() => {
    const loadDataFromUrl = async () => {
      try {
        // Load selected artist data if artistRatingKey exists
        if (artistRatingKey && (!selectedArtist || selectedArtist.ratingKey !== artistRatingKey)) {
          const artistRes = await fetch(`${config.apiBaseUrl}/api/music/artists/${artistRatingKey}`);
          if (artistRes.ok) {
            const artistData = await artistRes.json();
            setSelectedArtist(artistData);
            
            // Load albums for this artist if we're in albums or tracks view
            if (activeView === 'albums' || (activeView === 'tracks' && albumRatingKey)) {
              const albumsRes = await fetch(`${config.apiBaseUrl}/api/music/albums/artist/${artistRatingKey}`);
              if (albumsRes.ok) {
                const albumsData = await albumsRes.json();
                setAlbums(albumsData);
              }
            }
          }
        }
        
        // Load selected album data if albumRatingKey exists
        if (albumRatingKey && (!selectedAlbum || selectedAlbum.ratingKey !== albumRatingKey)) {
          const albumRes = await fetch(`${config.apiBaseUrl}/api/music/albums/${albumRatingKey}`);
          if (albumRes.ok) {
            const albumData = await albumRes.json();
            setSelectedAlbum(albumData);
            
            // Load tracks for this album if we're in tracks view
            if (activeView === 'tracks') {
              const tracksRes = await fetch(`${config.apiBaseUrl}/api/music/tracks/album/${albumRatingKey}`);
              if (tracksRes.ok) {
                const tracksData = await tracksRes.json();
                setTracks(tracksData);
              }
            }
          }
        }
        
        // Clear selected data if not in URL
        if (!artistRatingKey && selectedArtist) {
          setSelectedArtist(null);
        }
        if (!albumRatingKey && selectedAlbum) {
          setSelectedAlbum(null);
        }
      } catch (error) {
        console.error('Error loading data from URL:', error);
        setError(error.message);
      }
    };

    loadDataFromUrl();
  }, [artistRatingKey, albumRatingKey, activeView]);

  // Initialize component with URL parameters on first load
  useEffect(() => {
    const initializeFromUrl = async () => {
      try {
        setLoading(true);
        
        // Load static data first
        await loadStaticData();
        
        // If there are URL parameters, load the specific data
        if (artistRatingKey || albumRatingKey || activeView !== 'artists') {
          // The loadDataFromUrl effect will handle this
        } else {
          // Default load for artists view
          await refreshArtists();
        }
      } catch (error) {
        console.error('Error initializing from URL:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    initializeFromUrl();
  }, []); // Only run on component mount

  // Update local state when URL parameters change (for browser back/forward)
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlSection = searchParams.get('section') || 'all';
    
    if (urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
    }
    if (urlSection !== selectedSection) {
      setSelectedSection(urlSection);
    }
  }, [searchParams]);

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
      const errorEvent = e.nativeEvent || e;
      const errorTarget = errorEvent.target || errorEvent.currentTarget;
      
      // Check the network state to provide better error messages
      if (errorTarget && errorTarget.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
        setError('Audio source not found. Please check if Plex is accessible and the track exists.');
      } else if (errorTarget && errorTarget.error) {
        switch (errorTarget.error.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            setError('Audio playback was aborted.');
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            setError('Network error occurred while loading audio.');
            break;
          case MediaError.MEDIA_ERR_DECODE:
            setError('Audio format not supported or corrupted.');
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setError('Audio format not supported by this browser.');
            break;
          default:
            setError('An unknown audio error occurred.');
        }
      } else {
        setError('Failed to play audio track. Please check if Plex is accessible.');
      }
      
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
  }, [currentTrack]);

  // Play/pause track
  const playTrack = async (track) => {
    try {
      // Debug track information
      try {
        const debugResponse = await fetch(`${config.apiBaseUrl}/api/music/debug/${track.ratingKey}`);
        const debugData = await debugResponse.json();
        console.log('🔍 Track debug data:', debugData);
      } catch (debugError) {
        console.log('Debug endpoint not available:', debugError.message);
      }

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
        setError(null); // Clear any previous errors
        
        const streamUrl = `${config.apiBaseUrl}/api/music/stream/${track.ratingKey}`;
        console.log('🎵 Loading track:', track.title, 'from:', streamUrl);
        
        // Set the source and wait for it to load
        audioRef.current.src = streamUrl;
        audioRef.current.load(); // Explicitly load the new source
        
        // Wait for the audio to be ready to play
        const playAudio = async () => {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
            setError(null);
            console.log('✅ Audio playback started successfully');
          } catch (playError) {
            console.error('Failed to play track:', playError);
            
            // Provide specific error messages based on the error type
            if (playError.name === 'NotSupportedError') {
              setError('Audio format not supported by this browser.');
            } else if (playError.name === 'NotAllowedError') {
              setError('Audio playback blocked. Please interact with the page first, then try again.');
            } else if (playError.name === 'AbortError') {
              setError('Audio playback was interrupted.');
            } else if (playError.message.includes('network')) {
              setError('Network error: Unable to load audio from Plex server.');
            } else {
              setError(`Playback failed: ${playError.message || 'Unknown error'}`);
            }
          } finally {
            setIsLoading(false);
          }
        };

        // Try to play immediately, or wait for canplay event
        if (audioRef.current.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
          await playAudio();
        } else {
          // Wait for the audio to be ready
          const onCanPlay = async () => {
            audioRef.current.removeEventListener('canplay', onCanPlay);
            await playAudio();
          };
          
          const onError = () => {
            audioRef.current.removeEventListener('canplay', onCanPlay);
            audioRef.current.removeEventListener('error', onError);
            setError('Failed to load audio track. Please check if Plex server is accessible.');
            setIsLoading(false);
          };
          
          audioRef.current.addEventListener('canplay', onCanPlay, { once: true });
          audioRef.current.addEventListener('error', onError, { once: true });
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
      const [sectionsRes, statsRes, collectionsRes, playlistsRes, customPlaylistsRes, settingsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/api/music/sections`),
        fetch(`${config.apiBaseUrl}/api/music/stats`),
        fetch(`${config.apiBaseUrl}/api/music/collections`),
        fetch(`${config.apiBaseUrl}/api/music/playlists`),
        fetch(`${config.apiBaseUrl}/api/music/custom-playlists`),
        fetch(`${config.apiBaseUrl}/api/settings`)
      ]);

      if (!sectionsRes.ok || !statsRes.ok || !collectionsRes.ok || !playlistsRes.ok || !customPlaylistsRes.ok || !settingsRes.ok) {
        // Check which specific requests failed
        const failedRequests = [];
        if (!sectionsRes.ok) failedRequests.push(`sections (${sectionsRes.status})`);
        if (!statsRes.ok) failedRequests.push(`stats (${statsRes.status})`);
        if (!collectionsRes.ok) failedRequests.push(`collections (${collectionsRes.status})`);
        if (!playlistsRes.ok) failedRequests.push(`playlists (${playlistsRes.status})`);
        if (!customPlaylistsRes.ok) failedRequests.push(`custom-playlists (${customPlaylistsRes.status})`);
        if (!settingsRes.ok) failedRequests.push(`settings (${settingsRes.status})`);
        
        throw new Error(`Failed to fetch music data: ${failedRequests.join(', ')}`);
      }

      const [sectionsData, statsData, collectionsData, playlistsData, customPlaylistsData, settingsData] = await Promise.all([
        safeJsonParse(sectionsRes, `${config.apiBaseUrl}/api/music/sections`),
        safeJsonParse(statsRes, `${config.apiBaseUrl}/api/music/stats`),
        safeJsonParse(collectionsRes, `${config.apiBaseUrl}/api/music/collections`),
        safeJsonParse(playlistsRes, `${config.apiBaseUrl}/api/music/playlists`),
        safeJsonParse(customPlaylistsRes, `${config.apiBaseUrl}/api/music/custom-playlists`),
        safeJsonParse(settingsRes, `${config.apiBaseUrl}/api/settings`)
      ]);

      setSections(sectionsData);
      console.log('Loaded sections:', sectionsData);
      setStats(statsData);
      setCollections(collectionsData);
      
      // Store Plex settings in config for image URLs
      config.plexUrl = settingsData.plexUrl;
      config.plexToken = settingsData.plexToken;
      
      console.log('Updated config with Plex settings:', { 
        plexUrl: config.plexUrl, 
        hasToken: !!config.plexToken 
      });
      
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
      updateUrlParams({ search: null }, true); // Replace current entry
      refreshArtists();
      return;
    }

    updateUrlParams({ search: searchQuery.trim() }, true); // Replace current entry

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
    updateUrlParams({ section: sectionId === 'all' ? null : sectionId }, true); // Replace current entry

    try {
      setLoading(true);
      
      console.log('About to load data for section:', sectionId);
      
      // Reset selected artist/album when filtering by section
      setSelectedArtist(null);
      setSelectedAlbum(null);
      navigateToView('artists', { section: sectionId === 'all' ? null : sectionId });
      
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
    navigateToView('albums', { artist: artist.ratingKey });
    
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
    navigateToView('tracks', { 
      artist: selectedArtist?.ratingKey || artistRatingKey,
      album: album.ratingKey 
    });
    
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
    navigateToView('artists');
    setSelectedArtist(null);
    setSelectedAlbum(null);
    // Just refresh artists, no need to reload all data
    refreshArtists();
  };

  // Navigation helpers
  const goBackToArtists = () => {
    navigateToView('artists');
    setSelectedArtist(null);
    setSelectedAlbum(null);
  };

  const goBackToAlbums = () => {
    if (selectedArtist || artistRatingKey) {
      navigateToView('albums', { artist: selectedArtist?.ratingKey || artistRatingKey });
      setSelectedAlbum(null);
    } else {
      // If no selected artist, go back to all albums view
      navigateToView('albums');
      loadAlbumsView();
    }
  };

  const goBackFromTracks = () => {
    if (selectedAlbum || albumRatingKey) {
      // Coming from an album, go back to albums view
      goBackToAlbums();
    } else if (selectedArtist || artistRatingKey) {
      // Coming from artist tracks, go back to artist albums
      navigateToView('albums', { artist: selectedArtist?.ratingKey || artistRatingKey });
    } else {
      // In all tracks view, go back to artists
      goBackToArtists();
    }
  };

  // Get breadcrumb path
  const getBreadcrumbs = () => {
    const breadcrumbs = [{ label: 'Music', onClick: goBackToArtists }];
    
    if (selectedArtist) {
      breadcrumbs.push({
        label: 'Artists',
        onClick: goBackToArtists
      });
      breadcrumbs.push({
        label: selectedArtist.title,
        onClick: () => navigateToView('albums', { artist: selectedArtist.ratingKey })
      });
    }
    
    if (selectedAlbum) {
      breadcrumbs.push({
        label: selectedAlbum.title,
        onClick: () => navigateToView('tracks', { 
          artist: selectedArtist?.ratingKey || artistRatingKey,
          album: selectedAlbum.ratingKey 
        })
      });
    }
    
    return breadcrumbs;
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
        trackRatingKey: track.ratingKey,
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
          trackRatingKey: track.ratingKey,
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
              trackRatingKey: track.ratingKey,
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
          <LoadingState type="div" />
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
        
        {/* Breadcrumb Navigation */}
        <MusicBreadcrumb breadcrumbs={getBreadcrumbs()} />
        
        <MusicControls
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearch={searchMusic}
          selectedSection={selectedSection}
          sections={sections}
          onFilterBySection={filterBySection}
        />

        <MusicViewNavigation
          activeView={activeView}
          selectedArtist={selectedArtist}
          selectedAlbum={selectedAlbum}
          artistRatingKey={artistRatingKey}
          albumRatingKey={albumRatingKey}
          onNavigateToView={navigateToView}
          onLoadAlbumsView={loadAlbumsView}
          onLoadTracksView={loadTracksView}
        />
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
        onLoadStart={() => {
          console.log('🔄 Audio loading started');
          setIsLoading(true);
        }}
        onCanPlay={() => {
          console.log('✅ Audio can play');
          setIsLoading(false);
          setError(null); // Clear any previous errors when audio loads successfully
        }}
        onError={(e) => {
          console.error('Audio error:', e);
          const errorTarget = e.target;
          
          // Provide specific error messages based on the error type
          if (errorTarget && errorTarget.error) {
            console.error('Audio error details:', errorTarget.error);
            switch (errorTarget.error.code) {
              case MediaError.MEDIA_ERR_ABORTED:
                setError('Audio playback was stopped.');
                break;
              case MediaError.MEDIA_ERR_NETWORK:
                setError('Network error: Unable to load audio. Check if Plex server is accessible.');
                break;
              case MediaError.MEDIA_ERR_DECODE:
                setError('Audio decode error: The audio file may be corrupted.');
                break;
              case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
                setError('Audio format not supported: This browser cannot play this audio format.');
                break;
              default:
                setError('Unknown audio error occurred.');
            }
          } else {
            setError('Failed to load audio. Please check if Plex server is running and accessible.');
          }
          
          setIsPlaying(false);
          setIsLoading(false);
        }}
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Audio Player Controls */}
      <MusicAudioPlayer
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        isLoading={loading}
        currentTime={currentTime}
        duration={duration}
        volume={volume}
        onPlayPause={() => isPlaying ? stopTrack() : playTrack(currentTrack)}
        onSeek={seekTo}
        onVolumeChange={setVolumeLevel}
        formatTime={formatTime}
      />

      <div className="music-content">
        {activeView === 'artists' && (
          <MusicArtistsView
            artists={artists}
            artistsLoading={artistsLoading}
            artistsHasMore={artistsHasMore}
            onSelectArtist={selectArtist}
            onLoadMoreArtists={loadMoreArtists}
          />
        )}

        {activeView === 'albums' && (
          <MusicAlbumsView
            albums={albums}
            albumsLoading={albumsLoading}
            albumsHasMore={albumsHasMore}
            config={config}
            selectedArtist={selectedArtist}
            playlists={playlists}
            extractingMetadata={extractingMetadata}
            metadataResults={metadataResults}
            onSelectAlbum={selectAlbum}
            onLoadMoreAlbums={loadMoreAlbums}
            onGoBackToArtists={goBackToArtists}
            onAddAlbumToCustomPlaylist={addAlbumToCustomPlaylist}
            onExtractAlbumMetadata={extractAlbumMetadata}
          />
        )}

        {activeView === 'tracks' && (
          <MusicTracksView
            tracks={tracks}
            tracksLoading={tracksLoading}
            tracksHasMore={tracksHasMore}
            selectedAlbum={selectedAlbum}
            selectedArtist={selectedArtist}
            selectedSection={selectedSection}
            searchQuery={searchQuery}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            playlists={playlists}
            onGoBackFromTracks={goBackFromTracks}
            onPlayTrack={playTrack}
            onLoadMoreTracks={loadMoreTracks}
            onAddTrackToCustomPlaylist={addTrackToCustomPlaylist}
            formatDuration={formatDuration}
            formatFileSize={formatFileSize}
          />
        )}

        {activeView === 'collections' && (
          <MusicCollectionsView collections={collections} />
        )}

        {activeView === 'playlists' && (
          <MusicPlaylistsView
            playlists={playlists}
            config={config}
            onSetShowCreatePlaylistModal={setShowCreatePlaylistModal}
            onDeleteCustomPlaylist={deleteCustomPlaylist}
          />
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
                    <LoadingState type="spinner" />
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
