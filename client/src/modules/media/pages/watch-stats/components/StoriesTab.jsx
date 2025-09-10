import React from 'react';
import StatItem from './shared/StatItem';

const StoriesTab = ({ shortStoryStats, formatDateWithTimezone }) => {
  return (
    <div className="tab-content">
      {shortStoryStats ? (
        <>
          {/* Overall Short Story Statistics */}
          <div className="stats-card">
            <h2>📝 Short Story Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Stories" 
                value={shortStoryStats.totalStats?.totalShortStories || 0} 
              />
              <StatItem 
                label="Total Read Time" 
                value={shortStoryStats.totalStats?.totalShortStoryReadTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Custom Orders" 
                value={shortStoryStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Read Time" 
                value={shortStoryStats.totalStats?.totalShortStories > 0 
                  ? Math.round((shortStoryStats.totalStats?.totalShortStoryReadTime || 0) / shortStoryStats.totalStats.totalShortStories) + ' min' 
                  : '0 min'
                } 
              />
            </div>
          </div>

          {/* Recent Short Stories */}
          {shortStoryStats.logs && shortStoryStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent Short Stories</h2>
              <div className="recent-activity">
                {shortStoryStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        <span className="title">{log.title}</span>
                      </div>
                      <div className="activity-meta">
                        <span className="media-type">STORY</span>
                        <span className="separator">•</span>
                        <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                        <span className="separator">•</span>
                        <span className="date">{formatDateWithTimezone(log.startTime)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>Loading Short Story Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesTab;
