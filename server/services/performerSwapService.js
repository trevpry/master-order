/**
 * Performer Swap Service
 * Part of Eddie Life Management - Stash Integration Module
 * 
 * Handles swapping performers in scenes with proper tag transfer
 * Follows modular service pattern from copilot-instructions
 */

const { PrismaClient } = require('@prisma/client');

class PerformerSwapService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Swap a performer in a scene and transfer all associated tags
   * @param {string} sceneId - The scene ID
   * @param {string} oldPerformerId - The performer to replace
   * @param {string} newPerformerId - The replacement performer
   * @param {PrismaClient} prismaClient - Optional Prisma client (for transactions)
   * @returns {Promise<Object>} Summary of the swap operation
   */
  async swapPerformerInScene(sceneId, oldPerformerId, newPerformerId, prismaClient = null) {
    const prisma = prismaClient || this.prisma;

    console.log(`\n🔄 [Performer Swap] Starting swap operation`);
    console.log(`   - Scene: ${sceneId}`);
    console.log(`   - Old Performer: ${oldPerformerId}`);
    console.log(`   - New Performer: ${newPerformerId}`);

    try {
      // Validate inputs
      if (!sceneId || !oldPerformerId || !newPerformerId) {
        throw new Error('Scene ID, old performer ID, and new performer ID are required');
      }

      if (oldPerformerId === newPerformerId) {
        throw new Error('Old and new performer cannot be the same');
      }

      // Execute in transaction if not already in one
      const result = await prisma.$transaction(async (tx) => {
        // 1. Verify scene exists
        const scene = await tx.stashScene.findUnique({
          where: { id: sceneId }
        });

        if (!scene) {
          throw new Error(`Scene ${sceneId} not found`);
        }

        // 2. Verify old performer is on the scene
        const oldPerformerScene = await tx.stashScenePerformer.findUnique({
          where: {
            sceneId_performerId: {
              sceneId: sceneId,
              performerId: oldPerformerId
            }
          },
          include: {
            performer: true
          }
        });

        if (!oldPerformerScene) {
          throw new Error(`Performer ${oldPerformerId} is not on scene ${sceneId}`);
        }

        // 3. Verify new performer exists
        const newPerformer = await tx.stashPerformer.findUnique({
          where: { id: newPerformerId }
        });

        if (!newPerformer) {
          throw new Error(`New performer ${newPerformerId} not found`);
        }

        // 4. Check if new performer is already on the scene
        const existingPerformerScene = await tx.stashScenePerformer.findUnique({
          where: {
            sceneId_performerId: {
              sceneId: sceneId,
              performerId: newPerformerId
            }
          }
        });

        if (existingPerformerScene) {
          throw new Error(`Performer ${newPerformer.name} is already on this scene`);
        }

        // 5. Get all tags associated with old performer on this scene
        const oldPerformerTags = await tx.stashScenePerformerTag.findMany({
          where: {
            performerId: oldPerformerId,
            sceneId: sceneId
          },
          include: {
            tag: true
          }
        });

        console.log(`   - Found ${oldPerformerTags.length} tags to transfer`);

        // 6. Remove old performer from scene
        await tx.stashScenePerformer.delete({
          where: {
            sceneId_performerId: {
              sceneId: sceneId,
              performerId: oldPerformerId
            }
          }
        });

        console.log(`   ✅ Removed old performer from scene`);

        // 7. Add new performer to scene
        await tx.stashScenePerformer.create({
          data: {
            performerId: newPerformerId,
            sceneId: sceneId,
            actionCode: oldPerformerScene.actionCode // Transfer action code if exists
          }
        });

        console.log(`   ✅ Added new performer to scene`);

        // 8. Transfer all tags to new performer
        const transferredTags = [];
        for (const tagEntry of oldPerformerTags) {
          // Check if tag already exists for new performer (shouldn't happen but be safe)
          const existingTag = await tx.stashScenePerformerTag.findUnique({
            where: {
              sceneId_performerId_tagId: {
                sceneId: sceneId,
                performerId: newPerformerId,
                tagId: tagEntry.tagId
              }
            }
          });

          if (!existingTag) {
            await tx.stashScenePerformerTag.create({
              data: {
                performerId: newPerformerId,
                sceneId: sceneId,
                tagId: tagEntry.tagId
              }
            });

            transferredTags.push(tagEntry.tag.name);
          }
        }

        console.log(`   ✅ Transferred ${transferredTags.length} tags`);

        return {
          success: true,
          oldPerformer: {
            id: oldPerformerId,
            name: oldPerformerScene.performer.name
          },
          newPerformer: {
            id: newPerformerId,
            name: newPerformer.name
          },
          transferredTags: transferredTags,
          actionCodeTransferred: !!oldPerformerScene.actionCode
        };
      });

      console.log(`\n✅ [Performer Swap] Complete`);
      console.log(`   - Replaced: ${result.oldPerformer.name} → ${result.newPerformer.name}`);
      console.log(`   - Tags transferred: ${result.transferredTags.length}`);
      console.log(`   - Action code transferred: ${result.actionCodeTransferred}`);

      return result;

    } catch (error) {
      console.error(`\n❌ [Performer Swap] Failed:`, error.message);
      throw error;
    }
  }

  /**
   * Search for performers by name
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @returns {Promise<Array>} Array of matching performers
   */
  async searchPerformers(query, limit = 20) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const performers = await this.prisma.stashPerformer.findMany({
      where: {
        name: {
          contains: query
          // Note: 'mode: insensitive' not supported in SQLite
          // Search is case-sensitive in SQLite, case-insensitive in PostgreSQL
        }
      },
      take: limit,
      orderBy: {
        name: 'asc'
      },
      select: {
        id: true,
        name: true,
        image: true
      }
    });

    return performers;
  }

  /**
   * Create a new performer in Stash and local database
   * @param {Object} performerData - Performer data
   * @param {Object} syncService - StashSyncService instance for API calls
   * @returns {Promise<Object>} Created performer
   */
  async createPerformer(performerData, syncService = null) {
    const { name, stashId, image } = performerData;

    if (!name || name.trim().length === 0) {
      throw new Error('Performer name is required');
    }

    console.log(`\n➕ [CREATE PERFORMER] Creating: "${name}"`);

    // Check if performer with this name already exists in local DB
    // Note: Using exact match - case-sensitive in SQLite, would be case-insensitive in PostgreSQL with mode
    const existing = await this.prisma.stashPerformer.findFirst({
      where: {
        name: name.trim()
      }
    });

    if (existing) {
      throw new Error(`Performer "${name}" already exists`);
    }

    // If syncService provided, create in Stash first
    if (syncService) {
      try {
        console.log('   - Ensuring Stash configuration loaded...');
        await syncService.ensureConfigLoaded();

        console.log('   - Creating performer in Stash via GraphQL...');
        const createMutation = `
          mutation PerformerCreate($input: PerformerCreateInput!) {
            performerCreate(input: $input) {
              id
              name
              image_path
            }
          }
        `;

        const variables = {
          input: {
            name: name.trim()
          }
        };

        const data = await syncService.makeGraphQLRequest(createMutation, variables);

        if (!data || !data.performerCreate) {
          console.error('   - Failed to create performer in Stash. Response:', data);
          throw new Error('Failed to create performer in Stash - no data returned');
        }

        const stashPerformer = data.performerCreate;
        console.log(`   - ✅ Created in Stash: ${stashPerformer.id} - ${stashPerformer.name}`);

        // Create in local database with Stash ID
        const localPerformer = await this.prisma.stashPerformer.create({
          data: {
            id: stashPerformer.id, // Use Stash ID as primary key
            name: stashPerformer.name,
            image: stashPerformer.image_path || image || null,
            createdAt: new Date(),
            updatedAt: new Date(),
            lastSyncedAt: new Date()
          }
        });

        console.log(`   - ✅ Created in local DB: ${localPerformer.id} - ${localPerformer.name}`);

        return localPerformer;

      } catch (stashError) {
        console.error('   - ❌ Failed to create in Stash:', stashError.message);
        throw new Error(`Failed to create performer in Stash: ${stashError.message}`);
      }
    } else {
      // No sync service - create local-only performer (fallback)
      console.warn('   - ⚠️  No sync service provided - creating local-only performer');
      
      const performer = await this.prisma.stashPerformer.create({
        data: {
          id: stashId || `local-${Date.now()}`, // Generate local ID if not from Stash
          name: name.trim(),
          image: image || null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });

      console.log(`   - ✅ Created local performer: ${performer.name} (${performer.id})`);

      return performer;
    }
  }
}

module.exports = PerformerSwapService;
