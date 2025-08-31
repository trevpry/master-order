import React from 'react';
import { MapPin, Users } from 'lucide-react';

const ConnectionsMap = ({ connections = [] }) => {
  // For now, just a placeholder since we'd need a real mapping service
  const getLocationCounts = () => {
    const locationCounts = {};
    connections.forEach(connection => {
      if (connection.location) {
        locationCounts[connection.location] = (locationCounts[connection.location] || 0) + 1;
      }
    });
    return locationCounts;
  };

  const locationCounts = getLocationCounts();
  const topLocations = Object.entries(locationCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-5 h-5" />
          Connection Locations
        </h3>
        <div className="text-sm text-gray-500">
          {connections.length} total connections
        </div>
      </div>

      {topLocations.length > 0 ? (
        <div className="space-y-3">
          {topLocations.map(([location, count], index) => (
            <div key={location} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  index === 0 ? 'bg-blue-500' :
                  index === 1 ? 'bg-green-500' :
                  index === 2 ? 'bg-orange-500' : 'bg-gray-400'
                }`} />
                <span className="font-medium text-gray-900">{location}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                {count} {count === 1 ? 'connection' : 'connections'}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>No location data available</p>
          <p className="text-sm">Add locations to your connections to see them mapped here</p>
        </div>
      )}

      {/* Placeholder for future map integration */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center text-gray-500 text-sm">
        <MapPin className="w-8 h-8 mx-auto mb-2 text-gray-300" />
        Interactive map coming soon
      </div>
    </div>
  );
};

export default ConnectionsMap;
