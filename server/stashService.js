/**
 * Stash Service - GraphQL API client for Stash app
 * Provides methods to interact with Stash's GraphQL API for fetching videos/scenes
 */

const fetch = require('node-fetch');

class StashService {
  constructor() {
    this.apiUrl = null;
    this.apiKey = null;
  }

  /**
   * Configure Stash connection
   * @param {string} url - Stash server URL (e.g., http://localhost:9999)
   * @param {string} apiKey - Stash API key
   */
  configure(url, apiKey) {
    this.apiUrl = url ? url.replace(/\/$/, '') : null; // Remove trailing slash
    this.apiKey = apiKey;
  }

  /**
   * Check if Stash is configured
   * @returns {boolean}
   */
  isConfigured() {
    // Only require URL - API key is optional for some Stash setups
    return !!this.apiUrl;
  }

  /**
   * Make a GraphQL request to Stash
   * @param {string} query - GraphQL query
   * @param {Object} variables - Query variables
   * @returns {Promise<Object>} Response data
   */
  async makeGraphQLRequest(query, variables = {}) {
    if (!this.isConfigured()) {
      throw new Error('Stash is not configured. Please set URL in settings.');
    }

    const endpoint = `${this.apiUrl}/graphql`;
    
    // Build headers - only include API key if it exists
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['ApiKey'] = this.apiKey;
    }
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        // Get more detailed error information
        let errorBody = '';
        try {
          errorBody = await response.text();
          console.error('Stash API response body:', errorBody);
        } catch (e) {
          console.error('Could not read error response body');
        }
        throw new Error(`Stash API request failed: ${response.status} ${response.statusText} - ${errorBody}`);
      }

      const data = await response.json();

      if (data.errors && data.errors.length > 0) {
        console.error('GraphQL errors details:', data.errors);
        throw new Error(`Stash GraphQL errors: ${data.errors.map(e => e.message).join(', ')}`);
      }

      return data.data;
    } catch (error) {
      console.error('Stash API request error:', error);
      throw error;
    }
  }

  /**
   * Test connection to Stash server
   * @returns {Promise<Object>} Connection status and server info
   */
  async testConnection() {
    try {
      const query = `
        query {
          version {
            version
            build_time
            hash
          }
        }
      `;

      const data = await this.makeGraphQLRequest(query);
      
      return {
        success: true,
        version: data.version,
        message: 'Successfully connected to Stash'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: 'Failed to connect to Stash'
      };
    }
  }

  /**
   * Get scenes (videos) from Stash
   * @param {Object} options - Query options
   * @param {number} options.page - Page number (default: 1)
   * @param {number} options.perPage - Items per page (default: 20)
   * @param {string} options.sortBy - Sort field (default: "date")
   * @param {string} options.sortDirection - Sort direction (default: "DESC")
   * @param {string} options.filter - Search filter
   * @returns {Promise<Object>} Scenes data
   */
  async getScenes(options = {}) {
    const {
      page = 1,
      perPage = 20,
      sortBy = 'date',
      sortDirection = 'DESC',
      filter = ''
    } = options;

    const query = `
      query FindScenes($filter: FindFilterType, $scene_filter: SceneFilterType) {
        findScenes(filter: $filter, scene_filter: $scene_filter) {
          count
          scenes {
            id
            title
            details
            url
            date
            rating100
            organized
            created_at
            updated_at
            file {
              size
              duration
              width
              height
              framerate
              bitrate
            }
            paths {
              screenshot
              preview
              stream
              webp
              vtt
              sprite
              funscript
              interactive_heatmap
              caption
            }
            scene_markers {
              id
              title
              seconds
            }
            studio {
              id
              name
            }
            performers {
              id
              name
            }
            tags {
              id
              name
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        page: page,
        per_page: perPage,
        sort: sortBy,
        direction: sortDirection
      },
      scene_filter: filter ? {
        q: filter
      } : {}
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return {
        success: true,
        scenes: data.findScenes.scenes,
        count: data.findScenes.count,
        page,
        perPage,
        totalPages: Math.ceil(data.findScenes.count / perPage)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        scenes: [],
        count: 0
      };
    }
  }

  /**
   * Get a specific scene by ID
   * @param {string} sceneId - Scene ID
   * @returns {Promise<Object>} Scene data
   */
  async getScene(sceneId) {
    const query = `
      query FindScene($id: ID!) {
        findScene(id: $id) {
          id
          title
          details
          url
          date
          rating100
          organized
          created_at
          updated_at
          file {
            size
            duration
            width
            height
            framerate
            bitrate
            basename
            path
          }
          paths {
            screenshot
            preview
            stream
            webp
            vtt
            sprite
            funscript
            interactive_heatmap
            caption
          }
          scene_markers {
            id
            title
            seconds
            primary_tag {
              id
              name
            }
          }
          studio {
            id
            name
            url
          }
          performers {
            id
            name
            gender
            url
            image_path
          }
          tags {
            id
            name
          }
          movies {
            movie {
              id
              name
            }
            scene_index
          }
        }
      }
    `;

    const variables = { id: sceneId };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return {
        success: true,
        scene: data.findScene
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        scene: null
      };
    }
  }

  /**
   * Get performers from Stash
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Performers data
   */
  async getPerformers(options = {}) {
    const { page = 1, perPage = 20, filter = '' } = options;

    const query = `
      query FindPerformers($filter: FindFilterType, $performer_filter: PerformerFilterType) {
        findPerformers(filter: $filter, performer_filter: $performer_filter) {
          count
          performers {
            id
            name
            gender
            url
            twitter
            instagram
            birthdate
            ethnicity
            country
            eye_color
            height_cm
            measurements
            fake_tits
            career_length
            tattoos
            piercings
            scene_count
            image_path
          }
        }
      }
    `;

    const variables = {
      filter: {
        page: page,
        per_page: perPage,
        sort: 'name',
        direction: 'ASC'
      },
      performer_filter: filter ? {
        name: {
          value: filter,
          modifier: 'INCLUDES'
        }
      } : {}
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return {
        success: true,
        performers: data.findPerformers.performers,
        count: data.findPerformers.count
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        performers: [],
        count: 0
      };
    }
  }

  /**
   * Get studios from Stash
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Studios data
   */
  async getStudios(options = {}) {
    const { page = 1, perPage = 20, filter = '' } = options;

    const query = `
      query FindStudios($filter: FindFilterType, $studio_filter: StudioFilterType) {
        findStudios(filter: $filter, studio_filter: $studio_filter) {
          count
          studios {
            id
            name
            url
            scene_count
            image_path
            details
          }
        }
      }
    `;

    const variables = {
      filter: {
        page: page,
        per_page: perPage,
        sort: 'name',
        direction: 'ASC'
      },
      studio_filter: filter ? {
        name: {
          value: filter,
          modifier: 'INCLUDES'
        }
      } : {}
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return {
        success: true,
        studios: data.findStudios.studios,
        count: data.findStudios.count
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        studios: [],
        count: 0
      };
    }
  }

  /**
   * Get tags from Stash
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Tags data
   */
  async getTags(options = {}) {
    const { page = 1, perPage = 20, filter = '' } = options;

    const query = `
      query FindTags($filter: FindFilterType, $tag_filter: TagFilterType) {
        findTags(filter: $filter, tag_filter: $tag_filter) {
          count
          tags {
            id
            name
            description
            scene_count
            image_path
          }
        }
      }
    `;

    const variables = {
      filter: {
        page: page,
        per_page: perPage,
        sort: 'name',
        direction: 'ASC'
      },
      tag_filter: filter ? {
        name: {
          value: filter,
          modifier: 'INCLUDES'
        }
      } : {}
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return {
        success: true,
        tags: data.findTags.tags,
        count: data.findTags.count
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        tags: [],
        count: 0
      };
    }
  }

  /**
   * Increment play count for a scene
   * @param {string} sceneId - Scene ID
   * @returns {Promise<Object>} Updated scene data
   */
  async incrementScenePlayCount(sceneId) {
    try {
      // Use the correct current Stash API: sceneAddPlay (sceneIncrementPlayCount is deprecated)
      const mutation = `
        mutation SceneAddPlay($id: ID!, $times: [Timestamp!]) {
          sceneAddPlay(id: $id, times: $times) {
            count
            history {
              date
            }
          }
        }
      `;

      // Use current timestamp - Stash expects timestamp format
      const currentTime = new Date().toISOString();
      const variables = {
        id: sceneId,
        times: [currentTime]
      };

      console.log('🔍 Using correct sceneAddPlay mutation');
      console.log('🔍 Variables:', variables);

      const data = await this.makeGraphQLRequest(mutation, variables);
      console.log('✅ sceneAddPlay succeeded, result:', data);
      
      return {
        success: true,
        result: data.sceneAddPlay,
        message: 'Play count incremented successfully using sceneAddPlay'
      };
    } catch (error) {
      console.error('❌ sceneAddPlay failed:', error.message);
      
      // If that fails, fall back to the deprecated but potentially still working method
      try {
        const deprecatedMutation = `
          mutation SceneIncrementPlayCount($id: ID!) {
            sceneIncrementPlayCount(id: $id)
          }
        `;

        const deprecatedVariables = {
          id: sceneId
        };

        console.log('🔍 Trying deprecated sceneIncrementPlayCount as fallback');

        const deprecatedData = await this.makeGraphQLRequest(deprecatedMutation, deprecatedVariables);
        console.log('✅ Deprecated sceneIncrementPlayCount succeeded, result:', deprecatedData);
        
        return {
          success: true,
          result: { count: deprecatedData.sceneIncrementPlayCount },
          message: 'Play count incremented using deprecated method'
        };
      } catch (deprecatedError) {
        console.error('❌ Both new and deprecated methods failed:');
        console.error('   - sceneAddPlay error:', error.message);
        console.error('   - sceneIncrementPlayCount error:', deprecatedError.message);
        return {
          success: false,
          error: deprecatedError.message,
          message: 'Failed to increment play count in Stash - both methods failed'
        };
      }
    }
  }

  /**
   * Delete a scene from Stash
   * @param {string} sceneId - Scene ID
   * @param {boolean} deleteFile - Whether to delete the actual video file
   * @param {boolean} deleteGenerated - Whether to delete generated files (thumbnails, etc.)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteScene(sceneId, deleteFile = false, deleteGenerated = true) {
    try {
      const mutation = `
        mutation SceneDestroy($input: SceneDestroyInput!) {
          sceneDestroy(input: $input)
        }
      `;

      const variables = {
        input: {
          id: sceneId,
          delete_file: deleteFile,
          delete_generated: deleteGenerated
        }
      };

      console.log('🗑️ Deleting scene from Stash with mutation:', mutation);
      console.log('🗑️ Variables:', variables);

      const data = await this.makeGraphQLRequest(mutation, variables);
      console.log('✅ Scene deleted from Stash successfully:', data);
      
      return {
        success: true,
        deleted: data.sceneDestroy,
        message: 'Scene deleted successfully from Stash'
      };
    } catch (error) {
      console.error('❌ Failed to delete scene from Stash:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete scene from Stash'
      };
    }
  }

  /**
   * Update a scene's studio
   * @param {string} sceneId - Scene ID
   * @param {string} studioId - Studio ID to assign
   * @returns {Promise<Object>} Update result
   */
  async updateSceneStudio(sceneId, studioId) {
    try {
      const mutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            studio {
              id
              name
              image_path
            }
          }
        }
      `;

      const variables = {
        input: {
          id: sceneId,
          studio_id: studioId
        }
      };

      console.log('🎬 Updating scene studio in Stash:', { sceneId, studioId });

      const data = await this.makeGraphQLRequest(mutation, variables);
      console.log('✅ Scene studio updated in Stash successfully:', data.sceneUpdate);
      
      return {
        success: true,
        scene: data.sceneUpdate,
        message: 'Scene studio updated successfully in Stash'
      };
    } catch (error) {
      console.error('❌ Failed to update scene studio in Stash:', error.message);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update scene studio in Stash'
      };
    }
  }

  /**
   * Search across multiple types (scenes, performers, studios, tags)
   * @param {string} query - Search query
   * @param {Array} types - Types to search (default: ['scene'])
   * @returns {Promise<Object>} Search results
   */
  async search(query, types = ['scene']) {
    const results = {};

    if (types.includes('scene')) {
      results.scenes = await this.getScenes({ 
        filter: query,
        perPage: 10 
      });
    }

    if (types.includes('performer')) {
      results.performers = await this.getPerformers({ 
        filter: query,
        perPage: 10 
      });
    }

    if (types.includes('studio')) {
      results.studios = await this.getStudios({ 
        filter: query,
        perPage: 10 
      });
    }

    if (types.includes('tag')) {
      results.tags = await this.getTags({ 
        filter: query,
        perPage: 10 
      });
    }

    return results;
  }
}

// Export singleton instance
const stashService = new StashService();
module.exports = stashService;
