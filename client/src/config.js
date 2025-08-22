// Configuration for the Master Order app
const config = {
  // API base URL - automatically detects and uses appropriate IP
  apiBaseUrl: (() => {
    const hostname = window.location.hostname;
    const detectedUrl = hostname === 'localhost' || hostname === '127.0.0.1' 
      ? 'http://localhost:3001' 
      : `http://${hostname}:3001`;
    
    // Force server IP for mobile devices if they're somehow getting localhost
    if (navigator.userAgent.includes('Mobile') && detectedUrl.includes('localhost')) {
      console.warn('🔧 MOBILE OVERRIDE: Forcing server IP instead of localhost');
      return 'http://192.168.1.252:3001';
    }
    
    return detectedUrl;
  })(),
};

export default config;
