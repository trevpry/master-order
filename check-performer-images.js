const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPerformerImages() {
  try {
    const performer = await prisma.stashPerformer.findFirst({
      where: { image: { not: null } }
    });
    
    console.log('Performer image URL:', performer?.image);
    
    const studio = await prisma.stashStudio.findFirst({
      where: { image: { not: null } }
    });
    
    console.log('Studio image URL:', studio?.image);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPerformerImages();
