import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
import config from '../../../../config';

export default function TagDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('scenes');
  
  // Edit parent state
  const [isEditingParent, setIsEditingParent] = useState(false);
  const [allTags, setAllTags] = useState([]);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [savingParent, setSavingParent] = useState(false);
  
  // Merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedTargetTagId, setSelectedTargetTagId] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  
  // Scenes tab state
  const [scenes, setScenes] = useState([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesPage, setScenesPage] = useState(1);
  const [scenesPagination, setScenesPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    perPage: 20
  });

  useEffect(() => {
    const fetchTag = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/tags/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load tag');
        setData(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTag();
  }, [id]);

  // Load scenes when scenes tab is active
  useEffect(() => {
    if (activeTab === 'scenes' && data) {
      loadScenes();
    }
  }, [activeTab, scenesPage, data]);

  const loadScenes = async () => {
    setScenesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', scenesPage);
      params.set('perPage', scenesPagination.perPage);
      params.set('sortBy', 'date');
      params.set('sortDirection', 'DESC');
      params.set('tag', data.name); // Filter by tag name

      const response = await fetch(`${config.apiBaseUrl}/api/stash/scenes?${params}`);
      const result = await response.json();

      if (result.success) {
        setScenes(result.data || []);
        setScenesPagination({
          page: scenesPage,
          total: result.pagination?.total || 0,
          totalPages: result.pagination?.totalPages || 1,
          perPage: 20
        });
      }
    } catch (err) {
      console.error('Error loading scenes:', err);
    } finally {
      setScenesLoading(false);
    }
  };

  const loadAllTags = async () => {
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags?perPage=1000&rootOnly=false`);
      const result = await response.json();
      if (result.success) {
        // Filter out the current tag and its children to prevent circular relationships
        const filteredTags = (result.data || []).filter(tag => {
          if (tag.id === id) return false; // Can't be own parent
          // Check if this tag is a child of the current tag
          const isChild = data?.children?.some(child => child.id === tag.id);
          return !isChild;
        });
        setAllTags(filteredTags);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  const handleEditParent = () => {
    setIsEditingParent(true);
    loadAllTags();
    // Set current parent as selected
    const currentParentId = data.parents?.[0]?.id || data.parent?.id || '';
    setSelectedParentId(currentParentId);
  };

  const handleCancelEdit = () => {
    setIsEditingParent(false);
    setSelectedParentId('');
  };

  const handleSaveParent = async () => {
    setSavingParent(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${id}/parent`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          parentId: selectedParentId || null
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local data with new parent
        setData(prev => ({
          ...prev,
          parents: result.data.parents,
          parent: result.data.parent
        }));
        setIsEditingParent(false);
        
        // Show success message
        alert(`Parent tag updated successfully`);
      } else {
        throw new Error(result.error || 'Failed to update parent');
      }
    } catch (err) {
      console.error('Error updating parent:', err);
      alert(`Error updating parent: ${err.message}`);
    } finally {
      setSavingParent(false);
    }
  };

  const handleMergeIntoClick = () => {
    setShowMergeModal(true);
    loadAllTags();
  };

  const handleMergeCancel = () => {
    setShowMergeModal(false);
    setSelectedTargetTagId('');
    setMergeSearchQuery('');
  };

  const handleMergeConfirm = async () => {
    if (!selectedTargetTagId) {
      alert('Please select a tag to merge into');
      return;
    }

    const targetTag = allTags.find(t => t.id === selectedTargetTagId);
    if (!targetTag) {
      alert('Selected tag not found');
      return;
    }

    const confirmMessage = `Are you sure you want to merge "${data.name}" into "${targetTag.name}"?\n\n` +
      `This will:\n` +
      `- Add "${data.name}" as an alias to "${targetTag.name}"\n` +
      `- Transfer all performer tags, scene tags, and pivot tags\n` +
      `- Delete "${data.name}"\n\n` +
      `This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setMerging(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/merge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          mainTagId: selectedTargetTagId,
          mergeTagIds: [id]
        })
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully merged "${data.name}" into "${targetTag.name}"`);
        // Redirect to the target tag page
        window.location.href = `/media/stash/tags/${selectedTargetTagId}`;
      } else {
        throw new Error(result.error || 'Failed to merge tags');
      }
    } catch (err) {
      console.error('Error merging tags:', err);
      alert(`Error merging tags: ${err.message}`);
    } finally {
      setMerging(false);
    }
  };

  const filteredMergeTags = allTags.filter(tag => 
    tag.name.toLowerCase().includes(mergeSearchQuery.toLowerCase())
  );

  if (loading) return <div className="page pad">Loading tag...</div>;
  if (error) return <div className="page pad">Error: {error}</div>;
  if (!data) return null;

  const tabLabels = {
    scenes: '🎬 Scenes',
    performers: '👤 Performers',
    info: 'ℹ️ Info'
  };

  return (
    <div className="page pad tag-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">← Stash</Link>
        <span> / </span>
        <Link to="/media/stash/tags">Tags</Link>
        <span> / </span>
        <span>{data.name}</span>
      </div>

      <div className="header">
        <div className="tag-header-detail">
          {data.image && (
            <div className="tag-image-large">
              <img src={data.image} alt={data.name} />
            </div>
          )}
          <div className="tag-info-header">
            <h1>🏷️ {data.name}</h1>
            {data.description && <p className="tag-description">{data.description}</p>}
            
            <div className="tag-meta">
              {data.aliases && data.aliases.length > 0 && (
                <div className="meta-item">
                  <strong>Aliases:</strong> {data.aliases.join(', ')}
                </div>
              )}
              {data.parents && data.parents.length > 0 && (
                <div className="meta-item">
                  <strong>Parent Tags:</strong> 
                  <div className="tag-chips-inline">
                    {data.parents.map((parent, idx) => (
                      <React.Fragment key={parent.id}>
                        {idx > 0 && <span>, </span>}
                        <Link to={`/media/stash/tags/${parent.id}`} className="tag-link">
                          {parent.name}
                        </Link>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
              {data.parent && !data.parents && (
                <div className="meta-item">
                  <strong>Parent:</strong> 
                  <Link to={`/media/stash/tags/${data.parent.id}`} className="tag-link">
                    {data.parent.name}
                  </Link>
                </div>
              )}
              {data.favorite && (
                <div className="meta-item">
                  <span className="favorite-badge">⭐ Favorite</span>
                </div>
              )}
            </div>

            <div className="tag-stats-detail">
              {data.scene_count > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{data.scene_count}</span>
                  <span className="stat-label">Scenes</span>
                </div>
              )}
              {data.performer_count > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{data.performer_count}</span>
                  <span className="stat-label">Performers</span>
                </div>
              )}
              {data.children && data.children.length > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{data.children.length}</span>
                  <span className="stat-label">Child Tags</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {Object.entries(tabLabels).map(([key, label]) => (
          <button
            key={key}
            className={`tab ${activeTab === key ? 'active' : ''}`}
            onClick={() => setActiveTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'scenes' && (
          <div className="scenes-section">
            <h2>Scenes with this tag</h2>
            {scenesLoading ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading scenes...</p>
              </div>
            ) : (
              <>
                <SceneGrid scenes={scenes} />
                
                {/* Pagination Controls */}
                {scenesPagination.totalPages > 1 && (
                  <div className="pagination-controls">
                    <Button
                      onClick={() => setScenesPage(p => Math.max(1, p - 1))}
                      disabled={scenesPage === 1}
                      variant="secondary"
                    >
                      ← Previous
                    </Button>
                    <span className="pagination-info">
                      Page {scenesPagination.page} of {scenesPagination.totalPages}
                      {scenesPagination.total > 0 && ` (${scenesPagination.total} total scenes)`}
                    </span>
                    <Button
                      onClick={() => setScenesPage(p => Math.min(scenesPagination.totalPages, p + 1))}
                      disabled={scenesPage >= scenesPagination.totalPages}
                      variant="secondary"
                    >
                      Next →
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'performers' && (
          <div className="performers-section">
            <h2>Performers with this tag</h2>
            {data.performers && data.performers.length > 0 ? (
              <div className="performers-grid">
                {data.performers.map(performer => (
                  <Link 
                    key={performer.id} 
                    to={`/media/stash/performer/${performer.id}`}
                    className="performer-thumbnail-card"
                  >
                    {performer.image && (
                      <div className="performer-thumbnail-image">
                        <img src={performer.image} alt={performer.name} />
                      </div>
                    )}
                    {!performer.image && (
                      <div className="performer-thumbnail-placeholder">
                        👤
                      </div>
                    )}
                    <div className="performer-thumbnail-name">
                      <div className="title">{performer.name}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="muted">No performers found with this tag</p>
            )}
          </div>
        )}

        {activeTab === 'info' && (
          <div className="info-section">
            <h2>Tag Information</h2>
            
            {/* Parent Tags Section with Edit */}
            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Parent Tag</h3>
                {!isEditingParent && (
                  <Button onClick={handleEditParent} variant="secondary" size="small">
                    ✏️ Edit Parent
                  </Button>
                )}
              </div>
              
              {isEditingParent ? (
                <div className="edit-parent-section">
                  <div style={{ marginBottom: '1rem' }}>
                    <label htmlFor="parent-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Select Parent Tag:
                    </label>
                    <select
                      id="parent-select"
                      value={selectedParentId}
                      onChange={(e) => setSelectedParentId(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        fontSize: '1rem',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)'
                      }}
                      disabled={savingParent}
                    >
                      <option value="">-- No Parent (Root Tag) --</option>
                      {allTags.map(tag => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button 
                      onClick={handleSaveParent} 
                      disabled={savingParent}
                      variant="primary"
                    >
                      {savingParent ? '💾 Saving...' : '💾 Save'}
                    </Button>
                    <Button 
                      onClick={handleCancelEdit} 
                      disabled={savingParent}
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {((data.parents && data.parents.length > 0) || data.parent) ? (
                    <div className="tag-chips">
                      {data.parents && data.parents.map(parent => (
                        <Link 
                          key={parent.id} 
                          to={`/media/stash/tags/${parent.id}`}
                          className="chip tag-chip"
                        >
                          {parent.name}
                        </Link>
                      ))}
                      {!data.parents && data.parent && (
                        <Link 
                          to={`/media/stash/tags/${data.parent.id}`}
                          className="chip tag-chip"
                        >
                          {data.parent.name}
                        </Link>
                      )}
                    </div>
                  ) : (
                    <p className="muted">No parent tag (this is a root tag)</p>
                  )}
                </>
              )}
            </div>
            
            {/* Child Tags Section */}
            {data.children && data.children.length > 0 && (
              <div className="section">
                <h3>Child Tags ({data.children.length})</h3>
                <div className="tag-chips">
                  {data.children.map(child => (
                    <Link 
                      key={child.id} 
                      to={`/media/stash/tags/${child.id}`}
                      className="chip tag-chip"
                    >
                      {child.name}
                      {child.scene_count > 0 && (
                        <span className="chip-count"> ({child.scene_count})</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div className="section">
              <h3>Details</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>ID:</strong> {data.id}
                </div>
                <div className="detail-item">
                  <strong>Scene Count:</strong> {data.scene_count || 0}
                </div>
                <div className="detail-item">
                  <strong>Performer Count:</strong> {data.performer_count || 0}
                </div>
                {data.child_count > 0 && (
                  <div className="detail-item">
                    <strong>Child Tags:</strong> {data.child_count}
                  </div>
                )}
                {data.created_at && (
                  <div className="detail-item">
                    <strong>Created:</strong> {new Date(data.created_at).toLocaleDateString()}
                  </div>
                )}
                {data.updated_at && (
                  <div className="detail-item">
                    <strong>Updated:</strong> {new Date(data.updated_at).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>

            {/* Merge Tag Section */}
            <div className="section">
              <h3>Merge Tag</h3>
              <p className="muted">Merge this tag into another tag. This will transfer all relationships and delete this tag.</p>
              <Button onClick={handleMergeIntoClick} variant="danger" size="medium">
                🔀 Merge Into Another Tag
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="modal-overlay" onClick={handleMergeCancel}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Merge "{data.name}" Into Another Tag</h2>
              <button className="modal-close" onClick={handleMergeCancel}>×</button>
            </div>

            <div className="modal-body">
              <p className="modal-description">
                Select a target tag to merge "{data.name}" into. This will:
              </p>
              <ul className="modal-description">
                <li>Add "{data.name}" as an alias to the target tag</li>
                <li>Transfer all performer tags to the target tag</li>
                <li>Transfer all scene tags to the target tag</li>
                <li>Transfer all performer/scene pivot tags to the target tag</li>
                <li>Delete "{data.name}" permanently</li>
              </ul>
              <p className="modal-warning">⚠️ This action cannot be undone!</p>

              <div className="form-group">
                <label htmlFor="merge-search">Search for target tag:</label>
                <input
                  id="merge-search"
                  type="text"
                  value={mergeSearchQuery}
                  onChange={(e) => setMergeSearchQuery(e.target.value)}
                  placeholder="Type to search tags..."
                  className="form-control"
                />
              </div>

              <div className="form-group">
                <label htmlFor="target-tag">Select target tag:</label>
                <select
                  id="target-tag"
                  value={selectedTargetTagId}
                  onChange={(e) => setSelectedTargetTagId(e.target.value)}
                  className="form-control"
                  size="10"
                >
                  <option value="">-- Select a tag --</option>
                  {filteredMergeTags.map(tag => (
                    <option key={tag.id} value={tag.id}>
                      {tag.name} ({tag.scene_count || 0} scenes)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <Button onClick={handleMergeCancel} variant="secondary" disabled={merging}>
                Cancel
              </Button>
              <Button 
                onClick={handleMergeConfirm} 
                variant="danger" 
                disabled={!selectedTargetTagId || merging}
              >
                {merging ? '🔀 Merging...' : '🔀 Merge Tag'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
