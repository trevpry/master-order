const express = require('express');
const router = express.Router();
const IdentificationService = require('../services/identificationService');
const CoverArtService = require('../services/coverArtService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');

const identificationService = new IdentificationService();
const coverArtService = new CoverArtService();

/**
 * GET /api/identification/release/:releaseId/cover-art
 * List Cover Art Archive images for a MusicBrainz release, with a default front/back selection
 */
router.get('/release/:releaseId/cover-art', asyncHandler(async (req, res) => {
  const { releaseId } = req.params;
  if (!CoverArtService.isValidMbid(releaseId)) {
    return sendBadRequest(res, 'Invalid MusicBrainz release ID');
  }

  const images = await coverArtService.getReleaseImages(releaseId);
  sendSuccess(res, { images, defaultArtwork: CoverArtService.defaultSelection(images) });
}));

/**
 * POST /api/identification/album/:ratingKey
 * Search MusicBrainz for album matches
 */
router.post('/album/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { plexUrl, plexToken } = req.body;
  
  const candidates = await identificationService.identifyAlbum(ratingKey, { plexUrl, plexToken });
  sendSuccess(res, {
    candidates,
    count: candidates.length,
    topMatch: candidates[0] || null
  });
}));

/**
 * POST /api/identification/artist/:ratingKey
 * Search MusicBrainz for artist matches
 */
router.post('/artist/:ratingKey', asyncHandler(async (req, res) => {
  const { ratingKey } = req.params;
  const { plexUrl, plexToken } = req.body;
  
  const candidates = await identificationService.identifyArtist(ratingKey, { plexUrl, plexToken });
  sendSuccess(res, {
    candidates,
    count: candidates.length,
    topMatch: candidates[0] || null
  });
}));

/**
 * GET /api/identification/:entityType/:entityKey/candidates
 * Get pending identification candidates
 */
router.get('/:entityType/:entityKey/candidates', asyncHandler(async (req, res) => {
  const { entityType, entityKey } = req.params;
  
  const candidates = await identificationService.getPendingCandidates(entityType, entityKey);
  sendSuccess(res, { candidates });
}));

/**
 * POST /api/identification/accept/:candidateId
 * Accept an identification candidate and return raw metadata (without saving)
 */
router.post('/accept/:candidateId', asyncHandler(async (req, res) => {
  const candidateId = parseInt(req.params.candidateId);
  const { plexUrl, plexToken } = req.body;
  
  if (isNaN(candidateId)) {
    return sendBadRequest(res, 'Invalid candidate ID');
  }
  
  const result = await identificationService.acceptIdentification(candidateId);
  
  if (result.success) {
    sendSuccess(res, { 
      data: result.data,
      candidate: result.candidate,
      message: 'Metadata retrieved successfully'
    });
  } else {
    sendError(res, result.error);
  }
}));

/**
 * POST /api/identification/apply/:candidateId
 * Persist a candidate's MusicBrainz metadata to the album/artist and its tracks
 */
router.post('/apply/:candidateId', asyncHandler(async (req, res) => {
  const candidateId = parseInt(req.params.candidateId);
  const { metadata, trackMatchOverrides, artwork } = req.body || {};

  if (isNaN(candidateId)) {
    return sendBadRequest(res, 'Invalid candidate ID');
  }

  const result = await identificationService.applyIdentification(candidateId, metadata || null, trackMatchOverrides || []);

  let artworkResult = { saved: [], errors: [] };
  if (result.entityType === 'album' && artwork && typeof artwork === 'object') {
    const releaseId = CoverArtService.isValidMbid(metadata?.id) ? metadata.id : result.musicBrainzId;
    try {
      artworkResult = await coverArtService.saveSelectedArtwork(result.entityKey, releaseId, artwork);
    } catch (error) {
      console.error('Error saving MusicBrainz artwork:', error);
      artworkResult.errors.push({ type: 'all', error: error.message });
    }
  }

  sendSuccess(res, {
    entityType: result.entityType,
    entityKey: result.entityKey,
    entity: result.data,
    artworkSaved: artworkResult.saved,
    artworkErrors: artworkResult.errors,
    message: 'Metadata applied successfully'
  });
}));

/**
 * POST /api/identification/reject/:candidateId
 * Reject an identification candidate
 */
router.post('/reject/:candidateId', asyncHandler(async (req, res) => {
  const candidateId = parseInt(req.params.candidateId);
  
  if (isNaN(candidateId)) {
    return sendBadRequest(res, 'Invalid candidate ID');
  }
  
  await identificationService.rejectCandidate(candidateId);
  sendSuccess(res, { message: 'Candidate rejected' });
}));

/**
 * POST /api/identification/manual/:entityType/:entityKey
 * Mark entity as manually identified (no MusicBrainz match)
 */
router.post('/manual/:entityType/:entityKey', asyncHandler(async (req, res) => {
  const { entityType, entityKey } = req.params;
  
  await identificationService.markAsManual(entityType, entityKey);
  sendSuccess(res, { message: 'Marked as manually identified' });
}));

/**
 * POST /api/identification/batch/auto-accept
 * Auto-accept high-confidence matches (>= 95%)
 * Body: { entityType: 'album'|'artist', minConfidence?: number }
 */
router.post('/batch/auto-accept', asyncHandler(async (req, res) => {
  const { entityType, minConfidence = 0.95 } = req.body;
  
  if (!entityType) {
    return sendBadRequest(res, 'entityType is required');
  }
  
  // Get all pending candidates with high confidence
  const highConfidenceCandidates = await identificationService.prisma.identificationCandidate.findMany({
    where: {
      entityType,
      status: 'pending',
      confidence: { gte: minConfidence }
    },
    orderBy: {
      confidence: 'desc'
    }
  });
  
  const results = {
    total: highConfidenceCandidates.length,
    accepted: 0,
    failed: 0,
    errors: []
  };
  
  // Accept each candidate
  for (const candidate of highConfidenceCandidates) {
    try {
      await identificationService.acceptIdentification(candidate.id);
      results.accepted++;
    } catch (error) {
      results.failed++;
      results.errors.push({
        candidateId: candidate.id,
        entityKey: candidate.entityKey,
        error: error.message
      });
    }
  }
  
  sendSuccess(res, results);
}));

module.exports = router;
