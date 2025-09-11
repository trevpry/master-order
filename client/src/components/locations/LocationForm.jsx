import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Globe, Phone, FileText, X, Check, Loader } from 'lucide-react';
import locationService from '../../services/locationService';

const LocationForm = ({
  location = null,
  onSave,
  onCancel,
  initialCoordinates = null,
  availableNotes = [],
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'place',
    latitude: '',
    longitude: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    category: '',
    rating: '',
    tags: [],
    website: '',
    phone: '',
    notes: '',
    isPrivate: false,
    isFavorite: false,
    noteId: null,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentTag, setCurrentTag] = useState('');

  const locationTypes = [
    { value: 'place', label: 'Place', icon: '📍' },
    { value: 'business', label: 'Business', icon: '🏢' },
    { value: 'travel', label: 'Travel', icon: '✈️' },
    { value: 'event', label: 'Event', icon: '📅' },
    { value: 'personal', label: 'Personal', icon: '🏠' },
    { value: 'restaurant', label: 'Restaurant', icon: '🍽️' },
    { value: 'hotel', label: 'Hotel', icon: '🏨' },
    { value: 'landmark', label: 'Landmark', icon: '🏛️' },
  ];

  const categories = [
    'Restaurant', 'Bar', 'Coffee Shop', 'Shopping', 'Gas Station',
    'Hospital', 'School', 'Park', 'Museum', 'Theater', 'Hotel',
    'Airport', 'Train Station', 'Beach', 'Mountain', 'Historic Site',
    'Office', 'Home', 'Friend', 'Family', 'Other'
  ];

  useEffect(() => {
    if (location) {
      setFormData({
        ...location,
        tags: typeof location.tags === 'string' ? JSON.parse(location.tags || '[]') : location.tags || [],
        rating: location.rating?.toString() || '',
        latitude: location.latitude?.toString() || '',
        longitude: location.longitude?.toString() || '',
      });
    } else if (initialCoordinates) {
      setFormData(prev => ({
        ...prev,
        latitude: initialCoordinates.lat?.toString() || '',
        longitude: initialCoordinates.lng?.toString() || '',
      }));
      
      // Try to reverse geocode the coordinates
      if (initialCoordinates.lat && initialCoordinates.lng) {
        handleReverseGeocode(initialCoordinates.lat, initialCoordinates.lng);
      }
    }
  }, [location, initialCoordinates]);

  const handleReverseGeocode = async (lat, lng) => {
    try {
      const result = await locationService.reverseGeocode(lat, lng);
      if (result.address) {
        setFormData(prev => ({
          ...prev,
          address: result.display_name || prev.address,
          city: result.address.city || prev.city,
          state: result.address.state || prev.state,
          country: result.address.country || prev.country,
          postalCode: result.address.postalCode || prev.postalCode,
        }));
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await locationService.geocodeAddress(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    setFormData(prev => ({
      ...prev,
      name: prev.name || result.display_name.split(',')[0],
      latitude: result.latitude.toString(),
      longitude: result.longitude.toString(),
      address: result.display_name,
      city: result.address.city || '',
      state: result.address.state || '',
      country: result.address.country || '',
      postalCode: result.address.postalCode || '',
    }));
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleTagAdd = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const handleTagRemove = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim() || !formData.latitude || !formData.longitude) {
      alert('Please provide at least a name and coordinates');
      return;
    }

    const submitData = {
      ...formData,
      latitude: parseFloat(formData.latitude),
      longitude: parseFloat(formData.longitude),
      rating: formData.rating ? parseFloat(formData.rating) : null,
      tags: formData.tags,
      noteId: formData.noteId || null,
    };

    await onSave(submitData);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          {location ? 'Edit Location' : 'Add New Location'}
        </h2>
        <button
          onClick={onCancel}
          className="p-2 text-gray-500 hover:text-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Address Search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search for Location
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for an address..."
              className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleSearch())}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center"
            >
              {isSearching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded max-h-48 overflow-y-auto">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectSearchResult(result)}
                  className="w-full text-left p-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                >
                  <div className="text-sm font-medium text-gray-900">
                    {result.display_name.split(',')[0]}
                  </div>
                  <div className="text-xs text-gray-500">
                    {result.display_name}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {locationTypes.map(type => (
                <option key={type.value} value={type.value}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Coordinates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Latitude *
            </label>
            <input
              type="number"
              step="any"
              required
              value={formData.latitude}
              onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Longitude *
            </label>
            <input
              type="number"
              step="any"
              required
              value={formData.longitude}
              onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Address Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              City
            </label>
            <input
              type="text"
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              State/Province
            </label>
            <input
              type="text"
              value={formData.state}
              onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <input
              type="text"
              value={formData.country}
              onChange={(e) => setFormData(prev => ({ ...prev, country: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Postal Code
            </label>
            <input
              type="text"
              value={formData.postalCode}
              onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Category and Rating */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select category...</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rating (1-5)
            </label>
            <input
              type="number"
              min="1"
              max="5"
              step="0.1"
              value={formData.rating}
              onChange={(e) => setFormData(prev => ({ ...prev, rating: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Website
            </label>
            <input
              type="url"
              value={formData.website}
              onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tags
          </label>
          <div className="flex space-x-2 mb-2">
            <input
              type="text"
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              placeholder="Add a tag..."
              className="flex-1 p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleTagAdd())}
            />
            <button
              type="button"
              onClick={handleTagAdd}
              className="px-3 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Add
            </button>
          </div>
          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleTagRemove(tag)}
                    className="ml-1 text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Note Connection */}
        {availableNotes.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Connect to Note
            </label>
            <select
              value={formData.noteId || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, noteId: e.target.value || null }))}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">No note connection</option>
              {availableNotes.map(note => (
                <option key={note.id} value={note.id}>{note.title}</option>
              ))}
            </select>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notes
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Options */}
        <div className="flex space-x-6">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isFavorite}
              onChange={(e) => setFormData(prev => ({ ...prev, isFavorite: e.target.checked }))}
              className="mr-2"
            />
            <Star className={`w-4 h-4 mr-1 ${formData.isFavorite ? 'text-red-500' : 'text-gray-400'}`} />
            Favorite
          </label>
          
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.isPrivate}
              onChange={(e) => setFormData(prev => ({ ...prev, isPrivate: e.target.checked }))}
              className="mr-2"
            />
            Private
          </label>
        </div>

        {/* Submit Buttons */}
        <div className="flex justify-end space-x-3 pt-4 border-t">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
          >
            <Check className="w-4 h-4 mr-1" />
            {location ? 'Update' : 'Create'} Location
          </button>
        </div>
      </form>
    </div>
  );
};

export default LocationForm;
