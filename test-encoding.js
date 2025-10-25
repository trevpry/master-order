// Test encodeURIComponent behavior
console.log('=== Testing encodeURIComponent ===\n');

const char = "'";
console.log(`Character: "${char}"`);
console.log(`CharCode: ${char.charCodeAt(0)}`);

console.log('\n=== Checking function itself ===');
console.log(`typeof encodeURIComponent: ${typeof encodeURIComponent}`);
console.log(`encodeURIComponent.toString():\n${encodeURIComponent.toString()}`);

const encoded = encodeURIComponent(char);
console.log(`\nEncoded result: "${encoded}"`);
console.log(`Type of encoded: ${typeof encoded}`);
console.log(`Encoded === '%27': ${encoded === '%27'}`);
console.log(`Encoded === "'": ${encoded === "'"}`);

// Try global explicitly
const globalEncoded = global.encodeURIComponent?.(char) || globalThis.encodeURIComponent(char);
console.log(`Global encoded: "${globalEncoded}"`);

console.log('\n=== Testing full string ===\n');
const testString = "kenchi's";
console.log(`Original: "${testString}"`);

const fullEncoded = encodeURIComponent(testString);
console.log(`Full encode: "${fullEncoded}"`);

console.log('\n=== Testing replace with encoding ===\n');
const title = "Ruito Gets Kenchi's Ass";
const spacesConvertTo = "+";

let titleSlug = title.toLowerCase().replace(/\s+/g, spacesConvertTo);
console.log(`After space replacement: "${titleSlug}"`);

titleSlug = titleSlug.replace(/[^a-z0-9]/gi, (char) => {
  if (char === spacesConvertTo) {
    console.log(`  Skipping "${char}" (spacesConvertTo)`);
    return char;
  }
  const charCode = char.charCodeAt(0);
  const encoded = encodeURIComponent(char);
  console.log(`  Encoding "${char}" (charCode: ${charCode}) → "${encoded}"`);
  console.log(`  Type: ${typeof encoded}, Length: ${encoded.length}`);
  return encoded;
});

console.log(`\nFinal result: "${titleSlug}"`);
console.log(`Expected: "ruito+gets+kenchi%27s+ass"`);
