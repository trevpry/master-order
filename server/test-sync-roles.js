const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

async function testSyncComplexFields() {
  const prisma = new PrismaClient();
  
  try {
    // Get settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (!settings || !settings.plexToken || !settings.plexUrl) {
      console.log('Plex settings not configured');
      return;
    }
    
    const plexUrl = settings.plexUrl;
    const plexToken = settings.plexToken;
    
    // Simulate what the sync process does for episode 44074
    console.log('=== TESTING SYNC PROCESS FOR EPISODE 44074 ===\n');
    
    console.log('1. Fetching detailed episode data (like sync does)...');
    const detailResponse = await fetch(`${plexUrl}/library/metadata/44074?X-Plex-Token=${plexToken}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const detailData = await detailResponse.json();
    const detailedEpisode = detailData.MediaContainer?.Metadata?.[0];
    
    if (!detailedEpisode) {
      console.log('No detailed episode data found');
      return;
    }
    
    console.log('Episode Title:', detailedEpisode.title);
    console.log('Episode ratingKey:', detailedEpisode.ratingKey);
    console.log('Has Role field?', 'Role' in detailedEpisode);
    
    if (detailedEpisode.Role && Array.isArray(detailedEpisode.Role)) {
      console.log('Role count:', detailedEpisode.Role.length);
      console.log('First few roles:');
      detailedEpisode.Role.slice(0, 3).forEach((role, index) => {
        console.log(`  ${index + 1}. ${role.tag} (${role.role || 'Unknown role'})`);
      });
      
      console.log('\n2. Testing what would be stored in database...');
      
      // Simulate the role storage logic from syncComplexFields
      for (const role of detailedEpisode.Role.slice(0, 2)) { // Just test first 2
        const roleData = {
          tag: role.tag || role.title,
          filter: role.filter || null,
          tagKey: role.tagKey || null,
          role: role.role || null,
          thumb: role.thumb || null,
          episodeRatingKey: detailedEpisode.ratingKey
        };
        
        console.log('Would store role data:', roleData);
        
        // Actually try to store one role to see if it works
        try {
          const createdRole = await prisma.plexRole.create({
            data: roleData
          });
          console.log('✅ Successfully stored role:', createdRole.id);
          
          // Clean up the test role
          await prisma.plexRole.delete({
            where: { id: createdRole.id }
          });
          console.log('✅ Cleaned up test role');
          
        } catch (roleError) {
          console.log('❌ Failed to store role:', roleError.message);
        }
      }
      
    } else {
      console.log('No Role data found in detailed episode');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSyncComplexFields();