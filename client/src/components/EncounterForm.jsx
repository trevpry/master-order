import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, MapPin, Star, Clock, Shield, Heart } from 'lucide-react';
import { Button } from './ui/button';

const API_BASE = 'http://localhost:3001/api/dating';

const EncounterForm = ({ isOpen, onClose, onSave, encounter = null, userId = 1 }) => {
  const [formData, setFormData] = useState({
    guyName: '',
    connectionId: '',
    dateId: '',
    dateTime: '',
    location: '',
    type: 'HOOKUP',
    duration: '',
    satisfaction: '',
    performance: '',
    chemistry: '',
    notes: '',
    protection: false,
    tested: false,
    testDate: ''
  });
  const [connections, setConnections] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConnections();
      loadDates();
      if (encounter) {
        setFormData({
          guyName: encounter.guyName || '',
          connectionId: encounter.connectionId || '',
          dateId: encounter.dateId || '',
          dateTime: encounter.dateTime ? new Date(encounter.dateTime).toISOString().slice(0, 16) : '',
          location: encounter.location || '',
          type: encounter.type || 'HOOKUP',
          duration: encounter.duration || '',
          satisfaction: encounter.satisfaction || '',
          performance: encounter.performance || '',
          chemistry: encounter.chemistry || '',
          notes: encounter.notes || '',
          protection: encounter.protection || false,
          tested: encounter.tested || false,
          testDate: encounter.testDate ? new Date(encounter.testDate).toISOString().slice(0, 10) : ''
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
  }, [isOpen, encounter]);

  const loadConnections = async () => {
    try {
      const response = await fetch(`${API_BASE}/connections?userId=${userId}`);
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error('Error loading connections:', error);
    }
  };

  const loadDates = async () => {
    try {
      const response = await fetch(`${API_BASE}/dates?userId=${userId}`);
      const data = await response.json();
      setDates(data);
    } catch (error) {
      console.error('Error loading dates:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = encounter 
        ? `${API_BASE}/encounters/${encounter.id}`
        : `${API_BASE}/encounters`;
      
      const method = encounter ? 'PUT' : 'POST';
      const body = encounter 
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
        if (!encounter) {
          const now = new Date();
          setFormData({
            guyName: '',
            connectionId: '',
            dateId: '',
            dateTime: now.toISOString().slice(0, 16),
            location: '',
            type: 'HOOKUP',
            duration: '',
            satisfaction: '',
            performance: '',
            chemistry: '',
            notes: '',
            protection: false,
            tested: false,
            testDate: ''
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save encounter');
      }
    } catch (error) {
      console.error('Error saving encounter:', error);
      alert('Failed to save encounter');
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

  const handleDateChange = (e) => {
    const dateId = e.target.value;
    const date = dates.find(d => d.id === parseInt(dateId));
    
    setFormData(prev => ({
      ...prev,
      dateId,
      guyName: date ? date.guyName : prev.guyName,
      connectionId: date ? date.connectionId || '' : prev.connectionId
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
              star <= value ? 'text-pink-400' : 'text-gray-300'
            } hover:text-pink-400 transition-colors`}
          >
            <Heart className="w-full h-full fill-current" />
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
            <Heart className="w-5 h-5 inline mr-2 text-pink-600" />
            {encounter ? 'Edit Encounter' : 'Log New Encounter'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
            <div className="flex items-center text-pink-800 text-sm">
              <Shield className="w-4 h-4 mr-2" />
              <span className="font-medium">Privacy Notice:</span>
              <span className="ml-1">This information is stored locally and privately on your device.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Related Date (Optional)
              </label>
              <select
                name="dateId"
                value={formData.dateId}
                onChange={handleDateChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select a date</option>
                {dates.map(date => (
                  <option key={date.id} value={date.id}>
                    {date.guyName} - {new Date(date.dateTime).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </div>

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
                placeholder="Who was this with?"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Type *
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="HOOKUP">Hookup</option>
                <option value="FWB">Friends with Benefits</option>
                <option value="RELATIONSHIP">Relationship</option>
                <option value="ONE_TIME">One Time</option>
              </select>
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
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Where did this happen?"
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
                placeholder="How long did it last?"
              />
            </div>
          </div>

          {/* Rating Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-pink-50 rounded-lg">
            <StarRating
              name="satisfaction"
              value={parseInt(formData.satisfaction) || 0}
              onChange={handleInputChange}
              label="Satisfaction"
            />
            <StarRating
              name="performance"
              value={parseInt(formData.performance) || 0}
              onChange={handleInputChange}
              label="Performance"
            />
            <StarRating
              name="chemistry"
              value={parseInt(formData.chemistry) || 0}
              onChange={handleInputChange}
              label="Chemistry"
            />
          </div>

          {/* Safety Section */}
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 flex items-center">
              <Shield className="w-4 h-4 mr-2" />
              Health & Safety
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="protection"
                  checked={formData.protection}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Protection was used
                </label>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  name="tested"
                  checked={formData.tested}
                  onChange={handleInputChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-700">
                  Recently tested
                </label>
              </div>
            </div>

            {formData.tested && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Test Date
                </label>
                <input
                  type="date"
                  name="testDate"
                  value={formData.testDate}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
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
              placeholder="Any additional details or thoughts about this encounter..."
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
                  {encounter ? 'Update' : 'Save'} Encounter
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EncounterForm;
