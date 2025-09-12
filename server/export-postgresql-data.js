require('dotenv').config({ path: '.env.import' });
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function exportPostgreSQLData() {
  try {
    console.log('🚀 Exporting PostgreSQL data from hosted database...\n');
    
    const dbUrl = process.env.IMPORT_DATABASE_URL;
    if (!dbUrl) {
      throw new Error('IMPORT_DATABASE_URL not found in .env.import file');
    }
    
    console.log('📂 Connected to:', dbUrl.replace(/:[^:@]*@/, ':***@'));
    
    const exportFile = path.join(__dirname, '..', 'history_plus_export.sql');
    console.log('📤 Exporting to:', exportFile);
    
    // Use pg_dump to export the database
    const command = `pg_dump "${dbUrl}" --no-owner --no-privileges --data-only --inserts > "${exportFile}"`;
    
    console.log('⏳ Running pg_dump...');
    execSync(command, { 
      stdio: ['inherit', 'inherit', 'inherit'],
      maxBuffer: 1024 * 1024 * 50 // 50MB buffer
    });
    
    // Check if the file was created and get its size
    if (fs.existsSync(exportFile)) {
      const stats = fs.statSync(exportFile);
      console.log(`✅ Export completed! File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      console.log(`📁 Export saved to: ${exportFile}`);
    } else {
      throw new Error('Export file was not created');
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    process.exit(1);
  }
}

// Run the export
exportPostgreSQLData();