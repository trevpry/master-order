import React, { useState, useEffect } from 'react';
import config from '../../config';
import toast from 'react-hot-toast';

/**
 * Modal for editing scene-specific performer metadata
 * Allows setting character names, roles, and other scene-specific details
 */
const ScenePerformerMetadataModal = ({ 
  isOpen, 
  onClose, 
  sceneId, 
  performer, 
  existingMetadata = {},
  onSave 
}) => {
  const [metadata, setMetadata] = useState({
    notes: '',
    tagIds: [],
    ...existingMetadata
  });
  const [isSaving, setIsSaving] = useState(false);
  const [bodyAttributeTags, setBodyAttributeTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [expandedTags, setExpandedTags] = useState(new Set());

  // Predefined role options
  const roleOptions = [
    'Lead',
    'Supporting',
    'Cameo',
    'Featured',
    'Background',
    'Special Appearance',
    'Guest'
  ];

  useEffect(() => {
    if (isOpen) {
      // Load existing metadata
      const existingTagIds = existingMetadata.tags?.map(t => t.tagId || t.tag?.id) || [];
      setMetadata({
        notes: existingMetadata.notes || '',
        tagIds: existingTagIds
      });

      // Load body attribute tags
      loadBodyAttributeTags();
    }
  }, [isOpen, existingMetadata]);

  const loadBodyAttributeTags = async () => {
    try {
      setLoadingTags(true);
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/body-attributes`);
      if (response.ok) {
        const data = await response.json();
        setBodyAttributeTags(data.data || []);
      }
    } catch (error) {
      console.error('Error loading body attribute tags:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleTag = (tagId) => {
    setMetadata(prev => ({
      ...prev,
      tagIds: prev.tagIds.includes(tagId)
        ? prev.tagIds.filter(id => id !== tagId)
        : [...prev.tagIds, tagId]
    }));
  };

  const toggleExpanded = (tagId) => {
    setExpandedTags(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  const renderTagNode = (tag, level = 0) => {
    const isSelected = metadata.tagIds.includes(tag.id);
    const hasChildren = tag.children && tag.children.length > 0;
    const isExpanded = expandedTags.has(tag.id);

    return (
      <div key={tag.id} style={{ marginLeft: `${level * 20}px` }}>
        <div className="flex items-center space-x-2 py-1">
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(tag.id)}
              className="w-4 h-4 flex items-center justify-center text-gray-400 hover:text-white"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <div className="w-4" />}
          
          <label className="flex items-center space-x-2 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTag(tag.id)}
              className="rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800"
            />
            <span className={`text-sm ${isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
              {tag.name}
            </span>
          </label>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {tag.children.map(child => renderTagNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const handleChange = (field, value) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!sceneId || !performer?.id) {
      toast.error('Missing scene or performer information');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers/${performer.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(metadata)
        }
      );

      if (!response.ok) {
        throw new Error('Failed to update performer metadata');
      }

      const result = await response.json();
      toast.success('Performer metadata updated successfully');
      
      if (onSave) {
        onSave(result.data);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving performer metadata:', error);
      toast.error('Failed to update performer metadata');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    setMetadata({
      notes: '',
      tagIds: []
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-800 border-b border-gray-700 p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">
                Edit Performer Metadata
              </h2>
              <p className="text-gray-400 text-sm">
                {performer?.name || 'Unknown Performer'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              disabled={isSaving}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Body Attribute Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Body Attributes
            </label>
            <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 max-h-64 overflow-y-auto">
              {loadingTags ? (
                <div className="text-center text-gray-400 py-4">
                  Loading tags...
                </div>
              ) : bodyAttributeTags.length === 0 ? (
                <div className="text-center text-gray-400 py-4">
                  No body attribute tags found. Make sure you have a "Body Attributes" parent tag in Stash.
                </div>
              ) : (
                <div>
                  {bodyAttributeTags.map(tag => renderTagNode(tag))}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Select body attribute tags that apply to this performer in this scene
            </p>
            {metadata.tagIds.length > 0 && (
              <p className="mt-1 text-xs text-blue-400">
                {metadata.tagIds.length} tag{metadata.tagIds.length !== 1 ? 's' : ''} selected
              </p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={metadata.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Additional notes about this performer in this scene..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              disabled={isSaving}
            />
            <p className="mt-1 text-xs text-gray-400">
              Any additional scene-specific notes
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-800 border-t border-gray-700 p-6 pt-4 flex justify-between">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isSaving}
          >
            Clear All
          </button>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScenePerformerMetadataModal;
