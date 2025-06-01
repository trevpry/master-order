const axios = require('axios');
const prisma = require('./prismaClient');

async function findAllPlexFields() {
    try {
        const PLEX_URL = 'http://192.168.1.113:32400';
        const PLEX_TOKEN = 'Bazf-s9L36e4roJGMhHs';
        
        console.log('=== Gathering All Plex API Fields ===\n');
        
        // Get movie fields
        console.log('=== MOVIE FIELDS ===');
        const movies = await prisma.plexMovie.findMany({ take: 1 });
        if (movies.length > 0) {
            const movieResponse = await axios.get(`${PLEX_URL}/library/metadata/${movies[0].ratingKey}?X-Plex-Token=${PLEX_TOKEN}`);
            if (movieResponse.data.MediaContainer.Metadata && movieResponse.data.MediaContainer.Metadata.length > 0) {
                const movie = movieResponse.data.MediaContainer.Metadata[0];
                console.log('Movie fields:', Object.keys(movie).sort());
                console.log('');
            }
        }
        
        // Get TV show fields
        console.log('=== TV SHOW FIELDS ===');
        const shows = await prisma.plexTVShow.findMany({ take: 1 });
        if (shows.length > 0) {
            const showResponse = await axios.get(`${PLEX_URL}/library/metadata/${shows[0].ratingKey}?X-Plex-Token=${PLEX_TOKEN}`);
            if (showResponse.data.MediaContainer.Metadata && showResponse.data.MediaContainer.Metadata.length > 0) {
                const show = showResponse.data.MediaContainer.Metadata[0];
                console.log('TV Show fields:', Object.keys(show).sort());
                console.log('');
            }
        }
        
        // Get season fields
        console.log('=== SEASON FIELDS ===');
        const seasons = await prisma.plexSeason.findMany({ take: 1 });
        if (seasons.length > 0) {
            const seasonResponse = await axios.get(`${PLEX_URL}/library/metadata/${seasons[0].ratingKey}?X-Plex-Token=${PLEX_TOKEN}`);
            if (seasonResponse.data.MediaContainer.Metadata && seasonResponse.data.MediaContainer.Metadata.length > 0) {
                const season = seasonResponse.data.MediaContainer.Metadata[0];
                console.log('Season fields:', Object.keys(season).sort());
                console.log('');
            }
        }
        
        // Get episode fields
        console.log('=== EPISODE FIELDS ===');
        const episodes = await prisma.plexEpisode.findMany({ take: 1 });
        if (episodes.length > 0) {
            const episodeResponse = await axios.get(`${PLEX_URL}/library/metadata/${episodes[0].ratingKey}?X-Plex-Token=${PLEX_TOKEN}`);
            if (episodeResponse.data.MediaContainer.Metadata && episodeResponse.data.MediaContainer.Metadata.length > 0) {
                const episode = episodeResponse.data.MediaContainer.Metadata[0];
                console.log('Episode fields:', Object.keys(episode).sort());
                console.log('');
            }
        }
        
        // Get library section fields
        console.log('=== LIBRARY SECTION FIELDS ===');
        const sectionsResponse = await axios.get(`${PLEX_URL}/library/sections?X-Plex-Token=${PLEX_TOKEN}`);
        if (sectionsResponse.data.MediaContainer.Directory && sectionsResponse.data.MediaContainer.Directory.length > 0) {
            const section = sectionsResponse.data.MediaContainer.Directory[0];
            console.log('Library Section fields:', Object.keys(section).sort());
            console.log('');
        }
        
    } catch (error) {
        console.error('Error gathering fields:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

findAllPlexFields();
