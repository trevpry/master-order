// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client
const PerformerTagMappingService = require('./services/performerTagMappingService');

class StashSyncService {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.stashUrl = null;
    this.stashApiKey = null;
    
    // Initialize Prisma client
    this.prisma = prisma;
    
    // Initialize tag mapping service for performer attributes
    this.tagMappingService = new PerformerTagMappingService(
      // Pass GraphQL client function
      (query, variables) => this.makeGraphQLRequest(query, variables)
    );
  }

  /**
   * Check if the service is properly configured
   * @returns {Promise<boolean>} True if configured, false otherwise
   */
  async isConfigured() {
    try {
      await this.ensureConfigLoaded();
      return !!this.stashUrl;
    } catch (error) {
      return false;
    }
  }

  async ensureConfigLoaded() {
    if (!this.stashUrl) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      
      // Use database settings, fall back to environment variables if needed
      this.stashUrl = settings?.stashUrl || 
                      process.env.STASH_URL || 
                      process.env.STASH_URL_FALLBACK_1 ||
                      process.env.STASH_URL_FALLBACK_2 ||
                      process.env.STASH_URL_FALLBACK_3 ||
                      process.env.STASH_URL_FALLBACK_4;
      this.stashApiKey = settings?.stashApiKey || process.env.STASH_API_KEY; // Optional
      
      // Normalize URL - remove trailing slashes
      if (this.stashUrl) {
        this.stashUrl = this.stashUrl.replace(/\/+$/, '');
      }
      
      console.log('🔧 StashSyncService config loaded:');
      console.log('   - Database URL:', settings?.stashUrl || 'NOT SET');
      console.log('   - Environment URLs:', [
        process.env.STASH_URL,
        process.env.STASH_URL_FALLBACK_1,
        process.env.STASH_URL_FALLBACK_2,
        process.env.STASH_URL_FALLBACK_3,
        process.env.STASH_URL_FALLBACK_4
      ].filter(url => url));
      console.log('   - Final URL:', this.stashUrl || 'NOT SET');
      
      if (!this.stashUrl) {
        throw new Error('Stash URL not configured. Please set it in the Settings page or environment variables.');
      }
    }
  }

  /**
   * Force reload configuration from database
   * Call this after updating Stash settings
   */
  async reloadConfig() {
    this.stashUrl = null;
    this.stashApiKey = null;
    await this.ensureConfigLoaded();
    console.log('🔄 StashSyncService configuration reloaded');
  }

  async makeGraphQLRequest(query, variables = {}) {
    await this.ensureConfigLoaded();
    
    // Normalize the URL to prevent double slashes
    const baseUrl = this.stashUrl.endsWith('/') ? this.stashUrl.slice(0, -1) : this.stashUrl;
    const graphqlUrl = `${baseUrl}/graphql`;
    
    const requestBody = {
      query,
      variables
    };

    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    // Add API key if configured
    if (this.stashApiKey) {
      headers['ApiKey'] = this.stashApiKey;
    }
    
    console.log('🌐 [makeGraphQLRequest] Preparing GraphQL request:');
    console.log('   - URL:', graphqlUrl);
    console.log('   - Has API Key:', !!this.stashApiKey);
    console.log('   - Variables:', JSON.stringify(variables, null, 2));
    console.log('   - Query:', query.substring(0, 100) + '...');
    
    try {
      console.log('   - Sending HTTP POST request...');
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      console.log('   - Response received:');
      console.log('     - Status:', response.status, response.statusText);
      console.log('     - Content-Type:', response.headers.get('content-type'));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [makeGraphQLRequest] HTTP error:', errorText);
        throw new Error(`Stash GraphQL request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        console.error('❌ [makeGraphQLRequest] Non-JSON response:', responseText.substring(0, 200));
        throw new Error(`Expected JSON response from Stash GraphQL endpoint, but got ${contentType}. Response: ${responseText.substring(0, 200)}...`);
      }
      
      const jsonData = await response.json();
      console.log('   - JSON parsed successfully');
      
      if (jsonData.errors) {
        console.error('❌ [makeGraphQLRequest] GraphQL errors:', JSON.stringify(jsonData.errors, null, 2));
        throw new Error(`Stash GraphQL error: ${JSON.stringify(jsonData.errors)}`);
      }
      
      console.log('✅ [makeGraphQLRequest] Request successful, returning data');
      return jsonData.data;
    } catch (error) {
      console.error('❌ [makeGraphQLRequest] Exception:', error.message);
      console.error('   - Error code:', error.code);
      console.error('   - Error type:', error.name);
      
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`Cannot connect to Stash server at ${graphqlUrl}. Please verify the Stash URL is correct and the server is running.`);
      }
      throw error;
    }
  }

  async syncScenes(page = 1, perPage = 250) {
    console.log(`Syncing scenes (page ${page})...`);
    
    const query = `
      query FindScenes($filter: FindFilterType!) {
        findScenes(filter: $filter) {
          count
          scenes {
            id
            title
            details
            url
            date
            rating100
            organized
            o_counter
            last_played_at
            resume_time
            play_duration
            play_count
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
            files {
              id
              path
              size
              duration
              mod_time
              video_codec
              audio_codec
              width
              height
              frame_rate
              bit_rate
              fingerprints {
                type
                value
              }
            }
            studio {
              id
              name
            }
            code
            director
            performers {
              id
              name
            }
            tags {
              id
              name
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
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: perPage,
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const scenes = data.findScenes?.scenes || [];
      const count = data.findScenes?.count || 0;
      
      console.log(`Found ${scenes.length} scenes on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedScenes = [];
      
      // Pre-load all existing studios and performers for batch validation
      const allExistingStudios = await prisma.stashStudio.findMany({
        select: { id: true }
      });
      const studioIds = new Set(allExistingStudios.map(s => s.id));
      
      const allExistingPerformers = await prisma.stashPerformer.findMany({
        select: { id: true }
      });
      const performerIds = new Set(allExistingPerformers.map(p => p.id));
      
      const allExistingTags = await prisma.stashTag.findMany({
        select: { id: true }
      });
      const tagIds = new Set(allExistingTags.map(t => t.id));
      
      console.log(`🔧 Pre-loaded validation data: ${studioIds.size} studios, ${performerIds.size} performers, ${tagIds.size} tags`);
      
      for (const scene of scenes) {
        // Extract file information from the files array
        const primaryFile = scene.files && scene.files.length > 0 ? scene.files[0] : null;
        
        // DEBUG: Log file metadata to verify it's being received from Stash
        if (primaryFile) {
          console.log(`📹 Scene ${scene.id} "${scene.title}" file metadata:`, {
            size: primaryFile.size,
            width: primaryFile.width,
            height: primaryFile.height,
            video_codec: primaryFile.video_codec,
            audio_codec: primaryFile.audio_codec,
            frame_rate: primaryFile.frame_rate,
            bit_rate: primaryFile.bit_rate,
            path: primaryFile.path
          });
        } else {
          console.log(`⚠️ Scene ${scene.id} "${scene.title}" has no file data`);
        }
        
        const osHash = primaryFile?.fingerprints?.find(fp => fp.type === 'oshash')?.value || null;
        const checksum = primaryFile?.fingerprints?.find(fp => fp.type === 'md5')?.value || null;
        
        // Validate foreign key references before creating scene data
        let validatedStudioId = null;
        
        // Check if studio exists using pre-loaded data
        if (scene.studio?.id) {
          if (studioIds.has(scene.studio.id)) {
            validatedStudioId = scene.studio.id;
          } else {
            console.log(`⚠️ Studio ${scene.studio.id} not found for scene ${scene.id}, setting studioId to null`);
          }
        }
        
        const sceneData = {
          id: scene.id,
          title: scene.title || '',
          details: scene.details || null,
          url: scene.url || null,
          date: scene.date || null,
          rating: scene.rating100 ? Math.round(scene.rating100 / 20) : null, // Convert from 100-scale to 5-star
          organized: scene.organized || false,
          osHash: osHash,
          checksum: checksum,
          phash: null, // Not available in current Stash API
          oCounter: scene.o_counter || null,
          path: primaryFile?.path || null,
          fileModTime: primaryFile?.mod_time ? new Date(primaryFile.mod_time) : null,
          // File information
          fileSize: primaryFile?.size || null,
          duration: primaryFile?.duration || null,
          width: primaryFile?.width || null,
          height: primaryFile?.height || null,
          videoCodec: primaryFile?.video_codec || null,
          audioCodec: primaryFile?.audio_codec || null,
          frameRate: primaryFile?.frame_rate || null,
          bitrate: primaryFile?.bit_rate || null,
          // Studio info
          studio: scene.studio?.name || null,
          studioId: validatedStudioId, // Use validated studio ID or null
          code: scene.code || null,
          director: scene.director || null,
          synopsis: null, // Not available in current Stash API
          // Play status fields
          lastPlayedAt: scene.last_played_at ? new Date(scene.last_played_at) : null,
          resumeTime: scene.resume_time || null,
          playDuration: scene.play_duration || null,
          playCount: scene.play_count || null,
          lastSyncedAt: new Date()
        };

        // Upsert scene
        const syncedScene = await prisma.stashScene.upsert({
          where: { id: scene.id },
          update: sceneData,
          create: sceneData
        });

        // Sync performers for this scene
        if (scene.performers && scene.performers.length > 0) {
          // Get existing performer relationships with their tags (action codes)
          const existingRelationships = await prisma.stashScenePerformer.findMany({
            where: { sceneId: scene.id },
            include: {
              tags: true
            }
          });

          // Create a map of existing relationships that have tags or notes
          const relationshipsWithData = new Map();
          existingRelationships.forEach(rel => {
            if (rel.tags.length > 0 || rel.notes) {
              relationshipsWithData.set(rel.performerId, rel);
            }
          });

          // Get performer IDs from Stash
          const stashPerformerIds = new Set(scene.performers.map(p => p.id));

          // Remove only relationships that:
          // 1. Are NOT in the current Stash data, AND
          // 2. Don't have any local tags or notes
          const performersToRemove = existingRelationships
            .filter(rel => !stashPerformerIds.has(rel.performerId) && !relationshipsWithData.has(rel.performerId))
            .map(rel => rel.performerId);

          if (performersToRemove.length > 0) {
            await prisma.stashScenePerformer.deleteMany({
              where: { 
                sceneId: scene.id,
                performerId: { in: performersToRemove }
              }
            });
            console.log(`   🗑️ Removed ${performersToRemove.length} performer(s) no longer in Stash (without local data)`);
          }

          // Filter valid performers using pre-loaded data
          const validPerformers = scene.performers.filter(performer => {
            if (performerIds.has(performer.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping performer relationship - performer ${performer.id} not found for scene ${scene.id}`);
              return false;
            }
          });

          // Add or update performer relationships (upsert to preserve existing data)
          if (validPerformers.length > 0) {
            for (const performer of validPerformers) {
              await prisma.stashScenePerformer.upsert({
                where: {
                  sceneId_performerId: {
                    sceneId: scene.id,
                    performerId: performer.id
                  }
                },
                update: {
                  // Don't update anything - preserve notes and tags
                },
                create: {
                  sceneId: scene.id,
                  performerId: performer.id
                }
              });
            }
            
            const preserved = validPerformers.filter(p => relationshipsWithData.has(p.id)).length;
            if (preserved > 0) {
              console.log(`   💾 Preserved ${preserved} performer(s) with action codes/notes`);
            }
          }
        }

        // Sync tags for this scene
        if (scene.tags && scene.tags.length > 0) {
          // Remove existing tag relationships
          await prisma.stashSceneTag.deleteMany({
            where: { sceneId: scene.id }
          });

          // Filter valid tags using pre-loaded data
          const validTags = scene.tags.filter(tag => {
            if (tagIds.has(tag.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping tag relationship - tag ${tag.id} not found for scene ${scene.id}`);
              return false;
            }
          });

          // Batch create tag relationships
          if (validTags.length > 0) {
            await prisma.stashSceneTag.createMany({
              data: validTags.map(tag => ({
                sceneId: scene.id,
                tagId: tag.id
              }))
            });
          }
        }

        // Sync markers for this scene
        if (scene.scene_markers && scene.scene_markers.length > 0) {
          // Remove existing markers
          await prisma.stashMarker.deleteMany({
            where: { sceneId: scene.id }
          });

          // Add new markers
          for (const marker of scene.scene_markers) {
            await prisma.stashMarker.create({
              data: {
                stashId: marker.id,
                sceneId: scene.id,
                title: marker.title || '',
                seconds: marker.seconds || 0,
                primaryTag: marker.primary_tag?.name || null,
                primaryTagId: marker.primary_tag?.id || null,
                lastSyncedAt: new Date()
              }
            });
          }

          // Create marker-based clips for this scene
          await this.createMarkerBasedClips(scene);
        }
        
        syncedScenes.push(syncedScene);
      }
      
      console.log(`Synced ${syncedScenes.length} scenes from page ${page}`);
      return { scenes: syncedScenes, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing scenes:', error);
      throw error;
    }
  }

  async cleanupHiddenScenes() {
    try {
      console.log('Starting cleanup of scenes with "zzHide" tag...');
      
      // Find scenes that have the "zzHide" tag
      const hiddenScenes = await prisma.stashScene.findMany({
        include: {
          tags: true
        }
      });

      let removedCount = 0;
      let clipsRemovedCount = 0;
      
      for (const scene of hiddenScenes) {
        if (scene.tags.some(tag => tag.name === 'zzHide')) {
          // First, delete all clips associated with this scene
          const clipsDeleted = await prisma.stashClip.deleteMany({
            where: { sceneId: scene.id }
          });
          clipsRemovedCount += clipsDeleted.count;
          
          // Then delete the scene
          await prisma.stashScene.delete({
            where: { id: scene.id }
          });
          removedCount++;
        }
      }

      if (clipsRemovedCount > 0) {
        console.log(`Removed ${clipsRemovedCount} clips associated with hidden scenes`);
      }

      return removedCount;
    } catch (error) {
      console.error('Error cleaning up hidden scenes:', error);
      return 0;
    }
  }

  async cleanupPerformersWithZeroScenes() {
    try {
      console.log('Starting cleanup of performers with 0 scenes...');
      
      // Find performers that have no scenes
      const performersWithScenes = await prisma.stashPerformer.findMany({
        include: {
          _count: {
            select: { scenes: true }
          }
        }
      });

      let removedCount = 0;
      for (const performer of performersWithScenes) {
        if (performer._count.scenes === 0) {
          await prisma.stashPerformer.delete({
            where: { id: performer.id }
          });
          removedCount++;
        }
      }

      return removedCount;
    } catch (error) {
      console.error('Error cleaning up performers with 0 scenes:', error);
      return 0;
    }
  }

  async cleanupStudiosWithZeroScenes() {
    try {
      console.log('Starting cleanup of studios with 0 scenes...');
      
      // Find studios that have no scenes
      const studiosWithScenes = await prisma.stashStudio.findMany({
        include: {
          _count: {
            select: { scenes: true }
          }
        }
      });

      let removedCount = 0;
      for (const studio of studiosWithScenes) {
        if (studio._count.scenes === 0) {
          await prisma.stashStudio.delete({
            where: { id: studio.id }
          });
          removedCount++;
        }
      }

      return removedCount;
    } catch (error) {
      console.error('Error cleaning up studios with 0 scenes:', error);
      return 0;
    }
  }

  // ================================
  // COMPREHENSIVE CLEANUP METHODS
  // ================================

  /**
   * Get all current entity IDs from Stash for cleanup comparison
   */
  async getAllStashEntityIds(entityType) {
    console.log(`🔍 Fetching all ${entityType} IDs from Stash for cleanup...`);
    
    const queries = {
      scenes: `
        query GetAllSceneIds($filter: FindFilterType!) {
          findScenes(filter: $filter) {
            count
            scenes { id }
          }
        }
      `,
      performers: `
        query GetAllPerformerIds($filter: FindFilterType!) {
          findPerformers(filter: $filter) {
            count
            performers { id }
          }
        }
      `,
      studios: `
        query GetAllStudioIds($filter: FindFilterType!) {
          findStudios(filter: $filter) {
            count
            studios { id }
          }
        }
      `,
      tags: `
        query GetAllTagIds($filter: FindFilterType!) {
          findTags(filter: $filter) {
            count
            tags { id }
          }
        }
      `,
      galleries: `
        query GetAllGalleryIds($filter: FindFilterType!) {
          findGalleries(filter: $filter) {
            count
            galleries { id }
          }
        }
      `,
      images: `
        query GetAllImageIds($filter: FindFilterType!) {
          findImages(filter: $filter) {
            count
            images { id }
          }
        }
      `,
      movies: `
        query GetAllMovieIds($filter: FindFilterType!) {
          findMovies(filter: $filter) {
            count
            movies { id }
          }
        }
      `
    };

    const query = queries[entityType];
    if (!query) {
      throw new Error(`Unknown entity type for cleanup: ${entityType}`);
    }

    try {
      const allIds = new Set();
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const variables = {
          filter: {
            page: page,
            per_page: 1000 // Large batch for ID-only queries
          }
        };

        const data = await this.makeGraphQLRequest(query, variables);
        
        let entities = [];
        let count = 0;

        switch (entityType) {
          case 'scenes':
            entities = data.findScenes?.scenes || [];
            count = data.findScenes?.count || 0;
            break;
          case 'performers':
            entities = data.findPerformers?.performers || [];
            count = data.findPerformers?.count || 0;
            break;
          case 'studios':
            entities = data.findStudios?.studios || [];
            count = data.findStudios?.count || 0;
            break;
          case 'tags':
            entities = data.findTags?.tags || [];
            count = data.findTags?.count || 0;
            break;
          case 'galleries':
            entities = data.findGalleries?.galleries || [];
            count = data.findGalleries?.count || 0;
            break;
          case 'images':
            entities = data.findImages?.images || [];
            count = data.findImages?.count || 0;
            break;
          case 'movies':
            entities = data.findMovies?.movies || [];
            count = data.findMovies?.count || 0;
            break;
        }

        entities.forEach(entity => allIds.add(entity.id));
        
        hasMore = entities.length === 1000 && allIds.size < count;
        page++;
      }

      console.log(`📊 Found ${allIds.size} current ${entityType} in Stash`);
      return allIds;

    } catch (error) {
      console.error(`Error fetching ${entityType} IDs from Stash:`, error);
      throw error;
    }
  }

  /**
   * Clean up entities that no longer exist in Stash
   */
  async cleanupOrphanedEntities(enableCleanup = true) {
    if (!enableCleanup) {
      console.log('🔇 Comprehensive cleanup disabled, skipping...');
      return {
        scenes: 0, performers: 0, studios: 0, tags: 0, 
        galleries: 0, images: 0, movies: 0,
        sceneFiles: 0, sceneMarkers: 0, junctionTables: 0
      };
    }

    console.log('🧹 Starting comprehensive cleanup of orphaned entities...');
    const startTime = Date.now();
    const results = {
      scenes: 0, performers: 0, studios: 0, tags: 0, 
      galleries: 0, images: 0, movies: 0,
      sceneMarkers: 0, junctionTables: 0
    };

    try {
      // Step 1: Clean up junction tables first (referential integrity)
      console.log('🧹 Step 1: Cleaning junction tables...');
      results.junctionTables += await this.cleanupJunctionTables();

      // Step 2: Clean up dependent entities
      console.log('🧹 Step 2: Cleaning dependent entities...');
      
      // Scene markers (depend on scenes)
      const stashSceneIds = await this.getAllStashEntityIds('scenes');
      results.sceneMarkers += await this.cleanupSceneMarkers(stashSceneIds);

      // Images (depend on galleries)
      const stashGalleryIds = await this.getAllStashEntityIds('galleries');
      results.images += await this.cleanupOrphanedImages(stashGalleryIds);

      // Step 3: Clean up main entities
      console.log('🧹 Step 3: Cleaning main entities...');
      results.scenes += await this.cleanupOrphanedScenes(stashSceneIds);
      results.galleries += await this.cleanupOrphanedGalleries(stashGalleryIds);
      
      // Movies (if supported)
      try {
        const stashMovieIds = await this.getAllStashEntityIds('movies');
        results.movies += await this.cleanupOrphanedMovies(stashMovieIds);
      } catch (error) {
        console.log('ℹ️ Movies not supported in this Stash version, skipping movie cleanup');
      }

      // Step 4: Clean up reference entities (only if no dependents)
      console.log('🧹 Step 4: Cleaning reference entities...');
      const stashPerformerIds = await this.getAllStashEntityIds('performers');
      const stashStudioIds = await this.getAllStashEntityIds('studios');
      const stashTagIds = await this.getAllStashEntityIds('tags');
      
      results.performers += await this.cleanupOrphanedPerformers(stashPerformerIds);
      results.studios += await this.cleanupOrphanedStudios(stashStudioIds);
      results.tags += await this.cleanupOrphanedTags(stashTagIds);

      const duration = (Date.now() - startTime) / 1000;
      const totalCleaned = Object.values(results).reduce((sum, count) => sum + count, 0);
      
      console.log(`✅ Comprehensive cleanup completed in ${duration}s. Removed ${totalCleaned} orphaned entities:`, results);
      return results;

    } catch (error) {
      console.error('Error during comprehensive cleanup:', error);
      throw error;
    }
  }

  async cleanupJunctionTables() {
    // Junction tables are automatically cleaned up by Prisma CASCADE deletes
    // when parent entities (scenes, performers, tags) are removed.
    // This method is kept for consistency but CASCADE handles the cleanup.
    console.log('✅ Junction table cleanup handled automatically by CASCADE deletes');
    return 0;
  }

  async cleanupSceneMarkers(validSceneIds) {
    const localSceneMarkers = await prisma.stashMarker.findMany({
      select: { id: true, sceneId: true }
    });

    let removed = 0;
    for (const marker of localSceneMarkers) {
      if (!validSceneIds.has(marker.sceneId)) {
        await prisma.stashMarker.delete({ where: { id: marker.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned scene markers`);
    }
    return removed;
  }

  async cleanupOrphanedImages(validGalleryIds) {
    const localImages = await prisma.stashImage.findMany({
      select: { id: true, galleryId: true }
    });

    let removed = 0;
    for (const image of localImages) {
      // Remove images whose gallery no longer exists in Stash
      if (image.galleryId && !validGalleryIds.has(image.galleryId)) {
        await prisma.stashImage.delete({ where: { id: image.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned images`);
    }
    return removed;
  }

  async cleanupOrphanedScenes(validSceneIds) {
    const localScenes = await prisma.stashScene.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const scene of localScenes) {
      if (!validSceneIds.has(scene.id)) {
        await prisma.stashScene.delete({ where: { id: scene.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned scenes`);
    }
    return removed;
  }

  async cleanupOrphanedGalleries(validGalleryIds) {
    const localGalleries = await prisma.stashGallery.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const gallery of localGalleries) {
      if (!validGalleryIds.has(gallery.id)) {
        await prisma.stashGallery.delete({ where: { id: gallery.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned galleries`);
    }
    return removed;
  }

  async cleanupOrphanedMovies(validMovieIds) {
    const localMovies = await prisma.stashMovie.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const movie of localMovies) {
      if (!validMovieIds.has(movie.id)) {
        await prisma.stashMovie.delete({ where: { id: movie.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned movies`);
    }
    return removed;
  }

  async cleanupOrphanedPerformers(validPerformerIds) {
    const localPerformers = await prisma.stashPerformer.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const performer of localPerformers) {
      if (!validPerformerIds.has(performer.id)) {
        await prisma.stashPerformer.delete({ where: { id: performer.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned performers`);
    }
    return removed;
  }

  async cleanupOrphanedStudios(validStudioIds) {
    const localStudios = await prisma.stashStudio.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const studio of localStudios) {
      if (!validStudioIds.has(studio.id)) {
        await prisma.stashStudio.delete({ where: { id: studio.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned studios`);
    }
    return removed;
  }

  async cleanupOrphanedTags(validTagIds) {
    const localTags = await prisma.stashTag.findMany({
      select: { id: true }
    });

    let removed = 0;
    for (const tag of localTags) {
      if (!validTagIds.has(tag.id)) {
        await prisma.stashTag.delete({ where: { id: tag.id } });
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`🗑️ Removed ${removed} orphaned tags`);
    }
    return removed;
  }

  // ================================
  // END COMPREHENSIVE CLEANUP METHODS
  // ================================

  async syncPerformers(page = 1, perPage = 250) {
    console.log(`Syncing performers (page ${page})...`);
    
    const query = `
      query FindPerformers($filter: FindFilterType!) {
        findPerformers(filter: $filter) {
          count
          performers {
            id
            name
            disambiguation
            alias_list
            favorite
            ignore_auto_tag
            birthdate
            death_date
            ethnicity
            country
            eye_color
            hair_color
            height_cm
            weight
            measurements
            fake_tits
            penis_length
            circumcised
            career_length
            tattoos
            piercings
            image_path
            instagram
            twitter
            url
            gender
            details
            rating100
            scene_count
            stash_ids {
              endpoint
              stash_id
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
        page,
        per_page: perPage,
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const performers = data.findPerformers?.performers || [];
      const count = data.findPerformers?.count || 0;
      
      console.log(`Found ${performers.length} performers on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedPerformers = [];
      
      // Pre-load all existing tags for batch validation
      const allExistingTags = await prisma.stashTag.findMany({
        select: { id: true }
      });
      const tagIds = new Set(allExistingTags.map(t => t.id));
      
      console.log(`🔧 Pre-loaded validation data: ${tagIds.size} tags`);
      
      // NEW: Process ethnicity tag mapping for all performers first
      console.log('🏷️  Mapping performer ethnicities to tags...');
      const ethnicityTagMap = new Map(); // performerId -> tagId
      
      for (const performer of performers) {
        if (performer.ethnicity) {
          try {
            const ethnicityTag = await this.tagMappingService.findOrCreateTag(
              performer.ethnicity,
              'Race' // Parent tag name
            );
            
            if (ethnicityTag) {
              ethnicityTagMap.set(performer.id, ethnicityTag.id);
            }
          } catch (error) {
            console.warn(`⚠️  Failed to map ethnicity for performer ${performer.name}:`, error.message);
          }
        }
      }
      
      console.log(`✅ Mapped ${ethnicityTagMap.size} ethnicities to tags`);
      
      for (const performer of performers) {
        // Include all performers, even those with 0 scenes

        const performerData = {
          id: performer.id,
          name: performer.name || '',
          disambiguation: performer.disambiguation || null,
          alias: performer.alias_list ? performer.alias_list.join(', ') : null,
          favorite: performer.favorite || false,
          ignore_auto_tag: performer.ignore_auto_tag || false,
          birthdate: performer.birthdate || null,
          death_date: performer.death_date || null,
          ethnicity: performer.ethnicity || null, // Keep for backward compatibility
          ethnicityTagId: ethnicityTagMap.get(performer.id) || null, // NEW: Link to tag
          country: performer.country || null,
          eye_color: performer.eye_color || null,
          hair_color: performer.hair_color || null,
          height: performer.height_cm ? `${performer.height_cm} cm` : null,
          weight: (typeof performer.weight === 'number') ? `${performer.weight}` : (performer.weight || null),
          measurements: performer.measurements || null,
          fake_tits: performer.fake_tits || null,
          penis_length: (typeof performer.penis_length === 'number') ? `${performer.penis_length} cm` : null,
          circumcised: performer.circumcised || null,
          career_length: performer.career_length || null,
          tattoos: performer.tattoos || null,
          piercings: performer.piercings || null,
          image: performer.image_path || null,
          instagram: performer.instagram || null,
          twitter: performer.twitter || null,
          url: performer.url || null,
          gender: performer.gender || null,
          details: performer.details || null,
          rating: performer.rating100 ? Math.round(performer.rating100 / 20) : null,
          lastSyncedAt: new Date()
        };

        // Upsert performer
        const syncedPerformer = await prisma.stashPerformer.upsert({
          where: { id: performer.id },
          update: performerData,
          create: performerData
        });

        // Sync tags for this performer
        if (performer.tags && performer.tags.length > 0) {
          // Remove existing tag relationships
          await prisma.stashPerformerTag.deleteMany({
            where: { performerId: performer.id }
          });

          // Filter valid tags using pre-loaded data
          const validTags = performer.tags.filter(tag => {
            if (tagIds.has(tag.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping tag relationship - tag ${tag.id} not found for performer ${performer.id}`);
              return false;
            }
          });

          // Batch create tag relationships
          if (validTags.length > 0) {
            await prisma.stashPerformerTag.createMany({
              data: validTags.map(tag => ({
                performerId: performer.id,
                tagId: tag.id
              }))
            });
          }
        }
        
        syncedPerformers.push(syncedPerformer);
      }
      
      console.log(`Synced ${syncedPerformers.length} performers from page ${page}`);
      return { performers: syncedPerformers, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing performers:', error);
      throw error;
    }
  }

  async syncStudios(page = 1, perPage = 250) {
    console.log(`Syncing studios (page ${page})...`);
    
    const query = `
      query FindStudios($filter: FindFilterType!) {
        findStudios(filter: $filter) {
          count
          studios {
            id
            name
            url
            image_path
            scene_count
            aliases
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: perPage,
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const studios = data.findStudios?.studios || [];
      const count = data.findStudios?.count || 0;
      
      console.log(`Found ${studios.length} studios on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedStudios = [];
      
      for (const studio of studios) {
        const studioData = {
          id: studio.id,
          name: studio.name || '',
          url: studio.url || null,
          image: studio.image_path || null,
          lastSyncedAt: new Date()
        };

        // Upsert studio
        const syncedStudio = await prisma.stashStudio.upsert({
          where: { id: studio.id },
          update: studioData,
          create: studioData
        });
        
        // Sync aliases
        const aliases = studio.aliases || [];
        if (aliases.length > 0) {
          // Delete existing aliases not in the new list
          await prisma.stashStudioAlias.deleteMany({
            where: {
              studioId: studio.id,
              alias: { notIn: aliases }
            }
          });
          
          // Create new aliases
          for (const alias of aliases) {
            await prisma.stashStudioAlias.upsert({
              where: {
                studioId_alias: {
                  studioId: studio.id,
                  alias: alias
                }
              },
              update: {},
              create: {
                studioId: studio.id,
                alias: alias
              }
            });
          }
        } else {
          // No aliases - delete all existing aliases
          await prisma.stashStudioAlias.deleteMany({
            where: { studioId: studio.id }
          });
        }
        
        syncedStudios.push(syncedStudio);
      }
      
      console.log(`Synced ${syncedStudios.length} studios from page ${page}`);
      return { studios: syncedStudios, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing studios:', error);
      throw error;
    }
  }

  async syncTags(page = 1, perPage = 250) {
    console.log(`Syncing tags (page ${page})...`);
    
    const query = `
      query FindTags($filter: FindFilterType!) {
        findTags(filter: $filter) {
          count
          tags {
            id
            name
            description
            image_path
            aliases
            favorite
            ignore_auto_tag
            parents {
              id
              name
            }
            children {
              id
              name
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: perPage,
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const tags = data.findTags?.tags || [];
      const count = data.findTags?.count || 0;
      
      console.log(`Found ${tags.length} tags on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedTags = [];
      
      for (const tag of tags) {
        const tagData = {
          id: tag.id,
          name: tag.name || '',
          description: tag.description || null,
          image: tag.image_path || null,
          favorite: tag.favorite || false,
          ignoreAutoTag: tag.ignore_auto_tag || false,
          lastSyncedAt: new Date()
        };

        // Upsert tag - but first handle potential name conflicts
        // Check if there's another tag with the same name but different ID
        const existingTagWithName = await prisma.stashTag.findUnique({
          where: { name: tag.name }
        });
        
        if (existingTagWithName && existingTagWithName.id !== tag.id) {
          console.log(`⚠️  Name conflict: Tag ${tag.id} has name "${tag.name}", but tag ${existingTagWithName.id} already exists with that name. Deleting old tag.`);
          
          // Delete the conflicting tag and all its relationships
          await prisma.stashTagAlias.deleteMany({
            where: { tagId: existingTagWithName.id }
          });
          
          await prisma.stashTagHierarchy.deleteMany({
            where: {
              OR: [
                { parentTagId: existingTagWithName.id },
                { childTagId: existingTagWithName.id }
              ]
            }
          });
          
          await prisma.stashSceneTag.deleteMany({
            where: { tagId: existingTagWithName.id }
          });
          await prisma.stashPerformerTag.deleteMany({
            where: { tagId: existingTagWithName.id }
          });
          await prisma.stashGalleryTag.deleteMany({
            where: { tagId: existingTagWithName.id }
          });
          await prisma.stashImageTag.deleteMany({
            where: { tagId: existingTagWithName.id }
          });
          
          await prisma.stashTag.delete({
            where: { id: existingTagWithName.id }
          });
        }
        
        const syncedTag = await prisma.stashTag.upsert({
          where: { id: tag.id },
          update: tagData,
          create: tagData
        });
        
        // Sync tag aliases
        if (tag.aliases && tag.aliases.length > 0) {
          // Remove existing aliases
          await prisma.stashTagAlias.deleteMany({
            where: { tagId: tag.id }
          });
          
          // Create new aliases
          await prisma.stashTagAlias.createMany({
            data: tag.aliases.map(alias => ({
              tagId: tag.id,
              alias: alias
            }))
          });
        }
        
        // Sync tag hierarchy (parent-child relationships)
        // Handle parent relationships
        if (tag.parents && tag.parents.length > 0) {
          // Remove existing parent relationships
          await prisma.stashTagHierarchy.deleteMany({
            where: { childTagId: tag.id }
          });
          
          // Create new parent relationships
          const validParents = tag.parents.filter(parent => parent && parent.id);
          if (validParents.length > 0) {
            // Check which parent tags exist in database
            const existingParents = await prisma.stashTag.findMany({
              where: {
                id: { in: validParents.map(p => p.id) }
              },
              select: { id: true }
            });
            const existingParentIds = new Set(existingParents.map(p => p.id));
            
            // Only create relationships for existing parent tags
            const validRelationships = validParents
              .filter(parent => existingParentIds.has(parent.id))
              .map(parent => ({
                parentTagId: parent.id,
                childTagId: tag.id
              }));
            
            if (validRelationships.length > 0) {
              await prisma.stashTagHierarchy.createMany({
                data: validRelationships
              });
            }
            
            // Log skipped relationships
            const skippedCount = validParents.length - validRelationships.length;
            if (skippedCount > 0) {
              console.log(`⚠️  Skipped ${skippedCount} parent relationships for tag ${tag.id} (parent tags not yet synced)`);
            }
          }
        }
        
        // Handle child relationships
        if (tag.children && tag.children.length > 0) {
          // Remove existing child relationships
          await prisma.stashTagHierarchy.deleteMany({
            where: { parentTagId: tag.id }
          });
          
          // Create new child relationships
          const validChildren = tag.children.filter(child => child && child.id);
          if (validChildren.length > 0) {
            // Check which child tags exist in database
            const existingChildren = await prisma.stashTag.findMany({
              where: {
                id: { in: validChildren.map(c => c.id) }
              },
              select: { id: true }
            });
            const existingChildIds = new Set(existingChildren.map(c => c.id));
            
            // Only create relationships for existing child tags
            const validRelationships = validChildren
              .filter(child => existingChildIds.has(child.id))
              .map(child => ({
                parentTagId: tag.id,
                childTagId: child.id
              }));
            
            if (validRelationships.length > 0) {
              await prisma.stashTagHierarchy.createMany({
                data: validRelationships
              });
            }
            
            // Log skipped relationships
            const skippedCount = validChildren.length - validRelationships.length;
            if (skippedCount > 0) {
              console.log(`⚠️  Skipped ${skippedCount} child relationships for tag ${tag.id} (child tags not yet synced)`);
            }
          }
        }
        
        syncedTags.push(syncedTag);
      }
      
      console.log(`Synced ${syncedTags.length} tags from page ${page}`);
      return { tags: syncedTags, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing tags:', error);
      throw error;
    }
  }

  async fullSync() {
    console.log('🔄 Starting full Stash sync...');
    const startTime = Date.now();
    
    try {
      await this.ensureConfigLoaded();
      
      let totalSynced = {
        scenes: 0,
        performers: 0,
        studios: 0,
        tags: 0,
        groups: 0,
        galleries: 0,
        images: 0
      };

      // Sync tags first (needed for performers, scenes, and galleries)
      console.log('📋 Syncing tags...');
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await this.syncTags(page);
        totalSynced.tags += result.tags.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.tags.length} tags`);
      }
      console.log(`✅ Tags sync completed: ${totalSynced.tags} total`);

      // Sync studios (needed for scenes and galleries)
      console.log('🏢 Syncing studios...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncStudios(page);
        totalSynced.studios += result.studios.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.studios.length} studios`);
      }
      console.log(`✅ Studios sync completed: ${totalSynced.studios} total`);

      // Sync performers (needed for scenes and galleries)
      console.log('👥 Syncing performers...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncPerformers(page);
        totalSynced.performers += result.performers.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.performers.length} performers`);
      }
      console.log(`✅ Performers sync completed: ${totalSynced.performers} total`);

      // Sync scenes (references performers and studios)
      console.log('🎬 Syncing scenes...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncScenes(page);
        totalSynced.scenes += result.scenes.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.scenes.length} scenes`);
      }
      console.log(`✅ Scenes sync completed: ${totalSynced.scenes} total`);

      // Sync groups/movies (references scenes, studios, and tags)
      console.log('🎬 Syncing groups/movies...');
      page = 1;
      hasMore = true;
      let totalGroups = 0;
      while (hasMore) {
        const result = await this.syncGroups(page);
        totalGroups += result.groups.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.groups.length} groups`);
      }
      console.log(`✅ Groups sync completed: ${totalGroups} total`);
      totalSynced.groups = totalGroups;

      // Sync galleries (references performers and studios)
      console.log('🖼️  Syncing galleries...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncGalleries(page);
        totalSynced.galleries += result.galleries.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.galleries.length} galleries`);
      }
      console.log(`✅ Galleries sync completed: ${totalSynced.galleries} total`);

      // Sync standalone images (not part of any gallery)
      console.log('📸 Syncing standalone images...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncAllImages(page);
        totalSynced.images += result.images.length;
        hasMore = result.hasMore;
        page++;
        console.log(`   Page ${page-1}: ${result.images.length} standalone images`);
      }
      console.log(`✅ Standalone images sync completed: ${totalSynced.images} total`);

      console.log(`✅ Standalone images sync completed: ${totalSynced.images} total`);

      // Cleanup: Remove performers with 0 scenes
      console.log('🧹 Cleaning up performers with 0 scenes...');
      const performersRemoved = await this.cleanupPerformersWithZeroScenes();
      console.log(`✅ Removed ${performersRemoved} performers with 0 scenes`);
      
      // Cleanup: Remove studios with 0 scenes
      console.log('🧹 Cleaning up studios with 0 scenes...');
      const studiosRemoved = await this.cleanupStudiosWithZeroScenes();
      console.log(`✅ Removed ${studiosRemoved} studios with 0 scenes`);

      // Comprehensive cleanup: Remove orphaned entities
      console.log('🧹 Starting comprehensive cleanup of orphaned entities...');
      const cleanupResults = await this.cleanupOrphanedEntities(true);
      console.log(`✅ Comprehensive cleanup completed:`, cleanupResults);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`🎉 Full Stash sync completed in ${duration}s:`, totalSynced);
      
      return totalSynced;
      
    } catch (error) {
      console.error('Error during full Stash sync:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      await this.ensureConfigLoaded();
      
      const query = `
        query {
          version {
            version
            hash
            build_time
          }
        }
      `;

      const data = await this.makeGraphQLRequest(query);
      console.log('Stash connection test successful:', data.version);
      return data.version;
      
    } catch (error) {
      console.error('Stash connection test failed:', error);
      throw error;
    }
  }

  /**
   * Create marker-based clips for a scene
   * Uses markers to define clip boundaries for more intelligent segmentation
   * Replaces any existing clips (marker-based or time-based) with new marker-based clips
   */
  async createMarkerBasedClips(scene) {
    try {
      console.log(`🎯 Evaluating marker-based clips for scene: ${scene.title}`);
      
      // Check existing clips - only proceed if they weren't previously created from markers
      const existingClips = await prisma.stashClip.findMany({
        where: { sceneId: scene.id }
      });
      
      if (existingClips.length > 0 && existingClips.some(clip => clip.markerBased)) {
        console.log(`⏭️ Scene already has marker-based clips, skipping: ${scene.title}`);
        return;
      }

      // Get the scene's markers sorted by time
      const markers = scene.scene_markers.sort((a, b) => a.seconds - b.seconds);
      
      if (markers.length < 4) {
        console.log(`⚠️ Scene has only ${markers.length} markers (minimum 4 required), skipping: ${scene.title}`);
        return;
      }

      // Get scene duration (from files)
      const sceneDuration = scene.files && scene.files.length > 0 ? scene.files[0].duration : null;
      
      if (!sceneDuration) {
        console.log(`No duration info for scene: ${scene.title}, skipping clip creation`);
        return;
      }

      console.log(`🎯 Creating marker-based clips for scene: ${scene.title} (${markers.length} markers)`);
      
      // Remove existing clips (they were not marker-based)
      if (existingClips.length > 0) {
        console.log(`🗑️ Removing ${existingClips.length} existing non-marker clips for scene: ${scene.title}`);
        await prisma.stashClip.deleteMany({
          where: { sceneId: scene.id }
        });
      }

      const clipsToCreate = [];
      
      for (let i = 0; i < markers.length; i++) {
        const currentMarker = markers[i];
        const nextMarker = markers[i + 1];
        
        // Calculate clip boundaries
        const startTime = currentMarker.seconds;
        const endTime = nextMarker ? nextMarker.seconds : sceneDuration;
        const duration = endTime - startTime;
        
        // Only create clips that are at least 5 seconds long
        if (duration >= 5) {
          clipsToCreate.push({
            sceneId: scene.id,
            startTime: startTime,
            endTime: endTime,
            duration: duration,
            clipIndex: i,
            watched: false,
            title: currentMarker.title || `Clip ${i + 1}`,
            markerBased: true // Flag to indicate this is marker-based
          });
        }
      }

      if (clipsToCreate.length > 0) {
        // Bulk create clips
        await prisma.stashClip.createMany({
          data: clipsToCreate
        });
        
        console.log(`✅ Created ${clipsToCreate.length} marker-based clips for scene: ${scene.title}`);
        if (existingClips.length > 0) {
          console.log(`🔄 Replaced ${existingClips.length} existing time-based clips with ${clipsToCreate.length} marker-based clips`);
        }
      } else {
        console.log(`⚠️ No valid clips could be created from markers for scene: ${scene.title}`);
      }
      
    } catch (error) {
      console.error(`Error creating marker-based clips for scene ${scene.title}:`, error);
    }
  }

  async syncAllImages(page = 1, perPage = 250) {
    console.log(`Syncing all images (page ${page})...`);
    
    const query = `
      query FindImages($filter: FindFilterType!) {
        findImages(filter: $filter) {
          count
          images {
            id
            title
            code
            date
            details
            photographer
            url
            rating100
            organized
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
            galleries {
              id
            }
            paths {
              thumbnail
              preview
              image
            }
            files {
              id
              path
              mod_time
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: perPage,
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const images = data.findImages?.images || [];
      const count = data.findImages?.count || 0;
      
      console.log(`Found ${images.length} images on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedImages = [];
      
      // Pre-load all existing entities for batch validation
      const allExistingGalleries = await prisma.stashGallery.findMany({
        select: { id: true }
      });
      const galleryIds = new Set(allExistingGalleries.map(g => g.id));
      
      const allExistingStudios = await prisma.stashStudio.findMany({
        select: { id: true }
      });
      const studioIds = new Set(allExistingStudios.map(s => s.id));
      
      const allExistingPerformers = await prisma.stashPerformer.findMany({
        select: { id: true }
      });
      const performerIds = new Set(allExistingPerformers.map(p => p.id));
      
      const allExistingTags = await prisma.stashTag.findMany({
        select: { id: true }
      });
      const tagIds = new Set(allExistingTags.map(t => t.id));
      
      console.log(`🔧 Pre-loaded validation data: ${galleryIds.size} galleries, ${studioIds.size} studios, ${performerIds.size} performers, ${tagIds.size} tags`);
      
      for (const image of images) {
        // Skip images that have "zzHide" tag
        // Determine if image is part of a gallery
        const galleryId = image.galleries && image.galleries.length > 0 ? image.galleries[0].id : null;
        const imageType = galleryId ? 'gallery' : 'standalone';
        
        const imagePath = image.files && image.files.length > 0 ? image.files[0].path : null;
        
        // Validate foreign key references before creating image data
        let validatedGalleryId = null;
        let validatedStudioId = null;
        
        // Check if gallery exists using pre-loaded data
        if (galleryId) {
          if (galleryIds.has(galleryId)) {
            validatedGalleryId = galleryId;
          } else {
            console.log(`⚠️ Gallery ${galleryId} not found for image ${image.id}, setting galleryId to null`);
          }
        }
        
        // Check if studio exists using pre-loaded data
        if (image.studio?.id) {
          if (studioIds.has(image.studio.id)) {
            validatedStudioId = image.studio.id;
          } else {
            console.log(`⚠️ Studio ${image.studio.id} not found for image ${image.id}, setting studioId to null`);
          }
        }
        
        const imageData = {
          id: image.id,
          galleryId: validatedGalleryId, // Use validated gallery ID or null
          title: image.title || null,
          code: image.code || null,
          date: image.date || null,
          details: image.details || null,
          photographer: image.photographer || null,
          url: image.url || null,
          rating: image.rating100 ? Math.round(image.rating100 / 20) : null, // Convert from 100-scale to 5-star
          organized: image.organized || false,
          studio: image.studio?.name || null,
          studioId: validatedStudioId, // Use validated studio ID or null
          path: imagePath,
          checksum: null, // Will be set from files if available
          fileModTime: image.files && image.files.length > 0 && image.files[0].mod_time ? new Date(image.files[0].mod_time) : null,
          lastSyncedAt: new Date()
        };

        // Upsert image
        const syncedImage = await prisma.stashImage.upsert({
          where: { id: image.id },
          update: imageData,
          create: imageData
        });

        // Sync performers for this image
        if (image.performers && image.performers.length > 0) {
          // Remove existing performer relationships
          await prisma.stashImagePerformer.deleteMany({
            where: { imageId: image.id }
          });

          // Filter valid performers using pre-loaded data
          const validPerformers = image.performers.filter(performer => {
            if (performerIds.has(performer.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping performer relationship - performer ${performer.id} not found for image ${image.id}`);
              return false;
            }
          });

          // Batch create performer relationships
          if (validPerformers.length > 0) {
            await prisma.stashImagePerformer.createMany({
              data: validPerformers.map(performer => ({
                imageId: image.id,
                performerId: performer.id
              }))
            });
          }
        }

        // Sync tags for this image
        if (image.tags && image.tags.length > 0) {
          // Remove existing tag relationships
          await prisma.stashImageTag.deleteMany({
            where: { imageId: image.id }
          });

          // Filter valid tags using pre-loaded data
          const validTags = image.tags.filter(tag => {
            if (tagIds.has(tag.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping tag relationship - tag ${tag.id} not found for image ${image.id}`);
              return false;
            }
          });

          // Batch create tag relationships
          if (validTags.length > 0) {
            await prisma.stashImageTag.createMany({
              data: validTags.map(tag => ({
                imageId: image.id,
                tagId: tag.id
              }))
            });
          }
        }

        syncedImages.push(syncedImage);
      }

      const hasMore = page * perPage < count;
      console.log(`✅ Synced ${syncedImages.length} images (${syncedImages.filter(i => i.galleryId).length} gallery, ${syncedImages.filter(i => !i.galleryId).length} standalone) on page ${page}`);

      return {
        images: syncedImages,
        hasMore,
        total: count,
        page
      };

    } catch (error) {
      console.error('Error syncing images:', error);
      throw error;
    }
  }

  async syncGalleries(page = 1, perPage = 250) {
    console.log(`Syncing galleries (page ${page})...`);
    
    const query = `
      query FindGalleries($filter: FindFilterType!) {
        findGalleries(filter: $filter) {
          count
          galleries {
            id
            title
            code
            date
            details
            photographer
            url
            rating100
            organized
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
            files {
              id
              path
              basename
              parent_folder_id
              zip_file_id
              mod_time
            }
            folder {
              path
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: perPage,
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const galleries = data.findGalleries?.galleries || [];
      const count = data.findGalleries?.count || 0;
      
      console.log(`Found ${galleries.length} galleries on page ${page} of ${Math.ceil(count / perPage)}`);
      
      const syncedGalleries = [];
      
      // Pre-load all existing entities for batch validation
      const allExistingStudios = await prisma.stashStudio.findMany({
        select: { id: true }
      });
      const studioIds = new Set(allExistingStudios.map(s => s.id));
      
      const allExistingPerformers = await prisma.stashPerformer.findMany({
        select: { id: true }
      });
      const performerIds = new Set(allExistingPerformers.map(p => p.id));
      
      const allExistingTags = await prisma.stashTag.findMany({
        select: { id: true }
      });
      const tagIds = new Set(allExistingTags.map(t => t.id));
      
      console.log(`🔧 Pre-loaded validation data: ${studioIds.size} studios, ${performerIds.size} performers, ${tagIds.size} tags`);
      
      for (const gallery of galleries) {
        const galleryPath = gallery.folder?.path || null;
        
        // Validate foreign key references before creating gallery data
        let validatedStudioId = null;
        
        // Check if studio exists using pre-loaded data
        if (gallery.studio?.id) {
          if (studioIds.has(gallery.studio.id)) {
            validatedStudioId = gallery.studio.id;
          } else {
            console.log(`⚠️ Studio ${gallery.studio.id} not found for gallery ${gallery.id}, setting studioId to null`);
          }
        }
        
        const galleryData = {
          id: gallery.id,
          title: gallery.title || '',
          code: gallery.code || null,
          date: gallery.date || null,
          details: gallery.details || null,
          photographer: gallery.photographer || null,
          url: gallery.url || null,
          rating: gallery.rating100 ? Math.round(gallery.rating100 / 20) : null, // Convert from 100-scale to 5-star
          organized: gallery.organized || false,
          studio: gallery.studio?.name || null,
          studioId: validatedStudioId, // Use validated studio ID or null
          path: galleryPath,
          checksum: null, // Not provided in current Stash API
          lastSyncedAt: new Date()
        };

        // Upsert gallery
        const syncedGallery = await prisma.stashGallery.upsert({
          where: { id: gallery.id },
          update: galleryData,
          create: galleryData
        });

        // Sync performers for this gallery
        if (gallery.performers && gallery.performers.length > 0) {
          // Remove existing performer relationships
          await prisma.stashGalleryPerformer.deleteMany({
            where: { galleryId: gallery.id }
          });

          // Filter valid performers using pre-loaded data
          const validPerformers = gallery.performers.filter(performer => {
            if (performerIds.has(performer.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping performer relationship - performer ${performer.id} not found for gallery ${gallery.id}`);
              return false;
            }
          });

          // Batch create performer relationships
          if (validPerformers.length > 0) {
            await prisma.stashGalleryPerformer.createMany({
              data: validPerformers.map(performer => ({
                galleryId: gallery.id,
                performerId: performer.id
              }))
            });
          }
        }

        // Sync tags for this gallery
        if (gallery.tags && gallery.tags.length > 0) {
          // Remove existing tag relationships
          await prisma.stashGalleryTag.deleteMany({
            where: { galleryId: gallery.id }
          });

          // Filter valid tags using pre-loaded data
          const validTags = gallery.tags.filter(tag => {
            if (tagIds.has(tag.id)) {
              return true;
            } else {
              console.log(`⚠️ Skipping tag relationship - tag ${tag.id} not found for gallery ${gallery.id}`);
              return false;
            }
          });

          // Batch create tag relationships
          if (validTags.length > 0) {
            await prisma.stashGalleryTag.createMany({
              data: validTags.map(tag => ({
                galleryId: gallery.id,
                tagId: tag.id
              }))
            });
          }
        }

        // Sync files for this gallery (gallery files are different from standalone images)
        if (gallery.files && gallery.files.length > 0) {
          // For now, we're just storing the gallery metadata
          // File-level processing can be added later if needed
          console.log(`Gallery "${gallery.title || gallery.id}" has ${gallery.files.length} files`);
        }
        
        syncedGalleries.push(syncedGallery);
      }
      
      console.log(`Synced ${syncedGalleries.length} galleries from page ${page}`);
      return { galleries: syncedGalleries, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing galleries:', error);
      throw error;
    }
  }

  async cleanupHiddenGalleries() {
    try {
      console.log('Starting cleanup of galleries with "zzHide" tag...');
      
      // Find galleries that have the "zzHide" tag
      const hiddenGalleries = await prisma.stashGallery.findMany({
        include: {
          tags: true
        }
      });

      let removedCount = 0;
      let imagesRemovedCount = 0;
      
      for (const gallery of hiddenGalleries) {
        if (gallery.tags.some(tag => tag.name === 'zzHide')) {
          // First, delete all images associated with this gallery
          const imagesDeleted = await prisma.stashImage.deleteMany({
            where: { galleryId: gallery.id }
          });
          imagesRemovedCount += imagesDeleted.count;
          
          // Then delete the gallery
          await prisma.stashGallery.delete({
            where: { id: gallery.id }
          });
          removedCount++;
        }
      }

      if (imagesRemovedCount > 0) {
        console.log(`🗑️ Cleaned up ${imagesRemovedCount} images from hidden galleries`);
      }
      
      if (removedCount > 0) {
        console.log(`🗑️ Cleaned up ${removedCount} hidden galleries`);
      } else {
        console.log('✅ No hidden galleries to clean up');
      }
      
      return removedCount;
      
    } catch (error) {
      console.error('Error during hidden galleries cleanup:', error);
      throw error;
    }
  }

  /**
   * Delete a scene from Stash
   * @param {string} sceneId - The ID of the scene to delete
   * @param {boolean} deleteFile - Whether to delete the actual file (default: false)
   * @param {boolean} deleteGenerated - Whether to delete generated files like thumbnails (default: true)
   * @returns {Promise<Object>} Result object with success status
   */
  async deleteScene(sceneId, deleteFile = false, deleteGenerated = true) {
    try {
      await this.ensureConfigLoaded();
      
      console.log(`🗑️ Deleting scene ${sceneId} from Stash (deleteFile: ${deleteFile}, deleteGenerated: ${deleteGenerated})`);
      
      // GraphQL mutation to delete a scene
      const mutation = `
        mutation SceneDestroy($id: ID!, $delete_file: Boolean, $delete_generated: Boolean) {
          sceneDestroy(input: {
            id: $id
            delete_file: $delete_file
            delete_generated: $delete_generated
          })
        }
      `;
      
      const variables = {
        id: sceneId,
        delete_file: deleteFile,
        delete_generated: deleteGenerated
      };
      
      const result = await this.makeGraphQLRequest(mutation, variables);
      
      if (result && result.sceneDestroy !== undefined) {
        console.log(`✅ Scene ${sceneId} deleted from Stash successfully`);
        return {
          success: true,
          deleted: result.sceneDestroy
        };
      } else {
        console.error('❌ Unexpected response from Stash delete mutation:', result);
        return {
          success: false,
          error: 'Unexpected response from Stash API'
        };
      }
      
    } catch (error) {
      console.error(`❌ Error deleting scene ${sceneId} from Stash:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Find duplicate scenes using Stash's built-in phash duplicate checker
   * @param {number} distance - Phash distance threshold (0=exact, 1-4=increasingly permissive)
   * @param {number} durationDiff - Maximum duration difference in seconds (-1=ignore duration)
   * @returns {Promise<Array>} Array of duplicate scene groups
   */
  async findDuplicateScenes(distance = 0, durationDiff = -1) {
    try {
      await this.ensureConfigLoaded();
      
      console.log(`🔍 Finding duplicate scenes (distance: ${distance}, durationDiff: ${durationDiff})`);
      
      const query = `
        query FindDuplicateScenes($distance: Int, $duration_diff: Float) {
          findDuplicateScenes(distance: $distance, duration_diff: $duration_diff) {
            id
            title
            date
            rating100
            organized
            o_counter
            files {
              id
              path
              size
              duration
              width
              height
              video_codec
              frame_rate
              bit_rate
              fingerprints {
                type
                value
              }
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
            paths {
              screenshot
              preview
              stream
            }
          }
        }
      `;
      
      const variables = {
        distance,
        duration_diff: durationDiff
      };
      
      const result = await this.makeGraphQLRequest(query, variables);
      const duplicateGroups = result.findDuplicateScenes || [];
      
      console.log(`✅ Found ${duplicateGroups.length} duplicate scene groups`);
      
      // Log details about each group for debugging
      duplicateGroups.forEach((group, idx) => {
        console.log(`   Group ${idx + 1}: ${group.length} scenes`);
        group.forEach((scene) => {
          const phash = scene.files?.[0]?.fingerprints?.find(fp => fp.type === 'phash')?.value;
          const duration = scene.files?.[0]?.duration;
          console.log(`     - Scene ${scene.id}: "${scene.title || 'Untitled'}" (phash: ${phash?.substring(0, 16)}..., duration: ${duration}s)`);
        });
      });
      
      return {
        success: true,
        groups: duplicateGroups,
        totalGroups: duplicateGroups.length,
        totalScenes: duplicateGroups.reduce((sum, group) => sum + group.length, 0)
      };
      
    } catch (error) {
      console.error(`❌ Error finding duplicate scenes:`, error);
      return {
        success: false,
        error: error.message,
        groups: [],
        totalGroups: 0,
        totalScenes: 0
      };
    }
  }

  async syncGroups(page = 1, perPage = 250) {
    console.log(`Syncing groups/movies (page ${page})...`);
    
    const query = `
      query FindMovies($filter: FindFilterType!) {
        findMovies(filter: $filter) {
          count
          movies {
            id
            name
            aliases
            duration
            date
            rating100
            director
            synopsis
            url
            front_image_path
            back_image_path
            studio {
              id
              name
            }
            scenes {
              id
              title
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
        page,
        per_page: perPage,
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      const groups = data.findMovies?.movies || [];
      const count = data.findMovies?.count || 0;
      
      console.log(`Found ${groups.length} groups on page ${page} of ${Math.ceil(count / perPage)}`);
      
      // Pre-load existing studios for validation
      const allExistingStudios = await prisma.stashStudio.findMany({
        select: { id: true }
      });
      const studioIds = new Set(allExistingStudios.map(s => s.id));
      
      // Pre-load existing scenes for validation
      const allExistingScenes = await prisma.stashScene.findMany({
        select: { id: true }
      });
      const sceneIds = new Set(allExistingScenes.map(s => s.id));
      
      // Pre-load existing tags for validation
      const allExistingTags = await prisma.stashTag.findMany({
        select: { id: true }
      });
      const tagIds = new Set(allExistingTags.map(t => t.id));
      
      console.log(`🔧 Pre-loaded validation data: ${studioIds.size} studios, ${sceneIds.size} scenes, ${tagIds.size} tags`);
      
      const syncedGroups = [];
      
      for (const group of groups) {
        // Validate studio reference
        let validatedStudioId = null;
        if (group.studio?.id) {
          if (studioIds.has(group.studio.id)) {
            validatedStudioId = group.studio.id;
          } else {
            console.log(`⚠️ Studio ${group.studio.id} not found for group ${group.id}, setting studioId to null`);
          }
        }
        
        const groupData = {
          id: group.id,
          name: group.name || 'Untitled Group',
          aliases: group.aliases || null,
          duration: group.duration || null,
          date: group.date || null,
          rating: group.rating100 || null,
          director: group.director || null,
          synopsis: group.synopsis || null,
          url: group.url || null,
          frontImage: group.front_image_path || null,
          backImage: group.back_image_path || null,
          studioId: validatedStudioId,
          lastSyncedAt: new Date()
        };

        // Upsert group
        const syncedGroup = await prisma.stashGroup.upsert({
          where: { id: group.id },
          update: groupData,
          create: groupData
        });
        
        // Sync group-scene relationships
        if (group.scenes && group.scenes.length > 0) {
          // Delete old relationships
          await prisma.stashGroupScene.deleteMany({
            where: { groupId: group.id }
          });
          
          // Create new relationships with scene order
          for (let i = 0; i < group.scenes.length; i++) {
            const scene = group.scenes[i];
            
            // Validate scene exists
            if (!sceneIds.has(scene.id)) {
              console.log(`⚠️ Scene ${scene.id} not found in database, skipping for group ${group.id}`);
              continue;
            }
            
            await prisma.stashGroupScene.create({
              data: {
                groupId: group.id,
                sceneId: scene.id,
                sceneIndex: i
              }
            });
          }
        }
        
        // Sync group-tag relationships
        if (group.tags && group.tags.length > 0) {
          // Delete old relationships
          await prisma.stashGroupTag.deleteMany({
            where: { groupId: group.id }
          });
          
          // Create new relationships
          for (const tag of group.tags) {
            // Validate tag exists
            if (!tagIds.has(tag.id)) {
              console.log(`⚠️ Tag ${tag.id} not found in database, skipping for group ${group.id}`);
              continue;
            }
            
            await prisma.stashGroupTag.create({
              data: {
                groupId: group.id,
                tagId: tag.id
              }
            });
          }
        }
        
        syncedGroups.push(syncedGroup);
      }
      
      console.log(`Synced ${syncedGroups.length} groups from page ${page}`);
      return { 
        groups: syncedGroups, 
        hasMore: (page * perPage) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing groups:', error);
      throw error;
    }
  }

  async updateScene(sceneId, updates) {
    console.log('🔧 [updateScene] Starting scene update...');
    console.log('   - Scene ID (raw):', sceneId, 'Type:', typeof sceneId);
    console.log('   - Updates (raw):', JSON.stringify(updates, null, 2));
    
    try {
      console.log('   - Loading configuration...');
      await this.ensureConfigLoaded();
      console.log('   - Configuration loaded. Stash URL:', this.stashUrl);
      
      // Build the mutation for updating scene
      const mutation = `
        mutation SceneUpdate($input: SceneUpdateInput!) {
          sceneUpdate(input: $input) {
            id
            title
            studio {
              id
              name
            }
            performers {
              id
              name
            }
            groups {
              group {
                id
                name
              }
              scene_index
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

      // Build the input object with only provided fields
      // NOTE: Stash expects IDs as strings, not integers
      const input = { id: String(sceneId) };
      if (updates.title !== undefined) input.title = updates.title;
      if (updates.studioId !== undefined) {
        input.studio_id = String(updates.studioId);
      }
      if (updates.performerIds !== undefined && Array.isArray(updates.performerIds)) {
        input.performer_ids = updates.performerIds.map(id => String(id));
      }
      if (updates.tagIds !== undefined && Array.isArray(updates.tagIds)) {
        input.tag_ids = updates.tagIds.map(id => String(id));
        console.log(`   - Setting ${input.tag_ids.length} tag(s) for scene`, input.tag_ids);
      }
      if (updates.groupIds !== undefined && Array.isArray(updates.groupIds)) {
        // Get all existing groups for this scene first to preserve scene_index
        const existingGroups = await this.prisma.stashGroupScene.findMany({
          where: { sceneId: String(sceneId) },
          orderBy: { sceneIndex: 'asc' }
        });
        
        // Build groups array with SceneGroupInput format: { group_id, scene_index }
        // Stash requires the full groups array, not just IDs
        const groupsMap = new Map();
        
        // First, add existing groups with their scene indices
        existingGroups.forEach(eg => {
          groupsMap.set(eg.groupId, { group_id: String(eg.groupId), scene_index: eg.sceneIndex });
        });
        
        // Then add new groups - use provided scene numbers if available (from AEBN)
        let nextIndex = existingGroups.length > 0 
          ? Math.max(...existingGroups.map(g => g.sceneIndex)) + 1 
          : 0;
        
        updates.groupIds.forEach((groupId, idx) => {
          if (!groupsMap.has(groupId)) {
            // Check if scene number is provided for this group
            let sceneIndex;
            if (updates.sceneNumbers && Array.isArray(updates.sceneNumbers) && 
                updates.sceneNumbers[idx] !== null && updates.sceneNumbers[idx] !== undefined) {
              sceneIndex = parseInt(updates.sceneNumbers[idx]);
              console.log(`   - Using provided scene number ${sceneIndex} for group ${groupId}`);
            } else {
              sceneIndex = nextIndex++;
              console.log(`   - Auto-calculated scene index ${sceneIndex} for group ${groupId}`);
            }
            groupsMap.set(groupId, { group_id: String(groupId), scene_index: sceneIndex });
          }
        });
        
        input.groups = Array.from(groupsMap.values());
        console.log(`   - Setting ${input.groups.length} groups for scene (${updates.groupIds.length} new)`, input.groups);
      }
      if (updates.details !== undefined) input.details = updates.details;
      if (updates.date !== undefined) {
        // Sanitize date string - extract just the date portion (YYYY-MM-DD)
        let cleanDate = updates.date;
        if (typeof cleanDate === 'string') {
          // Remove HTML tags, newlines, and extra whitespace
          cleanDate = cleanDate.replace(/<[^>]*>/g, '').replace(/\n/g, ' ').trim();
          
          // Extract first valid date in YYYY-MM-DD format
          const dateMatch = cleanDate.match(/\d{4}-\d{2}-\d{2}/);
          if (dateMatch) {
            cleanDate = dateMatch[0];
            console.log(`   - Sanitized date from "${updates.date.substring(0, 50)}..." to "${cleanDate}"`);
          } else {
            console.warn(`   - Could not extract valid date from: "${cleanDate}"`);
            cleanDate = null; // Don't send invalid date
          }
        }
        if (cleanDate) {
          input.date = cleanDate;
        }
      }
      if (updates.url !== undefined || updates.episodeUrls !== undefined) {
        // Fetch existing URLs from Stash to preserve them
        console.log('   - Fetching existing URLs from Stash...');
        const existingSceneQuery = `
          query FindScene($id: ID!) {
            findScene(id: $id) {
              urls
            }
          }
        `;
        
        const existingSceneData = await this.makeGraphQLRequest(existingSceneQuery, { id: String(sceneId) });
        const existingUrls = existingSceneData?.findScene?.urls || [];
        console.log(`   - Found ${existingUrls.length} existing URL(s) in Stash:`, existingUrls);
        
        // Build merged urls array, avoiding duplicates
        const urlsSet = new Set(existingUrls);
        
        if (updates.url) {
          console.log(`   - Adding main URL: ${updates.url}`);
          urlsSet.add(updates.url);
        }
        
        if (updates.episodeUrls && Array.isArray(updates.episodeUrls)) {
          console.log(`   - Adding ${updates.episodeUrls.length} episode URL(s):`, updates.episodeUrls);
          updates.episodeUrls.forEach(url => urlsSet.add(url));
        }
        
        const urlsArray = Array.from(urlsSet);
        input.urls = urlsArray;
        console.log(`   - Final ${urlsArray.length} URL(s) in Stash (${existingUrls.length} existing + ${urlsArray.length - existingUrls.length} new):`, urlsArray);
      }
      if (updates.coverImage !== undefined) {
        // If coverImage is a relative proxy URL, convert to original GEVI URL
        if (updates.coverImage.startsWith('/api/stash/gevi-image-proxy')) {
          // Extract the GEVI URL from the proxy path
          const urlMatch = updates.coverImage.match(/url=([^&]+)/);
          if (urlMatch) {
            const geviImageUrl = decodeURIComponent(urlMatch[1]);
            console.log('   - Converting proxy URL to original GEVI URL:', geviImageUrl);
            input.cover_image = geviImageUrl;
          } else {
            console.warn('   - Could not extract GEVI URL from proxy path, using as-is');
            input.cover_image = updates.coverImage;
          }
        } else {
          input.cover_image = updates.coverImage;
        }
      }

      const variables = { input };

      console.log('📝 [updateScene] GraphQL mutation prepared:');
      console.log('   - Input:', JSON.stringify(input, null, 2));
      console.log('   - Variables:', JSON.stringify(variables, null, 2));
      console.log('   - Making GraphQL request to:', this.stashUrl + '/graphql');
      
      const result = await this.makeGraphQLRequest(mutation, variables);
      
      console.log('📥 [updateScene] GraphQL response received:');
      console.log('   - Full result:', JSON.stringify(result, null, 2));

      if (result?.sceneUpdate) {
        console.log(`✅ [updateScene] Scene ${sceneId} updated in Stash successfully!`);
        console.log('   - Updated scene data:', JSON.stringify(result.sceneUpdate, null, 2));
        return {
          success: true,
          scene: result.sceneUpdate
        };
      } else {
        console.error('❌ [updateScene] Unexpected response structure from Stash:');
        console.error('   - Expected "sceneUpdate" property in result');
        console.error('   - Received:', JSON.stringify(result, null, 2));
        return {
          success: false,
          error: 'Unexpected response from Stash API - no sceneUpdate in result'
        };
      }
      
    } catch (error) {
      console.error(`❌ Error updating scene ${sceneId} in Stash:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update a tag in Stash
   */
  async updateTag(tagId, updates) {
    console.log(`📝 [updateTag] Updating tag ${tagId} in Stash...`);

    try {
      const mutation = `
        mutation TagUpdate($input: TagUpdateInput!) {
          tagUpdate(input: $input) {
            id
            name
            aliases
          }
        }
      `;

      const input = {
        id: String(tagId)
      };

      if (updates.aliases !== undefined) {
        input.aliases = updates.aliases;
      }

      const variables = { input };

      console.log('   - Input:', JSON.stringify(input, null, 2));

      const result = await this.makeGraphQLRequest(mutation, variables);

      if (result?.tagUpdate) {
        console.log(`✅ [updateTag] Tag ${tagId} updated in Stash successfully!`);
        return {
          success: true,
          tag: result.tagUpdate
        };
      } else {
        console.error('❌ [updateTag] Unexpected response from Stash:', result);
        return {
          success: false,
          error: 'Unexpected response from Stash API'
        };
      }

    } catch (error) {
      console.error(`❌ Error updating tag ${tagId} in Stash:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Merge one tag into another in Stash
   */
  async tagMerge(sourceTagId, destinationTagId) {
    console.log(`🔄 [tagMerge] Merging tag ${sourceTagId} into ${destinationTagId} in Stash...`);

    try {
      const mutation = `
        mutation TagMerge($source: ID!, $destination: ID!) {
          tagMerge(source: $source, destination: $destination) {
            id
            name
            aliases
          }
        }
      `;

      const variables = {
        source: String(sourceTagId),
        destination: String(destinationTagId)
      };

      console.log('   - Variables:', JSON.stringify(variables, null, 2));

      const result = await this.makeGraphQLRequest(mutation, variables);

      if (result?.tagMerge) {
        console.log(`✅ [tagMerge] Tag ${sourceTagId} merged into ${destinationTagId} successfully!`);
        return {
          success: true,
          tag: result.tagMerge
        };
      } else {
        console.error('❌ [tagMerge] Unexpected response from Stash:', result);
        return {
          success: false,
          error: 'Unexpected response from Stash API'
        };
      }

    } catch (error) {
      console.error(`❌ Error merging tags in Stash:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * List all available scrapers in Stash
   * @returns {Promise<Array>} Array of scraper objects
   */
  async listScrapers() {
    console.log('🔍 [listScrapers] Fetching available scrapers from Stash...');

    const query = `
      query ListScrapers($types: [ScrapeContentType!]!) {
        listScrapers(types: $types) {
          id
          name
          scene {
            urls
            supported_scrapes
          }
          performer {
            urls
            supported_scrapes
          }
          gallery {
            urls
            supported_scrapes
          }
          movie {
            urls
            supported_scrapes
          }
        }
      }
    `;

    const variables = {
      types: ['SCENE', 'PERFORMER', 'GALLERY', 'MOVIE']
    };

    try {
      const result = await this.makeGraphQLRequest(query, variables);
      
      if (result?.listScrapers) {
        console.log(`✅ [listScrapers] Found ${result.listScrapers.length} scrapers`);
        return result.listScrapers;
      }
      
      return [];
    } catch (error) {
      console.error('❌ [listScrapers] Error fetching scrapers:', error);
      throw error;
    }
  }

  /**
   * Scrape a URL using Stash's native scrapers
   * @param {string} url - URL to scrape
   * @param {string} type - Type of content (Scene, Performer, Gallery, Movie)
   * @returns {Promise<Object>} Scraped content
   */
  async scrapeURL(url, type = 'Scene') {
    console.log(`🔍 [scrapeURL] Scraping ${type} from URL: ${url}`);

    const query = `
      query ScrapeURL($url: String!, $type: ScrapeContentType!) {
        scrapeURL(url: $url, ty: $type) {
          ... on ScrapedScene {
            title
            details
            url
            date
            image
            studio {
              name
              url
            }
            tags {
              name
            }
            performers {
              name
              url
            }
            movies {
              name
              url
            }
            scene_duration: duration
          }
          ... on ScrapedPerformer {
            name
            url
            gender
            birthdate
            ethnicity
            country
            eye_color
            height
            measurements
            fake_tits
            career_length
            tattoos
            piercings
            aliases
            twitter
            instagram
            images
            details
            death_date
            hair_color
            weight
            tags {
              name
            }
          }
          ... on ScrapedGallery {
            title
            url
            date
            details
            studio {
              name
              url
            }
            tags {
              name
            }
            performers {
              name
              url
            }
          }
          ... on ScrapedMovie {
            name
            url
            date
            movie_duration: duration
            synopsis
            studio {
              name
              url
            }
            front_image
            back_image
            director
          }
        }
      }
    `;

    const variables = {
      url,
      type: type.toUpperCase()
    };

    try {
      const result = await this.makeGraphQLRequest(query, variables);
      
      console.log(`🔍 [scrapeURL] Raw result:`, JSON.stringify(result, null, 2));
      
      if (result?.scrapeURL) {
        console.log(`✅ [scrapeURL] Successfully scraped ${type} from URL`);
        return result.scrapeURL;
      }
      
      return null;
    } catch (error) {
      console.error('❌ [scrapeURL] Error scraping URL:', error);
      throw error;
    }
  }

  /**
   * Scrape a single scene using Stash scrapers
   * @param {Object} input - Scrape input (query, scene_id, or scene_input)
   * @param {Object} source - Scraper source (scraper_id or stash_box_endpoint)
   * @returns {Promise<Array>} Array of scraped scenes
   */
  async scrapeSingleScene(input, source) {
    console.log('🔍 [scrapeSingleScene] Scraping scene with input:', input);

    const query = `
      query ScrapeSingleScene($source: ScraperSourceInput!, $input: ScrapeSingleSceneInput!) {
        scrapeSingleScene(source: $source, input: $input) {
          title
          details
          url
          urls
          date
          image
          studio {
            name
            url
          }
          tags {
            name
          }
          performers {
            name
            url
          }
          movies {
            name
            url
          }
          scene_duration: duration
        }
      }
    `;

    const variables = { source, input };

    try {
      const result = await this.makeGraphQLRequest(query, variables);
      
      if (result?.scrapeSingleScene) {
        console.log(`✅ [scrapeSingleScene] Found ${result.scrapeSingleScene.length} results`);
        return result.scrapeSingleScene;
      }
      
      return [];
    } catch (error) {
      console.error('❌ [scrapeSingleScene] Error scraping scene:', error);
      throw error;
    }
  }

  async scrapeSinglePerformer(source, input, filterMaleOnly = false) {
    console.log('🔍 [scrapeSinglePerformer] Scraping performer with input:', input);
    console.log(`   - Source:`, JSON.stringify(source));
    console.log(`   - Male-only filter: ${filterMaleOnly}`);

    const query = `
      query ScrapeSinglePerformer($source: ScraperSourceInput!, $input: ScrapeSinglePerformerInput!) {
        scrapeSinglePerformer(source: $source, input: $input) {
          name
          disambiguation
          gender
          url
          twitter
          instagram
          birthdate
          ethnicity
          country
          eye_color
          height
          measurements
          fake_tits
          career_length
          tattoos
          piercings
          aliases
          images
          details
          death_date
          hair_color
          weight
          remote_site_id
          tags {
            name
          }
          penis_length
          circumcised
        }
      }
    `;

    const variables = { source, input };

    try {
      const result = await this.makeGraphQLRequest(query, variables);
      
      console.log('🔍 [scrapeSinglePerformer] Raw GraphQL result:', JSON.stringify(result, null, 2));
      
      if (result?.scrapeSinglePerformer) {
        let performers = result.scrapeSinglePerformer;
        
        console.log(`🔍 [scrapeSinglePerformer] Parsed ${performers.length} performer(s)`);
        performers.forEach((p, idx) => {
          console.log(`   - Performer ${idx + 1}: ${p.name || 'NO NAME'} (${Object.keys(p).filter(k => p[k]).length} fields populated)`);
        });
        
        // Only filter to male performers if explicitly requested (stash-box)
        if (filterMaleOnly) {
          performers = performers.filter(p => 
            p.gender && p.gender.toLowerCase() === 'male'
          );
          console.log(`✅ [scrapeSinglePerformer] Found ${result.scrapeSinglePerformer.length} results, ${performers.length} male`);
        } else {
          console.log(`✅ [scrapeSinglePerformer] Found ${performers.length} results (no gender filter)`);
        }
        
        return performers;
      }
      
      return [];
    } catch (error) {
      console.error('❌ [scrapeSinglePerformer] Error scraping performer:', error);
      throw error;
    }
  }

  async scrapePerformerURL(scraperId, input) {
    console.log('🔍 [scrapePerformerURL] Scraping performer with scraper:', scraperId);

    const query = `
      query ScrapePerformerURL($url: String!) {
        scrapePerformerURL(url: $url) {
          name
          disambiguation
          gender
          url
          twitter
          instagram
          birthdate
          ethnicity
          country
          eye_color
          height
          measurements
          fake_tits
          career_length
          tattoos
          piercings
          aliases
          images
          details
          death_date
          hair_color
          weight
          tags {
            name
          }
        }
      }
    `;

    const variables = { 
      url: input.query || ''
    };

    try {
      const result = await this.makeGraphQLRequest(query, variables);
      
      if (result?.scrapePerformerURL) {
        const performers = Array.isArray(result.scrapePerformerURL) ? result.scrapePerformerURL : [result.scrapePerformerURL];
        // Filter to only male performers
        const malePerformers = performers.filter(p => 
          p.gender && p.gender.toLowerCase() === 'male'
        );
        console.log(`✅ [scrapePerformerURL] Found ${performers.length} results, ${malePerformers.length} male`);
        return malePerformers;
      }
      
      return [];
    } catch (error) {
      console.error('❌ [scrapePerformerURL] Error scraping performer:', error);
      throw error;
    }
  }

  /**
   * Reload Stash scrapers configuration
   * @returns {Promise<boolean>} Success status
   */
  async reloadScrapers() {
    console.log('🔄 [reloadScrapers] Reloading Stash scrapers...');

    const mutation = `
      mutation ReloadScrapers {
        reloadScrapers
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(mutation);
      
      if (result?.reloadScrapers) {
        console.log('✅ [reloadScrapers] Scrapers reloaded successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('❌ [reloadScrapers] Error reloading scrapers:', error);
      throw error;
    }
  }

  /**
   * Get Stash configuration including stash-box endpoints
   * @returns {Promise<Object>} Configuration object
   */
  async getConfiguration() {
    console.log('🔍 [getConfiguration] Fetching Stash configuration...');

    const query = `
      query Configuration {
        configuration {
          general {
            stashBoxes {
              name
              endpoint
            }
          }
        }
      }
    `;

    try {
      const result = await this.makeGraphQLRequest(query);
      
      if (result?.configuration?.general) {
        const stashBoxCount = result.configuration.general.stashBoxes?.length || 0;
        console.log(`✅ [getConfiguration] Found ${stashBoxCount} stash-box endpoint(s)`);
        return {
          stashBoxes: result.configuration.general.stashBoxes || []
        };
      }
      
      return { stashBoxes: [] };
    } catch (error) {
      console.error('❌ [getConfiguration] Error fetching configuration:', error);
      throw error;
    }
  }
}

module.exports = StashSyncService;
