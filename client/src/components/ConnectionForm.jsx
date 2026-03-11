import React, { useState, useEffect } from 'react';
import { X, Save, Camera, MapPin, Heart, Star } from 'lucide-react';
import { Button } from './ui/button';
import config from '../config';

const API_BASE = `${config.apiBaseUrl}/api/dating`;

const ConnectionForm = ({ isOpen, onClose, onSave, connection = null, userId = 1 }) => {
  const [formData, setFormData] = useState({
    guyName: '',
    appId: '',
    age: '',
    phoneNumber: '',
    location: '',
    profileUrl: '',
    bio: '',
    notes: '',
    status: 'ACTIVE',
    // Extended fields for comprehensive data storage
    height: '',
    weight: '',
    bodyType: '',
    ethnicity: '',
    hair: '',
    bodyHair: '',
    tribe: '',
    position: '',
    hivStatus: '',
    lastTested: '',
    lookingFor: '',
    relationshipStatus: '',
    sexPractices: '',
    verification: '',
    travelMode: false,
    privatePhotos: 0,
    woofCount: 0,
    viewCount: 0,
    interests: '',
    theyAre: '',
    theyAreInto: '',
    pronouns: '',
    genderIdentity: '',
    openTo: '',
    sexualHealth: '',
    distance: ''
  });
  const [datingApps, setDatingApps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showJsonImport, setShowJsonImport] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadDatingApps();
      if (connection) {
        setFormData({
          guyName: connection.guyName || '',
          appId: connection.appId || '',
          age: connection.age || '',
          phoneNumber: connection.phoneNumber || '',
          location: connection.location || '',
          profileUrl: connection.profileUrl || '',
          bio: connection.bio || '',
          notes: connection.notes || '',
          status: connection.status || 'ACTIVE',
          // Extended fields
          height: connection.height || '',
          weight: connection.weight || '',
          bodyType: connection.bodyType || '',
          ethnicity: connection.ethnicity || '',
          hair: connection.hair || '',
          bodyHair: connection.bodyHair || '',
          tribe: connection.tribe || '',
          position: connection.position || '',
          hivStatus: connection.hivStatus || '',
          lastTested: connection.lastTested || '',
          lookingFor: connection.lookingFor || '',
          relationshipStatus: connection.relationshipStatus || '',
          sexPractices: connection.sexPractices || '',
          verification: connection.verification || '',
          travelMode: connection.travelMode || false,
          privatePhotos: connection.privatePhotos || 0,
          woofCount: connection.woofCount || 0,
          viewCount: connection.viewCount || 0,
          interests: connection.interests || '',
          theyAre: connection.theyAre || '',
          theyAreInto: connection.theyAreInto || '',
          pronouns: connection.pronouns || '',
          genderIdentity: connection.genderIdentity || '',
          openTo: connection.openTo || '',
          sexualHealth: connection.sexualHealth || '',
          distance: connection.distance || ''
        });
      }
    }
  }, [isOpen, connection]);

  const loadDatingApps = async () => {
    try {
      const response = await fetch(`${API_BASE}/apps`);
      const data = await response.json();
      setDatingApps(data);
    } catch (error) {
      console.error('Error loading dating apps:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = connection 
        ? `${API_BASE}/connections/${connection.id}`
        : `${API_BASE}/connections`;
      
      const method = connection ? 'PUT' : 'POST';
      const body = connection 
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
        if (!connection) {
          setFormData({
            guyName: '',
            appId: '',
            age: '',
            phoneNumber: '',
            location: '',
            profileUrl: '',
            bio: '',
            notes: '',
            status: 'ACTIVE',
            height: '',
            weight: '',
            bodyType: '',
            ethnicity: '',
            hair: '',
            bodyHair: '',
            tribe: '',
            position: '',
            hivStatus: '',
            lastTested: '',
            lookingFor: '',
            relationshipStatus: '',
            sexPractices: '',
            verification: '',
            travelMode: false,
            privatePhotos: 0,
            woofCount: 0,
            viewCount: 0,
            interests: '',
            theyAre: '',
            theyAreInto: '',
            pronouns: '',
            genderIdentity: '',
            openTo: '',
            sexualHealth: '',
            distance: ''
          });
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to save connection');
      }
    } catch (error) {
      console.error('Error saving connection:', error);
      alert('Failed to save connection');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const mapJsonToFormData = (jsonData) => {
    // Construct bio from available data first
    const constructedBio = [
      jsonData.looking_for && Array.isArray(jsonData.looking_for) ? `Looking for: ${jsonData.looking_for.join(', ')}` : '',
      jsonData.interests && Array.isArray(jsonData.interests) ? `Interests: ${jsonData.interests.join(', ')}` : '',
      jsonData.hashtags && Array.isArray(jsonData.hashtags) ? jsonData.hashtags.join(' ') : ''
    ].filter(Boolean).join('\n\n') || '';

    const mapped = {
      guyName: jsonData.name || '',
      age: jsonData.age || '',
      location: '', // Will be derived from other fields if needed
      profileUrl: '',
      bio: constructedBio,
      notes: '',
      status: 'ACTIVE',
      // Extended fields for database
      height: jsonData.height || '',
      weight: jsonData.weight || '',
      hair: jsonData.hair || '',
      ethnicity: jsonData.race || '',
      relationshipStatus: jsonData.relationship_status || '',
      position: jsonData.position || '',
      lookingFor: Array.isArray(jsonData.looking_for) ? jsonData.looking_for.join(', ') : (jsonData.looking_for || ''),
      openTo: Array.isArray(jsonData.open_to) ? JSON.stringify(jsonData.open_to) : '',
      interests: Array.isArray(jsonData.interests) ? JSON.stringify(jsonData.interests) : '',
      theyAreInto: Array.isArray(jsonData.they_are_into) ? JSON.stringify(jsonData.they_are_into) : '',
      theyAre: Array.isArray(jsonData.they_are) ? JSON.stringify(jsonData.they_are) : '',
      pronouns: jsonData.pronouns || '',
      sexualHealth: jsonData.sexual_health ? JSON.stringify(jsonData.sexual_health) : '',
      sexPractices: jsonData.safe_sex_practices || '',
      distance: jsonData.distance || ''
    };

    // Handle online status for notes
    if (jsonData.online_status) {
      mapped.notes = `Online Status: ${jsonData.online_status}`;
    }

    return mapped;
  };

  const handleJsonImport = () => {
    try {
      const parsedJson = JSON.parse(jsonInput);
      const mappedData = mapJsonToFormData(parsedJson);
      setFormData(prev => ({ ...prev, ...mappedData }));
      setShowJsonImport(false);
      setJsonInput('');
    } catch (error) {
      alert('Invalid JSON format. Please check your input and try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {connection ? 'Edit Connection' : 'Add New Connection'}
          </h2>
          <div className="flex items-center gap-3">
            {!connection && (
              <button
                type="button"
                onClick={() => setShowJsonImport(true)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Import JSON
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                placeholder="Enter his name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Dating App *
              </label>
              <select
                name="appId"
                value={formData.appId}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="">Select an app</option>
                {datingApps.map(app => (
                  <option key={app.id} value={app.id}>{app.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Age
              </label>
              <input
                type="number"
                name="age"
                value={formData.age}
                onChange={handleInputChange}
                min="18"
                max="100"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Age"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="BLOCKED">Blocked</option>
                <option value="UNMATCHED">Unmatched</option>
                <option value="MET">Met in Person</option>
                <option value="RELATIONSHIP">In Relationship</option>
              </select>
            </div>
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
              placeholder="City, State or Distance"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Profile URL
            </label>
            <input
              type="url"
              name="profileUrl"
              value={formData.profileUrl}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Link to his profile"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio/Description
            </label>
            <textarea
              name="bio"
              value={formData.bio}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="What's he like? What did his profile say?"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              placeholder="Any additional notes about this connection..."
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
                  {connection ? 'Update' : 'Save'} Connection
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* JSON Import Modal */}
      {showJsonImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Import Connection from JSON</h3>
              <button
                onClick={() => setShowJsonImport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  Paste your JSON data below. Supported format includes fields like name, age, height, weight, 
                  looking_for, interests, etc.
                </p>
                <textarea
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  placeholder={'{"name": "John", "age": 29, "height": "5\' 10\\"", ...}'}
                  className="w-full h-64 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowJsonImport(false)}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleJsonImport}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Import Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConnectionForm;
