#!/usr/bin/env node

/**
 * Production Deployment Readiness Checker
 * Comprehensive validation for History Plus PostgreSQL deployment
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class ProductionReadinessChecker {
  constructor() {
    this.checks = [];
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '🔍',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    }[type];
    
    console.log(`${prefix} ${message}`);
    
    if (type === 'error') {
      this.errors.push(message);
    } else if (type === 'warning') {
      this.warnings.push(message);
    }
  }

  async checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      this.log(`${description}: ${filePath}`, 'success');
      return true;
    } else {
      this.log(`Missing ${description}: ${filePath}`, 'error');
      return false;
    }
  }

  async checkDockerConfiguration() {
    this.log('Checking Docker configuration...');
    
    // Check production docker-compose files
    await this.checkFileExists('docker-compose.external-db.yml', 'External DB Docker Compose');
    await this.checkFileExists('Dockerfile', 'Dockerfile');
    
    // Check external-db configuration
    if (fs.existsSync('docker-compose.external-db.yml')) {
      const content = fs.readFileSync('docker-compose.external-db.yml', 'utf8');
      
      if (content.includes('postgresql://')) {
        this.log('PostgreSQL connection string template found', 'success');
      } else {
        this.log('PostgreSQL connection string template missing', 'warning');
      }
      
      if (content.includes('artwork-cache')) {
        this.log('Artwork cache volume configured', 'success');
      } else {
        this.log('Artwork cache volume not configured', 'warning');
      }
    }
  }

  async checkPrismaConfiguration() {
    this.log('Checking Prisma configuration...');
    
    // Check schema files
    await this.checkFileExists('server/prisma/schema.prisma', 'Main Prisma Schema');
    await this.checkFileExists('server/prisma/schema.postgresql.prisma', 'PostgreSQL Schema');
    await this.checkFileExists('server/prisma/schema.sqlite.prisma', 'SQLite Schema');
    
    // Check schema synchronization
    if (fs.existsSync('server/prisma/schema.prisma') && 
        fs.existsSync('server/prisma/schema.postgresql.prisma')) {
      
      const mainSchema = fs.readFileSync('server/prisma/schema.prisma', 'utf8');
      const pgSchema = fs.readFileSync('server/prisma/schema.postgresql.prisma', 'utf8');
      
      // Check if schemas have same models (ignoring provider)
      const mainModels = mainSchema.match(/model \w+/g) || [];
      const pgModels = pgSchema.match(/model \w+/g) || [];
      
      if (mainModels.length === pgModels.length) {
        this.log(`Schema models synchronized (${mainModels.length} models)`, 'success');
      } else {
        this.log(`Schema model count mismatch: main=${mainModels.length}, pg=${pgModels.length}`, 'error');
      }
      
      // Check PostgreSQL provider
      if (pgSchema.includes('provider = "postgresql"')) {
        this.log('PostgreSQL provider configured correctly', 'success');
      } else {
        this.log('PostgreSQL provider not set in schema.postgresql.prisma', 'error');
      }
    }
  }

  async checkHistoryPlusSchema() {
    this.log('Checking History Plus schema tables...');
    
    const requiredTables = [
      'HistoricalEvent',
      'HistoryVideo', 
      'HistoryBook',
      'HistoryChapter',
      'HistorySection',
      'HistoryChannel',
      'user_event_reviews',
      'user_video_watches',
      'user_book_reads',
      'user_chapter_reads',
      'user_section_reads'
    ];
    
    if (fs.existsSync('server/prisma/schema.prisma')) {
      const schema = fs.readFileSync('server/prisma/schema.prisma', 'utf8');
      
      let foundTables = 0;
      for (const table of requiredTables) {
        if (schema.includes(`model ${table}`)) {
          foundTables++;
        } else {
          this.log(`Missing History Plus table: ${table}`, 'error');
        }
      }
      
      if (foundTables === requiredTables.length) {
        this.log(`All ${requiredTables.length} History Plus tables found`, 'success');
      } else {
        this.log(`Missing ${requiredTables.length - foundTables} History Plus tables`, 'error');
      }
    }
  }

  async checkEnvironmentSetup() {
    this.log('Checking environment setup...');
    
    // Check setup-schema.js exists
    await this.checkFileExists('server/setup-schema.js', 'Schema setup script');
    
    // Check for environment detection logic
    if (fs.existsSync('server/setup-schema.js')) {
      const content = fs.readFileSync('server/setup-schema.js', 'utf8');
      
      if (content.includes('DATABASE_URL') && content.includes('postgresql')) {
        this.log('PostgreSQL environment detection configured', 'success');
      } else {
        this.log('PostgreSQL environment detection missing', 'error');
      }
    }
  }

  async checkMigrationScripts() {
    this.log('Checking migration scripts...');
    
    await this.checkFileExists('migrate-history-plus-data.js', 'History Plus migration script');
    await this.checkFileExists('production-backup.sh', 'Backup script (bash)');
    await this.checkFileExists('production-backup.ps1', 'Backup script (PowerShell)');
    
    // Check migration script completeness
    if (fs.existsSync('migrate-history-plus-data.js')) {
      const content = fs.readFileSync('migrate-history-plus-data.js', 'utf8');
      
      const requiredMethods = [
        'migrateData',
        'validateMigration', 
        'createBackup',
        'analyzeSourceData'
      ];
      
      let foundMethods = 0;
      for (const method of requiredMethods) {
        if (content.includes(method)) {
          foundMethods++;
        }
      }
      
      if (foundMethods === requiredMethods.length) {
        this.log('Migration script has all required methods', 'success');
      } else {
        this.log(`Migration script missing ${requiredMethods.length - foundMethods} methods`, 'error');
      }
    }
  }

  async checkDependencies() {
    this.log('Checking Node.js dependencies...');
    
    try {
      // Check if package.json exists
      if (!fs.existsSync('package.json')) {
        this.log('package.json not found', 'error');
        return;
      }
      
      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check critical dependencies
      const criticalDeps = ['@prisma/client', 'prisma', 'express', 'react'];
      
      for (const dep of criticalDeps) {
        if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
          this.log(`Dependency found: ${dep}`, 'success');
        } else {
          this.log(`Missing critical dependency: ${dep}`, 'error');
        }
      }
      
    } catch (error) {
      this.log(`Error checking dependencies: ${error.message}`, 'error');
    }
  }

  async checkDockerCommands() {
    this.log('Checking Docker availability...');
    
    try {
      await execAsync('docker --version');
      this.log('Docker is available', 'success');
    } catch (error) {
      this.log('Docker not available or not in PATH', 'error');
    }
    
    try {
      await execAsync('docker-compose --version');
      this.log('Docker Compose is available', 'success');
    } catch (error) {
      this.log('Docker Compose not available or not in PATH', 'error');
    }
  }

  async checkPostgreSQLTools() {
    this.log('Checking PostgreSQL client tools...');
    
    try {
      await execAsync('pg_dump --version');
      this.log('pg_dump is available', 'success');
    } catch (error) {
      this.log('pg_dump not available - needed for backups', 'warning');
    }
    
    try {
      await execAsync('psql --version');
      this.log('psql is available', 'success');  
    } catch (error) {
      this.log('psql not available - needed for restoration', 'warning');
    }
  }

  async checkModularizationUpdates() {
    this.log('Checking recent modularization updates...');
    
    // Check if response utilities exist
    await this.checkFileExists('server/utils/responses.js', 'Response utilities');
    await this.checkFileExists('server/middleware/validation.js', 'Validation middleware');
    
    // Check if History Plus routes are modularized
    if (fs.existsSync('server/routes/historyPlus.js')) {
      const content = fs.readFileSync('server/routes/historyPlus.js', 'utf8');
      
      if (content.includes('asyncHandler') && content.includes('sendSuccess')) {
        this.log('History Plus routes use modern utilities', 'success');
      } else {
        this.log('History Plus routes not fully modernized', 'warning');
      }
    } else {
      this.log('History Plus routes file missing', 'error');
    }
  }

  generateDeploymentChecklist() {
    const checklist = `
# 🚀 PRODUCTION DEPLOYMENT CHECKLIST

## Pre-Deployment Requirements
${this.errors.length === 0 ? '✅' : '❌'} All critical checks passed
${this.warnings.length === 0 ? '✅' : '⚠️'} No warnings (${this.warnings.length} warnings)

## Manual Steps Required

### 1. Environment Setup
- [ ] Set DATABASE_URL environment variable with PostgreSQL connection string
- [ ] Set EXTERNAL_IP for Android API responses  
- [ ] Configure Plex/Stash/API credentials in environment

### 2. Database Preparation
- [ ] Ensure PostgreSQL database is accessible
- [ ] Run backup script: \`./production-backup.sh\` or \`./production-backup.ps1\`
- [ ] Verify backup integrity

### 3. Data Migration
- [ ] Run History Plus migration: \`DATABASE_URL="postgresql://..." node migrate-history-plus-data.js\`
- [ ] Verify migration success
- [ ] Test data integrity

### 4. Docker Deployment  
- [ ] Build image: \`docker build -t master-order:latest .\`
- [ ] Deploy: \`docker-compose -f docker-compose.external-db.yml up -d\`
- [ ] Monitor logs: \`docker logs master-order\`

### 5. Post-Deployment Validation
- [ ] Verify web interface loads
- [ ] Test History Plus functionality
- [ ] Test Android API endpoints
- [ ] Verify Up Next with History Plus content
- [ ] Test completion workflows

### 6. Rollback Plan (if needed)
- [ ] Stop containers: \`docker-compose down\`
- [ ] Run rollback script: \`./backups/rollback_[timestamp].sh\`
- [ ] Verify restoration

## Issues Found
${this.errors.length > 0 ? this.errors.map(e => `❌ ${e}`).join('\n') : '✅ No critical issues'}

## Warnings
${this.warnings.length > 0 ? this.warnings.map(w => `⚠️ ${w}`).join('\n') : '✅ No warnings'}

---
Generated: ${new Date().toISOString()}
`;

    fs.writeFileSync('PRODUCTION_DEPLOYMENT_CHECKLIST.md', checklist);
    this.log('Deployment checklist saved to: PRODUCTION_DEPLOYMENT_CHECKLIST.md', 'success');
  }

  async runAllChecks() {
    this.log('🔍 Starting production readiness validation...');
    
    await this.checkDockerConfiguration();
    await this.checkPrismaConfiguration();
    await this.checkHistoryPlusSchema();
    await this.checkEnvironmentSetup();
    await this.checkMigrationScripts();
    await this.checkDependencies();
    await this.checkDockerCommands();
    await this.checkPostgreSQLTools();
    await this.checkModularizationUpdates();
    
    this.log('📋 Generating deployment checklist...', 'info');
    this.generateDeploymentChecklist();
    
    // Summary
    console.log('\n' + '='.repeat(60));
    if (this.errors.length === 0) {
      this.log('🎉 PRODUCTION READY! No critical issues found.', 'success');
    } else {
      this.log(`💥 ${this.errors.length} critical issues must be resolved before deployment.`, 'error');
    }
    
    if (this.warnings.length > 0) {
      this.log(`⚠️  ${this.warnings.length} warnings should be reviewed.`, 'warning');
    }
    
    console.log('='.repeat(60));
    
    return this.errors.length === 0;
  }
}

// Execute if run directly
if (require.main === module) {
  const checker = new ProductionReadinessChecker();
  checker.runAllChecks().then(ready => {
    process.exit(ready ? 0 : 1);
  }).catch(error => {
    console.error('💥 Readiness check failed:', error.message);
    process.exit(1);
  });
}

module.exports = ProductionReadinessChecker;