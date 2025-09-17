import React, { useState, useEffect } from 'react';
import config from '../config';

/**
 * Weather Detail Overlay Component
 * Displays detailed weather information including hourly and daily forecasts
 * Triggered when clicking on weather in the global header
 */
function WeatherDetailOverlay({ isOpen, onClose, currentWeather }) {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && !forecastData) {
      fetchForecastData();
    }
  }, [isOpen]);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${config.apiBaseUrl}/api/weather/forecast`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch forecast data');
      }
      
      const data = await response.json();
      setForecastData(data);
    } catch (err) {
      console.error('Forecast fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTemp = (temp, unit) => {
    return `${Math.round(temp)}${unit || '°F'}`;
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp * 1000).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getWindDirection = (degrees) => {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800">Weather Details</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-gray-600">Loading weather data...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <p className="text-red-600 font-medium">{error}</p>
              <button
                onClick={fetchForecastData}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : forecastData ? (
            <div className="space-y-8">
              {/* Current Weather Details */}
              <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <img
                      src={`https://openweathermap.org/img/wn/${forecastData.current.weather[0].icon}@2x.png`}
                      alt={forecastData.current.weather[0].description}
                      className="w-16 h-16 mr-4"
                    />
                    <div>
                      <div className="text-4xl font-bold">
                        {formatTemp(forecastData.current.main.temp, forecastData.current.tempUnit)}
                      </div>
                      <div className="text-xl opacity-90 capitalize">
                        {forecastData.current.weather[0].description}
                      </div>
                      <div className="text-sm opacity-75">
                        Feels like {formatTemp(forecastData.current.main.feels_like, forecastData.current.tempUnit)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right space-y-2">
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 9.172V5L8 4z" />
                      </svg>
                      <span>{forecastData.current.wind.speed} {forecastData.current.speedUnit}</span>
                      <span className="ml-1">{getWindDirection(forecastData.current.wind.deg)}</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                      </svg>
                      <span>{forecastData.current.main.humidity}% humidity</span>
                    </div>
                    <div className="flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16l3-3m-3 3l-3-3" />
                      </svg>
                      <span>{forecastData.current.main.pressure} hPa</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hourly Forecast */}
              {forecastData.hourly && forecastData.hourly.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">12-Hour Forecast</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {forecastData.hourly.map((hour, index) => (
                        <div key={index} className="text-center bg-white rounded-lg p-3 shadow-sm">
                          <div className="text-sm font-medium text-gray-600 mb-1">
                            {hour.time}
                          </div>
                          <img
                            src={`https://openweathermap.org/img/wn/${hour.weather.icon}.png`}
                            alt={hour.weather.description}
                            className="w-10 h-10 mx-auto mb-1"
                          />
                          <div className="text-lg font-bold text-gray-800">
                            {formatTemp(hour.temp, forecastData.current.tempUnit)}
                          </div>
                          {hour.pop > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              {hour.pop}% 🌧️
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Daily Forecast */}
              {forecastData.daily && forecastData.daily.length > 0 && (
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-4">7-Day Forecast</h3>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <div className="space-y-3">
                      {forecastData.daily.map((day, index) => (
                        <div key={index} className="flex items-center justify-between bg-white rounded-lg p-4 shadow-sm">
                          <div className="flex items-center flex-1">
                            <div className="text-sm font-medium text-gray-600 w-16">
                              {index === 0 ? 'Today' : day.date}
                            </div>
                            <img
                              src={`https://openweathermap.org/img/wn/${day.weather.icon}.png`}
                              alt={day.weather.description}
                              className="w-10 h-10 mx-4"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800 capitalize">
                                {day.weather.description}
                              </div>
                              <div className="text-xs text-gray-500">
                                Humidity: {day.humidity}%
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            {day.pop > 0 && (
                              <div className="text-sm text-blue-600">
                                {day.pop}% 🌧️
                              </div>
                            )}
                            <div className="text-right">
                              <div className="text-lg font-bold text-gray-800">
                                {formatTemp(day.temp.max, forecastData.current.tempUnit)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatTemp(day.temp.min, forecastData.current.tempUnit)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* No forecast message */}
              {!forecastData.forecastAvailable && (
                <div className="text-center py-8 bg-yellow-50 rounded-xl border border-yellow-200">
                  <div className="text-yellow-600 mb-2">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <p className="text-yellow-800 font-medium">{forecastData.message}</p>
                  <p className="text-yellow-700 text-sm mt-1">Only current weather is available</p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default WeatherDetailOverlay;