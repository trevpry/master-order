require('dotenv').config();
const axios = require('axios');
const TvdbDatabaseService = require('./tvdbDatabaseService');
const prisma = require('./prismaClient'); // Use direct prisma access

class TvdbCachedService {
  constructor() {
    this.bearerToken = null;
    this.baseURL = 'https://api4.thetvdb.com/v4';
    this.dbService = new TvdbDatabaseService();
    this.cacheMaxAgeHours = 24; // Cache for 24 hours by default
  }

  async ensureTokenLoaded() {
    if (!this.bearerToken) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.bearerToken = settings?.tvdbBearerToken;
    }
  }

  async isTokenAvailable() {
    await this.ensureTokenLoaded();
    return !!this.bearerToken && this.bearerToken !== 'your_tvdb_bearer_token_here';
  }

  // Helper method for series matching scoring
  calculateSeriesMatchScore(searchTitle, resultTitle) {
    if (!searchTitle || !resultTitle) return 0;
    
    const originalSearchLower = searchTitle.toLowerCase().trim();
    const originalResultLower = resultTitle.toLowerCase().trim();
    
    // Exact match without any normalization (highest priority)
    if (originalSearchLower === originalResultLower) {
      return 1.0;
    }
    
    // Normalize titles by removing common variations
    const normalize = (title) => {
      return title.toLowerCase()
        .replace(/\s*\((\d{4})\)\s*/g, ' ') // Remove years like (2005)
        .replace(/\s*\(uk\)\s*/gi, ' ') // Remove (UK)
        .replace(/\s*\(us\)\s*/gi, ' ') // Remove (US)
        .replace(/\s*\(american\)\s*/gi, ' ') // Remove (American)
        .replace(/\s*\(british\)\s*/gi, ' ') // Remove (British)
        .replace(/\s*\(original\)\s*/gi, ' ') // Remove (Original)
        .replace(/\s*\(reboot\)\s*/gi, ' ') // Remove (Reboot)
        .replace(/\s*\(remake\)\s*/gi, ' ') // Remove (Remake)
        .replace(/\s+/g, ' ') // Normalize spaces
        .trim();
    };
    
    const normalizedSearch = normalize(searchTitle);
    const normalizedResult = normalize(resultTitle);
    
    // Exact match after normalization (second highest priority)
    if (normalizedSearch === normalizedResult) {
      // Give a slight penalty based on how much normalization was needed
      const originalLength = originalResultLower.length;
      const normalizedLength = normalizedResult.length;
      const normalizationPenalty = (originalLength - normalizedLength) / originalLength * 0.1;
      return 0.95 - normalizationPenalty; // Score between 0.85-0.95
    }
    
    // Partial match where normalized search is contained in normalized result
    if (normalizedResult.includes(normalizedSearch)) {
      // Score higher for shorter result titles
      const lengthPenalty = (originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, 1);
      return 0.8 - (lengthPenalty * 0.2); // Score between 0.6-0.8
    }
    
    // Partial match where normalized result is contained in normalized search
    if (normalizedSearch.includes(normalizedResult)) {
      return 0.6;
    }
    
    // Bidirectional partial match (fallback)
    if (originalResultLower.includes(originalSearchLower) || originalSearchLower.includes(originalResultLower)) {
      const lengthPenalty = Math.abs(originalResultLower.length - originalSearchLower.length) / Math.max(originalResultLower.length, originalSearchLower.length);
      return 0.4 - (lengthPenalty * 0.2); // Score between 0.2-0.4
    }
    
    return 0;
  }

  async searchSeries(seriesName) {
    try {
      // Get all potentially matching series from cache
      const allCachedSeries = await this.dbService.getAllCachedSeries(seriesName);
      let validCachedSeries = [];
      
      if (allCachedSeries.length > 0) {
        // Filter out expired cached series
        for (const series of allCachedSeries) {
          if (!await this.dbService.isCacheExpired(series.tvdbId, this.cacheMaxAgeHours)) {
            validCachedSeries.push(series);
          }
        }
      }

      let bestCachedMatch = null;
      let bestCachedScore = 0;

      // If we have valid cached results, apply matching logic to them
      if (validCachedSeries.length > 0) {
        console.log(`Found ${validCachedSeries.length} cached TVDB series for "${seriesName}"`);
        
        // Apply matching algorithm to cached results
        const scoredCachedResults = validCachedSeries.map(series => ({
          series,
          score: this.calculateSeriesMatchScore(seriesName, series.name)
        })).sort((a, b) => b.score - a.score);
        
        console.log('Cached results scoring:');
        scoredCachedResults.forEach(result => {
          console.log(`  "${result.series.name}" - Score: ${result.score.toFixed(3)}`);
        });
        
        bestCachedMatch = scoredCachedResults[0];
        bestCachedScore = bestCachedMatch.score;
        
        // Only use cached result if it's an excellent match (score > 0.98 for exact or very close matches)
        if (bestCachedScore >= 0.98) {
          console.log(`Using cached TVDB series: ${bestCachedMatch.series.name} (score: ${bestCachedScore.toFixed(3)})`);
          return [this.formatSeriesForSearch(bestCachedMatch.series)];
        } else {
          console.log(`Best cached match "${bestCachedMatch.series.name}" has score ${bestCachedScore.toFixed(3)} (< 0.98), searching API for better match`);
        }
      }

      // If no good cached match or no cache, fetch from API
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        // Fall back to best cached match if available, even with low score
        if (bestCachedMatch) {
          console.log(`Using best available cached series: ${bestCachedMatch.series.name}`);
          return [this.formatSeriesForSearch(bestCachedMatch.series)];
        }
        return [];
      }
      
      const response = await axios.get(`${this.baseURL}/search`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'User-Agent': 'Master-Order-App/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        params: {
          query: seriesName,
          type: 'series'
        },
        timeout: 10000
      });

      const searchResults = response.data.data || [];
      console.log(`TVDB search results for "${seriesName}":`, searchResults.slice(0, 2));

      // Transform API results to expected format
      const transformedResults = searchResults.map(result => ({
        id: result.id,
        tvdbId: result.tvdb_id,
        name: result.name,
        slug: result.slug,
        image_url: result.image_url,
        year: result.year,
        status: result.status,
        network: result.network,
        overview: result.overview
      }));

      // Apply the same matching logic to API results
      if (transformedResults.length > 0) {
        console.log(`Sorting ${transformedResults.length} TVDB API results with matching priority...`);
        
        // Score and sort the API results
        const scoredAPIResults = transformedResults.map(result => ({
          ...result,
          matchScore: this.calculateSeriesMatchScore(seriesName, result.name)
        })).filter(result => result.matchScore > 0);
        
        scoredAPIResults.sort((a, b) => b.matchScore - a.matchScore);
        
        if (scoredAPIResults.length > 0) {
          console.log(`TVDB API series matching results:`);
          scoredAPIResults.slice(0, 3).forEach((result, index) => {
            console.log(`  ${index + 1}. "${result.name}" (score: ${result.matchScore.toFixed(3)})`);
          });
          
          const bestAPIResult = scoredAPIResults[0];
          
          // Compare with best cached result
          if (bestCachedMatch && bestCachedScore >= bestAPIResult.matchScore) {
            console.log(`Cached result "${bestCachedMatch.series.name}" (${bestCachedScore.toFixed(3)}) is better than or equal to API result "${bestAPIResult.name}" (${bestAPIResult.matchScore.toFixed(3)})`);
            return [this.formatSeriesForSearch(bestCachedMatch.series)];
          }
          
          console.log(`Using API result "${bestAPIResult.name}" (score: ${bestAPIResult.matchScore.toFixed(3)})`);
          
          // Remove the matchScore property before returning
          const finalResults = scoredAPIResults.map(({ matchScore, ...result }) => result);
          
          // Store the best (first) result in cache
          try {
            const seriesDetails = await this.getSeriesDetailsFromAPI(bestAPIResult.id);
            if (seriesDetails) {
              await this.dbService.storeSeries(seriesDetails);
              console.log(`Cached new series: ${seriesDetails.name}`);
            }
          } catch (cacheError) {
            console.error('Error caching API result:', cacheError);
          }
          
          return finalResults;
        }
      }

      // If no good API results, fall back to best cached match if available
      if (bestCachedMatch) {
        console.log(`No good API matches found, using cached result: ${bestCachedMatch.series.name}`);
        return [this.formatSeriesForSearch(bestCachedMatch.series)];
      }

      // Store the first API result in cache if available (fallback for no scoring matches)
      if (transformedResults.length > 0) {
        try {
          const firstResult = transformedResults[0];
          const seriesDetails = await this.getSeriesDetailsFromAPI(firstResult.id);
          if (seriesDetails) {
            await this.dbService.storeSeries(seriesDetails);
          }
        } catch (cacheError) {
          console.error('Error caching fallback result:', cacheError);
        }
      }

      return transformedResults;
    } catch (error) {
      console.error('TVDB series search failed:', error.response?.data || error.message);
      
      // Fallback to cache only if we have a good match or no other option
      let bestCachedMatch = null;
      let bestCachedScore = 0;
      
      // Try to get cached results for fallback
      try {
        const allCachedSeries = await this.dbService.getAllCachedSeries(seriesName);
        if (allCachedSeries.length > 0) {
          const scoredCachedResults = allCachedSeries.map(series => ({
            series,
            score: this.calculateSeriesMatchScore(seriesName, series.name)
          })).sort((a, b) => b.score - a.score);
          
          bestCachedMatch = scoredCachedResults[0];
          bestCachedScore = bestCachedMatch.score;
        }
      } catch (cacheError) {
        console.error('Error accessing cache for fallback:', cacheError.message);
      }
      
      if (bestCachedMatch && bestCachedScore > 0.5) {
        console.log(`Using cached fallback for TVDB series: ${bestCachedMatch.series.name} (score: ${bestCachedScore.toFixed(3)})`);
        return [this.formatSeriesForSearch(bestCachedMatch.series)];
      }
      
      // Last resort: check for any cached series with partial matching
      const cachedSeries = await this.dbService.getCachedSeries(seriesName);
      if (cachedSeries) {
        const fallbackScore = this.calculateSeriesMatchScore(seriesName, cachedSeries.name);
        if (fallbackScore > 0.3) {
          console.log(`Using fallback cached series: ${cachedSeries.name} (score: ${fallbackScore.toFixed(3)})`);
          return [this.formatSeriesForSearch(cachedSeries)];
        } else {
          console.log(`Cached series "${cachedSeries.name}" has poor match score (${fallbackScore.toFixed(3)}), not using`);
        }
      }
      
      return [];
    }
  }

  async getSeriesDetails(seriesId) {
    try {
      const cleanSeriesId = seriesId.toString().replace('series-', '');
      
      // Check cache first
      const cachedSeries = await this.dbService.getCachedSeriesById(cleanSeriesId);
      if (cachedSeries && !await this.dbService.isCacheExpired(cachedSeries.tvdbId, this.cacheMaxAgeHours)) {
        console.log(`Using cached TVDB series details: ${cachedSeries.name}`);
        return this.formatSeriesDetails(cachedSeries);
      }

      // Fetch from API if not cached or expired
      const apiData = await this.getSeriesDetailsFromAPI(cleanSeriesId);
      if (apiData) {
        // Store in cache
        await this.dbService.storeSeries(apiData);
        return apiData;
      }

      // Fallback to cache even if expired
      if (cachedSeries) {
        console.log(`Using expired cache for TVDB series details: ${cachedSeries.name}`);
        return this.formatSeriesDetails(cachedSeries);
      }

      return null;
    } catch (error) {
      console.error('TVDB series details fetch failed:', error.response?.data || error.message);
      
      // Fallback to cache
      const cachedSeries = await this.dbService.getCachedSeriesById(seriesId.toString().replace('series-', ''));
      if (cachedSeries) {
        console.log(`Using cache fallback for TVDB series details: ${cachedSeries.name}`);
        return this.formatSeriesDetails(cachedSeries);
      }
      
      return null;
    }
  }

  async getSeriesDetailsFromAPI(seriesId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }

      const cleanSeriesId = seriesId.toString().replace('series-', '');
      
      const response = await axios.get(`${this.baseURL}/series/${cleanSeriesId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'User-Agent': 'Master-Order-App/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.data.data;
    } catch (error) {
      console.error('TVDB series details API fetch failed:', error.response?.data || error.message);
      return null;
    }
  }

  async getSeriesSeasons(seriesId) {
    try {
      const cleanSeriesId = seriesId.toString().replace('series-', '');
      
      // Check cache first
      const cachedSeries = await this.dbService.getCachedSeriesById(cleanSeriesId);
      if (cachedSeries && !await this.dbService.isCacheExpired(cachedSeries.tvdbId, this.cacheMaxAgeHours)) {
        console.log(`Using cached TVDB seasons for: ${cachedSeries.name}`);
        return cachedSeries.seasons || [];
      }

      // Fetch from API if not cached or expired
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return cachedSeries?.seasons || [];
      }
      
      console.log(`Fetching seasons for series ID: ${cleanSeriesId}`);
      
      const response = await axios.get(`${this.baseURL}/series/${cleanSeriesId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'User-Agent': 'Master-Order-App/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const seasons = response.data.data?.seasons || [];
      console.log(`Found ${seasons.length} seasons in API response`);
      
      // Store in cache
      if (response.data.data) {
        await this.dbService.storeSeries(response.data.data);
      }
      
      return seasons;
    } catch (error) {
      console.error('TVDB seasons fetch failed:', error.response?.data || error.message);
      
      // Fallback to cache
      const cachedSeries = await this.dbService.getCachedSeriesById(seriesId.toString().replace('series-', ''));
      if (cachedSeries) {
        console.log(`Using cache fallback for TVDB seasons: ${cachedSeries.name}`);
        return cachedSeries.seasons || [];
      }
      
      return [];
    }
  }

  async getSeasonExtended(seasonId) {
    try {
      // Check cache first
      const cachedSeason = await this.dbService.getCachedSeasonById(seasonId.toString());
      if (cachedSeason && !await this.dbService.isCacheExpired(cachedSeason.seriesTvdbId, this.cacheMaxAgeHours)) {
        console.log(`Using cached TVDB season: ${cachedSeason.name || 'Season ' + cachedSeason.number}`);
        return this.formatSeasonExtended(cachedSeason);
      }

      // Fetch from API if not cached or expired
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return cachedSeason ? this.formatSeasonExtended(cachedSeason) : null;
      }
      
      console.log(`Fetching extended season details for season ID: ${seasonId}`);
      
      const response = await axios.get(`${this.baseURL}/seasons/${seasonId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'User-Agent': 'Master-Order-App/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const seasonData = response.data.data;
      console.log(`TVDB season extended response status: ${response.status}`);
      
      // Store in cache (note: we need the series ID to store properly)
      if (seasonData && cachedSeason) {
        await this.dbService.storeSeason(seasonData, cachedSeason.seriesTvdbId);
      }
      
      return seasonData;
    } catch (error) {
      console.error('TVDB season extended fetch failed:', error.response?.data || error.message);
      
      // Fallback to cache
      const cachedSeason = await this.dbService.getCachedSeasonById(seasonId.toString());
      if (cachedSeason) {
        console.log(`Using cache fallback for TVDB season: ${cachedSeason.name || 'Season ' + cachedSeason.number}`);
        return this.formatSeasonExtended(cachedSeason);
      }
      
      return null;
    }
  }

  async getEpisodeDetails(episodeId) {
    try {
      // Check cache first
      const cachedEpisode = await this.dbService.getCachedEpisodeById(episodeId.toString());
      if (cachedEpisode && !await this.dbService.isCacheExpired(cachedEpisode.seriesTvdbId, this.cacheMaxAgeHours)) {
        console.log(`Using cached TVDB episode: ${cachedEpisode.name}`);
        return this.formatEpisodeDetails(cachedEpisode);
      }

      // Fetch from API if not cached or expired
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return cachedEpisode ? this.formatEpisodeDetails(cachedEpisode) : null;
      }
      
      console.log(`Fetching episode details for episode ID: ${episodeId}`);
      
      const response = await axios.get(`${this.baseURL}/episodes/${episodeId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`,
          'User-Agent': 'Master-Order-App/1.0',
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const episodeData = response.data.data;
      console.log(`TVDB episode extended response status: ${response.status}`);
      
      // Store in cache (note: we need season and series IDs to store properly)
      if (episodeData && cachedEpisode) {
        await this.dbService.storeEpisode(episodeData, cachedEpisode.seasonTvdbId, cachedEpisode.seriesTvdbId);
      }
      
      return episodeData;
    } catch (error) {
      console.error('TVDB episode details fetch failed:', error.response?.data || error.message);
      
      // Fallback to cache
      const cachedEpisode = await this.dbService.getCachedEpisodeById(episodeId.toString());
      if (cachedEpisode) {
        console.log(`Using cache fallback for TVDB episode: ${cachedEpisode.name}`);
        return this.formatEpisodeDetails(cachedEpisode);
      }
      
      return null;
    }
  }

  async findEpisodeBySeasonAndNumber(seriesId, seasonNumber, episodeNumber) {
    try {
      const cleanSeriesId = seriesId.toString().replace('series-', '');
      
      // Check cache first
      const cachedEpisode = await this.dbService.getCachedEpisode(cleanSeriesId, seasonNumber, episodeNumber);
      if (cachedEpisode && !await this.dbService.isCacheExpired(cachedEpisode.seriesTvdbId, this.cacheMaxAgeHours)) {
        console.log(`Using cached TVDB episode: S${seasonNumber}E${episodeNumber}`);
        return this.formatEpisodeDetails(cachedEpisode);
      }

      console.log(`Finding episode S${seasonNumber}E${episodeNumber} for series ID: ${cleanSeriesId}`);
      
      // Get all seasons for the series (this will cache them)
      const seasons = await this.getSeriesSeasons(cleanSeriesId);
      if (!seasons || seasons.length === 0) {
        console.log('No seasons found for series');
        return cachedEpisode ? this.formatEpisodeDetails(cachedEpisode) : null;
      }
      
      // Find the specific season
      const targetSeason = seasons.find(season => season.number === seasonNumber);
      if (!targetSeason) {
        console.log(`Season ${seasonNumber} not found`);
        return cachedEpisode ? this.formatEpisodeDetails(cachedEpisode) : null;      }
      
      // Get extended season details to access episodes (this will cache them)
      const seasonExtended = await this.getSeasonExtended(targetSeason.tvdbId);
      if (!seasonExtended || !seasonExtended.episodes) {
        console.log('No episodes found in season extended data');
        return cachedEpisode ? this.formatEpisodeDetails(cachedEpisode) : null;
      }
      
      // Find the specific episode
      const targetEpisode = seasonExtended.episodes.find(episode => episode.number === episodeNumber);
      if (!targetEpisode) {
        console.log(`Episode ${episodeNumber} not found in season ${seasonNumber}`);
        return cachedEpisode ? this.formatEpisodeDetails(cachedEpisode) : null;
      }
      
      console.log(`Found episode: ${targetEpisode.name} (ID: ${targetEpisode.id})`);
      
      // Get full episode details including finaleType (this will cache it)
      const episodeDetails = await this.getEpisodeDetails(targetEpisode.id);
      return episodeDetails;
      
    } catch (error) {
      console.error('Error finding episode by season and number:', error.message);
      
      // Fallback to cache
      const cachedEpisode = await this.dbService.getCachedEpisode(seriesId.toString().replace('series-', ''), seasonNumber, episodeNumber);
      if (cachedEpisode) {
        console.log(`Using cache fallback for episode S${seasonNumber}E${episodeNumber}`);
        return this.formatEpisodeDetails(cachedEpisode);
      }
      
      return null;
    }
  }

  // Helper method to select English-language artwork from cached or API data
  selectEnglishArtwork(data, type = 'season') {
    try {
      let artworks = [];
      
      // Handle cached data format
      if (data.artworks && Array.isArray(data.artworks)) {
        artworks = data.artworks;
      }
      // Handle API data format
      else if (data.artwork && Array.isArray(data.artwork)) {
        artworks = data.artwork;
      }
      
      if (!artworks || artworks.length === 0) {
        console.log(`No artworks array found in ${type} data`);
        return null;
      }
      
      return this.dbService.selectBestArtwork(artworks, type);
    } catch (error) {
      console.error(`Error selecting English artwork for ${type}:`, error.message);
      return null;
    }
  }

  async getCurrentSeasonArtwork(seriesName, currentSeason = null, currentEpisode = null) {
    try {
      console.log(`Searching TVDB for series: ${seriesName}, season: ${currentSeason}, episode: ${currentEpisode}`);
      
      // Check if bearer token is available
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available, checking cache only');
      }
      
      // Search for the series (this will use cache first)
      const searchResults = await this.searchSeries(seriesName);
      if (!searchResults.length) {
        console.log(`No TVDB results found for: ${seriesName}`);
        return null;
      }

      const series = searchResults[0];
      console.log(`Found TVDB series: ${series.name} (ID: ${series.id})`);

      let episodeDetails = null;
      let isCurrentSeasonFinal = false;
      
      // Get detailed series information to check status and final season
      const seriesDetailsForStatus = await this.getSeriesDetails(series.id);
      if (seriesDetailsForStatus) {
        console.log(`Series status: ${seriesDetailsForStatus.status?.name || 'Unknown'}`);
        
        // Check if series has ended and if current season is the final season
        if (seriesDetailsForStatus.status?.name === 'Ended' && currentSeason && seriesDetailsForStatus.lastAired) {
          console.log(`Series has ended, checking if season ${currentSeason} is final season`);
          const seasons = await this.getSeriesSeasons(series.id);
          if (seasons && seasons.length > 0) {
            // Find the highest numbered season (excluding specials/season 0)
            const regularSeasons = seasons.filter(s => s.number > 0);
            const finalSeasonNumber = Math.max(...regularSeasons.map(s => s.number));
            isCurrentSeasonFinal = (currentSeason === finalSeasonNumber);
            console.log(`Final season is ${finalSeasonNumber}, current season ${currentSeason} is final: ${isCurrentSeasonFinal}`);
          }
        }
      }
      
      // If we have episode info, try to get episode details including finaleType
      if (currentSeason && currentEpisode && typeof currentSeason === 'number' && typeof currentEpisode === 'number') {
        console.log(`Attempting to get episode details for S${currentSeason}E${currentEpisode}`);
        episodeDetails = await this.findEpisodeBySeasonAndNumber(series.id, currentSeason, currentEpisode);
        if (episodeDetails) {
          console.log(`Found episode details: ${episodeDetails.name}`);
          if (episodeDetails.finaleType) {
            console.log(`Episode finale type: ${episodeDetails.finaleType}`);
          }
        }
      }

      // If we have a current season, try to get season-specific artwork
      if (currentSeason && typeof currentSeason === 'number') {
        console.log(`Attempting to get season ${currentSeason} artwork`);
        
        // Get all seasons for the series
        const seasons = await this.getSeriesSeasons(series.id);        if (seasons && seasons.length > 0) {
          console.log(`Found ${seasons.length} seasons for ${series.name}`);
          
          // Find the specific season
          const targetSeason = seasons.find(season => season.number === currentSeason);
          if (targetSeason) {
            console.log(`Found season ${currentSeason} with TVDB ID: ${targetSeason.tvdbId} (local ID: ${targetSeason.id})`);
            
            // Get extended season details to access artwork with language info
            const seasonExtended = await this.getSeasonExtended(targetSeason.tvdbId);
            if (seasonExtended) {
              const englishSeasonArtwork = this.selectEnglishArtwork(seasonExtended, 'season');
              if (englishSeasonArtwork) {
                console.log(`Found English season ${currentSeason} artwork: ${englishSeasonArtwork}`);
                return {
                  url: englishSeasonArtwork,
                  seasonNumber: currentSeason,
                  seriesName: series.name,
                  seriesId: series.id,
                  seasonId: targetSeason.id,
                  episodeDetails: episodeDetails,
                  isCurrentSeasonFinal: isCurrentSeasonFinal,
                  seriesStatus: seriesDetailsForStatus?.status?.name
                };
              }
            }
            
            // Check if season has artwork directly in the response (fallback)
            if (targetSeason.image) {
              const seasonArtworkUrl = targetSeason.image;
              console.log(`Found season ${currentSeason} artwork: ${seasonArtworkUrl}`);
              return {
                url: seasonArtworkUrl,
                seasonNumber: currentSeason,
                seriesName: series.name,
                seriesId: series.id,
                seasonId: targetSeason.id,
                episodeDetails: episodeDetails,
                isCurrentSeasonFinal: isCurrentSeasonFinal,
                seriesStatus: seriesDetailsForStatus?.status?.name
              };
            } else {
              console.log(`No artwork found for season ${currentSeason} in seasons data`);
            }
          } else {
            console.log(`Season ${currentSeason} not found in seasons list`);
          }
        } else {
          console.log(`No seasons data available for ${series.name}`);
        }
      }
      
      // Fallback to series artwork if season artwork not available
      console.log('Falling back to series artwork');
      
      // Check if the series has an image directly from search results
      if (series.image_url) {
        console.log(`Using series image from search result: ${series.image_url}`);
        return {
          url: series.image_url,
          seasonNumber: currentSeason,
          seriesName: series.name,
          seriesId: series.id,
          episodeDetails: episodeDetails,
          isCurrentSeasonFinal: isCurrentSeasonFinal,
          seriesStatus: seriesDetailsForStatus?.status?.name
        };
      }
      
      // Try to get series details as final fallback
      const seriesDetails = await this.getSeriesDetails(series.id);
      if (seriesDetails?.image) {
        const artworkUrl = `https://artworks.thetvdb.com${seriesDetails.image}`;
        console.log(`Using series artwork from details: ${artworkUrl}`);
        return {
          url: artworkUrl,
          seasonNumber: currentSeason,
          seriesName: series.name,
          seriesId: series.id,
          episodeDetails: episodeDetails,
          isCurrentSeasonFinal: isCurrentSeasonFinal,
          seriesStatus: seriesDetailsForStatus?.status?.name
        };
      }

      console.log(`No artwork found for: ${series.name}`);
      return null;

    } catch (error) {
      console.error('Error getting current season artwork:', error.message);
      return null;
    }
  }
  // Format cached data to match API response format
  formatSeriesForSearch(cachedSeries) {
    return {
      id: cachedSeries.tvdbId,
      tvdbId: cachedSeries.tvdbId,
      name: cachedSeries.name,
      slug: cachedSeries.slug,
      image_url: cachedSeries.image,
      year: cachedSeries.year,
      status: cachedSeries.status
    };
  }

  formatSeriesDetails(cachedSeries) {
    return {
      id: cachedSeries.tvdbId,
      name: cachedSeries.name,
      slug: cachedSeries.slug,
      image: cachedSeries.image,
      firstAired: cachedSeries.firstAired,
      lastAired: cachedSeries.lastAired,
      nextAired: cachedSeries.nextAired,
      status: { name: cachedSeries.status },
      overview: cachedSeries.overview,
      year: cachedSeries.year,
      country: cachedSeries.country,
      originalCountry: cachedSeries.originalCountry,
      originalLanguage: cachedSeries.originalLanguage,
      averageRuntime: cachedSeries.averageRuntime,
      score: cachedSeries.score,
      lastUpdated: cachedSeries.lastUpdated,
      seasons: cachedSeries.seasons,
      artwork: cachedSeries.artworks
    };
  }

  formatSeasonExtended(cachedSeason) {
    return {
      id: cachedSeason.tvdbId,
      number: cachedSeason.number,
      name: cachedSeason.name,
      image: cachedSeason.image,
      overview: cachedSeason.overview,
      year: cachedSeason.year,
      lastUpdated: cachedSeason.lastUpdated,
      episodes: cachedSeason.episodes,
      artwork: cachedSeason.artworks
    };
  }

  formatEpisodeDetails(cachedEpisode) {
    return {
      id: cachedEpisode.tvdbId,
      number: cachedEpisode.number,
      seasonNumber: cachedEpisode.seasonNumber,
      name: cachedEpisode.name,
      overview: cachedEpisode.overview,
      image: cachedEpisode.image,
      aired: cachedEpisode.aired,
      runtime: cachedEpisode.runtime,
      finaleType: cachedEpisode.finaleType,
      year: cachedEpisode.year,
      lastUpdated: cachedEpisode.lastUpdated
    };
  }

  // Cleanup method for old cache
  async cleanupCache(maxAgeHours = 168) {
    return await this.dbService.cleanupOldCache(maxAgeHours);
  }
}

module.exports = new TvdbCachedService();
