const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPerformer() {
  const performer = await prisma.stashPerformer.findUnique({
    where: { id: '7964' },
    select: {
      name: true,
      penis_length: true,
      circumcised: true,
      height: true,
      weight: true
    }
  });
  
  console.log('Database values:');
  console.log(JSON.stringify(performer, null, 2));
  
  await prisma.$disconnect();
}

checkPerformer().catch(console.error);
