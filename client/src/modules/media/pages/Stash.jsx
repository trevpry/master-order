import React, { useState, useEffect, useCallback } from 'react';
import Button from '../../../shared/components/Button';
import StashVideoPlayer from './stash/components/StashVideoPlayer';
import StashUpNextTab from './stash/components/StashUpNextTab';
import StashLibraryTab from './stash/components/StashLibraryTab';
import StashStatsTab from './stash/components/StashStatsTab';
import StashSlideshowModal from './stash/components/StashSlideshowModal';
import StashContentRenderers from './stash/components/StashContentRenderers';
import StashModals from './stash/components/StashModals';
import { getSceneDisplayTitle, getSceneImageUrl, formatDate, formatDuration, formatTime, isVideoFormatSupported } from '../utils/stashUtils';
import './Stash.css';
import config from '../../../config';

export default function Stash() {
  // State Management
  const [connectionStatus, setConnectionStatus] = useState({ 
    configured: false, 
    connected: false, 
    stashUrl: null,
    apiKey: null 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState(() => {
    return localStorage.getItem('stash-main-tab') || 'upnext';
  });
  const [libraryTab, setLibraryTab] = useState('scenes');
  const [data, setData] = useState({
    scenes: [],
    performers: [],
    studios: [],
    tags: [],
    clips: []
  });
  const [pagination, setPagination] = useState({
    scenes: { page: 1, total: 0, totalPages: 1, hasMore: false, perPage: 20 },
    performers: { page: 1, total: 0, totalPages: 1, hasMore: false, perPage: 20 },
    studios: { page: 1, total: 0, totalPages: 1, hasMore: false, perPage: 20 },
    tags: { page: 1, total: 0, totalPages: 1, hasMore: false, perPage: 20 },
    clips: { page: 1, total: 0, totalPages: 1, hasMore: false, perPage: 20 }
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('DESC');
  const [watchStatusFilter, setWatchStatusFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null,
    message: ''
  });
  
  // Current page tracking for each tab
  const [currentPage, setCurrentPage] = useState({
    scenes: 1,
    performers: 1,
    studios: 1,
    tags: 1,
    clips: 1
  });

  // Video Player State
  const [videoPlayer, setVideoPlayer] = useState({
    isOpen: false,
    clip: null,
    scene: null,
    playbackInfo: null
  });
  const [videoPlayerFullscreen, setVideoPlayerFullscreen] = useState(false);
  const [videoPlayerControlsVisible, setVideoPlayerControlsVisible] = useState(true);
  const [videoPlayerControlsTimeout, setVideoPlayerControlsTimeout] = useState(null);
  const [autoSkipRetries, setAutoSkipRetries] = useState(0);

  // Slideshow State
  const [slideshow, setSlideshow] = useState({
    isActive: false,
    isLoading: false,
    isFullscreen: false,
    isPaused: false,
    showSettings: false,
    includeGalleries: true,
    includeStandalone: true,
    images: [],
    currentIndex: 0,
    autoAdvance: true,
    interval: 3000
  });

  // Modal State
  const [selectedScene, setSelectedScene] = useState(null);
  const [selectedPerformer, setSelectedPerformer] = useState(null);
  const [deleteSceneId, setDeleteSceneId] = useState(null);

  // Mixed Mode State
  const [mixedMode, setMixedMode] = useState(false);

  // Up Next State
  const [upNextData, setUpNextData] = useState(null);
  const [upNextScene, setUpNextScene] = useState(null);
  const [stats, setStats] = useState({ loading: false, error: null });

  // Initialize content renderers
  const contentRenderers = StashContentRenderers({
    data,
    connectionStatus,
    setSelectedScene,
    setSelectedPerformer,
    setDeleteSceneId,
    setVideoPlayer,
    setAutoSkipRetries
  });

  // API Functions
  const checkConnectionStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/status`);
      const result = await response.json();
      
      console.log('🔍 Connection check result:', result);
      
      setConnectionStatus({
        configured: result.configured || false,
        connected: result.connected || false,
        stashUrl: result.stashUrl || null,
        apiKey: result.apiKey || null
      });
      
      // Note: Removed automatic loadData('upnext') call
      // Up Next data should not auto-load on connection
    } catch (error) {
      console.error('❌ Error checking connection:', error);
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = useCallback(async (type = 'scenes', page = null) => {
    if (!connectionStatus.connected) return;
    
    // Use provided page or get current page for the tab type
    const currentPageForType = page || currentPage[type] || 1;
    
    setIsLoading(true);
    try {
      let endpoint;
      const params = new URLSearchParams({
        page: currentPageForType.toString(),
        limit: '24',
        sort: sortBy,
        direction: sortDirection,
        search: searchQuery || '',
        watched: watchStatusFilter !== 'all' ? watchStatusFilter : ''
      });

      switch (type) {
        case 'upnext':
          endpoint = `/api/stash/clips?${params}`;
          break;
        case 'scenes':
          endpoint = `/api/stash/scenes?${params}`;
          break;
        case 'performers':
          endpoint = `/api/stash/performers?${params}`;
          break;
        case 'studios':
          endpoint = `/api/stash/studios?${params}`;
          break;
        case 'tags':
          endpoint = `/api/stash/tags?${params}`;
          break;
        case 'clips':
          endpoint = `/api/stash/clips?${params}`;
          break;
        default:
          endpoint = `/api/stash/scenes?${params}`;
      }

      console.log(`🔍 Loading ${type} data from:`, endpoint);
      const response = await fetch(`${config.apiBaseUrl}${endpoint}`);
      const result = await response.json();

      if (result.success) {
        if (type === 'upnext') {
          // Load both clips and recent scenes for up next
          setData(prev => ({
            ...prev,
            clips: result.data || [],
            scenes: result.scenes || []
          }));
          setPagination(prev => ({
            ...prev,
            clips: {
              total: result.total || 0,
              hasMore: result.hasMore || false
            }
          }));
        } else {
          setData(prev => ({
            ...prev,
            [type]: result.data || []
          }));
          setPagination(prev => ({
            ...prev,
            [type]: {
              page: result.pagination?.page || currentPageForType,
              total: result.pagination?.total || 0,
              totalPages: result.pagination?.totalPages || 1,
              hasMore: (result.pagination?.page || 1) < (result.pagination?.totalPages || 1),
              perPage: result.pagination?.perPage || 24
            }
          }));
          
          // Update current page state
          setCurrentPage(prev => ({
            ...prev,
            [type]: result.pagination?.page || currentPageForType
          }));
        }
      }
    } catch (error) {
      console.error(`❌ Error loading ${type}:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [connectionStatus.connected, sortBy, sortDirection, searchQuery, watchStatusFilter, currentPage]);

  // Load all library tabs data
  const loadAllLibraryData = useCallback(async () => {
    if (!connectionStatus.connected) return;
    
    console.log('🔄 Pre-loading all library tabs...');
    const libraryTabs = ['scenes', 'performers', 'studios', 'tags', 'clips'];
    
    // Load each tab with simple parameters to avoid dependency loops
    const loadPromises = libraryTabs.map(async (tab) => {
      try {
        let endpoint;
        const params = new URLSearchParams({
          page: '1',
          limit: '24',
          sort: 'date',
          direction: 'DESC',
          search: '',
          watched: ''
        });

        switch (tab) {
          case 'scenes':
            endpoint = `/api/stash/scenes?${params}`;
            break;
          case 'performers':
            endpoint = `/api/stash/performers?${params}`;
            break;
          case 'studios':
            endpoint = `/api/stash/studios?${params}`;
            break;
          case 'tags':
            endpoint = `/api/stash/tags?${params}`;
            break;
          case 'clips':
            endpoint = `/api/stash/clips?${params}`;
            break;
          default:
            return;
        }

        const response = await fetch(`${config.apiBaseUrl}${endpoint}`);
        const result = await response.json();

        if (result.success) {
          setData(prev => ({
            ...prev,
            [tab]: result.data || []
          }));
          setPagination(prev => ({
            ...prev,
            [tab]: {
              page: 1,
              total: result.total || 0,
              totalPages: result.totalPages || 1,
              hasMore: result.hasMore || false,
              perPage: 24
            }
          }));
        }
      } catch (error) {
        console.error(`❌ Error pre-loading ${tab}:`, error);
      }
    });
    
    try {
      await Promise.all(loadPromises);
      console.log('✅ All library tabs pre-loaded');
    } catch (error) {
      console.error('❌ Error pre-loading library tabs:', error);
    }
  }, [connectionStatus.connected]);

  // Pagination navigation functions
  const goToPage = useCallback((type, page) => {
    if (page >= 1 && page <= pagination[type].totalPages) {
      setCurrentPage(prev => ({
        ...prev,
        [type]: page
      }));
      loadData(type, page);
    }
  }, [pagination, loadData]);

  const goToNextPage = useCallback((type) => {
    const nextPage = currentPage[type] + 1;
    if (nextPage <= pagination[type].totalPages) {
      goToPage(type, nextPage);
    }
  }, [currentPage, pagination, goToPage]);

  const goToPreviousPage = useCallback((type) => {
    const prevPage = currentPage[type] - 1;
    if (prevPage >= 1) {
      goToPage(type, prevPage);
    }
  }, [currentPage, goToPage]);

  const runSync = async () => {
    setSyncStatus(prev => ({ ...prev, isRunning: true, message: 'Starting sync...' }));
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/sync`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        setSyncStatus(prev => ({ 
          ...prev, 
          lastSync: new Date().toISOString(),
          message: 'Sync completed successfully'
        }));
        loadData(libraryTab, currentPage);
      }
    } catch (error) {
      console.error('❌ Error running sync:', error);
      setSyncStatus(prev => ({ ...prev, message: 'Sync failed' }));
    } finally {
      setSyncStatus(prev => ({ ...prev, isRunning: false }));
    }
  };

  const refreshStats = async () => {
    await Promise.all([
      loadData('scenes', 1),
      loadData('performers', 1),
      loadData('studios', 1),
      loadData('tags', 1),
      loadData('clips', 1)
    ]);
  };

  const loadStats = async () => {
    setStats({ loading: true, error: null });
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/stats`);
      const result = await response.json();
      
      if (result.success) {
        setStats({
          loading: false,
          error: null,
          ...result.stats,
          lastUpdated: new Date().toISOString()
        });
      } else {
        setStats({ loading: false, error: result.error || 'Failed to load stats' });
      }
    } catch (error) {
      console.error('❌ Error loading stats:', error);
      setStats({ loading: false, error: 'Failed to load stats' });
    }
  };

  const handleGetUpNext = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/next`);
      const result = await response.json();
      
      if (result.success && result.scene) {
        setUpNextData({ scene: result.scene });
        setUpNextScene(result.scene); // Use separate state for Up Next display
      } else if (!result.success) {
        console.log('No unwatched scenes available:', result.message);
        setUpNextData(null);
        setUpNextScene(null);
      }
    } catch (error) {
      console.error('❌ Error getting up next:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkWatched = async (sceneId) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/watched`, {
        method: 'POST'
      });
      const result = await response.json();
      
      if (result.success) {
        // Refresh data to reflect the change
        loadData('scenes');
        loadData('clips');
        handleGetUpNext(); // Refresh up next data
      }
    } catch (error) {
      console.error('❌ Error marking scene as watched:', error);
    }
  };

  const handlePlayScene = (scene, startTime = 0) => {
    setVideoPlayer({
      isOpen: true,
      scene: scene,
      clip: null,
      playbackInfo: {
        startTime,
        autoplay: true
      }
    });
  };

  const handlePauseScene = () => {
    setVideoPlayer(prev => ({
      ...prev,
      playbackInfo: {
        ...prev.playbackInfo,
        autoplay: false
      }
    }));
  };

  const handleClipPlay = async () => {
    // Fetch and start playing the next clip
    setIsLoading(true);
    try {
      console.log('🎬 Fetching clip from:', `${config.apiBaseUrl}/api/stash/clips/next`);
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/next`);
      console.log('📡 Response status:', response.status, response.statusText);
      
      const result = await response.json();
      console.log('📦 Response data:', result);
      
      if (response.ok && result.clip) {
        console.log('🎬 Starting clip play:', result.clip);
        console.log('🎯 Playback info from server:', result.playbackInfo);
        
        // Use the playback info from the server response
        const playbackInfo = {
          startTime: result.playbackInfo?.startTime || result.clip.startTime || 0,
          endTime: result.playbackInfo?.endTime || result.clip.endTime || 60,
          duration: result.playbackInfo?.duration || result.clip.duration || 60,
          clipIndex: result.clip.clipIndex || 0,
          streamUrl: result.playbackInfo?.streamUrl,
          autoplay: true
        };
        
        setVideoPlayer({
          isOpen: true,
          clip: result.clip,
          scene: result.clip.scene || null,
          playbackInfo: playbackInfo
        });
        
        console.log('� Clip playback info:', playbackInfo);
      } else {
        const errorMsg = result.error || result.message || `HTTP ${response.status}: ${response.statusText}`;
        console.log('❌ Clip request failed:', errorMsg);
        console.log('🔍 Full response:', result);
        alert('No clips available to play: ' + errorMsg);
      }
    } catch (error) {
      console.error('❌ Error getting clip:', error);
      alert('Error loading clip: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startSlideshow = async () => {
    console.log('🖼️ Starting slideshow...');
    setSlideshow(prev => ({ ...prev, isLoading: true }));
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/images/slideshow?count=20&includeGalleries=true&includeStandalone=true`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch slideshow images: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('🖼️ Slideshow images response:', result);
      
      if (result.success && result.data && result.data.length > 0) {
        const images = result.data.map(img => ({
          id: img.id,
          path: img.path,
          title: img.title || `Image ${img.id}`,
          url: `${config.apiBaseUrl}/api/stash/image-proxy/image/${img.id}/image`,
          gallery: img.gallery
        }));
        
        console.log('🖼️ Generated images array:', images);
        
        // Enter browser fullscreen automatically
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          document.documentElement.msRequestFullscreen();
        }
        
        setSlideshow({
          isActive: true,
          isLoading: false,
          isFullscreen: true,  // Start in fullscreen mode
          isPaused: false,
          showSettings: false,
          includeGalleries: true,
          includeStandalone: true,
          images: images,
          currentIndex: 0,
          autoAdvance: true,
          interval: 3000
        });
      } else {
        console.log('🖼️ No images available for slideshow');
        alert('No images available for slideshow');
        setSlideshow(prev => ({ ...prev, isLoading: false }));
      }
    } catch (error) {
      console.error('Error starting slideshow:', error);
      alert('Error loading slideshow images: ' + error.message);
      setSlideshow(prev => ({ ...prev, isLoading: false }));
    }
  };

  const nextSlide = () => {
    setSlideshow(prev => ({
      ...prev,
      currentIndex: (prev.currentIndex + 1) % prev.images.length
    }));
  };

  const prevSlide = () => {
    setSlideshow(prev => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.images.length - 1 : prev.currentIndex - 1
    }));
  };

  const handleSlideshowKeyDown = (e) => {
    switch (e.key) {
      case 'Escape':
        // Exit fullscreen when closing slideshow
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        setSlideshow(prev => ({ ...prev, isActive: false }));
        break;
      case 'ArrowRight':
        nextSlide();
        break;
      case 'ArrowLeft':
        prevSlide();
        break;
      case 'f':
      case 'F':
        toggleSlideshowFullscreen();
        break;
      case ' ':
        setSlideshow(prev => ({ ...prev, isPaused: !prev.isPaused }));
        break;
      default:
        break;
    }
  };

  const toggleSlideshowFullscreen = () => {
    setSlideshow(prev => {
      const newFullscreenState = !prev.isFullscreen;
      
      // Use browser's fullscreen API
      if (newFullscreenState) {
        // Enter fullscreen
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          document.documentElement.msRequestFullscreen();
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }
      
      return { ...prev, isFullscreen: newFullscreenState };
    });
  };

  const startMixedMode = () => {
    setMixedMode(true);
  };

  const stopMixedMode = () => {
    setMixedMode(false);
  };

  const handleMarkStashWatched = async (sceneId) => {
    return handleMarkWatched(sceneId);
  };

  const handleDeleteStashScene = async (sceneId) => {
    return handleDeleteScene(sceneId);
  };

  const handleDeleteScene = async (sceneId) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}`, {
        method: 'DELETE'
      });
      const result = await response.json();
      
      if (result.success) {
        setData(prev => ({
          ...prev,
          scenes: prev.scenes.filter(scene => scene.id !== sceneId)
        }));
        setDeleteSceneId(null);
      }
    } catch (error) {
      console.error('❌ Error deleting scene:', error);
    }
  };

  // Video player event handlers
  const handleVideoPlayerMouseMove = () => {
    setVideoPlayerControlsVisible(true);
  };

  const handleVideoPlayerKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      }
      setVideoPlayer({ isOpen: false, clip: null, scene: null, playbackInfo: null });
      setAutoSkipRetries(0);
    }
  };

  const toggleVideoFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setVideoPlayerFullscreen(true);
    } else {
      document.exitFullscreen();
      setVideoPlayerFullscreen(false);
    }
  };

  // Effects
  useEffect(() => {
    checkConnectionStatus();
  }, []);

  useEffect(() => {
    localStorage.setItem('stash-main-tab', mainTab);
    
    // Load stats when switching to stats tab
    if (mainTab === 'stats' && connectionStatus.connected) {
      loadStats();
    }
    
    // Pre-load all library tabs when switching to library tab
    if (mainTab === 'library' && connectionStatus.connected) {
      loadAllLibraryData();
    }
    
    // Note: Removed automatic handleGetUpNext() call for Up Next tab
    // Up Next scene should persist until manually clicking "Next Stash"
  }, [mainTab, connectionStatus.connected, loadAllLibraryData]);

  useEffect(() => {
    if (connectionStatus.connected) {
      loadData(libraryTab, currentPage[libraryTab]);
    }
  }, [libraryTab, currentPage[libraryTab], sortBy, sortDirection, watchStatusFilter]);

  // Pre-load library data when connection is first established
  useEffect(() => {
    if (connectionStatus.connected) {
      loadAllLibraryData();
    }
  }, [connectionStatus.connected, loadAllLibraryData]);

  return (
    <div className="stash-page">
      {/* Video Player Component */}
      <StashVideoPlayer 
        videoPlayer={videoPlayer}
        videoPlayerFullscreen={videoPlayerFullscreen}
        videoPlayerControlsVisible={videoPlayerControlsVisible}
        setVideoPlayerControlsVisible={setVideoPlayerControlsVisible}
        videoPlayerControlsTimeout={videoPlayerControlsTimeout}
        setVideoPlayerControlsTimeout={setVideoPlayerControlsTimeout}
        autoSkipRetries={autoSkipRetries}
        handleVideoPlayerMouseMove={handleVideoPlayerMouseMove}
        handleVideoPlayerKeyDown={handleVideoPlayerKeyDown}
        toggleVideoFullscreen={toggleVideoFullscreen}
        setVideoPlayer={setVideoPlayer}
        setAutoSkipRetries={setAutoSkipRetries}
        setVideoPlayerFullscreen={setVideoPlayerFullscreen}
        connectionStatus={connectionStatus}
        mixedMode={mixedMode}
        MAX_AUTO_SKIP_RETRIES={10}
      />

      {/* Main Content */}
      <div className="stash-content">
        <div className="header-with-buttons">
          <h1>🎬 Stash Content Browser</h1>
          <div className="header-buttons">
            <button 
              className={`connection-status ${connectionStatus.connected ? 'connected' : 'disconnected'}`}
              onClick={checkConnectionStatus}
              disabled={isLoading}
            >
              {connectionStatus.connected ? '🟢 Connected' : '🔴 Disconnected'}
            </button>
          </div>
        </div>

        {/* Connection Status Display */}
        {!connectionStatus.configured && (
          <div className="connection-warning">
            <p>⚠️ Stash is not configured. Please set up your Stash connection in the Settings page.</p>
          </div>
        )}

        {connectionStatus.configured && !connectionStatus.connected && (
          <div className="connection-warning">
            <p>❌ Cannot connect to Stash at {connectionStatus.stashUrl}</p>
            <p>Please check your connection settings and make sure Stash is running.</p>
          </div>
        )}

        {connectionStatus.connected && (
          <>
            {/* Main Tab Navigation */}
            <div className="main-tabs">
              <button 
                className={mainTab === 'upnext' ? 'active' : ''}
                onClick={() => setMainTab('upnext')}
              >
                🎯 Up Next
              </button>
              <button 
                className={mainTab === 'library' ? 'active' : ''}
                onClick={() => setMainTab('library')}
              >
                📚 Library
              </button>
              <button 
                className={mainTab === 'stats' ? 'active' : ''}
                onClick={() => setMainTab('stats')}
              >
                📊 Stats
              </button>
            </div>

            {/* Tab Content */}
            {mainTab === 'upnext' && (
              <StashUpNextTab 
                data={data}
                pagination={pagination}
                setVideoPlayer={setVideoPlayer}
                slideshow={slideshow}
                setSlideshow={setSlideshow}
                mixedMode={mixedMode}
                setMixedMode={setMixedMode}
                setAutoSkipRetries={setAutoSkipRetries}
                selectedScene={upNextScene}
                setSelectedScene={setUpNextScene}
                handleGetUpNext={handleGetUpNext}
                handleClipPlay={handleClipPlay}
                startSlideshow={startSlideshow}
                startMixedMode={startMixedMode}
                stopMixedMode={stopMixedMode}
                handleMarkStashWatched={handleMarkStashWatched}
                handlePlayScene={handlePlayScene}
                handlePauseScene={handlePauseScene}
                handleDeleteStashScene={handleDeleteStashScene}
                upNextLoading={isLoading}
                markingWatched={false}
                deletingScene={false}
                connectionStatus={connectionStatus}
                isLoading={isLoading}
                upNextData={upNextData}
              />
            )}

            {mainTab === 'library' && (
              <StashLibraryTab 
                libraryTab={libraryTab}
                setLibraryTab={setLibraryTab}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                sortBy={sortBy}
                setSortBy={setSortBy}
                sortDirection={sortDirection}
                setSortDirection={setSortDirection}
                watchStatusFilter={watchStatusFilter}
                setWatchStatusFilter={setWatchStatusFilter}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                data={data}
                pagination={pagination}
                loadData={loadData}
                isLoading={isLoading}
                contentRenderers={contentRenderers}
                syncStatus={syncStatus}
                runSync={runSync}
                goToPage={goToPage}
                goToNextPage={goToNextPage}
                goToPreviousPage={goToPreviousPage}
              />
            )}

            {mainTab === 'stats' && (
              <StashStatsTab 
                refreshStats={refreshStats}
                isLoading={isLoading}
                data={data}
                pagination={pagination}
                connectionStatus={connectionStatus}
                syncStatus={syncStatus}
                stats={stats}
                loadStats={loadStats}
                setSelectedPerformer={setSelectedPerformer}
              />
            )}
          </>
        )}
      </div>

      {/* Slideshow Modal */}
      <StashSlideshowModal 
        slideshow={slideshow}
        setSlideshow={setSlideshow}
        nextSlide={nextSlide}
        prevSlide={prevSlide}
        handleSlideshowKeyDown={handleSlideshowKeyDown}
        toggleSlideshowFullscreen={toggleSlideshowFullscreen}
      />

      {/* Modals */}
      <StashModals 
        selectedScene={selectedScene}
        setSelectedScene={setSelectedScene}
        selectedPerformer={selectedPerformer}
        setSelectedPerformer={setSelectedPerformer}
        deleteSceneId={deleteSceneId}
        setDeleteSceneId={setDeleteSceneId}
        handleDeleteScene={handleDeleteScene}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}
