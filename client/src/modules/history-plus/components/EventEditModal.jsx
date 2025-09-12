import React, { useState, useEffect } from 'react';
import './EventEditModal.css';

const EventEditModal = ({ 
  isOpen, 
  onClose, 
  event = null, 
  onEventUpdate,
  categories = []
}) => {
  const [formData, setFormData] = useState({
    title: '',
    startDate: '',
    endDate: '',
    category: '',
    details: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Initialize form data when modal opens or event changes
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        startDate: event.startDate || '',
        endDate: event.endDate || '',
        category: event.category || '',
        details: event.details || ''
      });
    } else {
      setFormData({
        title: '',
        startDate: '',
        endDate: '',
        category: categories[0] || '',
        details: ''
      });
    }
    setError('');
  }, [event, categories, isOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.title.trim()) {
        throw new Error('Title is required');
      }
      if (!formData.startDate) {
        throw new Error('Start date is required');
      }
      if (!formData.category) {
        throw new Error('Category is required');
      }

      // Make API call
      const url = event 
        ? `/api/history-plus/events/${event.id}`
        : '/api/history-plus/events';
      
      const method = event ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save event');
      }

      const result = await response.json();
      
      // Notify parent component
      if (onEventUpdate) {
        onEventUpdate(result.data || result);
      }

      // Close modal
      onClose();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${event.title}"? This action cannot be undone.`
    );
    
    if (!confirmDelete) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/history-plus/events/${event.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }

      // Notify parent component
      if (onEventUpdate) {
        onEventUpdate(null, 'deleted');
      }

      // Close modal
      onClose();
      
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="event-edit-modal-overlay" onClick={onClose}>
      <div className="event-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{event ? 'Edit Event' : 'Create New Event'}</h2>
          <button 
            className="close-button"
            onClick={onClose}
            disabled={isLoading}
          >
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
          {error && (
            <div className="error-message">
              ⚠️ {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Event Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="Enter event title..."
              required
              disabled={isLoading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="startDate">Start Date *</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={formData.startDate}
                onChange={handleInputChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="form-group">
              <label htmlFor="endDate">End Date</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={formData.endDate}
                onChange={handleInputChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="category">Category *</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              required
              disabled={isLoading}
            >
              <option value="">Select a category...</option>
              {categories.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="details">Description</label>
            <textarea
              id="details"
              name="details"
              value={formData.details}
              onChange={handleInputChange}
              placeholder="Enter event description..."
              rows={4}
              disabled={isLoading}
            />
          </div>

          <div className="modal-actions">
            <div className="left-actions">
              {event && (
                <button
                  type="button"
                  className="delete-button"
                  onClick={handleDelete}
                  disabled={isLoading}
                >
                  🗑️ Delete Event
                </button>
              )}
            </div>
            
            <div className="right-actions">
              <button
                type="button"
                className="cancel-button"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="save-button"
                disabled={isLoading}
              >
                {isLoading ? 'Saving...' : (event ? 'Update Event' : 'Create Event')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventEditModal;
