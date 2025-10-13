/**
 * StashClipTagSelector Component
 * Modal for adding tags to a clip from hierarchical tag tree
 * Shows expandable/collapsible tag hierarchy
 */
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import config from '../../config';

const StashClipTagSelector = ({ clipId, onClose, onTagsAdded }) => {
  const [allTags, setAllTags] = useState([]);
  const [tagHierarchy, setTagHierarchy] = useState([]);
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [selectedTags, setSelectedTags] = useState([]);
  const [existingTags, setExistingTags] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  // Build tag hierarchy from flat tag list
  const buildTagHierarchy = (tags) => {
    const tagMap = new Map();
    const rootTags = [];
    
    console.log('Building hierarchy from tags:', tags.length);
    console.log('Sample tag structure:', tags[0]);
    
    // First pass: create map of all tags with empty children arrays
    tags.forEach(tag => {
      tagMap.set(tag.id, { ...tag, children: [] });
    });
    
    // Second pass: build hierarchy
    tags.forEach(tag => {
      const tagNode = tagMap.get(tag.id);
      
      // Check if tag has parents (using 'parents' field from API, not 'parentTags')
      const parentsList = tag.parents || tag.parentTags || [];
      
      if (parentsList.length > 0) {
        // Has parent(s), add to parent's children
        parentsList.forEach(parentRef => {
          // parentRef could be { id, name } or { parentTagId, parentTag: { id, name } }
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
    
    console.log('Root tags found:', rootTags.length);
    console.log('Root tag names:', rootTags.map(t => t.name).slice(0, 10));
    
    return rootTags;
  };

  // Fetch all tags and existing clip tags on mount
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
        
        // Debug: Check tag structure
        if (fetchedTags.length > 0) {
          const sampleTag = fetchedTags.find(t => (t.parents && t.parents.length > 0) || (t.parentTags && t.parentTags.length > 0));
          const rootTag = fetchedTags.find(t => (!t.parents || t.parents.length === 0) && (!t.parentTags || t.parentTags.length === 0));
          console.log('Sample tag with parents:', sampleTag);
          console.log('  - Has parents field?', sampleTag?.parents);
          console.log('  - Has parentTags field?', sampleTag?.parentTags);
          console.log('Sample root tag:', rootTag);
          console.log('  - Tag name:', rootTag?.name);
          
          // Count how many tags have parents
          const tagsWithParents = fetchedTags.filter(t => 
            (t.parents && t.parents.length > 0) || (t.parentTags && t.parentTags.length > 0)
          ).length;
          console.log(`Tags with parents: ${tagsWithParents} / ${fetchedTags.length}`);
        }
        
        setAllTags(fetchedTags);
        
        // Build hierarchical structure
        const hierarchy = buildTagHierarchy(fetchedTags);
        console.log(`Built hierarchy with ${hierarchy.length} root tags`);
        setTagHierarchy(hierarchy);
        
        // Fetch existing tags on this clip
        const clipTagsResponse = await fetch(`${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`);
        if (clipTagsResponse.ok) {
          const clipTagsData = await clipTagsResponse.json();
          const existingTagIds = new Set(clipTagsData.tags?.map(t => t.id) || []);
          setExistingTags(existingTagIds);
          console.log(`Clip has ${existingTagIds.size} existing tags`);
        }
        
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load tags');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [clipId]);

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
    // Don't allow selecting tags already on the clip
    if (existingTags.has(tagId)) {
      toast.error('Tag already exists on clip');
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
      
      const url = `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: selectedTags })
      });

      if (response.ok) {
        const selectedTagNames = allTags
          .filter(tag => selectedTags.includes(tag.id))
          .map(tag => tag.name)
          .join(', ');
        
        toast.success(`✅ Added ${selectedTags.length} tag(s): ${selectedTagNames}`);
        
        // Notify parent to refresh tags
        if (onTagsAdded) {
          onTagsAdded([...selectedTags]);
        }
        
        onClose();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to add tags');
      }
    } catch (error) {
      console.error('Error applying tags:', error);
      toast.error('Failed to add tags to clip');
    } finally {
      setApplying(false);
    }
  };

  // Render a tag node and its children recursively
  const renderTagNode = (tag, depth = 0) => {
    const hasChildren = tag.children && tag.children.length > 0;
    const isExpanded = expandedTags.has(tag.id);
    const isSelected = selectedTags.includes(tag.id);
    const alreadyExists = existingTags.has(tag.id);
    
    return (
      <div key={tag.id} className="select-none">
        <div 
          className={`flex items-center gap-2 py-1 px-2 rounded hover:bg-gray-700 transition-colors ${
            alreadyExists ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 20 + 8}px` }}
        >
          {/* Expand/Collapse button */}
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(tag.id)}
              className="flex items-center justify-center w-5 h-5 text-gray-400 hover:text-white"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-5" />
          )}
          
          {/* Checkbox/Selection */}
          <button
            onClick={() => toggleTag(tag.id)}
            disabled={alreadyExists}
            className={`flex items-center gap-2 flex-1 text-left ${
              alreadyExists ? 'cursor-not-allowed' : 'cursor-pointer'
            }`}
          >
            <span className={`w-5 h-5 border-2 rounded flex items-center justify-center ${
              alreadyExists 
                ? 'border-green-500 bg-green-500 text-white'
                : isSelected 
                  ? 'border-blue-500 bg-blue-500 text-white' 
                  : 'border-gray-600'
            }`}>
              {(isSelected || alreadyExists) && '✓'}
            </span>
            <span className={`${alreadyExists ? 'text-green-400' : 'text-gray-300'}`}>
              {tag.name}
              {alreadyExists && ' (already added)'}
            </span>
          </button>
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {tag.children.map(child => renderTagNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-[70] p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[80vh] border border-gray-700 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 p-4 border-b border-gray-700">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-white">
              <span>🏷️</span>
              <span>Add Tags to Clip</span>
            </h2>
            <p className="mt-1 text-sm text-gray-400">
              Select tags from the hierarchical list below
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 transition-colors hover:text-white"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 p-6 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-gray-400">Loading tags...</div>
          ) : tagHierarchy.length === 0 ? (
            <div className="py-8 text-center text-gray-400">No tags available in database</div>
          ) : (
            <div className="space-y-1">
              {tagHierarchy.map(tag => renderTagNode(tag))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between flex-shrink-0 p-4 bg-gray-800 border-t border-gray-700">
          <div className="text-sm text-gray-400">
            {selectedTags.length > 0 ? (
              <span>{selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected</span>
            ) : (
              <span>Click tags to select, click ▶ to expand categories</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-white transition-colors bg-gray-700 rounded-lg hover:bg-gray-600"
              disabled={applying}
            >
              Cancel
            </button>
            <button
              onClick={handleApplyTags}
              disabled={selectedTags.length === 0 || applying}
              className="flex items-center gap-2 px-6 py-2 text-white transition-colors bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              {applying ? 'Applying...' : (
                <>
                  <span>✓</span>
                  <span>Apply {selectedTags.length > 0 ? selectedTags.length : ''} Tag{selectedTags.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

StashClipTagSelector.propTypes = {
  clipId: PropTypes.number.isRequired,
  onClose: PropTypes.func.isRequired,
  onTagsAdded: PropTypes.func
};

export default StashClipTagSelector;
