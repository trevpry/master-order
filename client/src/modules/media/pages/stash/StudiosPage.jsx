import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';

export default function StudiosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [studios, setStudios] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 24
  });

  // Studio merge state
  const [selectedStudios, setSelectedStudios] = useState(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [studiosToMerge, setStudiosToMerge] = useState([]);
  const [primaryStudioId, setPrimaryStudioId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  // Create studio state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStudioData, setCreateStudioData] = useState({
    name: '',
    url: '',
    aliases: ''
  });
  const [isCreating, setIsCreating] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadStudios();
  }, [currentPage, searchQuery]);

  const loadStudios = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', pagination.perPage);
      if (searchQuery) params.set('filter', searchQuery);

      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios?${params}`);
      const result = await response.json();

      if (result.success) {
        setStudios(result.data || []);
        setPagination({
          page: currentPage,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 1,
          hasMore: false,
          perPage: 24
        });
      } else {
        setError(result.error || 'Failed to load studios');
      }
    } catch (err) {
      console.error('Error loading studios:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = { page: '1' };
    if (searchQuery) params.search = searchQuery;
    setSearchParams(params);
  };

  const goToPage = (page) => {
    const params = { page: page.toString() };
    if (searchQuery) params.search = searchQuery;
    setSearchParams(params);
  };

  // Handle studio checkbox toggle
  const handleToggleStudio = (studioId) => {
    setSelectedStudios(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studioId)) {
        newSet.delete(studioId);
      } else {
        newSet.add(studioId);
      }
      return newSet;
    });
  };

  // Handle opening merge modal
  const handleOpenMergeModal = () => {
    if (selectedStudios.size < 2) {
      alert('Please select at least 2 studios to merge');
      return;
    }

    // Get studio details from current studios list
    const selectedStudiosList = studios.filter(s => selectedStudios.has(s.id));
    setStudiosToMerge(selectedStudiosList);
    setPrimaryStudioId(selectedStudiosList[0].id);
    setShowMergeModal(true);
  };

  // Handle merge execution
  const handleMergeStudios = async () => {
    if (!primaryStudioId) {
      alert('Please select a primary studio');
      return;
    }

    const primaryStudio = studiosToMerge.find(s => s.id === primaryStudioId);
    const otherStudios = studiosToMerge.filter(s => s.id !== primaryStudioId);

    const confirmMessage = 
      `Merge ${studiosToMerge.length} studios?\n\n` +
      `Primary studio (will be kept): ${primaryStudio.name}\n` +
      `Studios to delete: ${otherStudios.map(s => s.name).join(', ')}\n\n` +
      `All scenes from deleted studios will be transferred to "${primaryStudio.name}".\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryStudioId: primaryStudioId,
          mergeStudioIds: otherStudios.map(s => s.id)
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge studios');
      }

      alert(`✅ Successfully merged ${result.data.mergedCount} studios! Transferred ${result.data.transferredScenes} scenes.`);

      setShowMergeModal(false);
      setSelectedStudios(new Set());
      setPrimaryStudioId('');
      setStudiosToMerge([]);

      // Reload studios
      loadStudios();
    } catch (error) {
      console.error('Failed to merge studios:', error);
      alert(`Failed to merge studios: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  // Handle create studio
  const handleCreateStudio = async (e) => {
    e.preventDefault();
    
    if (!createStudioData.name.trim()) {
      alert('Please enter a studio name');
      return;
    }

    setIsCreating(true);
    try {
      const payload = {
        name: createStudioData.name.trim(),
        url: createStudioData.url.trim() || null,
        aliases: createStudioData.aliases.trim() 
          ? createStudioData.aliases.split(',').map(a => a.trim()).filter(Boolean)
          : []
      };

      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create studio');
      }

      if (result.data.wasExisting) {
        alert(`ℹ️ Studio "${createStudioData.name}" already exists in your library.`);
      } else {
        alert(`✅ Successfully created studio "${createStudioData.name}"!`);
      }

      // Reset form and close modal
      setCreateStudioData({ name: '', url: '', aliases: '' });
      setShowCreateModal(false);

      // Reload studios
      loadStudios();
    } catch (error) {
      console.error('Failed to create studio:', error);
      alert(`Failed to create studio: ${error.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="page pad studios-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🏢 Studios</h1>
        <p className="muted">Browse your studio library</p>
      </div>

      {/* Action Buttons */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
        <Button onClick={() => setShowCreateModal(true)} className="primary">
          ➕ Add New Studio
        </Button>
      </div>

      {/* Search and Merge Controls */}
      <div style={{ marginBottom: '1rem' }}>
        <form onSubmit={handleSearch} className="search-section">
          <input
            type="text"
            placeholder="Search studios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          <Button type="submit">Search</Button>
          {searchQuery && (
            <Button onClick={() => {
              setSearchQuery('');
              setSearchParams({ page: '1' });
            }}>
              Clear
            </Button>
          )}
        </form>

        {/* Merge Controls */}
        {selectedStudios.size > 0 && (
          <div style={{ 
            marginTop: '1rem', 
            padding: '1rem', 
            backgroundColor: '#dbeafe', 
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: '600' }}>
              {selectedStudios.size} studio{selectedStudios.size !== 1 ? 's' : ''} selected
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button onClick={() => setSelectedStudios(new Set())}>
                Clear Selection
              </Button>
              {selectedStudios.size >= 2 && (
                <Button onClick={handleOpenMergeModal}>
                  🔀 Merge Studios
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={loadStudios}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading studios...</p>
        </div>
      )}

      {/* Studios Grid */}
      {!isLoading && !error && (
        <>
          <div className="studios-grid">
            {studios.length === 0 ? (
              <div className="empty-state">
                <p>No studios found</p>
              </div>
            ) : (
              studios.map(studio => (
                <div 
                  key={studio.id}
                  className={`studio-card ${selectedStudios.has(studio.id) ? 'selected' : ''}`}
                  style={{ position: 'relative' }}
                >
                  {/* Checkbox for selection */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      width: '20px',
                      height: '20px',
                      zIndex: 10
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleToggleStudio(studio.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStudios.has(studio.id)}
                      onChange={() => {}}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer',
                        pointerEvents: 'none'
                      }}
                    />
                  </div>
                  
                  <Link 
                    to={`/media/stash/studios/${studio.id}`}
                    style={{ 
                      display: 'block',
                      textDecoration: 'none',
                      color: 'inherit'
                    }}
                  >
                    {studio.image && (
                      <div className="studio-image">
                        <img src={studio.image} alt={studio.name} />
                      </div>
                    )}
                    <div className="studio-card-body">
                      <div className="title">{studio.name}</div>
                      {studio.scene_count > 0 && (
                        <div className="studio-meta">
                          🎬 {studio.scene_count} scenes
                        </div>
                      )}
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <Button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </Button>
              <span className="page-info">
                Page {currentPage} of {pagination.totalPages} ({pagination.total} total)
              </span>
              <Button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
              >
                Next →
              </Button>
            </div>
          )}
        </>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <h3>🔀 Merge {studiosToMerge.length} Studios</h3>
            
            <p style={{ fontSize: '0.9rem', color: '#666', marginBottom: '1.5rem' }}>
              Select which studio to keep as the primary. All scenes from other studios will be transferred to it, 
              and the other studios will be deleted.
            </p>

            {/* Primary Studio Selection */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                Primary Studio (will be kept):
              </label>
              <select
                value={primaryStudioId}
                onChange={(e) => setPrimaryStudioId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px'
                }}
                disabled={isMerging}
              >
                {studiosToMerge.map(studio => (
                  <option key={studio.id} value={studio.id}>
                    {studio.name} ({studio.scene_count || 0} scenes)
                  </option>
                ))}
              </select>
            </div>

            {/* Studios to Delete */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px', color: '#dc2626' }}>
                Studios to Delete:
              </label>
              <ul style={{ 
                listStyle: 'none', 
                padding: 0, 
                margin: 0,
                fontSize: '14px'
              }}>
                {studiosToMerge
                  .filter(s => s.id !== primaryStudioId)
                  .map(studio => (
                    <li 
                      key={studio.id}
                      style={{
                        padding: '8px',
                        marginBottom: '4px',
                        backgroundColor: '#fee2e2',
                        borderRadius: '6px'
                      }}
                    >
                      {studio.name} ({studio.scene_count || 0} scenes)
                    </li>
                  ))
                }
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleMergeStudios}
                disabled={isMerging}
                style={{ 
                  backgroundColor: '#dc2626',
                  color: 'white'
                }}
              >
                {isMerging ? 'Merging...' : 'Merge Studios'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Studio Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <h3>➕ Add New Studio</h3>
            
            <form onSubmit={handleCreateStudio}>
              {/* Studio Name */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Studio Name <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="text"
                  value={createStudioData.name}
                  onChange={(e) => setCreateStudioData({ ...createStudioData, name: e.target.value })}
                  placeholder="Enter studio name..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  disabled={isCreating}
                  autoFocus
                  required
                />
              </div>

              {/* Studio URL */}
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Website URL <span style={{ fontSize: '12px', fontWeight: '400', color: '#666' }}>(optional)</span>
                </label>
                <input
                  type="url"
                  value={createStudioData.url}
                  onChange={(e) => setCreateStudioData({ ...createStudioData, url: e.target.value })}
                  placeholder="https://..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  disabled={isCreating}
                />
              </div>

              {/* Studio Aliases */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Aliases <span style={{ fontSize: '12px', fontWeight: '400', color: '#666' }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={createStudioData.aliases}
                  onChange={(e) => setCreateStudioData({ ...createStudioData, aliases: e.target.value })}
                  placeholder="Alias 1, Alias 2, Alias 3..."
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                  disabled={isCreating}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                  Separate multiple aliases with commas
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <Button 
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateStudioData({ name: '', url: '', aliases: '' });
                  }}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isCreating || !createStudioData.name.trim()}
                  className="primary"
                >
                  {isCreating ? 'Creating...' : 'Create Studio'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
