// Fix orphaned artwork cache entries and re-cache missing artwork
const path = require('path');
const fs = require('fs').promises;
const prisma = require('./server/prismaClient');
const artworkCache = require('./server/artworkCacheService');

async function fixOrphanedArtwork() {
  console.log('🔧 Fixing orphaned artwork cache entries...\n');
  
  try {
    // Get all items with cached artwork
    const items = await prisma.customOrderItem.findMany({
      where: {
        localArtworkPath: { not: null }
      },
      include: {
        storyContainedInBook: true
      }
    });

    console.log(`Found ${items.length} items with cached artwork references\n`);
    
    let validFiles = 0;
    let fixedEntries = 0;
    let recachedItems = 0;

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
        console.log(`✅ ${item.title} - File exists`);
      } catch (error) {
        console.log(`🔧 ${item.title} - File missing, attempting to re-cache...`);
        
        try {
          // Try to re-cache the artwork
          const result = await artworkCache.ensureArtworkCached(item);
          
          if (result.success) {
            recachedItems++;
            console.log(`   ✅ Successfully re-cached artwork`);
          } else {
            // If re-caching fails, clean up the orphaned database entry
            await prisma.customOrderItem.update({
              where: { id: item.id },
              data: {
                localArtworkPath: null,
                originalArtworkUrl: null,
                artworkLastCached: null,
                artworkMimeType: null
              }
            });
            fixedEntries++;
            console.log(`   🧹 Cleaned up orphaned database entry (${result.error || 'no artwork available'})`);
          }
        } catch (recacheError) {
          // Clean up orphaned entry if re-caching fails
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: {
              localArtworkPath: null,
              originalArtworkUrl: null,
              artworkLastCached: null,
              artworkMimeType: null
            }
          });
          fixedEntries++;
          console.log(`   🧹 Cleaned up orphaned database entry (re-cache failed: ${recacheError.message})`);
        }
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Valid files: ${validFiles}`);
    console.log(`   Re-cached items: ${recachedItems}`);
    console.log(`   Cleaned up orphaned entries: ${fixedEntries}`);
    
    if (recachedItems > 0) {
      console.log(`\n🎉 Successfully re-cached ${recachedItems} missing artwork files!`);
    }
    
    if (fixedEntries > 0) {
      console.log(`\n🧹 Cleaned up ${fixedEntries} orphaned database entries.`);
      console.log(`   These items will now show fallback artwork until manually re-cached.`);
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixOrphanedArtwork();
