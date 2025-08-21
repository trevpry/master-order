const prisma = require('./prismaClient');

async function addTestCharacterData() {
  try {
    console.log('=== Adding Test Character Data ===\n');

    // Get the comic
    const comic = await prisma.customOrderItem.findFirst({
      where: { mediaType: 'comic' }
    });

    if (!comic) {
      console.log('No comic found');
      return;
    }

    console.log('Found comic:', comic.title);
    
    // Create some test character data
    const testCharacters = [
      { id: 1, name: "Jake Sully" },
      { id: 2, name: "Neytiri" },
      { id: 3, name: "Tsu'tey" },
      { id: 4, name: "Mo'at" }
    ];

    // Update the comic with test character data
    await prisma.customOrderItem.update({
      where: { id: comic.id },
      data: {
        comicCharacters: JSON.stringify(testCharacters)
      }
    });

    console.log('✅ Added test character data to comic');
    console.log('Test characters:', testCharacters.map(c => c.name).join(', '));

    // Verify the update
    const updatedComic = await prisma.customOrderItem.findUnique({
      where: { id: comic.id }
    });

    if (updatedComic.comicCharacters) {
      const characters = JSON.parse(updatedComic.comicCharacters);
      console.log('\n✅ Verification successful!');
      console.log('Stored characters:', characters.map(c => c.name).join(', '));
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addTestCharacterData();
