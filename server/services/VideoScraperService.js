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

      // Environment-optimized Puppeteer configuration
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
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--memory-pressure-off',
          '--max_old_space_size=4096'
        ],
        timeout: 60000,
        protocolTimeout: 60000,
        ignoreDefaultArgs: ['--disable-extensions'],
        defaultViewport: null
      };

      // Windows-specific adjustments
      if (process.platform === 'win32' && process.env.NODE_ENV === 'development') {
        // Remove problematic args for Windows development
        puppeteerConfig.args = puppeteerConfig.args.filter(arg => 
          !['--no-zygote', '--single-process'].includes(arg)
        );
        // Add Windows-friendly args
        puppeteerConfig.args.push(
          '--disable-web-security',
          '--disable-features=site-per-process',
          '--ignore-certificate-errors',
          '--allow-running-insecure-content'
        );
      } else if (process.env.NODE_ENV === 'production') {
        // Production optimizations
        puppeteerConfig.args.push('--no-zygote', '--single-process');
      }

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
      
      // Enhanced navigation with retry logic and frame detachment handling
      let navigationAttempts = 0;
      const maxNavigationAttempts = 5;
      
      while (navigationAttempts < maxNavigationAttempts) {
        try {
          // Create new page if current one is detached
          if (page.isClosed() || navigationAttempts > 0) {
            if (!page.isClosed()) {
              await page.close();
            }
            page = await browser.newPage();
            
            // Re-setup page after recreation
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });
            page.setDefaultNavigationTimeout(60000);
            page.setDefaultTimeout(45000);
          }
          
          await page.goto(videosUrl, { 
            waitUntil: ['domcontentloaded', 'networkidle0'],
            timeout: 60000 
          });
          
          console.log('✅ Successfully navigated to channel page');
          break;
          
        } catch (navigationError) {
          navigationAttempts++;
          console.log(`Navigation attempt ${navigationAttempts} failed:`, navigationError.message);
          
          if (navigationAttempts >= maxNavigationAttempts) {
            throw new Error(`Failed to navigate after ${maxNavigationAttempts} attempts: ${navigationError.message}`);
          }
          
          // Longer wait between retries for frame detachment issues
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      // Wait for initial content with multiple selector strategies
      let contentLoaded = false;
      const selectors = [
        'ytd-rich-grid-media',
        'ytd-video-renderer', 
        '#contents',
        '[role="main"]',
        'ytd-browse'
      ];
      
      for (const selector of selectors) {
        try {
          await page.waitForSelector(selector, { timeout: 15000 });
          console.log(`✅ Found content with selector: ${selector}`);
          contentLoaded = true;
          break;
        } catch (selectorError) {
          console.log(`⏭️ Selector ${selector} not found, trying next...`);
        }
      }
      
      if (!contentLoaded) {
        console.log('⚠️ No expected selectors found, but continuing...');
      }
      
      // Wait for page to stabilize
      await new Promise(resolve => setTimeout(resolve, 8000));

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
            console.log('Page was closed during scrolling, stopping...');
            break;
          }
          
          // Gentle scroll to bottom with error handling
          try {
            await page.evaluate(() => {
              return new Promise((resolve) => {
                try {
                  const scrollHeight = Math.max(
                    document.body.scrollHeight,
                    document.documentElement.scrollHeight
                  );
                  window.scrollTo({
                    top: scrollHeight,
                    behavior: 'smooth'
                  });
                  setTimeout(resolve, 1000);
                } catch (e) {
                  console.log('Scroll eval error:', e.message);
                  resolve();
                }
              });
            });
          } catch (scrollEvalError) {
            console.log('Scroll evaluation failed:', scrollEvalError.message);
            // Try alternative scroll method
            try {
              await page.keyboard.press('End');
            } catch (keyError) {
              console.log('Keyboard scroll fallback failed');
            }
          }
          
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Check current video count with retry logic
          let currentVideoCount = 0;
          try {
            currentVideoCount = await page.evaluate(() => {
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
                console.log('Video count evaluation error:', e.message);
                return 0;
              }
            });
          } catch (evalError) {
            console.log('Failed to evaluate video count:', evalError.message);
            // If evaluation fails, assume no progress and continue
            currentVideoCount = lastVideoCount;
          }
          
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
          // Create a fresh Prisma client instance for this iteration
          const prismaClient = new PrismaClient();
          
          // Check if video already exists in database
          const existingVideo = await prismaClient.historyVideo.findUnique({
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
            channel = await this.prisma.historyChannel.findUnique({
              where: { id: parseInt(channelId) }
            });
          }

          // Create the video record
          await this.prisma.historyVideo.create({
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