const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function importWatchStatusByUrl() {
  try {
    console.log('🚀 Starting watch status import by URL matching...\n');
    
    // Read the export file
    const exportFile = path.join(__dirname, '..', 'history_plus_export.sql');
    if (!fs.existsSync(exportFile)) {
      throw new Error('Export file not found: ' + exportFile);
    }
    
    const exportData = fs.readFileSync(exportFile, 'utf8');
    console.log('📂 Loaded export file');
    
    // First, extract video data to map IDs to URLs
    const videosStartMarker = 'COPY public."Video"';
    const videosStartIndex = exportData.indexOf(videosStartMarker);
    if (videosStartIndex === -1) {
      throw new Error('Could not find Video table data in export');
    }
    
    const videosDataStart = exportData.indexOf('\n', videosStartIndex) + 1;
    const videosDataEnd = exportData.indexOf('\\.', videosDataStart);
    const videosData = exportData.substring(videosDataStart, videosDataEnd).trim();
    const videosLines = videosData.split('\n').filter(line => line.trim());
    
    console.log(`📹 Found ${videosLines.length} videos in export`);
    
    // Create a map of video ID to URL from the export
    const videoIdToUrl = new Map();
    for (const line of videosLines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const [id, title, url] = parts;
        if (url && url !== '\\N') {
          videoIdToUrl.set(id, url);
        }
      }
    }
    
    console.log(`📹 Mapped ${videoIdToUrl.size} video IDs to URLs`);
    
    // Now extract user_video_watches data
    const watchesStartMarker = 'COPY public.user_video_watches';
    const watchesStartIndex = exportData.indexOf(watchesStartMarker);
    if (watchesStartIndex === -1) {
      throw new Error('Could not find user_video_watches data in export');
    }
    
    const watchesDataStart = exportData.indexOf('\n', watchesStartIndex) + 1;
    const watchesDataEnd = exportData.indexOf('\\.', watchesDataStart);
    const watchesData = exportData.substring(watchesDataStart, watchesDataEnd).trim();
    const watchesLines = watchesData.split('\n').filter(line => line.trim());
    
    console.log(`📊 Found ${watchesLines.length} watch records in export`);
    
    let watchedCount = 0;
    let unwatchedCount = 0;
    let importedCount = 0;
    let skippedCount = 0;
    let updatedCount = 0;
    let urlMatchCount = 0;
    
    for (const line of watchesLines) {
      const parts = line.split('\t');
      if (parts.length < 7) continue;
      
      const [id, userId, videoId, watched, watchedAt, createdAt, updatedAt] = parts;
      const isWatched = watched === 't';
      
      if (isWatched) {
        watchedCount++;
      } else {
        unwatchedCount++;
      }
      
      // Get the URL for this video from our map
      const videoUrl = videoIdToUrl.get(videoId);
      if (!videoUrl) {
        skippedCount++;
        continue;
      }
      
      try {
        // Find the video in Eddie database by URL
        const video = await prisma.video.findFirst({
          where: { url: videoUrl }
        });
        
        if (!video) {
          skippedCount++;
          continue;
        }
        
        urlMatchCount++;
        
        // Check if user_video_watches record already exists
        const existingWatch = await prisma.user_video_watches.findFirst({
          where: {
            video_id: video.id,
            user_id: 'user1'
          }
        });
        
        if (existingWatch) {
          // Update existing record only if it's different
          if (existingWatch.watched !== isWatched) {
            await prisma.user_video_watches.update({
              where: { id: existingWatch.id },
              data: {
                watched: isWatched,
                watched_at: isWatched && watchedAt !== '\\N' ? new Date(watchedAt) : null,
                updated_at: new Date()
              }
            });
            updatedCount++;
          }
        } else {
          // Create new record
          await prisma.user_video_watches.create({
            data: {
              user_id: 'user1',
              video_id: video.id,
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
        console.error(`❌ Error processing video ${videoId} (${videoUrl}):`, error.message);
        skippedCount++;
      }
    }
    
    console.log('\n✅ Import completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Total records in export: ${watchesLines.length}`);
    console.log(`   - Watched videos in export: ${watchedCount}`);
    console.log(`   - Unwatched videos in export: ${unwatchedCount}`);
    console.log(`   - Videos matched by URL: ${urlMatchCount}`);
    console.log(`   - New records created: ${importedCount}`);
    console.log(`   - Existing records updated: ${updatedCount}`);
    console.log(`   - Records skipped (no URL match): ${skippedCount}`);
    
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
    
    if (finalWatched >= 311) {
      console.log('🎉 SUCCESS: We now have the target 311+ watched videos!');
    } else {
      console.log(`⚠️  Still missing ${311 - finalWatched} watched videos from target of 311`);
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importWatchStatusByUrl();