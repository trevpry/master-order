const express = require('express');
const router = express.Router();
const LocationService = require('../services/LocationService');
const { asyncHandler, sendSuccess, sendBadRequest, sendServerError } = require('../utils/responses');
const { validateRequiredFields } = require('../middleware/validation');

const locationService = new LocationService();

// GET /api/locations - Get all locations with optional filtering
router.get('/', asyncHandler(async (req, res) => {
  const {
    type,
    category,
    isFavorite,
    search,
    includePrivate,
    north,
    south,
    east,
    west,
    limit,
    offset
  } = req.query;

  const options = {
    type,
    category,
    isFavorite: isFavorite === 'true',
    search,
    includePrivate: includePrivate !== 'false',
    limit: limit ? parseInt(limit) : 100,
    offset: offset ? parseInt(offset) : 0
  };

  // Add bounds if provided
  if (north && south && east && west) {
    options.bounds = {
      north: parseFloat(north),
      south: parseFloat(south),
      east: parseFloat(east),
      west: parseFloat(west)
    };
  }

  const locations = await locationService.getAllLocations(1, options);
  sendSuccess(res, locations);
}));

// GET /api/locations/stats - Get location statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await locationService.getLocationStats(1);
  sendSuccess(res, stats);
}));

// GET /api/locations/favorites - Get favorite locations
router.get('/favorites', asyncHandler(async (req, res) => {
  const favorites = await locationService.getFavoriteLocations(1);
  sendSuccess(res, favorites);
}));

// GET /api/locations/type/:type - Get locations by type
router.get('/type/:type', asyncHandler(async (req, res) => {
  const { type } = req.params;
  const locations = await locationService.getLocationsByType(type, 1);
  sendSuccess(res, locations);
}));

// GET /api/locations/nearby - Search for nearby locations
router.get('/nearby', asyncHandler(async (req, res) => {
  const { latitude, longitude, radius = 10 } = req.query;
  
  validateRequiredFields(req.query, ['latitude', 'longitude']);
  
  const locations = await locationService.searchNearby(
    latitude,
    longitude,
    radius,
    { userId: 1 }
  );
  
  sendSuccess(res, locations);
}));

// GET /api/locations/:id - Get location by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const location = await locationService.getLocationById(id);
  
  if (!location) {
    return sendBadRequest(res, 'Location not found');
  }
  
  sendSuccess(res, location);
}));

// POST /api/locations - Create new location
router.post('/', asyncHandler(async (req, res) => {
  validateRequiredFields(req.body, ['name', 'latitude', 'longitude']);
  
  const location = await locationService.createLocation(req.body);
  sendSuccess(res, location, 'Location created successfully');
}));

// PUT /api/locations/:id - Update location
router.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const existingLocation = await locationService.getLocationById(id);
  if (!existingLocation) {
    return sendBadRequest(res, 'Location not found');
  }
  
  const location = await locationService.updateLocation(id, req.body);
  sendSuccess(res, location, 'Location updated successfully');
}));

// DELETE /api/locations/:id - Delete location
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const existingLocation = await locationService.getLocationById(id);
  if (!existingLocation) {
    return sendBadRequest(res, 'Location not found');
  }
  
  await locationService.deleteLocation(id);
  sendSuccess(res, null, 'Location deleted successfully');
}));

// POST /api/locations/:id/connect-note - Connect location to a note
router.post('/:id/connect-note', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { noteId } = req.body;
  
  validateRequiredFields(req.body, ['noteId']);
  
  const location = await locationService.connectToNote(id, noteId);
  sendSuccess(res, location, 'Location connected to note successfully');
}));

// DELETE /api/locations/:id/disconnect-note - Disconnect location from note
router.delete('/:id/disconnect-note', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const location = await locationService.disconnectFromNote(id);
  sendSuccess(res, location, 'Location disconnected from note successfully');
}));

// PUT /api/locations/:id/favorite - Toggle favorite status
router.put('/:id/favorite', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isFavorite } = req.body;
  
  const location = await locationService.updateLocation(id, { isFavorite });
  sendSuccess(res, location, `Location ${isFavorite ? 'added to' : 'removed from'} favorites`);
}));

module.exports = router;
