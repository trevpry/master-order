import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';

export default function ClipsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [clips, setClips] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [tagFilter, setTagFilter] = useState([]);
  const [clipTags, setClipTags] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    hasMore: false,
    perPage: 24
  });

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadClipTags();
  }, []);

  useEffect(() => {
    loadClips();
  }, [currentPage, searchQuery, tagFilter]);

  const loadClipTags = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips/tags`);
      const result = await response.json();
      if (result.success) {
        setClipTags(result.data || []);
      }
    } catch (err) {
      console.error('Error loading clip tags:', err);
    }
  };

  const loadClips = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', pagination.perPage);
      params.set('sortBy', 'createdAt');
      params.set('sortDirection', 'desc');
      if (searchQuery) params.set('filter', searchQuery);
      if (tagFilter.length > 0) params.set('tags', tagFilter.join(','));

      const response = await fetch(`${config.apiBaseUrl}/api/stash/clips?${params}`);
      const result = await response.json();

      if (result.success) {
        setClips(result.data || []);
        setPagination({
          page: currentPage,
          total: result.total || 0,
          totalPages: result.totalPages || 1,
          hasMore: result.hasMore || false,
          perPage: 24
        });
      } else {
        setError(result.error || 'Failed to load clips');
      }
    } catch (err) {
      console.error('Error loading clips:', err);
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

  const addTagFilter = (tagId) => {
    if (!tagFilter.includes(tagId)) {
      setTagFilter([...tagFilter, tagId]);
    }
  };

  const removeTagFilter = (tagId) => {
    setTagFilter(tagFilter.filter(id => id !== tagId));
  };

  const clearTagFilter = () => {
    setTagFilter([]);
  };

  return (
    <div className="page pad clips-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🎞️ Clips</h1>
        <p className="muted">Browse your clip library</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="search-section">
        <input
          type="text"
          placeholder="Search clips..."
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

      {/* Tag Filter */}
      <div className="tag-filter-section">
        <div className="tag-filter-header">
          <h4>🏷️ Filter by Tags</h4>
          {tagFilter.length > 0 && (
            <button 
              className="clear-tag-filter-btn"
              onClick={clearTagFilter}
            >
              Clear all ({tagFilter.length})
            </button>
          )}
        </div>
        <div className="tag-filter-list">
          {clipTags.map(tag => (
            <button
              key={tag.id}
              className={`tag-filter-item ${tagFilter.includes(tag.id) ? 'active' : ''}`}
              onClick={() => {
                if (tagFilter.includes(tag.id)) {
                  removeTagFilter(tag.id);
                } else {
                  addTagFilter(tag.id);
                }
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
          <Button onClick={loadClips}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading clips...</p>
        </div>
      )}

      {/* Clips Grid */}
      {!isLoading && !error && (
        <>
          <div className="clips-grid">
            {clips.length === 0 ? (
              <div className="empty-state">
                <p>No clips found</p>
              </div>
            ) : (
              clips.map(clip => (
                <Link 
                  key={clip.id} 
                  to={`/media/stash/clips/${clip.id}`}
                  className="clip-card"
                >
                  <div className="clip-card-body">
                    <div className="title">{clip.name || 'Untitled Clip'}</div>
                    {clip.tags && clip.tags.length > 0 && (
                      <div className="clip-tags">
                        {clip.tags.map(tag => (
                          <span key={tag.id} className="clip-tag-badge">{tag.name}</span>
                        ))}
                      </div>
                    )}
                    <div className="clip-meta">
                      {clip.sceneTitle && <span>🎬 {clip.sceneTitle}</span>}
                      {clip.duration && <span>⏱️ {Math.floor(clip.duration)}s</span>}
                    </div>
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
