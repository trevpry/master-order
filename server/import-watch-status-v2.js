const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importWatchStatus() {
  try {
    console.log('🚀 Starting watch status import...\n');
    
    // Read the export file
    const exportFile = path.join(__dirname, '..', 'history_plus_export.sql');
    if (!fs.existsSync(exportFile)) {
      throw new Error('Export file not found: ' + exportFile);
    }
    
    const exportData = fs.readFileSync(exportFile, 'utf8');
    console.log('📂 Loaded export file');
    
    // Find the start and end of user_video_watches data
    const startMarker = 'COPY public.user_video_watches';
    const endMarker = '\\.';
    
    const startIndex = exportData.indexOf(startMarker);
    if (startIndex === -1) {
      throw new Error('Could not find user_video_watches section in export');
    }
    
    const dataStart = exportData.indexOf('\n', startIndex) + 1;
    const dataEnd = exportData.indexOf(endMarker, dataStart);
    
    if (dataEnd === -1) {
      throw new Error('Could not find end of user_video_watches data');
    }
    
    const watchesData = exportData.substring(dataStart, dataEnd).trim();
    const watchesLines = watchesData.split('\n').filter(line => line.trim());
    
    console.log(`📊 Found ${watchesLines.length} watch records in export`);
    
    let watchedCount = 0;
    let unwatchedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    
    // First, let's see a sample of the data
    console.log('📋 Sample data:');
    console.log(watchesLines.slice(0, 3).map(line => line.substring(0, 100) + '...'));
    
    for (const line of watchesLines) {
      const parts = line.split('\t');
      if (parts.length < 7) {
        console.log(`❌ Invalid line format: ${line.substring(0, 50)}...`);
        continue;
      }
      
      const [id, userId, videoId, watched, watchedAt, createdAt, updatedAt] = parts;
      const isWatched = watched === 't';
      
      if (isWatched) {
        watchedCount++;
      } else {
        unwatchedCount++;
      }
      
      try {
        // Check if this video exists in our database
        const video = await prisma.video.findUnique({
          where: { id: parseInt(videoId) }
        });
        
        if (!video) {
          skippedCount++;
          continue;
        }
        
        // Check if user_video_watches record already exists
        const existingWatch = await prisma.user_video_watches.findFirst({
          where: {
            video_id: parseInt(videoId),
            user_id: 'user1' // Using our default user
          }
        });
        
        if (existingWatch) {
          // Update existing record
          await prisma.user_video_watches.update({
            where: { id: existingWatch.id },
            data: {
              watched: isWatched,
              watched_at: isWatched && watchedAt !== '\\N' ? new Date(watchedAt) : null,
              updated_at: new Date()
            }
          });
          updatedCount++;
        } else {
          // Create new record
          await prisma.user_video_watches.create({
            data: {
              user_id: 'user1',
              video_id: parseInt(videoId),
              watched: isWatched,
              watched_at: isWatched && watchedAt !== '\\N' ? new Date(watchedAt) : null,
              created_at: new Date(),
              updated_at: new Date()
            }
          });
          importedCount++;
        }
        
        if ((importedCount + updatedCount) % 100 === 0) {
          console.log(`📈 Processed ${importedCount + updatedCount} records...`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing video ${videoId}:`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total records in export: ${watchesLines.length}`);
    console.log(`   - Watched videos in export: ${watchedCount}`);
    console.log(`   - Unwatched videos in export: ${unwatchedCount}`);
    console.log(`   - New records created: ${importedCount}`);
    console.log(`   - Existing records updated: ${updatedCount}`);
    console.log(`   - Records skipped (video not found): ${skippedCount}`);
    
    // Verify final counts
    const finalWatched = await prisma.user_video_watches.count({
      where: { watched: true }
    });
    
    const finalUnwatched = await prisma.user_video_watches.count({
      where: { watched: false }
    });
    
    const totalRecords = await prisma.user_video_watches.count();
    
    console.log(`\n📈 Final database counts:`);
    console.log(`   - Total watch records: ${totalRecords}`);
    console.log(`   - Watched videos: ${finalWatched}`);
    console.log(`   - Unwatched videos: ${finalUnwatched}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importWatchStatus();