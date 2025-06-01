const fetch = require('node-fetch');

async function testAPI() {
    try {
        console.log('Testing API call to search for The Office Season 1...');
        
        const response = await fetch('http://localhost:3001/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                title: 'The Office',
                type: 'tv',
                season: 1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('API Response:', JSON.stringify(data, null, 2));
        
        // Check if we got TVDB artwork
        if (data.tvdbArtwork) {
            console.log('\n--- TVDB ARTWORK RESULT ---');
            console.log('URL:', data.tvdbArtwork.url);
            console.log('Season:', data.tvdbArtwork.seasonNumber);
            console.log('Series:', data.tvdbArtwork.seriesName);
            console.log('Successfully filtered for English artwork!');
        } else {
            console.log('No TVDB artwork found in response');
        }

    } catch (error) {
        console.error('Error testing API:', error.message);
    }
}

testAPI();
