const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testEthnicityTags() {
  try {
    console.log('\n=== Performers with Ethnicity Tags ===\n');
    
    const performers = await prisma.stashPerformer.findMany({
      where: { 
        ethnicityTagId: { not: null } 
      },
      select: { 
        name: true, 
        ethnicity: true, 
        ethnicityTagId: true,
        ethnicityTag: { 
          select: { 
            name: true 
          } 
        }
      },
      take: 10
    });
    
    if (performers.length === 0) {
      console.log('❌ No performers found with ethnicity tags!');
    } else {
      console.log(`✅ Found ${performers.length} performers with ethnicity tags:\n`);
      performers.forEach(p => {
        console.log(`  • ${p.name}`);
        console.log(`    - Text field: "${p.ethnicity}"`);
        console.log(`    - Tag: "${p.ethnicityTag?.name}" (ID: ${p.ethnicityTagId})\n`);
      });
    }
    
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testEthnicityTags();
