require('dotenv').config({ path: '../.env.import' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function exportWatchData() {
  try {
    console.log('🚀 Connecting to PostgreSQL database...\n');
    
    const dbUrl = process.env.IMPORT_DATABASE_URL;
    if (!dbUrl) {
      throw new Error('IMPORT_DATABASE_URL not found in .env.import file');
    }
    
    console.log('📂 Connected to:', dbUrl.replace(/:[^:@]*@/, ':***@'));
    
    const client = new Client({
      connectionString: dbUrl,
      ssl: {
        rejectUnauthorized: false
      }
    });
    
    await client.connect();
    console.log('✅ Database connected successfully!');
    
    // Get all user video watches
    console.log('📊 Fetching user video watches...');
    const watchesResult = await client.query(`
      SELECT 
        uvw.*,
        v.title as video_title,
        v.url as video_url
      FROM user_video_watches uvw
      LEFT JOIN videos v ON uvw.video_id = v.id
      WHERE uvw.watched = true
      ORDER BY uvw.video_id
    `);
    
    console.log(`📺 Found ${watchesResult.rows.length} watched videos`);
    
    // Get all videos for reference
    console.log('📋 Fetching all videos for reference...');
    const videosResult = await client.query(`
      SELECT id, title, url, event_id
      FROM videos
      ORDER BY id
    `);
    
    console.log(`🎬 Found ${videosResult.rows.length} total videos`);
    
    // Create export data
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalVideos: videosResult.rows.length,
        watchedVideos: watchesResult.rows.length,
        unwatchedVideos: videosResult.rows.length - watchesResult.rows.length
      },
      userVideoWatches: watchesResult.rows,
      allVideos: videosResult.rows
    };
    
    // Write to JSON file
    const exportFile = path.join(__dirname, '..', 'history_plus_watch_data.json');
    fs.writeFileSync(exportFile, JSON.stringify(exportData, null, 2));
    
    console.log('\n✅ Export completed successfully!');
    console.log(`📁 Data saved to: ${exportFile}`);
    console.log(`📊 Summary:`);
    console.log(`   - Total videos: ${exportData.summary.totalVideos}`);
    console.log(`   - Watched videos: ${exportData.summary.watchedVideos}`);
    console.log(`   - Unwatched videos: ${exportData.summary.unwatchedVideos}`);
    
    await client.end();
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    process.exit(1);
  }
}

// Run the export
exportWatchData();