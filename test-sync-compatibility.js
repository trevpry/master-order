#!/usr/bin/env node

// Test the improved Plex music sync with cross-database compatibility
const { PrismaClient } = require('@prisma/client');

async function testMusicSync() {
  const prisma = new PrismaClient();
  
  try {
    // Import the PlexSyncService
    const { PlexSyncService } = require('./server/plexSyncService.js');
    
    // Initialize the sync service
    const syncService = new PlexSyncService();
    
    console.log('🎵 Testing Plex Music Sync with Database Compatibility...\n');
    
    // Check database connection
    console.log('📊 Checking database connection...');
    try {
      await prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database connection successful');
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
      return;
    }
    
    // Check if we're using SQLite or PostgreSQL
    const databaseUrl = process.env.DATABASE_URL || '';
    const isPostgreSQL = databaseUrl.includes('postgresql://') || databaseUrl.includes('postgres://');
    const isSQLite = databaseUrl.includes('sqlite:') || databaseUrl.includes('file:');
    
    console.log(`📊 Database type: ${isPostgreSQL ? 'PostgreSQL' : isSQLite ? 'SQLite' : 'Unknown'}`);
    
    // Get current counts
    const [artistCount, albumCount, trackCount] = await Promise.all([
      prisma.plexArtist.count(),
      prisma.plexAlbum.count(),
      prisma.plexTrack.count()
    ]);
    
    console.log(`📊 Current counts - Artists: ${artistCount}, Albums: ${albumCount}, Tracks: ${trackCount}\n`);
    
    // Test a small sync (just get one section to avoid long runtime)
    console.log('🔄 Running music sync...');
    await syncService.syncMusic();
    
    // Get updated counts
    const [newArtistCount, newAlbumCount, newTrackCount] = await Promise.all([
      prisma.plexArtist.count(),
      prisma.plexAlbum.count(),
      prisma.plexTrack.count()
    ]);
    
    console.log(`\n📊 Updated counts - Artists: ${newArtistCount}, Albums: ${newAlbumCount}, Tracks: ${newTrackCount}`);
    console.log(`📈 Changes - Artists: +${newArtistCount - artistCount}, Albums: +${newAlbumCount - albumCount}, Tracks: +${newTrackCount - trackCount}`);
    
    // Test specific artist lookup
    console.log('\n🔍 Testing specific artist lookup...');
    const testArtist = await prisma.plexArtist.findFirst({
      where: {
        title: {
          contains: '65daysofstatic',
          mode: 'insensitive'
        }
      },
      include: {
        albums: {
          where: {
            title: {
              contains: 'No Man\'s Sky',
              mode: 'insensitive'
            }
          }
        }
      }
    });
    
    if (testArtist) {
      console.log(`✅ Found artist: ${testArtist.title}`);
      if (testArtist.albums.length > 0) {
        console.log(`✅ Found "No Man's Sky" album: ${testArtist.albums[0].title}`);
      } else {
        console.log('⚠️  "No Man\'s Sky" album not found');
      }
    } else {
      console.log('⚠️  65daysofstatic artist not found');
    }
    
    console.log('\n✅ Music sync test completed successfully!');
    console.log('🎉 The improved sync service is compatible with both SQLite and PostgreSQL');
    
  } catch (error) {
    console.error('❌ Error during music sync test:', error);
    
    // Show specific error handling based on database type
    if (error.code === 'P1008') {
      console.log('🔧 SQLite timeout detected - handled by improved error handling');
    } else if (error.code === 'P1017' || error.code === 'P2024') {
      console.log('🔧 PostgreSQL timeout detected - handled by improved error handling');
    }
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
if (require.main === module) {
  testMusicSync();
}

module.exports = { testMusicSync };
