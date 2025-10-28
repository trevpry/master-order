const { PrismaClient } = require('@prisma/client');

/**
 * TagMergeService - Handles merging multiple tags into one
 * 
 * This service encapsulates all business logic for tag merging:
 * - Merging aliases
 * - Transferring performer tags
 * - Transferring scene tags
 * - Transferring performer/scene pivot tags
 * - Updating Stash via GraphQL
 * - Cleaning up merged tags
 */
class TagMergeService {
  constructor(prisma, stashSyncService) {
    this.prisma = prisma || new PrismaClient();
    this.stashSyncService = stashSyncService;
  }

  /**
   * Merge multiple tags into a single main tag
   * @param {string} mainTagId - ID of the tag to merge into
   * @param {string[]} mergeTagIds - IDs of tags to merge and delete
   * @returns {Promise<{success: boolean, mainTag: object, mergedCount: number, error?: string}>}
   */
  async mergeTags(mainTagId, mergeTagIds) {
    console.log('🔄 [TagMerge] Starting merge operation...');
    console.log(`   - Main tag: ${mainTagId}`);
    console.log(`   - Merging ${mergeTagIds.length} tag(s):`, mergeTagIds);

    try {
      // Validate inputs
      if (!mainTagId) {
        throw new Error('Main tag ID is required');
      }
      if (!mergeTagIds || mergeTagIds.length === 0) {
        throw new Error('At least one tag to merge is required');
      }
      if (mergeTagIds.includes(mainTagId)) {
        throw new Error('Cannot merge a tag into itself');
      }

      // Fetch all tags
      const mainTag = await this.prisma.stashTag.findUnique({
        where: { id: mainTagId }
      });

      if (!mainTag) {
        throw new Error(`Main tag ${mainTagId} not found`);
      }

      const mergeTags = await this.prisma.stashTag.findMany({
        where: { id: { in: mergeTagIds } }
      });

      if (mergeTags.length !== mergeTagIds.length) {
        const foundIds = mergeTags.map(t => t.id);
        const missingIds = mergeTagIds.filter(id => !foundIds.includes(id));
        throw new Error(`Tags not found: ${missingIds.join(', ')}. They may have already been deleted or merged.`);
      }

      console.log(`   - Found main tag: ${mainTag.name}`);
      console.log(`   - Found ${mergeTags.length} tags to merge`);

      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Merge aliases
        const updatedAliases = await this._mergeAliases(tx, mainTag, mergeTags);
        console.log(`   - Merged aliases: ${updatedAliases}`);

        // 2. Transfer performer tags
        const transferredPerformerTags = await this._transferPerformerTags(tx, mainTagId, mergeTagIds);
        console.log(`   - Transferred ${transferredPerformerTags} performer tag(s)`);

        // 3. Transfer scene tags
        const transferredSceneTags = await this._transferSceneTags(tx, mainTagId, mergeTagIds);
        console.log(`   - Transferred ${transferredSceneTags} scene tag(s)`);

        // 4. Transfer performer/scene pivot tags
        const transferredPivotTags = await this._transferPivotTags(tx, mainTagId, mergeTagIds);
        console.log(`   - Transferred ${transferredPivotTags} performer/scene pivot tag(s)`);

        // 5. Merge aliases into main tag
        await this._mergeAliases(tx, mainTag, mergeTags);
        console.log(`   - Merged aliases into main tag`);

        // 6. Delete merged tags from database
        await tx.stashTag.deleteMany({
          where: { id: { in: mergeTagIds } }
        });
        console.log(`   - Deleted ${mergeTagIds.length} tag(s) from database`);

        // 7. Fetch updated main tag with aliases
        const updatedMainTag = await tx.stashTag.findUnique({
          where: { id: mainTagId },
          include: { aliases: true }
        });

        return {
          mainTag: updatedMainTag,
          mergedCount: mergeTagIds.length,
          transferredPerformerTags,
          transferredSceneTags,
          transferredPivotTags
        };
      });

      // 7. Update Stash via GraphQL (outside transaction)
      if (this.stashSyncService) {
        await this._updateStash(mainTagId, mergeTagIds, result.mainTag);
      } else {
        console.warn('⚠️  Stash sync service not available, skipping Stash update');
      }

      console.log('✅ [TagMerge] Merge completed successfully');
      return {
        success: true,
        mainTag: result.mainTag,
        mergedCount: result.mergedCount,
        transferredPerformerTags: result.transferredPerformerTags,
        transferredSceneTags: result.transferredSceneTags,
        transferredPivotTags: result.transferredPivotTags
      };

    } catch (error) {
      console.error('❌ [TagMerge] Error during merge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Merge aliases from all tags, removing duplicates
   * @private
   */
  /**
   * Merge aliases from merged tags into main tag
   * @private
   */
  async _mergeAliases(tx, mainTag, mergeTags) {
    const aliasSet = new Set();

    // Get existing aliases for the main tag
    const existingAliases = await tx.stashTagAlias.findMany({
      where: { tagId: mainTag.id }
    });
    existingAliases.forEach(a => aliasSet.add(a.alias));

    // Add all merge tags' names and their aliases
    for (const tag of mergeTags) {
      // Add the merged tag's name as an alias (don't merge into itself)
      if (tag.name !== mainTag.name) {
        aliasSet.add(tag.name);
      }

      // Get and add their existing aliases
      const tagAliases = await tx.stashTagAlias.findMany({
        where: { tagId: tag.id }
      });
      tagAliases.forEach(a => aliasSet.add(a.alias));
    }

    // Remove the main tag's name from aliases (don't alias to itself)
    aliasSet.delete(mainTag.name);

    // Create new alias records for any that don't exist
    const newAliases = Array.from(aliasSet).filter(a => a);
    for (const alias of newAliases) {
      await tx.stashTagAlias.upsert({
        where: {
          tagId_alias: {
            tagId: mainTag.id,
            alias: alias
          }
        },
        create: {
          tagId: mainTag.id,
          alias: alias
        },
        update: {} // No updates needed if it already exists
      });
    }

    console.log(`   - Created/verified ${newAliases.length} alias(es) for main tag`);
  }

  /**
   * Transfer all performer tags from merged tags to main tag
   * @private
   */
  async _transferPerformerTags(tx, mainTagId, mergeTagIds) {
    let transferredCount = 0;

    // Get all performer tags for merged tags
    const performerTags = await tx.stashPerformerTag.findMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    console.log(`   - Found ${performerTags.length} performer tag(s) to transfer`);

    for (const performerTag of performerTags) {
      // Check if main tag already exists for this performer
      const existingTag = await tx.stashPerformerTag.findUnique({
        where: {
          performerId_tagId: {
            performerId: performerTag.performerId,
            tagId: mainTagId
          }
        }
      });

      if (!existingTag) {
        // Create new tag relationship for main tag
        await tx.stashPerformerTag.create({
          data: {
            performerId: performerTag.performerId,
            tagId: mainTagId
          }
        });
        transferredCount++;
      } else {
        console.log(`     - Performer ${performerTag.performerId} already has main tag, skipping`);
      }
    }

    // Delete old tag relationships
    await tx.stashPerformerTag.deleteMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    return transferredCount;
  }

  /**
   * Transfer all scene tags from merged tags to main tag
   * @private
   */
  async _transferSceneTags(tx, mainTagId, mergeTagIds) {
    let transferredCount = 0;

    // Get all scene tags for merged tags
    const sceneTags = await tx.stashSceneTag.findMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    console.log(`   - Found ${sceneTags.length} scene tag(s) to transfer`);

    for (const sceneTag of sceneTags) {
      // Check if main tag already exists for this scene
      const existingTag = await tx.stashSceneTag.findUnique({
        where: {
          sceneId_tagId: {
            sceneId: sceneTag.sceneId,
            tagId: mainTagId
          }
        }
      });

      if (!existingTag) {
        // Create new tag relationship for main tag
        await tx.stashSceneTag.create({
          data: {
            sceneId: sceneTag.sceneId,
            tagId: mainTagId
          }
        });
        transferredCount++;
      } else {
        console.log(`     - Scene ${sceneTag.sceneId} already has main tag, skipping`);
      }
    }

    // Delete old tag relationships
    await tx.stashSceneTag.deleteMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    return transferredCount;
  }

  /**
   * Transfer all performer/scene pivot tags from merged tags to main tag
   * @private
   */
  async _transferPivotTags(tx, mainTagId, mergeTagIds) {
    let transferredCount = 0;

    // Get all pivot tags for merged tags
    const pivotTags = await tx.stashScenePerformerTag.findMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    console.log(`   - Found ${pivotTags.length} performer/scene pivot tag(s) to transfer`);

    for (const pivotTag of pivotTags) {
      // Check if main tag already exists for this performer/scene combination
      const existingTag = await tx.stashScenePerformerTag.findUnique({
        where: {
          sceneId_performerId_tagId: {
            sceneId: pivotTag.sceneId,
            performerId: pivotTag.performerId,
            tagId: mainTagId
          }
        }
      });

      if (!existingTag) {
        // Create new tag relationship for main tag
        await tx.stashScenePerformerTag.create({
          data: {
            sceneId: pivotTag.sceneId,
            performerId: pivotTag.performerId,
            tagId: mainTagId
          }
        });
        transferredCount++;
      } else {
        console.log(`     - Scene ${pivotTag.sceneId}/Performer ${pivotTag.performerId} already has main tag, skipping`);
      }
    }

    // Delete old tag relationships
    await tx.stashScenePerformerTag.deleteMany({
      where: {
        tagId: { in: mergeTagIds }
      }
    });

    return transferredCount;
  }

  /**
   * Update Stash via GraphQL to merge tags
   * @private
   */
  async _updateStash(mainTagId, mergeTagIds, updatedMainTag) {
    console.log('🔄 [TagMerge] Updating Stash...');

    try {
      // Extract alias strings from StashTagAlias objects
      const aliasStrings = updatedMainTag.aliases 
        ? updatedMainTag.aliases.map(a => a.alias) 
        : [];
      
      // Update main tag with merged aliases
      await this.stashSyncService.updateTag(parseInt(mainTagId), {
        aliases: aliasStrings
      });
      console.log(`   - Updated main tag ${mainTagId} in Stash with ${aliasStrings.length} alias(es)`);

      // Merge tags in Stash
      for (const mergeTagId of mergeTagIds) {
        try {
          await this.stashSyncService.tagMerge(parseInt(mergeTagId), parseInt(mainTagId));
          console.log(`   - Merged tag ${mergeTagId} into ${mainTagId} in Stash`);
        } catch (error) {
          console.error(`   - Error merging tag ${mergeTagId} in Stash:`, error.message);
        }
      }

    } catch (error) {
      console.error('❌ [TagMerge] Error updating Stash:', error);
      throw error;
    }
  }
}

module.exports = TagMergeService;
