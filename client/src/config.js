// Configuration for the Master Order app
const config = {
  // API base URL - automatically detects and uses appropriate IP
  apiBaseUrl: (() => {
    const hostname = window.location.hostname;
    
    // In production/Docker, use relative URLs since frontend and backend are served from same port
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return window.location.origin; // Uses same protocol, hostname, and port as current page
    }
    
    // Development mode - backend runs on 3001, frontend on 5173
    const detectedUrl = 'http://localhost:3001';
    
    // Force server IP for mobile devices if they're somehow getting localhost
    if (navigator.userAgent.includes('Mobile')) {
      console.warn('🔧 MOBILE OVERRIDE: Forcing server IP instead of localhost');
      return 'http://192.168.1.113:3001';
    }
    
    return detectedUrl;
  })(),
};

// Backward compatibility alias
config.API_URL = config.apiBaseUrl;

export default config;
