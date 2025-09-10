import React from 'react';

const TodayStatsCard = ({ todayStats, selectedMediaTypes }) => {
  // Check if we should show today's stats
  if (!todayStats || todayStats.totalStats.totalItems === 0) {
    return null;
  }

  const hasRelevantData = selectedMediaTypes.some(type => {
    if (type === 'tv' && todayStats.totalStats.totalTvEpisodes > 0) return true;
    if (type === 'movie' && todayStats.totalStats.totalMovies > 0) return true;
    if (type === 'book' && (todayStats.totalStats.totalBooks || 0) > 0) return true;
    if (type === 'comic' && (todayStats.totalStats.totalComics || 0) > 0) return true;
    if (type === 'shortstory' && (todayStats.totalStats.totalShortStories || 0) > 0) return true;
    if (type === 'webvideo' && (todayStats.totalStats.totalWebVideos || 0) > 0) return true;
    return false;
  });

  if (!hasRelevantData) {
    return null;
  }

  return (
    <div className="stats-card today-stats">
      <h2>Today's Activity</h2>
      <div className="stats-grid">
        {(selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie') || selectedMediaTypes.includes('webvideo')) && (
          <div className="stat-item">
            <span className="stat-label">Total Watch Time</span>
            <span className="stat-value">{todayStats.totalStats.totalWatchTimeFormatted}</span>
          </div>
        )}
        {(selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) && (
          <div className="stat-item">
            <span className="stat-label">Total Read Time</span>
            <span className="stat-value">{todayStats.totalStats.totalReadTimeFormatted || '0m'}</span>
          </div>
        )}
        {selectedMediaTypes.includes('tv') && (
          <div className="stat-item">
            <span className="stat-label">TV Episodes</span>
            <span className="stat-value">{todayStats.totalStats.totalTvEpisodes}</span>
          </div>
        )}
        {selectedMediaTypes.includes('movie') && (
          <div className="stat-item">
            <span className="stat-label">Movies</span>
            <span className="stat-value">{todayStats.totalStats.totalMovies}</span>
          </div>
        )}
        {selectedMediaTypes.includes('book') && (
          <div className="stat-item">
            <span className="stat-label">Books</span>
            <span className="stat-value">{todayStats.totalStats.totalBooks || 0}</span>
          </div>
        )}
        {selectedMediaTypes.includes('comic') && (
          <div className="stat-item">
            <span className="stat-label">Comics</span>
            <span className="stat-value">{todayStats.totalStats.totalComics || 0}</span>
          </div>
        )}
        {selectedMediaTypes.includes('shortstory') && (
          <div className="stat-item">
            <span className="stat-label">Stories</span>
            <span className="stat-value">{todayStats.totalStats.totalShortStories || 0}</span>
          </div>
        )}
        {selectedMediaTypes.includes('webvideo') && (
          <div className="stat-item">
            <span className="stat-label">Web Videos</span>
            <span className="stat-value">{todayStats.totalStats.totalWebVideos || 0}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TodayStatsCard;
