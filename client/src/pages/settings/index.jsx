import React, { useState, useEffect } from 'react';
import Button from '../../components/Button'
import './Settings.css'

function Settings() {
  // State management
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Configuration states
  const [collectionName, setCollectionName] = useState('');
  const [comicVineApiKey, setComicVineApiKey] = useState('');
  const [plexToken, setPlexToken] = useState('');
  const [plexUrl, setPlexUrl] = useState('');
  const [tvdbApiKey, setTvdbApiKey] = useState('');
  const [tvdbBearerToken, setTvdbBearerToken] = useState('');
    // Percentage states
  const [tvGeneralPercent, setTvGeneralPercent] = useState(50);
  const [moviesGeneralPercent, setMoviesGeneralPercent] = useState(50);
  const [customOrderPercent, setCustomOrderPercent] = useState(0);
  const [partiallyWatchedCollectionPercent, setPartiallyWatchedCollectionPercent] = useState(75);
  const [plexSyncInterval, setPlexSyncInterval] = useState(12);
  
  // Sync and operation states
  const [plexSyncLoading, setPlexSyncLoading] = useState(false);
  const [plexSyncStatus, setPlexSyncStatus] = useState(null);
  const [plexSyncMessage, setPlexSyncMessage] = useState('');
  const [backgroundSyncStatus, setBackgroundSyncStatus] = useState(null);
  const [backgroundSyncMessage, setBackgroundSyncMessage] = useState('');
  const [tvdbClearLoading, setTvdbClearLoading] = useState(false);
  const [tvdbClearMessage, setTvdbClearMessage] = useState('');
    // Collection states
  const [customOrdersCount, setCustomOrdersCount] = useState(0);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);
  
  // Ignored collections states
  const [ignoredMovieCollections, setIgnoredMovieCollections] = useState([]);
  const [ignoredTVCollections, setIgnoredTVCollections] = useState([]);

  // Utility functions
  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
  };

  const validatePercentages = () => {
    const effectiveCustomOrderPercent = customOrdersCount > 0 ? customOrderPercent : 0;
    const total = tvGeneralPercent + moviesGeneralPercent + effectiveCustomOrderPercent;
    return total === 100;
  };

  const fetchWithErrorHandling = async (url, options = {}) => {
    try {
      const response = await fetch(url, options);
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error(`Error fetching ${url}:`, error);
      throw error;
    }
  };

  // Initialize settings when component mounts
  useEffect(() => {
    const initializeSettings = async () => {
      setLoading(true);
      
      try {
        // Fetch all data in parallel for better performance
        const [settings, syncStatus, backgroundStatus, customCount, collections] = await Promise.all([
          fetchWithErrorHandling('http://localhost:3001/api/settings'),
          fetchWithErrorHandling('http://localhost:3001/api/plex/sync-status'),
          fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync-status'),
          fetchWithErrorHandling('http://localhost:3001/api/custom-orders/count'),
          fetchWithErrorHandling('http://localhost:3001/api/plex/collections')
        ]);        // Update settings
        if (settings) {
          setCollectionName(settings.collectionName || '');
          setComicVineApiKey(settings.comicVineApiKey || '');
          setPlexToken(settings.plexToken || '');
          setPlexUrl(settings.plexUrl || '');
          setTvdbApiKey(settings.tvdbApiKey || '');
          setTvdbBearerToken(settings.tvdbBearerToken || '');
          setTvGeneralPercent(settings.tvGeneralPercent ?? 50);
          setMoviesGeneralPercent(settings.moviesGeneralPercent ?? 50);
          setCustomOrderPercent(settings.customOrderPercent ?? 0);
          setPartiallyWatchedCollectionPercent(settings.partiallyWatchedCollectionPercent ?? 75);
          setPlexSyncInterval(settings.plexSyncInterval ?? 12);
          setIgnoredMovieCollections(settings.ignoredMovieCollections || []);
          setIgnoredTVCollections(settings.ignoredTVCollections || []);
        }

        // Update status and data
        setPlexSyncStatus(syncStatus);
        setBackgroundSyncStatus(backgroundStatus);
        setCustomOrdersCount(customCount.count || 0);
        setAvailableCollections(collections);
        
      } catch (error) {
        showMessage('Failed to load settings data. Please refresh the page.', true);
      } finally {
        setLoading(false);
      }
    };

    initializeSettings();
  }, []);

  // Event handlers
  const handleCollectionNameChange = (e) => {
    setCollectionName(e.target.value);
  };

  const refreshCollections = async () => {
    try {
      setCollectionsLoading(true);
      const collections = await fetchWithErrorHandling('http://localhost:3001/api/plex/collections');
      setAvailableCollections(collections);
      showMessage('Collections refreshed successfully');
    } catch (error) {
      showMessage('Failed to refresh collections', true);
    } finally {
      setCollectionsLoading(false);
    }
  };
  
  const handleTvGeneralPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setTvGeneralPercent(value);
    // Auto-adjust other percentages proportionally to maintain 100%
    const remainingPercent = 100 - value;
    
    if (customOrdersCount === 0) {
      // If no custom orders, only adjust movies
      setMoviesGeneralPercent(remainingPercent);
      setCustomOrderPercent(0);
    } else {
      // Original logic when custom orders are available
      const currentOtherTotal = moviesGeneralPercent + customOrderPercent;
      
      if (currentOtherTotal === 0) {
        // If others are 0, set movies to the remaining
        setMoviesGeneralPercent(remainingPercent);
        setCustomOrderPercent(0);
      } else {
        // Proportionally distribute the remaining percentage
        const moviesRatio = moviesGeneralPercent / currentOtherTotal;
        const customRatio = customOrderPercent / currentOtherTotal;
        
        setMoviesGeneralPercent(Math.round(remainingPercent * moviesRatio));
        setCustomOrderPercent(Math.round(remainingPercent * customRatio));
      }
    }
  };

  const handleMoviesGeneralPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setMoviesGeneralPercent(value);
    // Auto-adjust other percentages proportionally to maintain 100%
    const remainingPercent = 100 - value;
    
    if (customOrdersCount === 0) {
      // If no custom orders, only adjust TV
      setTvGeneralPercent(remainingPercent);
      setCustomOrderPercent(0);
    } else {
      // Original logic when custom orders are available
      const currentOtherTotal = tvGeneralPercent + customOrderPercent;
      
      if (currentOtherTotal === 0) {
        // If others are 0, set TV to the remaining
        setTvGeneralPercent(remainingPercent);
        setCustomOrderPercent(0);
      } else {
        // Proportionally distribute the remaining percentage
        const tvRatio = tvGeneralPercent / currentOtherTotal;
        const customRatio = customOrderPercent / currentOtherTotal;
        
        setTvGeneralPercent(Math.round(remainingPercent * tvRatio));
        setCustomOrderPercent(Math.round(remainingPercent * customRatio));
      }
    }
  };
  const handleCustomOrderPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setCustomOrderPercent(value);
    // Auto-adjust other percentages proportionally to maintain 100%
    const remainingPercent = 100 - value;
    const currentOtherTotal = tvGeneralPercent + moviesGeneralPercent;
    
    if (currentOtherTotal === 0) {
      // If others are 0, set TV to the remaining
      setTvGeneralPercent(remainingPercent);
      setMoviesGeneralPercent(0);
    } else {
      // Proportionally distribute the remaining percentage
      const tvRatio = tvGeneralPercent / currentOtherTotal;
      const moviesRatio = moviesGeneralPercent / currentOtherTotal;
      
      setTvGeneralPercent(Math.round(remainingPercent * tvRatio));
      setMoviesGeneralPercent(Math.round(remainingPercent * moviesRatio));
    }
  };

  const handlePartiallyWatchedCollectionPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setPartiallyWatchedCollectionPercent(value);
  };

  const handlePlexSyncIntervalChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 168) { // 1 hour to 7 days (168 hours)
      setPlexSyncInterval(value);
    }
  };

  const handleSubmit = async () => {
    if (!validatePercentages()) {
      const effectiveCustomOrderPercent = customOrdersCount > 0 ? customOrderPercent : 0;
      const totalPercent = tvGeneralPercent + moviesGeneralPercent + effectiveCustomOrderPercent;
      showMessage(`Error: Order type percentages must add up to exactly 100%. Current total: ${totalPercent}%`, true);
      return;
    }

    try {
      setSaving(true);
      await fetchWithErrorHandling('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },        body: JSON.stringify({ 
          collectionName, 
          comicVineApiKey,
          plexToken,
          plexUrl,
          tvdbApiKey,
          tvdbBearerToken,
          tvGeneralPercent, 
          moviesGeneralPercent,
          customOrderPercent,
          partiallyWatchedCollectionPercent,
          plexSyncInterval,
          ignoredMovieCollections,
          ignoredTVCollections
        }),
      });

      showMessage('Settings saved successfully!');
      
      // Refresh background sync status after settings update
      const backgroundStatus = await fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync-status');
      setBackgroundSyncStatus(backgroundStatus);
      
    } catch (error) {
      showMessage(`Error saving settings: ${error.message}`, true);
    } finally {
      setSaving(false);
    }
  };

  const handlePlexSync = async () => {
    setPlexSyncLoading(true);
    setPlexSyncMessage('Starting Plex library sync...');
    
    try {
      const data = await fetchWithErrorHandling('http://localhost:3001/api/plex/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setPlexSyncMessage(`Sync completed! Synced ${data.totalShows} TV shows and ${data.totalMovies} movies in ${data.duration}`);
      
      // Refresh sync status
      const status = await fetchWithErrorHandling('http://localhost:3001/api/plex/sync-status');
      setPlexSyncStatus(status);
      
    } catch (error) {
      setPlexSyncMessage(`Sync failed: ${error.message}`);
    } finally {
      setPlexSyncLoading(false);
    }
  };

  const handleTvdbClearCache = async () => {
    setTvdbClearLoading(true);
    setTvdbClearMessage('Clearing TVDB cache...');
    
    try {
      await fetchWithErrorHandling('http://localhost:3001/api/tvdb/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setTvdbClearMessage('TVDB cache cleared successfully!');
    } catch (error) {
      setTvdbClearMessage(`Failed to clear cache: ${error.message}`);
    } finally {
      setTvdbClearLoading(false);
    }
  };

  const fetchBackgroundSyncStatus = async () => {
    try {
      const status = await fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync-status');
      setBackgroundSyncStatus(status);
    } catch (error) {
      setBackgroundSyncMessage('Failed to fetch background sync status');
    }
  };

  const handleStartBackgroundSync = async () => {
    try {
      await fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync/start', {
        method: 'POST'
      });
      
      setBackgroundSyncMessage('Background sync started successfully');
      fetchBackgroundSyncStatus();
    } catch (error) {
      setBackgroundSyncMessage(`Failed to start background sync: ${error.message}`);
    }
  };

  const handleStopBackgroundSync = async () => {
    try {
      await fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync/stop', {
        method: 'POST'
      });
      
      setBackgroundSyncMessage('Background sync stopped successfully');
      fetchBackgroundSyncStatus();
    } catch (error) {
      setBackgroundSyncMessage(`Failed to stop background sync: ${error.message}`);
    }
  };

  const handleForceBackgroundSync = async () => {
    try {
      setBackgroundSyncMessage('Starting forced background sync...');
      await fetchWithErrorHandling('http://localhost:3001/api/plex/background-sync/force-now', {
        method: 'POST'
      });
      
      setBackgroundSyncMessage('Forced background sync completed successfully');
      fetchBackgroundSyncStatus();
    } catch (error) {
      setBackgroundSyncMessage(`Failed to force background sync: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <main className="settings-main">
        <div className="settings-header">
          <h1>Settings</h1>
          <div className="loading-spinner">Loading settings...</div>
        </div>
      </main>
    );
  }
  return (
    <main className="settings-main">
      <div className="settings-header">
        <h1>Settings</h1>
        <p className="settings-subtitle">Configure your Master Order application</p>
      </div>

      {/* Main Grid Layout */}
      <div className="settings-grid">
        
        {/* Left Column - Configuration */}
        <div className="settings-column settings-column-left">
          
          {/* Collection & API Configuration Combined */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>🔑 Configuration</h3>
              <p>API keys, tokens, and collection settings</p>
            </div>
            
            {/* Collection Selection */}
            <div className="config-subsection">
              <h4 className="subsection-title">📁 Collection Selection</h4>
              <div className="collection-control compact">
                <label htmlFor="collection_name">Collection:</label>
                <div className="collection-input-group">
                  <select 
                    id="collection_name"
                    name="collection_name"
                    value={collectionName}
                    onChange={handleCollectionNameChange}
                    className="collection-select"
                  >
                    <option value="">No Collection (All Movies & Series)</option>
                    {availableCollections.map(collection => (
                      <option key={collection.value} value={collection.value}>
                        {collection.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={refreshCollections}
                    disabled={collectionsLoading}
                    className="refresh-button compact"
                  >
                    {collectionsLoading ? '⏳' : '🔄'}
                  </Button>
                </div>
              </div>
            </div>

            {/* API Configuration Grid */}
            <div className="config-subsection">
              <h4 className="subsection-title">🔑 API Configuration</h4>
              <div className="api-config-grid">
                <div className="config-field compact">
                  <label htmlFor="comicvine_api_key">ComicVine API Key:</label>
                  <input 
                    type="text" 
                    id="comicvine_api_key"
                    name="comicvine_api_key"
                    value={comicVineApiKey}
                    onChange={(e) => setComicVineApiKey(e.target.value)}
                    placeholder="Enter ComicVine API key"
                    className="api-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="plex_url">Plex Server URL:</label>
                  <input 
                    type="url" 
                    id="plex_url"
                    name="plex_url"
                    value={plexUrl}
                    onChange={(e) => setPlexUrl(e.target.value)}
                    placeholder="http://192.168.1.100:32400"
                    className="url-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="plex_token">Plex Token:</label>
                  <input 
                    type="password" 
                    id="plex_token"
                    name="plex_token"
                    value={plexToken}
                    onChange={(e) => setPlexToken(e.target.value)}
                    placeholder="Enter Plex token"
                    className="token-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="tvdb_api_key">TVDB API Key:</label>
                  <input 
                    type="text" 
                    id="tvdb_api_key"
                    name="tvdb_api_key"
                    value={tvdbApiKey}
                    onChange={(e) => setTvdbApiKey(e.target.value)}
                    placeholder="Enter TVDB API key"
                    className="api-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="tvdb_bearer_token">TVDB Bearer Token:</label>
                  <input 
                    type="password" 
                    id="tvdb_bearer_token"
                    name="tvdb_bearer_token"
                    value={tvdbBearerToken}
                    onChange={(e) => setTvdbBearerToken(e.target.value)}
                    placeholder="Enter TVDB bearer token"
                    className="token-input compact"
                  />
                </div>
              </div>
            </div>
          </div>          {/* Order Types Configuration */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>⚖️ Order Types</h3>
              <p>Configure content selection percentages</p>
            </div>
            
            <div className="order-types-container compact">
              <div className="order-type-control compact">
                <label htmlFor="tv_general_percent">📺 TV: {tvGeneralPercent}%</label>
                <input 
                  type="range" 
                  id="tv_general_percent"
                  name="tv_general_percent"
                  min="0"
                  max="100"
                  value={tvGeneralPercent}
                  onChange={handleTvGeneralPercentChange}
                  className="percentage-slider tv-slider"
                />
              </div>

              <div className="order-type-control compact">
                <label htmlFor="movies_general_percent">🎬 Movies: {moviesGeneralPercent}%</label>
                <input 
                  type="range" 
                  id="movies_general_percent"
                  name="movies_general_percent"
                  min="0"
                  max="100"
                  value={moviesGeneralPercent}
                  onChange={handleMoviesGeneralPercentChange}
                  className="percentage-slider movie-slider"
                />
              </div>

              {customOrdersCount > 0 && (
                <div className="order-type-control compact">
                  <label htmlFor="custom_order_percent">⭐ Custom: {customOrderPercent}%</label>
                  <input 
                    type="range" 
                    id="custom_order_percent"
                    name="custom_order_percent"
                    min="0"
                    max="100"
                    value={customOrderPercent}
                    onChange={handleCustomOrderPercentChange}
                    className="percentage-slider custom-slider"
                  />
                </div>              )}

              <div className="percentage-display compact">
                {(() => {
                  const effectiveCustomOrderPercent = customOrdersCount > 0 ? customOrderPercent : 0;
                  const total = tvGeneralPercent + moviesGeneralPercent + effectiveCustomOrderPercent;
                  const isValid = total === 100;
                  
                  return (
                    <div className={`total-display ${isValid ? 'valid' : 'invalid'}`}>
                      <span className="total-text">Total: {total}%</span>
                      <span className="total-icon">{isValid ? '✅' : '⚠️'}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Movie Selection Settings */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>🎬 Movie Selection</h3>
              <p>Configure movie prioritization settings</p>
            </div>
            
            <div className="movie-settings-container compact">
              <div className="movie-setting-control compact">
                <label htmlFor="partially_watched_collection_percent">
                  📊 Partially Watched Collections Priority: {partiallyWatchedCollectionPercent}%
                </label>
                <p className="setting-description">
                  How likely movies from collections with at least one watched movie are to be selected
                </p>
                <input 
                  type="range" 
                  id="partially_watched_collection_percent"
                  name="partially_watched_collection_percent"
                  min="0"
                  max="100"
                  value={partiallyWatchedCollectionPercent}
                  onChange={handlePartiallyWatchedCollectionPercentChange}
                  className="percentage-slider collection-priority-slider"
                />
              </div>
            </div>
          </div>

          {/* Ignored Collections */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>🚫 Ignored Collections</h3>
              <p>Select collections to exclude from movie and TV selection</p>
            </div>
            
            <div className="ignored-collections-container compact">
              <div className="ignored-collection-control compact">
                <label htmlFor="ignored_movie_collections">🎬 Ignored Movie Collections:</label>
                <p className="setting-description">
                  Movies from these collections will not be selected for watching
                </p>
                <div className="collection-checkboxes">
                  {availableCollections.map(collection => (
                    <label key={`movie-${collection.value}`} className="collection-checkbox">
                      <input
                        type="checkbox"
                        checked={ignoredMovieCollections.includes(collection.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setIgnoredMovieCollections([...ignoredMovieCollections, collection.value]);
                          } else {
                            setIgnoredMovieCollections(ignoredMovieCollections.filter(c => c !== collection.value));
                          }
                        }}
                      />
                      <span className="collection-name">{collection.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="ignored-collection-control compact">
                <label htmlFor="ignored_tv_collections">📺 Ignored TV Collections:</label>
                <p className="setting-description">
                  TV shows from these collections will not be selected for watching
                </p>
                <div className="collection-checkboxes">
                  {availableCollections.map(collection => (
                    <label key={`tv-${collection.value}`} className="collection-checkbox">
                      <input
                        type="checkbox"
                        checked={ignoredTVCollections.includes(collection.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setIgnoredTVCollections([...ignoredTVCollections, collection.value]);
                          } else {
                            setIgnoredTVCollections(ignoredTVCollections.filter(c => c !== collection.value));
                          }
                        }}
                      />
                      <span className="collection-name">{collection.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Operations & Status */}
        <div className="settings-column settings-column-right">
          
          {/* Background Sync & Library Sync Combined */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>🔄 Sync Operations</h3>
              <p>Manage Plex synchronization and background processes</p>
            </div>
            
            {/* Background Sync */}
            <div className="sync-subsection">
              <h4 className="subsection-title">🔄 Background Sync</h4>
              <div className="sync-config-row">
                <div className="sync-interval-control compact">
                  <label htmlFor="plex_sync_interval">⏰ Interval: {plexSyncInterval}h</label>
                  <input 
                    type="range" 
                    id="plex_sync_interval"
                    name="plex_sync_interval"
                    min="1"
                    max="168"
                    value={plexSyncInterval}
                    onChange={handlePlexSyncIntervalChange}
                    className="interval-slider"
                  />
                </div>
                
                <div className="background-sync-controls compact">
                  <Button
                    onClick={handleStartBackgroundSync}
                    disabled={backgroundSyncStatus?.running}
                    className="sync-button start compact"
                  >
                    ▶️ Start
                  </Button>
                  
                  <Button
                    onClick={handleStopBackgroundSync}
                    disabled={!backgroundSyncStatus?.running}
                    className="sync-button stop compact"
                  >
                    ⏹️ Stop
                  </Button>
                  
                  <Button
                    onClick={handleForceBackgroundSync}
                    className="sync-button force compact"
                  >
                    ⚡ Force
                  </Button>
                </div>
              </div>

              {backgroundSyncStatus && (
                <div className="sync-status-card compact">
                  <div className="status-row">
                    <span className="status-label">Status:</span>
                    <span className={`status-value ${backgroundSyncStatus.running ? 'running' : 'stopped'}`}>
                      {backgroundSyncStatus.running ? '✅ Running' : '❌ Stopped'}
                    </span>
                    {backgroundSyncStatus.lastSync && (
                      <>
                        <span className="status-label">Last:</span>
                        <span className="status-value">{new Date(backgroundSyncStatus.lastSync).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Library Sync */}
            <div className="sync-subsection">
              <h4 className="subsection-title">📚 Library Sync</h4>
              <div className="library-sync-row">
                <Button
                  onClick={handlePlexSync}
                  disabled={plexSyncLoading}
                  className="sync-button primary compact"
                >
                  {plexSyncLoading ? '🔄 Syncing...' : '🔄 Sync Library'}
                </Button>
                
                <Button
                  onClick={handleTvdbClearCache}
                  disabled={tvdbClearLoading}
                  className="cache-button compact"
                >
                  {tvdbClearLoading ? '🧹 Clearing...' : '🧹 Clear Cache'}
                </Button>
              </div>

              {plexSyncStatus && (
                <div className="sync-status-card compact">
                  <div className="status-grid compact">
                    <div className="status-item compact">
                      <span className="status-label">Shows:</span>
                      <span className="status-value">{plexSyncStatus.shows || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Episodes:</span>
                      <span className="status-value">{plexSyncStatus.episodes || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Movies:</span>
                      <span className="status-value">{plexSyncStatus.movies || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Sections:</span>
                      <span className="status-value">{plexSyncStatus.sections || 0}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Messages & Actions */}
          <div className="settings-section compact">
            <div className="section-header compact">
              <h3>💾 Save & Status</h3>
              <p>Save settings and view operation messages</p>
            </div>
            
            <div className="save-actions">
              <Button
                onClick={handleSubmit}
                disabled={!validatePercentages() || saving}
                className="save-button compact"
              >
                {saving ? '💾 Saving...' : '💾 Save All Settings'}
              </Button>
            </div>

            {/* Messages */}
            <div className="messages-container">
              {message && (
                <div className={`message compact ${message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}`}>
                  <p>{message}</p>
                </div>
              )}

              {backgroundSyncMessage && (
                <div className="sync-message compact">
                  <p>{backgroundSyncMessage}</p>
                </div>
              )}

              {plexSyncMessage && (
                <div className="sync-message compact">
                  <p>{plexSyncMessage}</p>
                </div>
              )}

              {tvdbClearMessage && (
                <div className="sync-message compact">
                  <p>{tvdbClearMessage}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default Settings;