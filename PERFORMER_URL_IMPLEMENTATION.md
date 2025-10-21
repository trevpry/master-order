# Performer URL Scraping and Storage - Complete Implementation

## Problem
When scraping scenes from GayNetwork sites, performer URLs were being extracted but not saved to Stash or the local database.

## Root Causes

### 1. Frontend Not Passing URLs to Backend ❌
When creating unmatched performers, the frontend was only sending the performer name, not the URL from scraped data.

### 2. Matched Performers Not Getting URLs Updated ❌
When accepting scraped data, matched performers weren't having their URLs updated even though the scraped URL was available.

## Complete Solution

### Backend Changes ✅

#### 1. YamlScraperService - Extract Performer URLs
**File**: `server/services/scrapers/YamlScraperService.js`

**Lines 258-292** - Updated `extractArray()` to handle attribute extraction:
```javascript
extractArray($, config) {
  const results = [];
  
  if (!config) return results;
  
  const originalXpath = config;
  
  // Check if it's an attribute selector
  const attrMatch = originalXpath.match(/\/@(\w+)$/);
  const attributeName = attrMatch ? attrMatch[1] : null;
  
  const selector = this.xpathToJquery(config);
  
  try {
    $(selector).each((i, el) => {
      let value;
      
      // Extract attribute or text
      if (attributeName) {
        value = $(el).attr(attributeName);
      } else {
        value = $(el).text().trim();
      }
      
      if (value && value.trim() !== '') {
        results.push(value.trim());
      }
    });
  } catch (error) {
    console.warn(`   ⚠️ Array selector error for "${selector}":`, error.message);
  }
  
  return results;
}
```

**Lines 377-400** - Extract and match performer URLs:
```javascript
// Extract Performers
if (sceneConfig.Performers && sceneConfig.Performers.Name) {
  const performerNames = this.extractArray($, sceneConfig.Performers.Name);
  metadata.performers = performerNames.map(name => ({ name, url: null }));
  
  // Extract performer URLs if configured
  if (sceneConfig.Performers.URL) {
    const performerUrls = this.extractArray($, sceneConfig.Performers.URL);
    // Match URLs to performers by index
    performerUrls.forEach((url, index) => {
      if (metadata.performers[index]) {
        // Convert relative URL to absolute
        if (url && !url.startsWith('http')) {
          url = this.absUrl(url, metadata.url);
        }
        metadata.performers[index].url = url;
      }
    });
  }
  
  if (metadata.performers.length > 0) {
    console.log(`   - Found ${metadata.performers.length} performer(s):`, 
      metadata.performers.map(p => p.url ? `${p.name} (${p.url})` : p.name).join(', '));
  }
}
```

#### 2. GEVI Scraper Service - Include URLs in Matching
**File**: `server/services/geviScraperService.js`

**Lines 1083-1095** - Extract URL from performer objects:
```javascript
async matchPerformers(scrapedPerformers, prisma) {
  const matched = [];
  const unmatched = [];

  // Get all performers once for efficiency
  const allPerformers = await prisma.stashPerformer.findMany();

  for (const performer of scrapedPerformers) {
    // Extract name and URL from object or use string directly
    const performerName = typeof performer === 'string' ? performer : performer.name;
    const performerUrl = typeof performer === 'object' ? performer.url : null;
    
    // ... matching logic ...
```

**Lines 1160-1170** - Include scraped URL in matched results:
```javascript
matched.push({
  id: bestMatch.performer.id,
  name: bestMatch.performer.name,
  matchedVia: bestMatch.matchedVia,
  matchedAlias: bestMatch.matchedVia === 'alias' ? bestMatch.matchedText : null,
  alternatives: alternatives,
  originalName: performerName,
  scrapedUrl: performerUrl  // Store the scraped URL
});
```

#### 3. Performer Create Endpoint - Accept URL Parameter
**File**: `server/routes/stash.js` - POST `/api/stash/performers/create`

**Line 1247** - Extract URL from request:
```javascript
const { name, aliases, gender, birthdate, ethnicity, country, eyeColor, hairColor, height, measurements, fakeTits, penisLength, circumcised, tattoos, piercings, careerLength, details, url } = req.body;
```

**Line 1298** - Add URL to GraphQL mutation:
```javascript
const variables = {
  input: {
    name: name,
    alias_list: aliases || [],
    // ... other fields ...
    url: url || null,
    // ... more fields ...
  }
};
```

**Line 1368** - Save URL to local database:
```javascript
const localPerformer = await prisma.stashPerformer.create({
  data: {
    id: stashPerformer.id,
    name: stashPerformer.name,
    // ... other fields ...
    url: stashPerformer.url || null,
    // ... more fields ...
  }
});
```

### Frontend Changes ✅

#### 1. Extract URL When Creating Unmatched Performers
**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Lines 698-708** - Find scraped performer and extract URL:
```javascript
try {
  console.log('👤 Creating performer:', performerName);
  
  // Find the scraped performer to get additional data (action code, URL, etc.)
  const scrapedPerformer = scrapeData.scraped.performers.find(
    sp => sp.name === performerName
  );
  
  // Create the performer with minimal data
  const createResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: performerName,
      url: scrapedPerformer?.url || null,  // ← Include scraped URL
      // ... other fields ...
    })
  });
```

#### 2. Update URLs for Matched Performers
**File**: `client/src/modules/media/pages/stash/SceneDetail.jsx`

**Lines 573-602** - Update performer URLs before accepting scrape:
```javascript
const handleAcceptScrape = async () => {
  try {
    // Update performer URLs for matched performers if scraped URL is available
    for (const matchedPerformer of scrapeData.matched.performers) {
      if (matchedPerformer.scrapedUrl) {
        try {
          console.log(`📝 Updating URL for performer ${matchedPerformer.name}: ${matchedPerformer.scrapedUrl}`);
          const updateResponse = await fetch(`${config.apiBaseUrl}/api/stash/performers/${matchedPerformer.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: matchedPerformer.name,
              newUrls: [matchedPerformer.scrapedUrl]
            })
          });
          
          const updateResult = await updateResponse.json();
          if (updateResult.success) {
            console.log(`✅ Updated URL for ${matchedPerformer.name}`);
          }
        } catch (error) {
          console.error(`❌ Error updating URL for ${matchedPerformer.name}:`, error);
        }
      }
    }
    
    // Continue with scene update...
```

### YAML Configuration ✅

**File**: `server/services/scrapers/configs/GayNetwork.yml`

```yaml
Performers:
  Name: //div[contains(@class, "text-terciary") and contains(@class, "text-truncate")]
  URL: //div[@class="mt-4"]//a[contains(@class, "h100")]/@href
```

## Complete Flow

### When Scraping a GayNetwork Scene:

1. **Extract Names and URLs**:
   - Names: `["Bab SANN", "Blas LIMA"]`
   - URLs: `["/en/modeles/detail/38570-bab-sann", "/en/modeles/detail/38571-blas-lima"]`

2. **Convert to Absolute URLs**:
   - `["https://www.crunchboy.com/en/modeles/detail/38570-bab-sann", "https://www.crunchboy.com/en/modeles/detail/38571-blas-lima"]`

3. **Match Against Database**:
   - Matched performers include `scrapedUrl` field
   - Unmatched performers include full object with `name` and `url`

### When Creating Unmatched Performer:

1. Frontend finds scraped performer object
2. Extracts URL from scraped data
3. Sends URL to backend in create request
4. Backend saves URL to both Stash and local database

### When Accepting Scraped Data:

1. For each matched performer with `scrapedUrl`:
   - Call PUT `/api/stash/performers/:id` with `newUrls` array
   - URL is merged with existing URLs (no duplicates)
   - Both Stash and local DB are updated

2. Continue with scene update (performers, studio, details, etc.)

## Testing

1. **Scrape a GayNetwork scene** (e.g., Crunchboy):
   ```
   https://www.crunchboy.com/en/videos/detail/12345-scene-name
   ```

2. **Check console logs** - should show:
   ```
   - Found 2 performer(s): Bab SANN (https://www.crunchboy.com/en/modeles/detail/38570-bab-sann), 
     Blas LIMA (https://www.crunchboy.com/en/modeles/detail/38571-blas-lima)
   ```

3. **For unmatched performers** - click "Create Performer":
   - Check console: Should show "Creating performer: [name]"
   - After creation, check Stash performer page - URL field should be populated

4. **For matched performers** - click "Accept Changes":
   - Check console: Should show "📝 Updating URL for performer [name]: [url]"
   - Check console: Should show "✅ Updated URL for [name]"
   - Check Stash performer page - URL should be added/updated

5. **Verify in Stash**:
   - Open performer in Stash
   - Check URLs section - should contain GayNetwork performer URL
   - URL should be clickable and work

## Result ✅

Performer URLs are now:
- ✅ Extracted from GayNetwork scenes
- ✅ Saved when creating new performers
- ✅ Updated for existing matched performers
- ✅ Stored in both Stash and local database
- ✅ Displayed and accessible in Stash UI
