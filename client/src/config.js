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

// Debug logging to help troubleshoot mobile access issues
console.log('🔍 DETAILED CONFIG DEBUG:', {
  currentURL: window.location.href,
  hostname: window.location.hostname,
  port: window.location.port,
  protocol: window.location.protocol,
  apiBaseUrl: config.apiBaseUrl,
  isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
  userAgent: navigator.userAgent.includes('Mobile') ? 'Mobile' : 'Desktop',
  fullUserAgent: navigator.userAgent,
  timestamp: new Date().toISOString()
});

// Mobile-specific debugging and warnings
if (navigator.userAgent.includes('Mobile')) {
  console.log('📱 MOBILE DEVICE DETECTED');
  console.log('🎯 Final API URL will be:', config.apiBaseUrl);
  
  if (config.apiBaseUrl.includes('localhost')) {
    console.error('❌ CRITICAL: Mobile device is STILL using localhost API URL!');
    console.error('This indicates a configuration problem that needs investigation.');
  } else {
    console.log('✅ Mobile configuration looks correct - using server IP');
  }
  
  // Test the API endpoint
  console.log('🧪 Testing API connectivity...');
  fetch(config.apiBaseUrl + '/api/settings')
    .then(response => {
      console.log('✅ API test successful:', response.status);
    })
    .catch(error => {
      console.error('❌ API test failed:', error.message);
      console.error('This confirms the API URL is not reachable from mobile');
    });
}

export default config;
