const fetch = require('node-fetch');
const { PrismaClient } = require('@prisma/client');
const xml2js = require('xml2js');

async function compareJSONvsXML() {
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
    
    console.log('=== COMPARING JSON vs XML for episode 44074 ===\n');
    
    // Test JSON response (what our current sync uses)
    console.log('1. Testing JSON response (current sync method)...');
    const jsonResponse = await fetch(`${plexUrl}/library/metadata/44074?X-Plex-Token=${plexToken}`, {
      headers: {
        'Accept': 'application/json'
      }
    });
    const jsonData = await jsonResponse.json();
    console.log('JSON - Episode Title:', jsonData.MediaContainer?.Metadata?.[0]?.title || 'Not found');
    console.log('JSON - Has Role field?', 'Role' in (jsonData.MediaContainer?.Metadata?.[0] || {}));
    if (jsonData.MediaContainer?.Metadata?.[0]?.Role) {
      console.log('JSON - Role count:', jsonData.MediaContainer.Metadata[0].Role.length);
    }
    console.log('JSON - Available fields:', Object.keys(jsonData.MediaContainer?.Metadata?.[0] || {}));
    
    console.log('\n2. Testing XML response...');
    const xmlResponse = await fetch(`${plexUrl}/library/metadata/44074?X-Plex-Token=${plexToken}`);
    const xmlText = await xmlResponse.text();
    const parser = new xml2js.Parser({ explicitArray: false });
    const xmlData = await parser.parseStringPromise(xmlText);
    
    console.log('XML - Episode Title:', xmlData.MediaContainer?.Video?.$.title || 'Not found');
    console.log('XML - Has Role field?', 'Role' in (xmlData.MediaContainer?.Video || {}));
    if (xmlData.MediaContainer?.Video?.Role) {
      const roles = Array.isArray(xmlData.MediaContainer.Video.Role) ? xmlData.MediaContainer.Video.Role : [xmlData.MediaContainer.Video.Role];
      console.log('XML - Role count:', roles.length);
    }
    console.log('XML - Available fields:', Object.keys(xmlData.MediaContainer?.Video || {}));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

compareJSONvsXML();