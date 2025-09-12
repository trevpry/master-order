/**
 * Watch Status Import Service
 * Handles import of watch statuses from original PostgreSQL export
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

class WatchStatusImportService {
  constructor() {
    this.prisma = new PrismaClient({
      log: ['error'],
    });
  }

  /**
   * Check current watch status statistics
   */
  async getWatchStatusStats() {
    try {
      const totalVideos = await this.prisma.historyVideo.count();
      const watchedVideos = await this.prisma.user_video_watches.count({
        where: { watched: true }
      });
      
      return {
        totalVideos,
        watchedVideos,
        unwatchedVideos: totalVideos - watchedVideos
      };
    } catch (error) {
      console.error('❌ Error getting watch status stats:', error.message);
      throw error;
    }
  }

  /**
   * Get sample video URLs for debugging
   */
  async getSampleVideoUrls(limit = 10) {
    try {
      const videos = await this.prisma.historyVideo.findMany({
        take: limit,
        select: {
          id: true,
          title: true,
          url: true,
          user_video_watches: {
            select: {
              watched: true
            }
          }
        }
      });

      return videos.map(video => ({
        id: video.id,
        title: video.title,
        url: video.url,
        watched: video.user_video_watches?.watched || false
      }));
    } catch (error) {
      console.error('❌ Error getting sample video URLs:', error.message);
      throw error;
    }
  }

  /**
   * Import watch statuses from PostgreSQL export file
   */
  async importFromPostgreSQLExport(exportFilePath) {
    try {
      if (!fs.existsSync(exportFilePath)) {
        throw new Error(`Export file not found: ${exportFilePath}`);
      }

      console.log('📖 Reading PostgreSQL export file...');
      const exportData = fs.readFileSync(exportFilePath, 'utf8');
      
      // Parse the export to extract watched video URLs
      const watchedUrls = this.parseWatchedUrlsFromExport(exportData);
      
      console.log(`🔍 Found ${watchedUrls.length} watched video URLs in export`);
      
      // Import the watch statuses
      const importResult = await this.importWatchStatuses(watchedUrls);
      
      return importResult;
    } catch (error) {
      console.error('❌ Error importing from PostgreSQL export:', error.message);
      throw error;
    }
  }

  /**
   * Parse watched video URLs from PostgreSQL export
   */
  parseWatchedUrlsFromExport(exportData) {
    const watchedUrls = [];
    const lines = exportData.split('\n');
    
    let inVideoSection = false;
    let inWatchesSection = false;
    let videoDataMap = new Map(); // videoId -> {id, url}
    let watchedVideoIds = new Set();
    
    console.log('🔍 Parsing PostgreSQL COPY format...');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Start of Video table data
      if (line.includes('COPY public."Video"') && line.includes('FROM stdin')) {
        inVideoSection = true;
        console.log('📹 Found Video table data section');
        continue;
      }
      
      // Start of user_video_watches table data
      if (line.includes('COPY public.user_video_watches') && line.includes('FROM stdin')) {
        inWatchesSection = true;
        console.log('👁️ Found user_video_watches table data section');
        continue;
      }
      
      // End of data sections
      if (line === '\\.' || line === '.') {
        if (inVideoSection) {
          console.log(`📹 Parsed ${videoDataMap.size} video records`);
          inVideoSection = false;
        }
        if (inWatchesSection) {
          console.log(`👁️ Parsed ${watchedVideoIds.size} watch records`);
          inWatchesSection = false;
        }
        continue;
      }
      
      // Parse Video table data
      if (inVideoSection && line.length > 0) {
        try {
          // Split by tabs - PostgreSQL COPY format uses tabs
          const columns = line.split('\t');
          if (columns.length >= 3) {
            const videoId = columns[0]; // id column
            const title = columns[1];   // title column  
            const url = columns[2];     // url column
            
            if (url && (url.includes('youtube.com') || url.includes('thegreatcoursesplus.com'))) {
              videoDataMap.set(videoId, { id: videoId, title, url });
            }
          }
        } catch (error) {
          // Skip malformed lines
        }
      }
      
      // Parse user_video_watches table data
      if (inWatchesSection && line.length > 0) {
        try {
          // Split by tabs
          const columns = line.split('\t');
          if (columns.length >= 4) {
            const videoId = columns[2]; // videoId column
            const watched = columns[3]; // watched column
            
            if (watched === 't' || watched === 'true') {
              watchedVideoIds.add(videoId);
            }
          }
        } catch (error) {
          // Skip malformed lines
        }
      }
    }
    
    // Now correlate watched video IDs with URLs
    console.log('🔗 Correlating watched videos with URLs...');
    for (const videoId of watchedVideoIds) {
      if (videoDataMap.has(videoId)) {
        const videoData = videoDataMap.get(videoId);
        watchedUrls.push(videoData.url);
      }
    }
    
    console.log(`✅ Found ${watchedUrls.length} watched video URLs`);
    return [...new Set(watchedUrls)]; // Remove duplicates
  }

  /**
   * Import watch statuses by matching URLs
   */
  async importWatchStatuses(watchedUrls) {
    let matched = 0;
    let created = 0;
    let updated = 0;
    let notFound = 0;

    console.log(`🚀 Starting import of ${watchedUrls.length} watched URLs...`);

    for (const url of watchedUrls) {
      try {
        // Find video by URL in Eddie database
        const video = await this.prisma.historyVideo.findFirst({
          where: { url },
          include: {
            user_video_watches: true
          }
        });

        if (video) {
          matched++;
          
          if (video.user_video_watches) {
            // Update existing watch record
            if (!video.user_video_watches.watched) {
              await this.prisma.user_video_watches.update({
                where: { videoId: video.id },
                data: { watched: true }
              });
              updated++;
              console.log(`✅ Updated: ${video.title}`);
            }
          } else {
            // Create new watch record
            await this.prisma.user_video_watches.create({
              data: {
                videoId: video.id,
                watched: true
              }
            });
            created++;
            console.log(`➕ Created: ${video.title}`);
          }
        } else {
          notFound++;
          console.log(`❓ Video not found for URL: ${url}`);
        }
      } catch (error) {
        console.error(`❌ Error processing URL ${url}:`, error.message);
      }
    }

    return {
      totalUrls: watchedUrls.length,
      matched,
      created,
      updated,
      notFound
    };
  }

  /**
   * Cleanup - disconnect from database
   */
  async disconnect() {
    await this.prisma.$disconnect();
  }
}

module.exports = WatchStatusImportService;