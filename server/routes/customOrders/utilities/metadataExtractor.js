/**
 * Custom Orders Metadata Extraction Utilities
 * Extracted from monolithic customOrders.js for reusability and testing
 */

/**
 * Extract individual metadata fields from ComicVine details JSON
 * @param {string} comicVineDetailsJson - The JSON string containing ComicVine data
 * @returns {object} Extracted metadata fields
 */
function extractComicVineMetadata(comicVineDetailsJson) {
  if (!comicVineDetailsJson) return {};
  
  try {
    const data = JSON.parse(comicVineDetailsJson);
    const extracted = {};
    
    // Extract series metadata
    if (data.series) {
      if (data.series.id) extracted.comicVineSeriesId = parseInt(data.series.id);
      if (data.series.publisher?.name) extracted.comicPublisher = data.series.publisher.name;
    }
    
    // Extract issue metadata
    if (data.issue) {
      if (data.issue.id) extracted.comicVineIssueId = parseInt(data.issue.id);
      if (data.issue.name) extracted.comicIssueName = data.issue.name;
      if (data.issue.description) extracted.comicDescription = data.issue.description;
      if (data.issue.cover_date) extracted.comicCoverDate = data.issue.cover_date;
      if (data.issue.store_date) extracted.comicStoreDate = data.issue.store_date;
    }
    
    console.log('Extracted ComicVine metadata:', extracted);
    return extracted;
  } catch (error) {
    console.warn('Failed to extract ComicVine metadata:', error.message);
    return {};
  }
}

module.exports = {
  extractComicVineMetadata
};
