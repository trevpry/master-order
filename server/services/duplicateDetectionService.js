const { PrismaClient } = require('@prisma/client');
const StashSyncService = require('../stashSyncService');

/**
 * Service for detecting duplicate scenes in Stash
 */
class DuplicateDetectionService {
  constructor() {
    this.prisma = new PrismaClient();
    this.stashSync = new StashSyncService();
  }

  /**
   * Fetch scene paths from Stash GraphQL API and normalize them for the proxy
   * @param {string} sceneId - Stash scene ID
   * @returns {Promise<Object>} Scene paths (screenshot, preview, stream) - relative paths only
   */
  async fetchScenePaths(sceneId) {
    try {
      const query = `
        query FindScene($id: ID!) {
          findScene(id: $id) {
            paths {
              screenshot
              preview
              stream
              sprite
            }
          }
        }
      `;
      
      const result = await this.stashSync.makeGraphQLRequest(query, { id: sceneId });
      const paths = result?.findScene?.paths;
      
      if (!paths) return null;
      
      // Get Stash URL to strip it from paths (Stash returns full URLs in paths)
      const { getSettings } = require('../databaseUtils');
      const settings = await getSettings();
      const stashBaseUrl = settings?.stashUrl ? 
        (settings.stashUrl.endsWith('/') ? settings.stashUrl.slice(0, -1) : settings.stashUrl) : 
        null;
      
      console.log(`   - Stash base URL: ${stashBaseUrl}`);
      console.log(`   - Raw paths from Stash:`, paths);
      
      // Strip the base URL to get relative paths that the proxy expects
      const normalizedPaths = {};
      for (const [key, value] of Object.entries(paths)) {
        if (!value) {
          normalizedPaths[key] = value;
          continue;
        }
        
        // If it's a full URL, strip the base URL to get relative path
        if (stashBaseUrl && value.startsWith(stashBaseUrl)) {
          normalizedPaths[key] = value.substring(stashBaseUrl.length);
          console.log(`   - Normalized ${key}: ${value} -> ${normalizedPaths[key]}`);
        } 
        // If it starts with http (different base URL), keep as is for proxy to handle
        else if (value.startsWith('http')) {
          normalizedPaths[key] = value;
          console.log(`   - Keeping full URL for ${key}: ${value}`);
        }
        // Already a relative path
        else {
          normalizedPaths[key] = value;
          console.log(`   - Already relative ${key}: ${value}`);
        }
      }
      
      console.log(`   - Final normalized paths:`, normalizedPaths);
      return normalizedPaths;
    } catch (error) {
      console.error(`   - ⚠️ Failed to fetch paths for scene ${sceneId}:`, error.message);
      return null;
    }
  }

  /**
   * Find scenes with identical performer sets
   * @param {number} durationDiff - Maximum duration difference in seconds (-1 to disable)
   * @returns {Promise<Array>} Array of duplicate groups with scenes and metadata
   */
  async findDuplicatesByPerformers(durationDiff = -1) {
    console.log('🔍 [Duplicate Detection] Finding scenes with identical performers...');
    console.log(`   - Duration difference threshold: ${durationDiff === -1 ? 'disabled' : durationDiff + ' seconds'}`);
    
    try {
      // Get all scenes with their performers
      const scenesWithPerformers = await this.prisma.stashScene.findMany({
        where: {
          performers: {
            some: {} // Only include scenes that have at least one performer
          }
        },
        include: {
          performers: {
            include: {
              performer: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
          // Note: paths is not a valid include field, files data comes from Stash API
        },
        orderBy: {
          date: 'desc'
        }
      });
      
      console.log(`   - Found ${scenesWithPerformers.length} scenes with performers`);
      
      // Group scenes by their performer sets
      const performerGroups = new Map();
      
      scenesWithPerformers.forEach(scene => {
        // Sort performers by name for consistent grouping
        const sortedPerformers = scene.performers
          .map(sp => ({ id: sp.performer.id, name: sp.performer.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        
        // Create a sorted performer ID string as the key
        const performerIds = sortedPerformers
          .map(p => p.id)
          .join(',');
        
        // Skip scenes with no performers (shouldn't happen due to where clause, but safety check)
        if (!performerIds) return;
        
        if (!performerGroups.has(performerIds)) {
          performerGroups.set(performerIds, []);
        }
        
        // Store scene with sorted performers
        performerGroups.get(performerIds).push({
          ...scene,
          sortedPerformers
        });
      });
      
      console.log(`   - Found ${performerGroups.size} unique performer combinations`);
      
      // Filter to only groups with duplicates (2+ scenes) and apply duration filtering
      const duplicateGroups = Array.from(performerGroups.entries())
        .filter(([_, scenes]) => scenes.length > 1)
        .map(([performerIds, scenes]) => {
          // Get performer names from the sorted performers
          const performerNames = scenes[0].sortedPerformers
            .map(p => p.name)
            .join(', ');
          
          // Sub-group scenes by similar duration (or skip duration check if disabled)
          const durationGroups = [];
          const processedScenes = new Set();
          
          // If duration check is disabled (-1), treat all scenes as one group
          if (durationDiff === -1) {
            if (scenes.length >= 2) {
              durationGroups.push(scenes);
            }
          } else {
            // Group by similar duration
            scenes.forEach(sceneA => {
              if (processedScenes.has(sceneA.id)) return;
              
              // Find all scenes with similar duration to this one
              const similarDurationScenes = scenes.filter(sceneB => {
                // Skip if already processed
                if (processedScenes.has(sceneB.id)) return false;
                
                // Skip scenes without duration
                if (!sceneA.duration || !sceneB.duration) return false;
                
                // Check if durations are within the threshold
                const diff = Math.abs(sceneA.duration - sceneB.duration);
                return diff <= durationDiff;
              });
            
              // Only create a group if there are 2+ scenes with similar duration
              if (similarDurationScenes.length >= 2) {
                similarDurationScenes.forEach(s => processedScenes.add(s.id));
                durationGroups.push(similarDurationScenes);
              }
            });
          }
          
          return {
            performerIds,
            performerNames,
            durationGroups
          };
        })
        .filter(group => group.durationGroups.length > 0) // Only keep groups with duration-based duplicates
        .flatMap(group => {
          // Convert duration sub-groups to individual duplicate groups
          return group.durationGroups.map(scenes => ({
            performerIds: group.performerIds,
            performerNames: group.performerNames,
            count: scenes.length,
            scenes: scenes.map(scene => ({
              id: scene.id,
              stashId: scene.stashId,
              title: scene.title,
              date: scene.date,
              rating: scene.rating,
              duration: scene.duration,
              fileSize: scene.fileSize,
              width: scene.width,
              height: scene.height,
              videoCodec: scene.videoCodec,
              createdAt: scene.createdAt,
              updatedAt: scene.updatedAt,
              performers: scene.sortedPerformers
            }))
          }));
        })
        .sort((a, b) => b.count - a.count); // Sort by group size (most duplicates first)
      
      console.log(`✅ [Duplicate Detection] Found ${duplicateGroups.length} groups with duplicates`);
      
      // Fetch paths from Stash for all scenes in duplicate groups
      console.log('🖼️ [Duplicate Detection] Fetching scene images from Stash...');
      const totalScenes = duplicateGroups.reduce((sum, g) => sum + g.count, 0);
      let fetchedCount = 0;
      
      for (const group of duplicateGroups) {
        for (const scene of group.scenes) {
          const paths = await this.fetchScenePaths(scene.id);
          scene.paths = paths;
          fetchedCount++;
          
          // Log progress every 10 scenes
          if (fetchedCount % 10 === 0 || fetchedCount === totalScenes) {
            console.log(`   - Fetched ${fetchedCount}/${totalScenes} scene images`);
          }
        }
      }
      
      console.log(`✅ [Duplicate Detection] Complete: ${duplicateGroups.length} groups with ${totalScenes} scenes`);
      
      return duplicateGroups;
    } catch (error) {
      console.error('❌ [Duplicate Detection] Error:', error);
      throw error;
    }
  }

  /**
   * Close Prisma connection
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = DuplicateDetectionService;
