/**
 * GEVI Scraper Service
 * Handles scraping metadata from Gay Erotic Video Index (GEVI)
 * Based on the Stash GEVI.py scraper implementation
 */

const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

class GeviScraperService {
  constructor() {
    this.baseUrl = 'https://gayeroticvideoindex.com';
    this.client = axios.create({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://gayeroticvideoindex.com'
      },
      timeout: 30000
    });
  }

  /**
   * Convert relative URL to absolute URL
   * @param {string} url - The URL to convert
   * @returns {string} Absolute URL
   */
  absUrl(url) {
    if (url.startsWith('http')) {
      return url;
    }
    return `${this.baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  /**
   * Extract name with URL from a link element
   * @param {cheerio.Cheerio} link - Cheerio link element
   * @returns {Object} Object with name and optional URL
   */
  nameWithUrl($, link) {
    const name = $(link).text().trim();
    const href = $(link).attr('href');
    const result = { name };
    if (href) {
      result.url = this.absUrl(href);
    }
    return result;
  }

  /**
   * Extract value from table-like structure
   * @param {cheerio.CheerioAPI} $ - Cheerio instance
   * @param {cheerio.Cheerio} soup - Section to search in
   * @param {string} key - The key to search for
   * @returns {string|null} The value or null
   */
  fromTable($, soup, key) {
    const keyDiv = soup.find(`div:contains("${key}")`).first();
    if (keyDiv.length) {
      const valueDiv = keyDiv.next('div');
      if (valueDiv.length) {
        return valueDiv.text().trim();
      }
    }
    return null;
  }

  /**
   * Scrape scene metadata from a GEVI URL
   * @param {string} url - The GEVI episode URL
   * @returns {Promise<Object>} Scraped metadata
   */
  async scrapeScene(url) {
    console.log('🔍 [GEVI] Starting scrape for:', url);
    
    try {
      // Validate URL
      if (!url.includes('gayeroticvideoindex.com/episode/')) {
        throw new Error('Invalid GEVI URL. Expected format: https://gayeroticvideoindex.com/episode/[id]');
      }

      console.log('   - Fetching page...');
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      // Find the main data section
      const section = $('div#data section').first();
      if (!section.length) {
        throw new Error('Cannot find episode section on page');
      }

      console.log('   - Extracting metadata...');
      
      const metadata = {
        title: null,
        studio: null,
        performers: [],
        date: null,
        details: null,
        url: url
      };

      // Extract title (h1)
      const titleEl = section.find('h1').first();
      if (titleEl.length) {
        metadata.title = titleEl.text().trim();
      }

      // Extract image
      const imageEl = section.find('img[src*="Episodes"]').first();
      if (imageEl.length) {
        metadata.image = this.absUrl(imageEl.attr('src'));
      }

      // Extract details/description (first paragraph)
      const detailsEl = section.find('p').first();
      if (detailsEl.length) {
        metadata.details = detailsEl.text().trim();
      }

      // Extract date - the date is in the text node after the "Date:" span
      const dateDiv = section.find('span:contains("Date:")').parent();
      if (dateDiv.length) {
        // Get the full text of the parent div and extract the date
        const fullText = dateDiv.text();
        // Remove "Date:" and trim to get just the date
        const dateText = fullText.replace('Date:', '').trim();
        if (dateText) {
          metadata.date = dateText;
        }
      }

      // Extract performers (links containing "performer") with action codes
      const performerLinks = section.find('a[href*="performer"]');
      metadata.performers = [];
      performerLinks.each((i, link) => {
        const performer = this.nameWithUrl($, link);
        performer.gender = 'MALE';
        
        // Try to find the action code in the 3rd td of the same row
        const row = $(link).closest('tr');
        if (row.length) {
          // Get all td elements in this row
          const tds = row.find('td');
          if (tds.length >= 3) {
            // 3rd td (index 2) contains the action code
            const actionCode = $(tds[2]).text().trim();
            if (actionCode && actionCode !== '&nbsp;') {
              performer.actionCode = actionCode;
            }
          }
        }
        
        metadata.performers.push(performer);
      });

      // Extract studio (link containing "company")
      const studioLink = section.find('a[href*="company"]').first();
      if (studioLink.length) {
        metadata.studio = this.nameWithUrl($, studioLink).name;
      }

      console.log('   - Metadata extracted:', JSON.stringify(metadata, null, 2));

      return {
        success: true,
        metadata,
        source: 'GEVI',
        sourceUrl: url
      };

    } catch (error) {
      console.error('❌ [GEVI] Scraping failed:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'GEVI',
        sourceUrl: url
      };
    }
  }

  /**
   * Match scraped performers against database performers (with alternatives)
   * @param {Array<Object|string>} scrapedPerformers - Array of performer objects or names from scrape
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Matched and unmatched performers with alternatives
   */
  async matchPerformers(scrapedPerformers, prisma) {
    const matched = [];
    const unmatched = [];

    // Get all performers once for efficiency
    const allPerformers = await prisma.stashPerformer.findMany();

    for (const performer of scrapedPerformers) {
      // Extract name from object or use string directly
      const performerName = typeof performer === 'string' ? performer : performer.name;
      
      // Search by name (SQLite-compatible - filter in JS)
      const normalizedName = performerName.toLowerCase().replace(/\s+/g, '');
      
      // Find all matches with scores
      const foundMatches = [];
      
      for (const dbPerformer of allPerformers) {
        const dbNormalized = dbPerformer.name.toLowerCase().replace(/\s+/g, '');
        
        // Check if performer name contains or is contained in scraped name
        let score = 0;
        let matchedVia = 'name';
        let matchedText = dbPerformer.name;
        
        // Exact match
        if (dbNormalized === normalizedName) {
          score = 1.0;
        }
        // Check if scraped name contains db name
        else if (normalizedName.includes(dbNormalized)) {
          score = dbNormalized.length / normalizedName.length;
        }
        // Check if db name contains scraped name
        else if (dbNormalized.includes(normalizedName)) {
          score = normalizedName.length / dbNormalized.length;
        }
        // Check aliases
        else if (dbPerformer.alias) {
          const aliases = dbPerformer.alias.split(',').map(a => a.trim());
          for (const alias of aliases) {
            const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '');
            if (normalizedAlias === normalizedName || normalizedName.includes(normalizedAlias)) {
              score = normalizedAlias.length / normalizedName.length;
              matchedVia = 'alias';
              matchedText = alias;
              break;
            }
          }
        }
        
        // Only include if score is above threshold
        if (score > 0.6) {
          foundMatches.push({
            performer: dbPerformer,
            score,
            matchedVia,
            matchedText
          });
        }
      }

      // Sort by score (best match first)
      foundMatches.sort((a, b) => b.score - a.score);

      if (foundMatches.length > 0) {
        // Best match
        const bestMatch = foundMatches[0];
        
        // Alternatives are other matches (excluding best)
        const alternatives = foundMatches.slice(1).map(m => ({
          id: m.performer.id,
          name: m.performer.name,
          matchedVia: m.matchedVia,
          matchedAlias: m.matchedVia === 'alias' ? m.matchedText : null
        }));

        matched.push({
          id: bestMatch.performer.id,
          name: bestMatch.performer.name,
          matchedVia: bestMatch.matchedVia,
          matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
          alternatives: alternatives,
          originalName: performerName  // Store the original scraped name
        });
      } else {
        // No match found
        unmatched.push(performerName);
      }
    }

    return { matched, unmatched };
  }

  /**
   * Match scraped studio against database studios
   * @param {string} scrapedStudio - Studio name from scrape
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Matched studio or null
   */
  async matchStudio(scrapedStudio, prisma) {
    if (!scrapedStudio) return null;

    const normalizedName = scrapedStudio.toLowerCase().replace(/\s+/g, '');

    // Get all studios and filter client-side for SQLite compatibility
    const allStudios = await prisma.stashStudio.findMany();
    
    // Filter by name contains (case-insensitive)
    const studios = allStudios.filter(s => 
      s.name.toLowerCase().includes(scrapedStudio.toLowerCase())
    );

    // Find best match
    let bestMatch = null;
    let bestScore = 0;

    for (const studio of studios) {
      const dbNormalized = studio.name.toLowerCase().replace(/\s+/g, '');
      
      // Exact match
      if (dbNormalized === normalizedName) {
        return {
          scrapedName: scrapedStudio,
          id: studio.id,
          name: studio.name,
          matchScore: 1
        };
      }

      // Partial match score
      const score = normalizedName.length > 0
        ? Math.min(normalizedName.length, dbNormalized.length) / Math.max(normalizedName.length, dbNormalized.length)
        : 0;
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = studio;
      }
    }

    if (bestMatch && bestScore > 0.7) {
      return {
        scrapedName: scrapedStudio,
        id: bestMatch.id,
        name: bestMatch.name,
        matchScore: bestScore
      };
    }

    return null;
  }

  /**
   * Search for a performer on GEVI
   * @param {string} name - Performer name to search for
   * @returns {Promise<Array>} Array of matching performers with name and URL
   */
  async searchPerformer(name) {
    try {
      console.log(`🔍 Searching GEVI for performer: "${name}"`);
      
      const searchParams = new URLSearchParams({
        draw: '2',
        start: '0',
        length: '10',
        'search[value]': name,
        'search[regex]': 'false'
      });

      const searchUrl = `${this.baseUrl}/shpr?${searchParams.toString()}`;
      
      const response = await axios.get(searchUrl, {
        headers: {
          'Referer': this.baseUrl,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      // Parse the JSON response
      const results = response.data.data || [];
      
      // Each result is an array where result[1] contains HTML with the performer link
      const performers = results.map(result => {
        const html = result[1]; // Second element contains the HTML
        const $ = cheerio.load(html);
        const link = $('a').first();
        
        const href = link.attr('href');
        const url = href?.startsWith('/') ? `${this.baseUrl}${href}` : `${this.baseUrl}/${href}`;
        
        return {
          name: link.text().trim(),
          url: url
        };
      }).filter(p => p.name && p.url);

      console.log(`✅ Found ${performers.length} performers matching "${name}"`);
      return performers;

    } catch (error) {
      console.error('❌ Error searching GEVI performer:', error.message);
      throw error;
    }
  }

  /**
   * Search for scenes on a GEVI performer page
   * @param {string} performerUrl - URL of the first performer
   * @param {Object} secondPerformer - Performer object with name and alias fields
   * @returns {Promise<Array>} Array of matching scene URLs
   */
  async searchScenesWithPerformers(performerUrl, secondPerformer) {
    let browser = null;
    
    try {
      const secondPerformerName = secondPerformer.name;
      console.log(`🔍 Loading performer page: ${performerUrl}`);
      console.log(`🔍 Will search for second performer: "${secondPerformerName}"`);
      
      // Launch Puppeteer to handle JavaScript-rendered content
      console.log(`   - Launching browser...`);
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      console.log(`   - Navigating to performer page...`);
      await page.goto(performerUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      console.log(`   - Waiting for episodes table to render...`);
      // Wait for the DataTable to be initialized and populated
      await page.waitForSelector('#episodesDT tbody tr', { timeout: 15000 });
      
      // Wait a bit more to ensure all data is loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log(`   - Extracting all episodes across all pages...`);
      
      // Get total number of pages from DataTable pagination
      const paginationInfo = await page.evaluate(() => {
        const infoText = document.querySelector('#episodesDT_info')?.textContent || '';
        // Text format: "Showing 1 to 25 of 234 entries"
        const match = infoText.match(/of (\d+) entries/);
        const totalEntries = match ? parseInt(match[1]) : 0;
        const entriesPerPage = 25; // Default DataTable page size
        const totalPages = Math.ceil(totalEntries / entriesPerPage);
        
        return {
          totalEntries,
          entriesPerPage,
          totalPages
        };
      });
      
      console.log(`   - Found ${paginationInfo.totalEntries} total episodes across ${paginationInfo.totalPages} pages`);
      
      // Collect HTML from all pages
      let allRowsHtml = '';
      
      for (let pageNum = 1; pageNum <= paginationInfo.totalPages; pageNum++) {
        console.log(`   - Processing page ${pageNum}/${paginationInfo.totalPages}...`);
        
        // Extract current page's rows
        const pageRowsHtml = await page.evaluate(() => {
          const tbody = document.querySelector('#episodesDT tbody');
          return tbody ? tbody.innerHTML : '';
        });
        
        allRowsHtml += pageRowsHtml;
        
        // If not the last page, click "Next" button and wait for table to update
        if (pageNum < paginationInfo.totalPages) {
          try {
            // Click the "Next" button
            await page.evaluate(() => {
              const nextButton = document.querySelector('#episodesDT_next');
              if (nextButton && !nextButton.classList.contains('disabled')) {
                nextButton.click();
              }
            });
            
            // Wait for the table to update (wait for a brief moment)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Wait for new rows to load
            await page.waitForSelector('#episodesDT tbody tr', { timeout: 5000 });
          } catch (navError) {
            console.warn(`   - Warning: Could not navigate to page ${pageNum + 1}:`, navError.message);
            break; // Stop pagination if navigation fails
          }
        }
      }
      
      // Build a complete table HTML with all rows
      const tableHtml = `<table id="episodesDT"><tbody>${allRowsHtml}</tbody></table>`;
      
      await browser.close();
      browser = null;
      
      if (!allRowsHtml) {
        console.warn('⚠️  Could not extract episodes table HTML');
        return [];
      }
      
      const $ = cheerio.load(tableHtml);
      
      console.log(`   - Parsing ${paginationInfo.totalEntries} episodes from all pages`);
      
      // Find the episodes table tbody
      const episodesTable = $('tbody');
      
      // Build list of names to search for (primary name + aliases)
      const searchNames = [secondPerformerName];
      if (secondPerformer.alias) {
        // Alias field might contain comma-separated values
        const aliases = secondPerformer.alias.split(',').map(a => a.trim()).filter(a => a);
        searchNames.push(...aliases);
      }
      
      console.log(`   - Will try names: ${searchNames.join(', ')}`);
      
      // Function to search for scenes with a given name
      const searchWithName = (searchName, matchTitleOnly = false) => {
        const foundScenes = [];
        const normalizedSearchName = searchName.toLowerCase().replace(/\s+/g, '');
        const searchNameParts = searchName.toLowerCase().split(/\s+/);
        
        // Parse all rows in the table
        episodesTable.find('tr').each((i, row) => {
          const $row = $(row);
          
          // Get the image from the first column (td index 0)
          const imageCell = $row.find('td').eq(0);
          const imageTag = imageCell.find('img').first();
          const imageUrl = imageTag.attr('src') || imageTag.attr('data-src') || null;
          
          // Get the title link (3rd td, index 2)
          const titleCell = $row.find('td').eq(2);
          const titleLink = titleCell.find('a').first();
          const title = titleLink.text().trim();
          const href = titleLink.attr('href');
          
          if (!title || !href) return; // Skip if no title/link
          
          // Get the costars cell (7th td, index 6)
          const costarsCell = $row.find('td').eq(6);
          const costarsText = costarsCell.text().trim();
          
          const titleLower = title.toLowerCase();
          
          let isMatch = false;
          
          if (matchTitleOnly) {
            // Only match against title
            isMatch = searchNameParts.every(part => titleLower.includes(part));
          } else {
            // Match against costars
            // Split costars by common separators (comma, ampersand, 'and', 'with', etc.)
            const costarsList = costarsText.split(/[,&]|\band\b|\bwith\b/i)
              .map(c => c.trim().toLowerCase())
              .filter(c => c.length > 0);
            
            // Check if any costar name contains all parts of the search name
            // Example: "Ollie" matches "Ollie Barn", "Javi Xisco" matches "Javi Xisco"
            isMatch = costarsList.some(costar => {
              // Exact match (normalized)
              const normalizedCostar = costar.replace(/\s+/g, '');
              if (normalizedCostar === normalizedSearchName || normalizedCostar.includes(normalizedSearchName)) {
                return true;
              }
              
              // Check if all parts of search name appear in this costar
              // This handles "Javi Xisco" matching "Javi Xisco" even with spaces
              return searchNameParts.every(part => costar.includes(part));
            });
          }
          
          if (isMatch) {
            // Build the full URL
            let url;
            if (href.startsWith('http')) {
              url = href;
            } else if (href.startsWith('/')) {
              url = `${this.baseUrl}${href}`;
            } else {
              url = `${this.baseUrl}/${href}`;
            }
            
            // Build the full image URL
            let fullImageUrl = null;
            if (imageUrl) {
              if (imageUrl.startsWith('http')) {
                fullImageUrl = imageUrl;
              } else if (imageUrl.startsWith('/')) {
                fullImageUrl = `${this.baseUrl}${imageUrl}`;
              } else {
                fullImageUrl = `${this.baseUrl}/${imageUrl}`;
              }
            }
            
            foundScenes.push({
              title: title,
              url: url,
              image: fullImageUrl
            });
          }
        });
        
        return foundScenes;
      };
      
      // Try each name until we find matches
      let scenes = [];
      for (const searchName of searchNames) {
        console.log(`   - Trying name: "${searchName}" in costars`);
        scenes = searchWithName(searchName, false); // Try costars first
        
        if (scenes.length > 0) {
          console.log(`   - Found ${scenes.length} matches in costars with "${searchName}"`);
          break; // Stop trying other names
        }
      }
      
      // If no matches in costars, try matching against titles
      if (scenes.length === 0) {
        console.log(`   - No matches in costars, trying title matching...`);
        for (const searchName of searchNames) {
          console.log(`   - Trying name: "${searchName}" in titles`);
          scenes = searchWithName(searchName, true); // Try title matching
          
          if (scenes.length > 0) {
            console.log(`   - Found ${scenes.length} matches in titles with "${searchName}"`);
            break;
          }
        }
      }
      
      if (scenes.length === 0) {
        console.log(`   - No matches found with any name variant (costars or titles)`);
      }

      console.log(`✅ Found ${scenes.length} scenes with both performers`);
      return scenes;

    } catch (error) {
      console.error('❌ Error searching GEVI scenes:', error.message);
      
      // Ensure browser is closed on error
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Search for scenes on a GEVI performer page by title
   * @param {string} performerUrl - URL of the performer
   * @param {string} sceneTitle - Title to search for
   * @returns {Promise<Array>} Array of matching scene URLs
   */
  async searchScenesByTitle(performerUrl, sceneTitle) {
    let browser = null;
    
    try {
      console.log(`🔍 Loading performer page: ${performerUrl}`);
      console.log(`🔍 Will search for title: "${sceneTitle}"`);
      
      // Launch Puppeteer to handle JavaScript-rendered content
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      await page.goto(performerUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Wait for the DataTable to be initialized and populated
      await page.waitForSelector('#episodesDT tbody tr', { timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get pagination info
      const paginationInfo = await page.evaluate(() => {
        const infoText = document.querySelector('#episodesDT_info')?.textContent || '';
        const match = infoText.match(/of (\d+) entries/);
        const totalEntries = match ? parseInt(match[1]) : 0;
        const entriesPerPage = 25;
        const totalPages = Math.ceil(totalEntries / entriesPerPage);
        
        return { totalEntries, entriesPerPage, totalPages };
      });
      
      console.log(`   - Found ${paginationInfo.totalEntries} total episodes across ${paginationInfo.totalPages} pages`);
      
      // Collect HTML from all pages
      let allRowsHtml = '';
      
      for (let pageNum = 1; pageNum <= paginationInfo.totalPages; pageNum++) {
        const pageRowsHtml = await page.evaluate(() => {
          const tbody = document.querySelector('#episodesDT tbody');
          return tbody ? tbody.innerHTML : '';
        });
        
        allRowsHtml += pageRowsHtml;
        
        if (pageNum < paginationInfo.totalPages) {
          try {
            await page.evaluate(() => {
              const nextButton = document.querySelector('#episodesDT_next');
              if (nextButton && !nextButton.classList.contains('disabled')) {
                nextButton.click();
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            await page.waitForSelector('#episodesDT tbody tr', { timeout: 5000 });
          } catch (navError) {
            console.warn(`   - Warning: Could not navigate to page ${pageNum + 1}`);
            break;
          }
        }
      }
      
      const tableHtml = `<table id="episodesDT"><tbody>${allRowsHtml}</tbody></table>`;
      
      await browser.close();
      browser = null;
      
      if (!allRowsHtml) {
        console.warn('⚠️  Could not extract episodes table HTML');
        return [];
      }
      
      const $ = cheerio.load(tableHtml);
      const episodesTable = $('tbody');
      
      // Normalize the search title for matching
      const normalizedSearchTitle = sceneTitle.toLowerCase().trim();
      const searchTitleParts = normalizedSearchTitle.split(/\s+/);
      
      const foundScenes = [];
      
      episodesTable.find('tr').each((i, row) => {
        const $row = $(row);
        
        // Get the image
        const imageCell = $row.find('td').eq(0);
        const imageTag = imageCell.find('img').first();
        const imageUrl = imageTag.attr('src') || imageTag.attr('data-src') || null;
        
        // Get the title link
        const titleCell = $row.find('td').eq(2);
        const titleLink = titleCell.find('a').first();
        const title = titleLink.text().trim();
        const href = titleLink.attr('href');
        
        if (!title || !href) return;
        
        const titleLower = title.toLowerCase();
        
        // Check if all parts of the search title appear in the episode title
        const isMatch = searchTitleParts.every(part => titleLower.includes(part));
        
        if (isMatch) {
          // Build the full URL
          let url;
          if (href.startsWith('http')) {
            url = href;
          } else if (href.startsWith('/')) {
            url = `${this.baseUrl}${href}`;
          } else {
            url = `${this.baseUrl}/${href}`;
          }
          
          // Build the full image URL
          let fullImageUrl = null;
          if (imageUrl) {
            if (imageUrl.startsWith('http')) {
              fullImageUrl = imageUrl;
            } else if (imageUrl.startsWith('/')) {
              fullImageUrl = `${this.baseUrl}${imageUrl}`;
            } else {
              fullImageUrl = `${this.baseUrl}/${imageUrl}`;
            }
          }
          
          foundScenes.push({
            title: title,
            url: url,
            image: fullImageUrl
          });
        }
      });
      
      console.log(`✅ Found ${foundScenes.length} scenes matching title`);
      return foundScenes;

    } catch (error) {
      console.error('❌ Error searching GEVI scenes by title:', error.message);
      
      if (browser) {
        try {
          await browser.close();
        } catch (closeError) {
          console.error('Error closing browser:', closeError.message);
        }
      }
      
      throw error;
    }
  }
}

module.exports = GeviScraperService;
