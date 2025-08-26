// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client

class StashSyncService {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.stashUrl = null;
    this.stashApiKey = null;
  }

  async ensureConfigLoaded() {
    if (!this.stashUrl) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.stashUrl = settings?.stashUrl;
      this.stashApiKey = settings?.stashApiKey; // Optional
      
      if (!this.stashUrl) {
        throw new Error('Stash URL not configured. Please set it in the Settings page.');
      }
    }
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
    
    console.log(`Making Stash GraphQL request to: ${graphqlUrl}`);
    
    try {
      const response = await fetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Stash GraphQL request failed: ${response.status} ${response.statusText}. Response: ${errorText}`);
      }
      
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON response from Stash GraphQL endpoint, but got ${contentType}. Response: ${responseText.substring(0, 200)}...`);
      }
      
      const jsonData = await response.json();
      
      if (jsonData.errors) {
        throw new Error(`Stash GraphQL error: ${JSON.stringify(jsonData.errors)}`);
      }
      
      return jsonData.data;
    } catch (error) {
      if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`Cannot connect to Stash server at ${graphqlUrl}. Please verify the Stash URL is correct and the server is running.`);
      }
      throw error;
    }
  }

  async syncScenes(page = 1, perPage = 100) {
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
      
      for (const scene of scenes) {
        // Skip scenes with "zzHide" tag
        if (scene.tags && scene.tags.some(tag => tag.name === 'zzHide')) {
          console.log(`Skipping scene "${scene.title}" with zzHide tag`);
          continue;
        }

        // Extract file information from the files array
        const primaryFile = scene.files && scene.files.length > 0 ? scene.files[0] : null;
        const osHash = primaryFile?.fingerprints?.find(fp => fp.type === 'oshash')?.value || null;
        const checksum = primaryFile?.fingerprints?.find(fp => fp.type === 'md5')?.value || null;
        
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
          studio: scene.studio?.name || null,
          studioId: scene.studio?.id || null,
          code: scene.code || null,
          director: scene.director || null,
          synopsis: null, // Not available in current Stash API
          // Play status fields
          lastPlayedAt: scene.last_played_at ? new Date(scene.last_played_at) : null,
          resumeTime: scene.resume_time || null,
          playDuration: scene.play_duration || null,
          playCount: scene.play_count || null,
          duration: primaryFile?.duration || null,
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
          // Remove existing performer relationships
          await prisma.stashScenePerformer.deleteMany({
            where: { sceneId: scene.id }
          });

          // Add new performer relationships
          for (const performer of scene.performers) {
            await prisma.stashScenePerformer.create({
              data: {
                sceneId: scene.id,
                performerId: performer.id
              }
            });
          }
        }

        // Sync tags for this scene
        if (scene.tags && scene.tags.length > 0) {
          // Remove existing tag relationships
          await prisma.stashSceneTag.deleteMany({
            where: { sceneId: scene.id }
          });

          // Add new tag relationships
          for (const tag of scene.tags) {
            await prisma.stashSceneTag.create({
              data: {
                sceneId: scene.id,
                tagId: tag.id
              }
            });
          }
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
      for (const scene of hiddenScenes) {
        if (scene.tags.some(tag => tag.name === 'zzHide')) {
          await prisma.stashScene.delete({
            where: { id: scene.id }
          });
          removedCount++;
        }
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

  async syncPerformers(page = 1, perPage = 100) {
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
            ethnicity
            country
            eye_color
            height_cm
            measurements
            fake_tits
            career_length
            tattoos
            piercings
            image_path
            instagram
            twitter
            url
            scene_count
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
      
      for (const performer of performers) {
        // Skip performers with 0 scenes
        if (performer.scene_count === 0) {
          console.log(`Skipping performer ${performer.name} (0 scenes)`);
          continue;
        }

        const performerData = {
          id: performer.id,
          name: performer.name || '',
          disambiguation: performer.disambiguation || null,
          alias: performer.alias_list ? performer.alias_list.join(', ') : null,
          favorite: performer.favorite || false,
          ignore_auto_tag: performer.ignore_auto_tag || false,
          birthdate: performer.birthdate || null,
          ethnicity: performer.ethnicity || null,
          country: performer.country || null,
          eye_color: performer.eye_color || null,
          height: performer.height_cm ? `${performer.height_cm} cm` : null,
          measurements: performer.measurements || null,
          fake_tits: performer.fake_tits || null,
          career_length: performer.career_length || null,
          tattoos: performer.tattoos || null,
          piercings: performer.piercings || null,
          image: performer.image_path || null,
          instagram: performer.instagram || null,
          twitter: performer.twitter || null,
          url: performer.url || null,
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

          // Add new tag relationships
          for (const tag of performer.tags) {
            await prisma.stashPerformerTag.create({
              data: {
                performerId: performer.id,
                tagId: tag.id
              }
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

  async syncStudios(page = 1, perPage = 100) {
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
        // Skip studios with 0 scenes
        if (studio.scene_count === 0) {
          console.log(`Skipping studio ${studio.name} (0 scenes)`);
          continue;
        }

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
        
        syncedStudios.push(syncedStudio);
      }
      
      console.log(`Synced ${syncedStudios.length} studios from page ${page}`);
      return { studios: syncedStudios, hasMore: (page * perPage) < count, totalCount: count };
      
    } catch (error) {
      console.error('Error syncing studios:', error);
      throw error;
    }
  }

  async syncTags(page = 1, perPage = 100) {
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
          lastSyncedAt: new Date()
        };

        // Upsert tag
        const syncedTag = await prisma.stashTag.upsert({
          where: { id: tag.id },
          update: tagData,
          create: tagData
        });
        
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
    console.log('Starting full Stash sync...');
    const startTime = Date.now();
    
    try {
      await this.ensureConfigLoaded();
      
      let totalSynced = {
        scenes: 0,
        performers: 0,
        studios: 0,
        tags: 0
      };

      // Sync tags first (needed for performers and scenes)
      console.log('Syncing tags...');
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await this.syncTags(page);
        totalSynced.tags += result.tags.length;
        hasMore = result.hasMore;
        page++;
      }

      // Sync studios (needed for scenes)
      console.log('Syncing studios...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncStudios(page);
        totalSynced.studios += result.studios.length;
        hasMore = result.hasMore;
        page++;
      }

      // Sync performers (needed for scenes)
      console.log('Syncing performers...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncPerformers(page);
        totalSynced.performers += result.performers.length;
        hasMore = result.hasMore;
        page++;
      }

      // Sync scenes (references performers and studios)
      console.log('Syncing scenes...');
      page = 1;
      hasMore = true;
      while (hasMore) {
        const result = await this.syncScenes(page);
        totalSynced.scenes += result.scenes.length;
        hasMore = result.hasMore;
        page++;
      }

      // Cleanup: Remove scenes with "zzHide" tag
      console.log('Cleaning up scenes with "zzHide" tag...');
      const hiddenScenesRemoved = await this.cleanupHiddenScenes();
      console.log(`Removed ${hiddenScenesRemoved} scenes with "zzHide" tag`);

      // Cleanup: Remove performers with 0 scenes
      console.log('Cleaning up performers with 0 scenes...');
      const performersRemoved = await this.cleanupPerformersWithZeroScenes();
      console.log(`Removed ${performersRemoved} performers with 0 scenes`);
      
      // Cleanup: Remove studios with 0 scenes
      console.log('Cleaning up studios with 0 scenes...');
      const studiosRemoved = await this.cleanupStudiosWithZeroScenes();
      console.log(`Removed ${studiosRemoved} studios with 0 scenes`);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Full Stash sync completed in ${duration}s:`, totalSynced);
      
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
}

module.exports = StashSyncService;
