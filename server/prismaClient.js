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
  
  // Build Prisma client configuration
  const clientConfig = {
    log: ['info', 'warn', 'error'], // Enable more detailed logging
  };
  
  // Only override datasources if DATABASE_URL is explicitly set
  if (process.env.DATABASE_URL) {
    clientConfig.datasources = {
      db: {
        url: process.env.DATABASE_URL
      }
    };
    console.log('🔧 Using custom DATABASE_URL:', process.env.DATABASE_URL);
  } else {
    console.log('🔧 Using default DATABASE_URL from schema.prisma');
  }
  
  prismaInstance = new PrismaClient(clientConfig);

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
