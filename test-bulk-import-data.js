// Test data for bulk import with year support
// Use this data to test the new 5-column format in the bulk import modal

// Copy and paste this into the bulk import modal to test:

// 4-column format (should still work for backward compatibility)
Breaking Bad	S1E1	Pilot	episode
The Matrix		The Matrix	movie
Game of Thrones	S01E01	Winter Is Coming	episode

// 5-column format with year (new functionality)
Superman		Superman	movie	1978
Superman		Man of Steel	movie	2013
Breaking Bad	S1E2	Cat's in the Bag...	episode	2008
The Avengers		The Avengers	movie	2012
Iron Man		Iron Man	movie	2008
The Dark Knight		The Dark Knight	movie	2008

// Instructions:
// 1. Start the server and client
// 2. Go to Custom Orders page
// 3. Create a new custom order or select an existing one
// 4. Click "Bulk Import" button
// 5. Copy the test data above (either 4-column or 5-column examples)
// 6. Paste into the textarea
// 7. Click "Import Media"
// 8. Verify that:
//    - Both formats work correctly
//    - Year filtering improves search accuracy for movies
//    - Superman (1978) and Man of Steel (2013) are correctly distinguished
//    - Breaking Bad episodes are found correctly
//    - Error handling works for invalid data

console.log('This file contains test data for bulk import functionality.');
console.log('Copy the data above and use it in the bulk import modal.');
