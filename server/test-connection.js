const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testConnection() {
  try {
    console.log('Testing database connection...');
    const movieCount = await prisma.plexMovie.count();
    console.log('Movie count:', movieCount);
    
    const showCount = await prisma.plexTVShow.count();
    console.log('TV show count:', showCount);
    
    // Get a sample movie with collections
    const sampleMovie = await prisma.plexMovie.findFirst({
      where: {
        collections: {
          not: null
        }
      }
    });
    
    if (sampleMovie) {
      console.log('Sample movie with collections:', sampleMovie.title);
      console.log('Collections:', sampleMovie.collections);
    } else {
      console.log('No movies with collections found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
