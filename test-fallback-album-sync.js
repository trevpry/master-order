const PlexSync = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

(async () => {
  const sectionKey = 3; // Soundtracks
  const artistRatingKey = 115738; // Abel Korzeniowski
  const svc = new PlexSync();
  await svc.ensureConfigLoaded();
  console.log('Running syncAlbums with fallback logic test...');
  await svc.syncAlbums(sectionKey, artistRatingKey);
  const album = await prisma.plexAlbum.findUnique({ where: { ratingKey: '115739' } });
  console.log('Album 115739 now in DB?', !!album);
  if (album) console.log('Stored album title:', album.title, 'parentRatingKey:', album.parentRatingKey);
  await prisma.$disconnect();
})();
