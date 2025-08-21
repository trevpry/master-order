// c:\Users\Trevor\Sites\master-order\server\prismaClient.js
require('dotenv').config({ path: '../.env' }); // Load from parent directory
require('dotenv').config(); // Also try from current directory
const { PrismaClient } = require('@prisma/client');
const path = require('path');

console.log('🔍 Environment check:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('  Working directory:', process.cwd());

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
  
  // Determine database URL
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    // Fallback to default based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    
    if (isProduction) {
      databaseUrl = 'file:/app/data/db/master_order.db?connection_limit=1&pool_timeout=20&socket_timeout=20';
    } else {
      // Development fallback - look for database in parent directory
      const dbPath = path.join(__dirname, '..', 'master_order.db');
      databaseUrl = `file:${dbPath}`;
    }
    
    console.log('⚠️ DATABASE_URL not found in environment, using fallback:', databaseUrl);
    
    // Override the datasources with our fallback
    clientConfig.datasources = {
      db: {
        url: databaseUrl
      }
    };
  } else {
    console.log('🔧 Using DATABASE_URL from environment:', databaseUrl);
    
    // Only override datasources if we want to customize the URL
    if (databaseUrl !== process.env.DATABASE_URL) {
      clientConfig.datasources = {
        db: {
          url: databaseUrl
        }
      };
    }
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
