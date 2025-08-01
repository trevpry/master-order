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
        timeout: 30000
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

      console.log('Fetching Plex clients...');
      const response = await this.client.query('/clients');
      
      if (!response || !response.MediaContainer) {
        return [];
      }

      let players = [];
      
      if (response.MediaContainer.Server) {
        const servers = Array.isArray(response.MediaContainer.Server) 
          ? response.MediaContainer.Server 
          : [response.MediaContainer.Server];
          
        players = servers.map(server => ({
          name: server.name || server.title || 'Unknown Player',
          machineIdentifier: server.machineIdentifier,
          product: server.product || 'Unknown',
          productVersion: server.productVersion || 'Unknown',
          platform: server.platform || 'Unknown',
          platformVersion: server.platformVersion || 'Unknown',
          device: server.device || 'Unknown',
          model: server.model || 'Unknown',
          vendor: server.vendor || 'Unknown',
          provides: server.provides || 'Unknown',
          address: server.address || 'Unknown',
          port: server.port || 'Unknown',
          version: server.version || 'Unknown',
          protocol: server.protocol || 'Unknown',
          host: server.host || 'Unknown',
          localAddresses: server.localAddresses || 'Unknown',
          owned: server.owned || false
        }));
      }

      console.log(`Found ${players.length} players`);
      return players;
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  }

  async playMedia(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log(`Playing media ${ratingKey} on ${machineIdentifier} at offset ${offset}`);
      
      // First try the standard approach
      try {
        await this.initializeClient();
        
        const players = await this.getPlayers();
        const targetPlayer = players.find(p => p.machineIdentifier === machineIdentifier);
        
        if (!targetPlayer) {
          throw new Error(`Player ${machineIdentifier} not found`);
        }

        console.log('Target player details:', targetPlayer);

        // For AndroidTV devices, use the notification approach
        if (targetPlayer.product && (
          targetPlayer.product.toLowerCase().includes('android') ||
          targetPlayer.platform && targetPlayer.platform.toLowerCase().includes('android')
        )) {
          console.log('Detected AndroidTV device, using notification approach');
          return await this.playMediaOnAndroidTV(machineIdentifier, ratingKey, offset);
        }

        // Standard playback for other devices
        const playParams = {
          key: `/library/metadata/${ratingKey}`,
          offset: offset * 1000,
          machineIdentifier: machineIdentifier
        };

        const result = await this.client.query(`/player/playback/playMedia`, 'POST', playParams);
        
        return {
          success: true,
          message: 'Playback started successfully',
          details: result
        };
        
      } catch (standardError) {
        console.log('Standard playback failed, trying alternative approaches:', standardError.message);
        
        // Try AndroidTV specific approach as fallback
        return await this.playMediaOnAndroidTV(machineIdentifier, ratingKey, offset);
      }
      
    } catch (error) {
      console.error('All playback methods failed:', error);
      throw error;
    }
  }

  async playMediaOnAndroidTV(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log(`AndroidTV playback for ${machineIdentifier}, media ${ratingKey}`);
      
      await this.initializeClient();
      
      // Get media details
      const mediaResponse = await this.client.query(`/library/metadata/${ratingKey}`);
      if (!mediaResponse?.MediaContainer?.Metadata?.[0]) {
        throw new Error('Media not found');
      }
      
      const media = mediaResponse.MediaContainer.Metadata[0];
      console.log('Playing media:', media.title);
      
      // Try multiple AndroidTV notification methods
      const methods = [];
      
      // Method 1: Timeline notification
      try {
        console.log('Trying timeline notification...');
        const timelineParams = {
          ratingKey: ratingKey,
          key: media.key,
          state: 'playing',
          time: offset * 1000,
          duration: media.duration || 0,
          machineIdentifier: machineIdentifier
        };
        
        const timelineResult = await this.client.query('/:/timeline', 'POST', timelineParams);
        methods.push({ method: 'timeline', success: true, result: timelineResult });
        console.log('Timeline notification succeeded');
      } catch (error) {
        methods.push({ method: 'timeline', success: false, error: error.message });
        console.log('Timeline notification failed:', error.message);
      }
      
      // Method 2: Play queue creation
      try {
        console.log('Trying play queue creation...');
        const queueParams = {
          type: 'video',
          uri: `library:///directory/${media.key}`,
          machineIdentifier: machineIdentifier,
          offset: offset * 1000
        };
        
        const queueResult = await this.client.query('/playQueues', 'POST', queueParams);
        methods.push({ method: 'playQueue', success: true, result: queueResult });
        console.log('Play queue creation succeeded');
      } catch (error) {
        methods.push({ method: 'playQueue', success: false, error: error.message });
        console.log('Play queue creation failed:', error.message);
      }
      
      // Method 3: Direct notification
      try {
        console.log('Trying direct notification...');
        const notifyParams = {
          type: 'playing',
          machineIdentifier: machineIdentifier,
          key: media.key,
          offset: offset * 1000
        };
        
        const notifyResult = await this.client.query('/:/notify', 'POST', notifyParams);
        methods.push({ method: 'notify', success: true, result: notifyResult });
        console.log('Direct notification succeeded');
      } catch (error) {
        methods.push({ method: 'notify', success: false, error: error.message });
        console.log('Direct notification failed:', error.message);
      }
      
      // Check if any method succeeded
      const successful = methods.filter(m => m.success);
      if (successful.length > 0) {
        return {
          success: true,
          message: `AndroidTV playback initiated via ${successful.map(m => m.method).join(', ')}`,
          media: media.title,
          methods: methods
        };
      } else {
        throw new Error(`All AndroidTV playback methods failed: ${methods.map(m => m.error || 'unknown error').join('; ')}`);
      }
      
    } catch (error) {
      console.error('AndroidTV playback failed:', error);
      throw error;
    }
  }

  async playMediaViaPlex(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log(`Plex.tv discovery playback for ${machineIdentifier}, media ${ratingKey}`);
      
      // Initialize Plex.tv client for device discovery
      const plexTvClient = await this.initializePlexTvClient();
      
      // Discover devices through Plex.tv
      console.log('Discovering devices via Plex.tv...');
      const devicesResponse = await plexTvClient.query('/devices.xml');
      console.log('Plex.tv devices response:', JSON.stringify(devicesResponse, null, 2));
      
      // Get server information
      const serversResponse = await plexTvClient.query('/pms/servers.xml');
      console.log('Plex.tv servers response:', JSON.stringify(serversResponse, null, 2));
      
      // Try to find and use the target device
      if (devicesResponse?.MediaContainer?.Device) {
        const devices = Array.isArray(devicesResponse.MediaContainer.Device) 
          ? devicesResponse.MediaContainer.Device 
          : [devicesResponse.MediaContainer.Device];
          
        const targetDevice = devices.find(d => d.clientIdentifier === machineIdentifier);
        
        if (targetDevice) {
          console.log('Found target device via Plex.tv:', targetDevice.name);
          
          // Use the local client to send playback commands
          await this.initializeClient();
          
          const playParams = {
            key: `/library/metadata/${ratingKey}`,
            offset: offset * 1000,
            machineIdentifier: machineIdentifier,
            address: targetDevice.publicAddress || targetDevice.localAddress,
            port: targetDevice.port || 32400
          };
          
          const result = await this.client.query('/player/playback/playMedia', 'POST', playParams);
          
          return {
            success: true,
            message: 'Plex.tv discovery playback started',
            device: targetDevice.name,
            details: result
          };
        }
      }
      
      // Fallback to AndroidTV approach
      console.log('Device not found via Plex.tv, falling back to AndroidTV approach');
      return await this.playMediaOnAndroidTV(machineIdentifier, ratingKey, offset);
      
    } catch (error) {
      console.error('Plex.tv discovery playback failed:', error);
      
      // Final fallback to AndroidTV approach
      console.log('Plex.tv approach failed, trying AndroidTV approach as final fallback');
      return await this.playMediaOnAndroidTV(machineIdentifier, ratingKey, offset);
    }
  }

  async controlPlayback(machineIdentifier, action) {
    try {
      await this.initializeClient();

      const validActions = ['play', 'pause', 'stop', 'skipNext', 'skipPrevious', 'seekTo'];
      if (!validActions.includes(action)) {
        throw new Error(`Invalid action: ${action}`);
      }

      const result = await this.client.query(`/player/playback/${action}`, 'POST', {
        machineIdentifier: machineIdentifier
      });

      return {
        success: true,
        message: `${action} command sent successfully`,
        details: result
      };
    } catch (error) {
      console.error(`Failed to ${action} playback:`, error);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.initializeClient();
      const response = await this.client.query('/');
      
      return {
        success: true,
        message: 'Connection successful',
        serverVersion: response?.MediaContainer?.version || 'Unknown'
      };
    } catch (error) {
      console.error('Connection test failed:', error);
      throw error;
    }
  }

  async refreshClient() {
    this.client = null;
    this.lastSettingsCheck = null;
    return await this.initializeClient(true);
  }
}

module.exports = new PlexPlayerService();
