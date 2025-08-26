import React, { useState, useEffect } from 'react';
import Button from '../components/Button';
import './Stash.css';
import config from '../config';

export default function Stash() {
  const [connectionStatus, setConnectionStatus] = useState({ 
    configured: false, 
    connected: false, 
    stashUrl: null 
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mainTab, setMainTab] = useState(() => {
    // Load main tab from localStorage, default to 'upnext'
    return localStorage.getItem('stash-main-tab') || 'upnext';
  }); // 'upnext' or 'library'
  const [libraryTab, setLibraryTab] = useState('scenes'); // for library sub-tabs
  const [currentPage, setCurrentPage] = useState(1);
  const [data, setData] = useState({
    scenes: [],
    performers: [],
    studios: [],
    tags: []
  });
  const [pagination, setPagination] = useState({
    scenes: { total: 0, hasMore: false },
    performers: { total: 0, hasMore: false },
    studios: { total: 0, hasMore: false },
    tags: { total: 0, hasMore: false }
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortDirection, setSortDirection] = useState('DESC');
  const [syncStatus, setSyncStatus] = useState({
    isRunning: false,
    lastSync: null,
    message: ''
  });
  const [modal, setModal] = useState({
    isOpen: false,
    action: null, // 'play' or 'pause'
    scene: null,
    data: null
  });
  const [upNextLoading, setUpNextLoading] = useState(false);
  const [selectedScene, setSelectedScene] = useState(null); // For showing current/last selected scene
  const [markingWatched, setMarkingWatched] = useState(false);
  const [deletingScene, setDeletingScene] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    scene: null,
    deleteFile: false
  });
  const [stats, setStats] = useState({
    scenes: 0,
    performers: 0,
    studios: 0,
    lastUpdated: null,
    loading: false,
    error: null
  });

  // Helper function to extract filename from path without extension
  const getFileNameFromPath = (path) => {
    if (!path) return null;
    
    // Extract filename from path (handle both forward and back slashes)
    const fileName = path.split(/[/\\]/).pop();
    if (!fileName) return null;
    
    // Remove file extension
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return fileName; // No extension
    
    return fileName.substring(0, lastDotIndex);
  };

  // Helper function to get display title for a scene
  const getSceneDisplayTitle = (scene) => {
    if (!scene) return 'Untitled Scene';
    
    // If scene has a title, use it
    if (scene.title && scene.title.trim()) {
      return scene.title;
    }
    
    // If no title but has details, use details
    if (scene.details && scene.details.trim()) {
      return scene.details;
    }
    
    // If no title or details, try to extract filename from path
    const fileName = getFileNameFromPath(scene.path);
    if (fileName) {
      return fileName;
    }
    
    // Fallback to default
    return 'Untitled Scene';
  };

  // Load selected scene from localStorage on mount
  useEffect(() => {
    const savedScene = localStorage.getItem('stash-selected-scene');
    if (savedScene) {
      try {
        const parsedScene = JSON.parse(savedScene);
        setSelectedScene(parsedScene);
        console.log('Restored selected scene from localStorage:', parsedScene);
      } catch (error) {
        console.warn('Failed to parse saved scene from localStorage:', error);
        localStorage.removeItem('stash-selected-scene');
      }
    }
  }, []);

  // Save selected scene to localStorage whenever it changes
  useEffect(() => {
    if (selectedScene) {
      localStorage.setItem('stash-selected-scene', JSON.stringify(selectedScene));
      console.log('Saved selected scene to localStorage:', selectedScene);
    }
  }, [selectedScene]);

  // Test Stash connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  // Load data when tab changes or page changes
  useEffect(() => {
    if (connectionStatus.connected && mainTab === 'library') {
      loadData();
    }
  }, [libraryTab, currentPage, sortBy, sortDirection, connectionStatus.connected, mainTab]);

  const testConnection = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/test`);
      const result = await response.json();
      
      setConnectionStatus({
        configured: result.configured || false,
        connected: result.success || false,
        message: result.message || 'Unknown status',
        version: result.version || null,
        stashUrl: result.stashUrl || null
      });
    } catch (error) {
      console.error('Failed to test Stash connection:', error);
      setConnectionStatus({
        configured: false,
        connected: false,
        message: 'Failed to test connection',
        stashUrl: null
      });
    }
  };

  const loadData = async () => {
    if (!connectionStatus.connected) return;
    
    setIsLoading(true);
    try {
      let url = '';
      const params = new URLSearchParams({
        page: currentPage,
        perPage: 20
      });

      if (libraryTab === 'scenes') {
        params.append('sort', sortBy);
        params.append('direction', sortDirection);
      }

      if (searchQuery.trim()) {
        params.append('filter', searchQuery.trim());
      }

      switch (libraryTab) {
        case 'scenes':
          url = `${config.apiBaseUrl}/api/stash/scenes?${params}`;
          break;
        case 'performers':
          url = `${config.apiBaseUrl}/api/stash/performers?${params}`;
          break;
        case 'studios':
          url = `${config.apiBaseUrl}/api/stash/studios?${params}`;
          break;
        case 'tags':
          url = `${config.apiBaseUrl}/api/stash/tags?${params}`;
          break;
        default:
          return;
      }

      const response = await fetch(url);
      const result = await response.json();

      if (result.success || result.data) {
        const items = result.data || result.scenes || result.performers || result.studios || result.tags || [];
        
        setData(prev => ({
          ...prev,
          [libraryTab]: items
        }));

        setPagination(prev => ({
          ...prev,
          [libraryTab]: {
            total: result.total || items.length,
            hasMore: result.hasMore || items.length === 20
          }
        }));
      }
    } catch (error) {
      console.error(`Failed to load ${libraryTab}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleLibraryTabChange = (tab) => {
    setLibraryTab(tab);
    setCurrentPage(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Helper function to build the stream URL
  const getStreamUrl = (sceneId) => {
    if (!connectionStatus.stashUrl || !sceneId) return null;
    const baseUrl = connectionStatus.stashUrl.endsWith('/') 
      ? connectionStatus.stashUrl.slice(0, -1) 
      : connectionStatus.stashUrl;
    return `${baseUrl}/scene/${sceneId}/stream`;
  };

  // Helper function to build the scene image URL
  // Load persisted state on component mount
  useEffect(() => {
    try {
      const savedSelectedScene = localStorage.getItem('stash-selectedScene');
      const savedMainTab = localStorage.getItem('stash-mainTab');
      
      if (savedSelectedScene) {
        const parsedScene = JSON.parse(savedSelectedScene);
        setSelectedScene(parsedScene);
      }
      
      if (savedMainTab) {
        setMainTab(savedMainTab);
      }
    } catch (error) {
      console.warn('Failed to load persisted Stash state:', error);
    }
  }, []);

  // Persist selected scene when it changes
  useEffect(() => {
    try {
      if (selectedScene) {
        localStorage.setItem('stash-selectedScene', JSON.stringify(selectedScene));
      } else {
        localStorage.removeItem('stash-selectedScene');
      }
    } catch (error) {
      console.warn('Failed to persist selected scene:', error);
    }
  }, [selectedScene]);

  // Load stats when stats tab is active
  useEffect(() => {
    if (mainTab === 'stats' && connectionStatus.connected) {
      loadStats();
    }
  }, [mainTab, connectionStatus.connected]);

  // Function to load statistics
  const loadStats = async () => {
    setStats(prev => ({ ...prev, loading: true, error: null }));
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/stats`);
      const result = await response.json();
      
      if (result.success) {
        setStats(prev => ({
          ...prev,
          scenes: result.stats.scenes,
          performers: result.stats.performers,
          studios: result.stats.studios,
          lastUpdated: result.stats.lastUpdated,
          loading: false,
          error: null
        }));
      } else {
        setStats(prev => ({
          ...prev,
          loading: false,
          error: result.message || 'Failed to load stats'
        }));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  };

  // Persist main tab when it changes
  useEffect(() => {
    try {
      localStorage.setItem('stash-mainTab', mainTab);
    } catch (error) {
      console.warn('Failed to persist main tab:', error);
    }
  }, [mainTab]);

  const getSceneImageUrl = (scene) => {
    if (!connectionStatus.stashUrl || !scene) return null;
    
    const baseUrl = connectionStatus.stashUrl.endsWith('/') 
      ? connectionStatus.stashUrl.slice(0, -1) 
      : connectionStatus.stashUrl;
    
    // If scene has paths with screenshot, use that
    if (scene.paths && scene.paths.screenshot) {
      // If it's already a full URL, return as-is
      if (scene.paths.screenshot.startsWith('http')) {
        return scene.paths.screenshot;
      }
      // If it's a relative path, build the full URL
      return `${baseUrl}${scene.paths.screenshot}`;
    }
    
    // Fallback to standard screenshot endpoint
    return `${baseUrl}/scene/${scene.id}/screenshot`;
  };

  // Handle play button click
  const handlePlayScene = async (scene) => {
    const playData = {
      action: 'play',
      scene: {
        id: scene.id,
        title: getSceneDisplayTitle(scene),
        streamUrl: getStreamUrl(scene.id),
        resumeTime: scene.resumeTime || 0,
        duration: scene.file?.duration || 0,
        stashUrl: connectionStatus.stashUrl
      }
    };

    await sendCommandToAndroidApp(playData, 'Play');
  };

  // Handle pause button click
  const handlePauseScene = async (scene) => {
    const pauseData = {
      action: 'pause',
      scene: {
        id: scene.id,
        title: getSceneDisplayTitle(scene),
        currentTime: scene.resumeTime || 0 // This would ideally come from current playback position
      }
    };

    await sendCommandToAndroidApp(pauseData, 'Pause');
  };

  // Handle stop button click
  const handleStopScene = async (scene) => {
    const stopData = {
      action: 'stop',
      scene: {
        id: scene.id,
        title: getSceneDisplayTitle(scene)
      }
    };

    await sendCommandToAndroidApp(stopData, 'Stop');
  };

  // Close modal
  const closeModal = () => {
    setModal({
      isOpen: false,
      action: null,
      scene: null,
      data: null
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, scene: null, deleteFile: false });
  };

  // Send command to Android companion app
  const sendCommandToAndroidApp = async (commandData, actionName) => {
    try {
      console.log(`Sending ${actionName} command to Android app:`, commandData);
      
      const response = await fetch(`${config.apiBaseUrl}/api/android/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(commandData)
      });

      if (response.ok) {
        console.log(`${actionName} command sent successfully to Android app`);
      } else {
        console.error(`Failed to send ${actionName} command: HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error(`Failed to send ${actionName} command to Android app:`, error);
    }
  };

  // Legacy function for modal (if needed elsewhere)
  const sendToAndroidApp = async () => {
    await sendCommandToAndroidApp(modal.data, modal.action);
    closeModal();
  };

  const handleSync = async () => {
    setSyncStatus(prev => ({ ...prev, isRunning: true, message: 'Starting sync...' }));
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSyncStatus({
          isRunning: false,
          lastSync: new Date(),
          message: `Sync completed: ${result.results.scenes} scenes, ${result.results.performers} performers, ${result.results.studios} studios, ${result.results.tags} tags`
        });
        
        // Reload current tab data
        loadData();
      } else {
        setSyncStatus({
          isRunning: false,
          lastSync: null,
          message: `Sync failed: ${result.message}`
        });
      }
    } catch (error) {
      console.error('Sync failed:', error);
      setSyncStatus({
        isRunning: false,
        lastSync: null,
        message: `Sync failed: ${error.message}`
      });
    }
  };

  // Handle "Get Up Next" for random Stash scene
  const handleGetUpNext = async () => {
    setUpNextLoading(true);
    try {
      console.log('🎲 Getting random unwatched scene...');
      
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/next`);
      const result = await response.json();
      
      console.log('Next scene API response:', result);
      
      if (result.success && result.scene) {
        console.log(`🎯 Selected unwatched scene: ${result.scene.title} (${result.totalUnwatched} total unwatched)`);
        
        // Store the selected scene
        setSelectedScene(result.scene);
        
        // Show info about the selection
        console.log(`📊 ${result.message}`);
      } else {
        console.log('No unwatched scenes available:', result.message);
        alert(result.message || 'No unwatched scenes available');
      }
    } catch (error) {
      console.error('Failed to get up next:', error);
      alert('Failed to get a random unwatched scene');
    } finally {
      setUpNextLoading(false);
    }
  };

  // Handle mark Stash scene as watched
  const handleMarkStashWatched = async (scene) => {
    setMarkingWatched(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}/watched`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update the selected scene to reflect watched status
        setSelectedScene(prev => ({
          ...prev,
          playCount: (prev.playCount || 0) + 1,
          lastPlayedAt: new Date().toISOString()
        }));
        console.log('Scene marked as watched successfully');
      } else {
        console.error('Failed to mark scene as watched');
      }
    } catch (error) {
      console.error('Error marking scene as watched:', error);
    } finally {
      setMarkingWatched(false);
    }
  };

  // Handle delete Stash scene
  const handleDeleteStashScene = (scene) => {
    setDeleteModal({
      isOpen: true,
      scene: scene,
      deleteFile: false
    });
  };

  const confirmDeleteStashScene = async (deleteFile = false) => {
    if (!deleteModal.scene) return;

    const scene = deleteModal.scene;
    setDeletingScene(true);
    setDeleteModal({ isOpen: false, scene: null, deleteFile: false });
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}?deleteFile=${deleteFile}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Scene deleted successfully:', result);
        
        // Clear the selected scene since it's been deleted
        setSelectedScene(null);
        
        // Reload the scenes list to reflect the deletion
        if (libraryTab === 'scenes') {
          loadData();
        }
        
        alert('Scene deleted successfully!');
      } else {
        console.error('Failed to delete scene:', result);
        alert(`Failed to delete scene: ${result.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting scene:', error);
      alert(`Error deleting scene: ${error.message}`);
    } finally {
      setDeletingScene(false);
    }
  };

  const renderConnectionStatus = () => {
    if (!connectionStatus.configured) {
      return (
        <div className="connection-status warning">
          <div className="status-icon">⚠️</div>
          <div className="status-content">
            <h3>Stash Not Configured</h3>
            <p>Please configure Stash URL and API key in Settings to use this feature.</p>
          </div>
        </div>
      );
    }

    if (!connectionStatus.connected) {
      return (
        <div className="connection-status error">
          <div className="status-icon">❌</div>
          <div className="status-content">
            <h3>Stash Connection Failed</h3>
            <p>{connectionStatus.message}</p>
            <Button onClick={testConnection} className="retry-button">
              Test Connection
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="connection-status success">
        <div className="status-icon">✅</div>
        <div className="status-content">
          <h3>Stash Connected</h3>
          <p>
            {connectionStatus.message}
            {connectionStatus.version && ` (Version: ${connectionStatus.version})`}
          </p>
        </div>
      </div>
    );
  };

  const renderScenes = () => {
    const scenes = data.scenes || [];
    
    return (
      <div className="content-grid scenes-grid">
        {scenes.map((scene) => (
          <div key={scene.id} className="content-card scene-card">
            {getSceneImageUrl(scene) && (
              <div className="scene-thumbnail">
                <img
                  src={getSceneImageUrl(scene)}
                  alt={getSceneDisplayTitle(scene)}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
                <div className="duration-badge">
                  {formatDuration(scene.file?.duration)}
                </div>
              </div>
            )}
            
            <div className="content-card-body">
              <h3 className="content-title">
                {getSceneDisplayTitle(scene)}
              </h3>
              
              <div className="content-meta">
                {scene.date && (
                  <div className="meta-item">
                    <span className="meta-icon">📅</span>
                    <span>{formatDate(scene.date)}</span>
                  </div>
                )}
                
                {scene.rating && (
                  <div className="meta-item">
                    <span className="meta-icon">⭐</span>
                    <span>{scene.rating}/5</span>
                  </div>
                )}
                
                {scene.performers && scene.performers.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">👤</span>
                    <span className="meta-text">
                      {scene.performers.map(p => p.name).join(', ')}
                    </span>
                  </div>
                )}
                
                {scene.studio && (
                  <div className="meta-item">
                    <span className="meta-icon">🏢</span>
                    <span className="meta-text">{scene.studio.name}</span>
                  </div>
                )}
                
                {scene.playCount > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">▶️</span>
                    <span className="meta-text">
                      Played {scene.playCount} time{scene.playCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                
                {scene.lastPlayedAt && (
                  <div className="meta-item">
                    <span className="meta-icon">🕒</span>
                    <span className="meta-text">
                      Last: {formatDate(scene.lastPlayedAt)}
                    </span>
                  </div>
                )}
                
                {scene.resumeTime > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">⏸️</span>
                    <span className="meta-text">
                      Resume: {formatDuration(scene.resumeTime)}
                    </span>
                  </div>
                )}
                
                {scene.playDuration > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">⏱️</span>
                    <span className="meta-text">
                      Watched: {formatDuration(scene.playDuration)}
                    </span>
                  </div>
                )}
                
                {scene.tags && scene.tags.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-icon">🏷️</span>
                    <span className="meta-text">
                      {scene.tags.slice(0, 3).map(t => t.name).join(', ')}
                      {scene.tags.length > 3 && ` +${scene.tags.length - 3}`}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="content-actions">
                {scene.id && (
                  <div className="playback-buttons">
                    <Button
                      className="action-button play-button"
                      onClick={() => handlePlayScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ▶️ Play
                    </Button>
                    <Button
                      className="action-button pause-button"
                      onClick={() => handlePauseScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ⏸️ Pause
                    </Button>
                    <Button
                      className="action-button stop-button"
                      onClick={() => handleStopScene(scene)}
                      disabled={!connectionStatus.stashUrl}
                    >
                      ⏹️ Stop
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPerformers = () => {
    const performers = data.performers || [];
    
    return (
      <div className="content-grid performers-grid">
        {performers.map((performer) => (
          <div key={performer.id} className="content-card performer-card">
            {performer.image_path && (
              <div className="performer-avatar">
                <img
                  src={performer.image_path}
                  alt={performer.name}
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            )}
            
            <div className="content-card-body">
              <h3 className="content-title">{performer.name}</h3>
              
              <div className="content-meta">
                {performer.birthdate && (
                  <div className="meta-item">
                    <span className="meta-icon">🎂</span>
                    <span>Born: {formatDate(performer.birthdate)}</span>
                  </div>
                )}
                
                {performer.country && (
                  <div className="meta-item">
                    <span className="meta-icon">🌍</span>
                    <span>{performer.country}</span>
                  </div>
                )}
                
                {performer.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{performer.scene_count} scenes</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderStudios = () => {
    const studios = data.studios || [];
    
    return (
      <div className="content-grid studios-grid">
        {studios.map((studio) => (
          <div key={studio.id} className="content-card studio-card">
            <div className="content-card-body">
              <div className="studio-header">
                {studio.image_path && (
                  <img
                    src={studio.image_path}
                    alt={studio.name}
                    className="studio-logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                
                <h3 className="content-title">{studio.name}</h3>
              </div>
              
              <div className="content-meta">
                {studio.scene_count && (
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{studio.scene_count} scenes</span>
                  </div>
                )}
                
                {studio.url && (
                  <div className="content-actions">
                    <Button
                      className="action-button"
                      onClick={() => window.open(studio.url, '_blank')}
                    >
                      🔗 Website
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTags = () => {
    const tags = data.tags || [];
    
    return (
      <div className="content-grid tags-grid">
        {tags.map((tag) => (
          <div key={tag.id} className="content-card tag-card">
            <div className="content-card-body">
              <h3 className="content-title">{tag.name}</h3>
              
              {tag.scene_count && (
                <div className="content-meta">
                  <div className="meta-item">
                    <span className="meta-icon">🎬</span>
                    <span>{tag.scene_count} scenes</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (!connectionStatus.connected) {
      return null;
    }

    if (isLoading && currentPage === 1) {
      return (
        <div className="loading-container">
          <div className="loading-spinner">⏳</div>
          <span>Loading {libraryTab}...</span>
        </div>
      );
    }

    switch (libraryTab) {
      case 'scenes':
        return renderScenes();
      case 'performers':
        return renderPerformers();
      case 'studios':
        return renderStudios();
      case 'tags':
        return renderTags();
      default:
        return null;
    }
  };

  const tabLabels = {
    scenes: '🎬 Scenes',
    performers: '👤 Performers',
    studios: '🏢 Studios',
    tags: '🏷️ Tags'
  };

  return (
    <div className="stash-page">
      {/* Main Tabs */}
      <div className="main-tabs-section">
        <div className="main-tabs">
          <button
            className={`main-tab ${mainTab === 'upnext' ? 'active' : ''}`}
            onClick={() => setMainTab('upnext')}
          >
            🎲 Next Stash
          </button>
          <button
            className={`main-tab ${mainTab === 'library' ? 'active' : ''}`}
            onClick={() => setMainTab('library')}
          >
            📚 Library
          </button>
          <button
            className={`main-tab ${mainTab === 'stats' ? 'active' : ''}`}
            onClick={() => setMainTab('stats')}
          >
            📊 Stats
          </button>
        </div>
      </div>

      {mainTab === 'upnext' && (
            <div className="up-next-tab">
              {/* Up Next Content */}
              <div className="up-next-content">
                <div className="up-next-hero">
                  <div className="stash-controls">
                    <Button 
                      onClick={handleGetUpNext} 
                      disabled={upNextLoading || !connectionStatus.connected}
                      className={`up-next-main-button ${upNextLoading ? 'loading' : ''}`}
                    >
                      {upNextLoading ? '🎲 Getting...' : '🎲 Next Stash'}
                    </Button>
                    
                    {selectedScene && (
                      <>
                        {/* Scene Title */}
                        <h3 className="selected-scene-title">
                          {getSceneDisplayTitle(selectedScene)}
                        </h3>
                        
                        {/* Action Buttons */}
                        <div className="stash-action-buttons">
                          <Button
                            onClick={() => handleMarkStashWatched(selectedScene)}
                            disabled={markingWatched}
                            style={{ 
                              backgroundColor: '#28a745', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Mark as Watched"
                          >
                            {markingWatched ? '⏳' : '✓'}
                          </Button>
                          
                          <Button
                            onClick={() => handlePlayScene(selectedScene)}
                            disabled={!connectionStatus.stashUrl}
                            style={{ 
                              backgroundColor: '#e5a00d', 
                              color: '#000',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Play Scene"
                          >
                            ▶️
                          </Button>
                          
                          <Button
                            onClick={() => handlePauseScene(selectedScene)}
                            disabled={!connectionStatus.stashUrl}
                            style={{ 
                              backgroundColor: '#f39c12', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Pause Scene"
                          >
                            ⏸️
                          </Button>
                          
                          <Button
                            onClick={() => handleDeleteStashScene(selectedScene)}
                            disabled={deletingScene || !selectedScene}
                            style={{ 
                              backgroundColor: '#dc3545', 
                              color: '#fff',
                              minWidth: '40px',
                              padding: '8px 12px'
                            }}
                            title="Delete Scene (keeps video file)"
                          >
                            {deletingScene ? '⏳' : '🗑️'}
                          </Button>
                        </div>
                        
                        {/* Scene Image */}
                        {selectedScene && (
                          <div className="selected-scene-image">
                            <img
                              src={getSceneImageUrl(selectedScene)}
                              alt={getSceneDisplayTitle(selectedScene)}
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                            <div className="duration-badge">
                              {formatDuration(selectedScene.file?.duration)}
                            </div>
                          </div>
                        )}
                        
                        {/* Scene Metadata Card */}
                        {selectedScene && (
                          <div className="scene-metadata-card">
                            <div className="scene-meta">
                              {selectedScene.date && (
                                <div className="meta-item">
                                  <span className="meta-icon">📅</span>
                                  <span>{formatDate(selectedScene.date)}</span>
                                </div>
                              )}
                              
                              {selectedScene.studio && (
                                <div className="meta-item">
                                  <span className="meta-icon">🏢</span>
                                  <span>{selectedScene.studio.name}</span>
                                </div>
                              )}
                              
                              {selectedScene.performers && selectedScene.performers.length > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">👤</span>
                                  <span>
                                    {selectedScene.performers.map(p => p.name).join(', ')}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.rating && (
                                <div className="meta-item">
                                  <span className="meta-icon">⭐</span>
                                  <span>{selectedScene.rating}/5</span>
                                </div>
                              )}
                              
                              {selectedScene.playCount > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">▶️</span>
                                  <span>
                                    Played {selectedScene.playCount} time{selectedScene.playCount !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.lastPlayedAt && (
                                <div className="meta-item">
                                  <span className="meta-icon">🕒</span>
                                  <span>
                                    Last: {formatDate(selectedScene.lastPlayedAt)}
                                  </span>
                                </div>
                              )}
                              
                              {selectedScene.tags && selectedScene.tags.length > 0 && (
                                <div className="meta-item">
                                  <span className="meta-icon">🏷️</span>
                                  <span>
                                    {selectedScene.tags.slice(0, 3).map(t => t.name).join(', ')}
                                    {selectedScene.tags.length > 3 && ` +${selectedScene.tags.length - 3}`}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mainTab === 'library' && (
            <div className="library-tab">
              {/* Sync Section */}
              <div className="sync-section">
                <div className="sync-controls">
                  <Button 
                    onClick={handleSync} 
                    disabled={syncStatus.isRunning}
                    className={`sync-button ${syncStatus.isRunning ? 'syncing' : ''}`}
                  >
                    {syncStatus.isRunning ? '🔄 Syncing...' : '🔄 Sync Library'}
                  </Button>
                  
                  {syncStatus.lastSync && (
                    <div className="sync-info">
                      <span className="sync-time">
                        Last sync: {syncStatus.lastSync.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
                {syncStatus.message && (
                  <div className={`sync-message ${syncStatus.isRunning ? 'running' : 'complete'}`}>
                    {syncStatus.message}
                  </div>
                )}
              </div>

              {/* Search and Controls */}
              <div className="controls-section">
                <div className="search-controls">
                  <input
                    type="text"
                    placeholder={`Search ${libraryTab}...`}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="search-input"
                  />
                  <Button onClick={handleSearch} disabled={isLoading} className="search-button">
                    🔍
                  </Button>
                </div>

                {libraryTab === 'scenes' && (
                  <div className="sort-controls">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="sort-select"
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      <option value="rating">Rating</option>
                      <option value="duration">Duration</option>
                    </select>
                    
                    <Button
                      className="sort-direction-button"
                      onClick={() => setSortDirection(sortDirection === 'ASC' ? 'DESC' : 'ASC')}
                    >
                      {sortDirection === 'ASC' ? '↑' : '↓'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Library Sub-Tabs */}
              <div className="tabs-section">
                <div className="tabs">
                  {['scenes', 'performers', 'studios', 'tags'].map((tab) => (
                    <button
                      key={tab}
                      className={`tab ${libraryTab === tab ? 'active' : ''}`}
                      onClick={() => handleLibraryTabChange(tab)}
                    >
                      {tabLabels[tab]}
                      {pagination[tab]?.total > 0 && (
                        <span className="tab-count">({pagination[tab].total})</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <div className="content-section">
                {renderContent()}
              </div>

              {/* Pagination */}
              {!isLoading && (
                <div className="pagination-section">
                  <Button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                    className="pagination-button"
                  >
                    ← Previous
                  </Button>
                  
                  <span className="page-indicator">
                    Page {currentPage}
                  </span>
                  
                  <Button
                    disabled={!pagination[libraryTab]?.hasMore}
                    onClick={() => setCurrentPage(currentPage + 1)}
                    className="pagination-button"
                  >
                    Next →
                  </Button>
                </div>
              )}
            </div>
          )}

          {mainTab === 'stats' && (
            <div className="stats-tab">
              <div className="stats-header">
                <h2>📊 Database Statistics</h2>
                {stats.lastUpdated && (
                  <p className="last-updated">
                    Last updated: {new Date(stats.lastUpdated).toLocaleString()}
                  </p>
                )}
              </div>

              {stats.loading ? (
                <div className="loading-stats">
                  <div className="loading-spinner"></div>
                  <p>Loading statistics...</p>
                </div>
              ) : stats.error ? (
                <div className="stats-error">
                  <div className="error-icon">❌</div>
                  <h3>Error Loading Statistics</h3>
                  <p>{stats.error}</p>
                  <Button onClick={loadStats} className="retry-button">
                    🔄 Retry
                  </Button>
                </div>
              ) : (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-icon">🎬</div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.scenes.toLocaleString()}</div>
                      <div className="stat-label">Scenes</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">👥</div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.performers.toLocaleString()}</div>
                      <div className="stat-label">Performers</div>
                    </div>
                  </div>

                  <div className="stat-card">
                    <div className="stat-icon">🏢</div>
                    <div className="stat-content">
                      <div className="stat-number">{stats.studios.toLocaleString()}</div>
                      <div className="stat-label">Studios</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="stats-actions">
                <Button onClick={loadStats} disabled={stats.loading} className="refresh-stats-button">
                  {stats.loading ? '⏳ Loading...' : '🔄 Refresh Statistics'}
                </Button>
              </div>
            </div>
          )}

      {/* Modal for showing Android companion app data */}
      {modal.isOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                {modal.action === 'play' ? '▶️ Play Scene' : '⏸️ Pause Scene'}
              </h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="scene-info">
                <h4>{getSceneDisplayTitle(modal.scene)}</h4>
                {modal.scene?.file?.duration && (
                  <p>Duration: {formatDuration(modal.scene.file.duration)}</p>
                )}
                {modal.scene?.resumeTime > 0 && (
                  <p>Resume from: {formatDuration(modal.scene.resumeTime)}</p>
                )}
              </div>
              
              <div className="data-preview">
                <h4>Data to be sent to Android companion app:</h4>
                <pre className="json-preview">
                  {JSON.stringify(modal.data, null, 2)}
                </pre>
              </div>
            </div>
            
            <div className="modal-footer">
              <Button 
                className="modal-button secondary" 
                onClick={closeModal}
              >
                Cancel
              </Button>
              <Button 
                className="modal-button primary" 
                onClick={sendToAndroidApp}
              >
                Send to Android App
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="modal-overlay" onClick={closeDeleteModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Delete Scene</h3>
              <button className="modal-close" onClick={closeDeleteModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="scene-info">
                <h4>{getSceneDisplayTitle(deleteModal.scene)}</h4>
                <p className="warning-text">
                  ⚠️ This action cannot be undone. The scene will be removed from both 
                  our database and Stash.
                </p>
              </div>
              
              <div className="delete-options">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={deleteModal.deleteFile}
                    onChange={(e) => setDeleteModal(prev => ({ ...prev, deleteFile: e.target.checked }))}
                  />
                  Also delete the video file from disk
                  <span className="checkbox-warning"> (This will permanently delete the file!)</span>
                </label>
              </div>
            </div>
            
            <div className="modal-footer">
              <Button 
                className="modal-button secondary" 
                onClick={closeDeleteModal}
              >
                Cancel
              </Button>
              <Button 
                className="modal-button danger" 
                onClick={() => confirmDeleteStashScene(deleteModal.deleteFile)}
                style={{ backgroundColor: '#dc3545' }}
              >
                Delete Scene
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
