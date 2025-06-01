const prisma = require('./server/prismaClient');

async function simpleTest() {
  try {
    const settings = await prisma.Settings.findUnique({ where: { id: 1 } });
    console.log('Settings:', JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simpleTest();
