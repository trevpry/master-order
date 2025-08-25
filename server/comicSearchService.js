const komgaService = require('./komgaService');
const comicVineService = require('./comicVineService');

/**
 * Search for a comic, checking Komga first, then ComicVine if not found
 * @param {string} comicSeries - Comic series name
 * @param {string} comicIssue - Issue number
 * @param {number|null} comicYear - Year (optional)
 * @returns {Object|null} Comic data with source information
 */
async function searchComic(comicSeries, comicIssue, comicYear = null) {
  try {
    console.log(`\n=== Comic Search: "${comicSeries}" #${comicIssue}` + (comicYear ? ` (${comicYear})` : '') + ' ===');
    
    // Check if Komga is configured
    const komgaConfigured = await komgaService.isConfigured();
    
    if (komgaConfigured) {
      console.log('🔍 Searching Komga first...');
      
      // Search Komga first
      const komgaResult = await komgaService.searchComic(comicSeries, comicIssue, comicYear);
      
      if (komgaResult) {
        console.log('✅ Found in Komga! Skipping ComicVine search.');
        
        return {
          source: 'komga',
          found: true,
          data: komgaResult,
          // Format for compatibility with existing code
          comicVineId: null, // No ComicVine ID since it came from Komga
          comicVineDetailsJson: JSON.stringify({
            source: 'komga',
            komga: komgaResult
          }),
          // Komga-specific fields
          komgaSeriesId: komgaResult.series.id,
          komgaBookId: komgaResult.book.id,
          komgaUrl: komgaResult.komgaUrl,
          komgaSeriesUrl: komgaResult.komgaSeriesUrl,
          komgaMetadata: JSON.stringify(komgaResult.metadata),
          // Override some comic fields with Komga data
          comicSeries: komgaResult.metadata.seriesTitle || comicSeries,
          comicPublisher: komgaResult.metadata.publisher,
          title: komgaResult.metadata.title
        };
      } else {
        console.log('❌ Not found in Komga, trying ComicVine...');
      }
    } else {
      console.log('⚠️  Komga not configured, going directly to ComicVine...');
    }

    // If not found in Komga (or Komga not configured), try ComicVine
    console.log('🔍 Searching ComicVine...');
    
    try {
      // Use existing ComicVine service
      const comicVineResults = await comicVineService.searchSeries(comicSeries);
      
      if (comicVineResults && comicVineResults.length > 0) {
        // For now, just return indication that ComicVine search should proceed normally
        // The existing ComicVine logic will handle the detailed search
        console.log(`✅ Found ${comicVineResults.length} potential series in ComicVine`);
        
        return {
          source: 'comicvine',
          found: true,
          useExistingLogic: true, // Signal to use existing ComicVine logic
          data: comicVineResults
        };
      } else {
        console.log('❌ Not found in ComicVine either');
        
        return {
          source: 'none',
          found: false,
          data: null
        };
      }
    } catch (comicVineError) {
      console.error('Error searching ComicVine:', comicVineError);
      
      return {
        source: 'error',
        found: false,
        error: comicVineError.message,
        data: null
      };
    }

  } catch (error) {
    console.error('Error in comic search:', error);
    
    return {
      source: 'error',
      found: false,
      error: error.message,
      data: null
    };
  }
}

module.exports = {
  searchComic
};
