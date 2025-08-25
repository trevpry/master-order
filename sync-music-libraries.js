const PlexSyncService = require('./server/plexSyncService');

// Use the existing prisma instance from the server
const prisma = require('./server/databaseUtils').prisma;

async function syncMusicLibrariesOnly() {
  console.log('🎵 Starting music-only Plex sync...');
  
  try {
    const plexSync = new PlexSyncService();
    
    // First, sync library sections to make sure we have the latest
    console.log('📂 Syncing library sections...');
    const sections = await plexSync.syncLibrarySections();
    
    // Filter to music sections only
    const musicSections = sections.filter(section => section.type === 'artist');
    
    if (musicSections.length === 0) {
      console.log('❌ No music sections found in Plex library');
      return;
    }
    
    console.log(`🎵 Found ${musicSections.length} music section(s):`);
    musicSections.forEach(section => {
      console.log(`   - ${section.title} (${section.sectionKey})`);
    });
    
    // Sync each music section
    for (const section of musicSections) {
      console.log(`\n🎼 Syncing music section: ${section.title}`);
      await plexSync.syncMusic(section.sectionKey);
    }
    
    // Get final stats
    const stats = await plexSync.getSyncStatus();
    console.log('\n✅ Music sync completed!');
    console.log('📊 Final statistics:');
    console.log(`   Artists: ${stats.artists}`);
    console.log(`   Albums: ${stats.albums}`);
    console.log(`   Tracks: ${stats.tracks}`);
    console.log(`   Playlists: ${stats.playlists}`);
    
  } catch (error) {
    console.error('❌ Music sync failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncMusicLibrariesOnly()
  .then(() => {
    console.log('🎉 Music library sync completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Music library sync failed:', error);
    process.exit(1);
  });
