const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testWeatherEndpoint() {
  try {
    console.log('Testing weather endpoint logic...');
    
    // Get Eddie settings for weather configuration
    const eddieSettings = await prisma.eddieSettings.findFirst();
    console.log('EddieSettings:', eddieSettings);
    
    if (!eddieSettings?.weatherEnabled) {
      console.log('Weather is not enabled in settings');
      return;
    }
    
    if (!eddieSettings?.weatherApiKey) {
      console.log('Weather API key not configured');
      return;
    }
    
    if (!eddieSettings?.weatherLocation) {
      console.log('Weather location not configured');
      return;
    }
    
    const apiKey = eddieSettings.weatherApiKey;
    const location = eddieSettings.weatherLocation;
    const units = eddieSettings.weatherUnits || 'metric';
    
    console.log('Weather config:', { apiKey: `${apiKey.slice(0, 8)}...`, location, units });
    
    // Check if location is coordinates (lat,lon) or city name
    let weatherUrl;
    if (location.includes(',')) {
      // Assume coordinates format "lat,lon"
      const [lat, lon] = location.split(',');
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat.trim()}&lon=${lon.trim()}&appid=${apiKey}&units=${units}`;
    } else {
      // Assume city name
      weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&appid=${apiKey}&units=${units}`;
    }
    
    console.log('Weather URL:', weatherUrl.replace(apiKey, 'API_KEY_HIDDEN'));
    
    console.log('Making weather API request...');
    const response = await fetch(weatherUrl);
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenWeatherMap API error:', response.status, errorData);
      return;
    }
    
    const weatherData = await response.json();
    console.log('Weather data received:', JSON.stringify(weatherData, null, 2));
    
    // Add units info to response
    weatherData.units = units;
    weatherData.tempUnit = units === 'metric' ? '°C' : units === 'imperial' ? '°F' : 'K';
    weatherData.speedUnit = units === 'metric' ? 'm/s' : 'mph';
    
    console.log('Final weather response:', JSON.stringify(weatherData, null, 2));
    
  } catch (error) {
    console.error('Weather test error:', error.message);
    console.error('Error stack:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testWeatherEndpoint();
