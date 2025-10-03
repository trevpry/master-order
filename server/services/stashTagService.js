/**
 * StashTagService
 * Business logic for retrieving hierarchical Stash tags and performing create/delete operations.
 * Keeps route handlers lightweight and reusable across Android/web contexts.
 */
const prisma = require('../prismaClient');

class StashTagService {
  /** Build a tag hierarchy tree.
   * Options:
   *  - includeCounts: include counts of related scenes/images/performers/clips
   */
  async getHierarchy(options = {}) {
    const { includeCounts = false } = options;

    // Fetch all tags with hierarchy relations in one go
    const tags = await prisma.stashTag.findMany({
      include: {
        parentTags: { include: { parentTag: { select: { id: true, name: true } } } },
        childTags: { include: { childTag: { select: { id: true, name: true } } } },
        ...(includeCounts && {
          scenes: true,
          performers: true,
          images: true,
          galleries: true,
          clips: true
        })
      }
    });

    // Index tags for quick lookup
    const tagMap = new Map();
    tags.forEach(t => {
      tagMap.set(t.id, {
        id: t.id,
        name: t.name,
        description: t.description,
        favorite: t.favorite,
        ignoreAutoTag: t.ignoreAutoTag,
        image: t.image,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        parents: t.parentTags.map(pt => ({ id: pt.parentTag.id, name: pt.parentTag.name })),
        children: t.childTags.map(ct => ({ id: ct.childTag.id, name: ct.childTag.name })),
        ...(includeCounts && {
          counts: {
            scenes: t.scenes.length,
            performers: t.performers.length,
            images: t.images.length,
            galleries: t.galleries.length,
            clips: t.clips.length
          }
        })
      });
    });

    // Roots are tags without parents
    const roots = Array.from(tagMap.values()).filter(t => t.parents.length === 0);

    return {
      total: tags.length,
      roots,
      tags: Array.from(tagMap.values())
    };
  }

  /** Create a tag and optional hierarchy links */
  async createTag({ name, description = null, parentIds = [] }) {
    if (!name || !name.trim()) {
      throw new Error('Tag name is required');
    }

    // Create the tag (UUID string id expected by schema)
    const { v4: uuid } = require('uuid');
    const tagId = uuid();

    const tag = await prisma.stashTag.create({
      data: {
        id: tagId,
        name: name.trim(),
        description: description || null
      }
    });

    // Create hierarchy relationships if parentIds provided
    if (Array.isArray(parentIds) && parentIds.length) {
      const hierarchyData = parentIds.map(parentTagId => ({ parentTagId, childTagId: tag.id }));
      await prisma.stashTagHierarchy.createMany({ data: hierarchyData, skipDuplicates: true });
    }

    return tag;
  }

  /** Delete a tag. Also removes hierarchy and aliases via cascade. */
  async deleteTag(tagId) {
    if (!tagId) throw new Error('tagId required');

    try {
      await prisma.stashTag.delete({ where: { id: tagId } });
      return { success: true };
    } catch (error) {
      if (error.code === 'P2025') {
        return { success: false, notFound: true };
      }
      throw error;
    }
  }
}

module.exports = StashTagService;
