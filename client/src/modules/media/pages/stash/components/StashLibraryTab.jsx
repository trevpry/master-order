import React from 'react';
import { Link } from 'react-router-dom';
import Button from '../../../../../shared/components/Button';
import StashLibraryOverview from './StashLibraryOverview';

const StashLibraryTab = ({
  libraryTab,
  setLibraryTab,
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  sortDirection,
  setSortDirection,
  watchStatusFilter,
  setWatchStatusFilter,
  currentPage,
  setCurrentPage,
  data,
  pagination,
  loadData,
  isLoading,
  contentRenderers,
  syncStatus,
  runSync,
  goToPage,
  goToNextPage,
  goToPreviousPage,
  tagFilter,
  addTagFilter,
  removeTagFilter,
  clearTagFilter,
  clipTags
}) => {
  const tabLabels = {
    overview: '📚 Overview',
    scenes: '🎬 Scenes',
    groups: '🎬 Groups',
    performers: '👤 Performers',
    studios: '🏢 Studios',
    tags: '🏷️ Tags',
    clips: '🎞️ Clips'
  };

  return (
    <div className="library-tab">
      {/* Library Navigation Tabs */}
      <div className="library-nav">
        {Object.entries(tabLabels).map(([key, label]) => {
          // Overview tab
          if (key === 'overview') {
            return (
              <button
                key={key}
                className={`library-nav-tab ${libraryTab === key ? 'active' : ''}`}
                onClick={() => setLibraryTab(key)}
                data-library-tab={key}
              >
                {label}
              </button>
            );
          }
          
          // Scenes, Groups, Studios, Tags, and Clips should navigate to their dedicated pages
          if (key === 'scenes' || key === 'groups' || key === 'studios' || key === 'tags' || key === 'clips') {
            return (
              <Link
                key={key}
                to={`/media/stash/${key}`}
                className="library-nav-tab"
              >
                {label}
                {pagination[key]?.total > 0 && (
                  <span className="tab-count">({pagination[key].total})</span>
                )}
              </Link>
            );
          }
          
          // Performers tab works as before (stays on current page)
          return (
            <button
              key={key}
              className={`library-nav-tab ${libraryTab === key ? 'active' : ''}`}
              onClick={() => setLibraryTab(key)}
              data-library-tab={key}
            >
              {label}
              {pagination[key]?.total > 0 && (
                <span className="tab-count">({pagination[key].total})</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="library-filters">
        <div className="search-section">
          <input
            type="text"
            placeholder={`Search ${tabLabels[libraryTab]}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Sorting and Filtering Controls */}
        <div className="filter-controls">
          <div className="sort-controls">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="sort-select"
            >
              <option value="date">Date</option>
              <option value="title">Title</option>
              <option value="rating">Rating</option>
              <option value="duration">Duration</option>
            </select>
            
            <select
              value={sortDirection}
              onChange={(e) => setSortDirection(e.target.value)}
              className="sort-direction-select"
            >
              <option value="DESC">Descending</option>
              <option value="ASC">Ascending</option>
            </select>
          </div>

          <div className="watch-status-filter">
            <select
              value={watchStatusFilter}
              onChange={(e) => setWatchStatusFilter(e.target.value)}
              className="watch-status-select"
            >
              <option value="all">All</option>
              <option value="true">Watched</option>
              <option value="false">Unwatched</option>
            </select>
          </div>
        </div>

        {/* Tag Filter (only show for clips) */}
        {libraryTab === 'clips' && (
          <div className="tag-filter-section">
            <div className="tag-filter-header">
              <h4>🏷️ Filter by Tags</h4>
              {tagFilter.length > 0 && (
                <button 
                  className="clear-tag-filter-btn"
                  onClick={clearTagFilter}
                  title="Clear all tag filters"
                >
                  Clear All ({tagFilter.length})
                </button>
              )}
            </div>
            
            <div className="tag-filter-container">
              {tagFilter.length > 0 && (
                <div className="active-tag-filters">
                  <span className="filter-label">Active filters:</span>
                  {tagFilter.map(tagId => {
                    const tag = clipTags?.find(t => t.id === tagId);
                    return tag ? (
                      <span 
                        key={tagId} 
                        className="active-tag-filter"
                        style={{
                          backgroundColor: '#000000',
                          color: '#ffffff',
                          border: '2px solid #000000',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '14px',
                          fontWeight: '600',
                          margin: '2px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          fontFamily: 'system-ui, -apple-system, sans-serif'
                        }}
                      >
                        {tag.name}
                        <button 
                          className="remove-tag-filter"
                          onClick={() => removeTagFilter(tagId)}
                          title={`Remove ${tag.name} filter`}
                          style={{
                            backgroundColor: 'transparent',
                            color: '#ffffff',
                            border: 'none',
                            marginLeft: '4px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            padding: '0'
                          }}
                        >
                          ✕
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
              
              <div className="available-tags">
                <span className="filter-label">Available tags:</span>
                <div className="tag-list">
                  {clipTags?.filter(tag => !tagFilter.includes(tag.id)).slice(0, 20).map(tag => (
                    <button
                      key={tag.id}
                      className="tag-filter-option"
                      onClick={() => addTagFilter(tag.id)}
                      title={`Filter clips by ${tag.name} (${tag.clip_count} clips)`}
                      style={{
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        border: '2px solid #000000',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        fontSize: '14px',
                        fontWeight: '600',
                        margin: '2px',
                        cursor: 'pointer',
                        fontFamily: 'system-ui, -apple-system, sans-serif'
                      }}
                    >
                      {tag.name}
                      {tag.clip_count > 0 && (
                        <span 
                          className="tag-count"
                          style={{
                            color: '#000000',
                            fontWeight: '400',
                            marginLeft: '4px'
                          }}
                        >
                          ({tag.clip_count} clips)
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="library-content">
        {isLoading && libraryTab !== 'overview' ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Loading {tabLabels[libraryTab]}...</span>
          </div>
        ) : (
          <div className="content-container">
            {(() => {
              switch (libraryTab) {
                case 'overview':
                  return <StashLibraryOverview 
                    syncStatus={syncStatus}
                    runSync={runSync}
                    pagination={pagination}
                  />;
                case 'scenes':
                  return contentRenderers.renderScenes();
                case 'performers':
                  return contentRenderers.renderPerformers();
                case 'studios':
                  return contentRenderers.renderStudios();
                case 'tags':
                  return contentRenderers.renderTags();
                case 'clips':
                  return contentRenderers.renderClips();
                default:
                  return <StashLibraryOverview 
                    syncStatus={syncStatus}
                    runSync={runSync}
                    pagination={pagination}
                  />;
              }
            })()}
          </div>
        )}
        
        {/* Pagination Controls - Don't show for overview */}
        {libraryTab !== 'overview' && pagination[libraryTab] && pagination[libraryTab].totalPages > 1 && (
          <div className="pagination-controls">
            <div className="pagination-info">
              <span>
                Page {currentPage[libraryTab] || 1} of {pagination[libraryTab].totalPages} 
                ({pagination[libraryTab].total} total items)
              </span>
            </div>
            
            <div className="pagination-buttons">
              <Button
                onClick={() => goToPreviousPage(libraryTab)}
                disabled={isLoading || (currentPage[libraryTab] || 1) <= 1}
                className="pagination-button"
              >
                ← Previous
              </Button>
              
              {/* Page number buttons for nearby pages */}
              {(() => {
                const current = currentPage[libraryTab] || 1;
                const total = pagination[libraryTab].totalPages;
                const buttons = [];
                
                // Show first page
                if (current > 3) {
                  buttons.push(
                    <Button
                      key={1}
                      onClick={() => goToPage(libraryTab, 1)}
                      disabled={isLoading}
                      className={`pagination-button ${current === 1 ? 'active' : ''}`}
                    >
                      1
                    </Button>
                  );
                  if (current > 4) {
                    buttons.push(<span key="dots1" className="pagination-dots">...</span>);
                  }
                }
                
                // Show current page and nearby pages
                for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
                  buttons.push(
                    <Button
                      key={i}
                      onClick={() => goToPage(libraryTab, i)}
                      disabled={isLoading}
                      className={`pagination-button ${current === i ? 'active' : ''}`}
                    >
                      {i}
                    </Button>
                  );
                }
                
                // Show last page
                if (current < total - 2) {
                  if (current < total - 3) {
                    buttons.push(<span key="dots2" className="pagination-dots">...</span>);
                  }
                  buttons.push(
                    <Button
                      key={total}
                      onClick={() => goToPage(libraryTab, total)}
                      disabled={isLoading}
                      className={`pagination-button ${current === total ? 'active' : ''}`}
                    >
                      {total}
                    </Button>
                  );
                }
                
                return buttons;
              })()}
              
              <Button
                onClick={() => goToNextPage(libraryTab)}
                disabled={isLoading || (currentPage[libraryTab] || 1) >= pagination[libraryTab].totalPages}
                className="pagination-button"
              >
                Next →
              </Button>
            </div>
          </div>
        )}

        {/* Pagination Info */}
        {pagination[libraryTab]?.total > 0 && (
          <div className="pagination-summary">
            <span>
              Showing {((currentPage[libraryTab] || 1) - 1) * (pagination[libraryTab].perPage || 24) + 1} - {Math.min((currentPage[libraryTab] || 1) * (pagination[libraryTab].perPage || 24), pagination[libraryTab].total)} of {pagination[libraryTab].total} {libraryTab}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StashLibraryTab;
