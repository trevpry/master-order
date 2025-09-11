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

/**
 * GET /api/weather/android - Android companion app weather endpoint
 * Returns weather data formatted specifically for the Android app
 */
router.get('/android', async (req, res) => {
  console.log('📱 Android app requesting weather information...');
  
  try {
    // Get Eddie settings for weather configuration
    const eddieSettings = await prisma.eddieSettings.findFirst();
    
    if (!eddieSettings?.weatherEnabled) {
      return res.status(400).json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather service disabled',
          message: 'Weather functionality is not enabled in settings',
          enabled: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!eddieSettings?.weatherApiKey) {
      return res.status(400).json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather API key missing',
          message: 'Weather API key is not configured in settings',
          enabled: true,
          configured: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    if (!eddieSettings?.weatherLocation) {
      return res.status(400).json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather location missing',
          message: 'Weather location is not configured in settings',
          enabled: true,
          configured: false,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const apiKey = eddieSettings.weatherApiKey;
    const location = eddieSettings.weatherLocation;
    const units = eddieSettings.weatherUnits || 'metric';
    
    // Check if location is coordinates (lat,lon) or city name
    let weatherUrl;
    const coordPattern = /^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$/;
    if (coordPattern.test(location.trim())) {
      // It's coordinates format "lat,lon"
      const [lat, lon] = location.split(',').map(coord => coord.trim());
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=${units}`;
    } else {
      // It's a city name (possibly with state/country)
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`;
    }
    
    console.log('📱 Fetching weather data from OpenWeatherMap API...');
    const response = await fetch(weatherUrl);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown API error' }));
      console.error('❌ OpenWeatherMap API error:', response.status, errorData.message);
      
      return res.status(502).json({
        type: 'WEATHER_ERROR',
        data: {
          error: 'Weather API error',
          message: `Failed to fetch weather data: ${errorData.message || 'Service unavailable'}`,
          statusCode: response.status,
          enabled: true,
          configured: true,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    const weatherData = await response.json();
    console.log('📱 Weather data received successfully:', weatherData.name);
    
    // Format response for Android app with comprehensive weather information
    const androidResponse = {
      type: 'WEATHER_SUCCESS',
      data: {
        success: true,
        location: {
          name: weatherData.name,
          country: weatherData.sys?.country,
          coordinates: {
            latitude: weatherData.coord?.lat,
            longitude: weatherData.coord?.lon
          },
          timezone: weatherData.timezone,
          sunrise: weatherData.sys?.sunrise ? new Date(weatherData.sys.sunrise * 1000).toISOString() : null,
          sunset: weatherData.sys?.sunset ? new Date(weatherData.sys.sunset * 1000).toISOString() : null
        },
        current: {
          temperature: weatherData.main?.temp,
          feelsLike: weatherData.main?.feels_like,
          tempMin: weatherData.main?.temp_min,
          tempMax: weatherData.main?.temp_max,
          humidity: weatherData.main?.humidity,
          pressure: weatherData.main?.pressure,
          visibility: weatherData.visibility ? weatherData.visibility / 1000 : null, // Convert to km
          uvIndex: null // Not available in current weather API
        },
        weather: {
          condition: weatherData.weather?.[0]?.main,
          description: weatherData.weather?.[0]?.description,
          icon: weatherData.weather?.[0]?.icon,
          iconUrl: weatherData.weather?.[0]?.icon ? `https://openweathermap.org/img/wn/${weatherData.weather[0].icon}@2x.png` : null
        },
        wind: {
          speed: weatherData.wind?.speed,
          direction: weatherData.wind?.deg,
          gust: weatherData.wind?.gust
        },
        clouds: {
          cloudiness: weatherData.clouds?.all
        },
        rain: {
          oneHour: weatherData.rain?.['1h'],
          threeHours: weatherData.rain?.['3h']
        },
        snow: {
          oneHour: weatherData.snow?.['1h'],
          threeHours: weatherData.snow?.['3h']
        },
        units: {
          system: units,
          temperature: units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K',
          windSpeed: units === 'metric' ? 'm/s' : units === 'imperial' ? 'mph' : 'm/s',
          pressure: 'hPa',
          visibility: 'km'
        },
        metadata: {
          dataTime: new Date(weatherData.dt * 1000).toISOString(),
          requestTime: new Date().toISOString(),
          source: 'OpenWeatherMap',
          apiVersion: '2.5'
        }
      }
    };
    
    console.log('📱 Weather response formatted for Android app');
    res.json(androidResponse);
    
  } catch (error) {
    console.error('❌ Error in Android weather endpoint:', error);
    
    const androidErrorResponse = {
      type: 'WEATHER_ERROR',
      data: {
        success: false,
        error: 'Internal server error',
        message: 'Failed to process weather request',
        details: error.message,
        enabled: true,
        timestamp: new Date().toISOString()
      }
    };
    
    res.status(500).json(androidErrorResponse);
  }
});

module.exports = router;
