import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
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
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 20
  });

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadScenes();
  }, [currentPage, searchQuery, sortBy, sortDirection, watchStatusFilter]);

  const loadScenes = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', pagination.perPage);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortDirection);
      if (searchQuery) params.set('search', searchQuery);
      if (watchStatusFilter !== 'all') params.set('watched', watchStatusFilter);

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
    if (updates.sort || sortBy !== 'date') params.sort = updates.sort || sortBy;
    if (updates.direction || sortDirection !== 'DESC') params.direction = updates.direction || sortDirection;
    if (updates.watched || watchStatusFilter !== 'all') params.watched = updates.watched || watchStatusFilter;
    setSearchParams(params);
  };

  const goToPage = (page) => {
    updateParams({ page: page.toString() });
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
            <option value="title">Title</option>
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
      </div>

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
          <SceneGrid scenes={scenes} onSceneClick={setSelectedScene} />

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
