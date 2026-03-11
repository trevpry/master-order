import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, MapPin, Star, DollarSign, Clock } from 'lucide-react';
import { Button } from './ui/button';
import config from '../config';

const API_BASE = `${config.apiBaseUrl}/api/dating`;

const DateForm = ({ isOpen, onClose, onSave, date = null, userId = 1 }) => {
  const [formData, setFormData] = useState({
    guyName: '',
    connectionId: '',
    dateTime: '',
    location: '',
    activity: '',
    duration: '',
    cost: '',
    rating: '',
    chemistry: '',
    conversation: '',
    attraction: '',
    notes: '',
    outcome: 'NEUTRAL',
    secondDate: false
  });
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      if (date) {
        setFormData({
          guyName: date.guyName || '',
          connectionId: date.connectionId || '',
          dateTime: date.dateTime ? new Date(date.dateTime).toISOString().slice(0, 16) : '',
          location: date.location || '',
          activity: date.activity || '',
          duration: date.duration || '',
          cost: date.cost || '',
          rating: date.rating || '',
          chemistry: date.chemistry || '',
          conversation: date.conversation || '',
          attraction: date.attraction || '',
          notes: date.notes || '',
          outcome: date.outcome || 'NEUTRAL',
          secondDate: date.secondDate || false
        });
      } else {
        // Set default date/time to now
        const now = new Date();
        setFormData(prev => ({
          ...prev,
          dateTime: now.toISOString().slice(0, 16)
        }));
      }
    }
  }, [isOpen, date]);

  const loadConnections = async () => {
    try {
      const response = await fetch(`${API_BASE}/connections?userId=${userId}`);
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = date 
        ? `${API_BASE}/dates/${date.id}`
        : `${API_BASE}/dates`;
      
      const method = date ? 'PUT' : 'POST';
      const body = date 
        ? formData 
        : { ...formData, userId };

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        onSave(data);
        onClose();
        
        // Reset form if creating new
        if (!date) {
          const now = new Date();
          setFormData({
            guyName: '',
            connectionId: '',
            dateTime: now.toISOString().slice(0, 16),
            location: '',
            activity: '',
            duration: '',
            cost: '',
            rating: '',
            chemistry: '',
            conversation: '',
            attraction: '',
            notes: '',
            outcome: 'NEUTRAL',
            secondDate: false
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save date');
      }
    } catch (error) {
      console.error('Error saving date:', error);
      alert('Failed to save date');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleConnectionChange = (e) => {
    const connectionId = e.target.value;
    const connection = connections.find(c => c.id === parseInt(connectionId));
    
    setFormData(prev => ({
      ...prev,
      connectionId,
      guyName: connection ? connection.guyName : prev.guyName
    }));
  };

  const StarRating = ({ name, value, onChange, label }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange({ target: { name, value: star } })}
            className={`w-8 h-8 ${
              star <= value ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400 transition-colors`}
          >
            <Star className="w-full h-full fill-current" />
          </button>
        ))}
        {value > 0 && (
          <button
            type="button"
            onClick={() => onChange({ target: { name, value: '' } })}
            className="ml-2 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {date ? 'Edit Date' : 'Log New Date'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection (Optional)
              </label>
              <select
                name="connectionId"
                value={formData.connectionId}
                onChange={handleConnectionChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select a connection</option>
                {connections.map(conn => (
                  <option key={conn.id} value={conn.id}>
                    {conn.guyName} ({conn.app.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Guy's Name *
              </label>
              <input
                type="text"
                name="guyName"
                value={formData.guyName}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Who did you go out with?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date & Time *
              </label>
              <input
                type="datetime-local"
                name="dateTime"
                value={formData.dateTime}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="w-4 h-4 inline mr-1" />
                Location *
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Where did you go?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity *
              </label>
              <input
                type="text"
                name="activity"
                value={formData.activity}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="What did you do? (dinner, coffee, etc.)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="w-4 h-4 inline mr-1" />
                Duration (minutes)
              </label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleInputChange}
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="How long was the date?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <DollarSign className="w-4 h-4 inline mr-1" />
                Cost
              </label>
              <input
                type="number"
                name="cost"
                value={formData.cost}
                onChange={handleInputChange}
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="How much did you spend?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Outcome
              </label>
              <select
                name="outcome"
                value={formData.outcome}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="GREAT">Great</option>
                <option value="GOOD">Good</option>
                <option value="NEUTRAL">Neutral</option>
                <option value="POOR">Poor</option>
                <option value="TERRIBLE">Terrible</option>
              </select>
            </div>
          </div>

          {/* Rating Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 p-4 bg-gray-50 rounded-lg">
            <StarRating
              name="rating"
              value={parseInt(formData.rating) || 0}
              onChange={handleInputChange}
              label="Overall Rating"
            />
            <StarRating
              name="chemistry"
              value={parseInt(formData.chemistry) || 0}
              onChange={handleInputChange}
              label="Chemistry"
            />
            <StarRating
              name="conversation"
              value={parseInt(formData.conversation) || 0}
              onChange={handleInputChange}
              label="Conversation"
            />
            <StarRating
              name="attraction"
              value={parseInt(formData.attraction) || 0}
              onChange={handleInputChange}
              label="Attraction"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="secondDate"
              checked={formData.secondDate}
              onChange={handleInputChange}
              className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700">
              Would you go on a second date?
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="How did it go? What happened? Any memorable moments?"
            />
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {date ? 'Update' : 'Save'} Date
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DateForm;
