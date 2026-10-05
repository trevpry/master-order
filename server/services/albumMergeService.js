const { PrismaClient } = require('@prisma/client');
const { recordDeletedPlexEntity } = require('../utils/plexDeletedEntities');

// Fields copied from merged albums onto the main album only when the main album lacks them.
const FILL_IF_MISSING_FIELDS = [
  'titleSort', 'summary', 'year', 'thumb', 'art', 'parentThumb', 'originallyAvailableAt',
  'musicBrainzId', 'musicBrainzReleaseDate', 'musicBrainzCountry', 'musicBrainzStatus',
  'musicBrainzPackaging', 'musicBrainzLabel', 'musicBrainzBarcode', 'musicBrainzAsin',
  'albumArtist', 'workId', 'userTitle', 'userReleaseDate', 'userLabel', 'metadataPreferences'
];

const isBlank = (value) => value === null || value === undefined || value === '';

/**
 * AlbumMergeService - merges several albums into one main album.
 * Moves tracks, album credits and stored artwork, fills missing metadata, then deletes and
 * tombstones the merged albums so Plex sync does not re-create them.
 */
class AlbumMergeService {
  constructor(prisma) {
    this.prisma = prisma || new PrismaClient();
  }

  async mergeAlbums(mainAlbumKey, mergeAlbumKeys) {
    const keys = [...new Set((mergeAlbumKeys || []).map(String))];

    if (!mainAlbumKey) throw new Error('Main album key is required');
    if (keys.length === 0) throw new Error('At least one album to merge is required');
    if (keys.includes(String(mainAlbumKey))) throw new Error('Cannot merge an album into itself');

    const mainAlbum = await this.prisma.plexAlbum.findUnique({ where: { ratingKey: String(mainAlbumKey) } });
    if (!mainAlbum) throw new Error(`Main album ${mainAlbumKey} not found`);

    const mergeAlbums = await this.prisma.plexAlbum.findMany({ where: { ratingKey: { in: keys } } });
    if (mergeAlbums.length !== keys.length) throw new Error('Some albums to merge were not found');

    return await this.prisma.$transaction(async (tx) => {
      const patch = {};
      for (const field of FILL_IF_MISSING_FIELDS) {
        if (!isBlank(mainAlbum[field])) continue;
        const donor = mergeAlbums.find(album => !isBlank(album[field]));
        if (donor) patch[field] = donor[field];
      }
      if (Object.keys(patch).length > 0) {
        await tx.plexAlbum.update({ where: { ratingKey: mainAlbum.ratingKey }, data: patch });
      }

      const trackUpdate = { parentRatingKey: mainAlbum.ratingKey };
      if (mainAlbum.parentRatingKey) trackUpdate.grandparentRatingKey = mainAlbum.parentRatingKey;
      const movedTracks = await tx.plexTrack.updateMany({ where: { parentRatingKey: { in: keys } }, data: trackUpdate });

      let movedCredits = 0;
      const credits = await tx.albumArtist.findMany({ where: { albumKey: { in: keys } } });
      for (const credit of credits) {
        const exists = await tx.albumArtist.findUnique({
          where: {
            albumKey_artistKey_artistTypeId: {
              albumKey: mainAlbum.ratingKey,
              artistKey: credit.artistKey,
              artistTypeId: credit.artistTypeId
            }
          }
        });
        if (!exists) {
          await tx.albumArtist.create({
            data: { albumKey: mainAlbum.ratingKey, artistKey: credit.artistKey, artistTypeId: credit.artistTypeId }
          });
          movedCredits++;
        }
      }

      // Keep the main album's own covers; take a merged album's cover only for a missing side.
      const movedArtwork = [];
      const mainArtworkTypes = new Set(
        (await tx.albumArtwork.findMany({ where: { albumKey: mainAlbum.ratingKey }, select: { type: true } })).map(row => row.type)
      );
      for (const artwork of await tx.albumArtwork.findMany({ where: { albumKey: { in: keys } }, select: { id: true, type: true } })) {
        if (mainArtworkTypes.has(artwork.type)) continue;
        await tx.albumArtwork.update({ where: { id: artwork.id }, data: { albumKey: mainAlbum.ratingKey } });
        mainArtworkTypes.add(artwork.type);
        movedArtwork.push(artwork.type);
      }

      await tx.plexAlbum.deleteMany({ where: { ratingKey: { in: keys } } });
      for (const merged of mergeAlbums) {
        await recordDeletedPlexEntity(tx, 'album', merged.ratingKey, merged.title);
      }

      return {
        mainAlbum: { ...mainAlbum, ...patch },
        mergedCount: keys.length,
        movedTracks: movedTracks.count,
        movedCredits,
        movedArtwork
      };
    });
  }
}

module.exports = AlbumMergeService;
