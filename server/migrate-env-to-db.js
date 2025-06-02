const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function migrateEnvToDatabase() {
  try {
    console.log('Starting migration of environment variables to database...');
    console.log('Environment variables found:');
    console.log('- PLEX_TOKEN:', process.env.PLEX_TOKEN ? 'Set' : 'Not set');
    console.log('- PLEX_URL:', process.env.PLEX_URL || 'Not set');
    console.log('- TVDB_API_KEY:', process.env.TVDB_API_KEY ? 'Set' : 'Not set');
    console.log('- TVDB_BEARER_TOKEN:', process.env.TVDB_BEARER_TOKEN ? 'Set' : 'Not set');
    
    // Get current settings
    let settings = await prisma.settings.findFirst();
    console.log('Current settings found:', settings ? 'Yes' : 'No');
    
    if (!settings) {
      // Create settings record if it doesn't exist
      console.log('Creating new settings record...');
      settings = await prisma.settings.create({
        data: {}
      });
      console.log('Settings record created with ID:', settings.id);
    }
    
    // Update settings with environment variables
    console.log('Updating settings with environment variables...');
    const updatedSettings = await prisma.settings.update({
      where: { id: settings.id },
      data: {
        plexToken: process.env.PLEX_TOKEN || null,
        plexUrl: process.env.PLEX_URL || null,
        tvdbApiKey: process.env.TVDB_API_KEY || null,
        tvdbBearerToken: process.env.TVDB_BEARER_TOKEN || null,
      }
    });
    
    console.log('Successfully migrated environment variables to database:');
    console.log('- Plex Token:', updatedSettings.plexToken ? 'Set' : 'Not set');
    console.log('- Plex URL:', updatedSettings.plexUrl || 'Not set');
    console.log('- TVDB API Key:', updatedSettings.tvdbApiKey ? 'Set' : 'Not set');
    console.log('- TVDB Bearer Token:', updatedSettings.tvdbBearerToken ? 'Set' : 'Not set');
    
  } catch (error) {
    console.error('Error migrating environment variables:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateEnvToDatabase()
  .then(() => {
    console.log('Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });
