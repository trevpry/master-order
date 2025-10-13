# Clip Tagging Flow - Implementation Summary

## Overview
The clip tagging flow has been fully implemented following the two-step process defined in `Clip Tagging Flow.md`.

## Flow Implementation

### Step 1: Performer Count
When user clicks "Add Tags" button on a clip:

1. **Modal opens** showing Step 1: Performer Count
2. **Tag Selection Logic**:
   - 1 performer → Show "Solo" tag
   - 2 performers → Show "Couple Sex" tag
   - 3 performers → Show "Threesome" tag
   - 4 performers → Show "Foursome" tag
   - 5 performers → Show "Fivesome" tag
   - 6+ performers → Show "Orgy" tag
   - 0 performers → Show all performer count tags
3. User selects the performer count tag
4. User clicks **"Next →"** button (blue)
5. Tag is **applied to clip immediately**
6. Modal transitions to Step 2

### Step 2: Sex Acts
After performer count tag is applied:

1. **Modal shows** Step 2: Sex Acts
2. **Tag Selection Logic**:
   - If previous tag was "Solo" → Show "Masturbation" tag
   - If previous tag was anything else → Show "Oral Sex" tag
3. User selects the sex act tag
4. User clicks **"Apply ✓"** button (green)
5. Tag is **applied to clip**
6. Parent overlay **refreshes** to show new tags
7. Modal closes

## Technical Implementation

### Component: `StashClipTagSelector.jsx`
Located: `client/src/components/overlays/StashClipTagSelector.jsx`

**Key Features**:
- Multi-step state management (`step` = 1 or 2)
- Fetches all tags from database on mount (perPage=10000)
- Filters to leaf tags only (tags without children)
- Applies tags immediately after each step
- Dynamic UI based on current step

**State Variables**:
```javascript
const [step, setStep] = useState(1); // Current step (1 or 2)
const [allTags, setAllTags] = useState([]); // All database tags
const [availableTags, setAvailableTags] = useState([]); // Filtered tags for current step
const [selectedTags, setSelectedTags] = useState([]); // User selection
const [selectedPerformerTag, setSelectedPerformerTag] = useState(null); // Stored for step 2
const [loading, setLoading] = useState(true);
const [applying, setApplying] = useState(false);
```

**API Endpoints Used**:
- `GET /api/stash/tags?rootOnly=false&perPage=10000` - Fetch all tags
- `POST /api/android/stash/clip/:clipId/tags` - Apply tags to clip (both steps)

### Flow Logic

#### Step 1 - Performer Count Tag Selection
```javascript
// Determine recommended tag based on performer count
const getPerformerCountTag = () => {
  if (performerCount === 1) return 'Solo';
  if (performerCount === 2) return 'Couple Sex';
  if (performerCount === 3) return 'Threesome';
  if (performerCount === 4) return 'Foursome';
  if (performerCount === 5) return 'Fivesome';
  if (performerCount >= 6) return 'Orgy';
  return null; // Show all if 0 performers
};

// Filter available tags for step 1
if (step === 1) {
  const performerCountTagName = getPerformerCountTag();
  if (performerCountTagName) {
    // Find specific tag
    const specificTag = allTags.filter(tag => tag.name === performerCountTagName);
    if (specificTag.length > 0) {
      setAvailableTags(specificTag);
    } else {
      // Fallback: show all performer count tags
      const performerCountTags = allTags.filter(tag => 
        ['Solo', 'Couple Sex', 'Threesome', 'Foursome', 'Fivesome', 'Orgy'].includes(tag.name)
      );
      setAvailableTags(performerCountTags.length > 0 ? performerCountTags : allTags);
    }
  }
}
```

#### handleNext - Apply Performer Count Tag & Advance
```javascript
const handleNext = async () => {
  // Apply selected performer count tag
  const response = await fetch(
    `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: selectedTags })
    }
  );

  if (response.ok) {
    const selectedTag = availableTags.find(tag => selectedTags.includes(tag.id));
    toast.success(`✅ Added performer count tag: ${selectedTag?.name}`);
    
    // Store for step 2 logic
    setSelectedPerformerTag(selectedTag);
    
    // Reset selection and advance
    setSelectedTags([]);
    setStep(2);
  }
};
```

#### Step 2 - Sex Act Tag Selection
```javascript
// Filter available tags for step 2
if (step === 2) {
  let sexActTagName = 'Oral Sex'; // Default for multi-person
  
  if (selectedPerformerTag?.name === 'Solo') {
    sexActTagName = 'Masturbation';
  }
  
  const sexActTag = allTags.filter(tag => tag.name === sexActTagName);
  
  if (sexActTag.length > 0) {
    setAvailableTags(sexActTag);
  } else {
    // Fallback: show all tags
    setAvailableTags(allTags);
  }
}
```

#### handleApplyTags - Apply Sex Act Tag & Close
```javascript
const handleApplyTags = async () => {
  // Apply selected sex act tag
  const response = await fetch(
    `${config.apiBaseUrl}/api/android/stash/clip/${clipId}/tags`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tagIds: selectedTags })
    }
  );

  if (response.ok) {
    toast.success(`✅ Added sex act tag: ${selectedTagNames}`);
    
    // Notify parent to refresh
    if (onTagsAdded) {
      onTagsAdded([...selectedTags]);
    }
    
    onClose();
  }
};
```

## UI Elements

### Step 1 UI
- **Header**: "Step 1: Performer Count"
- **Subtitle**: "X performer(s) - Select '[TagName]'"
- **Info Panel**: Shows performer count and recommended tag
- **Tag Grid**: Shows filtered performer count tag(s)
- **Footer**: "Cancel" | "Next →" (blue button)

### Step 2 UI
- **Header**: "Step 2: Sex Acts"
- **Subtitle**: "Previous: [PerformerTag] - Now select sex act"
- **Info Panel**: Shows logic (e.g., "Based on Solo, select Masturbation")
- **Tag Grid**: Shows filtered sex act tag
- **Footer**: "Cancel" | "Apply ✓ X Tag(s)" (green button)

## Tag Database Structure
- Tags include `childTags` array to identify parent/child relationships
- Only **leaf tags** (tags without children) are shown in selector
- All tags fetched with `perPage=10000` to avoid pagination issues

## Integration Points

### Parent Component: `StashClipOverlay.jsx`
```javascript
// Trigger tag selector
<button onClick={() => setShowTagSelector(true)}>
  ➕ Add Tags
</button>

// Render tag selector
{showTagSelector && (
  <StashClipTagSelector
    clipId={clip.id}
    performerCount={scene.performers?.length || 0}
    onClose={() => setShowTagSelector(false)}
    onTagsAdded={handleTagsAdded}
  />
)}

// Refresh callback
const handleTagsAdded = async (addedTagIds) => {
  await fetchClipTags(); // Reload clip tags to show green checkmarks
};
```

## Fallback Behavior
If specific tags don't exist in database:
- **Step 1**: Falls back to showing all performer count tags, or all leaf tags if none found
- **Step 2**: Falls back to showing all leaf tags if specific sex act tag not found

## Success Indicators
- **Step 1**: Toast message "✅ Added performer count tag: [TagName]"
- **Step 2**: Toast message "✅ Added sex act tag: [TagName]"
- **Parent Overlay**: Green checkmarks appear on newly added tags after refresh

## Testing the Flow
1. Request clip from Android API: `curl http://localhost:3001/api/android/stash/next`
2. Wait for clip overlay to appear in web app
3. Click "➕ Add Tags" button
4. **Step 1**: Select performer count tag → Click "Next →"
5. Verify toast shows success
6. **Step 2**: Select sex act tag → Click "Apply ✓"
7. Verify toast shows success
8. Verify clip overlay refreshes with green checkmarks on both tags

## Files Modified
- `client/src/components/overlays/StashClipTagSelector.jsx` - Multi-step tag selector implementation
- `client/src/components/overlays/StashClipOverlay.jsx` - Integration and refresh callback

## Database Requirements
For optimal functionality, ensure these tags exist in your Stash database:
- **Performer Count Tags**: Solo, Couple Sex, Threesome, Foursome, Fivesome, Orgy
- **Sex Act Tags**: Masturbation, Oral Sex

Tags should be **leaf tags** (no child tags) for proper filtering.
