import React, { useState } from 'react';
import { 
  MapPin, Star, Edit, Trash2, ExternalLink, FileText, Search, 
  Filter, SortAsc, Grid, List, Plus, Eye 
} from 'lucide-react';

const LocationList = ({
  locations = [],
  onLocationClick,
  onEditLocation,
  onDeleteLocation,
  onToggleFavorite,
  onAddLocation,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState('list');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const locationTypes = [
    { value: 'all', label: 'All Types' },
    { value: 'place', label: 'Place', icon: '📍' },
    { value: 'business', label: 'Business', icon: '🏢' },
    { value: 'travel', label: 'Travel', icon: '✈️' },
    { value: 'event', label: 'Event', icon: '📅' },
    { value: 'personal', label: 'Personal', icon: '🏠' },
    { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'hotel', label: 'Hotel', icon: '🏨' },
    { value: 'landmark', label: 'Landmark', icon: '🏛️' },
  ];

  const getUniqueCategories = () => {
    const categories = locations
      .map(loc => loc.category)
      .filter(Boolean)
      .filter((cat, index, arr) => arr.indexOf(cat) === index)
      .sort();
    return ['all', ...categories];
  };

  const getTypeIcon = (type) => {
    const typeObj = locationTypes.find(t => t.value === type);
    return typeObj?.icon || '📍';
  };

  const filteredAndSortedLocations = locations
    .filter(location => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          location.name.toLowerCase().includes(searchLower) ||
          location.description?.toLowerCase().includes(searchLower) ||
          location.address?.toLowerCase().includes(searchLower) ||
          location.city?.toLowerCase().includes(searchLower) ||
          location.category?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Type filter
      if (filterType !== 'all' && location.type !== filterType) {
        return false;
      }

      // Category filter
      if (filterCategory !== 'all' && location.category !== filterCategory) {
        return false;
      }

      // Favorites filter
      if (showFavoritesOnly && !location.isFavorite) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return a.type.localeCompare(b.type);
        case 'city':
          return (a.city || '').localeCompare(b.city || '');
        case 'rating':
          return (b.rating || 0) - (a.rating || 0);
        case 'created':
          return new Date(b.createdAt) - new Date(a.createdAt);
        default:
          return 0;
      }
    });

  const LocationCard = ({ location }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-lg">{getTypeIcon(location.type)}</span>
            <h3 className="font-semibold text-gray-900 text-lg">{location.name}</h3>
            {location.isFavorite && (
              <Star className="w-4 h-4 text-red-500 fill-current" />
            )}
          </div>
          
          {location.description && (
            <p className="text-sm text-gray-600 mb-2">{location.description}</p>
          )}
          
          <div className="flex flex-wrap gap-1 mb-2">
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
              {location.type}
            </span>
            {location.category && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {location.category}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex space-x-1">
          <button
            onClick={() => onToggleFavorite(location.id, !location.isFavorite)}
            className={`p-2 rounded ${
              location.isFavorite ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
            }`}
            title={location.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star className={`w-4 h-4 ${location.isFavorite ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>
      
      {location.address && (
        <div className="flex items-center text-sm text-gray-500 mb-2">
          <MapPin className="w-4 h-4 mr-1" />
          <span>{location.address}</span>
        </div>
      )}
      
      {location.city && (
        <p className="text-sm text-gray-500 mb-2">
          {location.city}
          {location.state && `, ${location.state}`}
          {location.country && `, ${location.country}`}
        </p>
      )}
      
      {location.rating && (
        <div className="flex items-center mb-2">
          <span className="text-yellow-400 text-sm">
            {'★'.repeat(Math.floor(location.rating))}
          </span>
          <span className="ml-1 text-sm text-gray-500">({location.rating})</span>
        </div>
      )}
      
      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
        <div className="flex space-x-2">
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
            onClick={() => onLocationClick && onLocationClick(location)}
            className="p-1 text-gray-500 hover:text-blue-500"
            title="View on map"
          >
            <Eye className="w-4 h-4" />
          </button>
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
  );

  const LocationRow = ({ location }) => (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center">
          <span className="text-lg mr-2">{getTypeIcon(location.type)}</span>
          <div>
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-900">{location.name}</span>
              {location.isFavorite && (
                <Star className="w-3 h-3 text-red-500 fill-current ml-1" />
              )}
            </div>
            {location.description && (
              <div className="text-sm text-gray-500">{location.description}</div>
            )}
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {location.type}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {location.category || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {location.city || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {location.rating ? (
          <div className="flex items-center">
            <span className="text-yellow-400">{'★'.repeat(Math.floor(location.rating))}</span>
            <span className="ml-1">({location.rating})</span>
          </div>
        ) : '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
        <div className="flex space-x-2">
          {location.note && (
            <button
              onClick={() => window.open(`/notes/${location.note.id}`, '_blank')}
              className="text-blue-600 hover:text-blue-900"
              title="View linked note"
            >
              <FileText className="w-4 h-4" />
            </button>
          )}
          {location.website && (
            <button
              onClick={() => window.open(location.website, '_blank')}
              className="text-green-600 hover:text-green-900"
              title="Visit website"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => onLocationClick && onLocationClick(location)}
            className="text-gray-600 hover:text-blue-600"
            title="View on map"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEditLocation(location)}
            className="text-gray-600 hover:text-blue-600"
            title="Edit"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDeleteLocation(location)}
            className="text-gray-600 hover:text-red-600"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Locations</h2>
        <button
          onClick={onAddLocation}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>Add Location</span>
        </button>
      </div>

      {/* Filters and Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {locationTypes.map(type => (
              <option key={type.value} value={type.value}>
                {type.icon ? `${type.icon} ` : ''}{type.label}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            {getUniqueCategories().slice(1).map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="type">Sort by Type</option>
            <option value="city">Sort by City</option>
            <option value="rating">Sort by Rating</option>
            <option value="created">Sort by Created</option>
          </select>

          {/* View Mode */}
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Additional Filters */}
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showFavoritesOnly}
              onChange={(e) => setShowFavoritesOnly(e.target.checked)}
              className="mr-2"
            />
            <Star className="w-4 h-4 mr-1 text-red-500" />
            Favorites Only
          </label>
          
          <div className="text-sm text-gray-500">
            Showing {filteredAndSortedLocations.length} of {locations.length} locations
          </div>
        </div>
      </div>

      {/* Content */}
      {filteredAndSortedLocations.length === 0 ? (
        <div className="text-center py-12">
          <MapPin className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No locations found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {locations.length === 0 
              ? "Get started by adding your first location."
              : "Try adjusting your search or filters."}
          </p>
          <div className="mt-6">
            <button
              onClick={onAddLocation}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Location
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedLocations.map(location => (
            <LocationCard key={location.id} location={location} />
          ))}
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  City
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedLocations.map(location => (
                <LocationRow key={location.id} location={location} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LocationList;
