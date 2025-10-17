/**
 * Check and create action code tags
 * This script verifies that all required tags for GEVI action codes exist in the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const REQUIRED_TAGS = [
  'Oral - Give',
  'Oral - Receive',
  'Top',
  'Bottom',
  'Rim - Give',
  'Rim - Receive'
];

async function checkAndCreateTags() {
  console.log('🔍 Checking for required action code tags...\n');

  const missingTags = [];
  const existingTags = [];

  for (const tagName of REQUIRED_TAGS) {
    const tag = await prisma.stashTag.findFirst({
      where: { name: tagName }
    });

    if (tag) {
      existingTags.push(tagName);
      console.log(`✅ "${tagName}" - exists (ID: ${tag.id})`);
    } else {
      missingTags.push(tagName);
      console.log(`❌ "${tagName}" - missing`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Found: ${existingTags.length} tags`);
  console.log(`   Missing: ${missingTags.length} tags`);

  if (missingTags.length > 0) {
    console.log(`\n⚠️  Missing tags must be created in Stash before action code tagging will work.`);
    console.log(`   You can create them manually in Stash or run this script with --create flag.`);
    console.log(`\n   Missing tags: ${missingTags.join(', ')}`);
    
    // Check if --create flag was passed
    if (process.argv.includes('--create')) {
      console.log(`\n🔨 Creating missing tags...`);
      for (const tagName of missingTags) {
        try {
          const newTag = await prisma.stashTag.create({
            data: {
              name: tagName,
              description: `Auto-created for GEVI action code tagging`
            }
          });
          console.log(`✅ Created "${tagName}" (ID: ${newTag.id})`);
        } catch (error) {
          console.error(`❌ Failed to create "${tagName}":`, error.message);
        }
      }
      console.log(`\n✨ Tag creation complete!`);
    }
  } else {
    console.log(`\n✨ All required tags exist! Action code tagging is ready to use.`);
  }
}

checkAndCreateTags()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
