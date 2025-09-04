const PlexSync = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

async function investigate() {
  const artistName = '65daysofstatic';
  const albumTitleQuery = 'No Man’s Sky'; // Using a partial query to be safe

  console.log(`🔍 Investigating artist "${artistName}" and album containing "${albumTitleQuery}"`);

  const svc = new PlexSync();
  await svc.ensureConfigLoaded();

  // 1. Get music sections directly from Plex
  const sectionsData = await svc.makeRequest('/library/sections');
  const allSections = sectionsData.MediaContainer?.Directory || [];
  const musicSections = allSections.filter(s => s.type === 'artist');
  console.log(`🎼 Found ${musicSections.length} music sections: ${musicSections.map(s => `${s.key}:${s.title}`).join(', ')}`);

  // 2. Find the artist
  let artist = await prisma.plexArtist.findFirst({
    where: { title: { contains: artistName } },
  });

  if (artist) {
    console.log(`✅ Found artist "${artist.title}" in DB with ratingKey: ${artist.ratingKey}`);
  } else {
    console.log(`Artist not in DB, searching Plex...`);
    for (const section of musicSections) {
      const artistsData = await svc.makeRequest(`/library/sections/${section.key}/all?type=8&title=${encodeURIComponent(artistName)}`);
      const foundArtists = artistsData.MediaContainer?.Metadata || [];
      if (foundArtists.length > 0) {
        artist = foundArtists[0];
        console.log(`✅ Found artist "${artist.title}" in Plex section ${section.key} with ratingKey: ${artist.ratingKey}`);
        break;
      }
    }
  }

  if (!artist) {
    console.error(`❌ Could not find artist "${artistName}" in DB or Plex.`);
    return;
  }

  // 3. Search for the album in all music sections
  console.log(`\n💿 Searching for album containing "${albumTitleQuery}"...`);
  let foundAlbum = null;
  for (const section of musicSections) {
    console.log(`--- Checking Section ${section.key}: ${section.title} ---`);
    const albumData = await svc.makeRequest(`/library/sections/${section.key}/all?type=9&title=${encodeURIComponent(albumTitleQuery)}`);
    const albums = albumData.MediaContainer?.Metadata || [];
    
    if (albums.length > 0) {
      console.log(`   🎯 Found ${albums.length} matching album(s) in this section.`);
      for (const album of albums) {
        console.log('---------------------------------');
        console.log(`   Album Title: ${album.title}`);
        console.log(`   Rating Key: ${album.ratingKey}`);
        console.log(`   Parent Rating Key: ${album.parentRatingKey}`);
        console.log(`   Grandparent Rating Key: ${album.grandparentRatingKey}`);
        console.log(`   Artist (from album metadata): ${album.parentTitle}`);
        console.log(`   Grandparent Artist/Title: ${album.grandparentTitle}`);
        console.log(`   Year: ${album.year}`);
        console.log(`   GUID: ${album.guid}`);
        console.log('---------------------------------');
        foundAlbum = album;
      }
    } else {
      console.log(`   No direct match found.`);
    }
  }

  if (!foundAlbum) {
    console.log(`\n❌ Could not find album "${albumTitleQuery}" in any music section via title search.`);
  }

  // 4. Run the existing syncAlbums function for this artist and see what it does
  console.log(`\n🔄 Running syncAlbums for artist ${artist.ratingKey} to test current logic...`);
  for (const section of musicSections) {
    // Check if album's parent artist is in this section
    if (foundAlbum && foundAlbum.parentRatingKey) {
        const artistCheckData = await svc.makeRequest(`/library/metadata/${foundAlbum.parentRatingKey}`);
        if (artistCheckData.MediaContainer?.librarySectionID == section.key) {
             console.log(`\nArtist ${foundAlbum.parentRatingKey} is in section ${section.key}, running sync...`);
             await svc.syncAlbums(section.key, artist.ratingKey);
        }
    } else {
        // As a fallback, just run on all sections
        await svc.syncAlbums(section.key, artist.ratingKey);
    }
  }

  // 5. Check DB for the album
  if (foundAlbum) {
    const dbAlbum = await prisma.plexAlbum.findUnique({ where: { ratingKey: foundAlbum.ratingKey } });
    if (dbAlbum) {
      console.log(`\n✅ Album "${dbAlbum.title}" was found in the database.`);
      console.log(`   DB parentRatingKey: ${dbAlbum.parentRatingKey}`);
      if (String(dbAlbum.parentRatingKey) === String(artist.ratingKey)) {
        console.log(`   ✅ Association is correct.`);
      } else {
        console.log(`   ❌ Association is INCORRECT. Album is linked to artist ${dbAlbum.parentRatingKey} instead of ${artist.ratingKey}.`);
      }
    } else {
      console.log(`\n❌ Album "${foundAlbum.title}" was NOT synced to the database.`);
    }
  }
}

investigate()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
