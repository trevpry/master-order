import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import './SideMenu.css';
import logoImage from '../../assets/logo.png';

const SideMenu = ({ isMobile, closeMobileMenu }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMediaCollapsed, setIsMediaCollapsed] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  const toggleMediaMenu = (e) => {
    e.preventDefault();
    setIsMediaCollapsed(!isMediaCollapsed);
  };

  const toggleHistoryMenu = (e) => {
    e.preventDefault();
    setIsHistoryCollapsed(!isHistoryCollapsed);
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
    // Core Dashboard
    {
      path: '/',
      icon: '🏠',
      label: 'Dashboard',
      description: 'Eddie overview'
    },
    
    // Life Management Modules
    {
      path: '/tasks',
      icon: '✅',
      label: 'Tasks',
      description: 'Productivity & projects'
    },
    {
      path: '/notes',
      icon: '📝',
      label: 'Notes',
      description: 'Knowledge & ideas'
    },
    {
      path: '/calendar',
      icon: '📅',
      label: 'Calendar',
      description: 'Daily notes, weather & stats'
    },
    {
      path: '/locations',
      icon: '🗺️',
      label: 'Locations',
      description: 'Places & maps'
    },
    {
      path: '/dating',
      icon: '💕',
      label: 'Dating',
      description: 'Connections & dates'
    },
    {
      path: '/history-plus',
      icon: '📚',
      label: 'History Plus',
      description: 'Historical content management',
      isHistoryHeader: true
    },
    {
      path: '/history-plus/timeline',
      icon: '📅',
      label: 'Timeline',
      description: 'Historical events timeline',
      isSubmenu: true
    },
    {
      path: '/history-plus/videos',
      icon: '🎥',
      label: 'Videos',
      description: 'Video library',
      isSubmenu: true
    },
    {
      path: '/history-plus/channels',
      icon: '📺',
      label: 'Channels',
      description: 'Channel management',
      isSubmenu: true
    },
    {
      path: '/history-plus/categories',
      icon: '🏷️',
      label: 'Categories',
      description: 'Event categories',
      isSubmenu: true
    },
    {
      path: '/history-plus/courses',
      icon: '🎓',
      label: 'Courses',
      description: 'Great Courses Plus',
      isSubmenu: true
    },
    {
      path: '/history-plus/prompts',
      icon: '🤖',
      label: 'AI Prompts',
      description: 'Prompt templates',
      isSubmenu: true
    },
    {
      path: '/chat',
      icon: '💬',
      label: 'AI Chat',
      description: 'Chat with local AI'
    },
    {
      path: '/wiki',
      icon: '📚',
      label: 'Wiki',
      description: 'Personal knowledge wiki'
    },
    {
      path: '/eddie-settings',
      icon: '⚙️',
      label: 'Settings',
      description: 'Eddie configuration'
    },
    
    // Media Module Section
    {
      path: '/media',
      icon: '🎬',
      label: 'Media',
      description: 'Entertainment hub',
      isMediaHeader: true
    },
    {
      path: '/media/up-next',
      icon: '▶️',
      label: 'Up Next',
      description: 'Next episode/movie',
      isSubmenu: true
    },
    {
      path: '/media/custom-orders',
      icon: '📋',
      label: 'Custom Orders',
      description: 'Media playlists',
      isSubmenu: true
    },
    {
      path: '/media/watch-stats',
      icon: '📊',
      label: 'Watch Stats',
      description: 'Viewing activity',
      isSubmenu: true
    },
    {
      path: '/media/stash',
      icon: '🎬',
      label: 'Stash',
      description: 'Video library',
      isSubmenu: true
    },
    {
      path: '/media/music',
      icon: '🎵',
      label: 'Music',
      description: 'Music library',
      isSubmenu: true
    },
    {
      path: '/media/tv-browser',
      icon: '📺',
      label: 'TV Browser',
      description: 'Series, seasons, episodes',
      isSubmenu: true
    },
    {
      path: '/media/movie-browser',
      icon: '🎞️',
      label: 'Movie Browser',
      description: 'Movies and collections',
      isSubmenu: true
    },
    {
      path: '/media/backgrounds',
      icon: '🖼️',
      label: 'Backgrounds',
      description: 'Background images',
      isSubmenu: true
    },
    {
      path: '/media/books',
      icon: '📚',
      label: 'Books',
      description: 'Book library',
      isSubmenu: true
    },
    {
      path: '/media/games',
      icon: '🎮',
      label: 'Video Games',
      description: 'Game library',
      isSubmenu: true
    },
    {
      path: '/media/comics',
      icon: '📖',
      label: 'Comics',
      description: 'Comic library',
      isSubmenu: true
    },
    {
      path: '/media/settings',
      icon: '⚙️',
      label: 'Media Settings',
      description: 'Configure media',
      isSubmenu: true
    }
  ];

  return (
    <div className={`side-menu ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="side-menu-header">
        <div className="logo-section">
          {!isCollapsed && (
            <div className="logo-text">
              <h2>
                <img 
                  src={logoImage} 
                  alt="Eddie Logo" 
                  className="logo-image"
                  style={{ 
                    width: '24px', 
                    height: '24px', 
                    marginRight: '8px',
                    borderRadius: '50%',
                    display: 'inline-block',
                    verticalAlign: 'middle'
                  }}
                />
                Eddie
              </h2>
              <span className="logo-subtitle">Life Management</span>
            </div>
          )}
          {isCollapsed && (
            <div className="logo-collapsed">
              <img 
                src={logoImage} 
                alt="Eddie Logo" 
                className="logo-icon"
                style={{ 
                  width: '24px', 
                  height: '24px',
                  borderRadius: '50%'
                }}
              />
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
          {menuItems.map((item) => {
            // Handle media header differently
            if (item.isMediaHeader) {
              return (
                <li key={item.path} className="menu-item media-header">
                  {isCollapsed ? (
                    // When collapsed, make it a link to /media
                    <Link 
                      to={item.path} 
                      className={`menu-link media-header-link ${
                        location.pathname.startsWith('/media') ? 'active' : ''
                      }`}
                      title={item.label}
                      onClick={handleMenuItemClick()}
                    >
                      <span className="menu-icon">{item.icon}</span>
                    </Link>
                  ) : (
                    // When expanded, make it a toggle button
                    <div 
                      className={`menu-link media-header-link ${
                        location.pathname.startsWith('/media') ? 'active' : ''
                      }`}
                      title={item.label}
                      onClick={toggleMediaMenu}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <div className="menu-text">
                        <span className="menu-label">{item.label}</span>
                        <span className="menu-description">{item.description}</span>
                      </div>
                      <span className="collapse-arrow">
                        {isMediaCollapsed ? '▼' : '▲'}
                      </span>
                    </div>
                  )}
                </li>
              );
            }
            
            // Handle history header differently
            if (item.isHistoryHeader) {
              return (
                <li key={item.path} className="menu-item history-header">
                  {isCollapsed ? (
                    // When collapsed, make it a link to /history-plus
                    <Link 
                      to={item.path} 
                      className={`menu-link history-header-link ${
                        location.pathname.startsWith('/history-plus') ? 'active' : ''
                      }`}
                      title={item.label}
                      onClick={handleMenuItemClick()}
                    >
                      <span className="menu-icon">{item.icon}</span>
                    </Link>
                  ) : (
                    // When expanded, make it clickable for navigation with toggle arrow
                    <div className="history-header-container">
                      <Link 
                        to={item.path} 
                        className={`menu-link history-header-link ${
                          location.pathname.startsWith('/history-plus') ? 'active' : ''
                        }`}
                        title={item.label}
                        onClick={handleMenuItemClick()}
                        style={{ flex: 1, textDecoration: 'none' }}
                      >
                        <span className="menu-icon">{item.icon}</span>
                        <div className="menu-text">
                          <span className="menu-label">{item.label}</span>
                          <span className="menu-description">{item.description}</span>
                        </div>
                      </Link>
                      <button 
                        className="submenu-toggle"
                        onClick={toggleHistoryMenu}
                        title="Toggle submenu"
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'inherit', 
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: '12px'
                        }}
                      >
                        {isHistoryCollapsed ? '▼' : '▲'}
                      </button>
                    </div>
                  )}
                </li>
              );
            }
            
            // Handle submenu items - hide them when collapsed or when their parent is collapsed
            if (item.isSubmenu) {
              // Determine which parent this submenu belongs to
              const isMediaSubmenu = item.path.startsWith('/media/');
              const isHistorySubmenu = item.path.startsWith('/history-plus/');
              
              // Hide if sidebar is collapsed or if the specific parent is collapsed
              if (isCollapsed || 
                  (isMediaSubmenu && isMediaCollapsed) || 
                  (isHistorySubmenu && isHistoryCollapsed)) {
                return null;
              }
            }
            
            // Handle regular menu items
            return (
              <li key={item.path} className={`menu-item ${item.isSubmenu ? 'submenu-item' : ''}`}>
                <Link 
                  to={item.path} 
                  className={`menu-link ${
                    location.pathname === item.path || 
                    (item.path === '/media/custom-orders' && (location.pathname.startsWith('/custom-orders') || location.pathname.startsWith('/media/custom-orders'))) ||
                    (item.path === '/media/up-next' && (location.pathname === '/media' || location.pathname === '/media/')) ||
                    (item.path.startsWith('/media/') && location.pathname.replace('/media', '') === item.path.replace('/media', '')) ? 'active' : ''
                  }`}
                  title={isCollapsed ? item.label : ''}
                  onClick={handleMenuItemClick(item.path === '/media/custom-orders' || item.path === '/custom-orders' ? handleCustomOrdersClick : null)}
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
            );
          })}
        </ul>
      </nav>

      {!isCollapsed && (
        <div className="side-menu-footer">
          <div className="footer-text">
            <small>© 2025 Eddie Life Management</small>
          </div>
        </div>
      )}
    </div>
  );
};

export default SideMenu;
