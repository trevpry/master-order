#!/usr/bin/env node

/**
 * Identification Field Deployment Verification Script
 * Run this AFTER deploying to production to verify everything is working
 */

const { PrismaClient } = require('@prisma/client');

async function verifyDeployment() {
  const prisma = new PrismaClient();
  
  console.log('🔍 Verifying Identification Field Deployment\n');
  console.log('=' .repeat(60));
  
  try {
    // 1. Check database connection
    console.log('\n1. Testing database connection...');
    await prisma.$connect();
    console.log('   ✅ Connected to database');
    
    // 2. Verify identification field exists
    console.log('\n2. Verifying identification field...');
    const testScene = await prisma.stashScene.findFirst({
      select: {
        id: true,
        title: true,
        identification: true
      }
    });
    
    if (testScene !== null) {
      console.log('   ✅ Identification field exists and is queryable');
      console.log(`   📄 Sample: "${testScene.title}" - identification: ${testScene.identification || 'NULL'}`);
    } else {
      console.log('   ⚠️  No scenes in database to test with');
    }
    
    // 3. Count scenes by identification status
    console.log('\n3. Counting scenes by identification status...');
    const [notIdentified, identified, scraped, nullCount, total] = await Promise.all([
      prisma.stashScene.count({ where: { identification: 'Not Identified' } }),
      prisma.stashScene.count({ where: { identification: 'Identified' } }),
      prisma.stashScene.count({ where: { identification: 'Identified and Scraped' } }),
      prisma.stashScene.count({ where: { identification: null } }),
      prisma.stashScene.count()
    ]);
    
    console.log(`   📊 Total scenes: ${total}`);
    console.log(`   📊 Not Identified: ${notIdentified}`);
    console.log(`   📊 Identified: ${identified}`);
    console.log(`   📊 Identified and Scraped: ${scraped}`);
    console.log(`   📊 No status (NULL): ${nullCount}`);
    
    // 4. Test updateMany (safe - no actual changes)
    console.log('\n4. Verifying updateMany capability (dry run)...');
    const testResult = await prisma.stashScene.updateMany({
      where: { 
        id: 'non-existent-id-for-testing',
        identification: null 
      },
      data: { identification: 'Not Identified' }
    });
    console.log('   ✅ updateMany query structure is valid');
    console.log(`   📄 Test returned count: ${testResult.count} (expected 0)`);
    
    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('\n✅ DEPLOYMENT VERIFICATION COMPLETE\n');
    console.log('All checks passed! The identification field is:');
    console.log('  • Present in the database schema');
    console.log('  • Queryable via Prisma');
    console.log('  • Ready for filtering and bulk updates');
    console.log('  • Backward compatible (NULL values handled)');
    console.log('\n' + '='.repeat(60));
    
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run verification
verifyDeployment()
  .then(() => {
    console.log('\n✨ Safe to proceed with production deployment!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Verification script error:', error);
    process.exit(1);
  });
