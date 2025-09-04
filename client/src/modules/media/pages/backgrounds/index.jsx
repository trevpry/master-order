import React, { useState, useEffect } from 'react';
import config from '../../../../config';
import toast, { Toaster } from 'react-hot-toast';
import './Backgrounds.css';

const Backgrounds = () => {
  const [backgrounds, setBackgrounds] = useState([]);
  const [galleries, setGalleries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadLoading, setDownloadLoading] = useState(false);
  
  // Gallery management
  const [showCreateGallery, setShowCreateGallery] = useState(false);
  const [newGalleryName, setNewGalleryName] = useState('');
  const [newGalleryDescription, setNewGalleryDescription] = useState('');
  const [selectedGallery, setSelectedGallery] = useState(null);
  const [galleryBackgrounds, setGalleryBackgrounds] = useState([]);
  
  // Selection state for adding to galleries
  const [selectedBackgrounds, setSelectedBackgrounds] = useState(new Set());
  const [showAddToGallery, setShowAddToGallery] = useState(false);

  // Load backgrounds and galleries on component mount
  useEffect(() => {
    fetchBackgrounds();
    fetchGalleries();
  }, []);

  // Fetch all backgrounds
  const fetchBackgrounds = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${config.apiBaseUrl}/api/backgrounds`);
      if (!response.ok) throw new Error('Failed to fetch backgrounds');
      const data = await response.json();
      setBackgrounds(data);
    } catch (error) {
      console.error('Error fetching backgrounds:', error);
      toast.error('Failed to load backgrounds');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all galleries
  const fetchGalleries = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/background-galleries`);
      if (!response.ok) throw new Error('Failed to fetch galleries');
      const data = await response.json();
      setGalleries(data);
    } catch (error) {
      console.error('Error fetching galleries:', error);
      toast.error('Failed to load galleries');
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploadLoading(true);
    const formData = new FormData();
    
    files.forEach(file => {
      formData.append('backgrounds', file);
    });

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/backgrounds/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      toast.success(`Successfully uploaded ${result.uploaded.length} background(s)`);
      
      if (result.errors && result.errors.length > 0) {
        result.errors.forEach(error => toast.error(error));
      }
      
      fetchBackgrounds(); // Refresh the list
      event.target.value = ''; // Clear the input
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload backgrounds');
    } finally {
      setUploadLoading(false);
    }
  };

  // Handle URL download
  const handleDownloadFromUrl = async () => {
    if (!downloadUrl.trim()) {
      toast.error('Please enter a valid URL');
      return;
    }

    setDownloadLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/backgrounds/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: downloadUrl.trim() })
      });

      if (!response.ok) throw new Error('Download failed');
      
      const result = await response.json();
      toast.success(`Successfully downloaded: ${result.filename}`);
      
      fetchBackgrounds(); // Refresh the list
      setDownloadUrl(''); // Clear the input
      
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to download background from URL');
    } finally {
      setDownloadLoading(false);
    }
  };

  // Delete background
  const handleDeleteBackground = async (backgroundId) => {
    if (!confirm('Are you sure you want to delete this background?')) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/backgrounds/${backgroundId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Delete failed');
      
      toast.success('Background deleted successfully');
      fetchBackgrounds(); // Refresh the list
      
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete background');
    }
  };

  // Create new gallery
  const handleCreateGallery = async () => {
    if (!newGalleryName.trim()) {
      toast.error('Please enter a gallery name');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/background-galleries`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: newGalleryName.trim(),
          description: newGalleryDescription.trim()
        })
      });

      if (!response.ok) throw new Error('Failed to create gallery');
      
      const newGallery = await response.json();
      toast.success('Gallery created successfully');
      
      fetchGalleries(); // Refresh galleries
      setShowCreateGallery(false);
      setNewGalleryName('');
      setNewGalleryDescription('');
      
    } catch (error) {
      console.error('Create gallery error:', error);
      toast.error('Failed to create gallery');
    }
  };

  // Load gallery backgrounds
  const handleSelectGallery = async (gallery) => {
    setSelectedGallery(gallery);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/background-galleries/${gallery.id}/backgrounds`);
      if (!response.ok) throw new Error('Failed to fetch gallery backgrounds');
      const data = await response.json();
      setGalleryBackgrounds(data);
    } catch (error) {
      console.error('Error fetching gallery backgrounds:', error);
      toast.error('Failed to load gallery backgrounds');
    }
  };

  // Add selected backgrounds to gallery
  const handleAddToGallery = async (galleryId) => {
    if (selectedBackgrounds.size === 0) {
      toast.error('Please select backgrounds to add');
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/background-galleries/${galleryId}/add-backgrounds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backgroundIds: Array.from(selectedBackgrounds)
        })
      });

      if (!response.ok) throw new Error('Failed to add backgrounds to gallery');
      
      toast.success('Backgrounds added to gallery successfully');
      setSelectedBackgrounds(new Set());
      setShowAddToGallery(false);
      
      // Refresh gallery backgrounds if we have one selected
      if (selectedGallery) {
        handleSelectGallery(selectedGallery);
      }
      
    } catch (error) {
      console.error('Add to gallery error:', error);
      toast.error('Failed to add backgrounds to gallery');
    }
  };

  // Toggle background selection
  const toggleBackgroundSelection = (backgroundId) => {
    const newSelection = new Set(selectedBackgrounds);
    if (newSelection.has(backgroundId)) {
      newSelection.delete(backgroundId);
    } else {
      newSelection.add(backgroundId);
    }
    setSelectedBackgrounds(newSelection);
  };

  return (
    <div className="backgrounds-container">
      <Toaster position="top-right" />
      
      <div className="backgrounds-header">
        <h1>🖼️ Background Images</h1>
        <p>Manage background images and organize them into galleries for use with custom orders</p>
      </div>

      {/* Upload Section */}
      <div className="upload-section">
        <div className="upload-card">
          <h3>📤 Upload Backgrounds</h3>
          <div className="upload-controls">
            <input
              type="file"
              id="background-upload"
              multiple
              accept="image/*"
              onChange={handleFileUpload}
              disabled={uploadLoading}
              className="file-input"
            />
            <label htmlFor="background-upload" className="upload-btn">
              {uploadLoading ? 'Uploading...' : 'Choose Files'}
            </label>
          </div>
          <p className="upload-note">Supports: JPG, PNG, GIF, WebP</p>
        </div>

        <div className="download-card">
          <h3>🌐 Download from URL</h3>
          <div className="download-controls">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={downloadUrl}
              onChange={(e) => setDownloadUrl(e.target.value)}
              disabled={downloadLoading}
              className="url-input"
            />
            <button
              onClick={handleDownloadFromUrl}
              disabled={downloadLoading || !downloadUrl.trim()}
              className="download-btn"
            >
              {downloadLoading ? 'Downloading...' : 'Download'}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery Management */}
      <div className="gallery-section">
        <div className="gallery-header">
          <h3>🎨 Background Galleries</h3>
          <button 
            onClick={() => setShowCreateGallery(true)}
            className="create-gallery-btn"
          >
            + Create Gallery
          </button>
        </div>

        {showCreateGallery && (
          <div className="create-gallery-form">
            <input
              type="text"
              placeholder="Gallery name"
              value={newGalleryName}
              onChange={(e) => setNewGalleryName(e.target.value)}
              className="gallery-name-input"
            />
            <textarea
              placeholder="Gallery description (optional)"
              value={newGalleryDescription}
              onChange={(e) => setNewGalleryDescription(e.target.value)}
              className="gallery-description-input"
              rows="3"
            />
            <div className="gallery-form-actions">
              <button onClick={handleCreateGallery} className="save-btn">
                Create
              </button>
              <button 
                onClick={() => {
                  setShowCreateGallery(false);
                  setNewGalleryName('');
                  setNewGalleryDescription('');
                }}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="galleries-list">
          {galleries.map(gallery => (
            <div
              key={gallery.id}
              className={`gallery-card ${selectedGallery?.id === gallery.id ? 'selected' : ''}`}
              onClick={() => handleSelectGallery(gallery)}
            >
              <h4>{gallery.name}</h4>
              <p>{gallery.description || 'No description'}</p>
              <span className="background-count">{gallery.backgroundCount || 0} backgrounds</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selection Actions */}
      {selectedBackgrounds.size > 0 && (
        <div className="selection-actions">
          <span>{selectedBackgrounds.size} background(s) selected</span>
          <button
            onClick={() => setShowAddToGallery(true)}
            className="add-to-gallery-btn"
          >
            Add to Gallery
          </button>
          <button
            onClick={() => setSelectedBackgrounds(new Set())}
            className="clear-selection-btn"
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Add to Gallery Modal */}
      {showAddToGallery && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add to Gallery</h3>
            <p>Select a gallery to add {selectedBackgrounds.size} background(s):</p>
            <div className="gallery-selection">
              {galleries.map(gallery => (
                <button
                  key={gallery.id}
                  onClick={() => handleAddToGallery(gallery.id)}
                  className="gallery-option"
                >
                  {gallery.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowAddToGallery(false)}
              className="cancel-btn"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Backgrounds Grid */}
      <div className="backgrounds-content">
        {selectedGallery && (
          <div className="gallery-view">
            <div className="gallery-view-header">
              <h3>📁 {selectedGallery.name}</h3>
              <button
                onClick={() => {
                  setSelectedGallery(null);
                  setGalleryBackgrounds([]);
                }}
                className="back-btn"
              >
                ← Back to All
              </button>
            </div>
            <div className="backgrounds-grid">
              {galleryBackgrounds.map(bg => (
                <div key={bg.id} className="background-item">
                  <div className="background-image">
                    <img
                      src={`${config.apiBaseUrl}/api/backgrounds/${bg.id}/image`}
                      alt={bg.filename}
                      loading="lazy"
                    />
                  </div>
                  <div className="background-info">
                    <span className="filename">{bg.filename}</span>
                    <span className="dimensions">{bg.width} × {bg.height}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedGallery && (
          <div className="all-backgrounds">
            <h3>🖼️ All Backgrounds ({backgrounds.length})</h3>
            {loading ? (
              <div className="loading">Loading backgrounds...</div>
            ) : (
              <div className="backgrounds-grid">
                {backgrounds.map(bg => (
                  <div
                    key={bg.id}
                    className={`background-item ${selectedBackgrounds.has(bg.id) ? 'selected' : ''}`}
                  >
                    <div className="background-image">
                      <img
                        src={`${config.apiBaseUrl}/api/backgrounds/${bg.id}/image`}
                        alt={bg.filename}
                        loading="lazy"
                        onClick={() => toggleBackgroundSelection(bg.id)}
                      />
                      <div className="background-overlay">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleBackgroundSelection(bg.id);
                          }}
                          className="select-btn"
                        >
                          {selectedBackgrounds.has(bg.id) ? '✓' : '+'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBackground(bg.id);
                          }}
                          className="delete-btn"
                          title="Delete background"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="background-info">
                      <span className="filename">{bg.filename}</span>
                      <div className="background-meta">
                        <span className="dimensions">{bg.width} × {bg.height}</span>
                        <span className="file-size">{Math.round(bg.fileSize / 1024)} KB</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Backgrounds;
