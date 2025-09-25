const puppeteer = require('puppeteer');
const { PrismaClient } = require('@prisma/client');

class VideoScraperService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Extract YouTube channel ID from various URL formats
   */
  extractChannelId(url) {
    if (!url) return null;
    
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /youtu\.be\/channel\/([a-zA-Z0-9_-]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Get video metadata using basic fetch (fallback if YouTube API is not available)
   */
  async getVideoMetadata(videoUrl) {
    try {
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch video page: ${response.status}`);
        return null;
      }

      const html = await response.text();
      
      // Extract basic metadata from HTML
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : null;

      const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/);
      const description = descriptionMatch ? descriptionMatch[1] : '';

      return {
        title,
        description,
        duration: '',
        thumbnailUrl: '',
        channelName: '',
        channelUrl: ''
      };
    } catch (error) {
      console.error('Error getting video metadata:', error);
      return null;
    }
  }

  /**
   * Scrape all videos from a YouTube channel using production-optimized Puppeteer
   */
  async scrapeChannelVideos(channelUrl, channelId = null, progressCallback = null) {
    let browser = null;
    let page = null;
    
    try {
      if (!channelUrl) {
        throw new Error('Channel URL is required');
      }

      // Validate YouTube channel URL
      if (!channelUrl.includes('youtube.com')) {
        throw new Error('Please provide a valid YouTube channel URL');
      }

      console.log(`Starting to scrape videos from channel: ${channelUrl}`);
      
      if (progressCallback) {
        progressCallback({ stage: 'initializing', message: 'Setting up browser...' });
      }

      // Construct the videos page URL
      let videosUrl = channelUrl;
      
      // Handle different YouTube URL formats and ensure we get the /videos page
      if (!channelUrl.endsWith('/videos')) {
        // Remove trailing slash if present
        videosUrl = channelUrl.replace(/\/$/, '');
        
        // Handle @username format (e.g., https://www.youtube.com/@HistoryTime)
        if (videosUrl.includes('/@')) {
          videosUrl = videosUrl + '/videos';
        }
        // Handle channel format (e.g., https://www.youtube.com/channel/UC123456789)
        else if (videosUrl.includes('/channel/')) {
          videosUrl = videosUrl + '/videos';
        }
        // Handle c/ format (e.g., https://www.youtube.com/c/HistoryTime)
        else if (videosUrl.includes('/c/')) {
          videosUrl = videosUrl + '/videos';
        }
        // Handle user format (e.g., https://www.youtube.com/user/username)
        else if (videosUrl.includes('/user/')) {
          videosUrl = videosUrl + '/videos';
        }
        // For any other format, just append /videos
        else {
          videosUrl = videosUrl + '/videos';
        }
      }

      console.log(`Fetching videos from: ${videosUrl}`);

      // Production-optimized Puppeteer configuration
      const puppeteerConfig = {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ],
        timeout: 30000,
        protocolTimeout: 30000
      };

      console.log('Environment:', process.env.NODE_ENV);
      console.log('Platform:', process.platform);
      
      if (process.env.NODE_ENV === 'production') {
        console.log('Production mode: Using Puppeteer default browser discovery');
      }

      if (progressCallback) {
        progressCallback({ stage: 'launching', message: 'Launching browser...' });
      }

      console.log('Launching browser...');
      browser = await puppeteer.launch(puppeteerConfig);
      page = await browser.newPage();
      
      // Enhanced error handling for page events
      page.on('error', error => {
        console.error('Page error:', error);
      });
      
      page.on('pageerror', error => {
        console.error('Page error (pageerror):', error);
      });
      
      page.on('requestfailed', request => {
        console.log('Request failed:', request.url(), request.failure()?.errorText);
      });
      
      // Set browser settings with timeouts
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });
      
      page.setDefaultNavigationTimeout(45000);
      page.setDefaultTimeout(30000);
      
      if (progressCallback) {
        progressCallback({ stage: 'navigating', message: 'Loading channel page...' });
      }

      console.log('Loading page...');
      
      // Enhanced navigation with retry logic
      let navigationAttempts = 0;
      const maxNavigationAttempts = 3;
      
      while (navigationAttempts < maxNavigationAttempts) {
        try {
          await page.goto(videosUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 45000 
          });
          break;
        } catch (navigationError) {
          navigationAttempts++;
          console.log(`Navigation attempt ${navigationAttempts} failed:`, navigationError.message);
          
          if (navigationAttempts >= maxNavigationAttempts) {
            throw new Error(`Failed to navigate after ${maxNavigationAttempts} attempts: ${navigationError.message}`);
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }

      // Wait for initial content with error handling
      try {
        await page.waitForSelector('ytd-rich-grid-media, ytd-video-renderer, #contents', { timeout: 30000 });
      } catch (selectorError) {
        console.log('Initial selector wait failed, continuing anyway:', selectorError.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 5000));

      if (progressCallback) {
        progressCallback({ stage: 'scrolling', message: 'Scrolling to load all videos...' });
      }

      console.log('Starting controlled scrolling to load videos...');
      
      let scrollCount = 0;
      let lastVideoCount = 0;
      let stableCount = 0;
      const maxScrolls = 50; // Conservative for production
      const maxStableAttempts = 5;
      
      while (scrollCount < maxScrolls && stableCount < maxStableAttempts) {
        try {
          // Check if page is still connected
          if (page.isClosed()) {
            throw new Error('Page was closed during scrolling');
          }
          
          // Gentle scroll to bottom
          await page.evaluate(() => {
            return new Promise((resolve) => {
              try {
                window.scrollTo(0, document.body.scrollHeight);
                setTimeout(resolve, 500);
              } catch (e) {
                resolve();
              }
            });
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check current video count
          const currentVideoCount = await page.evaluate(() => {
            try {
              const links = document.querySelectorAll('a[href*="/watch?v="]');
              const uniqueVideos = new Set();
              links.forEach(link => {
                try {
                  const href = link.getAttribute('href');
                  if (href && href.includes('/watch?v=')) {
                    const videoIdMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                    if (videoIdMatch && videoIdMatch[1]) {
                      uniqueVideos.add(videoIdMatch[1]);
                    }
                  }
                } catch (e) {
                  // Skip this link if error
                }
              });
              return uniqueVideos.size;
            } catch (e) {
              return 0;
            }
          });
          
          console.log(`Scroll ${scrollCount + 1}: Found ${currentVideoCount} unique videos`);
          
          if (progressCallback) {
            progressCallback({ 
              stage: 'scrolling', 
              message: `Found ${currentVideoCount} videos (scroll ${scrollCount + 1}/${maxScrolls})...`,
              videosFound: currentVideoCount 
            });
          }
          
          if (currentVideoCount === lastVideoCount) {
            stableCount++;
            console.log(`No new videos found (stable count: ${stableCount})`);
          } else {
            stableCount = 0;
            lastVideoCount = currentVideoCount;
          }
          
          scrollCount++;
          
        } catch (scrollError) {
          console.error('Error during scrolling:', scrollError.message);
          
          if (scrollError.message.includes('detached') || 
              scrollError.message.includes('closed') ||
              scrollError.message.includes('disconnected')) {
            console.log('Critical error detected, stopping scrolling');
            break;
          }
          
          scrollCount++;
          continue;
        }
      }

      console.log(`Finished scrolling after ${scrollCount} attempts. Final video count: ${lastVideoCount}`);

      if (progressCallback) {
        progressCallback({ stage: 'extracting', message: 'Extracting video URLs...' });
      }

      // Extract video URLs with enhanced error handling
      const extractionResult = await page.evaluate(() => {
        try {
          const allVideoIds = new Set();
          
          // Extract from links
          const links = document.querySelectorAll('a[href*="/watch?v="]');
          links.forEach(link => {
            try {
              const href = link.getAttribute('href');
              if (href && href.includes('/watch?v=')) {
                const videoIdMatch = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
                if (videoIdMatch && videoIdMatch[1]) {
                  allVideoIds.add(videoIdMatch[1]);
                }
              }
            } catch (e) {
              // Skip this link if error
            }
          });
          
          return {
            videoIds: Array.from(allVideoIds),
            totalVideosFound: allVideoIds.size
          };
        } catch (e) {
          return {
            videoIds: [],
            totalVideosFound: 0,
            error: e.message
          };
        }
      });

      console.log(`Extraction complete. Found ${extractionResult.totalVideosFound} unique videos`);

      // Close browser early to free resources
      if (browser) {
        await browser.close();
        browser = null;
        page = null;
      }

      const videoUrls = extractionResult.videoIds.map(id => `https://www.youtube.com/watch?v=${id}`);

      if (videoUrls.length === 0) {
        if (progressCallback) {
          progressCallback({ stage: 'completed', message: 'No videos found on channel page' });
        }
        return {
          success: true,
          message: 'No videos found on channel page',
          videosFound: 0,
          videosProcessed: 0,
          videosAdded: 0,
          videosSkipped: 0,
          errors: 0
        };
      }

      if (progressCallback) {
        progressCallback({ 
          stage: 'processing', 
          message: `Processing ${videoUrls.length} videos...`,
          videosFound: videoUrls.length 
        });
      }

      let videosProcessed = 0;
      let videosAdded = 0;
      let videosSkipped = 0;
      let errors = 0;

      // Process each video URL
      for (let i = 0; i < videoUrls.length; i++) {
        const videoUrl = videoUrls[i];
        try {
          // Check if video already exists in database
          const existingVideo = await this.prisma.video.findUnique({
            where: { url: videoUrl }
          });

          if (existingVideo) {
            videosSkipped++;
            videosProcessed++;
            
            if (progressCallback) {
              progressCallback({ 
                stage: 'processing', 
                message: `Processing video ${i + 1}/${videoUrls.length} (skipped existing)...`,
                videosProcessed,
                videosAdded,
                videosSkipped
              });
            }
            continue;
          }

          // Get video metadata
          const metadata = await this.getVideoMetadata(videoUrl);
          
          if (!metadata || !metadata.title) {
            console.warn(`Could not get metadata for video: ${videoUrl}`);
            errors++;
            videosProcessed++;
            continue;
          }

          // Find or create the channel
          let channel = null;
          if (channelId) {
            channel = await this.prisma.channel.findUnique({
              where: { id: parseInt(channelId) }
            });
          }

          // Create the video record
          await this.prisma.video.create({
            data: {
              title: metadata.title,
              url: videoUrl,
              description: metadata.description || '',
              duration: metadata.duration || '',
              type: 'youtube',
              thumbnailUrl: metadata.thumbnailUrl || '',
              channelId: channel ? channel.id : null
            }
          });

          videosAdded++;
          videosProcessed++;

          if (progressCallback) {
            progressCallback({ 
              stage: 'processing', 
              message: `Processing video ${i + 1}/${videoUrls.length} (added: "${metadata.title}")...`,
              videosProcessed,
              videosAdded,
              videosSkipped
            });
          }

        } catch (error) {
          console.error(`Error processing video ${videoUrl}:`, error);
          errors++;
          videosProcessed++;
        }
      }

      if (progressCallback) {
        progressCallback({ 
          stage: 'completed', 
          message: `Scraping completed: ${videosAdded} added, ${videosSkipped} skipped`,
          videosFound: videoUrls.length,
          videosProcessed,
          videosAdded,
          videosSkipped,
          errors
        });
      }

      return {
        success: true,
        message: 'Channel video scraping completed',
        videosFound: videoUrls.length,
        videosProcessed,
        videosAdded,
        videosSkipped,
        errors
      };

    } catch (error) {
      console.error('Error scraping channel videos:', error);
      
      // Clean up browser if still open
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError);
        }
      }
      
      if (progressCallback) {
        progressCallback({ 
          stage: 'error', 
          message: `Scraping failed: ${error.message}`,
          error: error.message
        });
      }
      
      throw error;
    }
  }

  /**
   * Get channel info from URL using simple fetch
   */
  async getChannelInfo(channelUrl) {
    try {
      if (!channelUrl) {
        throw new Error('Channel URL is required');
      }

      console.log(`Getting channel info for: ${channelUrl}`);

      const response = await fetch(channelUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch channel: ${response.status}`);
      }

      const html = await response.text();
      
      // Extract channel information using regex (simple approach)
      const titleMatch = html.match(/<title>([^<]+)<\/title>/);
      const channelName = titleMatch ? titleMatch[1].replace(' - YouTube', '').trim() : 'Unknown Channel';

      const descriptionMatch = html.match(/<meta name="description" content="([^"]+)"/);
      const channelDescription = descriptionMatch ? descriptionMatch[1] : '';

      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
      const channelImage = imageMatch ? imageMatch[1] : '';

      return {
        success: true,
        channelInfo: {
          name: channelName,
          url: channelUrl,
          description: channelDescription,
          thumbnailUrl: channelImage
        }
      };

    } catch (error) {
      console.error('Error getting channel info:', error);
      throw error;
    }
  }
}

module.exports = VideoScraperService;