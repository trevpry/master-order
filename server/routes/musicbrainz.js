const express = require('express');
const router = express.Router();
const { asyncHandler, sendSuccess, sendServerError } = require('../utils/responses');

// MusicBrainz API configuration
const MUSICBRAINZ_API_BASE = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'EddieLifeManagement/1.0.0 (https://github.com/eddie-life)'; // Required by MusicBrainz
const RATE_LIMIT_DELAY = 1100; // 1.1 seconds between requests (MusicBrainz requires 1 req/sec max)

// Rate limiting state
let lastRequestTime = 0;

/**
 * Wait to respect MusicBrainz rate limiting (1 request per second)
 */
async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  lastRequestTime = Date.now();
}

/**
 * Make a request to MusicBrainz API with proper headers and rate limiting
 */
async function musicbrainzRequest(endpoint, params = {}) {
  await respectRateLimit();
  
  const queryParams = new URLSearchParams({
    fmt: 'json',
    ...params
  });
  
  const url = `${MUSICBRAINZ_API_BASE}${endpoint}?${queryParams}`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`MusicBrainz API error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Search for artists by name
 * GET /api/musicbrainz/search/artist?query=artist+name&limit=10
 */
router.get('/search/artist', asyncHandler(async (req, res) => {
  const { query, limit = 10 } = req.query;
  
  if (!query) {
    return sendServerError(res, 'Query parameter is required');
  }
  
  const data = await musicbrainzRequest('/artist', {
    query,
    limit
  });
  
  sendSuccess(res, data);
}));

/**
 * Search for releases (albums) by title, artist MBID, and optional track count
 * GET /api/musicbrainz/search/release?query=album+title&artist=artist-mbid&tracks=10&limit=25
 */
router.get('/search/release', asyncHandler(async (req, res) => {
  const { query, artist, tracks, limit = 25 } = req.query;
  
  if (!query) {
    return sendServerError(res, 'Query parameter is required');
  }
  
  // Build search query
  let searchQuery = `release:"${query}"`;
  
  // Add artist filter if provided (artist MBID)
  if (artist) {
    searchQuery += ` AND arid:${artist}`;
  }
  
  // Add track count filter if provided
  if (tracks) {
    const trackCount = parseInt(tracks);
    if (!isNaN(trackCount)) {
      searchQuery += ` AND tracks:${trackCount}`;
    }
  }
  
  const data = await musicbrainzRequest('/release', {
    query: searchQuery,
    limit
  });
  
  sendSuccess(res, data);
}));

/**
 * Get detailed artist information by MBID
 * GET /api/musicbrainz/artist/:mbid
 */
router.get('/artist/:mbid', asyncHandler(async (req, res) => {
  const { mbid } = req.params;
  const { inc = 'aliases+tags+genres+ratings+url-rels' } = req.query;
  
  const data = await musicbrainzRequest(`/artist/${mbid}`, {
    inc
  });
  
  sendSuccess(res, data);
}));

/**
 * Get detailed release information by MBID
 * GET /api/musicbrainz/release/:mbid
 */
router.get('/release/:mbid', asyncHandler(async (req, res) => {
  const { mbid } = req.params;
  const { inc = 'artists+labels+recordings+release-groups+media' } = req.query;
  
  const data = await musicbrainzRequest(`/release/${mbid}`, {
    inc
  });
  
  sendSuccess(res, data);
}));

/**
 * Browse releases for an artist
 * GET /api/musicbrainz/artist/:mbid/releases?limit=100
 */
router.get('/artist/:mbid/releases', asyncHandler(async (req, res) => {
  const { mbid } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  const data = await musicbrainzRequest('/release', {
    artist: mbid,
    limit,
    offset,
    inc: 'labels+recordings+release-groups'
  });
  
  sendSuccess(res, data);
}));

/**
 * Browse release groups for an artist
 * GET /api/musicbrainz/artist/:mbid/release-groups?type=album&limit=100
 */
router.get('/artist/:mbid/release-groups', asyncHandler(async (req, res) => {
  const { mbid } = req.params;
  const { type, limit = 100, offset = 0 } = req.query;
  
  const params = {
    artist: mbid,
    limit,
    offset
  };
  
  if (type) {
    params.type = type;
  }
  
  const data = await musicbrainzRequest('/release-group', params);
  
  sendSuccess(res, data);
}));

/**
 * Browse recordings for an artist
 * GET /api/musicbrainz/artist/:mbid/recordings?limit=100
 */
router.get('/artist/:mbid/recordings', asyncHandler(async (req, res) => {
  const { mbid } = req.params;
  const { limit = 100, offset = 0 } = req.query;
  
  const data = await musicbrainzRequest('/recording', {
    artist: mbid,
    limit,
    offset,
    inc: 'artist-credits+isrcs'
  });
  
  sendSuccess(res, data);
}));

module.exports = router;
