// Configuration for the Master Order app
const config = {
  // API base URL - change this to your computer's IP address for mobile access
  apiBaseUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3001' 
    : `http://${window.location.hostname}:3001`,
    
  // Alternative: you can hardcode your IP address if the above doesn't work
  // apiBaseUrl: 'http://192.168.1.252:3001',
};

// Debug logging to help troubleshoot
console.log('Config initialized:', {
  hostname: window.location.hostname,
  apiBaseUrl: config.apiBaseUrl,
  detectedAsLocal: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
});

export default config;
