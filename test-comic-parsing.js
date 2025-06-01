// Test comic parsing logic
const testComicParsing = () => {
  const testLine = "The High Republic Adventures (2022) #7\t\tThe High Republic Adventures (2022) #7\tcomic";
  const columns = testLine.split('\t');
  console.log('Columns:', columns);
  
  const [seriesOrMovie, seasonEpisode, title, rawMediaType] = columns.map(col => col.trim());
  console.log('Parsed values:', { seriesOrMovie, seasonEpisode, title, rawMediaType });
  
  const mediaType = rawMediaType.toLowerCase();
  console.log('Media type:', mediaType);
  
  if (mediaType === 'comic') {
    const comicMatch = seriesOrMovie.match(/^(.+?)\s*\((\d{4})\)\s*#(\d+)$/);
    console.log('Comic match result:', comicMatch);
    if (comicMatch) {
      const comicSeries = comicMatch[1].trim();
      const comicYear = parseInt(comicMatch[2]);
      const comicIssue = parseInt(comicMatch[3]);
      
      console.log('Comic parsed:', { comicSeries, comicYear, comicIssue });
      
      const targetMedia = {
        title: title,
        type: 'comic',
        comicSeries: comicSeries,
        comicYear: comicYear,
        comicIssue: comicIssue
      };
      
      console.log('Target media object:', targetMedia);
      return targetMedia;
    } else {
      console.log('Comic regex did not match');
    }
  }
  
  return null;
};

console.log('Starting test...');
// Test the function
const result = testComicParsing();
console.log('Final result:', result);
console.log('Test completed.');
