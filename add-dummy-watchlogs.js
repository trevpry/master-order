const { PrismaClient } = require('./server/node_modules/@prisma/client');

async function addDummyWatchLogs() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Adding dummy watch log data...');
    
    // Get existing items from each media type
    console.log('Fetching existing items...');
    
    const [movies, tvShows, customOrderItems] = await Promise.all([
      prisma.plexMovie.findMany({ take: 20, select: { id: true, title: true, ratingKey: true, duration: true } }),
      prisma.plexTVShow.findMany({ take: 20, select: { id: true, title: true, ratingKey: true } }),
      prisma.customOrderItem.findMany({ take: 10, select: { id: true, title: true, mediaType: true } })
    ]);
    
    console.log(`Found: ${movies.length} movies, ${tvShows.length} TV shows, ${customOrderItems.length} custom order items`);
    
    // Helper function to generate random date within past year
    const getRandomDateWithinYear = () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const randomTime = oneYearAgo.getTime() + Math.random() * (now.getTime() - oneYearAgo.getTime());
      return new Date(randomTime);
    };
    
    // Helper function to generate realistic watch times
    const getWatchTime = (mediaType, duration = null) => {
      switch (mediaType) {
        case 'movie': return duration ? Math.min(duration, Math.floor(duration * (0.8 + Math.random() * 0.4))) : Math.floor(90 + Math.random() * 60); // 90-150 min
        case 'tv': return Math.floor(20 + Math.random() * 40); // 20-60 min episodes
        case 'book': return Math.floor(30 + Math.random() * 120); // 30-150 min reading sessions
        case 'comic': return Math.floor(5 + Math.random() * 25); // 5-30 min
        case 'shortstory': return Math.floor(10 + Math.random() * 30); // 10-40 min
        default: return Math.floor(30 + Math.random() * 60);
      }
    };
    
    const watchLogsToCreate = [];
    
    // Add movie watch logs
    for (const movie of movies.slice(0, 15)) {
      const numWatches = Math.floor(1 + Math.random() * 3); // 1-3 watches per movie
      for (let i = 0; i < numWatches; i++) {
        const startTime = getRandomDateWithinYear();
        const watchTime = getWatchTime('movie', movie.duration);
        const endTime = new Date(startTime.getTime() + (watchTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: 'movie',
          title: movie.title,
          plexKey: movie.ratingKey,
          startTime,
          endTime,
          duration: movie.duration || watchTime,
          totalWatchTime: watchTime,
          isCompleted: Math.random() > 0.1 // 90% completion rate
        });
      }
    }
    
    // Add TV show watch logs (episodes)
    for (const show of tvShows.slice(0, 10)) {
      const numEpisodes = Math.floor(5 + Math.random() * 20); // 5-25 episodes per show
      for (let i = 0; i < numEpisodes; i++) {
        const season = Math.floor(1 + Math.random() * 5); // Seasons 1-5
        const episode = Math.floor(1 + Math.random() * 22); // Episodes 1-22
        const startTime = getRandomDateWithinYear();
        const watchTime = getWatchTime('tv');
        const endTime = new Date(startTime.getTime() + (watchTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: 'tv',
          title: `${show.title} - S${season}E${episode.toString().padStart(2, '0')}`,
          seriesTitle: show.title,
          seasonNumber: season,
          episodeNumber: episode,
          plexKey: `${show.ratingKey}_s${season}e${episode}`,
          startTime,
          endTime,
          duration: watchTime,
          totalWatchTime: watchTime,
          isCompleted: Math.random() > 0.05 // 95% completion rate for episodes
        });
      }
    }
    
    // Add some dummy book watch logs (since plexBook model doesn't exist, create fictional entries)
    const dummyBooks = [
      { title: 'Dune', ratingKey: 'book_1' },
      { title: 'Foundation', ratingKey: 'book_2' },
      { title: 'The Hitchhiker\'s Guide to the Galaxy', ratingKey: 'book_3' },
      { title: '1984', ratingKey: 'book_4' },
      { title: 'Brave New World', ratingKey: 'book_5' },
      { title: 'Fahrenheit 451', ratingKey: 'book_6' },
      { title: 'The Martian', ratingKey: 'book_7' },
      { title: 'Ready Player One', ratingKey: 'book_8' }
    ];
    
    for (const book of dummyBooks) {
      const numSessions = Math.floor(3 + Math.random() * 8); // 3-10 reading sessions per book
      for (let i = 0; i < numSessions; i++) {
        const startTime = getRandomDateWithinYear();
        const readTime = getWatchTime('book');
        const endTime = new Date(startTime.getTime() + (readTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: 'book',
          title: book.title,
          plexKey: book.ratingKey,
          startTime,
          endTime,
          duration: readTime,
          totalWatchTime: readTime,
          isCompleted: i === numSessions - 1 && Math.random() > 0.2 // Complete on last session 80% of time
        });
      }
    }
    
    // Add some dummy comic watch logs
    const dummyComics = [
      { title: 'Batman #1', ratingKey: 'comic_1' },
      { title: 'Superman #1', ratingKey: 'comic_2' },
      { title: 'Spider-Man #1', ratingKey: 'comic_3' },
      { title: 'X-Men #1', ratingKey: 'comic_4' },
      { title: 'The Walking Dead #1', ratingKey: 'comic_5' },
      { title: 'Watchmen #1', ratingKey: 'comic_6' },
      { title: 'The Dark Knight Returns', ratingKey: 'comic_7' }
    ];
    
    for (const comic of dummyComics) {
      const numReads = Math.floor(1 + Math.random() * 2); // 1-2 reads per comic
      for (let i = 0; i < numReads; i++) {
        const startTime = getRandomDateWithinYear();
        const readTime = getWatchTime('comic');
        const endTime = new Date(startTime.getTime() + (readTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: 'comic',
          title: comic.title,
          plexKey: comic.ratingKey,
          startTime,
          endTime,
          duration: readTime,
          totalWatchTime: readTime,
          isCompleted: Math.random() > 0.02 // 98% completion rate
        });
      }
    }
    
    // Add some dummy short story watch logs
    const dummyStories = [
      { title: 'The Tell-Tale Heart', ratingKey: 'story_1' },
      { title: 'The Lottery', ratingKey: 'story_2' },
      { title: 'The Gift of the Magi', ratingKey: 'story_3' },
      { title: 'A Good Man is Hard to Find', ratingKey: 'story_4' },
      { title: 'The Yellow Wallpaper', ratingKey: 'story_5' }
    ];
    
    for (const story of dummyStories) {
      const numReads = Math.floor(1 + Math.random() * 2); // 1-2 reads per story
      for (let i = 0; i < numReads; i++) {
        const startTime = getRandomDateWithinYear();
        const readTime = getWatchTime('shortstory');
        const endTime = new Date(startTime.getTime() + (readTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: 'shortstory',
          title: story.title,
          plexKey: story.ratingKey,
          startTime,
          endTime,
          duration: readTime,
          totalWatchTime: readTime,
          isCompleted: Math.random() > 0.05 // 95% completion rate
        });
      }
    }
    
    // Add custom order item watch logs
    for (const item of customOrderItems) {
      const numSessions = Math.floor(1 + Math.random() * 3); // 1-3 sessions per custom order item
      for (let i = 0; i < numSessions; i++) {
        const startTime = getRandomDateWithinYear();
        const watchTime = getWatchTime(item.mediaType || 'movie');
        const endTime = new Date(startTime.getTime() + (watchTime * 60 * 1000)); // Convert minutes to milliseconds
        
        watchLogsToCreate.push({
          mediaType: item.mediaType || 'movie',
          title: item.title,
          customOrderItemId: item.id,
          startTime,
          endTime,
          duration: watchTime,
          totalWatchTime: watchTime,
          isCompleted: Math.random() > 0.1 // 90% completion rate
        });
      }
    }
    
    // Sort by start time to create realistic chronological data
    watchLogsToCreate.sort((a, b) => a.startTime - b.startTime);
    
    console.log(`Creating ${watchLogsToCreate.length} dummy watch log entries...`);
    
    // Create watch logs in batches to avoid overwhelming the database
    const batchSize = 50;
    let created = 0;
    
    for (let i = 0; i < watchLogsToCreate.length; i += batchSize) {
      const batch = watchLogsToCreate.slice(i, i + batchSize);
      await prisma.watchLog.createMany({
        data: batch
      });
      created += batch.length;
      console.log(`Created batch ${Math.ceil((i + 1) / batchSize)} - ${created}/${watchLogsToCreate.length} entries`);
    }
    
    console.log('✅ Successfully added dummy watch log data!');
    
    // Show summary
    const summary = {
      movies: watchLogsToCreate.filter(log => log.mediaType === 'movie').length,
      tv: watchLogsToCreate.filter(log => log.mediaType === 'tv').length,
      books: watchLogsToCreate.filter(log => log.mediaType === 'book').length,
      comics: watchLogsToCreate.filter(log => log.mediaType === 'comic').length,
      stories: watchLogsToCreate.filter(log => log.mediaType === 'shortstory').length,
      customOrders: watchLogsToCreate.filter(log => log.customOrderItemId).length
    };
    
    console.log('\nSummary of dummy data created:');
    console.log(`🎬 Movies: ${summary.movies} watch logs`);
    console.log(`📺 TV Shows: ${summary.tv} episode logs`);
    console.log(`📚 Books: ${summary.books} reading session logs`);
    console.log(`📖 Comics: ${summary.comics} read logs`);
    console.log(`📝 Stories: ${summary.stories} read logs`);
    console.log(`🎯 Custom Orders: ${summary.customOrders} logs`);
    console.log(`📊 Total: ${created} watch log entries`);
    
  } catch (error) {
    console.error('Error adding dummy watch logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addDummyWatchLogs();
