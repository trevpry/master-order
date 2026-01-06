import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
import config from '../../../../config';

export default function ScenesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [scenes, setScenes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedScene, setSelectedScene] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'date');
  const [sortDirection, setSortDirection] = useState(searchParams.get('direction') || 'DESC');
  const [watchStatusFilter, setWatchStatusFilter] = useState(searchParams.get('watched') || 'all');
  const [timeFilter, setTimeFilter] = useState(searchParams.get('time') || 'all');
  const [identificationFilter, setIdentificationFilter] = useState(searchParams.get('identification') || 'all');
  const [studioFilter, setStudioFilter] = useState(searchParams.get('studio') || 'all');
  const [selectedScenes, setSelectedScenes] = useState([]);
  const [bulkIdentification, setBulkIdentification] = useState('Not Identified');
  const [bulkStudioId, setBulkStudioId] = useState('');
  const [studios, setStudios] = useState([]);
  const [perPage, setPerPage] = useState(parseInt(searchParams.get('perPage') || '20', 10));
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 20
  });

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Initialize URL params on mount if they're missing
  useEffect(() => {
    const hasSort = searchParams.has('sort');
    const hasDirection = searchParams.has('direction');
    const hasPerPage = searchParams.has('perPage');
    
    if (!hasSort || !hasDirection || !hasPerPage) {
      const params = Object.fromEntries(searchParams);
      if (!hasSort) params.sort = sortBy;
      if (!hasDirection) params.direction = sortDirection;
      if (!hasPerPage) params.perPage = perPage.toString();
      setSearchParams(params, { replace: true });
    }
  }, []);

  useEffect(() => {
    loadScenes();
  }, [currentPage, searchQuery, sortBy, sortDirection, watchStatusFilter, timeFilter, identificationFilter, studioFilter, perPage]);

  useEffect(() => {
    loadStudios();
  }, []);

  const loadStudios = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/studios?perPage=999999`);
      const result = await response.json();
      if (result.success) {
        setStudios(result.data || []);
      }
    } catch (err) {
      console.error('Error loading studios:', err);
    }
  };

  const loadScenes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', perPage);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortDirection);
      if (searchQuery) params.set('search', searchQuery);
      if (watchStatusFilter !== 'all') params.set('watched', watchStatusFilter);
      if (timeFilter !== 'all') params.set('time', timeFilter);
      if (identificationFilter !== 'all') params.set('identification', identificationFilter);
      if (studioFilter !== 'all') params.set('studio', studioFilter);

      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes?${params}`);
      const result = await response.json();

      if (result.success) {
        setScenes(result.data || []);
        setPagination({
          page: result.pagination?.page || currentPage,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 1,
          hasMore: (result.pagination?.page || currentPage) < (result.pagination?.totalPages || 1),
          perPage: result.pagination?.perPage || 20
        });
      } else {
        setError(result.error || 'Failed to load scenes');
      }
    } catch (err) {
      console.error('Error loading scenes:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    updateParams({ page: '1', search: searchQuery });
  };

  const updateParams = (updates) => {
    const params = {};
    if (updates.page) params.page = updates.page;
    if (updates.search !== undefined) {
      if (updates.search) params.search = updates.search;
    } else if (searchQuery) {
      params.search = searchQuery;
    }
    // Always include sort and direction to persist sorting
    params.sort = updates.sort || sortBy;
    params.direction = updates.direction || sortDirection;
    if (updates.watched || watchStatusFilter !== 'all') params.watched = updates.watched || watchStatusFilter;
    if (updates.time || timeFilter !== 'all') params.time = updates.time || timeFilter;
    if (updates.identification || identificationFilter !== 'all') params.identification = updates.identification || identificationFilter;
    if (updates.studio || studioFilter !== 'all') params.studio = updates.studio || studioFilter;
    if (updates.perPage || perPage !== 20) params.perPage = updates.perPage || perPage;
    setSearchParams(params);
  };

  const goToPage = (page) => {
    updateParams({ page: page.toString() });
  };

  const handlePerPageChange = (newPerPage) => {
    setPerPage(newPerPage);
    updateParams({ page: '1', perPage: newPerPage.toString() });
  };

  const toggleSceneSelection = (sceneId) => {
    setSelectedScenes(prev => 
      prev.includes(sceneId) 
        ? prev.filter(id => id !== sceneId)
        : [...prev, sceneId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedScenes.length === scenes.length) {
      setSelectedScenes([]);
    } else {
      setSelectedScenes(scenes.map(s => s.id));
    }
  };

  const handleBulkIdentificationUpdate = async () => {
    if (selectedScenes.length === 0) {
      alert('Please select at least one scene');
      return;
    }

    if (!confirm(`Update ${selectedScenes.length} scene(s) to "${bulkIdentification}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/bulk-identification`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIds: selectedScenes,
          identification: bulkIdentification
        })
      });

      const result = await response.json();

      if (result.success) {
        setSelectedScenes([]);
        loadScenes(); // Reload to show updated data
      } else {
        console.error('Bulk identification update error:', result.error);
      }
    } catch (error) {
      console.error('Bulk identification update error:', error);
    }
  };

  const handleBulkStudioUpdate = async () => {
    if (selectedScenes.length === 0) {
      alert('Please select at least one scene');
      return;
    }

    if (!bulkStudioId) {
      alert('Please select a studio');
      return;
    }

    const selectedStudio = studios.find(s => s.id === bulkStudioId);
    if (!selectedStudio) {
      alert('Invalid studio selected');
      return;
    }

    if (!confirm(`Add studio "${selectedStudio.name}" to ${selectedScenes.length} scene(s)?`)) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/bulk-studio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIds: selectedScenes,
          studioId: bulkStudioId
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`Successfully updated ${selectedScenes.length} scene(s)`, {
          duration: 3000,
          position: 'bottom-right'
        });
        setSelectedScenes([]);
        setBulkStudioId('');
        loadScenes(); // Reload to show updated data
      } else {
        toast.error(result.error || 'Failed to update scenes', {
          duration: 5000,
          position: 'bottom-right'
        });
      }
    } catch (error) {
      console.error('Bulk studio update error:', error);
      alert(`Error: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedScenes.length === 0) {
      alert('Please select at least one scene');
      return;
    }

    const confirmMessage = `⚠️ WARNING: You are about to delete ${selectedScenes.length} scene(s).\n\nThis will:\n• Delete the scenes from the local database\n• Delete the scenes from Stash\n• Delete the video files from disk\n• Delete all associated clips\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes/bulk-delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneIds: selectedScenes,
          deleteFile: true,
          deleteGenerated: true
        })
      });

      const result = await response.json();

      if (result.success) {
        const successCount = result.results?.filter(r => r.success).length || 0;
        const failCount = result.results?.filter(r => !r.success).length || 0;
        
        if (failCount > 0) {
          toast.error(`Partially completed: Deleted ${successCount}, Failed ${failCount}. Check console for details.`, {
            duration: 6000,
            position: 'bottom-right'
          });
          console.error('Failed deletions:', result.results.filter(r => !r.success));
        } else {
          toast.success(`Successfully deleted ${successCount} scene(s)`, {
            duration: 4000,
            position: 'bottom-right'
          });
        }
        
        setSelectedScenes([]);
        loadScenes(); // Reload to show updated list
      } else {
        toast.error(result.error || 'Failed to delete scenes', {
          duration: 5000,
          position: 'bottom-right'
        });
      }
    } catch (error) {
      console.error('Bulk delete error:', error);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="page pad scenes-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🎬 Scenes</h1>
        <p className="muted">Browse your scene library</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="search-section">
        <input
          type="text"
          placeholder="Search scenes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        <Button type="submit">Search</Button>
        {searchQuery && (
          <Button onClick={() => {
            setSearchQuery('');
            updateParams({ page: '1', search: '' });
          }}>
            Clear
          </Button>
        )}
      </form>

      {/* Filters */}
      <div className="filter-section">
        <div className="filter-group">
          <label>Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              updateParams({ sort: e.target.value, page: '1' });
            }}
          >
            <option value="date">Date</option>
            <option value="created">Created Date</option>
            <option value="title">Title</option>
            <option value="filename">File Name</option>
            <option value="rating">Rating</option>
            <option value="duration">Duration</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Direction:</label>
          <select
            value={sortDirection}
            onChange={(e) => {
              setSortDirection(e.target.value);
              updateParams({ direction: e.target.value, page: '1' });
            }}
          >
            <option value="DESC">Descending</option>
            <option value="ASC">Ascending</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Watch Status:</label>
          <select
            value={watchStatusFilter}
            onChange={(e) => {
              setWatchStatusFilter(e.target.value);
              updateParams({ watched: e.target.value, page: '1' });
            }}
          >
            <option value="all">All</option>
            <option value="true">Watched</option>
            <option value="false">Unwatched</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Added:</label>
          <select
            value={timeFilter}
            onChange={(e) => {
              setTimeFilter(e.target.value);
              updateParams({ time: e.target.value, page: '1' });
            }}
          >
            <option value="all">All Time</option>
            <option value="1h">Past Hour</option>
            <option value="6h">Past 6 Hours</option>
            <option value="12h">Past 12 Hours</option>
            <option value="24h">Past 24 Hours</option>
            <option value="48h">Past 48 Hours</option>
            <option value="7d">Past Week</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Identification:</label>
          <select
            value={identificationFilter}
            onChange={(e) => {
              setIdentificationFilter(e.target.value);
              updateParams({ identification: e.target.value, page: '1' });
            }}
          >
            <option value="all">All Scenes</option>
            <option value="null">All Scenes - No Identification</option>
            <option value="Not Identified">Not Identified</option>
            <option value="Identified">Identified</option>
            <option value="Identified and Scraped">Identified and Scraped</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Studio:</label>
          <select
            value={studioFilter}
            onChange={(e) => {
              setStudioFilter(e.target.value);
              updateParams({ studio: e.target.value, page: '1' });
            }}
          >
            <option value="all">All Scenes</option>
            <option value="with">With Studio</option>
            <option value="without">Without Studio</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Per Page:</label>
          <select
            value={perPage}
            onChange={(e) => handlePerPageChange(parseInt(e.target.value, 10))}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="30">30</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {/* Bulk Operations */}
      {scenes.length > 0 && (
        <div className="bulk-operations" style={{ 
          padding: '1rem', 
          marginTop: '1rem', 
          backgroundColor: '#2a2a2a', 
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexWrap: 'wrap'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedScenes.length === scenes.length && scenes.length > 0}
              onChange={toggleSelectAll}
            />
            <span>Select All ({selectedScenes.length} selected)</span>
          </label>
          
          {selectedScenes.length > 0 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>Set Identification:</label>
                <select
                  value={bulkIdentification}
                  onChange={(e) => setBulkIdentification(e.target.value)}
                  style={{ padding: '0.5rem' }}
                >
                  <option value="Not Identified">Not Identified</option>
                  <option value="Identified">Identified</option>
                  <option value="Identified and Scraped">Identified and Scraped</option>
                </select>
                <Button onClick={handleBulkIdentificationUpdate}>
                  Update {selectedScenes.length} Scene(s)
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label>Add Studio:</label>
                <select
                  value={bulkStudioId}
                  onChange={(e) => setBulkStudioId(e.target.value)}
                  style={{ padding: '0.5rem', minWidth: '200px' }}
                >
                  <option value="">-- Select Studio --</option>
                  {studios.map(studio => (
                    <option key={studio.id} value={studio.id}>
                      {studio.name}
                    </option>
                  ))}
                </select>
                <Button 
                  onClick={handleBulkStudioUpdate}
                  disabled={!bulkStudioId}
                >
                  Add to {selectedScenes.length} Scene(s)
                </Button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                <Button 
                  onClick={handleBulkDelete}
                  style={{ 
                    backgroundColor: '#dc2626',
                    borderColor: '#dc2626'
                  }}
                  onMouseOver={(e) => e.target.style.backgroundColor = '#b91c1c'}
                  onMouseOut={(e) => e.target.style.backgroundColor = '#dc2626'}
                >
                  🗑️ Delete {selectedScenes.length} Scene(s)
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={loadScenes}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading scenes...</p>
        </div>
      )}

      {/* Scenes Grid */}
      {!isLoading && !error && (
        <>
          <SceneGrid 
            scenes={scenes} 
            onSceneClick={setSelectedScene}
            selectedScenes={selectedScenes}
            onToggleSelect={toggleSceneSelection}
            searchParams={searchParams}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <Button 
                onClick={() => goToPage(1)}
                disabled={currentPage === 1}
                title="First page"
              >
                ⏮ First
              </Button>
              <Button 
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Previous
              </Button>
              
              {/* Page numbers */}
              <div className="page-numbers">
                {(() => {
                  const pages = [];
                  const maxVisible = 7;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
                  let endPage = Math.min(pagination.totalPages, startPage + maxVisible - 1);
                  
                  // Adjust start if we're near the end
                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                  
                  // Add first page and ellipsis if needed
                  if (startPage > 1) {
                    pages.push(
                      <button
                        key={1}
                        className="page-number"
                        onClick={() => goToPage(1)}
                      >
                        1
                      </button>
                    );
                    if (startPage > 2) {
                      pages.push(<span key="ellipsis-start" className="page-ellipsis">...</span>);
                    }
                  }
                  
                  // Add page numbers
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        className={`page-number ${i === currentPage ? 'active' : ''}`}
                        onClick={() => goToPage(i)}
                      >
                        {i}
                      </button>
                    );
                  }
                  
                  // Add ellipsis and last page if needed
                  if (endPage < pagination.totalPages) {
                    if (endPage < pagination.totalPages - 1) {
                      pages.push(<span key="ellipsis-end" className="page-ellipsis">...</span>);
                    }
                    pages.push(
                      <button
                        key={pagination.totalPages}
                        className="page-number"
                        onClick={() => goToPage(pagination.totalPages)}
                      >
                        {pagination.totalPages}
                      </button>
                    );
                  }
                  
                  return pages;
                })()}
              </div>
              
              <span className="page-info">
                {pagination.total} total scenes
              </span>
              <Button 
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= pagination.totalPages}
              >
                Next →
              </Button>
              <Button 
                onClick={() => goToPage(pagination.totalPages)}
                disabled={currentPage === pagination.totalPages}
                title="Last page"
              >
                Last ⏭
              </Button>
            </div>
          )}
        </>
      )}

      {/* Scene Modal Placeholder - Would need full modal implementation */}
      {selectedScene && (
        <div className="modal-overlay" onClick={() => setSelectedScene(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{selectedScene.title || 'Scene'}</h2>
            <p>Scene playback modal would go here</p>
            <Button onClick={() => setSelectedScene(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
}
