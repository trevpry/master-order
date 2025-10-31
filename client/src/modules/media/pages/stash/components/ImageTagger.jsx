import React, { useState, useEffect, useCallback } from 'react';
import config from '../../../../../config';
import './ImageTagger.css';

const ImageTagger = ({ onClose, connectionStatus }) => {
  const [currentImage, setCurrentImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [creatingTag, setCreatingTag] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('tags'); // 'tags', 'performers', 'studios'
  
  // Performers state
  const [allPerformers, setAllPerformers] = useState([]);
  const [selectedPerformers, setSelectedPerformers] = useState([]);
  const [performerSearchQuery, setPerformerSearchQuery] = useState('');
  const [showCreatePerformer, setShowCreatePerformer] = useState(false);
  const [newPerformerName, setNewPerformerName] = useState('');
  const [creatingPerformer, setCreatingPerformer] = useState(false);
  
  // Studio state
  const [allStudios, setAllStudios] = useState([]);
  const [selectedStudio, setSelectedStudio] = useState(null);
  const [studioSearchQuery, setStudioSearchQuery] = useState('');
  const [showCreateStudio, setShowCreateStudio] = useState(false);
  const [newStudioName, setNewStudioName] = useState('');
  const [creatingStudio, setCreatingStudio] = useState(false);

  // Load all available tags
  useEffect(() => {
    loadAllTags();
    loadAllPerformers();
    loadAllStudios();
  }, []);

  // Load first untagged image on mount
  useEffect(() => {
    loadNextImage();
  }, []);
  
  // Debounced performer search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (performerSearchQuery) {
        searchPerformers(performerSearchQuery);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(timer);
  }, [performerSearchQuery]);

  const loadAllTags = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags?perPage=10000&rootOnly=false`);
      const result = await response.json();
      console.log('Tags API response:', result);
      if (result.success) {
        console.log('Setting tags:', result.data?.length || 0, 'items');
        setAllTags(result.data || []);
      }
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };
  
  const loadAllPerformers = useCallback(async () => {
    try {
      // Load initial set without search
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers?perPage=10000`);
      const result = await response.json();
      console.log('Performers API response:', result);
      if (result.success && result.data) {
        console.log('Setting performers:', result.data.length, 'items');
        console.log('Total performers available:', result.pagination?.total || 'unknown');
        setAllPerformers(result.data);
      }
    } catch (error) {
      console.error('Error loading performers:', error);
    }
  }, []);
  
  const searchPerformers = useCallback(async (query) => {
    if (!query.trim()) {
      // Reload all performers when search is cleared
      loadAllPerformers();
      return;
    }
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers?perPage=1000&search=${encodeURIComponent(query)}`);
      const result = await response.json();
      console.log('Performer search results:', result.data?.length || 0, 'matches for query:', query);
      if (result.success && result.data) {
        setAllPerformers(result.data);
      }
    } catch (error) {
      console.error('Error searching performers:', error);
    }
  }, [loadAllPerformers]);
  
  const loadAllStudios = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios?perPage=10000`);
      const result = await response.json();
      console.log('Studios API response:', result);
      if (result.success && result.data) {
        console.log('Setting studios:', result.data.length, 'items');
        setAllStudios(result.data);
      }
    } catch (error) {
      console.error('Error loading studios:', error);
    }
  };

  const loadNextImage = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/images/next-untagged`);
      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('📸 Loaded image data:', result.data);
        console.log('📁 Image path:', result.data.path);
        setCurrentImage(result.data);
        setSelectedTags(result.data.tags?.map(t => t.id) || []);
        setSelectedPerformers(result.data.performers?.map(p => p.id) || []);
        setSelectedStudio(result.data.studioId || null);
      } else {
        alert('✅ No more untagged images!');
        onClose();
      }
    } catch (error) {
      console.error('Error loading next image:', error);
      alert('Failed to load next image');
    } finally {
      setLoading(false);
    }
  };

  const handleTagToggle = (tagId) => {
    setSelectedTags(prev => {
      if (prev.includes(tagId)) {
        return prev.filter(id => id !== tagId);
      } else {
        return [...prev, tagId];
      }
    });
  };
  
  const handlePerformerToggle = (performerId) => {
    setSelectedPerformers(prev => {
      if (prev.includes(performerId)) {
        return prev.filter(id => id !== performerId);
      } else {
        return [...prev, performerId];
      }
    });
  };
  
  const handleCreateTag = async () => {
    if (!newTagName.trim()) {
      alert('Please enter a tag name');
      return;
    }
    
    setCreatingTag(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTagName.trim() })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.tag) {
        const newTag = result.data.tag;
        
        // Add to tags list
        setAllTags(prev => [...prev, newTag]);
        
        // Select the new tag
        setSelectedTags(prev => [...prev, newTag.id]);
        
        // Reset form
        setNewTagName('');
        setShowCreateTag(false);
        
        alert(result.data.message || `Tag "${newTag.name}" created successfully!`);
      } else {
        alert('Failed to create tag: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating tag:', error);
      alert('Failed to create tag');
    } finally {
      setCreatingTag(false);
    }
  };

  const handleCreatePerformer = async () => {
    if (!newPerformerName.trim()) {
      alert('Please enter a performer name');
      return;
    }
    
    setCreatingPerformer(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newPerformerName.trim() })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.performer) {
        const newPerformer = result.data.performer;
        
        // Add to performers list
        setAllPerformers(prev => [...prev, newPerformer]);
        
        // Select the new performer
        setSelectedPerformers(prev => [...prev, newPerformer.id]);
        
        // Reset form
        setNewPerformerName('');
        setShowCreatePerformer(false);
        
        alert(`Performer "${newPerformer.name}" created successfully!`);
      } else {
        alert('Failed to create performer: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating performer:', error);
      alert('Failed to create performer');
    } finally {
      setCreatingPerformer(false);
    }
  };
  
  const handleCreateStudio = async () => {
    if (!newStudioName.trim()) {
      alert('Please enter a studio name');
      return;
    }
    
    setCreatingStudio(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newStudioName.trim() })
      });
      
      const result = await response.json();
      
      if (result.success && result.data.studio) {
        const newStudio = result.data.studio;
        
        // Add to studios list
        setAllStudios(prev => [...prev, newStudio]);
        
        // Select the new studio
        setSelectedStudio(newStudio.id);
        
        // Reset form
        setNewStudioName('');
        setShowCreateStudio(false);
        
        alert(`Studio "${newStudio.name}" created successfully!`);
      } else {
        alert('Failed to create studio: ' + (result.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error creating studio:', error);
      alert('Failed to create studio');
    } finally {
      setCreatingStudio(false);
    }
  };

  const handleStudioChange = (studioId) => {
    setSelectedStudio(studioId === selectedStudio ? null : studioId);
  };

  const handleNext = async () => {
    if (!currentImage) return;

    setSaving(true);
    try {
      // Update tags
      await fetch(`${config.apiBaseUrl}/api/stash/images/${currentImage.id}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagIds: selectedTags })
      });
      
      // Update performers
      await fetch(`${config.apiBaseUrl}/api/stash/images/${currentImage.id}/performers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ performerIds: selectedPerformers })
      });
      
      // Update studio
      await fetch(`${config.apiBaseUrl}/api/stash/images/${currentImage.id}/studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studioId: selectedStudio })
      });

      // Mark as tagged
      await fetch(`${config.apiBaseUrl}/api/stash/images/${currentImage.id}/tagged`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagged: true })
      });

      // Load next image
      loadNextImage();
    } catch (error) {
      console.error('Error saving image tags:', error);
      alert('Failed to save tags');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    loadNextImage();
  };

  const filteredTags = searchQuery
    ? allTags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allTags;
    
  // Performers are filtered server-side via searchPerformers()
  const filteredPerformers = allPerformers;
    
  const filteredStudios = studioSearchQuery
    ? allStudios.filter(studio => {
        const query = studioSearchQuery.toLowerCase();
        const name = studio.name?.toLowerCase() || '';
        const aliases = studio.aliases || [];
        
        // Check if name matches
        if (name.includes(query)) return true;
        
        // Check if any alias matches
        return aliases.some(alias => 
          alias.toLowerCase().includes(query)
        );
      })
    : allStudios;

  if (loading && !currentImage) {
    return (
      <div className="image-tagger-overlay">
        <div className="image-tagger-loading">
          <div className="loading-spinner"></div>
          <p>Loading image...</p>
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return null;
  }

  // Use the backend proxy for image URLs
  const imageUrl = currentImage.id
    ? `${config.apiBaseUrl}/api/stash/image-proxy/image/${currentImage.id}/image`
    : currentImage.url;

  return (
    <div className="image-tagger-overlay">
      <div className="image-tagger-container">
        {/* Header */}
        <div className="image-tagger-header">
          <h2>🏷️ Tag Images</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        {/* Main Content */}
        <div className="image-tagger-content">
          {/* Image Display */}
          <div className="image-display">
            {imageUrl ? (
              <img src={imageUrl} alt={currentImage.title || 'Image'} />
            ) : (
              <div className="no-image">No image available</div>
            )}
            
            {/* Removed file info - now in footer */}
            
            {currentImage.title && (
              <div className="image-title">{currentImage.title}</div>
            )}
          </div>

          {/* Tag Panel */}
          <div className="tag-panel">
            {/* Tab Navigation */}
            <div className="tab-navigation">
              <button 
                className={`tab-button ${activeTab === 'tags' ? 'active' : ''}`}
                onClick={() => setActiveTab('tags')}
              >
                🏷️ Tags ({selectedTags.length})
              </button>
              <button 
                className={`tab-button ${activeTab === 'performers' ? 'active' : ''}`}
                onClick={() => setActiveTab('performers')}
              >
                👥 Performers ({selectedPerformers.length})
              </button>
              <button 
                className={`tab-button ${activeTab === 'studios' ? 'active' : ''}`}
                onClick={() => setActiveTab('studios')}
              >
                🎬 Studio ({selectedStudio ? '1' : '0'})
              </button>
            </div>

            {/* Tags Tab */}
            {activeTab === 'tags' && (
              <>
                <div className="tag-panel-header">
                  <h3>Select Tags</h3>
                  <div className="tag-count">
                    {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="tag-search"
                />

            {!showCreateTag ? (
              <button 
                className="create-button"
                onClick={() => setShowCreateTag(true)}
              >
                + Create New Tag
              </button>
            ) : (
              <div className="create-form">
                <input
                  type="text"
                  placeholder="Enter tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateTag();
                    }
                  }}
                  className="create-input"
                  autoFocus
                />
                <div className="create-actions">
                  <button 
                    className="create-confirm"
                    onClick={handleCreateTag}
                    disabled={creatingTag || !newTagName.trim()}
                  >
                    {creatingTag ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    className="create-cancel"
                    onClick={() => {
                      setShowCreateTag(false);
                      setNewTagName('');
                    }}
                    disabled={creatingTag}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="tag-list">
              {filteredTags.map(tag => (
                <div
                  key={tag.id}
                  className={`tag-item ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
                  onClick={() => handleTagToggle(tag.id)}
                >
                  <span className="tag-name">{tag.name}</span>
                  {selectedTags.includes(tag.id) && <span className="check-mark">✓</span>}
                </div>
              ))}
            </div>
              </>
            )}
            
            {/* Performers Tab */}
            {activeTab === 'performers' && (
              <>
                <div className="tag-panel-header">
                  <h3>Select Performers</h3>
                  <div className="tag-count">
                    {selectedPerformers.length} performer{selectedPerformers.length !== 1 ? 's' : ''} selected
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Search performers..."
                  value={performerSearchQuery}
                  onChange={(e) => setPerformerSearchQuery(e.target.value)}
                  className="tag-search"
                />

            {!showCreatePerformer ? (
              <button 
                className="create-button"
                onClick={() => setShowCreatePerformer(true)}
              >
                + Create New Performer
              </button>
            ) : (
              <div className="create-form">
                <input
                  type="text"
                  placeholder="Enter performer name..."
                  value={newPerformerName}
                  onChange={(e) => setNewPerformerName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreatePerformer();
                    }
                  }}
                  className="create-input"
                  autoFocus
                />
                <div className="create-actions">
                  <button 
                    className="create-confirm"
                    onClick={handleCreatePerformer}
                    disabled={creatingPerformer || !newPerformerName.trim()}
                  >
                    {creatingPerformer ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    className="create-cancel"
                    onClick={() => {
                      setShowCreatePerformer(false);
                      setNewPerformerName('');
                    }}
                    disabled={creatingPerformer}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="tag-list performer-list">
              {filteredPerformers.map(performer => (
                <div
                  key={performer.id}
                  className={`tag-item ${selectedPerformers.includes(performer.id) ? 'selected' : ''}`}
                  onClick={() => handlePerformerToggle(performer.id)}
                >
                  <span className="tag-name">{performer.name}</span>
                  {selectedPerformers.includes(performer.id) && <span className="check-mark">✓</span>}
                </div>
              ))}
            </div>
              </>
            )}
            
            {/* Studio Tab */}
            {activeTab === 'studios' && (
              <>
                <div className="tag-panel-header">
              <h3>Select Studio</h3>
              {selectedStudio && (
                <div className="tag-count">1 studio selected</div>
              )}
            </div>

            <input
              type="text"
              placeholder="Search studios..."
              value={studioSearchQuery}
              onChange={(e) => setStudioSearchQuery(e.target.value)}
              className="tag-search"
            />

            {!showCreateStudio ? (
              <button 
                className="create-button"
                onClick={() => setShowCreateStudio(true)}
              >
                + Create New Studio
              </button>
            ) : (
              <div className="create-form">
                <input
                  type="text"
                  placeholder="Enter studio name..."
                  value={newStudioName}
                  onChange={(e) => setNewStudioName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateStudio();
                    }
                  }}
                  className="create-input"
                  autoFocus
                />
                <div className="create-actions">
                  <button 
                    className="create-confirm"
                    onClick={handleCreateStudio}
                    disabled={creatingStudio || !newStudioName.trim()}
                  >
                    {creatingStudio ? 'Creating...' : 'Create'}
                  </button>
                  <button 
                    className="create-cancel"
                    onClick={() => {
                      setShowCreateStudio(false);
                      setNewStudioName('');
                    }}
                    disabled={creatingStudio}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="tag-list studio-list">
              {filteredStudios.map(studio => (
                <div
                  key={studio.id}
                  className={`tag-item ${selectedStudio === studio.id ? 'selected' : ''}`}
                  onClick={() => handleStudioChange(studio.id)}
                >
                  <span className="tag-name">{studio.name}</span>
                  {selectedStudio === studio.id && <span className="check-mark">✓</span>}
                </div>
              ))}
            </div>
              </>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="image-tagger-footer">
          <div className="footer-info">
            {connectionStatus?.stashUrl && currentImage?.id && (
              <span className="footer-item">
                <a 
                  href={`${connectionStatus.stashUrl}/images/${currentImage.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stash-link"
                >
                  🔗 View in Stash ↗
                </a>
              </span>
            )}
            {currentImage?.path && (
              <>
                <span className="footer-item">
                  📄 <strong>{currentImage.path.split(/[\\/]/).pop()}</strong>
                </span>
                <span className="footer-item footer-path">
                  📁 {currentImage.path}
                </span>
              </>
            )}
            {currentImage?.gallery && (
              <span className="footer-item">
                📚 {currentImage.gallery.name || currentImage.gallery.title || 'Unnamed Gallery'}
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button className="skip-button" onClick={handleSkip} disabled={saving}>
              Skip
            </button>
            <button className="next-button" onClick={handleNext} disabled={saving}>
              {saving ? 'Saving...' : 'Save & Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageTagger;
