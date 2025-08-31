import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import config from "./config";
import logoImage from "./assets/logo.png";

function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState(null);

  useEffect(() => {
    fetchWeatherData();
    
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
    } finally {
      setWeatherLoading(false);
    }
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <div className="p-6 mx-auto max-w-7xl">
        {/* Hero Section with Time */}
        <div className="mb-12 text-center">
          <div className="relative">
            <div className="absolute inset-0 transform bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl rotate-1 opacity-10"></div>
            <div className="relative p-8 bg-white border border-gray-100 shadow-2xl rounded-3xl">
              <div className="flex items-center justify-center mb-6">
                <img 
                  src={logoImage} 
                  alt="Eddie Logo" 
                  className="w-20 h-20 border-4 border-white rounded-full shadow-lg"
                />
              </div>
              <h1 className="mb-4 text-6xl font-bold text-transparent bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text">
                Welcome to Eddie
              </h1>
              <p className="mb-6 text-2xl text-gray-600">Your comprehensive life management assistant</p>
              
              <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
                {/* Time Display */}
                <div className="p-6 text-white shadow-lg bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl">
                  <div className="mb-2 font-mono text-4xl font-bold">
                    {formatTime(currentTime)}
                  </div>
                  <div className="text-xl opacity-90">
                    {formatDate(currentTime)}
                  </div>
                </div>

                {/* Weather Display */}
                <div className="bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl p-6 text-white shadow-lg min-w-[200px]">
                  {weatherLoading ? (
                    <div className="text-center">
                      <div className="w-8 h-8 mx-auto mb-2 border-2 border-white rounded-full animate-spin border-t-transparent"></div>
                      <div className="text-sm opacity-90">Loading weather...</div>
                    </div>
                  ) : weatherError ? (
                    <div className="text-center">
                      <div className="mb-2 text-2xl">🌤️</div>
                      <div className="text-sm opacity-90">Weather unavailable</div>
                    </div>
                  ) : weather ? (
                    <div className="text-center">
                      <div className="flex items-center justify-center mb-2">
                        <img 
                          src={`https://openweathermap.org/img/wn/${weather.weather[0].icon}@2x.png`}
                          alt={weather.weather[0].description}
                          className="w-12 h-12"
                        />
                        <div className="ml-2 text-3xl font-bold">
                          {Math.round(weather.main.temp)}{weather.tempUnit || '°F'}
                        </div>
                      </div>
                      <div className="mb-1 text-sm capitalize opacity-90">
                        {weather.weather[0].description}
                      </div>
                      <div className="text-xs opacity-80">
                        {weather.name}
                      </div>
                      <div className="mt-1 text-xs opacity-80">
                        Feels like {Math.round(weather.main.feels_like)}{weather.tempUnit || '°F'}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>



        {/* Media Quick Access */}
        <div className="relative">
          <div className="absolute inset-0 transform bg-gradient-to-r from-gray-700 to-gray-900 rounded-3xl rotate-1"></div>
          <div className="relative p-8 text-white bg-gray-800 shadow-2xl rounded-3xl">
            <h2 className="mb-8 text-3xl font-bold text-center">🎬 Media Library Quick Access</h2>
            <div className="grid grid-cols-2 gap-6 md:grid-cols-6">
              <Link to="/dating" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">💕</div>
                  <div className="mb-1 text-lg font-bold">Dating</div>
                  <div className="text-sm text-gray-300">Connections & dates</div>
                </div>
              </Link>
              
              <Link to="/media/custom-orders" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">📋</div>
                  <div className="mb-1 text-lg font-bold">Custom Orders</div>
                  <div className="text-sm text-gray-300">Curated experiences</div>
                </div>
              </Link>
              
              <Link to="/media/watch-stats" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">📊</div>
                  <div className="mb-1 text-lg font-bold">Watch Stats</div>
                  <div className="text-sm text-gray-300">View analytics</div>
                </div>
              </Link>
              
              <Link to="/media/stash" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">🎬</div>
                  <div className="mb-1 text-lg font-bold">Stash</div>
                  <div className="text-sm text-gray-300">Adult content</div>
                </div>
              </Link>
              
              <Link to="/media/music" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">🎵</div>
                  <div className="mb-1 text-lg font-bold">Music</div>
                  <div className="text-sm text-gray-300">Audio library</div>
                </div>
              </Link>
              
              <Link to="/media/settings" className="transition-all duration-300 transform group hover:scale-105">
                <div className="p-6 text-center transition-all duration-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 rounded-2xl hover:border-gray-500">
                  <div className="mb-3 text-4xl transition-transform duration-300 group-hover:scale-110">⚙️</div>
                  <div className="mb-1 text-lg font-bold">Settings</div>
                  <div className="text-sm text-gray-300">Configuration</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
