import React from 'react';

const TimeBasedBreakdown = ({ stats, selectedMediaTypes, getFilteredStats, globalPeriod, formatDate }) => {
  if (!stats || !stats.groupedStats || stats.groupedStats.length === 0 || selectedMediaTypes.length === 0) {
    return null;
  }

  const formatTime = (minutes) => {
    if (!minutes) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getPeriodLabel = () => {
    if (globalPeriod === 'today' || globalPeriod === 'week' || globalPeriod === 'month') {
      return 'Day';
    } else if (globalPeriod === 'year') {
      return 'Month';
    } else {
      return 'Year';
    }
  };

  return (
    <div className="stats-card">
      <h2>Activity by {getPeriodLabel()}</h2>
      <div className="time-breakdown">
        {getFilteredStats().groupedStats.map((group, index) => {
          // Calculate total activity time for filtered media types only
          let totalActivityTime = 0;
          if (selectedMediaTypes.includes('tv') || selectedMediaTypes.includes('movie') || selectedMediaTypes.includes('webvideo')) {
            totalActivityTime += (group.totalWatchTime || 0);
          }
          if (selectedMediaTypes.includes('book') || selectedMediaTypes.includes('comic') || selectedMediaTypes.includes('shortstory')) {
            totalActivityTime += (group.totalReadTime || 0);
          }
          
          // Skip periods with no activity for selected media types
          if (totalActivityTime === 0) return null;
          
          return (
            <div key={index} className="time-period">
              <div className="period-header">
                <h3>{formatDate(group.period)}</h3>
                <span className="period-total">{formatTime(totalActivityTime)}</span>
              </div>
              <div className="period-stats">
                {selectedMediaTypes.includes('tv') && (
                  <div className="period-stat">
                    <span className="stat-type">TV:</span>
                    <span>{group.tvEpisodes || 0} episodes ({group.tvWatchTimeFormatted || '0m'})</span>
                  </div>
                )}
                {selectedMediaTypes.includes('movie') && (
                  <div className="period-stat">
                    <span className="stat-type">Movies:</span>
                    <span>{group.movies || 0} movies ({group.movieWatchTimeFormatted || '0m'})</span>
                  </div>
                )}
                {selectedMediaTypes.includes('webvideo') && (
                  <div className="period-stat">
                    <span className="stat-type">Web Videos:</span>
                    <span>{group.webVideos || 0} videos ({group.webVideoViewTimeFormatted || '0m'})</span>
                  </div>
                )}
                {selectedMediaTypes.includes('book') && (
                  <div className="period-stat">
                    <span className="stat-type">Books:</span>
                    <span>{group.books || 0} books ({group.bookReadTimeFormatted || '0m'})</span>
                  </div>
                )}
                {selectedMediaTypes.includes('comic') && (
                  <div className="period-stat">
                    <span className="stat-type">Comics:</span>
                    <span>{group.comics || 0} comics ({group.comicReadTimeFormatted || '0m'})</span>
                  </div>
                )}
                {selectedMediaTypes.includes('shortstory') && (
                  <div className="period-stat">
                    <span className="stat-type">Stories:</span>
                    <span>{group.shortStories || 0} stories ({group.shortStoryReadTimeFormatted || '0m'})</span>
                  </div>
                )}
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
};

export default TimeBasedBreakdown;
