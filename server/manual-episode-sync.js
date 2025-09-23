const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');

async function manualEpisodeSync() {
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
    
    console.log('=== MANUAL EPISODE SYNC TEST ===\n');
    
    console.log('1. Fetching episode 44074 detailed data...');
    const detailResponse = await fetch(`${plexUrl}/library/metadata/44074?X-Plex-Token=${plexToken}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const detailData = await detailResponse.json();
    const detailedEpisode = detailData.MediaContainer?.Metadata?.[0];
    
    if (!detailedEpisode) {
      console.log('❌ No detailed episode data found');
      return;
    }
    
    console.log(`✅ Episode: ${detailedEpisode.title}`);
    console.log(`✅ Has roles: ${detailedEpisode.Role ? detailedEpisode.Role.length : 0}`);
    
    console.log('\n2. Clearing existing episode roles...');
    const deletedRoles = await prisma.plexRole.deleteMany({ 
      where: { episodeRatingKey: '44074' } 
    });
    console.log(`✅ Deleted ${deletedRoles.count} existing roles`);
    
    console.log('\n3. Syncing episode roles...');
    let successCount = 0;
    let errorCount = 0;
    
    if (detailedEpisode.Role && Array.isArray(detailedEpisode.Role)) {
      for (const role of detailedEpisode.Role) {
        try {
          const roleData = {
            tag: role.tag || role.title,
            filter: role.filter || null,
            tagKey: role.tagKey || null,
            role: role.role || null,
            thumb: role.thumb || null,
            episodeRatingKey: '44074'
          };
          
          const createdRole = await prisma.plexRole.create({
            data: roleData
          });
          console.log(`✅ Created role: ${role.tag} (${role.role}) - ID: ${createdRole.id}`);
          successCount++;
          
        } catch (error) {
          console.log(`❌ Failed to create role ${role.tag}: ${error.message}`);
          errorCount++;
        }
      }
    }
    
    console.log(`\n4. Sync complete:`);
    console.log(`   ✅ Successfully created: ${successCount} roles`);
    console.log(`   ❌ Failed: ${errorCount} roles`);
    
    // Verify the roles were created
    console.log('\n5. Verifying stored roles...');
    const storedRoles = await prisma.plexRole.findMany({
      where: { episodeRatingKey: '44074' }
    });
    console.log(`Found ${storedRoles.length} roles in database for episode 44074`);
    
    if (storedRoles.length > 0) {
      storedRoles.forEach(role => {
        console.log(`   - ${role.tag} (${role.role || 'Unknown role'})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

manualEpisodeSync();