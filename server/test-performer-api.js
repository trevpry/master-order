const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testPerformerAPI() {
  try {
    // Find a performer with an ethnicity tag
    const performer = await prisma.stashPerformer.findFirst({
      where: { 
        ethnicityTagId: { not: null } 
      },
      select: { 
        id: true,
        name: true 
      }
    });
    
    if (!performer) {
      console.log('❌ No performers found with ethnicity tags');
      await prisma.$disconnect();
      process.exit(1);
    }
    
    console.log(`\n✅ Testing API endpoint for performer: ${performer.name} (ID: ${performer.id})`);
    console.log(`\nTest URL: http://localhost:3001/api/stash/performers/${performer.id}`);
    console.log('\nExpected response should include:');
    console.log('  - ethnicity: "Caucasian" (or other text value)');
    console.log('  - ethnicityTag: { id: "157", name: "White" } (or similar)');
    console.log('\n📝 Make a request to this URL to verify the ethnicityTag is included in the response.\n');
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testPerformerAPI();
