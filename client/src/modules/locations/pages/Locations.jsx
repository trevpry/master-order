import React, { useState, useEffect } from 'react';
import { MapPin, List, Map as MapIcon, BarChart3, Settings, Plus, AlertCircle } from 'lucide-react';
import Map from '../../../components/locations/Map';
import LocationList from '../../../components/locations/LocationList';
import LocationForm from '../../../components/locations/LocationForm';
import locationService from '../../../services/locationService';

const Locations = () => {
  const [activeTab, setActiveTab] = useState('map');
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [addLocationCoordinates, setAddLocationCoordinates] = useState(null);
  const [stats, setStats] = useState(null);
  const [availableNotes, setAvailableNotes] = useState([]);

  const tabs = [
    { id: 'map', label: 'Map View', icon: MapIcon },
    { id: 'list', label: 'List View', icon: List },
    { id: 'stats', label: 'Statistics', icon: BarChart3 },
  ];

  useEffect(() => {
    loadLocations();
    loadStats();
    loadAvailableNotes();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await locationService.getAllLocations();
      setLocations(response.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to load locations');
      console.error('Error loading locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await locationService.getLocationStats();
      setStats(response.data);
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadAvailableNotes = async () => {
    try {
      // This would need to be implemented to fetch notes from the notes API
      // For now, we'll use an empty array
      setAvailableNotes([]);
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  };

  const handleAddLocation = (lat, lng) => {
    setAddLocationCoordinates({ lat, lng });
    setEditingLocation(null);
    setShowLocationForm(true);
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setAddLocationCoordinates(null);
    setShowLocationForm(true);
  };

  const handleDeleteLocation = async (location) => {
    if (!window.confirm(`Are you sure you want to delete "${location.name}"?`)) {
      return;
    }

    try {
      await locationService.deleteLocation(location.id);
      await loadLocations();
      await loadStats();
      setSelectedLocation(null);
    } catch (err) {
      setError('Failed to delete location');
      console.error('Error deleting location:', err);
    }
  };

  const handleToggleFavorite = async (locationId, isFavorite) => {
    try {
      await locationService.toggleFavorite(locationId, isFavorite);
      await loadLocations();
      await loadStats();
    } catch (err) {
      setError('Failed to update favorite status');
      console.error('Error toggling favorite:', err);
    }
  };

  const handleLocationClick = (location) => {
    setSelectedLocation(location);
    setActiveTab('map');
  };

  const handleSaveLocation = async (locationData) => {
    try {
      if (editingLocation) {
        await locationService.updateLocation(editingLocation.id, locationData);
      } else {
        await locationService.createLocation(locationData);
      }
      
      await loadLocations();
      await loadStats();
      setShowLocationForm(false);
      setEditingLocation(null);
      setAddLocationCoordinates(null);
    } catch (err) {
      setError('Failed to save location');
      console.error('Error saving location:', err);
    }
  };

  const handleCancelLocationForm = () => {
    setShowLocationForm(false);
    setEditingLocation(null);
    setAddLocationCoordinates(null);
  };

  const getMapCenter = () => {
    if (selectedLocation) {
      return [selectedLocation.latitude, selectedLocation.longitude];
    }
    if (locations.length > 0) {
      const avgLat = locations.reduce((sum, loc) => sum + loc.latitude, 0) / locations.length;
      const avgLng = locations.reduce((sum, loc) => sum + loc.longitude, 0) / locations.length;
      return [avgLat, avgLng];
    }
    return [40.7128, -74.0060]; // Default to NYC
  };

  const renderStats = () => {
    if (!stats) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Locations</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <MapPin className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Favorites</p>
                <p className="text-2xl font-bold text-gray-900">{stats.favorites}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <MapIcon className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Countries</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.keys(stats.byCountry || {}).length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow border">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <BarChart3 className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Types</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Object.keys(stats.byType || {}).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* By Type */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Locations by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(stats.byType || {}).map(([type, count]) => (
              <div key={type} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-600 capitalize">{type}</p>
                <p className="text-xl font-bold text-gray-900">{count}</p>
              </div>
            ))}
          </div>
        </div>

        {/* By Country */}
        {Object.keys(stats.byCountry || {}).length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Locations by Country</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(stats.byCountry || {})
                .sort(([,a], [,b]) => b - a)
                .map(([country, count]) => (
                <div key={country} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-600">{country}</p>
                  <p className="text-xl font-bold text-gray-900">{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <MapPin className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
            </div>
            
            <button
              onClick={() => handleAddLocation()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Location</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
            <AlertCircle className="w-5 h-5 text-red-600 mr-3" />
            <span className="text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'map' && (
          <div className="space-y-4">
            <Map
              locations={locations}
              center={getMapCenter()}
              height="calc(100vh - 300px)"
              onLocationClick={handleLocationClick}
              onEditLocation={handleEditLocation}
              onDeleteLocation={handleDeleteLocation}
              onToggleFavorite={handleToggleFavorite}
              onAddLocation={handleAddLocation}
              addLocationMode={true}
            />
          </div>
        )}

        {activeTab === 'list' && (
          <LocationList
            locations={locations}
            onLocationClick={handleLocationClick}
            onEditLocation={handleEditLocation}
            onDeleteLocation={handleDeleteLocation}
            onToggleFavorite={handleToggleFavorite}
            onAddLocation={() => handleAddLocation()}
            loading={loading}
          />
        )}

        {activeTab === 'stats' && renderStats()}
      </div>

      {/* Location Form Modal */}
      {showLocationForm && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" style={{ zIndex: 10000 }}>
          <div className="relative top-20 mx-auto p-5 w-full max-w-4xl">
            <LocationForm
              location={editingLocation}
              initialCoordinates={addLocationCoordinates}
              availableNotes={availableNotes}
              onSave={handleSaveLocation}
              onCancel={handleCancelLocationForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Locations;
