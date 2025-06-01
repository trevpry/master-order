// Test basic Plex connection
// Load environment variables from server directory
require('dotenv').config({ path: './server/.env' });
const PlexSyncService = require('./server/plexSyncService');

async function testConnection() {
  console.log('Testing Plex connection...');
  
  try {
    const syncService = new PlexSyncService();
    console.log('PlexSyncService instantiated successfully');
    
    // Try to get library sections
    console.log('Attempting to get library sections...');
    const sections = await syncService.syncLibrarySections();
    console.log(`Success! Found ${sections.length} library sections:`);
    sections.forEach(section => {
      console.log(`  - ${section.title} (${section.type})`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testConnection();
