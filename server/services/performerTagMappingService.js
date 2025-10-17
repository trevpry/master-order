/**
 * PerformerTagMappingService
 * Modular service for mapping performer attributes (ethnicity, etc.) to tags
 * 
 * Handles:
 * - Finding tags under parent categories
 * - Matching by name or aliases
 * - Creating new tags in both local DB and Stash
 * - Maintaining tag hierarchy
 */

const prisma = require('../prismaClient');
const { v4: uuid } = require('uuid');

class PerformerTagMappingService {
  constructor(stashApiClient = null) {
    this.stashApiClient = stashApiClient; // Injected for making GraphQL requests
  }

  /**
   * Find or create a tag under a parent category
   * @param {string} value - The tag value to find/create (e.g., "Asian")
   * @param {string} parentTagName - Parent tag name (e.g., "Race")
   * @returns {Promise<{id: string, name: string, created: boolean}>}
   */
  async findOrCreateTag(value, parentTagName) {
    if (!value || !value.trim()) {
      return null;
    }

    const normalizedValue = value.trim();
    
    // Step 1: Find the parent tag
    const parentTag = await this.findParentTag(parentTagName);
    
    if (!parentTag) {
      console.warn(`⚠️  Parent tag "${parentTagName}" not found. Tag mapping skipped for value: "${normalizedValue}"`);
      return null;
    }

    // Step 2: Search for existing child tag by name or alias
    const existingTag = await this.findChildTagByNameOrAlias(parentTag.id, normalizedValue);
    
    if (existingTag) {
      console.log(`✅ Found existing tag: "${existingTag.name}" (ID: ${existingTag.id}) under "${parentTagName}"`);
      return {
        id: existingTag.id,
        name: existingTag.name,
        created: false
      };
    }

    // Step 3: Tag doesn't exist - create it
    console.log(`🆕 Creating new tag: "${normalizedValue}" under "${parentTagName}"`);
    
    try {
      const newTag = await this.createTagInStashAndDB(normalizedValue, parentTag.id);
      
      console.log(`✅ Created tag: "${newTag.name}" (ID: ${newTag.id}) under "${parentTagName}"`);
      return {
        id: newTag.id,
        name: newTag.name,
        created: true
      };
    } catch (error) {
      console.error(`❌ Failed to create tag "${normalizedValue}" under "${parentTagName}":`, error.message);
      return null;
    }
  }

  /**
   * Find parent tag by name
   * @param {string} parentTagName
   * @returns {Promise<{id: string, name: string}|null>}
   */
  async findParentTag(parentTagName) {
    const parentTag = await prisma.stashTag.findFirst({
      where: { name: parentTagName },
      select: { id: true, name: true }
    });

    return parentTag;
  }

  /**
   * Find child tag under parent by name or alias (case-insensitive)
   * @param {string} parentTagId
   * @param {string} searchValue
   * @returns {Promise<{id: string, name: string}|null>}
   */
  async findChildTagByNameOrAlias(parentTagId, searchValue) {
    const normalizedSearch = searchValue.toLowerCase();

    // Get all children of parent tag
    const childHierarchies = await prisma.stashTagHierarchy.findMany({
      where: { parentTagId },
      include: {
        childTag: {
          include: {
            aliases: true
          }
        }
      }
    });

    // Search through children for name or alias match
    for (const hierarchy of childHierarchies) {
      const tag = hierarchy.childTag;
      
      // Check tag name (case-insensitive)
      if (tag.name.toLowerCase() === normalizedSearch) {
        return { id: tag.id, name: tag.name };
      }

      // Check aliases (case-insensitive)
      for (const aliasObj of tag.aliases) {
        if (aliasObj.alias.toLowerCase() === normalizedSearch) {
          return { id: tag.id, name: tag.name };
        }
      }
    }

    return null;
  }

  /**
   * Create tag in both Stash (via GraphQL) and local database
   * @param {string} name
   * @param {string} parentTagId
   * @returns {Promise<{id: string, name: string}>}
   */
  async createTagInStashAndDB(name, parentTagId) {
    // Step 1: Create tag in Stash via GraphQL
    let stashTagId;
    
    if (this.stashApiClient) {
      try {
        stashTagId = await this.createTagInStash(name, parentTagId);
        console.log(`✅ Created tag in Stash: "${name}" (ID: ${stashTagId})`);
      } catch (error) {
        console.warn(`⚠️  Failed to create tag in Stash, creating locally only:`, error.message);
        // Fall back to local UUID if Stash creation fails
        stashTagId = uuid();
      }
    } else {
      // No Stash API client - use local UUID
      stashTagId = uuid();
    }

    // Step 2: Create tag in local database
    const tag = await prisma.stashTag.create({
      data: {
        id: stashTagId,
        name: name.trim(),
        description: null,
        lastSyncedAt: new Date()
      }
    });

    // Step 3: Create hierarchy relationship
    await prisma.stashTagHierarchy.create({
      data: {
        parentTagId: parentTagId,
        childTagId: tag.id
      }
    });

    return { id: tag.id, name: tag.name };
  }

  /**
   * Create tag in Stash via GraphQL mutation
   * @param {string} name
   * @param {string} parentTagId
   * @returns {Promise<string>} - The created tag ID
   */
  async createTagInStash(name, parentTagId) {
    if (!this.stashApiClient) {
      throw new Error('Stash API client not configured');
    }

    const mutation = `
      mutation TagCreate($input: TagCreateInput!) {
        tagCreate(input: $input) {
          id
          name
        }
      }
    `;

    const variables = {
      input: {
        name: name.trim(),
        parent_ids: [parentTagId]
      }
    };

    try {
      const data = await this.stashApiClient(mutation, variables);
      
      if (!data.tagCreate || !data.tagCreate.id) {
        throw new Error('Tag creation returned no ID');
      }

      return data.tagCreate.id;
    } catch (error) {
      console.error('Stash GraphQL mutation failed:', error);
      throw error;
    }
  }

  /**
   * Batch process multiple attribute mappings for a performer
   * @param {Object} attributes - {ethnicity: "value", ...}
   * @param {Object} parentTagNames - {ethnicity: "Race", ...}
   * @returns {Promise<Object>} - {ethnicity: {id, name}, ...}
   */
  async mapPerformerAttributes(attributes, parentTagNames) {
    const results = {};

    for (const [attrName, attrValue] of Object.entries(attributes)) {
      if (!attrValue || !parentTagNames[attrName]) {
        continue;
      }

      const tag = await this.findOrCreateTag(attrValue, parentTagNames[attrName]);
      
      if (tag) {
        results[attrName] = tag;
      }
    }

    return results;
  }
}

module.exports = PerformerTagMappingService;
