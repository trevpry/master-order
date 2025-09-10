import React from 'react';
import StatItem from './shared/StatItem';

const WebVideosTab = ({ webvideoStats, formatDateWithTimezone }) => {
  return (
    <div className="tab-content">
      {webvideoStats ? (
        <>
          {/* Overall Web Video Statistics */}
          <div className="stats-card">
            <h2>🌐 Web Video Statistics</h2>
            <div className="stats-grid">
              <StatItem 
                label="Total Videos" 
                value={webvideoStats.totalStats?.totalWebVideos || 0} 
              />
              <StatItem 
                label="Total View Time" 
                value={webvideoStats.totalStats?.totalWebVideoViewTimeFormatted || '0 minutes'} 
              />
              <StatItem 
                label="Custom Orders" 
                value={webvideoStats.totalStats?.uniqueCustomOrders || 0} 
              />
              <StatItem 
                label="Average Video Length" 
                value={webvideoStats.totalStats?.totalWebVideos > 0 
                  ? Math.round((webvideoStats.totalStats?.totalWebVideoViewTime || 0) / webvideoStats.totalStats.totalWebVideos) + ' min'
                  : '0 min'
                } 
              />
            </div>
          </div>

          {/* Recent Web Videos */}
          {webvideoStats.logs && webvideoStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>Recent Web Videos</h2>
              <div className="recent-activity web-videos">
                {webvideoStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .slice(0, 10)
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-main">
                      <div className="activity-title">
                        {log.title}
                      </div>
                      {log.customOrderItem?.customOrder?.name && (
                        <div className="custom-order-label">
                          {log.customOrderItem.customOrder.name}
                        </div>
                      )}
                    </div>
                    <div className="activity-meta">
                      <span className="activity-date">
                        {formatDateWithTimezone(log.startTime)}
                      </span>
                      <span className="activity-time">
                        {Math.round(log.totalWatchTime)} min
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Web Video Breakdown by Custom Order */}
          {webvideoStats.totalStats?.customOrderBreakdown && webvideoStats.totalStats.customOrderBreakdown.length > 0 && (
            <div className="stats-card">
              <h2>Web Videos by Custom Order</h2>
              <div className="breakdown-list">
                {webvideoStats.totalStats.customOrderBreakdown
                  .sort((a, b) => b.totalWebVideoViewTime - a.totalWebVideoViewTime)
                  .slice(0, 15)
                  .map((order, index) => (
                  <div key={index} className="breakdown-item">
                    <div className="breakdown-info">
                      <span className="breakdown-name">{order.orderTitle}</span>
                      <div className="breakdown-details">
                        <span>{order.totalWebVideos} videos</span>
                        <span className="separator">•</span>
                        <span>{order.totalWebVideoViewTimeFormatted}</span>
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
            <h3>Loading Web Video Statistics...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default WebVideosTab;
