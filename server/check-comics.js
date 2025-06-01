const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkComics() {
  try {
    const comics = await prisma.customOrderItem.findMany({ 
      where: { type: 'comic' },
      include: { customOrder: true }
    });
    
    console.log(`Found ${comics.length} comics:`);
    comics.forEach(c => {
      console.log(`- ${c.title} (Order: ${c.customOrder.name})`);
      if (c.comicDetails) {
        console.log(`  Has ComicVine details: ${c.comicDetails.seriesName} #${c.comicDetails.issueNumber}`);
      } else {
        console.log(`  No ComicVine details`);
      }
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkComics();
