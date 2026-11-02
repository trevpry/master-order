const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

const cleanText = (text) => (text || '').replace(/\s+/g, ' ').trim();

const absoluteUrl = (src) => {
  if (!src) return null;
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('/')) return `https://gay.aebn.com${src}`;
  return src;
};

// "16:13" / "01:29:57" -> seconds
function parseClockToSeconds(text) {
  const match = (text || '').match(/(\d{1,3}):(\d{2})(?::(\d{2}))?/);
  if (!match) return null;
  const parts = [match[1], match[2], match[3]].filter(p => p !== undefined).map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

const formatSeconds = (seconds) => {
  if (seconds == null) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

// AEBN scene metadata looks like "16:13 (SD-480p)"
function parseAebnDuration(text) {
  const raw = cleanText(text);
  const durationSeconds = parseClockToSeconds(raw);
  const qualityMatch = raw.match(/\(([^)]+)\)/);
  return {
    duration: formatSeconds(durationSeconds),
    durationSeconds,
    quality: qualityMatch ? qualityMatch[1].trim() : null
  };
}

const listFromLinks = ($, $container) => {
  const names = [];
  $container.find('a').each((i, a) => {
    const name = cleanText($(a).text()).replace(/,\s*$/, '');
    if (name && !names.includes(name)) names.push(name);
  });
  return names;
};

/**
 * Parse an AEBN movie page (after the age gate) into movie metadata and its scene list.
 */
function parseAebnMoviePage(html) {
  const $ = cheerio.load(html);

  // Detail list items are "Label: value" (Studio, Released, Director, Quality, Running Time, Stars, ...)
  const detailItems = {};
  $('.dts-section-page-detail-info li, ul.section-detail-list li').each((i, li) => {
    const $li = $(li);
    const label = cleanText($li.find('.section-detail-list-item-title').first().text() || $li.text().split(':')[0])
      .replace(/:$/, '')
      .toLowerCase();
    if (label && !detailItems[label]) detailItems[label] = $li;
  });
  const detailValue = (...labels) => {
    for (const label of labels) {
      const $li = detailItems[label];
      if ($li) {
        const text = cleanText($li.text());
        const value = text.includes(':') ? text.slice(text.indexOf(':') + 1).trim() : text;
        if (value) return value;
      }
    }
    return '';
  };

  const movieTitle = cleanText($('.dts-section-page-heading-title h1').first().text()) ||
                     cleanText($('h1.dts-movie-title').first().text()) ||
                     cleanText($('title').text().split('|')[0]);

  const studioName = cleanText($('.dts-studio-name a').first().text()) ||
                     (detailItems.studio ? cleanText(detailItems.studio.find('a').first().text()) : '') ||
                     detailValue('studio') ||
                     cleanText($('a[href*="/gay/studios/"]').first().text());

  const releaseDate = normalizeDate(
    cleanText($('.dts-release-date').text()).replace(/Released?:?\s*/i, '') ||
    detailValue('released', 'release date')
  );

  const director = cleanText($('.dts-director-name a').first().text()) ||
                   (detailItems.director ? listFromLinks($, detailItems.director).join(', ') : '') ||
                   detailValue('director', 'directors');

  const synopsis = cleanText($('.dts-section-page-detail-description-body').first().text()) ||
                   cleanText($('.dts-movie-description').text());

  const boxCover = $('.dts-section-page-detail-main-image-wrapper img').first().attr('src') ||
                   $('img.dts-movie-boxcover').attr('src') ||
                   $('img[src*="/BoxCovers/"]').first().attr('src') ||
                   $('meta[property="og:image"]').attr('content');
  // Drop the "?s=293w" resize hint to get the full-size cover
  const fixedMovieImage = absoluteUrl(boxCover ? boxCover.replace(/\?s=\d+[wh]$/, '') : null);
  const backCover = $('img.dts-modal-boxcover-back').first().attr('src');
  const backImage = absoluteUrl(backCover ? backCover.replace(/\?s=\d+[wh]$/, '') : null);

  const runningTimeSeconds = parseClockToSeconds(detailValue('running time', 'runtime', 'length'));
  const quality = detailValue('quality') || null;
  const moviePerformers = detailItems.stars ? listFromLinks($, detailItems.stars) : [];

  // Each scene is in a <section> tag with id="scene-XXXXX"
  const scenes = [];
  $('section[id^="scene-"]').each((i, elem) => {
    const $scene = $(elem);
    const sceneId = $scene.attr('id');

    const sceneTitle = cleanText($scene.find('.dts-panel-header-title-no-link').first().text()) ||
                       cleanText($scene.find('.dts-panel-header-title h1 span').first().text()) ||
                       cleanText($scene.find('h1').first().text()).replace(/\s+\d{1,3}:\d{2}.*$/, '');

    const sceneNumberMatch = sceneTitle.match(/Scene\s+(\d+)/i);
    const sceneNumber = sceneNumberMatch ? parseInt(sceneNumberMatch[1], 10) : i + 1;

    const timing = parseAebnDuration(
      $scene.find('.dts-scene-title-metadata span').first().text() ||
      $scene.find('.dts-scene-title-metadata').first().text()
    );

    // Format 1 (older): <span class="dts-scene-star-wrapper"> <a href="/gay/stars/...">Name</a>
    // Format 2 (newer): <a class="dts-movie-star-wrapper dts-text-link" href="/gay/stars/..."><span>Name</span></a>
    const scenePerformersList = [];
    const addPerformer = (name) => {
      const clean = cleanText(name);
      if (clean && !scenePerformersList.includes(clean)) scenePerformersList.push(clean);
    };
    $scene.find('a.dts-movie-star-wrapper.dts-text-link span').each((j, el) => addPerformer($(el).text()));
    if (scenePerformersList.length === 0) {
      $scene.find('.dts-scene-star-wrapper a.dts-text-link').each((j, el) => addPerformer($(el).text()));
    }

    // Prefer the 5th thumbnail for a better scene representation
    const thumbnails = $scene.find('img[src*="/dis/t/"]');
    const sceneImage = absoluteUrl(
      thumbnails.length >= 5 ? thumbnails.eq(4).attr('src') : thumbnails.first().attr('src')
    ) || fixedMovieImage;

    const sexActs = [];
    const positions = [];
    const settings = [];
    const collectTags = ($el, linkSelector) => {
      const label = $el.find('.section-detail-list-item-title').text().trim();
      const target = label.includes('Sex acts:') ? sexActs
        : label.includes('Positions:') ? positions
          : label.includes('Settings:') ? settings
            : null;
      if (!target) return;
      $el.find(linkSelector).each((k, a) => {
        const tag = cleanText($(a).text()).replace(/,\s*$/, '');
        if (tag && !target.includes(tag)) target.push(tag);
      });
    };
    // Format 1: tags in <li> elements (older); Format 2: .scene-strip-meta-data divs (newer)
    $scene.find('li').each((j, li) => collectTags($(li), 'a'));
    $scene.find('.scene-strip-meta-data > div').each((j, div) => collectTags($(div), 'a.dts-text-link'));

    scenes.push({
      id: sceneId,
      title: sceneTitle,
      number: sceneNumber,
      duration: timing.duration,
      durationSeconds: timing.durationSeconds,
      quality: timing.quality,
      performers: scenePerformersList,
      image: sceneImage,
      sexActs,
      positions,
      settings
    });
  });

  return {
    movieTitle,
    studioName,
    releaseDate,
    director,
    synopsis,
    fixedMovieImage,
    backImage,
    runningTimeSeconds,
    quality,
    moviePerformers,
    scenes
  };
}

// AEBN shows dates like "Jan 05, 2021" or "01/05/2021"; Stash wants YYYY-MM-DD
function normalizeDate(text) {
  const value = cleanText(text);
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    const pad = n => String(n).padStart(2, '0');
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return value;
}

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
      const {
        movieTitle,
        studioName,
        releaseDate,
        director,
        synopsis,
        fixedMovieImage,
        backImage,
        runningTimeSeconds,
        quality,
        moviePerformers,
        scenes
      } = parseAebnMoviePage(html);

      console.log(`   - Movie: ${movieTitle}`);
      console.log(`   - Studio: ${studioName}`);
      scenes.forEach(scene => {
        const perfs = scene.performers.length > 0 ? `performers: ${scene.performers.join(', ')}` : 'no performers listed';
        console.log(`   - Found scene: ${scene.title} (number: ${scene.number}, length: ${scene.duration || '?'}) - ${perfs}`);
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
        moviePerformers.forEach(performer => allPerformersSet.add(performer));
        const allPerformers = Array.from(allPerformersSet);
        const sceneSeconds = scenes.reduce((total, scene) => total + (scene.durationSeconds || 0), 0);
        const totalSeconds = runningTimeSeconds || sceneSeconds || null;
        
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
            durationSeconds: scene.durationSeconds,
            quality: scene.quality,
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
          // Group (movie) field names used by the group scrape review
          name: movieTitle || null,
          synopsis: synopsis || null,
          front_image: fixedMovieImage || null,
          back_image: backImage || null,
          duration: totalSeconds,
          quality: quality,
          sceneCount: scenes.length,
          externalUrls: [url],
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
module.exports.parseAebnMoviePage = parseAebnMoviePage;
module.exports.parseAebnDuration = parseAebnDuration;
module.exports.parseClockToSeconds = parseClockToSeconds;
