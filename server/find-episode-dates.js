const axios = require('axios');
const prisma = require('./prismaClient');

async function findEpisodeWithDate() {
    try {
        const PLEX_URL = 'http://192.168.1.113:32400';
        const PLEX_TOKEN = 'Bazf-s9L36e4roJGMhHs';
        
        console.log('=== Finding Episodes with originallyAvailableAt Field ===');
        
        // Get some TV shows to test
        const shows = await prisma.plexTVShow.findMany({
            take: 3,
            where: {
                title: {
                    not: 'Notflix Marvel' // Skip the fan edit show
                }
            },
            select: {
                ratingKey: true,
                title: true
            }
        });
        
        for (const show of shows) {
            console.log(`\n=== Testing Show: ${show.title} ===`);
            
            try {
                // Get seasons for this show
                const seasonsResponse = await axios.get(`${PLEX_URL}/library/metadata/${show.ratingKey}/children?X-Plex-Token=${PLEX_TOKEN}`);
                
                if (seasonsResponse.data.MediaContainer.Metadata && seasonsResponse.data.MediaContainer.Metadata.length > 0) {
                    const firstSeason = seasonsResponse.data.MediaContainer.Metadata[0];
                    console.log(`Found season: ${firstSeason.title} (ratingKey: ${firstSeason.ratingKey})`);
                    
                    // Get episodes from this season
                    const episodeResponse = await axios.get(`${PLEX_URL}/library/metadata/${firstSeason.ratingKey}/children?X-Plex-Token=${PLEX_TOKEN}`);
                    
                    if (episodeResponse.data.MediaContainer.Metadata && episodeResponse.data.MediaContainer.Metadata.length > 0) {
                        const firstEpisode = episodeResponse.data.MediaContainer.Metadata[0];
                        
                        console.log(`Episode: ${firstEpisode.title}`);
                        console.log('Available date fields:');
                        Object.keys(firstEpisode).forEach(key => {
                            if (key.toLowerCase().includes('date') || key.toLowerCase().includes('available') || key.toLowerCase().includes('aired') || key.toLowerCase().includes('release')) {
                                console.log(`  ${key}: ${firstEpisode[key]}`);
                            }
                        });
                        
                        // Check if originallyAvailableAt exists
                        if (firstEpisode.originallyAvailableAt) {
                            console.log(`✅ Found originallyAvailableAt: ${firstEpisode.originallyAvailableAt}`);
                        } else {
                            console.log(`❌ No originallyAvailableAt field found`);
                        }
                        
                        // Show all fields for debugging
                        console.log('All fields:', Object.keys(firstEpisode).sort());
                        
                        break; // Found at least one episode, move to next show
                    } else {
                        console.log('No episodes found in first season');
                    }
                } else {
                    console.log('No seasons found in show');
                }
            } catch (error) {
                console.log(`Error testing show ${show.title}:`, error.message);
            }
        }
        
    } catch (error) {
        console.error('Error finding episodes:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

findEpisodeWithDate();
