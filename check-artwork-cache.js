// Check for orphaned artwork cache entries
const path = require('path');
const fs = require('fs').promises;
const prisma = require('./server/prismaClient');

async function checkArtworkCache() {
  console.log('🔍 Checking artwork cache consistency...\n');
  
  try {
    // Get all items with cached artwork
    const items = await prisma.customOrderItem.findMany({
      where: {
        localArtworkPath: { not: null }
      },
      select: {
        id: true,
        title: true,
        mediaType: true,
        localArtworkPath: true,
        artworkLastCached: true
      }
    });

    console.log(`Found ${items.length} items with cached artwork references\n`);
    
    let validFiles = 0;
    let missingFiles = 0;
    let orphanedEntries = [];

    for (const item of items) {
      // Extract filename from path
      const filename = item.localArtworkPath.includes('\\') || item.localArtworkPath.includes('/') 
        ? item.localArtworkPath.split(/[\\\/]/).pop() 
        : item.localArtworkPath;
      
      // Check if file exists in artwork cache
      const cacheDir = path.join(__dirname, 'server', 'artwork-cache');
      const filePath = path.join(cacheDir, filename);
      
      try {
        await fs.access(filePath);
        validFiles++;
        console.log(`✅ ${item.title} - ${filename}`);
      } catch (error) {
        missingFiles++;
        orphanedEntries.push({
          id: item.id,
          title: item.title,
          filename: filename,
          dbPath: item.localArtworkPath,
          expectedPath: filePath
        });
        console.log(`❌ ${item.title} - ${filename} (MISSING)`);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Valid files: ${validFiles}`);
    console.log(`   Missing files: ${missingFiles}`);
    
    if (orphanedEntries.length > 0) {
      console.log(`\n🧹 Found ${orphanedEntries.length} orphaned database entries:`);
      orphanedEntries.forEach(entry => {
        console.log(`   - ID ${entry.id}: ${entry.title}`);
        console.log(`     DB Path: ${entry.dbPath}`);
        console.log(`     Expected: ${entry.expectedPath}`);
      });
      
      console.log(`\n💡 These entries will cause broken thumbnails in Docker.`);
      console.log(`   Consider running the fix to clean up orphaned entries.`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkArtworkCache();
