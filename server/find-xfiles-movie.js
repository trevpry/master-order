const fetch = require('node-fetch');
require('dotenv').config();

async function findXFilesMovie() {
  try {
    console.log('=== Finding X Files Movie Across All Sections ===\n');
    
    const plexUrl = process.env.PLEX_URL || 'http://localhost:32400';
    const plexToken = process.env.PLEX_TOKEN;
    
    // 1. Get all library sections
    console.log('1. Getting all library sections:');
    const sectionsUrl = `${plexUrl}/library/sections?X-Plex-Token=${plexToken}`;
    const sectionsResponse = await fetch(sectionsUrl, {
      headers: { 'Accept': 'application/json' }
    });
    
    const sectionsData = await sectionsResponse.json();
    const sections = sectionsData.MediaContainer?.Directory || [];
    
    console.log('Available sections:');
    sections.forEach(section => {
      console.log(`- Section ${section.key}: ${section.title} (${section.type})`);
    });
    console.log('');
    
    // 2. Search for X Files in each movie section
    for (const section of sections) {
      if (section.type === 'movie') {
        console.log(`2. Searching in section ${section.key} (${section.title}):`);
        
        const moviesUrl = `${plexUrl}/library/sections/${section.key}/all?type=1&X-Plex-Token=${plexToken}`;
        const moviesResponse = await fetch(moviesUrl, {
          headers: { 'Accept': 'application/json' }
        });
        
        const moviesData = await moviesResponse.json();
        const movies = moviesData.MediaContainer?.Metadata || [];
        
        console.log(`- Total movies in section: ${movies.length}`);
        
        // Find X Files movies
        const xFilesMovies = movies.filter(m => 
          m.title?.toLowerCase().includes('x files') || 
          m.title?.toLowerCase().includes('x-files')
        );
        
        console.log(`- X Files movies found: ${xFilesMovies.length}`);
        
        xFilesMovies.forEach(movie => {
          console.log(`  * ${movie.title} (${movie.ratingKey})`);
          console.log(`    - Has Collection property: ${'Collection' in movie}`);
          console.log(`    - Collections: ${movie.Collection ? JSON.stringify(movie.Collection.map(c => c.tag || c.title)) : 'none'}`);
        });
        
        // If we found X Files movies, test individual endpoint
        if (xFilesMovies.length > 0) {
          const movie = xFilesMovies[0];
          console.log(`\n3. Testing individual endpoint for "${movie.title}":`);
          
          const individualUrl = `${plexUrl}/library/metadata/${movie.ratingKey}?X-Plex-Token=${plexToken}`;
          const individualResponse = await fetch(individualUrl, {
            headers: { 'Accept': 'application/json' }
          });
          
          const individualData = await individualResponse.json();
          const individualMovie = individualData.MediaContainer?.Metadata?.[0];
          
          console.log('- Individual endpoint collections:', individualMovie?.Collection);
          console.log('- Processed collections:', individualMovie?.Collection ? 
            JSON.stringify(individualMovie.Collection.map(c => c.tag || c.title)) : 'none');
        }
        
        console.log('');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findXFilesMovie();
