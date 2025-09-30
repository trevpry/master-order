import React, { useState, useEffect } from 'react';
import { historyPlusApi } from '../services/historyPlusApi';

const EventForm = ({ event, categories, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    title: '',
    details: '',
    category: '',
    startDate: '',
    endDate: '',
    reviewed: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Debug: Log formData whenever it changes
  useEffect(() => {
    console.log('Form data updated:', formData);
  }, [formData]);

  // Helper function to check if a date is BCE (negative year)
  const isBCEDate = (dateString) => {
    return dateString && dateString.startsWith('-');
  };

  // Helper function to convert date to YYYY-MM-DD format for HTML date inputs
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    
    try {
      // Handle various date formats
      let date;
      
      // Check if it's a BCE date (starts with -)
      if (dateString.startsWith('-')) {
        return dateString; // Keep BCE dates as-is for text input
      }
      
      // Check if it's already in YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return dateString;
      }
      
      // Try to parse as regular date and convert to YYYY-MM-DD
      date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
      
      // If all else fails, return as-is
      return dateString;
    } catch (error) {
      console.warn('Error formatting date:', dateString, error);
      return dateString;
    }
  };

  // Initialize form data when event changes
  useEffect(() => {
    if (event) {
      console.log('Populating form with event data:', event);
      console.log('Event category:', event.category);
      console.log('Available categories:', categories.map(c => c.name));
      
      const formattedStartDate = formatDateForInput(event.startDate);
      const formattedEndDate = formatDateForInput(event.endDate);
      
      setFormData({
        title: event.title || '',
        details: event.details || '',
        category: event.category || '',
        startDate: formattedStartDate || '',
        endDate: formattedEndDate || '',
        reviewed: event.reviewed || false
      });
    } else {
      setFormData({
        title: '',
        details: '',
        category: '',
        startDate: '',
        endDate: '',
        reviewed: false
      });
    }
  }, [event, categories]); // Added categories as dependency

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    if (!formData.startDate) {
      setError('Start date is required');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (event) {
        // Update existing event
        await historyPlusApi.updateEvent(event.id, formData);
      } else {
        // Create new event
        await historyPlusApi.createEvent(formData);
      }
      
      onSave();
    } catch (err) {
      console.error('Error saving event:', err);
      setError(err.response?.data?.error || 'Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {event ? 'Edit Event' : 'Create New Event'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Title */}
          <div className="mb-6">
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter event title"
            />
          </div>

          {/* Details */}
          <div className="mb-6">
            <label htmlFor="details" className="block text-sm font-medium text-gray-700 mb-2">
              Details
            </label>
            <textarea
              id="details"
              name="details"
              value={formData.details}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter event details (optional)"
            />
          </div>

          {/* Category */}
          <div className="mb-6">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a category</option>
              {/* Show current category if it's not in the standard list */}
              {formData.category && !categories.some(cat => cat.name === formData.category) && (
                <option value={formData.category}>
                  {formData.category} (current)
                </option>
              )}
              {categories.map((category) => (
                <option key={category.id} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type={isBCEDate(formData.startDate) ? "text" : "date"}
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isBCEDate(formData.startDate) ? "e.g., -4200000-01-01 for 4,200,000 BCE" : ""}
              />
              <p className="text-xs text-gray-500 mt-1">
                For BCE dates, use negative years (e.g., -4200000-01-01 for 4,200,000 BCE)
              </p>
            </div>

            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type={isBCEDate(formData.endDate) ? "text" : "date"}
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder={isBCEDate(formData.endDate) ? "e.g., -2287-01-01 for 2287 BCE" : "Leave empty for single-day events"}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave empty for single-day events
              </p>
            </div>
          </div>

          {/* Reviewed Status */}
          <div className="mb-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                name="reviewed"
                checked={formData.reviewed}
                onChange={handleInputChange}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Mark as reviewed</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : (event ? 'Update Event' : 'Create Event')}
            </button>
            
            <button
              type="button"
              onClick={onCancel}
              className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2 rounded font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;
