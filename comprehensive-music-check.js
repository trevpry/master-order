const PlexSync = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

async function comprehensiveCheck() {
  console.log(`🔍 Comprehensive music sync check`);

  const svc = new PlexSync();
  await svc.ensureConfigLoaded();

  // Get music sections directly from Plex
  const sectionsData = await svc.makeRequest('/library/sections');
  const allSections = sectionsData.MediaContainer?.Directory || [];
  const musicSections = allSections.filter(s => s.type === 'artist');
  console.log(`🎼 Found ${musicSections.length} music sections: ${musicSections.map(s => `${s.key}:${s.title}`).join(', ')}`);

  // Check 65daysofstatic specifically
  console.log(`\n=== 65daysofstatic Analysis ===`);
  const artist65dos = await prisma.plexArtist.findFirst({
    where: { title: { contains: '65daysofstatic' } },
  });

  if (artist65dos) {
    console.log(`Found artist: ${artist65dos.title} (${artist65dos.ratingKey})`);
    
    // Get all albums for this artist from the database
    const dbAlbums = await prisma.plexAlbum.findMany({
      where: { parentRatingKey: artist65dos.ratingKey }
    });
    console.log(`Albums in database: ${dbAlbums.length}`);
    dbAlbums.forEach(album => {
      console.log(`  - ${album.title} (${album.ratingKey})`);
    });

    // Check all albums in all sections that might belong to this artist
    for (const section of musicSections) {
      console.log(`\nChecking section ${section.key} (${section.title}) for 65daysofstatic albums...`);
      
      let start = 0;
      const pageSize = 500;
      let foundAlbums = [];
      
      while (true) {
        const page = await svc.makeRequest(`/library/sections/${section.key}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
        const pageAlbums = page.MediaContainer?.Metadata || [];
        
        if (pageAlbums.length === 0) break;
        
        // Look for albums that might belong to 65daysofstatic
        for (const album of pageAlbums) {
          if (String(album.parentRatingKey) === String(artist65dos.ratingKey) ||
              album.parentTitle?.includes('65daysofstatic') ||
              album.title?.includes('65daysofstatic')) {
            foundAlbums.push(album);
          }
        }
        
        start += pageSize;
        if (pageAlbums.length < pageSize) break; // Last page
      }
      
      if (foundAlbums.length > 0) {
        console.log(`  Found ${foundAlbums.length} potential albums:`);
        foundAlbums.forEach(album => {
          console.log(`    - "${album.title}" (${album.ratingKey}) parentRatingKey: ${album.parentRatingKey}`);
        });
      } else {
        console.log(`  No albums found in this section`);
      }
    }
  }

  // Check for any albums that might be missing from the sync in general
  console.log(`\n=== General Missing Albums Check ===`);
  
  // Get a sample of artists and check their album count consistency
  const sampleArtists = await prisma.plexArtist.findMany({
    take: 5,
    orderBy: { title: 'asc' }
  });

  for (const artist of sampleArtists) {
    console.log(`\nChecking artist: ${artist.title} (${artist.ratingKey})`);
    
    const dbAlbumCount = await prisma.plexAlbum.count({
      where: { parentRatingKey: artist.ratingKey }
    });
    
    // Check Plex directly for this artist's albums
    let plexAlbumCount = 0;
    for (const section of musicSections) {
      let start = 0;
      const pageSize = 500;
      
      while (true) {
        const page = await svc.makeRequest(`/library/sections/${section.key}/all?type=9&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${pageSize}`);
        const pageAlbums = page.MediaContainer?.Metadata || [];
        
        if (pageAlbums.length === 0) break;
        
        plexAlbumCount += pageAlbums.filter(album => 
          String(album.parentRatingKey) === String(artist.ratingKey)
        ).length;
        
        start += pageSize;
        if (pageAlbums.length < pageSize) break;
      }
    }
    
    console.log(`  DB albums: ${dbAlbumCount}, Plex albums: ${plexAlbumCount}`);
    if (dbAlbumCount !== plexAlbumCount) {
      console.log(`  ⚠️ MISMATCH detected!`);
    }
  }
}

comprehensiveCheck()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
