import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Button from '../../../../shared/components/Button';
import SceneGrid from './components/SceneGrid';
import config from '../../../../config';

export default function StudioDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Scenes state
  const [scenes, setScenes] = useState([]);
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesPage, setScenesPage] = useState(1);
  const [scenesPagination, setScenesPagination] = useState({
    page: 1,
    total: 0,
    totalPages: 1,
    perPage: 20
  });
  const [filterNoPerformers, setFilterNoPerformers] = useState(false);

  useEffect(() => {
    const fetchStudio = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Failed to load studio');
        setData(json.data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStudio();
  }, [id]);

  // Load scenes when data is available or filter changes
  useEffect(() => {
    if (data) {
      loadScenes();
    }
  }, [scenesPage, data, filterNoPerformers]);

  const loadScenes = async () => {
    setScenesLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', scenesPage);
      params.set('perPage', scenesPagination.perPage);
      params.set('sortBy', 'date');
      params.set('sortDirection', 'DESC');
      params.set('studio', data.name); // Filter by studio name
      
      if (filterNoPerformers) {
        params.set('noPerformers', 'true');
      }

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

  if (loading) return <div className="page pad">Loading studio...</div>;
  if (error) return <div className="page pad">Error: {error}</div>;
  if (!data) return null;

  return (
    <div className="page pad studio-detail">
      <div className="breadcrumb">
        <Link to="/media/stash">← Stash</Link>
        <span> / </span>
        <Link to="/media/stash/studios">Studios</Link>
        <span> / </span>
        <span>{data.name}</span>
      </div>

      <div className="header">
        <div className="studio-header-detail">
          {data.image && (
            <div className="studio-image-large">
              <img src={data.image} alt={data.name} />
            </div>
          )}
          <div className="studio-info-header">
            <h1>🏢 {data.name}</h1>
            {data.url && (
              <p>
                <a href={data.url} target="_blank" rel="noopener noreferrer" className="studio-link">
                  🔗 Visit Website
                </a>
              </p>
            )}
            {data.details && <p className="studio-description">{data.details}</p>}
            
            <div className="studio-stats-detail">
              {data.scene_count > 0 && (
                <div className="stat-item">
                  <span className="stat-value">{data.scene_count}</span>
                  <span className="stat-label">Scenes</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scenes Section */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2>Scenes from this studio</h2>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={filterNoPerformers}
              onChange={(e) => {
                setFilterNoPerformers(e.target.checked);
                setScenesPage(1); // Reset to page 1 when filter changes
              }}
              style={{ cursor: 'pointer' }}
            />
            <span>Show only scenes with no performers</span>
          </label>
        </div>
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
    </div>
  );
}
