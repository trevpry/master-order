// Implementation based on the comprehensive Plex remote control documentation
// Following the server-brokered model for AndroidTV control

const PlexAPI = require('plex-api');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const prisma = new PrismaClient();

class PlexPlayerService {
  constructor() {
    this.client = null;
    this.lastSettingsCheck = null;
    this.commandIdCounter = 1;
    this.controllerIdentifier = uuidv4(); // Generate once and reuse
  }

  async initializeClient() {
    try {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });

      if (!settings || !settings.plexUrl || !settings.plexToken) {
        throw new Error('Plex settings not configured. Please set Plex URL and token in settings.');
      }

      const settingsHash = crypto.createHash('md5')
        .update(settings.plexUrl + settings.plexToken)
        .digest('hex');

      if (this.client && this.lastSettingsCheck === settingsHash) {
        return this.client;
      }

      const url = new URL(settings.plexUrl);
      
      // Initialize with proper headers as per documentation
      this.client = new PlexAPI({
        hostname: url.hostname,
        port: parseInt(url.port) || 32400,
        token: settings.plexToken,
        https: url.protocol === 'https:',
        timeout: 10000,
        // Provide controller identification headers
        options: {
          identifier: this.controllerIdentifier,
          product: 'Master Order Web App',
          deviceName: 'Master Order Controller',
          platform: 'Node.js'
        }
      });

      this.lastSettingsCheck = settingsHash;
      console.log(`Plex client initialized for ${url.hostname}:${url.port || 32400}`);
      console.log(`Controller ID: ${this.controllerIdentifier}`);
      return this.client;
    } catch (error) {
      console.error('Failed to initialize Plex client:', error);
      throw error;
    }
  }

  async getPlayers() {
    try {
      await this.initializeClient();
      
      // Use the server-side client roster method as recommended in documentation
      const response = await this.client.query('/clients');
      const clients = response?.MediaContainer?.Server || [];
      
      // Handle both single client and array of clients
      const clientList = Array.isArray(clients) ? clients : [clients];
      
      return clientList.map(client => ({
        name: client.name,
        address: client.address || 'Unknown',
        port: client.port || 'Unknown',
        machineIdentifier: client.machineIdentifier, // This becomes clientIdentifier
        product: client.product,
        platform: client.platform,
        platformVersion: client.platformVersion,
        protocolVersion: client.protocolVersion,
        protocolCapabilities: client.protocolCapabilities
      }));
    } catch (error) {
      console.error('Error getting players:', error);
      return [];
    }
  }

  async getServerIdentifier() {
    try {
      await this.initializeClient();
      
      // Get server identity as per documentation
      const response = await this.client.query('/identity');
      const serverId = response?.MediaContainer?.machineIdentifier;
      
      if (!serverId) {
        throw new Error('Could not retrieve server machineIdentifier');
      }
      
      console.log(`Server identifier: ${serverId}`);
      return serverId;
    } catch (error) {
      console.error('Error fetching server identifier:', error);
      throw error;
    }
  }

  async findMedia(libraryName, mediaTitle) {
    try {
      await this.initializeClient();
      
      console.log(`Searching for media: "${mediaTitle}" in library "${libraryName}"...`);
      
      // 1. Find the library section key
      const sectionsResponse = await this.client.query('/library/sections');
      const sections = sectionsResponse.MediaContainer.Directory;
      const library = Array.isArray(sections) ? 
        sections.find(s => s.title === libraryName) : 
        (sections.title === libraryName ? sections : null);

      if (!library) {
        throw new Error(`Library "${libraryName}" not found`);
      }
      
      const libraryKey = library.key;
      console.log(`Found library "${libraryName}" with key: ${libraryKey}`);

      // 2. Search for the media item in that library
      const searchUri = `/library/sections/${libraryKey}/all?title=${encodeURIComponent(mediaTitle)}`;
      const mediaResponse = await this.client.query(searchUri);
      
      const mediaItems = mediaResponse.MediaContainer.Metadata;
      if (!mediaItems || mediaItems.length === 0) {
        throw new Error(`Media "${mediaTitle}" not found in library`);
      }

      // Take the first match
      const media = Array.isArray(mediaItems) ? mediaItems[0] : mediaItems;
      console.log(`Found media: ${media.title} (ratingKey: ${media.ratingKey})`);
      
      return {
        ratingKey: media.ratingKey,
        key: media.key, // This is the path like /library/metadata/12345
        title: media.title
      };

    } catch (error) {
      console.error('Error finding media:', error);
      throw error;
    }
  }

  async playMedia(machineIdentifier, ratingKey, offset = 0) {
    try {
      console.log(`=== SERVER-BROKERED PLAYBACK COMMAND ===`);
      console.log(`Target AndroidTV: ${machineIdentifier}`);
      console.log(`Media ratingKey: ${ratingKey}`);
      console.log(`Offset: ${offset}`);

      await this.initializeClient();
      
      // Step 1: Find target client using server roster method
      const players = await this.getPlayers();
      const targetClient = players.find(p => p.machineIdentifier === machineIdentifier);
      
      if (!targetClient) {
        throw new Error(`Player ${machineIdentifier} not found`);
      }

      console.log(`Found target client: ${targetClient.name} (${targetClient.product})`);

      // Step 2: Get server identifier  
      const serverIdentifier = await this.getServerIdentifier();

      // Step 3: Get media details
      const mediaResponse = await this.client.query(`/library/metadata/${ratingKey}`);
      const media = mediaResponse?.MediaContainer?.Metadata?.[0];
      if (!media) {
        throw new Error('Media not found');
      }

      console.log(`Media details: ${media.title} (${media.type})`);

      // Step 4: Get server settings for address/port
      const settings = await prisma.settings.findUnique({ where: { id: 1 } });
      const serverUrl = new URL(settings.plexUrl);

      // Step 5: Construct the playMedia command exactly as per documentation
      this.commandIdCounter++;
      
      const params = new URLSearchParams({
        machineIdentifier: serverIdentifier,
        key: media.key, // Use the full key path from media
        protocol: serverUrl.protocol.replace(':', ''), // 'http' or 'https'
        address: serverUrl.hostname,
        port: parseInt(serverUrl.port) || 32400,
        commandID: this.commandIdCounter
      });

      if (offset > 0) {
        params.set('offset', offset * 1000); // Convert to milliseconds
      }

      const playbackUri = `/player/playback/playMedia?${params.toString()}`;
      
      console.log(`Sending server-brokered command:`);
      console.log(`URI: ${playbackUri}`);
      console.log(`Target Client ID: ${targetClient.machineIdentifier}`);

      // Step 6: Send the command with proper headers as per documentation
      try {
        const result = await this.client.query({
          uri: playbackUri,
          extraHeaders: {
            'X-Plex-Target-Client-Identifier': targetClient.machineIdentifier,
            'X-Plex-Client-Identifier': this.controllerIdentifier,
            'X-Plex-Product': 'Master Order Web App',
            'X-Plex-Device-Name': 'Master Order Controller',
            'X-Plex-Platform': 'Node.js'
          }
        });

        console.log('✅ Server-brokered playback command sent successfully!');
        console.log('The PMS will now create a play queue and notify the AndroidTV');

        return {
          success: true,
          message: 'Server-brokered playback started successfully',
          method: 'server-brokered',
          player: targetClient.name,
          media: {
            title: media.title,
            ratingKey: ratingKey
          },
          commandId: this.commandIdCounter
        };

      } catch (err) {
        // As noted in documentation, the server often returns an empty response on success
        // which can cause parsing errors. Check status code to determine actual success.
        if (err.statusCode >= 200 && err.statusCode < 300) {
          console.log('✅ Command likely succeeded despite response parsing error');
          return {
            success: true,
            message: 'Server-brokered playback likely successful (parse error ignored)',
            method: 'server-brokered',
            player: targetClient.name,
            media: {
              title: media.title,
              ratingKey: ratingKey
            },
            commandId: this.commandIdCounter
          };
        } else {
          throw err;
        }
      }

    } catch (error) {
      console.error('Server-brokered playback failed:', error);
      return {
        success: false,
        error: error.message,
        method: 'server-brokered'
      };
    }
  }

  async controlPlayback(machineIdentifier, action) {
    try {
      await this.initializeClient();
      
      const players = await this.getPlayers();
      const targetPlayer = players.find(p => p.machineIdentifier === machineIdentifier);
      
      if (!targetPlayer) {
        throw new Error(`Player ${machineIdentifier} not found`);
      }

      const commandMap = {
        'play': '/player/playback/play',
        'pause': '/player/playback/pause',
        'stop': '/player/playback/stop',
        'skipNext': '/player/playback/skipNext',
        'skipPrevious': '/player/playback/skipPrevious'
      };

      const endpoint = commandMap[action];
      if (!endpoint) {
        throw new Error(`Unknown action: ${action}`);
      }

      this.commandIdCounter++;
      const params = new URLSearchParams({
        type: 'video', // Specify media type as per documentation
        commandID: this.commandIdCounter
      });

      const controlUri = `${endpoint}?${params.toString()}`;
      
      console.log(`Sending control command: ${action} to ${targetPlayer.name}`);

      try {
        await this.client.query({
          uri: controlUri,
          extraHeaders: {
            'X-Plex-Target-Client-Identifier': targetPlayer.machineIdentifier,
            'X-Plex-Client-Identifier': this.controllerIdentifier
          }
        });

        return {
          success: true,
          message: `${action} command sent successfully`,
          player: targetPlayer.name
        };

      } catch (err) {
        // Handle parsing errors on successful responses
        if (err.statusCode >= 200 && err.statusCode < 300) {
          return {
            success: true,
            message: `${action} command likely successful`,
            player: targetPlayer.name
          };
        } else {
          throw err;
        }
      }

    } catch (error) {
      console.error('Control playback error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = PlexPlayerService;
