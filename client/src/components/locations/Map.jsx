import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Star, Edit, Trash2, ExternalLink, FileText, Plus } from 'lucide-react';

// Fix for default markers in React-Leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icon for different location types
const createCustomIcon = (type, isFavorite = false) => {
  const color = isFavorite ? '#ff6b6b' : getTypeColor(type);
  
  return L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div style="
        background-color: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 12px;
      ">
        ${getTypeIcon(type)}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const getTypeColor = (type) => {
  const colors = {
    place: '#3b82f6',
    business: '#10b981',
    travel: '#f59e0b',
    event: '#8b5cf6',
    personal: '#ef4444',
    restaurant: '#f97316',
    hotel: '#06b6d4',
    landmark: '#84cc16',
  };
  return colors[type] || '#6b7280';
};

const getTypeIcon = (type) => {
  const icons = {
    place: '📍',
    business: '🏢',
    travel: '✈️',
    event: '📅',
    personal: '🏠',
    restaurant: '🍽️',
    hotel: '🏨',
    landmark: '🏛️',
  };
  return icons[type] || '📍';
};

const LocationMarker = ({ location, onLocationClick, onEditLocation, onDeleteLocation, onToggleFavorite }) => {
  const icon = createCustomIcon(location.type, location.isFavorite);

  return (
    <Marker
      position={[location.latitude, location.longitude]}
      icon={icon}
      eventHandlers={{
        click: () => onLocationClick && onLocationClick(location),
      }}
    >
      <Popup>
        <div className="max-w-xs">
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-semibold text-gray-900 flex-1">{location.name}</h3>
            <button
              onClick={() => onToggleFavorite(location.id, !location.isFavorite)}
              className={`ml-2 p-1 rounded ${
                location.isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
              }`}
            >
              <Star className={`w-4 h-4 ${location.isFavorite ? 'fill-current' : ''}`} />
            </button>
          </div>
          
          {location.description && (
            <p className="text-sm text-gray-600 mb-2">{location.description}</p>
          )}
          
          <div className="text-xs text-gray-500 mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full bg-gray-100 text-gray-800">
              {getTypeIcon(location.type)} {location.type}
            </span>
            {location.category && (
              <span className="ml-1 inline-flex items-center px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {location.category}
              </span>
            )}
          </div>
          
          {location.address && (
            <p className="text-xs text-gray-500 mb-2">{location.address}</p>
          )}
          
          {location.rating && (
            <div className="flex items-center mb-2">
              <span className="text-yellow-400">{'★'.repeat(Math.floor(location.rating))}</span>
              <span className="ml-1 text-xs text-gray-500">({location.rating})</span>
            </div>
          )}
          
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex space-x-1">
              {location.note && (
                <button
                  onClick={() => window.open(`/notes/${location.note.id}`, '_blank')}
                  className="p-1 text-blue-500 hover:text-blue-700"
                  title="View linked note"
                >
                  <FileText className="w-4 h-4" />
                </button>
              )}
              {location.website && (
                <button
                  onClick={() => window.open(location.website, '_blank')}
                  className="p-1 text-green-500 hover:text-green-700"
                  title="Visit website"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              )}
            </div>
            <div className="flex space-x-1">
              <button
                onClick={() => onEditLocation(location)}
                className="p-1 text-gray-500 hover:text-blue-500"
                title="Edit location"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDeleteLocation(location)}
                className="p-1 text-gray-500 hover:text-red-500"
                title="Delete location"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </Popup>
    </Marker>
  );
};

const AddLocationMarker = ({ onAddLocation }) => {
  const [position, setPosition] = useState(null);

  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position}>
      <Popup>
        <div className="text-center">
          <p className="mb-2 text-sm">Add new location here?</p>
          <button
            onClick={() => onAddLocation(position[0], position[1])}
            className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 flex items-center"
          >
            <Plus className="w-4 h-4 mr-1" />
            Add Location
          </button>
        </div>
      </Popup>
    </Marker>
  );
};

const MapController = ({ center, zoom, bounds }) => {
  const map = useMap();

  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds);
    } else if (center) {
      map.setView(center, zoom || 13);
    }
  }, [map, center, zoom, bounds]);

  return null;
};

const Map = ({
  locations = [],
  center = [40.7128, -74.0060], // Default to NYC
  zoom = 13,
  height = '400px',
  bounds = null,
  addLocationMode = false,
  onLocationClick,
  onEditLocation,
  onDeleteLocation,
  onToggleFavorite,
  onAddLocation,
  className = '',
}) => {
  const mapRef = useRef(null);

  // Calculate bounds to show all locations if bounds not provided and locations exist
  const calculateBounds = () => {
    if (bounds) return bounds;
    if (locations.length === 0) return null;
    
    const lats = locations.map(loc => loc.latitude);
    const lngs = locations.map(loc => loc.longitude);
    
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)]
    ];
  };

  const mapBounds = calculateBounds();

  return (
    <div className={`w-full ${className}`} style={{ height }}>
      <MapContainer
        ref={mapRef}
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        <MapController center={center} zoom={zoom} bounds={mapBounds} />
        
        {locations.map((location) => (
          <LocationMarker
            key={location.id}
            location={location}
            onLocationClick={onLocationClick}
            onEditLocation={onEditLocation}
            onDeleteLocation={onDeleteLocation}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
        
        {addLocationMode && onAddLocation && (
          <AddLocationMarker onAddLocation={onAddLocation} />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;
