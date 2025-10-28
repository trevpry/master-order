# Performer Scraper Field Selection Feature

## Overview
Added granular field-level accept/reject control to all performer scrapers (GEVI, Stash-Box, and IAFD native). Users can now selectively choose which scraped fields to apply, giving fine-grained control over data updates.

## Implementation Details

### Frontend Changes (client/src/modules/media/pages/stash/PerformerDetail.jsx)

#### 1. State Management
```javascript
const [acceptedFields, setAcceptedFields] = useState({});
```
Tracks which fields are accepted (true) or rejected (false). Defaults all fields to accepted.

#### 2. Field Initialization Function
```javascript
const initializeAcceptedFields = (scrapedData) => {
  if (!scrapedData) return;
  
  const fields = {};
  Object.keys(scrapedData).forEach(key => {
    // Skip null/undefined values and arrays (like images, tags which have separate UI)
    if (scrapedData[key] !== null && scrapedData[key] !== undefined && !Array.isArray(scrapedData[key])) {
      fields[key] = true;
    }
  });
  
  setAcceptedFields(fields);
};
```
Called when scraper results are received to initialize all fields as accepted.

#### 3. Updated Result Handlers
All three scraper result handlers now call `initializeAcceptedFields()`:
- `handleSelectNativeScraperResult` - IAFD native scraper
- `handleSelectStashBoxResult` - Stash-Box scraper
- `handleSelectGeviPerformer` - GEVI scraper

#### 4. Apply Logic Enhancement
```javascript
const isAccepted = (fieldName) => acceptedFields[fieldName] !== false;

// Only include fields that have values AND are accepted
if (scrapeData.scraped.name && isAccepted('name')) updateData.name = scrapeData.scraped.name;
```
`handleApplyScrape` now checks each field's acceptance status before including in update payload.

#### 5. UI Enhancement - Checkboxes
Each field in the scrape review modal now has a checkbox:
```jsx
<input
  type="checkbox"
  checked={acceptedFields.fieldName !== false}
  onChange={(e) => setAcceptedFields(prev => ({ ...prev, fieldName: e.target.checked }))}
  style={{ marginTop: '2px', cursor: 'pointer' }}
/>
```

Added instruction text at top of fields section:
```
✓ Check fields to include • ✗ Uncheck to exclude
```

## Supported Fields
All 23 performer fields support individual selection:
- name
- disambiguation
- aliases
- gender
- birthdate
- death_date
- ethnicity
- country
- eye_color
- hair_color
- height
- weight
- measurements
- fake_tits
- penis_length
- circumcised
- career_length
- tattoos
- piercings
- details
- url
- twitter
- instagram

## User Experience

### Default Behavior
- All scraped fields are **checked by default** (accepted)
- Users can uncheck any fields they don't want to apply
- Only checked fields will be updated when "Apply Scrape" is clicked

### Workflow
1. Search for performer using any scraper (GEVI/Stash-Box/IAFD)
2. Select result from search modal
3. Review scraped data in review modal
4. Uncheck any incorrect or unwanted fields
5. Select image (if multiple available)
6. Click "Apply Scrape" - only checked fields are updated

### Visual Design
- Checkboxes aligned to left of each field
- Flex layout keeps checkbox and label together
- Instruction text clearly explains functionality
- Cursor changes to pointer on hover over checkboxes

## Technical Notes

### State Management
- `acceptedFields` object keys match scraped data field names
- Value `false` means rejected, any other value (including `undefined`) means accepted
- This allows default-accept behavior without explicit initialization

### Image Selection
- Image selection remains separate with its own UI (not affected by field checkboxes)
- Users can select 0 or 1 image from available options

### Tag Matching
- Matched tags are automatically included if available
- No individual tag selection (tags are all-or-nothing)

### Backend Compatibility
- No backend changes required
- Backend receives only the fields user accepted
- Existing validation and update logic handles partial updates

## Future Enhancements (Not Implemented)
- Bulk check/uncheck all fields button
- Remember field preferences per scraper source
- Show diff between current and scraped values
- Undo/redo for field selections
- Tag-level individual selection

## Testing Checklist
- [x] GEVI scraper initializes accepted fields
- [x] Stash-Box scraper initializes accepted fields  
- [x] Native scraper initializes accepted fields
- [ ] Unchecking fields excludes them from update
- [ ] All checkboxes properly toggle
- [ ] Apply with no fields checked (edge case)
- [ ] Apply with mixed checked/unchecked fields
- [ ] Checkbox state resets between scrapes

## Related Files
- `client/src/modules/media/pages/stash/PerformerDetail.jsx` - Main component with all changes
- `server/routes/stash.js` - Backend handlers (no changes needed)
- `server/services/geviScraperService.js` - GEVI scraper (no changes needed)

## Completion Status
✅ **COMPLETE** - All code implemented and ready for testing
