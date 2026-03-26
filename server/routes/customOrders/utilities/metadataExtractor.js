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
      
      // Extract character credits
      if (data.issue.character_credits && Array.isArray(data.issue.character_credits)) {
        // Store as comma-separated string for display
        extracted.comicCharacters = JSON.stringify(data.issue.character_credits);
        // Also store as display-friendly string
        extracted.comicCharactersDisplay = data.issue.character_credits.map(char => char.name).join(', ');
      }
      
      // Extract person credits (writers, artists, etc.)
      if (data.issue.person_credits && Array.isArray(data.issue.person_credits)) {
        const credits = {};
        data.issue.person_credits.forEach(person => {
          if (!credits[person.role]) credits[person.role] = [];
          credits[person.role].push(person.name);
        });
        
        // Store specific roles as display-friendly strings
        if (credits.writer) extracted.comicWriter = credits.writer.join(', ');
        if (credits.penciler) extracted.comicPenciler = credits.penciler.join(', ');
        if (credits.inker) extracted.comicInker = credits.inker.join(', ');
        if (credits.colorist) extracted.comicColorist = credits.colorist.join(', ');
        if (credits.cover) extracted.comicCoverArtist = credits.cover.join(', ');
        
        // Store all credits as JSON for comprehensive data
        extracted.comicPersonCredits = JSON.stringify(credits);
        
        // Store creative team data for frontend display and bulk operations
        extracted.comicCreators = JSON.stringify(data.issue.person_credits);
        
        // Also create a display-friendly creative team string
        const mainRoles = ['writer', 'penciler', 'inker', 'colorist', 'cover'];
        const displayCredits = mainRoles
          .filter(role => credits[role])
          .map(role => `${role.charAt(0).toUpperCase() + role.slice(1)}: ${credits[role].join(', ')}`)
          .join(' • ');
        extracted.comicCreatorsDisplay = displayCredits;
      }
      
      // Extract team credits
      if (data.issue.team_credits && Array.isArray(data.issue.team_credits)) {
        extracted.comicTeams = data.issue.team_credits.map(team => team.name).join(', ');
      }
      
      // Extract story arc credits
      if (data.issue.story_arc_credits && Array.isArray(data.issue.story_arc_credits)) {
        extracted.comicStoryArcs = data.issue.story_arc_credits.map(arc => arc.name).join(', ');
      }
      
      // Extract location credits
      if (data.issue.location_credits && Array.isArray(data.issue.location_credits)) {
        extracted.comicLocations = data.issue.location_credits.map(loc => loc.name).join(', ');
      }
      
      // Extract concept credits
      if (data.issue.concept_credits && Array.isArray(data.issue.concept_credits)) {
        extracted.comicConcepts = data.issue.concept_credits.map(concept => concept.name).join(', ');
      }
    }
    
    // Extract cover URL from ComicVine data
    if (data.coverUrl) {
      extracted.comicCoverUrl = data.coverUrl;
    } else if (data.issue?.image?.original_url) {
      extracted.comicCoverUrl = data.issue.image.original_url;
    } else if (data.series?.image?.original_url) {
      extracted.comicCoverUrl = data.series.image.original_url;
    }
    
    // Extract originalArtworkUrl for thumbnail display
    // This is critical for the frontend to display thumbnails properly
    if (data.issue?.image?.medium_url) {
      extracted.originalArtworkUrl = data.issue.image.medium_url;
    } else if (data.issue?.image?.small_url) {
      extracted.originalArtworkUrl = data.issue.image.small_url;
    } else if (data.issue?.image?.original_url) {
      extracted.originalArtworkUrl = data.issue.image.original_url;
    } else if (data.series?.image?.medium_url) {
      extracted.originalArtworkUrl = data.series.image.medium_url;
    } else if (data.series?.image?.small_url) {
      extracted.originalArtworkUrl = data.series.image.small_url;
    } else if (data.series?.image?.original_url) {
      extracted.originalArtworkUrl = data.series.image.original_url;
    } else if (extracted.comicCoverUrl) {
      // Fallback to comicCoverUrl if no specific image URL found
      extracted.originalArtworkUrl = extracted.comicCoverUrl;
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
