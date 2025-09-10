const fs = require('fs');
const path = require('path');

// Files to fix database connection issues
const filesToFix = [
  'server/routes/tvdb.js',
  'server/routes/playlists.js', 
  'server/routes/music.js',
  'server/routes/customOrderItems.js',
  'server/routes/watchTracking.js',
  'server/routes/backgrounds.js',
  'server/routes/backgroundGalleries.js',
  'server/routes/stash/images.js',
  'server/routes/stash/scenes.js',
  'server/routes/stash/clips.js',
  'server/routes/stash/sync.js',
  'server/routes/stash/stats.js',
  'server/routes/stash/browse.js',
  'server/routes/stash/special.js'
];

async function fixDatabaseConnections() {
  console.log('🔧 Fixing database connection duplications...\n');
  
  let fixedCount = 0;
  
  for (const filePath of filesToFix) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      
      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️ Skipping ${filePath} - file not found`);
        continue;
      }
      
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if it needs fixing
      if (content.includes('new PrismaClient()') && !content.includes("require('../prismaClient')")) {
        console.log(`🔧 Fixing ${filePath}...`);
        
        // Replace the PrismaClient import and instantiation
        content = content.replace(
          /const \{ PrismaClient \} = require\('@prisma\/client'\);\s*\n\s*const prisma = new PrismaClient\(\);/g,
          "const prisma = require('../prismaClient'); // Use shared singleton instance"
        );
        
        // Handle different patterns
        content = content.replace(
          /const prisma = new PrismaClient\(\);/g,
          "const prisma = require('../prismaClient'); // Use shared singleton instance"
        );
        
        // Remove standalone PrismaClient import if prisma variable is defined elsewhere
        content = content.replace(
          /const \{ PrismaClient \} = require\('@prisma\/client'\);\s*\n/g,
          ''
        );
        
        fs.writeFileSync(fullPath, content);
        fixedCount++;
        console.log(`✅ Fixed ${filePath}`);
      } else {
        console.log(`✨ ${filePath} already uses shared client or doesn't need fixing`);
      }
      
    } catch (error) {
      console.error(`❌ Error fixing ${filePath}:`, error.message);
    }
  }
  
  console.log(`\n🎉 Fixed ${fixedCount} files with database connection issues!`);
}

fixDatabaseConnections();
