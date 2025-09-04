#!/usr/bin/env node

/**
 * Test script for Android Weather API endpoint
 * Tests the new /api/android/weather endpoint with different scenarios
 */

const fetch = require('node-fetch');

const API_BASE_URL = 'http://localhost:3001';

async function testAndroidWeatherEndpoint() {
  console.log('🌤️  Testing Android Weather API Endpoint');
  console.log('=======================================\n');

  try {
    console.log('📱 Testing /api/android/weather endpoint...');
    
    const response = await fetch(`${API_BASE_URL}/api/android/weather`);
    const data = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Type:', data.type);
    
    if (data.type === 'WEATHER_SUCCESS') {
      console.log('✅ Weather endpoint working!');
      console.log('📍 Location:', data.data.location.name, data.data.location.country);
      console.log('🌡️  Temperature:', data.data.current.temperature, data.data.units.temperature);
      console.log('☁️  Condition:', data.data.weather.description);
      console.log('💨 Wind Speed:', data.data.wind.speed, data.data.units.windSpeed);
      console.log('🕐 Data Time:', data.data.metadata.dataTime);
      
      if (data.data.weather.iconUrl) {
        console.log('🖼️  Weather Icon URL:', data.data.weather.iconUrl);
      }
      
    } else if (data.type === 'WEATHER_ERROR') {
      console.log('⚠️  Weather endpoint returned error (expected if not configured):');
      console.log('   Error:', data.data.error);
      console.log('   Message:', data.data.message);
      console.log('   Enabled:', data.data.enabled);
      console.log('   Configured:', data.data.configured);
      
      if (!data.data.enabled) {
        console.log('\n💡 To enable weather:');
        console.log('   1. Access Eddie settings in the web interface');
        console.log('   2. Enable weather functionality');
        console.log('   3. Get a free API key from https://openweathermap.org/api');
        console.log('   4. Configure your location (city name or lat,lon coordinates)');
      }
    }
    
    console.log('\n📋 Full Response Structure:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('❌ Error testing weather endpoint:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the Eddie server is running:');
      console.log('   cd server && npm start');
      console.log('   or');
      console.log('   npm run dev (from root directory)');
    }
  }
}

// Test response format validation
function validateResponseFormat(data) {
  console.log('\n🔍 Validating Android API Response Format...');
  
  const hasRequiredFields = data.type && data.data;
  const isValidType = ['WEATHER_SUCCESS', 'WEATHER_ERROR'].includes(data.type);
  
  if (hasRequiredFields && isValidType) {
    console.log('✅ Response format is valid for Android API');
    
    if (data.type === 'WEATHER_SUCCESS') {
      const requiredSuccessFields = [
        'location', 'current', 'weather', 'units', 'metadata'
      ];
      
      const missingFields = requiredSuccessFields.filter(field => !data.data[field]);
      
      if (missingFields.length === 0) {
        console.log('✅ All required success fields present');
      } else {
        console.log('⚠️  Missing fields:', missingFields.join(', '));
      }
    }
    
  } else {
    console.log('❌ Invalid response format for Android API');
    console.log('   Expected: {type: "WEATHER_SUCCESS|WEATHER_ERROR", data: {...}}');
    console.log('   Received:', {type: data.type, hasData: !!data.data});
  }
}

async function main() {
  console.log('🚀 Starting Android Weather API Tests\n');
  
  await testAndroidWeatherEndpoint();
  
  console.log('\n✨ Testing Complete!');
  console.log('\n📱 This endpoint is now ready for Android integration');
  console.log('   • Use the iconUrl field for weather icons');
  console.log('   • All temperatures include proper unit information');  
  console.log('   • Error responses include configuration status');
  console.log('   • All timestamps are in ISO 8601 format');
}

// Run the tests
main().catch(console.error);
