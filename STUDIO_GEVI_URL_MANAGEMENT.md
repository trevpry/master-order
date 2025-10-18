# Studio GEVI URL Management - Implementation Summary

## Overview

Added functionality to store and manage GEVI URLs for studios in the Stash integration. Users can now save a GEVI studio URL for quick reference and easy access to the studio's page on GEVI.

## Changes Made

### 1. Database Schema Update

**File**: `server/prisma/schema.prisma`

Added `geviUrl` field to the `StashStudio` model:

```prisma
model StashStudio {
  id           String         @id
  name         String         @unique
  url          String?
  image        String?
  geviUrl      String?        // NEW: GEVI studio URL
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  lastSyncedAt DateTime       @default(now())
  galleries    StashGallery[]
  images       StashImage[]
  scenes       StashScene[]
  groups       StashGroup[]

  @@map("StashStudio")
}
```

**Migration**: `20251017200838_add_gevi_url_to_studio`

### 2. Backend API Endpoint

**File**: `server/routes/stash.js`

Added new PUT endpoint to update studio details:

```javascript
// PUT /api/stash/studios/:id - Update studio details
router.put('/studios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { geviUrl } = req.body;

  // Check if studio exists
  const studio = await prisma.stashStudio.findUnique({
    where: { id }
  });

  if (!studio) {
    return sendBadRequest(res, `Studio with ID ${id} not found`);
  }

  // Update studio
  const updateData = {};
  if (geviUrl !== undefined) updateData.geviUrl = geviUrl;

  const updatedStudio = await prisma.stashStudio.update({
    where: { id },
    data: updateData
  });

  sendSuccess(res, updatedStudio);
}));
```

**Endpoint Details**:
- **Method**: PUT
- **Path**: `/api/stash/studios/:id`
- **Body**: `{ geviUrl: string }`
- **Response**: Updated studio object

### 3. Frontend Updates

**File**: `client/src/modules/media/pages/stash/StudioDetail.jsx`

#### Added State Variables

```javascript
const [showGeviUrlModal, setShowGeviUrlModal] = useState(false);
const [geviUrlInput, setGeviUrlInput] = useState('');
const [isSavingGeviUrl, setIsSavingGeviUrl] = useState(false);
```

#### Added Handler Function

```javascript
const handleSaveGeviUrl = async () => {
  if (!geviUrlInput.trim()) {
    alert('Please enter a GEVI URL');
    return;
  }

  // Basic validation for GEVI URL format
  if (!geviUrlInput.includes('gayeroticvideoindex.com')) {
    if (!confirm('This doesn\'t look like a GEVI URL. Save anyway?')) {
      return;
    }
  }

  setIsSavingGeviUrl(true);

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        geviUrl: geviUrlInput
      })
    });

    const result = await response.json();
    
    if (result.success) {
      setData(prevData => ({
        ...prevData,
        geviUrl: geviUrlInput
      }));
      setShowGeviUrlModal(false);
      alert('GEVI URL saved successfully!');
    } else {
      alert(`Failed to save GEVI URL: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving GEVI URL:', error);
    alert('Failed to save GEVI URL');
  } finally {
    setIsSavingGeviUrl(false);
  }
};
```

#### Added UI Elements

**GEVI Link Display** (shows when URL is stored):
```javascript
{data.geviUrl && (
  <p>
    <a href={data.geviUrl} target="_blank" rel="noopener noreferrer" className="studio-link">
      🌐 View on GEVI
    </a>
  </p>
)}
```

**Set/Update Button**:
```javascript
<button 
  onClick={() => {
    setGeviUrlInput(data?.geviUrl || '');
    setShowGeviUrlModal(true);
  }}
  className="btn-secondary"
  style={{ marginTop: '10px' }}
  title={data?.geviUrl ? "Update GEVI URL" : "Set GEVI URL"}
>
  {data?.geviUrl ? '🔗 Update GEVI URL' : '🔗 Set GEVI URL'}
</button>
```

**Modal for URL Input**:
```javascript
{showGeviUrlModal && (
  <div className="modal-overlay" onClick={() => setShowGeviUrlModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>🔗 {data?.geviUrl ? 'Update' : 'Set'} GEVI Studio URL</h3>
      
      <div className="scrape-input-section">
        <label htmlFor="gevi-url-input">GEVI Studio URL:</label>
        <input
          id="gevi-url-input"
          type="text"
          value={geviUrlInput}
          onChange={(e) => setGeviUrlInput(e.target.value)}
          placeholder="https://gayeroticvideoindex.com/studio/..."
          disabled={isSavingGeviUrl}
          className="scrape-url-input"
        />
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          Enter the GEVI studio URL. This will be saved for quick reference.
        </p>
      </div>

      <div className="modal-actions">
        <button 
          className="btn-accept" 
          onClick={handleSaveGeviUrl}
          disabled={isSavingGeviUrl || !geviUrlInput.trim()}
        >
          {isSavingGeviUrl ? '⏳ Saving...' : '💾 Save URL'}
        </button>
        <button 
          className="btn-cancel" 
          onClick={() => setShowGeviUrlModal(false)}
          disabled={isSavingGeviUrl}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

## User Workflow

### Setting a GEVI URL

1. Navigate to any studio detail page
2. Click the **"🔗 Set GEVI URL"** button
3. Enter the GEVI studio URL in the modal
4. Click **"💾 Save URL"**
5. URL is saved and displayed as a link

### Updating a GEVI URL

1. Navigate to a studio that already has a GEVI URL
2. Click the **"🔗 Update GEVI URL"** button
3. Modify the URL in the modal (pre-filled with current value)
4. Click **"💾 Save URL"**
5. Updated URL is saved

### Accessing GEVI

Once a GEVI URL is stored:
- A **"🌐 View on GEVI"** link appears below the studio's website link
- Click the link to open the studio's GEVI page in a new tab

## UI Layout

### Studio Header (Before)
```
🏢 Studio Name
🔗 Visit Website
Description text...
```

### Studio Header (After - Without GEVI URL)
```
🏢 Studio Name
🔗 Visit Website
🔗 Set GEVI URL (button)
Description text...
```

### Studio Header (After - With GEVI URL)
```
🏢 Studio Name
🔗 Visit Website
🌐 View on GEVI
🔗 Update GEVI URL (button)
Description text...
```

## Validation

- **Empty URL**: Alerts user if they try to save without entering a URL
- **Invalid Format**: Warns user if the URL doesn't contain "gayeroticvideoindex.com"
- **Confirmation**: User can choose to save anyway even if format doesn't match

## Benefits

1. **Quick Reference**: Easily access a studio's GEVI page from the studio detail view
2. **Persistent Storage**: GEVI URLs are stored in the database and persist across sessions
3. **Easy Updates**: Simple interface to update URLs if they change
4. **Consistent Pattern**: Follows the same pattern used for scenes with GEVI URLs

## Technical Details

### Database Field
- **Type**: `String?` (optional)
- **Nullable**: Yes
- **Indexed**: No
- **Default**: `null`

### API Request Format

**Update Studio**:
```http
PUT /api/stash/studios/{id}
Content-Type: application/json

{
  "geviUrl": "https://gayeroticvideoindex.com/studio/123"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "name": "Studio Name",
    "url": "https://studio.com",
    "geviUrl": "https://gayeroticvideoindex.com/studio/123",
    "image": "...",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

### Error Handling

**Studio Not Found**:
```json
{
  "success": false,
  "error": "Studio with ID abc123 not found"
}
```

**Network Error**:
- Alert displayed to user
- Error logged to console
- Modal remains open for retry

## Future Enhancements

1. **Auto-Discovery**: Automatically search GEVI for matching studios
2. **Validation**: Check if the URL is valid and accessible
3. **Bulk Update**: Set GEVI URLs for multiple studios at once
4. **Link Preview**: Show studio info from GEVI before saving
5. **History**: Track changes to GEVI URLs over time

## Related Features

- **Scene GEVI URLs**: Scenes also have GEVI URL storage (already implemented)
- **Group GEVI URLs**: Groups/movies have GEVI URL storage (already implemented)
- **GEVI Scraping**: Can scrape metadata from GEVI for scenes

## Testing Checklist

- [x] Database migration applied successfully
- [x] Backend endpoint created and syntax validated
- [x] Frontend state management implemented
- [x] Button displays correctly on studio detail page
- [x] Modal opens and closes properly
- [ ] URL validation works
- [ ] Save functionality updates database
- [ ] GEVI link displays when URL is stored
- [ ] Update functionality preserves existing data
- [ ] Works with studios that have no website URL
- [ ] Works with studios that have a website URL

---

**Date**: January 14, 2025  
**Version**: 1.0.0  
**Status**: ✅ Implemented - Ready for Testing

## Files Modified

1. `server/prisma/schema.prisma` - Added `geviUrl` field to StashStudio
2. `server/routes/stash.js` - Added PUT endpoint for updating studios
3. `client/src/modules/media/pages/stash/StudioDetail.jsx` - Added UI and logic for GEVI URL management
