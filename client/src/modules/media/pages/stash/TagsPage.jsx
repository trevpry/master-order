import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
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
  const [draggedTag, setDraggedTag] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropAction, setDropAction] = useState(null); // 'child' or 'merge'
  const [showConfirmMerge, setShowConfirmMerge] = useState(false);
  const [mergeData, setMergeData] = useState(null);
  const [showHidden, setShowHidden] = useState(false);

  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  useEffect(() => {
    loadTags();
  }, [currentPage, searchQuery, showHidden]);
  
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
      if (showHidden) {
        params.set('showHidden', 'true');
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

  // Drag and drop handlers
  const handleDragStart = (e, tag) => {
    e.stopPropagation();
    setDraggedTag(tag);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tag.id);
    
    // Add visual feedback
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.currentTarget.style.opacity = '1';
    setDraggedTag(null);
    setDropTarget(null);
    setDropAction(null);
  };

  const handleDragOver = (e, tag) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTag || draggedTag.id === tag.id) return;
    
    // Determine drop action based on mouse position
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const cardHeight = rect.height;
    
    // If hovering over top 30% - make child, otherwise merge
    const action = mouseY < cardHeight * 0.3 ? 'child' : 'merge';
    
    setDropTarget(tag);
    setDropAction(action);
    e.dataTransfer.dropEffect = action === 'child' ? 'copy' : 'move';
  };

  const handleDragLeave = (e) => {
    e.stopPropagation();
    setDropTarget(null);
    setDropAction(null);
  };

  const handleDrop = async (e, targetTag) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!draggedTag || draggedTag.id === targetTag.id) {
      setDraggedTag(null);
      setDropTarget(null);
      setDropAction(null);
      return;
    }

    // Check if trying to make a parent a child of its own child (circular reference)
    const isCircular = checkCircularReference(targetTag, draggedTag.id);
    if (isCircular && dropAction === 'child') {
      toast.error('Cannot make a parent a child of its own descendant');
      setDraggedTag(null);
      setDropTarget(null);
      setDropAction(null);
      return;
    }

    if (dropAction === 'merge') {
      // Show confirmation dialog for merge
      setMergeData({ source: draggedTag, target: targetTag });
      setShowConfirmMerge(true);
    } else if (dropAction === 'child') {
      // Move tag as child
      await moveTagAsChild(draggedTag, targetTag);
    }

    setDraggedTag(null);
    setDropTarget(null);
    setDropAction(null);
  };

  const checkCircularReference = (tag, ancestorId) => {
    if (tag.id === ancestorId) return true;
    if (tag.children && tag.children.length > 0) {
      return tag.children.some(child => checkCircularReference(child, ancestorId));
    }
    return false;
  };

  const moveTagAsChild = async (sourceTag, targetTag) => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${sourceTag.id}/parent`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentId: targetTag.id })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`"${sourceTag.name}" moved under "${targetTag.name}"`);
        loadTags(); // Reload to see the changes
      } else {
        toast.error(result.error || 'Failed to move tag');
      }
    } catch (err) {
      console.error('Error moving tag:', err);
      toast.error('Failed to move tag');
    }
  };

  const mergeTags = async () => {
    if (!mergeData) return;

    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceIds: [mergeData.source.id],
          targetId: mergeData.target.id
        })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`"${mergeData.source.name}" merged into "${mergeData.target.name}"`);
        setShowConfirmMerge(false);
        setMergeData(null);
        loadTags(); // Reload to see the changes
      } else {
        toast.error(result.error || 'Failed to merge tags');
      }
    } catch (err) {
      console.error('Error merging tags:', err);
      toast.error('Failed to merge tags');
    }
  };

  const toggleTagHidden = async (tag, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newHiddenStatus = !tag.hidden;
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${tag.id}/hidden`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hidden: newHiddenStatus })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`"${tag.name}" ${newHiddenStatus ? 'hidden' : 'shown'}`);
        loadTags(); // Reload to see the changes
      } else {
        toast.error(result.error || 'Failed to update tag visibility');
      }
    } catch (err) {
      console.error('Error updating tag visibility:', err);
      toast.error('Failed to update tag visibility');
    }
  };

  const toggleTagClipTagging = async (tag, e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newClipTaggingStatus = !tag.includeInClipTagging;
    
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${tag.id}/clip-tagging`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeInClipTagging: newClipTaggingStatus })
      });

      const result = await response.json();

      if (result.success) {
        toast.success(`"${tag.name}" ${newClipTaggingStatus ? 'included in' : 'excluded from'} clip tagging`);
        loadTags(); // Reload to see the changes
      } else {
        toast.error(result.error || 'Failed to update clip tagging setting');
      }
    } catch (err) {
      console.error('Error updating clip tagging setting:', err);
      toast.error('Failed to update clip tagging setting');
    }
  };

  const renderTagCard = (tag, level = 0, parentExpanded = true) => {
    if (!parentExpanded && level > 0) return null;
    
    const isExpanded = expandedTags.has(tag.id);
    const hasChildren = tag.children && tag.children.length > 0;
    const isDropTarget = dropTarget?.id === tag.id;
    const isDragging = draggedTag?.id === tag.id;
    
    return (
      <div key={tag.id} className="tag-card-wrapper">
        <div 
          className={`content-card tag-card-enhanced ${tag.favorite ? 'favorite-tag' : ''} ${tag.hidden ? 'hidden-tag' : ''} ${isDropTarget ? (dropAction === 'child' ? 'drop-target-child' : 'drop-target-merge') : ''} ${isDragging ? 'dragging' : ''}`}
          style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : '0' }}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, tag)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, tag)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tag)}
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
            
            {/* Hidden Badge */}
            {tag.hidden && (
              <div className="tag-hidden-badge" title="Hidden Tag">
                👁️‍🗨️
              </div>
            )}
            
            {/* Clip Tagging Badge */}
            {tag.includeInClipTagging === false && (
              <div className="tag-clip-tagging-badge" title="Excluded from Clip Tagging" style={{
                position: 'absolute',
                top: '10px',
                right: tag.hidden ? '50px' : '10px',
                backgroundColor: '#f59e0b',
                color: 'white',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                zIndex: 2
              }}>
                🚫 Clip Tagging
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button 
                    className="tag-hide-button"
                    onClick={(e) => toggleTagHidden(tag, e)}
                    title={tag.hidden ? 'Show tag' : 'Hide tag'}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: tag.hidden ? '#10b981' : '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {tag.hidden ? '👁️ Show' : '🚫 Hide'}
                  </button>
                  <button 
                    className="tag-clip-tagging-button"
                    onClick={(e) => toggleTagClipTagging(tag, e)}
                    title={tag.includeInClipTagging === false ? 'Include in clip tagging' : 'Exclude from clip tagging'}
                    style={{
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.75rem',
                      backgroundColor: tag.includeInClipTagging === false ? '#f59e0b' : '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {tag.includeInClipTagging === false ? '🏷️ Include Clips' : '🏷️ Clip Tagging'}
                  </button>
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

      {/* Show Hidden Tags Toggle */}
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showHidden}
            onChange={(e) => setShowHidden(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Show hidden tags</span>
        </label>
      </div>

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

      {/* Merge Confirmation Modal */}
      {showConfirmMerge && mergeData && (
        <div className="modal-overlay" onClick={() => setShowConfirmMerge(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🔀 Merge Tags</h2>
            <p>
              Are you sure you want to merge <strong>"{mergeData.source.name}"</strong> into <strong>"{mergeData.target.name}"</strong>?
            </p>
            <p className="muted" style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              This will:
            </p>
            <ul style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
              <li>Move all scenes and performers from "{mergeData.source.name}" to "{mergeData.target.name}"</li>
              <li>Delete "{mergeData.source.name}" tag</li>
              <li>This action cannot be undone</li>
            </ul>
            <div className="modal-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <Button onClick={() => setShowConfirmMerge(false)}>
                Cancel
              </Button>
              <Button onClick={mergeTags} className="btn-danger">
                Merge Tags
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Drag and Drop Instructions */}
      <div style={{ 
        position: 'fixed', 
        bottom: '1rem', 
        right: '1rem', 
        backgroundColor: 'rgba(0, 0, 0, 0.8)', 
        color: 'white', 
        padding: '1rem', 
        borderRadius: '8px',
        fontSize: '0.875rem',
        maxWidth: '300px',
        display: draggedTag ? 'block' : 'none'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Drag & Drop</div>
        <div>📁 <strong>Top third:</strong> Make child tag</div>
        <div>🔀 <strong>Lower area:</strong> Merge tags</div>
      </div>
    </div>
  );
}
