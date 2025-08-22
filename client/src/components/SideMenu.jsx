import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './SideMenu.css';

const SideMenu = ({ isMobile, closeMobileMenu }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Handle menu item click - close mobile menu if on mobile
  const handleMenuItemClick = (callback) => {
    return (e) => {
      // Call any specific callback first (like handleCustomOrdersClick)
      if (callback) {
        callback(e);
      }
      
      // Close mobile menu if on mobile and navigation wasn't prevented
      if (isMobile && !e.defaultPrevented) {
        closeMobileMenu();
      }
    };
  };

  // Check if we're on a specific custom order page
  const isOnCustomOrderDetail = location.pathname.match(/^\/custom-orders\/\d+$/);

  // Handle Custom Orders menu item click
  const handleCustomOrdersClick = (e) => {
    if (isOnCustomOrderDetail) {
      // If we're on a specific order page, navigate back to main list
      e.preventDefault();
      navigate('/custom-orders');
    }
    // Otherwise, let the normal Link behavior handle it
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
      path: '/watch-stats',
      icon: '📊',
      label: 'Watch Stats',
      description: 'View your watching activity'
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

      <nav className="side-menu-nav">        <ul className="menu-items">
          {menuItems.map((item) => (
            <li key={item.path} className="menu-item">
              <Link 
                to={item.path} 
                className={`menu-link ${location.pathname === item.path || (item.path === '/custom-orders' && location.pathname.startsWith('/custom-orders')) ? 'active' : ''}`}
                title={isCollapsed ? item.label : ''}
                onClick={handleMenuItemClick(item.path === '/custom-orders' ? handleCustomOrdersClick : null)}
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
