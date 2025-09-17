import React, { useState, useEffect } from 'react';
import config from '../config';
import logoImage from '../assets/logo.png';
import WeatherDetailOverlay from './WeatherDetailOverlay';

/**
 * Global Header Component
 * Displays time and weather on all pages
 * Part of Eddie Life Management - Modular UI Components
 */
function GlobalHeader() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);
  const [showWeatherOverlay, setShowWeatherOverlay] = useState(false);

  useEffect(() => {
    fetchWeatherData();
    
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Refresh weather every 10 minutes
    const weatherTimer = setInterval(() => {
      fetchWeatherData();
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(timer);
      clearInterval(weatherTimer);
    };
  }, []);

  const fetchWeatherData = async () => {
    try {
      setWeatherLoading(true);
      setWeatherError(null);
      
      // Call our backend API to get weather data (uses EddieSettings)
      const response = await fetch(`${config.apiBaseUrl}/api/weather`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch weather data');
      }
      
      const weatherData = await response.json();
      setWeather(weatherData);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setWeatherError(err.message);
      // Don't show weather section if there's an error
      setWeather(null);
    } finally {
      setWeatherLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="px-4 py-3 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          {/* Left side - Logo/Title area */}
          <div className="flex items-center">
            <img 
              src={logoImage} 
              alt="Eddie Logo" 
              className="w-10 h-10 mr-3 border-2 border-blue-500 rounded-full shadow-md"
            />
            <h1 className="text-xl font-semibold text-gray-800">Eddie Life Management</h1>
          </div>

          {/* Right side - Time and Weather */}
          <div className="flex items-center gap-4">
            {/* Time Display */}
            <div className="px-4 py-2 text-white shadow-md bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg">
              <div className="font-mono text-lg font-bold">
                {formatTime(currentTime)}
              </div>
            </div>

            {/* Weather Display */}
            {!weatherError && (
              <div 
                className="px-4 py-2 text-white shadow-md bg-gradient-to-r from-emerald-500 to-blue-500 rounded-lg min-w-[140px] cursor-pointer hover:from-emerald-600 hover:to-blue-600 transition-all duration-200 hover:shadow-lg"
                onClick={() => setShowWeatherOverlay(true)}
                title="Click for detailed weather forecast"
              >
                {weatherLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 mr-2 border-2 border-white rounded-full animate-spin border-t-transparent"></div>
                    <span className="text-sm">Loading...</span>
                  </div>
                ) : weather ? (
                  <div className="flex items-center justify-center">
                    <img 
                      src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}.png`}
                      alt={weather.weather[0].description}
                      className="w-6 h-6 mr-2"
                    />
                    <div className="text-center">
                      <div className="text-lg font-bold">
                        {Math.round(weather.main.temp)}{weather.tempUnit || '°F'}
                      </div>
                      <div className="text-xs opacity-90 capitalize">
                        {weather.weather[0].description}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Weather Detail Overlay */}
      <WeatherDetailOverlay
        isOpen={showWeatherOverlay}
        onClose={() => setShowWeatherOverlay(false)}
        currentWeather={weather}
      />
    </div>
  );
}

export default GlobalHeader;