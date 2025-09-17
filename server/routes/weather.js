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
 * GET /api/weather/forecast - Extended weather information with forecasts
 * Returns current weather, hourly forecast (12 hours), and daily forecast (7 days)
 */
router.get('/forecast', async (req, res) => {
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
    
    // First get coordinates for the location
    let lat, lon;
    const coordPattern = /^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$/;
    
    if (coordPattern.test(location.trim())) {
      // It's already coordinates
      [lat, lon] = location.split(',').map(coord => coord.trim());
    } else {
      // Get coordinates from city name using geocoding API
      const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
      const geocodeResponse = await fetch(geocodeUrl);
      
      if (!geocodeResponse.ok) {
        throw new Error('Failed to get coordinates for location');
      }
      
      const geocodeData = await geocodeResponse.json();
      if (!geocodeData.length) {
        throw new Error('Location not found');
      }
      
      lat = geocodeData[0].lat;
      lon = geocodeData[0].lon;
    }
    
    // Get current weather + forecasts using One Call API
    const forecastUrl = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}&exclude=minutely,alerts`;
    const forecastResponse = await fetch(forecastUrl);
    
    if (!forecastResponse.ok) {
      // Fallback to basic current weather if One Call API fails (requires subscription)
      const basicUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
      const basicResponse = await fetch(basicUrl);
      
      if (!basicResponse.ok) {
        const errorData = await basicResponse.json();
        throw new Error(`OpenWeatherMap API error: ${basicResponse.status} - ${errorData.message || 'Unknown error'}`);
      }
      
      const basicWeatherData = await basicResponse.json();
      
      // Return basic weather data with empty forecasts
      return res.json({
        current: {
          ...basicWeatherData,
          units: units,
          tempUnit: units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K',
          speedUnit: units === 'metric' ? 'm/s' : 'mph'
        },
        hourly: [],
        daily: [],
        forecastAvailable: false,
        message: 'Extended forecasts require OpenWeatherMap One Call API subscription'
      });
    }
    
    const forecastData = await forecastResponse.json();
    
    // Process hourly forecast (next 12 hours)
    const hourlyForecast = forecastData.hourly ? forecastData.hourly.slice(0, 12).map(hour => ({
      dt: hour.dt,
      temp: Math.round(hour.temp),
      feels_like: Math.round(hour.feels_like),
      humidity: hour.humidity,
      weather: hour.weather[0],
      pop: Math.round((hour.pop || 0) * 100), // Precipitation probability as percentage
      wind_speed: hour.wind_speed,
      time: new Date(hour.dt * 1000).toLocaleTimeString('en-US', { 
        hour: 'numeric',
        hour12: true 
      })
    })) : [];
    
    // Process daily forecast (next 7 days)
    const dailyForecast = forecastData.daily ? forecastData.daily.slice(0, 7).map(day => ({
      dt: day.dt,
      temp: {
        min: Math.round(day.temp.min),
        max: Math.round(day.temp.max)
      },
      humidity: day.humidity,
      weather: day.weather[0],
      pop: Math.round((day.pop || 0) * 100),
      wind_speed: day.wind_speed,
      sunrise: day.sunrise,
      sunset: day.sunset,
      date: new Date(day.dt * 1000).toLocaleDateString('en-US', { 
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      })
    })) : [];
    
    // Current weather (same format as basic endpoint)
    const currentWeather = {
      ...forecastData.current,
      weather: forecastData.current.weather,
      main: {
        temp: forecastData.current.temp,
        feels_like: forecastData.current.feels_like,
        humidity: forecastData.current.humidity,
        pressure: forecastData.current.pressure
      },
      wind: {
        speed: forecastData.current.wind_speed,
        deg: forecastData.current.wind_deg
      },
      units: units,
      tempUnit: units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K',
      speedUnit: units === 'metric' ? 'm/s' : 'mph'
    };
    
    res.json({
      current: currentWeather,
      hourly: hourlyForecast,
      daily: dailyForecast,
      forecastAvailable: true,
      location: {
        lat: lat,
        lon: lon,
        name: location
      }
    });
  } catch (error) {
    console.error('Weather forecast API error:', error);
    res.status(500).json({
      error: 'Failed to fetch weather forecast data',
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
