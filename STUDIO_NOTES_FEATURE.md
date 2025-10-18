# Studio Notes Feature

**Date**: October 17, 2025  
**Status**: ✅ COMPLETE - Requires Database Migration

---

## Summary

Added a "Notes" field to Studio details page allowing users to add and edit custom notes about studios (contracts, preferences, contact info, etc.)

---

## Changes Made

### Database Schema (`server/prisma/schema.prisma`)

Added `notes` field to `StashStudio` model:

```prisma
model StashStudio {
  id           String         @id
  name         String         @unique
  url          String?
  image        String?
  geviUrl      String?
  notes        String?        // Custom notes about the studio ← NEW
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  lastSyncedAt DateTime       @default(now())
  // ...
}
```

**Field Details**:
- **Type**: `String?` (nullable text)
- **Purpose**: Store user-entered notes about the studio
- **Use Cases**: Contract details, preferences, contact information, reminders, etc.

### Backend API (`server/routes/stash.js`)

Updated `PUT /api/stash/studios/:id` endpoint to accept `notes` parameter:

```javascript
router.put('/studios/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { geviUrl, notes } = req.body;  // Added notes

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
  if (notes !== undefined) updateData.notes = notes;  // Save notes

  const updatedStudio = await prisma.stashStudio.update({
    where: { id },
    data: updateData
  });

  sendSuccess(res, updatedStudio);
}));
```

**API Endpoint**: `PUT /api/stash/studios/:id`

**Request Body**:
```json
{
  "notes": "Studio prefers natural lighting. Contact: john@studio.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": "123",
    "name": "Studio Name",
    "notes": "Studio prefers natural lighting. Contact: john@studio.com",
    // ... other fields
  }
}
```

### Frontend UI (`client/src/modules/media/pages/stash/StudioDetail.jsx`)

#### 1. Added State Management

```javascript
// Notes state
const [showNotesModal, setShowNotesModal] = useState(false);
const [notesInput, setNotesInput] = useState('');
const [isSavingNotes, setIsSavingNotes] = useState(false);
```

#### 2. Added Save Handler

```javascript
const handleSaveNotes = async () => {
  setIsSavingNotes(true);

  try {
    const response = await fetch(`${config.apiBaseUrl}/api/stash/studios/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        notes: notesInput
      })
    });

    const result = await response.json();
    
    if (result.success) {
      setData(prevData => ({
        ...prevData,
        notes: notesInput
      }));
      setShowNotesModal(false);
      alert('Notes saved successfully!');
    } else {
      alert(`Failed to save notes: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error saving notes:', error);
    alert('Failed to save notes');
  } finally {
    setIsSavingNotes(false);
  }
};
```

#### 3. Added UI Button

```javascript
<button 
  onClick={() => {
    setNotesInput(data?.notes || '');
    setShowNotesModal(true);
  }}
  className="btn-secondary"
  style={{ marginTop: '10px', marginLeft: '10px' }}
  title={data?.notes ? "Edit Notes" : "Add Notes"}
>
  {data?.notes ? '📝 Edit Notes' : '📝 Add Notes'}
</button>
```

#### 4. Added Notes Display

Shows saved notes below the buttons:

```javascript
{data.notes && (
  <div className="studio-notes" style={{ 
    marginTop: '15px', 
    padding: '12px', 
    backgroundColor: '#f9fafb', 
    borderRadius: '6px',
    borderLeft: '3px solid #8b5cf6'
  }}>
    <strong style={{ color: '#6b7280' }}>📝 Notes:</strong>
    <p style={{ 
      marginTop: '8px', 
      whiteSpace: 'pre-wrap', 
      color: '#374151',
      lineHeight: '1.6'
    }}>
      {data.notes}
    </p>
  </div>
)}
```

**Features**:
- Purple left border for visual distinction
- Pre-wrap text formatting (preserves line breaks)
- Light gray background
- Only shows if notes exist

#### 5. Added Edit Modal

```javascript
{showNotesModal && (
  <div className="modal-overlay" onClick={() => setShowNotesModal(false)}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h3>📝 {data?.notes ? 'Edit' : 'Add'} Studio Notes</h3>
      
      <div className="scrape-input-section">
        <label htmlFor="notes-input">Notes:</label>
        <textarea
          id="notes-input"
          value={notesInput}
          onChange={(e) => setNotesInput(e.target.value)}
          placeholder="Enter notes about this studio..."
          disabled={isSavingNotes}
          rows={8}
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontSize: '14px',
            fontFamily: 'inherit',
            resize: 'vertical'
          }}
        />
        <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
          Add any notes or information about this studio (contracts, preferences, etc.)
        </p>
      </div>

      <div className="modal-actions">
        <button 
          className="btn-accept" 
          onClick={handleSaveNotes}
          disabled={isSavingNotes}
        >
          {isSavingNotes ? '⏳ Saving...' : '💾 Save Notes'}
        </button>
        <button 
          className="btn-cancel" 
          onClick={() => setShowNotesModal(false)}
          disabled={isSavingNotes}
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

**Features**:
- Textarea with 8 rows (resizable)
- Save/Cancel buttons
- Loading state during save
- Click outside to close

---

## User Experience

### Adding Notes

1. Navigate to any Studio detail page
2. Click "📝 Add Notes" button (below GEVI URL button)
3. Modal opens with textarea
4. Enter notes (can use multiple lines)
5. Click "💾 Save Notes"
6. Success message appears
7. Notes display below buttons with purple border

### Editing Notes

1. Click "📝 Edit Notes" button
2. Modal opens with existing notes pre-filled
3. Edit the notes
4. Click "💾 Save Notes"
5. Updated notes appear immediately

### Viewing Notes

- Notes are always visible when they exist
- Displayed in a styled box with:
  - Purple left border
  - Light gray background
  - "📝 Notes:" header
  - Preserves line breaks and formatting

---

## Migration Required

**IMPORTANT**: Before this feature works, you must run a database migration to add the `notes` column.

### Migration Steps

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Synchronize schemas** (if using both SQLite and PostgreSQL):
   ```bash
   cp prisma/schema.prisma prisma/schema.sqlite.prisma
   cp prisma/schema.prisma prisma/schema.postgresql.prisma
   
   # Update PostgreSQL provider
   sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.postgresql.prisma
   ```

3. **Generate Prisma client and create migration**:
   ```bash
   npx prisma generate
   npx prisma migrate dev --name "add_studio_notes"
   ```

4. **Verify migration**:
   ```bash
   # Check if migration file was created
   ls prisma/migrations/
   
   # Should see a new directory like: 20251017_add_studio_notes/
   ```

### Migration SQL

The migration will add:

```sql
-- Add notes column to StashStudio table
ALTER TABLE "StashStudio" ADD COLUMN "notes" TEXT;
```

---

## Use Cases

### Contract Information
```
Contract expires: December 2025
Rate: $500/scene
Contact: contracts@studio.com
Notes: Prefers 4K filming
```

### Production Preferences
```
Studio Preferences:
- Natural lighting preferred
- No tattooed performers
- Requires 2 weeks notice for bookings
- Provides own makeup artist
```

### Contact Details
```
Primary Contact: John Smith
Email: john@studio.com
Phone: (555) 123-4567
Alt Contact: Jane Doe (jane@studio.com)
```

### Reminders
```
TODO:
- Follow up on contract renewal (Nov 1)
- Update location address
- Request new promotional materials
```

### Historical Notes
```
First worked with: Jan 2024
Projects completed: 15 scenes
Quality: Excellent
Would work with again: Yes
Special note: Always pays on time
```

---

## Benefits

✅ **Centralized Information**: All studio-related notes in one place  
✅ **Persistent Storage**: Notes saved to database, never lost  
✅ **Easy Access**: Always visible on studio detail page  
✅ **Flexible Format**: Support for multiline text, lists, etc.  
✅ **Quick Editing**: Simple modal interface for updates  
✅ **Visual Design**: Styled box makes notes stand out  
✅ **No Character Limit**: Store as much information as needed

---

## Testing Checklist

- [x] ✅ Database schema updated
- [x] ✅ API endpoint updated to handle notes
- [x] ✅ Frontend state management added
- [x] ✅ Save handler implemented
- [x] ✅ UI button added
- [x] ✅ Notes display implemented
- [x] ✅ Edit modal implemented
- [x] ✅ No syntax errors
- [ ] Run database migration
- [ ] Test adding notes to a studio
- [ ] Test editing existing notes
- [ ] Test notes display (multiline, formatting)
- [ ] Test saving empty notes (clear notes)
- [ ] Verify notes persist after page reload
- [ ] Test with long notes (100+ lines)

---

## Files Modified

### Backend
- ✅ `server/prisma/schema.prisma` - Added `notes` field
- ✅ `server/routes/stash.js` - Updated PUT endpoint

### Frontend
- ✅ `client/src/modules/media/pages/stash/StudioDetail.jsx`
  - Added notes state management
  - Added save handler
  - Added UI button
  - Added notes display
  - Added edit modal

---

## Related Features

Similar notes functionality could be added to:
- **Performers**: Notes about availability, preferences, rates
- **Scenes**: Production notes, issues, special requirements
- **Groups/Movies**: Collection notes, sequel plans
- **Tags**: Usage guidelines, categorization notes

---

## Future Enhancements

### Rich Text Editing
- Markdown support for formatting
- Bold, italic, lists
- Links and images

### Notes History
- Track changes over time
- See who edited notes (if multi-user)
- Restore previous versions

### Search
- Search studios by notes content
- Filter studios by notes keywords

### Templates
- Pre-defined note templates
- Quick insert for common formats

### Sharing
- Export notes to text/PDF
- Share notes between users

---

**Status**: ✅ Code Complete - Awaiting Database Migration  
**Last Updated**: October 17, 2025  
**Next Step**: Run `npx prisma migrate dev --name "add_studio_notes"`
