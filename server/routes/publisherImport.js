const express = require('express');
const router = express.Router();
const DiscogsImportService = require('../services/discogsImportService');
const { listPublishers, getPublisher } = require('../services/publishers');
const { asyncHandler, sendSuccess, sendBadRequest } = require('../utils/responses');

const createImporter = (publisher) => new DiscogsImportService({ source: publisher.createSource() });

const sendImportError = (res, error) => {
  if (error.statusCode === 404) {
    return res.status(404).json({ error: error.message });
  }
  console.error('Publisher import error:', error);
  return res.status(500).json({ error: error.message || 'Publisher request failed' });
};

// GET /api/music/publishers - Publisher catalogues available for searching
router.get('/', asyncHandler(async (req, res) => {
  sendSuccess(res, { publishers: listPublishers() });
}));

// POST /api/music/publishers/:publisher/albums/:ratingKey/search - Ranked release candidates for an album
router.post('/:publisher/albums/:ratingKey/search', asyncHandler(async (req, res) => {
  const publisher = getPublisher(req.params.publisher);
  if (!publisher) {
    return sendBadRequest(res, 'Unknown publisher');
  }

  const query = String(req.body?.query || '').trim() || null;
  const limit = Math.min(Math.max(Number.parseInt(req.body?.limit, 10) || 15, 1), 50);

  try {
    const data = await createImporter(publisher).searchForAlbum(req.params.ratingKey, { query, limit });
    return sendSuccess(res, data);
  } catch (error) {
    return sendImportError(res, error);
  }
}));

// POST /api/music/publishers/:publisher/albums/:ratingKey/import - Preview (apply=false) or apply a release
router.post('/:publisher/albums/:ratingKey/import', asyncHandler(async (req, res) => {
  const publisher = getPublisher(req.params.publisher);
  if (!publisher) {
    return sendBadRequest(res, 'Unknown publisher');
  }

  const {
    releaseId,
    apply = false,
    trackMappings = [],
    excludedCreditKeys = [],
    artistOverrides = {},
    artwork = null,
    workSelections = null
  } = req.body || {};

  const importer = createImporter(publisher);
  if (!releaseId || (importer.source.isValidReleaseId && !importer.source.isValidReleaseId(releaseId))) {
    return sendBadRequest(res, `A valid ${publisher.label} release ID is required`);
  }

  try {
    const data = apply
      ? await importer.apply(req.params.ratingKey, String(releaseId), { trackMappings, excludedCreditKeys, artistOverrides, artwork, workSelections })
      : await importer.preview(req.params.ratingKey, String(releaseId));
    return sendSuccess(res, data);
  } catch (error) {
    return sendImportError(res, error);
  }
}));

module.exports = router;
