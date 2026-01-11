import React, { useEffect, useState } from 'react';
import './CastButton.css';
import './SonosCastButton.css';
import config from '../../config';

const SonosCastButton = ({ currentTrack, isPlaying, onCastStateChange }) => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showDeviceList, setShowDeviceList] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // Discover SONOS devices
  const discoverDevices = async (forceRefresh = false) => {
    setIsScanning(true);
    try {
      const url = forceRefresh 
        ? `${config.apiBaseUrl}/api/sonos/devices?refresh=true`
        : `${config.apiBaseUrl}/api/sonos/devices`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setDevices(data.devices || []);
        console.log('🔊 Found SONOS devices:', data.devices);
      }
    } catch (error) {
      console.error('Failed to discover SONOS devices:', error);
    } finally {
      setIsScanning(false);
    }
  };

  // Initial device discovery
  useEffect(() => {
    // Force refresh on initial load to ensure we have latest device info with control URLs
    discoverDevices(true);
  }, []);
  
  // Restore previously selected device when devices are discovered
  useEffect(() => {
    if (devices.length === 0) return;
    
    const savedDeviceId = localStorage.getItem('sonos_selected_device_id');
    if (savedDeviceId && !selectedDevice) {
      const matchedDevice = devices.find(d => 
        d.uuid === savedDeviceId || 
        d.name === savedDeviceId ||
        d.host === savedDeviceId
      );
      
      if (matchedDevice) {
        setSelectedDevice(matchedDevice);
        setIsConnected(true);
        console.log('🔊 Restored previously selected device:', matchedDevice.name);
      }
    }
  }, [devices]);

  // Handle device selection
  const handleDeviceSelect = (device) => {
    setSelectedDevice(device);
    setShowDeviceList(false);
    setIsConnected(true);
    // Only store device ID, not the whole object (which may have stale URLs)
    localStorage.setItem('sonos_selected_device_id', device.uuid);
    
    if (onCastStateChange) {
      onCastStateChange(true, device.name, 'sonos', device);
    }
    
    console.log('🔊 Selected SONOS device:', device.name);
  };

  // Play track on SONOS
  const playOnSonos = async (track) => {
    if (!selectedDevice || !track) return;

    try {
      // Send track info to backend - backend will construct proper network-accessible URL
      const response = await fetch(`${config.apiBaseUrl}/api/sonos/play`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: selectedDevice.uuid || selectedDevice.host,
          trackRatingKey: track.ratingKey,
          metadata: {
            title: track.title || 'Unknown Track',
            artist: track.artist || 'Unknown Artist',
            album: track.album || 'Unknown Album',
            artworkUrl: track.parentThumb || track.thumb || track.art 
              ? `${window.location.origin}/api/artwork${track.parentThumb || track.thumb || track.art}`
              : null
          }
        }),
      });

      if (response.ok) {
        console.log('✅ Playing on SONOS:', track.title);
      } else {
        console.error('Failed to play on SONOS:', await response.text());
      }
    } catch (error) {
      console.error('Error playing on SONOS:', error);
    }
  };

  // Control playback
  const controlPlayback = async (action) => {
    if (!selectedDevice) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/sonos/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: selectedDevice.uuid || selectedDevice.host,
          action // 'play', 'pause', 'stop'
        }),
      });

      if (response.ok) {
        console.log(`✅ SONOS ${action} command sent`);
      }
    } catch (error) {
      console.error(`Error sending ${action} to SONOS:`, error);
    }
  };

  // Load track when selected or when track changes
  useEffect(() => {
    if (isConnected && currentTrack && selectedDevice) {
      playOnSonos(currentTrack);
    }
  }, [currentTrack?.ratingKey, isConnected]);

  // Control playback state
  useEffect(() => {
    if (isConnected && selectedDevice) {
      if (isPlaying) {
        controlPlayback('play');
      } else {
        controlPlayback('pause');
      }
    }
  }, [isPlaying, isConnected]);

  // Disconnect
  const handleDisconnect = () => {
    setIsConnected(false);
    setSelectedDevice(null);
    localStorage.removeItem('sonos_selected_device_id');
    
    if (onCastStateChange) {
      onCastStateChange(false, '', 'sonos', null);
    }
    
    console.log('🔊 Disconnected from SONOS');
  };

  const handleButtonClick = () => {
    if (isConnected) {
      handleDisconnect();
    } else {
      setShowDeviceList(!showDeviceList);
      if (!showDeviceList && devices.length === 0) {
        discoverDevices();
      }
    }
  };

  return (
    <div className="cast-button-container">
      <button
        className={`cast-button ${isConnected ? 'connected' : ''}`}
        onClick={handleButtonClick}
        title={isConnected ? `Connected to ${selectedDevice?.name}` : 'Cast to SONOS'}
      >
        {/* SONOS Speaker Icon */}
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          {isConnected ? (
            // Connected - speaker with waves
            <g>
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
              <path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
            </g>
          ) : (
            // Disconnected - speaker only
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          )}
        </svg>
        {isConnected && selectedDevice && (
          <span className="cast-device-name">{selectedDevice.name}</span>
        )}
      </button>

      {/* Device Selection Dropdown */}
      {showDeviceList && (
        <div className="sonos-device-list">
          <div className="device-list-header">
            <span>SONOS Devices</span>
            <button 
              className="refresh-button" 
              onClick={(e) => {
                e.stopPropagation();
                discoverDevices();
              }}
              disabled={isScanning}
            >
              {isScanning ? '⏳' : '🔄'}
            </button>
          </div>
          {devices.length === 0 ? (
            <div className="device-list-empty">
              {isScanning ? 'Scanning...' : 'No SONOS devices found'}
            </div>
          ) : (
            <div className="device-list-items">
              {devices.map((device, index) => (
                <button
                  key={device.uuid || device.host || index}
                  className="device-list-item"
                  onClick={() => handleDeviceSelect(device)}
                >
                  <span className="device-icon">🔊</span>
                  <div className="device-info">
                    <div className="device-name">{device.name}</div>
                    <div className="device-room">{device.room || 'Unknown Room'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SonosCastButton;
