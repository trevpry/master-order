const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedCategories() {
  try {
    // Check if categories already exist
    const existingCount = await prisma.historyCategory.count();
    
    if (existingCount > 0) {
      console.log(`Categories already exist (${existingCount} found). Skipping seed.`);
      return;
    }
    
    // Insert default categories
    const defaultCategories = [
      { name: 'Ancient History', color: '#8B5CF6', description: 'Events from ancient civilizations' },
      { name: 'Medieval History', color: '#059669', description: 'Medieval period events' },
      { name: 'Renaissance', color: '#DC2626', description: 'Renaissance period events' },
      { name: 'Modern History', color: '#2563EB', description: 'Modern historical events' },
      { name: 'World War I', color: '#B45309', description: 'First World War events' },
      { name: 'World War II', color: '#7C2D12', description: 'Second World War events' },
      { name: 'Cold War', color: '#374151', description: 'Cold War period events' },
      { name: 'Science & Technology', color: '#0891B2', description: 'Scientific and technological advancements' },
      { name: 'Philosophy', color: '#7C3AED', description: 'Philosophical movements and thinkers' },
      { name: 'Literature', color: '#BE185D', description: 'Literary works and movements' },
      { name: 'Art & Culture', color: '#EA580C', description: 'Artistic and cultural events' },
      { name: 'Politics', color: '#DC2626', description: 'Political events and movements' },
      { name: 'Religion', color: '#059669', description: 'Religious events and movements' },
      { name: 'Economics', color: '#0D9488', description: 'Economic events and developments' },
      { name: 'Ancient Egypt', color: '#D97706', description: 'Ancient Egyptian civilization events' }
    ];
    
    for (const category of defaultCategories) {
      await prisma.historyCategory.create({ data: category });
    }
    
    console.log(`Successfully seeded ${defaultCategories.length} categories`);
  } catch (error) {
    console.error('Error seeding categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCategories();