import React, { useState, useEffect } from 'react';
import Button from '../../../../../shared/components/Button';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import config from '../../../../../config';

ChartJS.register(ArcElement, Tooltip, Legend);

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
  const [tagStats, setTagStats] = useState({ scenes: [], performers: [] });
  const [loadingTags, setLoadingTags] = useState(false);
  const [selectedSceneTag, setSelectedSceneTag] = useState(null);
  const [selectedPerformerTag, setSelectedPerformerTag] = useState(null);
  const [sceneTagBreadcrumb, setSceneTagBreadcrumb] = useState([]);
  const [performerTagBreadcrumb, setPerformerTagBreadcrumb] = useState([]);

  // Load tag statistics
  const loadTagStats = async (parentId = null, type = 'both') => {
    setLoadingTags(true);
    try {
      const url = parentId 
        ? `${config.apiBaseUrl}/api/stash/stats/tags?parentId=${parentId}`
        : `${config.apiBaseUrl}/api/stash/stats/tags`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        if (type === 'both' || type === 'scenes') {
          setTagStats(prev => ({ ...prev, scenes: result.data }));
        }
        if (type === 'both' || type === 'performers') {
          setTagStats(prev => ({ ...prev, performers: result.data }));
        }
      }
    } catch (error) {
      console.error('Error loading tag stats:', error);
    } finally {
      setLoadingTags(false);
    }
  };

  // Load tags on mount
  useEffect(() => {
    loadTagStats();
  }, []);

  // Handle clicking on a tag in the scene chart
  const handleSceneTagClick = async (tagId, tagName) => {
    setSelectedSceneTag(tagId);
    setSceneTagBreadcrumb([...sceneTagBreadcrumb, { id: tagId, name: tagName }]);
    await loadTagStats(tagId, 'scenes');
  };

  // Handle clicking on a tag in the performer chart
  const handlePerformerTagClick = async (tagId, tagName) => {
    setSelectedPerformerTag(tagId);
    setPerformerTagBreadcrumb([...performerTagBreadcrumb, { id: tagId, name: tagName }]);
    await loadTagStats(tagId, 'performers');
  };

  // Reset to top-level tags
  const resetSceneTags = () => {
    setSelectedSceneTag(null);
    setSceneTagBreadcrumb([]);
    loadTagStats(null, 'scenes');
  };

  const resetPerformerTags = () => {
    setSelectedPerformerTag(null);
    setPerformerTagBreadcrumb([]);
    loadTagStats(null, 'performers');
  };

  // Navigate breadcrumb
  const navigateSceneBreadcrumb = (index) => {
    if (index === -1) {
      resetSceneTags();
    } else {
      const tag = sceneTagBreadcrumb[index];
      setSelectedSceneTag(tag.id);
      setSceneTagBreadcrumb(sceneTagBreadcrumb.slice(0, index + 1));
      loadTagStats(tag.id, 'scenes');
    }
  };

  const navigatePerformerBreadcrumb = (index) => {
    if (index === -1) {
      resetPerformerTags();
    } else {
      const tag = performerTagBreadcrumb[index];
      setSelectedPerformerTag(tag.id);
      setPerformerTagBreadcrumb(performerTagBreadcrumb.slice(0, index + 1));
      loadTagStats(tag.id, 'performers');
    }
  };

  // Generate colors for pie chart
  const generateColors = (count) => {
    const colors = [];
    for (let i = 0; i < count; i++) {
      const hue = (i * 360) / count;
      colors.push(`hsl(${hue}, 70%, 60%)`);
    }
    return colors;
  };

  // Prepare chart data for scenes
  const sceneChartData = {
    labels: tagStats.scenes.filter(t => t.sceneCount > 0).slice(0, 20).map(t => t.name),
    datasets: [{
      data: tagStats.scenes.filter(t => t.sceneCount > 0).slice(0, 20).map(t => t.sceneCount),
      backgroundColor: generateColors(Math.min(20, tagStats.scenes.filter(t => t.sceneCount > 0).length)),
      borderWidth: 1
    }]
  };

  // Prepare chart data for performers
  const performerChartData = {
    labels: tagStats.performers.filter(t => t.performerCount > 0).slice(0, 20).map(t => t.name),
    datasets: [{
      data: tagStats.performers.filter(t => t.performerCount > 0).slice(0, 20).map(t => t.performerCount),
      backgroundColor: generateColors(Math.min(20, tagStats.performers.filter(t => t.performerCount > 0).length)),
      borderWidth: 1
    }]
  };

  // Chart options
  const chartOptions = (type, clickHandler) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 12,
          font: { size: 11 },
          padding: 10
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          }
        }
      }
    },
    onClick: (event, elements) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const tag = type === 'scenes' 
          ? tagStats.scenes.filter(t => t.sceneCount > 0)[index]
          : tagStats.performers.filter(t => t.performerCount > 0)[index];
        
        if (tag && tag.hasChildren) {
          clickHandler(tag.id, tag.name);
        }
      }
    }
  });

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

          {/* Tag Charts Section */}
          <div className="tag-charts-section">
            <h3 className="section-title">🏷️ Tag Distribution</h3>
            
            <div className="charts-grid">
              {/* Tags by Scene Chart */}
              <div className="chart-container">
                <div className="chart-header">
                  <h4>Tags by Scene Count</h4>
                  {sceneTagBreadcrumb.length > 0 && (
                    <div className="breadcrumb">
                      <button onClick={() => navigateSceneBreadcrumb(-1)} className="breadcrumb-item">
                        All Tags
                      </button>
                      {sceneTagBreadcrumb.map((crumb, index) => (
                        <React.Fragment key={crumb.id}>
                          <span className="breadcrumb-separator">›</span>
                          <button 
                            onClick={() => navigateSceneBreadcrumb(index)} 
                            className="breadcrumb-item"
                          >
                            {crumb.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                {loadingTags ? (
                  <div className="chart-loading">Loading...</div>
                ) : tagStats.scenes.filter(t => t.sceneCount > 0).length > 0 ? (
                  <div className="chart-wrapper">
                    <Pie 
                      data={sceneChartData} 
                      options={chartOptions('scenes', handleSceneTagClick)} 
                    />
                    <p className="chart-hint">💡 Click on a tag with children to drill down</p>
                  </div>
                ) : (
                  <div className="no-data">No tag data available</div>
                )}
              </div>

              {/* Tags by Performer Chart */}
              <div className="chart-container">
                <div className="chart-header">
                  <h4>Tags by Performer Count</h4>
                  {performerTagBreadcrumb.length > 0 && (
                    <div className="breadcrumb">
                      <button onClick={() => navigatePerformerBreadcrumb(-1)} className="breadcrumb-item">
                        All Tags
                      </button>
                      {performerTagBreadcrumb.map((crumb, index) => (
                        <React.Fragment key={crumb.id}>
                          <span className="breadcrumb-separator">›</span>
                          <button 
                            onClick={() => navigatePerformerBreadcrumb(index)} 
                            className="breadcrumb-item"
                          >
                            {crumb.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
                {loadingTags ? (
                  <div className="chart-loading">Loading...</div>
                ) : tagStats.performers.filter(t => t.performerCount > 0).length > 0 ? (
                  <div className="chart-wrapper">
                    <Pie 
                      data={performerChartData} 
                      options={chartOptions('performers', handlePerformerTagClick)} 
                    />
                    <p className="chart-hint">💡 Click on a tag with children to drill down</p>
                  </div>
                ) : (
                  <div className="no-data">No tag data available</div>
                )}
              </div>
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
