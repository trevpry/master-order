const { PrismaClient } = require('@prisma/client');

/**
 * MetadataResolutionService
 * 
 * Implements the three-tier metadata system: MusicBrainz → User Overrides → Plex Files
 * Provides field-level source control for artist, album, track, and work metadata.
 * 
 * Priority hierarchy:
 * 1. User overrides (highest priority) - manual edits take precedence
 * 2. MusicBrainz data (middle priority) - curated metadata
 * 3. Plex file data (lowest priority) - fallback to file tags
 */
class MetadataResolutionService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Resolve a single field's value for an entity
   * @param {string} entityType - 'artist', 'album', 'track', or 'work'
   * @param {string} entityKey - Entity's ratingKey or ID
   * @param {string} field - Field name to resolve
   * @returns {Promise<{value: any, source: string}>}
   */
  async resolveField(entityType, entityKey, field) {
    // Get the entity and its preference
    const entity = await this.getEntity(entityType, entityKey);
    if (!entity) {
      throw new Error(`${entityType} not found: ${entityKey}`);
    }

    // Parse metadata preferences
    const preferences = entity.metadataPreferences 
      ? JSON.parse(entity.metadataPreferences)
      : {};
    
    const preferredSource = preferences[field];

    // If user has set a preference, try to use that source
    if (preferredSource) {
      const sourceValue = await this.getFieldFromSource(entityType, entityKey, field, preferredSource, entity);
      if (sourceValue !== null && sourceValue !== undefined) {
        return { value: sourceValue, source: preferredSource };
      }
    }

    // Fall back to default priority: user → musicbrainz → plex
    const sources = ['user', 'musicbrainz', 'plex'];
    for (const source of sources) {
      const value = await this.getFieldFromSource(entityType, entityKey, field, source, entity);
      if (value !== null && value !== undefined) {
        return { value, source };
      }
    }

    return { value: null, source: 'none' };
  }

  /**
   * Get all available sources for a field
   * @param {string} entityType
   * @param {string} entityKey
   * @param {string} field
   * @returns {Promise<{user: any, musicbrainz: any, plex: any}>}
   */
  async getAllFieldSources(entityType, entityKey, field) {
    const entity = await this.getEntity(entityType, entityKey);
    if (!entity) {
      throw new Error(`${entityType} not found: ${entityKey}`);
    }

    const sources = {
      user: await this.getFieldFromSource(entityType, entityKey, field, 'user', entity),
      musicbrainz: await this.getFieldFromSource(entityType, entityKey, field, 'musicbrainz', entity),
      plex: await this.getFieldFromSource(entityType, entityKey, field, 'plex', entity)
    };

    return sources;
  }

  /**
   * Get complete resolved metadata for an entity
   * @param {string} entityType
   * @param {string} entityKey
   * @returns {Promise<Object>}
   */
  async getResolvedMetadata(entityType, entityKey) {
    const entity = await this.getEntity(entityType, entityKey);
    if (!entity) {
      throw new Error(`${entityType} not found: ${entityKey}`);
    }

    const fields = this.getFieldsForEntityType(entityType);
    const resolved = {};
    const sources = {};

    for (const field of fields) {
      const result = await this.resolveField(entityType, entityKey, field);
      resolved[field] = result.value;
      sources[field] = result.source;
    }

    return {
      metadata: resolved,
      sources,
      identificationStatus: entity.identificationStatus,
      identificationConfidence: entity.identificationConfidence
    };
  }

  /**
   * Get field value from a specific source
   * @private
   */
  async getFieldFromSource(entityType, entityKey, field, source, entity) {
    switch (source) {
      case 'user':
        return await this.getUserOverride(entityType, entityKey, field, entity);
      
      case 'musicbrainz':
        return await this.getMusicBrainzField(entityType, field, entity);
      
      case 'plex':
        return this.getPlexField(field, entity);
      
      default:
        return null;
    }
  }

  /**
   * Get user override value
   * @private
   */
  async getUserOverride(entityType, entityKey, field, entity) {
    // Check inline user field first (userTitle, userSortName, etc.)
    const userFieldName = `user${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    if (entity[userFieldName] !== null && entity[userFieldName] !== undefined) {
      return entity[userFieldName];
    }

    // Check UserMetadataOverride table
    const override = await this.prisma.userMetadataOverride.findUnique({
      where: {
        entityType_entityKey_field: {
          entityType,
          entityKey,
          field
        }
      }
    });

    return override ? override.value : null;
  }

  /**
   * Get MusicBrainz field value
   * @private
   */
  async getMusicBrainzField(entityType, field, entity) {
    // Check inline MusicBrainz fields first
    const mbFieldName = `musicBrainz${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    if (entity[mbFieldName] !== null && entity[mbFieldName] !== undefined) {
      return entity[mbFieldName];
    }

    // Check if entity has a MusicBrainz ID
    const mbIdField = this.getMusicBrainzIdField(entityType);
    const mbId = entity[mbIdField];
    
    if (!mbId) {
      return null;
    }

    // Check cache
    const cached = await this.prisma.musicBrainzMetadataCache.findUnique({
      where: { musicBrainzId: mbId }
    });

    if (!cached) {
      return null;
    }

    // Check if cache is still valid
    if (new Date(cached.expiresAt) < new Date()) {
      return null;
    }

    // Parse cached metadata and return field
    try {
      const metadata = JSON.parse(cached.metadata);
      return metadata[field] || null;
    } catch (error) {
      console.error('Error parsing cached MusicBrainz metadata:', error);
      return null;
    }
  }

  /**
   * Get Plex file field value
   * @private
   */
  getPlexField(field, entity) {
    // Direct mapping for most fields
    if (entity[field] !== null && entity[field] !== undefined) {
      return entity[field];
    }

    // Handle special cases
    switch (field) {
      case 'releaseDate':
        return entity.originallyAvailableAt || entity.year;
      case 'label':
        return entity.studio;
      default:
        return null;
    }
  }

  /**
   * Get entity from database
   * @private
   */
  async getEntity(entityType, entityKey) {
    const models = {
      artist: this.prisma.plexArtist,
      album: this.prisma.plexAlbum,
      track: this.prisma.plexTrack,
      work: this.prisma.work
    };

    const model = models[entityType];
    if (!model) {
      throw new Error(`Invalid entity type: ${entityType}`);
    }

    // Use ratingKey for Plex entities, id for Work
    const where = entityType === 'work' 
      ? { id: parseInt(entityKey) }
      : { ratingKey: entityKey };

    return await model.findUnique({ where });
  }

  /**
   * Get MusicBrainz ID field name for entity type
   * @private
   */
  getMusicBrainzIdField(entityType) {
    const fields = {
      artist: 'musicBrainzId',
      album: 'musicBrainzReleaseId',
      track: 'musicBrainzTrackId',
      work: 'musicBrainzWorkId'
    };
    return fields[entityType] || 'musicBrainzId';
  }

  /**
   * Get editable fields for entity type
   * @private
   */
  getFieldsForEntityType(entityType) {
    const fields = {
      artist: ['title', 'sortName', 'biography', 'country', 'disambiguation'],
      album: ['title', 'releaseDate', 'label', 'disambiguation'],
      track: ['title', 'composer', 'trackNumber', 'duration'],
      work: ['title', 'catalogNumber', 'opusNumber', 'nickname']
    };
    return fields[entityType] || [];
  }

  /**
   * Set metadata preference for a field
   * @param {string} entityType
   * @param {string} entityKey
   * @param {string} field
   * @param {string} source - 'user', 'musicbrainz', or 'plex'
   */
  async setPreference(entityType, entityKey, field, source) {
    // Validate source
    if (!['user', 'musicbrainz', 'plex'].includes(source)) {
      throw new Error(`Invalid source: ${source}`);
    }

    // Update MetadataPreference table
    await this.prisma.metadataPreference.upsert({
      where: {
        entityType_entityKey_field: {
          entityType,
          entityKey,
          field
        }
      },
      create: {
        entityType,
        entityKey,
        field,
        source
      },
      update: {
        source
      }
    });

    // Update inline metadataPreferences JSON
    const entity = await this.getEntity(entityType, entityKey);
    const preferences = entity.metadataPreferences 
      ? JSON.parse(entity.metadataPreferences)
      : {};
    
    preferences[field] = source;

    const models = {
      artist: this.prisma.plexArtist,
      album: this.prisma.plexAlbum,
      track: this.prisma.plexTrack,
      work: this.prisma.work
    };

    const model = models[entityType];
    const where = entityType === 'work'
      ? { id: parseInt(entityKey) }
      : { ratingKey: entityKey };

    await model.update({
      where,
      data: {
        metadataPreferences: JSON.stringify(preferences)
      }
    });
  }

  /**
   * Set user override for a field
   * @param {string} entityType
   * @param {string} entityKey
   * @param {string} field
   * @param {any} value
   */
  async setUserOverride(entityType, entityKey, field, value) {
    // Update inline user field if it exists
    const userFieldName = `user${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const entity = await this.getEntity(entityType, entityKey);
    
    if (entity.hasOwnProperty(userFieldName)) {
      const models = {
        artist: this.prisma.plexArtist,
        album: this.prisma.plexAlbum,
        track: this.prisma.plexTrack,
        work: this.prisma.work
      };

      const model = models[entityType];
      const where = entityType === 'work'
        ? { id: parseInt(entityKey) }
        : { ratingKey: entityKey };

      await model.update({
        where,
        data: {
          [userFieldName]: value
        }
      });
    } else {
      // Store in UserMetadataOverride table
      await this.prisma.userMetadataOverride.upsert({
        where: {
          entityType_entityKey_field: {
            entityType,
            entityKey,
            field
          }
        },
        create: {
          entityType,
          entityKey,
          field,
          value: String(value)
        },
        update: {
          value: String(value)
        }
      });
    }

    // Auto-set preference to 'user' when user makes an override
    await this.setPreference(entityType, entityKey, field, 'user');
  }

  /**
   * Clear user override for a field
   * @param {string} entityType
   * @param {string} entityKey
   * @param {string} field
   */
  async clearUserOverride(entityType, entityKey, field) {
    // Clear inline user field
    const userFieldName = `user${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    const entity = await this.getEntity(entityType, entityKey);
    
    if (entity.hasOwnProperty(userFieldName)) {
      const models = {
        artist: this.prisma.plexArtist,
        album: this.prisma.plexAlbum,
        track: this.prisma.plexTrack,
        work: this.prisma.work
      };

      const model = models[entityType];
      const where = entityType === 'work'
        ? { id: parseInt(entityKey) }
        : { ratingKey: entityKey };

      await model.update({
        where,
        data: {
          [userFieldName]: null
        }
      });
    }

    // Delete from UserMetadataOverride table
    try {
      await this.prisma.userMetadataOverride.delete({
        where: {
          entityType_entityKey_field: {
            entityType,
            entityKey,
            field
          }
        }
      });
    } catch (error) {
      // Record may not exist, which is fine
    }
  }
}

module.exports = MetadataResolutionService;
