/**
 * Create Dummy Plex Data for Testing Android API Endpoints
 * This script creates sample Plex data to test Android endpoints
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDummyPlexData() {
  console.log('🎬 Creating dummy Plex data for Android API testing...');

  try {
    // Clear existing test data first (in reverse dependency order)
    console.log('🧹 Clearing existing test data...');
    
    // Delete playlist items first (they reference playlists)
    await prisma.plexPlaylistItem.deleteMany({
      where: {
        playlistRatingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete playlists
    await prisma.plexPlaylist.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete tracks (they reference albums and artists)
    await prisma.plexTrack.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete albums (they reference artists)
    await prisma.plexAlbum.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete artists
    await prisma.plexArtist.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete episodes (they reference seasons)
    await prisma.plexEpisode.deleteMany({
      where: {
        OR: [
          { ratingKey: { startsWith: 'test-' } },
          { seasonRatingKey: { startsWith: 'test-' } }
        ]
      }
    });
    
    // Delete seasons (they reference shows)
    await prisma.plexSeason.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete shows
    await prisma.plexTVShow.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete movies
    await prisma.plexMovie.deleteMany({
      where: {
        ratingKey: {
          startsWith: 'test-'
        }
      }
    });
    
    // Delete library sections last
    await prisma.plexLibrarySection.deleteMany({
      where: {
        sectionKey: {
          startsWith: 'test-'
        }
      }
    });
    
    console.log('✅ Existing test data cleared');

    // Create Plex Libraries
    console.log('📚 Creating Plex libraries...');
    const tvLibrary = await prisma.plexLibrarySection.create({
      data: {
        sectionKey: 'test-tv-library-1',
        title: 'TV Shows (Test)',
        type: 'show'
      }
    });

    const movieLibrary = await prisma.plexLibrarySection.create({
      data: {
        sectionKey: 'test-movie-library-1', 
        title: 'Movies (Test)',
        type: 'movie'
      }
    });

    const musicLibrary = await prisma.plexLibrarySection.create({
      data: {
        sectionKey: 'test-music-library-1',
        title: 'Music (Test)',
        type: 'artist'
      }
    });

    // Create TV Shows
    console.log('📺 Creating TV shows...');
    const tvShow1 = await prisma.plexTVShow.create({
      data: {
        ratingKey: 'test-show-1001',
        title: 'Breaking Bad',
        summary: 'A high school chemistry teacher turned meth cook.',
        year: 2008,
        thumb: '/library/metadata/1001/thumb',
        art: '/library/metadata/1001/art',
        sectionKey: tvLibrary.sectionKey,
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000)
      }
    });

    const tvShow2 = await prisma.plexTVShow.create({
      data: {
        ratingKey: 'test-show-1002',
        title: 'The Office',
        summary: 'A mockumentary about office workers.',
        year: 2005,
        thumb: '/library/metadata/1002/thumb',
        art: '/library/metadata/1002/art',
        sectionKey: tvLibrary.sectionKey,
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000)
      }
    });

    // Create Seasons
    console.log('🗓️ Creating seasons...');
    const season1 = await prisma.plexSeason.create({
      data: {
        ratingKey: 'test-season-2001',
        title: 'Season 1',
        index: 1,
        showRatingKey: tvShow1.ratingKey,
        thumb: '/library/metadata/2001/thumb',
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000)
      }
    });

    const season2 = await prisma.plexSeason.create({
      data: {
        ratingKey: 'test-season-2002',
        title: 'Season 1',
        index: 1,
        showRatingKey: tvShow2.ratingKey,
        thumb: '/library/metadata/2002/thumb',
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000)
      }
    });

    // Create Episodes
    console.log('🎭 Creating episodes...');
    const episode1 = await prisma.plexEpisode.create({
      data: {
        ratingKey: 'test-episode-3001',
        title: 'Pilot',
        index: 1,
        seasonIndex: 1,
        showTitle: tvShow1.title,
        seasonRatingKey: season1.ratingKey,
        summary: 'Walter White begins his journey.',
        duration: 2700000,
        thumb: '/library/metadata/3001/thumb',
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000),
        viewCount: 0
      }
    });

    const episode2 = await prisma.plexEpisode.create({
      data: {
        ratingKey: 'test-episode-3002',
        title: 'Cat\'s in the Bag...',
        index: 2,
        seasonIndex: 1,
        showTitle: tvShow1.title,
        seasonRatingKey: season1.ratingKey,
        summary: 'Walter and Jesse dispose of their first victim.',
        duration: 2700000,
        thumb: '/library/metadata/3002/thumb',
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000),
        viewCount: 0
      }
    });

    const episode3 = await prisma.plexEpisode.create({
      data: {
        ratingKey: 'test-episode-3003',
        title: 'Diversity Day',
        index: 2,
        seasonIndex: 1,
        showTitle: tvShow2.title,
        seasonRatingKey: season2.ratingKey,
        summary: 'Michael hosts a diversity training seminar.',
        duration: 1320000,
        thumb: '/library/metadata/3003/thumb',
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000),
        viewCount: 0
      }
    });

    // Create Movies
    console.log('🎬 Creating movies...');
    const movie1 = await prisma.plexMovie.create({
      data: {
        ratingKey: 'test-movie-4001',
        title: 'The Matrix',
        summary: 'A computer hacker learns about the true nature of reality.',
        year: 1999,
        studio: 'Warner Bros.',
        duration: 8160000, // 136 minutes in ms
        thumb: '/library/metadata/4001/thumb',
        art: '/library/metadata/4001/art',
        sectionKey: movieLibrary.sectionKey,
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000),
        viewCount: 0
      }
    });

    const movie2 = await prisma.plexMovie.create({
      data: {
        ratingKey: 'test-movie-4002',
        title: 'Inception',
        summary: 'A thief enters people\'s dreams to steal secrets.',
        year: 2010,
        studio: 'Warner Bros.',
        duration: 8880000, // 148 minutes in ms
        thumb: '/library/metadata/4002/thumb',
        art: '/library/metadata/4002/art',
        sectionKey: movieLibrary.sectionKey,
        addedAt: Math.floor(new Date('2023-01-01').getTime() / 1000),
        updatedAt_plex: Math.floor(new Date('2023-01-01').getTime() / 1000),
        viewCount: 0
      }
    });

    // Create Music Artists
    console.log('🎵 Creating music artists...');
    const artist1 = await prisma.plexArtist.create({
      data: {
        ratingKey: 'test-artist-5001',
        key: '/library/metadata/5001',
        title: 'The Beatles',
        summary: 'English rock band formed in Liverpool.',
        thumb: '/library/metadata/5001/thumb',
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    const artist2 = await prisma.plexArtist.create({
      data: {
        ratingKey: 'test-artist-5002',
        key: '/library/metadata/5002',
        title: 'Pink Floyd',
        summary: 'English progressive rock band.',
        thumb: '/library/metadata/5002/thumb',
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    // Create Music Albums
    console.log('💿 Creating music albums...');
    const album1 = await prisma.plexAlbum.create({
      data: {
        ratingKey: 'test-album-6001',
        key: '/library/metadata/6001',
        title: 'Abbey Road',
        year: 1969,
        thumb: '/library/metadata/6001/thumb',
        parentRatingKey: artist1.ratingKey,
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    const album2 = await prisma.plexAlbum.create({
      data: {
        ratingKey: 'test-album-6002',
        key: '/library/metadata/6002',
        title: 'The Dark Side of the Moon',
        year: 1973,
        thumb: '/library/metadata/6002/thumb',
        parentRatingKey: artist2.ratingKey,
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    // Create Music Tracks
    console.log('🎶 Creating music tracks...');
    const track1 = await prisma.plexTrack.create({
      data: {
        ratingKey: 'test-track-7001',
        key: '/library/metadata/7001',
        title: 'Come Together',
        index: 1,
        duration: 259000, // 4:19 in ms
        thumb: '/library/metadata/7001/thumb',
        parentRatingKey: album1.ratingKey,
        grandparentRatingKey: artist1.ratingKey,
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        viewCount: 0
      }
    });

    const track2 = await prisma.plexTrack.create({
      data: {
        ratingKey: 'test-track-7002',
        key: '/library/metadata/7002',
        title: 'Something',
        index: 2,
        duration: 183000, // 3:03 in ms
        thumb: '/library/metadata/7002/thumb',
        parentRatingKey: album1.ratingKey,
        grandparentRatingKey: artist1.ratingKey,
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        viewCount: 0
      }
    });

    const track3 = await prisma.plexTrack.create({
      data: {
        ratingKey: 'test-track-7003',
        key: '/library/metadata/7003',
        title: 'Time',
        index: 3,
        duration: 413000, // 6:53 in ms
        thumb: '/library/metadata/7003/thumb',
        parentRatingKey: album2.ratingKey,
        grandparentRatingKey: artist2.ratingKey,
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        viewCount: 0
      }
    });

    // Create Playlists
    console.log('📋 Creating playlists...');
    const playlist1 = await prisma.plexPlaylist.create({
      data: {
        ratingKey: 'test-playlist-8001',
        key: '/playlists/8001',
        title: 'Classic Rock Hits',
        summary: 'The best classic rock songs.',
        playlistType: 'audio',
        duration: 3600000, // 1 hour
        leafCount: 20,
        thumb: '/playlists/8001/thumb',
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    const playlist2 = await prisma.plexPlaylist.create({
      data: {
        ratingKey: 'test-playlist-8002',
        key: '/playlists/8002',
        title: 'Chill Vibes',
        summary: 'Relaxing music for any time.',
        playlistType: 'audio',
        duration: 2700000, // 45 minutes
        leafCount: 15,
        thumb: '/playlists/8002/thumb',
        librarySectionID: musicLibrary.id,
        addedAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01')
      }
    });

    // Create Playlist Items
    console.log('🎼 Creating playlist items...');
    await prisma.plexPlaylistItem.create({
      data: {
        playlistRatingKey: playlist1.ratingKey,
        ratingKey: 'test-track-7001',
        type: 'track',
        title: 'Come Together',
        duration: 259000,
        addedAt: new Date('2023-01-01')
      }
    });

    await prisma.plexPlaylistItem.create({
      data: {
        playlistRatingKey: playlist1.ratingKey,
        ratingKey: 'test-track-7003',
        type: 'track',
        title: 'Time',
        duration: 413000,
        addedAt: new Date('2023-01-01')
      }
    });

    await prisma.plexPlaylistItem.create({
      data: {
        playlistRatingKey: playlist2.ratingKey,
        ratingKey: 'test-track-7002',
        type: 'track',
        title: 'Something',
        duration: 183000,
        addedAt: new Date('2023-01-01')
      }
    });

    // Create Background Galleries
    console.log('🖼️ Creating background galleries...');
    const gallery1 = await prisma.backgroundGallery.create({
      data: {
        name: 'nature',
        description: 'Beautiful nature scenes'
      }
    });

    const gallery2 = await prisma.backgroundGallery.create({
      data: {
        name: 'space',
        description: 'Stunning space photography'
      }
    });

    // Create Background Images
    console.log('🌄 Creating background images...');
    await prisma.backgroundImage.create({
      data: {
        filename: 'nature-001.jpg',
        path: '/backgrounds/nature/nature-001.jpg',
        galleryId: gallery1.id
      }
    });

    await prisma.backgroundImage.create({
      data: {
        filename: 'nature-002.jpg',
        path: '/backgrounds/nature/nature-002.jpg',
        galleryId: gallery1.id
      }
    });

    await prisma.backgroundImage.create({
      data: {
        filename: 'space-001.jpg',
        path: '/backgrounds/space/space-001.jpg',
        galleryId: gallery2.id
      }
    });

    // Create Custom Order for testing
    console.log('📝 Creating custom order...');
    const customOrder = await prisma.customOrder.create({
      data: {
        name: 'Test Order',
        description: 'Test order for Android API',
        backgroundGalleryId: gallery1.id
      }
    });

    await prisma.customOrderItem.create({
      data: {
        title: 'Avatar: Tsu\'tey\'s Path (2019) #1',
        mediaType: 'comic',
        customOrderId: customOrder.id
      }
    });

    console.log('✅ Dummy Plex data created successfully!');
    console.log('📊 Created:');
    console.log(`   📚 ${3} libraries`);
    console.log(`   📺 ${2} TV shows`);
    console.log(`   🗓️ ${2} seasons`);
    console.log(`   🎭 ${3} episodes`);
    console.log(`   🎬 ${2} movies`);
    console.log(`   🎵 ${2} artists`);
    console.log(`   💿 ${2} albums`);
    console.log(`   🎶 ${3} tracks`);
    console.log(`   📋 ${2} playlists`);
    console.log(`   🎼 ${3} playlist items`);
    console.log(`   🖼️ ${2} galleries`);
    console.log(`   🌄 ${3} background images`);
    console.log(`   📝 ${1} custom order`);

    console.log('\n🧪 Now you can test Android endpoints with real data!');
    console.log('📱 Try these endpoints:');
    console.log('   • /api/android/up-next');
    console.log('   • /api/android/gallery/nature/random-image');
    console.log('   • /api/android/playlist/classic-rock-hits/random-track');
    console.log('   • POST /api/android/play-plex with ratingKey');

  } catch (error) {
    console.error('❌ Error creating dummy data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
if (require.main === module) {
  createDummyPlexData().catch(console.error);
}

module.exports = createDummyPlexData;
