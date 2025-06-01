// Load environment variables from server directory
require('dotenv').config({ path: './server/.env' });
const PlexSyncService = require('./server/plexSyncService');
const prisma = require('./server/prismaClient');

async function testPlexSyncSample() {
  console.log('=== Testing Plex Sync with Sample Data ===\n');
  
  const syncService = new PlexSyncService();
  
  try {
    // Step 1: Sync library sections (this is fast)
    console.log('1. Syncing library sections...');
    const sections = await syncService.syncLibrarySections();
    console.log(`✅ Synced ${sections.length} library sections`);
    sections.forEach(section => {
      console.log(`   - ${section.title} (${section.type})`);
    });
    console.log('');
      // Step 2: Test TV show sync with just 1-2 shows
    const tvSection = sections.find(s => s.type === 'show' && s.title === 'TV Shows');
    if (tvSection) {
      console.log('2. Testing TV show sync (sample only)...');      // Get a small sample of TV shows
      const data = await syncService.makeRequest(`/library/sections/${tvSection.sectionKey}/all?type=2`);
      const allShows = data.MediaContainer?.Metadata || [];
      const sampleShows = allShows.slice(0, 1); // Just sync 1 show
      
      console.log(`   Found ${allShows.length} total shows, syncing first ${sampleShows.length} as sample...`);
      
      for (const show of sampleShows) {
        console.log(`   Syncing show: ${show.title}`);
        
        // Fetch detailed metadata
        let detailedShow = show;
        try {
          const detailData = await syncService.makeRequest(`/library/metadata/${show.ratingKey}`);
          detailedShow = detailData.MediaContainer?.Metadata?.[0] || show;
        } catch (error) {
          console.warn(`     Warning: Failed to fetch detailed metadata: ${error.message}`);
        }
        
        const showData = {
          ratingKey: detailedShow.ratingKey,
          title: detailedShow.title,
          year: detailedShow.year ? parseInt(detailedShow.year) : null,
          summary: detailedShow.summary || null,
          thumb: detailedShow.thumb || null,
          art: detailedShow.art || null,
          leafCount: detailedShow.leafCount ? parseInt(detailedShow.leafCount) : null,
          viewedLeafCount: detailedShow.viewedLeafCount ? parseInt(detailedShow.viewedLeafCount) : null,
          addedAt: detailedShow.addedAt ? parseInt(detailedShow.addedAt) : null,
          updatedAt_plex: detailedShow.updatedAt ? parseInt(detailedShow.updatedAt) : null,
          collections: detailedShow.Collection ? JSON.stringify(detailedShow.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields
          childCount: detailedShow.childCount ? parseInt(detailedShow.childCount) : null,
          guid: detailedShow.guid || null,
          index: detailedShow.index ? parseInt(detailedShow.index) : null,
          key: detailedShow.key || null,
          lastViewedAt: detailedShow.lastViewedAt ? parseInt(detailedShow.lastViewedAt) : null,
          skipCount: detailedShow.skipCount ? parseInt(detailedShow.skipCount) : null,
          type: detailedShow.type || null,
          viewCount: detailedShow.viewCount ? parseInt(detailedShow.viewCount) : null,
          sectionKey: tvSection.sectionKey,
          lastSyncedAt: new Date()
        };
        
        const syncedShow = await prisma.plexTVShow.upsert({
          where: { ratingKey: detailedShow.ratingKey },
          update: showData,
          create: showData
        });
        
        // Test complex fields sync
        await syncService.clearComplexFields(detailedShow.ratingKey, 'show');
        await syncService.syncComplexFields(detailedShow, 'show', detailedShow.ratingKey);
        
        console.log(`   ✅ Synced show: ${syncedShow.title}`);
        
        // Test 1 season from this show
        console.log(`     Testing seasons for ${show.title}...`);
        const seasonData = await syncService.makeRequest(`/library/metadata/${show.ratingKey}/children`);
        const seasons = seasonData.MediaContainer?.Metadata || [];
        const sampleSeason = seasons[0]; // Just sync first season
        
        if (sampleSeason) {
          console.log(`     Syncing season: ${sampleSeason.title}`);
          
          // Fetch detailed season metadata
          let detailedSeason = sampleSeason;
          try {
            const detailData = await syncService.makeRequest(`/library/metadata/${sampleSeason.ratingKey}`);
            detailedSeason = detailData.MediaContainer?.Metadata?.[0] || sampleSeason;
          } catch (error) {
            console.warn(`       Warning: Failed to fetch detailed season metadata: ${error.message}`);
          }
          
          const seasonData = {
            ratingKey: detailedSeason.ratingKey,
            title: detailedSeason.title,
            index: detailedSeason.index ? parseInt(detailedSeason.index) : 0,
            showRatingKey: show.ratingKey,
            leafCount: detailedSeason.leafCount ? parseInt(detailedSeason.leafCount) : null,
            viewedLeafCount: detailedSeason.viewedLeafCount ? parseInt(detailedSeason.viewedLeafCount) : null,
            // Additional fields
            addedAt: detailedSeason.addedAt ? parseInt(detailedSeason.addedAt) : null,
            guid: detailedSeason.guid || null,
            key: detailedSeason.key || null,
            lastViewedAt: detailedSeason.lastViewedAt ? parseInt(detailedSeason.lastViewedAt) : null,
            librarySectionID: detailedSeason.librarySectionID ? parseInt(detailedSeason.librarySectionID) : null,
            librarySectionKey: detailedSeason.librarySectionKey || null,
            librarySectionTitle: detailedSeason.librarySectionTitle || null,
            parentGuid: detailedSeason.parentGuid || null,
            parentIndex: detailedSeason.parentIndex ? parseInt(detailedSeason.parentIndex) : null,
            parentKey: detailedSeason.parentKey || null,
            parentRatingKey: detailedSeason.parentRatingKey || null,
            parentThumb: detailedSeason.parentThumb || null,
            parentTitle: detailedSeason.parentTitle || null,
            skipCount: detailedSeason.skipCount ? parseInt(detailedSeason.skipCount) : null,
            summary: detailedSeason.summary || null,
            thumb: detailedSeason.thumb || null,
            type: detailedSeason.type || null,
            updatedAt_plex: detailedSeason.updatedAt ? parseInt(detailedSeason.updatedAt) : null,
            viewCount: detailedSeason.viewCount ? parseInt(detailedSeason.viewCount) : null
          };
          
          await prisma.plexSeason.upsert({
            where: { ratingKey: detailedSeason.ratingKey },
            update: seasonData,
            create: seasonData
          });
          
          await syncService.clearComplexFields(detailedSeason.ratingKey, 'season');
          await syncService.syncComplexFields(detailedSeason, 'season', detailedSeason.ratingKey);
          
          console.log(`     ✅ Synced season: ${detailedSeason.title}`);
          
          // Test 1-2 episodes from this season
          console.log(`       Testing episodes for ${sampleSeason.title}...`);
          const episodeData = await syncService.makeRequest(`/library/metadata/${sampleSeason.ratingKey}/children`);
          const episodes = episodeData.MediaContainer?.Metadata || [];
          const sampleEpisodes = episodes.slice(0, 2); // Just sync 2 episodes
          
          for (const episode of sampleEpisodes) {
            console.log(`       Syncing episode: ${episode.title}`);
            
            // Fetch detailed episode metadata
            let detailedEpisode = episode;
            try {
              const detailData = await syncService.makeRequest(`/library/metadata/${episode.ratingKey}`);
              detailedEpisode = detailData.MediaContainer?.Metadata?.[0] || episode;
            } catch (error) {
              console.warn(`         Warning: Failed to fetch detailed episode metadata: ${error.message}`);
            }
            
            const episodeData = {
              ratingKey: detailedEpisode.ratingKey,
              title: detailedEpisode.title,
              index: detailedEpisode.index ? parseInt(detailedEpisode.index) : 0,
              seasonIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : 0,
              showTitle: syncedShow.title,
              seasonRatingKey: sampleSeason.ratingKey,
              viewCount: detailedEpisode.viewCount ? parseInt(detailedEpisode.viewCount) : null,
              lastViewedAt: detailedEpisode.lastViewedAt ? parseInt(detailedEpisode.lastViewedAt) : null,
              addedAt: detailedEpisode.addedAt ? parseInt(detailedEpisode.addedAt) : null,
              originallyAvailableAt: detailedEpisode.originallyAvailableAt || null,
              summary: detailedEpisode.summary || null,
              thumb: detailedEpisode.thumb || null,
              // Additional fields
              duration: detailedEpisode.duration ? parseInt(detailedEpisode.duration) : null,
              grandparentGuid: detailedEpisode.grandparentGuid || null,
              grandparentKey: detailedEpisode.grandparentKey || null,
              grandparentRatingKey: detailedEpisode.grandparentRatingKey || null,
              grandparentThumb: detailedEpisode.grandparentThumb || null,
              grandparentTitle: detailedEpisode.grandparentTitle || null,
              guid: detailedEpisode.guid || null,
              key: detailedEpisode.key || null,
              librarySectionID: detailedEpisode.librarySectionID ? parseInt(detailedEpisode.librarySectionID) : null,
              librarySectionKey: detailedEpisode.librarySectionKey || null,
              librarySectionTitle: detailedEpisode.librarySectionTitle || null,
              parentGuid: detailedEpisode.parentGuid || null,
              parentIndex: detailedEpisode.parentIndex ? parseInt(detailedEpisode.parentIndex) : null,
              parentKey: detailedEpisode.parentKey || null,
              parentRatingKey: detailedEpisode.parentRatingKey || null,
              parentThumb: detailedEpisode.parentThumb || null,
              parentTitle: detailedEpisode.parentTitle || null,
              skipCount: detailedEpisode.skipCount ? parseInt(detailedEpisode.skipCount) : null,
              titleSort: detailedEpisode.titleSort || null,
              type: detailedEpisode.type || null,
              updatedAt_plex: detailedEpisode.updatedAt ? parseInt(detailedEpisode.updatedAt) : null
            };
            
            await prisma.plexEpisode.upsert({
              where: { ratingKey: episode.ratingKey },
              update: episodeData,
              create: episodeData
            });
            
            await syncService.clearComplexFields(detailedEpisode.ratingKey, 'episode');
            await syncService.syncComplexFields(detailedEpisode, 'episode', detailedEpisode.ratingKey);
            
            console.log(`       ✅ Synced episode: ${detailedEpisode.title}`);
            console.log(`         originallyAvailableAt: ${detailedEpisode.originallyAvailableAt}`);
          }
        }
        
        // Only test one show for now
        break;
      }
      console.log('');
    }
    
    // Step 3: Test movie sync with just 1-2 movies
    const movieSection = sections.find(s => s.type === 'movie');
    if (movieSection) {
      console.log('3. Testing movie sync (sample only)...');
      
      // Get a small sample of movies
      const data = await syncService.makeRequest(`/library/sections/${movieSection.sectionKey}/all?type=1`);
      const allMovies = data.MediaContainer?.Metadata || [];
      const sampleMovies = allMovies.slice(0, 2); // Just sync 2 movies
      
      console.log(`   Found ${allMovies.length} total movies, syncing first ${sampleMovies.length} as sample...`);
      
      for (const movie of sampleMovies) {
        console.log(`   Syncing movie: ${movie.title}`);
        
        // Fetch detailed metadata
        let detailedMovie = movie;
        try {
          const detailData = await syncService.makeRequest(`/library/metadata/${movie.ratingKey}`);
          detailedMovie = detailData.MediaContainer?.Metadata?.[0] || movie;
        } catch (error) {
          console.warn(`     Warning: Failed to fetch detailed metadata: ${error.message}`);
        }
        
        const movieData = {
          ratingKey: detailedMovie.ratingKey,
          title: detailedMovie.title,
          year: detailedMovie.year ? parseInt(detailedMovie.year) : null,
          summary: detailedMovie.summary || null,
          thumb: detailedMovie.thumb || null,
          art: detailedMovie.art || null,
          viewCount: detailedMovie.viewCount ? parseInt(detailedMovie.viewCount) : null,
          lastViewedAt: detailedMovie.lastViewedAt ? parseInt(detailedMovie.lastViewedAt) : null,
          addedAt: detailedMovie.addedAt ? parseInt(detailedMovie.addedAt) : null,
          originallyAvailableAt: detailedMovie.originallyAvailableAt || null,
          updatedAt_plex: detailedMovie.updatedAt ? parseInt(detailedMovie.updatedAt) : null,
          collections: detailedMovie.Collection ? JSON.stringify(detailedMovie.Collection.map(c => c.tag || c.title)) : null,
          // Additional fields
          audienceRating: detailedMovie.audienceRating ? parseFloat(detailedMovie.audienceRating) : null,
          audienceRatingImage: detailedMovie.audienceRatingImage || null,
          chapterSource: detailedMovie.chapterSource || null,
          contentRating: detailedMovie.contentRating || null,
          duration: detailedMovie.duration ? parseInt(detailedMovie.duration) : null,
          guid: detailedMovie.guid || null,
          key: detailedMovie.key || null,
          librarySectionID: detailedMovie.librarySectionID ? parseInt(detailedMovie.librarySectionID) : null,
          librarySectionKey: detailedMovie.librarySectionKey || null,
          librarySectionTitle: detailedMovie.librarySectionTitle || null,
          primaryExtraKey: detailedMovie.primaryExtraKey || null,
          rating: detailedMovie.rating ? parseFloat(detailedMovie.rating) : null,
          ratingImage: detailedMovie.ratingImage || null,
          skipCount: detailedMovie.skipCount ? parseInt(detailedMovie.skipCount) : null,
          slug: detailedMovie.slug || null,
          studio: detailedMovie.studio || null,
          tagline: detailedMovie.tagline || null,
          titleSort: detailedMovie.titleSort || null,
          type: detailedMovie.type || null,
          sectionKey: movieSection.sectionKey,
          lastSyncedAt: new Date()
        };
        
        const syncedMovie = await prisma.plexMovie.upsert({
          where: { ratingKey: detailedMovie.ratingKey },
          update: movieData,
          create: movieData
        });
        
        // Test complex fields sync
        await syncService.clearComplexFields(detailedMovie.ratingKey, 'movie');
        await syncService.syncComplexFields(detailedMovie, 'movie', detailedMovie.ratingKey);
        
        console.log(`   ✅ Synced movie: ${syncedMovie.title}`);
        console.log(`     originallyAvailableAt: ${detailedMovie.originallyAvailableAt}`);
        console.log(`     Collections: ${detailedMovie.Collection ? detailedMovie.Collection.map(c => c.tag || c.title).join(', ') : 'None'}`);
      }
      console.log('');
    }
    
    // Step 4: Show summary
    console.log('4. Sample sync summary:');
    const counts = await Promise.all([
      prisma.plexLibrarySection.count(),
      prisma.plexTVShow.count(),
      prisma.plexSeason.count(),
      prisma.plexEpisode.count(),
      prisma.plexMovie.count(),
      // Complex fields
      prisma.plexDirector.count(),
      prisma.plexGenre.count(),
      prisma.plexProducer.count(),
      prisma.plexWriter.count(),
      prisma.plexRole.count(),
      prisma.plexCountry.count(),
      prisma.plexRating.count(),
      prisma.plexGuid.count(),
      prisma.plexMedia.count(),
      prisma.plexImage.count(),
      prisma.plexUltraBlurColor.count()
    ]);
    
    console.log(`   Library Sections: ${counts[0]}`);
    console.log(`   TV Shows: ${counts[1]}`);
    console.log(`   Seasons: ${counts[2]}`);
    console.log(`   Episodes: ${counts[3]}`);
    console.log(`   Movies: ${counts[4]}`);
    console.log('   Complex Fields:');
    console.log(`     Directors: ${counts[5]}`);
    console.log(`     Genres: ${counts[6]}`);
    console.log(`     Producers: ${counts[7]}`);
    console.log(`     Writers: ${counts[8]}`);
    console.log(`     Cast/Roles: ${counts[9]}`);
    console.log(`     Countries: ${counts[10]}`);
    console.log(`     Ratings: ${counts[11]}`);
    console.log(`     GUIDs: ${counts[12]}`);
    console.log(`     Media: ${counts[13]}`);
    console.log(`     Images: ${counts[14]}`);
    console.log(`     UltraBlurColors: ${counts[15]}`);
    
    console.log('\n✅ Sample sync test completed successfully!');
    
  } catch (error) {
    console.error('❌ Sample sync test failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

testPlexSyncSample();
