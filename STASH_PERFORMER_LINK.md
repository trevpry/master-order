# Stash Performer Link - Quick Access to Stash Server

## Overview

Added a direct link from the performer detail page to view the performer on the Stash server. This allows users to quickly navigate to the full Stash interface for additional performer information and functionality.

## Implementation

### Frontend Changes

**File**: `client/src/modules/media/pages/stash/PerformerDetail.jsx`

**Changes Made**:

1. **Added State for Stash URL**:
```javascript
const [stashUrl, setStashUrl] = useState(null);
```

2. **Fetch Stash URL from Settings**:
```javascript
useEffect(() => {
  const fetchStashUrl = async () => {
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/stash/check-connection`);
      const json = await res.json();
      if (json.connected && json.stashUrl) {
        setStashUrl(json.stashUrl);
      }
    } catch (error) {
      console.error('Failed to fetch Stash URL:', error);
    }
  };
  fetchStashUrl();
}, []);
```

3. **Added Link in Header**:
```javascript
{stashUrl && (
  <a 
    href={`${stashUrl}/performers/${data.id}`} 
    target="_blank" 
    rel="noopener noreferrer" 
    className="social-link-inline"
    title="View in Stash"
  >
    📊
  </a>
)}
```

## UI Placement

The Stash link appears in the performer header, alongside other links:

```
┌─────────────────────────────────────────────────────┐
│ 👤 Performer Name        🌍 USA  🔗 📷 🐦 📊        │
└─────────────────────────────────────────────────────┘
```

**Icons**:
- 🔗 = Personal website
- 📷 = Instagram
- 🐦 = Twitter
- 📊 = Stash server link (**NEW**)

## Behavior

### Link Display
- **Shows**: Only when Stash server is configured and reachable
- **Hides**: If Stash URL not available or connection fails
- **Opens**: In new browser tab/window (`target="_blank"`)

### URL Format
```
{stashUrl}/performers/{performerId}
```

**Example**:
```
http://localhost:9999/performers/abc123-def456-ghi789
```

### Security
- Uses `rel="noopener noreferrer"` for security when opening external links
- Only displays when Stash connection is verified

## Benefits

### 1. Quick Navigation
Users can instantly navigate from the Master Order performer page to the full Stash performer page without:
- Manually opening Stash
- Searching for the performer
- Looking up the performer ID

### 2. Access to Full Stash Features
The Stash server provides additional features not available in Master Order:
- Full resolution images
- Additional metadata fields
- Performer relationships
- Full scene filtering/search
- Gallery access
- Edit capabilities

### 3. Context Switching
Users can easily switch between:
- **Master Order**: Curated view with custom ordering, tags, and integrations
- **Stash**: Full library management with all original data

## Use Cases

### Use Case 1: Edit Performer Details
**Scenario**: User wants to update performer metadata

**Flow**:
1. View performer in Master Order
2. Click 📊 icon to open Stash
3. Edit details in Stash interface
4. Return to Master Order and sync to see updates

### Use Case 2: Access Full Resolution Images
**Scenario**: User wants to see full performer image gallery

**Flow**:
1. View performer in Master Order
2. Click 📊 icon
3. View full resolution images and galleries in Stash

### Use Case 3: Advanced Scene Filtering
**Scenario**: User wants to filter performer's scenes by specific criteria

**Flow**:
1. View performer in Master Order
2. Click 📊 icon
3. Use Stash's advanced filtering on performer's scenes page

## Technical Details

### Stash URL Retrieval

**Endpoint**: `GET /api/stash/check-connection`

**Response**:
```json
{
  "connected": true,
  "stashUrl": "http://localhost:9999",
  "version": "v0.25.0"
}
```

**Note**: The component fetches this on mount to determine if the link should be shown.

### Performer ID

The `data.id` field contains the Stash performer ID, which is used directly in the URL:
```javascript
href={`${stashUrl}/performers/${data.id}`}
```

**Example ID**: `"abc123-def456-ghi789-012345"`

### Link Styling

Uses existing `.social-link-inline` CSS class for consistent styling with other social media links:
```css
.social-link-inline {
  /* Existing styles from theme */
  text-decoration: none;
  padding: 4px 8px;
  /* ... */
}
```

## Edge Cases

### Stash Not Configured
- **Behavior**: Link does not appear
- **User Experience**: No broken links or errors
- **Detection**: `stashUrl` remains `null`

### Connection Fails
- **Behavior**: Link does not appear
- **Logging**: Error logged to console
- **User Impact**: Silent failure, no visual error

### Stash URL Changes
- **Current**: Only fetched on component mount
- **Future Enhancement**: Could refresh when user returns to page
- **Workaround**: User can refresh page to get updated URL

### Invalid Performer ID
- **Rare Case**: If performer ID is invalid/missing
- **Behavior**: Link may lead to 404 on Stash server
- **Protection**: Stash handles 404 gracefully

## Future Enhancements

### 1. Connection Status Indicator
Show visual indicator of Stash connection status:
```
📊 (green) = Connected and reachable
📊 (gray) = Not configured/unavailable
```

### 2. Link Preview
Show tooltip with full URL on hover:
```
title="View in Stash: http://localhost:9999/performers/..."
```

### 3. Deep Links to Specific Tabs
Link directly to specific Stash tabs:
```
${stashUrl}/performers/${data.id}?tab=scenes
${stashUrl}/performers/${data.id}?tab=galleries
```

### 4. Bidirectional Sync Indicator
Show if performer data is in sync with Stash or needs refresh.

### 5. Context Menu
Right-click options:
- Open in Stash
- Copy Stash URL
- Sync from Stash now

## Testing

### Manual Testing Steps

1. **With Stash Configured**:
   - Configure Stash URL in Settings
   - Navigate to any performer detail page
   - ✅ Verify 📊 icon appears in header
   - Click icon
   - ✅ Verify Stash opens to correct performer page

2. **Without Stash Configured**:
   - Remove Stash URL from Settings
   - Navigate to performer detail page
   - ✅ Verify 📊 icon does NOT appear
   - ✅ Verify no errors in console

3. **Stash Unreachable**:
   - Configure Stash URL but stop Stash server
   - Navigate to performer detail page
   - ✅ Verify link behavior (may or may not show depending on cached connection status)

4. **Icon Placement**:
   - View performer with all social links (URL, Instagram, Twitter, Stash)
   - ✅ Verify icons are evenly spaced
   - ✅ Verify consistent styling
   - ✅ Verify Stash icon appears at the end

## Related Components

- **SceneDetail.jsx**: Could benefit from similar Stash link
- **GroupDetail.jsx**: Could benefit from similar Stash link
- **Settings Page**: Where Stash URL is configured

## Related Documentation

- Stash API Documentation (external)
- Master Order Settings Guide
- Stash Integration Overview

---

**Status**: ✅ Implemented and Ready  
**Date**: January 14, 2025  
**Version**: 1.0.0  
**File Modified**: `client/src/modules/media/pages/stash/PerformerDetail.jsx`
