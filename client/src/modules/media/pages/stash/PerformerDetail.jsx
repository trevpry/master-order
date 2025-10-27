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

  // Merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeDirection, setMergeDirection] = useState('into'); // 'into' or 'from'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedPerformers, setSelectedPerformers] = useState([]);
  const [isMerging, setIsMerging] = useState(false);

  // Scene merge state
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const [showSceneMergeModal, setShowSceneMergeModal] = useState(false);
  const [scenesToMerge, setScenesToMerge] = useState([]);
  const [mergeSceneData, setMergeSceneData] = useState(null);
  const [isMergingScenes, setIsMergingScenes] = useState(false);

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
      
      alert('✅ Performer synced successfully from Stash!');
    } catch (error) {
      console.error('Failed to sync performer:', error);
      alert(`Failed to sync performer: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle search for performers
  const handleSearchPerformers = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `${config.apiBaseUrl}/api/stash/performers/search?q=${encodeURIComponent(query)}&limit=20`
      );
      const result = await response.json();
      
      if (result.success) {
        // Filter out current performer from results
        const filtered = result.data.filter(p => p.id !== id);
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Failed to search performers:', error);
    } finally {
      setIsSearching(false);
    }
  };

  // Handle performer selection for merge
  const handleTogglePerformer = (performer) => {
    setSelectedPerformers(prev => {
      const exists = prev.find(p => p.id === performer.id);
      if (exists) {
        return prev.filter(p => p.id !== performer.id);
      } else {
        return [...prev, performer];
      }
    });
  };

  // Open merge modal
  const handleOpenMergeModal = (direction) => {
    setMergeDirection(direction);
    setShowMergeModal(true);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedPerformers([]);
  };

  // Handle merge performers
  const handleMergePerformers = async () => {
    if (selectedPerformers.length === 0) {
      alert('Please select at least one performer to merge');
      return;
    }

    const direction = mergeDirection;
    const mainPerformer = direction === 'into' ? selectedPerformers[0] : data;
    const mergePerformers = direction === 'into' ? [data] : selectedPerformers;

    const confirmMessage = direction === 'into'
      ? `Merge "${data.name}" INTO "${mainPerformer.name}"?\n\n` +
        `This will:\n` +
        `- Transfer all scenes from "${data.name}" to "${mainPerformer.name}"\n` +
        `- Combine aliases\n` +
        `- Delete "${data.name}"\n` +
        `- Update everything in Stash\n\n` +
        `This action cannot be undone.`
      : `Merge ${selectedPerformers.length} performer(s) INTO "${data.name}"?\n\n` +
        `This will:\n` +
        `- Transfer all scenes to "${data.name}"\n` +
        `- Combine aliases\n` +
        `- Delete: ${selectedPerformers.map(p => p.name).join(', ')}\n` +
        `- Update everything in Stash\n\n` +
        `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/performers/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mainPerformerId: mainPerformer.id,
          mergePerformerIds: mergePerformers.map(p => p.id)
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge performers');
      }

      alert(
        `✅ Successfully merged performer(s)!\n\n` +
        `Main performer: ${mainPerformer.name}\n` +
        `Scenes transferred: ${result.data.scenesTransferred || 0}\n` +
        `${result.data.stashSyncFailed ? '\n⚠️ Warning: Stash sync had issues. Check logs.' : ''}`
      );

      setShowMergeModal(false);

      // If we merged this performer into another, navigate to that performer
      if (direction === 'into') {
        navigate(`/media/stash/performers/${mainPerformer.id}`);
      } else {
        // If we merged others into this one, reload the current page
        window.location.reload();
      }

    } catch (error) {
      console.error('Failed to merge performers:', error);
      alert(`Failed to merge performers: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Handle scene checkbox toggle
  const handleToggleScene = (sceneId) => {
    setSelectedScenes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sceneId)) {
        newSet.delete(sceneId);
      } else {
        newSet.add(sceneId);
      }
      return newSet;
    });
  };

  // Handle opening scene merge modal
  const handleOpenSceneMergeModal = async () => {
    if (selectedScenes.size < 2) {
      alert('Please select at least 2 scenes to merge');
      return;
    }

    try {
      // Fetch full details for selected scenes
      const sceneIds = Array.from(selectedScenes);
      const scenePromises = sceneIds.map(id =>
        fetch(`${config.apiBaseUrl}/api/stash/scenes/${id}`).then(r => r.json())
      );
      
      const sceneResults = await Promise.all(scenePromises);
      const scenes = sceneResults.map(r => r.data);
      
      console.log('🔍 Scenes loaded for merge:', scenes);
      console.log('🔗 URLs per scene:', scenes.map(s => ({
        id: s.id,
        title: s.title,
        url: s.url,
        geviUrl: s.geviUrl,
        episodeUrls: s.episodeUrls
      })));
      
      setScenesToMerge(scenes);
      
      // Collect all unique groups/movies from all scenes
      const allGroups = [];
      const groupIds = new Set();
      scenes.forEach(scene => {
        if (scene.groups && Array.isArray(scene.groups)) {
          scene.groups.forEach(g => {
            if (!groupIds.has(g.group.id)) {
              groupIds.add(g.group.id);
              allGroups.push({
                id: g.group.id,
                name: g.group.name,
                sceneIndex: g.sceneIndex
              });
            }
          });
        }
      });
      
      // Initialize merge data with first scene's data as default
      setMergeSceneData({
        title: scenes[0].title || '',
        date: scenes[0].date || '',
        details: scenes[0].details || '',
        url: scenes[0].url || '',
        stashId: scenes[0].stashId || '',
        studio: scenes[0].studio || null,
        performers: scenes[0].performers || [],
        tags: scenes[0].tags || [],
        groups: allGroups, // Include all groups from all scenes
        episodeUrls: scenes[0].episodeUrls || [],
        geviUrl: scenes[0].geviUrl || '',
        // File information - which file to keep
        keepFileFromSceneId: scenes[0].id,
        // Keep track of which scene is the primary
        primarySceneId: scenes[0].id
      });
      
      setShowSceneMergeModal(true);
    } catch (error) {
      console.error('Failed to load scene details:', error);
      alert(`Failed to load scene details: ${error.message}`);
    }
  };

  // Handle updating merge data field
  const handleUpdateMergeField = (field, value) => {
    setMergeSceneData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle scene merge execution
  const handleMergeScenes = async () => {
    if (!mergeSceneData || !mergeSceneData.primarySceneId) {
      alert('Please select a primary scene');
      return;
    }

    if (!mergeSceneData.keepFileFromSceneId) {
      alert('Please select which file to keep');
      return;
    }

    const primarySceneTitle = scenesToMerge.find(s => s.id === mergeSceneData.primarySceneId)?.title;
    const keepFileSceneTitle = scenesToMerge.find(s => s.id === mergeSceneData.keepFileFromSceneId)?.title;
    const otherScenes = scenesToMerge.filter(s => s.id !== mergeSceneData.primarySceneId);
    const deletedFileScenes = scenesToMerge.filter(s => s.id !== mergeSceneData.keepFileFromSceneId);
    
    const confirmMessage = 
      `Merge ${scenesToMerge.length} scenes?\n\n` +
      `Primary scene (ID kept): ${primarySceneTitle}\n` +
      `File kept from: ${keepFileSceneTitle}\n` +
      `Scenes to delete: ${otherScenes.map(s => s.title).join(', ')}\n\n` +
      `⚠️ WARNING: Video files will be PERMANENTLY DELETED from disk!\n` +
      `Files to delete: ${deletedFileScenes.filter(s => s.id !== mergeSceneData.primarySceneId).map(s => s.title).join(', ')}\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMergingScenes(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primarySceneId: mergeSceneData.primarySceneId,
          mergeSceneIds: scenesToMerge.filter(s => s.id !== mergeSceneData.primarySceneId).map(s => s.id),
          mergedData: mergeSceneData
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge scenes');
      }

      alert('✅ Successfully merged scenes!');
      
      setShowSceneMergeModal(false);
      setSelectedScenes(new Set());
      
      // Reload to show updated scene list
      window.location.reload();

    } catch (error) {
      console.error('Failed to merge scenes:', error);
      alert(`Failed to merge scenes: ${error.message}`);
    } finally {
      setIsMergingScenes(false);
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
                  <button 
                    className="merge-performer-btn merge-into-btn"
                    onClick={() => handleOpenMergeModal('into')}
                    title="Merge this performer into another performer"
                    style={{ 
                      background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                      border: '2px solid #f59e0b',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(245, 158, 11, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(245, 158, 11, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>⬆️</span>
                    <span>Merge Into</span>
                  </button>
                  <button 
                    className="merge-performer-btn merge-from-btn"
                    onClick={() => handleOpenMergeModal('from')}
                    title="Merge other performers into this one"
                    style={{ 
                      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                      border: '2px solid #10b981',
                      color: 'white',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(16, 185, 129, 0.3)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(16, 185, 129, 0.2)';
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>⬇️</span>
                    <span>Merge From</span>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3>🎬 Recent Scenes ({data.scenes.length})</h3>
              {selectedScenes.size >= 2 && (
                <button
                  onClick={handleOpenSceneMergeModal}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: '2px solid #8b5cf6',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    boxShadow: '0 2px 4px rgba(139, 92, 246, 0.2)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 4px 8px rgba(139, 92, 246, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 2px 4px rgba(139, 92, 246, 0.2)';
                  }}
                >
                  🔀 Merge {selectedScenes.size} Scenes
                </button>
              )}
            </div>
            <div className="scenes-list">
              {data.scenes.map(scene => (
                <div
                  key={scene.id}
                  className="scene-list-item"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    backgroundColor: selectedScenes.has(scene.id) ? '#f3f4f6' : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedScenes.has(scene.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleScene(scene.id);
                    }}
                    style={{
                      marginTop: '4px',
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  <div
                    className="scene-list-info clickable"
                    onClick={() => navigate(`/media/stash/scenes/${scene.id}`)}
                    style={{ flex: 1 }}
                  >
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

      {/* Merge Performers Modal */}
      {showMergeModal && (
        <div className="modal-overlay" onClick={() => !isMerging && setShowMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '80vh', overflow: 'auto' }}>
            <h3>
              {mergeDirection === 'into' 
                ? `⬆️ Merge "${data.name}" Into Another Performer` 
                : `⬇️ Merge Other Performers Into "${data.name}"`}
            </h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1rem' }}>
                {mergeDirection === 'into' 
                  ? `Search for a performer to merge "${data.name}" into. The selected performer will keep all scenes and data.`
                  : `Search for performers to merge into "${data.name}". This performer will keep all scenes and data.`}
              </p>

              {/* Search Input */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    handleSearchPerformers(e.target.value);
                  }}
                  placeholder="Search performers by name..."
                  disabled={isMerging}
                  style={{
                    width: '100%',
                    padding: '10px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                />
              </div>

              {/* Search Results */}
              {isSearching && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <div className="spinner" style={{ display: 'inline-block', marginBottom: '0.5rem' }}></div>
                  <p>Searching...</p>
                </div>
              )}

              {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  No performers found
                </div>
              )}

              {!isSearching && searchResults.length > 0 && (
                <div style={{ 
                  maxHeight: '300px', 
                  overflowY: 'auto', 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '6px',
                  marginBottom: '1rem'
                }}>
                  {searchResults.map((performer) => {
                    const isSelected = selectedPerformers.find(p => p.id === performer.id);
                    const canSelectMore = mergeDirection === 'from' || selectedPerformers.length === 0;
                    
                    return (
                      <div
                        key={performer.id}
                        onClick={() => {
                          if (mergeDirection === 'into' && selectedPerformers.length > 0 && !isSelected) {
                            // For 'into', only allow one selection
                            setSelectedPerformers([performer]);
                          } else {
                            handleTogglePerformer(performer);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '12px',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: (canSelectMore || isSelected) ? 'pointer' : 'not-allowed',
                          background: isSelected ? '#dbeafe' : 'white',
                          opacity: (!canSelectMore && !isSelected) ? 0.5 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          style={{ marginRight: '12px', cursor: 'pointer' }}
                        />
                        {performer.image && (
                          <img
                            src={performer.image}
                            alt={performer.name}
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              marginRight: '12px'
                            }}
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: '500', fontSize: '14px' }}>{performer.name}</div>
                          {performer.alias && (
                            <div style={{ fontSize: '12px', color: '#6b7280' }}>
                              Aliases: {performer.alias}
                            </div>
                          )}
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>
                            {performer.scene_count || 0} scenes
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Selected Performers Summary */}
              {selectedPerformers.length > 0 && (
                <div style={{ 
                  padding: '12px', 
                  background: '#f3f4f6', 
                  borderRadius: '6px',
                  marginBottom: '1rem'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '14px' }}>
                    {mergeDirection === 'into' 
                      ? 'Selected Target Performer:' 
                      : `Selected Performers to Merge (${selectedPerformers.length}):`}
                  </div>
                  {selectedPerformers.map(p => (
                    <div key={p.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '4px 0',
                      fontSize: '13px'
                    }}>
                      <span style={{ marginRight: '8px' }}>•</span>
                      <span>{p.name}</span>
                      {p.scene_count && (
                        <span style={{ marginLeft: '8px', color: '#6b7280' }}>
                          ({p.scene_count} scenes)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {mergeDirection === 'into' && selectedPerformers.length > 0 && (
                <div style={{ 
                  padding: '12px', 
                  background: '#fef3c7', 
                  borderRadius: '6px',
                  fontSize: '13px',
                  color: '#92400e'
                }}>
                  ⚠️ Warning: "{data.name}" will be deleted after merging into "{selectedPerformers[0].name}"
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergePerformers}
                disabled={isMerging || selectedPerformers.length === 0}
              >
                {isMerging ? '⏳ Merging...' : `🔀 Merge Performer${selectedPerformers.length > 1 ? 's' : ''}`}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Scenes Modal */}
      {showSceneMergeModal && (
        <div className="modal-overlay" onClick={() => !isMergingScenes && setShowSceneMergeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3>🔀 Merge {scenesToMerge.length} Scenes</h3>
            
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
              Select which data to keep for the merged scene. The primary scene will be kept, others will be deleted.
            </p>

            {/* Primary Scene Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                Primary Scene (will be kept):
              </label>
              <select
                value={mergeSceneData?.primarySceneId || ''}
                onChange={(e) => handleUpdateMergeField('primarySceneId', e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              >
                {scenesToMerge.map(scene => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title || 'Untitled Scene'} {scene.date ? `(${scene.date})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Data Selection Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              
              {/* Title */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Title:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.title === scene.title ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="title"
                        checked={mergeSceneData?.title === scene.title}
                        onChange={() => handleUpdateMergeField('title', scene.title)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ flex: 1, fontSize: '14px' }}>
                        {scene.title || <em style={{ color: '#9ca3af' }}>No title</em>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Date:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.date === scene.date ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="date"
                        checked={mergeSceneData?.date === scene.date}
                        onChange={() => handleUpdateMergeField('date', scene.date)}
                        style={{ marginRight: '8px' }}
                      />
                      <span style={{ fontSize: '14px' }}>
                        {scene.date || <em style={{ color: '#9ca3af' }}>No date</em>}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Details:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => (
                    <label
                      key={scene.id}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        padding: '8px',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        backgroundColor: mergeSceneData?.details === scene.details ? '#dbeafe' : 'white'
                      }}
                    >
                      <input
                        type="radio"
                        name="details"
                        checked={mergeSceneData?.details === scene.details}
                        onChange={() => handleUpdateMergeField('details', scene.details)}
                        style={{ marginRight: '8px', marginTop: '4px' }}
                      />
                      <span style={{ flex: 1, fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                        {scene.details ? (
                          scene.details.length > 100 
                            ? scene.details.substring(0, 100) + '...' 
                            : scene.details
                        ) : (
                          <em style={{ color: '#9ca3af' }}>No details</em>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Studio */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Studio:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => {
                    const studioName = typeof scene.studio === 'string' ? scene.studio : scene.studio?.name;
                    return (
                      <label
                        key={scene.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '8px',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: mergeSceneData?.studio === scene.studio ? '#dbeafe' : 'white'
                        }}
                      >
                        <input
                          type="radio"
                          name="studio"
                          checked={mergeSceneData?.studio === scene.studio}
                          onChange={() => handleUpdateMergeField('studio', scene.studio)}
                          style={{ marginRight: '8px' }}
                        />
                        <span style={{ fontSize: '14px' }}>
                          {studioName || <em style={{ color: '#9ca3af' }}>No studio</em>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* File Information - Select which file to keep */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                  ⚠️ File to Keep (others will be deleted from Stash):
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {scenesToMerge.map(scene => {
                    const formatFileSize = (bytes) => {
                      if (!bytes) return 'Unknown size';
                      const gb = bytes / (1024 * 1024 * 1024);
                      if (gb >= 1) return `${gb.toFixed(2)} GB`;
                      const mb = bytes / (1024 * 1024);
                      return `${mb.toFixed(2)} MB`;
                    };

                    const formatResolution = (width, height) => {
                      if (!width || !height) return 'Unknown resolution';
                      // Common resolution names
                      if (height >= 2160) return `${width}x${height} (4K)`;
                      if (height >= 1080) return `${width}x${height} (1080p)`;
                      if (height >= 720) return `${width}x${height} (720p)`;
                      if (height >= 480) return `${width}x${height} (480p)`;
                      return `${width}x${height}`;
                    };

                    const fileSize = formatFileSize(scene.fileSize);
                    const resolution = formatResolution(scene.width, scene.height);
                    const filePath = scene.path || 'Unknown path';
                    const fileName = filePath.split(/[/\\]/).pop();

                    return (
                      <label
                        key={scene.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          padding: '12px',
                          border: '2px solid',
                          borderColor: mergeSceneData?.keepFileFromSceneId === scene.id ? '#3b82f6' : '#d1d5db',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          backgroundColor: mergeSceneData?.keepFileFromSceneId === scene.id ? '#dbeafe' : 'white',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <input
                            type="radio"
                            name="keepFile"
                            checked={mergeSceneData?.keepFileFromSceneId === scene.id}
                            onChange={() => handleUpdateMergeField('keepFileFromSceneId', scene.id)}
                            style={{ marginRight: '12px', marginTop: '4px' }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '4px', color: '#111827' }}>
                              {scene.title || 'Untitled Scene'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6b7280', wordBreak: 'break-all', marginBottom: '8px' }}>
                              📁 {fileName}
                            </div>
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ fontWeight: '500', color: '#374151' }}>📏 Size:</span>{' '}
                                <span style={{ color: '#6b7280' }}>{fileSize}</span>
                              </div>
                              <div style={{ fontSize: '13px' }}>
                                <span style={{ fontWeight: '500', color: '#374151' }}>🎬 Resolution:</span>{' '}
                                <span style={{ color: '#6b7280' }}>{resolution}</span>
                              </div>
                              {scene.duration && (
                                <div style={{ fontSize: '13px' }}>
                                  <span style={{ fontWeight: '500', color: '#374151' }}>⏱️ Duration:</span>{' '}
                                  <span style={{ color: '#6b7280' }}>{Math.floor(scene.duration / 60)}:{String(Math.floor(scene.duration % 60)).padStart(2, '0')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {mergeSceneData?.keepFileFromSceneId === scene.id && (
                          <div style={{ 
                            fontSize: '12px', 
                            color: '#3b82f6', 
                            fontWeight: '500',
                            marginTop: '4px',
                            paddingLeft: '28px'
                          }}>
                            ✓ This file will be kept
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p style={{ fontSize: '12px', color: '#dc2626', marginTop: '8px', fontStyle: 'italic' }}>
                  ⚠️ Warning: Video files from unselected scenes will be permanently deleted from disk!
                </p>
              </div>

              {/* Tags - Combine all unique tags */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Tags (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    const allTags = new Map();
                    scenesToMerge.forEach(scene => {
                      if (scene.tags) {
                        scene.tags.forEach(tag => {
                          allTags.set(tag.id, tag);
                        });
                      }
                    });
                    return Array.from(allTags.values()).map(tag => (
                      <span
                        key={tag.id}
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          margin: '2px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        {tag.name}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Performers - Combine all unique performers */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Performers (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    const allPerformers = new Map();
                    scenesToMerge.forEach(scene => {
                      if (scene.performers) {
                        scene.performers.forEach(performer => {
                          allPerformers.set(performer.id, performer);
                        });
                      }
                    });
                    return Array.from(allPerformers.values()).map(performer => (
                      <span
                        key={performer.id}
                        style={{
                          display: 'inline-block',
                          padding: '4px 8px',
                          margin: '2px',
                          backgroundColor: '#dbeafe',
                          borderRadius: '4px',
                          fontSize: '12px'
                        }}
                      >
                        {performer.name}
                      </span>
                    ));
                  })()}
                </div>
              </div>

              {/* Groups/Movies - Combine all unique groups */}
              {(() => {
                const allGroups = new Map();
                scenesToMerge.forEach(scene => {
                  if (scene.groups && Array.isArray(scene.groups)) {
                    scene.groups.forEach(g => {
                      if (!allGroups.has(g.group.id)) {
                        allGroups.set(g.group.id, {
                          id: g.group.id,
                          name: g.group.name,
                          sceneIndex: g.sceneIndex
                        });
                      }
                    });
                  }
                });
                
                if (allGroups.size > 0) {
                  return (
                    <div>
                      <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                        Movies/Compilations (all will be combined):
                      </label>
                      <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                        {Array.from(allGroups.values()).map(group => (
                          <span
                            key={group.id}
                            style={{
                              display: 'inline-block',
                              padding: '4px 8px',
                              margin: '2px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '4px',
                              fontSize: '12px'
                            }}
                          >
                            🎬 {group.name}{group.sceneIndex ? ` (#${group.sceneIndex})` : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* URLs - Combine all unique URLs */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  URLs (all will be combined):
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {(() => {
                    console.log('🔍 scenesToMerge in URL display:', scenesToMerge);
                    const allUrls = new Set();
                    scenesToMerge.forEach(scene => {
                      console.log(`Scene ${scene.id}:`, {
                        url: scene.url,
                        geviUrl: scene.geviUrl,
                        episodeUrls: scene.episodeUrls
                      });
                      if (scene.url) allUrls.add(scene.url);
                      if (scene.geviUrl) allUrls.add(scene.geviUrl);
                      // Parse and add episode URLs
                      if (scene.episodeUrls) {
                        try {
                          const episodeUrls = typeof scene.episodeUrls === 'string' 
                            ? JSON.parse(scene.episodeUrls) 
                            : scene.episodeUrls;
                          console.log(`  Parsed episodeUrls:`, episodeUrls);
                          if (Array.isArray(episodeUrls)) {
                            episodeUrls.forEach(urlItem => {
                              // Handle both formats: plain strings and objects with url property
                              if (typeof urlItem === 'string') {
                                allUrls.add(urlItem);
                              } else if (urlItem && urlItem.url) {
                                allUrls.add(urlItem.url);
                              }
                            });
                          }
                        } catch (e) {
                          console.error('Failed to parse episodeUrls:', e);
                        }
                      }
                    });
                    
                    console.log('🔗 Total unique URLs collected:', allUrls.size, Array.from(allUrls));
                    
                    if (allUrls.size === 0) {
                      return <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>No URLs found</span>;
                    }
                    
                    return Array.from(allUrls).map((url, index) => (
                      <div
                        key={index}
                        style={{
                          fontSize: '11px',
                          color: '#4b5563',
                          padding: '4px 0',
                          wordBreak: 'break-all'
                        }}
                      >
                        🔗 {url}
                      </div>
                    ));
                  })()}
                </div>
              </div>

            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergeScenes}
                disabled={isMergingScenes || !mergeSceneData?.primarySceneId}
              >
                {isMergingScenes ? '⏳ Merging...' : '🔀 Merge Scenes'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowSceneMergeModal(false)}
                disabled={isMergingScenes}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
