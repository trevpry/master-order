const { PrismaClient } = require('@prisma/client');

/**
 * PerformerMergeService - Handles merging multiple performers into one
 * 
 * This service encapsulates all business logic for performer merging:
 * - Merging aliases
 * - Transferring scene relationships
 * - Updating Stash via GraphQL
 * - Cleaning up merged performers
 */
class PerformerMergeService {
  constructor(prisma, stashSyncService) {
    this.prisma = prisma || new PrismaClient();
    this.stashSyncService = stashSyncService;
  }

  /**
   * Merge multiple performers into a single main performer
   * @param {string} mainPerformerId - ID of the performer to merge into
   * @param {string[]} mergePerformerIds - IDs of performers to merge and delete
   * @returns {Promise<{success: boolean, mainPerformer: object, mergedCount: number, error?: string}>}
   */
  async mergePerformers(mainPerformerId, mergePerformerIds) {
    console.log('🔄 [PerformerMerge] Starting merge operation...');
    console.log(`   - Main performer: ${mainPerformerId}`);
    console.log(`   - Merging ${mergePerformerIds.length} performer(s):`, mergePerformerIds);

    try {
      // Validate inputs
      if (!mainPerformerId) {
        throw new Error('Main performer ID is required');
      }
      if (!mergePerformerIds || mergePerformerIds.length === 0) {
        throw new Error('At least one performer to merge is required');
      }
      if (mergePerformerIds.includes(mainPerformerId)) {
        throw new Error('Cannot merge a performer into itself');
      }

      // Fetch all performers
      const mainPerformer = await this.prisma.stashPerformer.findUnique({
        where: { id: mainPerformerId }
      });

      if (!mainPerformer) {
        throw new Error(`Main performer ${mainPerformerId} not found`);
      }

      const mergePerformers = await this.prisma.stashPerformer.findMany({
        where: { id: { in: mergePerformerIds } }
      });

      if (mergePerformers.length !== mergePerformerIds.length) {
        throw new Error('Some performers to merge were not found');
      }

      console.log(`   - Found main performer: ${mainPerformer.name}`);
      console.log(`   - Found ${mergePerformers.length} performers to merge`);

      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Merge aliases
        const updatedAliases = await this._mergeAliases(tx, mainPerformer, mergePerformers);
        console.log(`   - Merged aliases: ${updatedAliases}`);

        // 2. Transfer scene relationships
        const transferredScenes = await this._transferSceneRelationships(tx, mainPerformerId, mergePerformerIds);
        console.log(`   - Transferred ${transferredScenes} scene relationship(s)`);

        // 3. Update main performer with merged aliases
        const updatedMainPerformer = await tx.stashPerformer.update({
          where: { id: mainPerformerId },
          data: { alias: updatedAliases }
        });

        // 4. Delete merged performers from database
        await tx.stashPerformer.deleteMany({
          where: { id: { in: mergePerformerIds } }
        });
        console.log(`   - Deleted ${mergePerformerIds.length} performer(s) from database`);

        return {
          mainPerformer: updatedMainPerformer,
          mergedCount: mergePerformerIds.length,
          transferredScenes
        };
      });

      // 5. Update Stash via GraphQL (outside transaction)
      if (this.stashSyncService) {
        await this._updateStash(mainPerformerId, mergePerformerIds, result.mainPerformer);
      } else {
        console.warn('⚠️  Stash sync service not available, skipping Stash update');
      }

      console.log('✅ [PerformerMerge] Merge completed successfully');
      return {
        success: true,
        mainPerformer: result.mainPerformer,
        mergedCount: result.mergedCount,
        transferredScenes: result.transferredScenes
      };

    } catch (error) {
      console.error('❌ [PerformerMerge] Error during merge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Merge aliases from all performers, removing duplicates
   * @private
   */
  async _mergeAliases(tx, mainPerformer, mergePerformers) {
    const aliasSet = new Set();

    // Add main performer's existing aliases
    if (mainPerformer.aliases) {
      const existingAliases = mainPerformer.aliases.split(',').map(a => a.trim());
      existingAliases.forEach(alias => aliasSet.add(alias));
    }

    // Add all merge performers' names and aliases
    for (const performer of mergePerformers) {
      // Add the performer's name as an alias
      aliasSet.add(performer.name);

      // Add their existing aliases
      if (performer.aliases) {
        const performerAliases = performer.aliases.split(',').map(a => a.trim());
        performerAliases.forEach(alias => aliasSet.add(alias));
      }
    }

    // Remove the main performer's name from aliases (don't alias to itself)
    aliasSet.delete(mainPerformer.name);

    // Convert back to comma-separated string
    return Array.from(aliasSet).filter(a => a).join(', ');
  }

  /**
   * Transfer all scene relationships from merged performers to main performer
   * @private
   */
  async _transferSceneRelationships(tx, mainPerformerId, mergePerformerIds) {
    let transferredCount = 0;

    // Get all scenes for merged performers WITH their tags
    const sceneRelationships = await tx.stashScenePerformer.findMany({
      where: {
        performerId: { in: mergePerformerIds }
      },
      include: {
        tags: true  // Include performer/scene pivot tags
      }
    });

    console.log(`   - Found ${sceneRelationships.length} scene relationship(s) to transfer`);

    for (const relationship of sceneRelationships) {
      // Check if main performer already has this scene
      const existingRelationship = await tx.stashScenePerformer.findUnique({
        where: {
          sceneId_performerId: {
            sceneId: relationship.sceneId,
            performerId: mainPerformerId
          }
        },
        include: {
          tags: true  // Include existing tags to check for duplicates
        }
      });

      if (!existingRelationship) {
        // Create new relationship for main performer
        await tx.stashScenePerformer.create({
          data: {
            sceneId: relationship.sceneId,
            performerId: mainPerformerId,
            notes: relationship.notes  // Transfer notes if any
          }
        });

        // Transfer all pivot tags
        if (relationship.tags && relationship.tags.length > 0) {
          await tx.stashScenePerformerTag.createMany({
            data: relationship.tags.map(tag => ({
              sceneId: relationship.sceneId,
              performerId: mainPerformerId,
              tagId: tag.tagId
            }))
          });
          console.log(`     - Transferred scene ${relationship.sceneId} with ${relationship.tags.length} tag(s) to main performer`);
        } else {
          console.log(`     - Transferred scene ${relationship.sceneId} to main performer`);
        }
        transferredCount++;
      } else {
        console.log(`     - Scene ${relationship.sceneId} already linked to main performer`);
        
        // Merge tags from old performer if scene already exists
        if (relationship.tags && relationship.tags.length > 0) {
          const existingTagIds = new Set(existingRelationship.tags.map(t => t.tagId));
          const newTags = relationship.tags.filter(tag => !existingTagIds.has(tag.tagId));
          
          if (newTags.length > 0) {
            await tx.stashScenePerformerTag.createMany({
              data: newTags.map(tag => ({
                sceneId: relationship.sceneId,
                performerId: mainPerformerId,
                tagId: tag.tagId
              }))
            });
            console.log(`     - Merged ${newTags.length} additional tag(s) for scene ${relationship.sceneId}`);
          }
        }
      }

      // Delete the old relationship (this will cascade delete the tags due to onDelete: Cascade)
      await tx.stashScenePerformer.delete({
        where: {
          sceneId_performerId: {
            sceneId: relationship.sceneId,
            performerId: relationship.performerId
          }
        }
      });
    }

    return transferredCount;
  }

  /**
   * Update Stash via GraphQL
   * @private
   */
  async _updateStash(mainPerformerId, mergePerformerIds, updatedMainPerformer) {
    console.log('📡 [PerformerMerge] Updating Stash via GraphQL...');

    try {
      // First, fetch current aliases from Stash to preserve them
      const fetchQuery = `
        query FindPerformer($id: ID!) {
          findPerformer(id: $id) {
            id
            name
            alias_list
          }
        }
      `;

      console.log('   - Fetching current performer data from Stash');
      const currentData = await this.stashSyncService.makeGraphQLRequest(fetchQuery, { id: mainPerformerId });
      const currentAliases = currentData?.findPerformer?.alias_list || [];
      console.log('   - Current aliases in Stash:', currentAliases);
      console.log('   - Merged aliases from local DB:', updatedMainPerformer.alias);

      // Combine current Stash aliases with new merged aliases
      const newAliases = updatedMainPerformer.alias ? updatedMainPerformer.alias.split(',').map(a => a.trim()).filter(a => a) : [];
      const combinedAliasesSet = new Set([...currentAliases, ...newAliases]);
      const combinedAliases = Array.from(combinedAliasesSet);
      
      console.log('   - Combined aliases to set in Stash:', combinedAliases);

      // Update main performer with merged aliases
      const updateMutation = `
        mutation PerformerUpdate($input: PerformerUpdateInput!) {
          performerUpdate(input: $input) {
            id
            name
            alias_list
          }
        }
      `;

      const updateVariables = {
        input: {
          id: mainPerformerId,
          alias_list: combinedAliases
        }
      };

      console.log('   - Updating main performer aliases in Stash');
      const updateResult = await this.stashSyncService.makeGraphQLRequest(updateMutation, updateVariables);
      
      if (updateResult?.performerUpdate) {
        console.log('   - ✅ Main performer updated in Stash');
        console.log('   - Updated aliases:', updateResult.performerUpdate.alias_list);
      }

      // Delete merged performers from Stash
      const deleteMutation = `
        mutation PerformerDestroy($input: PerformerDestroyInput!) {
          performerDestroy(input: $input)
        }
      `;

      for (const performerId of mergePerformerIds) {
        const deleteVariables = {
          input: {
            id: performerId
          }
        };

        console.log(`   - Deleting performer ${performerId} from Stash`);
        const deleteResult = await this.stashSyncService.makeGraphQLRequest(deleteMutation, deleteVariables);
        
        if (deleteResult?.performerDestroy) {
          console.log(`   - ✅ Performer ${performerId} deleted from Stash`);
        }
      }

      // Update scenes in Stash to replace merged performer IDs with main performer ID
      console.log('   - Updating scenes in Stash...');
      
      // Get all scenes that had any of the merged performers
      const affectedScenes = await this.prisma.stashScenePerformer.findMany({
        where: {
          performerId: mainPerformerId
        },
        select: {
          sceneId: true
        }
      });

      const uniqueSceneIds = [...new Set(affectedScenes.map(s => s.sceneId))];
      console.log(`   - Found ${uniqueSceneIds.length} scene(s) to update in Stash`);

      for (const sceneId of uniqueSceneIds) {
        try {
          // Get all current performers for this scene from local DB (after merge)
          const scenePerformers = await this.prisma.stashScenePerformer.findMany({
            where: { sceneId },
            select: { performerId: true }
          });

          const performerIds = scenePerformers.map(sp => sp.performerId);

          // Update scene in Stash with correct performer list
          const sceneUpdateMutation = `
            mutation SceneUpdate($input: SceneUpdateInput!) {
              sceneUpdate(input: $input) {
                id
                performers {
                  id
                  name
                }
              }
            }
          `;

          const sceneUpdateVariables = {
            input: {
              id: sceneId,
              performer_ids: performerIds
            }
          };

          console.log(`     - Updating scene ${sceneId} with ${performerIds.length} performer(s)`);
          const sceneUpdateResult = await this.stashSyncService.makeGraphQLRequest(sceneUpdateMutation, sceneUpdateVariables);

          if (sceneUpdateResult?.sceneUpdate) {
            console.log(`     - ✅ Scene ${sceneId} updated in Stash`);
          }
        } catch (sceneError) {
          console.error(`     - ❌ Failed to update scene ${sceneId}:`, sceneError.message);
          // Continue with other scenes
        }
      }

      console.log('✅ [PerformerMerge] Stash updates completed');

    } catch (error) {
      console.error('❌ [PerformerMerge] Error updating Stash:', error.message);
      // Don't throw - local database changes are already committed
      console.warn('⚠️  Local changes completed, but Stash sync failed. Manual cleanup may be required.');
    }
  }
}

module.exports = PerformerMergeService;
