const PlexSyncService = require('./plexSyncService');
const { PrismaClient } = require('@prisma/client');

async function testCleanupFix() {
  const prisma = new PrismaClient();
  const syncService = new PlexSyncService();
  
  try {
    console.log('=== TESTING CLEANUP FIX ===\n');
    
    // Check episode roles before cleanup
    console.log('1. Episode roles BEFORE cleanup:');
    const rolesBefore = await prisma.plexRole.count({
      where: { episodeRatingKey: { not: null } }
    });
    console.log(`   Episode roles: ${rolesBefore}`);
    
    const roles44074Before = await prisma.plexRole.count({
      where: { episodeRatingKey: '44074' }
    });
    console.log(`   Episode 44074 roles: ${roles44074Before}`);
    
    // Run the cleanup process
    console.log('\n2. Running cleanup process...');
    const cleanupResults = await syncService.cleanupOrphanedEntities();
    console.log('Cleanup results:', cleanupResults);
    
    // Check episode roles after cleanup
    console.log('\n3. Episode roles AFTER cleanup:');
    const rolesAfter = await prisma.plexRole.count({
      where: { episodeRatingKey: { not: null } }
    });
    console.log(`   Episode roles: ${rolesAfter}`);
    
    const roles44074After = await prisma.plexRole.count({
      where: { episodeRatingKey: '44074' }
    });
    console.log(`   Episode 44074 roles: ${roles44074After}`);
    
    // Compare results
    console.log('\n4. Results:');
    if (rolesBefore === rolesAfter) {
      console.log('✅ Episode roles preserved - cleanup working correctly!');
    } else {
      console.log(`❌ Episode roles changed: ${rolesBefore} -> ${rolesAfter}`);
    }
    
    if (roles44074Before === roles44074After) {
      console.log('✅ Episode 44074 roles preserved!');
    } else {
      console.log(`❌ Episode 44074 roles changed: ${roles44074Before} -> ${roles44074After}`);
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCleanupFix();