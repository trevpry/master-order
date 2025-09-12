const fs = require('fs');

function extractTableData(exportData, tableName) {
  const pattern = new RegExp(`COPY public\\."${tableName}"[^\\n]*\\n([\\s\\S]*?)\\n\\\\\\.`, 'i');
  const match = exportData.match(pattern);
  
  if (!match || !match[1]) {
    return [];
  }
  
  return match[1]
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('--'));
}

async function countChaptersAndSections() {
  try {
    const exportData = fs.readFileSync('C:\\Users\\Trevor\\AppData\\Local\\Temp\\master_order_export_20250912_115316.sql', 'utf8');
    
    const chapterData = extractTableData(exportData, 'Chapter');
    const sectionData = extractTableData(exportData, 'Section');
    
    console.log('📊 Available Data in Export:');
    console.log(`📖 Chapters: ${chapterData.length}`);
    console.log(`📄 Sections: ${sectionData.length}`);
    
    if (chapterData.length > 0) {
      console.log('\n📖 Sample Chapter records:');
      for (let i = 0; i < Math.min(5, chapterData.length); i++) {
        const parts = chapterData[i].split('\t');
        const [id, title, chapterNumber, description, pageStart, pageEnd, createdAt, updatedAt, bookId, eventId] = parts;
        console.log(`  Chapter ${i + 1}: ID=${id}, Title="${title}", BookID=${bookId}, EventID=${eventId}`);
      }
    }
    
    if (sectionData.length > 0) {
      console.log('\n📄 Sample Section records:');
      for (let i = 0; i < Math.min(5, sectionData.length); i++) {
        const parts = sectionData[i].split('\t');
        const [id, title, sectionNumber, description, pageStart, pageEnd, content, createdAt, updatedAt, chapterId, eventId] = parts;
        console.log(`  Section ${i + 1}: ID=${id}, Title="${title}", ChapterID=${chapterId}, EventID=${eventId}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

countChaptersAndSections();