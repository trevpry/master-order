import React from 'react';
import Button from '../../../../../shared/components/Button';

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
  goToPreviousPage
}) => {
  const tabLabels = {
    scenes: '🎬 Scenes',
    performers: '👤 Performers',
    studios: '🏢 Studios',
    tags: '🏷️ Tags',
    clips: '🎞️ Clips'
  };

  return (
    <div className="library-tab">
      {/* Sync Section */}
      <div className="sync-section">
        <div className="sync-controls">
          <Button
            onClick={runSync} 
            disabled={syncStatus.isRunning}
            className={`sync-button ${syncStatus.isRunning ? 'syncing' : ''}`}
          >
            {syncStatus.isRunning ? '🔄 Syncing...' : '🔄 Sync Library'}
          </Button>
          
          {syncStatus.lastSync && (
            <div className="sync-info">
              <span className="sync-time">
                Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
              </span>
              {syncStatus.message && (
                <span className="sync-message">{syncStatus.message}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Library Navigation Tabs */}
      <div className="library-nav">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            className={`library-nav-tab ${libraryTab === key ? 'active' : ''}`}
            onClick={() => setLibraryTab(key)}
          >
            {label}
            {pagination[key]?.total > 0 && (
              <span className="tab-count">({pagination[key].total})</span>
            )}
          </button>
        ))}
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
      </div>

      {/* Content Area */}
      <div className="library-content">
        {isLoading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Loading {tabLabels[libraryTab]}...</span>
          </div>
        ) : (
          <div className="content-container">
            {(() => {
              switch (libraryTab) {
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
                  return <div>Select a category to browse</div>;
              }
            })()}
          </div>
        )}
        
        {/* Pagination Controls */}
        {pagination[libraryTab] && pagination[libraryTab].totalPages > 1 && (
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
