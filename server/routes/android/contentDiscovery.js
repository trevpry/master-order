/**
 * Android Content Discovery Routes
 * Handles up next content retrieval and formatting for Android app
 */

const express = require('express');
const { getAndroidApiBaseUrl, getAndroidArtworkUrl, createAndroidResponse, createAndroidErrorResponse } = require('./utilities/androidHelpers');
const { resolveUpNext } = require('../../services/upNextService');

/**
 * Create content discovery routes for Android app
 * @returns {express.Router} Configured router
 */
function createContentDiscoveryRoutes() {
  const router = express.Router();

  // Android companion app endpoint - Get Up Next
  // Uses the shared resolveUpNext service to guarantee identical content selection
  // as the web app endpoint (/api/plex/up-next). Only the response formatting differs.
  router.get('/up-next', async (req, res) => {
    console.log('📱 Android app requesting up next content...');
    
    try {
      // Use shared Up Next resolution - identical logic to web endpoint
      const upNextData = await resolveUpNext(req);
      
      console.log('📱 resolveUpNext() returned:', {
        orderType: upNextData?.orderType,
        type: upNextData?.type,
        title: upNextData?.title,
        ratingKey: upNextData?.ratingKey
      });
      
      // Get base URL for Android API (needed for artwork URLs)
      const baseUrl = getAndroidApiBaseUrl();
      
      if (!upNextData || upNextData.error) {
        return res.status(404).json(createAndroidErrorResponse(
          'NO_CONTENT',
          'No content available',
          upNextData?.error || 'No content found for up next.'
        ));
      }
      
      // Format the resolved data into Android response structure
      const androidResponse = formatAndroidResponse(upNextData, baseUrl);
      
      console.log('📱 Sending Android companion up next response:', JSON.stringify(androidResponse, null, 2));
      res.json(androidResponse);
      
    } catch (error) {
      console.error('❌ Error in Android up next endpoint:', error);
      res.status(500).json(createAndroidErrorResponse(
        'INTERNAL_ERROR',
        'Internal server error',
        error.message
      ));
    }
  });

  return router;
}

/**
 * Format resolved Up Next data into Android-specific response structure.
 * This only handles presentation formatting - all content selection and
 * filtering logic is handled by the shared resolveUpNext service.
 */
function formatAndroidResponse(upNextData, baseUrl) {
  if (upNextData.orderType === 'MOVIES_GENERAL') {
    const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);
    // See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 5): arr-backed
    // movies (libraryUpNextService.js) have no real Plex ratingKey/plexId -
    // the app should rely on `streamUrl` (and `mediaId` + `/api/stream/...`
    // for HLS fallback) directly instead of any Plex cast/play-plex flow.
    const isArrBacked = upNextData.libraryProvider === 'arr';
    return {
      type: 'PLAY_MOVIE',
      data: {
        ratingKey: upNextData.ratingKey,
        plexId: isArrBacked ? null : upNextData.ratingKey,
        libraryProvider: upNextData.libraryProvider || 'plex',
        mediaId: isArrBacked ? upNextData.id : null,
        title: upNextData.title,
        year: upNextData.year,
        duration: upNextData.duration || 0,
        summary: upNextData.summary || '',
        studio: upNextData.studio || 'Unknown Studio',
        rating: upNextData.rating || 0,
        thumb: upNextData.thumb || '',
        art: upNextData.art || '',
        artworkUrl: artworkUrl || '',
        streamUrl: upNextData.streamUrl || '',
        otherCollections: upNextData.otherCollections || []
      }
    };
  }

  if (upNextData.orderType === 'CUSTOM_ORDER') {
    return formatAndroidCustomOrderResponse(upNextData, baseUrl);
  }

  if (upNextData.orderType === 'HISTORY_PLUS') {
    return formatAndroidHistoryPlusResponse(upNextData, baseUrl);
  }

  // TV Show response (default) - use PLAY_TV_EPISODE type
  return formatAndroidTVResponse(upNextData, baseUrl);
}

function formatAndroidCustomOrderResponse(upNextData, baseUrl) {
  const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);

  // For episodes in custom orders, make sure we use the episode rating key
  let episodeRatingKey = upNextData.ratingKey;
  if (upNextData.type === 'episode' && upNextData.episodeRatingKey) {
    episodeRatingKey = upNextData.episodeRatingKey;
    console.log('📱 Using episode-specific rating key for Android:', episodeRatingKey);
  }

  const baseData = {
    id: upNextData.customOrderItemId || upNextData.id,
    title: upNextData.title,
    type: upNextData.type,
    orderName: upNextData.customOrderName || 'Custom Order',
    summary: upNextData.summary || '',
    duration: upNextData.duration || 0,
    localArtworkPath: upNextData.localArtworkPath || '',
    artworkUrl: artworkUrl || '',
    streamUrl: upNextData.streamUrl || '',
    ratingKey: episodeRatingKey || null,
    plexId: episodeRatingKey || null,
    webUrl: upNextData.webUrl || null,
    customOrderId: upNextData.customOrderId || null,
    customOrderItemId: upNextData.customOrderItemId || null,
    // Playlist information
    ...(upNextData.playlistName && {
      playlistName: upNextData.playlistName,
      playlistType: upNextData.playlistType
    }),
    // Background gallery information
    ...(upNextData.backgroundGalleryName && {
      backgroundGalleryName: upNextData.backgroundGalleryName,
      backgroundGalleryId: upNextData.backgroundGalleryId
    }),
    // Episode-specific fields for custom orders
    ...(upNextData.type === 'episode' && {
      seasonNumber: upNextData.seasonNumber || upNextData.currentSeason || null,
      episodeNumber: upNextData.episodeNumber || upNextData.currentEpisode || null,
      episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
      seriesTitle: upNextData.seriesTitle || upNextData.grandparentTitle || null
    }),
    // Book-specific fields for custom order books
    ...(upNextData.type === 'book' && {
      bookTitle: upNextData.bookTitle,
      bookAuthor: upNextData.bookAuthor,
      bookYear: upNextData.bookYear,
      bookIsbn: upNextData.bookIsbn,
      bookPublisher: upNextData.bookPublisher,
      bookPageCount: upNextData.bookPageCount,
      bookCoverUrl: upNextData.bookCoverUrl || upNextData.thumb || upNextData.art,
      bookDescription: upNextData.bookDetails?.description || upNextData.summary || '',
      bookOpenLibraryId: upNextData.bookOpenLibraryId,
      ...(upNextData.chapterNumber && {
        chapterNumber: upNextData.chapterNumber,
        chapterTitle: upNextData.chapterTitle,
        chapterDescription: upNextData.chapterDescription
      }),
      ...(upNextData.sectionNumber && {
        sectionNumber: upNextData.sectionNumber,
        sectionTitle: upNextData.sectionTitle,
        sectionDescription: upNextData.sectionDescription
      }),
      ...(upNextData.pageStart && {
        pageStart: upNextData.pageStart,
        pageEnd: upNextData.pageEnd
      })
    })
  };

  return { type: 'PLAY_CUSTOM_ORDER_ITEM', data: baseData };
}

function formatAndroidHistoryPlusResponse(upNextData, baseUrl) {
  const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);

  if (upNextData.type === 'webvideo') {
    return {
      type: 'PLAY_CUSTOM_ORDER_ITEM',
      data: {
        id: upNextData.ratingKey,
        title: upNextData.title,
        type: upNextData.type,
        orderName: `History Plus: ${upNextData.eventTitleWithDates || upNextData.eventTitle}`,
        summary: upNextData.summary || '',
        duration: 0,
        localArtworkPath: upNextData.localArtworkPath || '',
        artworkUrl: artworkUrl || '',
        streamUrl: '',
        ratingKey: null,
        plexId: null,
        webUrl: upNextData.webUrl || null,
        webTitle: upNextData.webTitle,
        webDescription: upNextData.webDescription,
        customOrderId: null,
        customOrderItemId: null,
        eventId: upNextData.eventId,
        eventTitle: upNextData.eventTitle,
        eventTitleWithDates: upNextData.eventTitleWithDates,
        eventDate: upNextData.eventDate,
        channel: upNextData.channel
      }
    };
  }

  // Non-webvideo History Plus content (books, chapters, sections)
  const bookArtworkUrl = upNextData.bookCoverUrl || '';

  return {
    type: 'PLAY_CUSTOM_ORDER_ITEM',
    data: {
      id: `history-plus-${upNextData.type}-${upNextData.content?.id || 'unknown'}`,
      title: upNextData.title,
      type: 'book',
      orderName: 'History Plus Reading',
      summary: upNextData.description || '',
      duration: 0,
      localArtworkPath: bookArtworkUrl,
      artworkUrl: bookArtworkUrl,
      streamUrl: null,
      ratingKey: null,
      plexId: null,
      webUrl: null,
      customOrderId: 'history-plus',
      customOrderItemId: `hp-${upNextData.type}-${upNextData.content?.id || 'unknown'}`,
      bookTitle: upNextData.bookTitle,
      bookAuthor: upNextData.bookAuthor,
      bookYear: upNextData.bookYear,
      bookIsbn: upNextData.bookIsbn,
      bookPublisher: upNextData.bookPublisher,
      bookPageCount: upNextData.bookPageCount,
      bookCoverUrl: upNextData.bookCoverUrl,
      bookDescription: upNextData.bookDescription,
      ...(upNextData.chapterNumber && {
        chapterNumber: upNextData.chapterNumber,
        chapterTitle: upNextData.chapterTitle,
        chapterDescription: upNextData.chapterDescription
      }),
      ...(upNextData.sectionNumber && {
        sectionNumber: upNextData.sectionNumber,
        sectionTitle: upNextData.sectionTitle,
        sectionDescription: upNextData.sectionDescription
      }),
      ...(upNextData.pageStart && {
        pageStart: upNextData.pageStart,
        pageEnd: upNextData.pageEnd
      }),
      historyPlus: {
        orderType: upNextData.orderType,
        contentType: upNextData.type,
        eventId: upNextData.eventId,
        eventTitle: upNextData.eventTitle,
        eventTitleWithDates: upNextData.eventTitleWithDates,
        eventDate: upNextData.eventDate,
        contentId: upNextData.content?.id,
        chapterId: upNextData.type === 'chapter'
          ? upNextData.content?.id
          : (upNextData.content?.chapterId || upNextData.content?.chapter?.id),
        sectionId: upNextData.type === 'section' ? upNextData.content?.id : null,
        bookId: upNextData.type === 'book'
          ? upNextData.content?.id
          : (upNextData.content?.bookId || upNextData.content?.book?.id || upNextData.content?.chapter?.book?.id)
      }
    }
  };
}

function formatAndroidTVResponse(upNextData, baseUrl) {
  const artworkUrl = getAndroidArtworkUrl(upNextData, baseUrl);

  // See SONARR_RADARR_DIRECT_PLAY_MIGRATION_PLAN.md (Phase 5): arr-backed
  // episodes (libraryUpNextService.js) use synthetic string ids like
  // "episode-3"/"show-3" - there's no real Plex ratingKey/plexId, and the
  // thumb/art fields are already-resolved Radarr/TMDB poster/fanart URLs
  // (not Plex relative paths), so none of the Plex-specific rewriting below
  // applies to them.
  const isArrBacked = upNextData.libraryProvider === 'arr';

  let episodeRatingKey = upNextData.ratingKey;
  let seriesRatingKey = upNextData.ratingKey;

  if (upNextData.episodeRatingKey) {
    episodeRatingKey = upNextData.episodeRatingKey;
  } else if (upNextData.currentEpisodeRatingKey) {
    episodeRatingKey = upNextData.currentEpisodeRatingKey;
  } else if (upNextData.nextEpisodeRatingKey) {
    episodeRatingKey = upNextData.nextEpisodeRatingKey;
  }

  let episodeThumb = upNextData.thumb || '';
  let episodeArt = upNextData.art || '';

  if (!isArrBacked && episodeRatingKey && episodeRatingKey !== seriesRatingKey) {
    const thumbMatch = upNextData.thumb?.match(/\/(\d+)$/);
    const artMatch = upNextData.art?.match(/\/(\d+)$/);
    const thumbTimestamp = thumbMatch ? thumbMatch[1] : Date.now();
    const artTimestamp = artMatch ? artMatch[1] : Date.now();

    episodeThumb = `/library/metadata/${episodeRatingKey}/thumb/${thumbTimestamp}`;
    episodeArt = `/library/metadata/${episodeRatingKey}/art/${artTimestamp}`;
  }

  return {
    type: 'PLAY_TV_EPISODE',
    data: {
      ratingKey: episodeRatingKey,
      episodeRatingKey: episodeRatingKey,
      seriesRatingKey: seriesRatingKey,
      plexId: isArrBacked ? null : episodeRatingKey,
      libraryProvider: upNextData.libraryProvider || 'plex',
      mediaId: isArrBacked ? upNextData.episodeId : null,
      title: upNextData.title,
      episodeTitle: upNextData.episodeTitle || upNextData.nextEpisodeTitle || null,
      summary: upNextData.summary || '',
      episodeSummary: upNextData.episodeSummary || null,
      leafCount: upNextData.leafCount || 0,
      viewedLeafCount: upNextData.viewedLeafCount || 0,
      seasonNumber: upNextData.currentSeason || upNextData.seasonNumber || null,
      episodeNumber: upNextData.currentEpisode || upNextData.episodeNumber || null,
      isFinalSeason: upNextData.isCurrentSeasonFinal || false,
      thumb: episodeThumb,
      art: episodeArt,
      artworkUrl: artworkUrl || '',
      streamUrl: upNextData.streamUrl || '',
      otherCollections: upNextData.otherCollections || []
    }
  };
}

module.exports = createContentDiscoveryRoutes;
