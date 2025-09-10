// c:\Users\Trevor\Sites\master-order\server\prismaClient.js
// Only load dotenv in development (not in Docker production)
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: '../.env' }); // Load from parent directory
  require('dotenv').config(); // Also try from current directory
}
const { PrismaClient } = require('@prisma/client');
const path = require('path');

console.log('🔍 Environment check:');
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'NOT SET');
console.log('  Working directory:', process.cwd());

// Singleton pattern to ensure only one Prisma client instance
let prismaInstance = null;

// Function to get database URL with optimizations
function getDatabaseUrl() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    // Production optimizations with connection pooling
    return 'file:/app/data/db/master_order.db?connection_limit=5&pool_timeout=30&socket_timeout=30';
  } else {
    // Development fallback - look for database in parent directory
    const dbPath = path.join(__dirname, '..', 'master_order.db');
    return `file:${dbPath}?connection_limit=3&pool_timeout=20`;
  }
}

function createPrismaClient() {
  if (prismaInstance) {
    return prismaInstance;
  }

  console.log('🔗 Creating new Prisma client instance...');
  
  // Build Prisma client configuration with optimizations
  const clientConfig = {
    log: process.env.NODE_ENV === 'development' ? ['info', 'warn', 'error'] : ['warn', 'error'], // Reduce logging in production
    
    // Add connection pooling and timeout settings for better performance
    datasources: {
      db: {
        url: process.env.DATABASE_URL || getDatabaseUrl()
      }
    }
  };
  
  
  // Determine database URL
  let databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    databaseUrl = getDatabaseUrl();
    console.log('⚠️ DATABASE_URL not found in environment, using fallback:', databaseUrl);
    
    // Override the datasources with our fallback
    clientConfig.datasources.db.url = databaseUrl;
  } else {
    console.log('🔧 Using DATABASE_URL from environment:', databaseUrl);
  }
  
  prismaInstance = new PrismaClient(clientConfig);

  // Add middleware to automatically calculate page/percentage values
  prismaInstance.$use(async (params, next) => {
    // Only intercept customOrderItem updates
    if (params.model === 'CustomOrderItem' && params.action === 'update') {
      const data = params.args.data;
      
      // If we're updating reading progress, calculate the missing value
      if (data.bookPercentRead !== undefined || data.bookCurrentPage !== undefined) {
        // Get the current item data to access bookPageCount
        const currentItem = await prismaInstance.customOrderItem.findUnique({
          where: params.args.where,
          select: { bookPageCount: true, bookCurrentPage: true, bookPercentRead: true }
        });
        
        const pageCount = data.bookPageCount !== undefined ? data.bookPageCount : currentItem?.bookPageCount;
        
        if (pageCount && pageCount > 0) {
          // If percentage was updated but not current page, calculate current page
          if (data.bookPercentRead !== undefined && data.bookCurrentPage === undefined) {
            const calculatedPage = Math.round((data.bookPercentRead / 100) * pageCount);
            data.bookCurrentPage = calculatedPage;
            console.log(`[Prisma Middleware] Calculated bookCurrentPage from ${data.bookPercentRead}%: ${calculatedPage}`);
          }
          
          // If current page was updated but not percentage, calculate percentage
          if (data.bookCurrentPage !== undefined && data.bookPercentRead === undefined) {
            const calculatedPercent = Math.min(100, Math.round((data.bookCurrentPage / pageCount) * 100));
            data.bookPercentRead = calculatedPercent;
            console.log(`[Prisma Middleware] Calculated bookPercentRead from page ${data.bookCurrentPage}: ${calculatedPercent}%`);
          }
        }
      }
    }
    
    return next(params);
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
