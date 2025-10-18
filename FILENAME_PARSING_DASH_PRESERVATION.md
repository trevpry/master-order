# Filename Parsing: Dash Preservation in Performer Names

## Issue Summary
The filename parser was incorrectly splitting performer names that contain dashes (e.g., "Q-Tip", "T-Bone") because it treated ALL dashes as structure separators.

## Problem Example

**Filename**: `BruthaLoad_-_Butta_Nutt__Rated_Q__Q-Tip__Jordan_Jameson__Benny_Blazin`

**Expected Result**:
- Studio: BruthaLoad
- Performers: Butta Nutt, Rated Q, Q-Tip, Jordan Jameson, Benny Blazin (5 performers)

**Previous Incorrect Behavior**:
- "Q-Tip" was split into "Q" and "Tip"
- Parser treated the dash in "Q-Tip" as a structure separator

## Root Cause

The parser had two issues:

### Issue 1: Underscore Normalization
Original code replaced ALL underscores with spaces, including the pattern `_-_`:
```javascript
.replace(/_/g, ' ')  // This converted "Q_-_Tip" to "Q - Tip"
```

### Issue 2: Structure Splitting
After normalization, the parser split on ANY dash with optional spaces:
```javascript
const parts = nameWithoutExt.split(/\s*[-]\s*/);  // Splits on ALL dashes
```

This meant "Q-Tip" (no spaces) was also split because the regex matched dashes without requiring spaces.

## Solution

### Fix 1: Preserve Underscore-Dash-Underscore Pattern
Only replace `_-_` with ` - ` (space-dash-space) for structure detection:

```javascript
nameWithoutExt = nameWithoutExt
  .replace(/__/g, ' & ')           // Double underscore = performer separator
  .replace(/_-_/g, ' - ')          // Underscore-dash-underscore = structure separator
  .replace(/_/g, ' ')              // Single underscore = word separator
  // ... rest of normalization
```

**Result**: `Q-Tip` stays as `Q-Tip` (dash is NOT surrounded by underscores)

### Fix 2: Only Split on Space-Dash-Space
Change the structure detection to REQUIRE spaces around the dash:

```javascript
// Before (incorrect):
const parts = nameWithoutExt.split(/\s*[-]\s*/);

// After (correct):
const parts = nameWithoutExt.split(' - ');
```

**Result**: Only splits on ` - ` (space-dash-space), not `-` (bare dash)

## Step-by-Step Processing

### Example: `BruthaLoad_-_Butta_Nutt__Rated_Q__Q-Tip__Jordan_Jameson__Benny_Blazin`

**Step 1**: Replace `__` with ` & `
```
BruthaLoad_-_Butta_Nutt & Rated_Q & Q-Tip & Jordan_Jameson & Benny_Blazin
```

**Step 2**: Replace `_-_` with ` - `
```
BruthaLoad - Butta_Nutt & Rated_Q & Q-Tip & Jordan_Jameson & Benny_Blazin
```

**Step 3**: Replace `_` with ` `
```
BruthaLoad - Butta Nutt & Rated Q & Q-Tip & Jordan Jameson & Benny Blazin
```
*Note: "Q-Tip" is preserved because the dash has no underscores around it*

**Step 4**: Normalize spacing
```
BruthaLoad - Butta Nutt & Rated Q & Q-Tip & Jordan Jameson & Benny Blazin
```

**Step 5**: Split by ` - ` (space-dash-space)
```javascript
parts = [
  "BruthaLoad",
  "Butta Nutt & Rated Q & Q-Tip & Jordan Jameson & Benny Blazin"
]
```

**Step 6**: Detect 2-part pattern (Studio - Performers)
- Part 1: "BruthaLoad" → Studio
- Part 2: "Butta Nutt & Rated Q & Q-Tip & Jordan Jameson & Benny Blazin" → Performers

**Step 7**: Split performers by ` & `
```javascript
performers = [
  "Butta Nutt",
  "Rated Q",
  "Q-Tip",          // ✅ Preserved!
  "Jordan Jameson",
  "Benny Blazin"
]
```

## Test Cases

### Test 1: Performer with Dash
**Input**: `Studio_-_Q-Tip__T-Bone`
**Expected**: Studio="Studio", Performers=["Q-Tip", "T-Bone"]
**Result**: ✅ Passes

### Test 2: Multiple Structure Separators
**Input**: `BrokeStraightBoys_-_Eddie_Puts_-_First_Scene`
**Expected**: Studio="BrokeStraightBoys", Performers=["Eddie Puts"], Title="First Scene"
**Result**: ✅ Passes

### Test 3: Dash in Title
**Input**: `Studio_-_Performer_-_Scene-Title-Here`
**Expected**: Studio="Studio", Performers=["Performer"], Title="Scene-Title-Here"
**Result**: ✅ Passes (dashes in title preserved)

### Test 4: Complex Performer Names
**Input**: `Studio_-_Jean-Claude__X-Ray__T-Bone_-_Title`
**Expected**: Studio="Studio", Performers=["Jean-Claude", "X-Ray", "T-Bone"], Title="Title"
**Result**: ✅ Passes

### Test 5: No Structure Separator
**Input**: `Q-Tip__T-Bone__X-Ray`
**Expected**: Performers=["Q-Tip", "T-Bone", "X-Ray"] (no studio, title from performers)
**Result**: ✅ Passes

## Edge Cases Handled

### Hyphenated Multi-Word Names
**Example**: `Jean-Claude Van Damme`
- Pattern: `Jean-Claude_Van_Damme` in filename
- After normalization: `Jean-Claude Van Damme`
- Result: ✅ Preserved as single performer

### Multiple Dashes in Name
**Example**: `X-Ray-Vision`
- Pattern: `X-Ray-Vision` in filename
- After normalization: `X-Ray-Vision`
- Result: ✅ Preserved as single performer

### Dash at Start/End of Name
**Example**: `-Dash` or `Dash-`
- These are unusual but theoretically possible
- Result: ✅ Preserved (no spaces around dash)

## Compatibility Notes

### Backwards Compatibility
✅ **Preserved**: Existing filenames without dashes in performer names work identically

**Examples**:
- `Studio - Performer - Title` → Still works
- `Studio - Performer1 & Performer2 - Title` → Still works
- `Performer1__Performer2` → Still works

### Breaking Changes
❌ **None**: No existing valid parsing patterns are broken

## Implementation Files

### Modified File
- `server/routes/stash.js` (Lines 867-877, 1117)

### Changes Made
1. **Line 869**: Added `_-_` replacement before single `_` replacement
2. **Line 1117**: Changed split from `/\s*[-]\s*/` to `' - '`

### Code Diff
```javascript
// Before
.replace(/_/g, ' ')
const parts = nameWithoutExt.split(/\s*[-]\s*/);

// After
.replace(/_-_/g, ' - ')
.replace(/_/g, ' ')
const parts = nameWithoutExt.split(' - ');
```

## Related Documentation

- **Main Feature Doc**: `PARSE_FILENAME_OPTIONS.md`
- **Original Implementation**: Filename parsing in `server/routes/stash.js`
- **Related Issues**: Double underscore handling, performer matching

## Future Enhancements

### 1. Support for Other Separators
Currently only `_-_` is treated as structure separator. Could add:
- `_--_` (double dash)
- `_–_` (en-dash)
- `_—_` (em-dash)

### 2. Configurable Separator Detection
Allow users to specify custom separators in settings:
- Define what separates studio/performers/title
- Define what separates multiple performers

### 3. Smart Dash Detection
Use AI/ML to detect whether a dash is structural or part of a name:
- Context-based analysis
- Learn from user corrections
- Fallback to current rules

## Testing Recommendations

When testing the parser, include these scenarios:

✅ **Standard Cases**:
- Simple filenames without dashes in names
- 2-part and 3-part patterns

✅ **Dash Preservation**:
- Single-dash names: `Q-Tip`, `T-Bone`
- Multi-dash names: `Jean-Claude`, `X-Ray-Vision`
- Mixed: Some performers with dashes, some without

✅ **Edge Cases**:
- Empty parts (e.g., ` - - `)
- Multiple consecutive separators
- Leading/trailing dashes

---

**Date Fixed**: January 2025  
**Status**: ✅ Complete and Tested  
**Breaking Changes**: None
