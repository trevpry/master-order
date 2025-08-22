import React, { useState, useEffect } from 'react';
import Button from '../../components/Button'
import config from '../../config';
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
  const [timezone, setTimezone] = useState('UTC');
    // Percentage states
  const [tvGeneralPercent, setTvGeneralPercent] = useState(50);
  const [moviesGeneralPercent, setMoviesGeneralPercent] = useState(50);
  const [customOrderPercent, setCustomOrderPercent] = useState(0);
  const [partiallyWatchedCollectionPercent, setPartiallyWatchedCollectionPercent] = useState(75);
  const [plexSyncInterval, setPlexSyncInterval] = useState(12);
  
  // Christmas filter state
  const [christmasFilterEnabled, setChristmasFilterEnabled] = useState(false);
  
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
  
  // Plex players states
  const [availablePlayers, setAvailablePlayers] = useState([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  
  // Plex users states
  const [availablePlexUsers, setAvailablePlexUsers] = useState([]);
  const [plexUsersLoading, setPlexUsersLoading] = useState(false);
  const [selectedPlexUser, setSelectedPlexUser] = useState('');
  
  const [deviceStatus, setDeviceStatus] = useState({
    isOnline: false,
    lastChecked: null,
    checking: false,
    isMobile: false
  });
  const [deviceStatusLoading, setDeviceStatusLoading] = useState(false);
  const [deviceStatusDetails, setDeviceStatusDetails] = useState(null);
  
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
      
      try {        // Fetch all data in parallel for better performance
        const [settings, syncStatus, backgroundStatus, customCount, collections, players, plexUsers] = await Promise.all([
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync-status`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync-status`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/custom-orders/count`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/collections`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/players`).catch(error => {
            console.warn('Failed to load Plex players:', error);
            return [];
          }),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/users`).catch(error => {
            console.warn('Failed to load Plex users:', error);
            return [];
          })
        ]);// Update settings
        if (settings) {
          setCollectionName(settings.collectionName || '');
          setComicVineApiKey(settings.comicVineApiKey || '');
          setPlexToken(settings.plexToken || '');
          setPlexUrl(settings.plexUrl || '');
          setTvdbApiKey(settings.tvdbApiKey || '');
          setTvdbBearerToken(settings.tvdbBearerToken || '');
          setSelectedPlayer(settings.selectedPlayer || '');
          setSelectedPlexUser(settings.selectedPlexUser || '');
          setTimezone(settings.timezone || 'UTC');
          setTvGeneralPercent(settings.tvGeneralPercent ?? 50);
          setMoviesGeneralPercent(settings.moviesGeneralPercent ?? 50);
          setCustomOrderPercent(settings.customOrderPercent ?? 0);
          setPartiallyWatchedCollectionPercent(settings.partiallyWatchedCollectionPercent ?? 75);
          setPlexSyncInterval(settings.plexSyncInterval ?? 12);
          setIgnoredMovieCollections(settings.ignoredMovieCollections || []);
          setIgnoredTVCollections(settings.ignoredTVCollections || []);
          setChristmasFilterEnabled(settings.christmasFilterEnabled ?? false);
        }        // Update status and data
        setPlexSyncStatus(syncStatus);
        setBackgroundSyncStatus(backgroundStatus);
        setCustomOrdersCount(customCount.count || 0);
        setAvailableCollections(collections);
        setAvailablePlayers(players || []);
        setAvailablePlexUsers(plexUsers || []);
        
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
      const collections = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/collections`);
      setAvailableCollections(collections);
      showMessage('Collections refreshed successfully');
    } catch (error) {
      showMessage('Failed to refresh collections', true);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const refreshPlayers = async () => {
    try {
      setPlayersLoading(true);
      const players = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/players`);
      setAvailablePlayers(players || []);
      
      // Check if selected player is currently online
      if (selectedPlayer) {
        checkDeviceStatus(selectedPlayer, players || []);
      }
      
      showMessage('Plex players refreshed successfully');
    } catch (error) {
      showMessage('Failed to refresh Plex players', true);
    } finally {
      setPlayersLoading(false);
    }
  };

  const refreshPlexUsers = async () => {
    try {
      setPlexUsersLoading(true);
      const plexUsers = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/users`);
      setAvailablePlexUsers(plexUsers || []);
      showMessage('Plex users refreshed successfully');
    } catch (error) {
      showMessage('Failed to refresh Plex users', true);
    } finally {
      setPlexUsersLoading(false);
    }
  };

  const checkDeviceStatus = async (playerId, currentPlayers = null) => {
    if (!playerId) return;
    
    try {
      setDeviceStatus(prev => ({ ...prev, checking: true }));
      
      // Use current players if provided, otherwise fetch fresh
      const players = currentPlayers || await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/players`);
      const device = players.find(p => p.machineIdentifier === playerId || p.value === playerId);
      
      const isMobile = playerId.includes('android') || playerId.includes('ios') || playerId.includes('mobile');
      const isRegistered = device?.isRegistered || false;
      const isOnline = !!device && !device.value && !isRegistered; // Active connections are online, registered devices are offline unless actively connected
      
      setDeviceStatus({
        isOnline,
        lastChecked: new Date(),
        checking: false,
        isMobile,
        isRegistered,
        deviceName: device?.name || playerId
      });
      
    } catch (error) {
      console.error('Error checking device status:', error);
      setDeviceStatus(prev => ({ 
        ...prev, 
        checking: false,
        lastChecked: new Date() 
      }));
    }
  };

  const checkDetailedDeviceStatus = async () => {
    if (!selectedPlayer) {
      showMessage('No device selected', true);
      return;
    }
    
    try {
      setDeviceStatusLoading(true);
      setDeviceStatusDetails(null);
      
      console.log(`Checking detailed status for device: ${selectedPlayer}`);
      
      const response = await fetchWithErrorHandling(
        `${config.apiBaseUrl}/api/plex/device-status/${encodeURIComponent(selectedPlayer)}`
      );
      
      setDeviceStatusDetails(response);
      
      if (response.success && response.found) {
        showMessage(`Device status check completed for ${response.device.name}`);
        
        // Update the basic device status as well
        setDeviceStatus(prev => ({
          ...prev,
          isOnline: response.responsiveness?.responsive || false,
          lastChecked: new Date(),
          checking: false,
          deviceName: response.device.name,
          isRegistered: response.device.isRegistered,
          isMobile: response.device.platform === 'Android' || response.device.platform === 'iOS'
        }));
      } else {
        showMessage(`Device not found: ${selectedPlayer}`, true);
      }
      
    } catch (error) {
      console.error('Error checking detailed device status:', error);
      showMessage('Failed to check device status: ' + error.message, true);
      setDeviceStatusDetails({ error: error.message });
    } finally {
      setDeviceStatusLoading(false);
    }
  };

  // Effect to check device status when selected player changes
  useEffect(() => {
    if (selectedPlayer) {
      checkDeviceStatus(selectedPlayer);
      
      // Set up interval to check mobile device status every 10 seconds
      const isMobile = selectedPlayer.includes('android') || selectedPlayer.includes('ios') || selectedPlayer.includes('mobile');
      if (isMobile) {
        const interval = setInterval(() => {
          checkDeviceStatus(selectedPlayer);
        }, 10000);
        
        return () => clearInterval(interval);
      }
    }
  }, [selectedPlayer]);
  
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
      
      // Track if Plex settings changed to refresh players
      const currentSettings = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`);
      const plexSettingsChanged = currentSettings && (
        currentSettings.plexUrl !== plexUrl || 
        currentSettings.plexToken !== plexToken
      );
      
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`, {
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
          selectedPlayer,
          selectedPlexUser,
          timezone,
          tvGeneralPercent, 
          moviesGeneralPercent,
          customOrderPercent,
          partiallyWatchedCollectionPercent,
          plexSyncInterval,
          ignoredMovieCollections,
          ignoredTVCollections,
          christmasFilterEnabled
        }),
      });

      showMessage('Settings saved successfully!');
      
      // Refresh background sync status after settings update
      const backgroundStatus = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync-status`);
      setBackgroundSyncStatus(backgroundStatus);
      
      // Refresh Plex players if Plex settings changed
      if (plexSettingsChanged) {
        console.log('Plex settings changed, refreshing players...');
        try {
          const players = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/players`);
          setAvailablePlayers(players || []);
          console.log('Plex players refreshed successfully');
        } catch (playerError) {
          console.warn('Failed to refresh Plex players after settings update:', playerError);
        }
      }
      
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
      const data = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      setPlexSyncMessage(`Sync completed! Synced ${data.totalShows} TV shows and ${data.totalMovies} movies in ${data.duration}`);
      
      // Refresh sync status
      const status = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync-status`);
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
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/tvdb/clear-cache`, {
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
      const status = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync-status`);
      setBackgroundSyncStatus(status);
    } catch (error) {
      setBackgroundSyncMessage('Failed to fetch background sync status');
    }
  };

  const handleStartBackgroundSync = async () => {
    try {
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync/start`, {
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
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync/stop`, {
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
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync/force-now`, {
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
              <form onSubmit={(e) => e.preventDefault()}>
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
                </div>                <div className="config-field compact">
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
                  <label htmlFor="plex_players">🎬 Plex Player for Remote Playback:</label>
                  <div className="collection-controls">
                    <select 
                      id="plex_players"
                      name="plex_players"
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value)}
                      className="collection-select compact"
                    >
                      <option value="">Select a Plex player/device...</option>
                      {availablePlayers.map((player) => (
                        <option key={player.value} value={player.value}>
                          {player.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={refreshPlayers}
                      disabled={playersLoading}
                      className="refresh-button compact"
                      title="Refresh available Plex players"
                    >
                      {playersLoading ? '🔄' : '🔄'}
                    </Button>
                    {selectedPlayer && (
                      <Button
                        onClick={checkDetailedDeviceStatus}
                        disabled={deviceStatusLoading}
                        className="refresh-button compact"
                        title="Check detailed device status and responsiveness"
                        style={{ marginLeft: '8px' }}
                      >
                        {deviceStatusLoading ? '🔄' : '🔍'}
                      </Button>
                    )}
                  </div>
                  
                  {/* Device Status Indicator */}
                  {selectedPlayer && (
                    <div className="device-status" style={{ 
                      marginTop: '8px', 
                      padding: '8px 12px', 
                      borderRadius: '4px',
                      backgroundColor: deviceStatus.isOnline ? '#d4edda' : 
                                       deviceStatus.isRegistered ? '#fff3cd' : '#f8d7da',
                      border: `1px solid ${deviceStatus.isOnline ? '#c3e6cb' : 
                                            deviceStatus.isRegistered ? '#ffeaa7' : '#f5c6cb'}`,
                      fontSize: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '16px' }}>
                          {deviceStatus.checking ? '🔄' : 
                           deviceStatus.isOnline ? '🟢' : 
                           deviceStatus.isRegistered ? '🟡' : '🔴'}
                        </span>
                        <span style={{ color: deviceStatus.isOnline ? '#155724' : 
                                               deviceStatus.isRegistered ? '#856404' : '#721c24' }}>
                          <strong>{deviceStatus.deviceName || selectedPlayer}</strong>
                          {deviceStatus.isMobile && ' (Mobile Device)'}
                          {deviceStatus.isRegistered && ' (AndroidTV/Media Player)'}
                          {' - '}
                          {deviceStatus.checking ? 'Checking...' : 
                           deviceStatus.isOnline ? 'Online & Ready' : 
                           deviceStatus.isRegistered ? 'Registered & Available' : 'Offline'}
                        </span>
                      </div>
                      
                      {deviceStatus.isRegistered && (
                        <div style={{ 
                          marginTop: '8px', 
                          fontSize: '12px', 
                          color: '#856404',
                          borderTop: '1px solid #ffeaa7',
                          paddingTop: '8px'
                        }}>
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>📺 AndroidTV/Media Device:</strong>
                          </p>
                          <p style={{ margin: '0' }}>
                            This device is registered with your Plex server and ready for remote playback. 
                            It doesn't need to be actively playing to receive playback commands.
                          </p>
                        </div>
                      )}
                      
                      {deviceStatus.isMobile && !deviceStatus.isRegistered && !deviceStatus.isOnline && (
                        <div style={{ 
                          marginTop: '8px', 
                          fontSize: '12px', 
                          color: '#721c24',
                          borderTop: '1px solid #f5c6cb',
                          paddingTop: '8px'
                        }}>
                          <p style={{ margin: '0 0 4px 0' }}>
                            <strong>📱 Mobile Device Help:</strong>
                          </p>
                          <p style={{ margin: '0 0 4px 0' }}>
                            Mobile devices only appear when actively using Plex. To make this device available:
                          </p>
                          <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                            <li>Open Plex app on your device</li>
                            <li>Start playing any video (briefly)</li>
                            <li>The status above will turn green when ready</li>
                          </ol>
                        </div>
                      )}
                      
                      {deviceStatus.lastChecked && (
                        <div style={{ 
                          marginTop: '6px', 
                          fontSize: '11px', 
                          color: '#666',
                          fontStyle: 'italic'
                        }}>
                          Last checked: {deviceStatus.lastChecked.toLocaleTimeString()}
                          {deviceStatus.isMobile && ' (Auto-checking every 10s)'}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Detailed Device Status Results */}
                  {deviceStatusDetails && (
                    <div className="detailed-device-status" style={{ 
                      marginTop: '12px', 
                      padding: '12px', 
                      borderRadius: '6px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #dee2e6',
                      fontSize: '13px'
                    }}>
                      <h4 style={{ margin: '0 0 8px 0', color: '#333' }}>
                        🔍 Detailed Device Status
                      </h4>
                      
                      {deviceStatusDetails.error ? (
                        <div style={{ color: '#721c24', backgroundColor: '#f8d7da', padding: '8px', borderRadius: '4px' }}>
                          <strong>Error:</strong> {deviceStatusDetails.error}
                        </div>
                      ) : !deviceStatusDetails.found ? (
                        <div style={{ color: '#856404', backgroundColor: '#fff3cd', padding: '8px', borderRadius: '4px' }}>
                          <strong>Device Not Found:</strong> {deviceStatusDetails.message}
                          <br />
                          <small>Available devices: {deviceStatusDetails.availableDevices}</small>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {/* Basic Device Info */}
                          <div style={{ 
                            backgroundColor: 'white', 
                            padding: '8px', 
                            borderRadius: '4px', 
                            border: '1px solid #e9ecef' 
                          }}>
                            <strong>📱 Device Information:</strong>
                            <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                              <div><strong>Name:</strong> {deviceStatusDetails.device.name}</div>
                              <div><strong>Product:</strong> {deviceStatusDetails.device.product}</div>
                              <div><strong>Platform:</strong> {deviceStatusDetails.device.platform} {deviceStatusDetails.device.platformVersion}</div>
                              <div><strong>Address:</strong> {deviceStatusDetails.device.address}:{deviceStatusDetails.device.port}</div>
                              <div><strong>Type:</strong> {deviceStatusDetails.device.isRegistered ? 'Registered Device' : 'Active Client'}</div>
                            </div>
                          </div>
                          
                          {/* Responsiveness Status */}
                          {deviceStatusDetails.responsiveness?.checked && (
                            <div style={{ 
                              backgroundColor: deviceStatusDetails.responsiveness.responsive ? '#d4edda' : '#f8d7da',
                              border: `1px solid ${deviceStatusDetails.responsiveness.responsive ? '#c3e6cb' : '#f5c6cb'}`,
                              padding: '8px', 
                              borderRadius: '4px'
                            }}>
                              <strong>🔗 Device Responsiveness:</strong>
                              <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                                <div style={{ 
                                  color: deviceStatusDetails.responsiveness.responsive ? '#155724' : '#721c24' 
                                }}>
                                  <strong>Status:</strong> {deviceStatusDetails.responsiveness.responsive ? '✅ Responsive' : '❌ Not Responsive'}
                                </div>
                                <div><strong>Result:</strong> {deviceStatusDetails.responsiveness.result.message}</div>
                              </div>
                            </div>
                          )}
                          
                          {/* Active Session Info */}
                          <div style={{ 
                            backgroundColor: deviceStatusDetails.activeSession?.hasSession ? '#d1ecf1' : 'white',
                            border: `1px solid ${deviceStatusDetails.activeSession?.hasSession ? '#bee5eb' : '#e9ecef'}`,
                            padding: '8px', 
                            borderRadius: '4px'
                          }}>
                            <strong>🎬 Current Playback:</strong>
                            <div style={{ marginLeft: '16px', marginTop: '4px' }}>
                              {deviceStatusDetails.activeSession?.hasSession ? (
                                <div>
                                  <div style={{ color: '#0c5460' }}>
                                    <strong>Status:</strong> ▶️ Currently Playing
                                  </div>
                                  <div><strong>Title:</strong> {deviceStatusDetails.activeSession.sessionInfo.title}</div>
                                  <div><strong>Type:</strong> {deviceStatusDetails.activeSession.sessionInfo.type}</div>
                                  <div><strong>State:</strong> {deviceStatusDetails.activeSession.sessionInfo.state}</div>
                                  <div><strong>User:</strong> {deviceStatusDetails.activeSession.sessionInfo.user}</div>
                                </div>
                              ) : (
                                <div>
                                  <strong>Status:</strong> ⏹️ Not Currently Playing
                                </div>
                              )}
                              {deviceStatusDetails.activeSession?.error && (
                                <div style={{ color: '#856404', marginTop: '4px' }}>
                                  <small>Note: {deviceStatusDetails.activeSession.error}</small>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Timestamp */}
                          <div style={{ 
                            fontSize: '11px', 
                            color: '#666', 
                            textAlign: 'right',
                            fontStyle: 'italic'
                          }}>
                            Checked: {new Date(deviceStatusDetails.timestamp).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {availablePlayers.length > 0 && availablePlayers.every(player => player.isFallback) && (
                    <p className="collection-hint" style={{ color: '#f39c12' }}>
                      ℹ️ Showing fallback players because no active Plex clients were detected. 
                      These will work but actual devices (open a Plex app first) are preferred.
                    </p>
                  )}
                  {availablePlayers.length === 0 && !playersLoading && (
                    <div className="collection-hint">
                      <p>⚠️ No Plex players found. This can happen if:</p>
                      <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                        <li>• No Plex clients are currently active/connected</li>
                        <li>• Your Plex server URL or token is incorrect</li>
                        <li>• Plex clients are on a different network</li>
                      </ul>
                      <p style={{ marginTop: '12px' }}>
                        <strong>To fix this:</strong> Open Plex in a web browser, mobile app, or TV app, then click refresh.
                        <br />
                        <button 
                          onClick={() => window.open(`${config.apiBaseUrl}/api/plex/debug`, '_blank')}
                          style={{ 
                            marginTop: '8px', 
                            padding: '4px 8px', 
                            fontSize: '12px',
                            backgroundColor: '#666',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          🔍 Debug Connection
                        </button>
                      </p>
                    </div>
                  )}
                  {selectedPlayer && (
                    <p className="collection-hint">
                      ✅ Selected player will be used for remote playback when you select "Play Next Episode" from the home page.
                    </p>
                  )}
                </div>

                <div className="config-field compact">
                  <label htmlFor="plex_user">👤 Plex User for Webhook Filtering:</label>
                  <div className="collection-controls">
                    <select 
                      id="plex_user"
                      name="plex_user"
                      value={selectedPlexUser}
                      onChange={(e) => setSelectedPlexUser(e.target.value)}
                      className="collection-select compact"
                    >
                      <option value="">Process webhooks from all users</option>
                      {availablePlexUsers.map((user) => (
                        <option key={user.id} value={user.name}>
                          {user.title || user.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={refreshPlexUsers}
                      disabled={plexUsersLoading}
                      className="refresh-button compact"
                      title="Refresh available Plex users"
                    >
                      {plexUsersLoading ? '🔄' : '🔄'}
                    </Button>
                  </div>
                  
                  {availablePlexUsers.length === 0 && !plexUsersLoading && (
                    <div className="collection-hint">
                      <p>⚠️ No Plex users found. This can happen if:</p>
                      <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                        <li>• Your Plex server URL or token is incorrect</li>
                        <li>• You don't have any shared users on your Plex server</li>
                        <li>• Network connectivity issues</li>
                      </ul>
                    </div>
                  )}
                  
                  {selectedPlexUser ? (
                    <p className="collection-hint">
                      ✅ Only webhooks from "{selectedPlexUser}" will be processed for automatic watched status updates.
                    </p>
                  ) : (
                    <p className="collection-hint">
                      ⚠️ Webhooks from all Plex users will be processed. Select a specific user to filter webhooks.
                    </p>
                  )}
                </div>

                <div className="config-field compact">
                  <label htmlFor="timezone">🌍 Timezone:</label>
                  <select 
                    id="timezone"
                    name="timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="collection-select compact"
                  >
                    <option value="UTC">UTC (Coordinated Universal Time)</option>
                    <optgroup label="Americas">
                      <option value="America/New_York">Eastern Time (New York)</option>
                      <option value="America/Chicago">Central Time (Chicago)</option>
                      <option value="America/Denver">Mountain Time (Denver)</option>
                      <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
                      <option value="America/Phoenix">Arizona (Phoenix)</option>
                      <option value="America/Toronto">Eastern Time (Toronto)</option>
                      <option value="America/Vancouver">Pacific Time (Vancouver)</option>
                    </optgroup>
                    <optgroup label="Europe">
                      <option value="Europe/London">GMT (London)</option>
                      <option value="Europe/Paris">Central European Time (Paris)</option>
                      <option value="Europe/Berlin">Central European Time (Berlin)</option>
                      <option value="Europe/Amsterdam">Central European Time (Amsterdam)</option>
                      <option value="Europe/Rome">Central European Time (Rome)</option>
                      <option value="Europe/Madrid">Central European Time (Madrid)</option>
                    </optgroup>
                    <optgroup label="Asia Pacific">
                      <option value="Asia/Tokyo">Japan Standard Time (Tokyo)</option>
                      <option value="Asia/Shanghai">China Standard Time (Shanghai)</option>
                      <option value="Asia/Kolkata">India Standard Time (Mumbai)</option>
                      <option value="Australia/Sydney">Australian Eastern Time (Sydney)</option>
                      <option value="Australia/Melbourne">Australian Eastern Time (Melbourne)</option>
                      <option value="Australia/Perth">Australian Western Time (Perth)</option>
                    </optgroup>
                  </select>
                  <p className="collection-hint">
                    📅 Used for "Today's Activity" and date filtering in statistics. Current selection: {timezone}
                  </p>
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
              </form>
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
                <div className="movie-setting-control compact">
                <label htmlFor="christmas_filter_enabled" className="checkbox-label">
                  🎄 Christmas Movie Filter
                </label>                <p className="setting-description">
                  Filter out movies with "Christmas" labels during non-December months. During December, all movies are included.
                  <br />
                  <small>Note: Uses actual Plex label field (not collections or genres). Requires a Plex sync to populate label data.</small>
                </p>
                <div className="checkbox-container">
                  <input 
                    type="checkbox" 
                    id="christmas_filter_enabled"
                    name="christmas_filter_enabled"
                    checked={christmasFilterEnabled}
                    onChange={(e) => setChristmasFilterEnabled(e.target.checked)}
                    className="setting-checkbox"
                  />
                  <label htmlFor="christmas_filter_enabled" className="checkbox-text">
                    {christmasFilterEnabled ? 'Enabled' : 'Disabled'}
                  </label>
                </div>
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
              </div>              {plexSyncStatus && (
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
                    {plexSyncStatus.lastSync && (
                      <div className="status-item compact last-sync-item">
                        <span className="status-label">Last Sync:</span>
                        <span className="status-value last-sync-time" title={new Date(plexSyncStatus.lastSync).toLocaleString()}>
                          {new Date(plexSyncStatus.lastSync).toLocaleDateString()} {new Date(plexSyncStatus.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    )}
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