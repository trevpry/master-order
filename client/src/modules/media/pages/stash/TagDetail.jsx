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
              {data.parent && (
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
            
            {data.children && data.children.length > 0 && (
              <div className="section">
                <h3>Child Tags</h3>
                <div className="tag-chips">
                  {data.children.map(child => (
                    <Link 
                      key={child.id} 
                      to={`/media/stash/tags/${child.id}`}
                      className="chip tag-chip"
                    >
                      {child.name}
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
          </div>
        )}
      </div>
    </div>
  );
}
