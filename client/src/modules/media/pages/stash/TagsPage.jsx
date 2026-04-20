import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../../shared/components/Button';
import config from '../../../../config';

export default function TagsPage() {
  const ALL_TAGS_PER_PAGE = 999999;
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
    perPage: ALL_TAGS_PER_PAGE
  });
  const [expandedTags, setExpandedTags] = useState(new Set());
  const [draggedTag, setDraggedTag] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);
  const [dropAction, setDropAction] = useState(null); // 'child' or 'merge'
  const [showConfirmMerge, setShowConfirmMerge] = useState(false);
  const [mergeData, setMergeData] = useState(null);
  const [showHidden, setShowHidden] = useState(false);

  const currentPage = 1;
  const displayedParentTagCount = tags.length;

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
          perPage: ALL_TAGS_PER_PAGE
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
    setSearchParams({ search: searchQuery });
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

  const renderTagCard = (tag, level = 0, parentExpanded = true) => {
    if (!parentExpanded && level > 0) return null;
    
    const isExpanded = expandedTags.has(tag.id);
    const hasChildren = tag.children && tag.children.length > 0;
    const isDropTarget = dropTarget?.id === tag.id;
    const isDragging = draggedTag?.id === tag.id;
    
    return (
      <div key={tag.id} className="tag-card-wrapper">
        <div 
          className={`tag-card-enhanced ${tag.favorite ? 'favorite-tag' : ''} ${tag.hidden ? 'hidden-tag' : ''} ${isDropTarget ? (dropAction === 'child' ? 'drop-target-child' : 'drop-target-merge') : ''} ${isDragging ? 'dragging' : ''}`}
          style={{ marginLeft: level > 0 ? `${level * 1.5}rem` : '0' }}
          draggable="true"
          onDragStart={(e) => handleDragStart(e, tag)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, tag)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, tag)}
        >
          {/* Tag Content */}
          <div className="tag-content-enhanced">
            {/* Header with Name, Counts, and Expand Button */}
            <div className="tag-header-enhanced">
              <div className="tag-name-row">
                <Link to={`/media/stash/tags/${tag.id}`} className="tag-name-link">
                  <h3 className="tag-name" title={tag.name}>{tag.name}</h3>
                </Link>
                <div className="tag-stats tag-stats-inline">
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
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
            </div>
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
        <p className="muted" style={{ marginTop: '0.25rem' }}>
          Showing {displayedParentTagCount} parent tags
        </p>
        <div style={{ marginTop: '1rem' }}>
          <Link to="/media/stash/clip-tagging-flow">
            <Button>🎯 Configure Clip Tagging Flow</Button>
          </Link>
        </div>
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

        </>
      )}

      {/* Merge Confirmation Modal */}
      {showConfirmMerge && mergeData && (
        <div className="modal-overlay">
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
