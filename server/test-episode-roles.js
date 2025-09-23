const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const xml2js = require('xml2js');

async function testEpisodeRoles() {
  const prisma = new PrismaClient();
  
  try {
    // Get settings from database
    const settings = await prisma.settings.findUnique({
      where: { id: 1 }
    });
    
    if (!settings || !settings.plexToken || !settings.plexUrl) {
      console.log('Plex settings not configured');
      return;
    }
    
    const plexUrl = settings.plexUrl;
    const plexToken = settings.plexToken;
    
    // Get episode 44074 directly from Plex API
    console.log('Fetching episode 44074 from Plex API...');
    const response = await fetch(`${plexUrl}/library/metadata/44074?X-Plex-Token=${plexToken}`);
    const xmlText = await response.text();
    const parser = new xml2js.Parser({ explicitArray: false });
    const data = await parser.parseStringPromise(xmlText);
    
    if (data && data.MediaContainer && data.MediaContainer.Video) {
      const episode = data.MediaContainer.Video;
      console.log('\nEpisode Title:', episode.$.title);
      console.log('Episode Summary:', episode.$.summary?.substring(0, 100) + '...');
      console.log('Episode has Role field?', 'Role' in episode);
      
      if (episode.Role) {
        console.log('\nFound Role field with', Array.isArray(episode.Role) ? episode.Role.length : '1', 'roles:');
        const roles = Array.isArray(episode.Role) ? episode.Role : [episode.Role];
        roles.forEach((role, index) => {
          console.log(`  ${index + 1}. ${role.$.tag || role.$.title} (${role.$.role || 'Unknown role'})`);
        });
      } else {
        console.log('\nNo Role field found');
        console.log('Available fields:', Object.keys(episode));
      }
      
      // Also check if there's a different structure for TV roles
      console.log('\nAll episode data keys:', Object.keys(episode));
      
    } else {
      console.log('No episode data found');
      console.log('Response data:', JSON.stringify(data, null, 2));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testEpisodeRoles();