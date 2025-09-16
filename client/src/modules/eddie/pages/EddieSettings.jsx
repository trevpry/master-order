import React, { useState, useEffect } from 'react';
import config from '../../../config';
import './EddieSettings.css';

function EddieSettings() {
  const [settings, setSettings] = useState({
    timezone: 'UTC',
    weatherEnabled: false,
    weatherApiKey: '',
    weatherLocation: '',
    weatherUnits: 'metric'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/settings/eddie`);
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings({
        timezone: data.timezone || 'UTC',
        weatherEnabled: data.weatherEnabled || false,
        weatherApiKey: data.weatherApiKey || '',
        weatherLocation: data.weatherLocation || '',
        weatherUnits: data.weatherUnits || 'metric'
      });
    } catch (err) {
      setError('Failed to load settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const response = await fetch(`${config.apiBaseUrl}/api/settings/eddie`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      const savedSettings = await response.json();
      setSettings({
        timezone: savedSettings.settings?.timezone || savedSettings.timezone || 'UTC',
        weatherEnabled: savedSettings.settings?.weatherEnabled || savedSettings.weatherEnabled || false,
        weatherApiKey: savedSettings.settings?.weatherApiKey || savedSettings.weatherApiKey || '',
        weatherLocation: savedSettings.settings?.weatherLocation || savedSettings.weatherLocation || '',
        weatherUnits: savedSettings.settings?.weatherUnits || savedSettings.weatherUnits || 'metric'
      });
      setSuccess('Settings saved successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Failed to save settings: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const testWeather = async () => {
    try {
      setError('');
      const response = await fetch(`${config.apiBaseUrl}/api/weather`);
      if (response.ok) {
        const weatherData = await response.json();
        setSuccess(`Weather test successful! Current temperature in ${weatherData.name}: ${Math.round(weatherData.main.temp)}${weatherData.tempUnit}`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error);
      }
    } catch (err) {
      setError('Weather test failed: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="eddie-settings">
        <div className="settings-header">
          <h1>Eddie Settings</h1>
        </div>
        <div className="loading">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="eddie-settings">
      <div className="settings-header">
        <h1>Eddie Settings</h1>
        <p>Configure your Eddie life management settings</p>
      </div>

      <form onSubmit={handleSave} className="settings-form">
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {/* Timezone Settings */}
        <div className="settings-section">
          <h2>🌍 Timezone Settings</h2>
          
          <div className="form-group">
            <label htmlFor="timezone">Timezone</label>
            <select
              id="timezone"
              name="timezone"
              value={settings.timezone}
              onChange={(e) => handleInputChange('timezone', e.target.value)}
              className="form-control"
            >
              <option value="UTC">UTC (Coordinated Universal Time)</option>
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="America/Chicago">Central Time (Chicago)</option>
              <option value="America/Denver">Mountain Time (Denver)</option>
              <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
              <option value="America/Phoenix">Arizona Time (Phoenix)</option>
              <option value="America/Anchorage">Alaska Time (Anchorage)</option>
              <option value="Pacific/Honolulu">Hawaii Time (Honolulu)</option>
              <option value="Europe/London">Greenwich Mean Time (London)</option>
              <option value="Europe/Paris">Central European Time (Paris)</option>
              <option value="Europe/Berlin">Central European Time (Berlin)</option>
              <option value="Europe/Rome">Central European Time (Rome)</option>
              <option value="Europe/Madrid">Central European Time (Madrid)</option>
              <option value="Europe/Amsterdam">Central European Time (Amsterdam)</option>
              <option value="Europe/Moscow">Moscow Time</option>
              <option value="Asia/Tokyo">Japan Standard Time (Tokyo)</option>
              <option value="Asia/Shanghai">China Standard Time (Shanghai)</option>
              <option value="Asia/Kolkata">India Standard Time (Kolkata)</option>
              <option value="Asia/Dubai">Gulf Standard Time (Dubai)</option>
              <option value="Australia/Sydney">Australian Eastern Time (Sydney)</option>
              <option value="Australia/Melbourne">Australian Eastern Time (Melbourne)</option>
              <option value="Australia/Perth">Australian Western Time (Perth)</option>
              <option value="Pacific/Auckland">New Zealand Time (Auckland)</option>
            </select>
            <p className="form-help">
              Used for tasks, notes, and watch statistics date calculations. Current selection: {settings.timezone}
            </p>
          </div>
        </div>

        {/* Weather Settings */}
        <div className="settings-section">
          <h2>🌤️ Weather Settings</h2>
          
          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.weatherEnabled}
                onChange={(e) => handleInputChange('weatherEnabled', e.target.checked)}
              />
              <span className="checkmark"></span>
              Enable Weather Display
            </label>
            <p className="form-help">Show weather information on the dashboard</p>
          </div>

          <div className="form-group">
            <label htmlFor="weatherApiKey">OpenWeatherMap API Key</label>
            <input
              type="password"
              id="weatherApiKey"
              value={settings.weatherApiKey || ''}
              onChange={(e) => handleInputChange('weatherApiKey', e.target.value)}
              placeholder="Enter your OpenWeatherMap API key"
              disabled={!settings.weatherEnabled}
            />
            <p className="form-help">
              Get a free API key from <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer">OpenWeatherMap</a>
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="weatherLocation">Location</label>
            <input
              type="text"
              id="weatherLocation"
              value={settings.weatherLocation || ''}
              onChange={(e) => handleInputChange('weatherLocation', e.target.value)}
              placeholder="e.g., New York, NY or 40.7128,-74.0060"
              disabled={!settings.weatherEnabled}
            />
            <p className="form-help">
              Enter a city name (e.g., "New York, NY") or coordinates (e.g., "40.7128,-74.0060")
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="weatherUnits">Temperature Units</label>
            <select
              id="weatherUnits"
              value={settings.weatherUnits}
              onChange={(e) => handleInputChange('weatherUnits', e.target.value)}
              disabled={!settings.weatherEnabled}
            >
              <option value="metric">Celsius (°C)</option>
              <option value="imperial">Fahrenheit (°F)</option>
              <option value="kelvin">Kelvin (K)</option>
            </select>
          </div>

          {settings.weatherEnabled && settings.weatherApiKey && settings.weatherLocation && (
            <div className="form-group">
              <button type="button" onClick={testWeather} className="test-button">
                Test Weather Connection
              </button>
            </div>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" disabled={saving} className="save-button">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EddieSettings;
