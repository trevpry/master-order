import React from 'react';

const RecentActivity = ({ recentActivity, selectedMediaTypes, settings }) => {
  const filteredActivity = recentActivity.filter(log => selectedMediaTypes.includes(log.mediaType));
  
  if (filteredActivity.length === 0) {
    return null;
  }

  return (
    <div className="stats-card">
      <h2>Recent Activity</h2>
      <div className="recent-activity">
        {filteredActivity
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort by when activity was logged
          .map((log, index) => (
            <div key={log.id} className="activity-item">
              <div className="activity-info">
                <div className="activity-title">
                  {log.mediaType === 'tv' && log.seriesTitle && (
                    <span className="series-title">{log.seriesTitle} - </span>
                  )}
                  <span className="title">{log.title}</span>
                  {log.mediaType === 'tv' && log.seasonNumber && log.episodeNumber && (
                    <span className="episode-info"> (S{log.seasonNumber}E{log.episodeNumber})</span>
                  )}
                </div>
                <div className="activity-meta">
                  <span className="media-type">{log.mediaType.toUpperCase()}</span>
                  <span className="separator">•</span>
                  <span className="duration">
                    {(log.activityType === 'read' || log.activityType === 'view') 
                      ? log.totalWatchTimeFormatted 
                      : log.durationFormatted}
                  </span>
                  <span className="separator">•</span>
                  <span className="date">{new Date(log.startTime).toLocaleDateString('en-US', { timeZone: settings?.timezone || 'UTC' })}</span>
                </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;
