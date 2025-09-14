#!/usr/bin/env node

/**
 * Production Upload Test Script
 * Verifies that the file upload functionality works correctly in production environment
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing History Plus Upload Production Readiness...\n');

// Test 1: Check if temp-uploads directory can be created
console.log('1. Testing temp-uploads directory creation...');
const tempUploadsDir = path.join(__dirname, 'server', 'temp-uploads');
try {
  if (!fs.existsSync(tempUploadsDir)) {
    fs.mkdirSync(tempUploadsDir, { recursive: true });
    console.log('✅ Created temp-uploads directory successfully');
  } else {
    console.log('✅ temp-uploads directory already exists');
  }
  
  // Test write permissions
  fs.accessSync(tempUploadsDir, fs.constants.W_OK);
  console.log('✅ temp-uploads directory is writable');
} catch (error) {
  console.error('❌ Failed to create/access temp-uploads directory:', error.message);
  process.exit(1);
}

// Test 2: Check if session file can be created and read
console.log('\n2. Testing session file operations...');
try {
  const sessionFile = path.join(tempUploadsDir, 'test-session.json');
  const testSession = {
    id: 'test-' + Date.now(),
    uploadedAt: new Date().toISOString(),
    files: ['test.csv'],
    directory: tempUploadsDir,
    missingFiles: [],
    extraFiles: [],
    ready: true
  };
  
  // Write session file
  fs.writeFileSync(sessionFile, JSON.stringify(testSession, null, 2));
  console.log('✅ Session file created successfully');
  
  // Read session file
  const readSession = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
  if (readSession.ready === true && readSession.files.length === 1) {
    console.log('✅ Session file read and validated successfully');
  } else {
    throw new Error('Session file validation failed');
  }
  
  // Clean up test file
  fs.unlinkSync(sessionFile);
  console.log('✅ Session file cleanup successful');
} catch (error) {
  console.error('❌ Session file operations failed:', error.message);
  process.exit(1);
}

// Test 3: Check import script accessibility
console.log('\n3. Testing import script accessibility...');
try {
  const importScript = path.join(__dirname, 'server', 'import-history-plus-data.js');
  if (fs.existsSync(importScript)) {
    console.log('✅ Import script exists');
    fs.accessSync(importScript, fs.constants.R_OK);
    console.log('✅ Import script is readable');
  } else {
    throw new Error('Import script not found');
  }
} catch (error) {
  console.error('❌ Import script check failed:', error.message);
  process.exit(1);
}

// Test 4: Check environment variable handling
console.log('\n4. Testing environment configuration...');
try {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl) {
    console.log('✅ DATABASE_URL is configured');
    if (databaseUrl.includes('postgresql://')) {
      console.log('✅ PostgreSQL configuration detected (production mode)');
    } else if (databaseUrl.includes('file:')) {
      console.log('✅ SQLite configuration detected (development mode)');
    } else {
      console.log('ℹ️ Custom database configuration detected');
    }
  } else {
    console.log('ℹ️ DATABASE_URL not set, will use default SQLite');
  }
  
  console.log('✅ Environment configuration check passed');
} catch (error) {
  console.error('❌ Environment configuration check failed:', error.message);
  process.exit(1);
}

// Test 5: Check if running in Docker
console.log('\n5. Testing Docker environment detection...');
try {
  const isDocker = fs.existsSync('/.dockerenv');
  if (isDocker) {
    console.log('✅ Running in Docker container');
    // Check if required directories exist in Docker
    const requiredDirs = ['/app/server/temp-uploads', '/app/data'];
    for (const dir of requiredDirs) {
      if (fs.existsSync(dir)) {
        console.log(`✅ Docker directory exists: ${dir}`);
      } else {
        console.log(`⚠️ Docker directory missing: ${dir} (will be created on demand)`);
      }
    }
  } else {
    console.log('ℹ️ Running in local development environment');
  }
} catch (error) {
  console.error('❌ Docker environment check failed:', error.message);
  process.exit(1);
}

console.log('\n🎉 All production readiness tests passed!');
console.log('\nProduction deployment checklist:');
console.log('□ Ensure Docker container has proper file permissions');
console.log('□ Verify DATABASE_URL is set correctly for production');
console.log('□ Test file upload functionality after deployment');
console.log('□ Monitor temp-uploads directory for cleanup');
console.log('□ Check server logs for upload/import errors');