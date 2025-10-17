/**
 * Action Code Service
 * Parses GEVI action codes and maps them to tags
 */

class ActionCodeService {
  /**
   * Parse action code and return array of tag names
   * @param {string} actionCode - GEVI action code (e.g., "OgrAt")
   * @returns {Array<string>} Array of tag names
   */
  parseActionCode(actionCode) {
    if (!actionCode) return [];
    
    const tags = [];
    const code = actionCode.toUpperCase();
    
    // Oral actions
    if (code.includes('OGR')) {
      tags.push('Oral - Give', 'Oral - Receive');
    } else if (code.includes('OG')) {
      tags.push('Oral - Give');
    } else if (code.includes('OR')) {
      tags.push('Oral - Receive');
    }
    
    // Anal actions (Top/Bottom)
    if (code.includes('ATB')) {
      tags.push('Top', 'Bottom');
    } else if (code.includes('AT')) {
      tags.push('Top');
    } else if (code.includes('AB')) {
      tags.push('Bottom');
    }
    
    // Rimming actions
    if (code.includes('RGR')) {
      tags.push('Rim - Give', 'Rim - Receive');
    } else if (code.includes('RG')) {
      tags.push('Rim - Give');
    } else if (code.includes('RR')) {
      tags.push('Rim - Receive');
    }
    
    return tags;
  }

  /**
   * Apply tags to scene-performer relationship
   * @param {string} sceneId - Scene ID
   * @param {string} performerId - Performer ID
   * @param {string} actionCode - Action code from GEVI
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Result with applied tags
   */
  async applyActionCodeTags(sceneId, performerId, actionCode, prisma) {
    const tagNames = this.parseActionCode(actionCode);
    
    if (tagNames.length === 0) {
      return {
        success: true,
        appliedTags: [],
        message: 'No tags to apply'
      };
    }

    console.log(`🏷️  [Action Code] Applying tags for performer ${performerId} in scene ${sceneId}`);
    console.log(`   - Action code: ${actionCode}`);
    console.log(`   - Tags to apply: ${tagNames.join(', ')}`);

    const appliedTags = [];
    const missingTags = [];

    for (const tagName of tagNames) {
      // Find or create the tag
      let tag = await prisma.stashTag.findFirst({
        where: { name: tagName }
      });

      if (!tag) {
        console.log(`   ⚠️  Tag "${tagName}" not found in database, skipping`);
        missingTags.push(tagName);
        continue;
      }

      // Create the scene-performer-tag relationship (upsert to avoid duplicates)
      try {
        await prisma.stashScenePerformerTag.upsert({
          where: {
            sceneId_performerId_tagId: {
              sceneId: sceneId,
              performerId: performerId,
              tagId: tag.id
            }
          },
          create: {
            sceneId: sceneId,
            performerId: performerId,
            tagId: tag.id
          },
          update: {} // No update needed, just ensure it exists
        });

        appliedTags.push(tagName);
        console.log(`   ✅ Applied tag: ${tagName}`);
      } catch (error) {
        console.error(`   ❌ Error applying tag "${tagName}":`, error.message);
      }
    }

    return {
      success: true,
      appliedTags,
      missingTags,
      message: `Applied ${appliedTags.length} tags${missingTags.length > 0 ? `, ${missingTags.length} tags not found` : ''}`
    };
  }

  /**
   * Apply action code tags for multiple performers
   * @param {string} sceneId - Scene ID
   * @param {Array} performers - Array of performer objects with id and actionCode
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Summary of applied tags
   */
  async applyActionCodeTagsForPerformers(sceneId, performers, prisma) {
    const results = {
      success: true,
      totalApplied: 0,
      totalMissing: 0,
      performerResults: []
    };

    for (const performer of performers) {
      if (!performer.id || !performer.actionCode) {
        continue;
      }

      const result = await this.applyActionCodeTags(
        sceneId,
        performer.id,
        performer.actionCode,
        prisma
      );

      results.totalApplied += result.appliedTags.length;
      results.totalMissing += result.missingTags ? result.missingTags.length : 0;
      results.performerResults.push({
        performerId: performer.id,
        performerName: performer.name,
        actionCode: performer.actionCode,
        appliedTags: result.appliedTags,
        missingTags: result.missingTags || []
      });
    }

    return results;
  }
}

module.exports = ActionCodeService;
