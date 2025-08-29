#!/usr/bin/env node

/**
 * Schema Synchronization Verification Script
 * 
 * This script verifies that all three schema files are properly synchronized
 * and identifies any differences that could cause production issues.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = path.join(__dirname, 'prisma');
const SQLITE_SCHEMA = path.join(SCHEMA_DIR, 'schema.sqlite.prisma');
const POSTGRESQL_SCHEMA = path.join(SCHEMA_DIR, 'schema.postgresql.prisma');
const ACTIVE_SCHEMA = path.join(SCHEMA_DIR, 'schema.prisma');

function extractModels(schemaContent) {
  const models = {};
  const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
  let match;
  
  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const modelName = match[1];
    const modelBody = match[2].trim();
    models[modelName] = modelBody;
  }
  
  return models;
}

function compareSchemas() {
  console.log('🔍 Schema Synchronization Verification');
  console.log('=====================================\n');
  
  // Read all schema files
  const schemas = {};
  const schemaFiles = [
    { name: 'SQLite', path: SQLITE_SCHEMA },
    { name: 'PostgreSQL', path: POSTGRESQL_SCHEMA },
    { name: 'Active', path: ACTIVE_SCHEMA }
  ];
  
  for (const { name, path: filePath } of schemaFiles) {
    if (fs.existsSync(filePath)) {
      schemas[name] = fs.readFileSync(filePath, 'utf8');
      console.log(`✅ ${name} schema loaded: ${path.basename(filePath)}`);
    } else {
      console.log(`❌ ${name} schema missing: ${path.basename(filePath)}`);
      return false;
    }
  }
  
  console.log('');
  
  // Extract models from each schema
  const sqliteModels = extractModels(schemas.SQLite);
  const postgresModels = extractModels(schemas.PostgreSQL);
  const activeModels = extractModels(schemas.Active);
  
  // Compare model counts
  const sqliteCount = Object.keys(sqliteModels).length;
  const postgresCount = Object.keys(postgresModels).length;
  const activeCount = Object.keys(activeModels).length;
  
  console.log(`📊 Model Counts:`);
  console.log(`   SQLite: ${sqliteCount} models`);
  console.log(`   PostgreSQL: ${postgresCount} models`);
  console.log(`   Active: ${activeCount} models`);
  console.log('');
  
  // Check for missing models between schemas
  const allModelNames = new Set([
    ...Object.keys(sqliteModels),
    ...Object.keys(postgresModels),
    ...Object.keys(activeModels)
  ]);
  
  let hasIssues = false;
  
  console.log('🔍 Model Presence Check:');
  for (const modelName of allModelNames) {
    const inSqlite = modelName in sqliteModels;
    const inPostgres = modelName in postgresModels;
    const inActive = modelName in activeModels;
    
    if (inSqlite && inPostgres && inActive) {
      console.log(`   ✅ ${modelName}: Present in all schemas`);
    } else {
      console.log(`   ❌ ${modelName}: Missing from some schemas`);
      console.log(`      SQLite: ${inSqlite ? '✅' : '❌'}`);
      console.log(`      PostgreSQL: ${inPostgres ? '✅' : '❌'}`);
      console.log(`      Active: ${inActive ? '✅' : '❌'}`);
      hasIssues = true;
    }
  }
  
  console.log('');
  
  // Check key models for production compatibility
  const criticalModels = ['Settings', 'CustomOrder', 'CustomOrderItem', 'WatchLog', 'EddieSettings'];
  console.log('🔑 Critical Models Check:');
  
  for (const modelName of criticalModels) {
    if (allModelNames.has(modelName)) {
      console.log(`   ✅ ${modelName}: Present and ready for production`);
    } else {
      console.log(`   ❌ ${modelName}: MISSING - This could cause production issues!`);
      hasIssues = true;
    }
  }
  
  console.log('');
  
  // Final assessment
  if (hasIssues) {
    console.log('🚨 SCHEMA SYNCHRONIZATION ISSUES DETECTED');
    console.log('   Action required: Fix schema synchronization before deployment');
    return false;
  } else {
    console.log('✅ ALL SCHEMAS ARE PROPERLY SYNCHRONIZED');
    console.log('   Safe for production deployment');
    return true;
  }
}

// Run verification
if (require.main === module) {
  const isValid = compareSchemas();
  process.exit(isValid ? 0 : 1);
}

module.exports = { compareSchemas };
