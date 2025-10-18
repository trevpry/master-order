# GEVI Movie Creation - GraphQL Schema Fix

## Issue
When creating a new group from GEVI movie data, the application threw a GraphQL validation error:

```
❌ [Create Group] Error: Stash GraphQL request failed: 422 Unprocessable Entity
{
  "errors": [
    {
      "message": "Cannot query field \"url\" on type \"String\".",
      "extensions": {"code": "GRAPHQL_VALIDATION_FAILED"}
    },
    {
      "message": "Cannot query field \"site\" on type \"String\".",
      "extensions": {"code": "GRAPHQL_VALIDATION_FAILED"}
    },
    {
      "message": "Field \"urls\" must not have a selection since type \"String\" has no subfields.",
      "extensions": {"code": "GRAPHQL_VALIDATION_FAILED"}
    }
  ]
}
```

## Root Cause
The GraphQL mutation for `groupCreate` was incorrectly treating the `urls` field as an array of objects with subfields (`url`, `site`), when it should be treated as a simple array of strings.

### Incorrect Code (Before)
```javascript
const createMutation = `
  mutation GroupCreate($input: GroupCreateInput!) {
    groupCreate(input: $input) {
      ...
      urls {
        url
        site {
          id
          name
        }
      }
      ...
    }
  }
`;

const variables = {
  input: {
    ...
    urls: url ? [{ url: url }] : []
  }
};
```

## Solution
Updated the GraphQL query and input to treat `urls` as a simple array of strings, matching Stash's actual schema.

### Correct Code (After)
```javascript
const createMutation = `
  mutation GroupCreate($input: GroupCreateInput!) {
    groupCreate(input: $input) {
      ...
      urls
      ...
    }
  }
`;

const variables = {
  input: {
    ...
    urls: url ? [url] : []
  }
};
```

## Changes Made

### File: `server/routes/stash.js`

**Line ~1407**: Updated GraphQL query
```diff
-          urls {
-            url
-            site {
-              id
-              name
-            }
-          }
+          urls
```

**Line ~1438**: Updated input variable
```diff
-        urls: url ? [{ url: url }] : []
+        urls: url ? [url] : []
```

**Line ~1469**: Updated response parsing
```diff
-        url: url || (stashGroup.urls && stashGroup.urls.length > 0 ? stashGroup.urls[0].url : null),
+        url: url || (stashGroup.urls && stashGroup.urls.length > 0 ? stashGroup.urls[0] : null),
```

## Stash GraphQL Schema Reference

According to Stash's GraphQL schema:

**Group Type**:
```graphql
type Group {
  id: ID!
  name: String!
  aliases: String
  duration: Int
  date: String
  rating100: Int
  director: String
  synopsis: String
  studio: Studio
  urls: [String!]!        # Array of strings, not objects!
  front_image_path: String
  back_image_path: String
}
```

**GroupCreateInput Type**:
```graphql
input GroupCreateInput {
  name: String!
  aliases: String
  duration: Int
  date: String
  rating100: Int
  director: String
  synopsis: String
  studio_id: ID
  urls: [String!]         # Array of strings, not objects!
}
```

## Testing

After the fix:
1. ✅ Click "Add New" on unmatched movie in scrape results
2. ✅ Movie details fetched from GEVI successfully
3. ✅ Group created in Stash via GraphQL (no validation errors)
4. ✅ Group saved to local database
5. ✅ Group moved from unmatched to matched in UI
6. ✅ Scene can be associated with newly created group

## Related Files
- `server/routes/stash.js` - Group creation endpoint (FIXED)
- `client/src/modules/media/pages/stash/SceneDetail.jsx` - Frontend "Add New" button
- `GEVI_MOVIE_INTEGRATION.md` - Full feature documentation

## Status
✅ **FIXED** - Group creation now works correctly with Stash's GraphQL schema
