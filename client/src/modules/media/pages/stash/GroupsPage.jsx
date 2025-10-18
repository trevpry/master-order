import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';

export default function GroupsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'name');
  const [sortDirection, setSortDirection] = useState(searchParams.get('direction') || 'ASC');
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 50
  });

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadGroups();
  }, [currentPage, searchQuery, sortBy, sortDirection]);

  const loadGroups = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('limit', pagination.perPage);
      params.set('sortBy', sortBy);
      params.set('sortOrder', sortDirection);
      if (searchQuery) params.set('search', searchQuery);

      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups?${params}`);
      const result = await response.json();

      if (result.success) {
        setGroups(result.data.groups || []);
        setPagination({
          page: result.data.page || currentPage,
          total: result.data.total || 0,
          totalPages: result.data.totalPages || 1,
          hasMore: (result.data.page || currentPage) < (result.data.totalPages || 1),
          perPage: result.data.limit || 50
        });
      } else {
        setError(result.error || 'Failed to load groups');
      }
    } catch (err) {
      console.error('Error loading groups:', err);
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
    if (updates.sort || sortBy !== 'name') params.sort = updates.sort || sortBy;
    if (updates.direction || sortDirection !== 'ASC') params.direction = updates.direction || sortDirection;
    setSearchParams(params);
  };

  const goToPage = (page) => {
    updateParams({ page: page.toString() });
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const mins = Math.round(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  };

  return (
    <div className="page pad groups-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🎬 Groups (Movies)</h1>
        <p className="muted">Browse your movie/series collections</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="search-section">
        <input
          type="text"
          placeholder="Search groups by name, director, or synopsis..."
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
            <option value="name">Name</option>
            <option value="date">Date</option>
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
            <option value="ASC">Ascending</option>
            <option value="DESC">Descending</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={loadGroups}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading groups...</p>
        </div>
      )}

      {/* Groups Grid */}
      {!isLoading && !error && (
        <>
          {groups.length === 0 ? (
            <div className="empty-state">
              <p>No groups found</p>
              {searchQuery && <p>Try adjusting your search</p>}
            </div>
          ) : (
            <div className="groups-grid">
              {groups.map(group => (
                <div 
                  key={group.id} 
                  className="group-card"
                  onClick={() => navigate(`/media/stash/groups/${group.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  {group.frontImage ? (
                    <img 
                      src={group.frontImage} 
                      alt={group.name}
                      className="group-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : (
                    <div className="group-cover-placeholder" style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontSize: '3rem'
                    }}>
                      🎬
                    </div>
                  )}
                  
                  <div className="group-info">
                    <h3 className="group-title">{group.name}</h3>
                    
                    <div className="group-meta">
                      {group.studio && (
                        <span className="meta-item">🏢 {group.studio.name}</span>
                      )}
                      {group.date && (
                        <span className="meta-item">📅 {group.date}</span>
                      )}
                      {group.duration && (
                        <span className="meta-item">⏱️ {formatDuration(group.duration)}</span>
                      )}
                      {group.rating && (
                        <span className="meta-item">⭐ {group.rating}/100</span>
                      )}
                    </div>
                    
                    <div className="group-scenes">
                      <span className="scenes-count">
                        {group.scenes?.length || 0} scene{group.scenes?.length !== 1 ? 's' : ''}
                      </span>
                      {group.tags && group.tags.length > 0 && (
                        <span className="tags-count">
                          {group.tags.length} tag{group.tags.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    {group.director && (
                      <div className="group-director">
                        <span className="muted">Director: {group.director}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

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
                  
                  if (endPage - startPage < maxVisible - 1) {
                    startPage = Math.max(1, endPage - maxVisible + 1);
                  }
                  
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
                {pagination.total} total groups
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

      <style jsx>{`
        .groups-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .group-card {
          background: white;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .group-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .group-cover, .group-cover-placeholder {
          width: 100%;
          aspect-ratio: 2/3;
          object-fit: cover;
        }

        .group-info {
          padding: 1rem;
        }

        .group-title {
          margin: 0 0 0.5rem 0;
          font-size: 1.1rem;
          font-weight: 600;
          color: #1a202c;
          line-height: 1.3;
        }

        .group-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .meta-item {
          font-size: 0.85rem;
          color: #4a5568;
          white-space: nowrap;
        }

        .group-scenes {
          display: flex;
          gap: 1rem;
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid #e2e8f0;
        }

        .scenes-count, .tags-count {
          font-size: 0.9rem;
          color: #667eea;
          font-weight: 500;
        }

        .group-director {
          margin-top: 0.5rem;
          font-size: 0.85rem;
        }

        .empty-state {
          text-align: center;
          padding: 3rem;
          color: #718096;
        }

        .search-section {
          display: flex;
          gap: 0.5rem;
          margin: 1.5rem 0;
        }

        .search-input {
          flex: 1;
          padding: 0.5rem 1rem;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          font-size: 1rem;
        }

        .filter-section {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-group label {
          font-weight: 500;
          color: #4a5568;
        }

        .filter-group select {
          padding: 0.4rem 0.8rem;
          border: 1px solid #cbd5e0;
          border-radius: 4px;
          background: white;
          cursor: pointer;
        }

        .pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          margin-top: 2rem;
          flex-wrap: wrap;
        }

        .page-numbers {
          display: flex;
          gap: 0.25rem;
        }

        .page-number {
          padding: 0.4rem 0.8rem;
          border: 1px solid #cbd5e0;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .page-number:hover {
          background: #f7fafc;
          border-color: #667eea;
        }

        .page-number.active {
          background: #667eea;
          color: white;
          border-color: #667eea;
        }

        .page-ellipsis {
          padding: 0.4rem 0.8rem;
          color: #a0aec0;
        }

        .page-info {
          color: #718096;
          font-size: 0.9rem;
          padding: 0 0.5rem;
        }
      `}</style>
    </div>
  );
}
