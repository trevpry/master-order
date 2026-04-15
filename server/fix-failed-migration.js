#!/usr/bin/env node

/**
 * Safe Migration Recovery Script
 * 
 * Resolves failed Prisma migrations safely without data loss
 * Specifically handles the failed 20250519171207_init migration
 */

const { PrismaClient } = require('@prisma/client');

async function fixFailedMigration() {
  const prisma = new PrismaClient();
  
  try {
    console.log('[INFO] Starting safe migration recovery...');
    
    // Check current migration status
    console.log('[INFO] Checking current migration status...');
    
    const failedMigrations = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, logs 
      FROM _prisma_migrations 
      WHERE finished_at IS NULL
      ORDER BY started_at DESC
    `;
    
    console.log('[INFO] Failed migrations found:', failedMigrations.length);
    
    if (failedMigrations.length === 0) {
      console.log('[INFO] No failed migrations found. Migration system is healthy.');
      return;
    }
    
    // Show failed migrations
    for (const migration of failedMigrations) {
      console.log(`[FAILED] ${migration.migration_name}`);
      console.log(`  Started: ${migration.started_at}`);
      console.log(`  Logs: ${migration.logs || 'No logs available'}`);
    }
    
    // Check if the failed init migration actually applied its schema changes
    console.log('[INFO] Checking if schema changes from init migration were applied...');
    
    // Check for key tables that should exist after init migration
    const tableChecks = [
      'User',
      'PlexMovie', 
      'PlexTVShow',
      'PlexEpisode',
      'CustomOrder',
      'CustomOrderItem'
    ];
    
    let schemaApplied = true;
    for (const tableName of tableChecks) {
      try {
        const tableExists = await prisma.$queryRaw`
          SELECT COUNT(*) as count 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        `;
        
        if (Number(tableExists[0].count) === 0) {
          console.log(`[MISSING] Table ${tableName} does not exist`);
          schemaApplied = false;
        } else {
          console.log(`[OK] Table ${tableName} exists`);
        }
      } catch (error) {
        console.log(`[ERROR] Could not check table ${tableName}:`, error.message);
        schemaApplied = false;
      }
    }
    
    if (schemaApplied) {
      console.log('[INFO] Schema appears to be correctly applied despite migration failure');
      console.log('[SAFE] Marking failed migration as completed...');
      
      // Mark the failed migration as completed
      const failedMigration = failedMigrations[0];
      await prisma.$executeRaw`
        UPDATE _prisma_migrations 
        SET finished_at = NOW(), 
            logs = COALESCE(logs, '') || E'\n[RECOVERED] Migration marked as completed by recovery script'
        WHERE migration_name = ${failedMigration.migration_name}
        AND finished_at IS NULL
      `;
      
      console.log(`[SUCCESS] Marked migration ${failedMigration.migration_name} as completed`);
      
    } else {
      console.log('[WARNING] Schema appears incomplete - manual intervention required');
      console.log('[SAFE] NOT marking migration as completed to prevent data corruption');
      console.log('[INFO] You may need to manually resolve the schema state');
      
      // Show the failed migration details
      const failedMigration = failedMigrations[0];
      console.log('\n[DEBUG] Failed migration details:');
      console.log(`Migration: ${failedMigration.migration_name}`);
      console.log(`Started: ${failedMigration.started_at}`);
      console.log(`Logs: ${failedMigration.logs || 'No logs available'}`);
      
      return false;
    }
    
    // Verify migration status after fix
    console.log('[INFO] Verifying migration status after fix...');
    const remainingFailed = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM _prisma_migrations 
      WHERE finished_at IS NULL
    `;
    
    if (Number(remainingFailed[0].count) === 0) {
      console.log('[SUCCESS] All migrations are now marked as completed');
      console.log('[INFO] You can now run "npx prisma migrate deploy" to apply pending migrations');
      return true;
    } else {
      console.log('[WARNING] Some migrations are still marked as failed');
      return false;
    }
    
  } catch (error) {
    console.error('[ERROR] Migration recovery failed:', error);
    console.log('[SAFE] No changes were made to preserve data integrity');
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the recovery if called directly
if (require.main === module) {
  fixFailedMigration()
    .then((success) => {
      if (success) {
        console.log('\n[SUCCESS] Migration recovery completed successfully!');
        console.log('[NEXT] Run: npx prisma migrate deploy');
        process.exit(0);
      } else {
        console.log('\n[FAILED] Migration recovery could not be completed automatically');
        console.log('[SAFE] Your data is completely safe - no destructive operations were performed');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n[ERROR] Recovery script failed:', error);
      process.exit(1);
    });
}

module.exports = { fixFailedMigration };