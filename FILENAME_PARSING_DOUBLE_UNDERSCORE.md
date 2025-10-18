# Filename Parsing - Double Underscore Support

## Overview

The scene filename parser now correctly handles **double underscores (`__`)** as performer name separators, which is a common format used by some studios.

## Problem

Previous parsing would treat all underscores the same way, converting them to spaces. This meant:

**Input**: `BrokeStraightBoys_-_Andy_Adler__Johnny_Moon`

**Old Behavior**:
- Convert all `_` to spaces: `BrokeStraightBoys - Andy Adler  Johnny Moon`
- Collapse spaces: `BrokeStraightBoys - Andy Adler Johnny Moon`
- Parser sees: Studio: "BrokeStraightBoys", Performers: "Andy Adler Johnny Moon" (as ONE performer)

**Issue**: The two performers were not properly separated because `__` was treated the same as `_`.

## Solution

The parser now processes filename in this order:

1. **Replace double underscores with ampersand**: `__` → ` & `
2. **Replace single underscores with spaces**: `_` → ` `
3. **Normalize other separators**: Clean up spacing around `&`, `,`, "and"
4. **Collapse multiple spaces**: Ensure clean spacing

## Examples

### Example 1: Double Underscore Format

**Filename**: `BrokeStraightBoys_-_Andy_Adler__Johnny_Moon.mp4`

**Parsing Steps**:
1. Strip extension: `BrokeStraightBoys_-_Andy_Adler__Johnny_Moon`
2. Replace `__` with ` & `: `BrokeStraightBoys_-_Andy_Adler & Johnny_Moon`
3. Replace `_` with spaces: `BrokeStraightBoys - Andy Adler & Johnny Moon`
4. Normalize separators: `BrokeStraightBoys - Andy Adler & Johnny Moon`

**Parsed Result**:
```json
{
  "studio": "BrokeStraightBoys",
  "performers": ["Andy Adler", "Johnny Moon"],
  "title": "Andy Adler & Johnny Moon"
}
```

### Example 2: Triple Performers

**Filename**: `StudioName_-_John_Smith__David_Jones__Mike_Wilson.mp4`

**Parsed Result**:
```json
{
  "studio": "StudioName",
  "performers": ["John Smith", "David Jones", "Mike Wilson"],
  "title": "John Smith & David Jones & Mike Wilson"
}
```

### Example 3: Mixed Separators

**Filename**: `NextDoorStudios_-_Alex_Tanner__Brad_Banks_-_Hot_Summer_Day.mp4`

**Parsed Result**:
```json
{
  "studio": "NextDoorStudios",
  "performers": ["Alex Tanner", "Brad Banks"],
  "title": "Hot Summer Day"
}
```

### Example 4: No Double Underscores (Legacy Format)

**Filename**: `8TeenBoy_-_Skyler_Bleu_and_Jesse_Starr.mp4`

**Parsed Result**:
```json
{
  "studio": "8TeenBoy",
  "performers": ["Skyler Bleu", "Jesse Starr"],
  "title": "Skyler Bleu & Jesse Starr"
}
```
*(Still works because "and" is normalized to `&` separator)*

## Supported Filename Patterns

The parser now handles all these patterns correctly:

### Pattern 1: Studio - Performers (Double Underscore)
```
Studio_-_Performer1__Performer2.mp4
Studio_-_Performer1__Performer2__Performer3.mp4
```

### Pattern 2: Studio - Performers - Title (Double Underscore)
```
Studio_-_Performer1__Performer2_-_Title.mp4
```

### Pattern 3: Studio - Performers (Legacy "and")
```
Studio_-_Performer1_and_Performer2.mp4
```

### Pattern 4: Studio - Performers (Ampersand)
```
Studio_-_Performer1_&_Performer2.mp4
```

### Pattern 5: Studio - Performers (Comma)
```
Studio_-_Performer1,_Performer2.mp4
```

### Pattern 6: Performers Only (Double Underscore)
```
Performer1__Performer2.mp4
```

## Processing Order (Technical Details)

The normalization now follows this specific order:

```javascript
nameWithoutExt = nameWithoutExt
  .replace(/__/g, ' & ')                       // Step 1: Double underscore → ampersand
  .replace(/_/g, ' ')                          // Step 2: Single underscore → space
  .replace(/\s+and\s+/gi, ' & ')               // Step 3: "and" → ampersand
  .replace(/\s*,\s*/g, ', ')                   // Step 4: Normalize comma spacing
  .replace(/\s*&\s*/g, ' & ')                  // Step 5: Normalize ampersand spacing
  .replace(/\s+/g, ' ')                        // Step 6: Collapse multiple spaces
  .trim();                                     // Step 7: Trim whitespace
```

**Critical**: Double underscores MUST be replaced BEFORE single underscores, otherwise:
- `__` would become `  ` (two spaces)
- Then collapse to ` ` (one space)
- Losing the performer separator entirely

## Backward Compatibility

✅ **All existing filename formats continue to work**

The change is additive - it adds support for `__` separators while maintaining support for:
- `and` keyword
- `&` ampersand
- `,` comma
- Mixed formats

## Usage

### In the UI

1. **Scene Detail Page**: Click "Parse Filename" button
2. **Modal Opens**: Shows parsed metadata
3. **Review Results**: Check studio, performers, title
4. **Accept/Edit**: Modify if needed, then click "Accept"

### Example Use Case

**Scenario**: You have a scene file from BrokeStraightBoys studio:
```
BrokeStraightBoys_-_Andy_Adler__Johnny_Moon.mp4
```

**Steps**:
1. Navigate to the scene in Stash
2. Click "Parse Filename" button
3. Parser automatically detects:
   - Studio: "BrokeStraightBoys"
   - Performer 1: "Andy Adler"
   - Performer 2: "Johnny Moon"
   - Title: "Andy Adler & Johnny Moon"
4. If performers exist in database, they're matched automatically
5. If performers don't exist, they appear in "unmatched" list
6. Click "Accept" to update the scene

## Related Files

- **Route Handler**: `server/routes/stash.js` (lines ~860-880)
- **Endpoint**: `POST /api/stash/scenes/:id/parse-filename`

## Testing

To test the parser with various formats:

```javascript
// Test cases
const testCases = [
  {
    input: "BrokeStraightBoys_-_Andy_Adler__Johnny_Moon.mp4",
    expected: {
      studio: "BrokeStraightBoys",
      performers: ["Andy Adler", "Johnny Moon"]
    }
  },
  {
    input: "Studio_-_John__David__Mike.mp4",
    expected: {
      studio: "Studio",
      performers: ["John", "David", "Mike"]
    }
  },
  {
    input: "Performer1__Performer2.mp4",
    expected: {
      performers: ["Performer1", "Performer2"]
    }
  }
];
```

## Common Studios Using This Format

Studios known to use double underscore format:
- BrokeStraightBoys
- CollegeDudes
- PeterFever
- ActiveDuty
- (Add more as discovered)

## Troubleshooting

### Performers Not Separated

**Symptom**: Two performers appear as one name

**Check**:
1. Are there TWO underscores between names? (`__`)
2. Or just ONE underscore? (`_`)

**Solution**: If filename uses single underscore, manually edit or rename file to use `__` or another separator like `&` or `,`

### Performer Names with Underscores

**Rare Case**: If a performer's actual name contains an underscore (e.g., "John_Doe" is their stage name)

**Current Behavior**: Will split into "John Doe"

**Workaround**: Use the manual edit feature in the parser modal to correct the name

---

**Status**: ✅ Implemented and Ready  
**Date**: January 14, 2025  
**Version**: 1.0.0  
**File Updated**: `server/routes/stash.js` (POST /api/stash/scenes/:id/parse-filename)
