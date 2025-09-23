const PlexSyncService = require('./plexSyncService');

async function testEpisodeSync() {
  const syncService = new PlexSyncService();
  
  try {
    console.log('=== TESTING AUTOMATIC EPISODE SYNC WITH DEBUG ===\n');
    
    // Test syncing just one episode (44074) through the normal sync process
    console.log('1. Getting season for episode 44074...');
    
    // First we need to find what season episode 44074 belongs to
    await syncService.ensureConfigLoaded();
    const episodeDetailData = await syncService.makeRequest('/library/metadata/44074');
    const episode = episodeDetailData.MediaContainer?.Metadata?.[0];
    
    if (!episode) {
      console.log('❌ Episode not found');
      return;
    }
    
    console.log(`✅ Episode: ${episode.title}`);
    console.log(`✅ Season ratingKey: ${episode.parentRatingKey}`);
    console.log(`✅ Show ratingKey: ${episode.grandparentRatingKey}`);
    
    console.log('\n2. Running syncEpisodes for this season...');
    // Call the same method that the automatic sync uses
    await syncService.syncEpisodes(episode.parentRatingKey, episode.grandparentRatingKey);
    
    console.log('\n3. Sync complete!');
    
  } catch (error) {
    console.error('Error during sync test:', error);
  }
}

testEpisodeSync();