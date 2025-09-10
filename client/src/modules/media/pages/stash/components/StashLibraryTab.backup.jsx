import React from 'react';
import Button from '../../../../../shared/components/Button';

const StashLibraryTab = ({
  libraryTab,
  setLibraryTab,
  s        )}
        
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
        )}tSearchQuery,
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
            </div>
          )}
        </div>
        
        {/* Search Bar */}
        <div className="search-bar">
          <input
            type="text"
            placeholder={`Search ${libraryTab}...`}
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
        
        {/* Sorting and Filtering Controls for Clips */}
        {libraryTab === 'clips' && (
          <div className="clip-controls">
            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-select"
              >
                <option value="createdAt">Date Created</option>
                <option value="sceneTitle">Scene Title</option>
                <option value="duration">Duration</option>
                <option value="startTime">Start Time</option>
                <option value="watchedAt">Watch Date</option>
              </select>
              
              <Button
                className="sort-direction-button"
                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
            
            <div className="watch-filter">
              <select
                value={watchStatusFilter}
                onChange={(e) => setWatchStatusFilter(e.target.value)}
                className="filter-select"
              >
                <option value="all">All Clips</option>
                <option value="false">Unwatched</option>
                <option value="true">Watched</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Library Sub-Tabs */}
      <div className="tabs-section">
        <div className="tabs">
          {['scenes', 'performers', 'studios', 'tags', 'clips'].map((tab) => (
            <button
              key={tab}
              className={`tab ${libraryTab === tab ? 'active' : ''}`}
              onClick={() => setLibraryTab(tab)}
            >
              {tabLabels[tab]}
              {pagination[tab]?.total > 0 && (
                <span className="tab-count">({pagination[tab].total})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="content-section">
        {isLoading ? (
          <div className="loading">🔄 Loading {libraryTab}...</div>
        ) : (
          <div className="library-grid">
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
        
        {/* Load More Button */}
        {pagination[libraryTab]?.hasMore && !isLoading && (
          <div className="load-more-section">
            <Button
              onClick={() => {
                setCurrentPage(currentPage + 1);
                loadData(libraryTab, currentPage + 1);
              }}
              className="load-more-button"
              size="large"
            >
              Load More {tabLabels[libraryTab]}
            </Button>
          </div>
        )}
        
        {/* Pagination Info */}
        {pagination[libraryTab]?.total > 0 && (
          <div className="pagination-info">
            <span>
              Page {currentPage} • {pagination[libraryTab].total} total {libraryTab}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StashLibraryTab;
