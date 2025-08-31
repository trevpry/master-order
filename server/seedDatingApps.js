const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedDatingApps() {
  console.log('Seeding dating apps...');
  
  const apps = [
    {
      name: 'Scruff',
      description: 'Gay social network focused on the bear community and masculine men'
    },
    {
      name: 'Grindr',
      description: 'Location-based social networking app for gay men'
    },
    {
      name: 'Adam4Adam',
      description: 'Gay social networking website and mobile app'
    },
    {
      name: 'Growlr',
      description: 'Social networking app for gay bears and their admirers'
    },
    {
      name: 'Jack\'d',
      description: 'Gay social networking and dating app'
    },
    {
      name: 'Planet Romeo',
      description: 'European-focused gay social network'
    },
    {
      name: 'Hornet',
      description: 'Gay social network and dating app'
    },
    {
      name: 'Tinder',
      description: 'Location-based dating app'
    },
    {
      name: 'Hinge',
      description: 'Dating app designed to be deleted'
    },
    {
      name: 'Bumble',
      description: 'Dating app where women make the first move'
    }
  ];

  for (const app of apps) {
    try {
      const existingApp = await prisma.datingApp.findUnique({
        where: { name: app.name }
      });

      if (!existingApp) {
        await prisma.datingApp.create({
          data: app
        });
        console.log(`Created dating app: ${app.name}`);
      } else {
        console.log(`Dating app already exists: ${app.name}`);
      }
    } catch (error) {
      console.error(`Error creating dating app ${app.name}:`, error);
    }
  }

  console.log('Dating apps seeding completed!');
}

// Run if called directly
if (require.main === module) {
  seedDatingApps()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { seedDatingApps };
