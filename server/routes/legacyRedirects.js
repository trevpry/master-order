const express = require('express');
const router = express.Router();

// ========================================
// LEGACY REDIRECTS
// ========================================
// These routes provide backward compatibility for old API endpoints
// by redirecting them to their new modular locations

// Legacy Plex redirects
router.get('/up_next', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/up_next to /api/plex/up-next');
  res.redirect('/api/plex/up-next');
});

router.get('/start-new-series', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/start-new-series to /api/plex/start-new-series');
  res.redirect('/api/plex/start-new-series');
});

router.get('/plex-media/:plexKey', (req, res) => {
  console.log(`🔄 [LEGACY] Redirecting /api/plex-media/${req.params.plexKey} to /api/plex/media/${req.params.plexKey}`);
  res.redirect(`/api/plex/media/${req.params.plexKey}`);
});

// Legacy Stash redirects
router.get('/stash-image-proxy/*', (req, res) => {
  console.log(`🔄 [LEGACY] Redirecting /api/stash-image-proxy/${req.params[0]} to /api/stash/image-proxy/${req.params[0]}`);
  res.redirect(`/api/stash/image-proxy/${req.params[0]}`);
});

// Legacy ComicVine redirects
router.get('/comicvine-artwork', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/comicvine-artwork to /api/comicvine/artwork');
  res.redirect(`/api/comicvine/artwork?${new URLSearchParams(req.query)}`);
});

router.get('/comicvine-cover', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/comicvine-cover to /api/comicvine/cover');
  res.redirect(`/api/comicvine/cover?${new URLSearchParams(req.query)}`);
});

// Legacy Komga redirects
router.get('/komga-test', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/komga-test to /api/komga/test');
  res.redirect('/api/komga/test');
});

router.get('/komga-search', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/komga-search to /api/komga/search');
  res.redirect(`/api/komga/search?${new URLSearchParams(req.query)}`);
});

router.get('/komga-search-comic', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/komga-search-comic to /api/komga/search-comic');
  res.redirect(`/api/komga/search-comic?${new URLSearchParams(req.query)}`);
});

// Legacy OpenLibrary redirects
router.get('/openlibrary-artwork', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/openlibrary-artwork to /api/openlibrary/artwork');
  res.redirect(`/api/openlibrary/artwork?${new URLSearchParams(req.query)}`);
});

// Legacy TVDB redirects
router.get('/tvdb-artwork', (req, res) => {
  console.log('🔄 [LEGACY] Redirecting /api/tvdb-artwork to /api/tvdb/artwork');
  res.redirect(`/api/tvdb/artwork?${new URLSearchParams(req.query)}`);
});

module.exports = router;
