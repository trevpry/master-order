/**
 * Custom Orders Bulk Operations Routes
 * Handles bulk item creation, external API integration (ComicVine, TVDB, OpenLibrary)
 */

const express = require('express');
const { extractComicVineMetadata } = require('./utilities/metadataExtractor');
const PlexDatabaseService = require('../../plexDatabaseService');

/**
 * Create bulk operations routes for custom orders
 * @param {PrismaClient} prisma - Database client instance
 * @param {object} services - Service dependencies
 * @returns {express.Router} Configured router
 */
function createBulkOperationsRoutes(prisma, services) {
  const router = express.Router();
  const { artworkCache, bookService } = services;
  const plexDb = new PlexDatabaseService();
  
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
      webDescription,
      // Game fields
      gameTitle,
      gameId,
      // Reference fields
      bookId,
      // Suborder fields
      referencedCustomOrderId,
      // Artwork fields
      originalArtworkUrl
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
    } else if (mediaType === 'comic' || mediaType === 'book' || mediaType === 'shortstory' || mediaType === 'webvideo' || mediaType === 'game' || mediaType === 'suborder') {
      // Comics, books, short stories, web videos, games, and suborders don't require plexKey
      console.log(`Processing ${mediaType} without plexKey requirement`);
      if (mediaType === 'suborder') {
        if (!referencedCustomOrderId) {
          return sendBadRequest(res, 'referencedCustomOrderId is required for suborder items');
        }
        if (parseInt(referencedCustomOrderId) === parseInt(id)) {
          return sendBadRequest(res, 'Cannot add an order as a sub-order of itself');
        }
        const referencedOrder = await prisma.customOrder.findUnique({ where: { id: parseInt(referencedCustomOrderId) } });
        if (!referencedOrder) {
          return sendBadRequest(res, 'Referenced order not found');
        }
      }
    } else {
      // For other media types, plexKey is still required
      if (!plexKey) {
        return sendBadRequest(res, 'plexKey is required for this media type');
      }
    }

      // Resolve episode imports to real Plex episode metadata when possible.
      // This prevents placeholder-only episodes from being stored during bulk imports.
      let finalPlexKey = plexKey || null;
      let finalTitle = title;
      let finalSeriesTitle = seriesTitle || null;
      let finalSeasonNumber = seasonNumber !== undefined ? parseInt(seasonNumber) : null;
      let finalEpisodeNumber = episodeNumber !== undefined ? parseInt(episodeNumber) : null;

      if (
        mediaType === 'episode' &&
        finalSeriesTitle &&
        Number.isInteger(finalSeasonNumber) &&
        Number.isInteger(finalEpisodeNumber)
      ) {
        try {
          const matches = await plexDb.searchTVEpisodes(finalSeriesTitle, finalSeasonNumber, finalEpisodeNumber);
          if (matches && matches.length > 0) {
            const normalizedSeries = finalSeriesTitle.toLowerCase().trim();
            const exactMatch = matches.find(match => {
              const candidateSeries = (match.showTitle || match.grandparentTitle || '').toLowerCase().trim();
              return candidateSeries === normalizedSeries;
            });

            if (exactMatch) {
              const plexEpisode = exactMatch;
              finalPlexKey = plexEpisode.ratingKey || finalPlexKey;
              finalTitle = plexEpisode.title || finalTitle;
              finalSeriesTitle = plexEpisode.showTitle || plexEpisode.grandparentTitle || finalSeriesTitle;
              finalSeasonNumber = Number.isInteger(plexEpisode.seasonIndex) ? plexEpisode.seasonIndex : finalSeasonNumber;
              finalEpisodeNumber = Number.isInteger(plexEpisode.index) ? plexEpisode.index : finalEpisodeNumber;

              console.log(`Resolved bulk episode to Plex metadata: ${finalSeriesTitle} S${finalSeasonNumber}E${finalEpisodeNumber} -> ${finalTitle} (${finalPlexKey})`);
            } else {
              console.log(`Plex episode candidates found but series mismatch for ${finalSeriesTitle} S${finalSeasonNumber}E${finalEpisodeNumber}; storing unresolved placeholder`);
            }
          } else {
            console.log(`No Plex match found for bulk episode ${finalSeriesTitle} S${finalSeasonNumber}E${finalEpisodeNumber}; storing as unresolved placeholder`);
          }
        } catch (plexLookupError) {
          console.warn(`Failed Plex episode resolution for ${finalSeriesTitle} S${finalSeasonNumber}E${finalEpisodeNumber}:`, plexLookupError.message);
        }
      }

      // Check for duplicate items
      let existingItem;
      
      if (mediaType === 'comic') {
        // For comics, allow duplicate comic identity entries when the effective display title differs.
        // Effective display title is customTitle when present, otherwise title.
        const candidateDisplayTitle = (customTitle || title || '').trim();
        const matchingComics = await prisma.customOrderItem.findMany({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'comic',
            comicSeries: comicSeries,
            comicYear: comicYear ? parseInt(comicYear) : null,
            comicIssue: comicIssue ? String(comicIssue) : null
          },
          select: {
            id: true,
            title: true,
            customTitle: true,
            mediaType: true
          }
        });

        existingItem = matchingComics.find((item) => {
          const existingDisplayTitle = (item.customTitle || item.title || '').trim();
          return existingDisplayTitle === candidateDisplayTitle;
        });
      } else if (mediaType === 'book') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'book',
            title: bookTitle,
            // Use unified Book system to identify duplicates
            book: bookOpenLibraryId ? {
              openLibraryId: bookOpenLibraryId
            } : undefined
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
      } else if (mediaType === 'game') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'game',
            title: title,
            gameId: gameId ? parseInt(gameId) : null
          }
        });
      } else if (mediaType === 'suborder') {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: 'suborder',
            referencedCustomOrderId: parseInt(referencedCustomOrderId)
          }
        });
      } else {
        existingItem = await prisma.customOrderItem.findFirst({
          where: {
            customOrderId: parseInt(id),
            mediaType: mediaType,
            plexKey: mediaType === 'episode' ? finalPlexKey : (plexKey || null),
            title: mediaType === 'episode' ? finalTitle : title,
            seriesTitle: mediaType === 'episode' ? finalSeriesTitle : (seriesTitle || null),
            seasonNumber: mediaType === 'episode' ? finalSeasonNumber : (seasonNumber !== undefined ? parseInt(seasonNumber) : null),
            episodeNumber: mediaType === 'episode' ? finalEpisodeNumber : (episodeNumber !== undefined ? parseInt(episodeNumber) : null)
          }
        });
      }

      if (existingItem) {
        return res.status(409).json({
          error: 'This item is already in the custom order',
          existingItem: {
            title: existingItem.title || (mediaType === 'episode' ? finalTitle : title) || 'This item',
            mediaType: existingItem.mediaType || mediaType
          }
        });
      }

      // Get the next sort order
      const lastItem = await prisma.customOrderItem.findFirst({
        where: { customOrderId: parseInt(id) },
        orderBy: { sortOrder: 'desc' }
      });
      const nextSortOrder = lastItem ? lastItem.sortOrder + 1 : 1;

      // Extract ComicVine metadata if available
      const comicVineMetadata = extractComicVineMetadata(comicVineDetailsJson);
      
      // Log character extraction for debugging
      if (mediaType === 'comic' && comicVineDetailsJson) {
        console.log(`📊 [BULK IMPORT] Comic: "${title}" - Characters extracted: ${comicVineMetadata.comicCharacters ? 'YES' : 'NO'}`);
        if (comicVineMetadata.comicCharacters) {
          try {
            const characterData = JSON.parse(comicVineMetadata.comicCharacters);
            console.log(`📊 [BULK IMPORT] Character count: ${characterData.length}`);
          } catch (e) {
            console.log(`📊 [BULK IMPORT] Character data format: ${typeof comicVineMetadata.comicCharacters}`);
          }
        }
      }

      // Create the item
      const item = await prisma.customOrderItem.create({
        data: {
          customOrderId: parseInt(id),
          mediaType,
          plexKey: mediaType === 'episode' ? finalPlexKey : (plexKey || null),
          title: mediaType === 'episode' ? finalTitle : title,
          seasonNumber: mediaType === 'episode' ? finalSeasonNumber : (seasonNumber !== undefined ? parseInt(seasonNumber) : null),
          episodeNumber: mediaType === 'episode' ? finalEpisodeNumber : (episodeNumber !== undefined ? parseInt(episodeNumber) : null),
          seriesTitle: mediaType === 'episode' ? finalSeriesTitle : (seriesTitle || null),
          sortOrder: nextSortOrder,
          // Comic fields (merge provided fields with extracted ComicVine metadata)
          comicSeries: comicSeries || null,
          comicYear: comicYear ? parseInt(comicYear) : null,
          comicIssue: comicIssue ? String(comicIssue) : null,
          comicVolume: comicVolume || null,
          comicPublisher: comicPublisher || comicVineMetadata.comicPublisher || null,
          customTitle: customTitle || null,
          comicVineId: comicVineId || null,  // Store as string (URL), not integer
          comicVineDetailsJson: comicVineDetailsJson || null,
          originalArtworkUrl: originalArtworkUrl || comicCoverUrl || comicVineMetadata.comicCoverUrl || storyCoverUrl || bookCoverUrl || null,
          // ComicVine extracted metadata
          comicVineSeriesId: comicVineMetadata.comicVineSeriesId || null,
          comicVineIssueId: comicVineMetadata.comicVineIssueId || null,
          comicIssueName: comicVineMetadata.comicIssueName || null,
          comicDescription: comicVineMetadata.comicDescription || null,
          comicCoverDate: comicVineMetadata.comicCoverDate || null,
          comicStoreDate: comicVineMetadata.comicStoreDate || null,
          comicCreators: comicVineMetadata.comicPersonCredits || null,  // JSON string with all creator roles
          comicCharacters: comicVineMetadata.comicCharacters || null,   // Character names
          comicStoryArcs: comicVineMetadata.comicConcepts || null,      // Concepts/story arcs
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
          webDescription: webDescription || null,
          // Book and Game references
          bookId: bookId ? parseInt(bookId) : null,
          gameId: gameId ? parseInt(gameId) : null,
          // Suborder reference
          referencedCustomOrderId: mediaType === 'suborder' && referencedCustomOrderId ? parseInt(referencedCustomOrderId) : null
        }
      });

      if (mediaType === 'comic') {
        console.log('Comic item created successfully with ComicVine metadata');
      }

      // Create unified Book record for book items
      if (mediaType === 'book' && bookService) {
        try {
          const bookData = {
            title: bookTitle,
            author: bookAuthor,
            isbn: bookIsbn,
            publisher: bookPublisher,
            publishYear: bookYear ? parseInt(bookYear) : null,
            coverUrl: bookCoverUrl,
            pageCount: bookPageCount ? parseInt(bookPageCount) : null,
            openLibraryId: bookOpenLibraryId
          };

          // Create or find existing Book record (createBook handles duplicates)
          const book = await bookService.createBook(bookData);
          
          // Update the CustomOrderItem to reference the unified Book
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: { bookId: book.id }
          });

          console.log(`📚 Created/linked unified Book record for CustomOrderItem: "${bookTitle}" (Book ID: ${book.id})`);
        } catch (error) {
          console.warn(`⚠️ Failed to create unified Book record for "${bookTitle}":`, error.message);
          // Don't fail the CustomOrderItem creation if Book creation fails
        }
      }

      // Create unified VideoGame record for game items
      if (mediaType === 'game' && (gameTitle || title)) {
        try {
          const RawgService = require('../../services/rawgService');
          const rawgService = new RawgService();
          
          const gameData = {
            title: gameTitle || title,
            webvideoUrl: webUrl || null,
            // Additional fields can be populated from RAWG API later
            description: webDescription || null
          };

          // Create or find existing VideoGame record
          const game = await rawgService.createGame(gameData);
          
          // Update the CustomOrderItem to reference the unified VideoGame
          await prisma.customOrderItem.update({
            where: { id: item.id },
            data: { gameId: game.id }
          });

          console.log(`🎮 Created/linked unified VideoGame record for CustomOrderItem: "${gameData.title}" (Game ID: ${game.id})`);
          
          // If there's a webvideo URL, also log it
          if (webUrl) {
            console.log(`🔗 Associated webvideo URL: ${webUrl}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to create unified VideoGame record for "${gameTitle || title}":`, error.message);
          // Don't fail the CustomOrderItem creation if VideoGame creation fails
        }
      }

      // After creation, try to update with TVDB data if applicable
      if (mediaType === 'episode' || mediaType === 'movie') {
        try {
          const tvdbService = require('../../tvdbService');
          
          if (mediaType === 'episode' && finalSeriesTitle) {
            // Search for the TV series
            const searchResults = await tvdbService.searchSeries(finalSeriesTitle);
            if (searchResults && searchResults.length > 0) {
              const seriesData = searchResults[0];
              
              // Get detailed series information
              const seriesId = seriesData.tvdb_id || seriesData.id;
              const seriesDetails = seriesId ? await tvdbService.getSeriesDetails(seriesId) : null;
              if (seriesDetails && seriesDetails.seasons) {
                const targetSeason = seriesDetails.seasons.find(s => s.number === parseInt(finalSeasonNumber));
                if (targetSeason && targetSeason.episodes) {
                  const targetEpisode = targetSeason.episodes.find(e => e.number === parseInt(finalEpisodeNumber));
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
      
      // Cache artwork for the new item (synchronous to ensure it's ready before response)
      if (artworkCache) {
        try {
          await artworkCache.ensureArtworkCached(item);
          console.log(`Successfully cached artwork for item ${item.id}`);
        } catch (error) {
          console.warn(`Failed to cache artwork for item ${item.id}:`, error.message);
          // Don't fail the request if artwork caching fails
        }
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
