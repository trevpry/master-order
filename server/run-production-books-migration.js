#!/usr/bin/env node

/**
 * Production Books Migration Runner
 * 
 * This script runs the comprehensive books migration in production PostgreSQL environment.
 * It includes safety checks, environment validation, and proper error handling.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🏭 Production Books Migration Runner');
console.log('=====================================\n');

// Environment validation
function validateEnvironment() {
  console.log('🔍 Validating production environment...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is required');
    console.error('   Set it to your PostgreSQL connection string:');
    console.error('   export DATABASE_URL="postgresql://user:pass@host:port/database"');
    console.error('   Or: $env:DATABASE_URL="postgresql://user:pass@host:port/database"');
    process.exit(1);
  }
  
  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.error('❌ DATABASE_URL must be a PostgreSQL connection string');
    console.error('   Current value appears to be SQLite or invalid');
    console.error('   Expected format: postgresql://user:pass@host:port/database');
    process.exit(1);
  }
  
  // Mask password for display
  const maskedUrl = databaseUrl.replace(/\/\/.*@/, '//***@');
  console.log('✅ PostgreSQL database URL detected');
  console.log(`   Connection: ${maskedUrl}`);
  
  // Check if Prisma client is available
  try {
    require('@prisma/client');
    console.log('✅ Prisma client available');
  } catch (error) {
    console.error('❌ Prisma client not found. Run: npm install');
    process.exit(1);
  }
  
  // Check if migration script exists
  const migrationScript = path.join(__dirname, 'comprehensive-books-migration.js');
  if (!fs.existsSync(migrationScript)) {
    console.error('❌ Migration script not found:', migrationScript);
    process.exit(1);
  }
  console.log('✅ Migration script found');
  
  console.log('\n✅ Environment validation passed!\n');
}

// Safety warnings
function showSafetyWarnings() {
  console.log('⚠️  PRODUCTION SAFETY WARNINGS');
  console.log('================================');
  console.log('• This migration will modify your production PostgreSQL database');
  console.log('• Custom Order items will be linked to new unified Book records');
  console.log('• History Plus books will be migrated and original records deleted');
  console.log('• All operations run within a PostgreSQL transaction for safety');
  console.log('• If migration fails, all changes will be rolled back automatically');
  console.log('');
  console.log('📋 RECOMMENDED: Take a database backup before proceeding');
  console.log('   pg_dump "$DATABASE_URL" > books_migration_backup.sql');
  console.log('');
}

// Run migration
function runMigration() {
  console.log('🚀 Starting production books migration...\n');
  
  try {
    // Run the migration with environment variables
    execSync('node comprehensive-books-migration.js', {
      stdio: 'inherit',
      env: process.env,
      cwd: __dirname
    });
    
    console.log('\n🎉 Production books migration completed successfully!');
    console.log('🔧 Your PostgreSQL database has been updated with unified book system');
    console.log('📱 Android API will now serve enhanced book metadata from unified library');
    
  } catch (error) {
    console.error('\n💥 Production migration failed!');
    console.error('🔄 PostgreSQL transaction was automatically rolled back');
    console.error('📊 Your database remains unchanged');
    
    if (error.code) {
      console.error(`   Exit code: ${error.code}`);
    }
    
    process.exit(1);
  }
}

// Main execution
function main() {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const forceRun = args.includes('--force') || args.includes('-f');
  
  validateEnvironment();
  showSafetyWarnings();
  
  if (!forceRun) {
    console.log('⏸️  Migration ready to run. Use one of these commands:');
    console.log('');
    console.log('   Production (recommended):');
    console.log('   DATABASE_URL="postgresql://user:pass@host:port/db" node run-production-books-migration.js --force');
    console.log('');
    console.log('   Or run migration directly:');
    console.log('   DATABASE_URL="postgresql://user:pass@host:port/db" node comprehensive-books-migration.js');
    console.log('');
    console.log('💡 Add --force flag to run immediately');
    process.exit(0);
  }
  
  runMigration();
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { validateEnvironment, runMigration };