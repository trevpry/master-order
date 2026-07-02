const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');
const { Client } = require('node-ssdp');
const os = require('os');
const prisma = require('../prismaClient');

// Direct UPnP/SOAP control for Sonos devices
// No external services required - works in Docker/Unraid

// Get server's local network IP address
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (loopback) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback
}

// Cache for discovered devices
let deviceCache = [];
let lastDiscoveryTime = 0;
const CACHE_DURATION = 60000; // 1 minute

// Discover SONOS devices via SSDP (UPnP)
async function discoverSonosDevices() {
  const now = Date.now();
  if (deviceCache.length > 0 && now - lastDiscoveryTime < CACHE_DURATION) {
    console.log('🔊 Returning cached SONOS devices');
    return deviceCache;
  }

  return new Promise((resolve) => {
    const client = new Client();
    const devices = [];
    const foundDevices = new Set();

    client.on('response', (headers, statusCode, rinfo) => {
      if (headers.ST === 'urn:schemas-upnp-org:device:ZonePlayer:1') {
        const location = headers.LOCATION;
        if (!foundDevices.has(location)) {
          foundDevices.add(location);
          
          // Parse device info from location
          fetch(location)
            .then(res => res.text())
            .then(xml => {
              const roomName = xml.match(/<roomName>([^<]+)<\/roomName>/)?.[1];
              const uuid = xml.match(/<UDN>uuid:([^<]+)<\/UDN>/)?.[1];
              const modelName = xml.match(/<modelName>([^<]+)<\/modelName>/)?.[1];
              
              // Extract AVTransport control URL from device description
              const avtMatch = xml.match(/<serviceType>urn:schemas-upnp-org:service:AVTransport:1<\/serviceType>[\s\S]*?<controlURL>([^<]+)<\/controlURL>/);
              const avTransportControl = avtMatch?.[1];
              const renderingMatch = xml.match(/<serviceType>urn:schemas-upnp-org:service:RenderingControl:1<\/serviceType>[\s\S]*?<controlURL>([^<]+)<\/controlURL>/);
              const renderingControl = renderingMatch?.[1];
              
              if (roomName && uuid && avTransportControl) {
                // Extract base URL (protocol + host + port only, no path)
                const url = new URL(location);
                const baseUrl = `${url.protocol}//${url.host}`;
                
                devices.push({
                  uuid,
                  name: roomName,
                  room: roomName,
                  model: modelName,
                  host: rinfo.address,
                  baseUrl,
                  location,
                  avTransportControl: baseUrl + avTransportControl,
                  renderingControl: renderingControl ? baseUrl + renderingControl : null
                });
                console.log('🔊 Found SONOS device:', roomName, 'Control URL:', baseUrl + avTransportControl);
              }
            })
            .catch(err => console.error('Error parsing device:', err));
        }
      }
    });

    // Search for Sonos devices
    client.search('urn:schemas-upnp-org:device:ZonePlayer:1');

    // Wait for responses
    setTimeout(() => {
      client.stop();
      deviceCache = devices;
      lastDiscoveryTime = Date.now();
      console.log('🔊 Discovered', devices.length, 'SONOS devices');
      resolve(devices);
    }, 3000);
  });
}

// Send SOAP request to Sonos device
async function sendSoapRequest(controlUrl, service, action, args = {}) {
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:${action} xmlns:u="urn:schemas-upnp-org:service:${service}:1">
      ${Object.entries(args).map(([key, value]) => `<${key}>${value}</${key}>`).join('\n      ')}
    </u:${action}>
  </s:Body>
</s:Envelope>`;

  console.log('🔊 Sending SOAP request to:', controlUrl);

  const response = await fetch(controlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset="utf-8"',
      'SOAPAction': `"urn:schemas-upnp-org:service:${service}:1#${action}"`
    },
    body: envelope
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`SOAP request failed: ${response.status} - ${errorText}`);
  }

  return await response.text();
}

// Helper function to find device by ID
function findDevice(deviceId) {
  return deviceCache.find(d => 
    d.uuid === deviceId || 
    d.uuid.includes(deviceId) || 
    d.name === deviceId ||
    d.host === deviceId
  );
}

// Discover SONOS devices
router.get('/devices', async (req, res) => {
  try {
    // Allow force refresh via query param
    if (req.query.refresh === 'true') {
      deviceCache = [];
      lastDiscoveryTime = 0;
      console.log('🔊 Force refreshing SONOS devices...');
    }
    
    const devices = await discoverSonosDevices();
    res.json({ devices });
  } catch (error) {
    console.error('Error discovering SONOS devices:', error);
    res.status(500).json({ 
      error: 'Failed to discover SONOS devices',
      message: error.message
    });
  }
});

// Play track on SONOS
router.post('/play', async (req, res) => {
  try {
    const { deviceId, trackRatingKey, streamUrl: providedStreamUrl, metadata } = req.body;
    
    if (!deviceId || (!trackRatingKey && !providedStreamUrl)) {
      return res.status(400).json({ error: 'deviceId and trackRatingKey (or streamUrl) required' });
    }
    
    // Find device
    const device = findDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found. Try refreshing device list.' });
    }
    
    if (!device.avTransportControl) {
      return res.status(400).json({ error: 'Device missing control URL. Try refreshing device list.' });
    }
    
    // Get Plex settings and construct stream URL
    let streamUrl = providedStreamUrl;
    if (trackRatingKey) {
      const settings = await prisma.settings.findFirst();
      
      if (!settings || !settings.plexUrl || !settings.plexToken) {
        return res.status(500).json({ error: 'Plex configuration not found' });
      }
      
      // Get track details from Plex
      const trackUrl = `${settings.plexUrl}/library/metadata/${trackRatingKey}`;
      const trackResponse = await fetch(trackUrl, {
        headers: {
          'X-Plex-Token': settings.plexToken,
          'Accept': 'application/json'
        }
      });
      
      if (!trackResponse.ok) {
        return res.status(404).json({ error: 'Track not found in Plex' });
      }
      
      const trackData = await trackResponse.json();
      const track = trackData.MediaContainer?.Metadata?.[0];
      
      if (!track) {
        return res.status(404).json({ error: 'Track metadata not found' });
      }
      
      // Get the media part for streaming
      const mediaPart = track.Media?.[0]?.Part?.[0];
      if (!mediaPart) {
        return res.status(404).json({ error: 'No media part found for track' });
      }
      
      // Construct Plex stream URL with token
      streamUrl = `${settings.plexUrl}${mediaPart.key}?X-Plex-Token=${settings.plexToken}`;
      console.log('🔊 Using Plex stream URL:', streamUrl);
    }
    
    console.log('🔊 Playing on SONOS:', { device: device.name, streamUrl });
    
    // Build DIDL-Lite metadata
    const title = metadata?.title || 'Unknown Track';
    const artist = metadata?.artist || 'Unknown Artist';
    const album = metadata?.album || 'Unknown Album';
    const artworkUrl = metadata?.artworkUrl || '';
    
    // Escape XML special characters
    const escapeXml = (str) => {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };
    
    const didlLite = `&lt;DIDL-Lite xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot; xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot; xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;&gt;&lt;item id=&quot;1&quot; parentID=&quot;0&quot; restricted=&quot;1&quot;&gt;&lt;dc:title&gt;${escapeXml(title)}&lt;/dc:title&gt;&lt;dc:creator&gt;${escapeXml(artist)}&lt;/dc:creator&gt;&lt;upnp:album&gt;${escapeXml(album)}&lt;/upnp:album&gt;&lt;upnp:albumArtURI&gt;${escapeXml(artworkUrl)}&lt;/upnp:albumArtURI&gt;&lt;upnp:class&gt;object.item.audioItem.musicTrack&lt;/upnp:class&gt;&lt;res protocolInfo=&quot;http-get:*:audio/mpeg:*&quot;&gt;${escapeXml(streamUrl)}&lt;/res&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;`;
    
    // Set AVTransport URI
    await sendSoapRequest(device.avTransportControl, 'AVTransport', 'SetAVTransportURI', {
      InstanceID: 0,
      CurrentURI: streamUrl,
      CurrentURIMetaData: didlLite
    });
    
    console.log('✅ AVTransport URI set');
    
    // Start playback
    await sendSoapRequest(device.avTransportControl, 'AVTransport', 'Play', {
      InstanceID: 0,
      Speed: 1
    });
    
    console.log('✅ Playback started on', device.name);
    
    res.json({ 
      success: true, 
      message: 'Playing on SONOS',
      device: device.name,
      track: { title, artist, album }
    });
    
  } catch (error) {
    console.error('Error playing on SONOS:', error);
    res.status(500).json({ 
      error: 'Failed to play on SONOS',
      message: error.message 
    });
  }
});

// Control playback (play, pause, stop, next, previous)
router.post('/control', async (req, res) => {
  try {
    const { deviceId, action } = req.body;
    
    if (!deviceId || !action) {
      return res.status(400).json({ error: 'deviceId and action required' });
    }
    
    // Find device
    const device = findDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    if (!device.avTransportControl) {
      return res.status(400).json({ error: 'Device missing control URL. Try refreshing device list.' });
    }
    
    console.log('🔊 SONOS control:', { device: device.name, action });
    
    // Map actions to SOAP methods
    const actionMap = {
      'play': 'Play',
      'pause': 'Pause',
      'stop': 'Stop',
      'next': 'Next',
      'previous': 'Previous'
    };
    
    const soapAction = actionMap[action.toLowerCase()];
    if (!soapAction) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const args = { InstanceID: 0 };
    if (soapAction === 'Play') {
      args.Speed = 1;
    }
    
    await sendSoapRequest(device.avTransportControl, 'AVTransport', soapAction, args);
    
    console.log('✅ SONOS control executed:', action);
    
    res.json({ 
      success: true, 
      action,
      device: device.name
    });
    
  } catch (error) {
    console.error('Error controlling SONOS:', error);
    res.status(500).json({ 
      error: 'Failed to control SONOS',
      message: error.message 
    });
  }
});

// Set volume on SONOS
router.post('/volume', async (req, res) => {
  try {
    const { deviceId, volume } = req.body;
    
    if (!deviceId || volume === undefined) {
      return res.status(400).json({ error: 'deviceId and volume required' });
    }
    
    // Validate volume range (0-100)
    const volumeValue = Math.max(0, Math.min(100, parseInt(volume)));
    
    // Find device
    const device = findDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    if (!device.baseUrl) {
      return res.status(400).json({ error: 'Device missing base URL' });
    }
    
    // Prefer the discovered RenderingControl URL for this device.
    // Fallback keeps compatibility with older cached entries.
    const renderingControlUrl = device.renderingControl || `${device.baseUrl}/MediaRenderer/RenderingControl/Control`;
    
    console.log('🔊 Setting SONOS volume:', { device: device.name, volume: volumeValue });
    
    // Send SetVolume command
    const envelope = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/">
  <s:Body>
    <u:SetVolume xmlns:u="urn:schemas-upnp-org:service:RenderingControl:1">
      <InstanceID>0</InstanceID>
      <Channel>Master</Channel>
      <DesiredVolume>${volumeValue}</DesiredVolume>
    </u:SetVolume>
  </s:Body>
</s:Envelope>`;

    const response = await fetch(renderingControlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset="utf-8"',
        'SOAPAction': '"urn:schemas-upnp-org:service:RenderingControl:1#SetVolume"'
      },
      body: envelope
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SOAP request failed: ${response.status} - ${errorText}`);
    }
    
    console.log('✅ SONOS volume set to:', volumeValue);
    
    res.json({ 
      success: true, 
      volume: volumeValue,
      device: device.name
    });
    
  } catch (error) {
    console.error('Error setting SONOS volume:', error);
    res.status(500).json({ 
      error: 'Failed to set SONOS volume',
      message: error.message 
    });
  }
});

// Get current state
router.get('/state/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    // Find device
    const device = findDevice(deviceId);
    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }
    
    // Get transport info
    const transportInfo = await sendSoapRequest(device.avTransportControl, 'AVTransport', 'GetTransportInfo', {
      InstanceID: 0
    });
    
    // Get position info
    const positionInfo = await sendSoapRequest(device.avTransportControl, 'AVTransport', 'GetPositionInfo', {
      InstanceID: 0
    });
    
    // Parse XML responses
    const currentState = transportInfo.match(/<CurrentTransportState>([^<]+)<\/CurrentTransportState>/)?.[1];
    const trackUri = positionInfo.match(/<TrackURI>([^<]+)<\/TrackURI>/)?.[1];
    const trackDuration = positionInfo.match(/<TrackDuration>([^<]+)<\/TrackDuration>/)?.[1];
    const relTime = positionInfo.match(/<RelTime>([^<]+)<\/RelTime>/)?.[1];
    
    res.json({
      device: device.name,
      state: currentState,
      trackUri,
      duration: trackDuration,
      position: relTime
    });
    
  } catch (error) {
    console.error('Error getting SONOS state:', error);
    res.status(500).json({ 
      error: 'Failed to get SONOS state',
      message: error.message 
    });
  }
});

module.exports = router;
