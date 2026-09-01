const express = require('express');
const router = express.Router();
const IdentificationService = require('../services/identificationService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');

const identificationService = new IdentificationService();

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
  const { metadata, trackMatchOverrides } = req.body || {};

  if (isNaN(candidateId)) {
    return sendBadRequest(res, 'Invalid candidate ID');
  }

  const result = await identificationService.applyIdentification(candidateId, metadata || null, trackMatchOverrides || []);

  sendSuccess(res, {
    entityType: result.entityType,
    entityKey: result.entityKey,
    entity: result.data,
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
