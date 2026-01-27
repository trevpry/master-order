import React, { useState, useEffect } from 'react';
import { getTagParents } from '../../../utils/stashUtils';

const ClipTagManager = ({ clip, onTagsUpdated, isVisible, onClose }) => {
  const [availableTags, setAvailableTags] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState(new Set());
  const [showAllTags, setShowAllTags] = useState(false);

  useEffect(() => {
    if (isVisible) {
      fetchAvailableTags();
      // Initialize selected tags from current clip tags
      if (clip?.tags) {
        const currentTagIds = clip.tags.map(tagRelation => tagRelation.tag?.id || tagRelation.tagId);
        setSelectedTagIds(new Set(currentTagIds));
      }
    }
  }, [isVisible, clip]);

  const fetchAvailableTags = async () => {
    try {
      setLoading(true);
      // Fetch root tags only by default, or all tags if requested
      const rootOnlyParam = showAllTags ? 'false' : 'true';
      const url = `/api/stash/tags?rootOnly=${rootOnlyParam}&perPage=100`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        console.log('ClipTagManager: Fetched tags:', data.data?.length || 0, 'tags');
        // Filter out tags that are excluded from clip tagging
        const filteredTags = (data.data || []).filter(tag => tag.includeInClipTagging !== false);
        setAvailableTags(filteredTags);
      }
    } catch (error) {
      console.error('Error fetching tags:', error);
    } finally {
      setLoading(false);
    }
  };

  // Refetch tags when showAllTags changes
  useEffect(() => {
    if (isVisible) {
      fetchAvailableTags();
    }
  }, [showAllTags]);

  // Search all tags when search term changes
  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchAllTags();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const searchAllTags = async () => {
    try {
      setSearchLoading(true);
      const response = await fetch(`/api/stash/tags?filter=${encodeURIComponent(searchTerm)}&rootOnly=false&perPage=50`);
      if (response.ok) {
        const data = await response.json();
        // Filter out tags that are excluded from clip tagging
        const filteredTags = (data.data || []).filter(tag => tag.includeInClipTagging !== false);
        setSearchResults(filteredTags);
      }
    } catch (error) {
      console.error('Error searching tags:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const filteredTags = searchTerm.length >= 2 
    ? searchResults 
    : availableTags.filter(tag =>
        tag.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  // Apply tag directly to clip
  const applyTagToClip = async (tagId) => {
    if (!clip?.id) return;

    try {
      const response = await fetch(`/api/stash/clips/${clip.id}/tags`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagIds: [tagId] }),
      });

      if (!response.ok) throw new Error('Failed to add tag');

      // Update selected tags
      const newSelectedTags = new Set(selectedTagIds);
      newSelectedTags.add(tagId);
      setSelectedTagIds(newSelectedTags);

      // Refresh clip tags
      if (onTagsUpdated) {
        onTagsUpdated();
      }
    } catch (error) {
      console.error('Error applying tag to clip:', error);
      alert('Failed to add tag to clip. Please try again.');
    }
  };

  const toggleTag = (tagId) => {
    const newSelectedTags = new Set(selectedTagIds);
    if (newSelectedTags.has(tagId)) {
      newSelectedTags.delete(tagId);
    } else {
      newSelectedTags.add(tagId);
    }
    setSelectedTagIds(newSelectedTags);
  };

  // Prevent video player hotkeys when typing in search
  const handleSearchKeyDown = (e) => {
    e.stopPropagation();
  };

  const handleSearchChange = (e) => {
    e.stopPropagation();
    setSearchTerm(e.target.value);
  };

  const saveChanges = async () => {
    if (!clip?.id) return;

    try {
      setLoading(true);
      
      // Get current clip tag IDs
      const currentTagIds = new Set(
        (clip.tags || []).map(tagRelation => tagRelation.tag?.id || tagRelation.tagId)
      );

      // Find tags to add and remove
      const tagsToAdd = Array.from(selectedTagIds).filter(id => !currentTagIds.has(id));
      const tagsToRemove = Array.from(currentTagIds).filter(id => !selectedTagIds.has(id));

      // Add new tags
      if (tagsToAdd.length > 0) {
        const addResponse = await fetch(`/api/stash/clips/${clip.id}/tags`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ tagIds: tagsToAdd }),
        });

        if (!addResponse.ok) {
          throw new Error('Failed to add tags');
        }
      }

      // Remove tags
      for (const tagId of tagsToRemove) {
        const removeResponse = await fetch(`/api/stash/clips/${clip.id}/tags/${tagId}`, {
          method: 'DELETE',
        });

        if (!removeResponse.ok) {
          throw new Error(`Failed to remove tag ${tagId}`);
        }
      }

      // Notify parent component
      if (onTagsUpdated) {
        onTagsUpdated();
      }

      // Close the manager
      onClose();
    } catch (error) {
      console.error('Error saving tag changes:', error);
      alert('Failed to save tag changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="clip-tag-manager-overlay" onClick={onClose}>
      <div 
        className="clip-tag-manager"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onKeyUp={(e) => e.stopPropagation()}
        onKeyPress={(e) => e.stopPropagation()}
      >
        <div className="tag-manager-header">
          <h3>Manage Clip Tags</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="tag-search">
          <input
            type="text"
            placeholder="Search root tags..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            onKeyUp={handleSearchKeyDown}
            onKeyPress={handleSearchKeyDown}
            className="tag-search-input"
            autoFocus
          />
          <div className="search-controls">
            <div className="search-help">
              <span>💡 {showAllTags ? 'Showing all tags' : 'Showing top-level tags only'}. Type to search.</span>
            </div>
            <button 
              className="toggle-all-tags-btn"
              onClick={() => setShowAllTags(!showAllTags)}
              type="button"
            >
              {showAllTags ? '📁 Show Root Only' : '🌳 Show All Tags'}
            </button>
          </div>
        </div>

        <div className="tag-list">
          {loading ? (
            <div className="loading-spinner">Loading tags...</div>
          ) : searchTerm.length >= 2 ? (
            // Show search results
            searchLoading ? (
              <div className="search-loading">Searching...</div>
            ) : searchResults.length > 0 ? (
              searchResults.map(tag => (
                <div
                  key={tag.id}
                  className={`tag-item search-result ${selectedTagIds.has(tag.id) ? 'selected' : ''}`}
                >
                  <div className="tag-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedTagIds.has(tag.id)}
                      onChange={() => toggleTag(tag.id)}
                    />
                  </div>
                  <div className="tag-info">
                    <span className="tag-name">
                      {tag.name}
                      {tag.child_count > 0 && (
                        <span className="tag-children-indicator"> ({tag.child_count} children)</span>
                      )}
                    </span>
                    {tag.description && (
                      <span className="tag-description">{tag.description}</span>
                    )}
                  </div>
                  {tag.favorite && <span className="tag-favorite-icon">⭐</span>}
                  {tag.child_count > 0 && (
                    <span className="tag-has-children-icon">📁</span>
                  )}
                  {!selectedTagIds.has(tag.id) && (
                    <button 
                      className="apply-tag-btn"
                      onClick={() => applyTagToClip(tag)}
                      title="Apply tag to clip immediately"
                    >
                      Apply
                    </button>
                  )}
                </div>
              ))
            ) : (
              <div className="no-results">No tags found for "{searchTerm}"</div>
            )
          ) : (
            // Show regular tag list
            filteredTags.map(tag => (
              <div
                key={tag.id}
                className={`tag-item ${selectedTagIds.has(tag.id) ? 'selected' : ''}`}
                onClick={() => toggleTag(tag.id)}
              >
                <div className="tag-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedTagIds.has(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                </div>
                <div className="tag-info">
                  <span className="tag-name">
                    {tag.name}
                    {!showAllTags && tag.child_count > 0 && (
                      <span className="tag-children-indicator"> ({tag.child_count} children)</span>
                    )}
                  </span>
                  {tag.description && (
                    <span className="tag-description">{tag.description}</span>
                  )}
                </div>
                {tag.favorite && <span className="tag-favorite-icon">⭐</span>}
                {!showAllTags && tag.child_count > 0 && (
                  <span className="tag-has-children-icon">📁</span>
                )}
              </div>
            ))
          )}
        </div>

        <div className="tag-manager-actions">
          <button className="cancel-btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="save-btn" onClick={saveChanges} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClipTagManager;