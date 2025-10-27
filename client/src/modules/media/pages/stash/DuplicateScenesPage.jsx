import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import config from '../../../../config';
import '../Stash.css';

export default function DuplicateScenesPage() {
  const navigate = useNavigate();
  
  // State
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [distance, setDistance] = useState(0);
  const [durationDiff, setDurationDiff] = useState(-1);
  const [totalScenes, setTotalScenes] = useState(0);
  
  // Scene merge state
  const [showSceneMergeModal, setShowSceneMergeModal] = useState(false);
  const [scenesToMerge, setScenesToMerge] = useState([]);
  const [mergeSceneData, setMergeSceneData] = useState(null);
  const [isMergingScenes, setIsMergingScenes] = useState(false);
  
  // Expanded groups tracking
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  
  // Selected scenes per group for merging
  const [selectedScenes, setSelectedScenes] = useState({}); // { groupIndex: Set<sceneId> }

  // Find duplicates
  const findDuplicates = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/duplicates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          distance: parseInt(distance),
          durationDiff: parseFloat(durationDiff)
        })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to find duplicates');
      }
      
      setDuplicateGroups(result.data.groups);
      setTotalScenes(result.data.totalScenes);
      
      // Expand all groups by default
      const allGroupIndexes = new Set(result.data.groups.map((_, idx) => idx));
      setExpandedGroups(allGroupIndexes);
      
    } catch (err) {
      console.error('Failed to find duplicates:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle group expansion
  const toggleGroup = (index) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Toggle scene selection within a group
  const toggleSceneSelection = (groupIndex, sceneId) => {
    setSelectedScenes(prev => {
      const groupSelections = new Set(prev[groupIndex] || []);
      
      if (groupSelections.has(sceneId)) {
        groupSelections.delete(sceneId);
      } else {
        groupSelections.add(sceneId);
      }
      
      return {
        ...prev,
        [groupIndex]: groupSelections
      };
    });
  };

  // Select all scenes in a group
  const selectAllInGroup = (groupIndex, group) => {
    setSelectedScenes(prev => ({
      ...prev,
      [groupIndex]: new Set(group.map(scene => scene.id))
    }));
  };

  // Deselect all scenes in a group
  const deselectAllInGroup = (groupIndex) => {
    setSelectedScenes(prev => ({
      ...prev,
      [groupIndex]: new Set()
    }));
  };

  // Get selected scenes count for a group
  const getSelectedCount = (groupIndex) => {
    return selectedScenes[groupIndex]?.size || 0;
  };

  // Dismiss a duplicate group
  const handleDismissGroup = async (groupIndex, group) => {
    const sceneIds = group.map(scene => scene.id);
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/duplicates/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sceneIds })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to dismiss group');
      }
      
      // Remove the group from display
      setDuplicateGroups(prev => prev.filter((_, idx) => idx !== groupIndex));
      setTotalScenes(prev => prev - group.length);
      
    } catch (err) {
      console.error('Failed to dismiss group:', err);
      alert(`Failed to dismiss group: ${err.message}`);
    }
  };

  // Handle opening scene merge modal
  const handleOpenSceneMergeModal = async (groupIndex, group) => {
    const selectedInGroup = selectedScenes[groupIndex];
    
    if (!selectedInGroup || selectedInGroup.size < 2) {
      alert('Please select at least 2 scenes to merge');
      return;
    }

    // Filter to only selected scenes
    const scenesToProcess = group.filter(scene => selectedInGroup.has(scene.id));

    try {
      // Fetch full details for selected scenes
      const scenePromises = scenesToProcess.map(scene =>
        fetch(`${config.apiBaseUrl}/api/stash/scenes/${scene.id}`).then(r => r.json())
      );
      
      const sceneResults = await Promise.all(scenePromises);
      const fullScenes = sceneResults.map(r => r.data);
      
      setScenesToMerge(fullScenes);
      
      // Collect all unique groups/movies from all scenes
      const allGroups = [];
      const groupIds = new Set();
      fullScenes.forEach(scene => {
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
        title: fullScenes[0].title || '',
        date: fullScenes[0].date || '',
        details: fullScenes[0].details || '',
        url: fullScenes[0].url || '',
        stashId: fullScenes[0].stashId || '',
        studio: fullScenes[0].studio || null,
        performers: fullScenes[0].performers || [],
        tags: fullScenes[0].tags || [],
        groups: allGroups, // Include all groups from all scenes
        episodeUrls: fullScenes[0].episodeUrls || [],
        geviUrl: fullScenes[0].geviUrl || '',
        // File information - which file to keep
        keepFileFromSceneId: fullScenes[0].id,
        // Keep track of which scene is the primary
        primarySceneId: fullScenes[0].id
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
      
      // Reload duplicates to refresh the list
      findDuplicates();
    } catch (error) {
      console.error('Failed to merge scenes:', error);
      alert(`Failed to merge scenes: ${error.message}`);
    } finally {
      setIsMergingScenes(false);
    }
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(2)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  // Format resolution
  const formatResolution = (width, height) => {
    if (!width || !height) return 'Unknown resolution';
    if (height >= 2160) return `${width}x${height} (4K)`;
    if (height >= 1080) return `${width}x${height} (1080p)`;
    if (height >= 720) return `${width}x${height} (720p)`;
    if (height >= 480) return `${width}x${height} (480p)`;
    return `${width}x${height}`;
  };

  return (
    <div className="studio-detail">
      <div className="studio-header">
        <button onClick={() => navigate('/media/stash')} className="back-button">
          ← Back to Stash
        </button>
        <h1>🔍 Duplicate Scene Detector</h1>
      </div>

      {/* Search Parameters */}
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        marginBottom: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>Search Parameters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Distance (phash accuracy):
            </label>
            <select
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            >
              <option value="0">0 - Exact match only</option>
              <option value="4">4 - High accuracy</option>
              <option value="8">8 - Medium accuracy</option>
              <option value="16">16 - Low accuracy (more results)</option>
            </select>
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Lower = more strict, higher = more permissive
            </p>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
              Duration Difference (seconds):
            </label>
            <input
              type="number"
              value={durationDiff}
              onChange={(e) => setDurationDiff(e.target.value)}
              placeholder="-1 to disable"
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px'
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Max duration difference (-1 to disable check)
            </p>
          </div>
        </div>

        <button
          onClick={findDuplicates}
          disabled={isLoading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {isLoading ? '🔍 Searching...' : '🔍 Find Duplicates'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px',
          color: '#991b1b'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Results Summary */}
      {duplicateGroups.length > 0 && (
        <div style={{
          backgroundColor: '#f0f9ff',
          border: '1px solid #bfdbfe',
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <strong>Found:</strong> {duplicateGroups.length} group(s) with {totalScenes} total duplicate scenes
        </div>
      )}

      {/* Duplicate Groups */}
      {duplicateGroups.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {duplicateGroups.map((group, groupIndex) => (
            <div
              key={groupIndex}
              style={{
                backgroundColor: 'white',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            >
              {/* Group Header */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  borderBottom: expandedGroups.has(groupIndex) ? '1px solid #e5e7eb' : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div 
                  onClick={() => toggleGroup(groupIndex)}
                  style={{ flex: 1, cursor: 'pointer', userSelect: 'none' }}
                >
                  <strong style={{ fontSize: '16px' }}>
                    Group {groupIndex + 1}
                  </strong>
                  <span style={{ marginLeft: '12px', color: '#6b7280', fontSize: '14px' }}>
                    {group.length} scenes
                    {getSelectedCount(groupIndex) > 0 && (
                      <span style={{ color: '#3b82f6', fontWeight: '600' }}>
                        {' '}({getSelectedCount(groupIndex)} selected)
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismissGroup(groupIndex, group);
                    }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#f3f4f6',
                      color: '#6b7280',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    🙈 Not Duplicates
                  </button>
                  {expandedGroups.has(groupIndex) && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          selectAllInGroup(groupIndex, group);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Select All
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deselectAllInGroup(groupIndex);
                        }}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          border: '1px solid #d1d5db',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        Clear
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSceneMergeModal(groupIndex, group);
                        }}
                        disabled={getSelectedCount(groupIndex) < 2}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: getSelectedCount(groupIndex) >= 2 ? '#3b82f6' : '#d1d5db',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: '600',
                          cursor: getSelectedCount(groupIndex) >= 2 ? 'pointer' : 'not-allowed'
                        }}
                      >
                        🔀 Merge Selected ({getSelectedCount(groupIndex)})
                      </button>
                    </>
                  )}
                  <span 
                    onClick={() => toggleGroup(groupIndex)}
                    style={{ fontSize: '20px', cursor: 'pointer', userSelect: 'none' }}
                  >
                    {expandedGroups.has(groupIndex) ? '▼' : '▶'}
                  </span>
                </div>
              </div>

              {/* Group Content */}
              {expandedGroups.has(groupIndex) && (
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                    {group.map((scene, sceneIndex) => {
                      const fileInfo = scene.files && scene.files[0];
                      const resolution = fileInfo ? formatResolution(fileInfo.width, fileInfo.height) : 'Unknown';
                      const fileSize = fileInfo ? formatFileSize(fileInfo.size) : 'Unknown';
                      const duration = fileInfo ? `${Math.floor(fileInfo.duration / 60)}:${String(Math.floor(fileInfo.duration % 60)).padStart(2, '0')}` : 'Unknown';
                      const isSelected = selectedScenes[groupIndex]?.has(scene.id) || false;
                      
                      return (
                        <div
                          key={scene.id}
                          style={{
                            border: isSelected ? '2px solid #3b82f6' : '1px solid #d1d5db',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            transition: 'all 0.2s',
                            backgroundColor: isSelected ? '#eff6ff' : 'white'
                          }}
                        >
                          {/* Scene Image */}
                          {scene.paths && (
                            <div style={{
                              width: '100%',
                              height: '180px',
                              backgroundColor: '#f3f4f6',
                              position: 'relative',
                              overflow: 'hidden'
                            }}>
                              {/* Checkbox overlay */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleSceneSelection(groupIndex, scene.id);
                                }}
                                style={{
                                  position: 'absolute',
                                  top: '8px',
                                  left: '8px',
                                  zIndex: 10,
                                  cursor: 'pointer'
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  style={{
                                    width: '20px',
                                    height: '20px',
                                    cursor: 'pointer',
                                    accentColor: '#3b82f6'
                                  }}
                                />
                              </div>
                              
                              <img
                                src={`${config.apiBaseUrl}/api/stash/image-proxy/${scene.paths.sprite || scene.paths.screenshot}`}
                                alt={scene.title || 'Scene'}
                                onClick={() => window.open(`/media/stash/scenes/${scene.id}`, '_blank')}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  cursor: 'pointer'
                                }}
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                            </div>
                          )}

                          {/* Scene Info */}
                          <div 
                            style={{ padding: '12px', cursor: 'pointer' }}
                            onClick={() => window.open(`/media/stash/scenes/${scene.id}`, '_blank')}
                          >
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600' }}>
                              {scene.title || 'Untitled Scene'}
                            </h4>
                            
                            <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>
                              {scene.date && <div>📅 {scene.date}</div>}
                              {scene.studio && <div>🏢 {scene.studio.name}</div>}
                            </div>

                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr',
                              gap: '4px',
                              fontSize: '11px',
                              backgroundColor: '#f9fafb',
                              padding: '8px',
                              borderRadius: '4px'
                            }}>
                              <div><strong>Resolution:</strong> {resolution}</div>
                              <div><strong>Size:</strong> {fileSize}</div>
                              <div><strong>Duration:</strong> {duration}</div>
                              {fileInfo && fileInfo.video_codec && (
                                <div><strong>Codec:</strong> {fileInfo.video_codec}</div>
                              )}
                            </div>

                            {/* Performers */}
                            {scene.performers && scene.performers.length > 0 && (
                              <div style={{ marginTop: '8px', fontSize: '11px' }}>
                                <strong>Performers:</strong>{' '}
                                {scene.performers.map(p => p.name).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* No Results */}
      {!isLoading && duplicateGroups.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          {error ? '❌ Search failed' : 'No duplicate scenes found. Try adjusting the search parameters.'}
        </div>
      )}

      {/* Scene Merge Modal - Same as StudioDetail.jsx */}
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
                    const allUrls = new Set();
                    scenesToMerge.forEach(scene => {
                      if (scene.url) allUrls.add(scene.url);
                      if (scene.geviUrl) allUrls.add(scene.geviUrl);
                      if (scene.episodeUrls) {
                        try {
                          const episodeUrls = typeof scene.episodeUrls === 'string' 
                            ? JSON.parse(scene.episodeUrls) 
                            : scene.episodeUrls;
                          if (Array.isArray(episodeUrls)) {
                            episodeUrls.forEach(urlItem => {
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

            {/* Actions */}
            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergeScenes}
                disabled={isMergingScenes}
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
