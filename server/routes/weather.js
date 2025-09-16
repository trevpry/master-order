/**
 * Weather Routes
 * Part of Eddie Life Management - Weather Information Module
 * 
 * Handles weather data fetching from OpenWeatherMap API
 * Supports both standard and Android companion app formats
 * Includes daily weather summary storage and retrieval
 */

const express = require('express');
const router = express.Router();
const WeatherSummaryService = require('../services/WeatherSummaryService');

// Use shared Prisma client
const prisma = require('../prismaClient');

// Initialize weather summary service
const weatherSummaryService = new WeatherSummaryService();

/**
 * GET /api/weather - Standard weather information endpoint
 * Returns current weather data using Eddie settings configuration
 */
router.get('/', async (req, res) => {
  try {
    // Get Eddie settings for weather configuration
    const eddieSettings = await prisma.eddieSettings.findFirst();
    
    if (!eddieSettings?.weatherEnabled) {
      return res.status(400).json({
        error: 'Weather is not enabled in settings'
      });
    }
    
    if (!eddieSettings?.weatherApiKey) {
      return res.status(400).json({
        error: 'Weather API key not configured'
      });
    }
    
    if (!eddieSettings?.weatherLocation) {
      return res.status(400).json({
        error: 'Weather location not configured'
      });
    }
    
    const apiKey = eddieSettings.weatherApiKey;
    const location = eddieSettings.weatherLocation;
    const units = eddieSettings.weatherUnits || 'metric';
    
    // Check if location is coordinates (lat,lon) or city name
    let weatherUrl;
    // Check if it's coordinates by looking for numeric lat,lon pattern
    const coordPattern = /^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$/;
    if (coordPattern.test(location.trim())) {
      // It's coordinates format "lat,lon"
      const [lat, lon] = location.split(',').map(coord => coord.trim());
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
    } else {
      // It's a city name (possibly with state/country)
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`;
    }
    
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }
    
    const weatherData = await response.json();
    
    // Add units info to response
    weatherData.units = units;
    weatherData.tempUnit = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K';
    weatherData.speedUnit = units === 'metric' ? 'm/s' : 'mph';
    
    res.json(weatherData);
  } catch (error) {
    console.error('Weather API error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather data',
      details: error.message
    });
  }
});

/**
 * GET /api/weather/summary/:date - Get daily weather summary for a specific date
 * Returns stored weather summary data for calendar display
 */
router.get('/summary/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format (YYYY-MM-DD)
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }
    
    const summary = await weatherSummaryService.getDailyWeatherSummary(date);
    
    if (!summary) {
      return res.status(404).json({
        error: 'No weather summary found for this date'
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching weather summary:', error);
    res.status(500).json({
      error: 'Failed to fetch weather summary',
      details: error.message
    });
  }
});

/**
 * GET /api/weather/summary - Get weather summaries for a date range
 * Query parameters: startDate, endDate (both in YYYY-MM-DD format)
 */
router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        error: 'startDate and endDate query parameters are required'
      });
    }
    
    // Validate date formats
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate) || !datePattern.test(endDate)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format for both startDate and endDate.'
      });
    }
    
    const summaries = await weatherSummaryService.getWeatherSummariesForRange(startDate, endDate);
    
    res.json({
      success: true,
      data: summaries,
      count: summaries.length
    });
  } catch (error) {
    console.error('Error fetching weather summaries:', error);
    res.status(500).json({
      error: 'Failed to fetch weather summaries',
      details: error.message
    });
  }
});

/**
 * POST /api/weather/summary/generate/:date - Manually generate weather summary for a specific date
 * For testing and backfilling data
 */
router.post('/summary/generate/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD format.'
      });
    }
    
    // Check if weather is enabled
    const eddieSettings = await prisma.eddieSettings.findFirst();
    if (!eddieSettings?.weatherEnabled) {
      return res.status(400).json({
        error: 'Weather is not enabled in Eddie Settings'
      });
    }
    
    const summary = await weatherSummaryService.generateDailyWeatherSummary(date);
    
    if (!summary) {
      return res.status(400).json({
        error: 'Could not generate weather summary. Check weather configuration.'
      });
    }
    
    res.json({
      success: true,
      message: 'Weather summary generated successfully',
      data: summary
    });
  } catch (error) {
    console.error('Error generating weather summary:', error);
    res.status(500).json({
      error: 'Failed to generate weather summary',
      details: error.message
    });
  }
});

module.exports = router;
