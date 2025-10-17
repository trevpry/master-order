# Performer Attribute Tag Mapping Implementation

## Overview
This implementation changes how certain performer attributes (starting with **Ethnicity**) are stored and managed. Instead of storing them as simple text fields, they now map to hierarchical tags in the Stash tag system.

## Architecture

### Modular Components

#### 1. PerformerTagMappingService (`server/services/performerTagMappingService.js`)
**Purpose**: Reusable service for mapping performer attributes to tags

**Key Features**:
- Find or create tags under parent categories
- Match by tag name or aliases (case-insensitive)
- Create tags in both local DB and Stash (via GraphQL)
- Batch processing for multiple attributes
- Clean component separation

**Main Methods**:
```javascript
// Find or create a tag under a parent category
async findOrCreateTag(value, parentTagName)

// Find parent tag by name
async findParentTag(parentTagName)

// Search children by name or alias
async findChildTagByNameOrAlias(parentTagId, searchValue)

// Create tag in Stash and local DB
async createTagInStashAndDB(name, parentTagId)

// Create tag in Stash via GraphQL
async createTagInStash(name, parentTagId)

// Batch process multiple attributes
async mapPerformerAttributes(attributes, parentTagNames)
```

**Dependency Injection**:
The service accepts a Stash API client function in the constructor, enabling:
- Reuse across different sync services
- Easy testing with mock clients
- No hard-coded dependencies

```javascript
const tagMappingService = new PerformerTagMappingService(
  (query, variables) => stashSyncService.makeGraphQLRequest(query, variables)
);
```

#### 2. Database Schema Updates

**StashPerformer Model** (`server/prisma/schema.prisma`):
```prisma
model StashPerformer {
  // ... existing fields ...
  
  ethnicity       String? // Deprecated - kept for backward compatibility
  ethnicityTagId  String? // FK to StashTag (child of "Race" parent tag)
  
  // ... existing fields ...
  
  ethnicityTag    StashTag? @relation("PerformerEthnicityTag", 
                                      fields: [ethnicityTagId], 
                                      references: [id], 
                                      onDelete: SetNull)
  // ... existing relations ...
}
```

**StashTag Model**:
```prisma
model StashTag {
  // ... existing fields ...
  
  // Performer attribute relations
  performersWithEthnicity StashPerformer[] @relation("PerformerEthnicityTag")
  
  // ... existing relations ...
}
```

**Migration**: `20251016180713_add_performer_ethnicity_tag_mapping`

#### 3. Sync Service Integration

Both legacy and optimized sync services now use the tag mapping service:

**StashSyncServiceOptimized** (`server/stashSyncServiceOptimized.js`):
```javascript
// Constructor initialization
this.tagMappingService = new PerformerTagMappingService(
  (query, variables) => this.makeGraphQLRequestWithRetry(query, variables)
);

// In syncPerformersOptimized():
// 1. Process ethnicity tag mapping BEFORE transaction
const ethnicityTagMap = new Map();

for (const performer of validPerformers) {
  if (performer.ethnicity) {
    const ethnicityTag = await this.tagMappingService.findOrCreateTag(
      performer.ethnicity,
      'Race'
    );
    
    if (ethnicityTag) {
      ethnicityTagMap.set(performer.id, ethnicityTag.id);
    }
  }
}

// 2. Link tag during performer data creation
const performerData = {
  // ... other fields ...
  ethnicity: performer.ethnicity || null, // Backward compatibility
  ethnicityTagId: ethnicityTagMap.get(performer.id) || null, // NEW
  // ... other fields ...
};
```

**StashSyncService** (`server/stashSyncService.js`):
Same pattern applied to legacy sync service for consistency.

## How It Works

### Tag Matching Flow

1. **Find Parent Tag**
   - Search for "Race" parent tag in local database
   - If not found, log warning and skip mapping

2. **Search for Existing Child Tag**
   - Get all children of parent tag
   - Check each child's name (case-insensitive)
   - Check each child's aliases (case-insensitive)
   - Return match if found

3. **Create New Tag** (if no match found)
   - Generate UUID for new tag
   - Create tag in Stash via GraphQL mutation
   - If Stash creation fails, use local UUID (graceful degradation)
   - Create tag in local database
   - Create hierarchy relationship (parent-child link)

### Tag Creation in Stash

**GraphQL Mutation**:
```graphql
mutation TagCreate($input: TagCreateInput!) {
  tagCreate(input: $input) {
    id
    name
  }
}
```

**Variables**:
```javascript
{
  input: {
    name: "Asian",
    parent_ids: ["<Race tag ID>"]
  }
}
```

### Sync Process

During performer sync:

1. **Pre-process Ethnicity Mapping** (before transaction):
   ```
   For each performer with ethnicity:
     ├─ Find or create tag under "Race" parent
     ├─ Store mapping: performerId → tagId
     └─ Handle errors gracefully (continue on failure)
   ```

2. **Create/Update Performer** (in transaction):
   ```
   For each performer:
     ├─ Set ethnicity (text) for backward compatibility
     ├─ Set ethnicityTagId from mapping
     └─ Upsert performer record
   ```

3. **Result**:
   - Performer has both `ethnicity` (text) and `ethnicityTagId` (FK to tag)
   - Tag hierarchy maintained
   - Tag created in Stash if new

## Benefits

### Modularity
- **Single Responsibility**: Each service has one clear purpose
- **Reusable**: Tag mapping logic can be used for other attributes (hair color, eye color, etc.)
- **Testable**: Dependency injection enables easy testing
- **Maintainable**: Clear separation of concerns

### Data Integrity
- **Normalized Data**: Ethnicities stored as tags, not free text
- **Hierarchy Support**: Tags maintain parent-child relationships
- **Alias Support**: Multiple names map to same tag
- **Backward Compatible**: Original ethnicity field preserved

### Flexibility
- **Extensible**: Easy to add more attribute mappings (country, hair color, etc.)
- **Configurable**: Parent tag name passed as parameter
- **Graceful Degradation**: Continues sync even if tag creation fails
- **Case-Insensitive**: Matches "asian", "Asian", "ASIAN" to same tag

## Future Extensibility

### Adding More Attribute Mappings

**Example: Map country to "Nationality" parent tag**:

1. **Update Schema**:
```prisma
model StashPerformer {
  countryTagId  String?
  countryTag    StashTag? @relation("PerformerCountryTag", 
                                    fields: [countryTagId], 
                                    references: [id])
}
```

2. **Update Sync Logic**:
```javascript
// Map multiple attributes
const attributeMappings = await this.tagMappingService.mapPerformerAttributes(
  {
    ethnicity: performer.ethnicity,
    country: performer.country,
    hairColor: performer.hair_color
  },
  {
    ethnicity: 'Race',
    country: 'Nationality',
    hairColor: 'Head Hair'
  }
);

// Apply to performer data
performerData.ethnicityTagId = attributeMappings.ethnicity?.id || null;
performerData.countryTagId = attributeMappings.country?.id || null;
performerData.hairColorTagId = attributeMappings.hairColor?.id || null;
```

### Batch Attribute Mapping

The `mapPerformerAttributes()` method already supports batch processing:

```javascript
const mappings = await tagMappingService.mapPerformerAttributes(
  {
    ethnicity: "Asian",
    country: "Japan",
    hairColor: "Black"
  },
  {
    ethnicity: "Race",
    country: "Nationality", 
    hairColor: "Head Hair"
  }
);

// Returns:
// {
//   ethnicity: { id: "123", name: "Asian", created: false },
//   country: { id: "456", name: "Japan", created: true },
//   hairColor: { id: "789", name: "Black Hair", created: false }
// }
```

## Configuration

### Required Tag Hierarchy

For ethnicity mapping to work, Stash must have:

1. **Parent Tag**: "Race"
   - Can be created manually in Stash
   - Or will be referenced if it exists

2. **Child Tags**: Created automatically as needed
   - Examples: "Asian", "Caucasian", "African American", etc.
   - Matched by name or alias
   - Created in Stash and local DB if new

### Tag Aliases

To map variations to the same tag, add aliases in Stash:

**Example**: Map "White" → "Caucasian"
1. Create "Caucasian" tag under "Race"
2. Add alias "White" to "Caucasian" tag
3. Sync will match both "Caucasian" and "White" to same tag

## Error Handling

### Graceful Degradation

1. **Parent Tag Not Found**:
   - Warning logged
   - Ethnicity mapping skipped for that performer
   - Sync continues with text-only ethnicity

2. **Tag Creation Fails**:
   - Warning logged
   - Uses local UUID if Stash creation fails
   - Tag still created in local DB
   - Hierarchy maintained

3. **GraphQL Error**:
   - Error caught and logged
   - Mapping skipped for that performer
   - Sync continues for remaining performers

### Logging

Clear console output for debugging:
```
🏷️  Mapping performer ethnicities to tags...
✅ Found existing tag: "Asian" (ID: abc123) under "Race"
🆕 Creating new tag: "Pacific Islander" under "Race"
✅ Created tag: "Pacific Islander" (ID: def456) under "Race"
⚠️  Parent tag "Race" not found. Tag mapping skipped for value: "Unknown"
✅ Mapped 45 ethnicities to tags
```

## Testing Recommendations

### Unit Tests

1. **Tag Matching**:
   - Test case-insensitive matching
   - Test alias matching
   - Test parent tag not found
   - Test child tag not found

2. **Tag Creation**:
   - Test Stash creation success
   - Test Stash creation failure (fallback to UUID)
   - Test local DB creation
   - Test hierarchy creation

3. **Batch Processing**:
   - Test multiple attributes
   - Test partial failures
   - Test empty values

### Integration Tests

1. **End-to-End Sync**:
   - Sync performers with various ethnicities
   - Verify tags created in Stash
   - Verify tags created in local DB
   - Verify performer-tag relationships

2. **Edge Cases**:
   - Duplicate ethnicity values
   - Empty/null ethnicity
   - Very long ethnicity strings
   - Special characters in ethnicity

## Performance Considerations

### Optimization Strategies

1. **Pre-fetch Parent Tags**: Cache parent tag IDs
2. **Batch Tag Validation**: Load all children once
3. **Transaction Placement**: Tag mapping BEFORE transaction (to avoid rollback overhead)
4. **Caching**: Consider caching tag mappings across sync pages

### Scalability

- **Current**: Processes tags sequentially per performer
- **Future**: Batch tag creation (multiple tags in one GraphQL call)
- **Alternative**: Build tag map once, reuse across sync

## Documentation Updates

Files updated:
- ✅ `server/services/performerTagMappingService.js` - Created
- ✅ `server/prisma/schema.prisma` - Updated
- ✅ `server/stashSyncServiceOptimized.js` - Updated
- ✅ `server/stashSyncService.js` - Updated
- ✅ Migration: `20251016180713_add_performer_ethnicity_tag_mapping`
- ✅ This implementation guide

## Summary

This implementation transforms performer ethnicity from a simple text field into a structured, hierarchical tag system. The modular design enables:

- **Easy extension** to other attributes (country, hair color, etc.)
- **Clean separation** between tag logic and sync logic
- **Graceful error handling** that doesn't break sync
- **Backward compatibility** with existing ethnicity data
- **Reusable components** following Eddie Life Management principles

The architecture follows the project's core principles:
- ✅ MODULAR FIRST
- ✅ CLEAN SEPARATION
- ✅ SERVICE LAYER
- ✅ REUSABLE CODE
