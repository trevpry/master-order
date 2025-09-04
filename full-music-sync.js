const PlexSync = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

async function fullMusicSync() {
  console.log(`🎵 Starting full Plex music sync...`);

  const svc = new PlexSync();
  await svc.ensureConfigLoaded();

  try {
    // 1. Sync library sections first
    console.log(`\n📂 Syncing library sections...`);
    await svc.syncLibrarySections();

    // 2. Get music sections
    const musicSections = await prisma.plexLibrarySection.findMany({
      where: { type: 'artist' },
    });
    console.log(`🎼 Found ${musicSections.length} music sections: ${musicSections.map(s => `${s.sectionKey}:${s.title}`).join(', ')}`);

    // 3. Sync artists for each music section
    for (const section of musicSections) {
      console.log(`\n🎤 Syncing artists for section: ${section.title} (${section.sectionKey})`);
      await svc.syncArtists(section.sectionKey);
    }

    // 4. Get all artists and sync their albums (in smaller batches)
    const allArtists = await prisma.plexArtist.findMany({
      orderBy: { title: 'asc' }
    });
    console.log(`\n💿 Found ${allArtists.length} artists total. Starting album sync in batches...`);

    const batchSize = 50; // Process artists in batches to prevent timeouts
    let artistCount = 0;
    
    for (let i = 0; i < allArtists.length; i += batchSize) {
      const batch = allArtists.slice(i, i + batchSize);
      console.log(`\n📦 Processing artist batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(allArtists.length/batchSize)} (${batch.length} artists)`);
      
      for (const artist of batch) {
        artistCount++;
        console.log(`  [${artistCount}/${allArtists.length}] Syncing albums for: ${artist.title} (${artist.ratingKey})`);
        
        // Find which section this artist belongs to
        const artistSection = musicSections.find(s => s.id === artist.librarySectionID);
        if (artistSection) {
          try {
            await svc.syncAlbums(artistSection.sectionKey, artist.ratingKey);
          } catch (error) {
            console.error(`     ❌ Error syncing albums for ${artist.title}:`, error.message);
            // Continue with next artist instead of failing completely
          }
        } else {
          console.warn(`     ⚠️ Could not find section for artist ${artist.title}`);
        }
      }
      
      // Pause between batches to let SQLite recover
      if (i + batchSize < allArtists.length) {
        console.log(`   ⏸️ Pausing 2 seconds between batches...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // 5. Get all albums and sync their tracks (in smaller batches)
    const allAlbums = await prisma.plexAlbum.findMany({
      orderBy: { title: 'asc' }
    });
    console.log(`\n🎵 Found ${allAlbums.length} albums total. Starting track sync in batches...`);

    const albumBatchSize = 100; // Process albums in batches
    let albumCount = 0;
    
    for (let i = 0; i < allAlbums.length; i += albumBatchSize) {
      const batch = allAlbums.slice(i, i + albumBatchSize);
      console.log(`\n📦 Processing album batch ${Math.floor(i/albumBatchSize) + 1}/${Math.ceil(allAlbums.length/albumBatchSize)} (${batch.length} albums)`);
      
      for (const album of batch) {
        albumCount++;
        console.log(`  [${albumCount}/${allAlbums.length}] Syncing tracks for: ${album.title} (${album.ratingKey})`);
        
        // Find which section this album belongs to
        const albumSection = musicSections.find(s => s.id === album.librarySectionID);
        if (albumSection) {
          try {
            await svc.syncTracks(albumSection.sectionKey, album.ratingKey);
          } catch (error) {
            console.error(`     ❌ Error syncing tracks for ${album.title}:`, error.message);
            // Continue with next album instead of failing completely
          }
        } else {
          console.warn(`     ⚠️ Could not find section for album ${album.title}`);
        }
      }
      
      // Pause between batches to let SQLite recover
      if (i + albumBatchSize < allAlbums.length) {
        console.log(`   ⏸️ Pausing 1 second between batches...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // 6. Final statistics
    console.log(`\n📊 Final Music Library Statistics:`);
    const artistCount_final = await prisma.plexArtist.count();
    const albumCount_final = await prisma.plexAlbum.count();
    const trackCount_final = await prisma.plexTrack.count();
    
    console.log(`   🎤 Artists: ${artistCount_final}`);
    console.log(`   💿 Albums: ${albumCount_final}`);
    console.log(`   🎵 Tracks: ${trackCount_final}`);
    
    console.log(`\n✅ Full music sync completed successfully!`);

  } catch (error) {
    console.error('❌ Error during music sync:', error);
    throw error;
  }
}

fullMusicSync()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
