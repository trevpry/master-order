const { PrismaClient } = require('@prisma/client');

/**
 * RAWG API Service
 * Handles video game data retrieval from RAWG API and unified VideoGame library management
 * Following copilot-instructions modular service patterns
 */
class RawgService {
  constructor() {
    this.prisma = new PrismaClient();
    this.baseUrl = 'https://api.rawg.io/api';
  }

  /**
   * Get RAWG API key from settings
   * @returns {Promise<string|null>} The RAWG API key
   */
  async getApiKey() {
    try {
      const settings = await this.prisma.settings.findFirst();
      return settings?.rawgApiKey || null;
    } catch (error) {
      console.error('Error fetching RAWG API key:', error);
      return null;
    }
  }

  /**
   * Search for games on RAWG
   * @param {string} query - Search query
   * @param {number} limit - Number of results to return (default: 10)
   * @returns {Promise<Array>} Array of game results
   */
  async searchGames(query, limit = 10) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('RAWG API key not configured');
    }

    try {
      const url = `${this.baseUrl}/games?key=${apiKey}&search=${encodeURIComponent(query)}&page_size=${limit}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data.results || [];
    } catch (error) {
      console.error('Error searching RAWG games:', error);
      throw error;
    }
  }

  /**
   * Get detailed game information from RAWG
   * @param {number} rawgId - RAWG game ID
   * @returns {Promise<Object>} Game details
   */
  async getGameDetails(rawgId) {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new Error('RAWG API key not configured');
    }

    try {
      const url = `${this.baseUrl}/games/${rawgId}?key=${apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`RAWG API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching RAWG game details:', error);
      throw error;
    }
  }

  /**
   * Transform RAWG API data to VideoGame model format
   * @param {Object} rawgData - Raw RAWG API game data
   * @returns {Object} Transformed data for VideoGame model
   */
  transformRawgData(rawgData) {
    return {
      title: rawgData.name,
      developer: rawgData.developers?.map(dev => dev.name).join(', ') || null,
      publisher: rawgData.publishers?.map(pub => pub.name).join(', ') || null,
      releaseDate: rawgData.released ? new Date(rawgData.released) : null,
      description: rawgData.description_raw || rawgData.description || null,
      platforms: JSON.stringify(rawgData.platforms?.map(p => p.platform.name) || []),
      genres: JSON.stringify(rawgData.genres?.map(g => g.name) || []),
      rating: rawgData.rating || null,
      metacriticRating: rawgData.metacritic || null,
      rawgId: rawgData.id,
      rawgSlug: rawgData.slug,
      rawgUrl: `https://rawg.io/games/${rawgData.slug}`,
      coverUrl: rawgData.background_image || null,
      originalArtworkUrl: rawgData.background_image || null,
      esrbRating: rawgData.esrb_rating?.name || null,
      playtimeHours: rawgData.playtime || null,
      website: rawgData.website || null,
      webvideoUrl: null // RAWG data doesn't include webvideo URLs, this will be set manually
    };
  }

  /**
   * Create or update a VideoGame record in the unified library
   * @param {Object} gameData - Game data (either from RAWG or manual input)
   * @returns {Promise<Object>} Created/updated VideoGame record
   */
  async createGame(gameData) {
    try {
      // Check if game already exists by RAWG ID or title
      let existingGame = null;
      
      if (gameData.rawgId) {
        existingGame = await this.prisma.videoGame.findUnique({
          where: { rawgId: gameData.rawgId }
        });
      }
      
      if (!existingGame && gameData.rawgSlug) {
        existingGame = await this.prisma.videoGame.findUnique({
          where: { rawgSlug: gameData.rawgSlug }
        });
      }
      
      if (!existingGame) {
        existingGame = await this.prisma.videoGame.findFirst({
          where: { title: gameData.title }
        });
      }

      if (existingGame) {
        // Update existing game with new data
        return await this.prisma.videoGame.update({
          where: { id: existingGame.id },
          data: {
            ...gameData,
            updatedAt: new Date()
          }
        });
      } else {
        // Create new game
        return await this.prisma.videoGame.create({
          data: gameData
        });
      }
    } catch (error) {
      console.error('Error creating/updating VideoGame:', error);
      throw error;
    }
  }

  /**
   * Import game from RAWG by ID
   * @param {number} rawgId - RAWG game ID
   * @returns {Promise<Object>} Created VideoGame record
   */
  /**
   * Import a game from RAWG into unified VideoGame library
   * @param {number} rawgId - RAWG game ID
   * @param {Object} additionalData - Additional data to merge (e.g., webvideoUrl)
   * @returns {Promise<Object>} Created VideoGame record
   */
  async importGameFromRawg(rawgId, additionalData = {}) {
    try {
      const rawgData = await this.getGameDetails(rawgId);
      const gameData = this.transformRawgData(rawgData);
      
      // Merge any additional data (like webvideoUrl)
      const mergedGameData = { ...gameData, ...additionalData };
      
      return await this.createGame(mergedGameData);
    } catch (error) {
      console.error('Error importing game from RAWG:', error);
      throw error;
    }
  }

  /**
   * Get all games from unified library with optional filtering
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} Array of VideoGame records
   */
  async getGames(options = {}) {
    try {
      const { limit = 50, offset = 0, search, platform, genre } = options;
      
      const where = {};
      
      if (search) {
        // Note: SQLite doesn't support mode: 'insensitive', but contains is case-insensitive by default
        where.title = {
          contains: search
        };
      }
      
      if (platform) {
        where.platforms = {
          contains: platform
        };
      }
      
      if (genre) {
        where.genres = {
          contains: genre
        };
      }

      return await this.prisma.videoGame.findMany({
        where,
        orderBy: { title: 'asc' },
        take: limit,
        skip: offset
      });
    } catch (error) {
      console.error('Error fetching games:', error);
      throw error;
    }
  }

  /**
   * Get game by ID
   * @param {number} id - VideoGame ID
   * @returns {Promise<Object|null>} VideoGame record
   */
  async getGameById(id) {
    try {
      return await this.prisma.videoGame.findUnique({
        where: { id: parseInt(id) },
        include: {
          customOrderItems: true,
          gameCompletions: true
        }
      });
    } catch (error) {
      console.error('Error fetching game by ID:', error);
      throw error;
    }
  }

  /**
   * Update game completion status
   * @param {number} gameId - VideoGame ID
   * @param {Object} completionData - Completion data
   * @returns {Promise<Object>} GameCompletion record
   */
  async updateGameCompletion(gameId, completionData) {
    try {
      const { userId = null, isCompleted, hoursPlayed, percentComplete } = completionData;
      
      return await this.prisma.gameCompletion.upsert({
        where: {
          gameId_userId: {
            gameId: parseInt(gameId),
            userId
          }
        },
        update: {
          isCompleted,
          hoursPlayed,
          percentComplete,
          completedAt: isCompleted ? new Date() : null,
          updatedAt: new Date()
        },
        create: {
          gameId: parseInt(gameId),
          userId,
          isCompleted,
          hoursPlayed,
          percentComplete,
          completedAt: isCompleted ? new Date() : null
        }
      });
    } catch (error) {
      console.error('Error updating game completion:', error);
      throw error;
    }
  }
}

module.exports = RawgService;