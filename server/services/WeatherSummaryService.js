/**
 * Weather Summary Service
 * Part of Eddie Life Management - Weather Information Module
 * 
 * Handles daily weather summary generation and storage
 * Fetches historical weather data from OpenWeatherMap API and stores daily summaries
 */

const { PrismaClient } = require('@prisma/client');

class WeatherSummaryService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * Get coordinates from Eddie Settings weather location
   * Returns {lat, lon} or null if not available
   */
  async getCoordinates() {
    try {
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      
      if (!eddieSettings?.weatherLocation) {
        console.error('Weather location not configured in Eddie Settings');
        return null;
      }

      const location = eddieSettings.weatherLocation;
      
      // Check if location is already coordinates (lat,lon)
      const coordPattern = /^[-+]?\d*\.?\d+\s*,\s*[-+]?\d*\.?\d+$/;
      if (coordPattern.test(location.trim())) {
        const [lat, lon] = location.split(',').map(coord => parseFloat(coord.trim()));
        return { lat, lon };
      }
      
      // If it's a city name, get coordinates using geocoding API
      const apiKey = eddieSettings.weatherApiKey;
      if (!apiKey) {
        console.error('Weather API key not configured');
        return null;
      }
      
      const geocodeUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
      const response = await fetch(geocodeUrl);
      
      if (!response.ok) {
        console.error('Failed to fetch coordinates:', response.status);
        return null;
      }
      
      const geocodeData = await response.json();
      if (!geocodeData.length) {
        console.error('No coordinates found for location:', location);
        return null;
      }
      
      return {
        lat: geocodeData[0].lat,
        lon: geocodeData[0].lon
      };
    } catch (error) {
      console.error('Error getting coordinates:', error);
      return null;
    }
  }

  /**
   * Fetch historical weather data for a specific date
   * Uses OpenWeatherMap One Call API historical data
   */
  async fetchHistoricalWeather(date, coordinates) {
    try {
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      
      if (!eddieSettings?.weatherApiKey) {
        throw new Error('Weather API key not configured');
      }
      
      const apiKey = eddieSettings.weatherApiKey;
      const units = eddieSettings.weatherUnits || 'metric';
      
      // Convert date to Unix timestamp (start of day)
      const dateObj = new Date(date + 'T00:00:00');
      const timestamp = Math.floor(dateObj.getTime() / 1000);
      
      // Note: OpenWeatherMap historical data requires a paid subscription
      // For free tier, we'll use current weather API and store current conditions
      // In production, you'd use: https://api.openweathermap.org/data/3.0/onecall/timemachine
      
      // For now, let's use current weather API and adapt the data
      const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coordinates.lat}&lon=${coordinates.lon}&appid=${apiKey}&units=${units}`;
      
      const response = await fetch(weatherUrl);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenWeatherMap API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
      }
      
      const weatherData = await response.json();
      
      // Transform current weather data to daily summary format
      return {
        conditions: weatherData.weather[0].main,
        description: weatherData.weather[0].description,
        tempMin: weatherData.main.temp_min,
        tempMax: weatherData.main.temp_max,
        tempAvg: weatherData.main.temp,
        humidity: weatherData.main.humidity,
        precipitation: weatherData.rain ? (weatherData.rain['1h'] || 0) : 0,
        windSpeed: weatherData.wind.speed,
        pressure: weatherData.main.pressure,
        cloudiness: weatherData.clouds.all,
        sunrise: this.formatTime(weatherData.sys.sunrise),
        sunset: this.formatTime(weatherData.sys.sunset),
        weatherData: JSON.stringify(weatherData)
      };
    } catch (error) {
      console.error('Error fetching historical weather:', error);
      throw error;
    }
  }

  /**
   * Convert Unix timestamp to HH:MM format
   */
  formatTime(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Store daily weather summary in database
   */
  async storeDailyWeatherSummary(date, weatherSummary) {
    try {
      const existingSummary = await this.prisma.dailyWeatherSummary.findUnique({
        where: { date }
      });

      if (existingSummary) {
        // Update existing summary
        return await this.prisma.dailyWeatherSummary.update({
          where: { date },
          data: weatherSummary
        });
      } else {
        // Create new summary
        return await this.prisma.dailyWeatherSummary.create({
          data: {
            date,
            ...weatherSummary
          }
        });
      }
    } catch (error) {
      console.error('Error storing weather summary:', error);
      throw error;
    }
  }

  /**
   * Generate and store daily weather summary for a specific date
   */
  async generateDailyWeatherSummary(date) {
    try {
      console.log(`Generating weather summary for ${date}...`);
      
      // Check if weather is enabled
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      if (!eddieSettings?.weatherEnabled) {
        console.log('Weather is not enabled, skipping summary generation');
        return null;
      }
      
      // Get coordinates
      const coordinates = await this.getCoordinates();
      if (!coordinates) {
        console.error('Could not get coordinates for weather summary');
        return null;
      }
      
      // Fetch weather data
      const weatherSummary = await this.fetchHistoricalWeather(date, coordinates);
      
      // Store in database
      const stored = await this.storeDailyWeatherSummary(date, weatherSummary);
      
      console.log(`Weather summary stored for ${date}:`, {
        conditions: stored.conditions,
        tempMin: stored.tempMin,
        tempMax: stored.tempMax
      });
      
      return stored;
    } catch (error) {
      console.error(`Error generating weather summary for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Get daily weather summary from database
   */
  async getDailyWeatherSummary(date) {
    try {
      return await this.prisma.dailyWeatherSummary.findUnique({
        where: { date }
      });
    } catch (error) {
      console.error(`Error fetching weather summary for ${date}:`, error);
      throw error;
    }
  }

  /**
   * Get weather summaries for a date range
   */
  async getWeatherSummariesForRange(startDate, endDate) {
    try {
      return await this.prisma.dailyWeatherSummary.findMany({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: {
          date: 'asc'
        }
      });
    } catch (error) {
      console.error(`Error fetching weather summaries for range ${startDate} to ${endDate}:`, error);
      throw error;
    }
  }

  /**
   * Generate weather summary for yesterday (to be called at midnight)
   */
  async generateYesterdayWeatherSummary() {
    try {
      // Get timezone from Eddie Settings
      const eddieSettings = await this.prisma.eddieSettings.findFirst();
      const timezone = eddieSettings?.timezone || 'UTC';
      
      // Get yesterday's date in the configured timezone
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Format as YYYY-MM-DD in the local timezone
      const yesterdayDate = yesterday.toLocaleDateString('en-CA', {
        timeZone: timezone
      });
      
      return await this.generateDailyWeatherSummary(yesterdayDate);
    } catch (error) {
      console.error('Error generating yesterday weather summary:', error);
      throw error;
    }
  }

  /**
   * Clean up old weather summaries (keep last 365 days)
   */
  async cleanupOldWeatherSummaries() {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 365);
      const cutoffDateString = cutoffDate.toISOString().split('T')[0];
      
      const deleted = await this.prisma.dailyWeatherSummary.deleteMany({
        where: {
          date: {
            lt: cutoffDateString
          }
        }
      });
      
      console.log(`Cleaned up ${deleted.count} old weather summaries`);
      return deleted.count;
    } catch (error) {
      console.error('Error cleaning up old weather summaries:', error);
      throw error;
    }
  }
}

module.exports = WeatherSummaryService;