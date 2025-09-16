import React, { useState, useEffect } from 'react';
import { 
  Cloud,
  Sun,
  CloudRain,
  Snowflake,
  CloudLightning,
  CloudDrizzle,
  CloudSnow,
  Zap,
  Eye,
  Droplets,
  Wind,
  Thermometer,
  Gauge,
  Sunrise,
  Sunset,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import config from '../../../config';

const DailyWeatherWidget = ({ date, timezone }) => {
  const [weatherSummary, setWeatherSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (date) {
      fetchWeatherSummary();
    }
  }, [date]);

  const fetchWeatherSummary = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/weather/summary/${date}`);
      
      if (response.ok) {
        const result = await response.json();
        setWeatherSummary(result.data);
      } else if (response.status === 404) {
        // No weather summary found for this date
        setWeatherSummary(null);
      } else {
        throw new Error('Failed to fetch weather summary');
      }
    } catch (err) {
      console.error('Error fetching weather summary:', err);
      setError('Failed to load weather data');
    } finally {
      setLoading(false);
    }
  };

  const generateWeatherSummary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/weather/summary/generate/${date}`, {
        method: 'POST'
      });
      
      if (response.ok) {
        const result = await response.json();
        setWeatherSummary(result.data);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate weather summary');
      }
    } catch (err) {
      console.error('Error generating weather summary:', err);
      setError(`Failed to generate weather summary: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getWeatherIcon = (condition) => {
    const iconClass = "h-8 w-8";
    
    switch (condition?.toLowerCase()) {
      case 'clear':
        return <Sun className={`${iconClass} text-yellow-500`} />;
      case 'clouds':
        return <Cloud className={`${iconClass} text-gray-500`} />;
      case 'rain':
        return <CloudRain className={`${iconClass} text-blue-500`} />;
      case 'drizzle':
        return <CloudDrizzle className={`${iconClass} text-blue-400`} />;
      case 'snow':
        return <Snowflake className={`${iconClass} text-blue-200`} />;
      case 'thunderstorm':
        return <CloudLightning className={`${iconClass} text-purple-500`} />;
      case 'mist':
      case 'fog':
      case 'haze':
        return <Cloud className={`${iconClass} text-gray-400`} />;
      default:
        return <Cloud className={`${iconClass} text-gray-400`} />;
    }
  };

  const formatTemperature = (temp) => {
    if (temp === null || temp === undefined) return 'N/A';
    return `${Math.round(temp)}°`;
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    return timeString; // Already in HH:MM format
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchWeatherSummary}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!weatherSummary) {
    return (
      <div className="text-center py-12">
        <Cloud className="h-16 w-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Weather Data</h3>
        <p className="text-gray-600 mb-4">
          Weather summary for {date} hasn't been generated yet.
        </p>
        <button
          onClick={generateWeatherSummary}
          disabled={isGenerating}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Generate Weather Summary
            </>
          )}
        </button>
        <p className="text-sm text-gray-500 mt-2">
          This will fetch weather data for this date and store it for future viewing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Main Weather Display */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          {getWeatherIcon(weatherSummary.conditions)}
          <div className="ml-4">
            <h3 className="text-2xl font-bold text-gray-900 capitalize">
              {weatherSummary.conditions}
            </h3>
            <p className="text-gray-600 capitalize">{weatherSummary.description}</p>
          </div>
        </div>
      </div>

      {/* Temperature Information */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3 flex items-center">
          <Thermometer className="h-5 w-5 mr-2 text-blue-600" />
          Temperature
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-blue-600">
              {formatTemperature(weatherSummary.tempMin)}
            </p>
            <p className="text-sm text-gray-600">Low</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-green-600">
              {formatTemperature(weatherSummary.tempAvg)}
            </p>
            <p className="text-sm text-gray-600">Average</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-red-600">
              {formatTemperature(weatherSummary.tempMax)}
            </p>
            <p className="text-sm text-gray-600">High</p>
          </div>
        </div>
      </div>

      {/* Weather Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Humidity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-2">
            <Droplets className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-medium text-gray-900">Humidity</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {weatherSummary.humidity ? `${weatherSummary.humidity}%` : 'N/A'}
          </p>
        </div>

        {/* Wind Speed */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-2">
            <Wind className="h-5 w-5 text-gray-500 mr-2" />
            <span className="font-medium text-gray-900">Wind</span>
          </div>
          <p className="text-2xl font-bold text-gray-600">
            {weatherSummary.windSpeed ? `${Math.round(weatherSummary.windSpeed)} m/s` : 'N/A'}
          </p>
        </div>

        {/* Precipitation */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-2">
            <CloudRain className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-medium text-gray-900">Precipitation</span>
          </div>
          <p className="text-2xl font-bold text-blue-600">
            {weatherSummary.precipitation ? `${weatherSummary.precipitation} mm` : '0 mm'}
          </p>
        </div>

        {/* Pressure */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center mb-2">
            <Gauge className="h-5 w-5 text-purple-500 mr-2" />
            <span className="font-medium text-gray-900">Pressure</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">
            {weatherSummary.pressure ? `${weatherSummary.pressure} hPa` : 'N/A'}
          </p>
        </div>
      </div>

      {/* Sunrise/Sunset */}
      {(weatherSummary.sunrise || weatherSummary.sunset) && (
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Sun Times</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center">
              <Sunrise className="h-5 w-5 text-orange-500 mr-2" />
              <div>
                <p className="font-medium text-orange-700">Sunrise</p>
                <p className="text-sm text-gray-600">{formatTime(weatherSummary.sunrise)}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Sunset className="h-5 w-5 text-orange-600 mr-2" />
              <div>
                <p className="font-medium text-orange-700">Sunset</p>
                <p className="text-sm text-gray-600">{formatTime(weatherSummary.sunset)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Data Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-start">
          <Eye className="h-5 w-5 text-gray-500 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-gray-900">Automated Weather Summary</h4>
            <p className="text-sm text-gray-600 mt-1">
              This weather data was automatically collected and stored for {date}.
              Weather summaries are generated daily at midnight.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Data updated: {new Date(weatherSummary.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyWeatherWidget;