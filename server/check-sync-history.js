const { PrismaClient } = require('@prisma/client');

async function checkSyncHistory() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== CHECKING SYNC HISTORY AND STATUS ===\n');
    
    // Check if episode 44074 exists in database
    console.log('1. Episode 44074 in database:');
    const episode = await prisma.plexEpisode.findUnique({
      where: { ratingKey: '44074' }
    });
    
    if (episode) {
      console.log(`✅ Episode found: "${episode.title}" (Season ${episode.seasonIndex}, Episode ${episode.index})`);
      console.log(`   Added: ${episode.addedAt ? new Date(episode.addedAt * 1000) : 'Unknown'}`);
      console.log(`   Last viewed: ${episode.lastViewedAt ? new Date(episode.lastViewedAt * 1000) : 'Never'}`);
    } else {
      console.log('❌ Episode 44074 not found in database');
    }
    
    // Check roles for this episode
    console.log('\n2. Roles for episode 44074:');
    const roles = await prisma.plexRole.findMany({
      where: { episodeRatingKey: '44074' }
    });
    
    console.log(`Found ${roles.length} roles for episode 44074`);
    if (roles.length > 0) {
      roles.forEach(role => {
        console.log(`   - ${role.tag} (${role.role || 'Unknown role'})`);
      });
    }
    
    // Check total role distribution
    console.log('\n3. Role distribution:');
    const movieRoles = await prisma.plexRole.count({
      where: { movieRatingKey: { not: null } }
    });
    const episodeRoles = await prisma.plexRole.count({
      where: { episodeRatingKey: { not: null } }
    });
    
    console.log(`Movie roles: ${movieRoles}`);
    console.log(`Episode roles: ${episodeRoles}`);
    
    // Check recent episode sync activity
    console.log('\n4. Recent episode updates:');
    const recentEpisodes = await prisma.plexEpisode.findMany({
      orderBy: { updatedAt_plex: 'desc' },
      take: 5,
      select: {
        ratingKey: true,
        title: true,
        showTitle: true,
        updatedAt_plex: true
      }
    });
    
    recentEpisodes.forEach(ep => {
      const updatedDate = ep.updatedAt_plex ? new Date(ep.updatedAt_plex * 1000) : 'Unknown';
      console.log(`   ${ep.showTitle} - ${ep.title} (${ep.ratingKey}) - Updated: ${updatedDate}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSyncHistory();