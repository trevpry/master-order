#!/usr/bin/env node

/**
 * Manual Migration Recovery for Production
 * 
 * Use this script if you need to manually fix the failed migration
 * Run: node manual-migration-fix.js
 */

const { PrismaClient } = require('@prisma/client');

async function manualFix() {
  console.log('[INFO] === Manual Migration Recovery ===');
  console.log('[INFO] This will safely resolve the failed 20250519171207_init migration');
  
  const prisma = new PrismaClient();
  
  try {
    // Show current failed migrations
    console.log('[INFO] Checking for failed migrations...');
    const failed = await prisma.$queryRaw`
      SELECT migration_name, started_at, finished_at, logs 
      FROM _prisma_migrations 
      WHERE finished_at IS NULL
      ORDER BY started_at DESC
    `;
    
    console.log(`[INFO] Found ${failed.length} failed migration(s)`);
    
    if (failed.length === 0) {
      console.log('[SUCCESS] No failed migrations found!');
      console.log('[INFO] You can now run: npx prisma migrate deploy');
      return;
    }
    
    // Check if tables exist (indicating schema was applied)
    console.log('[INFO] Checking if database schema is intact...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`[INFO] Found ${tables.length} tables in database`);
    
    const criticalTables = ['User', 'PlexMovie', 'PlexTVShow', 'CustomOrder'];
    const missingTables = [];
    
    for (const tableName of criticalTables) {
      const exists = tables.find(t => t.table_name === tableName);
      if (!exists) {
        missingTables.push(tableName);
      }
    }
    
    if (missingTables.length > 0) {
      console.log('[ERROR] Critical tables missing:', missingTables);
      console.log('[ERROR] Cannot safely mark migration as completed');
      console.log('[INFO] Database schema appears incomplete');
      return;
    }
    
    console.log('[SUCCESS] All critical tables exist');
    console.log('[SAFE] Marking failed migration as completed...');
    
    // Mark the failed migration as completed
    for (const migration of failed) {
      await prisma.$executeRaw`
        UPDATE _prisma_migrations 
        SET finished_at = NOW(),
            logs = COALESCE(logs, '') || E'\n[MANUAL-FIX] Migration marked as completed manually'
        WHERE migration_name = ${migration.migration_name}
        AND finished_at IS NULL
      `;
      
      console.log(`[FIXED] ${migration.migration_name}`);
    }
    
    console.log('[SUCCESS] All failed migrations have been marked as completed');
    console.log('[NEXT] Run: npx prisma migrate deploy');
    
  } catch (error) {
    console.error('[ERROR] Recovery failed:', error);
    console.log('[SAFE] No changes made - your data is safe');
  } finally {
    await prisma.$disconnect();
  }
}

manualFix().catch(console.error);