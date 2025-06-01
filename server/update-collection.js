const prisma = require('./prismaClient');

async function updateSettings() {
  try {
    console.log('Updating collection setting...');
    
    // Update to use a collection that likely has content
    // Using "Richard Kimble Collection" as an example since U.S. Marshals and The Fugitive would be in that
    const updated = await prisma.Settings.upsert({
      where: { id: 1 },
      update: {
        collectionName: 'Richard Kimble Collection'
      },
      create: {
        id: 1,
        collectionName: 'Richard Kimble Collection',
        tvGeneralPercent: 50,
        moviesGeneralPercent: 50,
        customOrderPercent: 0
      }
    });
    
    console.log('Updated settings:', updated);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateSettings();
