// c:\Users\Trevor\Sites\master-order\server\prismaClient.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

// Singleton pattern to ensure only one Prisma client instance
let prismaInstance = null;

function createPrismaClient() {
  if (prismaInstance) {
    return prismaInstance;
  }

  console.log('🔗 Creating new Prisma client instance...');
  prismaInstance = new PrismaClient({
    log: ['info', 'warn', 'error'], // Enable more detailed logging
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  // Add graceful shutdown handler
  process.on('beforeExit', async () => {
    console.log('🔌 Prisma client disconnecting...');
    await prismaInstance.$disconnect();
    prismaInstance = null;
  });

  process.on('SIGINT', async () => {
    console.log('🔌 SIGINT received, disconnecting Prisma client...');
    await prismaInstance.$disconnect();
    prismaInstance = null;
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('🔌 SIGTERM received, disconnecting Prisma client...');
    await prismaInstance.$disconnect();
    prismaInstance = null;
    process.exit(0);
  });

  return prismaInstance;
}

const prisma = createPrismaClient();

module.exports = prisma;
