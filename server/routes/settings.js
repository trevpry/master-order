const express = require('express');
const router = express.Router();
const prisma = require('../prismaClient'); // Use shared singleton instance
const { sendNotFound, sendSuccess, sendServerError, asyncHandler, logError } = require('../utils/responses');

/**
 * EDDIE LIFE MANAGEMENT - SETTINGS ROUTES
 * 
 * This module handles TWO DISTINCT settings systems:
 * 
 * 1. 🎬 MEDIA SETTINGS (/api/settings)
 *    - Purpose: Media system configuration (Plex, APIs, sync settings)
 *    - Frontend: client/src/modules/media/pages/settings/index.jsx
 *    - Scope: System/infrastructure configuration
 * 
 * 2. 🏠 EDDIE SETTINGS (/api/settings/eddie)
 *    - Purpose: Personal dashboard settings (weather, preferences)
 *    - Frontend: client/src/modules/eddie/pages/EddieSettings.jsx
 *    - Scope: Personal/dashboard configuration
 * 
 * Both use the same database table but serve different purposes.
 */

// ============================================================================
// 🎬 MEDIA SETTINGS ROUTES - System Configuration
// Frontend: client/src/modules/media/pages/settings/index.jsx
// ============================================================================

// GET /api/settings - Get all settings (main settings)
router.get('/', asyncHandler(async (req, res) => {
  const settings = await prisma.settings.findUnique({
    where: { id: 1 }
  });
  
  if (!settings) {
    return sendNotFound(res, 'Settings not found');
  }

  // Parse JSON fields if they exist
  const parsedSettings = {
    ...settings,
    ignoredMovieCollections: settings.ignoredMovieCollections ? 
      (typeof settings.ignoredMovieCollections === 'string' ? 
        JSON.parse(settings.ignoredMovieCollections) : settings.ignoredMovieCollections) : [],
    ignoredTVCollections: settings.ignoredTVCollections ? 
      (typeof settings.ignoredTVCollections === 'string' ? 
        JSON.parse(settings.ignoredTVCollections) : settings.ignoredTVCollections) : []
  };

  res.json(parsedSettings);
}));

// POST /api/settings - Update media settings
router.post('/', asyncHandler(async (req, res) => {
  const settingsData = req.body;
  
  // Handle array fields that need to be stringified
  const processedData = { ...settingsData };
  if (settingsData.ignoredMovieCollections && Array.isArray(settingsData.ignoredMovieCollections)) {
    processedData.ignoredMovieCollections = JSON.stringify(settingsData.ignoredMovieCollections);
  }
  if (settingsData.ignoredTVCollections && Array.isArray(settingsData.ignoredTVCollections)) {
    processedData.ignoredTVCollections = JSON.stringify(settingsData.ignoredTVCollections);
  }
  
  // Remove any undefined or null values
  Object.keys(processedData).forEach(key => {
    if (processedData[key] === undefined || processedData[key] === null || processedData[key] === '') {
      delete processedData[key];
    }
  });

  // Update or create settings record (ID 1 is the main settings record)
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: processedData,
    create: { id: 1, ...processedData }
  });

  console.log('Media settings saved successfully:', settings.id);
  res.json({ message: 'Settings saved successfully', settings });
}));

// ============================================================================
// 🏠 EDDIE SETTINGS ROUTES - Personal Dashboard Configuration  
// Frontend: client/src/modules/eddie/pages/EddieSettings.jsx
// ============================================================================

// GET /api/settings/eddie - Get Eddie settings (specific endpoint for Eddie interface)
router.get('/eddie', asyncHandler(async (req, res) => {
  const eddieSettings = await prisma.eddieSettings.findFirst();
  
  if (!eddieSettings) {
    // Return default Eddie settings if none exist
    return res.json({
      id: 1,
      weatherEnabled: false,
      weatherApiKey: '',
      weatherLocation: '',
      weatherUnits: 'metric'
    });
  }

  res.json(eddieSettings);
}));

// PUT /api/settings/eddie - Update Eddie settings
router.put('/eddie', asyncHandler(async (req, res) => {
  const { 
    weatherEnabled, 
    weatherApiKey, 
    weatherLocation, 
    weatherUnits 
  } = req.body;

  // Prepare update data - only include defined fields
  const updateData = {};
  if (weatherEnabled !== undefined) updateData.weatherEnabled = weatherEnabled;
  if (weatherApiKey !== undefined) updateData.weatherApiKey = weatherApiKey?.trim() || null;
  if (weatherLocation !== undefined) updateData.weatherLocation = weatherLocation?.trim() || null;
  if (weatherUnits !== undefined) updateData.weatherUnits = weatherUnits || 'metric';

  let eddieSettings;
  
  // Check if Eddie settings record exists
  const existingSettings = await prisma.eddieSettings.findFirst();

  if (existingSettings) {
    // Update existing Eddie settings
    eddieSettings = await prisma.eddieSettings.update({
      where: { id: existingSettings.id },
      data: updateData
    });
  } else {
    // Create new Eddie settings
    eddieSettings = await prisma.eddieSettings.create({
      data: {
        weatherEnabled: false,
        weatherUnits: 'metric',
        ...updateData
      }
    });
  }

  console.log('Eddie settings saved successfully:', eddieSettings.id);
  res.json({ message: 'Eddie settings saved successfully', settings: eddieSettings });
}));

module.exports = router;
