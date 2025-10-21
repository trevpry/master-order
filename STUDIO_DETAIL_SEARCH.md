# Studio Detail Page - Search Enhancement

## Changes Made

Added comprehensive search and filter functionality to the Studio Detail page to help users find specific scenes within a studio's catalog.

### New Features

#### 1. Title Search
- **Input Field**: Search scenes by title
- **Behavior**: Filters scenes in real-time as you type
- **Auto-reset**: Resets to page 1 when search changes

#### 2. Performer Search
- **Input Field**: Search scenes by performer name
- **Behavior**: Filters scenes containing the specified performer
- **Auto-reset**: Resets to page 1 when search changes

#### 3. Enhanced Filter UI
- **Organized Layout**: Search inputs in a styled container with clear labels
- **Responsive Design**: Flexbox layout adapts to different screen sizes
- **Clear Filters Button**: One-click button to reset all filters and searches
- **Visual Feedback**: Highlighted container with border and background color

### UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🔍 Search by Title:        👤 Search by Performer: │
│  [Enter scene title...]     [Enter performer...]    │
│                                                      │
│  ☐ Show only scenes with no performers  [Clear ×]   │
└─────────────────────────────────────────────────────┘
```

### Technical Implementation

**State Variables Added:**
```javascript
const [searchTitle, setSearchTitle] = useState('');
const [searchPerformer, setSearchPerformer] = useState('');
```

**API Integration:**
- Sends `title` parameter when title search is active
- Sends `performer` parameter when performer search is active
- Both work in combination with existing filters

**useEffect Dependencies:**
```javascript
useEffect(() => {
  if (data) {
    loadScenes();
  }
}, [scenesPage, data, filterNoPerformers, searchTitle, searchPerformer]);
```

### User Experience Improvements

1. **Clear Visual Organization**
   - Search inputs grouped in styled container
   - Icons (🔍 👤) for quick identification
   - Light background to distinguish search area

2. **Instant Feedback**
   - Results update as you type
   - Page automatically resets to 1 on new search
   - Loading spinner shown during search

3. **Easy Reset**
   - "Clear Filters" button appears when any filter is active
   - One click clears: title search, performer search, and no-performers filter
   - Button styled in red for visibility

4. **Flexible Filtering**
   - All filters work independently or together
   - Combine title + performer + no-performers filter
   - Maintains pagination state correctly

### API Compatibility

Uses existing `/api/stash/scenes` endpoint with these query parameters:
- `studio` - Already used (studio name)
- `title` - Scene title search (now added)
- `performer` - Performer name search (now added)
- `noPerformers` - Filter scenes without performers (existing)
- `page`, `perPage`, `sortBy`, `sortDirection` - Pagination (existing)

### Styling Details

**Search Container:**
- Background: `#f9fafb` (light gray)
- Border: `1px solid #e5e7eb`
- Border radius: `8px`
- Padding: `15px`
- Gap between elements: `15px`

**Input Fields:**
- Border: `1px solid #d1d5db`
- Border radius: `6px`
- Padding: `8px 12px`
- Full width with minimum 200px
- Responsive flex layout

**Clear Button:**
- Background: `#ef4444` (red)
- Color: white
- Border radius: `6px`
- Only visible when filters are active

### Use Cases

1. **Find Specific Scene**: Search by partial title match
2. **Find Performer's Scenes**: Search by performer name
3. **Combined Search**: "Find scenes with 'Outdoor' in title featuring 'John'"
4. **Empty Performer Slots**: Use "no performers" filter to find scenes needing performer tagging
5. **Quick Browse**: Clear all filters to see all studio scenes

## Files Modified

- `client/src/modules/media/pages/stash/StudioDetail.jsx`

## Testing Checklist

- [ ] Title search filters scenes correctly
- [ ] Performer search filters scenes correctly
- [ ] Combined title + performer search works
- [ ] "No performers" checkbox still works
- [ ] Clear filters button resets all filters
- [ ] Pagination resets to page 1 when filters change
- [ ] Search works with pagination
- [ ] Loading states display correctly
- [ ] Responsive layout works on mobile/tablet
- [ ] API requests include correct parameters

## Future Enhancements

Potential improvements for later:
- Debounce search inputs (wait 300ms after typing stops)
- Add date range filter
- Add tag/genre filter
- Save search preferences in localStorage
- Export search results
- Advanced search modal with more options
