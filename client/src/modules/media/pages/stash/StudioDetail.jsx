import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
import SceneCard from './components/SceneCard';
import config from '../../../../config';

export default function StudioDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Scenes state
  const [scenes, setScenes] = useState([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesPage, setScenesPage] = useState(1);
  const [scenesPagination, setScenesPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    perPage: 20
  });
  const [filterNoPerformers, setFilterNoPerformers] = useState(false);
  const [searchTitle, setSearchTitle] = useState('');
  const [searchPerformer, setSearchPerformer] = useState('');
  
  // Scene merge state
  const [selectedScenes, setSelectedScenes] = useState(new Set());
  const [showSceneMergeModal, setShowSceneMergeModal] = useState(false);
  const [scenesToMerge, setScenesToMerge] = useState([]);
  const [mergeSceneData, setMergeSceneData] = useState(null);
  const [isMergingScenes, setIsMergingScenes] = useState(false);
  
  // GEVI URL state
  const [showGeviUrlModal, setShowGeviUrlModal] = useState(false);
  const [geviUrlInput, setGeviUrlInput] = useState('');
  const [isSavingGeviUrl, setIsSavingGeviUrl] = useState(false);
  
  // Notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  
  // Scraper state
  const [availableScrapers, setAvailableScrapers] = useState([]);
  const [selectedScraper, setSelectedScraper] = useState('');
  const [showScraperModal, setShowScraperModal] = useState(false);
  const [isSavingScraper, setIsSavingScraper] = useState(false);

  useEffect(() => {
    const fetchStudio = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load studio');
        setData(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStudio();
  }, [id]);
  
  // Fetch available scrapers
  useEffect(() => {
    const fetchScrapers = async () => {
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/scrapers`);
        const json = await res.json();
        if (json.success) {
          setAvailableScrapers(json.data);
        }
      } catch (e) {
        console.error('Failed to fetch scrapers:', e);
      }
    };
    fetchScrapers();
  }, []);

  // Load scenes when data is available or filter changes
  useEffect(() => {
    if (data) {
      loadScenes();
    }
  }, [scenesPage, data, filterNoPerformers, searchTitle, searchPerformer]);

  const loadScenes = async () => {
    setScenesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', scenesPage);
      params.set('perPage', scenesPagination.perPage);
      params.set('sortBy', 'date');
      params.set('sortDirection', 'DESC');
      params.set('studio', data.name); // Filter by studio name
      
      if (filterNoPerformers) {
        params.set('noPerformers', 'true');
      }
      
      if (searchTitle.trim()) {
        params.set('title', searchTitle.trim());
      }
      
      if (searchPerformer.trim()) {
        params.set('performer', searchPerformer.trim());
      }

      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes?${params}`);
      const result = await response.json();

      if (result.success) {
        setScenes(result.data || []);
        setScenesPagination({
          page: scenesPage,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 1,
          perPage: 20
        });
      }
    } catch (err) {
      console.error('Error loading scenes:', err);
    } finally {
      setScenesLoading(false);
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
      
      // Reload scenes
      loadScenes();
    } catch (error) {
      console.error('Failed to merge scenes:', error);
      alert(`Failed to merge scenes: ${error.message}`);
    } finally {
      setIsMergingScenes(false);
    }
  };

  const handleSaveGeviUrl = async () => {
    if (!geviUrlInput.trim()) {
      alert('Please enter a GEVI URL');
      return;
    }

    // Basic validation for GEVI URL format
    if (!geviUrlInput.includes('gayeroticvideoindex.com')) {
      if (!confirm('This doesn\'t look like a GEVI URL. Save anyway?')) {
        return;
      }
    }

    setIsSavingGeviUrl(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          geviUrl: geviUrlInput
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setData(prevData => ({
          ...prevData,
          geviUrl: geviUrlInput
        }));
        setShowGeviUrlModal(false);
        alert('GEVI URL saved successfully!');
      } else {
        alert(`Failed to save GEVI URL: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving GEVI URL:', error);
      alert('Failed to save GEVI URL');
    } finally {
      setIsSavingGeviUrl(false);
    }
  };

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: notesInput
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setData(prevData => ({
          ...prevData,
          notes: notesInput
        }));
        setShowNotesModal(false);
        alert('Notes saved successfully!');
      } else {
        alert(`Failed to save notes: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleSaveScraper = async () => {
    setIsSavingScraper(true);

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          scraperName: selectedScraper || null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setData(prevData => ({
          ...prevData,
          scraperName: selectedScraper || null
        }));
        setShowScraperModal(false);
        alert('Scraper saved successfully!');
      } else {
        alert(`Failed to save scraper: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error saving scraper:', error);
      alert('Failed to save scraper');
    } finally {
      setIsSavingScraper(false);
    }
  };

  if (loading) return <div className="page pad">Loading studio...</div>;
  if (error) return <div className="page pad">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="page pad studio-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">← Stash</Link>
        <span> / </span>
        <Link to="/media/stash/studios">Studios</Link>
        <span> / </span>
        <span>{data.name}</span>
      </div>

      <div className="header">
        <div className="studio-header-detail">
          {data.image && (
            <div className="studio-image-large">
              <img src={data.image} alt={data.name} />
            </div>
          )}
          <div className="studio-info-header">
            <h1>🏢 {data.name}</h1>
            
            {data.aliases && data.aliases.length > 0 && (
              <div className="studio-aliases" style={{ 
                marginTop: '10px',
                marginBottom: '15px',
                padding: '10px',
                backgroundColor: '#f3f4f6',
                borderRadius: '6px',
                borderLeft: '3px solid #3b82f6'
              }}>
                <strong style={{ color: '#6b7280', fontSize: '14px' }}>🏷️ Aliases:</strong>
                <div style={{ 
                  marginTop: '6px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px'
                }}>
                  {data.aliases.map((alias, idx) => (
                    <span 
                      key={idx}
                      style={{
                        display: 'inline-block',
                        padding: '4px 10px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #d1d5db',
                        borderRadius: '4px',
                        fontSize: '13px',
                        color: '#374151'
                      }}
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {data.url && (
              <p>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="studio-link">
                  🔗 Visit Website
                </a>
              </p>
            )}
            {data.geviUrl && (
              <p>
                <a href={data.geviUrl} target="_blank" rel="noopener noreferrer" className="studio-link">
                  🌐 View on GEVI
                </a>
              </p>
            )}
            
            <button 
              onClick={() => {
                setGeviUrlInput(data?.geviUrl || '');
                setShowGeviUrlModal(true);
              }}
              className="btn-secondary"
              style={{ marginTop: '10px' }}
              title={data?.geviUrl ? "Update GEVI URL" : "Set GEVI URL"}
            >
              {data?.geviUrl ? '🔗 Update GEVI URL' : '🔗 Set GEVI URL'}
            </button>
            
            <button 
              onClick={() => {
                setNotesInput(data?.notes || '');
                setShowNotesModal(true);
              }}
              className="btn-secondary"
              style={{ marginTop: '10px', marginLeft: '10px' }}
              title={data?.notes ? "Edit Notes" : "Add Notes"}
            >
              {data?.notes ? '📝 Edit Notes' : '📝 Add Notes'}
            </button>
            
            <button 
              onClick={() => {
                setSelectedScraper(data?.scraperName || '');
                setShowScraperModal(true);
              }}
              className="btn-secondary"
              style={{ marginTop: '10px', marginLeft: '10px' }}
              title={data?.scraperName ? `Change Scraper (${data.scraperName})` : "Set Scraper"}
            >
              {data?.scraperName ? `🔧 Change Scraper (${data.scraperName})` : '🔧 Set Scraper'}
            </button>
            
            {data.notes && (
              <div className="studio-notes" style={{ 
                marginTop: '15px', 
                padding: '12px', 
                backgroundColor: '#f9fafb', 
                borderRadius: '6px',
                borderLeft: '3px solid #8b5cf6'
              }}>
                <strong style={{ color: '#6b7280' }}>📝 Notes:</strong>
                <p style={{ 
                  marginTop: '8px', 
                  whiteSpace: 'pre-wrap', 
                  color: '#374151',
                  lineHeight: '1.6'
                }}>
                  {data.notes}
                </p>
              </div>
            )}
            
            {data.details && <p className="studio-description">{data.details}</p>}
            
            <div className="studio-stats-detail">
              {data.scene_count > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{data.scene_count}</span>
                  <span className="stat-label">Scenes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scenes Section */}
      <div className="section">
        <h2>Scenes from this studio</h2>
        
        {/* Search and Filter Controls */}
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '15px', 
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          {/* Search Inputs */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="search-title" style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: '500' }}>
                🔍 Search by Title:
              </label>
              <input
                id="search-title"
                type="text"
                value={searchTitle}
                onChange={(e) => {
                  setSearchTitle(e.target.value);
                  setScenesPage(1); // Reset to page 1 when search changes
                }}
                placeholder="Enter scene title..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label htmlFor="search-performer" style={{ display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: '500' }}>
                👤 Search by Performer:
              </label>
              <input
                id="search-performer"
                type="text"
                value={searchPerformer}
                onChange={(e) => {
                  setSearchPerformer(e.target.value);
                  setScenesPage(1); // Reset to page 1 when search changes
                }}
                placeholder="Enter performer name..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
              />
            </div>
          </div>
          
          {/* Filter Checkbox */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filterNoPerformers}
                onChange={(e) => {
                  setFilterNoPerformers(e.target.checked);
                  setScenesPage(1); // Reset to page 1 when filter changes
                }}
                style={{ cursor: 'pointer' }}
              />
              <span>Show only scenes with no performers</span>
            </label>
            
            {/* Clear Filters Button */}
            {(searchTitle || searchPerformer || filterNoPerformers) && (
              <button
                onClick={() => {
                  setSearchTitle('');
                  setSearchPerformer('');
                  setFilterNoPerformers(false);
                  setScenesPage(1);
                }}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}
              >
                ✕ Clear Filters
              </button>
            )}
          </div>
        </div>
        
        {scenesLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading scenes...</p>
          </div>
        ) : (
          <>
            {/* Merge Button */}
            {selectedScenes.size >= 2 && (
              <div style={{ marginBottom: '20px' }}>
                <button
                  onClick={handleOpenSceneMergeModal}
                  style={{
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                    color: 'white',
                    border: '2px solid #8b5cf6',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '15px',
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
                  🔀 Merge {selectedScenes.size} Selected Scenes
                </button>
              </div>
            )}
            
            {/* Scenes with Checkboxes */}
            <div className="content-grid scenes-grid">
              {scenes.map((scene) => (
                <div
                  key={scene.id}
                  style={{
                    position: 'relative',
                    backgroundColor: selectedScenes.has(scene.id) ? '#f3f4f6' : 'transparent',
                    borderRadius: '8px',
                    padding: '4px',
                    transition: 'background-color 0.2s'
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
                      position: 'absolute',
                      top: '12px',
                      left: '12px',
                      width: '20px',
                      height: '20px',
                      cursor: 'pointer',
                      zIndex: 10,
                      backgroundColor: 'white',
                      border: '2px solid #8b5cf6',
                      borderRadius: '4px'
                    }}
                  />
                  <SceneCard scene={scene} />
                </div>
              ))}
            </div>
            
            {scenes.length === 0 && (
              <div className="empty-state">
                <p>No scenes found</p>
              </div>
            )}
            
            {/* Pagination Controls */}
            {scenesPagination.totalPages > 1 && (
              <div className="pagination-controls">
                <Button
                  onClick={() => setScenesPage(p => Math.max(1, p - 1))}
                  disabled={scenesPage === 1}
                  variant="secondary"
                >
                  ← Previous
                </Button>
                <span className="pagination-info">
                  Page {scenesPagination.page} of {scenesPagination.totalPages}
                  {scenesPagination.total > 0 && ` (${scenesPagination.total} total scenes)`}
                </span>
                <Button
                  onClick={() => setScenesPage(p => Math.min(scenesPagination.totalPages, p + 1))}
                  disabled={scenesPage >= scenesPagination.totalPages}
                  variant="secondary"
                >
                  Next →
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Set/Update GEVI URL Modal */}
      {showGeviUrlModal && (
        <div className="modal-overlay" onClick={() => setShowGeviUrlModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔗 {data?.geviUrl ? 'Update' : 'Set'} GEVI Studio URL</h3>
            
            <div className="scrape-input-section">
              <label htmlFor="gevi-url-input">GEVI Studio URL:</label>
              <input
                id="gevi-url-input"
                type="text"
                value={geviUrlInput}
                onChange={(e) => setGeviUrlInput(e.target.value)}
                placeholder="https://gayeroticvideoindex.com/studio/..."
                disabled={isSavingGeviUrl}
                className="scrape-url-input"
              />
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Enter the GEVI studio URL. This will be saved for quick reference.
              </p>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleSaveGeviUrl}
                disabled={isSavingGeviUrl || !geviUrlInput.trim()}
              >
                {isSavingGeviUrl ? '⏳ Saving...' : '💾 Save URL'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowGeviUrlModal(false)}
                disabled={isSavingGeviUrl}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes Modal */}
      {showNotesModal && (
        <div className="modal-overlay" onClick={() => setShowNotesModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>📝 {data?.notes ? 'Edit' : 'Add'} Studio Notes</h3>
            
            <div className="scrape-input-section">
              <label htmlFor="notes-input">Notes:</label>
              <textarea
                id="notes-input"
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Enter notes about this studio..."
                disabled={isSavingNotes}
                rows={8}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Add any notes or information about this studio (contracts, preferences, etc.)
              </p>
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
              >
                {isSavingNotes ? '⏳ Saving...' : '💾 Save Notes'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowNotesModal(false)}
                disabled={isSavingNotes}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scraper Selection Modal */}
      {showScraperModal && (
        <div className="modal-overlay" onClick={() => setShowScraperModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🔧 {data?.scraperName ? 'Change' : 'Set'} Studio Scraper</h3>
            
            <div className="scrape-input-section">
              <label htmlFor="scraper-select">Scraper:</label>
              <select
                id="scraper-select"
                value={selectedScraper}
                onChange={(e) => setSelectedScraper(e.target.value)}
                disabled={isSavingScraper}
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">-- No Scraper --</option>
                {availableScrapers.map(scraper => (
                  <option key={scraper.name} value={scraper.name}>
                    {scraper.name} {scraper.supportsSceneSearch ? '(Scene Search ✓)' : ''}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                Assign a YAML scraper to this studio. Scenes from this studio will have scraping options for the selected scraper.
              </p>
              {selectedScraper && availableScrapers.find(s => s.name === selectedScraper)?.supportsSceneSearch && (
                <p style={{ fontSize: '0.9rem', color: '#059669', marginTop: '0.5rem', fontWeight: '500' }}>
                  ✓ This scraper supports scene searching by performers
                </p>
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleSaveScraper}
                disabled={isSavingScraper}
              >
                {isSavingScraper ? '⏳ Saving...' : '💾 Save Scraper'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowScraperModal(false)}
                disabled={isSavingScraper}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scene Merge Modal */}
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
