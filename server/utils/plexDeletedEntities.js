/**
 * Tombstones for Plex music entities (artists/albums) deleted in the app.
 *
 * Plex sync is add-only for music: it creates rows that exist in Plex but are
 * missing locally, and never updates existing rows. Without tombstones, an
 * artist/album deleted in the app would be re-created by the next sync as long
 * as it still exists in Plex. Recording a tombstone at deletion time lets sync
 * skip those rating keys permanently.
 */

/**
 * Record a tombstone for a deleted artist/album. Safe to call inside a
 * transaction (pass `tx`) or with the global prisma client. Never throws —
 * a tombstone failure must not break the deletion itself.
 */
async function recordDeletedPlexEntity(client, entityType, ratingKey, title = null) {
  if (!ratingKey) return;
  try {
    await client.plexDeletedEntity.upsert({
      where: { entityType_ratingKey: { entityType, ratingKey } },
      update: { deletedAt: new Date(), title },
      create: { entityType, ratingKey, title }
    });
  } catch (error) {
    console.warn(`Failed to record deleted Plex ${entityType} ${ratingKey}:`, error.message);
  }
}

/**
 * Return a Set of ratingKeys tombstoned for the given entityType ('artist'|'album').
 */
async function getDeletedPlexEntityKeys(prisma, entityType) {
  const rows = await prisma.plexDeletedEntity.findMany({
    where: { entityType },
    select: { ratingKey: true }
  });
  return new Set(rows.map(r => r.ratingKey));
}

module.exports = {
  recordDeletedPlexEntity,
  getDeletedPlexEntityKeys
};
