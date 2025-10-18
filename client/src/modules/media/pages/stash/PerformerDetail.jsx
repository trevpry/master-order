import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import config from '../../../../config';

// Helper function to convert cm to feet and inches
const formatHeight = (heightStr) => {
  if (!heightStr) return null;
  // Parse the numeric value from strings like "183 cm" or just "183"
  const heightCm = parseFloat(heightStr);
  if (isNaN(heightCm)) return heightStr; // Return original if can't parse
  const totalInches = heightCm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
};

// Helper function to convert kg to pounds
const formatWeight = (weightStr) => {
  if (!weightStr) return null;
  // Parse the numeric value from strings like "75 kg" or just "75"
  const weightKg = parseFloat(weightStr);
  if (isNaN(weightKg)) return weightStr; // Return original if can't parse
  const pounds = Math.round(weightKg * 2.20462);
  return `${pounds} lbs`;
};

// Helper function to format penis length in inches
const formatPenisLength = (lengthStr) => {
  if (!lengthStr) return null;
  // Parse the numeric value from strings like "18 cm" or just "18"
  const lengthCm = parseFloat(lengthStr);
  if (isNaN(lengthCm)) return lengthStr; // Return original if can't parse
  const inches = (lengthCm / 2.54).toFixed(1);
  return `${inches}"`;
};

export default function PerformerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mergedTags, setMergedTags] = useState([]);
  const [stashUrl, setStashUrl] = useState(null);
  
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    name: '',
    alias: '',
    disambiguation: '',
    newUrls: [''] // Array of new URLs to add
  });
  const [isSaving, setIsSaving] = useState(false);

  // Fetch Stash URL from settings
  useEffect(() => {
    const fetchStashUrl = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/status`);
        const json = await res.json();
        console.log('🔍 Stash connection check:', json);
        if (json.connected && json.stashUrl) {
          console.log('✅ Setting stashUrl:', json.stashUrl);
          setStashUrl(json.stashUrl);
        } else {
          console.log('❌ Stash not connected or no URL');
        }
      } catch (error) {
        console.error('Failed to fetch Stash URL:', error);
      }
    };
    fetchStashUrl();
  }, []);

  useEffect(() => {
    const fetchPerformer = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load performer');
        setData(json.data);
        
        // Merge all tags: performer tags + scene-specific tags
        const tagMap = new Map();
        
        // Add general performer tags
        if (json.data.tags) {
          json.data.tags.forEach(tag => {
            if (!tagMap.has(tag.id)) {
              tagMap.set(tag.id, {
                ...tag,
                isGeneral: true,
                sceneCount: 0,
                scenes: []
              });
            }
          });
        }
        
        // Add ALL scene-specific tags from allScenePerformerTags
        if (json.data.allScenePerformerTags) {
          json.data.allScenePerformerTags.forEach(sceneTag => {
            if (tagMap.has(sceneTag.tagId)) {
              // Tag already exists, increment scene count
              const existing = tagMap.get(sceneTag.tagId);
              existing.sceneCount++;
              existing.scenes.push({ id: sceneTag.sceneId, title: sceneTag.sceneTitle });
            } else {
              // New tag from scene
              tagMap.set(sceneTag.tagId, {
                id: sceneTag.tagId,
                name: sceneTag.tagName,
                isGeneral: false,
                sceneCount: 1,
                scenes: [{ id: sceneTag.sceneId, title: sceneTag.sceneTitle }]
              });
            }
          });
        }
        
        // Convert map to array and sort by name
        const merged = Array.from(tagMap.values()).sort((a, b) => 
          a.name.localeCompare(b.name)
        );
        console.log('Merged tags:', merged);
        console.log('Tag map size:', tagMap.size);
        console.log('Performer tags:', json.data.tags);
        console.log('Scenes with tags:', json.data.scenes?.filter(s => s.performerTags?.length > 0));
        setMergedTags(merged);
        
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchPerformer();
  }, [id]);
  
  // Handle edit mode toggle
  const handleEditClick = () => {
    setEditData({
      name: data.name || '',
      alias: data.alias || '',
      disambiguation: data.disambiguation || '',
      newUrls: [''] // Start with one empty URL field
    });
    setIsEditing(true);
  };
  
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData({ 
      name: '', 
      alias: '', 
      disambiguation: '',
      newUrls: ['']
    });
  };
  
  // Handle adding a new URL field
  const handleAddUrlField = () => {
    setEditData({
      ...editData,
      newUrls: [...editData.newUrls, '']
    });
  };
  
  // Handle removing a URL field
  const handleRemoveUrlField = (index) => {
    const updatedUrls = editData.newUrls.filter((_, i) => i !== index);
    setEditData({
      ...editData,
      newUrls: updatedUrls.length > 0 ? updatedUrls : [''] // Always keep at least one field
    });
  };
  
  // Handle updating a URL field
  const handleUrlChange = (index, value) => {
    const updatedUrls = [...editData.newUrls];
    updatedUrls[index] = value;
    setEditData({
      ...editData,
      newUrls: updatedUrls
    });
  };
  
  // Handle save changes
  const handleSaveChanges = async () => {
    if (!editData.name.trim()) {
      alert('Performer name cannot be empty');
      return;
    }
    
    // Filter out empty URLs
    const validUrls = editData.newUrls.filter(url => url.trim() !== '');
    
    setIsSaving(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editData.name.trim(),
          alias: editData.alias.trim() || null,
          disambiguation: editData.disambiguation.trim() || null,
          newUrls: validUrls // Send array of new URLs to append
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to update performer');
      }
      
      // Update local state with returned performer data
      setData(result.data.performer);
      
      setIsEditing(false);
      alert('Performer updated successfully in both local database and Stash!');
      
    } catch (error) {
      console.error('Failed to update performer:', error);
      alert(`Failed to update performer: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle delete performer
  const handleDeletePerformer = async () => {
    const confirmDelete = window.confirm(
      `Are you sure you want to delete performer "${data.name}"?\n\n` +
      `This will remove the performer from both the local database and Stash.\n` +
      `This action cannot be undone.`
    );
    
    if (!confirmDelete) return;
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete performer');
      }
      
      alert(result.message || 'Performer deleted successfully!');
      
      // Navigate back to performers list
      navigate('/stash?tab=performers');
      
    } catch (error) {
      console.error('Failed to delete performer:', error);
      alert(`Failed to delete performer: ${error.message}`);
    }
  };

  // Handle sync from Stash
  const handleSyncFromStash = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/${id}/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync performer');
      }
      
      // Update local state with synced data
      setData(result.data.performer);
      
      console.log('✅ Performer synced from Stash:', result.data.message);
      
    } catch (error) {
      console.error('Failed to sync performer:', error);
      alert(`Failed to sync performer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page pad performer-detail">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading performer details...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="page pad performer-detail">
        <div className="error-state">
          <p>❌ Error: {error}</p>
          <Link to="/media/stash" className="btn">← Back to Stash</Link>
        </div>
      </div>
    );
  }
  
  if (!data) return null;

  return (
    <div className="page pad performer-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">Stash</Link>
        <span> → </span>
        <span>{data.name}</span>
      </div>

      {/* Hero Section with Image */}
      <div className="performer-detail-hero">
        <div className="performer-hero-image-container">
          {data.image ? (
            <img
              src={data.image}
              alt={data.name}
              className="performer-full-image"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          ) : (
            <div className="performer-placeholder-large">
              👤
            </div>
          )}
        </div>
        
        <div className="performer-hero-info">
          <div className="performer-header-row">
            <h1 className="scene-title">
              👤 {data.name}
              {!isEditing && (
                <>
                  <button 
                    className="edit-performer-btn"
                    onClick={handleEditClick}
                    title="Edit performer details"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-performer-btn"
                    onClick={handleDeletePerformer}
                    title="Delete performer from database and Stash"
                  >
                    🗑️
                  </button>
                  <button 
                    className="sync-performer-btn"
                    onClick={handleSyncFromStash}
                    title="Sync latest data from Stash"
                  >
                    🔄
                  </button>
                  {stashUrl && (
                    <a 
                      href={`${stashUrl}/performers/${data.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="view-stash-btn"
                      title="View this performer in Stash"
                    >
                      📊
                    </a>
                  )}
                  {!stashUrl && (
                    <span style={{color: '#999', fontSize: '0.8em', marginLeft: '1rem'}}>
                      (Stash not connected)
                    </span>
                  )}
                </>
              )}
            </h1>
            <div className="performer-header-meta">
              {data.country && (
                <span className="country-badge">
                  🌍 {data.country}
                </span>
              )}
              {/* Social Links - Inline */}
              {data.url && (
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🔗
                </a>
              )}
              {data.instagram && (
                <a href={data.instagram} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  📷
                </a>
              )}
              {data.twitter && (
                <a href={data.twitter} target="_blank" rel="noopener noreferrer" className="social-link-inline">
                  🐦
                </a>
              )}
            </div>
          </div>
          
          {/* Edit Form */}
          {isEditing && (
            <div className="performer-edit-form">
              <h3>✏️ Edit Performer Details</h3>
              <div className="edit-form-grid">
                <div className="form-group">
                  <label htmlFor="edit-name">Name *</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    placeholder="Performer name"
                    disabled={isSaving}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-alias">Alias</label>
                  <input
                    id="edit-alias"
                    type="text"
                    value={editData.alias}
                    onChange={(e) => setEditData({ ...editData, alias: e.target.value })}
                    placeholder="Also known as..."
                    disabled={isSaving}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="edit-disambiguation">Disambiguation</label>
                  <input
                    id="edit-disambiguation"
                    type="text"
                    value={editData.disambiguation}
                    onChange={(e) => setEditData({ ...editData, disambiguation: e.target.value })}
                    placeholder="e.g., (II), (Performer)"
                    disabled={isSaving}
                  />
                </div>
              </div>
              
              {/* New URLs Section */}
              <div className="edit-form-section">
                <div className="section-header">
                  <h4>Add New URLs</h4>
                  <button 
                    type="button"
                    className="btn-add-url"
                    onClick={handleAddUrlField}
                    disabled={isSaving}
                    title="Add another URL field"
                  >
                    ➕ Add URL
                  </button>
                </div>
                
                <div className="url-fields-container">
                  {editData.newUrls.map((url, index) => (
                    <div key={index} className="url-field-row">
                      <input
                        type="url"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        placeholder="https://... (website, social media, etc.)"
                        disabled={isSaving}
                        className="url-input"
                      />
                      {editData.newUrls.length > 1 && (
                        <button
                          type="button"
                          className="btn-remove-url"
                          onClick={() => handleRemoveUrlField(index)}
                          disabled={isSaving}
                          title="Remove this URL"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                
                <p className="url-help-text">
                  ℹ️ New URLs will be added to the performer's existing URLs in Stash
                </p>
              </div>
              
              <div className="edit-form-actions">
                <button 
                  className="btn-save"
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                >
                  {isSaving ? '💾 Saving...' : '💾 Save Changes'}
                </button>
                <button 
                  className="btn-cancel"
                  onClick={handleCancelEdit}
                  disabled={isSaving}
                >
                  ❌ Cancel
                </button>
              </div>
              
              <p className="edit-form-note">
                ℹ️ Changes will be saved to both the local database and Stash
              </p>
            </div>
          )}
          
          {data.alias && (
            <p className="performer-alias">
              Also known as: <span>{data.alias}</span>
            </p>
          )}
          
          {data.disambiguation && (
            <p className="performer-disambiguation">
              <span className="disambiguation-badge">{data.disambiguation}</span>
            </p>
          )}

          {/* Physical Attributes - Moved here */}
          <div className="performer-physical-attributes-inline">
            <h4 className="section-subtitle">📏 Physical Attributes</h4>
            <div className="attributes-compact">
              {data.height && (
                <span className="attribute-item">
                  <strong>Height:</strong> {formatHeight(data.height) || data.height}
                </span>
              )}
              {data.weight && (
                <span className="attribute-item">
                  <strong>Weight:</strong> {formatWeight(data.weight) || data.weight}
                </span>
              )}
              {data.penis_length && (
                <span className="attribute-item">
                  <strong>Penis Length:</strong> {formatPenisLength(data.penis_length) || data.penis_length}
                </span>
              )}
              {data.circumcised && (
                <span className="attribute-item">
                  <strong>Circumcised:</strong> {data.circumcised}
                </span>
              )}
              {data.measurements && (
                <span className="attribute-item">
                  <strong>Measurements:</strong> {data.measurements}
                </span>
              )}
              {data.eye_color && (
                <span className="attribute-item">
                  <strong>Eyes:</strong> {data.eye_color}
                </span>
              )}
              {data.hair_color && (
                <span className="attribute-item">
                  <strong>Hair:</strong> {data.hair_color}
                </span>
              )}
              {data.ethnicityTag && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong>{' '}
                  <Link to={`/media/stash/tags/${data.ethnicityTag.id}`} className="tag-link-inline">
                    {data.ethnicityTag.name}
                  </Link>
                </span>
              )}
              {!data.ethnicityTag && data.ethnicity && (
                <span className="attribute-item">
                  <strong>Ethnicity:</strong> {data.ethnicity}
                </span>
              )}
              {data.tattoos && (
                <span className="attribute-item">
                  <strong>Tattoos:</strong> {data.tattoos}
                </span>
              )}
              {data.piercings && (
                <span className="attribute-item">
                  <strong>Piercings:</strong> {data.piercings}
                </span>
              )}
              {data.career_length && (
                <span className="attribute-item">
                  <strong>Career:</strong> {data.career_length}
                </span>
              )}
            </div>
          </div>
          
          <div className="scene-meta-badges">
            {data.birthdate && (
              <div className="meta-badge">
                <span className="badge-icon">🎂</span>
                <span>{data.birthdate}</span>
              </div>
            )}
            {data.rating && (
              <div className="meta-badge rating">
                <span className="badge-icon">⭐</span>
                <span>{data.rating}/100</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="scene-detail-content">
        {/* Details Section */}
        {data.details && (
          <div className="card scene-details-card">
            <h3>📝 Details</h3>
            <p className="scene-description">{data.details}</p>
          </div>
        )}

        {/* Tags Section - Merged from performer and scene-specific */}
        <div className="card">
          <h3>🏷️ All Tags ({mergedTags.length})</h3>
          <p className="text-sm text-gray-600 mb-3">
            Tags applied to this performer (general) or in specific scenes
          </p>
          {mergedTags.length > 0 ? (
            <div className="tags-grid-detailed">
              {mergedTags.map(tag => (
                <div key={tag.id} className="tag-detail-item">
                  <Link
                    to={`/media/stash/tags/${tag.id}`}
                    className="tag-chip-detailed"
                  >
                    <span className="tag-name">{tag.name}</span>
                    {tag.isGeneral && tag.sceneCount > 0 && (
                      <span className="tag-badge general-and-scene">
                        General + {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {tag.isGeneral && tag.sceneCount === 0 && (
                      <span className="tag-badge general-only">
                        General
                      </span>
                    )}
                    {!tag.isGeneral && (
                      <span className="tag-badge scene-only">
                        {tag.sceneCount} scene{tag.sceneCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </Link>
                  {tag.scenes.length > 0 && (
                    <div className="tag-scenes-list">
                      {tag.scenes.slice(0, 3).map(scene => (
                        <Link
                          key={scene.id}
                          to={`/media/stash/scenes/${scene.id}`}
                          className="tag-scene-link"
                          onClick={(e) => e.stopPropagation()}
                        >
                          🎬 {scene.title || 'Untitled'}
                        </Link>
                      ))}
                      {tag.scenes.length > 3 && (
                        <span className="more-scenes">
                          +{tag.scenes.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              No tags found for this performer.
            </div>
          )}
        </div>

        {/* Scenes Section */}
        {data.scenes && data.scenes.length > 0 && (
          <div className="card full-width">
            <h3>🎬 Recent Scenes ({data.scenes.length})</h3>
            <div className="scenes-list">
              {data.scenes.map(scene => (
                <div
                  key={scene.id}
                  className="scene-list-item clickable"
                  onClick={() => navigate(`/media/stash/scenes/${scene.id}`)}
                >
                  <div className="scene-list-info">
                    <div className="scene-list-title">
                      {scene.title || 'Untitled Scene'}
                    </div>
                    <div className="scene-list-meta">
                      {scene.date && <span>📅 {scene.date}</span>}
                      {scene.studio && (
                        <span>
                          🏢 {typeof scene.studio === 'string' ? scene.studio : scene.studio?.name}
                        </span>
                      )}
                    </div>
                    {/* Scene-specific performer tags */}
                    {scene.performerTags && scene.performerTags.length > 0 && (
                      <div className="scene-performer-tags">
                        <span className="tags-label">Tags in this scene:</span>
                        {scene.performerTags.map(tag => (
                          <Link
                            key={tag.id}
                            to={`/media/stash/tags/${tag.id}`}
                            className="mini-tag-chip"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {tag.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
