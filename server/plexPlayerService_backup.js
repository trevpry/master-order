const PlexAPI = require('plex-api');
const prisma = require('./prismaClient');

class PlexPlayerService {
  constructor() {
    this.client = null;
    this.lastSettingsCheck = null;
  }

  async initializeClient(forceRefresh = false) {
    try {
      // Get Plex settings from database
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });

      if (!settings || !settings.plexToken || !settings.plexUrl) {
        throw new Error('Plex settings not configured. Please set Plex URL and token in settings.');
      }

      // Check if we need to refresh the client due to settings changes
      const settingsHash = `${settings.plexUrl}:${settings.plexToken}`;
      if (forceRefresh || !this.client || this.lastSettingsCheck !== settingsHash) {
        console.log('Initializing Plex client with current settings...');
        
        // Parse the Plex URL to get hostname and port
        const url = new URL(settings.plexUrl);
        
        this.client = new PlexAPI({
          hostname: url.hostname,
          port: url.port || 32400,
          token: settings.plexToken,
          https: url.protocol === 'https:',
          timeout: 5000
        });

        this.lastSettingsCheck = settingsHash;
        console.log(`Plex client initialized for ${url.hostname}:${url.port || 32400}`);
      }

      return this.client;
    } catch (error) {
      console.error('Failed to initialize Plex client:', error);
      throw error;
    }
  }

  async initializePlexTvClient() {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });

      if (!settings || !settings.plexToken) {
        throw new Error('Plex token not configured. Please set Plex token in settings.');
      }

      // Create a client connected to plex.tv for device discovery
      const plexTvClient = new PlexAPI({
        hostname: 'plex.tv',
        token: settings.plexToken,
        https: true,
        timeout: 30000 // Increase timeout to 30 seconds
      });

      return plexTvClient;
    } catch (error) {
      console.error('Failed to initialize Plex.tv client:', error);
      throw error;
    }
  }

  async getPlayers() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      // Get all available players/clients
      console.log('Fetching Plex clients from /clients endpoint...');
      const response = await this.client.query('/clients');
      
      console.log('Raw Plex clients response:', JSON.stringify(response, null, 2));
      
      if (!response || !response.MediaContainer) {
        console.log('No MediaContainer in response');
        return [];
      }

      // Check if Server array exists and has content
      if (!response.MediaContainer.Server || response.MediaContainer.Server.length === 0) {
        console.log('No Server array or empty Server array in MediaContainer');
        console.log('MediaContainer keys:', Object.keys(response.MediaContainer));
        
        // Check for Device array as alternative
        let players = [];
        if (response.MediaContainer.Device) {
          console.log('Found Device array instead of Server array');
          const devices = Array.isArray(response.MediaContainer.Device) 
            ? response.MediaContainer.Device 
            : [response.MediaContainer.Device];
          
          players = devices.map(device => ({
            machineIdentifier: device.clientIdentifier || device.machineIdentifier,
            name: device.name || device.title,
            product: device.product,
            platform: device.platform,
            platformVersion: device.platformVersion,
            device: device.device,
            version: device.version,
            host: device.host,
            port: device.port,
            address: device.address,
            local: device.local === '1' || device.local === true,
            owned: device.owned === '1' || device.owned === true
          }));

          console.log(`Found ${players.length} Plex players via Device array:`, players);
        }
        
        // Always try alternative methods to find additional players
        console.log('Checking alternative methods for additional players...');
        const alternativePlayers = await this.getPlayersAlternative();
        
        // Combine both results, avoiding duplicates
        const allPlayers = [...players];
        
        alternativePlayers.forEach(altPlayer => {
          const isDuplicate = allPlayers.some(player => 
            player.machineIdentifier === altPlayer.machineIdentifier
          );
          if (!isDuplicate) {
            allPlayers.push(altPlayer);
          }
        });
        
        console.log(`Combined total: ${allPlayers.length} players (${players.length} from /clients, ${alternativePlayers.length} from alternatives)`);
        
        // If we still didn't find any players, add fallback options
        if (allPlayers.length === 0) {
          console.log('No players found via any method, adding fallback options...');
          const fallbackPlayers = this.getFallbackPlayers();
          allPlayers.push(...fallbackPlayers);
        }
        
        return allPlayers;
      }

      const servers = Array.isArray(response.MediaContainer.Server) 
        ? response.MediaContainer.Server 
        : [response.MediaContainer.Server];

      const players = servers.map(player => ({
        machineIdentifier: player.machineIdentifier,
        name: player.name,
        product: player.product,
        platform: player.platform,
        platformVersion: player.platformVersion,
        device: player.device,
        version: player.version,
        host: player.host,
        port: player.port,
        address: player.address,
        local: player.local === '1',
        owned: player.owned === '1'
      }));

      console.log(`Found ${players.length} Plex players via Server array:`, players);
      
      // Always try alternative methods to find additional players
      console.log('Checking alternative methods for additional players...');
      const alternativePlayers = await this.getPlayersAlternative();
      
      // Combine both results, avoiding duplicates
      const allPlayers = [...players];
      
      alternativePlayers.forEach(altPlayer => {
        const isDuplicate = allPlayers.some(player => 
          player.machineIdentifier === altPlayer.machineIdentifier
        );
        if (!isDuplicate) {
          allPlayers.push(altPlayer);
        }
      });
      
      console.log(`Combined total: ${allPlayers.length} players (${players.length} from /clients, ${alternativePlayers.length} from alternatives)`);
      
      // If we still didn't find any players, add fallback options
      if (allPlayers.length === 0) {
        console.log('No players found via any method, adding fallback options...');
        const fallbackPlayers = this.getFallbackPlayers();
        allPlayers.push(...fallbackPlayers);
      }
      
      return allPlayers;
    } catch (error) {
      console.error('Error fetching Plex players:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        response: error.response?.data
      });
      throw error;
    }
  }

  async getPlayerByIdentifier(machineIdentifier) {
    try {
      const players = await this.getPlayers();
      return players.find(player => player.machineIdentifier === machineIdentifier);
    } catch (error) {
      console.error('Error getting player by identifier:', error);
      throw error;
    }
  }

  async getPlayersAlternative() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      console.log('Trying alternative methods for additional players...');
      
      let alternativePlayers = [];
      
      // Method 1: Try getting active sessions which might show current players
      try {
        console.log('Checking /status/sessions for active players...');
        const sessionsResponse = await this.client.query('/status/sessions');
        console.log('Sessions response:', JSON.stringify(sessionsResponse, null, 2));
        
        if (sessionsResponse?.MediaContainer?.Metadata) {
          const sessions = Array.isArray(sessionsResponse.MediaContainer.Metadata) 
            ? sessionsResponse.MediaContainer.Metadata 
            : [sessionsResponse.MediaContainer.Metadata];
          
          console.log(`Found ${sessions.length} active sessions`);
          
          sessions.forEach(session => {
            if (session.Player) {
              const player = {
                machineIdentifier: session.Player.machineIdentifier,
                name: session.Player.title || session.Player.product || 'Unknown Player',
                product: session.Player.product || 'Unknown',
                platform: session.Player.platform || 'Unknown',
                platformVersion: session.Player.platformVersion || 'Unknown',
                device: session.Player.device || 'Unknown',
                version: session.Player.version || 'Unknown',
                host: session.Player.remotePublicAddress || session.Player.address || 'unknown',
                port: session.Player.port || '32400',
                address: session.Player.remotePublicAddress || session.Player.address || 'unknown',
                local: session.Player.local === '1' || session.Player.local === true,
                owned: true,
                isActive: true // Mark as currently active
              };
              
              alternativePlayers.push(player);
              console.log('Found active session player:', player.name);
            }
          });
        }
      } catch (sessionError) {
        console.log('Sessions method failed:', sessionError.message);
      }
      
      // Method 2: Check registered devices (especially for AndroidTV/set-top boxes)
      try {
        console.log('Checking /devices for registered devices...');
        const devicesResponse = await this.client.query('/devices');
        
        if (devicesResponse?.MediaContainer?.Device) {
          const devices = Array.isArray(devicesResponse.MediaContainer.Device) 
            ? devicesResponse.MediaContainer.Device 
            : [devicesResponse.MediaContainer.Device];
          
          console.log(`Found ${devices.length} registered devices`);
          
          // Filter for AndroidTV, TV apps, and other media players
          const mediaDevices = devices.filter(device => {
            const platform = (device.platform || '').toLowerCase();
            const name = (device.name || '').toLowerCase();
            const clientId = device.clientIdentifier || '';
            
            // Include AndroidTV, Chromecast, Shield, Fire TV, Apple TV, etc.
            return (
              platform.includes('android') ||
              platform.includes('chromecast') ||
              platform.includes('webos') ||
              platform.includes('tizen') ||
              platform.includes('tvos') ||
              name.includes('shield') ||
              name.includes('android tv') ||
              name.includes('fire tv') ||
              name.includes('apple tv') ||
              name.includes('chromecast') ||
              name.includes('roku') ||
              name.includes('aftkrt') || // Fire TV identifier
              clientId.includes('android') ||
              clientId.includes('chromecast')
            );
          });
          
          console.log(`Filtered to ${mediaDevices.length} media devices`);
          
          mediaDevices.forEach(device => {
            // Skip if we already have this device from active sessions
            const alreadyExists = alternativePlayers.some(p => p.machineIdentifier === device.clientIdentifier);
            if (!alreadyExists && device.clientIdentifier) {
              const player = {
                machineIdentifier: device.clientIdentifier,
                name: device.name || 'Unknown Device',
                product: 'Android TV/Media Player',
                platform: device.platform || 'Unknown',
                platformVersion: 'Unknown',
                device: device.platform || 'TV',
                version: 'Unknown',
                host: 'registered',
                port: '32400',
                address: 'registered',
                local: true,
                owned: true,
                isRegistered: true, // Mark as registered device
                registeredDate: device.createdAt
              };
              
              alternativePlayers.push(player);
              console.log('Found registered media device:', player.name, '(' + player.platform + ')');
            }
          });
        }
      } catch (devicesError) {
        console.log('Devices method failed:', devicesError.message);
      }
      
      console.log(`Alternative methods found ${alternativePlayers.length} additional players`);
      return alternativePlayers;
      
    } catch (error) {
      console.error('Error in getPlayersAlternative:', error);
      return [];
    }
  }

  getFallbackPlayers() {
    console.log('Generating fallback player options...');
    
    // Create some common fallback options based on the server URL
    const fallbackPlayers = [];
    
    try {
      // Get the actual server URL from settings
      let serverAddress = 'localhost';
      if (this.lastSettingsCheck) {
        const parts = this.lastSettingsCheck.split(':');
        if (parts.length >= 2) {
          // Extract hostname from URL format like "http://192.168.1.113:token"
          const urlPart = parts[0];
          if (urlPart.includes('//')) {
            serverAddress = urlPart.split('//')[1] || 'localhost';
          } else {
            serverAddress = urlPart;
          }
        }
      }
      
      console.log('Using server address for fallback players:', serverAddress);
      
      // Add a generic web player option
      fallbackPlayers.push({
        machineIdentifier: 'plex-web-fallback',
        name: 'Plex Web Player (Fallback)',
        product: 'Plex Web',
        platform: 'Web',
        platformVersion: 'Unknown',
        device: 'Browser',
        version: 'Unknown',
        host: serverAddress,
        port: '32400',
        address: serverAddress,
        local: true,
        owned: true,
        isFallback: true
      });

      // Add a direct server option for when users want to play on the server itself
      fallbackPlayers.push({
        machineIdentifier: 'plex-server-direct',
        name: 'Plex Server (Direct)',
        product: 'Plex Media Server',
        platform: 'Server',
        platformVersion: 'Unknown',
        device: 'Server',
        version: 'Unknown',
        host: serverAddress,
        port: '32400',
        address: serverAddress,
        local: true,
        owned: true,
        isFallback: true
      });

      console.log('Generated fallback players:', fallbackPlayers);
      return fallbackPlayers;
    } catch (error) {
      console.error('Error generating fallback players:', error);
      return [];
    }
  }

  async checkAndWakeUpDevice(machineIdentifier) {
    try {
      console.log('Checking device status and attempting wake-up if needed...');
      
      // First, try to check if the device appears in sessions or is responsive
      try {
        const sessionsResponse = await this.client.query('/status/sessions');
        const sessions = sessionsResponse?.MediaContainer?.Metadata || [];
        const deviceSession = sessions.find(session => 
          session.Player?.machineIdentifier === machineIdentifier
        );
        
        if (deviceSession) {
          console.log('Device found in active sessions and is responsive');
          return { success: true, message: 'Device is active and playing content' };
        }
      } catch (statusError) {
        console.log('Session status check failed:', statusError.message);
      }
      
      // For registered AndroidTV devices, try different wake-up approaches
      console.log('Device not in active sessions, attempting wake-up methods for registered device...');
      
      const wakeupMethods = [
        // Method 1: Try to send a timeline poll command (this sometimes wakes up devices)
        async () => {
          console.log('Attempting timeline wake-up...');
          const headers = {
            ...this.client.headers,
            'X-Plex-Target-Client-Identifier': machineIdentifier,
            'X-Plex-Client-Identifier': 'master-order-server'
          };
          
          // Temporarily set headers
          const originalHeaders = this.client.headers;
          this.client.headers = headers;
          
          try {
            const result = await this.client.query('/player/timeline/poll', 'GET', {
              wait: 0,
              commandID: Date.now()
            });
            return result;
          } finally {
            // Restore original headers
            this.client.headers = originalHeaders;
          }
        },
        
        // Method 2: Try to get player status which can wake some devices
        async () => {
          console.log('Attempting player status wake-up...');
          const headers = {
            ...this.client.headers,
            'X-Plex-Target-Client-Identifier': machineIdentifier,
            'X-Plex-Client-Identifier': 'master-order-server'
          };
          
          // Temporarily set headers
          const originalHeaders = this.client.headers;
          this.client.headers = headers;
          
          try {
            const result = await this.client.query('/player/timeline', 'GET');
            return result;
          } finally {
            // Restore original headers
            this.client.headers = originalHeaders;
          }
        },
        
        // Method 3: Try getting sessions to see if device responds  
        async () => {
          console.log('Attempting session check wake-up...');
          return await this.client.query('/status/sessions', 'GET');
        },
        
        // Method 4: Try the resources endpoint to check device availability
        async () => {
          console.log('Attempting resources check wake-up...');
          return await this.client.query('/myplex/resources', 'GET');
        }
      ];
      
      // Try each wake-up method
      for (let i = 0; i < wakeupMethods.length; i++) {
        try {
          const result = await wakeupMethods[i]();
          console.log(`Wake-up method ${i + 1} succeeded:`, result);
          
          // Wait a moment for the device to respond
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if device is now responsive by trying to get its timeline
          try {
            const timelineCheck = await this.client.query('/player/timeline', 'GET', {
              'X-Plex-Target-Client-Identifier': machineIdentifier
            });
            
            if (timelineCheck) {
              console.log('Device confirmed responsive after wake-up');
              return { success: true, message: `Device woken up using method ${i + 1} and confirmed responsive` };
            }
          } catch (timelineError) {
            console.log('Timeline check after wake-up failed:', timelineError.message);
          }
          
          return { success: true, message: `Wake-up method ${i + 1} completed (responsiveness unconfirmed)` };
          
        } catch (wakeupError) {
          console.log(`Wake-up method ${i + 1} failed:`, wakeupError.message);
        }
      }
      
      // All wake-up methods failed, but for registered devices this might be normal
      console.log('All wake-up methods failed, but this is normal for idle AndroidTV devices');
      return { 
        success: false, 
        message: 'Device is registered but currently idle. This is normal - the device should still respond to playback commands even when idle.' 
      };
      
    } catch (error) {
      console.error('Error in checkAndWakeUpDevice:', error);
      return { success: false, message: 'Wake-up check failed', error: error.message };
    }
  }

  async playMediaViaPlex(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log('Starting playback via Plex.tv discovery method...');
      
      // Initialize plex.tv client for device discovery
      const plexTvClient = await this.initializePlexTvClient();
      
      // Get resources (servers and clients) from plex.tv
      console.log('Discovering devices through plex.tv...');
      const resources = await plexTvClient.query('/resources');
      
      if (!resources?.MediaContainer?.Device) {
        throw new Error('No devices found via plex.tv');
      }
      
      const devices = Array.isArray(resources.MediaContainer.Device) 
        ? resources.MediaContainer.Device 
        : [resources.MediaContainer.Device];
      
      console.log(`Found ${devices.length} devices via plex.tv`);
      
      // Find the Plex Media Server
      const server = devices.find(d => 
        d.product === 'Plex Media Server' && 
        d.provides && d.provides.includes('server')
      );
      
      if (!server) {
        console.log('Available devices:', devices.map(d => ({ 
          name: d.name, 
          product: d.product, 
          provides: d.provides,
          clientIdentifier: d.clientIdentifier
        })));
        throw new Error('Could not find Plex Media Server via plex.tv');
      }
      
      console.log(`✅ Found Server: ${server.name} (${server.clientIdentifier})`);
      
      // Find the target player by machineIdentifier
      const player = devices.find(d => 
        d.clientIdentifier === machineIdentifier ||
        (d.provides && d.provides.includes('player'))
      );
      
      if (!player) {
        console.log('Available players:', devices
          .filter(d => d.provides && d.provides.includes('player'))
          .map(d => ({ 
            name: d.name, 
            product: d.product,
            clientIdentifier: d.clientIdentifier 
          })));
        throw new Error(`Could not find player with identifier ${machineIdentifier} via plex.tv`);
      }
      
      console.log(`✅ Found Player: ${player.name} (${player.product})`);
      
      // Connect directly to the server to get media details
      const serverConnection = player.Connection && player.Connection[0];
      if (!serverConnection) {
        throw new Error('No valid connection found for the server');
      }
      
      const serverClient = new PlexAPI({
        hostname: serverConnection.address,
        port: serverConnection.port,
        token: plexTvClient.token,
        https: serverConnection.protocol === 'https'
      });
      
      // Get media details
      console.log('Getting media details from server...');
      const mediaResponse = await serverClient.query(`/library/metadata/${ratingKey}`);
      if (!mediaResponse?.MediaContainer?.Metadata?.[0]) {
        throw new Error('Media not found on server');
      }
      
      const media = mediaResponse.MediaContainer.Metadata[0];
      console.log(`✅ Found Media: ${media.title} (${media.year || 'Unknown Year'})`);
      
      // Connect to the player client
      const playerConnection = player.Connection && player.Connection[0];
      if (!playerConnection) {
        throw new Error('No valid connection found for the player');
      }
      
      const playerClient = new PlexAPI({
        hostname: playerConnection.address,
        port: playerConnection.port,
        token: plexTvClient.token,
        https: playerConnection.protocol === 'https'
      });
      
      // Send the play command using the proper plex-api method
      console.log('Sending play command to player...');
      const playParams = {
        key: media.key,
        machineIdentifier: server.clientIdentifier,
        containerKey: `/library/metadata/${media.ratingKey}`,
        offset: offset * 1000 // Plex expects offset in milliseconds
      };
      
      console.log('Play parameters:', playParams);
      
      const response = await playerClient.query('/player/playback/playMedia', {
        method: 'POST',
        params: playParams
      });
      
      console.log(`▶️ Successfully sent play command for "${media.title}" to ${player.name}!`);
      
      return {
        success: true,
        player: player.name,
        media: media.title,
        ratingKey: ratingKey,
        offset: offset,
        method: 'plex-tv-discovery',
        response: response
      };
      
    } catch (error) {
      console.error('Plex.tv discovery playback failed:', error);
      throw error;
    }
  }

  async playMedia(machineIdentifier, ratingKey, offset = 0) {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      // First try to get the player
      let player = await this.getPlayerByIdentifier(machineIdentifier);
      
      // If player not found, it might be a mobile device that's offline
      if (!player) {
        console.log(`Player ${machineIdentifier} not currently active, checking if it's a known mobile device...`);
        
        // Check if this is a saved mobile device identifier
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        if (settings?.selectedPlayer === machineIdentifier) {
          console.log('This is the saved mobile device, attempting mobile playback approach...');
          
          // For mobile devices, we'll use a different approach
          // Try to send a push notification or use the Plex companion API
          return await this.playMediaOnMobileDevice(machineIdentifier, ratingKey, offset);
        } else {
          throw new Error(`Player with identifier ${machineIdentifier} not found and not a known mobile device. Please open Plex on your device first.`);
        }
      }

      console.log('Starting playback with player:', player);

      // Get media details to ensure we have the correct key format
      const mediaResponse = await this.client.query(`/library/metadata/${ratingKey}`);
      if (!mediaResponse?.MediaContainer?.Metadata?.[0]) {
        throw new Error('Media not found');
      }
      
      const media = mediaResponse.MediaContainer.Metadata[0];
      console.log('Media details:', {
        title: media.title,
        key: media.key,
        type: media.type,
        ratingKey: media.ratingKey
      });

      // For mobile devices and registered AndroidTV devices, try using the direct session control approach
      const isMobileDevice = player.platform === 'Android' || player.platform === 'iOS';
      const isRegisteredDevice = player.isRegistered || player.address === 'registered';
      const isAndroidTV = player.product && (player.product.includes('Android TV') || player.product.includes('SHIELD'));
      
      // For AndroidTV devices, try to wake them up first
      if (isAndroidTV && isRegisteredDevice) {
        console.log('AndroidTV device detected, attempting wake-up before playback...');
        const wakeupResult = await this.checkAndWakeUpDevice(machineIdentifier);
        console.log('Wake-up result:', wakeupResult);
      }
      
      if (isMobileDevice || isRegisteredDevice) {
        console.log(isRegisteredDevice ? 'Using registered device playback approach' : 'Using mobile device playback approach');
        
        try {
          // Method 0: For AndroidTV devices, try Plex.tv discovery method first
          if (isAndroidTV && isRegisteredDevice) {
            console.log('Trying Plex.tv discovery method for AndroidTV...');
            try {
              return await this.playMediaViaPlex(machineIdentifier, ratingKey, offset);
            } catch (plexTvError) {
              console.log('Plex.tv discovery method failed, trying other methods:', plexTvError.message);
              // Continue to other methods below
            }
          }
          
          // Method 1: For registered AndroidTV devices, use the server's casting functionality
          if (isRegisteredDevice) {
            console.log('Trying registered device casting approach...');
            
            // For registered devices, we need to use the server's casting/remote control features
            // This is similar to how the Plex web interface controls AndroidTV devices
            
            // Get the token from settings since plex-api client doesn't expose it
            const settings = await prisma.settings.findUnique({ where: { id: 1 } });
            const token = settings?.plexToken;
            
            if (!token) {
              throw new Error('Plex token not available for casting');
            }
            
            // Build casting parameters for server-mediated control
            const castingParams = {
              'plex://play': encodeURIComponent(`plex://play/${media.key}?server=${this.client.hostname}&X-Plex-Token=${token}`),
              offset: offset * 1000 // Plex expects offset in milliseconds
            };
            
            console.log('Casting params:', castingParams);
            
            // Set the required headers for server-mediated casting
            const originalHeaders = this.client.headers || {};
            this.client.headers = {
              ...originalHeaders,
              'X-Plex-Target-Client-Identifier': machineIdentifier,
              'X-Plex-Client-Identifier': 'master-order-remote',
              'X-Plex-Product': 'Master Order',
              'X-Plex-Version': '1.0.0',
              'X-Plex-Device-Name': 'Master Order Remote'
            };
            
            // Try using the server's casting endpoint
            try {
              // For registered AndroidTV devices, send a direct play command
              // First, try to create a play queue for the device
              const playQueueParams = {
                type: 'video',
                uri: `library:///media/${ratingKey}`,
                machineIdentifier: machineIdentifier,
                offset: offset * 1000
              };
              
              console.log('Attempting to create play queue for AndroidTV:', playQueueParams);
              const playQueueResponse = await this.client.query('/playQueues', 'POST', playQueueParams);
              console.log('Play queue created:', playQueueResponse);
              
              // Now send the play command with the queue
              if (playQueueResponse?.MediaContainer?.playQueueID) {
                const playParams = {
                  playQueueID: playQueueResponse.MediaContainer.playQueueID,
                  machineIdentifier: machineIdentifier,
                  offset: offset * 1000
                };
                
                const playResponse = await this.client.query('/player/playback/playMedia', 'POST', playParams);
                console.log('AndroidTV play command sent:', playResponse);
                
                // Restore headers
                this.client.headers = originalHeaders;
                
                return {
                  success: true,
                  player: player.name,
                  ratingKey: ratingKey,
                  offset: offset,
                  method: 'androidtv-playqueue',
                  response: { playQueue: playQueueResponse, play: playResponse }
                };
              } else {
                throw new Error('Failed to create play queue');
              }
            } catch (castError) {
                
                // Restore headers
                this.client.headers = originalHeaders;
                
                return {
                  success: true,
                  player: player.name,
                  ratingKey: ratingKey,
                  offset: offset,
                  method: 'url-scheme',
                  response: urlResponse
                };
              } catch (urlError) {
                console.log('URL scheme approach failed, trying minimal companion approach:', urlError.message);
                
                // Method 3: Try the most basic companion control with minimal parameters
                try {
                  const minimalParams = {
                    key: media.key,
                    offset: offset * 1000,
                    commandID: Date.now()
                  };
                  
                  const minimalResponse = await this.client.query('/player/playback/playMedia', 'POST', minimalParams);
                  console.log('Minimal companion approach success:', minimalResponse);
                  
                  // Restore headers
                  this.client.headers = originalHeaders;
                  
                  return {
                    success: true,
                    player: player.name,
                    ratingKey: ratingKey,
                    offset: offset,
                    method: 'minimal-companion',
                    response: minimalResponse
                  };
                } catch (minimalError) {
                  console.log('All primary methods failed, proceeding to fallbacks');
                  // Restore headers before throwing
                  this.client.headers = originalHeaders;
                  throw new Error(`Primary registered device methods failed: Casting: ${castError.message}, URL: ${urlError.message}, Minimal: ${minimalError.message}`);
                }
              }
            }
          } else {
            // For mobile devices, use the session-based approach
            const sessionUrl = `/player/timeline/playMedia`;
            const sessionParams = {
              key: media.key,
              offset: offset * 1000,
              machineIdentifier: machineIdentifier,
              commandID: Date.now()
            };
            
            console.log('Trying mobile session-based playMedia:', sessionUrl, sessionParams);
            
            // Add special headers for mobile companion control
            const originalHeaders = this.client.headers || {};
            this.client.headers = {
              ...originalHeaders,
              'X-Plex-Target-Client-Identifier': machineIdentifier,
              'X-Plex-Client-Identifier': 'master-order-remote',
              'X-Plex-Product': 'Master Order',
              'X-Plex-Version': '1.0.0'
            };
            
            const sessionResponse = await this.client.query(sessionUrl, 'GET', sessionParams);
            console.log('Mobile session playback success:', sessionResponse);
            
            // Restore headers
            this.client.headers = originalHeaders;
            
            return {
              success: true,
              player: player.name,
              ratingKey: ratingKey,
              offset: offset,
              method: 'mobile-session-timeline',
              response: sessionResponse
            };
          }
          
        } catch (sessionError) {
          // Only try direct connection methods for actual mobile devices, not registered AndroidTV devices
          if (isMobileDevice && !isRegisteredDevice) {
            console.log('Session method failed, trying companion approach...');
            
            // Method 2: Try the companion API with proper URL structure
            try {
              // Build a proper companion URL that mobile devices understand
              const companionUrl = `/player/playback/playMedia`;
              const companionData = new URLSearchParams({
                key: media.key,
                offset: (offset * 1000).toString(),
                machineIdentifier: machineIdentifier,
                address: player.address || '192.168.1.200',
                port: '32400',
                protocol: 'https',
                commandID: Date.now().toString()
              });
              
              console.log('Trying companion API with URL params:', companionUrl + '?' + companionData.toString());
              
              // Set companion headers
              const originalHeaders = this.client.headers || {};
              this.client.headers = {
                ...originalHeaders,
                'X-Plex-Target-Client-Identifier': machineIdentifier,
                'X-Plex-Client-Identifier': 'master-order-remote',
                'Content-Type': 'application/x-www-form-urlencoded'
              };
              
              // Send as POST with URL-encoded data
              const companionResponse = await this.client.query(companionUrl + '?' + companionData.toString(), 'POST');
              console.log('Companion API success:', companionResponse);
              
              // Restore headers
              this.client.headers = originalHeaders;
              
              return {
                success: true,
                player: player.name,
                ratingKey: ratingKey,
                offset: offset,
                method: 'companion-api',
                response: companionResponse
              };
              
            } catch (companionError) {
              console.log('Companion method failed, trying direct HTTP...');
              
              // Method 3: Try direct HTTP request to the player
              const axios = require('axios');
              
              try {
                const directUrl = `http://${player.address}:32400/player/playback/playMedia`;
                const directParams = {
                  key: media.key,
                  offset: offset * 1000,
                  commandID: Date.now()
                };
                
                console.log('Trying direct HTTP to player:', directUrl, directParams);
                
                const directResponse = await axios.post(directUrl, directParams, {
                  headers: {
                    'X-Plex-Token': process.env.PLEX_TOKEN || this.client.token,
                    'X-Plex-Client-Identifier': 'master-order-remote',
                    'X-Plex-Target-Client-Identifier': machineIdentifier
                  },
                  timeout: 5000
                });
                
                console.log('Direct HTTP success:', directResponse.data);
                
                return {
                  success: true,
                  player: player.name,
                  ratingKey: ratingKey,
                  offset: offset,
                  method: 'direct-http',
                  response: directResponse.data
                };
                
              } catch (directError) {
                console.log('All mobile methods failed:', {
                  session: sessionError.message,
                  companion: companionError.message,
                  direct: directError.message
                });
                
                // Fall through to standard method
                throw new Error(`Mobile playback failed. Session: ${sessionError.message}, Companion: ${companionError.message}, Direct: ${directError.message}`);
              }
            }
          } else {
            // For registered devices, try multiple AndroidTV-specific approaches
            console.log('Registered device session method failed:', sessionError.message);
            
            // Try AndroidTV-specific playback methods with correct Plex API approach
            try {
              console.log('Trying AndroidTV-specific fallback methods...');
              
              // Method 1: Try alternative companion parameters
              try {
                console.log('Attempting alternative companion API control...');
                
                // Get server details for fallback method
                const settings = await prisma.settings.findUnique({ where: { id: 1 } });
                const serverUrl = new URL(settings.plexUrl);
                
                // Get server machine identifier
                let serverMachineId;
                try {
                  const serverInfo = await this.client.query('/');
                  serverMachineId = serverInfo?.MediaContainer?.machineIdentifier;
                } catch (serverInfoError) {
                  console.log('Could not get server machine identifier for fallback, using hostname-based ID');
                  serverMachineId = serverUrl.hostname.replace(/\./g, '');
                }
                
                // Try with minimal required parameters as per Plex docs
                const fallbackParams = {
                  key: media.key,
                  offset: offset * 1000,
                  machineIdentifier: serverMachineId,
                  address: serverUrl.hostname,
                  port: serverUrl.port || '32400',
                  protocol: serverUrl.protocol === 'https:' ? 'https' : 'http',
                  token: settings.plexToken,
                  commandID: Date.now()
                };
                
                // Set proper headers for companion control
                const originalHeaders = this.client.headers || {};
                this.client.headers = {
                  ...originalHeaders,
                  'X-Plex-Target-Client-Identifier': machineIdentifier,
                  'X-Plex-Client-Identifier': 'master-order-remote',
                  'X-Plex-Product': 'Master Order',
                  'X-Plex-Version': '1.0.0',
                  'X-Plex-Device-Name': 'Master Order Remote'
                };
                
                const companionResponse = await this.client.query('/player/playback/playMedia', 'POST', fallbackParams);
                console.log('Alternative companion API control succeeded');
                
                // Restore headers
                this.client.headers = originalHeaders;
                
                return {
                  success: true,
                  player: player.name,
                  ratingKey: ratingKey,
                  offset: offset,
                  method: 'companion-api-fallback',
                  response: companionResponse
                };
                
              } catch (companionError) {
                console.log('Alternative companion API control failed:', companionError.message);
                
                // Method 2: Try direct timeline update approach
                try {
                  console.log('Attempting timeline update approach...');
                  
                  // Set proper headers for timeline control
                  const originalHeaders = this.client.headers || {};
                  this.client.headers = {
                    ...originalHeaders,
                    'X-Plex-Target-Client-Identifier': machineIdentifier,
                    'X-Plex-Client-Identifier': 'master-order-remote',
                    'X-Plex-Device-Name': 'Master Order Remote'
                  };
                  
                  // Send timeline update to start playback
                  const timelineParams = {
                    ratingKey: ratingKey,
                    key: media.key,
                    state: 'playing',
                    time: offset * 1000,
                    duration: media.duration || 0,
                    commandID: Date.now()
                  };
                  
                  const timelineResponse = await this.client.query('/:/timeline', 'GET', timelineParams);
                  console.log('Timeline update approach succeeded');
                  
                  // Restore headers
                  this.client.headers = originalHeaders;
                  
                  return {
                    success: true,
                    player: player.name,
                    ratingKey: ratingKey,
                    offset: offset,
                    method: 'timeline-update',
                    response: timelineResponse
                  };
                  
                } catch (timelineError) {
                  console.log('Timeline update approach failed:', timelineError.message);
                  
                  // Method 3: Try subscription-based approach
                  try {
                    console.log('Attempting subscription-based control...');
                    
                    // Set proper headers for subscription
                    const originalHeaders = this.client.headers || {};
                    this.client.headers = {
                      ...originalHeaders,
                      'X-Plex-Target-Client-Identifier': machineIdentifier,
                      'X-Plex-Client-Identifier': 'master-order-remote',
                      'X-Plex-Device-Name': 'Master Order Remote'
                    };
                    
                    // Try to subscribe and then send playback command
                    const subscribeParams = {
                      protocol: 'http',
                      port: '3001',
                      commandID: Date.now()
                    };
                    
                    // First subscribe to the player
                    await this.client.query('/player/timeline/subscribe', 'GET', subscribeParams);
                    
                    // Then send the playback command
                    const playParams = {
                      key: media.key,
                      offset: offset * 1000,
                      commandID: Date.now()
                    };
                    
                    const subscriptionResponse = await this.client.query('/player/playback/playMedia', 'POST', playParams);
                    console.log('Subscription-based approach succeeded');
                    
                    // Restore headers
                    this.client.headers = originalHeaders;
                    
                    return {
                      success: true,
                      player: player.name,
                      ratingKey: ratingKey,
                      offset: offset,
                      method: 'subscription-based',
                      response: subscriptionResponse
                    };
                    
                  } catch (subscriptionError) {
                    console.log('Subscription-based approach failed:', subscriptionError.message);
                    
                    // Final attempt: Use Plex.tv discovery method
                    console.log('Trying Plex.tv discovery method as final fallback...');
                    try {
                      return await this.playMediaViaPlex(machineIdentifier, ratingKey, offset);
                    } catch (plexTvError) {
                      console.log('Plex.tv discovery method also failed:', plexTvError.message);
                      
                      // All AndroidTV-specific methods failed
                      throw new Error(`All AndroidTV playback methods failed. Primary: ${sessionError.message}, Companion: ${companionError.message}, Timeline: ${timelineError.message}, Subscription: ${subscriptionError.message}, Plex.tv Discovery: ${plexTvError.message}. The AndroidTV device may need to be opened and connected to Plex first, or may need to be woken up remotely.`);
                    }
                  }
                }
              }
              
            } catch (registeredError) {
              console.log('All registered device methods failed:', registeredError.message);
              throw registeredError;
            }
          }
        }
        
      } else {
        // For non-mobile players, use standard method
        console.log('Using standard playback method for non-mobile player');
        
        const playbackParams = {
          key: media.key,
          offset: offset * 1000,
          machineIdentifier: machineIdentifier,
          address: player.address,
          port: player.port || '32400',
          protocol: player.local ? 'http' : 'https'
        };

        console.log('Standard playback params:', playbackParams);

        const response = await this.client.query(`/player/playback/playMedia`, 'POST', playbackParams);
        
        return {
          success: true,
          player: player.name,
          ratingKey: ratingKey,
          offset: offset,
          method: 'standard',
          response: response
        };
      }
    } catch (error) {
      console.error('Error starting playback:', error);
      console.error('Failed to start playback:', error);
      throw error;
    }
  }

  async controlPlayback(machineIdentifier, action) {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const validActions = ['play', 'pause', 'stop', 'stepForward', 'stepBackward', 'seekTo'];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}. Valid actions: ${validActions.join(', ')}`);
      }

      const player = await this.getPlayerByIdentifier(machineIdentifier);
      if (!player) {
        throw new Error(`Player with identifier ${machineIdentifier} not found`);
      }

      console.log(`Sending ${action} command to player: ${player.name}`);

      const response = await this.client.query(`/player/playback/${action}`, 'POST', {
        machineIdentifier: machineIdentifier
      });

      return {
        success: true,
        action: action,
        player: player.name
      };
    } catch (error) {
      console.error(`Error ${action} playback:`, error);
      throw error;
    }
  }

  async playMediaOnMobileDevice(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log('Attempting mobile device playback for:', machineIdentifier);
      
      // Get server information first
      const serverId = await this.getServerId();
      if (!serverId) {
        throw new Error('Could not determine Plex server ID');
      }

      // Get media details first
      const mediaResponse = await this.client.query(`/library/metadata/${ratingKey}`);
      if (!mediaResponse?.MediaContainer?.Metadata?.[0]) {
        throw new Error('Media not found');
      }
      
      const media = mediaResponse.MediaContainer.Metadata[0];
      console.log('Mobile playback for media:', media.title);

      // Method 1: Try to send a basic playback command to the saved device
      // This works by sending a direct play command with the saved machine identifier
      try {
        console.log('Trying direct playback command...');
        
        const playbackUrl = `/player/playback/playMedia`;
        const playbackParams = {
          key: media.key,
          offset: offset * 1000,
          machineIdentifier: machineIdentifier,
          'X-Plex-Target-Client-Identifier': machineIdentifier
        };

        console.log('Sending direct playback with params:', playbackParams);
        
        const directResponse = await this.client.query(playbackUrl, {
          method: 'POST',
          params: playbackParams
        });

        console.log('Direct playback response:', directResponse);
        
        return {
          success: true,
          message: 'Playback command sent to mobile device. Please check your device.',
          method: 'direct_playback',
          response: directResponse
        };
        
      } catch (directError) {
        console.log('Direct playback failed, trying notification method:', directError.message);
        
        // Method 2: Try using the resources endpoint to send notifications
        try {
          console.log('Trying notification via resources...');
          
          const notificationUrl = `/:/resources`;
          const notificationParams = {
            includeHttps: '1',
            includeRelay: '1',
            clientIdentifier: machineIdentifier
          };

          const resourceResponse = await this.client.query(notificationUrl, {
            method: 'GET',
            params: notificationParams
          });

          console.log('Resource response:', resourceResponse);
          
          // If we found the device in resources, try sending a command via its connection
          if (resourceResponse?.MediaContainer?.Device) {
            const devices = Array.isArray(resourceResponse.MediaContainer.Device) 
              ? resourceResponse.MediaContainer.Device 
              : [resourceResponse.MediaContainer.Device];
              
            const targetDevice = devices.find(d => d.clientIdentifier === machineIdentifier);
            
            if (targetDevice && targetDevice.Connection) {
              const connections = Array.isArray(targetDevice.Connection) 
                ? targetDevice.Connection 
                : [targetDevice.Connection];
                
              // Try each connection
              for (const connection of connections) {
                try {
                  console.log('Trying connection:', connection);
                  
                  // Build direct URL to device
                  const deviceUrl = `${connection.protocol}://${connection.address}:${connection.port}`;
                  const playUrl = `${deviceUrl}/player/playback/playMedia`;
                  
                  // Use axios directly for device connection
                  const axios = require('axios');
                  const deviceResponse = await axios.post(playUrl, null, {
                    params: {
                      key: media.key,
                      offset: offset * 1000,
                      machineIdentifier: serverId
                    },
                    headers: {
                      'X-Plex-Token': this.client.authToken,
                      'X-Plex-Client-Identifier': this.client.identifier
                    },
                    timeout: 5000
                  });
                  
                  console.log('Device connection successful:', deviceResponse.status);
                  
                  return {
                    success: true,
                    message: 'Successfully connected to mobile device for playback.',
                    method: 'device_direct_connection',
                    connection: connection
                  };
                  
                } catch (connError) {
                  console.log(`Connection ${connection.address}:${connection.port} failed:`, connError.message);
                  continue;
                }
              }
            }
          }
          
          // If we get here, the resource method didn't work either
          throw new Error('No valid device connections found');
          
        } catch (resourceError) {
          console.log('Resource method also failed:', resourceError.message);
          
          // Method 3: Try to send a push notification to wake up the device
          try {
            console.log('Attempting to send push notification to wake device...');
            
            // Use Plex's push notification system
            const pushUrl = `/myplex/account/devices/${machineIdentifier}/commands`;
            const pushResponse = await this.client.query(pushUrl, {
              method: 'POST',
              params: {
                command: 'navigation',
                path: `/library/metadata/${ratingKey}`,
                container: 'playqueue'
              }
            });
            
            console.log('Push notification sent:', pushResponse);
            
            return {
              success: true,
              message: `Push notification sent to "${machineIdentifier}". Check your device - it should open Plex and navigate to the content. You may need to manually start playback.`,
              method: 'push_notification',
              instruction: 'If your device opened Plex, you can now try the Play on Plex button again, or manually start the content.'
            };
            
          } catch (pushError) {
            console.log('Push notification also failed:', pushError.message);
            
            // Final fallback: Return helpful message with instructions
            return {
              success: false,
              message: `Cannot reach mobile device "${machineIdentifier}". This usually happens when the mobile device is not actively connected to Plex. Please:\n\n1. Open the Plex app on your mobile device\n2. Start playing any video briefly (then you can stop it)\n3. Try the playback command again\n\nMobile devices only appear in Plex when they're actively connected, unlike desktop players that stay visible.`,
              method: 'instruction_fallback',
              errors: {
                direct: directError.message,
                resource: resourceError.message,
                push: pushError.message
              }
            };
          }
        }
      }

    } catch (error) {
      console.error('Error in mobile device playback:', error);
      throw new Error(`Mobile playback failed: ${error.message}`);
    }
  }

  async getServerId() {
    try {
      const serverInfo = await this.client.query('/');
      return serverInfo?.MediaContainer?.machineIdentifier;
    } catch (error) {
      console.error('Error getting server ID:', error);
      return null;
    }
  }

  async waitForMobileDevice(machineIdentifier, timeoutMs = 30000) {
    console.log(`Waiting for mobile device ${machineIdentifier} to come online...`);
    
    const startTime = Date.now();
    const checkInterval = 2000; // Check every 2 seconds
    
    return new Promise((resolve) => {
      const checkDevice = async () => {
        try {
          const player = await this.getPlayerByIdentifier(machineIdentifier);
          if (player) {
            console.log(`Mobile device ${machineIdentifier} is now online!`);
            resolve(player);
            return;
          }
          
          // Check if timeout reached
          if (Date.now() - startTime > timeoutMs) {
            console.log(`Timeout waiting for mobile device ${machineIdentifier}`);
            resolve(null);
            return;
          }
          
          // Continue checking
          setTimeout(checkDevice, checkInterval);
          
        } catch (error) {
          console.error('Error checking for mobile device:', error);
          setTimeout(checkDevice, checkInterval);
        }
      };
      
      checkDevice();
    });
  }

  async playMediaWithMobileRetry(machineIdentifier, ratingKey, offset = 0) {
    try {
      // First try normal playback
      return await this.playMedia(machineIdentifier, ratingKey, offset);
    } catch (error) {
      // If it failed and this is a saved mobile device, try to wait for it
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      if (settings?.selectedPlayer === machineIdentifier) {
        console.log('Mobile device playback failed, waiting for device to come online...');
        
        const player = await this.waitForMobileDevice(machineIdentifier, 15000); // Wait 15 seconds
        if (player) {
          console.log('Mobile device is back online, retrying playback...');
          return await this.playMedia(machineIdentifier, ratingKey, offset);
        }
      }
      
      throw error;
    }
  }

  async testConnection() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      // Test connection by getting server info
      const response = await this.client.query('/');
      return {
        success: true,
        serverName: response?.MediaContainer?.friendlyName || 'Unknown',
        version: response?.MediaContainer?.version || 'Unknown'
      };
    } catch (error) {
      console.error('Plex connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Method to refresh the client when settings are updated
  async refreshClient() {
    console.log('Refreshing Plex client due to settings update...');
    this.client = null;
    this.lastSettingsCheck = null;
    return await this.initializeClient(true);
  }
}

module.exports = PlexPlayerService;