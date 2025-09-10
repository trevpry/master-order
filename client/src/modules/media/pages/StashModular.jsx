import React, { useState, useEffect } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState({
    scenes: [],
    performers: [],
    studios: [],
    tags: [],
    clips: []
  });
  const [pagination, setPagination] = useState({
    scenes: { total: 0, hasMore: false },
    performers: { total: 0, hasMore: false },
    studios: { total: 0, hasMore: false },
    tags: { total: 0, hasMore: false },
    clips: { total: 0, hasMore: false }
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('DESC');
  const [watchStatusFilter, setWatchStatusFilter] = useState('all');
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null,
    message: ''
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
  const [autoSkipRetries, setAutoSkipRetries] = useState(0);

  // Slideshow State
  const [slideshow, setSlideshow] = useState({
    isOpen: false,
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
      
      if (result.connected) {
        loadData('upnext');
      }
    } catch (error) {
      console.error('❌ Error checking connection:', error);
      setConnectionStatus(prev => ({ ...prev, connected: false }));
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async (type = 'scenes', page = 1) => {
    if (!connectionStatus.connected) return;
    
    setIsLoading(true);
    try {
      let endpoint;
      const params = new URLSearchParams({
        page: page.toString(),
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
              total: result.total || 0,
              hasMore: result.hasMore || false
            }
          }));
        }
      }
    } catch (error) {
      console.error(`❌ Error loading ${type}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [mainTab]);

  useEffect(() => {
    if (connectionStatus.connected) {
      loadData(libraryTab, currentPage);
    }
  }, [libraryTab, currentPage, sortBy, sortDirection, watchStatusFilter]);

  return (
    <div className="stash-page">
      {/* Video Player Component */}
      <StashVideoPlayer 
        videoPlayer={videoPlayer}
        videoPlayerFullscreen={videoPlayerFullscreen}
        videoPlayerControlsVisible={videoPlayerControlsVisible}
        autoSkipRetries={autoSkipRetries}
        handleVideoPlayerMouseMove={handleVideoPlayerMouseMove}
        handleVideoPlayerKeyDown={handleVideoPlayerKeyDown}
        toggleVideoFullscreen={toggleVideoFullscreen}
        setVideoPlayer={setVideoPlayer}
        setAutoSkipRetries={setAutoSkipRetries}
        setVideoPlayerFullscreen={setVideoPlayerFullscreen}
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
              />
            )}
          </>
        )}
      </div>

      {/* Slideshow Modal */}
      <StashSlideshowModal 
        slideshow={slideshow}
        setSlideshow={setSlideshow}
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
