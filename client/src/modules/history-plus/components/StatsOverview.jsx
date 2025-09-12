import React from 'react';
import './StatsOverview.css';

const StatsOverview = ({ statistics }) => {
  if (!statistics) {
    return (
      <div className="stats-overview">
        <div className="stats-loading">
          <div className="loading-spinner"></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Historical Events',
      value: statistics.events || 0,
      icon: '📅',
      color: '#4ade80'
    },
    {
      title: 'Books',
      value: statistics.books || 0,
      icon: '📚',
      color: '#3b82f6',
      completion: `${statistics.completedBooks || 0} completed (${statistics.bookCompletionRate || 0}%)`
    },
    {
      title: 'Videos',
      value: statistics.videos || 0,
      icon: '🎬',
      color: '#f59e0b',
      completion: `${statistics.completedVideos || 0} watched (${statistics.videoCompletionRate || 0}%)`
    },
    {
      title: 'Chapters',
      value: statistics.chapters || 0,
      icon: '📖',
      color: '#8b5cf6',
      completion: `${statistics.completedChapters || 0} read (${statistics.chapterCompletionRate || 0}%)`
    }
  ];

  return (
    <div className="stats-overview">
      <h2 className="stats-title">📊 Overview</h2>
      <div className="stats-grid">
        {statCards.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-header">
              <span className="stat-icon">{stat.icon}</span>
              <h3 className="stat-title">{stat.title}</h3>
            </div>
            <div className="stat-value" style={{ color: stat.color }}>
              {stat.value.toLocaleString()}
            </div>
            {stat.completion && (
              <div className="stat-completion">
                {stat.completion}
              </div>
            )}
            {stat.completion && (
              <div className="completion-bar">
                <div 
                  className="completion-progress" 
                  style={{ 
                    width: `${stat.title === 'Books' ? statistics.bookCompletionRate : 
                           stat.title === 'Videos' ? statistics.videoCompletionRate : 
                           statistics.chapterCompletionRate}%`,
                    backgroundColor: stat.color
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatsOverview;
