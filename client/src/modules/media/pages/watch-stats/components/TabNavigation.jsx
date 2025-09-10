import React from 'react';

const TabNavigation = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'custom-orders', label: 'By Custom Order' },
    { id: 'all-activity', label: '📋 All Activity' },
    { id: 'tv', label: '📺 TV Shows' },
    { id: 'movies', label: '🎬 Movies' },
    { id: 'books', label: '📚 Books' },
    { id: 'comics', label: '📖 Comics' },
    { id: 'shortstories', label: '📝 Stories' },
    { id: 'webvideos', label: '🌐 Web Videos' }
  ];

  return (
    <div className="tab-navigation">
      {tabs.map(tab => (
        <button 
          key={tab.id}
          className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default TabNavigation;
