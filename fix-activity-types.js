const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function fixActivityTypes() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Fixing activityType for existing watch logs...');
    
    // Update books, comics, and short stories to have activityType = 'read'
    const readMediaTypes = ['book', 'comic', 'shortstory'];
    
    for (const mediaType of readMediaTypes) {
      const result = await prisma.watchLog.updateMany({
        where: {
          mediaType: mediaType,
          activityType: 'watch' // Only update those that have the default 'watch' value
        },
        data: {
          activityType: 'read'
        }
      });
      
      console.log(`Updated ${result.count} ${mediaType} logs to activityType = 'read'`);
    }
    
    console.log('✅ Successfully updated activity types!');
    
  } catch (error) {
    console.error('Error updating activity types:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixActivityTypes();
