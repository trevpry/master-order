const categories = [
  {"name":"Ancient Egypt","description":"Ancient Egyptian civilization events","color":"#D97706"},
  {"name":"Ancient History","description":"Events from ancient civilizations","color":"#8B5CF6"},
  {"name":"Art & Culture","description":"Artistic and cultural events","color":"#EA580C"},
  {"name":"Cold War","description":"Cold War period events","color":"#374151"},
  {"name":"Economics","description":"Economic events and developments","color":"#0D9488"},
  {"name":"Literature","description":"Literary works and movements","color":"#BE185D"},
  {"name":"Medieval History","description":"Medieval period events","color":"#059669"},
  {"name":"Modern History","description":"Modern historical events","color":"#2563EB"},
  {"name":"Philosophy","description":"Philosophical movements and thinkers","color":"#7C3AED"},
  {"name":"Politics","description":"Political events and movements","color":"#DC2626"},
  {"name":"Religion","description":"Religious events and movements","color":"#059669"},
  {"name":"Renaissance","description":"Renaissance period events","color":"#DC2626"},
  {"name":"Russo-Ukrainian War","description":"Historical category","color":"#3B82F6"},
  {"name":"Science & Technology","description":"Scientific and technological advancements","color":"#0891B2"},
  {"name":"World War I","description":"First World War events","color":"#B45309"},
  {"name":"World War II","description":"Second World War events","color":"#DC2626"},
  {"name":"Ancient Near East","description":"Ancient Near Eastern civilizations","color":"#F59E0B"},
  {"name":"Ancient Europe","description":"Ancient European civilizations","color":"#10B981"},
  {"name":"Ancient Greece","description":"Ancient Greek civilization","color":"#6366F1"},
  {"name":"Ancient Rome","description":"Ancient Roman civilization","color":"#EF4444"},
  {"name":"Ancient India","description":"Ancient Indian civilizations","color":"#F97316"},
  {"name":"Ancient East Asia","description":"Ancient East Asian civilizations","color":"#06B6D4"},
  {"name":"Ancient Mediterranean","description":"Ancient Mediterranean civilizations","color":"#8B5CF6"},
  {"name":"Ancient Americas","description":"Ancient American civilizations","color":"#84CC16"},
  {"name":"Technology","description":"Technological innovations and developments","color":"#6B7280"}
];

async function createCategories() {
  console.log('Creating categories in production...\n');
  
  for (const category of categories) {
    try {
      const response = await fetch('http://192.168.1.119:3001/api/history-plus/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(category)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Created: ${category.name}`);
      } else {
        const error = await response.text();
        console.log(`❌ Failed to create ${category.name}: ${error}`);
      }
    } catch (error) {
      console.log(`❌ Error creating ${category.name}: ${error.message}`);
    }
  }
  
  console.log('\n🎉 Category creation complete!');
  console.log('\nNow test the AI endpoint:');
  console.log('curl -X POST "http://192.168.1.119:3001/api/history-plus/ai/categorize-video/8873?preview=true"');
}

createCategories();