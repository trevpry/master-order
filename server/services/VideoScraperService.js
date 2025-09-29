const puppeteer = require('puppeteer');
const prisma = require('../prismaClient'); // Use shared Prisma client

class VideoScraperService {
  constructor() {
    this.prisma = prisma; // Use shared instance to avoid connection pool exhaustion
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
   * Decode HTML entities and properly handle Unicode characters
   */
  decodeHtmlEntities(text) {
    if (!text) return text;
    
    // Decode common HTML entities
    const entities = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&hellip;': '…',
      '&ndash;': '–',
      '&mdash;': '—',
      '&lsquo;': '\u2018',
      '&rsquo;': '\u2019',
      '&ldquo;': '\u201C',
      '&rdquo;': '\u201D',
      '&nbsp;': ' ',
      '&bull;': '•',
      '&copy;': '©',
      '&reg;': '®',
      '&trade;': '™',
      '&euro;': '€',
      '&pound;': '£',
      '&yen;': '¥',
      '&cent;': '¢',
      '&sect;': '§',
      '&para;': '¶',
      '&middot;': '·',
      '&raquo;': '»',
      '&laquo;': '«',
      '&agrave;': 'à',
      '&aacute;': 'á',
      '&acirc;': 'â',
      '&atilde;': 'ã',
      '&auml;': 'ä',
      '&aring;': 'å',
      '&aelig;': 'æ',
      '&ccedil;': 'ç',
      '&egrave;': 'è',
      '&eacute;': 'é',
      '&ecirc;': 'ê',
      '&euml;': 'ë',
      '&igrave;': 'ì',
      '&iacute;': 'í',
      '&icirc;': 'î',
      '&iuml;': 'ï',
      '&eth;': 'ð',
      '&ntilde;': 'ñ',
      '&ograve;': 'ò',
      '&oacute;': 'ó',
      '&ocirc;': 'ô',
      '&otilde;': 'õ',
      '&ouml;': 'ö',
      '&oslash;': 'ø',
      '&ugrave;': 'ù',
      '&uacute;': 'ú',
      '&ucirc;': 'û',
      '&uuml;': 'ü',
      '&yacute;': 'ý',
      '&thorn;': 'þ',
      '&yuml;': 'ÿ'
    };
    
    let decoded = text;
    
    // Replace named entities
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    
    // Decode numeric entities (&#123; and &#x1A;)
    decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
      return String.fromCharCode(parseInt(dec, 10));
    });
    
    decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
    
    return decoded;
  }

  /**
   * SAFE database sequence diagnostic - READ-ONLY analysis of sequence state
   * This addresses production-specific unique constraint errors on the id field
   * GUARANTEED ZERO DATA LOSS - only reads, never modifies data
   */
  async checkDatabaseSequenceHealth() {
    try {
      console.log('🔍 SAFE MODE: Analyzing database sequence health (READ-ONLY)...');
      
      // SAFE: Get record count and max ID (READ-ONLY operations)
      const [recordCount, maxIdResult] = await Promise.all([
        this.prisma.historyVideo.count(),
        this.prisma.historyVideo.aggregate({
          _max: { id: true }
        })
      ]);
      
      const maxId = maxIdResult._max.id || 0;
      console.log(`📊 HistoryVideo table stats: ${recordCount} records, max ID: ${maxId}`);
      
      // SAFE: Detect database type (READ-ONLY)
      const databaseUrl = process.env.DATABASE_URL || '';
      const isPostgreSQL = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
      const dbType = isPostgreSQL ? 'PostgreSQL' : 'SQLite';
      
      console.log(`🗄️  Database type: ${dbType}`);
      
      if (isPostgreSQL) {
        return await this._analyzePostgreSQLSequence(maxId, recordCount);
      } else {
        return await this._analyzeSQLiteSequence(maxId, recordCount);
      }
      
    } catch (error) {
      console.error('❌ Error during sequence health check:', error);
      return { 
        safe: true, 
        error: error.message, 
        recommendation: 'Error occurred during read-only analysis' 
      };
    }
  }

  /**
   * SAFE PostgreSQL sequence analysis (READ-ONLY)
   */
  async _analyzePostgreSQLSequence(maxId, recordCount) {
    try {
      console.log('🔍 Attempting PostgreSQL sequence analysis...');
      
      // SAFE: First, let's find what sequences exist for this table
      let sequenceExists = [];
      try {
        sequenceExists = await this.prisma.$queryRaw`
          SELECT sequence_name, sequence_schema
          FROM information_schema.sequences 
          WHERE sequence_name LIKE '%HistoryVideo%' OR sequence_name LIKE '%historyvideo%'
        `;
        console.log(`Found sequences: ${JSON.stringify(sequenceExists)}`);
      } catch (seqError) {
        console.log(`Sequence lookup failed: ${seqError.message}`);
      }
      
      // Try multiple possible sequence names
      const possibleSequenceNames = [
        'HistoryVideo_id_seq',
        'historyvideo_id_seq', 
        '"HistoryVideo_id_seq"',
        'public.HistoryVideo_id_seq',
        'public."HistoryVideo_id_seq"'
      ];
      
      let sequenceResult = null;
      let workingSequenceName = null;
      
      for (const sequenceName of possibleSequenceNames) {
        try {
          console.log(`Trying sequence name: ${sequenceName}`);
          sequenceResult = await this.prisma.$queryRaw`
            SELECT last_value, is_called 
            FROM ${this.prisma.Prisma.raw(sequenceName)}
          `;
          
          if (sequenceResult && sequenceResult.length > 0) {
            workingSequenceName = sequenceName;
            console.log(`✅ Found working sequence: ${sequenceName}`);
            break;
          }
        } catch (seqError) {
          console.log(`Sequence ${sequenceName} failed: ${seqError.message}`);
          continue;
        }
      }
      
      if (!sequenceResult || sequenceResult.length === 0) {
        // Try a different approach - use currval if available
        try {
          console.log('Trying currval approach...');
          const currvalResult = await this.prisma.$queryRaw`
            SELECT currval(pg_get_serial_sequence('HistoryVideo', 'id')) as current_value
          `;
          
          if (currvalResult && currvalResult.length > 0) {
            const currentValue = parseInt(currvalResult[0].current_value);
            const nextValue = currentValue + 1;
            const wouldCauseConflict = nextValue <= maxId;
            
            return {
              safe: true,
              healthy: !wouldCauseConflict,
              database: 'postgresql',
              analysis: {
                recordCount,
                maxId,
                currentSequenceValue: currentValue,
                nextValue,
                wouldCauseConflict,
                method: 'currval'
              },
              recommendation: wouldCauseConflict 
                ? `⚠️  SEQUENCE OUT OF SYNC: Next ID (${nextValue}) would conflict with existing data (max: ${maxId}). Sequence needs update.`
                : `✅ SEQUENCE HEALTHY: Next ID (${nextValue}) is safely above max data ID (${maxId})`
            };
          }
        } catch (currvalError) {
          console.log(`Currval approach failed: ${currvalError.message}`);
        }
        
        return {
          safe: true,
          issue: 'Could not find or access sequence',
          recommendation: `Unable to analyze sequence. Available sequences: ${JSON.stringify(sequenceExists)}`,
          database: 'postgresql',
          sequencesFound: sequenceExists
        };
      }
      
      const { last_value, is_called } = sequenceResult[0];
      const nextValue = is_called ? parseInt(last_value) + 1 : parseInt(last_value);
      const wouldCauseConflict = nextValue <= maxId;
      
      console.log(`🔍 PostgreSQL Sequence Analysis (${workingSequenceName}):`);
      console.log(`   Last Value: ${last_value}`);
      console.log(`   Is Called: ${is_called}`);
      console.log(`   Next Value: ${nextValue}`);
      console.log(`   Max ID in table: ${maxId}`);
      console.log(`   Would Cause Conflict: ${wouldCauseConflict}`);
      
      return {
        safe: true,
        healthy: !wouldCauseConflict,
        database: 'postgresql',
        analysis: {
          recordCount,
          maxId,
          sequenceLastValue: parseInt(last_value),
          sequenceIsCalled: is_called,
          nextValue,
          wouldCauseConflict,
          sequenceName: workingSequenceName
        },
        recommendation: wouldCauseConflict 
          ? `⚠️  SEQUENCE OUT OF SYNC: Next ID (${nextValue}) would conflict with existing data (max: ${maxId}). Sequence needs update.`
          : `✅ SEQUENCE HEALTHY: Next ID (${nextValue}) is safely above max data ID (${maxId})`
      };
      
    } catch (error) {
      console.error('PostgreSQL sequence analysis error:', error);
      return {
        safe: true,
        error: `PostgreSQL analysis failed: ${error.message}`,
        recommendation: 'Could not analyze PostgreSQL sequence - see logs for details',
        database: 'postgresql'
      };
    }
  }

  /**
   * SAFE SQLite sequence analysis (READ-ONLY)
   */
  async _analyzeSQLiteSequence(maxId, recordCount) {
    try {
      // SAFE: Check SQLite sequence (READ-ONLY)
      const sequenceResult = await this.prisma.$queryRaw`
        SELECT seq FROM sqlite_sequence WHERE name = 'HistoryVideo'
      `;
      
      if (sequenceResult.length === 0) {
        return {
          safe: true,
          issue: 'No SQLite sequence record found',
          recommendation: 'Table may be new or never had auto-increment inserts',
          database: 'sqlite'
        };
      }
      
      const currentSeq = sequenceResult[0].seq;
      const nextValue = currentSeq + 1;
      const isHealthy = nextValue > maxId;
      const wouldCauseConflict = nextValue <= maxId;
      
      console.log(`🔍 SQLite Sequence Analysis:`);
      console.log(`   Current Sequence: ${currentSeq}`);
      console.log(`   Next Value: ${nextValue}`);
      console.log(`   Max ID in table: ${maxId}`);
      
      return {
        safe: true,
        healthy: isHealthy,
        database: 'sqlite',
        analysis: {
          recordCount,
          maxId,
          currentSequence: currentSeq,
          nextValue,
          wouldCauseConflict
        },
        recommendation: wouldCauseConflict
          ? `⚠️  SEQUENCE OUT OF SYNC: Next ID (${nextValue}) would conflict with existing data (max: ${maxId}). Sequence needs update.`
          : `✅ SEQUENCE HEALTHY: Next ID (${nextValue}) is safely above max data ID (${maxId})`
      };
      
    } catch (error) {
      return {
        safe: true,
        error: `SQLite analysis failed: ${error.message}`,
        recommendation: 'Could not analyze SQLite sequence',
        database: 'sqlite'
      };
    }
  }

  /**
   * SAFE sequence repair method - ONLY call after manual verification
   * This method includes additional safety checks and can only fix sequences that are clearly out of sync
   * 
   * @param {boolean} confirmSafeToFix - Must be explicitly set to true to execute
   * @returns {Object} Result of the fix operation
   */
  async repairDatabaseSequence(confirmSafeToFix = false) {
    if (!confirmSafeToFix) {
      return {
        success: false,
        error: 'Safety confirmation required. Set confirmSafeToFix=true to execute repair.',
        recommendation: 'First run checkDatabaseSequenceHealth() to analyze the issue.'
      };
    }

    try {
      console.log('🔧 REPAIR MODE: Attempting to fix database sequence...');
      
      // First, do a fresh health check
      const healthCheck = await this.checkDatabaseSequenceHealth();
      
      if (healthCheck.healthy) {
        return {
          success: false,
          message: 'Sequence is healthy - no repair needed',
          healthCheck
        };
      }

      if (!healthCheck.analysis || healthCheck.error) {
        return {
          success: false,
          error: 'Cannot repair - health check failed or returned no analysis data',
          healthCheck
        };
      }

      const { maxId, database } = healthCheck.analysis;
      const safeNextValue = maxId + 1;

      console.log(`🔧 Proceeding with repair: Setting next sequence value to ${safeNextValue}`);

      if (database === 'postgresql') {
        // PostgreSQL sequence repair using the sequence name from analysis
        const sequenceName = healthCheck.analysis.sequenceName || 'HistoryVideo_id_seq';
        
        console.log(`🔧 Repairing PostgreSQL sequence: ${sequenceName}`);
        
        // Try multiple repair approaches
        let repairSuccess = false;
        let repairMethod = null;
        
        // Method 1: Direct setval with identified sequence name
        try {
          await this.prisma.$executeRaw`
            SELECT setval(${this.prisma.Prisma.raw(`'${sequenceName}'`)}, ${safeNextValue}, false)
          `;
          repairSuccess = true;
          repairMethod = 'setval_direct';
          console.log(`✅ Sequence repaired using direct setval`);
        } catch (directError) {
          console.log(`Direct setval failed: ${directError.message}`);
          
          // Method 2: Use pg_get_serial_sequence approach
          try {
            await this.prisma.$executeRaw`
              SELECT setval(pg_get_serial_sequence('HistoryVideo', 'id'), ${safeNextValue}, false)
            `;
            repairSuccess = true;
            repairMethod = 'setval_pg_get_serial';
            console.log(`✅ Sequence repaired using pg_get_serial_sequence`);
          } catch (serialError) {
            console.log(`pg_get_serial_sequence failed: ${serialError.message}`);
            throw new Error(`Both repair methods failed: ${directError.message} | ${serialError.message}`);
          }
        }
        
        if (!repairSuccess) {
          throw new Error('All PostgreSQL sequence repair methods failed');
        }
        
        // Verify the fix worked
        let verifyResult = null;
        try {
          verifyResult = await this.prisma.$queryRaw`
            SELECT last_value, is_called FROM ${this.prisma.Prisma.raw(sequenceName)}
          `;
        } catch (verifyError) {
          // Try alternative verification
          try {
            const currvalResult = await this.prisma.$queryRaw`
              SELECT currval(pg_get_serial_sequence('HistoryVideo', 'id')) as current_value
            `;
            const currentValue = parseInt(currvalResult[0].current_value);
            verifyResult = [{ last_value: currentValue, is_called: true }];
          } catch (currvalError) {
            console.warn(`Could not verify sequence repair: ${verifyError.message}`);
            return {
              success: true,
              database: 'postgresql',
              warning: 'Repair completed but verification failed',
              repairMethod,
              message: `PostgreSQL sequence repair attempted. Could not verify result.`
            };
          }
        }
        
        const nextValueAfterFix = verifyResult[0].is_called ? 
          parseInt(verifyResult[0].last_value) + 1 : parseInt(verifyResult[0].last_value);

        return {
          success: true,
          database: 'postgresql',
          repairApplied: {
            targetNextValue: safeNextValue,
            actualNextValue: nextValueAfterFix,
            verificationPassed: nextValueAfterFix === safeNextValue,
            sequenceName,
            repairMethod
          },
          message: `PostgreSQL sequence repaired using ${repairMethod}. Next ID will be: ${nextValueAfterFix}`
        };

      } else {
        // SQLite sequence repair
        await this.prisma.$executeRaw`
          UPDATE sqlite_sequence SET seq = ${maxId} WHERE name = 'HistoryVideo'
        `;
        
        // Verify the fix worked
        const verifyResult = await this.prisma.$queryRaw`
          SELECT seq FROM sqlite_sequence WHERE name = 'HistoryVideo'
        `;
        
        const actualSeq = verifyResult[0].seq;
        const nextValueAfterFix = actualSeq + 1;

        return {
          success: true,
          database: 'sqlite',
          repairApplied: {
            targetNextValue: safeNextValue,
            actualNextValue: nextValueAfterFix,
            verificationPassed: nextValueAfterFix === safeNextValue
          },
          message: `SQLite sequence repaired. Next ID will be: ${nextValueAfterFix}`
        };
      }

    } catch (error) {
      console.error('❌ Sequence repair failed:', error);
      return {
        success: false,
        error: `Repair failed: ${error.message}`,
        recommendation: 'Manual database intervention may be required'
      };
    }
  }

  /**
   * EMERGENCY: Quick sequence fix for immediate production issues
   * This bypasses health checks and directly sets the sequence to a safe value
   */
  async emergencySequenceReset() {
    try {
      console.log('🚨 EMERGENCY SEQUENCE RESET: Getting current max ID...');
      
      const maxIdResult = await this.prisma.historyVideo.aggregate({
        _max: { id: true }
      });
      
      const maxId = maxIdResult._max.id || 0;
      const safeNextValue = maxId + 1;
      
      console.log(`📊 Max ID found: ${maxId}, setting sequence to: ${safeNextValue}`);
      
      // Detect database type
      const databaseUrl = process.env.DATABASE_URL || '';
      const isPostgreSQL = databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://');
      
      if (isPostgreSQL) {
        console.log('🔧 PostgreSQL emergency repair...');
        
        // Try the most reliable PostgreSQL sequence reset method
        try {
          await this.prisma.$executeRaw`
            SELECT setval(pg_get_serial_sequence('HistoryVideo', 'id'), ${safeNextValue}, false)
          `;
          
          console.log('✅ PostgreSQL sequence reset successful');
          return {
            success: true,
            database: 'postgresql',
            maxId,
            nextValue: safeNextValue,
            message: `Emergency PostgreSQL sequence reset complete. Next ID: ${safeNextValue}`
          };
          
        } catch (pgError) {
          console.error('❌ PostgreSQL emergency reset failed:', pgError.message);
          return {
            success: false,
            database: 'postgresql',
            error: pgError.message,
            maxId,
            recommendation: 'Manual database intervention required'
          };
        }
      } else {
        console.log('🔧 SQLite emergency repair...');
        
        try {
          await this.prisma.$executeRaw`
            UPDATE sqlite_sequence SET seq = ${maxId} WHERE name = 'HistoryVideo'
          `;
          
          console.log('✅ SQLite sequence reset successful');
          return {
            success: true,
            database: 'sqlite',
            maxId,
            nextValue: safeNextValue,
            message: `Emergency SQLite sequence reset complete. Next ID: ${safeNextValue}`
          };
          
        } catch (sqliteError) {
          console.error('❌ SQLite emergency reset failed:', sqliteError.message);
          return {
            success: false,
            database: 'sqlite',
            error: sqliteError.message,
            maxId,
            recommendation: 'Manual database intervention required'
          };
        }
      }
      
    } catch (error) {
      console.error('❌ Emergency sequence reset failed:', error);
      return {
        success: false,
        error: error.message,
        recommendation: 'Could not complete emergency reset'
      };
    }
  }

  /**
   * Get video metadata using basic fetch (fallback if YouTube API is not available)
   * Enhanced with proper Unicode and HTML entity handling
   */
  async getVideoMetadata(videoUrl) {
    try {
      const response = await fetch(videoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br'
        }
      });

      if (!response.ok) {
        console.warn(`Failed to fetch video page: ${response.status}`);
        return null;
      }

      // Ensure we get the response as UTF-8 text
      const buffer = await response.arrayBuffer();
      const html = new TextDecoder('utf-8').decode(buffer);
      
      // Extract basic metadata from HTML with better Unicode support
      // Use non-greedy matching and handle potential Unicode characters
      const titleMatch = html.match(/<title[^>]*>([^<]*?)<\/title>/i);
      let title = titleMatch ? titleMatch[1] : null;
      
      if (title) {
        // Remove " - YouTube" suffix and decode HTML entities
        title = title.replace(/ - YouTube$/i, '').trim();
        title = this.decodeHtmlEntities(title);
        
        // Additional cleanup for any remaining artifacts
        title = title.replace(/^\s+|\s+$/g, ''); // Trim whitespace
        title = title.replace(/\s+/g, ' '); // Normalize multiple spaces
      }

      // Extract description with similar handling
      const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i);
      let description = descriptionMatch ? descriptionMatch[1] : '';
      
      if (description) {
        description = this.decodeHtmlEntities(description);
      }

      // Also try to extract from JSON-LD if available (more reliable for Unicode)
      const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]*?)<\/script>/i);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.name && !title) {
            title = jsonData.name;
          }
          if (jsonData.description && !description) {
            description = jsonData.description;
          }
        } catch (jsonError) {
          // Ignore JSON parsing errors, fall back to regex extraction
        }
      }

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
    let browserPath = null; // Declare at method scope for error handling
    
    try {
      if (!channelUrl) {
        throw new Error('Channel URL is required');
      }

      // Validate YouTube channel URL
      if (!channelUrl.includes('youtube.com')) {
        throw new Error('Please provide a valid YouTube channel URL');
      }

      console.log(`Starting to scrape videos from channel: ${channelUrl}`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔧 Platform: ${process.platform}`);
      
      // SAFE: Check database sequence health before starting (READ-ONLY analysis)
      const sequenceHealth = await this.checkDatabaseSequenceHealth();
      console.log(`📊 Database sequence health check: ${sequenceHealth.healthy ? '✅ HEALTHY' : '⚠️  NEEDS ATTENTION'}`);
      
      if (!sequenceHealth.healthy && sequenceHealth.recommendation) {
        console.log(`📋 Recommendation: ${sequenceHealth.recommendation}`);
        console.log(`🛡️  Running in SAFE MODE - no automatic fixes applied`);
      }
      
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

      // Environment-optimized Puppeteer configuration with enhanced Docker/Unraid support
      const puppeteerConfig = {
        headless: 'new', // Use new headless mode for better stability
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-features=VizDisplayCompositor',
          '--disable-gpu',
          '--disable-gpu-sandbox',
          '--disable-software-rasterizer',
          '--no-first-run',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-web-security',
          '--disable-features=TranslateUI',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-default-apps',
          '--disable-background-networking',
          '--disable-sync',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-zygote',
          '--single-process',
          '--memory-pressure-off',
          '--max_old_space_size=4096',
          '--disable-ipc-flooding-protection',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-domain-reliability',
          '--disable-component-extensions-with-background-pages'
        ],
        timeout: 90000, // Increased timeout for slower environments
        protocolTimeout: 90000,
        ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
        defaultViewport: { width: 1280, height: 720 }, // Fixed viewport for consistency
        handleSIGINT: false,
        handleSIGTERM: false,
        handleSIGHUP: false
      };
      
      // Try to get browser executable path
      try {
        // Try Puppeteer's default path first
        browserPath = puppeteer.executablePath();
        console.log('Found Puppeteer browser at:', browserPath);
      } catch (error) {
        console.log('Could not get Puppeteer executable path:', error.message);
        
        // Fallback paths for common Linux environments
        const fallbackPaths = [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium',
          '/usr/bin/chromium-browser',
          '/snap/bin/chromium',
          process.env.CHROME_BIN,
          process.env.PUPPETEER_EXECUTABLE_PATH
        ].filter(Boolean);
        
        for (const path of fallbackPaths) {
          try {
            const fs = require('fs');
            if (fs.existsSync(path)) {
              browserPath = path;
              console.log('Found fallback browser at:', browserPath);
              break;
            }
          } catch (e) {
            // Continue checking other paths
          }
        }
      }
      
      // Set the executable path if found
      if (browserPath) {
        puppeteerConfig.executablePath = browserPath;
      }

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
      console.log('Browser executable:', puppeteerConfig.executablePath || 'default');
      
      if (process.env.NODE_ENV === 'production') {
        console.log('Production mode: Enhanced browser detection');
        
        // Additional production safety checks
        if (!browserPath) {
          console.warn('⚠️ No browser executable found. This may cause launch failures.');
          console.log('Consider installing Chrome: apt-get update && apt-get install -y google-chrome-stable');
          console.log('Or set PUPPETEER_EXECUTABLE_PATH environment variable');
        }
      }

      if (progressCallback) {
        progressCallback({ stage: 'launching', message: 'Launching browser...' });
      }

      console.log('Launching browser...');
      let launchAttempt = 0;
      const maxLaunchAttempts = 3;
      
      while (launchAttempt < maxLaunchAttempts && !browser) {
        launchAttempt++;
        console.log(`🚀 Browser launch attempt ${launchAttempt}/${maxLaunchAttempts}`);
        
        try {
          // Add delay between attempts
          if (launchAttempt > 1) {
            console.log(`⏱️ Waiting 2 seconds before retry attempt...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          browser = await puppeteer.launch(puppeteerConfig);
          console.log('✅ Browser launched successfully');
          break;
          
        } catch (launchError) {
          console.error(`❌ Browser launch attempt ${launchAttempt} failed:`, launchError.message);
          
          if (launchAttempt === maxLaunchAttempts) {
            // Final fallback with ultra-minimal configuration
            console.log('🔄 Attempting final fallback with ultra-minimal configuration...');
            const ultraMinimalConfig = {
              headless: 'new',
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--no-zygote',
                '--single-process',
                '--disable-extensions',
                '--disable-plugins',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-hang-monitor',
                '--disable-prompt-on-repost',
                '--disable-ipc-flooding-protection',
                '--disable-domain-reliability',
                '--disable-component-extensions-with-background-pages',
                '--no-first-run',
                '--mute-audio'
              ],
              timeout: 120000,
              protocolTimeout: 120000,
              ignoreDefaultArgs: ['--disable-extensions', '--enable-automation'],
              defaultViewport: { width: 1280, height: 720 },
              handleSIGINT: false,
              handleSIGTERM: false,
              handleSIGHUP: false
            };
            
            if (browserPath) {
              ultraMinimalConfig.executablePath = browserPath;
            }
            
            try {
              browser = await puppeteer.launch(ultraMinimalConfig);
              console.log('✅ Ultra-minimal fallback browser launch successful');
            } catch (fallbackError) {
              console.error('❌ All browser launch attempts failed:', fallbackError.message);
              console.error('❌ Environment diagnostics:', {
                NODE_ENV: process.env.NODE_ENV,
                platform: process.platform,
                browserPath: browserPath || 'not found',
                puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
                chromeBin: process.env.CHROME_BIN,
                availableMemory: process.memoryUsage(),
                dockerContainer: !!process.env.DOCKER_CONTAINER || process.env.NODE_ENV === 'production'
              });
              throw new Error(`All browser launch attempts failed. Final error: ${fallbackError.message}`);
            }
          }
        }
      }
      // Create new page with enhanced error handling
      let pageCreationAttempts = 0;
      const maxPageAttempts = 3;
      
      while (pageCreationAttempts < maxPageAttempts && !page) {
        pageCreationAttempts++;
        console.log(`📄 Page creation attempt ${pageCreationAttempts}/${maxPageAttempts}`);
        
        try {
          page = await browser.newPage();
          console.log('✅ Page created successfully');
          break;
        } catch (pageError) {
          console.error(`❌ Page creation attempt ${pageCreationAttempts} failed:`, pageError.message);
          
          if (pageCreationAttempts < maxPageAttempts) {
            console.log('⏱️ Waiting 1 second before page creation retry...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            throw new Error(`Failed to create page after ${maxPageAttempts} attempts: ${pageError.message}`);
          }
        }
      }
      
      // Enhanced error handling for page events with better logging
      page.on('error', error => {
        console.error('🚨 Page error event:', error.message);
        console.error('🚨 Page error stack:', error.stack);
      });
      
      page.on('pageerror', error => {
        console.error('🚨 Page JavaScript error:', error.message);
      });
      
      page.on('requestfailed', request => {
        const failure = request.failure();
        console.log(`🚫 Request failed: ${request.url()} - ${failure?.errorText || 'Unknown error'}`);
      });
      
      page.on('disconnect', () => {
        console.warn('⚠️ Page disconnected');
      });
      
      page.on('close', () => {
        console.log('📄 Page closed');
      });
      
      // Set browser settings with conservative timeouts for production
      const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      
      try {
        await page.setUserAgent(userAgent);
        console.log('✅ User agent set successfully');
      } catch (uaError) {
        console.warn('⚠️ Failed to set user agent:', uaError.message);
      }
      
      try {
        await page.setViewport({ width: 1280, height: 720 });
        console.log('✅ Viewport set successfully');
      } catch (vpError) {
        console.warn('⚠️ Failed to set viewport:', vpError.message);
      }
      
      // Set conservative timeouts for production stability
      const navigationTimeout = process.env.NODE_ENV === 'production' ? 120000 : 60000;
      const defaultTimeout = process.env.NODE_ENV === 'production' ? 90000 : 45000;
      
      page.setDefaultNavigationTimeout(navigationTimeout);
      page.setDefaultTimeout(defaultTimeout);
      
      console.log(`⏱️ Timeouts set - Navigation: ${navigationTimeout}ms, Default: ${defaultTimeout}ms`);
      
      if (progressCallback) {
        progressCallback({ stage: 'navigating', message: 'Loading channel page...' });
      }

      console.log('Loading page...');
      
      // Enhanced navigation with production-optimized retry logic
      let navigationAttempts = 0;
      const maxNavigationAttempts = process.env.NODE_ENV === 'production' ? 7 : 5;
      let navigationSuccess = false;
      
      while (navigationAttempts < maxNavigationAttempts && !navigationSuccess) {
        navigationAttempts++;
        console.log(`🌐 Navigation attempt ${navigationAttempts}/${maxNavigationAttempts}: ${videosUrl}`);
        
        try {
          // Check if page is still valid before navigation
          if (page.isClosed()) {
            console.log('📄 Page is closed, creating new page...');
            page = await browser.newPage();
            
            // Re-setup page with production-optimized settings
            await page.setUserAgent(userAgent);
            await page.setViewport({ width: 1280, height: 720 });
            page.setDefaultNavigationTimeout(navigationTimeout);
            page.setDefaultTimeout(defaultTimeout);
            
            // Re-add event listeners
            page.on('error', error => console.error('🚨 Page error (recreated):', error.message));
            page.on('pageerror', error => console.error('🚨 Page JS error (recreated):', error.message));
            page.on('disconnect', () => console.warn('⚠️ Page disconnected (recreated)'));
          }
          
          // Progressive navigation strategy based on attempt number
          let navigationOptions;
          if (process.env.NODE_ENV === 'production') {
            // Production: Very conservative approach
            navigationOptions = {
              waitUntil: navigationAttempts <= 2 ? 'domcontentloaded' : 'load',
              timeout: Math.min(60000 + (navigationAttempts * 15000), 120000) // Increase timeout with attempts
            };
          } else {
            // Development: More flexible
            navigationOptions = {
              waitUntil: navigationAttempts <= 2 ? ['domcontentloaded', 'networkidle2'] : 'domcontentloaded',
              timeout: 60000 + (navigationAttempts * 10000)
            };
          }
          
          console.log(`📋 Navigation options: ${JSON.stringify(navigationOptions)}`);
          
          // Add extra delay for later attempts to avoid overwhelming the browser
          if (navigationAttempts > 2) {
            const delay = (navigationAttempts - 2) * 2000;
            console.log(`⏱️ Adding ${delay}ms delay before navigation...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
          await page.goto(videosUrl, navigationOptions);
          
          // Verify navigation actually worked
          const currentUrl = await page.url();
          if (!currentUrl.includes('youtube.com')) {
            throw new Error(`Navigation failed: ended up at ${currentUrl} instead of YouTube`);
          }
          
          console.log('✅ Successfully navigated to channel page');
          console.log(`📍 Current URL: ${currentUrl}`);
          navigationSuccess = true;
          
        } catch (navigationError) {
          console.error(`❌ Navigation attempt ${navigationAttempts} failed:`, navigationError.message);
          console.error(`❌ Error type: ${navigationError.name}`);
          
          // Log additional context for debugging
          if (navigationError.message.includes('Target closed')) {
            console.error('🎯 Target closed error detected - browser connection issue');
          } else if (navigationError.message.includes('timeout')) {
            console.error('⏱️ Timeout error detected - page loading too slow');
          } else if (navigationError.message.includes('net::')) {
            console.error('🌐 Network error detected - connection issue');
          }
          
          if (navigationAttempts >= maxNavigationAttempts) {
            console.error('❌ All navigation attempts exhausted');
            console.error('❌ Final error details:', {
              message: navigationError.message,
              stack: navigationError.stack,
              attempt: navigationAttempts,
              maxAttempts: maxNavigationAttempts,
              environment: process.env.NODE_ENV,
              platform: process.platform,
              browserPath: browserPath || 'default',
              url: videosUrl
            });
            throw new Error(`Failed to navigate after ${maxNavigationAttempts} attempts: ${navigationError.message}`);
          }
          
          // Progressive backoff delay
          const backoffDelay = Math.min(5000 * navigationAttempts, 20000);
          console.log(`⏱️ Waiting ${backoffDelay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
      }

      // Wait for initial content with enhanced selector strategies and timeouts
      let contentLoaded = false;
      const contentTimeout = process.env.NODE_ENV === 'production' ? 30000 : 20000;
      
      // Progressive selector strategy - start with most specific, fall back to general
      const selectorGroups = [
        // Primary video content selectors
        ['ytd-rich-grid-media', 'ytd-video-renderer'],
        // Fallback content containers
        ['#contents', '[role="main"]'],
        // General page structure
        ['ytd-browse', 'ytd-page-manager', '#page-manager'],
        // Last resort - any YouTube content
        ['[id*="content"]', '[class*="content"]']
      ];
      
      console.log('🔍 Waiting for page content to load...');
      
      for (let groupIndex = 0; groupIndex < selectorGroups.length && !contentLoaded; groupIndex++) {
        const selectors = selectorGroups[groupIndex];
        console.log(`📋 Trying selector group ${groupIndex + 1}/${selectorGroups.length}: [${selectors.join(', ')}]`);
        
        for (const selector of selectors) {
          try {
            console.log(`🎯 Waiting for selector: ${selector}`);
            await page.waitForSelector(selector, { 
              timeout: contentTimeout,
              visible: false // Don't require visibility, just presence in DOM
            });
            console.log(`✅ Found content with selector: ${selector}`);
            contentLoaded = true;
            break;
          } catch (selectorError) {
            console.log(`⏭️ Selector ${selector} not found, trying next...`);
          }
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
          // Check if video already exists in database  
          const existingVideo = await this.prisma.historyVideo.findUnique({
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

          // Create the video record with unique constraint error handling
          try {
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
          } catch (createError) {
            // Handle unique constraint errors (likely database sequence corruption)
            if (createError.message && createError.message.includes('Unique constraint failed')) {
              console.warn(`Unique constraint error for video: ${videoUrl} - ${createError.message}`);
              console.warn('This may indicate database auto-increment sequence corruption in production');
              
              // Try to handle gracefully - check if it's a URL duplicate
              const existingVideo = await this.prisma.historyVideo.findUnique({
                where: { url: videoUrl }
              });
              
              if (existingVideo) {
                console.log(`Video already exists in database: ${videoUrl}`);
                videosSkipped++;
              } else {
                console.error(`Unique constraint error on non-URL field for: ${videoUrl}`);
                console.error('Database auto-increment sequence may need to be reset');
                errors++;
              }
            } else {
              // Re-throw other errors
              throw createError;
            }
          }
          
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
      console.error('❌ Error scraping channel videos:', error.message);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Environment info:', {
        NODE_ENV: process.env.NODE_ENV,
        platform: process.platform,
        browserPath: browserPath || 'not found',
        hasPage: !!page,
        hasBrowser: !!browser,
        channelUrl
      });
      
      // Enhanced browser cleanup for production stability
      if (page && !page.isClosed()) {
        try {
          console.log('🧹 Closing page...');
          await page.close();
        } catch (pageCloseError) {
          console.error('⚠️ Error closing page:', pageCloseError.message);
        }
      }
      
      if (browser) {
        try {
          console.log('🧹 Closing browser...');
          // Get all pages first to close them individually
          const pages = await browser.pages();
          for (const p of pages) {
            if (!p.isClosed()) {
              try {
                await p.close();
              } catch (e) {
                console.warn('⚠️ Error closing individual page:', e.message);
              }
            }
          }
          
          // Close the browser
          await browser.close();
          console.log('✅ Browser closed successfully');
        } catch (browserCloseError) {
          console.error('⚠️ Error closing browser:', browserCloseError.message);
          
          // Force kill browser process if needed
          try {
            const browserProcess = browser.process();
            if (browserProcess && !browserProcess.killed) {
              console.log('🔪 Force killing browser process...');
              browserProcess.kill('SIGKILL');
            }
          } catch (killError) {
            console.error('⚠️ Error force killing browser:', killError.message);
          }
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

      // Ensure we get the response as UTF-8 text
      const buffer = await response.arrayBuffer();
      const html = new TextDecoder('utf-8').decode(buffer);
      
      // Extract channel information with proper Unicode support
      const titleMatch = html.match(/<title[^>]*>([^<]*?)<\/title>/i);
      let channelName = titleMatch ? titleMatch[1] : 'Unknown Channel';
      
      if (channelName && channelName !== 'Unknown Channel') {
        channelName = channelName.replace(/ - YouTube$/i, '').trim();
        channelName = this.decodeHtmlEntities(channelName);
      }

      const descriptionMatch = html.match(/<meta\s+name="description"\s+content="([^"]*?)"/i);
      let channelDescription = descriptionMatch ? descriptionMatch[1] : '';
      
      if (channelDescription) {
        channelDescription = this.decodeHtmlEntities(channelDescription);
      }

      const imageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
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