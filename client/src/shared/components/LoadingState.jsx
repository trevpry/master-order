import React from 'react';

/**
 * Standardized Loading State Component
 * 
 * This component provides consistent loading states across the application
 * while maintaining exact compatibility with existing styles and behavior.
 * It does NOT introduce new CSS - it uses existing CSS classes exactly as they are.
 * 
 * Usage patterns supported:
 * 1. Spinner text: <LoadingState type="spinner" /> → <span className="spinner">⟳</span>
 * 2. Loading div: <LoadingState type="div" /> → <div className="loading-spinner"></div>
 * 3. Loading div with text: <LoadingState type="div" message="Loading data..." />
 * 4. Loading container: <LoadingState type="container" />
 */
const LoadingState = ({ 
  type = 'div',              // 'spinner', 'div', 'container'
  message = null,            // Text to display (only for certain types)
  className = ''             // Additional CSS classes
}) => {
  
  if (type === 'spinner') {
    // Matches: <span className="spinner">⟳</span>
    return (
      <span className={`spinner${className ? ' ' + className : ''}`}>
        ⟳
      </span>
    );
  }
  
  if (type === 'container') {
    // Matches: <div className="loading-container">...</div>
    return (
      <div className={`loading-container${className ? ' ' + className : ''}`}>
        <div className="loading-spinner"></div>
        {message && <div>{message}</div>}
      </div>
    );
  }
  
  // Default: type === 'div'
  // Matches: <div className="loading-spinner">optional text</div>
  return (
    <div className={`loading-spinner${className ? ' ' + className : ''}`}>
      {message || ''}
    </div>
  );
};

export default LoadingState;
