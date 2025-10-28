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
        // Remove "Date:" label and trim
        let dateText = fullText.replace(/Date:/g, '').trim();
        
        // Extract first valid date in YYYY-MM-DD format
        const dateMatch = dateText.match(/\d{4}-\d{2}-\d{2}/);
        if (dateMatch) {
          metadata.date = dateMatch[0];
        } else if (dateText) {
          // Fallback to cleaned text if no exact match
          metadata.date = dateText.split('\n')[0].trim();
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

      // Extract episode URLs from "View episode at" divs
      metadata.episodeUrls = [];
      const episodeDivs = $('div:contains("View episode at")');
      episodeDivs.each((i, div) => {
        // Only process divs where the direct text content starts with "View episode at"
        const divText = $(div).contents().filter(function() {
          return this.type === 'text';
        }).text().trim();
        
        if (divText.startsWith('View episode at')) {
          const link = $(div).find('a').first();
          if (link.length) {
            const href = link.attr('href');
            if (href) {
              const fullUrl = this.absUrl(href);
              metadata.episodeUrls.push(fullUrl);
            }
          }
        }
      });
      
      if (metadata.episodeUrls.length > 0) {
        console.log(`   - Found ${metadata.episodeUrls.length} episode URL(s):`, metadata.episodeUrls);
      }

      // Extract movies from "Found in these movies:" or "Found in this movie:" sections
      metadata.movies = [];
      
      // Try "Found in these movies:" (plural)
      let moviesHeader = $('div:contains("Found in these movies:")').filter((i, el) => {
        return $(el).text().trim() === "Found in these movies:";
      }).first();
      
      // Try "Found in this movie:" (singular) if plural not found
      if (!moviesHeader.length) {
        moviesHeader = $('div:contains("Found in this movie:")').filter((i, el) => {
          return $(el).text().trim() === "Found in this movie:";
        }).first();
      }
      
      if (moviesHeader.length) {
        const moviesContainer = moviesHeader.parent();
        if (moviesContainer.length) {
          const movieLinks = moviesContainer.find('a[href*="video/"]');
          movieLinks.each((i, link) => {
            const movie = this.nameWithUrl($, link);
            metadata.movies.push(movie);
          });
        }
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
   * Scrape performer metadata from a GEVI performer page
   * @param {string} url - GEVI performer URL
   * @returns {Promise<Object>} Performer metadata object
   */
  async scrapePerformer(url) {
    console.log('👤 [GEVI] Starting performer scrape for:', url);
    
    try {
      // Validate URL
      if (!url.includes('gayeroticvideoindex.com/performer/')) {
        throw new Error('Invalid GEVI URL. Expected format: https://gayeroticvideoindex.com/performer/[id]');
      }

      console.log('   - Fetching page...');
      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      // Find the main data section
      const section = $('div#data section').first();
      if (!section.length) {
        throw new Error('Cannot find performer section on page');
      }

      console.log('   - Extracting metadata...');
      
      const metadata = {
        name: null,
        gender: 'MALE',
        urls: [url],
        url: url
      };

      // Extract name (h1 with class text-yellow-200)
      const nameEl = section.find('h1.text-yellow-200').first();
      if (nameEl.length) {
        const fullName = nameEl.text().trim();
        // Parse name and optional disambiguation (e.g., "John Doe (II)")
        const nameMatch = fullName.match(/^(.+?)(?:\s*\((.*?)\))?$/);
        if (nameMatch) {
          metadata.name = nameMatch[1].trim();
          if (nameMatch[2]) {
            metadata.disambiguation = nameMatch[2].trim();
          }
        } else {
          metadata.name = fullName;
        }
      }

      // Extract image
      const imageEl = section.find('img[src*="Stars"]').first();
      if (imageEl.length) {
        metadata.image = this.absUrl(imageEl.attr('src'));
      }

      // Helper function to extract from GEVI's table-like layout
      const fromTable = (key) => {
        const keyDiv = section.find('div').filter((i, el) => $(el).text().trim() === key).first();
        if (keyDiv.length) {
          const valueDiv = keyDiv.next('div');
          if (valueDiv.length) {
            return valueDiv.text().trim();
          }
        }
        return null;
      };

      // Helper to get multiple values separated by <br> tags
      const fromTableMultiple = (key) => {
        const keyDiv = section.find('div').filter((i, el) => $(el).text().trim() === key).first();
        if (keyDiv.length) {
          const valueDiv = keyDiv.next('div');
          if (valueDiv.length) {
            // Get HTML content and split by <br> tags
            const html = valueDiv.html();
            if (html) {
              // Split by <br> (case insensitive, with or without attributes)
              const values = html.split(/<br\s*\/?>/i)
                .map(v => $('<div>').html(v).text().trim())
                .filter(v => v && v !== 'Unknown');
              return values.length > 0 ? values : null;
            }
          }
        }
        return null;
      };

      // Extract physical attributes
      const hairColor = fromTable('Hair:');
      if (hairColor) {
        // Map GEVI values to standard values
        const hairMap = { 'Blond': 'Blonde', 'Brown': 'Brunette' };
        metadata.hair_color = hairMap[hairColor] || hairColor;
      }

      const eyeColor = fromTable('Eyes:');
      if (eyeColor) {
        metadata.eye_color = eyeColor;
      }

      const height = fromTable('Height:');
      if (height) {
        // Extract cm value: "6'0\" / 183cm" -> "183"
        const heightMatch = height.match(/(\d+)\s*cm/i);
        if (heightMatch) {
          metadata.height = heightMatch[1];
        }
      }

      const weight = fromTable('Weight:');
      if (weight) {
        // Extract kg value: "165 lbs / 75kg" -> "75"
        const weightMatch = weight.match(/(\d+)\s*kg/i);
        if (weightMatch) {
          metadata.weight = weightMatch[1];
        }
      }

      const dickSize = fromTable('Dick Size:');
      if (dickSize) {
        // Extract cm value: "7.1\" / 18cm" -> "18"
        const sizeMatch = dickSize.match(/(\d+)\s*cm/i);
        if (sizeMatch) {
          metadata.penis_length = sizeMatch[1];
        }
      }

      const foreskin = fromTable('Foreskin:');
      if (foreskin) {
        // Map GEVI foreskin values to Stash CircumisedEnum: CUT, UNCUT
        const circumcisedMap = {
          'Cut': 'CUT',
          'Circumcised': 'CUT',
          'Uncut': 'UNCUT',
          'Intact': 'UNCUT'
        };
        metadata.circumcised = circumcisedMap[foreskin] || null;
      }

      const tattoos = fromTable('Tattoos:');
      if (tattoos) {
        metadata.tattoos = tattoos;
      }

      const piercing = fromTable('Piercing:');
      if (piercing) {
        metadata.piercings = piercing;
      }

      // Extract all physical attributes as simple tags
      const tags = [];
      
      // Hair color tag - can have multiple values separated by <br>
      const hairColorValues = fromTableMultiple('Hair:');
      if (hairColorValues) {
        hairColorValues.forEach(value => {
          // Map GEVI values to standard values for the tag
          const hairMap = { 'Blond': 'Blonde', 'Brown': 'Brunette' };
          const mappedValue = hairMap[value] || value;
          tags.push(`Hair: ${mappedValue}`);
        });
      }

      // Eye color tag - can have multiple values separated by <br>
      const eyeColorValues = fromTableMultiple('Eyes:');
      if (eyeColorValues) {
        eyeColorValues.forEach(value => {
          tags.push(`Eyes: ${value}`);
        });
      }

      // Body Hair - can have multiple values separated by <br>
      const bodyHairValues = fromTableMultiple('Body Hair:');
      if (bodyHairValues) {
        bodyHairValues.forEach(value => {
          tags.push(`Body Hair: ${value}`);
        });
      }

      // Facial Hair - can have multiple values separated by <br>
      const facialHairValues = fromTableMultiple('Facial Hair:');
      if (facialHairValues) {
        facialHairValues.forEach(value => {
          tags.push(`Facial Hair: ${value}`);
        });
      }

      // Build - can have multiple values separated by <br>
      const buildValues = fromTableMultiple('Build:');
      if (buildValues) {
        buildValues.forEach(value => {
          tags.push(`Build: ${value}`);
        });
      }

      // Position - can have multiple values separated by <br>
      const positionValues = fromTableMultiple('Position:');
      if (positionValues) {
        positionValues.forEach(value => {
          tags.push(`Position: ${value}`);
        });
      }

      // Skin - can have multiple values separated by <br>
      const skinValues = fromTableMultiple('Skin:');
      if (skinValues) {
        skinValues.forEach(value => {
          tags.push(`Skin: ${value}`);
        });
      }

      // Foreskin/Circumcision status - can have multiple values separated by <br>
      const foreskinValues = fromTableMultiple('Foreskin:');
      if (foreskinValues) {
        foreskinValues.forEach(value => {
          tags.push(`Foreskin: ${value}`);
        });
      }

      // Piercing - can have multiple values separated by <br>
      const piercingValues = fromTableMultiple('Piercing:');
      if (piercingValues) {
        piercingValues.forEach(value => {
          tags.push(`Piercing: ${value}`);
        });
      }

      // Tattoos - can have multiple values separated by <br>
      const tattooValues = fromTableMultiple('Tattoos:');
      if (tattooValues) {
        tattooValues.forEach(value => {
          if (value !== 'None') {
            tags.push(`Tattoos: ${value}`);
          }
        });
      }

      if (tags.length > 0) {
        metadata.tags = tags;
      }

      // Get "From:" location
      const fromLocation = fromTable('From:');

      const birthYear = fromTable('Born:');
      if (birthYear) {
        // GEVI only tracks birth years, not full dates
        const yearMatch = birthYear.match(/\d{4}/);
        if (yearMatch) {
          metadata.birthdate = `${yearMatch[0]}-01-01`;
        }
      }

      const deathYear = fromTable('Died:');
      if (deathYear) {
        // GEVI only tracks death years, not full dates
        const yearMatch = deathYear.match(/\d{4}/);
        if (yearMatch) {
          metadata.death_date = `${yearMatch[0]}-01-01`;
        }
      }

      // Extract bio/details
      const bioKeyDiv = section.find('div').filter((i, el) => $(el).text().trim() === 'Notes:').first();
      if (bioKeyDiv.length) {
        const bioDiv = bioKeyDiv.next('div');
        if (bioDiv.length) {
          let details = bioDiv.text().trim();
          
          // Append "From:" location to details if available
          if (fromLocation) {
            if (details) {
              details += `\n\nFrom: ${fromLocation}`;
            } else {
              details = `From: ${fromLocation}`;
            }
          }
          
          metadata.details = details;
        }
      } else if (fromLocation) {
        // If no Notes section exists, just use the From location as details
        metadata.details = `From: ${fromLocation}`;
      }

      // Extract external URLs from "See this performer at:" section
      const externalUrls = [];
      
      // Always include the GEVI URL itself as the first URL
      externalUrls.push(url);
      
      const performerLinksDiv = section.find('div').filter((i, el) => {
        return $(el).text().trim() === 'See this performer at:';
      }).first();
      
      if (performerLinksDiv.length) {
        // Get the parent div that contains the "See this performer at:" div
        const linksContainer = performerLinksDiv.parent();
        if (linksContainer.length) {
          // Find all <a> links in the container
          const links = linksContainer.find('a');
          links.each((i, link) => {
            const href = $(link).attr('href');
            if (href && href.startsWith('http')) {
              externalUrls.push(href);
            }
          });
        }
      }
      
      if (externalUrls.length > 0) {
        metadata.urls = externalUrls;
        console.log(`   - Found ${externalUrls.length} URL(s) (including GEVI):`, externalUrls);
      }

      // Extract aliases (h2 elements)
      const aliasElements = section.find('h2');
      if (aliasElements.length > 0) {
        const aliases = [];
        aliasElements.each((i, el) => {
          const aliasText = $(el).text().trim();
          // Parse alias and optional disambiguation
          const aliasMatch = aliasText.match(/^(.+?)(?:\s*\((.*?)\))?$/);
          if (aliasMatch) {
            aliases.push(aliasMatch[1].trim());
          } else {
            aliases.push(aliasText);
          }
        });
        // Deduplicate and join
        metadata.aliases = [...new Set(aliases)].join(', ');
      }

      console.log('   - Metadata extracted:', JSON.stringify(metadata, null, 2));

      return {
        success: true,
        metadata,
        source: 'GEVI',
        sourceUrl: url
      };

    } catch (error) {
      console.error('❌ [GEVI] Performer scraping failed:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'GEVI',
        sourceUrl: url
      };
    }
  }

  /**
   * Scrape movie metadata from a GEVI movie page
   * @param {string} url - GEVI movie URL
   * @returns {Promise<Object>} Movie metadata object
   */
  async movieFromUrl(url) {
    try {
      console.log(`🎬 [GEVI] Scraping movie from: ${url}`);

      const response = await this.client.get(url);
      const $ = cheerio.load(response.data);

      // Find the movie data section
      const movieSection = $('section#data section').first();
      if (!movieSection.length) {
        console.error('❌ Cannot find movie section in page');
        return null;
      }

      const movie = {
        url: url
      };

      // Extract title (h1)
      const titleEl = movieSection.find('h1').first();
      if (titleEl.length) {
        movie.name = titleEl.text().trim();
      }

      // Extract cover images
      const coverImages = movieSection.find('img[src*="Covers"]');
      if (coverImages.length > 0) {
        // Use 'image' attribute if available, fallback to 'src'
        movie.front_image = this.absUrl($(coverImages[0]).attr('image') || $(coverImages[0]).attr('src'));
        if (coverImages.length > 1) {
          movie.back_image = this.absUrl($(coverImages[1]).attr('image') || $(coverImages[1]).attr('src'));
        }
      }

      // Extract synopsis from "Description source:" section
      const descSpan = $('span:contains("Description source:")').first();
      if (descSpan.length) {
        const detailsDiv = descSpan.parent().next('div');
        if (detailsDiv.length) {
          movie.synopsis = detailsDiv.text().trim();
        }
      }

      // Extract table data (length, released date, distributor/studio, etc.)
      const table = movieSection.find('table').first();
      if (table.length) {
        const headers = [];
        table.find('th').each((i, th) => {
          headers.push($(th).text().trim());
        });

        const values = [];
        table.find('td').each((i, td) => {
          values.push($(td));
        });

        const tableData = {};
        headers.forEach((header, i) => {
          if (values[i]) {
            tableData[header] = values[i];
          }
        });

        // Extract length/duration (GEVI provides minutes, Stash expects seconds)
        if (tableData['Length']) {
          const lengthText = tableData['Length'].text().trim();
          if (lengthText) {
            const minutes = parseInt(lengthText, 10);
            if (!isNaN(minutes)) {
              movie.duration = minutes * 60; // Convert minutes to seconds
            }
          }
        }

        // Extract release date (GEVI only has year)
        if (tableData['Released']) {
          const year = tableData['Released'].text().trim();
          if (year) {
            movie.date = `${year}-01-01`;
          }
        }

        // Extract distributor and studio
        if (tableData['Distributor']) {
          const distributorLink = tableData['Distributor'].find('a').first();
          if (distributorLink.length) {
            const distributor = this.nameWithUrl($, distributorLink);
            
            // Check if there's a studio name after a <br> tag
            const br = tableData['Distributor'].find('br');
            if (br.length) {
              const studioText = br.get(0).nextSibling;
              if (studioText && studioText.nodeType === 3) { // Text node
                const studioName = studioText.nodeValue.trim();
                if (studioName) {
                  movie.studio = {
                    name: studioName,
                    parent: distributor
                  };
                } else {
                  movie.studio = distributor.name;
                }
              } else {
                movie.studio = distributor.name;
              }
            } else {
              movie.studio = distributor.name;
            }
          }
        }
      }

      // Extract director(s)
      const directorLinks = movieSection.find('a[href*="director"]');
      if (directorLinks.length > 0) {
        const directors = [];
        directorLinks.each((i, link) => {
          directors.push($(link).text().trim());
        });
        movie.director = directors.join(', ');
      }

      // Extract external URLs (e.g., AEBN, VOD, etc.) from "View movie at" divs
      movie.externalUrls = [];
      const externalDivs = $('div:contains("View movie at")');
      externalDivs.each((i, div) => {
        // Only process divs where the direct text content starts with "View movie at"
        const divText = $(div).contents().filter(function() {
          return this.type === 'text';
        }).text().trim();
        
        if (divText.startsWith('View movie at')) {
          const link = $(div).find('a').first();
          if (link.length) {
            const href = link.attr('href');
            if (href) {
              const fullUrl = this.absUrl(href);
              movie.externalUrls.push(fullUrl);
              console.log(`   - Found external URL: ${fullUrl}`);
            }
          }
        }
      });

      // Extract scenes from the movie page
      const scenesDiv = $('#scenes');
      if (scenesDiv.length) {
        movie.scenes = [];
        scenesDiv.find('div.scene').each((i, sceneEl) => {
          const sceneData = {};
          
          // Extract scene number and date
          const sceneHeader = $(sceneEl).find('span.text-yellow-200').first();
          if (sceneHeader.length) {
            const headerText = sceneHeader.text().trim();
            const sceneMatch = headerText.match(/Scene (\d+):/);
            if (sceneMatch) {
              sceneData.sceneNumber = parseInt(sceneMatch[1], 10);
            }
            
            // Date is next to the scene number
            const dateText = sceneHeader.parent().text().replace(headerText, '').trim();
            if (dateText) {
              sceneData.date = dateText;
            }
          }
          
          // Extract performers with action codes
          sceneData.performers = [];
          
          // Find the div containing performers
          const performersDiv = $(sceneEl).find('div').filter((i, el) => {
            return $(el).find('a[href*="performer"]').length > 0;
          }).first();
          
          if (performersDiv.length) {
            // Get the full HTML content
            const performersHtml = performersDiv.html();
            
            // Split by <a> tags to process each performer
            const performerLinks = performersDiv.find('a[href*="performer"]');
            
            performerLinks.each((j, perfLink) => {
              const $perfLink = $(perfLink);
              const performerName = $perfLink.find('span').text().trim() || $perfLink.text().trim();
              
              if (performerName) {
                const performerData = { name: performerName };
                
                // Get the text node immediately after the </a> tag
                const nextNode = perfLink.nextSibling;
                if (nextNode && nextNode.nodeType === 3) { // Text node
                  // Extract action code (everything before comma or end of text)
                  const textAfter = nextNode.nodeValue || '';
                  const actionCodeMatch = textAfter.match(/^([^,\s]+)/);
                  if (actionCodeMatch && actionCodeMatch[1]) {
                    const actionCode = actionCodeMatch[1].trim();
                    if (actionCode && actionCode !== '' && actionCode.length > 0) {
                      performerData.actionCode = actionCode;
                    }
                  }
                }
                
                sceneData.performers.push(performerData);
              }
            });
          }
          
          // Extract scene description/synopsis
          const sceneText = $(sceneEl).find('div.sceneText').first();
          if (sceneText.length) {
            sceneData.details = sceneText.text().trim();
          }
          
          // Extract episode link
          const episodeLink = $(sceneEl).find('a[href*="episode"]').first();
          if (episodeLink.length) {
            sceneData.episodeUrl = this.absUrl(episodeLink.attr('href'));
          }
          
          // Extract compilations ("found in compilation" links) - can have multiple per scene
          sceneData.compilations = [];
          const compilationDivs = $(sceneEl).find('div:contains("found in compilation")');
          compilationDivs.each((k, compilationDiv) => {
            const compilationLink = $(compilationDiv).find('a[href*="video/"]').first();
            if (compilationLink.length) {
              const compilation = this.nameWithUrl($, compilationLink);
              sceneData.compilations.push(compilation);
            }
          });
          
          if (sceneData.compilations.length > 0) {
            console.log(`   - Scene ${sceneData.sceneNumber} has ${sceneData.compilations.length} compilations`);
          }
          
          movie.scenes.push(sceneData);
        });
        
        console.log(`   - Extracted ${movie.scenes.length} scenes from movie page`);
      }

      console.log('   - Movie metadata extracted:', JSON.stringify(movie, null, 2));

      return movie;

    } catch (error) {
      console.error('❌ [GEVI] Movie scraping failed:', error.message);
      return null;
    }
  }

  /**
   * Match scenes from a movie's scene list to database scenes
   * @param {Array<Object>} movieScenes - Scenes extracted from GEVI movie page
   * @param {Array<Object>} dbScenes - Scenes from database (with performers)
   * @returns {Array<Object>} Array of matched scenes with updates
   */
  async matchMovieScenes(movieScenes, dbScenes) {
    console.log(`\n🎯 [matchMovieScenes] Starting scene matching`);
    console.log(`   - Movie scenes: ${movieScenes?.length || 0}`);
    console.log(`   - Database scenes: ${dbScenes?.length || 0}`);
    
    if (!movieScenes || movieScenes.length === 0 || !dbScenes || dbScenes.length === 0) {
      console.log(`   - ❌ Early return: empty arrays`);
      return [];
    }

    const matches = [];

    for (const dbScene of dbScenes) {
      console.log(`\n   🔍 Checking DB scene: "${dbScene.title || dbScene.id}"`);
      console.log(`      - DB scene performers structure:`, JSON.stringify(dbScene.performers, null, 2));
      
      let bestMatch = null;
      let bestScore = 0;

      // Get performer names from database scene
      const dbPerformerNames = dbScene.performers.map(p => p.performer.name.toLowerCase());
      console.log(`      - DB performer names:`, dbPerformerNames);

      for (const movieScene of movieScenes) {
        let score = 0;
        
        console.log(`\n      📽️ Comparing with movie scene ${movieScene.sceneNumber}`);
        console.log(`         - Movie scene details:`, movieScene.details);
        console.log(`         - Movie performers:`, movieScene.performers);

        // Match performers - use fuzzy matching
        // Handle both string[] and object[] performer formats
        const moviePerformerNames = movieScene.performers.map(p => 
          typeof p === 'string' ? p.toLowerCase() : p.name.toLowerCase()
        );
        console.log(`         - Movie performer names (lowercase):`, moviePerformerNames);
        
        // Method 1: Direct name matching (partial match allowed)
        const matchingPerformers = moviePerformerNames.filter(mp => 
          dbPerformerNames.some(dp => dp.includes(mp) || mp.includes(dp))
        );
        console.log(`         - Direct matching performers:`, matchingPerformers);
        
        // Method 2: Check if performer names appear in scene title/details
        let performersInTitle = 0;
        if (dbScene.title) {
          const sceneTitle = dbScene.title.toLowerCase();
          const sceneDetails = movieScene.details?.toLowerCase() || '';
          
          for (const dbPerformerName of dbPerformerNames) {
            // Split performer name into parts (first, last, etc.)
            const nameParts = dbPerformerName.split(' ').filter(p => p.length > 2); // Ignore very short parts
            
            // Check if any significant name part appears in movie scene details
            const foundInDetails = nameParts.some(part => sceneDetails.includes(part));
            
            // Check if any movie performer name part matches DB performer name part
            const movieNameParts = moviePerformerNames.flatMap(mp => mp.split(' ').filter(p => p.length > 2));
            const foundNameMatch = nameParts.some(dbPart => 
              movieNameParts.some(moviePart => 
                dbPart.includes(moviePart) || moviePart.includes(dbPart)
              )
            );
            
            if (foundInDetails || foundNameMatch) {
              performersInTitle++;
              console.log(`         - Found performer "${dbPerformerName}" via fuzzy match (in details: ${foundInDetails}, name match: ${foundNameMatch})`);
            }
          }
        }
        
        console.log(`         - Performers found via fuzzy matching: ${performersInTitle}/${dbPerformerNames.length}`);
        
        // Scoring: Since we're on the correct movie/group, be more lenient
        const directMatchScore = matchingPerformers.length / Math.max(moviePerformerNames.length, dbPerformerNames.length);
        const fuzzyMatchScore = performersInTitle / dbPerformerNames.length;
        const bestPerformerScore = Math.max(directMatchScore, fuzzyMatchScore);
        
        score += bestPerformerScore * 60; // Reduced from 70 to make room for position bonus
        console.log(`         - Performer match score: ${bestPerformerScore.toFixed(2)} (score: ${(bestPerformerScore * 60).toFixed(1)})`);
        
        // Method 3: Title/details matching
        if (dbScene.title && movieScene.details) {
          const dbTitle = dbScene.title.toLowerCase();
          const movieDetails = movieScene.details.toLowerCase();
          
          // Check for title match
          if (movieDetails.includes(dbTitle) || dbTitle.includes(movieDetails.substring(0, 20))) {
            score += 20;
            console.log(`         - Title match! (score: +20)`);
          }
          
          // Check if title words appear in details
          const titleWords = dbTitle.split(/\s+/).filter(w => w.length > 3);
          const wordsInDetails = titleWords.filter(word => movieDetails.includes(word)).length;
          if (wordsInDetails > 0) {
            const wordMatchScore = (wordsInDetails / titleWords.length) * 10;
            score += wordMatchScore;
            console.log(`         - Title word match: ${wordsInDetails}/${titleWords.length} (score: +${wordMatchScore.toFixed(1)})`);
          }
        }
        
        // Method 4: Position bonus - if we're on the right movie, scene order likely matches
        // Give a small bonus based on how close the scene numbers are
        if (dbScene.groups && dbScene.groups.length > 0) {
          const sceneIndex = dbScene.groups[0].sceneIndex;
          if (sceneIndex !== null && sceneIndex !== undefined) {
            const positionDiff = Math.abs(sceneIndex - (movieScene.sceneNumber - 1)); // sceneNumber is 1-based
            if (positionDiff === 0) {
              score += 20; // Exact position match
              console.log(`         - Exact position match! (score: +20)`);
            } else if (positionDiff <= 2) {
              const proximityScore = 10 * (1 - positionDiff / 3);
              score += proximityScore;
              console.log(`         - Close position match (diff: ${positionDiff}) (score: +${proximityScore.toFixed(1)})`);
            }
          }
        }

        console.log(`         - Total score: ${score.toFixed(1)}`);

        // Keep the best match for this database scene
        // Lower threshold from 50 to 30 since we're already on the correct movie
        if (score > bestScore && score > 30) {
          console.log(`         - ✅ New best match! (score: ${score.toFixed(1)})`);
          bestScore = score;
          bestMatch = movieScene;
        } else if (score > 0) {
          console.log(`         - ❌ Score too low (${score.toFixed(1)} vs threshold 30)`);
        }
      }

      if (bestMatch) {
        const matchData = {
          sceneId: dbScene.id,
          sceneNumber: bestMatch.sceneNumber,
          date: bestMatch.date,
          details: bestMatch.details,
          episodeUrl: bestMatch.episodeUrl,
          performers: bestMatch.performers, // Include performers with action codes
          confidence: Math.round(bestScore)
        };
        matches.push(matchData);
        
        console.log(`   ✅ Matched scene "${dbScene.title || dbScene.id}" to Scene ${bestMatch.sceneNumber} (${bestScore.toFixed(0)}% confidence)`);
        console.log(`      Match data:`, JSON.stringify(matchData, null, 2));
      } else {
        console.log(`   ❌ No match found for scene "${dbScene.title || dbScene.id}"`);
      }
    }

    console.log(`\n🎯 [matchMovieScenes] Complete: ${matches.length} matches found\n`);
    return matches;
  }

  /**
   * Match scraped movies/groups against database groups
   * @param {Array<Object>} scrapedMovies - Array of movie objects with name and url
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Matched and unmatched movies with alternatives
   */
  async matchGroups(scrapedMovies, prisma) {
    const matched = [];
    const unmatched = [];

    if (!scrapedMovies || scrapedMovies.length === 0) {
      return { matched, unmatched };
    }

    // Get all groups once for efficiency
    const allGroups = await prisma.stashGroup.findMany({
      include: {
        studio: true
      }
    });

    for (const movie of scrapedMovies) {
      const movieName = movie.name;
      
      // Search by name (SQLite-compatible - filter in JS)
      const normalizedName = movieName.toLowerCase().replace(/\s+/g, '');
      
      // Find all matches with scores
      const foundMatches = [];
      
      for (const dbGroup of allGroups) {
        const dbNormalized = dbGroup.name.toLowerCase().replace(/\s+/g, '');
        
        let score = 0;
        let matchedVia = 'name';
        let matchedText = dbGroup.name;
        
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
        else if (dbGroup.aliases) {
          const aliases = dbGroup.aliases.split(',').map(a => a.trim());
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
        if (score > 0.7) {
          foundMatches.push({
            group: dbGroup,
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
          id: m.group.id,
          name: m.group.name,
          studio: m.group.studio ? m.group.studio.name : null,
          date: m.group.date,
          matchedVia: m.matchedVia,
          matchedAlias: m.matchedVia === 'alias' ? m.matchedText : null
        }));

        matched.push({
          id: bestMatch.group.id,
          name: bestMatch.group.name,
          studio: bestMatch.group.studio ? bestMatch.group.studio.name : null,
          date: bestMatch.group.date,
          matchedVia: bestMatch.matchedVia,
          matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
          alternatives: alternatives,
          originalName: movieName,  // Store the original scraped name
          url: movie.url,  // Store the GEVI URL for fetching full details
          sceneNumber: movie.sceneNumber || null  // Store the scene number from AEBN scraper
        });
      } else {
        // No match found
        unmatched.push({
          name: movieName,
          url: movie.url  // Store the GEVI URL for fetching full details
        });
      }
    }

    return { matched, unmatched };
  }

  /**
   * Match scraped compilations against database movies
   * @param {Array<Object>} scrapedCompilations - Array of compilation objects with name and url
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Matched and unmatched compilations
   */
  async matchCompilations(scrapedCompilations, prisma) {
    const matched = [];
    const unmatched = [];

    // Get all groups once for efficiency
    const allGroups = await prisma.stashGroup.findMany({
      include: {
        studio: true
      }
    });

    for (const compilation of scrapedCompilations) {
      const compilationName = compilation.name;
      
      // Search by name (SQLite-compatible - filter in JS)
      const normalizedName = compilationName.toLowerCase().replace(/\s+/g, '');
      
      // Find all matches with scores
      const foundMatches = [];
      
      for (const dbGroup of allGroups) {
        const dbNormalized = dbGroup.name.toLowerCase().replace(/\s+/g, '');
        
        let score = 0;
        let matchedVia = 'name';
        let matchedText = dbGroup.name;
        
        // Check aliases FIRST (higher priority for exact alias matches)
        if (dbGroup.aliases) {
          const aliases = dbGroup.aliases.split(',').map(a => a.trim());
          for (const alias of aliases) {
            const normalizedAlias = alias.toLowerCase().replace(/\s+/g, '');
            
            // Exact match on alias (highest priority)
            if (normalizedAlias === normalizedName) {
              score = 1.0;
              matchedVia = 'alias';
              matchedText = alias;
              break;
            }
            // Scraped name contains alias
            else if (normalizedName.includes(normalizedAlias)) {
              const newScore = normalizedAlias.length / normalizedName.length;
              if (newScore > score) {
                score = newScore;
                matchedVia = 'alias';
                matchedText = alias;
              }
            }
            // Alias contains scraped name
            else if (normalizedAlias.includes(normalizedName)) {
              const newScore = normalizedName.length / normalizedAlias.length;
              if (newScore > score) {
                score = newScore;
                matchedVia = 'alias';
                matchedText = alias;
              }
            }
          }
        }
        
        // If no good alias match, check name
        if (score < 1.0) {
          // Exact match on name
          if (dbNormalized === normalizedName) {
            score = 1.0;
            matchedVia = 'name';
            matchedText = dbGroup.name;
          }
          // Check if scraped name contains db name
          else if (normalizedName.includes(dbNormalized)) {
            const newScore = dbNormalized.length / normalizedName.length;
            if (newScore > score) {
              score = newScore;
              matchedVia = 'name';
              matchedText = dbGroup.name;
            }
          }
          // Check if db name contains scraped name
          else if (dbNormalized.includes(normalizedName)) {
            const newScore = normalizedName.length / dbNormalized.length;
            if (newScore > score) {
              score = newScore;
              matchedVia = 'name';
              matchedText = dbGroup.name;
            }
          }
        }
        
        // Only include if score is above threshold
        if (score > 0.7) {
          foundMatches.push({
            group: dbGroup,
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

        matched.push({
          id: bestMatch.group.id,
          name: bestMatch.group.name,
          stashId: bestMatch.group.stashId,
          studio: bestMatch.group.studio ? bestMatch.group.studio.name : null,
          date: bestMatch.group.date,
          matchedVia: bestMatch.matchedVia,
          matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
          originalName: compilationName,
          geviUrl: compilation.url,
          sceneNumber: compilation.sceneNumber, // Preserve scene tracking
          sceneId: compilation.sceneId // Preserve scene tracking
        });
      } else {
        // No match found
        unmatched.push({
          name: compilationName,
          geviUrl: compilation.url,
          sceneNumber: compilation.sceneNumber, // Preserve scene tracking
          sceneId: compilation.sceneId // Preserve scene tracking
        });
      }
    }

    return { matched, unmatched };
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
      // Extract name and URL from object or use string directly
      const performerName = typeof performer === 'string' ? performer : performer.name;
      const performerUrl = typeof performer === 'object' ? performer.url : null;
      
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
          disambiguation: m.performer.disambiguation || null,
          matchedVia: m.matchedVia,
          matchedAlias: m.matchedVia === 'alias' ? m.matchedText : null
        }));

        matched.push({
          id: bestMatch.performer.id,
          name: bestMatch.performer.name,
          disambiguation: bestMatch.performer.disambiguation || null,
          matchedVia: bestMatch.matchedVia,
          matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
          alternatives: alternatives,
          originalName: performerName,  // Store the original scraped name
          scrapedUrl: performerUrl  // Store the scraped URL
        });
      } else {
        // No match found - include URL if available
        unmatched.push(typeof performer === 'object' ? performer : performerName);
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
   * Match scraped tags against database tags
   * @param {Array} scrapedTags - Array of tag objects or strings from scrape
   * @param {Object} prisma - Prisma client instance
   * @returns {Promise<Object>} Object with matched and unmatched tags
   */
  async matchTags(scrapedTags, prisma) {
    const matched = [];
    const unmatched = [];

    if (!scrapedTags || scrapedTags.length === 0) {
      return { matched, unmatched };
    }

    // Get all tags with their aliases
    const allTags = await prisma.stashTag.findMany({
      include: {
        aliases: true
      }
    });

    for (const tag of scrapedTags) {
      // Extract name from object or use string directly
      const tagName = typeof tag === 'string' ? tag : tag.name;
      
      if (!tagName) continue;

      // Search by name (case-insensitive)
      const normalizedName = tagName.toLowerCase().trim();
      
      // Look for exact match or alias match
      let foundTag = null;
      let matchedVia = 'name';
      let matchedAlias = null;
      
      for (const dbTag of allTags) {
        const dbNormalized = dbTag.name.toLowerCase().trim();
        
        // Exact match on name
        if (dbNormalized === normalizedName) {
          foundTag = dbTag;
          matchedVia = 'name';
          break;
        }
        
        // Check aliases if present
        if (dbTag.aliases && dbTag.aliases.length > 0) {
          const matchingAlias = dbTag.aliases.find(a => 
            a.alias.toLowerCase().trim() === normalizedName
          );
          
          if (matchingAlias) {
            foundTag = dbTag;
            matchedVia = 'alias';
            matchedAlias = matchingAlias.alias;
            break;
          }
        }
      }

      if (foundTag) {
        matched.push({
          id: foundTag.id,
          name: foundTag.name,
          originalName: tagName,
          matchedVia: matchedVia,
          matchedAlias: matchedAlias
        });
      } else {
        // No match found - keep as object if it has other properties
        unmatched.push(typeof tag === 'object' ? tag : tagName);
      }
    }

    return { matched, unmatched };
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
   * Search for movies by title on GEVI
   * Uses Puppeteer to interact with the search page (click movie button, enter search)
   * @param {string} title - Movie title to search for
   * @returns {Promise<Array>} Array of movie objects with name and url
   */
  async searchMovie(title) {
    let browser = null;
    
    try {
      console.log(`🎬 Searching GEVI for movie: "${title}"`);
      
      // Launch puppeteer browser
      const puppeteer = require('puppeteer');
      console.log(`   - Launching browser...`);
      
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      
      // Set user agent to avoid detection
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      
      // Navigate to search page
      console.log(`   - Navigating to search page...`);
      await page.goto(`${this.baseUrl}/search`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000
      });
      
      // Wait for page to be fully loaded
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Debug: Check what buttons are available
      const buttons = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
        return allButtons.map(btn => ({
          id: btn.id,
          class: btn.className,
          text: btn.textContent?.trim().substring(0, 50)
        }));
      });
      console.log(`   - Found ${buttons.length} buttons:`, JSON.stringify(buttons, null, 2));
      
      // Try multiple strategies to find and click the Movies button
      console.log(`   - Attempting to click Movies button...`);
      let movieButtonClicked = false;
      
      // Strategy 1: Try by ID
      try {
        await page.waitForSelector('#moviesButton', { visible: true, timeout: 5000 });
        await page.evaluate(() => {
          const btn = document.getElementById('moviesButton');
          if (btn) btn.click();
        });
        console.log(`   - ✓ Clicked via ID`);
        movieButtonClicked = true;
      } catch (e) {
        console.log(`   - ID selector failed: ${e.message}`);
      }
      
      // Strategy 2: Try by text content
      if (!movieButtonClicked) {
        try {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const movieBtn = buttons.find(btn => 
              btn.textContent?.toLowerCase().includes('movie')
            );
            if (movieBtn) movieBtn.click();
          });
          console.log(`   - ✓ Clicked via text search`);
          movieButtonClicked = true;
        } catch (e) {
          console.log(`   - Text search failed: ${e.message}`);
        }
      }
      
      // Strategy 3: Try finding by class or other attributes
      if (!movieButtonClicked) {
        const clickResult = await page.evaluate(() => {
          // Look for any button with "movie" in class or data attributes
          const selectors = [
            'button[data-filter="movies"]',
            'button.movies',
            'button.movie-filter',
            '[data-type="movies"]',
            '.filter-movies',
            'a[href*="movies"]'
          ];
          
          for (const selector of selectors) {
            const elem = document.querySelector(selector);
            if (elem) {
              elem.click();
              return { success: true, selector };
            }
          }
          return { success: false };
        });
        
        if (clickResult.success) {
          console.log(`   - ✓ Clicked via selector: ${clickResult.selector}`);
          movieButtonClicked = true;
        }
      }
      
      if (!movieButtonClicked) {
        console.log(`   - ⚠️ Could not click Movies button, searching all content`);
      }
      
      // Wait for any UI updates
      await new Promise(resolve => setTimeout(resolve, 2000)); // Increased from 1s to 2s
      
      // Find and fill the search input - try multiple selectors
      console.log(`   - Entering search term: "${title}"`);
      
      // Expanded list of possible search input selectors
      const searchInputSelectors = [
        'input[type="search"]',
        'input[name="q"]',
        'input[name="search"]',
        'input[placeholder*="Search" i]',
        'input[placeholder*="search" i]',
        'input.search-input',
        'input.search',
        '#searchInput',
        '#search',
        'input[aria-label*="search" i]',
        'input[type="text"]' // Fallback to any text input
      ];
      
      let searchInput = null;
      let usedSelector = null;
      
      for (const selector of searchInputSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000, visible: true });
          searchInput = await page.$(selector);
          if (searchInput) {
            usedSelector = selector;
            console.log(`   - ✓ Found search input: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      if (!searchInput) {
        // Debug: List all inputs on the page
        const inputInfo = await page.evaluate(() => {
          const inputs = Array.from(document.querySelectorAll('input'));
          return inputs.map(inp => ({
            type: inp.type,
            name: inp.name,
            id: inp.id,
            class: inp.className,
            placeholder: inp.placeholder,
            visible: inp.offsetParent !== null
          }));
        });
        console.log(`   - Available inputs on page:`, inputInfo);
        throw new Error('No search input found on page');
      }
      
      await page.type(usedSelector, title);
      
      // Submit the search (press Enter or click search button)
      await page.keyboard.press('Enter');
      
      // Wait for results to load
      console.log(`   - Waiting for search results...`);
      await new Promise(resolve => setTimeout(resolve, 3000)); // Give more time for results to load
      
      // Debug: Check what the page looks like
      const pageInfo = await page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          videoLinks: document.querySelectorAll('a[href*="/video/"]').length,
          allLinks: document.querySelectorAll('a').length
        };
      });
      console.log(`   - Page info:`, pageInfo);
      
      // Extract movie results - try multiple link patterns
      const movies = await page.evaluate((baseUrl) => {
        const results = [];
        
        // Try different link patterns that might contain movies
        const selectors = [
          'a[href*="/video/"]',
          'a[href*="/movie/"]',
          'a[href*="/m/"]',
          '.movie-link',
          '.video-link'
        ];
        
        const seenUrls = new Set();
        
        for (const selector of selectors) {
          const links = document.querySelectorAll(selector);
          
          links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            const text = link.textContent.trim();
            
            // Skip if no text or very short
            if (!text || text.length < 2) return;
            
            const url = href.startsWith('http') 
              ? href 
              : href.startsWith('/') 
                ? `${baseUrl}${href}` 
                : `${baseUrl}/${href}`;
            
            // Avoid duplicates
            if (!seenUrls.has(url)) {
              seenUrls.add(url);
              results.push({
                name: text,
                url: url
              });
            }
          });
        }
        
        return results;
      }, this.baseUrl);
      
      await browser.close();
      browser = null;
      
      console.log(`✅ Found ${movies.length} movies matching "${title}"`);
      return movies.slice(0, 10); // Return top 10 results

    } catch (error) {
      console.error('❌ Error searching GEVI movie:', error.message);
      
      // Make sure browser is closed
      if (browser) {
        try {
          await browser.close();
        } catch (e) {
          console.error('Error closing browser:', e.message);
        }
      }
      
      // Fallback: Try HTML-based search on the videos page
      try {
        console.log(`   - Attempting fallback HTML search...`);
        const fallbackUrl = `${this.baseUrl}/videos`;
        const response = await axios.get(fallbackUrl, {
          headers: {
            'Referer': this.baseUrl,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        const $ = cheerio.load(response.data);
        const movies = [];
        const searchLower = title.toLowerCase();
        
        // Look for movie links in the page
        $('a[href*="/video/"]').each((i, elem) => {
          const $link = $(elem);
          const movieName = $link.text().trim();
          const href = $link.attr('href');
          
          // Check if the movie name contains the search term
          if (movieName && movieName.toLowerCase().includes(searchLower)) {
            const url = href?.startsWith('/') ? `${this.baseUrl}${href}` : `${this.baseUrl}/${href}`;
            movies.push({
              name: movieName,
              url: url
            });
          }
        });
        
        // Remove duplicates
        const uniqueMovies = movies.filter((movie, index, self) =>
          index === self.findIndex(m => m.url === movie.url)
        );
        
        console.log(`✅ Fallback search found ${uniqueMovies.length} movies`);
        return uniqueMovies.slice(0, 10); // Return top 10
        
      } catch (fallbackError) {
        console.error('❌ Fallback search also failed:', fallbackError.message);
        throw error; // Throw the original error
      }
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
          
          // Get the date (4th td, index 3)
          const dateCell = $row.find('td').eq(3);
          const date = dateCell.text().trim();
          
          // Get the studio (5th td, index 4)
          const studioCell = $row.find('td').eq(4);
          const studio = studioCell.text().trim();
          
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
              image: fullImageUrl,
              date: date || null,
              studio: studio || null,
              performers: costarsText || null
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

  /**
   * Search for scenes on a GEVI studio page by title
   * @param {string} studioUrl - URL of the studio's page on GEVI
   * @param {string} sceneTitle - Title to search for
   * @returns {Promise<Array>} Array of matching scenes with details
   */
  async searchScenesByTitleOnStudio(studioUrl, sceneTitle) {
    let browser = null;
    
    try {
      console.log(`🔍 Loading studio page: ${studioUrl}`);
      console.log(`🔍 Will search for title: "${sceneTitle}"`);
      
      // Launch Puppeteer to handle JavaScript-rendered content
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
      
      await page.goto(studioUrl, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      console.log(`   - Page loaded, checking for episodes table...`);
      
      // Check if the table exists before waiting
      const tableExists = await page.evaluate(() => {
        const table = document.querySelector('#episodesDT');
        const tbody = document.querySelector('#episodesDT tbody');
        const rows = document.querySelectorAll('#episodesDT tbody tr');
        
        // Also check for alternative table structures
        const allTables = Array.from(document.querySelectorAll('table[id]')).map(t => ({
          id: t.id,
          hasDataTable: t.classList.contains('dataTable'),
          rowCount: t.querySelectorAll('tbody tr').length
        }));
        
        return { 
          hasTable: !!table, 
          hasTbody: !!tbody, 
          rowCount: rows.length,
          allTables: allTables
        };
      });
      
      console.log(`   - Table check:`, JSON.stringify(tableExists, null, 2));
      
      if (!tableExists.hasTable) {
        console.error('   - ❌ No #episodesDT table found on page');
        console.error('   - Available tables:', tableExists.allTables);
        await browser.close();
        throw new Error(`Episodes table not found on studio page. Available tables: ${tableExists.allTables.map(t => t.id).join(', ')}`);
      }
      
      if (tableExists.rowCount === 0) {
        console.warn('   - ⚠️  Table exists but has no rows yet, will wait for content...');
      }
      
      // Wait for the DataTable to be initialized and populated
      console.log(`   - Waiting for episodes table to populate...`);
      await page.waitForSelector('#episodesDT tbody tr', { timeout: 15000 });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get pagination info
      const paginationInfo = await page.evaluate(() => {
        const infoText = document.querySelector('#episodesDT_info')?.textContent || '';
        console.log('   - Pagination text:', infoText);
        
        // Match "of X entries" where X can have commas (e.g., "2,223")
        const match = infoText.match(/of ([\d,]+) entries/);
        let totalEntries = 0;
        
        if (match) {
          // Remove commas and parse
          totalEntries = parseInt(match[1].replace(/,/g, ''));
          console.log('   - Parsed total entries from pagination:', totalEntries);
        }
        
        // Fallback: if pagination info not found, count actual rows in table
        if (totalEntries === 0) {
          const rowCount = document.querySelectorAll('#episodesDT tbody tr').length;
          if (rowCount > 0) {
            totalEntries = rowCount;
            console.log('   - Using row count fallback:', totalEntries);
          }
        }
        
        const entriesPerPage = 25;
        const totalPages = totalEntries > 0 ? Math.ceil(totalEntries / entriesPerPage) : 1;
        
        return { totalEntries, entriesPerPage, totalPages };
      });
      
      console.log(`   - Found ${paginationInfo.totalEntries} total episodes across ${paginationInfo.totalPages} pages`);
      
      // Normalize the search title for exact matching
      const normalizedSearchTitle = sceneTitle.toLowerCase().trim();
      
      console.log(`   - Searching for exact match: "${normalizedSearchTitle}"`);
      
      const foundScenes = [];
      let exactMatchFound = false;
      
      // Search page by page until exact match is found or all pages exhausted
      for (let pageNum = 1; pageNum <= paginationInfo.totalPages && !exactMatchFound; pageNum++) {
        console.log(`   - Searching page ${pageNum}/${paginationInfo.totalPages}...`);
        
        // Get current page HTML
        const pageRowsHtml = await page.evaluate(() => {
          const tbody = document.querySelector('#episodesDT tbody');
          return tbody ? tbody.innerHTML : '';
        });
        
        if (!pageRowsHtml) {
          console.warn(`   - Warning: No content on page ${pageNum}`);
          break;
        }
        
        // Parse current page with Cheerio
        const tableHtml = `<table id="episodesDT"><tbody>${pageRowsHtml}</tbody></table>`;
        const $ = cheerio.load(tableHtml);
        const episodesTable = $('tbody');
        
        // Check each row on this page
        episodesTable.find('tr').each((i, row) => {
          const $row = $(row);
          
          // Get the date (column 1 - column 0 is the expand button)
          const dateCell = $row.find('td').eq(1);
          const date = dateCell.text().trim() || null;
          
          // Get the title link (column 2)
          const titleCell = $row.find('td').eq(2);
          const titleLink = titleCell.find('a').first();
          const title = titleLink.text().trim();
          const href = titleLink.attr('href');
          
          // Get the performers/costars (column 3)
          const costarsCell = $row.find('td').eq(3);
          const costarsText = costarsCell.text().trim() || null;
          
          if (!title || !href) return;
          
          const titleLower = title.toLowerCase().trim();
          
          // Check for EXACT match
          if (titleLower === normalizedSearchTitle) {
            console.log(`   - ✅ EXACT MATCH FOUND: "${title}"`);
            exactMatchFound = true;
            
            // Build the full URL
            let url;
            if (href.startsWith('http')) {
              url = href;
            } else if (href.startsWith('/')) {
              url = `${this.baseUrl}${href}`;
            } else {
              url = `${this.baseUrl}/${href}`;
            }
            
            foundScenes.push({
              title: title,
              url: url,
              image: null, // Studio pages don't show thumbnails in table
              date: date,
              studio: null, // Studio is implicit from the page we're on
              performers: costarsText
            });
          }
        });
        
        // If exact match found, stop searching
        if (exactMatchFound) {
          break;
        }
        
        // Navigate to next page if not at the end
        if (pageNum < paginationInfo.totalPages) {
          try {
            await page.evaluate(() => {
              const nextButton = document.querySelector('#episodesDT_next');
              if (nextButton && !nextButton.classList.contains('disabled')) {
                nextButton.click();
              }
            });
            
            await new Promise(resolve => setTimeout(resolve, 1500));
            await page.waitForSelector('#episodesDT tbody tr', { timeout: 5000 });
          } catch (navError) {
            console.warn(`   - Warning: Could not navigate to page ${pageNum + 1}`);
            break;
          }
        }
      }
      
      await browser.close();
      browser = null;
      
      if (foundScenes.length === 0) {
        console.log(`   - No exact match found for "${sceneTitle}"`);
      } else {
        console.log(`✅ Found ${foundScenes.length} exact match(es)`);
      }
      
      return foundScenes;

    } catch (error) {
      console.error('❌ Error searching GEVI studio scenes by title:', error.message);
      console.error('   - Studio URL:', studioUrl);
      console.error('   - Search Title:', sceneTitle);
      
      // Try to capture page state for debugging
      if (browser) {
        try {
          const page = (await browser.pages())[0];
          if (page) {
            const url = page.url();
            console.error('   - Current page URL:', url);
            
            // Check what's on the page
            const pageContent = await page.evaluate(() => {
              const tables = document.querySelectorAll('table[id]');
              const tableIds = Array.from(tables).map(t => t.id);
              const hasEpisodesDT = !!document.querySelector('#episodesDT');
              return { tableIds, hasEpisodesDT, bodyLength: document.body.innerHTML.length };
            });
            console.error('   - Page content:', pageContent);
          }
        } catch (debugError) {
          console.error('   - Could not get debug info:', debugError.message);
        }
        
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
