const { PrismaClient } = require('@prisma/client');

/**
 * ArtistMergeService - Handles merging multiple music artists into one
 * 
 * This service encapsulates all business logic for artist merging:
 * - Transferring album relationships
 * - Transferring work relationships (composer, etc.)
 * - Transferring artist type assignments
 * - Transferring track artist relationships
 * - Cleaning up merged artists
 * 
 * Note: Does NOT update Plex server to avoid deleting tracks
 */
class ArtistMergeService {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  /**
   * Merge multiple artists into a single main artist
   * @param {string} mainArtistKey - ratingKey of the artist to merge into
   * @param {string[]} mergeArtistKeys - ratingKeys of artists to merge and delete
   * @returns {Promise<{success: boolean, mainArtist: object, mergedCount: number, error?: string}>}
   */
  async mergeArtists(mainArtistKey, mergeArtistKeys) {
    console.log('🔄 [ArtistMerge] Starting merge operation...');
    console.log(`   - Main artist: ${mainArtistKey}`);
    console.log(`   - Merging ${mergeArtistKeys.length} artist(s):`, mergeArtistKeys);

    try {
      // Validate inputs
      if (!mainArtistKey) {
        throw new Error('Main artist key is required');
      }
      if (!mergeArtistKeys || mergeArtistKeys.length === 0) {
        throw new Error('At least one artist to merge is required');
      }
      if (mergeArtistKeys.includes(mainArtistKey)) {
        throw new Error('Cannot merge an artist into itself');
      }

      // Fetch all artists
      const mainArtist = await this.prisma.plexArtist.findUnique({
        where: { ratingKey: mainArtistKey }
      });

      if (!mainArtist) {
        throw new Error(`Main artist ${mainArtistKey} not found`);
      }

      const mergeArtists = await this.prisma.plexArtist.findMany({
        where: { ratingKey: { in: mergeArtistKeys } }
      });

      if (mergeArtists.length !== mergeArtistKeys.length) {
        throw new Error('Some artists to merge were not found');
      }

      console.log(`   - Found main artist: ${mainArtist.title}`);
      console.log(`   - Found ${mergeArtists.length} artists to merge`);

      // Start transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Transfer album relationships
        const transferredAlbums = await this._transferAlbumRelationships(tx, mainArtistKey, mergeArtistKeys);
        console.log(`   - Transferred ${transferredAlbums} album(s)`);

        // 2. Transfer work relationships (composer)
        const transferredWorks = await this._transferWorkRelationships(tx, mainArtistKey, mergeArtistKeys);
        console.log(`   - Transferred ${transferredWorks} work(s)`);

        // 3. Transfer artist type assignments
        const transferredTypes = await this._transferArtistTypeAssignments(tx, mainArtistKey, mergeArtistKeys);
        console.log(`   - Transferred ${transferredTypes} artist type(s)`);

        // 4. Transfer track artist relationships
        const transferredTrackArtists = await this._transferTrackArtistRelationships(tx, mainArtistKey, mergeArtistKeys);
        console.log(`   - Transferred ${transferredTrackArtists} track artist relationship(s)`);

        // 5. Transfer album artist relationships
        const transferredAlbumArtists = await this._transferAlbumArtistRelationships(tx, mainArtistKey, mergeArtistKeys);
        console.log(`   - Transferred ${transferredAlbumArtists} album artist relationship(s)`);

        // 6. Delete merged artists from database
        await tx.plexArtist.deleteMany({
          where: { ratingKey: { in: mergeArtistKeys } }
        });
        console.log(`   - Deleted ${mergeArtistKeys.length} artist(s) from database`);

        return {
          mainArtist,
          mergedCount: mergeArtistKeys.length,
          transferredAlbums,
          transferredWorks,
          transferredTypes,
          transferredTrackArtists,
          transferredAlbumArtists
        };
      });

      console.log('✅ [ArtistMerge] Merge completed successfully');
      return {
        success: true,
        mainArtist: result.mainArtist,
        mergedCount: result.mergedCount,
        transferredAlbums: result.transferredAlbums,
        transferredWorks: result.transferredWorks,
        transferredTypes: result.transferredTypes,
        transferredTrackArtists: result.transferredTrackArtists,
        transferredAlbumArtists: result.transferredAlbumArtists
      };

    } catch (error) {
      console.error('❌ [ArtistMerge] Error during merge:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Transfer all album relationships from merged artists to main artist
   * @private
   */
  async _transferAlbumRelationships(tx, mainArtistKey, mergeArtistKeys) {
    let transferredCount = 0;

    for (const artistKey of mergeArtistKeys) {
      // Update all albums to point to the main artist
      const result = await tx.plexAlbum.updateMany({
        where: { parentRatingKey: artistKey },
        data: { parentRatingKey: mainArtistKey }
      });

      transferredCount += result.count;
    }

    return transferredCount;
  }

  /**
   * Transfer all work relationships from merged artists to main artist
   * @private
   */
  async _transferWorkRelationships(tx, mainArtistKey, mergeArtistKeys) {
    let transferredCount = 0;

    for (const artistKey of mergeArtistKeys) {
      // Update all works (where artist is composer) to point to the main artist
      const result = await tx.work.updateMany({
        where: { composerKey: artistKey },
        data: { composerKey: mainArtistKey }
      });

      transferredCount += result.count;
    }

    return transferredCount;
  }

  /**
   * Transfer all artist type assignments from merged artists to main artist
   * @private
   */
  async _transferArtistTypeAssignments(tx, mainArtistKey, mergeArtistKeys) {
    let transferredCount = 0;

    for (const artistKey of mergeArtistKeys) {
      // Get all type assignments for this merged artist
      const typeAssignments = await tx.artistTypeAssignment.findMany({
        where: { artistKey: artistKey }
      });

      for (const assignment of typeAssignments) {
        // Check if main artist already has this type
        const existingAssignment = await tx.artistTypeAssignment.findUnique({
          where: {
            artistKey_artistTypeId: {
              artistKey: mainArtistKey,
              artistTypeId: assignment.artistTypeId
            }
          }
        });

        if (!existingAssignment) {
          // Create new assignment for main artist
          await tx.artistTypeAssignment.create({
            data: {
              artistKey: mainArtistKey,
              artistTypeId: assignment.artistTypeId
            }
          });
          transferredCount++;
        }

        // Delete the old assignment
        await tx.artistTypeAssignment.delete({
          where: {
            artistKey_artistTypeId: {
              artistKey: artistKey,
              artistTypeId: assignment.artistTypeId
            }
          }
        });
      }
    }

    return transferredCount;
  }

  /**
   * Transfer all track artist relationships from merged artists to main artist
   * @private
   */
  async _transferTrackArtistRelationships(tx, mainArtistKey, mergeArtistKeys) {
    let transferredCount = 0;

    for (const artistKey of mergeArtistKeys) {
      // Get all track artist relationships for this merged artist
      const trackArtistRelationships = await tx.trackArtist.findMany({
        where: { artistKey: artistKey }
      });

      for (const relationship of trackArtistRelationships) {
        // Check if main artist already has this track/type combination
        const existingRelationship = await tx.trackArtist.findUnique({
          where: {
            trackKey_artistKey_artistTypeId: {
              trackKey: relationship.trackKey,
              artistKey: mainArtistKey,
              artistTypeId: relationship.artistTypeId
            }
          }
        });

        if (!existingRelationship) {
          // Create new relationship for main artist
          await tx.trackArtist.create({
            data: {
              trackKey: relationship.trackKey,
              artistKey: mainArtistKey,
              artistTypeId: relationship.artistTypeId
            }
          });
          transferredCount++;
        }

        // Delete the old relationship
        await tx.trackArtist.delete({
          where: {
            trackKey_artistKey_artistTypeId: {
              trackKey: relationship.trackKey,
              artistKey: artistKey,
              artistTypeId: relationship.artistTypeId
            }
          }
        });
      }
    }

    return transferredCount;
  }

  /**
   * Transfer all album artist relationships from merged artists to main artist
   * @private
   */
  async _transferAlbumArtistRelationships(tx, mainArtistKey, mergeArtistKeys) {
    let transferredCount = 0;

    for (const artistKey of mergeArtistKeys) {
      const albumArtistRelationships = await tx.albumArtist.findMany({
        where: { artistKey: artistKey }
      });

      for (const relationship of albumArtistRelationships) {
        const existingRelationship = await tx.albumArtist.findUnique({
          where: {
            albumKey_artistKey_artistTypeId: {
              albumKey: relationship.albumKey,
              artistKey: mainArtistKey,
              artistTypeId: relationship.artistTypeId
            }
          }
        });

        if (!existingRelationship) {
          await tx.albumArtist.create({
            data: {
              albumKey: relationship.albumKey,
              artistKey: mainArtistKey,
              artistTypeId: relationship.artistTypeId
            }
          });
          transferredCount++;
        }

        await tx.albumArtist.delete({
          where: {
            albumKey_artistKey_artistTypeId: {
              albumKey: relationship.albumKey,
              artistKey: artistKey,
              artistTypeId: relationship.artistTypeId
            }
          }
        });
      }
    }

    return transferredCount;
  }
}

module.exports = ArtistMergeService;
