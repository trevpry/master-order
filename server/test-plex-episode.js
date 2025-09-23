const fetch = require('node-fetch');

async function testPlexEpisodeData() {
  try {
    // Use hardcoded values for testing
    const plexUrl = 'http://192.168.1.50:32400';  // Replace with your Plex server URL
    const plexToken = process.env.PLEX_TOKEN || 'your_plex_token_here';  // Set in environment or replace
    
    console.log('Testing Plex episode data...');
    
    // Test the specific episode we know exists: 44074
    const episodeKey = '44074';
    const url = `${plexUrl}/library/metadata/${episodeKey}?X-Plex-Token=${plexToken}`;
    
    console.log('Fetching episode data from Plex...');
    console.log('URL:', url.replace(plexToken, 'TOKEN_HIDDEN'));
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    const episode = data.MediaContainer?.Metadata?.[0];
    
    if (episode) {
      console.log('Episode found:');
      console.log('Title:', episode.title);
      console.log('Show:', episode.grandparentTitle);
      console.log('Season:', episode.parentIndex, 'Episode:', episode.index);
      console.log('Has Role data:', !!episode.Role);
      console.log('Role count:', episode.Role ? episode.Role.length : 0);
      
      if (episode.Role && episode.Role.length > 0) {
        console.log('First few roles:');
        episode.Role.slice(0, 3).forEach(role => {
          console.log(`- ${role.tag || role.title}: ${role.role || 'N/A'}`);
        });
      } else {
        console.log('No roles found in episode data');
        console.log('Available fields:', Object.keys(episode));
      }
    } else {
      console.log('Episode not found in Plex response');
      console.log('Response:', data);
    }
    
  } catch (error) {
    console.error('Error testing Plex episode data:', error.message);
  }
}

testPlexEpisodeData();