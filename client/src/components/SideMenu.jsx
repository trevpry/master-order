import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './SideMenu.css';

const SideMenu = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };
  const menuItems = [
    {
      path: '/',
      icon: '🏠',
      label: 'Home',
      description: 'Get next episode'
    },
    {
      path: '/custom-orders',
      icon: '📋',
      label: 'Custom Orders',
      description: 'Manage playlists'
    },
    {
      path: '/settings',
      icon: '⚙️',
      label: 'Settings',
      description: 'Configure collections'
    }
  ];

  return (
    <div className={`side-menu ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="side-menu-header">
        <div className="logo-section">
          {!isCollapsed && (
            <div className="logo-text">
              <h2>Master Order</h2>
              <span className="logo-subtitle">TV & Movie Queue</span>
            </div>
          )}
          {isCollapsed && (
            <div className="logo-collapsed">
              <span className="logo-icon">📺</span>
            </div>
          )}
        </div>
        <button 
          className="toggle-button" 
          onClick={toggleSidebar}
          aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
        >
          {isCollapsed ? '▶' : '◀'}
        </button>
      </div>

      <nav className="side-menu-nav">
        <ul className="menu-items">
          {menuItems.map((item) => (
            <li key={item.path} className="menu-item">
              <Link 
                to={item.path} 
                className={`menu-link ${location.pathname === item.path ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
              >
                <span className="menu-icon">{item.icon}</span>
                {!isCollapsed && (
                  <div className="menu-text">
                    <span className="menu-label">{item.label}</span>
                    <span className="menu-description">{item.description}</span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {!isCollapsed && (
        <div className="side-menu-footer">
          <div className="footer-text">
            <small>© 2025 Master Order</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default SideMenu;
