# GEVI Create Performers from Scrape - Implementation Summary

## Overview
Enhanced the "Review Scraped Metadata" modal to allow users to create new performers directly from GEVI scrape results. When GEVI returns performers that don't exist in the Stash database, users can now click a button to create them instantly.

## Feature Details

### User Flow
1. User scrapes GEVI episode metadata
2. "Review Scraped Metadata" modal shows the results
3. For each unmatched performer, a **"✨ Create New"** button appears
4. User clicks the button to create the performer
5. Performer is created in both:
   - **Eddie Life database** (StashPerformer table)
   - **Stash instance** (via Stash GraphQL API)
6. Performer moves from "unmatched" to "matched" section
7. Scene can now be saved with the new performer

### Benefits
- **Streamlined workflow**: No need to manually switch to Stash to create performers
- **Preserve action codes**: Action codes from GEVI are preserved with the performer
- **Instant feedback**: UI updates immediately after creation
- **Error handling**: Clear error messages if creation fails

---

## Implementation

### Frontend Changes

**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

#### State Variables
```javascript
const [creatingPerformers, setCreatingPerformers] = useState(new Set());
```
Tracks which performers are currently being created to prevent duplicate requests and show loading state.

#### Handler Function: `handleCreatePerformer`

**Purpose**: Creates a new performer in both Eddie Life database and Stash

**Process**:
1. Validates performer name is not empty
2. Adds performer to `creatingPerformers` set (shows loading state)
3. Calls `/api/stash/performers/create` with full performer data
4. On success:
   - Moves performer from `unmatched` to `matched` in `scrapeData`
   - Preserves action code if available
   - Shows success alert
5. On error: Shows error alert
6. Finally: Removes performer from `creatingPerformers` set

**Key Features**:
- **Action Code Preservation**: Extracts action code from scraped data and includes it in matched performer
- **State Management**: Updates `scrapeData` to reflect the new matched performer
- **Loading State**: Disables button and shows "⏳ Creating..." while in progress

```javascript
const handleCreatePerformer = async (performerName) => {
  if (!performerName || !performerName.trim()) {
    alert('Performer name cannot be empty');
    return;
  }

  setCreatingPerformers(prev => new Set(prev).add(performerName));

  try {
    // Create the performer with minimal data
    const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: performerName,
        aliases: [],
        // ... other fields set to null
      })
    });

    const createResult = await createResponse.json();

    if (createResult.success) {
      const newPerformer = createResult.data.performer;
      
      // Find action code from scraped data
      const scrapedPerformer = scrapeData.scraped.performers.find(
        sp => sp.name === performerName
      );
      const actionCode = scrapedPerformer?.actionCode;

      // Move from unmatched to matched
      setScrapeData(prev => ({
        ...prev,
        matched: {
          ...prev.matched,
          performers: [
            ...prev.matched.performers,
            {
              id: newPerformer.id,
              name: newPerformer.name,
              stashId: newPerformer.stashId,
              matchedVia: 'created',
              alternatives: [],
              originalName: performerName,
              actionCode: actionCode
            }
          ]
        },
        unmatched: {
          ...prev.unmatched,
          performers: prev.unmatched.performers.filter(p => p !== performerName)
        }
      }));

      alert(`✅ Performer "${performerName}" created successfully!`);
    } else {
      alert(`Failed to create performer: ${createResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error creating performer:', error);
    alert('Failed to create performer');
  } finally {
    setCreatingPerformers(prev => {
      const newSet = new Set(prev);
      newSet.delete(performerName);
      return newSet;
    });
  }
};
```

#### UI Component

**Location**: Inside "Review Scraped Metadata" modal, performers section

**Structure**:
```jsx
{scrapeData.unmatched.performers.map((performerName, index) => (
  <div key={index} className="unmatched-performer-item">
    <input
      type="text"
      value={performerName}
      onChange={...}
      className="parse-input performer-input"
    />
    <div className="performer-status-actions">
      <span className="match-status unmatched">✗ Not found</span>
      <button
        className="btn-create-performer"
        onClick={() => handleCreatePerformer(performerName)}
        disabled={creatingPerformers.has(performerName)}
        title="Create new performer in Stash with this name"
      >
        {creatingPerformers.has(performerName) ? '⏳ Creating...' : '✨ Create New'}
      </button>
    </div>
  </div>
))}
```

**Button States**:
- **Default**: "✨ Create New" - clickable
- **Loading**: "⏳ Creating..." - disabled
- **After Success**: Button disappears (performer moved to matched section)

---

### Backend Components

**Note**: The backend endpoint `/api/stash/performers/create` already existed. This feature leverages it from the frontend for the first time.

**Endpoint**: `POST /api/stash/performers/create`

**Request Body**:
```json
{
  "name": "Performer Name",
  "aliases": [],
  "gender": null,
  "birthdate": null,
  "ethnicity": null,
  "country": null,
  "eyeColor": null,
  "hairColor": null,
  "height": null,
  "measurements": null,
  "fakeTits": null,
  "penisLength": null,
  "circumcised": null,
  "tattoos": null,
  "piercings": null,
  "careerLength": null,
  "details": null
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "performer": {
      "id": 123,
      "stashId": "abc-123-def",
      "name": "Performer Name",
      "aliases": []
    }
  }
}
```

**What It Does**:
1. Creates performer in Eddie Life database (`StashPerformer` table)
2. Calls Stash GraphQL API to create performer in Stash instance
3. Returns both database ID and Stash ID

---

## Action Code Preservation

### Why It Matters
GEVI includes "action codes" with performers, indicating what type of action they performed in the scene:
- `T` = Top
- `B` = Bottom
- `V` = Versatile
- `S` = Solo
- `O` = Other

### How It Works

1. **GEVI Scrape**: Action codes are extracted during scraping:
   ```javascript
   scraped: {
     performers: [
       { name: "Eric Lenn", actionCode: "T" },
       { name: "David Ace", actionCode: "B" }
     ]
   }
   ```

2. **Performer Creation**: When creating a new performer, the action code is found:
   ```javascript
   const scrapedPerformer = scrapeData.scraped.performers.find(
     sp => sp.name === performerName
   );
   const actionCode = scrapedPerformer?.actionCode;
   ```

3. **State Update**: Action code is included in the matched performer object:
   ```javascript
   {
     id: newPerformer.id,
     name: newPerformer.name,
     actionCode: actionCode  // ← Preserved!
   }
   ```

4. **Scene Update**: When the scene is saved, action codes are included in the update:
   ```javascript
   performerIds: scrapeData.matched.performers.map(p => ({
     id: p.id,
     actionCode: p.actionCode
   }))
   ```

### Result
New performers created from GEVI scrape results retain their action codes, which are then saved with the scene in Stash.

---

## Similar Feature: Parse Filename

A similar "Create New" button exists in the **"Parse Filename"** modal, but it uses a separate handler function:

**Function**: `handleCreatePerformerFromParse`

**Differences**:
- Updates `parseData` instead of `scrapeData`
- Does NOT preserve action codes (parse doesn't have them)
- Simpler flow (no action code lookup)

**Why Separate Functions?**
- Different state objects (`parseData` vs `scrapeData`)
- Different data structures
- Different use cases

---

## UI/UX Design

### Visual States

**Unmatched Performer (Before Creation)**:
```
┌────────────────────────────────────────────┐
│ Eric Lenn                                  │
│ ✗ Not found     [✨ Create New]           │
└────────────────────────────────────────────┘
```

**Creating Performer (During API Call)**:
```
┌────────────────────────────────────────────┐
│ Eric Lenn                                  │
│ ✗ Not found     [⏳ Creating...] (disabled)│
└────────────────────────────────────────────┘
```

**Matched Performer (After Creation)**:
```
┌────────────────────────────────────────────┐
│ Eric Lenn                                  │
│ ✓ Eric Lenn (created)                      │
└────────────────────────────────────────────┘
```

### Button Styling

**CSS Classes**:
- `.btn-create-performer` - Primary button style
- Inherits from existing button styles
- Consistent with other action buttons in the modal

**Accessibility**:
- `title` attribute provides tooltip: "Create new performer in Stash with this name"
- `disabled` state prevents double-clicks
- Loading state provides visual feedback

---

## Error Handling

### Validation Errors

**Empty Name**:
```javascript
if (!performerName || !performerName.trim()) {
  alert('Performer name cannot be empty');
  return;
}
```

### API Errors

**Network Failure**:
```javascript
catch (error) {
  console.error('Error creating performer:', error);
  alert('Failed to create performer');
}
```

**Server Error**:
```javascript
if (!createResult.success) {
  alert(`Failed to create performer: ${createResult.error || 'Unknown error'}`);
}
```

### User Feedback

All errors show browser alerts with clear messages:
- ❌ "Performer name cannot be empty"
- ❌ "Failed to create performer: [specific error]"
- ❌ "Failed to create performer" (generic network error)

Success shows:
- ✅ "Performer '[Name]' created successfully!"

---

## Testing Scenarios

### Test 1: Create Single Performer
1. Scrape GEVI episode with 1 unmatched performer
2. Click "✨ Create New" button
3. Wait for "⏳ Creating..." state
4. Verify success alert appears
5. Verify performer moves to matched section
6. Verify action code is preserved

### Test 2: Create Multiple Performers
1. Scrape GEVI episode with 3 unmatched performers
2. Click "✨ Create New" on each performer
3. Verify all three are created successfully
4. Verify all action codes are preserved

### Test 3: Empty Name Validation
1. Scrape GEVI episode
2. Clear a performer's name in the input field
3. Click "✨ Create New"
4. Verify "Performer name cannot be empty" alert

### Test 4: Network Error
1. Disconnect from network
2. Click "✨ Create New"
3. Verify "Failed to create performer" alert
4. Verify button is re-enabled after error

### Test 5: Duplicate Creation Prevention
1. Click "✨ Create New" button
2. Quickly click it again before first request completes
3. Verify only one request is made (button disabled during first request)

---

## Known Limitations

### 1. **No Bulk Creation**
Currently, performers must be created one at a time. 

**Future Enhancement**: Add "Create All" button to create all unmatched performers at once.

### 2. **No Undo**
Once a performer is created, there's no undo button in the modal.

**Workaround**: User can delete the performer in Stash if needed.

### 3. **Minimal Metadata**
New performers are created with only name and action code, no other details.

**Workaround**: User can edit performer details in Stash after creation.

**Future Enhancement**: Pre-fill performer details from GEVI (if available).

### 4. **No Image Upload**
Performer images from GEVI are not transferred to Stash during creation.

**Future Enhancement**: Download and attach performer image from GEVI.

---

## Code Organization

### Function Naming Convention

Two similar functions exist with different purposes:
- `handleCreatePerformer` - For scrape modal (updates `scrapeData`)
- `handleCreatePerformerFromParse` - For parse modal (updates `parseData`)

This naming convention makes it clear which modal each function belongs to.

### State Management

**Loading State**:
```javascript
const [creatingPerformers, setCreatingPerformers] = useState(new Set());
```

Using a `Set` allows tracking multiple performers being created simultaneously:
- Add to set when starting: `new Set(prev).add(performerName)`
- Check if creating: `creatingPerformers.has(performerName)`
- Remove when done: `newSet.delete(performerName)`

**Data State**:
```javascript
const [scrapeData, setScrapeData] = useState({ ... });
```

Immutable state updates ensure React re-renders correctly:
```javascript
setScrapeData(prev => ({
  ...prev,
  matched: {
    ...prev.matched,
    performers: [...prev.matched.performers, newPerformer]
  }
}));
```

---

## Future Enhancements

### 1. **Bulk Actions**
- "Create All Unmatched" button
- "Skip All" button to ignore unmatched performers
- Checkbox selection for batch operations

### 2. **Enhanced Metadata**
- Scrape performer details from GEVI performer page
- Download and attach performer images
- Auto-fill birthdate, nationality, etc.

### 3. **Performer Matching Improvements**
- Fuzzy name matching
- Suggest "Did you mean?" for similar names
- Manual linking to existing performers

### 4. **Action Code Display**
- Show action code badges next to performer names
- Color-coded indicators (Top=Blue, Bottom=Pink, etc.)
- Hover tooltips explaining action codes

### 5. **Undo/Redo**
- "Undo Create" button
- Transaction-style operations
- Rollback on modal cancel

---

## Related Features

- **Parse Filename Create Performer**: Similar feature in parse modal (`handleCreatePerformerFromParse`)
- **GEVI Action Code Tagging**: Action codes are preserved through performer creation
- **GEVI Scraping**: Main scraping functionality that populates the modal
- **Stash GraphQL Integration**: Backend creates performers in Stash via GraphQL

---

## API Dependencies

### Eddie Life API
- `POST /api/stash/performers/create` - Creates performer in database and Stash

### Stash GraphQL API
- `performerCreate` mutation - Called by Eddie Life backend

---

## Files Modified

| File | Lines Changed | Change Type | Description |
|------|--------------|-------------|-------------|
| `SceneDetail.jsx` | +70 | ➕ Added | New `handleCreatePerformer` function |
| `SceneDetail.jsx` | +15 | ✏️ Modified | Updated scrape modal UI with button |
| `SceneDetail.jsx` | +1 | ➕ Added | `creatingPerformers` state variable |

**Total Lines Added**: ~86 lines

---

## Documentation

- **Main Documentation**: This file
- **Related**: `GEVI_ACTION_CODE_TAGGING.md`
- **Related**: `GEVI_SEARCH_BY_PERFORMERS.md`
- **Related**: `PARSE_FILENAME_OPTIONS.md`

---

**Date Implemented**: January 2025  
**Feature Status**: ✅ Complete and Tested  
**Breaking Changes**: None
