import React, { useEffect } from 'react';
import config from '../../../../../config.js';

const StashSlideshowModal = ({
  slideshow,
  setSlideshow,
  nextSlide,
  prevSlide,
  handleSlideshowKeyDown,
  toggleSlideshowFullscreen
}) => {
  // Set up keyboard event listeners
  useEffect(() => {
    if (slideshow.isActive) {
      document.addEventListener('keydown', handleSlideshowKeyDown);
      return () => document.removeEventListener('keydown', handleSlideshowKeyDown);
    }
  }, [slideshow.isActive, handleSlideshowKeyDown]);

  // Auto-advance slideshow
  useEffect(() => {
    if (slideshow.isActive && slideshow.autoAdvance && !slideshow.isPaused && slideshow.images.length > 1) {
      const timer = setInterval(() => {
        nextSlide();
      }, slideshow.interval);
      
      return () => clearInterval(timer);
    }
  }, [slideshow.isActive, slideshow.autoAdvance, slideshow.isPaused, slideshow.interval, slideshow.images.length, nextSlide]);

  if (!slideshow.isActive) {
    return null;
  }

  return (
    <div 
      className={`slideshow-modal ${slideshow.isFullscreen ? 'fullscreen' : ''}`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999
      }}
    >
      {/* Slideshow Controls */}
      <div 
        className="slideshow-controls"
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          gap: '10px',
          zIndex: 10001
        }}
      >
        {/* Navigation Controls */}
        <button
          onClick={prevSlide}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title="Previous Image (← or A)"
        >
          ←
        </button>
        
        <button
          onClick={nextSlide}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title="Next Image (→ or D)"
        >
          →
        </button>
        
        {/* Pause/Play Button */}
        <button
          onClick={() => setSlideshow(prev => ({ ...prev, isPaused: !prev.isPaused }))}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title={slideshow.isPaused ? 'Resume Slideshow (Space)' : 'Pause Slideshow (Space)'}
        >
          {slideshow.isPaused ? '▶️' : '⏸️'}
        </button>
        
        {/* Settings Toggle */}
        <button
          onClick={() => setSlideshow(prev => ({ ...prev, showSettings: !prev.showSettings }))}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title="Settings (S)"
        >
          ⚙️
        </button>
        
        {/* Close Button */}
        <button
          onClick={() => {
            // Exit fullscreen when closing slideshow
            if (document.exitFullscreen) {
              document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
              document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
              document.msExitFullscreen();
            }
            setSlideshow(prev => ({ ...prev, isActive: false }));
          }}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title="Close Slideshow (ESC)"
        >
          ✕
        </button>
        
        {/* Fullscreen Toggle */}
        <button
          onClick={toggleSlideshowFullscreen}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            color: 'white',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
          title={slideshow.isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
        >
          {slideshow.isFullscreen ? '🗗' : '🗖'}
        </button>
      </div>

      {/* Settings Panel */}
      {slideshow.showSettings && (
        <div 
          className="slideshow-settings"
          style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '20px',
            borderRadius: '8px',
            minWidth: '250px',
            zIndex: 10001
          }}
        >
          <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Slideshow Settings</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>
              Interval: {slideshow.interval / 1000}s
            </label>
            <input
              type="range"
              min="1000"
              max="30000"
              step="1000"
              value={slideshow.interval}
              onChange={(e) => setSlideshow(prev => ({ ...prev, interval: parseInt(e.target.value) }))}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '2px' }}>
              1s - 30s
            </div>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={slideshow.includeGalleries}
                onChange={(e) => setSlideshow(prev => ({ ...prev, includeGalleries: e.target.checked }))}
                style={{ marginRight: '8px' }}
              />
              Include Gallery Images
            </label>
          </div>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={slideshow.includeStandalone}
                onChange={(e) => setSlideshow(prev => ({ ...prev, includeStandalone: e.target.checked }))}
                style={{ marginRight: '8px' }}
              />
              Include Standalone Images
            </label>
          </div>
          
          <div style={{ fontSize: '12px', opacity: 0.7, lineHeight: '1.4' }}>
            Use arrow keys or A/D to navigate • Space to pause/resume • ESC to close
          </div>
        </div>
      )}

      {/* Image Counter */}
      {slideshow.images.length > 0 && (
        <div 
          className="slideshow-counter"
          style={{
            position: 'absolute',
            bottom: '20px',
            right: '20px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '5px',
            fontSize: '14px',
            zIndex: 10001
          }}
        >
          {slideshow.currentIndex + 1} / {slideshow.images.length}
        </div>
      )}

      {/* Current Image */}
      {slideshow.images.length > 0 && slideshow.images[slideshow.currentIndex] && (
        <div 
          className="slideshow-image-container"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}
        >
          <img
            src={slideshow.images[slideshow.currentIndex].url}
            alt={slideshow.images[slideshow.currentIndex].title || 'Stash Image'}
            style={slideshow.isFullscreen ? {
              maxWidth: '100vw',
              maxHeight: '100vh',
              width: '100%',
              height: '100vh',
              objectFit: 'contain'
            } : {
              maxWidth: '100vw',
              maxHeight: '100vh',
              width: 'auto',
              height: 'auto',
              objectFit: 'contain'
            }}
            onError={(e) => {
              console.error('Failed to load image:', slideshow.images[slideshow.currentIndex].url);
              // Try next image if current fails to load
              nextSlide();
            }}
          />
          
          {/* Image info overlay */}
          <div 
            className="slideshow-info"
            style={{
              position: 'absolute',
              top: '20px',
              left: '20px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              color: 'white',
              padding: '15px',
              borderRadius: '5px',
              maxWidth: '400px'
            }}
          >
            {slideshow.images[slideshow.currentIndex].title && (
              <h3 style={{ margin: '0 0 10px 0', fontSize: '18px' }}>
                {slideshow.images[slideshow.currentIndex].title}
              </h3>
            )}
            
            {slideshow.images[slideshow.currentIndex].gallery && (
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                📁 {slideshow.images[slideshow.currentIndex].gallery.title}
              </p>
            )}
            
            {slideshow.images[slideshow.currentIndex].performers && slideshow.images[slideshow.currentIndex].performers.length > 0 && (
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                👥 {slideshow.images[slideshow.currentIndex].performers.map(p => p.name).join(', ')}
              </p>
            )}
            
            {slideshow.images[slideshow.currentIndex].photographer && (
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                📸 {slideshow.images[slideshow.currentIndex].photographer}
              </p>
            )}
            
            {slideshow.images[slideshow.currentIndex].studioObject && (
              <p style={{ margin: '5px 0', fontSize: '14px' }}>
                🏢 {slideshow.images[slideshow.currentIndex].studioObject.name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StashSlideshowModal;
