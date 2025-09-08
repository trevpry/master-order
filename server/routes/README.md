# Eddie Life Management - Route Structure Documentation

## Settings Systems Overview

Eddie Life Management has **TWO DISTINCT** settings systems that serve different purposes:

### 1. 🏠 Eddie Settings (Personal/Dashboard Settings)
- **Routes**: `/api/settings/eddie` (GET, PUT)
- **Legacy Route**: `/api/eddie-settings` → redirects to `/api/settings/eddie`
- **Frontend**: `client/src/modules/eddie/pages/EddieSettings.jsx`
- **Purpose**: Personal preferences and dashboard configuration
- **Settings Include**:
  - Weather API configuration (OpenWeatherMap)
  - Weather location & temperature units
  - Dashboard preferences
  - Personal lifestyle settings
- **Scope**: Eddie's personal dashboard and life management features

### 2. 🎬 Media Settings (System Configuration)
- **Routes**: `/api/settings` (GET, POST)
- **Frontend**: `client/src/modules/media/pages/settings/index.jsx`
- **Purpose**: Media system and infrastructure configuration
- **Settings Include**:
  - Plex server configuration (URL, token, users, players)
  - API keys (ComicVine, TVDB, Komga, Stash)
  - Sync intervals (Plex, Stash)
  - Order type percentages (TV, Movies, Custom orders)
  - Collection filtering (ignored collections)
  - Media player selection
  - Timezone settings
- **Scope**: Media management system configuration

## Route Organization

```
/api/settings/
├── GET    /           # Media system settings (main configuration)
├── POST   /           # Update media system settings
├── GET    /eddie      # Eddie personal settings
└── PUT    /eddie      # Update Eddie personal settings
```

## Implementation Notes

1. **Backend**: Both handled by `server/routes/settings.js`
2. **Database**: Both use the same `settings` table but different field subsets
3. **Frontend**: Completely separate pages and components
4. **Purpose Separation**: 
   - Eddie Settings = Personal/Dashboard
   - Media Settings = System/Infrastructure

## Development Guidelines

- **Eddie Settings**: Focus on personal preferences, weather, dashboard features
- **Media Settings**: Focus on media APIs, sync configuration, technical settings
- **Never mix**: Keep the two settings systems conceptually and functionally separate
- **Route naming**: Always use `/api/settings/eddie` for personal settings
- **Frontend**: Maintain separate components and styling for each settings type

## API Endpoints Quick Reference

| Endpoint | Method | Purpose | Frontend Page |
|----------|--------|---------|---------------|
| `/api/settings` | GET | Get media system settings | Media Settings |
| `/api/settings` | POST | Update media system settings | Media Settings |
| `/api/settings/eddie` | GET | Get Eddie personal settings | Eddie Settings |
| `/api/settings/eddie` | PUT | Update Eddie personal settings | Eddie Settings |
| `/api/eddie-settings` | GET/PUT | Legacy redirects to `/api/settings/eddie` | - |
