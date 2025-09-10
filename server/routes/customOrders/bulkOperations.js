/**
 * Custom Orders Bulk Operations Routes
 * Handles bulk item creation, external API integration (ComicVine, TVDB, OpenLibrary)
 */

const express = require('express');
const { extractComicVineMetadata } = require('./utilities/metadataExtractor');

/**
 * Create bulk operations routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createBulkOperationsRoutes(prisma, services) {
  const router = express.Router();
  const { artworkCache } = services;
  
  // Import validation and response utilities
  const { validateCustomOrderItem, validateMediaTypeAndTitle } = require('../../middleware/validation');
  const { sendBadRequest, sendSuccess, sendServerError, asyncHandler, logError } = require('../../utils/responses');

  // Add item to custom order (comprehensive bulk import)
  router.post('/:id/items', validateCustomOrderItem, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const {
      mediaType,
      plexKey,
      title,
      seasonNumber,
      episodeNumber,
      seriesTitle,
      comicSeries,
      comicYear,
      comicIssue,
      comicVolume,
      comicPublisher,
      customTitle,
      comicVineId,
      comicVineDetailsJson,
      comicCoverUrl,
      bookTitle,
      bookAuthor,
      bookYear,
      bookIsbn,
      bookPublisher,
      bookOpenLibraryId,
      bookCoverUrl,
      bookPageCount,
      storyTitle,
      storyAuthor,
      storyYear,
      storyUrl,
      storyContainedInBookId,
      storyCoverUrl,
      webTitle,
      webUrl,
      webDescription
    } = req.body;

    console.log(mediaType);
    
    // Additional media-specific validation (beyond basic middleware)
    if (mediaType === 'episode') {
      // For TV episodes, either plexKey OR (seriesTitle + seasonNumber + episodeNumber) required
      if (!plexKey && (!seriesTitle || seasonNumber === undefined || episodeNumber === undefined)) {
        return sendBadRequest(res, 'For episodes: either plexKey (for existing Plex episodes) OR seriesTitle, seasonNumber, and episodeNumber (for episodes not yet in Plex) are required');
      }
    } else if (mediaType === 'movie') {
      // For movies, either plexKey OR title is required (title alone allows for movies not yet in Plex)
      if (!plexKey && !title) {
        return sendBadRequest(res, 'For movies: either plexKey (for existing Plex movies) OR title (for movies not yet in Plex) is required');
      }
    } else {
      // For other media types, plexKey is still required
      if (!plexKey) {
        return sendBadRequest(res, 'plexKey is required for this media type');
      }
    }

      // Check for duplicate items
      let existingItem;
      
      if (mediaType === 'comic') {
        // For comics, check for duplicates by series, year, issue, and main title
        // This allows the same comic to be added multiple times with different titles
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'comic',
            comicSeries: comicSeries,
            comicYear: comicYear ? parseInt(comicYear) : null,
            comicIssue: comicIssue ? String(comicIssue) : null,
            title: title // Include title to allow same comic with different custom titles
          }
        });
      } else if (mediaType === 'book') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'book',
            bookTitle: bookTitle,
            bookAuthor: bookAuthor,
            bookYear: bookYear ? parseInt(bookYear) : null
          }
        });
      } else if (mediaType === 'shortstory') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'shortstory',
            storyTitle: storyTitle,
            storyAuthor: storyAuthor,
            storyContainedInBookId: storyContainedInBookId ? parseInt(storyContainedInBookId) : null
          }
        });
      } else if (mediaType === 'webvideo') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'webvideo',
            webUrl: webUrl
          }
        });
      } else {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: mediaType,
            plexKey: plexKey || null,
            title: title,
            seriesTitle: seriesTitle || null,
            seasonNumber: seasonNumber !== undefined ? parseInt(seasonNumber) : null,
            episodeNumber: episodeNumber !== undefined ? parseInt(episodeNumber) : null
          }
        });
      }

      if (existingItem) {
        return res.status(409).json({ error: 'This item is already in the custom order' });
      }

      // Get the next sort order
      const lastItem = await prisma.customOrderItem.findFirst({
        where: { customOrderId: parseInt(id) },
        orderBy: { sortOrder: 'desc' }
      });
      const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;

      // Extract ComicVine metadata if available
      const comicVineMetadata = extractComicVineMetadata(comicVineDetailsJson);

      // Create the item
      const item = await prisma.customOrderItem.create({
        data: {
          customOrderId: parseInt(id),
          mediaType,
          plexKey: plexKey || null,
          title,
          seasonNumber: seasonNumber !== undefined ? parseInt(seasonNumber) : null,
          episodeNumber: episodeNumber !== undefined ? parseInt(episodeNumber) : null,
          seriesTitle: seriesTitle || null,
          sortOrder: nextSortOrder,
          // Comic fields (merge provided fields with extracted ComicVine metadata)
          comicSeries: comicSeries || null,
          comicYear: comicYear ? parseInt(comicYear) : null,
          comicIssue: comicIssue ? String(comicIssue) : null,
          comicVolume: comicVolume || null,
          comicPublisher: comicPublisher || comicVineMetadata.comicPublisher || null,
          customTitle: customTitle || null,
          comicVineId: comicVineId ? parseInt(comicVineId) : null,
          comicVineDetailsJson: comicVineDetailsJson || null,
          originalArtworkUrl: comicCoverUrl || null,
          // ComicVine extracted metadata
          comicVineSeriesId: comicVineMetadata.comicVineSeriesId || null,
          comicVineIssueId: comicVineMetadata.comicVineIssueId || null,
          comicIssueName: comicVineMetadata.comicIssueName || null,
          comicDescription: comicVineMetadata.comicDescription || null,
          comicCoverDate: comicVineMetadata.comicCoverDate || null,
          comicStoreDate: comicVineMetadata.comicStoreDate || null,
          // Book fields
          bookTitle: bookTitle || null,
          bookAuthor: bookAuthor || null,
          bookYear: bookYear ? parseInt(bookYear) : null,
          bookIsbn: bookIsbn || null,
          bookPublisher: bookPublisher || null,
          bookOpenLibraryId: bookOpenLibraryId || null,
          bookCoverUrl: bookCoverUrl || null,
          bookPageCount: bookPageCount ? parseInt(bookPageCount) : null,
          // Story fields
          storyTitle: storyTitle || null,
          storyAuthor: storyAuthor || null,
          storyYear: storyYear ? parseInt(storyYear) : null,
          storyUrl: storyUrl || null,
          storyContainedInBookId: storyContainedInBookId ? parseInt(storyContainedInBookId) : null,
          storyCoverUrl: storyCoverUrl || null,
          // Web video fields
          webTitle: webTitle || null,
          webUrl: webUrl || null,
          webDescription: webDescription || null
        }
      });

      // After creation, try to update with TVDB data if applicable
      if (mediaType === 'episode' || mediaType === 'movie') {
        try {
          const tvdbService = require('../../tvdbService');
          
          if (mediaType === 'episode' && seriesTitle) {
            // Search for the TV series
            const searchResults = await tvdbService.searchTVSeries(seriesTitle);
            if (searchResults && searchResults.length > 0) {
              const seriesData = searchResults[0];
              
              // Get detailed series information
              const seriesDetails = await tvdbService.getTVSeriesDetails(seriesData.tvdb_id);
              if (seriesDetails && seriesDetails.seasons) {
                const targetSeason = seriesDetails.seasons.find(s => s.number === parseInt(seasonNumber));
                if (targetSeason && targetSeason.episodes) {
                  const targetEpisode = targetSeason.episodes.find(e => e.number === parseInt(episodeNumber));
                  if (targetEpisode) {
                    // Update the item with TVDB details
                    await prisma.customOrderItem.update({
                      where: { id: item.id },
                      data: {
                        tvdbId: targetEpisode.id?.toString(),
                        tvdbOverview: targetEpisode.overview,
                        // You can add more fields here like air date, rating, etc.
                      }
                    });
                  }
                }
              }
            }
          } else if (mediaType === 'movie' && title) {
            // Search for the movie
            const searchResults = await tvdbService.searchMovies(title);
            if (searchResults && searchResults.length > 0) {
              const movieData = searchResults[0];
              
              // Get detailed movie information
              const movieDetails = await tvdbService.getMovieDetails(movieData.tvdb_id);
              if (movieDetails) {
                // Update the item with TVDB details
                await prisma.customOrderItem.update({
                  where: { id: item.id },
                  data: {
                    // Keep the title from bulk import data, don't overwrite with TVDB movie name
                    // Store other TVDB metadata fields if needed
                    tvdbId: movieDetails.id?.toString(),
                    tvdbOverview: movieDetails.overview,
                    // You can add more fields here like genres, release date, etc.
                  }
                });
              }
            }
          }
        } catch (error) {
          console.warn(`Failed to fetch TVDB metadata for ${mediaType} "${title || seriesTitle}":`, error.message);
          // Don't fail the whole request if TVDB lookup fails
        }
      }
      
      // Try to cache artwork for the new item (async, don't wait for completion)
      if (artworkCache) {
        artworkCache.ensureArtworkCached(item).catch(error => {
        console.warn(`Failed to cache artwork for item ${item.id}:`, error.message);
      });
    }
    
    res.status(201).json(item);
  }));

  // Add TVDB-only item to custom order (doesn't exist in Plex yet)
  router.post('/:id/items/tvdb-only', validateMediaTypeAndTitle, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { 
      mediaType, 
      title, 
      seasonNumber, 
      episodeNumber, 
      seriesTitle,
      tvdbSeriesId,
      tvdbSeasonId,
      tvdbEpisodeId,
      description,
      airDate,
      // Movie fields
      year,
      movieTvdbId
    } = req.body;

    console.log(`Adding TVDB-only ${mediaType} to custom order ${id}:`, { title, seriesTitle, seasonNumber, episodeNumber });

    // For episodes, we need series info
    if (mediaType === 'episode' && (!seriesTitle || seasonNumber === undefined || episodeNumber === undefined)) {
      return sendBadRequest(res, 'For TVDB episodes: seriesTitle, seasonNumber, and episodeNumber are required');
    }

      // Generate a unique plexKey for TVDB-only items (they don't have real Plex keys)
      const finalPlexKey = `tvdb-${mediaType}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      // Get the next sort order
      const lastItem = await prisma.customOrderItem.findFirst({
        where: { customOrderId: parseInt(id) },
        orderBy: { sortOrder: 'desc' }
      });
      const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;

      const item = await prisma.customOrderItem.create({
        data: {
          customOrderId: parseInt(id),
          mediaType,
          plexKey: finalPlexKey,
          title,
          seasonNumber,
          episodeNumber,
          seriesTitle,
          sortOrder: nextSortOrder,
          isFromTvdbOnly: true, // Mark as TVDB-only
          // Store TVDB IDs and metadata in custom fields for now
          customTitle: description || title,
          // For episodes, we'll store TVDB data in unused fields temporarily
          comicSeries: tvdbSeriesId ? `tvdb-series-${tvdbSeriesId}` : null,
          comicVolume: tvdbSeasonId ? `tvdb-season-${tvdbSeasonId}` : null,
          comicIssue: tvdbEpisodeId ? `tvdb-episode-${tvdbEpisodeId}` : null,
          // For movies
          bookTitle: mediaType === 'movie' ? title : null,
          bookYear: mediaType === 'movie' ? parseInt(year) : null,
          bookIsbn: movieTvdbId ? `tvdb-movie-${movieTvdbId}` : null,
          // Store air date if provided
          storyYear: airDate ? new Date(airDate).getFullYear() : null
        }
      });

    console.log(`Successfully added TVDB-only ${mediaType}: ${title}`);
    res.status(201).json(item);
  }));

  return router;
}

module.exports = createBulkOperationsRoutes;
