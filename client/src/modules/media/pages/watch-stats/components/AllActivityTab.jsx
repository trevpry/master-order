import React from 'react';

const AllActivityTab = ({ 
  allActivityStats, 
  globalPeriod, 
  setGlobalPeriod, 
  fetchAllActivityStats, 
  formatDateWithTimezone, 
  handleDeleteWatchLog 
}) => {
  return (
    <div className="tab-content">
      {allActivityStats ? (
        <>
          {/* Time Period Selection for All Activity */}
          <div className="stats-card">
            <h2>📋 All Activity</h2>
            <div className="period-controls">
              <button 
                className={`period-btn ${globalPeriod === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setGlobalPeriod('all');
                  fetchAllActivityStats('all');
                }}
              >
                All Time
              </button>
              <button 
                className={`period-btn ${globalPeriod === 'today' ? 'active' : ''}`}
                onClick={() => {
                  setGlobalPeriod('today');
                  fetchAllActivityStats('today');
                }}
              >
                Today
              </button>
              <button 
                className={`period-btn ${globalPeriod === 'week' ? 'active' : ''}`}
                onClick={() => {
                  setGlobalPeriod('week');
                  fetchAllActivityStats('week');
                }}
              >
                This Week
              </button>
              <button 
                className={`period-btn ${globalPeriod === 'month' ? 'active' : ''}`}
                onClick={() => {
                  setGlobalPeriod('month');
                  fetchAllActivityStats('month');
                }}
              >
                This Month
              </button>
              <button 
                className={`period-btn ${globalPeriod === 'year' ? 'active' : ''}`}
                onClick={() => {
                  setGlobalPeriod('year');
                  fetchAllActivityStats('year');
                }}
              >
                This Year
              </button>
            </div>
          </div>

          {/* All Activity List */}
          {allActivityStats.logs && allActivityStats.logs.length > 0 && (
            <div className="stats-card">
              <h2>All Activity ({globalPeriod === 'all' ? 'All Time' : globalPeriod.charAt(0).toUpperCase() + globalPeriod.slice(1)})</h2>
              <div className="recent-activity">
                {allActivityStats.logs
                  .sort((a, b) => new Date(b.startTime) - new Date(a.startTime))
                  .map((log, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-info">
                      <div className="activity-title">
                        {log.seriesTitle && (
                          <span className="series-title">{log.seriesTitle} - </span>
                        )}
                        <span className="title">{log.title}</span>
                        {log.seasonNumber && log.episodeNumber && (
                          <span className="episode-info"> (S{log.seasonNumber}E{log.episodeNumber})</span>
                        )}
                      </div>
                      <div className="activity-meta">
                        <span className={`media-type media-type-${log.type?.toLowerCase() || 'unknown'}`}>
                          {log.type?.toUpperCase() || 'UNKNOWN'}
                        </span>
                        <span className="separator">•</span>
                        <span className="duration">{Math.round(log.totalWatchTime)} min</span>
                        <span className="separator">•</span>
                        <span className="date">{formatDateWithTimezone(log.startTime)}</span>
                        <span className="separator">•</span>
                        <span className="time">{new Date(log.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      </div>
                    </div>
                    <div className="activity-actions">
                      <button 
                        className="delete-btn"
                        onClick={() => handleDeleteWatchLog(log.id, log.title)}
                        title="Delete this activity entry"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!allActivityStats.logs || allActivityStats.logs.length === 0) && (
            <div className="stats-card">
              <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
                <h3>No activity found for the selected time period</h3>
                <p>Try selecting a different time period to see your activity.</p>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="stats-card">
          <div style={{ textAlign: 'center', padding: '40px', color: '#8b949e' }}>
            <h3>Loading All Activity...</h3>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllActivityTab;
