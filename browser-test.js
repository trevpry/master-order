// Simple test to see if we can add a comic
fetch('http://localhost:3001/api/custom-orders/2/items', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    mediaType: 'comic',
    title: 'The High Republic Adventures (2022) #7',
    comicSeries: 'The High Republic Adventures',
    comicYear: 2022,
    comicIssue: '7'
  })
})
.then(response => response.json())
.then(data => console.log('Success:', data))
.catch(error => console.error('Error:', error));
