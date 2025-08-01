require('dotenv').config();
const axios = require('axios');
const prisma = require('./prismaClient'); // Use direct prisma access

class TVDBService {
  constructor() {
    this.bearerToken = null;
    this.baseURL = 'https://api4.thetvdb.com/v4';
  }

  async ensureTokenLoaded(forceRefresh = false) {
    if (!this.bearerToken || forceRefresh) {
      const settings = await prisma.settings.findUnique({
        where: { id: 1 }
      });
      this.bearerToken = settings?.tvdbBearerToken;
      console.log('TVDB token loaded from settings:', this.bearerToken ? `${this.bearerToken.substring(0, 20)}...` : 'null');
    }
  }

  async refreshToken() {
    await this.ensureTokenLoaded(true);
  }

  async isTokenAvailable() {
    await this.ensureTokenLoaded();
    return !!this.bearerToken && this.bearerToken !== 'your_tvdb_bearer_token_here';
  }

  async search(query, type = 'series') {
    try {
      if (!(await this.isTokenAvailable())) {
        console.log('TVDB bearer token not available');
        return [];
      }
      
      const response = await axios.get(`${this.baseURL}/search`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        },
        params: {
          query: query,
          type: type
        }
      });

      console.log(`TVDB search results for "${query}" (type: ${type}):`, response.data.data?.slice(0, 2));
      return response.data.data || [];
    } catch (error) {
      console.error(`TVDB ${type} search failed:`, error.response?.data || error.message);
      
      // If unauthorized, try refreshing the token once
      if (error.response?.status === 401) {
        console.log('TVDB token might be expired, trying to refresh...');
        await this.refreshToken();
        
        // Retry once with refreshed token
        try {
          if (await this.isTokenAvailable()) {
            const retryResponse = await axios.get(`${this.baseURL}/search`, {
              headers: {
                'Authorization': `Bearer ${this.bearerToken}`
              },
              params: {
                query: query,
                type: type
              }
            });
            console.log(`TVDB ${type} search retry succeeded for "${query}"`);
            return retryResponse.data.data || [];
          }
        } catch (retryError) {
          console.error(`TVDB ${type} search retry also failed:`, retryError.response?.data || retryError.message);
        }
      }
      
      return [];
    }
  }

  async searchSeries(seriesName) {
    return this.search(seriesName, 'series');
  }

  async searchMovies(movieName) {
    return this.search(movieName, 'movie');
  }

  async getSeriesDetails(seriesId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }
      
      // Remove 'series-' prefix if present
      const cleanSeriesId = seriesId.toString().replace('series-', '');
      
      const response = await axios.get(`${this.baseURL}/series/${cleanSeriesId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('TVDB series details fetch failed:', error.response?.data || error.message);
      return null;
    }
  }

  async getMovieDetails(movieId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }
      
      const response = await axios.get(`${this.baseURL}/movies/${movieId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      return response.data.data;
    } catch (error) {
      console.error('TVDB movie details fetch failed:', error.response?.data || error.message);
      return null;
    }
  }

  async getSeriesSeasons(seriesId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return [];
      }
      
      // Remove 'series-' prefix if present
      const cleanSeriesId = seriesId.toString().replace('series-', '');
      console.log(`Fetching seasons for series ID: ${cleanSeriesId}`);
      
      // Use series extended endpoint which includes seasons data
      const response = await axios.get(`${this.baseURL}/series/${cleanSeriesId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      console.log(`TVDB series extended response status: ${response.status}`);
      const seasons = response.data.data?.seasons || [];
      console.log(`Found ${seasons.length} seasons in extended response`);
      return seasons;
    } catch (error) {
      console.error('TVDB seasons fetch failed:', error.response?.data || error.message);
      console.error('Request URL:', `${this.baseURL}/series/${seriesId.toString().replace('series-', '')}/extended`);
      return [];
    }
  }async getSeasonExtended(seasonId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }
      
      console.log(`Fetching extended season details for season ID: ${seasonId}`);
      
      const response = await axios.get(`${this.baseURL}/seasons/${seasonId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });      console.log(`TVDB season extended response status: ${response.status}`);
      return response.data.data;
    } catch (error) {
      console.error('TVDB season extended fetch failed:', error.response?.data || error.message);
      console.error('Request URL:', `${this.baseURL}/seasons/${seasonId}/extended`);
      return null;
    }  }
  
  async getEpisodeDetails(episodeId) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }
      
      console.log(`Fetching episode details for episode ID: ${episodeId}`);
      
      const response = await axios.get(`${this.baseURL}/episodes/${episodeId}/extended`, {
        headers: {
          'Authorization': `Bearer ${this.bearerToken}`
        }
      });

      console.log(`TVDB episode extended response status: ${response.status}`);
      return response.data.data;
    } catch (error) {
      console.error('TVDB episode details fetch failed:', error.response?.data || error.message);
      console.error('Request URL:', `${this.baseURL}/episodes/${episodeId}/extended`);
      return null;
    }
  }

  async findEpisodeBySeasonAndNumber(seriesId, seasonNumber, episodeNumber) {
    try {
      if (!this.isTokenAvailable()) {
        console.log('TVDB bearer token not available');
        return null;
      }
      
      console.log(`Finding episode S${seasonNumber}E${episodeNumber} for series ID: ${seriesId}`);
      
      // Get all seasons for the series
      const seasons = await this.getSeriesSeasons(seriesId);
      if (!seasons || seasons.length === 0) {
        console.log('No seasons found for series');
        return null;
      }
      
      // Find the specific season
      const targetSeason = seasons.find(season => season.number === seasonNumber);
      if (!targetSeason) {
        console.log(`Season ${seasonNumber} not found`);
        return null;      }
      
      // Get extended season details to access episodes
      const seasonExtended = await this.getSeasonExtended(targetSeason.tvdbId);
      if (!seasonExtended || !seasonExtended.episodes) {
        console.log('No episodes found in season extended data');
        return null;
      }
      
      // Find the specific episode
      const targetEpisode = seasonExtended.episodes.find(episode => episode.number === episodeNumber);
      if (!targetEpisode) {
        console.log(`Episode ${episodeNumber} not found in season ${seasonNumber}`);
        return null;
      }
      
      console.log(`Found episode: ${targetEpisode.name} (ID: ${targetEpisode.id})`);
      
      // Get full episode details including finaleType
      const episodeDetails = await this.getEpisodeDetails(targetEpisode.id);
      return episodeDetails;
      
    } catch (error) {
      console.error('Error finding episode by season and number:', error.message);
      return null;
    }
  }

  // Helper method to select English-language artwork from TVDB data
  selectEnglishArtwork(data, type = 'season') {
    try {
      let artworks = [];
        if (type === 'season' && data.artwork) {
        artworks = data.artwork;
      } else if (type === 'series' && data.artwork) {
        artworks = data.artwork;
      }
      
      if (!artworks || artworks.length === 0) {
        console.log(`No artworks array found in ${type} data`);
        return null;
      }
      
      console.log(`Found ${artworks.length} artworks, filtering for English language`);
        // Filter for English artworks (language code 'eng' or null/undefined for default)
      const englishArtworks = artworks.filter(artwork => {
        const isEnglish = !artwork.language || 
                         artwork.language === 'eng' || 
                         artwork.language === 'en' ||
                         artwork.language === null ||
                         artwork.language === undefined;
        // Type 7 = Season poster, Type 6 = Season banner for seasons
        // Type 2 = Series poster, Type 3 = Series banner for series
        const isCorrectType = type === 'season' ? (artwork.type === 7 || artwork.type === 6) : (artwork.type === 2 || artwork.type === 3);
        
        console.log(`Artwork: ${artwork.type}, Language: ${artwork.language || 'null'}, IsEnglish: ${isEnglish}, IsCorrectType: ${isCorrectType}`);
        
        return isEnglish && isCorrectType;
      });
      
      console.log(`Found ${englishArtworks.length} English artworks out of ${artworks.length} total artworks`);
      
      if (englishArtworks.length > 0) {
        // Prefer artworks with higher resolution or score if available
        const sortedArtworks = englishArtworks.sort((a, b) => {
          // Sort by resolution (width * height) if available, then by score
          const aResolution = (a.width || 0) * (a.height || 0);
          const bResolution = (b.width || 0) * (b.height || 0);
          
          if (aResolution !== bResolution) {
            return bResolution - aResolution; // Higher resolution first
          }
          
          return (b.score || 0) - (a.score || 0); // Higher score first
        });
          const selectedArtwork = sortedArtworks[0];
        const artworkUrl = selectedArtwork.image || selectedArtwork.fileName;
        
        console.log(`Selected English artwork: Language: ${selectedArtwork.language || 'null'}, Resolution: ${selectedArtwork.width || 'unknown'}x${selectedArtwork.height || 'unknown'}, Score: ${selectedArtwork.score || 'unknown'}, URL: ${artworkUrl}`);
        
        if (artworkUrl) {
          // Ensure the URL is properly formatted
          if (artworkUrl.startsWith('http')) {
            return artworkUrl;
          } else {
            return `https://artworks.thetvdb.com${artworkUrl}`;
          }
        }
      }
      
      console.log(`No suitable English artwork found for ${type}`);
      return null;
    } catch (error) {
      console.error(`Error selecting English artwork for ${type}:`, error.message);
      return null;
    }
  }  async getCurrentSeasonArtwork(seriesName, currentSeason = null, currentEpisode = null) {
    try {
      console.log(`Searching TVDB for series: ${seriesName}, season: ${currentSeason}, episode: ${currentEpisode}`);
      
      // Check if bearer token is available
      if (!(await this.isTokenAvailable())) {
        console.log('TVDB bearer token not available, skipping TVDB integration');
        return null;
      }
      
      // Search for the series
      const searchResults = await this.searchSeries(seriesName);
      if (!searchResults.length) {
        console.log(`No TVDB results found for: ${seriesName}`);
        return null;
      }

      const series = searchResults[0]; // Take the first (most relevant) result
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
        const seasons = await this.getSeriesSeasons(series.id);
        if (seasons && seasons.length > 0) {
          console.log(`Found ${seasons.length} seasons for ${series.name}`);
          console.log('Season structure:', JSON.stringify(seasons[0], null, 2));
          
          // Find the specific season - try different possible field names
          const targetSeason = seasons.find(season => 
            season.number === currentSeason || 
            season.seasonNumber === currentSeason ||
            season.id === currentSeason
          );
          
          if (targetSeason) {
            console.log(`Found season ${currentSeason}:`, JSON.stringify(targetSeason, null, 2));
            
            // Use the correct ID field for the season
            const seasonId = targetSeason.id || targetSeason.tvdbId || targetSeason.seasonId;
            console.log(`Using season ID: ${seasonId}`);
            
            if (seasonId) {
              // Get extended season details to access artwork with language info
              const seasonExtended = await this.getSeasonExtended(seasonId);
              if (seasonExtended) {
                const englishSeasonArtwork = this.selectEnglishArtwork(seasonExtended, 'season');
                if (englishSeasonArtwork) {
                  console.log(`Found English season ${currentSeason} artwork: ${englishSeasonArtwork}`);                  return {
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
            } else {
              console.log(`No season ID found for season ${currentSeason}`);
            }
            
            // Check if season has artwork directly in the response (fallback)
            if (targetSeason.image) {
              const seasonArtworkUrl = targetSeason.image;
              console.log(`Found season ${currentSeason} artwork: ${seasonArtworkUrl}`);              return {
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
        console.log(`Using series image from search result: ${series.image_url}`);        return {
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
        console.log(`Using series artwork from details: ${artworkUrl}`);        return {
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
}

module.exports = new TVDBService();
