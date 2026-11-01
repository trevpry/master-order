import React, { useState, useEffect } from 'react';
import Button from '../../../../shared/components/Button'
import config from '../../../../config';
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
  const [komgaApiKey, setKomgaApiKey] = useState('');
  const [komgaUrl, setKomgaUrl] = useState('');
  const [stashApiKey, setStashApiKey] = useState('');
  const [stashUrl, setStashUrl] = useState('');
  const [rawgApiKey, setRawgApiKey] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [backgroundImageStoragePath, setBackgroundImageStoragePath] = useState('');
  // Percentage states
  const [partiallyWatchedCollectionPercent, setPartiallyWatchedCollectionPercent] = useState(75);
  const [plexSyncInterval, setPlexSyncInterval] = useState(12);
  const [stashSyncInterval, setStashSyncInterval] = useState(24);
  const [listScrapeInterval, setListScrapeInterval] = useState(6);
  
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
  const [syncOperationsTab, setSyncOperationsTab] = useState('operations');
  const [plexSyncRunLogs, setPlexSyncRunLogs] = useState([]);
  const [plexSyncLogLoading, setPlexSyncLogLoading] = useState(false);
  const [plexSyncLogMessage, setPlexSyncLogMessage] = useState('');
  
  // Stash sync states
  const [stashSyncLoading, setStashSyncLoading] = useState(false);
  const [stashSyncMessage, setStashSyncMessage] = useState('');

  // List scrape states
  const [listScrapeLoading, setListScrapeLoading] = useState(false);
  const [listScrapeMessage, setListScrapeMessage] = useState('');
  const [listScrapeStatus, setListScrapeStatus] = useState(null);
  const [backgroundImportLoading, setBackgroundImportLoading] = useState(false);
  const [backgroundImportMessage, setBackgroundImportMessage] = useState('');
  
  // Collection states
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
  
  // Ignored collections (unified for movies and TV - Jellyfin collections hold both)
  const [ignoredCollections, setIgnoredCollections] = useState([]);

  // Jellyfin (movies + TV) states
  const [jellyfinUrl, setJellyfinUrl] = useState('');
  const [jellyfinApiKey, setJellyfinApiKey] = useState('');
  const [jellyfinUserId, setJellyfinUserId] = useState('');
  const [jellyfinUsers, setJellyfinUsers] = useState([]);
  const [jellyfinSyncInterval, setJellyfinSyncInterval] = useState(12);
  const [jellyfinTestLoading, setJellyfinTestLoading] = useState(false);
  const [jellyfinTestMessage, setJellyfinTestMessage] = useState('');
  const [jellyfinSyncStatus, setJellyfinSyncStatus] = useState(null);
  const [jellyfinBackgroundStatus, setJellyfinBackgroundStatus] = useState(null);
  const [jellyfinSyncLoading, setJellyfinSyncLoading] = useState(false);
  const [jellyfinSyncMessage, setJellyfinSyncMessage] = useState('');
  const [jellyfinSyncRunLogs, setJellyfinSyncRunLogs] = useState([]);

  // Utility functions
  const showMessage = (msg, isError = false) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000); // Clear message after 5 seconds
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
        const [settings, syncStatus, backgroundStatus, collections, players, plexUsers, syncLogs, jfSyncStatus, jfBackgroundStatus, jfSyncLogs, jfUsers] = await Promise.all([
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync-status`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync-status`),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/collections`).catch(() => []),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/players`).catch(error => {
            console.warn('Failed to load Jellyfin players:', error);
            return [];
          }),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/users`).catch(error => {
            console.warn('Failed to load Plex users:', error);
            return [];
          }),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync-log?limit=25`).catch(error => {
            console.warn('Failed to load Plex sync run logs:', error);
            return [];
          }),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/sync-status`).catch(() => null),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/background-sync-status`).catch(() => null),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/sync-log?limit=25`).catch(() => []),
          fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/users`).catch(() => [])
        ]);// Update settings
        if (settings) {
          setCollectionName(settings.collectionName || '');
          setComicVineApiKey(settings.comicVineApiKey || '');
          setPlexToken(settings.plexToken || '');
          setPlexUrl(settings.plexUrl || '');
          setTvdbApiKey(settings.tvdbApiKey || '');
          setTvdbBearerToken(settings.tvdbBearerToken || '');
          setKomgaApiKey(settings.komgaApiKey || '');
          setKomgaUrl(settings.komgaUrl || '');
          setStashApiKey(settings.stashApiKey || '');
          setStashUrl(settings.stashUrl || '');
          setRawgApiKey(settings.rawgApiKey || '');
          setGeminiApiKey(settings.geminiApiKey || '');
          setBackgroundImageStoragePath(settings.backgroundImageStoragePath || '');
          setSelectedPlayer(settings.selectedPlayer || '');
          setSelectedPlexUser(settings.selectedPlexUser || '');
          setPartiallyWatchedCollectionPercent(settings.partiallyWatchedCollectionPercent ?? 75);
          setPlexSyncInterval(settings.plexSyncInterval ?? 12);
          setStashSyncInterval(settings.stashSyncInterval ?? 24);
          setListScrapeInterval(settings.listScrapeInterval ?? 6);
          setIgnoredCollections(settings.ignoredCollections || []);
          setJellyfinUrl(settings.jellyfinUrl || '');
          setJellyfinApiKey(settings.jellyfinApiKey || '');
          setJellyfinUserId(settings.jellyfinUserId || '');
          setJellyfinSyncInterval(settings.jellyfinSyncInterval ?? 12);
          setChristmasFilterEnabled(settings.christmasFilterEnabled ?? false);
        }        // Update status and data
        setPlexSyncStatus(syncStatus);
        setBackgroundSyncStatus(backgroundStatus);
        setAvailableCollections(collections);
        setAvailablePlayers(players || []);
        setAvailablePlexUsers(plexUsers || []);
        setPlexSyncRunLogs(Array.isArray(syncLogs) ? syncLogs : []);
        setJellyfinSyncStatus(jfSyncStatus);
        setJellyfinBackgroundStatus(jfBackgroundStatus);
        setJellyfinSyncRunLogs(Array.isArray(jfSyncLogs) ? jfSyncLogs : []);
        setJellyfinUsers(Array.isArray(jfUsers) ? jfUsers : []);
        
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
      const collections = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/collections`);
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
      const players = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/players`);
      setAvailablePlayers(players || []);
      
      // Check if selected player is currently online
      if (selectedPlayer) {
        checkDeviceStatus(selectedPlayer, players || []);
      }
      
      showMessage('Jellyfin players refreshed successfully');
    } catch (error) {
      showMessage('Failed to refresh Jellyfin players', true);
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
      const players = currentPlayers || await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/players`);
      const device = players.find(p => p.machineIdentifier === playerId || p.value === playerId);
      
      const isMobile = false;
      const isRegistered = false;
      const isOnline = !!device; // Jellyfin only lists sessions that are currently connected
      
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

  const handleStashSyncIntervalChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 168) { // 1 hour to 7 days (168 hours)
      setStashSyncInterval(value);
    }
  };

  const handleListScrapeIntervalChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 168) {
      setListScrapeInterval(value);
    }
  };
  const handleSubmit = async () => {
    try {
      setSaving(true);
      
      // Track if Plex settings changed to refresh players
      const currentSettings = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`);
      const jellyfinSettingsChanged = currentSettings && (
        currentSettings.jellyfinUrl !== jellyfinUrl || 
        currentSettings.jellyfinApiKey !== jellyfinApiKey ||
        currentSettings.jellyfinUserId !== jellyfinUserId
      );
      
      await fetchWithErrorHandling(`${config.apiBaseUrl}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },        body: JSON.stringify({ 
          collectionName, 
          comicVineApiKey,
          komgaApiKey,
          komgaUrl,
          stashApiKey,
          stashUrl,
          rawgApiKey,
          geminiApiKey,
          backgroundImageStoragePath,
          plexToken,
          plexUrl,
          tvdbApiKey,
          tvdbBearerToken,
          selectedPlayer,
          selectedPlexUser,
          partiallyWatchedCollectionPercent,
          plexSyncInterval,
          stashSyncInterval,
          listScrapeInterval,
          ignoredCollections,
          jellyfinUrl,
          jellyfinApiKey,
          jellyfinUserId,
          jellyfinSyncInterval,
          christmasFilterEnabled
        }),
      });

      showMessage('Settings saved successfully!');
      
      // Refresh background sync status after settings update
      const backgroundStatus = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/background-sync-status`);
      setBackgroundSyncStatus(backgroundStatus);
      
      // Refresh Jellyfin players/collections if Jellyfin settings changed
      if (jellyfinSettingsChanged) {
        try {
          await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/refresh-config`, { method: 'POST' });
          const [players, collections] = await Promise.all([
            fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/players`),
            fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/collections`)
          ]);
          setAvailablePlayers(players || []);
          setAvailableCollections(collections || []);
        } catch (playerError) {
          console.warn('Failed to refresh Jellyfin data after settings update:', playerError);
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
      await fetchPlexSyncRunLogs();
      
    } catch (error) {
      setPlexSyncMessage(`Sync failed: ${error.message}`);
    } finally {
      setPlexSyncLoading(false);
    }
  };

  const handleJellyfinTestConnection = async () => {
    setJellyfinTestLoading(true);
    setJellyfinTestMessage('Testing Jellyfin connection...');
    try {
      const result = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: jellyfinUrl, apiKey: jellyfinApiKey })
      });
      setJellyfinUsers(result.users || []);
      const libraries = (result.libraries || []).map(l => `${l.name} (${l.type})`).join(', ');
      setJellyfinTestMessage(`✅ ${result.message}. Libraries: ${libraries || 'none'}`);
    } catch (error) {
      setJellyfinTestMessage(`❌ Connection failed: ${error.message}`);
    } finally {
      setJellyfinTestLoading(false);
    }
  };

  const fetchJellyfinStatus = async () => {
    try {
      const [status, background, logs] = await Promise.all([
        fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/sync-status`),
        fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/background-sync-status`),
        fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/sync-log?limit=50`)
      ]);
      setJellyfinSyncStatus(status);
      setJellyfinBackgroundStatus(background);
      setJellyfinSyncRunLogs(Array.isArray(logs) ? logs : []);
    } catch (error) {
      setJellyfinSyncMessage(`Failed to refresh Jellyfin status: ${error.message}`);
    }
  };

  const handleJellyfinSync = async () => {
    setJellyfinSyncLoading(true);
    setJellyfinSyncMessage('Syncing all Jellyfin movie and TV libraries...');
    try {
      const data = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const r = data.results || {};
      setJellyfinSyncMessage(`Sync completed in ${Number(data.duration || 0).toFixed(1)}s: ${r.totalMovies ?? 0} movies, ${r.totalShows ?? 0} shows, ${r.totalEpisodes ?? 0} episodes, ${r.collections?.collections ?? 0} collections (${r.added ?? 0} added, ${r.updated ?? 0} updated, ${r.removed ?? 0} removed)`);
      await fetchJellyfinStatus();
      const collections = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/collections`);
      setAvailableCollections(collections || []);
    } catch (error) {
      setJellyfinSyncMessage(`Sync failed: ${error.message}`);
    } finally {
      setJellyfinSyncLoading(false);
    }
  };

  const handleJellyfinBackgroundAction = async (action) => {
    try {
      if (action === 'force-now') setJellyfinSyncMessage('Running forced Jellyfin sync...');
      const result = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/jellyfin/background-sync/${action}`, { method: 'POST' });
      setJellyfinSyncMessage(result.result?.message || result.message || 'Done');
      await fetchJellyfinStatus();
    } catch (error) {
      setJellyfinSyncMessage(`Jellyfin background sync ${action} failed: ${error.message}`);
    }
  };

  const handleStashSync = async () => {
    setStashSyncLoading(true);
    setStashSyncMessage('Starting Stash library sync...');
    
    try {
      const data = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/stash/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (data.success) {
        const results = data.results;
        setStashSyncMessage(`Sync completed! Synced ${results.scenes} scenes, ${results.performers} performers, ${results.studios} studios, and ${results.tags} tags`);
      } else {
        setStashSyncMessage(`Sync failed: ${data.message}`);
      }
      
    } catch (error) {
      setStashSyncMessage(`Sync failed: ${error.message}`);
    } finally {
      setStashSyncLoading(false);
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

  const fetchPlexSyncRunLogs = async () => {
    try {
      setPlexSyncLogLoading(true);
      setPlexSyncLogMessage('Refreshing Plex sync log...');
      const logs = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/plex/sync-log?limit=50`);
      setPlexSyncRunLogs(Array.isArray(logs) ? logs : []);
      setPlexSyncLogMessage('Plex sync log refreshed');
    } catch (error) {
      setPlexSyncLogMessage(`Failed to refresh Plex sync log: ${error.message}`);
    } finally {
      setPlexSyncLogLoading(false);
      setTimeout(() => setPlexSyncLogMessage(''), 3000);
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
      await fetchPlexSyncRunLogs();
    } catch (error) {
      setBackgroundSyncMessage(`Failed to force background sync: ${error.message}`);
    }
  };

  const handleRunListScrape = async () => {
    try {
      setListScrapeLoading(true);
      setListScrapeMessage('Triggering list scrape check...');
      const result = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/list-scraping/check-all`, {
        method: 'POST'
      });
      setListScrapeMessage(result?.message || 'List scrape check triggered');
      // Refresh status after a short delay to pick up results
      setTimeout(async () => {
        try {
          const status = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/list-scraping/status`);
          setListScrapeStatus(status);
        } catch {}
      }, 2000);
    } catch (error) {
      setListScrapeMessage(`Failed to trigger list scrape: ${error.message}`);
    } finally {
      setListScrapeLoading(false);
    }
  };

  const handleImportBackgroundsFromStorage = async () => {
    try {
      if (!backgroundImageStoragePath.trim()) {
        showMessage('Set a background image storage path before importing.', true);
        return;
      }

      setBackgroundImportLoading(true);
      setBackgroundImportMessage('Scanning storage path and importing images...');

      const result = await fetchWithErrorHandling(`${config.apiBaseUrl}/api/backgrounds/import-from-storage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const stats = result?.stats || {};
      setBackgroundImportMessage(
        `Import finished. Scanned: ${stats.scanned || 0}, Imported: ${stats.imported || 0}, Skipped: ${stats.skipped || 0}, Failed: ${stats.failed || 0}`
      );
    } catch (error) {
      setBackgroundImportMessage(`Import failed: ${error.message}`);
    } finally {
      setBackgroundImportLoading(false);
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
                  <label htmlFor="komga_url">Komga Server URL:</label>
                  <input 
                    type="url" 
                    id="komga_url"
                    name="komga_url"
                    value={komgaUrl}
                    onChange={(e) => setKomgaUrl(e.target.value)}
                    placeholder="http://localhost:25600"
                    className="url-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="komga_api_key">Komga API Key:</label>
                  <input 
                    type="text" 
                    id="komga_api_key"
                    name="komga_api_key"
                    value={komgaApiKey}
                    onChange={(e) => setKomgaApiKey(e.target.value)}
                    placeholder="Enter Komga API key"
                    className="api-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="stash_url">Stash Server URL:</label>
                  <input 
                    type="url" 
                    id="stash_url"
                    name="stash_url"
                    value={stashUrl}
                    onChange={(e) => setStashUrl(e.target.value)}
                    placeholder="http://localhost:9999"
                    className="url-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="stash_api_key">Stash API Key (optional):</label>
                  <input 
                    type="text" 
                    id="stash_api_key"
                    name="stash_api_key"
                    value={stashApiKey}
                    onChange={(e) => setStashApiKey(e.target.value)}
                    placeholder="Enter API key if authentication is enabled"
                    className="api-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="rawg_api_key">RAWG API Key:</label>
                  <input 
                    type="text" 
                    id="rawg_api_key"
                    name="rawg_api_key"
                    value={rawgApiKey}
                    onChange={(e) => setRawgApiKey(e.target.value)}
                    placeholder="Enter RAWG API key for video game data"
                    className="api-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="gemini_api_key">Gemini AI API Key:</label>
                  <input 
                    type="text" 
                    id="gemini_api_key"
                    name="gemini_api_key"
                    value={geminiApiKey}
                    onChange={(e) => setGeminiApiKey(e.target.value)}
                    placeholder="Enter Gemini API key for AI categorization"
                    className="api-input compact"
                  />
                  <small className="field-note">
                    Get your API key from: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer">https://aistudio.google.com/apikey</a>
                  </small>
                </div>

                <div className="config-field compact">
                  <label htmlFor="background_image_storage_path">🖼️ Background Image Storage Path:</label>
                  <input
                    type="text"
                    id="background_image_storage_path"
                    name="background_image_storage_path"
                    value={backgroundImageStoragePath}
                    onChange={(e) => setBackgroundImageStoragePath(e.target.value)}
                    placeholder="\\\\NAS\\media\\eddie-backgrounds"
                    className="api-input compact"
                  />
                  <p className="setting-description">
                    Uploaded and downloaded background images will be stored in this folder instead of the app directory.
                    Use a persistent local path or network share path.
                    In Docker/Unraid, UNC paths like \\tower\Media\Other\Images\background-images are translated to mounted container paths.
                  </p>
                  <div className="background-import-actions">
                    <Button
                      onClick={handleImportBackgroundsFromStorage}
                      disabled={backgroundImportLoading || !backgroundImageStoragePath.trim()}
                      className="sync-button force compact"
                    >
                      {backgroundImportLoading ? '🧭 Importing...' : '📥 Bulk Import Images From Path'}
                    </Button>
                  </div>
                  {backgroundImportMessage && (
                    <div className="sync-message compact">
                      <p>{backgroundImportMessage}</p>
                    </div>
                  )}
                </div>

                <div className="config-field compact">
                  <label htmlFor="jellyfin_url">🎞️ Jellyfin Server URL (Movies & TV):</label>
                  <input 
                    type="url" 
                    id="jellyfin_url"
                    name="jellyfin_url"
                    value={jellyfinUrl}
                    onChange={(e) => setJellyfinUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8096"
                    className="url-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="jellyfin_api_key">Jellyfin API Key:</label>
                  <input 
                    type="password" 
                    id="jellyfin_api_key"
                    name="jellyfin_api_key"
                    value={jellyfinApiKey}
                    onChange={(e) => setJellyfinApiKey(e.target.value)}
                    placeholder="Dashboard → API Keys"
                    className="token-input compact"
                  />
                </div>

                <div className="config-field compact">
                  <label htmlFor="jellyfin_user">👤 Jellyfin User (watch state & webhooks):</label>
                  <div className="collection-controls">
                    <select
                      id="jellyfin_user"
                      name="jellyfin_user"
                      value={jellyfinUserId}
                      onChange={(e) => setJellyfinUserId(e.target.value)}
                      className="collection-select compact"
                    >
                      <option value="">First administrator (default)</option>
                      {jellyfinUsers.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}{user.isAdministrator ? ' (admin)' : ''}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={handleJellyfinTestConnection}
                      disabled={jellyfinTestLoading || !jellyfinUrl || !jellyfinApiKey}
                      className="refresh-button compact"
                      title="Test the Jellyfin connection and load users"
                    >
                      {jellyfinTestLoading ? '⏳' : '🔌 Test'}
                    </Button>
                  </div>
                  {jellyfinTestMessage && (
                    <p className="collection-hint">{jellyfinTestMessage}</p>
                  )}
                  <p className="collection-hint">
                    All Jellyfin movie and TV libraries are synced. For automatic watched tracking, point the Jellyfin Webhook plugin (Generic destination, PlaybackStop + UserDataSaved) at <code>{`${config.apiBaseUrl}/api/webhook/jellyfin`}</code>.
                  </p>
                </div>

                <div className="config-field compact">
                  <label htmlFor="plex_url">Plex Server URL (Music):</label>
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
                  <label htmlFor="video_players">🎬 Jellyfin Player for Remote Playback:</label>
                  <div className="collection-controls">
                    <select 
                      id="video_players"
                      name="video_players"
                      value={selectedPlayer}
                      onChange={(e) => setSelectedPlayer(e.target.value)}
                      className="collection-select compact"
                    >
                      <option value="">Select a Jellyfin client/device...</option>
                      {selectedPlayer && !availablePlayers.some(p => p.value === selectedPlayer) && (
                        <option value={selectedPlayer}>{selectedPlayer} (not currently connected)</option>
                      )}
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
                      title="Refresh available Jellyfin clients"
                    >
                      🔄
                    </Button>
                  </div>
                  {selectedPlayer && (
                    <p className="collection-hint">
                      {deviceStatus.checking ? '🔄 Checking...' : deviceStatus.isOnline ? `🟢 ${deviceStatus.deviceName || selectedPlayer} is connected and accepts remote control` : '🔴 Device is not currently connected to Jellyfin. Open the Jellyfin app on it and refresh.'}
                    </p>
                  )}
                  {availablePlayers.length === 0 && !playersLoading && (
                    <p className="collection-hint">
                      ⚠️ No remote-controllable Jellyfin clients are connected. Open a Jellyfin app (Android TV, web, etc.) and click refresh.
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
                  <small>Note: Uses Jellyfin tags (not collections or genres). Requires a Jellyfin sync to populate tag data.</small>
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
                <label htmlFor="ignored_collections">🚫 Ignored Collections (movies & TV):</label>
                <p className="setting-description">
                  Movies and shows in these collections — including collections nested inside them — will not be selected for watching
                </p>
                <div className="collection-checkboxes">
                  {availableCollections.map(collection => (
                    <label key={`ignored-${collection.value}`} className="collection-checkbox">
                      <input
                        type="checkbox"
                        checked={ignoredCollections.includes(collection.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setIgnoredCollections([...ignoredCollections, collection.value]);
                          } else {
                            setIgnoredCollections(ignoredCollections.filter(c => c !== collection.value));
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
              <p>Manage Jellyfin (movies & TV), Plex (music) and background sync processes</p>
            </div>

            <div className="sync-tab-nav">
              <button
                type="button"
                onClick={() => setSyncOperationsTab('operations')}
                className={`sync-tab-button ${syncOperationsTab === 'operations' ? 'active' : ''}`}
              >
                ⚙️ Operations
              </button>
              <button
                type="button"
                onClick={() => setSyncOperationsTab('plex-log')}
                className={`sync-tab-button ${syncOperationsTab === 'plex-log' ? 'active' : ''}`}
              >
                📜 Plex Sync Log
              </button>
              <button
                type="button"
                onClick={() => setSyncOperationsTab('jellyfin-log')}
                className={`sync-tab-button ${syncOperationsTab === 'jellyfin-log' ? 'active' : ''}`}
              >
                📜 Jellyfin Sync Log
              </button>
            </div>

            {syncOperationsTab === 'operations' && (
            <>
            {/* Jellyfin (Movies & TV) */}
            <div className="sync-subsection">
              <h4 className="subsection-title">🎞️ Jellyfin Library (Movies & TV)</h4>
              <div className="sync-config-row">
                <div className="sync-interval-control compact">
                  <label htmlFor="jellyfin_sync_interval">Jellyfin Sync Interval: {jellyfinSyncInterval}h</label>
                  <input
                    type="range"
                    id="jellyfin_sync_interval"
                    name="jellyfin_sync_interval"
                    min="1"
                    max="168"
                    value={jellyfinSyncInterval}
                    onChange={(e) => setJellyfinSyncInterval(parseInt(e.target.value, 10))}
                    className="interval-slider"
                  />
                </div>
                <div className="background-sync-controls compact">
                  <Button
                    onClick={handleJellyfinSync}
                    disabled={jellyfinSyncLoading || jellyfinSyncStatus?.isSyncing}
                    className="sync-button primary compact"
                  >
                    {jellyfinSyncLoading || jellyfinSyncStatus?.isSyncing ? '🔄 Syncing...' : '🔄 Sync Jellyfin'}
                  </Button>
                  <Button
                    onClick={() => handleJellyfinBackgroundAction('start')}
                    disabled={jellyfinBackgroundStatus?.isRunning}
                    className="sync-button start compact"
                  >
                    ▶️ Start
                  </Button>
                  <Button
                    onClick={() => handleJellyfinBackgroundAction('stop')}
                    disabled={!jellyfinBackgroundStatus?.isRunning}
                    className="sync-button stop compact"
                  >
                    ⏹️ Stop
                  </Button>
                </div>
              </div>
              {jellyfinSyncStatus && (
                <div className="sync-status-card compact">
                  <div className="status-grid compact">
                    <div className="status-item compact">
                      <span className="status-label">Libraries:</span>
                      <span className="status-value">{jellyfinSyncStatus.sections || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Movies:</span>
                      <span className="status-value">{jellyfinSyncStatus.movies || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Shows:</span>
                      <span className="status-value">{jellyfinSyncStatus.shows || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Episodes:</span>
                      <span className="status-value">{jellyfinSyncStatus.episodes || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Collections:</span>
                      <span className="status-value">{jellyfinSyncStatus.collections || 0}</span>
                    </div>
                    <div className="status-item compact">
                      <span className="status-label">Background:</span>
                      <span className={`status-value ${jellyfinBackgroundStatus?.isRunning ? 'running' : 'stopped'}`}>
                        {jellyfinBackgroundStatus?.isRunning ? '✅ Running' : '❌ Stopped'}
                      </span>
                    </div>
                    {jellyfinSyncStatus.lastSync && (
                      <div className="status-item compact last-sync-item">
                        <span className="status-label">Last Sync:</span>
                        <span className="status-value last-sync-time" title={new Date(jellyfinSyncStatus.lastSync).toLocaleString()}>
                          {new Date(jellyfinSyncStatus.lastSync).toLocaleDateString()} {new Date(jellyfinSyncStatus.lastSync).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              {jellyfinSyncMessage && (
                <div className="sync-message compact">
                  <p>{jellyfinSyncMessage}</p>
                </div>
              )}
            </div>

            {/* Background Sync */}
            <div className="sync-subsection">
              <h4 className="subsection-title">🔄 Background Sync</h4>
              <div className="sync-config-row">
                <div className="sync-interval-control compact">
                  <label htmlFor="plex_sync_interval">Plex (Music) Sync Interval: {plexSyncInterval}h</label>
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

                <div className="sync-interval-control compact">
                  <label htmlFor="stash_sync_interval">Stash Sync Interval: {stashSyncInterval}h</label>
                  <input 
                    type="range" 
                    id="stash_sync_interval"
                    name="stash_sync_interval"
                    min="1"
                    max="168"
                    value={stashSyncInterval}
                    onChange={handleStashSyncIntervalChange}
                    className="interval-slider"
                  />
                </div>

                <div className="sync-interval-control compact">
                  <label htmlFor="list_scrape_interval">List Scrape Interval: {listScrapeInterval}h</label>
                  <input 
                    type="range" 
                    id="list_scrape_interval"
                    name="list_scrape_interval"
                    min="1"
                    max="168"
                    value={listScrapeInterval}
                    onChange={handleListScrapeIntervalChange}
                    className="interval-slider"
                  />
                  <Button
                    onClick={handleRunListScrape}
                    disabled={listScrapeLoading}
                    className="sync-button force compact"
                  >
                    {listScrapeLoading ? '⏳ Running...' : '⚡ Run Now'}
                  </Button>
                </div>
                {listScrapeMessage && (
                  <div className="sync-status-card compact" style={{ marginTop: '4px' }}>
                    <div className="status-row">
                      <span className="status-value">{listScrapeMessage}</span>
                    </div>
                    {listScrapeStatus?.lastSyncStatus && (
                      <div className="status-row">
                        <span className="status-label">Last run:</span>
                        <span className="status-value">
                          {listScrapeStatus.lastSyncStatus.configsChecked} list(s) checked
                          {listScrapeStatus.lastSyncStatus.results && (
                            <> · {listScrapeStatus.lastSyncStatus.results.reduce((sum, r) => sum + (r.added || 0), 0)} new item(s) added</>
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
                
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
                  {plexSyncLoading ? '🔄 Syncing...' : '🎵 Sync Plex Music'}
                </Button>
                
                <Button
                  onClick={handleStashSync}
                  disabled={stashSyncLoading || !stashUrl}
                  className="sync-button secondary compact"
                  title={!stashUrl ? 'Configure Stash URL first' : 'Sync Stash library'}
                >
                  {stashSyncLoading ? '🔄 Syncing...' : '🎬 Sync Stash'}
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

              {stashSyncMessage && (
                <div className="sync-message compact">
                  <p>{stashSyncMessage}</p>
                </div>
              )}
            </div>
            </>
            )}

            {syncOperationsTab === 'jellyfin-log' && (
              <div className="sync-subsection">
                <div className="library-sync-row">
                  <Button
                    onClick={fetchJellyfinStatus}
                    className="sync-button secondary compact"
                  >
                    🔄 Refresh Log
                  </Button>
                </div>
                <div className="sync-log-list">
                  {jellyfinSyncRunLogs.length === 0 ? (
                    <div className="sync-status-card compact">
                      <p>No Jellyfin sync log entries yet. Run a Jellyfin sync to create the first entry.</p>
                    </div>
                  ) : (
                    jellyfinSyncRunLogs.map((log) => (
                      <div key={log.id} className="sync-status-card compact sync-log-entry">
                        <div className="status-row">
                          <span className="status-label">Run:</span>
                          <span className="status-value">#{log.id}</span>
                          <span className="status-label">Trigger:</span>
                          <span className="status-value">{log.trigger}</span>
                          <span className="status-label">Status:</span>
                          <span className={`status-value ${log.success ? 'running' : 'stopped'}`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        <div className="status-row">
                          <span className="status-label">Completed:</span>
                          <span className="status-value">{new Date(log.completedAt).toLocaleString()}</span>
                          <span className="status-label">Duration:</span>
                          <span className="status-value">{Number(log.durationSeconds || 0).toFixed(2)}s</span>
                        </div>
                        {log.summary && (
                          <div className="status-row">
                            <span className="status-label">Summary:</span>
                            <span className="status-value">{log.summary}</span>
                          </div>
                        )}
                        {log.error && (
                          <div className="status-row">
                            <span className="status-label">Error:</span>
                            <span className="status-value">{log.error}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {syncOperationsTab === 'plex-log' && (
              <div className="sync-subsection">
                <div className="library-sync-row">
                  <Button
                    onClick={fetchPlexSyncRunLogs}
                    disabled={plexSyncLogLoading}
                    className="sync-button secondary compact"
                  >
                    {plexSyncLogLoading ? '🔄 Refreshing...' : '🔄 Refresh Log'}
                  </Button>
                </div>

                {plexSyncLogMessage && (
                  <div className="sync-message compact">
                    <p>{plexSyncLogMessage}</p>
                  </div>
                )}

                <div className="sync-log-list">
                  {plexSyncRunLogs.length === 0 ? (
                    <div className="sync-status-card compact">
                      <p>No Plex sync log entries yet. Run a Plex sync to create the first entry.</p>
                    </div>
                  ) : (
                    plexSyncRunLogs.map((log) => (
                      <div key={log.id} className="sync-status-card compact sync-log-entry">
                        <div className="status-row">
                          <span className="status-label">Run:</span>
                          <span className="status-value">#{log.id}</span>
                          <span className="status-label">Trigger:</span>
                          <span className="status-value">{log.trigger}</span>
                          <span className="status-label">Status:</span>
                          <span className={`status-value ${log.success ? 'running' : 'stopped'}`}>
                            {log.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        <div className="status-row">
                          <span className="status-label">Completed:</span>
                          <span className="status-value">{new Date(log.completedAt).toLocaleString()}</span>
                          <span className="status-label">Duration:</span>
                          <span className="status-value">{Number(log.durationSeconds || 0).toFixed(2)}s</span>
                        </div>
                        <div className="status-row">
                          <span className="status-label">Updated:</span>
                          <span className="status-value">
                            Sections {log.sections || 0}, Shows {log.totalShows || 0}, Movies {log.totalMovies || 0}, Artists {log.totalArtists || 0}
                          </span>
                        </div>
                        <div className="status-row">
                          <span className="status-label">Cleanup:</span>
                          <span className="status-value">
                            Episodes {log.cleanupEpisodes || 0}, Seasons {log.cleanupSeasons || 0}, Shows {log.cleanupShows || 0}, Movies {log.cleanupMovies || 0}, Artists {log.cleanupArtists || 0}, Albums {log.cleanupAlbums || 0}, Tracks {log.cleanupTracks || 0}, Playlists {log.cleanupPlaylists || 0}, Complex {log.cleanupComplexFields || 0}
                          </span>
                        </div>
                        {log.summary && (
                          <div className="status-row">
                            <span className="status-label">Summary:</span>
                            <span className="status-value">{log.summary}</span>
                          </div>
                        )}
                        {log.error && (
                          <div className="status-row">
                            <span className="status-label">Error:</span>
                            <span className="status-value">{log.error}</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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
                disabled={saving}
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