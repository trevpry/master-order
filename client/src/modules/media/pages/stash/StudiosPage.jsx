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

  return (
    <div className="page pad studios-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🏢 Studios</h1>
        <p className="muted">Browse your studio library</p>
      </div>

      {/* Search */}
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
                <Link 
                  key={studio.id} 
                  to={`/media/stash/studios/${studio.id}`}
                  className="studio-card"
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
    </div>
  );
}
