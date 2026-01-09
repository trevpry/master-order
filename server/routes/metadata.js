const express = require('express');
const router = express.Router();
const MetadataResolutionService = require('../services/metadataResolutionService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');

const metadataService = new MetadataResolutionService();

/**
 * GET /api/metadata/:entityType/:entityKey/sources/:field
 * Get all available sources for a specific field
 */
router.get('/:entityType/:entityKey/sources/:field', asyncHandler(async (req, res) => {
  const { entityType, entityKey, field } = req.params;
  
  const sources = await metadataService.getAllFieldSources(entityType, entityKey, field);
  sendSuccess(res, sources);
}));

/**
 * GET /api/metadata/:entityType/:entityKey/resolved
 * Get complete resolved metadata for an entity
 */
router.get('/:entityType/:entityKey/resolved', asyncHandler(async (req, res) => {
  const { entityType, entityKey } = req.params;
  
  const metadata = await metadataService.getResolvedMetadata(entityType, entityKey);
  sendSuccess(res, metadata);
}));

/**
 * GET /api/metadata/:entityType/:entityKey/field/:field
 * Resolve a single field's value
 */
router.get('/:entityType/:entityKey/field/:field', asyncHandler(async (req, res) => {
  const { entityType, entityKey, field } = req.params;
  
  const result = await metadataService.resolveField(entityType, entityKey, field);
  sendSuccess(res, result);
}));

/**
 * PUT /api/metadata/:entityType/:entityKey/preference
 * Set metadata source preference for a field
 * Body: { field: string, source: 'user'|'musicbrainz'|'plex' }
 */
router.put('/:entityType/:entityKey/preference', asyncHandler(async (req, res) => {
  const { entityType, entityKey } = req.params;
  const { field, source } = req.body;
  
  if (!field || !source) {
    return sendBadRequest(res, 'field and source are required');
  }
  
  await metadataService.setPreference(entityType, entityKey, field, source);
  sendSuccess(res, { message: 'Preference updated' });
}));

/**
 * PUT /api/metadata/:entityType/:entityKey/override
 * Set user override for a field
 * Body: { field: string, value: any }
 */
router.put('/:entityType/:entityKey/override', asyncHandler(async (req, res) => {
  const { entityType, entityKey } = req.params;
  const { field, value } = req.body;
  
  if (!field || value === undefined) {
    return sendBadRequest(res, 'field and value are required');
  }
  
  await metadataService.setUserOverride(entityType, entityKey, field, value);
  sendSuccess(res, { message: 'User override saved' });
}));

/**
 * DELETE /api/metadata/:entityType/:entityKey/override/:field
 * Clear user override for a field
 */
router.delete('/:entityType/:entityKey/override/:field', asyncHandler(async (req, res) => {
  const { entityType, entityKey, field } = req.params;
  
  await metadataService.clearUserOverride(entityType, entityKey, field);
  sendSuccess(res, { message: 'User override cleared' });
}));

module.exports = router;
