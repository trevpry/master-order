/**
 * StashPerformerTagSelector Component
 * Modal for adding tags to a performer/scene or performer/clip pivot
 * Shows expandable/collapsible tag hierarchy
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import config from '../../config';

const StashPerformerTagSelector = ({ performerId, clipId, sceneId, onClose, onTagsAdded }) => {
  const [allTags, setAllTags] = useState([]);
  const [tagHierarchy, setTagHierarchy] = useState([]);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState([]);
  const [existingTags, setExistingTags] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  const contextType = clipId ? 'clip' : sceneId ? 'scene' : null;

  // Build tag hierarchy from flat tag list
  const buildTagHierarchy = (tags) => {
    const tagMap = new Map();
    const rootTags = [];
    
    // First pass: create map of all tags with empty children arrays
    tags.forEach(tag => {
      tagMap.set(tag.id, { ...tag, children: [] });
    });
    
    // Second pass: build hierarchy
    tags.forEach(tag => {
      const tagNode = tagMap.get(tag.id);
      
      // Check if tag has parents
      const parentsList = tag.parents || tag.parentTags || [];
      
      if (parentsList.length > 0) {
        // Has parent(s), add to parent's children
        parentsList.forEach(parentRef => {
          const parentId = parentRef.id || parentRef.parentTagId || parentRef.parentTag?.id;
          const parent = tagMap.get(parentId);
          if (parent && !parent.children.find(c => c.id === tag.id)) {
            parent.children.push(tagNode);
          }
        });
      } else {
        // No parent, it's a root tag
        rootTags.push(tagNode);
      }
    });
    
    return { rootTags, tagMap };
  };

  // Fetch all tags and existing performer-context tags on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all tags from the database
        const tagsResponse = await fetch(`${config.apiBaseUrl}/api/stash/tags?rootOnly=false&perPage=10000`);
        
        if (!tagsResponse.ok) {
          throw new Error(`Failed to fetch tags: ${tagsResponse.status}`);
        }
        
        const tagsData = await tagsResponse.json();
        const fetchedTags = tagsData.data || tagsData.tags || [];
        console.log(`Fetched ${fetchedTags.length} tags from database`);
        
        // Filter out tags that are excluded from clip tagging (if context is clip)
        const availableTags = clipId 
          ? fetchedTags.filter(tag => tag.includeInClipTagging !== false)
          : fetchedTags;
        if (clipId) {
          console.log(`${availableTags.length} tags available for clip tagging`);
        }
        
        setAllTags(availableTags);
        
        // Build hierarchical structure
        const { rootTags } = buildTagHierarchy(availableTags);
        console.log(`Built hierarchy with ${rootTags.length} root tags`);
        setTagHierarchy(rootTags);
        
        // Fetch existing tags on this performer-clip/scene combination
        let existingTagIds = new Set();
        
        if (clipId) {
          // Fetch clip-performer tags
          const response = await fetch(`${config.apiBaseUrl}/api/android/stash/clip/${clipId}/performer/${performerId}/tags`);
          if (response.ok) {
            const data = await response.json();
            existingTagIds = new Set(data.tags?.map(t => t.id) || []);
            console.log(`Clip-performer has ${existingTagIds.size} existing tags`);
          }
        } else if (sceneId) {
          // Fetch scene-performer tags
          const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers/${performerId}`);
          if (response.ok) {
            const data = await response.json();
            existingTagIds = new Set(data.tags?.map(t => typeof t === 'object' ? t.tagId || t.id : t) || []);
            console.log(`Scene-performer has ${existingTagIds.size} existing tags`);
          }
        }
        
        setExistingTags(existingTagIds);
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [performerId, clipId, sceneId]);

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

  const toggleTag = (tagId) => {
    // Don't allow selecting tags already on the performer-context
    if (existingTags.has(tagId)) {
      toast.error(`Tag already exists on this performer in this ${contextType}`);
      return;
    }
    
    setSelectedTags(prev => 
      prev.includes(tagId)
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const handleApplyTags = async () => {
    if (selectedTags.length === 0) {
      toast.error('Please select at least one tag');
      return;
    }

    try {
      setApplying(true);
      
      if (clipId) {
        // Add tags to clip-performer
        const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/performer/${performerId}/tags`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagIds: selectedTags })
        });

        if (!response.ok) {
          throw new Error('Failed to add tags to clip-performer');
        }
      } else if (sceneId) {
        // Add tags to scene-performer (need to merge with existing)
        // First get current tags
        const getCurrentResponse = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers/${performerId}`);
        if (!getCurrentResponse.ok) {
          throw new Error('Failed to fetch current tags');
        }
        
        const currentData = await getCurrentResponse.json();
        console.log('Current scene-performer data:', currentData);
        
        // Extract current tag IDs from the response
        const currentTagIds = currentData.data?.tags?.map(tagWrapper => {
          const tag = tagWrapper.tag || tagWrapper;
          return tag.id;
        }) || [];
        
        console.log('Current tag IDs:', currentTagIds);
        console.log('Selected new tag IDs:', selectedTags);
        
        // Merge with new tags
        const allTagIds = [...new Set([...currentTagIds, ...selectedTags])];
        console.log('Merged tag IDs:', allTagIds);
        
        // Update with merged tags - send as tagIds array
        const updateResponse = await fetch(`${config.apiBaseUrl}/api/stash/scenes/${sceneId}/performers/${performerId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagIds: allTagIds
          })
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error('Update failed:', errorText);
          throw new Error('Failed to update scene-performer tags');
        }
        
        const updateData = await updateResponse.json();
        console.log('Update response:', updateData);
      }

      const selectedTagNames = allTags
        .filter(tag => selectedTags.includes(tag.id))
        .map(tag => tag.name)
        .join(', ');
      
      toast.success(`✅ Added ${selectedTags.length} tag(s) to performer in this ${contextType}: ${selectedTagNames}`);
      
      // Notify parent to refresh tags
      if (onTagsAdded) {
        onTagsAdded([...selectedTags]);
      }
      
      onClose();
    } catch (error) {
      console.error('Error applying tags:', error);
      toast.error(`Failed to add tags: ${error.message}`);
    } finally {
      setApplying(false);
    }
  };

  const renderTag = (tag, level = 0) => {
    const hasChildren = tag.children && tag.children.length > 0;
    const isExpanded = expandedTags.has(tag.id);
    const isSelected = selectedTags.includes(tag.id);
    const alreadyExists = existingTags.has(tag.id);
    
    return (
      <div key={tag.id} style={{ marginLeft: `${level * 20}px` }}>
        <div className="flex items-center gap-2 py-1 hover:bg-gray-700 rounded px-2">
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(tag.id)}
              className="text-gray-400 hover:text-white transition-colors w-5 h-5 flex items-center justify-center flex-shrink-0"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <div className="w-5" />
          )}
          
          {/* Tag checkbox and name */}
          <label className="flex items-center gap-2 flex-grow cursor-pointer">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleTag(tag.id)}
              disabled={alreadyExists}
              className="w-4 h-4 rounded border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className={`text-sm ${alreadyExists ? 'text-green-400 line-through' : isSelected ? 'text-white font-medium' : 'text-gray-300'}`}>
              {tag.name}
              {alreadyExists && <span className="text-xs ml-2">(Already added)</span>}
            </span>
          </label>
        </div>
        
        {/* Render children if expanded */}
        {hasChildren && isExpanded && (
          <div>
            {tag.children.map(child => renderTag(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-xl font-semibold text-white">
            Add Tags to Performer in {contextType === 'clip' ? 'Clip' : 'Scene'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-gray-400">Loading tags...</div>
            </div>
          ) : (
            <>
              {selectedTags.length > 0 && (
                <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                  <div className="text-sm font-medium text-gray-300 mb-2">
                    Selected Tags ({selectedTags.length}):
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedTags.map(tagId => {
                      const tag = allTags.find(t => t.id === tagId);
                      return tag ? (
                        <span key={tagId} className="px-2 py-1 bg-blue-700 text-blue-100 rounded-full text-xs">
                          {tag.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              <div className="space-y-1">
                {tagHierarchy.length > 0 ? (
                  tagHierarchy.map(tag => renderTag(tag))
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No tags available
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={applying}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleApplyTags}
            disabled={applying || selectedTags.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applying ? 'Adding...' : `Add ${selectedTags.length} Tag${selectedTags.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

StashPerformerTagSelector.propTypes = {
  performerId: PropTypes.string.isRequired,
  clipId: PropTypes.string,
  sceneId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onTagsAdded: PropTypes.func
};

export default StashPerformerTagSelector;
