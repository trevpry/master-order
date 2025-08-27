/**
 * Clear Stash URL from database to force environment variable usage
 * This fixes the issue where database settings override environment variables
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearStashUrlFromDatabase() {
  console.log('🧹 Clearing Stash URL from database to use environment variables...');
  
  try {
    // Clear the stashUrl from database settings
    const result = await prisma.settings.upsert({
      where: { id: 1 },
      update: { 
        stashUrl: null 
      },
      create: { 
        id: 1,
        stashUrl: null 
      }
    });
    
    console.log('✅ Successfully cleared stashUrl from database');
    console.log('   - Database will now use environment variables');
    console.log('   - Environment STASH_URL will take priority');
    
    // Verify the change
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    console.log('🔍 Current database settings:');
    console.log('   - stashUrl:', settings?.stashUrl || 'NULL (will use environment)');
    console.log('   - stashApiKey:', settings?.stashApiKey ? 'SET' : 'NOT SET');
    
  } catch (error) {
    console.error('❌ Error clearing stashUrl from database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

clearStashUrlFromDatabase();
