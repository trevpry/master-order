class StashScrapeAllService {
  static buildScrapeAllSources(sources = [], resultsBySource = {}, fallbackUsage = {}) {
    return sources.map((source, index) => {
      const endpoint = source.endpoint || source.url || source.name || `source-${index + 1}`;
      const results = Array.isArray(resultsBySource[endpoint]) ? resultsBySource[endpoint] : [];
      const usedFallback = Boolean(fallbackUsage[endpoint]);

      return {
        id: `${source.name || 'source'}-${index + 1}`,
        name: source.name || `Source ${index + 1}`,
        endpoint,
        configured: source.configured !== false,
        resultCount: results.length,
        hasResults: results.length > 0,
        usedFallback,
        results
      };
    });
  }
}

module.exports = StashScrapeAllService;
module.exports.buildScrapeAllSources = StashScrapeAllService.buildScrapeAllSources;
