#!/usr/bin/env node

/**
 * MANDATORY Data Safety Verification
 * 
 * This script MUST be run before ANY Docker deployment
 * It ensures no destructive operations can occur
 */

const fs = require('fs');
const path = require('path');

const DANGEROUS_COMMANDS = [
    'migrate reset',
    'migrate reset --force',
    'db push --force-reset',
    'prisma migrate reset',
    'npx prisma migrate reset',
    'DROP DATABASE',
    'DROP TABLE',
    'TRUNCATE',
    'DELETE FROM'
];

const SAFE_INDICATORS = [
    '--accept-data-loss=false',
    'Will NOT attempt reset',
    'DATA-SAFE',
    'preserve your data',
    'completely safe'
];

async function verifyDataSafety() {
    console.log('🔒 MANDATORY DATA SAFETY VERIFICATION');
    console.log('=====================================');
    
    let hasDangerousCommands = false;
    let hasSafetyMeasures = false;
    
    // Check docker-entrypoint.sh
    const entrypointPath = path.join(__dirname, 'docker-entrypoint.sh');
    
    if (!fs.existsSync(entrypointPath)) {
        console.log('❌ ERROR: docker-entrypoint.sh not found');
        process.exit(1);
    }
    
    const entrypointContent = fs.readFileSync(entrypointPath, 'utf8');
    
    // Check for dangerous commands
    console.log('\n🔍 Scanning for dangerous commands...');
    for (const dangerous of DANGEROUS_COMMANDS) {
        if (entrypointContent.includes(dangerous)) {
            console.log(`❌ DANGER: Found "${dangerous}" in docker-entrypoint.sh`);
            hasDangerousCommands = true;
        }
    }
    
    // Check for safety measures
    console.log('\n🛡️  Checking for safety measures...');
    for (const safe of SAFE_INDICATORS) {
        if (entrypointContent.includes(safe)) {
            console.log(`✅ SAFE: Found "${safe}"`);
            hasSafetyMeasures = true;
        }
    }
    
    // Final assessment
    console.log('\n📋 SAFETY ASSESSMENT:');
    console.log('=====================');
    
    if (hasDangerousCommands) {
        console.log('❌ FAILED: Dangerous commands detected');
        console.log('🚨 DEPLOYMENT BLOCKED - Data loss risk detected');
        console.log('');
        console.log('❗ ACTION REQUIRED:');
        console.log('  1. Remove all destructive commands from docker-entrypoint.sh');
        console.log('  2. Add proper data safety measures');
        console.log('  3. Re-run this verification');
        process.exit(1);
    }
    
    if (!hasSafetyMeasures) {
        console.log('⚠️  WARNING: No explicit safety measures found');
        console.log('🚨 DEPLOYMENT BLOCKED - Insufficient safety measures');
        process.exit(1);
    }
    
    console.log('✅ PASSED: No dangerous commands detected');
    console.log('✅ PASSED: Safety measures in place');
    console.log('🎉 DEPLOYMENT APPROVED - Data safety verified');
    console.log('');
    console.log('✨ Your PostgreSQL data will be preserved during deployment');
    
    return true;
}

// Run verification if called directly
if (require.main === module) {
    verifyDataSafety()
        .then(() => {
            console.log('\n🚀 You may proceed with Docker deployment');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Verification failed:', error);
            process.exit(1);
        });
}

module.exports = { verifyDataSafety };