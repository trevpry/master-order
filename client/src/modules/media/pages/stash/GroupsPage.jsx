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

  // Merge functionality
  const [selectedGroups, setSelectedGroups] = useState(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [groupsToMerge, setGroupsToMerge] = useState([]);
  const [mergeGroupData, setMergeGroupData] = useState(null);
  const [isMerging, setIsMerging] = useState(false);

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

  // Toggle group selection
  const toggleGroupSelection = (groupId) => {
    setSelectedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      return newSet;
    });
  };

  // Handle opening merge modal
  const handleOpenMergeModal = async () => {
    if (selectedGroups.size < 2) {
      alert('Please select at least 2 groups to merge');
      return;
    }

    try {
      // Fetch full details for selected groups
      const groupIds = Array.from(selectedGroups);
      const groupPromises = groupIds.map(id =>
        fetch(`${config.apiBaseUrl}/api/stash/groups/${id}`).then(r => r.json())
      );
      
      const groupResults = await Promise.all(groupPromises);
      const groupsWithDetails = groupResults.map(r => r.data);
      
      setGroupsToMerge(groupsWithDetails);
      
      // Initialize merge data with first group's data as default
      setMergeGroupData({
        name: groupsWithDetails[0].name || '',
        date: groupsWithDetails[0].date || '',
        synopsis: groupsWithDetails[0].synopsis || '',
        director: groupsWithDetails[0].director || '',
        rating: groupsWithDetails[0].rating || null,
        duration: groupsWithDetails[0].duration || null,
        urls: groupsWithDetails[0].urls || '',
        frontImage: groupsWithDetails[0].frontImage || '',
        backImage: groupsWithDetails[0].backImage || '',
        studio: groupsWithDetails[0].studio || null,
        tags: groupsWithDetails[0].tags || [],
        primaryGroupId: groupsWithDetails[0].id
      });
      
      setShowMergeModal(true);
    } catch (error) {
      console.error('Failed to load group details:', error);
      alert(`Failed to load group details: ${error.message}`);
    }
  };

  // Handle merge execution
  const handleMergeGroups = async () => {
    if (!mergeGroupData || !mergeGroupData.primaryGroupId) {
      alert('Please select a primary group');
      return;
    }

    const primaryGroup = groupsToMerge.find(g => g.id === mergeGroupData.primaryGroupId);
    const otherGroups = groupsToMerge.filter(g => g.id !== mergeGroupData.primaryGroupId);
    
    // Count total scenes
    const totalScenes = groupsToMerge.reduce((sum, g) => sum + (g.scenes?.length || 0), 0);
    
    const confirmMessage = 
      `Merge ${groupsToMerge.length} groups?\n\n` +
      `Primary group (ID kept): ${primaryGroup.name}\n` +
      `Total scenes to consolidate: ${totalScenes}\n` +
      `Groups to delete: ${otherGroups.map(g => g.name).join(', ')}\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/groups/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          primaryGroupId: mergeGroupData.primaryGroupId,
          mergeGroupIds: groupsToMerge.filter(g => g.id !== mergeGroupData.primaryGroupId).map(g => g.id),
          mergedData: mergeGroupData
        })
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to merge groups');
      }

      alert('✅ Successfully merged groups!');
      
      setShowMergeModal(false);
      setSelectedGroups(new Set());
      
      // Reload groups
      loadGroups();
    } catch (error) {
      console.error('Failed to merge groups:', error);
      alert(`Failed to merge groups: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="page pad groups-page">
      <div className="breadcrumb">
        <Link to="/media/stash">← Back to Stash</Link>
      </div>

      <div className="header">
        <h1>🎬 Groups (Movies)</h1>
        <p className="muted">Browse your movie/series collections</p>
        {selectedGroups.size >= 2 && (
          <Button 
            onClick={handleOpenMergeModal}
            style={{
              marginTop: '1rem',
              backgroundColor: '#667eea',
              color: 'white',
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            🔀 Merge {selectedGroups.size} Selected Groups
          </Button>
        )}
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
                  style={{
                    border: selectedGroups.has(group.id) ? '3px solid #667eea' : undefined,
                    backgroundColor: selectedGroups.has(group.id) ? '#f3f4f6' : undefined
                  }}
                >
                  {/* Selection checkbox */}
                  <div
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      zIndex: 10
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupSelection(group.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedGroups.has(group.id)}
                      onChange={() => {}}
                      style={{
                        width: '20px',
                        height: '20px',
                        cursor: 'pointer'
                      }}
                    />
                  </div>

                  {/* Clickable area for navigation */}
                  <div
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
                  {/* End clickable area */}
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

      {/* Merge Modal */}
      {showMergeModal && groupsToMerge.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h2>🔀 Merge {groupsToMerge.length} Groups</h2>
              <button 
                className="btn-close" 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                ×
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Select Primary Group */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Primary Group (ID will be kept):
                </label>
                <select
                  value={mergeGroupData?.primaryGroupId || ''}
                  onChange={(e) => {
                    const selectedId = parseInt(e.target.value);
                    const selectedGroup = groupsToMerge.find(g => g.id === selectedId);
                    if (selectedGroup) {
                      setMergeGroupData({
                        ...mergeGroupData,
                        name: selectedGroup.name,
                        date: selectedGroup.date || '',
                        synopsis: selectedGroup.synopsis || '',
                        director: selectedGroup.director || '',
                        rating: selectedGroup.rating || null,
                        duration: selectedGroup.duration || null,
                        urls: selectedGroup.urls || '',
                        frontImage: selectedGroup.frontImage || '',
                        backImage: selectedGroup.backImage || '',
                        studio: selectedGroup.studio || null,
                        tags: selectedGroup.tags || [],
                        primaryGroupId: selectedId
                      });
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px'
                  }}
                >
                  {groupsToMerge.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.scenes?.length || 0} scenes)
                    </option>
                  ))}
                </select>
              </div>

              {/* Groups Being Merged */}
              <div>
                <label style={{ display: 'block', fontWeight: '600', marginBottom: '8px' }}>
                  Groups Being Merged:
                </label>
                <div style={{ padding: '8px', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                  {groupsToMerge.map(group => (
                    <div
                      key={group.id}
                      style={{
                        padding: '8px',
                        marginBottom: '4px',
                        backgroundColor: group.id === mergeGroupData?.primaryGroupId ? '#dcfce7' : '#fef3c7',
                        borderRadius: '4px',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between'
                      }}
                    >
                      <span>
                        {group.id === mergeGroupData?.primaryGroupId && '⭐ '}
                        {group.name}
                      </span>
                      <span style={{ color: '#6b7280' }}>
                        {group.scenes?.length || 0} scenes
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Scenes Summary */}
              <div style={{
                padding: '12px',
                backgroundColor: '#eff6ff',
                borderRadius: '6px',
                border: '1px solid #3b82f6'
              }}>
                <strong>Total Scenes:</strong> {groupsToMerge.reduce((sum, g) => sum + (g.scenes?.length || 0), 0)} scenes will be consolidated into the primary group
              </div>

              {/* Warning */}
              <div style={{
                padding: '12px',
                backgroundColor: '#fef2f2',
                borderRadius: '6px',
                border: '1px solid #ef4444',
                fontSize: '12px'
              }}>
                <strong>⚠️ Warning:</strong> This action cannot be undone. Groups other than the primary will be deleted, and all their scenes will be added to the primary group.
              </div>
            </div>

            {/* Actions */}
            <div className="modal-actions">
              <button 
                className="btn-accept" 
                onClick={handleMergeGroups}
                disabled={isMerging}
              >
                {isMerging ? '⏳ Merging...' : '🔀 Merge Groups'}
              </button>
              <button 
                className="btn-cancel" 
                onClick={() => setShowMergeModal(false)}
                disabled={isMerging}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
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

        .group-card {
          position: relative;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-content {
          background: white;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 600px;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 1.5rem;
          color: #1f2937;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 2rem;
          color: #9ca3af;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #f3f4f6;
          color: #1f2937;
        }

        .modal-body {
          padding: 1.5rem;
        }

        .modal-actions {
          display: flex;
          gap: 0.75rem;
          padding: 1.5rem;
          border-top: 1px solid #e5e7eb;
          justify-content: flex-end;
        }

        .btn-accept {
          padding: 0.625rem 1.5rem;
          background: #667eea;
          color: white;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-accept:hover:not(:disabled) {
          background: #5568d3;
          transform: translateY(-1px);
        }

        .btn-accept:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-cancel {
          padding: 0.625rem 1.5rem;
          background: #f3f4f6;
          color: #1f2937;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #e5e7eb;
        }

        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
