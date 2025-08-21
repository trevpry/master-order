// c:\Users\Trevor\Sites\master-order\server\prismaClient.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['info', 'warn', 'error'], // Enable more detailed logging
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  __internal: {
    engine: {
      // SQLite-specific optimizations
      connectionTimeout: 20000,      // 20 seconds connection timeout
      queryTimeout: 30000,           // 30 seconds query timeout
      pool: {
        max: 1,                      // SQLite only supports 1 connection
        min: 1,
        createTimeoutMillis: 10000,  // 10 seconds to create connection
        acquireTimeoutMillis: 20000, // 20 seconds to acquire connection
        idleTimeoutMillis: 30000,    // 30 seconds idle timeout
        destroyTimeoutMillis: 5000   // 5 seconds to destroy connection
      }
    }
  }
});

// Add graceful shutdown handler to the process instead
process.on('beforeExit', async () => {
  console.log('Prisma client disconnecting...');
  await prisma.$disconnect();
});

module.exports = prisma;
