const { PrismaClient } = require('@prisma/client');
const fetch = require('node-fetch');
require('dotenv').config();

const prisma = new PrismaClient();

async function testPlexMovieCollections() {
  console.log('Starting test...');
  
  try {
    console.log('=== Testing Plex Movie Collections ===\n');
    
    const plexUrl = process.env.PLEX_URL || 'http://localhost:32400';
    const plexToken = process.env.PLEX_TOKEN;
    
    console.log('Plex URL:', plexUrl);
    console.log('Token available:', !!plexToken);
    
    // 1. Find "The X Files: I Want to Believe" in the database
    console.log('Searching for X Files movie in database...');
    const movie = await prisma.plexMovie.findFirst({
      where: {
        title: {
          contains: "X Files"
        }
      }
    });
    
    console.log('Database search result:', movie ? 'Found' : 'Not found');
    
    if (!movie) {
      console.log('❌ Movie not found in database');
      
      // Show all movies in database
      const allMovies = await prisma.plexMovie.findMany({
        select: {
          title: true,
          collections: true
        },
        take: 10
      });
      
      console.log('\nFirst 10 movies in database:');
      allMovies.forEach(m => console.log(`- ${m.title}`));
      return;
    }
    
    console.log('Movie in database:');
    console.log('- Title:', movie.title);
    console.log('- Rating Key:', movie.ratingKey);
    console.log('- Collections (stored):', movie.collections);
    console.log('');
    
    // 2. Get the raw Plex data for this movie
    const url = `${plexUrl}/library/metadata/${movie.ratingKey}?X-Plex-Token=${plexToken}`;
    console.log('Fetching raw Plex data from:', url);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Plex API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const movieMetadata = data.MediaContainer?.Metadata?.[0];
    
    if (!movieMetadata) {
      console.log('❌ No metadata found in Plex response');
      return;
    }
    
    console.log('Raw Plex data:');
    console.log('- Title:', movieMetadata.title);
    console.log('- Collections raw:', movieMetadata.Collection);
    console.log('- Labels raw:', movieMetadata.Label);
    console.log('- Genre raw:', movieMetadata.Genre);
    console.log('');
    
    // 3. Process collections like the sync service does
    const collections = movieMetadata.Collection ? 
      JSON.stringify(movieMetadata.Collection.map(c => c.tag || c.title)) : null;
    const labels = movieMetadata.Label ? 
      JSON.stringify(movieMetadata.Label.map(l => l.tag || l.title)) : null;
    
    console.log('Processed data:');
    console.log('- Collections (processed):', collections);
    console.log('- Labels (processed):', labels);
    console.log('');
    
    // 4. Show all movies that DO have collections
    const moviesWithCollections = await prisma.plexMovie.findMany({
      where: {
        collections: {
          not: null
        }
      },
      select: {
        title: true,
        collections: true
      },
      take: 5
    });
    
    console.log('Movies with collections (first 5):');
    moviesWithCollections.forEach(m => {
      const collections = m.collections ? JSON.parse(m.collections) : [];
      console.log(`- ${m.title}: ${collections.join(', ')}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPlexMovieCollections();
