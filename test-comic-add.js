const axios = require('axios');

async function testComicAdd() {
  try {
    const response = await axios.post('http://localhost:3001/api/custom-orders/2/items', {
      mediaType: 'comic',
      title: 'The High Republic Adventures (2022) #7',
      comicSeries: 'The High Republic Adventures',
      comicYear: 2022,
      comicIssue: '7'
    });
    
    console.log('Success:', response.data);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testComicAdd();
