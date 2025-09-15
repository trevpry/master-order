const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkIds() {
  const maxId = await prisma.historicalEvent.findFirst({
    orderBy: { id: 'desc' },
    select: { id: true, title: true }
  });
  
  const minId = await prisma.historicalEvent.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, title: true }
  });
  
  console.log('Min ID:', minId);
  console.log('Max ID:', maxId);
  
  // Check specific ID 453 (first from CSV)
  const event453 = await prisma.historicalEvent.findUnique({
    where: { id: 453 },
    select: { id: true, title: true }
  });
  
  console.log('Event 453:', event453);
  
  await prisma.$disconnect();
}

checkIds().catch(console.error);