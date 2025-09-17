const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkComics() {
  const comics = await prisma.customOrderItem.findMany({
    where: { type: 'comic' },
    take: 5
  });
  
  console.log(`📚 Available comics: ${comics.length}`);
  comics.forEach(comic => {
    console.log(`  - ${comic.title}`);
    console.log(`    Series: ${comic.comicSeries}`);
    console.log(`    Issue: ${comic.comicIssue}`);
    console.log(`    ID: ${comic.id}`);
    console.log('');
  });
  
  await prisma.$disconnect();
}

checkComics().catch(console.error);