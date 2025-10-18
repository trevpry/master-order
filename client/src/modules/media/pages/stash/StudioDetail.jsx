import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
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
  
  // GEVI URL state
  const [showGeviUrlModal, setShowGeviUrlModal] = useState(false);
  const [geviUrlInput, setGeviUrlInput] = useState('');
  const [isSavingGeviUrl, setIsSavingGeviUrl] = useState(false);
  
  // Notes state
  const [showNotesModal, setShowNotesModal] = useState(false);
  const [notesInput, setNotesInput] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

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

  // Load scenes when data is available or filter changes
  useEffect(() => {
    if (data) {
      loadScenes();
    }
  }, [scenesPage, data, filterNoPerformers]);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Scenes from this studio</h2>
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
        </div>
        {scenesLoading ? (
          <div className="loading">
            <div className="spinner"></div>
            <p>Loading scenes...</p>
          </div>
        ) : (
          <>
            <SceneGrid scenes={scenes} />
            
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
    </div>
  );
}
