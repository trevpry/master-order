/**
 * Weather Routes
 * Part of Eddie Life Management - Weather Information Module
 * 
 * Handles weather data fetching from OpenWeatherMap API
 * Supports both standard and Android companion app formats
 */

const express = require('express');
const router = express.Router();

// Use shared Prisma client
const prisma = require('../prismaClient');

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

module.exports = router;
