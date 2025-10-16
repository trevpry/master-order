const { PrismaClient } = require('@prisma/client');

/**
 * Service for managing scene-performer pivot relationships with metadata
 * Handles scene-specific performer information like character names, roles, etc.
 */
class ScenePerformerService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get all performers for a scene with their scene-specific metadata
   * @param {string} sceneId - The scene ID
   * @returns {Promise<Array>} Array of performer relationships with metadata
   */
  async getScenePerformers(sceneId) {
    return await this.prisma.stashScenePerformer.findMany({
      where: { sceneId },
      include: {
        performer: true,
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: {
        performer: { name: 'asc' }
      }
    });
  }

  /**
   * Get all scenes for a performer with scene-specific metadata
   * @param {string} performerId - The performer ID
   * @returns {Promise<Array>} Array of scene relationships with metadata
   */
  async getPerformerScenes(performerId) {
    return await this.prisma.stashScenePerformer.findMany({
      where: { performerId },
      include: {
        scene: {
          include: {
            studioObject: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: {
        scene: { date: 'desc' }
      }
    });
  }

  /**
   * Add or update performer metadata for a scene
   * @param {string} sceneId - The scene ID
   * @param {string} performerId - The performer ID
   * @param {Object} metadata - Scene-specific metadata
   * @param {string} [metadata.notes] - Scene-specific notes
   * @param {Array<string>} [metadata.tagIds] - Array of body attribute tag IDs
   * @returns {Promise<Object>} Updated performer relationship
   */
  async updatePerformerMetadata(sceneId, performerId, metadata) {
    const data = {
      notes: metadata.notes || null
    };

    // Update or create the scene-performer relationship
    const relationship = await this.prisma.stashScenePerformer.upsert({
      where: {
        sceneId_performerId: {
          sceneId,
          performerId
        }
      },
      update: data,
      create: {
        sceneId,
        performerId,
        ...data
      }
    });

    // Handle tags if provided
    if (metadata.tagIds && Array.isArray(metadata.tagIds)) {
      // Delete existing tags
      await this.prisma.stashScenePerformerTag.deleteMany({
        where: {
          sceneId,
          performerId
        }
      });

      // Add new tags
      if (metadata.tagIds.length > 0) {
        await this.prisma.stashScenePerformerTag.createMany({
          data: metadata.tagIds.map(tagId => ({
            sceneId,
            performerId,
            tagId
          })),
          skipDuplicates: true
        });
      }
    }

    // Return the updated relationship with tags
    return await this.prisma.stashScenePerformer.findUnique({
      where: {
        sceneId_performerId: {
          sceneId,
          performerId
        }
      },
      include: {
        performer: true,
        scene: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
  }

  /**
   * Add a performer to a scene with optional metadata
   * @param {string} sceneId - The scene ID
   * @param {string} performerId - The performer ID
   * @param {Object} [metadata] - Optional scene-specific metadata
   * @returns {Promise<Object>} Created performer relationship
   */
  async addPerformerToScene(sceneId, performerId, metadata = {}) {
    return await this.updatePerformerMetadata(sceneId, performerId, metadata);
  }

  /**
   * Remove a performer from a scene
   * @param {string} sceneId - The scene ID
   * @param {string} performerId - The performer ID
   * @returns {Promise<Object>} Deleted relationship
   */
  async removePerformerFromScene(sceneId, performerId) {
    return await this.prisma.stashScenePerformer.delete({
      where: {
        sceneId_performerId: {
          sceneId,
          performerId
        }
      }
    });
  }

  /**
   * Get specific performer metadata for a scene
   * @param {string} sceneId - The scene ID
   * @param {string} performerId - The performer ID
   * @returns {Promise<Object|null>} Performer relationship with metadata
   */
  async getPerformerMetadata(sceneId, performerId) {
    return await this.prisma.stashScenePerformer.findUnique({
      where: {
        sceneId_performerId: {
          sceneId,
          performerId
        }
      },
      include: {
        performer: true,
        tags: {
          include: {
            tag: true
          }
        }
      }
    });
  }

  /**
   * Bulk update performer metadata for multiple performers in a scene
   * @param {string} sceneId - The scene ID
   * @param {Array<Object>} performers - Array of {performerId, metadata} objects
   * @returns {Promise<Array>} Array of updated relationships
   */
  async bulkUpdatePerformers(sceneId, performers) {
    const updates = performers.map(({ performerId, metadata }) =>
      this.updatePerformerMetadata(sceneId, performerId, metadata)
    );

    return await Promise.all(updates);
  }

  /**
   * Get all tags that are children of "Body Attributes" parent tag
   * @returns {Promise<Array>} Array of body attribute tags
   */
  async getBodyAttributeTags() {
    // First find the "Body Attributes" parent tag
    const bodyAttributesTag = await this.prisma.stashTag.findFirst({
      where: {
        name: {
          equals: 'Body Attributes'
        }
      }
    });

    if (!bodyAttributesTag) {
      return [];
    }

    // Get all child tags of Body Attributes
    const hierarchy = await this.prisma.stashTagHierarchy.findMany({
      where: {
        parentTagId: bodyAttributesTag.id
      },
      include: {
        childTag: true
      }
    });

    return hierarchy.map(h => h.childTag);
  }

  /**
   * Get all body attribute tags with their hierarchical children
   * @returns {Promise<Array>} Array of body attribute tags with nested children
   */
  async getBodyAttributeTagsHierarchy() {
    // First find the "Body Attributes" parent tag
    const bodyAttributesTag = await this.prisma.stashTag.findFirst({
      where: {
        name: {
          equals: 'Body Attributes'
        }
      }
    });

    if (!bodyAttributesTag) {
      return [];
    }

    // Get all descendant tags recursively
    const getAllDescendants = async (parentId) => {
      const children = await this.prisma.stashTagHierarchy.findMany({
        where: {
          parentTagId: parentId
        },
        include: {
          childTag: true
        }
      });

      const result = [];
      for (const child of children) {
        const tag = child.childTag;
        const descendants = await getAllDescendants(tag.id);
        result.push({
          ...tag,
          children: descendants
        });
      }

      return result;
    };

    return await getAllDescendants(bodyAttributesTag.id);
  }
}

module.exports = ScenePerformerService;
