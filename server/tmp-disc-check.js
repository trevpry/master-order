const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const rows = await p.$queryRawUnsafe(
    'SELECT parentRatingKey, COUNT(DISTINCT discNumber) dn, COUNT(*) c FROM PlexTrack WHERE discNumber IS NOT NULL GROUP BY parentRatingKey HAVING dn > 1 LIMIT 10'
  );
  console.log('multi-disc album keys:', rows);
  const keys = rows.map((r) => r.parentRatingKey);
  const albums = await p.plexAlbum.findMany({
    where: { ratingKey: { in: keys } },
    select: {
      ratingKey: true,
      title: true,
      musicBrainzId: true,
      identificationStatus: true,
      artist: { select: { title: true } }
    }
  });
  console.log(JSON.stringify(albums, null, 2));
  await p.$disconnect();
})();
