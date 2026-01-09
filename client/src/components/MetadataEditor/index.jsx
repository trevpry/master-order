import React, { useState, useEffect } from 'react';
import { ChevronDown, Edit2, RefreshCw, Check, X } from 'lucide-react';

/**
 * MetadataEditor Component
 * 
 * Provides Roon-style metadata editing with three-tier source system
 * Supports field-level source selection and user overrides
 * 
 * Props:
 * - entityType: 'artist' | 'album' | 'track' | 'work'
 * - entityKey: ratingKey or ID
 * - field: field name to edit
 * - label: display label for the field
 * - currentValue: current resolved value
 * - onUpdate: callback when value changes
 */
const MetadataEditor = ({ 
  entityType, 
  entityKey, 
  field, 
  label, 
  currentValue,
  onUpdate 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [sources, setSources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [selectedSource, setSelectedSource] = useState(null);

  // Fetch available sources when opened
  useEffect(() => {
    if (isOpen && !sources) {
      fetchSources();
    }
  }, [isOpen]);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/metadata/${entityType}/${entityKey}/sources/${field}`
      );
      const data = await response.json();
      if (data.success) {
        setSources(data.data);
      }
    } catch (error) {
      console.error('Error fetching metadata sources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSourceChange = async (source) => {
    try {
      const response = await fetch(
        `/api/metadata/${entityType}/${entityKey}/preference`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, source })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        setSelectedSource(source);
        if (onUpdate) {
          onUpdate(sources[source]);
        }
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error setting preference:', error);
    }
  };

  const handleUserEdit = () => {
    setEditValue(currentValue || '');
    setIsEditing(true);
  };

  const saveUserEdit = async () => {
    try {
      const response = await fetch(
        `/api/metadata/${entityType}/${entityKey}/override`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ field, value: editValue })
        }
      );
      
      const data = await response.json();
      if (data.success) {
        if (onUpdate) {
          onUpdate(editValue);
        }
        setIsEditing(false);
        // Refresh sources to show new user override
        setSources(null);
      }
    } catch (error) {
      console.error('Error saving user override:', error);
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue('');
  };

  const clearUserOverride = async () => {
    try {
      const response = await fetch(
        `/api/metadata/${entityType}/${entityKey}/override/${field}`,
        { method: 'DELETE' }
      );
      
      const data = await response.json();
      if (data.success) {
        // Refresh sources
        setSources(null);
        fetchSources();
      }
    } catch (error) {
      console.error('Error clearing user override:', error);
    }
  };

  const getSourceLabel = (source) => {
    const labels = {
      user: 'Your Edit',
      musicbrainz: 'MusicBrainz',
      plex: 'File Tags'
    };
    return labels[source] || source;
  };

  const getSourceColor = (source) => {
    const colors = {
      user: 'text-purple-400',
      musicbrainz: 'text-blue-400',
      plex: 'text-gray-400'
    };
    return colors[source] || 'text-gray-400';
  };

  if (isEditing) {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {label}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600 focus:border-purple-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={saveUserEdit}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <Check size={16} />
            Save
          </button>
          <button
            onClick={cancelEdit}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        {label}
      </label>
      
      <div className="flex gap-2">
        <div className="flex-1 bg-gray-700 text-white px-3 py-2 rounded border border-gray-600">
          {currentValue || <span className="text-gray-500">Not set</span>}
        </div>
        
        <button
          onClick={handleUserEdit}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
          title="Edit this field"
        >
          <Edit2 size={16} />
        </button>
        
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
            title="Choose metadata source"
          >
            <ChevronDown size={16} className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-gray-800 border border-gray-600 rounded shadow-xl z-50">
              {loading ? (
                <div className="p-4 text-center text-gray-400">
                  <RefreshCw size={20} className="animate-spin mx-auto mb-2" />
                  Loading sources...
                </div>
              ) : sources ? (
                <div className="p-2">
                  <div className="text-xs text-gray-400 px-2 py-1 mb-2">
                    Choose metadata source:
                  </div>
                  
                  {Object.entries(sources).map(([source, value]) => (
                    <button
                      key={source}
                      onClick={() => handleSourceChange(source)}
                      disabled={!value}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors ${
                        !value ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${getSourceColor(source)}`}>
                          {getSourceLabel(source)}
                        </span>
                        {selectedSource === source && (
                          <Check size={14} className="text-green-400" />
                        )}
                      </div>
                      {value && (
                        <div className="text-xs text-gray-400 mt-1 truncate">
                          {value}
                        </div>
                      )}
                      {!value && (
                        <div className="text-xs text-gray-500 mt-1">
                          Not available
                        </div>
                      )}
                    </button>
                  ))}
                  
                  {sources.user && (
                    <>
                      <div className="border-t border-gray-600 my-2"></div>
                      <button
                        onClick={clearUserOverride}
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-700 transition-colors text-red-400 text-sm"
                      >
                        <X size={14} className="inline mr-2" />
                        Clear your edit
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MetadataEditor;
