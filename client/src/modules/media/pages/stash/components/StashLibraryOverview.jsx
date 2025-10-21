import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import config from '../../../../../config';

export default function StashLibraryOverview({ syncStatus, runSync, reloadScrapers, pagination }) {
  const [stats, setStats] = useState({
    scenes: 0,
    performers: 0,
    studios: 0,
    tags: 0,
    clips: 0,
    loading: true
  });

  useEffect(() => {
    // Use pagination data if available, otherwise fetch
    if (pagination) {
      setStats({
        scenes: pagination.scenes?.total || 0,
        performers: pagination.performers?.total || 0,
        studios: pagination.studios?.total || 0,
        tags: pagination.tags?.total || 0,
        clips: pagination.clips?.total || 0,
        loading: false
      });
    }
  }, [pagination]);

  const libraryCards = [
    {
      key: 'scenes',
      title: '🎬 Scenes',
      description: 'Browse and manage your scene library',
      path: '/media/stash/scenes',
      count: stats.scenes,
      color: 'from-blue-500 to-blue-600'
    },
    {
      key: 'performers',
      title: '👤 Performers',
      description: 'View and organize performers',
      path: '#',
      count: stats.performers,
      color: 'from-purple-500 to-purple-600',
      onClick: (e) => {
        e.preventDefault();
        // Performers still use tab navigation
        const performersTab = document.querySelector('[data-library-tab="performers"]');
        if (performersTab) performersTab.click();
      }
    },
    {
      key: 'studios',
      title: '🏢 Studios',
      description: 'Explore content by studio',
      path: '/media/stash/studios',
      count: stats.studios,
      color: 'from-pink-500 to-pink-600'
    },
    {
      key: 'tags',
      title: '🏷️ Tags',
      description: 'Organize with tags',
      path: '/media/stash/tags',
      count: stats.tags,
      color: 'from-green-500 to-green-600'
    },
    {
      key: 'clips',
      title: '🎞️ Clips',
      description: 'Browse saved clips',
      path: '/media/stash/clips',
      count: stats.clips,
      color: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className="library-overview">
      {/* Sync Section */}
      <div className="sync-section">
        <div className="sync-controls">
          <button
            onClick={runSync} 
            disabled={syncStatus.isRunning}
            className={`sync-button ${syncStatus.isRunning ? 'syncing' : ''}`}
          >
            {syncStatus.isRunning ? '🔄 Syncing...' : '🔄 Sync Library'}
          </button>
          
          {reloadScrapers && (
            <button
              onClick={reloadScrapers}
              disabled={syncStatus.isRunning}
              className="sync-button ml-2"
              title="Reload YAML scraper configurations"
            >
              🔄 Reload Scrapers
            </button>
          )}
          
          {syncStatus.lastSync && (
            <div className="sync-info">
              <span className="sync-time">
                Last sync: {new Date(syncStatus.lastSync).toLocaleString()}
              </span>
              {syncStatus.message && (
                <span className="sync-message">{syncStatus.message}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Overview Header */}
      <div className="overview-header">
        <h2>📚 Library Overview</h2>
        <p className="muted">Quick access to all your Stash content</p>
      </div>

      {/* Library Cards Grid */}
      <div className="library-cards-grid">
        {libraryCards.map((card) => {
          const CardComponent = card.onClick ? 'a' : Link;
          const linkProps = card.onClick 
            ? { href: card.path, onClick: card.onClick }
            : { to: card.path };
            
          return (
            <CardComponent 
              key={card.key}
              {...linkProps}
              className="library-overview-card"
            >
              <div className={`card-gradient bg-gradient-to-br ${card.color}`}>
                <div className="card-content">
                  <h3 className="card-title">{card.title}</h3>
                  <p className="card-description">{card.description}</p>
                  {stats.loading ? (
                    <div className="card-count loading">Loading...</div>
                  ) : (
                    <div className="card-count">{card.count.toLocaleString()} items</div>
                  )}
                </div>
                <div className="card-arrow">→</div>
              </div>
            </CardComponent>
          );
        })}
      </div>

      {/* Quick Stats */}
      {!stats.loading && (
        <div className="quick-stats">
          <h3>📊 Quick Stats</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{stats.scenes.toLocaleString()}</div>
              <div className="stat-label">Total Scenes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.performers.toLocaleString()}</div>
              <div className="stat-label">Performers</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.studios.toLocaleString()}</div>
              <div className="stat-label">Studios</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.tags.toLocaleString()}</div>
              <div className="stat-label">Tags</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.clips.toLocaleString()}</div>
              <div className="stat-label">Clips</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
