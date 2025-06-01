import React from 'react';
import { useState, useEffect } from 'react'
import Button from '../../components/Button'
import './Settings.css'
import './Settings.css'

function Settings() {  const [message, setMessage] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [comicVineApiKey, setComicVineApiKey] = useState('');
  const [tvGeneralPercent, setTvGeneralPercent] = useState(50);  const [moviesGeneralPercent, setMoviesGeneralPercent] = useState(50);
  const [customOrderPercent, setCustomOrderPercent] = useState(0);
  const [loading, setLoading] = useState(true);  const [plexSyncLoading, setPlexSyncLoading] = useState(false);
  const [plexSyncStatus, setPlexSyncStatus] = useState(null);
  const [plexSyncMessage, setPlexSyncMessage] = useState('');
  const [tvdbClearLoading, setTvdbClearLoading] = useState(false);
  const [tvdbClearMessage, setTvdbClearMessage] = useState('');
  // Fetch settings when component mounts
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:3001/api/settings');
        const settings = await response.json();          if (settings) {          setCollectionName(settings.collectionName || '');
          setComicVineApiKey(settings.comicVineApiKey || '');
          setTvGeneralPercent(settings.tvGeneralPercent ?? 50);
          setMoviesGeneralPercent(settings.moviesGeneralPercent ?? 50);
          setCustomOrderPercent(settings.customOrderPercent ?? 0);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
        setMessage('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    const fetchPlexSyncStatus = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/plex/sync-status');
        const status = await response.json();
        setPlexSyncStatus(status);
      } catch (error) {
        console.error('Error fetching Plex sync status:', error);
      }
    };

    fetchSettings();
    fetchPlexSyncStatus();
  }, []); // Empty dependency array means this runs once on mount


  const handleCollectionNameChange = (e) => {
    setCollectionName(e.target.value);
  }
  const handleTvGeneralPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setTvGeneralPercent(value);
    // Auto-adjust other percentages proportionally to maintain 100%
    const remainingPercent = 100 - value;
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

  const handleMoviesGeneralPercentChange = (e) => {
    const value = parseInt(e.target.value);
    setMoviesGeneralPercent(value);
    // Auto-adjust other percentages proportionally to maintain 100%
    const remainingPercent = 100 - value;
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
      setMoviesGeneralPercent(Math.round(remainingPercent * moviesRatio));    }
  }
  
  const handleSubmit = async () => {
    // Validate that percentages add up to 100%
    const totalPercent = tvGeneralPercent + moviesGeneralPercent + customOrderPercent;
    if (totalPercent !== 100) {
      setMessage(`Error: Order type percentages must add up to exactly 100%. Current total: ${totalPercent}%`);
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },        body: JSON.stringify({ 
          collectionName, 
          comicVineApiKey,
          tvGeneralPercent, 
          moviesGeneralPercent,
          customOrderPercent
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Error calling Express route:', error);      setMessage('Error calling Express route');
    }
  };
  const handlePlexSync = async () => {
    setPlexSyncLoading(true);
    setPlexSyncMessage('Starting Plex library sync...');
    
    try {
      const response = await fetch('http://localhost:3001/api/plex/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setPlexSyncMessage(`Sync completed! Synced ${data.totalShows} TV shows and ${data.totalMovies} movies in ${data.duration}`);
        
        // Refresh sync status
        const statusResponse = await fetch('http://localhost:3001/api/plex/sync-status');
        const status = await statusResponse.json();
        setPlexSyncStatus(status);
      } else {
        setPlexSyncMessage(`Sync failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Error syncing Plex library:', error);
      setPlexSyncMessage('Sync failed: Network error');
    } finally {
      setPlexSyncLoading(false);
    }
  };

  const handleTvdbClearCache = async () => {
    setTvdbClearLoading(true);
    setTvdbClearMessage('Clearing TVDB cache...');
    
    try {
      const response = await fetch('http://localhost:3001/api/tvdb/clear-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        setTvdbClearMessage('TVDB cache cleared successfully!');
      } else {
        setTvdbClearMessage(`Failed to clear cache: ${data.error}`);
      }
    } catch (error) {
      console.error('Error clearing TVDB cache:', error);
      setTvdbClearMessage('Failed to clear cache: Network error');
    } finally {
      setTvdbClearLoading(false);
    }
  };

  if (loading) {
    return (
      <main>
        <h2>Settings Page</h2>
        <p>Loading settings...</p>
      </main>
    );
  }

  return (
    <main>
      <h2>Settings Page</h2>
        <div className="settings-section">
        <label htmlFor="collection_name">Collection Name:</label>
        <input 
          type="text" 
          id="collection_name"
          name="collection_name"
          value={collectionName}
          onChange={(e) => handleCollectionNameChange(e)}
        />
      </div>

      <div className="settings-section">
        <label htmlFor="comicvine_api_key">ComicVine API Key:</label>
        <input 
          type="text" 
          id="comicvine_api_key"
          name="comicvine_api_key"
          value={comicVineApiKey}
          onChange={(e) => setComicVineApiKey(e.target.value)}
          placeholder="Enter your ComicVine API key"
        />
        <p className="setting-description">
          Required for fetching comic cover images and details. Get your API key from <a href="https://comicvine.gamespot.com/api/" target="_blank" rel="noopener noreferrer">ComicVine API</a>.
        </p>
      </div>

      <div className="settings-section">
        <h3>Order Types</h3>
        <p>Configure the percentage chance for each order type when selecting content:</p>
        
        <div className="order-type-control">
          <label htmlFor="tv_general_percent">TV General: {tvGeneralPercent}%</label>
          <input 
            type="range" 
            id="tv_general_percent"
            name="tv_general_percent"
            min="0"
            max="100"
            value={tvGeneralPercent}
            onChange={handleTvGeneralPercentChange}
            className="percentage-slider"
          />
        </div>        <div className="order-type-control">
          <label htmlFor="movies_general_percent">Movies General: {moviesGeneralPercent}%</label>
          <input 
            type="range" 
            id="movies_general_percent"
            name="movies_general_percent"
            min="0"
            max="100"
            value={moviesGeneralPercent}
            onChange={handleMoviesGeneralPercentChange}
            className="percentage-slider"
          />
        </div>

        <div className="order-type-control">
          <label htmlFor="custom_order_percent">Custom Order: {customOrderPercent}%</label>
          <input 
            type="range" 
            id="custom_order_percent"
            name="custom_order_percent"
            min="0"
            max="100"
            value={customOrderPercent}
            onChange={handleCustomOrderPercentChange}
            className="percentage-slider"
          />
        </div>

        <div className="percentage-display">
          <p className={tvGeneralPercent + moviesGeneralPercent + customOrderPercent === 100 ? 'total-valid' : 'total-invalid'}>
            Total: {tvGeneralPercent + moviesGeneralPercent + customOrderPercent}%
            {tvGeneralPercent + moviesGeneralPercent + customOrderPercent === 100 ? ' ✓' : ' ⚠️'}
          </p>
          {tvGeneralPercent + moviesGeneralPercent + customOrderPercent !== 100 && (
            <p className="total-warning">Percentages must add up to exactly 100%</p>
          )}        </div>
      </div>

      <div className="settings-section">
        <h3>Plex Library Sync</h3>
        <p>Sync your Plex library to improve performance by caching TV shows and movies locally.</p>
        
        {plexSyncStatus && (
          <div className="sync-status">
            <p><strong>Current Status:</strong></p>
            <ul>
              <li>Library Sections: {plexSyncStatus.sections}</li>
              <li>TV Shows: {plexSyncStatus.shows}</li>
              <li>Seasons: {plexSyncStatus.seasons}</li>
              <li>Episodes: {plexSyncStatus.episodes}</li>
              <li>Movies: {plexSyncStatus.movies}</li>
              {plexSyncStatus.lastSync && (
                <li>Last Sync: {new Date(plexSyncStatus.lastSync).toLocaleString()}</li>
              )}
            </ul>
          </div>
        )}

        <Button
          onClick={handlePlexSync}
          disabled={plexSyncLoading}
        >
          {plexSyncLoading ? 'Syncing...' : 'Sync Plex Library'}
        </Button>        {plexSyncMessage && (
          <div className="sync-message">
            <p>{plexSyncMessage}</p>
          </div>
        )}
      </div>

      <div className="settings-section">
        <h3>TVDB Cache Management</h3>
        <p>Clear cached TVDB data to free up space or refresh TV show information.</p>
        
        <Button
          onClick={handleTvdbClearCache}
          disabled={tvdbClearLoading}
        >
          {tvdbClearLoading ? 'Clearing Cache...' : 'Clear TVDB Cache'}
        </Button>

        {tvdbClearMessage && (
          <div className="sync-message">
            <p>{tvdbClearMessage}</p>
          </div>
        )}
      </div>

      <Button
        onClick={() => handleSubmit()}
        disabled={tvGeneralPercent + moviesGeneralPercent + customOrderPercent !== 100}
      >
        Save Settings
      </Button>

      {message && (
        <div className="message">
          <p>{message}</p>
        </div>
      )}
    </main>
  );
}

export default Settings;