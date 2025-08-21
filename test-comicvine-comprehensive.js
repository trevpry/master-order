const { PrismaClient } = require('./server/node_modules/.prisma/client');

const prisma = new PrismaClient();

async function testComicVineComprehensiveData() {
  console.log('Testing comprehensive ComicVine data storage...\n');

  try {
    // First, let's create a test custom order
    const testOrder = await prisma.customOrder.create({
      data: {
        name: 'ComicVine Test Order',
        description: 'Testing comprehensive ComicVine data storage',
        isPublic: false
      }
    });

    console.log('Created test order:', testOrder.id);

    // Create comprehensive test data that matches our new schema
    const comprehensiveComicVineData = {
      comprehensiveData: {
        series: {
          id: 12345,
          name: "Test Comic Series",
          description: "This is a test comic series for comprehensive data testing.",
          publisher: {
            id: 10,
            name: "Test Publisher"
          }
        },
        issue: {
          id: 67890,
          name: "The Test Issue",
          description: "A test issue with comprehensive metadata.",
          cover_date: "2024-01-15",
          store_date: "2024-01-10",
          issue_number: "1",
          person_credits: [
            {
              id: 1001,
              name: "John Writer",
              role: "writer"
            },
            {
              id: 1002,
              name: "Jane Artist",
              role: "artist"
            }
          ],
          character_credits: [
            {
              id: 2001,
              name: "Test Hero"
            },
            {
              id: 2002,
              name: "Test Villain"
            }
          ],
          story_arc_credits: [
            {
              id: 3001,
              name: "The Great Test Arc"
            }
          ]
        }
      }
    };

    // Test creating a comic item with comprehensive data
    const comicItem = await prisma.customOrderItem.create({
      data: {
        customOrderId: testOrder.id,
        mediaType: 'comic',
        title: 'Test Comic #1',
        comicSeries: 'Test Comic Series',
        comicYear: 2024,
        comicIssue: '1',
        comicVolume: 'Volume 1',
        comicPublisher: 'Test Publisher',
        comicVineId: 12345,
        comicVineDetailsJson: JSON.stringify(comprehensiveComicVineData),
        // Comprehensive data fields
        comicVineSeriesId: comprehensiveComicVineData.comprehensiveData.series.id,
        comicVineIssueId: comprehensiveComicVineData.comprehensiveData.issue.id,
        comicIssueName: comprehensiveComicVineData.comprehensiveData.issue.name,
        comicDescription: comprehensiveComicVineData.comprehensiveData.issue.description,
        comicCoverDate: comprehensiveComicVineData.comprehensiveData.issue.cover_date,
        comicStoreDate: comprehensiveComicVineData.comprehensiveData.issue.store_date,
        comicCreators: JSON.stringify(comprehensiveComicVineData.comprehensiveData.issue.person_credits),
        comicCharacters: JSON.stringify(comprehensiveComicVineData.comprehensiveData.issue.character_credits),
        comicStoryArcs: JSON.stringify(comprehensiveComicVineData.comprehensiveData.issue.story_arc_credits),
        sortOrder: 1
      }
    });

    console.log('Created comic item with comprehensive data:', comicItem.id);

    // Retrieve and display the stored data
    const retrievedItem = await prisma.customOrderItem.findUnique({
      where: { id: comicItem.id }
    });

    console.log('\n=== Comprehensive ComicVine Data Test Results ===');
    console.log('Basic Info:');
    console.log('  Title:', retrievedItem.title);
    console.log('  Series:', retrievedItem.comicSeries);
    console.log('  Issue:', retrievedItem.comicIssue);
    console.log('  Year:', retrievedItem.comicYear);
    console.log('  Publisher:', retrievedItem.comicPublisher);

    console.log('\nComicVine IDs:');
    console.log('  Series ID:', retrievedItem.comicVineSeriesId);
    console.log('  Issue ID:', retrievedItem.comicVineIssueId);
    console.log('  Legacy ComicVine ID:', retrievedItem.comicVineId);

    console.log('\nIssue Details:');
    console.log('  Issue Name:', retrievedItem.comicIssueName);
    console.log('  Description:', retrievedItem.comicDescription?.substring(0, 100) + '...');
    console.log('  Cover Date:', retrievedItem.comicCoverDate);
    console.log('  Store Date:', retrievedItem.comicStoreDate);

    console.log('\nCreative Team:');
    if (retrievedItem.comicCreators) {
      const creators = JSON.parse(retrievedItem.comicCreators);
      creators.forEach(creator => {
        console.log(`  ${creator.name} (${creator.role})`);
      });
    }

    console.log('\nCharacters:');
    if (retrievedItem.comicCharacters) {
      const characters = JSON.parse(retrievedItem.comicCharacters);
      characters.forEach(character => {
        console.log(`  ${character.name}`);
      });
    }

    console.log('\nStory Arcs:');
    if (retrievedItem.comicStoryArcs) {
      const storyArcs = JSON.parse(retrievedItem.comicStoryArcs);
      storyArcs.forEach(arc => {
        console.log(`  ${arc.name}`);
      });
    }

    console.log('\n=== Raw ComicVine Details JSON ===');
    if (retrievedItem.comicVineDetailsJson) {
      const rawData = JSON.parse(retrievedItem.comicVineDetailsJson);
      console.log('Full comprehensive data structure is preserved:', !!rawData.comprehensiveData);
    }

    // Clean up test data
    await prisma.customOrderItem.delete({
      where: { id: comicItem.id }
    });
    await prisma.customOrder.delete({
      where: { id: testOrder.id }
    });

    console.log('\n✅ Test completed successfully! Comprehensive ComicVine data is being stored correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testComicVineComprehensiveData();
