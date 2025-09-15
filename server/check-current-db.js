const { PrismaClient } = require('@prisma/client');

async function checkCurrentDatabase() {
  const prisma = new PrismaClient();
  
  try {
    const books = await prisma.books.findMany({ 
      select: { id: true, title: true },
      take: 10
    });
    
    const videos = await prisma.videos.findMany({ 
      select: { id: true, title: true },
      take: 10
    });
    
    const events = await prisma.events.findMany({ 
      select: { id: true },
      take: 10
    });
    
    console.log('=== CURRENT DATABASE STATE ===');
    console.log('Books:', books.length);
    if (books.length > 0) {
      console.log('Sample books:');
      books.forEach(b => console.log(`- ID: ${b.id}, Title: ${b.title?.substring(0, 50)}...`));
    }
    
    console.log('\nVideos:', videos.length);
    if (videos.length > 0) {
      console.log('Sample videos:');
      videos.forEach(v => console.log(`- ID: ${v.id}, Title: ${v.title?.substring(0, 50)}...`));
    }
    
    console.log('\nEvents:', events.length);
    if (events.length > 0) {
      console.log('Sample events:');
      events.forEach(e => console.log(`- ID: ${e.id}`));
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrentDatabase();