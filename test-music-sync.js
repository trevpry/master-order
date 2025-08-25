const PlexSyncService = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

async function testMusicSync() {
  const plexSync = new PlexSyncService();
  
  try {
    console.log('🎵 Starting test music sync...');
    
    // First, get music sections
    const sections = await prisma.plexLibrarySection.findMany({
      where: {
        type: 'artist'
      }
    });
    
    console.log(`Found ${sections.length} music sections`);
    
    if (sections.length === 0) {
      console.log('No music sections found. Running full library section sync first...');
      await plexSync.syncLibrarySections();
      
      // Check again
      const newSections = await prisma.plexLibrarySection.findMany({
        where: {
          type: 'artist'
        }
      });
      
      if (newSections.length === 0) {
        console.log('❌ No music sections found in Plex library');
        return;
      }
      console.log(`Found ${newSections.length} music sections after library sync`);
    }
    
    // Use the first music section
    const musicSection = sections[0] || await prisma.plexLibrarySection.findFirst({
      where: { type: 'artist' }
    });
    
    console.log(`Using music section: ${musicSection.title} (${musicSection.sectionKey})`);
    
    // Sync just the first few artists from this section
    const data = await plexSync.makeRequest(`/library/sections/${musicSection.sectionKey}/all?X-Plex-Container-Start=0&X-Plex-Container-Size=1`);
    const artists = data.MediaContainer?.Metadata || [];
    
    console.log(`Found ${artists.length} artists to test sync`);
    
    if (artists.length === 0) {
      console.log('❌ No artists found in music section');
      return;
    }
    
    const testArtist = artists[0];
    console.log(`\n🎤 Testing sync for artist: ${testArtist.title} (${testArtist.ratingKey})`);
    
    // Sync just this one artist
    await plexSync.syncArtists(musicSection.sectionKey);
    
    // Get the synced artist from database
    const syncedArtist = await prisma.plexArtist.findUnique({
      where: { ratingKey: testArtist.ratingKey }
    });
    
    if (syncedArtist) {
      console.log(`✅ Artist synced: ${syncedArtist.title}`);
      
      // Now sync albums for this artist
      console.log(`\n💿 Syncing albums for artist: ${syncedArtist.title}`);
      await plexSync.syncAlbums(musicSection.sectionKey, syncedArtist.ratingKey);
      
      // Get synced albums
      const syncedAlbums = await prisma.plexAlbum.findMany({
        where: { parentRatingKey: syncedArtist.ratingKey }
      });
      
      console.log(`✅ Synced ${syncedAlbums.length} albums for ${syncedArtist.title}`);
      
      if (syncedAlbums.length > 0) {
        // Sync tracks for the first album
        const testAlbum = syncedAlbums[0];
        console.log(`\n🎵 Syncing tracks for album: ${testAlbum.title}`);
        await plexSync.syncTracks(musicSection.sectionKey, testAlbum.ratingKey);
        
        // Get synced tracks
        const syncedTracks = await prisma.plexTrack.findMany({
          where: { parentRatingKey: testAlbum.ratingKey }
        });
        
        console.log(`✅ Synced ${syncedTracks.length} tracks for ${testAlbum.title}`);
        
        // Print summary
        console.log('\n📊 Test Sync Summary:');
        console.log(`   Artist: ${syncedArtist.title}`);
        console.log(`   Albums: ${syncedAlbums.length}`);
        console.log(`   Tracks: ${syncedTracks.length} (from first album)`);
        
        if (syncedTracks.length > 0) {
          console.log('\n🎵 Sample tracks:');
          syncedTracks.slice(0, 5).forEach((track, index) => {
            console.log(`   ${index + 1}. ${track.title} (${track.duration ? Math.round(track.duration/1000) + 's' : 'unknown duration'})`);
          });
        }
      }
    } else {
      console.log('❌ Artist sync failed');
    }
    
  } catch (error) {
    console.error('❌ Test music sync failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testMusicSync();
