const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    const hierarchyCount = await prisma.stashTagHierarchy.count();
    const tagsWithParents = await prisma.stashTag.count({ 
      where: { parentTags: { some: {} } } 
    });
    const tagsWithChildren = await prisma.stashTag.count({ 
      where: { childTags: { some: {} } } 
    });
    
    console.log('Tag Hierarchy Stats:');
    console.log('  Total hierarchy relationships:', hierarchyCount);
    console.log('  Tags with parents:', tagsWithParents);
    console.log('  Tags with children:', tagsWithChildren);
    
    // Sample some tags with hierarchy
    const sampleTags = await prisma.stashTag.findMany({
      where: {
        OR: [
          { parentTags: { some: {} } },
          { childTags: { some: {} } }
        ]
      },
      include: {
        parentTags: {
          include: {
            parentTag: {
              select: { id: true, name: true }
            }
          }
        },
        childTags: {
          include: {
            childTag: {
              select: { id: true, name: true }
            }
          }
        }
      },
      take: 5
    });
    
    console.log('\nSample tags with hierarchy:');
    sampleTags.forEach(tag => {
      console.log(`\n  ${tag.name}:`);
      if (tag.parentTags.length > 0) {
        console.log(`    Parents: ${tag.parentTags.map(p => p.parentTag.name).join(', ')}`);
      }
      if (tag.childTags.length > 0) {
        console.log(`    Children: ${tag.childTags.map(c => c.childTag.name).join(', ')}`);
      }
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
})();
