// c:\Users\Trevor\Sites\master-order\server\prismaClient.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'], // Enable more detailed logging
});

// Add graceful shutdown handler to the process instead
process.on('beforeExit', async () => {
  console.log('Prisma client disconnecting...');
  await prisma.$disconnect();
});

module.exports = prisma;
