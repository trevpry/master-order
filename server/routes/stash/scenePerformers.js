const express = require('express');
const router = express.Router();
const ScenePerformerService = require('../../services/scenePerformerService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../../utils/responses');
const { validateRequiredFields } = require('../../middleware/validation');

const scenePerformerService = new ScenePerformerService();

/**
 * GET /api/stash/scenes/:sceneId/performers
 * Get all performers for a scene with their scene-specific metadata
 */
router.get('/scenes/:sceneId/performers', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  
  const performers = await scenePerformerService.getScenePerformers(sceneId);
  sendSuccess(res, performers);
}));

/**
 * GET /api/stash/scenes/:sceneId/performers/:performerId
 * Get specific performer metadata for a scene
 */
router.get('/scenes/:sceneId/performers/:performerId', asyncHandler(async (req, res) => {
  const { sceneId, performerId } = req.params;
  
  const metadata = await scenePerformerService.getPerformerMetadata(sceneId, performerId);
  
  if (!metadata) {
    return sendBadRequest(res, 'Performer not found in this scene');
  }
  
  sendSuccess(res, metadata);
}));

/**
 * PUT /api/stash/scenes/:sceneId/performers/:performerId
 * Update performer metadata for a scene
 */
router.put('/scenes/:sceneId/performers/:performerId', asyncHandler(async (req, res) => {
  const { sceneId, performerId } = req.params;
  const metadata = req.body;
  
  console.log(`📝 Updating performer ${performerId} metadata for scene ${sceneId}`);
  console.log('   Metadata:', metadata);
  
  const updated = await scenePerformerService.updatePerformerMetadata(
    sceneId,
    performerId,
    metadata
  );
  
  sendSuccess(res, updated);
}));

/**
 * POST /api/stash/scenes/:sceneId/performers
 * Add a performer to a scene with optional metadata
 */
router.post('/scenes/:sceneId/performers', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { performerId, metadata = {} } = req.body;
  
  validateRequiredFields(req.body, ['performerId']);
  
  console.log(`➕ Adding performer ${performerId} to scene ${sceneId}`);
  
  const relationship = await scenePerformerService.addPerformerToScene(
    sceneId,
    performerId,
    metadata
  );
  
  sendSuccess(res, relationship);
}));

/**
 * DELETE /api/stash/scenes/:sceneId/performers/:performerId
 * Remove a performer from a scene
 */
router.delete('/scenes/:sceneId/performers/:performerId', asyncHandler(async (req, res) => {
  const { sceneId, performerId } = req.params;
  
  console.log(`🗑️ Removing performer ${performerId} from scene ${sceneId}`);
  
  await scenePerformerService.removePerformerFromScene(sceneId, performerId);
  
  sendSuccess(res, { message: 'Performer removed from scene' });
}));

/**
 * POST /api/stash/scenes/:sceneId/performers/bulk
 * Bulk update performer metadata for multiple performers
 */
router.post('/scenes/:sceneId/performers/bulk', asyncHandler(async (req, res) => {
  const { sceneId } = req.params;
  const { performers } = req.body;
  
  validateRequiredFields(req.body, ['performers']);
  
  if (!Array.isArray(performers)) {
    return sendBadRequest(res, 'performers must be an array');
  }
  
  console.log(`🔄 Bulk updating ${performers.length} performers for scene ${sceneId}`);
  
  const updated = await scenePerformerService.bulkUpdatePerformers(sceneId, performers);
  
  sendSuccess(res, updated);
}));

/**
 * GET /api/stash/performers/:performerId/scenes
 * Get all scenes for a performer with scene-specific metadata
 */
router.get('/performers/:performerId/scenes', asyncHandler(async (req, res) => {
  const { performerId } = req.params;
  
  const scenes = await scenePerformerService.getPerformerScenes(performerId);
  sendSuccess(res, scenes);
}));

module.exports = router;
