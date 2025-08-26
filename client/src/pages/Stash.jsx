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
  const [activeTab, setActiveTab] = useState('scenes');
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

  // Test Stash connection on component mount
  useEffect(() => {
    testConnection();
  }, []);

  // Load data when tab changes or page changes
  useEffect(() => {
    if (connectionStatus.connected) {
      loadData();
    }
  }, [activeTab, currentPage, sortBy, sortDirection, connectionStatus.connected]);

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

      if (activeTab === 'scenes') {
        params.append('sort', sortBy);
        params.append('direction', sortDirection);
      }

      if (searchQuery.trim()) {
        params.append('filter', searchQuery.trim());
      }

      switch (activeTab) {
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
          [activeTab]: items
        }));

        setPagination(prev => ({
          ...prev,
          [activeTab]: {
            total: result.total || items.length,
            hasMore: result.hasMore || items.length === 20
          }
        }));
      }
    } catch (error) {
      console.error(`Failed to load ${activeTab}:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
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

  // Handle play button click
  const handlePlayScene = async (scene) => {
    const playData = {
      action: 'play',
      scene: {
        id: scene.id,
        title: scene.title || scene.details || 'Untitled Scene',
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
        title: scene.title || scene.details || 'Untitled Scene',
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
        title: scene.title || scene.details || 'Untitled Scene'
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
            {scene.paths && scene.paths.screenshot && (
              <div className="scene-thumbnail">
                <img
                  src={scene.paths.screenshot}
                  alt={scene.title || 'Scene'}
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
                {scene.title || scene.details || 'Untitled Scene'}
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
          <span>Loading {activeTab}...</span>
        </div>
      );
    }

    switch (activeTab) {
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
      <div className="page-header">
        <h1>Stash Integration</h1>
        <p>Browse and manage your Stash video library</p>
      </div>

      {renderConnectionStatus()}

      {connectionStatus.connected && (
        <>
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
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="search-input"
              />
              <Button onClick={handleSearch} disabled={isLoading} className="search-button">
                🔍
              </Button>
            </div>

            {activeTab === 'scenes' && (
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

          {/* Tabs */}
          <div className="tabs-section">
            <div className="tabs">
              {['scenes', 'performers', 'studios', 'tags'].map((tab) => (
                <button
                  key={tab}
                  className={`tab ${activeTab === tab ? 'active' : ''}`}
                  onClick={() => handleTabChange(tab)}
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
          {connectionStatus.connected && !isLoading && (
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
                disabled={!pagination[activeTab]?.hasMore}
                onClick={() => setCurrentPage(currentPage + 1)}
                className="pagination-button"
              >
                Next →
              </Button>
            </div>
          )}
        </>
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
                <h4>{modal.scene?.title || modal.scene?.details || 'Untitled Scene'}</h4>
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
    </div>
  );
}
