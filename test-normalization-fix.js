// Test the character normalization fix
console.log('Testing character normalization...\n');

// This simulates the normalizeTitle function from the frontend
const normalizeTitle = (title) => {
    return title
        .replace(/'/g, "'")  // Convert right smart apostrophe (U+2019) to regular apostrophe (U+0027)
        .replace(/'/g, "'")  // Convert left smart apostrophe (U+2018) to regular apostrophe (U+0027)
        .replace(/"/g, '"')  // Convert smart left quote to regular quote
        .replace(/"/g, '"')  // Convert smart right quote to regular quote
        .replace(/–/g, '-')  // Convert en-dash to regular dash
        .replace(/—/g, '-'); // Convert em-dash to regular dash
};

// Test cases with problematic characters
const testCases = [
    "Joker's Late Night Lunacy",  // Smart apostrophe
    "Penguin's Big Score",        // Smart apostrophe
    "Batman's Adventure",         // Smart apostrophe
    "The "Dark" Knight",          // Smart quotes
    "Spider–Man",                 // En-dash
    "X—Men",                      // Em-dash
    "Regular 'quotes' test"       // Regular apostrophes (should not change)
];

testCases.forEach((testTitle, index) => {
    console.log(`Test ${index + 1}:`);
    console.log(`  Original: "${testTitle}"`);
    console.log(`  Original char codes: [${[...testTitle].map(c => c.charCodeAt(0)).join(', ')}]`);
    
    const normalized = normalizeTitle(testTitle);
    console.log(`  Normalized: "${normalized}"`);
    console.log(`  Normalized char codes: [${[...normalized].map(c => c.charCodeAt(0)).join(', ')}]`);
    console.log(`  Changed: ${testTitle !== normalized}`);
    console.log('');
});

// Specific test for the Batman Adventures case
console.log('=== Batman Adventures Test ===');
const batmanTitle = "Joker's Late Night Lunacy";
const normalizedBatman = normalizeTitle(batmanTitle);
console.log(`Original: "${batmanTitle}"`);
console.log(`Normalized: "${normalizedBatman}"`);
console.log(`Successfully converted curly apostrophe: ${batmanTitle !== normalizedBatman}`);

// Check if it matches what ComicVine would have
const comicVineTitle = "Joker's Late Night Lunacy";  // Regular apostrophe
console.log(`ComicVine title: "${comicVineTitle}"`);
console.log(`Titles match after normalization: ${normalizedBatman === comicVineTitle}`);
