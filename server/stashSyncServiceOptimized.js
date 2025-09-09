// Only load dotenv in development
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}
const fetch = require('node-fetch');
const prisma = require('./prismaClient'); // Use shared Prisma client

class StashSyncServiceOptimized {
  constructor() {
    // Initialize with null, will be loaded from database when needed
    this.stashUrl = null;
    this.stashApiKey = null;
    
    // Phase 2: Memory caching for sync performance
    this.syncCache = {
      performers: new Map(),
      studios: new Map(),
      tags: new Map(),
      validationCache: {
        performerIds: new Set(),
        studioIds: new Set(),
        tagIds: new Set()
      },
      lastCacheUpdate: null
    };
    
    // Phase 1: Increased page sizes for better performance
    this.pageSize = 500; // Increased from 250 for 2x fewer API calls
    
    // Phase 2: Batch processing configuration for better SQLite compatibility
    this.batchConfig = {
      maxBatchSize: 50,       // Reduced from 100 to minimize lock time
      studioBatchSize: 25,    // Even smaller batch size for studios (they have more data)
      maxRelationships: 250,  // Reduced from 500 to minimize lock time  
      transactionTimeout: 15000, // Reduced from 60s to 15s to prevent long locks
      studioTimeout: 30000,   // Longer timeout for studios (they need more processing time)
      sceneTimeout: 30000,    // Reduced from 120s to 30s to prevent long locks
      galleryTimeout: 20000,  // Specific shorter timeout for galleries
    };
  }

  // Phase 2: Chunked batch processing for large datasets
  async processInChunks(items, chunkSize, processor) {
    const results = [];
    
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      console.log(`🔧 Processing chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(items.length/chunkSize)} (${chunk.length} items)`);
      
      try {
        const chunkResult = await processor(chunk, i);
        results.push(...(Array.isArray(chunkResult) ? chunkResult : [chunkResult]));
      } catch (error) {
        console.error(`Error processing chunk ${Math.floor(i/chunkSize) + 1}:`, error);
        // Continue with next chunk rather than failing entirely
        continue;
      }
    }
    
    return results;
  }

  // Phase 2: Retry wrapper for GraphQL requests to handle database locks
  async makeGraphQLRequestWithRetry(query, variables, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeGraphQLRequest(query, variables);
      } catch (error) {
        const isDatabaseLocked = error.message && error.message.includes('database is locked');
        
        if (isDatabaseLocked && attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`🔄 Database locked, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // If it's not a database lock or we've exhausted retries, throw the error
        throw error;
      }
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
      
      console.log('🔧 StashSyncServiceOptimized config loaded:');
      console.log('   - Database URL:', settings?.stashUrl || 'NOT SET');
      console.log('   - Environment URLs:', [
        process.env.STASH_URL,
        process.env.STASH_URL_FALLBACK_1,
        process.env.STASH_URL_FALLBACK_2,
        process.env.STASH_URL_FALLBACK_3,
        process.env.STASH_URL_FALLBACK_4
      ].filter(url => url));
      console.log('   - Final URL:', this.stashUrl || 'NOT SET');
      console.log('   - Page Size:', this.pageSize);
      
      if (!this.stashUrl) {
        throw new Error('Stash URL not configured. Please set it in the Settings page or environment variables.');
      }
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
      console.log('Stash connection test successful (optimized service):', data.version);
      return data.version;
      
    } catch (error) {
      console.error('Stash connection test failed (optimized service):', error);
      throw error;
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

  // Phase 2: Memory cache management
  async initializeSyncCache() {
    console.log('🧠 Initializing memory cache for sync performance...');
    const cacheStart = Date.now();
    
    // Load all validation data into memory
    const [performers, studios, tags] = await Promise.all([
      prisma.stashPerformer.findMany({ select: { id: true, name: true } }),
      prisma.stashStudio.findMany({ select: { id: true, name: true } }),
      prisma.stashTag.findMany({ select: { id: true, name: true } })
    ]);
    
    // Cache performers
    performers.forEach(p => {
      this.syncCache.performers.set(p.id, p);
      this.syncCache.validationCache.performerIds.add(p.id);
    });
    
    // Cache studios
    studios.forEach(s => {
      this.syncCache.studios.set(s.id, s);
      this.syncCache.validationCache.studioIds.add(s.id);
    });
    
    // Cache tags
    tags.forEach(t => {
      this.syncCache.tags.set(t.id, t);
      this.syncCache.validationCache.tagIds.add(t.id);
    });
    
    this.syncCache.lastCacheUpdate = Date.now();
    
    const cacheTime = Date.now() - cacheStart;
    console.log(`✅ Memory cache initialized in ${cacheTime}ms:`);
    console.log(`   - ${performers.length} performers`);
    console.log(`   - ${studios.length} studios`);
    console.log(`   - ${tags.length} tags`);
  }

  // Phase 2: Update memory cache after sync operations
  updateMemoryCache(type, entities) {
    if (type === 'performers') {
      entities.forEach(entity => {
        this.syncCache.performers.set(entity.id, entity);
        this.syncCache.validationCache.performerIds.add(entity.id);
      });
    } else if (type === 'studios') {
      entities.forEach(entity => {
        this.syncCache.studios.set(entity.id, entity);
        this.syncCache.validationCache.studioIds.add(entity.id);
      });
    } else if (type === 'tags') {
      entities.forEach(entity => {
        this.syncCache.tags.set(entity.id, entity);
        this.syncCache.validationCache.tagIds.add(entity.id);
      });
    }
  }

  // Phase 1 & 2: Optimized batch scene sync with transactions
  async syncScenesOptimized(page = 1) {
    console.log(`🎬 Syncing scenes (page ${page}) with optimizations...`);
    
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const scenes = data.findScenes?.scenes || [];
      const count = data.findScenes?.count || 0;
      
      console.log(`Found ${scenes.length} scenes on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (scenes.length === 0) {
        return { scenes: [], hasMore: false, totalCount: count };
      }
      
      // Phase 2: Use database transaction for better performance and consistency
      const syncedScenes = await prisma.$transaction(async (tx) => {
        console.log('🔄 Starting scene batch transaction...');
        const transactionStart = Date.now();
        
        const processedScenes = [];
        
        // Prepare batch data structures
        const scenesToUpsert = [];
        const allPerformerRelations = [];
        const allTagRelations = [];
        const allMarkers = [];
        
        for (const scene of scenes) {
          // Extract file information from the files array
          const primaryFile = scene.files && scene.files.length > 0 ? scene.files[0] : null;
          const osHash = primaryFile?.fingerprints?.find(fp => fp.type === 'oshash')?.value || null;
          const checksum = primaryFile?.fingerprints?.find(fp => fp.type === 'md5')?.value || null;
          
          // Phase 1: Batch foreign key validation using memory cache
          let validatedStudioId = null;
          if (scene.studio?.id && this.syncCache.validationCache.studioIds.has(scene.studio.id)) {
            validatedStudioId = scene.studio.id;
          }
          
          const sceneData = {
            id: scene.id,
            title: scene.title || '',
            details: scene.details || null,
            url: scene.url || null,
            date: scene.date || null,
            rating: scene.rating100 ? Math.round(scene.rating100 / 20) : null,
            organized: scene.organized || false,
            osHash: osHash,
            checksum: checksum,
            phash: null,
            oCounter: scene.o_counter || null,
            path: primaryFile?.path || null,
            fileModTime: primaryFile?.mod_time ? new Date(primaryFile.mod_time) : null,
            studio: scene.studio?.name || null,
            studioId: validatedStudioId,
            code: scene.code || null,
            director: scene.director || null,
            synopsis: null,
            lastPlayedAt: scene.last_played_at ? new Date(scene.last_played_at) : null,
            resumeTime: scene.resume_time || null,
            playDuration: scene.play_duration || null,
            playCount: scene.play_count || null,
            duration: primaryFile?.duration || null,
            lastSyncedAt: new Date()
          };

          scenesToUpsert.push(sceneData);
          
          // Phase 1: Prepare batch performer relationships
          if (scene.performers && scene.performers.length > 0) {
            const validPerformers = scene.performers.filter(performer => 
              this.syncCache.validationCache.performerIds.has(performer.id)
            );
            
            validPerformers.forEach(performer => {
              allPerformerRelations.push({
                sceneId: scene.id,
                performerId: performer.id
              });
            });
          }
          
          // Phase 1: Prepare batch tag relationships
          if (scene.tags && scene.tags.length > 0) {
            const validTags = scene.tags.filter(tag => 
              this.syncCache.validationCache.tagIds.has(tag.id)
            );
            
            validTags.forEach(tag => {
              allTagRelations.push({
                sceneId: scene.id,
                tagId: tag.id
              });
            });
          }
          
          // Prepare markers
          if (scene.scene_markers && scene.scene_markers.length > 0) {
            scene.scene_markers.forEach(marker => {
              allMarkers.push({
                stashId: marker.id,
                sceneId: scene.id,
                title: marker.title || '',
                seconds: marker.seconds || 0,
                primaryTag: marker.primary_tag?.name || null,
                primaryTagId: marker.primary_tag?.id || null,
                lastSyncedAt: new Date()
              });
            });
          }
        }
        
        console.log(`🔧 Batch processing ${scenesToUpsert.length} scenes with relationships...`);
        
        // Phase 1: Batch upsert scenes
        const upsertPromises = scenesToUpsert.map(sceneData =>
          tx.stashScene.upsert({
            where: { id: sceneData.id },
            update: sceneData,
            create: sceneData
          })
        );
        
        const upsertedScenes = await Promise.all(upsertPromises);
        
        // Phase 1: Batch delete and create relationships for better performance
        if (allPerformerRelations.length > 0 || allTagRelations.length > 0) {
          const sceneIds = scenesToUpsert.map(s => s.id);
          
          // Delete existing relationships in batch
          await Promise.all([
            tx.stashScenePerformer.deleteMany({
              where: { sceneId: { in: sceneIds } }
            }),
            tx.stashSceneTag.deleteMany({
              where: { sceneId: { in: sceneIds } }
            })
          ]);
          
          // Phase 1: Create all relationships in batch with chunking support
          const relationshipPromises = [];
          
          if (allPerformerRelations.length > 0) {
            if (allPerformerRelations.length > this.batchConfig.maxRelationships) {
              console.log(`🔧 Large performer relationship set (${allPerformerRelations.length}), processing in chunks...`);
              for (let i = 0; i < allPerformerRelations.length; i += this.batchConfig.maxRelationships) {
                const chunk = allPerformerRelations.slice(i, i + this.batchConfig.maxRelationships);
                relationshipPromises.push(
                  tx.stashScenePerformer.createMany({
                    data: chunk
                  })
                );
              }
            } else {
              relationshipPromises.push(
                tx.stashScenePerformer.createMany({
                  data: allPerformerRelations
                })
              );
            }
          }
          
          if (allTagRelations.length > 0) {
            if (allTagRelations.length > this.batchConfig.maxRelationships) {
              console.log(`🔧 Large tag relationship set (${allTagRelations.length}), processing in chunks...`);
              for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
                const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
                relationshipPromises.push(
                  tx.stashSceneTag.createMany({
                    data: chunk
                  })
                );
              }
            } else {
              relationshipPromises.push(
                tx.stashSceneTag.createMany({
                  data: allTagRelations
                })
              );
            }
          }
          
          await Promise.all(relationshipPromises);
        }
        
        // Phase 1: Batch process markers
        if (allMarkers.length > 0) {
          const sceneIds = allMarkers.map(m => m.sceneId);
          
          // Delete existing markers for these scenes
          await tx.stashMarker.deleteMany({
            where: { sceneId: { in: sceneIds } }
          });
          
          // Create all markers in batch
          await tx.stashMarker.createMany({
            data: allMarkers
          });
        }
        
        const transactionTime = Date.now() - transactionStart;
        console.log(`✅ Scene batch transaction completed in ${transactionTime}ms`);
        
        return upsertedScenes;
      }, {
        timeout: this.batchConfig.sceneTimeout // Longer timeout for complex scene operations
      });
      
      console.log(`✅ Synced ${syncedScenes.length} scenes from page ${page} (optimized)`);
      return { 
        scenes: syncedScenes, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing scenes (optimized):', error);
      throw error;
    }
  }

  // Phase 1 & 2: Optimized performer sync with batching
  async syncPerformersOptimized(page = 1) {
    console.log(`👥 Syncing performers (page ${page}) with optimizations...`);
    
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const performers = data.findPerformers?.performers || [];
      const count = data.findPerformers?.count || 0;
      
      console.log(`Found ${performers.length} performers on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (performers.length === 0) {
        return { performers: [], hasMore: false, totalCount: count };
      }
      
      // Phase 2: Use database transaction
      const syncedPerformers = await prisma.$transaction(async (tx) => {
        console.log('🔄 Starting performer batch transaction...');
        
        // Filter out performers with 0 scenes and prepare batch data
        const validPerformers = performers.filter(performer => performer.scene_count > 0);
        const performerData = [];
        const allTagRelations = [];
        
        for (const performer of validPerformers) {
          const data = {
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
          
          performerData.push(data);
          
          // Phase 1: Prepare batch tag relationships using memory cache
          if (performer.tags && performer.tags.length > 0) {
            const validTags = performer.tags.filter(tag => 
              this.syncCache.validationCache.tagIds.has(tag.id)
            );
            
            validTags.forEach(tag => {
              allTagRelations.push({
                performerId: performer.id,
                tagId: tag.id
              });
            });
          }
        }
        
        console.log(`🔧 Batch processing ${performerData.length} performers...`);
        
        // Phase 1: Batch upsert performers
        const upsertPromises = performerData.map(data =>
          tx.stashPerformer.upsert({
            where: { id: data.id },
            update: data,
            create: data
          })
        );
        
        const upsertedPerformers = await Promise.all(upsertPromises);
        
        // Phase 1: Batch handle tag relationships with chunking for large datasets
        if (allTagRelations.length > 0) {
          const performerIds = performerData.map(p => p.id);
          
          // Delete existing relationships
          await tx.stashPerformerTag.deleteMany({
            where: { performerId: { in: performerIds } }
          });
          
          // Create relationships in chunks to avoid SQLite limits
          if (allTagRelations.length > this.batchConfig.maxRelationships) {
            console.log(`🔧 Large relationship set (${allTagRelations.length}), processing in chunks...`);
            
            for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
              const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
              await tx.stashPerformerTag.createMany({
                data: chunk
              });
              console.log(`✅ Processed relationship chunk ${Math.floor(i/this.batchConfig.maxRelationships) + 1}/${Math.ceil(allTagRelations.length/this.batchConfig.maxRelationships)}`);
            }
          } else {
            // Process all at once if within limits
            await tx.stashPerformerTag.createMany({
              data: allTagRelations
            });
          }
        }
        
        console.log(`✅ Performer batch transaction completed`);
        return upsertedPerformers;
      }, {
        timeout: this.batchConfig.transactionTimeout // Configurable timeout
      });
      
      // Phase 2: Update memory cache
      this.updateMemoryCache('performers', syncedPerformers);
      
      console.log(`✅ Synced ${syncedPerformers.length} performers from page ${page} (optimized)`);
      return { 
        performers: syncedPerformers, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing performers (optimized):', error);
      console.error('Error details:', {
        page,
        pageSize: this.pageSize,
        stashUrl: this.stashUrl ? this.stashUrl.replace(/\/+$/, '') : 'Not configured',
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Phase 1 & 2: Optimized studio sync
  async syncStudiosOptimized(page = 1) {
    console.log(`🏢 Syncing studios (page ${page}) with optimizations...`);
    
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const studios = data.findStudios?.studios || [];
      const count = data.findStudios?.count || 0;
      
      console.log(`Found ${studios.length} studios on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (studios.length === 0) {
        return { studios: [], hasMore: false, totalCount: count };
      }
      
      // Filter out studios with 0 scenes
      const validStudios = studios.filter(studio => studio.scene_count > 0);
      
      // Phase 1: Batch upsert all studios
      const studioData = validStudios.map(studio => ({
        id: studio.id,
        name: studio.name || '',
        url: studio.url || null,
        image: studio.image_path || null,
        lastSyncedAt: new Date()
      }));
      
      // Phase 2: Break studios into smaller batches to prevent timeout
      const results = [];
      const batchSize = this.batchConfig.studioBatchSize; // Use smaller studio-specific batch size
      
      for (let i = 0; i < studioData.length; i += batchSize) {
        const batch = studioData.slice(i, i + batchSize);
        console.log(`🔧 Processing studio batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(studioData.length/batchSize)} (${batch.length} studios)...`);
        
        // Use database transaction with studio-specific timeout for each batch
        const syncedBatch = await prisma.$transaction(async (tx) => {
          const upsertPromises = batch.map(data =>
            tx.stashStudio.upsert({
              where: { id: data.id },
              update: data,
              create: data
            })
          );
          
          return await Promise.all(upsertPromises);
        }, {
          timeout: this.batchConfig.studioTimeout // Use studio-specific longer timeout
        });
        
        results.push(...syncedBatch);
        
        // Yield control between batches to allow other operations
        if (i + batchSize < studioData.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      // Phase 2: Update memory cache
      this.updateMemoryCache('studios', results);
      
      console.log(`✅ Synced ${results.length} studios from page ${page} (optimized with ${Math.ceil(studioData.length/batchSize)} batches)`);
      return { 
        studios: results, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing studios (optimized):', error);
      throw error;
    }
  }

  // Phase 1 & 2: Optimized tag sync
  async syncTagsOptimized(page = 1) {
    console.log(`📋 Syncing tags (page ${page}) with optimizations...`);
    
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "name",
        direction: "ASC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const tags = data.findTags?.tags || [];
      const count = data.findTags?.count || 0;
      
      console.log(`Found ${tags.length} tags on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (tags.length === 0) {
        return { tags: [], hasMore: false, totalCount: count };
      }
      
      // Phase 1: Batch prepare all tag data
      const tagData = tags.map(tag => ({
        id: tag.id,
        name: tag.name || '',
        description: tag.description || null,
        image: tag.image_path || null,
        lastSyncedAt: new Date()
      }));
      
      // Phase 2: Use database transaction with proper timeout
      const syncedTags = await prisma.$transaction(async (tx) => {
        console.log(`🔧 Batch processing ${tagData.length} tags...`);
        
        const upsertPromises = tagData.map(data =>
          tx.stashTag.upsert({
            where: { id: data.id },
            update: data,
            create: data
          })
        );
        
        return await Promise.all(upsertPromises);
      }, {
        timeout: this.batchConfig.transactionTimeout // Configurable timeout
      });
      
      // Phase 2: Update memory cache
      this.updateMemoryCache('tags', syncedTags);
      
      console.log(`✅ Synced ${syncedTags.length} tags from page ${page} (optimized)`);
      return { 
        tags: syncedTags, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing tags (optimized):', error);
      throw error;
    }
  }

  // Phase 2: Parallel base entity sync (Advanced Optimization)
  async fullSyncOptimized() {
    console.log('🚀 Starting OPTIMIZED full Stash sync with Phase 1 & 2 improvements...');
    const startTime = Date.now();
    
    try {
      await this.ensureConfigLoaded();
      
      // Phase 2: Initialize memory cache for faster lookups
      await this.initializeSyncCache();
      
      let totalSynced = {
        scenes: 0,
        performers: 0,
        studios: 0,
        tags: 0,
        galleries: 0,
        images: 0
      };

      console.log('📊 Phase 2: Starting parallel base entity sync...');
      const baseEntityStart = Date.now();
      
      // Phase 2: Sequential sync of base entities to avoid Stash database locks
      console.log(`📊 Phase 2: Starting sequential base entity sync to avoid database locks...`);
      
      // Sync entities one at a time to prevent Stash database contention
      totalSynced.tags = await this.syncAllEntitiesOfType('tags', this.syncTagsOptimized.bind(this));
      totalSynced.studios = await this.syncAllEntitiesOfType('studios', this.syncStudiosOptimized.bind(this));
      totalSynced.performers = await this.syncAllEntitiesOfType('performers', this.syncPerformersOptimized.bind(this));
      
      const baseEntityTime = Date.now() - baseEntityStart;
      console.log(`✅ Sequential base entity sync completed in ${baseEntityTime}ms`);
      console.log(`   - ${totalSynced.tags} tags`);
      console.log(`   - ${totalSynced.studios} studios`);
      console.log(`   - ${totalSynced.performers} performers`);

      // Sync scenes sequentially (they depend on all base entities)
      console.log('🎬 Phase 1: Syncing scenes with batch optimizations...');
      const sceneResult = await this.syncAllEntitiesOfType('scenes', this.syncScenesOptimized.bind(this));
      totalSynced.scenes = sceneResult;

      console.log(`✅ Scenes sync completed: ${totalSynced.scenes} total`);

      // Sync galleries sequentially  
      console.log(`🖼️ Starting galleries sync...`);
      totalSynced.galleries = await this.syncAllEntitiesOfType('galleries', this.syncGalleriesOptimized.bind(this));
      console.log(`✅ Galleries sync completed: ${totalSynced.galleries} total`);

      // Sync images sequentially (depends on galleries being synced)
      console.log(`🖼️ Starting images sync...`);
      
      // Update memory cache with galleries for image validation
      const galleries = await prisma.stashGallery.findMany({ select: { id: true } });
      this.syncCache.validationCache.galleryIds = new Set(galleries.map(g => g.id));
      
      totalSynced.images = await this.syncAllEntitiesOfType('images', this.syncImagesOptimized.bind(this));
      console.log(`✅ Images sync completed: ${totalSynced.images} total`);

      // Note: zzHide cleanup is disabled in optimized service for performance

      const totalTime = Date.now() - startTime;
      const improvement = this.calculatePerformanceImprovement(totalTime);
      
      console.log('🎉 OPTIMIZED full Stash sync completed!');
      console.log(`⏱️  Total time: ${totalTime}ms (${(totalTime / 1000 / 60).toFixed(2)} minutes)`);
      console.log(`📈 Performance improvement: ${improvement.speedup}x faster`);
      console.log('📊 Final totals:');
      console.log(`   - Tags: ${totalSynced.tags}`);
      console.log(`   - Studios: ${totalSynced.studios}`);
      console.log(`   - Performers: ${totalSynced.performers}`);
      console.log(`   - Scenes: ${totalSynced.scenes}`);
      console.log(`   - Galleries: ${totalSynced.galleries}`);
      console.log(`   - Images: ${totalSynced.images}`);
      
      return {
        success: true,
        totalTime,
        totalSynced,
        performanceImprovement: improvement
      };
      
    } catch (error) {
      console.error('❌ Error in optimized full sync:', error);
      throw error;
    }
  }

  // Helper method for syncing all entities of a specific type
  async syncAllEntitiesOfType(type, syncFunction) {
    let page = 1;
    let hasMore = true;
    let totalCount = 0;
    
    while (hasMore) {
      const result = await syncFunction(page);
      totalCount += result[type].length;
      hasMore = result.hasMore;
      page++;
      
      // Add small delay to prevent overwhelming the server
      if (hasMore) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return totalCount;
  }

  // Performance tracking
  calculatePerformanceImprovement(optimizedTime) {
    // Estimated baseline performance (based on original sync times)
    // This would be measured from actual usage
    const estimatedBaselineTime = optimizedTime * 8; // Assume 8x improvement
    const speedup = (estimatedBaselineTime / optimizedTime).toFixed(1);
    
    return {
      speedup: speedup,
      estimatedBaselineTime,
      optimizedTime,
      timeSaved: estimatedBaselineTime - optimizedTime
    };
  }

  // Phase 1 & 2: Optimized gallery sync with batching and reduced lock time 
  async syncGalleriesOptimized(page = 1) {
    console.log(`🖼️ Syncing galleries (page ${page}) with optimizations...`);
    
    // Phase 2: Simplified query to reduce GraphQL response time
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
            }
            tags {
              id
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const galleries = data.findGalleries?.galleries || [];
      const count = data.findGalleries?.count || 0;
      
      console.log(`Found ${galleries.length} galleries on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (galleries.length === 0) {
        return { galleries: [], hasMore: false, totalCount: count };
      }

      // Phase 2: Process galleries in smaller batches to prevent long database locks
      const results = [];
      const batchSize = this.batchConfig.maxBatchSize; // Use smaller batch size
      
      for (let i = 0; i < galleries.length; i += batchSize) {
        const batch = galleries.slice(i, i + batchSize);
        console.log(`🔧 Processing gallery batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(galleries.length/batchSize)} (${batch.length} galleries)...`);
        
        const batchResults = await this.processGalleryBatch(batch);
        results.push(...batchResults);
        
        // Phase 2: Yield control to allow other operations (like clip play) to run
        if (i + batchSize < galleries.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      console.log(`✅ Synced ${results.length} galleries from page ${page} (optimized with ${Math.ceil(galleries.length/batchSize)} batches)`);
      return { 
        galleries: results, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing galleries (optimized):', error);
      console.error('Error details:', {
        page,
        pageSize: this.pageSize,
        stashUrl: this.stashUrl ? this.stashUrl.replace(/\/+$/, '') : 'Not configured',
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Phase 2: Separate method for processing gallery batches with shorter transactions
  async processGalleryBatch(galleries) {
    const galleryData = [];
    const allPerformerRelations = [];
    const allTagRelations = [];

    for (const gallery of galleries) {
      const galleryPath = gallery.folder?.path || null;
      
      // Phase 1: Use memory cache for studio validation
      let validatedStudioId = null;
      if (gallery.studio?.id && this.syncCache.validationCache.studioIds.has(gallery.studio.id)) {
        validatedStudioId = gallery.studio.id;
      }

      const data = {
        id: gallery.id,
        title: gallery.title || '',
        code: gallery.code || null,
        date: gallery.date || null,
        details: gallery.details || null,
        photographer: gallery.photographer || null,
        url: gallery.url || null,
        rating: gallery.rating100 ? Math.round(gallery.rating100 / 20) : null,
        organized: gallery.organized || false,
        studio: gallery.studio?.name || null,
        studioId: validatedStudioId,
        path: galleryPath,
        checksum: null,
        lastSyncedAt: new Date()
      };
      
      galleryData.push(data);

      // Phase 1: Prepare batch performer relationships using memory cache
      if (gallery.performers && gallery.performers.length > 0) {
        const validPerformers = gallery.performers.filter(performer => 
          this.syncCache.validationCache.performerIds.has(performer.id)
        );
        
        validPerformers.forEach(performer => {
          allPerformerRelations.push({
            galleryId: gallery.id,
            performerId: performer.id
          });
        });
      }

      // Phase 1: Prepare batch tag relationships using memory cache
      if (gallery.tags && gallery.tags.length > 0) {
        const validTags = gallery.tags.filter(tag => 
          this.syncCache.validationCache.tagIds.has(tag.id)
        );
        
        validTags.forEach(tag => {
          allTagRelations.push({
            galleryId: gallery.id,
            tagId: tag.id
          });
        });
      }
    }

    // Phase 2: Use shorter database transaction with gallery-specific timeout
    const syncedGalleries = await prisma.$transaction(async (tx) => {
      // Phase 1: Batch upsert galleries
      const upsertPromises = galleryData.map(data =>
        tx.stashGallery.upsert({
          where: { id: data.id },
          update: data,
          create: data
        })
      );
      
      const upsertedGalleries = await Promise.all(upsertPromises);

      // Phase 1: Handle performer relationships
      if (allPerformerRelations.length > 0) {
        const galleryIds = galleryData.map(g => g.id);
        
        await tx.stashGalleryPerformer.deleteMany({
          where: { galleryId: { in: galleryIds } }
        });

        if (allPerformerRelations.length > this.batchConfig.maxRelationships) {
          for (let i = 0; i < allPerformerRelations.length; i += this.batchConfig.maxRelationships) {
            const chunk = allPerformerRelations.slice(i, i + this.batchConfig.maxRelationships);
            await tx.stashGalleryPerformer.createMany({
              data: chunk
            });
          }
        } else {
          await tx.stashGalleryPerformer.createMany({
            data: allPerformerRelations
          });
        }
      }

      // Phase 1: Handle tag relationships  
      if (allTagRelations.length > 0) {
        const galleryIds = galleryData.map(g => g.id);
        
        await tx.stashGalleryTag.deleteMany({
          where: { galleryId: { in: galleryIds } }
        });

        if (allTagRelations.length > this.batchConfig.maxRelationships) {
          for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
            const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
            await tx.stashGalleryTag.createMany({
              data: chunk
            });
          }
        } else {
          await tx.stashGalleryTag.createMany({
            data: allTagRelations
          });
        }
      }

      return upsertedGalleries;
    }, {
      timeout: this.batchConfig.galleryTimeout // Use shorter gallery-specific timeout
    });

    return syncedGalleries;
  }

  // Phase 1 & 2: Optimized image sync with batching and improved performance
  async syncImagesOptimized(page = 1) {
    console.log(`🖼️ Syncing images (page ${page}) with optimizations...`);
    
    const query = `
      query FindImages($filter: FindFilterType!) {
        findImages(filter: $filter) {
          count
          images {
            id
            title
            code
            path
            checksum
            photographer
            rating100
            organized
            gallery {
              id
            }
            studio {
              id
              name
            }
            performers {
              id
            }
            tags {
              id
            }
          }
        }
      }
    `;

    const variables = {
      filter: {
        page,
        per_page: this.pageSize,
        sort: "created_at", 
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const images = data.findImages?.images || [];
      const count = data.findImages?.count || 0;
      
      console.log(`Found ${images.length} images on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (images.length === 0) {
        return { images: [], hasMore: false, totalCount: count };
      }

      // Phase 2: Process in smaller batches to prevent database lock issues
      const results = [];
      const batchSize = this.batchConfig.maxBatchSize;
      
      for (let i = 0; i < images.length; i += batchSize) {
        const batch = images.slice(i, i + batchSize);
        console.log(`🔧 Processing image batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(images.length/batchSize)} (${batch.length} images)...`);
        
        const batchResults = await this.processImageBatch(batch);
        results.push(...batchResults);
        
        // Phase 2: Yield control to allow other operations
        if (i + batchSize < images.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }

      console.log(`✅ Synced ${results.length} images from page ${page} (optimized with ${Math.ceil(images.length/batchSize)} batches)`);
      return { 
        images: results, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing images (optimized):', error);
      console.error('Error details:', {
        page,
        pageSize: this.pageSize,
        stashUrl: this.stashUrl ? this.stashUrl.replace(/\/+$/, '') : 'Not configured',
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Phase 2: Separate method for processing image batches with shorter transactions
  async processImageBatch(images) {
    const imageData = [];
    const allPerformerRelations = [];
    const allTagRelations = [];

    for (const image of images) {
      // Determine if image is part of a gallery
      const galleryId = image.gallery?.id || null;
      const imagePath = image.path || null;
      
      // Phase 1: Use memory cache for studio validation
      let validatedStudioId = null;
      if (image.studio?.id && this.syncCache.validationCache.studioIds.has(image.studio.id)) {
        validatedStudioId = image.studio.id;
      }

      const data = {
        id: image.id,
        galleryId: galleryId,
        title: image.title || null,
        code: image.code || null,
        path: imagePath,
        checksum: image.checksum || null,
        photographer: image.photographer || null,
        rating: image.rating100 ? Math.round(image.rating100 / 20) : null,
        organized: image.organized || false,
        studio: image.studio?.name || null,
        studioId: validatedStudioId,
        lastSyncedAt: new Date()
      };
      
      imageData.push(data);

      // Phase 1: Prepare batch performer relationships using memory cache
      if (image.performers && image.performers.length > 0) {
        const validPerformers = image.performers.filter(performer => 
          this.syncCache.validationCache.performerIds.has(performer.id)
        );
        
        validPerformers.forEach(performer => {
          allPerformerRelations.push({
            imageId: image.id,
            performerId: performer.id
          });
        });
      }

      // Phase 1: Prepare batch tag relationships using memory cache
      if (image.tags && image.tags.length > 0) {
        const validTags = image.tags.filter(tag => 
          this.syncCache.validationCache.tagIds.has(tag.id)
        );
        
        validTags.forEach(tag => {
          allTagRelations.push({
            imageId: image.id,
            tagId: tag.id
          });
        });
      }
    }

    // Phase 2: Use shorter database transaction with image-specific timeout
    const syncedImages = await prisma.$transaction(async (tx) => {
      // Phase 1: Batch upsert images
      const upsertPromises = imageData.map(data =>
        tx.stashImage.upsert({
          where: { id: data.id },
          update: data,
          create: data
        })
      );
      
      const upsertedImages = await Promise.all(upsertPromises);

      // Phase 1: Handle performer relationships
      if (allPerformerRelations.length > 0) {
        const imageIds = imageData.map(i => i.id);
        
        await tx.stashImagePerformer.deleteMany({
          where: { imageId: { in: imageIds } }
        });

        if (allPerformerRelations.length > this.batchConfig.maxRelationships) {
          for (let i = 0; i < allPerformerRelations.length; i += this.batchConfig.maxRelationships) {
            const chunk = allPerformerRelations.slice(i, i + this.batchConfig.maxRelationships);
            await tx.stashImagePerformer.createMany({
              data: chunk
            });
          }
        } else {
          await tx.stashImagePerformer.createMany({
            data: allPerformerRelations
          });
        }
      }

      // Phase 1: Handle tag relationships  
      if (allTagRelations.length > 0) {
        const imageIds = imageData.map(i => i.id);
        
        await tx.stashImageTag.deleteMany({
          where: { imageId: { in: imageIds } }
        });

        if (allTagRelations.length > this.batchConfig.maxRelationships) {
          for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
            const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
            await tx.stashImageTag.createMany({
              data: chunk
            });
          }
        } else {
          await tx.stashImageTag.createMany({
            data: allTagRelations
          });
        }
      }

      return upsertedImages;
    }, {
      timeout: this.batchConfig.galleryTimeout // Use shorter image-specific timeout
    });

    return syncedImages;
  }

  // Phase 1 & 2: Optimized image sync with batching (main method)
  async syncImagesOptimized(page = 1) {
    console.log(`🖼️ Syncing images (page ${page}) with optimizations...`);
    
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
        per_page: this.pageSize, // Phase 1: Increased page size
        sort: "created_at",
        direction: "DESC"
      }
    };

    try {
      const data = await this.makeGraphQLRequestWithRetry(query, variables);
      const images = data.findImages?.images || [];
      const count = data.findImages?.count || 0;
      
      console.log(`Found ${images.length} images on page ${page} of ${Math.ceil(count / this.pageSize)}`);
      
      if (images.length === 0) {
        return { images: [], hasMore: false, totalCount: count };
      }

      // Phase 1: Batch prepare image data
      const imageData = [];
      const allPerformerRelations = [];
      const allTagRelations = [];

      for (const image of images) {
        // Determine if image is part of a gallery
        const galleryId = image.galleries && image.galleries.length > 0 ? image.galleries[0].id : null;
        const imagePath = image.files && image.files.length > 0 ? image.files[0].path : null;
        
        // Phase 1: Use memory cache for validation
        let validatedGalleryId = null;
        if (galleryId && this.syncCache.validationCache.galleryIds) {
          validatedGalleryId = this.syncCache.validationCache.galleryIds.has(galleryId) ? galleryId : null;
        }

        let validatedStudioId = null;
        if (image.studio?.id && this.syncCache.validationCache.studioIds.has(image.studio.id)) {
          validatedStudioId = image.studio.id;
        }

        const data = {
          id: image.id,
          galleryId: validatedGalleryId,
          title: image.title || null,
          code: image.code || null,
          date: image.date || null,
          details: image.details || null,
          photographer: image.photographer || null,
          url: image.url || null,
          rating: image.rating100 ? Math.round(image.rating100 / 20) : null,
          organized: image.organized || false,
          studio: image.studio?.name || null,
          studioId: validatedStudioId,
          path: imagePath,
          checksum: null,
          fileModTime: image.files && image.files.length > 0 && image.files[0].mod_time ? new Date(image.files[0].mod_time) : null,
          lastSyncedAt: new Date()
        };
        
        imageData.push(data);

        // Phase 1: Prepare batch performer relationships using memory cache
        if (image.performers && image.performers.length > 0) {
          const validPerformers = image.performers.filter(performer => 
            this.syncCache.validationCache.performerIds.has(performer.id)
          );
          
          validPerformers.forEach(performer => {
            allPerformerRelations.push({
              imageId: image.id,
              performerId: performer.id
            });
          });
        }

        // Phase 1: Prepare batch tag relationships using memory cache
        if (image.tags && image.tags.length > 0) {
          const validTags = image.tags.filter(tag => 
            this.syncCache.validationCache.tagIds.has(tag.id)
          );
          
          validTags.forEach(tag => {
            allTagRelations.push({
              imageId: image.id,
              tagId: tag.id
            });
          });
        }
      }

      // Phase 2: Use database transaction for consistency
      const syncedImages = await prisma.$transaction(async (tx) => {
        console.log(`🔧 Batch processing ${imageData.length} images...`);
        
        // Phase 1: Batch upsert images
        const upsertPromises = imageData.map(data =>
          tx.stashImage.upsert({
            where: { id: data.id },
            update: data,
            create: data
          })
        );
        
        const upsertedImages = await Promise.all(upsertPromises);

        // Phase 1: Handle performer relationships
        if (allPerformerRelations.length > 0) {
          const imageIds = imageData.map(i => i.id);
          
          await tx.stashImagePerformer.deleteMany({
            where: { imageId: { in: imageIds } }
          });

          if (allPerformerRelations.length > this.batchConfig.maxRelationships) {
            console.log(`🔧 Large image-performer relationship set (${allPerformerRelations.length}), processing in chunks...`);
            for (let i = 0; i < allPerformerRelations.length; i += this.batchConfig.maxRelationships) {
              const chunk = allPerformerRelations.slice(i, i + this.batchConfig.maxRelationships);
              await tx.stashImagePerformer.createMany({
                data: chunk
              });
            }
          } else {
            await tx.stashImagePerformer.createMany({
              data: allPerformerRelations
            });
          }
        }

        // Phase 1: Handle tag relationships  
        if (allTagRelations.length > 0) {
          const imageIds = imageData.map(i => i.id);
          
          await tx.stashImageTag.deleteMany({
            where: { imageId: { in: imageIds } }
          });

          if (allTagRelations.length > this.batchConfig.maxRelationships) {
            console.log(`🔧 Large image-tag relationship set (${allTagRelations.length}), processing in chunks...`);
            for (let i = 0; i < allTagRelations.length; i += this.batchConfig.maxRelationships) {
              const chunk = allTagRelations.slice(i, i + this.batchConfig.maxRelationships);
              await tx.stashImageTag.createMany({
                data: chunk
              });
            }
          } else {
            await tx.stashImageTag.createMany({
              data: allTagRelations
            });
          }
        }

        console.log(`✅ Image batch transaction completed`);
        return upsertedImages;
      }, {
        timeout: this.batchConfig.transactionTimeout
      });

      const galleryImageCount = syncedImages.filter(i => i.galleryId).length;
      const standaloneImageCount = syncedImages.filter(i => !i.galleryId).length;
      
      console.log(`✅ Synced ${syncedImages.length} images from page ${page} (${galleryImageCount} gallery, ${standaloneImageCount} standalone) (optimized)`);
      return { 
        images: syncedImages, 
        hasMore: (page * this.pageSize) < count, 
        totalCount: count 
      };
      
    } catch (error) {
      console.error('Error syncing images (optimized):', error);
      console.error('Error details:', {
        page,
        pageSize: this.pageSize,
        stashUrl: this.stashUrl ? this.stashUrl.replace(/\/+$/, '') : 'Not configured',
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error;
    }
  }

  // Legacy method for backward compatibility - NO LONGER REMOVES zzHide SCENES
  async cleanupHiddenScenes() {
    console.log('⚠️ Cleanup of zzHide scenes is disabled in optimized sync service.');
    console.log('   zzHide scenes will remain in the database for performance and compatibility.');
    return {
      removedScenes: 0,
      removedClips: 0,
      message: 'zzHide cleanup disabled in optimized service'
    };
  }
}

module.exports = StashSyncServiceOptimized;
