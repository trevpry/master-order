import React from 'react';
import StatItem from './shared/StatItem';

const OverallStatsCard = ({ stats, selectedMediaTypes, getFilteredStats }) => {
  if (!stats) {
    return null;
  }

  return (
    <div className="stats-card">
      <h2>Overall Statistics</h2>
      <div className="stats-grid">
        <StatItem 
          label="Total Activity Time" 
          value={getFilteredStats()?.totalStats.totalActivityTimeFormatted} 
        />
        {(selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie') || selectedMediaTypes.includes('webvideo')) && (
          <div className="stat-item">
            <span className="stat-label">Total Watch Time</span>
            <span className="stat-value">{getFilteredStats()?.totalStats.totalWatchTimeFormatted}</span>
          </div>
        )}
        {(selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) && (
          <div className="stat-item">
            <span className="stat-label">Total Read Time</span>
            <span className="stat-value">{getFilteredStats()?.totalStats.totalReadTimeFormatted || '0m'}</span>
          </div>
        )}
        {selectedMediaTypes.includes('tv') && (
          <>
            <div className="stat-item">
              <span className="stat-label">TV Watch Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalTvWatchTimeFormatted}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">TV Episodes Watched</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalTvEpisodes}</span>
            </div>
          </>
        )}
        {selectedMediaTypes.includes('movie') && (
          <>
            <div className="stat-item">
              <span className="stat-label">Movie Watch Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalMovieWatchTimeFormatted}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Movies Watched</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalMovies}</span>
            </div>
          </>
        )}
        {selectedMediaTypes.includes('book') && (
          <>
            <div className="stat-item">
              <span className="stat-label">Book Read Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalBookReadTimeFormatted || '0m'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Books Read</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalBooks || 0}</span>
            </div>
          </>
        )}
        {selectedMediaTypes.includes('comic') && (
          <>
            <div className="stat-item">
              <span className="stat-label">Comic Read Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalComicReadTimeFormatted || '0m'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Comics Read</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalComics || 0}</span>
            </div>
          </>
        )}
        {selectedMediaTypes.includes('shortstory') && (
          <>
            <div className="stat-item">
              <span className="stat-label">Story Read Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalShortStoryReadTimeFormatted || '0m'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Stories Read</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalShortStories || 0}</span>
            </div>
          </>
        )}
        {selectedMediaTypes.includes('webvideo') && (
          <>
            <div className="stat-item">
              <span className="stat-label">Web Video View Time</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalWebVideoViewTimeFormatted || '0m'}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Web Videos Watched</span>
              <span className="stat-value">{getFilteredStats()?.totalStats.totalWebVideos || 0}</span>
            </div>
          </>
        )}
        <div className="stat-item">
          <span className="stat-label">Total Items</span>
          <span className="stat-value">{getFilteredStats()?.totalStats.totalItems}</span>
        </div>
      </div>
    </div>
  );
};

export default OverallStatsCard;
