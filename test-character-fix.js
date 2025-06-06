// Test character normalization fix
const normalizeTitle = (title) => {
    console.log('Input title bytes:', [...title].map(c => c.charCodeAt(0)));
    return title
        .replace(/'/g, "'")  // Convert smart apostrophe (U+2019) to regular apostrophe (U+0027)
        .replace(/'/g, "'")  // Convert left smart apostrophe (U+2018) to regular apostrophe (U+0027)
        .replace(/"/g, '"')  // Convert smart left quote to regular quote
        .replace(/"/g, '"')  // Convert smart right quote to regular quote
        .replace(/–/g, '-')  // Convert en-dash to regular dash
        .replace(/—/g, '-'); // Convert em-dash to regular dash
};

// Test with the problematic title
const originalTitle = "Joker's Late Night Lunacy";
console.log('Original title:', originalTitle);
console.log('Original title character codes:', [...originalTitle].map(c => c.charCodeAt(0)));

const normalizedTitle = normalizeTitle(originalTitle);
console.log('Normalized title:', normalizedTitle);
console.log('Normalized title character codes:', [...normalizedTitle].map(c => c.charCodeAt(0)));

// Check if they're equal
console.log('Are they equal?', originalTitle === normalizedTitle);

// Test with regular apostrophe for comparison
const regularTitle = "Joker's Late Night Lunacy";
console.log('\nRegular apostrophe title:', regularTitle);
console.log('Regular title character codes:', [...regularTitle].map(c => c.charCodeAt(0)));
console.log('Normalized equals regular?', normalizedTitle === regularTitle);
