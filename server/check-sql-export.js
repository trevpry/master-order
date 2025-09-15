const fs = require('fs');
const readline = require('readline');

async function findVideoData() {
  const fileStream = fs.createReadStream('history_plus_export.sql');
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let foundVideoTable = false;
  let lineCount = 0;

  for await (const line of rl) {
    lineCount++;
    
    // Look for Video table structure
    if (line.includes('CREATE TABLE public."Video"')) {
      console.log(`Line ${lineCount}: ${line}`);
      foundVideoTable = true;
    }
    
    // Look for Video table columns (next few lines after CREATE TABLE)
    if (foundVideoTable && lineCount <= 100) {
      console.log(`Line ${lineCount}: ${line}`);
      if (line.includes(');')) {
        foundVideoTable = false;
      }
    }
    
    // Look for INSERT statements with eventId
    if (line.includes('INSERT INTO public."Video"') || 
        (line.includes('COPY public."Video"') && line.includes('eventId'))) {
      console.log(`Line ${lineCount}: ${line}`);
      // Show next few lines for data
      let nextLines = 0;
      for await (const nextLine of rl) {
        lineCount++;
        console.log(`Line ${lineCount}: ${nextLine}`);
        nextLines++;
        if (nextLines > 3 || nextLine.includes('\\.')) break;
      }
      break;
    }
    
    if (lineCount > 500) break; // Stop after checking first 500 lines
  }
}

findVideoData().catch(console.error);