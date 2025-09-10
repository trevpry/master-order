import React from 'react';
import Button from '../../../../../shared/components/Button';

const StashStatsTab = ({
  refreshStats,
  isLoading,
  data,
  pagination,
  connectionStatus,
  syncStatus,
  stats,
  loadStats,
  setSelectedPerformer
}) => {
  const openPerformerImageModal = (performer) => {
    setSelectedPerformer(performer);
  };

  return (
    <div className="stats-tab">
      <div className="stats-header">
        <h2>📊 Database Statistics</h2>
        {stats?.lastUpdated && (
          <p className="last-updated">
            Last updated: {new Date(stats.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>

      {(stats?.loading || isLoading) ? (
        <div className="loading-stats">
          <div className="loading-spinner"></div>
          <p>Loading statistics...</p>
        </div>
      ) : stats?.error ? (
        <div className="stats-error">
          <div className="error-icon">❌</div>
          <h3>Error Loading Statistics</h3>
          <p>{stats.error}</p>
          <Button onClick={loadStats || refreshStats} className="retry-button">
            🔄 Retry
          </Button>
        </div>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎬</div>
              <div className="stat-content">
                <div className="stat-number">{stats?.scenes?.toLocaleString() || pagination.scenes?.total?.toLocaleString() || 0}</div>
                <div className="stat-label">Scenes</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-content">
                <div className="stat-number">{stats?.performers?.toLocaleString() || pagination.performers?.total?.toLocaleString() || 0}</div>
                <div className="stat-label">Performers</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏢</div>
              <div className="stat-content">
                <div className="stat-number">{stats?.studios?.toLocaleString() || pagination.studios?.total?.toLocaleString() || 0}</div>
                <div className="stat-label">Studios</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏷️</div>
              <div className="stat-content">
                <div className="stat-number">{stats?.tags?.toLocaleString() || pagination.tags?.total?.toLocaleString() || 0}</div>
                <div className="stat-label">Tags</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">✂️</div>
              <div className="stat-content">
                <div className="stat-number">{stats?.clips?.toLocaleString() || pagination.clips?.total?.toLocaleString() || 0}</div>
                <div className="stat-label">Clips</div>
              </div>
            </div>
          </div>

          {/* Top Performers and Studios Lists */}
          <div className="top-lists">
            <div className="top-list">
              <h3 className="top-list-title">🌟 Top 10 Performers</h3>
              {stats?.topPerformers && stats.topPerformers.length > 0 ? (
                <div className="top-list-items">
                  {stats.topPerformers.map((performer, index) => (
                    <div key={performer.id} className="top-list-item">
                      <div className="rank">#{index + 1}</div>
                      <div className="performer-info">
                        <div className="performer-avatar-small" onClick={() => openPerformerImageModal(performer)}>
                          {performer.image ? (
                            <img
                              src={performer.image}
                              alt={performer.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="performer-placeholder-small">
                              <span>👤</span>
                            </div>
                          )}
                          {performer.image && (
                            <div className="performer-placeholder-small" style={{display: 'none'}}>
                              <span>👤</span>
                            </div>
                          )}
                        </div>
                        <div className="name">{performer.name}</div>
                      </div>
                      <div className="count">{performer.sceneCount || performer.scene_count || 0} scenes</div>
                    </div>
                  ))}
                </div>
              ) : data.performers && data.performers.length > 0 ? (
                <div className="top-list-items">
                  {data.performers.slice(0, 10).map((performer, index) => (
                    <div key={performer.id} className="top-list-item">
                      <div className="rank">#{index + 1}</div>
                      <div className="performer-info">
                        <div className="performer-avatar-small" onClick={() => openPerformerImageModal(performer)}>
                          {performer.image ? (
                            <img
                              src={performer.image}
                              alt={performer.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : (
                            <div className="performer-placeholder-small">
                              <span>👤</span>
                            </div>
                          )}
                          {performer.image && (
                            <div className="performer-placeholder-small" style={{display: 'none'}}>
                              <span>👤</span>
                            </div>
                          )}
                        </div>
                        <div className="name">{performer.name}</div>
                      </div>
                      <div className="count">{performer.scene_count || 0} scenes</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No performer data available</div>
              )}
            </div>

            <div className="top-list">
              <h3 className="top-list-title">🏆 Top 10 Studios</h3>
              {stats?.topStudios && stats.topStudios.length > 0 ? (
                <div className="top-list-items">
                  {stats.topStudios.map((studio, index) => {
                    return (
                    <div key={studio.id} className="top-list-item">
                      <div className="rank">#{index + 1}</div>
                      <div className="studio-info">
                        {studio.image ? (
                          <div className="studio-image-small">
                            <img
                              src={studio.image}
                              alt={studio.name}
                              onLoad={(e) => {
                                console.log('Studio image loaded successfully:', studio.image);
                              }}
                              onError={(e) => {
                                console.log('Failed to load studio image:', studio.image);
                                e.target.style.display = 'none';
                                e.target.closest('.studio-info').querySelector('.studio-name-fallback').style.display = 'block';
                              }}
                            />
                            <div className="studio-name-fallback" style={{display: 'none'}}>
                              {studio.name}
                            </div>
                          </div>
                        ) : (
                          <div className="name">{studio.name}</div>
                        )}
                      </div>
                      <div className="count">{studio.sceneCount || studio.scene_count || 0} scenes</div>
                    </div>
                  )})}
                </div>
              ) : data.studios && data.studios.length > 0 ? (
                <div className="top-list-items">
                  {data.studios.slice(0, 10).map((studio, index) => (
                    <div key={studio.id} className="top-list-item">
                      <div className="rank">#{index + 1}</div>
                      <div className="studio-info">
                        {studio.image ? (
                          <div className="studio-image-small">
                            <img
                              src={studio.image}
                              alt={studio.name}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.closest('.studio-info').querySelector('.studio-name-fallback').style.display = 'block';
                              }}
                            />
                            <div className="studio-name-fallback" style={{display: 'none'}}>
                              {studio.name}
                            </div>
                          </div>
                        ) : (
                          <div className="name">{studio.name}</div>
                        )}
                      </div>
                      <div className="count">{studio.scene_count || 0} scenes</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-data">No studio data available</div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="activity-section">
            <h3>🕒 Recent Activity</h3>
            <div className="activity-items">
              {syncStatus.lastSync && (
                <div className="activity-item">
                  <span className="activity-label">Last Sync:</span>
                  <span className="activity-value">
                    {new Date(syncStatus.lastSync).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="activity-item">
                <span className="activity-label">Connection Status:</span>
                <span className={`activity-value ${connectionStatus.connected ? 'connected' : 'disconnected'}`}>
                  {connectionStatus.connected ? '🟢 Connected' : '🔴 Disconnected'}
                </span>
              </div>
              {connectionStatus.stashUrl && (
                <div className="activity-item">
                  <span className="activity-label">Stash URL:</span>
                  <span className="activity-value">{connectionStatus.stashUrl}</span>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="stats-actions">
        <Button onClick={loadStats || refreshStats} disabled={stats?.loading || isLoading} className="refresh-stats-button">
          {stats?.loading || isLoading ? '⏳ Loading...' : '🔄 Refresh Statistics'}
        </Button>
      </div>
    </div>
  );
};

export default StashStatsTab;
