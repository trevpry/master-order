const path = require('path');
// Use the shared prisma client inside server to avoid needing @prisma/client at repo root
let prisma;
try {
  prisma = require('./server/prismaClient');
} catch (err) {
  console.error('❌ Failed to load shared Prisma client from ./server/prismaClient');
  console.error('   Error:', err.message);
  console.error('👉 Run "cd server && npm install" then retry.');
  process.exit(1);
}

// Import PlexSyncService
const PlexSyncService = require('./server/plexSyncService');

async function investigateAbelKorzeniowski() {
  console.log('🔍 Investigating Abel Korzeniowski music sync issue...\n');
  
  try {
    // Initialize Plex sync service
    const plexSync = new PlexSyncService();
    
    // Ensure library sections are synced so foreign keys (librarySection) exist
    console.log('🗂️ Ensuring Plex library sections are synced (needed for artist/album foreign keys)...');
    try {
      const sectionsSynced = await plexSync.syncLibrarySections();
      console.log(`   ✅ Synced ${sectionsSynced.length} sections`);
    } catch (secErr) {
      console.warn('   ⚠️ Could not sync library sections:', secErr.message);
    }

    // Get settings for Plex connection (after potential dotenv load in prismaClient)
    const settings = await prisma.settings.findFirst();
    if (!settings || !settings.plexUrl || !settings.plexToken) {
      console.error('❌ Plex settings not configured');
      return;
    }
    
    console.log(`🔗 Plex Server: ${settings.plexUrl}`);
    console.log(`🎵 Searching for music sections...`);
    
  // Get all library sections to find music sections (direct from Plex)
  const sectionsData = await plexSync.makeRequest('/library/sections');
    const sections = sectionsData.MediaContainer?.Directory || [];
    const musicSections = sections.filter(section => section.type === 'artist');
    
    console.log(`📚 Found ${musicSections.length} music section(s):`);
    musicSections.forEach(section => {
      console.log(`   - Section ${section.key}: "${section.title}" (${section.type})`);
    });
    
    if (musicSections.length === 0) {
      console.error('❌ No music sections found!');
      return;
    }
    
    // Check each music section for Abel Korzeniowski
    for (const section of musicSections) {
      console.log(`\\n🎼 Checking section "${section.title}" (${section.key}) for Abel Korzeniowski...`);
      
      // Search for Abel Korzeniowski in this section
      try {
        // First, let's see what artists are in this section
        const allArtistsData = await plexSync.makeRequest(`/library/sections/${section.key}/all?X-Plex-Container-Size=50`);
        const allArtists = allArtistsData.MediaContainer?.Metadata || [];
        
        console.log(`   📊 Section contains ${allArtistsData.MediaContainer?.totalSize || allArtists.length} total artists`);
        console.log(`   📄 First 50 artists loaded for analysis`);
        
        // Look for Abel Korzeniowski (case-insensitive)
        const abelArtist = allArtists.find(artist => 
          artist.title && artist.title.toLowerCase().includes('korzeniowski')
        );
        
        if (abelArtist) {
          console.log(`   ✅ FOUND: "${abelArtist.title}" (Rating Key: ${abelArtist.ratingKey})`);
          
          // Get detailed artist info
          const detailData = await plexSync.makeRequest(`/library/metadata/${abelArtist.ratingKey}`);
          const detailedArtist = detailData.MediaContainer?.Metadata?.[0];
          
          if (detailedArtist) {
            console.log(`   📝 Artist Details:`);
            console.log(`      - Full Title: ${detailedArtist.title}`);
            console.log(`      - GUID: ${detailedArtist.guid || 'None'}`);
            console.log(`      - Summary: ${detailedArtist.summary || 'None'}`);
            console.log(`      - Added At: ${detailedArtist.addedAt ? new Date(parseInt(detailedArtist.addedAt) * 1000) : 'Unknown'}`);
            
            // Check for albums
            console.log(`\\n   🎵 Checking albums for ${detailedArtist.title}...`);
            const albumsData = await plexSync.makeRequest(`/library/metadata/${abelArtist.ratingKey}/children`);
            const albums = albumsData.MediaContainer?.Metadata || [];
            
            console.log(`   📀 Found ${albums.length} album(s):`);
            albums.forEach((album, index) => {
              console.log(`      ${index + 1}. "${album.title}" (Rating Key: ${album.ratingKey}, Year: ${album.year || 'Unknown'})`);
            });
            
            if (albums.length > 0) {
              // Check if artist exists in database
              const dbArtist = await prisma.plexArtist.findUnique({
                where: { ratingKey: abelArtist.ratingKey }
              });
              
              console.log(`\\n   🗄️ Database Status:`);
              if (dbArtist) {
                console.log(`      ✅ Artist exists in database`);
                console.log(`      - DB Title: ${dbArtist.title}`);
                console.log(`      - DB Section ID: ${dbArtist.librarySectionID}`);
                
                // Check if albums are in database
                const dbAlbums = await prisma.plexAlbum.findMany({
                  where: { parentRatingKey: abelArtist.ratingKey }
                });
                
                console.log(`      📀 Albums in database: ${dbAlbums.length}/${albums.length}`);
                if (dbAlbums.length < albums.length) {
                  console.log(`      ⚠️ Missing albums detected!`);
                  const dbAlbumKeys = new Set(dbAlbums.map(a => a.ratingKey));
                  const missingAlbums = albums.filter(album => !dbAlbumKeys.has(album.ratingKey));
                  console.log(`      Missing albums:`);
                  missingAlbums.forEach(album => {
                    console.log(`         - "${album.title}" (${album.ratingKey})`);
                  });
                }
                
              } else {
                console.log(`      ❌ Artist NOT found in database`);
                console.log(`      🔧 This explains why albums aren't synced!`);
              }
            }
            
            // Test manual sync of this artist
            console.log(`\n   🔄 Testing manual sync of ${detailedArtist.title} (albums only)...`);
            try {
              await plexSync.syncAlbums(section.key, abelArtist.ratingKey);
              console.log(`   ✅ Manual album sync completed`);
            } catch (syncError) {
              console.log(`   ❌ Manual album sync failed:`, syncError.message);
            }

            console.log(`\n   🔄 Testing full artist → album → track sync path just for this artist...`);
            try {
              // Manually call artist sync again to see if section mismatch occurs
              await plexSync.syncArtists(section.key);
              await plexSync.syncAlbums(section.key, abelArtist.ratingKey);
              const dbAlbumsPost = await prisma.plexAlbum.findMany({ where: { parentRatingKey: abelArtist.ratingKey } });
              console.log(`   📀 Post-sync album count in DB: ${dbAlbumsPost.length}`);
            } catch (fullSyncErr) {
              console.log(`   ❌ Full path sync failed:`, fullSyncErr.message);
            }
            
          } else {
            console.log(`   ❌ Failed to get detailed artist info`);
          }
          
        } else {
          console.log(`   ❌ Abel Korzeniowski not found in this section`);
          
          // Show some sample artists for reference
          if (allArtists.length > 0) {
            console.log(`   📝 Sample artists in this section:`);
            allArtists.slice(0, 5).forEach(artist => {
              console.log(`      - "${artist.title}" (${artist.ratingKey})`);
            });
          }
        }
        
      } catch (sectionError) {
        console.error(`   ❌ Error checking section ${section.key}:`, sectionError.message);
      }
    }
    
    // Check what's actually in our database
    console.log(`\\n🗄️ Checking current database state...`);
    const totalArtists = await prisma.plexArtist.count();
    const totalAlbums = await prisma.plexAlbum.count();
    const totalTracks = await prisma.plexTrack.count();
    
    console.log(`   📊 Database totals:`);
    console.log(`      - Artists: ${totalArtists}`);
    console.log(`      - Albums: ${totalAlbums}`);
    console.log(`      - Tracks: ${totalTracks}`);
    
    // Look for any Korzeniowski entries
    // Case-insensitive search (SQLite client version may not support 'mode: insensitive')
    const korzeniowskiArtistsAll = await prisma.plexArtist.findMany({
      where: {
        title: { contains: 'Korzeniowski' }
      }
    });
    const korzeniowskiArtists = korzeniowskiArtistsAll.filter(a => a.title && a.title.toLowerCase().includes('korzeniowski'));
    
    if (korzeniowskiArtists.length > 0) {
      console.log(`\\n   🎯 Found Korzeniowski entries in database:`);
      for (const artist of korzeniowskiArtists) {
        console.log(`      - "${artist.title}" (${artist.ratingKey})`);
        
        const albums = await prisma.plexAlbum.findMany({
          where: { parentRatingKey: artist.ratingKey }
        });
        console.log(`        Albums: ${albums.length}`);
        albums.forEach(album => {
          console.log(`          - "${album.title}" (${album.year || 'No Year'})`);
        });
      }
    } else {
      console.log(`   ❌ No Korzeniowski entries found in database`);
    }
    
  } catch (error) {
    console.error('❌ Investigation failed:', error);
  } finally {
    // Shared prisma client has its own shutdown handlers; optional manual disconnect
    try { await prisma.$disconnect(); } catch (_) {}
  }
}

// Run the investigation
investigateAbelKorzeniowski().catch(console.error);
