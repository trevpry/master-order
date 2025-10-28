import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';

export default function TagsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tags, setTags] = useState([]);
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
  const [expandedTags, setExpandedTags] = useState(new Set());

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadTags();
  }, [currentPage, searchQuery]);
  
  // Auto-expand all tags when searching to show matching sub-tags
  useEffect(() => {
    if (searchQuery && tags.length > 0) {
      const allTagIds = new Set();
      const collectTagIds = (tag) => {
        allTagIds.add(tag.id);
        if (tag.children && tag.children.length > 0) {
          tag.children.forEach(collectTagIds);
        }
      };
      tags.forEach(collectTagIds);
      setExpandedTags(allTagIds);
    }
  }, [tags, searchQuery]);

  const loadTags = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', currentPage);
      params.set('perPage', pagination.perPage);
      if (searchQuery) {
        params.set('filter', searchQuery);
      }

      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags?${params}`);
      const result = await response.json();

      if (result.success) {
        setTags(result.data || []);
        setPagination({
          page: currentPage,
          total: result.total || 0,
          totalPages: result.totalPages || 1,
          hasMore: result.hasMore || false,
          perPage: 24
        });
      } else {
        setError(result.error || 'Failed to load tags');
      }
    } catch (err) {
      console.error('Error loading tags:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchParams({ page: '1', search: searchQuery });
  };

  const goToPage = (page) => {
    const params = { page: page.toString() };
    if (searchQuery) params.search = searchQuery;
    setSearchParams(params);
  };

  const toggleTag = (tagId) => {
    setExpandedTags(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tagId)) {
        newSet.delete(tagId);
      } else {
        newSet.add(tagId);
      }
      return newSet;
    });
  };

  const renderTagCard = (tag, level = 0, parentExpanded = true) => {
    if (!parentExpanded && level > 0) return null;
    
    const isExpanded = expandedTags.has(tag.id);
    const hasChildren = tag.children && tag.children.length > 0;
    
    return (
      <div key={tag.id} className="tag-card-wrapper">
        <div 
          className={`content-card tag-card-enhanced ${tag.favorite ? 'favorite-tag' : ''}`}
          style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : '0' }}
        >
          {/* Tag Image/Icon */}
          <div className="tag-visual">
            {tag.image ? (
              <img 
                src={tag.image} 
                alt={tag.name}
                className="tag-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className="tag-icon-fallback" 
              style={{ display: tag.image ? 'none' : 'flex' }}
            >
              🏷️
            </div>
            
            {/* Favorite Badge */}
            {tag.favorite && (
              <div className="tag-favorite-badge" title="Favorite Tag">
                ⭐
              </div>
            )}
          </div>

          {/* Tag Content */}
          <div className="tag-content-enhanced">
            {/* Header with Name, Counts, and Expand Button */}
            <div className="tag-header-enhanced">
              <div className="tag-name-row">
                <Link to={`/media/stash/tags/${tag.id}`} className="tag-name-link">
                  <h3 className="tag-name" title={tag.name}>{tag.name}</h3>
                </Link>
                {hasChildren && (
                  <button 
                    className="tag-expand-button"
                    onClick={() => toggleTag(tag.id)}
                    title={isExpanded ? 'Collapse children' : 'Expand children'}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>
                )}
              </div>
              <div className="tag-stats">
                {tag.scene_count > 0 && (
                  <span className="stat-badge scene-badge" title="Scenes">
                    🎬 {tag.scene_count}
                  </span>
                )}
                {tag.performer_count > 0 && (
                  <span className="stat-badge performer-badge" title="Performers">
                    👤 {tag.performer_count}
                  </span>
                )}
                {hasChildren && (
                  <span className="stat-badge children-badge" title="Child Tags">
                    📂 {tag.child_count}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {tag.description && (
              <p className="tag-description-enhanced" title={tag.description}>
                {tag.description}
              </p>
            )}

            {/* Aliases */}
            {tag.aliases && tag.aliases.length > 0 && (
              <div className="tag-aliases-enhanced" style={{ marginTop: '0.5rem' }}>
                <span className="aliases-label" style={{ fontWeight: '500', marginRight: '0.5rem', fontSize: '0.875rem' }}>
                  Aliases:
                </span>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                  {tag.aliases.map((alias, idx) => (
                    <span 
                      key={idx}
                      style={{
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '10px',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        border: '1px solid #bbdefb'
                      }}
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Render Children - full width for child tags */}
        {hasChildren && isExpanded && (
          <div className="tag-children-container" style={{ gridColumn: '1 / -1' }}>
            <div className="tags-grid-hierarchical">
              {tag.children.map(child => renderTagCard(child, level + 1, isExpanded))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="page pad tags-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🏷️ Tags</h1>
        <p className="muted">Browse and explore your tag library</p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="search-section">
        <input
          type="text"
          placeholder="Search tags..."
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
          <Button onClick={loadTags}>Retry</Button>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="loading-message">
          <p>Loading tags...</p>
        </div>
      )}

      {/* Tags Grid */}
      {!isLoading && !error && (
        <>
          <div className="tags-grid-hierarchical">
            {tags.length === 0 ? (
              <div className="empty-state">
                <p>No tags found</p>
              </div>
            ) : (
              tags.map(tag => renderTagCard(tag, 0, true))
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
                Page {currentPage} of {pagination.totalPages}
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
