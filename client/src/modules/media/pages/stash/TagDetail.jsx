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
  const [selectedParentIds, setSelectedParentIds] = useState([]);
  const [savingParent, setSavingParent] = useState(false);
  
  // Edit name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [isEditingUrls, setIsEditingUrls] = useState(false);
  const [editedUrlsText, setEditedUrlsText] = useState('');
  const [savingUrls, setSavingUrls] = useState(false);
  
  // Merge state
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [selectedTargetTagId, setSelectedTargetTagId] = useState('');
  const [merging, setMerging] = useState(false);
  const [mergeSearchQuery, setMergeSearchQuery] = useState('');
  const [updatingWiki, setUpdatingWiki] = useState(false);
  const [wikiPage, setWikiPage] = useState(null);
  
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
        console.log('Tag data received:', json.data);
        console.log('Aliases:', json.data.aliases);
        setData(json.data);

        try {
          const wikiRes = await fetch(`${config.apiBaseUrl}/api/stash-wiki/tags/${id}/page`);
          const wikiJson = await wikiRes.json();
          if (wikiJson.success) {
            setWikiPage(wikiJson.data);
          } else {
            setWikiPage(null);
          }
        } catch {
          setWikiPage(null);
        }
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
    // Set current parents as selected
    const currentParentIds = (data.parents && data.parents.length > 0)
      ? data.parents.map(parent => parent.id)
      : (data.parent ? [data.parent.id] : []);
    setSelectedParentIds(currentParentIds);
  };

  const handleCancelEdit = () => {
    setIsEditingParent(false);
    setSelectedParentIds([]);
  };

  const handleToggleParent = (parentTagId) => {
    setSelectedParentIds(prev => {
      if (prev.includes(parentTagId)) {
        return prev.filter(idValue => idValue !== parentTagId);
      }
      return [...prev, parentTagId];
    });
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
          parentIds: selectedParentIds
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
        alert('Parent tags updated successfully');
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

  const handleEditName = () => {
    setEditedName(data.name);
    setIsEditingName(true);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditedName('');
  };

  const handleSaveName = async () => {
    if (!editedName.trim()) {
      alert('Tag name cannot be empty');
      return;
    }

    if (editedName.trim() === data.name) {
      setIsEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: editedName.trim()
        })
      });

      const result = await response.json();
      
      if (result.success) {
        // Update local data with new name
        setData(prev => ({
          ...prev,
          name: result.data.name
        }));
        setIsEditingName(false);
        
        // Show success message
        alert(`Tag name updated successfully to "${result.data.name}"`);
      } else {
        throw new Error(result.error || 'Failed to update tag name');
      }
    } catch (err) {
      console.error('Error updating tag name:', err);
      alert(`Error updating tag name: ${err.message}`);
    } finally {
      setSavingName(false);
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

  const handleEditUrls = () => {
    const currentUrls = Array.isArray(data?.urls) ? data.urls : [];
    setEditedUrlsText(currentUrls.join('\n'));
    setIsEditingUrls(true);
  };

  const handleCancelEditUrls = () => {
    setIsEditingUrls(false);
    setEditedUrlsText('');
  };

  const handleSaveUrls = async () => {
    const parsedUrls = [...new Set(
      editedUrlsText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
    )];

    setSavingUrls(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          urls: parsedUrls
        })
      });

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Failed to update tag URLs');
      }

      setData(prev => ({
        ...prev,
        urls: result.data.urls || []
      }));
      setIsEditingUrls(false);
      alert('Tag URLs updated successfully');
    } catch (err) {
      console.error('Error updating tag URLs:', err);
      alert(`Error updating tag URLs: ${err.message}`);
    } finally {
      setSavingUrls(false);
    }
  };

  const handleUpdateTagWiki = async () => {
    setUpdatingWiki(true);
    try {
      const response = await fetch(`${config.apiBaseUrl}/api/stash-wiki/tags/${id}/update`, {
        method: 'POST'
      });
      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to update tag wiki page');
      }

      const actionText = result.data?.action === 'created' ? 'created' : 'updated';
      const pageSlug = result.data?.page?.slug || 'unknown';
      alert(`Tag wiki page ${actionText}: ${pageSlug}`);
    } catch (err) {
      console.error('Error updating tag wiki page:', err);
      alert(`Error updating tag wiki page: ${err.message}`);
    } finally {
      setUpdatingWiki(false);
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              {isEditingName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEditName();
                    }}
                    style={{
                      fontSize: '2rem',
                      padding: '0.5rem',
                      border: '2px solid #4a9eff',
                      borderRadius: '4px',
                      flex: 1,
                      fontWeight: 'bold'
                    }}
                    autoFocus
                    disabled={savingName}
                  />
                  <Button 
                    onClick={handleSaveName} 
                    variant="primary" 
                    size="small"
                    disabled={savingName || !editedName.trim()}
                  >
                    {savingName ? '💾 Saving...' : '✓ Save'}
                  </Button>
                  <Button 
                    onClick={handleCancelEditName} 
                    variant="secondary" 
                    size="small"
                    disabled={savingName}
                  >
                    ✕ Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <h1>🏷️ {data.name}</h1>
                  <Button onClick={handleEditName} variant="secondary" size="small">
                    ✏️ Edit Name
                  </Button>
                  <Button onClick={handleUpdateTagWiki} variant="primary" size="small" disabled={updatingWiki}>
                    {updatingWiki ? '📚 Updating Wiki...' : '📚 Update Wiki'}
                  </Button>
                </>
              )}
            </div>
            {data.description && <p className="tag-description">{data.description}</p>}
            
            <div className="tag-meta">
              {data.aliases && Array.isArray(data.aliases) && data.aliases.length > 0 && (
                <div className="meta-item" style={{ marginBottom: '0.75rem' }}>
                  <strong>Aliases:</strong>
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.5rem', 
                    marginTop: '0.5rem' 
                  }}>
                    {data.aliases.map((alias, idx) => (
                      <span 
                        key={idx} 
                        style={{
                          backgroundColor: '#e3f2fd',
                          color: '#1976d2',
                          padding: '0.5rem 0.75rem',
                          borderRadius: '12px',
                          fontSize: '0.9rem',
                          fontWeight: '500',
                          border: '1px solid #bbdefb',
                          display: 'inline-block'
                        }}
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
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
                <h3>Parent Tags</h3>
                {!isEditingParent && (
                  <Button onClick={handleEditParent} variant="secondary" size="small">
                    ✏️ Edit Parents
                  </Button>
                )}
              </div>
              
              {isEditingParent ? (
                <div className="edit-parent-section">
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                      Select Parent Tags:
                    </label>
                    <div style={{
                      maxHeight: '280px',
                      overflowY: 'auto',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      padding: '0.5rem',
                      backgroundColor: 'var(--bg-secondary)'
                    }}>
                      {allTags.length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>No parent tag options available</p>
                      ) : (
                        allTags.map(tag => (
                          <label
                            key={tag.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.5rem',
                              padding: '0.25rem 0',
                              cursor: savingParent ? 'default' : 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedParentIds.includes(tag.id)}
                              onChange={() => handleToggleParent(tag.id)}
                              disabled={savingParent}
                            />
                            <span>{tag.name}</span>
                          </label>
                        ))
                      )}
                    </div>
                    <p className="muted" style={{ marginTop: '0.5rem', marginBottom: 0 }}>
                      Leave all unchecked to make this a root tag.
                    </p>
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
                    <p className="muted">No parent tags (this is a root tag)</p>
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

            {/* Aliases Section */}
            {data.aliases && Array.isArray(data.aliases) && data.aliases.length > 0 && (
              <div className="section">
                <h3>Aliases ({data.aliases.length})</h3>
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '0.75rem',
                  padding: '1rem',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '8px'
                }}>
                  {data.aliases.map((alias, idx) => (
                    <span 
                      key={idx} 
                      style={{
                        backgroundColor: '#e3f2fd',
                        color: '#1976d2',
                        padding: '0.5rem 1rem',
                        borderRadius: '16px',
                        fontSize: '0.95rem',
                        fontWeight: '500',
                        border: '1px solid #bbdefb',
                        display: 'inline-block'
                      }}
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3>Reference URLs</h3>
                {!isEditingUrls && (
                  <Button onClick={handleEditUrls} variant="secondary" size="small">
                    🔗 Edit URLs
                  </Button>
                )}
              </div>

              {isEditingUrls ? (
                <div>
                  <p className="muted" style={{ marginBottom: '0.5rem' }}>
                    One URL per line. These URLs are used by AI when generating and updating this tag's wiki page.
                  </p>
                  <textarea
                    value={editedUrlsText}
                    onChange={(e) => setEditedUrlsText(e.target.value)}
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                    disabled={savingUrls}
                    placeholder="https://example.com/source-1\nhttps://example.com/source-2"
                  />
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                    <Button onClick={handleSaveUrls} variant="primary" disabled={savingUrls}>
                      {savingUrls ? '💾 Saving...' : '💾 Save URLs'}
                    </Button>
                    <Button onClick={handleCancelEditUrls} variant="secondary" disabled={savingUrls}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                Array.isArray(data.urls) && data.urls.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {data.urls.map((url, idx) => (
                      <a
                        key={`${url}-${idx}`}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ wordBreak: 'break-all' }}
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No reference URLs added yet.</p>
                )
              )}
            </div>

            <div className="section">
              <h3>Details</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Wiki:</strong>{' '}
                  {wikiPage?.slug ? (
                    <Link to={`/media/stash?mainTab=wiki&wikiSlug=${encodeURIComponent(wikiPage.slug)}`} className="tag-link">
                      Open wiki entry ({wikiPage.slug})
                    </Link>
                  ) : (
                    <span className="muted">No wiki entry yet</span>
                  )}
                </div>
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

            {/* Include in Clip Tagging Toggle */}
            <div className="section">
              <h3>Clip Tagging Settings</h3>
              <div className="toggle-setting" style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem',
                backgroundColor: 'var(--bg-secondary)',
                borderRadius: '8px',
                marginTop: '0.5rem'
              }}>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', marginBottom: '0.25rem' }}>
                    Include in Clip Tagging
                  </strong>
                  <p className="muted" style={{ fontSize: '0.9rem', margin: 0 }}>
                    When enabled, this tag will appear in clip tagging interfaces
                  </p>
                </div>
                <label style={{ 
                  position: 'relative', 
                  display: 'inline-block', 
                  width: '60px', 
                  height: '34px',
                  marginLeft: '1rem',
                  flexShrink: 0
                }}>
                  <input
                    type="checkbox"
                    checked={data.includeInClipTagging !== false}
                    onChange={async (e) => {
                      const newValue = e.target.checked;
                      try {
                        const response = await fetch(`${config.apiBaseUrl}/api/stash/tags/${data.id}/clip-tagging`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ includeInClipTagging: newValue })
                        });
                        
                        const result = await response.json();
                        
                        if (result.success) {
                          setData(prev => ({
                            ...prev,
                            includeInClipTagging: newValue
                          }));
                        } else {
                          alert('Failed to update clip tagging setting');
                          e.target.checked = !newValue;
                        }
                      } catch (error) {
                        console.error('Error updating clip tagging setting:', error);
                        alert('Error updating clip tagging setting');
                        e.target.checked = !newValue;
                      }
                    }}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span style={{
                    position: 'absolute',
                    cursor: 'pointer',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: data.includeInClipTagging !== false ? '#4CAF50' : '#ccc',
                    transition: '.4s',
                    borderRadius: '34px'
                  }}>
                    <span style={{
                      position: 'absolute',
                      content: '""',
                      height: '26px',
                      width: '26px',
                      left: data.includeInClipTagging !== false ? '30px' : '4px',
                      bottom: '4px',
                      backgroundColor: 'white',
                      transition: '.4s',
                      borderRadius: '50%'
                    }} />
                  </span>
                </label>
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
        <div className="modal-overlay">
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
