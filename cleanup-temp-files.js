const fs = require('fs');
const path = require('path');

// Clean up temporary files and test files that may impact performance
const filesToCleanup = [
  'test-bennett-fix.js',
  'test-db-simple.js', 
  'fix-database-connections.js'
];

async function cleanupTempFiles() {
  console.log('🧹 Cleaning up temporary files...\n');
  
  let cleanedCount = 0;
  
  for (const file of filesToCleanup) {
    try {
      const fullPath = path.join(process.cwd(), file);
      
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`✅ Removed ${file}`);
        cleanedCount++;
      } else {
        console.log(`ℹ️  ${file} not found (already clean)`);
      }
    } catch (error) {
      console.error(`❌ Error removing ${file}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Cleanup completed! Removed ${cleanedCount} temporary files.`);
}

cleanupTempFiles();
