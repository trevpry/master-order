const prisma = require('./prismaClient');

async function getSettings() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });

    if (!settings) {
      // Create default settings if none exist
      settings = {
        id: 1,
        plexToken: process.env.PLEX_TOKEN || null,
        plexUrl: process.env.PLEX_URL || 'http://localhost:32400',
        tvdbApiKey: process.env.TVDB_API_KEY || null,
        tvdbBearerToken: process.env.TVDB_BEARER_TOKEN || null,
        collectionName: null,
        comicVineApiKey: null,
        tvGeneralPercent: 50,
        moviesGeneralPercent: 50,
        customOrderPercent: 0,
        partiallyWatchedCollectionPercent: 75,
        plexSyncInterval: 12,
        ignoredMovieCollections: null,
        ignoredTVCollections: null
      };
    }

    // Parse JSON strings for ignored collections if they exist
    if (settings.ignoredMovieCollections && typeof settings.ignoredMovieCollections === 'string') {
      try {
        settings.ignoredMovieCollections = JSON.parse(settings.ignoredMovieCollections);
      } catch (e) {
        console.warn('Failed to parse ignoredMovieCollections JSON:', e);
        settings.ignoredMovieCollections = [];
      }
    }

    if (settings.ignoredTVCollections && typeof settings.ignoredTVCollections === 'string') {
      try {
        settings.ignoredTVCollections = JSON.parse(settings.ignoredTVCollections);
      } catch (e) {
        console.warn('Failed to parse ignoredTVCollections JSON:', e);
        settings.ignoredTVCollections = [];
      }
    }

    // Set default arrays if null
    if (!settings.ignoredMovieCollections) {
      settings.ignoredMovieCollections = [];
    }
    if (!settings.ignoredTVCollections) {
      settings.ignoredTVCollections = [];
    }

    return settings;
  } catch (error) {
    console.error('Failed to fetch settings from database:', error);
    // Return fallback settings with error values
    return {
      id: 1,
      plexToken: process.env.PLEX_TOKEN || null,
      plexUrl: process.env.PLEX_URL || 'http://localhost:32400',
      tvdbApiKey: process.env.TVDB_API_KEY || null,
      tvdbBearerToken: process.env.TVDB_BEARER_TOKEN || null,
      collectionName: null,
      comicVineApiKey: null,
      tvGeneralPercent: 50,
      moviesGeneralPercent: 50,
      customOrderPercent: 0,
      partiallyWatchedCollectionPercent: 75,
      plexSyncInterval: 12,
      ignoredMovieCollections: [],
      ignoredTVCollections: []
    };
  }
}

async function getPlexToken() {
  const settings = await getSettings();
  return settings.plexToken;
}

async function getPlexUrl() {
  const settings = await getSettings();
  return settings.plexUrl;
}

async function getTvdbApiKey() {
  const settings = await getSettings();
  return settings.tvdbApiKey;
}

async function getTvdbBearerToken() {
  const settings = await getSettings();
  return settings.tvdbBearerToken;
}

async function getPlexSyncInterval() {
  const settings = await getSettings();
  return settings.plexSyncInterval;
}

module.exports = {
  getSettings,
  getPlexToken,
  getPlexUrl,
  getTvdbApiKey,
  getTvdbBearerToken,
  getPlexSyncInterval
};
