import React from 'react';
import Button from '../../../../../shared/components/Button';

const StashStatsTab = ({
  refreshStats,
  isLoading,
  data,
  pagination,
  connectionStatus,
  syncStatus
}) => {
  return (
    <div className="stats-tab">
      <div className="stats-header">
        <h2>📊 Stash Statistics</h2>
        <Button 
          onClick={refreshStats}
          disabled={isLoading}
        >
          {isLoading ? '🔄 Loading...' : '🔄 Refresh Stats'}
        </Button>
      </div>

      {isLoading ? (
        <div className="loading">🔄 Loading statistics...</div>
      ) : (
        <div className="stats-grid">
          {/* Library Stats */}
          <div className="stat-card">
            <h3>� Library Overview</h3>
            <div className="stat-items">
              <div className="stat-item">
                <span className="stat-label">🎬 Scenes:</span>
                <span className="stat-value">{pagination.scenes?.total || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">👥 Performers:</span>
                <span className="stat-value">{pagination.performers?.total || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">🏢 Studios:</span>
                <span className="stat-value">{pagination.studios?.total || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">🏷️ Tags:</span>
                <span className="stat-value">{pagination.tags?.total || 0}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">✂️ Clips:</span>
                <span className="stat-value">{pagination.clips?.total || 0}</span>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          {data.performers && data.performers.length > 0 && (
            <div className="stat-card">
              <h3>🌟 Top Performers</h3>
              <div className="top-items">
                {data.performers.slice(0, 5).map((performer, index) => (
                  <div key={performer.id} className="top-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{performer.name}</span>
                    <span className="count">{performer.scene_count || 0} scenes</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top Studios */}
          {data.studios && data.studios.length > 0 && (
            <div className="stat-card">
              <h3>🏢 Top Studios</h3>
              <div className="top-items">
                {data.studios.slice(0, 5).map((studio, index) => (
                  <div key={studio.id} className="top-item">
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{studio.name}</span>
                    <span className="count">{studio.scene_count || 0} scenes</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          <div className="stat-card">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StashStatsTab;
