#!/usr/bin/env node

/**
 * Database Schema Manager
 * 
 * This script automatically sets up the correct Prisma schema based on the environment:
 * - Development: Uses SQLite with schema.sqlite.prisma
 * - Production/Docker: Uses PostgreSQL with schema.postgresql.prisma
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, 'prisma');
const SQLITE_SCHEMA = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');
const POSTGRESQL_SCHEMA = path.join(SCHEMA_DIR, 'schema.postgresql.prisma');
const ACTIVE_SCHEMA = path.join(SCHEMA_DIR, 'schema.prisma');

function detectEnvironment() {
  // Check environment variables
  const nodeEnv = process.env.NODE_ENV;
  const databaseUrl = process.env.DATABASE_URL;
  
  // Check if we're in Docker
  const isDocker = fs.existsSync('/.dockerenv');
  
  // Check if DATABASE_URL suggests PostgreSQL
  const isPostgres = databaseUrl && (
    databaseUrl.startsWith('postgresql://') || 
    databaseUrl.startsWith('postgres://')
  );
  
  // Check if DATABASE_URL suggests SQLite
  const isSqlite = databaseUrl && databaseUrl.startsWith('file:');
  
  console.log('Environment detection:');
  console.log(`- NODE_ENV: ${nodeEnv}`);
  console.log(`- DATABASE_URL: ${databaseUrl ? databaseUrl.replace(/\/\/.*@/, '//***@') : 'not set'}`);
  console.log(`- Docker environment: ${isDocker}`);
  console.log(`- PostgreSQL detected: ${isPostgres}`);
  console.log(`- SQLite detected: ${isSqlite}`);
  
  // Decision logic:
  // 1. If we're in Docker, use PostgreSQL
  // 2. If DATABASE_URL explicitly indicates PostgreSQL, use it
  // 3. If DATABASE_URL explicitly indicates SQLite, use it  
  // 4. Default to SQLite for development
  
  if (isDocker || isPostgres) {
    return 'postgresql';
  } else {
    return 'sqlite';
  }
}

function setupSchema(dbType) {
  const sourceSchema = dbType === 'postgresql' ? POSTGRESQL_SCHEMA : SQLITE_SCHEMA;
  
  if (!fs.existsSync(sourceSchema)) {
    console.error(`❌ Error: Source schema file not found: ${sourceSchema}`);
    process.exit(1);
  }
  
  try {
    // Copy the appropriate schema to schema.prisma
    const schemaContent = fs.readFileSync(sourceSchema, 'utf8');
    fs.writeFileSync(ACTIVE_SCHEMA, schemaContent);
    
    console.log(`✅ Successfully configured schema for ${dbType.toUpperCase()}`);
    console.log(`📄 Active schema: ${ACTIVE_SCHEMA}`);
    console.log(`📋 Source: ${sourceSchema}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Error setting up schema: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('🔧 Master Order Database Schema Manager');
  console.log('========================================\n');
  
  // Allow manual override via command line argument
  const manualDbType = process.argv[2];
  
  if (manualDbType && !['sqlite', 'postgresql'].includes(manualDbType)) {
    console.error('❌ Invalid database type. Use: sqlite or postgresql');
    process.exit(1);
  }
  
  const dbType = manualDbType || detectEnvironment();
  
  console.log(`🎯 Target database type: ${dbType.toUpperCase()}\n`);
  
  if (setupSchema(dbType)) {
    console.log('\n🚀 Schema setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run: npx prisma generate');
    if (dbType === 'sqlite') {
      console.log('2. Run: npx prisma migrate dev (for development)');
    } else {
      console.log('2. Run: npx prisma migrate deploy (for production)');
    }
  } else {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { detectEnvironment, setupSchema };
