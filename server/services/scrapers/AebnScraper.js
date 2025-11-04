const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class AebnScraper {
  constructor() {
    this.siteName = 'AEBN';
    this.sceneUrlPatterns = [
      'aebn.com',
      'gay.aebn.com'
    ];
  }

  /**
   * Check if this scraper can handle the given URL
   */
  canHandle(url) {
    if (!url) return false;
    return this.sceneUrlPatterns.some(pattern => url.includes(pattern));
  }

  /**
   * Scrape scene data from AEBN movie page using Puppeteer
   * AEBN shows MOVIES with multiple SCENES. We need to:
   * 1. Fetch the movie page
   * 2. Extract all scenes from sections with id="scene-*"
   * 3. Either:
   *    a) If sceneNumber provided: Use that specific scene directly
   *    b) If scenePerformers provided: Match the correct scene by comparing performers
   * 4. Return only the matched scene's data
   * 
   * @param {string} url - AEBN movie URL
   * @param {Array} scenePerformers - Performers to match (pass null if using sceneNumber)
   * @param {number} sceneNumber - Specific scene number to scrape (e.g., 1, 2, 3)
   */
  async scrape(url, scenePerformers = [], sceneNumber = null) {
    console.log(`🔍 [AEBN Scraper] Scraping movie URL: ${url}`);
    
    if (sceneNumber) {
      console.log(`   - Direct scene number: ${sceneNumber}`);
    } else if (scenePerformers && scenePerformers.length > 0) {
      console.log(`   - Looking for scene with performers:`, scenePerformers.map(p => p.name || p));
    } else {
      console.log(`   - ⚠️ No scene number or performers provided`);
    }

    let browser = null;
    
    try {
      // Launch Puppeteer in headless mode
      console.log(`   - Launching browser...`);
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });

      const page = await browser.newPage();
      
      // Set viewport and user agent
      await page.setViewport({ width: 1920, height: 1080 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      console.log(`   - Navigating to page...`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Check if age gate is present
      const ageGateButton = await page.$('a.button.enter, a[href*="gate-redirect"]');
      
      if (ageGateButton) {
        console.log(`   - Age gate detected, clicking Enter button...`);
        
        // Click the age verification button
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
          ageGateButton.click()
        ]);
        
        console.log(`   - Age gate bypassed successfully`);
      } else {
        console.log(`   - No age gate detected`);
      }

      // Wait a bit for content to load using setTimeout wrapped in Promise
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get the page HTML
      const html = await page.content();
      await browser.close();
      browser = null;

      console.log(`   - Page content loaded, parsing HTML...`);
      const $ = cheerio.load(html);

      // Extract movie-level data
      const movieTitle = $('.dts-section-page-heading-title h1').first().text().trim() ||
                         $('h1.dts-movie-title').first().text().trim() ||
                         $('title').text().split('|')[0].trim();
      
      const studioName = $('.dts-studio-name a').first().text().trim() ||
                         $('a[href*="/gay/studios/"]').first().text().trim();
      
      const releaseDate = $('.dts-release-date').text().replace(/Released?:?\s*/i, '').trim();
      
      const director = $('.dts-director-name a').first().text().trim();

      const synopsis = $('.dts-movie-description').text().trim();

      const movieImage = $('img.dts-movie-boxcover').attr('src') ||
                        $('meta[property="og:image"]').attr('content');
      
      // Fix protocol-relative URLs (//pic.aebn.net/...) by adding https:
      const fixedMovieImage = movieImage && movieImage.startsWith('//') ? `https:${movieImage}` : movieImage;

      console.log(`   - Movie: ${movieTitle}`);
      console.log(`   - Studio: ${studioName}`);

      // Extract ALL scenes from the page
      // Each scene is in a <section> tag with id="scene-XXXXX"
      const scenes = [];
      
      $('section[id^="scene-"]').each((i, elem) => {
        const $scene = $(elem);
        const sceneId = $scene.attr('id'); // e.g., "scene-977220"
        
        // Get scene title from header (e.g., "Scene 1", "Scene 2")
        // First try the specific no-link span for more accurate scene number
        const sceneTitle = $scene.find('.dts-panel-header-title-no-link').first().text().trim() ||
                          $scene.find('.dts-panel-header-title h1 span').first().text().trim() || 
                          $scene.find('h1').first().text().trim();
        
        // Extract just the scene number from "Scene 1" -> 1
        const sceneNumberMatch = sceneTitle.match(/Scene\s+(\d+)/i);
        const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[1]) : null;
        
        // Get scene duration metadata if available
        const sceneDuration = $scene.find('.dts-scene-title-metadata span').text().trim();
        
        // Extract performers from this specific scene
        // Format 1 (older): <span class="dts-scene-star-wrapper"> <a href="/gay/stars/...">Name</a>
        // Format 2 (newer): <a class="dts-movie-star-wrapper dts-text-link" href="/gay/stars/..."><span>Name</span></a>
        const scenePerformersList = [];
        
        // Try newer format first: a.dts-movie-star-wrapper > span
        $scene.find('a.dts-movie-star-wrapper.dts-text-link span').each((j, perfElem) => {
          const perfName = $(perfElem).text().trim();
          if (perfName && !scenePerformersList.includes(perfName)) {
            scenePerformersList.push(perfName);
          }
        });
        
        // If no performers found, try older format: .dts-scene-star-wrapper a
        if (scenePerformersList.length === 0) {
          $scene.find('.dts-scene-star-wrapper a.dts-text-link').each((j, perfElem) => {
            const perfName = $(perfElem).text().trim();
            if (perfName && !scenePerformersList.includes(perfName)) {
              scenePerformersList.push(perfName);
            }
          });
        }
        
        // Get scene image (5th thumbnail for better scene representation)
        const thumbnails = $scene.find('img[src*="/dis/t/"]');
        let sceneImage = thumbnails.length >= 5 ? 
                          thumbnails.eq(4).attr('src') : // Use 5th thumbnail (index 4)
                          (thumbnails.first().attr('src') || fixedMovieImage); // Fallback to first or movie image
        
        // Fix protocol-relative URLs (//pic.aebn.net/...) by adding https:
        if (sceneImage && sceneImage.startsWith('//')) {
          sceneImage = `https:${sceneImage}`;
        }
        
        // Get sex acts, positions, settings
        const sexActs = [];
        const positions = [];
        const settings = [];
        
        // Format 1: Tags in <li> elements (older format)
        $scene.find('li').each((j, li) => {
          const $li = $(li);
          const label = $li.find('.section-detail-list-item-title').text().trim();
          
          if (label.includes('Sex acts:')) {
            $li.find('a').each((k, a) => {
              const act = $(a).text().trim().replace(/,\s*$/, '');
              if (act) sexActs.push(act);
            });
          } else if (label.includes('Positions:')) {
            $li.find('a').each((k, a) => {
              const pos = $(a).text().trim().replace(/,\s*$/, '');
              if (pos) positions.push(pos);
            });
          } else if (label.includes('Settings:')) {
            $li.find('a').each((k, a) => {
              const setting = $(a).text().trim().replace(/,\s*$/, '');
              if (setting) settings.push(setting);
            });
          }
        });
        
        // Format 2: Tags in .scene-strip-meta-data div (newer format)
        $scene.find('.scene-strip-meta-data > div').each((j, div) => {
          const $div = $(div);
          const label = $div.find('.section-detail-list-item-title').text().trim();
          
          if (label.includes('Sex acts:')) {
            $div.find('a.dts-text-link').each((k, a) => {
              const act = $(a).text().trim();
              if (act && !sexActs.includes(act)) sexActs.push(act);
            });
          } else if (label.includes('Positions:')) {
            $div.find('a.dts-text-link').each((k, a) => {
              const pos = $(a).text().trim();
              if (pos && !positions.includes(pos)) positions.push(pos);
            });
          } else if (label.includes('Settings:')) {
            $div.find('a.dts-text-link').each((k, a) => {
              const setting = $(a).text().trim();
              if (setting && !settings.includes(setting)) settings.push(setting);
            });
          }
        });

        // Add scene even if no performers (some AEBN scenes don't list performers)
        scenes.push({
          id: sceneId,
          title: sceneTitle,
          number: sceneNumber,
          duration: sceneDuration,
          performers: scenePerformersList,
          image: sceneImage,
          sexActs: sexActs,
          positions: positions,
          settings: settings
        });
        
        if (scenePerformersList.length > 0) {
          console.log(`   - Found scene: ${sceneTitle} (number: ${sceneNumber}) with performers: ${scenePerformersList.join(', ')}`);
        } else {
          console.log(`   - Found scene: ${sceneTitle} (number: ${sceneNumber}) - no performers listed`);
        }
      });

      console.log(`   - Extracted ${scenes.length} scenes from movie page`);

      // If no scenes found, return error
      if (scenes.length === 0) {
        console.log(`   ⚠️ No scenes found in movie page`);
        return {
          success: false,
          error: 'No scenes found on AEBN movie page'
        };
      }

      // Match scene: either by scene number (direct) or return all scenes for backend matching
      let matchedScene = null;
      let matchScore = 0; // Initialize match score
      
      if (sceneNumber) {
        // Direct scene selection by number (used for single scene scraping from scene detail page)
        console.log(`   - Looking for scene with number: ${sceneNumber}`);
        
        matchedScene = scenes.find(scene => scene.number === sceneNumber);
        
        if (matchedScene) {
          console.log(`   ✓ Found scene by number: "${matchedScene.title}" (Scene ${matchedScene.number})`);
          matchScore = 1.0; // Perfect match when scene is found by number
        } else {
          console.log(`   ⚠️ No scene found with number ${sceneNumber}`);
          console.log(`   - Available scene numbers: ${scenes.map(s => s.number).join(', ')}`);
          return {
            success: false,
            error: `Scene ${sceneNumber} not found on AEBN page. Available scenes: ${scenes.map(s => s.number).join(', ')}`
          };
        }
      } else {
        // When scraping from movie page (with or without performers), always return all scenes
        // for the backend to do hybrid matching (performers + scene numbers)
        console.log(`   ℹ️ Movie page scraping - returning all scenes for backend hybrid matching`);
        matchedScene = null; // Force return of all scenes
      }
      
      // If no matched scene (movie page scraping), return movie metadata with all scenes
      if (!matchedScene) {
        console.log(`   ℹ️ Returning movie metadata with all ${scenes.length} scenes for backend matching`);
        
        // Collect all unique performers from all scenes
        const allPerformersSet = new Set();
        scenes.forEach(scene => {
          scene.performers.forEach(performer => {
            allPerformersSet.add(performer);
          });
        });
        const allPerformers = Array.from(allPerformersSet);
        
        console.log(`   - Collected ${allPerformers.length} unique performers from ${scenes.length} scenes`);
        
        // Format all scenes with full metadata for matching
        const formattedScenes = scenes.map(scene => {
          const allTags = [
            ...scene.sexActs,
            ...scene.positions,
            ...scene.settings
          ];
          
          return {
            sceneNumber: scene.number,
            title: scene.title,
            duration: scene.duration,
            performers: scene.performers.map(name => ({ name })),
            tags: allTags.map(tag => ({ name: tag })),
            image: scene.image,
            details: synopsis || '', // Use movie synopsis for all scenes
            _raw: {
              id: scene.id,
              sexActs: scene.sexActs,
              positions: scene.positions,
              settings: scene.settings
            }
          };
        });
        
        // Return movie-level metadata with all scenes for matching
        const metadata = {
          title: movieTitle || null,
          details: synopsis || '',
          date: releaseDate || null,
          director: director || null,
          studio: studioName || null,
          image: fixedMovieImage || null,
          performers: allPerformers.map(name => ({ name })), // All performers from all scenes
          tags: [], // No movie-level tags
          movies: movieTitle ? [{
            name: movieTitle,
            url: url,
            date: releaseDate,
            studio: studioName
          }] : [],
          // Include all scenes with full metadata for backend matching
          allScenes: formattedScenes,
          _debug: {
            totalScenes: scenes.length,
            totalPerformers: allPerformers.length,
            reason: 'No scene matching criteria provided - returned movie metadata with all scenes'
          }
        };

        console.log(`   ✓ Returning movie metadata:`, {
          title: metadata.title,
          studio: metadata.studio,
          date: metadata.date,
          performers: metadata.performers.length,
          scenes: metadata.allScenes.length
        });

        return {
          success: true,
          scraped: metadata, // Use 'scraped' key to match expected format
          source: this.siteName,
          sourceUrl: url
        };
      }

      // Build tags from sex acts, positions, and settings
      const allTags = [
        ...matchedScene.sexActs,
        ...matchedScene.positions,
        ...matchedScene.settings
      ];

      // Build the scraped metadata in standard format
      const metadata = {
        title: `${movieTitle} - ${matchedScene.title}`,
        details: synopsis || '',
        date: releaseDate || null,
        director: director || null,
        studio: studioName || null,
        image: matchedScene.image || fixedMovieImage,
        performers: matchedScene.performers.map(name => ({ name })),
        tags: allTags.map(tag => ({ name: tag })),
        movies: movieTitle ? [{
          name: movieTitle,
          url: url,
          date: releaseDate,
          studio: studioName,
          sceneNumber: matchedScene.number  // Add scene number to movie metadata
        }] : [],
        _debug: {
          totalScenes: scenes.length,
          matchScore: matchScore,
          matchedSceneId: matchedScene.id,
          matchedSceneTitle: matchedScene.title,
          allScenes: scenes.map(s => ({
            title: s.title,
            performers: s.performers
          }))
        }
      };

      console.log(`   ✓ Scraped AEBN scene:`, {
        title: metadata.title,
        performers: metadata.performers.length,
        studio: metadata.studio?.name,
        matched: !!matchedScene,
        totalScenes: scenes.length
      });

      return {
        success: true,
        scraped: metadata,
        source: this.siteName,
        sourceUrl: url
      };

    } catch (error) {
      console.error(`❌ [AEBN Scraper] Error:`, error.message);
      if (error.response) {
        console.error(`   - Status: ${error.response.status}`);
        console.error(`   - Status Text: ${error.response.statusText}`);
      }
      
      // Ensure browser is closed on error
      if (browser) {
        try {
          await browser.close();
          console.log(`   - Browser closed after error`);
        } catch (closeError) {
          console.error(`   - Error closing browser:`, closeError.message);
        }
      }
      
      return {
        success: false,
        error: `Failed to scrape AEBN: ${error.message}`
      };
    }
  }
}

module.exports = AebnScraper;
