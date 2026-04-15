/**
 * Up Next Service - Shared resolution logic for Up Next content selection
 * Used by both web (plex.js) and Android (contentDiscovery.js) endpoints
 * to guarantee identical behavior regardless of client.
 */

const getNextEpisode = require('../getNextEpisode');
const getNextMovie = require('../getNextMovie');
const { getNextCustomOrder } = require('../getNextCustomOrder');
const HistoryPlusService = require('./historyPlusService');

const historyPlusService = new HistoryPlusService();

/**
 * Format History Plus response (transform video to webvideo format)
 */
function formatHistoryPlusResponse(data) {
  if (data.type === 'video' && data.content) {
    const video = data.content;
    return {
      ratingKey: `history-plus-video-${video.id}`,
      title: data.title,
      type: 'webvideo',
      year: null,
      summary: data.description || '',
      thumb: data.thumbnail,
      art: null,
      webTitle: data.title,
      webUrl: video.url,
      webDescription: data.description || '',
      localArtworkPath: null,
      orderType: 'HISTORY_PLUS',
      customOrderMediaType: 'webvideo',
      eventId: data.eventId,
      eventTitle: data.eventTitle,
      eventTitleWithDates: data.eventTitleWithDates,
      eventDate: data.eventDate,
      channel: data.channel
    };
  }
  // Non-video content (books, chapters, sections) or error messages
  return data;
}

/**
 * Try to fetch History Plus content directly (for fallback)
 */
async function tryGetHistoryPlusContent(mediaTypeLimiters) {
  try {
    const nextEvent = await historyPlusService.getNextUnreviewedEvent();
    if (!nextEvent) return null;

    let allowedTypes = null;
    if (mediaTypeLimiters && !Object.values(mediaTypeLimiters).every(v => v)) {
      allowedTypes = [];
      if (mediaTypeLimiters.webvideo) allowedTypes.push('video');
      if (mediaTypeLimiters.book) allowedTypes.push('book', 'chapter', 'section');
    }

    const randomContent = await historyPlusService.getRandomContentFromEvent(nextEvent, allowedTypes);
    if (!randomContent) return null;

    return { orderType: 'HISTORY_PLUS', ...randomContent };
  } catch (error) {
    console.error('Error in History Plus fallback:', error.message);
    return null;
  }
}

/**
 * Resolve the next Up Next content item.
 * This is the single source of truth for Up Next selection logic.
 * Both web and Android endpoints should call this function.
 * 
 * @param {object} req - Express request object (used for base URL in custom orders)
 * @returns {object} The resolved up next content data
 */
async function resolveUpNext(req) {
  const data = await getNextEpisode(); // Handles order type selection internally

  if (data.orderType === 'MOVIES_GENERAL') {
    console.log('Movie order type selected, using getNextMovie function');
    const movieData = await getNextMovie();
    return movieData;
  }

  if (data.orderType === 'CUSTOM_ORDER') {
    console.log('Custom order type selected, using getNextCustomOrder function');
    const customOrderData = await getNextCustomOrder(req, data.mediaTypeLimiters);

    // Fallback: if no matching items in custom orders and limiters are active, try History Plus
    if (customOrderData.message && data.mediaTypeLimiters) {
      console.log('⚡ Custom Orders had no matching items, falling back to History Plus');
      const fallbackData = await tryGetHistoryPlusContent(data.mediaTypeLimiters);
      if (fallbackData) {
        return formatHistoryPlusResponse(fallbackData);
      }
    }

    return customOrderData;
  }

  if (data.orderType === 'HISTORY_PLUS') {
    console.log('History Plus order type selected, treating video as webvideo');

    // Fallback: if History Plus had no matching content and limiters are active, try Custom Orders
    if (data.message && data.mediaTypeLimiters) {
      console.log('⚡ History Plus had no matching items, falling back to Custom Orders');
      const customOrderData = await getNextCustomOrder(req, data.mediaTypeLimiters);
      if (!customOrderData.message) {
        return customOrderData;
      }
    }

    return formatHistoryPlusResponse(data);
  }

  // TV General selection (default)
  return data;
}

module.exports = { resolveUpNext, formatHistoryPlusResponse, tryGetHistoryPlusContent };
