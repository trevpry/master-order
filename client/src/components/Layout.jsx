import React, { useState, useEffect } from 'react';
import SideMenu from './SideMenu';
import './Layout.css';

const Layout = ({ children }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleMobileMenu = () => {
    setIsSideMenuOpen(!isSideMenuOpen);
  };

  return (
    <div className="layout">
      {/* Mobile menu overlay */}
      {isMobile && isSideMenuOpen && (
        <div 
          className="mobile-overlay" 
          onClick={() => setIsSideMenuOpen(false)}
        />
      )}
      
      {/* Side Menu */}
      <div className={`side-menu-container ${isMobile && isSideMenuOpen ? 'mobile-open' : ''}`}>
        <SideMenu />
      </div>

      {/* Mobile Header with Menu Button */}
      {isMobile && (
        <header className="mobile-header">
          <button 
            className="mobile-menu-button"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
            <span className="hamburger-line"></span>
          </button>
          <h1 className="mobile-title">Master Order</h1>
        </header>
      )}

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;
