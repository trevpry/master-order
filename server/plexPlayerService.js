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

  async getPlayers() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      // Get all available players/clients
      const response = await this.client.query('/clients');
      
      if (!response || !response.MediaContainer || !response.MediaContainer.Server) {
        return [];
      }

      const players = response.MediaContainer.Server.map(player => ({
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

      console.log(`Found ${players.length} Plex players:`, players);
      return players;
    } catch (error) {
      console.error('Error fetching Plex players:', error);
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