import React, { useState, useEffect } from 'react';
import { MapPin, Search, Plus, X, Check } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import locationService from '../../services/locationService';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const LocationPickerMarker = ({ onLocationSelect }) => {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
      onLocationSelect({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng,
        isNewLocation: true
      });
    },
  });

  return position === null ? null : <Marker position={position} />;
};

const LocationPicker = ({
  selectedLocation = null,
  onLocationSelect,
  onCreateNew,
  onClose,
  allowCreateNew = true,
  filterType = null,
  compact = false,
}) => {
  const [locations, setLocations] = useState([]);
  const [filteredLocations, setFilteredLocations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showMap, setShowMap] = useState(false);
  const [mapMode, setMapMode] = useState('select'); // 'select' or 'create'

  useEffect(() => {
    loadLocations();
  }, []);

  useEffect(() => {
    filterLocations();
  }, [locations, searchQuery, filterType]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await locationService.getAllLocations({ 
        type: filterType || undefined,
        limit: 100 
      });
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to load locations:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const filterLocations = () => {
    let filtered = locations;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = locations.filter(location =>
        location.name.toLowerCase().includes(query) ||
        location.description?.toLowerCase().includes(query) ||
        location.address?.toLowerCase().includes(query) ||
        location.city?.toLowerCase().includes(query)
      );
    }

    setFilteredLocations(filtered);
  };

  const handleLocationClick = (location) => {
    onLocationSelect(location);
  };

  const handleMapLocationSelect = (coords) => {
    if (mapMode === 'create' && allowCreateNew) {
      onCreateNew && onCreateNew(coords);
    } else {
      // Find if there's a location at these coordinates
      const existingLocation = locations.find(loc => 
        Math.abs(loc.latitude - coords.latitude) < 0.001 &&
        Math.abs(loc.longitude - coords.longitude) < 0.001
      );
      
      if (existingLocation) {
        onLocationSelect(existingLocation);
      } else if (allowCreateNew) {
        onCreateNew && onCreateNew(coords);
      }
    }
  };

  const getMapCenter = () => {
    if (selectedLocation) {
      return [selectedLocation.latitude, selectedLocation.longitude];
    }
    if (filteredLocations.length > 0) {
      const avgLat = filteredLocations.reduce((sum, loc) => sum + loc.latitude, 0) / filteredLocations.length;
      const avgLng = filteredLocations.reduce((sum, loc) => sum + loc.longitude, 0) / filteredLocations.length;
      return [avgLat, avgLng];
    }
    return [40.7128, -74.0060]; // Default to NYC
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Selected Location Display */}
        {selectedLocation && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">{selectedLocation.name}</p>
                {selectedLocation.city && (
                  <p className="text-sm text-blue-700">{selectedLocation.city}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => onLocationSelect(null)}
              className="text-blue-600 hover:text-blue-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Quick Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Location List */}
        {searchQuery && (
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading locations...</div>
            ) : filteredLocations.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No locations found
                {allowCreateNew && (
                  <button
                    onClick={() => onCreateNew && onCreateNew({})}
                    className="block w-full mt-2 px-3 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Create New Location
                  </button>
                )}
              </div>
            ) : (
              filteredLocations.map(location => (
                <button
                  key={location.id}
                  onClick={() => handleLocationClick(location)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{location.name}</p>
                      {location.city && (
                        <p className="text-sm text-gray-500">{location.city}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold text-gray-900">Select Location</h3>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className={`px-3 py-1 rounded text-sm ${
              showMap ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {showMap ? 'List' : 'Map'}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {showMap ? (
          <div className="space-y-4">
            {/* Map Mode Toggle */}
            {allowCreateNew && (
              <div className="flex space-x-2">
                <button
                  onClick={() => setMapMode('select')}
                  className={`px-3 py-1 rounded text-sm ${
                    mapMode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Select Existing
                </button>
                <button
                  onClick={() => setMapMode('create')}
                  className={`px-3 py-1 rounded text-sm ${
                    mapMode === 'create' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
                  }`}
                >
                  Create New
                </button>
              </div>
            )}

            {/* Map */}
            <div className="h-96 rounded-lg overflow-hidden">
              <MapContainer
                center={getMapCenter()}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                
                {/* Existing locations */}
                {mapMode === 'select' && filteredLocations.map(location => (
                  <Marker
                    key={location.id}
                    position={[location.latitude, location.longitude]}
                    eventHandlers={{
                      click: () => handleLocationClick(location),
                    }}
                  />
                ))}
                
                {/* Location picker for creating new */}
                {mapMode === 'create' && (
                  <LocationPickerMarker onLocationSelect={handleMapLocationSelect} />
                )}
              </MapContainer>
            </div>
            
            {mapMode === 'create' && (
              <p className="text-sm text-gray-600 text-center">
                Click on the map to create a new location at that position
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {loading ? (
              <div className="text-center py-8 text-gray-500">Loading locations...</div>
            ) : filteredLocations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>No locations found</p>
                {allowCreateNew && (
                  <button
                    onClick={() => onCreateNew && onCreateNew({})}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center mx-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Create New Location
                  </button>
                )}
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {filteredLocations.map(location => (
                  <button
                    key={location.id}
                    onClick={() => handleLocationClick(location)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                      selectedLocation?.id === location.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium text-gray-900">{location.name}</h4>
                          {selectedLocation?.id === location.id && (
                            <Check className="w-4 h-4 text-blue-500" />
                          )}
                        </div>
                        {location.description && (
                          <p className="text-sm text-gray-600 mt-1">{location.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span className="px-2 py-1 bg-gray-100 rounded">{location.type}</span>
                          {location.city && <span>{location.city}</span>}
                          {location.category && <span>{location.category}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {allowCreateNew && (
              <div className="pt-4 border-t">
                <button
                  onClick={() => onCreateNew && onCreateNew({})}
                  className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create New Location
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default LocationPicker;
